/**
 * Brainy 3.0 - Your AI-Powered Second Brain
 * 🧠⚛️ A multi-dimensional database with vector, graph, and relational storage
 * 
 * Core Components:
 * - Brainy: The unified database with Triple Intelligence
 * - Triple Intelligence: Seamless fusion of vector + graph + field search
 * - Plugins: Extensible plugin system (cortex, storage adapters)
 * - Neural API: AI-powered clustering and analysis
 */

// Export main Brainy class - the modern, clean API for Brainy 3.0
import { Brainy } from './brainy.js'

export { Brainy }

// Export diagnostics result type
export type { DiagnosticsResult } from './brainy.js'

// Export Brainy configuration and types
export type {
  BrainyConfig,
  Entity,
  Relation,
  Result,
  AddParams,
  UpdateParams,
  RelateParams,
  FindParams
} from './types/brainy.types.js'

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

// Export Neural Import (AI data understanding)
export { NeuralImport } from './neural/neuralImport.js'
export type {
  NeuralAnalysisResult,
  DetectedEntity,
  DetectedRelationship,
  NeuralInsight,
  NeuralImportOptions
} from './neural/neuralImport.js'

// Export Neural Entity Extraction
export { NeuralEntityExtractor } from './neural/entityExtractor.js'
export { SmartExtractor } from './neural/SmartExtractor.js'
export { SmartRelationshipExtractor } from './neural/SmartRelationshipExtractor.js'
export type {
  ExtractedEntity
} from './neural/entityExtractor.js'
export type {
  ExtractionResult,
  SmartExtractorOptions,
  FormatContext
} from './neural/SmartExtractor.js'
export type {
  RelationshipExtractionResult,
  SmartRelationshipExtractorOptions
} from './neural/SmartRelationshipExtractor.js'

// Export distance functions for convenience
import {
  euclideanDistance,
  cosineDistance,
  manhattanDistance,
  dotProductDistance
} from './utils/index.js'

export {
  euclideanDistance,
  cosineDistance,
  manhattanDistance,
  dotProductDistance
}

// Export version utilities
export { getBrainyVersion } from './utils/version.js'

// Export plugin system
export type { BrainyPlugin, BrainyPluginContext, StorageAdapterFactory } from './plugin.js'
export { PluginRegistry } from './plugin.js'

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

// Chat system removed - was returning fake responses


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

// Export COW (Copy-on-Write) infrastructure
import { CommitLog } from './storage/cow/CommitLog.js'
import { CommitObject, CommitBuilder } from './storage/cow/CommitObject.js'
import { BlobStorage } from './storage/cow/BlobStorage.js'
import { RefManager } from './storage/cow/RefManager.js'
import { TreeObject } from './storage/cow/TreeObject.js'

export {
  // COW infrastructure
  CommitLog,
  CommitObject,
  CommitBuilder,
  BlobStorage,
  RefManager,
  TreeObject
}

// Export unified pipeline
import {
  Pipeline,
  pipeline,
  ExecutionMode,
  PipelineOptions,
  PipelineResult,
  createPipeline,
  createStreamingPipeline,
  StreamlinedExecutionMode,
  StreamlinedPipelineOptions,
  StreamlinedPipelineResult
} from './pipeline.js'

export {
  Pipeline,
  pipeline,
  ExecutionMode,
  createPipeline,
  createStreamingPipeline,
  StreamlinedExecutionMode
}
export type {
  PipelineOptions,
  PipelineResult,
  StreamlinedPipelineOptions,
  StreamlinedPipelineResult
}

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

// Export HNSW index
import { HNSWIndex } from './hnsw/hnswIndex.js'

export { HNSWIndex }

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
  StorageAdapter
}

