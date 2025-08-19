/**
 * Type Utilities
 *
 * This module provides utility functions for working with the Brainy type system,
 * particularly for accessing lists of noun and verb types.
 */
/**
 * Returns an array of all available noun types
 *
 * @returns {string[]} Array of all noun type values
 */
export declare function getNounTypes(): string[];
/**
 * Returns an array of all available verb types
 *
 * @returns {string[]} Array of all verb type values
 */
export declare function getVerbTypes(): string[];
/**
 * Returns a map of noun type keys to their string values
 *
 * @returns {Record<string, string>} Map of noun type keys to values
 */
export declare function getNounTypeMap(): Record<string, string>;
/**
 * Returns a map of verb type keys to their string values
 *
 * @returns {Record<string, string>} Map of verb type keys to values
 */
export declare function getVerbTypeMap(): Record<string, string>;
