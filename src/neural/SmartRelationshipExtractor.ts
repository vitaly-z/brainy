/**
 * SmartRelationshipExtractor - Unified relationship type extraction using ensemble of neural signals
 *
 * PRODUCTION-READY: Parallel to SmartExtractor but for verbs/relationships
 *
 * Design Philosophy:
 * - Simplicity over complexity (KISS principle)
 * - One class instead of multiple strategy layers
 * - Clear execution path for debugging
 * - Comprehensive relationship intelligence built-in
 *
 * Ensemble Architecture:
 * - VerbEmbeddingSignal (55%) - Neural similarity with verb embeddings
 * - VerbPatternSignal (30%) - Regex patterns and structures
 * - VerbContextSignal (15%) - Entity type pair hints
 *
 * Performance:
 * - Parallel signal execution (~15-20ms total)
 * - LRU caching for hot relationships
 * - Confidence boosting when signals agree
 * - Graceful degradation on errors
 */

import type { Brainy } from '../brainy.js'
import type { VerbType, NounType } from '../types/graphTypes.js'
import { VerbEmbeddingSignal } from './signals/VerbEmbeddingSignal.js'
import { VerbPatternSignal } from './signals/VerbPatternSignal.js'
import { VerbContextSignal } from './signals/VerbContextSignal.js'
import type { VerbSignal as EmbeddingVerbSignal } from './signals/VerbEmbeddingSignal.js'
import type { VerbSignal as PatternVerbSignal } from './signals/VerbPatternSignal.js'
import type { VerbSignal as ContextVerbSignal } from './signals/VerbContextSignal.js'

/**
 * Extraction result with full traceability
 */
export interface RelationshipExtractionResult {
  type: VerbType
  confidence: number
  weight: number
  source: 'ensemble' | 'pattern' | 'embedding' | 'context'
  evidence: string
  metadata?: {
    signalResults?: Array<{
      signal: string
      type: VerbType
      confidence: number
      weight: number
    }>
    agreementBoost?: number
  }
}

/**
 * Options for SmartRelationshipExtractor
 */
export interface SmartRelationshipExtractorOptions {
  minConfidence?: number        // Minimum confidence threshold (default: 0.60)
  enableEnsemble?: boolean      // Use ensemble vs single best signal (default: true)
  cacheSize?: number           // LRU cache size (default: 2000)
  weights?: {                  // Custom signal weights (must sum to 1.0)
    embedding?: number         // Default: 0.55
    pattern?: number           // Default: 0.30
    context?: number           // Default: 0.15
  }
}

/**
 * Internal signal result wrapper
 */
interface SignalResult {
  signal: 'embedding' | 'pattern' | 'context'
  type: VerbType | null
  confidence: number
  weight: number
  evidence: string
}

/**
 * SmartRelationshipExtractor - Unified relationship type classification
 *
 * This is the single entry point for all relationship type extraction.
 * It orchestrates all 4 signals, and combines results using ensemble weighting.
 *
 * Production features:
 * - Parallel signal execution for performance
 * - Ensemble voting with confidence boosting
 * - Comprehensive statistics and observability
 * - LRU caching for hot paths
 * - Graceful error handling
 */
export class SmartRelationshipExtractor {
  private brain: Brainy
  private options: Required<Omit<SmartRelationshipExtractorOptions, 'weights'>> & { weights: Required<NonNullable<SmartRelationshipExtractorOptions['weights']>> }

  // Signal instances
  private embeddingSignal: VerbEmbeddingSignal
  private patternSignal: VerbPatternSignal
  private contextSignal: VerbContextSignal

  // LRU cache
  private cache: Map<string, RelationshipExtractionResult | null> = new Map()
  private cacheOrder: string[] = []

  // Statistics
  private stats = {
    calls: 0,
    cacheHits: 0,
    embeddingWins: 0,
    patternWins: 0,
    contextWins: 0,
    ensembleWins: 0,
    agreementBoosts: 0,
    averageConfidence: 0,
    averageSignalsUsed: 0
  }

  constructor(brain: Brainy, options?: SmartRelationshipExtractorOptions) {
    this.brain = brain

    // Set default options
    this.options = {
      minConfidence: options?.minConfidence ?? 0.60,
      enableEnsemble: options?.enableEnsemble ?? true,
      cacheSize: options?.cacheSize ?? 2000,
      weights: {
        embedding: options?.weights?.embedding ?? 0.55,
        pattern: options?.weights?.pattern ?? 0.30,
        context: options?.weights?.context ?? 0.15
      }
    }

    // Validate weights sum to 1.0
    const weightSum = Object.values(this.options.weights).reduce((a, b) => a + b, 0)
    if (Math.abs(weightSum - 1.0) > 0.01) {
      throw new Error(`Signal weights must sum to 1.0, got ${weightSum}`)
    }

    // Initialize signals
    this.embeddingSignal = new VerbEmbeddingSignal(brain, {
      minConfidence: 0.50,
      cacheSize: Math.floor(this.options.cacheSize / 3)
    })

    this.patternSignal = new VerbPatternSignal(brain, {
      minConfidence: 0.50,
      cacheSize: Math.floor(this.options.cacheSize / 3)
    })

    this.contextSignal = new VerbContextSignal(brain, {
      minConfidence: 0.50,
      cacheSize: Math.floor(this.options.cacheSize / 3)
    })
  }

