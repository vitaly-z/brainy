/**
 * Neural Entity Extractor using Brainy's NounTypes
 * Uses embeddings and similarity matching for accurate type detection
 *
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

export interface ExtractedEntity {
  text: string
  type: NounType
  position: { start: number; end: number }
  confidence: number
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

  constructor(brain: Brainy | Brainy<any>, cacheOptions?: EntityCacheOptions) {
    this.brain = brain
    this.cache = new EntityExtractionCache(cacheOptions)
  }
  
  /**
   * Initialize type embeddings for neural matching
   * PERFORMANCE FIX (v3.32.5): Only initialize requested types instead of all 31 types
   * This reduces initialization from 31 embed calls to ~2-5 embed calls
   */
  private async initializeTypeEmbeddings(requestedTypes?: NounType[]): Promise<void> {
    // Create representative embeddings for each NounType
    const typeExamples: Record<NounType, string[]> = {
      [NounType.Person]: ['John Smith', 'Jane Doe', 'person', 'individual', 'human'],
      [NounType.Organization]: ['Microsoft Corporation', 'company', 'organization', 'business', 'enterprise'],
      [NounType.Location]: ['New York City', 'location', 'place', 'address', 'geography'],
      [NounType.Document]: ['document', 'file', 'report', 'paper', 'text'],
      [NounType.Event]: ['conference', 'meeting', 'event', 'occurrence', 'happening'],
      [NounType.Product]: ['iPhone', 'product', 'item', 'merchandise', 'goods'],
      [NounType.Service]: ['consulting', 'service', 'offering', 'provision'],
      [NounType.Concept]: ['idea', 'concept', 'theory', 'principle', 'notion'],
      [NounType.Media]: ['image', 'video', 'audio', 'media', 'content'],
      [NounType.Message]: ['email', 'message', 'communication', 'note'],
      [NounType.Task]: ['task', 'todo', 'assignment', 'job', 'work'],
      [NounType.Project]: ['project', 'initiative', 'program', 'endeavor'],
      [NounType.Process]: ['workflow', 'process', 'procedure', 'method'],
      [NounType.User]: ['user', 'account', 'profile', 'member'],
      [NounType.Role]: ['manager', 'role', 'position', 'title', 'responsibility'],
      [NounType.Topic]: ['subject', 'topic', 'theme', 'matter'],
      [NounType.Language]: ['English', 'language', 'tongue', 'dialect'],
      [NounType.Currency]: ['dollar', 'currency', 'money', 'USD', 'EUR'],
      [NounType.Measurement]: ['meter', 'measurement', 'unit', 'quantity'],
      [NounType.Contract]: ['agreement', 'contract', 'deal', 'treaty'],
      [NounType.Regulation]: ['law', 'regulation', 'rule', 'policy'],
      [NounType.Resource]: ['resource', 'asset', 'material', 'supply'],
      [NounType.Dataset]: ['database', 'dataset', 'data', 'records'],
      [NounType.Interface]: ['API', 'interface', 'endpoint', 'connection'],
      [NounType.Thing]: ['thing', 'object', 'item', 'entity'],
      [NounType.Content]: ['content', 'material', 'information'],
      [NounType.Collection]: ['collection', 'group', 'set', 'list'],
      [NounType.File]: ['file', 'document', 'archive'],
      [NounType.State]: ['state', 'status', 'condition'],
      [NounType.Hypothesis]: ['hypothesis', 'theory', 'assumption'],
      [NounType.Experiment]: ['experiment', 'test', 'trial', 'study']
    }

    // PERFORMANCE OPTIMIZATION: Only initialize the types we need
    // This is especially important for extractConcepts() which only needs Concept + Topic
    const typesToInitialize = requestedTypes || Object.values(NounType)

    // Generate embeddings only for requested types
    for (const type of typesToInitialize) {
      // Skip if already initialized
      if (this.typeEmbeddings.has(type)) continue

      const examples = typeExamples[type]
      if (!examples) continue

      const combinedText = examples.join(' ')
      const embedding = await this.getEmbedding(combinedText)
      this.typeEmbeddings.set(type, embedding)
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
    // PERFORMANCE FIX (v3.32.5): Only initialize requested types
    // For extractConcepts(), this reduces init from 31 types → 2 types
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
    
    // Step 2: Classify each candidate using neural matching
    for (const candidate of candidates) {
      let bestType: NounType = NounType.Thing
      let bestConfidence = 0
      
      if (useNeuralMatching) {
        // Get embedding for the candidate
        const candidateVector = await this.getEmbedding(candidate.text)
        
        // Find best matching NounType
        for (const type of targetTypes) {
          const typeVector = this.typeEmbeddings.get(type)
          if (!typeVector) continue
          
          const similarity = this.cosineSimilarity(candidateVector, typeVector)
          
          // Apply context-based boosting
          const contextBoost = this.getContextBoost(candidate.text, candidate.context, type)
          const adjustedConfidence = similarity * (1 + contextBoost)
          
          if (adjustedConfidence > bestConfidence) {
            bestConfidence = adjustedConfidence
            bestType = type
          }
        }
      } else {
        // Fallback to rule-based classification
        const classification = this.classifyByRules(candidate)
        bestType = classification.type
        bestConfidence = classification.confidence
      }
      
      if (bestConfidence >= minConfidence) {
        const entity: ExtractedEntity = {
          text: candidate.text,
          type: bestType,
          position: candidate.position,
          confidence: bestConfidence
        }
        
        if (options?.includeVectors) {
          entity.vector = await this.getEmbedding(candidate.text)
        }
        
        entities.push(entity)
      }
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
   * Get embedding for text
   */
  private async getEmbedding(text: string): Promise<Vector> {
    if ('embed' in this.brain && typeof (this.brain as any).embed === 'function') {
      return await (this.brain as any).embed(text)
    } else {
      // Fallback - create simple hash-based vector
      const vector = new Array(384).fill(0)
      for (let i = 0; i < text.length; i++) {
        vector[i % 384] += text.charCodeAt(i) / 255
      }
      return vector.map(v => v / text.length)
    }
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
}