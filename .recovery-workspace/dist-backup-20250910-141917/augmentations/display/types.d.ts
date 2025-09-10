/**
 * Universal Display Augmentation - Type Definitions
 *
 * Clean TypeScript interfaces for the display augmentation system
 */
import type { VectorDocument, GraphVerb } from '../../coreTypes.js';
/**
 * Configuration interface for the Universal Display Augmentation
 */
export interface DisplayConfig {
    /** Enable/disable the augmentation */
    enabled: boolean;
    /** LRU cache size for computed display fields */
    cacheSize: number;
    /** Use lazy computation (recommended for performance) */
    lazyComputation: boolean;
    /** Batch processing size for multiple requests */
    batchSize: number;
    /** Minimum confidence threshold for AI type detection */
    confidenceThreshold: number;
    /** Custom field mappings (userField -> displayField) */
    customFieldMappings: Record<string, string>;
    /** Type-specific priority fields for intelligent detection */
    priorityFields: Record<string, string[]>;
    /** Enable debug mode with reasoning output */
    debugMode: boolean;
}
/**
 * Computed display fields for any noun or verb
 */
export interface ComputedDisplayFields {
    /** Primary display name (AI-detected best field combination) */
    title: string;
    /** Enhanced description with context awareness */
    description: string;
    /** Human-readable type name */
    type: string;
    /** Generated display tags for categorization */
    tags: string[];
    /** For verbs: human-readable relationship description */
    relationship?: string;
    /** AI confidence score (0-1) */
    confidence: number;
    /** Explanation of type detection reasoning (debug mode) */
    reasoning?: string;
    /** Alternative type suggestions with confidence scores */
    alternatives?: Array<{
        type: string;
        confidence: number;
    }>;
    /** Timestamp when fields were computed */
    computedAt: number;
    /** Version of augmentation that computed these fields */
    version: string;
}
/**
 * Cache entry for computed display fields
 */
export interface DisplayCacheEntry {
    fields: ComputedDisplayFields;
    lastAccessed: number;
    accessCount: number;
}
/**
 * Field computation context passed to computation functions
 */
export interface FieldComputationContext {
    /** The original data object */
    data: any;
    /** Metadata associated with the object */
    metadata: any;
    /** Type detection result from AI */
    typeResult?: TypeMatchResult;
    /** Display configuration */
    config: DisplayConfig;
    /** Whether this is a noun or verb */
    entityType: 'noun' | 'verb';
    /** For verbs: source and target information */
    verbContext?: {
        sourceId: string;
        targetId: string;
        verbType?: string;
    };
}
/**
 * Type matching result from BrainyTypes
 */
export interface TypeMatchResult {
    type: string;
    confidence: number;
    reasoning: string;
    alternatives: Array<{
        type: string;
        confidence: number;
    }>;
}
/**
 * Enhanced VectorDocument with display capabilities
 */
export interface EnhancedVectorDocument<T = any> extends VectorDocument<T> {
    /**
     * Get computed display field(s)
     * @param field Optional specific field name
     * @returns Single field value or all display fields
     */
    getDisplay(): Promise<ComputedDisplayFields>;
    getDisplay(field: keyof ComputedDisplayFields): Promise<any>;
    /**
     * Get available fields for a specific augmentation namespace
     * @param namespace The augmentation namespace (e.g., 'display')
     * @returns Array of available field names
     */
    getAvailableFields(namespace: string): string[];
    /**
     * Get available augmentation namespaces
     * @returns Array of available augmentation names
     */
    getAvailableAugmentations(): string[];
    /**
     * Debug exploration of all computed fields
     */
    explore(): Promise<void>;
}
/**
 * Enhanced GraphVerb with display capabilities
 */
export interface EnhancedGraphVerb extends GraphVerb {
    /**
     * Get computed display field(s) for relationships
     * @param field Optional specific field name
     * @returns Single field value or all display fields
     */
    getDisplay(): Promise<ComputedDisplayFields>;
    getDisplay(field: keyof ComputedDisplayFields): Promise<any>;
    /**
     * Get available fields for a specific augmentation namespace
     * @param namespace The augmentation namespace (e.g., 'display')
     * @returns Array of available field names
     */
    getAvailableFields(namespace: string): string[];
}
/**
 * Batch computation request for performance optimization
 */
export interface BatchComputationRequest {
    id: string;
    data: any;
    metadata: any;
    entityType: 'noun' | 'verb';
    verbContext?: {
        sourceId: string;
        targetId: string;
        verbType?: string;
    };
}
/**
 * Batch computation result
 */
export interface BatchComputationResult {
    id: string;
    fields: ComputedDisplayFields;
    error?: string;
}
/**
 * Field pattern for intelligent field detection
 */
export interface FieldPattern {
    /** Field names that match this pattern */
    fields: string[];
    /** Target display field name */
    displayField: keyof ComputedDisplayFields;
    /** Confidence score for this pattern match */
    confidence: number;
    /** Optional: specific noun/verb types this applies to */
    applicableTypes?: string[];
    /** Optional: transformation function for the field value */
    transform?: (value: any, context: FieldComputationContext) => string;
}
/**
 * Statistics for the display augmentation
 */
export interface DisplayAugmentationStats {
    /** Total number of computations performed */
    totalComputations: number;
    /** Cache hit ratio */
    cacheHitRatio: number;
    /** Average computation time in milliseconds */
    averageComputationTime: number;
    /** Type detection accuracy (when ground truth available) */
    typeDetectionAccuracy?: number;
    /** Most commonly detected types */
    commonTypes: Array<{
        type: string;
        count: number;
        percentage: number;
    }>;
    /** Performance metrics */
    performance: {
        fastestComputation: number;
        slowestComputation: number;
        totalComputationTime: number;
    };
}
