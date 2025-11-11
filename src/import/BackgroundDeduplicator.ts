/**
 * Background Deduplicator
 *
 * Performs 3-tier entity deduplication in background after imports:
 * - Tier 1: ID-based (O(1)) - Uses entity metadata for deterministic IDs
 * - Tier 2: Name-based (O(log n)) - Exact name matching (case-insensitive)
 * - Tier 3: Similarity-based (O(n log n)) - Vector similarity via TypeAware HNSW
 *
 * NO MOCKS - Production-ready implementation using existing indexes
 */

import { Brainy } from '../brainy.js'
import { prodLog } from '../utils/logger.js'
import { HNSWNounWithMetadata } from '../coreTypes.js'

export interface DeduplicationStats {
  /** Total entities processed */
  totalEntities: number

  /** Duplicates found by ID matching */
  tier1Matches: number

  /** Duplicates found by name matching */
  tier2Matches: number

  /** Duplicates found by similarity */
  tier3Matches: number

  /** Total entities merged/deleted */
  totalMerged: number

  /** Processing time in milliseconds */
  processingTime: number
}

/**
 * BackgroundDeduplicator - Auto-runs deduplication 5 minutes after imports
 *
 * Architecture:
 * - Debounced trigger (5 min after last import)
 * - Import-scoped deduplication (no cross-contamination)
 * - 3-tier strategy (ID → Name → Similarity)
 * - Uses existing indexes (EntityIdMapper, MetadataIndexManager, TypeAware HNSW)
 */
export class BackgroundDeduplicator {
  private brain: Brainy
  private debounceTimer?: NodeJS.Timeout
  private pendingImports = new Set<string>()
  private isProcessing = false

  constructor(brain: Brainy) {
    this.brain = brain
  }

