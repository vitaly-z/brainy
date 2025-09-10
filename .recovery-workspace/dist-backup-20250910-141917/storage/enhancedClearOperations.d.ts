/**
 * Enhanced Clear/Delete Operations for Brainy Storage
 * Provides safe, efficient, and production-ready bulk deletion methods
 */
export interface ClearOptions {
    /**
     * Safety confirmation - must match database instance name
     * Prevents accidental deletion of wrong databases
     */
    confirmInstanceName?: string;
    /**
     * Performance optimization settings
     */
    batchSize?: number;
    maxConcurrency?: number;
    /**
     * Safety mechanisms
     */
    dryRun?: boolean;
    createBackup?: boolean;
    /**
     * Progress callback for large operations
     */
    onProgress?: (progress: ClearProgress) => void;
}
export interface ClearProgress {
    stage: 'backup' | 'nouns' | 'verbs' | 'metadata' | 'system' | 'cache' | 'complete';
    totalItems: number;
    processedItems: number;
    errors: number;
    estimatedTimeRemaining?: number;
}
export interface ClearResult {
    success: boolean;
    itemsDeleted: {
        nouns: number;
        verbs: number;
        metadata: number;
        system: number;
    };
    duration: number;
    errors: Error[];
    backupLocation?: string;
}
/**
 * Enhanced FileSystem bulk delete operations
 */
export declare class EnhancedFileSystemClear {
    private rootDir;
    private fs;
    private path;
    constructor(rootDir: string, fs: any, path: any);
    /**
     * Optimized bulk delete for filesystem storage
     * Uses parallel deletion with controlled concurrency
     */
    clear(options?: ClearOptions): Promise<ClearResult>;
    /**
     * High-performance directory clearing with controlled concurrency
     */
    private clearDirectoryOptimized;
    private createBackup;
    private performDryRun;
}
/**
 * Enhanced S3 bulk delete operations
 */
export declare class EnhancedS3Clear {
    private s3Client;
    private bucketName;
    constructor(s3Client: any, bucketName: string);
    /**
     * Optimized bulk delete for S3 storage
     * Uses batch delete operations for maximum efficiency
     */
    clear(options?: ClearOptions): Promise<ClearResult>;
    /**
     * High-performance prefix clearing using S3 batch delete
     */
    private clearPrefixOptimized;
    private getBucketInfo;
    private performDryRun;
}
