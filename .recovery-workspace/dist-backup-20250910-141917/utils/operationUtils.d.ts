/**
 * Utility functions for timeout and retry logic
 * Used by storage adapters to handle network operations reliably
 */
export interface TimeoutConfig {
    get?: number;
    add?: number;
    delete?: number;
}
export interface RetryConfig {
    maxRetries?: number;
    initialDelay?: number;
    maxDelay?: number;
    backoffMultiplier?: number;
}
export interface OperationConfig {
    timeouts?: TimeoutConfig;
    retryPolicy?: RetryConfig;
}
export declare const DEFAULT_TIMEOUTS: Required<TimeoutConfig>;
export declare const DEFAULT_RETRY_POLICY: Required<RetryConfig>;
/**
 * Wraps a promise with a timeout
 */
export declare function withTimeout<T>(promise: Promise<T>, timeoutMs: number, operation: string): Promise<T>;
/**
 * Executes an operation with retry logic and exponential backoff
 */
export declare function withRetry<T>(operation: () => Promise<T>, operationName: string, config?: RetryConfig): Promise<T>;
/**
 * Executes an operation with both timeout and retry logic
 */
export declare function withTimeoutAndRetry<T>(operation: () => Promise<T>, operationName: string, timeoutMs: number, retryConfig?: RetryConfig): Promise<T>;
/**
 * Creates a configured operation executor for a specific operation type
 */
export declare function createOperationExecutor(operationType: keyof TimeoutConfig, config?: OperationConfig): <T>(operation: () => Promise<T>, operationName: string) => Promise<T>;
/**
 * Storage operation executors for different operation types
 */
export declare class StorageOperationExecutors {
    private getExecutor;
    private addExecutor;
    private deleteExecutor;
    constructor(config?: OperationConfig);
    /**
     * Execute a get operation with timeout and retry
     */
    executeGet<T>(operation: () => Promise<T>, operationName: string): Promise<T>;
    /**
     * Execute an add operation with timeout and retry
     */
    executeAdd<T>(operation: () => Promise<T>, operationName: string): Promise<T>;
    /**
     * Execute a delete operation with timeout and retry
     */
    executeDelete<T>(operation: () => Promise<T>, operationName: string): Promise<T>;
}
