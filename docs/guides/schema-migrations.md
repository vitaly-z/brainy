# Schema Migrations

Brainy includes a built-in migration system for transforming entity and verb metadata across storage versions. Migrations are pure functions that run once per storage instance, with automatic backup, resume support, and error tracking.

---

## Quick Start

### 1. Define a migration

Add your migration to the `MIGRATIONS` array in `src/migration/migrations.ts`:

```typescript
import type { Migration } from './types.js'

export const MIGRATIONS: Migration[] = [
  {
    id: '7.17.0-rename-status',
    version: '7.17.0',
    description: 'Rename "state" field to "status"',
    applies: 'nouns',
    transform: (m) => {
      if ('state' in m) {
        const { state, ...rest } = m
        return { ...rest, status: state }
      }
      return null // already migrated or not applicable
    }
  }
]
```

### 2. Ship the new version

That's it. Brainy detects pending migrations on `init()` and either runs them automatically or warns the user to call `brain.migrate()`.

---

## How It Works

When `brain.init()` runs:

1. **Detection** — reads migration state from storage (one key lookup). Compares completed migration IDs against the `MIGRATIONS` array. If nothing pending, cost is ~0ms.

2. **Small datasets** (`autoMigrate: true`, <10K entities) — migrates inline during `init()`.

3. **Large datasets or manual mode** — logs a warning. User calls `brain.migrate()` when ready.

When `brain.migrate()` runs:

1. **Backup** — creates an instant COW branch (`pre-migration-7.17.0`) tagged with `system:backup` metadata. Rollback is possible by switching to this branch.

2. **Transform main branch** — iterates all nouns/verbs in paginated batches. For each entity, calls the `transform` function. If it returns a new object, saves it. If it returns `null`, skips. Vectors are never touched.

3. **Transform other branches** — switches to each user branch, runs the same transforms. Inherited (already-migrated) entities return `null` and are skipped automatically.

4. **Save state** — records each completed migration ID so it never re-runs.

5. **Rebuild indexes** — if any entities were modified, rebuilds the MetadataIndex.

---

## Writing Migrations

### The Migration interface

```typescript
interface Migration {
  id: string          // Unique ID, e.g. "7.17.0-rename-field"
  version: string     // Version that introduced this migration
  description: string // Human-readable description
  applies: 'nouns' | 'verbs' | 'both'
  transform: (metadata: Record<string, unknown>) => Record<string, unknown> | null
}
```

### Transform rules

- **Return a new object** to modify the entity's metadata.
- **Return `null`** to skip (no change needed).
- **Must be idempotent** — running the same transform twice on the same data should produce the same result (or return `null` the second time). This is required because branch iterations may re-encounter inherited entities.
- **Must be pure** — no side effects, no async, no external state.
- Transforms only see metadata. Vectors, embeddings, and the `data` field stored inside metadata are available as properties on the metadata object.

### Ordering

Migrations run in array order. Add new migrations at the end of the `MIGRATIONS` array. Each migration runs independently per entity — migration 2 sees the output of migration 1.

### Validation

`MigrationRunner.validateMigrations()` checks migration definitions and will throw on:

- Duplicate IDs
- Invalid `applies` values (must be `'nouns'`, `'verbs'`, or `'both'`)
- Non-function `transform`
- Missing or empty `id`, `version`, or `description`

---

## API Reference

### `brain.migrate(options?)`

```typescript
// Dry-run: preview what would change without writing
const preview = await brain.migrate({ dryRun: true })
// preview.pendingMigrations — array of { id, description }
// preview.affectedEntities  — count of entities that would change
// preview.totalEntities     — count of entities scanned
// preview.sampleChanges     — up to 5 before/after samples
// preview.estimatedTime     — rough time estimate string

// Apply migrations
const result = await brain.migrate()
// result.backupBranch      — name of COW backup branch, or null
// result.migrationsApplied — array of migration IDs that ran
// result.entitiesProcessed — total entities scanned
// result.entitiesModified  — entities actually changed
// result.errors            — array of entity-level errors (non-fatal)
```

### Options

