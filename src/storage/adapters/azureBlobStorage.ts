/**
 * Azure Blob Storage Adapter (Native)
 * Uses the native @azure/storage-blob library for optimal performance and authentication
 *
 * Supports multiple authentication methods:
 * 1. DefaultAzureCredential (Managed Identity) - Automatic in Azure environments
 * 2. Connection String
 * 3. Storage Account Key
 * 4. SAS Token
 * 5. Azure AD (OAuth2) via DefaultAzureCredential
 *
 * Fully compatible with metadata/vector separation architecture
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
import { getGlobalBackpressure } from '../../utils/adaptiveBackpressure.js'
import { getWriteBuffer, WriteBuffer } from '../../utils/writeBuffer.js'
import { getCoalescer, RequestCoalescer } from '../../utils/requestCoalescer.js'
import { getShardIdFromUuid, getAllShardIds, getShardIdByIndex, TOTAL_SHARDS } from '../sharding.js'
import { InitMode } from './baseStorageAdapter.js'

// Type aliases for better readability
type HNSWNode = HNSWNoun
type Edge = HNSWVerb

// Azure SDK types - dynamically imported to avoid issues in browser environments
type BlobServiceClient = any
type ContainerClient = any
type BlockBlobClient = any

// Azure Blob Storage API limits
const MAX_AZURE_PAGE_SIZE = 5000

/**
 * Native Azure Blob Storage adapter for server environments
 * Uses the @azure/storage-blob library with DefaultAzureCredential
 *
 * Authentication priority:
 * 1. DefaultAzureCredential (Managed Identity) - if no credentials provided
 * 2. Connection String - if connectionString provided
 * 3. Storage Account Key - if accountName + accountKey provided
 * 4. SAS Token - if accountName + sasToken provided
 *
 * Type-aware storage now built into BaseStorage
 * - Removed 10 *_internal method overrides (now inherit from BaseStorage's type-first implementation)
 * - Removed pagination overrides
 * - Updated HNSW methods to use BaseStorage's getNoun/saveNoun (type-first paths)
 * - All operations now use type-first paths: entities/nouns/{type}/vectors/{shard}/{id}.json
 */
export class AzureBlobStorage extends BaseStorage {
  private blobServiceClient: BlobServiceClient | null = null
  private containerClient: ContainerClient | null = null
  private containerName: string
  private accountName?: string
  private accountKey?: string
  private connectionString?: string
  private sasToken?: string

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
  private consecutiveErrors: number = 0
  private lastErrorReset: number = Date.now()

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
  private logger = createModuleLogger('AzureBlobStorage')

  // HNSW mutex locks to prevent read-modify-write races
  private hnswLocks = new Map<string, Promise<void>>()

  /**
   * Initialize the storage adapter
   *
   * @param options Configuration options for Azure Blob Storage
   *
   * @example Zero-config (recommended) - auto-detects Azure Functions for fast init
   * ```typescript
   * const storage = new AzureBlobStorage({
   *   containerName: 'my-container',
   *   accountName: 'myaccount'
   * })
   * await storage.init() // <200ms in Azure Functions, blocking locally
   * ```
   *
   * @example Force progressive mode for all environments
   * ```typescript
   * const storage = new AzureBlobStorage({
   *   containerName: 'my-container',
   *   accountName: 'myaccount',
   *   initMode: 'progressive' // Always <200ms init
   * })
   * ```
   */
  constructor(options: {
    containerName: string

    // Connection String authentication (highest priority)
    connectionString?: string

    // Account + Key authentication
    accountName?: string
    accountKey?: string

    // SAS Token authentication
    sasToken?: string

    // Cache and operation configuration
    cacheConfig?: {
      hotCacheMaxSize?: number
      hotCacheEvictionThreshold?: number
      warmCacheTTL?: number
    }

    /**
     * Initialization mode for fast cold starts
     *
     * - `'auto'` (default): Progressive in cloud environments (Azure Functions),
     *   strict locally. Zero-config optimization.
     * - `'progressive'`: Always use fast init (<200ms). Container validation and
     *   count loading happen in background. First write validates container.
     * - `'strict'`: Traditional blocking init. Validates container and loads counts
     *   before init() returns.
     *
     */
    initMode?: InitMode

    readOnly?: boolean
  }) {
    super()
    this.containerName = options.containerName
    this.connectionString = options.connectionString
    this.accountName = options.accountName
    this.accountKey = options.accountKey
    this.sasToken = options.sasToken
    this.readOnly = options.readOnly || false

    // Handle initMode
    if (options.initMode) {
      this.initMode = options.initMode
    }

    // Set up prefixes for different types of data using entity-based structure
    this.nounPrefix = `${getDirectoryPath('noun', 'vector')}/`
    this.verbPrefix = `${getDirectoryPath('verb', 'vector')}/`
    this.metadataPrefix = `${getDirectoryPath('noun', 'metadata')}/`  // Noun metadata
    this.verbMetadataPrefix = `${getDirectoryPath('verb', 'metadata')}/`  // Verb metadata
    this.systemPrefix = `${SYSTEM_DIR}/`  // System data

    // Initialize cache managers
    this.nounCacheManager = new CacheManager<HNSWNode>(options.cacheConfig)
    this.verbCacheManager = new CacheManager<Edge>(options.cacheConfig)

    // Write buffering always enabled - no env var check needed

    // Initialize metadata write buffer for cloud rate limit protection
    this.metadataWriteBuffer = new MetadataWriteBuffer(
      (path, data) => this.writeObjectToPath(path, data),
      { maxBufferSize: 200, flushIntervalMs: 200, concurrencyLimit: 10 }
    )
  }

  /**
   * Get Azure Blob-optimized batch configuration with native batch API support
   *
   * Azure Blob Storage has good throughput with parallel operations:
   * - Large batch sizes (up to 1000 blobs)
   * - No artificial delay needed
   * - High concurrency (100 parallel optimal)
   *
   * Azure supports ~3000 operations/second with burst up to 6000
   * Recent Azure improvements make parallel downloads very efficient
   *
   * @returns Azure Blob-optimized batch configuration
   * Updated for native batch API
   */
  public getBatchConfig(): StorageBatchConfig {
    return {
      maxBatchSize: 1000,              // Azure can handle large batches
      batchDelayMs: 0,                 // No rate limiting needed
      maxConcurrent: 100,              // Optimal for Azure Blob Storage
      supportsParallelWrites: true,    // Azure handles parallel well
      rateLimit: {
        operationsPerSecond: 3000,     // Good throughput
        burstCapacity: 6000
      }
    }
  }

