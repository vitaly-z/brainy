/**
 * WASM Embedding Engine
 *
 * The main embedding engine that combines all components:
 * - WordPieceTokenizer: Text → Token IDs
 * - ONNXInferenceEngine: Token IDs → Hidden States
 * - EmbeddingPostProcessor: Hidden States → Normalized Embedding
 *
 * This replaces transformers.js with a clean, production-grade implementation.
 *
 * Features:
 * - Singleton pattern (one model instance)
 * - Lazy initialization
 * - Batch processing support
 * - Zero runtime dependencies
 */

import { WordPieceTokenizer } from './WordPieceTokenizer.js'
import { ONNXInferenceEngine } from './ONNXInferenceEngine.js'
import { EmbeddingPostProcessor } from './EmbeddingPostProcessor.js'
import { getAssetLoader } from './AssetLoader.js'
import { EmbeddingResult, EngineStats, MODEL_CONSTANTS } from './types.js'

// Global singleton instance
let globalInstance: WASMEmbeddingEngine | null = null
let globalInitPromise: Promise<void> | null = null

/**
 * WASM-based embedding engine
 */
export class WASMEmbeddingEngine {
  private tokenizer: WordPieceTokenizer | null = null
  private inference: ONNXInferenceEngine | null = null
  private postProcessor: EmbeddingPostProcessor | null = null
  private initialized = false
  private embedCount = 0
  private totalProcessingTimeMs = 0

  private constructor() {
    // Private constructor for singleton
  }

  /**
   * Get the singleton instance
   */
  static getInstance(): WASMEmbeddingEngine {
    if (!globalInstance) {
      globalInstance = new WASMEmbeddingEngine()
    }
    return globalInstance
  }

  /**
   * Initialize all components
   */
  async initialize(): Promise<void> {
    // Already initialized
    if (this.initialized) {
      return
    }

    // Initialization in progress
    if (globalInitPromise) {
      await globalInitPromise
      return
    }

    // Start initialization
    globalInitPromise = this.performInit()

    try {
      await globalInitPromise
    } finally {
      globalInitPromise = null
    }
  }

  /**
   * Perform actual initialization
   */
  private async performInit(): Promise<void> {
    const startTime = Date.now()
    console.log('🚀 Initializing WASM Embedding Engine...')

    try {
      const assetLoader = getAssetLoader()

      // Verify assets exist
      const verification = await assetLoader.verifyAssets()
      if (!verification.valid) {
        throw new Error(
          `Missing model assets:\n${verification.errors.join('\n')}\n\n` +
          `Expected model at: ${verification.modelPath}\n` +
          `Expected vocab at: ${verification.vocabPath}\n\n` +
          `Run 'npm run download-model' to download the model files.`
        )
      }

      // Load vocabulary and create tokenizer
      console.log('📖 Loading vocabulary...')
      const vocab = await assetLoader.loadVocab()
      this.tokenizer = new WordPieceTokenizer(vocab)
      console.log(`✅ Vocabulary loaded: ${this.tokenizer.vocabSize} tokens`)

      // Initialize ONNX inference engine
      console.log('🧠 Loading ONNX model...')
      const modelPath = await assetLoader.getModelPath()
      this.inference = new ONNXInferenceEngine({ modelPath })
      await this.inference.initialize(modelPath)
      console.log('✅ ONNX model loaded')

      // Create post-processor
      this.postProcessor = new EmbeddingPostProcessor(MODEL_CONSTANTS.HIDDEN_SIZE)

      this.initialized = true
      const initTime = Date.now() - startTime
      console.log(`✅ WASM Embedding Engine ready in ${initTime}ms`)

    } catch (error) {
      this.initialized = false
      this.tokenizer = null
      this.inference = null
      this.postProcessor = null
      throw new Error(
        `Failed to initialize WASM Embedding Engine: ${error instanceof Error ? error.message : String(error)}`
      )
    }
  }

  /**
   * Generate embedding for text
   */
  async embed(text: string): Promise<number[]> {
    const result = await this.embedWithMetadata(text)
    return result.embedding
  }

  /**
   * Generate embedding with metadata
   */
  async embedWithMetadata(text: string): Promise<EmbeddingResult> {
    // Ensure initialized
    if (!this.initialized) {
      await this.initialize()
    }

    if (!this.tokenizer || !this.inference || !this.postProcessor) {
      throw new Error('Engine not properly initialized')
    }

    const startTime = Date.now()

    // 1. Tokenize
    const tokenized = this.tokenizer.encode(text)

    // 2. Run inference
    const hiddenStates = await this.inference.inferSingle(
      tokenized.inputIds,
      tokenized.attentionMask,
      tokenized.tokenTypeIds
    )

    // 3. Post-process (mean pool + normalize)
    const embedding = this.postProcessor.process(
      hiddenStates,
      tokenized.attentionMask,
      tokenized.inputIds.length
    )

    const processingTimeMs = Date.now() - startTime
    this.embedCount++
    this.totalProcessingTimeMs += processingTimeMs

    return {
      embedding: Array.from(embedding),
      tokenCount: tokenized.tokenCount,
      processingTimeMs,
    }
  }

  /**
   * Batch embed multiple texts
   */
  async embedBatch(texts: string[]): Promise<number[][]> {
    // Ensure initialized
    if (!this.initialized) {
      await this.initialize()
    }

    if (!this.tokenizer || !this.inference || !this.postProcessor) {
      throw new Error('Engine not properly initialized')
    }

    if (texts.length === 0) {
      return []
    }

    // Tokenize all texts
    const batch = this.tokenizer.encodeBatch(texts)
    const seqLen = batch.inputIds[0].length

    // Run batch inference
    const hiddenStates = await this.inference.infer(
      batch.inputIds,
      batch.attentionMask,
      batch.tokenTypeIds
    )

    // Post-process each result
    const embeddings = this.postProcessor.processBatch(
      hiddenStates,
      batch.attentionMask,
      texts.length,
      seqLen
    )

    this.embedCount += texts.length

    return embeddings.map(e => Array.from(e))
  }

  /**
   * Check if initialized
   */
  isInitialized(): boolean {
    return this.initialized
  }

  /**
   * Get engine statistics
   */
  getStats(): EngineStats {
    return {
      initialized: this.initialized,
      embedCount: this.embedCount,
      totalProcessingTimeMs: this.totalProcessingTimeMs,
      avgProcessingTimeMs: this.embedCount > 0
        ? this.totalProcessingTimeMs / this.embedCount
        : 0,
      modelName: MODEL_CONSTANTS.MODEL_NAME,
    }
  }

  /**
   * Dispose and free resources
   */
  async dispose(): Promise<void> {
    if (this.inference) {
      await this.inference.dispose()
      this.inference = null
    }
    this.tokenizer = null
    this.postProcessor = null
    this.initialized = false
  }

  /**
   * Reset singleton (for testing)
   */
  static resetInstance(): void {
    if (globalInstance) {
      globalInstance.dispose()
    }
    globalInstance = null
    globalInitPromise = null
  }
}

// Export singleton access
export const wasmEmbeddingEngine = WASMEmbeddingEngine.getInstance()

/**
 * Convenience function to get embeddings
 */
export async function embed(text: string): Promise<number[]> {
  return wasmEmbeddingEngine.embed(text)
}

/**
 * Convenience function for batch embeddings
 */
export async function embedBatch(texts: string[]): Promise<number[][]> {
  return wasmEmbeddingEngine.embedBatch(texts)
}

/**
 * Get embedding stats
 */
export function getEmbeddingStats(): EngineStats {
  return wasmEmbeddingEngine.getStats()
}
