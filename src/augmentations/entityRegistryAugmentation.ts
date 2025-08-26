/**
 * Entity Registry Augmentation
 * Fast external-ID to internal-UUID mapping for streaming data processing
 * Works in write-only mode for high-performance deduplication
 */

import { BrainyAugmentation, BaseAugmentation, AugmentationContext } from './brainyAugmentation.js'

export interface EntityRegistryConfig {
  /**
   * Maximum number of entries to keep in memory cache
   * Default: 100,000 entries
   */
  maxCacheSize?: number
  
  /**
   * Time to live for cache entries in milliseconds  
   * Default: 300,000 (5 minutes)
   */
  cacheTTL?: number
  
  /**
   * Fields to index for fast lookup
   * Default: ['did', 'handle', 'uri', 'id', 'external_id']
   */
  indexedFields?: string[]
  
  /**
   * Persistence strategy
   * memory: Keep only in memory (fast, but lost on restart)
   * storage: Persist to storage (survives restarts)
   * hybrid: Memory + periodic storage sync
   */
  persistence?: 'memory' | 'storage' | 'hybrid'
  
  /**
   * How often to sync memory cache to storage (hybrid mode)
   * Default: 30000 (30 seconds)
   */
  syncInterval?: number
}

export interface EntityMapping {
  externalId: string
  field: string
  brainyId: string
  nounType: string
  lastAccessed: number
  metadata?: any
}

/**
 * High-performance entity registry for external ID to Brainy UUID mapping
 * Optimized for streaming data scenarios like Bluesky firehose processing
 */
export class EntityRegistryAugmentation extends BaseAugmentation {
  readonly name = 'entity-registry'
  readonly description = 'Fast external-ID to internal-UUID mapping for streaming data'
  readonly timing: 'before' | 'after' | 'around' | 'replace' = 'before'
  readonly operations = ['add', 'addNoun', 'addVerb'] as ('add' | 'addNoun' | 'addVerb')[]
  readonly priority = 90 // High priority for entity registration
  
  private config: Required<EntityRegistryConfig>
  private memoryIndex = new Map<string, EntityMapping>()
  private fieldIndices = new Map<string, Map<string, string>>() // field -> value -> brainyId
  private syncTimer?: NodeJS.Timeout
  private brain?: any
  private storage?: any
  
  constructor(config: EntityRegistryConfig = {}) {
    super()
    
    this.config = {
      maxCacheSize: config.maxCacheSize ?? 100000,
      cacheTTL: config.cacheTTL ?? 300000, // 5 minutes
      indexedFields: config.indexedFields ?? ['did', 'handle', 'uri', 'id', 'external_id'],
      persistence: config.persistence ?? 'hybrid',
      syncInterval: config.syncInterval ?? 30000 // 30 seconds
    }
    
    // Initialize field indices
    for (const field of this.config.indexedFields) {
      this.fieldIndices.set(field, new Map())
    }
  }
  
  async initialize(context: AugmentationContext): Promise<void> {
    this.brain = context.brain
    this.storage = context.storage
    
    // Load existing mappings from storage
    if (this.config.persistence === 'storage' || this.config.persistence === 'hybrid') {
      await this.loadFromStorage()
    }
    
    // Start sync timer for hybrid mode
    if (this.config.persistence === 'hybrid') {
      this.syncTimer = setInterval(() => {
        this.syncToStorage().catch(console.error)
      }, this.config.syncInterval)
    }
    
    console.log(`🔍 EntityRegistry initialized: ${this.memoryIndex.size} cached mappings`)
  }
  
  async shutdown(): Promise<void> {
    // Final sync before shutdown
    if (this.config.persistence === 'storage' || this.config.persistence === 'hybrid') {
      await this.syncToStorage()
    }
    
    if (this.syncTimer) {
      clearInterval(this.syncTimer)
    }
  }
  
