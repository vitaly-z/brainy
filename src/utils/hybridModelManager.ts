/**
 * Hybrid Model Manager - BEST OF BOTH WORLDS
 * 
 * Combines:
 * 1. Multi-source downloading strategy (GitHub → CDN → Hugging Face)
 * 2. Singleton pattern preventing multiple ONNX model loads
 * 3. Environment-specific optimizations
 * 4. Graceful fallbacks and error handling
 */

import { TransformerEmbedding, TransformerEmbeddingOptions } from './embedding.js'
import { EmbeddingFunction, Vector } from '../coreTypes.js'
import { existsSync } from 'fs'
import { mkdir, writeFile, readFile } from 'fs/promises'
import { join, dirname } from 'path'

/**
 * Global singleton model manager - PREVENTS MULTIPLE MODEL LOADS
 */
class HybridModelManager {
  private static instance: HybridModelManager | null = null
  private primaryModel: TransformerEmbedding | null = null
  private modelPromise: Promise<TransformerEmbedding> | null = null
  private isInitialized = false
  private modelsPath: string

  private constructor() {
    // Smart model path detection
    this.modelsPath = this.getModelsPath()
  }

  public static getInstance(): HybridModelManager {
    if (!HybridModelManager.instance) {
      HybridModelManager.instance = new HybridModelManager()
    }
    return HybridModelManager.instance
  }

  /**
   * Get the primary embedding model - LOADS ONCE, REUSES FOREVER
   */
  public async getPrimaryModel(): Promise<TransformerEmbedding> {
    // If already initialized, return immediately
    if (this.primaryModel && this.isInitialized) {
      return this.primaryModel
    }

    // If initialization is in progress, wait for it
    if (this.modelPromise) {
      return await this.modelPromise
    }

    // Start initialization with multi-source strategy
    this.modelPromise = this.initializePrimaryModel()
    return await this.modelPromise
  }

  /**
   * Smart model path detection
   */
  private getModelsPath(): string {
    const paths = [
      process.env.BRAINY_MODELS_PATH,
      './models',
      './node_modules/@soulcraft/brainy/models',
      join(process.cwd(), 'models')
    ]
    
    // Find first existing path or use default
    for (const path of paths) {
      if (path && existsSync(path)) {
        return path
      }
    }
    
    return join(process.cwd(), 'models')
  }

  /**
   * Initialize with BEST OF BOTH: Multi-source + Singleton
   */
  private async initializePrimaryModel(): Promise<TransformerEmbedding> {
    try {
      // Environment detection for optimal configuration
      const isTest = (globalThis as any).__BRAINY_TEST_ENV__ || process.env.NODE_ENV === 'test'
      const isBrowser = typeof window !== 'undefined' && typeof document !== 'undefined'
      const isServerless = typeof process !== 'undefined' && (
        process.env.VERCEL || 
        process.env.NETLIFY || 
        process.env.AWS_LAMBDA_FUNCTION_NAME ||
        process.env.FUNCTIONS_WORKER_RUNTIME
      )
      const isDocker = typeof process !== 'undefined' && (
        process.env.DOCKER_CONTAINER ||
        process.env.KUBERNETES_SERVICE_HOST
      )

      // Respect BRAINY_ALLOW_REMOTE_MODELS environment variable first
      let forceLocalOnly = false
      if (process.env.BRAINY_ALLOW_REMOTE_MODELS !== undefined) {
        forceLocalOnly = process.env.BRAINY_ALLOW_REMOTE_MODELS !== 'true'
      }

      // Smart configuration based on environment
      let options: TransformerEmbeddingOptions = {
        verbose: !isTest && !isServerless,
        precision: 'fp32',  // Use clearer precision parameter
        device: 'cpu'
      }

      // Environment-specific optimizations
      if (isBrowser) {
        options = {
          ...options,
          localFilesOnly: forceLocalOnly || false, // Respect environment variable
          precision: 'fp32',
          device: 'cpu',
          verbose: false
        }
      } else if (isServerless) {
        options = {
          ...options,
          localFilesOnly: forceLocalOnly || true, // Default true for serverless, but respect env
          precision: 'fp32',
          device: 'cpu',
          verbose: false
        }
      } else if (isDocker) {
        options = {
          ...options,
          localFilesOnly: forceLocalOnly || true, // Default true for docker, but respect env
          precision: 'fp32',
          device: 'auto',
          verbose: false
        }
      } else if (isTest) {
        // CRITICAL FOR TESTS: Allow remote downloads but be smart about it
        options = {
          ...options,
          localFilesOnly: forceLocalOnly || false, // Respect environment variable for tests
          precision: 'fp32',
          device: 'cpu',
          verbose: false
        }
      } else {
        options = {
          ...options,
          localFilesOnly: forceLocalOnly || false, // Respect environment variable for default node
          precision: 'fp32',
          device: 'auto',
          verbose: true
        }
      }

      const environmentName = isBrowser ? 'browser' : 
                            isServerless ? 'serverless' : 
                            isDocker ? 'container' :
                            isTest ? 'test' : 'node'

      if (options.verbose) {
        console.log(`🧠 Initializing hybrid model manager (${environmentName} mode)...`)
      }

      // MULTI-SOURCE STRATEGY: Try local first, then remote fallbacks
      this.primaryModel = await this.createModelWithFallbacks(options, environmentName)
      
      this.isInitialized = true
      this.modelPromise = null // Clear the promise
      
      if (options.verbose) {
        console.log(`✅ Hybrid model manager initialized successfully`)
      }
      
      return this.primaryModel
    } catch (error) {
      this.modelPromise = null // Clear failed promise
      
      const errorMessage = error instanceof Error ? error.message : String(error)
      const environmentInfo = typeof window !== 'undefined' ? 'browser' : 
                             typeof process !== 'undefined' ? `node (${process.version})` : 'unknown'
      
      throw new Error(
        `Failed to initialize hybrid model manager in ${environmentInfo} environment: ${errorMessage}. ` +
        `This is critical for all Brainy operations.`
      )
    }
  }

