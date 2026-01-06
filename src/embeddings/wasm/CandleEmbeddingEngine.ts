/**
 * Candle-based Embedding Engine
 *
 * TypeScript wrapper for the Candle WASM embedding module.
 * Pure Rust/WASM implementation with model weights embedded at compile time.
 * Works with Bun, Node.js, Bun compile, and browsers.
 *
 * Key features:
 * - Model weights embedded in WASM at compile time (zero runtime downloads)
 * - Single WASM file contains everything (~90MB)
 * - Works in all environments: Node.js, Bun, Bun compile, browsers
 * - Tokenization, mean pooling, and normalization in Rust
 */

import { EmbeddingResult, EngineStats, MODEL_CONSTANTS } from './types.js'
import { loadWasmBytes, isWasmEmbedded } from './wasmLoader.js'

// Type declaration for Bun global (for environment detection)
declare const Bun: unknown

// Type definitions for the WASM module
interface CandleWasmModule {
  EmbeddingEngine: {
    new (): CandleEngineInstance
    create_with_embedded_model(): CandleEngineInstance
  }
  cosine_similarity: (a: Float32Array, b: Float32Array) => number
}

interface CandleEngineInstance {
  load_embedded(): void
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
 * Model weights are embedded in the WASM binary - no external files needed.
 * Supports all-MiniLM-L6-v2 with 384-dimensional embeddings.
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
   * Model weights are embedded in WASM - no file loading required.
   */
  private async performInit(): Promise<void> {
    const startTime = Date.now()
    console.log('🚀 Initializing Candle Embedding Engine...')

    try {
      // Load the WASM module
      console.log('📦 Loading Candle WASM module (includes embedded model)...')
      const wasmModule = await this.loadWasmModule()
      this.wasmModule = wasmModule

      // Create engine with embedded model - no external files needed!
      console.log('🧠 Creating engine with embedded model...')
      this.engine = wasmModule.EmbeddingEngine.create_with_embedded_model()

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
   * The WASM file contains everything: runtime code + model weights.
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

    const embeddings = this.engine.embed_batch(texts)
    this.embedCount += texts.length

    return embeddings.map((e) => Array.from(e))
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
