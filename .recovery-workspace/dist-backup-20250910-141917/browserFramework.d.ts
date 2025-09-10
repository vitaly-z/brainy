/**
 * Browser Framework Entry Point for Brainy
 * Optimized for modern frameworks like Angular, React, Vue, etc.
 * Auto-detects environment and uses optimal storage (OPFS in browsers)
 */
import { Brainy, BrainyConfig } from './brainy.js';
import { VerbType, NounType } from './types/graphTypes.js';
/**
 * Create a Brainy instance optimized for browser frameworks
 * Auto-detects environment and selects optimal storage and settings
 */
export declare function createBrowserBrainy(config?: Partial<BrainyConfig>): Promise<Brainy>;
export { VerbType, NounType, Brainy };
export type { BrainyConfig };
export default createBrowserBrainy;
