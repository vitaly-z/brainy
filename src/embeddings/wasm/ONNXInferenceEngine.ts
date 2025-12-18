/**
 * ONNX Inference Engine
 *
 * Direct ONNX Runtime Web wrapper for running model inference.
 * Uses WASM backend for universal compatibility (Node.js, Bun, Browser).
 *
 * This replaces transformers.js dependency with direct ONNX control.
 */

import * as ort from 'onnxruntime-web'
import { InferenceConfig, MODEL_CONSTANTS } from './types.js'

// Configure ONNX Runtime for WASM-only
ort.env.wasm.numThreads = 1 // Single-threaded for stability
ort.env.wasm.simd = true // Enable SIMD where available

/**
 * ONNX Inference Engine using onnxruntime-web
 */
export class ONNXInferenceEngine {
  private session: ort.InferenceSession | null = null
  private initialized = false
  private modelPath: string
  private config: InferenceConfig

  constructor(config: Partial<InferenceConfig> = {}) {
    this.modelPath = config.modelPath ?? ''
    this.config = {
      modelPath: this.modelPath,
      numThreads: config.numThreads ?? 1,
      enableSimd: config.enableSimd ?? true,
      enableCpuMemArena: config.enableCpuMemArena ?? false,
    }
  }

  /**
   * Initialize the ONNX session
   */
  async initialize(modelPath?: string): Promise<void> {
    if (this.initialized && this.session) {
      return
    }

    const path = modelPath ?? this.modelPath
    if (!path) {
      throw new Error('Model path is required')
    }

    try {
      // Configure session options
      const sessionOptions: ort.InferenceSession.SessionOptions = {
        executionProviders: ['wasm'],
        graphOptimizationLevel: 'all',
        enableCpuMemArena: this.config.enableCpuMemArena,
        // Additional WASM-specific options
        executionMode: 'sequential',
      }

      // Load model from file path or URL
      this.session = await ort.InferenceSession.create(path, sessionOptions)

      this.initialized = true
    } catch (error) {
      this.initialized = false
      this.session = null
      throw new Error(
        `Failed to initialize ONNX session: ${error instanceof Error ? error.message : String(error)}`
      )
    }
  }

  /**
   * Run inference on tokenized input
   *
   * @param inputIds - Token IDs [batchSize, seqLen]
   * @param attentionMask - Attention mask [batchSize, seqLen]
   * @param tokenTypeIds - Token type IDs [batchSize, seqLen] (optional, defaults to zeros)
   * @returns Hidden states [batchSize, seqLen, hiddenSize]
   */
  async infer(
    inputIds: number[][],
    attentionMask: number[][],
    tokenTypeIds?: number[][]
  ): Promise<Float32Array> {
    if (!this.session) {
      throw new Error('Session not initialized. Call initialize() first.')
    }

    const batchSize = inputIds.length
    const seqLen = inputIds[0].length

    // Convert to BigInt64Array (ONNX int64 type)
    const inputIdsFlat = new BigInt64Array(batchSize * seqLen)
    const attentionMaskFlat = new BigInt64Array(batchSize * seqLen)
    const tokenTypeIdsFlat = new BigInt64Array(batchSize * seqLen)

    for (let b = 0; b < batchSize; b++) {
      for (let s = 0; s < seqLen; s++) {
        const idx = b * seqLen + s
        inputIdsFlat[idx] = BigInt(inputIds[b][s])
        attentionMaskFlat[idx] = BigInt(attentionMask[b][s])
        tokenTypeIdsFlat[idx] = tokenTypeIds
          ? BigInt(tokenTypeIds[b][s])
          : BigInt(0)
      }
    }

    // Create ONNX tensors
    const inputIdsTensor = new ort.Tensor('int64', inputIdsFlat, [batchSize, seqLen])
    const attentionMaskTensor = new ort.Tensor('int64', attentionMaskFlat, [batchSize, seqLen])
    const tokenTypeIdsTensor = new ort.Tensor('int64', tokenTypeIdsFlat, [batchSize, seqLen])

    try {
      // Run inference
      const feeds = {
        input_ids: inputIdsTensor,
        attention_mask: attentionMaskTensor,
        token_type_ids: tokenTypeIdsTensor,
      }

      const results = await this.session.run(feeds)

      // Extract last_hidden_state (the output we need for mean pooling)
      // Model outputs: last_hidden_state [batch, seq, hidden] and pooler_output [batch, hidden]
      const output = results.last_hidden_state ?? results.token_embeddings

      if (!output) {
        throw new Error('Model did not return expected output tensor')
      }

      return output.data as Float32Array
    } finally {
      // Dispose tensors to free memory
      inputIdsTensor.dispose()
      attentionMaskTensor.dispose()
      tokenTypeIdsTensor.dispose()
    }
  }

  /**
   * Infer single sequence (convenience method)
   */
  async inferSingle(
    inputIds: number[],
    attentionMask: number[],
    tokenTypeIds?: number[]
  ): Promise<Float32Array> {
    return this.infer(
      [inputIds],
      [attentionMask],
      tokenTypeIds ? [tokenTypeIds] : undefined
    )
  }

  /**
   * Check if initialized
   */
  isInitialized(): boolean {
    return this.initialized
  }

  /**
   * Get model input/output names (for debugging)
   */
  getModelInfo(): { inputs: readonly string[]; outputs: readonly string[] } | null {
    if (!this.session) {
      return null
    }

    return {
      inputs: this.session.inputNames,
      outputs: this.session.outputNames,
    }
  }

  /**
   * Dispose of the session and free resources
   */
  async dispose(): Promise<void> {
    if (this.session) {
      // Release the session
      this.session = null
    }
    this.initialized = false
  }
}

/**
 * Create an inference engine with default configuration
 */
export function createInferenceEngine(modelPath: string): ONNXInferenceEngine {
  return new ONNXInferenceEngine({ modelPath })
}
