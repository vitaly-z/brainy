/**
 * Zero-Configuration System for Brainy
 * Provides intelligent defaults while preserving full control
 */

import { autoSelectModelPrecision, ModelPrecision, ModelPreset, getModelPath, shouldAutoDownloadModels } from './modelAutoConfig.js'
import { autoDetectStorage, StorageType, StoragePreset } from './storageAutoConfig.js'
import { AutoConfiguration } from '../utils/autoConfiguration.js'

/**
 * Simplified configuration interface
 * Everything is optional - zero config by default!
 */
export interface BrainyZeroConfig {
  /**
   * Configuration preset for common scenarios
   * - 'production': Optimized for production (disk storage, auto model, default features)
   * - 'development': Optimized for development (memory storage, fp32, verbose logging)  
   * - 'minimal': Minimal footprint (memory storage, q8, minimal features)
   * - 'zero': True zero config (all auto-detected)
   * - 'writer': Write-only instance for distributed setups (no index loading)
   * - 'reader': Read-only instance for distributed setups (no write operations)
   */
  mode?: 'production' | 'development' | 'minimal' | 'zero' | 'writer' | 'reader'
  
  /**
   * Model precision configuration
   * - 'fp32': Full precision (best quality, larger size)
   * - 'q8': Quantized 8-bit (smaller size, slightly lower quality)
   * - 'fast': Alias for fp32
   * - 'small': Alias for q8
   * - 'auto': Auto-detect based on environment (default)
   */
  model?: ModelPrecision | ModelPreset
  
  /**
   * Storage configuration  
   * - 'memory': In-memory only (no persistence)
   * - 'disk': Local disk (filesystem or OPFS)
   * - 'cloud': Cloud storage (S3/GCS/R2 if configured)
   * - 'auto': Auto-detect best option (default)
   * - Object: Custom storage configuration
   */
  storage?: StorageType | StoragePreset | any
  
  /**
   * Feature set configuration
   * - 'minimal': Core features only (fastest startup)
   * - 'default': Standard features (balanced)
   * - 'full': All features enabled (most capable)
   * - Array: Specific features to enable
   */
  features?: 'minimal' | 'default' | 'full' | string[]
  
  /**
   * Logging verbosity
   * - true: Show configuration decisions and progress
   * - false: Silent operation (default in production)
   */
  verbose?: boolean
  
  /**
   * Advanced configuration (escape hatch for power users)
   * Any additional configuration can be passed here
   */
  advanced?: any
}

/**
 * Configuration presets for common scenarios
 */
const PRESETS = {
  production: {
    storage: 'disk' as const,
    model: 'auto' as const,
    features: 'default' as const,
    verbose: false
  },
  development: {
    storage: 'memory' as const,
    model: 'fp32' as const,
    features: 'full' as const,
    verbose: true
  },
  minimal: {
    storage: 'memory' as const,
    model: 'q8' as const,
    features: 'minimal' as const,
    verbose: false
  },
  zero: {
    storage: 'auto' as const,
    model: 'auto' as const,
    features: 'default' as const,
    verbose: false
  },
  writer: {
    storage: 'auto' as const,
    model: 'auto' as const,
    features: 'minimal' as const,
    verbose: false,
    // Writer-specific settings
    distributed: true,
    role: 'writer' as const,
    writeOnly: true,
    allowDirectReads: true  // Allow deduplication checks
  },
  reader: {
    storage: 'auto' as const,
    model: 'auto' as const,
    features: 'default' as const,
    verbose: false,
    // Reader-specific settings
    distributed: true,
    role: 'reader' as const,
    readOnly: true,
    lazyLoadInReadOnlyMode: true  // Optimize for search
  }
}

/**
 * Feature sets configuration
 */
