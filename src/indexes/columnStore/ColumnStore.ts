/**
 * @module columnStore/ColumnStore
 * @description Unified column store: one system for filtering, sorting, range queries,
 * and text search on any field type with exact precision at billion scale.
 *
 * Architecture: per-field sorted columns stored as binary .cidx segment files.
 * Each field has its own manifest, tail buffer, and set of immutable segments.
 * Segments are organized in LSM-style levels (L0 = fresh, compaction merges up).
 *
 * Query operations:
 * - filter(field, value)  → roaring bitmap of matching entity IDs
 * - rangeQuery(field, lo, hi) → roaring bitmap
 * - sortTopK(field, order, k) → top-K entity IDs in sorted order
 * - filteredSortTopK(bitmap, field, order, k) → sorted + filtered
 * - getFilterValues(field) → distinct values
 *
 * Implements ColumnStoreProvider interface for plugin registration.
 */

import type { StorageAdapter } from '../../coreTypes.js'
import type { EntityIdMapper } from '../../utils/entityIdMapper.js'
import type { ColumnStoreProvider, SegmentMeta } from './types.js'
import {
  ValueType,
  DEFAULT_FLUSH_THRESHOLD,
  FLAG_MULTI_VALUE
} from './types.js'
import { ColumnTailBuffer } from './ColumnTailBuffer.js'
import { ColumnManifest } from './ColumnManifest.js'
import { ColumnSegmentCursor, TailBufferCursor, type CursorEntry } from './ColumnSegmentCursor.js'
import { writeSegmentToBuffer, readSegmentFromBuffer } from './ColumnSegmentFormat.js'
import { RoaringBitmap32 } from '../../utils/roaring/index.js'
import { compareCodePoints } from '../../utils/collation.js'

/**
 * Configuration for the ColumnStore.
 */
export interface ColumnStoreConfig {
  /** Base path for segment files (default: '_column_index') */
  basePath?: string
  /** Flush threshold per tail buffer (default: 65536) */
  flushThreshold?: number
  /** Max L0 segments before compaction triggers (default: 4) */
  l0CompactionTrigger?: number
}

/**
 * Heap entry for k-way merge sort across multiple cursors.
 */
interface HeapEntry {
  value: number | string
  entityIntId: number
  cursorIndex: number
  /** Iterator for the cursor — call next() to advance */
  iterator: Generator<CursorEntry>
}

/**
 * Unified column store coordinator.
 *
 * @example
 * const store = new ColumnStore()
 * await store.init(storage, idMapper)
 * store.addEntity(42, { createdAt: Date.now(), status: 'active' })
 * await store.flush()
 * const newest = await store.sortTopK('createdAt', 'desc', 10)
 */
export class ColumnStore implements ColumnStoreProvider {
  private storage!: StorageAdapter
  private idMapper!: EntityIdMapper
  private basePath: string
  private flushThreshold: number
  private l0CompactionTrigger: number

  /** Per-field tail buffers for in-memory writes. */
  private tailBuffers: Map<string, ColumnTailBuffer> = new Map()

  /** Per-field manifests tracking segment files. */
  private manifests: Map<string, ColumnManifest> = new Map()

  /** Cached loaded segment cursors: `field:segmentId` → cursor. */
  private segmentCache: Map<string, ColumnSegmentCursor> = new Map()

  /**
   * Per-field global deleted entity bitmap. Entity int IDs in this bitmap
   * are skipped during ALL queries (filter, sort, range). Persisted in the
   * manifest and cleared during compaction.
   */
  private deletedEntities: Map<string, RoaringBitmap32> = new Map()

  /** Known field value types (inferred from first write). */
  private fieldTypes: Map<string, ValueType> = new Map()

  /** Whether init() has completed. */
  private initialized = false

