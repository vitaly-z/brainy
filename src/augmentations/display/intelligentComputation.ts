/**
 * Universal Display Augmentation - Intelligent Computation Engine
 * 
 * Leverages existing Brainy AI infrastructure for intelligent field computation:
 * - IntelligentTypeMatcher for semantic type detection
 * - Neural Import patterns for field analysis  
 * - JSON processing utilities for field extraction
 * - Existing NounType/VerbType taxonomy (31+40 types)
 */

import type { 
  ComputedDisplayFields, 
  FieldComputationContext, 
  TypeMatchResult,
  DisplayConfig
} from './types.js'
import type { VectorDocument, GraphVerb } from '../../coreTypes.js'
import { IntelligentTypeMatcher, getTypeMatcher } from '../typeMatching/intelligentTypeMatcher.js'
import { getNounIcon, getVerbIcon } from './iconMappings.js'
import { 
  getFieldPatterns, 
  getPriorityFields, 
  extractFieldValue, 
  calculateFieldConfidence 
} from './fieldPatterns.js'
import { prepareJsonForVectorization, extractFieldFromJson } from '../../utils/jsonProcessing.js'
import { NounType, VerbType } from '../../types/graphTypes.js'

/**
 * Intelligent field computation engine
 * Coordinates AI-powered analysis with fallback heuristics
 */
export class IntelligentComputationEngine {
  private typeMatcher: IntelligentTypeMatcher | null = null
  private config: DisplayConfig
  private initialized = false

  constructor(config: DisplayConfig) {
    this.config = config
  }

  /**
   * Initialize the computation engine with AI components
   */
  async initialize(): Promise<void> {
    if (this.initialized) return

    try {
      // 🧠 LEVERAGE YOUR EXISTING AI INFRASTRUCTURE
      this.typeMatcher = await getTypeMatcher()
      if (this.typeMatcher) {
        console.log('🎨 Display computation engine initialized with AI intelligence')
      } else {
        console.warn('🎨 Display computation engine running in basic mode (AI unavailable)')
      }
    } catch (error) {
      console.warn('🎨 AI initialization failed, using heuristic fallback:', error)
    }

    this.initialized = true
  }

  /**
   * Compute display fields for a noun using AI-first approach
   * @param data The noun data/metadata
   * @param id Optional noun ID
   * @returns Computed display fields
   */
  async computeNounDisplay(data: any, id?: string): Promise<ComputedDisplayFields> {
    const startTime = Date.now()
    
    try {
      // 🟢 PRIMARY PATH: Use your existing AI intelligence
      if (this.typeMatcher) {
        return await this.computeWithAI(data, 'noun', { id })
      }

      // 🟡 FALLBACK PATH: Use heuristic patterns
      return await this.computeWithHeuristics(data, 'noun', { id })

    } catch (error) {
      console.warn('Display computation failed, using minimal fallback:', error)
      return this.createMinimalDisplay(data, 'noun')
    } finally {
      const computationTime = Date.now() - startTime
      if (this.config.debugMode) {
        console.log(`Display computation took ${computationTime}ms`)
      }
    }
  }

  /**
   * Compute display fields for a verb using AI-first approach
   * @param verb The verb/relationship data
   * @returns Computed display fields
   */
  async computeVerbDisplay(verb: GraphVerb): Promise<ComputedDisplayFields> {
    const startTime = Date.now()

    try {
      // 🟢 PRIMARY PATH: Use your existing AI for verb analysis
      if (this.typeMatcher) {
        return await this.computeVerbWithAI(verb)
      }

      // 🟡 FALLBACK PATH: Use heuristic patterns for verbs
      return await this.computeWithHeuristics(verb, 'verb')

    } catch (error) {
      console.warn('Verb display computation failed, using minimal fallback:', error)
      return this.createMinimalDisplay(verb, 'verb')
    } finally {
      const computationTime = Date.now() - startTime
      if (this.config.debugMode) {
        console.log(`Verb display computation took ${computationTime}ms`)
      }
    }
  }

