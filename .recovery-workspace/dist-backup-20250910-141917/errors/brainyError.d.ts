/**
 * Custom error types for Brainy operations
 * Provides better error classification and handling
 */
export type BrainyErrorType = 'TIMEOUT' | 'NETWORK' | 'STORAGE' | 'NOT_FOUND' | 'RETRY_EXHAUSTED' | 'VALIDATION';
/**
 * Custom error class for Brainy operations
 * Provides error type classification and retry information
 */
export declare class BrainyError extends Error {
    readonly type: BrainyErrorType;
    readonly retryable: boolean;
    readonly originalError?: Error;
    readonly attemptNumber?: number;
    readonly maxRetries?: number;
    constructor(message: string, type: BrainyErrorType, retryable?: boolean, originalError?: Error, attemptNumber?: number, maxRetries?: number);
    /**
     * Create a timeout error
     */
    static timeout(operation: string, timeoutMs: number, originalError?: Error): BrainyError;
    /**
     * Create a network error
     */
    static network(message: string, originalError?: Error): BrainyError;
    /**
     * Create a storage error
     */
    static storage(message: string, originalError?: Error): BrainyError;
    /**
     * Create a not found error
     */
    static notFound(resource: string): BrainyError;
    /**
     * Create a retry exhausted error
     */
    static retryExhausted(operation: string, maxRetries: number, lastError?: Error): BrainyError;
    /**
     * Create a validation error
     */
    static validation(parameter: string, constraint: string, value?: any): BrainyError;
    /**
     * Check if an error is retryable
     */
    static isRetryable(error: Error): boolean;
    /**
     * Convert a generic error to a BrainyError with appropriate classification
     */
    static fromError(error: Error, operation?: string): BrainyError;
}
