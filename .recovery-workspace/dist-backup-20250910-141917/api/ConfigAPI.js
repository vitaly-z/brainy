/**
 * Configuration API for Brainy 3.0
 * Provides configuration storage with optional encryption
 */
import { SecurityAPI } from './SecurityAPI.js';
export class ConfigAPI {
    constructor(storage) {
        this.storage = storage;
        this.configCache = new Map();
        this.CONFIG_NOUN_PREFIX = '_config_';
        this.security = new SecurityAPI();
    }
    /**
     * Set a configuration value with optional encryption
     */
    async set(params) {
        const { key, value, encrypt = false } = params;
        // Serialize and optionally encrypt the value
        let storedValue = value;
        if (typeof value !== 'string') {
            storedValue = JSON.stringify(value);
        }
        if (encrypt) {
            storedValue = await this.security.encrypt(storedValue);
        }
        // Create config entry
        const entry = {
            key,
            value: storedValue,
            encrypted: encrypt,
            createdAt: this.configCache.get(key)?.createdAt || Date.now(),
            updatedAt: Date.now()
        };
        // Store in cache
        this.configCache.set(key, entry);
        // Persist to storage
        const configId = this.CONFIG_NOUN_PREFIX + key;
        await this.storage.saveMetadata(configId, entry);
    }
    /**
     * Get a configuration value with optional decryption
     */
    async get(params) {
        const { key, decrypt, defaultValue } = params;
        // Check cache first
        let entry = this.configCache.get(key);
        // If not in cache, load from storage
        if (!entry) {
            const configId = this.CONFIG_NOUN_PREFIX + key;
            const metadata = await this.storage.getMetadata(configId);
            if (!metadata) {
                return defaultValue;
            }
            entry = metadata;
            this.configCache.set(key, entry);
        }
        let value = entry.value;
        // Decrypt if needed
        const shouldDecrypt = decrypt !== undefined ? decrypt : entry.encrypted;
        if (shouldDecrypt && entry.encrypted && typeof value === 'string') {
            value = await this.security.decrypt(value);
        }
        // Try to parse JSON if it looks like JSON
        if (typeof value === 'string' && (value.startsWith('{') || value.startsWith('['))) {
            try {
                value = JSON.parse(value);
            }
            catch {
                // Not JSON, return as string
            }
        }
        return value;
    }
    /**
     * Delete a configuration value
     */
    async delete(key) {
        // Remove from cache
        this.configCache.delete(key);
        // Remove from storage
        const configId = this.CONFIG_NOUN_PREFIX + key;
        await this.storage.saveMetadata(configId, null);
    }
    /**
     * List all configuration keys
     */
    async list() {
        // Get all metadata keys from storage
        const allMetadata = await this.storage.getMetadata('');
        if (!allMetadata || typeof allMetadata !== 'object') {
            return [];
        }
        // Filter for config keys
        const configKeys = [];
        for (const key of Object.keys(allMetadata)) {
            if (key.startsWith(this.CONFIG_NOUN_PREFIX)) {
                configKeys.push(key.substring(this.CONFIG_NOUN_PREFIX.length));
            }
        }
        return configKeys;
    }
    /**
     * Check if a configuration key exists
     */
    async has(key) {
        if (this.configCache.has(key)) {
            return true;
        }
        const configId = this.CONFIG_NOUN_PREFIX + key;
        const metadata = await this.storage.getMetadata(configId);
        return metadata !== null && metadata !== undefined;
    }
    /**
     * Clear all configuration
     */
    async clear() {
        // Clear cache
        this.configCache.clear();
        // Clear from storage
        const keys = await this.list();
        for (const key of keys) {
            await this.delete(key);
        }
    }
    /**
     * Export all configuration
     */
    async export() {
        const keys = await this.list();
        const config = {};
        for (const key of keys) {
            const entry = await this.getEntry(key);
            if (entry) {
                config[key] = entry;
            }
        }
        return config;
    }
    /**
     * Import configuration
     */
    async import(config) {
        for (const [key, entry] of Object.entries(config)) {
            this.configCache.set(key, entry);
            const configId = this.CONFIG_NOUN_PREFIX + key;
            await this.storage.saveMetadata(configId, entry);
        }
    }
    /**
     * Get raw config entry (without decryption)
     */
    async getEntry(key) {
        if (this.configCache.has(key)) {
            return this.configCache.get(key);
        }
        const configId = this.CONFIG_NOUN_PREFIX + key;
        const metadata = await this.storage.getMetadata(configId);
        if (!metadata) {
            return null;
        }
        const entry = metadata;
        this.configCache.set(key, entry);
        return entry;
    }
}
//# sourceMappingURL=ConfigAPI.js.map