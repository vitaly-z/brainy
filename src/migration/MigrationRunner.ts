/**
 * MigrationRunner: Executes schema migrations on Brainy storage
 *
 * Handles paginated iteration, resume-safe batching, and dry-run previews.
 * Uses BaseStorage methods directly — no adapter-level changes needed.
 */

import type { BaseStorage } from '../storage/baseStorage.js'
import type { NounMetadata, VerbMetadata } from '../coreTypes.js'
import type { Migration, MigrationState, MigrationPreview, MigrationResult, MigrateOptions, MigrationError } from './types.js'
import { MIGRATIONS } from './migrations.js'

const MIGRATION_STATE_KEY = '__migration_state__'
const PREVIEW_SAMPLE_SIZE = 5
const DEFAULT_MAX_ERRORS = 100

export class MigrationRunner {
  private storage: BaseStorage
  private stateCache: MigrationState | null | undefined = undefined

  constructor(storage: BaseStorage) {
    this.storage = storage
    MigrationRunner.validateMigrations(MIGRATIONS)
  }

  /**
   * Validate migration definitions.
   * Called automatically in constructor for the global MIGRATIONS array.
   * Also available as a static method for validating custom migration arrays.
   */
  static validateMigrations(migrations: Migration[]): void {
    if (migrations.length === 0) return

    const seenIds = new Set<string>()
    const validApplies = new Set(['nouns', 'verbs', 'both'])

    for (const m of migrations) {
      if (!m.id || typeof m.id !== 'string') {
        throw new Error(`Migration has missing or invalid id`)
      }
      if (seenIds.has(m.id)) {
        throw new Error(`Duplicate migration id: "${m.id}"`)
      }
      seenIds.add(m.id)

      if (!m.version || typeof m.version !== 'string') {
        throw new Error(`Migration "${m.id}" has missing or invalid version`)
      }
      if (!m.description || typeof m.description !== 'string') {
        throw new Error(`Migration "${m.id}" has missing or invalid description`)
      }
      if (!validApplies.has(m.applies)) {
        throw new Error(`Migration "${m.id}" has invalid applies value: "${m.applies}" (must be "nouns", "verbs", or "both")`)
      }
      if (typeof m.transform !== 'function') {
        throw new Error(`Migration "${m.id}" has non-function transform`)
      }
    }
  }

  /**
   * Check if there are pending migrations to run.
   * Single getMetadata() call — ~0ms overhead when no migrations exist.
   */
  async hasPendingMigrations(): Promise<boolean> {
    if (MIGRATIONS.length === 0) return false
    const state = await this.getState()
    return this.getPendingMigrations(state).length > 0
  }

  /**
   * Get the version string for the next pending migration.
   */
  nextMigrationVersion(): string {
    const pending = this.getPendingMigrationsFromCache()
    return pending.length > 0 ? pending[pending.length - 1].version : 'unknown'
  }

  /**
   * Get count of pending migrations (for log messages).
   */
  async pendingCount(): Promise<number> {
    if (MIGRATIONS.length === 0) return 0
    const state = await this.getState()
    return this.getPendingMigrations(state).length
  }

