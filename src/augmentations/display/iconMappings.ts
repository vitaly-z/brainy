/**
 * Universal Display Augmentation - Clean Display
 * 
 * Simple, clean display without icons - focusing on AI-powered
 * titles, descriptions, and smart formatting that matches 
 * Soulcraft's minimal aesthetic
 */

import { NounType, VerbType } from '../../types/graphTypes.js'

/**
 * No icon mappings - clean, minimal approach
 * The real value is in AI-generated titles and enhanced descriptions,
 * not visual clutter that doesn't align with professional aesthetics
 */
export const NOUN_TYPE_ICONS: Record<string, string> = {}

/**
 * No icon mappings for verbs either - focus on clear relationship descriptions
 * Human-readable relationship text is more valuable than symbolic representations
 */
export const VERB_TYPE_ICONS: Record<string, string> = {}

/**
 * Get icon for a noun type (returns empty string for clean display)
 * @param type The noun type
 * @returns Empty string (no icons)
 */
export function getNounIcon(type: string): string {
  return '' // Clean, no icons
}

/**
 * Get icon for a verb type (returns empty string for clean display)
 * @param type The verb type  
 * @returns Empty string (no icons)
 */
export function getVerbIcon(type: string): string {
  return '' // Clean, no icons
}

/**
 * Get coverage statistics (for backwards compatibility)
 * @returns Coverage info showing clean approach
 */
export function getIconCoverage() {
  return {
    nounTypes: {
      total: 'Clean display - no icons needed',
      covered: 'Focus on AI-powered content'
    },
    verbTypes: {
      total: 'Clean display - no icons needed', 
      covered: 'Focus on relationship descriptions'
    }
  }
}

/**
 * Check if an icon exists for a type (always false for clean display)
 * @param type The type to check
 * @param entityType Whether it's a noun or verb
 * @returns Always false (no icons)
 */
export function hasIcon(type: string, entityType: 'noun' | 'verb' = 'noun'): boolean {
  return false // Clean approach - no icons
}

/**
 * Get fallback icon (returns empty string for clean display)
 * @param entityType The entity type
 * @returns Empty string (no fallback icons)
 */
export function getFallbackIcon(entityType: 'noun' | 'verb' = 'noun'): string {
  return '' // Clean, minimal display
}