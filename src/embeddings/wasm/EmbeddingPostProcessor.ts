/**
 * Embedding Post-Processor
 *
 * Converts raw ONNX model output to final embedding vectors.
 * Implements mean pooling and L2 normalization as used by sentence-transformers.
 *
 * Pipeline:
 * 1. Mean Pooling: Average token embeddings (weighted by attention mask)
 * 2. L2 Normalization: Normalize to unit length for cosine similarity
 */

import { MODEL_CONSTANTS } from './types.js'

/**
 * Post-processor for converting ONNX output to sentence embeddings
 */
export class EmbeddingPostProcessor {
  private hiddenSize: number

  constructor(hiddenSize: number = MODEL_CONSTANTS.HIDDEN_SIZE) {
    this.hiddenSize = hiddenSize
  }

  /**
   * Mean pool token embeddings weighted by attention mask
   *
   * @param hiddenStates - Raw model output [seqLen * hiddenSize] flattened
   * @param attentionMask - Attention mask [seqLen] (1 for real tokens, 0 for padding)
   * @param seqLen - Sequence length
   * @returns Mean-pooled embedding [hiddenSize]
   */
  meanPool(
    hiddenStates: Float32Array,
    attentionMask: number[],
    seqLen: number
  ): Float32Array {
    const result = new Float32Array(this.hiddenSize)

    // Sum of attention mask (number of real tokens)
    let maskSum = 0
    for (let i = 0; i < seqLen; i++) {
      maskSum += attentionMask[i]
    }

    // Avoid division by zero
    if (maskSum === 0) {
      maskSum = 1
    }

    // Compute weighted sum for each dimension
    for (let dim = 0; dim < this.hiddenSize; dim++) {
      let sum = 0
      for (let pos = 0; pos < seqLen; pos++) {
        // Get hidden state at [pos, dim]
        const value = hiddenStates[pos * this.hiddenSize + dim]
        // Weight by attention mask
        sum += value * attentionMask[pos]
      }
      // Mean pool
      result[dim] = sum / maskSum
    }

    return result
  }

  /**
   * L2 normalize embedding to unit length
   *
   * @param embedding - Input embedding
   * @returns Normalized embedding with ||x|| = 1
   */
  normalize(embedding: Float32Array): Float32Array {
    // Compute L2 norm
    let sumSquares = 0
    for (let i = 0; i < embedding.length; i++) {
      sumSquares += embedding[i] * embedding[i]
    }

    const norm = Math.sqrt(sumSquares)

    // Avoid division by zero
    if (norm === 0) {
      return embedding
    }

    // Normalize
    const result = new Float32Array(embedding.length)
    for (let i = 0; i < embedding.length; i++) {
      result[i] = embedding[i] / norm
    }

    return result
  }

  /**
   * Full post-processing pipeline: mean pool then normalize
   *
   * @param hiddenStates - Raw model output [seqLen * hiddenSize]
   * @param attentionMask - Attention mask [seqLen]
   * @param seqLen - Sequence length
   * @returns Final normalized embedding [hiddenSize]
   */
  process(
    hiddenStates: Float32Array,
    attentionMask: number[],
    seqLen: number
  ): Float32Array {
    const pooled = this.meanPool(hiddenStates, attentionMask, seqLen)
    return this.normalize(pooled)
  }

  /**
   * Process batch of embeddings
   *
   * @param hiddenStates - Raw model output [batchSize * seqLen * hiddenSize]
   * @param attentionMasks - Attention masks [batchSize][seqLen]
   * @param batchSize - Number of sequences in batch
   * @param seqLen - Sequence length (same for all in batch due to padding)
   * @returns Array of normalized embeddings
   */
  processBatch(
    hiddenStates: Float32Array,
    attentionMasks: number[][],
    batchSize: number,
    seqLen: number
  ): Float32Array[] {
    const results: Float32Array[] = []
    const sequenceSize = seqLen * this.hiddenSize

    for (let b = 0; b < batchSize; b++) {
      // Extract this sequence's hidden states
      const start = b * sequenceSize
      const seqHiddenStates = hiddenStates.slice(start, start + sequenceSize)

      // Process
      const embedding = this.process(seqHiddenStates, attentionMasks[b], seqLen)
      results.push(embedding)
    }

    return results
  }

  /**
   * Convert Float32Array to number array
   */
  toNumberArray(embedding: Float32Array): number[] {
    return Array.from(embedding)
  }
}

/**
 * Create a post-processor with default configuration
 */
export function createPostProcessor(): EmbeddingPostProcessor {
  return new EmbeddingPostProcessor(MODEL_CONSTANTS.HIDDEN_SIZE)
}
