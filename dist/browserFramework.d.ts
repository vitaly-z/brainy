/**
 * Browser Framework Entry Point for Brainy
 * Optimized for modern frameworks like Angular, React, Vue, etc.
 * Auto-detects environment and uses optimal storage (OPFS in browsers)
 */
import { BrainyData, BrainyDataConfig } from './brainyData.js';
import { VerbType, NounType } from './types/graphTypes.js';
/**
 * Create a BrainyData instance optimized for browser frameworks
 * Auto-detects environment and selects optimal storage and settings
 */
export declare function createBrowserBrainyData(config?: Partial<BrainyDataConfig>): Promise<BrainyData>;
export { VerbType, NounType, BrainyData };
export type { BrainyDataConfig };
export default createBrowserBrainyData;
