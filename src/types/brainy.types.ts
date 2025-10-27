/**
 * 🧠 Brainy 3.0 Type Definitions
 * 
 * Beautiful, consistent, type-safe interfaces for the future of neural databases
 */

import { Vector } from '../coreTypes.js'
import { NounType, VerbType } from './graphTypes.js'

// ============= Core Types =============

/**
 * Entity representation (replaces GraphNoun)
 */
export interface Entity<T = any> {
  id: string
  vector: Vector
  type: NounType
  data?: any
  metadata?: T
  service?: string
  createdAt: number
  updatedAt?: number
  createdBy?: string
  confidence?: number  // Type classification confidence (0-1)
  weight?: number      // Entity importance/salience (0-1)
}

/**
 * Relation representation (replaces GraphVerb)
 * Enhanced with confidence scoring and evidence tracking
 */
export interface Relation<T = any> {
  id: string
  from: string
  to: string
  type: VerbType
  weight?: number
  metadata?: T
  service?: string
  createdAt: number
  updatedAt?: number

  // NEW: Confidence and evidence (optional for backward compatibility)
  confidence?: number  // 0-1 score indicating relationship certainty
  evidence?: RelationEvidence
}

/**
 * Evidence for why a relationship was detected
 */
export interface RelationEvidence {
  sourceText?: string  // Text that indicated this relationship
  position?: {         // Position in source text
    start: number
    end: number
  }
  method: 'neural' | 'pattern' | 'structural' | 'explicit'  // How it was detected
  reasoning?: string   // Human-readable explanation
}

/**
 * Search result with similarity score
 *
 * Flattens commonly-used entity fields to top level for convenience,
 * while preserving full entity in 'entity' field for backward compatibility.
 */
export interface Result<T = any> {
  // Search metadata
  id: string
  score: number

  // Convenience: Common entity fields flattened to top level
  type?: NounType      // Entity type (from entity.type)
  metadata?: T         // Entity metadata (from entity.metadata)
  data?: any           // Entity data (from entity.data)
  confidence?: number  // Type classification confidence (from entity.confidence)
  weight?: number      // Entity importance (from entity.weight)

  // Full entity (preserved for backward compatibility)
  entity: Entity<T>

  // Score transparency
  explanation?: ScoreExplanation
}

/**
 * Score explanation for transparency
 */
export interface ScoreExplanation {
  vectorScore?: number
  metadataScore?: number
  graphScore?: number
  boosts?: Record<string, number>
  penalties?: Record<string, number>
}

// ============= Operation Parameters =============

/**
 * Parameters for adding entities
 */
export interface AddParams<T = any> {
  data: any | Vector           // Content to embed or pre-computed vector
  type: NounType               // Entity type from enum
  metadata?: T                 // Optional metadata
  id?: string                  // Optional custom ID
  vector?: Vector              // Pre-computed vector (skip embedding)
  service?: string             // Multi-tenancy support
  confidence?: number          // Type classification confidence (0-1)
  weight?: number              // Entity importance/salience (0-1)
  createdBy?: { augmentation: string; version: string }  // Track entity source
}

/**
 * Parameters for updating entities
 */
export interface UpdateParams<T = any> {
  id: string                   // Entity to update
  data?: any                   // New content to re-embed
  type?: NounType             // Change type
  metadata?: Partial<T>        // Metadata to update
  merge?: boolean             // Merge or replace metadata (default: true)
  vector?: Vector             // New pre-computed vector
  confidence?: number          // Update type classification confidence
  weight?: number              // Update entity importance/salience
}

/**
 * Parameters for creating relationships
 * Enhanced with confidence scoring and evidence tracking
 */
export interface RelateParams<T = any> {
  from: string                // Source entity ID
  to: string                  // Target entity ID
  type: VerbType             // Relationship type from enum
  weight?: number            // Connection strength (0-1, default: 1)
  metadata?: T               // Edge metadata
  bidirectional?: boolean    // Create reverse edge too
  service?: string           // Multi-tenancy

