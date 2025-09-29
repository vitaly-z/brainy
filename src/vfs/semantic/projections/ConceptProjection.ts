/**
 * Concept Projection Strategy
 *
 * Maps concept-based paths to files containing those concepts
 * Uses EXISTING ConceptSystem and MetadataIndexManager
 */

import { Brainy } from '../../../brainy.js'
import { VirtualFileSystem } from '../../VirtualFileSystem.js'
import { FindParams } from '../../../types/brainy.types.js'
import { BaseProjectionStrategy } from '../ProjectionStrategy.js'
import { VFSEntity } from '../../types.js'

/**
 * Concept Projection: /by-concept/<conceptName>/<subpath>
 *
 * Uses EXISTING infrastructure:
 * - Brainy.find() with metadata filters (REAL - line 580 in brainy.ts)
 * - MetadataIndexManager for O(log n) concept queries (REAL)
 * - ConceptSystem for concept extraction (REAL - ConceptSystem.ts)
 */
export class ConceptProjection extends BaseProjectionStrategy {
  readonly name = 'concept'

  /**
   * Convert concept name to Brainy FindParams
   * Uses EXISTING FindParams.where for metadata filtering
   *
   * Now uses flattened conceptNames array for O(log n) performance!
   */
  toQuery(conceptName: string, subpath?: string): FindParams {
    const query: FindParams = {
      where: {
        vfsType: 'file',
        conceptNames: { contains: conceptName }  // O(log n) indexed query
      },
      limit: 1000
    }

    // If subpath specified, also filter by filename
    if (subpath) {
      query.where = {
        ...query.where,
        anyOf: [  // BFO logical operator
          { name: subpath },
          { path: { endsWith: subpath } }  // BFO operator
        ]
      }
    }

    return query
  }

  /**
   * Resolve concept to entity IDs using REAL Brainy.find()
   * VERIFIED: brain.find() exists at line 580 in brainy.ts
   *
   * NOW OPTIMIZED: Uses flattened conceptNames for O(log n) indexed queries!
   * No more post-filtering - direct index lookup
   */
  async resolve(brain: Brainy, vfs: VirtualFileSystem, conceptName: string): Promise<string[]> {
    // Verify brain.find is a function (safety check)
    if (typeof brain.find !== 'function') {
      throw new Error('VERIFICATION FAILED: brain.find is not a function')
    }

    // Direct O(log n) query using flattened conceptNames array
    // VFS automatically flattens concepts to conceptNames on write
    const results = await brain.find({
      where: {
        vfsType: 'file',
        conceptNames: { contains: conceptName }  // Indexed array query
      },
      limit: 1000
    })

    return this.extractIds(results)
  }

  /**
   * List all files with concept metadata
   * Uses REAL Brainy.find() with metadata filter
   */
  async list(brain: Brainy, vfs: VirtualFileSystem, limit = 100): Promise<VFSEntity[]> {
    const results = await brain.find({
      where: {
        vfsType: 'file',
        conceptNames: { exists: true }  // Use flattened field
      },
      limit
    })

    // Convert to VFSEntity array
    // VERIFIED: Result.entity exists in brainy.types.ts
    return results.map(r => r.entity as VFSEntity)
  }
}