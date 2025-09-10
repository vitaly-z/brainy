/**
 * Monitoring Augmentation - Optional Health & Performance Monitoring
 *
 * Replaces the hardcoded HealthMonitor in Brainy with an optional augmentation.
 * Provides health checks, performance monitoring, and distributed system tracking.
 *
 * Zero-config: Automatically enabled for distributed deployments
 * Can be disabled or customized via augmentation registry
 */
import { BaseAugmentation } from './brainyAugmentation.js';
import { HealthMonitor } from '../distributed/healthMonitor.js';
import { DistributedConfigManager as ConfigManager } from '../distributed/configManager.js';
/**
 * MonitoringAugmentation - Makes health monitoring optional and pluggable
 *
 * Features:
 * - Health status tracking
 * - Performance monitoring
 * - Error rate tracking
 * - Distributed system health
 * - Zero-config with smart defaults
 */
export class MonitoringAugmentation extends BaseAugmentation {
    constructor(config = {}) {
        super();
        this.metadata = 'readonly'; // Reads metadata for monitoring
        this.name = 'monitoring';
        this.timing = 'after';
        this.operations = ['search', 'find', 'similar', 'add', 'update', 'delete', 'relate', 'unrelate', 'all'];
        this.priority = 30; // Low priority, observability layer
        this.healthMonitor = null;
        this.configManager = null;
        this.requestStartTimes = new Map();
        this.config = {
            enabled: true,
            healthCheckInterval: 30000, // 30 seconds
            metricsInterval: 60000, // 1 minute
            trackLatency: true,
            trackErrors: true,
            trackCacheMetrics: true,
            exposeHealthEndpoint: true,
            ...config
        };
    }
    async onInitialize() {
        if (!this.config.enabled) {
            this.log('Monitoring augmentation disabled by configuration');
            return;
        }
        // Initialize config manager and health monitor (requires storage)
        if (this.context?.storage) {
            this.configManager = new ConfigManager(this.context.storage);
            this.healthMonitor = new HealthMonitor(this.configManager);
            this.healthMonitor.start();
        }
        else {
            this.log('Storage not available - health monitoring disabled', 'warn');
        }
        this.log('Monitoring augmentation initialized');
    }
    async onShutdown() {
        if (this.healthMonitor) {
            this.healthMonitor.stop();
            this.healthMonitor = null;
        }
        this.configManager = null;
        this.requestStartTimes.clear();
        this.log('Monitoring augmentation shut down');
    }
    /**
     * Execute augmentation - track health metrics
     */
    async execute(operation, params, next) {
        // If monitoring disabled, just pass through
        if (!this.healthMonitor || !this.config.enabled) {
            return next();
        }
        // Generate request ID for tracking
        const requestId = `${operation}-${Date.now()}-${Math.random()}`;
        // Track request start time
        if (this.config.trackLatency) {
            this.requestStartTimes.set(requestId, Date.now());
        }
        try {
            // Execute operation
            const result = await next();
            // Track successful operation
            if (this.config.trackLatency) {
                const startTime = this.requestStartTimes.get(requestId);
                if (startTime) {
                    const latency = Date.now() - startTime;
                    this.healthMonitor.recordRequest(latency, false);
                    this.requestStartTimes.delete(requestId);
                }
            }
            // Update vector count for 'add' operations
            if (operation === 'add' && this.context?.brain) {
                try {
                    const count = await this.context.brain.getNounCount();
                    this.healthMonitor.updateVectorCount(count);
                }
                catch (e) {
                    // Ignore count update errors
                }
            }
            // Track cache metrics for search operations
            if (operation === 'search' && this.config.trackCacheMetrics) {
                // Check if result came from cache (would be set by cache augmentation)
                const fromCache = params._fromCache || false;
                this.healthMonitor.recordCacheAccess(fromCache);
            }
            return result;
        }
        catch (error) {
            // Track error
            if (this.config.trackErrors) {
                const startTime = this.requestStartTimes.get(requestId);
                if (startTime) {
                    const latency = Date.now() - startTime;
                    this.healthMonitor.recordRequest(latency, true);
                    this.requestStartTimes.delete(requestId);
                }
                else {
                    this.healthMonitor.recordRequest(0, true);
                }
            }
            throw error;
        }
    }
    /**
     * Get health status
     */
    getHealthStatus() {
        if (!this.healthMonitor) {
            return {
                status: 'disabled',
                enabled: false,
                uptime: 0,
                vectorCount: 0,
                requestRate: 0,
                errorRate: 0,
                cacheHitRate: 0
            };
        }
        return {
            status: 'healthy',
            enabled: true,
            ...this.healthMonitor.getHealthEndpointData()
        };
    }
    /**
     * Get health endpoint data (for API exposure)
     */
    getHealthEndpointData() {
        if (!this.healthMonitor) {
            return {
                status: 'disabled',
                timestamp: new Date().toISOString()
            };
        }
        return this.healthMonitor.getHealthEndpointData();
    }
    /**
     * Update vector count manually
     */
    updateVectorCount(count) {
        if (this.healthMonitor) {
            this.healthMonitor.updateVectorCount(count);
        }
    }
    /**
     * Record custom health metric
     */
    recordCustomMetric(name, value) {
        if (this.healthMonitor) {
            // Health monitor could be extended to track custom metrics
            this.log(`Custom metric recorded: ${name}=${value}`, 'info');
        }
    }
    /**
     * Check if system is healthy
     */
    isHealthy() {
        if (!this.healthMonitor)
            return true; // If disabled, assume healthy
        const data = this.healthMonitor.getHealthEndpointData();
        // Define health criteria
        const errorRateThreshold = 0.05; // 5% error rate
        const minUptime = 60000; // 1 minute
        return (data.errorRate < errorRateThreshold &&
            data.uptime > minUptime);
    }
    /**
     * Get uptime in milliseconds
     */
    getUptime() {
        if (!this.healthMonitor)
            return 0;
        const data = this.healthMonitor.getHealthEndpointData();
        return data.uptime || 0;
    }
    /**
     * Force health check
     */
    async checkHealth() {
        if (!this.healthMonitor)
            return true;
        // Perform active health check
        try {
            // Could ping storage, check memory, etc.
            if (this.context?.storage) {
                await this.context.storage.getStatistics?.();
            }
            return true;
        }
        catch (error) {
            this.log('Health check failed', 'warn');
            return false;
        }
    }
}
/**
 * Factory function for zero-config monitoring augmentation
 */
export function createMonitoringAugmentation(config) {
    return new MonitoringAugmentation(config);
}
//# sourceMappingURL=monitoringAugmentation.js.map