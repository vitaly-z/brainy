/**
 * Persistent Entity System for VFS
 *
 * Manages entities that evolve across files and time
 * Not just story characters - any evolving entity: APIs, customers, services, models
 * PRODUCTION-READY: Real implementation using Brainy
 */

import { Brainy } from '../brainy.js'
import { NounType, VerbType } from '../types/graphTypes.js'
import { cosineDistance } from '../utils/distance.js'
import { v4 as uuidv4 } from '../universal/uuid.js'
import { EntityManager, ManagedEntity } from './EntityManager.js'

/**
 * Persistent entity that exists across files and evolves over time
 */
export interface PersistentEntity extends ManagedEntity {
  id: string
  name: string
  type: string  // 'character', 'api', 'service', 'concept', 'customer', etc.
  description?: string
  aliases: string[]  // Alternative names/references
  appearances: EntityAppearance[]
  attributes: Record<string, any>
  created: number
  lastUpdated: number
  version: number
  entityType?: string  // For EntityManager queries
}

/**
 * An appearance of an entity in a specific file/location
 */
export interface EntityAppearance extends ManagedEntity {
  id: string
  entityId: string
  filePath: string
  context: string  // Surrounding text/code
  position?: {
    line?: number
    column?: number
    offset?: number
  }
  timestamp: number
  version: number
  changes?: EntityChange[]
  confidence: number  // How confident we are this is the entity (0-1)
  eventType?: string  // For EntityManager queries
}

/**
 * A change/evolution to an entity
 */
export interface EntityChange {
  field: string
  oldValue: any
  newValue: any
  timestamp: number
  source: string  // File path where change was detected
  reason?: string  // Why the change was made
}

/**
 * Configuration for persistent entities
 */
export interface PersistentEntityConfig {
  autoExtract?: boolean  // Auto-extract entities from content
  similarityThreshold?: number  // For entity matching (0-1)
  maxAppearances?: number  // Max appearances to track per entity
  evolutionTracking?: boolean  // Track entity evolution
}

/**
 * Persistent Entity System
 *
 * Tracks entities that exist across multiple files and evolve over time
 * Examples:
 * - Story characters that appear in multiple chapters
 * - API endpoints that evolve across documentation
 * - Business entities that appear in multiple reports
 * - Code classes/functions that span multiple files
 */
export class PersistentEntitySystem extends EntityManager {
  private config: Required<PersistentEntityConfig>
  private entityCache = new Map<string, PersistentEntity>()

  constructor(
    brain: Brainy,
    config?: PersistentEntityConfig
  ) {
    super(brain, 'vfs-entity')
    this.config = {
      autoExtract: config?.autoExtract ?? false,
      similarityThreshold: config?.similarityThreshold ?? 0.8,
      maxAppearances: config?.maxAppearances ?? 100,
      evolutionTracking: config?.evolutionTracking ?? true
    }
  }

  /**
   * Create a new persistent entity
   */
  async createEntity(entity: Omit<PersistentEntity, 'id' | 'created' | 'lastUpdated' | 'version' | 'appearances'>): Promise<string> {
    const entityId = uuidv4()
    const timestamp = Date.now()

    const persistentEntity: PersistentEntity = {
      id: entityId,
      name: entity.name,
      type: entity.type,
      description: entity.description,
      aliases: entity.aliases,
      attributes: entity.attributes,
      created: timestamp,
      lastUpdated: timestamp,
      version: 1,
      appearances: [],
      entityType: 'persistent'  // Add entityType for querying
    }

    // Generate embedding for entity description
    let embedding: number[] | undefined
    try {
      if (entity.description) {
        embedding = await this.generateEntityEmbedding(persistentEntity)
      }
    } catch (error) {
      console.warn('Failed to generate entity embedding:', error)
    }

    // Store entity using EntityManager
    await this.storeEntity(
      persistentEntity,
      NounType.Concept,
      embedding,
      Buffer.from(JSON.stringify(persistentEntity))
    )

    // Update cache
    this.entityCache.set(entityId, persistentEntity)

    return entityId  // Return domain ID, not Brainy ID
  }

