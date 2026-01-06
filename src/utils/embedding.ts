/**
 * Embedding functions for converting data to vectors
 *
 * Uses Candle WASM for universal compatibility.
 * No transformers.js or ONNX Runtime dependency - clean, production-grade implementation.
 */

import { EmbeddingFunction, EmbeddingModel, Vector } from '../coreTypes.js'
import { embeddingManager } from '../embeddings/EmbeddingManager.js'

/**
 * TransformerEmbedding options (kept for backward compatibility)
 */
export interface TransformerEmbeddingOptions {
  /** Model name - only all-MiniLM-L6-v2 is supported */
  model?: string
  /** Whether to enable verbose logging */
  verbose?: boolean
  /** Custom cache directory - ignored (model is bundled) */
  cacheDir?: string
  /** Force local files only - ignored (model is bundled) */
  localFilesOnly?: boolean
  /** Model precision - always q8 */
  precision?: 'fp32' | 'q8'
  /** Device - always WASM */
  device?: 'auto' | 'cpu' | 'webgpu' | 'cuda' | 'gpu'
}

/**
 * TransformerEmbedding - Sentence embeddings using Candle WASM
 *
 * This class delegates all work to EmbeddingManager which uses
 * the Candle WASM engine. Kept for backward compatibility.
 */
export class TransformerEmbedding implements EmbeddingModel {
  private initialized = false
  private verbose: boolean

  constructor(options: TransformerEmbeddingOptions = {}) {
    this.verbose = options.verbose !== undefined ? options.verbose : true

    if (this.verbose) {
      console.log('[TransformerEmbedding] Using Candle WASM backend (delegating to EmbeddingManager)')
    }
  }

  /**
   * Initialize the embedding model
   */
  public async init(): Promise<void> {
    if (this.initialized) {
      return
    }

    try {
      await embeddingManager.init()
      this.initialized = true

      if (this.verbose) {
        console.log('[TransformerEmbedding] Initialized via EmbeddingManager (WASM)')
      }
    } catch (error) {
      console.error('[TransformerEmbedding] Failed to initialize:', error)
      throw new Error(`TransformerEmbedding initialization failed: ${error}`)
    }
  }

  /**
   * Generate embeddings for text data
   */
  public async embed(data: string | string[]): Promise<Vector> {
    if (!this.initialized) {
      await this.init()
    }

    // Delegate to EmbeddingManager
    return embeddingManager.embed(data)
  }

  /**
   * Get the embedding function
   */
  getEmbeddingFunction(): EmbeddingFunction {
    return async (data: string | string[] | Record<string, unknown>): Promise<Vector> => {
      return this.embed(data as string | string[])
    }
  }

  /**
   * Check if initialized
   */
  isInitialized(): boolean {
    return this.initialized
  }

  /**
   * Dispose resources (no-op for WASM engine)
   */
  async dispose(): Promise<void> {
    this.initialized = false
  }
}

/**
 * Create a simple embedding function using the default TransformerEmbedding
 * This is the recommended way to create an embedding function for Brainy
 */
export function createEmbeddingFunction(options: TransformerEmbeddingOptions = {}): EmbeddingFunction {
  return embeddingManager.getEmbeddingFunction()
}

/**
 * Create a TransformerEmbedding instance (backward compatibility)
 */
export function createTransformerEmbedding(options: TransformerEmbeddingOptions = {}): TransformerEmbedding {
  return new TransformerEmbedding(options)
}

/**
 * Convenience function to detect best device (always returns 'wasm')
 */
export async function detectBestDevice(): Promise<'cpu' | 'webgpu' | 'cuda' | 'wasm'> {
  return 'wasm' as any
}

/**
 * Resolve device string (always returns 'wasm')
 */
export async function resolveDevice(_device: string = 'auto'): Promise<string> {
  return 'wasm'
}


/**
 * Default embedding function (backward compatibility)
 */
export const defaultEmbeddingFunction: EmbeddingFunction = embeddingManager.getEmbeddingFunction()

/**
 * UniversalSentenceEncoder alias (backward compatibility)
 */
export const UniversalSentenceEncoder = TransformerEmbedding

/**
 * Batch embed function (backward compatibility)
 */
export async function batchEmbed(texts: string[]): Promise<Vector[]> {
  const results: Vector[] = []
  for (const text of texts) {
    results.push(await embeddingManager.embed(text))
  }
  return results
}

/**
 * Embedding functions registry (backward compatibility)
 */
export const embeddingFunctions = {
  transformer: createEmbeddingFunction,
  default: createEmbeddingFunction,
}
