/**
 * @module segment-cursor.test
 * @description Tests for the segment cursor: binary search, iteration, tombstones.
 */

import { describe, it, expect } from 'vitest'
import { ColumnSegmentCursor, TailBufferCursor } from '../../../../src/indexes/columnStore/ColumnSegmentCursor.js'
import { ValueType, CIDX_MAGIC, CIDX_VERSION } from '../../../../src/indexes/columnStore/types.js'
import { RoaringBitmap32 } from '../../../../src/utils/roaring/index.js'

function makeNumericCursor(values: number[], entityIds: number[], tombstones: number[] = []): ColumnSegmentCursor {
  return new ColumnSegmentCursor(
    {
      magic: CIDX_MAGIC,
      version: CIDX_VERSION,
      fieldName: 'test',
      fieldNameLength: 4,
      valueType: ValueType.Number,
      level: 0,
      codec: 0,
      flags: 0,
      count: values.length
    },
    values,
    new Uint32Array(entityIds),
    new RoaringBitmap32(tombstones)
  )
}

function makeStringCursor(values: string[], entityIds: number[], tombstones: number[] = []): ColumnSegmentCursor {
  return new ColumnSegmentCursor(
    {
      magic: CIDX_MAGIC,
      version: CIDX_VERSION,
      fieldName: 'status',
      fieldNameLength: 6,
      valueType: ValueType.String,
      level: 0,
      codec: 0,
      flags: 0,
      count: values.length
    },
    values,
    new Uint32Array(entityIds),
    new RoaringBitmap32(tombstones)
  )
}

