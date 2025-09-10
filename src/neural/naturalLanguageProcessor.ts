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
import { Brainy } from '../brainy.js'
import { PatternLibrary } from './patternLibrary.js'

export interface NaturalQueryIntent {
  type: 'vector' | 'field' | 'graph' | 'combined'
  primaryIntent: 'search' | 'filter' | 'aggregate' | 'navigate' | 'compare' | 'explain'
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
      sortBy?: string
      groupBy?: string
    }
  }
  context?: {
    domain?: string  // e.g., 'technical', 'business', 'academic'
    temporalScope?: 'past' | 'present' | 'future' | 'all'
    complexity?: 'simple' | 'moderate' | 'complex'
  }
}

export class NaturalLanguageProcessor {
  private brain: Brainy
  private patternLibrary: PatternLibrary
  private queryHistory: Array<{ query: string; result: TripleQuery; success: boolean }>
  private initialized: boolean = false
  private embeddingCache: Map<string, Vector> = new Map()
  
  constructor(brain: Brainy) {
    this.brain = brain
    this.patternLibrary = new PatternLibrary(brain)
    this.queryHistory = []
  }
  
  /**
   * Get embedding using add/get/delete pattern
   */
  private async getEmbedding(text: string): Promise<Vector> {
    // Check cache first
    if (this.embeddingCache.has(text)) {
      return this.embeddingCache.get(text)!
    }
    
    // Use add/get/delete pattern to get embedding
    const id = await this.brain.add({
      data: text,
      type: 'document'
    })
    
    const entity = await this.brain.get(id)
    const embedding = entity?.vector || []
    
    // Clean up temporary entity
    await this.brain.delete(id)
    
    // Cache the embedding
    this.embeddingCache.set(text, embedding)
    return embedding
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
    
    // Step 1: Get embedding via add/get/delete pattern
    const queryEmbedding = await this.getEmbedding(naturalQuery)
    
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
    const similar = await this.findSimilarQueries(queryEmbedding)
    if (similar.length > 0 && similar[0].similarity > 0.9) {
      // Adapt a very similar previous query (for future implementation)
      // return this.adaptQuery(query, similar[0].result)
    }
    
    // Extract entities using Brainy's search
    const entities = await this.extractEntities(query)
    
    // Build query based on intent and entities
    return this.buildQuery(query, intent, entities)
  }
  
  /**
   * Analyze intent using keywords and structure with enhanced classification
   */
  private async analyzeIntent(query: string): Promise<NaturalQueryIntent> {
    // Analyze query structure patterns
    const lowerQuery = query.toLowerCase()
    
    // Determine primary intent
    let primaryIntent: NaturalQueryIntent['primaryIntent'] = 'search'
    let confidence = 0.7 // Base confidence
    let type: NaturalQueryIntent['type'] = 'vector' // Default
    
    // Intent detection patterns
    if (lowerQuery.match(/\b(filter|where|with|having)\b/)) {
      primaryIntent = 'filter'
      confidence += 0.15
    } else if (lowerQuery.match(/\b(count|sum|average|total|group by)\b/)) {
      primaryIntent = 'aggregate'
      confidence += 0.2
    } else if (lowerQuery.match(/\b(compare|versus|vs|difference|between)\b/)) {
      primaryIntent = 'compare'
      confidence += 0.15
    } else if (lowerQuery.match(/\b(explain|why|how|what causes)\b/)) {
      primaryIntent = 'explain'
      confidence += 0.1
    } else if (lowerQuery.match(/\b(connected|related|linked|from.*to)\b/)) {
      primaryIntent = 'navigate'
      type = 'graph'
      confidence += 0.15
    }
    
    // Detect field queries
    if (this.hasFieldPatterns(lowerQuery)) {
      type = type === 'graph' ? 'combined' : 'field'
      confidence += 0.1
    }
    
    // Detect connection queries  
    if (this.hasConnectionPatterns(lowerQuery)) {
      type = type === 'field' ? 'combined' : 'graph'
      confidence += 0.1
    }
    
    // Extract context
    const context: NaturalQueryIntent['context'] = {
      domain: this.detectDomain(query),
      temporalScope: this.detectTemporalScope(query),
      complexity: this.assessComplexity(query)
    }
    
    // Extract basic terms with enhanced modifiers
    const extractedTerms = this.extractTerms(query)
    
    return {
      type,
      primaryIntent,
      confidence,
      extractedTerms,
      context
    }
  }
  
