/**
 * Index Operations with Rollback Support
 *
 * Provides transactional operations for all indexes:
 * - HNSWIndex (unified vector index)
 * - MetadataIndexManager (roaring bitmap filtering)
 * - GraphAdjacencyIndex (LSM-tree graph storage)
 *
 * Each operation can be executed and rolled back atomically.
 */

import type { HNSWIndex } from '../../hnsw/hnswIndex.js'
import type { MetadataIndexManager } from '../../utils/metadataIndex.js'
import type { GraphAdjacencyIndex } from '../../graph/graphAdjacencyIndex.js'
import type { GraphVerb } from '../../coreTypes.js'
import type { Operation, RollbackAction } from '../types.js'

/**
 * Add to HNSW index with rollback support
 *
 * Rollback strategy:
 * - Remove item from index
 *
 * Note: Works with both HNSWIndex and TypeAwareHNSWIndex
 */
export class AddToHNSWOperation implements Operation {
  readonly name = 'AddToHNSW'

  constructor(
    private readonly index: HNSWIndex,
    private readonly id: string,
    private readonly vector: number[]
  ) {}

  async execute(): Promise<RollbackAction> {
    // Check if item already exists (for rollback decision)
    const existed = await this.itemExists(this.id)

    // Add to index
    await this.index.addItem({ id: this.id, vector: this.vector })

    // Return rollback action
    return async () => {
      if (!existed) {
        // Remove newly added item
        await this.index.removeItem(this.id)
      }
      // If item existed before, we don't rollback (update is OK)
      // This prevents index corruption from removing pre-existing items
    }
  }

  /**
   * Check if item exists in index
   */
  private async itemExists(id: string): Promise<boolean> {
    try {
      // Try to get item - if exists, no error
      await (this.index as any).getItem?.(id)
      return true
    } catch {
      return false
    }
  }
}

/**
 * Remove from HNSW index with rollback support
 *
 * Rollback strategy:
 * - Re-add item to index with original vector
 *
 * Note: Requires storing the vector for rollback
 */
export class RemoveFromHNSWOperation implements Operation {
  readonly name = 'RemoveFromHNSW'

  constructor(
    private readonly index: HNSWIndex,
    private readonly id: string,
    private readonly vector: number[] // Required for rollback
  ) {}

  async execute(): Promise<RollbackAction> {
    // Remove from index
    await this.index.removeItem(this.id)

    // Return rollback action
    return async () => {
      // Re-add item with original vector
      await this.index.addItem({ id: this.id, vector: this.vector })
    }
  }
}

/**
 * Add to metadata index with rollback support
 *
 * Rollback strategy:
 * - Remove item from index
 */
export class AddToMetadataIndexOperation implements Operation {
  readonly name = 'AddToMetadataIndex'

  constructor(
    private readonly index: MetadataIndexManager,
    private readonly id: string,
    private readonly entity: any // Entity or metadata structure
  ) {}

  async execute(): Promise<RollbackAction> {
    // Add to metadata index (skipFlush=true for transaction atomicity)
    await this.index.addToIndex(this.id, this.entity, true)

    // Return rollback action
    return async () => {
      // Remove from metadata index
      await this.index.removeFromIndex(this.id, this.entity)
    }
  }
}

/**
 * Remove from metadata index with rollback support
 *
 * Rollback strategy:
 * - Re-add item to index with original metadata
 */
export class RemoveFromMetadataIndexOperation implements Operation {
  readonly name = 'RemoveFromMetadataIndex'

  constructor(
    private readonly index: MetadataIndexManager,
    private readonly id: string,
    private readonly entity: any // Required for rollback
  ) {}

  async execute(): Promise<RollbackAction> {
    // Remove from metadata index
    await this.index.removeFromIndex(this.id, this.entity)

    // Return rollback action
    return async () => {
      // Re-add with original metadata (skipFlush=true)
      await this.index.addToIndex(this.id, this.entity, true)
    }
  }
}

/**
 * Add verb to graph index with rollback support
 *
 * Rollback strategy:
 * - Remove verb from graph index
 */
export class AddToGraphIndexOperation implements Operation {
  readonly name = 'AddToGraphIndex'

  constructor(
    private readonly index: GraphAdjacencyIndex,
    private readonly verb: GraphVerb
  ) {}

  async execute(): Promise<RollbackAction> {
    // Add verb to graph index
    await this.index.addVerb(this.verb)

    // Return rollback action
    return async () => {
      // Remove verb from graph index
      await this.index.removeVerb(this.verb.id)
    }
  }
}

/**
 * Remove verb from graph index with rollback support
 *
 * Rollback strategy:
 * - Re-add verb to graph index
 */
export class RemoveFromGraphIndexOperation implements Operation {
  readonly name = 'RemoveFromGraphIndex'

  constructor(
    private readonly index: GraphAdjacencyIndex,
    private readonly verb: GraphVerb // Required for rollback
  ) {}

  async execute(): Promise<RollbackAction> {
    // Remove verb from graph index
    await this.index.removeVerb(this.verb.id)

    // Return rollback action
    return async () => {
      // Re-add verb with original data
      await this.index.addVerb(this.verb)
    }
  }
}

/**
 * Batch operation: Add multiple items to HNSW index
 *
 * Useful for bulk imports with transaction support.
 * Rolls back all items if any fail.
 */
export class BatchAddToHNSWOperation implements Operation {
  readonly name = 'BatchAddToHNSW'

  private operations: AddToHNSWOperation[]

  constructor(
    index: HNSWIndex,
    items: Array<{ id: string; vector: number[] }>
  ) {
    this.operations = items.map(
      item => new AddToHNSWOperation(index, item.id, item.vector)
    )
  }

  async execute(): Promise<RollbackAction> {
    const rollbackActions: RollbackAction[] = []

    // Execute all operations
    for (const op of this.operations) {
      const rollback = await op.execute()
      if (rollback) {
        rollbackActions.push(rollback)
      }
    }

    // Return combined rollback action
    return async () => {
      // Execute all rollbacks in reverse order
      for (let i = rollbackActions.length - 1; i >= 0; i--) {
        await rollbackActions[i]()
      }
    }
  }
}

/**
 * Batch operation: Add multiple entities to metadata index
 *
 * Useful for bulk imports with transaction support.
 */
export class BatchAddToMetadataIndexOperation implements Operation {
  readonly name = 'BatchAddToMetadataIndex'

  private operations: AddToMetadataIndexOperation[]

  constructor(
    index: MetadataIndexManager,
    items: Array<{ id: string; entity: any }>
  ) {
    this.operations = items.map(
      item => new AddToMetadataIndexOperation(index, item.id, item.entity)
    )
  }

  async execute(): Promise<RollbackAction> {
    const rollbackActions: RollbackAction[] = []

    // Execute all operations
    for (const op of this.operations) {
      const rollback = await op.execute()
      if (rollback) {
        rollbackActions.push(rollback)
      }
    }

    // Return combined rollback action
    return async () => {
      // Execute all rollbacks in reverse order
      for (let i = rollbackActions.length - 1; i >= 0; i--) {
        await rollbackActions[i]()
      }
    }
  }
}
