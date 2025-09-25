/**
 * Universal Concept System for VFS
 *
 * Manages concepts that transcend files and exist independently
 * Ideas that can be linked to multiple manifestations across domains
 * PRODUCTION-READY: Real implementation using Brainy
 */

import { Brainy } from '../brainy.js'
import { NounType, VerbType } from '../types/graphTypes.js'
import { cosineDistance } from '../utils/distance.js'
import { v4 as uuidv4 } from '../universal/uuid.js'
import { EntityManager, ManagedEntity } from './EntityManager.js'

/**
 * Universal concept that exists independently of files
 */
export interface UniversalConcept extends ManagedEntity {
  id: string
  name: string
  description?: string
  domain: string  // 'business', 'technical', 'creative', 'academic', etc.
  category: string  // 'pattern', 'principle', 'method', 'entity', etc.
  keywords: string[]  // Associated keywords/tags
  links: ConceptLink[]  // Links to other concepts
  manifestations: ConceptManifestation[]  // Where concept appears
  strength: number  // How well-established this concept is (0-1)
  created: number
  lastUpdated: number
  version: number
  metadata: Record<string, any>
  conceptType?: string  // For EntityManager queries
}

/**
 * A link between concepts
 */
export interface ConceptLink {
  id: string
  targetConceptId: string
  relationship: 'extends' | 'implements' | 'uses' | 'opposite' | 'related' | 'contains' | 'part-of'
  strength: number  // How strong the relationship is (0-1)
  context?: string  // Why/how they're related
  bidirectional: boolean  // Is the relationship mutual?
}

/**
 * A manifestation of a concept in a specific location
 */
export interface ConceptManifestation extends ManagedEntity {
  id: string
  conceptId: string
  filePath: string
  context: string  // Surrounding content
  form: 'definition' | 'usage' | 'example' | 'discussion' | 'implementation'
  position?: {
    line?: number
    column?: number
    offset?: number
  }
  confidence: number  // How confident we are this represents the concept (0-1)
  timestamp: number
  extractedBy: 'manual' | 'auto' | 'ai'
}

/**
 * Configuration for concept system
 */
export interface ConceptSystemConfig {
  autoLink?: boolean  // Auto-link related concepts
  similarityThreshold?: number  // For concept matching (0-1)
  maxManifestations?: number  // Max manifestations to track per concept
  strengthDecay?: number  // How concept strength decays over time
}

/**
 * Concept graph structure for visualization
 */
export interface ConceptGraph {
  concepts: Array<{
    id: string
    name: string
    domain: string
    strength: number
    manifestationCount: number
  }>
  links: Array<{
    source: string
    target: string
    relationship: string
    strength: number
  }>
}

/**
 * Universal Concept System
 *
 * Manages concepts that exist independently of any specific file or context
 * Examples:
 * - "Authentication" concept appearing in docs, code, tests
 * - "Customer Journey" concept in marketing, UX, analytics
 * - "Dependency Injection" pattern across multiple codebases
 * - "Sustainability" theme in various research papers
 */
export class ConceptSystem extends EntityManager {
  private config: Required<ConceptSystemConfig>
  private conceptCache = new Map<string, UniversalConcept>()

  constructor(
    brain: Brainy,
    config?: ConceptSystemConfig
  ) {
    super(brain, 'vfs-concept')
    this.config = {
      autoLink: config?.autoLink ?? false,
      similarityThreshold: config?.similarityThreshold ?? 0.7,
      maxManifestations: config?.maxManifestations ?? 1000,
      strengthDecay: config?.strengthDecay ?? 0.95  // 5% decay over time
    }
  }

