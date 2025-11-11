/**
 * Unified Import System
 *
 * Single entry point for importing any file format into Brainy with:
 * - Auto-detection of formats
 * - Dual storage (VFS + Knowledge Graph)
 * - Shared entities across imports (deduplication)
 * - Simple, powerful API
 */

export { ImportCoordinator } from './ImportCoordinator.js'
export { FormatDetector, SupportedFormat, DetectionResult } from './FormatDetector.js'
export { EntityDeduplicator } from './EntityDeduplicator.js'
export { BackgroundDeduplicator } from './BackgroundDeduplicator.js'
export { ImportHistory } from './ImportHistory.js'

export type {
  ImportSource,
  ImportOptions,
  ImportProgress,
  ImportResult
} from './ImportCoordinator.js'

export type {
  EntityCandidate,
  DuplicateMatch,
  EntityDeduplicationOptions,
  MergeResult
} from './EntityDeduplicator.js'

export type {
  DeduplicationStats
} from './BackgroundDeduplicator.js'

export type {
  ImportHistoryEntry,
  RollbackResult
} from './ImportHistory.js'
