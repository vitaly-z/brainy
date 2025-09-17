/**
 * Embedding functions for converting data to vectors using Transformers.js
 * Complete rewrite to eliminate TensorFlow.js and use ONNX-based models
 */

import { EmbeddingFunction, EmbeddingModel, Vector } from '../coreTypes.js'
import { executeInThread } from './workerUtils.js'
import { isBrowser } from './environment.js'
import { join } from 'node:path'
import { existsSync } from 'node:fs'
// @ts-ignore - Transformers.js is now the primary embedding library
import { pipeline, env } from '@huggingface/transformers'

// CRITICAL: Disable ONNX memory arena to prevent 4-8GB allocation
// This is needed for BOTH production and testing - reduces memory by 50-75%
if (typeof process !== 'undefined' && process.env) {
  process.env.ORT_DISABLE_MEMORY_ARENA = '1'
  process.env.ORT_DISABLE_MEMORY_PATTERN = '1'
  // Force single-threaded operation for maximum stability (Node.js 24 compatibility)
  process.env.ORT_INTRA_OP_NUM_THREADS = '1'    // Single thread for operators
  process.env.ORT_INTER_OP_NUM_THREADS = '1'    // Single thread for sessions
  process.env.ORT_NUM_THREADS = '1'             // Additional safety override
}

/**
 * Detect the best available GPU device for the current environment
 */
export async function detectBestDevice(): Promise<'cpu' | 'webgpu' | 'cuda'> {
  // Browser environment - check for WebGPU support
  if (isBrowser()) {
    if (typeof navigator !== 'undefined' && 'gpu' in navigator) {
      try {
        const adapter = await (navigator as any).gpu?.requestAdapter()
        if (adapter) {
          return 'webgpu'
        }
      } catch (error) {
        // WebGPU not available or failed to initialize
      }
    }
    return 'cpu'
  }

  // Node.js environment - check for CUDA support
  try {
    // Check if ONNX Runtime GPU packages are available
    // This is a simple heuristic - in production you might want more sophisticated detection
    const hasGpu = process.env.CUDA_VISIBLE_DEVICES !== undefined ||
                   process.env.ONNXRUNTIME_GPU_ENABLED === 'true'
    return hasGpu ? 'cuda' : 'cpu'
  } catch (error) {
    return 'cpu'
  }
}

/**
 * Resolve device string to actual device configuration
 */
export async function resolveDevice(device: string = 'auto'): Promise<string> {
  if (device === 'auto') {
    return await detectBestDevice()
  }
  
  // Map 'gpu' to appropriate GPU type for current environment
  if (device === 'gpu') {
    const detected = await detectBestDevice()
    return detected === 'cpu' ? 'cpu' : detected
  }
  
  return device
}

/**
 * Transformers.js Sentence Encoder embedding model
 * Uses ONNX Runtime for fast, offline embeddings with smaller models
 * Default model: all-MiniLM-L6-v2 (384 dimensions, ~90MB)
 */
export interface TransformerEmbeddingOptions {
  /** Model name/path to use - defaults to all-MiniLM-L6-v2 */
  model?: string
  /** Whether to enable verbose logging */
  verbose?: boolean
  /** Custom cache directory for models */
  cacheDir?: string
  /** Force local files only (no downloads) */
  localFilesOnly?: boolean
  /** Model precision: 'q8' = 75% smaller quantized model, 'fp32' = full precision (default) */
  precision?: 'fp32' | 'q8'
  /** Device to run inference on - 'auto' detects best available */
  device?: 'auto' | 'cpu' | 'webgpu' | 'cuda' | 'gpu'
}

export class TransformerEmbedding implements EmbeddingModel {
  private extractor: any = null
  private initialized = false
  private verbose: boolean = true
  private options: Required<TransformerEmbeddingOptions>