  /**
   * Create a new ColumnStore instance.
   *
   * Call `init(storage, idMapper)` before using query methods that require
   * storage access (loading segments). Write methods (`addEntity`, `removeEntity`)
   * work immediately — the column store buffers writes in memory until flush.
   */
  constructor(config?: ColumnStoreConfig) {
    this.basePath = config?.basePath ?? '_column_index'
    this.flushThreshold = config?.flushThreshold ?? DEFAULT_FLUSH_THRESHOLD
    this.l0CompactionTrigger = config?.l0CompactionTrigger ?? 4
  }

  /**
   * Initialize the column store: discover existing field manifests.
   */
  async init(storage: StorageAdapter, idMapper: EntityIdMapper): Promise<void> {
    this.storage = storage
    this.idMapper = idMapper

    // Discover fields by listing manifest files
    try {
      const paths = await (storage as any).listObjectsUnderPath(this.basePath + '/')
      for (const path of paths) {
        if (path.endsWith('/MANIFEST.json')) {
          const fieldName = path.replace(this.basePath + '/', '').replace('/MANIFEST.json', '')
          const manifest = new ColumnManifest(fieldName, this.basePath)
          await manifest.load(storage)
          this.manifests.set(fieldName, manifest)
          this.fieldTypes.set(fieldName, manifest.valueType)

          // Load global deleted bitmap if it exists. Raw blob preferred
          // (2.4.0 #4 cortex-shared format); legacy envelope fallback for
          // indexes written before format unification.
          try {
            let buf: Buffer | null = null

            const adapter = storage as unknown as {
              loadBinaryBlob?: (key: string) => Promise<Buffer | null>
              readObjectFromPath: (path: string) => Promise<any>
            }
            if (typeof adapter.loadBinaryBlob === 'function') {
              const key = `${this.basePath}/${fieldName}/DELETED`
              const blob = await adapter.loadBinaryBlob(key)
              if (blob && blob.length > 0) buf = blob
            }
            if (!buf) {
              const deletedPath = `${this.basePath}/${fieldName}/DELETED.bin`
              const stored = await adapter.readObjectFromPath(deletedPath)
              if (stored && stored._binary && stored.data) {
                buf = Buffer.from(stored.data, 'base64')
              }
            }
            if (buf) {
              this.deletedEntities.set(fieldName, RoaringBitmap32.deserialize(buf, true))
            }
          } catch {
            // No deleted bitmap — normal for fresh fields
          }
        }
      }
    } catch {
      // No column index exists yet — fresh start
    }

    this.initialized = true
  }

  /**
   * Index an entity's field values.
   *
   * For each field in the provided map, pushes (value, entityIntId) to the
   * field's tail buffer. For arrays (multi-value fields like __words__),
   * one entry per element is added.
   *
   * Auto-flushes when any tail buffer exceeds its threshold.
   */
  addEntity(entityIntId: number, fields: Record<string, unknown>): void {
    for (const [field, rawValue] of Object.entries(fields)) {
      if (rawValue === undefined || rawValue === null) continue

      // Multi-value: arrays get one entry per element
      if (Array.isArray(rawValue)) {
        for (const v of rawValue) {
          if (v !== undefined && v !== null) {
            this.pushToBuffer(field, v, entityIntId, true)
          }
        }
      } else {
        this.pushToBuffer(field, rawValue, entityIntId, false)
      }
    }
  }

  /**
   * Remove an entity from all indexed fields.
   *
   * Adds the entity to the global deleted bitmap for each field (checked
   * during ALL queries) and removes any pending entries from tail buffers.
   * The global bitmap is persisted in the manifest on flush and cleared
   * during compaction.
   */
  removeEntity(entityIntId: number): void {
    // Remove from tail buffers (pending writes)
    for (const [, buffer] of this.tailBuffers) {
      buffer.remove(entityIntId)
    }

    // Add to global deleted bitmap for every known field
    for (const field of this.manifests.keys()) {
      let deleted = this.deletedEntities.get(field)
      if (!deleted) {
        deleted = new RoaringBitmap32()
        this.deletedEntities.set(field, deleted)
      }
      deleted.add(entityIntId)
    }
  }