  /**
   * Infer relationship type using ensemble of signals
   *
   * Main entry point - orchestrates all signals and combines results
   *
   * @param subject Subject entity name (e.g., "Alice")
   * @param object Object entity name (e.g., "UCSF")
   * @param context Full context text (sentence or paragraph)
   * @param options Additional context for inference
   * @returns RelationshipExtractionResult with type and confidence
   */
  async infer(
    subject: string,
    object: string,
    context: string,
    options?: {
      subjectType?: NounType
      objectType?: NounType
      contextVector?: number[]
    }
  ): Promise<RelationshipExtractionResult | null> {
    this.stats.calls++

    // Check cache first
    const cacheKey = this.getCacheKey(subject, object, context)
    const cached = this.getFromCache(cacheKey)
    if (cached !== undefined) {
      this.stats.cacheHits++
      return cached
    }

    try {
      // Execute all signals in parallel
      const [embeddingMatch, patternMatch, contextMatch] = await Promise.all([
        this.embeddingSignal.classify(context, options?.contextVector).catch(() => null),
        this.patternSignal.classify(subject, object, context).catch(() => null),
        this.contextSignal.classify(options?.subjectType, options?.objectType).catch(() => null)
      ])

      // Wrap results with weights
      const signalResults: SignalResult[] = [
        {
          signal: 'embedding',
          type: embeddingMatch?.type || null,
          confidence: embeddingMatch?.confidence || 0,
          weight: this.options.weights.embedding,
          evidence: embeddingMatch?.evidence || ''
        },
        {
          signal: 'pattern',
          type: patternMatch?.type || null,
          confidence: patternMatch?.confidence || 0,
          weight: this.options.weights.pattern,
          evidence: patternMatch?.evidence || ''
        },
        {
          signal: 'context',
          type: contextMatch?.type || null,
          confidence: contextMatch?.confidence || 0,
          weight: this.options.weights.context,
          evidence: contextMatch?.evidence || ''
        }
      ]

      // Combine using ensemble or best signal
      const result = this.options.enableEnsemble
        ? this.combineEnsemble(signalResults)
        : this.selectBestSignal(signalResults)

      // Cache result (including nulls to avoid recomputation)
      this.addToCache(cacheKey, result)

      // Update statistics
      if (result) {
        this.updateStatistics(result)
      }

      return result
    } catch (error) {
      // Graceful degradation
      console.warn(`SmartRelationshipExtractor error for "${subject} → ${object}":`, error)
      return null
    }
  }

  /**
   * Combine signal results using ensemble voting
   *
   * Applies weighted voting with confidence boosting when signals agree
   */
  private combineEnsemble(
    signalResults: SignalResult[]
  ): RelationshipExtractionResult | null {
    // Filter out null results
    const validResults = signalResults.filter(r => r.type !== null)

    if (validResults.length === 0) {
      return null
    }

    // Count votes by type with weighted confidence
    const typeScores = new Map<VerbType, { score: number; signals: SignalResult[] }>()

    for (const result of validResults) {
      if (!result.type) continue

      const weighted = result.confidence * result.weight
      const existing = typeScores.get(result.type)

      if (existing) {
        existing.score += weighted
        existing.signals.push(result)
      } else {
        typeScores.set(result.type, { score: weighted, signals: [result] })
      }
    }

    // Find best type
    let bestType: VerbType | null = null
    let bestScore = 0
    let bestSignals: SignalResult[] = []

    for (const [type, data] of typeScores.entries()) {
      // Apply agreement boost (multiple signals agree)
      let finalScore = data.score
      if (data.signals.length > 1) {
        const agreementBoost = 0.05 * (data.signals.length - 1)
        finalScore += agreementBoost
        this.stats.agreementBoosts++
      }

      if (finalScore > bestScore) {
        bestScore = finalScore
        bestType = type
        bestSignals = data.signals
      }
    }

    // Check minimum confidence threshold
    if (!bestType || bestScore < this.options.minConfidence) {
      return null
    }

    // Track signal contributions
    const usedSignals = bestSignals.length
    this.stats.averageSignalsUsed =
      (this.stats.averageSignalsUsed * (this.stats.calls - 1) + usedSignals) / this.stats.calls

    // Build evidence string
    const signalNames = bestSignals.map(s => s.signal).join(' + ')
    const evidence = `Ensemble: ${signalNames} (${bestSignals.length} signal${bestSignals.length > 1 ? 's' : ''} agree)`

    return {
      type: bestType,
      confidence: Math.min(bestScore, 1.0), // Cap at 1.0
      weight: Math.min(bestScore, 1.0),
      source: 'ensemble',
      evidence,
      metadata: {
        signalResults: bestSignals.map(s => ({
          signal: s.signal,
          type: s.type!,
          confidence: s.confidence,
          weight: s.weight
        })),
        agreementBoost: bestSignals.length > 1 ? 0.05 * (bestSignals.length - 1) : 0
      }
    }
  }

