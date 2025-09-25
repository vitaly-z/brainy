/**
 * Unified Embedding Manager
 * 
 * THE single source of truth for all embedding operations in Brainy.
 * Combines model management, precision configuration, and embedding generation
 * into one clean, maintainable class.
 * 
 * Features:
 * - Singleton pattern ensures ONE model instance
 * - Automatic Q8 (default) or FP32 precision
 * - Model downloading and caching
 * - Thread-safe initialization
 * - Memory monitoring
 * 
 * This replaces: SingletonModelManager, TransformerEmbedding, ModelPrecisionManager,
 * hybridModelManager, universalMemoryManager, and more.
 */

import { Vector, EmbeddingFunction } from '../coreTypes.js'
import { pipeline, env } from '@huggingface/transformers'
import { isNode } from '../utils/environment.js'

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
 */
export class EmbeddingManager {
  private model: any = null
  private precision: ModelPrecision
  private modelName = 'Xenova/all-MiniLM-L6-v2'
  private initialized = false
  private initTime: number | null = null
  private embedCount = 0
  private locked = false
  
  private constructor() {
    // Always use Q8 for optimal size/performance (99% accuracy, 75% smaller)
    this.precision = 'q8'
    console.log(`🎯 EmbeddingManager: Using Q8 precision`)
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
    const isTestMode = process.env.BRAINY_UNIT_TEST === 'true' || (globalThis as any).__BRAINY_UNIT_TEST__
    
    if (isTestMode) {
      // Production safeguard: Warn if mock mode is active but NODE_ENV is production
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
    if (this.initialized && this.model) {
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
    console.log(`🚀 Initializing embedding model (${this.precision.toUpperCase()})...`)
    
    try {
      // Configure transformers.js environment
      const modelsPath = this.getModelsPath()
      env.cacheDir = modelsPath
      env.allowLocalModels = true
      env.useFSCache = true

      // Check if models exist locally (only in Node.js)
      if (isNode()) {
        try {
          const nodeRequire = typeof require !== 'undefined' ? require : null
          if (nodeRequire) {
            const path = nodeRequire('node:path')
            const fs = nodeRequire('node:fs')
            const modelPath = path.join(modelsPath, ...this.modelName.split('/'))
            const hasLocalModels = fs.existsSync(modelPath)

            if (hasLocalModels) {
              console.log('✅ Using cached models from:', modelPath)
            }
          }
        } catch {
          // Silently continue if require fails
        }
      }
      
      // Configure pipeline options for the selected precision
      const pipelineOptions: any = {
        cache_dir: modelsPath,
        local_files_only: false,
        // Always use Q8 precision
        dtype: 'q8',
        quantized: true,
        // Memory optimizations
        session_options: {
          enableCpuMemArena: false,
          enableMemPattern: false,
          interOpNumThreads: 1,
          intraOpNumThreads: 1,
          graphOptimizationLevel: 'disabled'
        }
      }
      
      // Load the model
      this.model = await pipeline('feature-extraction', this.modelName, pipelineOptions)
      
      // Lock precision after successful initialization
      this.locked = true
      this.initialized = true
      this.initTime = Date.now() - startTime
      
      // Log success
      const memoryMB = this.getMemoryUsage()
      console.log(`✅ Model loaded in ${this.initTime}ms`)
      console.log(`📊 Precision: Q8 | Memory: ${memoryMB}MB`)
      console.log(`🔒 Configuration locked`)
      
    } catch (error) {
      this.initialized = false
      this.model = null
      throw new Error(`Failed to initialize embedding model: ${error instanceof Error ? error.message : String(error)}`)
    }
  }
  
  /**
   * Generate embeddings
   */
  async embed(text: string | string[]): Promise<Vector> {
    // Check for unit test environment - use mocks to prevent ONNX conflicts
    const isTestMode = process.env.BRAINY_UNIT_TEST === 'true' || (globalThis as any).__BRAINY_UNIT_TEST__

    if (isTestMode) {
      // Production safeguard
      if (process.env.NODE_ENV === 'production') {
        throw new Error('CRITICAL: Mock embeddings in production!')
      }
      return this.getMockEmbedding(text)
    }

    // Ensure initialized
    await this.init()

    if (!this.model) {
      throw new Error('Model not initialized')
    }

    // CRITICAL FIX: Ensure input is always a string
    let input: string
    if (Array.isArray(text)) {
      // Join array elements, converting each to string first
      input = text.map(t => typeof t === 'string' ? t : String(t)).join(' ')
    } else if (typeof text === 'string') {
      input = text
    } else {
      // This shouldn't happen but let's be defensive
      console.warn('EmbeddingManager.embed received non-string input:', typeof text)
      input = String(text)
    }
    
    // Generate embedding
    const output = await this.model(input, {
      pooling: 'mean',
      normalize: true
    })
    
    // Extract embedding vector
    const embedding = Array.from(output.data) as number[]
    
    // Validate dimensions
    if (embedding.length !== 384) {
      console.warn(`Unexpected embedding dimension: ${embedding.length}`)
      // Pad or truncate
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
  private getMockEmbedding(text: string | string[]): Vector {
    // Use the same mock logic as setup-unit.ts for consistency
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
    
    // Track mock embedding count
    this.embedCount++
    return vector
  }
  
  /**
   * Get embedding function for compatibility
   */
  getEmbeddingFunction(): EmbeddingFunction {
    return async (data: string | string[]): Promise<Vector> => {
      return await this.embed(data)
    }
  }
  
  
  /**
   * Get models directory path
   * Note: In browser environments, returns a simple default path
   * In Node.js, checks multiple locations for the models directory
   */
  private getModelsPath(): string {
    // In browser environments, use a default path
    if (!isNode()) {
      return './models'
    }

    // Node.js-specific model path resolution
    // Cache the result for performance
    if (!this.modelsPathCache) {
      this.modelsPathCache = this.resolveModelsPathSync()
    }
    return this.modelsPathCache
  }

  private modelsPathCache: string | null = null

  private resolveModelsPathSync(): string {
    // For Node.js environments, we can safely assume these modules exist
    // TypeScript will handle the imports at build time
    // At runtime, these will only be called if isNode() is true

    // Default fallback path
    const defaultPath = './models'

    try {
      // Create a conditional require function that only works in Node
      const nodeRequire = typeof require !== 'undefined' ? require : null
      if (!nodeRequire) return defaultPath

      const fs = nodeRequire('node:fs')
      const path = nodeRequire('node:path')

      const paths = [
        process.env.BRAINY_MODELS_PATH,
        './models',
        path.join(process.cwd(), 'models'),
        path.join(process.env.HOME || '', '.brainy', 'models')
      ]

      for (const p of paths) {
        if (p && fs.existsSync(p)) {
          return p
        }
      }

      // Default Node.js path
      return path.join(process.cwd(), 'models')
    } catch {
      // Fallback if require fails
      return defaultPath
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
    return {
      initialized: this.initialized,
      precision: this.precision,
      modelName: this.modelName,
      embedCount: this.embedCount,
      initTime: this.initTime,
      memoryMB: this.getMemoryUsage()
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
export async function embed(text: string | string[]): Promise<Vector> {
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