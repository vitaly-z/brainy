/**
 * Base Storage Adapter
 * Provides common functionality for all storage adapters
 */

import { GraphAdjacencyIndex } from '../graph/graphAdjacencyIndex.js'

import {
  GraphVerb,
  HNSWNoun,
  HNSWVerb,
  NounMetadata,
  VerbMetadata,
  HNSWNounWithMetadata,
  HNSWVerbWithMetadata,
  StatisticsData,
  isCountedVisibility
} from '../coreTypes.js'
import type { EntityVisibility } from '../coreTypes.js'
import { BaseStorageAdapter } from './adapters/baseStorageAdapter.js'
import { validateNounType, validateVerbType } from '../utils/typeValidation.js'
import {
  NounType,
  VerbType,
  TypeUtils,
  NOUN_TYPE_COUNT,
  VERB_TYPE_COUNT
} from '../types/graphTypes.js'
import { getShardIdFromUuid } from './sharding.js'
import { RefManager } from './cow/RefManager.js'
import { BlobStorage, type COWStorageAdapter } from './cow/BlobStorage.js'
import { CommitLog } from './cow/CommitLog.js'
import { unwrapBinaryData, wrapBinaryData } from './cow/binaryDataCodec.js'
import { prodLog } from '../utils/logger.js'
import { MetadataWriteBuffer } from '../utils/metadataWriteBuffer.js'

/**
 * Storage key analysis result
 * Used to determine whether a key is a system key or entity key, and its storage path
 */
interface StorageKeyInfo {
  original: string
  isEntity: boolean
  shardId: string | null
  directory: string
  fullPath: string
}

/**
 * Storage adapter batch configuration profile
 * Each storage adapter declares its optimal batch behavior for rate limiting
 * and performance optimization
 *
 */
export interface StorageBatchConfig {
  /** Maximum items per batch */
  maxBatchSize: number

  /** Delay between batches in milliseconds (for rate limiting) */
  batchDelayMs: number

  /** Maximum concurrent operations this storage can handle */
  maxConcurrent: number

  /** Whether storage can handle parallel writes efficiently */
  supportsParallelWrites: boolean

  /** Rate limit characteristics of this storage adapter */
  rateLimit: {
    /** Approximate operations per second this storage can handle */
    operationsPerSecond: number

    /** Maximum burst capacity before throttling occurs */
    burstCapacity: number
  }
}

// Clean directory structure
// All storage adapters use this consistent structure
export const NOUNS_METADATA_DIR = 'entities/nouns/metadata'
export const VERBS_METADATA_DIR = 'entities/verbs/metadata'
export const SYSTEM_DIR = '_system'
export const STATISTICS_KEY = 'statistics'

/**
 * Metadata persisted in the writer lock file. Used by stale-lock detection
 * (PID liveness + hostname + heartbeat freshness) and by `brain.stats()` for
 * operator-facing diagnostics.
 */
export interface WriterLockInfo {
  pid: number
  hostname: string
  startedAt: string          // ISO timestamp when the lock was first acquired
  lastHeartbeat: string      // ISO timestamp of the most recent heartbeat update
  version: string            // Brainy version that wrote the lock
  rootDir?: string           // Convenience for log lines / error messages
}

/**
 * FNV-1a hash returning a 2-char hex bucket (00-ff).
 * Distributes system keys across 256 sub-prefixes to avoid
 * cloud storage per-prefix rate limits.
 */
function systemKeyBucket(key: string): string {
  let hash = 2166136261
  for (let i = 0; i < key.length; i++) {
    hash ^= key.charCodeAt(i)
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24)
  }
  return ((hash >>> 0) & 0xff).toString(16).padStart(2, '0')
}

const SINGLETON_SYSTEM_KEYS = new Set([
  '__metadata_field_registry__',
  'brainy:entityIdMapper',
  'statistics',
  'counts',
  'hnsw-system',
  'type-statistics',
])

const SINGLETON_SYSTEM_PREFIXES = [
  'statistics_',
  'distributed_',
]

function isSingletonSystemKey(key: string): boolean {
  if (SINGLETON_SYSTEM_KEYS.has(key)) return true
  return SINGLETON_SYSTEM_PREFIXES.some(p => key.startsWith(p))
}

// DEPRECATED: Temporary stubs for adapters not yet migrated
// TODO: Remove after migrating remaining adapters
export const NOUNS_DIR = 'entities/nouns/hnsw'
export const VERBS_DIR = 'entities/verbs/hnsw'
export const METADATA_DIR = 'entities/nouns/metadata'
export const NOUN_METADATA_DIR = 'entities/nouns/metadata'
export const VERB_METADATA_DIR = 'entities/verbs/metadata'
export const INDEX_DIR = 'indexes'
export function getDirectoryPath(entityType: 'noun' | 'verb', dataType: 'vector' | 'metadata'): string {
  if (entityType === 'noun') {
    return dataType === 'vector' ? NOUNS_DIR : NOUNS_METADATA_DIR
  } else {
    return dataType === 'vector' ? VERBS_DIR : VERBS_METADATA_DIR
  }
}

/**
 * Type-first path generators
 * Built-in type-aware organization for all storage adapters
 */

/**
 * Get ID-first path for noun vectors
 * No type parameter needed - direct O(1) lookup by ID
 */
function getNounVectorPath(id: string): string {
  const shard = getShardIdFromUuid(id)
  return `entities/nouns/${shard}/${id}/vectors.json`
}

/**
 * Get ID-first path for noun metadata
 * No type parameter needed - direct O(1) lookup by ID
 */
function getNounMetadataPath(id: string): string {
  const shard = getShardIdFromUuid(id)
  return `entities/nouns/${shard}/${id}/metadata.json`
}

/**
 * Get ID-first path for verb vectors
 * No type parameter needed - direct O(1) lookup by ID
 */
function getVerbVectorPath(id: string): string {
  const shard = getShardIdFromUuid(id)
  return `entities/verbs/${shard}/${id}/vectors.json`
}

/**
 * Get ID-first path for verb metadata
 * No type parameter needed - direct O(1) lookup by ID
 */
function getVerbMetadataPath(id: string): string {
  const shard = getShardIdFromUuid(id)
  return `entities/verbs/${shard}/${id}/metadata.json`
}

/**
 * Extract the entity id from an ID-first metadata path. Both noun and verb
 * metadata live at `entities/<kind>/<shard>/<id>/metadata.json`, so the id is
 * the second-to-last path segment.
 * @param path - A metadata.json path produced by `getNounMetadataPath` / `getVerbMetadataPath`.
 * @returns The id segment, or `undefined` if the path doesn't have the expected shape.
 */
function idFromMetadataPath(path: string): string | undefined {
  const segments = path.split('/')
  return segments[segments.length - 2]
}

/**
 * Prefix marking a `getNouns()` pagination cursor as an opaque resume-OFFSET
 * token. The shard-scan adapter (`getNounsWithPagination`) is offset-based and
 * ignores a raw cursor, so `getNouns()` encodes the next offset INTO the cursor
 * and decodes it on the way back in — making cursor pagination actually advance.
 * Without this a cursor-paginating caller re-fetched page 0 every iteration and
 * (once `totalCount` reported the true total) `hasMore` stayed true forever — a
 * permanent re-scan loop on any store larger than one page.
 */
const OFFSET_CURSOR_PREFIX = 'off:'

/** Encode a resume offset as an opaque `getNouns()` cursor token. */
function encodeOffsetCursor(offset: number): string {
  return `${OFFSET_CURSOR_PREFIX}${offset}`
}

/**
 * Decode a `getNouns()` cursor into its resume offset. Returns `undefined` for
 * `undefined`/legacy/unrecognized cursors so the caller falls back to the
 * explicit `offset` argument (never to a silent re-scan of page 0).
 */
function decodeOffsetCursor(cursor: string | undefined): number | undefined {
  if (cursor === undefined || !cursor.startsWith(OFFSET_CURSOR_PREFIX)) return undefined
  const n = Number(cursor.slice(OFFSET_CURSOR_PREFIX.length))
  return Number.isInteger(n) && n >= 0 ? n : undefined
}

/**
 * Base storage adapter that implements common functionality
 * This is an abstract class that should be extended by specific storage adapters
 */
export abstract class BaseStorage extends BaseStorageAdapter {
  protected isInitialized = false
  protected graphIndex?: GraphAdjacencyIndex
  protected graphIndexPromise?: Promise<GraphAdjacencyIndex>
  protected readOnly = false

  // Write-through cache for read-after-write consistency
  // Extended lifetime - persists until explicit flush() call
  // Guarantees that immediately after writeObjectToBranch(), readWithInheritance() returns the data
  // Cache key: resolved branchPath (includes branch scope for COW isolation)
  // Cache lifetime: write start → flush() call (provides safety net for batch operations)
  // Memory footprint: Bounded by batch size (typically <1000 items during imports)
  private writeCache = new Map<string, any>()

  /**
   * Clear the write-through cache
   * MUST be called by all storage adapter clear() implementations to ensure
   * read-after-write consistency cache doesn't return stale data after clear.
   * @protected - Available to subclasses for clear() implementation
   */
  protected clearWriteCache(): void {
    this.writeCache.clear()
  }

  // COW (Copy-on-Write) support
  public refManager?: RefManager
  public blobStorage?: BlobStorage
  public commitLog?: CommitLog
  public currentBranch: string = 'main'
  // Removed cowEnabled flag - COW is ALWAYS enabled (mandatory, cannot be disabled)

  // Type-first indexing support
  // Built into all storage adapters for billion-scale efficiency
  protected nounCountsByType = new Uint32Array(NOUN_TYPE_COUNT) // 168 bytes (Stage 3: 42 types)
  protected verbCountsByType = new Uint32Array(VERB_TYPE_COUNT) // 508 bytes (Stage 3: 127 types)

  /**
   * Per-NounType-per-subtype counts. Outer key is the NounType index (matching
   * `nounCountsByType` indexing); inner key is the subtype string. Populated
   * incrementally as entities are saved and decremented on delete; persisted
   * to `_system/subtype-statistics.json` alongside type-statistics.
   *
   * Memory: one Map entry per (type, subtype) pair actually used — typically
   * tens of inner entries per NounType in production. Sparse by design — types
   * with no subtype-bearing entities have no outer entry.
   */
  protected subtypeCountsByType = new Map<number, Map<string, number>>()

  /**
   * Per-VerbType-per-subtype counts. Verb-side mirror of `subtypeCountsByType`.
   * Outer key is the VerbType index (matching `verbCountsByType` indexing);
   * inner key is the subtype string. Populated incrementally as relationships
   * are saved and decremented on delete; persisted to
   * `_system/verb-subtype-statistics.json` (same shape as the noun-side rollup
   * — `{ counts: { [verbTypeIdx]: { [subtype]: count } }, updatedAt }`).
   */
  protected verbSubtypeCountsByType = new Map<number, Map<string, number>>()

  /**
   * In-memory map from noun id → its `noun` (NounType) value, populated when
   * `saveNounMetadata_internal()` runs. `saveNoun_internal()` consults this
   * to attribute the entity to the correct slot in `nounCountsByType` so the
   * persisted `_system/type-statistics.json` is honest.
   *
   * History: a previous cache was removed in commit `42ae5be` and replaced
   * with a hardcoded `return 'thing'` from `getNounType()`, which silently
   * poisoned the on-disk type statistics. This cache restores the correct
   * behavior. Memory footprint is one Map entry per live noun id (typically
   * tens of bytes each); the writer process keeps it for the duration of
   * its lifetime and prunes on delete.
   */
  protected nounTypeByIdCache = new Map<string, NounType>()

  /**
   * In-memory map from noun id → its `subtype` string (when set). Parallel to
   * `nounTypeByIdCache`. Lets `deleteNounMetadata()` decrement the correct
   * subtype bucket without re-reading metadata. Sparse — only ids with a
   * non-empty subtype get an entry.
   */
  protected nounSubtypeByIdCache = new Map<string, string>()

  /**
   * In-memory map from verb id → `{ verb, subtype }` pair. Verb-side mirror of
   * `nounTypeByIdCache` + `nounSubtypeByIdCache`. Lets `deleteVerbMetadata` and
   * `updateRelation` decrement the right bucket without a re-read of metadata.
   * Sparse — only ids with a non-empty subtype get an entry.
   */
  protected verbSubtypeByIdCache = new Map<string, { verb: VerbType; subtype: string }>()
  // Total: 676 bytes (99.2% reduction vs Map-based tracking)

  /**
   * In-memory map from noun id → its non-public `visibility` tier ('internal' |
   * 'system'). Parallel to `nounTypeByIdCache`. Lets `saveNoun_internal()`
   * (which has no metadata access in its signature) skip the user-facing
   * `nounCountsByType` increment for hidden entities, and lets
   * `deleteNounMetadata()` skip the matching decrement — keeping the counts
   * symmetric. Sparse by design: public entities (the common case) get NO
   * entry, so the absence of an id means "public, counted".
   */
  protected nounVisibilityByIdCache = new Map<string, EntityVisibility>()

  /**
   * In-memory map from verb id → its non-public `visibility` tier. Verb-side
   * mirror of `nounVisibilityByIdCache`. Sparse — public edges get no entry.
   */
  protected verbVisibilityByIdCache = new Map<string, EntityVisibility>()

  // Type caches REMOVED - ID-first paths eliminate need for type lookups!
  // With ID-first architecture, we construct paths directly from IDs: {SHARD}/{ID}/metadata.json
  // Type is just a field in the metadata, indexed by MetadataIndexManager for queries

  // Track if type counts have been rebuilt (prevent repeated rebuilds)
  private typeCountsRebuilt = false

  // Write buffer for cloud storage adapters — deduplicates rapid writes to the same path
  // FileSystem adapter does NOT use this (local writes are already fast)
  // Initialized by cloud adapters in their init() method
  protected metadataWriteBuffer: MetadataWriteBuffer | null = null

  /**
   * Analyze a storage key to determine its routing and path
   * @param id - The key to analyze (UUID or system key)
   * @param context - The context for the key (noun-metadata, verb-metadata, or system)
   * @returns Storage key information including path and shard ID
   * @private
   */
  private analyzeKey(id: string, context: 'noun-metadata' | 'verb-metadata' | 'system'): StorageKeyInfo {
    // Guard against undefined/null IDs
    if (!id || typeof id !== 'string') {
      throw new Error(`Invalid storage key: ${id} (must be a non-empty string)`)
    }

    // System resource detection
    const isSystemKey =
      id.startsWith('__metadata_') ||
      id.startsWith('__index_') ||
      id.startsWith('__system_') ||
      id.startsWith('statistics_') ||
      id === 'statistics' ||
      id.startsWith('__chunk__') ||      // Metadata index chunks (roaring bitmap data)
      id.startsWith('__sparse_index__')  // Metadata sparse indices (zone maps + bloom filters)

    if (isSystemKey) {
      if (isSingletonSystemKey(id)) {
        return {
          original: id,
          isEntity: false,
          shardId: null,
          directory: SYSTEM_DIR,
          fullPath: `${SYSTEM_DIR}/${id}.json`
        }
      }
      const bucket = systemKeyBucket(id)
      return {
        original: id,
        isEntity: false,
        shardId: bucket,
        directory: `${SYSTEM_DIR}/idx/${bucket}`,
        fullPath: `${SYSTEM_DIR}/idx/${bucket}/${id}.json`
      }
    }

    // UUID validation for entity keys
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (!uuidRegex.test(id)) {
      prodLog.warn(`[Storage] Unknown key format: ${id} - treating as system resource`)
      if (isSingletonSystemKey(id)) {
        return {
          original: id,
          isEntity: false,
          shardId: null,
          directory: SYSTEM_DIR,
          fullPath: `${SYSTEM_DIR}/${id}.json`
        }
      }
      const bucket = systemKeyBucket(id)
      return {
        original: id,
        isEntity: false,
        shardId: bucket,
        directory: `${SYSTEM_DIR}/idx/${bucket}`,
        fullPath: `${SYSTEM_DIR}/idx/${bucket}/${id}.json`
      }
    }

    // Valid entity UUID - apply sharding
    const shardId = getShardIdFromUuid(id)

    if (context === 'noun-metadata') {
      return {
        original: id,
        isEntity: true,
        shardId,
        directory: `${NOUNS_METADATA_DIR}/${shardId}`,
        fullPath: `${NOUNS_METADATA_DIR}/${shardId}/${id}.json`
      }
    } else if (context === 'verb-metadata') {
      return {
        original: id,
        isEntity: true,
        shardId,
        directory: `${VERBS_METADATA_DIR}/${shardId}`,
        fullPath: `${VERBS_METADATA_DIR}/${shardId}/${id}.json`
      }
    } else {
      // system context - but UUID format
      return {
        original: id,
        isEntity: false,
        shardId: null,
        directory: SYSTEM_DIR,
        fullPath: `${SYSTEM_DIR}/${id}.json`
      }
    }
  }

  /**
   * Initialize the storage adapter
   * Loads type statistics for built-in type-aware indexing
   *
   * IMPORTANT: If your adapter overrides init(), call await super.init() first!
   */
  public async init(): Promise<void> {
    // CRITICAL FIX - Set flag FIRST to prevent infinite recursion
    // If any code path during initialization calls ensureInitialized(), it would
    // trigger init() again. Setting the flag immediately breaks the recursion cycle.
    this.isInitialized = true

    try {
      // Load type statistics from storage (if they exist)
      await this.loadTypeStatistics()
      await this.loadSubtypeStatistics()
      await this.loadVerbSubtypeStatistics()

      // GraphAdjacencyIndex is now SINGLETON via getGraphIndex()
      // - Removed direct creation here to fix dual-ownership bug
      // - GraphAdjacencyIndex will be created lazily on first getGraphIndex() call
      // - This ensures there's only ONE instance per storage adapter
      // - See: https://github.com/soulcraftlabs/brainy/issues/vfs-corruption
      prodLog.debug('[BaseStorage] init() complete - GraphAdjacencyIndex will be created via getGraphIndex()')
    } catch (error) {
      // Reset flag on failure to allow retry
      this.isInitialized = false
      throw error
    }
  }

  /**
   * Rebuild GraphAdjacencyIndex from existing verbs
   * Call this manually if you have existing verb data that needs to be indexed
   * @public
   */
  public async rebuildGraphIndex(): Promise<void> {
    const index = await this.getGraphIndex()
    prodLog.info('[BaseStorage] Rebuilding graph index from existing data...')
    await index.rebuild()
    prodLog.info('[BaseStorage] Graph index rebuild complete')
  }

  /**
   * Invalidate GraphAdjacencyIndex
   * Call this when switching branches or clearing data to force re-creation
   * The next getGraphIndex() call will create a fresh instance and rebuild
   * @public
   */
  public invalidateGraphIndex(): void {
    if (this.graphIndex) {
      prodLog.info('[BaseStorage] Invalidating GraphAdjacencyIndex for branch switch/clear')
      // Stop any pending operations
      if (typeof (this.graphIndex as any).stopAutoFlush === 'function') {
        (this.graphIndex as any).stopAutoFlush()
      }
      this.graphIndex = undefined
      this.graphIndexPromise = undefined
    }
  }

