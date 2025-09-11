/**
 * Consistent API Types for Brainy
 * 
 * These types provide a uniform interface for all public methods,
 * using object parameters for consistency and extensibility.
 */

import type { Vector } from '../coreTypes.js'
import type { NounType, VerbType } from './graphTypes.js'

// ============= NOUN OPERATIONS =============

/**
 * Parameters for adding a noun
 */
export interface AddNounParams {
  data: any | Vector        // Content or pre-computed vector
  type: NounType | string   // Noun type (required)
  metadata?: any            // Optional metadata
  id?: string              // Optional custom ID
  service?: string         // Optional service identifier
}

/**
 * Parameters for updating a noun
 */
export interface UpdateNounParams {
  id: string               // Noun ID to update
  data?: any              // New data
  metadata?: any          // New metadata
  type?: NounType | string // New type
}

/**
 * Parameters for getting nouns
 */
export interface GetNounsParams {
  ids?: string[]          // Specific IDs to fetch
  type?: NounType | string | string[] // Filter by type(s)
  limit?: number          // Maximum results
  offset?: number         // Pagination offset
  cursor?: string         // Pagination cursor
  filter?: Record<string, any> // Metadata filters
  service?: string        // Service filter
}

// ============= VERB OPERATIONS =============

/**
 * Parameters for adding a verb (relationship)
 */
export interface AddVerbParams {
  source: string          // Source noun ID
  target: string          // Target noun ID
  type: VerbType | string // Verb type (required)
  weight?: number         // Relationship weight (0-1)
  metadata?: any          // Optional metadata
  service?: string        // Optional service identifier
}

/**
 * Parameters for getting verbs
 */
export interface GetVerbsParams {
  source?: string         // Filter by source
  target?: string         // Filter by target
  type?: VerbType | string | string[] // Filter by type(s)
  limit?: number          // Maximum results
  offset?: number         // Pagination offset
  cursor?: string         // Pagination cursor
  filter?: Record<string, any> // Metadata filters
  service?: string        // Service filter
}

// ============= SEARCH OPERATIONS =============

/**
 * Unified search parameters
 */
export interface SearchParams {
  query: string | Vector   // Text query or vector
  limit?: number           // Maximum results (default: 10)
  threshold?: number       // Similarity threshold (0-1)
  filter?: {
    type?: NounType | string | string[]  // Filter by noun type(s)
    metadata?: Record<string, any>       // Metadata filters
    service?: string                      // Service filter
  }
  includeMetadata?: boolean // Include metadata in results
  includeVectors?: boolean  // Include vectors in results
}

/**
 * Parameters for similarity search
 */
export interface SimilarityParams {
  id?: string              // Find similar to this ID
  data?: any | Vector      // Or find similar to this data
  limit?: number           // Maximum results (default: 10)
  threshold?: number       // Similarity threshold (0-1)
  filter?: {
    type?: NounType | string | string[]
    metadata?: Record<string, any>
    service?: string
  }
}

/**
 * Parameters for related items search
 */
export interface RelatedParams {
  id: string               // Starting noun ID
  depth?: number           // Traversal depth (default: 1)
  limit?: number           // Max results per level
  types?: VerbType[] | string[] // Relationship types to follow
  direction?: 'outgoing' | 'incoming' | 'both'
}

// ============= BATCH OPERATIONS =============

/**
 * Parameters for batch noun operations
 */
export interface BatchNounsParams {
  items: AddNounParams[]   // Array of nouns to add
  parallel?: boolean       // Process in parallel
  chunkSize?: number       // Batch size for processing
  onProgress?: (completed: number, total: number) => void
}

/**
 * Parameters for batch verb operations
 */
export interface BatchVerbsParams {
  items: AddVerbParams[]   // Array of verbs to add
  parallel?: boolean       // Process in parallel
  chunkSize?: number       // Batch size for processing
  onProgress?: (completed: number, total: number) => void
}

// ============= STATISTICS & METADATA =============

/**
 * Parameters for statistics queries
 */