  /**
   * Schedule deduplication for an import (debounced 5 minutes)
   * Called by ImportCoordinator after each import completes
   */
  scheduleDedup(importId: string): void {
    prodLog.info(`[BackgroundDedup] Scheduled deduplication for import ${importId}`)

    // Add to pending queue
    this.pendingImports.add(importId)

    // Clear existing timer (debouncing)
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer)
    }

    // Schedule for 5 minutes from now
    this.debounceTimer = setTimeout(() => {
      this.runBatchDedup().catch(error => {
        prodLog.error('[BackgroundDedup] Batch dedup failed:', error)
      })
    }, 5 * 60 * 1000)
  }

  /**
   * Run deduplication for all pending imports
   * @private
   */
  private async runBatchDedup(): Promise<void> {
    if (this.isProcessing) {
      prodLog.warn('[BackgroundDedup] Already processing, skipping')
      return
    }

    this.isProcessing = true

    try {
      const imports = Array.from(this.pendingImports)
      prodLog.info(`[BackgroundDedup] Processing ${imports.length} pending import(s)`)

      for (const importId of imports) {
        await this.deduplicateImport(importId)
      }

      this.pendingImports.clear()
      prodLog.info('[BackgroundDedup] Batch deduplication complete')
    } finally {
      this.isProcessing = false
    }
  }

  /**
   * Deduplicate entities from a specific import
   * Uses 3-tier strategy: ID → Name → Similarity
   */
  async deduplicateImport(importId: string): Promise<DeduplicationStats> {
    const startTime = performance.now()

    prodLog.info(`[BackgroundDedup] Starting deduplication for import ${importId}`)

    const stats: DeduplicationStats = {
      totalEntities: 0,
      tier1Matches: 0,
      tier2Matches: 0,
      tier3Matches: 0,
      totalMerged: 0,
      processingTime: 0
    }

    try {
      // Get all entities from this import using brain.find()
      const results = await this.brain.find({
        where: { importId } as any,
        limit: 100000  // Large limit to get all entities from import
      })

      const entities = results.map(r => r.entity as unknown as HNSWNounWithMetadata)
      stats.totalEntities = entities.length

      if (entities.length === 0) {
        prodLog.info(`[BackgroundDedup] No entities found for import ${importId}`)
        return stats
      }

      prodLog.info(`[BackgroundDedup] Processing ${entities.length} entities from import ${importId}`)

      // Tier 1: ID-based deduplication (O(1) per entity)
      const tier1Merged = await this.tier1_IdBased(entities, importId)
      stats.tier1Matches = tier1Merged
      stats.totalMerged += tier1Merged

      // Re-check which entities still exist after Tier 1
      let remainingEntities = entities
      if (tier1Merged > 0) {
        remainingEntities = await this.filterExisting(entities)
        prodLog.info(`[BackgroundDedup] After Tier 1: ${entities.length} → ${remainingEntities.length} entities`)
      }

      // Tier 2: Name-based deduplication on reduced set
      const tier2Merged = await this.tier2_NameBased(remainingEntities, importId)
      stats.tier2Matches = tier2Merged
      stats.totalMerged += tier2Merged

      // Re-check which entities still exist after Tier 2
      if (tier2Merged > 0) {
        remainingEntities = await this.filterExisting(remainingEntities)
        prodLog.info(`[BackgroundDedup] After Tier 2: ${remainingEntities.length} entities remaining`)
      }

      // Tier 3: Similarity-based deduplication on final reduced set
      const tier3Merged = await this.tier3_SimilarityBased(remainingEntities, importId)
      stats.tier3Matches = tier3Merged
      stats.totalMerged += tier3Merged

      stats.processingTime = performance.now() - startTime

      prodLog.info(
        `[BackgroundDedup] Completed for import ${importId}: ` +
        `${stats.totalMerged} merged (T1: ${stats.tier1Matches}, T2: ${stats.tier2Matches}, T3: ${stats.tier3Matches}) ` +
        `in ${stats.processingTime.toFixed(0)}ms`
      )

      return stats
    } catch (error) {
      prodLog.error(`[BackgroundDedup] Error deduplicating import ${importId}:`, error)
      stats.processingTime = performance.now() - startTime
      return stats
    }
  }

  /**
   * Tier 1: ID-based deduplication
   * Uses entity metadata sourceId field for deterministic matching
   * Complexity: O(n) where n = number of entities in import
   */
  private async tier1_IdBased(entities: HNSWNounWithMetadata[], importId: string): Promise<number> {
    const startTime = performance.now()
    let merged = 0

    // Group entities by sourceId (if available)
    const sourceIdGroups = new Map<string, HNSWNounWithMetadata[]>()

    for (const entity of entities) {
      const sourceId = entity.metadata?.sourceId || entity.metadata?.sourceRow
      if (sourceId) {
        const key = `${sourceId}`
        if (!sourceIdGroups.has(key)) {
          sourceIdGroups.set(key, [])
        }
        sourceIdGroups.get(key)!.push(entity)
      }
    }

    // Merge duplicates with same sourceId
    for (const [sourceId, group] of sourceIdGroups) {
      if (group.length > 1) {
        await this.mergeEntities(group, 'ID')
        merged += group.length - 1
      }
    }

    const elapsed = performance.now() - startTime
    if (merged > 0) {
      prodLog.info(`[BackgroundDedup] Tier 1 (ID): Merged ${merged} duplicates in ${elapsed.toFixed(0)}ms`)
    }

    return merged
  }

  /**
   * Tier 2: Name-based deduplication
   * Exact name matching (case-insensitive, normalized)
   * Complexity: O(n) where n = number of entities in import
   */
  private async tier2_NameBased(entities: HNSWNounWithMetadata[], importId: string): Promise<number> {
    const startTime = performance.now()
    let merged = 0

    // Group entities by normalized name
    const nameGroups = new Map<string, HNSWNounWithMetadata[]>()

    for (const entity of entities) {
      const name = entity.metadata?.name
      if (name && typeof name === 'string') {
        const normalized = this.normalizeName(name)
        if (!nameGroups.has(normalized)) {
          nameGroups.set(normalized, [])
        }
        nameGroups.get(normalized)!.push(entity)
      }
    }

    // Merge duplicates with same normalized name and type
    for (const [name, group] of nameGroups) {
      if (group.length > 1) {
        // Further group by type (only merge same types)
        const typeGroups = new Map<string, HNSWNounWithMetadata[]>()
        for (const entity of group) {
          const type = entity.type || 'unknown'
          if (!typeGroups.has(type)) {
            typeGroups.set(type, [])
          }
          typeGroups.get(type)!.push(entity)
        }

        // Merge within each type group
        for (const [type, typeGroup] of typeGroups) {
          if (typeGroup.length > 1) {
            await this.mergeEntities(typeGroup, 'Name')
            merged += typeGroup.length - 1
          }
        }
      }
    }

    const elapsed = performance.now() - startTime
    if (merged > 0) {
      prodLog.info(`[BackgroundDedup] Tier 2 (Name): Merged ${merged} duplicates in ${elapsed.toFixed(0)}ms`)
    }

    return merged
  }

  /**
   * Tier 3: Similarity-based deduplication
   * Uses TypeAware HNSW for vector similarity matching
   * Complexity: O(n log n) where n = number of entities in import
   */
  private async tier3_SimilarityBased(entities: HNSWNounWithMetadata[], importId: string): Promise<number> {
    const startTime = performance.now()
    let merged = 0

    // Process in batches to avoid memory spikes
    const batchSize = 100
    const similarityThreshold = 0.85

    for (let i = 0; i < entities.length; i += batchSize) {
      const batch = entities.slice(i, i + batchSize)

      // Batch vector searches using brain.find() (uses TypeAware HNSW)
      const searches = batch.map(entity => {
        const query = `${entity.metadata?.name || ''} ${entity.metadata?.description || ''}`.trim()
        if (!query) return Promise.resolve([])

        return this.brain.find({
          query,
          limit: 5,
          where: { type: entity.type } as any  // Type-aware search
        })
      })

      const results = await Promise.all(searches)

      // Process matches
      for (let j = 0; j < batch.length; j++) {
        const entity = batch[j]
        const matches = results[j]

        for (const match of matches) {
          // Skip self-matches
          if (match.id === entity.id) continue

          // Only merge high-similarity matches from same import
          if (match.score >= similarityThreshold && match.entity.metadata?.importId === importId) {
            // Check if not already merged
            const stillExists = await this.brain.get(entity.id)
            if (stillExists) {
              // Cast match.entity to HNSWNounWithMetadata (it comes from brain.find results)
              const matchEntity = match.entity as any as HNSWNounWithMetadata
              await this.mergeEntities([entity, matchEntity], 'Similarity')
              merged++
              break  // Only merge with first high-similarity match
            }
          }
        }
      }
    }

    const elapsed = performance.now() - startTime
    if (merged > 0) {
      prodLog.info(`[BackgroundDedup] Tier 3 (Similarity): Merged ${merged} duplicates in ${elapsed.toFixed(0)}ms`)
    }

    return merged
  }

  /**
   * Merge multiple entities into one
   * Keeps entity with highest confidence, merges metadata, deletes duplicates
   */
  private async mergeEntities(entities: HNSWNounWithMetadata[], reason: string): Promise<void> {
    if (entities.length < 2) return

    // Find entity with highest confidence
    const primary = entities.reduce((best, curr) => {
      const bestConf = best.metadata?.confidence || 0.5
      const currConf = curr.metadata?.confidence || 0.5
      return currConf > bestConf ? curr : best
    })

    // Merge metadata from all entities
    const primaryMeta = primary.metadata || {}
    const mergedMetadata = {
      ...primaryMeta,
      // Merge import IDs
      importIds: Array.from(new Set([
        ...(Array.isArray(primaryMeta.importIds) ? primaryMeta.importIds : []),
        ...entities.flatMap(e => Array.isArray(e.metadata?.importIds) ? e.metadata.importIds : [])
      ])),
      // Merge VFS paths
      vfsPaths: Array.from(new Set([
        ...(Array.isArray(primaryMeta.vfsPaths) ? primaryMeta.vfsPaths : []),
        ...entities.flatMap(e => Array.isArray(e.metadata?.vfsPaths) ? e.metadata.vfsPaths : [])
      ])),
      // Merge concepts
      concepts: Array.from(new Set([
        ...(Array.isArray(primaryMeta.concepts) ? primaryMeta.concepts : []),
        ...entities.flatMap(e => Array.isArray(e.metadata?.concepts) ? e.metadata.concepts : [])
      ])),
      // Track merge
      mergeCount: (typeof primaryMeta.mergeCount === 'number' ? primaryMeta.mergeCount : 0) + (entities.length - 1),
      mergedWith: entities.filter(e => e.id !== primary.id).map(e => e.id),
      lastMerged: Date.now(),
      mergeReason: reason
    }

    // Update primary entity with merged metadata
    await this.brain.update({
      id: primary.id,
      metadata: mergedMetadata,
      merge: true
    })

    // Delete duplicate entities
    for (const entity of entities) {
      if (entity.id !== primary.id) {
        try {
          await this.brain.delete(entity.id)
        } catch (error) {
          // Entity might already be deleted, continue
          prodLog.debug(`[BackgroundDedup] Could not delete ${entity.id}:`, error)
        }
      }
    }
  }

  /**
   * Filter entities to only those that still exist (not deleted)
   * @private
   */
  private async filterExisting(entities: HNSWNounWithMetadata[]): Promise<HNSWNounWithMetadata[]> {
    const existing: HNSWNounWithMetadata[] = []

    for (const entity of entities) {
      const stillExists = await this.brain.get(entity.id)
      if (stillExists) {
        existing.push(entity)
      }
    }

    return existing
  }

  /**
   * Normalize string for comparison
   * Lowercase, trim, remove special characters
   */
  private normalizeName(str: string): string {
    return str
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\s+/g, ' ')
  }

  /**
   * Cancel pending deduplication (for cleanup)
   */
  cancelPending(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer)
      this.debounceTimer = undefined
    }
    this.pendingImports.clear()
  }
}