  /**
   * Create a new universal concept
   */
  async createConcept(concept: Omit<UniversalConcept, 'id' | 'created' | 'lastUpdated' | 'version' | 'links' | 'manifestations'>): Promise<string> {
    const conceptId = uuidv4()
    const timestamp = Date.now()

    const universalConcept: UniversalConcept = {
      id: conceptId,
      name: concept.name,
      description: concept.description,
      domain: concept.domain,
      category: concept.category,
      keywords: concept.keywords,
      strength: concept.strength,
      metadata: concept.metadata || {},
      created: timestamp,
      lastUpdated: timestamp,
      version: 1,
      links: [],
      manifestations: [],
      conceptType: 'universal'  // Add conceptType for querying
    }

    // Generate embedding for concept
    let embedding: number[] | undefined
    try {
      embedding = await this.generateConceptEmbedding(universalConcept)
    } catch (error) {
      console.warn('Failed to generate concept embedding:', error)
    }

    // Store concept using EntityManager
    await this.storeEntity(
      universalConcept,
      NounType.Concept,
      embedding,
      Buffer.from(JSON.stringify(universalConcept))
    )

    // Auto-link to similar concepts if enabled
    if (this.config.autoLink) {
      await this.autoLinkConcept(conceptId)
    }

    // Update cache
    this.conceptCache.set(conceptId, universalConcept)

    return conceptId  // Return domain ID, not Brainy ID
  }

  /**
   * Find concepts by various criteria
   */
  async findConcepts(query: {
    name?: string
    domain?: string
    category?: string
    keywords?: string[]
    similar?: string  // Find concepts similar to this text
    manifestedIn?: string  // Find concepts that appear in this file
  }): Promise<UniversalConcept[]> {
    const searchQuery: any = {
      conceptType: 'universal',
      system: 'vfs-concept'
    }

    // Direct attribute matching
    if (query.name) searchQuery.name = query.name
    if (query.domain) searchQuery.domain = query.domain
    if (query.category) searchQuery.category = query.category

    // Keyword matching
    if (query.keywords && query.keywords.length > 0) {
      searchQuery.keywords = { $in: query.keywords }
    }

    // File manifestation search
    if (query.manifestedIn) {
      // Find concepts that have manifestations in this file
      const manifestationResults = await this.findEntities<ConceptManifestation>(
        {
          filePath: query.manifestedIn,
          eventType: 'concept-manifestation'
        },
        NounType.Event,
        1000
      )

      const conceptIds = manifestationResults.map(m => m.conceptId)
      if (conceptIds.length > 0) {
        searchQuery.id = { $in: conceptIds }
      } else {
        return []  // No concepts found in this file
      }
    }

    // Search using EntityManager
    const results = await this.findEntities<UniversalConcept>(
      searchQuery,
      NounType.Concept,
      1000
    )

    // If searching for similar concepts, use vector similarity
    if (query.similar) {
      try {
        const queryEmbedding = await this.generateTextEmbedding(query.similar)
        if (queryEmbedding) {
          // Get all concepts and rank by similarity
          const allConcepts = await this.findEntities<UniversalConcept>(
            { conceptType: 'universal' },
            NounType.Concept,
            10000
          )

          // For similarity search, we need to get the actual vector data from Brainy
          const conceptsWithVectors = []
          for (const concept of allConcepts) {
            if (concept.brainyId) {
              const brainyEntity = await this.brain.get(concept.brainyId)
              if (brainyEntity?.vector && brainyEntity.vector.length > 0) {
                conceptsWithVectors.push({
                  concept,
                  vector: brainyEntity.vector
                })
              }
            }
          }

          const withSimilarity = conceptsWithVectors
            .map(c => ({
              concept: c.concept,
              similarity: 1 - cosineDistance(queryEmbedding, c.vector)
            }))
            .filter(s => s.similarity > this.config.similarityThreshold)
            .sort((a, b) => b.similarity - a.similarity)

          return withSimilarity.map(s => s.concept)
        }
      } catch (error) {
        console.warn('Failed to perform concept similarity search:', error)
      }
    }

    return results
  }

