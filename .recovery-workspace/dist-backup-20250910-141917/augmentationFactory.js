/**
 * Augmentation Factory
 *
 * This module provides a simplified factory for creating augmentations with minimal boilerplate.
 * It reduces the complexity of creating and using augmentations by providing a fluent API
 * and handling common patterns automatically.
 */
import { registerAugmentation } from './augmentationRegistry.js';
/**
 * Base class for all augmentations created with the factory
 * Handles common functionality like initialization, shutdown, and status
 */
class BaseAugmentation {
    constructor(options) {
        this.enabled = true;
        this.isInitialized = false;
        this.name = options.name;
        this.description = options.description || `${options.name} augmentation`;
        this.enabled = options.enabled !== false;
    }
    async initialize() {
        if (this.isInitialized)
            return;
        this.isInitialized = true;
    }
    async shutDown() {
        this.isInitialized = false;
    }
    async getStatus() {
        return this.isInitialized ? 'active' : 'inactive';
    }
    async ensureInitialized() {
        if (!this.isInitialized) {
            await this.initialize();
        }
    }
}
/**
 * Factory for creating sense augmentations
 */
export function createSenseAugmentation(options) {
    const augmentation = new BaseAugmentation(options);
    // Implement the sense augmentation methods
    augmentation.processRawData = async (rawData, dataType) => {
        await augmentation.ensureInitialized();
        if (options.processRawData) {
            const result = options.processRawData(rawData, dataType);
            return result instanceof Promise ? await result : result;
        }
        return {
            success: false,
            data: { nouns: [], verbs: [] },
            error: 'processRawData not implemented'
        };
    };
    augmentation.listenToFeed = async (feedUrl, callback) => {
        await augmentation.ensureInitialized();
        if (options.listenToFeed) {
            return options.listenToFeed(feedUrl, callback);
        }
        throw new Error('listenToFeed not implemented');
    };
    // Auto-register if requested
    if (options.autoRegister) {
        registerAugmentation(augmentation);
        // Auto-initialize if requested
        if (options.autoInitialize) {
            augmentation.initialize().catch((error) => {
                console.error(`Failed to initialize augmentation ${augmentation.name}:`, error);
            });
        }
    }
    return augmentation;
}
/**
 * Factory for creating conduit augmentations
 */
export function createConduitAugmentation(options) {
    const augmentation = new BaseAugmentation(options);
    // Implement the conduit augmentation methods
    augmentation.establishConnection = async (targetSystemId, config) => {
        await augmentation.ensureInitialized();
        if (options.establishConnection) {
            const result = options.establishConnection(targetSystemId, config);
            return result instanceof Promise ? await result : result;
        }
        return {
            success: false,
            data: null,
            error: 'establishConnection not implemented'
        };
    };
    augmentation.readData = async (query, opts) => {
        await augmentation.ensureInitialized();
        if (options.readData) {
            const result = options.readData(query, opts);
            return result instanceof Promise ? await result : result;
        }
        return {
            success: false,
            data: null,
            error: 'readData not implemented'
        };
    };
    augmentation.writeData = async (data, opts) => {
        await augmentation.ensureInitialized();
        if (options.writeData) {
            const result = options.writeData(data, opts);
            return result instanceof Promise ? await result : result;
        }
        return {
            success: false,
            data: null,
            error: 'writeData not implemented'
        };
    };
    augmentation.monitorStream = async (streamId, callback) => {
        await augmentation.ensureInitialized();
        if (options.monitorStream) {
            return options.monitorStream(streamId, callback);
        }
        throw new Error('monitorStream not implemented');
    };
    // Auto-register if requested
    if (options.autoRegister) {
        registerAugmentation(augmentation);
        // Auto-initialize if requested
        if (options.autoInitialize) {
            augmentation.initialize().catch((error) => {
                console.error(`Failed to initialize augmentation ${augmentation.name}:`, error);
            });
        }
    }
    return augmentation;
}
/**
 * Factory for creating memory augmentations
 */
