/**
 * 🧠 Brainy 3.0 Type Definitions
 * 
 * Beautiful, consistent, type-safe interfaces for the future of neural databases
 */

import { Vector } from '../coreTypes.js'
import { NounType, VerbType } from './graphTypes.js'

// ============= Core Types =============

/**
 * Entity (Noun) — the fundamental data unit in Brainy
 *
 * **Data vs Metadata:**
 * - `data`: Content used for vector embeddings. Searchable via **semantic similarity**
 *   (HNSW index) and hybrid text+semantic search. NOT queryable via `where` filters.
 * - `metadata`: Structured fields indexed by MetadataIndex. Queryable via `where`
 *   filters in `find()`. Standard system fields (noun, createdAt, etc.) are stored
 *   alongside user metadata but extracted to top-level Entity fields on read.
 */
export interface Entity<T = any> {
  /** Unique identifier (UUID v4) */
  id: string
  /** Embedding vector (384-dim by default). Empty array when loaded without includeVectors. */
  vector: Vector
  /** Entity type classification (NounType enum) */
  type: NounType
  /** Opaque content — used for embeddings and semantic search. Not indexed by MetadataIndex. */
  data?: any
  /** User-defined structured fields — indexed and queryable via `where` filters. */
  metadata?: T
  /** Multi-tenancy service identifier */
  service?: string
  /** Creation timestamp (ms since epoch) */
  createdAt: number
  /** Last update timestamp (ms since epoch) */
  updatedAt?: number
  /** Source that created this entity (e.g., augmentation info) */
  createdBy?: string
  /** Type classification confidence (0-1) */
  confidence?: number
  /** Entity importance/salience (0-1) */
  weight?: number
}

/**
 * Relation (Verb) — a typed edge connecting two entities
 *
 * **Data vs Metadata (on relationships):**
 * - `data`: Opaque content stored on the relationship. If provided during relate(),
 *   overrides the auto-computed vector (default: average of source+target vectors).
 * - `metadata`: Structured queryable fields on the edge (e.g., role, startDate).
 */
export interface Relation<T = any> {
  /** Unique identifier (UUID v4) */
  id: string
  /** Source entity ID */
  from: string
  /** Target entity ID */
  to: string
  /** Relationship type classification (VerbType enum) */
  type: VerbType
  /** Connection strength (0-1, default: 1.0) */
  weight?: number
  /** Opaque content for the relationship (overrides auto-computed vector if provided) */
  data?: any
  /** User-defined structured fields on the edge */
  metadata?: T
  /** Multi-tenancy service identifier */
  service?: string
  /** Creation timestamp (ms since epoch) */
  createdAt: number
  /** Last update timestamp (ms since epoch) */
  updatedAt?: number
  /** Relationship certainty (0-1) */
  confidence?: number
  /** Evidence for why this relationship was detected */
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

