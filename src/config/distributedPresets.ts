/**
 * Extended Distributed Configuration Presets
 * Common patterns for distributed and multi-service architectures
 * All strongly typed with enums for compile-time safety
 */

/**
 * Strongly typed enum for preset names
 */
export enum PresetName {
  // Basic presets
  PRODUCTION = 'production',
  DEVELOPMENT = 'development',
  MINIMAL = 'minimal',
  ZERO = 'zero',
  
  // Distributed presets
  WRITER = 'writer',
  READER = 'reader',
  
  // Service-specific presets
  INGESTION_SERVICE = 'ingestion-service',
  SEARCH_API = 'search-api',
  ANALYTICS_SERVICE = 'analytics-service',
  EDGE_CACHE = 'edge-cache',
  BATCH_PROCESSOR = 'batch-processor',
  STREAMING_SERVICE = 'streaming-service',
  ML_TRAINING = 'ml-training',
  SIDECAR = 'sidecar'
}

/**
 * Preset categories for organization
 */
export enum PresetCategory {
  BASIC = 'basic',
  DISTRIBUTED = 'distributed',
  SERVICE = 'service'
}

/**
 * Model precision options
 */
export enum ModelPrecision {
  FP32 = 'fp32',
  Q8 = 'q8',
  AUTO = 'auto',
  FAST = 'fast',
  SMALL = 'small'
}

/**
 * Storage options
 */
export enum StorageOption {
  AUTO = 'auto',
  MEMORY = 'memory',
  DISK = 'disk',
  CLOUD = 'cloud'
}

/**
 * Feature set options
 */
export enum FeatureSet {
  MINIMAL = 'minimal',
  DEFAULT = 'default',
  FULL = 'full',
  CUSTOM = 'custom'  // For custom feature arrays
}

/**
 * Distributed role options
 */
export enum DistributedRole {
  WRITER = 'writer',
  READER = 'reader',
  HYBRID = 'hybrid'
}

/**
 * Preset configuration interface
 */
export interface PresetConfig {
  storage: StorageOption
  model: ModelPrecision
  features: FeatureSet | string[]
  distributed: boolean
  role?: DistributedRole
  readOnly?: boolean
  writeOnly?: boolean
  allowDirectReads?: boolean
  lazyLoadInReadOnlyMode?: boolean
  cache?: {
    hotCacheMaxSize?: number
    autoTune?: boolean
    batchSize?: number
  }
  verbose?: boolean
  description: string
  category: PresetCategory
}

/**
 * Strongly typed preset configurations
 */