export function createMemoryAugmentation(options) {
    const augmentation = new BaseAugmentation(options);
    // Implement the memory augmentation methods
    augmentation.storeData = async (key, data, opts) => {
        await augmentation.ensureInitialized();
        if (options.storeData) {
            const result = options.storeData(key, data, opts);
            return result instanceof Promise ? await result : result;
        }
        return {
            success: false,
            data: false,
            error: 'storeData not implemented'
        };
    };
    augmentation.retrieveData = async (key, opts) => {
        await augmentation.ensureInitialized();
        if (options.retrieveData) {
            const result = options.retrieveData(key, opts);
            return result instanceof Promise ? await result : result;
        }
        return {
            success: false,
            data: null,
            error: 'retrieveData not implemented'
        };
    };
    augmentation.updateData = async (key, data, opts) => {
        await augmentation.ensureInitialized();
        if (options.updateData) {
            const result = options.updateData(key, data, opts);
            return result instanceof Promise ? await result : result;
        }
        return {
            success: false,
            data: false,
            error: 'updateData not implemented'
        };
    };
    augmentation.deleteData = async (key, opts) => {
        await augmentation.ensureInitialized();
        if (options.deleteData) {
            const result = options.deleteData(key, opts);
            return result instanceof Promise ? await result : result;
        }
        return {
            success: false,
            data: false,
            error: 'deleteData not implemented'
        };
    };
    augmentation.listDataKeys = async (pattern, opts) => {
        await augmentation.ensureInitialized();
        if (options.listDataKeys) {
            const result = options.listDataKeys(pattern, opts);
            return result instanceof Promise ? await result : result;
        }
        return {
            success: false,
            data: [],
            error: 'listDataKeys not implemented'
        };
    };
    augmentation.search = async (query, k, opts) => {
        await augmentation.ensureInitialized();
        if (options.search) {
            const result = options.search(query, k, opts);
            return result instanceof Promise ? await result : result;
        }
        return {
            success: false,
            data: [],
            error: 'search not implemented'
        };
    };
    // Auto-register if requested
    if (options.autoRegister) {
        registerAugmentation(augmentation);
        // Auto-initialize if requested
        if (options.autoInitialize) {
            augmentation.initialize().catch((error) => {
                console.error(`Failed to initialize augmentation ${augmentation.name}:`, error);
            });
        }
    }
    return augmentation;
}
/**
 * Factory for creating WebSocket-enabled augmentations
 * This can be combined with other augmentation factories to create WebSocket-enabled versions
 */
export function addWebSocketSupport(augmentation, options) {
    const wsAugmentation = augmentation;
    // Add WebSocket methods
    wsAugmentation.connectWebSocket = async (url, protocols) => {
        await augmentation.ensureInitialized?.();
        if (options.connectWebSocket) {
            return options.connectWebSocket(url, protocols);
        }
        throw new Error('connectWebSocket not implemented');
    };
    wsAugmentation.sendWebSocketMessage = async (connectionId, data) => {
        await augmentation.ensureInitialized?.();
        if (options.sendWebSocketMessage) {
            return options.sendWebSocketMessage(connectionId, data);
        }
        throw new Error('sendWebSocketMessage not implemented');
    };
    wsAugmentation.onWebSocketMessage = async (connectionId, callback) => {
        await augmentation.ensureInitialized?.();
        if (options.onWebSocketMessage) {
            return options.onWebSocketMessage(connectionId, callback);
        }
        throw new Error('onWebSocketMessage not implemented');
    };
    wsAugmentation.offWebSocketMessage = async (connectionId, callback) => {
        await augmentation.ensureInitialized?.();
        if (options.offWebSocketMessage) {
            return options.offWebSocketMessage(connectionId, callback);
        }
        throw new Error('offWebSocketMessage not implemented');
    };
    wsAugmentation.closeWebSocket = async (connectionId, code, reason) => {
        await augmentation.ensureInitialized?.();
        if (options.closeWebSocket) {
            return options.closeWebSocket(connectionId, code, reason);
        }
        throw new Error('closeWebSocket not implemented');
    };
    return wsAugmentation;
}
/**
 * Simplified function to execute an augmentation method with automatic error handling
 * This provides a more concise way to execute augmentation methods compared to the full pipeline
 */
export async function executeAugmentation(augmentation, method, ...args) {
    try {
        if (!augmentation.enabled) {
            return {
                success: false,
                data: null,
                error: `Augmentation ${augmentation.name} is disabled`
            };
        }
        if (typeof augmentation[method] !== 'function') {
            return {
                success: false,
                data: null,
                error: `Method ${method} not found on augmentation ${augmentation.name}`
            };
        }
        const result = await augmentation[method](...args);
        return result;
    }
    catch (error) {
        console.error(`Error executing ${method} on ${augmentation.name}:`, error);
        return {
            success: false,
            data: null,
            error: error instanceof Error ? error.message : String(error)
        };
    }
}
/**
 * Dynamically load augmentations from a module at runtime
 * This allows for lazy-loading augmentations when needed instead of at build time
 */
export async function loadAugmentationModule(modulePromise, options = {}) {
    try {
        const module = await modulePromise;
        const augmentations = [];
        // Extract augmentations from the module
        for (const key in module) {
            const exported = module[key];
            // Skip non-objects and null
            if (!exported || typeof exported !== 'object') {
                continue;
            }
            // Check if it's an augmentation
            if (typeof exported.name === 'string' &&
                typeof exported.initialize === 'function' &&
                typeof exported.shutDown === 'function' &&
                typeof exported.getStatus === 'function') {
                augmentations.push(exported);
                // Auto-register if requested
                if (options.autoRegister) {
                    registerAugmentation(exported);
                    // Auto-initialize if requested
                    if (options.autoInitialize) {
                        exported.initialize().catch((error) => {
                            console.error(`Failed to initialize augmentation ${exported.name}:`, error);
                        });
                    }
                }
            }
        }
        return augmentations;
    }
    catch (error) {
        console.error('Error loading augmentation module:', error);
        return [];
    }
}
//# sourceMappingURL=augmentationFactory.js.map