/**
 * Minimal Browser Framework Entry Point for Brainy
 * Core MIT open source functionality only - no enterprise features
 * Optimized for browser usage with all dependencies bundled
 */
import { Brainy } from './brainy.js';
import { VerbType, NounType } from './types/graphTypes.js';
/**
 * Create a Brainy instance optimized for browser usage
 * Auto-detects environment and selects optimal storage and settings
 */
export declare function createBrowserBrainy(config?: {}): Promise<any>;
export { VerbType, NounType, Brainy };
export default createBrowserBrainy;
