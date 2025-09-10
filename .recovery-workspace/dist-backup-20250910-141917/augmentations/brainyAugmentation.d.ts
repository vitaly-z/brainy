/**
 * Single BrainyAugmentation Interface
 *
 * This replaces the 7 complex interfaces with one elegant, purpose-driven design.
 * Each augmentation knows its place and when to execute automatically.
 *
 * The Vision: Components that enhance Brainy's capabilities seamlessly
 * - WAL: Adds durability to storage operations
 * - RequestDeduplicator: Prevents duplicate concurrent requests
 * - ConnectionPool: Optimizes cloud storage throughput
 * - IntelligentVerbScoring: Enhances relationship analysis
 * - StreamingPipeline: Enables unlimited data processing
 */
import { AugmentationManifest } from './manifest.js';
/**
 * Metadata access declaration for augmentations
 */
export interface MetadataAccess {
    reads?: string[] | '*';
    writes?: string[] | '*';
    namespace?: string;
}
export interface BrainyAugmentation {
    /**
     * Unique identifier for the augmentation
     */
    name: string;
    /**
     * When this augmentation should execute
     * - 'before': Execute before the main operation
     * - 'after': Execute after the main operation
     * - 'around': Wrap the main operation (like middleware)
     * - 'replace': Replace the main operation entirely
     */
    timing: 'before' | 'after' | 'around' | 'replace';
    /**
     * Metadata access contract - REQUIRED
     * - 'none': No metadata access at all
     * - 'readonly': Can read any metadata but cannot write
     * - MetadataAccess: Specific fields to read/write
     */
    metadata: 'none' | 'readonly' | MetadataAccess;
    /**
     * Which operations this augmentation applies to
     * Granular operation matching for precise augmentation targeting
     */
    operations: ('add' | 'addNoun' | 'addVerb' | 'saveNoun' | 'saveVerb' | 'updateMetadata' | 'update' | 'delete' | 'deleteVerb' | 'clear' | 'get' | 'search' | 'searchText' | 'searchByNounTypes' | 'find' | 'findSimilar' | 'searchWithCursor' | 'similar' | 'relate' | 'unrelate' | 'getConnections' | 'getRelations' | 'storage' | 'backup' | 'restore' | 'all')[];
    /**
     * Priority for execution order (higher numbers execute first)
     * - 100: Critical system operations (WAL, ConnectionPool)
     * - 50: Performance optimizations (RequestDeduplicator, Caching)
     * - 10: Enhancement features (IntelligentVerbScoring)
     * - 1: Optional features (Logging, Analytics)
     */
    priority: number;
    /**
     * Initialize the augmentation
     * Called once during Brainy initialization
     *
     * @param context - The Brainy instance and storage
     */
    initialize(context: AugmentationContext): Promise<void>;
    /**
     * Execute the augmentation
     *
     * @param operation - The operation being performed
     * @param params - Parameters for the operation
     * @param next - Function to call the next augmentation or main operation
     * @returns Result of the operation
     */
    execute<T = any>(operation: string, params: any, next: () => Promise<T>): Promise<T>;
    /**
     * Optional: Check if this augmentation should run for the given operation
     * Return false to skip execution
     */
    shouldExecute?(operation: string, params: any): boolean;
    /**
     * Optional: Cleanup when Brainy is destroyed
     */
    shutdown?(): Promise<void>;
    /**
     * Optional: Computed fields this augmentation provides
     * Used for discovery, TypeScript support, and API documentation
     */
    computedFields?: {
        [namespace: string]: {
            [field: string]: {
                type: 'string' | 'number' | 'boolean' | 'object' | 'array';
                description: string;
                confidence?: number;
            };
        };
    };
    /**
     * Optional: Compute fields for a result entity
     * Called when user accesses getDisplay(), getSchema(), etc.
     *
     * @param result - The result entity (VectorDocument, GraphVerb, etc.)
     * @param namespace - The namespace being requested ('display', 'schema', etc.)
     * @returns Computed fields for the namespace
     */
    computeFields?(result: any, namespace: string): Promise<Record<string, any>> | Record<string, any>;
}
/**
 * Context provided to augmentations
 */
export interface AugmentationContext {
    /**
     * The Brainy instance (for accessing methods and config)
     */
    brain: any;
    /**
     * The storage adapter
     */
    storage: any;
    /**
     * Configuration for this augmentation
     */
    config: any;
    /**
     * Logging function
     */
    log: (message: string, level?: 'info' | 'warn' | 'error') => void;
}
/**
 * Base class for augmentations with common functionality
 *
 * This is the unified base class that combines the features of both
 * BaseAugmentation and ConfigurableAugmentation. All augmentations
 * should extend this class for consistent configuration support.
 */