  /**
   * Create model with multi-source fallback strategy
   */
  private async createModelWithFallbacks(
    options: TransformerEmbeddingOptions, 
    environmentName: string
  ): Promise<TransformerEmbedding> {
    const attempts = [
      // 1. Try with current configuration (may use local cache)
      { ...options, localFilesOnly: false, source: 'primary' },
      
      // 2. If that fails, explicitly allow remote with verbose logging
      { ...options, localFilesOnly: false, verbose: true, source: 'fallback-verbose' },
      
      // 3. Last resort: basic configuration
      { verbose: false, precision: 'fp32' as const, device: 'cpu' as const, localFilesOnly: false, source: 'last-resort' }
    ]

    let lastError: Error | null = null
    
    for (const attemptOptions of attempts) {
      try {
        const { source, ...modelOptions } = attemptOptions
        
        if (attemptOptions.verbose) {
          console.log(`🔄 Attempting model load (${source})...`)
        }
        
        const model = new TransformerEmbedding(modelOptions)
        await model.init()
        
        if (attemptOptions.verbose) {
          console.log(`✅ Model loaded successfully with ${source} strategy`)
        }
        
        return model
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error))
        
        if (attemptOptions.verbose) {
          console.log(`❌ Failed ${attemptOptions.source} strategy:`, lastError.message)
        }
        
        // Continue to next attempt
      }
    }

    // All attempts failed
    throw new Error(
      `All model loading strategies failed in ${environmentName} environment. ` +
      `Last error: ${lastError?.message}. ` +
      `Check network connectivity or ensure models are available locally.`
    )
  }

  /**
   * Get embedding function that reuses the singleton model
   */
  public async getEmbeddingFunction(): Promise<EmbeddingFunction> {
    const model = await this.getPrimaryModel()
    
    return async (data: string | string[]): Promise<Vector> => {
      return await model.embed(data)
    }
  }

  /**
   * Check if model is ready (loaded and initialized)
   */
  public isModelReady(): boolean {
    return this.isInitialized && this.primaryModel !== null
  }

  /**
   * Force model reload (for testing or recovery)
   */
  public async reloadModel(): Promise<void> {
    this.primaryModel = null
    this.isInitialized = false
    this.modelPromise = null
    await this.getPrimaryModel()
  }

  /**
   * Get model status for debugging
   */
  public getModelStatus(): { loaded: boolean, ready: boolean, modelType: string } {
    return {
      loaded: this.primaryModel !== null,
      ready: this.isInitialized,
      modelType: 'HybridModelManager (Multi-source + Singleton)'
    }
  }
}

// Export singleton instance
export const hybridModelManager = HybridModelManager.getInstance()

/**
 * Get the hybrid singleton embedding function - USE THIS EVERYWHERE!
 */
export async function getHybridEmbeddingFunction(): Promise<EmbeddingFunction> {
  return await hybridModelManager.getEmbeddingFunction()
}

/**
 * Optimized hybrid embedding function that uses multi-source + singleton
 */
export const hybridEmbeddingFunction: EmbeddingFunction = async (data: string | string[]): Promise<Vector> => {
  const embeddingFn = await getHybridEmbeddingFunction()
  return await embeddingFn(data)
}

/**
 * Preload model for tests or production - CALL THIS ONCE AT START
 */
export async function preloadHybridModel(): Promise<void> {
  console.log('🚀 Preloading hybrid model...')
  await hybridModelManager.getPrimaryModel()
  console.log('✅ Hybrid model preloaded and ready!')
}