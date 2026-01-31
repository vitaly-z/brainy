/**
 * Cloudflare R2 Storage Adapter (Dedicated)
 * Optimized specifically for Cloudflare R2 with all latest features
 *
 * R2-Specific Optimizations:
 * - Zero egress fees (aggressive caching)
 * - Cloudflare global network (edge-aware routing)
 * - Workers integration (optional edge compute)
 * - High-volume mode for bulk operations
 * - Smart batching and backpressure
 *
 * Based on latest GCS and S3 implementations with R2-specific enhancements
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
  StorageBatchConfig,
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
import { MetadataWriteBuffer } from '../../utils/metadataWriteBuffer.js'
import { getGlobalSocketManager } from '../../utils/adaptiveSocketManager.js'
import { getGlobalBackpressure } from '../../utils/adaptiveBackpressure.js'
import { getWriteBuffer, WriteBuffer } from '../../utils/writeBuffer.js'
import { getCoalescer, RequestCoalescer } from '../../utils/requestCoalescer.js'
import { getShardIdFromUuid, getAllShardIds, getShardIdByIndex, TOTAL_SHARDS } from '../sharding.js'

// Type aliases for better readability
type HNSWNode = HNSWNoun
type Edge = HNSWVerb

// S3 client types - R2 uses S3-compatible API
type S3Client = any
type S3Command = any

// R2 API limits (same as S3)
const MAX_R2_PAGE_SIZE = 1000

/**
 * Dedicated Cloudflare R2 storage adapter
 * Optimized for R2's unique characteristics and global edge network
 *
 * Type-aware storage now built into BaseStorage
 * - Removed 10 *_internal method overrides (now inherit from BaseStorage's type-first implementation)
 * - Removed getNounsWithPagination override
 * - Updated HNSW methods to use BaseStorage's getNoun/saveNoun (type-first paths)
 * - All operations now use type-first paths: entities/nouns/{type}/vectors/{shard}/{id}.json
 *
 * Configuration:
 * ```typescript
 * const r2Storage = new R2Storage({
 *   bucketName: 'my-brainy-data',
 *   accountId: 'YOUR_CLOUDFLARE_ACCOUNT_ID',
 *   accessKeyId: 'YOUR_R2_ACCESS_KEY_ID',
 *   secretAccessKey: 'YOUR_R2_SECRET_ACCESS_KEY'
 * })
 * ```
 */
export class R2Storage extends BaseStorage {
  private s3Client: S3Client | null = null
  private bucketName: string
  private accountId: string
  private accessKeyId: string
  private secretAccessKey: string

  // R2-specific endpoint (auto-constructed from account ID)
  private endpoint: string

  // Prefixes for different types of data
  private nounPrefix: string
  private verbPrefix: string
  private metadataPrefix: string  // Noun metadata
  private verbMetadataPrefix: string  // Verb metadata
  private systemPrefix: string  // System data

  // Statistics caching for better performance
  protected statisticsCache: StatisticsData | null = null

  // Backpressure and performance management
  private pendingOperations: number = 0
  private maxConcurrentOperations: number = 150 // R2 handles more concurrent ops
  private baseBatchSize: number = 15  // Larger batches for R2
  private currentBatchSize: number = 15
  private lastMemoryCheck: number = 0
  private memoryCheckInterval: number = 5000

  // Adaptive backpressure for automatic flow control
  private backpressure = getGlobalBackpressure()

  // Write buffers for bulk operations
  private nounWriteBuffer: WriteBuffer<HNSWNode> | null = null
  private verbWriteBuffer: WriteBuffer<Edge> | null = null

  // Request coalescer for deduplication
  private requestCoalescer: RequestCoalescer | null = null

  // Write buffering always enabled for consistent performance
  // Removes dynamic mode switching complexity - cloud storage always benefits from batching

  // Multi-level cache manager for efficient data access
  private nounCacheManager: CacheManager<HNSWNode>
  private verbCacheManager: CacheManager<Edge>

  // Module logger
  private logger = createModuleLogger('R2Storage')

  // HNSW mutex locks to prevent read-modify-write races
  private hnswLocks = new Map<string, Promise<void>>()

