/**
 * Metadata Index System
 * Maintains inverted indexes for fast metadata filtering
 * Automatically updates indexes when data changes
 */

import { StorageAdapter } from '../coreTypes.js'
import { MetadataIndexCache, MetadataIndexCacheConfig } from './metadataIndexCache.js'
import { prodLog } from './logger.js'
import { getGlobalCache, UnifiedCache } from './unifiedCache.js'
import { NounType } from '../types/graphTypes.js'

export interface MetadataIndexEntry {
  field: string
  value: string | number | boolean
  ids: Set<string>
  lastUpdated: number
}

export interface FieldIndexData {
  // Maps value -> count for quick filter discovery
  values: Record<string, number>
  lastUpdated: number
}

export interface MetadataIndexStats {
  totalEntries: number
  totalIds: number
  fieldsIndexed: string[]
  lastRebuild: number
  indexSize: number // in bytes
}

export interface MetadataIndexConfig {
  maxIndexSize?: number // Max number of entries per field value (default: 10000)
  rebuildThreshold?: number // Rebuild if index is this % stale (default: 0.1)
  autoOptimize?: boolean // Auto-cleanup unused entries (default: true)
  indexedFields?: string[] // Only index these fields (default: all)
  excludeFields?: string[] // Never index these fields
}

/**
 * Manages metadata indexes for fast filtering
 * Maintains inverted indexes: field+value -> list of IDs
 */
// Sorted index for range queries
interface SortedFieldIndex {
  values: Array<[value: any, ids: Set<string>]>
  isDirty: boolean
  fieldType: 'number' | 'string' | 'date' | 'mixed'
}

// Cardinality tracking for optimization decisions
interface CardinalityInfo {
  uniqueValues: number
  totalValues: number
  distribution: 'uniform' | 'skewed' | 'sparse'
  updateFrequency: number
  lastAnalyzed: number
}

// Field statistics for smart optimization
interface FieldStats {
  cardinality: CardinalityInfo
  queryCount: number
  rangeQueryCount: number
  exactQueryCount: number
  avgQueryTime: number
  indexType: 'hash' | 'sorted' | 'both'
  normalizationStrategy?: 'none' | 'precision' | 'bucket'
}

export class MetadataIndexManager {
  private storage: StorageAdapter
  private config: Required<MetadataIndexConfig>
  private indexCache = new Map<string, MetadataIndexEntry>()
  private dirtyEntries = new Set<string>()
  private isRebuilding = false
  private metadataCache: MetadataIndexCache
  private fieldIndexes = new Map<string, FieldIndexData>()
  private dirtyFields = new Set<string>()
  private lastFlushTime = Date.now()
  private autoFlushThreshold = 10 // Start with 10 for more frequent non-blocking flushes
  
  // Sorted indices for range queries (only for numeric/date fields)
  private sortedIndices = new Map<string, SortedFieldIndex>()
  private numericFields = new Set<string>() // Track which fields are numeric
  
  // Cardinality and field statistics tracking
  private fieldStats = new Map<string, FieldStats>()
  private cardinalityUpdateInterval = 100 // Update cardinality every N operations
  private operationCount = 0
  
  // Smart normalization thresholds
  private readonly HIGH_CARDINALITY_THRESHOLD = 1000
  private readonly TIMESTAMP_PRECISION_MS = 60000 // 1 minute buckets
  private readonly FLOAT_PRECISION = 2 // decimal places
  
  // Type-Field Affinity Tracking for intelligent NLP
  private typeFieldAffinity = new Map<string, Map<string, number>>() // nounType -> field -> count
  private totalEntitiesByType = new Map<string, number>() // nounType -> total count
  
  // Unified cache for coordinated memory management
  private unifiedCache: UnifiedCache

  constructor(storage: StorageAdapter, config: MetadataIndexConfig = {}) {
    this.storage = storage
    this.config = {
      maxIndexSize: config.maxIndexSize ?? 10000,
      rebuildThreshold: config.rebuildThreshold ?? 0.1,
      autoOptimize: config.autoOptimize ?? true,
      indexedFields: config.indexedFields ?? [],
      excludeFields: config.excludeFields ?? ['id', 'createdAt', 'updatedAt', 'embedding', 'vector', 'embeddings', 'vectors']
    }
    
    // Initialize metadata cache with similar config to search cache
    this.metadataCache = new MetadataIndexCache({
      maxAge: 5 * 60 * 1000, // 5 minutes
      maxSize: 500,          // 500 entries (field indexes + value chunks)
      enabled: true
    })
    
    // Get global unified cache for coordinated memory management
    this.unifiedCache = getGlobalCache()
  }

  /**
   * Get index key for field and value
   */
  private getIndexKey(field: string, value: any): string {
    const normalizedValue = this.normalizeValue(value)
    return `${field}:${normalizedValue}`
  }
  
  /**
   * Ensure sorted index exists for a field (for range queries)
   */
  private async ensureSortedIndex(field: string): Promise<void> {
    if (!this.sortedIndices.has(field)) {
      // Try to load from storage first
      const loaded = await this.loadSortedIndex(field)
      if (loaded) {
        this.sortedIndices.set(field, loaded)
      } else {
        // Create new sorted index - NOT dirty since we maintain incrementally
        this.sortedIndices.set(field, {
          values: [],
          isDirty: false,  // Clean by default with incremental updates
          fieldType: 'mixed'
        })
      }
    }
  }
  
  /**
   * Build sorted index for a field from hash index
   */
  private async buildSortedIndex(field: string): Promise<void> {
    const sortedIndex = this.sortedIndices.get(field)
    if (!sortedIndex || !sortedIndex.isDirty) return
    
    // Collect all values for this field from hash index
    const valueMap = new Map<any, Set<string>>()
    
    for (const [key, entry] of this.indexCache.entries()) {
      if (entry.field === field) {
        const existing = valueMap.get(entry.value)
        if (existing) {
          // Merge ID sets
          entry.ids.forEach(id => existing.add(id))
        } else {
          valueMap.set(entry.value, new Set(entry.ids))
        }
      }
    }
    
    // Convert to sorted array
    const sorted = Array.from(valueMap.entries())
    
    // Detect field type and sort accordingly
    if (sorted.length > 0) {
      const sampleValue = sorted[0][0]
      if (typeof sampleValue === 'number') {
        sortedIndex.fieldType = 'number'
        sorted.sort((a, b) => a[0] - b[0])
      } else if (sampleValue instanceof Date) {
        sortedIndex.fieldType = 'date'
        sorted.sort((a, b) => a[0].getTime() - b[0].getTime())
      } else {
        sortedIndex.fieldType = 'string'
        sorted.sort((a, b) => {
          const aVal = String(a[0])
          const bVal = String(b[0])
          return aVal < bVal ? -1 : aVal > bVal ? 1 : 0
        })
      }
    }
    
    sortedIndex.values = sorted
    sortedIndex.isDirty = false
  }
  
  /**
   * Detect field type from value
   */
  private detectFieldType(value: any): 'number' | 'date' | 'string' | 'mixed' {
    if (typeof value === 'number' && !isNaN(value)) return 'number'
    if (value instanceof Date) return 'date'
    return 'string'
  }

  /**
   * Compare two values based on field type for sorting
   */
  private compareValues(a: any, b: any, fieldType: string): number {
    switch (fieldType) {
      case 'number':
        return (a as number) - (b as number)
      case 'date':
        return (a as Date).getTime() - (b as Date).getTime()
      case 'string':
      default:
        const aStr = String(a)
        const bStr = String(b)
        return aStr < bStr ? -1 : aStr > bStr ? 1 : 0
    }
  }

  /**
   * Binary search to find insertion position for a value
   * Returns the index where the value should be inserted to maintain sorted order
   */
  private findInsertPosition(sortedArray: Array<[any, Set<string>]>, value: any, fieldType: string): number {
    if (sortedArray.length === 0) return 0
    
    let left = 0
    let right = sortedArray.length - 1
    
    while (left <= right) {
      const mid = Math.floor((left + right) / 2)
      const midVal = sortedArray[mid][0]
      
      const comparison = this.compareValues(midVal, value, fieldType)
      
      if (comparison < 0) {
        left = mid + 1
      } else if (comparison > 0) {
        right = mid - 1
      } else {
        return mid // Value already exists at this position
      }
    }
    
    return left // Insert position
  }

