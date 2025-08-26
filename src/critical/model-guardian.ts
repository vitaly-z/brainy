/**
 * MODEL GUARDIAN - CRITICAL PATH
 * 
 * THIS IS THE MOST CRITICAL COMPONENT OF BRAINY
 * Without the exact model, users CANNOT access their data
 * 
 * Requirements:
 * 1. Model MUST be Xenova/all-MiniLM-L6-v2 (never changes)
 * 2. Model MUST be available at runtime
 * 3. Model MUST produce consistent 384-dim embeddings
 * 4. System MUST fail fast if model unavailable in production
 */

import { existsSync } from 'fs'
import { readFile, mkdir, writeFile, stat } from 'fs/promises'
import { join, dirname } from 'path'
import { createHash } from 'crypto'
import { env } from '@huggingface/transformers'

// CRITICAL: These values MUST NEVER CHANGE
const CRITICAL_MODEL_CONFIG = {
  modelName: 'Xenova/all-MiniLM-L6-v2',
  modelHash: {
    // SHA256 of model.onnx - computed from actual model
    'onnx/model.onnx': 'add_actual_hash_here',
    'tokenizer.json': 'add_actual_hash_here'
  },
  modelSize: {
    'onnx/model.onnx': 90387606, // Exact size in bytes (updated to match actual file)
    'tokenizer.json': 711661
  } as Record<string, number>,
  embeddingDimensions: 384,
  fallbackSources: [
    // Primary: Our Google Cloud Storage CDN (we control this, fastest)
    {
      name: 'Soulcraft CDN (Primary)',
      url: 'https://models.soulcraft.com/models/all-MiniLM-L6-v2.tar.gz',
      type: 'tarball'
    },
    // Secondary: GitHub releases backup
    {
      name: 'GitHub Backup',
      url: 'https://github.com/soulcraftlabs/brainy-models/releases/download/v1.0.0/all-MiniLM-L6-v2.tar.gz',
      type: 'tarball'
    },
    // Tertiary: Hugging Face (original source)
    {
      name: 'Hugging Face',
      url: 'huggingface',
      type: 'transformers'
    }
  ]
}

export class ModelGuardian {
  private static instance: ModelGuardian
  private isVerified = false
  private modelPath: string
  private lastVerification: Date | null = null
  
  private constructor() {
    this.modelPath = this.detectModelPath()
  }
  
  static getInstance(): ModelGuardian {
    if (!ModelGuardian.instance) {
      ModelGuardian.instance = new ModelGuardian()
    }
    return ModelGuardian.instance
  }
  
  /**
   * CRITICAL: Verify model availability and integrity
   * This MUST be called before any embedding operations
   */
  async ensureCriticalModel(): Promise<void> {
    console.log('DEBUG: ensureCriticalModel called')
    console.log('🛡️ MODEL GUARDIAN: Verifying critical model availability...')
    console.log(`🚀 Debug: Model path: ${this.modelPath}`)
    console.log(`🚀 Debug: Already verified: ${this.isVerified}`)
    
    // Check if already verified in this session
    if (this.isVerified && this.lastVerification) {
      const hoursSinceVerification = 
        (Date.now() - this.lastVerification.getTime()) / (1000 * 60 * 60)
      
      if (hoursSinceVerification < 24) {
        console.log('✅ Model previously verified in this session')
        return
      }
    }
    
    // Step 1: Check if model exists locally
    console.log('🔍 Debug: Calling verifyLocalModel()')
    const modelExists = await this.verifyLocalModel()
    
    if (modelExists) {
      console.log('✅ Critical model verified locally')
      this.isVerified = true
      this.lastVerification = new Date()
      this.configureTransformers()
      return
    }
    
    // Step 2: In production, FAIL FAST
    if (process.env.NODE_ENV === 'production' && !process.env.BRAINY_ALLOW_RUNTIME_DOWNLOAD) {
      throw new Error(
        '🚨 CRITICAL FAILURE: Transformer model not found in production!\n' +
        'The model is REQUIRED for Brainy to function.\n' +
        'Users CANNOT access their data without it.\n' +
        'Solution: Run "npm run download-models" during build stage.'
      )
    }
    
    // Step 3: Attempt to download from fallback sources
    console.warn('⚠️ Model not found locally, attempting download...')
    
    for (const source of CRITICAL_MODEL_CONFIG.fallbackSources) {
      try {
        console.log(`📥 Trying ${source.name}...`)
        await this.downloadFromSource(source)
        
        // Verify the download
        if (await this.verifyLocalModel()) {
          console.log(`✅ Successfully downloaded from ${source.name}`)
          this.isVerified = true
          this.lastVerification = new Date()
          this.configureTransformers()
          return
        }
      } catch (error) {
        console.warn(`❌ ${source.name} failed:`, (error as Error).message)
      }
    }
    
    // Step 4: CRITICAL FAILURE
    throw new Error(
      '🚨 CRITICAL FAILURE: Cannot obtain transformer model!\n' +
      'Tried all fallback sources.\n' +
      'Brainy CANNOT function without the model.\n' +
      'Users CANNOT access their data.\n' +
      'Please check network connectivity or pre-download models.'
    )
  }
  