export interface StatisticsParams {
  detailed?: boolean       // Include detailed breakdown
  includeAugmentations?: boolean // Include augmentation stats
  includeMemory?: boolean  // Include memory usage
  service?: string         // Filter by service
}

/**
 * Parameters for metadata operations
 */
export interface MetadataParams {
  id: string               // Entity ID
  metadata: any            // Metadata to set/update
  merge?: boolean          // Merge with existing (vs replace)
}

// ============= CONFIGURATION =============

/**
 * Dynamic configuration update parameters
 */
export interface ConfigUpdateParams {
  embeddings?: {
    model?: string
    precision?: 'q8'
    cache?: boolean
  }
  augmentations?: {
    [name: string]: boolean | Record<string, any>
  }
  storage?: {
    type?: string
    config?: any
  }
  performance?: {
    batchSize?: number
    maxConcurrency?: number
    cacheSize?: number
  }
}

// ============= TRIPLE INTELLIGENCE API =============

/**
 * API for Triple Intelligence Engine to access Brainy internals
 * This provides type-safe access without 'as any' casts
 */
export interface TripleIntelligenceAPI {
  // Vector operations
  vectorSearch(vector: Vector | string, limit: number): Promise<Array<{id: string, score: number, entity?: any}>>
  
  // Graph operations
  graphTraversal(options: {
    start: string | string[]
    type?: string | string[]
    direction?: 'in' | 'out' | 'both'
    maxDepth?: number
  }): Promise<Array<{id: string, score: number, depth: number}>>
  
  // Metadata operations
  metadataQuery(where: Record<string, any>): Promise<Set<string>>
  getEntity(id: string): Promise<any>
  
  // Storage operations
  getVerbsBySource(sourceId: string): Promise<any[]>
  getVerbsByTarget(targetId: string): Promise<any[]>
  
  // Statistics
  getStatistics(): Promise<{
    totalCount: number
    fieldStats: Record<string, {
      min: number
      max: number
      cardinality: number
      type: string
    }>
  }>
  
  // Index access
  getAllNouns(): Map<string, any>
  hasMetadataIndex(): boolean
}

// ============= RESULTS =============

/**
 * Unified search result
 */
export interface SearchResult<T = any> {
  id: string
  score: number           // Similarity score (0-1)
  data?: T                // Original data
  metadata?: any          // Metadata if requested
  vector?: Vector         // Vector if requested
  type?: string           // Noun type
  distance?: number       // Raw distance metric
}

/**
 * Paginated result wrapper
 */
export interface PaginatedResult<T> {
  items: T[]
  total?: number
  hasMore: boolean
  nextCursor?: string
  previousCursor?: string
}

/**
 * Batch operation result
 */
export interface BatchResult {
  successful: string[]    // Successfully processed IDs
  failed: Array<{
    index: number
    error: string
    item?: any
  }>
  total: number
  duration: number        // Total time in ms
}

/**
 * Statistics result
 */
export interface StatisticsResult {
  nouns: {
    total: number
    byType: Record<string, number>
  }
  verbs: {
    total: number
    byType: Record<string, number>
  }
  storage: {
    used: number
    type: string
  }
  performance?: {
    avgLatency: number
    throughput: number
    cacheHitRate?: number
  }
  augmentations?: Record<string, any>
  memory?: {
    used: number
    limit: number
  }
}

// ============= ERRORS =============

/**
 * Structured error for API operations
 */
export class BrainyAPIError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 400,
    public details?: any
  ) {
    super(message)
    this.name = 'BrainyAPIError'
  }
}

// Error codes
export const ErrorCodes = {
  INVALID_TYPE: 'INVALID_TYPE',
  NOT_FOUND: 'NOT_FOUND',
  DUPLICATE_ID: 'DUPLICATE_ID',
  INVALID_VECTOR: 'INVALID_VECTOR',
  STORAGE_ERROR: 'STORAGE_ERROR',
  EMBEDDING_ERROR: 'EMBEDDING_ERROR',
  AUGMENTATION_ERROR: 'AUGMENTATION_ERROR',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  QUOTA_EXCEEDED: 'QUOTA_EXCEEDED',
  UNAUTHORIZED: 'UNAUTHORIZED'
} as const