  // NEW: Confidence and evidence (optional)
  confidence?: number        // Relationship certainty (0-1)
  evidence?: RelationEvidence  // Why this relationship exists
}

/**
 * Parameters for updating relationships
 */
export interface UpdateRelationParams<T = any> {
  id: string                 // Relation to update
  weight?: number            // New weight
  metadata?: Partial<T>      // Metadata to update
  merge?: boolean            // Merge or replace metadata
}

// ============= Query Parameters =============

/**
 * Unified find parameters - Triple Intelligence
 */
export interface FindParams<T = any> {
  // Vector Intelligence
  query?: string             // Natural language or semantic search
  vector?: Vector            // Direct vector search
  
  // Metadata Intelligence
  type?: NounType | NounType[]  // Filter by entity type(s)
  where?: Partial<T>         // Metadata filters
  
  // Graph Intelligence
  connected?: GraphConstraints
  
  // Proximity search
  near?: {
    id: string               // Find near this entity
    threshold?: number       // Min similarity (0-1)
  }
  
  // Control options
  limit?: number             // Max results (default: 10)
  offset?: number            // Skip N results
  cursor?: string            // Cursor-based pagination

  // Sorting (v4.5.4)
  orderBy?: string           // Field to sort by (e.g., 'createdAt', 'title', 'metadata.priority')
  order?: 'asc' | 'desc'     // Sort direction: 'asc' (default) or 'desc'

  // Advanced options
  mode?: SearchMode          // Search strategy
  explain?: boolean          // Return scoring explanation
  includeRelations?: boolean // Include entity relationships
  excludeVFS?: boolean       // v4.7.0: Exclude VFS entities from results (default: false - VFS included)
  service?: string           // Multi-tenancy filter
  
  // Triple Intelligence Fusion
  fusion?: {
    strategy?: 'adaptive' | 'weighted' | 'progressive'
    weights?: {
      vector?: number
      graph?: number
      field?: number
    }
  }
  
  // Performance options
  writeOnly?: boolean        // Skip validation for high-speed ingestion
}

/**
 * Graph constraints for search
 */
export interface GraphConstraints {
  to?: string                // Connected to this entity
  from?: string              // Connected from this entity
  via?: VerbType | VerbType[] // Via these relationship types
  type?: VerbType | VerbType[] // Alias for via
  depth?: number             // Max traversal depth (default: 1)
  direction?: 'in' | 'out' | 'both' // Direction of traversal (default: 'both')
  bidirectional?: boolean    // Consider both directions
}

/**
 * Search modes
 */
export type SearchMode = 
  | 'auto'      // Automatically choose best mode
  | 'vector'    // Pure vector search
  | 'metadata'  // Pure metadata filtering
  | 'graph'     // Pure graph traversal
  | 'hybrid'    // Combine all intelligences

/**
 * Parameters for similarity search
 */
export interface SimilarParams<T = any> {
  to: string | Entity<T> | Vector  // Find similar to this
  limit?: number                   // Max results (default: 10)
  threshold?: number               // Min similarity score
  type?: NounType | NounType[]    // Restrict to types
  where?: Partial<T>               // Additional filters
  service?: string                 // Multi-tenancy
  excludeVFS?: boolean             // v4.7.0: Exclude VFS entities (default: false - VFS included)
}

