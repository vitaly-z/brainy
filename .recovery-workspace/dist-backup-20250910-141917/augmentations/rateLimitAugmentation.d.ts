/**
 * Rate Limiting Augmentation
 * Provides configurable rate limiting for Brainy operations
 */
import { BaseAugmentation } from './brainyAugmentation.js';
import { AugmentationManifest } from './manifest.js';
export interface RateLimitConfig {
    enabled?: boolean;
    limits?: {
        searches?: number;
        writes?: number;
        reads?: number;
        deletes?: number;
    };
    windowMs?: number;
    skipSuccessfulRequests?: boolean;
    skipFailedRequests?: boolean;
    keyGenerator?: (context: any) => string;
}
/**
 * Rate Limit Augmentation
 */
export declare class RateLimitAugmentation extends BaseAugmentation {
    readonly name = "rateLimiter";
    readonly timing: "before";
    readonly metadata: "none";
    operations: any;
    readonly priority = 10;
    readonly category: "core";
    readonly description = "Provides rate limiting for Brainy operations";
    private limiters;
    private windowMs;
    constructor(config?: RateLimitConfig);
    getManifest(): AugmentationManifest;
    /**
     * Initialize rate limiters for each operation type
     */
    private initializeLimiters;
    /**
     * Default key generator (could be IP, user ID, etc.)
     */
    private defaultKeyGenerator;
    /**
     * Check if request should be rate limited
     */
    private checkRateLimit;
    /**
     * Get remaining requests for an operation
     */
    private getRemainingRequests;
    /**
     * Get time until reset
     */
    private getResetTime;
    protected onInitialize(): Promise<void>;
    protected onShutdown(): Promise<void>;
    /**
     * Execute augmentation - apply rate limiting
     */
    execute<T = any>(operation: string, params: any, next: () => Promise<T>): Promise<T>;
    /**
     * Get rate limit statistics
     */
    getStats(): {
        operations: Record<string, {
            activeKeys: number;
            totalRequests: number;
        }>;
    };
    /**
     * Clear all rate limit entries
     */
    clear(): void;
    /**
     * Clear expired entries (cleanup)
     */
    cleanup(): void;
}
/**
 * Create rate limit augmentation
 */
export declare function createRateLimitAugmentation(config?: RateLimitConfig): RateLimitAugmentation;