  // Match visibility - shows what matched in hybrid search
  textMatches?: string[]      // Query words found in entity (e.g., ["david", "warrior"])
  textScore?: number          // Normalized text match score (0-1)
  semanticScore?: number      // Semantic similarity score (0-1)
  matchSource?: 'text' | 'semantic' | 'both'  // Where this result came from
  rrfScore?: number           // Raw RRF fusion score (for advanced ranking analysis)
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
 *
 * **Data vs Metadata:**
 * - `data` is embedded into a vector and searchable via semantic similarity (HNSW).
 *   It is NOT indexed by MetadataIndex and NOT queryable via `where` filters.
 * - `metadata` is indexed by MetadataIndex and queryable via `where` filters in `find()`.
 */
export interface AddParams<T = any> {
  /** Content to embed and store. Strings are auto-embedded; objects are JSON-stringified for embedding. */
  data: any | Vector
  /** Entity type classification (required) */
  type: NounType
  /** Structured queryable fields — indexed by MetadataIndex, used in `where` filters */
  metadata?: T
  /** Custom entity ID (auto-generated UUID v4 if not provided) */
  id?: string
  /** Pre-computed embedding vector (skips auto-embedding when provided) */
  vector?: Vector
  /** Multi-tenancy service identifier */
  service?: string
  /** Type classification confidence (0-1) */
  confidence?: number
  /** Entity importance/salience (0-1) */
  weight?: number
  /** Track which augmentation created this entity */
  createdBy?: { augmentation: string; version: string }
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
 *
 * **Data vs Metadata (on relationships):**
 * - `data`: Opaque content for the edge. If provided, overrides the auto-computed
 *   vector (default: average of source+target entity vectors).
 * - `metadata`: Structured queryable fields on the edge.
 */
export interface RelateParams<T = any> {
  /** Source entity ID (required — must exist) */
  from: string
  /** Target entity ID (required — must exist) */
  to: string
  /** Relationship type classification (required) */
  type: VerbType
  /** Connection strength (0-1, default: 1.0) */
  weight?: number
  /** Content for the relationship (optional — overrides auto-computed vector) */
  data?: any
  /** Structured queryable fields on the edge */
  metadata?: T
  /** Create reverse edge too (default: false) */
  bidirectional?: boolean
  /** Multi-tenancy service identifier */
  service?: string
  /** Relationship certainty (0-1) */
  confidence?: number
  /** Evidence for why this relationship exists */
  evidence?: RelationEvidence
}

/**
 * Parameters for updating relationships
 */
export interface UpdateRelationParams<T = any> {
  id: string                 // Relation to update
  weight?: number            // New weight
  data?: any                 // New content
  metadata?: Partial<T>      // Metadata to update
  merge?: boolean            // Merge or replace metadata
}

// ============= Query Parameters =============

/**
 * Unified find parameters — Triple Intelligence search
 *
 * Combines three search dimensions in one query:
 * - **Vector:** `query` or `vector` for semantic/hybrid similarity search (searches `data`)
 * - **Metadata:** `where` for structured field filters (queries `metadata` via MetadataIndex)
 * - **Graph:** `connected` for relationship traversal (via GraphAdjacencyIndex)
 *
 * See also: [Query Operators](../../docs/QUERY_OPERATORS.md) for all `where` operators.
 */
export interface FindParams<T = any> {
  // Vector Intelligence
  /** Natural language or semantic search query (embedded and matched via HNSW + text index) */
  query?: string
  /** Direct vector search (pre-computed embedding) */
  vector?: Vector

  // Metadata Intelligence
  /** Filter by entity type(s). Alias for `where.noun`. */
  type?: NounType | NounType[]
  /** Metadata filters using BFO operators (e.g., `{ year: { greaterThan: 2020 } }`) */
  where?: Partial<T>
  
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

  // Sorting
  orderBy?: string           // Field to sort by (e.g., 'createdAt', 'title', 'metadata.priority')
  order?: 'asc' | 'desc'     // Sort direction: 'asc' (default) or 'desc'

  // Advanced options
  mode?: SearchMode          // Search strategy
  explain?: boolean          // Return scoring explanation
  includeRelations?: boolean // Include entity relationships
  excludeVFS?: boolean       // Exclude VFS entities from results (default: false - VFS included)
  service?: string           // Multi-tenancy filter

