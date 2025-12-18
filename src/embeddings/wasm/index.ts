/**
 * WASM Embedding Engine - Public Exports
 *
 * Clean, production-grade embedding engine using direct ONNX WASM.
 * No transformers.js dependency, no runtime downloads, works everywhere.
 */

// Main engine
export {
  WASMEmbeddingEngine,
  wasmEmbeddingEngine,
  embed,
  embedBatch,
  getEmbeddingStats,
} from './WASMEmbeddingEngine.js'

// Components (for advanced use)
export { WordPieceTokenizer, createTokenizer } from './WordPieceTokenizer.js'
export { ONNXInferenceEngine, createInferenceEngine } from './ONNXInferenceEngine.js'
export { EmbeddingPostProcessor, createPostProcessor } from './EmbeddingPostProcessor.js'
export { AssetLoader, getAssetLoader, createAssetLoader } from './AssetLoader.js'

// Types
export type {
  TokenizerConfig,
  TokenizedInput,
  InferenceConfig,
  EmbeddingResult,
  EngineStats,
  ModelConfig,
} from './types.js'

export { SPECIAL_TOKENS, MODEL_CONSTANTS } from './types.js'