  /**
   * Incrementally update sorted index when adding an ID
   */
  private updateSortedIndexAdd(field: string, value: any, id: string): void {
    // Ensure sorted index exists
    if (!this.sortedIndices.has(field)) {
      this.sortedIndices.set(field, {
        values: [],
        isDirty: false,
        fieldType: this.detectFieldType(value)
      })
    }
    
    const sortedIndex = this.sortedIndices.get(field)!
    const normalizedValue = this.normalizeValue(value)
    
    // Find where this value should be in the sorted array
    const insertPos = this.findInsertPosition(
      sortedIndex.values, 
      normalizedValue, 
      sortedIndex.fieldType
    )
    
    if (insertPos < sortedIndex.values.length && 
        sortedIndex.values[insertPos][0] === normalizedValue) {
      // Value already exists, just add the ID to the existing Set
      sortedIndex.values[insertPos][1].add(id)
    } else {
      // New value, insert at the correct position
      sortedIndex.values.splice(insertPos, 0, [normalizedValue, new Set([id])])
    }
    
    // Mark as clean since we're maintaining it incrementally
    sortedIndex.isDirty = false
  }

  /**
   * Incrementally update sorted index when removing an ID
   */
  private updateSortedIndexRemove(field: string, value: any, id: string): void {
    const sortedIndex = this.sortedIndices.get(field)
    if (!sortedIndex || sortedIndex.values.length === 0) return
    
    const normalizedValue = this.normalizeValue(value)
    
    // Binary search to find the value
    const pos = this.findInsertPosition(
      sortedIndex.values,
      normalizedValue,
      sortedIndex.fieldType
    )
    
    if (pos < sortedIndex.values.length && 
        sortedIndex.values[pos][0] === normalizedValue) {
      // Remove the ID from the Set
      sortedIndex.values[pos][1].delete(id)
      
      // If no IDs left for this value, remove the entire entry
      if (sortedIndex.values[pos][1].size === 0) {
        sortedIndex.values.splice(pos, 1)
      }
    }
    
    // Keep it clean
    sortedIndex.isDirty = false
  }

  /**
   * Binary search for range start (inclusive or exclusive)
   */
  private binarySearchStart(sorted: Array<[any, Set<string>]>, target: any, inclusive: boolean): number {
    let left = 0
    let right = sorted.length - 1
    let result = sorted.length
    
    while (left <= right) {
      const mid = Math.floor((left + right) / 2)
      const midVal = sorted[mid][0]
      
      if (inclusive ? midVal >= target : midVal > target) {
        result = mid
        right = mid - 1
      } else {
        left = mid + 1
      }
    }
    
    return result
  }
  
  /**
   * Binary search for range end (inclusive or exclusive)
   */
  private binarySearchEnd(sorted: Array<[any, Set<string>]>, target: any, inclusive: boolean): number {
    let left = 0
    let right = sorted.length - 1
    let result = -1
    
    while (left <= right) {
      const mid = Math.floor((left + right) / 2)
      const midVal = sorted[mid][0]
      
      if (inclusive ? midVal <= target : midVal < target) {
        result = mid
        left = mid + 1
      } else {
        right = mid - 1
      }
    }
    
    return result
  }

  /**
   * Update cardinality statistics for a field
   */
  private updateCardinalityStats(field: string, value: any, operation: 'add' | 'remove'): void {
    // Initialize field stats if needed
    if (!this.fieldStats.has(field)) {
      this.fieldStats.set(field, {
        cardinality: {
          uniqueValues: 0,
          totalValues: 0,
          distribution: 'uniform',
          updateFrequency: 0,
          lastAnalyzed: Date.now()
        },
        queryCount: 0,
        rangeQueryCount: 0,
        exactQueryCount: 0,
        avgQueryTime: 0,
        indexType: 'hash'
      })
    }

    const stats = this.fieldStats.get(field)!
    const cardinality = stats.cardinality

    // Track unique values
    const fieldIndexKey = `${field}:${String(value)}`
    const entry = this.indexCache.get(fieldIndexKey)
    
    if (operation === 'add') {
      if (!entry || entry.ids.size === 1) {
        cardinality.uniqueValues++
      }
      cardinality.totalValues++
    } else if (operation === 'remove') {
      if (entry && entry.ids.size === 0) {
        cardinality.uniqueValues--
      }
      cardinality.totalValues = Math.max(0, cardinality.totalValues - 1)
    }

    // Update frequency tracking
    cardinality.updateFrequency++
    
    // Periodically analyze distribution
    if (++this.operationCount % this.cardinalityUpdateInterval === 0) {
      this.analyzeFieldDistribution(field)
    }

    // Determine optimal index type based on cardinality
    this.updateIndexStrategy(field, stats)
  }

  /**
   * Analyze field distribution for optimization
   */
  private analyzeFieldDistribution(field: string): void {
    const stats = this.fieldStats.get(field)
    if (!stats) return

    const cardinality = stats.cardinality
    const ratio = cardinality.uniqueValues / Math.max(1, cardinality.totalValues)

    // Determine distribution type
    if (ratio > 0.9) {
      cardinality.distribution = 'sparse' // High uniqueness (like IDs, timestamps)
    } else if (ratio < 0.1) {
      cardinality.distribution = 'skewed' // Low uniqueness (like status, type)
    } else {
      cardinality.distribution = 'uniform' // Balanced distribution
    }

    cardinality.lastAnalyzed = Date.now()
  }

  /**
   * Update index strategy based on field statistics
   */
  private updateIndexStrategy(field: string, stats: FieldStats): void {
    const isNumeric = this.numericFields.has(field)
    const hasHighCardinality = stats.cardinality.uniqueValues > this.HIGH_CARDINALITY_THRESHOLD
    const hasRangeQueries = stats.rangeQueryCount > stats.exactQueryCount * 0.3

    // Determine optimal index type
    if (isNumeric && hasRangeQueries) {
      stats.indexType = 'both' // Need both hash and sorted
    } else if (hasRangeQueries) {
      stats.indexType = 'sorted'
    } else {
      stats.indexType = 'hash'
    }

    // Determine normalization strategy for high cardinality fields
    if (hasHighCardinality) {
      if (field.toLowerCase().includes('time') || field.toLowerCase().includes('date')) {
        stats.normalizationStrategy = 'bucket' // Time bucketing
      } else if (isNumeric) {
        stats.normalizationStrategy = 'precision' // Reduce float precision
      } else {
        stats.normalizationStrategy = 'none' // Keep as-is for strings
      }
    } else {
      stats.normalizationStrategy = 'none'
    }
  }
  
  /**
   * Get IDs matching a range query
   */
  private async getIdsForRange(
    field: string,
    min?: any,
    max?: any,
    includeMin: boolean = true,
    includeMax: boolean = true
  ): Promise<string[]> {
    // Track range query for field statistics
    if (this.fieldStats.has(field)) {
      const stats = this.fieldStats.get(field)!
      stats.rangeQueryCount++
    }
    
    // Ensure sorted index exists
    await this.ensureSortedIndex(field)
    
    // With incremental updates, we should rarely need to rebuild
    // Only rebuild if it's marked dirty (e.g., after a bulk load or migration)
    let sortedIndex = this.sortedIndices.get(field)
    if (sortedIndex?.isDirty) {
      prodLog.warn(`MetadataIndex: Sorted index for field '${field}' was dirty, rebuilding...`)
      await this.buildSortedIndex(field)
      sortedIndex = this.sortedIndices.get(field)
    }
    
    if (!sortedIndex || sortedIndex.values.length === 0) return []
    
    const sorted = sortedIndex.values
    const resultSet = new Set<string>()
    
    // Find range boundaries
    let start = 0
    let end = sorted.length - 1
    
    if (min !== undefined) {
      start = this.binarySearchStart(sorted, min, includeMin)
    }
    
    if (max !== undefined) {
      end = this.binarySearchEnd(sorted, max, includeMax)
    }
    
    // Collect all IDs in range
    for (let i = start; i <= end && i < sorted.length; i++) {
      const [, ids] = sorted[i]
      ids.forEach(id => resultSet.add(id))
    }
    
    return Array.from(resultSet)
  }

