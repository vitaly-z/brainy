/**
 * IntelligentTypeMatcher - Wrapper around BrainyTypes for testing
 *
 * Provides intelligent type detection using semantic embeddings
 * for matching data to our 42 noun types and 127 verb types.
 */

import { NounType, VerbType } from '../../types/graphTypes.js'
import { BrainyTypes, TypeMatchResult, getBrainyTypes } from './brainyTypes.js'

export interface TypeMatchOptions {
  threshold?: number
  topK?: number
  useCache?: boolean
}

/**
 * Intelligent type matcher using semantic embeddings
 */
export class IntelligentTypeMatcher {
  private brainyTypes: BrainyTypes | null = null
  private cache = new Map<string, TypeMatchResult>()
  
  constructor(private options: TypeMatchOptions = {}) {
    this.options = {
      threshold: 0.3,
      topK: 3,
      useCache: true,
      ...options
    }
  }
  
  /**
   * Initialize the type matcher
   */
  async init(): Promise<void> {
    this.brainyTypes = await getBrainyTypes()
    await this.brainyTypes.init()
  }
  
  /**
   * Dispose of resources
   */
  async dispose(): Promise<void> {
    if (this.brainyTypes) {
      await this.brainyTypes.dispose()
      this.brainyTypes = null
    }
    this.cache.clear()
  }
  
  /**
   * Match data to a noun type
   */
  async matchNounType(data: any): Promise<{
    type: NounType
    confidence: number
    alternatives: Array<{ type: NounType; confidence: number }>
  }> {
    if (!this.brainyTypes) {
      throw new Error('IntelligentTypeMatcher not initialized. Call init() first.')
    }
    
    // Check cache if enabled
    const cacheKey = JSON.stringify(data)
    if (this.options.useCache && this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey)!
      return {
        type: cached.type as NounType,
        confidence: cached.confidence,
        alternatives: cached.alternatives?.map(alt => ({
          type: alt.type as NounType,
          confidence: alt.confidence
        })) || []
      }
    }
    
    // Detect type using BrainyTypes
    const result = await this.brainyTypes.matchNounType(data)
    
    // Convert to expected format
    const response = {
      type: result.type as NounType,
      confidence: result.confidence,
      alternatives: result.alternatives?.map(alt => ({
        type: alt.type as NounType,
        confidence: alt.confidence
      })) || []
    }
    
    // Cache the result if enabled
    if (this.options.useCache) {
      this.cache.set(cacheKey, result)
    }
    
    return response
  }
  
  /**
   * Match a relationship to a verb type
   */
  async matchVerbType(
    source: any,
    target: any,
    relationship?: string
  ): Promise<{
    type: VerbType
    confidence: number
    alternatives: Array<{ type: VerbType; confidence: number }>
  }> {
    if (!this.brainyTypes) {
      throw new Error('IntelligentTypeMatcher not initialized. Call init() first.')
    }
    
    // Create context for verb detection
    const context = {
      source,
      target,
      relationship: relationship || 'related',
      description: relationship || ''
    }
    
    // Check cache if enabled
    const cacheKey = JSON.stringify(context)
    if (this.options.useCache && this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey)!
      return {
        type: cached.type as VerbType || VerbType.RelatedTo,
        confidence: cached.confidence,
        alternatives: cached.alternatives?.map(alt => ({
          type: alt.type as VerbType || VerbType.RelatedTo,
          confidence: alt.confidence
        })) || []
      }
    }
    
    // Detect verb type using BrainyTypes
    const result = await this.brainyTypes.matchVerbType(
      context.source,
      context.target,
      context.relationship
    )
    
    // Convert to expected format
    const response = {
      type: result.type as VerbType || VerbType.RelatedTo,
      confidence: result.confidence,
      alternatives: result.alternatives?.map(alt => ({
        type: alt.type as VerbType || VerbType.RelatedTo,
        confidence: alt.confidence
      })) || []
    }
    
    // Cache the result if enabled
    if (this.options.useCache) {
      this.cache.set(cacheKey, result)
    }
    
    return response
  }
  
  /**
   * Clear the cache
   */
  clearCache(): void {
    this.cache.clear()
  }
  
  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; maxSize: number } {
    return {
      size: this.cache.size,
      maxSize: 1000 // Default max cache size
    }
  }
}

export default IntelligentTypeMatcher