/**
 * Extensible Configuration System
 * Allows augmentations to register new storage types, presets, and configurations
 */
import { ModelPrecision, DistributedRole, PresetCategory } from './distributedPresets.js';
/**
 * Global registry for extensions
 */
class ConfigurationRegistry {
    constructor() {
        // Registered storage providers
        this.storageProviders = new Map();
        // Registered preset extensions
        this.presetExtensions = new Map();
        // Custom auto-detection hooks
        this.autoDetectHooks = [];
        // Initialize with built-in providers
        this.registerBuiltInProviders();
    }
    static getInstance() {
        if (!ConfigurationRegistry.instance) {
            ConfigurationRegistry.instance = new ConfigurationRegistry();
        }
        return ConfigurationRegistry.instance;
    }
    /**
     * Register a new storage provider
     * This is how augmentations add new storage types
     */
    registerStorageProvider(provider) {
        console.log(`📦 Registering storage provider: ${provider.type} (${provider.name})`);
        this.storageProviders.set(provider.type, provider);
    }
    /**
     * Register a new preset
     */
    registerPreset(name, extension) {
        console.log(`🎨 Registering preset: ${name}`);
        this.presetExtensions.set(name, extension);
    }
    /**
     * Register an auto-detection hook
     */
    registerAutoDetectHook(hook) {
        this.autoDetectHooks.push(hook);
    }
    /**
     * Get all registered storage providers
     */
    getStorageProviders() {
        return Array.from(this.storageProviders.values())
            .sort((a, b) => (b.priority || 0) - (a.priority || 0));
    }
    /**
     * Get all registered presets (built-in + extensions)
     */
    getAllPresets() {
        // Start with built-in presets
        const allPresets = new Map();
        // Note: Would import from distributedPresets-new.ts
        // Add extended presets
        for (const [name, extension] of this.presetExtensions) {
            if (extension.override || !allPresets.has(name)) {
                allPresets.set(name, extension.config);
            }
        }
        return allPresets;
    }
    /**
     * Auto-detect storage including extensions
     */
    async autoDetectStorage() {
        // Check registered providers first (in priority order)
        for (const provider of this.getStorageProviders()) {
            try {
                if (await provider.detect()) {
                    const config = await provider.getConfig();
                    return {
                        type: provider.type,
                        config,
                        reason: `Auto-detected ${provider.name}`,
                        autoSelected: true
                    };
                }
            }
            catch (error) {
                console.warn(`Failed to detect ${provider.type}:`, error);
            }
        }
        // Fallback to built-in detection
        const { autoDetectStorage } = await import('./storageAutoConfig.js');
        return autoDetectStorage();
    }
    /**
     * Register built-in providers
     */
    registerBuiltInProviders() {
        // These would be the built-in ones, but could be overridden
    }
}
/**
 * Example: Redis storage provider registration
 * This would be in the redis augmentation package
 */
export const redisStorageProvider = {
    type: 'redis',
    name: 'Redis Storage',
    description: 'High-performance in-memory data store',
    priority: 10, // Check before filesystem
    requirements: {
        env: ['REDIS_URL', 'REDIS_HOST'],
        packages: ['redis', 'ioredis']
    },
    async detect() {
        // Check for Redis connection info
        if (process.env.REDIS_URL || process.env.REDIS_HOST) {
            try {
                // Try to connect to Redis (dynamic import for optional dependency)
                const redis = await new Function('return import("ioredis")')().catch(() => null);
                if (!redis)
                    return false;
                const client = new redis.default(process.env.REDIS_URL);
                await client.ping();
                await client.quit();
                return true;
            }
            catch {
                // Redis not available
            }
        }
        return false;
    },
    async getConfig() {
        return {
            type: 'redis',
            redisStorage: {
                url: process.env.REDIS_URL || `redis://${process.env.REDIS_HOST}:${process.env.REDIS_PORT || 6379}`,
                prefix: process.env.REDIS_PREFIX || 'brainy:',
                ttl: process.env.REDIS_TTL ? parseInt(process.env.REDIS_TTL) : undefined
            }
        };
    }
};
/**
 * Example: MongoDB storage provider
 */
export const mongoStorageProvider = {
    type: 'mongodb',
    name: 'MongoDB Storage',
    description: 'Document database for complex data',
    priority: 8,
    requirements: {
        env: ['MONGODB_URI', 'MONGO_URL'],
        packages: ['mongodb']
    },
    async detect() {
        if (process.env.MONGODB_URI || process.env.MONGO_URL) {
            try {
                const mongodb = await new Function('return import("mongodb")')().catch(() => null);
                if (!mongodb)
                    return false;
                const client = new mongodb.MongoClient(process.env.MONGODB_URI || process.env.MONGO_URL);
                await client.connect();
                await client.close();
                return true;
            }
            catch {
                // MongoDB not available
            }
        }
        return false;
    },
    async getConfig() {
        return {
            type: 'mongodb',
            mongoStorage: {
                uri: process.env.MONGODB_URI || process.env.MONGO_URL,
                database: process.env.MONGO_DATABASE || 'brainy',
                collection: process.env.MONGO_COLLECTION || 'vectors'
            }
        };
    }
};
/**
 * Example: PostgreSQL with pgvector extension
 */
export const postgresStorageProvider = {
    type: 'postgres',
    name: 'PostgreSQL Storage',
    description: 'PostgreSQL with pgvector for scalable vector search',
    priority: 9,
    requirements: {
        env: ['DATABASE_URL', 'POSTGRES_URL'],
        packages: ['pg', 'pgvector']
    },
    async detect() {
        const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
        if (url && url.includes('postgres')) {
            try {
                const pg = await new Function('return import("pg")')().catch(() => null);
                if (!pg)
                    return false;
                const client = new pg.Client({ connectionString: url });
                await client.connect();
                // Check for pgvector extension
                const result = await client.query("SELECT * FROM pg_extension WHERE extname = 'vector'");
                await client.end();
                return result.rows.length > 0;
            }
            catch {
                // PostgreSQL not available or pgvector not installed
            }
        }
        return false;
    },
    async getConfig() {
        return {
            type: 'postgres',
            postgresStorage: {
                connectionString: process.env.DATABASE_URL || process.env.POSTGRES_URL,
                table: process.env.POSTGRES_TABLE || 'brainy_vectors',
                schema: process.env.POSTGRES_SCHEMA || 'public'
            }
        };
    }
};
/**
 * How an augmentation would register its storage provider
 */
export function registerStorageAugmentation(provider) {
    const registry = ConfigurationRegistry.getInstance();
    registry.registerStorageProvider(provider);
}
/**
 * How to register a new preset
 */
export function registerPresetAugmentation(name, config) {
    const registry = ConfigurationRegistry.getInstance();
    registry.registerPreset(name, {
        name,
        config,
        override: false
    });
}
/**
 * Example preset for Redis-based caching service
 */
export const redisCachePreset = {
    storage: 'redis', // Extended storage type
    model: ModelPrecision.Q8,
    features: ['core', 'cache', 'search'],
    distributed: true,
    role: DistributedRole.READER,
    readOnly: true,
    cache: {
        hotCacheMaxSize: 50000, // Large Redis cache
        autoTune: true
    },
    description: 'Redis-backed caching layer',
    category: PresetCategory.SERVICE
};
/**
 * Get the configuration registry
 */
export function getConfigRegistry() {
    return ConfigurationRegistry.getInstance();
}
//# sourceMappingURL=extensibleConfig.js.map