/**
 * Similarity Projection Strategy
 *
 * Maps similarity-based paths to files with similar content
 * Uses EXISTING HNSW Index for O(log n) vector similarity
 */

import { Brainy } from '../../../brainy.js'
import { VirtualFileSystem } from '../../VirtualFileSystem.js'
import { FindParams } from '../../../types/brainy.types.js'
import { BaseProjectionStrategy } from '../ProjectionStrategy.js'
import { SimilarityValue } from '../SemanticPathParser.js'

/**
 * Similarity Projection: /similar-to/<path>/threshold-N
 *
 * Uses EXISTING infrastructure:
 * - Brainy.similar() for vector similarity (REAL - line 680 in brainy.ts)
 * - HNSW Index for O(log n) nearest neighbor search (REAL)
 * - Cosine similarity for scoring (REAL)
 */
export class SimilarityProjection extends BaseProjectionStrategy {
  readonly name = 'similar'

  /**
   * Convert similarity value to Brainy FindParams
   * Note: Similarity uses brain.similar(), not find(), but we provide this for consistency
   */
  toQuery(value: SimilarityValue, subpath?: string): FindParams {
    // This is informational - actual resolution uses brain.similar()
    return {
      where: {
        vfsType: 'file'
      },
      near: {
        id: value.targetPath,
        threshold: value.threshold || 0.7
      },
      limit: 50
    }
  }

  /**
   * Resolve similarity using REAL Brainy.similar()
   * Uses HNSW Index for O(log n) vector search
   */
  async resolve(brain: Brainy, vfs: VirtualFileSystem, value: SimilarityValue): Promise<string[]> {
    // Step 1: Resolve target path to entity ID
    const targetId = await this.resolvePathToId(vfs, value.targetPath)
    if (!targetId) {
      return []
    }

    // Step 2: Get target entity to use its vector
    const targetEntity = await brain.get(targetId)
    if (!targetEntity) {
      return []
    }

    // Step 3: Find similar entities using REAL HNSW search
    // VERIFIED: brain.similar() exists at line 680 in brainy.ts
    const results = await brain.similar({
      to: targetEntity,
      threshold: value.threshold || 0.7,
      limit: 50,
      where: { vfsType: 'file' }  // Only files
    })

    // Extract IDs
    return this.extractIds(results)
  }

  /**
   * Resolve path to entity ID
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