  /**
   * Point filter: find entities where field equals value.
   *
   * Searches all segments + tail buffer, returns union as roaring bitmap.
   * Excludes globally deleted entities.
   */
  async filter(field: string, value: unknown): Promise<RoaringBitmap32> {
    const result = new RoaringBitmap32()
    const deleted = this.deletedEntities.get(field)

    // Search segments
    const cursors = await this.getSegmentCursors(field)
    for (const cursor of cursors) {
      const ids = cursor.getEntityIdsForValue(value as number | string)
      for (const id of ids) {
        if (!deleted || !deleted.has(id)) result.add(id)
      }
    }

    // Search tail buffer
    const tailCursor = this.getTailBufferCursor(field)
    if (tailCursor) {
      const ids = tailCursor.getEntityIdsForValue(value as number | string)
      for (const id of ids) {
        if (!deleted || !deleted.has(id)) result.add(id)
      }
    }

    return result
  }

  /**
   * Range filter: find entities where field is within [min, max].
   */
  async rangeQuery(field: string, min?: unknown, max?: unknown): Promise<RoaringBitmap32> {
    const result = new RoaringBitmap32()
    const cursors = await this.getSegmentCursors(field)

    for (const cursor of cursors) {
      const lo = (min !== undefined && min !== null) ? min as number | string : cursor.minValue
      const hi = (max !== undefined && max !== null) ? max as number | string : cursor.maxValue
      if (lo === undefined || hi === undefined) continue
      const ids = cursor.getEntityIdsInRange(lo, hi)
      for (const id of ids) result.add(id)
    }

    // Tail buffer range: linear scan (tail is small)
    const tailCursor = this.getTailBufferCursor(field)
    if (tailCursor) {
      for (const entry of tailCursor.iterateForward()) {
        const v = entry.value
        const inRange = (min == null || v >= min) && (max == null || v <= max)
        if (inRange) result.add(entry.entityIntId)
      }
    }

    return result
  }

  /**
   * Sort top-K: return K entity int IDs in sorted order.
   *
   * Uses k-way merge across all segment cursors + tail buffer via a min/max heap.
   * Complexity: O(K log S) where S = number of cursors.
   */
  async sortTopK(field: string, order: 'asc' | 'desc', k: number): Promise<number[]> {
    return this.mergeSort(field, order, k, null)
  }

  /**
   * Filtered sort top-K: return K entity int IDs in sorted order,
   * considering only entities present in the filter bitmap.
   */
  async filteredSortTopK(
    filterBitmap: RoaringBitmap32,
    field: string,
    order: 'asc' | 'desc',
    k: number
  ): Promise<number[]> {
    return this.mergeSort(field, order, k, filterBitmap)
  }

  /**
   * Get all distinct values for a field.
   */
  async getFilterValues(field: string): Promise<string[]> {
    const valueSet = new Set<string>()
    const cursors = await this.getSegmentCursors(field)

    for (const cursor of cursors) {
      for (const entry of cursor.iterateForward()) {
        valueSet.add(String(entry.value))
      }
    }

    const tailCursor = this.getTailBufferCursor(field)
    if (tailCursor) {
      for (const entry of tailCursor.iterateForward()) {
        valueSet.add(String(entry.value))
      }
    }

    return Array.from(valueSet).sort()
  }

  /**
   * Check if a field has any indexed data.
   */
  hasField(field: string): boolean {
    const manifest = this.manifests.get(field)
    const buffer = this.tailBuffers.get(field)
    return (manifest !== undefined && !manifest.isEmpty()) || (buffer !== undefined && buffer.size > 0)
  }

  /**
   * List every field that has at least one persisted segment or buffered
   * write. Used by `MetadataIndexManager.getStats()` and by
   * `brainy inspect fields` so callers see the same field set the column
   * store will actually serve queries from.
   */
  getIndexedFields(): string[] {
    const fields = new Set<string>()
    for (const [field, manifest] of this.manifests) {
      if (!manifest.isEmpty()) fields.add(field)
    }
    for (const [field, buffer] of this.tailBuffers) {
      if (buffer.size > 0) fields.add(field)
    }
    return Array.from(fields).sort()
  }

