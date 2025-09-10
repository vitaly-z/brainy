/**
 * Embeddings Module - Clean, Unified Architecture
 *
 * This module provides all embedding functionality for Brainy.
 *
 * Main Components:
 * - EmbeddingManager: Core embedding generation with Q8/FP32 support
 * - CachedEmbeddings: Performance optimization layer with pre-computed embeddings
 */
export { EmbeddingManager, embeddingManager, embed, getEmbeddingFunction, getEmbeddingStats, type ModelPrecision } from './EmbeddingManager.js';
export { CachedEmbeddings, cachedEmbeddings } from './CachedEmbeddings.js';
export { embeddingManager as default } from './EmbeddingManager.js';
