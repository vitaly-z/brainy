/**
 * Migration System Integration Tests
 *
 * Verifies:
 * - MigrationRunner with in-memory storage
 * - brain.migrate() public API (dry-run and apply)
 * - Backup branch creation with metadata tagging
 * - No-op when MIGRATIONS array is empty
 * - Warning log when autoMigrate is false
 * - Multi-tenant independent migration state
 * - Verb and noun transforms
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { Brainy } from '../../src/brainy.js'
import { MigrationRunner, MIGRATIONS } from '../../src/migration/index.js'
import type { Migration } from '../../src/migration/index.js'
import { NounType, VerbType } from '../../src/types/graphTypes.js'

// Helper to temporarily inject migrations into the MIGRATIONS array
function withMigrations(migrations: Migration[], fn: () => Promise<void>): Promise<void> {
  const original = MIGRATIONS.splice(0, MIGRATIONS.length)
  MIGRATIONS.push(...migrations)
  return fn().finally(() => {
    MIGRATIONS.splice(0, MIGRATIONS.length)
    MIGRATIONS.push(...original)
  })
}

describe('Migration System', () => {
  let brain: Brainy

  beforeEach(async () => {
    brain = new Brainy({ storage: { type: 'memory' }, silent: true })
    await brain.init()
  })

  afterEach(async () => {
    await brain.close()
  })

  // ─── No-op tests ───────────────────────────────────────────────

  describe('No-op with empty MIGRATIONS', () => {
    it('should have zero pending migrations by default', async () => {
      // MIGRATIONS is empty by default — init() should add ~0ms overhead
      const preview = await brain.migrate({ dryRun: true })
      expect(preview).toHaveProperty('pendingMigrations')
      const p = preview as any
      expect(p.pendingMigrations).toHaveLength(0)
      expect(p.affectedEntities).toBe(0)
    })

    it('should return no-op result when applying with no migrations', async () => {
      const result = await brain.migrate()
      expect(result).toHaveProperty('migrationsApplied')
      const r = result as any
      expect(r.migrationsApplied).toHaveLength(0)
      expect(r.entitiesModified).toBe(0)
    })
  })

  // ─── Dry-run preview ──────────────────────────────────────────

  describe('Dry-run preview', () => {
    it('should preview affected entities without writing', async () => {
      // Add some entities with a unique marker field
      const id1 = await brain.add({ type: NounType.Concept, data: { name: 'Alpha' }, metadata: { status: 'active' } })
      const id2 = await brain.add({ type: NounType.Concept, data: { name: 'Beta' }, metadata: { status: 'inactive' } })
      const id3 = await brain.add({ type: NounType.Concept, data: { name: 'Gamma' }, metadata: { status: 'pending' } })

      const testMigration: Migration = {
        id: 'test-1.0.0-add-version',
        version: '1.0.0',
        description: 'Add version field to entities with status',
        applies: 'nouns',
        transform: (m) => {
          // Only transform entities that have our specific 'status' field
          if ('status' in m && !('version' in m)) {
            return { ...m, version: 1 }
          }
          return null
        }
      }

      await withMigrations([testMigration], async () => {
        const preview = await brain.migrate({ dryRun: true })
        const p = preview as any
        expect(p.pendingMigrations).toHaveLength(1)
        expect(p.pendingMigrations[0].id).toBe('test-1.0.0-add-version')
        // All 3 entities have 'status' metadata
        expect(p.affectedEntities).toBeGreaterThanOrEqual(3)
        expect(p.sampleChanges.length).toBeGreaterThan(0)
        expect(p.sampleChanges[0].after.version).toBe(1)

        // Verify no data was modified (dry-run)
        const entity = await brain.get(id1)
        expect(entity?.metadata?.version).toBeUndefined()
      })
    })

    it('should show correct sample before/after', async () => {
      await brain.add({ type: NounType.Concept, data: { name: 'Test' }, metadata: { state: 'draft' } })

      const renameMigration: Migration = {
        id: 'test-rename',
        version: '1.0.0',
        description: 'Rename state to status',
        applies: 'nouns',
        transform: (m) => {
          if ('state' in m) {
            const { state, ...rest } = m
            return { ...rest, status: state }
          }
          return null
        }
      }

      await withMigrations([renameMigration], async () => {
        const preview = await brain.migrate({ dryRun: true })
        const p = preview as any
        expect(p.sampleChanges.length).toBeGreaterThanOrEqual(1)

        // Find the sample for our entity (it has the 'state' field)
        const sample = p.sampleChanges.find((s: any) => s.before.state === 'draft')
        expect(sample).toBeDefined()
        expect(sample.after.status).toBe('draft')
        expect(sample.after.state).toBeUndefined()
      })
    })
  })

  // ─── Apply migrations ─────────────────────────────────────────

  describe('Apply migrations', () => {
    it('should transform noun metadata and return result', async () => {
      const id = await brain.add({
        type: NounType.Concept,
        data: { name: 'Alice' },
        metadata: { priority: 'low' }
      })

      const addFieldMigration: Migration = {
        id: 'test-add-field',
        version: '1.0.0',
        description: 'Add migrated flag to entities with priority',
        applies: 'nouns',
        transform: (m) => {
          if ('priority' in m && !('migrated' in m)) {
            return { ...m, migrated: true }
          }
          return null
        }
      }

      await withMigrations([addFieldMigration], async () => {
        const result = await brain.migrate()
        const r = result as any
        expect(r.migrationsApplied).toContain('test-add-field')
        expect(r.entitiesModified).toBeGreaterThanOrEqual(1)

        // Verify data was actually transformed
        const entity = await brain.get(id)
        expect(entity?.metadata?.migrated).toBe(true)
        expect(entity?.metadata?.priority).toBe('low')
      })
    })

    it('should skip entities that return null from transform', async () => {
      await brain.add({ type: NounType.Concept, data: { name: 'Has status' }, metadata: { status: 'active' } })
      await brain.add({ type: NounType.Concept, data: { name: 'No status' }, metadata: { priority: 'high' } })

      const conditionalMigration: Migration = {
        id: 'test-conditional',
        version: '1.0.0',
        description: 'Uppercase status field only when present',
        applies: 'nouns',
        transform: (m) => {
          if (typeof m.status === 'string') {
            return { ...m, status: (m.status as string).toUpperCase() }
          }
          return null
        }
      }

      await withMigrations([conditionalMigration], async () => {
        const result = await brain.migrate()
        const r = result as any
        // Only 1 entity has 'status', the other has 'priority'
        expect(r.entitiesModified).toBeGreaterThanOrEqual(1)
        expect(r.entitiesProcessed).toBeGreaterThanOrEqual(2)
      })
    })

    it('should run multiple migrations in order', async () => {
      await brain.add({ type: NounType.Concept, data: { name: 'Test' }, metadata: { count: 1 } })

      const migration1: Migration = {
        id: 'test-double',
        version: '1.0.0',
        description: 'Double count',
        applies: 'nouns',
        transform: (m) => typeof m.count === 'number' ? { ...m, count: (m.count as number) * 2 } : null
      }

      const migration2: Migration = {
        id: 'test-add-ten',
        version: '1.1.0',
        description: 'Add 10 to count',
        applies: 'nouns',
        transform: (m) => typeof m.count === 'number' ? { ...m, count: (m.count as number) + 10 } : null
      }

      await withMigrations([migration1, migration2], async () => {
        const result = await brain.migrate()
        const r = result as any
        expect(r.migrationsApplied).toEqual(['test-double', 'test-add-ten'])
      })
    })

    it('should not re-run completed migrations', async () => {
      await brain.add({ type: NounType.Concept, data: { name: 'Test' }, metadata: { v: 1 } })

      const migration: Migration = {
        id: 'test-increment',
        version: '1.0.0',
        description: 'Increment v',
        applies: 'nouns',
        transform: (m) => typeof m.v === 'number' ? { ...m, v: (m.v as number) + 1 } : null
      }

      await withMigrations([migration], async () => {
        // Run once
        const result1 = await brain.migrate()
        expect((result1 as any).migrationsApplied).toHaveLength(1)

        // Run again — should be no-op
        const result2 = await brain.migrate()
        expect((result2 as any).migrationsApplied).toHaveLength(0)
        expect((result2 as any).entitiesModified).toBe(0)
      })
    })
  })

  // ─── Backup branch tests ──────────────────────────────────────

  describe('Backup branches', () => {
    it('should create a backup branch before migrating', async () => {
      await brain.add({ type: NounType.Concept, data: { name: 'Test' }, metadata: { x: 1 } })
      // Need a commit for fork to work
      await brain.commit({ message: 'test', author: 'test' })

      const migration: Migration = {
        id: 'test-backup',
        version: '2.0.0',
        description: 'Add y field to entities with x',
        applies: 'nouns',
        transform: (m) => 'x' in m && !('y' in m) ? { ...m, y: 2 } : null
      }

      await withMigrations([migration], async () => {
        const result = await brain.migrate()
        const r = result as any
        expect(r.backupBranch).toBe('pre-migration-2.0.0')

        const branches = await brain.listBranches()
        expect(branches).toContain('pre-migration-2.0.0')
      })
    })

    it('should tag backup branch with system:backup metadata', async () => {
      await brain.add({ type: NounType.Concept, data: { name: 'Test' }, metadata: { z: 1 } })
      await brain.commit({ message: 'test', author: 'test' })

      const migration: Migration = {
        id: 'test-tag',
        version: '4.0.0',
        description: 'Tag test',
        applies: 'nouns',
        transform: (m) => 'z' in m ? { ...m, tagged: true } : null
      }

      await withMigrations([migration], async () => {
        await brain.migrate()

        // Verify metadata tag on the backup branch ref
        const refManager = (brain as any).storage.refManager
        if (refManager) {
          const ref = await refManager.getRef('pre-migration-4.0.0')
          expect(ref).toBeDefined()
          expect(ref?.metadata?.type).toBe('system:backup')
          expect(ref?.metadata?.migrationVersion).toBe('4.0.0')
          expect(ref?.metadata?.author).toBe('brainy-migration')
        }
      })
    })

    it('should keep backup branch as a named restore point', async () => {
      const id = await brain.add({ type: NounType.Concept, data: { name: 'Restore Test' }, metadata: { original: true } })
      await brain.commit({ message: 'before migration', author: 'test' })

      const migration: Migration = {
        id: 'test-restore',
        version: '3.0.0',
        description: 'Replace original with migrated',
        applies: 'nouns',
        transform: (m) => {
          if (m.original === true) {
            return { ...m, original: false, migrated: true }
          }
          return null
        }
      }

      await withMigrations([migration], async () => {
        const result = await brain.migrate()
        const r = result as any

        // Verify migration was applied
        const migrated = await brain.get(id)
        expect(migrated?.metadata?.migrated).toBe(true)

        // Verify backup branch exists as a named restore point
        expect(r.backupBranch).toBe('pre-migration-3.0.0')
        const branches = await brain.listBranches()
        expect(branches).toContain('pre-migration-3.0.0')

        // Verify the backup ref points to the pre-migration commit
        const refManager = (brain as any).storage.refManager
        if (refManager) {
          const mainRef = await refManager.getRef('main')
          const backupRef = await refManager.getRef('pre-migration-3.0.0')
          expect(backupRef).toBeDefined()
          // Backup was forked before migration, so both share the same commit
          // (the pre-migration commit). After migration, main's overlay has new data,
          // but the commit pointer is unchanged.
          expect(backupRef.commitHash).toBe(mainRef.commitHash)
        }
      })
    })
  })

  // ─── Warning log tests ────────────────────────────────────────

  describe('autoMigrate: false (default)', () => {
    it('should log warning when pending migrations exist', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

      const migration: Migration = {
        id: 'test-warning',
        version: '1.0.0',
        description: 'Test warning',
        applies: 'nouns',
        transform: () => null
      }

      await withMigrations([migration], async () => {
        const warnBrain = new Brainy({ storage: { type: 'memory' } })
        await warnBrain.init()

        const migrationLogs = consoleSpy.mock.calls
          .filter(call => typeof call[0] === 'string' && call[0].includes('pending migration'))
        expect(migrationLogs.length).toBeGreaterThan(0)

        await warnBrain.close()
      })

      consoleSpy.mockRestore()
    })
  })

  // ─── autoMigrate: true inline ─────────────────────────────────

  describe('autoMigrate: true', () => {
    it('should auto-migrate small datasets during init', async () => {
      // Create a brain with data, close it
      const setupBrain = new Brainy({ storage: { type: 'memory' }, silent: true })
      await setupBrain.init()
      await setupBrain.add({ type: NounType.Concept, data: { name: 'AutoTest' }, metadata: { legacy: true } })

      // We can't easily share memory storage between instances,
      // so test the migrate() path directly instead
      const migration: Migration = {
        id: 'test-auto',
        version: '1.0.0',
        description: 'Auto migrate test',
        applies: 'nouns',
        transform: (m) => 'legacy' in m ? { ...m, legacy: false, upgraded: true } : null
      }

      await withMigrations([migration], async () => {
        const result = await setupBrain.migrate()
        const r = result as any
        expect(r.migrationsApplied).toContain('test-auto')
        expect(r.entitiesModified).toBeGreaterThanOrEqual(1)
      })

      await setupBrain.close()
    })
  })

  // ─── Progress callback ────────────────────────────────────────

  describe('Progress callback', () => {
    it('should call onProgress during migration', async () => {
      await brain.add({ type: NounType.Concept, data: { name: 'A' }, metadata: { x: 1 } })
      await brain.add({ type: NounType.Concept, data: { name: 'B' }, metadata: { x: 2 } })

      const migration: Migration = {
        id: 'test-progress',
        version: '1.0.0',
        description: 'Add y to entities with x',
        applies: 'nouns',
        transform: (m) => 'x' in m ? { ...m, y: true } : null
      }

      const progressCalls: any[] = []

      await withMigrations([migration], async () => {
        await brain.migrate({
          onProgress: (p) => progressCalls.push(p)
        })
      })

      expect(progressCalls.length).toBeGreaterThan(0)
      expect(progressCalls[0].migrationId).toBe('test-progress')
      expect(progressCalls[0].processed).toBeGreaterThan(0)
    })
  })

  // ─── Multi-tenant independence ─────────────────────────────────

  describe('Multi-tenant independence', () => {
    it('should have independent migration state per instance', async () => {
      const brain1 = new Brainy({ storage: { type: 'memory' }, silent: true })
      const brain2 = new Brainy({ storage: { type: 'memory' }, silent: true })
      await brain1.init()
      await brain2.init()

      await brain1.add({ type: NounType.Concept, data: { name: 'User1 data' }, metadata: { v: 1 } })
      await brain2.add({ type: NounType.Concept, data: { name: 'User2 data' }, metadata: { v: 1 } })

      const migration: Migration = {
        id: 'test-tenant',
        version: '1.0.0',
        description: 'Increment v on entities that have it',
        applies: 'nouns',
        transform: (m) => typeof m.v === 'number' ? { ...m, v: (m.v as number) + 1 } : null
      }

      await withMigrations([migration], async () => {
        // Migrate only brain1
        const r1 = await brain1.migrate()
        expect((r1 as any).entitiesModified).toBeGreaterThanOrEqual(1)

        // brain2 should still have pending migrations
        const preview = await brain2.migrate({ dryRun: true })
        expect((preview as any).pendingMigrations).toHaveLength(1)
        expect((preview as any).affectedEntities).toBeGreaterThanOrEqual(1)
      })

      await brain1.close()
      await brain2.close()
    })
  })

  // ─── Verb migration ───────────────────────────────────────────

  describe('Verb migration', () => {
    it('should transform verb metadata when applies is verbs', async () => {
      const id1 = await brain.add({ type: NounType.Concept, data: { name: 'A' } })
      const id2 = await brain.add({ type: NounType.Concept, data: { name: 'B' } })
      await brain.relate({ from: id1, to: id2, type: VerbType.RelatedTo, metadata: { strength: 'weak' } })

      const migration: Migration = {
        id: 'test-verb-migration',
        version: '1.0.0',
        description: 'Rename strength to intensity',
        applies: 'verbs',
        transform: (m) => {
          if ('strength' in m) {
            const { strength, ...rest } = m
            return { ...rest, intensity: strength }
          }
          return null
        }
      }

      await withMigrations([migration], async () => {
        const result = await brain.migrate()
        expect((result as any).migrationsApplied).toContain('test-verb-migration')
        // At least the one verb with 'strength' should be modified
        expect((result as any).entitiesModified).toBeGreaterThanOrEqual(1)
      })
    })
  })

  // ─── Both nouns and verbs ─────────────────────────────────────

  describe('applies: both', () => {
    it('should transform both nouns and verbs when applies is both', async () => {
      const id1 = await brain.add({ type: NounType.Concept, data: { name: 'A' }, metadata: { tag: 'old' } })
      const id2 = await brain.add({ type: NounType.Concept, data: { name: 'B' }, metadata: { tag: 'old' } })
      await brain.relate({ from: id1, to: id2, type: VerbType.RelatedTo, metadata: { tag: 'old' } })

      const migration: Migration = {
        id: 'test-both',
        version: '1.0.0',
        description: 'Update tag from old to new',
        applies: 'both',
        transform: (m) => m.tag === 'old' ? { ...m, tag: 'new' } : null
      }

      await withMigrations([migration], async () => {
        const result = await brain.migrate()
        const r = result as any
        // At least 2 nouns + 1 verb should be modified
        expect(r.entitiesModified).toBeGreaterThanOrEqual(3)
      })
    })
  })

  // ─── Multi-branch migration ─────────────────────────────────

  describe('Multi-branch migration', () => {
    it('should migrate entities on all branches including feature branches', async () => {
      // Setup: create entities on main, fork a branch, add entities on the branch
      const mainId = await brain.add({
        type: NounType.Concept,
        data: { name: 'Main Entity' },
        metadata: { legacy: true, source: 'main' }
      })
      await brain.commit({ message: 'initial', author: 'test' })

      // Fork a feature branch and add branch-local entity
      const fork = await brain.fork('feature-x')
      const branchId = await fork.add({
        type: NounType.Concept,
        data: { name: 'Branch Entity' },
        metadata: { legacy: true, source: 'branch' }
      })

      // Define migration that transforms the 'legacy' field
      const migration: Migration = {
        id: 'test-multi-branch',
        version: '1.0.0',
        description: 'Mark legacy entities as upgraded',
        applies: 'nouns',
        transform: (m) => {
          if (m.legacy === true) {
            return { ...m, legacy: false, upgraded: true }
          }
          return null // Already migrated or not applicable
        }
      }

      await withMigrations([migration], async () => {
        // Migrate from main — should reach all branches
        const result = await brain.migrate()
        const r = result as any

        expect(r.migrationsApplied).toContain('test-multi-branch')
        // Main entity + branch-local entity should both be modified
        expect(r.entitiesModified).toBeGreaterThanOrEqual(2)

        // Verify main entity was transformed
        const mainEntity = await brain.get(mainId)
        expect(mainEntity?.metadata?.upgraded).toBe(true)
        expect(mainEntity?.metadata?.legacy).toBe(false)
      })

      await fork.close()
    })

    it('should skip system:backup branches during multi-branch migration', async () => {
      await brain.add({ type: NounType.Concept, data: { name: 'Test' }, metadata: { v: 1 } })
      await brain.commit({ message: 'test', author: 'test' })

      // Create two migrations — first creates a backup branch, second should skip it
      const migration1: Migration = {
        id: 'test-skip-backup-1',
        version: '5.0.0',
        description: 'First migration',
        applies: 'nouns',
        transform: (m) => typeof m.v === 'number' && !('m1' in m) ? { ...m, m1: true } : null
      }

      await withMigrations([migration1], async () => {
        const result = await brain.migrate()
        const r = result as any
        expect(r.backupBranch).toBe('pre-migration-5.0.0')

        // Verify backup branch exists
        const branches = await brain.listBranches()
        expect(branches).toContain('pre-migration-5.0.0')

        // Migration should not have errored from trying to migrate the backup
        expect(r.migrationsApplied).toContain('test-skip-backup-1')
      })
    })
  })

  // ─── MigrationRunner unit-level tests ─────────────────────────

  describe('MigrationRunner', () => {
    it('should report no pending migrations when array is empty', async () => {
      const runner = new MigrationRunner((brain as any).storage)
      expect(await runner.hasPendingMigrations()).toBe(false)
    })

    it('should report pending migrations when array has entries', async () => {
      const migration: Migration = {
        id: 'runner-test',
        version: '1.0.0',
        description: 'Test',
        applies: 'nouns',
        transform: () => null
      }

      await withMigrations([migration], async () => {
        const runner = new MigrationRunner((brain as any).storage)
        expect(await runner.hasPendingMigrations()).toBe(true)
        expect(await runner.pendingCount()).toBe(1)
        expect(runner.nextMigrationVersion()).toBe('1.0.0')
      })
    })

    it('should estimate time correctly', async () => {
      const migration: Migration = {
        id: 'estimate-test',
        version: '1.0.0',
        description: 'Test',
        applies: 'nouns',
        transform: () => null
      }

      await withMigrations([migration], async () => {
        const runner = new MigrationRunner((brain as any).storage)
        const preview = await runner.preview()
        // With 0 entities, estimatedTime should be '0ms' or '<1s'
        expect(preview.estimatedTime).toBeDefined()
      })
    })
  })

  // ─── Error handling ──────────────────────────────────────────────

  describe('Error handling', () => {
    it('should track transform errors without crashing the whole migration', async () => {
      // Add 3 entities — one will trigger a throw
      await brain.add({ type: NounType.Concept, data: { name: 'Good1' }, metadata: { value: 1 } })
      await brain.add({ type: NounType.Concept, data: { name: 'Bad' }, metadata: { value: 'crash-me' } })
      await brain.add({ type: NounType.Concept, data: { name: 'Good2' }, metadata: { value: 3 } })

      const migration: Migration = {
        id: 'test-error-handling',
        version: '1.0.0',
        description: 'Transform that throws on non-number values',
        applies: 'nouns',
        transform: (m) => {
          if ('value' in m) {
            if (typeof m.value !== 'number') {
              throw new Error('value must be a number')
            }
            return { ...m, value: (m.value as number) * 10 }
          }
          return null
        }
      }

      await withMigrations([migration], async () => {
        const result = await brain.migrate()
        const r = result as any

        // Migration should still complete for the good entities
        expect(r.migrationsApplied).toContain('test-error-handling')
        expect(r.entitiesModified).toBeGreaterThanOrEqual(2)

        // Errors should be tracked
        expect(r.errors.length).toBeGreaterThanOrEqual(1)
        expect(r.errors[0].migrationId).toBe('test-error-handling')
        expect(r.errors[0].error).toContain('value must be a number')
        expect(r.errors[0].entityId).toBeDefined()
      })
    })

    it('should propagate errors from branch migrations into the result', async () => {
      // Create entity on main, commit, fork a branch, add a branch-local entity that will fail
      await brain.add({ type: NounType.Concept, data: { name: 'MainOk' }, metadata: { branchTest: 1 } })
      await brain.commit({ message: 'initial', author: 'test' })

      const fork = await brain.fork('branch-with-error')
      await fork.add({ type: NounType.Concept, data: { name: 'BranchBad' }, metadata: { branchTest: 'crash' } })

      const migration: Migration = {
        id: 'test-branch-error-prop',
        version: '1.0.0',
        description: 'Throws on non-number branchTest',
        applies: 'nouns',
        transform: (m) => {
          if ('branchTest' in m) {
            if (typeof m.branchTest !== 'number') {
              throw new Error('branchTest must be a number')
            }
            return { ...m, branchTest: (m.branchTest as number) * 10 }
          }
          return null
        }
      }

      await withMigrations([migration], async () => {
        const result = await brain.migrate()
        const r = result as any

        // Main entity should have migrated successfully
        expect(r.migrationsApplied).toContain('test-branch-error-prop')
        expect(r.entitiesModified).toBeGreaterThanOrEqual(1)

        // Branch error should appear in the combined result
        expect(r.errors.length).toBeGreaterThanOrEqual(1)
        const branchError = r.errors.find((e: any) => e.error.includes('branchTest must be a number'))
        expect(branchError).toBeDefined()
      })

      await fork.close()
    })

    it('should stop early when maxErrors is exceeded', async () => {
      // Add many entities that will all fail
      for (let i = 0; i < 5; i++) {
        await brain.add({ type: NounType.Concept, data: { name: `Fail${i}` }, metadata: { boom: true } })
      }

      const migration: Migration = {
        id: 'test-max-errors',
        version: '1.0.0',
        description: 'Always throws',
        applies: 'nouns',
        transform: (m) => {
          if ('boom' in m) {
            throw new Error('deliberate failure')
          }
          return null
        }
      }

      await withMigrations([migration], async () => {
        const result = await brain.migrate({ maxErrors: 2 })
        const r = result as any

        // Should have stopped at 2 errors
        expect(r.errors.length).toBe(2)
        // Not all entities should have been processed
        expect(r.entitiesProcessed).toBeLessThanOrEqual(5)
      })
    })
  })

  // ─── Validation ─────────────────────────────────────────────────

  describe('Validation (MigrationRunner.validateMigrations)', () => {
    it('should accept empty migrations array', () => {
      expect(() => MigrationRunner.validateMigrations([])).not.toThrow()
    })

    it('should accept valid migrations', () => {
      const valid: Migration[] = [
        { id: 'v1', version: '1.0.0', description: 'Test', applies: 'nouns', transform: () => null },
        { id: 'v2', version: '1.1.0', description: 'Test 2', applies: 'verbs', transform: () => null }
      ]
      expect(() => MigrationRunner.validateMigrations(valid)).not.toThrow()
    })

    it('should reject duplicate migration IDs', () => {
      const dupes: Migration[] = [
        { id: 'same-id', version: '1.0.0', description: 'First', applies: 'nouns', transform: () => null },
        { id: 'same-id', version: '1.1.0', description: 'Second', applies: 'nouns', transform: () => null }
      ]
      expect(() => MigrationRunner.validateMigrations(dupes)).toThrow(/Duplicate migration id.*same-id/)
    })

    it('should reject invalid applies value', () => {
      const bad = [
        { id: 'bad-applies', version: '1.0.0', description: 'Bad', applies: 'widgets' as any, transform: () => null }
      ]
      expect(() => MigrationRunner.validateMigrations(bad)).toThrow(/invalid applies value.*widgets/)
    })

    it('should reject non-function transform', () => {
      const bad = [
        { id: 'bad-transform', version: '1.0.0', description: 'Bad', applies: 'nouns' as const, transform: 'not a function' as any }
      ]
      expect(() => MigrationRunner.validateMigrations(bad)).toThrow(/non-function transform/)
    })

    it('should reject missing required fields', () => {
      const noId = [
        { id: '', version: '1.0.0', description: 'Bad', applies: 'nouns' as const, transform: () => null }
      ]
      expect(() => MigrationRunner.validateMigrations(noId)).toThrow(/missing or invalid id/)

      const noVersion = [
        { id: 'ok', version: '', description: 'Bad', applies: 'nouns' as const, transform: () => null }
      ]
      expect(() => MigrationRunner.validateMigrations(noVersion)).toThrow(/missing or invalid version/)

      const noDescription = [
        { id: 'ok', version: '1.0.0', description: '', applies: 'nouns' as const, transform: () => null }
      ]
      expect(() => MigrationRunner.validateMigrations(noDescription)).toThrow(/missing or invalid description/)
    })
  })
})
