/**
 * Utility functions for timeout and retry logic
 * Used by storage adapters to handle network operations reliably
 */
import { BrainyError } from '../errors/brainyError.js';
// Default configuration values
export const DEFAULT_TIMEOUTS = {
    get: 30000, // 30 seconds
    add: 60000, // 1 minute
    delete: 30000 // 30 seconds
};
export const DEFAULT_RETRY_POLICY = {
    maxRetries: 3,
    initialDelay: 1000,
    maxDelay: 10000,
    backoffMultiplier: 2
};
/**
 * Wraps a promise with a timeout
 */
export function withTimeout(promise, timeoutMs, operation) {
    return new Promise((resolve, reject) => {
        const timeoutId = setTimeout(() => {
            reject(BrainyError.timeout(operation, timeoutMs));
        }, timeoutMs);
        promise
            .then((result) => {
            clearTimeout(timeoutId);
            resolve(result);
        })
            .catch((error) => {
            clearTimeout(timeoutId);
            reject(error);
        });
    });
}
/**
 * Calculates the delay for exponential backoff
 */
function calculateBackoffDelay(attemptNumber, initialDelay, maxDelay, backoffMultiplier) {
    const delay = initialDelay * Math.pow(backoffMultiplier, attemptNumber - 1);
    return Math.min(delay, maxDelay);
}
/**
 * Sleeps for the specified number of milliseconds
 */
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
/**
 * Executes an operation with retry logic and exponential backoff
 */
export async function withRetry(operation, operationName, config = {}) {
    const { maxRetries = DEFAULT_RETRY_POLICY.maxRetries, initialDelay = DEFAULT_RETRY_POLICY.initialDelay, maxDelay = DEFAULT_RETRY_POLICY.maxDelay, backoffMultiplier = DEFAULT_RETRY_POLICY.backoffMultiplier } = config;
    let lastError;
    for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
        try {
            return await operation();
        }
        catch (error) {
            lastError = error instanceof Error ? error : new Error(String(error));
            // If this is the last attempt, don't retry
            if (attempt > maxRetries) {
                break;
            }
            // Check if the error is retryable
            if (!BrainyError.isRetryable(lastError)) {
                throw BrainyError.fromError(lastError, operationName);
            }
            // Calculate delay for exponential backoff
            const delay = calculateBackoffDelay(attempt, initialDelay, maxDelay, backoffMultiplier);
            console.warn(`Operation '${operationName}' failed on attempt ${attempt}/${maxRetries + 1}. ` +
                `Retrying in ${delay}ms. Error: ${lastError.message}`);
            // Wait before retrying
            await sleep(delay);
        }
    }
    // All retries exhausted
    throw BrainyError.retryExhausted(operationName, maxRetries, lastError);
}
/**
 * Executes an operation with both timeout and retry logic
 */
export async function withTimeoutAndRetry(operation, operationName, timeoutMs, retryConfig = {}) {
    return withRetry(() => withTimeout(operation(), timeoutMs, operationName), operationName, retryConfig);
}
/**
 * Creates a configured operation executor for a specific operation type
 */
export function createOperationExecutor(operationType, config = {}) {
    const timeouts = { ...DEFAULT_TIMEOUTS, ...config.timeouts };
    const retryPolicy = { ...DEFAULT_RETRY_POLICY, ...config.retryPolicy };
    const timeoutMs = timeouts[operationType];
    return async function executeOperation(operation, operationName) {
        return withTimeoutAndRetry(operation, operationName, timeoutMs, retryPolicy);
    };
}
/**
 * Storage operation executors for different operation types
 */
export class StorageOperationExecutors {
    constructor(config = {}) {
        this.getExecutor = createOperationExecutor('get', config);
        this.addExecutor = createOperationExecutor('add', config);
        this.deleteExecutor = createOperationExecutor('delete', config);
    }
    /**
     * Execute a get operation with timeout and retry
     */
    async executeGet(operation, operationName) {
        return this.getExecutor(operation, operationName);
    }
    /**
     * Execute an add operation with timeout and retry
     */
    async executeAdd(operation, operationName) {
        return this.addExecutor(operation, operationName);
    }
    /**
     * Execute a delete operation with timeout and retry
     */
    async executeDelete(operation, operationName) {
        return this.deleteExecutor(operation, operationName);
    }
}
//# sourceMappingURL=operationUtils.js.map