/**
 * Base Storage Adapter
 * Provides common functionality for all storage adapters
 */

import { GraphAdjacencyIndex } from '../graph/graphAdjacencyIndex.js'

import {
  GraphVerb,
  HNSWNoun,
  HNSWVerb,
  NounMetadata,
  VerbMetadata,
  HNSWNounWithMetadata,
  HNSWVerbWithMetadata,
  StatisticsData
} from '../coreTypes.js'
import { BaseStorageAdapter } from './adapters/baseStorageAdapter.js'
import { validateNounType, validateVerbType } from '../utils/typeValidation.js'
import { NounType, VerbType } from '../types/graphTypes.js'
import { getShardIdFromUuid } from './sharding.js'

/**
 * Storage key analysis result
 * Used to determine whether a key is a system key or entity key, and its storage path
 */
interface StorageKeyInfo {
  original: string
  isEntity: boolean
  shardId: string | null
  directory: string
  fullPath: string
}

// Clean directory structure (v4.7.2+)
// All storage adapters use this consistent structure
export const NOUNS_METADATA_DIR = 'entities/nouns/metadata'
export const VERBS_METADATA_DIR = 'entities/verbs/metadata'
export const SYSTEM_DIR = '_system'
export const STATISTICS_KEY = 'statistics'

// DEPRECATED (v4.7.2): Temporary stubs for adapters not yet migrated
// TODO: Remove in v4.7.3 after migrating remaining adapters
export const NOUNS_DIR = 'entities/nouns/hnsw'
export const VERBS_DIR = 'entities/verbs/hnsw'
export const METADATA_DIR = 'entities/nouns/metadata'
export const NOUN_METADATA_DIR = 'entities/nouns/metadata'
export const VERB_METADATA_DIR = 'entities/verbs/metadata'
export const INDEX_DIR = 'indexes'
export function getDirectoryPath(entityType: 'noun' | 'verb', dataType: 'vector' | 'metadata'): string {
  if (entityType === 'noun') {
    return dataType === 'vector' ? NOUNS_DIR : NOUNS_METADATA_DIR
  } else {
    return dataType === 'vector' ? VERBS_DIR : VERBS_METADATA_DIR
  }
}

/**
 * Base storage adapter that implements common functionality
 * This is an abstract class that should be extended by specific storage adapters
 */
export abstract class BaseStorage extends BaseStorageAdapter {
  protected isInitialized = false
  protected graphIndex?: GraphAdjacencyIndex
  protected readOnly = false

  /**
   * Analyze a storage key to determine its routing and path
   * @param id - The key to analyze (UUID or system key)
   * @param context - The context for the key (noun-metadata, verb-metadata, or system)
   * @returns Storage key information including path and shard ID
   * @private
   */
  private analyzeKey(id: string, context: 'noun-metadata' | 'verb-metadata' | 'system'): StorageKeyInfo {
    // v4.8.0: Guard against undefined/null IDs
    if (!id || typeof id !== 'string') {
      throw new Error(`Invalid storage key: ${id} (must be a non-empty string)`)
    }

    // System resource detection
    const isSystemKey =
      id.startsWith('__metadata_') ||
      id.startsWith('__index_') ||
      id.startsWith('__system_') ||
      id.startsWith('statistics_') ||
      id === 'statistics' ||
      id.startsWith('__chunk__') ||      // Metadata index chunks (roaring bitmap data)
      id.startsWith('__sparse_index__')  // Metadata sparse indices (zone maps + bloom filters)

    if (isSystemKey) {
      return {
        original: id,
        isEntity: false,
        shardId: null,
        directory: SYSTEM_DIR,
        fullPath: `${SYSTEM_DIR}/${id}.json`
      }
    }

    // UUID validation for entity keys
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (!uuidRegex.test(id)) {
      console.warn(`[Storage] Unknown key format: ${id} - treating as system resource`)
      return {
        original: id,
        isEntity: false,
        shardId: null,
        directory: SYSTEM_DIR,
        fullPath: `${SYSTEM_DIR}/${id}.json`
      }
    }

    // Valid entity UUID - apply sharding
    const shardId = getShardIdFromUuid(id)

    if (context === 'noun-metadata') {
      return {
        original: id,
        isEntity: true,
        shardId,
        directory: `${NOUNS_METADATA_DIR}/${shardId}`,
        fullPath: `${NOUNS_METADATA_DIR}/${shardId}/${id}.json`
      }
    } else if (context === 'verb-metadata') {
      return {
        original: id,
        isEntity: true,
        shardId,
        directory: `${VERBS_METADATA_DIR}/${shardId}`,
        fullPath: `${VERBS_METADATA_DIR}/${shardId}/${id}.json`
      }
    } else {
      // system context - but UUID format
      return {
        original: id,
        isEntity: false,
        shardId: null,
        directory: SYSTEM_DIR,
        fullPath: `${SYSTEM_DIR}/${id}.json`
      }
    }
  }

