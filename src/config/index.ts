/**
 * Zero-Configuration System
 * Main entry point for all auto-configuration features
 */

// Model configuration
export { 
  autoSelectModelPrecision, 
  ModelPrecision as ModelPrecisionType,  // Avoid conflict
  ModelPreset,
  shouldAutoDownloadModels,
  getModelPath,
  logModelConfig
} from './modelAutoConfig.js'

// Model precision - Always Q8 now (99% accuracy, 75% smaller)
export const getModelPrecision = () => 'q8' as const

// Storage configuration
export { 
  autoDetectStorage, 
  StorageType, 
  StoragePreset,
  StorageConfigResult,
  logStorageConfig,
  // Backward compatibility types
  type StorageTypeString,
  type StoragePresetString
} from './storageAutoConfig.js'

// Shared configuration for multi-instance
export { 
  SharedConfig,
  SharedConfigManager
} from './sharedConfigManager.js'

// Main zero-config processor
export {
  BrainyZeroConfig,
  processZeroConfig,
  createEmbeddingFunctionWithPrecision
} from './zeroConfig.js'

// Strongly-typed presets and enums
export {
  PresetName,
  PresetCategory,
  ModelPrecision,
  StorageOption,
  FeatureSet,
  DistributedRole,
  PresetConfig,
  PRESET_CONFIGS,
  getPreset,
  isValidPreset,
  getPresetsByCategory,
  getAllPresetNames,
  getPresetDescription,
  presetToBrainyConfig
} from './distributedPresets.js'

// Extensible configuration
export {
  StorageProvider,
  registerStorageAugmentation,
  registerPresetAugmentation,
  getConfigRegistry
} from './extensibleConfig.js'

/**
 * Main zero-config processor
 * This is what Brainy will call
 */
export async function applyZeroConfig(input?: string | any): Promise<any> {
  // Handle legacy config (full object) by detecting known legacy properties
  if (input && typeof input === 'object' && 
      (input.storage?.forceMemoryStorage || input.storage?.forceFileSystemStorage || input.storage?.s3Storage)) {
    // This is a legacy config object - pass through unchanged
    console.log('📦 Using legacy configuration format')
    return input
  }
  
  // Process as zero-config (includes new object format)
  const { processZeroConfig } = await import('./zeroConfig.js')
  return processZeroConfig(input)
}