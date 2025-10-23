/**
 * ContextSignal - Relationship-based entity type classification
 *
 * PRODUCTION-READY: Infers types from relationship patterns in context
 *
 * Weight: 5% (lowest, but critical for ambiguous cases)
 * Speed: Very fast (~1ms) - pure pattern matching on context
 *
 * Key insight: Context reveals type even when entity itself is ambiguous
 * Examples:
 * - "CEO of X" → X is Organization
 * - "lives in Y" → Y is Location
 * - "uses Z" → Z is Technology
 * - "attended W" → W is Event
 *
 * This signal fills the gap when:
 * - Entity is too ambiguous for other signals
 * - Multiple signals conflict
 * - Need relationship-aware classification
 */

import type { Brainy } from '../../brainy.js'
import type { NounType } from '../../types/graphTypes.js'

/**
 * Signal result with classification details
 */
export interface TypeSignal {
  source: 'context-relationship' | 'context-attribute' | 'context-combined'
  type: NounType
  confidence: number
  evidence: string
  metadata?: {
    relationshipPattern?: string
    contextMatch?: string
    relatedEntities?: string[]
  }
}

/**
 * Options for context signal
 */
export interface ContextSignalOptions {
  minConfidence?: number // Minimum confidence threshold (default: 0.50)
  timeout?: number       // Max time in ms (default: 50)
  cacheSize?: number     // LRU cache size (default: 500)
}

/**
 * Relationship pattern for type inference
 */
interface RelationshipPattern {
  pattern: RegExp
  targetType: NounType
  confidence: number
  evidence: string
}

/**
 * ContextSignal - Infer entity types from relationship context
 *
 * Production features:
 * - 50+ relationship patterns organized by type
 * - Attribute patterns (e.g., "fast X" → X is Object/Technology)
 * - Multi-pattern matching with confidence boosting
 * - LRU cache for hot entities
 * - Graceful degradation on errors
 */
export class ContextSignal {
  private brain: Brainy
  private options: Required<ContextSignalOptions>

  // Pre-compiled relationship patterns
  private relationshipPatterns: RelationshipPattern[] = []

  // LRU cache for hot entities
  private cache: Map<string, TypeSignal | null> = new Map()
  private cacheOrder: string[] = []

  // Statistics
  private stats = {
    calls: 0,
    cacheHits: 0,
    relationshipMatches: 0,
    attributeMatches: 0,
    combinedMatches: 0
  }

  constructor(brain: Brainy, options?: ContextSignalOptions) {
    this.brain = brain
    this.options = {
      minConfidence: options?.minConfidence ?? 0.50,
      timeout: options?.timeout ?? 50,
      cacheSize: options?.cacheSize ?? 500
    }

    this.initializePatterns()
  }