  /**
   * Verify the local model files exist and are correct
   */
  private async verifyLocalModel(): Promise<boolean> {
    const modelBasePath = join(this.modelPath, ...CRITICAL_MODEL_CONFIG.modelName.split('/'))
    console.log(`🔍 Debug: Checking model at path: ${modelBasePath}`)
    console.log(`🔍 Debug: Model path components: ${this.modelPath} + ${CRITICAL_MODEL_CONFIG.modelName.split('/')}`)
    
    // Check critical files
    const criticalFiles = [
      'onnx/model.onnx',
      'tokenizer.json',
      'config.json'
    ]
    
    for (const file of criticalFiles) {
      const filePath = join(modelBasePath, file)
      console.log(`🔍 Debug: Checking file: ${filePath}`)
      
      if (!existsSync(filePath)) {
        console.log(`❌ Missing critical file: ${file} at ${filePath}`)
        return false
      }
      
      // Verify size for critical files
      if (CRITICAL_MODEL_CONFIG.modelSize[file]) {
        const stats = await stat(filePath)
        const expectedSize = CRITICAL_MODEL_CONFIG.modelSize[file]
        
        if (Math.abs(stats.size - expectedSize) > 1000) { // Allow 1KB variance
          console.error(
            `❌ CRITICAL: Model file size mismatch!\n` +
            `File: ${file}\n` +
            `Expected: ${expectedSize} bytes\n` +
            `Actual: ${stats.size} bytes\n` +
            `This indicates model corruption or version mismatch!`
          )
          return false
        }
      }
      
      // TODO: Add SHA256 verification for ultimate security
      // if (CRITICAL_MODEL_CONFIG.modelHash[file]) {
      //   const hash = await this.computeFileHash(filePath)
      //   if (hash !== CRITICAL_MODEL_CONFIG.modelHash[file]) {
      //     console.error('❌ CRITICAL: Model hash mismatch!')
      //     return false
      //   }
      // }
    }
    
    return true
  }
  
  /**
   * Download model from a fallback source
   */
  private async downloadFromSource(source: any): Promise<void> {
    if (source.type === 'transformers') {
      // Use transformers.js native download
      const { pipeline } = await import('@huggingface/transformers')
      env.cacheDir = this.modelPath
      env.allowRemoteModels = true
      
      const extractor = await pipeline(
        'feature-extraction',
        CRITICAL_MODEL_CONFIG.modelName
      )
      
      // Test the model
      const test = await extractor('test', { pooling: 'mean', normalize: true })
      if (test.data.length !== CRITICAL_MODEL_CONFIG.embeddingDimensions) {
        throw new Error(
          `CRITICAL: Model dimension mismatch! ` +
          `Expected ${CRITICAL_MODEL_CONFIG.embeddingDimensions}, ` +
          `got ${test.data.length}`
        )
      }
    } else if (source.type === 'tarball') {
      // Download and extract tarball
      // This would require implementation with proper tar extraction
      throw new Error('Tarball extraction not yet implemented')
    }
  }
  
  /**
   * Configure transformers.js to use verified local model
   */
  private configureTransformers(): void {
    env.localModelPath = this.modelPath
    env.allowRemoteModels = false // Force local only after verification
    console.log('🔒 Transformers configured to use verified local model')
  }
  
  /**
   * Detect where models should be stored
   */
  private detectModelPath(): string {
    const candidates = [
      process.env.BRAINY_MODELS_PATH,
      './models',
      join(process.cwd(), 'models'),
      join(process.env.HOME || '', '.brainy', 'models'),
      '/opt/models', // Lambda/container path
      env.cacheDir
    ]
    
    for (const path of candidates) {
      if (path && existsSync(path)) {
        const modelPath = join(path, ...CRITICAL_MODEL_CONFIG.modelName.split('/'))
        if (existsSync(join(modelPath, 'onnx', 'model.onnx'))) {
          return path // Return the models directory, not its parent
        }
      }
    }
    
    // Default
    return './models'
  }
  
  /**
   * Get model status for diagnostics
   */
  async getStatus(): Promise<{
    verified: boolean
    path: string
    lastVerification: Date | null
    modelName: string
    dimensions: number
  }> {
    return {
      verified: this.isVerified,
      path: this.modelPath,
      lastVerification: this.lastVerification,
      modelName: CRITICAL_MODEL_CONFIG.modelName,
      dimensions: CRITICAL_MODEL_CONFIG.embeddingDimensions
    }
  }
  
  /**
   * Force re-verification (for testing)
   */
  async forceReverify(): Promise<void> {
    this.isVerified = false
    this.lastVerification = null
    await this.ensureCriticalModel()
  }
}

// Export singleton instance
export const modelGuardian = ModelGuardian.getInstance()