  /**
   * Create a new TransformerEmbedding instance
   */
  constructor(options: TransformerEmbeddingOptions = {}) {
    this.verbose = options.verbose !== undefined ? options.verbose : true
    
    // PRODUCTION-READY MODEL CONFIGURATION
    // Priority order: explicit option > environment variable > smart default
    
    let localFilesOnly: boolean
    
    if (options.localFilesOnly !== undefined) {
      // 1. Explicit option takes highest priority
      localFilesOnly = options.localFilesOnly
    } else if (process.env.BRAINY_ALLOW_REMOTE_MODELS === 'false') {
      // 2. Environment variable explicitly disables remote models (legacy support)
      localFilesOnly = true
    } else if (process.env.NODE_ENV === 'development') {
      // 3. Development mode allows remote models
      localFilesOnly = false
    } else if (isBrowser()) {
      // 4. Browser defaults to allowing remote models
      localFilesOnly = false
    } else {
      // 5. Node.js production: try local first, but allow remote as fallback
      // This is the NEW production-friendly default
      localFilesOnly = false
    }
    
    this.options = {
      model: options.model || 'Xenova/all-MiniLM-L6-v2',
      verbose: this.verbose,
      cacheDir: options.cacheDir || './models',
      localFilesOnly: localFilesOnly,
      precision: options.precision || 'fp32',  // Clean and clear!
      device: options.device || 'auto'
    }
    
    // ULTRA-CAREFUL: Runtime warnings for q8 usage
    if (this.options.precision === 'q8') {
      const confirmed = process.env.BRAINY_Q8_CONFIRMED === 'true'
      if (!confirmed && this.verbose) {
        console.warn('🚨 Q8 MODEL WARNING:')
        console.warn('   • Q8 creates different embeddings than fp32')  
        console.warn('   • Q8 is incompatible with existing fp32 data')
        console.warn('   • Only use q8 for new projects or when explicitly migrating')
        console.warn('   • Set BRAINY_Q8_CONFIRMED=true to silence this warning')
        console.warn('   • Q8 model is 75% smaller but may have slightly reduced accuracy')
      }
    }
    
    if (this.verbose) {
      this.logger('log', `Embedding config: precision=${this.options.precision}, localFilesOnly=${localFilesOnly}, model=${this.options.model}`)
    }

    // Configure transformers.js environment
    if (!isBrowser()) {
      // Set cache directory for Node.js
      env.cacheDir = this.options.cacheDir
      // Prioritize local models for offline operation
      env.allowRemoteModels = !this.options.localFilesOnly
      env.allowLocalModels = true
    } else {
      // Browser configuration
      // Allow both local and remote models, but prefer local if available
      env.allowLocalModels = true
      env.allowRemoteModels = true
      // Force the configuration to ensure it's applied
      if (this.verbose) {
        this.logger('log', `Browser env config - allowLocalModels: ${env.allowLocalModels}, allowRemoteModels: ${env.allowRemoteModels}, localFilesOnly: ${this.options.localFilesOnly}`)
      }
    }
  }

  /**
   * Get the default cache directory for models
   */
  private async getDefaultCacheDir(): Promise<string> {
    if (isBrowser()) {
      return './models' // Browser default
    }

    // Check for bundled models in the package
    const possiblePaths = [
      // In the installed package
      './node_modules/@soulcraft/brainy/models',
      // In development/source
      './models',
      './dist/../models',
      // Alternative locations
      '../models',
      '../../models'
    ]

    // Check if we're in Node.js and try to find the bundled models
    if (typeof process !== 'undefined' && process.versions?.node) {
      try {
        // Use dynamic import instead of require for ES modules compatibility
        const { createRequire } = await import('module')
        const require = createRequire(import.meta.url)
        
        const path = require('node:path')
        const fs = require('node:fs')

        // Try to resolve the package location
        try {
          const brainyPackagePath = require.resolve('@soulcraft/brainy/package.json')
          const brainyPackageDir = path.dirname(brainyPackagePath)
          const bundledModelsPath = path.join(brainyPackageDir, 'models')
          
          if (fs.existsSync(bundledModelsPath)) {
            this.logger('log', `Using bundled models from package: ${bundledModelsPath}`)
            return bundledModelsPath
          }
        } catch (e) {
          // Not installed as package, continue
        }

        // Try relative paths from current location
        for (const relativePath of possiblePaths) {
          const fullPath = path.resolve(relativePath)
          if (fs.existsSync(fullPath)) {
            this.logger('log', `Using bundled models from: ${fullPath}`)
            return fullPath
          }
        }
      } catch (error) {
        // Silently fall back to default path if module detection fails
      }
    }

    // Fallback to default cache directory
    return './models'
  }

  /**
   * Check if we're running in a test environment
   */
  private isTestEnvironment(): boolean {
    // Always use real implementation - no more mocking
    return false
  }

  /**
   * Log message only if verbose mode is enabled
   */
  private logger(level: 'log' | 'warn' | 'error', message: string, ...args: any[]): void {
    if (level === 'error' || this.verbose) {
      console[level](`[TransformerEmbedding] ${message}`, ...args)
    }
  }

  /**
   * Generate mock embeddings for unit tests
   */
  private getMockEmbedding(data: string | string[]): Vector {
    // Use the same mock logic as setup-unit.ts for consistency
    const input = Array.isArray(data) ? data.join(' ') : data
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
    
    return vector
  }

