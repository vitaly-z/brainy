/**
 * Neural Entity Extractor using Brainy's NounTypes
 * Uses embeddings and similarity matching for accurate type detection
 *
 * v4.2.0: Now powered by SmartExtractor for ultra-neural classification
 * PRODUCTION-READY with caching support
 */

import { NounType } from '../types/graphTypes.js'
import { Vector } from '../coreTypes.js'
import type { Brainy } from '../brainy.js'
import {
  EntityExtractionCache,
  EntityCacheOptions,
  generateFileCacheKey,
  generateContentCacheKey,
  computeContentHash
} from './entityExtractionCache.js'
import { getNounTypeEmbeddings } from './embeddedTypeEmbeddings.js'
import { SmartExtractor, type FormatContext } from './SmartExtractor.js'

export interface ExtractedEntity {
  text: string
  type: NounType
  position: { start: number; end: number }
  confidence: number
  weight?: number // v4.2.0: Entity importance/salience
  vector?: Vector
  metadata?: any
}

export class NeuralEntityExtractor {
  private brain: Brainy | Brainy<any>

  // Type embeddings for similarity matching
  private typeEmbeddings: Map<NounType, Vector> = new Map()
  private initialized = false

  // Entity extraction cache
  private cache: EntityExtractionCache

  // Runtime embedding cache for performance (v3.38.0)
  // Caches candidate embeddings during an extraction session to avoid redundant model calls
  private embeddingCache: Map<string, Vector> = new Map()
  private embeddingCacheStats = {
    hits: 0,
    misses: 0,
    size: 0
  }

  // v4.2.0: SmartExtractor for ultra-neural classification
  private smartExtractor: SmartExtractor

  constructor(brain: Brainy | Brainy<any>, cacheOptions?: EntityCacheOptions) {
    this.brain = brain
    this.cache = new EntityExtractionCache(cacheOptions)
    this.smartExtractor = new SmartExtractor(brain, {
      enableEnsemble: true,
      enableFormatHints: true,
      minConfidence: 0.60
    })
  }
  
  /**
   * Initialize type embeddings for neural matching
   * PRODUCTION OPTIMIZATION (v3.33.0): Uses pre-computed embeddings from build time
   * Zero runtime cost - embeddings are loaded instantly from embedded data
   */
  private async initializeTypeEmbeddings(requestedTypes?: NounType[]): Promise<void> {
    // Skip if already initialized
    if (this.initialized) return

    // Load pre-computed embeddings (instant, no computation)
    const allEmbeddings = getNounTypeEmbeddings()

    // If specific types requested, only load those; otherwise load all
    const typesToLoad = requestedTypes || Object.values(NounType)

    for (const type of typesToLoad) {
      const embedding = allEmbeddings.get(type)
      if (embedding) {
        this.typeEmbeddings.set(type, embedding)
      }
    }

    // Mark as initialized if we've loaded at least some types
    if (this.typeEmbeddings.size > 0) {
      this.initialized = true
    }
  }
  
