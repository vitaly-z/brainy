/**
 * Storage Operations with Rollback Support
 *
 * Provides transactional operations for all storage adapters.
 * Each operation can be executed and rolled back atomically.
 *
 * Supports:
 * - All 8 storage adapters (FileSystem, S3, Memory, OPFS, GCS, Azure, R2, TypeAware)
 * - Nouns (entities) and Verbs (relationships)
 * - Metadata and vector data
 * - COW (Copy-on-Write) storage
 */

import type { StorageAdapter, HNSWNoun, HNSWVerb, NounMetadata, VerbMetadata } from '../../coreTypes.js'
import type { Operation, RollbackAction } from '../types.js'

/**
 * Save noun metadata with rollback support
 *
 * Rollback strategy:
 * - If metadata existed: Restore previous metadata
 * - If metadata was new: Delete metadata
 */
export class SaveNounMetadataOperation implements Operation {
  readonly name = 'SaveNounMetadata'

  constructor(
    private readonly storage: StorageAdapter,
    private readonly id: string,
    private readonly metadata: NounMetadata,
    private readonly isNew: boolean = false
  ) {}

  async execute(): Promise<RollbackAction> {
    // Skip read for new entities — nothing to rollback to (saves 1 storage round-trip)
    const previousMetadata = this.isNew
      ? null
      : await this.storage.getNounMetadata(this.id)

    // Save new metadata
    await this.storage.saveNounMetadata(this.id, this.metadata)

    // Return rollback action
    return async () => {
      if (previousMetadata) {
        // Restore previous metadata
        await this.storage.saveNounMetadata(this.id, previousMetadata)
      } else {
        // Delete newly created metadata
        await this.storage.deleteNounMetadata(this.id)
      }
    }
  }
}

/**
 * Save noun (vector data) with rollback support
 *
 * Rollback strategy:
 * - If noun existed: Restore previous noun
 * - If noun was new: Delete noun (if deleteNoun exists on adapter)
 *
 * Note: Not all adapters implement deleteNoun - this is acceptable
 * because orphaned vector data without metadata is invisible to queries
 */
export class SaveNounOperation implements Operation {
  readonly name = 'SaveNoun'

  constructor(
    private readonly storage: StorageAdapter,
    private readonly noun: HNSWNoun,
    private readonly isNew: boolean = false
  ) {}

  async execute(): Promise<RollbackAction> {
    // Skip read for new entities — nothing to rollback to (saves 1 storage round-trip)
    const previousNoun = this.isNew
      ? null
      : await this.storage.getNoun(this.noun.id)

    // Save new noun
    await this.storage.saveNoun(this.noun)

    // Return rollback action
    return async () => {
      if (previousNoun) {
        // Restore previous noun (extract just vector data)
        const nounData: HNSWNoun = {
          id: previousNoun.id,
          vector: previousNoun.vector,
          connections: previousNoun.connections || new Map(),
          level: previousNoun.level || 0
        }
        await this.storage.saveNoun(nounData)
      } else {
        // Delete newly created noun (if adapter supports it)
        // Note: Not all adapters implement deleteNoun
        // This is acceptable - metadata deletion makes entity invisible
        if ('deleteNoun' in this.storage && typeof (this.storage as any).deleteNoun === 'function') {
          await (this.storage as any).deleteNoun(this.noun.id)
        }
      }
    }
  }
}

/**
 * Delete noun metadata with rollback support
 *
 * Rollback strategy:
 * - Restore deleted metadata
 */
export class DeleteNounMetadataOperation implements Operation {
  readonly name = 'DeleteNounMetadata'

  constructor(
    private readonly storage: StorageAdapter,
    private readonly id: string
  ) {}

  async execute(): Promise<RollbackAction> {
    // Get metadata before deletion (for rollback)
    const previousMetadata = await this.storage.getNounMetadata(this.id)

    if (!previousMetadata) {
      // Nothing to delete - no rollback needed
      return async () => {}
    }

    // Delete metadata
    await this.storage.deleteNounMetadata(this.id)

    // Return rollback action
    return async () => {
      // Restore deleted metadata
      await this.storage.saveNounMetadata(this.id, previousMetadata)
    }
  }
}

/**
 * Save verb metadata with rollback support
 *
 * Rollback strategy:
 * - If metadata existed: Restore previous metadata
 * - If metadata was new: Delete metadata
 */
