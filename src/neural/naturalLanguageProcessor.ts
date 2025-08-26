/**
 * 🧠 Natural Language Query Processor
 * Auto-breaks down natural language into structured Triple Intelligence queries
 * 
 * Uses all of Brainy's sophisticated features:
 * - Embedding model for semantic understanding
 * - Pattern library with 100+ research-based patterns
 * - Entity Registry for concept mapping
 * - Progressive learning from usage
 */

import { Vector } from '../coreTypes.js'
import { TripleQuery } from '../triple/TripleIntelligence.js'
import { BrainyData } from '../brainyData.js'
import { PatternLibrary } from './patternLibrary.js'

export interface NaturalQueryIntent {
  type: 'vector' | 'field' | 'graph' | 'combined'
  confidence: number
  extractedTerms: {
    searchTerms?: string[]
    fields?: Record<string, any>
    connections?: {
      entities: string[]
      relationships: string[]
    }
    filters?: Record<string, any>
    modifiers?: {
      recent?: boolean
      popular?: boolean
      limit?: number
      boost?: string
    }
  }
}

export class NaturalLanguageProcessor {
  private brain: BrainyData
  private patternLibrary: PatternLibrary
  private queryHistory: Array<{ query: string; result: TripleQuery; success: boolean }>
  private initialized: boolean = false
  
  constructor(brain: BrainyData) {
    this.brain = brain
    this.patternLibrary = new PatternLibrary(brain)
    this.queryHistory = []
  }
  
