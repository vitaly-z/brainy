/**
 * Extended Distributed Configuration Presets
 * Common patterns for distributed and multi-service architectures
 * All strongly typed with enums for compile-time safety
 */
/**
 * Strongly typed enum for preset names
 */
export declare enum PresetName {
    PRODUCTION = "production",
    DEVELOPMENT = "development",
    MINIMAL = "minimal",
    ZERO = "zero",
    WRITER = "writer",
    READER = "reader",
    INGESTION_SERVICE = "ingestion-service",
    SEARCH_API = "search-api",
    ANALYTICS_SERVICE = "analytics-service",
    EDGE_CACHE = "edge-cache",
    BATCH_PROCESSOR = "batch-processor",
    STREAMING_SERVICE = "streaming-service",
    ML_TRAINING = "ml-training",
    SIDECAR = "sidecar"
}
/**
 * Preset categories for organization
 */
export declare enum PresetCategory {
    BASIC = "basic",
    DISTRIBUTED = "distributed",
    SERVICE = "service"
}
/**
 * Model precision options
 */
export declare enum ModelPrecision {
    FP32 = "fp32",
    Q8 = "q8",
    AUTO = "auto",
    FAST = "fast",
    SMALL = "small"
}
/**
 * Storage options
 */
export declare enum StorageOption {
    AUTO = "auto",
    MEMORY = "memory",
    DISK = "disk",
    CLOUD = "cloud"
}
/**
 * Feature set options
 */
export declare enum FeatureSet {
    MINIMAL = "minimal",
    DEFAULT = "default",
    FULL = "full",
    CUSTOM = "custom"
}
/**
 * Distributed role options
 */
export declare enum DistributedRole {
    WRITER = "writer",
    READER = "reader",
    HYBRID = "hybrid"
}
/**
 * Preset configuration interface
 */
export interface PresetConfig {
    storage: StorageOption;
    model: ModelPrecision;
    features: FeatureSet | string[];
    distributed: boolean;
    role?: DistributedRole;
    readOnly?: boolean;
    writeOnly?: boolean;
    allowDirectReads?: boolean;
    lazyLoadInReadOnlyMode?: boolean;
    cache?: {
        hotCacheMaxSize?: number;
        autoTune?: boolean;
        batchSize?: number;
    };
    verbose?: boolean;
    description: string;
    category: PresetCategory;
}
/**
 * Strongly typed preset configurations
 */
export declare const PRESET_CONFIGS: Readonly<Record<PresetName, PresetConfig>>;
/**
 * Type-safe preset getter
 */
export declare function getPreset(name: PresetName): PresetConfig;
/**
 * Check if a string is a valid preset name
 */
export declare function isValidPreset(name: string): name is PresetName;
/**
 * Get presets by category
 */
export declare function getPresetsByCategory(category: PresetCategory): PresetName[];
/**
 * Get all preset names
 */
export declare function getAllPresetNames(): PresetName[];
/**
 * Get preset description
 */
export declare function getPresetDescription(name: PresetName): string;
/**
 * Convert preset config to Brainy config
 */
export declare function presetToBrainyConfig(preset: PresetConfig): any;
