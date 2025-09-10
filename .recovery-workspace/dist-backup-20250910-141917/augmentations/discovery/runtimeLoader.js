/**
 * Runtime Augmentation Loader
 *
 * Dynamically loads and registers augmentations at runtime
 * Supports CDN loading for browser environments and npm imports for Node.js
 */
/**
 * Runtime Augmentation Loader
 *
 * Enables dynamic loading of augmentations from various sources
 */
export class RuntimeAugmentationLoader {
    constructor(options = {}) {
        this.options = options;
        this.loaded = new Map();
        this.cdnCache = new Map();
        this.options = {
            cdnUrl: options.cdnUrl || 'https://cdn.soulcraft.com/augmentations',
            allowUnsafe: options.allowUnsafe || false,
            sandbox: options.sandbox || true,
            timeout: options.timeout || 30000,
            cache: options.cache ?? true
        };
    }
    /**
     * Set the augmentation registry
     */
    setRegistry(registry) {
        this.registry = registry;
    }
    /**
     * Load augmentation from CDN (browser)
     */
    async loadFromCDN(id, version = 'latest', config) {
        // Check if already loaded
        if (this.loaded.has(id)) {
            return this.loaded.get(id);
        }
        const url = `${this.options.cdnUrl}/${id}@${version}/index.js`;
        const startTime = Date.now();
        try {
            // Load module from CDN
            const module = await this.loadCDNModule(url);
            // Extract augmentation class
            const AugmentationClass = module.default || module[Object.keys(module)[0]];
            if (!AugmentationClass) {
                throw new Error(`No augmentation class found in module ${id}`);
            }
            // Create instance
            const instance = new AugmentationClass(config);
            // Validate it's a proper augmentation
            if (!this.isValidAugmentation(instance)) {
                throw new Error(`Invalid augmentation: ${id}`);
            }
            // Get manifest
            const manifest = instance.getManifest ? instance.getManifest() : {
                id,
                name: id,
                version: version,
                description: `Dynamically loaded ${id}`,
                category: 'external'
            };
            const loaded = {
                id,
                instance,
                manifest,
                source: 'cdn',
                loadTime: Date.now() - startTime
            };
            // Cache
            this.loaded.set(id, loaded);
            // Auto-register if registry is set
            if (this.registry) {
                this.registry.register(instance);
            }
            return loaded;
        }
        catch (error) {
            throw new Error(`Failed to load augmentation ${id} from CDN: ${error}`);
        }
    }
    /**
     * Load augmentation from NPM (Node.js)
     */
    async loadFromNPM(packageName, config) {
        // Check if already loaded
        const id = packageName.replace('@', '').replace('/', '-');
        if (this.loaded.has(id)) {
            return this.loaded.get(id);
        }
        const startTime = Date.now();
        try {
            // Dynamic import
            const module = await import(packageName);
            // Extract augmentation class
            const AugmentationClass = module.default || module[Object.keys(module)[0]];
            if (!AugmentationClass) {
                throw new Error(`No augmentation class found in package ${packageName}`);
            }
            // Create instance
            const instance = new AugmentationClass(config);
            // Validate
            if (!this.isValidAugmentation(instance)) {
                throw new Error(`Invalid augmentation in package: ${packageName}`);
            }
            // Get manifest
            const manifest = instance.getManifest ? instance.getManifest() : {
                id,
                name: packageName,
                version: 'unknown',
                description: `Loaded from ${packageName}`,
                category: 'external'
            };
            const loaded = {
                id,
                instance,
                manifest,
                source: 'npm',
                loadTime: Date.now() - startTime
            };
            // Cache
            this.loaded.set(id, loaded);
            // Auto-register
            if (this.registry) {
                this.registry.register(instance);
            }
            return loaded;
        }
        catch (error) {
            throw new Error(`Failed to load augmentation from NPM ${packageName}: ${error}`);
        }
    }
    /**
     * Load augmentation from local file
     */
    async loadFromFile(path, config) {
        const startTime = Date.now();
        try {
            // Dynamic import
            const module = await import(path);
            // Extract augmentation class
            const AugmentationClass = module.default || module[Object.keys(module)[0]];
            if (!AugmentationClass) {
                throw new Error(`No augmentation class found in file ${path}`);
            }
            // Create instance
            const instance = new AugmentationClass(config);
            // Validate
            if (!this.isValidAugmentation(instance)) {
                throw new Error(`Invalid augmentation in file: ${path}`);
            }
            // Extract ID from path
            const id = path.split('/').pop()?.replace(/\.(js|ts)$/, '') || 'unknown';
            // Get manifest
            const manifest = instance.getManifest ? instance.getManifest() : {
                id,
                name: id,
                version: 'local',
                description: `Loaded from ${path}`,
                category: 'local'
            };
            const loaded = {
                id,
                instance,
                manifest,
                source: 'local',
                loadTime: Date.now() - startTime
            };
            // Cache
            this.loaded.set(id, loaded);
            // Auto-register
            if (this.registry) {
                this.registry.register(instance);
            }
            return loaded;
        }
        catch (error) {
            throw new Error(`Failed to load augmentation from file ${path}: ${error}`);
        }
    }
    /**
     * Load multiple augmentations
     */
    async loadBatch(augmentations) {
        const results = await Promise.allSettled(augmentations.map(aug => {
            switch (aug.source) {
                case 'cdn':
                    return this.loadFromCDN(aug.id, aug.version, aug.config);
                case 'npm':
                    return this.loadFromNPM(aug.id, aug.config);
                case 'local':
                    return this.loadFromFile(aug.path || aug.id, aug.config);
                default:
                    return Promise.reject(new Error(`Unknown source: ${aug.source}`));
            }
        }));
        const loaded = [];
        const errors = [];
        for (const result of results) {
            if (result.status === 'fulfilled') {
                loaded.push(result.value);
            }
            else {
                errors.push(result.reason.message);
            }
        }
        if (errors.length > 0) {
            console.warn('Some augmentations failed to load:', errors);
        }
        return loaded;
    }
    /**
     * Unload augmentation
     */
    unload(id) {
        const loaded = this.loaded.get(id);
        if (!loaded)
            return false;
        // Shutdown if possible
        if (loaded.instance.shutdown) {
            loaded.instance.shutdown();
        }
        // Remove from registry if set
        // Note: Registry doesn't have unregister yet, would need to add
        // Remove from cache
        this.loaded.delete(id);
        return true;
    }
    /**
     * Get loaded augmentations
     */
    getLoaded() {
        return Array.from(this.loaded.values());
    }
    /**
     * Check if augmentation is loaded
     */
    isLoaded(id) {
        return this.loaded.has(id);
    }
    /**
     * Get loaded augmentation
     */
    getAugmentation(id) {
        return this.loaded.get(id)?.instance || null;
    }
    /**
     * Load CDN module (browser-specific)
     */
    async loadCDNModule(url) {
        // Check cache
        if (this.options.cache && this.cdnCache.has(url)) {
            return this.cdnCache.get(url);
        }
        // In browser environment
        if (typeof window !== 'undefined') {
            return new Promise((resolve, reject) => {
                const timeout = setTimeout(() => {
                    reject(new Error(`Timeout loading ${url}`));
                }, this.options.timeout);
                // Create script element
                const script = document.createElement('script');
                script.type = 'module';
                script.src = url;
                // Handle load
                script.onload = async () => {
                    clearTimeout(timeout);
                    // The module should register itself on window
                    const moduleId = url.split('/').pop()?.split('@')[0];
                    if (moduleId && window[moduleId]) {
                        const module = window[moduleId];
                        // Cache
                        if (this.options.cache) {
                            this.cdnCache.set(url, module);
                        }
                        resolve(module);
                    }
                    else {
                        reject(new Error(`Module not found on window: ${moduleId}`));
                    }
                };
                // Handle error
                script.onerror = () => {
                    clearTimeout(timeout);
                    reject(new Error(`Failed to load script: ${url}`));
                };
                // Add to document
                document.head.appendChild(script);
            });
        }
        else {
            // In Node.js, use dynamic import
            const module = await import(url);
            // Cache
            if (this.options.cache) {
                this.cdnCache.set(url, module);
            }
            return module;
        }
    }
    /**
     * Validate augmentation instance
     */
    isValidAugmentation(instance) {
        // Check required properties
        return !!(instance.name &&
            instance.timing &&
            instance.operations &&
            instance.priority !== undefined &&
            typeof instance.execute === 'function' &&
            typeof instance.initialize === 'function');
    }
    /**
     * Clear all caches
     */
    clearCache() {
        this.cdnCache.clear();
    }
    /**
     * Get load statistics
     */
    getStats() {
        const loaded = Array.from(this.loaded.values());
        const totalLoadTime = loaded.reduce((sum, aug) => sum + aug.loadTime, 0);
        const sources = loaded.reduce((acc, aug) => {
            acc[aug.source] = (acc[aug.source] || 0) + 1;
            return acc;
        }, {});
        return {
            loaded: loaded.length,
            totalLoadTime,
            averageLoadTime: loaded.length > 0 ? totalLoadTime / loaded.length : 0,
            sources
        };
    }
}
//# sourceMappingURL=runtimeLoader.js.map