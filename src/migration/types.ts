/**
 * Migration system types for Brainy
 *
 * Defines the interfaces for schema migrations that transform
 * entity/verb metadata across storage versions.
 */

export interface Migration {
  /** Unique migration identifier, e.g., "7.17.0-rename-field" */
  id: string
  /** Version that introduced this migration */
  version: string
  /** Human-readable description of what this migration does */
  description: string
  /** Which entity types this migration applies to */
  applies: 'nouns' | 'verbs' | 'both'
  /** Return transformed metadata, or null if no change needed */
  transform: (metadata: Record<string, unknown>) => Record<string, unknown> | null
}

export interface MigrationState {
  /** Last completed migration version */
  completedVersion: string
  /** Timestamp of last completed migration */
  completedAt: number
  /** List of completed migration IDs */
  completedMigrations: string[]
  /** Resume state for crash recovery */
  resumeState?: {
    migrationId: string
    lastProcessedOffset: number
    branch: string
  }
}

export interface MigrationPreview {
  /** Migrations that will be applied */
  pendingMigrations: { id: string; description: string }[]
  /** Number of entities that would be modified */
  affectedEntities: number
  /** Total number of entities scanned */
  totalEntities: number
  /** Sample before/after transformations (up to 5) */
  sampleChanges: { id: string; before: Record<string, unknown>; after: Record<string, unknown> }[]
  /** Rough time estimate */
  estimatedTime: string
}

export interface MigrationError {
  /** ID of the entity that failed */
  entityId: string
  /** ID of the migration that caused the failure */
  migrationId: string
  /** Error message */
  error: string
}

export interface MigrationResult {
  /** Backup branch name, or null if no changes were needed */
  backupBranch: string | null
  /** IDs of migrations that were applied */
  migrationsApplied: string[]
  /** Total entities processed (scanned) */
  entitiesProcessed: number
  /** Entities actually modified */
  entitiesModified: number
  /** Errors encountered during migration (entity-level, non-fatal) */
  errors: MigrationError[]
}

export interface MigrateOptions {
  /** Preview what would change without writing */
  dryRun?: boolean
  /** Progress callback for long-running migrations */
  onProgress?: (progress: {
    migrationId: string
    processed: number
    modified: number
    hasMore: boolean
  }) => void
  /** Maximum entity-level errors before bailing out (default: 100) */
  maxErrors?: number
}
