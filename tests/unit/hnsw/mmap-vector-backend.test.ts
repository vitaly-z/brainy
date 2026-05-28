/**
 * @module hnsw/mmapVectorBackend.test
 * @description Unit tests for the `MmapVectorBackend` bridge — the brainy-side
 * wrapper that translates UUID-keyed vector reads/writes into stable int slot
 * ops against an `vectorStore:mmap` provider.
 *
 * Mocks the provider so the tests run without cortex installed (cortex is a
 * downstream consumer of brainy, not a dev dep). The real integration with
 * cortex's `NativeMmapVectorStore` is exercised when cortex 2.4.0 picks up
 * this brainy release and re-runs its cross-language parity suite.
 *
 * Coverage:
 * 1. Open-then-write-then-read round-trips for a single vector.
 * 2. Batch reads return an array aligned with the input UUIDs, with `null`
 *    entries for misses interleaved among hits — order preserved.
 * 3. Slot assignment is stable across multiple writes for the same UUID
 *    (no re-slot, no overwrite of an adjacent slot).
 * 4. Writes beyond the initial capacity grow the file (doubling) without
 *    losing the vectors already written.
 * 5. `readByUuid` returns `null` for both unknown UUIDs and UUIDs in the map
 *    whose slot has not yet been written.
 * 6. Open is idempotent — opening an already-existing file reuses it.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { tmpdir } from 'node:os'
import { mkdtemp, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { MmapVectorBackend } from '../../../src/hnsw/mmapVectorBackend.js'
import { EntityIdMapper } from '../../../src/utils/entityIdMapper.js'
import type {
  VectorStoreMmapInstance,
  VectorStoreMmapProvider
} from '../../../src/plugin.js'

/**
 * Minimal storage stub for the EntityIdMapper. The mapper only touches storage
 * in init/flush; for these tests the mapper starts empty and is never flushed.
 */
const stubStorage = {
  getMetadata: async () => undefined,
  saveMetadata: async () => {},
  getNouns: async () => ({ totalCount: 0, items: [] })
} as any

/**
 * Pure in-memory mmap store. Mirrors cortex's NativeMmapVectorStore surface
 * just closely enough to exercise the backend's contract — no real mmap, no
 * file I/O, no f32 round-trip narrowing (the precision check is out of scope
 * here; that's covered by cortex's parity suite).
 */
class MockMmapStore implements VectorStoreMmapInstance {
  private readonly vectors: Array<number[] | undefined> = []
  private highestWritten = -1
  constructor(
    public readonly dim: number,
    private _capacity: number
  ) {}
  get count(): number {
    return this.highestWritten + 1
  }
  get capacity(): number {
    return this._capacity
  }
  writeVector(index: number, vector: number[]): void {
    if (index >= this._capacity) {
      throw new Error(`Slot ${index} >= capacity ${this._capacity}`)
    }
    if (vector.length !== this.dim) {
      throw new Error(`Dim mismatch: expected ${this.dim}, got ${vector.length}`)
    }
    this.vectors[index] = [...vector]
    if (index > this.highestWritten) this.highestWritten = index
  }
  writeVectorsBatch(startIndex: number, vectorsFlat: number[]): number {
    if (vectorsFlat.length % this.dim !== 0) {
      throw new Error('vectorsFlat length not a multiple of dim')
    }
    const n = vectorsFlat.length / this.dim
    for (let i = 0; i < n; i++) {
      this.writeVector(startIndex + i, vectorsFlat.slice(i * this.dim, (i + 1) * this.dim))
    }
    return n
  }
  readVector(index: number): number[] {
    const v = this.vectors[index]
    if (!v) throw new Error(`Slot ${index} not written`)
    return [...v]
  }
  readVectorsBatch(indices: number[]): number[] {
    const flat: number[] = []
    for (const i of indices) {
      const v = this.vectors[i]
      if (!v) throw new Error(`Slot ${i} not written`)
      for (let k = 0; k < this.dim; k++) flat.push(v[k])
    }
    return flat
  }
  prefetch(_indices: number[]): void {
    /* no-op in mock */
  }
  resize(newCapacity: number): void {
    if (newCapacity < this._capacity) throw new Error('Cannot shrink')
    this._capacity = newCapacity
  }
  flush(): void {
    /* no-op in mock */
  }
}

/**
 * Mock provider — keeps one MockMmapStore per path. open() throws if the path
 * doesn't exist yet (matches cortex semantics: open() is for existing files
 * only); create() throws if it does (cortex doesn't, but the brainy backend
 * does open-first-then-create, so the throw path is exercised).
 */
