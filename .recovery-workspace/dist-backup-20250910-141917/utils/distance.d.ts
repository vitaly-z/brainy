/**
 * Distance functions for vector similarity calculations
 * Optimized pure JavaScript implementations using enhanced array methods
 * Faster than GPU for small vectors (384 dims) due to no transfer overhead
 */
import { DistanceFunction, Vector } from '../coreTypes.js';
/**
 * Calculates the Euclidean distance between two vectors
 * Lower values indicate higher similarity
 * Optimized using array methods for Node.js 23.11+
 */
export declare const euclideanDistance: DistanceFunction;
/**
 * Calculates the cosine distance between two vectors
 * Lower values indicate higher similarity
 * Range: 0 (identical) to 2 (opposite)
 * Optimized using array methods for Node.js 23.11+
 */
export declare const cosineDistance: DistanceFunction;
/**
 * Calculates the Manhattan (L1) distance between two vectors
 * Lower values indicate higher similarity
 * Optimized using array methods for Node.js 23.11+
 */
export declare const manhattanDistance: DistanceFunction;
/**
 * Calculates the dot product similarity between two vectors
 * Higher values indicate higher similarity
 * Converted to a distance metric (lower is better)
 * Optimized using array methods for Node.js 23.11+
 */
export declare const dotProductDistance: DistanceFunction;
/**
 * Batch distance calculation using optimized JavaScript
 * More efficient than GPU for small vectors due to no memory transfer overhead
 *
 * @param queryVector The query vector to compare against all vectors
 * @param vectors Array of vectors to compare against
 * @param distanceFunction The distance function to use
 * @returns Promise resolving to array of distances
 */
export declare function calculateDistancesBatch(queryVector: Vector, vectors: Vector[], distanceFunction?: DistanceFunction): Promise<number[]>;
