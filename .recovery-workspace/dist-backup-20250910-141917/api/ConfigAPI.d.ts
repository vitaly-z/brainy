/**
 * Configuration API for Brainy 3.0
 * Provides configuration storage with optional encryption
 */
import { StorageAdapter } from '../coreTypes.js';
export interface ConfigOptions {
    encrypt?: boolean;
    decrypt?: boolean;
}
export interface ConfigEntry {
    key: string;
    value: any;
    encrypted: boolean;
    createdAt: number;
    updatedAt: number;
}
export declare class ConfigAPI {
    private storage;
    private security;
    private configCache;
    private CONFIG_NOUN_PREFIX;
    constructor(storage: StorageAdapter);
    /**
     * Set a configuration value with optional encryption
     */
    set(params: {
        key: string;
        value: any;
        encrypt?: boolean;
    }): Promise<void>;
    /**
     * Get a configuration value with optional decryption
     */
    get(params: {
        key: string;
        decrypt?: boolean;
        defaultValue?: any;
    }): Promise<any>;
    /**
     * Delete a configuration value
     */
    delete(key: string): Promise<void>;
    /**
     * List all configuration keys
     */
    list(): Promise<string[]>;
    /**
     * Check if a configuration key exists
     */
    has(key: string): Promise<boolean>;
    /**
     * Clear all configuration
     */
    clear(): Promise<void>;
    /**
     * Export all configuration
     */
    export(): Promise<Record<string, ConfigEntry>>;
    /**
     * Import configuration
     */
    import(config: Record<string, ConfigEntry>): Promise<void>;
    /**
     * Get raw config entry (without decryption)
     */
    private getEntry;
}
