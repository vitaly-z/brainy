/**
 * Storage Configuration Auto-Detection
 * Intelligently selects storage based on environment and available services
 */
/**
 * Low-level storage implementation types
 */
export declare enum StorageType {
    MEMORY = "memory",
    FILESYSTEM = "filesystem",
    OPFS = "opfs",
    S3 = "s3",
    GCS = "gcs",
    R2 = "r2"
}
/**
 * High-level storage presets (maps to StorageType)
 */
export declare enum StoragePreset {
    AUTO = "auto",
    MEMORY = "memory",
    DISK = "disk",
    CLOUD = "cloud"
}
export type StorageTypeString = 'memory' | 'filesystem' | 'opfs' | 's3' | 'gcs' | 'r2';
export type StoragePresetString = 'auto' | 'memory' | 'disk' | 'cloud';
export interface StorageConfigResult {
    type: StorageType | StorageTypeString;
    config: any;
    reason: string;
    autoSelected: boolean;
}
/**
 * Auto-detect the best storage configuration
 * @param override - Manual override: specific type or preset
 */
export declare function autoDetectStorage(override?: StorageType | StoragePreset | StorageTypeString | StoragePresetString | any): Promise<StorageConfigResult>;
/**
 * Log storage configuration decision
 */
export declare function logStorageConfig(config: StorageConfigResult, verbose?: boolean): void;