  /**
   * Set the graph index instance (used by Brainy to wire plugin-provided graph indexes).
   * This ensures getVerbsBySource() uses the fast GraphAdjacencyIndex path
   * instead of falling back to O(n) shard iteration.
   */
  public setGraphIndex(index: GraphAdjacencyIndex): void {
    this.graphIndex = index
    this.graphIndexPromise = Promise.resolve(index)
  }

  /**
   * Ensure the storage adapter is initialized
   */
  protected async ensureInitialized(): Promise<void> {
    if (!this.isInitialized) {
      await this.init()
    }
  }

  /**
   * Whether this storage adapter enforces multi-process writer exclusion.
   * Filesystem storage returns true; cloud and memory adapters return false.
   * Brainy.init() checks this to decide whether to log a multi-process warning
   * in writer mode.
   */
  public supportsMultiProcessLocking(): boolean {
    return false
  }

  /**
   * Attempt to acquire the process-level writer lock at init time. Default
   * implementation is a no-op (multi-process safety not enforced). Filesystem
   * storage overrides this with real locking semantics.
   *
   * @param options.force - If true, overwrite any existing writer lock. Use
   *   only when stale detection cannot prove the existing lock is dead.
   * @returns Metadata about the acquired lock (or `null` if no lock was needed).
   * @throws If another live writer holds the lock and `force` is not set.
   */
  public async acquireWriterLock(options?: { force?: boolean }): Promise<WriterLockInfo | null> {
    return null
  }

  /**
   * Release the writer lock acquired by `acquireWriterLock()`. No-op if no lock
   * was held. Filesystem storage overrides this to delete the lock file and
   * stop the heartbeat timer.
   */
  public async releaseWriterLock(): Promise<void> {
    // No-op by default
  }

  /**
   * Read the current writer-lock metadata if one is held by any process. Used
   * by `brain.stats()` for diagnostics. Default returns null (no lock model).
   */
  public async readWriterLock(): Promise<WriterLockInfo | null> {
    return null
  }

  /**
   * Start watching for cross-process flush requests. The writer Brainy
   * instance calls this so that out-of-process inspectors can ask for a
   * synchronous flush before they open the store read-only. Default is a
   * no-op (non-filesystem backends have no shared filesystem to poll).
   *
   * @param onRequest - Callback invoked when a request file appears. Should
   *   call `brain.flush()` and resolve when persistence is complete.
   */
  public startFlushRequestWatcher(onRequest: () => Promise<void>): void {
    // No-op by default
  }

  /**
   * Stop the flush-request watcher started by `startFlushRequestWatcher`.
   */
  public stopFlushRequestWatcher(): void {
    // No-op by default
  }

  /**
   * Write a flush-request file and wait for the writer to acknowledge by
   * writing the corresponding response file. Returns true if a response was
   * received before the timeout, false if it timed out.
   *
   * Cross-platform RPC over the shared filesystem — no signals, so this works
   * on Windows, Linux, macOS, and inside containers without IPC config.
   */
  public async requestFlushOverFilesystem(_timeoutMs: number): Promise<boolean> {
    return false
  }

  /**
   * Lightweight COW enablement - just enables branch-scoped paths
   * Called during init() to ensure all data is stored with branch prefixes from the start
   * RefManager/BlobStorage/CommitLog are lazy-initialized on first fork()
   * @param branch - Branch name to use (default: 'main')
   *
   * COW is always enabled - this method now just sets the branch name (idempotent)
   */
  public enableCOWLightweight(branch: string = 'main'): void {
    this.currentBranch = branch
    // RefManager/BlobStorage/CommitLog remain undefined until first fork()
  }

