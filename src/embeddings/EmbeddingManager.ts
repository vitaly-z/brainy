/**
 * Unified Embedding Manager
 *
 * THE single source of truth for all embedding operations in Brainy.
 * Uses Candle WASM inference for universal compatibility.
 *
 * Features:
 * - Singleton pattern ensures ONE model instance
 * - Candle WASM (no transformers.js or ONNX Runtime dependency)
 * - Bundled model (no runtime downloads)
 * - Works everywhere: Node.js, Bun, Bun --compile, browsers
 * - Memory monitoring
 */

import { Vector, EmbeddingFunction } from '../coreTypes.js'
import { WASMEmbeddingEngine } from './wasm/index.js'

// Types
export type ModelPrecision = 'q8' | 'fp32'

interface EmbeddingStats {
  initialized: boolean
  precision: ModelPrecision
  modelName: string
  embedCount: number
  initTime: number | null
  memoryMB: number | null
}

// Global state for true singleton across entire process
let globalInstance: EmbeddingManager | null = null
let globalInitPromise: Promise<void> | null = null

/**
 * Unified Embedding Manager - Clean, simple, reliable
 *
 * Now powered by Candle WASM for universal compatibility.
 */
export class EmbeddingManager {
  private engine: WASMEmbeddingEngine
  private precision: ModelPrecision = 'q8'
  private modelName = 'all-MiniLM-L6-v2'
  private initialized = false
  private initTime: number | null = null
  private embedCount = 0
  private locked = false

  private constructor() {
    this.engine = WASMEmbeddingEngine.getInstance()
    console.log('🎯 EmbeddingManager: Using Q8 precision (WASM)')
  }

  /**
   * Get the singleton instance
   */
  static getInstance(): EmbeddingManager {
    if (!globalInstance) {
      globalInstance = new EmbeddingManager()
    }
    return globalInstance
  }