const FEATURE_SETS = {
  minimal: [
    'core',
    'search',
    'storage'
  ],
  default: [
    'core',
    'search',
    'storage',
    'cache',
    'metadata-index',
    'batch-processing',
    'entity-registry',
    'request-deduplicator'
  ],
  full: [
    'core',
    'search',
    'storage',
    'cache',
    'metadata-index',
    'batch-processing',
    'entity-registry',
    'request-deduplicator',
    'connection-pool',
    'wal',
    'monitoring',
    'metrics',
    'intelligent-verb-scoring',
    'triple-intelligence',
    'neural-api'
  ]
}

/**
 * Process zero-config input into full configuration
 */
export async function processZeroConfig(input?: string | BrainyZeroConfig): Promise<any> {
  let config: BrainyZeroConfig = {}
  
  // Handle string shorthand (preset name)
  if (typeof input === 'string') {
    if (input in PRESETS) {
      config = { mode: input as any }
    } else {
      throw new Error(`Unknown preset: ${input}. Valid presets: ${Object.keys(PRESETS).join(', ')}`)
    }
  } else if (input) {
    config = input
  }
  
  // Apply preset if specified
  if (config.mode && config.mode in PRESETS) {
    const preset = PRESETS[config.mode]
    config = {
      ...preset,
      ...config,
      // Preserve explicit overrides
      model: config.model ?? preset.model,
      storage: config.storage ?? preset.storage,
      features: config.features ?? preset.features,
      verbose: config.verbose ?? preset.verbose
    }
  }
  
  // Auto-detect environment if not in preset mode
  const environment = detectEnvironmentMode()
  
  // Process model configuration
  const modelConfig = autoSelectModelPrecision(config.model)
  
  // Process storage configuration
  const storageConfig = await autoDetectStorage(config.storage)
  
  // Process features configuration
  const features = processFeatures(config.features)
  
  // Get auto-configuration recommendations
  const autoConfig = await AutoConfiguration.getInstance().detectAndConfigure({
    expectedDataSize: estimateDataSize(environment),
    s3Available: storageConfig.type === 's3',
    memoryBudget: undefined // Let it auto-detect
  })
  
  // Determine verbosity
  const verbose = config.verbose ?? (process.env.NODE_ENV === 'development')
  
  // Log configuration decisions if verbose
  if (verbose) {
    logConfigurationSummary({
      mode: config.mode || 'auto',
      model: modelConfig,
      storage: storageConfig,
      features: features,
      environment: environment,
      autoConfig: autoConfig
    })
  }
  
  // Build final configuration
  const finalConfig: any = {
    // Model configuration
    embeddingFunction: undefined, // Will be created with correct precision
    embeddingOptions: {
      precision: modelConfig.precision,
      modelPath: getModelPath(),
      allowRemoteDownload: shouldAutoDownloadModels()
    },
    
    // Storage configuration
    storage: storageConfig.config,
    storageType: storageConfig.type,
    
    // HNSW configuration from auto-config
    hnsw: {
      M: autoConfig.recommendedConfig.enablePartitioning ? 32 : 16,
      efConstruction: autoConfig.recommendedConfig.enablePartitioning ? 400 : 200,
      maxDatasetSize: autoConfig.recommendedConfig.expectedDatasetSize,
      partitioning: autoConfig.recommendedConfig.enablePartitioning,
      maxNodesPerPartition: autoConfig.recommendedConfig.maxNodesPerPartition
    },
    
    // Cache configuration from auto-config
    cache: {
      autoTune: true,
      hotCacheMaxSize: Math.floor(autoConfig.recommendedConfig.maxMemoryUsage / (1024 * 1024 * 10)), // 10% of memory budget
      batchSize: autoConfig.recommendedConfig.enablePartitioning ? 100 : 50
    },
    
    // Features configuration
    enabledFeatures: features,
    
    // Metadata index configuration
    metadataIndex: features.includes('metadata-index') ? {
      enabled: true,
      autoRebuild: true
    } : undefined,
    
    // Intelligent verb scoring
    intelligentVerbScoring: features.includes('intelligent-verb-scoring') ? {
      enabled: true
    } : undefined,
    
    // Logging configuration
    logging: {
      verbose: verbose
    },
    
    // Performance flags from auto-config
    optimizations: autoConfig.optimizationFlags,
    
    // Advanced overrides (if any)
    ...config.advanced
  }
  
  // Apply distributed preset settings if applicable
  if (config.mode === 'writer' || config.mode === 'reader') {
    const presetSettings = PRESETS[config.mode] as any  // Cast to any since we know these presets have additional properties
    
    // Apply distributed-specific settings
    finalConfig.distributed = presetSettings.distributed
    finalConfig.readOnly = presetSettings.readOnly || false
    finalConfig.writeOnly = presetSettings.writeOnly || false
    finalConfig.allowDirectReads = presetSettings.allowDirectReads || false
    finalConfig.lazyLoadInReadOnlyMode = presetSettings.lazyLoadInReadOnlyMode || false
    
    // Set distributed role in distributed config
    if (finalConfig.distributed) {
      finalConfig.distributed = {
        enabled: true,
        role: presetSettings.role
      }
    }
    
    // Log distributed mode if verbose
    if (verbose) {
      console.log(`📡 Distributed mode: ${config.mode.toUpperCase()}`)
      console.log(`   Role: ${presetSettings.role}`)
      console.log(`   Read-only: ${finalConfig.readOnly}`)
      console.log(`   Write-only: ${finalConfig.writeOnly}`)
    }
  }
  
  return finalConfig
}

