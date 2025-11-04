/**
 * 🧠 Brainy 3.0 - The Future of Neural Databases
 *
 * Beautiful, Professional, Planet-Scale, Fun to Use
 * NO STUBS, NO MOCKS, REAL IMPLEMENTATION
 */

import { v4 as uuidv4 } from './universal/uuid.js'
import { HNSWIndex } from './hnsw/hnswIndex.js'
import { HNSWIndexOptimized } from './hnsw/hnswIndexOptimized.js'
import { TypeAwareHNSWIndex } from './hnsw/typeAwareHNSWIndex.js'
import { createStorage } from './storage/storageFactory.js'
import { BaseStorage } from './storage/baseStorage.js'
import { StorageAdapter, Vector, DistanceFunction, EmbeddingFunction, GraphVerb } from './coreTypes.js'
import {
  defaultEmbeddingFunction,
  cosineDistance
} from './utils/index.js'
import { matchesMetadataFilter } from './utils/metadataFilter.js'
import { AugmentationRegistry, AugmentationContext } from './augmentations/brainyAugmentation.js'
import { createDefaultAugmentations } from './augmentations/defaultAugmentations.js'
import { ImprovedNeuralAPI } from './neural/improvedNeuralAPI.js'
import { NaturalLanguageProcessor } from './neural/naturalLanguageProcessor.js'
import { NeuralEntityExtractor, ExtractedEntity } from './neural/entityExtractor.js'
import { TripleIntelligenceSystem } from './triple/TripleIntelligenceSystem.js'
import { VirtualFileSystem } from './vfs/VirtualFileSystem.js'
import { VersioningAPI } from './versioning/VersioningAPI.js'
import { MetadataIndexManager } from './utils/metadataIndex.js'
import { GraphAdjacencyIndex } from './graph/graphAdjacencyIndex.js'
import { CommitBuilder } from './storage/cow/CommitObject.js'
import { createPipeline } from './streaming/pipeline.js'
import { configureLogger, LogLevel } from './utils/logger.js'
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
  AddManyParams,
  DeleteManyParams,
  RelateManyParams,
  BatchResult,
  BrainyConfig,
  ScoreExplanation
} from './types/brainy.types.js'
import { NounType, VerbType } from './types/graphTypes.js'
import { BrainyInterface } from './types/brainyInterface.js'

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
  private index!: HNSWIndex | HNSWIndexOptimized | TypeAwareHNSWIndex
  private storage!: BaseStorage
  private metadataIndex!: MetadataIndexManager
  private graphIndex!: GraphAdjacencyIndex
  private embedder: EmbeddingFunction
  private distance: DistanceFunction
  private augmentationRegistry: AugmentationRegistry
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

  // Sub-APIs (lazy-loaded)
  private _neural?: ImprovedNeuralAPI
  private _nlp?: NaturalLanguageProcessor
  private _extractor?: NeuralEntityExtractor
  private _tripleIntelligence?: TripleIntelligenceSystem
  private _versions?: VersioningAPI
  private _vfs?: VirtualFileSystem

  // State
  private initialized = false
  private dimensions?: number

  constructor(config?: BrainyConfig) {
    // Normalize configuration with defaults
    this.config = this.normalizeConfig(config)

    // Setup core components
    this.distance = cosineDistance
    this.embedder = this.setupEmbedder()
    this.augmentationRegistry = this.setupAugmentations()

    // Setup distributed components if enabled
    if (this.config.distributed?.enabled) {
      this.setupDistributedComponents()
    }

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
        model: { ...this.config.model, ...configOverrides.model },
        index: { ...this.config.index, ...configOverrides.index },
        augmentations: { ...this.config.augmentations, ...configOverrides.augmentations },
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
      // Setup and initialize storage
      this.storage = await this.setupStorage()
      await this.storage.init()

      // Enable COW immediately after storage init (v5.0.1)
      // This ensures ALL data is stored in branch-scoped paths from the start
      // Lightweight: just sets cowEnabled=true and currentBranch, no RefManager/BlobStorage yet
      if (typeof (this.storage as any).enableCOWLightweight === 'function') {
        (this.storage as any).enableCOWLightweight((this.config.storage as any)?.branch || 'main')
      }

      // Setup index now that we have storage
      this.index = this.setupIndex()

      // Initialize core metadata index
      this.metadataIndex = new MetadataIndexManager(this.storage)
      await this.metadataIndex.init()

      // Initialize core graph index
      this.graphIndex = new GraphAdjacencyIndex(this.storage)

      // Rebuild indexes if needed for existing data
      await this.rebuildIndexesIfNeeded()

      // Initialize augmentations
      await this.augmentationRegistry.initializeAll({
        brain: this,
        storage: this.storage,
        config: this.config,
        log: (message: string, level = 'info') => {
          // Simple logging for now
          if (level === 'error') {
            console.error(message)
          } else if (level === 'warn') {
            console.warn(message)
          } else {
            console.log(message)
          }
        }
      })

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

      // v5.2.0: Initialize COW (BlobStorage) before VFS
      // VFS now requires BlobStorage for unified file storage
      if (typeof (this.storage as any).initializeCOW === 'function') {
        await (this.storage as any).initializeCOW({
          branch: (this.config.storage as any)?.branch || 'main',
          enableCompression: true
        })
      }

      // Mark as initialized BEFORE VFS init (v5.0.1)
      // VFS.init() needs brain to be marked initialized to call brain methods
      this.initialized = true

      // Initialize VFS (v5.0.1): Ensure VFS is ready when accessed as property
      // This eliminates need for separate vfs.init() calls - zero additional complexity
      this._vfs = new VirtualFileSystem(this)
      await this._vfs.init()
    } catch (error) {
      throw new Error(`Failed to initialize Brainy: ${error}`)
    }
  }

  /**
   * Register shutdown hooks for graceful count flushing (v3.32.3+)
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
      console.log('⚠️  Shutdown signal received - flushing pending counts...')
      try {
        // Flush counts for all Brainy instances
        let flushedCount = 0
        for (const instance of Brainy.instances) {
          if (instance.storage && typeof (instance.storage as any).flushCounts === 'function') {
            await (instance.storage as any).flushCounts()
            flushedCount++
          }
        }
        if (flushedCount > 0) {
          console.log(`✅ Counts flushed successfully (${flushedCount} instance${flushedCount > 1 ? 's' : ''})`)
        }
      } catch (error) {
        console.error('❌ Failed to flush counts on shutdown:', error)
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
   * @param params.confidence - Type classification confidence (0-1) *New in v4.3.0*
   * @param params.weight - Entity importance/salience (0-1) *New in v4.3.0*
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
   * @example Adding with confidence and weight (New in v4.3.0)
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

    // Zero-config validation
    const { validateAddParams } = await import('./utils/paramValidation.js')
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

    // Execute through augmentation pipeline
    return this.augmentationRegistry.execute('add', params, async () => {
      // Add to index (Phase 2: pass type for TypeAwareHNSWIndex)
      if (this.index instanceof TypeAwareHNSWIndex) {
        await this.index.addItem({ id, vector }, params.type as any)
      } else {
        await this.index.addItem({ id, vector })
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

      // v5.0.1: Save metadata FIRST so TypeAwareStorage can cache the type
      // This prevents the race condition where saveNoun() defaults to 'thing'
      await this.storage.saveNounMetadata(id, storageMetadata)

      // Then save vector
      await this.storage.saveNoun({
        id,
        vector,
        connections: new Map(),
        level: 0
      })

      // v4.8.0: Build entity structure for indexing (NEW - with top-level fields)
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

      // Pass full entity structure to metadata index
      await this.metadataIndex.addToIndex(id, entityForIndexing)

      return id
    })
  }

  /**
   * Get an entity by ID
   *
   * @param id - The unique identifier of the entity to retrieve
   * @returns Promise that resolves to the entity if found, null if not found
   *
   * **Entity includes (v4.3.0):**
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
   * // Accessing confidence and weight (New in v4.3.0)
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
  async get(id: string): Promise<Entity<T> | null> {
    await this.ensureInitialized()

    return this.augmentationRegistry.execute('get', { id }, async () => {
      // Get from storage
      const noun = await this.storage.getNoun(id)
      if (!noun) {
        return null
      }

      // Use the common conversion method
      return this.convertNounToEntity(noun)
    })
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
   * Convert a noun from storage to an entity (v4.8.0 - SIMPLIFIED!)
   *
   * v4.8.0: Dramatically simplified - standard fields moved to top-level
   * - Extracts standard fields from metadata (storage format)
   * - Returns entity with standard fields at top-level (in-memory format)
   * - metadata contains ONLY custom user fields
   */
  private async convertNounToEntity(noun: any): Promise<Entity<T>> {
    // v4.8.0: Storage adapters ALREADY extract standard fields to top-level!
    // Just read from top-level fields of HNSWNounWithMetadata

    // v4.8.0: Clean structure with standard fields at top-level
    const entity: Entity<T> = {
      id: noun.id,
      vector: noun.vector,
      type: noun.type || NounType.Thing,

      // Standard fields at top-level (v4.8.0)
      confidence: noun.confidence,
      weight: noun.weight,
      createdAt: noun.createdAt || Date.now(),
      updatedAt: noun.updatedAt || Date.now(),
      service: noun.service,
      data: noun.data,
      createdBy: noun.createdBy,

      // ONLY custom user fields in metadata (v4.8.0: already separated by storage adapter)
      metadata: noun.metadata as T
    }

    return entity
  }

  /**
   * Update an entity
   */
  async update(params: UpdateParams<T>): Promise<void> {
    await this.ensureInitialized()

    // Zero-config validation
    const { validateUpdateParams } = await import('./utils/paramValidation.js')
    validateUpdateParams(params)

    return this.augmentationRegistry.execute('update', params, async () => {
      // Get existing entity
      const existing = await this.get(params.id)
      if (!existing) {
        throw new Error(`Entity ${params.id} not found`)
      }

      // Update vector if data changed OR if type changed (need to re-index with new type)
      let vector = existing.vector
      const newType = params.type || existing.type
      if (params.data || params.type) {
        if (params.data) {
          vector = params.vector || (await this.embed(params.data))
        }
        // Update in index (remove and re-add since no update method)
        // Phase 2: pass type for TypeAwareHNSWIndex
        if (this.index instanceof TypeAwareHNSWIndex) {
          await this.index.removeItem(params.id, existing.type as any)
          await this.index.addItem({ id: params.id, vector }, newType as any) // v5.1.0: use new type
        } else {
          await this.index.removeItem(params.id)
          await this.index.addItem({ id: params.id, vector })
        }
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
        data: params.data !== undefined ? params.data : existing.data, // v4.8.0: Store data field
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

      // v4.0.0: Save metadata FIRST (v5.1.0 fix: updates type cache for TypeAwareStorage)
      // v5.1.0: saveNounMetadata must be called before saveNoun so that the type cache
      // is updated before determining the shard path. Otherwise type changes cause
      // entities to be saved in the wrong shard and become unfindable.
      await this.storage.saveNounMetadata(params.id, updatedMetadata)

      // Then save vector (will use updated type cache)
      await this.storage.saveNoun({
        id: params.id,
        vector,
        connections: new Map(),
        level: 0
      })

      // v4.8.0: Build entity structure for metadata index (with top-level fields)
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

      // Update metadata index - remove old entry and add new one with v4.8.0 structure
      await this.metadataIndex.removeFromIndex(params.id, existing.metadata)
      await this.metadataIndex.addToIndex(params.id, entityForIndexing)
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

    return this.augmentationRegistry.execute('delete', { id }, async () => {
      // Remove from vector index (Phase 2: get type for TypeAwareHNSWIndex)
      if (this.index instanceof TypeAwareHNSWIndex) {
        // Get entity metadata to determine type
        const metadata = await this.storage.getNounMetadata(id)
        if (metadata && metadata.noun) {
          await this.index.removeItem(id, metadata.noun as any)
        }
      } else {
        await this.index.removeItem(id)
      }

      // Remove from metadata index
      await this.metadataIndex.removeFromIndex(id)

      // Delete from storage
      await this.storage.deleteNoun(id)
      
      // Delete metadata (if it exists as separate)
      try {
        await this.storage.saveMetadata(id, null as any) // Clear metadata
      } catch {
        // Ignore if not supported
      }

      // Delete related verbs
      const verbs = await this.storage.getVerbsBySource(id)
      const targetVerbs = await this.storage.getVerbsByTarget(id)
      const allVerbs = [...verbs, ...targetVerbs]

      for (const verb of allVerbs) {
        // Remove from graph index first
        await this.graphIndex.removeVerb(verb.id)
        // Then delete from storage
        await this.storage.deleteVerb(verb.id)
        // Delete verb metadata if exists
        try {
          if (typeof (this.storage as any).deleteVerbMetadata === 'function') {
            await (this.storage as any).deleteVerbMetadata(verb.id)
          }
        } catch {
          // Ignore if not supported
        }
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

    // Zero-config validation
    const { validateRelateParams } = await import('./utils/paramValidation.js')
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

    // CRITICAL FIX (v3.43.2): Check for duplicate relationships
    // This prevents infinite loops where same relationship is created repeatedly
    // Bug #1 showed incrementing verb counts (7→8→9...) indicating duplicates
    const existingVerbs = await this.storage.getVerbsBySource(params.from)
    const duplicate = existingVerbs.find(v =>
      v.targetId === params.to &&
      v.verb === params.type
    )

    if (duplicate) {
      // Relationship already exists - return existing ID instead of creating duplicate
      console.log(`[DEBUG] Skipping duplicate relationship: ${params.from} → ${params.to} (${params.type})`)
      return duplicate.id
    }

    // Generate ID
    const id = uuidv4()

    // Compute relationship vector (average of entities)
    const relationVector = fromEntity.vector.map(
      (v, i) => (v + toEntity.vector[i]) / 2
    )

    return this.augmentationRegistry.execute('relate', params, async () => {
      // v4.0.0: Prepare verb metadata
      // CRITICAL (v4.1.2): Include verb type in metadata for count tracking
      const verbMetadata = {
        verb: params.type, // Store verb type for count synchronization
        weight: params.weight ?? 1.0,
        ...(params.metadata || {}),
        createdAt: Date.now()
      }

      // Save to storage (v4.0.0: vector and metadata separately)
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

      await this.storage.saveVerb({
        id,
        vector: relationVector,
        connections: new Map(),
        verb: params.type,
        sourceId: params.from,
        targetId: params.to
      })

      await this.storage.saveVerbMetadata(id, verbMetadata)

      // Add to graph index for O(1) lookups
      await this.graphIndex.addVerb(verb)

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

        await this.storage.saveVerb({
          id: reverseId,
          vector: relationVector,
          connections: new Map(),
          verb: params.type,
          sourceId: params.to,
          targetId: params.from
        })

        await this.storage.saveVerbMetadata(reverseId, verbMetadata)

        // Add reverse relationship to graph index too
        await this.graphIndex.addVerb(reverseVerb)
      }

      return id
    })
  }

  /**
   * Delete a relationship
   */
  async unrelate(id: string): Promise<void> {
    await this.ensureInitialized()

    return this.augmentationRegistry.execute('unrelate', { id }, async () => {
      // Remove from graph index
      await this.graphIndex.removeVerb(id)
      // Remove from storage
      await this.storage.deleteVerb(id)
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
   * @since v4.1.3 - Fixed bug where calling without parameters returned empty array
   * @since v4.1.3 - Added string ID shorthand syntax: getRelations(id)
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

    // v4.7.0: VFS relationships are no longer filtered
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
   * **Result Structure (v4.3.0):**
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
   * // NEW in v4.3.0: Access flattened fields directly
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
   * // VFS Filtering (v4.4.0): Exclude VFS entities by default
   * // Knowledge graph queries stay clean - no VFS files in results
   * const knowledge = await brainy.find({ query: 'AI concepts' })
   * // Returns only knowledge entities, VFS files excluded
   *
   * @example
   * // v4.7.0: VFS entities included by default
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
   *   excludeVFS: true  // v4.7.0: Exclude VFS files
   * })
   */
  async find(query: string | FindParams<T>): Promise<Result<T>[]> {
    await this.ensureInitialized()

    // Parse natural language queries
    const params: FindParams<T> =
      typeof query === 'string' ? await this.parseNaturalQuery(query) : query

    // Phase 3: Automatic type inference for 40% latency reduction
    if (params.query && !params.type && this.index instanceof TypeAwareHNSWIndex) {
      // Import Phase 3 components dynamically
      const { getQueryPlanner } = await import('./query/typeAwareQueryPlanner.js')
      const planner = getQueryPlanner()
      const plan = await planner.planQuery(params.query)

      // Use inferred types if confidence is sufficient
      if (plan.confidence > 0.6) {
        params.type = plan.targetTypes.length === 1
          ? plan.targetTypes[0]
          : plan.targetTypes

        // Log for analytics (production-friendly)
        if (this.config.verbose) {
          console.log(
            `[Phase 3] Inferred types: ${plan.routing} ` +
            `(${plan.targetTypes.length} types, ` +
            `${(plan.confidence * 100).toFixed(0)}% confidence, ` +
            `${plan.estimatedSpeedup.toFixed(1)}x estimated speedup)`
          )
        }
      }
    }

    // Zero-config validation - only enforces universal truths
    const { validateFindParams, recordQueryPerformance } = await import('./utils/paramValidation.js')
    validateFindParams(params)

    const startTime = Date.now()
    const result = await this.augmentationRegistry.execute('find', params, async () => {
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

        // v4.7.0: excludeVFS helper for cleaner UX
        // Use vfsType field (more semantic than isVFS)
        if (params.excludeVFS === true) {
          filter.vfsType = { exists: false }
        }

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

        // v4.5.4: Apply sorting if requested, otherwise just filter
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

        // Load entities for the paginated results
        for (const id of pageIds) {
          const entity = await this.get(id)
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

        // v4.7.0: excludeVFS helper
        let filter: any = {}
        if (params.excludeVFS === true) {
          filter.vfsType = { exists: false }
        }

        // Use metadata index if we need to filter
        if (Object.keys(filter).length > 0) {
          const filteredIds = await this.metadataIndex.getIdsForFilter(filter)
          const pageIds = filteredIds.slice(offset, offset + limit)

          for (const id of pageIds) {
            const entity = await this.get(id)
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

      // Execute parallel searches for optimal performance
      const searchPromises: Promise<Result<T>[]>[] = []
      
      // Vector search component
      if (params.query || params.vector) {
        searchPromises.push(this.executeVectorSearch(params))
      }
      
      // Proximity search component
      if (params.near) {
        searchPromises.push(this.executeProximitySearch(params))
      }
      
      // Execute searches in parallel
      if (searchPromises.length > 0) {
        const searchResults = await Promise.all(searchPromises)
        for (const batch of searchResults) {
          results.push(...batch)
        }
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

      // Apply O(log n) metadata filtering using core MetadataIndexManager
      if (params.where || params.type || params.service || params.excludeVFS) {
        // Build filter object for metadata index
        let filter: any = {}

        // Base filter from where and service
        if (params.where) Object.assign(filter, params.where)
        if (params.service) filter.service = params.service

        // v4.7.0: excludeVFS helper for cleaner UX
        if (params.excludeVFS === true) {
          filter.vfsType = { exists: false }
        }

        if (params.type) {
          const types = Array.isArray(params.type) ? params.type : [params.type]
          if (types.length === 1) {
            filter.noun = types[0]
          } else {
            // For multiple types, create separate filter for each type with all conditions
            filter = {
              anyOf: types.map(type => ({
                noun: type,
                ...filter
              }))
            }
          }
        }

        const filteredIds = await this.metadataIndex.getIdsForFilter(filter)
        
        // CRITICAL FIX: Handle both cases properly
        if (results.length > 0) {
          // OPTIMIZED: Filter existing results (from vector search) efficiently
          const filteredIdSet = new Set(filteredIds)
          results = results.filter((r) => filteredIdSet.has(r.id))

          // Apply early pagination for vector + metadata queries
          const limit = params.limit || 10
          const offset = params.offset || 0

          // If we have enough filtered results, sort and paginate early
          if (results.length >= offset + limit) {
            results.sort((a, b) => b.score - a.score)
            results = results.slice(offset, offset + limit)

            // Load entities only for the paginated results
            for (const result of results) {
              if (!result.entity) {
                const entity = await this.get(result.id)
                if (entity) {
                  result.entity = entity
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

          // Load only entities for current page - O(page_size) instead of O(total_results)
          for (const id of pageIds) {
            const entity = await this.get(id)
            if (entity) {
              results.push(this.createResult(id, 1.0, entity))
            }
          }

          // Early return for metadata-only queries with pagination applied
          if (!params.query && !params.connected) {
            // v4.5.4: Apply sorting if requested for metadata-only queries
            if (params.orderBy) {
              const sortedIds = await this.metadataIndex.getSortedIdsForFilter(
                filter,
                params.orderBy,
                params.order || 'asc'
              )

              // Paginate sorted IDs BEFORE loading entities (production-scale!)
              const limit = params.limit || 10
              const offset = params.offset || 0
              const pageIds = sortedIds.slice(offset, offset + limit)

              // Load entities for paginated results only
              const sortedResults: Result<T>[] = []
              for (const id of pageIds) {
                const entity = await this.get(id)
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
      // v4.5.4: Support custom orderBy for vector + metadata queries
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

      const limit = params.limit || 10
      const offset = params.offset || 0

      // Efficient pagination - only slice what we need
      return results.slice(offset, offset + limit)
    })
    
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
   * **Returns (v4.3.0):**
   * Same Result structure as find() with flattened fields for convenient access
   *
   * @example
   * // Find entities similar to a specific entity by ID
   * const similarDocs = await brainy.similar({
   *   to: 'document-123',
   *   limit: 10
   * })
   *
   * // NEW in v4.3.0: Access flattened fields
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
      const entity = await this.get(params.to)
      if (!entity) {
        throw new Error(`Entity ${params.to} not found`)
      }
      targetVector = entity.vector
    } else if (Array.isArray(params.to)) {
      targetVector = params.to as Vector
    } else {
      targetVector = (params.to as Entity<T>).vector
    }

    // Use find with vector
    return this.find({
      vector: targetVector,
      limit: params.limit,
      type: params.type,
      where: params.where,
      service: params.service,
      excludeVFS: params.excludeVFS  // v4.7.0: Pass through VFS filtering
    })
  }

  // ============= BATCH OPERATIONS =============

  /**
   * Add multiple entities
   */
  async addMany(params: AddManyParams<T>): Promise<BatchResult<string>> {
    await this.ensureInitialized()

    // Get optimal batch configuration from storage adapter (v4.11.0)
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

    for (const id of idsToDelete) {
      try {
        await this.delete(id)
        result.successful.push(id)
      } catch (error) {
        result.failed.push({
          item: id,
          error: (error as Error).message
        })
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

    // Get optimal batch configuration from storage adapter (v4.11.0)
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

    return this.augmentationRegistry.execute('clear', {}, async () => {
      // Clear storage
      await this.storage.clear()
      
      // Reset index
      if ('clear' in this.index && typeof this.index.clear === 'function') {
        await this.index.clear()
      } else {
        // Recreate index if no clear method
        this.index = this.setupIndex()
      }
      
      // Reset dimensions
      this.dimensions = undefined
      
      // Clear any cached sub-APIs
      this._neural = undefined
      this._nlp = undefined
      this._tripleIntelligence = undefined
    })
  }

  // ============= COW (COPY-ON-WRITE) API - v5.0.0 =============

  /**
   * Fork the brain (instant clone via Snowflake-style COW)
   *
   * Creates a shallow copy in <100ms using copy-on-write (COW) technology.
   * Fork shares storage and HNSW data structures with parent, copying only
   * when modified (lazy deep copy).
   *
   * **How It Works (v5.0.0)**:
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
   * @since v5.0.0
   */
  async fork(branch?: string, options?: {
    author?: string
    message?: string
    metadata?: Record<string, any>
  }): Promise<Brainy<T>> {
    await this.ensureInitialized()

    return this.augmentationRegistry.execute('fork', { branch, options }, async () => {
      const branchName = branch || `fork-${Date.now()}`

      // v5.0.1: Lazy COW initialization - enable automatically on first fork()
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
            'Please use v5.0.0+ storage adapters.'
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

      // Step 2: Create new Brainy instance pointing to fork branch
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

      // Shallow copy HNSW index (INSTANT - just copies Map references)
      clone.index = this.setupIndex()

      // Enable COW (handle both HNSWIndex and TypeAwareHNSWIndex)
      if ('enableCOW' in clone.index && typeof clone.index.enableCOW === 'function') {
        (clone.index as any).enableCOW(this.index)
      }

      // Fast rebuild for small indexes from COW storage (Metadata/Graph are fast)
      clone.metadataIndex = new MetadataIndexManager(clone.storage)
      await clone.metadataIndex.init()

      clone.graphIndex = new GraphAdjacencyIndex(clone.storage)
      await clone.graphIndex.rebuild()

      // Setup augmentations
      clone.augmentationRegistry = this.setupAugmentations()
      await clone.augmentationRegistry.initializeAll({
        brain: clone,
        storage: clone.storage,
        config: clone.config,
        log: (message: string, level?: 'info' | 'warn' | 'error') => {
          if (!clone.config.silent) {
            console[level || 'info'](message)
          }
        }
      })

      // Mark as initialized
      clone.initialized = true
      clone.dimensions = this.dimensions

      return clone
    })
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

    return this.augmentationRegistry.execute('listBranches', {}, async () => {
      if (!('refManager' in this.storage)) {
        throw new Error('Branch management requires COW-enabled storage (v5.0.0+)')
      }

      const refManager = (this.storage as any).refManager
      const refs = await refManager.listRefs()

      // Filter to branches only (exclude tags)
      return refs
        .filter((ref: any) => ref.name.startsWith('refs/heads/'))
        .map((ref: any) => ref.name.replace('refs/heads/', ''))
    })
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

    return this.augmentationRegistry.execute('getCurrentBranch', {}, async () => {
      if (!('currentBranch' in this.storage)) {
        return 'main' // Default branch
      }

      return (this.storage as any).currentBranch || 'main'
    })
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

    return this.augmentationRegistry.execute('checkout', { branch }, async () => {
      if (!('refManager' in this.storage)) {
        throw new Error('Branch management requires COW-enabled storage (v5.0.0+)')
      }

      // Verify branch exists
      const branches = await this.listBranches()
      if (!branches.includes(branch)) {
        throw new Error(`Branch '${branch}' does not exist`)
      }

      // Update storage currentBranch
      (this.storage as any).currentBranch = branch

      // Reload from new branch
      // Clear indexes and reload
      this.index = this.setupIndex()
      this.metadataIndex = new (MetadataIndexManager as any)(this.storage)
      this.graphIndex = new GraphAdjacencyIndex(this.storage)

      // Re-initialize
      this.initialized = false
      await this.init()
    })
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
  }): Promise<string> {
    await this.ensureInitialized()

    return this.augmentationRegistry.execute('commit', { options }, async () => {
      if (!('refManager' in this.storage) || !('commitLog' in this.storage) || !('blobStorage' in this.storage)) {
        throw new Error('Commit requires COW-enabled storage (v5.0.0+)')
      }

      const refManager = (this.storage as any).refManager
      const blobStorage = (this.storage as any).blobStorage
      const currentBranch = await this.getCurrentBranch()

      // Get current HEAD commit (parent)
      const currentCommitHash = await refManager.resolveRef(currentBranch)

      // Get current state statistics
      const entityCount = await this.getNounCount()
      const relationshipCount = await this.getVerbCount()

      // Build commit object using builder pattern
      const builder = CommitBuilder.create(blobStorage)
        .tree('0000000000000000000000000000000000000000000000000000000000000000') // Empty tree hash for now
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
    })
  }

  /**
   * Merge a source branch into target branch
   * @param sourceBranch - Branch to merge from
   * @param targetBranch - Branch to merge into
   * @param options - Merge options (strategy, author, onConflict)
   * @returns Merge result with statistics
   *
   * @example
   * ```typescript
   * const result = await brain.merge('experiment', 'main', {
   *   strategy: 'last-write-wins',
   *   author: 'dev@example.com'
   * })
   * console.log(result) // { added: 5, modified: 3, deleted: 1, conflicts: 0 }
   * ```
   */
  async merge(
    sourceBranch: string,
    targetBranch: string,
    options?: {
      strategy?: 'last-write-wins' | 'first-write-wins' | 'custom'
      author?: string
      onConflict?: (entityA: any, entityB: any) => Promise<any>
    }
  ): Promise<{
    added: number
    modified: number
    deleted: number
    conflicts: number
  }> {
    await this.ensureInitialized()

    return this.augmentationRegistry.execute(
      'merge',
      { sourceBranch, targetBranch, options },
      async () => {
        if (!('refManager' in this.storage) || !('blobStorage' in this.storage)) {
          throw new Error('Merge requires COW-enabled storage (v5.0.0+)')
        }

        const strategy = options?.strategy || 'last-write-wins'
        let added = 0
        let modified = 0
        let deleted = 0
        let conflicts = 0

        // Verify both branches exist
        const branches = await this.listBranches()
        if (!branches.includes(sourceBranch)) {
          throw new Error(`Source branch '${sourceBranch}' does not exist`)
        }
        if (!branches.includes(targetBranch)) {
          throw new Error(`Target branch '${targetBranch}' does not exist`)
        }

        // 1. Create temporary fork of source branch to read from
        const sourceFork = await this.fork(`${sourceBranch}-merge-temp-${Date.now()}`)
        await sourceFork.checkout(sourceBranch)

        // 2. Save current branch and checkout target
        const currentBranch = await this.getCurrentBranch()
        if (currentBranch !== targetBranch) {
          await this.checkout(targetBranch)
        }

        try {
          // 3. Get all entities from source and target
          const sourceResults = await sourceFork.find({})
          const targetResults = await this.find({})

          // Create maps for faster lookup
          const targetMap = new Map(targetResults.map(r => [r.entity.id, r.entity]))

          // 4. Merge entities
          for (const sourceResult of sourceResults) {
            const sourceEntity = sourceResult.entity
            const targetEntity = targetMap.get(sourceEntity.id)

            if (!targetEntity) {
              // NEW entity in source - ADD to target
              await this.add({
                id: sourceEntity.id,
                type: sourceEntity.type,
                data: sourceEntity.data,
                vector: sourceEntity.vector
              })
              added++
            } else {
              // Entity exists in both branches - check for conflicts
              const sourceTime = sourceEntity.updatedAt || sourceEntity.createdAt || 0
              const targetTime = targetEntity.updatedAt || targetEntity.createdAt || 0

              // If timestamps are identical, no change needed
              if (sourceTime === targetTime) {
                continue
              }

              // Apply merge strategy
              if (strategy === 'last-write-wins') {
                if (sourceTime > targetTime) {
                  // Source is newer, update target
                  await this.update({ id: sourceEntity.id, data: sourceEntity.data })
                  modified++
                }
                // else target is newer, keep target
              } else if (strategy === 'first-write-wins') {
                if (sourceTime < targetTime) {
                  // Source is older, update target
                  await this.update({ id: sourceEntity.id, data: sourceEntity.data })
                  modified++
                }
              } else if (strategy === 'custom' && options?.onConflict) {
                // Custom conflict resolution
                const resolved = await options.onConflict(targetEntity, sourceEntity)
                await this.update({ id: sourceEntity.id, data: resolved.data })
                modified++
                conflicts++
              } else {
                // Conflict detected but no resolution strategy
                conflicts++
              }
            }
          }

          // 5. Merge relationships (verbs)
          const sourceVerbsResult = await sourceFork.storage.getVerbs({})
          const targetVerbsResult = await this.storage.getVerbs({})

          const sourceVerbs = sourceVerbsResult.items || []
          const targetVerbs = targetVerbsResult.items || []

          // Create set of existing target relationships for deduplication
          const targetRelSet = new Set(
            targetVerbs.map((v: any) => `${v.sourceId}-${v.verb}-${v.targetId}`)
          )

          // Add relationships that don't exist in target
          for (const sourceVerb of sourceVerbs) {
            const key = `${sourceVerb.sourceId}-${sourceVerb.verb}-${sourceVerb.targetId}`
            if (!targetRelSet.has(key)) {
              // Only add if both entities exist in target
              const hasSource = targetMap.has(sourceVerb.sourceId)
              const hasTarget = targetMap.has(sourceVerb.targetId)

              if (hasSource && hasTarget) {
                await this.relate({
                  from: sourceVerb.sourceId,
                  to: sourceVerb.targetId,
                  type: sourceVerb.verb as any,
                  weight: sourceVerb.weight,
                  metadata: sourceVerb.metadata as any
                })
              }
            }
          }

          // 6. Create merge commit
          if ('commitLog' in this.storage) {
            await this.commit({
              message: `Merge ${sourceBranch} into ${targetBranch}`,
              author: options?.author || 'system',
              metadata: {
                mergeType: 'branch',
                source: sourceBranch,
                target: targetBranch,
                strategy,
                stats: { added, modified, deleted, conflicts }
              }
            })
          }
        } finally {
          // 7. Clean up temporary fork (just delete the temp branch)
          try {
            const tempBranchName = `${sourceBranch}-merge-temp-${Date.now()}`
            const branches = await this.listBranches()
            if (branches.includes(tempBranchName)) {
              await this.deleteBranch(tempBranchName)
            }
          } catch (err) {
            // Ignore cleanup errors
          }

          // Restore original branch if needed
          if (currentBranch !== targetBranch) {
            await this.checkout(currentBranch)
          }
        }

        return { added, modified, deleted, conflicts }
      }
    )
  }

  /**
   * Compare differences between two branches (like git diff)
   * @param sourceBranch - Branch to compare from (defaults to current branch)
   * @param targetBranch - Branch to compare to (defaults to 'main')
   * @returns Diff result showing added, modified, and deleted entities/relationships
   *
   * @example
   * ```typescript
   * // Compare current branch with main
   * const diff = await brain.diff()
   *
   * // Compare two specific branches
   * const diff = await brain.diff('experiment', 'main')
   * console.log(diff)
   * // {
   * //   entities: { added: 5, modified: 3, deleted: 1 },
   * //   relationships: { added: 10, modified: 2, deleted: 0 }
   * // }
   * ```
   */
  async diff(
    sourceBranch?: string,
    targetBranch?: string
  ): Promise<{
    entities: {
      added: Array<{ id: string; type: string; data?: any }>
      modified: Array<{ id: string; type: string; changes: string[] }>
      deleted: Array<{ id: string; type: string }>
    }
    relationships: {
      added: Array<{ from: string; to: string; type: string }>
      modified: Array<{ from: string; to: string; type: string; changes: string[] }>
      deleted: Array<{ from: string; to: string; type: string }>
    }
    summary: {
      entitiesAdded: number
      entitiesModified: number
      entitiesDeleted: number
      relationshipsAdded: number
      relationshipsModified: number
      relationshipsDeleted: number
    }
  }> {
    await this.ensureInitialized()

    return this.augmentationRegistry.execute(
      'diff',
      { sourceBranch, targetBranch },
      async () => {
        // Default branches
        const source = sourceBranch || (await this.getCurrentBranch())
        const target = targetBranch || 'main'
        const currentBranch = await this.getCurrentBranch()

        // If source is current branch, use this instance directly (no fork needed)
        let sourceFork: Brainy<T>
        let sourceForkCreated = false
        if (source === currentBranch) {
          sourceFork = this
        } else {
          sourceFork = await this.fork(`temp-diff-source-${Date.now()}`)
          sourceForkCreated = true
          try {
            await sourceFork.checkout(source)
          } catch (err) {
            // If checkout fails, branch may not exist - just use current state
          }
        }

        // If target is current branch, use this instance directly (no fork needed)
        let targetFork: Brainy<T>
        let targetForkCreated = false
        if (target === currentBranch) {
          targetFork = this
        } else {
          targetFork = await this.fork(`temp-diff-target-${Date.now()}`)
          targetForkCreated = true
          try {
            await targetFork.checkout(target)
          } catch (err) {
            // If checkout fails, branch may not exist - just use current state
          }
        }

        try {
          // Get all entities from both branches
          const sourceResults = await sourceFork.find({})
          const targetResults = await targetFork.find({})

          // Create maps for lookup
          const sourceMap = new Map(sourceResults.map(r => [r.entity.id, r.entity]))
          const targetMap = new Map(targetResults.map(r => [r.entity.id, r.entity]))

          // Track differences
          const entitiesAdded: any[] = []
          const entitiesModified: any[] = []
          const entitiesDeleted: any[] = []

          // Find added and modified entities
          for (const [id, sourceEntity] of sourceMap.entries()) {
            const targetEntity = targetMap.get(id)

            if (!targetEntity) {
              // Entity exists in source but not target = ADDED
              entitiesAdded.push({
                id: sourceEntity.id,
                type: sourceEntity.type,
                data: sourceEntity.data
              })
            } else {
              // Entity exists in both - check for modifications
              const changes: string[] = []

              if (sourceEntity.data !== targetEntity.data) {
                changes.push('data')
              }
              if ((sourceEntity.updatedAt || 0) !== (targetEntity.updatedAt || 0)) {
                changes.push('updatedAt')
              }

              if (changes.length > 0) {
                entitiesModified.push({
                  id: sourceEntity.id,
                  type: sourceEntity.type,
                  changes
                })
              }
            }
          }

          // Find deleted entities (in target but not in source)
          for (const [id, targetEntity] of targetMap.entries()) {
            if (!sourceMap.has(id)) {
              entitiesDeleted.push({
                id: targetEntity.id,
                type: targetEntity.type
              })
            }
          }

          // Compare relationships
          const sourceVerbsResult = await sourceFork.storage.getVerbs({})
          const targetVerbsResult = await targetFork.storage.getVerbs({})

          const sourceVerbs = sourceVerbsResult.items || []
          const targetVerbs = targetVerbsResult.items || []

          const sourceRelMap = new Map(
            sourceVerbs.map((v: any) => [`${v.sourceId}-${v.verb}-${v.targetId}`, v])
          )
          const targetRelMap = new Map(
            targetVerbs.map((v: any) => [`${v.sourceId}-${v.verb}-${v.targetId}`, v])
          )

          const relationshipsAdded: any[] = []
          const relationshipsModified: any[] = []
          const relationshipsDeleted: any[] = []

          // Find added and modified relationships
          for (const [key, sourceVerb] of sourceRelMap.entries()) {
            const targetVerb = targetRelMap.get(key)

            if (!targetVerb) {
              // Relationship exists in source but not target = ADDED
              relationshipsAdded.push({
                from: sourceVerb.sourceId,
                to: sourceVerb.targetId,
                type: sourceVerb.verb
              })
            } else {
              // Relationship exists in both - check for modifications
              const changes: string[] = []

              if ((sourceVerb.weight || 0) !== (targetVerb.weight || 0)) {
                changes.push('weight')
              }
              if (JSON.stringify(sourceVerb.metadata) !== JSON.stringify(targetVerb.metadata)) {
                changes.push('metadata')
              }

              if (changes.length > 0) {
                relationshipsModified.push({
                  from: sourceVerb.sourceId,
                  to: sourceVerb.targetId,
                  type: sourceVerb.verb,
                  changes
                })
              }
            }
          }

          // Find deleted relationships
          for (const [key, targetVerb] of targetRelMap.entries()) {
            if (!sourceRelMap.has(key)) {
              relationshipsDeleted.push({
                from: targetVerb.sourceId,
                to: targetVerb.targetId,
                type: targetVerb.verb
              })
            }
          }

          return {
            entities: {
              added: entitiesAdded,
              modified: entitiesModified,
              deleted: entitiesDeleted
            },
            relationships: {
              added: relationshipsAdded,
              modified: relationshipsModified,
              deleted: relationshipsDeleted
            },
            summary: {
              entitiesAdded: entitiesAdded.length,
              entitiesModified: entitiesModified.length,
              entitiesDeleted: entitiesDeleted.length,
              relationshipsAdded: relationshipsAdded.length,
              relationshipsModified: relationshipsModified.length,
              relationshipsDeleted: relationshipsDeleted.length
            }
          }
        } finally {
          // Clean up temporary forks (only if we created them)
          try {
            const branches = await this.listBranches()
            if (sourceForkCreated && sourceFork !== this) {
              const sourceBranchName = await sourceFork.getCurrentBranch()
              if (branches.includes(sourceBranchName)) {
                await this.deleteBranch(sourceBranchName)
              }
            }
            if (targetForkCreated && targetFork !== this) {
              const targetBranchName = await targetFork.getCurrentBranch()
              if (branches.includes(targetBranchName)) {
                await this.deleteBranch(targetBranchName)
              }
            }
          } catch (err) {
            // Ignore cleanup errors
          }
        }
      }
    )
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

    return this.augmentationRegistry.execute('deleteBranch', { branch }, async () => {
      if (!('refManager' in this.storage)) {
        throw new Error('Branch management requires COW-enabled storage (v5.0.0+)')
      }

      const currentBranch = await this.getCurrentBranch()
      if (branch === currentBranch) {
        throw new Error('Cannot delete current branch')
      }

      const refManager = (this.storage as any).refManager
      await refManager.deleteRef(branch)
    })
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

    return this.augmentationRegistry.execute('getHistory', { options }, async () => {
      if (!('commitLog' in this.storage) || !('refManager' in this.storage)) {
        throw new Error('History requires COW-enabled storage (v5.0.0+)')
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
    })
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
   * Versioning API - Entity version control (v5.3.0)
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
      types: [NounType.Concept, NounType.Topic],
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
   *   // Progress tracking (v4.5.0 - STANDARDIZED FOR ALL 7 FORMATS!)
   *   onProgress: (p) => {
   *     console.log(`[${p.stage}] ${p.message}`)
   *     console.log(`Entities: ${p.entities || 0}, Rels: ${p.relationships || 0}`)
   *     if (p.throughput) console.log(`Rate: ${p.throughput.toFixed(1)}/sec`)
   *   }
   * })
   * // THIS SAME HANDLER WORKS FOR CSV, PDF, Excel, JSON, Markdown, YAML, DOCX!
   * ```
   *
   * @example Universal Progress Handler (v4.5.0)
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
   * @see {@link https://brainy.dev/docs/guides/standard-import-progress Standard Progress API (v4.5.0)}
   *
   * @remarks
   * **⚠️ Breaking Changes from v3.x:**
   *
   * The import API was redesigned in v4.0.0 for clarity and better feature control.
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
    // Execute through augmentation pipeline (v5.2.0: Enables IntelligentImportAugmentation)
    // If source is an ImportSource object (not a Buffer), spread it so augmentations can access properties
    const params = typeof source === 'object' && !Buffer.isBuffer(source)
      ? { ...source as object, ...options }  // Spread ImportSource: { type, data, filename, ...options }
      : { source, ...options }               // Wrap Buffer/string: { source, ...options }

    return this.augmentationRegistry.execute('import', params, async () => {
      // Lazy load ImportCoordinator
      const { ImportCoordinator } = await import('./import/ImportCoordinator.js')
      const coordinator = new ImportCoordinator(this)
      await coordinator.init()

      // Pass augmentation-modified params (contains _intelligentImport, _extractedData, etc)
      return await coordinator.import(source, { ...options, ...params })
    })
  }

  /**
   * Virtual File System API - Knowledge Operating System (v5.0.1+)
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
   * @since v5.0.1 - Auto-initialization during brain.init()
   */
  get vfs(): VirtualFileSystem {
    if (!this._vfs) {
      // VFS is initialized during brain.init() (v5.0.1)
      // If not initialized yet, create instance but user should call brain.init() first
      this._vfs = new VirtualFileSystem(this)
    }
    return this._vfs
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
   * Get comprehensive type-field affinity statistics
   * Useful for understanding data patterns and NLP optimization
   */
  async getTypeFieldAffinityStats(): Promise<{
    totalTypes: number
    averageFieldsPerType: number
    typeBreakdown: Record<string, {
      totalEntities: number
      uniqueFields: number
      topFields: Array<{field: string; affinity: number}>
    }>
  }> {
    await this.ensureInitialized()
    return this.metadataIndex.getTypeFieldAffinityStats()
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
   * CRITICAL FIX (v3.43.2): Ensures data survives server restarts
   *
   * Flushes all 4 core indexes:
   * 1. Storage counts (entity/verb counts by type)
   * 2. Metadata index (field indexes + EntityIdMapper)
   * 3. Graph adjacency index (relationship cache)
   * 4. HNSW vector index (no flush needed - saves directly)
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

    console.log('🔄 Flushing Brainy indexes and caches to disk...')

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

      // 3. Flush graph adjacency index (relationship cache)
      // Note: Graph structure is already persisted via storage.saveVerb() calls
      // This just flushes the in-memory cache for performance
      this.graphIndex.flush()
    ])

    const elapsed = Date.now() - startTime

    console.log(`✅ All indexes flushed to disk in ${elapsed}ms`)
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
      byType: (type?: string) => {
        if (type) {
          return this.metadataIndex.getEntityCountByType(type)
        }
        return Object.fromEntries(this.metadataIndex.getAllEntityCounts())
      },

      // Phase 1b: O(1) count by type enum (Uint32Array-based, more efficient)
      // Uses fixed-size type tracking: 284 bytes vs ~35KB with Maps (99.2% reduction)
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
      getStats: () => {
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
   * Augmentations API - Clean and simple
   */
  get augmentations() {
    return {
      list: () => this.augmentationRegistry.getAll().map(a => a.name),
      get: (name: string) => this.augmentationRegistry.getAll().find(a => a.name === name),
      has: (name: string) => this.augmentationRegistry.getAll().some(a => a.name === name)
    }
  }

  /**
   * Get complete statistics - convenience method
   * For more granular counting, use brain.counts API
   * @returns Complete statistics including entities, relationships, and density
   */
  getStats() {
    return this.counts.getStats()
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
   */
  private async executeVectorSearch(params: FindParams<T>): Promise<Result<T>[]> {
    const vector = params.vector || (await this.embed(params.query!))
    const limit = params.limit || 10

    // Phase 2: Pass type for TypeAwareHNSWIndex (10x faster for type-specific queries)
    const searchResults = this.index instanceof TypeAwareHNSWIndex
      ? await this.index.search(vector, limit * 2, params.type as any)
      : await this.index.search(vector, limit * 2)
    const results: Result<T>[] = []
    
    for (const [id, distance] of searchResults) {
      const entity = await this.get(id)
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

    // Phase 2: Pass type for TypeAwareHNSWIndex
    const nearResults = this.index instanceof TypeAwareHNSWIndex
      ? await this.index.search(nearEntity.vector, params.limit || 10, params.type as any)
      : await this.index.search(nearEntity.vector, params.limit || 10)
    
    const results: Result<T>[] = []
    for (const [id, distance] of nearResults) {
      const score = Math.max(0, Math.min(1, 1 / (1 + distance)))

      if (score >= (params.near.threshold || 0.7)) {
        const entity = await this.get(id)
        if (entity) {
          results.push(this.createResult(id, score, entity))
        }
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
    
    // Create results from connected entities
    const results: Result<T>[] = []
    for (const id of connectedIds) {
      const entity = await this.get(id)
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
   * Convert verbs to relations (v4.8.0 - read from top-level)
   */
  private verbsToRelations(verbs: GraphVerb[]): Relation<T>[] {
    return verbs.map((v) => ({
      id: v.id,
      from: v.sourceId,
      to: v.targetId,
      type: (v.verb || v.type) as VerbType,
      weight: v.weight ?? 1.0, // v4.8.0: weight is at top-level
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
    // Pass the entire storage config object to createStorage
    // This ensures all storage-specific configs (gcsNativeStorage, s3Storage, etc.) are passed through
    const storage = await createStorage(this.config.storage as any)
    return storage as BaseStorage
  }

  /**
   * Setup index
   *
   * Phase 2: Uses TypeAwareHNSWIndex for billion-scale optimization
   * - 87% memory reduction through separate graphs per entity type
   * - 10x faster type-specific queries
   * - Automatic type routing
   */
  private setupIndex(): HNSWIndex | HNSWIndexOptimized | TypeAwareHNSWIndex {
    const indexConfig = {
      ...this.config.index,
      distanceFunction: this.distance
    }

    // Phase 2: Use TypeAwareHNSWIndex for billion-scale optimization
    if (this.config.storage?.type !== 'memory') {
      return new TypeAwareHNSWIndex(indexConfig, this.distance, {
        storage: this.storage,
        useParallelization: true
      })
    }

    return new HNSWIndex(indexConfig as any)
  }

  /**
   * Setup augmentations
   */
  private setupAugmentations(): AugmentationRegistry {
    const registry = new AugmentationRegistry()

    // Register default augmentations with silent mode support
    const augmentationConfig = {
      ...this.config.augmentations,
      // Pass silent mode to all augmentations
      ...(this.config.silent && {
        cache: this.config.augmentations?.cache !== false ? { ...this.config.augmentations?.cache, silent: true } : false,
        metrics: this.config.augmentations?.metrics !== false ? { ...this.config.augmentations?.metrics, silent: true } : false,
        display: this.config.augmentations?.display !== false ? { ...this.config.augmentations?.display, silent: true } : false,
        monitoring: this.config.augmentations?.monitoring !== false ? { ...this.config.augmentations?.monitoring, silent: true } : false
      })
    }

    const defaults = createDefaultAugmentations(augmentationConfig)
    for (const aug of defaults) {
      registry.register(aug)
    }

    return registry
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

    // Validate model configuration
    if (config?.model?.type && !['fast', 'accurate', 'custom'].includes(config.model.type)) {
      throw new Error(`Invalid model type: ${config.model.type}. Must be one of: fast, accurate, custom`)
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
      model: config?.model || { type: 'fast' },
      index: config?.index || {},
      cache: config?.cache ?? true,
      augmentations: config?.augmentations || {},
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
      maxConcurrentOperations: config?.maxConcurrentOperations ?? 10
    }
  }

  /**
   * Rebuild indexes if there's existing data but empty indexes
   */
  /**
   * Rebuild indexes from persisted data if needed (v3.35.0+)
   *
   * FIXES FOR CRITICAL BUGS:
   * - Bug #1: GraphAdjacencyIndex rebuild never called ✅ FIXED
   * - Bug #2: Early return blocks recovery when count=0 ✅ FIXED
   * - Bug #4: HNSW index has no rebuild mechanism ✅ FIXED
   *
   * Production-grade rebuild with:
   * - Handles millions of entities via pagination
   * - Smart threshold-based decisions (auto-rebuild < 1000 items)
   * - Progress reporting for large datasets
   * - Parallel index rebuilds for performance
   * - Robust error recovery (continues on partial failures)
   */
  private async rebuildIndexesIfNeeded(): Promise<void> {
    try {
      // Check if auto-rebuild is explicitly disabled
      if (this.config.disableAutoRebuild === true) {
        if (!this.config.silent) {
          console.log('⚡ Auto-rebuild explicitly disabled via config')
        }
        return
      }

      // OPTIMIZATION: Instant check - if index already has data, skip immediately
      // This gives 0s startup for warm restarts (vs 50-100ms of async checks)
      if (this.index.size() > 0) {
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
        return
      }

      // Intelligent decision: Auto-rebuild only for small datasets
      // For large datasets, use lazy loading for optimal performance
      const AUTO_REBUILD_THRESHOLD = 1000 // Only auto-rebuild if < 1000 items

      // Check if indexes need rebuilding
      const metadataStats = await this.metadataIndex.getStats()
      const hnswIndexSize = this.index.size()
      const graphIndexSize = await this.graphIndex.size()

      const needsRebuild =
        metadataStats.totalEntries === 0 ||
        hnswIndexSize === 0 ||
        graphIndexSize === 0

      if (!needsRebuild) {
        // All indexes already populated, no rebuild needed
        return
      }

      // BUG FIX: If disableAutoRebuild is truthy, skip rebuild even if indexes are empty
      // Indexes will load lazily on first query
      if (this.config.disableAutoRebuild) {
        if (!this.config.silent) {
          console.log('⚡ Indexes empty but auto-rebuild disabled - using lazy loading')
        }
        return
      }

      // Small dataset: Rebuild all indexes for best performance
      if (totalCount < AUTO_REBUILD_THRESHOLD || this.config.disableAutoRebuild === false) {
        if (!this.config.silent) {
          console.log(
            this.config.disableAutoRebuild === false
              ? '🔄 Auto-rebuild explicitly enabled - rebuilding all indexes from persisted data...'
              : `🔄 Small dataset (${totalCount} items) - rebuilding all indexes from persisted data...`
          )
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
      } else {
        // Large dataset: Use lazy loading for fast startup
        if (!this.config.silent) {
          console.log(`⚡ Large dataset (${totalCount} items) - using lazy loading for optimal startup`)
          console.log('💡 Indexes will build automatically as you query the system')
        }
      }

    } catch (error) {
      console.warn('Warning: Could not rebuild indexes:', error)
      // Don't throw - allow system to start even if rebuild fails
    }
  }

  /**
   * Close and cleanup
   */
  async close(): Promise<void> {
    // Shutdown augmentations
    const augs = this.augmentationRegistry.getAll()
    for (const aug of augs) {
      if ('shutdown' in aug && typeof aug.shutdown === 'function') {
        await aug.shutdown()
      }
    }

    // Restore console methods if silent mode was enabled
    if (this.config.silent && this.originalConsole) {
      console.log = this.originalConsole.log as typeof console.log
      console.info = this.originalConsole.info as typeof console.info
      console.warn = this.originalConsole.warn as typeof console.warn
      console.error = this.originalConsole.error as typeof console.error
      this.originalConsole = undefined
    }

    // Storage doesn't have close in current interface
    // We'll just mark as not initialized
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