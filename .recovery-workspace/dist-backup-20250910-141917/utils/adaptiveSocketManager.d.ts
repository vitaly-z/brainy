/**
 * Adaptive Socket Manager
 * Automatically manages socket pools and connection settings based on load patterns
 * Zero-configuration approach that learns and adapts to workload characteristics
 */
import { NodeHttpHandler } from '@smithy/node-http-handler';
interface LoadMetrics {
    requestsPerSecond: number;
    pendingRequests: number;
    socketUtilization: number;
    errorRate: number;
    latencyP50: number;
    latencyP95: number;
    memoryUsage: number;
}
interface AdaptiveConfig {
    maxSockets: number;
    maxFreeSockets: number;
    keepAliveTimeout: number;
    connectionTimeout: number;
    socketTimeout: number;
    batchSize: number;
}
/**
 * Adaptive Socket Manager that automatically scales based on load patterns
 */
export declare class AdaptiveSocketManager {
    private logger;
    private config;
    private metrics;
    private history;
    private maxHistorySize;
    private lastAdaptationTime;
    private adaptationInterval;
    private consecutiveHighLoad;
    private consecutiveLowLoad;
    private requestStartTimes;
    private requestLatencies;
    private errorCount;
    private successCount;
    private lastMetricReset;
    private currentAgent;
    private currentHandler;
    /**
     * Get or create an optimized HTTP handler
     */
    getHttpHandler(): NodeHttpHandler;
    /**
     * Get current batch size recommendation
     */
    getBatchSize(): number;
    /**
     * Track request start
     */
    trackRequestStart(requestId: string): void;
    /**
     * Track request completion
     */
    trackRequestComplete(requestId: string, success: boolean): void;
    /**
     * Check if we should adapt configuration
     */
    private adaptIfNeeded;
    /**
     * Update current metrics
     */
    private updateMetrics;
    /**
     * Analyze metrics and adapt configuration
     */
    private analyzeAndAdapt;
    /**
     * Detect high load conditions
     */
    private detectHighLoad;
    /**
     * Detect low load conditions
     */
    private detectLowLoad;
    /**
     * Scale up resources for high load
     */
    private scaleUp;
    /**
     * Scale down resources for low load
     */
    private scaleDown;
    /**
     * Handle error conditions by adjusting configuration
     */
    private handleErrors;
    /**
     * Check if we should recreate the handler
     */
    private shouldRecreateHandler;
    /**
     * Get current configuration (for monitoring)
     */
    getConfig(): Readonly<AdaptiveConfig>;
    /**
     * Get current metrics (for monitoring)
     */
    getMetrics(): Readonly<LoadMetrics>;
    /**
     * Predict optimal configuration based on historical data
     */
    predictOptimalConfig(): AdaptiveConfig;
    /**
     * Reset to default configuration
     */
    reset(): void;
}
/**
 * Get the global socket manager instance
 */
export declare function getGlobalSocketManager(): AdaptiveSocketManager;
export {};