  /**
   * Generate field index filename for filter discovery
   */
  private getFieldIndexFilename(field: string): string {
    return `field_${field}`
  }

  /**
   * Generate value chunk filename for scalable storage
   */
  private getValueChunkFilename(field: string, value: any, chunkIndex: number = 0): string {
    const normalizedValue = this.normalizeValue(value)
    const safeValue = this.makeSafeFilename(normalizedValue)
    return `${field}_${safeValue}_chunk${chunkIndex}`
  }

  /**
   * Make a value safe for use in filenames
   */
  private makeSafeFilename(value: string): string {
    // Replace unsafe characters and limit length
    return value
      .replace(/[^a-zA-Z0-9-_]/g, '_')
      .substring(0, 50)
      .toLowerCase()
  }

  /**
   * Normalize value for consistent indexing with smart optimization
   */
  private normalizeValue(value: any, field?: string): string {
    if (value === null || value === undefined) return '__NULL__'
    if (typeof value === 'boolean') return value ? '__TRUE__' : '__FALSE__'
    
    // Apply smart normalization based on field statistics
    if (field && this.fieldStats.has(field)) {
      const stats = this.fieldStats.get(field)!
      const strategy = stats.normalizationStrategy
      
      if (strategy === 'bucket' && typeof value === 'number') {
        // Time bucketing for timestamps
        if (field.toLowerCase().includes('time') || field.toLowerCase().includes('date')) {
          const bucketSize = this.TIMESTAMP_PRECISION_MS
          const bucketed = Math.floor(value / bucketSize) * bucketSize
          return bucketed.toString()
        }
      } else if (strategy === 'precision' && typeof value === 'number') {
        // Reduce float precision for high cardinality numeric fields
        const rounded = Math.round(value * Math.pow(10, this.FLOAT_PRECISION)) / Math.pow(10, this.FLOAT_PRECISION)
        return rounded.toString()
      }
    }
    
    // Default normalization
    if (typeof value === 'number') return value.toString()
    if (Array.isArray(value)) {
      const joined = value.map(v => this.normalizeValue(v, field)).join(',')
      // Hash very long array values to avoid filesystem limits
      if (joined.length > 100) {
        return this.hashValue(joined)
      }
      return joined
    }
    const stringValue = String(value).toLowerCase().trim()
    // Hash very long string values to avoid filesystem limits
    if (stringValue.length > 100) {
      return this.hashValue(stringValue)
    }
    return stringValue
  }

  /**
   * Create a short hash for long values to avoid filesystem filename limits
   */
  private hashValue(value: string): string {
    // Simple hash function to create shorter keys
    let hash = 0
    for (let i = 0; i < value.length; i++) {
      const char = value.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash // Convert to 32-bit integer
    }
    return `__HASH_${Math.abs(hash).toString(36)}`
  }

  /**
   * Check if field should be indexed
   */
  private shouldIndexField(field: string): boolean {
    if (this.config.excludeFields.includes(field)) return false
    if (this.config.indexedFields.length > 0) {
      return this.config.indexedFields.includes(field)
    }
    return true
  }

  /**
   * Extract indexable field-value pairs from metadata
   */
  private extractIndexableFields(metadata: any): Array<{ field: string, value: any }> {
    const fields: Array<{ field: string, value: any }> = []
    
    const extract = (obj: any, prefix = ''): void => {
      for (const [key, value] of Object.entries(obj)) {
        const fullKey = prefix ? `${prefix}.${key}` : key
        
        if (!this.shouldIndexField(fullKey)) continue
        
        if (value && typeof value === 'object' && !Array.isArray(value)) {
          // Recurse into nested objects
          extract(value, fullKey)
        } else {
          // Index this field
          fields.push({ field: fullKey, value })
          
          // If it's an array, also index each element
          if (Array.isArray(value)) {
            for (const item of value) {
              fields.push({ field: fullKey, value: item })
            }
          }
        }
      }
    }
    
    if (metadata && typeof metadata === 'object') {
      extract(metadata)
    }
    
    return fields
  }

  /**
   * Add item to metadata indexes
   */
  async addToIndex(id: string, metadata: any, skipFlush: boolean = false): Promise<void> {
    const fields = this.extractIndexableFields(metadata)
    
    // Sort fields to process 'noun' field first for type-field affinity tracking
    fields.sort((a, b) => {
      if (a.field === 'noun') return -1
      if (b.field === 'noun') return 1
      return 0
    })
    
    // Track which fields we're updating for incremental sorted index maintenance
    const updatedFields = new Set<string>()
    
    for (let i = 0; i < fields.length; i++) {
      const { field, value } = fields[i]
      const key = this.getIndexKey(field, value)
      
      // Get or create index entry
      let entry = this.indexCache.get(key)
      if (!entry) {
        const loadedEntry = await this.loadIndexEntry(key)
        entry = loadedEntry ?? {
          field,
          value: this.normalizeValue(value),
          ids: new Set<string>(),
          lastUpdated: Date.now()
        }
        this.indexCache.set(key, entry)
      }
      
      // Add ID to entry
      const wasNew = entry.ids.size === 0
      entry.ids.add(id)
      entry.lastUpdated = Date.now()
      this.dirtyEntries.add(key)
      
      // Update cardinality statistics
      if (wasNew) {
        this.updateCardinalityStats(field, value, 'add')
      }
      
      // Track type-field affinity for intelligent NLP
      this.updateTypeFieldAffinity(id, field, value, 'add')
      
      // Incrementally update sorted index for this field
      if (!updatedFields.has(field)) {
        this.updateSortedIndexAdd(field, value, id)
        updatedFields.add(field)
      } else {
        // Multiple values for same field - still update
        this.updateSortedIndexAdd(field, value, id)
      }
      
      // Update field index
      await this.updateFieldIndex(field, value, 1)
      
      // Yield to event loop every 5 fields to prevent blocking
      if (i % 5 === 4) {
        await this.yieldToEventLoop()
      }
    }
    
    // Adaptive auto-flush based on usage patterns
    if (!skipFlush) {
      const timeSinceLastFlush = Date.now() - this.lastFlushTime
      const shouldAutoFlush = 
        this.dirtyEntries.size >= this.autoFlushThreshold || // Size threshold
        (this.dirtyEntries.size > 10 && timeSinceLastFlush > 5000) // Time threshold (5 seconds)
      
      if (shouldAutoFlush) {
        const startTime = Date.now()
        await this.flush()
        const flushTime = Date.now() - startTime
        
        // Adapt threshold based on flush performance
        if (flushTime < 50) {
          // Fast flush, can handle more entries
          this.autoFlushThreshold = Math.min(200, this.autoFlushThreshold * 1.2)
        } else if (flushTime > 200) {
          // Slow flush, reduce batch size
          this.autoFlushThreshold = Math.max(20, this.autoFlushThreshold * 0.8)
        }
        
        // Yield to event loop after flush to prevent blocking
        await this.yieldToEventLoop()
      }
    }
    
    // Invalidate cache for these fields
    for (const { field } of fields) {
      this.metadataCache.invalidatePattern(`field_values_${field}`)
    }
  }

  /**
   * Update field index with value count
   */
  private async updateFieldIndex(field: string, value: any, delta: number): Promise<void> {
    let fieldIndex = this.fieldIndexes.get(field)
    
    if (!fieldIndex) {
      // Load from storage if not in memory
      fieldIndex = await this.loadFieldIndex(field) ?? {
        values: {},
        lastUpdated: Date.now()
      }
      this.fieldIndexes.set(field, fieldIndex)
    }
    
    const normalizedValue = this.normalizeValue(value)
    fieldIndex.values[normalizedValue] = (fieldIndex.values[normalizedValue] || 0) + delta
    
    // Remove if count drops to 0
    if (fieldIndex.values[normalizedValue] <= 0) {
      delete fieldIndex.values[normalizedValue]
    }
    
    fieldIndex.lastUpdated = Date.now()
    this.dirtyFields.add(field)
  }

