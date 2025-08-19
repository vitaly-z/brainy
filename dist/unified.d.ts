/**
 * Unified entry point for Brainy
 * This file exports everything from index.ts
 * Environment detection is handled here and made available to all components
 */
import './setup.js';
export declare const environment: {
    readonly isBrowser: boolean;
    readonly isNode: boolean;
    readonly isServerless: boolean;
    isWebWorker: () => boolean;
    readonly isThreadingAvailable: boolean;
    isThreadingAvailableAsync: () => Promise<boolean>;
    areWorkerThreadsAvailable: () => Promise<boolean>;
};
export * from './index.js';
export { applyTensorFlowPatch } from './utils/textEncoding.js';
