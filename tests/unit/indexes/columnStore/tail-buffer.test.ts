/**
 * @module tail-buffer.test
 * @description Tests for the per-field in-memory write buffer.
 */

import { describe, it, expect } from 'vitest'
import { ColumnTailBuffer } from '../../../../src/indexes/columnStore/ColumnTailBuffer.js'
import { ValueType, DEFAULT_FLUSH_THRESHOLD } from '../../../../src/indexes/columnStore/types.js'

describe('ColumnTailBuffer', () => {
  describe('numeric values', () => {
    it('drain returns entries sorted by value', () => {
      const buf = new ColumnTailBuffer('createdAt', ValueType.Number)
      buf.add(300, 3)
      buf.add(100, 1)
      buf.add(200, 2)

      const { values, entityIds } = buf.drain()
      expect(values).toEqual([100, 200, 300])
      expect(Array.from(entityIds)).toEqual([1, 2, 3])
    })

    it('breaks ties by entityIntId ascending', () => {
      const buf = new ColumnTailBuffer('ts', ValueType.Number)
      buf.add(100, 30)
      buf.add(100, 10)
      buf.add(100, 20)

      const { entityIds } = buf.drain()
      expect(Array.from(entityIds)).toEqual([10, 20, 30])
    })

    it('handles negative values', () => {
      const buf = new ColumnTailBuffer('offset', ValueType.Number)
      buf.add(-10, 1)
      buf.add(5, 2)
      buf.add(-20, 3)

      const { values } = buf.drain()
      expect(values).toEqual([-20, -10, 5])
    })
  })

  describe('string values', () => {
    it('drain returns entries sorted lexicographically', () => {
      const buf = new ColumnTailBuffer('status', ValueType.String)
      buf.add('pending', 3)
      buf.add('active', 1)
      buf.add('inactive', 2)

      const { values, entityIds } = buf.drain()
      expect(values).toEqual(['active', 'inactive', 'pending'])
      expect(Array.from(entityIds)).toEqual([1, 2, 3])
    })
  })

  describe('boolean values', () => {
    it('sorts false (0) before true (1)', () => {
      const buf = new ColumnTailBuffer('isActive', ValueType.Boolean)
      buf.add(1, 1)
      buf.add(0, 2)
      buf.add(1, 3)
      buf.add(0, 4)

      const { values, entityIds } = buf.drain()
      expect(values).toEqual([0, 0, 1, 1])
      expect(Array.from(entityIds)).toEqual([2, 4, 1, 3])
    })
  })

  describe('removal', () => {
    it('removes pending entries from buffer', () => {
      const buf = new ColumnTailBuffer('x', ValueType.Number)
      buf.add(100, 1)
      buf.add(200, 2)
      buf.add(300, 3)

      buf.remove(2)

      const { values, entityIds, pendingRemovals } = buf.drain()
      expect(values).toEqual([100, 300])
      expect(Array.from(entityIds)).toEqual([1, 3])
      expect(pendingRemovals.has(2)).toBe(true)
    })

    it('tracks pending removals for existing segments', () => {
      const buf = new ColumnTailBuffer('x', ValueType.Number)
      buf.remove(42)
      buf.remove(99)

      const { pendingRemovals } = buf.drain()
      expect(pendingRemovals.has(42)).toBe(true)
      expect(pendingRemovals.has(99)).toBe(true)
    })
  })

  describe('threshold', () => {
    it('shouldFlush returns false below threshold', () => {
      const buf = new ColumnTailBuffer('x', ValueType.Number, 3)
      buf.add(1, 1)
      buf.add(2, 2)
      expect(buf.shouldFlush()).toBe(false)
    })

    it('shouldFlush returns true at threshold', () => {
      const buf = new ColumnTailBuffer('x', ValueType.Number, 3)
      buf.add(1, 1)
      buf.add(2, 2)
      buf.add(3, 3)
      expect(buf.shouldFlush()).toBe(true)
    })

    it('uses default threshold when not specified', () => {
      const buf = new ColumnTailBuffer('x', ValueType.Number)
      expect(buf.threshold).toBe(DEFAULT_FLUSH_THRESHOLD)
    })
  })

  describe('drain clears buffer', () => {
    it('buffer is empty after drain', () => {
      const buf = new ColumnTailBuffer('x', ValueType.Number)
      buf.add(1, 1)
      buf.add(2, 2)
      expect(buf.size).toBe(2)

      buf.drain()
      expect(buf.size).toBe(0)
    })

    it('removals are cleared after drain', () => {
      const buf = new ColumnTailBuffer('x', ValueType.Number)
      buf.remove(42)
      buf.drain()

      const { pendingRemovals } = buf.drain()
      expect(pendingRemovals.size).toBe(0)
    })
  })

  describe('clear', () => {
    it('clears entries and removals without returning data', () => {
      const buf = new ColumnTailBuffer('x', ValueType.Number)
      buf.add(1, 1)
      buf.remove(99)

      buf.clear()
      expect(buf.size).toBe(0)

      const { values, pendingRemovals } = buf.drain()
      expect(values).toEqual([])
      expect(pendingRemovals.size).toBe(0)
    })
  })

  describe('multi-value (words)', () => {
    it('supports multiple entries with the same entityIntId', () => {
      const buf = new ColumnTailBuffer('__words__', ValueType.String)
      buf.add('machine', 5)
      buf.add('learning', 5)
      buf.add('neural', 10)
      buf.add('algorithm', 5)

      const { values, entityIds } = buf.drain()
      // Sorted lexicographically
      expect(values).toEqual(['algorithm', 'learning', 'machine', 'neural'])
      expect(Array.from(entityIds)).toEqual([5, 5, 5, 10])
    })
  })
})
