/**
 * Data Management API for Brainy 3.0
 * Provides backup, restore, import, export, and data management
 */

import { StorageAdapter, HNSWNoun, GraphVerb } from '../coreTypes.js'
import { Entity, Relation } from '../types/brainy.types.js'
import { NounType, VerbType } from '../types/graphTypes.js'

export interface BackupOptions {
  includeVectors?: boolean
  compress?: boolean
  format?: 'json' | 'binary'
}

export interface RestoreOptions {
  merge?: boolean
  overwrite?: boolean
  validate?: boolean
}

export interface ImportOptions {
  format: 'json' | 'csv'
  mapping?: Record<string, string>
  batchSize?: number
  validate?: boolean
}

export interface ExportOptions {
  format?: 'json' | 'csv'
  filter?: {
    type?: NounType | NounType[]
    where?: Record<string, any>
    service?: string
  }
  includeVectors?: boolean
}

export interface BackupData {
  version: string
  timestamp: number
  entities: Array<{
    id: string
    vector?: number[]
    type: string
    metadata: any
    service?: string
  }>
  relations: Array<{
    id: string
    from: string
    to: string
    type: string
    weight: number
    metadata?: any
  }>
  config?: Record<string, any>
  stats: {
    entityCount: number
    relationCount: number
    vectorDimensions?: number
  }
}

export interface ImportResult {
  successful: number
  failed: number
  errors: Array<{ item: any; error: string }>
  duration: number
}

export class DataAPI {
  private brain: any  // Reference to Brainy instance for neural import
  
  constructor(
    private storage: StorageAdapter,
    private getEntity: (id: string) => Promise<Entity | null>,
    private getRelation?: (id: string) => Promise<Relation | null>,
    brain?: any
  ) {
    this.brain = brain
  }

  /**
   * Create a backup of all data
   */
  async backup(options: BackupOptions = {}): Promise<BackupData | { compressed: boolean; data: string; originalSize: number; compressedSize: number }> {
    const {
      includeVectors = true,
      compress = false,
      format = 'json'
    } = options

    const startTime = Date.now()

    // Get all entities
    const nounsResult = await this.storage.getNouns({ 
      pagination: { limit: 1000000 } 
    })
    const entities: BackupData['entities'] = []

    for (const noun of nounsResult.items) {
      const entity = {
        id: noun.id,
        vector: includeVectors ? noun.vector : undefined,
        type: noun.type || NounType.Thing, // v4.8.0: type at top-level
        metadata: noun.metadata,
        service: noun.service // v4.8.0: service at top-level
      }
      entities.push(entity)
    }

    // Get all relations
    const verbsResult = await this.storage.getVerbs({ 
      pagination: { limit: 1000000 } 
    })
    const relations: BackupData['relations'] = []

    for (const verb of verbsResult.items) {
      relations.push({
        id: verb.id,
        from: verb.sourceId,
        to: verb.targetId,
        type: verb.verb as string,
        weight: verb.weight || 1.0, // v4.8.0: weight at top-level
        metadata: verb.metadata
      })
    }

    // Create backup data
    const backupData: BackupData = {
      version: '3.0.0',
      timestamp: Date.now(),
      entities,
      relations,
      stats: {
        entityCount: entities.length,
        relationCount: relations.length,
        vectorDimensions: entities[0]?.vector?.length
      }
    }

    // Compress if requested
    if (compress) {
      // Import zlib for compression
      const { gzipSync } = await import('node:zlib')
      const jsonString = JSON.stringify(backupData)
      const compressed = gzipSync(Buffer.from(jsonString))
      
      return {
        compressed: true,
        data: compressed.toString('base64'),
        originalSize: jsonString.length,
        compressedSize: compressed.length
      }
    }

    return backupData
  }