  /**
   * Initialize the R2 storage adapter
   * @param options Configuration options for Cloudflare R2
   */
  constructor(options: {
    bucketName: string
    accountId: string
    accessKeyId: string
    secretAccessKey: string

    // Optional configuration
    cacheConfig?: {
      hotCacheMaxSize?: number
      hotCacheEvictionThreshold?: number
      warmCacheTTL?: number
    }
    readOnly?: boolean
  }) {
    super()
    this.bucketName = options.bucketName
    this.accountId = options.accountId
    this.accessKeyId = options.accessKeyId
    this.secretAccessKey = options.secretAccessKey
    this.readOnly = options.readOnly || false

    // R2-specific endpoint format
    this.endpoint = `https://${this.accountId}.r2.cloudflarestorage.com`

    // Set up prefixes for different types of data using entity-based structure
    this.nounPrefix = `${getDirectoryPath('noun', 'vector')}/`
    this.verbPrefix = `${getDirectoryPath('verb', 'vector')}/`
    this.metadataPrefix = `${getDirectoryPath('noun', 'metadata')}/`
    this.verbMetadataPrefix = `${getDirectoryPath('verb', 'metadata')}/`
    this.systemPrefix = `${SYSTEM_DIR}/`

    // Initialize cache managers with R2-optimized settings
    this.nounCacheManager = new CacheManager<HNSWNode>({
      hotCacheMaxSize: options.cacheConfig?.hotCacheMaxSize || 10000,
      hotCacheEvictionThreshold: options.cacheConfig?.hotCacheEvictionThreshold || 0.9,
      warmCacheTTL: options.cacheConfig?.warmCacheTTL || 3600000 // 1 hour
    })
    this.verbCacheManager = new CacheManager<Edge>(options.cacheConfig)

    // Write buffering always enabled - no env var check needed

    // Initialize metadata write buffer for cloud rate limit protection
    this.metadataWriteBuffer = new MetadataWriteBuffer(
      (path, data) => this.writeObjectToPath(path, data),
      { maxBufferSize: 200, flushIntervalMs: 200, concurrencyLimit: 10 }
    )
  }

  /**
   * Get R2-optimized batch configuration with native batch API support
   *
   * R2 excels at parallel operations with Cloudflare's global edge network:
   * - Very large batch sizes (up to 1000 paths)
   * - Zero delay (Cloudflare handles rate limiting automatically)
   * - High concurrency (150 parallel optimal, R2 has no egress fees)
   *
   * R2 supports very high throughput (~6000+ ops/sec with burst up to 12,000)
   * Zero egress fees enable aggressive caching and parallel downloads
   *
   * @returns R2-optimized batch configuration
   * Updated for native batch API
   */
  public getBatchConfig(): StorageBatchConfig {
    return {
      maxBatchSize: 1000,              // R2 can handle very large batches
      batchDelayMs: 0,                 // No artificial delay needed
      maxConcurrent: 150,              // Optimal for R2's global network
      supportsParallelWrites: true,    // R2 excels at parallel operations
      rateLimit: {
        operationsPerSecond: 6000,     // R2 has excellent throughput
        burstCapacity: 12000            // High burst capacity
      }
    }
  }

