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
 * v4.0.0: Fully compatible with metadata/vector separation architecture
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
import { getGlobalBackpressure } from '../../utils/adaptiveBackpressure.js'
import { getWriteBuffer, WriteBuffer } from '../../utils/writeBuffer.js'
import { getCoalescer, RequestCoalescer } from '../../utils/requestCoalescer.js'
import { getShardIdFromUuid, getAllShardIds, getShardIdByIndex, TOTAL_SHARDS } from '../sharding.js'

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

  // High-volume mode detection
  private highVolumeMode = false
  private lastVolumeCheck = 0
  private volumeCheckInterval = 1000  // Check every second
  private forceHighVolumeMode = false  // Environment variable override

  // Multi-level cache manager for efficient data access
  private nounCacheManager: CacheManager<HNSWNode>
  private verbCacheManager: CacheManager<Edge>

  // Module logger
  private logger = createModuleLogger('AzureBlobStorage')

  /**
   * Initialize the storage adapter
   * @param options Configuration options for Azure Blob Storage
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
    readOnly?: boolean
  }) {
    super()
    this.containerName = options.containerName
    this.connectionString = options.connectionString
    this.accountName = options.accountName
    this.accountKey = options.accountKey
    this.sasToken = options.sasToken
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
      // Import Azure Storage SDK only when needed
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

      // Get reference to the container
      this.containerClient = this.blobServiceClient.getContainerClient(this.containerName)

      // Create container if it doesn't exist
      const exists = await this.containerClient.exists()
      if (!exists) {
        await this.containerClient.create()
        prodLog.info(`✅ Created Azure container: ${this.containerName}`)
      } else {
        prodLog.info(`✅ Connected to Azure container: ${this.containerName}`)
      }

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

      // Initialize counts from storage
      await this.initializeCounts()

      // Clear any stale cache entries from previous runs
      prodLog.info('🧹 Clearing cache from previous run to prevent cache poisoning')
      this.nounCacheManager.clear()
      this.verbCacheManager.clear()
      prodLog.info('✅ Cache cleared - starting fresh')

      this.isInitialized = true
    } catch (error) {
      this.logger.error('Failed to initialize Azure Blob Storage:', error)
      throw new Error(`Failed to initialize Azure Blob Storage: ${error}`)
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

  /**
   * Delete a noun from storage (internal implementation)
   */
  protected async deleteNoun_internal(id: string): Promise<void> {
    await this.ensureInitialized()

    const requestId = await this.applyBackpressure()

    try {
      this.logger.trace(`Deleting noun ${id}`)

      // Get the Azure blob name
      const blobName = this.getNounKey(id)

      // Delete from Azure
      const blockBlobClient = this.containerClient!.getBlockBlobClient(blobName)
      await blockBlobClient.delete()

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

      if (error.statusCode === 404 || error.code === 'BlobNotFound') {
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
   * Write an object to a specific path in Azure
   * Primitive operation required by base class
   * @protected
   */
  protected async writeObjectToPath(path: string, data: any): Promise<void> {
    await this.ensureInitialized()

    try {
      this.logger.trace(`Writing object to path: ${path}`)

      const blockBlobClient = this.containerClient!.getBlockBlobClient(path)
      const content = JSON.stringify(data, null, 2)
      await blockBlobClient.upload(content, content.length, {
        blobHTTPHeaders: { blobContentType: 'application/json' }
      })

      this.logger.trace(`Object written successfully to ${path}`)
    } catch (error) {
      this.logger.error(`Failed to write object to ${path}:`, error)
      throw new Error(`Failed to write object to ${path}: ${error}`)
    }
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
   * @protected
   */
  protected async deleteObjectFromPath(path: string): Promise<void> {
    await this.ensureInitialized()

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

        // CORE RELATIONAL DATA (v4.0.0)
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

  /**
   * Delete a verb from storage (internal implementation)
   */
  protected async deleteVerb_internal(id: string): Promise<void> {
    await this.ensureInitialized()

    const requestId = await this.applyBackpressure()

    try {
      this.logger.trace(`Deleting verb ${id}`)

      // Get the Azure blob name
      const blobName = this.getVerbKey(id)

      // Delete from Azure
      const blockBlobClient = this.containerClient!.getBlockBlobClient(blobName)
      await blockBlobClient.delete()

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

      if (error.statusCode === 404 || error.code === 'BlobNotFound') {
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

    // Simplified implementation for Azure (can be optimized similar to GCS)
    const items: HNSWNounWithMetadata[] = []
    const iterator = this.containerClient!.listBlobsFlat({ prefix: this.nounPrefix })

    let count = 0
    for await (const blob of iterator) {
      if (count >= limit) break
      if (!blob.name || !blob.name.endsWith('.json')) continue

      // Extract UUID from blob name
      const parts = blob.name.split('/')
      const fileName = parts[parts.length - 1]
      const id = fileName.replace('.json', '')

      const node = await this.getNode(id)
      if (!node) continue

      // FIX v4.7.4: Don't skip nouns without metadata - metadata is optional in v4.0.0
      const metadata = await this.getNounMetadata(id)

      // Apply filters if provided
      if (options.filter) {
        if (options.filter.nounType) {
          const nounTypes = Array.isArray(options.filter.nounType)
            ? options.filter.nounType
            : [options.filter.nounType]

          const nounType = (metadata as any).type || (metadata as any).noun
          if (!nounType || !nounTypes.includes(nounType)) {
            continue
          }
        }
      }

      // v4.8.0: Extract standard fields from metadata to top-level
      const metadataObj = (metadata || {}) as NounMetadata
      const { noun: nounType, createdAt, updatedAt, confidence, weight, service, data, createdBy, ...customMetadata } = metadataObj

      items.push({
        id: node.id,
        vector: node.vector,
        connections: node.connections,
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
      })

      count++
    }

    return {
      items,
      totalCount: this.totalNounCount,
      hasMore: false,
      nextCursor: undefined
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
    // Simplified: scan all verbs and filter
    const items: HNSWVerbWithMetadata[] = []
    const iterator = this.containerClient!.listBlobsFlat({ prefix: this.verbPrefix })

    for await (const blob of iterator) {
      if (!blob.name || !blob.name.endsWith('.json')) continue

      const parts = blob.name.split('/')
      const fileName = parts[parts.length - 1]
      const id = fileName.replace('.json', '')

      const verb = await this.getEdge(id)
      if (!verb || verb.sourceId !== sourceId) continue

      const metadata = await this.getVerbMetadata(id)
      // v4.8.0: Extract standard fields from metadata to top-level
      const metadataObj = (metadata || {}) as VerbMetadata
      const { createdAt, updatedAt, confidence, weight, service, data, createdBy, ...customMetadata } = metadataObj

      items.push({
        id: verb.id,
        vector: verb.vector,
        connections: verb.connections,
        verb: verb.verb,
        sourceId: verb.sourceId,
        targetId: verb.targetId,
        createdAt: (createdAt as number) || Date.now(),
        updatedAt: (updatedAt as number) || Date.now(),
        confidence: confidence as number | undefined,
        weight: weight as number | undefined,
        service: service as string | undefined,
        data: data as Record<string, any> | undefined,
        createdBy,
        metadata: customMetadata
      })
    }

    return items
  }

  /**
   * Get verbs by target ID (internal implementation)
   */
  protected async getVerbsByTarget_internal(targetId: string): Promise<HNSWVerbWithMetadata[]> {
    // Simplified: scan all verbs and filter
    const items: HNSWVerbWithMetadata[] = []
    const iterator = this.containerClient!.listBlobsFlat({ prefix: this.verbPrefix })

    for await (const blob of iterator) {
      if (!blob.name || !blob.name.endsWith('.json')) continue

      const parts = blob.name.split('/')
      const fileName = parts[parts.length - 1]
      const id = fileName.replace('.json', '')

      const verb = await this.getEdge(id)
      if (!verb || verb.targetId !== targetId) continue

      const metadata = await this.getVerbMetadata(id)
      // v4.8.0: Extract standard fields from metadata to top-level
      const metadataObj = (metadata || {}) as VerbMetadata
      const { createdAt, updatedAt, confidence, weight, service, data, createdBy, ...customMetadata } = metadataObj

      items.push({
        id: verb.id,
        vector: verb.vector,
        connections: verb.connections,
        verb: verb.verb,
        sourceId: verb.sourceId,
        targetId: verb.targetId,
        createdAt: (createdAt as number) || Date.now(),
        updatedAt: (updatedAt as number) || Date.now(),
        confidence: confidence as number | undefined,
        weight: weight as number | undefined,
        service: service as string | undefined,
        data: data as Record<string, any> | undefined,
        createdBy,
        metadata: customMetadata
      })
    }

    return items
  }

  /**
   * Get verbs by type (internal implementation)
   */
  protected async getVerbsByType_internal(type: string): Promise<HNSWVerbWithMetadata[]> {
    // Simplified: scan all verbs and filter
    const items: HNSWVerbWithMetadata[] = []
    const iterator = this.containerClient!.listBlobsFlat({ prefix: this.verbPrefix })

    for await (const blob of iterator) {
      if (!blob.name || !blob.name.endsWith('.json')) continue

      const parts = blob.name.split('/')
      const fileName = parts[parts.length - 1]
      const id = fileName.replace('.json', '')

      const verb = await this.getEdge(id)
      if (!verb || verb.verb !== type) continue

      const metadata = await this.getVerbMetadata(id)
      // v4.8.0: Extract standard fields from metadata to top-level
      const metadataObj = (metadata || {}) as VerbMetadata
      const { createdAt, updatedAt, confidence, weight, service, data, createdBy, ...customMetadata } = metadataObj

      items.push({
        id: verb.id,
        vector: verb.vector,
        connections: verb.connections,
        verb: verb.verb,
        sourceId: verb.sourceId,
        targetId: verb.targetId,
        createdAt: (createdAt as number) || Date.now(),
        updatedAt: (updatedAt as number) || Date.now(),
        confidence: confidence as number | undefined,
        weight: weight as number | undefined,
        service: service as string | undefined,
        data: data as Record<string, any> | undefined,
        createdBy,
        metadata: customMetadata
      })
    }

    return items
  }

  /**
   * Clear all data from storage
   */
  public async clear(): Promise<void> {
    await this.ensureInitialized()

    try {
      this.logger.info('🧹 Clearing all data from Azure container...')

      // Delete all blobs in container
      for await (const blob of this.containerClient!.listBlobsFlat()) {
        if (blob.name) {
          const blockBlobClient = this.containerClient!.getBlockBlobClient(blob.name)
          await blockBlobClient.delete()
        }
      }

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
   */
  public async getNounVector(id: string): Promise<number[] | null> {
    await this.ensureInitialized()
    const noun = await this.getNode(id)
    return noun ? noun.vector : null
  }

  /**
   * Save HNSW graph data for a noun
   */
  public async saveHNSWData(nounId: string, hnswData: {
    level: number
    connections: Record<string, string[]>
  }): Promise<void> {
    await this.ensureInitialized()

    // CRITICAL FIX (v4.7.3): Must preserve existing node data (id, vector) when updating HNSW metadata
    // Previous implementation overwrote the entire file, destroying vector data
    // Now we READ the existing node, UPDATE only connections/level, then WRITE back the complete node

    // CRITICAL FIX (v4.10.1): Optimistic locking with ETags to prevent race conditions
    // Uses Azure Blob ETags with ifMatch preconditions - retries with exponential backoff on conflicts
    // Prevents data corruption when multiple entities connect to same neighbor simultaneously

    const shard = getShardIdFromUuid(nounId)
    const key = `entities/nouns/hnsw/${shard}/${nounId}.json`
    const blockBlobClient = this.containerClient!.getBlockBlobClient(key)

    const maxRetries = 5
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        // Get current ETag and data
        let currentETag: string | undefined
        let existingNode: any = {}

        try {
          const downloadResponse = await blockBlobClient.download(0)
          const existingData = await this.streamToBuffer(downloadResponse.readableStreamBody!)
          existingNode = JSON.parse(existingData.toString())
          currentETag = downloadResponse.etag
        } catch (error: any) {
          // File doesn't exist yet - will create new
          if (error.statusCode !== 404 && error.code !== 'BlobNotFound') {
            throw error
          }
        }

        // Preserve id and vector, update only HNSW graph metadata
        const updatedNode = {
          ...existingNode,  // Preserve all existing fields (id, vector, etc.)
          level: hnswData.level,
          connections: hnswData.connections
        }

        const content = JSON.stringify(updatedNode, null, 2)

        // ATOMIC WRITE: Use ETag precondition
        // If currentETag exists, only write if ETag matches (no concurrent modification)
        // If no ETag, only write if blob doesn't exist (ifNoneMatch: *)
        await blockBlobClient.upload(content, content.length, {
          blobHTTPHeaders: { blobContentType: 'application/json' },
          conditions: currentETag
            ? { ifMatch: currentETag }
            : { ifNoneMatch: '*' } // Only create if doesn't exist
        })

        // Success! Exit retry loop
        return
      } catch (error: any) {
        // Precondition failed - concurrent modification detected
        if (error.statusCode === 412 || error.code === 'ConditionNotMet') {
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
   */
  public async getHNSWData(nounId: string): Promise<{
    level: number
    connections: Record<string, string[]>
  } | null> {
    await this.ensureInitialized()

    try {
      const shard = getShardIdFromUuid(nounId)
      const key = `entities/nouns/hnsw/${shard}/${nounId}.json`

      const blockBlobClient = this.containerClient!.getBlockBlobClient(key)
      const downloadResponse = await blockBlobClient.download(0)
      const downloaded = await this.streamToBuffer(downloadResponse.readableStreamBody!)

      return JSON.parse(downloaded.toString())
    } catch (error: any) {
      if (error.statusCode === 404 || error.code === 'BlobNotFound') {
        return null
      }

      this.logger.error(`Failed to get HNSW data for ${nounId}:`, error)
      throw new Error(`Failed to get HNSW data for ${nounId}: ${error}`)
    }
  }

  /**
   * Save HNSW system data (entry point, max level)
   *
   * CRITICAL FIX (v4.10.1): Optimistic locking with ETags to prevent race conditions
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
      if (error.statusCode === 404 || error.code === 'BlobNotFound') {
        return null
      }

      this.logger.error('Failed to get HNSW system data:', error)
      throw new Error(`Failed to get HNSW system data: ${error}`)
    }
  }

  /**
   * Set the access tier for a specific blob (v4.0.0 cost optimization)
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
   * Set access tier for multiple blobs in batch (v4.0.0 cost optimization)
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
   * Set lifecycle management policy for automatic tier transitions and deletions (v4.0.0)
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
