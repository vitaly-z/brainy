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
import { BrainyData, BrainyDataConfig } from './brainyData.js'

export { BrainyData }
export type { BrainyDataConfig }

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
  PresetCategory,
  // Config type
  BrainyZeroConfig,
  // Extensibility
  StorageProvider,
  registerStorageAugmentation,
  registerPresetAugmentation,
  // Preset utilities
  getPreset,
  isValidPreset,
  getPresetsByCategory,
  getAllPresetNames,
  getPresetDescription
} from './config/index.js'

// Export Cortex (the orchestrator)
export { 
  Cortex, 
  cortex
} from './cortex.js'

// Export Neural Import (AI data understanding)
export { NeuralImport } from './cortex/neuralImport.js'
export type { 
  NeuralAnalysisResult,
  DetectedEntity,
  DetectedRelationship,
  NeuralInsight,
  NeuralImportOptions 
} from './cortex/neuralImport.js'

// Augmentation types are already exported later in the file

// Export distance functions for convenience
import {
  euclideanDistance,
  cosineDistance,
  manhattanDistance,
  dotProductDistance,
  getStatistics
} from './utils/index.js'

export {
  euclideanDistance,
  cosineDistance,
  manhattanDistance,
  dotProductDistance,
  getStatistics
}

// Export version utilities
export { getBrainyVersion } from './utils/version.js'

// Export embedding functionality
import {
  UniversalSentenceEncoder,
  TransformerEmbedding,
  createEmbeddingFunction,
  defaultEmbeddingFunction,
  batchEmbed,
  embeddingFunctions
} from './utils/embedding.js'

// Export worker utilities
import { executeInThread, cleanupWorkerPools } from './utils/workerUtils.js'

// Export logging utilities
import { 
  logger, 
  LogLevel, 
  configureLogger, 
  createModuleLogger 
} from './utils/logger.js'

// Export BrainyChat for conversational AI
import { BrainyChat } from './chat/BrainyChat.js'
export { BrainyChat }

// Export Cortex CLI functionality - commented out for core MIT build
// export { Cortex } from './cortex/cortex.js'

// Export performance and optimization utilities
import {
  getGlobalSocketManager,
  AdaptiveSocketManager
} from './utils/adaptiveSocketManager.js'

import {
  getGlobalBackpressure,
  AdaptiveBackpressure
} from './utils/adaptiveBackpressure.js'

import {
  getGlobalPerformanceMonitor,
  PerformanceMonitor
} from './utils/performanceMonitor.js'

// Export environment utilities
import {
  isBrowser,
  isNode,
  isWebWorker,
  areWebWorkersAvailable,
  areWorkerThreadsAvailable,
  areWorkerThreadsAvailableSync,
  isThreadingAvailable,
  isThreadingAvailableAsync
} from './utils/environment.js'

export {
  UniversalSentenceEncoder,
  TransformerEmbedding,
  createEmbeddingFunction,
  defaultEmbeddingFunction,
  batchEmbed,
  embeddingFunctions,

  // Worker utilities
  executeInThread,
  cleanupWorkerPools,

  // Environment utilities
  isBrowser,
  isNode,
  isWebWorker,
  areWebWorkersAvailable,
  areWorkerThreadsAvailable,
  areWorkerThreadsAvailableSync,
  isThreadingAvailable,
  isThreadingAvailableAsync,
  
  // Logging utilities
  logger,
  LogLevel,
  configureLogger,
  createModuleLogger,
  
  // Performance and optimization utilities
  getGlobalSocketManager,
  AdaptiveSocketManager,
  getGlobalBackpressure,
  AdaptiveBackpressure,
  getGlobalPerformanceMonitor,
  PerformanceMonitor
}

// Export storage adapters
import {
  OPFSStorage,
  MemoryStorage,
  R2Storage,
  S3CompatibleStorage,
  createStorage
} from './storage/storageFactory.js'

export {
  OPFSStorage,
  MemoryStorage,
  R2Storage,
  S3CompatibleStorage,
  createStorage
}

