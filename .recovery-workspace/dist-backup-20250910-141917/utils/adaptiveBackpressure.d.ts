/**
 * Adaptive Backpressure System
 * Automatically manages request flow and prevents system overload
 * Self-healing with pattern learning for optimal throughput
 */
interface BackpressureMetrics {
    queueDepth: number;
    processingRate: number;
    errorRate: number;
    latency: number;
    throughput: number;
}
interface BackpressureConfig {
    maxQueueDepth: number;
    targetLatency: number;
    minThroughput: number;
    adaptationRate: number;
}
/**
 * Self-healing backpressure manager that learns from load patterns
 */
export declare class AdaptiveBackpressure {
    private logger;
    private queue;
    private activeOperations;
    private maxConcurrent;
    private metrics;
    private config;
    private patterns;
    private circuitState;
    private circuitOpenTime;
    private circuitFailures;
    private circuitThreshold;
    private circuitTimeout;
    private operationTimes;
    private completedOps;
    private errorOps;
    private lastAdaptation;
    /**
     * Request permission to proceed with an operation
     */
    requestPermission(operationId: string, priority?: number): Promise<void>;
    /**
     * Release permission after operation completes
     */
    releasePermission(operationId: string, success?: boolean): void;
    /**
     * Check if circuit breaker is open
     */
    private isCircuitOpen;
    /**
     * Open the circuit breaker
     */
    private openCircuit;
    /**
     * Close the circuit breaker
     */
    private closeCircuit;
    /**
     * Adapt configuration based on metrics
     */
    private adaptIfNeeded;
    /**
     * Update current metrics
     */
    private updateMetrics;
    /**
     * Learn from current load patterns
     */
    private learnPattern;
    /**
     * Calculate optimal concurrency based on Little's Law
     */
    private calculateOptimalConcurrency;
    /**
     * Adapt configuration based on metrics and patterns
     */
    private adaptConfiguration;
    /**
     * Predict future load based on patterns
     */
    predictLoad(futureSeconds?: number): number;
    /**
     * Get current configuration and metrics
     */
    getStatus(): {
        config: BackpressureConfig;
        metrics: BackpressureMetrics;
        circuit: string;
        maxConcurrent: number;
        activeOps: number;
        queueLength: number;
    };
    /**
     * Reset to default state
     */
    reset(): void;
}
/**
 * Get the global backpressure instance
 */
export declare function getGlobalBackpressure(): AdaptiveBackpressure;
export {};
