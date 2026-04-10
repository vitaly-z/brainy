/**
 * @module manifest.test
 * @description Tests for the per-field manifest manager.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { ColumnManifest } from '../../../../src/indexes/columnStore/ColumnManifest.js'
import { ValueType, type SegmentMeta } from '../../../../src/indexes/columnStore/types.js'

/**
 * Minimal mock storage for manifest persistence tests.
 * Only implements readObjectFromPath and writeObjectToPath.
 */
class MockStorage {
  private data = new Map<string, any>()

  async readObjectFromPath(path: string): Promise<any> {
    return this.data.get(path) ?? null
  }

  async writeObjectToPath(path: string, obj: any): Promise<void> {
    this.data.set(path, JSON.parse(JSON.stringify(obj))) // deep clone
  }
}

describe('ColumnManifest', () => {
  let storage: MockStorage

  beforeEach(() => {
    storage = new MockStorage()
  })

  it('starts fresh when no stored manifest exists', async () => {
    const manifest = new ColumnManifest('createdAt')
    await manifest.load(storage as any)

    expect(manifest.isEmpty()).toBe(true)
    expect(manifest.getAllSegments()).toEqual([])
    expect(manifest.totalCount).toBe(0)
  })

  it('save and reload preserves data', async () => {
    const m1 = new ColumnManifest('createdAt')
    m1.valueType = ValueType.Number
    m1.addSegment({
      id: m1.nextSegmentId(),
      level: 0,
      count: 50000,
      minValue: 1700000000000,
      maxValue: 1700100000000,
      file: 'L0-000001.cidx'
    })
    await m1.save(storage as any)

    // Reload
    const m2 = new ColumnManifest('createdAt')
    await m2.load(storage as any)

    expect(m2.isEmpty()).toBe(false)
    expect(m2.getAllSegments()).toHaveLength(1)
    expect(m2.getAllSegments()[0].count).toBe(50000)
    expect(m2.valueType).toBe(ValueType.Number)
  })

  it('nextSegmentId increments monotonically', () => {
    const manifest = new ColumnManifest('test')
    const id1 = manifest.nextSegmentId()
    const id2 = manifest.nextSegmentId()
    const id3 = manifest.nextSegmentId()
    expect(id1).toBe(1)
    expect(id2).toBe(2)
    expect(id3).toBe(3)
  })

  it('addSegment keeps segments sorted by level then id', () => {
    const manifest = new ColumnManifest('test')
    manifest.addSegment({ id: 3, level: 1, count: 100, minValue: 0, maxValue: 100, file: 'L1-3.cidx' })
    manifest.addSegment({ id: 1, level: 0, count: 50, minValue: 0, maxValue: 50, file: 'L0-1.cidx' })
    manifest.addSegment({ id: 2, level: 0, count: 50, minValue: 50, maxValue: 100, file: 'L0-2.cidx' })

    const segs = manifest.getAllSegments()
    expect(segs[0].id).toBe(1) // L0, id=1
    expect(segs[1].id).toBe(2) // L0, id=2
    expect(segs[2].id).toBe(3) // L1, id=3
  })

  it('removeSegments deletes by ID', () => {
    const manifest = new ColumnManifest('test')
    manifest.addSegment({ id: 1, level: 0, count: 50, minValue: 0, maxValue: 50, file: 'L0-1.cidx' })
    manifest.addSegment({ id: 2, level: 0, count: 50, minValue: 50, maxValue: 100, file: 'L0-2.cidx' })
    manifest.addSegment({ id: 3, level: 1, count: 100, minValue: 0, maxValue: 100, file: 'L1-3.cidx' })

    manifest.removeSegments([1, 2])
    expect(manifest.getAllSegments()).toHaveLength(1)
    expect(manifest.getAllSegments()[0].id).toBe(3)
  })

  it('getSegmentsAtLevel filters correctly', () => {
    const manifest = new ColumnManifest('test')
    manifest.addSegment({ id: 1, level: 0, count: 50, minValue: 0, maxValue: 50, file: 'L0-1.cidx' })
    manifest.addSegment({ id: 2, level: 0, count: 50, minValue: 50, maxValue: 100, file: 'L0-2.cidx' })
    manifest.addSegment({ id: 3, level: 1, count: 100, minValue: 0, maxValue: 100, file: 'L1-3.cidx' })

    expect(manifest.getSegmentsAtLevel(0)).toHaveLength(2)
    expect(manifest.getSegmentsAtLevel(1)).toHaveLength(1)
    expect(manifest.getSegmentsAtLevel(2)).toHaveLength(0)
  })

  it('segmentPath generates correct paths', () => {
    const manifest = new ColumnManifest('createdAt', '_column_index')
    expect(manifest.segmentPath(0, 1)).toBe('_column_index/createdAt/L0-000001.cidx')
    expect(manifest.segmentPath(1, 42)).toBe('_column_index/createdAt/L1-000042.cidx')
    expect(manifest.segmentPath(0, 999999)).toBe('_column_index/createdAt/L0-999999.cidx')
  })

  it('manifestPath generates correct path', () => {
    const manifest = new ColumnManifest('status', '_column_index')
    expect(manifest.manifestPath()).toBe('_column_index/status/MANIFEST.json')
  })

  it('totalCount sums across segments', () => {
    const manifest = new ColumnManifest('test')
    manifest.addSegment({ id: 1, level: 0, count: 100, minValue: 0, maxValue: 0, file: 'a' })
    manifest.addSegment({ id: 2, level: 0, count: 200, minValue: 0, maxValue: 0, file: 'b' })
    manifest.addSegment({ id: 3, level: 1, count: 300, minValue: 0, maxValue: 0, file: 'c' })
    expect(manifest.totalCount).toBe(600)
  })

  it('version increments on each save', async () => {
    const manifest = new ColumnManifest('test')
    const v0 = manifest.getData().version
    await manifest.save(storage as any)
    const v1 = manifest.getData().version
    await manifest.save(storage as any)
    const v2 = manifest.getData().version
    expect(v1).toBe(v0 + 1)
    expect(v2).toBe(v1 + 1)
  })

  it('multiValue flag persists', async () => {
    const m1 = new ColumnManifest('__words__')
    m1.multiValue = true
    m1.valueType = ValueType.String
    await m1.save(storage as any)

    const m2 = new ColumnManifest('__words__')
    await m2.load(storage as any)
    expect(m2.multiValue).toBe(true)
    expect(m2.valueType).toBe(ValueType.String)
  })

  it('buildComplete flag persists', async () => {
    const m1 = new ColumnManifest('test')
    expect(m1.buildComplete).toBe(false)
    m1.buildComplete = true
    await m1.save(storage as any)

    const m2 = new ColumnManifest('test')
    await m2.load(storage as any)
    expect(m2.buildComplete).toBe(true)
  })
})