  // Hybrid search options
  searchMode?: 'auto' | 'text' | 'semantic' | 'vector' | 'hybrid'  // Search strategy: auto (default), text-only, semantic/vector-only, or explicit hybrid
  hybridAlpha?: number       // Weight between text (0.0) and semantic (1.0) search, default: auto-detected by query length
  
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
  | 'auto'      // Automatically choose best mode (default - enables hybrid text+semantic)
  | 'vector'    // Pure vector search (semantic only)
  | 'semantic'  // Alias for vector search
  | 'text'      // Pure text/keyword search
  | 'metadata'  // Pure metadata filtering
  | 'graph'     // Pure graph traversal
  | 'hybrid'    // Combine all intelligences (explicit hybrid mode)

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
  excludeVFS?: boolean             // Exclude VFS entities (default: false - VFS included)
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
 * Fixed bug where calling without parameters returned empty array
 * Added string ID shorthand syntax
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
  continueOnError?: boolean  // Continue processing if a delete fails
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

// ============= Import Progress =============

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
 * Options for brain.get() entity retrieval
 *
 * **Performance Optimization**:
 * By default, brain.get() loads ONLY metadata (not vectors), resulting in:
 * - **76-81% faster** reads (10ms vs 43ms for metadata-only)
 * - **95% less bandwidth** (300 bytes vs 6KB per entity)
 * - **87% less memory** (optimal for VFS and large-scale operations)
 *
 * **When to use includeVectors**:
 * - Computing similarity on a specific entity (not search): `brain.similar({ to: entity.vector })`
 * - Manual vector operations: `cosineSimilarity(entity.vector, otherVector)`
 * - Inspecting embeddings for debugging
 *
 * **When NOT to use includeVectors** (metadata-only is sufficient):
 * - VFS operations (readFile, stat, readdir) - 100% of cases
 * - Existence checks: `if (await brain.get(id))`
 * - Metadata inspection: `entity.metadata`, `entity.data`, `entity.type`
 * - Relationship traversal: `brain.getRelations({ from: id })`
 * - Search operations: `brain.find()` generates embeddings automatically
 *
 * @example
 * ```typescript
 * // ✅ FAST (default): Metadata-only - 10ms, 300 bytes
 * const entity = await brain.get(id)
 * console.log(entity.data, entity.metadata)  // ✅ Available
 * console.log(entity.vector)  // Empty Float32Array (stub)
 *
 * // ✅ FULL: Load vectors when needed - 43ms, 6KB
 * const fullEntity = await brain.get(id, { includeVectors: true })
 * const similarity = cosineSimilarity(fullEntity.vector, otherVector)
 *
 * // ✅ VFS automatically uses fast path (no change needed)
 * await vfs.readFile('/file.txt')  // 53ms → 10ms (81% faster)
 * ```
 *
 */
export interface GetOptions {
  /**
   * Include 384-dimensional vector embeddings in the response
   *
   * **Default: false** (metadata-only for 76-81% speedup)
   *
   * Set to `true` when you need to:
   * - Compute similarity on this specific entity's vector
   * - Perform manual vector operations
   * - Inspect embeddings for debugging
   *
   * **Note**: Search operations (`brain.find()`) generate vectors automatically,
   * so you don't need this flag for search. Only for direct vector operations
   * on a retrieved entity.
   *
   * @default false
   */
  includeVectors?: boolean
}

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
 * Integration Hub configuration
 *
 * Enables external tool integrations: Excel, Power BI, Google Sheets, etc.
 * Works in all environments with zero external dependencies.
 *
 * @example
 * ```typescript
 * // Enable all integrations with defaults
 * new Brainy({ integrations: true })
 *
 * // Custom configuration
 * new Brainy({
 *   integrations: {
 *     basePath: '/api/v1',
 *     enable: ['odata', 'sheets']
 *   }
 * })
 * ```
 */
export interface IntegrationsConfig {
  /** Base path for all integration endpoints (default: '') */
  basePath?: string

  /** Which integrations to enable (default: all) */
  enable?: ('odata' | 'sheets' | 'sse' | 'webhooks')[] | 'all'