  /**
   * Restore data from a backup
   *
   * v4.11.1: CRITICAL FIX - Now uses brain.addMany() and brain.relateMany()
   * Previous implementation only wrote to storage cache without updating indexes,
   * causing complete data loss on restart. This fix ensures:
   * - All 5 indexes updated (HNSW, metadata, adjacency, sparse, type-aware)
   * - Proper persistence to disk/cloud storage
   * - Storage-aware batching for optimal performance
   * - Atomic writes to prevent corruption
   * - Data survives instance restart
   */
  async restore(params: {
    backup: BackupData
    merge?: boolean
    overwrite?: boolean
    validate?: boolean
    onProgress?: (completed: number, total: number) => void
  }): Promise<{
    entitiesRestored: number
    relationshipsRestored: number
    errors: Array<{ type: 'entity' | 'relation'; id: string; error: string }>
  }> {
    const { backup, merge = false, overwrite = false, validate = true, onProgress } = params

    const result = {
      entitiesRestored: 0,
      relationshipsRestored: 0,
      errors: [] as Array<{ type: 'entity' | 'relation'; id: string; error: string }>
    }

    // Validate backup format
    if (validate) {
      if (!backup.version || !backup.entities || !backup.relations) {
        throw new Error('Invalid backup format: missing version, entities, or relations')
      }
    }

    // Validate brain instance is available (required for v4.11.1+ restore)
    if (!this.brain) {
      throw new Error(
        'Restore requires brain instance. DataAPI must be initialized with brain reference. ' +
        'Use: await brain.data() instead of constructing DataAPI directly.'
      )
    }

    // Clear existing data if not merging
    if (!merge && overwrite) {
      await this.clear({ entities: true, relations: true })
    }

    // ============================================
    // Phase 1: Restore entities using addMany()
    // v4.11.1: Uses proper persistence path through brain.addMany()
    // ============================================

    // Prepare entity parameters for addMany()
    const entityParams = backup.entities
      .filter(entity => {
        // Skip existing entities when merging without overwrite
        if (merge && !overwrite) {
          // Note: We'll rely on addMany's internal duplicate handling
          // rather than checking each entity individually (performance)
          return true
        }
        return true
      })
      .map(entity => {
        // Extract data field from metadata (backup format compatibility)
        // Backup stores the original data in metadata.data
        const data = entity.metadata?.data || entity.id

        return {
          id: entity.id,
          data, // Required field for brainy.add()
          type: entity.type,
          metadata: entity.metadata || {},
          vector: entity.vector, // Preserve original vectors from backup
          service: entity.service,
          // Preserve confidence and weight if available
          confidence: entity.metadata?.confidence,
          weight: entity.metadata?.weight
        }
      })

    // Restore entities in batches using storage-aware batching (v4.11.0)
    if (entityParams.length > 0) {
      try {
        const addResult = await this.brain.addMany({
          items: entityParams,
          continueOnError: true,
          onProgress: (done: number, total: number) => {
            onProgress?.(done, backup.entities.length + backup.relations.length)
          }
        })

        result.entitiesRestored = addResult.successful.length

        // Track errors
        addResult.failed.forEach((failure: any) => {
          result.errors.push({
            type: 'entity',
            id: failure.item?.id || 'unknown',
            error: failure.error || 'Unknown error'
          })
        })
      } catch (error) {
        throw new Error(`Failed to restore entities: ${(error as Error).message}`)
      }
    }

    // ============================================
    // Phase 2: Restore relationships using relateMany()
    // v4.11.1: Uses proper persistence path through brain.relateMany()
    // ============================================

    // Prepare relationship parameters for relateMany()
    const relationParams = backup.relations
      .filter(relation => {
        // Skip existing relations when merging without overwrite
        if (merge && !overwrite) {
          // Note: We'll rely on relateMany's internal duplicate handling
          return true
        }
        return true
      })
      .map(relation => ({
        from: relation.from,
        to: relation.to,
        type: relation.type as VerbType,
        metadata: relation.metadata || {},
        weight: relation.weight || 1.0
        // Note: relation.id is ignored - brain.relate() generates new IDs
        // This is intentional to avoid ID conflicts
      }))

    // Restore relationships in batches using storage-aware batching (v4.11.0)
    if (relationParams.length > 0) {
      try {
        const relateResult = await this.brain.relateMany({
          items: relationParams,
          continueOnError: true
        })

        result.relationshipsRestored = relateResult.successful.length

        // Track errors
        relateResult.failed.forEach((failure: any) => {
          result.errors.push({
            type: 'relation',
            id: failure.item?.from + '->' + failure.item?.to || 'unknown',
            error: failure.error || 'Unknown error'
          })
        })
      } catch (error) {
        throw new Error(`Failed to restore relationships: ${(error as Error).message}`)
      }
    }

    // ============================================
    // Phase 3: Verify restoration succeeded
    // ============================================

    // Sample verification: Check that first entity is actually retrievable
    if (backup.entities.length > 0 && result.entitiesRestored > 0) {
      const firstEntityId = backup.entities[0].id
      const verified = await this.brain.get(firstEntityId)

      if (!verified) {
        console.warn(
          `⚠️  Restore completed but verification failed - entity ${firstEntityId} not retrievable. ` +
          `This may indicate a persistence issue with the storage adapter.`
        )
      }
    }

    return result
  }

