/**
 * Type definitions for the Soulcraft Brainy
 */

import { NounType, VerbType } from './types/graphTypes.js'

// Re-export NounType and VerbType for use in other modules (as values, not just types)
export { NounType, VerbType }

/**
 * Vector representation - an array of numbers
 */
export type Vector = number[]

/**
 * A document with a vector embedding and optional metadata
 */
export interface VectorDocument<T = any> {
  id: string
  vector: Vector
  metadata?: T
}

/**
 * Search result with similarity score
 */
export interface SearchResult<T = any> {
  id: string
  score: number
  vector: Vector
  metadata?: T
}

/**
 * Cursor for pagination through search results
 */
export interface SearchCursor {
  lastId: string
  lastScore: number
  position: number // For debugging/logging
}

/**
 * Paginated search result with cursor support
 */
export interface PaginatedSearchResult<T = any> {
  results: SearchResult<T>[]
  cursor?: SearchCursor
  hasMore: boolean
  totalEstimate?: number
}

/**
 * Distance function for comparing vectors
 */
export type DistanceFunction = (a: Vector, b: Vector) => number

/**
 * Embedding function for converting data to vectors
 * v4.0.0: Now properly typed - accepts string, string array (batch), or object, no `any`
 */
export type EmbeddingFunction = (data: string | string[] | Record<string, unknown>) => Promise<Vector>

/**
 * Embedding model interface
 */
export interface EmbeddingModel {
  /**
   * Initialize the embedding model
   */
  init(): Promise<void>

  /**
   * Embed data into a vector
   * v4.0.0: Now properly typed - accepts string, string array (batch), or object, no `any`
   */
  embed(data: string | string[] | Record<string, unknown>): Promise<Vector>

  /**
   * Dispose of the model resources
   */
  dispose(): Promise<void>
}

/**
 * HNSW graph noun - Pure vector structure (v4.0.0)
 *
 * v4.0.0 BREAKING CHANGE: metadata field removed
 * - Stores ONLY vector data for optimal memory usage
 * - Metadata stored separately and combined on retrieval
 * - 25% memory reduction @ 1B scale (no in-memory metadata)
 * - Prevents metadata explosion bugs at compile-time
 */
export interface HNSWNoun {
  id: string
  vector: Vector
  connections: Map<number, Set<string>> // level -> set of connected noun ids
  level: number // The highest layer this noun appears in
  // ✅ NO metadata field - stored separately for optimization
}

/**
 * Lightweight verb for HNSW index storage - Core relational structure (v4.0.0)
 *
 * Core fields (v3.50.1+): verb/sourceId/targetId are first-class fields
 * These are NOT metadata - they're the essence of what a verb IS:
 * - verb: The relationship type (creates, contains, etc.) - needed for routing & display
 * - sourceId: What entity this verb connects FROM - needed for graph traversal
 * - targetId: What entity this verb connects TO - needed for graph traversal
 *
 * v4.0.0 BREAKING CHANGE: metadata field removed
 * - Stores ONLY vector + core relational data
 * - User metadata (weight, custom fields) stored separately
 * - 10x faster metadata-only updates (skip HNSW rebuild)
 * - Prevents metadata explosion bugs at compile-time
 *
 * Benefits:
 * - ONE file read for graph operations (core fields always available)
 * - No type caching needed (type is always available)
 * - Faster graph traversal (source/target immediately available)
 * - Optimal memory usage (no user metadata in HNSW)
 */
export interface HNSWVerb {
  id: string
  vector: Vector
  connections: Map<number, Set<string>> // level -> set of connected verb ids

  // CORE RELATIONAL DATA (not metadata!)
  verb: VerbType      // Relationship type - REQUIRED, validated at compile + runtime
  sourceId: string    // Source entity UUID - REQUIRED for graph traversal
  targetId: string    // Target entity UUID - REQUIRED for graph traversal

  // ✅ NO metadata field - stored separately for optimization
}