  /** Per-integration config overrides */
  config?: {
    odata?: { basePath?: string }
    sheets?: { basePath?: string }
    sse?: { basePath?: string; heartbeatInterval?: number }
    webhooks?: { maxRetries?: number }
  }
}

/**
 * Brainy configuration
 */
export interface BrainyConfig {
  // Storage configuration
  storage?: {
    type: 'auto' | 'memory' | 'filesystem' | 's3' | 'r2' | 'opfs' | 'gcs'
    options?: any
    branch?: string              // COW branch name (default: 'main')
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

  // HNSW persistence mode
  // Controls when HNSW graph connections are persisted to storage
  // - 'immediate': Persist on every add (slow but durable, default for filesystem)
  // - 'deferred': Persist only on flush/close (fast, default for cloud storage)
  // Cloud storage (GCS/S3/R2/Azure) should use 'deferred' for 30-50× faster adds
  hnswPersistMode?: 'immediate' | 'deferred'

  // HNSW optimization options (v7.11.0)
  hnsw?: {
    quantization?: {
      enabled?: boolean        // default: false — current behavior exactly
      bits?: 8 | 4             // default: 8 (SQ8). SQ4 requires cortex native.
      rerankMultiplier?: number // default: 3 — over-retrieve 3x, rerank with float32
    }
    vectorStorage?: 'memory' | 'lazy'  // default: 'memory' — 'lazy' evicts vectors after insert
  }

  // Memory management options
  maxQueryLimit?: number           // Override auto-detected query result limit (max: 100000)
  reservedQueryMemory?: number     // Memory reserved for queries in bytes (e.g., 1073741824 = 1GB)

  // Embedding initialization
  // Controls when the WASM embedding engine is initialized
  // - false (default): Lazy initialization on first embed() call
  // - true: Eager initialization during brain.init()
  // Set to true for cloud deployments (Cloud Run, Lambda) where you want
  // WASM compilation to happen during container startup, not on first request
  eagerEmbeddings?: boolean

  // Plugin configuration
  // Controls which plugins are loaded during init()
  // - undefined (default): Auto-detect installed plugins (@soulcraft/cortex, etc.)
  // - false: No plugins — skip auto-detection entirely
  // - []: No plugins — skip auto-detection entirely
  // - ['@soulcraft/cortex']: Load only specified plugins, no auto-detection
  plugins?: string[] | false

  // Logging configuration
  verbose?: boolean         // Enable verbose logging
  silent?: boolean          // Suppress all logging output

  // Integration Hub
  // Enable external tool integrations: Excel, Power BI, Google Sheets, etc.
  // - true: Enable all integrations with default paths
  // - false/undefined: Disable integrations (default)
  // - IntegrationsConfig: Custom configuration
  integrations?: boolean | IntegrationsConfig
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

// ============= Content Extraction Types =============

/**
 * Detected content type for smart text extraction
 *
 */
export type ContentType = 'plaintext' | 'richtext-json' | 'html' | 'markdown'

/**
 * Content category for extracted segments
 *
 * Universal categories that work across documents, code, and UI:
 * - 'title': Names the subject — headings, identifiers, labels, JSON keys
 * - 'annotation': Human explanation — comments, docstrings, captions, alt text
 * - 'content': Body substance — paragraphs, list items, flowing text
 * - 'value': Data literals — strings, numbers, form values, error messages
 * - 'code': Unparsed code blocks (custom parsers decompose into above)
 * - 'structural': Boilerplate — keywords, operators, punctuation, formatting
 *
 * Built-in extractors produce: 'title', 'content', 'code'.
 * All 6 categories are available for custom parsers.
 */
export type ContentCategory = 'title' | 'annotation' | 'content' | 'value' | 'code' | 'structural'

/**
 * A segment of extracted text with its content category
 *
 */
export interface ExtractedSegment {
  /** The extracted text content */
  text: string
  /** What role this text plays: 'title' | 'annotation' | 'content' | 'value' | 'code' | 'structural' */
  contentCategory: ContentCategory
}

// ============= Semantic Highlighting Types =============

/**
 * Parameters for hybrid highlighting
 *
 * Zero-config highlighting that returns both text (exact) and semantic (concept) matches.
 * Perfect for UI highlighting at different levels.
 *
 * Added contentType hint and contentExtractor callback for structured text
 * (rich-text JSON, HTML, Markdown). Auto-detects format when not specified.
 *
 * @example
 * ```typescript
 * // Plain text
 * const highlights = await brain.highlight({
 *   query: "david the warrior",
 *   text: "David Smith is a brave fighter who battles dragons"
 * })
 *
 * // Rich-text JSON (auto-detected)
 * const highlights = await brain.highlight({
 *   query: "david the warrior",
 *   text: JSON.stringify(tiptapDocument)
 * })
 *
 * // Custom extractor (for proprietary formats)
 * const highlights = await brain.highlight({
 *   query: "function",
 *   text: sourceCode,
 *   contentExtractor: (text) => treeSitterParse(text)
 * })
 * ```
 */
export interface HighlightParams {
  /** The search query to match against */
  query: string

  /** The text to highlight (e.g., entity.data) */
  text: string

  /** Granularity of highlighting: 'word' (default), 'phrase', or 'sentence' */
  granularity?: 'word' | 'phrase' | 'sentence'

  /** Minimum semantic similarity score for semantic matches (default: 0.5) */
  threshold?: number

  /**
   * Optional content type hint to skip auto-detection.
   * When omitted, the content type is detected from the text content.
   */
  contentType?: ContentType

  /**
   * Optional custom content extractor function.
   * When provided, bypasses built-in detection and extraction entirely.
   * Use this to plug in custom parsers (tree-sitter, Monaco, proprietary formats).
   */
  contentExtractor?: (text: string) => ExtractedSegment[]
}

/**
 * A highlight showing which text matched the query
 *
 * matchType tells the UI how to style the highlight:
 * - 'text': Exact word match (strongest signal, highest confidence)
 * - 'semantic': Conceptually similar match (may need softer highlight)
 */
export interface Highlight {
  /** The text that matched */
  text: string

  /** Match score (0-1). For text matches, always 1.0. For semantic, varies by similarity. */
  score: number

  /** Position in original text [start, end] */
  position: [number, number]

  /** Match type: 'text' (exact word match) or 'semantic' (concept match) */
  matchType: 'text' | 'semantic'

  /**
   * Content category of the source segment: 'title' | 'annotation' | 'content' | 'value' | 'code' | 'structural'.
   * Present when the input text was structured (JSON, HTML, Markdown).
   */
  contentCategory?: ContentCategory
}

// ============= Export all types =============

export * from './graphTypes.js'  // Re-export NounType, VerbType, etc.