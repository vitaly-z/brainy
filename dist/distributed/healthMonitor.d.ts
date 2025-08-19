/**
 * Health Monitor
 * Monitors and reports instance health in distributed deployments
 */
import { DistributedConfigManager } from './configManager.js';
export interface HealthMetrics {
    vectorCount: number;
    cacheHitRate: number;
    memoryUsage: number;
    cpuUsage?: number;
    requestsPerSecond?: number;
    averageLatency?: number;
    errorRate?: number;
}
export interface HealthStatus {
    status: 'healthy' | 'degraded' | 'unhealthy';
    instanceId: string;
    role: string;
    uptime: number;
    lastCheck: string;
    metrics: HealthMetrics;
    warnings?: string[];
    errors?: string[];
}
export declare class HealthMonitor {
    private configManager;
    private startTime;
    private requestCount;
    private errorCount;
    private totalLatency;
    private cacheHits;
    private cacheMisses;
    private vectorCount;
    private checkInterval;
    private healthCheckTimer?;
    private metricsWindow;
    private latencyWindow;
    private windowSize;
    constructor(configManager: DistributedConfigManager);
    /**
     * Start health monitoring
     */
    start(): void;
    /**
     * Stop health monitoring
     */
    stop(): void;
    /**
     * Update health status and metrics
     */
    private updateHealth;
    /**
     * Collect current metrics
     */
    private collectMetrics;
    /**
     * Calculate cache hit rate
     */
    private calculateCacheHitRate;
    /**
     * Calculate requests per second
     */
    private calculateRPS;
    /**
     * Calculate average latency
     */
    private calculateAverageLatency;
    /**
     * Calculate error rate
     */
    private calculateErrorRate;
    /**
     * Get CPU usage (simplified)
     */
    private getCPUUsage;
    /**
     * Clean old entries from sliding windows
     */
    private cleanWindows;
    /**
     * Record a request
     * @param latency - Request latency in milliseconds
     * @param error - Whether the request resulted in an error
     */
    recordRequest(latency: number, error?: boolean): void;
    /**
     * Record cache access
     * @param hit - Whether it was a cache hit
     */
    recordCacheAccess(hit: boolean): void;
    /**
     * Update vector count
     * @param count - New vector count
     */
    updateVectorCount(count: number): void;
    /**
     * Get current health status
     * @returns Health status object
     */
    getHealthStatus(): HealthStatus;
    /**
     * Get health check endpoint data
     * @returns JSON-serializable health data
     */
    getHealthEndpointData(): Record<string, any>;
    /**
     * Reset metrics (useful for testing)
     */
    resetMetrics(): void;
}
