/**
 * Universal Display Augmentation - Smart Field Patterns
 *
 * Intelligent field detection patterns for mapping user data to display fields
 * Uses semantic understanding and common naming conventions
 */
import type { FieldPattern, FieldComputationContext } from './types.js';
/**
 * Universal field patterns that work across all data types
 * Ordered by confidence level (highest first)
 */
export declare const UNIVERSAL_FIELD_PATTERNS: FieldPattern[];
/**
 * Type-specific field patterns for enhanced detection
 * Used when we know the specific type of the entity
 */
export declare const TYPE_SPECIFIC_PATTERNS: Record<string, FieldPattern[]>;
/**
 * Get field patterns for a specific entity type
 * @param entityType The type of entity (noun or verb)
 * @param specificType Optional specific noun/verb type
 * @returns Array of applicable field patterns
 */
export declare function getFieldPatterns(entityType: 'noun' | 'verb', specificType?: string): FieldPattern[];
/**
 * Priority fields for different entity types (for AI analysis)
 * Used by the BrainyTypes and neural processing
 */
export declare const TYPE_PRIORITY_FIELDS: Record<string, string[]>;
/**
 * Get priority fields for intelligent analysis
 * @param entityType The type of entity
 * @param specificType Optional specific type
 * @returns Array of priority field names
 */
export declare function getPriorityFields(entityType: 'noun' | 'verb', specificType?: string): string[];
/**
 * Smart field value extraction with type-aware processing
 * @param data The data object to extract from
 * @param pattern The field pattern to apply
 * @param context The computation context
 * @returns The extracted and processed field value
 */
export declare function extractFieldValue(data: any, pattern: FieldPattern, context: FieldComputationContext): any;
/**
 * Calculate confidence score for field detection
 * @param pattern The field pattern
 * @param context The computation context
 * @param value The extracted value
 * @returns Confidence score (0-1)
 */
export declare function calculateFieldConfidence(pattern: FieldPattern, context: FieldComputationContext, value: any): number;
