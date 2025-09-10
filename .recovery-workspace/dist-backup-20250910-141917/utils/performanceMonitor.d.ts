/**
 * Performance Monitor
 * Automatically tracks and optimizes system performance
 * Provides real-time insights and auto-tuning recommendations
 */
interface PerformanceMetrics {
    totalOperations: number;
    successfulOperations: number;
    failedOperations: number;
    averageLatency: number;
    p95Latency: number;
    p99Latency: number;
    operationsPerSecond: number;
    bytesPerSecond: number;
    memoryUsage: number;
    cpuUsage: number;
    socketUtilization: number;
    queueDepth: number;
    errorRate: number;
    healthScore: number;
}
interface PerformanceTrend {
    metric: string;
    direction: 'improving' | 'degrading' | 'stable';
    changeRate: number;
    prediction: number;
}
/**
 * Comprehensive performance monitoring and optimization
 */
export declare class PerformanceMonitor {
    private logger;
    private metrics;
    private history;
    private maxHistorySize;
    private operationLatencies;
    private operationSizes;
    private lastReset;
    private resetInterval;
    private lastCpuUsage;
    private lastCpuCheck;
    private thresholds;
    private recommendations;
    private autoOptimizeEnabled;
    private lastOptimization;
    private optimizationInterval;
    /**
     * Track an operation completion
     */
    trackOperation(success: boolean, latency: number, bytes?: number): void;
    /**
     * Update all metrics
     */
    private updateMetrics;
    /**
     * Update resource metrics
     */
    private updateResourceMetrics;
    /**
     * Calculate overall health score
     */
    private calculateHealthScore;
    /**
     * Check for alert conditions
     */
    private checkAlerts;
    /**
     * Auto-optimize system based on metrics
     */
    private autoOptimize;
    /**
     * Analyze performance trends
     */
    private analyzeTrends;
    /**
     * Reset counters
     */
    private resetCounters;
    /**
     * Get current metrics
     */
    getMetrics(): Readonly<PerformanceMetrics>;
    /**
     * Get performance trends
     */
    getTrends(): PerformanceTrend[];
    /**
     * Get recommendations
     */
    getRecommendations(): string[];
    /**
     * Get performance report
     */
    getReport(): {
        metrics: PerformanceMetrics;
        trends: PerformanceTrend[];
        recommendations: string[];
        socketConfig: any;
        backpressureStatus: any;
    };
    /**
     * Enable/disable auto-optimization
     */
    setAutoOptimize(enabled: boolean): void;
    /**
     * Reset all metrics and history
     */
    reset(): void;
}
/**
 * Get the global performance monitor instance
 */
export declare function getGlobalPerformanceMonitor(): PerformanceMonitor;
export {};