/**
 * Noun metadata structure (v4.8.0)
 *
 * v4.8.0 BREAKING CHANGE: Now contains ONLY custom user-defined fields
 * - Standard fields (confidence, weight, timestamps, etc.) moved to top-level in HNSWNounWithMetadata
 * - This interface represents custom metadata stored separately from vector data
 * - Storage format unchanged (backward compatible at storage layer)
 * - Combines with HNSWNoun to form complete entity
 *
 * NOTE: For storage backward compatibility, we still store all fields in metadata files,
 * but in-memory entity structures have standard fields at top-level.
 */
export interface NounMetadata {
  // Storage backward compatibility: these fields still exist in storage
  // but are extracted to top-level when creating HNSWNounWithMetadata
  noun?: string  // NounType as string (stored for backward compat, extracted to type)
  data?: unknown
  createdAt?: { seconds: number; nanoseconds: number } | number
  updatedAt?: { seconds: number; nanoseconds: number } | number
  createdBy?: { augmentation: string; version: string }
  service?: string
  confidence?: number
  weight?: number

  // User-defined custom fields
  [key: string]: unknown
}

/**
 * Verb metadata structure (v4.8.0)
 *
 * v4.8.0 BREAKING CHANGE: Now contains ONLY custom user-defined fields
 * - Standard fields (weight, confidence, timestamps, etc.) moved to top-level in HNSWVerbWithMetadata
 * - This interface represents custom metadata stored separately from vector + core relational data
 * - Storage format unchanged (backward compatible at storage layer)
 * - Core fields (verb, sourceId, targetId) remain in HNSWVerb
 *
 * NOTE: For storage backward compatibility, we still store all fields in metadata files,
 * but in-memory entity structures have standard fields at top-level.
 */
export interface VerbMetadata {
  // Storage backward compatibility: these fields still exist in storage
  // but are extracted to top-level when creating HNSWVerbWithMetadata
  verb?: string  // For count tracking (stored for backward compat)
  weight?: number
  confidence?: number
  data?: unknown
  createdAt?: { seconds: number; nanoseconds: number } | number
  updatedAt?: { seconds: number; nanoseconds: number } | number
  createdBy?: { augmentation: string; version: string }
  service?: string

  // User-defined custom fields
  [key: string]: unknown
}

/**
 * Combined noun structure for transport/API boundaries (v4.8.0)
 *
 * v4.8.0 BREAKING CHANGE: Standard fields moved to top-level
 * - ALL standard fields (confidence, weight, timestamps, etc.) are now at top-level
 * - metadata contains ONLY custom user-defined fields
 * - Provides clean, predictable API: entity.confidence always works
 * - 20% memory reduction @ billion scale (no duplicate storage)
 *
 * Used for API responses and storage retrieval.
 */
export interface HNSWNounWithMetadata {
  // HNSW Core (unchanged)
  id: string
  vector: Vector
  connections: Map<number, Set<string>>
  level: number

  // TYPE (required, explicit)
  type: NounType

  // QUALITY METRICS (top-level, explicit)
  confidence?: number
  weight?: number

  // TIMESTAMPS (top-level, always numbers for consistency)
  createdAt: number
  updatedAt: number

  // SYSTEM METADATA (top-level)
  service?: string
  createdBy?: { augmentation: string; version: string }

  // USER DATA (top-level) - compatible with other types
  data?: Record<string, any>

  // CUSTOM USER METADATA (only custom fields, no standard fields)
  metadata?: Record<string, unknown>
}

/**
 * Combined verb structure for transport/API boundaries (v4.8.0)
 *
 * v4.8.0 BREAKING CHANGE: Standard fields moved to top-level
 * - ALL standard fields (weight, confidence, timestamps, etc.) are now at top-level
 * - metadata contains ONLY custom user-defined fields
 * - Provides clean, predictable API: verb.weight always works
 * - 20% memory reduction @ billion scale (no duplicate storage)
 *
 * Used for API responses and storage retrieval.
 */
export interface HNSWVerbWithMetadata {
  // HNSW Core + Relational (unchanged)
  id: string
  vector: Vector
  connections: Map<number, Set<string>>
  verb: VerbType
  sourceId: string
  targetId: string

