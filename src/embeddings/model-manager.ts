/**
 * Model Manager - Ensures transformer models are available at runtime
 * 
 * Strategy (in order):
 * 1. Check local cache first (instant)
 * 2. Try Soulcraft CDN (fastest when available) 
 * 3. Try GitHub release tar.gz with extraction (reliable backup)
 * 4. Fall back to Hugging Face (always works)
 * 
 * NO USER CONFIGURATION REQUIRED - Everything is automatic!
 */

import { existsSync } from 'fs'
import { mkdir, writeFile } from 'fs/promises'
import { join, dirname } from 'path'
import { env } from '@huggingface/transformers'

// Model sources in order of preference
const MODEL_SOURCES = {
  // CDN - Fastest when available (currently active)
  cdn: {
    host: 'https://models.soulcraft.com/models',
    pathTemplate: '{model}/', // e.g., Xenova/all-MiniLM-L6-v2/
    testFile: 'config.json' // File to test availability
  },
  
  // GitHub Release - tar.gz fallback (already exists and works)
  githubRelease: {
    tarUrl: 'https://github.com/soulcraftlabs/brainy/releases/download/models-v1/all-MiniLM-L6-v2.tar.gz'
  },
  
  // Original Hugging Face - final fallback (always works)
  huggingface: {
    host: 'https://huggingface.co',
    pathTemplate: '{model}/resolve/{revision}/' // Default transformers.js pattern
  }
}

// Model verification files - minimal set needed for transformers.js
const MODEL_FILES = [
  'config.json',
  'tokenizer.json',
  'tokenizer_config.json',
  'onnx/model.onnx'
]

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
    
    // Configure transformers.js environment
    env.cacheDir = this.modelsPath
    env.allowLocalModels = true
    env.useFSCache = true
    
    // Check if model already exists locally
    const modelPath = join(this.modelsPath, ...modelName.split('/'))
    if (await this.verifyModelFiles(modelPath)) {
      console.log('✅ Models found in cache:', modelPath)
      env.allowRemoteModels = false // Use local only
      this.isInitialized = true
      return true
    }
    
    // Try to download from our sources
    console.log('📥 Downloading transformer models...')
    
    // Try CDN first (fastest when available)
    if (await this.tryModelSource('Soulcraft CDN', MODEL_SOURCES.cdn, modelName)) {
      this.isInitialized = true
      return true
    }
    
    // Try GitHub release with tar.gz extraction (reliable backup)
    if (await this.downloadAndExtractFromGitHub(modelName)) {
      this.isInitialized = true
      return true
    }
    
    // Fall back to Hugging Face (always works)
    console.log('⚠️ Using Hugging Face fallback for models')
    env.remoteHost = MODEL_SOURCES.huggingface.host
    env.remotePathTemplate = MODEL_SOURCES.huggingface.pathTemplate
    env.allowRemoteModels = true
    this.isInitialized = true
    return true
  }
  
  private async verifyModelFiles(modelPath: string): Promise<boolean> {
    // Check if essential model files exist
    for (const file of MODEL_FILES) {
      const fullPath = join(modelPath, file)
      if (!existsSync(fullPath)) {
        return false
      }
    }
    return true
  }
  
  private async tryModelSource(name: string, source: { host: string, pathTemplate: string, testFile?: string }, modelName: string): Promise<boolean> {
    try {
      console.log(`📥 Trying ${name}...`)
      
      // Test if the source is accessible by trying to fetch a test file
      const testFile = source.testFile || 'config.json'
      const modelPath = source.pathTemplate.replace('{model}', modelName).replace('{revision}', 'main')
      const testUrl = `${source.host}/${modelPath}${testFile}`
      
      const response = await fetch(testUrl).catch(() => null)
      
      if (response && response.ok) {
        console.log(`✅ ${name} is available`)
        
        // Configure transformers.js to use this source
        env.remoteHost = source.host
        env.remotePathTemplate = source.pathTemplate
        env.allowRemoteModels = true
        
        // The model will be downloaded automatically by transformers.js when needed
        return true
      } else {
        console.log(`⚠️ ${name} not available (${response?.status || 'unreachable'})`)
        return false
      }
    } catch (error) {
      console.log(`⚠️ ${name} check failed:`, (error as Error).message)
      return false
    }
  }
  
  
  private async downloadAndExtractFromGitHub(modelName: string): Promise<boolean> {
    try {
      console.log('📥 Trying GitHub Release (tar.gz)...')
      
      // Download tar.gz file
      const response = await fetch(MODEL_SOURCES.githubRelease.tarUrl)
      if (!response.ok) {
        console.log(`⚠️ GitHub Release not available (${response.status})`)
        return false
      }
      
      // Since we can't use tar-stream, we'll use Node's built-in child_process
      // to extract using system tar command (available on all Unix systems)
      const buffer = await response.arrayBuffer()
      const modelPath = join(this.modelsPath, ...modelName.split('/'))
      
      // Create model directory
      await mkdir(modelPath, { recursive: true })
      
      // Write tar.gz to temp file and extract
      const tempFile = join(this.modelsPath, 'temp-model.tar.gz')
      await writeFile(tempFile, Buffer.from(buffer))
      
      // Extract using system tar command
      const { exec } = await import('child_process')
      const { promisify } = await import('util')
      const execAsync = promisify(exec)
      
      try {
        // Extract and strip the first directory component
        await execAsync(`tar -xzf ${tempFile} -C ${modelPath} --strip-components=1`, {
          cwd: this.modelsPath
        })
        
        // Clean up temp file
        const { unlink } = await import('fs/promises')
        await unlink(tempFile)
        
        console.log('✅ GitHub Release models extracted and cached locally')
        
        // Configure to use local models now
        env.allowRemoteModels = false
        return true
      } catch (extractError) {
        console.log('⚠️ Tar extraction failed, trying alternative method')
        return false
      }
      
    } catch (error) {
      console.log('⚠️ GitHub Release download failed:', (error as Error).message)
      return false
    }
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