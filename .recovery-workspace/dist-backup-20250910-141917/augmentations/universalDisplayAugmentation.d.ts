/**
 * Universal Display Augmentation
 *
 * 🎨 Provides intelligent display fields for any noun or verb using AI-powered analysis
 *
 * Features:
 * - ✅ Leverages existing BrainyTypes for semantic type detection
 * - ✅ Complete icon coverage for all 31 NounTypes + 40+ VerbTypes
 * - ✅ Zero performance impact with lazy computation and intelligent caching
 * - ✅ Perfect isolation - can be disabled, replaced, or configured
 * - ✅ Clean developer experience with zero conflicts
 * - ✅ TypeScript support with full autocomplete
 *
 * Usage:
 * ```typescript
 * // User data access (unchanged)
 * result.firstName  // "John"
 * result.metadata.title  // "CEO"
 *
 * // Enhanced display (new capabilities)
 * result.getDisplay('title')       // "John Doe" (AI-computed)
 * result.getDisplay('description') // "CEO at Acme Corp" (enhanced)
 * result.getDisplay('type')        // "Person" (from AI detection)
 * result.getDisplay()             // All display fields
 * ```
 */
import { BaseAugmentation, AugmentationContext, MetadataAccess } from './brainyAugmentation.js';
import type { DisplayConfig, DisplayAugmentationStats } from './display/types.js';
/**
 * Universal Display Augmentation
 *
 * Self-contained augmentation that provides intelligent display fields
 * for any data type using existing Brainy AI infrastructure
 */
export declare class UniversalDisplayAugmentation extends BaseAugmentation {
    readonly name = "display";
    readonly version = "1.0.0";
    readonly timing: "after";
    readonly priority = 50;
    readonly metadata: MetadataAccess;
    operations: any;
    readonly category: "core";
    readonly description = "AI-powered intelligent display fields for enhanced data visualization";
    computedFields: {
        display: {
            title: {
                type: "string";
                description: string;
            };
            description: {
                type: "string";
                description: string;
            };
            type: {
                type: "string";
                description: string;
            };
            tags: {
                type: "array";
                description: string;
            };
            relationship: {
                type: "string";
                description: string;
            };
            confidence: {
                type: "number";
                description: string;
            };
        };
    };
    private computationEngine;
    private displayCache;
    private requestDeduplicator;
    protected config: DisplayConfig;
    protected context: AugmentationContext | undefined;
    constructor(config?: Partial<DisplayConfig>);
    /**
     * Initialize the augmentation with AI components
     * @param context Brainy context
     */
    initialize(context: AugmentationContext): Promise<void>;
    /**
     * Execute augmentation - attach display capabilities to results
     * @param operation The operation being performed
     * @param params Operation parameters
     * @param next Function to execute main operation
     * @returns Enhanced result with display capabilities
     */
    execute<T = any>(operation: string, params: any, next: () => Promise<T>): Promise<T>;
    /**
     * Check if operation should be enhanced
     * @param operation Operation name
     * @returns True if should enhance
     */
    private shouldEnhanceOperation;
    /**
     * Enhance result with display capabilities
     * @param result The operation result
     * @param operation The operation type
     * @returns Enhanced result
     */
    private enhanceWithDisplayCapabilities;
    /**
     * Enhance a single entity with display capabilities
     * @param entity The entity to enhance
     * @returns Enhanced entity
     */
    private enhanceEntity;
    /**
     * Create getDisplay method for an entity
     * @param entity The entity
     * @param isVerb Whether it's a verb entity
     * @returns getDisplay function
     */
    private createGetDisplayMethod;
    /**
     * Create getAvailableFields method
     * @returns getAvailableFields function
     */
    private createGetAvailableFieldsMethod;
    /**
     * Create getAvailableAugmentations method
     * @returns getAvailableAugmentations function
     */
    private createGetAvailableAugmentationsMethod;
    /**
     * Create explore method for debugging
     * @param entity The entity
     * @returns explore function
     */
    private createExploreMethod;
    /**
     * Check if an entity is a verb
     * @param entity The entity to check
     * @returns True if it's a verb
     */
    private isVerbEntity;
    /**
     * Get coverage information
     * @returns Coverage info string
     */
    private getCoverageInfo;
    /**
     * Get augmentation statistics
     * @returns Performance and usage statistics
     */
    getStats(): DisplayAugmentationStats;
    /**
     * Configure the augmentation at runtime
     * @param newConfig Partial configuration to merge
     */
    configure(newConfig: Partial<DisplayConfig>): void;
    /**
     * Clear all cached display data
     */
    clearCache(): void;
    /**
     * Precompute display fields for a batch of entities
     * @param entities Array of entities to precompute
     */
    precomputeBatch(entities: Array<{
        id: string;
        data: any;
    }>): Promise<void>;
    /**
     * Optional check if this augmentation should run
     * @param operation Operation name
     * @param params Operation parameters
     * @returns True if should execute
     */
    shouldExecute(operation: string, params: any): boolean;
    /**
     * Cleanup when augmentation is shut down
     */
    shutdown(): Promise<void>;
}
/**
 * Factory function to create display augmentation with default config
 * @param config Optional configuration overrides
 * @returns Configured display augmentation instance
 */
export declare function createDisplayAugmentation(config?: Partial<DisplayConfig>): UniversalDisplayAugmentation;
/**
 * Default configuration for the display augmentation
 */
export declare const DEFAULT_DISPLAY_CONFIG: DisplayConfig;
/**
 * Export for easy import and registration
 */
export default UniversalDisplayAugmentation;
