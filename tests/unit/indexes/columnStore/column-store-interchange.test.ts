/**
 * @module column-store-interchange.test
 * @description 2.4.0 #4 — column-store JS↔native interchange. Pins down that
 * brainy's JS `ColumnStore` writes segments + DELETED bitmaps via the binary-
 * blob primitive at the cortex-shared key convention, AND that indexes
 * persisted under the pre-2.4.0 envelope (`{ _binary, base64 }` at the
 * `.cidx` object-path) still load correctly via the legacy-read fallback.
 *
 * Together these properties make the JS and native engines byte-compatible
 * at the segment payload, so writing through one and reading through the
 * other is a no-op format-wise — closing the gap the cortex 2.3.1 read-side
 * fallback opened on the cortex side.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { ColumnStore } from '../../../../src/indexes/columnStore/ColumnStore.js'
import { MemoryStorage } from '../../../../src/storage/adapters/memoryStorage.js'
import { EntityIdMapper } from '../../../../src/utils/entityIdMapper.js'
import { writeSegmentToBuffer } from '../../../../src/indexes/columnStore/ColumnSegmentFormat.js'
import { ColumnManifest } from '../../../../src/indexes/columnStore/ColumnManifest.js'
import { RoaringBitmap32 } from '../../../../src/utils/roaring/index.js'

describe('ColumnStore — JS↔native interchange (2.4.0 #4)', () => {
  let storage: MemoryStorage
  let idMapper: EntityIdMapper
  let store: ColumnStore

  beforeEach(async () => {
    storage = new MemoryStorage()
    await storage.init()
    idMapper = new EntityIdMapper({ storage, storageKey: 'test:idMapper' })
    await idMapper.init()
    store = new ColumnStore({ flushThreshold: 10 })
    await store.init(storage, idMapper)
  })

  afterEach(async () => {
    await store.close()
  })

  // -----------------------------------------------------------------------
  // WRITE side: raw blob at the cortex-shared key, no legacy envelope
  // -----------------------------------------------------------------------

  it('flushBuffer writes segment bytes as a raw blob at the cortex-shared key', async () => {
    for (let i = 0; i < 5; i++) {
      store.addEntity(idMapper.getOrAssign(`u-${i}`), { score: i * 10 })
    }
    await store.flush()

    // The raw blob exists at the suffix-free cortex key.
    const key = '_column_index/score/L0-000001'
    const raw = await (storage as any).loadBinaryBlob(key)
    expect(Buffer.isBuffer(raw)).toBe(true)
    expect(raw!.length).toBeGreaterThan(0)

    // The legacy envelope at the `.cidx` object-path is NOT written (no
    // 33% base64 bloat, no dual-write).
    const legacyPath = '_column_index/score/L0-000001.cidx'
    const legacyEnvelope = await (storage as any).readObjectFromPath(legacyPath)
    expect(legacyEnvelope).toBeFalsy()
  })

  it('flushBuffer writes the DELETED bitmap as a raw blob too (not an envelope)', async () => {
    for (let i = 0; i < 3; i++) {
      store.addEntity(idMapper.getOrAssign(`u-${i}`), { score: i })
    }
    store.removeEntity(idMapper.getInt('u-1')!)
    await store.flush()

    const rawDel = await (storage as any).loadBinaryBlob('_column_index/score/DELETED')
    expect(Buffer.isBuffer(rawDel)).toBe(true)
    expect(rawDel!.length).toBeGreaterThan(0)

    const legacyEnvelope = await (storage as any).readObjectFromPath(
      '_column_index/score/DELETED.bin'
    )
    expect(legacyEnvelope).toBeFalsy()
  })

  // -----------------------------------------------------------------------
  // READ side: pre-2.4.0 legacy envelope still loads via the fallback
  // -----------------------------------------------------------------------

  it('loads a segment persisted as the pre-2.4.0 envelope (legacy fallback)', async () => {
    // Seed a legacy-format index DIRECTLY on storage — the on-disk shape
    // brainy 7.20.0..7.25.0 wrote before this commit.
    const legacyStore = new ColumnStore()
    await legacyStore.init(storage, idMapper)

    // Build a segment buffer using the shared cidx format.
    const values: number[] = [10, 20, 30]
    const entityIds: number[] = [
      idMapper.getOrAssign('legacy-a'),
      idMapper.getOrAssign('legacy-b'),
      idMapper.getOrAssign('legacy-c')
    ]
    const segBuffer = writeSegmentToBuffer(
      {
        fieldName: 'score',
        fieldNameLength: 5,
        valueType: 0,
        level: 0,
        codec: 0,
        flags: 0,
        count: values.length
      },
      values,
      entityIds
    )

    // Persist via the LEGACY envelope path (writeObjectToPath, base64 wrap).
    await (storage as any).writeObjectToPath('_column_index/score/L0-000001.cidx', {
      _binary: true,
      data: segBuffer.toString('base64')
    })
    const manifest = new ColumnManifest('score', '_column_index')
    manifest.valueType = 0
    manifest.multiValue = false
    manifest.addSegment({
      id: 1,
      level: 0,
      count: values.length,
      minValue: values[0],
      maxValue: values[values.length - 1],
      file: 'L0-000001.cidx'
    })
    await manifest.save(storage)
    await legacyStore.close()

    // NEW ColumnStore re-discovers the manifest at init, then the legacy
    // segment loads via the readObjectFromPath fallback (no raw blob exists
    // at the cortex key, so it falls through). sortTopK returns the entities
    // in the order the segment recorded — proves the bytes round-tripped.
    const readStore = new ColumnStore()
    await readStore.init(storage, idMapper)
    const sortedInts = await readStore.sortTopK('score', 'asc', 10)
    const sortedUuids = sortedInts.map(i => idMapper.getUuid(i))
    expect(sortedUuids).toEqual(['legacy-a', 'legacy-b', 'legacy-c'])
    await readStore.close()
  })

  it('loads a DELETED bitmap persisted as the pre-2.4.0 envelope (legacy fallback)', async () => {
    // Manually seed a legacy DELETED.bin envelope, then re-init and confirm
    // the entity it marks gone is excluded from filter/sort results.
    const bm = new RoaringBitmap32()
    bm.add(idMapper.getOrAssign('dead'))
    const serialized = Buffer.from(bm.serialize(true))
    await (storage as any).writeObjectToPath('_column_index/score/DELETED.bin', {
      _binary: true,
      data: serialized.toString('base64')
    })

    // Add a couple of live entities so a manifest exists (init only loads
    // DELETED for fields with a manifest on disk).
    store.addEntity(idMapper.getOrAssign('alive-1'), { score: 100 })
    store.addEntity(idMapper.getOrAssign('alive-2'), { score: 200 })
    await store.flush()
    await store.close()

    const readStore = new ColumnStore()
    await readStore.init(storage, idMapper)
    const sortedInts = await readStore.sortTopK('score', 'asc', 10)
    const sortedUuids = sortedInts.map(i => idMapper.getUuid(i))

    // The dead entity must NOT appear; the alive ones must.
    expect(sortedUuids).not.toContain('dead')
    expect(sortedUuids).toContain('alive-1')
    expect(sortedUuids).toContain('alive-2')
    await readStore.close()
  })

  // -----------------------------------------------------------------------
  // ROUND-TRIP: write-then-read in the new format
  // -----------------------------------------------------------------------

  it('write (new format) → re-init → read returns the same data', async () => {
    for (let i = 0; i < 5; i++) {
      store.addEntity(idMapper.getOrAssign(`u-${i}`), { score: i * 10 })
    }
    await store.flush()
    await store.close()

    const readStore = new ColumnStore()
    await readStore.init(storage, idMapper)
    const sortedInts = await readStore.sortTopK('score', 'asc', 10)
    const sortedUuids = sortedInts.map(i => idMapper.getUuid(i))
    expect(sortedUuids).toEqual(['u-0', 'u-1', 'u-2', 'u-3', 'u-4'])
    await readStore.close()
  })
})
