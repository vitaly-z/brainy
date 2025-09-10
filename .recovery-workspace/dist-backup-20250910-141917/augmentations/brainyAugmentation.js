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
import { AugmentationConfigResolver } from './configResolver.js';
/**
 * Base class for augmentations with common functionality
 *
 * This is the unified base class that combines the features of both
 * BaseAugmentation and ConfigurableAugmentation. All augmentations
 * should extend this class for consistent configuration support.
 */
export class BaseAugmentation {
    /**
     * Constructor with optional configuration
     * @param config Optional configuration to override defaults
     */
    constructor(config) {
        // Metadata for augmentation listing and management
        this.category = 'core';
        this.description = '';
        this.enabled = true;
        this.isInitialized = false;
        this.config = {};
        // Only resolve configuration if getManifest is implemented
        if (this.getManifest) {
            this.config = this.resolveConfiguration(config);
        }
        else if (config) {
            // Legacy support: direct config assignment for augmentations without manifests
            this.config = config;
        }
    }
    /**
     * Get current configuration
     */
    getConfig() {
        return { ...this.config };
    }
    /**
     * Update configuration at runtime
     * @param partial Partial configuration to merge
     */
    async updateConfig(partial) {
        if (!this.configResolver) {
            // For legacy augmentations without manifest, just merge config
            const oldConfig = this.config;
            this.config = { ...this.config, ...partial };
            if (this.onConfigChange) {
                await this.onConfigChange(this.config, oldConfig);
            }
            return;
        }
        const oldConfig = this.config;
        try {
            // Use resolver to update and validate
            this.config = this.configResolver.updateRuntime(partial);
            // Call config change handler if implemented
            if (this.onConfigChange) {
                await this.onConfigChange(this.config, oldConfig);
            }
        }
        catch (error) {
            // Revert on error
            this.config = oldConfig;
            throw error;
        }
    }
    /**
     * Resolve configuration from all sources
     * Priority: constructor > env > files > defaults
     */
    resolveConfiguration(constructorConfig) {
        const manifest = this.getManifest();
        // Create config resolver
        this.configResolver = new AugmentationConfigResolver({
            augmentationId: manifest.id,
            schema: manifest.configSchema,
            defaults: manifest.configDefaults
        });
        // Resolve configuration from all sources
        return this.configResolver.resolve(constructorConfig);
    }
    async initialize(context) {
        this.context = context;
        this.isInitialized = true;
        await this.onInitialize();
    }
    /**
     * Override this in subclasses for initialization logic
     */
    async onInitialize() {
        // Default: no-op
    }
    shouldExecute(operation, params) {
        // Default: execute if operations match exactly or includes 'all'
        return this.operations.includes('all') ||
            this.operations.includes(operation) ||
            this.operations.some(op => operation.includes(op));
    }
    async shutdown() {
        await this.onShutdown();
        this.isInitialized = false;
    }
    /**
     * Override this in subclasses for cleanup logic
     */
    async onShutdown() {
        // Default: no-op
    }
    /**
     * Log a message with the augmentation name
     */
    log(message, level = 'info') {
        if (this.context) {
            this.context.log(`[${this.name}] ${message}`, level);
        }
    }
}
/**
 * Alias for backward compatibility
 * ConfigurableAugmentation is now merged into BaseAugmentation
 * @deprecated Use BaseAugmentation instead
 */
export const ConfigurableAugmentation = BaseAugmentation;
/**
 * Registry for managing augmentations
 */