export declare abstract class BaseAugmentation implements BrainyAugmentation {
    abstract name: string;
    abstract timing: 'before' | 'after' | 'around' | 'replace';
    abstract metadata: 'none' | 'readonly' | MetadataAccess;
    abstract operations: ('add' | 'addNoun' | 'addVerb' | 'saveNoun' | 'saveVerb' | 'updateMetadata' | 'update' | 'delete' | 'deleteVerb' | 'clear' | 'get' | 'search' | 'searchText' | 'searchByNounTypes' | 'find' | 'findSimilar' | 'searchWithCursor' | 'similar' | 'relate' | 'unrelate' | 'getConnections' | 'getRelations' | 'storage' | 'backup' | 'restore' | 'all')[];
    abstract priority: number;
    category: 'internal' | 'core' | 'premium' | 'community' | 'external';
    description: string;
    enabled: boolean;
    protected context?: AugmentationContext;
    protected isInitialized: boolean;
    protected config: any;
    private configResolver?;
    /**
     * Constructor with optional configuration
     * @param config Optional configuration to override defaults
     */
    constructor(config?: any);
    /**
     * Get the augmentation manifest for discovery
     * Override this to enable configuration support
     * CRITICAL: This enables tools to discover parameters and configuration
     */
    getManifest?(): AugmentationManifest;
    /**
     * Get parameter schema for operations
     * Enables tools to know what parameters each operation needs
     */
    getParameterSchema?(operation: string): any;
    /**
     * Get operation descriptions
     * Enables tools to show what each operation does
     */
    getOperationInfo?(): Record<string, {
        description: string;
        parameters?: any;
        returns?: any;
        examples?: any[];
    }>;
    /**
     * Get current configuration
     */
    getConfig(): any;
    /**
     * Update configuration at runtime
     * @param partial Partial configuration to merge
     */
    updateConfig(partial: any): Promise<void>;
    /**
     * Optional: Handle configuration changes
     * Override this to react to runtime configuration updates
     */
    protected onConfigChange?(newConfig: any, oldConfig: any): Promise<void>;
    /**
     * Resolve configuration from all sources
     * Priority: constructor > env > files > defaults
     */
    private resolveConfiguration;
    initialize(context: AugmentationContext): Promise<void>;
    /**
     * Override this in subclasses for initialization logic
     */
    protected onInitialize(): Promise<void>;
    abstract execute<T = any>(operation: string, params: any, next: () => Promise<T>): Promise<T>;
    shouldExecute(operation: string, params: any): boolean;
    shutdown(): Promise<void>;
    /**
     * Override this in subclasses for cleanup logic
     */
    protected onShutdown(): Promise<void>;
    /**
     * Optional computed fields declaration (override in subclasses)
     */
    computedFields?: {
        [namespace: string]: {
            [field: string]: {
                type: 'string' | 'number' | 'boolean' | 'object' | 'array';
                description: string;
                confidence?: number;
            };
        };
    };
    /**
     * Optional computed fields implementation (override in subclasses)
     * @param result The result entity
     * @param namespace The requested namespace
     * @returns Computed fields for the namespace
     */
    computeFields?(result: any, namespace: string): Promise<Record<string, any>> | Record<string, any>;
    /**
     * Log a message with the augmentation name
     */
    protected log(message: string, level?: 'info' | 'warn' | 'error'): void;
}
/**
 * Alias for backward compatibility
 * ConfigurableAugmentation is now merged into BaseAugmentation
 * @deprecated Use BaseAugmentation instead
 */
export declare const ConfigurableAugmentation: typeof BaseAugmentation;
/**
 * Registry for managing augmentations
 */
export declare class AugmentationRegistry {
    private augmentations;
    private context?;
    /**
     * Register an augmentation
     */
    register(augmentation: BrainyAugmentation): void;
    /**
     * Find augmentations by operation (before initialization)
     * Used for two-phase initialization to find storage augmentations
     */
    findByOperation(operation: string): BrainyAugmentation | null;
    /**
     * Initialize all augmentations
     */
    initialize(context: AugmentationContext): Promise<void>;
    /**
     * Initialize all augmentations (alias for consistency)
     */
    initializeAll(context: AugmentationContext): Promise<void>;
    /**
     * Execute augmentations for an operation
     */
    execute<T = any>(operation: string, params: any, mainOperation: () => Promise<T>): Promise<T>;
    /**
     * Get all registered augmentations
     */
    getAll(): BrainyAugmentation[];
    /**
     * Get augmentation info for listing
     */
    getInfo(): Array<{
        name: string;
        type: string;
        enabled: boolean;
        description: string;
        category: string;
        priority: number;
    }>;
    /**
     * Get augmentations by name
     */
    get(name: string): BrainyAugmentation | undefined;
    /**
     * Discover augmentation parameters and schemas
     * Critical for tools like brain-cloud to generate UIs
     */
    discover(name?: string): any;
    /**
     * Get configuration schema for an augmentation
     * Enables UI generation for configuration
     */
    getConfigSchema(name: string): any;
    /**
     * Configure an augmentation at runtime
     */
    configure(name: string, config: any): Promise<void>;
    /**
     * Get metrics for an augmentation
     */
    metrics(name?: string): any;
    /**
     * Get health status
     */
    health(): any;
    /**
     * Shutdown all augmentations
     */
    shutdown(): Promise<void>;
}
