/**
 * Rate Limiter for Brainy API
 *
 * Provides rate limiting without external dependencies like Redis.
 * - Uses in-memory storage for single instances
 * - Can use S3/R2 for distributed rate limiting
 *
 * @module rateLimiter
 */
import { BaseStorageAdapter } from '../storage/adapters/baseStorageAdapter.js';
export interface RateLimitConfig {
    /**
     * Maximum number of requests allowed
     */
    maxRequests: number;
    /**
     * Time window in milliseconds
     */
    windowMs: number;
    /**
     * Optional message to return when rate limit is exceeded
     */
    message?: string;
    /**
     * Whether to use distributed storage (S3/R2) for rate limiting
     */
    distributed?: boolean;
    /**
     * Storage adapter for distributed rate limiting
     */
    storage?: BaseStorageAdapter;
    /**
     * Key prefix for distributed storage
     */
    keyPrefix?: string;
}
export interface RateLimitResult {
    /**
     * Whether the request is allowed
     */
    allowed: boolean;
    /**
     * Number of requests remaining in the current window
     */
    remaining: number;
    /**
     * Time when the rate limit window resets (Unix timestamp)
     */
    resetTime: number;
    /**
     * Total limit for the window
     */
    limit: number;
}
/**
 * Simple in-memory rate limiter
 */
export declare class RateLimiter {
    private config;
    private requests;
    private cleanupInterval;
    constructor(config: RateLimitConfig);
    /**
     * Check if a request is allowed and update the rate limit
     */
    checkLimit(identifier: string): Promise<RateLimitResult>;
    /**
     * Check rate limit using in-memory storage
     */
    private checkMemoryLimit;
    /**
     * Check rate limit using distributed storage (S3/R2)
     */
    private checkDistributedLimit;
    /**
     * Reset rate limit for a specific identifier
     */
    reset(identifier: string): Promise<void>;
    /**
     * Start cleanup interval to remove expired entries
     */
    private startCleanup;
    /**
     * Stop the rate limiter and cleanup
     */
    destroy(): void;
}
/**
 * Express/Connect middleware for rate limiting
 */
export declare function rateLimitMiddleware(config: RateLimitConfig): (req: any, res: any, next: any) => Promise<void>;
/**
 * Create a rate limiter for use with Brainy
 *
 * @example
 * ```typescript
 * // For single instance (in-memory)
 * const limiter = createRateLimiter({
 *   maxRequests: 100,
 *   windowMs: 15 * 60 * 1000 // 15 minutes
 * })
 *
 * // For distributed (using S3/R2)
 * const limiter = createRateLimiter({
 *   maxRequests: 100,
 *   windowMs: 15 * 60 * 1000,
 *   distributed: true,
 *   storage: myS3Adapter
 * })
 *
 * // Check rate limit
 * const result = await limiter.checkLimit('user-123')
 * if (!result.allowed) {
 *   throw new Error('Rate limit exceeded')
 * }
 * ```
 */
export declare function createRateLimiter(config: RateLimitConfig): RateLimiter;
/**
 * Preset configurations for common use cases
 */
export declare const RateLimitPresets: {
    /**
     * Default API rate limit: 100 requests per 15 minutes
     */
    default: {
        maxRequests: number;
        windowMs: number;
    };
    /**
     * Strict rate limit: 10 requests per minute
     */
    strict: {
        maxRequests: number;
        windowMs: number;
    };
    /**
     * Lenient rate limit: 1000 requests per hour
     */
    lenient: {
        maxRequests: number;
        windowMs: number;
    };
    /**
     * Search endpoint: 30 requests per minute
     */
    search: {
        maxRequests: number;
        windowMs: number;
        message: string;
    };
    /**
     * Write operations: 20 requests per minute
     */
    write: {
        maxRequests: number;
        windowMs: number;
        message: string;
    };
};
