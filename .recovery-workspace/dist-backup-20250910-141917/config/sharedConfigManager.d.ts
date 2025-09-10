/**
 * Shared Configuration Manager
 * Ensures configuration consistency across multiple instances using shared storage
 */
import { ModelPrecision } from './modelAutoConfig.js';
export interface SharedConfig {
    version: string;
    precision: ModelPrecision;
    dimensions: number;
    hnswM: number;
    hnswEfConstruction: number;
    distanceFunction: string;
    createdAt: string;
    lastUpdated: string;
    instanceCount?: number;
    lastAccessedBy?: string;
}
/**
 * Manages configuration consistency for shared storage
 */
export declare class SharedConfigManager {
    private static CONFIG_FILE;
    /**
     * Load or create shared configuration
     * When connecting to existing data, this OVERRIDES auto-configuration!
     */
    static loadOrCreateSharedConfig(storage: any, localConfig: any): Promise<{
        config: any;
        warnings: string[];
    }>;
    /**
     * Check if storage type is shared (multi-instance)
     */
    private static isSharedStorage;
    /**
     * Load configuration from shared storage
     */
    private static loadConfigFromStorage;
    /**
     * Save configuration to shared storage
     */
    private static saveConfigToStorage;
    /**
     * Create shared configuration from local config
     */
    private static createSharedConfig;
    /**
     * Check for critical configuration mismatches
     */
    private static checkCriticalMismatches;
    /**
     * Merge local config with shared config (shared takes precedence for critical params)
     */
    private static mergeWithSharedConfig;
    /**
     * Update access information in shared config
     */
    private static updateAccessInfo;
    /**
     * Get unique identifier for this instance
     */
    private static getInstanceIdentifier;
    /**
     * Validate that a configuration is compatible with shared data
     */
    static validateCompatibility(config1: SharedConfig, config2: SharedConfig): boolean;
}