// FileSystemStorage is exported separately to avoid browser build issues
export { FileSystemStorage } from './storage/adapters/fileSystemStorage.js'

// Export unified pipeline
import {
  Pipeline,
  pipeline,
  augmentationPipeline,
  ExecutionMode,
  PipelineOptions,
  PipelineResult,
  createPipeline,
  createStreamingPipeline,
  StreamlinedExecutionMode,
  StreamlinedPipelineOptions,
  StreamlinedPipelineResult
} from './pipeline.js'

// Sequential pipeline removed - use unified pipeline instead

// REMOVED: Old augmentation factory for 2.0 clean architecture

export {
  // Unified pipeline exports
  Pipeline,
  pipeline,
  augmentationPipeline,
  ExecutionMode,

  // Factory functions
  createPipeline,
  createStreamingPipeline,
  StreamlinedExecutionMode,

  // Augmentation factory exports (REMOVED in 2.0 - Use BrainyAugmentation interface)
  // createSenseAugmentation,     // → Use BaseAugmentation class
  // addWebSocketSupport,         // → Use APIServerAugmentation  
  // executeAugmentation,         // → Use brain.augmentations.execute()
  // loadAugmentationModule       // → Use dynamic imports
}
export type {
  PipelineOptions,
  PipelineResult,
  StreamlinedPipelineOptions,
  StreamlinedPipelineResult
  // AugmentationOptions - REMOVED in 2.0 (use BaseAugmentation config)
}

// Export augmentation registry for build-time loading
import {
  availableAugmentations,
  registerAugmentation,
  initializeAugmentationPipeline,
  setAugmentationEnabled,
  getAugmentationsByType
} from './augmentationRegistry.js'

export {
  availableAugmentations,
  registerAugmentation,
  initializeAugmentationPipeline,
  setAugmentationEnabled,
  getAugmentationsByType
}

// Export augmentation registry loader for build tools
import {
  loadAugmentationsFromModules,
  createAugmentationRegistryPlugin,
  createAugmentationRegistryRollupPlugin
} from './augmentationRegistryLoader.js'
import type {
  AugmentationRegistryLoaderOptions,
  AugmentationLoadResult
} from './augmentationRegistryLoader.js'

export {
  loadAugmentationsFromModules,
  createAugmentationRegistryPlugin,
  createAugmentationRegistryRollupPlugin
}
export type { AugmentationRegistryLoaderOptions, AugmentationLoadResult }


// Export augmentation implementations
import {
  StorageAugmentation,
  DynamicStorageAugmentation,
  createStorageAugmentationFromConfig
} from './augmentations/storageAugmentation.js'
import {
  MemoryStorageAugmentation,
  FileSystemStorageAugmentation,
  OPFSStorageAugmentation,
  S3StorageAugmentation,
  R2StorageAugmentation,
  GCSStorageAugmentation,
  createAutoStorageAugmentation
} from './augmentations/storageAugmentations.js'
import {
  WebSocketConduitAugmentation
} from './augmentations/conduitAugmentations.js'
import {
  ServerSearchConduitAugmentation,
  ServerSearchActivationAugmentation,
  createServerSearchAugmentations
} from './augmentations/serverSearchAugmentations.js'

// Storage augmentation exports
export {
  // Base classes
  StorageAugmentation,
  DynamicStorageAugmentation,
  // Concrete implementations
  MemoryStorageAugmentation,
  FileSystemStorageAugmentation,
  OPFSStorageAugmentation,
  S3StorageAugmentation,
  R2StorageAugmentation,
  GCSStorageAugmentation,
  // Factory functions
  createAutoStorageAugmentation,
  createStorageAugmentationFromConfig
}

// Other augmentation exports
export {
  WebSocketConduitAugmentation,
  ServerSearchConduitAugmentation,
  ServerSearchActivationAugmentation,
  createServerSearchAugmentations
}