  /**
   * Batch read operation using Azure's parallel blob download
   *
   * Uses Promise.allSettled() for maximum parallelism with BlockBlobClient.
   * Azure Blob Storage handles concurrent downloads efficiently.
   *
   * Performance: ~100 concurrent requests = <600ms for 100 blobs
   *
   * @param paths - Array of Azure blob paths to read
   * @returns Map of path -> parsed JSON data (only successful reads)
   */
  public async readBatch(paths: string[]): Promise<Map<string, any>> {
    await this.ensureInitialized()

    const results = new Map<string, any>()
    if (paths.length === 0) return results

    const batchConfig = this.getBatchConfig()
    const chunkSize = batchConfig.maxConcurrent || 100

    this.logger.debug(`[Azure Batch] Reading ${paths.length} blobs in chunks of ${chunkSize}`)

    // Process in chunks to respect concurrency limits
    for (let i = 0; i < paths.length; i += chunkSize) {
      const chunk = paths.slice(i, i + chunkSize)

      // Parallel download for this chunk
      const chunkResults = await Promise.allSettled(
        chunk.map(async (path) => {
          try {
            const blockBlobClient = this.containerClient!.getBlockBlobClient(path)
            const downloadResponse = await blockBlobClient.download(0)

            if (!downloadResponse.readableStreamBody) {
              return { path, data: null, success: false }
            }

            const downloaded = await this.streamToBuffer(downloadResponse.readableStreamBody)
            const data = JSON.parse(downloaded.toString())
            return { path, data, success: true }
          } catch (error: any) {
            // 404 and other errors are expected (not all paths may exist)
            if (error.statusCode !== 404 && error.code !== 'BlobNotFound') {
              this.logger.warn(`[Azure Batch] Failed to read ${path}: ${error.message}`)
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

    this.logger.debug(`[Azure Batch] Successfully read ${results.size}/${paths.length} blobs`)
    return results
  }

  /**
   * Initialize the storage adapter
   *
   * Supports progressive initialization for fast cold starts
   *
   * | Mode | Init Time | When |
   * |------|-----------|------|
   * | `progressive` | <200ms | Azure Functions |
   * | `strict` | 100-500ms+ | Local development, tests |
   * | `auto` | Detected | Default - best of both |
   *
   * In progressive mode:
   * - SDK import and client creation: ~50ms (unavoidable)
   * - Write buffers and caches: ~10ms
   * - Mark as initialized: READY
   * - Background: validate container, load counts
   *
   * First write operation validates container existence (lazy validation).
   */
  public async init(): Promise<void> {
    if (this.isInitialized) {
      return
    }

    try {
      // Import Azure Storage SDK only when needed (~50ms)
      const { BlobServiceClient } = await import('@azure/storage-blob')

      // Configure the Azure Blob Storage client based on available credentials
      // Priority 1: Connection String
      if (this.connectionString) {
        this.blobServiceClient = BlobServiceClient.fromConnectionString(this.connectionString)
        prodLog.info('🔐 Azure: Using Connection String')
      }
      // Priority 2: Account Name + Key
      else if (this.accountName && this.accountKey) {
        const { StorageSharedKeyCredential } = await import('@azure/storage-blob')
        const sharedKeyCredential = new StorageSharedKeyCredential(
          this.accountName,
          this.accountKey
        )
        this.blobServiceClient = new BlobServiceClient(
          `https://${this.accountName}.blob.core.windows.net`,
          sharedKeyCredential
        )
        prodLog.info('🔐 Azure: Using Account Key')
      }
      // Priority 3: SAS Token
      else if (this.accountName && this.sasToken) {
        this.blobServiceClient = new BlobServiceClient(
          `https://${this.accountName}.blob.core.windows.net${this.sasToken}`
        )
        prodLog.info('🔐 Azure: Using SAS Token')
      }
      // Priority 4: DefaultAzureCredential (Managed Identity)
      else if (this.accountName) {
        const { DefaultAzureCredential } = await import('@azure/identity')
        const credential = new DefaultAzureCredential()
        this.blobServiceClient = new BlobServiceClient(
          `https://${this.accountName}.blob.core.windows.net`,
          credential
        )
        prodLog.info('🔐 Azure: Using DefaultAzureCredential (Managed Identity)')
      }
      else {
        throw new Error('Azure Blob Storage requires either connectionString, accountName+accountKey, accountName+sasToken, or accountName (for Managed Identity)')
      }

      // Get reference to the container (no network calls)
      this.containerClient = this.blobServiceClient.getContainerClient(this.containerName)

      // Determine initialization mode
      const effectiveMode = this.resolveInitMode()
      const isCloud = this.detectCloudEnvironment()

      prodLog.info(`🚀 Azure init mode: ${effectiveMode} (detected cloud: ${isCloud})`)

      // Initialize write buffers for high-volume mode
      const storageId = `azure-${this.containerName}`
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

      // Clear any stale cache entries from previous runs
      prodLog.info('🧹 Clearing cache from previous run to prevent cache poisoning')
      this.nounCacheManager.clear()
      this.verbCacheManager.clear()
      prodLog.info('✅ Cache cleared - starting fresh')

      // Progressive vs Strict initialization
      if (effectiveMode === 'progressive') {
        // PROGRESSIVE MODE: Fast init, background validation
        // Mark as initialized immediately - ready to accept operations
        // Container validation happens lazily on first write
        // Count loading happens in background

        prodLog.info(`✅ Azure progressive init complete: ${this.containerName} (validation deferred)`)

        // Initialize GraphAdjacencyIndex and type statistics
        await super.init()

        // Schedule background tasks (non-blocking)
        this.scheduleBackgroundInit()
      } else {
        // STRICT MODE: Traditional blocking initialization
        // Verify container exists or create it (blocking)
        const exists = await this.containerClient.exists()
        if (!exists) {
          await this.containerClient.create()
          prodLog.info(`✅ Created Azure container: ${this.containerName}`)
        } else {
          prodLog.info(`✅ Connected to Azure container: ${this.containerName}`)
        }
        this.bucketValidated = true

        // Initialize counts from storage (blocking)
        await this.initializeCounts()
        this.countsLoaded = true

        // Initialize GraphAdjacencyIndex and type statistics
        await super.init()

        // Mark background tasks as complete (nothing to do in background)
        this.backgroundTasksComplete = true
      }
    } catch (error) {
      this.logger.error('Failed to initialize Azure Blob Storage:', error)
      throw new Error(`Failed to initialize Azure Blob Storage: ${error}`)
    }
  }

  // =============================================
  // Progressive Initialization
  // =============================================

  /**
   * Run background initialization tasks for Azure.
   *
   * Called in progressive mode after init() returns. Performs:
   * 1. Container validation (in background)
   * 2. Count loading from storage (in background)
   *
   * These tasks don't block the main thread, allowing fast cold starts.
   *
   * @protected
   * @override
   */
  protected async runBackgroundInit(): Promise<void> {
    const startTime = Date.now()
    prodLog.info('[Azure Background] Starting background initialization...')

    // Run validation and count loading in parallel
    const validationPromise = this.validateContainerInBackground()
    const countsPromise = this.loadCountsInBackground()

    // Wait for both to complete (but we're already initialized)
    await Promise.all([validationPromise, countsPromise])

    const elapsed = Date.now() - startTime
    prodLog.info(`[Azure Background] Background init complete in ${elapsed}ms`)
  }

  /**
   * Validate container existence in background.
   *
   * Creates container if it doesn't exist. Stores result in
   * bucketValidated/bucketValidationError for lazy use.
   *
   * @private
   */
  private async validateContainerInBackground(): Promise<void> {
    try {
      const exists = await this.containerClient!.exists()
      if (!exists) {
        // Try to create container
        try {
          await this.containerClient!.create()
          prodLog.info(`[Azure Background] Created container: ${this.containerName}`)
        } catch (createError: any) {
          // Another process might have created it - check again
          const existsNow = await this.containerClient!.exists()
          if (!existsNow) {
            throw createError
          }
        }
      }
      this.bucketValidated = true
      prodLog.info(`[Azure Background] Container validated: ${this.containerName}`)
    } catch (error: any) {
      this.bucketValidationError = new Error(
        `Container ${this.containerName} validation failed: ${error.message || error}`
      )
      prodLog.warn(`[Azure Background] Container validation failed: ${this.containerName}`)
    }
  }

  /**
   * Load counts from storage in background.
   *
   * @private
   */
  private async loadCountsInBackground(): Promise<void> {
    try {
      await this.initializeCounts()
      this.countsLoaded = true
      prodLog.info(`[Azure Background] Counts loaded: ${this.totalNounCount} nouns, ${this.totalVerbCount} verbs`)
    } catch (error: any) {
      // Non-fatal in progressive mode - counts start at 0
      prodLog.warn(`[Azure Background] Failed to load counts (starting at 0): ${error.message}`)
      this.countsLoaded = true // Mark as loaded even on error (0 is valid)
    }
  }

  /**
   * Ensure container is validated before write operations.
   *
   * In progressive mode, container validation is deferred until the first
   * write operation. This method validates the container and caches the
   * result (or error) for subsequent calls.
   *
   * @throws Error if container validation fails
   * @protected
   * @override
   */
  protected async ensureValidatedForWrite(): Promise<void> {
    // If already validated, nothing to do
    if (this.bucketValidated) {
      return
    }

    // If we have a cached validation error from background init, throw it
    if (this.bucketValidationError) {
      throw this.bucketValidationError
    }

    // Perform synchronous validation (first write in progressive mode)
    try {
      prodLog.info(`[Azure] Lazy container validation on first write: ${this.containerName}`)
      const exists = await this.containerClient!.exists()
      if (!exists) {
        // Try to create container
        await this.containerClient!.create()
        prodLog.info(`[Azure] Created container: ${this.containerName}`)
      }
      this.bucketValidated = true
      prodLog.info(`[Azure] Container validated successfully: ${this.containerName}`)
    } catch (error: any) {
      // Cache the error for fast-fail on subsequent writes
      const wrappedError = new Error(
        `Container ${this.containerName} validation failed: ${error.message || error}`
      )
      this.bucketValidationError = wrappedError
      throw wrappedError
    }
  }

  /**
   * Get the Azure blob name for a noun using UUID-based sharding
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
   * Get the Azure blob name for a verb using UUID-based sharding
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
   * Override base class method to detect Azure-specific throttling errors
   */
  protected isThrottlingError(error: any): boolean {
    // First check base class detection
    if (super.isThrottlingError(error)) {
      return true
    }

    // Azure-specific throttling detection
    const statusCode = error.statusCode || error.code
    const message = error.message?.toLowerCase() || ''

    return (
      statusCode === 429 || // Too Many Requests
      statusCode === 503 || // Service Unavailable
      statusCode === 'ServerBusy' ||
      statusCode === 'IngressOverLimit' ||
      statusCode === 'EgressOverLimit' ||
      message.includes('throttl') ||
      message.includes('rate limit') ||
      message.includes('too many requests')
    )
  }

  /**
   * Override base class to enable smart batching for cloud storage
   *
   * Azure Blob Storage is cloud storage with network latency (~50ms per write).
   * Smart batching reduces writes from 1000 ops → 100 batches.
   *
   * @returns true (Azure is cloud storage)
   */
  protected isCloudStorage(): boolean {
    return true  // Azure benefits from batching
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

  // Removed checkVolumeMode() - write buffering always enabled for cloud storage

  /**
   * Flush noun buffer to Azure
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
   * Flush verb buffer to Azure
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

  // Removed saveNoun_internal - now inherit from BaseStorage's type-first implementation

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
   * Save a node directly to Azure (bypass buffer)
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

      // Get the Azure blob name with UUID-based sharding
      const blobName = this.getNounKey(node.id)

      // Save to Azure Blob Storage
      const blockBlobClient = this.containerClient!.getBlockBlobClient(blobName)
      await blockBlobClient.upload(
        JSON.stringify(serializableNode, null, 2),
        JSON.stringify(serializableNode).length,
        {
          blobHTTPHeaders: { blobContentType: 'application/json' }
        }
      )

      // CRITICAL FIX: Only cache nodes with non-empty vectors
      // This prevents cache pollution from HNSW's lazy-loading nodes (vector: [])
      if (node.vector && Array.isArray(node.vector) && node.vector.length > 0) {
        this.nounCacheManager.set(node.id, node)
      }
      // Note: Empty vectors are intentional during HNSW lazy mode - not logged

      // Increment noun count
      const metadata = await this.getNounMetadata(node.id)
      if (metadata && metadata.type) {
        await this.incrementEntityCountSafe(metadata.type as string)
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

  // Removed getNoun_internal - now inherit from BaseStorage's type-first implementation

  /**
   * Get a node from storage
   */
  protected async getNode(id: string): Promise<HNSWNode | null> {
    await this.ensureInitialized()

    // Check cache first
    const cached: HNSWNode | null = await this.nounCacheManager.get(id)

    // Validate cached object before returning
    if (cached !== undefined && cached !== null) {
      // Validate cached object has required fields (including non-empty vector!)
      if (!cached.id || !cached.vector || !Array.isArray(cached.vector) || cached.vector.length === 0) {
        // Invalid cache detected - log and auto-recover
        prodLog.warn(`[Azure] Invalid cached object for ${id.substring(0, 8)} (${
          !cached.id ? 'missing id' :
          !cached.vector ? 'missing vector' :
          !Array.isArray(cached.vector) ? 'vector not array' :
          'empty vector'
        }) - removing from cache and reloading`)
        this.nounCacheManager.delete(id)
        // Fall through to load from Azure
      } else {
        // Valid cache hit
        this.logger.trace(`Cache hit for noun ${id}`)
        return cached
      }
    } else if (cached === null) {
      prodLog.warn(`[Azure] Cache contains null for ${id.substring(0, 8)} - reloading from storage`)
    }

    // Apply backpressure
    const requestId = await this.applyBackpressure()

    try {
      this.logger.trace(`Getting node ${id}`)

      // Get the Azure blob name with UUID-based sharding
      const blobName = this.getNounKey(id)

      // Download from Azure Blob Storage
      const blockBlobClient = this.containerClient!.getBlockBlobClient(blobName)
      const downloadResponse = await blockBlobClient.download(0)
      const downloaded = await this.streamToBuffer(downloadResponse.readableStreamBody!)

      // Parse JSON
      const data = JSON.parse(downloaded.toString())

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
        prodLog.warn(`[Azure] Not caching invalid node ${id.substring(0, 8)} (missing id/vector or empty vector)`)
      }

      this.logger.trace(`Successfully retrieved node ${id}`)
      this.releaseBackpressure(true, requestId)
      return node
    } catch (error: any) {
      this.releaseBackpressure(false, requestId)

      // Check if this is a "not found" error
      if (error.statusCode === 404 || error.code === 'BlobNotFound') {
        this.logger.trace(`Node not found: ${id}`)
        // CRITICAL FIX: Do NOT cache null values
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

  // Removed deleteNoun_internal - now inherit from BaseStorage's type-first implementation

  /**
   * Write an object to a specific path in Azure
   * Primitive operation required by base class
   *
   * Performs lazy container validation on first write in progressive mode.
   * @protected
   */
  protected async writeObjectToPath(path: string, data: any): Promise<void> {
    await this.ensureInitialized()
    // Lazy container validation for progressive init
    await this.ensureValidatedForWrite()

    const MAX_RETRIES = 5
    let lastError: any

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        this.logger.trace(`Writing object to path: ${path}`)

        const blockBlobClient = this.containerClient!.getBlockBlobClient(path)
        const content = JSON.stringify(data, null, 2)
        await blockBlobClient.upload(content, content.length, {
          blobHTTPHeaders: { blobContentType: 'application/json' }
        })

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
   * Read an object from a specific path in Azure
   * Primitive operation required by base class
   * @protected
   */
  protected async readObjectFromPath(path: string): Promise<any | null> {
    await this.ensureInitialized()

    try {
      this.logger.trace(`Reading object from path: ${path}`)

      const blockBlobClient = this.containerClient!.getBlockBlobClient(path)
      const downloadResponse = await blockBlobClient.download(0)
      const downloaded = await this.streamToBuffer(downloadResponse.readableStreamBody!)

      const data = JSON.parse(downloaded.toString())

      this.logger.trace(`Object read successfully from ${path}`)
      return data
    } catch (error: any) {
      // Check if this is a "not found" error
      if (error.statusCode === 404 || error.code === 'BlobNotFound') {
        this.logger.trace(`Object not found at ${path}`)
        return null
      }

      this.logger.error(`Failed to read object from ${path}:`, error)
      throw BrainyError.fromError(error, `readObjectFromPath(${path})`)
    }
  }

  /**
   * Delete an object from a specific path in Azure
   * Primitive operation required by base class
   *
   * Performs lazy container validation on first delete in progressive mode.
   * @protected
   */
  protected async deleteObjectFromPath(path: string): Promise<void> {
    await this.ensureInitialized()
    // Lazy container validation for progressive init
    await this.ensureValidatedForWrite()

    try {
      this.logger.trace(`Deleting object at path: ${path}`)

      const blockBlobClient = this.containerClient!.getBlockBlobClient(path)
      await blockBlobClient.delete()

      this.logger.trace(`Object deleted successfully from ${path}`)
    } catch (error: any) {
      // If already deleted (404), treat as success
      if (error.statusCode === 404 || error.code === 'BlobNotFound') {
        this.logger.trace(`Object at ${path} not found (already deleted)`)
        return
      }

      this.logger.error(`Failed to delete object from ${path}:`, error)
      throw new Error(`Failed to delete object from ${path}: ${error}`)
    }
  }

  /**
   * Batch delete multiple blobs from Azure Blob Storage
   * Deletes up to 256 blobs per batch (Azure limit)
   * Handles throttling, retries, and partial failures
   *
   * @param keys - Array of blob names (paths) to delete
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

    this.logger.info(`Starting batch delete of ${keys.length} blobs`)

    const stats = {
      totalRequested: keys.length,
      successfulDeletes: 0,
      failedDeletes: 0,
      errors: [] as Array<{ key: string; error: string }>
    }

    // Chunk keys into batches of max 256 (Azure limit)
    const MAX_BATCH_SIZE = 256
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
        const requestId = await this.applyBackpressure()

        try {
          const { BlobBatchClient } = await import('@azure/storage-blob')

          this.logger.debug(
            `Processing batch ${batchIndex + 1}/${batches.length} with ${batch.length} blobs (attempt ${retryCount + 1}/${maxRetries + 1})`
          )

          // Create batch client
          const batchClient = this.containerClient!.getBlobBatchClient()

          // Execute batch delete
          const deletePromises = batch.map((key) => {
            const blobClient = this.containerClient!.getBlockBlobClient(key)
            return blobClient.url
          })

          // Use batch delete
          const batchDeleteResponse = await batchClient.deleteBlobs(
            batch.map(key => this.containerClient!.getBlockBlobClient(key).url),
            {
              // Additional options can be added here
            }
          )

          this.logger.debug(
            `Batch ${batchIndex + 1} completed`
          )

          // Process results
          for (let i = 0; i < batch.length; i++) {
            const key = batch[i]
            const subResponse = batchDeleteResponse.subResponses[i]

            if (subResponse.status === 202 || subResponse.status === 404) {
              // 202 Accepted = successful delete
              // 404 Not Found = already deleted (treat as success)
              stats.successfulDeletes++

              if (subResponse.status === 404) {
                this.logger.trace(`Blob ${key} already deleted (404)`)
              }
            } else {
              // Deletion failed
              stats.failedDeletes++
              stats.errors.push({
                key,
                error: `HTTP ${subResponse.status}: ${subResponse.errorCode || 'Unknown error'}`
              })

              this.logger.error(
                `Failed to delete ${key}: ${subResponse.status} - ${subResponse.errorCode}`
              )
            }
          }

          this.releaseBackpressure(true, requestId)
          batchSuccess = true
        } catch (error: any) {
          this.releaseBackpressure(false, requestId)

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
   * List all objects under a specific prefix in Azure
   * Primitive operation required by base class
   * @protected
   */
  protected async listObjectsUnderPath(prefix: string): Promise<string[]> {
    await this.ensureInitialized()

    try {
      this.logger.trace(`Listing objects under prefix: ${prefix}`)

      const paths: string[] = []
      for await (const blob of this.containerClient!.listBlobsFlat({ prefix })) {
        if (blob.name) {
          paths.push(blob.name)
        }
      }

      this.logger.trace(`Found ${paths.length} objects under ${prefix}`)
      return paths
    } catch (error) {
      this.logger.error(`Failed to list objects under ${prefix}:`, error)
      throw new Error(`Failed to list objects under ${prefix}: ${error}`)
    }
  }

  /**
   * Helper: Convert Azure stream to buffer
   */
  private async streamToBuffer(readableStream: NodeJS.ReadableStream): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = []
      readableStream.on('data', (data) => {
        chunks.push(data instanceof Buffer ? data : Buffer.from(data))
      })
      readableStream.on('end', () => {
        resolve(Buffer.concat(chunks))
      })
      readableStream.on('error', reject)
    })
  }

  // Removed saveVerb_internal - now inherit from BaseStorage's type-first implementation

  /**
   * Save an edge to storage
   * Always uses write buffer for consistent performance
   */
  protected async saveEdge(edge: Edge): Promise<void> {
    await this.ensureInitialized()

    // Always use write buffer - cloud storage benefits from batching
    if (this.verbWriteBuffer) {
      this.logger.trace(`📝 BUFFERING: Adding verb ${edge.id} to write buffer`)

      // Populate cache BEFORE buffering for read-after-write consistency
      this.verbCacheManager.set(edge.id, edge)

      await this.verbWriteBuffer.add(edge.id, edge)
      return
    }

    // Fallback to direct write if buffer not initialized (shouldn't happen after init)
    await this.saveEdgeDirect(edge)
  }

  /**
   * Save an edge directly to Azure (bypass buffer)
   */
  private async saveEdgeDirect(edge: Edge): Promise<void> {
    const requestId = await this.applyBackpressure()

    try {
      this.logger.trace(`Saving edge ${edge.id}`)

      // Convert connections Map to serializable format
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

      // Get the Azure blob name with UUID-based sharding
      const blobName = this.getVerbKey(edge.id)

      // Save to Azure
      const blockBlobClient = this.containerClient!.getBlockBlobClient(blobName)
      await blockBlobClient.upload(
        JSON.stringify(serializableEdge, null, 2),
        JSON.stringify(serializableEdge).length,
        {
          blobHTTPHeaders: { blobContentType: 'application/json' }
        }
      )

      // Update cache
      this.verbCacheManager.set(edge.id, edge)

      // Count tracking happens in baseStorage.saveVerbMetadata_internal
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

  // Removed getVerb_internal - now inherit from BaseStorage's type-first implementation

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

      // Get the Azure blob name with UUID-based sharding
      const blobName = this.getVerbKey(id)

      // Download from Azure
      const blockBlobClient = this.containerClient!.getBlockBlobClient(blobName)
      const downloadResponse = await blockBlobClient.download(0)
      const downloaded = await this.streamToBuffer(downloadResponse.readableStreamBody!)

      // Parse JSON
      const data = JSON.parse(downloaded.toString())

      // Convert serialized connections back to Map
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

      // Update cache
      this.verbCacheManager.set(id, edge)

      this.logger.trace(`Successfully retrieved edge ${id}`)
      this.releaseBackpressure(true, requestId)
      return edge
    } catch (error: any) {
      this.releaseBackpressure(false, requestId)

      // Check if this is a "not found" error
      if (error.statusCode === 404 || error.code === 'BlobNotFound') {
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

  // Removed deleteVerb_internal - now inherit from BaseStorage's type-first implementation

  // Removed getNounsWithPagination - now inherit from BaseStorage's type-first implementation

  // Removed getNounsByNounType_internal - now inherit from BaseStorage's type-first implementation

  // Removed 3 verb query *_internal methods (getVerbsBySource, getVerbsByTarget, getVerbsByType) - now inherit from BaseStorage's type-first implementation

  /**
   * Clear all data from storage
   */
  public async clear(): Promise<void> {
    await this.ensureInitialized()

    try {
      this.logger.info('🧹 Clearing all data from Azure container...')

      // Delete all blobs in container
      // listBlobsFlat() returns ALL blobs including _cow/ prefix
      // This correctly deletes COW version control data (commits, trees, blobs, refs)
      for await (const blob of this.containerClient!.listBlobsFlat()) {
        if (blob.name) {
          const blockBlobClient = this.containerClient!.getBlockBlobClient(blob.name)
          await blockBlobClient.delete()
        }
      }

      // Reset COW managers (but don't disable COW - it's always enabled)
      // COW will re-initialize automatically on next use
      this.refManager = undefined
      this.blobStorage = undefined
      this.commitLog = undefined

      // Clear caches
      this.nounCacheManager.clear()
      this.verbCacheManager.clear()

      // Reset counts
      this.totalNounCount = 0
      this.totalVerbCount = 0
      this.entityCounts.clear()
      this.verbCounts.clear()

      this.logger.info('✅ All data cleared from Azure')
    } catch (error) {
      this.logger.error('Failed to clear Azure storage:', error)
      throw new Error(`Failed to clear Azure storage: ${error}`)
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
      const properties = await this.containerClient!.getProperties()

      return {
        type: 'azure',
        used: 0, // Azure doesn't provide usage info easily
        quota: null, // No quota in Azure Blob Storage
        details: {
          container: this.containerName,
          lastModified: properties.lastModified,
          etag: properties.etag
        }
      }
    } catch (error) {
      this.logger.error('Failed to get storage status:', error)
      return {
        type: 'azure',
        used: 0,
        quota: null
      }
    }
  }

  /**
   * Check if COW has been explicitly disabled via clear()
   * Fixes bug where clear() doesn't persist across instance restarts
   * @returns true if marker blob exists, false otherwise
   * @protected
   */
  /**
   * Removed checkClearMarker() and createClearMarker() methods
   * COW is now always enabled - marker files are no longer used
   */

  /**
   * Save statistics data to storage
   */
  protected async saveStatisticsData(statistics: StatisticsData): Promise<void> {
    await this.ensureInitialized()

    try {
      const key = `${this.systemPrefix}${STATISTICS_KEY}.json`

      this.logger.trace(`Saving statistics to ${key}`)

      const blockBlobClient = this.containerClient!.getBlockBlobClient(key)
      const content = JSON.stringify(statistics, null, 2)
      await blockBlobClient.upload(content, content.length, {
        blobHTTPHeaders: { blobContentType: 'application/json' }
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

      const blockBlobClient = this.containerClient!.getBlockBlobClient(key)
      const downloadResponse = await blockBlobClient.download(0)
      const downloaded = await this.streamToBuffer(downloadResponse.readableStreamBody!)

      const statistics = JSON.parse(downloaded.toString())

      this.logger.trace('Statistics retrieved successfully')

      // CRITICAL FIX: Populate totalNodes and totalEdges from in-memory counts
      return {
        ...statistics,
        totalNodes: this.totalNounCount,
        totalEdges: this.totalVerbCount,
        lastUpdated: new Date().toISOString()
      }
    } catch (error: any) {
      if (error.statusCode === 404 || error.code === 'BlobNotFound') {
        // Statistics file doesn't exist yet (first restart)
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
    const key = `${this.systemPrefix}counts.json`

    try {
      const blockBlobClient = this.containerClient!.getBlockBlobClient(key)
      const downloadResponse = await blockBlobClient.download(0)
      const downloaded = await this.streamToBuffer(downloadResponse.readableStreamBody!)

      const counts = JSON.parse(downloaded.toString())

      this.totalNounCount = counts.totalNounCount || 0
      this.totalVerbCount = counts.totalVerbCount || 0
      this.entityCounts = new Map(Object.entries(counts.entityCounts || {})) as Map<string, number>
      this.verbCounts = new Map(Object.entries(counts.verbCounts || {})) as Map<string, number>

      prodLog.info(`📊 Loaded counts from storage: ${this.totalNounCount} nouns, ${this.totalVerbCount} verbs`)
    } catch (error: any) {
      if (error.statusCode === 404 || error.code === 'BlobNotFound') {
        // No counts file yet - initialize from scan (first-time setup)
        prodLog.info('📊 No counts file found - this is normal for first init')
        await this.initializeCountsFromScan()
      } else {
        // CRITICAL FIX: Don't silently fail on network/permission errors
        this.logger.error('❌ CRITICAL: Failed to load counts from Azure:', error)
        prodLog.error(`❌ Error loading ${key}: ${error.message}`)

        // Try to recover by scanning the container
        prodLog.warn('⚠️  Attempting recovery by scanning Azure container...')
        await this.initializeCountsFromScan()
      }
    }
  }

  /**
   * Initialize counts from storage scan (expensive - only for first-time init)
   */
  private async initializeCountsFromScan(): Promise<void> {
    try {
      prodLog.info('📊 Scanning Azure container to initialize counts...')

      // Count nouns
      let nounCount = 0
      for await (const blob of this.containerClient!.listBlobsFlat({ prefix: this.nounPrefix })) {
        if (blob.name && blob.name.endsWith('.json')) {
          nounCount++
        }
      }
      this.totalNounCount = nounCount

      // Count verbs
      let verbCount = 0
      for await (const blob of this.containerClient!.listBlobsFlat({ prefix: this.verbPrefix })) {
        if (blob.name && blob.name.endsWith('.json')) {
          verbCount++
        }
      }
      this.totalVerbCount = verbCount

      // Save initial counts
      if (this.totalNounCount > 0 || this.totalVerbCount > 0) {
        await this.persistCounts()
        prodLog.info(`✅ Initialized counts from scan: ${this.totalNounCount} nouns, ${this.totalVerbCount} verbs`)
      } else {
        prodLog.warn(`⚠️  No entities found during container scan. Check that entities exist and prefixes are correct.`)
      }
    } catch (error) {
      // CRITICAL FIX: Don't silently fail - this prevents data loss scenarios
      this.logger.error('❌ CRITICAL: Failed to initialize counts from Azure container scan:', error)
      throw new Error(`Failed to initialize Azure storage counts: ${error}. This prevents container restarts from working correctly.`)
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

      const blockBlobClient = this.containerClient!.getBlockBlobClient(key)
      const content = JSON.stringify(counts, null, 2)
      await blockBlobClient.upload(content, content.length, {
        blobHTTPHeaders: { blobContentType: 'application/json' }
      })
    } catch (error) {
      this.logger.error('Error persisting counts:', error)
    }
  }

  /**
   * Get a noun's vector for HNSW rebuild
   * Uses BaseStorage's getNoun (type-first paths)
   */
  public async getNounVector(id: string): Promise<number[] | null> {
    const noun = await this.getNoun(id)
    return noun ? noun.vector : null
  }

  /**
   * Save HNSW graph data for a noun
   *
   * Uses BaseStorage's getNoun/saveNoun (type-first paths)
   * CRITICAL: Uses mutex locking to prevent read-modify-write races
   */
  public async saveHNSWData(nounId: string, hnswData: {
    level: number
    connections: Record<string, string[]>
  }): Promise<void> {
    const lockKey = `hnsw/${nounId}`

    // CRITICAL FIX: Mutex lock to prevent read-modify-write races
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
      // Use BaseStorage's getNoun (type-first paths)
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

      // Use BaseStorage's saveNoun (type-first paths, atomic write via writeObjectToBranch)
      await this.saveNoun(updatedNoun)
    } finally {
      // Release lock (ALWAYS runs, even if error thrown)
      this.hnswLocks.delete(lockKey)
      releaseLock()
    }
  }

  /**
   * Get HNSW graph data for a noun
   * Uses BaseStorage's getNoun (type-first paths)
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
   *
   * CRITICAL FIX: Optimistic locking with ETags to prevent race conditions
   */
  public async saveHNSWSystem(systemData: {
    entryPointId: string | null
    maxLevel: number
  }): Promise<void> {
    await this.ensureInitialized()

    const key = `${this.systemPrefix}hnsw-system.json`
    const blockBlobClient = this.containerClient!.getBlockBlobClient(key)

    const maxRetries = 5
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        // Get current ETag
        let currentETag: string | undefined

        try {
          const properties = await blockBlobClient.getProperties()
          currentETag = properties.etag
        } catch (error: any) {
          // File doesn't exist yet
          if (error.statusCode !== 404 && error.code !== 'BlobNotFound') {
            throw error
          }
        }

        const content = JSON.stringify(systemData, null, 2)

        // ATOMIC WRITE: Use ETag precondition
        await blockBlobClient.upload(content, content.length, {
          blobHTTPHeaders: { blobContentType: 'application/json' },
          conditions: currentETag
            ? { ifMatch: currentETag }
            : { ifNoneMatch: '*' }
        })

        // Success!
        return
      } catch (error: any) {
        // Precondition failed - concurrent modification
        if (error.statusCode === 412 || error.code === 'ConditionNotMet') {
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
   */
  public async getHNSWSystem(): Promise<{
    entryPointId: string | null
    maxLevel: number
  } | null> {
    await this.ensureInitialized()

    try {
      const key = `${this.systemPrefix}hnsw-system.json`

      const blockBlobClient = this.containerClient!.getBlockBlobClient(key)
      const downloadResponse = await blockBlobClient.download(0)
      const downloaded = await this.streamToBuffer(downloadResponse.readableStreamBody!)

      return JSON.parse(downloaded.toString())
    } catch (error: any) {
      // Azure may return not found errors in different formats
      const isNotFound =
        error.statusCode === 404 ||
        error.code === 'BlobNotFound' ||
        error.code === 404 ||
        error.details?.code === 'BlobNotFound' ||
        error.message?.includes('BlobNotFound') ||
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
   * Set the access tier for a specific blob (cost optimization)
   * Azure Blob Storage tiers:
   * - Hot: $0.0184/GB/month - Frequently accessed data
   * - Cool: $0.01/GB/month - Infrequently accessed data (45% cheaper)
   * - Archive: $0.00099/GB/month - Rarely accessed data (99% cheaper!)
   *
   * @param blobName - Name of the blob to change tier
   * @param tier - Target access tier ('Hot', 'Cool', or 'Archive')
   * @returns Promise that resolves when tier is set
   *
   * @example
   * // Move old vectors to Archive tier (99% cost savings)
   * await storage.setBlobTier('entities/nouns/vectors/ab/old-id.json', 'Archive')
   */
  public async setBlobTier(
    blobName: string,
    tier: 'Hot' | 'Cool' | 'Archive'
  ): Promise<void> {
    await this.ensureInitialized()

    try {
      this.logger.info(`Setting blob tier for ${blobName} to ${tier}`)

      const blockBlobClient = this.containerClient!.getBlockBlobClient(blobName)
      await blockBlobClient.setAccessTier(tier)

      this.logger.info(`Successfully set ${blobName} to ${tier} tier`)
    } catch (error: any) {
      if (error.statusCode === 404 || error.code === 'BlobNotFound') {
        throw new Error(`Blob not found: ${blobName}`)
      }

      this.logger.error(`Failed to set tier for ${blobName}:`, error)
      throw new Error(`Failed to set blob tier: ${error}`)
    }
  }

  /**
   * Get the current access tier for a blob
   *
   * @param blobName - Name of the blob
   * @returns Promise that resolves to the current tier or null if not found
   *
   * @example
   * const tier = await storage.getBlobTier('entities/nouns/vectors/ab/id.json')
   * console.log(`Current tier: ${tier}`) // 'Hot', 'Cool', or 'Archive'
   */
  public async getBlobTier(blobName: string): Promise<string | null> {
    await this.ensureInitialized()

    try {
      const blockBlobClient = this.containerClient!.getBlockBlobClient(blobName)
      const properties = await blockBlobClient.getProperties()

      return properties.accessTier || null
    } catch (error: any) {
      if (error.statusCode === 404 || error.code === 'BlobNotFound') {
        return null
      }

      this.logger.error(`Failed to get tier for ${blobName}:`, error)
      throw new Error(`Failed to get blob tier: ${error}`)
    }
  }

  /**
   * Set access tier for multiple blobs in batch (cost optimization)
   * Efficiently move large numbers of blobs between tiers for cost optimization
   *
   * @param blobs - Array of blob names and their target tiers
   * @param options - Configuration options
   * @returns Promise with statistics about tier changes
   *
   * @example
   * // Move old data to Archive tier for 99% cost savings
   * const oldBlobs = await storage.listObjectsUnderPath('entities/nouns/vectors/')
   * await storage.setBlobTierBatch(
   *   oldBlobs.map(name => ({ blobName: name, tier: 'Archive' }))
   * )
   */
  public async setBlobTierBatch(
    blobs: Array<{ blobName: string; tier: 'Hot' | 'Cool' | 'Archive' }>,
    options: {
      maxRetries?: number
      retryDelayMs?: number
      continueOnError?: boolean
    } = {}
  ): Promise<{
    totalRequested: number
    successfulChanges: number
    failedChanges: number
    errors: Array<{ blobName: string; error: string }>
  }> {
    await this.ensureInitialized()

    const {
      maxRetries = 3,
      retryDelayMs = 1000,
      continueOnError = true
    } = options

    if (!blobs || blobs.length === 0) {
      return {
        totalRequested: 0,
        successfulChanges: 0,
        failedChanges: 0,
        errors: []
      }
    }

    this.logger.info(`Starting batch tier change for ${blobs.length} blobs`)

    const stats = {
      totalRequested: blobs.length,
      successfulChanges: 0,
      failedChanges: 0,
      errors: [] as Array<{ blobName: string; error: string }>
    }

    // Process each blob (Azure doesn't have batch tier API, so we parallelize)
    const CONCURRENT_LIMIT = 10 // Limit concurrent operations to avoid throttling

    for (let i = 0; i < blobs.length; i += CONCURRENT_LIMIT) {
      const batch = blobs.slice(i, i + CONCURRENT_LIMIT)

      const promises = batch.map(async ({ blobName, tier }) => {
        let retryCount = 0

        while (retryCount <= maxRetries) {
          try {
            await this.setBlobTier(blobName, tier)
            return { blobName, success: true, error: null }
          } catch (error: any) {
            // Handle throttling
            if (this.isThrottlingError(error)) {
              this.logger.warn(`Tier change throttled for ${blobName}, retrying...`)
              await this.handleThrottling(error)
              retryCount++

              if (retryCount <= maxRetries) {
                const delay = retryDelayMs * Math.pow(2, retryCount - 1)
                await new Promise((resolve) => setTimeout(resolve, delay))
              }
              continue
            }

            // Other errors
            if (retryCount < maxRetries) {
              retryCount++
              const delay = retryDelayMs * Math.pow(2, retryCount - 1)
              await new Promise((resolve) => setTimeout(resolve, delay))
              continue
            }

            // Max retries exceeded
            return {
              blobName,
              success: false,
              error: error.message || String(error)
            }
          }
        }

        // Should never reach here, but TypeScript needs a return
        return {
          blobName,
          success: false,
          error: 'Max retries exceeded'
        }
      })

      const results = await Promise.all(promises)

      for (const result of results) {
        if (result.success) {
          stats.successfulChanges++
        } else {
          stats.failedChanges++
          if (result.error) {
            stats.errors.push({
              blobName: result.blobName,
              error: result.error
            })
          }
        }
      }
    }

    this.logger.info(
      `Batch tier change completed: ${stats.successfulChanges}/${stats.totalRequested} successful, ${stats.failedChanges} failed`
    )

    return stats
  }

  /**
   * Check if a blob in Archive tier has been rehydrated and is ready to read
   * Archive tier blobs must be rehydrated before they can be read
   *
   * @param blobName - Name of the blob to check
   * @returns Promise that resolves to rehydration status
   *
   * @example
   * const status = await storage.checkRehydrationStatus('entities/nouns/vectors/ab/id.json')
   * if (status.isRehydrated) {
   *   // Blob is ready to read
   *   const data = await storage.readObjectFromPath('entities/nouns/vectors/ab/id.json')
   * }
   */
  public async checkRehydrationStatus(blobName: string): Promise<{
    isArchived: boolean
    isRehydrating: boolean
    isRehydrated: boolean
    rehydratePriority?: string
  }> {
    await this.ensureInitialized()

    try {
      const blockBlobClient = this.containerClient!.getBlockBlobClient(blobName)
      const properties = await blockBlobClient.getProperties()

      const tier = properties.accessTier
      const archiveStatus = properties.archiveStatus

      return {
        isArchived: tier === 'Archive',
        isRehydrating: archiveStatus === 'rehydrate-pending-to-hot' || archiveStatus === 'rehydrate-pending-to-cool',
        isRehydrated: tier === 'Hot' || tier === 'Cool',
        rehydratePriority: properties.rehydratePriority
      }
    } catch (error: any) {
      if (error.statusCode === 404 || error.code === 'BlobNotFound') {
        throw new Error(`Blob not found: ${blobName}`)
      }

      this.logger.error(`Failed to check rehydration status for ${blobName}:`, error)
      throw new Error(`Failed to check rehydration status: ${error}`)
    }
  }

  /**
   * Rehydrate an archived blob (move from Archive to Hot or Cool tier)
   * Note: Rehydration can take several hours depending on priority
   *
   * @param blobName - Name of the blob to rehydrate
   * @param targetTier - Target tier after rehydration ('Hot' or 'Cool')
   * @param priority - Rehydration priority ('Standard' or 'High')
   *                  Standard: Up to 15 hours, cheaper
   *                  High: Up to 1 hour, more expensive
   * @returns Promise that resolves when rehydration is initiated
   *
   * @example
   * // Rehydrate with standard priority (cheaper, slower)
   * await storage.rehydrateBlob('entities/nouns/vectors/ab/id.json', 'Cool', 'Standard')
   *
   * // Check status
   * const status = await storage.checkRehydrationStatus('entities/nouns/vectors/ab/id.json')
   * console.log(`Rehydrating: ${status.isRehydrating}`)
   */
  public async rehydrateBlob(
    blobName: string,
    targetTier: 'Hot' | 'Cool',
    priority: 'Standard' | 'High' = 'Standard'
  ): Promise<void> {
    await this.ensureInitialized()

    try {
      this.logger.info(`Rehydrating blob ${blobName} to ${targetTier} tier with ${priority} priority`)

      const blockBlobClient = this.containerClient!.getBlockBlobClient(blobName)

      // Set tier with rehydration priority
      await blockBlobClient.setAccessTier(targetTier, {
        rehydratePriority: priority
      })

      this.logger.info(`Successfully initiated rehydration for ${blobName}`)
    } catch (error: any) {
      if (error.statusCode === 404 || error.code === 'BlobNotFound') {
        throw new Error(`Blob not found: ${blobName}`)
      }

      this.logger.error(`Failed to rehydrate blob ${blobName}:`, error)
      throw new Error(`Failed to rehydrate blob: ${error}`)
    }
  }

  /**
   * Set lifecycle management policy for automatic tier transitions and deletions
   * Automates cost optimization by moving old data to cheaper tiers or deleting it
   *
   * Azure Lifecycle Management rules run once per day and apply to the entire container.
   * Rules are evaluated against blob properties like lastModifiedTime and lastAccessTime.
   *
   * @param options - Lifecycle policy configuration
   * @returns Promise that resolves when policy is set
   *
   * @example
   * // Auto-archive old vectors for 99% cost savings
   * await storage.setLifecyclePolicy({
   *   rules: [
   *     {
   *       name: 'archiveOldVectors',
   *       enabled: true,
   *       type: 'Lifecycle',
   *       definition: {
   *         filters: {
   *           blobTypes: ['blockBlob'],
   *           prefixMatch: ['entities/nouns/vectors/']
   *         },
   *         actions: {
   *           baseBlob: {
   *             tierToCool: { daysAfterModificationGreaterThan: 30 },
   *             tierToArchive: { daysAfterModificationGreaterThan: 90 },
   *             delete: { daysAfterModificationGreaterThan: 365 }
   *           }
   *         }
   *       }
   *     }
   *   ]
   * })
   */
  public async setLifecyclePolicy(options: {
    rules: Array<{
      name: string
      enabled: boolean
      type: 'Lifecycle'
      definition: {
        filters: {
          blobTypes: string[]
          prefixMatch?: string[]
        }
        actions: {
          baseBlob: {
            tierToCool?: { daysAfterModificationGreaterThan: number }
            tierToArchive?: { daysAfterModificationGreaterThan: number }
            delete?: { daysAfterModificationGreaterThan: number }
          }
        }
      }
    }>
  }): Promise<void> {
    await this.ensureInitialized()

    if (!this.accountName) {
      throw new Error('Lifecycle policies require accountName to be configured')
    }

    try {
      this.logger.info(`Setting lifecycle policy with ${options.rules.length} rules`)

      const { BlobServiceClient } = await import('@azure/storage-blob')

      // Get blob service client
      let blobServiceClient: any
      if (this.connectionString) {
        blobServiceClient = BlobServiceClient.fromConnectionString(this.connectionString)
      } else if (this.accountName && this.accountKey) {
        const { StorageSharedKeyCredential } = await import('@azure/storage-blob')
        const credential = new StorageSharedKeyCredential(this.accountName, this.accountKey)
        blobServiceClient = new BlobServiceClient(
          `https://${this.accountName}.blob.core.windows.net`,
          credential
        )
      } else if (this.accountName && this.sasToken) {
        blobServiceClient = new BlobServiceClient(
          `https://${this.accountName}.blob.core.windows.net${this.sasToken}`
        )
      } else if (this.accountName) {
        const { DefaultAzureCredential } = await import('@azure/identity')
        const credential = new DefaultAzureCredential()
        blobServiceClient = new BlobServiceClient(
          `https://${this.accountName}.blob.core.windows.net`,
          credential
        )
      } else {
        throw new Error('Cannot set lifecycle policy without valid authentication')
      }

      // Get service properties to modify lifecycle policy
      const serviceProperties = await blobServiceClient.getProperties()

      // Format rules according to Azure's expected structure
      const lifecyclePolicy = {
        rules: options.rules.map(rule => ({
          enabled: rule.enabled,
          name: rule.name,
          type: rule.type,
          definition: {
            filters: {
              blobTypes: rule.definition.filters.blobTypes,
              ...(rule.definition.filters.prefixMatch && {
                prefixMatch: rule.definition.filters.prefixMatch
              })
            },
            actions: {
              baseBlob: {
                ...(rule.definition.actions.baseBlob.tierToCool && {
                  tierToCool: rule.definition.actions.baseBlob.tierToCool
                }),
                ...(rule.definition.actions.baseBlob.tierToArchive && {
                  tierToArchive: rule.definition.actions.baseBlob.tierToArchive
                }),
                ...(rule.definition.actions.baseBlob.delete && {
                  delete: rule.definition.actions.baseBlob.delete
                })
              }
            }
          }
        }))
      }

      // Set the lifecycle management policy
      await blobServiceClient.setProperties({
        ...serviceProperties,
        blobAnalyticsLogging: serviceProperties.blobAnalyticsLogging,
        hourMetrics: serviceProperties.hourMetrics,
        minuteMetrics: serviceProperties.minuteMetrics,
        cors: serviceProperties.cors,
        deleteRetentionPolicy: serviceProperties.deleteRetentionPolicy,
        staticWebsite: serviceProperties.staticWebsite,
        // Set lifecycle policy
        lifecyclePolicy
      })

      this.logger.info(`Successfully set lifecycle policy with ${options.rules.length} rules`)
    } catch (error: any) {
      this.logger.error('Failed to set lifecycle policy:', error)
      throw new Error(`Failed to set lifecycle policy: ${error.message || error}`)
    }
  }

  /**
   * Get the current lifecycle management policy
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
      name: string
      enabled: boolean
      type: string
      definition: {
        filters: {
          blobTypes: string[]
          prefixMatch?: string[]
        }
        actions: {
          baseBlob: {
            tierToCool?: { daysAfterModificationGreaterThan: number }
            tierToArchive?: { daysAfterModificationGreaterThan: number }
            delete?: { daysAfterModificationGreaterThan: number }
          }
        }
      }
    }>
  } | null> {
    await this.ensureInitialized()

    if (!this.accountName) {
      throw new Error('Lifecycle policies require accountName to be configured')
    }

    try {
      this.logger.info('Getting lifecycle policy')

      const { BlobServiceClient } = await import('@azure/storage-blob')

      // Get blob service client
      let blobServiceClient: any
      if (this.connectionString) {
        blobServiceClient = BlobServiceClient.fromConnectionString(this.connectionString)
      } else if (this.accountName && this.accountKey) {
        const { StorageSharedKeyCredential } = await import('@azure/storage-blob')
        const credential = new StorageSharedKeyCredential(this.accountName, this.accountKey)
        blobServiceClient = new BlobServiceClient(
          `https://${this.accountName}.blob.core.windows.net`,
          credential
        )
      } else if (this.accountName && this.sasToken) {
        blobServiceClient = new BlobServiceClient(
          `https://${this.accountName}.blob.core.windows.net${this.sasToken}`
        )
      } else if (this.accountName) {
        const { DefaultAzureCredential } = await import('@azure/identity')
        const credential = new DefaultAzureCredential()
        blobServiceClient = new BlobServiceClient(
          `https://${this.accountName}.blob.core.windows.net`,
          credential
        )
      } else {
        throw new Error('Cannot get lifecycle policy without valid authentication')
      }

      // Get service properties
      const serviceProperties = await blobServiceClient.getProperties()

      if (!serviceProperties.lifecyclePolicy || !serviceProperties.lifecyclePolicy.rules) {
        this.logger.info('No lifecycle policy configured')
        return null
      }

      this.logger.info(`Found lifecycle policy with ${serviceProperties.lifecyclePolicy.rules.length} rules`)

      return serviceProperties.lifecyclePolicy
    } catch (error: any) {
      this.logger.error('Failed to get lifecycle policy:', error)
      throw new Error(`Failed to get lifecycle policy: ${error.message || error}`)
    }
  }

  /**
   * Remove the lifecycle management policy
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

    if (!this.accountName) {
      throw new Error('Lifecycle policies require accountName to be configured')
    }

    try {
      this.logger.info('Removing lifecycle policy')

      const { BlobServiceClient } = await import('@azure/storage-blob')

      // Get blob service client
      let blobServiceClient: any
      if (this.connectionString) {
        blobServiceClient = BlobServiceClient.fromConnectionString(this.connectionString)
      } else if (this.accountName && this.accountKey) {
        const { StorageSharedKeyCredential } = await import('@azure/storage-blob')
        const credential = new StorageSharedKeyCredential(this.accountName, this.accountKey)
        blobServiceClient = new BlobServiceClient(
          `https://${this.accountName}.blob.core.windows.net`,
          credential
        )
      } else if (this.accountName && this.sasToken) {
        blobServiceClient = new BlobServiceClient(
          `https://${this.accountName}.blob.core.windows.net${this.sasToken}`
        )
      } else if (this.accountName) {
        const { DefaultAzureCredential } = await import('@azure/identity')
        const credential = new DefaultAzureCredential()
        blobServiceClient = new BlobServiceClient(
          `https://${this.accountName}.blob.core.windows.net`,
          credential
        )
      } else {
        throw new Error('Cannot remove lifecycle policy without valid authentication')
      }

      // Get service properties
      const serviceProperties = await blobServiceClient.getProperties()

      // Set properties without lifecycle policy (removes it)
      await blobServiceClient.setProperties({
        ...serviceProperties,
        blobAnalyticsLogging: serviceProperties.blobAnalyticsLogging,
        hourMetrics: serviceProperties.hourMetrics,
        minuteMetrics: serviceProperties.minuteMetrics,
        cors: serviceProperties.cors,
        deleteRetentionPolicy: serviceProperties.deleteRetentionPolicy,
        staticWebsite: serviceProperties.staticWebsite,
        // Remove lifecycle policy by not including it
        lifecyclePolicy: undefined
      })

      this.logger.info('Successfully removed lifecycle policy')
    } catch (error: any) {
      this.logger.error('Failed to remove lifecycle policy:', error)
      throw new Error(`Failed to remove lifecycle policy: ${error.message || error}`)
    }
  }
}
