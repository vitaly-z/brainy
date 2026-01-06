/**
 * Type definitions for WASM Embedding Engine
 *
 * Clean, production-grade types for Candle WASM embeddings.
 * Model weights are embedded in WASM at compile time.
 */

/**
 * Tokenizer configuration for WordPiece
 * @deprecated Tokenization now happens in Rust/WASM - kept for backward compatibility
 */
export interface TokenizerConfig {
  /** Vocabulary mapping word → token ID */
  vocab: Map<string, number>
  /** [UNK] token ID (100 for BERT-based models) */
  unkTokenId: number
  /** [CLS] token ID (101 for BERT-based models) */
  clsTokenId: number
  /** [SEP] token ID (102 for BERT-based models) */
  sepTokenId: number
  /** [PAD] token ID (0 for BERT-based models) */
  padTokenId: number
  /** Maximum sequence length (256 for all-MiniLM-L6-v2 in Candle) */
  maxLength: number
  /** Whether to lowercase input (true for uncased models) */
  doLowerCase: boolean
}

/**
 * Result of tokenization
 * @deprecated Tokenization now happens in Rust/WASM - kept for backward compatibility
 */
export interface TokenizedInput {
  /** Token IDs including [CLS] and [SEP] */
  inputIds: number[]
  /** Attention mask (1 for real tokens, 0 for padding) */
  attentionMask: number[]
  /** Token type IDs (all 0 for single sentence) */
  tokenTypeIds: number[]
  /** Number of tokens (excluding special tokens) */
  tokenCount: number
}

/**
 * Inference engine configuration
 * @deprecated Model is now embedded in WASM - kept for backward compatibility
 */
export interface InferenceConfig {
  /** Path to model file (not used with embedded model) */
  modelPath: string
  /** Path to WASM files directory */
  wasmPath?: string
  /** Number of threads (1 for universal compatibility) */
  numThreads: number
  /** Enable SIMD if available */
  enableSimd: boolean
  /** Enable CPU memory arena */
  enableCpuMemArena: boolean
}

/**
 * Embedding result with metadata
 */
export interface EmbeddingResult {
  /** 384-dimensional embedding vector */
  embedding: number[]
  /** Number of tokens processed (0 when using Candle - handled internally) */
  tokenCount: number
  /** Processing time in milliseconds */
  processingTimeMs: number
}

/**
 * Engine statistics
 */
export interface EngineStats {
  /** Whether the engine is initialized */
  initialized: boolean
  /** Total number of embeddings generated */
  embedCount: number
  /** Total processing time in milliseconds */
  totalProcessingTimeMs: number
  /** Average processing time per embedding */
  avgProcessingTimeMs: number
  /** Model name */
  modelName: string
}

/**
 * Model configuration (from config.json)
 */
export interface ModelConfig {
  /** Model architecture type */
  architectures: string[]
  /** Hidden size (384 for all-MiniLM-L6-v2) */
  hidden_size: number
  /** Number of attention heads */
  num_attention_heads: number
  /** Number of hidden layers */
  num_hidden_layers: number
  /** Vocabulary size */
  vocab_size: number
  /** Maximum position embeddings */
  max_position_embeddings: number
}

/**
 * Special token IDs for BERT-based models
 */
export const SPECIAL_TOKENS = {
  PAD: 0,
  UNK: 100,
  CLS: 101,
  SEP: 102,
  MASK: 103,
} as const

/**
 * Model constants for all-MiniLM-L6-v2
 */
export const MODEL_CONSTANTS = {
  HIDDEN_SIZE: 384,
  MAX_SEQUENCE_LENGTH: 256, // Candle uses 256 for efficiency
  VOCAB_SIZE: 30522,
  MODEL_NAME: 'all-MiniLM-L6-v2',
} as const
