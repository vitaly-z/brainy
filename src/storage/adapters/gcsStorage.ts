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

import { GraphVerb, HNSWNoun, HNSWVerb, StatisticsData } from '../../coreTypes.js'
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
      const serializableNode = {
        ...node,
        connections: Object.fromEntries(
          Array.from(node.connections.entries()).map(([level, nounIds]) => [
            level,
            Array.from(nounIds)
          ])
        )
      }

      // Get the GCS key with UUID-based sharding
      const key = this.getNounKey(node.id)

      // Save to GCS
      const file = this.bucket!.file(key)
      await file.save(JSON.stringify(serializableNode, null, 2), {
        contentType: 'application/json',
        resumable: false // For small objects, non-resumable is faster
      })

      // Update cache
      this.nounCacheManager.set(node.id, node)

      // Increment noun count
      const metadata = await this.getNounMetadata(node.id)
      if (metadata && metadata.type) {
        await this.incrementEntityCountSafe(metadata.type)
      }

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
   */
  protected async getNoun_internal(id: string): Promise<HNSWNoun | null> {
    return this.getNode(id)
  }

  /**
   * Get a node from storage
   */
  protected async getNode(id: string): Promise<HNSWNode | null> {
    await this.ensureInitialized()

    // Check cache first
    const cached = this.nounCacheManager.get(id)
    if (cached) {
      this.logger.trace(`Cache hit for noun ${id}`)
      return cached
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

      const node: HNSWNode = {
        id: data.id,
        vector: data.vector,
        connections,
        level: data.level || 0
      }

      // Update cache
      this.nounCacheManager.set(id, node)

      this.logger.trace(`Successfully retrieved node ${id}`)
      this.releaseBackpressure(true, requestId)
      return node
    } catch (error: any) {
      this.releaseBackpressure(false, requestId)

      // Check if this is a "not found" error
      if (error.code === 404) {
        this.logger.trace(`Node not found: ${id}`)
        return null
      }

      // Handle throttling
      if (this.isThrottlingError(error)) {
        await this.handleThrottling(error)
        throw error
      }

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
        await this.decrementEntityCountSafe(metadata.type)
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
      const serializableEdge = {
        ...edge,
        connections: Object.fromEntries(
          Array.from(edge.connections.entries()).map(([level, verbIds]) => [
            level,
            Array.from(verbIds)
          ])
        )
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

      // Increment verb count
      const metadata = await this.getVerbMetadata(edge.id)
      if (metadata && metadata.type) {
        await this.incrementVerbCount(metadata.type)
      }

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
   */
  protected async getVerb_internal(id: string): Promise<HNSWVerb | null> {
    return this.getEdge(id)
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

      const edge: Edge = {
        id: data.id,
        vector: data.vector,
        connections
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
        await this.decrementVerbCount(metadata.type)
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
    items: HNSWNoun[]
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

    // Apply filters if provided
    let filteredNodes = result.nodes

    if (options.filter) {
      // Filter by noun type
      if (options.filter.nounType) {
        const nounTypes = Array.isArray(options.filter.nounType)
          ? options.filter.nounType
          : [options.filter.nounType]

        const filteredByType: HNSWNoun[] = []
        for (const node of filteredNodes) {
          const metadata = await this.getNounMetadata(node.id)
          if (metadata && nounTypes.includes(metadata.type || metadata.noun)) {
            filteredByType.push(node)
          }
        }
        filteredNodes = filteredByType
      }

      // Additional filter logic can be added here
    }

    return {
      items: filteredNodes,
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
        const [files, , response] = await this.bucket!.getFiles({
          prefix: shardPrefix,
          maxResults: limit - nodes.length,
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
  protected async getVerbsBySource_internal(sourceId: string): Promise<GraphVerb[]> {
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
  protected async getVerbsByTarget_internal(targetId: string): Promise<GraphVerb[]> {
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
  protected async getVerbsByType_internal(type: string): Promise<GraphVerb[]> {
    // Use the paginated approach to properly handle HNSWVerb to GraphVerb conversion
    const result = await this.getVerbsWithPagination({
      limit: Number.MAX_SAFE_INTEGER,
      filter: { verbType: type }
    })

    return result.items
  }

  /**
   * Get verbs with pagination
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
    items: GraphVerb[]
    totalCount?: number
    hasMore: boolean
    nextCursor?: string
  }> {
    await this.ensureInitialized()

    const limit = options.limit || 100

    try {
      // List verbs (simplified - not sharded yet in original implementation)
      const [files, , response] = await this.bucket!.getFiles({
        prefix: this.verbPrefix,
        maxResults: limit,
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

      // Convert HNSWVerbs to GraphVerbs by combining with metadata
      const graphVerbs: GraphVerb[] = []
      for (const hnswVerb of hnswVerbs) {
        const graphVerb = await this.convertHNSWVerbToGraphVerb(hnswVerb)
        if (graphVerb) {
          graphVerbs.push(graphVerb)
        }
      }

      // Apply filters
      let filteredVerbs = graphVerbs
      if (options.filter) {
        filteredVerbs = graphVerbs.filter((graphVerb) => {
          // Filter by sourceId
          if (options.filter!.sourceId) {
            const sourceIds = Array.isArray(options.filter!.sourceId)
              ? options.filter!.sourceId
              : [options.filter!.sourceId]
            if (!sourceIds.includes(graphVerb.sourceId)) {
              return false
            }
          }

          // Filter by targetId
          if (options.filter!.targetId) {
            const targetIds = Array.isArray(options.filter!.targetId)
              ? options.filter!.targetId
              : [options.filter!.targetId]
            if (!targetIds.includes(graphVerb.targetId)) {
              return false
            }
          }

          // Filter by verbType
          if (options.filter!.verbType) {
            const verbTypes = Array.isArray(options.filter!.verbType)
              ? options.filter!.verbType
              : [options.filter!.verbType]
            const verbType = graphVerb.verb || graphVerb.type || ''
            if (!verbTypes.includes(verbType)) {
              return false
            }
          }

          return true
        })
      }

      return {
        items: filteredVerbs,
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
    items: GraphVerb[]
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
        type: 'gcs-native',
        used: 0, // GCS doesn't provide usage info easily
        quota: null, // No quota in GCS
        details: {
          bucket: this.bucketName,
          location: metadata.location,
          storageClass: metadata.storageClass,
          created: metadata.timeCreated
        }
      }
    } catch (error) {
      this.logger.error('Failed to get storage status:', error)
      return {
        type: 'gcs-native',
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
      return statistics
    } catch (error: any) {
      if (error.code === 404) {
        this.logger.trace('Statistics not found (creating new)')
        return null
      }

      this.logger.error('Failed to get statistics:', error)
      return null
    }
  }

  /**
   * Initialize counts from storage
   */
  protected async initializeCounts(): Promise<void> {
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
        // No counts file yet - initialize from scan (first-time setup or counts not persisted)
        prodLog.info('📊 No counts file found - this is normal for first init or if <10 entities were added')
        await this.initializeCountsFromScan()
      } else {
        // CRITICAL FIX: Don't silently fail on network/permission errors
        this.logger.error('❌ CRITICAL: Failed to load counts from GCS:', error)
        prodLog.error(`❌ Error loading ${key}: ${error.message}`)

        // Try to recover by scanning the bucket
        prodLog.warn('⚠️  Attempting recovery by scanning GCS bucket...')
        await this.initializeCountsFromScan()
      }
    }
  }

  /**
   * Initialize counts from storage scan (expensive - only for first-time init)
   */
  private async initializeCountsFromScan(): Promise<void> {
    try {
      prodLog.info('📊 Scanning GCS bucket to initialize counts...')

      // Count nouns
      const [nounFiles] = await this.bucket!.getFiles({ prefix: this.nounPrefix })
      this.totalNounCount = nounFiles?.filter((f: any) => f.name?.endsWith('.json')).length || 0

      // Count verbs
      const [verbFiles] = await this.bucket!.getFiles({ prefix: this.verbPrefix })
      this.totalVerbCount = verbFiles?.filter((f: any) => f.name?.endsWith('.json')).length || 0

      // Save initial counts
      await this.persistCounts()

      prodLog.info(`✅ Initialized counts from scan: ${this.totalNounCount} nouns, ${this.totalVerbCount} verbs`)
    } catch (error) {
      // CRITICAL FIX: Don't silently fail - this prevents data loss scenarios
      this.logger.error('❌ CRITICAL: Failed to initialize counts from GCS bucket scan:', error)
      throw new Error(`Failed to initialize GCS storage counts: ${error}. This prevents container restarts from working correctly.`)
    }
  }

  /**
   * Persist counts to storage
   */
  protected async persistCounts(): Promise<void> {
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
}
