/**
 * Intelligent Type Mapper
 * Maps generic/invalid type names to specific semantic types based on data analysis
 * Prevents semantic degradation from overuse of generic types
 */
/**
 * Intelligent Type Mapper
 */
export declare class IntelligentTypeMapper {
    private typeCache;
    private inferenceStats;
    /**
     * Map a noun type, with intelligent inference for generic types
     */
    mapNounType(inputType: string, data?: any): string;
    /**
     * Map a verb type
     */
    mapVerbType(inputType: string): string;
    /**
     * Infer type from data structure
     */
    private inferTypeFromData;
    /**
     * Get direct mapping for common aliases
     */
    private getDirectMapping;
    /**
     * Check if a type is valid
     */
    private isValidNounType;
    /**
     * Check if a verb type is valid
     */
    private isValidVerbType;
    /**
     * Get inference statistics
     */
    getStats(): {
        cacheSize: number;
        inferenceRate: number;
        total: number;
        inferred: number;
        defaulted: number;
        cached: number;
    };
    /**
     * Clear the type cache
     */
    clearCache(): void;
}
export declare const typeMapper: IntelligentTypeMapper;
/**
 * Helper function for easy type mapping
 */
export declare function mapNounType(inputType: string, data?: any): string;
/**
 * Helper function for verb mapping
 */
export declare function mapVerbType(inputType: string): string;
