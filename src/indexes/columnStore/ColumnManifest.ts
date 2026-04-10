/**
 * @module columnStore/ColumnManifest
 * @description Per-field manifest tracking segment files and field metadata.
 *
 * Stored as JSON at `_column_index/{field}/MANIFEST.json` using workspace-global
 * storage paths (not branch-scoped, same as `_cow/` metadata). Rewritten
 * atomically on every flush and compaction.
 *
 * The manifest is the single source of truth for which segments exist for a
 * field. On startup, the column store loads each field's manifest and
 * discovers segments from it — no directory listing needed.
 */

import type { StorageAdapter } from '../../coreTypes.js'
import type { ManifestData, SegmentMeta } from './types.js'
import { ValueType } from './types.js'

/**
 * Manages a single field's segment manifest.
 *
 * @example
 * const manifest = new ColumnManifest('createdAt', '_column_index')
 * await manifest.load(storage)
 * manifest.addSegment({ id: 1, level: 0, count: 50000, ... })
 * await manifest.save(storage)
 */
export class ColumnManifest {
  /** Field this manifest covers. */
  readonly fieldName: string

  /** Base storage path for the column index. */
  readonly basePath: string

  /** Manifest data — loaded from storage or initialized fresh. */
  private data: ManifestData

  /**
   * @param fieldName - The field name (e.g. 'createdAt', 'status', '__words__')
   * @param basePath - Base path for segment files (default: '_column_index')
   */
  constructor(fieldName: string, basePath: string = '_column_index') {
    this.fieldName = fieldName
    this.basePath = basePath
    this.data = {
      version: 0,
      field: fieldName,
      valueType: ValueType.Number,
      multiValue: false,
      segments: [],
      nextSegmentId: 1,
      buildComplete: false
    }
  }

  /**
   * Load the manifest from storage. If not found, starts fresh.
   *
   * @param storage - Storage adapter
   */
  async load(storage: StorageAdapter): Promise<void> {
    try {
      const path = this.manifestPath()
      const data = await (storage as any).readObjectFromPath(path)
      if (data && data.field === this.fieldName) {
        this.data = data as ManifestData
      }
    } catch {
      // Not found — start fresh (data is already initialized in constructor)
    }
  }

  /**
   * Save the manifest to storage atomically.
   *
   * @param storage - Storage adapter
   */
  async save(storage: StorageAdapter): Promise<void> {
    this.data.version++
    const path = this.manifestPath()
    await (storage as any).writeObjectToPath(path, this.data)
  }

  /**
   * Register a new segment in the manifest.
   *
   * @param meta - Segment metadata
   */
  addSegment(meta: SegmentMeta): void {
    this.data.segments.push(meta)
    // Keep sorted by level then id for consistent ordering
    this.data.segments.sort((a, b) => a.level !== b.level ? a.level - b.level : a.id - b.id)
  }

  /**
   * Remove segments by ID (e.g. after compaction replaces them).
   *
   * @param ids - Segment IDs to remove
   */
  removeSegments(ids: number[]): void {
    const idSet = new Set(ids)
    this.data.segments = this.data.segments.filter(s => !idSet.has(s.id))
  }

  /**
   * Allocate the next segment ID (monotonically increasing).
   *
   * @returns Next available segment ID
   */
  nextSegmentId(): number {
    return this.data.nextSegmentId++
  }

  /**
   * Get all segments at a specific compaction level.
   *
   * @param level - LSM compaction level (0 = freshest)
   * @returns Segments at that level
   */
  getSegmentsAtLevel(level: number): SegmentMeta[] {
    return this.data.segments.filter(s => s.level === level)
  }

  /**
   * Get all segments across all levels.
   */
  getAllSegments(): SegmentMeta[] {
    return this.data.segments
  }

  /**
   * Whether the manifest has any segments.
   */
  isEmpty(): boolean {
    return this.data.segments.length === 0
  }

  /**
   * Total entry count across all segments.
   */
  get totalCount(): number {
    return this.data.segments.reduce((sum, s) => sum + s.count, 0)
  }

  /**
   * Value type for this field.
   */
  get valueType(): ValueType {
    return this.data.valueType
  }

  set valueType(type: ValueType) {
    this.data.valueType = type
  }

  /**
   * Whether this is a multi-value field (e.g. __words__).
   */
  get multiValue(): boolean {
    return this.data.multiValue
  }

  set multiValue(mv: boolean) {
    this.data.multiValue = mv
  }

  /**
   * Whether the initial migration from existing entities has completed.
   */
  get buildComplete(): boolean {
    return this.data.buildComplete
  }

  set buildComplete(done: boolean) {
    this.data.buildComplete = done
  }

  /**
   * Generate the storage path for a segment file.
   *
   * @param level - Compaction level
   * @param id - Segment ID
   * @returns Path like `_column_index/createdAt/L0-000001.cidx`
   */
  segmentPath(level: number, id: number): string {
    const paddedId = String(id).padStart(6, '0')
    return `${this.basePath}/${this.fieldName}/L${level}-${paddedId}.cidx`
  }

  /**
   * Generate the storage path for this field's manifest JSON.
   *
   * @returns Path like `_column_index/createdAt/MANIFEST.json`
   */
  manifestPath(): string {
    return `${this.basePath}/${this.fieldName}/MANIFEST.json`
  }

  /**
   * Get the raw manifest data (for serialization or debugging).
   */
  getData(): Readonly<ManifestData> {
    return this.data
  }
}
