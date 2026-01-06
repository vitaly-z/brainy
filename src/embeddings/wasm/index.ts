/**
 * WASM Embedding Engine - Public Exports
 *
 * Clean, production-grade embedding engine using Candle (Rust/WASM).
 * No ONNX Runtime dependency, no dynamic imports, works everywhere.
 *
 * Bun Compile Support:
 * When compiled with `bun build --compile`, the WASM module is automatically
 * embedded into the binary. No external files or runtime downloads needed.
 */

// Main engine (delegates to Candle)
export {
  WASMEmbeddingEngine,
  wasmEmbeddingEngine,
  embed,
  embedBatch,
  getEmbeddingStats,
} from './WASMEmbeddingEngine.js'

// Candle engine (direct access)
export {
  CandleEmbeddingEngine,
  candleEmbeddingEngine,
  cosineSimilarity,
} from './CandleEmbeddingEngine.js'

// Legacy components (for backward compatibility - not needed with Candle)
export { WordPieceTokenizer, createTokenizer } from './WordPieceTokenizer.js'
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
