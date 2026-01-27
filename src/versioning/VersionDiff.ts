/**
 * VersionDiff - Deep Object Comparison for Entity Versions
 *
 * Provides deep diff between entity versions:
 * - Field-level change detection
 * - Nested object comparison
 * - Array diffing
 * - Type change detection
 * - Human-readable diff output
 *
 * NO MOCKS - Production implementation
 */

import type { NounMetadata } from '../coreTypes.js'

/**
 * Types of changes in a diff
 */
export type ChangeType = 'added' | 'removed' | 'modified' | 'type-changed'

/**
 * A single field change in a diff
 */
export interface FieldChange {
  /** Path to the field (e.g., 'metadata.user.name') */
  path: string

  /** Type of change */
  type: ChangeType

  /** Old value (undefined for 'added') */
  oldValue?: any

  /** New value (undefined for 'removed') */
  newValue?: any

  /** Old type (for 'type-changed') */
  oldType?: string

  /** New type (for 'type-changed') */
  newType?: string
}

/**
 * Complete diff between two versions
 */
export interface VersionDiff {
  /** Entity ID being compared */
  entityId: string

  /** From version number */
  fromVersion: number

  /** To version number */
  toVersion: number

  /** Fields that were added */
  added: FieldChange[]

  /** Fields that were removed */
  removed: FieldChange[]

  /** Fields that were modified */
  modified: FieldChange[]

  /** Fields whose type changed */
  typeChanged: FieldChange[]

  /** Total number of changes */
  totalChanges: number

  /** Whether versions are identical */
  identical: boolean
}

/**
 * Options for diff comparison
 */
export interface DiffOptions {
  /** Entity ID (for context in output) */
  entityId: string

  /** From version number */
  fromVersion: number

  /** To version number */
  toVersion: number

  /** Ignore these fields in comparison */
  ignoreFields?: string[]

  /** Maximum depth for nested object comparison (default: 10) */
  maxDepth?: number

  /** Include unchanged fields in output (default: false) */
  includeUnchanged?: boolean
}

/**
 * Compare two entity versions and generate diff
 *
 * @param from Old version entity
 * @param to New version entity
 * @param options Diff options
 * @returns Diff between versions
 */
export function compareEntityVersions(
  from: NounMetadata,
  to: NounMetadata,
  options: DiffOptions
): VersionDiff {
  const added: FieldChange[] = []
  const removed: FieldChange[] = []
  const modified: FieldChange[] = []
  const typeChanged: FieldChange[] = []

  const ignoreFields = new Set(options.ignoreFields || [])
  const maxDepth = options.maxDepth ?? 10

  // Compare objects recursively
  compareObjects(from, to, '', added, removed, modified, typeChanged, ignoreFields, 0, maxDepth)

  const totalChanges = added.length + removed.length + modified.length + typeChanged.length
  const identical = totalChanges === 0

  return {
    entityId: options.entityId,
    fromVersion: options.fromVersion,
    toVersion: options.toVersion,
    added,
    removed,
    modified,
    typeChanged,
    totalChanges,
    identical
  }
}

/**
 * Recursively compare two objects
 */
function compareObjects(
  from: any,
  to: any,
  path: string,
  added: FieldChange[],
  removed: FieldChange[],
  modified: FieldChange[],
  typeChanged: FieldChange[],
  ignoreFields: Set<string>,
  depth: number,
  maxDepth: number
): void {
  if (depth >= maxDepth) {
    // Hit max depth - treat as single value
    if (!deepEqual(from, to)) {
      modified.push({
        path,
        type: 'modified',
        oldValue: from,
        newValue: to
      })
    }
    return
  }

  // Get all keys from both objects
  const fromKeys = new Set(Object.keys(from || {}))
  const toKeys = new Set(Object.keys(to || {}))
  const allKeys = new Set([...fromKeys, ...toKeys])

  for (const key of allKeys) {
    const fieldPath = path ? `${path}.${key}` : key

    // Skip ignored fields
    if (ignoreFields.has(fieldPath) || ignoreFields.has(key)) {
      continue
    }

    const fromHas = fromKeys.has(key)
    const toHas = toKeys.has(key)

    if (!fromHas && toHas) {
      // Field added
      added.push({
        path: fieldPath,
        type: 'added',
        newValue: to[key]
      })
    } else if (fromHas && !toHas) {
      // Field removed
      removed.push({
        path: fieldPath,
        type: 'removed',
        oldValue: from[key]
      })
    } else {
      // Field exists in both - check for changes
      const fromValue = from[key]
      const toValue = to[key]

      const fromType = getValueType(fromValue)
      const toType = getValueType(toValue)

      if (fromType !== toType) {
        // Type changed
        typeChanged.push({
          path: fieldPath,
          type: 'type-changed',
          oldValue: fromValue,
          newValue: toValue,
          oldType: fromType,
          newType: toType
        })
      } else if (fromType === 'object' && toType === 'object') {
        // Recursively compare nested objects
        compareObjects(
          fromValue,
          toValue,
          fieldPath,
          added,
          removed,
          modified,
          typeChanged,
          ignoreFields,
          depth + 1,
          maxDepth
        )
      } else if (fromType === 'array' && toType === 'array') {
        // Compare arrays
        if (!arraysEqual(fromValue, toValue)) {
          modified.push({
            path: fieldPath,
            type: 'modified',
            oldValue: fromValue,
            newValue: toValue
          })
        }
      } else {
        // Primitive value comparison
        if (!deepEqual(fromValue, toValue)) {
          modified.push({
            path: fieldPath,
            type: 'modified',
            oldValue: fromValue,
            newValue: toValue
          })
        }
      }
    }
  }
}