  /**
   * Clear data
   */
  async clear(params: {
    entities?: boolean
    relations?: boolean
    config?: boolean
  } = {}): Promise<void> {
    const { entities = true, relations = true, config = false } = params

    if (entities) {
      // Clear all entities
      const nounsResult = await this.storage.getNouns({ 
        pagination: { limit: 1000000 } 
      })
      
      for (const noun of nounsResult.items) {
        await this.storage.deleteNoun(noun.id)
      }
      
      // Also clear the HNSW index if available
      if (this.brain?.index?.clear) {
        this.brain.index.clear()
      }
      
      // Clear metadata index if available  
      if (this.brain?.metadataIndex) {
        await this.brain.metadataIndex.rebuild() // Rebuild empty index
      }
    }

    if (relations) {
      // Clear all relations
      const verbsResult = await this.storage.getVerbs({ 
        pagination: { limit: 1000000 } 
      })
      
      for (const verb of verbsResult.items) {
        await this.storage.deleteVerb(verb.id)
      }
    }

    if (config) {
      // Clear configuration would be handled by ConfigAPI
      // For now, skip this
    }
  }

  /**
   * Import data from various formats
   */
  async import(params: ImportOptions & { data: any }): Promise<ImportResult> {
    const { 
      data, 
      format, 
      mapping = {}, 
      batchSize = 100,
      validate = true 
    } = params

    const result: ImportResult = {
      successful: 0,
      failed: 0,
      errors: [],
      duration: 0
    }

    const startTime = Date.now()

    try {
      // ALWAYS use neural import for proper type matching
      const { UniversalImportAPI } = await import('./UniversalImportAPI.js')
      const universalImport = new UniversalImportAPI(this.brain)
      await universalImport.init()
      
      // Convert to ImportSource format
      const neuralResult = await universalImport.import({
        type: 'object',
        data,
        format: format || 'json',
        metadata: { mapping, batchSize, validate }
      })
      
      // Convert neural result to ImportResult format
      result.successful = neuralResult.stats.entitiesCreated
      result.failed = 0  // Neural import always succeeds with best match
      result.duration = neuralResult.stats.processingTimeMs
      
      // Log relationships created
      if (neuralResult.stats.relationshipsCreated > 0) {
        console.log(`Neural import also created ${neuralResult.stats.relationshipsCreated} relationships`)
      }
      
      return result
    } catch (error) {
      // Fallback to legacy import ONLY if neural import fails to load
      console.warn('Neural import failed, using legacy import:', error)
      
      let items: any[] = []

      // Parse data based on format
      switch (format) {
        case 'json':
          items = Array.isArray(data) ? data : [data]
          break
        
        case 'csv':
          // CSV parsing would go here
          // For now, assume data is already parsed
          items = data
          break
        
        // Parquet format removed - not implemented
        
        default:
          throw new Error(`Unsupported format: ${format}`)
      }

      // Process items in batches
      for (let i = 0; i < items.length; i += batchSize) {
        const batch = items.slice(i, i + batchSize)
        
        for (const item of batch) {
          try {
            // Apply field mapping
            const mapped = this.applyMapping(item, mapping)
            
            // Validate if requested
            if (validate) {
              this.validateImportItem(mapped)
            }

            // v4.0.0: Save entity - separate vector and metadata
            const id = mapped.id || this.generateId()
            const noun: HNSWNoun = {
              id,
              vector: mapped.vector || new Array(384).fill(0),
              connections: new Map(),
              level: 0
            }

            await this.storage.saveNoun(noun)
            await this.storage.saveNounMetadata(id, { ...mapped, createdAt: Date.now() })
            result.successful++
          } catch (error) {
            result.failed++
            result.errors.push({
              item,
              error: (error as Error).message
            })
          }
        }
      }
      
      result.duration = Date.now() - startTime
      return result
    }
  }

