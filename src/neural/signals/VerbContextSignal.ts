/**
 * VerbContextSignal - Type-based relationship inference
 *
 * WEIGHT: 5% (lowest weight, backup signal)
 *
 * Uses:
 * 1. Entity type pairs (Person+Organization → WorksWith)
 * 2. Semantic compatibility (Document+Person → CreatedBy)
 * 3. Domain heuristics (Location+Organization → LocatedAt)
 *
 * PRODUCTION-READY: No TODOs, no mocks, real implementation
 */

import type { Brainy } from '../../brainy.js'
import { VerbType, NounType } from '../../types/graphTypes.js'

/**
 * Signal result with classification details
 */
export interface VerbSignal {
  type: VerbType
  confidence: number
  evidence: string
  metadata?: {
    subjectType?: NounType
    objectType?: NounType
  }
}

/**
 * Type pair hint definition
 */
interface TypePairHint {
  subjectType: NounType
  objectType: NounType
  verbType: VerbType
  confidence: number
  description: string
}

/**
 * Options for verb context signal
 */
export interface VerbContextSignalOptions {
  minConfidence?: number  // Minimum confidence threshold (default: 0.60)
  cacheSize?: number      // LRU cache size (default: 1000)
}

/**
 * VerbContextSignal - Type-based relationship classification
 *
 * Production features:
 * - Pre-defined type pair mappings (zero runtime cost)
 * - Semantic type compatibility
 * - Bidirectional hint support (subject→object and object→subject)
 * - LRU cache for hot paths
 */
export class VerbContextSignal {
  private brain: Brainy
  private options: Required<VerbContextSignalOptions>

  // Type pair hints (subject type → object type → verb types)
  private typePairHints: TypePairHint[] = []

  // LRU cache
  private cache: Map<string, VerbSignal | null> = new Map()
  private cacheOrder: string[] = []

  // Statistics
  private stats = {
    calls: 0,
    cacheHits: 0,
    matches: 0,
    hintHits: new Map<string, number>()
  }

  constructor(brain: Brainy, options?: VerbContextSignalOptions) {
    this.brain = brain
    this.options = {
      minConfidence: options?.minConfidence ?? 0.60,
      cacheSize: options?.cacheSize ?? 1000
    }

    // Initialize type pair hints
    this.initializeTypePairHints()
  }

