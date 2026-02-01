/**
 * BrainyTypes - Type validation and lookup for Brainy
 *
 * Provides type lists and validation for the 42 noun types and 127 verb types.
 * Source of truth: graphTypes.ts
 *
 * @example
 * ```typescript
 * import { BrainyTypes } from '@soulcraft/brainy'
 *
 * // Get all available types
 * const nounTypes = BrainyTypes.nouns  // ['Person', 'Organization', ...]
 * const verbTypes = BrainyTypes.verbs  // ['Contains', 'Creates', ...]
 *
 * // Validate types
 * BrainyTypes.isValidNoun('Person')  // true
 * BrainyTypes.isValidVerb('Unknown') // false
 * ```
 */

import { NounType, VerbType } from '../types/graphTypes.js'

/**
 * BrainyTypes - Type validation and lookup for Brainy
 *
 * Static class providing type lists and validation.
 * No instantiation needed - all methods are static.
 */
export class BrainyTypes {
  /**
   * All available noun types (42)
   * @example
   * ```typescript
   * BrainyTypes.nouns.forEach(type => console.log(type))
   * // 'Person', 'Organization', 'Location', ...
   * ```
   */
  static readonly nouns: readonly NounType[] = Object.freeze(Object.values(NounType))

  /**
   * All available verb types (127)
   * @example
   * ```typescript
   * BrainyTypes.verbs.forEach(type => console.log(type))
   * // 'Contains', 'Creates', 'RelatedTo', ...
   * ```
   */
  static readonly verbs: readonly VerbType[] = Object.freeze(Object.values(VerbType))

  /**
   * Check if a string is a valid noun type
   *
   * @param type The type string to check
   * @returns True if valid noun type
   *
   * @example
   * ```typescript
   * BrainyTypes.isValidNoun('Person')     // true
   * BrainyTypes.isValidNoun('Unknown')    // false
   * BrainyTypes.isValidNoun('Contains')   // false (it's a verb)
   * ```
   */
  static isValidNoun(type: string): type is NounType {
    return (this.nouns as readonly string[]).includes(type)
  }

  /**
   * Check if a string is a valid verb type
   *
   * @param type The type string to check
   * @returns True if valid verb type
   *
   * @example
   * ```typescript
   * BrainyTypes.isValidVerb('Contains')   // true
   * BrainyTypes.isValidVerb('Unknown')    // false
   * BrainyTypes.isValidVerb('Person')     // false (it's a noun)
   * ```
   */
  static isValidVerb(type: string): type is VerbType {
    return (this.verbs as readonly string[]).includes(type)
  }

  /**
   * Get a noun type by name (with validation)
   *
   * @param name The noun type name
   * @returns The NounType enum value
   * @throws Error if invalid noun type
   *
   * @example
   * ```typescript
   * const type = BrainyTypes.getNoun('Person')  // NounType.Person
   * const bad = BrainyTypes.getNoun('Unknown')  // throws Error
   * ```
   */
  static getNoun(name: string): NounType {
    if (!this.isValidNoun(name)) {
      throw new Error(`Invalid noun type: '${name}'. Valid types are: ${this.nouns.join(', ')}`)
    }
    return name as NounType
  }

  /**
   * Get a verb type by name (with validation)
   *
   * @param name The verb type name
   * @returns The VerbType enum value
   * @throws Error if invalid verb type
   *
   * @example
   * ```typescript
   * const type = BrainyTypes.getVerb('Contains')  // VerbType.Contains
   * const bad = BrainyTypes.getVerb('Unknown')    // throws Error
   * ```
   */
  static getVerb(name: string): VerbType {
    if (!this.isValidVerb(name)) {
      throw new Error(`Invalid verb type: '${name}'. Valid types are: ${this.verbs.join(', ')}`)
    }
    return name as VerbType
  }

  /**
   * Get noun types as a plain object (for iteration)
   * @returns Object with noun type names as keys
   */
  static getNounMap(): Record<string, NounType> {
    const map: Record<string, NounType> = {}
    for (const noun of this.nouns) {
      map[noun] = noun
    }
    return map
  }

  /**
   * Get verb types as a plain object (for iteration)
   * @returns Object with verb type names as keys
   */
  static getVerbMap(): Record<string, VerbType> {
    const map: Record<string, VerbType> = {}
    for (const verb of this.verbs) {
      map[verb] = verb
    }
    return map
  }
}

// Re-export the enums for convenience
export { NounType, VerbType }