  /**
   * Select best single signal (when ensemble is disabled)
   */
  private selectBestSignal(
    signalResults: SignalResult[]
  ): RelationshipExtractionResult | null {
    // Filter valid results and sort by weighted confidence
    const validResults = signalResults
      .filter(r => r.type !== null)
      .map(r => ({ ...r, weightedScore: r.confidence * r.weight }))
      .sort((a, b) => b.weightedScore - a.weightedScore)

    if (validResults.length === 0) {
      return null
    }

    const best = validResults[0]

    if (best.weightedScore < this.options.minConfidence) {
      return null
    }

    return {
      type: best.type!,
      confidence: best.confidence,
      weight: best.confidence,
      source: best.signal,
      evidence: best.evidence,
      metadata: undefined
    }
  }

  /**
   * Update statistics based on result
   */
  private updateStatistics(result: RelationshipExtractionResult): void {
    // Track win counts
    if (result.source === 'ensemble') {
      this.stats.ensembleWins++
    } else if (result.source === 'embedding') {
      this.stats.embeddingWins++
    } else if (result.source === 'pattern') {
      this.stats.patternWins++
    } else if (result.source === 'context') {
      this.stats.contextWins++
    }

    // Update rolling average confidence
    this.stats.averageConfidence =
      (this.stats.averageConfidence * (this.stats.calls - 1) + result.confidence) / this.stats.calls
  }

  /**
   * Get cache key from parameters
   */
  private getCacheKey(subject: string, object: string, context: string): string {
    const normalized = `${subject}:${object}:${context.substring(0, 100)}`.toLowerCase().trim()
    return normalized
  }

  /**
   * Get from LRU cache
   */
  private getFromCache(key: string): RelationshipExtractionResult | null | undefined {
    if (!this.cache.has(key)) return undefined

    const cached = this.cache.get(key)

    // Move to end (most recently used)
    this.cacheOrder = this.cacheOrder.filter(k => k !== key)
    this.cacheOrder.push(key)

    return cached ?? null
  }

  /**
   * Add to LRU cache with eviction
   */
  private addToCache(key: string, value: RelationshipExtractionResult | null): void {
    this.cache.set(key, value)
    this.cacheOrder.push(key)

    // Evict oldest if over limit
    if (this.cache.size > this.options.cacheSize) {
      const oldest = this.cacheOrder.shift()
      if (oldest) {
        this.cache.delete(oldest)
      }
    }
  }

  /**
   * Get comprehensive statistics
   */
  getStats() {
    return {
      ...this.stats,
      cacheSize: this.cache.size,
      cacheHitRate: this.stats.calls > 0 ? this.stats.cacheHits / this.stats.calls : 0,
      ensembleRate: this.stats.calls > 0 ? this.stats.ensembleWins / this.stats.calls : 0,
      signalStats: {
        embedding: this.embeddingSignal.getStats(),
        pattern: this.patternSignal.getStats(),
        context: this.contextSignal.getStats()
      }
    }
  }

  /**
   * Reset all statistics
   */
  resetStats(): void {
    this.stats = {
      calls: 0,
      cacheHits: 0,
      embeddingWins: 0,
      patternWins: 0,
      contextWins: 0,
      ensembleWins: 0,
      agreementBoosts: 0,
      averageConfidence: 0,
      averageSignalsUsed: 0
    }

    this.embeddingSignal.resetStats()
    this.patternSignal.resetStats()
    this.contextSignal.resetStats()
  }

  /**
   * Clear all caches
   */
  clearCache(): void {
    this.cache.clear()
    this.cacheOrder = []

    this.embeddingSignal.clearCache()
    this.patternSignal.clearCache()
    this.contextSignal.clearCache()
  }

  /**
   * Add relationship to historical data (for embedding signal temporal boosting)
   */
  addToHistory(context: string, type: VerbType, vector: number[]): void {
    this.embeddingSignal.addToHistory(context, type, vector)
  }

  /**
   * Clear historical data
   */
  clearHistory(): void {
    this.embeddingSignal.clearHistory()
  }
}

/**
 * Create a new SmartRelationshipExtractor instance
 *
 * Convenience factory function
 */
export function createSmartRelationshipExtractor(
  brain: Brainy,
  options?: SmartRelationshipExtractorOptions
): SmartRelationshipExtractor {
  return new SmartRelationshipExtractor(brain, options)
}