class MockMmapProvider implements VectorStoreMmapProvider {
  private files = new Map<string, MockMmapStore>()
  create(path: string, dim: number, capacity: number): VectorStoreMmapInstance {
    if (this.files.has(path)) throw new Error(`File exists at ${path}`)
    const store = new MockMmapStore(dim, capacity)
    this.files.set(path, store)
    return store
  }
  open(path: string): VectorStoreMmapInstance {
    const store = this.files.get(path)
    if (!store) throw new Error(`No file at ${path}`)
    return store
  }
  openReadOnly(path: string): VectorStoreMmapInstance {
    return this.open(path)
  }
  /** Test helper — peek at the underlying store. */
  _peek(path: string): MockMmapStore | undefined {
    return this.files.get(path)
  }
}

describe('MmapVectorBackend (2.4.0 #2 — wraps vectorStore:mmap provider)', () => {
  let dir: string
  let path: string
  let idMapper: EntityIdMapper
  let provider: MockMmapProvider

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'brainy-mmap-vec-'))
    path = join(dir, 'vectors.bin')
    idMapper = new EntityIdMapper({ storage: stubStorage })
    await idMapper.init()
    provider = new MockMmapProvider()
  })

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true }).catch(() => {})
  })

  it('open creates a new file when none exists, then round-trips a vector by UUID', async () => {
    const backend = await MmapVectorBackend.open(provider, path, 4, 16, idMapper)
    expect(backend.dim).toBe(4)

    backend.writeByUuid('alpha', [1, 2, 3, 4])
    expect(backend.readByUuid('alpha')).toEqual([1, 2, 3, 4])
  })

  it('reads return null for unknown UUIDs and for UUIDs in the map but not yet written', async () => {
    const backend = await MmapVectorBackend.open(provider, path, 2, 8, idMapper)

    // Unknown — never seen by the mapper.
    expect(backend.readByUuid('ghost')).toBeNull()

    // Known to the mapper but no slot ever written. We assign through the
    // mapper directly so the backend itself has not touched the slot.
    idMapper.getOrAssign('reserved')
    expect(backend.readByUuid('reserved')).toBeNull()
  })

  it('batch read returns an array aligned to the input UUIDs (nulls preserved in place)', async () => {
    const backend = await MmapVectorBackend.open(provider, path, 3, 16, idMapper)
    backend.writeByUuid('a', [1, 1, 1])
    backend.writeByUuid('b', [2, 2, 2])
    backend.writeByUuid('c', [3, 3, 3])

    // Interleave hits + a never-seen UUID + a duplicate hit. Order preserved.
    const result = backend.readBatchByUuid(['b', 'missing', 'a', 'c', 'missing-too', 'b'])
    expect(result).toEqual([
      [2, 2, 2],
      null,
      [1, 1, 1],
      [3, 3, 3],
      null,
      [2, 2, 2]
    ])
  })

  it('writes for the same UUID land in the same slot (stable id, no re-slotting)', async () => {
    const backend = await MmapVectorBackend.open(provider, path, 2, 8, idMapper)
    backend.writeByUuid('persistent', [1, 1])
    const slotAfterFirstWrite = idMapper.getInt('persistent')

    backend.writeByUuid('persistent', [9, 9]) // overwrite the same slot
    expect(idMapper.getInt('persistent')).toBe(slotAfterFirstWrite)
    expect(backend.readByUuid('persistent')).toEqual([9, 9])

    // Another UUID gets a different slot, and the first vector is undisturbed.
    backend.writeByUuid('other', [5, 5])
    expect(idMapper.getInt('other')).not.toBe(slotAfterFirstWrite)
    expect(backend.readByUuid('persistent')).toEqual([9, 9])
    expect(backend.readByUuid('other')).toEqual([5, 5])
  })

  it('grows the file (doubling) when a write lands beyond capacity, without losing prior data', async () => {
    // Start at the smallest sane initial capacity (clamped to 16 by the backend).
    const backend = await MmapVectorBackend.open(provider, path, 2, 1, idMapper)
    const store = provider._peek(path)!
    expect(store.capacity).toBe(16) // backend floor

    // Write 20 vectors so capacity must double at least once (16 → 32).
    const uuids: string[] = []
    for (let i = 0; i < 20; i++) {
      const uuid = `u-${i}`
      uuids.push(uuid)
      backend.writeByUuid(uuid, [i, i * 2])
    }
    expect(store.capacity).toBeGreaterThanOrEqual(32)

    // Every vector survived the growth — no slot got overwritten or lost.
    for (let i = 0; i < uuids.length; i++) {
      expect(backend.readByUuid(uuids[i])).toEqual([i, i * 2])
    }
  })

  it('opens an existing file idempotently when the second open hits the same path', async () => {
    // First open creates.
    const backend1 = await MmapVectorBackend.open(provider, path, 2, 8, idMapper)
    backend1.writeByUuid('persisted', [7, 7])

    // Second open against the same path. The provider's create() throws on
    // collision; the backend's open-first behaviour means we reuse the file.
    const backend2 = await MmapVectorBackend.open(provider, path, 2, 8, idMapper)
    expect(backend2.readByUuid('persisted')).toEqual([7, 7])
  })
})
