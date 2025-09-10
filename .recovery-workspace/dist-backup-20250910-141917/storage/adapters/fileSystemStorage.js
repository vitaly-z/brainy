/**
 * File System Storage Adapter
 * File system storage adapter for Node.js environments
 */
import { BaseStorage, NOUNS_DIR, VERBS_DIR, METADATA_DIR, NOUN_METADATA_DIR, VERB_METADATA_DIR, INDEX_DIR, SYSTEM_DIR, STATISTICS_KEY } from '../baseStorage.js';
import { StorageCompatibilityLayer } from '../backwardCompatibility.js';
// Node.js modules - dynamically imported to avoid issues in browser environments
let fs;
let path;
let moduleLoadingPromise = null;
// Try to load Node.js modules
try {
    // Using dynamic imports to avoid issues in browser environments
    const fsPromise = import('fs');
    const pathPromise = import('path');
    moduleLoadingPromise = Promise.all([fsPromise, pathPromise])
        .then(([fsModule, pathModule]) => {
        fs = fsModule;
        path = pathModule.default;
    })
        .catch((error) => {
        console.error('Failed to load Node.js modules:', error);
        throw error;
    });
}
catch (error) {
    console.error('FileSystemStorage: Failed to load Node.js modules. This adapter is not supported in this environment.', error);
}
/**
 * File system storage adapter for Node.js environments
 * Uses the file system to store data in the specified directory structure
 */