  /**
   * Initialize the model (happens once)
   */
  async init(): Promise<void> {
    // In unit test mode, skip real model initialization
    const isTestMode =
      process.env.BRAINY_UNIT_TEST === 'true' ||
      (globalThis as any).__BRAINY_UNIT_TEST__

    if (isTestMode) {
      // Production safeguard
      if (process.env.NODE_ENV === 'production') {
        throw new Error(
          'CRITICAL: Mock embeddings detected in production environment! ' +
          'BRAINY_UNIT_TEST or __BRAINY_UNIT_TEST__ is set while NODE_ENV=production. ' +
          'This is a security risk. Remove test flags before deploying to production.'
        )
      }

      if (!this.initialized) {
        this.initialized = true
        this.initTime = 1 // Mock init time
        console.log('🧪 EmbeddingManager: Using mocked embeddings for unit tests')
      }
      return
    }

    // Already initialized
    if (this.initialized && this.engine.isInitialized()) {
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

    try {
      // Initialize WASM engine (handles all model loading)
      await this.engine.initialize()

      // Lock precision after successful initialization
      this.locked = true
      this.initialized = true
      this.initTime = Date.now() - startTime

      // Log success
      const memoryMB = this.getMemoryUsage()
      console.log(`📊 Precision: Q8 | Memory: ${memoryMB}MB`)
      console.log('🔒 Configuration locked')
    } catch (error) {
      this.initialized = false
      throw new Error(
        `Failed to initialize embedding model: ${error instanceof Error ? error.message : String(error)}`
      )
    }
  }

  /**
   * Generate embeddings
   */
  async embed(text: string | string[] | Record<string, unknown>): Promise<Vector> {
    // Check for unit test environment
    const isTestMode =
      process.env.BRAINY_UNIT_TEST === 'true' ||
      (globalThis as any).__BRAINY_UNIT_TEST__

    if (isTestMode) {
      if (process.env.NODE_ENV === 'production') {
        throw new Error('CRITICAL: Mock embeddings in production!')
      }
      return this.getMockEmbedding(text)
    }

    // Ensure initialized
    await this.init()

    // Normalize input to string
    let input: string
    if (Array.isArray(text)) {
      input = text.map((t) => (typeof t === 'string' ? t : String(t))).join(' ')
    } else if (typeof text === 'string') {
      input = text
    } else if (typeof text === 'object') {
      input = JSON.stringify(text)
    } else {
      console.warn('EmbeddingManager.embed received unexpected input type:', typeof text)
      input = String(text)
    }

    // Generate embedding using WASM engine
    const embedding = await this.engine.embed(input)

    // Validate dimensions
    if (embedding.length !== 384) {
      console.warn(`Unexpected embedding dimension: ${embedding.length}`)
      if (embedding.length < 384) {
        return [...embedding, ...new Array(384 - embedding.length).fill(0)]
      } else {
        return embedding.slice(0, 384)
      }
    }

    this.embedCount++
    return embedding
  }

  /**
   * Generate mock embeddings for unit tests
   */
  private getMockEmbedding(text: string | string[] | Record<string, unknown>): Vector {
    const input = Array.isArray(text) ? text.join(' ') : text
    const str = typeof input === 'string' ? input : JSON.stringify(input)
    const vector = new Array(384).fill(0)

    // Create semi-realistic embeddings based on text content
    for (let i = 0; i < Math.min(str.length, 384); i++) {
      vector[i] = (str.charCodeAt(i % str.length) % 256) / 256
    }

    // Add position-based variation
    for (let i = 0; i < 384; i++) {
      vector[i] += Math.sin(i * 0.1 + str.length) * 0.1
    }

    this.embedCount++
    return vector
  }

  /**
   * Batch embed multiple texts using native WASM batch API
   *
   * Uses the engine's embedBatch() for a single WASM forward pass
   * instead of N individual embed() calls.
   *
   * Large batches (>MICRO_BATCH_SIZE) are split into micro-batches
   * with event loop yielding between each, preventing the synchronous
   * WASM call from blocking the server for hundreds of milliseconds.
   *
   * @param texts Array of strings to embed
   * @returns Array of embedding vectors (384 dimensions each)
   */
  async embedBatch(texts: string[], options?: { signal?: AbortSignal }): Promise<number[][]> {
    if (texts.length === 0) return []

    const isTestMode =
      process.env.BRAINY_UNIT_TEST === 'true' ||
      (globalThis as any).__BRAINY_UNIT_TEST__

    if (isTestMode) {
      if (process.env.NODE_ENV === 'production') {
        throw new Error('CRITICAL: Mock embeddings in production!')
      }
      return texts.map(t => this.getMockEmbedding(t))
    }

    await this.init()

    // Small batches: single WASM call (no overhead)
    const MICRO_BATCH_SIZE = 20
    if (texts.length <= MICRO_BATCH_SIZE) {
      const results = await this.engine.embedBatch(texts)
      this.embedCount += texts.length
      return results
    }

    // Large batches: micro-batch with event loop yielding
    // Each micro-batch of ~20 texts blocks ~10-30ms, then yields
    // so other requests (HTTP, timers, I/O) can proceed
    const allResults: number[][] = []
    for (let i = 0; i < texts.length; i += MICRO_BATCH_SIZE) {
      if (options?.signal?.aborted) {
        return allResults
      }

      const batch = texts.slice(i, i + MICRO_BATCH_SIZE)
      const batchResults = await this.engine.embedBatch(batch)
      allResults.push(...batchResults)
      this.embedCount += batch.length

      // Yield to event loop between micro-batches
      if (i + MICRO_BATCH_SIZE < texts.length) {
        await new Promise<void>(resolve => setTimeout(resolve, 0))
      }
    }
    return allResults
  }

  /**
   * Get embedding function for compatibility
   */
  getEmbeddingFunction(): EmbeddingFunction {
    return async (data: string | string[] | Record<string, unknown>): Promise<Vector> => {
      return await this.embed(data)
    }
  }

  /**
   * Get memory usage in MB
   */
  private getMemoryUsage(): number | null {
    if (typeof process !== 'undefined' && process.memoryUsage) {
      const usage = process.memoryUsage()
      return Math.round(usage.heapUsed / 1024 / 1024)
    }
    return null
  }

  /**
   * Get current statistics
   */
  getStats(): EmbeddingStats {
    const engineStats = this.engine.getStats()
    return {
      initialized: this.initialized,
      precision: this.precision,
      modelName: this.modelName,
      embedCount: this.embedCount + engineStats.embedCount,
      initTime: this.initTime,
      memoryMB: this.getMemoryUsage(),
    }
  }

  /**
   * Check if initialized
   */
  isInitialized(): boolean {
    return this.initialized
  }

  /**
   * Get current precision
   */
  getPrecision(): ModelPrecision {
    return this.precision
  }

  /**
   * Validate precision matches expected
   */
  validatePrecision(expected: ModelPrecision): void {
    if (this.locked && expected !== this.precision) {
      throw new Error(
        `Precision mismatch! System using ${this.precision.toUpperCase()} ` +
        `but ${expected.toUpperCase()} was requested. Cannot mix precisions.`
      )
    }
  }
}

// Export singleton instance and convenience functions
export const embeddingManager = EmbeddingManager.getInstance()

/**
 * Direct embed function
 */
export async function embed(
  text: string | string[] | Record<string, unknown>
): Promise<Vector> {
  return await embeddingManager.embed(text)
}

/**
 * Get embedding function for compatibility
 */
export function getEmbeddingFunction(): EmbeddingFunction {
  return embeddingManager.getEmbeddingFunction()
}

/**
 * Get statistics
 */
export function getEmbeddingStats(): EmbeddingStats {
  return embeddingManager.getStats()
}
