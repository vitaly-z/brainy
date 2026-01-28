/**
 * Candle-based Embedding Engine
 *
 * TypeScript wrapper for the Candle WASM embedding module.
 * Pure Rust/WASM implementation for sentence embeddings.
 * Works with Bun, Node.js, Bun --compile, and browsers.
 *
 * Architecture (20x faster initialization):
 * - WASM file: ~2.4MB (inference code only)
 * - Model files: ~88MB (loaded separately as raw bytes)
 * - Init time: ~5-7 seconds (vs 139 seconds with embedded model)
 *
 * Key features:
 * - Separate WASM and model files for fast initialization
 * - Works in all environments: Node.js, Bun, Bun --compile, browsers
 * - For Bun --compile: model files are embedded in binary automatically
 * - Zero config for users - same API as before
 * - Tokenization, mean pooling, and normalization in Rust
 */

import { EmbeddingResult, EngineStats, MODEL_CONSTANTS } from './types.js'
import { loadWasmBytes, isWasmEmbedded } from './wasmLoader.js'
import { loadModelAssets, isModelEmbedded } from './modelLoader.js'

// Type declaration for Bun global (for environment detection)
declare const Bun: unknown

// Type definitions for the WASM module
interface CandleWasmModule {
  EmbeddingEngine: {
    new (): CandleEngineInstance
  }
  cosine_similarity: (a: Float32Array, b: Float32Array) => number
}

interface CandleEngineInstance {
  // load() is the only initialization method (no more embedded model)
  load(modelBytes: Uint8Array, tokenizerBytes: Uint8Array, configBytes: Uint8Array): void
  is_ready(): boolean
  embed(text: string): Float32Array
  embed_batch(texts: string[]): Float32Array[]
  dimension(): number
  max_sequence_length(): number
  free(): void
}

// Global singleton
let globalInstance: CandleEmbeddingEngine | null = null
let globalInitPromise: Promise<void> | null = null

/**
 * Candle-based embedding engine
 *
 * Uses the Candle ML framework (Rust/WASM) for inference.
 * Supports all-MiniLM-L6-v2 with 384-dimensional embeddings.
 *
 * Model weights are loaded separately from WASM for 20x faster init.
 * For bun --compile deployments, both WASM and model files are automatically
 * embedded in the binary - single file deployment still works.
 */
export class CandleEmbeddingEngine {
  private wasmModule: CandleWasmModule | null = null
  private engine: CandleEngineInstance | null = null
  private initialized = false
  private embedCount = 0
  private totalProcessingTimeMs = 0

  private constructor() {
    // Private constructor for singleton
  }

  /**
   * Get the singleton instance
   */
  static getInstance(): CandleEmbeddingEngine {
    if (!globalInstance) {
      globalInstance = new CandleEmbeddingEngine()
    }
    return globalInstance
  }

  /**
   * Initialize the embedding engine
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return
    }

    if (globalInitPromise) {
      await globalInitPromise
      return
    }

    globalInitPromise = this.performInit()

    try {
      await globalInitPromise
    } finally {
      globalInitPromise = null
    }
  }

  /**
   * Perform actual initialization
   *
   * WASM and model files are loaded separately for 20x faster init.
   * - WASM (~2.4MB): Compiles in ~3-5 seconds
   * - Model (~88MB): Loads as raw bytes in ~1-2 seconds
   * - Total: ~5-7 seconds (vs 139 seconds with embedded model)
   */
  private async performInit(): Promise<void> {
    const startTime = Date.now()
    console.log('🚀 Initializing Candle Embedding Engine...')

    try {
      // 1. Load the WASM module (fast: ~3-5 seconds, only 2.4MB to compile)
      console.log('📦 Loading Candle WASM module (~2.4MB)...')
      const wasmModule = await this.loadWasmModule()
      this.wasmModule = wasmModule
      const wasmTime = Date.now() - startTime
      console.log(`   WASM loaded in ${wasmTime}ms`)

      // 2. Load model assets (fast: ~1-2 seconds, raw bytes I/O)
      console.log('📥 Loading model assets (~88MB)...')
      const modelStartTime = Date.now()
      const assets = await loadModelAssets()
      const modelTime = Date.now() - modelStartTime
      console.log(`   Model loaded in ${modelTime}ms`)

      // 3. Initialize engine with external model
      console.log('🧠 Initializing embedding engine...')
      this.engine = new wasmModule.EmbeddingEngine()
      this.engine.load(assets.model, assets.tokenizer, assets.config)

      if (!this.engine.is_ready()) {
        throw new Error('Engine failed to initialize')
      }

      this.initialized = true
      const initTime = Date.now() - startTime
      console.log(`✅ Candle Embedding Engine ready in ${initTime}ms`)
    } catch (error) {
      this.initialized = false
      this.engine = null
      this.wasmModule = null
      throw new Error(
        `Failed to initialize Candle Embedding Engine: ${error instanceof Error ? error.message : String(error)}`
      )
    }
  }

