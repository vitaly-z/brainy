/**
 * @module columnStore/types
 * @description Shared type definitions for the unified column store.
 *
 * The column store replaces MetadataIndex's sparse chunk/bloom filter/bucketing
 * internals with per-field sorted columns. One system for filtering, sorting,
 * range queries, and text search on any field type with exact precision.
 *
 * Design lineage: Lucene doc values + roaring bitmap acceleration.
 */

import type { RoaringBitmap32 } from '../../utils/roaring/index.js'
import type { EntityIdMapper } from '../../utils/entityIdMapper.js'
import type { StorageAdapter } from '../../coreTypes.js'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Magic bytes identifying a `.cidx` column segment file: "CIDX" in ASCII. */
export const CIDX_MAGIC = 0x43494458

/** Binary format version. Bump on breaking changes to the segment layout. */
export const CIDX_VERSION = 1

/** Fixed header size in bytes. Contains field metadata and zone map. */
export const HEADER_SIZE = 64

/** Fixed footer size in bytes. Contains tombstone length and CRC32. */
export const FOOTER_SIZE = 16

/**
 * Default number of entries in the in-memory tail buffer before flushing
 * to an L0 segment on disk. 65,536 entries × 12 bytes ≈ 768 KB per flush.
 */
export const DEFAULT_FLUSH_THRESHOLD = 65_536

/** Maximum field name length stored in the segment header (bytes). */
export const MAX_FIELD_NAME_LENGTH = 32

// ---------------------------------------------------------------------------
// Value types
// ---------------------------------------------------------------------------

/**
 * Discriminator for the value column encoding in a segment file.
 *
 * Determines how values are packed in the binary segment:
 * - Number: i64 little-endian (8 bytes each) — timestamps, integer counts
 * - Float: f64 little-endian (8 bytes each) — prices, scores, ratings
 * - String: u32-length-prefixed UTF-8 — status, category, words
 * - Boolean: i64 (0 or 1) — flags, toggles
 */
export enum ValueType {
  Number = 0,
  Float = 1,
  String = 2,
  Boolean = 3
}

// ---------------------------------------------------------------------------
// Segment header and footer
// ---------------------------------------------------------------------------

/**
 * Parsed representation of the 64-byte segment file header.
 *
 * Layout (little-endian):
 * ```
 * [0..4)    magic:     u32  = 0x43494458 ("CIDX")
 * [4..6)    version:   u16  = 1
 * [6..8)    fieldLen:  u16  (actual byte length of field name)
 * [8..40)   fieldName: [u8; 32] (UTF-8, zero-padded)
 * [40..41)  valueType: u8   (ValueType enum)
 * [41..42)  level:     u8   (LSM compaction level, 0 = fresh)
 * [42..43)  codec:     u8   (0 = raw, reserved for future compression)
 * [43..44)  flags:     u8   (bit 0 = multi-value)
 * [44..48)  _reserved: [u8; 4]
 * [48..56)  count:     u64  (number of entries)
 * [56..64)  _reserved2:[u8; 8]
 * ```
 *
 * Min/max zone map values are derived from the first and last entries
 * in the sorted value column — not stored redundantly in the header.
 */
export interface SegmentHeader {
  magic: number
  version: number
  fieldName: string
  fieldNameLength: number
  valueType: ValueType
  level: number
  codec: number
  flags: number
  count: number
}

/**
 * Parsed representation of the 16-byte segment file footer.
 *
 * Layout (little-endian):
 * ```
 * [0..8)    tombstoneLen: u64  (byte length of the serialized tombstone bitmap)
 * [8..12)   crc32:        u32  (CRC32 of header + values + entityIds + tombstones)
 * [12..16)  _pad:         u32
 * ```
 */
export interface SegmentFooter {
  tombstoneLength: number
  crc32: number
}

// ---------------------------------------------------------------------------
// Manifest
// ---------------------------------------------------------------------------

/**
 * Metadata about a single segment file within a field's manifest.
 */
export interface SegmentMeta {
  /** Segment identifier, unique within this field (monotonic counter). */
  id: number
  /** LSM compaction level. 0 = freshest (direct from tail buffer). */
  level: number
  /** Number of entries in the segment (including tombstoned). */
  count: number
  /** Minimum value in the sorted column (for zone-map pruning). */
  minValue: number | string
  /** Maximum value in the sorted column. */
  maxValue: number | string
  /** Relative file path within the field directory. */
  file: string
}

