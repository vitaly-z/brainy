/**
 * @module columnStore/ColumnTailBuffer
 * @description Per-field in-memory write buffer that accumulates (value, entityIntId)
 * entries before flushing to a sorted L0 segment on disk.
 *
 * Follows the MemTable pattern from GraphAdjacencyIndex's LSMTree
 * (src/graph/lsm/LSMTree.ts:64-143): unsorted writes in memory,
 * sort on flush, clear after flush.
 *
 * For multi-value fields (__words__), one entity can add multiple entries
 * to the same buffer. The sorted drain merges them naturally.
 */

import { ValueType, DEFAULT_FLUSH_THRESHOLD } from './types.js'
import { compareCodePoints } from '../../utils/collation.js'

/**
 * Entry in the tail buffer: a (value, entityIntId) pair.
 *
 * For numeric fields, value is a number (timestamp, integer count).
 * For string fields, value is a string.
 * For boolean fields, value is 0 or 1 (stored as number).
 */
export interface TailEntry {
  value: number | string
  entityIntId: number
}

/**
 * Result of draining the tail buffer: parallel sorted arrays
 * ready for segment writing.
 */
export interface DrainResult {
  values: (number | string)[]
  entityIds: Uint32Array
  pendingRemovals: Set<number>
}

/**
 * In-memory write buffer for a single field's column data.
 *
 * Entries accumulate unsorted. On drain/flush, they are sorted by value
 * (numeric comparison for numbers, lexicographic for strings). Ties are
 * broken by entityIntId ascending for deterministic output.
 *
 * @example
 * const buf = new ColumnTailBuffer('createdAt', ValueType.Number)
 * buf.add(1700000001000, 42)
 * buf.add(1700000000000, 10)
 * const { values, entityIds } = buf.drain()
 * // values: [1700000000000, 1700000001000]
 * // entityIds: [10, 42]
 */
export class ColumnTailBuffer {
  /** Field name this buffer is for. */
  readonly fieldName: string

  /** Value type determines sort comparator. */
  readonly valueType: ValueType

  /** Flush threshold. */
  readonly threshold: number

  /** Unsorted entry accumulator. */
  private entries: TailEntry[] = []

  /**
   * Entity int IDs marked for removal (tombstoning).
   * Applied during segment writes — the removal propagates to existing segments.
   */
  private removals: Set<number> = new Set()

  /**
   * @param fieldName - Field name (e.g. 'createdAt', 'status', '__words__')
   * @param valueType - How values should be sorted and encoded
   * @param threshold - Number of entries before shouldFlush() returns true
   */
  constructor(fieldName: string, valueType: ValueType, threshold: number = DEFAULT_FLUSH_THRESHOLD) {
    this.fieldName = fieldName
    this.valueType = valueType
    this.threshold = threshold
  }

  /**
   * Add a (value, entityIntId) entry to the buffer.
   *
   * @param value - The field value (number for numeric/boolean, string for string)
   * @param entityIntId - The entity's u32 integer ID from EntityIdMapper
   */
  add(value: number | string, entityIntId: number): void {
    this.entries.push({ value, entityIntId })
  }

  /**
   * Mark an entity for removal. The removal is tracked as a pending tombstone
   * and applied when flushing or during segment compaction.
   *
   * @param entityIntId - Entity to remove
   */
  remove(entityIntId: number): void {
    this.removals.add(entityIntId)
    // Also remove any pending entries for this entity in the buffer
    this.entries = this.entries.filter(e => e.entityIntId !== entityIntId)
  }

  /**
   * Number of entries currently in the buffer.
   */
  get size(): number {
    return this.entries.length
  }

  /**
   * Whether the buffer has reached the flush threshold.
   */
  shouldFlush(): boolean {
    return this.entries.length >= this.threshold
  }

  /**
   * Drain the buffer: sort entries by value, return parallel arrays,
   * and clear the buffer. Pending removals are returned separately
   * for the caller to apply as tombstones to existing segments.
   *
   * Sorting: numeric values by numeric comparison, strings lexicographically.
   * Ties broken by entityIntId ascending for deterministic segment output.
   *
   * @returns Sorted parallel arrays and pending removals
   */
  drain(): DrainResult {
    // Sort entries
    const sorted = this.entries.slice()
    if (this.valueType === ValueType.String) {
      sorted.sort((a, b) => {
        const cmp = compareCodePoints(String(a.value), String(b.value))
        return cmp !== 0 ? cmp : a.entityIntId - b.entityIntId
      })
    } else {
      sorted.sort((a, b) => {
        const va = a.value as number
        const vb = b.value as number
        return va !== vb ? va - vb : a.entityIntId - b.entityIntId
      })
    }

    // Build parallel arrays
    const values: (number | string)[] = new Array(sorted.length)
    const entityIds = new Uint32Array(sorted.length)
    for (let i = 0; i < sorted.length; i++) {
      values[i] = sorted[i].value
      entityIds[i] = sorted[i].entityIntId
    }

    const pendingRemovals = new Set(this.removals)

    // Clear buffer
    this.entries = []
    this.removals.clear()

    return { values, entityIds, pendingRemovals }
  }

  /**
   * Clear the buffer without returning data.
   */
  clear(): void {
    this.entries = []
    this.removals.clear()
  }
}
