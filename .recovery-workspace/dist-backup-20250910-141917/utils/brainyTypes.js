/**
 * BrainyTypes - Complete type management for Brainy
 *
 * Provides type lists, validation, and intelligent suggestions
 * for nouns and verbs using semantic embeddings.
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
 *
 * // Get intelligent suggestions
 * const personData = {
 *   name: 'John Doe',
 *   email: 'john@example.com'
 * }
 * const suggestion = await BrainyTypes.suggestNoun(personData)
 * console.log(suggestion.type) // 'Person'
 * console.log(suggestion.confidence) // 0.92
 * ```
 */
import { NounType, VerbType } from '../types/graphTypes.js';
import { BrainyTypes as InternalBrainyTypes } from '../augmentations/typeMatching/brainyTypes.js';
/**
 * BrainyTypes - Complete type management for Brainy
 *
 * Static class providing type lists, validation, and intelligent suggestions.
 * No instantiation needed - all methods are static.
 */
export class BrainyTypes {
    /**
     * Get or create the internal matcher instance
     */
    static async getInternalMatcher() {
        if (!this.instance) {
            this.instance = new InternalBrainyTypes();
            await this.instance.init();
            this.initialized = true;
        }
        return this.instance;
    }
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
    static isValidNoun(type) {
        return this.nouns.includes(type);
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
    static isValidVerb(type) {
        return this.verbs.includes(type);
    }
    /**
     * Suggest the most appropriate noun type for an object
     *
     * @param data The object or data to analyze
     * @returns Promise resolving to type suggestion with confidence score
     *
     * @example
     * ```typescript
     * const data = {
     *   title: 'Quarterly Report',
     *   author: 'Jane Smith',
     *   pages: 42
     * }
     * const suggestion = await BrainyTypes.suggestNoun(data)
     * console.log(suggestion.type)       // 'Document'
     * console.log(suggestion.confidence) // 0.88
     *
     * // Check alternatives if confidence is low
     * if (suggestion.confidence < 0.8) {
     *   console.log('Also consider:', suggestion.alternatives)
     * }
     * ```
     */
    static async suggestNoun(data) {
        const matcher = await this.getInternalMatcher();
        const result = await matcher.matchNounType(data);
        return {
            type: result.type,
            confidence: result.confidence,
            reason: result.reasoning,
            alternatives: result.alternatives?.map(alt => ({
                type: alt.type,
                confidence: alt.confidence
            }))
        };
    }
    /**
     * Suggest the most appropriate verb type for a relationship
     *
     * @param source The source entity
     * @param target The target entity
     * @param hint Optional hint about the relationship
     * @returns Promise resolving to type suggestion with confidence score
     *
     * @example
     * ```typescript
     * const source = { type: 'Person', name: 'Alice' }
     * const target = { type: 'Document', title: 'Research Paper' }
     *
     * const suggestion = await BrainyTypes.suggestVerb(source, target, 'authored')
     * console.log(suggestion.type)       // 'CreatedBy'
     * console.log(suggestion.confidence) // 0.91
     *
     * // Without hint
     * const suggestion2 = await BrainyTypes.suggestVerb(source, target)
     * console.log(suggestion2.type)      // 'RelatedTo' (more generic)
     * ```
     */
    static async suggestVerb(source, target, hint) {
        const matcher = await this.getInternalMatcher();
        const result = await matcher.matchVerbType(source, target, hint);
        return {
            type: result.type,
            confidence: result.confidence,
            reason: result.reasoning,
            alternatives: result.alternatives?.map(alt => ({
                type: alt.type,
                confidence: alt.confidence
            }))
        };
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
    static getNoun(name) {
        if (!this.isValidNoun(name)) {
            throw new Error(`Invalid noun type: '${name}'. Valid types are: ${this.nouns.join(', ')}`);
        }
        return name;
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
    static getVerb(name) {
        if (!this.isValidVerb(name)) {
            throw new Error(`Invalid verb type: '${name}'. Valid types are: ${this.verbs.join(', ')}`);
        }
        return name;
    }
    /**
     * Clear the internal cache
     * Useful when processing many different types of data
     */
    static clearCache() {
        this.instance?.clearCache();
    }
    /**
     * Dispose of resources
     * Call when completely done using BrainyTypes
     */
    static async dispose() {
        if (this.instance) {
            await this.instance.dispose();
            this.instance = null;
            this.initialized = false;
        }
    }
    /**
     * Get noun types as a plain object (for iteration)
     * @returns Object with noun type names as keys
     */
    static getNounMap() {
        const map = {};
        for (const noun of this.nouns) {
            map[noun] = noun;
        }
        return map;
    }
    /**
     * Get verb types as a plain object (for iteration)
     * @returns Object with verb type names as keys
     */
    static getVerbMap() {
        const map = {};
        for (const verb of this.verbs) {
            map[verb] = verb;
        }
        return map;
    }
}
BrainyTypes.instance = null;
BrainyTypes.initialized = false;
/**
 * All available noun types
 * @example
 * ```typescript
 * BrainyTypes.nouns.forEach(type => console.log(type))
 * // 'Person', 'Organization', 'Location', ...
 * ```
 */
BrainyTypes.nouns = Object.freeze(Object.values(NounType));
/**
 * All available verb types
 * @example
 * ```typescript
 * BrainyTypes.verbs.forEach(type => console.log(type))
 * // 'Contains', 'Creates', 'RelatedTo', ...
 * ```
 */
BrainyTypes.verbs = Object.freeze(Object.values(VerbType));
// Re-export the enums for convenience
export { NounType, VerbType };
export async function suggestType(kind, ...args) {
    if (kind === 'noun') {
        return BrainyTypes.suggestNoun(args[0]);
    }
    else {
        return BrainyTypes.suggestVerb(args[0], args[1], args[2]);
    }
}
//# sourceMappingURL=brainyTypes.js.map