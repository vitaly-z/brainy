/**
 * 🧠 Pattern Library for Natural Language Processing
 * Manages pre-computed pattern embeddings and smart matching
 * 
 * Uses Brainy's own features for self-leveraging intelligence:
 * - Embeddings for semantic similarity
 * - Pattern caching for performance
 * - Progressive learning from usage
 */

import { Vector } from '../coreTypes.js'
import { BrainyData } from '../brainyData.js'
import { EMBEDDED_PATTERNS, getPatternEmbeddings, PATTERNS_METADATA } from './embeddedPatterns.js'

export interface Pattern {
  id: string
  category: string
  examples: string[]
  pattern: string
  template: any
  confidence: number
  embedding?: Vector
  domain?: string
  frequency?: number | string
}

export interface SlotExtraction {
  slots: Record<string, any>
  confidence: number
}

export class PatternLibrary {
  private patterns: Map<string, Pattern>
  private patternEmbeddings: Map<string, Vector>
  private brain: BrainyData
  private embeddingCache: Map<string, Vector>
  private successMetrics: Map<string, number>
  
  constructor(brain: BrainyData) {
    this.brain = brain
    this.patterns = new Map()
    this.patternEmbeddings = new Map()
    this.embeddingCache = new Map()
    this.successMetrics = new Map()
  }
  
  /**
   * Initialize pattern library with pre-computed embeddings
   */
  async init(): Promise<void> {
    // Try to load pre-computed embeddings first
    const precomputedEmbeddings = getPatternEmbeddings()
    
    if (precomputedEmbeddings.size > 0) {
      // Use pre-computed embeddings (instant!)
      console.debug(`Loading ${precomputedEmbeddings.size} pre-computed pattern embeddings`)
      
      for (const pattern of EMBEDDED_PATTERNS) {
        this.patterns.set(pattern.id, pattern)
        this.successMetrics.set(pattern.id, pattern.confidence)
        
        const embedding = precomputedEmbeddings.get(pattern.id)
        if (embedding) {
          this.patternEmbeddings.set(pattern.id, Array.from(embedding))
        }
      }
      
      console.debug(`Pattern library ready: ${PATTERNS_METADATA.totalPatterns} patterns loaded instantly`)
    } else {
      // Fall back to runtime computation
      console.debug('No pre-computed embeddings found, computing at runtime...')
      
      for (const pattern of EMBEDDED_PATTERNS) {
        this.patterns.set(pattern.id, pattern)
        this.successMetrics.set(pattern.id, pattern.confidence)
      }
      
      // Compute embeddings for all patterns
      await this.precomputeEmbeddings()
    }
  }
  
  /**
   * Pre-compute embeddings for all patterns for fast matching
   */
  private async precomputeEmbeddings(): Promise<void> {
    for (const [id, pattern] of this.patterns) {
      // Average embeddings of all examples for robust representation
      const embeddings: Vector[] = []
      
      for (const example of pattern.examples) {
        const embedding = await this.getEmbedding(example)
        embeddings.push(embedding)
      }
      
      // Average the embeddings
      const avgEmbedding = this.averageVectors(embeddings)
      this.patternEmbeddings.set(id, avgEmbedding)
    }
  }
  
  /**
   * Get embedding with caching
   */
  private async getEmbedding(text: string): Promise<Vector> {
    if (this.embeddingCache.has(text)) {
      return this.embeddingCache.get(text)!
    }
    
    const embedding = await this.brain.embed(text)
    this.embeddingCache.set(text, embedding)
    return embedding
  }
  
  /**
   * Find best matching patterns for a query
   */
  async findBestPatterns(queryEmbedding: Vector, k: number = 3): Promise<Array<{
    pattern: Pattern
    similarity: number
  }>> {
    const matches: Array<{ pattern: Pattern; similarity: number }> = []
    
    // Calculate similarity with all patterns
    for (const [id, patternEmbedding] of this.patternEmbeddings) {
      const similarity = this.cosineSimilarity(queryEmbedding, patternEmbedding)
      const pattern = this.patterns.get(id)!
      
      // Apply success metric boost
      const successBoost = this.successMetrics.get(id) || 0.5
      const adjustedSimilarity = similarity * (0.7 + 0.3 * successBoost)
      
      matches.push({
        pattern,
        similarity: adjustedSimilarity
      })
    }
    
    // Sort by similarity and return top k
    matches.sort((a, b) => b.similarity - a.similarity)
    return matches.slice(0, k)
  }
  
  /**
   * Extract slots from query based on pattern
   */
  extractSlots(query: string, pattern: Pattern): SlotExtraction {
    const slots: Record<string, any> = {}
    let confidence = pattern.confidence
    
    // Try regex extraction first
    const regex = new RegExp(pattern.pattern, 'i')
    const match = query.match(regex)
    
    if (match) {
      // Extract captured groups as slots
      for (let i = 1; i < match.length; i++) {
        slots[`$${i}`] = match[i]
      }
      
      // High confidence if regex matches
      confidence = Math.min(confidence * 1.2, 1.0)
    } else {
      // Fall back to token-based extraction
      const tokens = this.tokenize(query)
      const exampleTokens = this.tokenize(pattern.examples[0])
      
      // Simple alignment-based extraction
      for (let i = 0; i < tokens.length; i++) {
        if (i < exampleTokens.length && exampleTokens[i].startsWith('$')) {
          slots[exampleTokens[i]] = tokens[i]
        }
      }
      
      // Lower confidence for fuzzy matching
      confidence *= 0.7
    }
    
    // Post-process slots
    this.postProcessSlots(slots, pattern)
    
    return { slots, confidence }
  }
  