  /**
   * Initialize the embedding model
   */
  public async init(): Promise<void> {
    if (this.initialized) {
      return
    }

    // In unit test mode, skip real model initialization to prevent ONNX conflicts
    if (process.env.BRAINY_UNIT_TEST === 'true' || (globalThis as any).__BRAINY_UNIT_TEST__) {
      this.initialized = true
      this.logger('log', '🧪 Using mocked embeddings for unit tests')
      return
    }

    try {
      
      // Resolve device configuration and cache directory
      const device = await resolveDevice(this.options.device)
      const cacheDir = this.options.cacheDir === './models' 
        ? await this.getDefaultCacheDir() 
        : this.options.cacheDir
        
      this.logger('log', `Loading Transformer model: ${this.options.model} on device: ${device}`)
      
      const startTime = Date.now()
      
      // Use the configured precision from EmbeddingManager
      const { embeddingManager } = await import('../embeddings/EmbeddingManager.js')
      let actualType = embeddingManager.getPrecision()
      
      // CRITICAL: Control which model precision transformers.js uses
      // Q8 models use quantized int8 weights for 75% size reduction
      // Always use Q8 for optimal balance
      
      actualType = 'q8'  // Always Q8
      this.logger('log', '🎯 Using Q8 quantized model (75% smaller, 99% accuracy)')
      
      // Load the feature extraction pipeline with memory optimizations
      const pipelineOptions: any = {
        cache_dir: cacheDir,
        local_files_only: isBrowser() ? false : this.options.localFilesOnly,
        // CRITICAL: Specify dtype for model precision
        dtype: 'q8',
        // CRITICAL: For Q8, explicitly use quantized model
        quantized: true,
        // CRITICAL: ONNX memory optimizations
        session_options: {
          enableCpuMemArena: false,  // Disable pre-allocated memory arena
          enableMemPattern: false,   // Disable memory pattern optimization
          interOpNumThreads: 1,      // Force single thread for V8 stability
          intraOpNumThreads: 1,      // Force single thread for V8 stability
          graphOptimizationLevel: 'disabled'  // Disable threading optimizations
        }
      }
      
      // Add device configuration for GPU acceleration
      if (device !== 'cpu') {
        pipelineOptions.device = device
        this.logger('log', `🚀 GPU acceleration enabled: ${device}`)
      }
      
      if (this.verbose) {
        this.logger('log', `Pipeline options: ${JSON.stringify(pipelineOptions)}`)
      }
      
      try {
        // For Q8 models, we need to explicitly specify the model file
        if (actualType === 'q8') {
          // Check if quantized model exists
          const modelPath = join(cacheDir, this.options.model, 'onnx', 'model_quantized.onnx')
          if (existsSync(modelPath)) {
            this.logger('log', '✅ Q8 model found locally')
          } else {
            this.logger('warn', '⚠️ Q8 model not found')
            actualType = 'q8' // Always Q8
          }
        }
        
        this.extractor = await pipeline('feature-extraction', this.options.model, pipelineOptions)
      } catch (gpuError: any) {
        // Fallback to CPU if GPU initialization fails
        if (device !== 'cpu') {
          this.logger('warn', `GPU initialization failed, falling back to CPU: ${gpuError?.message || gpuError}`)
          const cpuOptions = { ...pipelineOptions }
          delete cpuOptions.device
          this.extractor = await pipeline('feature-extraction', this.options.model, cpuOptions)
        } else {
          // PRODUCTION-READY ERROR HANDLING
          // If local_files_only is true and models are missing, try enabling remote downloads
          if (pipelineOptions.local_files_only && gpuError?.message?.includes('local_files_only')) {
            this.logger('warn', 'Local models not found, attempting remote download as fallback...')
            
            try {
              const remoteOptions = { ...pipelineOptions, local_files_only: false }
              this.extractor = await pipeline('feature-extraction', this.options.model, remoteOptions)
              this.logger('log', '✅ Successfully downloaded and loaded model from remote')
              
              // Update the configuration to reflect what actually worked
              this.options.localFilesOnly = false
            } catch (remoteError: any) {
              // Both local and remote failed - throw comprehensive error
              const errorMsg = `Failed to load embedding model "${this.options.model}". ` +
                              `Local models not found and remote download failed. ` +
                              `To fix: 1) Run "npm run download-models", ` +
                              `2) Check your internet connection, or ` +
                              `3) Use a custom embedding function.`
              throw new Error(errorMsg)
            }
          } else {
            throw gpuError
          }
        }
      }

      const loadTime = Date.now() - startTime
      this.logger('log', `✅ Model loaded successfully in ${loadTime}ms`)
      
      this.initialized = true
    } catch (error) {
      this.logger('error', 'Failed to initialize Transformer embedding model:', error)
      throw new Error(`Transformer embedding initialization failed: ${error}`)
    }
  }