/**
 * Detect environment mode if not specified
 */
function detectEnvironmentMode(): 'production' | 'development' | 'unknown' {
  if (process.env.NODE_ENV === 'production') return 'production'
  if (process.env.NODE_ENV === 'development') return 'development'
  if (process.env.NODE_ENV === 'test') return 'development'
  
  // Check for CI environments
  if (process.env.CI || process.env.GITHUB_ACTIONS) return 'production'
  
  // Check for production indicators
  if (process.env.VERCEL_ENV === 'production' ||
      process.env.NETLIFY_ENV === 'production' ||
      process.env.RAILWAY_ENVIRONMENT === 'production') {
    return 'production'
  }
  
  return 'unknown'
}

/**
 * Process features configuration
 */
function processFeatures(features?: 'minimal' | 'default' | 'full' | string[]): string[] {
  if (Array.isArray(features)) {
    return features
  }
  
  if (features && features in FEATURE_SETS) {
    return FEATURE_SETS[features]
  }
  
  // Default based on environment
  const env = detectEnvironmentMode()
  if (env === 'production') return FEATURE_SETS.default
  if (env === 'development') return FEATURE_SETS.full
  return FEATURE_SETS.default
}

/**
 * Estimate dataset size based on environment
 */
function estimateDataSize(environment: string): number {
  switch (environment) {
    case 'production': return 100000
    case 'development': return 10000
    default: return 50000
  }
}

/**
 * Log configuration summary
 */
function logConfigurationSummary(config: any): void {
  console.log('\n🧠 Brainy Zero-Config Summary')
  console.log('================================')
  console.log(`Mode: ${config.mode}`)
  console.log(`Environment: ${config.environment}`)
  console.log(`Model: ${config.model.precision.toUpperCase()} (${config.model.reason})`)
  console.log(`Storage: ${config.storage.type.toUpperCase()} (${config.storage.reason})`)
  console.log(`Features: ${config.features.length} enabled`)
  console.log(`Memory Budget: ${Math.floor(config.autoConfig.recommendedConfig.maxMemoryUsage / (1024 * 1024))}MB`)
  console.log(`Expected Dataset: ${config.autoConfig.recommendedConfig.expectedDatasetSize.toLocaleString()} items`)
  console.log('================================\n')
}

/**
 * Create embedding function with specified precision
 * This ensures the model precision is respected
 */
export async function createEmbeddingFunctionWithPrecision(precision: ModelPrecision): Promise<any> {
  const { createEmbeddingFunction } = await import('../utils/embedding.js')
  
  // Create embedding function with specified precision
  return createEmbeddingFunction({
    precision: precision,
    verbose: false // Silent by default in zero-config
  })
}