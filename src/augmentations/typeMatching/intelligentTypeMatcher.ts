/**
 * Intelligent Type Matcher - Uses embeddings for semantic type detection
 * 
 * This module uses our existing TransformerEmbedding and similarity functions
 * to intelligently match data to our 31 noun types and 40 verb types.
 * 
 * Features:
 * - Semantic similarity matching using embeddings
 * - Context-aware type detection
 * - Confidence scoring
 * - Caching for performance
 */

import { NounType, VerbType } from '../../types/graphTypes.js'
import { TransformerEmbedding } from '../../utils/embedding.js'
import { cosineDistance } from '../../utils/distance.js'
import { Vector } from '../../coreTypes.js'

/**
 * Type descriptions for semantic matching
 * These descriptions are used to generate embeddings for each type
 */
const NOUN_TYPE_DESCRIPTIONS: Record<string, string> = {
  // Core Entity Types
  [NounType.Person]: 'person human individual user employee customer citizen member author creator agent actor participant',
  [NounType.Organization]: 'organization company business corporation institution agency department team group committee board',
  [NounType.Location]: 'location place address city country region area zone coordinate position site venue building',
  [NounType.Thing]: 'thing object item product device equipment tool instrument asset artifact material physical tangible',
  [NounType.Concept]: 'concept idea theory principle philosophy belief value abstract intangible notion thought',
  [NounType.Event]: 'event occurrence incident activity happening meeting conference celebration milestone timestamp date',
  
  // Digital/Content Types
  [NounType.Document]: 'document file report article paper text pdf word contract agreement record documentation',
  [NounType.Media]: 'media image photo video audio music podcast multimedia graphic visualization animation',
  [NounType.File]: 'file digital data binary code script program software archive package bundle',
  [NounType.Message]: 'message email chat communication notification alert announcement broadcast transmission',
  [NounType.Content]: 'content information data text material resource publication post blog webpage',
  
  // Collection Types
  [NounType.Collection]: 'collection group set list array category folder directory catalog inventory database',
  [NounType.Dataset]: 'dataset data table spreadsheet database records statistics metrics measurements analysis',
  
  // Business/Application Types
  [NounType.Product]: 'product item merchandise offering service feature application software solution package',
  [NounType.Service]: 'service offering subscription support maintenance utility function capability',
  [NounType.User]: 'user account profile member subscriber customer client participant identity credentials',
  [NounType.Task]: 'task action todo item job assignment duty responsibility activity step procedure',
  [NounType.Project]: 'project initiative program campaign effort endeavor plan scheme venture undertaking',
  
  // Descriptive Types
  [NounType.Process]: 'process workflow procedure method algorithm sequence pipeline operation routine protocol',
  [NounType.State]: 'state status condition phase stage mode situation circumstance configuration setting',
  [NounType.Role]: 'role position title function responsibility duty job capacity designation authority',
  [NounType.Topic]: 'topic subject theme category tag keyword area domain field discipline specialty',
  [NounType.Language]: 'language dialect locale tongue vernacular communication speech linguistics vocabulary',
  [NounType.Currency]: 'currency money dollar euro pound yen bitcoin payment financial monetary unit',
  [NounType.Measurement]: 'measurement metric quantity value amount size dimension weight height volume distance',
  
  // Scientific/Research Types
  [NounType.Hypothesis]: 'hypothesis theory proposition thesis assumption premise conjecture speculation prediction',
  [NounType.Experiment]: 'experiment test trial study research investigation analysis observation examination',
  
  // Legal/Regulatory Types
  [NounType.Contract]: 'contract agreement deal treaty pact covenant license terms conditions policy',
  [NounType.Regulation]: 'regulation law rule policy standard compliance requirement guideline ordinance statute',
  
  // Technical Infrastructure Types
  [NounType.Interface]: 'interface API endpoint protocol specification contract schema definition connection',
  [NounType.Resource]: 'resource infrastructure server database storage compute memory bandwidth capacity asset'
}

