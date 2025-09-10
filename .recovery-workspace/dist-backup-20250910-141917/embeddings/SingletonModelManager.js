/**
 * Singleton Model Manager - THE ONLY SOURCE OF EMBEDDING MODELS
 *
 * This is the SINGLE, UNIFIED model initialization system that ensures:
 * - Only ONE model instance exists across the entire system
 * - Precision is configured once and locked
 * - All components share the same model
 * - No possibility of mixed precisions
 *
 * CRITICAL: This manager is used by EVERYTHING:
 * - Storage operations (add, update)
 * - Search operations (search, find)
 * - Public API (embed, cluster)
 * - Neural API (all neural.* methods)
 * - Internal operations (deduplication, indexing)
 */
import { TransformerEmbedding } from '../utils/embedding.js';
import { getModelPrecision, lockModelPrecision } from '../config/modelPrecisionManager.js';
// Global state - ensures true singleton across entire process
let globalModelInstance = null;
let globalInitPromise = null;
let globalInitialized = false;
/**
 * The ONE TRUE model manager
 */
export class SingletonModelManager {
    constructor() {
        this.stats = {
            initialized: false,
            precision: 'unknown',
            initCount: 0,
            embedCount: 0,
            lastUsed: null
        };
        // Private constructor enforces singleton
        this.stats.precision = getModelPrecision();
        console.log(`🔐 SingletonModelManager initialized with ${this.stats.precision.toUpperCase()} precision`);
    }
    /**
     * Get the singleton instance
     */
    static getInstance() {
        if (!SingletonModelManager.instance) {
            SingletonModelManager.instance = new SingletonModelManager();
        }
        return SingletonModelManager.instance;
    }
    /**
     * Get the model instance - creates if needed, reuses if exists
     * This is THE ONLY way to get a model in the entire system
     */
    async getModel() {
        // If already initialized, return immediately
        if (globalModelInstance && globalInitialized) {
            this.stats.lastUsed = new Date();
            return globalModelInstance;
        }
        // If initialization is in progress, wait for it
        if (globalInitPromise) {
            console.log('⏳ Model initialization already in progress, waiting...');
            return await globalInitPromise;
        }
        // Start initialization (only happens once ever)
        globalInitPromise = this.initializeModel();
        try {
            const model = await globalInitPromise;
            globalInitialized = true;
            return model;
        }
        catch (error) {
            // Reset on error to allow retry
            globalInitPromise = null;
            throw error;
        }
    }
    /**
     * Initialize the model - happens exactly once
     */
    async initializeModel() {
        console.log('🚀 Initializing singleton model instance...');
        // Get precision from central manager
        const precision = getModelPrecision();
        console.log(`📊 Using ${precision.toUpperCase()} precision (${precision === 'q8' ? '23MB, 99% accuracy' : '90MB, 100% accuracy'})`);
        // Detect environment for optimal settings
        const isNode = typeof process !== 'undefined' && process.versions?.node;
        const isBrowser = typeof window !== 'undefined' && typeof document !== 'undefined';
        const isServerless = typeof process !== 'undefined' && (process.env.VERCEL ||
            process.env.NETLIFY ||
            process.env.AWS_LAMBDA_FUNCTION_NAME ||
            process.env.FUNCTIONS_WORKER_RUNTIME);
        const isTest = globalThis.__BRAINY_TEST_ENV__ || process.env.NODE_ENV === 'test';
        // Create optimized options based on environment
        const options = {
            precision: precision,
            verbose: !isTest && !isServerless && !isBrowser,
            device: 'cpu', // CPU is most compatible
            localFilesOnly: process.env.BRAINY_ALLOW_REMOTE_MODELS === 'false',
            model: 'Xenova/all-MiniLM-L6-v2'
        };
        try {
            // Create the ONE model instance
            globalModelInstance = new TransformerEmbedding(options);
            // Initialize it
            await globalModelInstance.init();
            // CRITICAL: Lock the precision after successful initialization
            // This prevents any future changes to precision
            lockModelPrecision();
            console.log('🔒 Model precision locked at:', precision.toUpperCase());
            // Update stats
            this.stats.initialized = true;
            this.stats.initCount++;
            this.stats.lastUsed = new Date();
            // Log memory usage if available
            if (isNode && process.memoryUsage) {
                const usage = process.memoryUsage();
                this.stats.memoryFootprint = Math.round(usage.heapUsed / 1024 / 1024);
                console.log(`💾 Model loaded, memory usage: ${this.stats.memoryFootprint}MB`);
            }
            console.log('✅ Singleton model initialized successfully');
            return globalModelInstance;
        }
        catch (error) {
            console.error('❌ Failed to initialize singleton model:', error);
            globalModelInstance = null;
            throw new Error(`Singleton model initialization failed: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    /**
     * Get embedding function that uses the singleton model
     */
    async getEmbeddingFunction() {
        const model = await this.getModel();
        return async (data) => {
            this.stats.embedCount++;
            this.stats.lastUsed = new Date();
            return await model.embed(data);
        };
    }
    /**
     * Direct embed method for convenience
     */
    async embed(data) {
        const model = await this.getModel();
        this.stats.embedCount++;
        this.stats.lastUsed = new Date();
        return await model.embed(data);
    }
    /**
     * Check if model is initialized
     */
    isInitialized() {
        return globalInitialized && globalModelInstance !== null;
    }
    /**
     * Get current statistics
     */
    getStats() {
        return {
            ...this.stats,
            precision: getModelPrecision()
        };
    }
    /**
     * Validate precision consistency
     * Throws error if attempting to use different precision
     */
    validatePrecision(requestedPrecision) {
        const currentPrecision = getModelPrecision();
        if (requestedPrecision && requestedPrecision !== currentPrecision) {
            throw new Error(`❌ Precision mismatch! System is using ${currentPrecision.toUpperCase()} ` +
                `but ${requestedPrecision.toUpperCase()} was requested. ` +
                `All operations must use the same precision.`);
        }
    }
    /**
     * Force cleanup (for testing only)
     * WARNING: This will break consistency - use only in tests
     */
    async _testOnlyCleanup() {
        if (process.env.NODE_ENV !== 'test') {
            throw new Error('Cleanup only allowed in test environment');
        }
        if (globalModelInstance && 'dispose' in globalModelInstance) {
            await globalModelInstance.dispose();
        }
        globalModelInstance = null;
        globalInitPromise = null;
        globalInitialized = false;
        this.stats.initialized = false;
        console.log('🧹 Singleton model cleaned up (test only)');
    }
}
// Export the singleton instance getter
export const singletonModelManager = SingletonModelManager.getInstance();
/**
 * THE ONLY embedding function that should be used anywhere
 * This ensures all operations use the same model instance
 */
export async function getUnifiedEmbeddingFunction() {
    return await singletonModelManager.getEmbeddingFunction();
}
/**
 * Direct embed function for convenience
 */
export async function unifiedEmbed(data) {
    return await singletonModelManager.embed(data);
}
/**
 * Check if model is ready
 */
export function isModelReady() {
    return singletonModelManager.isInitialized();
}
/**
 * Get model statistics
 */
export function getModelStats() {
    return singletonModelManager.getStats();
}
//# sourceMappingURL=SingletonModelManager.js.map