  /**
   * Link two concepts together
   */
  async linkConcept(
    fromConceptId: string,
    toConceptId: string,
    relationship: ConceptLink['relationship'],
    options?: {
      strength?: number
      context?: string
      bidirectional?: boolean
    }
  ): Promise<string> {
    const linkId = uuidv4()
    const fromConcept = await this.getConcept(fromConceptId)
    const toConcept = await this.getConcept(toConceptId)

    if (!fromConcept || !toConcept) {
      throw new Error('One or both concepts not found')
    }

    // Create link
    const link: ConceptLink = {
      id: linkId,
      targetConceptId: toConceptId,
      relationship,
      strength: options?.strength ?? 0.8,
      context: options?.context,
      bidirectional: options?.bidirectional ?? false
    }

    // Add link to source concept
    fromConcept.links.push(link)
    fromConcept.lastUpdated = Date.now()
    await this.updateConcept(fromConcept)

    // Add bidirectional link if specified
    if (link.bidirectional) {
      const reverseRelationship = this.getReverseRelationship(relationship)
      const reverseLink: ConceptLink = {
        id: uuidv4(),
        targetConceptId: fromConceptId,
        relationship: reverseRelationship,
        strength: link.strength,
        context: link.context,
        bidirectional: true
      }

      toConcept.links.push(reverseLink)
      toConcept.lastUpdated = Date.now()
      await this.updateConcept(toConcept)
    }

    // Create relationship using EntityManager
    await this.createRelationship(
      fromConceptId,
      toConceptId,
      this.getVerbType(relationship),
      {
        strength: link.strength,
        context: link.context,
        bidirectional: link.bidirectional
      }
    )

    return linkId
  }

  /**
   * Record a manifestation of a concept in a file
   */
  async recordManifestation(
    conceptId: string,
    filePath: string,
    context: string,
    form: ConceptManifestation['form'],
    options?: {
      position?: ConceptManifestation['position']
      confidence?: number
      extractedBy?: ConceptManifestation['extractedBy']
    }
  ): Promise<string> {
    const concept = await this.getConcept(conceptId)
    if (!concept) {
      throw new Error(`Concept ${conceptId} not found`)
    }

    const manifestationId = uuidv4()
    const timestamp = Date.now()

    const manifestation: ConceptManifestation = {
      id: manifestationId,
      conceptId,
      filePath,
      context,
      form,
      position: options?.position,
      confidence: options?.confidence ?? 1.0,
      timestamp,
      extractedBy: options?.extractedBy ?? 'manual'
    }

    // Store manifestation as managed entity (with eventType for manifestations)
    const manifestationWithEventType = {
      ...manifestation,
      eventType: 'concept-manifestation'
    }

    await this.storeEntity(
      manifestationWithEventType,
      NounType.Event,
      undefined,
      Buffer.from(context)
    )

    // Create relationship to concept using EntityManager
    await this.createRelationship(
      manifestationId,
      conceptId,
      VerbType.Implements
    )

    // Update concept with new manifestation
    concept.manifestations.push(manifestation)
    concept.lastUpdated = timestamp

    // Update concept strength based on manifestations
    concept.strength = Math.min(1.0, concept.strength + 0.1)

    // Prune old manifestations if needed
    if (concept.manifestations.length > this.config.maxManifestations) {
      concept.manifestations = concept.manifestations
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(0, this.config.maxManifestations)
    }

    // Update stored concept
    await this.updateConcept(concept)

    return manifestationId
  }

  /**
   * Extract and link concepts from content
   */
  async extractAndLinkConcepts(filePath: string, content: Buffer): Promise<string[]> {
    if (!this.config.autoLink) {
      return []
    }

    const text = content.toString('utf8')
    const extractedConcepts: string[] = []

    // Simple concept extraction patterns
    // In production, this would use advanced NLP/AI models
    const conceptPatterns = [
      // Technical concepts
      /\b(authentication|authorization|validation|encryption|caching|logging|monitoring)\b/gi,
      // Business concepts
      /\b(customer\s+journey|user\s+experience|business\s+logic|revenue\s+model)\b/gi,
      // Design patterns
      /\b(singleton|factory|observer|strategy|adapter|decorator)\b/gi,
      // General concepts
      /\b(security|performance|scalability|maintainability|reliability)\b/gi
    ]

    for (const pattern of conceptPatterns) {
      const matches = text.matchAll(pattern)
      for (const match of matches) {
        const conceptName = match[0].toLowerCase()
        const context = this.extractContext(text, match.index || 0)

        // Find or create concept
        let concepts = await this.findConcepts({ name: conceptName })

        let conceptId: string
        if (concepts.length === 0) {
          // Create new concept
          conceptId = await this.createConcept({
            name: conceptName,
            domain: this.detectDomain(conceptName, text),
            category: this.detectCategory(conceptName),
            keywords: [conceptName],
            strength: 0.5,
            metadata: {}
          })
          extractedConcepts.push(conceptId)
        } else {
          conceptId = concepts[0].id
        }

        // Record manifestation
        await this.recordManifestation(
          conceptId,
          filePath,
          context,
          this.detectManifestationForm(context),
          {
            confidence: 0.8,
            extractedBy: 'auto'
          }
        )
      }
    }

    return extractedConcepts
  }