/**
 * Get human-readable type of a value
 */
function getValueType(value: any): string {
  if (value === null) return 'null'
  if (value === undefined) return 'undefined'
  if (Array.isArray(value)) return 'array'
  return typeof value
}

/**
 * Deep equality check
 */
function deepEqual(a: any, b: any): boolean {
  if (a === b) return true
  if (a === null || b === null) return false
  if (a === undefined || b === undefined) return false

  const typeA = getValueType(a)
  const typeB = getValueType(b)

  if (typeA !== typeB) return false

  if (typeA === 'array') {
    return arraysEqual(a, b)
  }

  if (typeA === 'object') {
    return objectsEqual(a, b)
  }

  // Primitive comparison
  return a === b
}

/**
 * Compare arrays for equality
 */
function arraysEqual(a: any[], b: any[]): boolean {
  if (a.length !== b.length) return false

  for (let i = 0; i < a.length; i++) {
    if (!deepEqual(a[i], b[i])) {
      return false
    }
  }

  return true
}

/**
 * Compare objects for equality
 */
function objectsEqual(a: any, b: any): boolean {
  const keysA = Object.keys(a)
  const keysB = Object.keys(b)

  if (keysA.length !== keysB.length) return false

  for (const key of keysA) {
    if (!keysB.includes(key)) return false
    if (!deepEqual(a[key], b[key])) return false
  }

  return true
}

/**
 * Format diff as human-readable string
 *
 * @param diff Diff to format
 * @returns Formatted string
 */
export function formatDiff(diff: VersionDiff): string {
  const lines: string[] = []

  lines.push(`Diff: ${diff.entityId} v${diff.fromVersion} → v${diff.toVersion}`)
  lines.push('')

  if (diff.identical) {
    lines.push('No changes')
    return lines.join('\n')
  }

  lines.push(`Total changes: ${diff.totalChanges}`)
  lines.push('')

  if (diff.added.length > 0) {
    lines.push(`Added (${diff.added.length}):`)
    for (const change of diff.added) {
      lines.push(`  + ${change.path}: ${formatValue(change.newValue)}`)
    }
    lines.push('')
  }

  if (diff.removed.length > 0) {
    lines.push(`Removed (${diff.removed.length}):`)
    for (const change of diff.removed) {
      lines.push(`  - ${change.path}: ${formatValue(change.oldValue)}`)
    }
    lines.push('')
  }

  if (diff.modified.length > 0) {
    lines.push(`Modified (${diff.modified.length}):`)
    for (const change of diff.modified) {
      lines.push(`  ~ ${change.path}:`)
      lines.push(`      ${formatValue(change.oldValue)}`)
      lines.push(`    → ${formatValue(change.newValue)}`)
    }
    lines.push('')
  }

  if (diff.typeChanged.length > 0) {
    lines.push(`Type Changed (${diff.typeChanged.length}):`)
    for (const change of diff.typeChanged) {
      lines.push(`  ! ${change.path}: ${change.oldType} → ${change.newType}`)
      lines.push(`      ${formatValue(change.oldValue)}`)
      lines.push(`    → ${formatValue(change.newValue)}`)
    }
  }

  return lines.join('\n')
}

/**
 * Format value for display
 */
function formatValue(value: any): string {
  if (value === null) return 'null'
  if (value === undefined) return 'undefined'
  if (typeof value === 'string') return `"${value}"`
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value)
    } catch {
      return '[Object]'
    }
  }
  return String(value)
}

/**
 * Get summary statistics about a diff
 */
export function getDiffStats(diff: VersionDiff): {
  changedFields: number
  addedFields: number
  removedFields: number
  modifiedFields: number
  typeChangedFields: number
} {
  return {
    changedFields: diff.totalChanges,
    addedFields: diff.added.length,
    removedFields: diff.removed.length,
    modifiedFields: diff.modified.length,
    typeChangedFields: diff.typeChanged.length
  }
}

/**
 * Check if diff has any changes
 */
export function hasChanges(diff: VersionDiff): boolean {
  return !diff.identical
}

/**
 * Get all changed field paths
 */
export function getChangedPaths(diff: VersionDiff): string[] {
  const paths = new Set<string>()

  for (const change of diff.added) paths.add(change.path)
  for (const change of diff.removed) paths.add(change.path)
  for (const change of diff.modified) paths.add(change.path)
  for (const change of diff.typeChanged) paths.add(change.path)

  return Array.from(paths).sort()
}

/**
 * Filter diff to only include specific paths
 */
export function filterDiff(diff: VersionDiff, paths: string[]): VersionDiff {
  const pathSet = new Set(paths)

  const filterChanges = (changes: FieldChange[]) =>
    changes.filter((c) => pathSet.has(c.path) || paths.some((p) => c.path.startsWith(p + '.')))

  const added = filterChanges(diff.added)
  const removed = filterChanges(diff.removed)
  const modified = filterChanges(diff.modified)
  const typeChanged = filterChanges(diff.typeChanged)

  return {
    ...diff,
    added,
    removed,
    modified,
    typeChanged,
    totalChanges: added.length + removed.length + modified.length + typeChanged.length,
    identical: added.length + removed.length + modified.length + typeChanged.length === 0
  }
}
