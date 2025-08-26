#!/usr/bin/env node
/**
 * Prepare Models Script
 * 
 * Intelligently handles model preparation for different deployment scenarios:
 * 1. Development: Models download automatically on first use
 * 2. Docker/CI: Pre-download during build stage  
 * 3. Serverless: Bundle with deployment package
 * 4. Production: Verify models exist, fail fast if missing
 */

import { existsSync } from 'fs'
import { readFile, mkdir, writeFile, stat } from 'fs/promises'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { pipeline, env } from '@huggingface/transformers'
import { execSync } from 'child_process'
import https from 'https'
import { createWriteStream } from 'fs'
import { promisify } from 'util'
import { finished } from 'stream'

const streamFinished = promisify(finished)
const __dirname = dirname(fileURLToPath(import.meta.url))

// Model configuration
const MODEL_CONFIG = {
  name: 'Xenova/all-MiniLM-L6-v2',
  expectedFiles: [
    'config.json',
    'tokenizer.json', 
    'tokenizer_config.json',
    'onnx/model.onnx'
  ],
  fallbackUrls: {
    // GitHub Releases (our backup)
    github: 'https://github.com/soulcraftlabs/brainy-models/releases/download/v1.0/all-MiniLM-L6-v2.tar.gz',
    // Future CDN
    cdn: 'https://models.soulcraft.com/brainy/all-MiniLM-L6-v2.tar.gz'
  }
}

class ModelPreparer {
  constructor() {
    this.modelsDir = join(__dirname, '..', 'models')
    this.modelPath = join(this.modelsDir, ...MODEL_CONFIG.name.split('/'))
  }

  /**
   * Main entry point - intelligently prepares models based on context
   */
  async prepare() {
    console.log('🧠 Brainy Model Preparation')
    console.log('===========================')
    
    // Detect deployment context
    const context = this.detectContext()
    console.log(`📍 Context: ${context}`)
    
    switch (context) {
      case 'production':
        return await this.prepareProduction()
      case 'docker':
        return await this.prepareDocker()
      case 'ci':
        return await this.prepareCI()
      case 'development':
        return await this.prepareDevelopment()
      default:
        return await this.prepareDefault()
    }
  }

  /**
   * Detect the deployment context
   */
  detectContext() {
    // Check environment variables
    if (process.env.NODE_ENV === 'production') return 'production'
    if (process.env.DOCKER_BUILD === 'true') return 'docker'
    if (process.env.CI === 'true') return 'ci'
    if (process.env.NODE_ENV === 'development') return 'development'
    
    // Check for Docker build context
    if (existsSync('/.dockerenv')) return 'docker'
    
    // Check for common CI indicators
    if (process.env.GITHUB_ACTIONS || process.env.GITLAB_CI) return 'ci'
    
    // Default to development
    return 'development'
  }

  /**
   * Production: Models MUST exist, fail fast if not
   */
  async prepareProduction() {
    console.log('🏭 Production mode - verifying models...')
    
    const modelExists = await this.verifyModels()
    
    if (!modelExists) {
      console.error('❌ CRITICAL: Models not found in production!')
      console.error('   Models must be pre-downloaded during build stage.')
      console.error('   Run: npm run download-models')
      process.exit(1)
    }
    
    console.log('✅ Models verified for production')
    return true
  }

  /**
   * Docker: Download models during build stage
   */
  async prepareDocker() {
    console.log('🐳 Docker build - downloading models...')
    
    // Check if already exists
    if (await this.verifyModels()) {
      console.log('✅ Models already present')
      return true
    }
    
    // Download models
    return await this.downloadModels()
  }

  /**
   * CI: Download models for testing
   */
  async prepareCI() {
    console.log('🔧 CI environment - downloading models for tests...')
    
    // Check cache first
    if (await this.checkCICache()) {
      console.log('✅ Using cached models')
      return true
    }
    
    // Download and cache
    const success = await this.downloadModels()
    if (success) {
      await this.saveCICache()
    }
    return success
  }

  /**
   * Development: Optional download, will auto-download on first use
   */
  async prepareDevelopment() {
    console.log('💻 Development mode')
    
    if (await this.verifyModels()) {
      console.log('✅ Models already downloaded')
      return true
    }
    
    console.log('ℹ️ Models will download automatically on first use')
    console.log('   To pre-download now: npm run download-models')
    
    // Ask if they want to download now
    if (process.stdout.isTTY && !process.env.SKIP_PROMPT) {
      const readline = await import('readline')
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
      })
      