  // QUALITY METRICS (top-level, explicit)
  weight?: number
  confidence?: number

  // TIMESTAMPS (top-level, always numbers for consistency)
  createdAt: number
  updatedAt: number

  // SYSTEM METADATA (top-level)
  service?: string
  createdBy?: { augmentation: string; version: string }

  // USER DATA (top-level) - compatible with GraphVerb
  data?: Record<string, any>

  // CUSTOM USER METADATA (only custom fields, no standard fields)
  metadata?: Record<string, unknown>
}

/**
 * Verb representing a relationship between nouns
 * Stored separately from HNSW index for lightweight performance
 *
 * @deprecated Will be replaced by HNSWVerbWithMetadata in future versions
 */
export interface GraphVerb {
  id: string // Unique identifier for the verb
  sourceId: string // ID of the source noun
  targetId: string // ID of the target noun
  vector: Vector // Vector representation of the relationship
  connections?: Map<number, Set<string>> // Optional connections from HNSW index
  type?: string // Optional type of the relationship
  weight?: number // Optional weight of the relationship
  confidence?: number // Optional confidence score (0-1)
  metadata?: any // Optional metadata for the verb
  service?: string // Multi-tenancy support - which service created this verb

  // Additional properties used in the codebase
  source?: string // Alias for sourceId
  target?: string // Alias for targetId
  verb?: string // Alias for type
  data?: Record<string, any> // Additional flexible data storage
  embedding?: Vector // Alias for vector

  // Timestamp and creator properties
  createdAt?: { seconds: number; nanoseconds: number } // When the verb was created
  updatedAt?: { seconds: number; nanoseconds: number } // When the verb was last updated
  createdBy?: { augmentation: string; version: string } // Information about what created this verb
}

/**
 * HNSW index configuration
 */
export interface HNSWConfig {
  M: number // Maximum number of connections per noun
  efConstruction: number // Size of the dynamic candidate list during construction
  efSearch: number // Size of the dynamic candidate list during search
  ml: number // Maximum level
  useDiskBasedIndex?: boolean // Whether to use disk-based index
  maxConcurrentNeighborWrites?: number // Maximum concurrent neighbor updates during insert (v4.10.0+). Default: unlimited (full concurrency)
}

/**
 * Storage interface for persistence
 */
/**
 * Statistics data structure for tracking counts by service
 */
/**
 * Per-service statistics tracking
 */
export interface ServiceStatistics {
  /**
   * Service name
   */
  name: string

  /**
   * Total number of nouns created by this service
   */
  totalNouns: number

  /**
   * Total number of verbs created by this service
   */
  totalVerbs: number

  /**
   * Total number of metadata entries created by this service
   */
  totalMetadata: number

  /**
   * First activity timestamp for this service
   */
  firstActivity?: string

  /**
   * Last activity timestamp for this service
   */
  lastActivity?: string

  /**
   * Error count for this service
   */
  errorCount?: number

  /**
   * Operation breakdown for this service
   */
  operations?: {
    adds: number
    updates: number
    deletes: number
  }

  /**
   * Status of the service (active, inactive, read-only)
   */
  status?: 'active' | 'inactive' | 'read-only'
}

export interface StatisticsData {
  /**
   * Count of nouns by service
   */
  nounCount: Record<string, number>

  /**
   * Count of verbs by service
   */
  verbCount: Record<string, number>

  /**
   * Count of metadata entries by service
   */
  metadataCount: Record<string, number>

  /**
   * Size of the HNSW index
   */
  hnswIndexSize: number

  /**
   * Total number of nodes
   */
  totalNodes?: number

  /**
   * Total number of edges
   */
  totalEdges?: number

  /**
   * Total metadata count
   */
  totalMetadata?: number

  /**
   * Operation counts
   */
  operations?: {
    add: number
    search: number
    delete: number
    update: number
    relate: number
    total: number
  }

  /**
   * Field names available for searching, organized by service
   * This helps users understand what fields are available from different data sources
   */
  fieldNames?: Record<string, string[]>