  /**
   * Preview what a migration would do without writing anything.
   * Scans entities, applies transforms in memory, reports counts + samples.
   */
  async preview(): Promise<MigrationPreview> {
    const state = await this.getState()
    const pending = this.getPendingMigrations(state)

    if (pending.length === 0) {
      return {
        pendingMigrations: [],
        affectedEntities: 0,
        totalEntities: 0,
        sampleChanges: [],
        estimatedTime: '0ms'
      }
    }

    let totalEntities = 0
    let affectedEntities = 0
    const sampleChanges: MigrationPreview['sampleChanges'] = []
    const batchConfig = this.storage.getBatchConfig()
    const batchSize = batchConfig.maxBatchSize

    // Scan nouns if any pending migration applies to nouns
    const nounMigrations = pending.filter(m => m.applies === 'nouns' || m.applies === 'both')
    if (nounMigrations.length > 0) {
      let offset = 0
      let hasMore = true

      while (hasMore) {
        const batch = await this.storage.getNouns({ pagination: { offset, limit: batchSize } })
        const ids = batch.items.map(e => e.id)
        const metadataBatch = await this.storage.getNounMetadataBatch(ids)

        for (const entity of batch.items) {
          totalEntities++
          const entityMeta = metadataBatch.get(entity.id)
          if (!entityMeta) continue

          const metadata = entityMeta as Record<string, unknown>
          const result = this.applyTransforms(metadata, nounMigrations)
          if (result !== null) {
            affectedEntities++
            if (sampleChanges.length < PREVIEW_SAMPLE_SIZE) {
              sampleChanges.push({
                id: entity.id,
                before: { ...metadata },
                after: result
              })
            }
          }
        }
        hasMore = batch.hasMore
        offset += batch.items.length
      }
    }

    // Scan verbs if any pending migration applies to verbs
    const verbMigrations = pending.filter(m => m.applies === 'verbs' || m.applies === 'both')
    if (verbMigrations.length > 0) {
      let offset = 0
      let hasMore = true

      while (hasMore) {
        const batch = await this.storage.getVerbs({ pagination: { offset, limit: batchSize } })

        for (const verb of batch.items) {
          totalEntities++
          const verbMeta = await this.storage.getVerbMetadata(verb.id)
          if (!verbMeta) continue

          const metadata = verbMeta as Record<string, unknown>
          const result = this.applyTransforms(metadata, verbMigrations)
          if (result !== null) {
            affectedEntities++
            if (sampleChanges.length < PREVIEW_SAMPLE_SIZE) {
              sampleChanges.push({
                id: verb.id,
                before: { ...metadata },
                after: result
              })
            }
          }
        }
        hasMore = batch.hasMore
        offset += batch.items.length
      }
    }

    return {
      pendingMigrations: pending.map(m => ({ id: m.id, description: m.description })),
      affectedEntities,
      totalEntities,
      sampleChanges,
      estimatedTime: this.estimateTime(totalEntities)
    }
  }

  /**
   * Run all pending migrations.
   * Iterates entities in paginated batches, transforms metadata, saves changes.
   * Resume-safe: saves offset after each batch so interrupted migrations can continue.
   *
   * Entity-level errors are tracked (not thrown). If maxErrors is exceeded, migration
   * stops early and returns partial results with errors.
   */
  async run(options?: Pick<MigrateOptions, 'onProgress' | 'maxErrors'>): Promise<Omit<MigrationResult, 'backupBranch'>> {
    const state = await this.getState()
    const pending = this.getPendingMigrations(state)

    if (pending.length === 0) {
      return { migrationsApplied: [], entitiesProcessed: 0, entitiesModified: 0, errors: [] }
    }

    let totalProcessed = 0
    let totalModified = 0
    const appliedMigrations: string[] = []
    const errors: MigrationError[] = []
    const maxErrors = options?.maxErrors ?? DEFAULT_MAX_ERRORS
    const batchConfig = this.storage.getBatchConfig()
    const batchSize = batchConfig.maxBatchSize
    const batchDelay = batchConfig.batchDelayMs

    for (const migration of pending) {
      if (errors.length >= maxErrors) break

      const resumeOffset = state?.resumeState?.migrationId === migration.id
        ? state.resumeState.lastProcessedOffset
        : 0

      let processed = 0
      let modified = 0

      // Process nouns
      if (migration.applies === 'nouns' || migration.applies === 'both') {
        const result = await this.migrateNouns(migration, resumeOffset, batchSize, batchDelay, errors, maxErrors, options?.onProgress)
        processed += result.processed
        modified += result.modified
      }

      // Process verbs
      if (migration.applies === 'verbs' || migration.applies === 'both') {
        if (errors.length < maxErrors) {
          const result = await this.migrateVerbs(migration, 0, batchSize, batchDelay, errors, maxErrors, options?.onProgress)
          processed += result.processed
          modified += result.modified
        }
      }

      totalProcessed += processed
      totalModified += modified
      appliedMigrations.push(migration.id)

      // Save completed migration state
      await this.saveState({
        completedVersion: migration.version,
        completedAt: Date.now(),
        completedMigrations: [...(state?.completedMigrations || []), migration.id],
        resumeState: undefined
      })
    }

    // Clear state cache so next check reads fresh
    this.stateCache = undefined

    return {
      migrationsApplied: appliedMigrations,
      entitiesProcessed: totalProcessed,
      entitiesModified: totalModified,
      errors
    }
  }

