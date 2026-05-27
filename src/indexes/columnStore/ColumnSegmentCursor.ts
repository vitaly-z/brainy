/**
 * @module columnStore/ColumnSegmentCursor
 * @description Cursor for reading a parsed column segment with binary search,
 * forward/backward iteration, and tombstone skipping.
 *
 * Loaded segments are immutable — the cursor does not modify segment data.
 * Multiple cursors can read the same segment concurrently (e.g. during k-way merge).
 *
 * For the TS baseline, segments are loaded fully into memory and cached via
 * UnifiedCache. The Cortex Rust implementation mmaps the segment file and
 * indexes into it directly — same read interface, zero-copy access.
 */

import type { SegmentHeader } from './types.js'
import { ValueType } from './types.js'
import type { RoaringBitmap32 } from '../../utils/roaring/index.js'
import { compareCodePoints } from '../../utils/collation.js'

/**
 * Binary search result.
 */
export interface SearchResult {
  /** Whether an exact match was found. */
  found: boolean
  /** Index of the match, or the insertion point if not found. */
  index: number
}

/**
 * A single (value, entityIntId) entry yielded by iteration.
 */
export interface CursorEntry {
  value: number | string
  entityIntId: number
  /** Position in the segment (for tombstone reference). */
  position: number
}

/**
 * Cursor over a single parsed column segment.
 *
 * The segment's values are sorted in ascending order. Binary search finds
 * positions in O(log n). Forward/backward iteration streams entries
 * while skipping tombstoned positions.
 */
export class ColumnSegmentCursor {
  readonly header: SegmentHeader
  readonly values: (number | string)[]
  readonly entityIds: Uint32Array
  readonly tombstones: RoaringBitmap32

  constructor(
    header: SegmentHeader,
    values: (number | string)[],
    entityIds: Uint32Array,
    tombstones: RoaringBitmap32
  ) {
    this.header = header
    this.values = values
    this.entityIds = entityIds
    this.tombstones = tombstones
  }

  /**
   * Number of non-tombstoned entries.
   */
  get liveCount(): number {
    return this.header.count - this.tombstones.size
  }

  /**
   * Minimum value in the sorted column (first entry).
   * Returns undefined for empty segments.
   */
  get minValue(): number | string | undefined {
    return this.values.length > 0 ? this.values[0] : undefined
  }

  /**
   * Maximum value in the sorted column (last entry).
   * Returns undefined for empty segments.
   */
  get maxValue(): number | string | undefined {
    return this.values.length > 0 ? this.values[this.values.length - 1] : undefined
  }

  /**
   * Binary search for a target value in the sorted column.
   *
   * For numeric values, uses numeric comparison.
   * For string values, uses lexicographic comparison.
   *
   * @param target - Value to search for
   * @returns Search result with found flag and index
   */
  binarySearchValue(target: number | string): SearchResult {
    let lo = 0
    let hi = this.values.length
    const isString = this.header.valueType === ValueType.String

    while (lo < hi) {
      const mid = (lo + hi) >>> 1
      const cmp = isString
        ? compareCodePoints(String(this.values[mid]), String(target))
        : (this.values[mid] as number) - (target as number)

      if (cmp < 0) {
        lo = mid + 1
      } else if (cmp > 0) {
        hi = mid
      } else {
        // Found exact match — scan backward to find the FIRST occurrence
        // (values may have duplicates in multi-value columns)
        let first = mid
        while (first > 0 && this.values[first - 1] === target) first--
        return { found: true, index: first }
      }
    }
    return { found: false, index: lo }
  }

  /**
   * Find the range of positions where values fall within [lo, hi].
   *
   * @param lo - Lower bound (inclusive)
   * @param hi - Upper bound (inclusive)
   * @returns Start (inclusive) and end (exclusive) positions
   */
  binarySearchRange(lo: number | string, hi: number | string): { startIdx: number, endIdx: number } {
    const startResult = this.binarySearchValue(lo)
    const startIdx = startResult.index

    // Find the first position AFTER hi
    const isString = this.header.valueType === ValueType.String
    let endLo = startIdx
    let endHi = this.values.length
    while (endLo < endHi) {
      const mid = (endLo + endHi) >>> 1
      const cmp = isString
        ? compareCodePoints(String(this.values[mid]), String(hi))
        : (this.values[mid] as number) - (hi as number)
      if (cmp <= 0) {
        endLo = mid + 1
      } else {
        endHi = mid
      }
    }

    return { startIdx, endIdx: endLo }
  }

