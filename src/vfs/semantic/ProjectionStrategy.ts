/**
 * Projection Strategy Interface
 *
 * Defines how to map semantic path dimensions to Brainy queries
 * Each strategy uses EXISTING Brainy indexes and methods
 */

import { Brainy } from '../../brainy.js'
import { VirtualFileSystem } from '../VirtualFileSystem.js'
import { FindParams } from '../../types/brainy.types.js'
import { VFSEntity } from '../types.js'

/**
 * Strategy for projecting semantic paths into entity queries
 * All implementations MUST use real Brainy methods (no stubs!)
 */
export interface ProjectionStrategy {
  /**
   * Strategy name (used for registration)
   */
  readonly name: string

  /**
   * Convert semantic value to Brainy FindParams
   * Uses EXISTING FindParams type from brainy.types.ts
   */
  toQuery(value: any, subpath?: string): FindParams

  /**
   * Resolve semantic value to entity IDs
   * Uses REAL Brainy.find() method
   *
   * @param brain - REAL Brainy instance
   * @param vfs - REAL VirtualFileSystem instance
   * @param value - The semantic value to resolve
   * @returns Array of entity IDs that match
   */
  resolve(brain: Brainy, vfs: VirtualFileSystem, value: any): Promise<string[]>

  /**
   * List all entities in this dimension
   * Optional - not all strategies need to implement
   *
   * @param brain - REAL Brainy instance
   * @param vfs - REAL VirtualFileSystem instance
   * @param limit - Max results to return
   */
  list?(brain: Brainy, vfs: VirtualFileSystem, limit?: number): Promise<VFSEntity[]>
}

/**
 * Base class for projection strategies with common utilities
 */
export abstract class BaseProjectionStrategy implements ProjectionStrategy {
  abstract readonly name: string

  abstract toQuery(value: any, subpath?: string): FindParams

  abstract resolve(brain: Brainy, vfs: VirtualFileSystem, value: any): Promise<string[]>

  /**
   * Convert Brainy Results to entity IDs
   * Helper method for subclasses
   */
  protected extractIds(results: Array<{ id: string }>): string[] {
    return results.map(r => r.id)
  }

  /**
   * Verify that an entity is a file (not directory)
   * Uses REAL Brainy.get() method
   */
  protected async isFile(brain: Brainy, entityId: string): Promise<boolean> {
    const entity = await brain.get(entityId)
    return entity?.metadata?.vfsType === 'file'
  }

  /**
   * Filter entity IDs to only include files
   * Uses REAL Brainy.get() for each entity
   */
  protected async filterFiles(brain: Brainy, entityIds: string[]): Promise<string[]> {
    const files: string[] = []

    for (const id of entityIds) {
      if (await this.isFile(brain, id)) {
        files.push(id)
      }
    }

    return files
  }
}