const VERB_TYPE_DESCRIPTIONS: Record<string, string> = {
  // Core Relationship Types
  [VerbType.RelatedTo]: 'related connected associated linked correlated relevant pertinent applicable',
  [VerbType.Contains]: 'contains includes holds stores encompasses comprises consists incorporates',
  [VerbType.PartOf]: 'part component element member piece portion section segment constituent',
  [VerbType.LocatedAt]: 'located situated positioned placed found exists resides occupies',
  [VerbType.References]: 'references cites mentions points links refers quotes sources',
  
  // Temporal/Causal Types
  [VerbType.Precedes]: 'precedes before earlier prior previous antecedent preliminary foregoing',
  [VerbType.Succeeds]: 'succeeds follows after later subsequent next ensuing succeeding',
  [VerbType.Causes]: 'causes triggers induces produces generates results influences affects',
  [VerbType.DependsOn]: 'depends requires needs relies necessitates contingent prerequisite',
  [VerbType.Requires]: 'requires needs demands necessitates mandates obliges compels entails',
  
  // Creation/Transformation Types
  [VerbType.Creates]: 'creates makes produces generates builds constructs forms establishes',
  [VerbType.Transforms]: 'transforms converts changes modifies alters transitions morphs evolves',
  [VerbType.Becomes]: 'becomes turns evolves transforms changes transitions develops grows',
  [VerbType.Modifies]: 'modifies changes updates alters edits revises adjusts adapts',
  [VerbType.Consumes]: 'consumes uses utilizes depletes expends absorbs takes processes',
  
  // Ownership/Attribution Types
  [VerbType.Owns]: 'owns possesses holds controls manages administers governs maintains',
  [VerbType.AttributedTo]: 'attributed credited assigned ascribed authored written composed',
  [VerbType.CreatedBy]: 'created made produced generated built developed authored written',
  [VerbType.BelongsTo]: 'belongs property possession part member affiliate associated owned',
  
  // Social/Organizational Types
  [VerbType.MemberOf]: 'member participant affiliate associate belongs joined enrolled registered',
  [VerbType.WorksWith]: 'works collaborates cooperates partners teams assists helps supports',
  [VerbType.FriendOf]: 'friend companion buddy pal acquaintance associate connection relationship',
  [VerbType.Follows]: 'follows subscribes tracks monitors watches observes trails pursues',
  [VerbType.Likes]: 'likes enjoys appreciates favors prefers admires values endorses',
  [VerbType.ReportsTo]: 'reports answers subordinate accountable responsible supervised managed',
  [VerbType.Supervises]: 'supervises manages oversees directs leads controls guides administers',
  [VerbType.Mentors]: 'mentors teaches guides coaches instructs trains advises counsels',
  [VerbType.Communicates]: 'communicates talks speaks messages contacts interacts corresponds exchanges',
  
  // Descriptive/Functional Types
  [VerbType.Describes]: 'describes explains details documents specifies outlines depicts characterizes',
  [VerbType.Defines]: 'defines specifies establishes determines sets declares identifies designates',
  [VerbType.Categorizes]: 'categorizes classifies groups sorts organizes arranges labels tags',
  [VerbType.Measures]: 'measures quantifies gauges assesses evaluates calculates determines counts',
  [VerbType.Evaluates]: 'evaluates assesses analyzes reviews examines appraises judges rates',
  [VerbType.Uses]: 'uses utilizes employs applies operates handles manipulates exploits',
  [VerbType.Implements]: 'implements executes realizes performs accomplishes carries delivers completes',
  [VerbType.Extends]: 'extends expands enhances augments amplifies broadens enlarges develops',
  
  // Enhanced Relationships
  [VerbType.Inherits]: 'inherits derives extends receives obtains acquires succeeds legacy',
  [VerbType.Conflicts]: 'conflicts contradicts opposes clashes disputes disagrees incompatible inconsistent',
  [VerbType.Synchronizes]: 'synchronizes coordinates aligns harmonizes matches corresponds parallels coincides',
  [VerbType.Competes]: 'competes rivals contends contests challenges opposes vies struggles'
}

