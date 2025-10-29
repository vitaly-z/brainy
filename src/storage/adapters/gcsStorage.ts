/**
 * Google Cloud Storage Adapter (Native)
 * Uses the native @google-cloud/storage library for optimal performance and authentication
 *
 * Supports multiple authentication methods:
 * 1. Application Default Credentials (ADC) - Automatic in Cloud Run/GCE
 * 2. Service Account Key File
 * 3. Service Account Credentials Object
 * 4. HMAC Keys (fallback for backward compatibility)
 */

import {
  GraphVerb,
  HNSWNoun,
  HNSWVerb,
  NounMetadata,
  VerbMetadata,
  HNSWNounWithMetadata,
  HNSWVerbWithMetadata,
  StatisticsData,
  NounType
} from '../../coreTypes.js'
import {
  BaseStorage,
  NOUNS_DIR,
  VERBS_DIR,
  METADATA_DIR,
  INDEX_DIR,
  SYSTEM_DIR,
  STATISTICS_KEY,
  getDirectoryPath
} from '../baseStorage.js'
import { BrainyError } from '../../errors/brainyError.js'
import { CacheManager } from '../cacheManager.js'
import { createModuleLogger, prodLog } from '../../utils/logger.js'
import { getGlobalSocketManager } from '../../utils/adaptiveSocketManager.js'
import { getGlobalBackpressure } from '../../utils/adaptiveBackpressure.js'
import { getWriteBuffer, WriteBuffer } from '../../utils/writeBuffer.js'
import { getCoalescer, RequestCoalescer } from '../../utils/requestCoalescer.js'
import { getShardIdFromUuid, getAllShardIds, getShardIdByIndex, TOTAL_SHARDS } from '../sharding.js'

// Type aliases for better readability
type HNSWNode = HNSWNoun
type Edge = HNSWVerb

// GCS client types - dynamically imported to avoid issues in browser environments
type Storage = any
type Bucket = any
type File = any

// GCS API limits
// Maximum value for maxResults parameter in GCS API calls
// Values above this cause "Invalid unsigned integer" errors
const MAX_GCS_PAGE_SIZE = 5000

/**
 * Native Google Cloud Storage adapter for server environments
 * Uses the @google-cloud/storage library with Application Default Credentials
 *
 * Authentication priority:
 * 1. Application Default Credentials (if no credentials provided)
 * 2. Service Account Key File (if keyFilename provided)
 * 3. Service Account Credentials Object (if credentials provided)
 * 4. HMAC Keys (if accessKeyId/secretAccessKey provided)
 */
export class GcsStorage extends BaseStorage {
  private storage: Storage | null = null
  private bucket: Bucket | null = null
  private bucketName: string
  private keyFilename?: string
  private credentials?: object
  private accessKeyId?: string
  private secretAccessKey?: string

  // Prefixes for different types of data
  private nounPrefix: string
  private verbPrefix: string
  private metadataPrefix: string  // Noun metadata
  private verbMetadataPrefix: string  // Verb metadata
  private systemPrefix: string  // System data (_system)

  // Statistics caching for better performance
  protected statisticsCache: StatisticsData | null = null

  // Backpressure and performance management
  private pendingOperations: number = 0
  private maxConcurrentOperations: number = 100
  private baseBatchSize: number = 10
  private currentBatchSize: number = 10
  private lastMemoryCheck: number = 0
  private memoryCheckInterval: number = 5000 // Check every 5 seconds
  private consecutiveErrors: number = 0
  private lastErrorReset: number = Date.now()

  // Adaptive backpressure for automatic flow control
  private backpressure = getGlobalBackpressure()

  // Write buffers for bulk operations
  private nounWriteBuffer: WriteBuffer<HNSWNode> | null = null
  private verbWriteBuffer: WriteBuffer<Edge> | null = null

  // Request coalescer for deduplication
  private requestCoalescer: RequestCoalescer | null = null

  // High-volume mode detection - MUCH more aggressive
  private highVolumeMode = false
  private lastVolumeCheck = 0
  private volumeCheckInterval = 1000  // Check every second, not 5
  private forceHighVolumeMode = false  // Environment variable override

  // Multi-level cache manager for efficient data access
  private nounCacheManager: CacheManager<HNSWNode>
  private verbCacheManager: CacheManager<Edge>

  // Module logger
  private logger = createModuleLogger('GcsStorage')

  // Configuration options
  private skipInitialScan: boolean = false
  private skipCountsFile: boolean = false

  /**
   * Initialize the storage adapter
   * @param options Configuration options for Google Cloud Storage
   */
  constructor(options: {
    bucketName: string

    // Service account authentication
    keyFilename?: string
    credentials?: object

    // HMAC authentication (backward compatibility)
    accessKeyId?: string
    secretAccessKey?: string

    // Initialization configuration
    skipInitialScan?: boolean
    skipCountsFile?: boolean

    // Cache and operation configuration
    cacheConfig?: {
      hotCacheMaxSize?: number
      hotCacheEvictionThreshold?: number
      warmCacheTTL?: number
    }
    readOnly?: boolean
  }) {
    super()
    this.bucketName = options.bucketName
    this.keyFilename = options.keyFilename
    this.credentials = options.credentials
    this.accessKeyId = options.accessKeyId
    this.secretAccessKey = options.secretAccessKey
    this.skipInitialScan = options.skipInitialScan || false
    this.skipCountsFile = options.skipCountsFile || false
    this.readOnly = options.readOnly || false

    // Set up prefixes for different types of data using entity-based structure
    this.nounPrefix = `${getDirectoryPath('noun', 'vector')}/`
    this.verbPrefix = `${getDirectoryPath('verb', 'vector')}/`
    this.metadataPrefix = `${getDirectoryPath('noun', 'metadata')}/`  // Noun metadata
    this.verbMetadataPrefix = `${getDirectoryPath('verb', 'metadata')}/`  // Verb metadata
    this.systemPrefix = `${SYSTEM_DIR}/`  // System data

    // Initialize cache managers
    this.nounCacheManager = new CacheManager<HNSWNode>(options.cacheConfig)
    this.verbCacheManager = new CacheManager<Edge>(options.cacheConfig)

    // Check for high-volume mode override
    if (typeof process !== 'undefined' && process.env?.BRAINY_FORCE_HIGH_VOLUME === 'true') {
      this.forceHighVolumeMode = true
      this.highVolumeMode = true
      prodLog.info('🚀 High-volume mode FORCED via BRAINY_FORCE_HIGH_VOLUME environment variable')
    }
  }

  /**
   * Initialize the storage adapter
   */
  public async init(): Promise<void> {
    if (this.isInitialized) {
      return
    }

    try {
      // Import Google Cloud Storage SDK only when needed
      const { Storage } = await import('@google-cloud/storage')

      // Configure the GCS client based on available credentials
      const clientConfig: any = {}

      // Priority 1: Service Account Key File
      if (this.keyFilename) {
        clientConfig.keyFilename = this.keyFilename
        prodLog.info('🔐 GCS: Using Service Account Key File')
      }
      // Priority 2: Service Account Credentials Object
      else if (this.credentials) {
        clientConfig.credentials = this.credentials
        prodLog.info('🔐 GCS: Using Service Account Credentials')
      }
      // Priority 3: HMAC Keys (S3 compatibility)
      else if (this.accessKeyId && this.secretAccessKey) {
        clientConfig.credentials = {
          client_email: 'hmac-user@example.com',
          private_key: this.secretAccessKey
        }
        prodLog.warn('⚠️  GCS: Using HMAC keys (consider migrating to ADC)')
      }
      // Priority 4: Application Default Credentials (default)
      else {
        // No credentials needed - ADC will be used automatically
        prodLog.info('🔐 GCS: Using Application Default Credentials (ADC)')
      }

      // Create the GCS client
      this.storage = new Storage(clientConfig)

      // Get reference to the bucket
      this.bucket = this.storage.bucket(this.bucketName)

      // Verify bucket exists and is accessible
      const [exists] = await this.bucket.exists()
      if (!exists) {
        throw new Error(`Bucket ${this.bucketName} does not exist or is not accessible`)
      }

      prodLog.info(`✅ Connected to GCS bucket: ${this.bucketName}`)

      // Initialize write buffers for high-volume mode
      const storageId = `gcs-${this.bucketName}`
      this.nounWriteBuffer = getWriteBuffer<HNSWNode>(
        `${storageId}-nouns`,
        'noun',
        async (items) => {
          await this.flushNounBuffer(items)
        }
      )

      this.verbWriteBuffer = getWriteBuffer<Edge>(
        `${storageId}-verbs`,
        'verb',
        async (items) => {
          await this.flushVerbBuffer(items)
        }
      )

      // Initialize request coalescer for deduplication
      this.requestCoalescer = getCoalescer(
        storageId,
        async (batch) => {
          // Process coalesced operations (placeholder for future optimization)
          this.logger.trace(`Processing coalesced batch: ${batch.length} items`)
        }
      )

      // Initialize counts from storage
      await this.initializeCounts()

      // CRITICAL FIX (v3.37.7): Clear any stale cache entries from previous runs
      // This prevents cache poisoning from causing silent failures on container restart
      prodLog.info('🧹 Clearing cache from previous run to prevent cache poisoning')
      this.nounCacheManager.clear()
      this.verbCacheManager.clear()
      prodLog.info('✅ Cache cleared - starting fresh')

      this.isInitialized = true
    } catch (error) {
      this.logger.error('Failed to initialize GCS storage:', error)
      throw new Error(`Failed to initialize GCS storage: ${error}`)
    }
  }