  /**
   * Initialize COW (Copy-on-Write) support
   * Creates RefManager and BlobStorage for instant fork() capability
   *
   * Now called automatically by storageFactory (zero-config)
   *
   * @param options - COW initialization options
   * @param options.branch - Initial branch name (default: 'main')
   * @param options.enableCompression - Enable zstd compression for blobs (default: true)
   * @returns Promise that resolves when COW is initialized
   */
  public async initializeCOW(options?: {
    branch?: string
    enableCompression?: boolean
  }): Promise<void> {
    // COW is ALWAYS enabled - idempotent initialization only
    // Removed marker file check (cowEnabled flag removed, COW is mandatory)

    // Check if RefManager already initialized (idempotent)
    if (this.refManager && this.blobStorage && this.commitLog) {
      return
    }

    // Set current branch if provided
    if (options?.branch) {
      this.currentBranch = options.branch
    }

    // Create COWStorageAdapter bridge
    // This adapts BaseStorage's methods to the simple key-value interface
    const cowAdapter: COWStorageAdapter = {
      get: async (key: string): Promise<Buffer | undefined> => {
        try {
          const data = await this.readObjectFromPath(`_cow/${key}`)
          if (data === null) {
            return undefined
          }
          // Use shared binaryDataCodec utility (single source of truth)
          // Unwraps binary data stored as {_binary: true, data: "base64..."}
          // Fixes "Blob integrity check failed" - hash must be calculated on original content
          return unwrapBinaryData(data)
        } catch (error) {
          return undefined
        }
      },

      put: async (key: string, data: Buffer): Promise<void> => {
        // PERMANENT FIX: Use key naming convention (explicit type contract)
        // NO GUESSING - key format explicitly declares data type:
        //
        // JSON keys (metadata and refs):
        // - 'ref:*'           → JSON (RefManager: refs, HEAD, branches)
        // - 'blob-meta:hash'  → JSON (BlobStorage: blob metadata)
        // - 'commit-meta:hash'→ JSON (BlobStorage: commit metadata)
        // - 'tree-meta:hash'  → JSON (BlobStorage: tree metadata)
        //
        // Binary keys (blob data):
        // - 'blob:hash'       → Binary (BlobStorage: compressed/raw blob data)
        // - 'commit:hash'     → Binary (BlobStorage: commit object data)
        // - 'tree:hash'       → Binary (BlobStorage: tree object data)
        //
        // This eliminates the fragile JSON.parse() guessing that caused blob integrity
        // failures when compressed data accidentally parsed as valid JSON.
        const obj = key.includes('-meta:') || key.startsWith('ref:')
          ? JSON.parse(data.toString())  // Metadata/refs: ALWAYS JSON.stringify'd
          : { _binary: true, data: data.toString('base64') }  // Blobs: ALWAYS binary (possibly compressed)

        await this.writeObjectToPath(`_cow/${key}`, obj)
      },

      delete: async (key: string): Promise<void> => {
        try {
          await this.deleteObjectFromPath(`_cow/${key}`)
        } catch (error) {
          // Ignore if doesn't exist
        }
      },

      list: async (prefix: string): Promise<string[]> => {
        try {
          // Handle file prefixes, not just directory paths
          // Refs are stored as files like: _cow/ref:refs/heads/main
          // So list('ref:') should find all files starting with '_cow/ref:'

          // List the _cow directory and filter by prefix
          const allPaths = await this.listObjectsUnderPath('_cow/')
          const filteredPaths = allPaths.filter(p => {
            // Remove _cow/ prefix to get the key
            const key = p.replace(/^_cow\//, '')
            return key.startsWith(prefix)
          })

          // Remove _cow/ prefix and return relative keys
          return filteredPaths.map(p => p.replace(/^_cow\//, ''))
        } catch (error: any) {
          // If _cow directory doesn't exist yet, return empty array
          return []
        }
      }
    }

    // Initialize RefManager
    this.refManager = new RefManager(cowAdapter)

    // Initialize BlobStorage
    this.blobStorage = new BlobStorage(cowAdapter, {
      enableCompression: options?.enableCompression !== false
    })

    // Initialize CommitLog
    this.commitLog = new CommitLog(this.blobStorage, this.refManager)

    // Check if main branch exists, create if not
    const mainRef = await this.refManager.getRef('main')
    if (!mainRef) {
      // Create initial commit with empty tree
      // Use NULL_HASH constant instead of hardcoded string
      const { NULL_HASH } = await import('./cow/constants.js')
      const emptyTreeHash = NULL_HASH

      // Import CommitBuilder
      const { CommitBuilder } = await import('./cow/CommitObject.js')

      // Create initial commit object
      const initialCommitHash = await CommitBuilder.create(this.blobStorage)
        .tree(emptyTreeHash)
        .parent(null)
        .message('Initial commit')
        .author('system')
        .timestamp(Date.now())
        .build()

      // Create main branch pointing to initial commit
      await this.refManager.createBranch('main', initialCommitHash, {
        description: 'Initial branch',
        author: 'system'
      })
    }

    // Set HEAD to current branch
    const currentRef = await this.refManager.getRef(this.currentBranch)
    if (currentRef) {
      await this.refManager.setHead(this.currentBranch)
    } else {
      // Branch doesn't exist, create it from main
      const mainCommit = await this.refManager.resolveRef('main')
      if (mainCommit) {
        await this.refManager.createBranch(this.currentBranch, mainCommit, {
          description: `Branch created from main`,
          author: 'system'
        })
        await this.refManager.setHead(this.currentBranch)
      }
    }

    // COW is always enabled - no flag to set
  }

  /**
   * Resolve branch-scoped path for COW isolation
   * @protected - Available to subclasses for COW implementation
   */
  protected resolveBranchPath(basePath: string, branch?: string): string {
    // CRITICAL FIX: COW metadata (_cow/*) must NEVER be branch-scoped
    // Refs, commits, and blobs are global metadata with their own internal branching.
    // Branch-scoping COW paths causes fork() to write refs to wrong locations,
    // leading to "Branch does not exist" errors on checkout.
    if (basePath.startsWith('_cow/')) {
      return basePath  // COW metadata is global across all branches
    }

    // COW is always enabled - always use branch-scoped paths
    const targetBranch = branch || this.currentBranch || 'main'

    // Branch-scoped path: branches/<branch>/<basePath>
    return `branches/${targetBranch}/${basePath}`
  }

  /**
   * Write object to branch-specific path (COW layer)
   * @protected - Available to subclasses for COW implementation
   */
  protected async writeObjectToBranch(path: string, data: any, branch?: string): Promise<void> {
    const branchPath = this.resolveBranchPath(path, branch)

    // Add to write cache BEFORE async write (guarantees read-after-write consistency)
    // Cache persists until flush() is called (extended lifetime for batch operations)
    // This ensures readWithInheritance() returns data immediately, fixing "Source entity not found" bug
    this.writeCache.set(branchPath, data)

    // Use write buffer if available (cloud adapters), otherwise write directly (filesystem)
    if (this.metadataWriteBuffer) {
      await this.metadataWriteBuffer.write(branchPath, data)
    } else {
      await this.writeObjectToPath(branchPath, data)
    }

    // Cache is NOT cleared here anymore - persists until flush()
    // This provides a safety net for immediate queries after batch writes
  }

  /**
   * Read object with inheritance from parent branches (COW layer)
   * Tries current branch first, then walks commit history
   * @protected - Available to subclasses for COW implementation
   *
   * COW is always enabled - always use branch-scoped paths with inheritance
   */
  protected async readWithInheritance(path: string, branch?: string): Promise<any | null> {
    const targetBranch = branch || this.currentBranch || 'main'
    const branchPath = this.resolveBranchPath(path, targetBranch)

    // Check write cache FIRST (synchronous, instant)
    // This guarantees read-after-write consistency within the same process
    // Fixes bug: brain.add() → brain.relate() → "Source entity not found"
    const cachedData = this.writeCache.get(branchPath)
    if (cachedData !== undefined) {
      return cachedData
    }

    // Try current branch first
    let data = await this.readObjectFromPath(branchPath)

    if (data !== null) {
      return data  // Found in current branch
    }

    // Not in branch, check if we're on main (no inheritance needed)
    if (targetBranch === 'main') {
      return null
    }

    // Not in branch, walk commit history to find in parent
    if (this.refManager && this.commitLog) {
      try {
        const commitHash = await this.refManager.resolveRef(targetBranch)
        if (commitHash) {
          // Walk parent commits until we find the data
          for await (const commit of this.commitLog.walk(commitHash)) {
            // Try reading from parent's branch path
            const parentBranch = commit.metadata?.branch || 'main'
            if (parentBranch === targetBranch) continue  // Skip self

            const parentPath = this.resolveBranchPath(path, parentBranch)
            data = await this.readObjectFromPath(parentPath)
            if (data !== null) {
              return data  // Found in ancestor
            }
          }
        }
      } catch (error) {
        // Commit walk failed, fall back to main
        const mainPath = this.resolveBranchPath(path, 'main')
        return this.readObjectFromPath(mainPath)
      }
    }

    // Last fallback: try main branch
    const mainPath = this.resolveBranchPath(path, 'main')
    return this.readObjectFromPath(mainPath)
  }

  /**
   * Delete object from branch-specific path (COW layer)
   * @protected - Available to subclasses for COW implementation
   */
  protected async deleteObjectFromBranch(path: string, branch?: string): Promise<void> {
    const branchPath = this.resolveBranchPath(path, branch)

    // Remove from write cache immediately (before async delete)
    // Ensures subsequent reads don't return stale cached data
    this.writeCache.delete(branchPath)

    return this.deleteObjectFromPath(branchPath)
  }

  /**
   * List objects under path in branch (COW layer)
   * @protected - Available to subclasses for COW implementation
   */
  protected async listObjectsInBranch(prefix: string, branch?: string): Promise<string[]> {
    const branchPrefix = this.resolveBranchPath(prefix, branch)
    const paths = await this.listObjectsUnderPath(branchPrefix)

    // Remove branch prefix from results
    const targetBranch = branch || this.currentBranch || 'main'
    const prefixToRemove = `branches/${targetBranch}/`

    return paths.map(p => p.startsWith(prefixToRemove) ? p.substring(prefixToRemove.length) : p)
  }

  /**
   * List objects with inheritance
   * Lists objects from current branch AND main branch, returns unique paths
   * This enables fork to see parent's data in pagination operations
   *
   * Simplified approach: All branches inherit from main
   *
   * COW is always enabled - always use inheritance
   */
  protected async listObjectsWithInheritance(prefix: string, branch?: string): Promise<string[]> {
    const targetBranch = branch || this.currentBranch || 'main'

    // Collect paths from current branch
    const pathsSet = new Set<string>()
    const currentBranchPaths = await this.listObjectsInBranch(prefix, targetBranch)
    currentBranchPaths.forEach(p => pathsSet.add(p))

    // If not on main, also list from main (all branches inherit from main)
    if (targetBranch !== 'main') {
      const mainPaths = await this.listObjectsInBranch(prefix, 'main')
      mainPaths.forEach(p => pathsSet.add(p))
    }

    return Array.from(pathsSet)
  }

  /**
   * Save a noun to storage (vector only, metadata saved separately)
   * @param noun Pure HNSW vector data (no metadata)
   */
  public async saveNoun(noun: HNSWNoun): Promise<void> {
    await this.ensureInitialized()

    // Save the HNSWNoun vector data only
    // Metadata must be saved separately via saveNounMetadata()
    await this.saveNoun_internal(noun)
  }

  /**
   * Get a noun from storage (returns combined HNSWNounWithMetadata)
   * @param id Entity ID
   * @returns Combined vector + metadata or null
   */
  public async getNoun(id: string): Promise<HNSWNounWithMetadata | null> {
    await this.ensureInitialized()

    // Load vector and metadata separately
    const vector = await this.getNoun_internal(id)
    if (!vector) {
      return null
    }

    // Load metadata
    const metadata = await this.getNounMetadata(id)
    if (!metadata) {
      prodLog.warn(`[Storage] Noun ${id} has vector but no metadata - this should not happen`)
      return null
    }

    // Combine into HNSWNounWithMetadata - Extract standard fields to top-level
    const { noun, subtype, visibility, createdAt, updatedAt, confidence, weight, service, data, createdBy, _rev, ...customMetadata } = metadata

    return {
      id: vector.id,
      vector: vector.vector,
      connections: vector.connections,
      level: vector.level,
      // Standard fields at top-level
      type: (noun as NounType) || NounType.Thing,
      subtype: subtype as string | undefined,
      visibility: visibility as EntityVisibility | undefined,
      createdAt: (createdAt as number) || Date.now(),
      updatedAt: (updatedAt as number) || Date.now(),
      confidence: confidence as number | undefined,
      weight: weight as number | undefined,
      service: service as string | undefined,
      data: data as Record<string, any> | undefined,
      createdBy,
      _rev: typeof _rev === 'number' ? _rev : 1,
      // Only custom user fields remain in metadata
      metadata: customMetadata
    }
  }

  /**
   * Get nouns by noun type
   * @param nounType The noun type to filter by
   * @returns Promise that resolves to an array of nouns of the specified noun type
   */
  public async getNounsByNounType(nounType: string): Promise<HNSWNounWithMetadata[]> {
    await this.ensureInitialized()

    // Internal method returns HNSWNoun[], need to combine with metadata
    const nouns = await this.getNounsByNounType_internal(nounType)

    // Combine each noun with its metadata - Extract standard fields to top-level
    const nounsWithMetadata: HNSWNounWithMetadata[] = []
    for (const noun of nouns) {
      const metadata = await this.getNounMetadata(noun.id)
      if (metadata) {
        const { noun: nounType, subtype, visibility, createdAt, updatedAt, confidence, weight, service, data, createdBy, _rev, ...customMetadata } = metadata

        nounsWithMetadata.push({
          ...noun,
          // Standard fields at top-level
          type: (nounType as NounType) || NounType.Thing,
          subtype: subtype as string | undefined,
          visibility: visibility as EntityVisibility | undefined,
          createdAt: (createdAt as number) || Date.now(),
          updatedAt: (updatedAt as number) || Date.now(),
          confidence: confidence as number | undefined,
          weight: weight as number | undefined,
          service: service as string | undefined,
          data: data as Record<string, any> | undefined,
          createdBy,
          _rev: typeof _rev === 'number' ? _rev : 1,
          // Only custom user fields in metadata
          metadata: customMetadata
        })
      }
    }

    return nounsWithMetadata
  }

  /**
   * Delete a noun from storage
   */
  public async deleteNoun(id: string): Promise<void> {
    await this.ensureInitialized()

    // Delete both the vector file and metadata file (2-file system)
    await this.deleteNoun_internal(id)

    // Delete metadata file (if it exists)
    try {
      await this.deleteNounMetadata(id)
    } catch (error) {
      // Ignore if metadata file doesn't exist
      prodLog.debug(`No metadata file to delete for noun ${id}`)
    }
  }

  /**
   * Save a verb to storage (verb only, metadata saved separately)
   *
   * @param verb Pure HNSW verb with core relational fields (verb, sourceId, targetId)
   */
  public async saveVerb(verb: HNSWVerb): Promise<void> {
    await this.ensureInitialized()

    // Validate verb type before saving - storage boundary protection
    validateVerbType(verb.verb)

    // Save the HNSWVerb vector and core fields only
    // Metadata must be saved separately via saveVerbMetadata()
    await this.saveVerb_internal(verb)
  }

  /**
   * Get a verb from storage (returns combined HNSWVerbWithMetadata)
   * @param id Entity ID
   * @returns Combined verb + metadata or null
   */
  public async getVerb(id: string): Promise<HNSWVerbWithMetadata | null> {
    await this.ensureInitialized()

    // Load verb vector and core fields
    const verb = await this.getVerb_internal(id)
    if (!verb) {
      return null
    }

    // Load metadata
    const metadata = await this.getVerbMetadata(id)
    if (!metadata) {
      prodLog.warn(`[Storage] Verb ${id} has vector but no metadata - this should not happen`)
      return null
    }

    // Combine into HNSWVerbWithMetadata - Extract standard fields to top-level
    const { subtype, visibility, createdAt, updatedAt, confidence, weight, service, data, createdBy, _rev, ...customMetadata } = metadata

    return {
      id: verb.id,
      vector: verb.vector,
      connections: verb.connections,
      verb: verb.verb,
      sourceId: verb.sourceId,
      targetId: verb.targetId,
      // Standard fields at top-level
      subtype: subtype as string | undefined,
      visibility: visibility as EntityVisibility | undefined,
      createdAt: (createdAt as number) || Date.now(),
      updatedAt: (updatedAt as number) || Date.now(),
      confidence: confidence as number | undefined,
      weight: weight as number | undefined,
      service: service as string | undefined,
      data: data as Record<string, any> | undefined,
      createdBy,
      // Only custom user fields remain in metadata
      metadata: customMetadata
    }
  }

  /**
   * Batch get multiple verbs
   *
   * **Performance**: Eliminates N+1 pattern for verb loading
   * - Current: N × getVerb() = N × 50ms on GCS = 250ms for 5 verbs
   * - Batched: 1 × getVerbsBatch() = 1 × 50ms on GCS = 50ms (**5x faster**)
   *
   * **Use cases:**
   * - graphIndex.getVerbsBatchCached() for relate() duplicate checking
   * - Loading relationships in batch operations
   * - Pre-loading verbs for graph traversal
   *
   * @param ids Array of verb IDs to fetch
   * @returns Map of id → HNSWVerbWithMetadata (only successful reads included)
   *
   */
  public async getVerbsBatch(ids: string[]): Promise<Map<string, HNSWVerbWithMetadata>> {
    await this.ensureInitialized()

    const results = new Map<string, HNSWVerbWithMetadata>()
    if (ids.length === 0) return results

    // Batch-fetch vectors and metadata in parallel
    // Build paths for vectors
    const vectorPaths: Array<{ path: string; id: string }> = ids.map(id => ({
      path: getVerbVectorPath(id),
      id
    }))

    // Build paths for metadata
    const metadataPaths: Array<{ path: string; id: string }> = ids.map(id => ({
      path: getVerbMetadataPath(id),
      id
    }))

    // Batch read vectors and metadata in parallel
    const [vectorResults, metadataResults] = await Promise.all([
      this.readBatchWithInheritance(vectorPaths.map(p => p.path)),
      this.readBatchWithInheritance(metadataPaths.map(p => p.path))
    ])

    // Combine vectors + metadata into HNSWVerbWithMetadata
    for (const { path: vectorPath, id } of vectorPaths) {
      const vectorData = vectorResults.get(vectorPath)
      const metadataPath = getVerbMetadataPath(id)
      const metadataData = metadataResults.get(metadataPath)

      if (vectorData && metadataData) {
        // Deserialize verb
        const verb = this.deserializeVerb(vectorData)

        // Extract standard fields to top-level
        const { subtype, visibility, createdAt, updatedAt, confidence, weight, service, data, createdBy, _rev, ...customMetadata } = metadataData

        results.set(id, {
          id: verb.id,
          vector: verb.vector,
          connections: verb.connections,
          verb: verb.verb,
          sourceId: verb.sourceId,
          targetId: verb.targetId,
          // Standard fields at top-level
          subtype: subtype as string | undefined,
          visibility: visibility as EntityVisibility | undefined,
          createdAt: (createdAt as number) || Date.now(),
          updatedAt: (updatedAt as number) || Date.now(),
          confidence: confidence as number | undefined,
          weight: weight as number | undefined,
          service: service as string | undefined,
          data: data as Record<string, any> | undefined,
          createdBy,
          // Only custom user fields remain in metadata
          metadata: customMetadata
        })
      }
    }

    return results
  }

  /**
   * Convert HNSWVerb to GraphVerb by combining with metadata
   * DEPRECATED: For backward compatibility only. Use getVerb() which returns HNSWVerbWithMetadata.
   *
   * @deprecated Use getVerb() instead which returns HNSWVerbWithMetadata
   */
  protected async convertHNSWVerbToGraphVerb(hnswVerb: HNSWVerb): Promise<GraphVerb | null> {
    try {
      // Load metadata
      const metadata = await this.getVerbMetadata(hnswVerb.id)

      // Create default timestamp in Firestore format
      const defaultTimestamp = {
        seconds: Math.floor(Date.now() / 1000),
        nanoseconds: (Date.now() % 1000) * 1000000
      }

      // Create default createdBy if not present
      const defaultCreatedBy = {
        augmentation: 'unknown',
        version: '1.0'
      }

      // Convert flexible timestamp to Firestore format for GraphVerb
      const normalizeTimestamp = (ts: any) => {
        if (!ts) return defaultTimestamp
        if (typeof ts === 'number') {
          return {
            seconds: Math.floor(ts / 1000),
            nanoseconds: (ts % 1000) * 1000000
          }
        }
        return ts
      }

      return {
        id: hnswVerb.id,
        vector: hnswVerb.vector,

        // CORE FIELDS from HNSWVerb
        verb: hnswVerb.verb,
        sourceId: hnswVerb.sourceId,
        targetId: hnswVerb.targetId,

        // Aliases for backward compatibility
        type: hnswVerb.verb,
        source: hnswVerb.sourceId,
        target: hnswVerb.targetId,

        // Optional fields from metadata file
        weight: metadata?.weight || 1.0,
        metadata: metadata as any || {},
        createdAt: normalizeTimestamp(metadata?.createdAt),
        updatedAt: normalizeTimestamp(metadata?.updatedAt),
        createdBy: metadata?.createdBy || defaultCreatedBy,
        data: metadata?.data as Record<string, any> | undefined,
        embedding: hnswVerb.vector
      }
    } catch (error) {
      prodLog.error(`Failed to convert HNSWVerb to GraphVerb for ${hnswVerb.id}:`, error)
      return null
    }
  }

  /**
   * Internal method for loading all verbs - used by performance optimizations
   * @internal - Do not use directly, use getVerbs() with pagination instead
   */
  protected async _loadAllVerbsForOptimization(): Promise<HNSWVerb[]> {
    await this.ensureInitialized()

    // Only use this for internal optimizations when safe
    const result = await this.getVerbs({
      pagination: { limit: Number.MAX_SAFE_INTEGER }
    })

    // Convert HNSWVerbWithMetadata to HNSWVerb (strip metadata)
    const hnswVerbs: HNSWVerb[] = result.items.map(verbWithMetadata => ({
      id: verbWithMetadata.id,
      vector: verbWithMetadata.vector,
      connections: verbWithMetadata.connections,
      verb: verbWithMetadata.verb,
      sourceId: verbWithMetadata.sourceId,
      targetId: verbWithMetadata.targetId
    }))

    return hnswVerbs
  }

  /**
   * Get verbs by source
   */
  public async getVerbsBySource(sourceId: string): Promise<HNSWVerbWithMetadata[]> {
    await this.ensureInitialized()

    // CRITICAL: Fetch ALL verbs for this source, not just first page
    // This is needed for delete operations to clean up all relationships
    const result = await this.getVerbs({
      filter: { sourceId },
      pagination: { limit: Number.MAX_SAFE_INTEGER }
    })
    return result.items
  }

  /**
   * Get verbs by target
   */
  public async getVerbsByTarget(targetId: string): Promise<HNSWVerbWithMetadata[]> {
    await this.ensureInitialized()

    // CRITICAL: Fetch ALL verbs for this target, not just first page
    // This is needed for delete operations to clean up all relationships
    const result = await this.getVerbs({
      filter: { targetId },
      pagination: { limit: Number.MAX_SAFE_INTEGER }
    })
    return result.items
  }

  /**
   * Get verbs by type
   */
  public async getVerbsByType(type: string): Promise<HNSWVerbWithMetadata[]> {
    await this.ensureInitialized()

    // Fetch ALL verbs of this type (no pagination limit)
    const result = await this.getVerbs({
      filter: { verbType: type },
      pagination: { limit: Number.MAX_SAFE_INTEGER }
    })
    return result.items
  }

  /**
   * Internal method for loading all nouns - used by performance optimizations
   * @internal - Do not use directly, use getNouns() with pagination instead
   */
  protected async _loadAllNounsForOptimization(): Promise<HNSWNoun[]> {
    await this.ensureInitialized()
    
    // Only use this for internal optimizations when safe
    const result = await this.getNouns({
      pagination: { limit: Number.MAX_SAFE_INTEGER }
    })
    
    return result.items
  }

  /**
   * Get nouns with pagination and filtering
   * @param options Pagination and filtering options
   * @returns Promise that resolves to a paginated result of nouns
   */
  public async getNouns(options?: {
    pagination?: {
      offset?: number
      limit?: number
      cursor?: string
    }
    filter?: {
      nounType?: string | string[]
      service?: string | string[]
      metadata?: Record<string, any>
    }
  }): Promise<{
    items: HNSWNounWithMetadata[]
    totalCount?: number
    hasMore: boolean
    nextCursor?: string
  }> {
    await this.ensureInitialized()

    // Set default pagination values
    const pagination = options?.pagination || {}
    const limit = pagination.limit || 100
    const offset = pagination.offset || 0
    const cursor = pagination.cursor

    // Optimize for common filter cases to avoid loading all nouns
    if (options?.filter) {
      // If filtering by nounType only, use the optimized method
      if (
        options.filter.nounType &&
        !options.filter.service &&
        !options.filter.metadata
      ) {
        const nounType = Array.isArray(options.filter.nounType)
          ? options.filter.nounType[0]
          : options.filter.nounType

        // Get nouns by type directly (already combines with metadata)
        const nounsByType = await this.getNounsByNounType(nounType)

        // Apply pagination. A cursor resumes by OFFSET (opaque offset token) so
        // cursor pagination advances; fall back to the explicit offset otherwise.
        const startOffset = decodeOffsetCursor(cursor) ?? offset
        const paginatedNouns = nounsByType.slice(startOffset, startOffset + limit)
        const hasMore = startOffset + limit < nounsByType.length

        return {
          items: paginatedNouns,
          totalCount: nounsByType.length,
          hasMore,
          // Next resume offset, so a cursor-paginating caller advances instead
          // of re-fetching the same page.
          nextCursor: hasMore ? encodeOffsetCursor(startOffset + paginatedNouns.length) : undefined
        }
      }
    }

    // For more complex filtering or no filtering, use a paginated approach
    // that avoids loading all nouns into memory at once
    try {
      // First, try to get a count of total nouns (if the adapter supports it)
      let totalCount: number | undefined = undefined
      try {
        // This is an optional method that adapters may implement
        if (typeof (this as any).countNouns === 'function') {
          totalCount = await (this as any).countNouns(options?.filter)
        }
      } catch (countError) {
        // Ignore errors from count method, it's optional
        prodLog.warn('Error getting noun count:', countError)
      }

      // Check if the adapter has a paginated method for getting nouns
      if (typeof (this as any).getNounsWithPagination === 'function') {
        // A cursor resumes by OFFSET: the shard-scan adapter is offset-based and
        // ignores the raw cursor, so decode the resume offset the cursor carries.
        // Without this, a cursor-paginating caller re-fetched offset 0 every call
        // and `hasMore` stayed true forever → a permanent re-scan loop. Falls
        // back to the explicit `offset` for a first page / legacy cursor.
        const resolvedOffset = decodeOffsetCursor(cursor) ?? offset

        // Use the adapter's paginated method - pass offset directly to adapter
        const result = await (this as any).getNounsWithPagination({
          limit,
          offset: resolvedOffset,  // Let the adapter handle offset for O(1) operation
          filter: options?.filter
        })

        // Don't slice here - the adapter should handle offset efficiently
        const items = result.items

        // CRITICAL SAFETY CHECK: Prevent infinite loops
        // If we have no items but hasMore is true, force hasMore to false
        // This prevents pagination bugs from causing infinite loops
        const safeHasMore = items.length > 0 ? result.hasMore : false

        // VALIDATION: Ensure adapter returns totalCount (prevents restart bugs)
        // If adapter forgets to return totalCount, log warning and use pre-calculated count
        let finalTotalCount = result.totalCount || totalCount
        if (result.totalCount === undefined && this.totalNounCount > 0) {
          prodLog.warn(
            `⚠️  Storage adapter missing totalCount in getNounsWithPagination result! ` +
            `Using pre-calculated count (${this.totalNounCount}) as fallback. ` +
            `Please ensure your storage adapter returns totalCount: this.totalNounCount`
          )
          finalTotalCount = this.totalNounCount
        }

        return {
          items,
          totalCount: finalTotalCount,
          hasMore: safeHasMore,
          // Re-issue the cursor as the NEXT resume offset so cursor pagination
          // advances exactly like offset pagination (it is offset pagination
          // under the hood). Omitted when there is no next page.
          nextCursor: safeHasMore ? encodeOffsetCursor(resolvedOffset + items.length) : undefined
        }
      }

      // Storage adapter does not support pagination
      prodLog.error(
        'Storage adapter does not support pagination. The deprecated getAllNouns_internal() method has been removed. Please implement getNounsWithPagination() in your storage adapter.'
      )
      
      return {
        items: [],
        totalCount: 0,
        hasMore: false
      }
    } catch (error) {
      prodLog.error('Error getting nouns with pagination:', error)
      return {
        items: [],
        totalCount: 0,
        hasMore: false
      }
    }
  }

  /**
   * Get nouns with pagination (Type-first implementation)
   *
   * CRITICAL: This method is required for brain.find() to work!
   * Iterates through noun types with billion-scale optimizations.
   *
   * ARCHITECTURE: Reads storage directly (not indexes) to avoid circular dependencies.
   * Storage → Indexes (one direction only). GraphAdjacencyIndex built FROM storage.
   *
   * OPTIMIZATIONS:
   * - Skip empty types using nounCountsByType[] tracking (O(1) check)
   * - Early termination when offset + limit entities collected
   * - Memory efficient: Never loads full dataset
   */
  public async getNounsWithPagination(options: {
    limit: number
    offset: number
    cursor?: string  // Currently ignored (offset-based pagination). Cursor support planned
    filter?: {
      nounType?: string | string[]
      service?: string | string[]
      metadata?: Record<string, any>
    }
  }): Promise<{
    items: HNSWNounWithMetadata[]
    totalCount: number
    hasMore: boolean
    nextCursor?: string
  }> {
    await this.ensureInitialized()

    const { limit, offset = 0, filter } = options
    const collectedNouns: HNSWNounWithMetadata[] = []
    const targetCount = offset + limit

    // Iterate by shards (0x00-0xFF) instead of types
    for (let shard = 0; shard < 256 && collectedNouns.length < targetCount; shard++) {
      const shardHex = shard.toString(16).padStart(2, '0')
      const shardDir = `entities/nouns/${shardHex}`

      try {
        const nounFiles = await this.listObjectsInBranch(shardDir)

        for (const nounPath of nounFiles) {
          if (collectedNouns.length >= targetCount) break
          if (!nounPath.includes('/vectors.json')) continue

          try {
            const noun = await this.readWithInheritance(nounPath)
            if (noun) {
              const deserialized = this.deserializeNoun(noun)
              const metadata = await this.getNounMetadata(deserialized.id)

              if (metadata) {
                // Apply type filter
                if (filter?.nounType && metadata.noun) {
                  const types = Array.isArray(filter.nounType) ? filter.nounType : [filter.nounType]
                  if (!types.includes(metadata.noun)) {
                    continue
                  }
                }

                // Apply service filter
                if (filter?.service) {
                  const services = Array.isArray(filter.service) ? filter.service : [filter.service]
                  if (metadata.service && !services.includes(metadata.service)) {
                    continue
                  }
                }

                // Combine noun + metadata. Subtype is surfaced to top-level here
                // (mirrors what `getNoun()` already does) so callers — including
                // the 7.30.1 `brain.audit()` diagnostic — see a consistent shape
                // regardless of which getter path they reach.
                collectedNouns.push({
                  ...deserialized,
                  type: (metadata.noun || 'thing') as NounType,
                  subtype: (metadata as any).subtype as string | undefined,
                  visibility: (metadata as any).visibility as EntityVisibility | undefined,
                  confidence: metadata.confidence,
                  weight: metadata.weight,
                  createdAt: metadata.createdAt
                    ? (typeof metadata.createdAt === 'number' ? metadata.createdAt : metadata.createdAt.seconds * 1000)
                    : Date.now(),
                  updatedAt: metadata.updatedAt
                    ? (typeof metadata.updatedAt === 'number' ? metadata.updatedAt : metadata.updatedAt.seconds * 1000)
                    : Date.now(),
                  service: metadata.service,
                  data: metadata.data as Record<string, any> | undefined,
                  createdBy: metadata.createdBy,
                  metadata: metadata || ({} as NounMetadata)
                })
              }
            }
          } catch (error) {
            // Skip nouns that fail to load
          }
        }
      } catch (error) {
        // Skip shards that have no data
      }
    }

    // Apply pagination
    const paginatedNouns = collectedNouns.slice(offset, offset + limit)

    // totalCount must be the TRUE dataset total, not the size of this page.
    // The shard scan above early-terminates at `targetCount = offset + limit`
    // for memory efficiency, so `collectedNouns.length` only ever reaches the
    // page size — returning it as `totalCount` made every non-empty brain look
    // like it held exactly `limit` items. In particular
    // `getNouns({ pagination: { limit: 1 } })` reported `totalCount: 1`, which
    // tripped the index-rebuild gate into logging "Small dataset (1 items)" and
    // rebuilding from scratch regardless of the real corpus size. For the
    // unfiltered case the authoritative total is the O(1) counter maintained on
    // every add/delete and rehydrated from `counts.json` on init; `Math.max`
    // guards against a stale counter ever under-reporting below what we
    // actually collected. A filtered scan has no cheap exact total, so it keeps
    // the collected length (a lower bound — unchanged behaviour).
    const totalCount = filter
      ? collectedNouns.length
      : Math.max(this.totalNounCount, collectedNouns.length)
    const hasMore = offset + paginatedNouns.length < totalCount

    return {
      items: paginatedNouns,
      totalCount,
      hasMore,
      nextCursor: hasMore && paginatedNouns.length > 0
        ? paginatedNouns[paginatedNouns.length - 1].id
        : undefined
    }
  }

  /**
   * Get verbs with pagination (Type-first implementation with billion-scale optimizations)
   *
   * CRITICAL: This method is required for brain.getRelations() to work!
   * Iterates through verb types with the same optimizations as nouns.
   *
   * ARCHITECTURE: Reads storage directly (not indexes) to avoid circular dependencies.
   * Storage → Indexes (one direction only). GraphAdjacencyIndex built FROM storage.
   *
   * OPTIMIZATIONS:
   * - Skip empty types using verbCountsByType[] tracking (O(1) check)
   * - Early termination when offset + limit verbs collected
   * - Memory efficient: Never loads full dataset
   * - Inline filtering for sourceId, targetId, verbType
   */
  public async getVerbsWithPagination(options: {
    limit: number
    offset: number
    cursor?: string  // Currently ignored (offset-based pagination). Cursor support planned
    filter?: {
      verbType?: string | string[]
      sourceId?: string | string[]
      targetId?: string | string[]
      service?: string | string[]
      metadata?: Record<string, any>
      /**
       * 8.0 visibility: tiers to exclude from results (e.g. `['internal','system']`).
       * Applied after metadata load in the full scan, so it disqualifies the
       * metadata-less graph-index fast paths (same as `subtype`).
       */
      excludeVisibility?: string[]
    }
  }): Promise<{
    items: HNSWVerbWithMetadata[]
    totalCount: number
    hasMore: boolean
    nextCursor?: string
  }> {
    await this.ensureInitialized()

    const { limit, offset = 0, filter } = options  // cursor intentionally not extracted (not yet implemented)
    const collectedVerbs: HNSWVerbWithMetadata[] = []
    const targetCount = offset + limit  // Early termination target

    // Prepare filter sets for efficient lookup
    const filterVerbTypes = filter?.verbType
      ? new Set(Array.isArray(filter.verbType) ? filter.verbType : [filter.verbType])
      : null
    const filterSourceIds = filter?.sourceId
      ? new Set(Array.isArray(filter.sourceId) ? filter.sourceId : [filter.sourceId])
      : null
    const filterTargetIds = filter?.targetId
      ? new Set(Array.isArray(filter.targetId) ? filter.targetId : [filter.targetId])
      : null
    const filterSubtypes = (filter as any)?.subtype
      ? new Set(
          Array.isArray((filter as any).subtype)
            ? (filter as any).subtype
            : [(filter as any).subtype]
        )
      : null
    // 8.0 visibility exclusion — applied after metadata load (verb visibility lives in
    // metadata), so hidden edges are skipped BEFORE the pagination window fills.
    const excludeVisibility = (filter as { excludeVisibility?: string[] } | undefined)?.excludeVisibility
    const filterExcludeVisibility = excludeVisibility && excludeVisibility.length > 0
      ? new Set(excludeVisibility)
      : null

    // Iterate by shards (0x00-0xFF) instead of types - single pass!
    for (let shard = 0; shard < 256 && collectedVerbs.length < targetCount; shard++) {
      const shardHex = shard.toString(16).padStart(2, '0')
      const shardDir = `entities/verbs/${shardHex}`

      try {
        const verbFiles = await this.listObjectsInBranch(shardDir)

        for (const verbPath of verbFiles) {
          if (collectedVerbs.length >= targetCount) break
          if (!verbPath.includes('/vectors.json')) continue

          try {
            const rawVerb = await this.readWithInheritance(verbPath)
            if (!rawVerb) continue

            // Deserialize connections Map from JSON storage format
            const verb = this.deserializeVerb(rawVerb)

            // Apply type filter
            if (filterVerbTypes && !filterVerbTypes.has(verb.verb)) {
              continue
            }

            // Apply sourceId filter
            if (filterSourceIds && !filterSourceIds.has(verb.sourceId)) {
              continue
            }

            // Apply targetId filter
            if (filterTargetIds && !filterTargetIds.has(verb.targetId)) {
              continue
            }

            // Load metadata
            const metadata = await this.getVerbMetadata(verb.id)

            // Apply subtype filter (requires metadata — checked AFTER load)
            if (filterSubtypes) {
              const subtype = (metadata as any)?.subtype as string | undefined
              if (!subtype || !filterSubtypes.has(subtype)) {
                continue
              }
            }

            // Apply visibility exclusion (8.0). Absent === 'public' (kept); a stored
            // 'internal'/'system' value is dropped when its tier is excluded.
            if (filterExcludeVisibility) {
              const visibility = (metadata as any)?.visibility as string | undefined
              if (visibility && filterExcludeVisibility.has(visibility)) {
                continue
              }
            }

            // Combine verb + metadata
            collectedVerbs.push({
              ...verb,
              subtype: (metadata as any)?.subtype as string | undefined,
              visibility: (metadata as any)?.visibility as EntityVisibility | undefined,
              weight: metadata?.weight,
              confidence: metadata?.confidence,
              createdAt: metadata?.createdAt
                ? (typeof metadata.createdAt === 'number' ? metadata.createdAt : metadata.createdAt.seconds * 1000)
                : Date.now(),
              updatedAt: metadata?.updatedAt
                ? (typeof metadata.updatedAt === 'number' ? metadata.updatedAt : metadata.updatedAt.seconds * 1000)
                : Date.now(),
              service: metadata?.service,
              createdBy: metadata?.createdBy,
              metadata: metadata || ({} as VerbMetadata)
            })
          } catch (error) {
            // Skip verbs that fail to load
          }
        }
      } catch (error) {
        // Skip shards that have no data
      }
    }

    // Apply pagination (Efficient slicing after early termination)
    const paginatedVerbs = collectedVerbs.slice(offset, offset + limit)
    const hasMore = collectedVerbs.length > targetCount  // Fixed >= to > (was causing infinite loop)

    return {
      items: paginatedVerbs,
      totalCount: collectedVerbs.length,  // Accurate count of collected results
      hasMore,
      nextCursor: hasMore && paginatedVerbs.length > 0
        ? paginatedVerbs[paginatedVerbs.length - 1].id
        : undefined
    }
  }

  /**
   * Get verbs with pagination and filtering
   * @param options Pagination and filtering options
   * @returns Promise that resolves to a paginated result of verbs
   */
  public async getVerbs(options?: {
    pagination?: {
      offset?: number
      limit?: number
      cursor?: string
    }
    filter?: {
      verbType?: string | string[]
      sourceId?: string | string[]
      targetId?: string | string[]
      service?: string | string[]
      metadata?: Record<string, any>
      /**
       * 8.0 visibility: tiers to exclude from results (e.g. `['internal','system']`).
       * Applied after metadata load in the full scan, so it disqualifies the
       * metadata-less graph-index fast paths (same as `subtype`).
       */
      excludeVisibility?: string[]
    }
  }): Promise<{
    items: HNSWVerbWithMetadata[]
    totalCount?: number
    hasMore: boolean
    nextCursor?: string
  }> {
    await this.ensureInitialized()

    // Set default pagination values
    const pagination = options?.pagination || {}
    const limit = pagination.limit || 100
    const offset = pagination.offset || 0
    const cursor = pagination.cursor

    // Optimize for common filter cases to avoid loading all verbs.
    // NOTE: subtype filter intentionally disqualifies the fast paths and forces
    // fallthrough to the full shard scan (which loads metadata and applies the
    // subtype check after the load). Subtype is not stored on the raw HNSWVerb;
    // it's a metadata field. The graph-index fast paths return verbs without
    // metadata, so they can't apply subtype filtering correctly. The 8.0
    // `excludeVisibility` filter (also a metadata field) disqualifies them the same way.
    if (
      options?.filter &&
      !(options.filter as any).subtype &&
      !(options.filter as { excludeVisibility?: string[] }).excludeVisibility
    ) {
      // CRITICAL VFS FIX: If filtering by sourceId + verbType (most common VFS pattern!)
      // This is the query PathResolver.getChildren() uses: getRelations({ from: dirId, type: VerbType.Contains })
      if (
        options.filter.sourceId &&
        options.filter.verbType &&
        !options.filter.targetId &&
        !options.filter.service &&
        !options.filter.metadata
      ) {
        const sourceId = Array.isArray(options.filter.sourceId)
          ? options.filter.sourceId[0]
          : options.filter.sourceId

        const verbType = Array.isArray(options.filter.verbType)
          ? options.filter.verbType[0]
          : options.filter.verbType

        // Get verbs by source, then filter by type (O(1) graph lookup + O(n) type filter)
        const verbsBySource = await this.getVerbsBySource_internal(sourceId)
        const filteredVerbs = verbsBySource.filter(v => v.verb === verbType)

        // Apply pagination
        const paginatedVerbs = filteredVerbs.slice(offset, offset + limit)
        const hasMore = offset + limit < filteredVerbs.length

        // Set next cursor if there are more items
        let nextCursor: string | undefined = undefined
        if (hasMore && paginatedVerbs.length > 0) {
          const lastItem = paginatedVerbs[paginatedVerbs.length - 1]
          nextCursor = lastItem.id
        }

        return {
          items: paginatedVerbs,
          totalCount: filteredVerbs.length,
          hasMore,
          nextCursor
        }
      }

      // If filtering by sourceId only, use the optimized method
      if (
        options.filter.sourceId &&
        !options.filter.verbType &&
        !options.filter.targetId &&
        !options.filter.service &&
        !options.filter.metadata
      ) {
        const sourceId = Array.isArray(options.filter.sourceId)
          ? options.filter.sourceId[0]
          : options.filter.sourceId

        // Get verbs by source directly
        const verbsBySource = await this.getVerbsBySource_internal(sourceId)

        // Apply pagination
        const paginatedVerbs = verbsBySource.slice(offset, offset + limit)
        const hasMore = offset + limit < verbsBySource.length

        // Set next cursor if there are more items
        let nextCursor: string | undefined = undefined
        if (hasMore && paginatedVerbs.length > 0) {
          const lastItem = paginatedVerbs[paginatedVerbs.length - 1]
          nextCursor = lastItem.id
        }

        return {
          items: paginatedVerbs,
          totalCount: verbsBySource.length,
          hasMore,
          nextCursor
        }
      }

      // If filtering by targetId only, use the optimized method
      if (
        options.filter.targetId &&
        !options.filter.verbType &&
        !options.filter.sourceId &&
        !options.filter.service &&
        !options.filter.metadata
      ) {
        const targetId = Array.isArray(options.filter.targetId)
          ? options.filter.targetId[0]
          : options.filter.targetId

        // Get verbs by target directly
        const verbsByTarget = await this.getVerbsByTarget_internal(targetId)

        // Apply pagination
        const paginatedVerbs = verbsByTarget.slice(offset, offset + limit)
        const hasMore = offset + limit < verbsByTarget.length

        // Set next cursor if there are more items
        let nextCursor: string | undefined = undefined
        if (hasMore && paginatedVerbs.length > 0) {
          const lastItem = paginatedVerbs[paginatedVerbs.length - 1]
          nextCursor = lastItem.id
        }

        return {
          items: paginatedVerbs,
          totalCount: verbsByTarget.length,
          hasMore,
          nextCursor
        }
      }

      // If filtering by verbType only, use the optimized method
      if (
        options.filter.verbType &&
        !options.filter.sourceId &&
        !options.filter.targetId &&
        !options.filter.service &&
        !options.filter.metadata
      ) {
        const verbType = Array.isArray(options.filter.verbType)
          ? options.filter.verbType[0]
          : options.filter.verbType

        // Get verbs by type directly
        const verbsByType = await this.getVerbsByType_internal(verbType)

        // Apply pagination
        const paginatedVerbs = verbsByType.slice(offset, offset + limit)
        const hasMore = offset + limit < verbsByType.length

        // Set next cursor if there are more items
        let nextCursor: string | undefined = undefined
        if (hasMore && paginatedVerbs.length > 0) {
          const lastItem = paginatedVerbs[paginatedVerbs.length - 1]
          nextCursor = lastItem.id
        }

        return {
          items: paginatedVerbs,
          totalCount: verbsByType.length,
          hasMore,
          nextCursor
        }
      }

      // Fast path for SINGLE sourceId + verbType combo (common VFS pattern)
      // This avoids the slow type-iteration fallback for VFS operations
      // NOTE: Only use fast path for single sourceId to avoid incomplete results
      const isSingleSourceId = options.filter.sourceId &&
        !Array.isArray(options.filter.sourceId)
      if (
        isSingleSourceId &&
        options.filter.verbType &&
        !options.filter.targetId &&
        !options.filter.service &&
        !options.filter.metadata
      ) {
        const sourceId = options.filter.sourceId as string
        const verbTypes = Array.isArray(options.filter.verbType)
          ? options.filter.verbType
          : [options.filter.verbType]

        prodLog.debug(`[BaseStorage] getVerbs: Using fast path for sourceId=${sourceId}, verbTypes=${verbTypes.join(',')}`)

        // Get verbs by source (uses GraphAdjacencyIndex if available)
        const verbsBySource = await this.getVerbsBySource_internal(sourceId)

        // Filter by verbType in memory (fast - usually small number of verbs per source)
        const filtered = verbsBySource.filter(v => verbTypes.includes(v.verb))

        // Apply pagination
        const paginatedVerbs = filtered.slice(offset, offset + limit)
        const hasMore = offset + limit < filtered.length

        // Set next cursor if there are more items
        let nextCursor: string | undefined = undefined
        if (hasMore && paginatedVerbs.length > 0) {
          const lastItem = paginatedVerbs[paginatedVerbs.length - 1]
          nextCursor = lastItem.id
        }

        prodLog.debug(`[BaseStorage] getVerbs: Fast path returned ${filtered.length} verbs (${paginatedVerbs.length} after pagination)`)

        return {
          items: paginatedVerbs,
          totalCount: filtered.length,
          hasMore,
          nextCursor
        }
      }
    }

    // For more complex filtering or no filtering, use a paginated approach
    // that avoids loading all verbs into memory at once
    try {
      // First, try to get a count of total verbs (if the adapter supports it)
      let totalCount: number | undefined = undefined
      try {
        // This is an optional method that adapters may implement
        if (typeof (this as any).countVerbs === 'function') {
          totalCount = await (this as any).countVerbs(options?.filter)
        }
      } catch (countError) {
        // Ignore errors from count method, it's optional
        prodLog.warn('Error getting verb count:', countError)
      }

      // Check if the adapter has a paginated method for getting verbs
      if (typeof (this as any).getVerbsWithPagination === 'function') {
        // Use the adapter's paginated method
        // Convert offset to cursor if no cursor provided (adapters use cursor for offset)
        const effectiveCursor = cursor || (offset > 0 ? offset.toString() : undefined)

        const result = await (this as any).getVerbsWithPagination({
          limit,
          cursor: effectiveCursor,
          filter: options?.filter
        })

        // Items are already offset by the adapter via cursor, no need to slice
        const items = result.items

        // CRITICAL SAFETY CHECK: Prevent infinite loops
        // If we have no items but hasMore is true, force hasMore to false
        // This prevents pagination bugs from causing infinite loops
        const safeHasMore = items.length > 0 ? result.hasMore : false

        // VALIDATION: Ensure adapter returns totalCount (prevents restart bugs)
        // If adapter forgets to return totalCount, log warning and use pre-calculated count
        let finalTotalCount = result.totalCount || totalCount
        if (result.totalCount === undefined && this.totalVerbCount > 0) {
          prodLog.warn(
            `⚠️  Storage adapter missing totalCount in getVerbsWithPagination result! ` +
            `Using pre-calculated count (${this.totalVerbCount}) as fallback. ` +
            `Please ensure your storage adapter returns totalCount: this.totalVerbCount`
          )
          finalTotalCount = this.totalVerbCount
        }

        return {
          items,
          totalCount: finalTotalCount,
          hasMore: safeHasMore,
          nextCursor: result.nextCursor
        }
      }

      // UNIVERSAL FALLBACK: Iterate through verb types with early termination (billion-scale safe)
      // This approach works for ALL storage adapters without requiring adapter-specific pagination
      prodLog.warn(
        'Using universal type-iteration strategy for getVerbs(). ' +
        'This works for all adapters but may be slower than native pagination. ' +
        'For optimal performance at scale, storage adapters can implement getVerbsWithPagination().'
      )

      const collectedVerbs: HNSWVerbWithMetadata[] = []
      let totalScanned = 0
      const targetCount = offset + limit  // We need this many verbs total (including offset)

      // BUG FIX: Check if optimization should be used
      // Only use type-skipping optimization if counts are non-zero (reliable)
      const totalVerbCountFromArray = this.verbCountsByType.reduce((sum, c) => sum + c, 0)
      const useOptimization = totalVerbCountFromArray > 0

      // BUG FIX: Pre-compute requested verb types to avoid skipping them
      // When a specific verbType filter is provided, we MUST check that type
      // even if verbCountsByType shows 0 (counts can be stale after restart)
      const requestedVerbTypes = options?.filter?.verbType
      const requestedVerbTypesSet = requestedVerbTypes
        ? new Set(Array.isArray(requestedVerbTypes) ? requestedVerbTypes : [requestedVerbTypes])
        : null

      // Iterate through all 127 verb types (Stage 3 CANONICAL) with early termination
      // OPTIMIZATION: Skip types with zero count (only if counts are reliable)
      for (let i = 0; i < VERB_TYPE_COUNT && collectedVerbs.length < targetCount; i++) {
        const type = TypeUtils.getVerbFromIndex(i)

        // FIX: Never skip a type that's explicitly requested in the filter
        // This fixes VFS bug where Contains relationships were skipped after restart
        // when verbCountsByType[Contains] was 0 due to stale statistics
        const isRequestedType = requestedVerbTypesSet?.has(type) ?? false
        const countIsZero = this.verbCountsByType[i] === 0

        // Skip empty types for performance (but only if optimization is enabled AND not requested)
        if (useOptimization && countIsZero && !isRequestedType) {
          continue
        }

        // Log when we DON'T skip a requested type that would have been skipped
        // This helps diagnose stale statistics issues in production
        if (useOptimization && countIsZero && isRequestedType) {
          prodLog.debug(
            `[BaseStorage] getVerbs: NOT skipping type=${type} despite count=0 (type was explicitly requested). ` +
            `Statistics may be stale - consider running rebuildTypeCounts().`
          )
        }

        try {
          const verbsOfType = await this.getVerbsByType_internal(type)

          // Apply filtering inline (memory efficient)
          for (const verb of verbsOfType) {
            // Apply filters if specified
            if (options?.filter) {
              // Filter by sourceId
              if (options.filter.sourceId) {
                const sourceIds = Array.isArray(options.filter.sourceId)
                  ? options.filter.sourceId
                  : [options.filter.sourceId]
                if (!sourceIds.includes(verb.sourceId)) {
                  continue
                }
              }

              // Filter by targetId
              if (options.filter.targetId) {
                const targetIds = Array.isArray(options.filter.targetId)
                  ? options.filter.targetId
                  : [options.filter.targetId]
                if (!targetIds.includes(verb.targetId)) {
                  continue
                }
              }

              // Filter by verbType
              if (options.filter.verbType) {
                const verbTypes = Array.isArray(options.filter.verbType)
                  ? options.filter.verbType
                  : [options.filter.verbType]
                if (!verbTypes.includes(verb.verb)) {
                  continue
                }
              }
            }

            // Verb passed filters - add to collection
            collectedVerbs.push(verb)

            // Early termination: stop when we have enough for offset + limit
            if (collectedVerbs.length >= targetCount) {
              break
            }
          }

          totalScanned += verbsOfType.length
        } catch (error) {
          // Ignore errors for types with no verbs (directory may not exist)
          // This is expected for types that haven't been used yet
        }
      }

      // Apply pagination (slice for offset)
      const paginatedVerbs = collectedVerbs.slice(offset, offset + limit)
      const hasMore = collectedVerbs.length > targetCount  // Fixed >= to > (was causing infinite loop)

      return {
        items: paginatedVerbs,
        totalCount: collectedVerbs.length,  // Accurate count of filtered results
        hasMore,
        nextCursor: hasMore && paginatedVerbs.length > 0
          ? paginatedVerbs[paginatedVerbs.length - 1].id
          : undefined
      }
    } catch (error) {
      prodLog.error('Error getting verbs with pagination:', error)
      return {
        items: [],
        totalCount: 0,
        hasMore: false
      }
    }
  }

  /**
   * Delete a verb from storage
   */
  public async deleteVerb(id: string): Promise<void> {
    await this.ensureInitialized()

    // Delete both the vector file and metadata file (2-file system)
    await this.deleteVerb_internal(id)

    // Delete metadata file (if it exists)
    try {
      await this.deleteVerbMetadata(id)
    } catch (error) {
      // Ignore if metadata file doesn't exist
      prodLog.debug(`No metadata file to delete for verb ${id}`)
    }
  }
  /**
   * Get graph index (lazy initialization with concurrent access protection)
   * Fixed race condition where concurrent calls could trigger multiple rebuilds
   */
  async getGraphIndex(): Promise<GraphAdjacencyIndex> {
    // If already initialized, return immediately
    if (this.graphIndex) {
      return this.graphIndex
    }

    // If initialization in progress, wait for it
    if (this.graphIndexPromise) {
      return this.graphIndexPromise
    }

    // Start initialization (only first caller reaches here)
    this.graphIndexPromise = this._initializeGraphIndex()

    try {
      const index = await this.graphIndexPromise
      return index
    } finally {
      // Clear promise after completion (success or failure)
      this.graphIndexPromise = undefined
    }
  }

  /**
   * Internal method to initialize graph index (called once by getGraphIndex)
   * @private
   */
  private async _initializeGraphIndex(): Promise<GraphAdjacencyIndex> {
    prodLog.info('Initializing GraphAdjacencyIndex...')
    this.graphIndex = new GraphAdjacencyIndex(this)

    // Check if we need to rebuild from existing data
    const sampleVerbs = await this.getVerbs({ pagination: { limit: 1 } })
    if (sampleVerbs.items.length > 0) {
      prodLog.info('Found existing verbs, rebuilding graph index...')
      await this.graphIndex.rebuild()
    }

    return this.graphIndex
  }
  /**
   * Clear all data from storage
   * This method should be implemented by each specific adapter
   */
  public abstract clear(): Promise<void>

  /**
   * Removed checkClearMarker() and createClearMarker() abstract methods
   * COW is now always enabled - marker files are no longer used
   */

  /**
   * Get information about storage usage and capacity
   * This method should be implemented by each specific adapter
   */
  public abstract getStorageStatus(): Promise<{
    type: string
    used: number
    quota: number | null
    details?: Record<string, any>
  }>

  /**
   * Write a JSON object to a specific path in storage
   * This is a primitive operation that all adapters must implement
   * @param path - Full path including filename (e.g., "_system/statistics.json" or "entities/nouns/metadata/3f/3fa85f64-....json")
   * @param data - Data to write (will be JSON.stringify'd)
   * @protected
   */
  protected abstract writeObjectToPath(path: string, data: any): Promise<void>

  /**
   * Read a JSON object from a specific path in storage
   * This is a primitive operation that all adapters must implement
   * @param path - Full path including filename
   * @returns The parsed JSON object, or null if not found
   * @protected
   */
  protected abstract readObjectFromPath(path: string): Promise<any | null>

  /**
   * Delete an object from a specific path in storage
   * This is a primitive operation that all adapters must implement
   * @param path - Full path including filename
   * @protected
   */
  protected abstract deleteObjectFromPath(path: string): Promise<void>

  /**
   * List all object paths under a given prefix
   * This is a primitive operation that all adapters must implement
   * @param prefix - Directory prefix to list (e.g., "entities/nouns/metadata/3f/")
   * @returns Array of full paths
   * @protected
   */
  protected abstract listObjectsUnderPath(prefix: string): Promise<string[]>

  // Raw binary-blob primitive (saveBinaryBlob/loadBinaryBlob/deleteBinaryBlob/
  // getBinaryBlobPath) is declared abstract on BaseStorageAdapter — the class
  // that `implements StorageAdapter` — alongside the other public storage
  // methods. Each concrete adapter implements it. See BaseStorageAdapter for the
  // contract and the shared `_blobs/<key>.bin` key→location convention.

  /**
   * Save metadata to storage (now typed)
   * Routes to correct location (system or entity) based on key format
   */
  public async saveMetadata(id: string, metadata: NounMetadata): Promise<void> {
    await this.ensureInitialized()
    const keyInfo = this.analyzeKey(id, 'system')
    return this.writeObjectToBranch(keyInfo.fullPath, metadata)
  }

  /**
   * Get metadata from storage (now typed)
   * Routes to correct location (system or entity) based on key format
   */
  public async getMetadata(id: string): Promise<NounMetadata | null> {
    await this.ensureInitialized()
    const keyInfo = this.analyzeKey(id, 'system')

    // Try new distributed path first
    const data = await this.readWithInheritance(keyInfo.fullPath)
    if (data !== null) return data

    // Backward compat: if key was distributed, fall back to legacy flat path
    if (keyInfo.shardId !== null) {
      const legacyPath = `${SYSTEM_DIR}/${id}.json`
      return this.readWithInheritance(legacyPath)
    }

    return null
  }

  /**
   * Save noun metadata to storage (now typed)
   * Routes to correct sharded location based on UUID
   */
  public async saveNounMetadata(id: string, metadata: NounMetadata): Promise<void> {
    // Validate noun type in metadata - storage boundary protection
    validateNounType(metadata.noun)
    return this.saveNounMetadata_internal(id, metadata)
  }

  /**
   * Internal method for saving noun metadata (now typed)
   * Uses routing logic to handle both UUIDs (sharded) and system keys (unsharded)
   *
   * CRITICAL: Count synchronization happens here
   * This ensures counts are updated AFTER metadata exists, fixing the race condition
   * where storage adapters tried to read metadata before it was saved.
   *
   * @protected
   */
  protected async saveNounMetadata_internal(id: string, metadata: NounMetadata): Promise<void> {
    await this.ensureInitialized()

    // ID-first path - no type needed!
    const path = getNounMetadataPath(id)

    // Determine if this is a new entity by checking if metadata already exists
    const existingMetadata = await this.readWithInheritance(path)
    const isNew = !existingMetadata

    // Save the metadata (COW-aware - writes to branch-specific path)
    await this.writeObjectToBranch(path, metadata)

    // Record the id→type mapping so `saveNoun_internal()` (which receives only
    // an HNSWNoun and has no metadata access in its signature) can attribute
    // the entity to the right slot in `nounCountsByType`. This is what makes
    // `_system/type-statistics.json` honest. Updates the cache even for
    // existing entities so a type change via `update()` is reflected.
    if (metadata.noun) {
      this.nounTypeByIdCache.set(id, metadata.noun as NounType)
    }

    // Track subtype changes: on type or subtype change via update(), decrement
    // the prior bucket before incrementing the new one. Symmetric with the
    // delete-path decrement in `deleteNounMetadata()`.
    const priorSubtype = this.nounSubtypeByIdCache.get(id)
    const priorTypeForSubtype = isNew ? undefined : (existingMetadata?.noun as NounType | undefined)
    const newSubtype = typeof metadata.subtype === 'string' && metadata.subtype.length > 0
      ? metadata.subtype as string
      : undefined
    const newType = metadata.noun as NounType | undefined

    if (priorSubtype && priorTypeForSubtype && (priorSubtype !== newSubtype || priorTypeForSubtype !== newType)) {
      this.decrementSubtypeCount(priorTypeForSubtype, priorSubtype)
    }
    if (newSubtype && newType && (isNew || priorSubtype !== newSubtype || priorTypeForSubtype !== newType)) {
      this.incrementSubtypeCount(newType, newSubtype)
      this.nounSubtypeByIdCache.set(id, newSubtype)
    } else if (!newSubtype && priorSubtype) {
      // Subtype cleared by an update — drop the cache entry (decrement already done above)
      this.nounSubtypeByIdCache.delete(id)
    }

    // Visibility (8.0): only public entities count toward the user-facing totals.
    // Warm `nounVisibilityByIdCache` so `saveNoun_internal()` (no metadata access)
    // can gate the `nounCountsByType` increment, and `deleteNounMetadata()` can gate
    // the matching decrement. Sparse — public ids get no entry.
    const newVisibility = metadata.visibility
    const wasCounted = isNew ? false : isCountedVisibility(existingMetadata?.visibility)
    const isCounted = isCountedVisibility(newVisibility)
    if (isCounted) {
      this.nounVisibilityByIdCache.delete(id)
    } else {
      this.nounVisibilityByIdCache.set(id, newVisibility as EntityVisibility)
    }

    // CRITICAL FIX: Increment count for new entities
    // This runs AFTER metadata is saved, guaranteeing type information is available
    // Uses synchronous increment since storage operations are already serialized
    // Fixes Bug #1: Count synchronization failure during add() and import()
    // 8.0: skip the user-facing total for internal/system entities (counts.json + getNounCount()).
    if (isNew && metadata.noun && isCounted) {
      this.incrementEntityCount(metadata.noun)
      // Persist counts asynchronously (fire and forget)
      this.scheduleCountPersist().catch(() => {
        // Ignore persist errors - will retry on next operation
      })
    } else if (!isNew && metadata.noun && wasCounted !== isCounted) {
      // Visibility flipped on update(): move the entity in/out of the user-facing total
      // (counts.json / getNounCount()). `nounCountsByType` is gated independently in
      // `saveNoun_internal()` off the cache warmed just above, so it is not touched here.
      if (isCounted) {
        this.incrementEntityCount(metadata.noun)
      } else {
        this.decrementEntityCount(metadata.noun)
      }
      this.scheduleCountPersist().catch(() => {})
    }
  }

  /**
   * Get noun metadata from storage (METADATA-ONLY, NO VECTORS)
   *
   * **Performance**: Direct O(1) ID-first lookup - NO type search needed!
   * - **All lookups**: 1 read, ~500ms on cloud (consistent performance)
   * - **No cache needed**: Type is in the metadata, not the path
   * - **No type search**: ID-first paths eliminate 42-type search entirely
   *
   * **Clean architecture**:
   * - Path: `entities/nouns/{SHARD}/{ID}/metadata.json`
   * - Type is just a field in metadata (`noun: "document"`)
   * - MetadataIndex handles type queries (no path scanning needed)
   * - Scales to billions without any overhead
   *
   * **Performance**: Fast path for metadata-only reads
   * - **Speed**: 10ms vs 43ms (76-81% faster than getNoun)
   * - **Bandwidth**: 300 bytes vs 6KB (95% less)
   * - **Memory**: 300 bytes vs 6KB (87% less)
   *
   * **What's included**:
   * - All entity metadata (data, type, timestamps, confidence, weight)
   * - Custom user fields
   * - VFS metadata (_vfs.path, _vfs.size, etc.)
   *
   * **What's excluded**:
   * - 384-dimensional vector embeddings
   * - HNSW graph connections
   *
   * **Usage**:
   * - VFS operations (readFile, stat, readdir) - 100% of cases
   * - Existence checks: `if (await storage.getNounMetadata(id))`
   * - Metadata inspection: `metadata.data`, `metadata.noun` (type)
   * - Relationship traversal: Just need IDs, not vectors
   *
   * **When to use getNoun() instead**:
   * - Computing similarity on this specific entity
   * - Manual vector operations
   * - HNSW graph traversal
   *
   * @param id - Entity ID to retrieve metadata for
   * @returns Metadata or null if not found
   *
   * @performance
   * - O(1) direct ID lookup - always 1 read (~500ms on cloud, ~10ms local)
   * - No caching complexity
   * - No type search fallbacks
   * - Works in distributed systems without sync issues
   *
   * Type-first paths (removed)
   * Promoted to fast path for brain.get() optimization
   * CLEAN FIX: ID-first paths eliminate all type-search complexity
   */
  public async getNounMetadata(id: string): Promise<NounMetadata | null> {
    await this.ensureInitialized()

    // Clean, simple, O(1) lookup - no type needed!
    const path = getNounMetadataPath(id)
    return this.readWithInheritance(path)
  }

  /**
   * Batch fetch noun metadata from storage
   *
   * **Performance**: Reduces N sequential calls → 1-2 batch calls
   * - Local storage: N × 10ms → 1 × 10ms parallel (N× faster)
   * - Cloud storage: N × 300ms → 1 × 300ms batch (N× faster)
   *
   * **Use cases:**
   * - VFS tree traversal (fetch all children at once)
   * - brain.find() result hydration (batch load entities)
   * - brain.getRelations() target entities (eliminate N+1)
   * - Import operations (batch existence checks)
   *
   * @param ids Array of entity IDs to fetch
   * @returns Map of id → metadata (only successful fetches included)
   *
   * @example
   * ```typescript
   * // Before (N+1 pattern)
   * for (const id of ids) {
   *   const metadata = await storage.getNounMetadata(id)  // N calls
   * }
   *
   * // After (batched)
   * const metadataMap = await storage.getNounMetadataBatch(ids)  // 1 call
   * for (const id of ids) {
   *   const metadata = metadataMap.get(id)
   * }
   * ```
   *
   */
  public async getNounMetadataBatch(ids: string[]): Promise<Map<string, NounMetadata>> {
    await this.ensureInitialized()

    const results = new Map<string, NounMetadata>()
    if (ids.length === 0) return results

    // ID-first paths - no type grouping or search needed!
    // Build direct paths for all IDs
    const pathsToFetch: Array<{ path: string; id: string }> = ids.map(id => ({
      path: getNounMetadataPath(id),
      id
    }))

    // Batch read all paths (uses adapter's native batch API or parallel fallback)
    const batchResults = await this.readBatchWithInheritance(pathsToFetch.map(p => p.path))

    // Map results back to IDs
    for (const { path, id } of pathsToFetch) {
      const metadata = batchResults.get(path)
      if (metadata) {
        results.set(id, metadata)
      }
    }

    return results
  }

  /**
   * Batch get multiple nouns with vectors
   *
   * **Performance**: Eliminates N+1 pattern for vector loading
   * - Current: N × getNoun() = N × 50ms on GCS = 500ms for 10 entities
   * - Batched: 1 × getNounBatch() = 1 × 50ms on GCS = 50ms (**10x faster**)
   *
   * **Use cases:**
   * - batchGet() with includeVectors: true
   * - Loading entities for similarity computation
   * - Pre-loading vectors for batch processing
   *
   * @param ids Array of entity IDs to fetch (with vectors)
   * @returns Map of id → HNSWNounWithMetadata (only successful reads included)
   *
   */
  public async getNounBatch(ids: string[]): Promise<Map<string, HNSWNounWithMetadata>> {
    await this.ensureInitialized()

    const results = new Map<string, HNSWNounWithMetadata>()
    if (ids.length === 0) return results

    // Batch-fetch vectors and metadata in parallel
    // Build paths for vectors
    const vectorPaths: Array<{ path: string; id: string }> = ids.map(id => ({
      path: getNounVectorPath(id),
      id
    }))

    // Build paths for metadata
    const metadataPaths: Array<{ path: string; id: string }> = ids.map(id => ({
      path: getNounMetadataPath(id),
      id
    }))

    // Batch read vectors and metadata in parallel
    const [vectorResults, metadataResults] = await Promise.all([
      this.readBatchWithInheritance(vectorPaths.map(p => p.path)),
      this.readBatchWithInheritance(metadataPaths.map(p => p.path))
    ])

    // Combine vectors + metadata into HNSWNounWithMetadata
    for (const { path: vectorPath, id } of vectorPaths) {
      const vectorData = vectorResults.get(vectorPath)
      const metadataPath = getNounMetadataPath(id)
      const metadataData = metadataResults.get(metadataPath)

      if (vectorData && metadataData) {
        // Deserialize noun
        const noun = this.deserializeNoun(vectorData)

        // Extract standard fields to top-level
        const { noun: nounType, subtype, createdAt, updatedAt, confidence, weight, service, data, createdBy, _rev, ...customMetadata } = metadataData

        results.set(id, {
          id: noun.id,
          vector: noun.vector,
          connections: noun.connections,
          level: noun.level,
          // Standard fields at top-level
          type: (nounType as NounType) || NounType.Thing,
          subtype: subtype as string | undefined,
          createdAt: (createdAt as number) || Date.now(),
          updatedAt: (updatedAt as number) || Date.now(),
          confidence: confidence as number | undefined,
          weight: weight as number | undefined,
          service: service as string | undefined,
          data: data as Record<string, any> | undefined,
          createdBy,
          _rev: typeof _rev === 'number' ? _rev : 1,
          // Only custom user fields remain in metadata
          metadata: customMetadata
        })
      }
    }

    return results
  }

  /**
   * Batch read multiple storage paths with COW inheritance support
   *
   * Core batching primitive that all batch operations build upon.
   * Handles write cache, branch inheritance, and adapter-specific batching.
   *
   * **Performance**:
   * - Uses adapter's native batch API when available (GCS, S3, Azure)
   * - Falls back to parallel reads for non-batch adapters
   * - Respects rate limits via StorageBatchConfig
   *
   * @param paths Array of storage paths to read
   * @param branch Optional branch (defaults to current branch)
   * @returns Map of path → data (only successful reads included)
   *
   * @protected - Available to subclasses and batch operations
   */
  protected async readBatchWithInheritance(
    paths: string[],
    branch?: string
  ): Promise<Map<string, any>> {
    if (paths.length === 0) return new Map()

    const targetBranch = branch || this.currentBranch || 'main'
    const results = new Map<string, any>()

    // Resolve all paths to branch-specific paths
    const branchPaths = paths.map(path => ({
      original: path,
      resolved: this.resolveBranchPath(path, targetBranch)
    }))

    // Step 1: Check write cache first (synchronous, instant)
    const pathsToFetch: string[] = []
    const pathMapping = new Map<string, string>()  // resolved → original

    for (const { original, resolved } of branchPaths) {
      const cachedData = this.writeCache.get(resolved)
      if (cachedData !== undefined) {
        results.set(original, cachedData)
      } else {
        pathsToFetch.push(resolved)
        pathMapping.set(resolved, original)
      }
    }

    if (pathsToFetch.length === 0) {
      return results  // All in write cache
    }

    // Step 2: Batch read from adapter
    // Check if adapter supports native batch operations
    const batchData = await this.readBatchFromAdapter(pathsToFetch)

    // Step 3: Process results and handle inheritance for missing items
    const missingPaths: string[] = []

    for (const [resolvedPath, data] of batchData.entries()) {
      const originalPath = pathMapping.get(resolvedPath)
      if (originalPath && data !== null) {
        results.set(originalPath, data)
      }
    }

    // Identify paths that weren't found
    for (const resolvedPath of pathsToFetch) {
      if (!batchData.has(resolvedPath) || batchData.get(resolvedPath) === null) {
        missingPaths.push(pathMapping.get(resolvedPath)!)
      }
    }

    // Step 4: Handle COW inheritance for missing items (if not on main branch)
    if (targetBranch !== 'main' && missingPaths.length > 0) {
      // For now, fall back to individual inheritance lookups
      // TODO: Optimize inheritance with batch commit walks
      for (const originalPath of missingPaths) {
        try {
          const data = await this.readWithInheritance(originalPath, targetBranch)
          if (data !== null) {
            results.set(originalPath, data)
          }
        } catch (error) {
          // Skip failed reads (they won't be in results map)
        }
      }
    }

    return results
  }

  /**
   * Adapter-level batch read with automatic batching strategy
   *
   * Uses adapter's native batch API when available:
   * - GCS: batch API (100 ops)
   * - S3/R2: batch operations (1000 ops)
   * - Azure: batch API (100 ops)
   * - Others: parallel reads via Promise.all()
   *
   * Automatically chunks large batches based on adapter's maxBatchSize.
   *
   * @param paths Array of resolved storage paths
   * @returns Map of path → data
   *
   * @private
   */
  private async readBatchFromAdapter(paths: string[]): Promise<Map<string, any>> {
    if (paths.length === 0) return new Map()

    // Check if this class implements batch operations (will be added to cloud adapters)
    const selfWithBatch = this as any

    if (typeof selfWithBatch.readBatch === 'function') {
      // Adapter has native batch support - use it
      try {
        return await selfWithBatch.readBatch(paths)
      } catch (error) {
        // Fall back to parallel reads on batch failure
        prodLog.warn(`Batch read failed, falling back to parallel: ${error}`)
      }
    }

    // Fallback: Parallel individual reads
    // Respect adapter's maxConcurrent limit
    const batchConfig = this.getBatchConfig()
    const chunkSize = batchConfig.maxConcurrent || 50

    const results = new Map<string, any>()

    for (let i = 0; i < paths.length; i += chunkSize) {
      const chunk = paths.slice(i, i + chunkSize)

      const chunkResults = await Promise.allSettled(
        chunk.map(async path => ({
          path,
          data: await this.readObjectFromPath(path)
        }))
      )

      for (const result of chunkResults) {
        if (result.status === 'fulfilled' && result.value.data !== null) {
          results.set(result.value.path, result.value.data)
        }
      }
    }

    return results
  }

  /**
   * Get batch configuration for this storage adapter
   *
   * Override in subclasses to provide adapter-specific batch limits.
   * Defaults to conservative limits for safety.
   *
   * @public - Inherited from BaseStorageAdapter
   */
  public getBatchConfig(): StorageBatchConfig {
    // Conservative defaults - adapters should override with their actual limits
    return {
      maxBatchSize: 100,
      batchDelayMs: 0,
      maxConcurrent: 50,
      supportsParallelWrites: true,
      rateLimit: {
        operationsPerSecond: 1000,
        burstCapacity: 5000
      }
    }
  }

  /**
   * Delete noun metadata from storage (ID-first, O(1) delete)
   */
  public async deleteNounMetadata(id: string): Promise<void> {
    await this.ensureInitialized()

    // Direct O(1) delete with ID-first path
    const path = getNounMetadataPath(id)
    await this.deleteObjectFromBranch(path)

    // Prune the id→type cache so a future re-add of the same id (e.g. churn
    // during tests) doesn't see a stale type. Lookup the prior type and
    // decrement `nounCountsByType` so type-statistics stay honest across
    // deletes; symmetric with the increment in `saveNounMetadata_internal()`.
    const priorType = this.nounTypeByIdCache.get(id)
    // 8.0 visibility: an internal/system entity was never added to `nounCountsByType`
    // (gated in `saveNoun_internal()`), so it must not be decremented here either.
    const priorCounted = isCountedVisibility(this.nounVisibilityByIdCache.get(id))
    this.nounVisibilityByIdCache.delete(id)
    if (priorType) {
      this.nounTypeByIdCache.delete(id)
      if (priorCounted) {
        const idx = TypeUtils.getNounIndex(priorType)
        if (this.nounCountsByType[idx] > 0) {
          this.nounCountsByType[idx]--
        }
      }

      // Symmetric subtype decrement
      const priorSubtype = this.nounSubtypeByIdCache.get(id)
      if (priorSubtype) {
        this.nounSubtypeByIdCache.delete(id)
        this.decrementSubtypeCount(priorType, priorSubtype)
      }
    }
  }

  /**
   * Save verb metadata to storage (now typed)
   * Routes to correct sharded location based on UUID
   */
  public async saveVerbMetadata(id: string, metadata: VerbMetadata): Promise<void> {
    // Note: verb type is in HNSWVerb, not metadata
    return this.saveVerbMetadata_internal(id, metadata)
  }

  /**
   * Internal method for saving verb metadata (now typed)
   * Uses ID-first paths (must match getVerbMetadata)
   *
   * CRITICAL: Count synchronization happens here
   * This ensures verb counts are updated AFTER metadata exists, fixing the race condition
   * where storage adapters tried to read metadata before it was saved.
   *
   * Note: Verb type is now stored in both HNSWVerb (vector file) and VerbMetadata for count tracking
   *
   * @protected
   */
  protected async saveVerbMetadata_internal(id: string, metadata: VerbMetadata): Promise<void> {
    await this.ensureInitialized()

    // Extract verb type from metadata for ID-first path
    const verbType = (metadata as any).verb as VerbType | undefined

    if (!verbType) {
      // Backward compatibility: fallback to old path if no verb type
      const keyInfo = this.analyzeKey(id, 'verb-metadata')
      await this.writeObjectToBranch(keyInfo.fullPath, metadata)
      return
    }

    // Use ID-first path
    const path = getVerbMetadataPath(id)

    // Determine if this is a new verb by checking if metadata already exists
    const existingMetadata = await this.readWithInheritance(path)
    const isNew = !existingMetadata

    // Save the metadata (COW-aware - writes to branch-specific path)
    await this.writeObjectToBranch(path, metadata)

    // Cache verb type for faster lookups

    // Track verb subtype changes: on type or subtype change via updateRelation(),
    // decrement the prior bucket before incrementing the new one. Symmetric with
    // the delete-path decrement in `deleteVerbMetadata()`.
    const priorEntry = this.verbSubtypeByIdCache.get(id)
    const priorVerbForSubtype = isNew ? undefined : (existingMetadata?.verb as VerbType | undefined)
    const newSubtype = typeof metadata.subtype === 'string' && metadata.subtype.length > 0
      ? metadata.subtype as string
      : undefined

    if (priorEntry && (priorEntry.subtype !== newSubtype || priorEntry.verb !== verbType)) {
      this.decrementVerbSubtypeCount(priorEntry.verb, priorEntry.subtype)
    } else if (!priorEntry && priorVerbForSubtype && !isNew) {
      // Edge case: cache miss but metadata existed with a subtype (e.g. reader process startup).
      const priorSubFromMeta = (existingMetadata as any)?.subtype as string | undefined
      if (priorSubFromMeta && (priorSubFromMeta !== newSubtype || priorVerbForSubtype !== verbType)) {
        this.decrementVerbSubtypeCount(priorVerbForSubtype, priorSubFromMeta)
      }
    }
    if (newSubtype) {
      if (!priorEntry || priorEntry.subtype !== newSubtype || priorEntry.verb !== verbType) {
        this.incrementVerbSubtypeCount(verbType, newSubtype)
      }
      this.verbSubtypeByIdCache.set(id, { verb: verbType, subtype: newSubtype })
    } else if (priorEntry) {
      // Subtype cleared by an update — drop the cache entry (decrement done above)
      this.verbSubtypeByIdCache.delete(id)
    }

    // Visibility (8.0): verb mirror of the noun count gating. Warm
    // `verbVisibilityByIdCache` so `deleteVerbMetadata()` can prune it. Sparse —
    // public edges get no entry.
    //
    // NOTE on `verbCountsByType`: unlike the noun path, `saveVerb_internal()` runs
    // BEFORE this method (relate() saves the verb vector first) and has already done
    // an UNCONDITIONAL `verbCountsByType[idx]++`. We therefore COMPENSATE here: for a
    // new hidden edge, undo that bump. `updateRelation()` does not re-run
    // `saveVerb_internal()`, so on a visibility flip we adjust the bucket directly.
    const newVisibility = metadata.visibility
    const wasCounted = isNew ? false : isCountedVisibility(existingMetadata?.visibility)
    const isCounted = isCountedVisibility(newVisibility)
    if (isCounted) {
      this.verbVisibilityByIdCache.delete(id)
    } else {
      this.verbVisibilityByIdCache.set(id, newVisibility as EntityVisibility)
    }
    const verbTypeIdx = TypeUtils.getVerbIndex(verbType)

    // CRITICAL FIX: Increment verb count for new relationships
    // This runs AFTER metadata is saved
    // Uses synchronous increment since storage operations are already serialized
    // Fixes Bug #2: Count synchronization failure during relate() and import()
    // 8.0: skip the user-facing total for internal/system edges (counts.json + getVerbCount()).
    if (isNew) {
      if (isCounted) {
        this.incrementVerbCount(verbType)
      } else {
        // Hidden edge: undo the unconditional bump from saveVerb_internal().
        if (this.verbCountsByType[verbTypeIdx] > 0) this.verbCountsByType[verbTypeIdx]--
      }
      // Persist counts asynchronously (fire and forget)
      this.scheduleCountPersist().catch(() => {
        // Ignore persist errors - will retry on next operation
      })
    } else if (wasCounted !== isCounted) {
      // Visibility flipped on updateRelation() (saveVerb_internal did not run): move the
      // edge in/out of both the user-facing total and the per-type bucket.
      if (isCounted) {
        this.incrementVerbCount(verbType)
        this.verbCountsByType[verbTypeIdx]++
      } else {
        this.decrementVerbCount(verbType)
        if (this.verbCountsByType[verbTypeIdx] > 0) this.verbCountsByType[verbTypeIdx]--
      }
      this.scheduleCountPersist().catch(() => {})
    }
  }

  /**
   * Get verb metadata from storage (now typed)
   * Uses ID-first paths (must match saveVerbMetadata_internal)
   */
  public async getVerbMetadata(id: string): Promise<VerbMetadata | null> {
    await this.ensureInitialized()

    // Direct O(1) lookup with ID-first paths - no type search needed!
    const path = getVerbMetadataPath(id)

    try {
      const metadata = await this.readWithInheritance(path)
      return metadata || null
    } catch (error) {
      // Entity not found
      return null
    }
  }

  /**
   * Delete verb metadata from storage (ID-first, O(1) delete)
   */
  public async deleteVerbMetadata(id: string): Promise<void> {
    await this.ensureInitialized()

    // Direct O(1) delete with ID-first path
    const path = getVerbMetadataPath(id)
    await this.deleteObjectFromBranch(path)

    // Symmetric verb subtype decrement
    const priorEntry = this.verbSubtypeByIdCache.get(id)
    if (priorEntry) {
      this.verbSubtypeByIdCache.delete(id)
      this.decrementVerbSubtypeCount(priorEntry.verb, priorEntry.subtype)
    }
    // 8.0 visibility: prune the cache entry (verb deletes don't touch verbCountsByType
    // in this path, mirroring the existing verb-subtype delete semantics).
    this.verbVisibilityByIdCache.delete(id)
  }

  // ============================================================================
  // ID-FIRST HELPER METHODS
  // Direct O(1) ID lookups - no type needed!
  // Clean, simple architecture for billion-scale performance
  // ============================================================================

  /**
   * Load type statistics from storage
   * Rebuilds type counts if needed (called during init)
   *
   * Auto-detects the 7.20.0–7.21.0 poisoned-statistics signature: every
   * noun attributed to `'thing'` because the old `getNounType()` was hardcoded.
   * If detected, runs `rebuildTypeCounts()` once to rewrite the file with
   * correct per-type counts derived from on-disk metadata. Logged loudly.
   */
  protected async loadTypeStatistics(): Promise<void> {
    try {
      const stats = await this.readObjectFromPath(`${SYSTEM_DIR}/type-statistics.json`)

      if (stats) {
        // Restore counts from saved statistics
        if (stats.nounCounts && stats.nounCounts.length === NOUN_TYPE_COUNT) {
          this.nounCountsByType = new Uint32Array(stats.nounCounts)
        }
        if (stats.verbCounts && stats.verbCounts.length === VERB_TYPE_COUNT) {
          this.verbCountsByType = new Uint32Array(stats.verbCounts)
        }

        if (await this.detectPoisonedTypeStatistics()) {
          prodLog.warn(
            '[BaseStorage] Detected poisoned type-statistics.json signature ' +
            '(all nouns attributed to \'thing\' — symptom of pre-7.22 getNounType ' +
            'hardcode). Rebuilding counts from on-disk metadata.'
          )
          await this.rebuildTypeCounts()
        }
      }
    } catch (error) {
      // No existing type statistics, starting fresh
    }
  }

  /**
   * Detect the 7.20.0–7.21.0 poisoned-statistics signature.
   *
   * The defect: the old `getNounType()` returned hardcoded `'thing'`, so
   * `_system/type-statistics.json` ended up with `nounCounts[thing] === N`
   * and every other index `=== 0`, regardless of the actual mix on disk.
   *
   * Heuristic: nounCounts has at least 2 non-thing entities on disk (so the
   * file *should* show multiple non-zero buckets) but only the `thing`
   * bucket is non-zero. We bound the on-disk check with `limit: 3` so this
   * never costs more than a couple of cheap reads.
   *
   * Returns false (no self-heal needed) for genuinely thing-only stores or
   * empty stores.
   */
  private async detectPoisonedTypeStatistics(): Promise<boolean> {
    const thingIdx = TypeUtils.getNounIndex('thing' as NounType)
    if (thingIdx < 0) return false

    let nonZeroBuckets = 0
    let thingCount = 0
    for (let i = 0; i < this.nounCountsByType.length; i++) {
      if (this.nounCountsByType[i] > 0) {
        nonZeroBuckets++
        if (i === thingIdx) thingCount = this.nounCountsByType[i]
      }
    }

    // Only one bucket populated, and it's 'thing' with ≥2 entities — suspicious.
    if (nonZeroBuckets !== 1 || thingCount < 2) return false

    // Cross-check: sample a few metadata files. If any non-'thing' types
    // show up, we're confirmed poisoned. If only 'thing' types appear in the
    // sample, this is a genuine thing-only store and we leave the file alone.
    try {
      const sample = await this.getNouns({ pagination: { offset: 0, limit: 3 } })
      for (const noun of sample.items) {
        const type = await this.getNounTypeFromStorageAsync(noun.id)
        if (type && type !== ('thing' as NounType)) {
          return true
        }
      }
    } catch {
      // If we can't read the metadata, don't trigger a rebuild — leave state alone.
    }
    return false
  }

  /**
   * Save type statistics to storage
   * Periodically called when counts are updated
   */
  protected async saveTypeStatistics(): Promise<void> {
    const stats = {
      nounCounts: Array.from(this.nounCountsByType),
      verbCounts: Array.from(this.verbCountsByType),
      updatedAt: Date.now()
    }

    await this.writeObjectToPath(`${SYSTEM_DIR}/type-statistics.json`, stats)
  }

  /**
   * Increment the (type, subtype) count, creating the inner map on first use.
   * Indexed by NounType index so it lines up with `nounCountsByType` and can
   * be reduced into per-type totals without re-keying.
   */
  protected incrementSubtypeCount(type: NounType, subtype: string): void {
    const typeIdx = TypeUtils.getNounIndex(type)
    if (typeIdx < 0) return
    let inner = this.subtypeCountsByType.get(typeIdx)
    if (!inner) {
      inner = new Map<string, number>()
      this.subtypeCountsByType.set(typeIdx, inner)
    }
    inner.set(subtype, (inner.get(subtype) || 0) + 1)
  }

  /**
   * Decrement the (type, subtype) count. Deletes the inner key when it reaches
   * 0 and the outer entry when its inner map is empty, so the persisted shape
   * stays compact across heavy churn.
   */
  protected decrementSubtypeCount(type: NounType, subtype: string): void {
    const typeIdx = TypeUtils.getNounIndex(type)
    if (typeIdx < 0) return
    const inner = this.subtypeCountsByType.get(typeIdx)
    if (!inner) return
    const next = (inner.get(subtype) || 0) - 1
    if (next <= 0) {
      inner.delete(subtype)
      if (inner.size === 0) this.subtypeCountsByType.delete(typeIdx)
    } else {
      inner.set(subtype, next)
    }
  }

  /**
   * Load `_system/subtype-statistics.json` into `subtypeCountsByType`.
   * Persisted shape: `{ counts: { [typeIdx]: { [subtype]: count } }, updatedAt }`.
   * Missing file or parse error → start from empty (matches loadTypeStatistics).
   */
  protected async loadSubtypeStatistics(): Promise<void> {
    try {
      const stats = await this.readObjectFromPath(`${SYSTEM_DIR}/subtype-statistics.json`)
      if (stats && stats.counts && typeof stats.counts === 'object') {
        this.subtypeCountsByType.clear()
        for (const [typeKey, subtypeMap] of Object.entries(stats.counts as Record<string, Record<string, number>>)) {
          const typeIdx = Number(typeKey)
          if (!Number.isInteger(typeIdx) || typeIdx < 0 || typeIdx >= NOUN_TYPE_COUNT) continue
          const inner = new Map<string, number>()
          for (const [subtype, count] of Object.entries(subtypeMap)) {
            if (typeof count === 'number' && count > 0) inner.set(subtype, count)
          }
          if (inner.size > 0) this.subtypeCountsByType.set(typeIdx, inner)
        }
      }
    } catch {
      // No existing subtype statistics, starting fresh.
    }
  }

  /**
   * Save subtype statistics to storage. Mirrors the type-statistics persistence
   * cadence (called from `flushCounts()` and the periodic save in
   * `saveNoun_internal`).
   */
  protected async saveSubtypeStatistics(): Promise<void> {
    const counts: Record<string, Record<string, number>> = {}
    for (const [typeIdx, inner] of this.subtypeCountsByType.entries()) {
      const innerObj: Record<string, number> = {}
      for (const [subtype, count] of inner.entries()) innerObj[subtype] = count
      counts[String(typeIdx)] = innerObj
    }
    await this.writeObjectToPath(`${SYSTEM_DIR}/subtype-statistics.json`, {
      counts,
      updatedAt: Date.now()
    })
  }

  /**
   * Rebuild subtype counts from on-disk metadata. Companion to `rebuildTypeCounts()`
   * — used for poison recovery and explicit repair via `brainy inspect repair`.
   * O(N) over all nouns.
   */
  public async rebuildSubtypeCounts(): Promise<void> {
    prodLog.info('[BaseStorage] Rebuilding subtype counts from storage...')
    this.subtypeCountsByType.clear()
    this.nounSubtypeByIdCache.clear()

    for (let shard = 0; shard < 256; shard++) {
      const shardHex = shard.toString(16).padStart(2, '0')
      const shardDir = `entities/nouns/${shardHex}`
      try {
        const paths = await this.listObjectsInBranch(shardDir)
        for (const path of paths) {
          if (!path.includes('/metadata.json')) continue
          try {
            const metadata = await this.readWithInheritance(path)
            if (metadata && metadata.noun && typeof metadata.subtype === 'string' && metadata.subtype.length > 0) {
              this.incrementSubtypeCount(metadata.noun as NounType, metadata.subtype)
              // Path is `entities/nouns/<shard>/<id>/metadata.json` — extract id segment.
              const segments = path.split('/')
              const idSeg = segments[segments.length - 2]
              if (idSeg) this.nounSubtypeByIdCache.set(idSeg, metadata.subtype)
            }
          } catch { /* skip unreadable entities */ }
        }
      } catch { /* skip missing shards */ }
    }

    await this.saveSubtypeStatistics()
    const totals = Array.from(this.subtypeCountsByType.values())
      .reduce((sum, inner) => sum + Array.from(inner.values()).reduce((s, n) => s + n, 0), 0)
    prodLog.info(`[BaseStorage] Rebuilt subtype counts: ${totals} entities across ${this.subtypeCountsByType.size} NounTypes`)
  }

  /**
   * Increment the (verb, subtype) count, creating the inner map on first use.
   * Verb-side mirror of `incrementSubtypeCount`. Indexed by VerbType index so it
   * lines up with `verbCountsByType` and can be reduced into per-verb totals
   * without re-keying.
   */
  protected incrementVerbSubtypeCount(verb: VerbType, subtype: string): void {
    const verbIdx = TypeUtils.getVerbIndex(verb)
    if (verbIdx < 0) return
    let inner = this.verbSubtypeCountsByType.get(verbIdx)
    if (!inner) {
      inner = new Map<string, number>()
      this.verbSubtypeCountsByType.set(verbIdx, inner)
    }
    inner.set(subtype, (inner.get(subtype) || 0) + 1)
  }

  /**
   * Decrement the (verb, subtype) count. Mirror of `decrementSubtypeCount`.
   * Deletes the inner key when it reaches 0 and the outer entry when its inner
   * map is empty, so the persisted shape stays compact across heavy churn.
   */
  protected decrementVerbSubtypeCount(verb: VerbType, subtype: string): void {
    const verbIdx = TypeUtils.getVerbIndex(verb)
    if (verbIdx < 0) return
    const inner = this.verbSubtypeCountsByType.get(verbIdx)
    if (!inner) return
    const next = (inner.get(subtype) || 0) - 1
    if (next <= 0) {
      inner.delete(subtype)
      if (inner.size === 0) this.verbSubtypeCountsByType.delete(verbIdx)
    } else {
      inner.set(subtype, next)
    }
  }

  /**
   * Load `_system/verb-subtype-statistics.json` into `verbSubtypeCountsByType`.
   * Persisted shape mirrors the noun-side rollup:
   * `{ counts: { [verbIdx]: { [subtype]: count } }, updatedAt }`. Missing file
   * or parse error → start from empty.
   */
  protected async loadVerbSubtypeStatistics(): Promise<void> {
    try {
      const stats = await this.readObjectFromPath(`${SYSTEM_DIR}/verb-subtype-statistics.json`)
      if (stats && stats.counts && typeof stats.counts === 'object') {
        this.verbSubtypeCountsByType.clear()
        for (const [verbKey, subtypeMap] of Object.entries(stats.counts as Record<string, Record<string, number>>)) {
          const verbIdx = Number(verbKey)
          if (!Number.isInteger(verbIdx) || verbIdx < 0 || verbIdx >= VERB_TYPE_COUNT) continue
          const inner = new Map<string, number>()
          for (const [subtype, count] of Object.entries(subtypeMap)) {
            if (typeof count === 'number' && count > 0) inner.set(subtype, count)
          }
          if (inner.size > 0) this.verbSubtypeCountsByType.set(verbIdx, inner)
        }
      }
    } catch {
      // No existing verb subtype statistics, starting fresh.
    }
  }

  /**
   * Save verb subtype statistics to storage. Mirrors `saveSubtypeStatistics`.
   * Same persistence cadence (flushCounts + periodic saves alongside other
   * type-statistics).
   */
  protected async saveVerbSubtypeStatistics(): Promise<void> {
    const counts: Record<string, Record<string, number>> = {}
    for (const [verbIdx, inner] of this.verbSubtypeCountsByType.entries()) {
      const innerObj: Record<string, number> = {}
      for (const [subtype, count] of inner.entries()) innerObj[subtype] = count
      counts[String(verbIdx)] = innerObj
    }
    await this.writeObjectToPath(`${SYSTEM_DIR}/verb-subtype-statistics.json`, {
      counts,
      updatedAt: Date.now()
    })
  }

  /**
   * Rebuild verb subtype counts from on-disk metadata. Companion to
   * `rebuildSubtypeCounts()`. O(N) over all verbs. Used for poison recovery
   * and explicit repair via `brainy inspect repair`.
   */
  public async rebuildVerbSubtypeCounts(): Promise<void> {
    prodLog.info('[BaseStorage] Rebuilding verb subtype counts from storage...')
    this.verbSubtypeCountsByType.clear()
    this.verbSubtypeByIdCache.clear()

    for (let shard = 0; shard < 256; shard++) {
      const shardHex = shard.toString(16).padStart(2, '0')
      const shardDir = `entities/verbs/${shardHex}`
      try {
        const paths = await this.listObjectsInBranch(shardDir)
        for (const path of paths) {
          if (!path.includes('/metadata.json')) continue
          try {
            const metadata = await this.readWithInheritance(path)
            if (metadata && metadata.verb && typeof metadata.subtype === 'string' && metadata.subtype.length > 0) {
              const verb = metadata.verb as VerbType
              const subtype = metadata.subtype as string
              this.incrementVerbSubtypeCount(verb, subtype)
              const segments = path.split('/')
              const idSeg = segments[segments.length - 2]
              if (idSeg) this.verbSubtypeByIdCache.set(idSeg, { verb, subtype })
            }
          } catch { /* skip unreadable verbs */ }
        }
      } catch { /* skip missing shards */ }
    }

    await this.saveVerbSubtypeStatistics()
    const totals = Array.from(this.verbSubtypeCountsByType.values())
      .reduce((sum, inner) => sum + Array.from(inner.values()).reduce((s, n) => s + n, 0), 0)
    prodLog.info(`[BaseStorage] Rebuilt verb subtype counts: ${totals} relationships across ${this.verbSubtypeCountsByType.size} VerbTypes`)
  }

  /**
   * Persist both counter systems atomically when an explicit flush is
   * requested. `super.flushCounts()` writes `entityCounts` (the Map in
   * `BaseStorageAdapter`); we additionally write `nounCountsByType` /
   * `verbCountsByType` so a reader opening the same directory sees the
   * exact same counts the writer holds in memory.
   *
   * Before this override the Uint32Array counters were only persisted
   * on a heuristic schedule inside `saveNoun_internal` (first-of-type or
   * every-100th), which left readers seeing stale counts after a clean
   * writer flush — the same failure mode that BR-FIND-WHERE-ZERO surfaced
   * via `brain.stats()`.
   */
  public async flushCounts(): Promise<void> {
    await super.flushCounts()
    await this.saveTypeStatistics()
    await this.saveSubtypeStatistics()
    await this.saveVerbSubtypeStatistics()
  }

  /**
   * Get noun counts by type (O(1) access to type statistics)
   * Exposed for MetadataIndexManager to use as single source of truth
   * @returns Uint32Array indexed by NounType enum value (42 types)
   */
  public getNounCountsByType(): Uint32Array {
    return this.nounCountsByType
  }

  /**
   * Get subtype counts by NounType (O(1) access to subtype statistics).
   * Returned map is the live in-memory view — callers must treat it as
   * read-only. Outer key: NounType index. Inner map: subtype → count.
   *
   * @returns Map keyed by NounType index → Map of subtype → count
   */
  public getSubtypeCountsByType(): Map<number, Map<string, number>> {
    return this.subtypeCountsByType
  }

  /**
   * Get verb subtype counts (O(1) access). Verb-side mirror of
   * `getSubtypeCountsByType`. Outer key: VerbType index. Inner map: subtype → count.
   * Returned map is the live in-memory view — callers must treat it as read-only.
   */
  public getVerbSubtypeCountsByType(): Map<number, Map<string, number>> {
    return this.verbSubtypeCountsByType
  }

  /**
   * Get verb counts by type (O(1) access to type statistics)
   * Exposed for MetadataIndexManager to use as single source of truth
   * @returns Uint32Array indexed by VerbType enum value (127 types)
   */
  public getVerbCountsByType(): Uint32Array {
    return this.verbCountsByType
  }

  /**
   * Rebuild type counts from actual storage. Scans every shard, reads each
   * entity's metadata, and reconstructs `nounCountsByType` / `verbCountsByType`
   * from ground truth. Persists the corrected counts to `type-statistics.json`.
   *
   * Public so it can be triggered by `brainy inspect repair` and by the
   * `brain.health()` reconciliation path. Called automatically by
   * `loadTypeStatistics()` when the persisted state matches the poisoned
   * 7.20.0–7.21.0 signature (all entities attributed to `'thing'`).
   *
   * For very large stores this is O(N) where N is total entities; intended
   * for diagnostic / repair use, not on every init.
   */
  public async rebuildTypeCounts(): Promise<void> {
    prodLog.info('[BaseStorage] Rebuilding type counts from storage...')

    // Rebuild by scanning shards (0x00-0xFF) and reading metadata
    this.nounCountsByType = new Uint32Array(NOUN_TYPE_COUNT)
    this.verbCountsByType = new Uint32Array(VERB_TYPE_COUNT)

    // Scan noun shards
    for (let shard = 0; shard < 256; shard++) {
      const shardHex = shard.toString(16).padStart(2, '0')
      const shardDir = `entities/nouns/${shardHex}`

      try {
        const paths = await this.listObjectsInBranch(shardDir)

        for (const path of paths) {
          if (!path.includes('/metadata.json')) continue

          try {
            const metadata = await this.readWithInheritance(path)
            if (metadata && metadata.noun) {
              // 8.0 visibility: rebuild only public entities into the user-facing
              // per-type stat; warm the cache so later writes/deletes stay symmetric.
              const id = idFromMetadataPath(path)
              if (isCountedVisibility(metadata.visibility)) {
                const typeIndex = TypeUtils.getNounIndex(metadata.noun)
                if (typeIndex >= 0 && typeIndex < NOUN_TYPE_COUNT) {
                  this.nounCountsByType[typeIndex]++
                }
                if (id) this.nounVisibilityByIdCache.delete(id)
              } else if (id) {
                this.nounVisibilityByIdCache.set(id, metadata.visibility as EntityVisibility)
              }
            }
          } catch (error) {
            // Skip entities that fail to load
          }
        }
      } catch (error) {
        // Skip shards that don't exist
      }
    }

    // Scan verb shards
    for (let shard = 0; shard < 256; shard++) {
      const shardHex = shard.toString(16).padStart(2, '0')
      const shardDir = `entities/verbs/${shardHex}`

      try {
        const paths = await this.listObjectsInBranch(shardDir)

        for (const path of paths) {
          if (!path.includes('/metadata.json')) continue

          try {
            const metadata = await this.readWithInheritance(path)
            if (metadata && metadata.verb) {
              // 8.0 visibility: rebuild only public edges into the user-facing per-type stat.
              const id = idFromMetadataPath(path)
              if (isCountedVisibility(metadata.visibility)) {
                const typeIndex = TypeUtils.getVerbIndex(metadata.verb)
                if (typeIndex >= 0 && typeIndex < VERB_TYPE_COUNT) {
                  this.verbCountsByType[typeIndex]++
                }
                if (id) this.verbVisibilityByIdCache.delete(id)
              } else if (id) {
                this.verbVisibilityByIdCache.set(id, metadata.visibility as EntityVisibility)
              }
            }
          } catch (error) {
            // Skip entities that fail to load
          }
        }
      } catch (error) {
        // Skip shards that don't exist
      }
    }

    // Save rebuilt counts to storage
    await this.saveTypeStatistics()

    const totalVerbs = this.verbCountsByType.reduce((sum, count) => sum + count, 0)
    const totalNouns = this.nounCountsByType.reduce((sum, count) => sum + count, 0)
    prodLog.info(`[BaseStorage] Rebuilt counts: ${totalNouns} nouns, ${totalVerbs} verbs`)
  }

  /**
   * Resolve the `NounType` for a noun, used to attribute the entity to the
   * correct slot in `nounCountsByType` (which backs `_system/type-statistics.json`
   * and `brain.stats().entitiesByType`).
   *
   * Lookup order:
   *   1. `nounTypeByIdCache`, populated by `saveNounMetadata_internal()`
   *      whenever a noun's metadata is written. This is the common path —
   *      add() saves metadata before the HNSW noun, so by the time we get
   *      here the cache is warm.
   *   2. `'thing'` as a final fallback when metadata genuinely doesn't exist
   *      (a noun added without metadata — irregular but tolerated for back-
   *      compat). Logged so a real bug doesn't go unnoticed.
   *
   * Note this is intentionally synchronous because `saveNoun_internal()` and
   * its callers are not async-friendly at this layer. For cases where only
   * an id is known after a process restart and the cache is cold,
   * `getNounTypeFromStorageAsync()` is available for callers that can await.
   */
  protected getNounType(noun: HNSWNoun): NounType {
    const cached = this.nounTypeByIdCache.get(noun.id)
    if (cached) return cached
    // Cache miss on a noun we're about to write means metadata was not saved
    // first. Brainy.add() always saves metadata before HNSW, so this only
    // fires in unusual code paths (raw `storage.saveNoun()` without metadata).
    prodLog.warn(
      `[BaseStorage] getNounType: no type cached for noun ${noun.id}. ` +
      `Type-statistics will attribute this entity to 'thing'. ` +
      `Call saveNounMetadata() before saveNoun() to avoid stat drift.`
    )
    return 'thing'
  }

  /**
   * Async variant of `getNounType()` that consults disk if the in-memory
   * cache is cold (e.g. after a process restart with deferred work). Used by
   * `rebuildTypeCounts()` and other callers that can await an IO. Returns
   * `null` if metadata genuinely doesn't exist; callers decide whether to
   * fall back to 'thing' or skip the entity.
   */
  protected async getNounTypeFromStorageAsync(id: string): Promise<NounType | null> {
    const cached = this.nounTypeByIdCache.get(id)
    if (cached) return cached
    try {
      const metadataPath = getNounMetadataPath(id)
      const metadata = await this.readWithInheritance(metadataPath)
      if (metadata && (metadata as NounMetadata).noun) {
        const type = (metadata as NounMetadata).noun as NounType
        // Warm the cache so subsequent sync calls hit fast.
        this.nounTypeByIdCache.set(id, type)
        return type
      }
    } catch {
      // Storage error — treat as unknown.
    }
    return null
  }

  /**
   * Get verb type from verb object
   * Verb type is a required field in HNSWVerb
   */
  protected getVerbType(verb: HNSWVerb | GraphVerb): VerbType {
    // verb is a required field in HNSWVerb
    if ('verb' in verb && verb.verb) {
      return verb.verb as VerbType
    }

    // Fallback for GraphVerb (type alias)
    if ('type' in verb && verb.type) {
      return verb.type as VerbType
    }

    // This should never happen with current data
    prodLog.warn(`[BaseStorage] Verb missing type field for ${verb.id}, defaulting to 'relatedTo'`)
    return 'relatedTo'
  }


  // ============================================================================
  // DESERIALIZATION HELPERS
  // Centralized Map/Set reconstruction from JSON storage format
  // ============================================================================

  /**
   * Deserialize HNSW connections from JSON storage format
   *
   * Converts plain object { "0": ["id1"], "1": ["id2"] }
   * into Map<number, Set<string>>
   *
   * Central helper to fix serialization bug across all code paths
   * Root cause: JSON.stringify(Map) = {} (empty object), must reconstruct on read
   */
  protected deserializeConnections(connections: any): Map<number, Set<string>> {
    const result = new Map<number, Set<string>>()

    if (!connections || typeof connections !== 'object') {
      return result
    }

    // Already a Map (in-memory, not from JSON)
    if (connections instanceof Map) {
      return connections
    }

    // Deserialize from plain object
    for (const [levelStr, ids] of Object.entries(connections)) {
      if (Array.isArray(ids)) {
        result.set(parseInt(levelStr, 10), new Set<string>(ids))
      } else if (ids && typeof ids === 'object') {
        // Handle Set-like or array-like objects
        result.set(parseInt(levelStr, 10), new Set<string>(Object.values(ids)))
      }
    }

    return result
  }

  /**
   * Deserialize HNSWNoun from JSON storage format
   *
   * Ensures connections are properly reconstructed from Map → object → Map
   * Fixes: "TypeError: noun.connections.entries is not a function"
   */
  protected deserializeNoun(data: any): HNSWNoun {
    return {
      ...data,
      connections: this.deserializeConnections(data.connections)
    }
  }

  /**
   * Deserialize HNSWVerb from JSON storage format
   *
   * Ensures connections are properly reconstructed from Map → object → Map
   * Fixes same serialization bug for verbs
   */
  protected deserializeVerb(data: any): HNSWVerb {
    return {
      ...data,
      connections: this.deserializeConnections(data.connections)
    }
  }


  // ============================================================================
  // ABSTRACT METHOD IMPLEMENTATIONS
  // Converted from abstract to concrete - all adapters now have built-in type-aware
  // ============================================================================

  /**
   * Save a noun to storage (ID-first path)
   */
  protected async saveNoun_internal(noun: HNSWNoun): Promise<void> {
    const type = this.getNounType(noun)
    const path = getNounVectorPath(noun.id)

    // Update type tracking — but only for entities that count toward the
    // user-facing per-type stats. `nounVisibilityByIdCache` (warmed by
    // `saveNounMetadata_internal()`) flags internal/system ids; public ids are
    // absent, so the common case still increments. 8.0 visibility exclusion.
    const typeIndex = TypeUtils.getNounIndex(type)
    const counted = isCountedVisibility(this.nounVisibilityByIdCache.get(noun.id))
    if (counted) {
      this.nounCountsByType[typeIndex]++
    }

    // COW-aware write: Use COW helper for branch isolation
    await this.writeObjectToBranch(path, noun)

    // Periodically save statistics
    // Also save on first noun of each type to ensure low-count types are tracked
    const shouldSave = counted &&
                       (this.nounCountsByType[typeIndex] === 1 ||  // First noun of type
                        this.nounCountsByType[typeIndex] % 100 === 0)  // Every 100th
    if (shouldSave) {
      await this.saveTypeStatistics()
    }
  }

  /**
   * Get a noun from storage (ID-first path)
   */
  protected async getNoun_internal(id: string): Promise<HNSWNoun | null> {
    // Direct O(1) lookup with ID-first paths - no type search needed!
    const path = getNounVectorPath(id)

    try {
      // COW-aware read: Use COW helper for branch isolation
      const noun = await this.readWithInheritance(path)
      if (noun) {
        // Deserialize connections Map from JSON storage format
        return this.deserializeNoun(noun)
      }
    } catch (error) {
      // Entity not found
      return null
    }

    return null
  }

  /**
   * Get nouns by noun type (Shard-based iteration!)
   */
  protected async getNounsByNounType_internal(
    nounType: string
  ): Promise<HNSWNoun[]> {
    // Iterate by shards (0x00-0xFF) instead of types
    // Type is stored in metadata.noun field, we filter as we load
    const nouns: HNSWNoun[] = []

    for (let shard = 0; shard < 256; shard++) {
      const shardHex = shard.toString(16).padStart(2, '0')
      const shardDir = `entities/nouns/${shardHex}`

      try {
        const nounFiles = await this.listObjectsInBranch(shardDir)

        for (const nounPath of nounFiles) {
          if (!nounPath.includes('/vectors.json')) continue

          try {
            const noun = await this.readWithInheritance(nounPath)
            if (noun) {
              const deserialized = this.deserializeNoun(noun)

              // Check type from metadata
              const metadata = await this.getNounMetadata(deserialized.id)
              if (metadata && metadata.noun === nounType) {
                nouns.push(deserialized)
              }
            }
          } catch (error) {
            // Skip nouns that fail to load
          }
        }
      } catch (error) {
        // Skip shards that have no data
      }
    }

    return nouns
  }

  /**
   * Delete a noun from storage (ID-first, O(1) delete)
   */
  protected async deleteNoun_internal(id: string): Promise<void> {
    // Direct O(1) delete with ID-first path
    const path = getNounVectorPath(id)
    await this.deleteObjectFromBranch(path)

    // Note: Type-specific counts will be decremented via metadata tracking
    // The real type is in metadata, accessible if needed via getNounMetadata(id)
  }

  /**
   * Save a verb to storage (ID-first path)
   */
  protected async saveVerb_internal(verb: HNSWVerb): Promise<void> {
    // Type is now a first-class field in HNSWVerb - no caching needed!
    const type = verb.verb as VerbType
    const path = getVerbVectorPath(verb.id)

    prodLog.debug(`[BaseStorage] saveVerb_internal: id=${verb.id}, sourceId=${verb.sourceId}, targetId=${verb.targetId}, type=${type}`)

    // Update type tracking
    const typeIndex = TypeUtils.getVerbIndex(type)
    this.verbCountsByType[typeIndex]++

    // COW-aware write: Use COW helper for branch isolation
    await this.writeObjectToBranch(path, verb)

    // GraphAdjacencyIndex updates are now handled EXCLUSIVELY by Brainy.relate()
    // via AddToGraphIndexOperation in the transaction system. This provides:
    // 1. Singleton pattern - only one graphIndex instance exists (via getGraphIndex())
    // 2. Transaction rollback - if relate() fails, index update is rolled back
    // 3. No double-counting - prevents duplicate addVerb() calls
    // REMOVED: Direct graphIndex.addVerb() call that caused dual-ownership bugs

    // Periodically save statistics
    // Also save on first verb of each type to ensure low-count types are tracked
    // This prevents stale statistics after restart for types with < 100 verbs (common for VFS)
    const shouldSave = this.verbCountsByType[typeIndex] === 1 ||  // First verb of type
                       this.verbCountsByType[typeIndex] % 100 === 0  // Every 100th
    if (shouldSave) {
      await this.saveTypeStatistics()
    }
  }

  /**
   * Get a verb from storage (ID-first path)
   */
  protected async getVerb_internal(id: string): Promise<HNSWVerb | null> {
    // Direct O(1) lookup with ID-first paths - no type search needed!
    const path = getVerbVectorPath(id)

    try {
      // COW-aware read: Use COW helper for branch isolation
      const verb = await this.readWithInheritance(path)
      if (verb) {
        // Deserialize connections Map from JSON storage format
        return this.deserializeVerb(verb)
      }
    } catch (error) {
      // Entity not found
      return null
    }

    return null
  }

  /**
   * Get verbs by source (Uses GraphAdjacencyIndex when available)
   * Falls back to shard iteration during initialization to avoid circular dependency
   */
  protected async getVerbsBySource_internal(
    sourceId: string
  ): Promise<HNSWVerbWithMetadata[]> {
    await this.ensureInitialized()

    prodLog.debug(`[BaseStorage] getVerbsBySource_internal: sourceId=${sourceId}, graphIndex=${!!this.graphIndex}, isInitialized=${this.graphIndex?.isInitialized}`)

    // Fast path - use GraphAdjacencyIndex if available (lazy-loaded)
    if (this.graphIndex && this.graphIndex.isInitialized) {
      try {
        const verbIds = await this.graphIndex.getVerbIdsBySource(sourceId)
        prodLog.debug(`[BaseStorage] GraphAdjacencyIndex found ${verbIds.length} verb IDs for sourceId=${sourceId}`)

        // PERFORMANCE FIX - Batch fetch verbs + metadata (eliminates N+1 pattern)
        // Before: N sequential calls (10 children = 20 × 300ms = 6000ms on GCS)
        // After: 2 parallel batch calls (10 children = 2 × 300ms = 600ms on GCS)
        // 10x improvement for cloud storage (GCS, S3, Azure)
        const verbPaths = verbIds.map(id => getVerbVectorPath(id))
        const metadataPaths = verbIds.map(id => getVerbMetadataPath(id))

        const [verbsMap, metadataMap] = await Promise.all([
          this.readBatchWithInheritance(verbPaths),
          this.readBatchWithInheritance(metadataPaths)
        ])

        const results: HNSWVerbWithMetadata[] = []

        for (const verbId of verbIds) {
          const verbPath = getVerbVectorPath(verbId)
          const metadataPath = getVerbMetadataPath(verbId)

          const rawVerb = verbsMap.get(verbPath)
          const metadata = metadataMap.get(metadataPath)

          if (rawVerb && metadata) {
            // CRITICAL - Deserialize connections Map from JSON storage format
            const verb = this.deserializeVerb(rawVerb)

            results.push({
              ...verb,
              subtype: (metadata as any).subtype as string | undefined,
              weight: metadata.weight,
              confidence: metadata.confidence,
              createdAt: metadata.createdAt
                ? (typeof metadata.createdAt === 'number' ? metadata.createdAt : metadata.createdAt.seconds * 1000)
                : Date.now(),
              updatedAt: metadata.updatedAt
                ? (typeof metadata.updatedAt === 'number' ? metadata.updatedAt : metadata.updatedAt.seconds * 1000)
                : Date.now(),
              service: metadata.service,
              createdBy: metadata.createdBy,
              metadata: metadata || {} as VerbMetadata
            })
          }
        }

        prodLog.debug(`[BaseStorage] GraphAdjacencyIndex + batch fetch returned ${results.length} verbs`)
        return results
      } catch (error) {
        prodLog.warn('[BaseStorage] GraphAdjacencyIndex lookup failed, falling back to shard iteration:', error)
      }
    }

    // Fallback - iterate by shards (WITH deserialization fix!)
    prodLog.debug(`[BaseStorage] Using shard iteration fallback for sourceId=${sourceId}`)
    const results: HNSWVerbWithMetadata[] = []
    let shardsScanned = 0
    let verbsFound = 0

    for (let shard = 0; shard < 256; shard++) {
      const shardHex = shard.toString(16).padStart(2, '0')
      const shardDir = `entities/verbs/${shardHex}`

      try {
        const verbFiles = await this.listObjectsInBranch(shardDir)
        shardsScanned++

        for (const verbPath of verbFiles) {
          if (!verbPath.includes('/vectors.json')) continue

          try {
            const rawVerb = await this.readWithInheritance(verbPath)
            if (!rawVerb) continue

            verbsFound++

            // CRITICAL - Deserialize connections Map from JSON storage format
            const verb = this.deserializeVerb(rawVerb)

            if (verb.sourceId === sourceId) {
              const metadataPath = getVerbMetadataPath(verb.id)
              const metadata = await this.readWithInheritance(metadataPath)

              results.push({
                ...verb,
                subtype: (metadata as any)?.subtype as string | undefined,
                weight: metadata?.weight,
                confidence: metadata?.confidence,
                createdAt: metadata?.createdAt
                  ? (typeof metadata.createdAt === 'number' ? metadata.createdAt : metadata.createdAt.seconds * 1000)
                  : Date.now(),
                updatedAt: metadata?.updatedAt
                  ? (typeof metadata.updatedAt === 'number' ? metadata.updatedAt : metadata.updatedAt.seconds * 1000)
                  : Date.now(),
                service: metadata?.service,
                createdBy: metadata?.createdBy,
                metadata: metadata || {} as VerbMetadata
              })
            }
          } catch (error) {
            // Skip verbs that fail to load
            prodLog.debug(`[BaseStorage] Failed to load verb from ${verbPath}:`, error)
          }
        }
      } catch (error) {
        // Skip shards that have no data
      }
    }

    prodLog.debug(`[BaseStorage] Shard iteration: scanned ${shardsScanned} shards, found ${verbsFound} total verbs, matched ${results.length} for sourceId=${sourceId}`)
    return results
  }

  /**
   * Batch get verbs by source IDs
   *
   * **Performance**: Eliminates N+1 query pattern for relationship lookups
   * - Current: N × getVerbsBySource() = N × (list all verbs + filter)
   * - Batched: 1 × list all verbs + filter by N sourceIds
   *
   * **Use cases:**
   * - VFS tree traversal (get Contains edges for multiple directories)
   * - brain.getRelations() for multiple entities
   * - Graph traversal (fetch neighbors of multiple nodes)
   *
   * @param sourceIds Array of source entity IDs
   * @param verbType Optional verb type filter (e.g., VerbType.Contains for VFS)
   * @returns Map of sourceId → verbs[]
   *
   * @example
   * ```typescript
   * // Before (N+1 pattern)
   * for (const dirId of dirIds) {
   *   const children = await storage.getVerbsBySource(dirId)  // N calls
   * }
   *
   * // After (batched)
   * const childrenByDir = await storage.getVerbsBySourceBatch(dirIds, VerbType.Contains)  // 1 scan
   * for (const dirId of dirIds) {
   *   const children = childrenByDir.get(dirId) || []
   * }
   * ```
   *
   */
  public async getVerbsBySourceBatch(
    sourceIds: string[],
    verbType?: VerbType
  ): Promise<Map<string, HNSWVerbWithMetadata[]>> {
    await this.ensureInitialized()

    const results = new Map<string, HNSWVerbWithMetadata[]>()
    if (sourceIds.length === 0) return results

    // Initialize empty arrays for all requested sourceIds
    for (const sourceId of sourceIds) {
      results.set(sourceId, [])
    }

    // Convert sourceIds to Set for O(1) lookup
    const sourceIdSet = new Set(sourceIds)

    // Iterate by shards (0x00-0xFF) instead of types
    for (let shard = 0; shard < 256; shard++) {
      const shardHex = shard.toString(16).padStart(2, '0')
      const shardDir = `entities/verbs/${shardHex}`

      try {
        // List all verb files in this shard
        const verbFiles = await this.listObjectsInBranch(shardDir)

        // Build paths for batch read
        const verbPaths: string[] = []
        const metadataPaths: string[] = []
        const pathToId = new Map<string, string>()

        for (const verbPath of verbFiles) {
          if (!verbPath.includes('/vectors.json')) continue
          verbPaths.push(verbPath)

          // Extract ID from path: "entities/verbs/{shard}/{id}/vector.json"
          const parts = verbPath.split('/')
          const verbId = parts[parts.length - 2] // ID is second-to-last segment
          pathToId.set(verbPath, verbId)

          // Prepare metadata path
          metadataPaths.push(getVerbMetadataPath(verbId))
        }

        // Batch read all verb files for this shard
        const verbDataMap = await this.readBatchWithInheritance(verbPaths)
        const metadataMap = await this.readBatchWithInheritance(metadataPaths)

        // Process results
        for (const [verbPath, rawVerbData] of verbDataMap.entries()) {
          if (!rawVerbData || !rawVerbData.sourceId) continue

          // Deserialize connections Map from JSON storage format
          const verbData = this.deserializeVerb(rawVerbData)

          // Check if this verb's source is in our requested set
          if (!sourceIdSet.has(verbData.sourceId)) continue

          // If verbType specified, filter by type
          if (verbType && verbData.verb !== verbType) continue

          // Found matching verb - hydrate with metadata
          const verbId = pathToId.get(verbPath)!
          const metadataPath = getVerbMetadataPath(verbId)
          const metadata = metadataMap.get(metadataPath) || {}

          const hydratedVerb: HNSWVerbWithMetadata = {
            ...verbData,
            weight: metadata?.weight,
            confidence: metadata?.confidence,
            createdAt: metadata?.createdAt
              ? (typeof metadata.createdAt === 'number' ? metadata.createdAt : metadata.createdAt.seconds * 1000)
              : Date.now(),
            updatedAt: metadata?.updatedAt
              ? (typeof metadata.updatedAt === 'number' ? metadata.updatedAt : metadata.updatedAt.seconds * 1000)
              : Date.now(),
            service: metadata?.service,
            createdBy: metadata?.createdBy,
            metadata: metadata as VerbMetadata
          }

          // Add to results for this sourceId
          const sourceVerbs = results.get(verbData.sourceId)!
          sourceVerbs.push(hydratedVerb)
        }
      } catch (error) {
        // Skip shards that have no data
      }
    }

    return results
  }

  /**
   * Get verbs by target (COW-aware implementation)
   * Reverted to fix circular dependency deadlock
   * Fixed to directly list verb files instead of directories
   */
  protected async getVerbsByTarget_internal(
    targetId: string
  ): Promise<HNSWVerbWithMetadata[]> {
    await this.ensureInitialized()

    // Fast path - use GraphAdjacencyIndex if available (lazy-loaded)
    if (this.graphIndex && this.graphIndex.isInitialized) {
      try {
        const verbIds = await this.graphIndex.getVerbIdsByTarget(targetId)
        const results: HNSWVerbWithMetadata[] = []

        for (const verbId of verbIds) {
          const verb = await this.getVerb_internal(verbId)
          const metadata = await this.getVerbMetadata(verbId)

          if (verb && metadata) {
            results.push({
              ...verb,
              subtype: (metadata as any).subtype as string | undefined,
              weight: metadata.weight,
              confidence: metadata.confidence,
              createdAt: metadata.createdAt
                ? (typeof metadata.createdAt === 'number' ? metadata.createdAt : metadata.createdAt.seconds * 1000)
                : Date.now(),
              updatedAt: metadata.updatedAt
                ? (typeof metadata.updatedAt === 'number' ? metadata.updatedAt : metadata.updatedAt.seconds * 1000)
                : Date.now(),
              service: metadata.service,
              createdBy: metadata.createdBy,
              metadata: metadata || {} as VerbMetadata
            })
          }
        }

        return results
      } catch (error) {
        prodLog.warn('[BaseStorage] GraphAdjacencyIndex lookup failed, falling back to shard iteration:', error)
      }
    }

    // Fallback - iterate by shards (WITH deserialization fix!)
    const results: HNSWVerbWithMetadata[] = []

    for (let shard = 0; shard < 256; shard++) {
      const shardHex = shard.toString(16).padStart(2, '0')
      const shardDir = `entities/verbs/${shardHex}`

      try {
        const verbFiles = await this.listObjectsInBranch(shardDir)

        for (const verbPath of verbFiles) {
          if (!verbPath.includes('/vectors.json')) continue

          try {
            const rawVerb = await this.readWithInheritance(verbPath)
            if (!rawVerb) continue

            // CRITICAL - Deserialize connections Map from JSON storage format
            const verb = this.deserializeVerb(rawVerb)

            if (verb.targetId === targetId) {
              const metadataPath = getVerbMetadataPath(verb.id)
              const metadata = await this.readWithInheritance(metadataPath)

              results.push({
                ...verb,
                subtype: (metadata as any)?.subtype as string | undefined,
                weight: metadata?.weight,
                confidence: metadata?.confidence,
                createdAt: metadata?.createdAt
                  ? (typeof metadata.createdAt === 'number' ? metadata.createdAt : metadata.createdAt.seconds * 1000)
                  : Date.now(),
                updatedAt: metadata?.updatedAt
                  ? (typeof metadata.updatedAt === 'number' ? metadata.updatedAt : metadata.updatedAt.seconds * 1000)
                  : Date.now(),
                service: metadata?.service,
                createdBy: metadata?.createdBy,
                metadata: metadata || {} as VerbMetadata
              })
            }
          } catch (error) {
            // Skip verbs that fail to load
          }
        }
      } catch (error) {
        // Skip shards that have no data
      }
    }

    return results
  }

  /**
   * Get verbs by type (Shard iteration with type filtering)
   */
  protected async getVerbsByType_internal(verbType: string): Promise<HNSWVerbWithMetadata[]> {
    // Iterate by shards (0x00-0xFF) instead of type-first paths
    const verbs: HNSWVerbWithMetadata[] = []

    for (let shard = 0; shard < 256; shard++) {
      const shardHex = shard.toString(16).padStart(2, '0')
      const shardDir = `entities/verbs/${shardHex}`

      try {
        const verbFiles = await this.listObjectsInBranch(shardDir)

        for (const verbPath of verbFiles) {
          if (!verbPath.includes('/vectors.json')) continue

          try {
            const rawVerb = await this.readWithInheritance(verbPath)
            if (!rawVerb) continue

            // Deserialize connections Map from JSON storage format
            const hnswVerb = this.deserializeVerb(rawVerb)

            // Filter by verb type
            if (hnswVerb.verb !== verbType) continue

            // Load metadata separately (optional)
            const metadata = await this.getVerbMetadata(hnswVerb.id)

            // Extract standard fields from metadata to top-level
            const metadataObj = (metadata || {}) as VerbMetadata
            const { subtype, createdAt, updatedAt, confidence, weight, service, data, createdBy, _rev, ...customMetadata } = metadataObj

            const verbWithMetadata: HNSWVerbWithMetadata = {
              id: hnswVerb.id,
              vector: [...hnswVerb.vector],
              connections: hnswVerb.connections, // Already deserialized
              verb: hnswVerb.verb,
              sourceId: hnswVerb.sourceId,
              targetId: hnswVerb.targetId,
              subtype: subtype as string | undefined,
              createdAt: (createdAt as number) || Date.now(),
              updatedAt: (updatedAt as number) || Date.now(),
              confidence: confidence as number | undefined,
              weight: weight as number | undefined,
              service: service as string | undefined,
              data: data as Record<string, any> | undefined,
              createdBy,
              metadata: customMetadata
            }

            verbs.push(verbWithMetadata)
          } catch (error) {
            // Skip verbs that fail to load
          }
        }
      } catch (error) {
        // Skip shards that have no data
      }
    }

    return verbs
  }

  /**
   * Delete a verb from storage (ID-first, O(1) delete)
   */
  protected async deleteVerb_internal(id: string): Promise<void> {
    // Direct O(1) delete with ID-first path
    const path = getVerbVectorPath(id)
    await this.deleteObjectFromBranch(path)

    // Note: Type-specific counts will be decremented via metadata tracking
    // The real type is in metadata, accessible if needed via getVerbMetadata(id)
  }

  /**
   * Helper method to convert a Map to a plain object for serialization
   */
  protected mapToObject<K extends string | number, V>(
    map: Map<K, V>,
    valueTransformer: (value: V) => any = (v) => v
  ): Record<string, any> {
    const obj: Record<string, any> = {}
    for (const [key, value] of map.entries()) {
      obj[key.toString()] = valueTransformer(value)
    }
    return obj
  }

  /**
   * Save statistics data to storage (public interface)
   * @param statistics The statistics data to save
   */
  public async saveStatistics(statistics: StatisticsData): Promise<void> {
    return this.saveStatisticsData(statistics)
  }

  /**
   * Get statistics data from storage (public interface)
   * @returns Promise that resolves to the statistics data or null if not found
   */
  public async getStatistics(): Promise<StatisticsData | null> {
    return this.getStatisticsData()
  }

  /**
   * Save statistics data to storage
   * This method should be implemented by each specific adapter
   * @param statistics The statistics data to save
   */
  protected abstract saveStatisticsData(
    statistics: StatisticsData
  ): Promise<void>

  /**
   * Get statistics data from storage
   * This method should be implemented by each specific adapter
   * @returns Promise that resolves to the statistics data or null if not found
   */
  protected abstract getStatisticsData(): Promise<StatisticsData | null>
}