describe('ColumnSegmentCursor', () => {
  // -----------------------------------------------------------------------
  // Binary search
  // -----------------------------------------------------------------------

  describe('binarySearchValue (numeric)', () => {
    it('finds exact match', () => {
      const c = makeNumericCursor([100, 200, 300, 400, 500], [1, 2, 3, 4, 5])
      const r = c.binarySearchValue(300)
      expect(r.found).toBe(true)
      expect(r.index).toBe(2)
    })

    it('returns insertion point when not found', () => {
      const c = makeNumericCursor([100, 200, 400, 500], [1, 2, 3, 4])
      const r = c.binarySearchValue(300)
      expect(r.found).toBe(false)
      expect(r.index).toBe(2) // would insert at position 2
    })

    it('handles before-first', () => {
      const c = makeNumericCursor([100, 200, 300], [1, 2, 3])
      const r = c.binarySearchValue(50)
      expect(r.found).toBe(false)
      expect(r.index).toBe(0)
    })

    it('handles after-last', () => {
      const c = makeNumericCursor([100, 200, 300], [1, 2, 3])
      const r = c.binarySearchValue(999)
      expect(r.found).toBe(false)
      expect(r.index).toBe(3)
    })

    it('finds first occurrence of duplicates', () => {
      const c = makeNumericCursor([100, 200, 200, 200, 300], [1, 2, 3, 4, 5])
      const r = c.binarySearchValue(200)
      expect(r.found).toBe(true)
      expect(r.index).toBe(1) // first occurrence
    })
  })

  describe('binarySearchValue (string)', () => {
    it('finds exact match', () => {
      const c = makeStringCursor(['active', 'inactive', 'pending'], [1, 2, 3])
      const r = c.binarySearchValue('inactive')
      expect(r.found).toBe(true)
      expect(r.index).toBe(1)
    })

    it('returns insertion point when not found', () => {
      const c = makeStringCursor(['active', 'pending'], [1, 2])
      const r = c.binarySearchValue('inactive')
      expect(r.found).toBe(false)
      expect(r.index).toBe(1)
    })
  })

  // -----------------------------------------------------------------------
  // Range search
  // -----------------------------------------------------------------------

  describe('binarySearchRange', () => {
    it('finds range with inclusive bounds', () => {
      const c = makeNumericCursor([100, 200, 300, 400, 500], [1, 2, 3, 4, 5])
      const { startIdx, endIdx } = c.binarySearchRange(200, 400)
      expect(startIdx).toBe(1) // 200
      expect(endIdx).toBe(4) // excludes 500
    })

    it('handles range beyond data', () => {
      const c = makeNumericCursor([100, 200, 300], [1, 2, 3])
      const { startIdx, endIdx } = c.binarySearchRange(0, 999)
      expect(startIdx).toBe(0)
      expect(endIdx).toBe(3) // all entries
    })

    it('handles empty range', () => {
      const c = makeNumericCursor([100, 200, 300], [1, 2, 3])
      const { startIdx, endIdx } = c.binarySearchRange(150, 180)
      expect(startIdx).toBe(1) // insertion point for 150
      expect(endIdx).toBe(1) // nothing between 150 and 180
    })
  })

  // -----------------------------------------------------------------------
  // Point and range queries
  // -----------------------------------------------------------------------

  describe('getEntityIdsForValue', () => {
    it('returns matching entity IDs', () => {
      const c = makeNumericCursor([100, 200, 200, 300], [10, 20, 30, 40])
      expect(c.getEntityIdsForValue(200)).toEqual([20, 30])
    })

    it('returns empty for no match', () => {
      const c = makeNumericCursor([100, 200, 300], [10, 20, 30])
      expect(c.getEntityIdsForValue(999)).toEqual([])
    })

    it('excludes tombstoned entries', () => {
      const c = makeNumericCursor([100, 200, 200, 300], [10, 20, 30, 40], [1]) // position 1 tombstoned
      expect(c.getEntityIdsForValue(200)).toEqual([30]) // position 1 (entityId=20) excluded
    })
  })

  describe('getEntityIdsInRange', () => {
    it('returns entities in range', () => {
      const c = makeNumericCursor([100, 200, 300, 400, 500], [1, 2, 3, 4, 5])
      expect(c.getEntityIdsInRange(200, 400)).toEqual([2, 3, 4])
    })

    it('excludes tombstoned', () => {
      const c = makeNumericCursor([100, 200, 300, 400, 500], [1, 2, 3, 4, 5], [2]) // position 2 (value=300)
      expect(c.getEntityIdsInRange(200, 400)).toEqual([2, 4])
    })
  })

  // -----------------------------------------------------------------------
  // Iteration
  // -----------------------------------------------------------------------

  describe('iterateForward', () => {
    it('yields all entries in order', () => {
      const c = makeNumericCursor([100, 200, 300], [1, 2, 3])
      const entries = [...c.iterateForward()]
      expect(entries).toHaveLength(3)
      expect(entries[0]).toEqual({ value: 100, entityIntId: 1, position: 0 })
      expect(entries[2]).toEqual({ value: 300, entityIntId: 3, position: 2 })
    })

    it('skips tombstoned entries', () => {
      const c = makeNumericCursor([100, 200, 300], [1, 2, 3], [1])
      const entries = [...c.iterateForward()]
      expect(entries).toHaveLength(2)
      expect(entries.map(e => e.entityIntId)).toEqual([1, 3])
    })

    it('starts from offset', () => {
      const c = makeNumericCursor([100, 200, 300, 400], [1, 2, 3, 4])
      const entries = [...c.iterateForward(2)]
      expect(entries).toHaveLength(2)
      expect(entries[0].value).toBe(300)
    })
  })

  describe('iterateBackward', () => {
    it('yields all entries in reverse order', () => {
      const c = makeNumericCursor([100, 200, 300], [1, 2, 3])
      const entries = [...c.iterateBackward()]
      expect(entries).toHaveLength(3)
      expect(entries[0]).toEqual({ value: 300, entityIntId: 3, position: 2 })
      expect(entries[2]).toEqual({ value: 100, entityIntId: 1, position: 0 })
    })

    it('skips tombstoned entries', () => {
      const c = makeNumericCursor([100, 200, 300], [1, 2, 3], [1])
      const entries = [...c.iterateBackward()]
      expect(entries).toHaveLength(2)
      expect(entries.map(e => e.entityIntId)).toEqual([3, 1])
    })
  })

  // -----------------------------------------------------------------------
  // Zone map (min/max)
  // -----------------------------------------------------------------------

  describe('zone map', () => {
    it('minValue returns first value', () => {
      const c = makeNumericCursor([100, 200, 300], [1, 2, 3])
      expect(c.minValue).toBe(100)
    })

    it('maxValue returns last value', () => {
      const c = makeNumericCursor([100, 200, 300], [1, 2, 3])
      expect(c.maxValue).toBe(300)
    })

    it('handles empty segment', () => {
      const c = makeNumericCursor([], [])
      expect(c.minValue).toBeUndefined()
      expect(c.maxValue).toBeUndefined()
    })
  })

  describe('liveCount', () => {
    it('subtracts tombstones from count', () => {
      const c = makeNumericCursor([100, 200, 300], [1, 2, 3], [0, 2])
      expect(c.liveCount).toBe(1)
    })
  })

  // -----------------------------------------------------------------------
  // TailBufferCursor
  // -----------------------------------------------------------------------

  describe('TailBufferCursor', () => {
    it('iterates forward', () => {
      const c = new TailBufferCursor([10, 20, 30], new Uint32Array([1, 2, 3]), ValueType.Number)
      const entries = [...c.iterateForward()]
      expect(entries).toHaveLength(3)
      expect(entries[0].value).toBe(10)
    })

    it('iterates backward', () => {
      const c = new TailBufferCursor([10, 20, 30], new Uint32Array([1, 2, 3]), ValueType.Number)
      const entries = [...c.iterateBackward()]
      expect(entries[0].value).toBe(30)
    })

    it('point query returns matching IDs', () => {
      const c = new TailBufferCursor([10, 20, 20, 30], new Uint32Array([1, 2, 3, 4]), ValueType.Number)
      expect(c.getEntityIdsForValue(20)).toEqual([2, 3])
    })

    it('min/max values', () => {
      const c = new TailBufferCursor([10, 20, 30], new Uint32Array([1, 2, 3]), ValueType.Number)
      expect(c.minValue).toBe(10)
      expect(c.maxValue).toBe(30)
    })
  })
})