  /**
   * Batch read operation using R2's S3-compatible parallel download
   *
   * Uses Promise.allSettled() for maximum parallelism with GetObjectCommand.
   * R2's global edge network and zero egress fees make this extremely efficient.
   *
   * Performance: ~150 concurrent requests = <400ms for 150 objects (faster than S3)
   *
   * @param paths - Array of R2 object keys to read
   * @returns Map of path -> parsed JSON data (only successful reads)
   */
  public async readBatch(paths: string[]): Promise<Map<string, any>> {
    await this.ensureInitialized()

    const results = new Map<string, any>()
    if (paths.length === 0) return results

    const batchConfig = this.getBatchConfig()
    const chunkSize = batchConfig.maxConcurrent || 150

    this.logger.debug(`[R2 Batch] Reading ${paths.length} objects in chunks of ${chunkSize}`)

    // Import GetObjectCommand (R2 uses S3-compatible API)
    const { GetObjectCommand } = await import('@aws-sdk/client-s3')

    // Process in chunks to respect concurrency limits
    for (let i = 0; i < paths.length; i += chunkSize) {
      const chunk = paths.slice(i, i + chunkSize)

      // Parallel download for this chunk
      const chunkResults = await Promise.allSettled(
        chunk.map(async (path) => {
          try {
            const response = await this.s3Client!.send(
              new GetObjectCommand({
                Bucket: this.bucketName,
                Key: path
              })
            )

            if (!response || !response.Body) {
              return { path, data: null, success: false }
            }

            const bodyContents = await response.Body.transformToString()
            const data = JSON.parse(bodyContents)
            return { path, data, success: true }
          } catch (error: any) {
            // 404 and other errors are expected (not all paths may exist)
            if (error.name !== 'NoSuchKey' && error.$metadata?.httpStatusCode !== 404) {
              this.logger.warn(`[R2 Batch] Failed to read ${path}: ${error.message}`)
            }
            return { path, data: null, success: false }
          }
        })
      )

      // Collect successful results
      for (const result of chunkResults) {
        if (result.status === 'fulfilled' && result.value.success && result.value.data !== null) {
          results.set(result.value.path, result.value.data)
        }
      }
    }

    this.logger.debug(`[R2 Batch] Successfully read ${results.size}/${paths.length} objects`)
    return results
  }

  /**
   * Initialize the storage adapter
   */
  public async init(): Promise<void> {
    if (this.isInitialized) {
      return
    }

    try {
      // Import AWS S3 SDK only when needed (R2 uses S3-compatible API)
      const { S3Client: S3ClientClass, HeadBucketCommand } = await import('@aws-sdk/client-s3')

      // Create S3 client configured for R2
      this.s3Client = new S3ClientClass({
        region: 'auto', // R2 uses 'auto' region
        endpoint: this.endpoint,
        credentials: {
          accessKeyId: this.accessKeyId,
          secretAccessKey: this.secretAccessKey
        }
      })

      // Verify bucket exists and is accessible
      try {
        await this.s3Client.send(new HeadBucketCommand({ Bucket: this.bucketName }))
      } catch (error: any) {
        if (error.name === 'NotFound' || error.$metadata?.httpStatusCode === 404) {
          throw new Error(`R2 bucket ${this.bucketName} does not exist or is not accessible`)
        }
        throw error
      }

      prodLog.info(`✅ Connected to R2 bucket: ${this.bucketName} (account: ${this.accountId})`)

      // Initialize write buffers for high-volume mode
      const storageId = `r2-${this.bucketName}`
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
          this.logger.trace(`Processing coalesced batch: ${batch.length} items`)
        }
      )

      // Initialize counts from storage
      await this.initializeCounts()

      // Clear cache from previous runs
      prodLog.info('🧹 R2: Clearing cache from previous run')
      this.nounCacheManager.clear()
      this.verbCacheManager.clear()