// LLM augmentations are optional and not imported by default
// They can be imported directly from their module if needed:
// import { LLMCognitionAugmentation, LLMActivationAugmentation, createLLMAugmentations } from './augmentations/llmAugmentations.js'

// Export types
import type {
  Vector,
  VectorDocument,
  SearchResult,
  DistanceFunction,
  EmbeddingFunction,
  EmbeddingModel,
  HNSWNoun,
  HNSWVerb,
  HNSWConfig,
  StorageAdapter
} from './coreTypes.js'

// Export HNSW index and optimized version
import { HNSWIndex } from './hnsw/hnswIndex.js'
import {
  HNSWIndexOptimized,
  HNSWOptimizedConfig
} from './hnsw/hnswIndexOptimized.js'

export { HNSWIndex, HNSWIndexOptimized }

export type {
  Vector,
  VectorDocument,
  SearchResult,
  DistanceFunction,
  EmbeddingFunction,
  EmbeddingModel,
  HNSWNoun,
  HNSWVerb,
  HNSWConfig,
  HNSWOptimizedConfig,
  StorageAdapter
}

// Export augmentation types
import type {
  AugmentationResponse,
  BrainyAugmentation,
  BaseAugmentation,
  AugmentationContext
} from './types/augmentations.js'

// Export augmentation manager for type-safe augmentation management
export { AugmentationManager, type AugmentationInfo } from './augmentationManager.js'

// Export only the clean augmentation types for 2.0
export type { 
  AugmentationResponse,
  BrainyAugmentation,
  BaseAugmentation,
  AugmentationContext
}

// Export graph types
import type {
  GraphNoun,
  GraphVerb,
  EmbeddedGraphVerb,
  Person,
  Location,
  Thing,
  Event,
  Concept,
  Content,
  Collection,
  Organization,
  Document,
  Media,
  File,
  Message,
  Dataset,
  Product,
  Service,
  User,
  Task,
  Project,
  Process,
  State,
  Role,
  Topic,
  Language,
  Currency,
  Measurement
} from './types/graphTypes.js'
import { NounType, VerbType } from './types/graphTypes.js'

export type {
  GraphNoun,
  GraphVerb,
  EmbeddedGraphVerb,
  Person,
  Location,
  Thing,
  Event,
  Concept,
  Content,
  Collection,
  Organization,
  Document,
  Media,
  File,
  Message,
  Dataset,
  Product,
  Service,
  User,
  Task,
  Project,
  Process,
  State,
  Role,
  Topic,
  Language,
  Currency,
  Measurement
}
// Export type utility functions
import { getNounTypes, getVerbTypes, getNounTypeMap, getVerbTypeMap } from './utils/typeUtils.js'

// Export BrainyTypes for complete type management
import { BrainyTypes, TypeSuggestion, suggestType } from './utils/brainyTypes.js'

export { 
  NounType, 
  VerbType,
  getNounTypes,
  getVerbTypes,
  getNounTypeMap,
  getVerbTypeMap,
  // BrainyTypes - complete type management
  BrainyTypes,
  suggestType
}

export type { TypeSuggestion }

// Export MCP (Model Control Protocol) components
import {
  BrainyMCPAdapter,
  MCPAugmentationToolset,
  BrainyMCPService
} from './mcp/index.js' // Import from mcp/index.js
import {
  MCPRequest,
  MCPResponse,
  MCPDataAccessRequest,
  MCPToolExecutionRequest,
  MCPSystemInfoRequest,
  MCPAuthenticationRequest,
  MCPRequestType,
  MCPServiceOptions,
  MCPTool,
  MCP_VERSION
} from './types/mcpTypes.js'

export {
  // MCP classes
  BrainyMCPAdapter,
  MCPAugmentationToolset,
  BrainyMCPService,

  // MCP types
  MCPRequestType,
  MCP_VERSION
}

export type {
  MCPRequest,
  MCPResponse,
  MCPDataAccessRequest,
  MCPToolExecutionRequest,
  MCPSystemInfoRequest,
  MCPAuthenticationRequest,
  MCPServiceOptions,
  MCPTool
}