  /**
   * Approximate segment + tail-buffer sizes per indexed field. Returns
   * `segmentCount` (number of persisted L0+ segments) and `tailSize` (entries
   * buffered but not yet flushed) per field. Suitable for stats / health
   * surfaces. For exact distinct-value cardinality use
   * `getFilterValues(field).length` per field on demand.
   */
  getFieldSizeSummary(): Array<{ field: string; segmentCount: number; tailSize: number }> {
    const summary: Array<{ field: string; segmentCount: number; tailSize: number }> = []
    for (const field of this.getIndexedFields()) {
      const manifest = this.manifests.get(field)
      const buffer = this.tailBuffers.get(field)
      const segmentCount = manifest && !manifest.isEmpty()
        ? manifest.getAllSegments().length
        : 0
      const tailSize = buffer ? buffer.size : 0
      summary.push({ field, segmentCount, tailSize })
    }
    return summary
  }

  /**
   * Flush all tail buffers to L0 segments and save manifests.
   * No-op if init() hasn't been called (no storage to write to).
   */
  async flush(): Promise<void> {
    if (!this.storage) return
    for (const [field, buffer] of this.tailBuffers) {
      if (buffer.size > 0) {
        await this.flushBuffer(field, buffer)
      }
    }
  }

  /**
   * Flush and release all resources.
   */
  async close(): Promise<void> {
    if (this.storage) await this.flush()
    this.tailBuffers.clear()
    this.segmentCache.clear()
    this.manifests.clear()
    this.deletedEntities.clear()
    this.initialized = false
  }

  // =========================================================================
  // Internal methods
  // =========================================================================

  /**
   * Push a single value to a field's tail buffer.
   * Creates the buffer and manifest if first write to this field.
   * Infers ValueType from the first value seen.
   */
  private pushToBuffer(field: string, value: unknown, entityIntId: number, isMultiValue: boolean): void {
    let buffer = this.tailBuffers.get(field)
    if (!buffer) {
      const valueType = this.inferValueType(value)
      buffer = new ColumnTailBuffer(field, valueType, this.flushThreshold)
      this.tailBuffers.set(field, buffer)
      this.fieldTypes.set(field, valueType)

      // Ensure manifest exists
      if (!this.manifests.has(field)) {
        const manifest = new ColumnManifest(field, this.basePath)
        manifest.valueType = valueType
        manifest.multiValue = isMultiValue
        this.manifests.set(field, manifest)
      }
    }

    // Normalize value to the column type
    const normalizedValue = this.normalizeValue(value, buffer.valueType)
    if (normalizedValue !== undefined) {
      buffer.add(normalizedValue, entityIntId)
    }
  }