  /**
   * Run specific migrations without checking completion state.
   * Used for branch iterations where the state on main says "completed"
   * but branch-local entities still need transforming.
   *
   * Safe because transforms are idempotent (return null when already applied).
   * Does NOT save migration state — the authoritative state lives on main.
   */
  async runMigrations(
    migrations: Migration[],
    options?: Pick<MigrateOptions, 'onProgress' | 'maxErrors'>
  ): Promise<Omit<MigrationResult, 'backupBranch'>> {
    if (migrations.length === 0) {
      return { migrationsApplied: [], entitiesProcessed: 0, entitiesModified: 0, errors: [] }
    }

    let totalProcessed = 0
    let totalModified = 0
    const appliedMigrations: string[] = []
    const errors: MigrationError[] = []
    const maxErrors = options?.maxErrors ?? DEFAULT_MAX_ERRORS
    const batchConfig = this.storage.getBatchConfig()
    const batchSize = batchConfig.maxBatchSize
    const batchDelay = batchConfig.batchDelayMs

    for (const migration of migrations) {
      if (errors.length >= maxErrors) break

      let processed = 0
      let modified = 0

      if (migration.applies === 'nouns' || migration.applies === 'both') {
        const result = await this.migrateNouns(migration, 0, batchSize, batchDelay, errors, maxErrors, options?.onProgress)
        processed += result.processed
        modified += result.modified
      }

      if (migration.applies === 'verbs' || migration.applies === 'both') {
        if (errors.length < maxErrors) {
          const result = await this.migrateVerbs(migration, 0, batchSize, batchDelay, errors, maxErrors, options?.onProgress)
          processed += result.processed
          modified += result.modified
        }
      }

      totalProcessed += processed
      totalModified += modified
      if (modified > 0) {
        appliedMigrations.push(migration.id)
      }
    }

    return {
      migrationsApplied: appliedMigrations,
      entitiesProcessed: totalProcessed,
      entitiesModified: totalModified,
      errors
    }
  }

  /**
   * Clean up old system:backup branches created by previous migrations.
   * Identifies backups via ref metadata (not by name prefix).
   */
  async cleanupOldBackups(): Promise<void> {
    const refManager = this.storage.refManager
    if (!refManager) return

    const refs = await refManager.listRefs()
    const currentBranch = this.storage.currentBranch || 'main'

    for (const ref of refs) {
      if (
        ref.metadata?.type === 'system:backup' &&
        ref.name.startsWith('refs/heads/') &&
        ref.name !== `refs/heads/${currentBranch}`
      ) {
        const branchName = ref.name.replace('refs/heads/', '')
        try {
          await refManager.deleteRef(branchName)
        } catch {
          // Ignore — branch may be current or protected
        }
      }
    }
  }

  // ─── Private helpers ───────────────────────────────────────────────

  private async migrateNouns(
    migration: Migration,
    startOffset: number,
    batchSize: number,
    batchDelay: number,
    errors: MigrationError[],
    maxErrors: number,
    onProgress?: MigrateOptions['onProgress']
  ): Promise<{ processed: number; modified: number }> {
    let offset = startOffset
    let hasMore = true
    let processed = 0
    let modified = 0

    while (hasMore) {
      const batch = await this.storage.getNouns({ pagination: { offset, limit: batchSize } })

      for (const entity of batch.items) {
        if (errors.length >= maxErrors) {
          return { processed, modified }
        }

        processed++
        const metadata = await this.storage.getNounMetadataBatch([entity.id])
        const entityMeta = metadata.get(entity.id)
        if (!entityMeta) continue

        try {
          const transformed = migration.transform(entityMeta as Record<string, unknown>)
          if (transformed !== null) {
            await this.storage.saveNounMetadata(entity.id, transformed as NounMetadata)
            modified++
          }
        } catch (err) {
          errors.push({
            entityId: entity.id,
            migrationId: migration.id,
            error: err instanceof Error ? err.message : String(err)
          })
        }
      }

      hasMore = batch.hasMore
      offset += batch.items.length

      // Save resume state after each batch
      if (hasMore) {
        await this.saveResumeState(migration.id, offset)
      }

      // Report progress
      if (onProgress) {
        onProgress({
          migrationId: migration.id,
          processed,
          modified,
          hasMore
        })
      }

      // Respect adapter rate limiting
      if (batchDelay > 0 && hasMore) {
        await new Promise(resolve => setTimeout(resolve, batchDelay))
      }
    }

    return { processed, modified }
  }