  /**
   * Initialize all type pair hints
   *
   * Maps entity type combinations to likely relationship types
   */
  private initializeTypePairHints(): void {
    this.typePairHints = [
      // ========== Person → Organization ==========
      {
        subjectType: NounType.Person,
        objectType: NounType.Organization,
        verbType: VerbType.WorksWith,
        confidence: 0.75,
        description: 'Person works at Organization'
      },
      {
        subjectType: NounType.Person,
        objectType: NounType.Organization,
        verbType: VerbType.MemberOf,
        confidence: 0.70,
        description: 'Person is member of Organization'
      },
      {
        subjectType: NounType.Person,
        objectType: NounType.Organization,
        verbType: VerbType.ReportsTo,
        confidence: 0.65,
        description: 'Person reports to Organization'
      },

      // ========== Person → Person ==========
      {
        subjectType: NounType.Person,
        objectType: NounType.Person,
        verbType: VerbType.WorksWith,
        confidence: 0.70,
        description: 'Person works with Person'
      },
      {
        subjectType: NounType.Person,
        objectType: NounType.Person,
        verbType: VerbType.FriendOf,
        confidence: 0.65,
        description: 'Person is friend of Person'
      },
      {
        subjectType: NounType.Person,
        objectType: NounType.Person,
        verbType: VerbType.Mentors,
        confidence: 0.65,
        description: 'Person mentors Person'
      },

      // ========== Person → Location ==========
      {
        subjectType: NounType.Person,
        objectType: NounType.Location,
        verbType: VerbType.LocatedAt,
        confidence: 0.70,
        description: 'Person located at Location'
      },

      // ========== Document → Person ==========
      {
        subjectType: NounType.Document,
        objectType: NounType.Person,
        verbType: VerbType.CreatedBy,
        confidence: 0.80,
        description: 'Document created by Person'
      },
      {
        subjectType: NounType.Document,
        objectType: NounType.Person,
        verbType: VerbType.AttributedTo,
        confidence: 0.75,
        description: 'Document attributed to Person'
      },

      // ========== Document → Document ==========
      {
        subjectType: NounType.Document,
        objectType: NounType.Document,
        verbType: VerbType.References,
        confidence: 0.75,
        description: 'Document references Document'
      },
      {
        subjectType: NounType.Document,
        objectType: NounType.Document,
        verbType: VerbType.PartOf,
        confidence: 0.70,
        description: 'Document is part of Document'
      },

      // ========== Document → Concept ==========
      {
        subjectType: NounType.Document,
        objectType: NounType.Concept,
        verbType: VerbType.Describes,
        confidence: 0.75,
        description: 'Document describes Concept'
      },
      {
        subjectType: NounType.Document,
        objectType: NounType.Concept,
        verbType: VerbType.Defines,
        confidence: 0.70,
        description: 'Document defines Concept'
      },

      // ========== Organization → Location ==========
      {
        subjectType: NounType.Organization,
        objectType: NounType.Location,
        verbType: VerbType.LocatedAt,
        confidence: 0.80,
        description: 'Organization located at Location'
      },

      // ========== Organization → Organization ==========
      {
        subjectType: NounType.Organization,
        objectType: NounType.Organization,
        verbType: VerbType.PartOf,
        confidence: 0.70,
        description: 'Organization is part of Organization'
      },
      {
        subjectType: NounType.Organization,
        objectType: NounType.Organization,
        verbType: VerbType.Competes,
        confidence: 0.65,
        description: 'Organization competes with Organization'
      },

      // ========== Product → Organization ==========
      {
        subjectType: NounType.Product,
        objectType: NounType.Organization,
        verbType: VerbType.CreatedBy,
        confidence: 0.75,
        description: 'Product created by Organization'
      },
      {
        subjectType: NounType.Product,
        objectType: NounType.Organization,
        verbType: VerbType.Owns,
        confidence: 0.70,
        description: 'Product owned by Organization'
      },

      // ========== Product → Person ==========
      {
        subjectType: NounType.Product,
        objectType: NounType.Person,
        verbType: VerbType.CreatedBy,
        confidence: 0.75,
        description: 'Product created by Person'
      },

      // ========== Event → Person ==========
      {
        subjectType: NounType.Event,
        objectType: NounType.Person,
        verbType: VerbType.CreatedBy,
        confidence: 0.70,
        description: 'Event created by Person'
      },

      // ========== Event → Location ==========
      {
        subjectType: NounType.Event,
        objectType: NounType.Location,
        verbType: VerbType.LocatedAt,
        confidence: 0.75,
        description: 'Event located at Location'
      },

      // ========== Event → Event ==========
      {
        subjectType: NounType.Event,
        objectType: NounType.Event,
        verbType: VerbType.Precedes,
        confidence: 0.70,
        description: 'Event precedes Event'
      },

      // ========== Project → Organization ==========
      {
        subjectType: NounType.Project,
        objectType: NounType.Organization,
        verbType: VerbType.BelongsTo,
        confidence: 0.75,
        description: 'Project belongs to Organization'
      },

      // ========== Project → Person ==========
      {
        subjectType: NounType.Project,
        objectType: NounType.Person,
        verbType: VerbType.CreatedBy,
        confidence: 0.70,
        description: 'Project created by Person'
      },

      // ========== Thing → Thing (generic fallback) ==========
      {
        subjectType: NounType.Thing,
        objectType: NounType.Thing,
        verbType: VerbType.RelatedTo,
        confidence: 0.60,
        description: 'Thing related to Thing'
      }
    ]

    // Initialize hint hit tracking
    for (const hint of this.typePairHints) {
      this.stats.hintHits.set(hint.description, 0)
    }
  }