  /**
   * Flush a single field's tail buffer to a new L0 segment.
   *
   * Storage path (2.4.0 #4 / cortex-interchange contract):
   *   When the storage adapter exposes the binary-blob primitive
   *   (`saveBinaryBlob` — every brainy adapter ≥7.25.0 does), the segment
   *   bytes are written as a raw blob at the shared cortex key
   *   `_column_index/<field>/L<level>-NNNNNN` (suffix-free; the adapter
   *   appends its own). This matches byte-for-byte what cortex's
   *   `NativeColumnStore` writes, so JS- and native-written indexes
   *   interchange without re-encoding.
   *
   *   When the adapter doesn't (older custom adapters that didn't follow
   *   the 7.25.0 primitive surface), we fall back to the legacy
   *   `writeObjectToPath` envelope — `{ _binary, data: <base64> }` at
   *   `_column_index/<field>/L<level>-NNNNNN.cidx`. Cortex's 2.3.1
   *   read-side fallback handles the legacy envelope on its end, so the
   *   format mismatch is transparent in both directions during the
   *   transition.
   */
  private async flushBuffer(field: string, buffer: ColumnTailBuffer): Promise<void> {
    const { values, entityIds, pendingRemovals } = buffer.drain()
    if (values.length === 0 && pendingRemovals.size === 0) return

    const manifest = this.manifests.get(field)
    if (!manifest) return

    const storage = this.storage as unknown as {
      saveBinaryBlob?: (key: string, data: Buffer) => Promise<void>
      writeObjectToPath: (path: string, value: unknown) => Promise<void>
    }
    const canUseBlob = typeof storage.saveBinaryBlob === 'function'

    // Write segment if we have values
    if (values.length > 0) {
      const segId = manifest.nextSegmentId()

      const segBuffer = writeSegmentToBuffer(
        {
          fieldName: field,
          fieldNameLength: Math.min(field.length, 32),
          valueType: manifest.valueType,
          level: 0,
          codec: 0,
          flags: manifest.multiValue ? FLAG_MULTI_VALUE : 0,
          count: values.length
        },
        values,
        entityIds
      )

      if (canUseBlob) {
        // Raw blob, cortex-shared key convention.
        const key = `${this.basePath}/${field}/L0-${String(segId).padStart(6, '0')}`
        await storage.saveBinaryBlob!(key, segBuffer)
      } else {
        // Legacy envelope path for adapters without the binary-blob primitive.
        const segPath = manifest.segmentPath(0, segId)
        await storage.writeObjectToPath(segPath, {
          _binary: true,
          data: segBuffer.toString('base64')
        })
      }

      // Register in manifest. The `.cidx` file name in the manifest is the
      // legacy-format file the cortex 2.3.1 read-side fallback looks for; the
      // raw-blob key derives from segId at read time. Both paths converge.
      manifest.addSegment({
        id: segId,
        level: 0,
        count: values.length,
        minValue: values[0],
        maxValue: values[values.length - 1],
        file: `L0-${String(segId).padStart(6, '0')}.cidx`
      })

      // Clear cached cursor for this field (stale after new segment)
      this.invalidateFieldCache(field)
    }

    // Merge pending removals into the global deleted bitmap
    if (pendingRemovals.size > 0) {
      let deleted = this.deletedEntities.get(field)
      if (!deleted) {
        deleted = new RoaringBitmap32()
        this.deletedEntities.set(field, deleted)
      }
      for (const id of pendingRemovals) deleted.add(id)
    }

    // Persist the global deleted bitmap alongside the manifest. Same
    // raw-blob preference as segments — shared cortex key `<base>/<field>/DELETED`.
    const deleted = this.deletedEntities.get(field)
    if (deleted && deleted.size > 0) {
      const serialized = deleted.serialize(true)
      if (canUseBlob) {
        const deletedKey = `${this.basePath}/${field}/DELETED`
        await storage.saveBinaryBlob!(deletedKey, Buffer.from(serialized))
      } else {
        const deletedPath = `${this.basePath}/${field}/DELETED.bin`
        await storage.writeObjectToPath(deletedPath, {
          _binary: true,
          data: Buffer.from(serialized).toString('base64')
        })
      }
    }

    // Save manifest
    await manifest.save(this.storage)
  }

  /**
   * Get all segment cursors for a field, loading from storage if needed.
   */
  private async getSegmentCursors(field: string): Promise<ColumnSegmentCursor[]> {
    const manifest = this.manifests.get(field)
    if (!manifest) return []

    const cursors: ColumnSegmentCursor[] = []
    for (const seg of manifest.getAllSegments()) {
      const cacheKey = `${field}:${seg.id}`
      let cursor = this.segmentCache.get(cacheKey)

      if (!cursor) {
        const loaded = await this.loadSegmentCursor(field, seg)
        if (loaded) {
          cursor = loaded
          this.segmentCache.set(cacheKey, cursor)
        }
      }

      if (cursor) cursors.push(cursor)
    }

    return cursors
  }

