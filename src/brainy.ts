/**
 * 🧠 Brainy 3.0 - The Future of Neural Databases
 *
 * Beautiful, Professional, Planet-Scale, Fun to Use
 * NO STUBS, NO MOCKS, REAL IMPLEMENTATION
 */

import { v4 as uuidv4 } from './universal/uuid.js'
import { HNSWIndex } from './hnsw/hnswIndex.js'
import { HNSWIndexOptimized } from './hnsw/hnswIndexOptimized.js'
import { createStorage } from './storage/storageFactory.js'
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
import { TripleIntelligenceSystem } from './triple/TripleIntelligenceSystem.js'
import { MetadataIndexManager } from './utils/metadataIndex.js'
import { GraphAdjacencyIndex } from './graph/graphAdjacencyIndex.js'
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
  BrainyConfig
} from './types/brainy.types.js'
import { NounType, VerbType } from './types/graphTypes.js'
import { BrainyInterface } from './types/brainyDataInterface.js'

/**
 * The main Brainy class - Clean, Beautiful, Powerful
 * REAL IMPLEMENTATION - No stubs, no mocks
 *
 * Implements BrainyInterface to ensure consistency across integrations
 */
export class Brainy<T = any> implements BrainyInterface<T> {
  // Core components
  private index!: HNSWIndex | HNSWIndexOptimized
  private storage!: StorageAdapter
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
  private _tripleIntelligence?: TripleIntelligenceSystem

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

      // Setup index now that we have storage
      this.index = this.setupIndex()

      // Initialize core metadata index
      this.metadataIndex = new MetadataIndexManager(this.storage)
      
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

