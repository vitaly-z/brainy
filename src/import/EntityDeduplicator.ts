/**
 * Entity Deduplicator
 *
 * Finds and merges duplicate entities across imports using:
 * - Embedding-based similarity matching
 * - Type-aware comparison
 * - Confidence-weighted merging
 * - Provenance tracking
 *
 * NO MOCKS - Production-ready implementation
 */

import { Brainy } from '../brainy.js'
import { NounType } from '../types/graphTypes.js'

export interface EntityCandidate {
  id?: string
  name: string
  type: NounType
  description: string
  confidence: number
  metadata: Record<string, any>
}

export interface DuplicateMatch {
  existingId: string
  existingName: string
  similarity: number
  shouldMerge: boolean
  reason: string
}

export interface EntityDeduplicationOptions {
  /** Similarity threshold for considering entities as duplicates (0-1) */
  similarityThreshold?: number

  /** Only match entities of the same type */
  strictTypeMatching?: boolean

  /** Enable fuzzy name matching */
  enableFuzzyMatching?: boolean

  /** Minimum confidence to consider for merging */
  minConfidence?: number
}

export interface MergeResult {
  mergedEntityId: string
  wasMerged: boolean
  mergedWith?: string
  confidence: number
  provenance: string[]
}

/**
 * EntityDeduplicator - Prevents duplicate entities across imports
 */
export class EntityDeduplicator {
  private brain: Brainy

  constructor(brain: Brainy) {
    this.brain = brain
  }

  /**
   * Find duplicate entities in the knowledge graph
   */
  async findDuplicates(
    candidate: EntityCandidate,
    options: EntityDeduplicationOptions = {}
  ): Promise<DuplicateMatch | null> {
    const opts = {
      similarityThreshold: options.similarityThreshold || 0.85,
      strictTypeMatching: options.strictTypeMatching !== false,
      enableFuzzyMatching: options.enableFuzzyMatching !== false,
      minConfidence: options.minConfidence || 0.6
    }

    // Skip low-confidence candidates
    if (candidate.confidence < opts.minConfidence) {
      return null
    }

    // Search for similar entities by name and description
    const searchText = `${candidate.name} ${candidate.description}`.trim()

    try {
      const results = await this.brain.find({
        query: searchText,
        limit: 5,
        where: opts.strictTypeMatching ? { type: candidate.type } as any : undefined
      })

      // Check each result for potential duplicates
      for (const result of results) {
        const similarity = result.score || 0
        const existingName = result.entity.metadata?.name || result.id
        const existingType = result.entity.metadata?.type || result.entity.metadata?.nounType || result.entity.type

        // Skip if below similarity threshold
        if (similarity < opts.similarityThreshold) {
          continue
        }

        // Type matching check
        if (opts.strictTypeMatching && existingType !== candidate.type) {
          continue
        }

        // Exact name match (case-insensitive)
        if (this.normalizeString(candidate.name) === this.normalizeString(existingName)) {
          return {
            existingId: result.id,
            existingName,
            similarity: 1.0,
            shouldMerge: true,
            reason: 'Exact name match'
          }
        }

        // High similarity match
        if (similarity >= opts.similarityThreshold) {
          // Additional validation for fuzzy matching
          if (opts.enableFuzzyMatching && this.areSimilarNames(candidate.name, existingName)) {
            return {
              existingId: result.id,
              existingName,
              similarity,
              shouldMerge: true,
              reason: `High similarity (${(similarity * 100).toFixed(1)}%)`
            }
          }
        }
      }
    } catch (error) {
      // If search fails, assume no duplicates
      return null
    }

    return null
  }