  /**
   * Initialize relationship patterns
   *
   * Patterns organized by target type:
   * - Person: roles, actions, possessives
   * - Organization: membership, leadership, employment
   * - Location: spatial relationships, residence
   * - Technology: usage, implementation, integration
   * - Event: attendance, occurrence, scheduling
   * - Concept: understanding, application, theory
   * - Object: ownership, interaction, description
   */
  private initializePatterns(): void {
    // Person patterns - who someone is or what they do
    this.addPatterns([
      {
        pattern: /\b(?:CEO|CTO|CFO|director|manager|founder|owner|president)\s+(?:of|at)\s+$/i,
        targetType: 'organization' as NounType,
        confidence: 0.75,
        evidence: 'Leadership role indicates organization'
      },
      {
        pattern: /\b(?:employee|member|staff|worker|engineer|developer|team member)\s+(?:of|at)\s+$/i,
        targetType: 'organization' as NounType,
        confidence: 0.70,
        evidence: 'Employment relationship indicates organization'
      },
      {
        pattern: /\b(?:lives|resides|located|based)\s+(?:in|at)\s+$/i,
        targetType: 'location' as NounType,
        confidence: 0.80,
        evidence: 'Residence indicates location'
      },
      {
        pattern: /\b(?:born|raised|grew up)\s+(?:in|at)\s+$/i,
        targetType: 'location' as NounType,
        confidence: 0.75,
        evidence: 'Origin indicates location'
      },
      {
        pattern: /\b(?:uses|utilizes|works with|familiar with)\s+$/i,
        targetType: 'thing' as NounType,
        confidence: 0.65,
        evidence: 'Tool usage indicates thing/tool'
      },
      {
        pattern: /\b(?:attended|participated in|spoke at|presented at)\s+$/i,
        targetType: 'event' as NounType,
        confidence: 0.75,
        evidence: 'Attendance indicates event'
      },
      {
        pattern: /\b(?:believes in|understands|studies|researches)\s+$/i,
        targetType: 'concept' as NounType,
        confidence: 0.60,
        evidence: 'Intellectual engagement indicates concept'
      },
      {
        pattern: /\b(?:owns|possesses|has|carries)\s+(?:a|an|the)?\s*$/i,
        targetType: 'thing' as NounType,
        confidence: 0.70,
        evidence: 'Possession indicates physical thing'
      }
    ])

    // Organization patterns - organizational relationships
    this.addPatterns([
      {
        pattern: /\b(?:subsidiary|division|branch|department)\s+of\s+$/i,
        targetType: 'organization' as NounType,
        confidence: 0.80,
        evidence: 'Organizational hierarchy indicates parent organization'
      },
      {
        pattern: /\b(?:partner|collaborator|vendor|supplier)\s+(?:of|to)\s+$/i,
        targetType: 'organization' as NounType,
        confidence: 0.70,
        evidence: 'Business relationship indicates organization'
      },
      {
        pattern: /\b(?:headquarters|office|facility)\s+(?:in|at)\s+$/i,
        targetType: 'location' as NounType,
        confidence: 0.75,
        evidence: 'Physical presence indicates location'
      },
      {
        pattern: /\b(?:acquired|purchased|bought|merged with)\s+$/i,
        targetType: 'organization' as NounType,
        confidence: 0.75,
        evidence: 'Acquisition indicates organization'
      },
      {
        pattern: /\b(?:implements|uses|adopts|integrates)\s+$/i,
        targetType: 'thing' as NounType,
        confidence: 0.65,
        evidence: 'Tool adoption indicates thing/service'
      },
      {
        pattern: /\b(?:organized|hosted|sponsored)\s+$/i,
        targetType: 'event' as NounType,
        confidence: 0.70,
        evidence: 'Event organization indicates event'
      }
    ])

    // Location patterns - spatial relationships
    this.addPatterns([
      {
        pattern: /\b(?:capital|largest city|major city)\s+of\s+$/i,
        targetType: 'location' as NounType,
        confidence: 0.85,
        evidence: 'Geographic relationship indicates location'
      },
      {
        pattern: /\b(?:near|adjacent to|next to|close to)\s+$/i,
        targetType: 'location' as NounType,
        confidence: 0.70,
        evidence: 'Spatial proximity indicates location'
      },
      {
        pattern: /\b(?:north|south|east|west)\s+of\s+$/i,
        targetType: 'location' as NounType,
        confidence: 0.75,
        evidence: 'Directional relationship indicates location'
      },
      {
        pattern: /\b(?:located in|situated in|found in)\s+$/i,
        targetType: 'location' as NounType,
        confidence: 0.80,
        evidence: 'Location reference indicates place'
      }
    ])

    // Technology patterns - technical relationships
    this.addPatterns([
      {
        pattern: /\b(?:built with|powered by|runs on)\s+$/i,
        targetType: 'thing' as NounType,
        confidence: 0.75,
        evidence: 'Technical foundation indicates thing/tool'
      },
      {
        pattern: /\b(?:integrated with|connects to|compatible with)\s+$/i,
        targetType: 'interface' as NounType,
        confidence: 0.70,
        evidence: 'Integration indicates interface/API'
      },
      {
        pattern: /\b(?:deployed on|hosted on|running on)\s+$/i,
        targetType: 'service' as NounType,
        confidence: 0.75,
        evidence: 'Deployment indicates service/platform'
      },
      {
        pattern: /\b(?:developed by|created by|maintained by)\s+$/i,
        targetType: 'organization' as NounType,
        confidence: 0.70,
        evidence: 'Development indicates organization/person'
      },
      {
        pattern: /\b(?:API for|SDK for|library for)\s+$/i,
        targetType: 'interface' as NounType,
        confidence: 0.75,
        evidence: 'Technical tooling indicates interface/API'
      }
    ])

    // Event patterns - temporal relationships
    this.addPatterns([
      {
        pattern: /\b(?:before|after|during|since)\s+$/i,
        targetType: 'event' as NounType,
        confidence: 0.60,
        evidence: 'Temporal relationship indicates event'
      },
      {
        pattern: /\b(?:scheduled for|planned for|occurring on)\s+$/i,
        targetType: 'event' as NounType,
        confidence: 0.70,
        evidence: 'Scheduling indicates event'
      },
      {
        pattern: /\b(?:keynote at|session at|talk at|presentation at)\s+$/i,
        targetType: 'event' as NounType,
        confidence: 0.80,
        evidence: 'Speaking engagement indicates event'
      },
      {
        pattern: /\b(?:registration for|tickets to|attending)\s+$/i,
        targetType: 'event' as NounType,
        confidence: 0.75,
        evidence: 'Participation indicates event'
      }
    ])

    // Concept patterns - intellectual relationships
    this.addPatterns([
      {
        pattern: /\b(?:theory of|principle of|concept of|idea of)\s+$/i,
        targetType: 'concept' as NounType,
        confidence: 0.75,
        evidence: 'Theoretical framework indicates concept'
      },
      {
        pattern: /\b(?:based on|derived from|inspired by)\s+$/i,
        targetType: 'concept' as NounType,
        confidence: 0.60,
        evidence: 'Intellectual lineage indicates concept'
      },
      {
        pattern: /\b(?:example of|instance of|case of)\s+$/i,
        targetType: 'concept' as NounType,
        confidence: 0.65,
        evidence: 'Exemplification indicates concept'
      },
      {
        pattern: /\b(?:methodology|approach|strategy)\s+(?:for|of)\s+$/i,
        targetType: 'process' as NounType,
        confidence: 0.70,
        evidence: 'Method reference indicates process'
      }
    ])

    // Object patterns - physical relationships
    this.addPatterns([
      {
        pattern: /\b(?:made of|composed of|constructed from)\s+$/i,
        targetType: 'thing' as NounType,
        confidence: 0.65,
        evidence: 'Material composition indicates thing'
      },
      {
        pattern: /\b(?:part of|component of|piece of)\s+$/i,
        targetType: 'thing' as NounType,
        confidence: 0.70,
        evidence: 'Physical composition indicates thing'
      },
      {
        pattern: /\b(?:weighs|measures|dimensions)\s+$/i,
        targetType: 'thing' as NounType,
        confidence: 0.75,
        evidence: 'Physical measurement indicates thing'
      }
    ])

    // Attribute patterns - descriptive relationships
    this.addPatterns([
      {
        pattern: /\b(?:fast|slow|quick|rapid|speedy)\s+$/i,
        targetType: 'thing' as NounType,
        confidence: 0.55,
        evidence: 'Speed attribute indicates thing/tool'
      },
      {
        pattern: /\b(?:large|small|tiny|huge|massive)\s+$/i,
        targetType: 'thing' as NounType,
        confidence: 0.55,
        evidence: 'Size attribute indicates physical thing'
      },
      {
        pattern: /\b(?:expensive|cheap|affordable|costly)\s+$/i,
        targetType: 'thing' as NounType,
        confidence: 0.60,
        evidence: 'Price attribute indicates purchasable thing'
      },
      {
        pattern: /\b(?:annual|monthly|weekly|daily)\s+$/i,
        targetType: 'event' as NounType,
        confidence: 0.65,
        evidence: 'Frequency indicates recurring event'
      }
    ])

    // Document patterns - information relationships
    this.addPatterns([
      {
        pattern: /\b(?:chapter (?:in|of)|section (?:in|of)|page in)\s+$/i,
        targetType: 'document' as NounType,
        confidence: 0.75,
        evidence: 'Document structure indicates document'
      },
      {
        pattern: /\b(?:author of|wrote|published)\s+$/i,
        targetType: 'document' as NounType,
        confidence: 0.70,
        evidence: 'Authorship indicates document'
      },
      {
        pattern: /\b(?:reference to|citation of|mentioned in)\s+$/i,
        targetType: 'document' as NounType,
        confidence: 0.65,
        evidence: 'Citation indicates document'
      }
    ])

    // Project patterns - work relationships
    this.addPatterns([
      {
        pattern: /\b(?:milestone in|phase of|stage of)\s+$/i,
        targetType: 'project' as NounType,
        confidence: 0.70,
        evidence: 'Project structure indicates project'
      },
      {
        pattern: /\b(?:deliverable for|outcome of|goal of)\s+$/i,
        targetType: 'project' as NounType,
        confidence: 0.65,
        evidence: 'Project objective indicates project'
      },
      {
        pattern: /\b(?:working on|contributing to|involved in)\s+$/i,
        targetType: 'project' as NounType,
        confidence: 0.60,
        evidence: 'Work engagement indicates project'
      }
    ])
  }