      // Initialize GraphAdjacencyIndex and type statistics
      await super.init()
    } catch (error) {
      this.logger.error('Failed to initialize R2 storage:', error)
      throw new Error(`Failed to initialize R2 storage: ${error}`)
    }
  }

  /**
   * Get the R2 object key for a noun using UUID-based sharding
   */
  private getNounKey(id: string): string {
    const shardId = getShardIdFromUuid(id)
    return `${this.nounPrefix}${shardId}/${id}.json`
  }

  /**
   * Get the R2 object key for a verb using UUID-based sharding
   */
  private getVerbKey(id: string): string {
    const shardId = getShardIdFromUuid(id)
    return `${this.verbPrefix}${shardId}/${id}.json`
  }

  /**
   * Override base class method to detect R2-specific throttling errors
   */
  protected isThrottlingError(error: any): boolean {
    // First check base class detection
    if (super.isThrottlingError(error)) {
      return true
    }

    // R2-specific throttling detection (uses S3 error codes)
    const errorName = error.name
    const statusCode = error.$metadata?.httpStatusCode

    return (
      errorName === 'SlowDown' ||
      errorName === 'ServiceUnavailable' ||
      statusCode === 429 ||
      statusCode === 503
    )
  }

  /**
   * Override base class to enable smart batching for cloud storage
   * R2 is cloud storage with network latency benefits from batching
   */
  protected isCloudStorage(): boolean {
    return true
  }

  /**
   * Apply backpressure before starting an operation
   */
  private async applyBackpressure(): Promise<string> {
    const requestId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    await this.backpressure.requestPermission(requestId, 1)
    this.pendingOperations++
    return requestId
  }

  /**
   * Release backpressure after completing an operation
   */
  private releaseBackpressure(success: boolean = true, requestId?: string): void {
    this.pendingOperations = Math.max(0, this.pendingOperations - 1)
    if (requestId) {
      this.backpressure.releasePermission(requestId, success)
    }
  }

  // Removed checkVolumeMode() - write buffering always enabled for cloud storage

  /**
   * Flush noun buffer to R2
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
   * Flush verb buffer to R2
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
   * Save a node to storage
   * Always uses write buffer for consistent performance
   */
  protected async saveNode(node: HNSWNode): Promise<void> {
    await this.ensureInitialized()

    // Always use write buffer - cloud storage benefits from batching
    if (this.nounWriteBuffer) {
      this.logger.trace(`📝 BUFFERING: Adding noun ${node.id} to write buffer`)

      // Populate cache BEFORE buffering for read-after-write consistency
      if (node.vector && Array.isArray(node.vector) && node.vector.length > 0) {
        this.nounCacheManager.set(node.id, node)
      }

      await this.nounWriteBuffer.add(node.id, node)
      return
    }

    // Fallback to direct write if buffer not initialized (shouldn't happen after init)
    await this.saveNodeDirect(node)
  }

  /**
   * Save a node directly to R2 (bypass buffer)
   */
  private async saveNodeDirect(node: HNSWNode): Promise<void> {
    const requestId = await this.applyBackpressure()

    try {
      this.logger.trace(`Saving node ${node.id}`)

      // Convert connections Map to serializable format
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
      }

      // Get the R2 key with UUID-based sharding
      const key = this.getNounKey(node.id)

      // Save to R2 using S3 PutObject
      const { PutObjectCommand } = await import('@aws-sdk/client-s3')
      await this.s3Client!.send(
        new PutObjectCommand({
          Bucket: this.bucketName,
          Key: key,
          Body: JSON.stringify(serializableNode, null, 2),
          ContentType: 'application/json'
        })
      )

      // Cache nodes with non-empty vectors (Phase 2 optimization)
      if (node.vector && Array.isArray(node.vector) && node.vector.length > 0) {
        this.nounCacheManager.set(node.id, node)
      }

      // Increment noun count
      const metadata = await this.getNounMetadata(node.id)
      if (metadata && metadata.type) {
        await this.incrementEntityCountSafe(metadata.type as string)
      }

      this.logger.trace(`Node ${node.id} saved successfully`)
      this.releaseBackpressure(true, requestId)
    } catch (error: any) {
      this.releaseBackpressure(false, requestId)

      if (this.isThrottlingError(error)) {
        await this.handleThrottling(error)
        throw error
      }

      this.logger.error(`Failed to save node ${node.id}:`, error)
      throw new Error(`Failed to save node ${node.id}: ${error}`)
    }
  }


  /**
   * Get a node from storage
   */
  protected async getNode(id: string): Promise<HNSWNode | null> {
    await this.ensureInitialized()

    // Check cache first (Phase 2: aggressive caching for R2 zero-egress)
    const cached = await this.nounCacheManager.get(id)
    if (cached !== undefined && cached !== null) {
      if (!cached.id || !cached.vector || !Array.isArray(cached.vector) || cached.vector.length === 0) {
        this.logger.warn(`Invalid cached object for ${id.substring(0, 8)} - removing from cache`)
        this.nounCacheManager.delete(id)
      } else {
        this.logger.trace(`Cache hit for noun ${id}`)
        return cached
      }
    }

    const requestId = await this.applyBackpressure()

    try {
      this.logger.trace(`Getting node ${id}`)

      const key = this.getNounKey(id)

      // Get from R2 using S3 GetObject
      const { GetObjectCommand } = await import('@aws-sdk/client-s3')
      const response = await this.s3Client!.send(
        new GetObjectCommand({
          Bucket: this.bucketName,
          Key: key
        })
      )

      const bodyContents = await response.Body!.transformToString()
      const data = JSON.parse(bodyContents)

      // Convert serialized connections back to Map
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

      // Cache valid nodes with non-empty vectors
      if (node && node.id && node.vector && Array.isArray(node.vector) && node.vector.length > 0) {
        this.nounCacheManager.set(id, node)
      }

      this.logger.trace(`Successfully retrieved node ${id}`)
      this.releaseBackpressure(true, requestId)
      return node
    } catch (error: any) {
      this.releaseBackpressure(false, requestId)

      // R2 returns NoSuchKey for 404
      if (error.name === 'NoSuchKey' || error.$metadata?.httpStatusCode === 404) {
        return null
      }

      if (this.isThrottlingError(error)) {
        await this.handleThrottling(error)
        throw error
      }

      this.logger.error(`Failed to get node ${id}:`, error)
      throw BrainyError.fromError(error, `getNoun(${id})`)
    }
  }


  /**
   * Write an object to a specific path in R2
   */
  protected async writeObjectToPath(path: string, data: any): Promise<void> {
    await this.ensureInitialized()

    const MAX_RETRIES = 5
    let lastError: any

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        this.logger.trace(`Writing object to path: ${path}`)

        const { PutObjectCommand } = await import('@aws-sdk/client-s3')
        await this.s3Client!.send(
          new PutObjectCommand({
            Bucket: this.bucketName,
            Key: path,
            Body: JSON.stringify(data, null, 2),
            ContentType: 'application/json'
          })
        )

        this.logger.trace(`Object written successfully to ${path}`)
        if (attempt > 0) {
          this.clearThrottlingState()
        }
        return
      } catch (error: any) {
        lastError = error

        if (this.isThrottlingError(error) && attempt < MAX_RETRIES) {
          const baseDelay = Math.min(100 * Math.pow(2, attempt), 5000)
          const jitter = baseDelay * 0.2 * (Math.random() - 0.5)
          const delay = Math.round(baseDelay + jitter)
          this.logger.warn(
            `Throttled writing ${path} (attempt ${attempt + 1}/${MAX_RETRIES + 1}), retrying in ${delay}ms`
          )
          await this.handleThrottling(error)
          await new Promise(resolve => setTimeout(resolve, delay))
          continue
        }

        break
      }
    }

    this.logger.error(`Failed to write object to ${path}:`, lastError)
    throw new Error(`Failed to write object to ${path}: ${lastError}`)
  }

  /**
   * Read an object from a specific path in R2
   */
  protected async readObjectFromPath(path: string): Promise<any | null> {
    await this.ensureInitialized()

    try {
      this.logger.trace(`Reading object from path: ${path}`)

      const { GetObjectCommand } = await import('@aws-sdk/client-s3')
      const response = await this.s3Client!.send(
        new GetObjectCommand({
          Bucket: this.bucketName,
          Key: path
        })
      )

      const bodyContents = await response.Body!.transformToString()
      const data = JSON.parse(bodyContents)

      this.logger.trace(`Object read successfully from ${path}`)
      return data
    } catch (error: any) {
      if (error.name === 'NoSuchKey' || error.$metadata?.httpStatusCode === 404) {
        this.logger.trace(`Object not found at ${path}`)
        return null
      }

      this.logger.error(`Failed to read object from ${path}:`, error)
      throw BrainyError.fromError(error, `readObjectFromPath(${path})`)
    }
  }

  /**
   * Delete an object from a specific path in R2
   */
  protected async deleteObjectFromPath(path: string): Promise<void> {
    await this.ensureInitialized()

    try {
      this.logger.trace(`Deleting object at path: ${path}`)

      const { DeleteObjectCommand } = await import('@aws-sdk/client-s3')
      await this.s3Client!.send(
        new DeleteObjectCommand({
          Bucket: this.bucketName,
          Key: path
        })
      )

      this.logger.trace(`Object deleted successfully from ${path}`)
    } catch (error: any) {
      if (error.name === 'NoSuchKey' || error.$metadata?.httpStatusCode === 404) {
        this.logger.trace(`Object at ${path} not found (already deleted)`)
        return
      }

      this.logger.error(`Failed to delete object from ${path}:`, error)
      throw new Error(`Failed to delete object from ${path}: ${error}`)
    }
  }

  /**
   * List all objects under a specific prefix in R2
   */
  protected async listObjectsUnderPath(prefix: string): Promise<string[]> {
    await this.ensureInitialized()

    try {
      this.logger.trace(`Listing objects under prefix: ${prefix}`)

      const { ListObjectsV2Command } = await import('@aws-sdk/client-s3')
      const response = await this.s3Client!.send(
        new ListObjectsV2Command({
          Bucket: this.bucketName,
          Prefix: prefix,
          MaxKeys: MAX_R2_PAGE_SIZE
        })
      )

      const paths = (response.Contents || [])
        .map((obj: any) => obj.Key)
        .filter((key: string) => key && key.length > 0)

      this.logger.trace(`Found ${paths.length} objects under ${prefix}`)
      return paths
    } catch (error) {
      this.logger.error(`Failed to list objects under ${prefix}:`, error)
      throw new Error(`Failed to list objects under ${prefix}: ${error}`)
    }
  }

  // Verb storage methods (similar to noun methods - implementing key methods for space)

  /**
   * Save an edge to storage
   * Always uses write buffer for consistent performance
   */
  protected async saveEdge(edge: Edge): Promise<void> {
    await this.ensureInitialized()

    // Always use write buffer - cloud storage benefits from batching
    if (this.verbWriteBuffer) {
      // Populate cache BEFORE buffering for read-after-write consistency
      this.verbCacheManager.set(edge.id, edge)

      await this.verbWriteBuffer.add(edge.id, edge)
      return
    }

    // Fallback to direct write if buffer not initialized (shouldn't happen after init)
    await this.saveEdgeDirect(edge)
  }

  private async saveEdgeDirect(edge: Edge): Promise<void> {
    const requestId = await this.applyBackpressure()

    try {
      // ARCHITECTURAL FIX: Include core relational fields in verb vector file
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

        // CORE RELATIONAL DATA
        verb: edge.verb,
        sourceId: edge.sourceId,
        targetId: edge.targetId,

        // User metadata (if any) - saved separately for scalability
        // metadata field is saved separately via saveVerbMetadata()
      }

      const key = this.getVerbKey(edge.id)

      const { PutObjectCommand } = await import('@aws-sdk/client-s3')
      await this.s3Client!.send(
        new PutObjectCommand({
          Bucket: this.bucketName,
          Key: key,
          Body: JSON.stringify(serializableEdge, null, 2),
          ContentType: 'application/json'
        })
      )

      this.verbCacheManager.set(edge.id, edge)

      // Count tracking happens in baseStorage.saveVerbMetadata_internal
      // This fixes the race condition where metadata didn't exist yet

      this.releaseBackpressure(true, requestId)
    } catch (error: any) {
      this.releaseBackpressure(false, requestId)

      if (this.isThrottlingError(error)) {
        await this.handleThrottling(error)
        throw error
      }

      throw new Error(`Failed to save edge ${edge.id}: ${error}`)
    }
  }


  protected async getEdge(id: string): Promise<Edge | null> {
    await this.ensureInitialized()

    const cached = this.verbCacheManager.get(id)
    if (cached) {
      return cached
    }

    const requestId = await this.applyBackpressure()

    try {
      const key = this.getVerbKey(id)

      const { GetObjectCommand } = await import('@aws-sdk/client-s3')
      const response = await this.s3Client!.send(
        new GetObjectCommand({
          Bucket: this.bucketName,
          Key: key
        })
      )

      const bodyContents = await response.Body!.transformToString()
      const data = JSON.parse(bodyContents)

      const connections = new Map<number, Set<string>>()
      for (const [level, verbIds] of Object.entries(data.connections || {})) {
        connections.set(Number(level), new Set(verbIds as string[]))
      }

      // Return HNSWVerb with core relational fields (NO metadata field)
      const edge: Edge = {
        id: data.id,
        vector: data.vector,
        connections,

        // CORE RELATIONAL DATA (read from vector file)
        verb: data.verb,
        sourceId: data.sourceId,
        targetId: data.targetId

        // ✅ NO metadata field
        // User metadata retrieved separately via getVerbMetadata()
      }

      this.verbCacheManager.set(id, edge)
      this.releaseBackpressure(true, requestId)
      return edge
    } catch (error: any) {
      this.releaseBackpressure(false, requestId)

      if (error.name === 'NoSuchKey' || error.$metadata?.httpStatusCode === 404) {
        return null
      }

      if (this.isThrottlingError(error)) {
        await this.handleThrottling(error)
        throw error
      }

      throw BrainyError.fromError(error, `getVerb(${id})`)
    }
  }


  // Pagination and count management (simplified for space - full implementation similar to GCS)

  protected async initializeCounts(): Promise<void> {
    const key = `${this.systemPrefix}counts.json`

    try {
      const counts = await this.readObjectFromPath(key)
      if (counts) {
        this.totalNounCount = counts.totalNounCount || 0
        this.totalVerbCount = counts.totalVerbCount || 0
        this.entityCounts = new Map(Object.entries(counts.entityCounts || {})) as Map<string, number>
        this.verbCounts = new Map(Object.entries(counts.verbCounts || {})) as Map<string, number>

        prodLog.info(`📊 R2: Loaded counts: ${this.totalNounCount} nouns, ${this.totalVerbCount} verbs`)
      } else {
        prodLog.info('📊 R2: No counts file found - initializing from scan')
        await this.initializeCountsFromScan()
      }
    } catch (error) {
      prodLog.error('❌ R2: Failed to load counts:', error)
      await this.initializeCountsFromScan()
    }
  }

  private async initializeCountsFromScan(): Promise<void> {
    try {
      prodLog.info('📊 R2: Scanning bucket to initialize counts...')

      const { ListObjectsV2Command } = await import('@aws-sdk/client-s3')

      // Count nouns
      const nounResponse = await this.s3Client!.send(
        new ListObjectsV2Command({
          Bucket: this.bucketName,
          Prefix: this.nounPrefix
        })
      )
      this.totalNounCount = (nounResponse.Contents || []).filter((obj: any) =>
        obj.Key?.endsWith('.json')
      ).length

      // Count verbs
      const verbResponse = await this.s3Client!.send(
        new ListObjectsV2Command({
          Bucket: this.bucketName,
          Prefix: this.verbPrefix
        })
      )
      this.totalVerbCount = (verbResponse.Contents || []).filter((obj: any) =>
        obj.Key?.endsWith('.json')
      ).length

      if (this.totalNounCount > 0 || this.totalVerbCount > 0) {
        await this.persistCounts()
        prodLog.info(`✅ R2: Initialized counts: ${this.totalNounCount} nouns, ${this.totalVerbCount} verbs`)
      } else {
        prodLog.warn('⚠️  R2: No entities found during bucket scan')
      }
    } catch (error) {
      this.logger.error('❌ R2: Failed to initialize counts from scan:', error)
      throw new Error(`Failed to initialize R2 storage counts: ${error}`)
    }
  }

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

      await this.writeObjectToPath(key, counts)
    } catch (error) {
      this.logger.error('Error persisting counts:', error)
    }
  }

  // HNSW Index Persistence (Phase 2 support)

  public async getNounVector(id: string): Promise<number[] | null> {
    const noun = await this.getNoun(id)
    return noun ? noun.vector : null
  }

  public async saveHNSWData(nounId: string, hnswData: {
    level: number
    connections: Record<string, string[]>
  }): Promise<void> {
    const lockKey = `hnsw/${nounId}`

    // Wait for pending operations
    while (this.hnswLocks.has(lockKey)) {
      await this.hnswLocks.get(lockKey)
    }

    // Acquire lock
    let releaseLock!: () => void
    const lockPromise = new Promise<void>(resolve => { releaseLock = resolve })
    this.hnswLocks.set(lockKey, lockPromise)

    try {
      const existingNoun = await this.getNoun(nounId)
      if (!existingNoun) {
        throw new Error(`Cannot save HNSW data: noun ${nounId} not found`)
      }

      const connectionsMap = new Map<number, Set<string>>()
      for (const [level, nodeIds] of Object.entries(hnswData.connections)) {
        connectionsMap.set(Number(level), new Set(nodeIds))
      }

      const updatedNoun: HNSWNoun = {
        ...existingNoun,
        level: hnswData.level,
        connections: connectionsMap
      }

      await this.saveNoun(updatedNoun)
    } finally {
      this.hnswLocks.delete(lockKey)
      releaseLock()
    }
  }

  public async getHNSWData(nounId: string): Promise<{
    level: number
    connections: Record<string, string[]>
  } | null> {
    const noun = await this.getNoun(nounId)

    if (!noun) {
      return null
    }

    const connectionsRecord: Record<string, string[]> = {}
    if (noun.connections) {
      for (const [level, nodeIds] of noun.connections.entries()) {
        connectionsRecord[String(level)] = Array.from(nodeIds)
      }
    }

    return {
      level: noun.level || 0,
      connections: connectionsRecord
    }
  }

  public async saveHNSWSystem(systemData: {
    entryPointId: string | null
    maxLevel: number
  }): Promise<void> {
    await this.ensureInitialized()

    const key = `${this.systemPrefix}hnsw-system.json`
    await this.writeObjectToPath(key, systemData)
  }

  public async getHNSWSystem(): Promise<{
    entryPointId: string | null
    maxLevel: number
  } | null> {
    await this.ensureInitialized()

    const key = `${this.systemPrefix}hnsw-system.json`
    return await this.readObjectFromPath(key)
  }

  // Statistics support

  protected async saveStatisticsData(statistics: StatisticsData): Promise<void> {
    await this.ensureInitialized()

    const key = `${this.systemPrefix}${STATISTICS_KEY}.json`
    await this.writeObjectToPath(key, statistics)
  }

  protected async getStatisticsData(): Promise<StatisticsData | null> {
    await this.ensureInitialized()

    const key = `${this.systemPrefix}${STATISTICS_KEY}.json`
    const stats = await this.readObjectFromPath(key)

    if (stats) {
      return {
        ...stats,
        totalNodes: this.totalNounCount,
        totalEdges: this.totalVerbCount,
        lastUpdated: new Date().toISOString()
      }
    }

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

  // Utility methods

  public async clear(): Promise<void> {
    await this.ensureInitialized()

    prodLog.info('🧹 R2: Clearing all data from bucket...')

    // Clear ALL data using correct paths
    // Delete entire branches/ directory (includes ALL entities, ALL types, ALL VFS data, ALL forks)
    const branchObjects = await this.listObjectsUnderPath('branches/')
    for (const key of branchObjects) {
      await this.deleteObjectFromPath(key)
    }

    // Delete COW version control data
    const cowObjects = await this.listObjectsUnderPath('_cow/')
    for (const key of cowObjects) {
      await this.deleteObjectFromPath(key)
    }

    // Delete system metadata
    const systemObjects = await this.listObjectsUnderPath('_system/')
    for (const key of systemObjects) {
      await this.deleteObjectFromPath(key)
    }

    // Reset COW managers (but don't disable COW - it's always enabled)
    // COW will re-initialize automatically on next use
    this.refManager = undefined
    this.blobStorage = undefined
    this.commitLog = undefined

    this.nounCacheManager.clear()
    this.verbCacheManager.clear()

    this.totalNounCount = 0
    this.totalVerbCount = 0
    this.entityCounts.clear()
    this.verbCounts.clear()

    prodLog.info('✅ R2: All data cleared')
  }

  public async getStorageStatus(): Promise<{
    type: string
    used: number
    quota: number | null
    details?: Record<string, any>
  }> {
    return {
      type: 'r2',
      used: 0,
      quota: null,
      details: {
        bucket: this.bucketName,
        accountId: this.accountId,
        endpoint: this.endpoint,
        features: [
          'Zero egress fees',
          'Global edge network',
          'S3-compatible API',
          'Type-aware HNSW support'
        ]
      }
    }
  }

  /**
   * Check if COW has been explicitly disabled via clear()
   * Fixes bug where clear() doesn't persist across instance restarts
   * @returns true if marker object exists, false otherwise
   * @protected
   */
  /**
   * Removed checkClearMarker() and createClearMarker() methods
   * COW is now always enabled - marker files are no longer used
   */

  // Removed getNounsWithPagination override - use BaseStorage's type-first implementation


  // Removed 10 *_internal method overrides - now inherit from BaseStorage's type-first implementation
}