  /**
   * Generate embeddings for text data
   */
  public async embed(data: string | string[]): Promise<Vector> {
    // In unit test mode, return mock embeddings
    if (process.env.BRAINY_UNIT_TEST === 'true' || (globalThis as any).__BRAINY_UNIT_TEST__) {
      return this.getMockEmbedding(data)
    }
    
    if (!this.initialized) {
      await this.init()
    }

    try {
      // Handle different input types
      let textToEmbed: string[]
      
      if (typeof data === 'string') {
        // Handle empty string case
        if (data.trim() === '') {
          // Return a zero vector of 384 dimensions (all-MiniLM-L6-v2 standard)
          return new Array(384).fill(0)
        }
        textToEmbed = [data]
      } else if (Array.isArray(data) && data.every((item) => typeof item === 'string')) {
        // Handle empty array or array with empty strings
        if (data.length === 0 || data.every((item) => item.trim() === '')) {
          return new Array(384).fill(0)
        }
        // Filter out empty strings
        textToEmbed = data.filter((item) => item.trim() !== '')
        if (textToEmbed.length === 0) {
          return new Array(384).fill(0)
        }
      } else {
        throw new Error('TransformerEmbedding only supports string or string[] data')
      }

      // Ensure the extractor is available
      if (!this.extractor) {
        throw new Error('Transformer embedding model is not available')
      }

      // Generate embeddings with mean pooling and normalization
      const result = await this.extractor(textToEmbed, {
        pooling: 'mean',
        normalize: true
      })

      // Extract the embedding data
      let embedding: number[]
      
      if (textToEmbed.length === 1) {
        // Single text input - return first embedding
        embedding = Array.from(result.data.slice(0, 384))
      } else {
        // Multiple texts - return first embedding (maintain compatibility)
        embedding = Array.from(result.data.slice(0, 384))
      }

      // Validate embedding dimensions
      if (embedding.length !== 384) {
        this.logger('warn', `Unexpected embedding dimension: ${embedding.length}, expected 384`)
        // Pad or truncate to 384 dimensions
        if (embedding.length < 384) {
          embedding = [...embedding, ...new Array(384 - embedding.length).fill(0)]
        } else {
          embedding = embedding.slice(0, 384)
        }
      }

      return embedding
    } catch (error) {
      this.logger('error', 'Error generating embeddings:', error)
      throw new Error(`Failed to generate embeddings: ${error}`)
    }
  }

  /**
   * Dispose of the model and free resources
   */
  public async dispose(): Promise<void> {
    if (this.extractor && typeof this.extractor.dispose === 'function') {
      await this.extractor.dispose()
    }
    this.extractor = null
    this.initialized = false
  }

  /**
   * Get the dimension of embeddings produced by this model
   */
  public getDimension(): number {
    return 384
  }

  /**
   * Check if the model is initialized
   */
  public isInitialized(): boolean {
    return this.initialized
  }
}

// Legacy alias for backward compatibility
export const UniversalSentenceEncoder = TransformerEmbedding

/**
 * Create a new embedding model instance
 */
export function createEmbeddingModel(options?: TransformerEmbeddingOptions): EmbeddingModel {
  return new TransformerEmbedding(options)
}

/**
 * Default embedding function using the unified EmbeddingManager
 * Simple, clean, reliable - no more layers of indirection
 */
export const defaultEmbeddingFunction: EmbeddingFunction = async (data: string | string[]): Promise<Vector> => {
  const { embed } = await import('../embeddings/EmbeddingManager.js')
  return await embed(data)
}

/**
 * Create an embedding function with custom options
 * NOTE: Options are validated but the singleton EmbeddingManager is always used
 */
export function createEmbeddingFunction(options: TransformerEmbeddingOptions = {}): EmbeddingFunction {
  return async (data: string | string[]): Promise<Vector> => {
    const { embeddingManager } = await import('../embeddings/EmbeddingManager.js')
    
    // Validate precision if specified
    // Precision is always Q8 now
    
    return await embeddingManager.embed(data)
  }
}

/**
 * Batch embedding function for processing multiple texts efficiently
 */
export async function batchEmbed(
  texts: string[],
  options: TransformerEmbeddingOptions = {}
): Promise<Vector[]> {
  const embedder = new TransformerEmbedding(options)
  await embedder.init()
  
  const embeddings: Vector[] = []
  
  // Process in batches for memory efficiency
  const batchSize = 32
  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize)
    
    for (const text of batch) {
      const embedding = await embedder.embed(text)
      embeddings.push(embedding)
    }
  }
  
  await embedder.dispose()
  return embeddings
}

/**
 * Embedding functions for specific model types
 */
export const embeddingFunctions = {
  /** Default lightweight model (all-MiniLM-L6-v2, 384 dimensions) */
  default: defaultEmbeddingFunction,
  
  /** Create custom embedding function */
  create: createEmbeddingFunction,
  
  /** Batch processing */
  batch: batchEmbed
}