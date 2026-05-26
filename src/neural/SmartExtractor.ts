/**
 * SmartExtractor - Unified entity type extraction using ensemble of neural signals
 *
 * PRODUCTION-READY: Single orchestration class for all entity type classification
 *
 * Design Philosophy:
 * - Simplicity over complexity (KISS principle)
 * - One class instead of multiple strategy layers
 * - Clear execution path for debugging
 * - Comprehensive format intelligence built-in
 *
 * Ensemble Architecture:
 * - ExactMatchSignal (40%) - Explicit patterns and exact keywords
 * - EmbeddingSignal (35%) - Neural similarity with type embeddings
 * - PatternSignal (20%) - Regex patterns and naming conventions
 * - ContextSignal (5%) - Relationship-based inference
 *
 * Format Intelligence:
 * Supports 7 major formats with automatic hint extraction:
 * - Excel (.xlsx): Column headers, sheet names, "Related Terms" detection
 * - CSV (.csv): Header row patterns, naming conventions
 * - PDF (.pdf): Form field names and labels
 * - YAML (.yaml, .yml): Semantic key names
 * - DOCX (.docx): Heading levels and structure
 * - JSON (.json): Field name patterns
 * - Markdown (.md): Heading hierarchy
 *
 * Performance:
 * - Parallel signal execution (~15ms total)
 * - LRU caching for hot entities
 * - Confidence boosting when signals agree
 * - Graceful degradation on errors
 */

import type { Brainy } from '../brainy.js'
import type { NounType } from '../types/graphTypes.js'
import type { Vector } from '../coreTypes.js'
import { ExactMatchSignal } from './signals/ExactMatchSignal.js'
import { PatternSignal } from './signals/PatternSignal.js'
import { EmbeddingSignal } from './signals/EmbeddingSignal.js'
import { ContextSignal } from './signals/ContextSignal.js'
import type { TypeSignal as ExactTypeSignal } from './signals/ExactMatchSignal.js'
import type { TypeSignal as PatternTypeSignal } from './signals/PatternSignal.js'
import type { TypeSignal as EmbeddingTypeSignal } from './signals/EmbeddingSignal.js'
import type { TypeSignal as ContextTypeSignal } from './signals/ContextSignal.js'

/**
 * Extraction result with full traceability
 */
export interface ExtractionResult {
  type: NounType
  confidence: number
  source: 'ensemble' | 'exact-match' | 'pattern' | 'embedding' | 'context'
  evidence: string
  metadata?: {
    signalResults?: Array<{
      signal: string
      type: NounType
      confidence: number
      weight: number
    }>
    agreementBoost?: number
    formatHints?: string[]
    formatContext?: FormatContext
  }
}

/**
 * Format context for classification
 */
export interface FormatContext {
  format?: 'excel' | 'csv' | 'pdf' | 'yaml' | 'docx' | 'json' | 'markdown'
  columnHeader?: string      // Excel/CSV column header
  fieldName?: string         // PDF form field name or JSON field
  yamlKey?: string          // YAML key name
  headingLevel?: number     // DOCX/Markdown heading level
  sheetName?: string        // Excel sheet name
  metadata?: Record<string, any>
}

/**
 * Options for SmartExtractor
 */
export interface SmartExtractorOptions {
  minConfidence?: number        // Minimum confidence threshold (default: 0.60)
  enableFormatHints?: boolean   // Use format-specific hints (default: true)
  enableEnsemble?: boolean      // Use ensemble vs single best signal (default: true)
  cacheSize?: number           // LRU cache size (default: 2000)
  weights?: {                  // Custom signal weights (must sum to 1.0)
    exactMatch?: number        // Default: 0.40
    embedding?: number         // Default: 0.35
    pattern?: number           // Default: 0.20
    context?: number           // Default: 0.05
  }
}

/**
 * Internal signal result wrapper
 */
interface SignalResult {
  signal: 'exact-match' | 'pattern' | 'embedding' | 'context'
  type: NounType | null
  confidence: number
  weight: number
  evidence: string
}

/**
 * SmartExtractor - Unified entity type classification
 *
 * This is the single entry point for all entity type extraction.
 * It orchestrates all 4 signals, applies format intelligence,
 * and combines results using ensemble weighting.
 *
 * Production features:
 * - Parallel signal execution for performance
 * - Format-specific hint extraction
 * - Ensemble voting with confidence boosting
 * - Comprehensive statistics and observability
 * - LRU caching for hot paths
 * - Graceful error handling
 */