  /**
   * AI-powered computation using your existing IntelligentTypeMatcher
   * @param data Entity data/metadata
   * @param entityType Type of entity (noun/verb)
   * @param options Additional options
   * @returns AI-computed display fields
   */
  private async computeWithAI(
    data: any, 
    entityType: 'noun' | 'verb',
    options: { id?: string } = {}
  ): Promise<ComputedDisplayFields> {
    
    // 🧠 USE YOUR EXISTING TYPE DETECTION AI
    const typeResult = await this.typeMatcher!.matchNounType(data)
    
    // Create computation context
    const context: FieldComputationContext = {
      data,
      metadata: data,
      typeResult,
      config: this.config,
      entityType
    }

    // 🟢 INTELLIGENT FIELD EXTRACTION using your patterns + AI insights
    const displayFields = {
      title: await this.computeIntelligentTitle(context),
      description: await this.computeIntelligentDescription(context),  
      type: typeResult.type,
      tags: await this.computeIntelligentTags(context),
      confidence: typeResult.confidence,
      reasoning: this.config.debugMode ? typeResult.reasoning : undefined,
      alternatives: this.config.debugMode ? typeResult.alternatives : undefined,
      computedAt: Date.now(),
      version: '1.0.0'
    }

    return displayFields
  }

  /**
   * AI-powered verb computation using relationship analysis
   * @param verb The verb/relationship
   * @returns AI-computed display fields
   */
  private async computeVerbWithAI(verb: GraphVerb): Promise<ComputedDisplayFields> {
    
    // 🧠 USE YOUR EXISTING VERB TYPE DETECTION
    const typeResult = await this.typeMatcher!.matchVerbType(verb, 0.7)
    
    // Create verb computation context
    const context: FieldComputationContext = {
      data: verb,
      metadata: verb.metadata || {},
      typeResult,
      config: this.config,
      entityType: 'verb',
      verbContext: {
        sourceId: verb.sourceId,
        targetId: verb.targetId,
        verbType: verb.type
      }
    }

    // 🟢 INTELLIGENT VERB DISPLAY COMPUTATION
    const displayFields = {
      title: await this.computeVerbTitle(context),
      description: await this.computeVerbDescription(context),
      type: typeResult.type,
      tags: await this.computeVerbTags(context),
      relationship: await this.computeHumanReadableRelationship(context),
      confidence: typeResult.confidence,
      reasoning: this.config.debugMode ? typeResult.reasoning : undefined,
      alternatives: this.config.debugMode ? typeResult.alternatives : undefined,
      computedAt: Date.now(),
      version: '1.0.0'
    }

    return displayFields
  }

  /**
   * Heuristic computation when AI is unavailable
   * @param data Entity data
   * @param entityType Type of entity
   * @param options Additional options
   * @returns Heuristically computed display fields
   */
  private async computeWithHeuristics(
    data: any, 
    entityType: 'noun' | 'verb',
    options: { id?: string } = {}
  ): Promise<ComputedDisplayFields> {
    
    // Use basic type detection
    const detectedType = this.detectTypeHeuristically(data, entityType)
    const mockTypeResult: TypeMatchResult = {
      type: detectedType,
      confidence: 0.6, // Lower confidence for heuristics
      reasoning: 'Heuristic detection (AI unavailable)',
      alternatives: []
    }

    const context: FieldComputationContext = {
      data,
      metadata: data,
      typeResult: mockTypeResult,
      config: this.config,
      entityType
    }

    // Use pattern-based field extraction
    const patterns = getFieldPatterns(entityType, detectedType)
    
    return {
      title: this.extractFieldWithPatterns(data, patterns, 'title') || 'Untitled',
      description: this.extractFieldWithPatterns(data, patterns, 'description') || 'No description',
      type: detectedType,
      tags: this.extractFieldWithPatterns(data, patterns, 'tags') || [],
      confidence: mockTypeResult.confidence,
      reasoning: this.config.debugMode ? mockTypeResult.reasoning : undefined,
      computedAt: Date.now(),
      version: '1.0.0'
    }
  }

  /**
   * Compute intelligent title using AI insights and your field extraction
   * @param context Computation context with AI results
   * @returns Computed title
   */
  private async computeIntelligentTitle(context: FieldComputationContext): Promise<string> {
    const { data, typeResult } = context
    
    // 🟢 USE TYPE-SPECIFIC LOGIC based on your NounType taxonomy
    switch (typeResult?.type) {
      case NounType.Person:
        return this.computePersonTitle(data)
        
      case NounType.Organization:
        return this.computeOrganizationTitle(data)
        
      case NounType.Project:
        return this.computeProjectTitle(data)
        
      case NounType.Document:
        return this.computeDocumentTitle(data)
        
      default:
        // 🟢 LEVERAGE YOUR JSON PROCESSING for unknown types
        return this.extractBestTitle(data, typeResult?.type)
    }
  }