  /**
   * Initialize the storage adapter
   * This method should be implemented by each specific adapter
   */
  public abstract init(): Promise<void>

  /**
   * Ensure the storage adapter is initialized
   */
  protected async ensureInitialized(): Promise<void> {
    if (!this.isInitialized) {
      await this.init()
    }
  }

  /**
   * Save a noun to storage (v4.0.0: vector only, metadata saved separately)
   * @param noun Pure HNSW vector data (no metadata)
   */
  public async saveNoun(noun: HNSWNoun): Promise<void> {
    await this.ensureInitialized()

    // Save the HNSWNoun vector data only
    // Metadata must be saved separately via saveNounMetadata()
    await this.saveNoun_internal(noun)
  }

  /**
   * Get a noun from storage (v4.0.0: returns combined HNSWNounWithMetadata)
   * @param id Entity ID
   * @returns Combined vector + metadata or null
   */
  public async getNoun(id: string): Promise<HNSWNounWithMetadata | null> {
    await this.ensureInitialized()

    // Load vector and metadata separately
    const vector = await this.getNoun_internal(id)
    if (!vector) {
      return null
    }

    // Load metadata
    const metadata = await this.getNounMetadata(id)
    if (!metadata) {
      console.warn(`[Storage] Noun ${id} has vector but no metadata - this should not happen in v4.0.0`)
      return null
    }

    // Combine into HNSWNounWithMetadata - v4.8.0: Extract standard fields to top-level
    const { noun, createdAt, updatedAt, confidence, weight, service, data, createdBy, ...customMetadata } = metadata

    return {
      id: vector.id,
      vector: vector.vector,
      connections: vector.connections,
      level: vector.level,
      // v4.8.0: Standard fields at top-level
      type: (noun as NounType) || NounType.Thing,
      createdAt: (createdAt as number) || Date.now(),
      updatedAt: (updatedAt as number) || Date.now(),
      confidence: confidence as number | undefined,
      weight: weight as number | undefined,
      service: service as string | undefined,
      data: data as Record<string, any> | undefined,
      createdBy,
      // Only custom user fields remain in metadata
      metadata: customMetadata
    }
  }

  /**
   * Get nouns by noun type
   * @param nounType The noun type to filter by
   * @returns Promise that resolves to an array of nouns of the specified noun type
   */
  public async getNounsByNounType(nounType: string): Promise<HNSWNounWithMetadata[]> {
    await this.ensureInitialized()

    // Internal method returns HNSWNoun[], need to combine with metadata
    const nouns = await this.getNounsByNounType_internal(nounType)

    // Combine each noun with its metadata - v4.8.0: Extract standard fields to top-level
    const nounsWithMetadata: HNSWNounWithMetadata[] = []
    for (const noun of nouns) {
      const metadata = await this.getNounMetadata(noun.id)
      if (metadata) {
        const { noun: nounType, createdAt, updatedAt, confidence, weight, service, data, createdBy, ...customMetadata } = metadata

        nounsWithMetadata.push({
          ...noun,
          // v4.8.0: Standard fields at top-level
          type: (nounType as NounType) || NounType.Thing,
          createdAt: (createdAt as number) || Date.now(),
          updatedAt: (updatedAt as number) || Date.now(),
          confidence: confidence as number | undefined,
          weight: weight as number | undefined,
          service: service as string | undefined,
          data: data as Record<string, any> | undefined,
          createdBy,
          // Only custom user fields in metadata
          metadata: customMetadata
        })
      }
    }

    return nounsWithMetadata
  }

  /**
   * Delete a noun from storage
   */
  public async deleteNoun(id: string): Promise<void> {
    await this.ensureInitialized()

    // Delete both the vector file and metadata file (2-file system)
    await this.deleteNoun_internal(id)

    // Delete metadata file (if it exists)
    try {
      await this.deleteNounMetadata(id)
    } catch (error) {
      // Ignore if metadata file doesn't exist
      console.debug(`No metadata file to delete for noun ${id}`)
    }
  }

  /**
   * Save a verb to storage (v4.0.0: verb only, metadata saved separately)
   *
   * @param verb Pure HNSW verb with core relational fields (verb, sourceId, targetId)
   */
  public async saveVerb(verb: HNSWVerb): Promise<void> {
    await this.ensureInitialized()

    // Validate verb type before saving - storage boundary protection
    validateVerbType(verb.verb)

    // Save the HNSWVerb vector and core fields only
    // Metadata must be saved separately via saveVerbMetadata()
    await this.saveVerb_internal(verb)
  }

