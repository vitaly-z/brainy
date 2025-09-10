/**
 * Augmentation Discovery API
 *
 * Provides discovery and configuration capabilities for augmentations
 * Enables tools like brain-cloud to dynamically discover, configure, and manage augmentations
 */
/**
 * Augmentation Discovery API
 *
 * Provides a unified interface for discovering and managing augmentations
 */
export class AugmentationDiscovery {
    constructor(registry) {
        this.registry = registry;
    }
    /**
     * Discover all registered augmentations with manifests
     * @param options Discovery options
     * @returns List of augmentation listings
     */
    async discover(options = {}) {
        const augmentations = this.registry.getAll();
        const listings = [];
        for (const aug of augmentations) {
            // Check if augmentation has manifest support
            const hasManifest = 'getManifest' in aug && typeof aug.getManifest === 'function';
            if (!hasManifest) {
                // Skip augmentations without manifest support (legacy)
                continue;
            }
            try {
                // Check if augmentation has manifest method
                if (!('getManifest' in aug) || typeof aug.getManifest !== 'function') {
                    continue;
                }
                const getManifestFn = aug.getManifest;
                const manifest = getManifestFn();
                // Apply filters
                if (options.category && manifest.category !== options.category) {
                    continue;
                }
                if (options.enabled !== undefined) {
                    const isEnabled = aug.enabled !== false;
                    if (isEnabled !== options.enabled) {
                        continue;
                    }
                }
                // Build listing
                const listing = {
                    id: manifest.id,
                    name: manifest.name,
                    manifest,
                    status: {
                        enabled: aug.enabled !== false,
                        initialized: aug.isInitialized || false,
                        category: aug.category || manifest.category,
                        priority: aug.priority
                    }
                };
                // Include configuration if requested
                if (options.includeConfig && 'getConfig' in aug) {
                    const getConfigFn = aug.getConfig;
                    listing.config = {
                        current: getConfigFn()
                    };
                    if (options.includeSchema) {
                        listing.config.schema = manifest.configSchema;
                    }
                }
                listings.push(listing);
            }
            catch (error) {
                console.warn(`Failed to get manifest for augmentation ${aug.name}:`, error);
            }
        }
        // Sort by priority (highest first) then by name
        listings.sort((a, b) => {
            const priorityDiff = b.status.priority - a.status.priority;
            if (priorityDiff !== 0)
                return priorityDiff;
            return a.name.localeCompare(b.name);
        });
        return listings;
    }
    /**
     * Get a specific augmentation's manifest
     * @param augId Augmentation ID
     * @returns Augmentation manifest or null if not found
     */
    async getManifest(augId) {
        const aug = this.registry.get(augId);
        if (!aug || !('getManifest' in aug)) {
            return null;
        }
        try {
            const getManifestFn = aug.getManifest;
            return getManifestFn();
        }
        catch (error) {
            console.error(`Failed to get manifest for ${augId}:`, error);
            return null;
        }
    }
    /**
     * Get configuration schema for an augmentation
     * @param augId Augmentation ID
     * @returns Configuration schema or null
     */
    async getConfigSchema(augId) {
        const manifest = await this.getManifest(augId);
        return manifest?.configSchema || null;
    }
    /**
     * Get current configuration for an augmentation
     * @param augId Augmentation ID
     * @returns Current configuration or null
     */
    async getConfig(augId) {
        const aug = this.registry.get(augId);
        if (!aug || !('getConfig' in aug)) {
            return null;
        }
        try {
            const getConfigFn = aug.getConfig;
            return getConfigFn();
        }
        catch (error) {
            console.error(`Failed to get config for ${augId}:`, error);
            return null;
        }
    }
    /**
     * Update configuration for an augmentation
     * @param augId Augmentation ID
     * @param config New configuration
     * @returns Updated configuration or null on failure
     */
    async updateConfig(augId, config) {
        const aug = this.registry.get(augId);
        if (!aug || !('updateConfig' in aug) || !('getConfig' in aug)) {
            throw new Error(`Augmentation ${augId} does not support configuration updates`);
        }
        try {
            const updateConfigFn = aug.updateConfig;
            await updateConfigFn(config);
            const getConfigFn = aug.getConfig;
            return getConfigFn();
        }
        catch (error) {
            throw new Error(`Failed to update config for ${augId}: ${error}`);
        }
    }
    /**
     * Validate configuration against schema
     * @param augId Augmentation ID
     * @param config Configuration to validate
     * @returns Validation result
     */
    async validateConfig(augId, config) {
        const schema = await this.getConfigSchema(augId);
        if (!schema) {
            return {
                valid: true,
                warnings: ['No schema available for validation']
            };
        }
        const errors = [];
        const warnings = [];
        const suggestions = [];
        // Check required fields
        if (schema.required) {
            for (const field of schema.required) {
                if (config[field] === undefined) {
                    errors.push(`Missing required field: ${field}`);
                }
            }
        }
        // Validate properties
        if (schema.properties) {
            for (const [key, propSchema] of Object.entries(schema.properties)) {
                const value = config[key];
                if (value === undefined) {
                    // Check if there's a default
                    if (propSchema.default !== undefined) {
                        suggestions.push(`Field '${key}' not provided, will use default: ${JSON.stringify(propSchema.default)}`);
                    }
                    continue;
                }
                // Type validation
                if (propSchema.type) {
                    const actualType = Array.isArray(value) ? 'array' : typeof value;
                    if (actualType !== propSchema.type) {
                        errors.push(`${key}: expected ${propSchema.type}, got ${actualType}`);
                    }
                }
                // Additional validations for specific types
                this.validatePropertyValue(key, value, propSchema, errors, warnings);
            }
        }
        // Check for unknown properties
        if (schema.additionalProperties === false && schema.properties) {
            const allowedKeys = Object.keys(schema.properties);
            for (const key of Object.keys(config)) {
                if (!allowedKeys.includes(key)) {
                    warnings.push(`Unknown property: ${key}`);
                }
            }
        }
        return {
            valid: errors.length === 0,
            errors: errors.length > 0 ? errors : undefined,
            warnings: warnings.length > 0 ? warnings : undefined,
            suggestions: suggestions.length > 0 ? suggestions : undefined
        };
    }
    /**
     * Validate a property value against its schema
     */
    validatePropertyValue(key, value, schema, errors, warnings) {
        // Number validations
        if (schema.type === 'number') {
            if (schema.minimum !== undefined && value < schema.minimum) {
                errors.push(`${key}: value ${value} is less than minimum ${schema.minimum}`);
            }
            if (schema.maximum !== undefined && value > schema.maximum) {
                errors.push(`${key}: value ${value} is greater than maximum ${schema.maximum}`);
            }
        }
        // String validations
        if (schema.type === 'string') {
            if (schema.minLength !== undefined && value.length < schema.minLength) {
                errors.push(`${key}: length ${value.length} is less than minimum ${schema.minLength}`);
            }
            if (schema.maxLength !== undefined && value.length > schema.maxLength) {
                errors.push(`${key}: length ${value.length} is greater than maximum ${schema.maxLength}`);
            }
            if (schema.pattern) {
                const regex = new RegExp(schema.pattern);
                if (!regex.test(value)) {
                    errors.push(`${key}: value does not match pattern ${schema.pattern}`);
                }
            }
        }
        // Enum validation
        if (schema.enum && !schema.enum.includes(value)) {
            errors.push(`${key}: value '${value}' is not one of allowed values: ${schema.enum.join(', ')}`);
        }
    }
    /**
     * Get environment variables for an augmentation
     * @param augId Augmentation ID
     * @returns Map of environment variable names to descriptions
     */
    async getEnvironmentVariables(augId) {
        const manifest = await this.getManifest(augId);
        if (!manifest?.configSchema?.properties) {
            return null;
        }
        const prefix = `BRAINY_AUG_${augId.toUpperCase()}_`;
        const vars = {};
        for (const [key, prop] of Object.entries(manifest.configSchema.properties)) {
            const envKey = prefix + key.replace(/([A-Z])/g, '_$1').toUpperCase();
            vars[envKey] = {
                configKey: key,
                description: prop.description,
                type: prop.type,
                default: prop.default,
                required: manifest.configSchema.required?.includes(key),
                currentValue: typeof process !== 'undefined' ? process.env?.[envKey] : undefined
            };
        }
        return vars;
    }
    /**
     * Get configuration examples for an augmentation
     * @param augId Augmentation ID
     * @returns Configuration examples or empty array
     */
    async getConfigExamples(augId) {
        const manifest = await this.getManifest(augId);
        return manifest?.configExamples || [];
    }
    /**
     * Check if an augmentation supports configuration
     * @param augId Augmentation ID
     * @returns True if augmentation supports configuration
     */
    async supportsConfiguration(augId) {
        const aug = this.registry.get(augId);
        return !!(aug && 'getConfig' in aug && 'updateConfig' in aug);
    }
    /**
     * Get augmentations by category
     * @param category Category to filter by
     * @returns List of augmentations in the category
     */
    async getByCategory(category) {
        return this.discover({ category });
    }
    /**
     * Get enabled augmentations
     * @returns List of enabled augmentations
     */
    async getEnabled() {
        return this.discover({ enabled: true });
    }
    /**
     * Search augmentations by keyword
     * @param query Search query
     * @returns Matching augmentations
     */
    async search(query) {
        const all = await this.discover();
        const queryLower = query.toLowerCase();
        return all.filter(listing => {
            const manifest = listing.manifest;
            // Search in various fields
            const searchFields = [
                manifest.name,
                manifest.description,
                manifest.longDescription,
                ...(manifest.keywords || []),
                manifest.category
            ].filter(Boolean).map(s => s.toLowerCase());
            return searchFields.some(field => field.includes(queryLower));
        });
    }
    /**
     * Export configuration for all augmentations
     * @returns Map of augmentation IDs to configurations
     */
    async exportConfigurations() {
        const configs = {};
        const listings = await this.discover({ includeConfig: true });
        for (const listing of listings) {
            if (listing.config?.current) {
                configs[listing.id] = listing.config.current;
            }
        }
        return configs;
    }
    /**
     * Import configurations for multiple augmentations
     * @param configs Map of augmentation IDs to configurations
     * @returns Results of import operation
     */
    async importConfigurations(configs) {
        const results = {};
        for (const [augId, config] of Object.entries(configs)) {
            try {
                // Validate before applying
                const validation = await this.validateConfig(augId, config);
                if (!validation.valid) {
                    results[augId] = {
                        success: false,
                        error: `Validation failed: ${validation.errors?.join(', ')}`
                    };
                    continue;
                }
                // Apply configuration
                await this.updateConfig(augId, config);
                results[augId] = { success: true };
            }
            catch (error) {
                results[augId] = {
                    success: false,
                    error: error instanceof Error ? error.message : String(error)
                };
            }
        }
        return results;
    }
    /**
     * Generate configuration documentation
     * @param augId Augmentation ID
     * @returns Markdown documentation
     */
    async generateConfigDocs(augId) {
        const manifest = await this.getManifest(augId);
        if (!manifest)
            return null;
        const schema = manifest.configSchema;
        const examples = manifest.configExamples || [];
        const envVars = await this.getEnvironmentVariables(augId);
        let docs = `# ${manifest.name} Configuration\n\n`;
        docs += `${manifest.description}\n\n`;
        if (manifest.longDescription) {
            docs += `## Overview\n\n${manifest.longDescription}\n\n`;
        }
        // Configuration options
        if (schema?.properties) {
            docs += `## Configuration Options\n\n`;
            for (const [key, prop] of Object.entries(schema.properties)) {
                const required = schema.required?.includes(key) ? ' *(required)*' : '';
                docs += `### \`${key}\`${required}\n\n`;
                if (prop.description) {
                    docs += `${prop.description}\n\n`;
                }
                docs += `- **Type**: ${prop.type}\n`;
                if (prop.default !== undefined) {
                    docs += `- **Default**: \`${JSON.stringify(prop.default)}\`\n`;
                }
                if (prop.minimum !== undefined) {
                    docs += `- **Minimum**: ${prop.minimum}\n`;
                }
                if (prop.maximum !== undefined) {
                    docs += `- **Maximum**: ${prop.maximum}\n`;
                }
                if (prop.enum) {
                    docs += `- **Allowed values**: ${prop.enum.map(v => `\`${v}\``).join(', ')}\n`;
                }
                docs += '\n';
            }
        }
        // Environment variables
        if (envVars && Object.keys(envVars).length > 0) {
            docs += `## Environment Variables\n\n`;
            docs += `| Variable | Config Key | Type | Required | Default |\n`;
            docs += `|----------|------------|------|----------|----------|\n`;
            for (const [envKey, info] of Object.entries(envVars)) {
                docs += `| \`${envKey}\` | ${info.configKey} | ${info.type} | ${info.required ? 'Yes' : 'No'} | ${info.default !== undefined ? `\`${info.default}\`` : '-'} |\n`;
            }
            docs += '\n';
        }
        // Examples
        if (examples.length > 0) {
            docs += `## Examples\n\n`;
            for (const example of examples) {
                docs += `### ${example.name}\n\n`;
                if (example.description) {
                    docs += `${example.description}\n\n`;
                }
                docs += '```json\n';
                docs += JSON.stringify(example.config, null, 2);
                docs += '\n```\n\n';
            }
        }
        return docs;
    }
}
//# sourceMappingURL=discovery.js.map