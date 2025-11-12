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
  StatisticsData
} from '../coreTypes.js'
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
import { prodLog } from '../utils/logger.js'

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
 * @since v4.11.0
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

// Clean directory structure (v4.7.2+)
// All storage adapters use this consistent structure
export const NOUNS_METADATA_DIR = 'entities/nouns/metadata'
export const VERBS_METADATA_DIR = 'entities/verbs/metadata'
export const SYSTEM_DIR = '_system'
export const STATISTICS_KEY = 'statistics'

// DEPRECATED (v4.7.2): Temporary stubs for adapters not yet migrated
// TODO: Remove in v4.7.3 after migrating remaining adapters
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
 * Type-first path generators (v5.4.0)
 * Built-in type-aware organization for all storage adapters
 */

/**
 * Get type-first path for noun vectors
 */
function getNounVectorPath(type: NounType, id: string): string {
  const shard = getShardIdFromUuid(id)
  return `entities/nouns/${type}/vectors/${shard}/${id}.json`
}

/**
 * Get type-first path for noun metadata
 */
function getNounMetadataPath(type: NounType, id: string): string {
  const shard = getShardIdFromUuid(id)
  return `entities/nouns/${type}/metadata/${shard}/${id}.json`
}

/**
 * Get type-first path for verb vectors
 */
function getVerbVectorPath(type: VerbType, id: string): string {
  const shard = getShardIdFromUuid(id)
  return `entities/verbs/${type}/vectors/${shard}/${id}.json`
}

/**
 * Get type-first path for verb metadata
 */