/**
 * Parameters for getting relationships
 *
 * All parameters are optional. When called without parameters, returns all relationships
 * with pagination (default limit: 100).
 *
 * @example
 * ```typescript
 * // Get all relationships (default limit: 100)
 * const all = await brain.getRelations()
 *
 * // Get relationships from a specific entity (string shorthand)
 * const fromEntity = await brain.getRelations(entityId)
 *
 * // Equivalent to:
 * const fromEntity2 = await brain.getRelations({ from: entityId })
 *
 * // Get relationships to a specific entity
 * const toEntity = await brain.getRelations({ to: entityId })
 *
 * // Filter by relationship type
 * const friends = await brain.getRelations({ type: VerbType.FriendOf })
 *
 * // Pagination
 * const page2 = await brain.getRelations({ offset: 100, limit: 50 })
 *
 * // Combined filters
 * const filtered = await brain.getRelations({
 *   from: entityId,
 *   type: VerbType.WorksWith,
 *   limit: 20
 * })
 * ```
 *
 * @since v4.1.3 - Fixed bug where calling without parameters returned empty array
 * @since v4.1.3 - Added string ID shorthand syntax
 */
export interface GetRelationsParams {
  /**
   * Filter by source entity ID
   *
   * Returns all relationships originating from this entity.
   */
  from?: string

  /**
   * Filter by target entity ID
   *
   * Returns all relationships pointing to this entity.
   */
  to?: string

  /**
   * Filter by relationship type(s)
   *
   * Can be a single VerbType or array of VerbTypes.
   */
  type?: VerbType | VerbType[]

  /**
   * Maximum number of results to return
   *
   * @default 100
   */
  limit?: number

  /**
   * Number of results to skip (offset-based pagination)
   *
   * @default 0
   */
  offset?: number

  /**
   * Cursor for cursor-based pagination
   *
   * More efficient than offset for large result sets.
   */
  cursor?: string

  /**
   * Filter by service (multi-tenancy)
   *
   * Only return relationships belonging to this service.
   */
  service?: string
}

// ============= Batch Operations =============

/**
 * Batch add parameters
 */
export interface AddManyParams<T = any> {
  items: AddParams<T>[]      // Items to add
  parallel?: boolean         // Process in parallel (default: true)
  chunkSize?: number        // Batch size (default: 100)
  onProgress?: (done: number, total: number) => void
  continueOnError?: boolean  // Continue if some fail
}

/**
 * Batch update parameters
 */
export interface UpdateManyParams<T = any> {
  items: UpdateParams<T>[]   // Items to update
  parallel?: boolean
  chunkSize?: number
  onProgress?: (done: number, total: number) => void
  continueOnError?: boolean
}

/**
 * Batch delete parameters
 */
export interface DeleteManyParams {
  ids?: string[]             // Specific IDs to delete
  type?: NounType           // Delete all of type
  where?: any               // Delete by metadata
  limit?: number            // Max to delete (safety)
  onProgress?: (done: number, total: number) => void
}

/**
 * Batch relate parameters
 */
export interface RelateManyParams<T = any> {
  items: RelateParams<T>[]   // Relations to create
  parallel?: boolean
  chunkSize?: number
  onProgress?: (done: number, total: number) => void
  continueOnError?: boolean
}

/**
 * Batch result
 */
export interface BatchResult<T = any> {
  successful: T[]            // Successfully processed items
  failed: Array<{           // Failed items with errors
    item: any
    error: string
  }>
  total: number             // Total attempted
  duration: number          // Time taken in ms
}

// ============= Import Progress (v4.5.0) =============

/**
 * Import stage enumeration
 */
export type ImportStage =
  | 'detecting'   // Detecting file format
  | 'reading'     // Reading file from disk/network
  | 'parsing'     // Parsing file structure (CSV rows, PDF pages, Excel sheets)
  | 'extracting'  // Extracting entities using AI
  | 'indexing'    // Creating graph nodes and relationships
  | 'completing'  // Final cleanup and stats

/**
 * Overall import status
 */
export type ImportStatus =
  | 'starting'    // Initializing import
  | 'processing'  // Actively importing
  | 'completing'  // Finalizing
  | 'done'        // Complete

/**
 * Comprehensive import progress information
 *
 * Provides multi-dimensional progress tracking:
 * - Bytes processed (always deterministic)
 * - Entities extracted and indexed
 * - Stage-specific progress
 * - Time estimates
 * - Performance metrics
 *
 * @since v4.5.0
 */