  /**
   * Load the WASM module
   *
   * WASM is now only ~2.4MB (inference code only, no model weights).
   * Uses wasmLoader.ts for cross-environment compatibility.
   */
  private async loadWasmModule(): Promise<CandleWasmModule> {
    try {
      // Dynamic import of the WASM glue code
      const wasmPkg = await import('./pkg/candle_embeddings.js')

      // Detect browser environment (not Node.js, not Bun)
      // Note: Bun defines 'self' so we check for 'document' instead
      const isServerSide =
        typeof process !== 'undefined' && process.versions?.node ||
        typeof Bun !== 'undefined'

      if (isServerSide) {
        // Server-side (Node.js, Bun, Bun compile): load bytes via wasmLoader
        const wasmBytes = await loadWasmBytes()
        wasmPkg.initSync({ module: wasmBytes })
      } else {
        // Browser: use default async init which uses fetch
        await wasmPkg.default()
      }

      return wasmPkg as unknown as CandleWasmModule
    } catch (error) {
      throw new Error(
        `Failed to load Candle WASM module. ` +
        `Error: ${error instanceof Error ? error.message : String(error)}`
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
    if (!this.initialized) {
      await this.initialize()
    }

    if (!this.engine) {
      throw new Error('Engine not properly initialized')
    }

    try {
      const startTime = Date.now()

      const embedding = this.engine.embed(text)
      const embeddingArray = Array.from(embedding)

      const processingTimeMs = Date.now() - startTime
      this.embedCount++
      this.totalProcessingTimeMs += processingTimeMs

      return {
        embedding: embeddingArray,
        tokenCount: 0, // Candle handles tokenization internally
        processingTimeMs,
      }
    } catch (error) {
      console.error('WASM embed failed, marking engine for re-initialization:', error)
      this.initialized = false
      this.engine = null
      this.wasmModule = null
      throw error
    }
  }

  /**
   * Batch embed multiple texts
   */
  async embedBatch(texts: string[]): Promise<number[][]> {
    if (!this.initialized) {
      await this.initialize()
    }

    if (!this.engine) {
      throw new Error('Engine not properly initialized')
    }

    if (texts.length === 0) {
      return []
    }

    try {
      const embeddings = this.engine.embed_batch(texts)
      this.embedCount += texts.length

      return embeddings.map((e) => Array.from(e))
    } catch (error) {
      console.error('WASM embedBatch failed, marking engine for re-initialization:', error)
      this.initialized = false
      this.engine = null
      this.wasmModule = null
      throw error
    }
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
      avgProcessingTimeMs: this.embedCount > 0 ? this.totalProcessingTimeMs / this.embedCount : 0,
      modelName: MODEL_CONSTANTS.MODEL_NAME,
    }
  }

  /**
   * Dispose and free resources
   */
  async dispose(): Promise<void> {
    if (this.engine) {
      this.engine.free()
      this.engine = null
    }
    this.wasmModule = null
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

/**
 * Calculate cosine similarity between two embeddings
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) {
    return 0
  }

  let dot = 0
  let normA = 0
  let normB = 0

  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i]
    normA += a[i] * a[i]
    normB += b[i] * b[i]
  }

  if (normA === 0 || normB === 0) {
    return 0
  }

  return dot / (Math.sqrt(normA) * Math.sqrt(normB))
}

// Export singleton access
export const candleEmbeddingEngine = CandleEmbeddingEngine.getInstance()