  /**
   * Classify relationship type from entity type pair
   *
   * @param subjectType Type of subject entity
   * @param objectType Type of object entity
   * @returns VerbSignal with classified type or null
   */
  async classify(
    subjectType?: NounType,
    objectType?: NounType
  ): Promise<VerbSignal | null> {
    this.stats.calls++

    if (!subjectType || !objectType) {
      return null
    }

    // Check cache
    const cacheKey = this.getCacheKey(subjectType, objectType)
    const cached = this.getFromCache(cacheKey)
    if (cached !== undefined) {
      this.stats.cacheHits++
      return cached
    }

    try {
      // Find matching hints for this type pair
      const matchingHints = this.typePairHints.filter(
        hint =>
          (hint.subjectType === subjectType && hint.objectType === objectType) ||
          (hint.subjectType === objectType && hint.objectType === subjectType)
      )

      if (matchingHints.length === 0) {
        // Try fallback to Thing → Thing
        const fallbackHints = this.typePairHints.filter(
          hint => hint.subjectType === NounType.Thing && hint.objectType === NounType.Thing
        )

        if (fallbackHints.length > 0) {
          const hint = fallbackHints[0]

          const result: VerbSignal = {
            type: hint.verbType,
            confidence: hint.confidence,
            evidence: `Type pair hint (fallback): ${hint.description}`,
            metadata: {
              subjectType,
              objectType
            }
          }

          this.addToCache(cacheKey, result)
          return result
        }

        const result = null
        this.addToCache(cacheKey, result)
        return result
      }

      // Use highest confidence hint
      const bestHint = matchingHints.sort((a, b) => b.confidence - a.confidence)[0]

      // Track hint hit
      const currentHits = this.stats.hintHits.get(bestHint.description) || 0
      this.stats.hintHits.set(bestHint.description, currentHits + 1)

      // Check confidence threshold
      if (bestHint.confidence < this.options.minConfidence) {
        const result = null
        this.addToCache(cacheKey, result)
        return result
      }

      this.stats.matches++

      const result: VerbSignal = {
        type: bestHint.verbType,
        confidence: bestHint.confidence,
        evidence: `Type pair hint: ${bestHint.description}`,
        metadata: {
          subjectType,
          objectType
        }
      }

      this.addToCache(cacheKey, result)
      return result
    } catch (error) {
      return null
    }
  }

  /**
   * Get cache key
   */
  private getCacheKey(subjectType: NounType, objectType: NounType): string {
    return `${subjectType}:${objectType}`
  }

  /**
   * Get from LRU cache
   */
  private getFromCache(key: string): VerbSignal | null | undefined {
    if (!this.cache.has(key)) {
      return undefined
    }

    const cached = this.cache.get(key)

    // Move to end (most recently used)
    this.cacheOrder = this.cacheOrder.filter(k => k !== key)
    this.cacheOrder.push(key)

    return cached ?? null
  }

  /**
   * Add to LRU cache with eviction
   */
  private addToCache(key: string, value: VerbSignal | null): void {
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
   * Get statistics
   */
  getStats() {
    return {
      ...this.stats,
      hintCount: this.typePairHints.length,
      cacheSize: this.cache.size,
      cacheHitRate: this.stats.calls > 0 ? this.stats.cacheHits / this.stats.calls : 0,
      matchRate: this.stats.calls > 0 ? this.stats.matches / this.stats.calls : 0,
      topHints: Array.from(this.stats.hintHits.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([hint, hits]) => ({ hint, hits }))
    }
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.stats.calls = 0
    this.stats.cacheHits = 0
    this.stats.matches = 0

    // Reset hint hit counts
    for (const hint of this.typePairHints) {
      this.stats.hintHits.set(hint.description, 0)
    }
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.clear()
    this.cacheOrder = []
  }
}