  /**
   * Standard field mappings for common field names across services
   * Maps standard field names to the actual field names used by each service
   */
  standardFieldMappings?: Record<string, Record<string, string[]>>

  /**
   * Content type breakdown (e.g., Person, Repository, Issue, etc.)
   */
  contentTypes?: Record<string, number>

  /**
   * Data freshness metrics
   */
  dataFreshness?: {
    oldestEntry: string
    newestEntry: string
    updatesLastHour: number
    updatesLastDay: number
    ageDistribution: {
      last24h: number
      last7d: number
      last30d: number
      older: number
    }
  }

  /**
   * Storage utilization metrics
   */
  storageMetrics?: {
    totalSizeBytes: number
    nounsSizeBytes: number
    verbsSizeBytes: number
    metadataSizeBytes: number
    indexSizeBytes: number
  }

  /**
   * Search performance metrics
   */
  searchMetrics?: {
    totalSearches: number
    averageSearchTimeMs: number
    searchesLastHour: number
    searchesLastDay: number
    topSearchTerms?: string[]
  }

  /**
   * Verb statistics similar to nouns
   */
  verbStatistics?: {
    totalVerbs: number
    verbTypes: Record<string, number>
    averageConnectionsPerVerb: number
  }

  /**
   * Service-level activity timestamps
   */
  serviceActivity?: Record<string, {
    firstActivity: string
    lastActivity: string
    totalOperations: number
  }>

  /**
   * List of all services that have written data
   */
  services?: ServiceStatistics[]

  /**
   * Throttling metrics for storage operations
   */
  throttlingMetrics?: {
    /**
     * Storage-level throttling information
     */
    storage?: {
      currentlyThrottled: boolean
      lastThrottleTime?: string
      consecutiveThrottleEvents: number
      currentBackoffMs: number
      totalThrottleEvents: number
      throttleEventsByHour?: number[]  // Last 24 hours
      throttleReasons?: Record<string, number>  // Count by reason (429, 503, timeout, etc.)
    }
    
    /**
     * Operation impact metrics
     */
    operationImpact?: {
      delayedOperations: number
      retriedOperations: number
      failedDueToThrottling: number
      averageDelayMs: number
      totalDelayMs: number
    }
    
    /**
     * Service-level throttling breakdown
     */
    serviceThrottling?: Record<string, {
      throttleCount: number
      lastThrottle: string
      status: 'normal' | 'throttled' | 'recovering'
    }>
  }

  /**
   * Last updated timestamp
   */
  lastUpdated: string

  /**
   * Distributed configuration (stored in index folder for easy access)
   * This is used for distributed Brainy instances coordination
   */
  distributedConfig?: import('./types/distributedTypes.js').SharedConfig
}

/**
 * Change record for getChangesSince (v4.0.0)
 * Replaces `any[]` with properly typed structure
 */
export interface Change {
  id: string
  type: 'noun' | 'verb'
  operation: 'create' | 'update' | 'delete'
  timestamp: number
  data?: HNSWNounWithMetadata | HNSWVerbWithMetadata
}

export interface StorageAdapter {
  init(): Promise<void>

  /**
   * Save noun - Pure HNSW vector data only (v4.0.0)
   * @param noun Pure HNSW vector data (no metadata)
   * Note: Use saveNounMetadata() to save metadata separately
   */
  saveNoun(noun: HNSWNoun): Promise<void>

  /**
   * Save noun metadata separately (v4.0.0)
   * @param id Noun ID
   * @param metadata Noun metadata
   */
  saveNounMetadata(id: string, metadata: NounMetadata): Promise<void>

  /**
   * Delete noun metadata (v4.0.0)
   * @param id Noun ID
   */
  deleteNounMetadata(id: string): Promise<void>

  /**
   * Get noun with metadata combined (v4.0.0)
   * @returns Combined HNSWNounWithMetadata or null
   */
  getNoun(id: string): Promise<HNSWNounWithMetadata | null>