export interface ImportProgress {
  // Overall Progress
  overall_progress: number        // 0-100 weighted estimate across all stages
  overall_status: ImportStatus    // High-level status

  // Current Stage
  stage: ImportStage              // What's happening now
  stage_progress: number          // 0-100 within current stage (0 if unknown)
  stage_message: string           // Human-readable: "Extracting entities from PDF..."

  // Bytes (Always Available - most deterministic metric)
  bytes_processed: number         // Bytes read/processed so far
  total_bytes: number             // Total file size (0 if streaming/unknown)
  bytes_percentage: number        // Convenience: bytes_processed / total_bytes * 100
  bytes_per_second?: number       // Processing rate (relevant during parsing)

  // Entities (Available when extraction starts)
  entities_extracted: number      // Entities found during AI extraction
  entities_indexed: number        // Entities added to Brainy graph
  entities_per_second?: number    // Entities/sec (relevant during extraction/indexing)
  estimated_total_entities?: number  // Estimated final count
  estimation_confidence?: number  // 0-1 confidence in estimation

  // Timing
  elapsed_ms: number              // Time since import started
  estimated_remaining_ms?: number // Estimated time remaining
  estimated_total_ms?: number     // Estimated total time

  // Context (helps users understand what's happening)
  current_item?: string           // "Processing page 5 of 23"
  current_file?: string           // "Sheet: Q2 Sales Data"
  file_number?: number            // 3 (when importing multiple files)
  total_files?: number            // 10

  // Performance Metrics (for debugging/optimization)
  metrics?: {
    parsing_rate_mbps?: number              // MB/s during parsing
    extraction_rate_entities_per_sec?: number  // Entities/s during extraction
    indexing_rate_entities_per_sec?: number    // Entities/s during indexing
    memory_usage_mb?: number                // Current memory usage
    peak_memory_mb?: number                 // Peak memory usage
  }

  // Backwards Compatibility (for legacy code)
  current: number  // Alias for entities_indexed
  total: number    // Alias for estimated_total_entities or 0
}

/**
 * Import progress callback - backwards compatible
 *
 * Supports both legacy (current, total) and new (ImportProgress object) signatures
 */
export type ImportProgressCallback =
  | ((progress: ImportProgress) => void)
  | ((current: number, total: number) => void)

/**
 * Stage weight configuration for overall progress calculation
 *
 * These weights reflect the typical time distribution across stages.
 * Extraction is typically the slowest stage (60% of time).
 */
export interface StageWeights {
  detecting: number    // Default: 0.01 (1%)
  reading: number      // Default: 0.05 (5%)
  parsing: number      // Default: 0.10 (10%)
  extracting: number   // Default: 0.60 (60% - slowest!)
  indexing: number     // Default: 0.20 (20%)
  completing: number   // Default: 0.04 (4%)
}

/**
 * Import result statistics
 */
export interface ImportStats {
  graphNodesCreated: number     // Entities added to graph
  graphEdgesCreated: number     // Relationships created
  vfsFilesCreated: number       // VFS files created
  duration: number              // Total time in ms
  bytesProcessed: number        // Total bytes read
  averageRate: number           // Average entities/sec
  peakMemoryMB?: number         // Peak memory usage
}

/**
 * Import operation result
 */
export interface ImportResult {
  success: boolean
  stats: ImportStats
  errors?: Array<{
    stage: ImportStage
    message: string
    error?: any
  }>
}

// ============= Advanced Operations =============

/**
 * Graph traversal parameters
 */
export interface TraverseParams {
  from: string | string[]    // Starting node(s)
  direction?: 'out' | 'in' | 'both'  // Traversal direction
  types?: VerbType[]        // Edge types to follow
  depth?: number            // Max depth (default: 2)
  strategy?: 'bfs' | 'dfs' // Breadth or depth first
  filter?: (entity: Entity, depth: number, path: string[]) => boolean
  limit?: number            // Max nodes to visit
}

