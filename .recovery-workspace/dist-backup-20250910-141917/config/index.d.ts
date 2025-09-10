/**
 * Zero-Configuration System
 * Main entry point for all auto-configuration features
 */
export { autoSelectModelPrecision, ModelPrecision as ModelPrecisionType, // Avoid conflict
ModelPreset, shouldAutoDownloadModels, getModelPath, logModelConfig } from './modelAutoConfig.js';
export { ModelPrecisionManager, getModelPrecision, setModelPrecision, lockModelPrecision, validateModelPrecision } from './modelPrecisionManager.js';
export { autoDetectStorage, StorageType, StoragePreset, StorageConfigResult, logStorageConfig, type StorageTypeString, type StoragePresetString } from './storageAutoConfig.js';
export { SharedConfig, SharedConfigManager } from './sharedConfigManager.js';
export { BrainyZeroConfig, processZeroConfig, createEmbeddingFunctionWithPrecision } from './zeroConfig.js';
export { PresetName, PresetCategory, ModelPrecision, StorageOption, FeatureSet, DistributedRole, PresetConfig, PRESET_CONFIGS, getPreset, isValidPreset, getPresetsByCategory, getAllPresetNames, getPresetDescription, presetToBrainyConfig } from './distributedPresets.js';
export { StorageProvider, registerStorageAugmentation, registerPresetAugmentation, getConfigRegistry } from './extensibleConfig.js';
/**
 * Main zero-config processor
 * This is what Brainy will call
 */
export declare function applyZeroConfig(input?: string | any): Promise<any>;
