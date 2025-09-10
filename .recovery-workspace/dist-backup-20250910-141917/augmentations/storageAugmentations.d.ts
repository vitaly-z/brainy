/**
 * Storage Augmentations - Concrete Implementations
 *
 * These augmentations provide different storage backends for Brainy.
 * Each wraps an existing storage adapter for backward compatibility.
 */
import { StorageAugmentation } from './storageAugmentation.js';
import { StorageAdapter } from '../coreTypes.js';
import { AugmentationManifest } from './manifest.js';
/**
 * Memory Storage Augmentation - Fast in-memory storage
 */
export declare class MemoryStorageAugmentation extends StorageAugmentation {
    readonly name = "memory-storage";
    readonly category: "core";
    readonly description = "High-performance in-memory storage for development and testing";
    constructor(config?: any);
    getManifest(): AugmentationManifest;
    provideStorage(): Promise<StorageAdapter>;
    protected onInitialize(): Promise<void>;
}
/**
 * FileSystem Storage Augmentation - Node.js persistent storage
 */
export declare class FileSystemStorageAugmentation extends StorageAugmentation {
    readonly name = "filesystem-storage";
    readonly category: "core";
    readonly description = "Persistent file-based storage for Node.js environments";
    constructor(config?: any);
    getManifest(): AugmentationManifest;
    provideStorage(): Promise<StorageAdapter>;
    protected onInitialize(): Promise<void>;
}
/**
 * OPFS Storage Augmentation - Browser persistent storage
 */
export declare class OPFSStorageAugmentation extends StorageAugmentation {
    readonly name = "opfs-storage";
    readonly category: "core";
    readonly description = "Persistent browser storage using Origin Private File System";
    constructor(config?: any);
    getManifest(): AugmentationManifest;
    provideStorage(): Promise<StorageAdapter>;
    protected onInitialize(): Promise<void>;
}
/**
 * S3 Storage Augmentation - Amazon S3 cloud storage
 */
export declare class S3StorageAugmentation extends StorageAugmentation {
    readonly name = "s3-storage";
    protected config: {
        bucketName: string;
        region?: string;
        accessKeyId: string;
        secretAccessKey: string;
        sessionToken?: string;
        cacheConfig?: any;
        operationConfig?: any;
    };
    constructor(config: {
        bucketName: string;
        region?: string;
        accessKeyId: string;
        secretAccessKey: string;
        sessionToken?: string;
        cacheConfig?: any;
        operationConfig?: any;
    });
    provideStorage(): Promise<StorageAdapter>;
    protected onInitialize(): Promise<void>;
}
/**
 * R2 Storage Augmentation - Cloudflare R2 storage
 */
export declare class R2StorageAugmentation extends StorageAugmentation {
    readonly name = "r2-storage";
    protected config: {
        bucketName: string;
        accountId: string;
        accessKeyId: string;
        secretAccessKey: string;
        cacheConfig?: any;
    };
    constructor(config: {
        bucketName: string;
        accountId: string;
        accessKeyId: string;
        secretAccessKey: string;
        cacheConfig?: any;
    });
    provideStorage(): Promise<StorageAdapter>;
    protected onInitialize(): Promise<void>;
}
/**
 * GCS Storage Augmentation - Google Cloud Storage
 */
export declare class GCSStorageAugmentation extends StorageAugmentation {
    readonly name = "gcs-storage";
    protected config: {
        bucketName: string;
        region?: string;
        accessKeyId: string;
        secretAccessKey: string;
        endpoint?: string;
        cacheConfig?: any;
    };
    constructor(config: {
        bucketName: string;
        region?: string;
        accessKeyId: string;
        secretAccessKey: string;
        endpoint?: string;
        cacheConfig?: any;
    });
    provideStorage(): Promise<StorageAdapter>;
    protected onInitialize(): Promise<void>;
}
/**
 * Auto-select the best storage augmentation for the environment
 * Maintains zero-config philosophy
 */
export declare function createAutoStorageAugmentation(options?: {
    rootDirectory?: string;
    requestPersistentStorage?: boolean;
}): Promise<StorageAugmentation>;