  /**
   * Remove item from metadata indexes
   */
  async removeFromIndex(id: string, metadata?: any): Promise<void> {
    if (metadata) {
      // Remove from specific field indexes
      const fields = this.extractIndexableFields(metadata)
      
      for (const { field, value } of fields) {
        const key = this.getIndexKey(field, value)
        let entry = this.indexCache.get(key)
        if (!entry) {
          const loadedEntry = await this.loadIndexEntry(key)
          entry = loadedEntry ?? undefined
        }
        
        if (entry) {
          const hadId = entry.ids.has(id)
          entry.ids.delete(id)
          entry.lastUpdated = Date.now()
          this.dirtyEntries.add(key)
          
          // Update cardinality statistics
          if (hadId && entry.ids.size === 0) {
            this.updateCardinalityStats(field, value, 'remove')
          }
          
          // Track type-field affinity for intelligent NLP
          if (hadId) {
            this.updateTypeFieldAffinity(id, field, value, 'remove')
          }
          
          // Incrementally update sorted index when removing
          this.updateSortedIndexRemove(field, value, id)
          
          // Update field index
          await this.updateFieldIndex(field, value, -1)
          
          // If no IDs left, mark for cleanup
          if (entry.ids.size === 0) {
            this.indexCache.delete(key)
            await this.deleteIndexEntry(key)
          }
        }
        
        // Invalidate cache
        this.metadataCache.invalidatePattern(`field_values_${field}`)
      }
    } else {
      // Remove from all indexes (slower, requires scanning)
      for (const [key, entry] of this.indexCache.entries()) {
        if (entry.ids.has(id)) {
          entry.ids.delete(id)
          entry.lastUpdated = Date.now()
          this.dirtyEntries.add(key)
          
          // Incrementally update sorted index
          this.updateSortedIndexRemove(entry.field, entry.value, id)
          
          if (entry.ids.size === 0) {
            this.indexCache.delete(key)
            await this.deleteIndexEntry(key)
          }
        }
      }
    }
  }

  /**
   * Get all IDs in the index
   */
  async getAllIds(): Promise<string[]> {
    // Collect all unique IDs from all index entries
    const allIds = new Set<string>()
    
    // First, add all IDs from the in-memory cache
    for (const entry of this.indexCache.values()) {
      entry.ids.forEach(id => allIds.add(id))
    }
    
    // If storage has a method to get all nouns, use it as the source of truth
    // This ensures we include items that might not be indexed yet
    if (this.storage && typeof (this.storage as any).getNouns === 'function') {
      try {
        const result = await (this.storage as any).getNouns({ 
          pagination: { limit: 100000 } 
        })
        if (result && result.items) {
          result.items.forEach((item: any) => {
            if (item.id) allIds.add(item.id)
          })
        }
      } catch (e) {
        // Fall back to using only indexed IDs
      }
    }
    
    return Array.from(allIds)
  }

  /**
   * Get IDs for a specific field-value combination with caching
   */
  async getIds(field: string, value: any): Promise<string[]> {
    // Track exact query for field statistics
    if (this.fieldStats.has(field)) {
      const stats = this.fieldStats.get(field)!
      stats.exactQueryCount++
    }
    
    const key = this.getIndexKey(field, value)
    
    // Check metadata cache first
    const cacheKey = `ids_${key}`
    const cachedIds = this.metadataCache.get(cacheKey)
    if (cachedIds) {
      return cachedIds
    }
    
    // Try in-memory cache
    let entry = this.indexCache.get(key)
    
    // Load from storage if not cached
    if (!entry) {
      const loadedEntry = await this.loadIndexEntry(key)
      if (loadedEntry) {
        entry = loadedEntry
        this.indexCache.set(key, entry)
      }
    }
    
    const ids = entry ? Array.from(entry.ids) : []
    
    // Cache the result
    this.metadataCache.set(cacheKey, ids)
    
    return ids
  }

  /**
   * Get all available values for a field (for filter discovery)
   */
  async getFilterValues(field: string): Promise<string[]> {
    // Check cache first
    const cacheKey = `field_values_${field}`
    const cachedValues = this.metadataCache.get(cacheKey)
    if (cachedValues) {
      return cachedValues
    }
    
    // Check in-memory field indexes first
    let fieldIndex = this.fieldIndexes.get(field)
    
    // If not in memory, load from storage
    if (!fieldIndex) {
      const loaded = await this.loadFieldIndex(field)
      if (loaded) {
        fieldIndex = loaded
        this.fieldIndexes.set(field, loaded)
      }
    }
    
    if (!fieldIndex) {
      return []
    }
    
    const values = Object.keys(fieldIndex.values)
    
    // Cache the result
    this.metadataCache.set(cacheKey, values)
    
    return values
  }

  /**
   * Get all indexed fields (for filter discovery)
   */
  async getFilterFields(): Promise<string[]> {
    // Check cache first
    const cacheKey = 'all_filter_fields'
    const cachedFields = this.metadataCache.get(cacheKey)
    if (cachedFields) {
      return cachedFields
    }
    
    // Get fields from in-memory indexes and storage
    const fields = new Set<string>(this.fieldIndexes.keys())
    
    // Also scan storage for persisted field indexes (in case not loaded)
    // This would require a new storage method to list field indexes
    // For now, just use in-memory fields
    
    const fieldsArray = Array.from(fields)
    
    // Cache the result
    this.metadataCache.set(cacheKey, fieldsArray)
    
    return fieldsArray
  }

  /**
   * Convert Brainy Field Operator filter to simple field-value criteria for indexing
   */
  private convertFilterToCriteria(filter: any): Array<{ field: string, values: any[] }> {
    const criteria: Array<{ field: string, values: any[] }> = []
    
    if (!filter || typeof filter !== 'object') {
      return criteria
    }
    
    for (const [key, value] of Object.entries(filter)) {
      // Skip logical operators for now - handle them separately
      if (key === 'allOf' || key === 'anyOf' || key === 'not') continue
      
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        // Handle Brainy Field Operators
        for (const [op, operand] of Object.entries(value)) {
          switch (op) {
            case 'oneOf':
              if (Array.isArray(operand)) {
                criteria.push({ field: key, values: operand })
              }
              break
            case 'equals':
            case 'is':
            case 'eq':
              criteria.push({ field: key, values: [operand] })
              break
            case 'contains':
              // For contains, the operand is the value we're looking for in an array field
              criteria.push({ field: key, values: [operand] })
              break
            case 'greaterThan':
            case 'lessThan':
            case 'greaterEqual':
            case 'lessEqual':
            case 'between':
              // Range queries will be handled separately
              // Sorted index will be created/loaded when needed in getIdsForRange
              break
            default:
              break
          }
        }
      } else {
        // Direct value or array
        const values = Array.isArray(value) ? value : [value]
        criteria.push({ field: key, values })
      }
    }
    
