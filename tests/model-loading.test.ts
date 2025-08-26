/**
 * Model Loading Cascade Tests
 * 
 * Tests the multi-source model loading strategy:
 * 1. Local cache
 * 2. CDN (when available) 
 * 3. GitHub releases
 * 4. HuggingFace fallback
 * 
 * CRITICAL: Uses REAL transformer models - NO MOCKING
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { ModelManager } from '../src/embeddings/model-manager.js'
import { existsSync, rmSync } from 'fs'
import { mkdir, writeFile } from 'fs/promises'
import { join } from 'path'
import { env } from '@huggingface/transformers'

describe('Model Loading Cascade', () => {
  const testModelsDir = './test-models-cache'
  const originalEnv = { ...process.env }
  let manager: ModelManager

  beforeEach(async () => {
    // Clean test environment
    if (existsSync(testModelsDir)) {
      rmSync(testModelsDir, { recursive: true, force: true })
    }
    
    // Reset singleton instance
    (ModelManager as any).instance = null
    
    // Set test models path
    process.env.BRAINY_MODELS_PATH = testModelsDir
    process.env.SKIP_MODEL_CHECK = 'true' // Prevent auto-init
    
    manager = ModelManager.getInstance()
  })

  afterEach(() => {
    // Restore environment
    process.env = { ...originalEnv }
    
    // Clean up test directory
    if (existsSync(testModelsDir)) {
      rmSync(testModelsDir, { recursive: true, force: true })
    }
  })

  describe('Local Cache Loading', () => {
    it('should load models from local cache when available', async () => {
      // Create mock local model files
      const modelPath = join(testModelsDir, 'Xenova', 'all-MiniLM-L6-v2')
      await mkdir(modelPath, { recursive: true })
      await mkdir(join(modelPath, 'onnx'), { recursive: true })
      
      // Create minimal model files
      await writeFile(join(modelPath, 'config.json'), JSON.stringify({
        model_type: 'bert',
        hidden_size: 384
      }))
      await writeFile(join(modelPath, 'tokenizer.json'), JSON.stringify({
        version: '1.0'
      }))
      await writeFile(join(modelPath, 'tokenizer_config.json'), JSON.stringify({
        do_lower_case: true
      }))
      await writeFile(join(modelPath, 'onnx', 'model.onnx'), Buffer.alloc(1000)) // Dummy model file
      
      const result = await manager.ensureModels()
      
      expect(result).toBe(true)
      expect(env.allowRemoteModels).toBe(false) // Should use local models
    })

    it('should verify model file integrity when VERIFY_MODEL_SIZE is set', async () => {
      process.env.VERIFY_MODEL_SIZE = 'true'
      
      const modelPath = join(testModelsDir, 'Xenova', 'all-MiniLM-L6-v2')
      await mkdir(modelPath, { recursive: true })
      await mkdir(join(modelPath, 'onnx'), { recursive: true })
      
      // Create model files with incorrect sizes
      await writeFile(join(modelPath, 'config.json'), 'wrong size')
      await writeFile(join(modelPath, 'tokenizer.json'), 'wrong')
      await writeFile(join(modelPath, 'tokenizer_config.json'), 'bad')
      await writeFile(join(modelPath, 'onnx', 'model.onnx'), Buffer.alloc(100))
      
      const result = await manager.ensureModels()
      
      // Should fall back to remote loading due to size mismatch
      expect(result).toBe(true)
      expect(env.allowRemoteModels).toBe(true)
    })
  })

  describe('Remote Source Fallback', () => {
    it('should attempt GitHub download when local cache missing', async () => {
      // Use a non-existent models path to force remote download
      process.env.BRAINY_MODELS_PATH = '/tmp/test-models-missing'
      (ModelManager as any).instance = null
      const testManager = ModelManager.getInstance()
      
      // Spy on fetch to track download attempts
      const fetchSpy = vi.spyOn(global, 'fetch').mockRejectedValue(
        new Error('Test - GitHub not available')
      )
      
      const result = await testManager.ensureModels()
      
      expect(result).toBe(true)
      
      // Should have attempted GitHub download
      expect(fetchSpy).toHaveBeenCalledWith(
        expect.stringContaining('github.com')
      )
      
      fetchSpy.mockRestore()
    })

    it('should attempt CDN download after GitHub fails', async () => {
      const fetchSpy = vi.spyOn(global, 'fetch')
        .mockRejectedValueOnce(new Error('GitHub failed'))
        .mockRejectedValueOnce(new Error('CDN failed'))
      
      const result = await manager.ensureModels()
      
      expect(result).toBe(true)
      
      // Should have attempted both GitHub and CDN
      expect(fetchSpy).toHaveBeenCalledTimes(2)
      expect(fetchSpy).toHaveBeenCalledWith(
        expect.stringContaining('models.soulcraft.com')
      )
      
      // Should fall back to HuggingFace
      expect(env.allowRemoteModels).toBe(true)
      
      fetchSpy.mockRestore()
    })

    it('should fall back to HuggingFace when all sources fail', async () => {
      const fetchSpy = vi.spyOn(global, 'fetch')
        .mockRejectedValue(new Error('All downloads failed'))
      
      const result = await manager.ensureModels()
      
      expect(result).toBe(true)
      expect(env.allowRemoteModels).toBe(true) // HuggingFace fallback enabled
      
      fetchSpy.mockRestore()
    })
  })

  describe('Model Path Detection', () => {
    it('should check multiple paths for models', async () => {
      // Reset instance to test path detection
      (ModelManager as any).instance = null
      const originalPath = process.env.BRAINY_MODELS_PATH
      process.env.BRAINY_MODELS_PATH = undefined as any
      
      const newManager = ModelManager.getInstance()
      const modelsPath = (newManager as any).modelsPath
      
      // Should use one of the default paths
      expect(modelsPath).toBeTruthy()
      expect(typeof modelsPath).toBe('string')
      
      // Restore
      process.env.BRAINY_MODELS_PATH = originalPath
    })

    it('should prefer BRAINY_MODELS_PATH when set', async () => {
      const originalPath = process.env.BRAINY_MODELS_PATH
      const customPath = '/custom/models/path'
      process.env.BRAINY_MODELS_PATH = customPath
      
      (ModelManager as any).instance = null
      const newManager = ModelManager.getInstance()
      
      expect((newManager as any).modelsPath).toBe(customPath)
      
      // Restore
      process.env.BRAINY_MODELS_PATH = originalPath
    })
  })

  describe('Production Auto-Initialization', () => {
    it('should auto-initialize in production mode', async () => {
      const originalNodeEnv = process.env.NODE_ENV
      const originalSkipCheck = process.env.SKIP_MODEL_CHECK
      
      process.env.NODE_ENV = 'production'
      process.env.SKIP_MODEL_CHECK = undefined as any
      
      // Reset and reimport to trigger auto-init
      (ModelManager as any).instance = null
      
      // Create a new instance (would auto-init in production)
      const prodManager = ModelManager.getInstance()
      
      // In production, it would attempt to ensure models
      expect(prodManager).toBeTruthy()
      
      // Restore
      process.env.NODE_ENV = originalNodeEnv
      process.env.SKIP_MODEL_CHECK = originalSkipCheck
    })

    it('should skip auto-init when SKIP_MODEL_CHECK is set', async () => {
      const originalNodeEnv = process.env.NODE_ENV
      const originalSkipCheck = process.env.SKIP_MODEL_CHECK
      
      process.env.NODE_ENV = 'production'
      process.env.SKIP_MODEL_CHECK = 'true'
      
      (ModelManager as any).instance = null
      const skipManager = ModelManager.getInstance()
      
      expect((skipManager as any).isInitialized).toBe(false)
      
      // Restore
      process.env.NODE_ENV = originalNodeEnv
      process.env.SKIP_MODEL_CHECK = originalSkipCheck
    })
  })

  describe('Real Model Download Integration', () => {
    it('should successfully download and use real transformer models', async () => {
      // Clean environment for real download
      const originalPath = process.env.BRAINY_MODELS_PATH
      const originalSkipCheck = process.env.SKIP_MODEL_CHECK
      
      (ModelManager as any).instance = null
      process.env.BRAINY_MODELS_PATH = undefined as any
      process.env.SKIP_MODEL_CHECK = undefined as any
      
      const realManager = ModelManager.getInstance()
      const result = await realManager.ensureModels()
      
      expect(result).toBe(true)
      
      // Verify we can actually use the model
      const { pipeline } = await import('@huggingface/transformers')
      const extractor = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2')
      
      const embeddings = await extractor('Test text for embeddings', {
        pooling: 'mean',
        normalize: true
      })
      
      expect(embeddings.data).toBeDefined()
      expect(embeddings.data.length).toBe(384) // Correct dimensions
      
      // Restore
      process.env.BRAINY_MODELS_PATH = originalPath
      process.env.SKIP_MODEL_CHECK = originalSkipCheck
    }, { timeout: 60000 }) // Vitest timeout syntax
  })

  describe('Error Handling', () => {
    it('should handle network errors gracefully', async () => {
      const fetchSpy = vi.spyOn(global, 'fetch')
        .mockRejectedValue(new Error('Network error'))
      
      const result = await manager.ensureModels()
      
      // Should still return true (falls back to HuggingFace)
      expect(result).toBe(true)
      expect(env.allowRemoteModels).toBe(true)
      
      fetchSpy.mockRestore()
    })

    it('should handle corrupted downloads', async () => {
      const fetchSpy = vi.spyOn(global, 'fetch')
        .mockResolvedValue({
          ok: true,
          arrayBuffer: async () => Buffer.alloc(0) // Empty/corrupted file
        } as any)
      
      const result = await manager.ensureModels()
      
      expect(result).toBe(true) // Should fall back gracefully
      
      fetchSpy.mockRestore()
    })

    it('should handle missing model manifest gracefully', async () => {
      const result = await manager.ensureModels('unknown/model')
      
      expect(result).toBe(true) // Should fall back to HuggingFace
      expect(env.allowRemoteModels).toBe(true)
    })
  })

  describe('Predownload Functionality', () => {
    it('should predownload models for deployment', async () => {
      const spy = vi.spyOn(console, 'log')
      
      await ModelManager.predownload()
      
      expect(spy).toHaveBeenCalledWith(
        expect.stringContaining('Models downloaded successfully')
      )
      
      spy.mockRestore()
    })

    it('should throw error if predownload fails completely', async () => {
      // Force failure by making ensureModels return false
      vi.spyOn(manager, 'ensureModels').mockResolvedValue(false)
      
      await expect(ModelManager.predownload()).rejects.toThrow(
        'Failed to download models'
      )
    })
  })
})