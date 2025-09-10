/**
 * Augmentation Discovery API
 *
 * Provides discovery and configuration capabilities for augmentations
 * Enables tools like brain-cloud to dynamically discover, configure, and manage augmentations
 */
import { AugmentationRegistry } from './brainyAugmentation.js';
import { AugmentationManifest, JSONSchema } from './manifest.js';
/**
 * Augmentation listing with manifest and status
 */
export interface AugmentationListing {
    id: string;
    name: string;
    manifest: AugmentationManifest;
    status: {
        enabled: boolean;
        initialized: boolean;
        category: string;
        priority: number;
    };
    config?: {
        current: any;
        schema?: JSONSchema;
        sources?: any[];
    };
}
/**
 * Configuration validation result
 */
export interface ConfigValidationResult {
    valid: boolean;
    errors?: string[];
    warnings?: string[];
    suggestions?: string[];
}
/**
 * Discovery API options
 */
export interface DiscoveryOptions {
    includeConfig?: boolean;
    includeSchema?: boolean;
    includeSources?: boolean;
    category?: string;
    enabled?: boolean;
}
/**
 * Augmentation Discovery API
 *
 * Provides a unified interface for discovering and managing augmentations
 */
export declare class AugmentationDiscovery {
    private registry;
    constructor(registry: AugmentationRegistry);
    /**
     * Discover all registered augmentations with manifests
     * @param options Discovery options
     * @returns List of augmentation listings
     */
    discover(options?: DiscoveryOptions): Promise<AugmentationListing[]>;
    /**
     * Get a specific augmentation's manifest
     * @param augId Augmentation ID
     * @returns Augmentation manifest or null if not found
     */
    getManifest(augId: string): Promise<AugmentationManifest | null>;
    /**
     * Get configuration schema for an augmentation
     * @param augId Augmentation ID
     * @returns Configuration schema or null
     */
    getConfigSchema(augId: string): Promise<JSONSchema | null>;
    /**
     * Get current configuration for an augmentation
     * @param augId Augmentation ID
     * @returns Current configuration or null
     */
    getConfig(augId: string): Promise<any | null>;
    /**
     * Update configuration for an augmentation
     * @param augId Augmentation ID
     * @param config New configuration
     * @returns Updated configuration or null on failure
     */
    updateConfig(augId: string, config: any): Promise<any | null>;
    /**
     * Validate configuration against schema
     * @param augId Augmentation ID
     * @param config Configuration to validate
     * @returns Validation result
     */
    validateConfig(augId: string, config: any): Promise<ConfigValidationResult>;
    /**
     * Validate a property value against its schema
     */
    private validatePropertyValue;
    /**
     * Get environment variables for an augmentation
     * @param augId Augmentation ID
     * @returns Map of environment variable names to descriptions
     */
    getEnvironmentVariables(augId: string): Promise<Record<string, any> | null>;
    /**
     * Get configuration examples for an augmentation
     * @param augId Augmentation ID
     * @returns Configuration examples or empty array
     */
    getConfigExamples(augId: string): Promise<any[]>;
    /**
     * Check if an augmentation supports configuration
     * @param augId Augmentation ID
     * @returns True if augmentation supports configuration
     */
    supportsConfiguration(augId: string): Promise<boolean>;
    /**
     * Get augmentations by category
     * @param category Category to filter by
     * @returns List of augmentations in the category
     */
    getByCategory(category: string): Promise<AugmentationListing[]>;
    /**
     * Get enabled augmentations
     * @returns List of enabled augmentations
     */
    getEnabled(): Promise<AugmentationListing[]>;
    /**
     * Search augmentations by keyword
     * @param query Search query
     * @returns Matching augmentations
     */
    search(query: string): Promise<AugmentationListing[]>;
    /**
     * Export configuration for all augmentations
     * @returns Map of augmentation IDs to configurations
     */
    exportConfigurations(): Promise<Record<string, any>>;
    /**
     * Import configurations for multiple augmentations
     * @param configs Map of augmentation IDs to configurations
     * @returns Results of import operation
     */
    importConfigurations(configs: Record<string, any>): Promise<Record<string, {
        success: boolean;
        error?: string;
    }>>;
    /**
     * Generate configuration documentation
     * @param augId Augmentation ID
     * @returns Markdown documentation
     */
    generateConfigDocs(augId: string): Promise<string | null>;
}
