/**
 * Universal Display Augmentation - Clean Display
 *
 * Simple, clean display without icons - focusing on AI-powered
 * titles, descriptions, and smart formatting that matches
 * Soulcraft's minimal aesthetic
 */
/**
 * No icon mappings - clean, minimal approach
 * The real value is in AI-generated titles and enhanced descriptions,
 * not visual clutter that doesn't align with professional aesthetics
 */
export declare const NOUN_TYPE_ICONS: Record<string, string>;
/**
 * No icon mappings for verbs either - focus on clear relationship descriptions
 * Human-readable relationship text is more valuable than symbolic representations
 */
export declare const VERB_TYPE_ICONS: Record<string, string>;
/**
 * Get icon for a noun type (returns empty string for clean display)
 * @param type The noun type
 * @returns Empty string (no icons)
 */
export declare function getNounIcon(type: string): string;
/**
 * Get icon for a verb type (returns empty string for clean display)
 * @param type The verb type
 * @returns Empty string (no icons)
 */
export declare function getVerbIcon(type: string): string;
/**
 * Get coverage statistics (for backwards compatibility)
 * @returns Coverage info showing clean approach
 */
export declare function getIconCoverage(): {
    nounTypes: {
        total: string;
        covered: string;
    };
    verbTypes: {
        total: string;
        covered: string;
    };
};
/**
 * Check if an icon exists for a type (always false for clean display)
 * @param type The type to check
 * @param entityType Whether it's a noun or verb
 * @returns Always false (no icons)
 */
export declare function hasIcon(type: string, entityType?: 'noun' | 'verb'): boolean;
/**
 * Get fallback icon (returns empty string for clean display)
 * @param entityType The entity type
 * @returns Empty string (no fallback icons)
 */
export declare function getFallbackIcon(entityType?: 'noun' | 'verb'): string;