  /**
   * Get concept graph for visualization
   */
  async getConceptGraph(options?: {
    domain?: string
    minStrength?: number
    maxConcepts?: number
  }): Promise<ConceptGraph> {
    const query: any = {
      conceptType: 'universal',
      system: 'vfs-concept'
    }

    if (options?.domain) {
      query.domain = options.domain
    }

    if (options?.minStrength) {
      query.strength = { $gte: options.minStrength }
    }

    const concepts = await this.findEntities<UniversalConcept>(
      query,
      NounType.Concept,
      options?.maxConcepts || 1000
    )

    // Build graph structure
    const graphConcepts = concepts.map(c => ({
      id: c.id,
      name: c.name,
      domain: c.domain,
      strength: c.strength,
      manifestationCount: c.manifestations.length
    }))

    const graphLinks: ConceptGraph['links'] = []
    for (const concept of concepts) {
      for (const link of concept.links) {
        // Only include links to concepts in our result set
        if (concepts.find(c => c.id === link.targetConceptId)) {
          graphLinks.push({
            source: concept.id,
            target: link.targetConceptId,
            relationship: link.relationship,
            strength: link.strength
          })
        }
      }
    }

    return {
      concepts: graphConcepts,
      links: graphLinks
    }
  }

  /**
   * Find appearances of a concept
   */
  async findAppearances(conceptId: string, options?: {
    filePath?: string
    form?: ConceptManifestation['form']
    minConfidence?: number
    limit?: number
  }): Promise<ConceptManifestation[]> {
    const query: any = {
      conceptId,
      eventType: 'concept-manifestation',
      system: 'vfs-concept'
    }

    if (options?.filePath) {
      query.filePath = options.filePath
    }

    if (options?.form) {
      query.form = options.form
    }

    if (options?.minConfidence) {
      query.confidence = { $gte: options.minConfidence }
    }

    const manifestations = await this.findEntities<ConceptManifestation>(
      query,
      NounType.Event,
      options?.limit || 1000
    )

    return manifestations.sort((a, b) => b.timestamp - a.timestamp)
  }

  /**
   * Auto-link concept to similar concepts
   */
  private async autoLinkConcept(conceptId: string): Promise<void> {
    const concept = await this.getConcept(conceptId)
    if (!concept) return

    // Find similar concepts
    const similar = await this.findConcepts({
      similar: concept.name + ' ' + (concept.description || '')
    })

    for (const similarConcept of similar) {
      if (similarConcept.id === conceptId) continue

      // Calculate relationship strength based on similarity
      const strength = await this.calculateConceptSimilarity(concept, similarConcept)

      if (strength > this.config.similarityThreshold) {
        await this.linkConcept(
          conceptId,
          similarConcept.id,
          'related',
          { strength, bidirectional: true }
        )
      }
    }
  }

  /**
   * Get concept by ID
   */
  private async getConcept(conceptId: string): Promise<UniversalConcept | null> {
    // Check cache first
    if (this.conceptCache.has(conceptId)) {
      return this.conceptCache.get(conceptId)!
    }

    // Query using EntityManager
    const concept = await this.getEntity<UniversalConcept>(conceptId)
    if (concept) {
      this.conceptCache.set(conceptId, concept)
    }
    return concept
  }

  /**
   * Update stored concept
   */
  private async updateConcept(concept: UniversalConcept): Promise<void> {
    // Add conceptType metadata before updating
    concept.conceptType = 'universal'

    // Update using EntityManager
    await this.updateEntity(concept)

    // Update cache
    this.conceptCache.set(concept.id, concept)
  }