  /**
   * Initialize the pattern library (lazy loading)
   */
  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.patternLibrary.init()
      this.initialized = true
    }
  }
  
  /**
   * 🎯 MAIN METHOD: Convert natural language to Triple Intelligence query
   */
  async processNaturalQuery(naturalQuery: string): Promise<TripleQuery> {
    await this.ensureInitialized()
    
    // Step 1: Embed the query for semantic matching
    const queryEmbedding = await this.brain.embed(naturalQuery)
    
    // Step 2: Find best matching patterns from our library
    const matches = await this.patternLibrary.findBestPatterns(queryEmbedding, 3)
    
    // Step 3: Try each pattern until we get a good match
    for (const { pattern, similarity } of matches) {
      if (similarity < 0.5) break // Too low similarity, skip
      
      // Extract slots from the query based on pattern
      const extraction = this.patternLibrary.extractSlots(naturalQuery, pattern)
      
      if (extraction.confidence > 0.6) {
        // Fill the template with extracted slots
        const query = this.patternLibrary.fillTemplate(pattern.template, extraction.slots)
        
        // Track this query for learning
        this.queryHistory.push({
          query: naturalQuery,
          result: query,
          success: true // Will be updated based on user behavior
        })
        
        // Update pattern success metric
        this.patternLibrary.updateSuccessMetric(pattern.id, true)
        
        return query
      }
    }
    
    // Step 4: Fall back to hybrid approach if no pattern matches well
    return this.hybridParse(naturalQuery, queryEmbedding)
  }
  
  /**
   * Hybrid parse when pattern matching fails
   */
  private async hybridParse(query: string, queryEmbedding: Vector): Promise<TripleQuery> {
    // Analyze intent using embeddings and keywords
    const intent = await this.analyzeIntent(query)
    
    // Find similar successful queries from history
    // TODO: Implement findSimilarQueries method
    // const similar = await this.findSimilarQueries(queryEmbedding)
    // if (similar.length > 0 && similar[0].similarity > 0.9) {
    //   // Adapt a very similar previous query
    //   return this.adaptQuery(query, similar[0].result)
    // }
    
    // Extract entities using Brainy's search
    // TODO: Implement extractEntities method
    // const entities = await this.extractEntities(query)
    
    // Build query based on intent and entities
    // TODO: Implement buildQuery method
    // return this.buildQuery(query, intent, entities)
    
    // Return a basic query for now
    return {
      like: query,
      limit: 10
    }
  }
  
  /**
   * Analyze intent using keywords and structure
   */
  private async analyzeIntent(query: string): Promise<NaturalQueryIntent> {
    // Use Brainy's embedding function to get semantic representation
    const queryEmbedding = await this.brain.embed(query)
    
    // Search for similar queries in history (if available)
    let confidence = 0.7 // Base confidence
    let type: NaturalQueryIntent['type'] = 'vector' // Default
    
    // Analyze query structure patterns
    const lowerQuery = query.toLowerCase()
    
    // Detect field queries
    if (this.hasFieldPatterns(lowerQuery)) {
      type = 'field'
      confidence += 0.2
    }
    
    // Detect connection queries  
    if (this.hasConnectionPatterns(lowerQuery)) {
      type = type === 'field' ? 'combined' : 'graph'
      confidence += 0.1
    }
    
    // Extract basic terms
    const extractedTerms = this.extractTerms(query)
    
    return {
      type,
      confidence: Math.min(confidence, 1.0),
      extractedTerms
    }
  }
  
  /**
   * Step 2: Use neural analysis to decompose complex queries
   */
  private async decomposeQuery(query: string, intent: NaturalQueryIntent): Promise<any> {
    // Use Brainy's neural clustering to find similar patterns
    const queryTerms = query.split(/\\s+/).filter(term => term.length > 2)
    
    // Try to find existing entities that match query terms
    const entityMatches = await this.findEntityMatches(queryTerms)
    
    return {
      originalQuery: query,
      intent,
      entityMatches,
      queryTerms
    }
  }
  
  /**
   * Step 3: Map concepts using Entity Registry and taxonomy
   */
  private async mapConcepts(decomposition: any): Promise<any> {
    const mappedFields: Record<string, any> = {}
    const searchTerms: string[] = []
    const connections: any = {}
    
    // Use Entity Registry to map known entities
    for (const term of decomposition.queryTerms) {
      const entityMatch = decomposition.entityMatches.find((m: any) => 
        m.term.toLowerCase() === term.toLowerCase()
      )
      
      if (entityMatch) {
        if (entityMatch.type === 'field') {
          mappedFields[entityMatch.field] = entityMatch.value
        } else if (entityMatch.type === 'entity') {
          connections[entityMatch.id] = entityMatch
        }
      } else {
        searchTerms.push(term)
      }
    }
    
    return {
      searchTerms,
      mappedFields,
      connections
    }
  }
  
  /**
   * Step 4: Construct final Triple Intelligence query
   */
  private constructTripleQuery(
    originalQuery: string, 
    intent: NaturalQueryIntent, 
    mapped: any
  ): TripleQuery {
    const query: TripleQuery = {}
    
    // Set vector search if we have search terms
    if (mapped.searchTerms.length > 0) {
      query.like = mapped.searchTerms.join(' ')
    } else if (intent.type === 'vector') {
      query.like = originalQuery
    }
    
    // Set field filters if we found field mappings
    if (Object.keys(mapped.mappedFields).length > 0) {
      query.where = mapped.mappedFields
    }
    
    // Set connection searches if we found entity connections
    if (Object.keys(mapped.connections).length > 0) {
      const entities = Object.keys(mapped.connections)
      if (entities.length > 0) {
        query.connected = { to: entities }
      }
    }
    
    // Apply extracted modifiers
    if (intent.extractedTerms.modifiers) {
      const mods = intent.extractedTerms.modifiers
      if (mods.limit) query.limit = mods.limit
      if (mods.boost) query.boost = mods.boost
    }
    
    return query
  }
  
  /**
   * Initialize pattern recognition for common query types
   */
  private initializePatterns(): Map<RegExp, (match: RegExpMatchArray) => Partial<TripleQuery>> {
    const patterns = new Map<RegExp, (match: RegExpMatchArray) => Partial<TripleQuery>>()
    
    // "Find papers about AI from 2023"
    patterns.set(
      /find\\s+(.+?)\\s+about\\s+(.+?)\\s+from\\s+(\\d{4})/i,
      (match) => ({
        like: match[2],
        where: { year: parseInt(match[3]) }
      })
    )
    
    // "Show me recent posts by John"
    patterns.set(
      /show\\s+me\\s+recent\\s+(.+?)\\s+by\\s+(.+)/i,
      (match) => ({
        like: match[1],
        boost: 'recent',
        connected: { from: match[2] }
      })
    )
    
    // "Papers with more than 100 citations"  
    patterns.set(
      /(.+?)\\s+with\\s+more\\s+than\\s+(\\d+)\\s+(.+)/i,
      (match) => ({
        like: match[1],
        where: { [match[3]]: { greaterThan: parseInt(match[2]) } }
      })
    )
    
    // "Documents related to Stanford"
    patterns.set(
      /(.+?)\\s+related\\s+to\\s+(.+)/i,
      (match) => ({
        like: match[1],
        connected: { to: match[2] }
      })
    )
    
    return patterns
  }
  
  /**
   * Detect field query patterns
   */
  private hasFieldPatterns(query: string): boolean {
    const fieldIndicators = [
      'from', 'after', 'before', 'with more than', 'with less than',
      'published', 'created', 'year', 'date', 'citations', 'score'
    ]
    
    return fieldIndicators.some(indicator => query.includes(indicator))
  }
  
  /**
   * Detect connection query patterns  
   */
  private hasConnectionPatterns(query: string): boolean {
    const connectionIndicators = [
      'by', 'from', 'connected to', 'related to', 'authored by',
      'created by', 'associated with', 'linked to'
    ]
    
    return connectionIndicators.some(indicator => query.includes(indicator))
  }
  
  /**
   * Extract terms and modifiers from query
   */
  private extractTerms(query: string): NaturalQueryIntent['extractedTerms'] {
    const extracted: NaturalQueryIntent['extractedTerms'] = {}
    
    // Extract limit numbers
    const limitMatch = query.match(/(?:top|first|limit)\\s+(\\d+)/i)
    if (limitMatch) {
      extracted.modifiers = { limit: parseInt(limitMatch[1]) }
    }
    
    // Extract boost indicators
    if (query.toLowerCase().includes('recent')) {
      extracted.modifiers = { ...extracted.modifiers, boost: 'recent' }
    }
    if (query.toLowerCase().includes('popular')) {
      extracted.modifiers = { ...extracted.modifiers, boost: 'popular' }
    }
    
    return extracted
  }
  
  /**
   * Find entity matches using Brainy's search capabilities
   */
  private async findEntityMatches(terms: string[]): Promise<any[]> {
    const matches: any[] = []
    
    for (const term of terms) {
      try {
        // Search for similar entities in the knowledge base
        const results = await this.brain.search(term, { limit: 5 })
        
        for (const result of results) {
          if (result.score > 0.8) { // High similarity threshold
            matches.push({
              term,
              id: result.id,
              type: 'entity',
              confidence: result.score,
              metadata: result.metadata
            })
          }
        }
        
        // Check if term matches known field names
        if (this.isKnownField(term)) {
          matches.push({
            term,
            type: 'field',
            field: this.mapToFieldName(term),
            confidence: 0.9
          })
        }
      } catch (error) {
        // If search fails, continue with other terms
        console.debug(`Failed to search for term: ${term}`, error)
      }
    }
    
    return matches
  }
  
  /**
   * Check if term is a known field name
   */
  private isKnownField(term: string): boolean {
    const knownFields = [
      'year', 'date', 'created', 'published', 'author', 'title',
      'citations', 'views', 'score', 'rating', 'category', 'type'
    ]
    
    return knownFields.includes(term.toLowerCase())
  }
  
  /**
   * Map colloquial terms to actual field names
   */
  private mapToFieldName(term: string): string {
    const fieldMappings: Record<string, string> = {
      'published': 'publishDate',
      'created': 'createdAt',
      'author': 'authorId',
      'citations': 'citationCount'
    }
    
    return fieldMappings[term.toLowerCase()] || term.toLowerCase()
  }
}