      return new Promise((resolve) => {
        rl.question('Download models now? (y/N): ', async (answer) => {
          rl.close()
          if (answer.toLowerCase() === 'y') {
            resolve(await this.downloadModels())
          } else {
            resolve(true)
          }
        })
      })
    }
    
    return true
  }

  /**
   * Default: Try to be smart about it
   */
  async prepareDefault() {
    console.log('🤖 Auto-detecting best approach...')
    
    if (await this.verifyModels()) {
      console.log('✅ Models found')
      return true
    }
    
    // If running as part of install, don't download
    if (process.env.npm_lifecycle_event === 'postinstall') {
      console.log('ℹ️ Skipping download during install (will download on first use)')
      return true
    }
    
    // Otherwise download
    return await this.downloadModels()
  }

  /**
   * Verify all required model files exist
   */
  async verifyModels() {
    for (const file of MODEL_CONFIG.expectedFiles) {
      const filePath = join(this.modelPath, file)
      if (!existsSync(filePath)) {
        return false
      }
    }
    
    // Verify model.onnx size (should be ~87MB)
    const modelOnnxPath = join(this.modelPath, 'onnx', 'model.onnx')
    if (existsSync(modelOnnxPath)) {
      const stats = await stat(modelOnnxPath)
      const sizeMB = Math.round(stats.size / (1024 * 1024))
      if (sizeMB < 80 || sizeMB > 100) {
        console.warn(`⚠️ Model size unexpected: ${sizeMB}MB (expected ~87MB)`)
        return false
      }
    }
    
    return true
  }

  /**
   * Download models with fallback sources
   */
  async downloadModels() {
    console.log('📥 Downloading transformer models...')
    
    // Try transformers.js first (Hugging Face)
    try {
      await this.downloadFromTransformers()
      console.log('✅ Downloaded from Hugging Face')
      return true
    } catch (error) {
      console.warn('⚠️ Hugging Face download failed:', error.message)
    }
    
    // Try GitHub releases
    try {
      await this.downloadFromGitHub()
      console.log('✅ Downloaded from GitHub')
      return true
    } catch (error) {
      console.warn('⚠️ GitHub download failed:', error.message)
    }
    
    // Try CDN
    try {
      await this.downloadFromCDN()
      console.log('✅ Downloaded from CDN')
      return true
    } catch (error) {
      console.warn('⚠️ CDN download failed:', error.message)
    }
    
    console.error('❌ All download sources failed')
    return false
  }

  /**
   * Download using transformers.js (official Hugging Face)
   */
  async downloadFromTransformers() {
    env.cacheDir = this.modelsDir
    env.allowRemoteModels = true
    
    console.log('   Source: Hugging Face')
    console.log('   Model:', MODEL_CONFIG.name)
    
    // Load pipeline to trigger download
    const extractor = await pipeline('feature-extraction', MODEL_CONFIG.name)
    
    // Test it works
    const test = await extractor('test', { pooling: 'mean', normalize: true })
    console.log(`   ✓ Model test passed (dims: ${test.data.length})`)
    
    return true
  }

  /**
   * Download from GitHub releases (our backup)
   */
  async downloadFromGitHub() {
    const url = MODEL_CONFIG.fallbackUrls.github
    console.log('   Source: GitHub Releases')
    
    // Download tar.gz
    const tempFile = join(this.modelsDir, 'temp-model.tar.gz')
    await this.downloadFile(url, tempFile)
    
    // Extract
    await mkdir(this.modelPath, { recursive: true })
    execSync(`tar -xzf ${tempFile} -C ${this.modelPath}`, { stdio: 'inherit' })
    
    // Cleanup
    await unlink(tempFile)
    
    return true
  }

  /**
   * Download from CDN (future)
   */
  async downloadFromCDN() {
    const url = MODEL_CONFIG.fallbackUrls.cdn
    console.log('   Source: Soulcraft CDN')
    
    // Similar to GitHub approach
    throw new Error('CDN not yet available')
  }

  /**
   * Download a file from URL
   */
  async downloadFile(url, destination) {
    await mkdir(dirname(destination), { recursive: true })
    
    return new Promise((resolve, reject) => {
      const file = createWriteStream(destination)
      
      https.get(url, (response) => {
        if (response.statusCode !== 200) {
          reject(new Error(`HTTP ${response.statusCode}`))
          return
        }
        
        response.pipe(file)
        
        file.on('finish', () => {
          file.close()
          resolve()
        })
      }).on('error', reject)
    })
  }

  /**
   * Check CI cache for models
   */
  async checkCICache() {
    // GitHub Actions cache
    if (process.env.GITHUB_ACTIONS) {
      const cachePath = process.env.RUNNER_TEMP + '/brainy-models'
      if (existsSync(cachePath)) {
        // Copy from cache
        execSync(`cp -r ${cachePath}/* ${this.modelsDir}/`, { stdio: 'inherit' })
        return true
      }
    }
    
    return false
  }

  /**
   * Save models to CI cache
   */
  async saveCICache() {
    // GitHub Actions cache
    if (process.env.GITHUB_ACTIONS) {
      const cachePath = process.env.RUNNER_TEMP + '/brainy-models'
      await mkdir(cachePath, { recursive: true })
      execSync(`cp -r ${this.modelsDir}/* ${cachePath}/`, { stdio: 'inherit' })
    }
  }
}

// Run the preparer
const preparer = new ModelPreparer()
preparer.prepare()
  .then(success => {
    if (!success) {
      process.exit(1)
    }
  })
  .catch(error => {
    console.error('❌ Fatal error:', error)
    process.exit(1)
  })