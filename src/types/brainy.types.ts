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
  metadata?: T
  service?: string
  createdAt: number
  updatedAt?: number
  createdBy?: string
}

/**
 * Relation representation (replaces GraphVerb)
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
}

/**
 * Search result with similarity score
 */
export interface Result<T = any> {
  id: string
  score: number
  entity: Entity<T>
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
}

/**
 * Parameters for creating relationships
 */
export interface RelateParams<T = any> {
  from: string                // Source entity ID
  to: string                  // Target entity ID
  type: VerbType             // Relationship type from enum
  weight?: number            // Connection strength (0-1, default: 1)
  metadata?: T               // Edge metadata
  bidirectional?: boolean    // Create reverse edge too
  service?: string           // Multi-tenancy
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
  
  // Advanced options
  mode?: SearchMode          // Search strategy
  explain?: boolean          // Return scoring explanation
  includeRelations?: boolean // Include entity relationships
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
  depth?: number             // Max traversal depth (default: 1)
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
}

/**
 * Parameters for getting relationships
 */
export interface GetRelationsParams {
  from?: string              // Source entity
  to?: string                // Target entity
  type?: VerbType | VerbType[] // Relationship types
  limit?: number             // Max results
  offset?: number            // Pagination
  cursor?: string            // Cursor pagination
  service?: string           // Multi-tenancy
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
    type: 'memory' | 'filesystem' | 's3' | 'r2' | 'opfs'
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
  
  // Advanced options
  warmup?: boolean          // Warm up on init
  realtime?: boolean        // Enable real-time updates
  multiTenancy?: boolean    // Enable service isolation
  telemetry?: boolean       // Send anonymous usage stats
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