  /**
   * Extract entities from text using neural matching
   * Now with caching support for performance
   */
  async extract(
    text: string,
    options?: {
      types?: NounType[]
      confidence?: number
      includeVectors?: boolean
      neuralMatching?: boolean
      path?: string  // File path for cache key
      cache?: {      // Cache options
        enabled?: boolean
        ttl?: number
        invalidateOn?: 'mtime' | 'hash'
        mtime?: number  // File modification time
      }
    }
  ): Promise<ExtractedEntity[]> {
    // PRODUCTION OPTIMIZATION (v3.33.0): Load pre-computed type embeddings
    // Zero runtime cost - embeddings were computed at build time
    await this.initializeTypeEmbeddings(options?.types)

    // Check cache if enabled
    if (options?.cache?.enabled !== false && (options?.path || options?.cache?.invalidateOn === 'hash')) {
      const cacheKey = options.path
        ? generateFileCacheKey(options.path)
        : generateContentCacheKey(text)

      const cacheOptions = {
        mtime: options.cache?.mtime,
        contentHash: !options.path ? computeContentHash(text) : undefined
      }

      const cached = this.cache.get(cacheKey, cacheOptions)
      if (cached) {
        return cached
      }
    }

    const entities: ExtractedEntity[] = []
    const minConfidence = options?.confidence || 0.6
    const targetTypes = options?.types || Object.values(NounType)
    const useNeuralMatching = options?.neuralMatching !== false // Default true
    
    // Step 1: Extract potential entities using patterns
    const candidates = await this.extractCandidates(text)
    
    // Step 2: Classify each candidate using SmartExtractor (v4.2.0)
    for (const candidate of candidates) {
      // Use SmartExtractor for unified neural + rule-based classification
      const classification = await this.smartExtractor.extract(candidate.text, {
        definition: candidate.context,
        allTerms: [candidate.text, candidate.context]
      })

      // Skip if SmartExtractor returns null (low confidence) or below threshold
      if (!classification || classification.confidence < minConfidence) {
        continue
      }

      // Filter by requested types if specified
      if (options?.types && !options.types.includes(classification.type)) {
        continue
      }

      // Calculate weight from signal results (average of all signals that voted)
      const signalResults = classification.metadata?.signalResults || []
      const avgWeight = signalResults.length > 0
        ? signalResults.reduce((sum: number, s: any) => sum + s.weight, 0) / signalResults.length
        : 1.0

      const entity: ExtractedEntity = {
        text: candidate.text,
        type: classification.type,
        position: candidate.position,
        confidence: classification.confidence,
        weight: avgWeight
      }

      if (options?.includeVectors) {
        entity.vector = await this.getEmbedding(candidate.text)
      }

      entities.push(entity)
    }

    // Remove duplicates and overlaps
    const deduplicatedEntities = this.deduplicateEntities(entities)

    // Store in cache if enabled
    if (options?.cache?.enabled !== false && (options?.path || options?.cache?.invalidateOn === 'hash')) {
      const cacheKey = options.path
        ? generateFileCacheKey(options.path)
        : generateContentCacheKey(text)

      this.cache.set(cacheKey, deduplicatedEntities, {
        ttl: options.cache?.ttl,
        mtime: options.cache?.mtime,
        contentHash: !options.path ? computeContentHash(text) : undefined
      })
    }

    return deduplicatedEntities
  }
  