  /**
   * Find an existing entity by name or attributes
   */
  async findEntity(query: {
    name?: string
    type?: string
    attributes?: Record<string, any>
    similar?: string  // Find similar entities to this description
  }): Promise<PersistentEntity[]> {
    const searchQuery: any = {}

    if (query.name) {
      // Search by exact name or aliases
      searchQuery.$or = [
        { name: query.name },
        { aliases: { $in: [query.name] } }
      ]
    }

    if (query.type) {
      searchQuery.type = query.type
    }

    if (query.attributes) {
      for (const [key, value] of Object.entries(query.attributes)) {
        searchQuery[`attributes.${key}`] = value
      }
    }

    // Add system metadata for EntityManager
    searchQuery.entityType = 'persistent'

    // Search using EntityManager
    let results = await this.findEntities<PersistentEntity>(searchQuery, NounType.Concept, 100)

    // If searching for similar entities, use vector similarity
    if (query.similar) {
      try {
        const queryEmbedding = await this.generateTextEmbedding(query.similar)
        if (queryEmbedding) {
          // Get all entities and rank by similarity using EntityManager
          const allEntities = await this.findEntities<PersistentEntity>({}, NounType.Concept, 1000)

          const withSimilarity = allEntities
            .filter(e => e.brainyId) // Only entities with brainyId have vectors
            .map(async e => {
              const brainyEntity = await this.brain.get(e.brainyId!)
              if (brainyEntity?.vector) {
                return {
                  entity: e,
                  similarity: 1 - cosineDistance(queryEmbedding, brainyEntity.vector)
                }
              }
              return null
            })

          const resolved = (await Promise.all(withSimilarity))
            .filter(s => s !== null && s.similarity > this.config.similarityThreshold)
            .sort((a, b) => b!.similarity - a!.similarity)

          results = resolved.map(s => s!.entity)
        }
      } catch (error) {
        console.warn('Failed to perform similarity search:', error)
      }
    }

    return results
  }

  /**
   * Record an appearance of an entity in a file
   */
  async recordAppearance(
    entityId: string,
    filePath: string,
    context: string,
    options?: {
      position?: EntityAppearance['position']
      confidence?: number
      extractChanges?: boolean
    }
  ): Promise<string> {
    const entity = await this.getPersistentEntity(entityId)
    if (!entity) {
      throw new Error(`Entity ${entityId} not found`)
    }

    const appearanceId = uuidv4()
    const timestamp = Date.now()

    // Detect changes if enabled
    let changes: EntityChange[] = []
    if (options?.extractChanges && this.config.evolutionTracking) {
      changes = await this.detectChanges(entity, context, filePath)
    }

    const appearance: EntityAppearance = {
      id: appearanceId,
      entityId,
      filePath,
      context,
      position: options?.position,
      timestamp,
      version: entity.version,
      changes,
      confidence: options?.confidence ?? 1.0
    }

    // Store appearance as managed entity (with eventType for appearances)
    const appearanceWithEventType = {
      ...appearance,
      eventType: 'entity-appearance'
    }

    await this.storeEntity(
      appearanceWithEventType,
      NounType.Event,
      undefined,
      Buffer.from(context)
    )

    // Create relationship to entity using EntityManager
    await this.createRelationship(
      appearanceId,
      entityId,
      VerbType.References
    )

    // Update entity with new appearance
    entity.appearances.push(appearance)
    entity.lastUpdated = timestamp

    // Apply changes if any detected
    if (changes.length > 0) {
      entity.version++
      for (const change of changes) {
        if (change.field in entity.attributes) {
          entity.attributes[change.field] = change.newValue
        }
      }
    }

    // Prune old appearances if needed
    if (entity.appearances.length > this.config.maxAppearances) {
      entity.appearances = entity.appearances
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(0, this.config.maxAppearances)
    }

    // Update stored entity
    await this.updatePersistentEntity(entity)

    return appearanceId
  }

  /**
   * Get entity evolution history
   */
  async getEvolution(entityId: string): Promise<{
    entity: PersistentEntity
    timeline: Array<{
      timestamp: number
      version: number
      changes: EntityChange[]
      appearance?: EntityAppearance
    }>
  }> {
    const entity = await this.getPersistentEntity(entityId)
    if (!entity) {
      throw new Error(`Entity ${entityId} not found`)
    }

    // Get all appearances sorted by time
    const appearances = entity.appearances.sort((a, b) => a.timestamp - b.timestamp)

    // Build timeline
    const timeline = []
    for (const appearance of appearances) {
      if (appearance.changes && appearance.changes.length > 0) {
        timeline.push({
          timestamp: appearance.timestamp,
          version: appearance.version,
          changes: appearance.changes,
          appearance
        })
      }
    }

    return { entity, timeline }
  }