  /**
   * Get nouns with pagination and filtering
   * @param options Pagination and filtering options
   * @returns Promise that resolves to a paginated result of nouns
   */
  getNouns(options?: {
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
  }>

  /**
   * Get nouns by noun type
   * @param nounType The noun type to filter by
   * @returns Promise that resolves to an array of nouns of the specified noun type
   * @deprecated Use getNouns() with filter.nounType instead
   */
  getNounsByNounType(nounType: string): Promise<HNSWNounWithMetadata[]>

  deleteNoun(id: string): Promise<void>

  /**
   * Save verb - Pure HNSW verb with core fields only (v4.0.0)
   * @param verb Pure HNSW verb data (vector + core fields, no user metadata)
   * Note: Use saveVerbMetadata() to save metadata separately
   */
  saveVerb(verb: HNSWVerb): Promise<void>

  /**
   * Get verb with metadata combined (v4.0.0)
   * @returns Combined HNSWVerbWithMetadata or null
   */
  getVerb(id: string): Promise<HNSWVerbWithMetadata | null>

  /**
   * Get verbs with pagination and filtering
   * @param options Pagination and filtering options
   * @returns Promise that resolves to a paginated result of verbs
   */
  getVerbs(options?: {
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
  }>

  /**
   * Get verbs by source
   * @param sourceId The source ID to filter by
   * @returns Promise that resolves to an array of verbs with the specified source ID
   * @deprecated Use getVerbs() with filter.sourceId instead
   */
  getVerbsBySource(sourceId: string): Promise<HNSWVerbWithMetadata[]>

  /**
   * Get verbs by target
   * @param targetId The target ID to filter by
   * @returns Promise that resolves to an array of verbs with the specified target ID
   * @deprecated Use getVerbs() with filter.targetId instead
   */
  getVerbsByTarget(targetId: string): Promise<HNSWVerbWithMetadata[]>

  /**
   * Get verbs by type
   * @param type The verb type to filter by
   * @returns Promise that resolves to an array of verbs with the specified type
   * @deprecated Use getVerbs() with filter.verbType instead
   */
  getVerbsByType(type: string): Promise<HNSWVerbWithMetadata[]>

  deleteVerb(id: string): Promise<void>

  /**
   * Save metadata (v4.0.0: now typed)
   * @param id Entity ID
   * @param metadata Typed noun metadata
   */
  saveMetadata(id: string, metadata: NounMetadata): Promise<void>

  /**
   * Get metadata (v4.0.0: now typed)
   * @param id Entity ID
   * @returns Typed noun metadata or null
   */
  getMetadata(id: string): Promise<NounMetadata | null>

  /**
   * Get multiple metadata objects in batches (prevents socket exhaustion)
   * @param ids Array of IDs to get metadata for
   * @returns Promise that resolves to a Map of id -> metadata (v4.0.0: typed)
   */
  getMetadataBatch?(ids: string[]): Promise<Map<string, NounMetadata>>

  /**
   * Get noun metadata from storage (v4.0.0: now typed)
   * @param id The ID of the noun
   * @returns Promise that resolves to the metadata or null if not found
   */
  getNounMetadata(id: string): Promise<NounMetadata | null>

  /**
   * Save verb metadata to storage (v4.0.0: now typed)
   * @param id The ID of the verb
   * @param metadata The metadata to save
   * @returns Promise that resolves when the metadata is saved
   */
  saveVerbMetadata(id: string, metadata: VerbMetadata): Promise<void>

  /**
   * Get verb metadata from storage (v4.0.0: now typed)
   * @param id The ID of the verb
   * @returns Promise that resolves to the metadata or null if not found
   */
  getVerbMetadata(id: string): Promise<VerbMetadata | null>

  clear(): Promise<void>

  /**
   * Batch delete multiple objects from storage (v4.0.0)
   * Efficient deletion of large numbers of entities using cloud provider batch APIs.
   * Significantly faster and cheaper than individual deletes (up to 1000x speedup).
   *
   * @param keys - Array of object keys (paths) to delete
   * @param options - Optional configuration for batch deletion
   * @param options.maxRetries - Maximum number of retry attempts per batch (default: 3)
   * @param options.retryDelayMs - Base delay between retries in milliseconds (default: 1000)
   * @param options.continueOnError - Continue processing remaining batches if one fails (default: true)
   * @returns Promise with deletion statistics
   *
   * @example
   * const result = await storage.batchDelete(
   *   ['path1', 'path2', 'path3'],
   *   { continueOnError: true }
   * )
   * console.log(`Deleted: ${result.successfulDeletes}/${result.totalRequested}`)
   * console.log(`Failed: ${result.failedDeletes}`)
   */
  batchDelete?(
    keys: string[],
    options?: {
      maxRetries?: number
      retryDelayMs?: number
      continueOnError?: boolean
    }
  ): Promise<{
    totalRequested: number
    successfulDeletes: number
    failedDeletes: number
    errors: Array<{ key: string; error: string }>
  }>

  /**
   * Get information about storage usage and capacity
   * @returns Promise that resolves to an object containing storage status information
   */
  getStorageStatus(): Promise<{
    /**
     * The type of storage being used (e.g., 'filesystem', 'opfs', 'memory')
     */
    type: string

    /**
     * The amount of storage being used in bytes
     */
    used: number

    /**
     * The total amount of storage available in bytes, or null if unknown
     */
    quota: number | null

    /**
     * Additional storage-specific information
     */
    details?: Record<string, any>
  }>

  /**
   * Save statistics data
   * @param statistics The statistics data to save
   */
  saveStatistics(statistics: StatisticsData): Promise<void>

  /**
   * Get statistics data
   * @returns Promise that resolves to the statistics data
   */
  getStatistics(): Promise<StatisticsData | null>

  /**
   * Increment a statistic counter
   * @param type The type of statistic to increment ('noun', 'verb', 'metadata')
   * @param service The service that inserted the data
   * @param amount The amount to increment by (default: 1)
   */
  incrementStatistic(
    type: 'noun' | 'verb' | 'metadata',
    service: string,
    amount?: number
  ): Promise<void>

  /**
   * Decrement a statistic counter
   * @param type The type of statistic to decrement ('noun', 'verb', 'metadata')
   * @param service The service that inserted the data
   * @param amount The amount to decrement by (default: 1)
   */
  decrementStatistic(
    type: 'noun' | 'verb' | 'metadata',
    service: string,
    amount?: number
  ): Promise<void>

  /**
   * Update the HNSW index size statistic
   * @param size The new size of the HNSW index
   */
  updateHnswIndexSize(size: number): Promise<void>

  /**
   * Force an immediate flush of statistics to storage
   * This ensures that any pending statistics updates are written to persistent storage
   */
  flushStatisticsToStorage(): Promise<void>

  /**
   * Track field names from a JSON document (v4.0.0: now typed)
   * @param jsonDocument The JSON document to extract field names from
   * @param service The service that inserted the data
   */
  trackFieldNames(jsonDocument: Record<string, unknown>, service: string): Promise<void>

  /**
   * Get available field names by service
   * @returns Record of field names by service
   */
  getAvailableFieldNames(): Promise<Record<string, string[]>>

  /**
   * Get standard field mappings
   * @returns Record of standard field mappings
   */
  getStandardFieldMappings(): Promise<Record<string, Record<string, string[]>>>

  /**
   * Get changes since a specific timestamp (v4.0.0: now typed)
   * @param timestamp The timestamp to get changes since
   * @param limit Optional limit on the number of changes to return
   * @returns Promise that resolves to an array of properly typed changes
   */
  getChangesSince?(timestamp: number, limit?: number): Promise<Change[]>
  
  // NOTE: getAllNouns and getAllVerbs have been removed to prevent expensive full scans.
  // Use getNouns() and getVerbs() with pagination instead.

  /**
   * Get total count of nouns in storage - O(1) operation
   * @returns Promise that resolves to the total number of nouns
   */
  getNounCount(): Promise<number>

  /**
   * Get total count of verbs in storage - O(1) operation
   * @returns Promise that resolves to the total number of verbs
   */
  getVerbCount(): Promise<number>
}
