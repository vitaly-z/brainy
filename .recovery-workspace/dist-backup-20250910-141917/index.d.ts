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
import { Brainy } from './brainy.js';
export { Brainy };
export type { BrainyConfig, Entity, Relation, Result, AddParams, UpdateParams, RelateParams, FindParams } from './types/brainy.types.js';
export { PresetName, ModelPrecision, StorageOption, FeatureSet, DistributedRole, PresetCategory, BrainyZeroConfig, StorageProvider, registerStorageAugmentation, registerPresetAugmentation, getPreset, isValidPreset, getPresetsByCategory, getAllPresetNames, getPresetDescription } from './config/index.js';
export { Cortex, cortex } from './cortex.js';
export { NeuralImport } from './cortex/neuralImport.js';
export type { NeuralAnalysisResult, DetectedEntity, DetectedRelationship, NeuralInsight, NeuralImportOptions } from './cortex/neuralImport.js';
import { euclideanDistance, cosineDistance, manhattanDistance, dotProductDistance } from './utils/index.js';
export { euclideanDistance, cosineDistance, manhattanDistance, dotProductDistance };
export { getBrainyVersion } from './utils/version.js';
import { UniversalSentenceEncoder, TransformerEmbedding, createEmbeddingFunction, defaultEmbeddingFunction, batchEmbed, embeddingFunctions } from './utils/embedding.js';
import { executeInThread, cleanupWorkerPools } from './utils/workerUtils.js';
import { logger, LogLevel, configureLogger, createModuleLogger } from './utils/logger.js';
import { getGlobalSocketManager, AdaptiveSocketManager } from './utils/adaptiveSocketManager.js';
import { getGlobalBackpressure, AdaptiveBackpressure } from './utils/adaptiveBackpressure.js';
import { getGlobalPerformanceMonitor, PerformanceMonitor } from './utils/performanceMonitor.js';
import { isBrowser, isNode, isWebWorker, areWebWorkersAvailable, areWorkerThreadsAvailable, areWorkerThreadsAvailableSync, isThreadingAvailable, isThreadingAvailableAsync } from './utils/environment.js';
export { UniversalSentenceEncoder, TransformerEmbedding, createEmbeddingFunction, defaultEmbeddingFunction, batchEmbed, embeddingFunctions, executeInThread, cleanupWorkerPools, isBrowser, isNode, isWebWorker, areWebWorkersAvailable, areWorkerThreadsAvailable, areWorkerThreadsAvailableSync, isThreadingAvailable, isThreadingAvailableAsync, logger, LogLevel, configureLogger, createModuleLogger, getGlobalSocketManager, AdaptiveSocketManager, getGlobalBackpressure, AdaptiveBackpressure, getGlobalPerformanceMonitor, PerformanceMonitor };
import { OPFSStorage, MemoryStorage, R2Storage, S3CompatibleStorage, createStorage } from './storage/storageFactory.js';
export { OPFSStorage, MemoryStorage, R2Storage, S3CompatibleStorage, createStorage };
export { FileSystemStorage } from './storage/adapters/fileSystemStorage.js';
import { Pipeline, pipeline, augmentationPipeline, ExecutionMode, PipelineOptions, PipelineResult, createPipeline, createStreamingPipeline, StreamlinedExecutionMode, StreamlinedPipelineOptions, StreamlinedPipelineResult } from './pipeline.js';
export { Pipeline, pipeline, augmentationPipeline, ExecutionMode, createPipeline, createStreamingPipeline, StreamlinedExecutionMode, };
export type { PipelineOptions, PipelineResult, StreamlinedPipelineOptions, StreamlinedPipelineResult };
import { loadAugmentationsFromModules, createAugmentationRegistryPlugin, createAugmentationRegistryRollupPlugin } from './augmentationRegistryLoader.js';
import type { AugmentationRegistryLoaderOptions, AugmentationLoadResult } from './augmentationRegistryLoader.js';
export { loadAugmentationsFromModules, createAugmentationRegistryPlugin, createAugmentationRegistryRollupPlugin };
export type { AugmentationRegistryLoaderOptions, AugmentationLoadResult };
import { StorageAugmentation, DynamicStorageAugmentation, createStorageAugmentationFromConfig } from './augmentations/storageAugmentation.js';
import { MemoryStorageAugmentation, FileSystemStorageAugmentation, OPFSStorageAugmentation, S3StorageAugmentation, R2StorageAugmentation, GCSStorageAugmentation, createAutoStorageAugmentation } from './augmentations/storageAugmentations.js';
import { WebSocketConduitAugmentation } from './augmentations/conduitAugmentations.js';
export { StorageAugmentation, DynamicStorageAugmentation, MemoryStorageAugmentation, FileSystemStorageAugmentation, OPFSStorageAugmentation, S3StorageAugmentation, R2StorageAugmentation, GCSStorageAugmentation, createAutoStorageAugmentation, createStorageAugmentationFromConfig };
export { WebSocketConduitAugmentation };
import type { Vector, VectorDocument, SearchResult, DistanceFunction, EmbeddingFunction, EmbeddingModel, HNSWNoun, HNSWVerb, HNSWConfig, StorageAdapter } from './coreTypes.js';
import { HNSWIndex } from './hnsw/hnswIndex.js';
import { HNSWIndexOptimized, HNSWOptimizedConfig } from './hnsw/hnswIndexOptimized.js';
export { HNSWIndex, HNSWIndexOptimized };
export type { Vector, VectorDocument, SearchResult, DistanceFunction, EmbeddingFunction, EmbeddingModel, HNSWNoun, HNSWVerb, HNSWConfig, HNSWOptimizedConfig, StorageAdapter };
import type { AugmentationResponse, BrainyAugmentation, BaseAugmentation, AugmentationContext } from './types/augmentations.js';
export { AugmentationManager, type AugmentationInfo } from './augmentationManager.js';
export type { AugmentationResponse, BrainyAugmentation, BaseAugmentation, AugmentationContext };
import type { GraphNoun, GraphVerb, EmbeddedGraphVerb, Person, Location, Thing, Event, Concept, Content, Collection, Organization, Document, Media, File, Message, Dataset, Product, Service, User, Task, Project, Process, State, Role, Topic, Language, Currency, Measurement } from './types/graphTypes.js';
import { NounType, VerbType } from './types/graphTypes.js';
export type { GraphNoun, GraphVerb, EmbeddedGraphVerb, Person, Location, Thing, Event, Concept, Content, Collection, Organization, Document, Media, File, Message, Dataset, Product, Service, User, Task, Project, Process, State, Role, Topic, Language, Currency, Measurement };
import { getNounTypes, getVerbTypes, getNounTypeMap, getVerbTypeMap } from './utils/typeUtils.js';
import { BrainyTypes, TypeSuggestion, suggestType } from './utils/brainyTypes.js';
export { NounType, VerbType, getNounTypes, getVerbTypes, getNounTypeMap, getVerbTypeMap, BrainyTypes, suggestType };
export type { TypeSuggestion };
import { BrainyMCPAdapter, MCPAugmentationToolset, BrainyMCPService } from './mcp/index.js';
import { MCPRequest, MCPResponse, MCPDataAccessRequest, MCPToolExecutionRequest, MCPSystemInfoRequest, MCPAuthenticationRequest, MCPRequestType, MCPServiceOptions, MCPTool, MCP_VERSION } from './types/mcpTypes.js';
export { BrainyMCPAdapter, MCPAugmentationToolset, BrainyMCPService, MCPRequestType, MCP_VERSION };
export type { MCPRequest, MCPResponse, MCPDataAccessRequest, MCPToolExecutionRequest, MCPSystemInfoRequest, MCPAuthenticationRequest, MCPServiceOptions, MCPTool };