  /**
   * Get the GCS object key for a noun using UUID-based sharding
   *
   * Uses first 2 hex characters of UUID for consistent sharding.
   * Path format: entities/nouns/vectors/{shardId}/{uuid}.json
   *
   * @example
   * getNounKey('ab123456-1234-5678-9abc-def012345678')
   * // returns 'entities/nouns/vectors/ab/ab123456-1234-5678-9abc-def012345678.json'
   */
  private getNounKey(id: string): string {
    const shardId = getShardIdFromUuid(id)
    return `${this.nounPrefix}${shardId}/${id}.json`
  }

  /**
   * Get the GCS object key for a verb using UUID-based sharding
   *
   * Uses first 2 hex characters of UUID for consistent sharding.
   * Path format: entities/verbs/vectors/{shardId}/{uuid}.json
   *
   * @example
   * getVerbKey('cd987654-4321-8765-cba9-fed543210987')
   * // returns 'entities/verbs/vectors/cd/cd987654-4321-8765-cba9-fed543210987.json'
   */
  private getVerbKey(id: string): string {
    const shardId = getShardIdFromUuid(id)
    return `${this.verbPrefix}${shardId}/${id}.json`
  }

  /**
   * Override base class method to detect GCS-specific throttling errors
   */
  protected isThrottlingError(error: any): boolean {
    // First check base class detection
    if (super.isThrottlingError(error)) {
      return true
    }

    // GCS-specific throttling detection
    const statusCode = error.code
    const message = error.message?.toLowerCase() || ''

    return (
      statusCode === 429 || // Too Many Requests
      statusCode === 503 || // Service Unavailable
      statusCode === 'RATE_LIMIT_EXCEEDED' ||
      message.includes('quota') ||
      message.includes('rate limit') ||
      message.includes('too many requests')
    )
  }

  /**
   * Override base class to enable smart batching for cloud storage (v3.32.3+)
   *
   * GCS is cloud storage with network latency (~50ms per write).
   * Smart batching reduces writes from 1000 ops → 100 batches.
   *
   * @returns true (GCS is cloud storage)
   */
  protected isCloudStorage(): boolean {
    return true  // GCS benefits from batching
  }

  /**
   * Apply backpressure before starting an operation
   * @returns Request ID for tracking
   */
  private async applyBackpressure(): Promise<string> {
    const requestId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    await this.backpressure.requestPermission(requestId, 1)
    this.pendingOperations++
    return requestId
  }

  /**
   * Release backpressure after completing an operation
   * @param success Whether the operation succeeded
   * @param requestId Request ID from applyBackpressure()
   */
  private releaseBackpressure(success: boolean = true, requestId?: string): void {
    this.pendingOperations = Math.max(0, this.pendingOperations - 1)
    if (requestId) {
      this.backpressure.releasePermission(requestId, success)
    }
  }

  /**
   * Check if high-volume mode should be enabled
   */
  private checkVolumeMode(): void {
    if (this.forceHighVolumeMode) {
      return // Already forced on
    }

    const now = Date.now()
    if (now - this.lastVolumeCheck < this.volumeCheckInterval) {
      return
    }

    this.lastVolumeCheck = now

    // Enable high-volume mode if we have many pending operations
    const shouldEnable = this.pendingOperations > 20

    if (shouldEnable && !this.highVolumeMode) {
      this.highVolumeMode = true
      prodLog.info('🚀 High-volume mode ENABLED (pending operations:', this.pendingOperations, ')')
    } else if (!shouldEnable && this.highVolumeMode && !this.forceHighVolumeMode) {
      this.highVolumeMode = false
      prodLog.info('🐌 High-volume mode DISABLED (pending operations:', this.pendingOperations, ')')
    }
  }

  /**
   * Flush noun buffer to GCS
   */
  private async flushNounBuffer(items: Map<string, HNSWNode>): Promise<void> {
    const writes = Array.from(items.values()).map(async (noun) => {
      try {
        await this.saveNodeDirect(noun)
      } catch (error) {
        this.logger.error(`Failed to flush noun ${noun.id}:`, error)
      }
    })

    await Promise.all(writes)
  }

  /**
   * Flush verb buffer to GCS
   */
  private async flushVerbBuffer(items: Map<string, Edge>): Promise<void> {
    const writes = Array.from(items.values()).map(async (verb) => {
      try {
        await this.saveEdgeDirect(verb)
      } catch (error) {
        this.logger.error(`Failed to flush verb ${verb.id}:`, error)
      }
    })

    await Promise.all(writes)
  }

  /**
   * Save a noun to storage (internal implementation)
   */
  protected async saveNoun_internal(noun: HNSWNoun): Promise<void> {
    return this.saveNode(noun)
  }

  /**
   * Save a node to storage
   */
  protected async saveNode(node: HNSWNode): Promise<void> {
    await this.ensureInitialized()

    // ALWAYS check if we should use high-volume mode (critical for detection)
    this.checkVolumeMode()

    // Use write buffer in high-volume mode
    if (this.highVolumeMode && this.nounWriteBuffer) {
      this.logger.trace(`📝 BUFFERING: Adding noun ${node.id} to write buffer (high-volume mode active)`)
      await this.nounWriteBuffer.add(node.id, node)
      return
    } else if (!this.highVolumeMode) {
      this.logger.trace(`📝 DIRECT WRITE: Saving noun ${node.id} directly (high-volume mode inactive)`)
    }

    // Direct write in normal mode
    await this.saveNodeDirect(node)
  }

  /**
   * Save a node directly to GCS (bypass buffer)
   */
  private async saveNodeDirect(node: HNSWNode): Promise<void> {
    // Apply backpressure before starting operation
    const requestId = await this.applyBackpressure()

    try {
      this.logger.trace(`Saving node ${node.id}`)

      // Convert connections Map to a serializable format
      // CRITICAL: Only save lightweight vector data (no metadata)
      // Metadata is saved separately via saveNounMetadata() (2-file system)
      const serializableNode = {
        id: node.id,
        vector: node.vector,
        connections: Object.fromEntries(
          Array.from(node.connections.entries()).map(([level, nounIds]) => [
            level,
            Array.from(nounIds)
          ])
        ),
        level: node.level || 0
        // NO metadata field - saved separately for scalability
      }

      // Get the GCS key with UUID-based sharding
      const key = this.getNounKey(node.id)

      // Save to GCS
      const file = this.bucket!.file(key)
      await file.save(JSON.stringify(serializableNode, null, 2), {
        contentType: 'application/json',
        resumable: false // For small objects, non-resumable is faster
      })

      // CRITICAL FIX (v3.37.8): Only cache nodes with non-empty vectors
      // This prevents cache pollution from HNSW's lazy-loading nodes (vector: [])
      if (node.vector && Array.isArray(node.vector) && node.vector.length > 0) {
        this.nounCacheManager.set(node.id, node)
      }
      // Note: Empty vectors are intentional during HNSW lazy mode - not logged

      // Count tracking happens in baseStorage.saveNounMetadata_internal (v4.1.2)
      // This fixes the race condition where metadata didn't exist yet

      this.logger.trace(`Node ${node.id} saved successfully`)
      this.releaseBackpressure(true, requestId)
    } catch (error: any) {
      this.releaseBackpressure(false, requestId)

      // Handle throttling
      if (this.isThrottlingError(error)) {
        await this.handleThrottling(error)
        throw error // Re-throw for retry at higher level
      }

      this.logger.error(`Failed to save node ${node.id}:`, error)
      throw new Error(`Failed to save node ${node.id}: ${error}`)
    }
  }

  /**
   * Get a noun from storage (internal implementation)
   * v4.0.0: Returns ONLY vector data (no metadata field)
   * Base class combines with metadata via getNoun() -> HNSWNounWithMetadata
   */
  protected async getNoun_internal(id: string): Promise<HNSWNoun | null> {
    // v4.0.0: Return ONLY vector data (no metadata field)
    const node = await this.getNode(id)
    if (!node) {
      return null
    }

    // Return pure vector structure
    return node
  }

