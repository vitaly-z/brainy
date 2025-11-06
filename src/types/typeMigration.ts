/**
 * Type Migration Utilities for Stage 3 Taxonomy (v6.0.0)
 *
 * Provides migration helpers for code using removed types from v5.x
 *
 * ## Removed Types
 *
 * ### Nouns (2 removed):
 * - `user` → merged into `person`
 * - `topic` → merged into `concept`
 *
 * ### Verbs (4 removed):
 * - `succeeds` → use inverse of `precedes`
 * - `belongsTo` → use inverse of `owns`
 * - `createdBy` → use inverse of `creates`
 * - `supervises` → use inverse of `reportsTo`
 */

import { NounType, VerbType } from './graphTypes.js'

/**
 * Migration mapping for removed noun types
 */
export const REMOVED_NOUN_TYPES = {
  user: NounType.Person,
  topic: NounType.Concept
} as const

/**
 * Migration mapping for removed verb types
 * Note: Some verbs should use inverse relationships in Stage 3
 */
export const REMOVED_VERB_TYPES = {
  succeeds: VerbType.Precedes, // Use with inverted source/target
  belongsTo: VerbType.Owns, // Use with inverted source/target
  createdBy: VerbType.Creates, // Use with inverted source/target
  supervises: VerbType.ReportsTo // Use with inverted source/target
} as const

/**
 * Check if a type was removed in Stage 3
 */
export function isRemovedNounType(type: string): type is keyof typeof REMOVED_NOUN_TYPES {
  return type in REMOVED_NOUN_TYPES
}

/**
 * Check if a verb type was removed in Stage 3
 */
export function isRemovedVerbType(type: string): type is keyof typeof REMOVED_VERB_TYPES {
  return type in REMOVED_VERB_TYPES
}

/**
 * Migrate a noun type from v5.x to v6.0 Stage 3
 * Returns the migrated type or the original if no migration needed
 */
export function migrateNounType(type: string): NounType {
  if (isRemovedNounType(type)) {
    console.warn(`⚠️  NounType "${type}" was removed in v6.0. Migrating to "${REMOVED_NOUN_TYPES[type]}"`)
    return REMOVED_NOUN_TYPES[type]
  }
  return type as NounType
}

/**
 * Migrate a verb type from v5.x to v6.0 Stage 3
 * Returns the migrated type or the original if no migration needed
 *
 * WARNING: Some verbs require inverting source/target relationships!
 * See VERB_REQUIRES_INVERSION for details.
 */
export function migrateVerbType(type: string): VerbType {
  if (isRemovedVerbType(type)) {
    console.warn(`⚠️  VerbType "${type}" was removed in v6.0. Migrating to "${REMOVED_VERB_TYPES[type]}" (may require source/target inversion)`)
    return REMOVED_VERB_TYPES[type]
  }
  return type as VerbType
}

/**
 * Verbs that require inverting source/target when migrating
 *
 * Example:
 * - Old: `A createdBy B` → New: `B creates A`
 * - Old: `A belongsTo B` → New: `B owns A`
 * - Old: `A supervises B` → New: `B reportsTo A`
 * - Old: `A succeeds B` → New: `B precedes A`
 */
export const VERB_REQUIRES_INVERSION = new Set([
  'succeeds',
  'belongsTo',
  'createdBy',
  'supervises'
])

/**
 * Check if a verb type requires inverting source/target during migration
 */
export function requiresInversion(oldVerbType: string): boolean {
  return VERB_REQUIRES_INVERSION.has(oldVerbType)
}

/**
 * Migrate a relationship, handling source/target inversion if needed
 *
 * @returns Object with migrated verb and potentially inverted source/target
 */
export function migrateRelationship(params: {
  verb: string
  source: string
  target: string
}): {
  verb: VerbType
  source: string
  target: string
  inverted: boolean
} {
  const verb = migrateVerbType(params.verb)
  const inverted = requiresInversion(params.verb)

  if (inverted) {
    return {
      verb,
      source: params.target, // Swap source and target
      target: params.source,
      inverted: true
    }
  }

  return {
    verb,
    source: params.source,
    target: params.target,
    inverted: false
  }
}

/**
 * Stage 3 Type Compatibility Check
 * Helps developers identify code that needs updating for v6.0
 */
export function checkTypeCompatibility(nounTypes: string[], verbTypes: string[]): {
  valid: boolean
  removedNouns: string[]
  removedVerbs: string[]
  warnings: string[]
} {
  const removedNouns = nounTypes.filter(isRemovedNounType)
  const removedVerbs = verbTypes.filter(isRemovedVerbType)
  const warnings: string[] = []

  if (removedNouns.length > 0) {
    warnings.push(
      `Found ${removedNouns.length} removed noun type(s): ${removedNouns.join(', ')}. ` +
        `These were merged in Stage 3. Use Person instead of User, Concept instead of Topic.`
    )
  }

  if (removedVerbs.length > 0) {
    warnings.push(
      `Found ${removedVerbs.length} removed verb type(s): ${removedVerbs.join(', ')}. ` +
        `These require using inverse relationships in Stage 3. ` +
        `Example: "A createdBy B" becomes "B creates A".`
    )
  }

  return {
    valid: removedNouns.length === 0 && removedVerbs.length === 0,
    removedNouns,
    removedVerbs,
    warnings
  }
}