  /**
   * Export data to various formats
   */
  async export(params: ExportOptions = {}): Promise<any> {
    const { 
      format = 'json', 
      filter = {}, 
      includeVectors = false 
    } = params

    // Get filtered entities
    const nounsResult = await this.storage.getNouns({ 
      pagination: { limit: 1000000 } 
    })

    let entities = nounsResult.items

    // Apply filters
    if (filter.type) {
      const types = Array.isArray(filter.type) ? filter.type : [filter.type]
      entities = entities.filter(e => 
        types.includes(e.metadata?.noun as NounType)
      )
    }

    if (filter.service) {
      entities = entities.filter(e => 
        e.metadata?.service === filter.service
      )
    }

    if (filter.where) {
      entities = entities.filter(e => 
        this.matchesFilter(e.metadata, filter.where!)
      )
    }

    // Format data based on export format
    switch (format) {
      case 'json':
        return entities.map(e => ({
          id: e.id,
          vector: includeVectors ? e.vector : undefined,
          ...e.metadata
        }))
      
      case 'csv':
        // Convert to CSV format
        // For now, return simplified format
        return this.convertToCSV(entities)
      
      // Parquet format removed - not implemented
      
      default:
        throw new Error(`Unsupported export format: ${format}`)
    }
  }

  /**
   * Get storage statistics
   */
  async getStats(): Promise<{
    entities: number
    relations: number
    storageSize?: number
    vectorDimensions?: number
  }> {
    const nounsResult = await this.storage.getNouns({ 
      pagination: { limit: 1 } 
    })
    const verbsResult = await this.storage.getVerbs({ 
      pagination: { limit: 1 } 
    })

    const firstNoun = nounsResult.items[0]

    return {
      entities: nounsResult.totalCount || nounsResult.items.length,
      relations: verbsResult.totalCount || verbsResult.items.length,
      vectorDimensions: firstNoun?.vector?.length
    }
  }

  // Helper methods

  private applyMapping(item: any, mapping: Record<string, string>): any {
    const mapped: any = {}
    
    for (const [key, value] of Object.entries(item)) {
      const mappedKey = mapping[key] || key
      mapped[mappedKey] = value
    }
    
    return mapped
  }

  private validateImportItem(item: any): void {
    // Basic validation
    if (!item || typeof item !== 'object') {
      throw new Error('Invalid item: must be an object')
    }
    
    // Could add more validation here
  }

  private matchesFilter(metadata: any, filter: Record<string, any>): boolean {
    for (const [key, value] of Object.entries(filter)) {
      if (metadata[key] !== value) {
        return false
      }
    }
    return true
  }

  private convertToCSV(entities: Array<{ id: string; metadata?: any }>): string {
    if (entities.length === 0) return ''

    // Get all unique keys from metadata
    const keys = new Set<string>()
    for (const entity of entities) {
      if (entity.metadata) {
        Object.keys(entity.metadata).forEach(k => keys.add(k))
      }
    }

    // Create CSV header
    const headers = ['id', ...Array.from(keys)]
    const rows = [headers.join(',')]

    // Add data rows
    for (const entity of entities) {
      const row = [entity.id]
      for (const key of keys) {
        const value = entity.metadata?.[key] || ''
        // Escape values that contain commas
        const escaped = String(value).includes(',')
          ? `"${String(value).replace(/"/g, '""')}"`
          : String(value)
        row.push(escaped)
      }
      rows.push(row.join(','))
    }

    return rows.join('\n')
  }

  private generateId(): string {
    return `import_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }
}