  /**
   * Get a verb from storage (v4.0.0: returns combined HNSWVerbWithMetadata)
   * @param id Entity ID
   * @returns Combined verb + metadata or null
   */
  public async getVerb(id: string): Promise<HNSWVerbWithMetadata | null> {
    await this.ensureInitialized()

    // Load verb vector and core fields
    const verb = await this.getVerb_internal(id)
    if (!verb) {
      return null
    }

    // Load metadata
    const metadata = await this.getVerbMetadata(id)
    if (!metadata) {
      console.warn(`[Storage] Verb ${id} has vector but no metadata - this should not happen in v4.0.0`)
      return null
    }

    // Combine into HNSWVerbWithMetadata - v4.8.0: Extract standard fields to top-level
    const { createdAt, updatedAt, confidence, weight, service, data, createdBy, ...customMetadata } = metadata

    return {
      id: verb.id,
      vector: verb.vector,
      connections: verb.connections,
      verb: verb.verb,
      sourceId: verb.sourceId,
      targetId: verb.targetId,
      // v4.8.0: Standard fields at top-level
      createdAt: (createdAt as number) || Date.now(),
      updatedAt: (updatedAt as number) || Date.now(),
      confidence: confidence as number | undefined,
      weight: weight as number | undefined,
      service: service as string | undefined,
      data: data as Record<string, any> | undefined,
      createdBy,
      // Only custom user fields remain in metadata
      metadata: customMetadata
    }
  }

  /**
   * Convert HNSWVerb to GraphVerb by combining with metadata
   * DEPRECATED: For backward compatibility only. Use getVerb() which returns HNSWVerbWithMetadata.
   *
   * @deprecated Use getVerb() instead which returns HNSWVerbWithMetadata
   */
  protected async convertHNSWVerbToGraphVerb(hnswVerb: HNSWVerb): Promise<GraphVerb | null> {
    try {
      // Load metadata
      const metadata = await this.getVerbMetadata(hnswVerb.id)

      // Create default timestamp in Firestore format
      const defaultTimestamp = {
        seconds: Math.floor(Date.now() / 1000),
        nanoseconds: (Date.now() % 1000) * 1000000
      }

      // Create default createdBy if not present
      const defaultCreatedBy = {
        augmentation: 'unknown',
        version: '1.0'
      }

      // Convert flexible timestamp to Firestore format for GraphVerb
      const normalizeTimestamp = (ts: any) => {
        if (!ts) return defaultTimestamp
        if (typeof ts === 'number') {
          return {
            seconds: Math.floor(ts / 1000),
            nanoseconds: (ts % 1000) * 1000000
          }
        }
        return ts
      }

      return {
        id: hnswVerb.id,
        vector: hnswVerb.vector,

        // CORE FIELDS from HNSWVerb
        verb: hnswVerb.verb,
        sourceId: hnswVerb.sourceId,
        targetId: hnswVerb.targetId,

        // Aliases for backward compatibility
        type: hnswVerb.verb,
        source: hnswVerb.sourceId,
        target: hnswVerb.targetId,

        // Optional fields from metadata file
        weight: metadata?.weight || 1.0,
        metadata: metadata as any || {},
        createdAt: normalizeTimestamp(metadata?.createdAt),
        updatedAt: normalizeTimestamp(metadata?.updatedAt),
        createdBy: metadata?.createdBy || defaultCreatedBy,
        data: metadata?.data as Record<string, any> | undefined,
        embedding: hnswVerb.vector
      }
    } catch (error) {
      console.error(`Failed to convert HNSWVerb to GraphVerb for ${hnswVerb.id}:`, error)
      return null
    }
  }

  /**
   * Internal method for loading all verbs - used by performance optimizations
   * @internal - Do not use directly, use getVerbs() with pagination instead
   */
  protected async _loadAllVerbsForOptimization(): Promise<HNSWVerb[]> {
    await this.ensureInitialized()

    // Only use this for internal optimizations when safe
    const result = await this.getVerbs({
      pagination: { limit: Number.MAX_SAFE_INTEGER }
    })

    // v4.0.0: Convert HNSWVerbWithMetadata to HNSWVerb (strip metadata)
    const hnswVerbs: HNSWVerb[] = result.items.map(verbWithMetadata => ({
      id: verbWithMetadata.id,
      vector: verbWithMetadata.vector,
      connections: verbWithMetadata.connections,
      verb: verbWithMetadata.verb,
      sourceId: verbWithMetadata.sourceId,
      targetId: verbWithMetadata.targetId
    }))

    return hnswVerbs
  }

  /**
   * Get verbs by source
   */
  public async getVerbsBySource(sourceId: string): Promise<HNSWVerbWithMetadata[]> {
    await this.ensureInitialized()

    // CRITICAL: Fetch ALL verbs for this source, not just first page
    // This is needed for delete operations to clean up all relationships
    const result = await this.getVerbs({
      filter: { sourceId },
      pagination: { limit: Number.MAX_SAFE_INTEGER }
    })
    return result.items
  }

  /**
   * Get verbs by target
   */
  public async getVerbsByTarget(targetId: string): Promise<HNSWVerbWithMetadata[]> {
    await this.ensureInitialized()

    // CRITICAL: Fetch ALL verbs for this target, not just first page
    // This is needed for delete operations to clean up all relationships
    const result = await this.getVerbs({
      filter: { targetId },
      pagination: { limit: Number.MAX_SAFE_INTEGER }
    })
    return result.items
  }

