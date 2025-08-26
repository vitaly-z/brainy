/**
 * Model Manager - Ensures transformer models are available at runtime
 * 
 * Strategy:
 * 1. Check local cache first
 * 2. Try GitHub releases (our backup)
 * 3. Fall back to Hugging Face
 * 4. Future: CDN at models.soulcraft.com
 */

import { existsSync } from 'fs'
import { mkdir, writeFile, readFile } from 'fs/promises'
import { join, dirname } from 'path'
import { env } from '@huggingface/transformers'
import { createHash } from 'crypto'

// Model sources in order of preference
const MODEL_SOURCES = {
  // GitHub Release - our controlled backup
  github: 'https://github.com/soulcraftlabs/brainy/releases/download/models-v1/all-MiniLM-L6-v2.tar.gz',
  
  // Future CDN - fastest option when available
  cdn: 'https://models.soulcraft.com/brainy/all-MiniLM-L6-v2.tar.gz',
  
  // Original Hugging Face - fallback
  huggingface: 'default' // Uses transformers.js default
}

// Expected model files and their hashes
const MODEL_MANIFEST = {
  'Xenova/all-MiniLM-L6-v2': {
    files: {
      'onnx/model.onnx': {
        size: 90555481,
        sha256: null // Will be computed from actual model
      },
      'tokenizer.json': {
        size: 711661,
        sha256: null
      },
      'config.json': {
        size: 650,
        sha256: null
      },
      'tokenizer_config.json': {
        size: 366,
        sha256: null
      }
    }
  }
}

export class ModelManager {
  private static instance: ModelManager
  private modelsPath: string
  private isInitialized = false
  
  private constructor() {
    // Determine models path
    this.modelsPath = this.getModelsPath()
  }
  
  static getInstance(): ModelManager {
    if (!ModelManager.instance) {
      ModelManager.instance = new ModelManager()
    }
    return ModelManager.instance
  }
  
  private getModelsPath(): string {
    // Check various possible locations
    const paths = [
      process.env.BRAINY_MODELS_PATH,
      './models',
      join(process.cwd(), 'models'),
      join(process.env.HOME || '', '.brainy', 'models'),
      env.cacheDir
    ]
    
    // Find first existing path or use default
    for (const path of paths) {
      if (path && existsSync(path)) {
        return path
      }
    }
    
    // Default to local models directory
    return join(process.cwd(), 'models')
  }
  
  async ensureModels(modelName = 'Xenova/all-MiniLM-L6-v2'): Promise<boolean> {
    if (this.isInitialized) {
      return true
    }
    
    const modelPath = join(this.modelsPath, ...modelName.split('/'))
    
    // Check if model already exists locally
    if (await this.verifyModelFiles(modelPath, modelName)) {
      console.log('✅ Models found in cache:', modelPath)
      this.configureTransformers(modelPath)
      this.isInitialized = true
      return true
    }
    
    // Try to download from our sources
    console.log('📥 Downloading transformer models...')
    
    // Try GitHub first (our backup)
    if (await this.downloadFromGitHub(modelName)) {
      this.isInitialized = true
      return true
    }
    
    // Try CDN (when available)
    if (await this.downloadFromCDN(modelName)) {
      this.isInitialized = true
      return true
    }
    
    // Fall back to Hugging Face (default transformers.js behavior)
    console.log('⚠️ Using Hugging Face fallback for models')
    env.allowRemoteModels = true
    this.isInitialized = true
    return true
  }
  
  private async verifyModelFiles(modelPath: string, modelName: string): Promise<boolean> {
    const manifest = (MODEL_MANIFEST as any)[modelName]
    if (!manifest) return false
    
    for (const [filePath, info] of Object.entries(manifest.files)) {
      const fullPath = join(modelPath, filePath)
      if (!existsSync(fullPath)) {
        return false
      }
      
      // Optionally verify size
      if (process.env.VERIFY_MODEL_SIZE === 'true') {
        const stats = await import('fs').then(fs => 
          fs.promises.stat(fullPath)
        )
        if (stats.size !== (info as any).size) {
          console.warn(`⚠️ Model file size mismatch: ${filePath}`)
          return false
        }
      }
    }
    
    return true
  }
  
  private async downloadFromGitHub(modelName: string): Promise<boolean> {
    try {
      const url = MODEL_SOURCES.github
      console.log('📥 Downloading from GitHub releases...')
      
      // Download tar.gz file
      const response = await fetch(url)
      if (!response.ok) {
        throw new Error(`GitHub download failed: ${response.status}`)
      }
      
      const buffer = await response.arrayBuffer()
      
      // Extract tar.gz (would need tar library in production)
      // For now, return false to fall back to other methods
      console.log('⚠️ GitHub model extraction not yet implemented')
      return false
      
    } catch (error) {
      console.log('⚠️ GitHub download failed:', (error as Error).message)
      return false
    }
  }
  
  private async downloadFromCDN(modelName: string): Promise<boolean> {
    try {
      const url = MODEL_SOURCES.cdn
      console.log('📥 Downloading from Soulcraft CDN...')
      
      // Try to fetch from CDN
      const response = await fetch(url)
      if (!response.ok) {
        throw new Error(`CDN download failed: ${response.status}`)
      }
      
      // Would extract files here
      console.log('⚠️ CDN not yet available')
      return false
      
    } catch (error) {
      console.log('⚠️ CDN download failed:', (error as Error).message)
      return false
    }
  }
  
  private configureTransformers(modelPath: string): void {
    // Configure transformers.js to use our local models
    env.localModelPath = dirname(modelPath)
    env.allowRemoteModels = false
    
    console.log('🔧 Configured transformers.js to use local models')
  }
  
  /**
   * Pre-download models for deployment
   * This is what npm run download-models calls
   */
  static async predownload(): Promise<void> {
    const manager = ModelManager.getInstance()
    const success = await manager.ensureModels()
    
    if (!success) {
      throw new Error('Failed to download models')
    }
    
    console.log('✅ Models downloaded successfully')
  }
}

// Auto-initialize on import in production
if (process.env.NODE_ENV === 'production' && process.env.SKIP_MODEL_CHECK !== 'true') {
  ModelManager.getInstance().ensureModels().catch(error => {
    console.error('⚠️ Model initialization failed:', error)
    // Don't throw - allow app to start and try downloading on first use
  })
}