export class SaveVerbMetadataOperation implements Operation {
  readonly name = 'SaveVerbMetadata'

  constructor(
    private readonly storage: StorageAdapter,
    private readonly id: string,
    private readonly metadata: VerbMetadata
  ) {}

  async execute(): Promise<RollbackAction> {
    // Get existing metadata (for rollback)
    const previousMetadata = await this.storage.getVerbMetadata(this.id)

    // Save new metadata
    await this.storage.saveVerbMetadata(this.id, this.metadata)

    // Return rollback action
    return async () => {
      if (previousMetadata) {
        // Restore previous metadata
        await this.storage.saveVerbMetadata(this.id, previousMetadata)
      } else {
        // Delete newly created verb (metadata + vector)
        // Note: StorageAdapter has deleteVerb but not deleteVerbMetadata
        await this.storage.deleteVerb(this.id)
      }
    }
  }
}

/**
 * Save verb (vector data) with rollback support
 *
 * Rollback strategy:
 * - If verb existed: Restore previous verb
 * - If verb was new: Delete verb (if deleteVerb exists on adapter)
 */
export class SaveVerbOperation implements Operation {
  readonly name = 'SaveVerb'

  constructor(
    private readonly storage: StorageAdapter,
    private readonly verb: HNSWVerb
  ) {}

  async execute(): Promise<RollbackAction> {
    // Get existing verb (for rollback)
    const previousVerb = await this.storage.getVerb(this.verb.id)

    // Save new verb
    await this.storage.saveVerb(this.verb)

    // Return rollback action
    return async () => {
      if (previousVerb) {
        // Restore previous verb (extract just vector data)
        const verbData: HNSWVerb = {
          id: previousVerb.id,
          sourceId: previousVerb.sourceId,
          targetId: previousVerb.targetId,
          verb: previousVerb.verb,
          vector: previousVerb.vector,
          connections: previousVerb.connections || new Map()
        }
        await this.storage.saveVerb(verbData)
      } else {
        // Delete newly created verb (if adapter supports it)
        if ('deleteVerb' in this.storage && typeof (this.storage as any).deleteVerb === 'function') {
          await (this.storage as any).deleteVerb(this.verb.id)
        }
      }
    }
  }
}

/**
 * Delete verb metadata with rollback support
 *
 * Rollback strategy:
 * - Restore deleted metadata
 */
export class DeleteVerbMetadataOperation implements Operation {
  readonly name = 'DeleteVerbMetadata'

  constructor(
    private readonly storage: StorageAdapter,
    private readonly id: string
  ) {}

  async execute(): Promise<RollbackAction> {
    // Get metadata before deletion (for rollback)
    const previousMetadata = await this.storage.getVerbMetadata(this.id)

    if (!previousMetadata) {
      // Nothing to delete - no rollback needed
      return async () => {}
    }

    // Delete verb (metadata + vector)
    // Note: StorageAdapter has deleteVerb but not deleteVerbMetadata
    await this.storage.deleteVerb(this.id)

    // Return rollback action
    return async () => {
      // Restore deleted metadata
      await this.storage.saveVerbMetadata(this.id, previousMetadata)
    }
  }
}

/**
 * Update noun metadata with rollback support
 *
 * Rollback strategy:
 * - Restore previous metadata
 *
 * Note: This is a convenience operation that wraps SaveNounMetadataOperation
 * with explicit "update" semantics
 */
export class UpdateNounMetadataOperation implements Operation {
  readonly name = 'UpdateNounMetadata'

  private saveOperation: SaveNounMetadataOperation

  constructor(
    storage: StorageAdapter,
    id: string,
    metadata: NounMetadata
  ) {
    this.saveOperation = new SaveNounMetadataOperation(storage, id, metadata)
  }

  async execute(): Promise<RollbackAction> {
    return await this.saveOperation.execute()
  }
}

/**
 * Update verb metadata with rollback support
 *
 * Rollback strategy:
 * - Restore previous metadata
 */
export class UpdateVerbMetadataOperation implements Operation {
  readonly name = 'UpdateVerbMetadata'

  private saveOperation: SaveVerbMetadataOperation

  constructor(
    storage: StorageAdapter,
    id: string,
    metadata: VerbMetadata
  ) {
    this.saveOperation = new SaveVerbMetadataOperation(storage, id, metadata)
  }

  async execute(): Promise<RollbackAction> {
    return await this.saveOperation.execute()
  }
}