  /**
   * Compute intelligent description using AI insights and context
   * @param context Computation context  
   * @returns Enhanced description
   */
  private async computeIntelligentDescription(context: FieldComputationContext): Promise<string> {
    const { data, typeResult } = context

    // 🟢 USE YOUR EXISTING JSON PROCESSING for vectorization-quality text
    const priorityFields = getPriorityFields('noun', typeResult?.type)
    const enhancedText = prepareJsonForVectorization(data, {
      priorityFields,
      includeFieldNames: false,
      maxDepth: 2
    })

    // Create context-aware description based on type
    return this.createContextAwareDescription(data, typeResult, enhancedText)
  }

  /**
   * Compute intelligent tags using type analysis
   * @param context Computation context
   * @returns Generated tags array
   */
  private async computeIntelligentTags(context: FieldComputationContext): Promise<string[]> {
    const { data, typeResult } = context
    const tags: string[] = []

    // Add type-based tag
    if (typeResult?.type) {
      tags.push(typeResult.type.toLowerCase())
    }

    // Extract explicit tags from data
    const explicitTags = this.extractExplicitTags(data)
    tags.push(...explicitTags)

    // Add semantic tags based on AI analysis
    if (typeResult && this.typeMatcher) {
      const semanticTags = this.generateSemanticTags(data, typeResult)
      tags.push(...semanticTags)
    }

    // Remove duplicates and return
    return [...new Set(tags.filter(Boolean))]
  }

  /**
   * Compute verb title (relationship summary)
   * @param context Verb computation context
   * @returns Verb title
   */
  private async computeVerbTitle(context: FieldComputationContext): Promise<string> {
    const { verbContext, typeResult } = context
    
    if (!verbContext) return 'Relationship'

    const { sourceId, targetId } = verbContext
    const relationshipType = typeResult?.type || 'RelatedTo'
    
    // Try to get readable names for source and target
    // This could be enhanced to actually resolve the entities
    return `${sourceId} ${this.getReadableVerbPhrase(relationshipType)} ${targetId}`
  }

  /**
   * Create minimal display for error cases
   * @param data Entity data
   * @param entityType Entity type
   * @returns Minimal display fields
   */
  private createMinimalDisplay(data: any, entityType: 'noun' | 'verb'): ComputedDisplayFields {
    return {
      title: data.name || data.title || data.id || 'Untitled',
      description: data.description || data.summary || 'No description available',
      type: entityType === 'noun' ? 'Item' : 'RelatedTo',
      tags: [],
      confidence: 0.1, // Very low confidence for fallback
      computedAt: Date.now(),
      version: '1.0.0'
    }
  }

  // Helper methods for specific noun types
  private computePersonTitle(data: any): string {
    if (data.firstName && data.lastName) {
      return `${data.firstName} ${data.lastName}`.trim()
    }
    return data.name || data.fullName || data.displayName || data.firstName || data.lastName || 'Person'
  }

  private computeOrganizationTitle(data: any): string {
    return data.name || data.companyName || data.organizationName || data.title || 'Organization'
  }

  private computeProjectTitle(data: any): string {
    return data.name || data.projectName || data.title || data.projectTitle || 'Project'
  }

  private computeDocumentTitle(data: any): string {
    return data.title || data.filename || data.name || data.subject || 'Document'
  }

  private extractBestTitle(data: any, type?: string): string {
    const titleFields = ['name', 'title', 'displayName', 'label', 'subject', 'heading']
    
    for (const field of titleFields) {
      if (data[field]) return String(data[field])
    }

    return data.id || Object.keys(data)[0] || 'Untitled'
  }

  private createContextAwareDescription(data: any, typeResult?: TypeMatchResult, enhancedText?: string): string {
    // Start with basic description fields
    const basicDesc = data.description || data.summary || data.about || data.details

    if (basicDesc) return String(basicDesc)

    // Use enhanced text from JSON processing
    if (enhancedText && enhancedText.length > 10) {
      return enhancedText.substring(0, 200) + (enhancedText.length > 200 ? '...' : '')
    }

    // Generate from available fields
    const parts = []
    if (data.role) parts.push(data.role)
    if (data.company) parts.push(`at ${data.company}`)
    if (data.location) parts.push(`in ${data.location}`)

    return parts.length > 0 ? parts.join(' ') : 'No description available'
  }