/**
 * Result of type matching with confidence scores
 */
export interface TypeMatchResult {
  type: string
  confidence: number
  reasoning: string
  alternatives: Array<{
    type: string
    confidence: number
  }>
}

/**
 * Intelligent Type Matcher using semantic embeddings
 */
export class IntelligentTypeMatcher {
  private embedder: TransformerEmbedding
  private nounEmbeddings: Map<string, Vector> = new Map()
  private verbEmbeddings: Map<string, Vector> = new Map()
  private initialized = false
  private cache: Map<string, TypeMatchResult> = new Map()
  
  constructor() {
    this.embedder = new TransformerEmbedding({ verbose: false })
  }
  
  /**
   * Initialize the type matcher by generating embeddings for all types
   */
  async init(): Promise<void> {
    if (this.initialized) return
    
    await this.embedder.init()
    
    // Generate embeddings for noun types
    for (const [type, description] of Object.entries(NOUN_TYPE_DESCRIPTIONS)) {
      const embedding = await this.embedder.embed(description)
      this.nounEmbeddings.set(type, embedding)
    }
    
    // Generate embeddings for verb types
    for (const [type, description] of Object.entries(VERB_TYPE_DESCRIPTIONS)) {
      const embedding = await this.embedder.embed(description)
      this.verbEmbeddings.set(type, embedding)
    }
    
    this.initialized = true
  }
  
  /**
   * Match an object to the most appropriate noun type
   */
  async matchNounType(obj: any): Promise<TypeMatchResult> {
    await this.init()
    
    // Create a text representation of the object for embedding
    const textRepresentation = this.createTextRepresentation(obj)
    
    // Check cache
    const cacheKey = `noun:${textRepresentation}`
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!
    }
    
    // Generate embedding for the input
    const inputEmbedding = await this.embedder.embed(textRepresentation)
    
    // Calculate similarities to all noun types
    const similarities: Array<{ type: string; similarity: number }> = []
    
    for (const [type, typeEmbedding] of this.nounEmbeddings.entries()) {
      // Convert cosine distance to similarity (1 - distance)
      const similarity = 1 - cosineDistance(inputEmbedding, typeEmbedding)
      similarities.push({ type, similarity })
    }
    
    // Sort by similarity (highest first)
    similarities.sort((a, b) => b.similarity - a.similarity)
    
    // Apply heuristic rules for common patterns
    const heuristicType = this.applyNounHeuristics(obj)
    if (heuristicType) {
      // Boost the heuristic type's confidence
      const heuristicIndex = similarities.findIndex(s => s.type === heuristicType)
      if (heuristicIndex > 0) {
        similarities[heuristicIndex].similarity *= 1.2 // 20% boost
        similarities.sort((a, b) => b.similarity - a.similarity)
      }
    }
    
    // Create result
    const result: TypeMatchResult = {
      type: similarities[0].type,
      confidence: similarities[0].similarity,
      reasoning: this.generateReasoning(obj, similarities[0].type, 'noun'),
      alternatives: similarities.slice(1, 4).map(s => ({
        type: s.type,
        confidence: s.similarity
      }))
    }
    
    // Cache result
    this.cache.set(cacheKey, result)
    
