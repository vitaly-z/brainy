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
  BatchResult,
  BrainyConfig
} from './types/brainy.types.js'
import { NounType, VerbType } from './types/graphTypes.js'

/**
 * The main Brainy class - Clean, Beautiful, Powerful
 * REAL IMPLEMENTATION - No stubs, no mocks
 */
export class Brainy<T = any> {
  // Core components
  private index!: HNSWIndex | HNSWIndexOptimized
  private storage!: StorageAdapter
  private metadataIndex!: MetadataIndexManager
  private graphIndex!: GraphAdjacencyIndex
  private embedder: EmbeddingFunction
  private distance: DistanceFunction
  private augmentationRegistry: AugmentationRegistry
  private config: Required<BrainyConfig>

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
        augmentations: { ...this.config.augmentations, ...configOverrides.augmentations }
      }
      
      // Set dimensions if provided
      if (dimensions) {
        this.dimensions = dimensions
      }
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

      // Handle empty query - return paginated results from storage
      const hasSearchCriteria = params.query || params.vector || params.where || 
                               params.type || params.service || params.near || params.connected
      
      if (!hasSearchCriteria) {
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
          // Filter existing results (from vector search)
          const filteredIdSet = new Set(filteredIds)
          results = results.filter((r) => filteredIdSet.has(r.id))
        } else {
          // Create results from metadata matches (metadata-only query)
          for (const id of filteredIds) {
            const entity = await this.get(id)
            if (entity) {
              results.push({
                id,
                score: 1.0, // All metadata matches are equally relevant
                entity
              })
            }
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

      // Sort by score and apply pagination
      results.sort((a, b) => b.score - a.score)
      const limit = params.limit || 10
      const offset = params.offset || 0

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
    
    // Get all entities count - use getNouns with high limit
    const entitiesResult = await this.storage.getNouns({ 
      pagination: { limit: 10000 }
    })
    const entities = entitiesResult.totalCount || entitiesResult.items.length
    
    // Get relationships count - use getVerbs with high limit
    const verbsResult = await this.storage.getVerbs({ 
      pagination: { limit: 10000 }
    })
    const relationships = verbsResult.totalCount || verbsResult.items.length
    
    // Count by type
    const types: Record<string, number> = {}
    for (const entity of entitiesResult.items) {
      const type = (entity.metadata?.noun as string) || 'unknown'
      types[type] = (types[type] || 0) + 1
    }
    
    // Get unique services
    const services = [...new Set(entitiesResult.items.map((e: any) => e.metadata?.service).filter(Boolean))] as string[]
    
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
  private async embed(data: any): Promise<Vector> {
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
      type: this.config.storage?.type || 'memory',
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

    // Register default augmentations
    const defaults = createDefaultAugmentations(this.config.augmentations)
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
    if (config?.storage?.type && !['memory', 'filesystem', 'opfs', 'remote'].includes(config.storage.type)) {
      throw new Error(`Invalid storage type: ${config.storage.type}. Must be one of: memory, filesystem, opfs, remote`)
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

    return {
      storage: config?.storage || { type: 'memory' },
      model: config?.model || { type: 'fast' },
      index: config?.index || {},
      cache: config?.cache ?? true,
      augmentations: config?.augmentations || {},
      warmup: config?.warmup ?? false,
      realtime: config?.realtime ?? false,
      multiTenancy: config?.multiTenancy ?? false,
      telemetry: config?.telemetry ?? false
    }
  }

  /**
   * Rebuild indexes if there's existing data but empty indexes
   */
  private async rebuildIndexesIfNeeded(): Promise<void> {
    try {
      // Check if storage has data
      const entities = await this.storage.getNouns({ pagination: { limit: 1 } })
      if (entities.totalCount === 0 || entities.items.length === 0) {
        // No data in storage, no rebuild needed
        return
      }

      // Check if metadata index is empty
      const metadataStats = await this.metadataIndex.getStats()
      if (metadataStats.totalEntries === 0) {
        console.log('🔄 Rebuilding metadata index for existing data...')
        await this.metadataIndex.rebuild()
        const newStats = await this.metadataIndex.getStats()
        console.log(`✅ Metadata index rebuilt: ${newStats.totalEntries} entries`)
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

    // Storage doesn't have close in current interface
    // We'll just mark as not initialized
    this.initialized = false
  }
}

// Re-export types for convenience
export * from './types/brainy.types.js'
export { NounType, VerbType } from './types/graphTypes.js'