  /**
   * Extract candidate entities using patterns
   */
  private async extractCandidates(text: string): Promise<Array<{
    text: string
    position: { start: number; end: number }
    context: string
  }>> {
    const candidates: Array<{
      text: string
      position: { start: number; end: number }
      context: string
    }> = []
    
    // Enhanced patterns for entity detection
    const patterns = [
      // Capitalized words (potential names, places, organizations)
      /\b([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)*)\b/g,
      // Email addresses
      /\b([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})\b/g,
      // URLs
      /\b(https?:\/\/[^\s]+|www\.[^\s]+)\b/g,
      // Phone numbers
      /\b(\+?\d{1,3}?[- .]?\(?\d{1,4}\)?[- .]?\d{1,4}[- .]?\d{1,4})\b/g,
      // Dates
      /\b(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}|\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2})\b/g,
      // Money amounts
      /\b(\$[\d,]+(?:\.\d{2})?|[\d,]+(?:\.\d{2})?\s*(?:USD|EUR|GBP|JPY|CNY))\b/gi,
      // Percentages
      /\b(\d+(?:\.\d+)?%)\b/g,
      // Hashtags and mentions
      /([#@][a-zA-Z0-9_]+)/g,
      // Product versions
      /\b([A-Z][a-zA-Z0-9]+\s+v?\d+(?:\.\d+)*)\b/g,
      // Quoted strings (potential names, titles)
      /"([^"]+)"/g,
      /'([^']+)'/g
    ]
    
    for (const pattern of patterns) {
      let match
      while ((match = pattern.exec(text)) !== null) {
        const extractedText = match[1] || match[0]
        
        // Skip too short or too long
        if (extractedText.length < 2 || extractedText.length > 100) continue
        
        // Get context (surrounding text)
        const contextStart = Math.max(0, match.index - 30)
        const contextEnd = Math.min(text.length, match.index + match[0].length + 30)
        const context = text.substring(contextStart, contextEnd)
        
        candidates.push({
          text: extractedText,
          position: {
            start: match.index,
            end: match.index + match[0].length
          },
          context
        })
      }
    }
    
    return candidates
  }
  
  /**
   * Get context-based confidence boost for type matching
   */
  private getContextBoost(text: string, context: string, type: NounType): number {
    const contextLower = context.toLowerCase()
    let boost = 0
    
    // Context clues for each type
    const contextClues: Record<NounType, string[]> = {
      [NounType.Person]: ['mr', 'ms', 'mrs', 'dr', 'prof', 'said', 'told', 'wrote'],
      [NounType.Organization]: ['inc', 'corp', 'llc', 'ltd', 'company', 'announced'],
      [NounType.Location]: ['in', 'at', 'from', 'to', 'near', 'located', 'city', 'country'],
      [NounType.Document]: ['file', 'document', 'report', 'paper', 'pdf', 'doc'],
      [NounType.Event]: ['event', 'conference', 'meeting', 'summit', 'on', 'at'],
      [NounType.Product]: ['product', 'version', 'release', 'model', 'buy', 'sell'],
      [NounType.Currency]: ['$', '€', '£', '¥', 'usd', 'eur', 'price', 'cost'],
      [NounType.Message]: ['email', 'message', 'sent', 'received', 'wrote', 'reply'],
      // Add more context clues as needed
    } as any
    
    const clues = contextClues[type] || []
    for (const clue of clues) {
      if (contextLower.includes(clue)) {
        boost += 0.1
      }
    }
    
    return Math.min(boost, 0.3) // Cap boost at 0.3
  }
  
  /**
   * Rule-based classification fallback
   */
  private classifyByRules(candidate: {
    text: string
    context: string
  }): { type: NounType; confidence: number } {
    const text = candidate.text
    
    // Email
    if (text.includes('@')) {
      return { type: NounType.Message, confidence: 0.9 }
    }
    
    // URL
    if (text.startsWith('http') || text.startsWith('www.')) {
      return { type: NounType.Resource, confidence: 0.9 }
    }
    
    // Money
    if (text.startsWith('$') || /\d+\.\d{2}/.test(text)) {
      return { type: NounType.Currency, confidence: 0.85 }
    }
    
    // Percentage
    if (text.endsWith('%')) {
      return { type: NounType.Measurement, confidence: 0.85 }
    }
    
    // Date pattern
    if (/\d{1,2}[\/\-]\d{1,2}/.test(text)) {
      return { type: NounType.Event, confidence: 0.7 }
    }
    
    // Hashtag
    if (text.startsWith('#')) {
      return { type: NounType.Topic, confidence: 0.8 }
    }
    
    // Mention
    if (text.startsWith('@')) {
      return { type: NounType.User, confidence: 0.8 }
    }
    
    // Capitalized words (likely proper nouns)
    if (/^[A-Z]/.test(text)) {
      // Multiple words - likely organization or person
      const words = text.split(/\s+/)
      if (words.length > 1) {
        // Check for organization suffixes
        if (/\b(Inc|Corp|LLC|Ltd|Co|Group|Foundation|University)\b/i.test(text)) {
          return { type: NounType.Organization, confidence: 0.75 }
        }
        // Likely a person's name
        return { type: NounType.Person, confidence: 0.65 }
      }
      // Single capitalized word - could be location
      return { type: NounType.Location, confidence: 0.5 }
    }
    
    // Default to Thing with low confidence
    return { type: NounType.Thing, confidence: 0.3 }
  }
  
  /**
   * Get embedding for text with caching (v3.38.0)
   *
   * PERFORMANCE OPTIMIZATION: Caches embeddings during extraction session
   * to avoid redundant model calls for repeated text (common in large imports)
   */
  private async getEmbedding(text: string): Promise<Vector> {
    // Normalize text for cache key
    const normalizedText = text.trim().toLowerCase()

    // Check cache first
    const cached = this.embeddingCache.get(normalizedText)
    if (cached) {
      this.embeddingCacheStats.hits++
      return cached
    }

    // Cache miss - generate embedding
    this.embeddingCacheStats.misses++

    let vector: Vector
    if ('embed' in this.brain && typeof (this.brain as any).embed === 'function') {
      vector = await (this.brain as any).embed(text)
    } else {
      // Fallback - create simple hash-based vector
      vector = new Array(384).fill(0)
      for (let i = 0; i < text.length; i++) {
        vector[i % 384] += text.charCodeAt(i) / 255
      }
      vector = vector.map(v => v / text.length)
    }

    // Store in cache
    this.embeddingCache.set(normalizedText, vector)
    this.embeddingCacheStats.size = this.embeddingCache.size

    // Memory management: Clear cache if it grows too large (>10000 entries)
    if (this.embeddingCache.size > 10000) {
      // Keep most recent 5000 entries (simple LRU approximation)
      const entries = Array.from(this.embeddingCache.entries())
      this.embeddingCache.clear()
      entries.slice(-5000).forEach(([k, v]) => this.embeddingCache.set(k, v))
      this.embeddingCacheStats.size = this.embeddingCache.size
    }

    return vector
  }
  
  /**
   * Calculate cosine similarity between vectors
   */
  private cosineSimilarity(a: Vector, b: Vector): number {
    let dotProduct = 0
    let normA = 0
    let normB = 0
    
    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i]
      normA += a[i] * a[i]
      normB += b[i] * b[i]
    }
    
    normA = Math.sqrt(normA)
    normB = Math.sqrt(normB)
    
    if (normA === 0 || normB === 0) return 0
    return dotProduct / (normA * normB)
  }
  
  /**
   * Simple hash function for fallback
   */
  private simpleHash(text: string): number {
    let hash = 0
    for (let i = 0; i < text.length; i++) {
      const char = text.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash // Convert to 32-bit integer
    }
    return Math.abs(hash)
  }
  
  /**
   * Remove duplicate and overlapping entities
   */
  private deduplicateEntities(entities: ExtractedEntity[]): ExtractedEntity[] {
    // Sort by position and confidence
    entities.sort((a, b) => {
      if (a.position.start !== b.position.start) {
        return a.position.start - b.position.start
      }
      return b.confidence - a.confidence // Higher confidence first
    })
    
    const result: ExtractedEntity[] = []
    
    for (const entity of entities) {
      // Check for overlap with already added entities
      const hasOverlap = result.some(existing => 
        (entity.position.start >= existing.position.start && 
         entity.position.start < existing.position.end) ||
        (entity.position.end > existing.position.start && 
         entity.position.end <= existing.position.end)
      )
      
      if (!hasOverlap) {
        result.push(entity)
      }
    }


    return result
  }

  /**
   * Invalidate cache entry for a specific path or hash
   */
  invalidateCache(pathOrHash: string): boolean {
    const cacheKey = pathOrHash.includes(':')
      ? pathOrHash
      : generateFileCacheKey(pathOrHash)
    return this.cache.invalidate(cacheKey)
  }

  /**
   * Invalidate all cache entries matching a prefix
   */
  invalidateCachePrefix(prefix: string): number {
    return this.cache.invalidatePrefix(prefix)
  }

  /**
   * Clear all cached entities
   */
  clearCache(): void {
    this.cache.clear()
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    return this.cache.getStats()
  }

  /**
   * Cleanup expired cache entries
   */
  cleanupCache(): number {
    return this.cache.cleanup()
  }

  /**
   * Clear embedding cache (v3.38.0)
   *
   * Clears the runtime embedding cache. Useful for:
   * - Freeing memory after large imports
   * - Testing with fresh cache state
   */
  clearEmbeddingCache(): void {
    this.embeddingCache.clear()
    this.embeddingCacheStats = {
      hits: 0,
      misses: 0,
      size: 0
    }
  }

  /**
   * Get embedding cache statistics (v3.38.0)
   *
   * Returns performance metrics for the embedding cache:
   * - hits: Number of cache hits (avoided model calls)
   * - misses: Number of cache misses (required model calls)
   * - size: Current cache size
   * - hitRate: Percentage of requests served from cache
   */
  getEmbeddingCacheStats() {
    const total = this.embeddingCacheStats.hits + this.embeddingCacheStats.misses
    return {
      ...this.embeddingCacheStats,
      hitRate: total > 0 ? this.embeddingCacheStats.hits / total : 0
    }
  }
}