export class FileSystemStorage extends BaseStorage {
    /**
     * Initialize the storage adapter
     * @param rootDirectory The root directory for storage
     */
    constructor(rootDirectory) {
        super();
        this.useDualWrite = true; // Write to both locations during migration
        this.activeLocks = new Set();
        this.rootDir = rootDirectory;
        // Defer path operations until init() when path module is guaranteed to be loaded
    }
    /**
     * Initialize the storage adapter
     */
    async init() {
        if (this.isInitialized) {
            return;
        }
        // Wait for module loading to complete
        if (moduleLoadingPromise) {
            try {
                await moduleLoadingPromise;
            }
            catch (error) {
                throw new Error('FileSystemStorage requires a Node.js environment, but `fs` and `path` modules could not be loaded.');
            }
        }
        // Check if Node.js modules are available
        if (!fs || !path) {
            throw new Error('FileSystemStorage requires a Node.js environment, but `fs` and `path` modules could not be loaded.');
        }
        try {
            // Initialize directory paths now that path module is loaded
            this.nounsDir = path.join(this.rootDir, NOUNS_DIR);
            this.verbsDir = path.join(this.rootDir, VERBS_DIR);
            this.metadataDir = path.join(this.rootDir, METADATA_DIR);
            this.nounMetadataDir = path.join(this.rootDir, NOUN_METADATA_DIR);
            this.verbMetadataDir = path.join(this.rootDir, VERB_METADATA_DIR);
            this.indexDir = path.join(this.rootDir, INDEX_DIR); // Legacy
            this.systemDir = path.join(this.rootDir, SYSTEM_DIR); // New
            this.lockDir = path.join(this.rootDir, 'locks');
            // Create the root directory if it doesn't exist
            await this.ensureDirectoryExists(this.rootDir);
            // Create the nouns directory if it doesn't exist
            await this.ensureDirectoryExists(this.nounsDir);
            // Create the verbs directory if it doesn't exist
            await this.ensureDirectoryExists(this.verbsDir);
            // Create the metadata directory if it doesn't exist
            await this.ensureDirectoryExists(this.metadataDir);
            // Create the noun metadata directory if it doesn't exist
            await this.ensureDirectoryExists(this.nounMetadataDir);
            // Create the verb metadata directory if it doesn't exist
            await this.ensureDirectoryExists(this.verbMetadataDir);
            // Create both directories for backward compatibility
            await this.ensureDirectoryExists(this.systemDir);
            // Only create legacy directory if it exists (don't create new legacy dirs)
            if (await this.directoryExists(this.indexDir)) {
                await this.ensureDirectoryExists(this.indexDir);
            }
            // Create the locks directory if it doesn't exist
            await this.ensureDirectoryExists(this.lockDir);
            this.isInitialized = true;
        }
        catch (error) {
            console.error('Error initializing FileSystemStorage:', error);
            throw error;
        }
    }
    /**
     * Check if a directory exists
     */
    async directoryExists(dirPath) {
        try {
            const stats = await fs.promises.stat(dirPath);
            return stats.isDirectory();
        }
        catch (error) {
            return false;
        }
    }
    /**
     * Ensure a directory exists, creating it if necessary
     */
    async ensureDirectoryExists(dirPath) {
        try {
            await fs.promises.mkdir(dirPath, { recursive: true });
        }
        catch (error) {
            // Ignore EEXIST error, which means the directory already exists
            if (error.code !== 'EEXIST') {
                throw error;
            }
        }
    }
    /**
     * Save a node to storage
     */
    async saveNode(node) {
        await this.ensureInitialized();
        // Convert connections Map to a serializable format
        const serializableNode = {
            ...node,
            connections: this.mapToObject(node.connections, (set) => Array.from(set))
        };
        const filePath = path.join(this.nounsDir, `${node.id}.json`);
        await fs.promises.writeFile(filePath, JSON.stringify(serializableNode, null, 2));
    }
    /**
     * Get a node from storage
     */
    async getNode(id) {
        await this.ensureInitialized();
        const filePath = path.join(this.nounsDir, `${id}.json`);
        try {
            const data = await fs.promises.readFile(filePath, 'utf-8');
            const parsedNode = JSON.parse(data);
            // Convert serialized connections back to Map<number, Set<string>>
            const connections = new Map();
            for (const [level, nodeIds] of Object.entries(parsedNode.connections)) {
                connections.set(Number(level), new Set(nodeIds));
            }
            return {
                id: parsedNode.id,
                vector: parsedNode.vector,
                connections,
                level: parsedNode.level || 0
            };
        }
        catch (error) {
            if (error.code !== 'ENOENT') {
                console.error(`Error reading node ${id}:`, error);
            }
            return null;
        }
    }
    /**
     * Get all nodes from storage
     */
    async getAllNodes() {
        await this.ensureInitialized();
        const allNodes = [];
        try {
            const files = await fs.promises.readdir(this.nounsDir);
            for (const file of files) {
                if (file.endsWith('.json')) {
                    const filePath = path.join(this.nounsDir, file);
                    const data = await fs.promises.readFile(filePath, 'utf-8');
                    const parsedNode = JSON.parse(data);
                    // Convert serialized connections back to Map<number, Set<string>>
                    const connections = new Map();
                    for (const [level, nodeIds] of Object.entries(parsedNode.connections)) {
                        connections.set(Number(level), new Set(nodeIds));
                    }
                    allNodes.push({
                        id: parsedNode.id,
                        vector: parsedNode.vector,
                        connections,
                        level: parsedNode.level || 0
                    });
                }
            }
        }
        catch (error) {
            if (error.code !== 'ENOENT') {
                console.error(`Error reading directory ${this.nounsDir}:`, error);
            }
        }
        return allNodes;
    }
    /**
     * Get nodes by noun type
     * @param nounType The noun type to filter by
     * @returns Promise that resolves to an array of nodes of the specified noun type
     */
    async getNodesByNounType(nounType) {
        await this.ensureInitialized();
        const nouns = [];
        try {
            const files = await fs.promises.readdir(this.nounsDir);
            for (const file of files) {
                if (file.endsWith('.json')) {
                    const filePath = path.join(this.nounsDir, file);
                    const data = await fs.promises.readFile(filePath, 'utf-8');
                    const parsedNode = JSON.parse(data);
                    // Filter by noun type using metadata
                    const nodeId = parsedNode.id;
                    const metadata = await this.getMetadata(nodeId);
                    if (metadata && metadata.noun === nounType) {
                        // Convert serialized connections back to Map<number, Set<string>>
                        const connections = new Map();
                        for (const [level, nodeIds] of Object.entries(parsedNode.connections)) {
                            connections.set(Number(level), new Set(nodeIds));
                        }
                        nouns.push({
                            id: parsedNode.id,
                            vector: parsedNode.vector,
                            connections,
                            level: parsedNode.level || 0
                        });
                    }
                }
            }
        }
        catch (error) {
            if (error.code !== 'ENOENT') {
                console.error(`Error reading directory ${this.nounsDir}:`, error);
            }
        }
        return nouns;
    }
    /**
     * Delete a node from storage
     */
    async deleteNode(id) {
        await this.ensureInitialized();
        const filePath = path.join(this.nounsDir, `${id}.json`);
        try {
            await fs.promises.unlink(filePath);
        }
        catch (error) {
            if (error.code !== 'ENOENT') {
                console.error(`Error deleting node file ${filePath}:`, error);
                throw error;
            }
        }
    }
    /**
     * Save an edge to storage
     */
    async saveEdge(edge) {
        await this.ensureInitialized();
        // Convert connections Map to a serializable format
        const serializableEdge = {
            ...edge,
            connections: this.mapToObject(edge.connections, (set) => Array.from(set))
        };
        const filePath = path.join(this.verbsDir, `${edge.id}.json`);
        await fs.promises.writeFile(filePath, JSON.stringify(serializableEdge, null, 2));
    }
    /**
     * Get an edge from storage
     */
    async getEdge(id) {
        await this.ensureInitialized();
        const filePath = path.join(this.verbsDir, `${id}.json`);
        try {
            const data = await fs.promises.readFile(filePath, 'utf-8');
            const parsedEdge = JSON.parse(data);
            // Convert serialized connections back to Map<number, Set<string>>
            const connections = new Map();
            for (const [level, nodeIds] of Object.entries(parsedEdge.connections)) {
                connections.set(Number(level), new Set(nodeIds));
            }
            return {
                id: parsedEdge.id,
                vector: parsedEdge.vector,
                connections
            };
        }
        catch (error) {
            if (error.code !== 'ENOENT') {
                console.error(`Error reading edge ${id}:`, error);
            }
            return null;
        }
    }
    /**
     * Get all edges from storage
     */
    async getAllEdges() {
        await this.ensureInitialized();
        const allEdges = [];
        try {
            const files = await fs.promises.readdir(this.verbsDir);
            for (const file of files) {
                if (file.endsWith('.json')) {
                    const filePath = path.join(this.verbsDir, file);
                    const data = await fs.promises.readFile(filePath, 'utf-8');
                    const parsedEdge = JSON.parse(data);
                    // Convert serialized connections back to Map<number, Set<string>>
                    const connections = new Map();
                    for (const [level, nodeIds] of Object.entries(parsedEdge.connections)) {
                        connections.set(Number(level), new Set(nodeIds));
                    }
                    allEdges.push({
                        id: parsedEdge.id,
                        vector: parsedEdge.vector,
                        connections
                    });
                }
            }
        }
        catch (error) {
            if (error.code !== 'ENOENT') {
                console.error(`Error reading directory ${this.verbsDir}:`, error);
            }
        }
        return allEdges;
    }
    /**
     * Get edges by source
     */
    async getEdgesBySource(sourceId) {
        // This method is deprecated and would require loading metadata for each edge
        // For now, return empty array since this is not efficiently implementable with new storage pattern
        console.warn('getEdgesBySource is deprecated and not efficiently supported in new storage pattern');
        return [];
    }
    /**
     * Get edges by target
     */
    async getEdgesByTarget(targetId) {
        // This method is deprecated and would require loading metadata for each edge
        // For now, return empty array since this is not efficiently implementable with new storage pattern
        console.warn('getEdgesByTarget is deprecated and not efficiently supported in new storage pattern');
        return [];
    }
    /**
     * Get edges by type
     */
    async getEdgesByType(type) {
        // This method is deprecated and would require loading metadata for each edge
        // For now, return empty array since this is not efficiently implementable with new storage pattern
        console.warn('getEdgesByType is deprecated and not efficiently supported in new storage pattern');
        return [];
    }
    /**
     * Delete an edge from storage
     */
    async deleteEdge(id) {
        await this.ensureInitialized();
        const filePath = path.join(this.verbsDir, `${id}.json`);
        try {
            await fs.promises.unlink(filePath);
        }
        catch (error) {
            if (error.code !== 'ENOENT') {
                console.error(`Error deleting edge file ${filePath}:`, error);
                throw error;
            }
        }
    }
    /**
     * Save metadata to storage
     */
    async saveMetadata(id, metadata) {
        await this.ensureInitialized();
        const filePath = path.join(this.metadataDir, `${id}.json`);
        await fs.promises.writeFile(filePath, JSON.stringify(metadata, null, 2));
    }
    /**
     * Get metadata from storage
     */
    async getMetadata(id) {
        await this.ensureInitialized();
        const filePath = path.join(this.metadataDir, `${id}.json`);
        try {
            const data = await fs.promises.readFile(filePath, 'utf-8');
            return JSON.parse(data);
        }
        catch (error) {
            if (error.code !== 'ENOENT') {
                console.error(`Error reading metadata ${id}:`, error);
            }
            return null;
        }
    }
    /**
     * Get multiple metadata objects in batches (CRITICAL: Prevents socket exhaustion)
     * FileSystem implementation uses controlled concurrency to prevent too many file reads
     */
    async getMetadataBatch(ids) {
        await this.ensureInitialized();
        const results = new Map();
        const batchSize = 10; // Process 10 files at a time
        // Process in batches to avoid overwhelming the filesystem
        for (let i = 0; i < ids.length; i += batchSize) {
            const batch = ids.slice(i, i + batchSize);
            const batchPromises = batch.map(async (id) => {
                try {
                    const metadata = await this.getMetadata(id);
                    return { id, metadata };
                }
                catch (error) {
                    console.debug(`Failed to read metadata for ${id}:`, error);
                    return { id, metadata: null };
                }
            });
            const batchResults = await Promise.all(batchPromises);
            for (const { id, metadata } of batchResults) {
                if (metadata !== null) {
                    results.set(id, metadata);
                }
            }
            // Small yield between batches
            await new Promise(resolve => setImmediate(resolve));
        }
        return results;
    }
    /**
     * Save noun metadata to storage
     */
    async saveNounMetadata_internal(id, metadata) {
        await this.ensureInitialized();
        const filePath = path.join(this.nounMetadataDir, `${id}.json`);
        await fs.promises.writeFile(filePath, JSON.stringify(metadata, null, 2));
    }
    /**
     * Get noun metadata from storage
     */
    async getNounMetadata(id) {
        await this.ensureInitialized();
        const filePath = path.join(this.nounMetadataDir, `${id}.json`);
        try {
            const data = await fs.promises.readFile(filePath, 'utf-8');
            return JSON.parse(data);
        }
        catch (error) {
            if (error.code !== 'ENOENT') {
                console.error(`Error reading noun metadata ${id}:`, error);
            }
            return null;
        }
    }
    /**
     * Save verb metadata to storage
     */
    async saveVerbMetadata_internal(id, metadata) {
        await this.ensureInitialized();
        const filePath = path.join(this.verbMetadataDir, `${id}.json`);
        await fs.promises.writeFile(filePath, JSON.stringify(metadata, null, 2));
    }
    /**
     * Get verb metadata from storage
     */
    async getVerbMetadata(id) {
        await this.ensureInitialized();
        const filePath = path.join(this.verbMetadataDir, `${id}.json`);
        try {
            const data = await fs.promises.readFile(filePath, 'utf-8');
            return JSON.parse(data);
        }
        catch (error) {
            if (error.code !== 'ENOENT') {
                console.error(`Error reading verb metadata ${id}:`, error);
            }
            return null;
        }
    }
    /**
     * Get nouns with pagination support
     * @param options Pagination options
     */
    async getNounsWithPagination(options = {}) {
        await this.ensureInitialized();
        const limit = options.limit || 100;
        const cursor = options.cursor;
        try {
            // Get all noun files
            const files = await fs.promises.readdir(this.nounsDir);
            const nounFiles = files.filter((f) => f.endsWith('.json'));
            // Sort for consistent pagination
            nounFiles.sort();
            // Find starting position
            let startIndex = 0;
            if (cursor) {
                startIndex = nounFiles.findIndex((f) => f.replace('.json', '') > cursor);
                if (startIndex === -1)
                    startIndex = nounFiles.length;
            }
            // Get page of files
            const pageFiles = nounFiles.slice(startIndex, startIndex + limit);
            // Load nouns
            const items = [];
            for (const file of pageFiles) {
                try {
                    const data = await fs.promises.readFile(path.join(this.nounsDir, file), 'utf-8');
                    const noun = JSON.parse(data);
                    // Apply filter if provided
                    if (options.filter) {
                        // Simple filter implementation
                        let matches = true;
                        for (const [key, value] of Object.entries(options.filter)) {
                            if (noun.metadata && noun.metadata[key] !== value) {
                                matches = false;
                                break;
                            }
                        }
                        if (!matches)
                            continue;
                    }
                    items.push(noun);
                }
                catch (error) {
                    console.warn(`Failed to read noun file ${file}:`, error);
                }
            }
            const hasMore = startIndex + limit < nounFiles.length;
            const nextCursor = hasMore && pageFiles.length > 0
                ? pageFiles[pageFiles.length - 1].replace('.json', '')
                : undefined;
            return {
                items,
                totalCount: nounFiles.length,
                hasMore,
                nextCursor
            };
        }
        catch (error) {
            console.error('Error getting nouns with pagination:', error);
            return {
                items: [],
                totalCount: 0,
                hasMore: false
            };
        }
    }
    /**
     * Clear all data from storage
     */
    async clear() {
        await this.ensureInitialized();
        // Check if fs module is available
        if (!fs || !fs.promises) {
            console.warn('FileSystemStorage.clear: fs module not available, skipping clear operation');
            return;
        }
        // Helper function to remove all files in a directory
        const removeDirectoryContents = async (dirPath) => {
            try {
                const files = await fs.promises.readdir(dirPath);
                for (const file of files) {
                    const filePath = path.join(dirPath, file);
                    const stats = await fs.promises.stat(filePath);
                    if (stats.isDirectory()) {
                        await removeDirectoryContents(filePath);
                        await fs.promises.rmdir(filePath);
                    }
                    else {
                        await fs.promises.unlink(filePath);
                    }
                }
            }
            catch (error) {
                if (error.code !== 'ENOENT') {
                    console.error(`Error removing directory contents ${dirPath}:`, error);
                    throw error;
                }
            }
        };
        // Remove all files in the nouns directory
        await removeDirectoryContents(this.nounsDir);
        // Remove all files in the verbs directory
        await removeDirectoryContents(this.verbsDir);
        // Remove all files in the metadata directory
        await removeDirectoryContents(this.metadataDir);
        // Remove all files in the noun metadata directory
        await removeDirectoryContents(this.nounMetadataDir);
        // Remove all files in the verb metadata directory
        await removeDirectoryContents(this.verbMetadataDir);
        // Remove all files in both system directories
        await removeDirectoryContents(this.systemDir);
        if (await this.directoryExists(this.indexDir)) {
            await removeDirectoryContents(this.indexDir);
        }
        // Clear the statistics cache
        this.statisticsCache = null;
        this.statisticsModified = false;
    }
    /**
     * Enhanced clear operation with safety mechanisms and performance optimizations
     * Provides progress tracking, backup options, and instance name confirmation
     */
    async clearEnhanced(options = {}) {
        await this.ensureInitialized();
        // Check if fs module is available
        if (!fs || !fs.promises) {
            throw new Error('FileSystemStorage.clearEnhanced: fs module not available');
        }
        const { EnhancedFileSystemClear } = await import('../enhancedClearOperations.js');
        const enhancedClear = new EnhancedFileSystemClear(this.rootDir, fs, path);
        const result = await enhancedClear.clear(options);
        if (result.success) {
            // Clear the statistics cache
            this.statisticsCache = null;
            this.statisticsModified = false;
        }
        return result;
    }
    /**
     * Get information about storage usage and capacity
     */
    async getStorageStatus() {
        await this.ensureInitialized();
        // Check if fs module is available
        if (!fs || !fs.promises) {
            console.warn('FileSystemStorage.getStorageStatus: fs module not available, returning default values');
            return {
                type: 'filesystem',
                used: 0,
                quota: null,
                details: {
                    nounsCount: 0,
                    verbsCount: 0,
                    metadataCount: 0,
                    directorySizes: {
                        nouns: 0,
                        verbs: 0,
                        metadata: 0,
                        index: 0
                    }
                }
            };
        }
        try {
            // Calculate the total size of all files in the storage directories
            let totalSize = 0;
            // Helper function to calculate directory size
            const calculateSize = async (dirPath) => {
                let size = 0;
                try {
                    const files = await fs.promises.readdir(dirPath);
                    for (const file of files) {
                        const filePath = path.join(dirPath, file);
                        const stats = await fs.promises.stat(filePath);
                        if (stats.isDirectory()) {
                            size += await calculateSize(filePath);
                        }
                        else {
                            size += stats.size;
                        }
                    }
                }
                catch (error) {
                    if (error.code !== 'ENOENT') {
                        console.error(`Error calculating size for directory ${dirPath}:`, error);
                    }
                }
                return size;
            };
            // Calculate size for each directory
            const nounsDirSize = await calculateSize(this.nounsDir);
            const verbsDirSize = await calculateSize(this.verbsDir);
            const metadataDirSize = await calculateSize(this.metadataDir);
            const indexDirSize = await calculateSize(this.indexDir);
            totalSize = nounsDirSize + verbsDirSize + metadataDirSize + indexDirSize;
            // Count files in each directory
            const nounsCount = (await fs.promises.readdir(this.nounsDir)).filter((file) => file.endsWith('.json')).length;
            const verbsCount = (await fs.promises.readdir(this.verbsDir)).filter((file) => file.endsWith('.json')).length;
            const metadataCount = (await fs.promises.readdir(this.metadataDir)).filter((file) => file.endsWith('.json')).length;
            // Count nouns by type using metadata
            const nounTypeCounts = {};
            const metadataFiles = await fs.promises.readdir(this.metadataDir);
            for (const file of metadataFiles) {
                if (file.endsWith('.json')) {
                    try {
                        const filePath = path.join(this.metadataDir, file);
                        const data = await fs.promises.readFile(filePath, 'utf-8');
                        const metadata = JSON.parse(data);
                        if (metadata.noun) {
                            nounTypeCounts[metadata.noun] =
                                (nounTypeCounts[metadata.noun] || 0) + 1;
                        }
                    }
                    catch (error) {
                        console.error(`Error reading metadata file ${file}:`, error);
                    }
                }
            }
            return {
                type: 'filesystem',
                used: totalSize,
                quota: null, // File system doesn't provide quota information
                details: {
                    rootDirectory: this.rootDir,
                    nounsCount,
                    verbsCount,
                    metadataCount,
                    nounsDirSize,
                    verbsDirSize,
                    metadataDirSize,
                    indexDirSize,
                    nounTypes: nounTypeCounts
                }
            };
        }
        catch (error) {
            console.error('Failed to get storage status:', error);
            return {
                type: 'filesystem',
                used: 0,
                quota: null,
                details: { error: String(error) }
            };
        }
    }
    /**
     * Implementation of abstract methods from BaseStorage
     */
    /**
     * Save a noun to storage
     */
    async saveNoun_internal(noun) {
        return this.saveNode(noun);
    }
    /**
     * Get a noun from storage
     */
    async getNoun_internal(id) {
        return this.getNode(id);
    }
    /**
     * Get nouns by noun type
     */
    async getNounsByNounType_internal(nounType) {
        return this.getNodesByNounType(nounType);
    }
    /**
     * Delete a noun from storage
     */
    async deleteNoun_internal(id) {
        return this.deleteNode(id);
    }
    /**
     * Save a verb to storage
     */
    async saveVerb_internal(verb) {
        return this.saveEdge(verb);
    }
    /**
     * Get a verb from storage
     */
    async getVerb_internal(id) {
        return this.getEdge(id);
    }
    /**
     * Get verbs by source
     */
    async getVerbsBySource_internal(sourceId) {
        console.log(`[DEBUG] getVerbsBySource_internal called for sourceId: ${sourceId}`);
        // Use the working pagination method with source filter
        const result = await this.getVerbsWithPagination({
            limit: 10000,
            filter: { sourceId: [sourceId] }
        });
        console.log(`[DEBUG] Found ${result.items.length} verbs for source ${sourceId}`);
        return result.items;
    }
    /**
     * Get verbs by target
     */
    async getVerbsByTarget_internal(targetId) {
        console.log(`[DEBUG] getVerbsByTarget_internal called for targetId: ${targetId}`);
        // Use the working pagination method with target filter
        const result = await this.getVerbsWithPagination({
            limit: 10000,
            filter: { targetId: [targetId] }
        });
        console.log(`[DEBUG] Found ${result.items.length} verbs for target ${targetId}`);
        return result.items;
    }
    /**
     * Get verbs by type
     */
    async getVerbsByType_internal(type) {
        console.log(`[DEBUG] getVerbsByType_internal called for type: ${type}`);
        // Use the working pagination method with type filter
        const result = await this.getVerbsWithPagination({
            limit: 10000,
            filter: { verbType: [type] }
        });
        console.log(`[DEBUG] Found ${result.items.length} verbs for type ${type}`);
        return result.items;
    }
    /**
     * Get verbs with pagination
     * This method reads verb files from the filesystem and returns them with pagination
     */
    async getVerbsWithPagination(options = {}) {
        await this.ensureInitialized();
        const limit = options.limit || 100;
        const startIndex = options.cursor ? parseInt(options.cursor, 10) : 0;
        try {
            // List all verb files in the verbs directory
            // Note: For very large directories (millions of files), this could be memory-intensive
            // Future optimization: Use fs.opendir() for streaming directory reads
            const files = await fs.promises.readdir(this.verbsDir);
            const verbFiles = files.filter((f) => f.endsWith('.json'));
            // Sort files for consistent ordering
            verbFiles.sort();
            // Calculate pagination
            const totalCount = verbFiles.length;
            const endIndex = Math.min(startIndex + limit, totalCount);
            const hasMore = endIndex < totalCount;
            // Safety check for large datasets
            if (totalCount > 100000) {
                console.warn(`Large verb dataset detected (${totalCount} verbs). Consider using a database for better performance.`);
            }
            // Load the requested page of verbs
            const verbs = [];
            for (let i = startIndex; i < endIndex; i++) {
                const file = verbFiles[i];
                const id = file.replace('.json', '');
                try {
                    // Read the verb data (HNSWVerb stored as edge)
                    const filePath = path.join(this.verbsDir, file);
                    const data = await fs.promises.readFile(filePath, 'utf-8');
                    const edge = JSON.parse(data);
                    // Get metadata which contains the actual verb information
                    const metadata = await this.getVerbMetadata(id);
                    // If no metadata exists, try to reconstruct basic metadata from filename
                    if (!metadata) {
                        console.warn(`Verb ${id} has no metadata, trying to create minimal verb`);
                        // Create minimal GraphVerb without full metadata
                        const minimalVerb = {
                            id: edge.id,
                            vector: edge.vector,
                            connections: edge.connections || new Map(),
                            sourceId: 'unknown',
                            targetId: 'unknown',
                            source: 'unknown',
                            target: 'unknown',
                            type: 'relationship',
                            verb: 'relatedTo'
                        };
                        verbs.push(minimalVerb);
                        continue;
                    }
                    // Convert connections Map to proper format if needed
                    let connections = edge.connections;
                    if (connections && typeof connections === 'object' && !(connections instanceof Map)) {
                        const connectionsMap = new Map();
                        for (const [level, nodeIds] of Object.entries(connections)) {
                            connectionsMap.set(Number(level), new Set(nodeIds));
                        }
                        connections = connectionsMap;
                    }
                    // Properly reconstruct GraphVerb from HNSWVerb + metadata
                    const verb = {
                        id: edge.id,
                        vector: edge.vector, // Include the vector field!
                        connections: connections,
                        sourceId: metadata.sourceId || metadata.source,
                        targetId: metadata.targetId || metadata.target,
                        source: metadata.source || metadata.sourceId,
                        target: metadata.target || metadata.targetId,
                        verb: metadata.verb || metadata.type,
                        type: metadata.type || metadata.verb,
                        weight: metadata.weight,
                        metadata: metadata.metadata || metadata,
                        data: metadata.data,
                        createdAt: metadata.createdAt,
                        updatedAt: metadata.updatedAt,
                        createdBy: metadata.createdBy,
                        embedding: metadata.embedding || edge.vector
                    };
                    // Apply filters if provided
                    if (options.filter) {
                        const filter = options.filter;
                        // Check verbType filter
                        if (filter.verbType) {
                            const types = Array.isArray(filter.verbType) ? filter.verbType : [filter.verbType];
                            const verbType = verb.type || verb.verb;
                            if (verbType && !types.includes(verbType))
                                continue;
                        }
                        // Check sourceId filter
                        if (filter.sourceId) {
                            const sources = Array.isArray(filter.sourceId) ? filter.sourceId : [filter.sourceId];
                            const sourceId = verb.sourceId || verb.source;
                            if (!sourceId || !sources.includes(sourceId))
                                continue;
                        }
                        // Check targetId filter
                        if (filter.targetId) {
                            const targets = Array.isArray(filter.targetId) ? filter.targetId : [filter.targetId];
                            const targetId = verb.targetId || verb.target;
                            if (!targetId || !targets.includes(targetId))
                                continue;
                        }
                        // Check service filter
                        if (filter.service && metadata?.service) {
                            const services = Array.isArray(filter.service) ? filter.service : [filter.service];
                            if (!services.includes(metadata.service))
                                continue;
                        }
                    }
                    verbs.push(verb);
                }
                catch (error) {
                    console.warn(`Failed to read verb ${id}:`, error);
                }
            }
            return {
                items: verbs,
                totalCount,
                hasMore,
                nextCursor: hasMore ? String(endIndex) : undefined
            };
        }
        catch (error) {
            if (error.code === 'ENOENT') {
                // Verbs directory doesn't exist yet
                return {
                    items: [],
                    totalCount: 0,
                    hasMore: false
                };
            }
            throw error;
        }
    }
    /**
     * Delete a verb from storage
     */
    async deleteVerb_internal(id) {
        return this.deleteEdge(id);
    }
    /**
     * Acquire a file-based lock for coordinating operations across multiple processes
     * @param lockKey The key to lock on
     * @param ttl Time to live for the lock in milliseconds (default: 30 seconds)
     * @returns Promise that resolves to true if lock was acquired, false otherwise
     */
    async acquireLock(lockKey, ttl = 30000) {
        await this.ensureInitialized();
        // Ensure lock directory exists
        await this.ensureDirectoryExists(this.lockDir);
        const lockFile = path.join(this.lockDir, `${lockKey}.lock`);
        const lockValue = `${Date.now()}_${Math.random()}_${process.pid || 'unknown'}`;
        const expiresAt = Date.now() + ttl;
        try {
            // Check if lock file already exists and is still valid
            try {
                const lockData = await fs.promises.readFile(lockFile, 'utf-8');
                const lockInfo = JSON.parse(lockData);
                if (lockInfo.expiresAt > Date.now()) {
                    // Lock exists and is still valid
                    return false;
                }
            }
            catch (error) {
                // If file doesn't exist or can't be read, we can proceed to create the lock
                if (error.code !== 'ENOENT') {
                    console.warn(`Error reading lock file ${lockFile}:`, error);
                }
            }
            // Try to create the lock file
            const lockInfo = {
                lockValue,
                expiresAt,
                pid: process.pid || 'unknown',
                timestamp: Date.now()
            };
            await fs.promises.writeFile(lockFile, JSON.stringify(lockInfo, null, 2));
            // Add to active locks for cleanup
            this.activeLocks.add(lockKey);
            // Schedule automatic cleanup when lock expires
            setTimeout(() => {
                this.releaseLock(lockKey, lockValue).catch((error) => {
                    console.warn(`Failed to auto-release expired lock ${lockKey}:`, error);
                });
            }, ttl);
            return true;
        }
        catch (error) {
            console.warn(`Failed to acquire lock ${lockKey}:`, error);
            return false;
        }
    }
    /**
     * Release a file-based lock
     * @param lockKey The key to unlock
     * @param lockValue The value used when acquiring the lock (for verification)
     * @returns Promise that resolves when lock is released
     */
    async releaseLock(lockKey, lockValue) {
        await this.ensureInitialized();
        const lockFile = path.join(this.lockDir, `${lockKey}.lock`);
        try {
            // If lockValue is provided, verify it matches before releasing
            if (lockValue) {
                try {
                    const lockData = await fs.promises.readFile(lockFile, 'utf-8');
                    const lockInfo = JSON.parse(lockData);
                    if (lockInfo.lockValue !== lockValue) {
                        // Lock was acquired by someone else, don't release it
                        return;
                    }
                }
                catch (error) {
                    // If lock file doesn't exist, that's fine
                    if (error.code === 'ENOENT') {
                        return;
                    }
                    throw error;
                }
            }
            // Delete the lock file
            await fs.promises.unlink(lockFile);
            // Remove from active locks
            this.activeLocks.delete(lockKey);
        }
        catch (error) {
            if (error.code !== 'ENOENT') {
                console.warn(`Failed to release lock ${lockKey}:`, error);
            }
        }
    }
    /**
     * Clean up expired lock files
     */
    async cleanupExpiredLocks() {
        await this.ensureInitialized();
        try {
            const lockFiles = await fs.promises.readdir(this.lockDir);
            const now = Date.now();
            for (const lockFile of lockFiles) {
                if (!lockFile.endsWith('.lock'))
                    continue;
                const lockPath = path.join(this.lockDir, lockFile);
                try {
                    const lockData = await fs.promises.readFile(lockPath, 'utf-8');
                    const lockInfo = JSON.parse(lockData);
                    if (lockInfo.expiresAt <= now) {
                        await fs.promises.unlink(lockPath);
                        const lockKey = lockFile.replace('.lock', '');
                        this.activeLocks.delete(lockKey);
                    }
                }
                catch (error) {
                    // If we can't read or parse the lock file, remove it
                    try {
                        await fs.promises.unlink(lockPath);
                    }
                    catch (unlinkError) {
                        console.warn(`Failed to cleanup invalid lock file ${lockPath}:`, unlinkError);
                    }
                }
            }
        }
        catch (error) {
            console.warn('Failed to cleanup expired locks:', error);
        }
    }
    /**
     * Save statistics data to storage with file-based locking
     */
    async saveStatisticsData(statistics) {
        const lockKey = 'statistics';
        const lockAcquired = await this.acquireLock(lockKey, 10000); // 10 second timeout
        if (!lockAcquired) {
            console.warn('Failed to acquire lock for statistics update, proceeding without lock');
        }
        try {
            // Get existing statistics to merge with new data
            const existingStats = await this.getStatisticsWithBackwardCompat();
            if (existingStats) {
                // Merge statistics data
                const mergedStats = {
                    totalNodes: Math.max(statistics.totalNodes || 0, existingStats.totalNodes || 0),
                    totalEdges: Math.max(statistics.totalEdges || 0, existingStats.totalEdges || 0),
                    totalMetadata: Math.max(statistics.totalMetadata || 0, existingStats.totalMetadata || 0),
                    // Preserve any additional fields from existing stats
                    ...existingStats,
                    // Override with new values where provided
                    ...statistics,
                    // Always update lastUpdated to current time
                    lastUpdated: new Date().toISOString()
                };
                await this.saveStatisticsWithBackwardCompat(mergedStats);
            }
            else {
                // No existing statistics, save new ones
                const newStats = {
                    ...statistics,
                    lastUpdated: new Date().toISOString()
                };
                await this.saveStatisticsWithBackwardCompat(newStats);
            }
        }
        finally {
            if (lockAcquired) {
                await this.releaseLock(lockKey);
            }
        }
    }
    /**
     * Get statistics data from storage
     */
    async getStatisticsData() {
        return this.getStatisticsWithBackwardCompat();
    }
    /**
     * Save statistics with backward compatibility (dual write)
     */
    async saveStatisticsWithBackwardCompat(statistics) {
        // Always write to new location
        const newPath = path.join(this.systemDir, `${STATISTICS_KEY}.json`);
        await this.ensureDirectoryExists(this.systemDir);
        await fs.promises.writeFile(newPath, JSON.stringify(statistics, null, 2));
        // During migration period, also write to old location if it exists
        if (this.useDualWrite && await this.directoryExists(this.indexDir)) {
            const oldPath = path.join(this.indexDir, `${STATISTICS_KEY}.json`);
            try {
                await fs.promises.writeFile(oldPath, JSON.stringify(statistics, null, 2));
            }
            catch (error) {
                // Log but don't fail if old location write fails
                StorageCompatibilityLayer.logMigrationEvent('Failed to write to legacy location', { path: oldPath, error });
            }
        }
    }
    /**
     * Get statistics with backward compatibility (dual read)
     */
    async getStatisticsWithBackwardCompat() {
        let newStats = null;
        let oldStats = null;
        // Try to read from new location first
        try {
            const newPath = path.join(this.systemDir, `${STATISTICS_KEY}.json`);
            const data = await fs.promises.readFile(newPath, 'utf-8');
            newStats = JSON.parse(data);
        }
        catch (error) {
            if (error.code !== 'ENOENT') {
                console.error('Error reading statistics from new location:', error);
            }
        }
        // Try to read from old location as fallback
        if (!newStats && await this.directoryExists(this.indexDir)) {
            try {
                const oldPath = path.join(this.indexDir, `${STATISTICS_KEY}.json`);
                const data = await fs.promises.readFile(oldPath, 'utf-8');
                oldStats = JSON.parse(data);
                // If we found data in old location but not new, migrate it
                if (oldStats && !newStats) {
                    StorageCompatibilityLayer.logMigrationEvent('Migrating statistics from legacy location');
                    await this.saveStatisticsWithBackwardCompat(oldStats);
                }
            }
            catch (error) {
                if (error.code !== 'ENOENT') {
                    console.error('Error reading statistics from old location:', error);
                }
            }
        }
        // Merge statistics from both locations
        return this.mergeStatistics(newStats, oldStats);
    }
    /**
     * Merge statistics from multiple sources
     */
    mergeStatistics(storageStats, localStats) {
        // Handle null cases
        if (!storageStats && !localStats) {
            return {
                nounCount: {},
                verbCount: {},
                metadataCount: {},
                hnswIndexSize: 0,
                totalNodes: 0,
                totalEdges: 0,
                lastUpdated: new Date().toISOString()
            };
        }
        if (!storageStats)
            return localStats;
        if (!localStats)
            return storageStats;
        // Merge noun counts by taking the maximum of each type
        const mergedNounCount = {
            ...storageStats.nounCount
        };
        for (const [type, count] of Object.entries(localStats.nounCount)) {
            mergedNounCount[type] = Math.max(mergedNounCount[type] || 0, count);
        }
        // Merge verb counts by taking the maximum of each type
        const mergedVerbCount = {
            ...storageStats.verbCount
        };
        for (const [type, count] of Object.entries(localStats.verbCount)) {
            mergedVerbCount[type] = Math.max(mergedVerbCount[type] || 0, count);
        }
        // Merge metadata counts by taking the maximum of each type
        const mergedMetadataCount = {
            ...storageStats.metadataCount
        };
        for (const [type, count] of Object.entries(localStats.metadataCount)) {
            mergedMetadataCount[type] = Math.max(mergedMetadataCount[type] || 0, count);
        }
        return {
            nounCount: mergedNounCount,
            verbCount: mergedVerbCount,
            metadataCount: mergedMetadataCount,
            hnswIndexSize: Math.max(storageStats.hnswIndexSize || 0, localStats.hnswIndexSize || 0),
            totalNodes: Math.max(storageStats.totalNodes || 0, localStats.totalNodes || 0),
            totalEdges: Math.max(storageStats.totalEdges || 0, localStats.totalEdges || 0),
            totalMetadata: Math.max(storageStats.totalMetadata || 0, localStats.totalMetadata || 0),
            operations: storageStats.operations || localStats.operations,
            lastUpdated: new Date().toISOString()
        };
    }
}
//# sourceMappingURL=fileSystemStorage.js.map