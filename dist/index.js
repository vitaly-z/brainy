/**
 * Brainy - Your AI-Powered Second Brain
 * 🧠⚛️ A multi-dimensional database with vector, graph, and facet storage
 *
 * Core Components:
 * - BrainyData: The brain (core database)
 * - Cortex: The orchestrator (manages augmentations)
 * - NeuralImport: AI-powered data understanding
 * - Augmentations: Brain capabilities (plugins)
 */
// Export main BrainyData class and related types
import { BrainyData } from './brainyData.js';
export { BrainyData };
// Export Cortex (the orchestrator)
export { Cortex, cortex } from './cortex.js';
// Export Neural Import (AI data understanding)
export { NeuralImport } from './cortex/neuralImport.js';
// Augmentation types are already exported later in the file
// Export distance functions for convenience
import { euclideanDistance, cosineDistance, manhattanDistance, dotProductDistance, getStatistics } from './utils/index.js';
export { euclideanDistance, cosineDistance, manhattanDistance, dotProductDistance, getStatistics };
// Export embedding functionality
import { UniversalSentenceEncoder, TransformerEmbedding, createEmbeddingFunction, defaultEmbeddingFunction, batchEmbed, embeddingFunctions } from './utils/embedding.js';
// Export worker utilities
import { executeInThread, cleanupWorkerPools } from './utils/workerUtils.js';
// Export logging utilities
import { logger, LogLevel, configureLogger, createModuleLogger } from './utils/logger.js';
// Export BrainyChat for conversational AI
import { BrainyChat } from './chat/BrainyChat.js';
export { BrainyChat };
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
// Export augmentation factory
import { createSenseAugmentation, addWebSocketSupport, executeAugmentation, loadAugmentationModule } from './augmentationFactory.js';
export { 
// Unified pipeline exports
Pipeline, pipeline, augmentationPipeline, ExecutionMode, 
// Factory functions
createPipeline, createStreamingPipeline, StreamlinedExecutionMode, 
// Augmentation factory exports
createSenseAugmentation, addWebSocketSupport, executeAugmentation, loadAugmentationModule };
// Export augmentation registry for build-time loading
import { availableAugmentations, registerAugmentation, initializeAugmentationPipeline, setAugmentationEnabled, getAugmentationsByType } from './augmentationRegistry.js';
export { availableAugmentations, registerAugmentation, initializeAugmentationPipeline, setAugmentationEnabled, getAugmentationsByType };
// Export augmentation registry loader for build tools
import { loadAugmentationsFromModules, createAugmentationRegistryPlugin, createAugmentationRegistryRollupPlugin } from './augmentationRegistryLoader.js';
export { loadAugmentationsFromModules, createAugmentationRegistryPlugin, createAugmentationRegistryRollupPlugin };
// Export augmentation implementations
import { MemoryStorageAugmentation, FileSystemStorageAugmentation, OPFSStorageAugmentation, createMemoryAugmentation } from './augmentations/memoryAugmentations.js';
import { WebSocketConduitAugmentation, WebRTCConduitAugmentation, createConduitAugmentation } from './augmentations/conduitAugmentations.js';
import { ServerSearchConduitAugmentation, ServerSearchActivationAugmentation, createServerSearchAugmentations } from './augmentations/serverSearchAugmentations.js';
// Non-LLM exports
export { MemoryStorageAugmentation, FileSystemStorageAugmentation, OPFSStorageAugmentation, createMemoryAugmentation, WebSocketConduitAugmentation, WebRTCConduitAugmentation, createConduitAugmentation, ServerSearchConduitAugmentation, ServerSearchActivationAugmentation, createServerSearchAugmentations };
// Export HNSW index and optimized version
import { HNSWIndex } from './hnsw/hnswIndex.js';
import { HNSWIndexOptimized } from './hnsw/hnswIndexOptimized.js';
export { HNSWIndex, HNSWIndexOptimized };
import { AugmentationType } from './types/augmentations.js';
// Export augmentation manager for type-safe augmentation management
export { AugmentationManager } from './augmentationManager.js';
export { AugmentationType };
import { NounType, VerbType } from './types/graphTypes.js';
// Export type utility functions
import { getNounTypes, getVerbTypes, getNounTypeMap, getVerbTypeMap } from './utils/typeUtils.js';
export { NounType, VerbType, getNounTypes, getVerbTypes, getNounTypeMap, getVerbTypeMap };
// Export MCP (Model Control Protocol) components
import { BrainyMCPAdapter, MCPAugmentationToolset, BrainyMCPService } from './mcp/index.js'; // Import from mcp/index.js
import { MCPRequestType, MCP_VERSION } from './types/mcpTypes.js';
export { 
// MCP classes
BrainyMCPAdapter, MCPAugmentationToolset, BrainyMCPService, 
// MCP types
MCPRequestType, MCP_VERSION };
//# sourceMappingURL=index.js.map