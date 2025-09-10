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
export async function createBrowserBrainy(config = {}) {
    // Brainy already has environment detection and will automatically:
    // - Use OPFS storage in browsers with fallback to Memory
    // - Use FileSystem storage in Node.js
    // - Request persistent storage when appropriate
    const browserConfig = {
        storage: {
            type: 'opfs',
            options: {
                requestPersistentStorage: true
            }
        },
        ...config
    };
    const brainyData = new Brainy(browserConfig);
    await brainyData.init();
    return brainyData;
}
// Re-export core types and classes for browser use
export { VerbType, NounType, Brainy };
// Default export for easy importing
export default createBrowserBrainy;
//# sourceMappingURL=browserFramework.minimal.js.map