  /**
   * Detect the domain of the query
   */
  private detectDomain(query: string): string {
    const lowerQuery = query.toLowerCase()
    
    if (lowerQuery.match(/\b(code|function|api|bug|error|debug)\b/)) {
      return 'technical'
    } else if (lowerQuery.match(/\b(revenue|sales|profit|customer|market)\b/)) {
      return 'business'
    } else if (lowerQuery.match(/\b(research|study|paper|theory|hypothesis)\b/)) {
      return 'academic'
    }
    
    return 'general'
  }
  
  /**
   * Detect temporal scope in query
   */
  private detectTemporalScope(query: string): 'past' | 'present' | 'future' | 'all' {
    const lowerQuery = query.toLowerCase()
    
    if (lowerQuery.match(/\b(was|were|did|had|yesterday|last|previous|ago)\b/)) {
      return 'past'
    } else if (lowerQuery.match(/\b(will|going to|tomorrow|next|future|upcoming)\b/)) {
      return 'future'
    } else if (lowerQuery.match(/\b(is|are|currently|now|today|present)\b/)) {
      return 'present'
    }
    
    return 'all'
  }
  
  /**
   * Assess query complexity
   */
  private assessComplexity(query: string): 'simple' | 'moderate' | 'complex' {
    const words = query.split(/\s+/).length
    const hasMultipleClauses = query.match(/\b(and|or|but|with|where)\b/g)?.length || 0
    const hasNesting = query.includes('(') || query.includes('[')
    
    if (words < 5 && hasMultipleClauses === 0) {
      return 'simple'
    } else if (words > 15 || hasMultipleClauses > 2 || hasNesting) {
      return 'complex'
    }
    
    return 'moderate'
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
        const results = await this.brain.search(term, 5)
        
        for (const result of results) {
          if (result.score > 0.8) { // High similarity threshold
            matches.push({
              term,
              id: result.id,
              type: 'entity',
              confidence: result.score,
              metadata: result.entity?.metadata
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

  /**
   * Find similar successful queries from history
   * Uses Brainy's vector search to find semantically similar previous queries
   */
  private async findSimilarQueries(queryEmbedding: Vector): Promise<any[]> {
    try {
      // Search for similar queries in a hypothetical query history
      // For now, return empty array since we don't have query history storage yet
      // This would integrate with Brainy's search to find similar query patterns
      
      // Future implementation could search a query_history noun type:
      // const similarQueries = await this.brainy.search(queryEmbedding, {
      //   limit: 5,
      //   metadata: { type: 'successful_query' },
      //   nounTypes: ['query_history']
      // })
      
      return []
    } catch (error) {
      console.debug('Failed to find similar queries:', error)
      return []
    }
  }

  /**
   * Extract entities from query using Brainy's semantic search
   * Identifies known entities, concepts, and relationships in the query text
   */
  private async extractEntities(query: string): Promise<any[]> {
    try {
      // Split query into potential entity terms
      const terms = query.toLowerCase()
        .split(/[\s,\.;!?]+/)
        .filter(term => term.length > 2)
      
      const entities: any[] = []
      
      // Search for each term in Brainy to see if it matches known entities
      for (const term of terms) {
        try {
          const results = await this.brain.search(term, 3)
          
          if (results && results.length > 0) {
            // Found matching entities
            entities.push({
              term,
              matches: results,
              confidence: results[0].score || 0.7
            })
          }
        } catch (searchError) {
          // Continue if individual term search fails
          console.debug(`Entity search failed for term: ${term}`, searchError)
        }
      }
      
      return entities
    } catch (error) {
      console.debug('Failed to extract entities:', error)
      return []
    }
  }

  /**
   * Build final TripleQuery based on intent, entities, and query analysis
   * Constructs optimized query combining vector, graph, and field searches
   */
  private async buildQuery(query: string, intent: any, entities: any[]): Promise<TripleQuery> {
    try {
      const tripleQuery: TripleQuery = {
        like: query, // Default to semantic search
        limit: 10
      }

      // Add field filters based on intent
      if (intent.hasFieldPatterns) {
        // Extract field-based constraints from the query
        const whereClause: Record<string, any> = {}
        
        // Look for date/year patterns
        const yearMatch = query.match(/(\d{4})/g)
        if (yearMatch) {
          whereClause.year = parseInt(yearMatch[0])
        }
        
        // Look for numeric constraints
        const moreThanMatch = query.match(/more than (\d+)/i)
        if (moreThanMatch) {
          whereClause.count = { greaterThan: parseInt(moreThanMatch[1]) }
        }
        
        if (Object.keys(whereClause).length > 0) {
          tripleQuery.where = whereClause
        }
      }

      // Add connection-based searches
      if (intent.hasConnectionPatterns) {
        // Look for relationship patterns in the query
        const connectedMatch = query.match(/connected to (.+?)$/i) || 
                              query.match(/related to (.+?)$/i)
        
        if (connectedMatch) {
          tripleQuery.connected = {
            to: connectedMatch[1].trim()
          }
        }
      }

      // Add entity-specific filters
      if (entities && entities.length > 0) {
        const highConfidenceEntities = entities.filter(e => e.confidence > 0.8)
        
        if (highConfidenceEntities.length > 0) {
          // Use the highest confidence entity to refine search
          const topEntity = highConfidenceEntities[0]
          if (topEntity.matches && topEntity.matches.length > 0) {
            // Add entity-specific metadata or connection
            const entityData = topEntity.matches[0].metadata
            if (entityData && entityData.category) {
              tripleQuery.where = {
                ...tripleQuery.where,
                category: entityData.category
              }
            }
          }
        }
      }

      return tripleQuery
    } catch (error) {
      console.debug('Failed to build query:', error)
      // Return simple query as fallback
      return {
        like: query,
        limit: 10
      }
    }
  }

  /**
   * Extract entities from text using NEURAL matching to strict NounTypes
   * ALWAYS uses neural matching, NEVER falls back to patterns
   */
  async extract(text: string, options?: {
    types?: string[]
    includeMetadata?: boolean
    confidence?: number
  }): Promise<Array<{
    text: string
    type: string
    position: { start: number; end: number }
    confidence: number
    metadata?: any
  }>> {
    await this.ensureInitialized()

    // ALWAYS use NeuralEntityExtractor for proper type matching
    const { NeuralEntityExtractor } = await import('./entityExtractor.js')
    const extractor = new NeuralEntityExtractor(this.brain)
    
    // Convert string types to NounTypes if provided
    const nounTypes = options?.types ? 
      options.types.map(t => t as any) : 
      undefined
    
    // Extract using neural matching
    const entities = await extractor.extract(text, {
      types: nounTypes,
      confidence: options?.confidence || 0.0, // Accept ALL matches
      includeVectors: false,
      neuralMatching: true  // ALWAYS use neural matching
    })
    
    // Convert to expected format
    return entities.map(entity => ({
      text: entity.text,
      type: entity.type,
      position: entity.position,
      confidence: entity.confidence,
      metadata: options?.includeMetadata ? {
        ...entity.metadata,
        neuralMatch: true,
        extractedAt: Date.now()
      } : undefined
    }))
  }

  /**
   * DEPRECATED - Old pattern-based extraction
   * This should NEVER be used - kept only for reference
   */
  private async extractWithPatterns_DEPRECATED(text: string, options?: {
    types?: string[]
    includeMetadata?: boolean
    confidence?: number
  }): Promise<Array<{
    text: string
    type: string
    position: { start: number; end: number }
    confidence: number
    metadata?: any
  }>> {
    const extracted: Array<{
      text: string
      type: string
      position: { start: number; end: number }
      confidence: number
      metadata?: any
    }> = []

    // Common entity patterns
    const patterns = {
      // People (names with capitals)
      person: /\b([A-Z][a-z]+ [A-Z][a-z]+)\b/g,
      // Organizations (capitals, Inc, LLC, etc)
      organization: /\b([A-Z][a-zA-Z&]+(?: [A-Z][a-zA-Z&]+)*(?:,? (?:Inc|LLC|Corp|Ltd|Co|Group|Foundation|Institute|University|College|School|Hospital|Bank|Agency)\.?))\b/g,
      // Locations (capitals, common place words)
      location: /\b([A-Z][a-z]+(?: [A-Z][a-z]+)*(?:,? (?:[A-Z][a-z]+))?)(?= (?:City|County|State|Country|Street|Road|Avenue|Boulevard|Drive|Park|Square|Place|Island|Mountain|River|Lake|Ocean|Sea))\b/g,
      // Dates
      date: /\b(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}|\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2}|(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]* \d{1,2},? \d{4}|\d{1,2} (?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]* \d{4})\b/gi,
      // Times
      time: /\b(\d{1,2}:\d{2}(?::\d{2})?(?:\s?[AP]M)?)\b/gi,
      // Emails
      email: /\b([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})\b/g,
      // URLs
      url: /\b(https?:\/\/[^\s]+)\b/g,
      // Phone numbers
      phone: /\b(\+?\d{1,3}?[- .]?\(?\d{1,4}\)?[- .]?\d{1,4}[- .]?\d{1,4})\b/g,
      // Money
      money: /\b(\$[\d,]+(?:\.\d{2})?|[\d,]+(?:\.\d{2})?\s*(?:USD|EUR|GBP|JPY|CNY))\b/gi,
      // Percentages
      percentage: /\b(\d+(?:\.\d+)?%)\b/g,
      // Products/versions
      product: /\b([A-Z][a-zA-Z0-9]*(?: [A-Z][a-zA-Z0-9]*)*\s+v?\d+(?:\.\d+)*)\b/g,
      // Hashtags
      hashtag: /#[a-zA-Z0-9_]+/g,
      // Mentions
      mention: /@[a-zA-Z0-9_]+/g
    }

    const minConfidence = options?.confidence || 0.5
    const targetTypes = options?.types || Object.keys(patterns)

    // Apply each pattern
    for (const [type, pattern] of Object.entries(patterns)) {
      if (!targetTypes.includes(type)) continue

      let match
      while ((match = pattern.exec(text)) !== null) {
        const extractedText = match[1] || match[0]
        const confidence = this.calculateConfidence(extractedText, type)

        if (confidence >= minConfidence) {
          const entity = {
            text: extractedText,
            type,
            position: {
              start: match.index,
              end: match.index + match[0].length
            },
            confidence
          }

          if (options?.includeMetadata) {
            ;(entity as any).metadata = {
              pattern: pattern.source,
              contextBefore: text.substring(Math.max(0, match.index - 20), match.index),
              contextAfter: text.substring(match.index + match[0].length, Math.min(text.length, match.index + match[0].length + 20))
            }
          }

          extracted.push(entity)
        }
      }
    }

    // Sort by position
    extracted.sort((a, b) => a.position.start - b.position.start)

    // Remove overlapping entities (keep higher confidence)
    const filtered: typeof extracted = []
    for (const entity of extracted) {
      const overlapping = filtered.find(e => 
        (entity.position.start >= e.position.start && entity.position.start < e.position.end) ||
        (entity.position.end > e.position.start && entity.position.end <= e.position.end)
      )

      if (!overlapping) {
        filtered.push(entity)
      } else if (entity.confidence > overlapping.confidence) {
        const index = filtered.indexOf(overlapping)
        filtered[index] = entity
      }
    }

    return filtered
  }

  /**
   * Analyze sentiment of text
   */
  async sentiment(text: string, options?: {
    granularity?: 'document' | 'sentence' | 'aspect'
    aspects?: string[]
  }): Promise<{
    overall: {
      score: number  // -1 to 1
      magnitude: number  // 0 to 1
      label: 'positive' | 'negative' | 'neutral' | 'mixed'
    }
    sentences?: Array<{
      text: string
      score: number
      magnitude: number
      label: string
    }>
    aspects?: Record<string, {
      score: number
      magnitude: number
      mentions: number
    }>
  }> {
    // Sentiment words with scores
    const positiveWords = new Set(['good', 'great', 'excellent', 'amazing', 'wonderful', 'fantastic', 'love', 'like', 'best', 'happy', 'joy', 'brilliant', 'outstanding', 'perfect', 'beautiful', 'awesome', 'super', 'nice', 'fun', 'exciting', 'impressive', 'incredible', 'remarkable', 'delightful', 'pleased', 'satisfied', 'successful', 'effective', 'helpful'])
    const negativeWords = new Set(['bad', 'terrible', 'awful', 'horrible', 'hate', 'dislike', 'worst', 'sad', 'angry', 'poor', 'disappointing', 'failed', 'broken', 'useless', 'waste', 'sucks', 'disgusting', 'ugly', 'boring', 'annoying', 'frustrating', 'difficult', 'complicated', 'confusing', 'slow', 'expensive', 'unfair', 'wrong', 'mistake', 'problem', 'issue'])
    const intensifiers = new Set(['very', 'extremely', 'really', 'absolutely', 'completely', 'totally', 'quite', 'rather', 'so'])
    const negations = new Set(['not', 'no', 'never', 'neither', 'none', 'nobody', 'nothing', 'nowhere', 'hardly', 'barely', 'scarcely'])

    const normalizedText = text.toLowerCase()
    const words = normalizedText.split(/\s+/)

    // Calculate overall sentiment
    let positiveCount = 0
    let negativeCount = 0
    let intensifierBoost = 1

    for (let i = 0; i < words.length; i++) {
      const word = words[i].replace(/[^a-z]/g, '')
      const prevWord = i > 0 ? words[i - 1].replace(/[^a-z]/g, '') : ''

      // Check for intensifiers
      if (intensifiers.has(prevWord)) {
        intensifierBoost = 1.5
      } else {
        intensifierBoost = 1
      }

      // Check for negation
      const isNegated = negations.has(prevWord)

      if (positiveWords.has(word)) {
        if (isNegated) {
          negativeCount += intensifierBoost
        } else {
          positiveCount += intensifierBoost
        }
      } else if (negativeWords.has(word)) {
        if (isNegated) {
          positiveCount += intensifierBoost
        } else {
          negativeCount += intensifierBoost
        }
      }
    }

    const total = positiveCount + negativeCount
    const score = total > 0 ? (positiveCount - negativeCount) / total : 0
    const magnitude = Math.min(1, total / words.length)

    let label: 'positive' | 'negative' | 'neutral' | 'mixed'
    if (score > 0.2) label = 'positive'
    else if (score < -0.2) label = 'negative'
    else if (magnitude > 0.3) label = 'mixed'
    else label = 'neutral'

    const result: any = {
      overall: {
        score,
        magnitude,
        label
      }
    }

    // Sentence-level analysis
    if (options?.granularity === 'sentence' || options?.granularity === 'aspect') {
      const sentences = text.match(/[^.!?]+[.!?]+/g) || [text]
      result.sentences = []

      for (const sentence of sentences) {
        const sentenceResult = await this.sentiment(sentence)
        result.sentences.push({
          text: sentence.trim(),
          score: sentenceResult.overall.score,
          magnitude: sentenceResult.overall.magnitude,
          label: sentenceResult.overall.label
        })
      }
    }

    // Aspect-based analysis
    if (options?.granularity === 'aspect' && options?.aspects) {
      result.aspects = {}

      for (const aspect of options.aspects) {
        const aspectRegex = new RegExp(`[^.!?]*\\b${aspect}\\b[^.!?]*[.!?]?`, 'gi')
        const aspectSentences = text.match(aspectRegex) || []

        if (aspectSentences.length > 0) {
          let aspectScore = 0
          let aspectMagnitude = 0

          for (const sentence of aspectSentences) {
            const sentimentResult = await this.sentiment(sentence)
            aspectScore += sentimentResult.overall.score
            aspectMagnitude += sentimentResult.overall.magnitude
          }

          result.aspects[aspect] = {
            score: aspectScore / aspectSentences.length,
            magnitude: aspectMagnitude / aspectSentences.length,
            mentions: aspectSentences.length
          }
        }
      }
    }

    return result
  }

  /**
   * Calculate confidence for entity extraction
   */
  private calculateConfidence(text: string, type: string): number {
    let confidence = 0.5  // Base confidence

    // Adjust based on type-specific rules
    switch (type) {
      case 'person':
        // Names with 2-3 capitalized words are more confident
        const nameWords = text.split(' ')
        if (nameWords.length >= 2 && nameWords.length <= 3) {
          confidence += 0.3
        }
        if (nameWords.every(w => /^[A-Z]/.test(w))) {
          confidence += 0.2
        }
        break

      case 'organization':
        // Presence of corporate suffixes increases confidence
        if (/\b(Inc|LLC|Corp|Ltd|Co|Group)\.?$/.test(text)) {
          confidence += 0.4
        }
        break

      case 'email':
      case 'url':
        // These patterns are very specific, high confidence
        confidence = 0.95
        break

      case 'date':
      case 'time':
      case 'money':
      case 'percentage':
        // Numeric patterns are reliable
        confidence = 0.9
        break

      case 'location':
        // Geographic terms increase confidence
        if (/\b(City|State|Country|Street|Road|Avenue)$/.test(text)) {
          confidence += 0.3
        }
        break
    }

    return Math.min(1, confidence)
  }
}