/**
 * WASM Embedding Engine
 *
 * The main embedding engine using Candle (Rust/WASM) for inference.
 * This provides sentence embeddings using the all-MiniLM-L6-v2 model.
 *
 * Features:
 * - Singleton pattern (one model instance)
 * - Lazy initialization
 * - Batch processing support
 * - Works with Bun compile (no dynamic imports)
 * - Pure WASM - no native dependencies
 *
 * Migration from ONNX Runtime:
 * This implementation replaces the previous ONNX-based engine with Candle WASM.
 * The interface remains identical for backward compatibility.
 */

import { CandleEmbeddingEngine } from './CandleEmbeddingEngine.js'
import { EmbeddingResult, EngineStats } from './types.js'

// Global singleton instance
let globalInstance: WASMEmbeddingEngine | null = null
let globalInitPromise: Promise<void> | null = null

/**
 * WASM-based embedding engine
 *
 * Uses Candle (HuggingFace's Rust ML framework) for inference.
 * Supports all-MiniLM-L6-v2 with 384-dimensional embeddings.
 */
export class WASMEmbeddingEngine {
  private candleEngine: CandleEmbeddingEngine
  private initialized = false

  private constructor() {
    // Get the Candle engine singleton
    this.candleEngine = CandleEmbeddingEngine.getInstance()
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
   * Initialize the engine
   */
  async initialize(): Promise<void> {
    // Only skip if BOTH this layer and the underlying Candle engine are initialized.
    // If Candle crashed and reset itself, we must re-initialize even though our flag is true.
    if (this.initialized && this.candleEngine.isInitialized()) {
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
    await this.candleEngine.initialize()
    this.initialized = true
  }

  /**
   * Generate embedding for text
   */
  async embed(text: string): Promise<number[]> {
    return this.candleEngine.embed(text)
  }

  /**
   * Generate embedding with metadata
   */
  async embedWithMetadata(text: string): Promise<EmbeddingResult> {
    return this.candleEngine.embedWithMetadata(text)
  }

  /**
   * Batch embed multiple texts
   */
  async embedBatch(texts: string[]): Promise<number[][]> {
    return this.candleEngine.embedBatch(texts)
  }

  /**
   * Check if initialized
   */
  isInitialized(): boolean {
    return this.initialized && this.candleEngine.isInitialized()
  }

  /**
   * Get engine statistics
   */
  getStats(): EngineStats {
    return this.candleEngine.getStats()
  }

  /**
   * Dispose and free resources
   */
  async dispose(): Promise<void> {
    await this.candleEngine.dispose()
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
    CandleEmbeddingEngine.resetInstance()
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
