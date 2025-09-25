/**
 * EntityManager Base Class
 *
 * Provides standardized entity ID management for all Knowledge Layer components
 * Solves the root cause of ID mismatch issues by establishing clear patterns
 */

import { Brainy } from '../brainy.js'
import { NounType } from '../types/graphTypes.js'
import { v4 as uuidv4 } from '../universal/uuid.js'

/**
 * Standard entity structure used by all Knowledge Layer components
 */
export interface ManagedEntity {
  /** Domain-specific ID (for external references) */
  id: string
  /** The actual Brainy entity ID (for internal operations) */
  brainyId?: string
  /** Entity metadata */
  [key: string]: any
}

/**
 * ID mapping to track domain IDs to Brainy entity IDs
 */
interface EntityIdMapping {
  domainId: string
  brainyId: string
  system: string
  type: string
}

/**
 * EntityManager Base Class
 *
 * All Knowledge Layer components should extend this to get standardized:
 * - Entity storage and retrieval
 * - ID management and mapping
 * - Query patterns
 * - Relationship creation
 */
export abstract class EntityManager {
  private idMappings = new Map<string, string>() // domainId -> brainyId
  private brainyToMappings = new Map<string, string>() // brainyId -> domainId

  constructor(
    protected brain: Brainy,
    protected systemName: string
  ) {}

  /**
   * Store an entity with proper ID management
   */
  protected async storeEntity<T extends ManagedEntity>(
    entity: T,
    nounType: NounType,
    embedding?: number[],
    data?: any
  ): Promise<string> {
    // Generate domain ID if not provided
    if (!entity.id) {
      entity.id = uuidv4()
    }

    // Store in Brainy and get the Brainy entity ID
    const brainyId = await this.brain.add({
      type: nounType,
      data: data || Buffer.from(JSON.stringify(entity)),
      metadata: {
        ...entity,
        system: this.systemName,
        domainId: entity.id, // Store the domain ID for reference
        storedAt: Date.now()
      },
      vector: embedding
    })

    // Store ID mapping
    this.idMappings.set(entity.id, brainyId)
    this.brainyToMappings.set(brainyId, entity.id)

    // Update entity with Brainy ID
    entity.brainyId = brainyId

    return entity.id // Return domain ID for external use
  }

  /**
   * Update an existing entity
   */
  protected async updateEntity<T extends ManagedEntity>(
    entity: T,
    embedding?: number[]
  ): Promise<void> {
    const brainyId = this.idMappings.get(entity.id)
    if (!brainyId) {
      throw new Error(`Entity ${entity.id} not found in mappings`)
    }

    await this.brain.update({
      id: brainyId,
      data: Buffer.from(JSON.stringify(entity)),
      metadata: {
        ...entity,
        system: this.systemName,
        domainId: entity.id,
        updatedAt: Date.now()
      },
      vector: embedding
    })
  }

  /**
   * Retrieve entity by domain ID
   */
  protected async getEntity<T extends ManagedEntity>(domainId: string): Promise<T | null> {
    // First try from cache
    let brainyId = this.idMappings.get(domainId)

    // If not in cache, search by domain ID in metadata
    if (!brainyId) {
      const results = await this.brain.find({
        where: {
          domainId,
          system: this.systemName
        },
        limit: 1
      })

      if (results.length === 0) {
        return null
      }

      brainyId = results[0].entity.id
      // Cache the mapping
      this.idMappings.set(domainId, brainyId)
      this.brainyToMappings.set(brainyId, domainId)
    }

    // Get entity using Brainy ID
    const brainyEntity = await this.brain.get(brainyId)
    if (!brainyEntity) {
      return null
    }

    // Parse entity from metadata
    const entity = brainyEntity.metadata as T
    entity.brainyId = brainyId
    return entity
  }

  /**
   * Find entities by metadata criteria
   */
  protected async findEntities<T extends ManagedEntity>(
    criteria: Record<string, any>,
    nounType?: NounType,
    limit = 100
  ): Promise<T[]> {
    const query: any = {
      ...criteria,
      system: this.systemName
    }

    const results = await this.brain.find({
      where: query,
      type: nounType,
      limit
    })

    const entities: T[] = []
    for (const result of results) {
      const entity = result.entity.metadata as T
      entity.brainyId = result.entity.id

      // Update mappings cache
      this.idMappings.set(entity.id, result.entity.id)
      this.brainyToMappings.set(result.entity.id, entity.id)

      entities.push(entity)
    }

    return entities
  }

  /**
   * Create relationship between entities using proper Brainy IDs
   */
  protected async createRelationship(
    fromDomainId: string,
    toDomainId: string,
    relationshipType: any,
    metadata?: Record<string, any>
  ): Promise<void> {
    // Get Brainy IDs for both entities
    const fromBrainyId = await this.getBrainyId(fromDomainId)
    const toBrainyId = await this.getBrainyId(toDomainId)

    if (!fromBrainyId || !toBrainyId) {
      throw new Error(`Cannot find Brainy IDs for relationship: ${fromDomainId} -> ${toDomainId}`)
    }

    // Create relationship using Brainy IDs
    await this.brain.relate({
      from: fromBrainyId,
      to: toBrainyId,
      type: relationshipType,
      metadata
    })
  }

  /**
   * Get Brainy ID for a domain ID
   */
  protected async getBrainyId(domainId: string): Promise<string | null> {
    // Check cache first
    let brainyId = this.idMappings.get(domainId)

    if (!brainyId) {
      // Search in Brainy
      const results = await this.brain.find({
        where: {
          domainId,
          system: this.systemName
        },
        limit: 1
      })

      if (results.length > 0) {
        brainyId = results[0].entity.id
        // Cache the mapping
        this.idMappings.set(domainId, brainyId)
        this.brainyToMappings.set(brainyId, domainId)
      }
    }

    return brainyId || null
  }

  /**
   * Get domain ID for a Brainy ID
   */
  protected getDomainId(brainyId: string): string | null {
    return this.brainyToMappings.get(brainyId) || null
  }

  /**
   * Delete entity by domain ID
   */
  protected async deleteEntity(domainId: string): Promise<void> {
    const brainyId = await this.getBrainyId(domainId)
    if (brainyId) {
      await this.brain.delete(brainyId)
      // Clean up mappings
      this.idMappings.delete(domainId)
      this.brainyToMappings.delete(brainyId)
    }
  }

  /**
   * Clear ID mapping cache (useful for tests)
   */
  protected clearMappingCache(): void {
    this.idMappings.clear()
    this.brainyToMappings.clear()
  }

  /**
   * Batch load mappings for performance
   */
  protected async loadMappings(domainIds: string[]): Promise<void> {
    const unknownIds = domainIds.filter(id => !this.idMappings.has(id))

    if (unknownIds.length === 0) return

    const results = await this.brain.find({
      where: {
        domainId: { $in: unknownIds },
        system: this.systemName
      },
      limit: unknownIds.length
    })

    for (const result of results) {
      const domainId = result.entity.metadata.domainId
      this.idMappings.set(domainId, result.entity.id)
      this.brainyToMappings.set(result.entity.id, domainId)
    }
  }
}