export const PRESET_CONFIGS: Readonly<Record<PresetName, PresetConfig>> = {
  // Basic presets
  [PresetName.PRODUCTION]: {
    storage: StorageOption.DISK,
    model: ModelPrecision.AUTO,
    features: FeatureSet.DEFAULT,
    distributed: false,
    verbose: false,
    description: 'Optimized for production use',
    category: PresetCategory.BASIC
  },
  
  [PresetName.DEVELOPMENT]: {
    storage: StorageOption.MEMORY,
    model: ModelPrecision.FP32,
    features: FeatureSet.FULL,
    distributed: false,
    verbose: true,
    description: 'Optimized for development with verbose logging',
    category: PresetCategory.BASIC
  },
  
  [PresetName.MINIMAL]: {
    storage: StorageOption.MEMORY,
    model: ModelPrecision.Q8,
    features: FeatureSet.MINIMAL,
    distributed: false,
    verbose: false,
    description: 'Minimal footprint configuration',
    category: PresetCategory.BASIC
  },
  
  [PresetName.ZERO]: {
    storage: StorageOption.AUTO,
    model: ModelPrecision.AUTO,
    features: FeatureSet.DEFAULT,
    distributed: false,
    verbose: false,
    description: 'True zero configuration with auto-detection',
    category: PresetCategory.BASIC
  },
  
  // Distributed basic presets
  [PresetName.WRITER]: {
    storage: StorageOption.AUTO,
    model: ModelPrecision.AUTO,
    features: FeatureSet.MINIMAL,
    distributed: true,
    role: DistributedRole.WRITER,
    writeOnly: true,
    allowDirectReads: true,
    verbose: false,
    description: 'Write-only instance for distributed setups',
    category: PresetCategory.DISTRIBUTED
  },
  
  [PresetName.READER]: {
    storage: StorageOption.AUTO,
    model: ModelPrecision.AUTO,
    features: FeatureSet.DEFAULT,
    distributed: true,
    role: DistributedRole.READER,
    readOnly: true,
    lazyLoadInReadOnlyMode: true,
    verbose: false,
    description: 'Read-only instance for distributed setups',
    category: PresetCategory.DISTRIBUTED
  },
  
  // Service-specific presets
  [PresetName.INGESTION_SERVICE]: {
    storage: StorageOption.CLOUD,
    model: ModelPrecision.Q8,
    features: ['core', 'batch-processing', 'entity-registry'],
    distributed: true,
    role: DistributedRole.WRITER,
    writeOnly: true,
    allowDirectReads: true,
    verbose: false,
    description: 'High-throughput data ingestion service',
    category: PresetCategory.SERVICE
  },
  
  [PresetName.SEARCH_API]: {
    storage: StorageOption.CLOUD,
    model: ModelPrecision.FP32,
    features: ['core', 'search', 'cache', 'triple-intelligence'],
    distributed: true,
    role: DistributedRole.READER,
    readOnly: true,
    lazyLoadInReadOnlyMode: true,
    cache: {
      hotCacheMaxSize: 10000,
      autoTune: true
    },
    verbose: false,
    description: 'Low-latency search API service',
    category: PresetCategory.SERVICE
  },
  
  [PresetName.ANALYTICS_SERVICE]: {
    storage: StorageOption.CLOUD,
    model: ModelPrecision.AUTO,
    features: ['core', 'search', 'metrics', 'monitoring'],
    distributed: true,
    role: DistributedRole.HYBRID,
    verbose: false,
    description: 'Analytics and data processing service',
    category: PresetCategory.SERVICE
  },
  
  [PresetName.EDGE_CACHE]: {
    storage: StorageOption.AUTO,
    model: ModelPrecision.Q8,
    features: ['core', 'search', 'cache'],
    distributed: true,
    role: DistributedRole.READER,
    readOnly: true,
    lazyLoadInReadOnlyMode: true,
    cache: {
      hotCacheMaxSize: 1000,
      autoTune: false
    },
    verbose: false,
    description: 'Edge location cache with minimal footprint',
    category: PresetCategory.SERVICE
  },
  
  [PresetName.BATCH_PROCESSOR]: {
    storage: StorageOption.CLOUD,
    model: ModelPrecision.Q8,
    features: ['core', 'batch-processing', 'neural-api'],
    distributed: true,
    role: DistributedRole.HYBRID,
    cache: {
      hotCacheMaxSize: 5000,
      batchSize: 500
    },
    verbose: false,
    description: 'Batch processing and bulk operations',
    category: PresetCategory.SERVICE
  },
  
  [PresetName.STREAMING_SERVICE]: {
    storage: StorageOption.CLOUD,
    model: ModelPrecision.Q8,
    features: ['core', 'batch-processing', 'wal'],
    distributed: true,
    role: DistributedRole.WRITER,
    writeOnly: true,
    allowDirectReads: false,
    verbose: false,
    description: 'Real-time data streaming service',
    category: PresetCategory.SERVICE
  },
  
  [PresetName.ML_TRAINING]: {
    storage: StorageOption.CLOUD,
    model: ModelPrecision.FP32,
    features: FeatureSet.FULL,
    distributed: true,
    role: DistributedRole.HYBRID,
    cache: {
      hotCacheMaxSize: 20000,
      autoTune: true
    },
    verbose: true,
    description: 'Machine learning training service',
    category: PresetCategory.SERVICE
  },
  
  [PresetName.SIDECAR]: {
    storage: StorageOption.AUTO,
    model: ModelPrecision.Q8,
    features: FeatureSet.MINIMAL,
    distributed: false,
    verbose: false,
    description: 'Lightweight sidecar for microservices',
    category: PresetCategory.SERVICE
  }
} as const

/**
 * Type-safe preset getter
 */
export function getPreset(name: PresetName): PresetConfig {
  return PRESET_CONFIGS[name]
}

/**
 * Check if a string is a valid preset name
 */
export function isValidPreset(name: string): name is PresetName {
  return Object.values(PresetName).includes(name as PresetName)
}

/**
 * Get presets by category
 */
export function getPresetsByCategory(category: PresetCategory): PresetName[] {
  return Object.entries(PRESET_CONFIGS)
    .filter(([_, config]) => config.category === category)
    .map(([name]) => name as PresetName)
}

/**
 * Get all preset names
 */
export function getAllPresetNames(): PresetName[] {
  return Object.values(PresetName)
}

/**
 * Get preset description
 */
export function getPresetDescription(name: PresetName): string {
  return PRESET_CONFIGS[name].description
}

/**
 * Convert preset config to Brainy config
 */
export function presetToBrainyConfig(preset: PresetConfig): any {
  const config: any = {
    storage: preset.storage,
    model: preset.model,
    verbose: preset.verbose
  }
  
  // Handle features
  if (Array.isArray(preset.features)) {
    config.features = preset.features
  } else {
    config.features = preset.features // Will be expanded by processZeroConfig
  }
  
  // Handle distributed settings
  if (preset.distributed) {
    config.distributed = {
      enabled: true,
      role: preset.role
    }
    
    if (preset.readOnly) config.readOnly = true
    if (preset.writeOnly) config.writeOnly = true
    if (preset.allowDirectReads) config.allowDirectReads = true
    if (preset.lazyLoadInReadOnlyMode) config.lazyLoadInReadOnlyMode = true
  }
  
  // Handle cache settings
  if (preset.cache) {
    config.cache = preset.cache
  }
  
  return config
}