/**
 * Rate Limiter for Brainy API
 *
 * Provides rate limiting without external dependencies like Redis.
 * - Uses in-memory storage for single instances
 * - Can use S3/R2 for distributed rate limiting
 *
 * @module rateLimiter
 */
/**
 * Simple in-memory rate limiter
 */
export class RateLimiter {
    constructor(config) {
        this.config = config;
        this.requests = new Map();
        this.cleanupInterval = null;
        // Start cleanup interval to remove expired entries
        this.startCleanup();
    }
    /**
     * Check if a request is allowed and update the rate limit
     */
    async checkLimit(identifier) {
        const now = Date.now();
        if (this.config.distributed && this.config.storage) {
            return this.checkDistributedLimit(identifier, now);
        }
        return this.checkMemoryLimit(identifier, now);
    }
    /**
     * Check rate limit using in-memory storage
     */
    checkMemoryLimit(identifier, now) {
        const entry = this.requests.get(identifier);
        const resetTime = now + this.config.windowMs;
        if (!entry || entry.resetTime <= now) {
            // New window or expired window
            this.requests.set(identifier, {
                count: 1,
                resetTime
            });
            return {
                allowed: true,
                remaining: this.config.maxRequests - 1,
                resetTime,
                limit: this.config.maxRequests
            };
        }
        // Existing window
        if (entry.count < this.config.maxRequests) {
            entry.count++;
            return {
                allowed: true,
                remaining: this.config.maxRequests - entry.count,
                resetTime: entry.resetTime,
                limit: this.config.maxRequests
            };
        }
        // Rate limit exceeded
        return {
            allowed: false,
            remaining: 0,
            resetTime: entry.resetTime,
            limit: this.config.maxRequests
        };
    }
    /**
     * Check rate limit using distributed storage (S3/R2)
     */
    async checkDistributedLimit(identifier, now) {
        const storage = this.config.storage;
        const key = `ratelimit_${identifier}`;
        const resetTime = now + this.config.windowMs;
        try {
            // Try to get existing rate limit data from metadata storage
            const existing = await storage.getMetadata(key);
            if (!existing || !existing.resetTime ||
                Number(existing.resetTime) <= now) {
                // New window or expired window
                await storage.saveMetadata(key, {
                    count: 1,
                    resetTime: resetTime,
                    identifier
                });
                return {
                    allowed: true,
                    remaining: this.config.maxRequests - 1,
                    resetTime,
                    limit: this.config.maxRequests
                };
            }
            const count = Number(existing.count || 0);
            if (count < this.config.maxRequests) {
                // Update count
                await storage.saveMetadata(key, {
                    count: count + 1,
                    resetTime: existing.resetTime,
                    identifier
                });
                return {
                    allowed: true,
                    remaining: this.config.maxRequests - count - 1,
                    resetTime: Number(existing.resetTime),
                    limit: this.config.maxRequests
                };
            }
            // Rate limit exceeded
            return {
                allowed: false,
                remaining: 0,
                resetTime: Number(existing.resetTime),
                limit: this.config.maxRequests
            };
        }
        catch (error) {
            // On error, fail open (allow the request)
            console.warn('Rate limiter error, failing open:', error);
            return {
                allowed: true,
                remaining: this.config.maxRequests,
                resetTime,
                limit: this.config.maxRequests
            };
        }
    }
    /**
     * Reset rate limit for a specific identifier
     */
    async reset(identifier) {
        if (this.config.distributed && this.config.storage) {
            const key = `ratelimit_${identifier}`;
            // Reset by setting count to 0 and expired time
            await this.config.storage.saveMetadata(key, {
                count: 0,
                resetTime: 0,
                identifier
            });
        }
        else {
            this.requests.delete(identifier);
        }
    }
    /**
     * Start cleanup interval to remove expired entries
     */
    startCleanup() {
        // Run cleanup every minute
        this.cleanupInterval = setInterval(() => {
            const now = Date.now();
            const expired = [];
            for (const [key, entry] of this.requests) {
                if (entry.resetTime <= now) {
                    expired.push(key);
                }
            }
            for (const key of expired) {
                this.requests.delete(key);
            }
        }, 60000); // 1 minute
        // Don't keep Node.js process alive just for cleanup
        if (this.cleanupInterval.unref) {
            this.cleanupInterval.unref();
        }
    }
    /**
     * Stop the rate limiter and cleanup
     */
    destroy() {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
            this.cleanupInterval = null;
        }
        this.requests.clear();
    }
}
/**
 * Express/Connect middleware for rate limiting
 */
export function rateLimitMiddleware(config) {
    const limiter = new RateLimiter(config);
    return async (req, res, next) => {
        // Use IP address as identifier (can be customized)
        const identifier = req.ip || req.connection?.remoteAddress || 'unknown';
        const result = await limiter.checkLimit(identifier);
        // Set rate limit headers
        res.setHeader('X-RateLimit-Limit', result.limit);
        res.setHeader('X-RateLimit-Remaining', result.remaining);
        res.setHeader('X-RateLimit-Reset', result.resetTime);
        if (!result.allowed) {
            res.status(429).json({
                error: config.message || 'Too many requests, please try again later.',
                retryAfter: Math.ceil((result.resetTime - Date.now()) / 1000)
            });
            return;
        }
        next();
    };
}
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
export function createRateLimiter(config) {
    return new RateLimiter(config);
}
/**
 * Preset configurations for common use cases
 */
export const RateLimitPresets = {
    /**
     * Default API rate limit: 100 requests per 15 minutes
     */
    default: {
        maxRequests: 100,
        windowMs: 15 * 60 * 1000
    },
    /**
     * Strict rate limit: 10 requests per minute
     */
    strict: {
        maxRequests: 10,
        windowMs: 60 * 1000
    },
    /**
     * Lenient rate limit: 1000 requests per hour
     */
    lenient: {
        maxRequests: 1000,
        windowMs: 60 * 60 * 1000
    },
    /**
     * Search endpoint: 30 requests per minute
     */
    search: {
        maxRequests: 30,
        windowMs: 60 * 1000,
        message: 'Search rate limit exceeded. Please wait before searching again.'
    },
    /**
     * Write operations: 20 requests per minute
     */
    write: {
        maxRequests: 20,
        windowMs: 60 * 1000,
        message: 'Write rate limit exceeded. Please slow down your write operations.'
    }
};
//# sourceMappingURL=rateLimiter.js.map