  /**
   * Fill template with extracted slots
   */
  fillTemplate(template: any, slots: Record<string, any>): any {
    const filled = JSON.parse(JSON.stringify(template))
    
    // Recursively replace slot placeholders
    const replacePlaceholders = (obj: any): any => {
      if (typeof obj === 'string') {
        // Replace ${1}, ${2}, etc. with slot values
        return obj.replace(/\$\{(\d+)\}/g, (_, num) => {
          return slots[`$${num}`] || ''
        })
      } else if (Array.isArray(obj)) {
        return obj.map(item => replacePlaceholders(item))
      } else if (typeof obj === 'object' && obj !== null) {
        const result: any = {}
        for (const [key, value] of Object.entries(obj)) {
          const newKey = replacePlaceholders(key)
          result[newKey] = replacePlaceholders(value)
        }
        return result
      }
      return obj
    }
    
    return replacePlaceholders(filled)
  }
  
  /**
   * Update pattern success metrics based on usage
   */
  updateSuccessMetric(patternId: string, success: boolean): void {
    const current = this.successMetrics.get(patternId) || 0.5
    
    // Exponential moving average
    const alpha = 0.1
    const newMetric = success 
      ? current + alpha * (1 - current)
      : current - alpha * current
    
    this.successMetrics.set(patternId, newMetric)
  }
  
  /**
   * Learn new pattern from successful query
   */
  async learnPattern(query: string, result: any): Promise<void> {
    // Find similar existing patterns
    const queryEmbedding = await this.getEmbedding(query)
    const similar = await this.findBestPatterns(queryEmbedding, 1)
    
    if (similar[0]?.similarity < 0.7) {
      // This is a new pattern type - add it
      const newPattern: Pattern = {
        id: `learned_${Date.now()}`,
        category: 'learned',
        examples: [query],
        pattern: this.generateRegexFromQuery(query),
        template: result,
        confidence: 0.6 // Start with moderate confidence
      }
      
      this.patterns.set(newPattern.id, newPattern)
      this.patternEmbeddings.set(newPattern.id, queryEmbedding)
      this.successMetrics.set(newPattern.id, 0.6)
    } else {
      // Similar pattern exists - add as example
      const pattern = similar[0].pattern
      if (!pattern.examples.includes(query)) {
        pattern.examples.push(query)
        
        // Update pattern embedding with new example
        const embeddings = await Promise.all(
          pattern.examples.map(ex => this.getEmbedding(ex))
        )
        const newEmbedding = this.averageVectors(embeddings)
        this.patternEmbeddings.set(pattern.id, newEmbedding)
      }
    }
  }
  
  /**
   * Helper: Average multiple vectors
   */
  private averageVectors(vectors: Vector[]): Vector {
    if (vectors.length === 0) return []
    
    const dim = vectors[0].length
    const avg = new Array(dim).fill(0)
    
    for (const vec of vectors) {
      for (let i = 0; i < dim; i++) {
        avg[i] += vec[i]
      }
    }
    
    for (let i = 0; i < dim; i++) {
      avg[i] /= vectors.length
    }
    
    return avg
  }
  
  /**
   * Helper: Calculate cosine similarity
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
   * Helper: Simple tokenization
   */
  private tokenize(text: string): string[] {
    return text.toLowerCase().split(/\s+/).filter(t => t.length > 0)
  }
  
  /**
   * Helper: Post-process extracted slots
   */
  private postProcessSlots(slots: Record<string, any>, pattern: Pattern): void {
    // Convert string numbers to actual numbers
    for (const [key, value] of Object.entries(slots)) {
      if (typeof value === 'string') {
        // Check if it's a number
        const num = parseFloat(value)
        if (!isNaN(num) && value.match(/^\d+(\.\d+)?$/)) {
          slots[key] = num
        }
        
        // Parse dates
        if (value.match(/\d{4}/) || value.match(/(january|february|march|april|may|june|july|august|september|october|november|december)/i)) {
          // Simple year extraction
          const year = value.match(/\d{4}/)
          if (year) {
            slots[key] = parseInt(year[0])
          }
        }
        
        // Clean up captured values
        slots[key] = value.trim()
      }
    }
  }
  
  /**
   * Helper: Generate regex pattern from query
   */
  private generateRegexFromQuery(query: string): string {
    // Simple pattern generation - replace variable parts with capture groups
    let pattern = query.toLowerCase()
    
    // Replace numbers with \d+ capture
    pattern = pattern.replace(/\d+/g, '(\\d+)')
    
    // Replace quoted strings with .+ capture
    pattern = pattern.replace(/"[^"]+"/g, '(.+)')
    
    // Replace proper nouns (capitalized words) with capture
    pattern = pattern.replace(/\b[A-Z]\w+\b/g, '([A-Z][\\w]+)')
    
    return pattern
  }
  
  /**
   * Get pattern statistics for monitoring
   */
  getStatistics(): {
    totalPatterns: number
    categories: Record<string, number>
    averageConfidence: number
    topPatterns: Array<{ id: string; success: number }>
  } {
    const stats = {
      totalPatterns: this.patterns.size,
      categories: {} as Record<string, number>,
      averageConfidence: 0,
      topPatterns: [] as Array<{ id: string; success: number }>
    }
    
    // Count by category
    for (const pattern of this.patterns.values()) {
      stats.categories[pattern.category] = (stats.categories[pattern.category] || 0) + 1
    }
    
    // Calculate average confidence
    let totalConfidence = 0
    for (const confidence of this.successMetrics.values()) {
      totalConfidence += confidence
    }
    stats.averageConfidence = totalConfidence / this.successMetrics.size
    
    // Get top patterns by success
    const sortedPatterns = Array.from(this.successMetrics.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
    
    stats.topPatterns = sortedPatterns.map(([id, success]) => ({ id, success }))
    
    return stats
  }
}