  /**
   * Execute the augmentation
   */
  async execute<T = any>(
    operation: string,
    params: any,
    next: () => Promise<T>
  ): Promise<T> {
    console.log(`🔍 [EntityRegistry] execute called: operation=${operation}`)
    
    // For add operations, check for duplicates first
    if (operation === 'add' || operation === 'addNoun') {
      const metadata = params.metadata || {}
      
      // Check if entity already exists
      for (const field of this.config.indexedFields) {
        const value = this.extractFieldValue(metadata, field)
        if (value) {
          const existingId = await this.lookupEntity(field, value)
          if (existingId) {
            // Entity already exists, return the existing one
            console.log(`🔍 Duplicate detected: ${field}:${value} → ${existingId}`)
            return { id: existingId, duplicate: true } as any
          }
        }
      }
    }
    
    // For addVerb operations, resolve external IDs to internal UUIDs
    if (operation === 'addVerb') {
      const sourceId = params.sourceId
      const targetId = params.targetId
      
      // Try to resolve source and target IDs if they look like external IDs
      for (const field of this.config.indexedFields) {
        // Check if sourceId matches an external ID pattern
        if (typeof sourceId === 'string' && this.looksLikeExternalId(sourceId, field)) {
          const resolvedSourceId = await this.lookupEntity(field, sourceId)
          if (resolvedSourceId) {
            console.log(`🔍 [EntityRegistry] Resolved source: ${sourceId} → ${resolvedSourceId}`)
            params.sourceId = resolvedSourceId
          }
        }
        
        // Check if targetId matches an external ID pattern
        if (typeof targetId === 'string' && this.looksLikeExternalId(targetId, field)) {
          const resolvedTargetId = await this.lookupEntity(field, targetId)
          if (resolvedTargetId) {
            console.log(`🔍 [EntityRegistry] Resolved target: ${targetId} → ${resolvedTargetId}`)
            params.targetId = resolvedTargetId
          }
        }
      }
    }
    
    // Proceed with the operation
    const result = await next()
    
    // Register the entity after successful add
    if ((operation === 'add' || operation === 'addNoun' || operation === 'addVerb') && result) {
      // Handle both formats: string UUID or object with id property
      const brainyId = typeof result === 'string' ? result : (result as any).id
      if (brainyId) {
        const metadata = params.metadata || {}
        const nounType = params.nounType || 'default'
        console.log(`🔍 [EntityRegistry] Registering entity: ${brainyId}`)
        await this.registerEntity(brainyId, metadata, nounType)
        console.log(`✅ [EntityRegistry] Entity registered successfully`)
      }
    }
    
    return result
  }
  
  /**
   * Register a new entity mapping
   */
  async registerEntity(brainyId: string, metadata: any, nounType: string): Promise<void> {
    const now = Date.now()
    
    // Extract indexed fields from metadata
    for (const field of this.config.indexedFields) {
      const value = this.extractFieldValue(metadata, field)
      if (value) {
        const key = `${field}:${value}`
        
        // Add to memory index
        const mapping: EntityMapping = {
          externalId: value,
          field,
          brainyId,
          nounType,
          lastAccessed: now,
          metadata
        }
        
        this.memoryIndex.set(key, mapping)
        
        // Add to field-specific index
        const fieldIndex = this.fieldIndices.get(field)
        if (fieldIndex) {
          fieldIndex.set(value, brainyId)
        }
      }
    }
    
    // Enforce cache size limit (LRU eviction)
    await this.evictOldEntries()
  }
  
  /**
   * Fast lookup: external ID → Brainy UUID
   * Works in write-only mode without search indexes
   */
  async lookupEntity(field: string, value: string): Promise<string | null> {
    const key = `${field}:${value}`
    const cached = this.memoryIndex.get(key)
    
    if (cached) {
      // Update last accessed time
      cached.lastAccessed = Date.now()
      return cached.brainyId
    }
    
    // If not in cache and using storage persistence, try loading from storage
    if (this.config.persistence === 'storage' || this.config.persistence === 'hybrid') {
      const stored = await this.loadFromStorageByField(field, value)
      if (stored) {
        // Add to memory cache
        this.memoryIndex.set(key, stored)
        const fieldIndex = this.fieldIndices.get(field)
        if (fieldIndex) {
          fieldIndex.set(value, stored.brainyId)
        }
        return stored.brainyId
      }
    }
    
    return null
  }
  