function getVerbMetadataPath(type: VerbType, id: string): string {
  const shard = getShardIdFromUuid(id)
  return `entities/verbs/${type}/metadata/${shard}/${id}.json`
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

  // v5.7.2: Write-through cache for read-after-write consistency
  // v5.7.3: Extended lifetime - persists until explicit flush() call
  // Guarantees that immediately after writeObjectToBranch(), readWithInheritance() returns the data
  // Cache key: resolved branchPath (includes branch scope for COW isolation)
  // Cache lifetime: write start → flush() call (provides safety net for batch operations)
  // Memory footprint: Bounded by batch size (typically <1000 items during imports)
  private writeCache = new Map<string, any>()

  // COW (Copy-on-Write) support - v5.0.0
  public refManager?: RefManager
  public blobStorage?: BlobStorage
  public commitLog?: CommitLog
  public currentBranch: string = 'main'
  protected cowEnabled: boolean = false

  // Type-first indexing support (v5.4.0)
  // Built into all storage adapters for billion-scale efficiency
  protected nounCountsByType = new Uint32Array(NOUN_TYPE_COUNT) // 168 bytes (Stage 3: 42 types)
  protected verbCountsByType = new Uint32Array(VERB_TYPE_COUNT) // 508 bytes (Stage 3: 127 types)
  // Total: 676 bytes (99.2% reduction vs Map-based tracking)

  // Type cache for O(1) lookups after first access
  protected nounTypeCache = new Map<string, NounType>()
  protected verbTypeCache = new Map<string, VerbType>()

  // v5.5.0: Track if type counts have been rebuilt (prevent repeated rebuilds)
  private typeCountsRebuilt = false

  /**
   * Analyze a storage key to determine its routing and path
   * @param id - The key to analyze (UUID or system key)
   * @param context - The context for the key (noun-metadata, verb-metadata, or system)
   * @returns Storage key information including path and shard ID
   * @private
   */
  private analyzeKey(id: string, context: 'noun-metadata' | 'verb-metadata' | 'system'): StorageKeyInfo {
    // v4.8.0: Guard against undefined/null IDs
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
      return {
        original: id,
        isEntity: false,
        shardId: null,
        directory: SYSTEM_DIR,
        fullPath: `${SYSTEM_DIR}/${id}.json`
      }
    }

    // UUID validation for entity keys
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (!uuidRegex.test(id)) {
      prodLog.warn(`[Storage] Unknown key format: ${id} - treating as system resource`)
      return {
        original: id,
        isEntity: false,
        shardId: null,
        directory: SYSTEM_DIR,
        fullPath: `${SYSTEM_DIR}/${id}.json`
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
   * Initialize the storage adapter (v5.4.0)
   * Loads type statistics for built-in type-aware indexing
   *
   * IMPORTANT: If your adapter overrides init(), call await super.init() first!
   */
  public async init(): Promise<void> {
    // Load type statistics from storage (if they exist)
    await this.loadTypeStatistics()

    this.isInitialized = true
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
   * Lightweight COW enablement - just enables branch-scoped paths
   * Called during init() to ensure all data is stored with branch prefixes from the start
   * RefManager/BlobStorage/CommitLog are lazy-initialized on first fork()
   * @param branch - Branch name to use (default: 'main')
   */
  public enableCOWLightweight(branch: string = 'main'): void {
    if (this.cowEnabled) {
      return
    }
    this.currentBranch = branch
    this.cowEnabled = true
    // RefManager/BlobStorage/CommitLog remain undefined until first fork()
  }

  /**
   * Initialize COW (Copy-on-Write) support
   * Creates RefManager and BlobStorage for instant fork() capability
   *
   * v5.0.1: Now called automatically by storageFactory (zero-config)
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
    // v5.6.1: If COW was explicitly disabled (e.g., via clear()), don't reinitialize
    // This prevents automatic recreation of COW data after clear() operations
    if (this.cowEnabled === false) {
      return
    }

    // Check if RefManager already initialized (full COW setup complete)
    if (this.refManager) {
      return
    }

    // Enable lightweight COW if not already enabled
    if (!this.cowEnabled) {
      this.currentBranch = options?.branch || 'main'
      this.cowEnabled = true
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
          // Convert to Buffer
          if (Buffer.isBuffer(data)) {
            return data
          }
          return Buffer.from(JSON.stringify(data))
        } catch (error) {
          return undefined
        }
      },

      put: async (key: string, data: Buffer): Promise<void> => {
        // Store as Buffer (for blob data) or parse JSON (for metadata)
        let obj: any
        try {
          // Try to parse as JSON first (for metadata)
          obj = JSON.parse(data.toString())
        } catch {
          // Not JSON, store as binary (base64 encoded for JSON storage)
          obj = { _binary: true, data: data.toString('base64') }
        }
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
          // v5.3.5 fix: Handle file prefixes, not just directory paths
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
      // v5.3.4: Use NULL_HASH constant instead of hardcoded string
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

    this.cowEnabled = true
  }

  /**
   * Resolve branch-scoped path for COW isolation
   * @protected - Available to subclasses for COW implementation
   */
  protected resolveBranchPath(basePath: string, branch?: string): string {
    // CRITICAL FIX (v5.3.6): COW metadata (_cow/*) must NEVER be branch-scoped
    // Refs, commits, and blobs are global metadata with their own internal branching.
    // Branch-scoping COW paths causes fork() to write refs to wrong locations,
    // leading to "Branch does not exist" errors on checkout (see Workshop bug report).
    if (basePath.startsWith('_cow/')) {
      return basePath  // COW metadata is global across all branches
    }

    if (!this.cowEnabled) {
      return basePath  // COW disabled, use direct path
    }

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

    // v5.7.2: Add to write cache BEFORE async write (guarantees read-after-write consistency)
    // v5.7.3: Cache persists until flush() is called (extended lifetime for batch operations)
    // This ensures readWithInheritance() returns data immediately, fixing "Source entity not found" bug
    this.writeCache.set(branchPath, data)

    // Write to storage (async)
    await this.writeObjectToPath(branchPath, data)

    // v5.7.3: Cache is NOT cleared here anymore - persists until flush()
    // This provides a safety net for immediate queries after batch writes
  }

  /**
   * Read object with inheritance from parent branches (COW layer)
   * Tries current branch first, then walks commit history
   * @protected - Available to subclasses for COW implementation
   */
  protected async readWithInheritance(path: string, branch?: string): Promise<any | null> {
    if (!this.cowEnabled) {
      // COW disabled: check write cache, then direct read
      // v5.7.2: Check cache first for read-after-write consistency
      const cachedData = this.writeCache.get(path)
      if (cachedData !== undefined) {
        return cachedData
      }
      return this.readObjectFromPath(path)
    }

    const targetBranch = branch || this.currentBranch || 'main'
    const branchPath = this.resolveBranchPath(path, targetBranch)

    // v5.7.2: Check write cache FIRST (synchronous, instant)
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

    // v5.7.2: Remove from write cache immediately (before async delete)
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
   * List objects with inheritance (v5.0.1)
   * Lists objects from current branch AND main branch, returns unique paths
   * This enables fork to see parent's data in pagination operations
   *
   * Simplified approach: All branches inherit from main
   */
  protected async listObjectsWithInheritance(prefix: string, branch?: string): Promise<string[]> {
    if (!this.cowEnabled) {
      return this.listObjectsInBranch(prefix, branch)
    }

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
   * Save a noun to storage (v4.0.0: vector only, metadata saved separately)
   * @param noun Pure HNSW vector data (no metadata)
   */
  public async saveNoun(noun: HNSWNoun): Promise<void> {
    await this.ensureInitialized()

    // Save the HNSWNoun vector data only
    // Metadata must be saved separately via saveNounMetadata()
    await this.saveNoun_internal(noun)
  }

  /**
   * Get a noun from storage (v4.0.0: returns combined HNSWNounWithMetadata)
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
      prodLog.warn(`[Storage] Noun ${id} has vector but no metadata - this should not happen in v4.0.0`)
      return null
    }

    // Combine into HNSWNounWithMetadata - v4.8.0: Extract standard fields to top-level
    const { noun, createdAt, updatedAt, confidence, weight, service, data, createdBy, ...customMetadata } = metadata

    return {
      id: vector.id,
      vector: vector.vector,
      connections: vector.connections,
      level: vector.level,
      // v4.8.0: Standard fields at top-level
      type: (noun as NounType) || NounType.Thing,
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
   * Get nouns by noun type
   * @param nounType The noun type to filter by
   * @returns Promise that resolves to an array of nouns of the specified noun type
   */
  public async getNounsByNounType(nounType: string): Promise<HNSWNounWithMetadata[]> {
    await this.ensureInitialized()

    // Internal method returns HNSWNoun[], need to combine with metadata
    const nouns = await this.getNounsByNounType_internal(nounType)

    // Combine each noun with its metadata - v4.8.0: Extract standard fields to top-level
    const nounsWithMetadata: HNSWNounWithMetadata[] = []
    for (const noun of nouns) {
      const metadata = await this.getNounMetadata(noun.id)
      if (metadata) {
        const { noun: nounType, createdAt, updatedAt, confidence, weight, service, data, createdBy, ...customMetadata } = metadata

        nounsWithMetadata.push({
          ...noun,
          // v4.8.0: Standard fields at top-level
          type: (nounType as NounType) || NounType.Thing,
          createdAt: (createdAt as number) || Date.now(),
          updatedAt: (updatedAt as number) || Date.now(),
          confidence: confidence as number | undefined,
          weight: weight as number | undefined,
          service: service as string | undefined,
          data: data as Record<string, any> | undefined,
          createdBy,
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
   * Save a verb to storage (v4.0.0: verb only, metadata saved separately)
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
   * Get a verb from storage (v4.0.0: returns combined HNSWVerbWithMetadata)
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
      prodLog.warn(`[Storage] Verb ${id} has vector but no metadata - this should not happen in v4.0.0`)
      return null
    }

    // Combine into HNSWVerbWithMetadata - v4.8.0: Extract standard fields to top-level
    const { createdAt, updatedAt, confidence, weight, service, data, createdBy, ...customMetadata } = metadata

    return {
      id: verb.id,
      vector: verb.vector,
      connections: verb.connections,
      verb: verb.verb,
      sourceId: verb.sourceId,
      targetId: verb.targetId,
      // v4.8.0: Standard fields at top-level
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

    // v4.0.0: Convert HNSWVerbWithMetadata to HNSWVerb (strip metadata)
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

        // Apply pagination
        const paginatedNouns = nounsByType.slice(offset, offset + limit)
        const hasMore = offset + limit < nounsByType.length

        // Set next cursor if there are more items
        let nextCursor: string | undefined = undefined
        if (hasMore && paginatedNouns.length > 0) {
          const lastItem = paginatedNouns[paginatedNouns.length - 1]
          nextCursor = lastItem.id
        }

        return {
          items: paginatedNouns,
          totalCount: nounsByType.length,
          hasMore,
          nextCursor
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
        // Use the adapter's paginated method - pass offset directly to adapter
        const result = await (this as any).getNounsWithPagination({
          limit,
          offset,  // Let the adapter handle offset for O(1) operation
          cursor,
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
          nextCursor: result.nextCursor
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
   * Get nouns with pagination (v5.4.0: Type-first implementation)
   *
   * CRITICAL: This method is required for brain.find() to work!
   * Iterates through noun types with billion-scale optimizations.
   *
   * ARCHITECTURE: Reads storage directly (not indexes) to avoid circular dependencies.
   * Storage → Indexes (one direction only). GraphAdjacencyIndex built FROM storage.
   *
   * OPTIMIZATIONS (v5.5.0):
   * - Skip empty types using nounCountsByType[] tracking (O(1) check)
   * - Early termination when offset + limit entities collected
   * - Memory efficient: Never loads full dataset
   */
  public async getNounsWithPagination(options: {
    limit: number
    offset: number
    cursor?: string
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
    const targetCount = offset + limit  // Early termination target

    // v5.5.0 BUG FIX: Only use optimization if counts are reliable
    const totalNounCountFromArray = this.nounCountsByType.reduce((sum, c) => sum + c, 0)
    const useOptimization = totalNounCountFromArray > 0

    // v5.5.0: Iterate through noun types with billion-scale optimizations
    for (let i = 0; i < NOUN_TYPE_COUNT && collectedNouns.length < targetCount; i++) {
      // OPTIMIZATION 1: Skip empty types (only if counts are reliable)
      if (useOptimization && this.nounCountsByType[i] === 0) {
        continue
      }

      const type = TypeUtils.getNounFromIndex(i)

      // If filtering by type, skip other types
      if (filter?.nounType) {
        const filterTypes = Array.isArray(filter.nounType) ? filter.nounType : [filter.nounType]
        if (!filterTypes.includes(type)) {
          continue
        }
      }

      const typeDir = `entities/nouns/${type}/vectors`

      try {
        // List all noun files for this type
        const nounFiles = await this.listObjectsInBranch(typeDir)

        for (const nounPath of nounFiles) {
          // OPTIMIZATION 2: Early termination (stop when we have enough)
          if (collectedNouns.length >= targetCount) {
            break
          }

          // Skip if not a .json file
          if (!nounPath.endsWith('.json')) continue

          try {
            const noun = await this.readWithInheritance(nounPath)
            if (noun) {
              // Load metadata
              const metadataPath = getNounMetadataPath(type, noun.id)
              const metadata = await this.readWithInheritance(metadataPath)

              if (metadata) {
                // Apply service filter if specified
                if (filter?.service) {
                  const services = Array.isArray(filter.service) ? filter.service : [filter.service]
                  if (metadata.service && !services.includes(metadata.service)) {
                    continue
                  }
                }

                // Combine noun + metadata (v5.4.0: Extract standard fields to top-level)
                collectedNouns.push({
                  ...noun,
                  type: metadata.noun || type,  // Required: Extract type from metadata
                  confidence: metadata.confidence,
                  weight: metadata.weight,
                  createdAt: metadata.createdAt
                    ? (typeof metadata.createdAt === 'number' ? metadata.createdAt : metadata.createdAt.seconds * 1000)
                    : Date.now(),
                  updatedAt: metadata.updatedAt
                    ? (typeof metadata.updatedAt === 'number' ? metadata.updatedAt : metadata.updatedAt.seconds * 1000)
                    : Date.now(),
                  service: metadata.service,
                  data: metadata.data,
                  createdBy: metadata.createdBy,
                  metadata: metadata || {} as NounMetadata
                })
              }
            }
          } catch (error) {
            // Skip nouns that fail to load
          }
        }
      } catch (error) {
        // Skip types that have no data
      }
    }

    // Apply pagination (v5.5.0: Efficient slicing after early termination)
    const paginatedNouns = collectedNouns.slice(offset, offset + limit)
    const hasMore = collectedNouns.length >= targetCount

    return {
      items: paginatedNouns,
      totalCount: collectedNouns.length,  // Accurate count of collected results
      hasMore,
      nextCursor: hasMore && paginatedNouns.length > 0
        ? paginatedNouns[paginatedNouns.length - 1].id
        : undefined
    }
  }

  /**
   * Get verbs with pagination (v5.5.0: Type-first implementation with billion-scale optimizations)
   *
   * CRITICAL: This method is required for brain.getRelations() to work!
   * Iterates through verb types with the same optimizations as nouns.
   *
   * ARCHITECTURE: Reads storage directly (not indexes) to avoid circular dependencies.
   * Storage → Indexes (one direction only). GraphAdjacencyIndex built FROM storage.
   *
   * OPTIMIZATIONS (v5.5.0):
   * - Skip empty types using verbCountsByType[] tracking (O(1) check)
   * - Early termination when offset + limit verbs collected
   * - Memory efficient: Never loads full dataset
   * - Inline filtering for sourceId, targetId, verbType
   */
  public async getVerbsWithPagination(options: {
    limit: number
    offset: number
    cursor?: string
    filter?: {
      verbType?: string | string[]
      sourceId?: string | string[]
      targetId?: string | string[]
      service?: string | string[]
      metadata?: Record<string, any>
    }
  }): Promise<{
    items: HNSWVerbWithMetadata[]
    totalCount: number
    hasMore: boolean
    nextCursor?: string
  }> {
    await this.ensureInitialized()

    const { limit, offset = 0, filter } = options
    const collectedVerbs: HNSWVerbWithMetadata[] = []
    const targetCount = offset + limit  // Early termination target

    // v5.5.0 BUG FIX: Only use optimization if counts are reliable
    const totalVerbCountFromArray = this.verbCountsByType.reduce((sum, c) => sum + c, 0)
    const useOptimization = totalVerbCountFromArray > 0

    // v5.5.0: Iterate through verb types with billion-scale optimizations
    for (let i = 0; i < VERB_TYPE_COUNT && collectedVerbs.length < targetCount; i++) {
      // OPTIMIZATION 1: Skip empty types (only if counts are reliable)
      if (useOptimization && this.verbCountsByType[i] === 0) {
        continue
      }

      const type = TypeUtils.getVerbFromIndex(i)

      // If filtering by verbType, skip other types
      if (filter?.verbType) {
        const filterTypes = Array.isArray(filter.verbType) ? filter.verbType : [filter.verbType]
        if (!filterTypes.includes(type)) {
          continue
        }
      }

      try {
        const verbsOfType = await this.getVerbsByType_internal(type)

        // Apply filtering inline (memory efficient)
        for (const verb of verbsOfType) {
          // OPTIMIZATION 2: Early termination (stop when we have enough)
          if (collectedVerbs.length >= targetCount) {
            break
          }

          // Apply filters if specified
          if (filter) {
            // Filter by sourceId
            if (filter.sourceId) {
              const sourceIds = Array.isArray(filter.sourceId)
                ? filter.sourceId
                : [filter.sourceId]
              if (!sourceIds.includes(verb.sourceId)) {
                continue
              }
            }

            // Filter by targetId
            if (filter.targetId) {
              const targetIds = Array.isArray(filter.targetId)
                ? filter.targetId
                : [filter.targetId]
              if (!targetIds.includes(verb.targetId)) {
                continue
              }
            }
          }

          // Verb passed all filters - add to collection
          collectedVerbs.push(verb)
        }
      } catch (error) {
        // Skip types that have no data (directory may not exist)
      }
    }

    // Apply pagination (v5.5.0: Efficient slicing after early termination)
    const paginatedVerbs = collectedVerbs.slice(offset, offset + limit)
    const hasMore = collectedVerbs.length >= targetCount

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

    // Optimize for common filter cases to avoid loading all verbs
    if (options?.filter) {
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

      // v5.5.0 BUG FIX: Check if optimization should be used
      // Only use type-skipping optimization if counts are non-zero (reliable)
      const totalVerbCountFromArray = this.verbCountsByType.reduce((sum, c) => sum + c, 0)
      const useOptimization = totalVerbCountFromArray > 0

      // Iterate through all 127 verb types (Stage 3 CANONICAL) with early termination
      // OPTIMIZATION: Skip types with zero count (only if counts are reliable)
      for (let i = 0; i < VERB_TYPE_COUNT && collectedVerbs.length < targetCount; i++) {
        // Skip empty types for performance (but only if optimization is enabled)
        if (useOptimization && this.verbCountsByType[i] === 0) {
          continue
        }

        const type = TypeUtils.getVerbFromIndex(i)
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
      const hasMore = collectedVerbs.length >= targetCount

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
   * v5.7.1: Fixed race condition where concurrent calls could trigger multiple rebuilds
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

  /**
   * Save metadata to storage (v4.0.0: now typed)
   * Routes to correct location (system or entity) based on key format
   */
  public async saveMetadata(id: string, metadata: NounMetadata): Promise<void> {
    await this.ensureInitialized()
    const keyInfo = this.analyzeKey(id, 'system')
    return this.writeObjectToBranch(keyInfo.fullPath, metadata)
  }

  /**
   * Get metadata from storage (v4.0.0: now typed)
   * Routes to correct location (system or entity) based on key format
   */
  public async getMetadata(id: string): Promise<NounMetadata | null> {
    await this.ensureInitialized()
    const keyInfo = this.analyzeKey(id, 'system')
    return this.readWithInheritance(keyInfo.fullPath)
  }

  /**
   * Save noun metadata to storage (v4.0.0: now typed)
   * Routes to correct sharded location based on UUID
   */
  public async saveNounMetadata(id: string, metadata: NounMetadata): Promise<void> {
    // Validate noun type in metadata - storage boundary protection
    validateNounType(metadata.noun)
    return this.saveNounMetadata_internal(id, metadata)
  }

  /**
   * Internal method for saving noun metadata (v4.0.0: now typed)
   * Uses routing logic to handle both UUIDs (sharded) and system keys (unsharded)
   *
   * CRITICAL (v4.1.2): Count synchronization happens here
   * This ensures counts are updated AFTER metadata exists, fixing the race condition
   * where storage adapters tried to read metadata before it was saved.
   *
   * @protected
   */
  protected async saveNounMetadata_internal(id: string, metadata: NounMetadata): Promise<void> {
    await this.ensureInitialized()

    // v5.4.0: Extract and cache type for type-first routing
    const type = (metadata.noun || 'thing') as NounType
    this.nounTypeCache.set(id, type)

    // v5.4.0: Use type-first path
    const path = getNounMetadataPath(type, id)

    // Determine if this is a new entity by checking if metadata already exists
    const existingMetadata = await this.readWithInheritance(path)
    const isNew = !existingMetadata

    // Save the metadata (COW-aware - writes to branch-specific path)
    await this.writeObjectToBranch(path, metadata)

    // CRITICAL FIX (v4.1.2): Increment count for new entities
    // This runs AFTER metadata is saved, guaranteeing type information is available
    // Uses synchronous increment since storage operations are already serialized
    // Fixes Bug #1: Count synchronization failure during add() and import()
    if (isNew && metadata.noun) {
      this.incrementEntityCount(metadata.noun)
      // Persist counts asynchronously (fire and forget)
      this.scheduleCountPersist().catch(() => {
        // Ignore persist errors - will retry on next operation
      })
    }
  }

  /**
   * Get noun metadata from storage (v4.0.0: now typed)
   * v5.4.0: Uses type-first paths (must match saveNounMetadata_internal)
   */
  public async getNounMetadata(id: string): Promise<NounMetadata | null> {
    await this.ensureInitialized()

    // v5.4.0: Check type cache first (populated during save)
    const cachedType = this.nounTypeCache.get(id)
    if (cachedType) {
      const path = getNounMetadataPath(cachedType, id)
      return this.readWithInheritance(path)
    }

    // Fallback: search across all types (expensive but necessary if cache miss)
    for (let i = 0; i < NOUN_TYPE_COUNT; i++) {
      const type = TypeUtils.getNounFromIndex(i)
      const path = getNounMetadataPath(type, id)

      try {
        const metadata = await this.readWithInheritance(path)
        if (metadata) {
          // Cache the type for next time
          this.nounTypeCache.set(id, type)
          return metadata
        }
      } catch (error) {
        // Not in this type, continue searching
      }
    }

    return null
  }

  /**
   * Delete noun metadata from storage
   * v5.4.0: Uses type-first paths (must match saveNounMetadata_internal)
   */
  public async deleteNounMetadata(id: string): Promise<void> {
    await this.ensureInitialized()

    // v5.4.0: Use cached type for path
    const cachedType = this.nounTypeCache.get(id)
    if (cachedType) {
      const path = getNounMetadataPath(cachedType, id)
      await this.deleteObjectFromBranch(path)
      // Remove from cache after deletion
      this.nounTypeCache.delete(id)
      return
    }

    // If not in cache, search all types to find and delete
    for (let i = 0; i < NOUN_TYPE_COUNT; i++) {
      const type = TypeUtils.getNounFromIndex(i)
      const path = getNounMetadataPath(type, id)

      try {
        // Check if exists before deleting
        const exists = await this.readWithInheritance(path)
        if (exists) {
          await this.deleteObjectFromBranch(path)
          return
        }
      } catch (error) {
        // Not in this type, continue searching
      }
    }
  }

  /**
   * Save verb metadata to storage (v4.0.0: now typed)
   * Routes to correct sharded location based on UUID
   */
  public async saveVerbMetadata(id: string, metadata: VerbMetadata): Promise<void> {
    // Note: verb type is in HNSWVerb, not metadata
    return this.saveVerbMetadata_internal(id, metadata)
  }

  /**
   * Internal method for saving verb metadata (v4.0.0: now typed)
   * v5.4.0: Uses type-first paths (must match getVerbMetadata)
   *
   * CRITICAL (v4.1.2): Count synchronization happens here
   * This ensures verb counts are updated AFTER metadata exists, fixing the race condition
   * where storage adapters tried to read metadata before it was saved.
   *
   * Note: Verb type is now stored in both HNSWVerb (vector file) and VerbMetadata for count tracking
   *
   * @protected
   */
  protected async saveVerbMetadata_internal(id: string, metadata: VerbMetadata): Promise<void> {
    await this.ensureInitialized()

    // v5.4.0: Extract verb type from metadata for type-first path
    const verbType = (metadata as any).verb as VerbType | undefined

    if (!verbType) {
      // Backward compatibility: fallback to old path if no verb type
      const keyInfo = this.analyzeKey(id, 'verb-metadata')
      await this.writeObjectToBranch(keyInfo.fullPath, metadata)
      return
    }

    // v5.4.0: Use type-first path
    const path = getVerbMetadataPath(verbType, id)

    // Determine if this is a new verb by checking if metadata already exists
    const existingMetadata = await this.readWithInheritance(path)
    const isNew = !existingMetadata

    // Save the metadata (COW-aware - writes to branch-specific path)
    await this.writeObjectToBranch(path, metadata)

    // v5.4.0: Cache verb type for faster lookups
    this.verbTypeCache.set(id, verbType)

    // CRITICAL FIX (v4.1.2): Increment verb count for new relationships
    // This runs AFTER metadata is saved
    // Uses synchronous increment since storage operations are already serialized
    // Fixes Bug #2: Count synchronization failure during relate() and import()
    if (isNew) {
      this.incrementVerbCount(verbType)
      // Persist counts asynchronously (fire and forget)
      this.scheduleCountPersist().catch(() => {
        // Ignore persist errors - will retry on next operation
      })
    }
  }

  /**
   * Get verb metadata from storage (v4.0.0: now typed)
   * v5.4.0: Uses type-first paths (must match saveVerbMetadata_internal)
   */
  public async getVerbMetadata(id: string): Promise<VerbMetadata | null> {
    await this.ensureInitialized()

    // v5.4.0: Check type cache first (populated during save)
    const cachedType = this.verbTypeCache.get(id)
    if (cachedType) {
      const path = getVerbMetadataPath(cachedType, id)
      return this.readWithInheritance(path)
    }

    // Fallback: search across all types (expensive but necessary if cache miss)
    for (let i = 0; i < VERB_TYPE_COUNT; i++) {
      const type = TypeUtils.getVerbFromIndex(i)
      const path = getVerbMetadataPath(type, id)

      try {
        const metadata = await this.readWithInheritance(path)
        if (metadata) {
          // Cache the type for next time
          this.verbTypeCache.set(id, type)
          return metadata
        }
      } catch (error) {
        // Not in this type, continue searching
      }
    }

    return null
  }

  /**
   * Delete verb metadata from storage
   * v5.4.0: Uses type-first paths (must match saveVerbMetadata_internal)
   */
  public async deleteVerbMetadata(id: string): Promise<void> {
    await this.ensureInitialized()

    // v5.4.0: Use cached type for path
    const cachedType = this.verbTypeCache.get(id)
    if (cachedType) {
      const path = getVerbMetadataPath(cachedType, id)
      await this.deleteObjectFromBranch(path)
      // Remove from cache after deletion
      this.verbTypeCache.delete(id)
      return
    }

    // If not in cache, search all types to find and delete
    for (let i = 0; i < VERB_TYPE_COUNT; i++) {
      const type = TypeUtils.getVerbFromIndex(i)
      const path = getVerbMetadataPath(type, id)

      try {
        // Check if exists before deleting
        const exists = await this.readWithInheritance(path)
        if (exists) {
          await this.deleteObjectFromBranch(path)
          return
        }
      } catch (error) {
        // Not in this type, continue searching
      }
    }
  }

  // ============================================================================
  // TYPE-FIRST HELPER METHODS (v5.4.0)
  // Built-in type-aware support for all storage adapters
  // ============================================================================

  /**
   * Load type statistics from storage
   * Rebuilds type counts if needed (called during init)
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
      }
    } catch (error) {
      // No existing type statistics, starting fresh
    }
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
   * Rebuild type counts from actual storage (v5.5.0)
   * Called when statistics are missing or inconsistent
   * Ensures verbCountsByType is always accurate for reliable pagination
   */
  protected async rebuildTypeCounts(): Promise<void> {
    prodLog.info('[BaseStorage] Rebuilding type counts from storage...')

    // Rebuild verb counts by checking each type directory
    for (let i = 0; i < VERB_TYPE_COUNT; i++) {
      const type = TypeUtils.getVerbFromIndex(i)
      const prefix = `entities/verbs/${type}/vectors/`

      try {
        const paths = await this.listObjectsInBranch(prefix)
        this.verbCountsByType[i] = paths.length
      } catch (error) {
        // Type directory doesn't exist - count is 0
        this.verbCountsByType[i] = 0
      }
    }

    // Rebuild noun counts similarly
    for (let i = 0; i < NOUN_TYPE_COUNT; i++) {
      const type = TypeUtils.getNounFromIndex(i)
      const prefix = `entities/nouns/${type}/vectors/`

      try {
        const paths = await this.listObjectsInBranch(prefix)
        this.nounCountsByType[i] = paths.length
      } catch (error) {
        // Type directory doesn't exist - count is 0
        this.nounCountsByType[i] = 0
      }
    }

    // Save rebuilt counts to storage
    await this.saveTypeStatistics()

    const totalVerbs = this.verbCountsByType.reduce((sum, count) => sum + count, 0)
    const totalNouns = this.nounCountsByType.reduce((sum, count) => sum + count, 0)
    prodLog.info(`[BaseStorage] Rebuilt counts: ${totalNouns} nouns, ${totalVerbs} verbs`)
  }

  /**
   * Get noun type from cache or metadata
   * Relies on nounTypeCache populated during metadata saves
   */
  protected getNounType(noun: HNSWNoun): NounType {
    // Check cache (populated when metadata is saved)
    const cached = this.nounTypeCache.get(noun.id)
    if (cached) {
      return cached
    }

    // Default to 'thing' if unknown
    // This should only happen if saveNoun_internal is called before saveNounMetadata
    prodLog.warn(`[BaseStorage] Unknown noun type for ${noun.id}, defaulting to 'thing'`)
    return 'thing'
  }

  /**
   * Get verb type from verb object
   * Verb type is a required field in HNSWVerb
   */
  protected getVerbType(verb: HNSWVerb | GraphVerb): VerbType {
    // v3.50.1+: verb is a required field in HNSWVerb
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
  // ABSTRACT METHOD IMPLEMENTATIONS (v5.4.0)
  // Converted from abstract to concrete - all adapters now have built-in type-aware
  // ============================================================================

  /**
   * Save a noun to storage (type-first path)
   */
  protected async saveNoun_internal(noun: HNSWNoun): Promise<void> {
    const type = this.getNounType(noun)
    const path = getNounVectorPath(type, noun.id)

    // Update type tracking
    const typeIndex = TypeUtils.getNounIndex(type)
    this.nounCountsByType[typeIndex]++
    this.nounTypeCache.set(noun.id, type)

    // COW-aware write (v5.0.1): Use COW helper for branch isolation
    await this.writeObjectToBranch(path, noun)

    // Periodically save statistics (every 100 saves)
    if (this.nounCountsByType[typeIndex] % 100 === 0) {
      await this.saveTypeStatistics()
    }
  }

  /**
   * Get a noun from storage (type-first path)
   */
  protected async getNoun_internal(id: string): Promise<HNSWNoun | null> {
    // Try cache first
    const cachedType = this.nounTypeCache.get(id)
    if (cachedType) {
      const path = getNounVectorPath(cachedType, id)
      // COW-aware read (v5.0.1): Use COW helper for branch isolation
      return await this.readWithInheritance(path)
    }

    // Need to search across all types (expensive, but cached after first access)
    for (let i = 0; i < NOUN_TYPE_COUNT; i++) {
      const type = TypeUtils.getNounFromIndex(i)
      const path = getNounVectorPath(type, id)

      try {
        // COW-aware read (v5.0.1): Use COW helper for branch isolation
        const noun = await this.readWithInheritance(path)
        if (noun) {
          // Cache the type for next time
          this.nounTypeCache.set(id, type)
          return noun
        }
      } catch (error) {
        // Not in this type, continue searching
      }
    }

    return null
  }

  /**
   * Get nouns by noun type (O(1) with type-first paths!)
   */
  protected async getNounsByNounType_internal(
    nounType: string
  ): Promise<HNSWNoun[]> {
    const type = nounType as NounType
    const prefix = `entities/nouns/${type}/vectors/`

    // COW-aware list (v5.0.1): Use COW helper for branch isolation
    const paths = await this.listObjectsInBranch(prefix)

    // Load all nouns of this type
    const nouns: HNSWNoun[] = []
    for (const path of paths) {
      try {
        // COW-aware read (v5.0.1): Use COW helper for branch isolation
        const noun = await this.readWithInheritance(path)
        if (noun) {
          nouns.push(noun)
          // Cache the type
          this.nounTypeCache.set(noun.id, type)
        }
      } catch (error) {
        prodLog.warn(`[BaseStorage] Failed to load noun from ${path}:`, error)
      }
    }

    return nouns
  }

  /**
   * Delete a noun from storage (type-first path)
   */
  protected async deleteNoun_internal(id: string): Promise<void> {
    // Try cache first
    const cachedType = this.nounTypeCache.get(id)
    if (cachedType) {
      const path = getNounVectorPath(cachedType, id)
      // COW-aware delete (v5.0.1): Use COW helper for branch isolation
      await this.deleteObjectFromBranch(path)

      // Update counts
      const typeIndex = TypeUtils.getNounIndex(cachedType)
      if (this.nounCountsByType[typeIndex] > 0) {
        this.nounCountsByType[typeIndex]--
      }
      this.nounTypeCache.delete(id)
      return
    }

    // Search across all types
    for (let i = 0; i < NOUN_TYPE_COUNT; i++) {
      const type = TypeUtils.getNounFromIndex(i)
      const path = getNounVectorPath(type, id)

      try {
        // COW-aware delete (v5.0.1): Use COW helper for branch isolation
        await this.deleteObjectFromBranch(path)

        // Update counts
        if (this.nounCountsByType[i] > 0) {
          this.nounCountsByType[i]--
        }
        this.nounTypeCache.delete(id)
        return
      } catch (error) {
        // Not in this type, continue
      }
    }
  }

  /**
   * Save a verb to storage (type-first path)
   */
  protected async saveVerb_internal(verb: HNSWVerb): Promise<void> {
    // Type is now a first-class field in HNSWVerb - no caching needed!
    const type = verb.verb as VerbType
    const path = getVerbVectorPath(type, verb.id)

    // Update type tracking
    const typeIndex = TypeUtils.getVerbIndex(type)
    this.verbCountsByType[typeIndex]++
    this.verbTypeCache.set(verb.id, type)

    // COW-aware write (v5.0.1): Use COW helper for branch isolation
    await this.writeObjectToBranch(path, verb)

    // v5.7.0: Update GraphAdjacencyIndex incrementally for billion-scale optimization
    // CRITICAL: Only update if index already initialized to avoid circular dependency
    // Index is lazy-loaded on first query, then maintained incrementally
    if (this.graphIndex && this.graphIndex.isInitialized) {
      // Fast incremental update - no rebuild needed
      await this.graphIndex.addVerb({
        id: verb.id,
        sourceId: verb.sourceId,
        targetId: verb.targetId,
        vector: verb.vector,
        source: verb.sourceId,
        target: verb.targetId,
        verb: verb.verb,
        type: verb.verb,
        createdAt: { seconds: Math.floor(Date.now() / 1000), nanoseconds: 0 },
        updatedAt: { seconds: Math.floor(Date.now() / 1000), nanoseconds: 0 },
        createdBy: { augmentation: 'storage', version: '5.7.0' }
      })
    }

    // Periodically save statistics
    if (this.verbCountsByType[typeIndex] % 100 === 0) {
      await this.saveTypeStatistics()
    }
  }

  /**
   * Get a verb from storage (type-first path)
   */
  protected async getVerb_internal(id: string): Promise<HNSWVerb | null> {
    // Try cache first for O(1) retrieval
    const cachedType = this.verbTypeCache.get(id)
    if (cachedType) {
      const path = getVerbVectorPath(cachedType, id)
      // COW-aware read (v5.0.1): Use COW helper for branch isolation
      const verb = await this.readWithInheritance(path)
      return verb
    }

    // Search across all types (only on first access)
    for (let i = 0; i < VERB_TYPE_COUNT; i++) {
      const type = TypeUtils.getVerbFromIndex(i)
      const path = getVerbVectorPath(type, id)

      try {
        // COW-aware read (v5.0.1): Use COW helper for branch isolation
        const verb = await this.readWithInheritance(path)
        if (verb) {
          // Cache the type for next time (read from verb.verb field)
          this.verbTypeCache.set(id, verb.verb as VerbType)
          return verb
        }
      } catch (error) {
        // Not in this type, continue
      }
    }

    return null
  }

  /**
   * Get verbs by source (COW-aware implementation)
   * v5.4.0: Fixed to directly list verb files instead of directories
   */
  protected async getVerbsBySource_internal(
    sourceId: string
  ): Promise<HNSWVerbWithMetadata[]> {
    // v5.7.1: Reverted to v5.6.3 implementation to fix circular dependency deadlock
    // v5.7.0 called getGraphIndex() here, creating deadlock during initialization:
    //   GraphAdjacencyIndex.rebuild() → storage.getVerbs() → getVerbsBySource_internal() → getGraphIndex() → [deadlock]
    // v5.4.0: Type-first implementation - scan across all verb types
    // COW-aware: uses readWithInheritance for each verb
    await this.ensureInitialized()

    const results: HNSWVerbWithMetadata[] = []

    // Iterate through all verb types
    for (let i = 0; i < VERB_TYPE_COUNT; i++) {
      const type = TypeUtils.getVerbFromIndex(i)
      const typeDir = `entities/verbs/${type}/vectors`

      try {
        // v5.4.0 FIX: List all verb files directly (not shard directories)
        // listObjectsInBranch returns full paths to .json files, not directories
        const verbFiles = await this.listObjectsInBranch(typeDir)

        for (const verbPath of verbFiles) {
          // Skip if not a .json file
          if (!verbPath.endsWith('.json')) continue

          try {
            const verb = await this.readWithInheritance(verbPath)
            if (verb && verb.sourceId === sourceId) {
              // v5.4.0: Use proper path helper instead of string replacement
              const metadataPath = getVerbMetadataPath(type, verb.id)
              const metadata = await this.readWithInheritance(metadataPath)

              // v5.4.0: Extract standard fields from metadata to top-level (like nouns)
              results.push({
                ...verb,
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
        // Skip types that have no data
      }
    }

    return results
  }

  /**
   * Get verbs by target (COW-aware implementation)
   * v5.7.1: Reverted to v5.6.3 implementation to fix circular dependency deadlock
   * v5.4.0: Fixed to directly list verb files instead of directories
   */
  protected async getVerbsByTarget_internal(
    targetId: string
  ): Promise<HNSWVerbWithMetadata[]> {
    // v5.7.1: Reverted to v5.6.3 implementation to fix circular dependency deadlock
    // v5.7.0 called getGraphIndex() here, creating deadlock during initialization
    // v5.4.0: Type-first implementation - scan across all verb types
    // COW-aware: uses readWithInheritance for each verb
    await this.ensureInitialized()

    const results: HNSWVerbWithMetadata[] = []

    // Iterate through all verb types
    for (let i = 0; i < VERB_TYPE_COUNT; i++) {
      const type = TypeUtils.getVerbFromIndex(i)
      const typeDir = `entities/verbs/${type}/vectors`

      try {
        // v5.4.0 FIX: List all verb files directly (not shard directories)
        // listObjectsInBranch returns full paths to .json files, not directories
        const verbFiles = await this.listObjectsInBranch(typeDir)

        for (const verbPath of verbFiles) {
          // Skip if not a .json file
          if (!verbPath.endsWith('.json')) continue

          try {
            const verb = await this.readWithInheritance(verbPath)
            if (verb && verb.targetId === targetId) {
              // v5.4.0: Use proper path helper instead of string replacement
              const metadataPath = getVerbMetadataPath(type, verb.id)
              const metadata = await this.readWithInheritance(metadataPath)

              // v5.4.0: Extract standard fields from metadata to top-level (like nouns)
              results.push({
                ...verb,
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
        // Skip types that have no data
      }
    }

    return results
  }

  /**
   * Get verbs by type (O(1) with type-first paths!)
   */
  protected async getVerbsByType_internal(verbType: string): Promise<HNSWVerbWithMetadata[]> {
    const type = verbType as VerbType
    const prefix = `entities/verbs/${type}/vectors/`

    // COW-aware list (v5.0.1): Use COW helper for branch isolation
    const paths = await this.listObjectsInBranch(prefix)
    const verbs: HNSWVerbWithMetadata[] = []

    for (const path of paths) {
      try {
        // COW-aware read (v5.0.1): Use COW helper for branch isolation
        const hnswVerb = await this.readWithInheritance(path)
        if (!hnswVerb) continue

        // Cache type from HNSWVerb for future O(1) retrievals
        this.verbTypeCache.set(hnswVerb.id, hnswVerb.verb as VerbType)

        // Load metadata separately (optional in v4.0.0!)
        // FIX: Don't skip verbs without metadata - metadata is optional!
        const metadata = await this.getVerbMetadata(hnswVerb.id)

        // Create HNSWVerbWithMetadata (verbs don't have level field)
        // Convert connections from plain object to Map<number, Set<string>>
        const connectionsMap = new Map<number, Set<string>>()
        if (hnswVerb.connections && typeof hnswVerb.connections === 'object') {
          for (const [level, ids] of Object.entries(hnswVerb.connections)) {
            connectionsMap.set(Number(level), new Set(ids as string[]))
          }
        }

        // v4.8.0: Extract standard fields from metadata to top-level
        const metadataObj = (metadata || {}) as VerbMetadata
        const { createdAt, updatedAt, confidence, weight, service, data, createdBy, ...customMetadata } = metadataObj

        const verbWithMetadata: HNSWVerbWithMetadata = {
          id: hnswVerb.id,
          vector: [...hnswVerb.vector],
          connections: connectionsMap,
          verb: hnswVerb.verb,
          sourceId: hnswVerb.sourceId,
          targetId: hnswVerb.targetId,
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
        prodLog.warn(`[BaseStorage] Failed to load verb from ${path}:`, error)
      }
    }

    return verbs
  }

  /**
   * Delete a verb from storage (type-first path)
   */
  protected async deleteVerb_internal(id: string): Promise<void> {
    // Try cache first
    const cachedType = this.verbTypeCache.get(id)
    if (cachedType) {
      const path = getVerbVectorPath(cachedType, id)
      // COW-aware delete (v5.0.1): Use COW helper for branch isolation
      await this.deleteObjectFromBranch(path)

      const typeIndex = TypeUtils.getVerbIndex(cachedType)
      if (this.verbCountsByType[typeIndex] > 0) {
        this.verbCountsByType[typeIndex]--
      }
      this.verbTypeCache.delete(id)
      return
    }

    // Search across all types
    for (let i = 0; i < VERB_TYPE_COUNT; i++) {
      const type = TypeUtils.getVerbFromIndex(i)
      const path = getVerbVectorPath(type, id)

      try {
        // COW-aware delete (v5.0.1): Use COW helper for branch isolation
        await this.deleteObjectFromBranch(path)

        if (this.verbCountsByType[i] > 0) {
          this.verbCountsByType[i]--
        }
        this.verbTypeCache.delete(id)
        return
      } catch (error) {
        // Continue
      }
    }
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
