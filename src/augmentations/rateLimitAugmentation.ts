/**
 * Rate Limiting Augmentation
 * Provides configurable rate limiting for Brainy operations
 */

import { BaseAugmentation } from './brainyAugmentation.js'
import { AugmentationManifest } from './manifest.js'

export interface RateLimitConfig {
  enabled?: boolean
  limits?: {
    searches?: number      // Per minute
    writes?: number        // Per minute
    reads?: number         // Per minute
    deletes?: number       // Per minute
  }
  windowMs?: number        // Time window in milliseconds
  skipSuccessfulRequests?: boolean
  skipFailedRequests?: boolean
  keyGenerator?: (context: any) => string
}

interface RateLimitEntry {
  count: number
  resetTime: number
}

/**
 * Rate Limit Augmentation
 */
export class RateLimitAugmentation extends BaseAugmentation {
  readonly name = 'rateLimiter'
  readonly timing = 'before' as const
  readonly metadata = 'none' as const
  operations = ['search', 'find', 'add', 'update', 'delete', 'get'] as any
  readonly priority = 10 // High priority, runs early
  
  // Augmentation metadata
  readonly category = 'core' as const  // Use 'core' as security isn't a valid category
  readonly description = 'Provides rate limiting for Brainy operations'
  
  private limiters: Map<string, Map<string, RateLimitEntry>> = new Map()
  private windowMs: number
  
  constructor(config: RateLimitConfig = {}) {
    super(config)
    
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
    }
    
    this.windowMs = this.config.windowMs!
    
    // Initialize operation limiters
    this.initializeLimiters()
  }

  getManifest(): AugmentationManifest {
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
    }
  }

  /**
   * Initialize rate limiters for each operation type
   */
  private initializeLimiters(): void {
    const operations = ['searches', 'writes', 'reads', 'deletes']
    for (const op of operations) {
      this.limiters.set(op, new Map())
    }
  }

  /**
   * Default key generator (could be IP, user ID, etc.)
   */
  private defaultKeyGenerator(_context: any): string {
    // In a real implementation, this would extract IP or user ID
    return 'default'
  }

  /**
   * Check if request should be rate limited
   */
  private checkRateLimit(operation: string, key: string): boolean {
    const limiter = this.limiters.get(operation)
    if (!limiter) return false
    
    const limit = (this.config.limits as any)[operation]
    if (!limit) return false
    
    const now = Date.now()
    let entry = limiter.get(key)
    
    // Initialize or reset entry
    if (!entry || now >= entry.resetTime) {
      entry = {
        count: 0,
        resetTime: now + this.windowMs
      }
      limiter.set(key, entry)
    }
    
    // Check if limit exceeded
    if (entry.count >= limit) {
      return true // Rate limited
    }
    
    // Increment counter
    entry.count++
    return false
  }

  /**
   * Get remaining requests for an operation
   */
  private getRemainingRequests(operation: string, key: string): number {
    const limiter = this.limiters.get(operation)
    if (!limiter) return -1
    
    const limit = (this.config.limits as any)[operation]
    if (!limit) return -1
    
    const entry = limiter.get(key)
    if (!entry) return limit
    
    const now = Date.now()
    if (now >= entry.resetTime) return limit
    
    return Math.max(0, limit - entry.count)
  }

  /**
   * Get time until reset
   */
  private getResetTime(operation: string, key: string): number {
    const limiter = this.limiters.get(operation)
    if (!limiter) return 0
    
    const entry = limiter.get(key)
    if (!entry) return 0
    
    const now = Date.now()
    return Math.max(0, entry.resetTime - now)
  }

  protected async onInitialize(): Promise<void> {
    if (!this.config.enabled) {
      this.log('Rate limiter disabled by configuration')
      return
    }
    
    this.log(`Rate limiter initialized (window: ${this.windowMs}ms)`)
    
    // Start cleanup timer
    setInterval(() => {
      this.cleanup()
    }, this.windowMs)
  }

  protected async onShutdown(): Promise<void> {
    this.clear()
    this.log('Rate limiter shut down')
  }

  /**
   * Execute augmentation - apply rate limiting
   */
  async execute<T = any>(
    operation: string,
    params: any,
    next: () => Promise<T>
  ): Promise<T> {
    // If rate limiting is disabled, just pass through
    if (!this.config.enabled) {
      return next()
    }

    // Map operations to rate limit categories
    let rateLimitOperation: string
    switch (operation) {
      case 'search':
      case 'find':
      case 'similar':
        rateLimitOperation = 'searches'
        break
      case 'add':
      case 'update':
        rateLimitOperation = 'writes'
        break
      case 'delete':
        rateLimitOperation = 'deletes'
        break
      case 'get':
        rateLimitOperation = 'reads'
        break
      default:
        return next() // Don't rate limit unknown operations
    }

    const key = (this.config.keyGenerator as any)(params)
    
    if (this.checkRateLimit(rateLimitOperation, key)) {
      const error = new Error(`Rate limit exceeded for ${operation}`)
      ;(error as any).statusCode = 429
      ;(error as any).retryAfter = this.getResetTime(rateLimitOperation, key)
      ;(error as any).rateLimit = {
        limit: (this.config.limits as any)[rateLimitOperation],
        remaining: 0,
        reset: Date.now() + this.getResetTime(rateLimitOperation, key)
      }
      throw error
    }
    
    try {
      const result = await next()
      
      // Add rate limit info to result if possible
      if (result && typeof result === 'object' && !Array.isArray(result)) {
        (result as any)._rateLimit = {
          limit: (this.config.limits as any)[rateLimitOperation],
          remaining: this.getRemainingRequests(rateLimitOperation, key),
          reset: Date.now() + this.getResetTime(rateLimitOperation, key)
        }
      }
      
      return result
    } catch (error) {
      // Optionally don't count failed requests
      if (this.config.skipFailedRequests) {
        const limiter = this.limiters.get(rateLimitOperation)!
        const entry = limiter.get(key)
        if (entry && entry.count > 0) entry.count--
      }
      throw error
    }
  }

  /**
   * Get rate limit statistics
   */
  getStats(): {
    operations: Record<string, {
      activeKeys: number
      totalRequests: number
    }>
  } {
    const stats: any = { operations: {} }
    
    for (const [operation, limiter] of this.limiters) {
      let totalRequests = 0
      for (const entry of limiter.values()) {
        totalRequests += entry.count
      }
      
      stats.operations[operation] = {
        activeKeys: limiter.size,
        totalRequests
      }
    }
    
    return stats
  }

  /**
   * Clear all rate limit entries
   */
  clear(): void {
    for (const limiter of this.limiters.values()) {
      limiter.clear()
    }
  }

  /**
   * Clear expired entries (cleanup)
   */
  cleanup(): void {
    const now = Date.now()
    
    for (const limiter of this.limiters.values()) {
      for (const [key, entry] of limiter) {
        if (now >= entry.resetTime) {
          limiter.delete(key)
        }
      }
    }
  }
}

/**
 * Create rate limit augmentation
 */
export function createRateLimitAugmentation(config?: RateLimitConfig): RateLimitAugmentation {
  return new RateLimitAugmentation(config)
}