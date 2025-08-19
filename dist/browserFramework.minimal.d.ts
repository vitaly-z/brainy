/**
 * Minimal Browser Framework Entry Point for Brainy
 * Core MIT open source functionality only - no enterprise features
 * Optimized for browser usage with all dependencies bundled
 */
import { BrainyData } from './brainyData.js';
import { VerbType, NounType } from './types/graphTypes.js';
/**
 * Create a BrainyData instance optimized for browser usage
 * Auto-detects environment and selects optimal storage and settings
 */
export declare function createBrowserBrainyData(config?: {}): Promise<BrainyData<any>>;
export { VerbType, NounType, BrainyData };
export default createBrowserBrainyData;
