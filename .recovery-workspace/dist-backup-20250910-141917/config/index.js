/**
 * Zero-Configuration System
 * Main entry point for all auto-configuration features
 */
// Model configuration
export { autoSelectModelPrecision, shouldAutoDownloadModels, getModelPath, logModelConfig } from './modelAutoConfig.js';
// Model precision manager
export { ModelPrecisionManager, getModelPrecision, setModelPrecision, lockModelPrecision, validateModelPrecision } from './modelPrecisionManager.js';
// Storage configuration
export { autoDetectStorage, StorageType, StoragePreset, logStorageConfig } from './storageAutoConfig.js';
// Shared configuration for multi-instance
export { SharedConfigManager } from './sharedConfigManager.js';
// Main zero-config processor
export { processZeroConfig, createEmbeddingFunctionWithPrecision } from './zeroConfig.js';
// Strongly-typed presets and enums
export { PresetName, PresetCategory, ModelPrecision, StorageOption, FeatureSet, DistributedRole, PRESET_CONFIGS, getPreset, isValidPreset, getPresetsByCategory, getAllPresetNames, getPresetDescription, presetToBrainyConfig } from './distributedPresets.js';
// Extensible configuration
export { registerStorageAugmentation, registerPresetAugmentation, getConfigRegistry } from './extensibleConfig.js';
/**
 * Main zero-config processor
 * This is what Brainy will call
 */
export async function applyZeroConfig(input) {
    // Handle legacy config (full object) by detecting known legacy properties
    if (input && typeof input === 'object' &&
        (input.storage?.forceMemoryStorage || input.storage?.forceFileSystemStorage || input.storage?.s3Storage)) {
        // This is a legacy config object - pass through unchanged
        console.log('📦 Using legacy configuration format');
        return input;
    }
    // Process as zero-config (includes new object format)
    const { processZeroConfig } = await import('./zeroConfig.js');
    return processZeroConfig(input);
}
//# sourceMappingURL=index.js.map