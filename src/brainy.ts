/**
 * 🧠 Brainy 3.0 - The Future of Neural Databases
 *
 * Beautiful, Professional, Planet-Scale, Fun to Use
 * NO STUBS, NO MOCKS, REAL IMPLEMENTATION
 */

import { v4 as uuidv4 } from './universal/uuid.js'
import { HNSWIndex } from './hnsw/hnswIndex.js'
// TypeAwareHNSWIndex removed from default path — single unified HNSWIndex is faster
// for the 99% of queries that don't filter by type (avoids searching 42 separate graphs)
import { createStorage } from './storage/storageFactory.js'
import { BaseStorage } from './storage/baseStorage.js'
import { StorageAdapter, Vector, DistanceFunction, EmbeddingFunction, GraphVerb } from './coreTypes.js'
import {
  defaultEmbeddingFunction,
  cosineDistance,
  getBrainyVersion
} from './utils/index.js'
import { embeddingManager } from './embeddings/EmbeddingManager.js'
import { matchesMetadataFilter } from './utils/metadataFilter.js'
import { ImprovedNeuralAPI } from './neural/improvedNeuralAPI.js'
import { NaturalLanguageProcessor } from './neural/naturalLanguageProcessor.js'
import { NeuralEntityExtractor, ExtractedEntity } from './neural/entityExtractor.js'
import { TripleIntelligenceSystem } from './triple/TripleIntelligenceSystem.js'
import { VirtualFileSystem } from './vfs/VirtualFileSystem.js'
import { VersioningAPI } from './versioning/VersioningAPI.js'
import { MetadataIndexManager } from './utils/metadataIndex.js'
import { detectContentType, extractForHighlighting } from './utils/contentExtractor.js'
import { GraphAdjacencyIndex } from './graph/graphAdjacencyIndex.js'
import { CommitBuilder } from './storage/cow/CommitObject.js'
import { BlobStorage } from './storage/cow/BlobStorage.js'
import { NULL_HASH } from './storage/cow/constants.js'
import { createPipeline } from './streaming/pipeline.js'
import { configureLogger, LogLevel } from './utils/logger.js'
import { setGlobalCache } from './utils/unifiedCache.js'
import type { UnifiedCache } from './utils/unifiedCache.js'
import { PluginRegistry } from './plugin.js'
import type { BrainyPlugin, BrainyPluginContext } from './plugin.js'
import { TransactionManager } from './transaction/TransactionManager.js'
import {
  ValidationConfig,
  validateAddParams,
  validateUpdateParams,
  validateRelateParams,
  validateFindParams,
  recordQueryPerformance
} from './utils/paramValidation.js'
import {
  SaveNounMetadataOperation,
  SaveNounOperation,
  AddToHNSWOperation,
  AddToMetadataIndexOperation,
  SaveVerbMetadataOperation,
  SaveVerbOperation,
  AddToGraphIndexOperation,
  RemoveFromHNSWOperation,
  RemoveFromMetadataIndexOperation,
  RemoveFromGraphIndexOperation,
  UpdateNounMetadataOperation,
  DeleteNounMetadataOperation,
  DeleteVerbMetadataOperation
} from './transaction/operations/index.js'
import {
  DistributedCoordinator,
  ShardManager,
  CacheSync,
  ReadWriteSeparation
} from './distributed/index.js'
import {
  Entity,
  Relation,
  Result,
  AddParams,
  UpdateParams,
  RelateParams,
  FindParams,
  SimilarParams,
  GetRelationsParams,
  GetOptions,
  AddManyParams,
  DeleteManyParams,
  RelateManyParams,
  BatchResult,
  BrainyConfig,
  ScoreExplanation
} from './types/brainy.types.js'
import { NounType, VerbType } from './types/graphTypes.js'
import { BrainyInterface } from './types/brainyInterface.js'
import type { IntegrationHub } from './integrations/core/IntegrationHub.js'

/**
 * Stopwords for semantic highlighting
 * These common words are skipped when highlighting individual words
 * to focus on meaningful content words.
 */
const STOPWORDS = new Set([
  'a', 'an', 'the', 'is', 'are', 'was', 'were', 'be', 'been',
  'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should',
  'may', 'might', 'must', 'shall', 'can', 'to', 'of', 'in', 'for', 'on', 'with', 'at',
  'by', 'from', 'as', 'into', 'through', 'during', 'before', 'after', 'above', 'below',
  'between', 'under', 'again', 'further', 'then', 'once', 'here', 'there', 'when',
  'where', 'why', 'how', 'all', 'each', 'few', 'more', 'most', 'other', 'some', 'such',
  'no', 'nor', 'not', 'only', 'own', 'same', 'so', 'than', 'too', 'very', 'just',
  'and', 'but', 'or', 'if', 'because', 'until', 'while', 'although', 'though',
  'this', 'that', 'these', 'those', 'it', 'its', 'i', 'me', 'my', 'you', 'your',
  'he', 'him', 'his', 'she', 'her', 'we', 'us', 'our', 'they', 'them', 'their',
  'what', 'which', 'who', 'whom', 'whose', 'am'
])

/**
 * Result type for brain.diagnostics()
 */
export interface DiagnosticsResult {
  version: string
  plugins: { active: string[], count: number }
  providers: Record<string, { source: 'plugin' | 'default' }>
  indexes: {
    hnsw: { size: number, type: string }
    metadata: { type: string, initialized: boolean }
    graph: { type: string, initialized: boolean, wiredToStorage: boolean }
  }
}

/**
 * The main Brainy class - Clean, Beautiful, Powerful
 * REAL IMPLEMENTATION - No stubs, no mocks
 *
 * Implements BrainyInterface to ensure consistency across integrations
 */
export class Brainy<T = any> implements BrainyInterface<T> {
  // Static shutdown hook tracking (global, not per-instance)
  private static shutdownHooksRegisteredGlobally = false
  private static instances: Brainy[] = []

  // Core components
  private index!: HNSWIndex
  private storage!: BaseStorage
  private metadataIndex!: MetadataIndexManager
  private graphIndex!: GraphAdjacencyIndex
  private transactionManager: TransactionManager
  private embedder: EmbeddingFunction
  private distance: DistanceFunction
  private config: Required<BrainyConfig>

  // Distributed components (optional)
  private coordinator?: DistributedCoordinator
  private shardManager?: ShardManager
  private cacheSync?: CacheSync
  private readWriteSeparation?: ReadWriteSeparation

  // Silent mode state
  private originalConsole?: {
    log: typeof console.log
    info: typeof console.info
    warn: typeof console.warn
    error: typeof console.error
  }

  // Plugin system
  private pluginRegistry = new PluginRegistry()

  // Sub-APIs (lazy-loaded)
  private _neural?: ImprovedNeuralAPI
  private _nlp?: NaturalLanguageProcessor
  private _extractor?: NeuralEntityExtractor
  private _tripleIntelligence?: TripleIntelligenceSystem
  private _versions?: VersioningAPI
  private _vfs?: VirtualFileSystem
  private _vfsInitialized = false  // Track VFS init completion separately
  private _hub?: IntegrationHub     // Integration Hub for external tools

  // State
  private initialized = false
  private dimensions?: number

  // Ready Promise state (Unified readiness API)
  // Allows consumers to await brain.ready for initialization completion
  private _readyPromise: Promise<void> | null = null
  private _readyResolve: (() => void) | null = null
  private _readyReject: ((error: Error) => void) | null = null

  // Lazy rebuild state (Production-scale lazy loading)
  // Prevents race conditions when multiple queries trigger rebuild simultaneously
  private lazyRebuildInProgress = false
  private lazyRebuildCompleted = false
  private lazyRebuildPromise: Promise<void> | null = null

  constructor(config?: BrainyConfig) {
    // Normalize configuration with defaults
    this.config = this.normalizeConfig(config)

    // Configure memory limits
    // This must happen early, before any validation occurs
    if (this.config.maxQueryLimit !== undefined || this.config.reservedQueryMemory !== undefined) {
      ValidationConfig.reconfigure({
        maxQueryLimit: this.config.maxQueryLimit,
        reservedQueryMemory: this.config.reservedQueryMemory
      })
    }

    // Setup core components
    this.distance = cosineDistance
    this.embedder = this.setupEmbedder()
    this.transactionManager = new TransactionManager()

    // Setup distributed components if enabled
    if (this.config.distributed?.enabled) {
      this.setupDistributedComponents()
    }

    // Initialize ready Promise
    // This allows consumers to await brain.ready before using the database
    this._readyPromise = new Promise<void>((resolve, reject) => {
      this._readyResolve = resolve
      this._readyReject = reject
    })

    // Track this instance for shutdown hooks
    Brainy.instances.push(this)

    // Index and storage are initialized in init() because they may need each other
  }

  /**
   * Initialize Brainy - MUST be called before use
   * @param overrides Optional configuration overrides for init
   */
  async init(overrides?: Partial<BrainyConfig & { dimensions?: number }>): Promise<void> {
    if (this.initialized) {
      return
    }

    // Apply any init-time configuration overrides
    if (overrides) {
      const { dimensions, ...configOverrides } = overrides
      this.config = {
        ...this.config,
        ...configOverrides,
        storage: { ...this.config.storage, ...configOverrides.storage },
        index: { ...this.config.index, ...configOverrides.index },
        verbose: configOverrides.verbose ?? this.config.verbose,
        silent: configOverrides.silent ?? this.config.silent
      }

      // Set dimensions if provided
      if (dimensions) {
        this.dimensions = dimensions
      }
    }

    // Configure logging based on config options
    if (this.config.silent) {
      // Store original console methods for restoration
      this.originalConsole = {
        log: console.log,
        info: console.info,
        warn: console.warn,
        error: console.error
      }

      // Override all console methods to completely silence output
      console.log = () => {}
      console.info = () => {}
      console.warn = () => {}
      console.error = () => {}

      // Also configure logger for silent mode
      configureLogger({ level: LogLevel.SILENT })  // Suppress all logs
    } else if (this.config.verbose) {
      configureLogger({ level: LogLevel.DEBUG })  // Enable verbose logging
    }

    try {
      // Auto-detect and activate plugins BEFORE storage setup
      // so plugin-provided storage factories (e.g., filesystem override from cortex) are available
      await this.loadPlugins()

      // Setup and initialize storage (checks plugin storage factories first)
      this.storage = await this.setupStorage()
      await this.storage.init()

      // Enable COW immediately after storage init
      // This ensures ALL data is stored in branch-scoped paths from the start
      // Lightweight: just sets cowEnabled=true and currentBranch, no RefManager/BlobStorage yet
      if (typeof (this.storage as any).enableCOWLightweight === 'function') {
        (this.storage as any).enableCOWLightweight((this.config.storage as any)?.branch || 'main')
      }

      // Provider: embeddings (reassign embedder if plugin provides one)
      const embeddingProvider = this.pluginRegistry.getProvider<EmbeddingFunction>('embeddings')
      if (embeddingProvider) {
        this.embedder = embeddingProvider
      }

      // Provider: cache (replace global singleton before any consumer uses it)
      const cacheProvider = this.pluginRegistry.getProvider<UnifiedCache>('cache')
      if (cacheProvider) {
        setGlobalCache(cacheProvider)
      }

      // Provider: roaring bitmaps (native CRoaring replacement for WASM)
      const roaringProvider = this.pluginRegistry.getProvider<any>('roaring')
      if (roaringProvider) {
        const { setRoaringImplementation } = await import('./utils/roaring/index.js')
        setRoaringImplementation(roaringProvider)
      }

      // Provider: msgpack (native replacement for JS @msgpack/msgpack)
      const msgpackProvider = this.pluginRegistry.getProvider<any>('msgpack')
      if (msgpackProvider) {
        const { setMsgpackImplementation } = await import('./graph/lsm/SSTable.js')
        setMsgpackImplementation(msgpackProvider)
      }

      // Provider: distance function (resolve BEFORE setupIndex — index uses this.distance)
      const nativeDistance = this.pluginRegistry.getProvider<DistanceFunction>('distance')
      if (nativeDistance) {
        this.distance = nativeDistance
      }

      // Provider: HNSW index factory (plugin or JS fallback)
      this.index = this.createIndex()

      // Provider: metadata index factory
      const metadataFactory = this.pluginRegistry.getProvider<(storage: StorageAdapter) => any>('metadataIndex')
      if (metadataFactory) {
        this.metadataIndex = metadataFactory(this.storage)
      } else {
        // JS fallback — inject native EntityIdMapper if cortex provides one
        const entityIdMapperFactory = this.pluginRegistry.getProvider<(storage: StorageAdapter) => any>('entityIdMapper')
        this.metadataIndex = new MetadataIndexManager(this.storage, {}, {
          entityIdMapper: entityIdMapperFactory ? entityIdMapperFactory(this.storage) : undefined,
        })
      }

      // Provider: graph index factory
      const graphFactory = this.pluginRegistry.getProvider<(storage: StorageAdapter) => any>('graphIndex')
      if (graphFactory) {
        this.graphIndex = graphFactory(this.storage)
        this.storage.setGraphIndex(this.graphIndex)
        await this.metadataIndex.init()
      } else {
        const [, graphIndex] = await Promise.all([
          this.metadataIndex.init(),
          (this.storage as any).getGraphIndex()
        ])
        this.graphIndex = graphIndex
      }

      // Rebuild indexes if needed for existing data
      await this.rebuildIndexesIfNeeded()

      // Connect distributed components to storage
      await this.connectDistributedStorage()

      // Warm up if configured
      if (this.config.warmup) {
        await this.warmup()
      }

      // Register shutdown hooks for graceful count flushing (once globally)
      if (!Brainy.shutdownHooksRegisteredGlobally) {
        this.registerShutdownHooks()
        Brainy.shutdownHooksRegisteredGlobally = true
      }

      // Initialize COW (BlobStorage) before VFS
      // VFS now requires BlobStorage for unified file storage
      if (typeof (this.storage as any).initializeCOW === 'function') {
        await (this.storage as any).initializeCOW({
          branch: (this.config.storage as any)?.branch || 'main',
          enableCompression: true
        })
      }

      // Log provider summary after all wiring is complete
      // Shows developers exactly what's native vs falling back to JS
      if (this.pluginRegistry.hasActivePlugins() && !this.config.silent) {
        const wellKnownKeys = [
          'metadataIndex', 'graphIndex', 'entityIdMapper', 'cache',
          'hnsw', 'roaring', 'embeddings', 'embedBatch', 'distance', 'msgpack'
        ]
        const native = wellKnownKeys.filter(k => this.pluginRegistry.hasProvider(k))
        const fallback = wellKnownKeys.filter(k => !this.pluginRegistry.hasProvider(k))
        const plugins = this.pluginRegistry.getActivePlugins().join(', ')
        if (fallback.length === 0) {
          console.log(`[brainy] Providers: ${native.length}/${wellKnownKeys.length} native (${plugins})`)
        } else {
          console.log(`[brainy] Providers: ${native.length}/${wellKnownKeys.length} native (${plugins}) | default: ${fallback.join(', ')}`)
        }
      }

      // Mark as initialized BEFORE VFS init
      // VFS.init() needs brain to be marked initialized to call brain methods
      this.initialized = true

      // Initialize VFS: Ensure VFS is ready when accessed as property
      // This eliminates need for separate vfs.init() calls - zero additional complexity
      this._vfs = new VirtualFileSystem(this)
      await this._vfs.init()
      this._vfsInitialized = true  // Mark VFS as fully initialized

      // Eager embedding initialization for cloud deployments
      // When eagerEmbeddings is true, initialize the WASM embedding engine now
      // instead of lazily on first embed() call. This moves the 90-140 second
      // WASM compilation to container startup rather than first request.
      // Recommended for: Cloud Run, Lambda, Fargate, Kubernetes
      if (this.config.eagerEmbeddings && !this.pluginRegistry.hasProvider('embeddings')) {
        console.log('Eager embedding initialization enabled...')
        await embeddingManager.init()
        console.log('Embedding engine ready')
      }

      // Integration Hub initialization
      // Creates the hub when integrations are enabled in config
      // Uses dynamic import for tree-shaking when integrations are disabled
      if (this.config.integrations) {
        const hubConfig = this.config.integrations === true
          ? { enable: 'all' as const }
          : this.config.integrations

        const { IntegrationHub } = await import('./integrations/core/IntegrationHub.js')
        this._hub = await IntegrationHub.create(this, {
          basePath: hubConfig.basePath,
          enable: hubConfig.enable,
          config: hubConfig.config as any  // Type flexibility for user config
        })
      }

      // Resolve ready Promise - consumers awaiting brain.ready will now proceed
      if (this._readyResolve) {
        this._readyResolve()
      }
    } catch (error) {
      // Reject ready Promise - consumers awaiting brain.ready will receive error
      if (this._readyReject) {
        this._readyReject(error instanceof Error ? error : new Error(String(error)))
      }
      throw new Error(`Failed to initialize Brainy: ${error}`)
    }
  }

  /**
   * Register shutdown hooks for graceful count flushing
   *
   * Ensures pending count batches are persisted before container shutdown.
   * Critical for Cloud Run, Fargate, Lambda, and other containerized deployments.
   *
   * Handles:
   * - SIGTERM: Graceful termination (Cloud Run, Fargate, Lambda)
   * - SIGINT: Ctrl+C (development/local testing)
   * - beforeExit: Node.js cleanup hook (fallback)
   *
   * NOTE: Registers globally (once for all instances) to avoid MaxListenersExceededWarning
   */
  private registerShutdownHooks(): void {
    const flushOnShutdown = async () => {
      console.log('Shutdown signal received - flushing pending data...')
      try {
        let flushedCount = 0
        for (const instance of Brainy.instances) {
          if (instance.initialized) {
            // Flush all buffered data, then close to release resources (timers, handles)
            await Promise.all([
              (async () => {
                if (instance.storage && typeof (instance.storage as any).flushCounts === 'function') {
                  await (instance.storage as any).flushCounts()
                }
              })(),
              (async () => {
                if (instance.metadataIndex && typeof instance.metadataIndex.flush === 'function') {
                  await instance.metadataIndex.flush()
                }
              })(),
              (async () => {
                if (instance.graphIndex && typeof instance.graphIndex.flush === 'function') {
                  await instance.graphIndex.flush()
                }
              })(),
              (async () => {
                if (instance.index && typeof (instance.index as any).flush === 'function') {
                  await (instance.index as any).flush()
                }
              })()
            ])
            // Close components to stop timers that would prevent clean process exit
            await Promise.all([
              (async () => {
                if (instance.graphIndex && typeof instance.graphIndex.close === 'function') {
                  await instance.graphIndex.close()
                }
              })(),
              (async () => {
                if (instance.index && typeof (instance.index as any).close === 'function') {
                  await (instance.index as any).close()
                }
              })(),
              (async () => {
                if (instance.metadataIndex && typeof (instance.metadataIndex as any).close === 'function') {
                  await (instance.metadataIndex as any).close()
                }
              })(),
            ])
            flushedCount++
          }
        }
        if (flushedCount > 0) {
          console.log(`Flushed successfully (${flushedCount} instance${flushedCount > 1 ? 's' : ''})`)
        }
      } catch (error) {
        console.error('Failed to flush on shutdown:', error)
      }
    }

    // Graceful shutdown signals (registered once globally)
    process.on('SIGTERM', async () => {
      await flushOnShutdown()
      process.exit(0)
    })

    process.on('SIGINT', async () => {
      await flushOnShutdown()
      process.exit(0)
    })

    process.on('beforeExit', async () => {
      await flushOnShutdown()
    })
  }