```typescript
interface MigrateOptions {
  dryRun?: boolean       // Preview without writing (default: false)
  maxErrors?: number     // Bail out after N entity errors (default: 100)
  onProgress?: (progress: {
    migrationId: string
    processed: number
    modified: number
    hasMore: boolean
  }) => void
}
```

---

## Error Handling

If a transform function throws on a specific entity, the error is recorded and migration continues to the next entity. The failed entity's metadata is left unchanged.

```typescript
const result = await brain.migrate()

if (result.errors.length > 0) {
  for (const err of result.errors) {
    console.warn(`Entity ${err.entityId} failed in ${err.migrationId}: ${err.error}`)
  }
}
```

If errors exceed `maxErrors` (default: 100), the migration stops early and returns partial results. Successfully migrated entities keep their changes; failed entities are unchanged.

```typescript
// Strict mode: fail fast on any error
const result = await brain.migrate({ maxErrors: 1 })

// Lenient mode: tolerate many errors
const result = await brain.migrate({ maxErrors: 10000 })
```

---

## Backup and Rollback

Before modifying any data, `brain.migrate()` calls `brain.fork()` to create a COW snapshot. This is instant regardless of dataset size — it's a pointer copy, not a data copy.

The backup branch is named `pre-migration-{version}` and tagged with metadata:
- `type: 'system:backup'`
- `migrationVersion: '7.17.0'`
- `author: 'brainy-migration'`

To roll back, switch to the backup branch:

```typescript
await brain.checkout('pre-migration-7.17.0')
```

Old backup branches from previous migrations are cleaned up automatically before each new migration run.

---

## Progress Tracking

For large datasets, use the `onProgress` callback:

```typescript
await brain.migrate({
  onProgress: ({ migrationId, processed, modified, hasMore }) => {
    console.log(`[${migrationId}] ${processed} scanned, ${modified} modified${hasMore ? '...' : ' (done)'}`)
  }
})
```

Progress is reported after each batch (batch size is determined by the storage adapter).

---

## Examples

### Rename a field

```typescript
{
  id: '7.17.0-rename-state-to-status',
  version: '7.17.0',
  description: 'Rename metadata.state to metadata.status',
  applies: 'nouns',
  transform: (m) => {
    if ('state' in m) {
      const { state, ...rest } = m
      return { ...rest, status: state }
    }
    return null
  }
}
```

### Add a default value

```typescript
{
  id: '7.18.0-add-priority-default',
  version: '7.18.0',
  description: 'Add priority field with default "normal"',
  applies: 'both',
  transform: (m) => {
    if (!('priority' in m)) {
      return { ...m, priority: 'normal' }
    }
    return null
  }
}
```

### Remove a deprecated field

```typescript
{
  id: '7.19.0-remove-legacy-flag',
  version: '7.19.0',
  description: 'Remove deprecated "legacy" field',
  applies: 'nouns',
  transform: (m) => {
    if ('legacy' in m) {
      const { legacy, ...rest } = m
      return rest
    }
    return null
  }
}
```

### Transform verb metadata

```typescript
{
  id: '7.20.0-normalize-verb-weights',
  version: '7.20.0',
  description: 'Normalize verb weights from 0-100 to 0-1 scale',
  applies: 'verbs',
  transform: (m) => {
    if (typeof m.weight === 'number' && m.weight > 1) {
      return { ...m, weight: m.weight / 100 }
    }
    return null
  }
}
```

---

## Storage Backend Compatibility

Migrations work identically across all storage backends (Memory, FileSystem, S3, R2, GCS, OPFS). The system uses `BaseStorage` methods (`getNouns`, `saveNounMetadata`, `getVerbs`, `saveVerbMetadata`) which are implemented by every adapter.

Batch size and rate limiting are automatically configured per adapter — no tuning required.

---

## What Migrations Don't Do

- **Re-embedding** — migrations transform metadata only. If you change your embedding model or dimensions, that requires re-vectorizing data, which is a separate concern (not part of this system).
- **Vector modification** — the `vectors.json` files are never touched by migrations.
- **Schema enforcement** — migrations are opt-in transforms, not schema validators. Brainy's metadata is schemaless by design.