/**
 * Per-field manifest tracking all segment files and field metadata.
 * Stored as JSON at `_column_index/{field}/MANIFEST.json`.
 */
export interface ManifestData {
  /** Format version for forward compatibility. */
  version: number
  /** Field name this manifest covers. */
  field: string
  /** Value type for all segments in this field. */
  valueType: ValueType
  /** Whether this is a multi-value field (one entity → many entries). */
  multiValue: boolean
  /** All known segments, ordered by level then id. */
  segments: SegmentMeta[]
  /** Monotonically increasing segment ID counter. */
  nextSegmentId: number
  /** Whether the initial build from existing entities has completed. */
  buildComplete: boolean
}

// ---------------------------------------------------------------------------
// Header flags
// ---------------------------------------------------------------------------

/** Bit 0 of flags: indicates a multi-value column (e.g. __words__). */
export const FLAG_MULTI_VALUE = 0x01

// ---------------------------------------------------------------------------
// Column store provider interface
// ---------------------------------------------------------------------------

/**
 * The plugin-provider contract for the column store.
 *
 * Brainy ships a TypeScript baseline that implements this interface.
 * Cortex registers a Rust-accelerated implementation at higher priority.
 * The MetadataIndex coordinator calls whichever is registered.
 */
export interface ColumnStoreProvider {
  /**
   * Initialize the column store: discover fields, load manifests.
   *
   * @param storage - The storage adapter for reading/writing segment files
   * @param idMapper - Shared EntityIdMapper for UUID ↔ u32 conversion
   */
  init(storage: StorageAdapter, idMapper: EntityIdMapper): Promise<void>

  /**
   * Index an entity's field values. For multi-value fields (arrays),
   * one entry per element is added to the column.
   *
   * @param entityIntId - The entity's u32 integer ID (from EntityIdMapper)
   * @param fields - Map of field name → value (or array of values for multi-value)
   */
  addEntity(entityIntId: number, fields: Record<string, unknown>): void

  /**
   * Remove an entity from all indexed columns by adding tombstones.
   *
   * @param entityIntId - The entity's u32 integer ID
   */
  removeEntity(entityIntId: number): void

  /**
   * Point filter: find all entities where field equals value.
   *
   * @param field - Field name to filter on
   * @param value - Exact value to match
   * @returns Roaring bitmap of matching entity int IDs
   */
  filter(field: string, value: unknown): Promise<RoaringBitmap32>

  /**
   * Range filter: find all entities where field is within [min, max].
   *
   * @param field - Field name to filter on
   * @param min - Lower bound (undefined = no lower bound)
   * @param max - Upper bound (undefined = no upper bound)
   * @returns Roaring bitmap of matching entity int IDs
   */
  rangeQuery(field: string, min?: unknown, max?: unknown): Promise<RoaringBitmap32>

  /**
   * Sort top-K: return the K entity int IDs with the highest or lowest
   * values in the specified field, in sort order.
   *
   * @param field - Field to sort by
   * @param order - 'asc' or 'desc'
   * @param k - Maximum number of results
   * @returns Sorted array of entity int IDs
   */
  sortTopK(field: string, order: 'asc' | 'desc', k: number): Promise<number[]>

  /**
   * Filtered sort top-K: same as sortTopK but only considers entities
   * present in the filter bitmap.
   *
   * @param filterBitmap - Roaring bitmap of candidate entity int IDs
   * @param field - Field to sort by
   * @param order - 'asc' or 'desc'
   * @param k - Maximum number of results
   * @returns Sorted array of entity int IDs (subset of filterBitmap)
   */
  filteredSortTopK(
    filterBitmap: RoaringBitmap32,
    field: string,
    order: 'asc' | 'desc',
    k: number
  ): Promise<number[]>

  /**
   * Get all distinct values for a field across all segments.
   *
   * @param field - Field name
   * @returns Array of distinct values as strings
   */
  getFilterValues(field: string): Promise<string[]>

  /**
   * Check if a field has any indexed data (segments or tail buffer entries).
   *
   * @param field - Field name
   * @returns True if the field has data in the column store
   */
  hasField(field: string): boolean

  /**
   * Flush all in-memory tail buffers to L0 segments on disk.
   * Saves all manifests.
   */
  flush(): Promise<void>

  /**
   * Flush and release all resources.
   */
  close(): Promise<void>
}