  /**
   * Get verbs by type
   */
  public async getVerbsByType(type: string): Promise<HNSWVerbWithMetadata[]> {
    await this.ensureInitialized()

    // Fetch ALL verbs of this type (no pagination limit)
    const result = await this.getVerbs({
      filter: { verbType: type },
      pagination: { limit: Number.MAX_SAFE_INTEGER }
    })
    return result.items
  }

  /**
   * Internal method for loading all nouns - used by performance optimizations
   * @internal - Do not use directly, use getNouns() with pagination instead
   */
  protected async _loadAllNounsForOptimization(): Promise<HNSWNoun[]> {
    await this.ensureInitialized()
    
    // Only use this for internal optimizations when safe
    const result = await this.getNouns({
      pagination: { limit: Number.MAX_SAFE_INTEGER }
    })
    
    return result.items
  }

  /**
   * Get nouns with pagination and filtering
   * @param options Pagination and filtering options
   * @returns Promise that resolves to a paginated result of nouns
   */
  public async getNouns(options?: {
    pagination?: {
      offset?: number
      limit?: number
      cursor?: string
    }
    filter?: {
      nounType?: string | string[]
      service?: string | string[]
      metadata?: Record<string, any>
    }
  }): Promise<{
    items: HNSWNounWithMetadata[]
    totalCount?: number
    hasMore: boolean
    nextCursor?: string
  }> {
    await this.ensureInitialized()

    // Set default pagination values
    const pagination = options?.pagination || {}
    const limit = pagination.limit || 100
    const offset = pagination.offset || 0
    const cursor = pagination.cursor

    // Optimize for common filter cases to avoid loading all nouns
    if (options?.filter) {
      // If filtering by nounType only, use the optimized method
      if (
        options.filter.nounType &&
        !options.filter.service &&
        !options.filter.metadata
      ) {
        const nounType = Array.isArray(options.filter.nounType)
          ? options.filter.nounType[0]
          : options.filter.nounType

        // Get nouns by type directly (already combines with metadata)
        const nounsByType = await this.getNounsByNounType(nounType)

        // Apply pagination
        const paginatedNouns = nounsByType.slice(offset, offset + limit)
        const hasMore = offset + limit < nounsByType.length

        // Set next cursor if there are more items
        let nextCursor: string | undefined = undefined
        if (hasMore && paginatedNouns.length > 0) {
          const lastItem = paginatedNouns[paginatedNouns.length - 1]
          nextCursor = lastItem.id
        }

        return {
          items: paginatedNouns,
          totalCount: nounsByType.length,
          hasMore,
          nextCursor
        }
      }
    }

    // For more complex filtering or no filtering, use a paginated approach
    // that avoids loading all nouns into memory at once
    try {
      // First, try to get a count of total nouns (if the adapter supports it)
      let totalCount: number | undefined = undefined
      try {
        // This is an optional method that adapters may implement
        if (typeof (this as any).countNouns === 'function') {
          totalCount = await (this as any).countNouns(options?.filter)
        }
      } catch (countError) {
        // Ignore errors from count method, it's optional
        console.warn('Error getting noun count:', countError)
      }

      // Check if the adapter has a paginated method for getting nouns
      if (typeof (this as any).getNounsWithPagination === 'function') {
        // Use the adapter's paginated method - pass offset directly to adapter
        const result = await (this as any).getNounsWithPagination({
          limit,
          offset,  // Let the adapter handle offset for O(1) operation
          cursor,
          filter: options?.filter
        })

        // Don't slice here - the adapter should handle offset efficiently
        const items = result.items

        // CRITICAL SAFETY CHECK: Prevent infinite loops
        // If we have no items but hasMore is true, force hasMore to false
        // This prevents pagination bugs from causing infinite loops
        const safeHasMore = items.length > 0 ? result.hasMore : false

        // VALIDATION: Ensure adapter returns totalCount (prevents restart bugs)
        // If adapter forgets to return totalCount, log warning and use pre-calculated count
        let finalTotalCount = result.totalCount || totalCount
        if (result.totalCount === undefined && this.totalNounCount > 0) {
          console.warn(
            `⚠️  Storage adapter missing totalCount in getNounsWithPagination result! ` +
            `Using pre-calculated count (${this.totalNounCount}) as fallback. ` +
            `Please ensure your storage adapter returns totalCount: this.totalNounCount`
          )
          finalTotalCount = this.totalNounCount
        }

        return {
          items,
          totalCount: finalTotalCount,
          hasMore: safeHasMore,
          nextCursor: result.nextCursor
        }
      }

      // Storage adapter does not support pagination
      console.error(
        'Storage adapter does not support pagination. The deprecated getAllNouns_internal() method has been removed. Please implement getNounsWithPagination() in your storage adapter.'
      )
      
      return {
        items: [],
        totalCount: 0,
        hasMore: false
      }
    } catch (error) {
      console.error('Error getting nouns with pagination:', error)
      return {
        items: [],
        totalCount: 0,
        hasMore: false
      }
    }
  }

