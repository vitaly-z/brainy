/**
 * S3-Compatible Storage Adapter
 * Uses the AWS S3 client to interact with S3-compatible storage services
 * including Amazon S3, Cloudflare R2, and Google Cloud Storage
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

// Export R2Storage as an alias for S3CompatibleStorage
export { S3CompatibleStorage as R2Storage }

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
  
  // High-volume mode detection - MUCH more aggressive
  private highVolumeMode = false
  private lastVolumeCheck = 0
  private volumeCheckInterval = 1000  // Check every second, not 5
  private forceHighVolumeMode = false  // Environment variable override

  // Operation executors for timeout and retry handling
  private operationExecutors: StorageOperationExecutors
  
  // Multi-level cache manager for efficient data access
  private nounCacheManager: CacheManager<HNSWNode>
  private verbCacheManager: CacheManager<Edge>
  
  // Module logger
  private logger = createModuleLogger('S3Storage')

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

      this.isInitialized = true
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
  
  /**
   * Check if we should enable high-volume mode
   */
  private checkVolumeMode(): void {
    const now = Date.now()
    if (now - this.lastVolumeCheck < this.volumeCheckInterval) {
      return
    }
    
    this.lastVolumeCheck = now
    
    // Check environment variable override
    const envThreshold = process.env.BRAINY_BUFFER_THRESHOLD
    const threshold = envThreshold ? parseInt(envThreshold) : 0  // Default to 0 for immediate activation!
    
    // Force enable from environment
    if (process.env.BRAINY_FORCE_BUFFERING === 'true') {
      this.forceHighVolumeMode = true
    }
    
    // Get metrics
    const backpressureStatus = this.backpressure.getStatus()
    const socketMetrics = this.socketManager.getMetrics()
    
    // Reasonable high-volume detection - only activate under real load
    const isTestEnvironment = process.env.NODE_ENV === 'test'
    const explicitlyDisabled = process.env.BRAINY_FORCE_BUFFERING === 'false'
    
    // Use reasonable thresholds instead of emergency aggressive ones
    const reasonableThreshold = Math.max(threshold, 10) // At least 10 pending operations
    const highSocketUtilization = 0.8  // 80% socket utilization 
    const highRequestRate = 50         // 50 requests per second
    const significantErrors = 5        // 5 consecutive errors
    
    const shouldEnableHighVolume = 
      !isTestEnvironment &&                               // Disable in test environment
      !explicitlyDisabled &&                              // Allow explicit disabling
      (this.forceHighVolumeMode ||                         // Environment override
      backpressureStatus.queueLength >= reasonableThreshold ||      // High queue backlog
      socketMetrics.pendingRequests >= reasonableThreshold ||       // Many pending requests
      this.pendingOperations >= reasonableThreshold ||              // Many pending ops
      socketMetrics.socketUtilization >= highSocketUtilization ||   // High socket pressure
      (socketMetrics.requestsPerSecond >= highRequestRate) ||       // High request rate
      (this.consecutiveErrors >= significantErrors))                // Significant error pattern
    
    if (shouldEnableHighVolume && !this.highVolumeMode) {
      this.highVolumeMode = true
      this.logger.warn(`🚨 HIGH-VOLUME MODE ACTIVATED 🚨`)
      this.logger.warn(`  Queue Length: ${backpressureStatus.queueLength}`)
      this.logger.warn(`  Pending Requests: ${socketMetrics.pendingRequests}`)
      this.logger.warn(`  Pending Operations: ${this.pendingOperations}`)
      this.logger.warn(`  Socket Utilization: ${(socketMetrics.socketUtilization * 100).toFixed(1)}%`)
      this.logger.warn(`  Requests/sec: ${socketMetrics.requestsPerSecond}`)
      this.logger.warn(`  Consecutive Errors: ${this.consecutiveErrors}`)
      this.logger.warn(`  Threshold: ${threshold}`)
      
      // Adjust buffer parameters for high volume
      const queueLength = Math.max(backpressureStatus.queueLength, socketMetrics.pendingRequests, 100)
      
      if (this.nounWriteBuffer) {
        this.nounWriteBuffer.adjustForLoad(queueLength)
        const stats = this.nounWriteBuffer.getStats()
        this.logger.warn(`  Noun Buffer: ${stats.bufferSize} items, ${stats.totalWrites} total writes`)
      }
      if (this.verbWriteBuffer) {
        this.verbWriteBuffer.adjustForLoad(queueLength)
        const stats = this.verbWriteBuffer.getStats()
        this.logger.warn(`  Verb Buffer: ${stats.bufferSize} items, ${stats.totalWrites} total writes`)
      }
      if (this.requestCoalescer) {
        this.requestCoalescer.adjustParameters(queueLength)
        const sizes = this.requestCoalescer.getQueueSizes()
        this.logger.warn(`  Coalescer: ${sizes.total} queued operations`)
      }
      
    } else if (!shouldEnableHighVolume && this.highVolumeMode && !this.forceHighVolumeMode) {
      this.highVolumeMode = false
      this.logger.info('✅ High-volume mode deactivated - load normalized')
    }
    
    // Log current status every 10 checks when in high-volume mode
    if (this.highVolumeMode && (now % 10000) < this.volumeCheckInterval) {
      this.logger.info(`📊 High-volume mode status: Queue=${backpressureStatus.queueLength}, Pending=${socketMetrics.pendingRequests}, Sockets=${(socketMetrics.socketUtilization * 100).toFixed(1)}%`)
    }
  }
  
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

      // Log the change for efficient synchronization
      await this.appendToChangeLog({
        timestamp: Date.now(),
        operation: 'add', // Could be 'update' if we track existing nodes
        entityType: 'noun',
        entityId: node.id,
        data: {
          vector: node.vector,
          metadata: node.metadata
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
        const currentCount = this.entityCounts.get(metadata.type) || 0
        this.entityCounts.set(metadata.type, currentCount + 1)
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

  /**
   * Get a noun from storage (internal implementation)
   * Combines vector data from getNode() with metadata from getNounMetadata()
   */
  protected async getNoun_internal(id: string): Promise<HNSWNoun | null> {
    // Get vector data (lightweight)
    const node = await this.getNode(id)
    if (!node) {
      return null
    }

    // Get metadata (entity data in 2-file system)
    const metadata = await this.getNounMetadata(id)

    // Combine into complete noun object
    return {
      ...node,
      metadata: metadata || {}
    }
  }

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

  /**
   * Get nouns by noun type (internal implementation)
   * @param nounType The noun type to filter by
   * @returns Promise that resolves to an array of nouns of the specified noun type
   */
  protected async getNounsByNounType_internal(
    nounType: string
  ): Promise<HNSWNoun[]> {
    return this.getNodesByNounType(nounType)
  }

  /**
   * Get nodes by noun type
   * @param nounType The noun type to filter by
   * @returns Promise that resolves to an array of nodes of the specified noun type
   */
  protected async getNodesByNounType(nounType: string): Promise<HNSWNode[]> {
    await this.ensureInitialized()

    try {
      const filteredNodes: HNSWNode[] = []
      let hasMore = true
      let cursor: string | undefined = undefined
      
      // Use pagination to process nodes in batches
      while (hasMore) {
        // Get a batch of nodes
        const result = await this.getNodesWithPagination({
          limit: 100,
          cursor,
          useCache: true
        })
        
        // Filter nodes by noun type using metadata
        for (const node of result.nodes) {
          const metadata = await this.getMetadata(node.id)
          if (metadata && metadata.noun === nounType) {
            filteredNodes.push(node)
          }
        }
        
        // Update pagination state
        hasMore = result.hasMore
        cursor = result.nextCursor
        
        // Safety check to prevent infinite loops
        if (!cursor && hasMore) {
          this.logger.warn('No cursor returned but hasMore is true, breaking loop')
          break
        }
      }

      return filteredNodes
    } catch (error) {
      this.logger.error(`Failed to get nodes by noun type ${nounType}:`, error)
      return []
    }
  }

  /**
   * Delete a noun from storage (internal implementation)
   */
  protected async deleteNoun_internal(id: string): Promise<void> {
    return this.deleteNode(id)
  }

  /**
   * Delete a node from storage
   */
  protected async deleteNode(id: string): Promise<void> {
    await this.ensureInitialized()

    try {
      // Import the DeleteObjectCommand only when needed
      const { DeleteObjectCommand } = await import('@aws-sdk/client-s3')

      // Delete the node from S3-compatible storage
      await this.s3Client!.send(
        new DeleteObjectCommand({
          Bucket: this.bucketName,
          Key: `${this.nounPrefix}${id}.json`
        })
      )

      // Log the change for efficient synchronization
      await this.appendToChangeLog({
        timestamp: Date.now(),
        operation: 'delete',
        entityType: 'noun',
        entityId: id
      })
    } catch (error) {
      this.logger.error(`Failed to delete node ${id}:`, error)
      throw new Error(`Failed to delete node ${id}: ${error}`)
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
    
    // ALWAYS check if we should use high-volume mode (critical for detection)
    this.checkVolumeMode()
    
    // Use write buffer in high-volume mode
    if (this.highVolumeMode && this.verbWriteBuffer) {
      this.logger.trace(`📝 BUFFERING: Adding verb ${edge.id} to write buffer (high-volume mode active)`)
      await this.verbWriteBuffer.add(edge.id, edge)
      return
    } else if (!this.highVolumeMode) {
      this.logger.trace(`📝 DIRECT WRITE: Saving verb ${edge.id} directly (high-volume mode inactive)`)
    }

    // Apply backpressure before starting operation
    const requestId = await this.applyBackpressure()

    try {
      // Convert connections Map to a serializable format
      // CRITICAL: Only save lightweight vector data (no metadata)
      // Metadata is saved separately via saveVerbMetadata() (2-file system)
      const serializableEdge = {
        id: edge.id,
        vector: edge.vector,
        connections: this.mapToObject(edge.connections, (set) =>
          Array.from(set as Set<string>)
        )
        // NO metadata field - saved separately for scalability
      }

      // Import the PutObjectCommand only when needed
      const { PutObjectCommand } = await import('@aws-sdk/client-s3')

      // Save the edge to S3-compatible storage using sharding if available
      await this.s3Client!.send(
        new PutObjectCommand({
          Bucket: this.bucketName,
          Key: this.getVerbKey(edge.id),
          Body: JSON.stringify(serializableEdge, null, 2),
          ContentType: 'application/json'
        })
      )

      // Log the change for efficient synchronization
      await this.appendToChangeLog({
        timestamp: Date.now(),
        operation: 'add', // Could be 'update' if we track existing edges
        entityType: 'verb',
        entityId: edge.id,
        data: {
          vector: edge.vector
        }
      })

      // Increment verb count - always increment total, and increment by type if metadata exists
      this.totalVerbCount++
      const metadata = await this.getVerbMetadata(edge.id)
      if (metadata && metadata.type) {
        const currentCount = this.verbCounts.get(metadata.type) || 0
        this.verbCounts.set(metadata.type, currentCount + 1)
      }

      // Release backpressure on success
      this.releaseBackpressure(true, requestId)
    } catch (error) {
      // Release backpressure on error
      this.releaseBackpressure(false, requestId)
      this.logger.error(`Failed to save edge ${edge.id}:`, error)
      throw new Error(`Failed to save edge ${edge.id}: ${error}`)
    }
  }

  /**
   * Get a verb from storage (internal implementation)
   * Combines vector data from getEdge() with metadata from getVerbMetadata()
   */
  protected async getVerb_internal(id: string): Promise<HNSWVerb | null> {
    // Get vector data (lightweight)
    const edge = await this.getEdge(id)
    if (!edge) {
      return null
    }

    // Get metadata (relationship data in 2-file system)
    const metadata = await this.getVerbMetadata(id)

    // Combine into complete verb object
    return {
      ...edge,
      metadata: metadata || {}
    }
  }

  /**
   * Get an edge from storage
   */
  protected async getEdge(id: string): Promise<Edge | null> {
    await this.ensureInitialized()

    try {
      // Import the GetObjectCommand only when needed
      const { GetObjectCommand } = await import('@aws-sdk/client-s3')

      const key = this.getVerbKey(id)
      this.logger.trace(`Getting edge ${id} from key: ${key}`)

      // Try to get the edge from the verbs directory
      const response = await this.s3Client!.send(
        new GetObjectCommand({
          Bucket: this.bucketName,
          Key: key
        })
      )

      // Check if response is null or undefined
      if (!response || !response.Body) {
        this.logger.trace(`No edge found for ${id}`)
        return null
      }

      // Convert the response body to a string
      const bodyContents = await response.Body.transformToString()
      this.logger.trace(`Retrieved edge body for ${id}`)

      // Parse the JSON string
      try {
        const parsedEdge = JSON.parse(bodyContents)
        this.logger.trace(`Parsed edge data for ${id}`)

        // Ensure the parsed edge has the expected properties
        if (
          !parsedEdge ||
          !parsedEdge.id ||
          !parsedEdge.vector ||
          !parsedEdge.connections
        ) {
          this.logger.warn(`Invalid edge data for ${id}`)
          return null
        }

        // Convert serialized connections back to Map<number, Set<string>>
        const connections = new Map<number, Set<string>>()
        for (const [level, nodeIds] of Object.entries(parsedEdge.connections)) {
          connections.set(Number(level), new Set(nodeIds as string[]))
        }

        const edge = {
          id: parsedEdge.id,
          vector: parsedEdge.vector,
          connections
        }

        this.logger.trace(`Successfully retrieved edge ${id}`)
        return edge
      } catch (parseError) {
        this.logger.error(`Failed to parse edge data for ${id}:`, parseError)
        return null
      }
    } catch (error) {
      // Edge not found or other error
      this.logger.trace(`Edge not found for ${id}`)
      return null
    }
  }


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
  
  /**
   * Get verbs with pagination
   * @param options Pagination options
   * @returns Promise that resolves to a paginated result of verbs
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
    
    // Convert filter to edge filter format
    const edgeFilter: {
      sourceId?: string
      targetId?: string
      type?: string
    } = {}
    
    if (options.filter) {
      // Handle sourceId filter
      if (options.filter.sourceId) {
        edgeFilter.sourceId = Array.isArray(options.filter.sourceId)
          ? options.filter.sourceId[0]
          : options.filter.sourceId
      }
      
      // Handle targetId filter
      if (options.filter.targetId) {
        edgeFilter.targetId = Array.isArray(options.filter.targetId)
          ? options.filter.targetId[0]
          : options.filter.targetId
      }
      
      // Handle verbType filter
      if (options.filter.verbType) {
        edgeFilter.type = Array.isArray(options.filter.verbType)
          ? options.filter.verbType[0]
          : options.filter.verbType
      }
    }
    
    // Get edges with pagination
    const result = await this.getEdgesWithPagination({
      limit: options.limit,
      cursor: options.cursor,
      useCache: true,
      filter: edgeFilter
    })
    
    // Convert HNSWVerbs to GraphVerbs by combining with metadata
    const graphVerbs: GraphVerb[] = []
    for (const hnswVerb of result.edges) {
      const graphVerb = await this.convertHNSWVerbToGraphVerb(hnswVerb)
      if (graphVerb) {
        graphVerbs.push(graphVerb)
      }
    }
    
    // Apply filtering at GraphVerb level since HNSWVerb filtering is not supported
    let filteredGraphVerbs = graphVerbs
    if (options.filter) {
      filteredGraphVerbs = graphVerbs.filter((graphVerb) => {
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
        
        // Filter by verbType (maps to type field)
        if (options.filter!.verbType) {
          const verbTypes = Array.isArray(options.filter!.verbType)
            ? options.filter!.verbType
            : [options.filter!.verbType]
          if (graphVerb.type && !verbTypes.includes(graphVerb.type)) {
            return false
          }
        }
        
        return true
      })
    }
    
    return {
      items: filteredGraphVerbs,
      totalCount: this.totalVerbCount,  // Use pre-calculated count from init()
      hasMore: result.hasMore,
      nextCursor: result.nextCursor
    }
  }




  /**
   * Get verbs by source (internal implementation)
   */
  protected async getVerbsBySource_internal(sourceId: string): Promise<GraphVerb[]> {
    // Use the paginated approach to properly handle HNSWVerb to GraphVerb conversion
    const result = await this.getVerbsWithPagination({
      filter: { sourceId: [sourceId] },
      limit: Number.MAX_SAFE_INTEGER // Get all matching results
    })
    return result.items
  }

  /**
   * Get verbs by target (internal implementation)
   */
  protected async getVerbsByTarget_internal(targetId: string): Promise<GraphVerb[]> {
    // Use the paginated approach to properly handle HNSWVerb to GraphVerb conversion
    const result = await this.getVerbsWithPagination({
      filter: { targetId: [targetId] },
      limit: Number.MAX_SAFE_INTEGER // Get all matching results
    })
    return result.items
  }

  /**
   * Get verbs by type (internal implementation)
   */
  protected async getVerbsByType_internal(type: string): Promise<GraphVerb[]> {
    // Use the paginated approach to properly handle HNSWVerb to GraphVerb conversion
    const result = await this.getVerbsWithPagination({
      filter: { verbType: [type] },
      limit: Number.MAX_SAFE_INTEGER // Get all matching results
    })
    return result.items
  }

  /**
   * Delete a verb from storage (internal implementation)
   */
  protected async deleteVerb_internal(id: string): Promise<void> {
    return this.deleteEdge(id)
  }

  /**
   * Delete an edge from storage
   */
  protected async deleteEdge(id: string): Promise<void> {
    await this.ensureInitialized()

    try {
      // Import the DeleteObjectCommand only when needed
      const { DeleteObjectCommand } = await import('@aws-sdk/client-s3')

      // Delete the edge from S3-compatible storage
      await this.s3Client!.send(
        new DeleteObjectCommand({
          Bucket: this.bucketName,
          Key: `${this.verbPrefix}${id}.json`
        })
      )

      // Log the change for efficient synchronization
      await this.appendToChangeLog({
        timestamp: Date.now(),
        operation: 'delete',
        entityType: 'verb',
        entityId: id
      })
    } catch (error) {
      this.logger.error(`Failed to delete edge ${id}:`, error)
      throw new Error(`Failed to delete edge ${id}: ${error}`)
    }
  }

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

      // Delete all objects in the nouns directory
      await deleteObjectsWithPrefix(this.nounPrefix)

      // Delete all objects in the verbs directory
      await deleteObjectsWithPrefix(this.verbPrefix)

      // Delete all objects in the noun metadata directory
      await deleteObjectsWithPrefix(this.metadataPrefix)

      // Delete all objects in the verb metadata directory
      await deleteObjectsWithPrefix(this.verbMetadataPrefix)

      // Delete all objects in the index directory
      await deleteObjectsWithPrefix(this.indexPrefix)
      
      // Clear the statistics cache
      this.statisticsCache = null
      this.statisticsModified = false
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
  ): Promise<ChangeLogEntry[]> {
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

      const changes: ChangeLogEntry[] = []

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
              changes.push(entry)
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

  /**
   * Get nouns with pagination support
   * @param options Pagination options
   * @returns Promise that resolves to a paginated result of nouns
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
      
      // Filter by service
      if (options.filter.service) {
        const services = Array.isArray(options.filter.service)
          ? options.filter.service
          : [options.filter.service]
        
        const filteredByService: HNSWNoun[] = []
        for (const node of filteredNodes) {
          const metadata = await this.getNounMetadata(node.id)
          if (metadata && services.includes(metadata.service)) {
            filteredByService.push(node)
          }
        }
        filteredNodes = filteredByService
      }
      
      // Filter by metadata
      if (options.filter.metadata) {
        const metadataFilter = options.filter.metadata
        const filteredByMetadata: HNSWNoun[] = []
        for (const node of filteredNodes) {
          const metadata = await this.getNounMetadata(node.id)
          if (metadata) {
            const matches = Object.entries(metadataFilter).every(
              ([key, value]) => metadata[key] === value
            )
            if (matches) {
              filteredByMetadata.push(node)
            }
          }
        }
        filteredNodes = filteredByMetadata
      }
    }
    
    return {
      items: filteredNodes,
      totalCount: this.totalNounCount,  // Use pre-calculated count from init()
      hasMore: result.hasMore,
      nextCursor: result.nextCursor
    }
  }

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

    try {
      const { PutObjectCommand } = await import('@aws-sdk/client-s3')

      // Use sharded path for HNSW data
      const shard = getShardIdFromUuid(nounId)
      const key = `entities/nouns/hnsw/${shard}/${nounId}.json`

      await this.s3Client!.send(
        new PutObjectCommand({
          Bucket: this.bucketName,
          Key: key,
          Body: JSON.stringify(hnswData, null, 2),
          ContentType: 'application/json'
        })
      )
    } catch (error) {
      this.logger.error(`Failed to save HNSW data for ${nounId}:`, error)
      throw new Error(`Failed to save HNSW data for ${nounId}: ${error}`)
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
      const { GetObjectCommand } = await import('@aws-sdk/client-s3')

      const shard = getShardIdFromUuid(nounId)
      const key = `entities/nouns/hnsw/${shard}/${nounId}.json`

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
      if (
        error.name === 'NoSuchKey' ||
        error.message?.includes('NoSuchKey') ||
        error.message?.includes('not found')
      ) {
        return null
      }

      this.logger.error(`Failed to get HNSW data for ${nounId}:`, error)
      throw new Error(`Failed to get HNSW data for ${nounId}: ${error}`)
    }
  }

  /**
   * Save HNSW system data (entry point, max level)
   * Storage path: system/hnsw-system.json
   */
  public async saveHNSWSystem(systemData: {
    entryPointId: string | null
    maxLevel: number
  }): Promise<void> {
    await this.ensureInitialized()

    try {
      const { PutObjectCommand } = await import('@aws-sdk/client-s3')

      const key = `${this.systemPrefix}hnsw-system.json`

      await this.s3Client!.send(
        new PutObjectCommand({
          Bucket: this.bucketName,
          Key: key,
          Body: JSON.stringify(systemData, null, 2),
          ContentType: 'application/json'
        })
      )
    } catch (error) {
      this.logger.error('Failed to save HNSW system data:', error)
      throw new Error(`Failed to save HNSW system data: ${error}`)
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
      if (
        error.name === 'NoSuchKey' ||
        error.message?.includes('NoSuchKey') ||
        error.message?.includes('not found')
      ) {
        return null
      }

      this.logger.error('Failed to get HNSW system data:', error)
      throw new Error(`Failed to get HNSW system data: ${error}`)
    }
  }
}