  private extractExplicitTags(data: any): string[] {
    const tagFields = ['tags', 'keywords', 'labels', 'categories', 'topics']
    
    for (const field of tagFields) {
      if (data[field]) {
        if (Array.isArray(data[field])) {
          return data[field].map(String).filter(Boolean)
        }
        if (typeof data[field] === 'string') {
          return data[field].split(/[,;]\s*|\s+/).filter(Boolean)
        }
      }
    }

    return []
  }

  private generateSemanticTags(data: any, typeResult: TypeMatchResult): string[] {
    const tags: string[] = []
    
    // Add confidence-based tags
    if (typeResult.confidence > 0.9) tags.push('verified')
    else if (typeResult.confidence < 0.7) tags.push('uncertain')

    // Add type-specific semantic tags
    if (data.status) tags.push(String(data.status).toLowerCase())
    if (data.priority) tags.push(String(data.priority).toLowerCase())
    if (data.category) tags.push(String(data.category).toLowerCase())

    return tags
  }

  private getReadableVerbPhrase(verbType: string): string {
    const verbPhrases: Record<string, string> = {
      [VerbType.WorksWith]: 'works with',
      [VerbType.MemberOf]: 'is member of',
      [VerbType.ReportsTo]: 'reports to',
      [VerbType.CreatedBy]: 'created by',
      [VerbType.Owns]: 'owns',
      [VerbType.LocatedAt]: 'located at',
      [VerbType.Likes]: 'likes',
      [VerbType.Follows]: 'follows',
      [VerbType.Supervises]: 'supervises'
    }

    return verbPhrases[verbType] || 'related to'
  }

  private async computeVerbDescription(context: FieldComputationContext): Promise<string> {
    const { data, verbContext, typeResult } = context
    
    if (data.description) return String(data.description)

    // Generate contextual description for relationship
    if (verbContext && typeResult) {
      const parts = []
      const relationshipPhrase = this.getReadableVerbPhrase(typeResult.type)
      
      if (data.role) parts.push(`Role: ${data.role}`)
      if (data.startDate) parts.push(`Since: ${new Date(data.startDate).toLocaleDateString()}`)
      if (data.department) parts.push(`Department: ${data.department}`)
      
      return parts.length > 0 
        ? `${relationshipPhrase} - ${parts.join(', ')}`
        : `${relationshipPhrase} relationship`
    }

    return 'Relationship'
  }

  private async computeVerbTags(context: FieldComputationContext): Promise<string[]> {
    const { data, typeResult } = context
    const tags = ['relationship']

    if (typeResult?.type) {
      tags.push(typeResult.type.toLowerCase())
    }

    // Add relationship-specific tags
    if (data.status) tags.push(String(data.status).toLowerCase())
    if (data.type) tags.push(String(data.type).toLowerCase())

    return [...new Set(tags)]
  }

  private async computeHumanReadableRelationship(context: FieldComputationContext): Promise<string> {
    const { verbContext, typeResult } = context
    
    if (!verbContext || !typeResult) return 'Related'

    const { sourceId, targetId } = verbContext
    const phrase = this.getReadableVerbPhrase(typeResult.type)
    
    return `${sourceId} ${phrase} ${targetId}`
  }

  private detectTypeHeuristically(data: any, entityType: 'noun' | 'verb'): string {
    if (entityType === 'verb') return VerbType.RelatedTo

    // Basic heuristics for noun types
    if (data.firstName || data.lastName || data.email) return NounType.Person
    if (data.companyName || data.organization) return NounType.Organization  
    if (data.filename || data.fileType) return NounType.Document
    if (data.projectName || data.initiative) return NounType.Project
    if (data.taskName || data.todo) return NounType.Task
    if (data.startDate || data.endDate) return NounType.Event

    return 'Item' // Generic fallback
  }

  private extractFieldWithPatterns(data: any, patterns: any[], fieldType: string): any {
    const relevantPatterns = patterns.filter(p => p.displayField === fieldType)
    
    for (const pattern of relevantPatterns) {
      for (const field of pattern.fields) {
        if (data[field]) {
          return pattern.transform ? pattern.transform(data[field], { data, config: this.config } as any) : data[field]
        }
      }
    }

    return null
  }

  /**
   * Shutdown the computation engine
   */
  async shutdown(): Promise<void> {
    // Cleanup if needed
    this.typeMatcher = null
    this.initialized = false
  }
}