  /**
   * Load a segment from storage and create a cursor.
   *
   * Reads the raw-blob layout first (the 2.4.0 #4 shared-with-cortex format),
   * then falls back to the legacy `{ _binary, base64 }` envelope at the
   * `.cidx` object-path so indexes written before the format unification keep
   * loading correctly. Mirror of cortex's 2.3.1 read-side fallback.
   */
  private async loadSegmentCursor(field: string, seg: SegmentMeta): Promise<ColumnSegmentCursor | null> {
    const manifest = this.manifests.get(field)
    if (!manifest) return null

    try {
      let buf: Buffer | null = null

      const storage = this.storage as unknown as {
        loadBinaryBlob?: (key: string) => Promise<Buffer | null>
        readObjectFromPath: (path: string) => Promise<any>
      }

      // Preferred: raw blob at the cortex-shared key.
      if (typeof storage.loadBinaryBlob === 'function') {
        const key = `${this.basePath}/${field}/L${seg.level}-${String(seg.id).padStart(6, '0')}`
        const blob = await storage.loadBinaryBlob(key)
        if (blob && blob.length > 0) buf = blob
      }

      // Legacy fallback: `{ _binary, base64 }` envelope at the .cidx object-path.
      if (!buf) {
        const segPath = manifest.segmentPath(seg.level, seg.id)
        const stored = await storage.readObjectFromPath(segPath)
        if (!stored) return null
        if (stored._binary && stored.data) {
          buf = Buffer.from(stored.data, 'base64')
        } else if (Buffer.isBuffer(stored)) {
          buf = stored
        } else {
          return null
        }
      }

      const parsed = readSegmentFromBuffer(buf)
      return new ColumnSegmentCursor(
        parsed.header,
        parsed.values,
        parsed.entityIds,
        parsed.tombstones
      )
    } catch {
      return null
    }
  }

  /**
   * Get a cursor for the tail buffer of a field (for query inclusion).
   */
  private getTailBufferCursor(field: string): TailBufferCursor | null {
    const buffer = this.tailBuffers.get(field)
    if (!buffer || buffer.size === 0) return null

    const valueType = this.fieldTypes.get(field) ?? ValueType.String
    // Drain a COPY for querying — don't clear the buffer
    const entries = (buffer as any).entries as Array<{ value: number | string, entityIntId: number }>
    if (!entries || entries.length === 0) return null

    // Sort a copy for the cursor
    const sorted = entries.slice().sort((a, b) => {
      if (valueType === ValueType.String) {
        return compareCodePoints(String(a.value), String(b.value))
      }
      return (a.value as number) - (b.value as number)
    })

    const values = sorted.map(e => e.value)
    const entityIds = new Uint32Array(sorted.map(e => e.entityIntId))
    return new TailBufferCursor(values, entityIds, valueType)
  }