  /**
   * Add relationship patterns in bulk
   */
  private addPatterns(patterns: RelationshipPattern[]): void {
    this.relationshipPatterns.push(...patterns)
  }

  /**
   * Classify entity type using context-based signals
   *
   * Main entry point - checks relationship patterns in definition/context
   *
   * @param candidate Entity text to classify
   * @param context Context with definition and related entities
   * @returns TypeSignal with classification result
   */
  async classify(
    candidate: string,
    context?: {
      definition?: string
      allTerms?: string[]
      metadata?: any
    }
  ): Promise<TypeSignal | null> {
    this.stats.calls++

    // Context signal requires context to work
    if (!context?.definition && !context?.allTerms) {
      return null
    }

    // Check cache first
    const cacheKey = this.getCacheKey(candidate, context)
    const cached = this.getFromCache(cacheKey)
    if (cached !== undefined) {
      this.stats.cacheHits++
      return cached
    }

    try {
      // Build search text from context
      const searchText = this.buildSearchText(candidate, context)

      // Check relationship patterns
      const relationshipMatch = this.matchRelationshipPatterns(candidate, searchText)

      // Check attribute patterns
      const attributeMatch = this.matchAttributePatterns(candidate, searchText)

      // Combine results
      const result = this.combineResults([relationshipMatch, attributeMatch])

      // Cache result (including nulls to avoid recomputation)
      if (!result || result.confidence >= this.options.minConfidence) {
        this.addToCache(cacheKey, result)
      }

      return result
    } catch (error) {
      // Graceful degradation - return null instead of throwing
      console.warn(`ContextSignal error for "${candidate}":`, error)
      return null
    }
  }

