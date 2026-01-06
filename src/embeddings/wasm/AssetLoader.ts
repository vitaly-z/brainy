/**
 * Asset Loader
 *
 * @deprecated This class is no longer used. Model weights are now embedded
 * in the Candle WASM binary at compile time. Kept for backward compatibility.
 *
 * Previously: Resolved paths to ONNX model files across environments.
 * Now: Use CandleEmbeddingEngine which loads embedded model automatically.
 */

import { MODEL_CONSTANTS } from './types.js'

// Cache resolved paths
let cachedModelDir: string | null = null
let cachedVocab: Record<string, number> | null = null

/**
 * Asset loader for model files
 */
export class AssetLoader {
  private modelDir: string | null = null

  /**
   * Get the model directory path
   */
  async getModelDir(): Promise<string> {
    if (this.modelDir) {
      return this.modelDir
    }

    if (cachedModelDir) {
      this.modelDir = cachedModelDir
      return cachedModelDir
    }

    // Try to resolve model directory
    const resolved = await this.resolveModelDir()
    this.modelDir = resolved
    cachedModelDir = resolved
    return resolved
  }

  /**
   * Resolve the model directory across environments
   */
  private async resolveModelDir(): Promise<string> {
    // 1. Check environment variable
    if (typeof process !== 'undefined' && process.env?.BRAINY_MODEL_PATH) {
      const envPath = process.env.BRAINY_MODEL_PATH
      if (await this.pathExists(envPath)) {
        return envPath
      }
    }

    // 2. Try common locations
    const modelName = MODEL_CONSTANTS.MODEL_NAME + '-q8'
    const possiblePaths = [
      // Package assets (when installed as dependency)
      `./assets/models/${modelName}`,
      `./node_modules/@soulcraft/brainy/assets/models/${modelName}`,
      // Development paths
      `../assets/models/${modelName}`,
      // Absolute from package root
      this.getPackageRootPath(`assets/models/${modelName}`),
    ].filter(Boolean) as string[]

    for (const path of possiblePaths) {
      if (await this.pathExists(path)) {
        return path
      }
    }

    // If no path found, return default (will error on use)
    return `./assets/models/${modelName}`
  }

  /**
   * Get package root path (Node.js/Bun only)
   */
  private getPackageRootPath(relativePath: string): string | null {
    if (typeof process === 'undefined') {
      return null
    }

    try {
      // Use __dirname equivalent
      const url = new URL(import.meta.url)
      const currentDir = url.pathname.replace(/\/[^/]*$/, '')
      // Go up from src/embeddings/wasm to package root
      const packageRoot = currentDir.replace(/\/src\/embeddings\/wasm$/, '')
      return `${packageRoot}/${relativePath}`
    } catch {
      return null
    }
  }

  /**
   * Check if path exists (works in Node.js/Bun)
   */
  private async pathExists(path: string): Promise<boolean> {
    if (typeof process === 'undefined') {
      // Browser - check via fetch
      try {
        const response = await fetch(path, { method: 'HEAD' })
        return response.ok
      } catch {
        return false
      }
    }

    // Node.js/Bun
    try {
      const fs = await import('node:fs/promises')
      await fs.access(path)
      return true
    } catch {
      return false
    }
  }

  /**
   * Get path to ONNX model file
   */
  async getModelPath(): Promise<string> {
    const dir = await this.getModelDir()
    return `${dir}/model.onnx`
  }

  /**
   * Get path to vocabulary file
   */
  async getVocabPath(): Promise<string> {
    const dir = await this.getModelDir()
    return `${dir}/vocab.json`
  }

  /**
   * Load vocabulary from JSON file
   */
  async loadVocab(): Promise<Record<string, number>> {
    if (cachedVocab) {
      return cachedVocab
    }

    const vocabPath = await this.getVocabPath()

    if (typeof process !== 'undefined') {
      // Node.js/Bun - read from filesystem
      try {
        const fs = await import('node:fs/promises')
        const content = await fs.readFile(vocabPath, 'utf-8')
        cachedVocab = JSON.parse(content)
        return cachedVocab!
      } catch (error) {
        throw new Error(
          `Failed to load vocabulary from ${vocabPath}: ${error instanceof Error ? error.message : String(error)}`
        )
      }
    } else {
      // Browser - fetch
      try {
        const response = await fetch(vocabPath)
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`)
        }
        cachedVocab = await response.json()
        return cachedVocab!
      } catch (error) {
        throw new Error(
          `Failed to fetch vocabulary from ${vocabPath}: ${error instanceof Error ? error.message : String(error)}`
        )
      }
    }
  }

  /**
   * Load model as ArrayBuffer (for ONNX session)
   */
  async loadModel(): Promise<ArrayBuffer> {
    const modelPath = await this.getModelPath()

    if (typeof process !== 'undefined') {
      // Node.js/Bun - read from filesystem
      try {
        const fs = await import('node:fs/promises')
        const buffer = await fs.readFile(modelPath)
        // Convert Node.js Buffer to ArrayBuffer
        return new Uint8Array(buffer).buffer as ArrayBuffer
      } catch (error) {
        throw new Error(
          `Failed to load model from ${modelPath}: ${error instanceof Error ? error.message : String(error)}`
        )
      }
    } else {
      // Browser - fetch
      try {
        const response = await fetch(modelPath)
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`)
        }
        return await response.arrayBuffer()
      } catch (error) {
        throw new Error(
          `Failed to fetch model from ${modelPath}: ${error instanceof Error ? error.message : String(error)}`
        )
      }
    }
  }

  /**
   * Verify all required assets exist
   */
  async verifyAssets(): Promise<{
    valid: boolean
    modelPath: string
    vocabPath: string
    errors: string[]
  }> {
    const errors: string[] = []
    const modelPath = await this.getModelPath()
    const vocabPath = await this.getVocabPath()

    if (!(await this.pathExists(modelPath))) {
      errors.push(`Model file not found: ${modelPath}`)
    }

    if (!(await this.pathExists(vocabPath))) {
      errors.push(`Vocabulary file not found: ${vocabPath}`)
    }

    return {
      valid: errors.length === 0,
      modelPath,
      vocabPath,
      errors,
    }
  }

  /**
   * Clear cached paths (for testing)
   */
  clearCache(): void {
    this.modelDir = null
    cachedModelDir = null
    cachedVocab = null
  }
}

/**
 * Create asset loader instance
 */
export function createAssetLoader(): AssetLoader {
  return new AssetLoader()
}

/**
 * Singleton asset loader
 */
let singletonLoader: AssetLoader | null = null

export function getAssetLoader(): AssetLoader {
  if (!singletonLoader) {
    singletonLoader = new AssetLoader()
  }
  return singletonLoader
}
