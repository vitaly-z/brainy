/**
 * Rebuild Counts Utility
 *
 * Scans storage and rebuilds counts.json from actual data
 * Use this to fix databases affected by the count synchronization bug
 *
 * NO MOCKS - Production-ready implementation
 */

import type { BaseStorage } from '../storage/baseStorage.js'

export interface RebuildCountsResult {
  /** Total number of entities (nouns) found */
  nounCount: number

  /** Total number of relationships (verbs) found */
  verbCount: number

  /** Entity counts by type */
  entityCounts: Map<string, number>

  /** Verb counts by type */
  verbCounts: Map<string, number>

  /** Processing time in milliseconds */
  duration: number
}

/**
 * Rebuild counts.json from actual storage data
 *
 * This scans all entities and relationships in storage and reconstructs
 * the counts index from scratch. Use this to fix count desynchronization.
 *
 * @param storage - The storage adapter to rebuild counts for
 * @returns Promise that resolves to rebuild statistics
 *
 * @example
 * ```typescript
 * const brain = new Brainy({ storage: { type: 'filesystem', path: './brainy-data' } })
 * await brain.init()
 *
 * const result = await rebuildCounts(brain.storage)
 * console.log(`Rebuilt counts: ${result.nounCount} nouns, ${result.verbCount} verbs`)
 * ```
 */
export async function rebuildCounts(storage: BaseStorage): Promise<RebuildCountsResult> {
  const startTime = Date.now()

  console.log('🔧 Rebuilding counts from storage...')

  const entityCounts = new Map<string, number>()
  const verbCounts = new Map<string, number>()
  let totalNouns = 0
  let totalVerbs = 0

  // Scan all nouns using pagination
  console.log('📊 Scanning entities...')

  // Check if pagination method exists
  const storageWithPagination = storage as any
  if (typeof storageWithPagination.getNounsWithPagination !== 'function') {
    throw new Error('Storage adapter does not support getNounsWithPagination')
  }

  let hasMore = true
  let offset = 0  // Use offset-based pagination instead of cursor (bug fix for infinite loop)

  while (hasMore) {
    const result: any = await storageWithPagination.getNounsWithPagination({
      limit: 100,
      offset  // Pass offset for proper pagination (previously passed cursor which was ignored)
    })

    for (const noun of result.items) {
      const metadata = await storage.getNounMetadata(noun.id)
      if (metadata?.noun) {
        const entityType = metadata.noun
        entityCounts.set(entityType, (entityCounts.get(entityType) || 0) + 1)
        totalNouns++
      }
    }

    hasMore = result.hasMore
    offset += 100  // Increment offset for next page
  }

  console.log(`   Found ${totalNouns} entities across ${entityCounts.size} types`)

  // Scan all verbs using pagination
  console.log('🔗 Scanning relationships...')

  if (typeof storageWithPagination.getVerbsWithPagination !== 'function') {
    throw new Error('Storage adapter does not support getVerbsWithPagination')
  }

  hasMore = true
  offset = 0  // Reset offset for verbs pagination

  while (hasMore) {
    const result: any = await storageWithPagination.getVerbsWithPagination({
      limit: 100,
      offset  // Pass offset for proper pagination (previously passed cursor which was ignored)
    })

    for (const verb of result.items) {
      if (verb.verb) {
        const verbType = verb.verb
        verbCounts.set(verbType, (verbCounts.get(verbType) || 0) + 1)
        totalVerbs++
      }
    }

    hasMore = result.hasMore
    offset += 100  // Increment offset for next page
  }

  console.log(`   Found ${totalVerbs} relationships across ${verbCounts.size} types`)

  // Update storage adapter's in-memory counts FIRST
  storageWithPagination.totalNounCount = totalNouns
  storageWithPagination.totalVerbCount = totalVerbs
  storageWithPagination.entityCounts = entityCounts
  storageWithPagination.verbCounts = verbCounts

  // Mark counts as pending persist (required for flushCounts to actually persist)
  storageWithPagination.pendingCountPersist = true
  storageWithPagination.pendingCountOperations = 1

  // Persist counts using storage adapter's own persist method
  // This ensures counts.json is written correctly (compressed or uncompressed)
  await storageWithPagination.flushCounts()

  const duration = Date.now() - startTime

  console.log(`✅ Counts rebuilt successfully in ${duration}ms`)
  console.log(`   Entities: ${totalNouns}`)
  console.log(`   Relationships: ${totalVerbs}`)
  console.log('')
  console.log('Entity breakdown:')
  entityCounts.forEach((count, entityType) => {
    console.log(`   ${entityType}: ${count}`)
  })

  if (verbCounts.size > 0) {
    console.log('')
    console.log('Relationship breakdown:')
    verbCounts.forEach((count, verbType) => {
      console.log(`   ${verbType}: ${count}`)
    })
  }

  return {
    nounCount: totalNouns,
    verbCount: totalVerbs,
    entityCounts,
    verbCounts,
    duration
  }
}