  /**
   * Get a node from storage
   */
  protected async getNode(id: string): Promise<HNSWNode | null> {
    await this.ensureInitialized()

    // Check cache first
    const cached: HNSWNode | null = await this.nounCacheManager.get(id)

    // Validate cached object before returning (v3.37.8+)
    if (cached !== undefined && cached !== null) {
      // Validate cached object has required fields (including non-empty vector!)
      if (!cached.id || !cached.vector || !Array.isArray(cached.vector) || cached.vector.length === 0) {
        // Invalid cache detected - log and auto-recover
        prodLog.warn(`[GCS] Invalid cached object for ${id.substring(0, 8)} (${
          !cached.id ? 'missing id' :
          !cached.vector ? 'missing vector' :
          !Array.isArray(cached.vector) ? 'vector not array' :
          'empty vector'
        }) - removing from cache and reloading`)
        this.nounCacheManager.delete(id)
        // Fall through to load from GCS
      } else {
        // Valid cache hit
        this.logger.trace(`Cache hit for noun ${id}`)
        return cached
      }
    } else if (cached === null) {
      prodLog.warn(`[GCS] Cache contains null for ${id.substring(0, 8)} - reloading from storage`)
    }

    // Apply backpressure
    const requestId = await this.applyBackpressure()

    try {
      this.logger.trace(`Getting node ${id}`)

      // Get the GCS key with UUID-based sharding
      const key = this.getNounKey(id)

      // Download from GCS
      const file = this.bucket!.file(key)
      const [contents] = await file.download()

      // Parse JSON
      const data = JSON.parse(contents.toString())

      // Convert serialized connections back to Map<number, Set<string>>
      const connections = new Map<number, Set<string>>()
      for (const [level, nounIds] of Object.entries(data.connections || {})) {
        connections.set(Number(level), new Set(nounIds as string[]))
      }

      // CRITICAL: Only return lightweight vector data (no metadata)
      // Metadata is retrieved separately via getNounMetadata() (2-file system)
      const node: HNSWNode = {
        id: data.id,
        vector: data.vector,
        connections,
        level: data.level || 0
        // NO metadata field - retrieved separately for scalability
      }

      // CRITICAL FIX: Only cache valid nodes with non-empty vectors (never cache null or empty)
      if (node && node.id && node.vector && Array.isArray(node.vector) && node.vector.length > 0) {
        this.nounCacheManager.set(id, node)
      } else {
        prodLog.warn(`[GCS] Not caching invalid node ${id.substring(0, 8)} (missing id/vector or empty vector)`)
      }

      this.logger.trace(`Successfully retrieved node ${id}`)
      this.releaseBackpressure(true, requestId)
      return node
    } catch (error: any) {
      this.releaseBackpressure(false, requestId)

      // DIAGNOSTIC LOGGING: Log EVERY error before any conditional checks
      const key = this.getNounKey(id)
      prodLog.error(`[getNode] ❌ EXCEPTION CAUGHT:`)
      prodLog.error(`[getNode]   UUID: ${id}`)
      prodLog.error(`[getNode]   Path: ${key}`)
      prodLog.error(`[getNode]   Bucket: ${this.bucketName}`)
      prodLog.error(`[getNode]   Error type: ${error?.constructor?.name || typeof error}`)
      prodLog.error(`[getNode]   Error code: ${JSON.stringify(error?.code)}`)
      prodLog.error(`[getNode]   Error message: ${error?.message || String(error)}`)
      prodLog.error(`[getNode]   Error object:`, JSON.stringify(error, null, 2))

      // Check if this is a "not found" error
      if (error.code === 404) {
        prodLog.warn(`[getNode] Identified as 404 error - returning null WITHOUT caching`)
        // CRITICAL FIX: Do NOT cache null values
        return null
      }

      // Handle throttling
      if (this.isThrottlingError(error)) {
        prodLog.warn(`[getNode] Identified as throttling error - rethrowing`)
        await this.handleThrottling(error)
        throw error
      }

      // All other errors should throw, not return null
      prodLog.error(`[getNode] Unhandled error - rethrowing`)
      this.logger.error(`Failed to get node ${id}:`, error)
      throw BrainyError.fromError(error, `getNoun(${id})`)
    }
  }

  /**
   * Delete a noun from storage (internal implementation)
   */
  protected async deleteNoun_internal(id: string): Promise<void> {
    await this.ensureInitialized()

    const requestId = await this.applyBackpressure()

    try {
      this.logger.trace(`Deleting noun ${id}`)

      // Get the GCS key
      const key = this.getNounKey(id)

      // Delete from GCS
      const file = this.bucket!.file(key)
      await file.delete()

      // Remove from cache
      this.nounCacheManager.delete(id)

      // Decrement noun count
      const metadata = await this.getNounMetadata(id)
      if (metadata && metadata.type) {
        await this.decrementEntityCountSafe(metadata.type as string)
      }

      this.logger.trace(`Noun ${id} deleted successfully`)
      this.releaseBackpressure(true, requestId)
    } catch (error: any) {
      this.releaseBackpressure(false, requestId)

      if (error.code === 404) {
        // Already deleted
        this.logger.trace(`Noun ${id} not found (already deleted)`)
        return
      }

      // Handle throttling
      if (this.isThrottlingError(error)) {
        await this.handleThrottling(error)
        throw error
      }

      this.logger.error(`Failed to delete noun ${id}:`, error)
      throw new Error(`Failed to delete noun ${id}: ${error}`)
    }
  }

  /**
   * Write an object to a specific path in GCS
   * Primitive operation required by base class
   * @protected
   */
  protected async writeObjectToPath(path: string, data: any): Promise<void> {
    await this.ensureInitialized()

    try {
      this.logger.trace(`Writing object to path: ${path}`)

      const file = this.bucket!.file(path)
      await file.save(JSON.stringify(data, null, 2), {
        contentType: 'application/json',
        resumable: false
      })

      this.logger.trace(`Object written successfully to ${path}`)
    } catch (error) {
      this.logger.error(`Failed to write object to ${path}:`, error)
      throw new Error(`Failed to write object to ${path}: ${error}`)
    }
  }

  /**
   * Read an object from a specific path in GCS
   * Primitive operation required by base class
   * @protected
   */
  protected async readObjectFromPath(path: string): Promise<any | null> {
    await this.ensureInitialized()

    try {
      this.logger.trace(`Reading object from path: ${path}`)

      const file = this.bucket!.file(path)
      const [contents] = await file.download()

      const data = JSON.parse(contents.toString())

      this.logger.trace(`Object read successfully from ${path}`)
      return data
    } catch (error: any) {
      // Check if this is a "not found" error
      if (error.code === 404) {
        this.logger.trace(`Object not found at ${path}`)
        return null
      }

      this.logger.error(`Failed to read object from ${path}:`, error)
      throw BrainyError.fromError(error, `readObjectFromPath(${path})`)
    }
  }

  /**
   * Delete an object from a specific path in GCS
   * Primitive operation required by base class
   * @protected
   */
  protected async deleteObjectFromPath(path: string): Promise<void> {
    await this.ensureInitialized()

    try {
      this.logger.trace(`Deleting object at path: ${path}`)

      const file = this.bucket!.file(path)
      await file.delete()

      this.logger.trace(`Object deleted successfully from ${path}`)
    } catch (error: any) {
      // If already deleted (404), treat as success
      if (error.code === 404) {
        this.logger.trace(`Object at ${path} not found (already deleted)`)
        return
      }

      this.logger.error(`Failed to delete object from ${path}:`, error)
      throw new Error(`Failed to delete object from ${path}: ${error}`)
    }
  }

  /**
   * List all objects under a specific prefix in GCS
   * Primitive operation required by base class
   * @protected
   */
  protected async listObjectsUnderPath(prefix: string): Promise<string[]> {
    await this.ensureInitialized()

    try {
      this.logger.trace(`Listing objects under prefix: ${prefix}`)

      const [files] = await this.bucket!.getFiles({ prefix })

      const paths = files.map((file: any) => file.name).filter((name: string) => name && name.length > 0)

      this.logger.trace(`Found ${paths.length} objects under ${prefix}`)
      return paths
    } catch (error) {
      this.logger.error(`Failed to list objects under ${prefix}:`, error)
      throw new Error(`Failed to list objects under ${prefix}: ${error}`)
    }
  }

  /**
   * Save a verb to storage (internal implementation)
   */
  protected async saveVerb_internal(verb: HNSWVerb): Promise<void> {
    return this.saveEdge(verb)
  }

  /**
   * Save an edge to storage
   */
  protected async saveEdge(edge: Edge): Promise<void> {
    await this.ensureInitialized()

    // Check volume mode
    this.checkVolumeMode()

    // Use write buffer in high-volume mode
    if (this.highVolumeMode && this.verbWriteBuffer) {
      this.logger.trace(`📝 BUFFERING: Adding verb ${edge.id} to write buffer`)
      await this.verbWriteBuffer.add(edge.id, edge)
      return
    }

    // Direct write in normal mode
    await this.saveEdgeDirect(edge)
  }

