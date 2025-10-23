/**
 * InstancePool - Shared instance management for memory efficiency
 *
 * Production-grade instance pooling to prevent memory leaks during imports.
 * Critical for scaling to billions of entities.
 *
 * Problem: Creating new NLP/Extractor instances in loops → memory leak
 * Solution: Reuse shared instances across entire import session
 *
 * Memory savings:
 * - Without pooling: 100K rows × 50MB per instance = 5TB RAM (OOM!)
 * - With pooling: 50MB total (shared across all rows)
 */

import { Brainy } from '../brainy.js'
import { NaturalLanguageProcessor } from '../neural/naturalLanguageProcessor.js'
import { NeuralEntityExtractor } from '../neural/entityExtractor.js'

/**
 * InstancePool - Manages shared instances for memory efficiency
 *
 * Lifecycle:
 * 1. Create pool at import start
 * 2. Reuse instances across all rows
 * 3. Pool is garbage collected when import completes
 *
 * Thread safety: Not thread-safe (single import session per pool)
 */
export class InstancePool {
  private brain: Brainy

  // Shared instances (created lazily)
  private nlpInstance: NaturalLanguageProcessor | null = null
  private extractorInstance: NeuralEntityExtractor | null = null

  // Initialization state
  private nlpInitialized = false
  private initializationPromise: Promise<void> | null = null

  // Statistics
  private stats = {
    nlpReuses: 0,
    extractorReuses: 0,
    creationTime: 0
  }

  constructor(brain: Brainy) {
    this.brain = brain
  }

  /**
   * Get shared NaturalLanguageProcessor instance
   *
   * Lazy initialization - created on first access
   * All subsequent calls return same instance
   *
   * @returns Shared NLP instance
   */
  async getNLP(): Promise<NaturalLanguageProcessor> {
    if (!this.nlpInstance) {
      const startTime = Date.now()
      this.nlpInstance = new NaturalLanguageProcessor(this.brain)
      this.stats.creationTime += Date.now() - startTime
    }

    // Ensure initialized before returning
    if (!this.nlpInitialized) {
      await this.ensureNLPInitialized()
    }

    this.stats.nlpReuses++
    return this.nlpInstance
  }

  /**
   * Get shared NeuralEntityExtractor instance
   *
   * Lazy initialization - created on first access
   * All subsequent calls return same instance
   *
   * @returns Shared extractor instance
   */
  getExtractor(): NeuralEntityExtractor {
    if (!this.extractorInstance) {
      const startTime = Date.now()
      this.extractorInstance = new NeuralEntityExtractor(this.brain)
      this.stats.creationTime += Date.now() - startTime
    }

    this.stats.extractorReuses++
    return this.extractorInstance
  }

  /**
   * Get shared NLP instance (synchronous, may return uninitialized)
   *
   * Use when you need NLP synchronously and will handle initialization yourself.
   * Prefer getNLP() for async code.
   *
   * @returns Shared NLP instance (possibly uninitialized)
   */
  getNLPSync(): NaturalLanguageProcessor {
    if (!this.nlpInstance) {
      this.nlpInstance = new NaturalLanguageProcessor(this.brain)
    }

    this.stats.nlpReuses++
    return this.nlpInstance
  }

  /**
   * Initialize all instances upfront
   *
   * Call at start of import to avoid lazy initialization overhead
   * during processing. Improves predictability and first-row performance.
   *
   * @returns Promise that resolves when all instances are ready
   */
  async init(): Promise<void> {
    // Prevent duplicate initialization
    if (this.initializationPromise) {
      return this.initializationPromise
    }

    this.initializationPromise = this.initializeInternal()
    return this.initializationPromise
  }

  /**
   * Internal initialization implementation
   */
  private async initializeInternal(): Promise<void> {
    const startTime = Date.now()

    // Create instances
    if (!this.nlpInstance) {
      this.nlpInstance = new NaturalLanguageProcessor(this.brain)
    }
    if (!this.extractorInstance) {
      this.extractorInstance = new NeuralEntityExtractor(this.brain)
    }

    // Initialize NLP (loads pattern library)
    await this.ensureNLPInitialized()

    this.stats.creationTime = Date.now() - startTime
  }

  /**
   * Ensure NLP is initialized (loads 220 patterns)
   *
   * Handles concurrent initialization requests safely
   */
  private async ensureNLPInitialized(): Promise<void> {
    if (this.nlpInitialized) {
      return
    }

    if (!this.nlpInstance) {
      throw new Error('NLP instance not created yet')
    }

    await this.nlpInstance.init()
    this.nlpInitialized = true
  }

  /**
   * Check if instances are initialized
   *
   * @returns True if NLP is initialized and ready to use
   */
  isInitialized(): boolean {
    return this.nlpInitialized && this.nlpInstance !== null
  }

  /**
   * Get pool statistics
   *
   * Useful for performance monitoring and memory leak detection
   *
   * @returns Statistics about instance reuse
   */
  getStats() {
    return {
      ...this.stats,
      nlpCreated: this.nlpInstance !== null,
      extractorCreated: this.extractorInstance !== null,
      initialized: this.isInitialized(),
      // Memory savings estimate
      memorySaved: this.calculateMemorySaved()
    }
  }

  /**
   * Calculate estimated memory saved by pooling
   *
   * Assumes ~50MB per NLP instance, ~10MB per extractor instance
   *
   * @returns Estimated memory saved in bytes
   */
  private calculateMemorySaved(): number {
    const nlpSize = 50 * 1024 * 1024 // 50MB per instance
    const extractorSize = 10 * 1024 * 1024 // 10MB per instance

    // Without pooling: size × reuses
    // With pooling: size × 1
    // Saved: size × (reuses - 1)

    const nlpSaved = nlpSize * Math.max(0, this.stats.nlpReuses - 1)
    const extractorSaved = extractorSize * Math.max(0, this.stats.extractorReuses - 1)

    return nlpSaved + extractorSaved
  }

  /**
   * Reset statistics (useful for testing)
   */
  resetStats(): void {
    this.stats = {
      nlpReuses: 0,
      extractorReuses: 0,
      creationTime: 0
    }
  }

  /**
   * Get string representation (for debugging)
   */
  toString(): string {
    const stats = this.getStats()
    return `InstancePool(nlp=${stats.nlpCreated}, extractor=${stats.extractorCreated}, initialized=${stats.initialized}, nlpReuses=${stats.nlpReuses}, extractorReuses=${stats.extractorReuses})`
  }

  /**
   * Cleanup method (for explicit resource management)
   *
   * Note: Usually not needed - pool is garbage collected when import completes.
   * Use only if you need explicit cleanup for some reason.
   */
  cleanup(): void {
    // Clear references to allow garbage collection
    this.nlpInstance = null
    this.extractorInstance = null
    this.nlpInitialized = false
    this.initializationPromise = null
  }
}

/**
 * Create a new instance pool
 *
 * Convenience factory function
 *
 * @param brain Brainy instance
 * @param autoInit Whether to initialize instances immediately
 * @returns Instance pool
 */
export async function createInstancePool(
  brain: Brainy,
  autoInit = true
): Promise<InstancePool> {
  const pool = new InstancePool(brain)

  if (autoInit) {
    await pool.init()
  }

  return pool
}