  private async migrateVerbs(
    migration: Migration,
    startOffset: number,
    batchSize: number,
    batchDelay: number,
    errors: MigrationError[],
    maxErrors: number,
    onProgress?: MigrateOptions['onProgress']
  ): Promise<{ processed: number; modified: number }> {
    let offset = startOffset
    let hasMore = true
    let processed = 0
    let modified = 0

    while (hasMore) {
      const batch = await this.storage.getVerbs({ pagination: { offset, limit: batchSize } })

      for (const verb of batch.items) {
        if (errors.length >= maxErrors) {
          return { processed, modified }
        }

        processed++
        const metadata = await this.storage.getVerbMetadata(verb.id)
        if (!metadata) continue

        try {
          const transformed = migration.transform(metadata as Record<string, unknown>)
          if (transformed !== null) {
            await this.storage.saveVerbMetadata(verb.id, transformed as VerbMetadata)
            modified++
          }
        } catch (err) {
          errors.push({
            entityId: verb.id,
            migrationId: migration.id,
            error: err instanceof Error ? err.message : String(err)
          })
        }
      }

      hasMore = batch.hasMore
      offset += batch.items.length

      // Save resume state after each batch
      if (hasMore) {
        await this.saveResumeState(migration.id, offset)
      }

      // Report progress
      if (onProgress) {
        onProgress({
          migrationId: migration.id,
          processed,
          modified,
          hasMore
        })
      }

      // Respect adapter rate limiting
      if (batchDelay > 0 && hasMore) {
        await new Promise(resolve => setTimeout(resolve, batchDelay))
      }
    }

    return { processed, modified }
  }

  private applyTransforms(metadata: Record<string, unknown>, migrations: Migration[]): Record<string, unknown> | null {
    let current = metadata
    let anyChanged = false

    for (const migration of migrations) {
      const result = migration.transform(current)
      if (result !== null) {
        current = result
        anyChanged = true
      }
    }

    return anyChanged ? current : null
  }

  private getPendingMigrations(state: MigrationState | null): Migration[] {
    const completed = new Set(state?.completedMigrations || [])
    return MIGRATIONS.filter(m => !completed.has(m.id))
  }

  private getPendingMigrationsFromCache(): Migration[] {
    const state = this.stateCache === undefined ? null : this.stateCache
    return this.getPendingMigrations(state)
  }

  private async getState(): Promise<MigrationState | null> {
    if (this.stateCache !== undefined) return this.stateCache
    const state = await this.storage.getMetadata(MIGRATION_STATE_KEY) as unknown as MigrationState | null
    this.stateCache = state
    return state
  }

  private async saveState(state: MigrationState): Promise<void> {
    await this.storage.saveMetadata(MIGRATION_STATE_KEY, state as unknown as NounMetadata)
    this.stateCache = state
  }

  private async saveResumeState(migrationId: string, offset: number): Promise<void> {
    const state = await this.getState()
    const branch = this.storage.currentBranch || 'main'
    await this.saveState({
      completedVersion: state?.completedVersion || '',
      completedAt: state?.completedAt || 0,
      completedMigrations: state?.completedMigrations || [],
      resumeState: { migrationId, lastProcessedOffset: offset, branch }
    })
  }

  private estimateTime(entityCount: number): string {
    if (entityCount === 0) return '0ms'
    if (entityCount < 1000) return '<1s'
    if (entityCount < 10000) return '~1-5s'
    if (entityCount < 100000) return '~10s-1min'
    if (entityCount < 1000000) return '~1-5min'
    return '~5min+'
  }
}