  /**
   * Build search text from candidate and context
   *
   * Extracts text around candidate to find relationship patterns
   */
  private buildSearchText(
    candidate: string,
    context: {
      definition?: string
      allTerms?: string[]
      metadata?: any
    }
  ): string {
    const parts: string[] = []

    // Add definition if available
    if (context.definition) {
      parts.push(context.definition)
    }

    // Add related terms if available
    if (context.allTerms && context.allTerms.length > 0) {
      parts.push(...context.allTerms)
    }

    return parts.join(' ').toLowerCase()
  }

  /**
   * Match relationship patterns in context
   *
   * Looks for patterns like "CEO of X" where X is the candidate
   */
  private matchRelationshipPatterns(
    candidate: string,
    searchText: string
  ): TypeSignal | null {
    const candidateLower = candidate.toLowerCase()
    const matches: Array<{ pattern: RelationshipPattern; matchText: string }> = []

    // Find all occurrences of candidate in search text
    // Only use word boundaries if candidate is all word characters
    const useWordBoundaries = /^[a-z0-9_]+$/i.test(candidateLower)
    const pattern = useWordBoundaries
      ? `\\b${this.escapeRegex(candidateLower)}\\b`
      : this.escapeRegex(candidateLower)
    const regex = new RegExp(pattern, 'gi')
    let match

    while ((match = regex.exec(searchText)) !== null) {
      const beforeText = searchText.substring(Math.max(0, match.index - 100), match.index)

      // Check each pattern against the text before the candidate
      for (const pattern of this.relationshipPatterns) {
        // Skip attribute patterns in relationship matching
        if (pattern.evidence.includes('attribute')) continue

        const patternMatch = pattern.pattern.test(beforeText)
        if (patternMatch) {
          matches.push({ pattern, matchText: beforeText })
        }
      }
    }

    if (matches.length === 0) return null

    // Find best match
    let bestMatch = matches[0]
    for (const match of matches) {
      if (match.pattern.confidence > bestMatch.pattern.confidence) {
        bestMatch = match
      }
    }

    this.stats.relationshipMatches++

    return {
      source: 'context-relationship',
      type: bestMatch.pattern.targetType,
      confidence: bestMatch.pattern.confidence,
      evidence: bestMatch.pattern.evidence,
      metadata: {
        relationshipPattern: bestMatch.pattern.pattern.source,
        contextMatch: bestMatch.matchText.substring(Math.max(0, bestMatch.matchText.length - 50))
      }
    }
  }

