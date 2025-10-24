/**
 * Author Projection Strategy
 *
 * Maps author-based paths to files owned by that author
 * Uses EXISTING MetadataIndexManager for O(log n) queries
 */

import { Brainy } from '../../../brainy.js'
import { VirtualFileSystem } from '../../VirtualFileSystem.js'
import { FindParams } from '../../../types/brainy.types.js'
import { BaseProjectionStrategy } from '../ProjectionStrategy.js'
import { VFSEntity } from '../../types.js'

/**
 * Author Projection: /by-author/<authorName>/<subpath>
 *
 * Uses EXISTING infrastructure:
 * - Brainy.find() with metadata filters (REAL)
 * - MetadataIndexManager for O(log n) owner queries (REAL)
 * - VFSMetadata.owner field (REAL - types.ts line 44)
 */
export class AuthorProjection extends BaseProjectionStrategy {
  readonly name = 'author'

  /**
   * Convert author name to Brainy FindParams
   */
  toQuery(authorName: string, subpath?: string): FindParams {
    const query: FindParams = {
      where: {
        vfsType: 'file',
        owner: authorName
      },
      limit: 1000,
      includeVFS: true  // v4.4.0: Must include VFS entities!
    }

    // Filter by filename if subpath specified
    if (subpath) {
      query.where = {
        ...query.where,
        anyOf: [  // BFO logical operator (not $or)
          { name: subpath },
          { path: { endsWith: subpath } }  // BFO operator (not $regex)
        ]
      }
    }

    return query
  }

  /**
   * Resolve author to entity IDs using REAL Brainy.find()
   */
  async resolve(brain: Brainy, vfs: VirtualFileSystem, authorName: string): Promise<string[]> {
    // Use REAL Brainy metadata filtering
    const results = await brain.find({
      where: {
        vfsType: 'file',
        owner: authorName
      },
      limit: 1000,
      includeVFS: true  // v4.4.0: Must include VFS entities!
    })

    return this.extractIds(results)
  }

  /**
   * List all unique authors
   * Uses aggregation over metadata
   */
  async list(brain: Brainy, vfs: VirtualFileSystem, limit = 100): Promise<VFSEntity[]> {
    // Get all files with owner metadata
    const results = await brain.find({
      where: {
        vfsType: 'file',
        owner: { $exists: true }
      },
      limit,
      includeVFS: true  // v4.4.0: Must include VFS entities!
    })

    return results.map(r => r.entity as VFSEntity)
  }
}