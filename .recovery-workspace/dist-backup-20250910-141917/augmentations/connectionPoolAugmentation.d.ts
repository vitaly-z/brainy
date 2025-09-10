/**
 * Connection Pool Augmentation
 *
 * Provides 10-20x throughput improvement for cloud storage (S3, R2, GCS)
 * Manages connection pooling, request queuing, and parallel processing
 * Critical for enterprise-scale operations with millions of entries
 */
import { BaseAugmentation } from './brainyAugmentation.js';
interface ConnectionPoolConfig {
    enabled?: boolean;
    maxConnections?: number;
    minConnections?: number;
    acquireTimeout?: number;
    idleTimeout?: number;
    maxQueueSize?: number;
    retryAttempts?: number;
    healthCheckInterval?: number;
}
export declare class ConnectionPoolAugmentation extends BaseAugmentation {
    name: string;
    timing: "around";
    metadata: "none";
    operations: ("storage")[];
    priority: number;
    protected config: Required<ConnectionPoolConfig>;
    private connections;
    private requestQueue;
    private healthCheckInterval?;
    private storageType;
    private stats;
    constructor(config?: ConnectionPoolConfig);
    protected onInitialize(): Promise<void>;
    shouldExecute(operation: string, params: any): boolean;
    execute<T = any>(operation: string, params: any, next: () => Promise<T>): Promise<T>;
    private detectStorageType;
    private isCloudStorage;
    private isStorageOperation;
    private getOperationPriority;
    private executeWithPool;
    private getAvailableConnection;
    private executeWithConnection;
    private queueRequest;
    private processQueue;
    private initializeConnectionPool;
    private createConnection;
    private createStorageConnection;
    private getOrCreateConnection;
    private startHealthChecks;
    private performHealthChecks;
    private startMetricsCollection;
    private updateLatencyMetrics;
    private updateThroughputMetrics;
    /**
     * Get connection pool statistics
     */
    getStats(): typeof this.stats & {
        queueSize: number;
        activeConnections: number;
        totalConnections: number;
        poolUtilization: string;
        storageType: string;
    };
    protected onShutdown(): Promise<void>;
}
export {};