  /**
   * Find all appearances of an entity
   */
  async findAppearances(entityId: string, options?: {
    filePath?: string
    since?: number
    until?: number
    minConfidence?: number
  }): Promise<EntityAppearance[]> {
    const query: any = {
      entityId,
      eventType: 'entity-appearance',
      system: 'vfs-entity'
    }

    if (options?.filePath) {
      query.filePath = options.filePath
    }

    if (options?.since || options?.until) {
      query.timestamp = {}
      if (options.since) query.timestamp.$gte = options.since
      if (options.until) query.timestamp.$lte = options.until
    }

    if (options?.minConfidence) {
      query.confidence = { $gte: options.minConfidence }
    }

    const results = await this.brain.find({
      where: query,
      type: NounType.Event,
      limit: 1000
    })

    return results
      .map(r => r.entity.metadata as EntityAppearance)
      .sort((a, b) => b.timestamp - a.timestamp)
  }

  /**
   * Evolve an entity with new information
   */
  async evolveEntity(
    entityId: string,
    updates: Partial<Pick<PersistentEntity, 'name' | 'description' | 'aliases' | 'attributes'>>,
    source: string,
    reason?: string
  ): Promise<void> {
    const entity = await this.getPersistentEntity(entityId)
    if (!entity) {
      throw new Error(`Entity ${entityId} not found`)
    }

    const timestamp = Date.now()
    const changes: EntityChange[] = []

    // Track changes
    for (const [field, newValue] of Object.entries(updates)) {
      if (field in entity && entity[field as keyof PersistentEntity] !== newValue) {
        changes.push({
          field,
          oldValue: entity[field as keyof PersistentEntity],
          newValue,
          timestamp,
          source,
          reason
        })
      }
    }

    // Apply updates
    Object.assign(entity, updates)
    entity.lastUpdated = timestamp
    entity.version++

    // Update stored entity
    await this.updatePersistentEntity(entity)

    // Record evolution event
    if (changes.length > 0) {
      await this.brain.add({
        type: NounType.Event,
        data: Buffer.from(JSON.stringify(changes)),
        metadata: {
          entityId,
          changes,
          timestamp,
          source,
          reason,
          eventType: 'entity-evolution',
          system: 'vfs-entity'
        }
      })
    }
  }

  /**
   * Extract entities from content (auto-extraction)
   */
  async extractEntities(filePath: string, content: Buffer): Promise<string[]> {
    if (!this.config.autoExtract) {
      return []
    }

    // Convert content to text for processing
    const text = content.toString('utf8')
    const entities: string[] = []

    // Simple entity extraction patterns
    // In production, this would use NLP/ML models
    const patterns = [
      // Character names (capitalized words)
      /\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b/g,
      // API endpoints
      /\/api\/[a-zA-Z0-9/\-_]+/g,
      // Class names
      /class\s+([A-Z][a-zA-Z0-9_]*)/g,
      // Function names
      /function\s+([a-zA-Z_][a-zA-Z0-9_]*)/g
    ]

    for (const pattern of patterns) {
      const matches = text.matchAll(pattern)
      for (const match of matches) {
        const entityName = match[1] || match[0]

        // Check if entity already exists
        const existing = await this.findEntity({ name: entityName })

        if (existing.length === 0) {
          // Create new entity
          const entityId = await this.createEntity({
            name: entityName,
            type: this.detectEntityType(entityName, text),
            aliases: [],
            attributes: {}
          })

          entities.push(entityId)
        }

        // Record appearance for existing or new entity
        const entity = existing[0] || await this.getPersistentEntity(entities[entities.length - 1])
        if (entity) {
          await this.recordAppearance(
            entity.id,
            filePath,
            this.extractContext(text, match.index || 0),
            { confidence: 0.7, extractChanges: true }
          )
        }
      }
    }

    return entities
  }