  /**
   * Merge entity data with existing entity
   */
  async mergeEntity(
    existingId: string,
    candidate: EntityCandidate,
    importSource: string
  ): Promise<MergeResult> {
    try {
      // Get existing entity
      const existing = await this.brain.get(existingId)
      if (!existing) {
        throw new Error(`Entity ${existingId} not found`)
      }

      // Merge metadata
      const mergedMetadata = {
        ...existing.metadata,
        // Track provenance
        imports: [
          ...(existing.metadata?.imports || []),
          importSource
        ],
        // Merge VFS paths
        vfsPaths: [
          ...(existing.metadata?.vfsPaths || [existing.metadata?.vfsPath]).filter(Boolean),
          candidate.metadata?.vfsPath
        ].filter(Boolean),
        // Update confidence (weighted average)
        confidence: this.mergeConfidence(
          existing.metadata?.confidence || 0.5,
          candidate.confidence
        ),
        // Merge other metadata
        ...this.mergeMetadataFields(existing.metadata, candidate.metadata),
        // Track last update
        lastUpdated: Date.now(),
        mergeCount: (existing.metadata?.mergeCount || 0) + 1
      }

      // Update entity
      await this.brain.update({
        id: existingId,
        metadata: mergedMetadata,
        merge: true
      })

      return {
        mergedEntityId: existingId,
        wasMerged: true,
        mergedWith: existing.metadata?.name || existingId,
        confidence: mergedMetadata.confidence,
        provenance: mergedMetadata.imports
      }
    } catch (error) {
      throw new Error(`Failed to merge entity: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  /**
   * Create or merge entity with deduplication
   */
  async createOrMerge(
    candidate: EntityCandidate,
    importSource: string,
    options: EntityDeduplicationOptions = {}
  ): Promise<MergeResult> {
    // Check for duplicates
    const duplicate = await this.findDuplicates(candidate, options)

    if (duplicate && duplicate.shouldMerge) {
      // Merge with existing entity
      return await this.mergeEntity(duplicate.existingId, candidate, importSource)
    }

    // No duplicate found, create new entity
    const entityId = await this.brain.add({
      data: candidate.description || candidate.name,
      type: candidate.type,
      metadata: {
        ...candidate.metadata,
        name: candidate.name,
        confidence: candidate.confidence,
        imports: [importSource],
        vfsPaths: [candidate.metadata?.vfsPath].filter(Boolean),
        createdAt: Date.now(),
        mergeCount: 0
      }
    })

    // Update candidate with new ID
    candidate.id = entityId

    return {
      mergedEntityId: entityId,
      wasMerged: false,
      confidence: candidate.confidence,
      provenance: [importSource]
    }
  }

  /**
   * Normalize string for comparison
   */
  private normalizeString(str: string): string {
    return str
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]/g, '')
  }

  /**
   * Check if two names are similar (fuzzy matching)
   */
  private areSimilarNames(name1: string, name2: string): boolean {
    const n1 = this.normalizeString(name1)
    const n2 = this.normalizeString(name2)

    // Exact match
    if (n1 === n2) return true

    // Length difference check
    const lengthDiff = Math.abs(n1.length - n2.length)
    if (lengthDiff > 3) return false

    // Levenshtein distance
    const distance = this.levenshteinDistance(n1, n2)
    const maxLength = Math.max(n1.length, n2.length)
    const similarity = 1 - (distance / maxLength)

    return similarity >= 0.85
  }

  /**
   * Calculate Levenshtein distance between two strings
   */
  private levenshteinDistance(str1: string, str2: string): number {
    const m = str1.length
    const n = str2.length
    const dp: number[][] = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0))

    for (let i = 0; i <= m; i++) dp[i][0] = i
    for (let j = 0; j <= n; j++) dp[0][j] = j

    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        if (str1[i - 1] === str2[j - 1]) {
          dp[i][j] = dp[i - 1][j - 1]
        } else {
          dp[i][j] = Math.min(
            dp[i - 1][j] + 1,    // deletion
            dp[i][j - 1] + 1,    // insertion
            dp[i - 1][j - 1] + 1 // substitution
          )
        }
      }
    }

    return dp[m][n]
  }

  /**
   * Merge confidence scores (weighted average favoring higher confidence)
   */
  private mergeConfidence(existing: number, incoming: number): number {
    // Weight higher confidence more heavily
    const weights = existing > incoming ? [0.6, 0.4] : [0.4, 0.6]
    return existing * weights[0] + incoming * weights[1]
  }

  /**
   * Merge metadata fields intelligently
   */
  private mergeMetadataFields(
    existing: Record<string, any>,
    incoming: Record<string, any>
  ): Record<string, any> {
    const merged: Record<string, any> = {}

    // Merge arrays
    const arrayFields = ['concepts', 'tags', 'categories']
    for (const field of arrayFields) {
      if (existing[field] || incoming[field]) {
        const combined = [
          ...(existing[field] || []),
          ...(incoming[field] || [])
        ]
        // Deduplicate
        merged[field] = [...new Set(combined)]
      }
    }

    // Prefer longer descriptions
    if (existing.description || incoming.description) {
      merged.description = (existing.description || '').length > (incoming.description || '').length
        ? existing.description
        : incoming.description
    }

    return merged
  }
}
