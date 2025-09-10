/**
 * Brainy 3.0 - Your AI-Powered Second Brain
 * 🧠⚛️ A multi-dimensional database with vector, graph, and relational storage
 *
 * Core Components:
 * - Brainy: The unified database with Triple Intelligence
 * - Triple Intelligence: Seamless fusion of vector + graph + field search
 * - Augmentations: Extensible plugin system
 * - Neural API: AI-powered clustering and analysis
 */
// Export main Brainy class - the modern, clean API for Brainy 3.0
import { Brainy } from './brainy.js';
export { Brainy };
// Export zero-configuration types and enums
export { 
// Preset names
PresetName, 
// Model configuration
ModelPrecision, 
// Storage configuration  
StorageOption, 
// Feature configuration
FeatureSet, 
// Distributed roles
DistributedRole, 
// Categories
PresetCategory, registerStorageAugmentation, registerPresetAugmentation, 
// Preset utilities
getPreset, isValidPreset, getPresetsByCategory, getAllPresetNames, getPresetDescription } from './config/index.js';
// Export Cortex (the orchestrator)
export { Cortex, cortex } from './cortex.js';
// Export Neural Import (AI data understanding)
export { NeuralImport } from './cortex/neuralImport.js';
// Augmentation types are already exported later in the file
// Export distance functions for convenience
import { euclideanDistance, cosineDistance, manhattanDistance, dotProductDistance } from './utils/index.js';
export { euclideanDistance, cosineDistance, manhattanDistance, dotProductDistance };
// Export version utilities
export { getBrainyVersion } from './utils/version.js';
// Export embedding functionality
import { UniversalSentenceEncoder, TransformerEmbedding, createEmbeddingFunction, defaultEmbeddingFunction, batchEmbed, embeddingFunctions } from './utils/embedding.js';
// Export worker utilities
import { executeInThread, cleanupWorkerPools } from './utils/workerUtils.js';
// Export logging utilities
import { logger, LogLevel, configureLogger, createModuleLogger } from './utils/logger.js';
// Chat system removed - was returning fake responses
// Export Cortex CLI functionality - commented out for core MIT build
// export { Cortex } from './cortex/cortex.js'
// Export performance and optimization utilities
import { getGlobalSocketManager, AdaptiveSocketManager } from './utils/adaptiveSocketManager.js';
import { getGlobalBackpressure, AdaptiveBackpressure } from './utils/adaptiveBackpressure.js';
import { getGlobalPerformanceMonitor, PerformanceMonitor } from './utils/performanceMonitor.js';
// Export environment utilities
import { isBrowser, isNode, isWebWorker, areWebWorkersAvailable, areWorkerThreadsAvailable, areWorkerThreadsAvailableSync, isThreadingAvailable, isThreadingAvailableAsync } from './utils/environment.js';
export { UniversalSentenceEncoder, TransformerEmbedding, createEmbeddingFunction, defaultEmbeddingFunction, batchEmbed, embeddingFunctions, 
// Worker utilities
executeInThread, cleanupWorkerPools, 
// Environment utilities
isBrowser, isNode, isWebWorker, areWebWorkersAvailable, areWorkerThreadsAvailable, areWorkerThreadsAvailableSync, isThreadingAvailable, isThreadingAvailableAsync, 
// Logging utilities
logger, LogLevel, configureLogger, createModuleLogger, 
// Performance and optimization utilities
getGlobalSocketManager, AdaptiveSocketManager, getGlobalBackpressure, AdaptiveBackpressure, getGlobalPerformanceMonitor, PerformanceMonitor };
// Export storage adapters
import { OPFSStorage, MemoryStorage, R2Storage, S3CompatibleStorage, createStorage } from './storage/storageFactory.js';
export { OPFSStorage, MemoryStorage, R2Storage, S3CompatibleStorage, createStorage };
// FileSystemStorage is exported separately to avoid browser build issues
export { FileSystemStorage } from './storage/adapters/fileSystemStorage.js';
// Export unified pipeline
import { Pipeline, pipeline, augmentationPipeline, ExecutionMode, createPipeline, createStreamingPipeline, StreamlinedExecutionMode } from './pipeline.js';
// Sequential pipeline removed - use unified pipeline instead
// REMOVED: Old augmentation factory for 2.0 clean architecture
export { 
// Unified pipeline exports
Pipeline, pipeline, augmentationPipeline, ExecutionMode, 
// Factory functions
createPipeline, createStreamingPipeline, StreamlinedExecutionMode,
// Augmentation factory exports (REMOVED in 2.0 - Use BrainyAugmentation interface)
// createSenseAugmentation,     // → Use BaseAugmentation class
// addWebSocketSupport,         // → Use APIServerAugmentation  
// executeAugmentation,         // → Use brain.augmentations.execute()
// loadAugmentationModule       // → Use dynamic imports
 };
// Augmentation registry removed - use Brainy's built-in augmentation system
// Export augmentation registry loader for build tools
import { loadAugmentationsFromModules, createAugmentationRegistryPlugin, createAugmentationRegistryRollupPlugin } from './augmentationRegistryLoader.js';
export { loadAugmentationsFromModules, createAugmentationRegistryPlugin, createAugmentationRegistryRollupPlugin };
// Export augmentation implementations
import { StorageAugmentation, DynamicStorageAugmentation, createStorageAugmentationFromConfig } from './augmentations/storageAugmentation.js';
import { MemoryStorageAugmentation, FileSystemStorageAugmentation, OPFSStorageAugmentation, S3StorageAugmentation, R2StorageAugmentation, GCSStorageAugmentation, createAutoStorageAugmentation } from './augmentations/storageAugmentations.js';
import { WebSocketConduitAugmentation } from './augmentations/conduitAugmentations.js';
// Storage augmentation exports
export { 
// Base classes
StorageAugmentation, DynamicStorageAugmentation, 
// Concrete implementations
MemoryStorageAugmentation, FileSystemStorageAugmentation, OPFSStorageAugmentation, S3StorageAugmentation, R2StorageAugmentation, GCSStorageAugmentation, 
// Factory functions
createAutoStorageAugmentation, createStorageAugmentationFromConfig };
// Other augmentation exports
export { WebSocketConduitAugmentation };
// Export HNSW index and optimized version
import { HNSWIndex } from './hnsw/hnswIndex.js';
import { HNSWIndexOptimized } from './hnsw/hnswIndexOptimized.js';
export { HNSWIndex, HNSWIndexOptimized };
// Export augmentation manager for type-safe augmentation management
export { AugmentationManager } from './augmentationManager.js';
import { NounType, VerbType } from './types/graphTypes.js';
// Export type utility functions
import { getNounTypes, getVerbTypes, getNounTypeMap, getVerbTypeMap } from './utils/typeUtils.js';
// Export BrainyTypes for complete type management
import { BrainyTypes, suggestType } from './utils/brainyTypes.js';
export { NounType, VerbType, getNounTypes, getVerbTypes, getNounTypeMap, getVerbTypeMap, 
// BrainyTypes - complete type management
BrainyTypes, suggestType };
// Export MCP (Model Control Protocol) components
import { BrainyMCPAdapter, MCPAugmentationToolset, BrainyMCPService } from './mcp/index.js'; // Import from mcp/index.js
import { MCPRequestType, MCP_VERSION } from './types/mcpTypes.js';
export { 
// MCP classes
BrainyMCPAdapter, MCPAugmentationToolset, BrainyMCPService, 
// MCP types
MCPRequestType, MCP_VERSION };
//# sourceMappingURL=index.js.map