export class SmartExtractor {
  private brain: Brainy
  private options: Required<Omit<SmartExtractorOptions, 'weights'>> & { weights: Required<NonNullable<SmartExtractorOptions['weights']>> }

  // Signal instances
  private exactMatchSignal: ExactMatchSignal
  private patternSignal: PatternSignal
  private embeddingSignal: EmbeddingSignal
  private contextSignal: ContextSignal

  // LRU cache
  private cache: Map<string, ExtractionResult | null> = new Map()
  private cacheOrder: string[] = []

  // Statistics
  private stats = {
    calls: 0,
    cacheHits: 0,
    exactMatchWins: 0,
    patternWins: 0,
    embeddingWins: 0,
    contextWins: 0,
    ensembleWins: 0,
    agreementBoosts: 0,
    formatHintsUsed: 0,
    averageConfidence: 0,
    averageSignalsUsed: 0
  }

  constructor(brain: Brainy, options?: SmartExtractorOptions) {
    this.brain = brain

    // Set default options
    this.options = {
      minConfidence: options?.minConfidence ?? 0.60,
      enableFormatHints: options?.enableFormatHints ?? true,
      enableEnsemble: options?.enableEnsemble ?? true,
      cacheSize: options?.cacheSize ?? 2000,
      weights: {
        exactMatch: options?.weights?.exactMatch ?? 0.40,
        embedding: options?.weights?.embedding ?? 0.35,
        pattern: options?.weights?.pattern ?? 0.20,
        context: options?.weights?.context ?? 0.05
      }
    }

    // Validate weights sum to 1.0
    const weightSum = Object.values(this.options.weights).reduce((a, b) => a + b, 0)
    if (Math.abs(weightSum - 1.0) > 0.01) {
      throw new Error(`Signal weights must sum to 1.0, got ${weightSum}`)
    }

    // Initialize signals
    this.exactMatchSignal = new ExactMatchSignal(brain, {
      minConfidence: 0.50, // Lower threshold, ensemble will filter
      cacheSize: Math.floor(this.options.cacheSize / 4)
    })

    this.patternSignal = new PatternSignal(brain, {
      minConfidence: 0.50,
      cacheSize: Math.floor(this.options.cacheSize / 4)
    })

    this.embeddingSignal = new EmbeddingSignal(brain, {
      minConfidence: 0.50,
      checkGraph: true,
      checkHistory: true,
      cacheSize: Math.floor(this.options.cacheSize / 4)
    })

    this.contextSignal = new ContextSignal(brain, {
      minConfidence: 0.50,
      cacheSize: Math.floor(this.options.cacheSize / 4)
    })
  }