  /**
   * K-way merge sort across all segment cursors and tail buffer.
   *
   * Uses a simple heap (array-based) to efficiently select the next
   * smallest (asc) or largest (desc) entry across all cursors.
   *
   * @param field - Field to sort by
   * @param order - 'asc' or 'desc'
   * @param k - Maximum results
   * @param filterBitmap - Optional filter (only include these entity IDs)
   */
  private async mergeSort(
    field: string,
    order: 'asc' | 'desc',
    k: number,
    filterBitmap: RoaringBitmap32 | null
  ): Promise<number[]> {
    // Collect all cursors (segments + tail buffer)
    const segCursors = await this.getSegmentCursors(field)
    const tailCursor = this.getTailBufferCursor(field)

    // Create iterators for each cursor in the specified direction
    const iterators: Generator<CursorEntry>[] = []
    for (const cursor of segCursors) {
      iterators.push(order === 'asc' ? cursor.iterateForward() : cursor.iterateBackward())
    }
    if (tailCursor) {
      iterators.push(order === 'asc' ? tailCursor.iterateForward() : tailCursor.iterateBackward())
    }

    if (iterators.length === 0) return []

    // Initialize heap with first entry from each iterator
    const heap: HeapEntry[] = []
    for (let i = 0; i < iterators.length; i++) {
      const next = iterators[i].next()
      if (!next.done) {
        heap.push({
          value: next.value.value,
          entityIntId: next.value.entityIntId,
          cursorIndex: i,
          iterator: iterators[i]
        })
      }
    }

    // Heapify
    const isString = (this.fieldTypes.get(field) ?? ValueType.Number) === ValueType.String
    const compare = (a: HeapEntry, b: HeapEntry): number => {
      let cmp: number
      if (isString) {
        cmp = compareCodePoints(String(a.value), String(b.value))
      } else {
        cmp = (a.value as number) - (b.value as number)
      }
      return order === 'asc' ? cmp : -cmp
    }

    // Build min-heap
    for (let i = Math.floor(heap.length / 2) - 1; i >= 0; i--) {
      this.heapDown(heap, i, compare)
    }

    // Collect results
    const result: number[] = []
    const seen = new Set<number>() // deduplicate entity IDs across segments

    while (heap.length > 0 && result.length < k) {
      // Pop min/max from heap
      const top = heap[0]

      // Replace root with next from same iterator
      const next = top.iterator.next()
      if (next.done) {
        // Iterator exhausted — remove from heap by swapping with last
        heap[0] = heap[heap.length - 1]
        heap.pop()
      } else {
        heap[0] = {
          value: next.value.value,
          entityIntId: next.value.entityIntId,
          cursorIndex: top.cursorIndex,
          iterator: top.iterator
        }
      }
      if (heap.length > 0) {
        this.heapDown(heap, 0, compare)
      }

      // Apply global deleted check, filter, and dedup
      const deleted = this.deletedEntities.get(field)
      if (deleted && deleted.has(top.entityIntId)) continue
      if (seen.has(top.entityIntId)) continue
      if (filterBitmap && !filterBitmap.has(top.entityIntId)) continue
      seen.add(top.entityIntId)
      result.push(top.entityIntId)
    }

    return result
  }

  /**
   * Heap sift-down operation.
   */
  private heapDown(heap: HeapEntry[], i: number, compare: (a: HeapEntry, b: HeapEntry) => number): void {
    const n = heap.length
    while (true) {
      let smallest = i
      const left = 2 * i + 1
      const right = 2 * i + 2

      if (left < n && compare(heap[left], heap[smallest]) < 0) smallest = left
      if (right < n && compare(heap[right], heap[smallest]) < 0) smallest = right

      if (smallest === i) break
      ;[heap[i], heap[smallest]] = [heap[smallest], heap[i]]
      i = smallest
    }
  }

  /**
   * Invalidate cached segment cursors for a field.
   */
  private invalidateFieldCache(field: string): void {
    for (const key of this.segmentCache.keys()) {
      if (key.startsWith(field + ':')) {
        this.segmentCache.delete(key)
      }
    }
  }

  /**
   * Infer ValueType from a JavaScript value.
   */
  private inferValueType(value: unknown): ValueType {
    if (typeof value === 'boolean') return ValueType.Boolean
    if (typeof value === 'number') {
      return Number.isInteger(value) ? ValueType.Number : ValueType.Float
    }
    return ValueType.String
  }

  /**
   * Normalize a JavaScript value to the column's ValueType.
   */
  private normalizeValue(value: unknown, type: ValueType): number | string | undefined {
    switch (type) {
      case ValueType.Number:
        if (typeof value === 'number') return Math.round(value)
        if (typeof value === 'string') { const n = Number(value); return isNaN(n) ? undefined : Math.round(n) }
        if (typeof value === 'boolean') return value ? 1 : 0
        return undefined
      case ValueType.Float:
        if (typeof value === 'number') return value
        if (typeof value === 'string') { const n = Number(value); return isNaN(n) ? undefined : n }
        return undefined
      case ValueType.Boolean:
        if (typeof value === 'boolean') return value ? 1 : 0
        if (typeof value === 'number') return value ? 1 : 0
        return undefined
      case ValueType.String:
        return String(value)
      default:
        return undefined
    }
  }
}