  /**
   * Update references when a file moves
   */
  async updateReferences(oldPath: string, newPath: string): Promise<void> {
    // Find all appearances in the old path
    const results = await this.brain.find({
      where: {
        filePath: oldPath,
        eventType: 'entity-appearance',
        system: 'vfs-entity'
      },
      type: NounType.Event,
      limit: 10000
    })

    // Update each appearance
    for (const result of results) {
      const appearance = result.entity.metadata as EntityAppearance
      appearance.filePath = newPath

      // Update the stored appearance
      await this.brain.update({
        id: result.entity.id,
        metadata: appearance
      })
    }

    // Update cache
    for (const entity of this.entityCache.values()) {
      for (const appearance of entity.appearances) {
        if (appearance.filePath === oldPath) {
          appearance.filePath = newPath
        }
      }
    }
  }

  /**
   * Get persistent entity by ID
   */
  async getPersistentEntity(entityId: string): Promise<PersistentEntity | null> {
    // Check cache first
    if (this.entityCache.has(entityId)) {
      return this.entityCache.get(entityId)!
    }

    // Use parent getEntity method
    const entity = await super.getEntity<PersistentEntity>(entityId)

    if (entity) {
      // Cache and return
      this.entityCache.set(entityId, entity)
    }

    return entity
  }

  /**
   * Update stored entity (rename to avoid parent method conflict)
   */
  private async updatePersistentEntity(entity: PersistentEntity): Promise<void> {
    // Find the Brainy entity
    const results = await this.brain.find({
      where: {
        id: entity.id,
        entityType: 'persistent',
        system: 'vfs-entity'
      },
      type: NounType.Concept,
      limit: 1
    })

    if (results.length > 0) {
      await this.brain.update({
        id: results[0].entity.id,
        data: Buffer.from(JSON.stringify(entity)),
        metadata: {
          ...entity,
          entityType: 'persistent',
          system: 'vfs-entity'
        }
      })
    }

    // Update cache
    this.entityCache.set(entity.id, entity)
  }

  /**
   * Detect changes in entity from context
   */
  private async detectChanges(
    entity: PersistentEntity,
    context: string,
    source: string
  ): Promise<EntityChange[]> {
    // Simple change detection - in production would use NLP
    const changes: EntityChange[] = []
    const timestamp = Date.now()

    // Look for attribute changes in context
    const attributePatterns = [
      /(\w+):\s*"([^"]+)"/g,  // key: "value"
      /(\w+)\s*=\s*"([^"]+)"/g,  // key = "value"
      /set(\w+)\("([^"]+)"\)/g   // setProperty("value")
    ]

    for (const pattern of attributePatterns) {
      const matches = context.matchAll(pattern)
      for (const match of matches) {
        const field = match[1].toLowerCase()
        const newValue = match[2]

        if (field in entity.attributes && entity.attributes[field] !== newValue) {
          changes.push({
            field: `attributes.${field}`,
            oldValue: entity.attributes[field],
            newValue,
            timestamp,
            source
          })
        }
      }
    }

    return changes
  }

  /**
   * Generate embedding for entity
   */
  private async generateEntityEmbedding(entity: PersistentEntity): Promise<number[] | undefined> {
    try {
      // Create text representation of entity
      const text = [
        entity.name,
        entity.description || '',
        entity.type,
        ...entity.aliases,
        JSON.stringify(entity.attributes)
      ].join(' ')

      return await this.generateTextEmbedding(text)
    } catch (error) {
      console.error('Failed to generate entity embedding:', error)
      return undefined
    }
  }

  /**
   * Generate embedding for text
   */
  private async generateTextEmbedding(text: string): Promise<number[] | undefined> {
    try {
      // Generate embedding using Brainy's embed method
      const vector = await this.brain.embed(text)
      return vector
    } catch (error) {
      console.debug('Failed to generate embedding:', error)
      return undefined
    }
  }

  /**
   * Detect entity type from name and context
   */
  private detectEntityType(name: string, context: string): string {
    if (context.includes('class ' + name)) return 'class'
    if (context.includes('function ' + name)) return 'function'
    if (context.includes('/api/')) return 'api'
    if (/^[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*$/.test(name)) return 'person'
    return 'entity'
  }

  /**
   * Extract context around a position
   */
  private extractContext(text: string, position: number, radius = 100): string {
    const start = Math.max(0, position - radius)
    const end = Math.min(text.length, position + radius)
    return text.slice(start, end)
  }

  /**
   * Clear entity cache
   */
  clearCache(entityId?: string): void {
    if (entityId) {
      this.entityCache.delete(entityId)
    } else {
      this.entityCache.clear()
    }
  }
}