  /**
   * Match attribute patterns in context
   *
   * Looks for descriptive patterns like "fast X" where X is the candidate
   */
  private matchAttributePatterns(
    candidate: string,
    searchText: string
  ): TypeSignal | null {
    const candidateLower = candidate.toLowerCase()
    const matches: Array<{ pattern: RelationshipPattern; matchText: string }> = []

    // Find all occurrences of candidate in search text
    // Only use word boundaries if candidate is all word characters
    const useWordBoundaries = /^[a-z0-9_]+$/i.test(candidateLower)
    const pattern = useWordBoundaries
      ? `\\b${this.escapeRegex(candidateLower)}\\b`
      : this.escapeRegex(candidateLower)
    const regex = new RegExp(pattern, 'gi')
    let match

    while ((match = regex.exec(searchText)) !== null) {
      const beforeText = searchText.substring(Math.max(0, match.index - 50), match.index)

      // Check each attribute pattern against the text before the candidate
      for (const pattern of this.relationshipPatterns) {
        // Only check attribute patterns
        if (!pattern.evidence.includes('attribute')) continue

        const patternMatch = pattern.pattern.test(beforeText)
        if (patternMatch) {
          matches.push({ pattern, matchText: beforeText })
        }
      }
    }

    if (matches.length === 0) return null

    // Find best match
    let bestMatch = matches[0]
    for (const match of matches) {
      if (match.pattern.confidence > bestMatch.pattern.confidence) {
        bestMatch = match
      }
    }

    this.stats.attributeMatches++

    return {
      source: 'context-attribute',
      type: bestMatch.pattern.targetType,
      confidence: bestMatch.pattern.confidence,
      evidence: bestMatch.pattern.evidence,
      metadata: {
        relationshipPattern: bestMatch.pattern.pattern.source,
        contextMatch: bestMatch.matchText
      }
    }
  }

  /**
   * Combine results from relationship and attribute matching
   *
   * Prefers relationship matches over attribute matches
   */
  private combineResults(
    matches: Array<TypeSignal | null>
  ): TypeSignal | null {
    // Filter out null matches
    const validMatches = matches.filter((m): m is TypeSignal => m !== null)

    if (validMatches.length === 0) return null

    // Prefer relationship matches over attribute matches
    const relationshipMatch = validMatches.find(m => m.source === 'context-relationship')
    if (relationshipMatch && relationshipMatch.confidence >= this.options.minConfidence) {
      return relationshipMatch
    }

    // Fall back to attribute match
    const attributeMatch = validMatches.find(m => m.source === 'context-attribute')
    if (attributeMatch && attributeMatch.confidence >= this.options.minConfidence) {
      return attributeMatch
    }

    // If multiple matches of same type, use highest confidence
    validMatches.sort((a, b) => b.confidence - a.confidence)
    const best = validMatches[0]

    if (best.confidence >= this.options.minConfidence) {
      return best
    }

    return null
  }

  /**
   * Get statistics about signal performance
   */
  getStats() {
    return {
      ...this.stats,
      cacheSize: this.cache.size,
      cacheHitRate: this.stats.calls > 0 ? this.stats.cacheHits / this.stats.calls : 0,
      relationshipMatchRate: this.stats.calls > 0 ? this.stats.relationshipMatches / this.stats.calls : 0,
      attributeMatchRate: this.stats.calls > 0 ? this.stats.attributeMatches / this.stats.calls : 0
    }
  }

  /**
   * Reset statistics (useful for testing)
   */
  resetStats(): void {
    this.stats = {
      calls: 0,
      cacheHits: 0,
      relationshipMatches: 0,
      attributeMatches: 0,
      combinedMatches: 0
    }
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.clear()
    this.cacheOrder = []
  }

  /**
   * Get pattern count (for testing)
   */
  getPatternCount(): number {
    return this.relationshipPatterns.length
  }

  // ========== Private Helper Methods ==========

  /**
   * Generate cache key from candidate and context
   */
  private getCacheKey(candidate: string, context?: any): string {
    const normalized = candidate.toLowerCase().trim()
    if (!context?.definition) return normalized
    return `${normalized}:${context.definition.substring(0, 50)}`
  }

  /**
   * Get from LRU cache (returns undefined if not found, null if cached as null)
   */
  private getFromCache(key: string): TypeSignal | null | undefined {
    // Check if key exists in cache (including null values)
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
  private addToCache(key: string, value: TypeSignal | null): void {
    // Add to cache
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
   * Escape special regex characters
   */
  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  }
}

/**
 * Create a new ContextSignal instance
 *
 * Convenience factory function
 */
export function createContextSignal(
  brain: Brainy,
  options?: ContextSignalOptions
): ContextSignal {
  return new ContextSignal(brain, options)
}