  /**
   * Save an edge directly to GCS (bypass buffer)
   */
  private async saveEdgeDirect(edge: Edge): Promise<void> {
    const requestId = await this.applyBackpressure()

    try {
      this.logger.trace(`Saving edge ${edge.id}`)

      // Convert connections Map to serializable format
      // ARCHITECTURAL FIX (v3.50.1): Include core relational fields in verb vector file
      // These fields are essential for 90% of operations - no metadata lookup needed
      const serializableEdge = {
        id: edge.id,
        vector: edge.vector,
        connections: Object.fromEntries(
          Array.from(edge.connections.entries()).map(([level, verbIds]) => [
            level,
            Array.from(verbIds)
          ])
        ),

        // CORE RELATIONAL DATA (v3.50.1+)
        verb: edge.verb,
        sourceId: edge.sourceId,
        targetId: edge.targetId,

        // User metadata (if any) - saved separately for scalability
        // metadata field is saved separately via saveVerbMetadata()
      }

      // Get the GCS key with UUID-based sharding
      const key = this.getVerbKey(edge.id)

      // Save to GCS
      const file = this.bucket!.file(key)
      await file.save(JSON.stringify(serializableEdge, null, 2), {
        contentType: 'application/json',
        resumable: false
      })

      // Update cache
      this.verbCacheManager.set(edge.id, edge)

      // Count tracking happens in baseStorage.saveVerbMetadata_internal (v4.1.2)
      // This fixes the race condition where metadata didn't exist yet

      this.logger.trace(`Edge ${edge.id} saved successfully`)
      this.releaseBackpressure(true, requestId)
    } catch (error: any) {
      this.releaseBackpressure(false, requestId)

      if (this.isThrottlingError(error)) {
        await this.handleThrottling(error)
        throw error
      }

      this.logger.error(`Failed to save edge ${edge.id}:`, error)
      throw new Error(`Failed to save edge ${edge.id}: ${error}`)
    }
  }

  /**
   * Get a verb from storage (internal implementation)
   * v4.0.0: Returns ONLY vector + core relational fields (no metadata field)
   * Base class combines with metadata via getVerb() -> HNSWVerbWithMetadata
   */
  protected async getVerb_internal(id: string): Promise<HNSWVerb | null> {
    // v4.0.0: Return ONLY vector + core relational data (no metadata field)
    const edge = await this.getEdge(id)
    if (!edge) {
      return null
    }

    // Return pure vector + core fields structure
    return edge
  }

  /**
   * Get an edge from storage
   */
  protected async getEdge(id: string): Promise<Edge | null> {
    await this.ensureInitialized()

    // Check cache first
    const cached = this.verbCacheManager.get(id)
    if (cached) {
      this.logger.trace(`Cache hit for verb ${id}`)
      return cached
    }

    const requestId = await this.applyBackpressure()

    try {
      this.logger.trace(`Getting edge ${id}`)

      // Get the GCS key with UUID-based sharding
      const key = this.getVerbKey(id)

      // Download from GCS
      const file = this.bucket!.file(key)
      const [contents] = await file.download()

      // Parse JSON
      const data = JSON.parse(contents.toString())

      // Convert serialized connections back to Map
      const connections = new Map<number, Set<string>>()
      for (const [level, verbIds] of Object.entries(data.connections || {})) {
        connections.set(Number(level), new Set(verbIds as string[]))
      }

      // v4.0.0: Return HNSWVerb with core relational fields (NO metadata field)
      const edge: Edge = {
        id: data.id,
        vector: data.vector,
        connections,

        // CORE RELATIONAL DATA (read from vector file)
        verb: data.verb,
        sourceId: data.sourceId,
        targetId: data.targetId

        // ✅ NO metadata field in v4.0.0
        // User metadata retrieved separately via getVerbMetadata()
      }

      // Update cache
      this.verbCacheManager.set(id, edge)

      this.logger.trace(`Successfully retrieved edge ${id}`)
      this.releaseBackpressure(true, requestId)
      return edge
    } catch (error: any) {
      this.releaseBackpressure(false, requestId)

      // Check if this is a "not found" error
      if (error.code === 404) {
        this.logger.trace(`Edge not found: ${id}`)
        return null
      }

      if (this.isThrottlingError(error)) {
        await this.handleThrottling(error)
        throw error
      }

      this.logger.error(`Failed to get edge ${id}:`, error)
      throw BrainyError.fromError(error, `getVerb(${id})`)
    }
  }

  /**
   * Delete a verb from storage (internal implementation)
   */
  protected async deleteVerb_internal(id: string): Promise<void> {
    await this.ensureInitialized()

    const requestId = await this.applyBackpressure()

    try {
      this.logger.trace(`Deleting verb ${id}`)

      // Get the GCS key
      const key = this.getVerbKey(id)

      // Delete from GCS
      const file = this.bucket!.file(key)
      await file.delete()

      // Remove from cache
      this.verbCacheManager.delete(id)

      // Decrement verb count
      const metadata = await this.getVerbMetadata(id)
      if (metadata && metadata.type) {
        await this.decrementVerbCount(metadata.type as string)
      }

      this.logger.trace(`Verb ${id} deleted successfully`)
      this.releaseBackpressure(true, requestId)
    } catch (error: any) {
      this.releaseBackpressure(false, requestId)

      if (error.code === 404) {
        // Already deleted
        this.logger.trace(`Verb ${id} not found (already deleted)`)
        return
      }

      if (this.isThrottlingError(error)) {
        await this.handleThrottling(error)
        throw error
      }

      this.logger.error(`Failed to delete verb ${id}:`, error)
      throw new Error(`Failed to delete verb ${id}: ${error}`)
    }
  }

  /**
   * Get nouns with pagination
   * v4.0.0: Returns HNSWNounWithMetadata[] (includes metadata field)
   * Iterates through all UUID-based shards (00-ff) for consistent pagination
   */
  public async getNounsWithPagination(options: {
    limit?: number
    cursor?: string
    filter?: {
      nounType?: string | string[]
      service?: string | string[]
      metadata?: Record<string, any>
    }
  } = {}): Promise<{
    items: HNSWNounWithMetadata[]
    totalCount?: number
    hasMore: boolean
    nextCursor?: string
  }> {
    await this.ensureInitialized()

    const limit = options.limit || 100
    const cursor = options.cursor

    // Get paginated nodes
    const result = await this.getNodesWithPagination({
      limit,
      cursor,
      useCache: true
    })

    // v4.0.0: Combine nodes with metadata to create HNSWNounWithMetadata[]
    const items: HNSWNounWithMetadata[] = []

    for (const node of result.nodes) {
      // FIX v4.7.4: Don't skip nouns without metadata - metadata is optional in v4.0.0
      const metadata = await this.getNounMetadata(node.id)

      // Apply filters if provided
      if (options.filter) {
        // Filter by noun type
        if (options.filter.nounType) {
          const nounTypes = Array.isArray(options.filter.nounType)
            ? options.filter.nounType
            : [options.filter.nounType]

          const nounType = (metadata as any).type || (metadata as any).noun
          if (!nounType || !nounTypes.includes(nounType)) {
            continue
          }
        }

        // Filter by metadata fields if specified
        if (options.filter.metadata) {
          let metadataMatch = true
          for (const [key, value] of Object.entries(options.filter.metadata)) {
            const metadataValue = (metadata as any)[key]
            if (metadataValue !== value) {
              metadataMatch = false
              break
            }
          }
          if (!metadataMatch) continue
        }
      }

      // v4.8.0: Extract standard fields from metadata to top-level
      const metadataObj = (metadata || {}) as NounMetadata
      const { noun: nounType, createdAt, updatedAt, confidence, weight, service, data, createdBy, ...customMetadata } = metadataObj

      const nounWithMetadata: HNSWNounWithMetadata = {
        id: node.id,
        vector: [...node.vector],
        connections: new Map(node.connections),
        level: node.level || 0,
        type: (nounType as NounType) || NounType.Thing,
        createdAt: (createdAt as number) || Date.now(),
        updatedAt: (updatedAt as number) || Date.now(),
        confidence: confidence as number | undefined,
        weight: weight as number | undefined,
        service: service as string | undefined,
        data: data as Record<string, any> | undefined,
        createdBy,
        metadata: customMetadata
      }
      items.push(nounWithMetadata)
    }

    return {
      items,
      totalCount: result.totalCount,
      hasMore: result.hasMore,
      nextCursor: result.nextCursor
    }
  }

