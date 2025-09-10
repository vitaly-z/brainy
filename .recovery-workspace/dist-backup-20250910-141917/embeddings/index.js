/**
 * Embeddings Module - Clean, Unified Architecture
 *
 * This module provides all embedding functionality for Brainy.
 *
 * Main Components:
 * - EmbeddingManager: Core embedding generation with Q8/FP32 support
 * - CachedEmbeddings: Performance optimization layer with pre-computed embeddings
 */
// Core embedding functionality
export { EmbeddingManager, embeddingManager, embed, getEmbeddingFunction, getEmbeddingStats } from './EmbeddingManager.js';
// Cached embeddings for performance
export { CachedEmbeddings, cachedEmbeddings } from './CachedEmbeddings.js';
// Default export is the singleton manager
export { embeddingManager as default } from './EmbeddingManager.js';
//# sourceMappingURL=index.js.map