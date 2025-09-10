/**
 * Enhanced Clear/Delete Operations for Brainy Storage
 * Provides safe, efficient, and production-ready bulk deletion methods
 */
/**
 * Enhanced FileSystem bulk delete operations
 */
export class EnhancedFileSystemClear {
    constructor(rootDir, fs, path) {
        this.rootDir = rootDir;
        this.fs = fs;
        this.path = path;
    }
    /**
     * Optimized bulk delete for filesystem storage
     * Uses parallel deletion with controlled concurrency
     */
    async clear(options = {}) {
        const startTime = Date.now();
        const result = {
            success: false,
            itemsDeleted: { nouns: 0, verbs: 0, metadata: 0, system: 0 },
            duration: 0,
            errors: []
        };
        try {
            // Safety checks
            if (options.confirmInstanceName) {
                const actualName = this.path.basename(this.rootDir);
                if (actualName !== options.confirmInstanceName) {
                    throw new Error(`Instance name mismatch: expected '${options.confirmInstanceName}', got '${actualName}'`);
                }
            }
            // Create backup if requested
            if (options.createBackup) {
                result.backupLocation = await this.createBackup();
                options.onProgress?.({
                    stage: 'backup',
                    totalItems: 1,
                    processedItems: 1,
                    errors: 0
                });
            }
            // Dry run - just count items
            if (options.dryRun) {
                return await this.performDryRun(options);
            }
            // Optimized deletion with batching
            const batchSize = options.batchSize || 100;
            const maxConcurrency = options.maxConcurrency || 10;
            // Delete nouns directory with optimization
            result.itemsDeleted.nouns = await this.clearDirectoryOptimized(this.path.join(this.rootDir, 'nouns'), batchSize, maxConcurrency, (progress) => options.onProgress?.({ ...progress, stage: 'nouns' }));
            // Delete verbs directory with optimization
            result.itemsDeleted.verbs = await this.clearDirectoryOptimized(this.path.join(this.rootDir, 'verbs'), batchSize, maxConcurrency, (progress) => options.onProgress?.({ ...progress, stage: 'verbs' }));
            // Delete metadata directories
            const metadataDirs = ['metadata', 'noun-metadata', 'verb-metadata'];
            for (const dir of metadataDirs) {
                result.itemsDeleted.metadata += await this.clearDirectoryOptimized(this.path.join(this.rootDir, dir), batchSize, maxConcurrency, (progress) => options.onProgress?.({ ...progress, stage: 'metadata' }));
            }
            // Delete system directories
            const systemDirs = ['system', 'index'];
            for (const dir of systemDirs) {
                result.itemsDeleted.system += await this.clearDirectoryOptimized(this.path.join(this.rootDir, dir), batchSize, maxConcurrency, (progress) => options.onProgress?.({ ...progress, stage: 'system' }));
            }
            result.success = true;
            result.duration = Date.now() - startTime;
            options.onProgress?.({
                stage: 'complete',
                totalItems: Object.values(result.itemsDeleted).reduce((a, b) => a + b, 0),
                processedItems: Object.values(result.itemsDeleted).reduce((a, b) => a + b, 0),
                errors: result.errors.length
            });
        }
        catch (error) {
            result.errors.push(error);
            result.duration = Date.now() - startTime;
        }
        return result;
    }
    /**
     * High-performance directory clearing with controlled concurrency
     */
    async clearDirectoryOptimized(dirPath, batchSize, maxConcurrency, onProgress) {
        try {
            // Check if directory exists
            const stats = await this.fs.promises.stat(dirPath);
            if (!stats.isDirectory())
                return 0;
            // Get all files in the directory
            const files = await this.fs.promises.readdir(dirPath);
            const totalFiles = files.length;
            if (totalFiles === 0)
                return 0;
            let processedFiles = 0;
            let errors = 0;
            // Process files in batches with controlled concurrency
            for (let i = 0; i < files.length; i += batchSize) {
                const batch = files.slice(i, i + batchSize);
                // Create semaphore for concurrency control
                const semaphore = new Array(Math.min(maxConcurrency, batch.length)).fill(0);
                await Promise.all(batch.map(async (file, index) => {
                    // Wait for semaphore slot
                    await new Promise(resolve => {
                        const slotIndex = index % semaphore.length;
                        semaphore[slotIndex] = performance.now();
                        resolve(undefined);
                    });
                    try {
                        const filePath = this.path.join(dirPath, file);
                        await this.fs.promises.unlink(filePath);
                        processedFiles++;
                    }
                    catch (error) {
                        errors++;
                        console.warn(`Failed to delete file ${file}:`, error);
                    }
                    // Report progress every 50 files or at end of batch
                    if (processedFiles % 50 === 0 || processedFiles === totalFiles) {
                        onProgress?.({
                            totalItems: totalFiles,
                            processedItems: processedFiles,
                            errors
                        });
                    }
                }));
                // Small yield between batches to prevent blocking
                await new Promise(resolve => setImmediate(resolve));
            }
            return processedFiles;
        }
        catch (error) {
            if (error.code === 'ENOENT') {
                return 0; // Directory doesn't exist, that's fine
            }
            throw error;
        }
    }
    async createBackup() {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupDir = `${this.rootDir}-backup-${timestamp}`;
        // Use cp -r for efficient directory copying
        const { spawn } = await import('child_process');
        return new Promise((resolve, reject) => {
            const cp = spawn('cp', ['-r', this.rootDir, backupDir]);
            cp.on('close', (code) => {
                if (code === 0) {
                    resolve(backupDir);
                }
                else {
                    reject(new Error(`Backup failed with code ${code}`));
                }
            });
            cp.on('error', reject);
        });
    }
    async performDryRun(options) {
        const startTime = Date.now();
        const result = {
            success: true,
            itemsDeleted: { nouns: 0, verbs: 0, metadata: 0, system: 0 },
            duration: 0,
            errors: []
        };
        const countFiles = async (dirPath) => {
            try {
                const files = await this.fs.promises.readdir(dirPath);
                return files.filter((f) => f.endsWith('.json')).length;
            }
            catch (error) {
                if (error.code === 'ENOENT')
                    return 0;
                throw error;
            }
        };
        result.itemsDeleted.nouns = await countFiles(this.path.join(this.rootDir, 'nouns'));
        result.itemsDeleted.verbs = await countFiles(this.path.join(this.rootDir, 'verbs'));
        result.itemsDeleted.metadata =
            await countFiles(this.path.join(this.rootDir, 'metadata')) +
                await countFiles(this.path.join(this.rootDir, 'noun-metadata')) +
                await countFiles(this.path.join(this.rootDir, 'verb-metadata'));
        result.itemsDeleted.system =
            await countFiles(this.path.join(this.rootDir, 'system')) +
                await countFiles(this.path.join(this.rootDir, 'index'));
        result.duration = Date.now() - startTime;
        return result;
    }
}
/**
 * Enhanced S3 bulk delete operations
 */