  /**
   * Get nodes with pagination (internal implementation)
   * Iterates through UUID-based shards for consistent pagination
   */
  private async getNodesWithPagination(options: {
    limit: number
    cursor?: string
    useCache?: boolean
  }): Promise<{
    nodes: HNSWNode[]
    totalCount: number
    hasMore: boolean
    nextCursor?: string
  }> {
    await this.ensureInitialized()  // CRITICAL: Must initialize before using this.bucket

    const limit = options.limit || 100
    const useCache = options.useCache !== false

    try {
      const nodes: HNSWNode[] = []

      // Parse cursor (format: "shardIndex:gcsPageToken")
      let startShardIndex = 0
      let gcsPageToken: string | undefined
      if (options.cursor) {
        const parts = options.cursor.split(':', 2)
        startShardIndex = parseInt(parts[0]) || 0
        gcsPageToken = parts[1] || undefined
      }

      // Iterate through shards starting from cursor position
      for (let shardIndex = startShardIndex; shardIndex < TOTAL_SHARDS; shardIndex++) {
        const shardId = getShardIdByIndex(shardIndex)
        const shardPrefix = `${this.nounPrefix}${shardId}/`

        // List objects in this shard
        // Cap maxResults to GCS API limit to prevent "Invalid unsigned integer" errors
        const requestedPageSize = limit - nodes.length
        const cappedPageSize = Math.min(requestedPageSize, MAX_GCS_PAGE_SIZE)

        const [files, , response] = await this.bucket!.getFiles({
          prefix: shardPrefix,
          maxResults: cappedPageSize,
          pageToken: shardIndex === startShardIndex ? gcsPageToken : undefined
        })

        // Extract node IDs from file names
        if (files && files.length > 0) {
          const nodeIds = files
            .filter((file: any) => file && file.name)
            .map((file: any) => {
              // Extract UUID from: entities/nouns/vectors/ab/ab123456-uuid.json
              let name = file.name!
              if (name.startsWith(shardPrefix)) {
                name = name.substring(shardPrefix.length)
              }
              if (name.endsWith('.json')) {
                name = name.substring(0, name.length - 5)
              }
              return name
            })
            .filter((id: string) => id && id.length > 0)

          // Load nodes
          for (const id of nodeIds) {
            const node = await this.getNode(id)
            if (node) {
              nodes.push(node)
            }

            if (nodes.length >= limit) {
              break
            }
          }
        }

        // Check if we have enough nodes or if there are more files in current shard
        if (nodes.length >= limit) {
          const nextCursor = response?.nextPageToken
            ? `${shardIndex}:${response.nextPageToken}`
            : shardIndex + 1 < TOTAL_SHARDS
            ? `${shardIndex + 1}:`
            : undefined

          return {
            nodes,
            totalCount: this.totalNounCount,
            hasMore: !!nextCursor,
            nextCursor
          }
        }

        // If this shard has more pages, create cursor for next page
        if (response?.nextPageToken) {
          return {
            nodes,
            totalCount: this.totalNounCount,
            hasMore: true,
            nextCursor: `${shardIndex}:${response.nextPageToken}`
          }
        }

        // Continue to next shard
      }

      // No more shards or nodes
      return {
        nodes,
        totalCount: this.totalNounCount,
        hasMore: false,
        nextCursor: undefined
      }
    } catch (error) {
      this.logger.error('Error in getNodesWithPagination:', error)
      throw new Error(`Failed to get nodes with pagination: ${error}`)
    }
  }

  /**
   * Get nouns by noun type (internal implementation)
   */
  protected async getNounsByNounType_internal(nounType: string): Promise<HNSWNoun[]> {
    const result = await this.getNounsWithPagination({
      limit: 10000, // Large limit for backward compatibility
      filter: { nounType }
    })

    return result.items
  }

  /**
   * Get verbs by source ID (internal implementation)
   */
  protected async getVerbsBySource_internal(sourceId: string): Promise<HNSWVerbWithMetadata[]> {
    // Use the paginated approach to properly handle HNSWVerb to GraphVerb conversion
    const result = await this.getVerbsWithPagination({
      limit: Number.MAX_SAFE_INTEGER,
      filter: { sourceId: [sourceId] }
    })

    return result.items
  }

  /**
   * Get verbs by target ID (internal implementation)
   */
  protected async getVerbsByTarget_internal(targetId: string): Promise<HNSWVerbWithMetadata[]> {
    // Use the paginated approach to properly handle HNSWVerb to GraphVerb conversion
    const result = await this.getVerbsWithPagination({
      limit: Number.MAX_SAFE_INTEGER,
      filter: { targetId: [targetId] }
    })

    return result.items
  }

  /**
   * Get verbs by type (internal implementation)
   */
  protected async getVerbsByType_internal(type: string): Promise<HNSWVerbWithMetadata[]> {
    // Use the paginated approach to properly handle HNSWVerb to GraphVerb conversion
    const result = await this.getVerbsWithPagination({
      limit: Number.MAX_SAFE_INTEGER,
      filter: { verbType: type }
    })

    return result.items
  }