  /**
   * Get verbs with pagination and filtering
   * @param options Pagination and filtering options
   * @returns Promise that resolves to a paginated result of verbs
   */
  public async getVerbs(options?: {
    pagination?: {
      offset?: number
      limit?: number
      cursor?: string
    }
    filter?: {
      verbType?: string | string[]
      sourceId?: string | string[]
      targetId?: string | string[]
      service?: string | string[]
      metadata?: Record<string, any>
    }
  }): Promise<{
    items: HNSWVerbWithMetadata[]
    totalCount?: number
    hasMore: boolean
    nextCursor?: string
  }> {
    await this.ensureInitialized()

    // Set default pagination values
    const pagination = options?.pagination || {}
    const limit = pagination.limit || 100
    const offset = pagination.offset || 0
    const cursor = pagination.cursor

    // Optimize for common filter cases to avoid loading all verbs
    if (options?.filter) {
      // CRITICAL VFS FIX: If filtering by sourceId + verbType (most common VFS pattern!)
      // This is the query PathResolver.getChildren() uses: getRelations({ from: dirId, type: VerbType.Contains })
      if (
        options.filter.sourceId &&
        options.filter.verbType &&
        !options.filter.targetId &&
        !options.filter.service &&
        !options.filter.metadata
      ) {
        const sourceId = Array.isArray(options.filter.sourceId)
          ? options.filter.sourceId[0]
          : options.filter.sourceId

        const verbType = Array.isArray(options.filter.verbType)
          ? options.filter.verbType[0]
          : options.filter.verbType

        // Get verbs by source, then filter by type (O(1) graph lookup + O(n) type filter)
        const verbsBySource = await this.getVerbsBySource_internal(sourceId)
        const filteredVerbs = verbsBySource.filter(v => v.verb === verbType)

        // Apply pagination
        const paginatedVerbs = filteredVerbs.slice(offset, offset + limit)
        const hasMore = offset + limit < filteredVerbs.length

        // Set next cursor if there are more items
        let nextCursor: string | undefined = undefined
        if (hasMore && paginatedVerbs.length > 0) {
          const lastItem = paginatedVerbs[paginatedVerbs.length - 1]
          nextCursor = lastItem.id
        }

        return {
          items: paginatedVerbs,
          totalCount: filteredVerbs.length,
          hasMore,
          nextCursor
        }
      }

      // If filtering by sourceId only, use the optimized method
      if (
        options.filter.sourceId &&
        !options.filter.verbType &&
        !options.filter.targetId &&
        !options.filter.service &&
        !options.filter.metadata
      ) {
        const sourceId = Array.isArray(options.filter.sourceId)
          ? options.filter.sourceId[0]
          : options.filter.sourceId

        // Get verbs by source directly
        const verbsBySource = await this.getVerbsBySource_internal(sourceId)

        // Apply pagination
        const paginatedVerbs = verbsBySource.slice(offset, offset + limit)
        const hasMore = offset + limit < verbsBySource.length

        // Set next cursor if there are more items
        let nextCursor: string | undefined = undefined
        if (hasMore && paginatedVerbs.length > 0) {
          const lastItem = paginatedVerbs[paginatedVerbs.length - 1]
          nextCursor = lastItem.id
        }

        return {
          items: paginatedVerbs,
          totalCount: verbsBySource.length,
          hasMore,
          nextCursor
        }
      }

      // If filtering by targetId only, use the optimized method
      if (
        options.filter.targetId &&
        !options.filter.verbType &&
        !options.filter.sourceId &&
        !options.filter.service &&
        !options.filter.metadata
      ) {
        const targetId = Array.isArray(options.filter.targetId)
          ? options.filter.targetId[0]
          : options.filter.targetId

        // Get verbs by target directly
        const verbsByTarget = await this.getVerbsByTarget_internal(targetId)

        // Apply pagination
        const paginatedVerbs = verbsByTarget.slice(offset, offset + limit)
        const hasMore = offset + limit < verbsByTarget.length

        // Set next cursor if there are more items
        let nextCursor: string | undefined = undefined
        if (hasMore && paginatedVerbs.length > 0) {
          const lastItem = paginatedVerbs[paginatedVerbs.length - 1]
          nextCursor = lastItem.id
        }

        return {
          items: paginatedVerbs,
          totalCount: verbsByTarget.length,
          hasMore,
          nextCursor
        }
      }

      // If filtering by verbType only, use the optimized method
      if (
        options.filter.verbType &&
        !options.filter.sourceId &&
        !options.filter.targetId &&
        !options.filter.service &&
        !options.filter.metadata
      ) {
        const verbType = Array.isArray(options.filter.verbType)
          ? options.filter.verbType[0]
          : options.filter.verbType

        // Get verbs by type directly
        const verbsByType = await this.getVerbsByType_internal(verbType)

        // Apply pagination
        const paginatedVerbs = verbsByType.slice(offset, offset + limit)
        const hasMore = offset + limit < verbsByType.length

        // Set next cursor if there are more items
        let nextCursor: string | undefined = undefined
        if (hasMore && paginatedVerbs.length > 0) {
          const lastItem = paginatedVerbs[paginatedVerbs.length - 1]
          nextCursor = lastItem.id
        }

        return {
          items: paginatedVerbs,
          totalCount: verbsByType.length,
          hasMore,
          nextCursor
        }
      }
    }

    // For more complex filtering or no filtering, use a paginated approach
    // that avoids loading all verbs into memory at once
    try {
      // First, try to get a count of total verbs (if the adapter supports it)
      let totalCount: number | undefined = undefined
      try {
        // This is an optional method that adapters may implement
        if (typeof (this as any).countVerbs === 'function') {
          totalCount = await (this as any).countVerbs(options?.filter)
        }
      } catch (countError) {
        // Ignore errors from count method, it's optional
        console.warn('Error getting verb count:', countError)
      }

      // Check if the adapter has a paginated method for getting verbs
      if (typeof (this as any).getVerbsWithPagination === 'function') {
        // Use the adapter's paginated method
        // Convert offset to cursor if no cursor provided (adapters use cursor for offset)
        const effectiveCursor = cursor || (offset > 0 ? offset.toString() : undefined)

        const result = await (this as any).getVerbsWithPagination({
          limit,
          cursor: effectiveCursor,
          filter: options?.filter
        })

        // Items are already offset by the adapter via cursor, no need to slice
        const items = result.items

        // CRITICAL SAFETY CHECK: Prevent infinite loops
        // If we have no items but hasMore is true, force hasMore to false
        // This prevents pagination bugs from causing infinite loops
        const safeHasMore = items.length > 0 ? result.hasMore : false

        // VALIDATION: Ensure adapter returns totalCount (prevents restart bugs)
        // If adapter forgets to return totalCount, log warning and use pre-calculated count
        let finalTotalCount = result.totalCount || totalCount
        if (result.totalCount === undefined && this.totalVerbCount > 0) {
          console.warn(
            `⚠️  Storage adapter missing totalCount in getVerbsWithPagination result! ` +
            `Using pre-calculated count (${this.totalVerbCount}) as fallback. ` +
            `Please ensure your storage adapter returns totalCount: this.totalVerbCount`
          )
          finalTotalCount = this.totalVerbCount
        }

        return {
          items,
          totalCount: finalTotalCount,
          hasMore: safeHasMore,
          nextCursor: result.nextCursor
        }
      }

      // Storage adapter does not support pagination
      console.error(
        'Storage adapter does not support pagination. The deprecated getAllVerbs_internal() method has been removed. Please implement getVerbsWithPagination() in your storage adapter.'
      )
      
      return {
        items: [],
        totalCount: 0,
        hasMore: false
      }
    } catch (error) {
      console.error('Error getting verbs with pagination:', error)
      return {
        items: [],
        totalCount: 0,
        hasMore: false
      }
    }
  }