export class AugmentationRegistry {
    constructor() {
        this.augmentations = [];
    }
    /**
     * Register an augmentation
     */
    register(augmentation) {
        this.augmentations.push(augmentation);
        // Sort by priority (highest first)
        this.augmentations.sort((a, b) => b.priority - a.priority);
    }
    /**
     * Find augmentations by operation (before initialization)
     * Used for two-phase initialization to find storage augmentations
     */
    findByOperation(operation) {
        return this.augmentations.find(aug => aug.operations.includes(operation) ||
            aug.operations.includes('all')) || null;
    }
    /**
     * Initialize all augmentations
     */
    async initialize(context) {
        this.context = context;
        for (const augmentation of this.augmentations) {
            await augmentation.initialize(context);
        }
        context.log(`Initialized ${this.augmentations.length} augmentations`);
    }
    /**
     * Initialize all augmentations (alias for consistency)
     */
    async initializeAll(context) {
        return this.initialize(context);
    }
    /**
     * Execute augmentations for an operation
     */
    async execute(operation, params, mainOperation) {
        // Filter augmentations that should execute for this operation
        const applicable = this.augmentations.filter(aug => aug.shouldExecute ? aug.shouldExecute(operation, params) :
            aug.operations.includes('all') ||
                aug.operations.includes(operation) ||
                aug.operations.some(op => operation.includes(op)));
        if (applicable.length === 0) {
            // No augmentations, execute main operation directly
            return mainOperation();
        }
        // Create a chain of augmentations
        let index = 0;
        const executeNext = async () => {
            if (index >= applicable.length) {
                // All augmentations processed, execute main operation
                return mainOperation();
            }
            const augmentation = applicable[index++];
            return augmentation.execute(operation, params, executeNext);
        };
        return executeNext();
    }
    /**
     * Get all registered augmentations
     */
    getAll() {
        return [...this.augmentations];
    }
    /**
     * Get augmentation info for listing
     */
    getInfo() {
        return this.augmentations.map(aug => {
            const baseAug = aug;
            return {
                name: aug.name,
                type: baseAug.category || 'core',
                enabled: baseAug.enabled !== false,
                description: baseAug.description || `${aug.name} augmentation`,
                category: baseAug.category || 'core',
                priority: aug.priority
            };
        });
    }
    /**
     * Get augmentations by name
     */
    get(name) {
        return this.augmentations.find(aug => aug.name === name);
    }
    /**
     * Discover augmentation parameters and schemas
     * Critical for tools like brain-cloud to generate UIs
     */
    discover(name) {
        if (name) {
            const aug = this.get(name);
            if (!aug)
                return null;
            const baseAug = aug;
            return {
                name: aug.name,
                operations: aug.operations,
                priority: aug.priority,
                timing: aug.timing,
                metadata: aug.metadata,
                manifest: baseAug.getManifest ? baseAug.getManifest() : undefined,
                parameters: baseAug.getParameterSchema ?
                    aug.operations.reduce((acc, op) => {
                        acc[op] = baseAug.getParameterSchema(op);
                        return acc;
                    }, {}) : undefined,
                operationInfo: baseAug.getOperationInfo ? baseAug.getOperationInfo() : undefined,
                config: baseAug.getConfig ? baseAug.getConfig() : undefined
            };
        }
        // Return all augmentations discovery info
        return this.augmentations.map(aug => this.discover(aug.name));
    }
    /**
     * Get configuration schema for an augmentation
     * Enables UI generation for configuration
     */
    getConfigSchema(name) {
        const aug = this.get(name);
        if (!aug || !aug.getManifest)
            return null;
        const manifest = aug.getManifest();
        return manifest?.configSchema;
    }
    /**
     * Configure an augmentation at runtime
     */
    async configure(name, config) {
        const aug = this.get(name);
        if (!aug || !aug.updateConfig) {
            throw new Error(`Augmentation ${name} does not support configuration`);
        }
        await aug.updateConfig(config);
    }
    /**
     * Get metrics for an augmentation
     */
    metrics(name) {
        if (name) {
            const aug = this.get(name);
            if (!aug || !aug.metrics)
                return null;
            return aug.metrics();
        }
        // Return all metrics
        const allMetrics = {};
        for (const aug of this.augmentations) {
            const a = aug;
            if (a.metrics) {
                allMetrics[aug.name] = a.metrics();
            }
        }
        return allMetrics;
    }
    /**
     * Get health status
     */
    health() {
        const health = {
            overall: 'healthy',
            augmentations: {}
        };
        for (const aug of this.augmentations) {
            const a = aug;
            health.augmentations[aug.name] = a.health ? a.health() : 'unknown';
        }
        return health;
    }
    /**
     * Shutdown all augmentations
     */
    async shutdown() {
        for (const augmentation of this.augmentations) {
            if (augmentation.shutdown) {
                await augmentation.shutdown();
            }
        }
        this.augmentations = [];
    }
}
//# sourceMappingURL=brainyAugmentation.js.map