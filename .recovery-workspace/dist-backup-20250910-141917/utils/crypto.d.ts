/**
 * Cross-platform crypto utilities
 * Provides hashing functions that work in both Node.js and browser environments
 */
/**
 * Simple string hash function that works in all environments
 * Uses djb2 algorithm - fast and good distribution
 * @param str - String to hash
 * @returns Positive integer hash
 */
export declare function hashString(str: string): number;
/**
 * Alternative: FNV-1a hash algorithm
 * Good distribution and fast
 * @param str - String to hash
 * @returns Positive integer hash
 */
export declare function fnv1aHash(str: string): number;
/**
 * Generate a deterministic hash for partitioning
 * Uses the most appropriate algorithm for the environment
 * @param input - Input string to hash
 * @returns Positive integer hash suitable for modulo operations
 */
export declare function getPartitionHash(input: string): number;