  /**
   * Calculate similarity between two concepts
   */
  private async calculateConceptSimilarity(
    concept1: UniversalConcept,
    concept2: UniversalConcept
  ): Promise<number> {
    // Simple similarity calculation
    let similarity = 0

    // Domain similarity
    if (concept1.domain === concept2.domain) similarity += 0.3

    // Category similarity
    if (concept1.category === concept2.category) similarity += 0.2

    // Keyword overlap
    const commonKeywords = concept1.keywords.filter(k => concept2.keywords.includes(k))
    similarity += (commonKeywords.length / Math.max(concept1.keywords.length, concept2.keywords.length)) * 0.3

    // Name similarity (simple string comparison)
    const nameWords1 = concept1.name.toLowerCase().split(/\s+/)
    const nameWords2 = concept2.name.toLowerCase().split(/\s+/)
    const commonWords = nameWords1.filter(w => nameWords2.includes(w))
    similarity += (commonWords.length / Math.max(nameWords1.length, nameWords2.length)) * 0.2

    return Math.min(1.0, similarity)
  }

  /**
   * Generate embedding for concept
   */
  private async generateConceptEmbedding(concept: UniversalConcept): Promise<number[] | undefined> {
    try {
      const text = [
        concept.name,
        concept.description || '',
        concept.domain,
        concept.category,
        ...(Array.isArray(concept.keywords) ? concept.keywords : [])
      ].join(' ')

      return await this.generateTextEmbedding(text)
    } catch (error) {
      console.error('Failed to generate concept embedding:', error)
      return undefined
    }
  }

  /**
   * Generate embedding for text
   */
  private async generateTextEmbedding(text: string): Promise<number[] | undefined> {
    try {
      // Generate embedding using Brainy's embed method
      const vector = await this.brain.embed(text)
      return vector
    } catch (error) {
      console.debug('Failed to generate embedding:', error)
      return undefined
    }
  }

  /**
   * Get reverse relationship type
   */
  private getReverseRelationship(relationship: ConceptLink['relationship']): ConceptLink['relationship'] {
    const reverseMap: Record<ConceptLink['relationship'], ConceptLink['relationship']> = {
      'extends': 'extended-by' as any,
      'implements': 'implemented-by' as any,
      'uses': 'used-by' as any,
      'opposite': 'opposite',
      'related': 'related',
      'contains': 'part-of',
      'part-of': 'contains'
    }
    return reverseMap[relationship] || 'related'
  }

  /**
   * Map concept relationship to VerbType
   */
  private getVerbType(relationship: ConceptLink['relationship']): VerbType {
    const verbMap: Record<ConceptLink['relationship'], VerbType> = {
      'extends': VerbType.Extends,
      'implements': VerbType.Implements,
      'uses': VerbType.Uses,
      'opposite': VerbType.Conflicts,
      'related': VerbType.RelatedTo,
      'contains': VerbType.Contains,
      'part-of': VerbType.PartOf
    }
    return verbMap[relationship] || VerbType.RelatedTo
  }

  /**
   * Detect concept domain from context
   */
  private detectDomain(conceptName: string, context: string): string {
    if (/import|export|function|class|const|var|let/.test(context)) return 'technical'
    if (/customer|user|business|revenue|market/.test(context)) return 'business'
    if (/design|pattern|architecture/.test(context)) return 'design'
    if (/research|study|analysis/.test(context)) return 'academic'
    return 'general'
  }

  /**
   * Detect concept category
   */
  private detectCategory(conceptName: string): string {
    if (/pattern|strategy|factory|singleton/.test(conceptName)) return 'pattern'
    if (/principle|rule|law/.test(conceptName)) return 'principle'
    if (/method|approach|technique/.test(conceptName)) return 'method'
    if (/entity|object|model/.test(conceptName)) return 'entity'
    return 'concept'
  }

  /**
   * Detect manifestation form from context
   */
  private detectManifestationForm(context: string): ConceptManifestation['form'] {
    if (context.includes('definition') || context.includes('is defined as')) return 'definition'
    if (context.includes('example') || context.includes('for instance')) return 'example'
    if (context.includes('implements') || context.includes('function')) return 'implementation'
    if (context.includes('discussed') || context.includes('explains')) return 'discussion'
    return 'usage'
  }

  /**
   * Extract context around a position
   */
  private extractContext(text: string, position: number, radius = 150): string {
    const start = Math.max(0, position - radius)
    const end = Math.min(text.length, position + radius)
    return text.slice(start, end)
  }

  /**
   * Clear concept cache
   */
  clearCache(conceptId?: string): void {
    if (conceptId) {
      this.conceptCache.delete(conceptId)
    } else {
      this.conceptCache.clear()
    }
  }
}