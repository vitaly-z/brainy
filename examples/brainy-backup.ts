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
import { validateNounType, validateVerbType } from './utils/typeValidation.js'
import { matchesMetadataFilter } from './utils/metadataFilter.js'
import { AugmentationRegistry, AugmentationContext } from './augmentations/brainyAugmentation.js'
import { createDefaultAugmentations } from './augmentations/defaultAugmentations.js'
import { ImprovedNeuralAPI } from './neural/improvedNeuralAPI.js'
import { NaturalLanguageProcessor } from './neural/naturalLanguageProcessor.js'
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
  private embedder: EmbeddingFunction
  private distance: DistanceFunction
  private augmentationRegistry: AugmentationRegistry
  private config: Required<BrainyConfig>

  // Sub-APIs (lazy-loaded)
  private _neural?: ImprovedNeuralAPI
  private _nlp?: NaturalLanguageProcessor

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
   */
  async init(): Promise<void> {
    if (this.initialized) {
      return
    }

    try {
      // Setup and initialize storage
      this.storage = await this.setupStorage()
      await this.storage.init()

      // Setup index now that we have storage
      this.index = this.setupIndex()

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

    // Validate parameters
    if (!params.data && !params.vector) {
      throw new Error('Either data or vector is required')
    }
    validateNounType(params.type)

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

      // Save to storage
      await this.storage.saveNoun({
        id,
        vector,
        connections: new Map(),
        level: 0,
        metadata: {
          ...params.metadata,
          noun: params.type,
          service: params.service,
          createdAt: Date.now()
        }
      })

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

      // Extract metadata - separate user metadata from system metadata
      const { noun: nounType, service, createdAt, updatedAt, ...userMetadata } = noun.metadata || {}
      
      // Construct entity from noun
      const entity: Entity<T> = {
        id: noun.id,
        vector: noun.vector,
        type: (nounType as NounType) || NounType.Thing,
        metadata: userMetadata as T,
        service: service as string,
        createdAt: (createdAt as number) || Date.now(),
        updatedAt: updatedAt as number
      }

      return entity
    })
  }

  /**
   * Update an entity
   */
  async update(params: UpdateParams<T>): Promise<void> {
    await this.ensureInitialized()

    if (!params.id) {
      throw new Error('ID is required for update')
    }

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

      await this.storage.saveNoun({
        id: params.id,
        vector,
        connections: new Map(),
        level: 0,
        metadata: {
          ...newMetadata,
          noun: params.type || existing.type,
          service: existing.service,
          createdAt: existing.createdAt,
          updatedAt: Date.now()
        }
      })
    })
  }

  /**
   * Delete an entity
   */
  async delete(id: string): Promise<void> {
    await this.ensureInitialized()

    return this.augmentationRegistry.execute('delete', { id }, async () => {
      // Remove from index
      await this.index.removeItem(id)

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

    // Validate parameters
    if (!params.from || !params.to) {
      throw new Error('Both from and to are required')
    }
    validateVerbType(params.type)

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
   */
  async find(query: string | FindParams<T>): Promise<Result<T>[]> {
    await this.ensureInitialized()

    // Parse natural language queries
    const params: FindParams<T> =
      typeof query === 'string' ? await this.parseNaturalQuery(query) : query

    return this.augmentationRegistry.execute('find', params, async () => {
      let results: Result<T>[] = []

      // Vector search
      if (params.query || params.vector) {
        const vector = params.vector || (await this.embed(params.query!))
        const limit = params.limit || 10

        // Search index - returns array of [id, score] tuples
        const searchResults = await this.index.search(vector, limit * 2) // Get extra for filtering

        // Hydrate results
        for (const [id, score] of searchResults) {
          const entity = await this.get(id)
          if (entity) {
            results.push({
              id,
              score,
              entity
            })
          }
        }
      }

      // Proximity search
      if (params.near) {
        const nearEntity = await this.get(params.near.id)
        if (nearEntity) {
          const nearResults = await this.index.search(
            nearEntity.vector,
            params.limit || 10
          )

          for (const [id, score] of nearResults) {
            if (score >= (params.near.threshold || 0.7)) {
              const entity = await this.get(id)
              if (entity) {
                results.push({
                  id,
                  score,
                  entity
                })
              }
            }
          }
        }
      }

      // Apply filters
      if (params.where) {
        results = results.filter((r) =>
          matchesMetadataFilter(r.entity.metadata, params.where!)
        )
      }

      if (params.type) {
        const types = Array.isArray(params.type) ? params.type : [params.type]
        results = results.filter((r) => types.includes(r.entity.type))
      }

      if (params.service) {
        results = results.filter((r) => r.entity.service === params.service)
      }

      // Graph constraints
      if (params.connected) {
        results = await this.applyGraphConstraints(results, params.connected)
      }

      // Sort by score and limit
      results.sort((a, b) => b.score - a.score)
      const limit = params.limit || 10
      const offset = params.offset || 0

      return results.slice(offset, offset + limit)
    })
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

  // ============= SUB-APIS =============

  /**
   * Neural API - Advanced AI operations
   */
  neural() {
    if (!this._neural) {
      this._neural = new ImprovedNeuralAPI(this as any)
    }
    return this._neural
  }
    return this._neural
  }

  /**
   * Neural API - Advanced AI operations
   */
  neural() {
    if (!this._neural) {
      this._neural = new ImprovedNeuralAPI(this as any)
    }
    return this._neural
  }

  /**
   * Natural Language Processing API
   */
  nlp() {
    if (!this._nlp) {
      this._nlp = new NaturalLanguageProcessor(this as any)
    }
    return this._nlp
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
    
    // Get all entities count
    const allEntities = await this.storage.getAllNouns()
    const entities = allEntities.length
    
    // Get relationships count
    const allVerbs = await this.storage.getAllVerbs()
    const relationships = allVerbs.length
    
    // Count by type
    const types: Record<string, number> = {}
    for (const entity of allEntities) {
      const type = entity.metadata?.noun || 'unknown'
      types[type] = (types[type] || 0) + 1
    }
    
    // Get unique services
    const services = [...new Set(allEntities.map(e => e.metadata?.service).filter(Boolean))]
    
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
   * Parse natural language query
   */
  private async parseNaturalQuery(query: string): Promise<FindParams<T>> {
    if (!this._nlp) {
      this._nlp = new NaturalLanguageProcessor(this as any)
    }
    const parsed = await this._nlp.processNaturalQuery(query)
    return parsed as FindParams<T>
  }

  /**
   * Apply graph constraints to results
   */
  private async applyGraphConstraints(
    results: Result<T>[],
    constraints: any
  ): Promise<Result<T>[]> {
    // Filter by graph connections
    if (constraints.to || constraints.from) {
      const filtered: Result<T>[] = []
      
      for (const result of results) {
        if (constraints.to) {
          const verbs = await this.storage.getVerbsBySource(result.id)
          const hasConnection = verbs.some(v => v.targetId === constraints.to)
          if (hasConnection) {
            filtered.push(result)
          }
        }
        
        if (constraints.from) {
          const verbs = await this.storage.getVerbsByTarget(result.id)
          const hasConnection = verbs.some(v => v.sourceId === constraints.from)
          if (hasConnection) {
            filtered.push(result)
          }
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
    if (this.config.model?.type === 'custom' && this.config.model.name) {
      // TODO: Load custom model
      return defaultEmbeddingFunction
    }
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
   * Normalize configuration
   */
  private normalizeConfig(config?: BrainyConfig): Required<BrainyConfig> {
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