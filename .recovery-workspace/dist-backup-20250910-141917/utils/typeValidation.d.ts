import { NounType, VerbType } from '../types/graphTypes.js';
export declare function isValidNounType(type: unknown): type is NounType;
export declare function isValidVerbType(type: unknown): type is VerbType;
export declare function validateNounType(type: unknown): NounType;
export declare function validateVerbType(type: unknown): VerbType;
export interface ValidatedGraphNoun {
    noun: NounType;
    [key: string]: any;
}
export interface ValidatedGraphVerb {
    verb: VerbType;
    [key: string]: any;
}
export declare function validateGraphNoun(noun: unknown): ValidatedGraphNoun;
export declare function validateGraphVerb(verb: unknown): ValidatedGraphVerb;
export declare function validateNounTypes(types: unknown[]): NounType[];
export declare function validateVerbTypes(types: unknown[]): VerbType[];
export interface ValidationStats {
    validated: number;
    failed: number;
    inferred: number;
    suggestions: number;
}
export declare function getValidationStats(): ValidationStats;
export declare function resetValidationStats(): void;
export declare class ValidationError extends Error {
    readonly parameter: string;
    readonly value: any;
    readonly constraint: string;
    constructor(parameter: string, value: any, constraint: string);
}
/**
 * Validate required ID parameter
 * Standard validation for all ID-based operations
 */
export declare function validateId(id: unknown, paramName?: string): string;
/**
 * Validate search query input
 * Handles string queries, vectors, and objects for search operations
 */
export declare function validateSearchQuery(query: unknown, paramName?: string): any;
/**
 * Validate data input for addNoun/updateNoun operations
 * Handles vectors, objects, strings, and validates structure
 */
export declare function validateDataInput(data: unknown, paramName?: string, allowNull?: boolean): any;
/**
 * Validate search options
 * Comprehensive validation for search API options
 */
export declare function validateSearchOptions(options: unknown, paramName?: string): any;
/**
 * Validate ID arrays (for bulk operations)
 */
export declare function validateIdArray(ids: unknown, paramName?: string): string[];
/**
 * Track validation stats for monitoring
 */
export declare function recordValidation(success: boolean): void;
