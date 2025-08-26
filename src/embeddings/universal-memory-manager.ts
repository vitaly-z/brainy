/**
 * Universal Memory Manager for Embeddings
 * 
 * Works in ALL environments: Node.js, browsers, serverless, workers
 * Solves transformers.js memory leak with environment-specific strategies
 */

import { Vector, EmbeddingFunction } from '../coreTypes.js'

// Environment detection
const isNode = typeof process !== 'undefined' && process.versions?.node
const isBrowser = typeof window !== 'undefined' && typeof document !== 'undefined'
const isServerless = typeof process !== 'undefined' && (
  process.env.VERCEL || 
  process.env.NETLIFY || 
  process.env.AWS_LAMBDA_FUNCTION_NAME ||
  process.env.FUNCTIONS_WORKER_RUNTIME
)

interface MemoryStats {
  embeddings: number
  memoryUsage: string
  restarts: number
  strategy: string
}

export class UniversalMemoryManager {
  private embeddingFunction: any = null
  private embedCount = 0
  private restartCount = 0
  private lastRestart = 0
  private strategy: string
  private maxEmbeddings: number
  
  constructor() {
    // Choose strategy based on environment
    if (isServerless) {
      this.strategy = 'serverless-restart'
      this.maxEmbeddings = 50  // Restart frequently in serverless
    } else if (isNode && !isBrowser) {
      this.strategy = 'node-worker'
      this.maxEmbeddings = 100 // Worker can handle more
    } else if (isBrowser) {
      this.strategy = 'browser-dispose'
      this.maxEmbeddings = 25  // Browser memory is limited
    } else {
      this.strategy = 'fallback-dispose'
      this.maxEmbeddings = 75
    }
    
    console.log(`🧠 Universal Memory Manager: Using ${this.strategy} strategy`)
  }
  
  async getEmbeddingFunction(): Promise<EmbeddingFunction> {
    return async (data: string | string[]): Promise<Vector> => {
      return this.embed(data)
    }
  }
  
  async embed(data: string | string[]): Promise<Vector> {
    // Check if we need to restart/cleanup
    await this.checkMemoryLimits()
    
    // Ensure embedding function is available
    await this.ensureEmbeddingFunction()
    
    // Perform embedding
    const result = await this.embeddingFunction.embed(data)
    this.embedCount++
    
    return result
  }
  
  private async checkMemoryLimits(): Promise<void> {
    if (this.embedCount >= this.maxEmbeddings) {
      console.log(`🔄 Memory cleanup: ${this.embedCount} embeddings processed`)
      await this.cleanup()
    }
  }
  
  private async ensureEmbeddingFunction(): Promise<void> {
    if (this.embeddingFunction) {
      return
    }
    
    switch (this.strategy) {
      case 'node-worker':
        await this.initNodeWorker()
        break
        
      case 'serverless-restart':
        await this.initServerless()
        break
        
      case 'browser-dispose':
        await this.initBrowser()
        break
        
      default:
        await this.initFallback()
    }
  }
  
  private async initNodeWorker(): Promise<void> {
    if (isNode) {
      try {
        // Try to use worker threads if available
        const { workerEmbeddingManager } = await import('./worker-manager.js')
        this.embeddingFunction = workerEmbeddingManager
        console.log('✅ Using Node.js worker threads for embeddings')
      } catch (error) {
        console.warn('⚠️ Worker threads not available, falling back to direct embedding')
        console.warn('Error:', error instanceof Error ? error.message : String(error))
        await this.initDirect()
      }
    }
  }
  
  private async initServerless(): Promise<void> {
    // In serverless, use direct embedding but restart more aggressively
    await this.initDirect()
    console.log('✅ Using serverless strategy with aggressive cleanup')
  }
  
  private async initBrowser(): Promise<void> {
    // In browser, use direct embedding with disposal
    await this.initDirect()
    console.log('✅ Using browser strategy with disposal')
  }
  
  private async initFallback(): Promise<void> {
    await this.initDirect()
    console.log('✅ Using fallback direct embedding strategy')
  }
  
  private async initDirect(): Promise<void> {
    try {
      // Dynamic import to handle different environments
      const { TransformerEmbedding } = await import('../utils/embedding.js')
      
      this.embeddingFunction = new TransformerEmbedding({
        verbose: false,
        dtype: 'q8',
        localFilesOnly: process.env.BRAINY_ALLOW_REMOTE_MODELS !== 'true'
      })
      
      await this.embeddingFunction.init()
      console.log('✅ Direct embedding function initialized')
    } catch (error) {
      throw new Error(`Failed to initialize embedding function: ${error instanceof Error ? error.message : String(error)}`)
    }
  }
  
  private async cleanup(): Promise<void> {
    const startTime = Date.now()
    
    try {
      // Strategy-specific cleanup
      switch (this.strategy) {
        case 'node-worker':
          if (this.embeddingFunction?.forceRestart) {
            await this.embeddingFunction.forceRestart()
          }
          break
          
        case 'serverless-restart':
          // In serverless, create new instance
          if (this.embeddingFunction?.dispose) {
            this.embeddingFunction.dispose()
          }
          this.embeddingFunction = null
          break
          
        case 'browser-dispose':
          // In browser, try disposal
          if (this.embeddingFunction?.dispose) {
            this.embeddingFunction.dispose()
          }
          // Force garbage collection if available
          if (typeof window !== 'undefined' && (window as any).gc) {
            (window as any).gc()
          }
          break
          
        default:
          // Fallback: dispose and recreate
          if (this.embeddingFunction?.dispose) {
            this.embeddingFunction.dispose()
          }
          this.embeddingFunction = null
      }
      
      this.embedCount = 0
      this.restartCount++
      this.lastRestart = Date.now()
      
      const cleanupTime = Date.now() - startTime
      console.log(`🧹 Memory cleanup completed in ${cleanupTime}ms (strategy: ${this.strategy})`)
      
    } catch (error) {
      console.warn('⚠️ Cleanup failed:', error instanceof Error ? error.message : String(error))
      // Force null assignment as last resort
      this.embeddingFunction = null
    }
  }
  
  getMemoryStats(): MemoryStats {
    let memoryUsage = 'unknown'
    
    // Get memory stats based on environment
    if (isNode && typeof process !== 'undefined') {
      const mem = process.memoryUsage()
      memoryUsage = `${(mem.heapUsed / 1024 / 1024).toFixed(2)} MB`
    } else if (isBrowser && (performance as any).memory) {
      const mem = (performance as any).memory
      memoryUsage = `${(mem.usedJSHeapSize / 1024 / 1024).toFixed(2)} MB`
    }
    
    return {
      embeddings: this.embedCount,
      memoryUsage,
      restarts: this.restartCount,
      strategy: this.strategy
    }
  }
  
  async dispose(): Promise<void> {
    if (this.embeddingFunction) {
      if (this.embeddingFunction.dispose) {
        await this.embeddingFunction.dispose()
      }
      this.embeddingFunction = null
    }
  }
}

// Export singleton instance
export const universalMemoryManager = new UniversalMemoryManager()

// Export convenience function
export async function getUniversalEmbeddingFunction(): Promise<EmbeddingFunction> {
  return universalMemoryManager.getEmbeddingFunction()
}

// Export memory stats function
export function getEmbeddingMemoryStats(): MemoryStats {
  return universalMemoryManager.getMemoryStats()
}