  /**
   * Batch lookup for multiple external IDs
   */
  async lookupBatch(lookups: Array<{ field: string; value: string }>): Promise<Map<string, string | null>> {
    const results = new Map<string, string | null>()
    const missingKeys: Array<{ field: string; value: string; key: string }> = []
    
    // Check memory cache first
    for (const lookup of lookups) {
      const key = `${lookup.field}:${lookup.value}`
      const cached = this.memoryIndex.get(key)
      
      if (cached) {
        cached.lastAccessed = Date.now()
        results.set(key, cached.brainyId)
      } else {
        missingKeys.push({ ...lookup, key })
        results.set(key, null)
      }
    }
    
    // Batch load missing keys from storage
    if (missingKeys.length > 0 && (this.config.persistence === 'storage' || this.config.persistence === 'hybrid')) {
      const stored = await this.loadBatchFromStorage(missingKeys)
      
      for (const [key, mapping] of stored) {
        if (mapping) {
          // Add to memory cache
          this.memoryIndex.set(key, mapping)
          const fieldIndex = this.fieldIndices.get(mapping.field)
          if (fieldIndex) {
            fieldIndex.set(mapping.externalId, mapping.brainyId)
          }
          results.set(key, mapping.brainyId)
        }
      }
    }
    
    return results
  }
  
  /**
   * Check if entity exists (faster than lookupEntity for existence checks)
   */
  async hasEntity(field: string, value: string): Promise<boolean> {
    const fieldIndex = this.fieldIndices.get(field)
    if (fieldIndex && fieldIndex.has(value)) {
      return true
    }
    
    return (await this.lookupEntity(field, value)) !== null
  }
  
  /**
   * Get all entities by field (e.g., all DIDs)
   */
  async getEntitiesByField(field: string): Promise<string[]> {
    const fieldIndex = this.fieldIndices.get(field)
    return fieldIndex ? Array.from(fieldIndex.keys()) : []
  }
  
  /**
   * Get registry statistics
   */
  getStats(): {
    totalMappings: number
    fieldCounts: Record<string, number>
    cacheHitRate: number
    memoryUsage: number
  } {
    const fieldCounts: Record<string, number> = {}
    
    for (const [field, index] of this.fieldIndices) {
      fieldCounts[field] = index.size
    }
    
    return {
      totalMappings: this.memoryIndex.size,
      fieldCounts,
      cacheHitRate: 0.95, // TODO: Implement actual hit rate tracking
      memoryUsage: this.estimateMemoryUsage()
    }
  }
  
  /**
   * Clear all cached mappings
   */
  async clearCache(): Promise<void> {
    this.memoryIndex.clear()
    for (const fieldIndex of this.fieldIndices.values()) {
      fieldIndex.clear()
    }
  }
  
  // Private helper methods
  
  /**
   * Check if an ID looks like it could be an external ID for a specific field
   */
  private looksLikeExternalId(id: string, field: string): boolean {
    // Basic heuristics to detect external ID patterns
    switch (field) {
      case 'did':
        return id.startsWith('did:')
      case 'handle':
        return id.includes('.') && (id.includes('bsky') || id.includes('social'))
      case 'external_id':
        return !id.match(/^[a-f0-9-]{36}$/i) // Not a UUID
      case 'uri':
        return id.startsWith('http') || id.startsWith('at://')
      case 'id':
        return !id.match(/^[a-f0-9-]{36}$/i) // Not a UUID
      default:
        // For custom fields, assume non-UUID strings might be external IDs
        return typeof id === 'string' && id.length > 3 && !id.match(/^[a-f0-9-]{36}$/i)
    }
  }
  
  private extractFieldValue(metadata: any, field: string): string | null {
    if (!metadata) return null
    
    // Support nested field access (e.g., "author.did")
    const parts = field.split('.')
    let value = metadata
    
    for (const part of parts) {
      value = value?.[part]
      if (value === undefined || value === null) {
        return null
      }
    }
    
    return typeof value === 'string' ? value : String(value)
  }
  
