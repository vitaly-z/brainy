/**
 * Temporal Projection Strategy
 *
 * Maps time-based paths to files modified at that time
 * Uses EXISTING MetadataIndexManager with range queries
 */

import { Brainy } from '../../../brainy.js'
import { VirtualFileSystem } from '../../VirtualFileSystem.js'
import { FindParams } from '../../../types/brainy.types.js'
import { BaseProjectionStrategy } from '../ProjectionStrategy.js'
import { VFSEntity } from '../../types.js'

/**
 * Temporal Projection: /as-of/<YYYY-MM-DD>/<subpath>
 *
 * Uses EXISTING infrastructure:
 * - Brainy.find() with range queries (REAL)
 * - MetadataIndexManager.$gte/$lte operators (REAL)
 * - VFSMetadata.modified field (REAL - types.ts line 49)
 */
export class TemporalProjection extends BaseProjectionStrategy {
  readonly name = 'time'

  /**
   * Convert date to Brainy FindParams with range query
   */
  toQuery(date: Date, subpath?: string): FindParams {
    // Get start and end of day (24-hour window)
    const startOfDay = new Date(date)
    startOfDay.setHours(0, 0, 0, 0)

    const endOfDay = new Date(date)
    endOfDay.setHours(23, 59, 59, 999)

    const query: FindParams = {
      where: {
        vfsType: 'file',
        modified: {
          greaterEqual: startOfDay.getTime(),  // BFO operator
          lessEqual: endOfDay.getTime()        // BFO operator
        }
      },
      limit: 1000
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
   * Resolve date to entity IDs using REAL Brainy.find()
   * Uses MetadataIndexManager range queries for O(log n) performance
   */
  async resolve(brain: Brainy, vfs: VirtualFileSystem, date: Date): Promise<string[]> {
    const startOfDay = new Date(date)
    startOfDay.setHours(0, 0, 0, 0)

    const endOfDay = new Date(date)
    endOfDay.setHours(23, 59, 59, 999)

    // v4.7.0: VFS entities are part of the knowledge graph
    const results = await brain.find({
      where: {
        vfsType: 'file',
        modified: {
          greaterEqual: startOfDay.getTime(),
          lessEqual: endOfDay.getTime()
        }
      },
      limit: 1000
    })

    return this.extractIds(results)
  }

  /**
   * List recently modified files
   */
  async list(brain: Brainy, vfs: VirtualFileSystem, limit = 100): Promise<VFSEntity[]> {
    const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000)

    const results = await brain.find({
      where: {
        vfsType: 'file',
        modified: { greaterEqual: oneDayAgo }
      },
      limit
    })

    return results.map(r => r.entity as VFSEntity)
  }
}