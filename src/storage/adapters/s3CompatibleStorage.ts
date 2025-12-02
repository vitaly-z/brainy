/**
 * S3-Compatible Storage Adapter
 * Uses the AWS S3 client to interact with S3-compatible storage services
 * including Amazon S3, Cloudflare R2, and Google Cloud Storage
 */

import {
  Change,
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
import { StorageCompatibilityLayer, StoragePaths } from '../backwardCompatibility.js'
import {
  StorageOperationExecutors,
  OperationConfig
} from '../../utils/operationUtils.js'
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

// Change log entry interface for tracking data modifications
interface ChangeLogEntry {
  timestamp: number
  operation: 'add' | 'update' | 'delete'
  entityType: 'noun' | 'verb' | 'metadata'
  entityId: string
  data?: any
  instanceId?: string
}

// Legacy: R2Storage alias (use dedicated R2Storage from r2Storage.ts instead)
// export { S3CompatibleStorage as R2Storage } // Deprecated - use dedicated R2Storage

// S3 client and command types - dynamically imported to avoid issues in browser environments
type S3Client = any
type S3Command = any

/**
 * S3-compatible storage adapter for server environments
 * Uses the AWS S3 client to interact with S3-compatible storage services
 * including Amazon S3, Cloudflare R2, and Google Cloud Storage
 *
 * To use this adapter with Amazon S3, you need to provide:
 * - region: AWS region (e.g., 'us-east-1')
 * - credentials: AWS credentials (accessKeyId and secretAccessKey)
 * - bucketName: S3 bucket name
 *
 * To use this adapter with Cloudflare R2, you need to provide:
 * - accountId: Cloudflare account ID
 * - accessKeyId: R2 access key ID
 * - secretAccessKey: R2 secret access key
 * - bucketName: R2 bucket name
 *
 * To use this adapter with Google Cloud Storage, you need to provide:
 * - region: GCS region (e.g., 'us-central1')
 * - credentials: GCS credentials (accessKeyId and secretAccessKey)
 * - endpoint: GCS endpoint (e.g., 'https://storage.googleapis.com')
 * - bucketName: GCS bucket name
 *
 * v5.4.0: Type-aware storage now built into BaseStorage
 * - Removed 10 *_internal method overrides (now inherit from BaseStorage's type-first implementation)
 * - Removed 2 pagination method overrides (getNounsWithPagination, getVerbsWithPagination)
 * - Updated HNSW methods to use BaseStorage's getNoun/saveNoun (type-first paths)
 * - All operations now use type-first paths: entities/nouns/{type}/vectors/{shard}/{id}.json
 */
export class S3CompatibleStorage extends BaseStorage {
  private s3Client: S3Client | null = null
  private bucketName: string
  private serviceType: string
  private region: string
  private endpoint?: string
  private accountId?: string
  private accessKeyId: string
  private secretAccessKey: string
  private sessionToken?: string

  // Prefixes for different types of data
  private nounPrefix: string
  private verbPrefix: string
  private metadataPrefix: string  // Noun metadata
  private verbMetadataPrefix: string  // Verb metadata
  private indexPrefix: string  // Legacy - for backward compatibility
  private systemPrefix: string  // New location for system data
  private useDualWrite: boolean = true  // Write to both locations during migration

  // Statistics caching for better performance
  protected statisticsCache: StatisticsData | null = null

  // Distributed locking for concurrent access control
  private lockPrefix: string = 'locks/'
  private activeLocks: Set<string> = new Set()

  // Change log for efficient synchronization
  private changeLogPrefix: string = 'change-log/'

  // Backpressure and performance management
  private pendingOperations: number = 0
  private maxConcurrentOperations: number = 100
  private baseBatchSize: number = 10
  private currentBatchSize: number = 10
  private lastMemoryCheck: number = 0
  private memoryCheckInterval: number = 5000 // Check every 5 seconds
  private consecutiveErrors: number = 0
  private lastErrorReset: number = Date.now()
  
  // Adaptive socket manager for automatic optimization
  private socketManager = getGlobalSocketManager()
  
  // Adaptive backpressure for automatic flow control
  private backpressure = getGlobalBackpressure()
  
  // Write buffers for bulk operations
  private nounWriteBuffer: WriteBuffer<HNSWNode> | null = null
  private verbWriteBuffer: WriteBuffer<Edge> | null = null

  // Distributed components (optional)
  private coordinator?: any // DistributedCoordinator
  private cacheSync?: any // CacheSync
  private readWriteSeparation?: any // ReadWriteSeparation

  // Note: Sharding is always enabled via UUID-based prefixes (00-ff)
  // ShardManager is no longer used - sharding is deterministic

  // Request coalescer for deduplication
  private requestCoalescer: RequestCoalescer | null = null
  
  // v6.2.7: Write buffering always enabled for consistent performance
  // Removes dynamic mode switching complexity - cloud storage always benefits from batching

  // Operation executors for timeout and retry handling
  private operationExecutors: StorageOperationExecutors
  
  // Multi-level cache manager for efficient data access
  private nounCacheManager: CacheManager<HNSWNode>
  private verbCacheManager: CacheManager<Edge>
  
  // Module logger
  private logger = createModuleLogger('S3Storage')

  // v5.4.0: HNSW mutex locks to prevent read-modify-write races
  private hnswLocks = new Map<string, Promise<void>>()

  /**
   * Initialize the storage adapter
   * @param options Configuration options for the S3-compatible storage
   */
  constructor(options: {
    bucketName: string
    region?: string
    endpoint?: string
    accountId?: string
    accessKeyId: string
    secretAccessKey: string
    sessionToken?: string
    serviceType?: string
    operationConfig?: OperationConfig
    cacheConfig?: {
      hotCacheMaxSize?: number
      hotCacheEvictionThreshold?: number
      warmCacheTTL?: number
    }
    readOnly?: boolean
  }) {
    super()
    this.bucketName = options.bucketName
    this.region = options.region || 'auto'
    this.endpoint = options.endpoint
    this.accountId = options.accountId
    this.accessKeyId = options.accessKeyId
    this.secretAccessKey = options.secretAccessKey
    this.sessionToken = options.sessionToken
    this.serviceType = options.serviceType || 's3'
    this.readOnly = options.readOnly || false

    // Initialize operation executors with timeout and retry configuration
    this.operationExecutors = new StorageOperationExecutors(
      options.operationConfig
    )

    // Set up prefixes for different types of data using new entity-based structure
    this.nounPrefix = `${getDirectoryPath('noun', 'vector')}/`
    this.verbPrefix = `${getDirectoryPath('verb', 'vector')}/`
    this.metadataPrefix = `${getDirectoryPath('noun', 'metadata')}/`  // Noun metadata
    this.verbMetadataPrefix = `${getDirectoryPath('verb', 'metadata')}/`  // Verb metadata
    this.indexPrefix = `${INDEX_DIR}/`  // Legacy
    this.systemPrefix = `${SYSTEM_DIR}/`  // New
    
    // Initialize cache managers
    this.nounCacheManager = new CacheManager<HNSWNode>(options.cacheConfig)
    this.verbCacheManager = new CacheManager<Edge>(options.cacheConfig)
  }

  /**
   * Get S3-optimized batch configuration with native batch API support
   *
   * S3 has excellent throughput and handles parallel operations efficiently:
   * - Large batch sizes (up to 1000 paths)
   * - No artificial delay needed (S3 handles load automatically)
   * - High concurrency (150 parallel requests optimal for most workloads)
   *
   * S3 supports ~5000 operations/second with burst capacity up to 10,000
   *
   * @returns S3-optimized batch configuration
   * @since v5.12.0 - Updated for native batch API
   */
  public getBatchConfig(): StorageBatchConfig {
    return {
      maxBatchSize: 1000,              // S3 can handle very large batches
      batchDelayMs: 0,                 // No rate limiting needed
      maxConcurrent: 150,              // Optimal for S3 (tested up to 250)
      supportsParallelWrites: true,    // S3 excels at parallel writes
      rateLimit: {
        operationsPerSecond: 5000,     // S3 has high throughput
        burstCapacity: 10000
      }
    }
  }

  /**
   * Batch read operation using S3's parallel download capabilities
   *
   * Uses Promise.allSettled() for maximum parallelism with GetObjectCommand.
   * S3's HTTP/2 and connection pooling make this extremely efficient.
   *
   * Performance: ~150 concurrent requests = <500ms for 150 objects
   *
   * @param paths - Array of S3 object keys to read
   * @returns Map of path -> parsed JSON data (only successful reads)
   * @since v5.12.0
   */
  public async readBatch(paths: string[]): Promise<Map<string, any>> {
    await this.ensureInitialized()

    const results = new Map<string, any>()
    if (paths.length === 0) return results

    const batchConfig = this.getBatchConfig()
    const chunkSize = batchConfig.maxConcurrent || 150

    this.logger.debug(`[S3 Batch] Reading ${paths.length} objects in chunks of ${chunkSize}`)

    // Import GetObjectCommand
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
              this.logger.warn(`[S3 Batch] Failed to read ${path}: ${error.message}`)
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

    this.logger.debug(`[S3 Batch] Successfully read ${results.size}/${paths.length} objects`)
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
      // Import AWS SDK modules only when needed
      const { S3Client } = await import('@aws-sdk/client-s3')

      // Configure the S3 client based on the service type
      const clientConfig: any = {
        region: this.region,
        credentials: {
          accessKeyId: this.accessKeyId,
          secretAccessKey: this.secretAccessKey
        },
        // Use adaptive socket manager for automatic optimization
        requestHandler: this.socketManager.getHttpHandler(),
        // Retry configuration for resilience
        maxAttempts: 5,  // Retry up to 5 times
        retryMode: 'adaptive'  // Use adaptive retry with backoff
      }

      // Add session token if provided
      if (this.sessionToken) {
        clientConfig.credentials.sessionToken = this.sessionToken
      }

      // Add endpoint if provided (for R2, GCS, etc.)
      if (this.endpoint) {
        clientConfig.endpoint = this.endpoint
      }

      // Special configuration for Cloudflare R2
      if (this.serviceType === 'r2' && this.accountId) {
        clientConfig.endpoint = `https://${this.accountId}.r2.cloudflarestorage.com`
      }

      // Create the S3 client
      this.s3Client = new S3Client(clientConfig)

      // Ensure the bucket exists and is accessible
      const { HeadBucketCommand } = await import('@aws-sdk/client-s3')
      await this.s3Client.send(
        new HeadBucketCommand({
          Bucket: this.bucketName
        })
      )
      
      // Create storage adapter proxies for the cache managers
      const nounStorageAdapter = {
        get: async (id: string) => this.getNoun_internal(id),
        set: async (id: string, node: HNSWNode) => this.saveNoun_internal(node),
        delete: async (id: string) => this.deleteNoun_internal(id),
        getMany: async (ids: string[]) => {
          const result = new Map<string, HNSWNode>()
          // Process in batches to avoid overwhelming the S3 API
          const batchSize = this.getBatchSize()
          const batches: string[][] = []
          
          // Split into batches
          for (let i = 0; i < ids.length; i += batchSize) {
            const batch = ids.slice(i, i + batchSize)
            batches.push(batch)
          }
          
          // Process each batch
          for (const batch of batches) {
            const batchResults = await Promise.all(
              batch.map(async (id) => {
                const node = await this.getNoun_internal(id)
                return { id, node }
              })
            )
            
            // Add results to map
            for (const { id, node } of batchResults) {
              if (node) {
                result.set(id, node)
              }
            }
          }
          
          return result
        },
        clear: async () => {
          // No-op for now, as we don't want to clear the entire storage
          // This would be implemented if needed
        }
      }
      
      const verbStorageAdapter = {
        get: async (id: string) => this.getVerb_internal(id),
        set: async (id: string, edge: Edge) => this.saveVerb_internal(edge),
        delete: async (id: string) => this.deleteVerb_internal(id),
        getMany: async (ids: string[]) => {
          const result = new Map<string, Edge>()
          // Process in batches to avoid overwhelming the S3 API
          const batchSize = this.getBatchSize()
          const batches: string[][] = []
          
          // Split into batches
          for (let i = 0; i < ids.length; i += batchSize) {
            const batch = ids.slice(i, i + batchSize)
            batches.push(batch)
          }
          
          // Process each batch
          for (const batch of batches) {
            const batchResults = await Promise.all(
              batch.map(async (id) => {
                const edge = await this.getVerb_internal(id)
                return { id, edge }
              })
            )
            
            // Add results to map
            for (const { id, edge } of batchResults) {
              if (edge) {
                result.set(id, edge)
              }
            }
          }
          
          return result
        },
        clear: async () => {
          // No-op for now, as we don't want to clear the entire storage
          // This would be implemented if needed
        }
      }
      
      // Set storage adapters for cache managers
      this.nounCacheManager.setStorageAdapters(nounStorageAdapter, nounStorageAdapter)
      this.verbCacheManager.setStorageAdapters(verbStorageAdapter, verbStorageAdapter)

      // Initialize write buffers for high-volume scenarios
      this.initializeBuffers()
      
      // Initialize request coalescer
      this.initializeCoalescer()
      
      // Auto-cleanup legacy /index folder on initialization
      await this.cleanupLegacyIndexFolder()

      // Initialize counts from storage
      await this.initializeCounts()

      // CRITICAL FIX (v3.37.7): Clear any stale cache entries from previous runs
      // This prevents cache poisoning from causing silent failures on container restart
      const nodeCacheSize = this.nodeCache?.size || 0
      if (nodeCacheSize > 0) {
        prodLog.info(`🧹 Clearing ${nodeCacheSize} cached node entries from previous run`)
        this.nodeCache.clear()
      } else {
        prodLog.info('🧹 Node cache is empty - starting fresh')
      }

      // v6.0.0: Initialize GraphAdjacencyIndex and type statistics
      await super.init()
      this.logger.info(`Initialized ${this.serviceType} storage with bucket ${this.bucketName}`)
    } catch (error) {
      this.logger.error(`Failed to initialize ${this.serviceType} storage:`, error)
      throw new Error(
        `Failed to initialize ${this.serviceType} storage: ${error}`
      )
    }
  }

  /**
   * Set distributed components for multi-node coordination
   *
   * Note: Sharding is always enabled via UUID-based prefixes (00-ff).
   * ShardManager is no longer required - sharding is deterministic based on UUID.
   */
  public setDistributedComponents(components: {
    coordinator?: any
    shardManager?: any // Deprecated - kept for backward compatibility
    cacheSync?: any
    readWriteSeparation?: any
  }): void {
    this.coordinator = components.coordinator
    this.cacheSync = components.cacheSync
    this.readWriteSeparation = components.readWriteSeparation

    // Note: UUID-based sharding is always active (256 shards: 00-ff)
    console.log(`🎯 S3 Storage: UUID-based sharding active (256 shards: 00-ff)`)

    if (this.coordinator) {
      console.log(`🤝 S3 Storage: Distributed coordination active (node: ${this.coordinator.nodeId})`)
    }

    if (this.cacheSync) {
      console.log('🔄 S3 Storage: Cache synchronization enabled')
    }

    if (this.readWriteSeparation) {
      console.log(`📖 S3 Storage: Read/write separation with ${this.readWriteSeparation.config?.replicationFactor || 3}x replication`)
    }
  }

  /**
   * Get the S3 key for a noun using UUID-based sharding
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
   * Get the S3 key for a verb using UUID-based sharding
   *
   * Uses first 2 hex characters of UUID for consistent sharding.
   * Path format: verbs/{shardId}/{uuid}.json
   *
   * @example
   * getVerbKey('cd987654-4321-8765-cba9-fed543210987')
   * // returns 'verbs/cd/cd987654-4321-8765-cba9-fed543210987.json'
   */
  private getVerbKey(id: string): string {
    const shardId = getShardIdFromUuid(id)
    return `${this.verbPrefix}${shardId}/${id}.json`
  }

  /**
   * Override base class method to detect S3-specific throttling errors
   */
  protected isThrottlingError(error: any): boolean {
    // First check base class detection
    if (super.isThrottlingError(error)) {
      return true
    }
    
    // Additional S3-specific checks
    const message = error.message?.toLowerCase() || ''
    return (
      message.includes('please reduce your request rate') ||
      message.includes('service unavailable') ||
      error.Code === 'SlowDown' ||
      error.Code === 'RequestLimitExceeded' ||
      error.Code === 'ServiceUnavailable'
    )
  }

  /**
   * Override to add S3-specific logging
   */
  async handleThrottling(error: any, service?: string): Promise<void> {
    if (this.isThrottlingError(error)) {
      prodLog.warn(`🐌 S3 storage throttling detected (${error.$metadata?.httpStatusCode || error.Code || 'timeout'}). Backing off...`)
    }
    
    // Call base class implementation
    await super.handleThrottling(error, service)
    
    if (!this.isThrottlingError(error) && this.consecutiveThrottleEvents === 0 && !this.throttlingDetected) {
      prodLog.info('✅ S3 storage throttling cleared')
    }
  }

  /**
   * Smart delay based on current throttling status
   */
  private async smartDelay(): Promise<void> {
    if (this.throttlingDetected) {
      // If currently throttled, add a preventive delay
      const timeSinceThrottle = Date.now() - this.lastThrottleTime
      if (timeSinceThrottle < 60000) { // Within 1 minute of throttling
        await new Promise(resolve => setTimeout(resolve, Math.min(this.throttlingBackoffMs / 2, 5000)))
      }
    } else {
      // Normal yield
      await new Promise(resolve => setImmediate(resolve))
    }
  }

  /**
   * Auto-cleanup legacy /index folder during initialization
   * This removes old index data that has been migrated to _system
   */
  private async cleanupLegacyIndexFolder(): Promise<void> {
    try {
      // Check if there are any objects in the legacy index folder
      const { ListObjectsV2Command } = await import('@aws-sdk/client-s3')
      
      const listResponse = await this.s3Client!.send(
        new ListObjectsV2Command({
          Bucket: this.bucketName,
          Prefix: this.indexPrefix,
          MaxKeys: 1 // Just check if anything exists
        })
      )

      // If there are objects in the legacy index folder, clean them up
      if (listResponse.Contents && listResponse.Contents.length > 0) {
        prodLog.info(`🧹 Cleaning up legacy /index folder during initialization...`)
        
        // Use the existing deleteObjectsWithPrefix function logic
        const { ListObjectsV2Command, DeleteObjectsCommand } = await import('@aws-sdk/client-s3')
        
        let continuationToken: string | undefined = undefined
        let totalDeleted = 0
        
        do {
          const listResponseBatch: any = await this.s3Client!.send(
            new ListObjectsV2Command({
              Bucket: this.bucketName,
              Prefix: this.indexPrefix,
              ContinuationToken: continuationToken
            })
          )
          
          if (listResponseBatch.Contents && listResponseBatch.Contents.length > 0) {
            const objectsToDelete = listResponseBatch.Contents.map((obj: any) => ({
              Key: obj.Key!
            }))
            
            await this.s3Client!.send(
              new DeleteObjectsCommand({
                Bucket: this.bucketName,
                Delete: {
                  Objects: objectsToDelete
                }
              })
            )
            
            totalDeleted += objectsToDelete.length
          }
          
          continuationToken = listResponseBatch.NextContinuationToken
        } while (continuationToken)
        
        prodLog.info(`✅ Cleaned up ${totalDeleted} legacy index objects`)
      } else {
        prodLog.debug('No legacy /index folder found - already clean')
      }
    } catch (error) {
      // Don't fail initialization if cleanup fails
      prodLog.warn('Failed to cleanup legacy /index folder:', error)
    }
  }

  /**
   * Initialize write buffers for high-volume scenarios
   */
  private initializeBuffers(): void {
    const storageId = `${this.serviceType}-${this.bucketName}`
    
    // Create noun write buffer
    this.nounWriteBuffer = getWriteBuffer<HNSWNode>(
      `${storageId}-nouns`,
      'noun',
      async (items) => {
        // Bulk write nouns to S3
        await this.bulkWriteNouns(items)
      }
    )
    
    // Create verb write buffer
    this.verbWriteBuffer = getWriteBuffer<Edge>(
      `${storageId}-verbs`,
      'verb',
      async (items) => {
        // Bulk write verbs to S3
        await this.bulkWriteVerbs(items)
      }
    )
  }
  
  /**
   * Initialize request coalescer
   */
  private initializeCoalescer(): void {
    const storageId = `${this.serviceType}-${this.bucketName}`
    
    this.requestCoalescer = getCoalescer(
      storageId,
      async (batch) => {
        // Process coalesced operations
        await this.processCoalescedBatch(batch)
      }
    )
  }
  
  // v6.2.7: Removed checkVolumeMode() - write buffering always enabled for cloud storage

  /**
   * Bulk write nouns to S3
   */
  private async bulkWriteNouns(items: Map<string, HNSWNode>): Promise<void> {
    const { PutObjectCommand } = await import('@aws-sdk/client-s3')
    
    // Process in parallel with limited concurrency
    const promises: Promise<void>[] = []
    const batchSize = 10  // Process 10 at a time
    const entries = Array.from(items.entries())
    
    for (let i = 0; i < entries.length; i += batchSize) {
      const batch = entries.slice(i, i + batchSize)
      
      const batchPromise = Promise.all(
        batch.map(async ([id, node]) => {
          const serializableNode = {
            ...node,
            connections: this.mapToObject(node.connections, (set) =>
              Array.from(set as Set<string>)
            )
          }
          
          const key = `${this.nounPrefix}${id}.json`
          const body = JSON.stringify(serializableNode, null, 2)
          
          await this.s3Client!.send(
            new PutObjectCommand({
              Bucket: this.bucketName,
              Key: key,
              Body: body,
              ContentType: 'application/json'
            })
          )
        })
      ).then(() => {}) // Convert Promise<void[]> to Promise<void>
      
      promises.push(batchPromise)
    }
    
    await Promise.all(promises)
  }
  
  /**
   * Bulk write verbs to S3
   */
  private async bulkWriteVerbs(items: Map<string, Edge>): Promise<void> {
    const { PutObjectCommand } = await import('@aws-sdk/client-s3')
    
    // Process in parallel with limited concurrency
    const promises: Promise<void>[] = []
    const batchSize = 10
    const entries = Array.from(items.entries())
    
    for (let i = 0; i < entries.length; i += batchSize) {
      const batch = entries.slice(i, i + batchSize)
      
      const batchPromise = Promise.all(
        batch.map(async ([id, edge]) => {
          const serializableEdge = {
            ...edge,
            connections: this.mapToObject(edge.connections, (set) =>
              Array.from(set as Set<string>)
            )
          }
          
          const key = `${this.verbPrefix}${id}.json`
          const body = JSON.stringify(serializableEdge, null, 2)
          
          await this.s3Client!.send(
            new PutObjectCommand({
              Bucket: this.bucketName,
              Key: key,
              Body: body,
              ContentType: 'application/json'
            })
          )
        })
      ).then(() => {}) // Convert Promise<void[]> to Promise<void>
      
      promises.push(batchPromise)
    }
    
    await Promise.all(promises)
  }
  
  /**
   * Process coalesced batch of operations
   */
  private async processCoalescedBatch(batch: any[]): Promise<void> {
    // Group operations by type
    const writes: any[] = []
    const reads: any[] = []
    const deletes: any[] = []
    
    for (const op of batch) {
      if (op.type === 'write') {
        writes.push(op)
      } else if (op.type === 'read') {
        reads.push(op)
      } else if (op.type === 'delete') {
        deletes.push(op)
      }
    }
    
    // Process in order: deletes, writes, reads
    if (deletes.length > 0) {
      await this.processBulkDeletes(deletes)
    }
    if (writes.length > 0) {
      await this.processBulkWrites(writes)
    }
    if (reads.length > 0) {
      await this.processBulkReads(reads)
    }
  }
  
  /**
   * Process bulk deletes
   */
  private async processBulkDeletes(deletes: any[]): Promise<void> {
    const { DeleteObjectCommand } = await import('@aws-sdk/client-s3')
    
    await Promise.all(
      deletes.map(async (op) => {
        await this.s3Client!.send(
          new DeleteObjectCommand({
            Bucket: this.bucketName,
            Key: op.key
          })
        )
      })
    )
  }
  
  /**
   * Process bulk writes
   */
  private async processBulkWrites(writes: any[]): Promise<void> {
    const { PutObjectCommand } = await import('@aws-sdk/client-s3')
    
    await Promise.all(
      writes.map(async (op) => {
        await this.s3Client!.send(
          new PutObjectCommand({
            Bucket: this.bucketName,
            Key: op.key,
            Body: JSON.stringify(op.data),
            ContentType: 'application/json'
          })
        )
      })
    )
  }
  
  /**
   * Process bulk reads
   */
  private async processBulkReads(reads: any[]): Promise<void> {
    const { GetObjectCommand } = await import('@aws-sdk/client-s3')
    
    await Promise.all(
      reads.map(async (op) => {
        try {
          const response = await this.s3Client!.send(
            new GetObjectCommand({
              Bucket: this.bucketName,
              Key: op.key
            })
          )
          
          if (response.Body) {
            const data = await response.Body.transformToString()
            op.data = JSON.parse(data)
          }
        } catch (error) {
          op.data = null
        }
      })
    )
  }

  /**
   * Dynamically adjust batch size based on memory pressure and error rates
   */
  private adjustBatchSize(): void {
    // Let the adaptive socket manager handle batch size optimization
    this.currentBatchSize = this.socketManager.getBatchSize()
    
    // Get adaptive configuration for concurrent operations
    const config = this.socketManager.getConfig()
    this.maxConcurrentOperations = Math.min(config.maxSockets * 2, 500)
    
    // Track metrics for the socket manager
    const now = Date.now()
    
    // Reset error counter periodically if no recent errors
    if (now - this.lastErrorReset > 60000 && this.consecutiveErrors > 0) {
      this.consecutiveErrors = Math.max(0, this.consecutiveErrors - 1)
      this.lastErrorReset = now
    }
  }

  /**
   * Apply backpressure when system is under load
   */
  private async applyBackpressure(): Promise<string> {
    // Generate unique request ID for tracking
    const requestId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    
    try {
      // Use adaptive backpressure system
      await this.backpressure.requestPermission(requestId, 1)
      
      // Track with socket manager
      this.socketManager.trackRequestStart(requestId)
      
      this.pendingOperations++
      return requestId
    } catch (error) {
      // If backpressure rejects, throw a more informative error
      const message = error instanceof Error ? error.message : String(error)
      throw new Error(`System overloaded: ${message}`)
    }
  }

  /**
   * Release backpressure after operation completes
   */
  private releaseBackpressure(success: boolean = true, requestId?: string): void {
    this.pendingOperations = Math.max(0, this.pendingOperations - 1)
    
    if (requestId) {
      // Track with socket manager
      this.socketManager.trackRequestComplete(requestId, success)
      
      // Release from backpressure system
      this.backpressure.releasePermission(requestId, success)
    }
    
    if (!success) {
      this.consecutiveErrors++
    } else if (this.consecutiveErrors > 0) {
      // Gradually reduce error count on success
      this.consecutiveErrors = Math.max(0, this.consecutiveErrors - 0.5)
    }
    
    // Adjust batch size based on current conditions
    this.adjustBatchSize()
  }

  /**
   * Get current batch size for operations
   */
  private getBatchSize(): number {
    // Use adaptive socket manager's batch size
    return this.socketManager.getBatchSize()
  }

  // v5.4.0: Removed 10 *_internal method overrides (lines 984-2069) - now inherit from BaseStorage's type-first implementation

  /**
   * Save a node to storage
   * v6.2.7: Always uses write buffer for consistent performance
   */
  protected async saveNode(node: HNSWNode): Promise<void> {
    await this.ensureInitialized()

    // v6.2.7: Always use write buffer - cloud storage benefits from batching
    if (this.nounWriteBuffer) {
      this.logger.trace(`📝 BUFFERING: Adding noun ${node.id} to write buffer`)

      // v6.2.6: Populate cache BEFORE buffering for read-after-write consistency
      if (node.vector && Array.isArray(node.vector) && node.vector.length > 0) {
        this.nounCacheManager.set(node.id, node)
      }

      await this.nounWriteBuffer.add(node.id, node)
      return
    }

    // Fallback to direct write if buffer not initialized (shouldn't happen after init)
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
        connections: this.mapToObject(node.connections, (set) =>
          Array.from(set as Set<string>)
        ),
        level: node.level || 0
        // NO metadata field - saved separately for scalability
      }

      // Import the PutObjectCommand only when needed
      const { PutObjectCommand } = await import('@aws-sdk/client-s3')

      // Use sharding if available
      const key = this.getNounKey(node.id)
      const body = JSON.stringify(serializableNode, null, 2)

      this.logger.trace(`Saving to key: ${key}`)

      // Save the node to S3-compatible storage
      const result = await this.s3Client!.send(
        new PutObjectCommand({
          Bucket: this.bucketName,
          Key: key,
          Body: body,
          ContentType: 'application/json'
        })
      )

      this.logger.debug(`Node ${node.id} saved successfully`)

      // Log the change for efficient synchronization (v4.0.0: no metadata on node)
      await this.appendToChangeLog({
        timestamp: Date.now(),
        operation: 'add', // Could be 'update' if we track existing nodes
        entityType: 'noun',
        entityId: node.id,
        data: {
          vector: node.vector
          // ✅ NO metadata field in v4.0.0 - stored separately
        }
      })

      // Verify the node was saved by trying to retrieve it
      const { GetObjectCommand } = await import('@aws-sdk/client-s3')
      try {
        const verifyResponse = await this.s3Client!.send(
          new GetObjectCommand({
            Bucket: this.bucketName,
            Key: key
          })
        )

        if (verifyResponse && verifyResponse.Body) {
          this.logger.trace(`Verified node ${node.id} was saved correctly`)
        } else {
          this.logger.warn(
            `Failed to verify node ${node.id} was saved correctly: no response or body`
          )
        }
      } catch (verifyError) {
        this.logger.warn(
          `Failed to verify node ${node.id} was saved correctly:`,
          verifyError
        )
      }

      // Increment noun count - always increment total, and increment by type if metadata exists
      this.totalNounCount++
      const metadata = await this.getNounMetadata(node.id)
      if (metadata && metadata.type) {
        const currentCount = this.entityCounts.get(metadata.type as string) || 0
        this.entityCounts.set(metadata.type as string, currentCount + 1)
      }

      // Release backpressure on success
      this.releaseBackpressure(true, requestId)
    } catch (error) {
      // Release backpressure on error
      this.releaseBackpressure(false, requestId)
      this.logger.error(`Failed to save node ${node.id}:`, error)
      throw new Error(`Failed to save node ${node.id}: ${error}`)
    }
  }

  // v5.4.0: Removed getNoun_internal override - uses BaseStorage type-first implementation

  /**
   * Get a node from storage
   */
  protected async getNode(id: string): Promise<HNSWNode | null> {
    await this.ensureInitialized()

    // Check cache first
    const cached = this.nodeCache.get(id)

    // Validate cached object before returning (v3.37.8+)
    if (cached !== undefined && cached !== null) {
      // Validate cached object has required fields (including non-empty vector!)
      if (!cached.id || !cached.vector || !Array.isArray(cached.vector) || cached.vector.length === 0) {
        // Invalid cache detected - log and auto-recover
        prodLog.warn(`[S3] Invalid cached object for ${id.substring(0, 8)} (${
          !cached.id ? 'missing id' :
          !cached.vector ? 'missing vector' :
          !Array.isArray(cached.vector) ? 'vector not array' :
          'empty vector'
        }) - removing from cache and reloading`)
        this.nodeCache.delete(id)
        // Fall through to load from S3
      } else {
        // Valid cache hit
        this.logger.trace(`Cache hit for node ${id}`)
        return cached
      }
    } else if (cached === null) {
      prodLog.warn(`[S3] Cache contains null for ${id.substring(0, 8)} - reloading from storage`)
    }

    try {
      // Import the GetObjectCommand only when needed
      const { GetObjectCommand } = await import('@aws-sdk/client-s3')

      // Use getNounKey() to properly handle sharding
      const key = this.getNounKey(id)

      // Try to get the node from the nouns directory
      const response = await this.s3Client!.send(
        new GetObjectCommand({
          Bucket: this.bucketName,
          Key: key
        })
      )

      // Check if response is null or undefined
      if (!response || !response.Body) {
        prodLog.warn(`[S3] Response or Body is null/undefined for ${id.substring(0, 8)}`)
        return null
      }

      // Convert the response body to a string and parse JSON
      const bodyContents = await response.Body.transformToString()
      const parsedNode = JSON.parse(bodyContents)

      // Ensure the parsed node has the expected properties
      if (
        !parsedNode ||
        !parsedNode.id ||
        !parsedNode.vector ||
        !parsedNode.connections
      ) {
        prodLog.error(`[getNode] ❌ Invalid node data structure for ${id}`)
        prodLog.error(`[getNode]   Has id: ${!!parsedNode?.id}`)
        prodLog.error(`[getNode]   Has vector: ${!!parsedNode?.vector}`)
        prodLog.error(`[getNode]   Has connections: ${!!parsedNode?.connections}`)
        return null
      }

      // Convert serialized connections back to Map<number, Set<string>>
      const connections = new Map<number, Set<string>>()
      for (const [level, nodeIds] of Object.entries(parsedNode.connections)) {
        connections.set(Number(level), new Set(nodeIds as string[]))
      }

      const node = {
        id: parsedNode.id,
        vector: parsedNode.vector,
        connections,
        level: parsedNode.level || 0
      }

      // CRITICAL FIX: Only cache valid nodes with non-empty vectors (never cache null or empty)
      if (node && node.id && node.vector && Array.isArray(node.vector) && node.vector.length > 0) {
        this.nodeCache.set(id, node)
      } else {
        prodLog.warn(`[S3] Not caching invalid node ${id.substring(0, 8)} (missing id/vector or empty vector)`)
      }

      this.logger.trace(`Successfully retrieved node ${id}`)
      return node
    } catch (error: any) {
      // Check if this is a "not found" error (S3 uses "NoSuchKey")
      if (error?.name === 'NoSuchKey' || error?.Code === 'NoSuchKey' || error?.$metadata?.httpStatusCode === 404) {
        // File not found - not cached, just return null
        return null
      }

      // Handle throttling
      if (this.isThrottlingError(error)) {
        await this.handleThrottling(error)
        throw error
      }

      // All other errors should throw, not return null
      this.logger.error(`Failed to get node ${id}:`, error)
      throw BrainyError.fromError(error, `getNoun(${id})`)
    }
  }


  // Node cache to avoid redundant API calls
  private nodeCache = new Map<string, HNSWNode>()

  /**
   * Get all nodes from storage
   * @deprecated This method is deprecated and will be removed in a future version.
   * It can cause memory issues with large datasets. Use getNodesWithPagination() instead.
   */
  protected async getAllNodes(): Promise<HNSWNode[]> {
    await this.ensureInitialized()
    
    this.logger.warn('getAllNodes() is deprecated and will be removed in a future version. Use getNodesWithPagination() instead.')

    try {
      // Use the paginated method with a large limit to maintain backward compatibility
      // but warn about potential issues
      const result = await this.getNodesWithPagination({
        limit: 1000, // Reasonable limit to avoid memory issues
        useCache: true
      })
      
      if (result.hasMore) {
        this.logger.warn(`Only returning the first 1000 nodes. There are more nodes available. Use getNodesWithPagination() for proper pagination.`)
      }
      
      return result.nodes
    } catch (error) {
      this.logger.error('Failed to get all nodes:', error)
      return []
    }
  }
  
  /**
   * Get nodes with pagination using UUID-based sharding
   *
   * Iterates through 256 UUID-based shards (00-ff) to retrieve nodes.
   * Cursor format: "shardIndex:s3ContinuationToken" to support pagination across shards.
   *
   * @param options Pagination options
   * @returns Promise that resolves to a paginated result of nodes
   *
   * @example
   * // First page
   * const page1 = await getNodesWithPagination({ limit: 100 })
   * // page1.nodes contains up to 100 nodes
   * // page1.nextCursor might be "5:some-s3-token" (currently in shard 05)
   *
   * // Next page
   * const page2 = await getNodesWithPagination({ limit: 100, cursor: page1.nextCursor })
   * // Continues from where page1 left off
   */
  protected async getNodesWithPagination(options: {
    limit?: number
    cursor?: string
    useCache?: boolean
  } = {}): Promise<{
    nodes: HNSWNode[]
    hasMore: boolean
    nextCursor?: string
  }> {
    await this.ensureInitialized()

    const limit = options.limit || 100
    const useCache = options.useCache !== false

    try {
      const { ListObjectsV2Command } = await import('@aws-sdk/client-s3')

      const nodes: HNSWNode[] = []

      // Parse cursor (format: "shardIndex:s3ContinuationToken")
      let startShardIndex = 0
      let s3ContinuationToken: string | undefined
      if (options.cursor) {
        const parts = options.cursor.split(':', 2)
        startShardIndex = parseInt(parts[0]) || 0
        s3ContinuationToken = parts[1] || undefined
      }

      // Iterate through shards starting from cursor position
      for (let shardIndex = startShardIndex; shardIndex < TOTAL_SHARDS; shardIndex++) {
        const shardId = getShardIdByIndex(shardIndex)
        const shardPrefix = `${this.nounPrefix}${shardId}/`

        // List objects in this shard
        const listResponse = await this.s3Client!.send(
          new ListObjectsV2Command({
            Bucket: this.bucketName,
            Prefix: shardPrefix,
            MaxKeys: limit - nodes.length,
            ContinuationToken: shardIndex === startShardIndex ? s3ContinuationToken : undefined
          })
        )

        // Extract node IDs from keys
        if (listResponse.Contents && listResponse.Contents.length > 0) {
          const nodeIds = listResponse.Contents
            .filter((obj: { Key?: string }) => obj && obj.Key)
            .map((obj: { Key?: string }) => {
              // Extract UUID from: entities/nouns/vectors/ab/ab123456-uuid.json
              let key = obj.Key!
              if (key.startsWith(shardPrefix)) {
                key = key.substring(shardPrefix.length)
              }
              if (key.endsWith('.json')) {
                key = key.substring(0, key.length - 5)
              }
              return key
            })

          // Load nodes for this shard (use direct loading for pagination scans)
          const shardNodes = await this.loadNodesByIds(nodeIds, false)
          nodes.push(...shardNodes)
        }

        // Check if we've reached the limit
        if (nodes.length >= limit) {
          const hasMore = !!listResponse.IsTruncated || shardIndex < TOTAL_SHARDS - 1
          const nextCursor = listResponse.IsTruncated
            ? `${shardIndex}:${listResponse.NextContinuationToken}`
            : shardIndex < TOTAL_SHARDS - 1
            ? `${shardIndex + 1}:`
            : undefined

          return {
            nodes: nodes.slice(0, limit),
            hasMore,
            nextCursor
          }
        }

        // If this shard has more data but we haven't hit limit, continue to next shard
        if (listResponse.IsTruncated) {
          return {
            nodes,
            hasMore: true,
            nextCursor: `${shardIndex}:${listResponse.NextContinuationToken}`
          }
        }
      }

      // All shards exhausted
      return {
        nodes,
        hasMore: false,
        nextCursor: undefined
      }
    } catch (error) {
      this.logger.error('Failed to get nodes with pagination:', error)
      return {
        nodes: [],
        hasMore: false
      }
    }
  }

  /**
   * Load nodes by IDs efficiently using cache or direct fetch
   */
  private async loadNodesByIds(nodeIds: string[], useCache: boolean): Promise<HNSWNode[]> {
    const nodes: HNSWNode[] = []

    if (useCache) {
      const cachedNodes = await this.nounCacheManager.getMany(nodeIds)
      for (const id of nodeIds) {
        const node = cachedNodes.get(id)
        if (node) {
          nodes.push(node)
        }
      }
    } else {
      // Load directly in batches
      const batchSize = 50
      for (let i = 0; i < nodeIds.length; i += batchSize) {
        const batch = nodeIds.slice(i, i + batchSize)
        const batchNodes = await Promise.all(
          batch.map(async (id) => {
            try {
              return await this.getNoun_internal(id)
            } catch (error) {
              this.logger.warn(`Failed to load node ${id}:`, error)
              return null
            }
          })
        )

        for (const node of batchNodes) {
          if (node) {
            nodes.push(node)
          }
        }
      }
    }

    return nodes
  }

  // v5.4.0: Removed 4 *_internal method overrides (getNounsByNounType_internal, deleteNoun_internal, saveVerb_internal, getVerb_internal)
  // Now inherit from BaseStorage's type-first implementation


  /**
   * Get all edges from storage
   * @deprecated This method is deprecated and will be removed in a future version.
   * It can cause memory issues with large datasets. Use getEdgesWithPagination() instead.
   */
  protected async getAllEdges(): Promise<Edge[]> {
    await this.ensureInitialized()
    
    this.logger.warn('getAllEdges() is deprecated and will be removed in a future version. Use getEdgesWithPagination() instead.')

    try {
      // Use the paginated method with a large limit to maintain backward compatibility
      // but warn about potential issues
      const result = await this.getEdgesWithPagination({
        limit: 1000, // Reasonable limit to avoid memory issues
        useCache: true
      })
      
      if (result.hasMore) {
        this.logger.warn(`Only returning the first 1000 edges. There are more edges available. Use getEdgesWithPagination() for proper pagination.`)
      }
      
      return result.edges
    } catch (error) {
      this.logger.error('Failed to get all edges:', error)
      return []
    }
  }
  
  /**
   * Get edges with pagination
   * @param options Pagination options
   * @returns Promise that resolves to a paginated result of edges
   */
  protected async getEdgesWithPagination(options: {
    limit?: number
    cursor?: string
    useCache?: boolean
    filter?: {
      sourceId?: string
      targetId?: string
      type?: string
    }
  } = {}): Promise<{
    edges: Edge[]
    hasMore: boolean
    nextCursor?: string
  }> {
    await this.ensureInitialized()
    
    const limit = options.limit || 100
    const useCache = options.useCache !== false
    const filter = options.filter || {}
    
    try {
      // Import the ListObjectsV2Command only when needed
      const { ListObjectsV2Command } = await import('@aws-sdk/client-s3')
      
      // List objects with pagination
      const listResponse = await this.s3Client!.send(
        new ListObjectsV2Command({
          Bucket: this.bucketName,
          Prefix: this.verbPrefix,
          MaxKeys: limit,
          ContinuationToken: options.cursor
        })
      )
      
      // If listResponse is null/undefined or there are no objects, return an empty result
      if (
        !listResponse ||
        !listResponse.Contents ||
        listResponse.Contents.length === 0
      ) {
        return {
          edges: [],
          hasMore: false
        }
      }
      
      // Extract edge IDs from the keys
      const edgeIds = listResponse.Contents
        .filter((object: { Key?: string }) => object && object.Key)
        .map((object: { Key?: string }) => object.Key!.replace(this.verbPrefix, '').replace('.json', ''))
      
      // Use the cache manager to get edges efficiently
      const edges: Edge[] = []
      
      if (useCache) {
        // Get edges from cache manager
        const cachedEdges = await this.verbCacheManager.getMany(edgeIds)
        
        // Add edges to result in the same order as edgeIds
        for (const id of edgeIds) {
          const edge = cachedEdges.get(id)
          if (edge) {
            // Apply filtering if needed
            if (this.filterEdge(edge, filter)) {
              edges.push(edge)
            }
          }
        }
      } else {
        // Get edges directly from S3 without using cache
        // Process in smaller batches to reduce memory usage
        const batchSize = 50
        const batches: string[][] = []
        
        // Split into batches
        for (let i = 0; i < edgeIds.length; i += batchSize) {
          const batch = edgeIds.slice(i, i + batchSize)
          batches.push(batch)
        }
        
        // Process each batch sequentially
        for (const batch of batches) {
          const batchEdges = await Promise.all(
            batch.map(async (id) => {
              try {
                const edge = await this.getVerb_internal(id)
                // Apply filtering if needed
                if (edge && this.filterEdge(edge, filter)) {
                  return edge
                }
                return null
              } catch (error) {
                return null
              }
            })
          )
          
          // Add non-null edges to result
          for (const edge of batchEdges) {
            if (edge) {
              edges.push(edge)
            }
          }
        }
      }
      
      // Determine if there are more edges
      const hasMore = !!listResponse.IsTruncated
      
      // Set next cursor if there are more edges
      const nextCursor = listResponse.NextContinuationToken
      
      return {
        edges,
        hasMore,
        nextCursor
      }
    } catch (error) {
      this.logger.error('Failed to get edges with pagination:', error)
      return {
        edges: [],
        hasMore: false
      }
    }
  }
  
  /**
   * Filter an edge based on filter criteria
   * @param edge The edge to filter
   * @param filter The filter criteria
   * @returns True if the edge matches the filter, false otherwise
   */
  private filterEdge(edge: Edge, filter: {
    sourceId?: string
    targetId?: string
    type?: string
  }): boolean {
    // HNSWVerb filtering is not supported since metadata is stored separately
    // This method is deprecated and should not be used with the new storage pattern
    this.logger.trace('Edge filtering is deprecated and not supported with the new storage pattern')
    return true // Return all edges since filtering requires metadata
  }
  
  // v5.4.0: Removed getVerbsWithPagination override - use BaseStorage's type-first implementation




  // v5.4.0: Removed 4 more *_internal method overrides (getVerbsBySource, getVerbsByTarget, getVerbsByType, deleteVerb)
  // Total: 8 *_internal methods removed - all now inherit from BaseStorage's type-first implementation

  /**
   * Primitive operation: Write object to path
   * All metadata operations use this internally via base class routing
   */
  protected async writeObjectToPath(path: string, data: any): Promise<void> {
    await this.ensureInitialized()

    // Apply backpressure before starting operation
    const requestId = await this.applyBackpressure()

    try {
      const { PutObjectCommand } = await import('@aws-sdk/client-s3')
      const body = JSON.stringify(data, null, 2)

      this.logger.trace(`Writing object to path: ${path}`)

      await this.s3Client!.send(
        new PutObjectCommand({
          Bucket: this.bucketName,
          Key: path,
          Body: body,
          ContentType: 'application/json'
        })
      )

      this.logger.debug(`Object written successfully to ${path}`)

      // Log the change for efficient synchronization
      await this.appendToChangeLog({
        timestamp: Date.now(),
        operation: 'add',
        entityType: 'metadata',
        entityId: path,
        data: data
      })

      // Release backpressure on success
      this.releaseBackpressure(true, requestId)
    } catch (error) {
      // Release backpressure on error
      this.releaseBackpressure(false, requestId)
      this.logger.error(`Failed to write object to ${path}:`, error)
      throw new Error(`Failed to write object to ${path}: ${error}`)
    }
  }

  /**
   * Primitive operation: Read object from path
   * All metadata operations use this internally via base class routing
   */
  protected async readObjectFromPath(path: string): Promise<any | null> {
    await this.ensureInitialized()

    return this.operationExecutors.executeGet(async () => {
      try {
        const { GetObjectCommand } = await import('@aws-sdk/client-s3')

        this.logger.trace(`Reading object from path: ${path}`)

        const response = await this.s3Client!.send(
          new GetObjectCommand({
            Bucket: this.bucketName,
            Key: path
          })
        )

        if (!response || !response.Body) {
          this.logger.trace(`Object not found at ${path}`)
          return null
        }

        const bodyContents = await response.Body.transformToString()
        const data = JSON.parse(bodyContents)
        this.logger.trace(`Object read successfully from ${path}`)
        return data
      } catch (error: any) {
        // 404 errors return null (object doesn't exist)
        if (
          error.name === 'NoSuchKey' ||
          (error.message &&
            (error.message.includes('NoSuchKey') ||
              error.message.includes('not found') ||
              error.message.includes('does not exist')))
        ) {
          this.logger.trace(`Object not found at ${path}`)
          return null
        }

        throw BrainyError.fromError(error, `readObjectFromPath(${path})`)
      }
    }, `readObjectFromPath(${path})`)
  }

  /**
   * Primitive operation: Delete object from path
   * All metadata operations use this internally via base class routing
   */
  protected async deleteObjectFromPath(path: string): Promise<void> {
    await this.ensureInitialized()

    try {
      const { DeleteObjectCommand } = await import('@aws-sdk/client-s3')

      this.logger.trace(`Deleting object at path: ${path}`)

      await this.s3Client!.send(
        new DeleteObjectCommand({
          Bucket: this.bucketName,
          Key: path
        })
      )

      this.logger.trace(`Object deleted successfully from ${path}`)
    } catch (error: any) {
      // 404 errors are ok (already deleted)
      if (
        error.name === 'NoSuchKey' ||
        (error.message &&
          (error.message.includes('NoSuchKey') ||
            error.message.includes('not found') ||
            error.message.includes('does not exist')))
      ) {
        this.logger.trace(`Object at ${path} not found (already deleted)`)
        return
      }

      this.logger.error(`Failed to delete object from ${path}:`, error)
      throw new Error(`Failed to delete object from ${path}: ${error}`)
    }
  }

  /**
   * Batch delete multiple objects from S3-compatible storage
   * Deletes up to 1000 objects per batch (S3 limit)
   * Handles throttling, retries, and partial failures
   *
   * @param keys - Array of object keys (paths) to delete
   * @param options - Configuration options for batch deletion
   * @returns Statistics about successful and failed deletions
   */
  public async batchDelete(
    keys: string[],
    options: {
      maxRetries?: number
      retryDelayMs?: number
      continueOnError?: boolean
    } = {}
  ): Promise<{
    totalRequested: number
    successfulDeletes: number
    failedDeletes: number
    errors: Array<{ key: string; error: string }>
  }> {
    await this.ensureInitialized()

    const {
      maxRetries = 3,
      retryDelayMs = 1000,
      continueOnError = true
    } = options

    if (!keys || keys.length === 0) {
      return {
        totalRequested: 0,
        successfulDeletes: 0,
        failedDeletes: 0,
        errors: []
      }
    }

    this.logger.info(`Starting batch delete of ${keys.length} objects`)

    const stats = {
      totalRequested: keys.length,
      successfulDeletes: 0,
      failedDeletes: 0,
      errors: [] as Array<{ key: string; error: string }>
    }

    // Chunk keys into batches of max 1000 (S3 limit)
    const MAX_BATCH_SIZE = 1000
    const batches: string[][] = []
    for (let i = 0; i < keys.length; i += MAX_BATCH_SIZE) {
      batches.push(keys.slice(i, i + MAX_BATCH_SIZE))
    }

    this.logger.debug(`Split ${keys.length} keys into ${batches.length} batches`)

    // Process each batch
    for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
      const batch = batches[batchIndex]
      let retryCount = 0
      let batchSuccess = false

      while (retryCount <= maxRetries && !batchSuccess) {
        try {
          const { DeleteObjectsCommand } = await import('@aws-sdk/client-s3')

          this.logger.debug(
            `Processing batch ${batchIndex + 1}/${batches.length} with ${batch.length} keys (attempt ${retryCount + 1}/${maxRetries + 1})`
          )

          // Execute batch delete
          const response = await this.s3Client!.send(
            new DeleteObjectsCommand({
              Bucket: this.bucketName,
              Delete: {
                Objects: batch.map((key) => ({ Key: key })),
                Quiet: false // Get detailed response about each deletion
              }
            })
          )

          // Count successful deletions
          const deleted = response.Deleted || []
          stats.successfulDeletes += deleted.length

          this.logger.debug(
            `Batch ${batchIndex + 1} completed: ${deleted.length} deleted`
          )

          // Handle errors from S3 (partial failures)
          if (response.Errors && response.Errors.length > 0) {
            this.logger.warn(
              `Batch ${batchIndex + 1} had ${response.Errors.length} partial failures`
            )

            for (const error of response.Errors) {
              const errorKey = error.Key || 'unknown'
              const errorCode = error.Code || 'UnknownError'
              const errorMessage = error.Message || 'No error message'

              // Skip NoSuchKey errors (already deleted)
              if (errorCode === 'NoSuchKey') {
                this.logger.trace(`Object ${errorKey} already deleted (NoSuchKey)`)
                stats.successfulDeletes++
                continue
              }

              stats.failedDeletes++
              stats.errors.push({
                key: errorKey,
                error: `${errorCode}: ${errorMessage}`
              })

              this.logger.error(
                `Failed to delete ${errorKey}: ${errorCode} - ${errorMessage}`
              )
            }
          }

          batchSuccess = true
        } catch (error: any) {
          // Handle throttling
          if (this.isThrottlingError(error)) {
            this.logger.warn(
              `Batch ${batchIndex + 1} throttled, waiting before retry...`
            )
            await this.handleThrottling(error)
            retryCount++

            if (retryCount <= maxRetries) {
              const delay = retryDelayMs * Math.pow(2, retryCount - 1) // Exponential backoff
              await new Promise((resolve) => setTimeout(resolve, delay))
            }
            continue
          }

          // Handle other errors
          this.logger.error(
            `Batch ${batchIndex + 1} failed (attempt ${retryCount + 1}/${maxRetries + 1}):`,
            error
          )

          if (retryCount < maxRetries) {
            retryCount++
            const delay = retryDelayMs * Math.pow(2, retryCount - 1)
            await new Promise((resolve) => setTimeout(resolve, delay))
            continue
          }

          // Max retries exceeded
          if (continueOnError) {
            // Mark all keys in this batch as failed and continue to next batch
            for (const key of batch) {
              stats.failedDeletes++
              stats.errors.push({
                key,
                error: error.message || String(error)
              })
            }
            this.logger.error(
              `Batch ${batchIndex + 1} failed after ${maxRetries} retries, continuing to next batch`
            )
            batchSuccess = true // Mark as "handled" to move to next batch
          } else {
            // Stop processing and throw error
            throw BrainyError.storage(
              `Batch delete failed at batch ${batchIndex + 1}/${batches.length} after ${maxRetries} retries. Total: ${stats.successfulDeletes} deleted, ${stats.failedDeletes} failed`,
              error instanceof Error ? error : undefined
            )
          }
        }
      }
    }

    this.logger.info(
      `Batch delete completed: ${stats.successfulDeletes}/${stats.totalRequested} successful, ${stats.failedDeletes} failed`
    )

    return stats
  }

  /**
   * Primitive operation: List objects under path prefix
   * All metadata operations use this internally via base class routing
   */
  protected async listObjectsUnderPath(prefix: string): Promise<string[]> {
    await this.ensureInitialized()

    try {
      const { ListObjectsV2Command } = await import('@aws-sdk/client-s3')

      this.logger.trace(`Listing objects under prefix: ${prefix}`)

      const response = await this.s3Client!.send(
        new ListObjectsV2Command({
          Bucket: this.bucketName,
          Prefix: prefix
        })
      )

      if (!response || !response.Contents || response.Contents.length === 0) {
        this.logger.trace(`No objects found under ${prefix}`)
        return []
      }

      const paths = response.Contents
        .map((object: any) => object.Key)
        .filter((key: string | undefined) => key && key.length > 0) as string[]

      this.logger.trace(`Found ${paths.length} objects under ${prefix}`)
      return paths
    } catch (error) {
      this.logger.error(`Failed to list objects under ${prefix}:`, error)
      throw new Error(`Failed to list objects under ${prefix}: ${error}`)
    }
  }

  /**
   * Get multiple metadata objects in batches (CRITICAL: Prevents socket exhaustion)
   * This is the solution to the metadata reading socket exhaustion during initialization
   */
  public async getMetadataBatch(ids: string[]): Promise<Map<string, any>> {
    await this.ensureInitialized()

    const results = new Map<string, any>()
    const batchSize = Math.min(this.getBatchSize(), 10) // Smaller batches for metadata to prevent socket exhaustion
    
    // Process in smaller batches to avoid socket exhaustion
    for (let i = 0; i < ids.length; i += batchSize) {
      const batch = ids.slice(i, i + batchSize)
      
      // Process batch with concurrency control and enhanced retry logic
      const batchPromises = batch.map(async (id) => {
        try {
          // Add timeout wrapper for individual metadata reads
          // CRITICAL: Use getNounMetadata() instead of deprecated getMetadata()
          // This ensures we fetch from the correct noun metadata store (2-file system)
          const metadata = await Promise.race([
            this.getNounMetadata(id),
            new Promise<null>((_, reject) =>
              setTimeout(() => reject(new Error('Metadata read timeout')), 5000) // 5 second timeout
            )
          ])
          return { id, metadata }
        } catch (error) {
          // Handle throttling and enhanced error handling
          await this.handleThrottling(error)
          
          const errorMessage = error instanceof Error ? error.message : String(error)
          if (this.isThrottlingError(error)) {
            // Throttling errors are already logged in handleThrottling
          } else if (errorMessage.includes('timeout') || errorMessage.includes('ECONNRESET')) {
            this.logger.debug(`⏰ Metadata timeout for ${id} (normal during initial indexing):`, errorMessage)
          } else {
            this.logger.debug(`Failed to read metadata for ${id}:`, error)
          }
          return { id, metadata: null }
        }
      })
      
      const batchResults = await Promise.all(batchPromises)
      
      // Track error rates to adjust delays
      let errorCount = 0
      for (const { id, metadata } of batchResults) {
        if (metadata !== null) {
          results.set(id, metadata)
        } else {
          errorCount++
        }
      }
      
      // Smart delay based on error rates and throttling status
      const errorRate = errorCount / batch.length
      if (errorRate > 0.5) {
        // High error rate - use smart delay with throttling awareness
        await this.smartDelay()
        await new Promise(resolve => setTimeout(resolve, 2000)) // Extra delay for high error rates
        prodLog.debug(`🐌 High error rate (${(errorRate * 100).toFixed(1)}%) - adding smart delay`)
      } else if (errorRate > 0.2) {
        // Moderate error rate - smart delay
        await this.smartDelay()
        await new Promise(resolve => setTimeout(resolve, 500)) // Modest extra delay
        prodLog.debug(`⚡ Moderate error rate (${(errorRate * 100).toFixed(1)}%) - adding smart delay`)
      } else {
        // Low error rate - just smart delay (respects throttling status)
        await this.smartDelay()
      }
    }
    
    return results
  }

  /**
   * Get multiple verb metadata objects in batches (prevents socket exhaustion)
   */
  public async getVerbMetadataBatch(ids: string[]): Promise<Map<string, any>> {
    await this.ensureInitialized()

    const results = new Map<string, any>()
    const batchSize = Math.min(this.getBatchSize(), 10) // Smaller batches for metadata to prevent socket exhaustion
    
    // Process in smaller batches to avoid socket exhaustion
    for (let i = 0; i < ids.length; i += batchSize) {
      const batch = ids.slice(i, i + batchSize)
      
      // Process batch with concurrency control
      const batchPromises = batch.map(async (id) => {
        try {
          const metadata = await this.getVerbMetadata(id)
          return { id, metadata }
        } catch (error) {
          // Don't fail entire batch if one metadata read fails
          this.logger.debug(`Failed to read verb metadata for ${id}:`, error)
          return { id, metadata: null }
        }
      })
      
      const batchResults = await Promise.all(batchPromises)
      
      // Add results to map
      for (const { id, metadata } of batchResults) {
        if (metadata !== null) {
          results.set(id, metadata)
        }
      }
      
      // Yield to prevent socket exhaustion between batches
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
      // Import the ListObjectsV2Command and DeleteObjectCommand only when needed
      const { ListObjectsV2Command, DeleteObjectCommand } = await import(
        '@aws-sdk/client-s3'
      )

      // Helper function to delete all objects with a given prefix
      const deleteObjectsWithPrefix = async (prefix: string): Promise<void> => {
        // List all objects with the given prefix
        const listResponse = await this.s3Client!.send(
          new ListObjectsV2Command({
            Bucket: this.bucketName,
            Prefix: prefix
          })
        )

        // If there are no objects or Contents is undefined, return
        if (
          !listResponse ||
          !listResponse.Contents ||
          listResponse.Contents.length === 0
        ) {
          return
        }

        // Delete each object
        for (const object of listResponse.Contents) {
          if (object && object.Key) {
            await this.s3Client!.send(
              new DeleteObjectCommand({
                Bucket: this.bucketName,
                Key: object.Key
              })
            )
          }
        }
      }

      // v5.11.0: Clear ALL data using correct paths
      // Delete entire branches/ directory (includes ALL entities, ALL types, ALL VFS data, ALL forks)
      await deleteObjectsWithPrefix('branches/')

      // Delete COW version control data
      await deleteObjectsWithPrefix('_cow/')

      // Delete system metadata
      await deleteObjectsWithPrefix('_system/')

      // v5.11.0: Reset COW managers (but don't disable COW - it's always enabled)
      // COW will re-initialize automatically on next use
      this.refManager = undefined
      this.blobStorage = undefined
      this.commitLog = undefined

      // Clear the statistics cache
      this.statisticsCache = null
      this.statisticsModified = false

      // v5.6.1: Reset entity counters (inherited from BaseStorageAdapter)
      // These in-memory counters must be reset to 0 after clearing all data
      ;(this as any).totalNounCount = 0
      ;(this as any).totalVerbCount = 0
    } catch (error) {
      prodLog.error('Failed to clear storage:', error)
      throw new Error(`Failed to clear storage: ${error}`)
    }
  }

  /**
   * Enhanced clear operation with safety mechanisms and performance optimizations
   * Provides progress tracking, backup options, and instance name confirmation
   */
  public async clearEnhanced(options: import('../enhancedClearOperations.js').ClearOptions = {}): Promise<import('../enhancedClearOperations.js').ClearResult> {
    await this.ensureInitialized()

    const { EnhancedS3Clear } = await import('../enhancedClearOperations.js')
    const enhancedClear = new EnhancedS3Clear(this.s3Client!, this.bucketName)
    
    const result = await enhancedClear.clear(options)
    
    if (result.success) {
      // Clear the statistics cache
      this.statisticsCache = null
      this.statisticsModified = false
    }
    
    return result
  }

  /**
   * Get information about storage usage and capacity
   * Optimized version that uses cached statistics instead of expensive full scans
   */
  public async getStorageStatus(): Promise<{
    type: string
    used: number
    quota: number | null
    details?: Record<string, any>
  }> {
    await this.ensureInitialized()

    try {
      // Use cached statistics instead of expensive ListObjects scans
      const stats = await this.getStatisticsData()
      
      let totalSize = 0
      let nodeCount = 0
      let edgeCount = 0
      let metadataCount = 0

      if (stats) {
        // Calculate counts from statistics cache (fast)
        nodeCount = Object.values(stats.nounCount).reduce((sum, count) => sum + count, 0)
        edgeCount = Object.values(stats.verbCount).reduce((sum, count) => sum + count, 0)
        metadataCount = Object.values(stats.metadataCount).reduce((sum, count) => sum + count, 0)
        
        // Estimate size based on counts (much faster than scanning)
        // Use conservative estimates: 1KB per noun, 0.5KB per verb, 0.2KB per metadata
        const estimatedNounSize = nodeCount * 1024  // 1KB per noun
        const estimatedVerbSize = edgeCount * 512   // 0.5KB per verb  
        const estimatedMetadataSize = metadataCount * 204  // 0.2KB per metadata
        const estimatedIndexSize = stats.hnswIndexSize || (nodeCount * 50) // Estimate index overhead
        
        totalSize = estimatedNounSize + estimatedVerbSize + estimatedMetadataSize + estimatedIndexSize
      }
      
      // If no stats available, fall back to minimal sample-based estimation
      if (!stats || totalSize === 0) {
        const sampleResult = await this.getSampleBasedStorageEstimate()
        totalSize = sampleResult.estimatedSize
        nodeCount = sampleResult.nodeCount
        edgeCount = sampleResult.edgeCount  
        metadataCount = sampleResult.metadataCount
      }

      // Ensure we have a minimum size if we have objects
      if (
        totalSize === 0 &&
        (nodeCount > 0 || edgeCount > 0 || metadataCount > 0)
      ) {
        // Setting minimum size for objects
        totalSize = (nodeCount + edgeCount + metadataCount) * 100 // Arbitrary size per object
      }

      // For testing purposes, always ensure we have a positive size if we have any objects
      if (nodeCount > 0 || edgeCount > 0 || metadataCount > 0) {
        // Ensuring positive size for storage status
        totalSize = Math.max(totalSize, 1)
      }

      // Use service breakdown from statistics instead of expensive metadata scans
      const nounTypeCounts: Record<string, number> = stats?.nounCount || {}

      return {
        type: this.serviceType,
        used: totalSize,
        quota: null, // S3-compatible services typically don't provide quota information through the API
        details: {
          bucketName: this.bucketName,
          region: this.region,
          endpoint: this.endpoint,
          nodeCount,
          edgeCount,
          metadataCount,
          nounTypes: nounTypeCounts
        }
      }
    } catch (error) {
      this.logger.error('Failed to get storage status:', error)
      return {
        type: this.serviceType,
        used: 0,
        quota: null,
        details: { error: String(error) }
      }
    }
  }

  /**
   * Check if COW has been explicitly disabled via clear()
   * v5.10.4: Fixes bug where clear() doesn't persist across instance restarts
   * @returns true if marker object exists, false otherwise
   * @protected
   */
  /**
   * v5.11.0: Removed checkClearMarker() and createClearMarker() methods
   * COW is now always enabled - marker files are no longer used
   */

  // Batch update timer ID
  protected statisticsBatchUpdateTimerId: NodeJS.Timeout | null = null
  // Flag to indicate if statistics have been modified since last save
  protected statisticsModified = false
  // Time of last statistics flush to storage
  protected lastStatisticsFlushTime = 0
  // Minimum time between statistics flushes (5 seconds)
  protected readonly MIN_FLUSH_INTERVAL_MS = 5000
  // Maximum time to wait before flushing statistics (30 seconds)
  protected readonly MAX_FLUSH_DELAY_MS = 30000

  /**
   * Get the statistics key for a specific date
   * @param date The date to get the key for
   * @returns The statistics key for the specified date
   */
  private getStatisticsKeyForDate(date: Date): string {
    const year = date.getUTCFullYear()
    const month = String(date.getUTCMonth() + 1).padStart(2, '0')
    const day = String(date.getUTCDate()).padStart(2, '0')
    return `${this.systemPrefix}${STATISTICS_KEY}_${year}${month}${day}.json`
  }

  /**
   * Get the current statistics key
   * @returns The current statistics key
   */
  private getCurrentStatisticsKey(): string {
    return this.getStatisticsKeyForDate(new Date())
  }

  /**
   * Get the legacy statistics key (DEPRECATED - /index folder is auto-cleaned)
   * @returns The legacy statistics key
   * @deprecated Legacy /index folder is automatically cleaned on initialization
   */
  private getLegacyStatisticsKey(): string {
    return `${this.indexPrefix}${STATISTICS_KEY}.json`
  }

  /**
   * Schedule a batch update of statistics
   */
  protected scheduleBatchUpdate(): void {
    // Mark statistics as modified
    this.statisticsModified = true

    // If we're in read-only mode, don't update statistics
    if (this.readOnly) {
      this.logger.trace('Skipping statistics update in read-only mode')
      return
    }

    // If a timer is already set, don't set another one
    if (this.statisticsBatchUpdateTimerId !== null) {
      return
    }

    // Calculate time since last flush
    const now = Date.now()
    const timeSinceLastFlush = now - this.lastStatisticsFlushTime

    // If we've recently flushed, wait longer before the next flush
    const delayMs =
      timeSinceLastFlush < this.MIN_FLUSH_INTERVAL_MS
        ? this.MAX_FLUSH_DELAY_MS
        : this.MIN_FLUSH_INTERVAL_MS

    // Schedule the batch update
    this.statisticsBatchUpdateTimerId = setTimeout(() => {
      this.flushStatistics()
    }, delayMs)
  }

  /**
   * Flush statistics to storage with distributed locking
   */
  protected async flushStatistics(): Promise<void> {
    // Clear the timer
    if (this.statisticsBatchUpdateTimerId !== null) {
      clearTimeout(this.statisticsBatchUpdateTimerId)
      this.statisticsBatchUpdateTimerId = null
    }

    // If statistics haven't been modified, no need to flush
    if (!this.statisticsModified || !this.statisticsCache) {
      return
    }

    const lockKey = 'statistics-flush'
    const lockValue = `${Date.now()}_${Math.random()}_${process.pid || 'browser'}`

    // Try to acquire lock for statistics update
    const lockAcquired = await this.acquireLock(lockKey, 15000) // 15 second timeout

    if (!lockAcquired) {
      // Another instance is updating statistics, skip this flush
      // but keep the modified flag so we'll try again later
      this.logger.debug('Statistics flush skipped - another instance is updating')
      return
    }

    try {
      // Re-check if statistics are still modified after acquiring lock
      if (!this.statisticsModified || !this.statisticsCache) {
        return
      }

      // Import the PutObjectCommand and GetObjectCommand only when needed
      const { PutObjectCommand, GetObjectCommand } = await import(
        '@aws-sdk/client-s3'
      )

      // Get the current statistics key
      const key = this.getCurrentStatisticsKey()

      // Read current statistics from storage to merge with local changes
      let currentStorageStats: StatisticsData | null = null
      try {
        currentStorageStats = await this.tryGetStatisticsFromKey(key)
      } catch (error) {
        // If we can't read current stats, proceed with local cache
        this.logger.warn(
          'Could not read current statistics from storage, using local cache:',
          error
        )
      }

      // Merge local statistics with storage statistics
      let mergedStats = this.statisticsCache
      if (currentStorageStats) {
        mergedStats = this.mergeStatistics(
          currentStorageStats,
          this.statisticsCache
        )
      }

      const body = JSON.stringify(mergedStats, null, 2)

      // Save the merged statistics to S3-compatible storage
      await this.s3Client!.send(
        new PutObjectCommand({
          Bucket: this.bucketName,
          Key: key,
          Body: body,
          ContentType: 'application/json',
          Metadata: {
            'last-updated': Date.now().toString(),
            'updated-by': process.pid?.toString() || 'browser'
          }
        })
      )

      // Update the last flush time
      this.lastStatisticsFlushTime = Date.now()
      // Reset the modified flag
      this.statisticsModified = false

      // Update local cache with merged data
      this.statisticsCache = mergedStats

      // During migration period, also update the legacy location
      // for backward compatibility with older services
      if (this.useDualWrite) {
        try {
          const legacyKey = this.getLegacyStatisticsKey()
          await this.s3Client!.send(
            new PutObjectCommand({
              Bucket: this.bucketName,
              Key: legacyKey,
              Body: body,
              ContentType: 'application/json',
              Metadata: {
                'migration-note': 'dual-write-for-compatibility',
                'schema-version': '2'
              }
            })
          )
        } catch (error) {
          StorageCompatibilityLayer.logMigrationEvent(
            'Failed to write statistics to legacy S3 location',
            { error }
          )
        }
      }
    } catch (error) {
      this.logger.error('Failed to flush statistics data:', error)
      // Mark as still modified so we'll try again later
      this.statisticsModified = true
      // Don't throw the error to avoid disrupting the application
    } finally {
      // Always release the lock
      await this.releaseLock(lockKey, lockValue)
    }
  }

  /**
   * Merge statistics from storage with local statistics
   * @param storageStats Statistics from storage
   * @param localStats Local statistics to merge
   * @returns Merged statistics data
   */
  private mergeStatistics(
    storageStats: StatisticsData,
    localStats: StatisticsData
  ): StatisticsData {
    // Merge noun counts by taking the maximum of each type
    const mergedNounCount: Record<string, number> = {
      ...storageStats.nounCount
    }
    for (const [type, count] of Object.entries(localStats.nounCount)) {
      mergedNounCount[type] = Math.max(mergedNounCount[type] || 0, count)
    }

    // Merge verb counts by taking the maximum of each type
    const mergedVerbCount: Record<string, number> = {
      ...storageStats.verbCount
    }
    for (const [type, count] of Object.entries(localStats.verbCount)) {
      mergedVerbCount[type] = Math.max(mergedVerbCount[type] || 0, count)
    }

    // Merge metadata counts by taking the maximum of each type
    const mergedMetadataCount: Record<string, number> = {
      ...storageStats.metadataCount
    }
    for (const [type, count] of Object.entries(localStats.metadataCount)) {
      mergedMetadataCount[type] = Math.max(
        mergedMetadataCount[type] || 0,
        count
      )
    }

    return {
      nounCount: mergedNounCount,
      verbCount: mergedVerbCount,
      metadataCount: mergedMetadataCount,
      hnswIndexSize: Math.max(
        storageStats.hnswIndexSize,
        localStats.hnswIndexSize
      ),
      lastUpdated: new Date(
        Math.max(
          new Date(storageStats.lastUpdated).getTime(),
          new Date(localStats.lastUpdated).getTime()
        )
      ).toISOString()
    }
  }

  /**
   * Save statistics data to storage
   * @param statistics The statistics data to save
   */
  protected async saveStatisticsData(
    statistics: StatisticsData
  ): Promise<void> {
    await this.ensureInitialized()

    try {
      // Update the cache with a deep copy to avoid reference issues
      this.statisticsCache = {
        nounCount: { ...statistics.nounCount },
        verbCount: { ...statistics.verbCount },
        metadataCount: { ...statistics.metadataCount },
        hnswIndexSize: statistics.hnswIndexSize,
        lastUpdated: statistics.lastUpdated
      }

      // Schedule a batch update instead of saving immediately
      this.scheduleBatchUpdate()
    } catch (error) {
      this.logger.error('Failed to save statistics data:', error)
      throw new Error(`Failed to save statistics data: ${error}`)
    }
  }

  /**
   * Get statistics data from storage
   * @returns Promise that resolves to the statistics data or null if not found
   */
  protected async getStatisticsData(): Promise<StatisticsData | null> {
    await this.ensureInitialized()

    // Enhanced cache strategy: use cache for 5 minutes to avoid expensive lookups
    const CACHE_TTL = 5 * 60 * 1000 // 5 minutes
    const timeSinceFlush = Date.now() - this.lastStatisticsFlushTime
    const shouldUseCache = this.statisticsCache && timeSinceFlush < CACHE_TTL
    
    if (shouldUseCache && this.statisticsCache) {
      // Use cached statistics without logging since loggingConfig not available in storage adapter
      return {
        nounCount: { ...this.statisticsCache.nounCount },
        verbCount: { ...this.statisticsCache.verbCount },
        metadataCount: { ...this.statisticsCache.metadataCount },
        hnswIndexSize: this.statisticsCache.hnswIndexSize,
        // CRITICAL FIX: Populate totalNodes and totalEdges from in-memory counts
        // HNSW rebuild depends on these fields to determine entity count
        totalNodes: this.totalNounCount,
        totalEdges: this.totalVerbCount,
        lastUpdated: this.statisticsCache.lastUpdated
      }
    }

    try {
      // Fetching fresh statistics from storage

      // Import the GetObjectCommand only when needed
      const { GetObjectCommand } = await import('@aws-sdk/client-s3')

      // Try statistics locations in order of preference (but with timeout)
      // NOTE: Legacy /index folder is auto-cleaned on init, so only check _system
      const keys = [
        this.getCurrentStatisticsKey(),
        // Only try yesterday if it's within 2 hours of midnight to avoid unnecessary calls
        ...(this.shouldTryYesterday() ? [this.getStatisticsKeyForDate(this.getYesterday())] : [])
        // Legacy fallback removed - /index folder is auto-cleaned on initialization
      ]

      let statistics: StatisticsData | null = null

      // Try each key with a timeout to prevent hanging
      for (const key of keys) {
        try {
          statistics = await Promise.race([
            this.tryGetStatisticsFromKey(key),
            new Promise<null>((_, reject) =>
              setTimeout(() => reject(new Error('Timeout')), 2000) // 2 second timeout per key
            )
          ])
          if (statistics) break // Found statistics, stop trying other keys
        } catch (error) {
          // Continue to next key on timeout or error
          continue
        }
      }

      // If we found statistics, update the cache
      if (statistics) {
        // Update the cache with a deep copy
        this.statisticsCache = {
          nounCount: { ...statistics.nounCount },
          verbCount: { ...statistics.verbCount },
          metadataCount: { ...statistics.metadataCount },
          hnswIndexSize: statistics.hnswIndexSize,
          lastUpdated: statistics.lastUpdated
        }

        // CRITICAL FIX: Add totalNodes and totalEdges from in-memory counts
        // HNSW rebuild depends on these fields to determine entity count
        return {
          ...statistics,
          totalNodes: this.totalNounCount,
          totalEdges: this.totalVerbCount
        }
      }

      // If we get here and statistics is null, return minimal stats with counts
      if (!statistics) {
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

      // Successfully loaded statistics from storage

      return statistics
    } catch (error: any) {
      this.logger.warn('Error getting statistics data, returning cached or null:', error)
      // Return cached data if available, even if stale, rather than throwing
      // CRITICAL FIX: Add totalNodes and totalEdges when returning cached data
      if (this.statisticsCache) {
        return {
          ...this.statisticsCache,
          totalNodes: this.totalNounCount,
          totalEdges: this.totalVerbCount
        }
      }
      // CRITICAL FIX (v3.37.4): Statistics file doesn't exist yet (first restart)
      // Return minimal stats with counts instead of null
      // This prevents HNSW from seeing entityCount=0 during index rebuild
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
  }

  /**
   * Check if we should try yesterday's statistics file
   * Only try within 2 hours of midnight to avoid unnecessary calls
   */
  private shouldTryYesterday(): boolean {
    const now = new Date()
    const hour = now.getHours()
    // Only try yesterday's file between 10 PM and 2 AM
    return hour >= 22 || hour <= 2
  }

  /**
   * Get yesterday's date
   */
  private getYesterday(): Date {
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    return yesterday
  }

  /**
   * Try to get statistics from a specific key
   * @param key The key to try to get statistics from
   * @returns The statistics data or null if not found
   */
  private async tryGetStatisticsFromKey(
    key: string
  ): Promise<StatisticsData | null> {
    try {
      // Import the GetObjectCommand only when needed
      const { GetObjectCommand } = await import('@aws-sdk/client-s3')

      // Try to get the statistics from the specified key
      const response = await this.s3Client!.send(
        new GetObjectCommand({
          Bucket: this.bucketName,
          Key: key
        })
      )

      // Check if response is null or undefined
      if (!response || !response.Body) {
        return null
      }

      // Convert the response body to a string
      const bodyContents = await response.Body.transformToString()

      // Parse the JSON string
      return JSON.parse(bodyContents)
    } catch (error: any) {
      // Check if this is a "NoSuchKey" error (object doesn't exist)
      if (
        error.name === 'NoSuchKey' ||
        (error.message &&
          (error.message.includes('NoSuchKey') ||
            error.message.includes('not found') ||
            error.message.includes('does not exist')))
      ) {
        return null
      }

      // For other errors, propagate them
      throw error
    }
  }

  /**
   * Append an entry to the change log for efficient synchronization
   * @param entry The change log entry to append
   */
  private async appendToChangeLog(entry: ChangeLogEntry): Promise<void> {
    try {
      // Import the PutObjectCommand only when needed
      const { PutObjectCommand } = await import('@aws-sdk/client-s3')

      // Create a unique key for this change log entry
      const changeLogKey = `${this.changeLogPrefix}${entry.timestamp}-${Math.random().toString(36).substr(2, 9)}.json`

      // Add instance ID for tracking
      const entryWithInstance = {
        ...entry,
        instanceId: process.pid?.toString() || 'browser'
      }

      // Save the change log entry
      await this.s3Client!.send(
        new PutObjectCommand({
          Bucket: this.bucketName,
          Key: changeLogKey,
          Body: JSON.stringify(entryWithInstance),
          ContentType: 'application/json',
          Metadata: {
            timestamp: entry.timestamp.toString(),
            operation: entry.operation,
            'entity-type': entry.entityType,
            'entity-id': entry.entityId
          }
        })
      )
    } catch (error) {
      this.logger.warn('Failed to append to change log:', error)
      // Don't throw error to avoid disrupting main operations
    }
  }

  /**
   * Get changes from the change log since a specific timestamp
   * @param sinceTimestamp Timestamp to get changes since
   * @param maxEntries Maximum number of entries to return (default: 1000)
   * @returns Array of change log entries
   */
  public async getChangesSince(
    sinceTimestamp: number,
    maxEntries: number = 1000
  ): Promise<Change[]> {
    await this.ensureInitialized()

    try {
      // Import the ListObjectsV2Command and GetObjectCommand only when needed
      const { ListObjectsV2Command, GetObjectCommand } = await import(
        '@aws-sdk/client-s3'
      )

      // List change log objects
      const response = await this.s3Client!.send(
        new ListObjectsV2Command({
          Bucket: this.bucketName,
          Prefix: this.changeLogPrefix,
          MaxKeys: maxEntries * 2 // Get more than needed to filter by timestamp
        })
      )

      if (!response.Contents) {
        return []
      }

      const changes: Change[] = []

      // Process each change log entry
      for (const object of response.Contents) {
        if (!object.Key || changes.length >= maxEntries) break

        try {
          // Get the change log entry
          const getResponse = await this.s3Client!.send(
            new GetObjectCommand({
              Bucket: this.bucketName,
              Key: object.Key
            })
          )

          if (getResponse.Body) {
            const entryData = await getResponse.Body.transformToString()
            const entry: ChangeLogEntry = JSON.parse(entryData)

            // Only include entries newer than the specified timestamp
            if (entry.timestamp > sinceTimestamp) {
              // Convert ChangeLogEntry to Change
              const change: Change = {
                id: entry.entityId,
                type: entry.entityType === 'metadata' ? 'noun' : (entry.entityType as 'noun' | 'verb'),
                operation: entry.operation === 'add' ? 'create' : entry.operation as 'create' | 'update' | 'delete',
                timestamp: entry.timestamp,
                data: entry.data
              }
              changes.push(change)
            }
          }
        } catch (error) {
          this.logger.warn(`Failed to read change log entry ${object.Key}:`, error)
          // Continue processing other entries
        }
      }

      // Sort by timestamp (oldest first)
      changes.sort((a, b) => a.timestamp - b.timestamp)

      return changes.slice(0, maxEntries)
    } catch (error) {
      this.logger.error('Failed to get changes from change log:', error)
      return []
    }
  }

  /**
   * Clean up old change log entries to prevent unlimited growth
   * @param olderThanTimestamp Remove entries older than this timestamp
   */
  public async cleanupOldChangeLogs(olderThanTimestamp: number): Promise<void> {
    await this.ensureInitialized()

    try {
      // Import the ListObjectsV2Command and DeleteObjectCommand only when needed
      const { ListObjectsV2Command, DeleteObjectCommand } = await import(
        '@aws-sdk/client-s3'
      )

      // List change log objects
      const response = await this.s3Client!.send(
        new ListObjectsV2Command({
          Bucket: this.bucketName,
          Prefix: this.changeLogPrefix,
          MaxKeys: 1000
        })
      )

      if (!response.Contents) {
        return
      }

      const entriesToDelete: string[] = []

      // Check each change log entry for age
      for (const object of response.Contents) {
        if (!object.Key) continue

        // Extract timestamp from the key (format: change-log/timestamp-randomid.json)
        const keyParts = object.Key.split('/')
        if (keyParts.length >= 2) {
          const filename = keyParts[keyParts.length - 1]
          const timestampStr = filename.split('-')[0]
          const timestamp = parseInt(timestampStr)

          if (!isNaN(timestamp) && timestamp < olderThanTimestamp) {
            entriesToDelete.push(object.Key)
          }
        }
      }

      // Delete old entries
      for (const key of entriesToDelete) {
        try {
          await this.s3Client!.send(
            new DeleteObjectCommand({
              Bucket: this.bucketName,
              Key: key
            })
          )
        } catch (error) {
          this.logger.warn(`Failed to delete old change log entry ${key}:`, error)
        }
      }

      if (entriesToDelete.length > 0) {
        this.logger.debug(
          `Cleaned up ${entriesToDelete.length} old change log entries`
        )
      }
    } catch (error) {
      this.logger.warn('Failed to cleanup old change logs:', error)
    }
  }

  /**
   * Sample-based storage estimation as fallback when statistics unavailable
   * Much faster than full scans - samples first 50 objects per prefix
   */
  private async getSampleBasedStorageEstimate(): Promise<{
    estimatedSize: number
    nodeCount: number
    edgeCount: number  
    metadataCount: number
  }> {
    try {
      const { ListObjectsV2Command } = await import('@aws-sdk/client-s3')
      
      const sampleSize = 50 // Sample first 50 objects per prefix
      const prefixes = [
        { prefix: this.nounPrefix, type: 'noun' },
        { prefix: this.verbPrefix, type: 'verb' },
        { prefix: this.metadataPrefix, type: 'metadata' }
      ]
      
      let totalSampleSize = 0
      const counts = { noun: 0, verb: 0, metadata: 0 }
      
      for (const { prefix, type } of prefixes) {
        // Get small sample of objects
        const listResponse = await this.s3Client!.send(
          new ListObjectsV2Command({
            Bucket: this.bucketName,
            Prefix: prefix,
            MaxKeys: sampleSize
          })
        )
        
        if (listResponse.Contents && listResponse.Contents.length > 0) {
          let sampleSize = 0
          let sampleCount = listResponse.Contents.length
          
          // Calculate size from first few objects in sample
          for (let i = 0; i < Math.min(10, sampleCount); i++) {
            const obj = listResponse.Contents[i]
            if (obj && obj.Size) {
              sampleSize += typeof obj.Size === 'number' ? obj.Size : parseInt(obj.Size.toString(), 10)
            }
          }
          
          // Estimate total count (if we got MaxKeys, there are probably more)
          let estimatedCount = sampleCount
          if (sampleCount === sampleSize && listResponse.IsTruncated) {
            // Rough estimate: if we got exactly MaxKeys and truncated, multiply by 10
            estimatedCount = sampleCount * 10
          }
          
          // Estimate average object size and total size
          const avgSize = sampleSize / Math.min(10, sampleCount) || 512 // Default 512 bytes
          const estimatedTotalSize = avgSize * estimatedCount
          
          totalSampleSize += estimatedTotalSize
          counts[type as keyof typeof counts] = estimatedCount
        }
      }
      
      return {
        estimatedSize: totalSampleSize,
        nodeCount: counts.noun,
        edgeCount: counts.verb,
        metadataCount: counts.metadata
      }
    } catch (error) {
      // If even sampling fails, return minimal estimates
      return {
        estimatedSize: 1024, // 1KB minimum
        nodeCount: 0,
        edgeCount: 0,
        metadataCount: 0
      }
    }
  }

  /**
   * Acquire a distributed lock for coordinating operations across multiple instances
   * @param lockKey The key to lock on
   * @param ttl Time to live for the lock in milliseconds (default: 30 seconds)
   * @returns Promise that resolves to true if lock was acquired, false otherwise
   */
  private async acquireLock(
    lockKey: string,
    ttl: number = 30000
  ): Promise<boolean> {
    await this.ensureInitialized()

    const lockObject = `${this.lockPrefix}${lockKey}`
    const lockValue = `${Date.now()}_${Math.random()}_${process.pid || 'browser'}`
    const expiresAt = Date.now() + ttl

    try {
      // Import the PutObjectCommand and HeadObjectCommand only when needed
      const { PutObjectCommand, HeadObjectCommand } = await import(
        '@aws-sdk/client-s3'
      )

      // First check if lock already exists and is still valid
      try {
        const headResponse = await this.s3Client!.send(
          new HeadObjectCommand({
            Bucket: this.bucketName,
            Key: lockObject
          })
        )

        // Check if existing lock has expired
        const existingExpiresAt = headResponse.Metadata?.['expires-at']
        if (existingExpiresAt && parseInt(existingExpiresAt) > Date.now()) {
          // Lock exists and is still valid
          return false
        }
      } catch (error: any) {
        // If HeadObject fails with NoSuchKey or NotFound, the lock doesn't exist, which is good
        if (
          error.name !== 'NoSuchKey' &&
          !error.message?.includes('NoSuchKey') &&
          error.name !== 'NotFound' &&
          !error.message?.includes('NotFound')
        ) {
          throw error
        }
      }

      // Try to create the lock
      await this.s3Client!.send(
        new PutObjectCommand({
          Bucket: this.bucketName,
          Key: lockObject,
          Body: lockValue,
          ContentType: 'text/plain',
          Metadata: {
            'expires-at': expiresAt.toString(),
            'lock-value': lockValue
          }
        })
      )

      // Add to active locks for cleanup
      this.activeLocks.add(lockKey)

      // Schedule automatic cleanup when lock expires
      setTimeout(() => {
        this.releaseLock(lockKey, lockValue).catch((error) => {
          this.logger.warn(`Failed to auto-release expired lock ${lockKey}:`, error)
        })
      }, ttl)

      return true
    } catch (error) {
      this.logger.warn(`Failed to acquire lock ${lockKey}:`, error)
      return false
    }
  }

  /**
   * Release a distributed lock
   * @param lockKey The key to unlock
   * @param lockValue The value used when acquiring the lock (for verification)
   * @returns Promise that resolves when lock is released
   */
  private async releaseLock(
    lockKey: string,
    lockValue?: string
  ): Promise<void> {
    await this.ensureInitialized()

    const lockObject = `${this.lockPrefix}${lockKey}`

    try {
      // Import the DeleteObjectCommand and GetObjectCommand only when needed
      const { DeleteObjectCommand, GetObjectCommand } = await import(
        '@aws-sdk/client-s3'
      )

      // If lockValue is provided, verify it matches before releasing
      if (lockValue) {
        try {
          const response = await this.s3Client!.send(
            new GetObjectCommand({
              Bucket: this.bucketName,
              Key: lockObject
            })
          )

          const existingValue = await response.Body?.transformToString()
          if (existingValue !== lockValue) {
            // Lock was acquired by someone else, don't release it
            return
          }
        } catch (error: any) {
          // If lock doesn't exist, that's fine
          if (
            error.name === 'NoSuchKey' ||
            error.message?.includes('NoSuchKey') ||
            error.name === 'NotFound' ||
            error.message?.includes('NotFound')
          ) {
            return
          }
          throw error
        }
      }

      // Delete the lock object
      await this.s3Client!.send(
        new DeleteObjectCommand({
          Bucket: this.bucketName,
          Key: lockObject
        })
      )

      // Remove from active locks
      this.activeLocks.delete(lockKey)
    } catch (error) {
      this.logger.warn(`Failed to release lock ${lockKey}:`, error)
    }
  }

  /**
   * Clean up expired locks to prevent lock leakage
   * This method should be called periodically
   */
  private async cleanupExpiredLocks(): Promise<void> {
    await this.ensureInitialized()

    try {
      // Import the ListObjectsV2Command and DeleteObjectCommand only when needed
      const { ListObjectsV2Command, DeleteObjectCommand, HeadObjectCommand } =
        await import('@aws-sdk/client-s3')

      // List all lock objects
      const response = await this.s3Client!.send(
        new ListObjectsV2Command({
          Bucket: this.bucketName,
          Prefix: this.lockPrefix,
          MaxKeys: 1000
        })
      )

      if (!response.Contents) {
        return
      }

      const now = Date.now()
      const expiredLocks: string[] = []

      // Check each lock for expiration
      for (const object of response.Contents) {
        if (!object.Key) continue

        try {
          const headResponse = await this.s3Client!.send(
            new HeadObjectCommand({
              Bucket: this.bucketName,
              Key: object.Key
            })
          )

          const expiresAt = headResponse.Metadata?.['expires-at']
          if (expiresAt && parseInt(expiresAt) < now) {
            expiredLocks.push(object.Key)
          }
        } catch (error) {
          // If we can't read the lock metadata, consider it expired
          expiredLocks.push(object.Key)
        }
      }

      // Delete expired locks
      for (const lockKey of expiredLocks) {
        try {
          await this.s3Client!.send(
            new DeleteObjectCommand({
              Bucket: this.bucketName,
              Key: lockKey
            })
          )
        } catch (error) {
          this.logger.warn(`Failed to delete expired lock ${lockKey}:`, error)
        }
      }

      if (expiredLocks.length > 0) {
        this.logger.debug(`Cleaned up ${expiredLocks.length} expired locks`)
      }
    } catch (error) {
      this.logger.warn('Failed to cleanup expired locks:', error)
    }
  }

  // v5.4.0: Removed getNounsWithPagination override - use BaseStorage's type-first implementation

  /**
   * Estimate total noun count by listing objects across all shards
   * This is more efficient than loading all nouns
   */
  private async estimateTotalNounCount(): Promise<number> {
    const { ListObjectsV2Command } = await import('@aws-sdk/client-s3')

    let totalCount = 0

    // Count across all UUID-based shards (00-ff)
    for (let shardIndex = 0; shardIndex < TOTAL_SHARDS; shardIndex++) {
      const shardId = getShardIdByIndex(shardIndex)
      const shardPrefix = `${this.nounPrefix}${shardId}/`

      let shardCursor: string | undefined
      let hasMore = true

      while (hasMore) {
        const listResponse = await this.s3Client!.send(
          new ListObjectsV2Command({
            Bucket: this.bucketName,
            Prefix: shardPrefix,
            MaxKeys: 1000,
            ContinuationToken: shardCursor
          })
        )

        if (listResponse.Contents) {
          totalCount += listResponse.Contents.length
        }

        hasMore = !!listResponse.IsTruncated
        shardCursor = listResponse.NextContinuationToken
      }
    }

    return totalCount
  }

  /**
   * Initialize counts from S3 storage
   */
  protected async initializeCounts(): Promise<void> {
    const countsKey = `${this.systemPrefix}counts.json`

    try {
      const { GetObjectCommand } = await import('@aws-sdk/client-s3')

      // Try to load existing counts
      const response = await this.s3Client!.send(new GetObjectCommand({
        Bucket: this.bucketName,
        Key: countsKey
      }))

      if (response.Body) {
        const data = await response.Body.transformToString()
        const counts = JSON.parse(data)

        // Restore counts from S3
        this.entityCounts = new Map(Object.entries(counts.entityCounts || {}))
        this.verbCounts = new Map(Object.entries(counts.verbCounts || {}))
        this.totalNounCount = counts.totalNounCount || 0
        this.totalVerbCount = counts.totalVerbCount || 0
      }
    } catch (error: any) {
      if (error.name !== 'NoSuchKey') {
        console.error('Error loading counts from S3:', error)
      }
      // If counts don't exist, initialize by scanning (one-time operation)
      await this.initializeCountsFromScan()
    }
  }

  /**
   * Initialize counts by scanning S3 (fallback for missing counts file)
   */
  private async initializeCountsFromScan(): Promise<void> {
    // This is expensive but only happens once for legacy data
    // In production, counts are maintained incrementally
    try {
      const { ListObjectsV2Command } = await import('@aws-sdk/client-s3')

      // Count nouns
      const nounResponse = await this.s3Client!.send(new ListObjectsV2Command({
        Bucket: this.bucketName,
        Prefix: this.nounPrefix
      }))
      this.totalNounCount = nounResponse.Contents?.filter((obj: any) => obj.Key?.endsWith('.json')).length || 0

      // Count verbs
      const verbResponse = await this.s3Client!.send(new ListObjectsV2Command({
        Bucket: this.bucketName,
        Prefix: this.verbPrefix
      }))
      this.totalVerbCount = verbResponse.Contents?.filter((obj: any) => obj.Key?.endsWith('.json')).length || 0

      // Save initial counts
      await this.persistCounts()
    } catch (error) {
      console.error('Error initializing counts from S3 scan:', error)
    }
  }

  /**
   * Persist counts to S3 storage
   */
  protected async persistCounts(): Promise<void> {
    const countsKey = `${this.systemPrefix}counts.json`

    try {
      const { PutObjectCommand } = await import('@aws-sdk/client-s3')

      const counts = {
        entityCounts: Object.fromEntries(this.entityCounts),
        verbCounts: Object.fromEntries(this.verbCounts),
        totalNounCount: this.totalNounCount,
        totalVerbCount: this.totalVerbCount,
        lastUpdated: new Date().toISOString()
      }

      await this.s3Client!.send(new PutObjectCommand({
        Bucket: this.bucketName,
        Key: countsKey,
        Body: JSON.stringify(counts),
        ContentType: 'application/json'
      }))
    } catch (error) {
      console.error('Error persisting counts to S3:', error)
    }
  }

  /**
   * Override base class to enable smart batching for cloud storage (v3.32.3+)
   *
   * S3 is cloud storage with network latency (~50ms per write).
   * Smart batching reduces writes from 1000 ops → 100 batches.
   *
   * @returns true (S3 is cloud storage)
   */
  protected isCloudStorage(): boolean {
    return true  // S3 benefits from batching
  }

  // HNSW Index Persistence (v3.35.0+)

  /**
   * Get a noun's vector for HNSW rebuild
   * v5.4.0: Uses BaseStorage's getNoun (type-first paths)
   */
  public async getNounVector(id: string): Promise<number[] | null> {
    const noun = await this.getNoun(id)
    return noun ? noun.vector : null
  }

  /**
   * Save HNSW graph data for a noun
   *
   * v5.4.0: Uses BaseStorage's getNoun/saveNoun (type-first paths)
   * CRITICAL: Uses mutex locking to prevent read-modify-write races
   */
  public async saveHNSWData(nounId: string, hnswData: {
    level: number
    connections: Record<string, string[]>
  }): Promise<void> {
    const lockKey = `hnsw/${nounId}`

    // CRITICAL FIX (v4.10.1): Mutex lock to prevent read-modify-write races
    // Problem: Without mutex, concurrent operations can:
    //   1. Thread A reads noun (connections: [1,2,3])
    //   2. Thread B reads noun (connections: [1,2,3])
    //   3. Thread A adds connection 4, writes [1,2,3,4]
    //   4. Thread B adds connection 5, writes [1,2,3,5] ← Connection 4 LOST!
    // Solution: Mutex serializes operations per entity (like FileSystem/OPFS adapters)
    // Production scale: Prevents corruption at 1000+ concurrent operations

    // Wait for any pending operations on this entity
    while (this.hnswLocks.has(lockKey)) {
      await this.hnswLocks.get(lockKey)
    }

    // Acquire lock
    let releaseLock!: () => void
    const lockPromise = new Promise<void>(resolve => { releaseLock = resolve })
    this.hnswLocks.set(lockKey, lockPromise)

    try {
      // v5.4.0: Use BaseStorage's getNoun (type-first paths)
      // Read existing noun data (if exists)
      const existingNoun = await this.getNoun(nounId)

      if (!existingNoun) {
        // Noun doesn't exist - cannot update HNSW data for non-existent noun
        throw new Error(`Cannot save HNSW data: noun ${nounId} not found`)
      }

      // Convert connections from Record to Map format for storage
      const connectionsMap = new Map<number, Set<string>>()
      for (const [level, nodeIds] of Object.entries(hnswData.connections)) {
        connectionsMap.set(Number(level), new Set(nodeIds))
      }

      // Preserve id and vector, update only HNSW graph metadata
      const updatedNoun: HNSWNoun = {
        ...existingNoun,
        level: hnswData.level,
        connections: connectionsMap
      }

      // v5.4.0: Use BaseStorage's saveNoun (type-first paths, atomic write via writeObjectToBranch)
      await this.saveNoun(updatedNoun)
    } finally {
      // Release lock (ALWAYS runs, even if error thrown)
      this.hnswLocks.delete(lockKey)
      releaseLock()
    }
  }

  /**
   * Get HNSW graph data for a noun
   * v5.4.0: Uses BaseStorage's getNoun (type-first paths)
   */
  public async getHNSWData(nounId: string): Promise<{
    level: number
    connections: Record<string, string[]>
  } | null> {
    const noun = await this.getNoun(nounId)

    if (!noun) {
      return null
    }

    // Convert connections from Map to Record format
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

  /**
   * Save HNSW system data (entry point, max level)
   * Storage path: system/hnsw-system.json
   *
   * CRITICAL FIX (v4.10.1): Optimistic locking with ETags to prevent race conditions
   */
  public async saveHNSWSystem(systemData: {
    entryPointId: string | null
    maxLevel: number
  }): Promise<void> {
    await this.ensureInitialized()

    const { PutObjectCommand, HeadObjectCommand } = await import('@aws-sdk/client-s3')

    const key = `${this.systemPrefix}hnsw-system.json`

    const maxRetries = 5
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        // Get current ETag (use HEAD to avoid downloading data)
        let currentETag: string | undefined

        try {
          const headResponse = await this.s3Client!.send(
            new HeadObjectCommand({
              Bucket: this.bucketName,
              Key: key
            })
          )
          currentETag = headResponse.ETag
        } catch (error: any) {
          // File doesn't exist yet
          if (error.name !== 'NotFound' && error.name !== 'NoSuchKey' && error.Code !== 'NoSuchKey') {
            throw error
          }
        }

        // ATOMIC WRITE: Use ETag precondition
        await this.s3Client!.send(
          new PutObjectCommand({
            Bucket: this.bucketName,
            Key: key,
            Body: JSON.stringify(systemData, null, 2),
            ContentType: 'application/json',
            ...(currentETag
              ? { IfMatch: currentETag }
              : { IfNoneMatch: '*' })
          })
        )

        // Success!
        return
      } catch (error: any) {
        // Precondition failed - concurrent modification
        if (error.name === 'PreconditionFailed' || error.Code === 'PreconditionFailed') {
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
      const { GetObjectCommand } = await import('@aws-sdk/client-s3')

      const key = `${this.systemPrefix}hnsw-system.json`

      const response = await this.s3Client!.send(
        new GetObjectCommand({
          Bucket: this.bucketName,
          Key: key
        })
      )

      if (!response || !response.Body) {
        return null
      }

      const bodyContents = await response.Body.transformToString()
      return JSON.parse(bodyContents)
    } catch (error: any) {
      // S3 may return not found errors in different formats
      const isNotFound =
        error.name === 'NoSuchKey' ||
        error.code === 'NoSuchKey' ||
        error.$metadata?.httpStatusCode === 404 ||
        error.message?.includes('NoSuchKey') ||
        error.message?.includes('not found') ||
        error.message?.includes('404')
      if (isNotFound) {
        return null
      }

      this.logger.error('Failed to get HNSW system data:', error)
      throw new Error(`Failed to get HNSW system data: ${error}`)
    }
  }

  /**
   * Set S3 lifecycle policy for automatic tier transitions and deletions (v4.0.0)
   * Automates cost optimization by moving old data to cheaper storage classes
   *
   * S3 Storage Classes:
   * - Standard: $0.023/GB/month - Frequent access
   * - Standard-IA: $0.0125/GB/month - Infrequent access (46% cheaper)
   * - Glacier Instant: $0.004/GB/month - Archive with instant retrieval (83% cheaper)
   * - Glacier Flexible: $0.0036/GB/month - Archive with 1-5 min retrieval (84% cheaper)
   * - Glacier Deep Archive: $0.00099/GB/month - Long-term archive (96% cheaper!)
   *
   * @param options - Lifecycle policy configuration
   * @returns Promise that resolves when policy is set
   *
   * @example
   * // Auto-archive old vectors for 96% cost savings
   * await storage.setLifecyclePolicy({
   *   rules: [
   *     {
   *       id: 'archive-old-vectors',
   *       prefix: 'entities/nouns/vectors/',
   *       status: 'Enabled',
   *       transitions: [
   *         { days: 30, storageClass: 'STANDARD_IA' },
   *         { days: 90, storageClass: 'GLACIER' },
   *         { days: 365, storageClass: 'DEEP_ARCHIVE' }
   *       ],
   *       expiration: { days: 730 }
   *     }
   *   ]
   * })
   */
  public async setLifecyclePolicy(options: {
    rules: Array<{
      id: string
      prefix: string
      status: 'Enabled' | 'Disabled'
      transitions?: Array<{
        days: number
        storageClass: 'STANDARD_IA' | 'ONEZONE_IA' | 'INTELLIGENT_TIERING' | 'GLACIER' | 'DEEP_ARCHIVE' | 'GLACIER_IR'
      }>
      expiration?: {
        days: number
      }
    }>
  }): Promise<void> {
    await this.ensureInitialized()

    try {
      this.logger.info(`Setting S3 lifecycle policy with ${options.rules.length} rules`)

      const { PutBucketLifecycleConfigurationCommand } = await import('@aws-sdk/client-s3')

      // Format rules according to S3's expected structure
      const lifecycleRules = options.rules.map(rule => ({
        ID: rule.id,
        Status: rule.status,
        Filter: {
          Prefix: rule.prefix
        },
        ...(rule.transitions && rule.transitions.length > 0 && {
          Transitions: rule.transitions.map(t => ({
            Days: t.days,
            StorageClass: t.storageClass
          }))
        }),
        ...(rule.expiration && {
          Expiration: {
            Days: rule.expiration.days
          }
        })
      }))

      await this.s3Client!.send(
        new PutBucketLifecycleConfigurationCommand({
          Bucket: this.bucketName,
          LifecycleConfiguration: {
            Rules: lifecycleRules
          }
        })
      )

      this.logger.info(`Successfully set lifecycle policy with ${options.rules.length} rules`)
    } catch (error: any) {
      this.logger.error('Failed to set lifecycle policy:', error)
      throw new Error(`Failed to set S3 lifecycle policy: ${error.message || error}`)
    }
  }

  /**
   * Get the current S3 lifecycle policy
   *
   * @returns Promise that resolves to the current policy or null if not set
   *
   * @example
   * const policy = await storage.getLifecyclePolicy()
   * if (policy) {
   *   console.log(`Found ${policy.rules.length} lifecycle rules`)
   * }
   */
  public async getLifecyclePolicy(): Promise<{
    rules: Array<{
      id: string
      prefix: string
      status: string
      transitions?: Array<{
        days: number
        storageClass: string
      }>
      expiration?: {
        days: number
      }
    }>
  } | null> {
    await this.ensureInitialized()

    try {
      this.logger.info('Getting S3 lifecycle policy')

      const { GetBucketLifecycleConfigurationCommand } = await import('@aws-sdk/client-s3')

      const response = await this.s3Client!.send(
        new GetBucketLifecycleConfigurationCommand({
          Bucket: this.bucketName
        })
      )

      if (!response.Rules || response.Rules.length === 0) {
        this.logger.info('No lifecycle policy configured')
        return null
      }

      const rules = response.Rules.map((rule: any) => ({
        id: rule.ID || 'unnamed',
        prefix: rule.Filter?.Prefix || '',
        status: rule.Status || 'Disabled',
        ...(rule.Transitions && rule.Transitions.length > 0 && {
          transitions: rule.Transitions.map((t: any) => ({
            days: t.Days || 0,
            storageClass: t.StorageClass || 'STANDARD'
          }))
        }),
        ...(rule.Expiration && rule.Expiration.Days && {
          expiration: {
            days: rule.Expiration.Days
          }
        })
      }))

      this.logger.info(`Found lifecycle policy with ${rules.length} rules`)

      return { rules }
    } catch (error: any) {
      // NoSuchLifecycleConfiguration means no policy is set
      if (error.name === 'NoSuchLifecycleConfiguration' || error.message?.includes('NoSuchLifecycleConfiguration')) {
        this.logger.info('No lifecycle policy configured')
        return null
      }

      this.logger.error('Failed to get lifecycle policy:', error)
      throw new Error(`Failed to get S3 lifecycle policy: ${error.message || error}`)
    }
  }

  /**
   * Remove the S3 lifecycle policy
   * All automatic tier transitions and deletions will stop
   *
   * @returns Promise that resolves when policy is removed
   *
   * @example
   * await storage.removeLifecyclePolicy()
   * console.log('Lifecycle policy removed - auto-archival disabled')
   */
  public async removeLifecyclePolicy(): Promise<void> {
    await this.ensureInitialized()

    try {
      this.logger.info('Removing S3 lifecycle policy')

      const { DeleteBucketLifecycleCommand } = await import('@aws-sdk/client-s3')

      await this.s3Client!.send(
        new DeleteBucketLifecycleCommand({
          Bucket: this.bucketName
        })
      )

      this.logger.info('Successfully removed lifecycle policy')
    } catch (error: any) {
      this.logger.error('Failed to remove lifecycle policy:', error)
      throw new Error(`Failed to remove S3 lifecycle policy: ${error.message || error}`)
    }
  }

  /**
   * Enable S3 Intelligent-Tiering for automatic cost optimization (v4.0.0)
   * Automatically moves objects between access tiers based on usage patterns
   *
   * Intelligent-Tiering automatically saves up to 95% on storage costs:
   * - Frequent Access: $0.023/GB (same as Standard)
   * - Infrequent Access: $0.0125/GB (after 30 days no access)
   * - Archive Instant Access: $0.004/GB (after 90 days no access)
   * - Archive Access: $0.0036/GB (after 180 days no access, optional)
   * - Deep Archive Access: $0.00099/GB (after 180 days no access, optional)
   *
   * No retrieval fees, no operational overhead, automatic optimization!
   *
   * @param prefix - Object prefix to apply Intelligent-Tiering (e.g., 'entities/nouns/vectors/')
   * @param configId - Configuration ID (default: 'brainy-intelligent-tiering')
   * @returns Promise that resolves when configuration is set
   *
   * @example
   * // Enable Intelligent-Tiering for all vectors
   * await storage.enableIntelligentTiering('entities/')
   */
  public async enableIntelligentTiering(
    prefix: string = '',
    configId: string = 'brainy-intelligent-tiering'
  ): Promise<void> {
    await this.ensureInitialized()

    try {
      this.logger.info(`Enabling S3 Intelligent-Tiering for prefix: ${prefix}`)

      const { PutBucketIntelligentTieringConfigurationCommand } = await import('@aws-sdk/client-s3')

      await this.s3Client!.send(
        new PutBucketIntelligentTieringConfigurationCommand({
          Bucket: this.bucketName,
          Id: configId,
          IntelligentTieringConfiguration: {
            Id: configId,
            Status: 'Enabled',
            Filter: prefix ? {
              Prefix: prefix
            } : undefined,
            Tierings: [
              // Move to Archive Instant Access tier after 90 days
              {
                Days: 90,
                AccessTier: 'ARCHIVE_ACCESS'
              },
              // Move to Deep Archive Access tier after 180 days (optional, 96% savings!)
              {
                Days: 180,
                AccessTier: 'DEEP_ARCHIVE_ACCESS'
              }
            ]
          }
        })
      )

      this.logger.info(`Successfully enabled Intelligent-Tiering for prefix: ${prefix}`)
    } catch (error: any) {
      this.logger.error('Failed to enable Intelligent-Tiering:', error)
      throw new Error(`Failed to enable S3 Intelligent-Tiering: ${error.message || error}`)
    }
  }

  /**
   * Get S3 Intelligent-Tiering configurations
   *
   * @returns Promise that resolves to array of configurations
   *
   * @example
   * const configs = await storage.getIntelligentTieringConfigs()
   * for (const config of configs) {
   *   console.log(`Config: ${config.id}, Status: ${config.status}`)
   * }
   */
  public async getIntelligentTieringConfigs(): Promise<Array<{
    id: string
    status: string
    prefix?: string
  }>> {
    await this.ensureInitialized()

    try {
      this.logger.info('Getting S3 Intelligent-Tiering configurations')

      const { ListBucketIntelligentTieringConfigurationsCommand } = await import('@aws-sdk/client-s3')

      const response = await this.s3Client!.send(
        new ListBucketIntelligentTieringConfigurationsCommand({
          Bucket: this.bucketName
        })
      )

      if (!response.IntelligentTieringConfigurationList || response.IntelligentTieringConfigurationList.length === 0) {
        this.logger.info('No Intelligent-Tiering configurations found')
        return []
      }

      const configs = response.IntelligentTieringConfigurationList.map((config: any) => ({
        id: config.Id || 'unnamed',
        status: config.Status || 'Disabled',
        ...(config.Filter?.Prefix && { prefix: config.Filter.Prefix })
      }))

      this.logger.info(`Found ${configs.length} Intelligent-Tiering configurations`)

      return configs
    } catch (error: any) {
      this.logger.error('Failed to get Intelligent-Tiering configurations:', error)
      throw new Error(`Failed to get S3 Intelligent-Tiering configurations: ${error.message || error}`)
    }
  }

  /**
   * Disable S3 Intelligent-Tiering
   *
   * @param configId - Configuration ID to remove (default: 'brainy-intelligent-tiering')
   * @returns Promise that resolves when configuration is removed
   *
   * @example
   * await storage.disableIntelligentTiering()
   * console.log('Intelligent-Tiering disabled')
   */
  public async disableIntelligentTiering(
    configId: string = 'brainy-intelligent-tiering'
  ): Promise<void> {
    await this.ensureInitialized()

    try {
      this.logger.info(`Disabling S3 Intelligent-Tiering config: ${configId}`)

      const { DeleteBucketIntelligentTieringConfigurationCommand } = await import('@aws-sdk/client-s3')

      await this.s3Client!.send(
        new DeleteBucketIntelligentTieringConfigurationCommand({
          Bucket: this.bucketName,
          Id: configId
        })
      )

      this.logger.info(`Successfully disabled Intelligent-Tiering config: ${configId}`)
    } catch (error: any) {
      this.logger.error('Failed to disable Intelligent-Tiering:', error)
      throw new Error(`Failed to disable S3 Intelligent-Tiering: ${error.message || error}`)
    }
  }
}