  /**
   * Extract entity type using ensemble of signals
   *
   * Main entry point - orchestrates all signals and combines results
   *
   * @param candidate Entity text to classify
   * @param context Classification context with format hints
   * @returns ExtractionResult with type and confidence
   */
  async extract(
    candidate: string,
    context?: {
      definition?: string
      formatContext?: FormatContext
      allTerms?: string[]
      metadata?: any
      /** Pre-computed candidate embedding (from a batch embed) — forwarded to EmbeddingSignal. */
      vector?: Vector
    },
    minConfidence?: number
  ): Promise<ExtractionResult | null> {
    this.stats.calls++

    // Per-call confidence threshold (falls back to the instance default). This lets callers
    // such as brain.extractEntities({ confidence }) actually loosen or tighten the gate; it is
    // part of the cache key below so results computed at one threshold are not reused at another.
    const threshold = minConfidence ?? this.options.minConfidence

    // Check cache first
    const cacheKey = this.getCacheKey(candidate, context, threshold)
    const cached = this.getFromCache(cacheKey)
    if (cached !== undefined) {
      this.stats.cacheHits++
      return cached
    }

    try {
      // Extract format hints if enabled
      const formatHints = this.options.enableFormatHints && context?.formatContext
        ? this.extractFormatHints(context.formatContext)
        : []

      if (formatHints.length > 0) {
        this.stats.formatHintsUsed++
      }

      // Build enriched context with format hints
      const enrichedContext = {
        definition: context?.definition,
        allTerms: [...(context?.allTerms || []), ...formatHints],
        metadata: context?.metadata,
        vector: context?.vector
      }

      // Execute all signals in parallel
      const [exactMatch, patternMatch, embeddingMatch, contextMatch] = await Promise.all([
        this.exactMatchSignal.classify(candidate, enrichedContext).catch(() => null),
        this.patternSignal.classify(candidate, enrichedContext).catch(() => null),
        this.embeddingSignal.classify(candidate, enrichedContext).catch(() => null),
        this.contextSignal.classify(candidate, enrichedContext).catch(() => null)
      ])

      // Wrap results with weights
      const signalResults: SignalResult[] = [
        {
          signal: 'exact-match',
          type: exactMatch?.type || null,
          confidence: exactMatch?.confidence || 0,
          weight: this.options.weights.exactMatch,
          evidence: exactMatch?.evidence || ''
        },
        {
          signal: 'pattern',
          type: patternMatch?.type || null,
          confidence: patternMatch?.confidence || 0,
          weight: this.options.weights.pattern,
          evidence: patternMatch?.evidence || ''
        },
        {
          signal: 'embedding',
          type: embeddingMatch?.type || null,
          confidence: embeddingMatch?.confidence || 0,
          weight: this.options.weights.embedding,
          evidence: embeddingMatch?.evidence || ''
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
        ? this.combineEnsemble(signalResults, formatHints, context?.formatContext, threshold)
        : this.selectBestSignal(signalResults, formatHints, context?.formatContext, threshold)

      // Cache result (including nulls to avoid recomputation)
      this.addToCache(cacheKey, result)

      // Update statistics
      if (result) {
        this.updateStatistics(result)
      }

      return result
    } catch (error) {
      // Graceful degradation
      console.warn(`SmartExtractor error for "${candidate}":`, error)
      return null
    }
  }

  /**
   * Extract format-specific hints from context
   *
   * Returns array of hint strings that can help with classification
   */
  private extractFormatHints(formatContext: FormatContext): string[] {
    const hints: string[] = []

    switch (formatContext.format) {
      case 'excel':
        hints.push(...this.extractExcelHints(formatContext))
        break

      case 'csv':
        hints.push(...this.extractCsvHints(formatContext))
        break

      case 'pdf':
        hints.push(...this.extractPdfHints(formatContext))
        break

      case 'yaml':
        hints.push(...this.extractYamlHints(formatContext))
        break

      case 'docx':
        hints.push(...this.extractDocxHints(formatContext))
        break

      case 'json':
        hints.push(...this.extractJsonHints(formatContext))
        break

      case 'markdown':
        hints.push(...this.extractMarkdownHints(formatContext))
        break
    }

    return hints.filter(h => h && h.trim().length > 0)
  }

  /**
   * Extract Excel-specific hints
   */
  private extractExcelHints(context: FormatContext): string[] {
    const hints: string[] = []

    if (context.columnHeader) {
      hints.push(context.columnHeader)

      // Extract type keywords from header
      const headerLower = context.columnHeader.toLowerCase()
      const typeKeywords = [
        'person', 'people', 'user', 'author', 'creator', 'employee', 'member',
        'organization', 'company', 'org', 'business',
        'location', 'place', 'city', 'country', 'address',
        'event', 'meeting', 'conference', 'workshop',
        'concept', 'idea', 'term', 'definition',
        'document', 'file', 'report', 'paper',
        'project', 'initiative', 'program',
        'product', 'service', 'offering',
        'date', 'time', 'timestamp', 'when'
      ]

      for (const keyword of typeKeywords) {
        if (headerLower.includes(keyword)) {
          hints.push(keyword)
        }
      }
    }

    if (context.sheetName) {
      hints.push(context.sheetName)
    }

    return hints
  }

  /**
   * Extract CSV-specific hints
   */
  private extractCsvHints(context: FormatContext): string[] {
    const hints: string[] = []

    if (context.columnHeader) {
      hints.push(context.columnHeader)

      // Parse underscore/hyphen patterns
      const headerLower = context.columnHeader.toLowerCase()
      if (headerLower.includes('_') || headerLower.includes('-')) {
        const parts = headerLower.split(/[_-]/)
        hints.push(...parts)
      }
    }

    return hints
  }

  /**
   * Extract PDF-specific hints
   */
  private extractPdfHints(context: FormatContext): string[] {
    const hints: string[] = []

    if (context.fieldName) {
      hints.push(context.fieldName)

      // Convert snake_case or camelCase to words
      const words = context.fieldName
        .replace(/([A-Z])/g, ' $1')
        .replace(/[_-]/g, ' ')
        .trim()
        .split(/\s+/)

      hints.push(...words)
    }

    return hints
  }

  /**
   * Extract YAML-specific hints
   */
  private extractYamlHints(context: FormatContext): string[] {
    const hints: string[] = []

    if (context.yamlKey) {
      hints.push(context.yamlKey)

      // Parse key structure
      const keyWords = context.yamlKey
        .replace(/([A-Z])/g, ' $1')
        .replace(/[-_]/g, ' ')
        .trim()
        .split(/\s+/)

      hints.push(...keyWords)
    }

    return hints
  }

  /**
   * Extract DOCX-specific hints
   */
  private extractDocxHints(context: FormatContext): string[] {
    const hints: string[] = []

    if (context.headingLevel !== undefined) {
      // Heading 1 = major entities (organizations, projects)
      // Heading 2-3 = sub-entities (people, concepts)
      if (context.headingLevel === 1) {
        hints.push('major entity', 'organization', 'project')
      } else if (context.headingLevel === 2) {
        hints.push('sub entity', 'person', 'concept')
      }
    }

    return hints
  }

  /**
   * Extract JSON-specific hints
   */
  private extractJsonHints(context: FormatContext): string[] {
    const hints: string[] = []

    if (context.fieldName) {
      hints.push(context.fieldName)

      // Parse camelCase or snake_case
      const words = context.fieldName
        .replace(/([A-Z])/g, ' $1')
        .replace(/[_-]/g, ' ')
        .trim()
        .split(/\s+/)

      hints.push(...words)
    }

    return hints
  }

  /**
   * Extract Markdown-specific hints
   */
  private extractMarkdownHints(context: FormatContext): string[] {
    const hints: string[] = []

    if (context.headingLevel !== undefined) {
      if (context.headingLevel === 1) {
        hints.push('major entity')
      } else if (context.headingLevel === 2) {
        hints.push('sub entity')
      }
    }

    return hints
  }

  /**
   * Combine signal results using ensemble voting
   *
   * Applies weighted voting with confidence boosting when signals agree
   */
  private combineEnsemble(
    signalResults: SignalResult[],
    formatHints: string[],
    formatContext?: FormatContext,
    minConfidence: number = this.options.minConfidence
  ): ExtractionResult | null {
    // Filter out null results
    const validResults = signalResults.filter(r => r.type !== null)

    if (validResults.length === 0) {
      return null
    }

    // Group the signals by the type they voted for
    const typeScores = new Map<NounType, SignalResult[]>()

    for (const result of validResults) {
      if (!result.type) continue

      const existing = typeScores.get(result.type)
      if (existing) {
        existing.push(result)
      } else {
        typeScores.set(result.type, [result])
      }
    }

    // Score each candidate type by a NORMALIZED, weighted-average confidence
    // — Σ(confidence·weight) / Σ(weight of its signals) — plus a small boost when
    // multiple signals concur, then select the type with the highest such confidence.
    //
    // Why an average and not a sum (this was the bug): a weighted *sum* lives on the
    // signal-weight scale, so two signals agreeing on a fresh brain summed to ≈0.37 —
    // below the 0.60 gate — meaning agreement was effectively *penalized*. Worse, selecting
    // the best type by that sum let a high-weight signal with mediocre confidence
    // (embedding @0.51 · 0.35 = 0.179) outrank a low-weight signal with high confidence
    // (pattern @0.82 · 0.20 = 0.164); the wrong type won selection, then failed the threshold
    // on its own 0.51 confidence, and the whole extraction returned null. Averaging keeps the
    // score on the same 0–1 scale as the threshold, so selection and the gate agree and the
    // most-confident type wins (pattern @0.82 here).
    let bestType: NounType | null = null
    let finalConfidence = 0
    let bestSignals: SignalResult[] = []

    for (const [type, signals] of typeScores.entries()) {
      const weightSum = signals.reduce((sum, s) => sum + s.weight, 0)
      const weightedConfidence = signals.reduce((sum, s) => sum + s.confidence * s.weight, 0)
      let confidence = weightSum > 0 ? weightedConfidence / weightSum : 0

      // Reward agreement between independent signals
      if (signals.length > 1) {
        confidence = Math.min(confidence + 0.05 * (signals.length - 1), 1.0)
      }

      if (confidence > finalConfidence) {
        finalConfidence = confidence
        bestType = type
        bestSignals = signals
      }
    }

    // Check minimum confidence threshold
    if (!bestType || finalConfidence < minConfidence) {
      return null
    }

    if (bestSignals.length > 1) {
      this.stats.agreementBoosts++
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
      confidence: Math.min(finalConfidence, 1.0), // Cap at 1.0
      source: 'ensemble',
      evidence,
      metadata: {
        signalResults: bestSignals.map(s => ({
          signal: s.signal,
          type: s.type!,
          confidence: s.confidence,
          weight: s.weight
        })),
        agreementBoost: bestSignals.length > 1 ? 0.05 * (bestSignals.length - 1) : 0,
        formatHints: formatHints.length > 0 ? formatHints : undefined,
        formatContext
      }
    }
  }

  /**
   * Select best single signal (when ensemble is disabled)
   */
  private selectBestSignal(
    signalResults: SignalResult[],
    formatHints: string[],
    formatContext?: FormatContext,
    minConfidence: number = this.options.minConfidence
  ): ExtractionResult | null {
    // Select by confidence — the same metric the threshold checks below. Sorting by
    // weighted score (confidence·weight) instead would let a high-weight, mediocre-confidence
    // signal outrank a low-weight, high-confidence one and then fail the gate, dropping the
    // result entirely (the same defect fixed in combineEnsemble). Weight matters for ensemble
    // voting, not for picking the single best signal.
    const validResults = signalResults
      .filter(r => r.type !== null)
      .sort((a, b) => b.confidence - a.confidence)

    if (validResults.length === 0) {
      return null
    }

    const best = validResults[0]

    if (best.confidence < minConfidence) {
      return null
    }

    return {
      type: best.type!,
      confidence: best.confidence,
      source: best.signal as any,
      evidence: best.evidence,
      metadata: {
        formatHints: formatHints.length > 0 ? formatHints : undefined,
        formatContext
      }
    }
  }

  /**
   * Update statistics based on result
   */
  private updateStatistics(result: ExtractionResult): void {
    // Track win counts
    if (result.source === 'ensemble') {
      this.stats.ensembleWins++
    } else if (result.source === 'exact-match') {
      this.stats.exactMatchWins++
    } else if (result.source === 'pattern') {
      this.stats.patternWins++
    } else if (result.source === 'embedding') {
      this.stats.embeddingWins++
    } else if (result.source === 'context') {
      this.stats.contextWins++
    }

    // Update rolling average confidence
    this.stats.averageConfidence =
      (this.stats.averageConfidence * (this.stats.calls - 1) + result.confidence) / this.stats.calls
  }

  /**
   * Get cache key from candidate and context
   */
  private getCacheKey(candidate: string, context?: any, minConfidence?: number): string {
    const normalized = candidate.toLowerCase().trim()
    const defSnippet = context?.definition?.substring(0, 50) || ''
    const format = context?.formatContext?.format || ''
    const threshold = minConfidence ?? this.options.minConfidence
    return `${normalized}:${defSnippet}:${format}:${threshold}`
  }

  /**
   * Get from LRU cache
   */
  private getFromCache(key: string): ExtractionResult | null | undefined {
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
  private addToCache(key: string, value: ExtractionResult | null): void {
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
      formatHintRate: this.stats.calls > 0 ? this.stats.formatHintsUsed / this.stats.calls : 0,
      signalStats: {
        exactMatch: this.exactMatchSignal.getStats(),
        pattern: this.patternSignal.getStats(),
        embedding: this.embeddingSignal.getStats(),
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
      exactMatchWins: 0,
      patternWins: 0,
      embeddingWins: 0,
      contextWins: 0,
      ensembleWins: 0,
      agreementBoosts: 0,
      formatHintsUsed: 0,
      averageConfidence: 0,
      averageSignalsUsed: 0
    }

    this.exactMatchSignal.resetStats()
    this.patternSignal.resetStats()
    this.embeddingSignal.resetStats()
    this.contextSignal.resetStats()
  }

  /**
   * Clear all caches
   */
  clearCache(): void {
    this.cache.clear()
    this.cacheOrder = []

    this.exactMatchSignal.clearCache()
    this.patternSignal.clearCache()
    this.embeddingSignal.clearCache()
    this.contextSignal.clearCache()
  }

  /**
   * Add entity to historical data (for embedding signal temporal boosting)
   */
  addToHistory(text: string, type: NounType, vector: number[]): void {
    this.embeddingSignal.addToHistory(text, type, vector)
  }

  /**
   * Clear historical data
   */
  clearHistory(): void {
    this.embeddingSignal.clearHistory()
  }
}

/**
 * Create a new SmartExtractor instance
 *
 * Convenience factory function
 */
export function createSmartExtractor(
  brain: Brainy,
  options?: SmartExtractorOptions
): SmartExtractor {
  return new SmartExtractor(brain, options)
}