  /**
   * Get verbs with pagination
   * v4.0.0: Returns HNSWVerbWithMetadata[] (includes metadata field)
   */
  public async getVerbsWithPagination(options: {
    limit?: number
    cursor?: string
    filter?: {
      verbType?: string | string[]
      sourceId?: string | string[]
      targetId?: string | string[]
      service?: string | string[]
      metadata?: Record<string, any>
    }
  } = {}): Promise<{
    items: HNSWVerbWithMetadata[]
    totalCount?: number
    hasMore: boolean
    nextCursor?: string
  }> {
    await this.ensureInitialized()

    const limit = options.limit || 100

    try {
      // List verbs (simplified - not sharded yet in original implementation)
      // Cap maxResults to GCS API limit to prevent "Invalid unsigned integer" errors
      const cappedLimit = Math.min(limit, MAX_GCS_PAGE_SIZE)

      const [files, , response] = await this.bucket!.getFiles({
        prefix: this.verbPrefix,
        maxResults: cappedLimit,
        pageToken: options.cursor
      })

      // If no files, return empty result
      if (!files || files.length === 0) {
        return {
          items: [],
          totalCount: 0,
          hasMore: false,
          nextCursor: undefined
        }
      }

      // Extract verb IDs and load verbs as HNSW verbs
      const hnswVerbs: HNSWVerb[] = []
      for (const file of files) {
        if (!file.name) continue

        // Extract UUID from path
        let name = file.name
        if (name.startsWith(this.verbPrefix)) {
          name = name.substring(this.verbPrefix.length)
        }
        if (name.endsWith('.json')) {
          name = name.substring(0, name.length - 5)
        }

        const verb = await this.getEdge(name)
        if (verb) {
          hnswVerbs.push(verb)
        }
      }

      // v4.0.0: Combine HNSWVerbs with metadata to create HNSWVerbWithMetadata[]
      const items: HNSWVerbWithMetadata[] = []
      for (const hnswVerb of hnswVerbs) {
        const metadata = await this.getVerbMetadata(hnswVerb.id)

        // Apply filters
        if (options.filter) {
          // v4.0.0: Core fields (verb, sourceId, targetId) are in HNSWVerb structure
          if (options.filter.sourceId) {
            const sourceIds = Array.isArray(options.filter.sourceId)
              ? options.filter.sourceId
              : [options.filter.sourceId]
            if (!hnswVerb.sourceId || !sourceIds.includes(hnswVerb.sourceId)) {
              continue
            }
          }

          if (options.filter.targetId) {
            const targetIds = Array.isArray(options.filter.targetId)
              ? options.filter.targetId
              : [options.filter.targetId]
            if (!hnswVerb.targetId || !targetIds.includes(hnswVerb.targetId)) {
              continue
            }
          }

          if (options.filter.verbType) {
            const verbTypes = Array.isArray(options.filter.verbType)
              ? options.filter.verbType
              : [options.filter.verbType]
            if (!hnswVerb.verb || !verbTypes.includes(hnswVerb.verb)) {
              continue
            }
          }

          // Filter by metadata fields if specified
          if (options.filter.metadata && metadata) {
            let metadataMatch = true
            for (const [key, value] of Object.entries(options.filter.metadata)) {
              const metadataValue = (metadata as any)[key]
              if (metadataValue !== value) {
                metadataMatch = false
                break
              }
            }
            if (!metadataMatch) continue
          }
        }

        // v4.8.0: Extract standard fields from metadata to top-level
        const metadataObj = (metadata || {}) as VerbMetadata
        const { createdAt, updatedAt, confidence, weight, service, data, createdBy, ...customMetadata } = metadataObj

        const verbWithMetadata: HNSWVerbWithMetadata = {
          id: hnswVerb.id,
          vector: [...hnswVerb.vector],
          connections: new Map(hnswVerb.connections),
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
        items.push(verbWithMetadata)
      }

      return {
        items,
        totalCount: this.totalVerbCount,
        hasMore: !!response?.nextPageToken,
        nextCursor: response?.nextPageToken
      }
    } catch (error) {
      this.logger.error('Error in getVerbsWithPagination:', error)
      throw new Error(`Failed to get verbs with pagination: ${error}`)
    }
  }

  /**
   * Get nouns with filtering and pagination (public API)
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
    items: any[]
    totalCount?: number
    hasMore: boolean
    nextCursor?: string
  }> {
    const limit = options?.pagination?.limit || 100
    const cursor = options?.pagination?.cursor

    return this.getNounsWithPagination({
      limit,
      cursor,
      filter: options?.filter
    })
  }

  /**
   * Get verbs with filtering and pagination (public API)
   * v4.0.0: Returns HNSWVerbWithMetadata[] (includes metadata field)
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
    const limit = options?.pagination?.limit || 100
    const cursor = options?.pagination?.cursor

    return this.getVerbsWithPagination({
      limit,
      cursor,
      filter: options?.filter
    })
  }

  /**
   * Batch fetch metadata for multiple noun IDs (efficient for large queries)
   * Uses smaller batches to prevent GCS socket exhaustion
   * @param ids Array of noun IDs to fetch metadata for
   * @returns Map of ID to metadata
   */
  public async getMetadataBatch(ids: string[]): Promise<Map<string, any>> {
    await this.ensureInitialized()

    const results = new Map<string, any>()
    const batchSize = 10 // Smaller batches for metadata to prevent socket exhaustion

    // Process in smaller batches
    for (let i = 0; i < ids.length; i += batchSize) {
      const batch = ids.slice(i, i + batchSize)

      const batchPromises = batch.map(async (id) => {
        try {
          // CRITICAL: Use getNounMetadata() instead of deprecated getMetadata()
          // This ensures we fetch from the correct noun metadata store (2-file system)
          const metadata = await this.getNounMetadata(id)
          return { id, metadata }
        } catch (error: any) {
          // Handle GCS-specific errors
          if (this.isThrottlingError(error)) {
            await this.handleThrottling(error)
          }
          this.logger.debug(`Failed to read metadata for ${id}:`, error)
          return { id, metadata: null }
        }
      })

      const batchResults = await Promise.all(batchPromises)

      for (const { id, metadata } of batchResults) {
        if (metadata !== null) {
          results.set(id, metadata)
        }
      }

      // Small yield between batches to prevent overwhelming GCS
      await new Promise(resolve => setImmediate(resolve))
    }

    return results
  }

  /**
   * Clear all data from storage
   */
  public async clear(): Promise<void> {
    await this.ensureInitialized()

    try {
      this.logger.info('🧹 Clearing all data from GCS bucket...')

      // Helper function to delete all objects with a given prefix
      const deleteObjectsWithPrefix = async (prefix: string): Promise<void> => {
        const [files] = await this.bucket!.getFiles({ prefix })

        if (!files || files.length === 0) {
          return
        }

        // Delete each file
        for (const file of files) {
          await file.delete()
        }
      }

      // Clear all data directories
      await deleteObjectsWithPrefix(this.nounPrefix)
      await deleteObjectsWithPrefix(this.verbPrefix)
      await deleteObjectsWithPrefix(this.metadataPrefix)
      await deleteObjectsWithPrefix(this.verbMetadataPrefix)
      await deleteObjectsWithPrefix(this.systemPrefix)

      // Clear caches
      this.nounCacheManager.clear()
      this.verbCacheManager.clear()

      // Reset counts
      this.totalNounCount = 0
      this.totalVerbCount = 0
      this.entityCounts.clear()
      this.verbCounts.clear()

      this.logger.info('✅ All data cleared from GCS')
    } catch (error) {
      this.logger.error('Failed to clear GCS storage:', error)
      throw new Error(`Failed to clear GCS storage: ${error}`)
    }
  }

  /**
   * Get storage status
   */
  public async getStorageStatus(): Promise<{
    type: string
    used: number
    quota: number | null
    details?: Record<string, any>
  }> {
    await this.ensureInitialized()

    try {
      // Get bucket metadata
      const [metadata] = await this.bucket!.getMetadata()

      return {
        type: 'gcs', // Consistent with new naming (native SDK is just 'gcs')
        used: 0, // GCS doesn't provide usage info easily
        quota: null, // No quota in GCS
        details: {
          bucket: this.bucketName,
          location: metadata.location,
          storageClass: metadata.storageClass,
          created: metadata.timeCreated,
          sdk: 'native' // Indicate we're using native SDK
        }
      }
    } catch (error) {
      this.logger.error('Failed to get storage status:', error)
      return {
        type: 'gcs', // Consistent with new naming
        used: 0,
        quota: null
      }
    }
  }

  /**
   * Save statistics data to storage
   */
  protected async saveStatisticsData(statistics: StatisticsData): Promise<void> {
    await this.ensureInitialized()

    try {
      const key = `${this.systemPrefix}${STATISTICS_KEY}.json`

      this.logger.trace(`Saving statistics to ${key}`)

      const file = this.bucket!.file(key)
      await file.save(JSON.stringify(statistics, null, 2), {
        contentType: 'application/json',
        resumable: false
      })

      this.logger.trace('Statistics saved successfully')
    } catch (error) {
      this.logger.error('Failed to save statistics:', error)
      throw new Error(`Failed to save statistics: ${error}`)
    }
  }

  /**
   * Get statistics data from storage
   */
  protected async getStatisticsData(): Promise<StatisticsData | null> {
    await this.ensureInitialized()

    try {
      const key = `${this.systemPrefix}${STATISTICS_KEY}.json`

      this.logger.trace(`Getting statistics from ${key}`)

      const file = this.bucket!.file(key)
      const [contents] = await file.download()

      const statistics = JSON.parse(contents.toString())

      this.logger.trace('Statistics retrieved successfully')

      // CRITICAL FIX: Populate totalNodes and totalEdges from in-memory counts
      // HNSW rebuild depends on these fields to determine entity count
      return {
        ...statistics,
        totalNodes: this.totalNounCount,
        totalEdges: this.totalVerbCount,
        lastUpdated: new Date().toISOString()
      }
    } catch (error: any) {
      if (error.code === 404) {
        // CRITICAL FIX (v3.37.4): Statistics file doesn't exist yet (first restart)
        // Return minimal stats with counts instead of null
        // This prevents HNSW from seeing entityCount=0 during index rebuild
        this.logger.trace('Statistics file not found - returning minimal stats with counts')
        return {
          nounCount: {},
          verbCount: {},
          metadataCount: {},
          hnswIndexSize: 0,
          totalNodes: this.totalNounCount,
          totalEdges: this.totalVerbCount,
          totalMetadata: 0,
          lastUpdated: new Date().toISOString()
        }
      }

      this.logger.error('Failed to get statistics:', error)
      return null
    }
  }

  /**
   * Initialize counts from storage
   */
  protected async initializeCounts(): Promise<void> {
    // Skip counts file entirely if configured
    if (this.skipCountsFile) {
      prodLog.info('📊 Skipping counts file (skipCountsFile: true)')
      this.totalNounCount = 0
      this.totalVerbCount = 0
      this.entityCounts = new Map()
      this.verbCounts = new Map()
      return
    }

    const key = `${this.systemPrefix}counts.json`

    try {
      const file = this.bucket!.file(key)
      const [contents] = await file.download()

      const counts = JSON.parse(contents.toString())

      this.totalNounCount = counts.totalNounCount || 0
      this.totalVerbCount = counts.totalVerbCount || 0
      this.entityCounts = new Map(Object.entries(counts.entityCounts || {})) as Map<string, number>
      this.verbCounts = new Map(Object.entries(counts.verbCounts || {})) as Map<string, number>

      prodLog.info(`📊 Loaded counts from storage: ${this.totalNounCount} nouns, ${this.totalVerbCount} verbs`)
    } catch (error: any) {
      if (error.code === 404) {
        // No counts file yet
        if (this.skipInitialScan) {
          prodLog.info('📊 No counts file found - starting with zero counts (skipInitialScan: true)')
          this.totalNounCount = 0
          this.totalVerbCount = 0
          this.entityCounts = new Map()
          this.verbCounts = new Map()
        } else {
          // Initialize from scan (first-time setup or counts not persisted)
          prodLog.info('📊 No counts file found - scanning bucket to initialize counts')
          await this.initializeCountsFromScan()
        }
      } else {
        // CRITICAL FIX: Don't silently fail on network/permission errors
        this.logger.error('❌ CRITICAL: Failed to load counts from GCS:', error)
        prodLog.error(`❌ Error loading ${key}: ${error.message}`)

        if (this.skipInitialScan) {
          prodLog.warn('⚠️  Starting with zero counts due to error (skipInitialScan: true)')
          this.totalNounCount = 0
          this.totalVerbCount = 0
          this.entityCounts = new Map()
          this.verbCounts = new Map()
        } else {
          // Try to recover by scanning the bucket
          prodLog.warn('⚠️  Attempting recovery by scanning GCS bucket...')
          await this.initializeCountsFromScan()
        }
      }
    }
  }

  /**
   * Initialize counts from storage scan (expensive - only for first-time init)
   * Includes timeout handling to prevent Cloud Run startup failures
   */
  private async initializeCountsFromScan(): Promise<void> {
    const SCAN_TIMEOUT_MS = 120000 // 2 minutes timeout

    try {
      prodLog.info('📊 Scanning GCS bucket to initialize counts...')
      prodLog.info(`🔍 Noun prefix: ${this.nounPrefix}`)
      prodLog.info(`🔍 Verb prefix: ${this.verbPrefix}`)
      prodLog.info(`⏱️  Timeout: ${SCAN_TIMEOUT_MS / 1000}s (configure skipInitialScan to avoid this)`)

      // Create timeout promise
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(new Error(`Bucket scan timeout after ${SCAN_TIMEOUT_MS / 1000}s`))
        }, SCAN_TIMEOUT_MS)
      })

      // Count nouns with timeout
      const nounScanPromise = this.bucket!.getFiles({ prefix: this.nounPrefix })
      const [nounFiles] = await Promise.race([nounScanPromise, timeoutPromise]) as any

      prodLog.info(`🔍 Found ${nounFiles?.length || 0} total files under noun prefix`)

      const jsonNounFiles = nounFiles?.filter((f: any) => f.name?.endsWith('.json')) || []
      this.totalNounCount = jsonNounFiles.length

      if (jsonNounFiles.length > 0 && jsonNounFiles.length <= 5) {
        prodLog.info(`📄 Sample noun files: ${jsonNounFiles.slice(0, 5).map((f: any) => f.name).join(', ')}`)
      }

      // Count verbs with timeout
      const verbScanPromise = this.bucket!.getFiles({ prefix: this.verbPrefix })
      const [verbFiles] = await Promise.race([verbScanPromise, timeoutPromise]) as any

      prodLog.info(`🔍 Found ${verbFiles?.length || 0} total files under verb prefix`)

      const jsonVerbFiles = verbFiles?.filter((f: any) => f.name?.endsWith('.json')) || []
      this.totalVerbCount = jsonVerbFiles.length

      if (jsonVerbFiles.length > 0 && jsonVerbFiles.length <= 5) {
        prodLog.info(`📄 Sample verb files: ${jsonVerbFiles.slice(0, 5).map((f: any) => f.name).join(', ')}`)
      }

      // Save initial counts
      if (this.totalNounCount > 0 || this.totalVerbCount > 0) {
        await this.persistCounts()
        prodLog.info(`✅ Initialized counts from scan: ${this.totalNounCount} nouns, ${this.totalVerbCount} verbs`)
      } else {
        prodLog.warn(`⚠️  No entities found during bucket scan. Check that entities exist and prefixes are correct.`)
      }
    } catch (error: any) {
      // Handle timeout specifically
      if (error.message?.includes('Bucket scan timeout')) {
        prodLog.error(`❌ TIMEOUT: Bucket scan exceeded ${SCAN_TIMEOUT_MS / 1000}s limit`)
        prodLog.error(`   This typically happens with large buckets in Cloud Run deployments.`)
        prodLog.error(`   Solutions:`)
        prodLog.error(`     1. Increase Cloud Run timeout: timeoutSeconds: 600`)
        prodLog.error(`     2. Use skipInitialScan: true in gcsNativeStorage config`)
        prodLog.error(`     3. Pre-create counts file before deployment`)
        prodLog.warn(`⚠️  Starting with zero counts due to timeout`)
        this.totalNounCount = 0
        this.totalVerbCount = 0
        this.entityCounts = new Map()
        this.verbCounts = new Map()
        return
      }

      // CRITICAL FIX: Don't silently fail - this prevents data loss scenarios
      this.logger.error('❌ CRITICAL: Failed to initialize counts from GCS bucket scan:', error)
      prodLog.error(`   Error: ${error.message || String(error)}`)
      prodLog.warn(`⚠️  Starting with zero counts due to error`)
      this.totalNounCount = 0
      this.totalVerbCount = 0
      this.entityCounts = new Map()
      this.verbCounts = new Map()
    }
  }

  /**
   * Persist counts to storage
   */
  protected async persistCounts(): Promise<void> {
    // Skip if skipCountsFile is enabled
    if (this.skipCountsFile) {
      return
    }

    try {
      const key = `${this.systemPrefix}counts.json`

      const counts = {
        totalNounCount: this.totalNounCount,
        totalVerbCount: this.totalVerbCount,
        entityCounts: Object.fromEntries(this.entityCounts),
        verbCounts: Object.fromEntries(this.verbCounts),
        lastUpdated: new Date().toISOString()
      }

      const file = this.bucket!.file(key)
      await file.save(JSON.stringify(counts, null, 2), {
        contentType: 'application/json',
        resumable: false
      })
    } catch (error) {
      this.logger.error('Error persisting counts:', error)
    }
  }

  // HNSW Index Persistence (v3.35.0+)

  /**
   * Get a noun's vector for HNSW rebuild
   */
  public async getNounVector(id: string): Promise<number[] | null> {
    await this.ensureInitialized()
    const noun = await this.getNode(id)
    return noun ? noun.vector : null
  }

  /**
   * Save HNSW graph data for a noun
   * Storage path: entities/nouns/hnsw/{shard}/{id}.json
   */
  public async saveHNSWData(nounId: string, hnswData: {
    level: number
    connections: Record<string, string[]>
  }): Promise<void> {
    await this.ensureInitialized()

    // CRITICAL FIX (v4.7.3): Must preserve existing node data (id, vector) when updating HNSW metadata
    // Previous implementation overwrote the entire file, destroying vector data
    // Now we READ the existing node, UPDATE only connections/level, then WRITE back the complete node

    // CRITICAL FIX (v4.10.1): Optimistic locking with generation numbers to prevent race conditions
    // Uses GCS generation preconditions - retries with exponential backoff on conflicts
    // Prevents data corruption when multiple entities connect to same neighbor simultaneously

    const shard = getShardIdFromUuid(nounId)
    const key = `entities/nouns/hnsw/${shard}/${nounId}.json`
    const file = this.bucket!.file(key)

    const maxRetries = 5
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        // Get current generation and data
        let currentGeneration: string | undefined
        let existingNode: any = {}

        try {
          // Download file and get metadata in parallel
          const [data, metadata] = await Promise.all([
            file.download(),
            file.getMetadata()
          ])
          existingNode = JSON.parse(data[0].toString('utf-8'))
          currentGeneration = metadata[0].generation?.toString()
        } catch (error: any) {
          // File doesn't exist yet - will create new
          if (error.code !== 404) {
            throw error
          }
        }

        // Preserve id and vector, update only HNSW graph metadata
        const updatedNode = {
          ...existingNode,  // Preserve all existing fields (id, vector, etc.)
          level: hnswData.level,
          connections: hnswData.connections
        }

        // ATOMIC WRITE: Use generation precondition
        // If currentGeneration exists, only write if generation matches (no concurrent modification)
        // If no generation, only write if file doesn't exist (ifGenerationMatch: 0)
        await file.save(JSON.stringify(updatedNode, null, 2), {
          contentType: 'application/json',
          resumable: false,
          preconditionOpts: currentGeneration
            ? { ifGenerationMatch: currentGeneration }
            : { ifGenerationMatch: '0' } // Only create if doesn't exist
        })

        // Success! Exit retry loop
        return
      } catch (error: any) {
        // Precondition failed (412) - concurrent modification detected
        if (error.code === 412) {
          if (attempt === maxRetries - 1) {
            this.logger.error(`Max retries (${maxRetries}) exceeded for ${nounId} - concurrent modification conflict`)
            throw new Error(`Failed to save HNSW data for ${nounId}: max retries exceeded due to concurrent modifications`)
          }

          // Exponential backoff: 50ms, 100ms, 200ms, 400ms, 800ms
          const backoffMs = 50 * Math.pow(2, attempt)
          await new Promise(resolve => setTimeout(resolve, backoffMs))
          continue
        }

        // Other error - rethrow
        this.logger.error(`Failed to save HNSW data for ${nounId}:`, error)
        throw new Error(`Failed to save HNSW data for ${nounId}: ${error}`)
      }
    }
  }

  /**
   * Get HNSW graph data for a noun
   * Storage path: entities/nouns/hnsw/{shard}/{id}.json
   */
  public async getHNSWData(nounId: string): Promise<{
    level: number
    connections: Record<string, string[]>
  } | null> {
    await this.ensureInitialized()

    try {
      const shard = getShardIdFromUuid(nounId)
      const key = `entities/nouns/hnsw/${shard}/${nounId}.json`

      const file = this.bucket!.file(key)
      const [contents] = await file.download()

      return JSON.parse(contents.toString())
    } catch (error: any) {
      if (error.code === 404) {
        return null
      }

      this.logger.error(`Failed to get HNSW data for ${nounId}:`, error)
      throw new Error(`Failed to get HNSW data for ${nounId}: ${error}`)
    }
  }

  /**
   * Save HNSW system data (entry point, max level)
   * Storage path: system/hnsw-system.json
   *
   * CRITICAL FIX (v4.10.1): Optimistic locking with generation numbers to prevent race conditions
   */
  public async saveHNSWSystem(systemData: {
    entryPointId: string | null
    maxLevel: number
  }): Promise<void> {
    await this.ensureInitialized()

    const key = `${this.systemPrefix}hnsw-system.json`
    const file = this.bucket!.file(key)

    const maxRetries = 5
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        // Get current generation
        let currentGeneration: string | undefined

        try {
          const [metadata] = await file.getMetadata()
          currentGeneration = metadata.generation?.toString()
        } catch (error: any) {
          // File doesn't exist yet
          if (error.code !== 404) {
            throw error
          }
        }

        // ATOMIC WRITE: Use generation precondition
        await file.save(JSON.stringify(systemData, null, 2), {
          contentType: 'application/json',
          resumable: false,
          preconditionOpts: currentGeneration
            ? { ifGenerationMatch: currentGeneration }
            : { ifGenerationMatch: '0' }
        })

        // Success!
        return
      } catch (error: any) {
        // Precondition failed - concurrent modification
        if (error.code === 412) {
          if (attempt === maxRetries - 1) {
            this.logger.error(`Max retries (${maxRetries}) exceeded for HNSW system data`)
            throw new Error('Failed to save HNSW system data: max retries exceeded due to concurrent modifications')
          }

          const backoffMs = 50 * Math.pow(2, attempt)
          await new Promise(resolve => setTimeout(resolve, backoffMs))
          continue
        }

        // Other error - rethrow
        this.logger.error('Failed to save HNSW system data:', error)
        throw new Error(`Failed to save HNSW system data: ${error}`)
      }
    }
  }

  /**
   * Get HNSW system data (entry point, max level)
   * Storage path: system/hnsw-system.json
   */
  public async getHNSWSystem(): Promise<{
    entryPointId: string | null
    maxLevel: number
  } | null> {
    await this.ensureInitialized()

    try {
      const key = `${this.systemPrefix}hnsw-system.json`

      const file = this.bucket!.file(key)
      const [contents] = await file.download()

      return JSON.parse(contents.toString())
    } catch (error: any) {
      if (error.code === 404) {
        return null
      }

      this.logger.error('Failed to get HNSW system data:', error)
      throw new Error(`Failed to get HNSW system data: ${error}`)
    }
  }

  // ============================================================================
  // GCS Lifecycle Management & Autoclass (v4.0.0)
  // Cost optimization through automatic tier transitions and Autoclass
  // ============================================================================

  /**
   * Set lifecycle policy for automatic tier transitions and deletions
   *
   * GCS Storage Classes:
   * - STANDARD: Hot data, most expensive (~$0.020/GB/month)
   * - NEARLINE: <1 access/month (~$0.010/GB/month, 50% cheaper)
   * - COLDLINE: <1 access/quarter (~$0.004/GB/month, 80% cheaper)
   * - ARCHIVE: <1 access/year (~$0.0012/GB/month, 94% cheaper!)
   *
   * Example usage:
   * ```typescript
   * await storage.setLifecyclePolicy({
   *   rules: [
   *     {
   *       action: { type: 'SetStorageClass', storageClass: 'NEARLINE' },
   *       condition: { age: 30 }
   *     },
   *     {
   *       action: { type: 'SetStorageClass', storageClass: 'COLDLINE' },
   *       condition: { age: 90 }
   *     },
   *     {
   *       action: { type: 'Delete' },
   *       condition: { age: 365 }
   *     }
   *   ]
   * })
   * ```
   *
   * @param options Lifecycle configuration with rules for transitions and deletions
   */
  public async setLifecyclePolicy(options: {
    rules: Array<{
      action: {
        type: 'Delete' | 'SetStorageClass'
        storageClass?: 'STANDARD' | 'NEARLINE' | 'COLDLINE' | 'ARCHIVE'
      }
      condition: {
        age?: number // Days since object creation
        createdBefore?: string // ISO 8601 date
        matchesPrefix?: string[]
        matchesSuffix?: string[]
      }
    }>
  }): Promise<void> {
    await this.ensureInitialized()

    try {
      this.logger.info(`Setting GCS lifecycle policy with ${options.rules.length} rules`)

      // GCS lifecycle rules format
      const lifecycleRules = options.rules.map(rule => {
        const gcsRule: any = {
          action: {
            type: rule.action.type
          },
          condition: {}
        }

        // Add storage class for SetStorageClass action
        if (rule.action.type === 'SetStorageClass' && rule.action.storageClass) {
          gcsRule.action.storageClass = rule.action.storageClass
        }

        // Add conditions
        if (rule.condition.age !== undefined) {
          gcsRule.condition.age = rule.condition.age
        }
        if (rule.condition.createdBefore) {
          gcsRule.condition.createdBefore = rule.condition.createdBefore
        }
        if (rule.condition.matchesPrefix) {
          gcsRule.condition.matchesPrefix = rule.condition.matchesPrefix
        }
        if (rule.condition.matchesSuffix) {
          gcsRule.condition.matchesSuffix = rule.condition.matchesSuffix
        }

        return gcsRule
      })

      // Update bucket lifecycle configuration
      await this.bucket!.setMetadata({
        lifecycle: {
          rule: lifecycleRules
        }
      })

      this.logger.info(`Successfully set lifecycle policy with ${options.rules.length} rules`)
    } catch (error: any) {
      this.logger.error('Failed to set lifecycle policy:', error)
      throw new Error(`Failed to set GCS lifecycle policy: ${error.message || error}`)
    }
  }

  /**
   * Get current lifecycle policy configuration
   *
   * @returns Lifecycle configuration with all rules, or null if no policy is set
   */
  public async getLifecyclePolicy(): Promise<{
    rules: Array<{
      action: {
        type: string
        storageClass?: string
      }
      condition: {
        age?: number
        createdBefore?: string
        matchesPrefix?: string[]
        matchesSuffix?: string[]
      }
    }>
  } | null> {
    await this.ensureInitialized()

    try {
      this.logger.info('Getting GCS lifecycle policy')

      const [metadata] = await this.bucket!.getMetadata()

      if (!metadata.lifecycle || !metadata.lifecycle.rule || metadata.lifecycle.rule.length === 0) {
        this.logger.info('No lifecycle policy configured')
        return null
      }

      // Convert GCS format to our format
      const rules = metadata.lifecycle.rule.map((rule: any) => ({
        action: {
          type: rule.action.type,
          ...(rule.action.storageClass && { storageClass: rule.action.storageClass })
        },
        condition: {
          ...(rule.condition.age !== undefined && { age: rule.condition.age }),
          ...(rule.condition.createdBefore && { createdBefore: rule.condition.createdBefore }),
          ...(rule.condition.matchesPrefix && { matchesPrefix: rule.condition.matchesPrefix }),
          ...(rule.condition.matchesSuffix && { matchesSuffix: rule.condition.matchesSuffix })
        }
      }))

      this.logger.info(`Found lifecycle policy with ${rules.length} rules`)

      return { rules }
    } catch (error: any) {
      this.logger.error('Failed to get lifecycle policy:', error)
      throw new Error(`Failed to get GCS lifecycle policy: ${error.message || error}`)
    }
  }

  /**
   * Remove lifecycle policy from bucket
   */
  public async removeLifecyclePolicy(): Promise<void> {
    await this.ensureInitialized()

    try {
      this.logger.info('Removing GCS lifecycle policy')

      // Remove lifecycle configuration
      await this.bucket!.setMetadata({
        lifecycle: null
      })

      this.logger.info('Successfully removed lifecycle policy')
    } catch (error: any) {
      this.logger.error('Failed to remove lifecycle policy:', error)
      throw new Error(`Failed to remove GCS lifecycle policy: ${error.message || error}`)
    }
  }

  /**
   * Enable Autoclass for automatic storage class optimization
   *
   * GCS Autoclass automatically moves objects between storage classes based on access patterns:
   * - Frequent Access → STANDARD
   * - Infrequent Access (30 days) → NEARLINE
   * - Rarely Accessed (90 days) → COLDLINE
   * - Archive Access (365 days) → ARCHIVE
   *
   * Benefits:
   * - Automatic optimization based on access patterns (no manual rules needed)
   * - No early deletion fees
   * - No retrieval fees for NEARLINE/COLDLINE (only ARCHIVE has retrieval fees)
   * - Up to 94% cost savings automatically
   *
   * Note: Autoclass is a bucket-level feature that requires bucket.update permission.
   * It cannot be enabled per-object or per-prefix.
   *
   * @param options Autoclass configuration
   */
  public async enableAutoclass(options: {
    terminalStorageClass?: 'NEARLINE' | 'ARCHIVE' // Coldest storage class to use
  } = {}): Promise<void> {
    await this.ensureInitialized()

    try {
      this.logger.info('Enabling GCS Autoclass')

      const autoclassConfig: any = {
        enabled: true
      }

      // Set terminal storage class if specified
      if (options.terminalStorageClass) {
        autoclassConfig.terminalStorageClass = options.terminalStorageClass
      }

      await this.bucket!.setMetadata({
        autoclass: autoclassConfig
      })

      this.logger.info(`Successfully enabled Autoclass${options.terminalStorageClass ? ` with terminal class ${options.terminalStorageClass}` : ''}`)
    } catch (error: any) {
      this.logger.error('Failed to enable Autoclass:', error)
      throw new Error(`Failed to enable GCS Autoclass: ${error.message || error}`)
    }
  }

  /**
   * Get Autoclass configuration and status
   *
   * @returns Autoclass status, or null if not configured
   */
  public async getAutoclassStatus(): Promise<{
    enabled: boolean
    terminalStorageClass?: string
    toggleTime?: string
  } | null> {
    await this.ensureInitialized()

    try {
      this.logger.info('Getting GCS Autoclass status')

      const [metadata] = await this.bucket!.getMetadata()

      if (!metadata.autoclass) {
        this.logger.info('Autoclass not configured')
        return null
      }

      const status = {
        enabled: metadata.autoclass.enabled || false,
        ...(metadata.autoclass.terminalStorageClass && {
          terminalStorageClass: metadata.autoclass.terminalStorageClass
        }),
        ...(metadata.autoclass.toggleTime && {
          toggleTime: metadata.autoclass.toggleTime
        })
      }

      this.logger.info(`Autoclass status: ${status.enabled ? 'enabled' : 'disabled'}`)

      return status
    } catch (error: any) {
      this.logger.error('Failed to get Autoclass status:', error)
      throw new Error(`Failed to get GCS Autoclass status: ${error.message || error}`)
    }
  }

  /**
   * Disable Autoclass for the bucket
   */
  public async disableAutoclass(): Promise<void> {
    await this.ensureInitialized()

    try {
      this.logger.info('Disabling GCS Autoclass')

      await this.bucket!.setMetadata({
        autoclass: {
          enabled: false
        }
      })

      this.logger.info('Successfully disabled Autoclass')
    } catch (error: any) {
      this.logger.error('Failed to disable Autoclass:', error)
      throw new Error(`Failed to disable GCS Autoclass: ${error.message || error}`)
    }
  }
}
