/**
 * Utility functions for executing functions in Worker Threads (Node.js) or Web Workers (Browser)
 * This implementation leverages Node.js 24's improved Worker Threads API for better performance
 */
/**
 * Execute a function in a separate thread
 *
 * @param fnString The function to execute as a string
 * @param args The arguments to pass to the function
 * @returns A promise that resolves with the result of the function
 */
export declare function executeInThread<T>(fnString: string, args: any): Promise<T>;
/**
 * Clean up all worker pools
 * This should be called when the application is shutting down
 */
export declare function cleanupWorkerPools(): void;
