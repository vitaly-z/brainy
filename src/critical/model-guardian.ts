/**
 * MODEL GUARDIAN - CRITICAL PATH
 *
 * THIS IS THE MOST CRITICAL COMPONENT OF BRAINY
 * Without the exact model, users CANNOT access their data
 *
 * Requirements:
 * 1. Model MUST be all-MiniLM-L6-v2-q8 (bundled in package)
 * 2. Model MUST be available at runtime (embedded in npm package)
 * 3. Model MUST produce consistent 384-dim embeddings
 * 4. System MUST fail fast if model unavailable in production
 */

import { WASMEmbeddingEngine } from '../embeddings/wasm/index.js'

// CRITICAL: These values MUST NEVER CHANGE
const CRITICAL_MODEL_CONFIG = {
  modelName: 'all-MiniLM-L6-v2-q8',
  embeddingDimensions: 384,
  // Model is bundled in package - no external downloads needed
  bundled: true
}

export class ModelGuardian {
  private static instance: ModelGuardian
  private isVerified = false
  private lastVerification: Date | null = null

  private constructor() {
    // Model is bundled - no path detection needed
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
    // Check if already verified in this session
    if (this.isVerified && this.lastVerification) {
      const hoursSinceVerification =
        (Date.now() - this.lastVerification.getTime()) / (1000 * 60 * 60)

      if (hoursSinceVerification < 24) {
        return
      }
    }

    // Verify the bundled WASM model works
    const modelWorks = await this.verifyBundledModel()

    if (modelWorks) {
      this.isVerified = true
      this.lastVerification = new Date()
      return
    }

    // CRITICAL FAILURE
    throw new Error(
      '🚨 CRITICAL FAILURE: Bundled transformer model not working!\n' +
      'The model is REQUIRED for Brainy to function.\n' +
      'Users CANNOT access their data without it.\n' +
      'This indicates a package installation issue.'
    )
  }

  /**
   * Verify the bundled WASM model works correctly
   */
  private async verifyBundledModel(): Promise<boolean> {
    try {
      const engine = WASMEmbeddingEngine.getInstance()

      // Initialize the engine (loads bundled model)
      await engine.initialize()

      // Test embedding generation
      const testEmbedding = await engine.embed('test verification')

      // Verify dimensions
      if (testEmbedding.length !== CRITICAL_MODEL_CONFIG.embeddingDimensions) {
        console.error(
          `❌ CRITICAL: Model dimension mismatch!\n` +
          `Expected: ${CRITICAL_MODEL_CONFIG.embeddingDimensions}\n` +
          `Got: ${testEmbedding.length}`
        )
        return false
      }

      // Verify normalization (should be unit length)
      const norm = Math.sqrt(testEmbedding.reduce((sum, v) => sum + v * v, 0))
      if (Math.abs(norm - 1.0) > 0.01) {
        console.error(`❌ CRITICAL: Embeddings not normalized! Norm: ${norm}`)
        return false
      }

      return true
    } catch (error) {
      console.error('❌ Model verification failed:', error)
      return false
    }
  }

  /**
   * Get model status for diagnostics
   */
  async getStatus(): Promise<{
    verified: boolean
    lastVerification: Date | null
    modelName: string
    dimensions: number
    bundled: boolean
  }> {
    return {
      verified: this.isVerified,
      lastVerification: this.lastVerification,
      modelName: CRITICAL_MODEL_CONFIG.modelName,
      dimensions: CRITICAL_MODEL_CONFIG.embeddingDimensions,
      bundled: CRITICAL_MODEL_CONFIG.bundled
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