  /**
   * Delete a verb from storage
   */
  public async deleteVerb(id: string): Promise<void> {
    await this.ensureInitialized()

    // Delete both the vector file and metadata file (2-file system)
    await this.deleteVerb_internal(id)

    // Delete metadata file (if it exists)
    try {
      await this.deleteVerbMetadata(id)
    } catch (error) {
      // Ignore if metadata file doesn't exist
      console.debug(`No metadata file to delete for verb ${id}`)
    }
  }
  /**
   * Get graph index (lazy initialization)
   */
  async getGraphIndex(): Promise<GraphAdjacencyIndex> {
    if (!this.graphIndex) {
      console.log('Initializing GraphAdjacencyIndex...')
      this.graphIndex = new GraphAdjacencyIndex(this)
      
      // Check if we need to rebuild from existing data
      const sampleVerbs = await this.getVerbs({ pagination: { limit: 1 } })
      if (sampleVerbs.items.length > 0) {
        console.log('Found existing verbs, rebuilding graph index...')
        await this.graphIndex.rebuild()
      }
    }
    return this.graphIndex
  }
  /**
   * Clear all data from storage
   * This method should be implemented by each specific adapter
   */
  public abstract clear(): Promise<void>

  /**
   * Get information about storage usage and capacity
   * This method should be implemented by each specific adapter
   */
  public abstract getStorageStatus(): Promise<{
    type: string
    used: number
    quota: number | null
    details?: Record<string, any>
  }>

  /**
   * Write a JSON object to a specific path in storage
   * This is a primitive operation that all adapters must implement
   * @param path - Full path including filename (e.g., "_system/statistics.json" or "entities/nouns/metadata/3f/3fa85f64-....json")
   * @param data - Data to write (will be JSON.stringify'd)
   * @protected
   */
  protected abstract writeObjectToPath(path: string, data: any): Promise<void>