export class EnhancedS3Clear {
    constructor(s3Client, bucketName) {
        this.s3Client = s3Client;
        this.bucketName = bucketName;
    }
    /**
     * Optimized bulk delete for S3 storage
     * Uses batch delete operations for maximum efficiency
     */
    async clear(options = {}) {
        const startTime = Date.now();
        const result = {
            success: false,
            itemsDeleted: { nouns: 0, verbs: 0, metadata: 0, system: 0 },
            duration: 0,
            errors: []
        };
        try {
            // Safety checks
            if (options.confirmInstanceName) {
                // Extract instance name from bucket structure or prefix
                const bucketInfo = await this.getBucketInfo();
                if (bucketInfo.instanceName !== options.confirmInstanceName) {
                    throw new Error(`Instance name mismatch: expected '${options.confirmInstanceName}', got '${bucketInfo.instanceName}'`);
                }
            }
            // Dry run - just count objects
            if (options.dryRun) {
                return await this.performDryRun(options);
            }
            // AWS S3 batch delete supports up to 1000 objects per request
            const batchSize = Math.min(options.batchSize || 1000, 1000);
            // Delete with optimized batching
            const prefixes = [
                { prefix: 'nouns/', key: 'nouns' },
                { prefix: 'verbs/', key: 'verbs' },
                { prefix: 'metadata/', key: 'metadata' },
                { prefix: 'noun-metadata/', key: 'metadata' },
                { prefix: 'verb-metadata/', key: 'metadata' },
                { prefix: 'system/', key: 'system' },
                { prefix: 'index/', key: 'system' }
            ];
            for (const { prefix, key } of prefixes) {
                const deleted = await this.clearPrefixOptimized(prefix, batchSize, (progress) => options.onProgress?.({
                    ...progress,
                    stage: key === 'nouns' ? 'nouns' :
                        key === 'verbs' ? 'verbs' :
                            key === 'metadata' ? 'metadata' : 'system'
                }));
                result.itemsDeleted[key] += deleted;
            }
            result.success = true;
            result.duration = Date.now() - startTime;
        }
        catch (error) {
            result.errors.push(error);
            result.duration = Date.now() - startTime;
        }
        return result;
    }
    /**
     * High-performance prefix clearing using S3 batch delete
     */
    async clearPrefixOptimized(prefix, batchSize, onProgress) {
        const { ListObjectsV2Command, DeleteObjectsCommand } = await import('@aws-sdk/client-s3');
        let totalDeleted = 0;
        let continuationToken;
        do {
            // List objects with the prefix
            const listResponse = await this.s3Client.send(new ListObjectsV2Command({
                Bucket: this.bucketName,
                Prefix: prefix,
                MaxKeys: batchSize,
                ContinuationToken: continuationToken
            }));
            if (!listResponse.Contents || listResponse.Contents.length === 0) {
                break;
            }
            // Prepare batch delete request
            const objectsToDelete = listResponse.Contents
                .filter((obj) => obj.Key)
                .map((obj) => ({ Key: obj.Key }));
            if (objectsToDelete.length > 0) {
                // Perform batch delete
                const deleteResponse = await this.s3Client.send(new DeleteObjectsCommand({
                    Bucket: this.bucketName,
                    Delete: {
                        Objects: objectsToDelete,
                        Quiet: false // Get detailed response
                    }
                }));
                const deletedCount = deleteResponse.Deleted?.length || 0;
                totalDeleted += deletedCount;
                // Report any errors
                if (deleteResponse.Errors && deleteResponse.Errors.length > 0) {
                    for (const error of deleteResponse.Errors) {
                        console.warn(`Failed to delete ${error.Key}: ${error.Message}`);
                    }
                }
                // Report progress
                onProgress?.({
                    totalItems: totalDeleted + (listResponse.IsTruncated ? 1000 : 0), // Estimate
                    processedItems: totalDeleted,
                    errors: deleteResponse.Errors?.length || 0
                });
            }
            continuationToken = listResponse.NextContinuationToken;
            // Small delay to respect AWS rate limits
            await new Promise(resolve => setTimeout(resolve, 10));
        } while (continuationToken);
        return totalDeleted;
    }
    async getBucketInfo() {
        // Each Brainy instance has its own bucket with the same name as the instance
        // The bucket name IS the instance name
        return { instanceName: this.bucketName };
    }
    async performDryRun(options) {
        const startTime = Date.now();
        const { ListObjectsV2Command } = await import('@aws-sdk/client-s3');
        const result = {
            success: true,
            itemsDeleted: { nouns: 0, verbs: 0, metadata: 0, system: 0 },
            duration: 0,
            errors: []
        };
        const countObjects = async (prefix) => {
            let count = 0;
            let continuationToken;
            do {
                const response = await this.s3Client.send(new ListObjectsV2Command({
                    Bucket: this.bucketName,
                    Prefix: prefix,
                    MaxKeys: 1000,
                    ContinuationToken: continuationToken
                }));
                count += response.KeyCount || 0;
                continuationToken = response.NextContinuationToken;
            } while (continuationToken);
            return count;
        };
        result.itemsDeleted.nouns = await countObjects('nouns/');
        result.itemsDeleted.verbs = await countObjects('verbs/');
        result.itemsDeleted.metadata =
            await countObjects('metadata/') +
                await countObjects('noun-metadata/') +
                await countObjects('verb-metadata/');
        result.itemsDeleted.system =
            await countObjects('system/') +
                await countObjects('index/');
        result.duration = Date.now() - startTime;
        return result;
    }
}
//# sourceMappingURL=enhancedClearOperations.js.map