/**
 * BrainyData
 * Main class that provides the vector database functionality
 */
import { HNSWIndex } from './hnsw/hnswIndex.js';
import { HNSWIndexOptimized, HNSWOptimizedConfig } from './hnsw/hnswIndexOptimized.js';
import { DistanceFunction, GraphVerb, EmbeddingFunction, HNSWConfig, SearchResult, SearchCursor, PaginatedSearchResult, StorageAdapter, Vector, VectorDocument } from './coreTypes.js';
import { MetadataIndexManager, MetadataIndexConfig } from './utils/metadataIndex.js';
import { NounType, VerbType } from './types/graphTypes.js';
import { WebSocketConnection, IAugmentation } from './types/augmentations.js';
import { BrainyDataInterface } from './types/brainyDataInterface.js';
import { DistributedConfig } from './types/distributedTypes.js';
import { SearchCacheConfig } from './utils/searchCache.js';
import { AugmentationManager } from './augmentationManager.js';
export interface BrainyDataConfig {
    /**
     * HNSW index configuration
     * Uses the optimized HNSW implementation which supports large datasets
     * through product quantization and disk-based storage
     */
    hnsw?: Partial<HNSWOptimizedConfig>;
    /**
     * Default service name to use for all operations
     * When specified, this service name will be used for all operations
     * that don't explicitly provide a service name
     */
    defaultService?: string;
    /**
     * Distance function to use for similarity calculations
     */
    distanceFunction?: DistanceFunction;
    /**
     * Custom storage adapter (if not provided, will use OPFS or memory storage)
     */
    storageAdapter?: StorageAdapter;
    /**
     * Storage configuration options
     * These will be passed to createStorage if storageAdapter is not provided
     */
    storage?: {
        requestPersistentStorage?: boolean;
        r2Storage?: {
            bucketName?: string;
            accountId?: string;
            accessKeyId?: string;
            secretAccessKey?: string;
        };
        s3Storage?: {
            bucketName?: string;
            accessKeyId?: string;
            secretAccessKey?: string;
            region?: string;
        };
        gcsStorage?: {
            bucketName?: string;
            accessKeyId?: string;
            secretAccessKey?: string;
            endpoint?: string;
        };
        customS3Storage?: {
            bucketName?: string;
            accessKeyId?: string;
            secretAccessKey?: string;
            endpoint?: string;
            region?: string;
        };
        forceFileSystemStorage?: boolean;
        forceMemoryStorage?: boolean;
        cacheConfig?: {
            hotCacheMaxSize?: number;
            hotCacheEvictionThreshold?: number;
            warmCacheTTL?: number;
            batchSize?: number;
            autoTune?: boolean;
            autoTuneInterval?: number;
            readOnly?: boolean;
        };
    };
    /**
     * Embedding function to convert data to vectors
     */
    embeddingFunction?: EmbeddingFunction;
    /**
     * Set the database to read-only mode
     * When true, all write operations will throw an error
     * Note: Statistics and index optimizations are still allowed unless frozen is also true
     */
    readOnly?: boolean;
    /**
     * Completely freeze the database, preventing all changes including statistics and index optimizations
     * When true, the database is completely immutable (no data changes, no index rebalancing, no statistics updates)
     * This is useful for forensic analysis, testing with deterministic state, or compliance scenarios
     * Default: false (allows optimizations even in readOnly mode)
     */
    frozen?: boolean;
    /**
     * Enable lazy loading in read-only mode
     * When true and in read-only mode, the index is not fully loaded during initialization
     * Nodes are loaded on-demand during search operations
     * This improves startup performance for large datasets
     */
    lazyLoadInReadOnlyMode?: boolean;
    /**
     * Set the database to write-only mode
     * When true, the index is not loaded into memory and search operations will throw an error
     * This is useful for data ingestion scenarios where only write operations are needed
     */
    writeOnly?: boolean;
    /**
     * Allow direct storage reads in write-only mode
     * When true and writeOnly is also true, enables direct ID-based lookups (get, has, exists, getMetadata, getBatch, getVerb)
     * that don't require search indexes. Search operations (search, similar, query, findRelated) remain disabled.
     * This is useful for writer services that need deduplication without loading expensive search indexes.
     */
    allowDirectReads?: boolean;
    /**
     * Remote server configuration for search operations
     */
    remoteServer?: {
        /**
         * WebSocket URL of the remote Brainy server
         */
        url: string;
        /**
         * WebSocket protocols to use for the connection
         */
        protocols?: string | string[];
        /**
         * Whether to automatically connect to the remote server on initialization
         */
        autoConnect?: boolean;
    };
    /**
     * Logging configuration
     */
    logging?: {
        /**
         * Whether to enable verbose logging
         * When false, suppresses non-essential log messages like model loading progress
         * Default: true
         */
        verbose?: boolean;
    };
    /**
     * Metadata indexing configuration
     */
    metadataIndex?: MetadataIndexConfig;
    /**
     * Search result caching configuration
     * Improves performance for repeated queries
     */
    searchCache?: SearchCacheConfig;
    /**
     * Timeout configuration for async operations
     * Controls how long operations wait before timing out
     */
    timeouts?: {
        /**
         * Timeout for get operations in milliseconds
         * Default: 30000 (30 seconds)
         */
        get?: number;
        /**
         * Timeout for add operations in milliseconds
         * Default: 60000 (60 seconds)
         */
        add?: number;
        /**
         * Timeout for delete operations in milliseconds
         * Default: 30000 (30 seconds)
         */
        delete?: number;
    };
    /**
     * Retry policy configuration for failed operations
     * Controls how operations are retried on failure
     */
    retryPolicy?: {
        /**
         * Maximum number of retry attempts
         * Default: 3
         */
        maxRetries?: number;
        /**
         * Initial delay between retries in milliseconds
         * Default: 1000 (1 second)
         */
        initialDelay?: number;
        /**
         * Maximum delay between retries in milliseconds
         * Default: 10000 (10 seconds)
         */
        maxDelay?: number;
        /**
         * Multiplier for exponential backoff
         * Default: 2
         */
        backoffMultiplier?: number;
    };
    /**
     * Real-time update configuration
     * Controls how the database handles updates when data is added by external processes
     */
    realtimeUpdates?: {
        /**
         * Whether to enable automatic updates of the index and statistics
         * When true, the database will periodically check for new data in storage
         * Default: false
         */
        enabled?: boolean;
        /**
         * The interval (in milliseconds) at which to check for updates
         * Default: 30000 (30 seconds)
         */
        interval?: number;
        /**
         * Whether to update statistics when checking for updates
         * Default: true
         */
        updateStatistics?: boolean;
        /**
         * Whether to update the index when checking for updates
         * Default: true
         */
        updateIndex?: boolean;
    };
    /**
     * Distributed mode configuration
     * Enables coordination across multiple Brainy instances
     */
    distributed?: DistributedConfig | boolean;
    /**
     * Cache configuration for optimizing search performance
     * Controls how the system caches data for faster access
     * Particularly important for large datasets in S3 or other remote storage
     */
    cache?: {
        /**
         * Whether to enable auto-tuning of cache parameters
         * When true, the system will automatically adjust cache sizes based on usage patterns
         * Default: true
         */
        autoTune?: boolean;
        /**
         * The interval (in milliseconds) at which to auto-tune cache parameters
         * Only applies when autoTune is true
         * Default: 60000 (60 seconds)
         */
        autoTuneInterval?: number;
        /**
         * Maximum size of the hot cache (most frequently accessed items)
         * If provided, overrides the automatically detected optimal size
         * For large datasets, consider values between 5000-50000 depending on available memory
         */
        hotCacheMaxSize?: number;
        /**
         * Threshold at which to start evicting items from the hot cache
         * Expressed as a fraction of hotCacheMaxSize (0.0 to 1.0)
         * Default: 0.8 (start evicting when cache is 80% full)
         */
        hotCacheEvictionThreshold?: number;
        /**
         * Time-to-live for items in the warm cache in milliseconds
         * Default: 3600000 (1 hour)
         */
        warmCacheTTL?: number;
        /**
         * Batch size for operations like prefetching
         * Larger values improve throughput but use more memory
         * For S3 or remote storage with large datasets, consider values between 50-200
         */
        batchSize?: number;
        /**
         * Read-only mode specific optimizations
         * These settings are only applied when readOnly is true
         */
        readOnlyMode?: {
            /**
             * Maximum size of the hot cache in read-only mode
             * In read-only mode, larger cache sizes can be used since there are no write operations
             * For large datasets, consider values between 10000-100000 depending on available memory
             */
            hotCacheMaxSize?: number;
            /**
             * Batch size for operations in read-only mode
             * Larger values improve throughput in read-only mode
             * For S3 or remote storage with large datasets, consider values between 100-300
             */
            batchSize?: number;
            /**
             * Prefetch strategy for read-only mode
             * Controls how aggressively the system prefetches data
             * Options: 'conservative', 'moderate', 'aggressive'
             * Default: 'moderate'
             */
            prefetchStrategy?: 'conservative' | 'moderate' | 'aggressive';
        };
    };
    /**
     * Intelligent verb scoring configuration
     * Automatically generates weight and confidence scores for verb relationships
     * Off by default - enable by setting enabled: true
     */
    intelligentVerbScoring?: {
        /**
         * Whether to enable intelligent verb scoring
         * Default: false (off by default)
         */
        enabled?: boolean;
        /**
         * Enable semantic proximity scoring based on entity embeddings
         * Default: true
         */
        enableSemanticScoring?: boolean;
        /**
         * Enable frequency-based weight amplification
         * Default: true
         */
        enableFrequencyAmplification?: boolean;
        /**
         * Enable temporal decay for weights
         * Default: true
         */
        enableTemporalDecay?: boolean;
        /**
         * Decay rate per day for temporal scoring (0-1)
         * Default: 0.01 (1% decay per day)
         */
        temporalDecayRate?: number;
        /**
         * Minimum weight threshold
         * Default: 0.1
         */
        minWeight?: number;
        /**
         * Maximum weight threshold
         * Default: 1.0
         */
        maxWeight?: number;
        /**
         * Base confidence score for new relationships
         * Default: 0.5
         */
        baseConfidence?: number;
        /**
         * Learning rate for adaptive scoring (0-1)
         * Default: 0.1
         */
        learningRate?: number;
    };
}
export declare class BrainyData<T = any> implements BrainyDataInterface<T> {
    index: HNSWIndex | HNSWIndexOptimized;
    private storage;
    metadataIndex: MetadataIndexManager | null;
    private isInitialized;
    private isInitializing;
    private embeddingFunction;
    private distanceFunction;
    private requestPersistentStorage;
    private readOnly;
    private frozen;
    private lazyLoadInReadOnlyMode;
    private writeOnly;
    private allowDirectReads;
    private storageConfig;
    private config;
    private useOptimizedIndex;
    private _dimensions;
    private loggingConfig;
    private defaultService;
    private searchCache;
    /**
     * Type-safe augmentation management
     * Access all augmentation operations through this property
     */
    readonly augmentations: AugmentationManager;
    private cacheAutoConfigurator;
    private timeoutConfig;
    private retryConfig;
    private cacheConfig;
    private realtimeUpdateConfig;
    private updateTimerId;
    private maintenanceIntervals;
    private lastUpdateTime;
    private lastKnownNounCount;
    private remoteServerConfig;
    private serverSearchConduit;
    private serverConnection;
    private intelligentVerbScoring;
    private distributedConfig;
    private configManager;
    private partitioner;
    private operationalMode;
    private domainDetector;
    private healthMonitor;
    private statisticsCollector;
    /**
     * Get the vector dimensions
     */
    get dimensions(): number;
    /**
     * Get the maximum connections parameter from HNSW configuration
     */
    get maxConnections(): number;
    /**
     * Get the efConstruction parameter from HNSW configuration
     */
    get efConstruction(): number;
    /**
     * Create a new vector database
     */
    constructor(config?: BrainyDataConfig);
    /**
     * Check if the database is in read-only mode and throw an error if it is
     * @throws Error if the database is in read-only mode
     */
    private checkReadOnly;
    /**
     * Check if the database is frozen and throw an error if it is
     * @throws Error if the database is frozen
     */
    private checkFrozen;
    /**
     * Check if the database is in write-only mode and throw an error if it is
     * @param allowExistenceChecks If true, allows existence checks (get operations) in write-only mode
     * @param isDirectStorageOperation If true, allows the operation when allowDirectReads is enabled
     * @throws Error if the database is in write-only mode and operation is not allowed
     */
    private checkWriteOnly;
    /**
     * Start real-time updates if enabled in the configuration
     * This will periodically check for new data in storage and update the in-memory index and statistics
     */
    private startRealtimeUpdates;
    /**
     * Stop real-time updates
     */
    private stopRealtimeUpdates;
    /**
     * Manually check for updates in storage and update the in-memory index and statistics
     * This can be called by the user to force an update check even if automatic updates are not enabled
     */
    checkForUpdatesNow(): Promise<void>;
    /**
     * Enable real-time updates with the specified configuration
     * @param config Configuration for real-time updates
     */
    enableRealtimeUpdates(config?: Partial<BrainyDataConfig['realtimeUpdates']>): void;
    /**
     * Start metadata index maintenance
     */
    private startMetadataIndexMaintenance;
    /**
     * Disable real-time updates
     */
    disableRealtimeUpdates(): void;
    /**
     * Get the current real-time update configuration
     * @returns The current real-time update configuration
     */
    getRealtimeUpdateConfig(): Required<NonNullable<BrainyDataConfig['realtimeUpdates']>>;
    /**
     * Check for updates in storage and update the in-memory index and statistics if needed
     * This is called periodically by the update timer when real-time updates are enabled
     * Uses change log mechanism for efficient updates instead of full scans
     */
    private checkForUpdates;
    /**
     * Apply changes using the change log mechanism (efficient for distributed storage)
     */
    private applyChangesFromLog;
    /**
     * Apply changes using full scan method (fallback for storage adapters without change log support)
     */
    private applyChangesFromFullScan;
    /**
     * Provide feedback to the intelligent verb scoring system for learning
     * This allows the system to learn from user corrections or validation
     *
     * @param sourceId - Source entity ID
     * @param targetId - Target entity ID
     * @param verbType - Relationship type
     * @param feedbackWeight - The corrected/validated weight (0-1)
     * @param feedbackConfidence - The corrected/validated confidence (0-1)
     * @param feedbackType - Type of feedback ('correction', 'validation', 'enhancement')
     */
    provideFeedbackForVerbScoring(sourceId: string, targetId: string, verbType: string, feedbackWeight: number, feedbackConfidence?: number, feedbackType?: 'correction' | 'validation' | 'enhancement'): Promise<void>;
    /**
     * Get learning statistics from the intelligent verb scoring system
     */
    getVerbScoringStats(): any;
    /**
     * Export learning data from the intelligent verb scoring system
     */
    exportVerbScoringLearningData(): string | null;
    /**
     * Import learning data into the intelligent verb scoring system
     */
    importVerbScoringLearningData(jsonData: string): void;
    /**
     * Get the current augmentation name if available
     * This is used to auto-detect the service performing data operations
     * @returns The name of the current augmentation or 'default' if none is detected
     */
    private getCurrentAugmentation;
    /**
     * Get the service name from options or fallback to default service
     * This provides a consistent way to handle service names across all methods
     * @param options Options object that may contain a service property
     * @returns The service name to use for operations
     */
    private getServiceName;
    /**
     * Initialize the database
     * Loads existing data from storage if available
     */
    init(): Promise<void>;
    /**
     * Initialize distributed mode
     * Sets up configuration management, partitioning, and operational modes
     */
    private initializeDistributedMode;
    /**
     * Handle distributed configuration updates
     */
    private handleDistributedConfigUpdate;
    /**
     * Get distributed health status
     * @returns Health status if distributed mode is enabled
     */
    getHealthStatus(): any;
    /**
     * Connect to a remote Brainy server for search operations
     * @param serverUrl WebSocket URL of the remote Brainy server
     * @param protocols Optional WebSocket protocols to use
     * @returns The connection object
     */
    connectToRemoteServer(serverUrl: string, protocols?: string | string[]): Promise<WebSocketConnection>;
    /**
     * Add data to the database with intelligent processing
     *
     * @param vectorOrData Vector or data to add
     * @param metadata Optional metadata to associate with the data
     * @param options Additional options for processing
     * @returns The ID of the added data
     *
     * @example
     * // Auto mode - intelligently decides processing
     * await brainy.add("Customer feedback: Great product!")
     *
     * @example
     * // Explicit literal mode for sensitive data
     * await brainy.add("API_KEY=secret123", null, { process: 'literal' })
     *
     * @example
     * // Force neural processing
     * await brainy.add("John works at Acme Corp", null, { process: 'neural' })
     */
    add(vectorOrData: Vector | any, metadata?: T, options?: {
        forceEmbed?: boolean;
        addToRemote?: boolean;
        id?: string;
        service?: string;
        process?: 'auto' | 'literal' | 'neural';
    }): Promise<string>;
    /**
     * Add a text item to the database with automatic embedding
     * This is a convenience method for adding text data with metadata
     * @param text Text data to add
     * @param metadata Metadata to associate with the text
     * @param options Additional options
     * @returns The ID of the added item
     */
    addItem(text: string, metadata?: T, options?: {
        addToRemote?: boolean;
        id?: string;
    }): Promise<string>;
    /**
     * Add data to both local and remote Brainy instances
     * @param vectorOrData Vector or data to add
     * @param metadata Optional metadata to associate with the vector
     * @param options Additional options
     * @returns The ID of the added vector
     */
    addToBoth(vectorOrData: Vector | any, metadata?: T, options?: {
        forceEmbed?: boolean;
    }): Promise<string>;
    /**
     * Add a vector to the remote server
     * @param id ID of the vector to add
     * @param vector Vector to add
     * @param metadata Optional metadata to associate with the vector
     * @returns True if successful, false otherwise
     * @private
     */
    private addToRemote;
    /**
     * Add multiple vectors or data items to the database
     * @param items Array of items to add
     * @param options Additional options
     * @returns Array of IDs for the added items
     */
    addBatch(items: Array<{
        vectorOrData: Vector | any;
        metadata?: T;
    }>, options?: {
        forceEmbed?: boolean;
        addToRemote?: boolean;
        concurrency?: number;
        batchSize?: number;
    }): Promise<string[]>;
    /**
     * Add multiple vectors or data items to both local and remote databases
     * @param items Array of items to add
     * @param options Additional options
     * @returns Array of IDs for the added items
     */
    addBatchToBoth(items: Array<{
        vectorOrData: Vector | any;
        metadata?: T;
    }>, options?: {
        forceEmbed?: boolean;
        concurrency?: number;
    }): Promise<string[]>;
    /**
     * Filter search results by service
     * @param results Search results to filter
     * @param service Service to filter by
     * @returns Filtered search results
     * @private
     */
    private filterResultsByService;
    /**
     * Search for similar vectors within specific noun types
     * @param queryVectorOrData Query vector or data to search for
     * @param k Number of results to return
     * @param nounTypes Array of noun types to search within, or null to search all
     * @param options Additional options
     * @returns Array of search results
     */
    searchByNounTypes(queryVectorOrData: Vector | any, k?: number, nounTypes?: string[] | null, options?: {
        forceEmbed?: boolean;
        service?: string;
        metadata?: any;
        offset?: number;
    }): Promise<SearchResult<T>[]>;
    /**
     * Search for similar vectors
     * @param queryVectorOrData Query vector or data to search for
     * @param k Number of results to return
     * @param options Additional options
     * @returns Array of search results
     */
    search(queryVectorOrData: Vector | any, k?: number, options?: {
        forceEmbed?: boolean;
        nounTypes?: string[];
        includeVerbs?: boolean;
        searchMode?: 'local' | 'remote' | 'combined';
        searchVerbs?: boolean;
        verbTypes?: string[];
        searchConnectedNouns?: boolean;
        verbDirection?: 'outgoing' | 'incoming' | 'both';
        service?: string;
        searchField?: string;
        filter?: {
            domain?: string;
        };
        metadata?: any;
        offset?: number;
        skipCache?: boolean;
    }): Promise<SearchResult<T>[]>;
    /**
     * Search with cursor-based pagination for better performance on large datasets
     * @param queryVectorOrData Query vector or data to search for
     * @param k Number of results to return
     * @param options Additional options including cursor for pagination
     * @returns Paginated search results with cursor for next page
     */
    searchWithCursor(queryVectorOrData: Vector | any, k?: number, options?: {
        forceEmbed?: boolean;
        nounTypes?: string[];
        includeVerbs?: boolean;
        service?: string;
        searchField?: string;
        filter?: {
            domain?: string;
        };
        cursor?: SearchCursor;
        skipCache?: boolean;
    }): Promise<PaginatedSearchResult<T>>;
    /**
     * Search the local database for similar vectors
     * @param queryVectorOrData Query vector or data to search for
     * @param k Number of results to return
     * @param options Additional options
     * @returns Array of search results
     */
    searchLocal(queryVectorOrData: Vector | any, k?: number, options?: {
        forceEmbed?: boolean;
        nounTypes?: string[];
        includeVerbs?: boolean;
        service?: string;
        searchField?: string;
        priorityFields?: string[];
        filter?: {
            domain?: string;
        };
        metadata?: any;
        offset?: number;
        skipCache?: boolean;
    }): Promise<SearchResult<T>[]>;
    /**
     * Find entities similar to a given entity ID
     * @param id ID of the entity to find similar entities for
     * @param options Additional options
     * @returns Array of search results with similarity scores
     */
    findSimilar(id: string, options?: {
        limit?: number;
        nounTypes?: string[];
        includeVerbs?: boolean;
        searchMode?: 'local' | 'remote' | 'combined';
        relationType?: string;
    }): Promise<SearchResult<T>[]>;
    /**
     * Get a vector by ID
     */
    get(id: string): Promise<VectorDocument<T> | null>;
    /**
     * Check if a document with the given ID exists
     * This is a direct storage operation that works in write-only mode when allowDirectReads is enabled
     * @param id The ID to check for existence
     * @returns Promise<boolean> True if the document exists, false otherwise
     */
    has(id: string): Promise<boolean>;
    /**
     * Check if a document with the given ID exists (alias for has)
     * This is a direct storage operation that works in write-only mode when allowDirectReads is enabled
     * @param id The ID to check for existence
     * @returns Promise<boolean> True if the document exists, false otherwise
     */
    exists(id: string): Promise<boolean>;
    /**
     * Get metadata for a document by ID
     * This is a direct storage operation that works in write-only mode when allowDirectReads is enabled
     * @param id The ID of the document
     * @returns Promise<T | null> The metadata object or null if not found
     */
    getMetadata(id: string): Promise<T | null>;
    /**
     * Get multiple documents by their IDs
     * This is a direct storage operation that works in write-only mode when allowDirectReads is enabled
     * @param ids Array of IDs to retrieve
     * @returns Promise<Array<VectorDocument<T> | null>> Array of documents (null for missing IDs)
     */
    getBatch(ids: string[]): Promise<Array<VectorDocument<T> | null>>;
    /**
     * Get nouns with pagination and filtering
     * @param options Pagination and filtering options
     * @returns Paginated result of vector documents
     */
    getNouns(options?: {
        pagination?: {
            offset?: number;
            limit?: number;
            cursor?: string;
        };
        filter?: {
            nounType?: string | string[];
            service?: string | string[];
            metadata?: Record<string, any>;
        };
    }): Promise<{
        items: VectorDocument<T>[];
        totalCount?: number;
        hasMore: boolean;
        nextCursor?: string;
    }>;
    /**
     * Delete a vector by ID
     * @param id The ID of the vector to delete
     * @param options Additional options
     * @returns Promise that resolves to true if the vector was deleted, false otherwise
     */
    delete(id: string, options?: {
        service?: string;
        soft?: boolean;
        cascade?: boolean;
        force?: boolean;
    }): Promise<boolean>;
    /**
     * Update metadata for a vector
     * @param id The ID of the vector to update metadata for
     * @param metadata The new metadata
     * @param options Additional options
     * @returns Promise that resolves to true if the metadata was updated, false otherwise
     */
    updateMetadata(id: string, metadata: T, options?: {
        service?: string;
    }): Promise<boolean>;
    /**
     * Create a relationship between two entities
     * This is a convenience wrapper around addVerb
     */
    relate(sourceId: string, targetId: string, relationType: string, metadata?: any): Promise<string>;
    /**
     * Create a connection between two entities
     * This is an alias for relate() for backward compatibility
     */
    connect(sourceId: string, targetId: string, relationType: string, metadata?: any): Promise<string>;
    /**
     * Add a verb between two nouns
     * If metadata is provided and vector is not, the metadata will be vectorized using the embedding function
     *
     * @param sourceId ID of the source noun
     * @param targetId ID of the target noun
     * @param vector Optional vector for the verb
     * @param options Additional options:
     *   - type: Type of the verb
     *   - weight: Weight of the verb
     *   - metadata: Metadata for the verb
     *   - forceEmbed: Force using the embedding function for metadata even if vector is provided
     *   - id: Optional ID to use instead of generating a new one
     *   - autoCreateMissingNouns: Automatically create missing nouns if they don't exist
     *   - missingNounMetadata: Metadata to use when auto-creating missing nouns
     *   - writeOnlyMode: Skip noun existence checks for high-speed streaming (creates placeholder nouns)
     *
     * @returns The ID of the added verb
     *
     * @throws Error if source or target nouns don't exist and autoCreateMissingNouns is false or auto-creation fails
     */
    private _addVerbInternal;
    /**
     * Get a verb by ID
     * This is a direct storage operation that works in write-only mode when allowDirectReads is enabled
     */
    getVerb(id: string): Promise<GraphVerb | null>;
    /**
     * Internal performance optimization: intelligently load verbs when beneficial
     * @internal - Used by search, indexing, and caching optimizations
     */
    private _optimizedLoadAllVerbs;
    /**
     * Internal performance optimization: intelligently load nouns when beneficial
     * @internal - Used by search, indexing, and caching optimizations
     */
    private _optimizedLoadAllNouns;
    /**
     * Intelligent decision making for when to preload all data
     * @internal
     */
    private _shouldPreloadAllData;
    /**
     * Estimate if dataset size is reasonable for in-memory loading
     * @internal
     */
    private _isDatasetSizeReasonable;
    /**
     * Get verbs with pagination and filtering
     * @param options Pagination and filtering options
     * @returns Paginated result of verbs
     */
    getVerbs(options?: {
        pagination?: {
            offset?: number;
            limit?: number;
            cursor?: string;
        };
        filter?: {
            verbType?: string | string[];
            sourceId?: string | string[];
            targetId?: string | string[];
            service?: string | string[];
            metadata?: Record<string, any>;
        };
    }): Promise<{
        items: GraphVerb[];
        totalCount?: number;
        hasMore: boolean;
        nextCursor?: string;
    }>;
    /**
     * Get verbs by source noun ID
     * @param sourceId The ID of the source noun
     * @returns Array of verbs originating from the specified source
     */
    getVerbsBySource(sourceId: string): Promise<GraphVerb[]>;
    /**
     * Get verbs by target noun ID
     * @param targetId The ID of the target noun
     * @returns Array of verbs targeting the specified noun
     */
    getVerbsByTarget(targetId: string): Promise<GraphVerb[]>;
    /**
     * Get verbs by type
     * @param type The type of verb to retrieve
     * @returns Array of verbs of the specified type
     */
    getVerbsByType(type: string): Promise<GraphVerb[]>;
    /**
     * Delete a verb
     * @param id The ID of the verb to delete
     * @param options Additional options
     * @returns Promise that resolves to true if the verb was deleted, false otherwise
     */
    deleteVerb(id: string, options?: {
        service?: string;
    }): Promise<boolean>;
    /**
     * Clear the database
     */
    clear(): Promise<void>;
    /**
     * Get the number of vectors in the database
     */
    size(): number;
    /**
     * Get search cache statistics for performance monitoring
     * @returns Cache statistics including hit rate and memory usage
     */
    getCacheStats(): {
        search: {
            hits: number;
            misses: number;
            evictions: number;
            hitRate: number;
            size: number;
            maxSize: number;
            enabled: boolean;
        };
        searchMemoryUsage: number;
    };
    /**
     * Clear search cache manually (useful for testing or memory management)
     */
    clearCache(): void;
    /**
     * Adapt cache configuration based on current performance metrics
     * This method analyzes usage patterns and automatically optimizes cache settings
     * @private
     */
    private adaptCacheConfiguration;
    /**
     * @deprecated Use add() instead - it's smart by default now
     * @hidden
     */
    /**
     * Get the number of nouns in the database (excluding verbs)
     * This is used for statistics reporting to match the expected behavior in tests
     * @private
     */
    private getNounCount;
    /**
     * Force an immediate flush of statistics to storage
     * This ensures that any pending statistics updates are written to persistent storage
     * @returns Promise that resolves when the statistics have been flushed
     */
    flushStatistics(): Promise<void>;
    /**
     * Update storage sizes if needed (called periodically for performance)
     */
    private updateStorageSizesIfNeeded;
    /**
     * Get statistics about the current state of the database
     * @param options Additional options for retrieving statistics
     * @returns Object containing counts of nouns, verbs, metadata entries, and HNSW index size
     */
    getStatistics(options?: {
        service?: string | string[];
        forceRefresh?: boolean;
    }): Promise<{
        nounCount: number;
        verbCount: number;
        metadataCount: number;
        hnswIndexSize: number;
        nouns?: {
            count: number;
        };
        verbs?: {
            count: number;
        };
        metadata?: {
            count: number;
        };
        operations?: {
            add: number;
            search: number;
            delete: number;
            update: number;
            relate: number;
            total: number;
        };
        serviceBreakdown?: {
            [service: string]: {
                nounCount: number;
                verbCount: number;
                metadataCount: number;
            };
        };
    }>;
    /**
     * List all services that have written data to the database
     * @returns Array of service statistics
     */
    listServices(): Promise<import('./coreTypes.js').ServiceStatistics[]>;
    /**
     * Get statistics for a specific service
     * @param service The service name to get statistics for
     * @returns Service statistics or null if service not found
     */
    getServiceStatistics(service: string): Promise<import('./coreTypes.js').ServiceStatistics | null>;
    /**
     * Check if the database is in read-only mode
     * @returns True if the database is in read-only mode, false otherwise
     */
    isReadOnly(): boolean;
    /**
     * Set the database to read-only mode
     * @param readOnly True to set the database to read-only mode, false to allow writes
     */
    setReadOnly(readOnly: boolean): void;
    /**
     * Check if the database is frozen (completely immutable)
     * @returns True if the database is frozen, false otherwise
     */
    isFrozen(): boolean;
    /**
     * Set the database to frozen mode (completely immutable)
     * When frozen, no changes are allowed including statistics updates and index optimizations
     * @param frozen True to freeze the database, false to allow optimizations
     */
    setFrozen(frozen: boolean): void;
    /**
     * Check if the database is in write-only mode
     * @returns True if the database is in write-only mode, false otherwise
     */
    isWriteOnly(): boolean;
    /**
     * Set the database to write-only mode
     * @param writeOnly True to set the database to write-only mode, false to allow searches
     */
    setWriteOnly(writeOnly: boolean): void;
    /**
     * Embed text or data into a vector using the same embedding function used by this instance
     * This allows clients to use the same TensorFlow Universal Sentence Encoder throughout their application
     *
     * @param data Text or data to embed
     * @returns A promise that resolves to the embedded vector
     */
    embed(data: string | string[]): Promise<Vector>;
    /**
     * Calculate similarity between two vectors or between two pieces of text/data
     * This method allows clients to directly calculate similarity scores between items
     * without needing to add them to the database
     *
     * @param a First vector or text/data to compare
     * @param b Second vector or text/data to compare
     * @param options Additional options
     * @returns A promise that resolves to the similarity score (higher means more similar)
     */
    calculateSimilarity(a: Vector | string | string[], b: Vector | string | string[], options?: {
        forceEmbed?: boolean;
        distanceFunction?: DistanceFunction;
    }): Promise<number>;
    /**
     * Search for verbs by type and/or vector similarity
     * @param queryVectorOrData Query vector or data to search for
     * @param k Number of results to return
     * @param options Additional options
     * @returns Array of verbs with similarity scores
     */
    searchVerbs(queryVectorOrData: Vector | any, k?: number, options?: {
        forceEmbed?: boolean;
        verbTypes?: string[];
        service?: string;
    }): Promise<Array<GraphVerb & {
        similarity: number;
    }>>;
    /**
     * Search for nouns connected by specific verb types
     * @param queryVectorOrData Query vector or data to search for
     * @param k Number of results to return
     * @param options Additional options
     * @returns Array of search results
     */
    searchNounsByVerbs(queryVectorOrData: Vector | any, k?: number, options?: {
        forceEmbed?: boolean;
        verbTypes?: string[];
        direction?: 'outgoing' | 'incoming' | 'both';
    }): Promise<SearchResult<T>[]>;
    /**
     * Get available filter values for a field
     * Useful for building dynamic filter UIs
     *
     * @param field The field name to get values for
     * @returns Array of available values for that field
     */
    getFilterValues(field: string): Promise<string[]>;
    /**
     * Get all available filter fields
     * Useful for discovering what metadata fields are indexed
     *
     * @returns Array of indexed field names
     */
    getFilterFields(): Promise<string[]>;
    /**
     * Search within a specific set of items
     * This is useful when you've pre-filtered items and want to search only within them
     *
     * @param queryVectorOrData Query vector or data to search for
     * @param itemIds Array of item IDs to search within
     * @param k Number of results to return
     * @param options Additional options
     * @returns Array of search results
     */
    searchWithinItems(queryVectorOrData: Vector | any, itemIds: string[], k?: number, options?: {
        forceEmbed?: boolean;
    }): Promise<SearchResult<T>[]>;
    /**
     * Search for similar documents using a text query
     * This is a convenience method that embeds the query text and performs a search
     *
     * @param query Text query to search for
     * @param k Number of results to return
     * @param options Additional options
     * @returns Array of search results
     */
    searchText(query: string, k?: number, options?: {
        nounTypes?: string[];
        includeVerbs?: boolean;
        searchMode?: 'local' | 'remote' | 'combined';
        metadata?: any;
    }): Promise<SearchResult<T>[]>;
    /**
     * Search a remote Brainy server for similar vectors
     * @param queryVectorOrData Query vector or data to search for
     * @param k Number of results to return
     * @param options Additional options
     * @returns Array of search results
     */
    searchRemote(queryVectorOrData: Vector | any, k?: number, options?: {
        forceEmbed?: boolean;
        nounTypes?: string[];
        includeVerbs?: boolean;
        storeResults?: boolean;
        service?: string;
        searchField?: string;
        offset?: number;
    }): Promise<SearchResult<T>[]>;
    /**
     * Search both local and remote Brainy instances, combining the results
     * @param queryVectorOrData Query vector or data to search for
     * @param k Number of results to return
     * @param options Additional options
     * @returns Array of search results
     */
    searchCombined(queryVectorOrData: Vector | any, k?: number, options?: {
        forceEmbed?: boolean;
        nounTypes?: string[];
        includeVerbs?: boolean;
        localFirst?: boolean;
        service?: string;
        searchField?: string;
        offset?: number;
    }): Promise<SearchResult<T>[]>;
    /**
     * Check if the instance is connected to a remote server
     * @returns True if connected to a remote server, false otherwise
     */
    isConnectedToRemoteServer(): boolean;
    /**
     * Disconnect from the remote server
     * @returns True if successfully disconnected, false if not connected
     */
    disconnectFromRemoteServer(): Promise<boolean>;
    /**
     * Ensure the database is initialized
     */
    private ensureInitialized;
    /**
     * Get information about the current storage usage and capacity
     * @returns Object containing the storage type, used space, quota, and additional details
     */
    status(): Promise<{
        type: string;
        used: number;
        quota: number | null;
        details?: Record<string, any>;
    }>;
    /**
     * Shut down the database and clean up resources
     * This should be called when the database is no longer needed
     */
    shutDown(): Promise<void>;
    /**
     * Backup all data from the database to a JSON-serializable format
     * @returns Object containing all nouns, verbs, noun types, verb types, HNSW index, and other related data
     *
     * The HNSW index data includes:
     * - entryPointId: The ID of the entry point for the graph
     * - maxLevel: The maximum level in the hierarchical structure
     * - dimension: The dimension of the vectors
     * - config: Configuration parameters for the HNSW algorithm
     * - connections: A serialized representation of the connections between nouns
     */
    backup(): Promise<{
        nouns: VectorDocument<T>[];
        verbs: GraphVerb[];
        nounTypes: string[];
        verbTypes: string[];
        version: string;
        hnswIndex?: {
            entryPointId: string | null;
            maxLevel: number;
            dimension: number | null;
            config: HNSWConfig;
            connections: Record<string, Record<string, string[]>>;
        };
    }>;
    /**
     * Import sparse data into the database
     * @param data The sparse data to import
     *             If vectors are not present for nouns, they will be created using the embedding function
     * @param options Import options
     * @returns Object containing counts of imported items
     */
    importSparseData(data: {
        nouns: VectorDocument<T>[];
        verbs: GraphVerb[];
        nounTypes?: string[];
        verbTypes?: string[];
        hnswIndex?: {
            entryPointId: string | null;
            maxLevel: number;
            dimension: number | null;
            config: HNSWConfig;
            connections: Record<string, Record<string, string[]>>;
        };
        version: string;
    }, options?: {
        clearExisting?: boolean;
    }): Promise<{
        nounsRestored: number;
        verbsRestored: number;
    }>;
    /**
     * Restore data into the database from a previously backed up format
     * @param data The data to restore, in the format returned by backup()
     *             This can include HNSW index data if it was included in the backup
     *             If vectors are not present for nouns, they will be created using the embedding function
     * @param options Restore options
     * @returns Object containing counts of restored items
     */
    restore(data: {
        nouns: VectorDocument<T>[];
        verbs: GraphVerb[];
        nounTypes?: string[];
        verbTypes?: string[];
        hnswIndex?: {
            entryPointId: string | null;
            maxLevel: number;
            dimension: number | null;
            config: HNSWConfig;
            connections: Record<string, Record<string, string[]>>;
        };
        version: string;
    }, options?: {
        clearExisting?: boolean;
    }): Promise<{
        nounsRestored: number;
        verbsRestored: number;
    }>;
    /**
     * Generate a random graph of data with typed nouns and verbs for testing and experimentation
     * @param options Configuration options for the random graph
     * @returns Object containing the IDs of the generated nouns and verbs
     */
    generateRandomGraph(options?: {
        nounCount?: number;
        verbCount?: number;
        nounTypes?: NounType[];
        verbTypes?: VerbType[];
        clearExisting?: boolean;
        seed?: string;
    }): Promise<{
        nounIds: string[];
        verbIds: string[];
    }>;
    /**
     * Get available field names by service
     * This helps users understand what fields are available for searching from different data sources
     * @returns Record of field names by service
     */
    getAvailableFieldNames(): Promise<Record<string, string[]>>;
    /**
     * Get standard field mappings
     * This helps users understand how fields from different services map to standard field names
     * @returns Record of standard field mappings
     */
    getStandardFieldMappings(): Promise<Record<string, Record<string, string[]>>>;
    /**
     * Search using a standard field name
     * This allows searching across multiple services using a standardized field name
     * @param standardField The standard field name to search in
     * @param searchTerm The term to search for
     * @param k Number of results to return
     * @param options Additional search options
     * @returns Array of search results
     */
    searchByStandardField(standardField: string, searchTerm: string, k?: number, options?: {
        services?: string[];
        includeVerbs?: boolean;
        searchMode?: 'local' | 'remote' | 'combined';
    }): Promise<SearchResult<T>[]>;
    /**
     * Cleanup distributed resources
     * Should be called when shutting down the instance
     */
    cleanup(): Promise<void>;
    /**
     * Load environment variables from Cortex configuration
     * This enables services to automatically load all their configs from Brainy
     * @returns Promise that resolves when environment is loaded
     */
    loadEnvironment(): Promise<void>;
    /**
     * Set a configuration value with optional encryption
     * @param key Configuration key
     * @param value Configuration value
     * @param options Options including encryption
     */
    setConfig(key: string, value: any, options?: {
        encrypt?: boolean;
    }): Promise<void>;
    /**
     * Get a configuration value with automatic decryption
     * @param key Configuration key
     * @returns Configuration value or undefined
     */
    getConfig(key: string): Promise<any>;
    /**
     * Encrypt data using universal crypto utilities
     */
    encryptData(data: string): Promise<string>;
    /**
     * Decrypt data using universal crypto utilities
     */
    decryptData(encryptedData: string): Promise<string>;
    /**
     * Neural Import - Smart bulk data import with semantic type detection
     * Uses transformer embeddings to automatically detect and classify data types
     * @param data Array of data items or single item to import
     * @param options Import options including type hints and processing mode
     * @returns Array of created IDs
     */
    import(data: any[] | any, options?: {
        typeHint?: NounType;
        autoDetect?: boolean;
        batchSize?: number;
        process?: 'auto' | 'guided' | 'explicit' | 'literal';
    }): Promise<string[]>;
    /**
     * Add Noun - Explicit noun creation with strongly-typed NounType
     * For when you know exactly what type of noun you're creating
     * @param data The noun data
     * @param nounType The explicit noun type from NounType enum
     * @param metadata Additional metadata
     * @returns Created noun ID
     */
    addNoun(data: any, nounType: NounType, metadata?: any): Promise<string>;
    /**
     * Add Verb - Unified relationship creation between nouns
     * Creates typed relationships with proper vector embeddings from metadata
     * @param sourceId Source noun ID
     * @param targetId Target noun ID
     * @param verbType Relationship type from VerbType enum
     * @param metadata Additional metadata for the relationship (will be embedded for searchability)
     * @param weight Relationship weight/strength (0-1, default: 0.5)
     * @returns Created verb ID
     */
    addVerb(sourceId: string, targetId: string, verbType: VerbType, metadata?: any, weight?: number): Promise<string>;
    /**
     * Auto-detect whether to use neural processing for data
     * @private
     */
    private shouldAutoProcessNeurally;
    /**
     * Detect noun type using semantic analysis
     * @private
     */
    private detectNounType;
    /**
     * Get Noun with Connected Verbs - Retrieve noun and all its relationships
     * Provides complete traversal view of a noun and its connections using existing searchVerbs
     * @param nounId The noun ID to retrieve
     * @param options Traversal options
     * @returns Noun data with connected verbs and related nouns
     */
    getNounWithVerbs(nounId: string, options?: {
        includeIncoming?: boolean;
        includeOutgoing?: boolean;
        verbLimit?: number;
        verbTypes?: string[];
    }): Promise<{
        noun: {
            id: string;
            data: any;
            metadata: any;
            nounType?: NounType;
        };
        incomingVerbs: any[];
        outgoingVerbs: any[];
        totalConnections: number;
    } | null>;
    /**
     * Update - Smart noun update with automatic index synchronization
     * Updates both data and metadata while maintaining search index integrity
     * @param id The noun ID to update
     * @param data New data (optional - if not provided, only metadata is updated)
     * @param metadata New metadata (merged with existing)
     * @param options Update options
     * @returns Success boolean
     */
    update(id: string, data?: any, metadata?: any, options?: {
        merge?: boolean;
        reindex?: boolean;
        cascade?: boolean;
    }): Promise<boolean>;
    /**
     * Preload Transformer Model - Essential for container deployments
     * Downloads and caches models during initialization to avoid runtime delays
     * @param options Preload options
     * @returns Success boolean and model info
     */
    static preloadModel(options?: {
        model?: string;
        cacheDir?: string;
        device?: string;
        force?: boolean;
    }): Promise<{
        success: boolean;
        modelPath: string;
        modelSize: number;
        device: string;
    }>;
    /**
     * Warmup - Initialize BrainyData with preloaded models (container-optimized)
     * For production deployments where models should be ready immediately
     * @param config BrainyData configuration
     * @param options Warmup options
     */
    static warmup(config?: BrainyDataConfig, options?: {
        preloadModel?: boolean;
        modelOptions?: Parameters<typeof BrainyData.preloadModel>[0];
        testEmbedding?: boolean;
    }): Promise<BrainyData>;
    /**
     * Get model size for deployment info
     * @private
     */
    private static getModelSize;
    /**
     * Coordinate storage migration across distributed services
     * @param options Migration options
     */
    coordinateStorageMigration(options: {
        newStorage: any;
        strategy?: 'immediate' | 'gradual' | 'test';
        message?: string;
    }): Promise<void>;
    /**
     * Check for coordination updates
     * Services should call this periodically or on startup
     */
    checkCoordination(): Promise<any>;
    /**
     * Rebuild metadata index
     * Exposed for Cortex reindex command
     */
    rebuildMetadataIndex(): Promise<void>;
    /**
     * UNIFIED API METHOD #9: Augment - Register new augmentations
     *
     * For registration: brain.augment(new MyAugmentation())
     * For management: Use brain.augmentations.enable(), .disable(), .list() etc.
     *
     * @param action The augmentation to register OR legacy string command
     * @param options Legacy options for string commands (deprecated)
     * @returns this for chaining when registering, various for legacy commands
     *
     * @deprecated String-based commands are deprecated. Use brain.augmentations.* instead
     */
    augment(action: IAugmentation | 'list' | 'enable' | 'disable' | 'unregister' | 'enable-type' | 'disable-type', options?: string | {
        name?: string;
        type?: string;
    }): this | any;
    /**
     * UNIFIED API METHOD #9: Export - Extract your data in various formats
     * Export your brain's knowledge for backup, migration, or integration
     *
     * @param options Export configuration
     * @returns The exported data in the specified format
     */
    export(options?: {
        format?: 'json' | 'csv' | 'graph' | 'embeddings';
        includeVectors?: boolean;
        includeMetadata?: boolean;
        includeRelationships?: boolean;
        filter?: any;
        limit?: number;
    }): Promise<any>;
    /**
     * Helper: Convert data to CSV format
     * @private
     */
    private convertToCSV;
    /**
     * Helper: Convert data to graph format
     * @private
     */
    private convertToGraphFormat;
    /**
     * Unregister an augmentation by name
     * Remove augmentations from the pipeline
     *
     * @param name The name of the augmentation to unregister
     * @returns The BrainyData instance for chaining
     */
    unregister(name: string): this;
    /**
     * Enable an augmentation by name
     * Universal control for built-in, community, and premium augmentations
     *
     * @param name The name of the augmentation to enable
     * @returns True if augmentation was found and enabled
     */
    enableAugmentation(name: string): boolean;
    /**
     * Disable an augmentation by name
     * Universal control for built-in, community, and premium augmentations
     *
     * @param name The name of the augmentation to disable
     * @returns True if augmentation was found and disabled
     */
    disableAugmentation(name: string): boolean;
    /**
     * Check if an augmentation is enabled
     *
     * @param name The name of the augmentation to check
     * @returns True if augmentation is found and enabled, false otherwise
     */
    isAugmentationEnabled(name: string): boolean;
    /**
     * Get all augmentations with their enabled status
     * Shows built-in, community, and premium augmentations
     *
     * @returns Array of augmentations with name, type, and enabled status
     */
    listAugmentations(): Array<{
        name: string;
        type: string;
        enabled: boolean;
        description: string;
    }>;
    /**
     * Enable all augmentations of a specific type
     *
     * @param type The type of augmentations to enable (sense, conduit, cognition, etc.)
     * @returns Number of augmentations enabled
     */
    enableAugmentationType(type: 'sense' | 'conduit' | 'cognition' | 'memory' | 'perception' | 'dialog' | 'activation' | 'webSocket'): number;
    /**
     * Disable all augmentations of a specific type
     *
     * @param type The type of augmentations to disable (sense, conduit, cognition, etc.)
     * @returns Number of augmentations disabled
     */
    disableAugmentationType(type: 'sense' | 'conduit' | 'cognition' | 'memory' | 'perception' | 'dialog' | 'activation' | 'webSocket'): number;
}
export { euclideanDistance, cosineDistance, manhattanDistance, dotProductDistance } from './utils/index.js';