  /**
   * Get all non-tombstoned entity IDs for a specific value (point query).
   *
   * @param value - Exact value to match
   * @returns Array of matching entity int IDs
   */
  getEntityIdsForValue(value: number | string): number[] {
    const { found, index } = this.binarySearchValue(value)
    if (!found) return []

    const result: number[] = []
    for (let i = index; i < this.values.length && this.values[i] === value; i++) {
      if (!this.tombstones.has(i)) {
        result.push(this.entityIds[i])
      }
    }
    return result
  }

  /**
   * Get all non-tombstoned entity IDs in a value range.
   *
   * @param lo - Lower bound (inclusive)
   * @param hi - Upper bound (inclusive)
   * @returns Array of matching entity int IDs
   */
  getEntityIdsInRange(lo: number | string, hi: number | string): number[] {
    const { startIdx, endIdx } = this.binarySearchRange(lo, hi)
    const result: number[] = []
    for (let i = startIdx; i < endIdx; i++) {
      if (!this.tombstones.has(i)) {
        result.push(this.entityIds[i])
      }
    }
    return result
  }

  /**
   * Check if a position is tombstoned (logically deleted).
   *
   * @param position - Index in the segment
   * @returns True if the position is tombstoned
   */
  isDeleted(position: number): boolean {
    return this.tombstones.has(position)
  }

  /**
   * Iterate forward from a position, yielding non-tombstoned entries.
   *
   * @param from - Starting index (default: 0)
   */
  *iterateForward(from = 0): Generator<CursorEntry> {
    for (let i = from; i < this.values.length; i++) {
      if (!this.tombstones.has(i)) {
        yield { value: this.values[i], entityIntId: this.entityIds[i], position: i }
      }
    }
  }

  /**
   * Iterate backward from a position, yielding non-tombstoned entries.
   *
   * @param from - Starting index (default: last entry)
   */
  *iterateBackward(from?: number): Generator<CursorEntry> {
    const start = from ?? this.values.length - 1
    for (let i = start; i >= 0; i--) {
      if (!this.tombstones.has(i)) {
        yield { value: this.values[i], entityIntId: this.entityIds[i], position: i }
      }
    }
  }
}

/**
 * Cursor wrapper over an in-memory tail buffer's drained data.
 * Provides the same iteration interface as ColumnSegmentCursor so
 * the k-way merge can treat tail buffer and segment data uniformly.
 */
export class TailBufferCursor {
  readonly values: (number | string)[]
  readonly entityIds: Uint32Array
  readonly valueType: ValueType

  constructor(values: (number | string)[], entityIds: Uint32Array, valueType: ValueType) {
    this.values = values
    this.entityIds = entityIds
    this.valueType = valueType
  }

  get minValue(): number | string | undefined {
    return this.values.length > 0 ? this.values[0] : undefined
  }

  get maxValue(): number | string | undefined {
    return this.values.length > 0 ? this.values[this.values.length - 1] : undefined
  }

  *iterateForward(from = 0): Generator<CursorEntry> {
    for (let i = from; i < this.values.length; i++) {
      yield { value: this.values[i], entityIntId: this.entityIds[i], position: i }
    }
  }

  *iterateBackward(from?: number): Generator<CursorEntry> {
    const start = from ?? this.values.length - 1
    for (let i = start; i >= 0; i--) {
      yield { value: this.values[i], entityIntId: this.entityIds[i], position: i }
    }
  }

  getEntityIdsForValue(value: number | string): number[] {
    // Linear scan — tail buffer is small (< flush threshold)
    const result: number[] = []
    for (let i = 0; i < this.values.length; i++) {
      if (this.values[i] === value) result.push(this.entityIds[i])
    }
    return result
  }
}