// Export graph types
import type {
  GraphNoun,
  GraphVerb,
  EmbeddedGraphVerb,
  Person,
  Organization,
  Location,
  Thing,
  Concept,
  Event,
  Agent,
  Organism,
  Substance,
  Quality,
  TimeInterval,
  Function,
  Proposition,
  Document,
  Media,
  File,
  Message,
  Collection,
  Dataset,
  Product,
  Service,
  Task,
  Project,
  Process,
  State,
  Role,
  Language,
  Currency,
  Measurement,
  Hypothesis,
  Experiment,
  Contract,
  Regulation,
  Interface,
  Resource,
  Custom,
  SocialGroup,
  Institution,
  Norm,
  InformationContent,
  InformationBearer,
  Relationship
} from './types/graphTypes.js'
import { NounType, VerbType } from './types/graphTypes.js'

export type {
  GraphNoun,
  GraphVerb,
  EmbeddedGraphVerb,
  Person,
  Organization,
  Location,
  Thing,
  Concept,
  Event,
  Agent,
  Organism,
  Substance,
  Quality,
  TimeInterval,
  Function,
  Proposition,
  Document,
  Media,
  File,
  Message,
  Collection,
  Dataset,
  Product,
  Service,
  Task,
  Project,
  Process,
  State,
  Role,
  Language,
  Currency,
  Measurement,
  Hypothesis,
  Experiment,
  Contract,
  Regulation,
  Interface,
  Resource,
  Custom,
  SocialGroup,
  Institution,
  Norm,
  InformationContent,
  InformationBearer,
  Relationship
}
// Export type utility functions
import { getNounTypes, getVerbTypes, getNounTypeMap, getVerbTypeMap } from './utils/typeUtils.js'

// Export BrainyTypes for type validation and lookup
import { BrainyTypes } from './utils/brainyTypes.js'

export {
  NounType,
  VerbType,
  getNounTypes,
  getVerbTypes,
  getNounTypeMap,
  getVerbTypeMap,
  // BrainyTypes - type validation and lookup
  BrainyTypes
}

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

// ============= Integration Hub =============
// Connect Brainy to Excel, Power BI, Google Sheets, and more
// Enable with: new Brainy({ integrations: true })

// Hub class (used internally by brain.hub, also available for advanced use)
export {
  IntegrationHub,
  createIntegrationHub
} from './integrations/index.js'

export type {
  IntegrationHubConfig,
  IntegrationRequest,
  IntegrationResponse
} from './integrations/index.js'

// Re-export IntegrationsConfig from types (for TypeScript users)
export type { IntegrationsConfig } from './types/brainy.types.js'

// Core infrastructure
export {
  EventBus,
  TabularExporter,
  IntegrationBase,
  IntegrationLoader,
  createIntegrationLoader,
  detectEnvironment,
  INTEGRATION_CATALOG
} from './integrations/index.js'

// Integration types
export type {
  BrainyEvent,
  EventFilter,
  EventHandler,
  EventSubscription,
  TabularRow,
  RelationTabularRow,
  TabularExporterConfig,
  IntegrationConfig,
  IntegrationHealthStatus,
  HTTPIntegration,
  StreamingIntegration,
  IntegrationType,
  RuntimeEnvironment,
  IntegrationInfo,
  IntegrationLoaderConfig,
  ODataQueryOptions,
  WebhookRegistration,
  WebhookDeliveryResult
} from './integrations/index.js'

// Concrete integrations
export {
  GoogleSheetsIntegration,
  ODataIntegration,
  SSEIntegration,
  WebhookIntegration
} from './integrations/index.js'

export type {
  GoogleSheetsConfig,
  ODataConfig,
  SSEConfig,
  WebhookConfig
} from './integrations/index.js'

// OData utilities (advanced)
export {
  parseODataQuery,
  parseFilter,
  parseOrderBy,
  parseSelect,
  odataToFindParams,
  applyFilter,
  applySelect,
  applyOrderBy,
  applyPagination,
  generateEdmx,
  generateMetadataJson,
  generateServiceDocument
} from './integrations/index.js'
