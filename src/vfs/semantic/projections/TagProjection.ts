/**
 * Tag Projection Strategy
 *
 * Maps tag-based paths to files with those tags
 * Uses EXISTING MetadataIndexManager for O(log n) queries
 */

import { Brainy } from '../../../brainy.js'
import { VirtualFileSystem } from '../../VirtualFileSystem.js'
import { FindParams } from '../../../types/brainy.types.js'
import { BaseProjectionStrategy } from '../ProjectionStrategy.js'
import { VFSEntity } from '../../types.js'

/**
 * Tag Projection: /by-tag/<tagName>/<subpath>
 *
 * Uses EXISTING infrastructure:
 * - Brainy.find() with metadata filters (REAL)
 * - MetadataIndexManager for O(log n) tag queries (REAL)
 * - VFSMetadata.tags field (REAL - types.ts line 66)
 */
export class TagProjection extends BaseProjectionStrategy {
  readonly name = 'tag'

  /**
   * Convert tag name to Brainy FindParams
   */
  toQuery(tagName: string, subpath?: string): FindParams {
    const query: FindParams = {
      where: {
        vfsType: 'file',
        tags: { contains: tagName }  // contains operator for array search
      },
      limit: 1000
    }

    // Filter by filename if subpath specified
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
   * Resolve tag to entity IDs using REAL Brainy.find()
   */
  async resolve(brain: Brainy, vfs: VirtualFileSystem, tagName: string): Promise<string[]> {
    // v4.7.0: VFS entities are part of the knowledge graph
    const results = await brain.find({
      where: {
        vfsType: 'file',
        tags: { contains: tagName }
      },
      limit: 1000
    })

    return this.extractIds(results)
  }

  /**
   * List all files with tags
   */
  async list(brain: Brainy, vfs: VirtualFileSystem, limit = 100): Promise<VFSEntity[]> {
    // Get all files that have tags
    const results = await brain.find({
      where: {
        vfsType: 'file',
        tags: { exists: true }  // exists operator
      },
      limit
    })

    return results.map(r => r.entity as VFSEntity)
  }
}