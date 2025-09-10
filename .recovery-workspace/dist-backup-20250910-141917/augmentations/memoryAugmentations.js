import { AugmentationType } from '../types/augmentations.js';
import { MemoryStorage, OPFSStorage } from '../storage/storageFactory.js';
// FileSystemStorage will be dynamically imported when needed to avoid fs imports in browser
import { cosineDistance } from '../utils/distance.js';
/**
 * Base class for memory augmentations that wrap a StorageAdapter
 */
class BaseMemoryAugmentation {
    constructor(name, storage) {
        this.description = 'Base memory augmentation';
        this.enabled = true;
        this.isInitialized = false;
        this.name = name;
        this.storage = storage;
    }
    async initialize() {
        if (this.isInitialized) {
            return;
        }
        try {
            await this.storage.init();
            this.isInitialized = true;
        }
        catch (error) {
            console.error(`Failed to initialize ${this.name}:`, error);
            throw new Error(`Failed to initialize ${this.name}: ${error}`);
        }
    }
    async shutDown() {
        this.isInitialized = false;
    }
    async getStatus() {
        return this.isInitialized ? 'active' : 'inactive';
    }
    async storeData(key, data, options) {
        await this.ensureInitialized();
        try {
            await this.storage.saveMetadata(key, data);
            return { success: true, data: true };
        }
        catch (error) {
            console.error(`Failed to store data for key ${key}:`, error);
            return {
                success: false,
                data: false,
                error: `Failed to store data: ${error}`
            };
        }
    }
    async retrieveData(key, options) {
        await this.ensureInitialized();
        try {
            const data = await this.storage.getMetadata(key);
            return {
                success: true,
                data
            };
        }
        catch (error) {
            console.error(`Failed to retrieve data for key ${key}:`, error);
            return {
                success: false,
                data: null,
                error: `Failed to retrieve data: ${error}`
            };
        }
    }
    async updateData(key, data, options) {
        await this.ensureInitialized();
        try {
            await this.storage.saveMetadata(key, data);
            return { success: true, data: true };
        }
        catch (error) {
            console.error(`Failed to update data for key ${key}:`, error);
            return {
                success: false,
                data: false,
                error: `Failed to update data: ${error}`
            };
        }
    }
    async deleteData(key, options) {
        await this.ensureInitialized();
        try {
            // There's no direct deleteMetadata method, so we save null
            await this.storage.saveMetadata(key, null);
            return { success: true, data: true };
        }
        catch (error) {
            console.error(`Failed to delete data for key ${key}:`, error);
            return {
                success: false,
                data: false,
                error: `Failed to delete data: ${error}`
            };
        }
    }
    async listDataKeys(pattern, options) {
        // This is a limitation of the current StorageAdapter interface
        // It doesn't provide a way to list all metadata keys
        // We could implement this in the future by extending the StorageAdapter interface
        return {
            success: false,
            data: [],
            error: 'listDataKeys is not supported by this storage adapter'
        };
    }
    /**
     * Searches for data in the storage using vector similarity.
     * Implements the findNearest functionality by calculating distances client-side.
     * @param query The query vector or data to search for
     * @param k Number of results to return (default: 10)
     * @param options Optional search options
     */
    async search(query, k = 10, options) {
        await this.ensureInitialized();
        try {
            // Check if query is a vector
            let queryVector;
            if (Array.isArray(query) && query.every(item => typeof item === 'number')) {
                queryVector = query;
            }
            else {
                // If query is not a vector, we can't perform vector search
                return {
                    success: false,
                    data: [],
                    error: 'Query must be a vector (array of numbers) for vector search'
                };
            }
            // Process nodes in batches to avoid loading everything into memory
            const allResults = [];
            let hasMore = true;
            let cursor;
            while (hasMore) {
                // Get a batch of nodes
                const batchResult = await this.storage.getNouns({
                    pagination: { limit: 100, cursor }
                });
                // Process this batch
                for (const noun of batchResult.items) {
                    // Skip nodes that don't have a vector
                    if (!noun.vector || !Array.isArray(noun.vector)) {
                        continue;
                    }
                    // Get metadata for the node
                    const metadata = await this.storage.getMetadata(noun.id);
                    // Calculate distance between query vector and node vector
                    const distance = cosineDistance(queryVector, noun.vector);
                    // Convert distance to similarity score (1 - distance for cosine)
                    // This way higher scores are better (more similar)
                    const score = 1 - distance;
                    allResults.push({
                        id: noun.id,
                        score,
                        data: metadata
                    });
                }
                // Update pagination state
                hasMore = batchResult.hasMore;
                cursor = batchResult.nextCursor;
            }
            // Sort results by score (descending) and take top k
            allResults.sort((a, b) => b.score - a.score);
            const topResults = allResults.slice(0, k);
            return {
                success: true,
                data: topResults
            };
        }
        catch (error) {
            console.error(`Failed to search in storage:`, error);
            return {
                success: false,
                data: [],
                error: `Failed to search in storage: ${error}`
            };
        }
    }
    async ensureInitialized() {
        if (!this.isInitialized) {
            await this.initialize();
        }
    }
}
/**
 * Memory augmentation that uses in-memory storage
 */