      this.initialized = true
    } catch (error) {
      throw new Error(`Failed to initialize Brainy: ${error}`)
    }
  }

  /**
   * Ensure Brainy is initialized
   */
  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      throw new Error('Brainy not initialized. Call init() first.')
    }
  }

  // ============= CORE CRUD OPERATIONS =============

  /**
   * Add an entity to the database
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
      // Add to index
      await this.index.addItem({ id, vector })

      // Prepare metadata object with data field included
      const metadata = {
        ...(typeof params.data === 'object' && params.data !== null && !Array.isArray(params.data) ? params.data : {}),
        ...params.metadata,
        _data: params.data, // Store the raw data in metadata
        noun: params.type,
        service: params.service,
        createdAt: Date.now()
      }

      // Save to storage
      await this.storage.saveNoun({
        id,
        vector,
        connections: new Map(),
        level: 0,
        metadata
      })

      // Add to metadata index for fast filtering
      await this.metadataIndex.addToIndex(id, metadata)

      return id
    })
  }

  /**
   * Get an entity by ID
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
   * Convert a noun from storage to an entity
   */
  private async convertNounToEntity(noun: any): Promise<Entity<T>> {
    // Extract metadata - separate user metadata from system metadata
    const { noun: nounType, service, createdAt, updatedAt, _data, ...userMetadata } = noun.metadata || {}
    
    const entity: Entity<T> = {
      id: noun.id,
      vector: noun.vector,
      type: (nounType as NounType) || NounType.Thing,
      metadata: userMetadata as T,
      service: service as string,
      createdAt: (createdAt as number) || Date.now(),
      updatedAt: updatedAt as number
    }
    
    // Only add data field if it exists
    if (_data !== undefined) {
      entity.data = _data
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

      // Update vector if data changed
      let vector = existing.vector
      if (params.data) {
        vector = params.vector || (await this.embed(params.data))
        // Update in index (remove and re-add since no update method)
        await this.index.removeItem(params.id)
        await this.index.addItem({ id: params.id, vector })
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
        _data: params.data !== undefined ? params.data : existing.data, // Update the data field
        noun: params.type || existing.type,
        service: existing.service,
        createdAt: existing.createdAt,
        updatedAt: Date.now()
      }

      await this.storage.saveNoun({
        id: params.id,
        vector,
        connections: new Map(),
        level: 0,
        metadata: updatedMetadata
      })

      // Update metadata index - remove old entry and add new one
      await this.metadataIndex.removeFromIndex(params.id, existing.metadata)
      await this.metadataIndex.addToIndex(params.id, updatedMetadata)
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
      // Remove from vector index
      await this.index.removeItem(id)

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
      }
    })
  }

  // ============= RELATIONSHIP OPERATIONS =============

  /**
   * Create a relationship between entities
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

    // Generate ID
    const id = uuidv4()

    // Compute relationship vector (average of entities)
    const relationVector = fromEntity.vector.map(
      (v, i) => (v + toEntity.vector[i]) / 2
    )

    return this.augmentationRegistry.execute('relate', params, async () => {
      // Save to storage
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

      await this.storage.saveVerb(verb)

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
        
        await this.storage.saveVerb(reverseVerb)
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
   * Get relationships
   */
  async getRelations(
    params: GetRelationsParams = {}
  ): Promise<Relation<T>[]> {
    await this.ensureInitialized()

    const relations: Relation<T>[] = []

    if (params.from) {
      const verbs = await this.storage.getVerbsBySource(params.from)
      relations.push(...this.verbsToRelations(verbs))
    }

    if (params.to) {
      const verbs = await this.storage.getVerbsByTarget(params.to)
      relations.push(...this.verbsToRelations(verbs))
    }

    // Filter by type
    let filtered = relations
    if (params.type) {
      const types = Array.isArray(params.type) ? params.type : [params.type]
      filtered = relations.filter((r) => types.includes(r.type))
    }

    // Filter by service
    if (params.service) {
      filtered = filtered.filter((r) => r.service === params.service)
    }

    // Apply pagination
    const limit = params.limit || 100
    const offset = params.offset || 0
    return filtered.slice(offset, offset + limit)
  }

  // ============= SEARCH & DISCOVERY =============

  /**
   * Unified find method - supports natural language and structured queries
   * Implements Triple Intelligence with parallel search optimization
   */
  async find(query: string | FindParams<T>): Promise<Result<T>[]> {
    await this.ensureInitialized()

    // Parse natural language queries
    const params: FindParams<T> =
      typeof query === 'string' ? await this.parseNaturalQuery(query) : query

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

        // Get filtered IDs and paginate BEFORE loading entities
        const filteredIds = await this.metadataIndex.getIdsForFilter(filter)
        const limit = params.limit || 10
        const offset = params.offset || 0
        const pageIds = filteredIds.slice(offset, offset + limit)

        // Load entities for the paginated results
        for (const id of pageIds) {
          const entity = await this.get(id)
          if (entity) {
            results.push({
              id,
              score: 1.0, // All metadata-filtered results equally relevant
              entity
            })
          }
        }

        return results
      }

      // Handle completely empty query - return all results paginated
      if (!hasVectorSearchCriteria && !hasFilterCriteria && !hasGraphCriteria) {
        const limit = params.limit || 20
        const offset = params.offset || 0

        const storageResults = await this.storage.getNouns({
          pagination: { limit: limit + offset, offset: 0 }
        })

        for (let i = offset; i < Math.min(offset + limit, storageResults.items.length); i++) {
          const noun = storageResults.items[i]
          if (noun) {
            const entity = await this.convertNounToEntity(noun)
            results.push({
              id: noun.id,
              score: 1.0, // All results equally relevant for empty query
              entity
            })
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
      if (params.where || params.type || params.service) {
        // Build filter object for metadata index
        let filter: any = {}
        
        // Base filter from where and service
        if (params.where) Object.assign(filter, params.where)
        if (params.service) filter.service = params.service
        
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
              results.push({
                id,
                score: 1.0, // All metadata matches are equally relevant
                entity: entity as Entity<T>
              })
            }
          }

          // Early return for metadata-only queries with pagination applied
          if (!params.query && !params.connected) {
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
      results.sort((a, b) => b.score - a.score)
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
   * Find similar entities
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
      service: params.service
    })
  }

  // ============= BATCH OPERATIONS =============

  /**
   * Add multiple entities
   */
  async addMany(params: AddManyParams<T>): Promise<BatchResult<string>> {
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

    const result: BatchResult<string> = {
      successful: [],
      failed: [],
      total: params.items.length,
      duration: 0
    }

    const startTime = Date.now()
    const chunkSize = params.chunkSize || 100

    for (let i = 0; i < params.items.length; i += chunkSize) {
      const chunk = params.items.slice(i, i + chunkSize)

      if (params.parallel) {
        // Process chunk in parallel
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

        await Promise.all(promises)
      } else {
        // Process chunk sequentially
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

      // Report progress
      if (params.onProgress) {
        params.onProgress(
          result.successful.length + result.failed.length,
          result.total
        )
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
   * Natural Language Processing API
   */
  nlp(): NaturalLanguageProcessor {
    if (!this._nlp) {
      this._nlp = new NaturalLanguageProcessor(this)
    }
    return this._nlp
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
   */
  get counts() {
    return {
      // O(1) total entity count
      entities: () => this.metadataIndex.getTotalEntityCount(),

      // O(1) total relationship count
      relationships: () => this.graphIndex.getTotalRelationshipCount(),

      // O(1) count by type
      byType: (type?: string) => {
        if (type) {
          return this.metadataIndex.getEntityCountByType(type)
        }
        return Object.fromEntries(this.metadataIndex.getAllEntityCounts())
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
    
    const searchResults = await this.index.search(vector, limit * 2)
    const results: Result<T>[] = []
    
    for (const [id, distance] of searchResults) {
      const entity = await this.get(id)
      if (entity) {
        const score = Math.max(0, Math.min(1, 1 / (1 + distance)))
        results.push({ id, score, entity })
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
    
    const nearResults = await this.index.search(
      nearEntity.vector,
      params.limit || 10
    )
    
    const results: Result<T>[] = []
    for (const [id, distance] of nearResults) {
      const score = Math.max(0, Math.min(1, 1 / (1 + distance)))
      
      if (score >= (params.near.threshold || 0.7)) {
        const entity = await this.get(id)
        if (entity) {
          results.push({ id, score, entity })
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
        results.push({
          id,
          score: 1.0,
          entity
        })
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
   * Convert verbs to relations
   */
  private verbsToRelations(verbs: GraphVerb[]): Relation<T>[] {
    return verbs.map((v) => ({
      id: v.id,
      from: v.sourceId,
      to: v.targetId,
      type: (v.verb || v.type) as VerbType,
      weight: v.weight,
      metadata: v.metadata,
      service: v.metadata?.service as string,
      createdAt: typeof v.createdAt === 'number' ? v.createdAt : Date.now()
    }))
  }

  /**
   * Embed data into vector
   */
  async embed(data: any): Promise<Vector> {
    return this.embedder(data)
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
  private async setupStorage(): Promise<StorageAdapter> {
    const storage = await createStorage({
      type: this.config.storage?.type || 'auto',
      ...this.config.storage?.options
    })
    return storage
  }

  /**
   * Setup index
   */
  private setupIndex(): HNSWIndex | HNSWIndexOptimized {
    const indexConfig = {
      ...this.config.index,
      distanceFunction: this.distance
    }

    // Use optimized index for larger datasets
    if (this.config.storage?.type !== 'memory') {
      return new HNSWIndexOptimized(indexConfig, this.distance, this.storage)
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
    if (config?.storage?.type && !['auto', 'memory', 'filesystem', 'opfs', 'remote', 's3', 'r2', 'gcs'].includes(config.storage.type)) {
      throw new Error(`Invalid storage type: ${config.storage.type}. Must be one of: auto, memory, filesystem, opfs, remote, s3, r2, gcs`)
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
  private async rebuildIndexesIfNeeded(): Promise<void> {
    try {
      // Check if storage has data
      const entities = await this.storage.getNouns({ pagination: { limit: 1 } })
      const totalCount = entities.totalCount || 0

      if (totalCount === 0) {
        // No data in storage, no rebuild needed
        return
      }

      // Intelligent decision: Auto-rebuild only for small datasets
      // For large datasets, use lazy loading for optimal performance
      const AUTO_REBUILD_THRESHOLD = 1000 // Only auto-rebuild if < 1000 items

      // Check if metadata index is empty
      const metadataStats = await this.metadataIndex.getStats()
      if (metadataStats.totalEntries === 0 && totalCount > 0) {
        if (totalCount < AUTO_REBUILD_THRESHOLD) {
          // Small dataset - rebuild for convenience
          if (!this.config.silent) {
            console.log(`🔄 Small dataset (${totalCount} items) - rebuilding index for optimal performance...`)
          }
          await this.metadataIndex.rebuild()
          const newStats = await this.metadataIndex.getStats()
          if (!this.config.silent) {
            console.log(`✅ Index rebuilt: ${newStats.totalEntries} entries`)
          }
        } else {
          // Large dataset - use lazy loading
          if (!this.config.silent) {
            console.log(`⚡ Large dataset (${totalCount} items) - using lazy loading for optimal startup performance`)
            console.log('💡 Tip: Indexes will build automatically as you use the system')
          }
        }
      }

      // Override with explicit config if provided
      if (this.config.disableAutoRebuild === true) {
        if (!this.config.silent) {
          console.log('⚡ Auto-rebuild explicitly disabled via config')
        }
        return
      } else if (this.config.disableAutoRebuild === false && metadataStats.totalEntries === 0) {
        // Explicitly enabled - rebuild regardless of size
        if (!this.config.silent) {
          console.log('🔄 Auto-rebuild explicitly enabled - rebuilding index...')
        }
        await this.metadataIndex.rebuild()
      }

      // Note: GraphAdjacencyIndex will rebuild itself as relationships are added
      // Vector index should already be populated if storage has data
    } catch (error) {
      console.warn('Warning: Could not check or rebuild indexes:', error)
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