  private async evictOldEntries(): Promise<void> {
    if (this.memoryIndex.size <= this.config.maxCacheSize) {
      return
    }
    
    // Sort by last accessed time and remove oldest entries
    const entries = Array.from(this.memoryIndex.entries())
    entries.sort(([, a], [, b]) => a.lastAccessed - b.lastAccessed)
    
    const toRemove = entries.slice(0, entries.length - this.config.maxCacheSize)
    
    for (const [key, mapping] of toRemove) {
      this.memoryIndex.delete(key)
      
      const fieldIndex = this.fieldIndices.get(mapping.field)
      if (fieldIndex) {
        fieldIndex.delete(mapping.externalId)
      }
    }
  }
  
  private async loadFromStorage(): Promise<void> {
    if (!this.brain) return
    
    try {
      // Load registry data from a special storage location
      const registryData = await this.brain.storage?.getMetadata('__entity_registry__')
      
      if (registryData && registryData.mappings) {
        for (const mapping of registryData.mappings) {
          const key = `${mapping.field}:${mapping.externalId}`
          this.memoryIndex.set(key, mapping)
          
          const fieldIndex = this.fieldIndices.get(mapping.field)
          if (fieldIndex) {
            fieldIndex.set(mapping.externalId, mapping.brainyId)
          }
        }
      }
    } catch (error) {
      console.warn('Failed to load entity registry from storage:', error)
    }
  }
  
  private async syncToStorage(): Promise<void> {
    if (!this.brain) return
    
    try {
      const mappings = Array.from(this.memoryIndex.values())
      
      await this.brain.storage?.saveMetadata('__entity_registry__', {
        version: 1,
        lastSync: Date.now(),
        mappings
      })
    } catch (error) {
      console.warn('Failed to sync entity registry to storage:', error)
    }
  }
  
  private async loadFromStorageByField(field: string, value: string): Promise<EntityMapping | null> {
    // For now, this would require a full load. In production, you'd want
    // a more sophisticated storage index system
    return null
  }
  
  private async loadBatchFromStorage(keys: Array<{ field: string; value: string; key: string }>): Promise<Map<string, EntityMapping | null>> {
    // For now, return empty. In production, implement batch storage lookup
    return new Map()
  }
  
  private estimateMemoryUsage(): number {
    // Rough estimate: 200 bytes per mapping on average
    return this.memoryIndex.size * 200
  }
}

// Hook into Brainy's add operations to automatically register entities
export class AutoRegisterEntitiesAugmentation extends BaseAugmentation {
  readonly name = 'auto-register-entities'
  readonly description = 'Automatically register entities in the registry when added'
  readonly timing: 'before' | 'after' | 'around' | 'replace' = 'after'
  readonly operations = ['add', 'addNoun', 'addVerb'] as ('add' | 'addNoun' | 'addVerb')[]
  readonly priority = 85 // After entity registry
  
  private registry?: EntityRegistryAugmentation
  private brain?: any
  
  async initialize(context: AugmentationContext): Promise<void> {
    this.brain = context.brain
    // Find the entity registry augmentation from the registry
    this.registry = this.brain?.augmentations?.augmentations?.find(
      (aug: any) => aug instanceof EntityRegistryAugmentation
    ) as EntityRegistryAugmentation
  }
  
  async execute<T = any>(
    operation: string,
    params: any,
    next: () => Promise<T>
  ): Promise<T> {
    const result = await next()
    
    // After successful add, register the entity
    if ((operation === 'add' || operation === 'addNoun' || operation === 'addVerb') && result) {
      if (this.registry) {
        // Handle both formats: string UUID or object with id property
        const brainyId = typeof result === 'string' ? result : (result as any).id
        if (brainyId) {
          const metadata = params.metadata || {}
          const nounType = params.nounType || 'default'
          await this.registry.registerEntity(brainyId, metadata, nounType)
        }
      }
    }
    
    return result
  }
}