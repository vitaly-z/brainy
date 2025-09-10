/**
 * Configuration Resolver for Augmentations
 *
 * Handles loading and resolving configuration from multiple sources:
 * - Environment variables
 * - Configuration files
 * - Runtime updates
 * - Default values from schema
 */
import { JSONSchema } from './manifest.js';
/**
 * Configuration source priority (highest to lowest)
 */
export declare enum ConfigPriority {
    RUNTIME = 4,// Runtime updates (highest priority)
    CONSTRUCTOR = 3,// Constructor parameters
    ENVIRONMENT = 2,// Environment variables
    FILE = 1,// Configuration files
    DEFAULT = 0
}
/**
 * Configuration source information
 */
export interface ConfigSource {
    priority: ConfigPriority;
    source: string;
    config: any;
}
/**
 * Configuration resolution options
 */
export interface ConfigResolverOptions {
    augmentationId: string;
    schema?: JSONSchema;
    defaults?: Record<string, any>;
    configPaths?: string[];
    envPrefix?: string;
    allowUndefined?: boolean;
}
/**
 * Augmentation Configuration Resolver
 */
export declare class AugmentationConfigResolver {
    private options;
    private sources;
    private resolved;
    constructor(options: ConfigResolverOptions);
    /**
     * Resolve configuration from all sources
     * @param constructorConfig Optional constructor configuration
     * @returns Resolved configuration
     */
    resolve(constructorConfig?: any): any;
    /**
     * Load default values from schema and defaults
     */
    private loadDefaults;
    /**
     * Load configuration from files
     */
    private loadFromFiles;
    /**
     * Parse configuration file based on extension
     */
    private parseConfigFile;
    /**
     * Extract augmentation-specific configuration from a config object
     */
    private extractAugmentationConfig;
    /**
     * Load configuration from environment variables
     */
    private loadFromEnvironment;
    /**
     * Convert environment variable key to config key
     * ENABLED -> enabled
     * MAX_SIZE -> maxSize
     */
    private envKeyToConfigKey;
    /**
     * Parse environment variable value
     */
    private parseEnvValue;
    /**
     * Merge configurations by priority
     */
    private mergeConfigurations;
    /**
     * Deep merge two objects
     */
    private deepMerge;
    /**
     * Validate configuration against schema
     */
    private validateConfiguration;
    /**
     * Validate a single property against its schema
     */
    private validateProperty;
    /**
     * Get configuration sources for debugging
     */
    getSources(): ConfigSource[];
    /**
     * Get resolved configuration
     */
    getResolved(): any;
    /**
     * Update configuration at runtime
     */
    updateRuntime(config: any): any;
    /**
     * Save configuration to file
     * @param filepath Path to save configuration
     * @param format Format to save as (json, etc.)
     */
    saveToFile(filepath?: string, format?: 'json'): Promise<void>;
    /**
     * Get environment variable names for this augmentation
     */
    getEnvironmentVariables(): Record<string, any>;
}
