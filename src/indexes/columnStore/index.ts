/**
 * @module columnStore
 * @description Unified column store for filtering, sorting, range queries,
 * and text search on any field type with exact precision at billion scale.
 *
 * Replaces MetadataIndex's sparse chunk/bloom filter/bucketing internals
 * with per-field sorted columns. Design lineage: Lucene doc values + roaring
 * bitmap acceleration.
 */

export { ColumnStore } from './ColumnStore.js'
export type { ColumnStoreConfig } from './ColumnStore.js'
export { ColumnTailBuffer } from './ColumnTailBuffer.js'
export { ColumnManifest } from './ColumnManifest.js'
export { ColumnSegmentCursor, TailBufferCursor } from './ColumnSegmentCursor.js'
export {
  writeSegmentToBuffer,
  readSegmentFromBuffer,
  writeHeader,
  readHeader,
  crc32
} from './ColumnSegmentFormat.js'
export {
  ValueType,
  CIDX_MAGIC,
  CIDX_VERSION,
  HEADER_SIZE,
  FOOTER_SIZE,
  DEFAULT_FLUSH_THRESHOLD,
  FLAG_MULTI_VALUE
} from './types.js'
export type {
  ColumnStoreProvider,
  SegmentHeader,
  SegmentFooter,
  SegmentMeta,
  ManifestData
} from './types.js'
