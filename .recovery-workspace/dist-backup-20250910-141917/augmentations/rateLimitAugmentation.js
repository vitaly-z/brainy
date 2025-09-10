/**
 * Rate Limiting Augmentation
 * Provides configurable rate limiting for Brainy operations
 */
import { BaseAugmentation } from './brainyAugmentation.js';
/**
 * Rate Limit Augmentation
 */
export class RateLimitAugmentation extends BaseAugmentation {
    constructor(config = {}) {
        super(config);
        this.name = 'rateLimiter';
        this.timing = 'before';
        this.metadata = 'none';
        this.operations = ['search', 'find', 'add', 'update', 'delete', 'get'];
        this.priority = 10; // High priority, runs early
        // Augmentation metadata
        this.category = 'core'; // Use 'core' as security isn't a valid category
        this.description = 'Provides rate limiting for Brainy operations';
        this.limiters = new Map();
        // Merge with defaults
        this.config = {
            enabled: config.enabled ?? true,
            limits: {
                searches: config.limits?.searches ?? 1000,
                writes: config.limits?.writes ?? 100,
                reads: config.limits?.reads ?? 5000,
                deletes: config.limits?.deletes ?? 50
            },
            windowMs: config.windowMs ?? 60000, // 1 minute default
            skipSuccessfulRequests: config.skipSuccessfulRequests ?? false,
            skipFailedRequests: config.skipFailedRequests ?? true,
            keyGenerator: config.keyGenerator || this.defaultKeyGenerator
        };
        this.windowMs = this.config.windowMs;
        // Initialize operation limiters
        this.initializeLimiters();
    }
    getManifest() {
        return {
            id: 'rate-limiter',
            name: 'Rate Limiter',
            version: '1.0.0',
            description: 'Configurable rate limiting for API operations',
            longDescription: 'Provides per-operation rate limiting with configurable windows and limits. Helps prevent abuse and ensures fair resource usage.',
            category: 'core',
            configSchema: {
                type: 'object',
                properties: {
                    enabled: {
                        type: 'boolean',
                        default: true,
                        description: 'Enable or disable rate limiting'
                    },
                    limits: {
                        type: 'object',
                        properties: {
                            searches: {
                                type: 'number',
                                default: 1000,
                                description: 'Search operations per minute'
                            },
                            writes: {
                                type: 'number',
                                default: 100,
                                description: 'Write operations per minute'
                            },
                            reads: {
                                type: 'number',
                                default: 5000,
                                description: 'Read operations per minute'
                            },
                            deletes: {
                                type: 'number',
                                default: 50,
                                description: 'Delete operations per minute'
                            }
                        }
                    },
                    windowMs: {
                        type: 'number',
                        default: 60000,
                        description: 'Time window in milliseconds'
                    }
                }
            },
            configDefaults: {
                enabled: true,
                limits: {
                    searches: 1000,
                    writes: 100,
                    reads: 5000,
                    deletes: 50
                },
                windowMs: 60000
            },
            minBrainyVersion: '3.0.0',
            keywords: ['rate-limit', 'security', 'throttle'],
            documentation: 'https://docs.brainy.dev/augmentations/rate-limit',
            status: 'stable',
            performance: {
                memoryUsage: 'low',
                cpuUsage: 'low',
                networkUsage: 'none'
            },
            features: ['per-operation-limits', 'configurable-windows', 'key-based-limiting'],
            enhancedOperations: ['search', 'add', 'update', 'delete', 'get'],
            metrics: [
                {
                    name: 'rate_limit_exceeded',
                    type: 'counter',
                    description: 'Number of rate limit violations'
                },
                {
                    name: 'rate_limit_requests',
                    type: 'counter',
                    description: 'Total requests checked'
                }
            ]
        };
    }
    /**
     * Initialize rate limiters for each operation type
     */
    initializeLimiters() {
        const operations = ['searches', 'writes', 'reads', 'deletes'];
        for (const op of operations) {
            this.limiters.set(op, new Map());
        }
    }
    /**
     * Default key generator (could be IP, user ID, etc.)
     */
    defaultKeyGenerator(_context) {
        // In a real implementation, this would extract IP or user ID
        return 'default';
    }
    /**
     * Check if request should be rate limited
     */
    checkRateLimit(operation, key) {
        const limiter = this.limiters.get(operation);
        if (!limiter)
            return false;
        const limit = this.config.limits[operation];
        if (!limit)
            return false;
        const now = Date.now();
        let entry = limiter.get(key);
        // Initialize or reset entry
        if (!entry || now >= entry.resetTime) {
            entry = {
                count: 0,
                resetTime: now + this.windowMs
            };
            limiter.set(key, entry);
        }
        // Check if limit exceeded
        if (entry.count >= limit) {
            return true; // Rate limited
        }
        // Increment counter
        entry.count++;
        return false;
    }
    /**
     * Get remaining requests for an operation
     */
    getRemainingRequests(operation, key) {
        const limiter = this.limiters.get(operation);
        if (!limiter)
            return -1;
        const limit = this.config.limits[operation];
        if (!limit)
            return -1;
        const entry = limiter.get(key);
        if (!entry)
            return limit;
        const now = Date.now();
        if (now >= entry.resetTime)
            return limit;
        return Math.max(0, limit - entry.count);
    }
    /**
     * Get time until reset
     */
    getResetTime(operation, key) {
        const limiter = this.limiters.get(operation);
        if (!limiter)
            return 0;
        const entry = limiter.get(key);
        if (!entry)
            return 0;
        const now = Date.now();
        return Math.max(0, entry.resetTime - now);
    }
    async onInitialize() {
        if (!this.config.enabled) {
            this.log('Rate limiter disabled by configuration');
            return;
        }
        this.log(`Rate limiter initialized (window: ${this.windowMs}ms)`);
        // Start cleanup timer
        setInterval(() => {
            this.cleanup();
        }, this.windowMs);
    }
    async onShutdown() {
        this.clear();
        this.log('Rate limiter shut down');
    }
    /**
     * Execute augmentation - apply rate limiting
     */
    async execute(operation, params, next) {
        // If rate limiting is disabled, just pass through
        if (!this.config.enabled) {
            return next();
        }
        // Map operations to rate limit categories
        let rateLimitOperation;
        switch (operation) {
            case 'search':
            case 'find':
            case 'similar':
                rateLimitOperation = 'searches';
                break;
            case 'add':
            case 'update':
                rateLimitOperation = 'writes';
                break;
            case 'delete':
                rateLimitOperation = 'deletes';
                break;
            case 'get':
                rateLimitOperation = 'reads';
                break;
            default:
                return next(); // Don't rate limit unknown operations
        }
        const key = this.config.keyGenerator(params);
        if (this.checkRateLimit(rateLimitOperation, key)) {
            const error = new Error(`Rate limit exceeded for ${operation}`);
            error.statusCode = 429;
            error.retryAfter = this.getResetTime(rateLimitOperation, key);
            error.rateLimit = {
                limit: this.config.limits[rateLimitOperation],
                remaining: 0,
                reset: Date.now() + this.getResetTime(rateLimitOperation, key)
            };
            throw error;
        }
        try {
            const result = await next();
            // Add rate limit info to result if possible
            if (result && typeof result === 'object' && !Array.isArray(result)) {
                result._rateLimit = {
                    limit: this.config.limits[rateLimitOperation],
                    remaining: this.getRemainingRequests(rateLimitOperation, key),
                    reset: Date.now() + this.getResetTime(rateLimitOperation, key)
                };
            }
            return result;
        }
        catch (error) {
            // Optionally don't count failed requests
            if (this.config.skipFailedRequests) {
                const limiter = this.limiters.get(rateLimitOperation);
                const entry = limiter.get(key);
                if (entry && entry.count > 0)
                    entry.count--;
            }
            throw error;
        }
    }
    /**
     * Get rate limit statistics
     */
    getStats() {
        const stats = { operations: {} };
        for (const [operation, limiter] of this.limiters) {
            let totalRequests = 0;
            for (const entry of limiter.values()) {
                totalRequests += entry.count;
            }
            stats.operations[operation] = {
                activeKeys: limiter.size,
                totalRequests
            };
        }
        return stats;
    }
    /**
     * Clear all rate limit entries
     */
    clear() {
        for (const limiter of this.limiters.values()) {
            limiter.clear();
        }
    }
    /**
     * Clear expired entries (cleanup)
     */
    cleanup() {
        const now = Date.now();
        for (const limiter of this.limiters.values()) {
            for (const [key, entry] of limiter) {
                if (now >= entry.resetTime) {
                    limiter.delete(key);
                }
            }
        }
    }
}
/**
 * Create rate limit augmentation
 */
export function createRateLimitAugmentation(config) {
    return new RateLimitAugmentation(config);
}
//# sourceMappingURL=rateLimitAugmentation.js.map