/**
 * Extensible Configuration System
 * Allows augmentations to register new storage types, presets, and configurations
 */
import { PresetConfig } from './distributedPresets.js';
import { StorageConfigResult } from './storageAutoConfig.js';
/**
 * Storage provider registration interface
 */
export interface StorageProvider {
    type: string;
    name: string;
    description: string;
    detect: () => Promise<boolean>;
    getConfig: () => Promise<any>;
    priority?: number;
    requirements?: {
        env?: string[];
        packages?: string[];
    };
}
/**
 * Preset extension interface
 */
export interface PresetExtension {
    name: string;
    config: PresetConfig;
    override?: boolean;
}
/**
 * Global registry for extensions
 */
declare class ConfigurationRegistry {
    private static instance;
    private storageProviders;
    private presetExtensions;
    private autoDetectHooks;
    private constructor();
    static getInstance(): ConfigurationRegistry;
    /**
     * Register a new storage provider
     * This is how augmentations add new storage types
     */
    registerStorageProvider(provider: StorageProvider): void;
    /**
     * Register a new preset
     */
    registerPreset(name: string, extension: PresetExtension): void;
    /**
     * Register an auto-detection hook
     */
    registerAutoDetectHook(hook: () => Promise<any>): void;
    /**
     * Get all registered storage providers
     */
    getStorageProviders(): StorageProvider[];
    /**
     * Get all registered presets (built-in + extensions)
     */
    getAllPresets(): Map<string, PresetConfig>;
    /**
     * Auto-detect storage including extensions
     */
    autoDetectStorage(): Promise<StorageConfigResult>;
    /**
     * Register built-in providers
     */
    private registerBuiltInProviders;
}
/**
 * Example: Redis storage provider registration
 * This would be in the redis augmentation package
 */
export declare const redisStorageProvider: StorageProvider;
/**
 * Example: MongoDB storage provider
 */
export declare const mongoStorageProvider: StorageProvider;
/**
 * Example: PostgreSQL with pgvector extension
 */
export declare const postgresStorageProvider: StorageProvider;
/**
 * How an augmentation would register its storage provider
 */
export declare function registerStorageAugmentation(provider: StorageProvider): void;
/**
 * How to register a new preset
 */
export declare function registerPresetAugmentation(name: string, config: PresetConfig): void;
/**
 * Example preset for Redis-based caching service
 */
export declare const redisCachePreset: PresetConfig;
/**
 * Get the configuration registry
 */
export declare function getConfigRegistry(): ConfigurationRegistry;
export {};