export class MemoryStorageAugmentation extends BaseMemoryAugmentation {
    constructor(name) {
        super(name, new MemoryStorage());
        this.description = 'Memory augmentation that stores data in memory';
        this.enabled = true;
    }
    getType() {
        return AugmentationType.MEMORY;
    }
}
/**
 * Memory augmentation that uses file system storage
 */
export class FileSystemStorageAugmentation extends BaseMemoryAugmentation {
    constructor(name, rootDirectory) {
        // Temporarily use MemoryStorage, will be replaced in initialize()
        super(name, new MemoryStorage());
        this.description = 'Memory augmentation that stores data in the file system';
        this.enabled = true;
        this.rootDirectory = rootDirectory || '.';
    }
    async initialize() {
        try {
            // Dynamically import FileSystemStorage
            const { FileSystemStorage } = await import('../storage/adapters/fileSystemStorage.js');
            this.storage = new FileSystemStorage(this.rootDirectory);
            await super.initialize();
        }
        catch (error) {
            console.error('Failed to load FileSystemStorage:', error);
            throw new Error(`Failed to initialize FileSystemStorage: ${error}`);
        }
    }
    getType() {
        return AugmentationType.MEMORY;
    }
}
/**
 * Memory augmentation that uses OPFS (Origin Private File System) storage
 */
export class OPFSStorageAugmentation extends BaseMemoryAugmentation {
    constructor(name) {
        super(name, new OPFSStorage());
        this.description = 'Memory augmentation that stores data in the Origin Private File System';
        this.enabled = true;
    }
    getType() {
        return AugmentationType.MEMORY;
    }
}
/**
 * Factory function to create the appropriate memory augmentation based on the environment
 */
export async function createMemoryAugmentation(name, options = {}) {
    // If a specific storage type is requested, use that
    if (options.storageType) {
        switch (options.storageType) {
            case 'memory':
                return new MemoryStorageAugmentation(name);
            case 'filesystem':
                return new FileSystemStorageAugmentation(name, options.rootDirectory);
            case 'opfs':
                return new OPFSStorageAugmentation(name);
        }
    }
    // Otherwise, select based on environment
    // Use the global isNode variable from the environment detection
    const isNodeEnv = globalThis.__ENV__?.isNode || (typeof process !== 'undefined' &&
        process.versions != null &&
        process.versions.node != null);
    if (isNodeEnv) {
        // In Node.js, use FileSystemStorage
        return new FileSystemStorageAugmentation(name, options.rootDirectory);
    }
    else {
        // In browser, try OPFS first
        const opfsStorage = new OPFSStorage();
        if (opfsStorage.isOPFSAvailable()) {
            // Request persistent storage if specified
            if (options.requestPersistentStorage) {
                await opfsStorage.requestPersistentStorage();
            }
            return new OPFSStorageAugmentation(name);
        }
        else {
            // Fall back to memory storage
            return new MemoryStorageAugmentation(name);
        }
    }
}
//# sourceMappingURL=memoryAugmentations.js.map