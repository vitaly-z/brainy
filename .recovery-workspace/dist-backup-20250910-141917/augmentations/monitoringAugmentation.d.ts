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
export interface MonitoringConfig {
    enabled?: boolean;
    healthCheckInterval?: number;
    metricsInterval?: number;
    trackLatency?: boolean;
    trackErrors?: boolean;
    trackCacheMetrics?: boolean;
    exposeHealthEndpoint?: boolean;
}
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
export declare class MonitoringAugmentation extends BaseAugmentation {
    readonly metadata: "readonly";
    readonly name = "monitoring";
    readonly timing: "after";
    operations: ("search" | "find" | "similar" | "add" | "update" | "delete" | "relate" | "unrelate" | "all")[];
    readonly priority = 30;
    private healthMonitor;
    private configManager;
    protected config: MonitoringConfig;
    private requestStartTimes;
    constructor(config?: MonitoringConfig);
    protected onInitialize(): Promise<void>;
    protected onShutdown(): Promise<void>;
    /**
     * Execute augmentation - track health metrics
     */
    execute<T = any>(operation: string, params: any, next: () => Promise<T>): Promise<T>;
    /**
     * Get health status
     */
    getHealthStatus(): {
        status: string;
        enabled: boolean;
        uptime: number;
        vectorCount: number;
        requestRate: number;
        errorRate: number;
        cacheHitRate: number;
    } | {
        status: string;
        enabled: boolean;
        uptime?: undefined;
        vectorCount?: undefined;
        requestRate?: undefined;
        errorRate?: undefined;
        cacheHitRate?: undefined;
    };
    /**
     * Get health endpoint data (for API exposure)
     */
    getHealthEndpointData(): Record<string, any>;
    /**
     * Update vector count manually
     */
    updateVectorCount(count: number): void;
    /**
     * Record custom health metric
     */
    recordCustomMetric(name: string, value: number): void;
    /**
     * Check if system is healthy
     */
    isHealthy(): boolean;
    /**
     * Get uptime in milliseconds
     */
    getUptime(): number;
    /**
     * Force health check
     */
    checkHealth(): Promise<boolean>;
}
/**
 * Factory function for zero-config monitoring augmentation
 */
export declare function createMonitoringAugmentation(config?: MonitoringConfig): MonitoringAugmentation;