    return result
  }
  
  /**
   * Match a relationship to the most appropriate verb type
   */
  async matchVerbType(
    sourceObj: any,
    targetObj: any,
    relationshipHint?: string
  ): Promise<TypeMatchResult> {
    await this.init()
    
    // Create text representation of the relationship
    const textRepresentation = this.createRelationshipText(sourceObj, targetObj, relationshipHint)
    
    // Check cache
    const cacheKey = `verb:${textRepresentation}`
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!
    }
    
    // Generate embedding
    const inputEmbedding = await this.embedder.embed(textRepresentation)
    
    // Calculate similarities to all verb types
    const similarities: Array<{ type: string; similarity: number }> = []
    
    for (const [type, typeEmbedding] of this.verbEmbeddings.entries()) {
      const similarity = 1 - cosineDistance(inputEmbedding, typeEmbedding)
      similarities.push({ type, similarity })
    }
    
    // Sort by similarity
    similarities.sort((a, b) => b.similarity - a.similarity)
    
    // Apply heuristic rules
    const heuristicType = this.applyVerbHeuristics(sourceObj, targetObj, relationshipHint)
    if (heuristicType) {
      const heuristicIndex = similarities.findIndex(s => s.type === heuristicType)
      if (heuristicIndex > 0) {
        similarities[heuristicIndex].similarity *= 1.2
        similarities.sort((a, b) => b.similarity - a.similarity)
      }
    }
    
    // Create result
    const result: TypeMatchResult = {
      type: similarities[0].type,
      confidence: similarities[0].similarity,
      reasoning: this.generateReasoning(
        { source: sourceObj, target: targetObj, hint: relationshipHint },
        similarities[0].type,
        'verb'
      ),
      alternatives: similarities.slice(1, 4).map(s => ({
        type: s.type,
        confidence: s.similarity
      }))
    }
    
    // Cache result
    this.cache.set(cacheKey, result)
    
    return result
  }
  
  /**
   * Create text representation of an object for embedding
   */
  private createTextRepresentation(obj: any): string {
    const parts: string[] = []
    
    // Add type if available
    if (typeof obj === 'object' && obj !== null) {
      // Add field names and values
      for (const [key, value] of Object.entries(obj)) {
        parts.push(key)
        if (typeof value === 'string') {
          parts.push(value.slice(0, 100)) // Limit string length
        } else if (typeof value === 'number' || typeof value === 'boolean') {
          parts.push(String(value))
        }
      }
      
      // Add special fields with higher weight
      const importantFields = ['type', 'kind', 'category', 'class', 'name', 'title', 'description']
      for (const field of importantFields) {
        if (obj[field]) {
          parts.push(String(obj[field]))
          parts.push(String(obj[field])) // Double weight for important fields
        }
      }
    } else if (typeof obj === 'string') {
      parts.push(obj)
    } else {
      parts.push(String(obj))
    }
    
    return parts.join(' ')
  }
  
  /**
   * Create text representation of a relationship
   */
  private createRelationshipText(
    sourceObj: any,
    targetObj: any,
    relationshipHint?: string
  ): string {
    const parts: string[] = []
    
    if (relationshipHint) {
      parts.push(relationshipHint)
      parts.push(relationshipHint) // Double weight for explicit hint
    }
    
    // Add source context
    if (sourceObj) {
      parts.push('source:')
      parts.push(this.getObjectSummary(sourceObj))
    }
    
    // Add target context
    if (targetObj) {
      parts.push('target:')
      parts.push(this.getObjectSummary(targetObj))
    }
    
    return parts.join(' ')
  }
  
  /**
   * Get a brief summary of an object
   */
  private getObjectSummary(obj: any): string {
    if (typeof obj === 'string') return obj.slice(0, 50)
    if (typeof obj !== 'object' || obj === null) return String(obj)
    
    const summary: string[] = []
    const fields = ['type', 'name', 'title', 'id', 'category', 'kind']
    
    for (const field of fields) {
      if (obj[field]) {
        summary.push(String(obj[field]))
      }
    }
    
    return summary.join(' ').slice(0, 100)
  }
  
  /**
   * Apply heuristic rules for noun type detection
   */
  private applyNounHeuristics(obj: any): string | null {
    if (typeof obj !== 'object' || obj === null) return null
    
    // Person heuristics
    if (obj.email || obj.firstName || obj.lastName || obj.username || obj.age || obj.gender) {
      return NounType.Person
    }
    
    // Organization heuristics
    if (obj.companyName || obj.organizationId || obj.employees || obj.industry) {
      return NounType.Organization
    }
    
    // Location heuristics
    if (obj.latitude || obj.longitude || obj.address || obj.city || obj.country || obj.coordinates) {
      return NounType.Location
    }
    
    // Document heuristics
    if (obj.content && (obj.title || obj.author) || obj.documentType || obj.pages) {
      return NounType.Document
    }
    
    // Event heuristics
    if (obj.startTime || obj.endTime || obj.date || obj.eventType || obj.attendees) {
      return NounType.Event
    }
    
    // Product heuristics
    if (obj.price || obj.sku || obj.inventory || obj.productId) {
      return NounType.Product
    }
    
    // Task heuristics
    if (obj.status && (obj.assignee || obj.dueDate) || obj.priority || obj.completed !== undefined) {
      return NounType.Task
    }
    
    // Media heuristics
    if (obj.url && (obj.url.match(/\.(jpg|jpeg|png|gif|mp4|mp3|wav)/i))) {
      return NounType.Media
    }
    
    // Dataset heuristics
    if (Array.isArray(obj.data) || obj.rows || obj.columns || obj.schema) {
      return NounType.Dataset
    }
    
    return null
  }
  
  /**
   * Apply heuristic rules for verb type detection
   */
  private applyVerbHeuristics(
    sourceObj: any,
    targetObj: any,
    relationshipHint?: string
  ): string | null {
    if (!relationshipHint) return null
    
    const hint = relationshipHint.toLowerCase()
    
    // Ownership patterns
    if (hint.includes('own') || hint.includes('possess') || hint.includes('has')) {
      return VerbType.Owns
    }
    
    // Creation patterns
    if (hint.includes('create') || hint.includes('made') || hint.includes('authored')) {
      return VerbType.Creates
    }
    
    // Containment patterns
    if (hint.includes('contain') || hint.includes('include') || hint.includes('has')) {
      return VerbType.Contains
    }
    
    // Membership patterns
    if (hint.includes('member') || hint.includes('belong') || hint.includes('part')) {
      return VerbType.MemberOf
    }
    
    // Reference patterns
    if (hint.includes('refer') || hint.includes('cite') || hint.includes('link')) {
      return VerbType.References
    }
    
    // Dependency patterns
    if (hint.includes('depend') || hint.includes('require') || hint.includes('need')) {
      return VerbType.DependsOn
    }
    
    return null
  }
  
  /**
   * Generate human-readable reasoning for the type selection
   */
  private generateReasoning(
    obj: any,
    selectedType: string,
    typeKind: 'noun' | 'verb'
  ): string {
    const descriptions = typeKind === 'noun' ? NOUN_TYPE_DESCRIPTIONS : VERB_TYPE_DESCRIPTIONS
    const typeDesc = descriptions[selectedType]
    
    if (typeKind === 'noun') {
      const fields = Object.keys(obj).slice(0, 3).join(', ')
      return `Matched to ${selectedType} based on semantic similarity to "${typeDesc.split(' ').slice(0, 5).join(' ')}..." and object fields: ${fields}`
    } else {
      return `Matched to ${selectedType} based on semantic similarity to "${typeDesc.split(' ').slice(0, 5).join(' ')}..." and relationship context`
    }
  }
  
  /**
   * Clear the cache
   */
  clearCache(): void {
    this.cache.clear()
  }
  
  /**
   * Dispose of resources
   */
  async dispose(): Promise<void> {
    await this.embedder.dispose()
    this.cache.clear()
    this.nounEmbeddings.clear()
    this.verbEmbeddings.clear()
  }
}

/**
 * Singleton instance for efficient reuse
 */
let globalMatcher: IntelligentTypeMatcher | null = null

/**
 * Get or create the global type matcher instance
 */
export async function getTypeMatcher(): Promise<IntelligentTypeMatcher> {
  if (!globalMatcher) {
    globalMatcher = new IntelligentTypeMatcher()
    await globalMatcher.init()
  }
  return globalMatcher
}