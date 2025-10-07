/**
 * Relationship Projection Strategy
 *
 * Maps relationship-based paths to files connected in the knowledge graph
 * Uses EXISTING GraphAdjacencyIndex for O(1) traversal
 */

import { Brainy } from '../../../brainy.js'
import { VirtualFileSystem } from '../../VirtualFileSystem.js'
import { FindParams } from '../../../types/brainy.types.js'
import { VerbType } from '../../../types/graphTypes.js'
import { BaseProjectionStrategy } from '../ProjectionStrategy.js'
import { RelationshipValue } from '../SemanticPathParser.js'

/**
 * Relationship Projection: /related-to/<path>/depth-N/types-X,Y
 *
 * Uses EXISTING infrastructure:
 * - Brainy.getRelations() for graph traversal (REAL - line 803 in brainy.ts)
 * - GraphAdjacencyIndex for O(1) neighbor lookups (REAL)
 * - VerbType enum for relationship types (REAL - graphTypes.ts)
 */
export class RelationshipProjection extends BaseProjectionStrategy {
  readonly name = 'relationship'

  /**
   * Convert relationship value to Brainy FindParams
   * Note: Graph queries don't use FindParams, but we provide this for consistency
   */
  toQuery(value: RelationshipValue, subpath?: string): FindParams {
    // This is informational - actual resolution uses getRelations()
    return {
      where: {
        vfsType: 'file'
      },
      connected: {
        to: value.targetPath,
        depth: value.depth || 1
      },
      limit: 1000
    }
  }

  /**
   * Resolve relationships using REAL Brainy.getRelations()
   * Uses GraphAdjacencyIndex for O(1) graph traversal
   */
  async resolve(brain: Brainy, vfs: VirtualFileSystem, value: RelationshipValue): Promise<string[]> {
    // Step 1: Resolve target path to entity ID
    const targetId = await this.resolvePathToId(vfs, value.targetPath)
    if (!targetId) {
      return []
    }

    // Step 2: Get relationships using REAL Brainy graph
    const depth = value.depth || 1
    const visited = new Set<string>()
    const results: string[] = []

    await this.traverseRelationships(
      brain,
      targetId,
      depth,
      visited,
      results,
      value.relationshipTypes
    )

    // Filter to only files
    return await this.filterFiles(brain, results)
  }

  /**
   * Recursive graph traversal using REAL Brainy.getRelations()
   */
  private async traverseRelationships(
    brain: Brainy,
    entityId: string,
    remainingDepth: number,
    visited: Set<string>,
    results: string[],
    types?: string[]
  ): Promise<void> {
    if (remainingDepth <= 0 || visited.has(entityId)) {
      return
    }

    visited.add(entityId)

    // Get outgoing relationships (REAL method - line 803 in brainy.ts)
    const relations = await brain.getRelations({
      from: entityId,
      limit: 100
    })

    for (const relation of relations) {
      // Filter by relationship type if specified
      if (types && types.length > 0) {
        const relationshipName = relation.type?.toLowerCase()
        if (!types.some(t => t.toLowerCase() === relationshipName)) {
          continue
        }
      }

      // Add to results
      if (!results.includes(relation.to)) {
        results.push(relation.to)
      }

      // Recurse if depth remaining
      if (remainingDepth > 1) {
        await this.traverseRelationships(
          brain,
          relation.to,
          remainingDepth - 1,
          visited,
          results,
          types
        )
      }
    }
  }

  /**
   * Resolve path to entity ID
   * Helper to convert traditional path to entity ID
   */
  private async resolvePathToId(vfs: VirtualFileSystem, path: string): Promise<string | null> {
    try {
      // Use REAL VFS public method
      return await vfs.resolvePathToId(path)
    } catch {
      return null
    }
  }
}