    return criteria
  }

  /**
   * Get IDs matching Brainy Field Operator metadata filter using indexes where possible
   */
  async getIdsForFilter(filter: any): Promise<string[]> {
    if (!filter || Object.keys(filter).length === 0) {
      return []
    }
    
    // Handle logical operators
    if (filter.allOf && Array.isArray(filter.allOf)) {
      // For allOf, we need intersection of all sub-filters
      const allIds: string[][] = []
      for (const subFilter of filter.allOf) {
        const subIds = await this.getIdsForFilter(subFilter)
        allIds.push(subIds)
      }
      
      if (allIds.length === 0) return []
      if (allIds.length === 1) return allIds[0]
      
      // Intersection of all sets
      return allIds.reduce((intersection, currentSet) => 
        intersection.filter(id => currentSet.includes(id))
      )
    }
    
    if (filter.anyOf && Array.isArray(filter.anyOf)) {
      // For anyOf, we need union of all sub-filters
      const unionIds = new Set<string>()
      for (const subFilter of filter.anyOf) {
        const subIds = await this.getIdsForFilter(subFilter)
        subIds.forEach(id => unionIds.add(id))
      }
      return Array.from(unionIds)
    }
    
    // Process field filters with range support
    const idSets: string[][] = []
    
    for (const [field, condition] of Object.entries(filter)) {
      // Skip logical operators
      if (field === 'allOf' || field === 'anyOf' || field === 'not') continue
      
      let fieldResults: string[] = []
      
      if (condition && typeof condition === 'object' && !Array.isArray(condition)) {
        // Handle Brainy Field Operators
        for (const [op, operand] of Object.entries(condition)) {
          switch (op) {
            // Exact match operators
            case 'equals':
            case 'is':
            case 'eq':
              fieldResults = await this.getIds(field, operand)
              break
            
            // Multiple value operators
            case 'oneOf':
            case 'in':
              if (Array.isArray(operand)) {
                const unionIds = new Set<string>()
                for (const value of operand) {
                  const ids = await this.getIds(field, value)
                  ids.forEach(id => unionIds.add(id))
                }
                fieldResults = Array.from(unionIds)
              }
              break
            
            // Range operators
            case 'greaterThan':
            case 'gt':
              fieldResults = await this.getIdsForRange(field, operand, undefined, false, true)
              break
            
            case 'greaterEqual':
            case 'gte':
            case 'greaterThanOrEqual':
              fieldResults = await this.getIdsForRange(field, operand, undefined, true, true)
              break
            
            case 'lessThan':
            case 'lt':
              fieldResults = await this.getIdsForRange(field, undefined, operand, true, false)
              break
            
            case 'lessEqual':
            case 'lte':
            case 'lessThanOrEqual':
              fieldResults = await this.getIdsForRange(field, undefined, operand, true, true)
              break
            
            case 'between':
              if (Array.isArray(operand) && operand.length === 2) {
                fieldResults = await this.getIdsForRange(field, operand[0], operand[1], true, true)
              }
              break
            
            // Array contains operator
            case 'contains':
              fieldResults = await this.getIds(field, operand)
              break
            
            // Existence operator
            case 'exists':
              if (operand) {
                // Get all IDs that have this field (any value)
                const allIds = new Set<string>()
                for (const [key, entry] of this.indexCache.entries()) {
                  if (entry.field === field) {
                    entry.ids.forEach(id => allIds.add(id))
                  }
                }
                fieldResults = Array.from(allIds)
              }
              break
            
            // Negation operators
            case 'notEquals':
            case 'isNot':
            case 'ne':
              // For notEquals, we need all IDs EXCEPT those matching the value
              // This is especially important for soft delete: deleted !== true
              // should include items without a deleted field
              
              // First, get all IDs in the database
              const allItemIds = await this.getAllIds()
              
              // Then get IDs that match the value we want to exclude
              const excludeIds = await this.getIds(field, operand)
              const excludeSet = new Set(excludeIds)
              
              // Return all IDs except those to exclude
              fieldResults = allItemIds.filter(id => !excludeSet.has(id))
              break
          }
        }
      } else {
        // Direct value match (shorthand for equals)
        fieldResults = await this.getIds(field, condition)
      }
      
      if (fieldResults.length > 0) {
        idSets.push(fieldResults)
      } else {
        // If any field has no matches, intersection will be empty
        return []
      }
    }
    
    if (idSets.length === 0) return []
    if (idSets.length === 1) return idSets[0]
    
    // Intersection of all field criteria (implicit AND)
    return idSets.reduce((intersection, currentSet) => 
      intersection.filter(id => currentSet.includes(id))
    )
  }
  
  /**
   * DEPRECATED - Old implementation for backward compatibility
   */
  private async getIdsForFilterOld(filter: any): Promise<string[]> {
    if (!filter || Object.keys(filter).length === 0) {
      return []
    }
    
    // Handle logical operators
    if (filter.allOf && Array.isArray(filter.allOf)) {
      // For allOf, we need intersection of all sub-filters
      const allIds: string[][] = []
      for (const subFilter of filter.allOf) {
        const subIds = await this.getIdsForFilter(subFilter)
        allIds.push(subIds)
      }
      
      if (allIds.length === 0) return []
      if (allIds.length === 1) return allIds[0]
      
      // Intersection of all sets
      return allIds.reduce((intersection, currentSet) => 
        intersection.filter(id => currentSet.includes(id))
      )
    }
    
    if (filter.anyOf && Array.isArray(filter.anyOf)) {
      // For anyOf, we need union of all sub-filters
      const unionIds = new Set<string>()
      for (const subFilter of filter.anyOf) {
        const subIds = await this.getIdsForFilter(subFilter)
        subIds.forEach(id => unionIds.add(id))
      }
      return Array.from(unionIds)
    }
    
    // Handle regular field filters
    const criteria = this.convertFilterToCriteria(filter)
    const idSets: string[][] = []
    
    for (const { field, values } of criteria) {
      const unionIds = new Set<string>()
      for (const value of values) {
        const ids = await this.getIds(field, value)
        ids.forEach(id => unionIds.add(id))
      }
      idSets.push(Array.from(unionIds))
    }
    
    if (idSets.length === 0) return []
    if (idSets.length === 1) return idSets[0]
    
    // Intersection of all field criteria (implicit $and)
    return idSets.reduce((intersection, currentSet) => 
      intersection.filter(id => currentSet.includes(id))
    )
  }

  /**
   * Get IDs matching multiple criteria (intersection) - LEGACY METHOD
   * @deprecated Use getIdsForFilter instead
   */
  async getIdsForCriteria(criteria: Record<string, any>): Promise<string[]> {
    return this.getIdsForFilter(criteria)
  }

  /**
   * Flush dirty entries to storage (non-blocking version)
   */
  async flush(): Promise<void> {
    // Check if we have anything to flush (including sorted indices)
    const hasDirtySortedIndices = Array.from(this.sortedIndices.values()).some(idx => idx.isDirty)
    
    if (this.dirtyEntries.size === 0 && this.dirtyFields.size === 0 && !hasDirtySortedIndices) {
      return // Nothing to flush
    }
    
    // Process in smaller batches to avoid blocking
    const BATCH_SIZE = 20
    const allPromises: Promise<void>[] = []
    
    // Flush value entries in batches
    const dirtyEntriesArray = Array.from(this.dirtyEntries)
    for (let i = 0; i < dirtyEntriesArray.length; i += BATCH_SIZE) {
      const batch = dirtyEntriesArray.slice(i, i + BATCH_SIZE)
      const batchPromises = batch.map(key => {
        const entry = this.indexCache.get(key)
        return entry ? this.saveIndexEntry(key, entry) : Promise.resolve()
      })
      allPromises.push(...batchPromises)
      
      // Yield to event loop between batches
      if (i + BATCH_SIZE < dirtyEntriesArray.length) {
        await this.yieldToEventLoop()
      }
    }
    
    // Flush field indexes in batches  
    const dirtyFieldsArray = Array.from(this.dirtyFields)
    for (let i = 0; i < dirtyFieldsArray.length; i += BATCH_SIZE) {
      const batch = dirtyFieldsArray.slice(i, i + BATCH_SIZE)
      const batchPromises = batch.map(field => {
        const fieldIndex = this.fieldIndexes.get(field)
        return fieldIndex ? this.saveFieldIndex(field, fieldIndex) : Promise.resolve()
      })
      allPromises.push(...batchPromises)
      
      // Yield to event loop between batches
      if (i + BATCH_SIZE < dirtyFieldsArray.length) {
        await this.yieldToEventLoop()
      }
    }
    
    // Flush sorted indices (for range queries)
    for (const [field, sortedIndex] of this.sortedIndices.entries()) {
      if (sortedIndex.isDirty) {
        allPromises.push(this.saveSortedIndex(field, sortedIndex))
      }
    }
    
    // Wait for all operations to complete
    await Promise.all(allPromises)
    
    this.dirtyEntries.clear()
    this.dirtyFields.clear()
    this.lastFlushTime = Date.now()
  }
  
  /**
   * Yield control back to the Node.js event loop
   * Prevents blocking during long-running operations
   */
  private async yieldToEventLoop(): Promise<void> {
    return new Promise(resolve => setImmediate(resolve))
  }

  /**
   * Load field index from storage
   */
  private async loadFieldIndex(field: string): Promise<FieldIndexData | null> {
    const filename = this.getFieldIndexFilename(field)
    const unifiedKey = `metadata:field:${filename}`
    
    // Check unified cache first with loader function
    return await this.unifiedCache.get(unifiedKey, async () => {
      try {
        const cacheKey = `field_index_${filename}`
        
        // Check old cache for migration
        const cached = this.metadataCache.get(cacheKey)
        if (cached) {
          // Add to unified cache
          const size = JSON.stringify(cached).length
          this.unifiedCache.set(unifiedKey, cached, 'metadata', size, 1) // Low rebuild cost
          return cached
        }
        
        // Load from storage
        const indexId = `__metadata_field_index__${filename}`
        const data = await this.storage.getMetadata(indexId)
        
        if (data) {
          const fieldIndex = {
            values: data.values || {},
            lastUpdated: data.lastUpdated || Date.now()
          }
          
          // Add to unified cache
          const size = JSON.stringify(fieldIndex).length
          this.unifiedCache.set(unifiedKey, fieldIndex, 'metadata', size, 1)
          
          // Also keep in old cache for now (transition period)
          this.metadataCache.set(cacheKey, fieldIndex)
          
          return fieldIndex
        }
      } catch (error) {
        // Field index doesn't exist yet
      }
      return null
    })
  }

  /**
   * Save field index to storage
   */
  private async saveFieldIndex(field: string, fieldIndex: FieldIndexData): Promise<void> {
    const filename = this.getFieldIndexFilename(field)
    const indexId = `__metadata_field_index__${filename}`
    const unifiedKey = `metadata:field:${filename}`
    
    await this.storage.saveMetadata(indexId, {
      values: fieldIndex.values,
      lastUpdated: fieldIndex.lastUpdated
    })
    
    // Update unified cache
    const size = JSON.stringify(fieldIndex).length
    this.unifiedCache.set(unifiedKey, fieldIndex, 'metadata', size, 1)
    
    // Invalidate old cache
    this.metadataCache.invalidatePattern(`field_index_${filename}`)
  }
  
  /**
   * Save sorted index to storage for range queries
   */
  private async saveSortedIndex(field: string, sortedIndex: SortedFieldIndex): Promise<void> {
    const filename = `sorted_${field}`
    const indexId = `__metadata_sorted_index__${filename}`
    const unifiedKey = `metadata:sorted:${field}`
    
    // Convert Set to Array for serialization
    const serializable = {
      values: sortedIndex.values.map(([value, ids]) => [value, Array.from(ids)]),
      fieldType: sortedIndex.fieldType,
      lastUpdated: Date.now()
    }
    
    await this.storage.saveMetadata(indexId, serializable)
    
    // Mark as clean
    sortedIndex.isDirty = false
    
    // Update unified cache (sorted indices are expensive to rebuild)
    const size = JSON.stringify(serializable).length
    this.unifiedCache.set(unifiedKey, sortedIndex, 'metadata', size, 100) // Higher rebuild cost
  }
  
  /**
   * Load sorted index from storage
   */
  private async loadSortedIndex(field: string): Promise<SortedFieldIndex | null> {
    const filename = `sorted_${field}`
    const indexId = `__metadata_sorted_index__${filename}`
    const unifiedKey = `metadata:sorted:${field}`
    
    // Check unified cache first
    const cached = await this.unifiedCache.get(unifiedKey, async () => {
      try {
        const data = await this.storage.getMetadata(indexId)
        if (data) {
          // Convert Arrays back to Sets
          const sortedIndex: SortedFieldIndex = {
            values: data.values.map(([value, ids]: [any, string[]]) => [value, new Set(ids)]),
            fieldType: data.fieldType || 'mixed',
            isDirty: false
          }
          
          // Add to unified cache
          const size = JSON.stringify(data).length
          this.unifiedCache.set(unifiedKey, sortedIndex, 'metadata', size, 100)
          
          return sortedIndex
        }
      } catch (error) {
        // Sorted index doesn't exist yet
      }
      return null
    })
    
    return cached
  }

  /**
   * Get index statistics
   */
  async getStats(): Promise<MetadataIndexStats> {
    const fields = new Set<string>()
    let totalEntries = 0
    let totalIds = 0
    
    for (const entry of this.indexCache.values()) {
      fields.add(entry.field)
      totalEntries++
      totalIds += entry.ids.size
    }
    
    return {
      totalEntries,
      totalIds,
      fieldsIndexed: Array.from(fields),
      lastRebuild: Date.now(),
      indexSize: totalEntries * 100 // rough estimate
    }
  }

  /**
   * Rebuild entire index from scratch using pagination
   * Non-blocking version that yields control back to event loop
   */
  async rebuild(): Promise<void> {
    if (this.isRebuilding) return
    
    this.isRebuilding = true
    try {
      prodLog.info('🔄 Starting non-blocking metadata index rebuild with batch processing to prevent socket exhaustion...')
    prodLog.info(`📊 Storage adapter: ${this.storage.constructor.name}`)
    prodLog.info(`🔧 Batch processing available: ${!!this.storage.getMetadataBatch}`)
      
      // Clear existing indexes
      this.indexCache.clear()
      this.dirtyEntries.clear()
      this.fieldIndexes.clear()
      this.dirtyFields.clear()
      
      // Rebuild noun metadata indexes using pagination
      let nounOffset = 0
      const nounLimit = 25 // Even smaller batches during initialization to prevent socket exhaustion
      let hasMoreNouns = true
      let totalNounsProcessed = 0
      let consecutiveEmptyBatches = 0
      const MAX_ITERATIONS = 10000 // Safety limit to prevent infinite loops
      let iterations = 0

      while (hasMoreNouns && iterations < MAX_ITERATIONS) {
        iterations++
        const result = await this.storage.getNouns({
          pagination: { offset: nounOffset, limit: nounLimit }
        })

        // CRITICAL SAFETY CHECK: Prevent infinite loop on empty results
        if (result.items.length === 0) {
          consecutiveEmptyBatches++
          if (consecutiveEmptyBatches >= 3) {
            prodLog.warn('⚠️ Breaking metadata rebuild loop: received 3 consecutive empty batches')
            break
          }
          // If hasMore is true but items are empty, it's likely a bug
          if (result.hasMore) {
            prodLog.warn(`⚠️ Storage returned empty items but hasMore=true at offset ${nounOffset}`)
            hasMoreNouns = false // Force exit
            break
          }
        } else {
          consecutiveEmptyBatches = 0 // Reset counter on non-empty batch
        }

        // CRITICAL FIX: Use batch metadata reading to prevent socket exhaustion
        const nounIds = result.items.map(noun => noun.id)
        
        let metadataBatch: Map<string, any>
        if (this.storage.getMetadataBatch) {
          // Use batch reading if available (prevents socket exhaustion)
          prodLog.info(`📦 Processing metadata batch ${Math.floor(totalNounsProcessed / nounLimit) + 1} (${nounIds.length} items)...`)
          metadataBatch = await this.storage.getMetadataBatch(nounIds)
          const successRate = ((metadataBatch.size / nounIds.length) * 100).toFixed(1)
          prodLog.info(`✅ Batch loaded ${metadataBatch.size}/${nounIds.length} metadata objects (${successRate}% success)`)
        } else {
          // Fallback to individual calls with strict concurrency control
          prodLog.warn(`⚠️  FALLBACK: Storage adapter missing getMetadataBatch - using individual calls with concurrency limit`)
          metadataBatch = new Map()
          const CONCURRENCY_LIMIT = 3 // Very conservative limit
          
          for (let i = 0; i < nounIds.length; i += CONCURRENCY_LIMIT) {
            const batch = nounIds.slice(i, i + CONCURRENCY_LIMIT)
            const batchPromises = batch.map(async (id) => {
              try {
                const metadata = await this.storage.getMetadata(id)
                return { id, metadata }
              } catch (error) {
                prodLog.debug(`Failed to read metadata for ${id}:`, error)
                return { id, metadata: null }
              }
            })
            
            const batchResults = await Promise.all(batchPromises)
            for (const { id, metadata } of batchResults) {
              if (metadata) {
                metadataBatch.set(id, metadata)
              }
            }
            
            // Yield between batches to prevent socket exhaustion
            await this.yieldToEventLoop()
          }
        }
        
        // Process the metadata batch
        for (const noun of result.items) {
          const metadata = metadataBatch.get(noun.id)
          if (metadata) {
            // Skip flush during rebuild for performance
            await this.addToIndex(noun.id, metadata, true)
          }
        }
        
        // Yield after processing the entire batch
        await this.yieldToEventLoop()
        
        totalNounsProcessed += result.items.length
        hasMoreNouns = result.hasMore
        nounOffset += nounLimit
        
        // Progress logging and event loop yield after each batch
        if (totalNounsProcessed % 100 === 0 || !hasMoreNouns) {
          prodLog.debug(`📊 Indexed ${totalNounsProcessed} nouns...`)
        }
        await this.yieldToEventLoop()
      }
      
      // Rebuild verb metadata indexes using pagination
      let verbOffset = 0
      const verbLimit = 25 // Even smaller batches during initialization to prevent socket exhaustion
      let hasMoreVerbs = true
      let totalVerbsProcessed = 0
      let consecutiveEmptyVerbBatches = 0
      let verbIterations = 0

      while (hasMoreVerbs && verbIterations < MAX_ITERATIONS) {
        verbIterations++
        const result = await this.storage.getVerbs({
          pagination: { offset: verbOffset, limit: verbLimit }
        })

        // CRITICAL SAFETY CHECK: Prevent infinite loop on empty results
        if (result.items.length === 0) {
          consecutiveEmptyVerbBatches++
          if (consecutiveEmptyVerbBatches >= 3) {
            prodLog.warn('⚠️ Breaking verb metadata rebuild loop: received 3 consecutive empty batches')
            break
          }
          // If hasMore is true but items are empty, it's likely a bug
          if (result.hasMore) {
            prodLog.warn(`⚠️ Storage returned empty verb items but hasMore=true at offset ${verbOffset}`)
            hasMoreVerbs = false // Force exit
            break
          }
        } else {
          consecutiveEmptyVerbBatches = 0 // Reset counter on non-empty batch
        }

        // CRITICAL FIX: Use batch verb metadata reading to prevent socket exhaustion
        const verbIds = result.items.map(verb => verb.id)
        
        let verbMetadataBatch: Map<string, any>
        if ((this.storage as any).getVerbMetadataBatch) {
          // Use batch reading if available (prevents socket exhaustion)
          verbMetadataBatch = await (this.storage as any).getVerbMetadataBatch(verbIds)
          prodLog.debug(`📦 Batch loaded ${verbMetadataBatch.size}/${verbIds.length} verb metadata objects`)
        } else {
          // Fallback to individual calls with strict concurrency control
          verbMetadataBatch = new Map()
          const CONCURRENCY_LIMIT = 3 // Very conservative limit to prevent socket exhaustion
          
          for (let i = 0; i < verbIds.length; i += CONCURRENCY_LIMIT) {
            const batch = verbIds.slice(i, i + CONCURRENCY_LIMIT)
            const batchPromises = batch.map(async (id) => {
              try {
                const metadata = await this.storage.getVerbMetadata(id)
                return { id, metadata }
              } catch (error) {
                prodLog.debug(`Failed to read verb metadata for ${id}:`, error)
                return { id, metadata: null }
              }
            })
            
            const batchResults = await Promise.all(batchPromises)
            for (const { id, metadata } of batchResults) {
              if (metadata) {
                verbMetadataBatch.set(id, metadata)
              }
            }
            
            // Yield between batches to prevent socket exhaustion
            await this.yieldToEventLoop()
          }
        }
        
        // Process the verb metadata batch
        for (const verb of result.items) {
          const metadata = verbMetadataBatch.get(verb.id)
          if (metadata) {
            // Skip flush during rebuild for performance
            await this.addToIndex(verb.id, metadata, true)
          }
        }
        
        // Yield after processing the entire batch
        await this.yieldToEventLoop()
        
        totalVerbsProcessed += result.items.length
        hasMoreVerbs = result.hasMore
        verbOffset += verbLimit
        
        // Progress logging and event loop yield after each batch
        if (totalVerbsProcessed % 100 === 0 || !hasMoreVerbs) {
          prodLog.debug(`🔗 Indexed ${totalVerbsProcessed} verbs...`)
        }
        await this.yieldToEventLoop()
      }
      
      // Check if we hit iteration limits
      if (iterations >= MAX_ITERATIONS) {
        prodLog.error(`❌ Metadata noun rebuild hit maximum iteration limit (${MAX_ITERATIONS}). This indicates a bug in storage pagination.`)
      }
      if (verbIterations >= MAX_ITERATIONS) {
        prodLog.error(`❌ Metadata verb rebuild hit maximum iteration limit (${MAX_ITERATIONS}). This indicates a bug in storage pagination.`)
      }

      // Flush to storage with final yield
      prodLog.debug('💾 Flushing metadata index to storage...')
      await this.flush()
      await this.yieldToEventLoop()

      prodLog.info(`✅ Metadata index rebuild completed! Processed ${totalNounsProcessed} nouns and ${totalVerbsProcessed} verbs`)
      prodLog.info(`🎯 Initial indexing may show minor socket timeouts - this is expected and doesn't affect data processing`)
      
    } finally {
      this.isRebuilding = false
    }
  }

  /**
   * Load index entry from storage using safe filenames
   */
  private async loadIndexEntry(key: string): Promise<MetadataIndexEntry | null> {
    const unifiedKey = `metadata:entry:${key}`
    
    // Use unified cache with loader function
    return await this.unifiedCache.get(unifiedKey, async () => {
      try {
        // Extract field and value from key
        const [field, value] = key.split(':', 2)
        const filename = this.getValueChunkFilename(field, value)
        
        // Load from metadata indexes directory with safe filename
        const indexId = `__metadata_index__${filename}`
        const data = await this.storage.getMetadata(indexId)
        if (data) {
          const entry = {
            field: data.field,
            value: data.value,
            ids: new Set(data.ids || []),
            lastUpdated: data.lastUpdated || Date.now()
          }
          
          // Add to unified cache (metadata entries are cheap to rebuild)
          const size = JSON.stringify(Array.from(entry.ids)).length + 100
          this.unifiedCache.set(unifiedKey, entry, 'metadata', size, 1)
          
          return entry
        }
      } catch (error) {
        // Index entry doesn't exist yet
      }
      return null
    })
  }

  /**
   * Save index entry to storage using safe filenames
   */
  private async saveIndexEntry(key: string, entry: MetadataIndexEntry): Promise<void> {
    const unifiedKey = `metadata:entry:${key}`
    const data = {
      field: entry.field,
      value: entry.value,
      ids: Array.from(entry.ids),
      lastUpdated: entry.lastUpdated
    }
    
    // Extract field and value from key for safe filename generation
    const [field, value] = key.split(':', 2)
    const filename = this.getValueChunkFilename(field, value)
    
    // Store metadata indexes with safe filename
    const indexId = `__metadata_index__${filename}`
    await this.storage.saveMetadata(indexId, data)
    
    // Update unified cache
    const size = JSON.stringify(data.ids).length + 100
    this.unifiedCache.set(unifiedKey, entry, 'metadata', size, 1)
  }

  /**
   * Delete index entry from storage using safe filenames
   */
  private async deleteIndexEntry(key: string): Promise<void> {
    const unifiedKey = `metadata:entry:${key}`
    try {
      const [field, value] = key.split(':', 2)
      const filename = this.getValueChunkFilename(field, value)
      const indexId = `__metadata_index__${filename}`
      await this.storage.saveMetadata(indexId, null)
      
      // Remove from unified cache
      this.unifiedCache.delete(unifiedKey)
    } catch (error) {
      // Entry might not exist
    }
  }

  /**
   * Get field statistics for optimization and discovery
   */
  async getFieldStatistics(): Promise<Map<string, FieldStats>> {
    // Initialize stats for fields we haven't seen yet
    for (const field of this.fieldIndexes.keys()) {
      if (!this.fieldStats.has(field)) {
        this.fieldStats.set(field, {
          cardinality: {
            uniqueValues: 0,
            totalValues: 0,
            distribution: 'uniform',
            updateFrequency: 0,
            lastAnalyzed: Date.now()
          },
          queryCount: 0,
          rangeQueryCount: 0,
          exactQueryCount: 0,
          avgQueryTime: 0,
          indexType: 'hash'
        })
      }
    }
    
    return new Map(this.fieldStats)
  }

  /**
   * Get field cardinality information
   */
  async getFieldCardinality(field: string): Promise<CardinalityInfo | null> {
    const stats = this.fieldStats.get(field)
    return stats ? stats.cardinality : null
  }

  /**
   * Get all field names with their cardinality (for query optimization)
   */
  async getFieldsWithCardinality(): Promise<Array<{ field: string; cardinality: number; distribution: string }>> {
    const fields: Array<{ field: string; cardinality: number; distribution: string }> = []
    
    for (const [field, stats] of this.fieldStats) {
      fields.push({
        field,
        cardinality: stats.cardinality.uniqueValues,
        distribution: stats.cardinality.distribution
      })
    }
    
    // Sort by cardinality (low cardinality fields are better for filtering)
    fields.sort((a, b) => a.cardinality - b.cardinality)
    
    return fields
  }

  /**
   * Get optimal query plan based on field statistics
   */
  async getOptimalQueryPlan(filters: Record<string, any>): Promise<{
    strategy: 'exact' | 'range' | 'hybrid'
    fieldOrder: string[]
    estimatedCost: number
  }> {
    const fieldOrder: string[] = []
    let hasRangeQueries = false
    let totalEstimatedCost = 0
    
    // Analyze each filter
    for (const [field, value] of Object.entries(filters)) {
      const stats = this.fieldStats.get(field)
      if (!stats) continue
      
      // Check if this is a range query
      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        hasRangeQueries = true
      }
      
      // Estimate cost based on cardinality
      const cardinality = stats.cardinality.uniqueValues
      const estimatedCost = Math.log2(Math.max(1, cardinality))
      totalEstimatedCost += estimatedCost
      
      fieldOrder.push(field)
    }
    
    // Sort fields by cardinality (process low cardinality first)
    fieldOrder.sort((a, b) => {
      const statsA = this.fieldStats.get(a)
      const statsB = this.fieldStats.get(b)
      if (!statsA || !statsB) return 0
      return statsA.cardinality.uniqueValues - statsB.cardinality.uniqueValues
    })
    
    return {
      strategy: hasRangeQueries ? 'hybrid' : 'exact',
      fieldOrder,
      estimatedCost: totalEstimatedCost
    }
  }

  /**
   * Export field statistics for analysis
   */
  async exportFieldStats(): Promise<any> {
    const stats: any = {
      fields: {},
      summary: {
        totalFields: this.fieldStats.size,
        highCardinalityFields: 0,
        sparseFields: 0,
        skewedFields: 0,
        uniformFields: 0
      }
    }
    
    for (const [field, fieldStats] of this.fieldStats) {
      stats.fields[field] = {
        cardinality: fieldStats.cardinality,
        queryStats: {
          total: fieldStats.queryCount,
          exact: fieldStats.exactQueryCount,
          range: fieldStats.rangeQueryCount,
          avgTime: fieldStats.avgQueryTime
        },
        indexType: fieldStats.indexType,
        normalization: fieldStats.normalizationStrategy
      }
      
      // Update summary
      if (fieldStats.cardinality.uniqueValues > this.HIGH_CARDINALITY_THRESHOLD) {
        stats.summary.highCardinalityFields++
      }
      
      switch (fieldStats.cardinality.distribution) {
        case 'sparse':
          stats.summary.sparseFields++
          break
        case 'skewed':
          stats.summary.skewedFields++
          break
        case 'uniform':
          stats.summary.uniformFields++
          break
      }
    }
    
    return stats
  }
  
  /**
   * Update type-field affinity tracking for intelligent NLP
   * Tracks which fields commonly appear with which entity types
   */
  private updateTypeFieldAffinity(entityId: string, field: string, value: any, operation: 'add' | 'remove'): void {
    // Only track affinity for non-system fields (but allow 'noun' for type detection)
    if (this.config.excludeFields.includes(field) && field !== 'noun') return
    
    // For the 'noun' field, the value IS the entity type
    let entityType: string | null = null
    
    if (field === 'noun') {
      // This is the type definition itself
      entityType = this.normalizeValue(value)
    } else {
      // Find the noun type for this entity by looking for entries with this entityId
      for (const [key, entry] of this.indexCache.entries()) {
        if (key.startsWith('noun:') && entry.ids.has(entityId)) {
          entityType = key.split(':', 2)[1]
          break
        }
      }
    }
    
    if (!entityType) return // No type found, skip affinity tracking
    
    // Initialize affinity tracking for this type
    if (!this.typeFieldAffinity.has(entityType)) {
      this.typeFieldAffinity.set(entityType, new Map())
    }
    if (!this.totalEntitiesByType.has(entityType)) {
      this.totalEntitiesByType.set(entityType, 0)
    }
    
    const typeFields = this.typeFieldAffinity.get(entityType)!
    
    if (operation === 'add') {
      // Increment field count for this type
      const currentCount = typeFields.get(field) || 0
      typeFields.set(field, currentCount + 1)
      
      // Update total entities of this type (only count once per entity)
      if (field === 'noun') {
        this.totalEntitiesByType.set(entityType, this.totalEntitiesByType.get(entityType)! + 1)
      }
    } else if (operation === 'remove') {
      // Decrement field count for this type
      const currentCount = typeFields.get(field) || 0
      if (currentCount > 1) {
        typeFields.set(field, currentCount - 1)
      } else {
        typeFields.delete(field)
      }
      
      // Update total entities of this type
      if (field === 'noun') {
        const total = this.totalEntitiesByType.get(entityType)!
        if (total > 1) {
          this.totalEntitiesByType.set(entityType, total - 1)
        } else {
          this.totalEntitiesByType.delete(entityType)
          this.typeFieldAffinity.delete(entityType)
        }
      }
    }
  }
  
  /**
   * Get fields that commonly appear with a specific entity type
   * Returns fields with their affinity scores (0-1)
   */
  async getFieldsForType(nounType: NounType): Promise<Array<{
    field: string
    affinity: number
    occurrences: number
    totalEntities: number
  }>> {
    const typeFields = this.typeFieldAffinity.get(nounType)
    const totalEntities = this.totalEntitiesByType.get(nounType)
    
    if (!typeFields || !totalEntities) {
      return []
    }
    
    const fieldsWithAffinity: Array<{
      field: string
      affinity: number
      occurrences: number
      totalEntities: number
    }> = []
    
    for (const [field, count] of typeFields.entries()) {
      const affinity = count / totalEntities // 0-1 score
      fieldsWithAffinity.push({
        field,
        affinity,
        occurrences: count,
        totalEntities
      })
    }
    
    // Sort by affinity (most common fields first)
    fieldsWithAffinity.sort((a, b) => b.affinity - a.affinity)
    
    return fieldsWithAffinity
  }
  
  /**
   * Get type-field affinity statistics for analysis
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
    const typeBreakdown: Record<string, any> = {}
    let totalFields = 0
    
    for (const [nounType, fieldsMap] of this.typeFieldAffinity.entries()) {
      const totalEntities = this.totalEntitiesByType.get(nounType) || 0
      const fields = Array.from(fieldsMap.entries())
      
      // Get top 5 fields for this type
      const topFields = fields
        .map(([field, count]) => ({ field, affinity: count / totalEntities }))
        .sort((a, b) => b.affinity - a.affinity)
        .slice(0, 5)
      
      typeBreakdown[nounType] = {
        totalEntities,
        uniqueFields: fieldsMap.size,
        topFields
      }
      
      totalFields += fieldsMap.size
    }
    
    return {
      totalTypes: this.typeFieldAffinity.size,
      averageFieldsPerType: totalFields / Math.max(1, this.typeFieldAffinity.size),
      typeBreakdown
    }
  }
}