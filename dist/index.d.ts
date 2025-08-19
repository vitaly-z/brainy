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
import { BrainyData, BrainyDataConfig } from './brainyData.js';
export { BrainyData };
export type { BrainyDataConfig };
export { Cortex, cortex } from './cortex.js';
export { NeuralImport } from './cortex/neuralImport.js';
export type { NeuralAnalysisResult, DetectedEntity, DetectedRelationship, NeuralInsight, NeuralImportOptions } from './cortex/neuralImport.js';
import { euclideanDistance, cosineDistance, manhattanDistance, dotProductDistance, getStatistics } from './utils/index.js';
export { euclideanDistance, cosineDistance, manhattanDistance, dotProductDistance, getStatistics };
import { UniversalSentenceEncoder, TransformerEmbedding, createEmbeddingFunction, defaultEmbeddingFunction, batchEmbed, embeddingFunctions } from './utils/embedding.js';
import { executeInThread, cleanupWorkerPools } from './utils/workerUtils.js';
import { logger, LogLevel, configureLogger, createModuleLogger } from './utils/logger.js';
import { BrainyChat } from './chat/BrainyChat.js';
export { BrainyChat };
import { getGlobalSocketManager, AdaptiveSocketManager } from './utils/adaptiveSocketManager.js';
import { getGlobalBackpressure, AdaptiveBackpressure } from './utils/adaptiveBackpressure.js';
import { getGlobalPerformanceMonitor, PerformanceMonitor } from './utils/performanceMonitor.js';
import { isBrowser, isNode, isWebWorker, areWebWorkersAvailable, areWorkerThreadsAvailable, areWorkerThreadsAvailableSync, isThreadingAvailable, isThreadingAvailableAsync } from './utils/environment.js';
export { UniversalSentenceEncoder, TransformerEmbedding, createEmbeddingFunction, defaultEmbeddingFunction, batchEmbed, embeddingFunctions, executeInThread, cleanupWorkerPools, isBrowser, isNode, isWebWorker, areWebWorkersAvailable, areWorkerThreadsAvailable, areWorkerThreadsAvailableSync, isThreadingAvailable, isThreadingAvailableAsync, logger, LogLevel, configureLogger, createModuleLogger, getGlobalSocketManager, AdaptiveSocketManager, getGlobalBackpressure, AdaptiveBackpressure, getGlobalPerformanceMonitor, PerformanceMonitor };
import { OPFSStorage, MemoryStorage, R2Storage, S3CompatibleStorage, createStorage } from './storage/storageFactory.js';
export { OPFSStorage, MemoryStorage, R2Storage, S3CompatibleStorage, createStorage };
export { FileSystemStorage } from './storage/adapters/fileSystemStorage.js';
import { Pipeline, pipeline, augmentationPipeline, ExecutionMode, PipelineOptions, PipelineResult, createPipeline, createStreamingPipeline, StreamlinedExecutionMode, StreamlinedPipelineOptions, StreamlinedPipelineResult } from './pipeline.js';
import { createSenseAugmentation, addWebSocketSupport, executeAugmentation, loadAugmentationModule, AugmentationOptions } from './augmentationFactory.js';
export { Pipeline, pipeline, augmentationPipeline, ExecutionMode, createPipeline, createStreamingPipeline, StreamlinedExecutionMode, createSenseAugmentation, addWebSocketSupport, executeAugmentation, loadAugmentationModule };
export type { PipelineOptions, PipelineResult, StreamlinedPipelineOptions, StreamlinedPipelineResult, AugmentationOptions };
import { availableAugmentations, registerAugmentation, initializeAugmentationPipeline, setAugmentationEnabled, getAugmentationsByType } from './augmentationRegistry.js';
export { availableAugmentations, registerAugmentation, initializeAugmentationPipeline, setAugmentationEnabled, getAugmentationsByType };
import { loadAugmentationsFromModules, createAugmentationRegistryPlugin, createAugmentationRegistryRollupPlugin } from './augmentationRegistryLoader.js';
import type { AugmentationRegistryLoaderOptions, AugmentationLoadResult } from './augmentationRegistryLoader.js';
export { loadAugmentationsFromModules, createAugmentationRegistryPlugin, createAugmentationRegistryRollupPlugin };
export type { AugmentationRegistryLoaderOptions, AugmentationLoadResult };
import { MemoryStorageAugmentation, FileSystemStorageAugmentation, OPFSStorageAugmentation, createMemoryAugmentation } from './augmentations/memoryAugmentations.js';
import { WebSocketConduitAugmentation, WebRTCConduitAugmentation, createConduitAugmentation } from './augmentations/conduitAugmentations.js';
import { ServerSearchConduitAugmentation, ServerSearchActivationAugmentation, createServerSearchAugmentations } from './augmentations/serverSearchAugmentations.js';
export { MemoryStorageAugmentation, FileSystemStorageAugmentation, OPFSStorageAugmentation, createMemoryAugmentation, WebSocketConduitAugmentation, WebRTCConduitAugmentation, createConduitAugmentation, ServerSearchConduitAugmentation, ServerSearchActivationAugmentation, createServerSearchAugmentations };
import type { Vector, VectorDocument, SearchResult, DistanceFunction, EmbeddingFunction, EmbeddingModel, HNSWNoun, HNSWVerb, HNSWConfig, StorageAdapter } from './coreTypes.js';
import { HNSWIndex } from './hnsw/hnswIndex.js';
import { HNSWIndexOptimized, HNSWOptimizedConfig } from './hnsw/hnswIndexOptimized.js';
export { HNSWIndex, HNSWIndexOptimized };
export type { Vector, VectorDocument, SearchResult, DistanceFunction, EmbeddingFunction, EmbeddingModel, HNSWNoun, HNSWVerb, HNSWConfig, HNSWOptimizedConfig, StorageAdapter };
import type { IAugmentation, AugmentationResponse, IWebSocketSupport, ISenseAugmentation, IConduitAugmentation, ICognitionAugmentation, IMemoryAugmentation, IPerceptionAugmentation, IDialogAugmentation, IActivationAugmentation } from './types/augmentations.js';
import { AugmentationType, BrainyAugmentations } from './types/augmentations.js';
export { AugmentationManager, type AugmentationInfo } from './augmentationManager.js';
export type { IAugmentation, AugmentationResponse, IWebSocketSupport };
export { AugmentationType, BrainyAugmentations, ISenseAugmentation, IConduitAugmentation, ICognitionAugmentation, IMemoryAugmentation, IPerceptionAugmentation, IDialogAugmentation, IActivationAugmentation };
export type { IWebSocketCognitionAugmentation, IWebSocketSenseAugmentation, IWebSocketPerceptionAugmentation, IWebSocketActivationAugmentation, IWebSocketDialogAugmentation, IWebSocketConduitAugmentation, IWebSocketMemoryAugmentation } from './types/augmentations.js';
import type { GraphNoun, GraphVerb, EmbeddedGraphVerb, Person, Location, Thing, Event, Concept, Content, Collection, Organization, Document, Media, File, Message, Dataset, Product, Service, User, Task, Project, Process, State, Role, Topic, Language, Currency, Measurement } from './types/graphTypes.js';
import { NounType, VerbType } from './types/graphTypes.js';
export type { GraphNoun, GraphVerb, EmbeddedGraphVerb, Person, Location, Thing, Event, Concept, Content, Collection, Organization, Document, Media, File, Message, Dataset, Product, Service, User, Task, Project, Process, State, Role, Topic, Language, Currency, Measurement };
import { getNounTypes, getVerbTypes, getNounTypeMap, getVerbTypeMap } from './utils/typeUtils.js';
export { NounType, VerbType, getNounTypes, getVerbTypes, getNounTypeMap, getVerbTypeMap };
import { BrainyMCPAdapter, MCPAugmentationToolset, BrainyMCPService } from './mcp/index.js';
import { MCPRequest, MCPResponse, MCPDataAccessRequest, MCPToolExecutionRequest, MCPSystemInfoRequest, MCPAuthenticationRequest, MCPRequestType, MCPServiceOptions, MCPTool, MCP_VERSION } from './types/mcpTypes.js';
export { BrainyMCPAdapter, MCPAugmentationToolset, BrainyMCPService, MCPRequestType, MCP_VERSION };
export type { MCPRequest, MCPResponse, MCPDataAccessRequest, MCPToolExecutionRequest, MCPSystemInfoRequest, MCPAuthenticationRequest, MCPServiceOptions, MCPTool };