  /**
   * Read a JSON object from a specific path in storage
   * This is a primitive operation that all adapters must implement
   * @param path - Full path including filename
   * @returns The parsed JSON object, or null if not found
   * @protected
   */
  protected abstract readObjectFromPath(path: string): Promise<any | null>

  /**
   * Delete an object from a specific path in storage
   * This is a primitive operation that all adapters must implement
   * @param path - Full path including filename
   * @protected
   */
  protected abstract deleteObjectFromPath(path: string): Promise<void>

  /**
   * List all object paths under a given prefix
   * This is a primitive operation that all adapters must implement
   * @param prefix - Directory prefix to list (e.g., "entities/nouns/metadata/3f/")
   * @returns Array of full paths
   * @protected
   */
  protected abstract listObjectsUnderPath(prefix: string): Promise<string[]>

  /**
   * Save metadata to storage (v4.0.0: now typed)
   * Routes to correct location (system or entity) based on key format
   */
  public async saveMetadata(id: string, metadata: NounMetadata): Promise<void> {
    await this.ensureInitialized()
    const keyInfo = this.analyzeKey(id, 'system')
    return this.writeObjectToPath(keyInfo.fullPath, metadata)
  }

  /**
   * Get metadata from storage (v4.0.0: now typed)
   * Routes to correct location (system or entity) based on key format
   */
  public async getMetadata(id: string): Promise<NounMetadata | null> {
    await this.ensureInitialized()
    const keyInfo = this.analyzeKey(id, 'system')
    return this.readObjectFromPath(keyInfo.fullPath)
  }

  /**
   * Save noun metadata to storage (v4.0.0: now typed)
   * Routes to correct sharded location based on UUID
   */
  public async saveNounMetadata(id: string, metadata: NounMetadata): Promise<void> {
    // Validate noun type in metadata - storage boundary protection
    validateNounType(metadata.noun)
    return this.saveNounMetadata_internal(id, metadata)
  }

  /**
   * Internal method for saving noun metadata (v4.0.0: now typed)
   * Uses routing logic to handle both UUIDs (sharded) and system keys (unsharded)
   *
   * CRITICAL (v4.1.2): Count synchronization happens here
   * This ensures counts are updated AFTER metadata exists, fixing the race condition
   * where storage adapters tried to read metadata before it was saved.
   *
   * @protected
   */
  protected async saveNounMetadata_internal(id: string, metadata: NounMetadata): Promise<void> {
    await this.ensureInitialized()

    // Determine if this is a new entity by checking if metadata already exists
    const keyInfo = this.analyzeKey(id, 'noun-metadata')
    const existingMetadata = await this.readObjectFromPath(keyInfo.fullPath)
    const isNew = !existingMetadata

    // Save the metadata
    await this.writeObjectToPath(keyInfo.fullPath, metadata)

    // CRITICAL FIX (v4.1.2): Increment count for new entities
    // This runs AFTER metadata is saved, guaranteeing type information is available
    // Uses synchronous increment since storage operations are already serialized
    // Fixes Bug #1: Count synchronization failure during add() and import()
    if (isNew && metadata.noun) {
      this.incrementEntityCount(metadata.noun)
      // Persist counts asynchronously (fire and forget)
      this.scheduleCountPersist().catch(() => {
        // Ignore persist errors - will retry on next operation
      })
    }
  }

  /**
   * Get noun metadata from storage (v4.0.0: now typed)
   * Uses routing logic to handle both UUIDs (sharded) and system keys (unsharded)
   */
  public async getNounMetadata(id: string): Promise<NounMetadata | null> {
    await this.ensureInitialized()
    const keyInfo = this.analyzeKey(id, 'noun-metadata')
    return this.readObjectFromPath(keyInfo.fullPath)
  }

  /**
   * Delete noun metadata from storage
   * Uses routing logic to handle both UUIDs (sharded) and system keys (unsharded)
   */
  public async deleteNounMetadata(id: string): Promise<void> {
    await this.ensureInitialized()
    const keyInfo = this.analyzeKey(id, 'noun-metadata')
    return this.deleteObjectFromPath(keyInfo.fullPath)
  }

  /**
   * Save verb metadata to storage (v4.0.0: now typed)
   * Routes to correct sharded location based on UUID
   */
  public async saveVerbMetadata(id: string, metadata: VerbMetadata): Promise<void> {
    // Note: verb type is in HNSWVerb, not metadata
    return this.saveVerbMetadata_internal(id, metadata)
  }