/**
 * Aggregation parameters
 */
export interface AggregateParams<T = any> {
  query?: FindParams<T>      // Base query to aggregate
  groupBy: string | string[]  // Fields to group by
  metrics: AggregateMetric[]  // Metrics to calculate
  having?: any               // Post-aggregation filters
  orderBy?: string           // Sort results
  limit?: number             // Max groups
}

/**
 * Aggregate metrics
 */
export type AggregateMetric = 
  | 'count'
  | 'sum'
  | 'avg'
  | 'min'
  | 'max'
  | 'stddev'
  | { custom: string; field: string }

// ============= Configuration =============

/**
 * Brainy configuration
 */
export interface BrainyConfig {
  // Storage configuration
  storage?: {
    type: 'auto' | 'memory' | 'filesystem' | 's3' | 'r2' | 'opfs' | 'gcs'
    options?: any
  }
  
  // Model configuration
  model?: {
    type: 'fast' | 'accurate' | 'balanced' | 'custom'
    name?: string           // Custom model name
    precision?: 'q8'
  }
  
  // Index configuration
  index?: {
    m?: number              // HNSW M parameter
    efConstruction?: number // HNSW construction parameter
    efSearch?: number       // HNSW search parameter
  }
  
  // Performance options
  cache?: boolean | {       // Enable caching
    maxSize?: number
    ttl?: number
  }
  
  // Augmentations
  augmentations?: Record<string, any>

  // Distributed configuration
  distributed?: {
    enabled: boolean
    nodeId?: string
    nodes?: string[]           // Other nodes in cluster
    coordinatorUrl?: string    // Coordinator endpoint
    shardCount?: number        // Number of shards (default: 64)
    replicationFactor?: number // Number of replicas (default: 3)
    consensus?: 'raft' | 'none' // Consensus mechanism
    transport?: 'tcp' | 'http' | 'udp'
  }

  // Advanced options
  warmup?: boolean          // Warm up on init
  realtime?: boolean        // Enable real-time updates
  multiTenancy?: boolean    // Enable service isolation
  telemetry?: boolean       // Send anonymous usage stats

  // Performance tuning options for production
  disableAutoRebuild?: boolean     // Disable automatic index rebuilding on init
  disableMetrics?: boolean         // Completely disable metrics collection
  disableAutoOptimize?: boolean    // Disable automatic index optimization
  batchWrites?: boolean            // Enable write batching for better performance
  maxConcurrentOperations?: number // Limit concurrent file operations

  // Logging configuration
  verbose?: boolean         // Enable verbose logging
  silent?: boolean          // Suppress all logging output
}

// ============= Neural API Types =============

/**
 * Neural similarity parameters
 */
export interface NeuralSimilarityParams {
  between?: [any, any]       // Compare two items
  items?: any[]             // Compare multiple items
  explain?: boolean         // Return detailed breakdown
}

/**
 * Neural clustering parameters
 */
export interface NeuralClusterParams {
  items?: string[] | Entity[] // Items to cluster (or all)
  algorithm?: 'hierarchical' | 'kmeans' | 'dbscan' | 'spectral'
  params?: {
    k?: number              // Number of clusters (kmeans)
    threshold?: number      // Distance threshold (hierarchical)
    epsilon?: number        // DBSCAN epsilon
    minPoints?: number      // DBSCAN min points
  }
  visualize?: boolean       // Return visualization data
}

/**
 * Neural anomaly detection parameters
 */
export interface NeuralAnomalyParams {
  threshold?: number        // Standard deviations (default: 2.5)
  type?: NounType          // Check specific type
  method?: 'isolation' | 'lof' | 'statistical' | 'autoencoder'
  returnScores?: boolean    // Return anomaly scores
}

// ============= Export all types =============

export * from './graphTypes.js'  // Re-export NounType, VerbType, etc.