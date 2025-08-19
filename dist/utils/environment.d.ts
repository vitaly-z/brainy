/**
 * Utility functions for environment detection
 */
/**
 * Check if code is running in a browser environment
 */
export declare function isBrowser(): boolean;
/**
 * Check if code is running in a Node.js environment
 */
export declare function isNode(): boolean;
/**
 * Check if code is running in a Web Worker environment
 */
export declare function isWebWorker(): boolean;
/**
 * Check if Web Workers are available in the current environment
 */
export declare function areWebWorkersAvailable(): boolean;
/**
 * Check if Worker Threads are available in the current environment (Node.js)
 */
export declare function areWorkerThreadsAvailable(): Promise<boolean>;
/**
 * Synchronous version that doesn't actually try to load the module
 * This is safer in ES module environments
 */
export declare function areWorkerThreadsAvailableSync(): boolean;
/**
 * Determine if threading is available in the current environment
 * Returns true if either Web Workers (browser) or Worker Threads (Node.js) are available
 */
export declare function isThreadingAvailable(): boolean;
/**
 * Async version of isThreadingAvailable
 */
export declare function isThreadingAvailableAsync(): Promise<boolean>;
/**
 * Auto-detect production environment to minimize logging costs
 */
export declare function isProductionEnvironment(): boolean;
/**
 * Get appropriate log level based on environment
 */
export declare function getLogLevel(): 'silent' | 'error' | 'warn' | 'info' | 'verbose';
/**
 * Check if logging should be enabled for a given level
 */
export declare function shouldLog(level: 'error' | 'warn' | 'info' | 'verbose'): boolean;