  /**
   * Ensure Brainy is initialized
   */
  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      throw new Error('Brainy not initialized. Call init() first.')
    }
  }

  /**
   * Check if Brainy is initialized
   */
  get isInitialized(): boolean {
    return this.initialized
  }

  /**
   * Promise that resolves when Brainy is fully initialized and ready to use
   *
   * This Promise is created in the constructor and resolves when init() completes.
   * It can be awaited multiple times safely - the result is cached.
   *
   * This enables reliable readiness detection for consumers,
   * especially in cloud environments where progressive initialization means
   * init() returns quickly but background tasks may still be running.
   *
   * @example Waiting for readiness before API calls
   * ```typescript
   * const brain = new Brainy({ storage: { type: 'gcs', ... } })
   * brain.init() // Fire and forget
   *
   * // Elsewhere in your code (e.g., API handler)
   * await brain.ready
   * const results = await brain.find({ query: 'test' })
   * ```
   *
   * @example Server startup pattern
   * ```typescript
   * const brain = new Brainy()
   * await brain.init()
   *
   * // For health check endpoint
   * app.get('/health', async (req, res) => {
   *   try {
   *     await brain.ready
   *     res.json({ status: 'ready' })
   *   } catch (error) {
   *     res.status(503).json({ status: 'initializing', error: error.message })
   *   }
   * })
   * ```
   *
   * @returns Promise that resolves when init() completes, or rejects if init fails
   */
  get ready(): Promise<void> {
    if (!this._readyPromise) {
      // This should never happen if constructor ran, but handle gracefully
      return Promise.reject(new Error('Brainy not constructed properly'))
    }
    return this._readyPromise
  }

  /**
   * Check if Brainy is fully initialized including all background tasks
   *
   * This checks both:
   * 1. Basic initialization complete (init() returned)
   * 2. Storage background tasks complete (bucket validation, count sync)
   *
   * Useful for determining if all lazy/progressive initialization is done.
   *
   * @returns true if all initialization including background tasks is complete
   *
   * @example Health check with background status
   * ```typescript
   * app.get('/health', (req, res) => {
   *   res.json({
   *     ready: brain.isInitialized,
   *     fullyInitialized: brain.isFullyInitialized(),
   *     status: brain.isFullyInitialized() ? 'ready' : 'warming'
   *   })
   * })
   * ```
   */
  isFullyInitialized(): boolean {
    if (!this.initialized) return false

    // Check if storage has background init methods (cloud storage adapters)
    const storage = this.storage as any
    if (typeof storage?.isBackgroundInitComplete === 'function') {
      return storage.isBackgroundInitComplete()
    }

    // Non-cloud storage adapters are fully initialized after init()
    return true
  }

  /**
   * Wait for all background initialization tasks to complete
   *
   * For cloud storage adapters with progressive initialization,
   * this waits for:
   * - Bucket/container validation
   * - Count synchronization
   * - Any other background tasks
   *
   * For non-cloud storage, this resolves immediately.
   *
   * **Use Case**: Call this when you need guaranteed consistency, such as:
   * - Before running batch operations
   * - Before reporting full system health
   * - When transitioning from "initializing" to "ready" status
   *
   * @returns Promise that resolves when all background tasks complete
   *
   * @example Ensuring full initialization
   * ```typescript
   * const brain = new Brainy({ storage: { type: 'gcs', ... } })
   * await brain.init()  // Fast return in cloud (<200ms)
   *
   * // Optional: wait for background tasks if needed
   * await brain.awaitBackgroundInit()
   * console.log('All background tasks complete')
   * ```
   */
  async awaitBackgroundInit(): Promise<void> {
    // Must be initialized first
    await this.ready

    // Check if storage has background init methods (cloud storage adapters)
    const storage = this.storage as any
    if (typeof storage?.awaitBackgroundInit === 'function') {
      await storage.awaitBackgroundInit()
    }

    // Non-cloud storage: no background init to wait for
  }

  // ============= CORE CRUD OPERATIONS =============

  /**
   * Add an entity to the database
   *
   * @param params - Parameters for adding the entity
   * @param params.data - Content to embed and store (required)
   * @param params.type - NounType classification (required)
   * @param params.metadata - Custom metadata object
   * @param params.id - Custom ID (auto-generated if not provided)
   * @param params.vector - Pre-computed embedding vector
   * @param params.service - Service name for multi-tenancy
   * @param params.confidence - Type classification confidence (0-1)
   * @param params.weight - Entity importance/salience (0-1)
   * @returns Promise that resolves to the entity ID
   *
   * @example Basic entity creation
   * ```typescript
   * const id = await brain.add({
   *   data: "John Smith is a software engineer",
   *   type: NounType.Person,
   *   metadata: { role: "engineer", team: "backend" }
   * })
   * console.log(`Created entity: ${id}`)
   * ```
   *
   * @example Adding with confidence and weight
   * ```typescript
   * const id = await brain.add({
   *   data: "Machine learning model for sentiment analysis",
   *   type: NounType.Concept,
   *   metadata: { accuracy: 0.95, version: "2.1" },
   *   confidence: 0.92,  // High confidence in Concept classification
   *   weight: 0.85       // High importance entity
   * })
   * ```
   *
   * @example Adding with custom ID
   * ```typescript
   * const customId = await brain.add({
   *   id: "user-12345",
   *   data: "Important document content",
   *   type: NounType.Document,
   *   metadata: { priority: "high", department: "legal" }
   * })
   * ```
   *
   * @example Using pre-computed vector (optimization)
   * ```typescript
   * const vector = await brain.embed("Optimized content")
   * const id = await brain.add({
   *   data: "Optimized content",
   *   type: NounType.Document,
   *   vector: vector,  // Skip re-embedding
   *   metadata: { optimized: true }
   * })
   * ```
   *
   * @example Multi-tenant usage
   * ```typescript
   * const id = await brain.add({
   *   data: "Customer feedback",
   *   type: NounType.Message,
   *   service: "customer-portal",  // Multi-tenancy
   *   metadata: { rating: 5, verified: true }
   * })
   * ```
   */
  async add(params: AddParams<T>): Promise<string> {
    await this.ensureInitialized()

    // Zero-config validation (static import for performance)
    validateAddParams(params)

    // Generate ID if not provided
    const id = params.id || uuidv4()

    // Get or compute vector
    const vector = params.vector || (await this.embed(params.data))

    // Ensure dimensions are set
    if (!this.dimensions) {
      this.dimensions = vector.length
    } else if (vector.length !== this.dimensions) {
      throw new Error(
        `Vector dimension mismatch: expected ${this.dimensions}, got ${vector.length}`
      )
    }

    // Prepare metadata for storage (backward compat format - unchanged)
      const storageMetadata = {
        ...(typeof params.data === 'object' && params.data !== null && !Array.isArray(params.data) ? params.data : {}),
        ...params.metadata,
        data: params.data, // Store the raw data in metadata
        noun: params.type,
        service: params.service,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        // Preserve confidence and weight if provided
        ...(params.confidence !== undefined && { confidence: params.confidence }),
        ...(params.weight !== undefined && { weight: params.weight }),
        ...(params.createdBy && { createdBy: params.createdBy })
      }

      // Build entity structure for indexing (NEW - with top-level fields)
      const entityForIndexing = {
        id,
        vector,
        connections: new Map(),
        level: 0,
        type: params.type,
        confidence: params.confidence,
        weight: params.weight,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        service: params.service,
        data: params.data,
        createdBy: params.createdBy,
        // Only custom fields in metadata
        metadata: params.metadata || {}
      }

      // Execute atomically with transaction system
      // All operations succeed or all rollback - prevents partial failures
      await this.transactionManager.executeTransaction(async (tx) => {
        // Operation 1: Save metadata FIRST (TypeAwareStorage caching)
        // isNew=true: skip pre-read for rollback (entity doesn't exist yet)
        tx.addOperation(
          new SaveNounMetadataOperation(this.storage, id, storageMetadata, true)
        )

        // Operation 2: Save vector data
        // isNew=true: skip pre-read for rollback (entity doesn't exist yet)
        tx.addOperation(
          new SaveNounOperation(this.storage, {
            id,
            vector,
            connections: new Map(),
            level: 0
          }, true)
        )

        // Operation 3: Add to HNSW index (after entity saved)
        tx.addOperation(
          new AddToHNSWOperation(this.index as any, id, vector)
        )

        // Operation 4: Add to metadata index
        tx.addOperation(
          new AddToMetadataIndexOperation(this.metadataIndex, id, entityForIndexing)
        )
      })

      return id
  }

  /**
   * Get an entity by ID
   *
   * @param id - The unique identifier of the entity to retrieve
   * @returns Promise that resolves to the entity if found, null if not found
   *
   * **Entity includes:**
   * - `confidence` - Type classification confidence (0-1) if set
   * - `weight` - Entity importance/salience (0-1) if set
   * - All standard fields: id, type, data, metadata, vector, timestamps
   *
   * @example
   * // Basic entity retrieval
   * const entity = await brainy.get('user-123')
   * if (entity) {
   *   console.log('Found entity:', entity.data)
   *   console.log('Created at:', new Date(entity.createdAt))
   * } else {
   *   console.log('Entity not found')
   * }
   *
   * @example
   * // Accessing confidence and weight
   * const entity = await brainy.get('concept-456')
   * if (entity) {
   *   console.log(`Type: ${entity.type}`)
   *   console.log(`Confidence: ${entity.confidence ?? 'N/A'}`)
   *   console.log(`Weight: ${entity.weight ?? 'N/A'}`)
   * }
   *
   * @example
   * // Working with typed entities
   * interface User {
   *   name: string
   *   email: string
   * }
   *
   * const brainy = new Brainy<User>({ storage: 'filesystem' })
   * const user = await brainy.get('user-456')
   * if (user) {
   *   // TypeScript knows user.metadata is of type User
   *   console.log(`Hello ${user.metadata.name}`)
   * }
   *
   * @example
   * // Safe retrieval with error handling
   * try {
   *   const entity = await brainy.get('document-789')
   *   if (!entity) {
   *     throw new Error('Document not found')
   *   }
   *
   *   // Process the entity
   *   return {
   *     id: entity.id,
   *     content: entity.data,
   *     type: entity.type,
   *     metadata: entity.metadata
   *   }
   * } catch (error) {
   *   console.error('Failed to retrieve entity:', error)
   *   return null
   * }
   *
   * @example
   * // Batch retrieval pattern
   * const ids = ['doc-1', 'doc-2', 'doc-3']
   * const entities = await Promise.all(
   *   ids.map(id => brainy.get(id))
   * )
   * const foundEntities = entities.filter(entity => entity !== null)
   * console.log(`Found ${foundEntities.length} out of ${ids.length} entities`)
   *
   * @example
   * // Using with async iteration
   * const entityIds = ['user-1', 'user-2', 'user-3']
   *
   * for (const id of entityIds) {
   *   const entity = await brainy.get(id)
   *   if (entity) {
   *     console.log(`Processing ${entity.type}: ${id}`)
   *     // Process entity...
   *   }
   * }
   */
  /**
   * Get an entity by ID
   *
   * **Performance**: Optimized for metadata-only reads by default
   * - **Default (metadata-only)**: 10ms, 300 bytes - 76-81% faster
   * - **Full entity (includeVectors: true)**: 43ms, 6KB - when vectors needed
   *
   * **When to use metadata-only (default)**:
   * - VFS operations (readFile, stat, readdir) - 100% of cases
   * - Existence checks: `if (await brain.get(id))`
   * - Metadata inspection: `entity.metadata`, `entity.data`, `entity.type`
   * - Relationship traversal: `brain.getRelations({ from: id })`
   *
   * **When to include vectors**:
   * - Computing similarity on this specific entity: `brain.similar({ to: entity.vector })`
   * - Manual vector operations: `cosineSimilarity(entity.vector, otherVector)`
   *
   * @param id - Entity ID to retrieve
   * @param options - Retrieval options (includeVectors defaults to false)
   * @returns Entity or null if not found
   *
   * @example
   * ```typescript
   * // ✅ FAST: Metadata-only (default) - 10ms, 300 bytes
   * const entity = await brain.get(id)
   * console.log(entity.data, entity.metadata)  // ✅ Available
   * console.log(entity.vector.length)  // 0 (stub vector)
   *
   * // ✅ FULL: Include vectors when needed - 43ms, 6KB
   * const fullEntity = await brain.get(id, { includeVectors: true })
   * const similarity = cosineSimilarity(fullEntity.vector, otherVector)
   *
   * // ✅ Existence check (metadata-only is perfect)
   * if (await brain.get(id)) {
   *   console.log('Entity exists')
   * }
   *
   * // ✅ VFS automatically benefits (no code changes needed)
   * await vfs.readFile('/file.txt')  // 53ms → 10ms (81% faster)
   * ```
   *
   * @performance
   * - Metadata-only: 76-81% faster, 95% less bandwidth, 87% less memory
   * - Full entity: Same (no regression)
   * - VFS operations: 81% faster with zero code changes
   *
   */
  async get(id: string, options?: GetOptions): Promise<Entity<T> | null> {
    await this.ensureInitialized()

    // Route to metadata-only or full entity based on options
    const includeVectors = options?.includeVectors ?? false  // Default: metadata-only (fast)

    if (includeVectors) {
      // FULL PATH: Load vector + metadata (6KB, 43ms)
      // Used when: Computing similarity on this entity, manual vector operations
      const noun = await this.storage.getNoun(id)
      if (!noun) {
        return null
      }
      return this.convertNounToEntity(noun)
    } else {
      // FAST PATH: Metadata-only (300 bytes, 10ms) - DEFAULT
      // Used when: VFS operations, existence checks, metadata inspection (94% of calls)
      const metadata = await this.storage.getNounMetadata(id)
      if (!metadata) {
        return null
      }
      return this.convertMetadataToEntity(id, metadata)
    }
  }

  /**
   * Batch get multiple entities by IDs (Cloud Storage Optimization)
   *
   * **Performance**: Eliminates N+1 query pattern
   * - Current: N × get() = N × 300ms cloud latency = 3-6 seconds for 10-20 entities
   * - Batched: 1 × batchGet() = 1 × 300ms cloud latency = 0.3 seconds ✨
   *
   * **Use cases:**
   * - VFS tree traversal (get all children at once)
   * - Relationship traversal (get all targets at once)
   * - Import operations (batch existence checks)
   * - Admin tools (fetch multiple entities for listing)
   *
   * @param ids Array of entity IDs to fetch
   * @param options Get options (includeVectors defaults to false for speed)
   * @returns Map of id → entity (only successfully fetched entities included)
   *
   * @example
   * ```typescript
   * // VFS getChildren optimization
   * const childIds = relations.map(r => r.to)
   * const childrenMap = await brain.batchGet(childIds)
   * const children = childIds.map(id => childrenMap.get(id)).filter(Boolean)
   * ```
   */
  async batchGet(ids: string[], options?: GetOptions): Promise<Map<string, Entity<T>>> {
    await this.ensureInitialized()

    const results = new Map<string, Entity<T>>()
    if (ids.length === 0) return results

    const includeVectors = options?.includeVectors ?? false

    if (includeVectors) {
      // FULL PATH optimized with batch vector loading (10x faster on GCS)
      // GCS: 10 entities with vectors = 1×50ms vs 10×50ms = 500ms (10x faster)
      const nounsMap = await this.storage.getNounBatch(ids)

      for (const [id, noun] of nounsMap.entries()) {
        const entity = await this.convertNounToEntity(noun)
        results.set(id, entity)
      }
    } else{
      // FAST PATH: Metadata-only batch (default) - OPTIMIZED
      const metadataMap = await this.storage.getNounMetadataBatch(ids)

      for (const [id, metadata] of metadataMap.entries()) {
        const entity = await this.convertMetadataToEntity(id, metadata)
        results.set(id, entity)
      }
    }

    return results
  }

  /**
   * Create a flattened Result object from entity
   * Flattens commonly-used entity fields to top level for convenience
   */
  private createResult(id: string, score: number, entity: Entity<T>, explanation?: ScoreExplanation): Result<T> {
    return {
      id,
      score,
      // Flatten common entity fields to top level
      type: entity.type,
      metadata: entity.metadata,
      data: entity.data,
      confidence: entity.confidence,
      weight: entity.weight,
      // Preserve full entity for backward compatibility
      entity,
      // Optional score explanation
      ...(explanation && { explanation })
    }
  }

  /**
   * Convert a noun from storage to an entity (SIMPLIFIED!)
   *
   * Dramatically simplified - standard fields moved to top-level
   * - Extracts standard fields from metadata (storage format)
   * - Returns entity with standard fields at top-level (in-memory format)
   * - metadata contains ONLY custom user fields
   */
  private async convertNounToEntity(noun: any): Promise<Entity<T>> {
    // Storage adapters ALREADY extract standard fields to top-level!
    // Just read from top-level fields of HNSWNounWithMetadata

    // Clean structure with standard fields at top-level
    const entity: Entity<T> = {
      id: noun.id,
      vector: noun.vector,
      type: noun.type || NounType.Thing,

      // Standard fields at top-level
      confidence: noun.confidence,
      weight: noun.weight,
      createdAt: noun.createdAt || Date.now(),
      updatedAt: noun.updatedAt || Date.now(),
      service: noun.service,
      data: noun.data,
      createdBy: noun.createdBy,

      // ONLY custom user fields in metadata (already separated by storage adapter)
      metadata: noun.metadata as T
    }

    return entity
  }

  /**
   * Convert metadata-only to entity (FAST PATH!)
   *
   * Used when vectors are NOT needed (94% of brain.get() calls):
   * - VFS operations (readFile, stat, readdir)
   * - Existence checks
   * - Metadata inspection
   * - Relationship traversal
   *
   * Performance: 76-81% faster, 95% less bandwidth, 87% less memory
   * - Metadata-only: 10ms, 300 bytes
   * - Full entity: 43ms, 6KB
   *
   * @param id - Entity ID
   * @param metadata - Metadata from storage.getNounMetadata()
   * @returns Entity with stub vector (Float32Array(0))
   *
   */
  private async convertMetadataToEntity(id: string, metadata: any): Promise<Entity<T>> {
    // Metadata-only entity (no vector loading)
    // This is 76-81% faster for operations that don't need semantic similarity

    // Extract standard fields, rest are custom metadata
    // Same destructuring as baseStorage.getNoun() to ensure consistency
    const { noun, createdAt, updatedAt, confidence, weight, service, data, createdBy, ...customMetadata } = metadata

    const entity: Entity<T> = {
      id,
      vector: [],  // Stub vector (empty array - vectors not loaded for metadata-only)
      type: noun as NounType || NounType.Thing,

      // Standard fields from metadata
      confidence,
      weight,
      createdAt: createdAt || Date.now(),
      updatedAt: updatedAt || Date.now(),
      service,
      data,
      createdBy,

      // Custom user fields (standard fields removed, only custom remain)
      metadata: customMetadata as T
    }

    return entity
  }

  /**
   * Update an entity
   */
  async update(params: UpdateParams<T>): Promise<void> {
    await this.ensureInitialized()

    // Zero-config validation (static import for performance)
    validateUpdateParams(params)

    // Get existing entity with vectors (fix for regression)
      // We need includeVectors: true because:
      // 1. SaveNounOperation requires the vector
      // 2. HNSW reindexing operations need the original vector
      const existing = await this.get(params.id, { includeVectors: true })
      if (!existing) {
        throw new Error(`Entity ${params.id} not found`)
      }

      // Update vector if data changed
      let vector = existing.vector
      const newType = params.type || existing.type
      const needsReindexing = params.data || params.type
      if (params.data) {
        vector = params.vector || (await this.embed(params.data))
      }

      // Always update the noun with new metadata
      const newMetadata = params.merge !== false
        ? { ...existing.metadata, ...params.metadata }
        : params.metadata || existing.metadata

      // Merge data objects if both old and new are objects
      const dataFields = typeof params.data === 'object' && params.data !== null && !Array.isArray(params.data)
        ? params.data
        : {}

      // Prepare updated metadata object with data field
      const updatedMetadata = {
        ...newMetadata,
        ...dataFields,
        data: params.data !== undefined ? params.data : existing.data, // Store data field
        noun: params.type || existing.type,
        service: existing.service,
        createdAt: existing.createdAt,
        updatedAt: Date.now(),
        // Update confidence and weight if provided, otherwise preserve existing
        ...(params.confidence !== undefined && { confidence: params.confidence }),
        ...(params.weight !== undefined && { weight: params.weight }),
        ...(params.confidence === undefined && existing.confidence !== undefined && { confidence: existing.confidence }),
        ...(params.weight === undefined && existing.weight !== undefined && { weight: existing.weight })
      }

      // Build entity structure for metadata index (with top-level fields)
      const entityForIndexing = {
        id: params.id,
        vector,
        connections: new Map(),
        level: 0,
        type: params.type || existing.type,
        confidence: params.confidence !== undefined ? params.confidence : existing.confidence,
        weight: params.weight !== undefined ? params.weight : existing.weight,
        createdAt: existing.createdAt,
        updatedAt: Date.now(),
        service: existing.service,
        data: params.data !== undefined ? params.data : existing.data,
        createdBy: existing.createdBy,
        // Only custom fields in metadata
        metadata: newMetadata
      }

      // Execute atomically with transaction system
      await this.transactionManager.executeTransaction(async (tx) => {
        // Operation 1: Update metadata FIRST (updates type cache)
        tx.addOperation(
          new UpdateNounMetadataOperation(this.storage, params.id, updatedMetadata)
        )

        // Operation 2: Update vector data (will use updated type cache)
        tx.addOperation(
          new SaveNounOperation(this.storage, {
            id: params.id,
            vector,
            connections: new Map(),
            level: 0
          })
        )

        // Operation 3-4: Update HNSW index (remove and re-add if reindexing needed)
        if (needsReindexing) {
          tx.addOperation(
            new RemoveFromHNSWOperation(this.index as any, params.id, existing.vector)
          )
          tx.addOperation(
            new AddToHNSWOperation(this.index as any, params.id, vector)
          )
        }

        // Operation 5-6: Update metadata index (remove old, add new)
        // FIX: Include ALL indexed fields in removalMetadata (not just type)
        // Previously, only metadata + type was removed, but entityForIndexing includes:
        // confidence, weight, createdAt, updatedAt, service, data, createdBy
        // This asymmetry caused 7 fields to accumulate on EVERY update, eventually
        // making queries return 0 results (77x overcounting at scale).
        //
        // DEBUG: Log what we're removing and adding
        // console.log('[UPDATE DEBUG] existing.metadata:', JSON.stringify(existing.metadata))
        // console.log('[UPDATE DEBUG] entityForIndexing keys:', Object.keys(entityForIndexing))
        //
        // FIX: removalMetadata must MATCH entityForIndexing structure
        // entityForIndexing has: { type, confidence, ..., metadata: {...} }
        // So removalMetadata must also have: { type, confidence, ..., metadata: {...} }
        const removalMetadata = {
          type: existing.type,
          confidence: existing.confidence,
          weight: existing.weight,
          createdAt: existing.createdAt,
          updatedAt: existing.updatedAt, // CRITICAL: removes old timestamp
          service: existing.service,
          data: existing.data,
          createdBy: existing.createdBy,
          metadata: existing.metadata  // CRITICAL: keep as nested 'metadata' property!
        }
        tx.addOperation(
          new RemoveFromMetadataIndexOperation(this.metadataIndex, params.id, removalMetadata)
        )
        tx.addOperation(
          new AddToMetadataIndexOperation(this.metadataIndex, params.id, entityForIndexing)
        )
      })
  }

  /**
   * Delete an entity
   */
  async delete(id: string): Promise<void> {
    // Handle invalid IDs gracefully
    if (!id || typeof id !== 'string') {
      return // Silently return for invalid IDs
    }

    await this.ensureInitialized()

    // Get entity metadata and related verbs before deletion
      const metadata = await this.storage.getNounMetadata(id)
      const noun = await this.storage.getNoun(id)
      const verbs = await this.storage.getVerbsBySource(id)
      const targetVerbs = await this.storage.getVerbsByTarget(id)
      const allVerbs = [...verbs, ...targetVerbs]

      // Execute atomically with transaction system
      await this.transactionManager.executeTransaction(async (tx) => {
        // Operation 1: Remove from vector index
        if (noun) {
          tx.addOperation(
            new RemoveFromHNSWOperation(this.index as any, id, noun.vector)
          )
        }

        // Operation 2: Remove from metadata index
        if (metadata) {
          tx.addOperation(
            new RemoveFromMetadataIndexOperation(this.metadataIndex, id, metadata)
          )
        }

        // Operation 3: Delete noun metadata
        tx.addOperation(
          new DeleteNounMetadataOperation(this.storage, id)
        )

        // Operations 4+: Delete all related verbs atomically
        for (const verb of allVerbs) {
          // Remove from graph index
          tx.addOperation(
            new RemoveFromGraphIndexOperation(this.graphIndex, verb as any)
          )
          // Delete verb metadata
          tx.addOperation(
            new DeleteVerbMetadataOperation(this.storage, verb.id)
          )
        }
      })
  }

  // ============= RELATIONSHIP OPERATIONS =============

  /**
   * Create a relationship between entities
   *
   * @param params - Parameters for creating the relationship
   * @returns Promise that resolves to the relationship ID
   *
   * @example
   * // Basic relationship creation
   * const userId = await brainy.add({
   *   data: { name: 'John', role: 'developer' },
   *   type: NounType.Person
   * })
   * const projectId = await brainy.add({
   *   data: { name: 'AI Assistant', status: 'active' },
   *   type: NounType.Thing
   * })
   *
   * const relationId = await brainy.relate({
   *   from: userId,
   *   to: projectId,
   *   type: VerbType.WorksOn
   * })
   *
   * @example
   * // Bidirectional relationships
   * const friendshipId = await brainy.relate({
   *   from: 'user-1',
   *   to: 'user-2',
   *   type: VerbType.Knows,
   *   bidirectional: true // Creates both directions automatically
   * })
   *
   * @example
   * // Weighted relationships for importance/strength
   * const collaborationId = await brainy.relate({
   *   from: 'team-lead',
   *   to: 'project-alpha',
   *   type: VerbType.LeadsOn,
   *   weight: 0.9, // High importance/strength
   *   metadata: {
   *     startDate: '2024-01-15',
   *     responsibility: 'technical leadership',
   *     hoursPerWeek: 40
   *   }
   * })
   *
   * @example
   * // Typed relationships with custom metadata
   * interface CollaborationMeta {
   *   role: string
   *   startDate: string
   *   skillLevel: number
   * }
   *
   * const brainy = new Brainy<CollaborationMeta>({ storage: 'filesystem' })
   * const relationId = await brainy.relate({
   *   from: 'developer-123',
   *   to: 'project-456',
   *   type: VerbType.WorksOn,
   *   weight: 0.85,
   *   metadata: {
   *     role: 'frontend developer',
   *     startDate: '2024-03-01',
   *     skillLevel: 8
   *   }
   * })
   *
   * @example
   * // Creating complex relationship networks
   * const entities = []
   * // Create entities
   * for (let i = 0; i < 5; i++) {
   *   const id = await brainy.add({
   *     data: { name: `Entity ${i}`, value: i * 10 },
   *     type: NounType.Thing
   *   })
   *   entities.push(id)
   * }
   *
   * // Create hierarchical relationships
   * for (let i = 0; i < entities.length - 1; i++) {
   *   await brainy.relate({
   *     from: entities[i],
   *     to: entities[i + 1],
   *     type: VerbType.DependsOn,
   *     weight: (i + 1) / entities.length
   *   })
   * }
   *
   * @example
   * // Error handling for invalid relationships
   * try {
   *   await brainy.relate({
   *     from: 'nonexistent-entity',
   *     to: 'another-entity',
   *     type: VerbType.RelatedTo
   *   })
   * } catch (error) {
   *   if (error.message.includes('not found')) {
   *     console.log('One or both entities do not exist')
   *     // Handle missing entities...
   *   }
   * }
   */
  async relate(params: RelateParams<T>): Promise<string> {
    await this.ensureInitialized()

    // Zero-config validation (static import for performance)
    validateRelateParams(params)

    // Verify entities exist
    const fromEntity = await this.get(params.from)
    const toEntity = await this.get(params.to)

    if (!fromEntity) {
      throw new Error(`Source entity ${params.from} not found`)
    }
    if (!toEntity) {
      throw new Error(`Target entity ${params.to} not found`)
    }

    // CRITICAL FIX: Check for duplicate relationships
    // This prevents infinite loops where same relationship is created repeatedly
    // Bug #1 showed incrementing verb counts (7→8→9...) indicating duplicates
    // OPTIMIZATION: Use GraphAdjacencyIndex for O(log n) lookup instead of O(n) storage scan
    const verbIds = await this.graphIndex.getVerbIdsBySource(params.from)

    // Batch-load verbs for 5x faster duplicate checking on GCS
    // GCS: 5 verbs = 1×50ms vs 5×50ms = 250ms (5x faster)
    if (verbIds.length > 0) {
      const verbsMap = await this.graphIndex.getVerbsBatchCached(verbIds)

      for (const [verbId, verb] of verbsMap.entries()) {
        if (verb.targetId === params.to && verb.verb === params.type) {
          // Relationship already exists - return existing ID instead of creating duplicate
          return verb.id
        }
      }
    }

    // No duplicate found - proceed with creation

    // Generate ID
    const id = uuidv4()

    // Compute relationship vector (average of entities)
    const relationVector = fromEntity.vector.map(
      (v, i) => (v + toEntity.vector[i]) / 2
    )

    // Prepare verb metadata
      // CRITICAL: Include verb type in metadata for count tracking
      const verbMetadata = {
        verb: params.type, // Store verb type for count synchronization
        weight: params.weight ?? 1.0,
        ...(params.metadata || {}),
        createdAt: Date.now()
      }

      // Save to storage (vector and metadata separately)
      const verb: GraphVerb = {
        id,
        vector: relationVector,
        sourceId: params.from,
        targetId: params.to,
        source: fromEntity.type,
        target: toEntity.type,
        verb: params.type,
        type: params.type,
        weight: params.weight ?? 1.0,
        metadata: params.metadata as any,
        createdAt: Date.now()
      } as any

      // Execute atomically with transaction system
      await this.transactionManager.executeTransaction(async (tx) => {
        // Operation 1: Save verb vector data
        tx.addOperation(
          new SaveVerbOperation(this.storage, {
            id,
            vector: relationVector,
            connections: new Map(),
            verb: params.type,
            sourceId: params.from,
            targetId: params.to
          })
        )

        // Operation 2: Save verb metadata
        tx.addOperation(
          new SaveVerbMetadataOperation(this.storage, id, verbMetadata)
        )

        // Operation 3: Add to graph index for O(1) lookups
        tx.addOperation(
          new AddToGraphIndexOperation(this.graphIndex, verb)
        )

        // Create bidirectional if requested
        if (params.bidirectional) {
          const reverseId = uuidv4()
          const reverseVerb: GraphVerb = {
            ...verb,
            id: reverseId,
            sourceId: params.to,
            targetId: params.from,
            source: toEntity.type,
            target: fromEntity.type
          } as any

          // Operation 4: Save reverse verb vector data
          tx.addOperation(
            new SaveVerbOperation(this.storage, {
              id: reverseId,
              vector: relationVector,
              connections: new Map(),
              verb: params.type,
              sourceId: params.to,
              targetId: params.from
            })
          )

          // Operation 5: Save reverse verb metadata
          tx.addOperation(
            new SaveVerbMetadataOperation(this.storage, reverseId, verbMetadata)
          )

          // Operation 6: Add reverse relationship to graph index
          tx.addOperation(
            new AddToGraphIndexOperation(this.graphIndex, reverseVerb)
          )
        }
      })

      return id
  }

  /**
   * Delete a relationship
   */
  async unrelate(id: string): Promise<void> {
    await this.ensureInitialized()

    // Get verb data before deletion for rollback
      const verb = await this.storage.getVerb(id)

      // Execute atomically with transaction system
      await this.transactionManager.executeTransaction(async (tx) => {
        // Operation 1: Remove from graph index
        if (verb) {
          tx.addOperation(
            new RemoveFromGraphIndexOperation(this.graphIndex, verb as any)
          )
        }

        // Operation 2: Delete verb metadata (which also deletes vector)
        tx.addOperation(
          new DeleteVerbMetadataOperation(this.storage, id)
        )
      })
  }

  /**
   * Get relationships between entities
   *
   * Supports multiple query patterns:
   * - No parameters: Returns all relationships (paginated, default limit: 100)
   * - String ID: Returns relationships from that entity (shorthand for { from: id })
   * - Parameters object: Fine-grained filtering and pagination
   *
   * @param paramsOrId - Optional string ID or parameters object
   * @returns Promise resolving to array of relationships
   *
   * @example
   * ```typescript
   * // Get all relationships (first 100)
   * const all = await brain.getRelations()
   *
   * // Get relationships from specific entity (shorthand syntax)
   * const fromEntity = await brain.getRelations(entityId)
   *
   * // Get relationships with filters
   * const filtered = await brain.getRelations({
   *   type: VerbType.FriendOf,
   *   limit: 50
   * })
   *
   * // Pagination
   * const page2 = await brain.getRelations({ offset: 100, limit: 100 })
   * ```
   *
   */
  async getRelations(
    paramsOrId?: string | GetRelationsParams
  ): Promise<Relation<T>[]> {
    await this.ensureInitialized()

    // Handle string ID shorthand: getRelations(id) -> getRelations({ from: id })
    const params = typeof paramsOrId === 'string'
      ? { from: paramsOrId }
      : (paramsOrId || {})

    const limit = params.limit || 100
    const offset = params.offset || 0

    // Production safety: warn for large unfiltered queries
    if (!params.from && !params.to && !params.type && limit > 10000) {
      console.warn(
        `[Brainy] getRelations(): Fetching ${limit} relationships without filters. ` +
        `Consider adding 'from', 'to', or 'type' filter for better performance.`
      )
    }

    // Build filter for storage query
    const filter: any = {}

    if (params.from) {
      filter.sourceId = params.from
    }

    if (params.to) {
      filter.targetId = params.to
    }

    if (params.type) {
      filter.verbType = Array.isArray(params.type) ? params.type : [params.type]
    }

    if (params.service) {
      filter.service = params.service
    }

    // VFS relationships are no longer filtered
    // VFS is part of the knowledge graph - users can filter explicitly if needed

    // Fetch from storage with pagination at storage layer (efficient!)
    const result = await this.storage.getVerbs({
      pagination: {
        limit,
        offset,
        cursor: params.cursor
      },
      filter: Object.keys(filter).length > 0 ? filter : undefined
    })

    // Convert to Relation format
    return this.verbsToRelations(result.items as any)
  }

  // ============= SEARCH & DISCOVERY =============

  /**
   * Unified find method - supports natural language and structured queries
   * Implements Triple Intelligence with parallel search optimization
   *
   * @param query - Natural language string or structured FindParams object
   * @returns Promise that resolves to array of search results with scores
   *
   * **Result Structure:**
   * Each result includes flattened entity fields for convenient access:
   * - `metadata`, `type`, `data` - Direct access (flattened from entity)
   * - `confidence`, `weight` - Entity confidence/importance (if set)
   * - `entity` - Full Entity object (backward compatible)
   * - `score` - Search relevance score (0-1)
   *
   * @example
   * // Natural language queries (most common)
   * const results = await brainy.find('users who work on AI projects')
   * const docs = await brainy.find('documents about machine learning')
   * const code = await brainy.find('JavaScript functions for data processing')
   *
   * @example
   * // Structured queries with filtering
   * const results = await brainy.find({
   *   query: 'artificial intelligence',
   *   type: NounType.Document,
   *   limit: 5,
   *   where: {
   *     status: 'published',
   *     author: 'expert'
   *   }
   * })
   *
   * // Access flattened fields directly
   * for (const result of results) {
   *   console.log(`Score: ${result.score}`)
   *   console.log(`Type: ${result.type}`)           // Flattened!
   *   console.log(`Metadata:`, result.metadata)     // Flattened!
   *   console.log(`Confidence: ${result.confidence ?? 'N/A'}`)  // Flattened!
   *   console.log(`Weight: ${result.weight ?? 'N/A'}`)          // Flattened!
   * }
   *
   * // Backward compatible: Nested access still works
   * console.log(result.entity.data)  // Also works
   *
   * @example
   * // Metadata-only filtering (no vector search)
   * const activeUsers = await brainy.find({
   *   type: NounType.Person,
   *   where: {
   *     status: 'active',
   *     department: 'engineering'
   *   },
   *   service: 'user-management'
   * })
   *
   * @example
   * // Vector similarity search with custom vectors
   * const queryVector = await brainy.embed('machine learning algorithms')
   * const similar = await brainy.find({
   *   vector: queryVector,
   *   limit: 10,
   *   type: [NounType.Document, NounType.Thing]
   * })
   *
   * @example
   * // Proximity search (find entities similar to existing ones)
   * const relatedContent = await brainy.find({
   *   near: 'document-123', // Find entities similar to this one
   *   limit: 8,
   *   where: {
   *     published: true
   *   }
   * })
   *
   * @example
   * // Pagination for large result sets
   * const firstPage = await brainy.find({
   *   query: 'research papers',
   *   limit: 20,
   *   offset: 0
   * })
   *
   * const secondPage = await brainy.find({
   *   query: 'research papers',
   *   limit: 20,
   *   offset: 20
   * })
   *
   * @example
   * // Complex search with multiple criteria
   * const results = await brainy.find({
   *   query: 'machine learning models',
   *   type: [NounType.Thing, NounType.Document],
   *   where: {
   *     accuracy: { $gte: 0.9 }, // Metadata filtering
   *     framework: { $in: ['tensorflow', 'pytorch'] }
   *   },
   *   service: 'ml-pipeline',
   *   limit: 15
   * })
   *
   * @example
   * // Empty query returns all entities (paginated)
   * const allEntities = await brainy.find({
   *   limit: 50,
   *   offset: 0
   * })
   *
   * @example
   * // Performance-optimized search patterns
   * // Fast metadata-only search (no vector computation)
   * const fastResults = await brainy.find({
   *   type: NounType.Person,
   *   where: { active: true },
   *   limit: 100
   * })
   *
   * // Combined vector + metadata for precision
   * const preciseResults = await brainy.find({
   *   query: 'senior developers',
   *   where: {
   *     experience: { $gte: 5 },
   *     skills: { $includes: 'javascript' }
   *   },
   *   limit: 10
   * })
   *
   * @example
   * // Error handling and result processing
   * try {
   *   const results = await brainy.find('complex query here')
   *
   *   if (results.length === 0) {
   *     console.log('No results found')
   *     return
   *   }
   *
   *   // Filter by confidence threshold
   *   const highConfidence = results.filter(r => r.score > 0.7)
   *
   *   // Sort by score (already sorted by default)
   *   const topResults = results.slice(0, 5)
   *
   *   return topResults.map(r => ({
   *     id: r.id,
   *     content: r.entity.data,
   *     confidence: r.score,
   *     metadata: r.entity.metadata
   *   }))
   * } catch (error) {
   *   console.error('Search failed:', error)
   *   return []
   * }
   *
   * @example
   * // VFS Filtering: Exclude VFS entities by default
   * // Knowledge graph queries stay clean - no VFS files in results
   * const knowledge = await brainy.find({ query: 'AI concepts' })
   * // Returns only knowledge entities, VFS files excluded
   *
   * @example
   * // VFS entities included by default
   * const everything = await brainy.find({
   *   query: 'documentation'
   * })
   * // Returns both knowledge entities AND VFS files
   *
   * @example
   * // Search only VFS files
   * const files = await brainy.find({
   *   where: { vfsType: 'file', extension: '.md' }
   * })
   *
   * @example
   * // Exclude VFS entities (if needed)
   * const concepts = await brainy.find({
   *   query: 'machine learning',
   *   excludeVFS: true  // Exclude VFS files
   * })
   */
  async find(query: string | FindParams<T>): Promise<Result<T>[]> {
    await this.ensureInitialized()

    // Ensure indexes are loaded (lazy loading when disableAutoRebuild: true)
    // This is a production-safe, concurrency-controlled lazy load
    await this.ensureIndexesLoaded()

    // Parse natural language queries
    const params: FindParams<T> =
      typeof query === 'string' ? await this.parseNaturalQuery(query) : query

    // Zero-config validation (static import for performance)
    validateFindParams(params)

    const startTime = Date.now()
    const result = await (async () => {
      let results: Result<T>[] = []

      // Distinguish between search criteria (need vector search) and filter criteria (metadata only)
      // Treat empty string query as no query
      const hasVectorSearchCriteria = (params.query && params.query.trim() !== '') || params.vector || params.near
      const hasFilterCriteria = params.where || params.type || params.service
      const hasGraphCriteria = params.connected

      // Handle metadata-only queries (no vector search needed)
      if (!hasVectorSearchCriteria && !hasGraphCriteria && hasFilterCriteria) {
        // Build filter for metadata index
        let filter: any = {}
        if (params.where) Object.assign(filter, params.where)
        if (params.service) filter.service = params.service

        if (params.type) {
          const types = Array.isArray(params.type) ? params.type : [params.type]
          if (types.length === 1) {
            filter.noun = types[0]
          } else {
            filter = {
              anyOf: types.map(type => ({
                noun: type,
                ...filter
              }))
            }
          }
        }

        // ExcludeVFS helper - ONLY exclude VFS infrastructure entities
        // Applied AFTER type filter to avoid execution order bugs
        // Excludes entities where:
        //   - vfsType is 'file' or 'directory' (VFS files/folders)
        //   - isVFSEntity is true (explicitly marked as VFS)
        // Includes extracted entities (person/concept/etc) even if they have vfsPath metadata
        if (params.excludeVFS === true) {
          // VFS infrastructure entities ALWAYS have vfsType set
          // Extracted entities do NOT have vfsType (undefined)
          filter.vfsType = { exists: false }
          // Extra safety: exclude entities explicitly marked as VFS
          filter.isVFSEntity = { ne: true }
        }

        // Apply sorting if requested, otherwise just filter
        let filteredIds: string[]
        if (params.orderBy) {
          // Get sorted IDs using production-scale sorted filtering
          filteredIds = await this.metadataIndex.getSortedIdsForFilter(
            filter,
            params.orderBy,
            params.order || 'asc'
          )
        } else {
          // Just filter without sorting
          filteredIds = await this.metadataIndex.getIdsForFilter(filter)
        }

        // Paginate BEFORE loading entities (production-scale!)
        const limit = params.limit || 10
        const offset = params.offset || 0
        const pageIds = filteredIds.slice(offset, offset + limit)

        // Batch-load entities for 10x faster cloud storage performance
        // GCS: 10 entities = 1×50ms vs 10×50ms = 500ms (10x faster)
        const entitiesMap = await this.batchGet(pageIds)
        for (const id of pageIds) {
          const entity = entitiesMap.get(id)
          if (entity) {
            results.push(this.createResult(id, 1.0, entity))
          }
        }

        return results
      }

      // Handle completely empty query - return all results paginated
      if (!hasVectorSearchCriteria && !hasFilterCriteria && !hasGraphCriteria) {
        const limit = params.limit || 20
        const offset = params.offset || 0

        // ExcludeVFS helper - exclude VFS infrastructure entities
        // VFS files/folders have vfsType set, extracted entities do NOT
        let filter: any = {}
        if (params.excludeVFS === true) {
          filter.vfsType = { exists: false }
          filter.isVFSEntity = { ne: true }
        }

        // Use metadata index if we need to filter
        if (Object.keys(filter).length > 0) {
          const filteredIds = await this.metadataIndex.getIdsForFilter(filter)
          const pageIds = filteredIds.slice(offset, offset + limit)

          // Batch-load entities for 10x faster cloud storage performance
          const entitiesMap = await this.batchGet(pageIds)
          for (const id of pageIds) {
            const entity = entitiesMap.get(id)
            if (entity) {
              results.push(this.createResult(id, 1.0, entity))
            }
          }
        } else {
          // No filtering needed, use direct storage query
          const storageResults = await this.storage.getNouns({
            pagination: { limit: limit + offset, offset: 0 }
          })

          for (let i = offset; i < Math.min(offset + limit, storageResults.items.length); i++) {
            const noun = storageResults.items[i]
            if (noun) {
              const entity = await this.convertNounToEntity(noun)
              results.push(this.createResult(noun.id, 1.0, entity))
            }
          }
        }

        return results
      }

      // Metadata-first optimization: pre-resolve filter IDs before vector search.
      // This enables HNSW to search only within matching candidates instead of
      // doing expensive post-filtering. Native HNSW uses searchWithCandidates (Rust
      // bitmap), JS HNSW converts to a Set-based filter function.
      let preResolvedMetadataIds: string[] | null = null
      let preResolvedFilter: any = null

      if (params.where || params.type || params.service || params.excludeVFS) {
        preResolvedFilter = {}
        if (params.where) Object.assign(preResolvedFilter, params.where)
        if (params.service) preResolvedFilter.service = params.service
        if (params.excludeVFS === true) {
          preResolvedFilter.vfsType = { exists: false }
          preResolvedFilter.isVFSEntity = { ne: true }
        }
        if (params.type) {
          const types = Array.isArray(params.type) ? params.type : [params.type]
          if (types.length === 1) {
            preResolvedFilter.noun = types[0]
          } else {
            preResolvedFilter = {
              anyOf: types.map(type => ({
                noun: type,
                ...preResolvedFilter
              }))
            }
          }
        }
        preResolvedMetadataIds = await this.metadataIndex.getIdsForFilter(preResolvedFilter)

        // Short-circuit: if metadata filter matches nothing, skip expensive vector search
        if (preResolvedMetadataIds.length === 0) {
          return []
        }
      }

      // Zero-Config Hybrid Search
      // Determine search mode: auto (default) combines text + semantic for query searches
      const searchMode = params.searchMode || 'auto'
      const limit = params.limit || 10

      // Handle text-only query (user explicitly wants text search)
      if (searchMode === 'text' && params.query && params.query.trim() !== '') {
        results = await this.executeTextSearch(params.query, limit * 2)
      }
      // Handle semantic-only query (user explicitly wants vector search)
      else if ((searchMode === 'semantic' || searchMode === 'vector') && (params.query || params.vector)) {
        results = await this.executeVectorSearch(params, preResolvedMetadataIds ?? undefined)
      }
      // Handle explicit hybrid or auto mode with query
      else if ((searchMode === 'auto' || searchMode === 'hybrid') && params.query && params.query.trim() !== '' && !params.vector) {
        // Zero-config hybrid: combine text + semantic search with RRF fusion
        const [textResults, semanticResults] = await Promise.all([
          this.executeTextSearch(params.query, limit * 2),
          this.executeVectorSearch(params, preResolvedMetadataIds ?? undefined)
        ])

        // Use user-specified alpha or auto-detect based on query length
        const alpha = params.hybridAlpha ?? this.autoAlpha(params.query)

        // Tokenize query for match visibility
        const queryWords = this.metadataIndex.tokenize(params.query)

        // RRF fusion combines both result sets with match visibility
        results = await this.rrfFusion(textResults, semanticResults, alpha, queryWords)
      }
      // Handle direct vector search (no query text) - no hybrid needed
      else if (params.vector && !params.query) {
        results = await this.executeVectorSearch(params, preResolvedMetadataIds ?? undefined)
      }
      // Handle proximity search
      else if (params.near) {
        results = await this.executeProximitySearch(params)
      }

      // Execute parallel searches for additional criteria (proximity search in addition to query)
      if (params.near && params.query) {
        const proximityResults = await this.executeProximitySearch(params)
        results.push(...proximityResults)
      }

      // Remove duplicate results from parallel searches
      if (results.length > 0) {
        const uniqueResults = new Map<string, Result<T>>()
        for (const result of results) {
          const existing = uniqueResults.get(result.id)
          if (!existing || result.score > existing.score) {
            uniqueResults.set(result.id, result)
          }
        }
        results = Array.from(uniqueResults.values())
      }

      // Apply metadata filtering using pre-resolved IDs (metadata-first optimization).
      // When vector search was performed, HNSW already filtered by candidateIds —
      // this block handles pagination, entity loading, and metadata-only queries.
      if (preResolvedMetadataIds && preResolvedFilter) {
        const filteredIds = preResolvedMetadataIds

        if (results.length > 0) {
          // Filter results by pre-resolved metadata IDs.
          // With metadata-first HNSW, most results already match — this is a safety net
          // for text search results and proximity results that weren't pre-filtered.
          const filteredIdSet = new Set(filteredIds)
          results = results.filter((r) => filteredIdSet.has(r.id))

          // Apply early pagination for vector + metadata queries
          const limit = params.limit || 10
          const offset = params.offset || 0

          // If we have enough filtered results, sort and paginate early
          if (results.length >= offset + limit) {
            results.sort((a, b) => b.score - a.score)
            results = results.slice(offset, offset + limit)

            // Batch-load entities only for the paginated results (10x faster on GCS)
            const idsToLoad = results.filter(r => !r.entity).map(r => r.id)
            if (idsToLoad.length > 0) {
              const entitiesMap = await this.batchGet(idsToLoad)
              for (const result of results) {
                if (!result.entity) {
                  const entity = entitiesMap.get(result.id)
                  if (entity) {
                    result.entity = entity
                  }
                }
              }
            }

            // Early return if no other processing needed
            if (!params.connected && !params.fusion) {
              return results
            }
          }
        } else {
          // OPTIMIZED: Apply pagination to filtered IDs BEFORE loading entities
          const limit = params.limit || 10
          const offset = params.offset || 0
          const pageIds = filteredIds.slice(offset, offset + limit)

          // Batch-load entities for current page - O(page_size) instead of O(total_results)
          // GCS: 10 entities = 1×50ms vs 10×50ms = 500ms (10x faster)
          const entitiesMap = await this.batchGet(pageIds)
          for (const id of pageIds) {
            const entity = entitiesMap.get(id)
            if (entity) {
              results.push(this.createResult(id, 1.0, entity))
            }
          }

          // Early return for metadata-only queries with pagination applied
          if (!params.query && !params.connected) {
            // Apply sorting if requested for metadata-only queries
            if (params.orderBy) {
              const sortedIds = await this.metadataIndex.getSortedIdsForFilter(
                preResolvedFilter,
                params.orderBy,
                params.order || 'asc'
              )

              // Paginate sorted IDs BEFORE loading entities (production-scale!)
              const limit = params.limit || 10
              const offset = params.offset || 0
              const pageIds = sortedIds.slice(offset, offset + limit)

              // Batch-load entities for paginated results (10x faster on GCS)
              const sortedResults: Result<T>[] = []
              const entitiesMap = await this.batchGet(pageIds)
              for (const id of pageIds) {
                const entity = entitiesMap.get(id)
                if (entity) {
                  sortedResults.push(this.createResult(id, 1.0, entity))
                }
              }

              return sortedResults
            }

            return results
          }
        }
      }

      // Graph search component with O(1) traversal
      if (params.connected) {
        results = await this.executeGraphSearch(params, results)
      }

      // Apply fusion scoring if requested
      if (params.fusion && results.length > 0) {
        results = this.applyFusionScoring(results, params.fusion)
      }

      // OPTIMIZED: Sort first, then apply efficient pagination
      // Support custom orderBy for vector + metadata queries
      if (params.orderBy && results.length > 0) {
        // For vector + metadata queries, sort by specified field instead of score
        // Load sort field values for all results (small set, already filtered)
        const resultsWithValues = await Promise.all(results.map(async (r) => ({
          result: r,
          value: await this.metadataIndex.getFieldValueForEntity(r.id, params.orderBy!)
        })))

        // Sort by field value
        resultsWithValues.sort((a, b) => {
          // Handle null/undefined
          if (a.value == null && b.value == null) return 0
          if (a.value == null) return (params.order || 'asc') === 'asc' ? 1 : -1
          if (b.value == null) return (params.order || 'asc') === 'asc' ? -1 : 1

          // Compare values
          if (a.value === b.value) return 0
          const comparison = a.value < b.value ? -1 : 1
          return (params.order || 'asc') === 'asc' ? comparison : -comparison
        })

        results = resultsWithValues.map(({ result }) => result)
      } else {
        // Default: sort by relevance score
        results.sort((a, b) => b.score - a.score)
      }

      const finalOffset = params.offset || 0

      // Efficient pagination - only slice what we need (limit already defined above)
      return results.slice(finalOffset, finalOffset + limit)
    })()

    // Record performance for auto-tuning
    const duration = Date.now() - startTime
    recordQueryPerformance(duration, result.length)
    
    return result
  }

  /**
   * Find similar entities using vector similarity
   *
   * @param params - Parameters specifying the target for similarity search
   * @param params.to - Entity ID, Entity object, or Vector to find similar to (required)
   * @param params.limit - Maximum results (default: 10)
   * @param params.threshold - Minimum similarity (0-1)
   * @param params.type - Filter by NounType(s)
   * @param params.where - Metadata filters
   * @returns Promise that resolves to array of Result objects with similarity scores (same structure as find())
   *
   * **Returns:**
   * Same Result structure as find() with flattened fields for convenient access
   *
   * @example
   * // Find entities similar to a specific entity by ID
   * const similarDocs = await brainy.similar({
   *   to: 'document-123',
   *   limit: 10
   * })
   *
   * // Access flattened fields
   * for (const result of similarDocs) {
   *   console.log(`Similarity: ${result.score}`)
   *   console.log(`Type: ${result.type}`)              // Flattened!
   *   console.log(`Metadata:`, result.metadata)        // Flattened!
   *   console.log(`Confidence: ${result.confidence ?? 'N/A'}`)  // Flattened!
   * }
   *
   * @example
   * // Find similar entities with type filtering
   * const similarUsers = await brainy.similar({
   *   to: 'user-456',
   *   type: NounType.Person,
   *   limit: 5,
   *   where: {
   *     active: true,
   *     department: 'engineering'
   *   }
   * })
   *
   * @example
   * // Find similar using a custom vector
   * const customVector = await brainy.embed('artificial intelligence research')
   * const similar = await brainy.similar({
   *   to: customVector,
   *   limit: 8,
   *   type: [NounType.Document, NounType.Thing]
   * })
   *
   * @example
   * // Find similar using an entity object
   * const sourceEntity = await brainy.get('research-paper-789')
   * if (sourceEntity) {
   *   const relatedPapers = await brainy.similar({
   *     to: sourceEntity,
   *     limit: 12,
   *     where: {
   *       published: true,
   *       category: 'machine-learning'
   *     }
   *   })
   * }
   *
   * @example
   * // Content recommendation system
   * async function getRecommendations(userId: string) {
   *   // Get user's recent interactions
   *   const user = await brainy.get(userId)
   *   if (!user) return []
   *
   *   // Find similar content
   *   const recommendations = await brainy.similar({
   *     to: userId,
   *     type: NounType.Document,
   *     limit: 20,
   *     where: {
   *       published: true,
   *       language: 'en'
   *     }
   *   })
   *
   *   // Filter out already seen content
   *   return recommendations.filter(rec =>
   *     !user.metadata.viewedItems?.includes(rec.id)
   *   )
   * }
   *
   * @example
   * // Duplicate detection system
   * async function findPotentialDuplicates(entityId: string) {
   *   const duplicates = await brainy.similar({
   *     to: entityId,
   *     limit: 10
   *   })
   *
   *   // High similarity might indicate duplicates
   *   const highSimilarity = duplicates.filter(d => d.score > 0.95)
   *
   *   if (highSimilarity.length > 0) {
   *     console.log('Potential duplicates found:', highSimilarity.map(d => d.id))
   *   }
   *
   *   return highSimilarity
   * }
   *
   * @example
   * // Error handling for missing entities
   * try {
   *   const similar = await brainy.similar({
   *     to: 'nonexistent-entity',
   *     limit: 5
   *   })
   * } catch (error) {
   *   if (error.message.includes('not found')) {
   *     console.log('Source entity does not exist')
   *     // Handle missing source entity
   *   }
   * }
   */
  async similar(params: SimilarParams<T>): Promise<Result<T>[]> {
    await this.ensureInitialized()

    // Get target vector
    let targetVector: Vector

    if (typeof params.to === 'string') {
      // Need vector for similarity, so use includeVectors: true
      const entity = await this.get(params.to, { includeVectors: true })
      if (!entity) {
        throw new Error(`Entity ${params.to} not found`)
      }
      targetVector = entity.vector
    } else if (Array.isArray(params.to)) {
      targetVector = params.to as Vector
    } else {
      // Entity object passed - check if vectors are loaded
      const entityVector = (params.to as Entity<T>).vector
      if (!entityVector || entityVector.length === 0) {
        throw new Error(
          'Entity passed to brain.similar() has no vector embeddings loaded. ' +
          'Please retrieve the entity with { includeVectors: true } or pass the entity ID instead.\n\n' +
          'Example: brain.similar({ to: entityId }) OR brain.similar({ to: await brain.get(entityId, { includeVectors: true }) })'
        )
      }
      targetVector = entityVector
    }

    // Use find with vector
    return this.find({
      vector: targetVector,
      limit: params.limit,
      type: params.type,
      where: params.where,
      service: params.service,
      excludeVFS: params.excludeVFS  // Pass through VFS filtering
    })
  }

  // ============= BATCH OPERATIONS =============

  /**
   * Add multiple entities
   *
   * Performance optimization: Uses batch embedding (embedBatch) to pre-compute
   * all vectors in a single WASM forward pass instead of N individual embed() calls.
   * This provides 5-10x speedup on bulk inserts.
   */
  async addMany(params: AddManyParams<T>): Promise<BatchResult<string>> {
    await this.ensureInitialized()

    // Get optimal batch configuration from storage adapter
    // This automatically adapts to storage characteristics:
    // - GCS: 50 batch size, 100ms delay, sequential
    // - S3/R2: 100 batch size, 50ms delay, parallel
    // - Memory: 1000 batch size, 0ms delay, parallel
    const storageConfig = this.storage.getBatchConfig()

    // Use storage preferences (allow explicit user override)
    const batchSize = params.chunkSize ?? storageConfig.maxBatchSize
    const parallel = params.parallel ?? storageConfig.supportsParallelWrites
    const delayMs = storageConfig.batchDelayMs

    const result: BatchResult<string> = {
      successful: [],
      failed: [],
      total: params.items.length,
      duration: 0
    }

    const startTime = Date.now()
    let lastBatchTime = Date.now()

    // OPTIMIZATION: Pre-compute vectors using batch embedding
    // Items that already have vectors are skipped
    // This changes N individual WASM calls → 1 batched WASM call (5-10x faster)
    const itemsNeedingEmbedding: { index: number; text: string }[] = []

    for (let i = 0; i < params.items.length; i++) {
      const item = params.items[i]
      if (!item.vector && item.data !== undefined && item.data !== null) {
        // Convert data to string for embedding
        const text = typeof item.data === 'string'
          ? item.data
          : JSON.stringify(item.data)
        itemsNeedingEmbedding.push({ index: i, text })
      }
    }

    // Batch embed all texts that need vectors
    if (itemsNeedingEmbedding.length > 0) {
      const texts = itemsNeedingEmbedding.map(item => item.text)
      const vectors = await this.embedBatch(texts)

      // Attach pre-computed vectors to items
      for (let i = 0; i < itemsNeedingEmbedding.length; i++) {
        const { index } = itemsNeedingEmbedding[i]
        // Mutate the item to include the pre-computed vector
        // This way add() will skip embedding (vector already provided)
        ;(params.items[index] as any).vector = vectors[i]
      }
    }

    // Process in batches
    for (let i = 0; i < params.items.length; i += batchSize) {
      const chunk = params.items.slice(i, i + batchSize)

      const promises = chunk.map(async (item) => {
        try {
          const id = await this.add(item)
          result.successful.push(id)
        } catch (error) {
          result.failed.push({
            item,
            error: (error as Error).message
          })
          if (!params.continueOnError) {
            throw error
          }
        }
      })

      // Parallel vs Sequential based on storage preference
      if (parallel) {
        await Promise.allSettled(promises)
      } else {
        // Sequential processing for rate-limited storage
        for (const promise of promises) {
          await promise
        }
      }

      // Progress callback
      if (params.onProgress) {
        params.onProgress(
          result.successful.length + result.failed.length,
          result.total
        )
      }

      // Adaptive delay between batches
      if (i + batchSize < params.items.length && delayMs > 0) {
        const batchDuration = Date.now() - lastBatchTime

        // If batch was too fast, add delay to respect rate limits
        if (batchDuration < delayMs) {
          await new Promise(resolve =>
            setTimeout(resolve, delayMs - batchDuration)
          )
        }

        lastBatchTime = Date.now()
      }
    }

    result.duration = Date.now() - startTime
    return result
  }

  /**
   * Delete multiple entities
   */
  async deleteMany(params: DeleteManyParams): Promise<BatchResult<string>> {
    await this.ensureInitialized()

    // Determine what to delete
    let idsToDelete: string[] = []

    if (params.ids) {
      idsToDelete = params.ids
    } else if (params.type || params.where) {
      // Find entities to delete
      const entities = await this.find({
        type: params.type,
        where: params.where,
        limit: params.limit || 1000
      })
      idsToDelete = entities.map((e) => e.id)
    }

    const result: BatchResult<string> = {
      successful: [],
      failed: [],
      total: idsToDelete.length,
      duration: 0
    }

    const startTime = Date.now()

    // Batch deletes into chunks for 10x faster performance with proper error handling
    // Single transaction per chunk (10 entities) = atomic within chunk, graceful failure across chunks
    const chunkSize = 10

    for (let i = 0; i < idsToDelete.length; i += chunkSize) {
      const chunk = idsToDelete.slice(i, i + chunkSize)

      try {
        // Process chunk in single transaction for atomic deletion
        await this.transactionManager.executeTransaction(async (tx) => {
          for (const id of chunk) {
            try {
              // Load entity data
              const metadata = await this.storage.getNounMetadata(id)
              const noun = await this.storage.getNoun(id)
              const verbs = await this.storage.getVerbsBySource(id)
              const targetVerbs = await this.storage.getVerbsByTarget(id)
              const allVerbs = [...verbs, ...targetVerbs]

              // Add delete operations to transaction
              if (noun) {
                tx.addOperation(
                  new RemoveFromHNSWOperation(this.index as any, id, noun.vector)
                )
              }

              if (metadata) {
                tx.addOperation(
                  new RemoveFromMetadataIndexOperation(this.metadataIndex, id, metadata)
                )
              }

              tx.addOperation(
                new DeleteNounMetadataOperation(this.storage, id)
              )

              for (const verb of allVerbs) {
                tx.addOperation(
                  new RemoveFromGraphIndexOperation(this.graphIndex, verb as any)
                )
                tx.addOperation(
                  new DeleteVerbMetadataOperation(this.storage, verb.id)
                )
              }

              result.successful.push(id)
            } catch (error) {
              result.failed.push({
                item: id,
                error: (error as Error).message
              })
              if (!params.continueOnError) {
                throw error
              }
            }
          }
        })
      } catch (error) {
        // Transaction failed - mark remaining entities in chunk as failed if not already recorded
        for (const id of chunk) {
          if (!result.successful.includes(id) && !result.failed.find(f => f.item === id)) {
            result.failed.push({
              item: id,
              error: (error as Error).message
            })
          }
        }

        // Stop processing if continueOnError is false
        if (!params.continueOnError) {
          break
        }
      }

      if (params.onProgress) {
        params.onProgress(
          result.successful.length + result.failed.length,
          result.total
        )
      }
    }

    result.duration = Date.now() - startTime
    return result
  }

  /**
   * Update multiple entities with batch processing
   */
  async updateMany(params: {
    items: UpdateParams<T>[]
    chunkSize?: number
    parallel?: boolean
    continueOnError?: boolean
    onProgress?: (completed: number, total: number) => void
  }): Promise<BatchResult<string>> {
    await this.ensureInitialized()

    const result: BatchResult<string> = {
      successful: [],
      failed: [],
      total: params.items.length,
      duration: 0
    }

    const startTime = Date.now()
    const chunkSize = params.chunkSize || 100

    // Process in chunks
    for (let i = 0; i < params.items.length; i += chunkSize) {
      const chunk = params.items.slice(i, i + chunkSize)

      const promises = chunk.map(async (item, chunkIndex) => {
        try {
          await this.update(item)
          result.successful.push(item.id)
        } catch (error) {
          result.failed.push({
            item,
            error: (error as Error).message
          })
          if (!params.continueOnError) {
            throw error
          }
        }
      })

      if (params.parallel !== false) {
        await Promise.allSettled(promises)
      } else {
        for (const promise of promises) {
          await promise
        }
      }

      // Report progress
      if (params.onProgress) {
        params.onProgress(
          result.successful.length + result.failed.length,
          result.total
        )
      }
    }

    result.duration = Date.now() - startTime
    return result
  }

  /**
   * Create multiple relationships with batch processing
   */
  async relateMany(params: RelateManyParams<T>): Promise<string[]> {
    await this.ensureInitialized()

    // Get optimal batch configuration from storage adapter
    // Automatically adapts to storage characteristics
    const storageConfig = this.storage.getBatchConfig()

    // Use storage preferences (allow explicit user override)
    const batchSize = params.chunkSize ?? storageConfig.maxBatchSize
    const parallel = params.parallel ?? storageConfig.supportsParallelWrites
    const delayMs = storageConfig.batchDelayMs

    const result: BatchResult<string> = {
      successful: [],
      failed: [],
      total: params.items.length,
      duration: 0
    }

    const startTime = Date.now()
    let lastBatchTime = Date.now()

    for (let i = 0; i < params.items.length; i += batchSize) {
      const chunk = params.items.slice(i, i + batchSize)

      if (parallel) {
        // Parallel processing
        const promises = chunk.map(async (item) => {
          try {
            const relationId = await this.relate(item)
            result.successful.push(relationId)
          } catch (error: any) {
            result.failed.push({
              item,
              error: error.message || 'Unknown error'
            })
            if (!params.continueOnError) {
              throw error
            }
          }
        })
        await Promise.allSettled(promises)
      } else {
        // Sequential processing
        for (const item of chunk) {
          try {
            const relationId = await this.relate(item)
            result.successful.push(relationId)
          } catch (error: any) {
            result.failed.push({
              item,
              error: error.message || 'Unknown error'
            })
            if (!params.continueOnError) {
              throw error
            }
          }
        }
      }

      // Progress callback
      if (params.onProgress) {
        params.onProgress(
          result.successful.length + result.failed.length,
          result.total
        )
      }

      // Adaptive delay
      if (i + batchSize < params.items.length && delayMs > 0) {
        const batchDuration = Date.now() - lastBatchTime
        if (batchDuration < delayMs) {
          await new Promise(resolve =>
            setTimeout(resolve, delayMs - batchDuration)
          )
        }
        lastBatchTime = Date.now()
      }
    }

    result.duration = Date.now() - startTime
    return result.successful
  }

  /**
   * Clear all data from the database
   */
  async clear(): Promise<void> {
    await this.ensureInitialized()

    // Clear storage
      await this.storage.clear()

      // Invalidate GraphAdjacencyIndex to prevent stale in-memory data
      // The index has LSMTree data and verbIdSet pointing to deleted entities.
      // Without this, relate()'s duplicate check uses stale data, potentially
      // allowing duplicate relationships or missing valid duplicates.
      if (typeof (this.storage as any).invalidateGraphIndex === 'function') {
        ;(this.storage as any).invalidateGraphIndex()
      }
      this.graphIndex = undefined as any

      // Reset index
      if ('clear' in this.index && typeof this.index.clear === 'function') {
        await this.index.clear()
      } else {
        // Recreate index using plugin factory when available
        this.index = this.createIndex()
      }

      // Recreate metadata index to clear cached data
      const clearMetadataFactory = this.pluginRegistry.getProvider<(storage: StorageAdapter) => any>('metadataIndex')
      this.metadataIndex = clearMetadataFactory
        ? clearMetadataFactory(this.storage)
        : new MetadataIndexManager(this.storage)
      await this.metadataIndex.init()

      // Reset dimensions
      this.dimensions = undefined

      // Clear any cached sub-APIs
      this._neural = undefined
      this._nlp = undefined
      this._tripleIntelligence = undefined

      // Re-initialize COW (BlobStorage) after storage.clear()
      // storage.clear() sets blobStorage=undefined for FileSystem/cloud adapters
      // VFS depends on blobStorage being available (unified blob storage for all files)
      // Must be done BEFORE VFS reinitialization
      if (typeof (this.storage as any).initializeCOW === 'function') {
        await (this.storage as any).initializeCOW({
          branch: (this.config.storage as any)?.branch || 'main',
          enableCompression: true
        })
      }

      // Reset VFS state - root entity was deleted by storage.clear()
      // Bug: VFS instance remained in memory pointing to deleted root entity
      // Following checkout() pattern exactly (see lines 2907-2914)
      if (this._vfs) {
        // Clear PathResolver caches (including UnifiedCache VFS entries)
        if ((this._vfs as any).pathResolver?.invalidateAllCaches) {
          (this._vfs as any).pathResolver.invalidateAllCaches()
        }
        // Recreate and reinitialize VFS so it's ready for use
        this._vfs = new VirtualFileSystem(this)
        await this._vfs.init()
        // _vfsInitialized remains true since we just initialized
      } else {
        // VFS was never used, reset flag for clean state
        this._vfsInitialized = false
      }
  }

  // ============= COW (COPY-ON-WRITE) API =============

  /**
   * Fork the brain (instant clone via Snowflake-style COW)
   *
   * Creates a shallow copy in <100ms using copy-on-write (COW) technology.
   * Fork shares storage and HNSW data structures with parent, copying only
   * when modified (lazy deep copy).
   *
   * **How It Works**:
   * 1. HNSW Index: Shallow copy via `enableCOW()` (~10ms for 1M+ nodes)
   * 2. Metadata Index: Fast rebuild from shared storage (<100ms)
   * 3. Graph Index: Fast rebuild from shared storage (<500ms)
   *
   * **Performance**:
   * - Fork time: <100ms @ 10K entities (MEASURED)
   * - Memory overhead: 10-20% (shared HNSW nodes)
   * - Storage overhead: 10-20% (shared blobs)
   *
   * **Write Isolation**: Changes in fork don't affect parent, and vice versa.
   *
   * @param branch - Optional branch name (auto-generated if not provided)
   * @param options - Optional fork metadata (author, message)
   * @returns New Brainy instance (forked, fully independent)
   *
   * @example
   * ```typescript
   * const brain = new Brainy()
   * await brain.init()
   *
   * // Add data to parent
   * await brain.add({ type: 'user', data: { name: 'Alice' } })
   *
   * // Fork instantly (<100ms)
   * const experiment = await brain.fork('test-migration')
   *
   * // Make changes safely in fork
   * await experiment.add({ type: 'user', data: { name: 'Bob' } })
   *
   * // Original untouched
   * console.log((await brain.find({})).length)       // 1 (Alice)
   * console.log((await experiment.find({})).length)  // 2 (Alice + Bob)
   * ```
   *
   */
  async fork(branch?: string, options?: {
    author?: string
    message?: string
    metadata?: Record<string, any>
  }): Promise<Brainy<T>> {
    await this.ensureInitialized()

    const branchName = branch || `fork-${Date.now()}`

      // Lazy COW initialization - enable automatically on first fork()
      // This is zero-config and transparent to users
      if (!('refManager' in this.storage) || !(this.storage as any).refManager) {
        // Storage supports COW but isn't initialized yet - initialize now
        if (typeof (this.storage as any).initializeCOW === 'function') {
          await (this.storage as any).initializeCOW({
            branch: (this.config.storage as any)?.branch || 'main',
            enableCompression: true
          })
        } else {
          // Storage adapter doesn't support COW at all
          throw new Error(
            'Fork requires COW-enabled storage. ' +
            'This storage adapter does not support branching. ' +
            'Please use compatible storage adapters.'
          )
        }
      }

      const refManager = (this.storage as any).refManager
      const currentBranch = (this.storage as any).currentBranch || 'main'

      // Step 1: Ensure initial commit exists (required for fork)
      const currentRef = await refManager.getRef(currentBranch)
      if (!currentRef) {
        // Auto-create initial commit if none exists
        await this.commit({
          message: `Initial commit on ${currentBranch}`,
          author: options?.author || 'Brainy',
          metadata: { timestamp: Date.now() }
        })
        if (!this.config.silent) {
          console.log(`📝 Auto-created initial commit on ${currentBranch} (required for fork)`)
        }
      }

      // Step 2: Copy storage ref (COW layer - instant!)
      await refManager.copyRef(currentBranch, branchName)

      // CRITICAL FIX: Verify branch was actually created to prevent silent failures
      // Without this check, fork() could complete successfully but branch wouldn't exist,
      // causing subsequent checkout() calls to fail (see Workshop bug report).
      const verifyBranch = await refManager.getRef(branchName)
      if (!verifyBranch) {
        throw new Error(
          `Fork failed: Branch '${branchName}' was not created. ` +
          `This indicates a storage adapter configuration issue. Please report this bug.`
        )
      }

      // Step 3: Create new Brainy instance pointing to fork branch
      const forkConfig = {
        ...this.config,
        storage: {
          ...(this.config.storage || { type: 'memory' as any }),
          branch: branchName
        }
      }

      const clone = new Brainy<T>(forkConfig)

      // Step 3: Clone storage with separate currentBranch
      // Share RefManager/BlobStorage/CommitLog but maintain separate branch context
      clone.storage = Object.create(this.storage)
      clone.storage.currentBranch = branchName
      // isInitialized inherited from prototype

      // Create HNSW index (uses plugin factory when available)
      clone.index = this.createIndex()

      // Enable COW
      if ('enableCOW' in clone.index && typeof clone.index.enableCOW === 'function') {
        (clone.index as any).enableCOW(this.index)
      }

      // Fast rebuild for small indexes from COW storage (Metadata/Graph are fast)
      const cloneMetadataFactory = this.pluginRegistry.getProvider<(storage: StorageAdapter) => any>('metadataIndex')
      clone.metadataIndex = cloneMetadataFactory
        ? cloneMetadataFactory(clone.storage)
        : new MetadataIndexManager(clone.storage)
      await clone.metadataIndex.init()

      // GraphAdjacencyIndex SINGLETON pattern for fork()
      // Object.create() causes prototype inheritance, so clone.storage.graphIndex
      // would point to parent's graphIndex. We must break this inheritance and
      // create a fresh instance for the clone's branch.
      ;(clone.storage as any).graphIndex = undefined
      ;(clone.storage as any).graphIndexPromise = undefined
      const cloneGraphFactory = this.pluginRegistry.getProvider<(storage: StorageAdapter) => any>('graphIndex')
      if (cloneGraphFactory) {
        clone.graphIndex = cloneGraphFactory(clone.storage)
        clone.storage.setGraphIndex(clone.graphIndex)
      } else {
        clone.graphIndex = await (clone.storage as any).getGraphIndex()
      }
      // getGraphIndex() will rebuild automatically if data exists (via _initializeGraphIndex)

      // Mark as initialized
      clone.initialized = true
      clone.dimensions = this.dimensions

      return clone
  }

  /**
   * List all branches/forks
   * @returns Array of branch names
   *
   * @example
   * ```typescript
   * const branches = await brain.listBranches()
   * console.log(branches) // ['main', 'experiment', 'backup']
   * ```
   */
  async listBranches(): Promise<string[]> {
    await this.ensureInitialized()

    if (!('refManager' in this.storage)) {
      throw new Error('Branch management requires COW-enabled storage')
    }

    const refManager = (this.storage as any).refManager
    const refs = await refManager.listRefs()

    // Filter to branches only (exclude tags)
    return refs
      .filter((ref: any) => ref.name.startsWith('refs/heads/'))
      .map((ref: any) => ref.name.replace('refs/heads/', ''))
  }

  /**
   * Get current branch name
   * @returns Current branch name
   *
   * @example
   * ```typescript
   * const current = await brain.getCurrentBranch()
   * console.log(current) // 'main'
   * ```
   */
  async getCurrentBranch(): Promise<string> {
    await this.ensureInitialized()

    if (!('currentBranch' in this.storage)) {
      return 'main' // Default branch
    }

    return (this.storage as any).currentBranch || 'main'
  }

  /**
   * Switch to a different branch
   * @param branch - Branch name to switch to
   *
   * @example
   * ```typescript
   * await brain.checkout('experiment')
   * console.log(await brain.getCurrentBranch()) // 'experiment'
   * ```
   */
  async checkout(branch: string): Promise<void> {
    await this.ensureInitialized()

    if (!('refManager' in this.storage)) {
      throw new Error('Branch management requires COW-enabled storage')
    }

      // Verify branch exists
      const branches = await this.listBranches()
      if (!branches.includes(branch)) {
        throw new Error(`Branch '${branch}' does not exist`)
      }

      // Update storage currentBranch
      (this.storage as any).currentBranch = branch

      // Fix: Reload indexes from new branch WITHOUT recreating storage
      // Previous implementation called init() which recreated storage, losing currentBranch
      this.index = this.createIndex()
      const checkoutMetadataFactory = this.pluginRegistry.getProvider<(storage: StorageAdapter) => any>('metadataIndex')
      this.metadataIndex = checkoutMetadataFactory
        ? checkoutMetadataFactory(this.storage)
        : new MetadataIndexManager(this.storage)
      await this.metadataIndex.init()

      // GraphAdjacencyIndex SINGLETON pattern for checkout()
      // Invalidate the old graphIndex (it has data from the old branch)
      // and get a fresh instance for the new branch
      ;(this.storage as any).invalidateGraphIndex()
      const checkoutGraphFactory = this.pluginRegistry.getProvider<(storage: StorageAdapter) => any>('graphIndex')
      if (checkoutGraphFactory) {
        this.graphIndex = checkoutGraphFactory(this.storage)
        this.storage.setGraphIndex(this.graphIndex)
      } else {
        this.graphIndex = await (this.storage as any).getGraphIndex()
      }

      // Reset lazy loading state when switching branches
      // Indexes contain data from previous branch, must rebuild for new branch
      this.lazyRebuildCompleted = false

      // Rebuild indexes from new branch data (force=true to override disableAutoRebuild)
      await this.rebuildIndexesIfNeeded(true)

      // Clear VFS caches before recreating VFS for new branch
      // UnifiedCache is global, so old branch's VFS path cache entries would persist
      if (this._vfs) {
        // Clear old PathResolver's caches including UnifiedCache entries
        if ((this._vfs as any).pathResolver?.invalidateAllCaches) {
          (this._vfs as any).pathResolver.invalidateAllCaches()
        }
        // Recreate VFS for new branch
        this._vfs = new VirtualFileSystem(this)
        await this._vfs.init()
      }
  }

  /**
   * Create a commit with current state
   * @param options - Commit options (message, author, metadata)
   * @returns Commit hash
   *
   * @example
   * ```typescript
   * await brain.add({ noun: 'user', data: { name: 'Alice' } })
   * const commitHash = await brain.commit({
   *   message: 'Add Alice user',
   *   author: 'dev@example.com'
   * })
   * ```
   */
  async commit(options?: {
    message?: string
    author?: string
    metadata?: Record<string, any>
    captureState?: boolean  // Capture entity snapshots for time-travel
  }): Promise<string> {
    await this.ensureInitialized()

    if (!('refManager' in this.storage) || !('commitLog' in this.storage) || !('blobStorage' in this.storage)) {
        throw new Error('Commit requires COW-enabled storage')
      }

      const refManager = (this.storage as any).refManager
      const blobStorage = (this.storage as any).blobStorage
      const currentBranch = await this.getCurrentBranch()

      // Get current HEAD commit (parent)
      const currentCommitHash = await refManager.resolveRef(currentBranch)

      // Get current state statistics
      const entityCount = await this.getNounCount()
      const relationshipCount = await this.getVerbCount()

      // Import NULL_HASH constant
      const { NULL_HASH } = await import('./storage/cow/constants.js')

      // Capture entity state if requested (for time-travel)
      let treeHash = NULL_HASH
      if (options?.captureState) {
        treeHash = await this.captureStateToTree()
      }

      // Build commit object using builder pattern
      const builder = CommitBuilder.create(blobStorage)
        .tree(treeHash) // Use captured state tree or NULL_HASH
        .message(options?.message || 'Snapshot commit')
        .author(options?.author || 'unknown')
        .timestamp(Date.now())
        .entityCount(entityCount)
        .relationshipCount(relationshipCount)

      // Set parent if this is not the first commit
      if (currentCommitHash) {
        builder.parent(currentCommitHash)
      }

      // Add custom metadata
      if (options?.metadata) {
        Object.entries(options.metadata).forEach(([key, value]) => {
          builder.meta(key, value)
        })
      }

      // Build and persist commit (returns hash directly)
      const commitHash = await builder.build()

      // Update branch ref to point to new commit
      await refManager.setRef(currentBranch, commitHash, {
        author: options?.author || 'unknown',
        message: options?.message || 'Snapshot commit'
      })

      return commitHash
  }

  /**
   * Capture current entity and relationship state to tree object
   * Used by commit({ captureState: true }) for time-travel
   *
   * Serializes ALL entities + relationships to blobs and builds a tree.
   * BlobStorage automatically deduplicates unchanged data.
   *
   * Handles all storage adapters including sharded/distributed setups.
   * Storage adapter is responsible for aggregating data from all shards.
   *
   * Performance: O(n+m) where n = entity count, m = relationship count
   * - 1K entities + 500 relations: ~150ms
   * - 100K entities + 50K relations: ~1.5s
   * - 1M entities + 500K relations: ~8s
   *
   * @returns Tree hash containing all entities and relationships
   * @private
   */
  private async captureStateToTree(): Promise<string> {
    const blobStorage = (this.storage as any).blobStorage as BlobStorage
    const { TreeBuilder } = await import('./storage/cow/TreeObject.js')

    // Query ALL entities (excludeVFS: false to capture VFS files too - default behavior)
    const entityResults = await this.find({ excludeVFS: false })

    // Query ALL relationships with pagination (handles sharding via storage adapter)
    const allRelations: any[] = []
    let hasMore = true
    let offset = 0
    const limit = 1000  // Fetch in batches

    while (hasMore) {
      const relationResults = await this.storage.getVerbs({
        pagination: { offset, limit }
      })

      allRelations.push(...relationResults.items)
      hasMore = relationResults.hasMore
      offset += limit
    }

    // Return NULL_HASH for empty workspace (no data to capture)
    if (entityResults.length === 0 && allRelations.length === 0) {
      console.log(`[captureStateToTree] Empty workspace - returning NULL_HASH`)
      return NULL_HASH
    }

    console.log(`[captureStateToTree] Capturing ${entityResults.length} entities + ${allRelations.length} relationships to tree`)

    // Build tree with TreeBuilder
    const builder = TreeBuilder.create(blobStorage)

    // Serialize each entity to blob and add to tree
    for (const result of entityResults) {
      const entity = result.entity

      // Serialize entity to JSON
      const entityJson = JSON.stringify(entity)
      const entityBlob = Buffer.from(entityJson)

      // Write to BlobStorage (auto-deduplicates by content hash)
      const blobHash = await blobStorage.write(entityBlob, {
        type: 'blob',
        compression: 'auto'  // Compress large entities (>10KB)
      })

      // Add to tree: entities/entity-id → blob-hash
      await builder.addBlob(`entities/${entity.id}`, blobHash, entityBlob.length)
    }

    // Serialize each relationship to blob and add to tree
    for (const relation of allRelations) {
      // Serialize relationship to JSON
      const relationJson = JSON.stringify(relation)
      const relationBlob = Buffer.from(relationJson)

      // Write to BlobStorage (auto-deduplicates by content hash)
      const blobHash = await blobStorage.write(relationBlob, {
        type: 'blob',
        compression: 'auto'
      })

      // Add to tree: relations/sourceId-targetId-verb → blob-hash
      // Use sourceId-targetId-verb as unique identifier for each relationship
      const relationKey = `relations/${relation.sourceId}-${relation.targetId}-${relation.verb}`
      await builder.addBlob(relationKey, blobHash, relationBlob.length)
    }

    // Build and persist tree, return hash
    const treeHash = await builder.build()

    console.log(`[captureStateToTree] Tree created: ${treeHash.slice(0, 8)} with ${entityResults.length} entities + ${allRelations.length} relationships`)

    return treeHash
  }

  /**
   * Create a read-only snapshot of the workspace at a specific commit
   *
   * Time-travel API for historical queries. Returns a new Brainy instance that:
   * - Contains all entities and relationships from that commit
   * - Has all indexes rebuilt (HNSW, MetadataIndex, GraphAdjacencyIndex)
   * - Supports full triple intelligence (vector + graph + metadata queries)
   * - Is read-only (throws errors on add/update/delete/commit/relate)
   * - Must be closed when done to free memory
   *
   * Performance characteristics:
   * - Initial snapshot: O(n+m) where n = entities, m = relationships
   * - Subsequent queries: Same as normal Brainy (uses rebuilt indexes)
   * - Memory overhead: Snapshot has separate in-memory indexes
   *
   * Use case: Workshop app - render file tree at historical commit
   *
   * @param commitId - Commit hash to snapshot from
   * @returns Read-only Brainy instance with historical state
   *
   * @example
   * ```typescript
   * // Create snapshot at specific commit
   * const snapshot = await brain.asOf(commitId)
   *
   * // Query historical state (full triple intelligence works!)
   * const files = await snapshot.find({
   *   query: 'AI research',
   *   where: { 'metadata.vfsType': 'file' }
   * })
   *
   * // Get historical relationships
   * const related = await snapshot.getRelated(entityId, { depth: 2 })
   *
   * // MUST close when done to free memory
   * await snapshot.close()
   * ```
   */
  async asOf(commitId: string, options?: {
    cacheSize?: number  // LRU cache size (default: 10000)
  }): Promise<Brainy> {
    await this.ensureInitialized()

    // Lazy-loading historical adapter with bounded memory
    // No eager loading of entire commit state!
    const { HistoricalStorageAdapter } = await import('./storage/adapters/historicalStorageAdapter.js')
    const { BaseStorage } = await import('./storage/baseStorage.js')

    // Create lazy-loading historical storage adapter
    const historicalStorage = new HistoricalStorageAdapter({
      underlyingStorage: this.storage as BaseStorage,
      commitId,
      cacheSize: options?.cacheSize || 10000,
      branch: await this.getCurrentBranch() || 'main'
    })

    // Initialize historical adapter (loads commit metadata, NOT entities)
    await historicalStorage.init()

    console.log(`[asOf] Historical storage adapter created for commit ${commitId.slice(0, 8)}`)

    // Create Brainy instance wrapping historical storage
    // All queries will lazy-load from historical state on-demand
    const snapshotBrain = new Brainy({
      ...this.config,
      // Use the historical adapter directly (no need for separate storage type)
      storage: historicalStorage as any
    })

    // Initialize the snapshot (creates indexes, but they'll be populated lazily)
    await snapshotBrain.init()

    // Mark as read-only snapshot (prevents writes)
    ;(snapshotBrain as any).isReadOnlySnapshot = true
    ;(snapshotBrain as any).snapshotCommitId = commitId

    console.log(`[asOf] Snapshot ready (lazy-loading, cache size: ${options?.cacheSize || 10000})`)

    return snapshotBrain
  }


  /**
   * Delete a branch/fork
   * @param branch - Branch name to delete
   *
   * @example
   * ```typescript
   * await brain.deleteBranch('old-experiment')
   * ```
   */
  async deleteBranch(branch: string): Promise<void> {
    await this.ensureInitialized()

    if (!('refManager' in this.storage)) {
      throw new Error('Branch management requires COW-enabled storage')
    }

    const currentBranch = await this.getCurrentBranch()
    if (branch === currentBranch) {
      throw new Error('Cannot delete current branch')
    }

    const refManager = (this.storage as any).refManager
    await refManager.deleteRef(branch)
  }

  /**
   * Get commit history for current branch
   * @param options - History options (limit, offset, author)
   * @returns Array of commits
   *
   * @example
   * ```typescript
   * const history = await brain.getHistory({ limit: 10 })
   * history.forEach(commit => {
   *   console.log(`${commit.hash}: ${commit.message}`)
   * })
   * ```
   */
  async getHistory(options?: {
    limit?: number
    offset?: number
    author?: string
  }): Promise<Array<{
    hash: string
    message: string
    author: string
    timestamp: number
    metadata?: Record<string, any>
  }>> {
    await this.ensureInitialized()

    if (!('commitLog' in this.storage) || !('refManager' in this.storage)) {
      throw new Error('History requires COW-enabled storage')
    }

    const commitLog = (this.storage as any).commitLog
    const currentBranch = await this.getCurrentBranch()

    // Get commit history for current branch
    const commits = await commitLog.getHistory(currentBranch, {
      maxCount: options?.limit || 10
    })

    // Map to expected format (compute hash for each commit)
    return commits.map((commit: any) => ({
      hash: (this.storage as any).blobStorage.constructor.hash(
        Buffer.from(JSON.stringify(commit))
      ),
      message: commit.message,
      author: commit.author,
      timestamp: commit.timestamp,
      metadata: commit.metadata
    }))
  }

  /**
   * Stream commit history (memory-efficient)
   *
   * Use this for large commit histories (1000s of snapshots) where memory
   * efficiency is critical. Yields commits one at a time without accumulating
   * them in memory.
   *
   * For small histories (< 100 commits), use getHistory() for simpler API.
   *
   * @param options - History options
   * @param options.limit - Maximum number of commits to stream
   * @param options.since - Only include commits after this timestamp
   * @param options.until - Only include commits before this timestamp
   * @param options.author - Filter by author name
   *
   * @yields Commit metadata in reverse chronological order (newest first)
   *
   * @example
   * ```typescript
   * // Stream all commits without memory accumulation
   * for await (const commit of brain.streamHistory({ limit: 10000 })) {
   *   console.log(`${commit.timestamp}: ${commit.message}`)
   * }
   *
   * // Stream with filtering
   * for await (const commit of brain.streamHistory({
   *   author: 'alice',
   *   since: Date.now() - 86400000  // Last 24 hours
   * })) {
   *   // Process commit
   * }
   * ```
   */
  async *streamHistory(options?: {
    limit?: number
    since?: number
    until?: number
    author?: string
  }): AsyncIterableIterator<{
    hash: string
    message: string
    author: string
    timestamp: number
    metadata?: Record<string, any>
  }> {
    await this.ensureInitialized()

    if (!('commitLog' in this.storage) || !('refManager' in this.storage)) {
      throw new Error('History streaming requires COW-enabled storage')
    }

    const commitLog = (this.storage as any).commitLog
    const currentBranch = await this.getCurrentBranch()
    const blobStorage = (this.storage as any).blobStorage

    // Stream commits from CommitLog
    for await (const commit of commitLog.streamHistory(currentBranch, {
      maxCount: options?.limit,
      since: options?.since,
      until: options?.until
    })) {
      // Filter by author if specified
      if (options?.author && commit.author !== options.author) {
        continue
      }

      // Map to expected format (compute hash for commit)
      yield {
        hash: blobStorage.constructor.hash(
          Buffer.from(JSON.stringify(commit))
        ),
        message: commit.message,
        author: commit.author,
        timestamp: commit.timestamp,
        metadata: commit.metadata
      }
    }
  }

  /**
   * Get total count of nouns - O(1) operation
   * @returns Promise that resolves to the total number of nouns
   */
  async getNounCount(): Promise<number> {
    await this.ensureInitialized()
    return this.storage.getNounCount()
  }

  /**
   * Get total count of verbs - O(1) operation
   * @returns Promise that resolves to the total number of verbs
   */
  async getVerbCount(): Promise<number> {
    await this.ensureInitialized()
    return this.storage.getVerbCount()
  }

  /**
   * Get memory statistics and limits
   *
   * Returns detailed memory information including:
   * - Current heap usage
   * - Container memory limits (if detected)
   * - Query limits and how they were calculated
   * - Memory allocation recommendations
   *
   * Use this to debug why query limits are low or to understand
   * memory allocation in production environments.
   *
   * @returns Memory statistics and configuration
   *
   * @example
   * ```typescript
   * const stats = brain.getMemoryStats()
   * console.log(`Query limit: ${stats.limits.maxQueryLimit}`)
   * console.log(`Basis: ${stats.limits.basis}`)
   * console.log(`Free memory: ${Math.round(stats.memory.free / 1024 / 1024)}MB`)
   * ```
   */
  getMemoryStats(): {
    memory: {
      heapUsed: number
      heapTotal: number
      external: number
      rss: number
      free: number
      total: number
      containerLimit: number | null
    }
    limits: {
      maxQueryLimit: number
      maxQueryLength: number
      maxVectorDimensions: number
      basis: 'override' | 'reservedMemory' | 'containerMemory' | 'freeMemory'
    }
    config: {
      maxQueryLimit?: number
      reservedQueryMemory?: number
    }
    recommendations?: string[]
  } {
    const config = ValidationConfig.getInstance()
    const heapStats = process.memoryUsage ? process.memoryUsage() : {
      heapUsed: 0,
      heapTotal: 0,
      external: 0,
      rss: 0
    }

    // Get system memory info
    let freeMemory = 0
    let totalMemory = 0
    if (typeof window === 'undefined') {
      try {
        const os = require('node:os')
        freeMemory = os.freemem()
        totalMemory = os.totalmem()
      } catch (e) {
        // OS module not available
      }
    }

    const stats = {
      memory: {
        heapUsed: heapStats.heapUsed,
        heapTotal: heapStats.heapTotal,
        external: heapStats.external,
        rss: heapStats.rss,
        free: freeMemory,
        total: totalMemory,
        containerLimit: config.detectedContainerLimit
      },
      limits: {
        maxQueryLimit: config.maxLimit,
        maxQueryLength: config.maxQueryLength,
        maxVectorDimensions: config.maxVectorDimensions,
        basis: config.limitBasis
      },
      config: {
        maxQueryLimit: this.config.maxQueryLimit,
        reservedQueryMemory: this.config.reservedQueryMemory
      },
      recommendations: [] as string[]
    }

    // Generate recommendations based on stats
    if (stats.limits.basis === 'freeMemory' && stats.memory.containerLimit) {
      stats.recommendations.push(
        `Container detected (${Math.round(stats.memory.containerLimit / 1024 / 1024)}MB) but limits based on free memory. ` +
        `Consider setting reservedQueryMemory config option for better limits.`
      )
    }

    if (stats.limits.maxQueryLimit < 5000 && stats.memory.containerLimit && stats.memory.containerLimit > 2 * 1024 * 1024 * 1024) {
      stats.recommendations.push(
        `Query limit is low (${stats.limits.maxQueryLimit}) despite ${Math.round(stats.memory.containerLimit / 1024 / 1024 / 1024)}GB container. ` +
        `Consider: new Brainy({ reservedQueryMemory: 1073741824 }) to reserve 1GB for queries.`
      )
    }

    if (stats.limits.basis === 'override') {
      stats.recommendations.push(
        `Using explicit maxQueryLimit override (${stats.limits.maxQueryLimit}). ` +
        `Auto-detection bypassed.`
      )
    }

    return stats
  }

  // ============= SUB-APIS =============

  /**
   * Neural API - Advanced AI operations
   */
  neural(): ImprovedNeuralAPI {
    if (!this._neural) {
      this._neural = new ImprovedNeuralAPI(this as any)
    }
    return this._neural
  }

  /**
   * Versioning API - Entity version control
   *
   * Provides entity-level versioning with:
   * - save() - Create version of entity
   * - restore() - Restore entity to specific version
   * - list() - List all versions of entity
   * - compare() - Deep diff between versions
   * - prune() - Remove old versions (retention policies)
   *
   * @example
   * ```typescript
   * // Save current state
   * const version = await brain.versions.save('user-123', { tag: 'v1.0' })
   *
   * // List versions
   * const versions = await brain.versions.list('user-123')
   *
   * // Restore to previous version
   * await brain.versions.restore('user-123', 5)
   *
   * // Compare versions
   * const diff = await brain.versions.compare('user-123', 2, 5)
   * ```
   */
  get versions(): VersioningAPI {
    if (!this._versions) {
      this._versions = new VersioningAPI(this as any)
    }
    return this._versions
  }

  /**
   * Natural Language Processing API
   */
  nlp(): NaturalLanguageProcessor {
    if (!this._nlp) {
      this._nlp = new NaturalLanguageProcessor(this)
    }
    return this._nlp
  }

  /**
   * Entity Extraction API - Neural extraction with NounType taxonomy
   *
   * Extracts entities from text using:
   * - Pattern-based candidate detection
   * - Embedding-based type classification
   * - Context-aware confidence scoring
   *
   * @param text - Text to extract entities from
   * @param options - Extraction options
   * @returns Array of extracted entities with types and confidence
   *
   * @example
   * const entities = await brain.extract('John Smith founded Acme Corp in New York')
   * // [
   * //   { text: 'John Smith', type: NounType.Person, confidence: 0.95 },
   * //   { text: 'Acme Corp', type: NounType.Organization, confidence: 0.92 },
   * //   { text: 'New York', type: NounType.Location, confidence: 0.88 }
   * // ]
   */
  async extract(
    text: string,
    options?: {
      types?: NounType[]
      confidence?: number
      includeVectors?: boolean
      neuralMatching?: boolean
    }
  ): Promise<ExtractedEntity[]> {
    if (!this._extractor) {
      this._extractor = new NeuralEntityExtractor(this)
    }
    return await this._extractor.extract(text, options)
  }

  /**
   * Extract entities from text (alias for extract())
   * Added for API clarity and Workshop team request
   *
   * Uses NeuralEntityExtractor with SmartExtractor ensemble (4-signal architecture):
   * - ExactMatch (40%) - Dictionary lookups
   * - Embedding (35%) - Semantic similarity
   * - Pattern (20%) - Regex patterns
   * - Context (5%) - Contextual hints
   *
   * @param text - Text to extract entities from
   * @param options - Extraction options
   * @returns Array of extracted entities with types and confidence scores
   *
   * @example
   * ```typescript
   * const entities = await brain.extractEntities('John Smith founded Acme Corp', {
   *   confidence: 0.7,
   *   types: [NounType.Person, NounType.Organization],
   *   neuralMatching: true
   * })
   * ```
   */
  async extractEntities(
    text: string,
    options?: {
      types?: NounType[]
      confidence?: number
      includeVectors?: boolean
      neuralMatching?: boolean
    }
  ): Promise<ExtractedEntity[]> {
    return this.extract(text, options)
  }

  /**
   * Extract concepts from text
   *
   * Simplified interface for concept/topic extraction
   * Returns only concept names as strings for easy metadata population
   *
   * @param text - Text to extract concepts from
   * @param options - Extraction options
   * @returns Array of concept names
   *
   * @example
   * const concepts = await brain.extractConcepts('Using OAuth for authentication')
   * // ['oauth', 'authentication']
   */
  async extractConcepts(
    text: string,
    options?: {
      confidence?: number
      limit?: number
    }
  ): Promise<string[]> {
    const entities = await this.extract(text, {
      types: [NounType.Concept, NounType.Concept],
      confidence: options?.confidence || 0.7,
      neuralMatching: true
    })

    // Deduplicate and normalize
    const conceptSet = new Set(entities.map(e => e.text.toLowerCase()))
    const concepts = Array.from(conceptSet)

    // Apply limit if specified
    return options?.limit ? concepts.slice(0, options.limit) : concepts
  }

  /**
   * Import files with intelligent extraction and dual storage (VFS + Knowledge Graph)
   *
   * Unified import system that:
   * - Auto-detects format (Excel, PDF, CSV, JSON, Markdown)
   * - Extracts entities with AI-powered name/type detection
   * - Infers semantic relationships from context
   * - Stores in both VFS (organized files) and Knowledge Graph (connected entities)
   * - Links VFS files to graph entities
   *
   * @since 4.0.0
   *
   * @example Quick Start (All AI features enabled by default)
   * ```typescript
   * const result = await brain.import('./glossary.xlsx')
   * // Auto-detects format, extracts entities, infers relationships
   * ```
   *
   * @example Full-Featured Import (v4.x)
   * ```typescript
   * const result = await brain.import('./data.xlsx', {
   *   // AI features
   *   enableNeuralExtraction: true,      // Extract entity names/metadata
   *   enableRelationshipInference: true, // Detect semantic relationships
   *   enableConceptExtraction: true,     // Extract types/concepts
   *
   *   // VFS features
   *   vfsPath: '/imports/my-data',       // Store in VFS directory
   *   groupBy: 'type',                   // Organize by entity type
   *   preserveSource: true,              // Keep original file
   *
   *   // Progress tracking (STANDARDIZED FOR ALL 7 FORMATS!)
   *   onProgress: (p) => {
   *     console.log(`[${p.stage}] ${p.message}`)
   *     console.log(`Entities: ${p.entities || 0}, Rels: ${p.relationships || 0}`)
   *     if (p.throughput) console.log(`Rate: ${p.throughput.toFixed(1)}/sec`)
   *   }
   * })
   * // THIS SAME HANDLER WORKS FOR CSV, PDF, Excel, JSON, Markdown, YAML, DOCX!
   * ```
   *
   * @example Universal Progress Handler
   * ```typescript
   * // ONE handler for ALL 7 formats - no format-specific code needed!
   * const universalProgress = (p) => {
   *   updateUI(p.stage, p.message, p.entities, p.relationships)
   * }
   *
   * await brain.import(csvBuffer, { onProgress: universalProgress })
   * await brain.import(pdfBuffer, { onProgress: universalProgress })
   * await brain.import(excelBuffer, { onProgress: universalProgress })
   * // Works for JSON, Markdown, YAML, DOCX too!
   * ```
   *
   * @example Performance Tuning (Large Files)
   * ```typescript
   * const result = await brain.import('./huge-file.csv', {
   *   enableDeduplication: false,  // Skip dedup for speed
   *   confidenceThreshold: 0.8,    // Higher threshold = fewer entities
   *   onProgress: (p) => console.log(`${p.processed}/${p.total}`)
   * })
   * ```
   *
   * @example Import from Buffer or Object
   * ```typescript
   * // From buffer
   * const result = await brain.import(buffer, { format: 'pdf' })
   *
   * // From object
   * const result = await brain.import({ entities: [...] })
   * ```
   *
   * @throws {Error} If invalid options are provided (v4.x breaking changes)
   *
   * @see {@link https://brainy.dev/docs/api/import API Documentation}
   * @see {@link https://brainy.dev/docs/guides/migrating-to-v4 Migration Guide}
   * @see {@link https://brainy.dev/docs/guides/standard-import-progress Standard Progress API}
   *
   * @remarks
   * **⚠️ Breaking Changes from v3.x:**
   *
   * The import API was redesigned for clarity and better feature control.
   * Old v3.x option names are **no longer recognized** and will throw errors.
   *
   * **Option Changes:**
   * - ❌ `extractRelationships` → ✅ `enableRelationshipInference`
   * - ❌ `createFileStructure` → ✅ `vfsPath: '/your/path'`
   * - ❌ `autoDetect` → ✅ *(removed - always enabled)*
   * - ❌ `excelSheets` → ✅ *(removed - all sheets processed)*
   * - ❌ `pdfExtractTables` → ✅ *(removed - always enabled)*
   *
   * **New Options:**
   * - ✅ `enableNeuralExtraction` - Extract entity names via AI
   * - ✅ `enableConceptExtraction` - Extract entity types via AI
   * - ✅ `preserveSource` - Save original file in VFS
   *
   * **If you get an error:**
   * The error message includes migration instructions and examples.
   * See the complete migration guide for all details.
   *
   * **Why these changes?**
   * - Clearer option names (explicitly describe what they do)
   * - Separation of concerns (neural, relationships, VFS are separate)
   * - Better defaults (AI features enabled by default)
   * - Reduced confusion (removed redundant options)
   */
  async import(
    source: Buffer | string | object,
    options?: {
      format?: 'excel' | 'pdf' | 'csv' | 'json' | 'markdown' | 'yaml' | 'docx' | 'image'
      vfsPath?: string
      groupBy?: 'type' | 'sheet' | 'flat' | 'custom'
      customGrouping?: (entity: any) => string
      createEntities?: boolean
      createRelationships?: boolean
      preserveSource?: boolean
      enableNeuralExtraction?: boolean
      enableRelationshipInference?: boolean
      enableConceptExtraction?: boolean
      confidenceThreshold?: number
      onProgress?: (progress: {
        stage: 'detecting' | 'extracting' | 'storing-vfs' | 'storing-graph' | 'relationships' | 'complete'
        phase?: 'extraction' | 'relationships'
        message: string
        processed?: number
        current?: number
        total?: number
        entities?: number
        relationships?: number
        throughput?: number
        eta?: number
      }) => void
    }
  ) {
    // Lazy load ImportCoordinator
    const { ImportCoordinator } = await import('./import/ImportCoordinator.js')
    const coordinator = new ImportCoordinator(this)
    await coordinator.init()

    return await coordinator.import(source, options)
  }

  /**
   * Virtual File System API - Knowledge Operating System
   *
   * Returns a cached VFS instance that is auto-initialized during brain.init().
   * No separate initialization needed!
   *
   * @example After import
   * ```typescript
   * await brain.import('./data.xlsx', { vfsPath: '/imports/data' })
   * // VFS ready immediately - no init() call needed!
   * const files = await brain.vfs.readdir('/imports/data')
   * ```
   *
   * @example Direct VFS usage
   * ```typescript
   * await brain.init()  // VFS auto-initialized here!
   * await brain.vfs.writeFile('/docs/readme.md', 'Hello World')
   * const content = await brain.vfs.readFile('/docs/readme.md')
   * ```
   *
   * @example With fork (COW isolation)
   * ```typescript
   * await brain.init()
   * await brain.vfs.writeFile('/config.json', '{"v": 1}')
   *
   * const fork = await brain.fork('experiment')
   * // Fork inherits parent's files
   * const config = await fork.vfs.readFile('/config.json')
   * // Fork modifications are isolated
   * await fork.vfs.writeFile('/test.txt', 'Fork only')
   * ```
   *
   * **Pattern:** The VFS instance is cached, so multiple calls to brain.vfs
   * return the same instance. This ensures import and user code share state.
   *
   */
  get vfs(): VirtualFileSystem {
    if (!this._vfs) {
      // VFS is initialized during brain.init()
      // If not initialized yet, create instance but user should call brain.init() first
      this._vfs = new VirtualFileSystem(this)
    }
    // Warn if VFS accessed before init() completed
    if (!this._vfsInitialized && this.initialized) {
      console.warn('[Brainy] VFS accessed before initialization complete. Call await brain.init() first.')
    }
    return this._vfs
  }

  /**
   * Integration Hub for external tools (Excel, Power BI, Google Sheets)
   *
   * Provides HTTP endpoints that external tools can connect to:
   * - OData API for Excel Power Query, Power BI, Tableau
   * - REST API for Google Sheets custom functions
   * - SSE streaming for real-time dashboards
   * - Webhooks for push notifications
   *
   * Only available when `integrations: true` is set in config.
   *
   * @example Basic usage
   * ```typescript
   * const brain = new Brainy({ integrations: true })
   * await brain.init()
   *
   * // Get endpoint URLs
   * console.log(brain.hub.endpoints)
   * // { odata: '/odata', sheets: '/sheets', sse: '/events', webhooks: '/webhooks' }
   *
   * // Handle requests (use with Express, Hono, etc.)
   * app.all('/odata/*', async (req, res) => {
   *   const response = await brain.hub.handleRequest({
   *     method: req.method,
   *     path: req.path,
   *     query: req.query,
   *     headers: req.headers,
   *     body: req.body
   *   })
   *   res.status(response.status).set(response.headers).json(response.body)
   * })
   * ```
   *
   * @throws Error if integrations are not enabled in config
   */
  get hub(): IntegrationHub {
    if (!this._hub) {
      throw new Error(
        'Integration Hub not enabled. Set integrations: true in config:\n' +
        'new Brainy({ integrations: true })'
      )
    }
    return this._hub
  }

  /**
   * Data Management API - backup, restore, import, export
   */
  async data() {
    const { DataAPI } = await import('./api/DataAPI.js')
    return new DataAPI(
      this.storage,
      (id: string) => this.get(id),
      undefined, // No getRelation method yet
      this
    )
  }

  /**
   * Get Triple Intelligence System
   * Advanced pattern recognition and relationship analysis
   */
  getTripleIntelligence(): TripleIntelligenceSystem {
    if (!this._tripleIntelligence) {
      // Use core components directly - no lazy loading needed
      this._tripleIntelligence = new TripleIntelligenceSystem(
        this.metadataIndex,
        this.index,
        this.graphIndex,
        async (text: string) => this.embedder(text),
        this.storage
      )
    }
    return this._tripleIntelligence
  }

  // ============= METADATA INTELLIGENCE API =============
  
  /**
   * Get all indexed field names currently in the metadata index
   * Essential for dynamic query building and NLP field discovery
   */
  async getAvailableFields(): Promise<string[]> {
    await this.ensureInitialized()
    return this.metadataIndex.getFilterFields()
  }
  
  /**
   * Get field statistics including cardinality and query patterns
   * Used for query optimization and understanding data distribution
   */
  async getFieldStatistics(): Promise<Map<string, any>> {
    await this.ensureInitialized()
    return this.metadataIndex.getFieldStatistics()
  }
  
  /**
   * Get fields sorted by cardinality for optimal filtering
   * Lower cardinality fields are better for initial filtering
   */
  async getFieldsWithCardinality(): Promise<Array<{
    field: string
    cardinality: number
    distribution: string
  }>> {
    await this.ensureInitialized()
    return this.metadataIndex.getFieldsWithCardinality()
  }
  
  /**
   * Get optimal query plan for a given set of filters
   * Returns field processing order and estimated cost
   */
  async getOptimalQueryPlan(filters: Record<string, any>): Promise<{
    strategy: 'exact' | 'range' | 'hybrid'
    fieldOrder: string[]
    estimatedCost: number
  }> {
    await this.ensureInitialized()
    return this.metadataIndex.getOptimalQueryPlan(filters)
  }
  
  /**
   * Get filter values for a specific field (for UI dropdowns, etc)
   */
  async getFieldValues(field: string): Promise<string[]> {
    await this.ensureInitialized()
    return this.metadataIndex.getFilterValues(field)
  }
  
  /**
   * Get fields that commonly appear with a specific entity type
   * Essential for type-aware NLP parsing
   */
  async getFieldsForType(nounType: NounType): Promise<Array<{
    field: string
    affinity: number
    occurrences: number
    totalEntities: number
  }>> {
    await this.ensureInitialized()
    return this.metadataIndex.getFieldsForType(nounType)
  }
  

  /**
   * Create a streaming pipeline
   */
  stream() {
    const { Pipeline } = require('./streaming/pipeline.js')
    return new Pipeline(this)
  }

  /**
   * Get insights about the data
   */
  async insights(): Promise<{
    entities: number
    relationships: number
    types: Record<string, number>
    services: string[]
    density: number
  }> {
    await this.ensureInitialized()
    
    // O(1) entity counting using existing MetadataIndexManager
    const entities = this.metadataIndex.getTotalEntityCount()

    // O(1) count by type using existing index tracking
    const typeCountsMap = this.metadataIndex.getAllEntityCounts()
    const types: Record<string, number> = Object.fromEntries(typeCountsMap)

    // O(1) relationships count using GraphAdjacencyIndex
    const relationships = this.graphIndex.getTotalRelationshipCount()
    
    // Get unique services - O(log n) using index
    const serviceValues = await this.metadataIndex.getFilterValues('service')
    const services = serviceValues.filter(Boolean)
    
    // Calculate density (relationships per entity)
    const density = entities > 0 ? relationships / entities : 0
    
    return {
      entities,
      relationships,
      types,
      services,
      density
    }
  }

  /**
   * Flush all indexes and caches to persistent storage
   * CRITICAL FIX: Ensures data survives server restarts
   *
   * Flushes all 4 core indexes:
   * 1. Storage counts (entity/verb counts by type)
   * 2. Metadata index (field indexes + EntityIdMapper)
   * 3. Graph adjacency index (relationship cache)
   * 4. HNSW vector index (deferred dirty nodes)
   *
   * @example
   * // Flush after bulk operations
   * await brain.import('./data.xlsx')
   * await brain.flush()
   *
   * // Flush before shutdown
   * process.on('SIGTERM', async () => {
   *   await brain.flush()
   *   process.exit(0)
   * })
   */
  async flush(): Promise<void> {
    await this.ensureInitialized()

    console.log('Flushing Brainy indexes and caches to disk...')

    const startTime = Date.now()

    // Flush all components in parallel for performance
    await Promise.all([
      // 1. Flush storage adapter counts (entity/verb counts by type)
      (async () => {
        if (this.storage && typeof (this.storage as any).flushCounts === 'function') {
          await (this.storage as any).flushCounts()
        }
      })(),

      // 2. Flush metadata index (field indexes + EntityIdMapper)
      this.metadataIndex.flush(),

      // 3. Flush graph adjacency index (relationship cache + LSM trees)
      this.graphIndex.flush(),

      // 4. Flush HNSW dirty nodes (deferred persistence mode)
      (async () => {
        if (this.index && typeof (this.index as any).flush === 'function') {
          await (this.index as any).flush()
        }
      })()
    ])

    const elapsed = Date.now() - startTime

    console.log(`All indexes flushed to disk in ${elapsed}ms`)
  }

  /**
   * Get index loading status (Diagnostic for lazy loading)
   *
   * Returns detailed information about index population and lazy loading state.
   * Useful for debugging empty query results or performance troubleshooting.
   *
   * @example
   * ```typescript
   * const status = await brain.getIndexStatus()
   * console.log(`HNSW Index: ${status.hnswIndex.size} entities`)
   * console.log(`Metadata Index: ${status.metadataIndex.entries} entries`)
   * console.log(`Graph Index: ${status.graphIndex.relationships} relationships`)
   * console.log(`Lazy rebuild completed: ${status.lazyRebuildCompleted}`)
   * ```
   */
  async getIndexStatus(): Promise<{
    initialized: boolean
    lazyRebuildCompleted: boolean
    disableAutoRebuild: boolean
    hnswIndex: {
      size: number
      populated: boolean
    }
    metadataIndex: {
      entries: number
      populated: boolean
    }
    graphIndex: {
      relationships: number
      populated: boolean
    }
    storage: {
      totalEntities: number
    }
  }> {
    const metadataStats = await this.metadataIndex.getStats()
    const hnswSize = this.index.size()
    const graphSize = await this.graphIndex.size()

    // Check storage entity count
    let storageEntityCount = 0
    try {
      const entities = await this.storage.getNouns({ pagination: { limit: 1 } })
      storageEntityCount = entities.totalCount || 0
    } catch (e) {
      // Ignore errors
    }

    return {
      initialized: this.initialized,
      lazyRebuildCompleted: this.lazyRebuildCompleted,
      disableAutoRebuild: this.config.disableAutoRebuild || false,
      hnswIndex: {
        size: hnswSize,
        populated: hnswSize > 0
      },
      metadataIndex: {
        entries: metadataStats.totalEntries,
        populated: metadataStats.totalEntries > 0
      },
      graphIndex: {
        relationships: graphSize,
        populated: graphSize > 0
      },
      storage: {
        totalEntities: storageEntityCount
      }
    }
  }

  /**
   * Plugin and provider diagnostics — shows what's active and how subsystems are wired.
   *
   * @example
   * ```typescript
   * const diag = brain.diagnostics()
   * console.log(diag.providers) // { hnsw: { source: 'plugin' }, ... }
   * console.log(diag.indexes.graph.wiredToStorage) // true
   * ```
   */
  diagnostics(): DiagnosticsResult {
    const wellKnownKeys = [
      'metadataIndex', 'graphIndex', 'entityIdMapper', 'cache',
      'hnsw', 'roaring', 'embeddings', 'embedBatch', 'distance', 'msgpack'
    ] as const

    const providers: Record<string, { source: 'plugin' | 'default' }> = {}
    for (const key of wellKnownKeys) {
      providers[key] = {
        source: this.pluginRegistry.hasProvider(key) ? 'plugin' : 'default'
      }
    }

    const hnswSize = this.index.size()
    const metadataInitialized = !!this.metadataIndex
    const graphInitialized = !!this.graphIndex
    const storageGraphIndex = (this.storage as any).graphIndex

    return {
      version: getBrainyVersion(),
      plugins: {
        active: this.pluginRegistry.getActivePlugins(),
        count: this.pluginRegistry.getActivePlugins().length
      },
      providers,
      indexes: {
        hnsw: {
          size: hnswSize,
          type: this.index.constructor.name
        },
        metadata: {
          type: this.metadataIndex?.constructor.name || 'none',
          initialized: metadataInitialized
        },
        graph: {
          type: this.graphIndex?.constructor.name || 'none',
          initialized: graphInitialized,
          wiredToStorage: graphInitialized && storageGraphIndex === this.graphIndex
        }
      }
    }
  }

  /**
   * Assert that specific providers are supplied by a plugin (not using JS fallback).
   *
   * Call after init() in production to fail fast if a paid plugin (e.g. cortex)
   * isn't providing the expected acceleration. Throws if any listed key is using
   * the default JavaScript implementation.
   *
   * @param keys - Provider keys that MUST come from a plugin
   * @throws Error listing which providers are falling back to defaults
   *
   * @example
   * ```typescript
   * const brain = new Brainy()
   * await brain.init()
   *
   * // Fail fast if cortex isn't providing these
   * brain.requireProviders(['distance', 'embeddings', 'metadataIndex', 'graphIndex'])
   * ```
   */
  requireProviders(keys: string[]): void {
    const missing = keys.filter(k => !this.pluginRegistry.hasProvider(k))
    if (missing.length > 0) {
      const active = this.pluginRegistry.getActivePlugins()
      const pluginInfo = active.length > 0
        ? `Active plugins: ${active.join(', ')}`
        : 'No plugins active'
      throw new Error(
        `[brainy] Required providers using JS fallback: ${missing.join(', ')}. ` +
        `${pluginInfo}. ` +
        `These providers must be supplied by a plugin for this deployment. ` +
        `Check plugin installation, license, and native module availability.`
      )
    }
  }

  /**
   * Efficient Pagination API - Production-scale pagination using index-first approach
   * Automatically optimizes based on query type and applies pagination at the index level
   */
  get pagination() {
    return {
      // Get paginated results with automatic optimization
      find: async (params: FindParams<T> & { page?: number, pageSize?: number }) => {
        const page = params.page || 1
        const pageSize = params.pageSize || 10
        const offset = (page - 1) * pageSize

        return this.find({
          ...params,
          limit: pageSize,
          offset
        })
      },

      // Get total count for pagination UI (O(1) when possible)
      count: async (params: Omit<FindParams<T>, 'limit' | 'offset'>) => {
        // For simple type queries, use O(1) index counting
        if (params.type && !params.query && !params.where && !params.connected) {
          const types = Array.isArray(params.type) ? params.type : [params.type]
          return types.reduce((sum, type) => sum + this.metadataIndex.getEntityCountByType(type), 0)
        }

        // For complex queries, use metadata index for efficient counting
        if (params.where || params.service) {
          let filter: any = {}
          if (params.where) Object.assign(filter, params.where)
          if (params.service) filter.service = params.service
          if (params.type) {
            const types = Array.isArray(params.type) ? params.type : [params.type]
            if (types.length === 1) {
              filter.noun = types[0]
            } else {
              const baseFilter = { ...filter }
              filter = {
                anyOf: types.map(type => ({ noun: type, ...baseFilter }))
              }
            }
          }

          const filteredIds = await this.metadataIndex.getIdsForFilter(filter)
          return filteredIds.length
        }

        // Fallback: total entity count
        return this.metadataIndex.getTotalEntityCount()
      },

      // Get pagination metadata
      meta: async (params: FindParams<T> & { page?: number, pageSize?: number }) => {
        const page = params.page || 1
        const pageSize = params.pageSize || 10
        const totalCount = await this.pagination.count(params)
        const totalPages = Math.ceil(totalCount / pageSize)

        return {
          page,
          pageSize,
          totalCount,
          totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1
        }
      }
    }
  }

  /**
   * Streaming API - Process millions of entities with constant memory using existing Pipeline
   * Integrates with index-based optimizations for maximum efficiency
   */
  get streaming(): {
    entities: (filter?: Partial<FindParams<T>>) => AsyncGenerator<Entity<T>>
    search: (params: FindParams<T>, batchSize?: number) => AsyncGenerator<{ id: string; score: number; entity: Entity<T> }>
    relationships: (filter?: { type?: string; sourceId?: string; targetId?: string }) => AsyncGenerator<any>
    pipeline: (source: AsyncIterable<any>) => any
    process: (processor: (entity: Entity<T>) => Promise<Entity<T>>, filter?: Partial<FindParams<T>>, options?: { batchSize: number; parallel: number }) => Promise<void>
  } {
    return {
      // Stream all entities with optional filtering
      entities: async function* (this: Brainy<T>, filter?: Partial<FindParams<T>>) {
        if (filter?.type || filter?.where || filter?.service) {
          // Use MetadataIndexManager for efficient filtered streaming
          let filterObj: any = {}
          if (filter.where) Object.assign(filterObj, filter.where)
          if (filter.service) filterObj.service = filter.service
          if (filter.type) {
            const types = Array.isArray(filter.type) ? filter.type : [filter.type]
            if (types.length === 1) {
              filterObj.noun = types[0]
            } else {
              const baseFilterObj = { ...filterObj }
              filterObj = {
                anyOf: types.map(type => ({ noun: type, ...baseFilterObj }))
              }
            }
          }

          const filteredIds = await this.metadataIndex.getIdsForFilter(filterObj)

          // Stream filtered entities in batches for memory efficiency
          const batchSize = 100
          for (let i = 0; i < filteredIds.length; i += batchSize) {
            const batchIds = filteredIds.slice(i, i + batchSize)
            for (const id of batchIds) {
              const entity = await this.get(id)
              if (entity) yield entity as Entity<T>
            }
          }
        } else {
          // Stream all entities using storage adapter pagination
          let offset = 0
          const batchSize = 100
          let hasMore = true

          while (hasMore) {
            const result = await this.storage.getNouns({
              pagination: { offset, limit: batchSize }
            })

            for (const noun of result.items) {
              // Convert HNSWNoun to Entity<T>
              yield noun as unknown as Entity<T>
            }

            hasMore = result.hasMore
            offset += batchSize
          }
        }
      }.bind(this),

      // Stream search results efficiently
      search: async function* (this: Brainy<T>, params: FindParams<T>, batchSize = 50) {
        const originalLimit = params.limit
        let offset = 0
        let hasMore = true

        while (hasMore) {
          const batchResults = await this.find({
            ...params,
            limit: batchSize,
            offset
          })

          for (const result of batchResults) {
            yield result
          }

          hasMore = batchResults.length === batchSize
          offset += batchSize

          // Respect original limit if specified
          if (originalLimit && offset >= originalLimit) {
            break
          }
        }
      }.bind(this),

      // Stream relationships efficiently
      relationships: async function* (this: Brainy<T>, filter?: { type?: string, sourceId?: string, targetId?: string }) {
        let offset = 0
        const batchSize = 100
        let hasMore = true

        while (hasMore) {
          const result = await this.storage.getVerbs({
            pagination: { offset, limit: batchSize },
            filter
          })

          for (const verb of result.items) {
            yield verb
          }

          hasMore = result.hasMore
          offset += batchSize
        }
      }.bind(this),

      // Create processing pipeline from stream
      pipeline: (source: AsyncIterable<any>) => {
        return createPipeline(this).source(source)
      },

      // Batch process entities with Pipeline system
      process: async function (this: Brainy<T>,
        processor: (entity: Entity<T>) => Promise<Entity<T>>,
        filter?: Partial<FindParams<T>>,
        options = { batchSize: 50, parallel: 4 }
      ) {
        return createPipeline(this)
          .source(this.streaming.entities(filter))
          .batch(options.batchSize)
          .parallelSink(async (batch: Entity<T>[]) => {
            await Promise.all(batch.map(processor))
          }, options.parallel)
          .run()
      }.bind(this)
    }
  }

  /**
   * O(1) Count API - Production-scale counting using existing indexes
   * Works across all storage adapters (FileSystem, OPFS, S3, Memory)
   *
   * Phase 1b Enhancement: Type-aware methods with 99.2% memory reduction
   */
  get counts() {
    return {
      // O(1) total entity count
      entities: () => this.metadataIndex.getTotalEntityCount(),

      // O(1) total relationship count
      relationships: () => this.graphIndex.getTotalRelationshipCount(),

      // O(1) count by type (string-based, backward compatible)
      // Added optional excludeVFS using Roaring bitmap intersection
      byType: async (typeOrOptions?: string | { excludeVFS?: boolean }, options?: { excludeVFS?: boolean }) => {
        // Handle overloaded signature: byType(type), byType({ excludeVFS }), byType(type, { excludeVFS })
        let type: string | undefined
        let excludeVFS = false

        if (typeof typeOrOptions === 'string') {
          type = typeOrOptions
          excludeVFS = options?.excludeVFS ?? false
        } else if (typeOrOptions && typeof typeOrOptions === 'object') {
          excludeVFS = typeOrOptions.excludeVFS ?? false
        }

        if (excludeVFS) {
          const allCounts = this.metadataIndex.getAllEntityCounts()
          // Uses Roaring bitmap intersection - hardware accelerated
          const vfsCounts = await this.metadataIndex.getAllVFSEntityCounts()

          if (type) {
            const total = allCounts.get(type) || 0
            const vfs = vfsCounts.get(type) || 0
            return total - vfs
          }

          // Return all counts with VFS subtracted
          const result: Record<string, number> = {}
          for (const [t, total] of allCounts) {
            const vfs = vfsCounts.get(t) || 0
            const nonVfs = total - vfs
            if (nonVfs > 0) {
              result[t] = nonVfs
            }
          }
          return result
        }

        // Default path (unchanged) - synchronous for backward compatibility
        if (type) {
          return this.metadataIndex.getEntityCountByType(type)
        }
        return Object.fromEntries(this.metadataIndex.getAllEntityCounts())
      },

      // Phase 1b: O(1) count by type enum (Uint32Array-based, more efficient)
      // Uses fixed-size type tracking: 676 bytes vs ~35KB with Maps (98.1% reduction)
      byTypeEnum: (type: NounType) => {
        return this.metadataIndex.getEntityCountByTypeEnum(type)
      },

      // Phase 1b: Get top N noun types by entity count (useful for cache warming)
      topTypes: (n: number = 10) => {
        return this.metadataIndex.getTopNounTypes(n)
      },

      // Phase 1b: Get top N verb types by count
      topVerbTypes: (n: number = 10) => {
        return this.metadataIndex.getTopVerbTypes(n)
      },

      // Phase 1b: Get all noun type counts as typed Map
      // More efficient than byType() for type-aware queries
      allNounTypeCounts: () => {
        return this.metadataIndex.getAllNounTypeCounts()
      },

      // Phase 1b: Get all verb type counts as typed Map
      allVerbTypeCounts: () => {
        return this.metadataIndex.getAllVerbTypeCounts()
      },

      // O(1) count by relationship type
      byRelationshipType: (type?: string) => {
        if (type) {
          return this.graphIndex.getRelationshipCountByType(type)
        }
        return Object.fromEntries(this.graphIndex.getAllRelationshipCounts())
      },

      // O(1) count by field-value criteria
      byCriteria: async (field: string, value: any) => {
        return this.metadataIndex.getCountForCriteria(field, value)
      },

      // Get all type counts as Map for performance-critical operations
      getAllTypeCounts: () => this.metadataIndex.getAllEntityCounts(),

      // Get complete statistics
      // Added optional excludeVFS using Roaring bitmap intersection
      getStats: async (options?: { excludeVFS?: boolean }) => {
        if (options?.excludeVFS) {
          const allCounts = this.metadataIndex.getAllEntityCounts()
          // Uses Roaring bitmap intersection - hardware accelerated
          const vfsCounts = await this.metadataIndex.getAllVFSEntityCounts()

          // Compute non-VFS counts via subtraction
          const byType: Record<string, number> = {}
          let total = 0

          for (const [type, count] of allCounts) {
            const vfs = vfsCounts.get(type) || 0
            const nonVfs = count - vfs
            if (nonVfs > 0) {
              byType[type] = nonVfs
              total += nonVfs
            }
          }

          const entityStats = { total, byType }
          const relationshipStats = this.graphIndex.getRelationshipStats()

          return {
            entities: entityStats,
            relationships: relationshipStats,
            density: total > 0 ? relationshipStats.totalRelationships / total : 0
          }
        }

        // Default path (unchanged) - synchronous for backward compatibility
        const entityStats = {
          total: this.metadataIndex.getTotalEntityCount(),
          byType: Object.fromEntries(this.metadataIndex.getAllEntityCounts())
        }
        const relationshipStats = this.graphIndex.getRelationshipStats()

        return {
          entities: entityStats,
          relationships: relationshipStats,
          density: entityStats.total > 0 ? relationshipStats.totalRelationships / entityStats.total : 0
        }
      }
    }
  }

  /**
   * Get complete statistics - convenience method
   * For more granular counting, use brain.counts API
   * Added optional excludeVFS using Roaring bitmap intersection
   * @param options Optional settings - excludeVFS: filter out VFS entities
   * @returns Complete statistics including entities, relationships, and density
   */
  async getStats(options?: { excludeVFS?: boolean }) {
    return this.counts.getStats(options)
  }

  // ============= NEW EMBEDDING & ANALYSIS APIs =============

  /**
   * Batch embed multiple texts at once
   *
   * More efficient than calling embed() multiple times due to
   * WASM batch processing optimizations.
   *
   * @param texts Array of texts to embed
   * @returns Array of embedding vectors (384 dimensions each)
   *
   * @example
   * const embeddings = await brain.embedBatch([
   *   'Machine learning is fascinating',
   *   'Deep neural networks',
   *   'Natural language processing'
   * ])
   * // embeddings.length === 3
   * // embeddings[0].length === 384
   */
  async embedBatch(texts: string[], options?: { signal?: AbortSignal }): Promise<number[][]> {
    await this.ensureInitialized()

    if (texts.length === 0) {
      return []
    }

    // Plugin provides native batch embedding — single forward pass for all texts
    const batchProvider = this.pluginRegistry.getProvider<(texts: string[]) => Promise<number[][]>>('embedBatch')
    if (batchProvider) {
      return batchProvider(texts)
    }
    // Plugin provides single-text embedding engine — map through it
    if (this.pluginRegistry.hasProvider('embeddings')) {
      return Promise.all(texts.map(t => this.embedder(t)))
    }
    // Default: WASM batch API (single forward pass, more efficient than N calls)
    return await embeddingManager.embedBatch(texts, options)
  }

  /**
   * Calculate semantic similarity between two texts
   *
   * Returns a score from 0 (completely different) to 1 (identical meaning).
   * Uses cosine similarity on embedding vectors.
   *
   * @param textA First text
   * @param textB Second text
   * @returns Similarity score between 0 and 1
   *
   * @example
   * const score = await brain.similarity(
   *   'The cat sat on the mat',
   *   'A feline was resting on the rug'
   * )
   * // score ≈ 0.85 (high semantic similarity)
   */
  async similarity(textA: string, textB: string): Promise<number> {
    await this.ensureInitialized()

    // Embed both texts
    const [vectorA, vectorB] = await Promise.all([
      this.embedder(textA),
      this.embedder(textB)
    ])

    // Calculate cosine similarity (convert from distance)
    // cosineDistance returns 1 - similarity, so similarity = 1 - distance
    const distance = this.distance(vectorA, vectorB)
    return 1 - distance
  }

  /**
   * Zero-config hybrid highlighting
   *
   * Returns both exact text matches AND semantically similar concepts.
   * Perfect for UI highlighting at different levels:
   * - matchType: 'text' = exact word match (highlight strongly)
   * - matchType: 'semantic' = concept match (highlight softly)
   *
   * @param params.query - The search query
   * @param params.text - The text to highlight (e.g., entity.data)
   * @param params.granularity - 'word' | 'phrase' | 'sentence' (default: 'word')
   * @param params.threshold - Minimum similarity for semantic matches (default: 0.5)
   * @returns Array of highlights with text, score, position, and matchType
   *
   * @example
   * ```typescript
   * const highlights = await brain.highlight({
   *   query: "david the warrior",
   *   text: "David Smith is a brave fighter who battles dragons"
   * })
   * // Returns: [
   * //   { text: "David", score: 1.0, position: [0, 5], matchType: 'text' },       // Exact
   * //   { text: "fighter", score: 0.78, position: [25, 32], matchType: 'semantic' }, // Concept
   * //   { text: "battles", score: 0.72, position: [37, 44], matchType: 'semantic' }  // Concept
   * // ]
   * ```
   */
  async highlight(params: import('./types/brainy.types.js').HighlightParams): Promise<import('./types/brainy.types.js').Highlight[]> {
    await this.ensureInitialized()

    const { query, text, granularity = 'word', threshold = 0.5, contentType, contentExtractor } = params

    if (!query || !text) {
      return []
    }

    // Extract text from structured content (JSON, HTML, Markdown)
    // Custom extractor takes priority, then built-in detection
    type ChunkWithCategory = { text: string, position: [number, number], contentCategory?: import('./types/brainy.types.js').ContentCategory }

    let segments: import('./types/brainy.types.js').ExtractedSegment[]
    if (contentExtractor) {
      segments = contentExtractor(text)
    } else {
      segments = extractForHighlighting(text, contentType)
    }

    // Build concatenated text from segments for position tracking
    // and split each segment into chunks based on granularity
    const allChunks: ChunkWithCategory[] = []
    let offset = 0
    for (const segment of segments) {
      const segmentChunks = this.splitForHighlighting(segment.text, granularity)
      for (const chunk of segmentChunks) {
        allChunks.push({
          text: chunk.text,
          position: [chunk.position[0] + offset, chunk.position[1] + offset],
          contentCategory: segment.contentCategory
        })
      }
      offset += segment.text.length + 1 // +1 for space between segments
    }

    if (allChunks.length === 0) {
      return []
    }

    // Production safety: Limit chunks to prevent memory explosion
    // At 500 words × 384 dimensions × 4 bytes = 768KB temp memory (acceptable)
    const MAX_HIGHLIGHT_CHUNKS = 500
    const chunks = allChunks.slice(0, MAX_HIGHLIGHT_CHUNKS)

    // Track all highlights (keyed by position to avoid duplicates)
    const highlightMap = new Map<string, import('./types/brainy.types.js').Highlight>()

    // === PHASE 1: Find exact text matches (score = 1.0, matchType = 'text') ===
    const queryWords = this.metadataIndex.tokenize(query)
    const queryWordsLower = new Set(queryWords.map(w => w.toLowerCase()))

    for (const chunk of chunks) {
      const chunkLower = chunk.text.toLowerCase().replace(/[^\w\s]/g, '')
      if (queryWordsLower.has(chunkLower)) {
        const key = `${chunk.position[0]}-${chunk.position[1]}`
        highlightMap.set(key, {
          text: chunk.text,
          score: 1.0,
          position: chunk.position,
          matchType: 'text',
          contentCategory: chunk.contentCategory
        })
      }
    }

    // === PHASE 2: Find semantic matches with timeout fallback ===
    // AbortController ensures the background semantic work (WASM batch embedding)
    // is cancelled on timeout or error, preventing event loop saturation and
    // WASM engine crashes from abandoned promises.
    const SEMANTIC_TIMEOUT_MS = 10_000
    const abortController = new AbortController()

    try {
      const semanticResult = await Promise.race([
        this.highlightSemanticPhase(query, chunks, threshold, highlightMap, abortController.signal),
        new Promise<'timeout'>((resolve) => setTimeout(() => resolve('timeout'), SEMANTIC_TIMEOUT_MS))
      ])

      if (semanticResult === 'timeout') {
        abortController.abort()
        const textHighlights = Array.from(highlightMap.values())
        return textHighlights.sort((a, b) => b.score - a.score)
      }
    } catch {
      abortController.abort()
      const textHighlights = Array.from(highlightMap.values())
      return textHighlights.sort((a, b) => b.score - a.score)
    }

    // Sort by score descending (text matches will be first with score=1.0)
    const highlights = Array.from(highlightMap.values())
    return highlights.sort((a, b) => b.score - a.score)
  }

  /**
   * Phase 2 of highlight(): semantic matching with batch embedding
   * @internal
   */
  private async highlightSemanticPhase(
    query: string,
    chunks: Array<{ text: string, position: [number, number], contentCategory?: import('./types/brainy.types.js').ContentCategory }>,
    threshold: number,
    highlightMap: Map<string, import('./types/brainy.types.js').Highlight>,
    signal?: AbortSignal
  ): Promise<void> {
    if (signal?.aborted) return

    // Get query embedding
    const queryVector = await this.embed(query)
    if (signal?.aborted) return

    // Batch embed all chunks using native WASM batch API
    const chunkTexts = chunks.map(c => c.text)
    const chunkVectors = await this.embedBatch(chunkTexts, { signal })
    if (signal?.aborted) return

    // Calculate semantic similarities
    for (let i = 0; i < chunks.length; i++) {
      const key = `${chunks[i].position[0]}-${chunks[i].position[1]}`

      // Skip if already a text match (text matches take priority)
      if (highlightMap.has(key)) continue

      const distance = this.distance(queryVector, chunkVectors[i])
      const similarity = 1 - distance

      if (similarity >= threshold) {
        highlightMap.set(key, {
          text: chunks[i].text,
          score: similarity,
          position: chunks[i].position,
          matchType: 'semantic',
          contentCategory: chunks[i].contentCategory
        })
      }
    }
  }

  /**
   * Split text into chunks for highlighting
   * @internal
   */
  private splitForHighlighting(text: string, granularity: string): Array<{ text: string, position: [number, number] }> {
    const results: Array<{ text: string, position: [number, number] }> = []

    if (granularity === 'word') {
      // Split on whitespace, track positions
      const regex = /\S+/g
      let match
      while ((match = regex.exec(text)) !== null) {
        // Skip stopwords
        if (!STOPWORDS.has(match[0].toLowerCase())) {
          results.push({ text: match[0], position: [match.index, match.index + match[0].length] })
        }
      }
    } else if (granularity === 'sentence') {
      // Split on sentence boundaries
      const regex = /[^.!?]+[.!?]+/g
      let match
      while ((match = regex.exec(text)) !== null) {
        results.push({ text: match[0].trim(), position: [match.index, match.index + match[0].length] })
      }
      // Handle text without sentence-ending punctuation
      if (results.length === 0 && text.trim()) {
        results.push({ text: text.trim(), position: [0, text.length] })
      }
    } else if (granularity === 'phrase') {
      // Sliding window of 2-4 words
      const words: Array<{ text: string, start: number, end: number }> = []
      const regex = /\S+/g
      let match
      while ((match = regex.exec(text)) !== null) {
        words.push({ text: match[0], start: match.index, end: match.index + match[0].length })
      }

      // Generate 2-4 word phrases
      for (let windowSize = 2; windowSize <= 4; windowSize++) {
        for (let i = 0; i <= words.length - windowSize; i++) {
          const phraseWords = words.slice(i, i + windowSize)
          const phraseText = phraseWords.map(w => w.text).join(' ')
          const start = phraseWords[0].start
          const end = phraseWords[phraseWords.length - 1].end
          results.push({ text: phraseText, position: [start, end] })
        }
      }
    }

    return results
  }

  /**
   * Get comprehensive index statistics
   *
   * Returns detailed stats about all internal indexes including
   * entity counts, vector index size, graph relationships, and
   * estimated memory usage.
   *
   * @returns Index statistics object
   *
   * @example
   * const stats = await brain.indexStats()
   * console.log(`Entities: ${stats.entities}`)
   * console.log(`Vectors: ${stats.vectors}`)
   * console.log(`Relationships: ${stats.relationships}`)
   */
  async indexStats(): Promise<{
    entities: number
    vectors: number
    relationships: number
    metadataFields: string[]
    memoryUsage: {
      vectors: number
      graph: number
      metadata: number
      total: number
    }
  }> {
    await this.ensureInitialized()

    const metadataStats = await this.metadataIndex.getStats()
    const graphStats = this.graphIndex.getStats()
    const vectorCount = this.index.size()

    // Get unique metadata field names
    const metadataFields = metadataStats.fieldsIndexed || []

    return {
      entities: metadataStats.totalEntries,
      vectors: vectorCount,
      relationships: graphStats.totalRelationships,
      metadataFields,
      memoryUsage: {
        vectors: vectorCount * 384 * 4, // 384 dimensions * 4 bytes per float32
        graph: graphStats.memoryUsage,
        metadata: metadataStats.indexSize || 0,
        total: (vectorCount * 384 * 4) + graphStats.memoryUsage + (metadataStats.indexSize || 0)
      }
    }
  }

  /**
   * Validate metadata index consistency and detect corruption
   *
   * Returns health status and recommendations for repair. Corruption typically
   * manifests as high avg entries/entity (expected ~30, corrupted can be 100+)
   * caused by the update() field asymmetry bug (fixed).
   *
   * @returns Promise resolving to validation results
   *
   * @example
   * const validation = await brain.validateIndexConsistency()
   * if (!validation.healthy) {
   *   console.log(validation.recommendation)
   *   // Run brain.rebuildIndex() to repair
   * }
   */
  async validateIndexConsistency(): Promise<{
    healthy: boolean
    avgEntriesPerEntity: number
    entityCount: number
    indexEntryCount: number
    recommendation: string | null
  }> {
    await this.ensureInitialized()
    return this.metadataIndex.validateConsistency()
  }

  /**
   * Get metadata index statistics
   *
   * Returns detailed statistics about the metadata index including
   * total entries, IDs indexed, and fields indexed.
   *
   * @returns Promise resolving to index statistics
   */
  async getIndexStats(): Promise<{
    totalEntries: number
    totalIds: number
    fieldsIndexed: string[]
    lastRebuild: number
    indexSize: number
  }> {
    await this.ensureInitialized()
    return this.metadataIndex.getStats()
  }

  /**
   * Get graph neighbors of an entity
   *
   * Traverses the relationship graph to find connected entities.
   * Supports filtering by direction and relationship type.
   *
   * @param entityId The entity to get neighbors for
   * @param options Optional traversal options
   * @returns Array of neighbor entity IDs
   *
   * @example
   * // Get all connected entities
   * const allNeighbors = await brain.neighbors(entityId)
   *
   * // Get only outgoing connections
   * const outgoing = await brain.neighbors(entityId, { direction: 'outgoing' })
   *
   * // Get incoming connections with specific verb type
   * const incoming = await brain.neighbors(entityId, {
   *   direction: 'incoming',
   *   verbType: VerbType.RELATES_TO
   * })
   */
  async neighbors(
    entityId: string,
    options?: {
      direction?: 'outgoing' | 'incoming' | 'both'
      depth?: number
      verbType?: VerbType
      limit?: number
    }
  ): Promise<string[]> {
    await this.ensureInitialized()

    const direction = options?.direction || 'both'
    const limit = options?.limit

    // Map our API direction to graphIndex direction
    const graphDirection = direction === 'outgoing' ? 'out' :
                           direction === 'incoming' ? 'in' : 'both'

    // Get neighbors from graph index
    let neighbors = await this.graphIndex.getNeighbors(entityId, {
      direction: graphDirection,
      limit
    })

    // Filter by verb type if specified
    if (options?.verbType) {
      const filteredNeighbors: string[] = []
      const verbIds = direction !== 'incoming'
        ? await this.graphIndex.getVerbIdsBySource(entityId)
        : await this.graphIndex.getVerbIdsByTarget(entityId)

      // Load verbs to check their types
      const verbs = await this.graphIndex.getVerbsBatchCached(verbIds)

      for (const [, verb] of verbs) {
        if (verb.type === options.verbType || verb.verb === options.verbType) {
          const neighborId = verb.sourceId === entityId ? verb.targetId : verb.sourceId
          if (neighbors.includes(neighborId)) {
            filteredNeighbors.push(neighborId)
          }
        }
      }

      neighbors = filteredNeighbors
    }

    // Handle depth > 1 (multi-hop traversal)
    if (options?.depth && options.depth > 1) {
      const visited = new Set<string>([entityId, ...neighbors])
      let currentLevel = neighbors

      for (let d = 1; d < options.depth; d++) {
        const nextLevel: string[] = []

        for (const nodeId of currentLevel) {
          const nodeNeighbors = await this.graphIndex.getNeighbors(nodeId, {
            direction: graphDirection
          })

          for (const neighbor of nodeNeighbors) {
            if (!visited.has(neighbor)) {
              visited.add(neighbor)
              nextLevel.push(neighbor)
            }
          }
        }

        if (nextLevel.length === 0) break
        currentLevel = nextLevel
        neighbors.push(...nextLevel)
      }

      // Apply limit after multi-hop traversal
      if (limit && neighbors.length > limit) {
        neighbors = neighbors.slice(0, limit)
      }
    }

    return neighbors
  }

  /**
   * Find semantic duplicates in the database
   *
   * Uses embedding similarity to identify entities that may be
   * duplicates or near-duplicates based on their content.
   *
   * @param options Optional search options
   * @returns Array of duplicate groups with similarity scores
   *
   * @example
   * // Find all duplicates with default threshold (0.85)
   * const duplicates = await brain.findDuplicates()
   *
   * // Find duplicates of a specific type with custom threshold
   * const personDupes = await brain.findDuplicates({
   *   type: NounType.PERSON,
   *   threshold: 0.9,
   *   limit: 100
   * })
   */
  async findDuplicates(options?: {
    threshold?: number
    type?: NounType
    limit?: number
  }): Promise<Array<{
    entity: Entity<any>
    duplicates: Array<{ entity: Entity<any>; similarity: number }>
  }>> {
    await this.ensureInitialized()

    const threshold = options?.threshold ?? 0.85
    const limit = options?.limit ?? 100

    // Get entities to check
    const findParams: FindParams<any> = {
      limit: Math.min(limit * 10, 1000), // Get more entities to find duplicates within
      type: options?.type
    }

    const entities = await this.find(findParams)
    const results: Array<{
      entity: Entity<any>
      duplicates: Array<{ entity: Entity<any>; similarity: number }>
    }> = []

    const processedIds = new Set<string>()

    for (const result of entities) {
      if (processedIds.has(result.id)) continue

      // Find similar entities
      const similar = await this.similar({
        to: result.id,
        limit: 20, // Check top 20 similar entities
        type: options?.type
      })

      // Filter to those above threshold (excluding self)
      const duplicates = similar
        .filter(s => s.id !== result.id && s.score >= threshold)
        .map(s => ({
          entity: s.entity,
          similarity: s.score
        }))

      if (duplicates.length > 0) {
        results.push({
          entity: result.entity,
          duplicates
        })

        // Mark all duplicates as processed to avoid reverse matches
        duplicates.forEach(d => processedIds.add(d.entity.id))
      }

      processedIds.add(result.id)

      // Stop if we have enough results
      if (results.length >= limit) break
    }

    return results
  }

  /**
   * Cluster entities by semantic similarity
   *
   * Groups entities into clusters based on their embedding similarity.
   * Uses a greedy algorithm that finds densely connected components
   * using the HNSW index for efficient neighbor lookup.
   *
   * @param options Optional clustering options
   * @returns Array of clusters with entities and optional centroids
   *
   * @example
   * // Find all clusters with default threshold
   * const clusters = await brain.cluster()
   *
   * // Find document clusters with higher threshold
   * const docClusters = await brain.cluster({
   *   type: NounType.Document,
   *   threshold: 0.85,
   *   minClusterSize: 3
   * })
   *
   * for (const cluster of docClusters) {
   *   console.log(`Cluster ${cluster.clusterId}: ${cluster.entities.length} entities`)
   * }
   */
  async cluster(options?: {
    threshold?: number
    type?: NounType
    minClusterSize?: number
    limit?: number
    includeCentroid?: boolean
  }): Promise<Array<{
    clusterId: string
    entities: Entity<any>[]
    centroid?: number[]
  }>> {
    await this.ensureInitialized()

    const threshold = options?.threshold ?? 0.8
    const minClusterSize = options?.minClusterSize ?? 2
    const limit = options?.limit ?? 100
    const includeCentroid = options?.includeCentroid ?? false

    // Get entities to cluster
    const findParams: FindParams<any> = {
      limit: 1000, // Process up to 1000 entities
      type: options?.type
    }

    const allEntities = await this.find(findParams)
    const clustered = new Set<string>()
    const clusters: Array<{
      clusterId: string
      entities: Entity<any>[]
      centroid?: number[]
    }> = []

    // Greedy clustering: for each unclustered entity, find its similar neighbors
    for (const result of allEntities) {
      if (clustered.has(result.id)) continue

      // Find similar entities to this one
      const similar = await this.similar({
        to: result.id,
        limit: 50,
        threshold,
        type: options?.type
      })

      // Filter to unclustered entities (including self)
      const clusterMembers = similar.filter(s => !clustered.has(s.id))

      // Only create cluster if it meets minimum size
      if (clusterMembers.length >= minClusterSize) {
        const entities = clusterMembers.map(s => s.entity)

        // Mark all as clustered
        clusterMembers.forEach(s => clustered.add(s.id))

        // Calculate centroid if requested
        let centroid: number[] | undefined
        if (includeCentroid && entities.length > 0) {
          const vectors = entities
            .filter(e => e.vector && e.vector.length > 0)
            .map(e => e.vector as number[])

          if (vectors.length > 0) {
            // Average all vectors to get centroid
            const dim = vectors[0].length
            centroid = new Array(dim).fill(0)
            for (const vec of vectors) {
              for (let i = 0; i < dim; i++) {
                centroid[i] += vec[i]
              }
            }
            for (let i = 0; i < dim; i++) {
              centroid[i] /= vectors.length
            }
          }
        }

        clusters.push({
          clusterId: `cluster-${clusters.length + 1}`,
          entities,
          centroid
        })

        if (clusters.length >= limit) break
      } else {
        // Mark single entity as processed (not in a cluster)
        clustered.add(result.id)
      }
    }

    return clusters
  }

  // ============= INTERNAL VERSIONING API =============
  // These methods are used by the versioning system (brain.versions.*)
  // They expose internal storage and index operations needed for entity versioning

  /**
   * Search entities by metadata filters (internal API)
   * Used by versioning system for querying version metadata
   *
   * @param filters - Metadata filter object (same format as `where` in find())
   * @returns Array of matching entities
   * @internal
   */
  async searchByMetadata(filters: Record<string, any>): Promise<any[]> {
    await this.ensureInitialized()

    const ids = await this.metadataIndex.getIdsForFilter(filters)
    if (ids.length === 0) return []

    const results: any[] = []
    const entitiesMap = await this.batchGet(ids)
    for (const id of ids) {
      const entity = entitiesMap.get(id)
      if (entity) {
        results.push(entity)
      }
    }
    return results
  }

  /**
   * Get raw noun metadata (internal API)
   * Used by versioning system for reading entity state
   *
   * @param id - Entity ID
   * @returns Noun metadata or null if not found
   * @internal
   */
  async getNounMetadata(id: string): Promise<any | null> {
    await this.ensureInitialized()
    return this.storage.getNounMetadata(id)
  }

  /**
   * Save raw noun metadata (internal API)
   * Used by versioning system for storing version index entries
   *
   * @param id - Entity ID
   * @param data - Metadata to save
   * @internal
   */
  async saveNounMetadata(id: string, data: any): Promise<void> {
    await this.ensureInitialized()
    await this.storage.saveNounMetadata(id, data)
  }

  /**
   * Delete noun metadata (internal API)
   * Used by versioning system for removing version index entries
   *
   * @param id - Entity ID
   * @internal
   */
  async deleteNounMetadata(id: string): Promise<void> {
    await this.ensureInitialized()
    await this.storage.deleteNounMetadata(id)
  }

  /**
   * Current branch name (internal API)
   * Used by versioning system for branch-aware operations
   * @internal
   */
  get currentBranch(): string {
    return (this.storage as any).currentBranch || 'main'
  }

  /**
   * Reference manager for COW commits (internal API)
   * Used by versioning system for commit operations
   * @internal
   */
  get refManager(): any {
    return (this.storage as any).refManager
  }

  /**
   * Storage adapter (internal API)
   * Used by versioning system for direct storage access
   * Returns BaseStorage which has saveMetadata/getMetadata for key-value storage
   * @internal
   */
  get storageAdapter(): BaseStorage {
    return this.storage
  }

  // ============= HELPER METHODS =============

  /**
   * Parse natural language query using advanced NLP with 220+ patterns
   * The embedding model is always available as it's core to Brainy's functionality
   */
  private async parseNaturalQuery(query: string): Promise<FindParams<T>> {
    // Initialize NLP processor if needed (lazy loading)
    if (!this._nlp) {
      this._nlp = new NaturalLanguageProcessor(this as any)
      await this._nlp.init() // Ensure pattern library is loaded
    }
    
    // Process with our advanced pattern library (220+ patterns with embeddings)
    const tripleQuery = await this._nlp.processNaturalQuery(query)
    
    // Convert TripleQuery to FindParams
    const params: FindParams<T> = {}
    
    // Handle vector search
    if (tripleQuery.like || tripleQuery.similar) {
      params.query = typeof tripleQuery.like === 'string' ? tripleQuery.like : 
                     typeof tripleQuery.similar === 'string' ? tripleQuery.similar : query
    } else if (!tripleQuery.where && !tripleQuery.connected) {
      // Default to vector search if no other criteria specified
      params.query = query
    }
    
    // Handle metadata filtering
    if (tripleQuery.where) {
      params.where = tripleQuery.where as Partial<T>
    }
    
    // Handle graph relationships
    if (tripleQuery.connected) {
      params.connected = {
        to: Array.isArray(tripleQuery.connected.to) ? tripleQuery.connected.to[0] : tripleQuery.connected.to,
        from: Array.isArray(tripleQuery.connected.from) ? tripleQuery.connected.from[0] : tripleQuery.connected.from,
        via: tripleQuery.connected.type as any,
        depth: tripleQuery.connected.depth,
        direction: tripleQuery.connected.direction
      }
    }
    
    // Handle other options
    if (tripleQuery.limit) params.limit = tripleQuery.limit
    if (tripleQuery.offset) params.offset = tripleQuery.offset
    
    return this.enhanceNLPResult(params, query)
  }
  
  /**
   * Enhance NLP results with fusion scoring
   */
  private enhanceNLPResult(params: FindParams<T>, _originalQuery: string): FindParams<T> {
    // Add fusion scoring for complex queries
    if (params.query && params.where && Object.keys(params.where).length > 0) {
      params.fusion = params.fusion || {
        strategy: 'adaptive',
        weights: {
          vector: 0.6,
          field: 0.3,
          graph: 0.1
        }
      }
    }
    return params
  }

  /**
   * Execute vector search component
   *
   * @param params Find parameters
   * @param candidateIds Optional pre-resolved metadata filter IDs for metadata-first search.
   *   When provided, HNSW search is restricted to these candidates:
   *   - NativeHNSWWrapper: uses native searchWithCandidates (Rust bitmap filtering)
   *   - JS HNSWIndex: converts to filter function with O(1) Set lookups
   */
  private async executeVectorSearch(params: FindParams<T>, candidateIds?: string[]): Promise<Result<T>[]> {
    const vector = params.vector || (await this.embed(params.query!))
    const limit = params.limit || 10

    // Build search options for metadata-first candidate filtering
    const searchOptions = candidateIds ? { candidateIds } : undefined

    // HNSW search with optional metadata-first candidate filtering
    const searchResults: [string, number][] = await this.index.search(vector, limit * 2, undefined, searchOptions)

    // Batch-load entities for 10-50x faster cloud storage performance
    // GCS: 10 results = 1×50ms vs 10×50ms = 500ms (10x faster)
    const ids = searchResults.map(([id]) => id)
    const entitiesMap = await this.batchGet(ids)

    const results: Result<T>[] = []
    for (const [id, distance] of searchResults) {
      const entity = entitiesMap.get(id)
      if (entity) {
        const score = Math.max(0, Math.min(1, 1 / (1 + distance)))
        results.push(this.createResult(id, score, entity))
      }
    }

    return results
  }
  
  /**
   * Execute proximity search component
   */
  private async executeProximitySearch(params: FindParams<T>): Promise<Result<T>[]> {
    if (!params.near) return []

    const nearEntity = await this.get(params.near.id)
    if (!nearEntity) return []

    const nearResults: [string, number][] = await this.index.search(nearEntity.vector, params.limit || 10)

    // Filter by threshold first to minimize batch fetch
    const threshold = params.near.threshold || 0.7
    const filteredResults = nearResults.filter(([, distance]) => {
      const score = Math.max(0, Math.min(1, 1 / (1 + distance)))
      return score >= threshold
    })

    // Batch-load entities for 10-50x faster cloud storage performance
    const ids = filteredResults.map(([id]) => id)
    const entitiesMap = await this.batchGet(ids)

    const results: Result<T>[] = []
    for (const [id, distance] of filteredResults) {
      const entity = entitiesMap.get(id)
      if (entity) {
        const score = Math.max(0, Math.min(1, 1 / (1 + distance)))
        results.push(this.createResult(id, score, entity))
      }
    }

    return results
  }
  
  /**
   * Execute graph search component with O(1) traversal
   */
  private async executeGraphSearch(params: FindParams<T>, existingResults: Result<T>[]): Promise<Result<T>[]> {
    if (!params.connected) return existingResults
    
    const { from, to, direction = 'both' } = params.connected
    const connectedIds: string[] = []
    
    if (from) {
      const neighbors = await this.graphIndex.getNeighbors(from, direction)
      connectedIds.push(...neighbors)
    }
    
    if (to) {
      const reverseDirection = direction === 'in' ? 'out' : direction === 'out' ? 'in' : 'both'
      const neighbors = await this.graphIndex.getNeighbors(to, reverseDirection)
      connectedIds.push(...neighbors)
    }
    
    // Filter existing results to only connected entities
    if (existingResults.length > 0) {
      const connectedIdSet = new Set(connectedIds)
      return existingResults.filter(r => connectedIdSet.has(r.id))
    }
    
    // Batch-load connected entities for 10x faster cloud storage performance
    // GCS: 20 entities = 1×50ms vs 20×50ms = 1000ms (20x faster)
    const results: Result<T>[] = []
    const entitiesMap = await this.batchGet(connectedIds)
    for (const id of connectedIds) {
      const entity = entitiesMap.get(id)
      if (entity) {
        results.push(this.createResult(id, 1.0, entity))
      }
    }

    return results
  }
  
  /**
   * Apply fusion scoring for multi-source results
   */
  private applyFusionScoring(results: Result<T>[], fusionType: any): Result<T>[] {
    // Implement different fusion strategies
    const strategy = typeof fusionType === 'string' ? fusionType : fusionType.strategy || 'weighted'
    
    switch (strategy) {
      case 'max':
        // Use maximum score from any source
        return results
        
      case 'average':
        // Average scores from multiple sources
        const scoreMap = new Map<string, number[]>()
        for (const result of results) {
          const scores = scoreMap.get(result.id) || []
          scores.push(result.score)
          scoreMap.set(result.id, scores)
        }
        
        return results.map(r => ({
          ...r,
          score: scoreMap.get(r.id)!.reduce((a, b) => a + b, 0) / scoreMap.get(r.id)!.length
        }))
        
      case 'weighted':
      default:
        // Weighted combination based on source importance
        const weights = fusionType.weights || { vector: 0.7, metadata: 0.2, graph: 0.1 }
        return results.map(r => ({
          ...r,
          score: r.score * (weights.vector || 1.0)
        }))
    }
  }

  /**
   * Execute text search using word index
   *
   * Performs keyword-based search using the __words__ index in MetadataIndexManager.
   * Returns results ranked by word match count.
   *
   * @param query - Text query to search for
   * @param limit - Maximum results to return
   * @returns Array of Results with scores based on match count
   */
  private async executeTextSearch(query: string, limit: number): Promise<Result<T>[]> {
    const textMatches = await this.metadataIndex.getIdsForTextQuery(query)
    if (textMatches.length === 0) return []

    // Take top matches and load entities
    const topMatches = textMatches.slice(0, limit * 2)  // Get more for filtering
    const ids = topMatches.map(m => m.id)
    const entitiesMap = await this.batchGet(ids)

    // Create results with scores based on match count
    const maxMatches = topMatches[0]?.matchCount || 1
    const results: Result<T>[] = []

    for (const match of topMatches) {
      const entity = entitiesMap.get(match.id)
      if (entity) {
        // Normalize score to 0-1 range based on match count
        const score = match.matchCount / maxMatches
        results.push(this.createResult(match.id, score, entity))
      }
    }

    return results
  }

  /**
   * Auto-detect optimal alpha for hybrid search
   *
   * Short queries (1-2 words) favor text search (lower alpha)
   * Long queries (5+ words) favor semantic search (higher alpha)
   *
   * @param query - The search query
   * @returns Alpha value between 0 (text only) and 1 (semantic only)
   */
  private autoAlpha(query: string): number {
    const wordCount = query.trim().split(/\s+/).filter(w => w.length > 0).length
    if (wordCount <= 2) return 0.3      // Favor text for short queries
    if (wordCount <= 5) return 0.5      // Balanced
    return 0.7                          // Favor semantic for long queries
  }

  /**
   * Reciprocal Rank Fusion (RRF) for combining search results
   *
   * RRF is a proven fusion algorithm that:
   * - Doesn't require score normalization
   * - Handles different score distributions
   * - Gives higher weight to top-ranked items
   *
   * Formula: score(d) = sum(1 / (k + rank(d))) for each list
   *
   * Now includes match visibility (textMatches, textScore, semanticScore, matchSource)
   *
   * @param textResults - Results from text search
   * @param semanticResults - Results from semantic search
   * @param alpha - Weight for semantic (0=text only, 1=semantic only)
   * @param queryWords - Original query words for match tracking
   * @param k - RRF constant (default: 60, standard in literature)
   * @returns Fused results sorted by combined score with match visibility
   */
  private async rrfFusion(
    textResults: Result<T>[],
    semanticResults: Result<T>[],
    alpha: number,
    queryWords: string[],
    k: number = 60
  ): Promise<Result<T>[]> {
    // Track scores and match details per entity
    interface MatchData {
      rrf: number
      textScore?: number
      semanticScore?: number
      textMatches: string[]
      hasText: boolean
      hasSemantic: boolean
    }
    const matchData = new Map<string, MatchData>()
    const entityMap = new Map<string, Entity<T>>()

    // Text contribution (1 - alpha weight)
    const textWeight = 1 - alpha
    textResults.forEach((r, rank) => {
      const rrfScore = textWeight * (1 / (k + rank + 1))
      const existing = matchData.get(r.id) || { rrf: 0, textMatches: [], hasText: false, hasSemantic: false }
      existing.rrf += rrfScore
      existing.textScore = r.score  // Original text search score (0-1)
      existing.hasText = true
      matchData.set(r.id, existing)
      if (r.entity) entityMap.set(r.id, r.entity)
    })

    // Semantic contribution (alpha weight)
    semanticResults.forEach((r, rank) => {
      const rrfScore = alpha * (1 / (k + rank + 1))
      const existing = matchData.get(r.id) || { rrf: 0, textMatches: [], hasText: false, hasSemantic: false }
      existing.rrf += rrfScore
      existing.semanticScore = r.score  // Original semantic search score (0-1)
      existing.hasSemantic = true
      matchData.set(r.id, existing)
      if (r.entity) entityMap.set(r.id, r.entity)
    })

    // Sort by fused score
    const sortedIds = Array.from(matchData.entries())
      .sort((a, b) => b[1].rrf - a[1].rrf)
      .map(([id, data]) => ({ id, data }))

    // Build results - need to load any missing entities
    const missingIds = sortedIds.filter(s => !entityMap.has(s.id)).map(s => s.id)
    if (missingIds.length > 0) {
      const loaded = await this.batchGet(missingIds)
      for (const [id, entity] of loaded) {
        entityMap.set(id, entity)
      }
    }

    // Performance: Build set of text result IDs for O(1) lookup
    // This avoids re-extracting text for entities that weren't in text results
    const textResultIds = new Set(textResults.map(r => r.id))

    // Create final results with match visibility
    const results: Result<T>[] = []
    for (const { id, data } of sortedIds) {
      const entity = entityMap.get(id)
      if (entity) {
        // Find which query words matched - uses fast path if entity wasn't in text results
        const textMatches = this.findMatchingWords(entity, queryWords, textResultIds)

        // Determine match source
        let matchSource: 'text' | 'semantic' | 'both'
        if (data.hasText && data.hasSemantic) {
          matchSource = 'both'
        } else if (data.hasText) {
          matchSource = 'text'
        } else {
          matchSource = 'semantic'
        }

        // Create result with match visibility
        const result = this.createResult(id, data.rrf, entity)
        result.textMatches = textMatches
        result.textScore = data.textScore
        result.semanticScore = data.semanticScore
        result.matchSource = matchSource

        results.push(result)
      }
    }

    return results
  }

  /**
   * Find which query words match in an entity's text content
   *
   * Performance: O(query_words × text_length) - only called when needed
   * At scale: Use textResultIds set for O(1) lookup instead of re-extracting
   *
   * @param entity - Entity to check
   * @param queryWords - Words from the search query
   * @param textResultIds - Optional: Set of IDs from text search (O(1) lookup)
   * @returns Array of matching query words
   */
  private findMatchingWords(
    entity: Entity<T>,
    queryWords: string[],
    textResultIds?: Set<string>
  ): string[] {
    // Fast path: if entity wasn't in text results, no words matched
    if (textResultIds && !textResultIds.has(entity.id)) {
      return []
    }

    // Slow path: extract text and check each word
    // Only happens for entities that DID match text search
    const textContent = this.metadataIndex.extractTextContent({
      data: entity.data,
      metadata: entity.metadata
    }).toLowerCase()

    return queryWords.filter(word => textContent.includes(word.toLowerCase()))
  }

  /**
   * Apply graph constraints using O(1) GraphAdjacencyIndex - TRUE Triple Intelligence!
   */
  private async applyGraphConstraints(
    results: Result<T>[],
    constraints: any
  ): Promise<Result<T>[]> {
    // Filter by graph connections using fast graph index
    if (constraints.to || constraints.from) {
      const filtered: Result<T>[] = []
      
      for (const result of results) {
        let hasConnection = false
        
        if (constraints.to) {
          // Check if this entity connects TO the target (O(1) lookup)
          const outgoingNeighbors = await this.graphIndex.getNeighbors(result.id, 'out')
          hasConnection = outgoingNeighbors.includes(constraints.to)
        }
        
        if (constraints.from && !hasConnection) {
          // Check if this entity connects FROM the source (O(1) lookup)
          const incomingNeighbors = await this.graphIndex.getNeighbors(result.id, 'in')
          hasConnection = incomingNeighbors.includes(constraints.from)
        }
        
        if (hasConnection) {
          filtered.push(result)
        }
      }
      
      return filtered
    }
    
    return results
  }

  /**
   * Convert verbs to relations (read from top-level)
   */
  private verbsToRelations(verbs: GraphVerb[]): Relation<T>[] {
    return verbs.map((v) => ({
      id: v.id,
      from: v.sourceId,
      to: v.targetId,
      type: (v.verb || v.type) as VerbType,
      weight: v.weight ?? 1.0, // Weight is at top-level
      metadata: v.metadata,
      service: v.service as string,
      createdAt: typeof v.createdAt === 'number' ? v.createdAt : Date.now()
    }))
  }

  /**
   * Embed data into vector representation
   * Handles any data type by intelligently converting to string representation
   *
   * @param data - Any data to convert to vector (string, object, array, etc.)
   * @returns Promise that resolves to a numerical vector representation
   *
   * @example
   * // Basic string embedding
   * const vector = await brainy.embed('machine learning algorithms')
   * console.log('Vector dimensions:', vector.length)
   *
   * @example
   * // Object embedding with intelligent field extraction
   * const documentVector = await brainy.embed({
   *   title: 'AI Research Paper',
   *   content: 'This paper discusses neural networks...',
   *   author: 'Dr. Smith',
   *   category: 'machine-learning'
   * })
   * // Uses 'content' field for embedding by default
   *
   * @example
   * // Different object field priorities
   * // Priority: data > content > text > name > title > description
   * const vectors = await Promise.all([
   *   brainy.embed({ data: 'primary content' }),        // Uses 'data'
   *   brainy.embed({ content: 'main content' }),        // Uses 'content'
   *   brainy.embed({ text: 'text content' }),           // Uses 'text'
   *   brainy.embed({ name: 'entity name' }),            // Uses 'name'
   *   brainy.embed({ title: 'document title' }),        // Uses 'title'
   *   brainy.embed({ description: 'description text' }) // Uses 'description'
   * ])
   *
   * @example
   * // Array embedding for batch processing
   * const batchVectors = await brainy.embed([
   *   'first document',
   *   'second document',
   *   { content: 'third document as object' },
   *   { title: 'fourth document' }
   * ])
   * // Returns vector representing all items combined
   *
   * @example
   * // Complex object handling
   * const complexData = {
   *   user: { name: 'John', role: 'developer' },
   *   project: { name: 'AI Assistant', status: 'active' },
   *   metrics: { score: 0.95, performance: 'excellent' }
   * }
   * const vector = await brainy.embed(complexData)
   * // Converts entire object to JSON for embedding
   *
   * @example
   * // Pre-computing vectors for performance optimization
   * const documents = [
   *   { id: 'doc1', content: 'Document 1 content...' },
   *   { id: 'doc2', content: 'Document 2 content...' },
   *   { id: 'doc3', content: 'Document 3 content...' }
   * ]
   *
   * // Pre-compute all vectors
   * const vectors = await Promise.all(
   *   documents.map(doc => brainy.embed(doc.content))
   * )
   *
   * // Add entities with pre-computed vectors (faster)
   * for (let i = 0; i < documents.length; i++) {
   *   await brainy.add({
   *     data: documents[i],
   *     type: NounType.Document,
   *     vector: vectors[i] // Skip embedding computation
   *   })
   * }
   *
   * @example
   * // Custom embedding for search queries
   * async function searchWithCustomEmbedding(query: string) {
   *   // Enhance query for better matching
   *   const enhancedQuery = `search: ${query} relevant information`
   *   const queryVector = await brainy.embed(enhancedQuery)
   *
   *   // Use pre-computed vector for search
   *   return brainy.find({
   *     vector: queryVector,
   *     limit: 10
   *   })
   * }
   *
   * @example
   * // Handling edge cases gracefully
   * const edgeCases = await Promise.all([
   *   brainy.embed(null),           // Returns vector for empty string
   *   brainy.embed(undefined),      // Returns vector for empty string
   *   brainy.embed(''),             // Returns vector for empty string
   *   brainy.embed(42),             // Converts number to string
   *   brainy.embed(true),           // Converts boolean to string
   *   brainy.embed([]),             // Empty array handling
   *   brainy.embed({})              // Empty object handling
   * ])
   *
   * @example
   * // Using with similarity comparisons
   * const doc1Vector = await brainy.embed('artificial intelligence research')
   * const doc2Vector = await brainy.embed('machine learning algorithms')
   *
   * // Find entities similar to doc1Vector
   * const similar = await brainy.find({
   *   vector: doc1Vector,
   *   limit: 5
   * })
   */
  async embed(data: any): Promise<Vector> {
    // Handle different data types intelligently
    let textToEmbed: string | string[]

    if (typeof data === 'string') {
      textToEmbed = data
    } else if (Array.isArray(data)) {
      // Array of items - convert each to string
      textToEmbed = data.map(item => {
        if (typeof item === 'string') return item
        if (typeof item === 'number' || typeof item === 'boolean') return String(item)
        if (item && typeof item === 'object') {
          // For objects, try to extract meaningful text
          if (item.data) return String(item.data)
          if (item.content) return String(item.content)
          if (item.text) return String(item.text)
          if (item.name) return String(item.name)
          if (item.title) return String(item.title)
          if (item.description) return String(item.description)
          // Fallback to JSON for complex objects
          try {
            return JSON.stringify(item)
          } catch {
            return String(item)
          }
        }
        return String(item)
      })
    } else if (data && typeof data === 'object') {
      // Single object - extract meaningful text
      if (data.data) textToEmbed = String(data.data)
      else if (data.content) textToEmbed = String(data.content)
      else if (data.text) textToEmbed = String(data.text)
      else if (data.name) textToEmbed = String(data.name)
      else if (data.title) textToEmbed = String(data.title)
      else if (data.description) textToEmbed = String(data.description)
      else {
        // For complex objects, create a descriptive string
        try {
          textToEmbed = JSON.stringify(data)
        } catch {
          textToEmbed = String(data)
        }
      }
    } else if (data === null || data === undefined) {
      // Handle null/undefined gracefully
      textToEmbed = ''
    } else {
      // Numbers, booleans, etc - convert to string
      textToEmbed = String(data)
    }

    return this.embedder(textToEmbed)
  }

  /**
   * Warm up the system
   */
  private async warmup(): Promise<void> {
    // Warm up embedder
    await this.embed('warmup')
  }

  /**
   * Explicitly warm up the embedding engine
   *
   * Use this to pre-initialize the Candle WASM embedding engine before
   * processing requests. The WASM module (93MB with embedded model) takes
   * 90-140 seconds to compile on throttled CPU environments like Cloud Run.
   *
   * Calling this during container startup ensures the first real request
   * doesn't pay the compilation cost.
   *
   * @example
   * ```typescript
   * // Option 1: Use eagerEmbeddings config (automatic during init)
   * const brain = new Brainy({ eagerEmbeddings: true })
   * await brain.init() // Embedding engine initialized here
   *
   * // Option 2: Manual warmup (more control)
   * const brain = new Brainy()
   * await brain.init()
   * await brain.warmupEmbeddings() // Explicit control over timing
   * ```
   *
   * @returns Promise that resolves when embedding engine is ready
   */
  async warmupEmbeddings(): Promise<void> {
    if (!this.initialized) {
      throw new Error('Brain must be initialized before warming up embeddings. Call init() first.')
    }

    // Plugin-provided embeddings are already ready (native, no WASM warmup needed)
    if (this.pluginRegistry.hasProvider('embeddings')) {
      return
    }

    console.log('Warming up embedding engine...')
    const start = Date.now()
    await embeddingManager.init()
    const elapsed = Date.now() - start
    console.log(`Embedding engine ready in ${elapsed}ms`)
  }

  /**
   * Check if embedding engine is initialized
   *
   * @returns true if embedding engine is ready for immediate use
   */
  isEmbeddingReady(): boolean {
    // Plugin-provided embeddings are always ready (native, no WASM init required)
    if (this.pluginRegistry.hasProvider('embeddings')) {
      return true
    }
    return embeddingManager.isInitialized()
  }

  /**
   * Setup embedder
   */
  private setupEmbedder(): EmbeddingFunction {
    // Custom model loading removed - not implemented
    // Only 'fast' and 'accurate' model types are supported
    return defaultEmbeddingFunction
  }

  /**
   * Setup storage
   */
  private async setupStorage(): Promise<BaseStorage> {
    const storageConfig = (this.config.storage || {}) as Record<string, unknown>
    const storageType = (storageConfig.type as string) || 'auto'

    // Check plugin-provided storage factories (e.g., 'filesystem' override from cortex)
    const pluginFactory = this.pluginRegistry.getStorageFactory(storageType)
    if (pluginFactory) {
      const adapter = await pluginFactory.create(storageConfig)
      return adapter as BaseStorage
    }

    // Fall through to built-in storage types
    const storage = await createStorage(storageConfig as any)
    return storage as BaseStorage
  }

  /**
   * Detect storage type from the storage instance class name
   *
   * Fixes storage type detection for HNSW persistence mode.
   * Previously relied on this.config.storage.type which was often not set
   * after storage creation, causing cloud storage to use 'immediate' mode
   * and resulting in 50-100x slower add() operations.
   *
   * @returns Storage type string ('gcs', 's3', 'memory', etc.)
   */
  private getStorageType(): string {
    if (!this.storage) return 'memory'

    const className = this.storage.constructor.name
    if (className.includes('Gcs') || className.includes('GCS')) return 'gcs'
    if (className.includes('S3')) return 's3'
    if (className.includes('R2')) return 'r2'
    if (className.includes('Azure')) return 'azure'
    if (className.includes('OPFS')) return 'opfs'
    if (className.includes('FileSystem')) return 'filesystem'
    if (className.includes('Memory')) return 'memory'

    return 'unknown'
  }

  /**
   * Setup index — single unified HNSW graph.
   *
   * Smart defaults for HNSW persistence mode:
   * - Cloud storage (GCS/S3/R2/Azure): 'deferred' for 30-50x faster adds
   * - Local storage (FileSystem/Memory/OPFS): 'immediate' (already fast)
   */
  private setupIndex(): HNSWIndex {
    const indexConfig = {
      ...this.config.index,
      distanceFunction: this.distance,
      // Wire HNSW optimization config (v7.11.0)
      quantization: this.config.hnsw?.quantization ? {
        enabled: this.config.hnsw.quantization.enabled ?? false,
        bits: this.config.hnsw.quantization.bits ?? 8,
        rerankMultiplier: this.config.hnsw.quantization.rerankMultiplier ?? 3
      } : undefined,
      vectorStorage: this.config.hnsw?.vectorStorage
    }

    const persistMode = this.resolveHNSWPersistMode()

    return new HNSWIndex(indexConfig as any, this.distance, {
      storage: this.storage,
      useParallelization: true,
      persistMode
    })
  }

  /**
   * Create an HNSW index, using plugin factory when available.
   * Shared by init(), fork(), checkout(), and clear() to avoid duplication.
   */
  private createIndex(): HNSWIndex {
    const hnswFactory = this.pluginRegistry.getProvider<(config: any, distance: DistanceFunction, options: any) => any>('hnsw')
    if (hnswFactory) {
      const persistMode = this.resolveHNSWPersistMode()
      return hnswFactory(
        { ...this.config.index, distanceFunction: this.distance },
        this.distance,
        { storage: this.storage, persistMode }
      )
    }
    return this.setupIndex()
  }

  /**
   * Resolve HNSW persistence mode.
   * Extracted so both setupIndex() and the HNSW plugin factory path can use it.
   *
   * User config > smart default:
   * - Cloud storage (GCS/S3/R2/Azure): 'deferred' for 30-50x faster adds
   * - Local storage (FileSystem/Memory/OPFS): 'immediate' (already fast)
   */
  private resolveHNSWPersistMode(): 'immediate' | 'deferred' {
    let persistMode: 'immediate' | 'deferred' = this.config.hnswPersistMode || 'immediate'

    if (!this.config.hnswPersistMode) {
      const storageType = this.config.storage?.type || this.getStorageType()
      if (['gcs', 's3', 'r2', 'azure'].includes(storageType)) {
        persistMode = 'deferred'
      }
    }

    return persistMode
  }

  /**
   * Normalize and validate configuration
   */
  private normalizeConfig(config?: BrainyConfig): Required<BrainyConfig> {
    // Validate storage configuration
    if (config?.storage?.type && !['auto', 'memory', 'filesystem', 'opfs', 'remote', 's3', 'r2', 'gcs', 'gcs-native', 'azure'].includes(config.storage.type)) {
      throw new Error(`Invalid storage type: ${config.storage.type}. Must be one of: auto, memory, filesystem, opfs, remote, s3, r2, gcs, gcs-native, azure`)
    }

    // Warn about deprecated gcs-native
    if (config?.storage?.type === ('gcs-native' as any)) {
      console.warn('⚠️  DEPRECATED: type "gcs-native" is deprecated. Use type "gcs" instead.')
      console.warn('   This will continue to work but may be removed in a future version.')
    }

    // Validate storage type/config pairing (now more lenient)
    if (config?.storage) {
      const storage = config.storage as any

      // Warn about legacy gcsStorage config with HMAC keys
      if (storage.gcsStorage && storage.gcsStorage.accessKeyId && storage.gcsStorage.secretAccessKey) {
        console.warn('⚠️  GCS with HMAC keys (gcsStorage) is legacy. Consider migrating to native GCS (gcsNativeStorage) with ADC.')
      }

      // No longer throw errors for mismatches - storageFactory now handles this intelligently
      // Both 'gcs' and 'gcs-native' can now use either gcsStorage or gcsNativeStorage
    }

    // Validate numeric configurations
    if (config?.index?.m && (config.index.m < 1 || config.index.m > 128)) {
      throw new Error(`Invalid index m parameter: ${config.index.m}. Must be between 1 and 128`)
    }

    if (config?.index?.efConstruction && (config.index.efConstruction < 1 || config.index.efConstruction > 1000)) {
      throw new Error(`Invalid index efConstruction: ${config.index.efConstruction}. Must be between 1 and 1000`)
    }

    if (config?.index?.efSearch && (config.index.efSearch < 1 || config.index.efSearch > 1000)) {
      throw new Error(`Invalid index efSearch: ${config.index.efSearch}. Must be between 1 and 1000`)
    }

    // Auto-detect distributed mode based on environment and configuration
    const distributedConfig = this.autoDetectDistributed(config?.distributed)

    return {
      storage: config?.storage || { type: 'auto' },
      index: config?.index || {},
      cache: config?.cache ?? true,
      distributed: distributedConfig as any, // Type will be fixed when used
      warmup: config?.warmup ?? false,
      realtime: config?.realtime ?? false,
      multiTenancy: config?.multiTenancy ?? false,
      telemetry: config?.telemetry ?? false,
      verbose: config?.verbose ?? false,
      silent: config?.silent ?? false,
      // New performance options with smart defaults
      disableAutoRebuild: config?.disableAutoRebuild ?? false,  // false = auto-decide based on size
      disableMetrics: config?.disableMetrics ?? false,
      disableAutoOptimize: config?.disableAutoOptimize ?? false,
      batchWrites: config?.batchWrites ?? true,
      maxConcurrentOperations: config?.maxConcurrentOperations ?? 10,
      // Memory management options
      maxQueryLimit: config?.maxQueryLimit ?? undefined as any,
      reservedQueryMemory: config?.reservedQueryMemory ?? undefined as any,
      // HNSW persistence mode - undefined = smart default in setupIndex
      hnswPersistMode: config?.hnswPersistMode ?? undefined as any,
      // HNSW optimization options (v7.11.0)
      hnsw: config?.hnsw ?? undefined as any,
      // Embedding initialization - false = lazy init on first embed()
      eagerEmbeddings: config?.eagerEmbeddings ?? false,
      // Integration Hub - undefined/false = disabled
      integrations: config?.integrations ?? undefined as any
    }
  }

  /**
   * Ensure indexes are loaded (Production-scale lazy loading)
   *
   * Called by query methods (find, search, get, etc.) when disableAutoRebuild is true.
   * Handles concurrent queries safely - multiple calls wait for same rebuild.
   *
   * Performance:
   * - First query: Triggers rebuild (~50-200ms for 1K-10K entities)
   * - Concurrent queries: Wait for same rebuild (no duplicate work)
   * - Subsequent queries: Instant (0ms check, indexes already loaded)
   *
   * Production scale:
   * - 1K entities: ~50ms
   * - 10K entities: ~200ms
   * - 100K entities: ~2s (streaming pagination)
   * - 1M+ entities: Uses chunked lazy loading (per-type on demand)
   */
  private async ensureIndexesLoaded(): Promise<void> {
    // Fast path: If rebuild already completed, return immediately (0ms)
    if (this.lazyRebuildCompleted) {
      return
    }

    // If indexes already populated, mark as complete and skip
    if (this.index.size() > 0) {
      this.lazyRebuildCompleted = true
      return
    }

    // Concurrency control: If rebuild is in progress, wait for it
    if (this.lazyRebuildInProgress && this.lazyRebuildPromise) {
      await this.lazyRebuildPromise
      return
    }

    // Check if lazy rebuild is needed
    // Only needed if: disableAutoRebuild=true AND indexes are empty AND storage has data
    if (!this.config.disableAutoRebuild) {
      // Auto-rebuild is enabled, indexes should already be loaded
      return
    }

    // Check if storage has data (fast check with limit=1)
    const entities = await this.storage.getNouns({ pagination: { limit: 1 } })
    const hasData = (entities.totalCount && entities.totalCount > 0) || entities.items.length > 0

    if (!hasData) {
      // Storage is empty, no rebuild needed
      this.lazyRebuildCompleted = true
      return
    }

    // Start lazy rebuild (with mutex to prevent concurrent rebuilds)
    this.lazyRebuildInProgress = true
    this.lazyRebuildPromise = this.rebuildIndexesIfNeeded(true)
      .then(() => {
        this.lazyRebuildCompleted = true
      })
      .finally(() => {
        this.lazyRebuildInProgress = false
        this.lazyRebuildPromise = null
      })

    await this.lazyRebuildPromise
  }

  /**
   * Rebuild indexes from persisted data if needed (LAZY LOADING)
   *
   * FIXES FOR CRITICAL BUGS:
   * - Bug #1: GraphAdjacencyIndex rebuild never called ✅ FIXED
   * - Bug #2: Early return blocks recovery when count=0 ✅ FIXED
   * - Bug #4: HNSW index has no rebuild mechanism ✅ FIXED
   * - Bug #5: disableAutoRebuild leaves indexes empty forever ✅ FIXED
   *
   * Production-grade rebuild with:
   * - Handles BILLIONS of entities via streaming pagination
   * - Smart threshold-based decisions (auto-rebuild < 1000 items)
   * - Lazy loading on first query (when disableAutoRebuild: true)
   * - Progress reporting for large datasets
   * - Parallel index rebuilds for performance
   * - Robust error recovery (continues on partial failures)
   * - Concurrency-safe (multiple queries wait for same rebuild)
   *
   * @param force - Force rebuild even if disableAutoRebuild is true (for lazy loading)
   */
  private async rebuildIndexesIfNeeded(force = false): Promise<void> {
    try {
      // Check if auto-rebuild is explicitly disabled (ONLY during init, not for lazy loading)
      // force=true means this is a lazy rebuild triggered by first query
      if (this.config.disableAutoRebuild === true && !force) {
        if (!this.config.silent) {
          console.log('⚡ Auto-rebuild explicitly disabled via config')
          console.log('💡 Indexes will build automatically on first query (lazy loading)')
        }
        return
      }

      // OPTIMIZATION: Instant check - if index already has data, skip immediately
      // This gives 0s startup for warm restarts (vs 50-100ms of async checks)
      if (this.index.size() > 0 && !force) {
        if (!this.config.silent) {
          console.log(
            `✅ Index already populated (${this.index.size().toLocaleString()} entities) - 0s startup!`
          )
        }
        return
      }

      // BUG #2 FIX: Don't trust counts - check actual storage instead
      // Counts can be lost/corrupted in container restarts
      const entities = await this.storage.getNouns({ pagination: { limit: 1 } })
      const totalCount = entities.totalCount || 0

      // If storage is truly empty, no rebuild needed
      if (totalCount === 0 && entities.items.length === 0) {
        if (force && !this.config.silent) {
          console.log('✅ Storage empty - no rebuild needed')
        }
        return
      }

      // Intelligent decision: Auto-rebuild based on dataset size
      // Production scale: Handles billions via streaming pagination
      const AUTO_REBUILD_THRESHOLD = 10000 // Auto-rebuild if < 10K items (increased from 1K)

      // Check if indexes need rebuilding
      const metadataStats = await this.metadataIndex.getStats()
      const hnswIndexSize = this.index.size()
      const graphIndexSize = await this.graphIndex.size()

      const needsRebuild =
        metadataStats.totalEntries === 0 ||
        hnswIndexSize === 0 ||
        graphIndexSize === 0

      if (!needsRebuild && !force) {
        // All indexes already populated, no rebuild needed
        return
      }

      // Determine rebuild strategy
      const isLazyRebuild = force && this.config.disableAutoRebuild === true
      const isSmallDataset = totalCount < AUTO_REBUILD_THRESHOLD
      const shouldRebuild = isLazyRebuild || isSmallDataset || this.config.disableAutoRebuild === false

      if (!shouldRebuild) {
        // Large dataset with auto-rebuild disabled: Wait for lazy loading
        if (!this.config.silent) {
          console.log(`⚡ Large dataset (${totalCount.toLocaleString()} items) - using lazy loading for optimal startup`)
          console.log('💡 Indexes will build automatically on first query')
        }
        return
      }

      // REBUILD: Either small dataset, forced rebuild, or explicit enable
      const rebuildReason = isLazyRebuild
        ? '🔄 Lazy loading triggered by first query'
        : isSmallDataset
          ? `🔄 Small dataset (${totalCount.toLocaleString()} items)`
          : '🔄 Auto-rebuild explicitly enabled'

      if (!this.config.silent) {
        console.log(`${rebuildReason} - rebuilding all indexes from persisted data...`)
      }

      // Rebuild all 3 indexes in parallel for performance
      // Indexes load their data from storage (no recomputation)
      const rebuildStartTime = Date.now()
      await Promise.all([
        metadataStats.totalEntries === 0 ? this.metadataIndex.rebuild() : Promise.resolve(),
        hnswIndexSize === 0 ? this.index.rebuild() : Promise.resolve(),
        graphIndexSize === 0 ? this.graphIndex.rebuild() : Promise.resolve()
      ])

      const rebuildDuration = Date.now() - rebuildStartTime
      if (!this.config.silent) {
        console.log(
          `✅ All indexes rebuilt in ${rebuildDuration}ms:\n` +
          `   - Metadata: ${await this.metadataIndex.getStats().then(s => s.totalEntries)} entries\n` +
          `   - HNSW Vector: ${this.index.size()} nodes\n` +
          `   - Graph Adjacency: ${await this.graphIndex.size()} relationships\n` +
          `   💡 Indexes loaded from persisted storage (no recomputation)`
        )
      }

    } catch (error) {
      console.warn('Warning: Could not rebuild indexes:', error)
      // Don't throw - allow system to start even if rebuild fails
    }
  }

  /**
   * Check health of metadata indexes
   *
   * Returns validation result indicating whether indexes are healthy
   * or corrupted (e.g., from the update() field asymmetry bug).
   *
   * This check was previously run on every init(), causing significant
   * overhead on cloud storage (90+ sequential reads for 30-field datasets).
   * Now available as an on-demand diagnostic method.
   */
  async checkHealth(): Promise<{
    healthy: boolean
    avgEntriesPerEntity: number
    entityCount: number
    indexEntryCount: number
    recommendation: string | null
  }> {
    await this.ensureInitialized()
    return this.metadataIndex.validateConsistency()
  }

  /**
   * Detect and repair corrupted metadata indexes
   *
   * Runs corruption detection and auto-rebuilds if corruption is found.
   * This is the equivalent of the old init()-time corruption check,
   * now available as an explicit operation.
   */
  async repairIndex(): Promise<void> {
    await this.ensureInitialized()
    await this.metadataIndex.detectAndRepairCorruption()
  }

  /**
   * Register a plugin manually.
   *
   * Must be called BEFORE init(). Plugins registered after init()
   * will not be activated.
   */
  use(plugin: BrainyPlugin): this {
    this.pluginRegistry.register(plugin)
    return this
  }

  /**
   * Get list of active plugin names.
   */
  getActivePlugins(): string[] {
    return this.pluginRegistry.getActivePlugins()
  }

  /**
   * Auto-detect and activate plugins.
   * Called internally during init().
   */
  private async loadPlugins(): Promise<void> {
    // Auto-detect installed plugins (e.g., @soulcraft/cortex)
    const pluginPackages = (this.config as any).plugins as string[] | undefined
    await this.pluginRegistry.autoDetect(pluginPackages || [])

    // Create plugin context
    const context: BrainyPluginContext = {
      registerProvider: (key, impl) => this.pluginRegistry.registerProvider(key, impl),
      version: getBrainyVersion()
    }

    // Activate all registered plugins
    const activated = await this.pluginRegistry.activateAll(context)
    if (activated.length > 0) {
      // Only log if not in silent mode
      if (!this.config.silent) {
        for (const name of activated) {
          console.log(`[brainy] Plugin activated: ${name}`)
        }
      }
    }
  }

  /**
   * Close and cleanup
   *
   * Now flushes HNSW dirty nodes before closing
   * This ensures deferred persistence mode data is saved
   */
  async close(): Promise<void> {
    // Phase 1: Flush ALL components in parallel to persist buffered data
    // This is critical when cortex native providers buffer data in Rust memory
    await Promise.all([
      // Flush HNSW dirty nodes (deferred persistence mode)
      (async () => {
        if (this.index && typeof (this.index as any).flush === 'function') {
          await (this.index as any).flush()
        }
      })(),
      // Flush metadata index (field indexes + EntityIdMapper)
      (async () => {
        if (this.metadataIndex && typeof this.metadataIndex.flush === 'function') {
          await this.metadataIndex.flush()
        }
      })(),
      // Flush graph adjacency index (LSM trees)
      (async () => {
        if (this.graphIndex && typeof this.graphIndex.flush === 'function') {
          await this.graphIndex.flush()
        }
      })(),
      // Flush storage adapter counts
      (async () => {
        if (this.storage && typeof (this.storage as any).flushCounts === 'function') {
          await (this.storage as any).flushCounts()
        }
      })()
    ])

    // Phase 2: Close components to release resources (timers, file handles)
    // Data is already safe on disk from Phase 1
    await Promise.all([
      (async () => {
        if (this.graphIndex && typeof this.graphIndex.close === 'function') {
          await this.graphIndex.close()
        }
      })(),
      (async () => {
        if (this.index && typeof (this.index as any).close === 'function') {
          await (this.index as any).close()
        }
      })(),
      (async () => {
        if (this.metadataIndex && typeof (this.metadataIndex as any).close === 'function') {
          await (this.metadataIndex as any).close()
        }
      })(),
    ])

    // Deactivate plugins (safe — all data flushed and resources released above)
    await this.pluginRegistry.deactivateAll()

    // Restore console methods if silent mode was enabled
    if (this.config.silent && this.originalConsole) {
      console.log = this.originalConsole.log as typeof console.log
      console.info = this.originalConsole.info as typeof console.info
      console.warn = this.originalConsole.warn as typeof console.warn
      console.error = this.originalConsole.error as typeof console.error
      this.originalConsole = undefined
    }

    // Drain the metadata write buffer if the storage adapter has one
    if (this.storage && 'metadataWriteBuffer' in this.storage) {
      const buffer = (this.storage as any).metadataWriteBuffer
      if (buffer && typeof buffer.destroy === 'function') {
        await buffer.destroy()
      }
    }

    this.initialized = false
  }

  /**
   * Intelligently auto-detect distributed configuration
   * Zero-config: Automatically determines best distributed settings
   */
  private autoDetectDistributed(config?: BrainyConfig['distributed']): BrainyConfig['distributed'] {
    // If explicitly disabled, respect that
    if (config?.enabled === false) {
      return config
    }

    // Auto-detect based on environment variables (common in production)
    const envEnabled = process.env.BRAINY_DISTRIBUTED === 'true' ||
                      process.env.NODE_ENV === 'production' ||
                      process.env.CLUSTER_SIZE ||
                      process.env.KUBERNETES_SERVICE_HOST // Running in K8s

    // Auto-detect based on storage type (S3/R2/GCS implies distributed)
    const storageImpliesDistributed =
      this.config?.storage?.type === 's3' ||
      this.config?.storage?.type === 'r2' ||
      this.config?.storage?.type === 'gcs'

    // If not explicitly configured but environment suggests distributed
    if (!config && (envEnabled || storageImpliesDistributed)) {
      return {
        enabled: true,
        nodeId: process.env.HOSTNAME || process.env.NODE_ID || `node-${Date.now()}`,
        nodes: process.env.BRAINY_NODES?.split(',') || [],
        coordinatorUrl: process.env.BRAINY_COORDINATOR || undefined,
        shardCount: parseInt(process.env.BRAINY_SHARDS || '64'),
        replicationFactor: parseInt(process.env.BRAINY_REPLICAS || '3'),
        consensus: process.env.BRAINY_CONSENSUS as any || 'raft',
        transport: process.env.BRAINY_TRANSPORT as any || 'http'
      }
    }

    // Merge with provided config, applying intelligent defaults
    return config ? {
      ...config,
      nodeId: config.nodeId || process.env.HOSTNAME || `node-${Date.now()}`,
      shardCount: config.shardCount || 64,
      replicationFactor: config.replicationFactor || 3,
      consensus: config.consensus || 'raft',
      transport: config.transport || 'http'
    } : undefined
  }

  /**
   * Setup distributed components with zero-config intelligence
   */
  private setupDistributedComponents(): void {
    const distConfig = this.config.distributed
    if (!distConfig?.enabled) return

    console.log('🌍 Initializing distributed mode:', {
      nodeId: distConfig.nodeId,
      shards: distConfig.shardCount,
      replicas: distConfig.replicationFactor
    })

    // Initialize coordinator for consensus
    this.coordinator = new DistributedCoordinator({
      nodeId: distConfig.nodeId,
      address: distConfig.coordinatorUrl?.split(':')[0] || 'localhost',
      port: parseInt(distConfig.coordinatorUrl?.split(':')[1] || '8080'),
      nodes: distConfig.nodes
    })

    // Start the coordinator to establish leadership
    this.coordinator.start().catch(err => {
      console.warn('Coordinator start failed (will retry on init):', err.message)
    })

    // Initialize shard manager for data distribution
    this.shardManager = new ShardManager({
      shardCount: distConfig.shardCount,
      replicationFactor: distConfig.replicationFactor,
      virtualNodes: 150, // Optimal for consistent distribution
      autoRebalance: true
    })

    // Initialize cache synchronization
    this.cacheSync = new CacheSync({
      nodeId: distConfig.nodeId!,
      syncInterval: 1000
    } as any)

    // Initialize read/write separation if we have replicas
    // Note: Will be properly initialized after coordinator starts
    if (distConfig.replicationFactor && distConfig.replicationFactor > 1) {
      // Defer creation until coordinator is ready
      setTimeout(() => {
        this.readWriteSeparation = new ReadWriteSeparation(
          {
            nodeId: distConfig.nodeId!,
            consistencyLevel: 'eventual',
            role: 'replica', // Start as replica, will promote if leader
            syncInterval: 5000
          },
          this.coordinator!,
          this.shardManager!,
          this.cacheSync!
        )
      }, 100)
    }
  }

  /**
   * Pass distributed components to storage adapter
   */
  private async connectDistributedStorage(): Promise<void> {
    if (!this.config.distributed?.enabled) return

    // Check if storage supports distributed operations
    if ('setDistributedComponents' in this.storage) {
      (this.storage as any).setDistributedComponents({
        coordinator: this.coordinator,
        shardManager: this.shardManager,
        cacheSync: this.cacheSync,
        readWriteSeparation: this.readWriteSeparation
      })

      console.log('✅ Distributed storage connected')
    }
  }
}

// Re-export types for convenience
export * from './types/brainy.types.js'
export { NounType, VerbType } from './types/graphTypes.js'