  /**
   * Internal method for saving verb metadata (v4.0.0: now typed)
   * Uses routing logic to handle both UUIDs (sharded) and system keys (unsharded)
   *
   * CRITICAL (v4.1.2): Count synchronization happens here
   * This ensures verb counts are updated AFTER metadata exists, fixing the race condition
   * where storage adapters tried to read metadata before it was saved.
   *
   * Note: Verb type is now stored in both HNSWVerb (vector file) and VerbMetadata for count tracking
   *
   * @protected
   */
  protected async saveVerbMetadata_internal(id: string, metadata: VerbMetadata): Promise<void> {
    await this.ensureInitialized()

    // Determine if this is a new verb by checking if metadata already exists
    const keyInfo = this.analyzeKey(id, 'verb-metadata')
    const existingMetadata = await this.readObjectFromPath(keyInfo.fullPath)
    const isNew = !existingMetadata

    // Save the metadata
    await this.writeObjectToPath(keyInfo.fullPath, metadata)

    // CRITICAL FIX (v4.1.2): Increment verb count for new relationships
    // This runs AFTER metadata is saved
    // Verb type is now stored in metadata (as of v4.1.2) to avoid loading HNSWVerb
    // Uses synchronous increment since storage operations are already serialized
    // Fixes Bug #2: Count synchronization failure during relate() and import()
    if (isNew && (metadata as any).verb) {
      this.incrementVerbCount((metadata as any).verb)
      // Persist counts asynchronously (fire and forget)
      this.scheduleCountPersist().catch(() => {
        // Ignore persist errors - will retry on next operation
      })
    }
  }

  /**
   * Get verb metadata from storage (v4.0.0: now typed)
   * Uses routing logic to handle both UUIDs (sharded) and system keys (unsharded)
   */
  public async getVerbMetadata(id: string): Promise<VerbMetadata | null> {
    await this.ensureInitialized()
    const keyInfo = this.analyzeKey(id, 'verb-metadata')
    return this.readObjectFromPath(keyInfo.fullPath)
  }

  /**
   * Delete verb metadata from storage
   * Uses routing logic to handle both UUIDs (sharded) and system keys (unsharded)
   */
  public async deleteVerbMetadata(id: string): Promise<void> {
    await this.ensureInitialized()
    const keyInfo = this.analyzeKey(id, 'verb-metadata')
    return this.deleteObjectFromPath(keyInfo.fullPath)
  }

  /**
   * Save a noun to storage
   * This method should be implemented by each specific adapter
   */
  protected abstract saveNoun_internal(noun: HNSWNoun): Promise<void>

  /**
   * Get a noun from storage
   * This method should be implemented by each specific adapter
   */
  protected abstract getNoun_internal(id: string): Promise<HNSWNoun | null>

  /**
   * Get nouns by noun type
   * This method should be implemented by each specific adapter
   */
  protected abstract getNounsByNounType_internal(
    nounType: string
  ): Promise<HNSWNoun[]>

  /**
   * Delete a noun from storage
   * This method should be implemented by each specific adapter
   */
  protected abstract deleteNoun_internal(id: string): Promise<void>

  /**
   * Save a verb to storage
   * This method should be implemented by each specific adapter
   */
  protected abstract saveVerb_internal(verb: HNSWVerb): Promise<void>

  /**
   * Get a verb from storage
   * This method should be implemented by each specific adapter
   */
  protected abstract getVerb_internal(id: string): Promise<HNSWVerb | null>

  /**
   * Get verbs by source
   * This method should be implemented by each specific adapter
   */
  protected abstract getVerbsBySource_internal(
    sourceId: string
  ): Promise<HNSWVerbWithMetadata[]>

  /**
   * Get verbs by target
   * This method should be implemented by each specific adapter
   */
  protected abstract getVerbsByTarget_internal(
    targetId: string
  ): Promise<HNSWVerbWithMetadata[]>

  /**
   * Get verbs by type
   * This method should be implemented by each specific adapter
   */
  protected abstract getVerbsByType_internal(type: string): Promise<HNSWVerbWithMetadata[]>

  /**
   * Delete a verb from storage
   * This method should be implemented by each specific adapter
   */
  protected abstract deleteVerb_internal(id: string): Promise<void>

  /**
   * Helper method to convert a Map to a plain object for serialization
   */
  protected mapToObject<K extends string | number, V>(
    map: Map<K, V>,
    valueTransformer: (value: V) => any = (v) => v
  ): Record<string, any> {
    const obj: Record<string, any> = {}
    for (const [key, value] of map.entries()) {
      obj[key.toString()] = valueTransformer(value)
    }
    return obj
  }

  /**
   * Save statistics data to storage (public interface)
   * @param statistics The statistics data to save
   */
  public async saveStatistics(statistics: StatisticsData): Promise<void> {
    return this.saveStatisticsData(statistics)
  }

  /**
   * Get statistics data from storage (public interface)
   * @returns Promise that resolves to the statistics data or null if not found
   */
  public async getStatistics(): Promise<StatisticsData | null> {
    return this.getStatisticsData()
  }

  /**
   * Save statistics data to storage
   * This method should be implemented by each specific adapter
   * @param statistics The statistics data to save
   */
  protected abstract saveStatisticsData(
    statistics: StatisticsData
  ): Promise<void>

  /**
   * Get statistics data from storage
   * This method should be implemented by each specific adapter
   * @returns Promise that resolves to the statistics data or null if not found
   */
  protected abstract getStatisticsData(): Promise<StatisticsData | null>
}
