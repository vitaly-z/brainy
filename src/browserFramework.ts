/**
 * Browser Framework Entry Point for Brainy
 * Optimized for modern frameworks like Angular, React, Vue, etc.
 * Auto-detects environment and uses optimal storage (OPFS in browsers)
 */

import { Brainy, BrainyConfig } from './brainy.js'
import { VerbType, NounType } from './types/graphTypes.js'

/**
 * Create a Brainy instance optimized for browser frameworks
 * Auto-detects environment and selects optimal storage and settings
 */
export async function createBrowserBrainy(config: Partial<BrainyConfig> = {}): Promise<Brainy> {
  // Brainy already has environment detection and will automatically:
  // - Use OPFS storage in browsers with fallback to Memory
  // - Use FileSystem storage in Node.js
  // - Request persistent storage when appropriate
  const browserConfig: BrainyConfig = {
    storage: {
      type: 'opfs',
      options: {
        requestPersistentStorage: true // Request persistent storage for better performance
      }
    },
    ...config
  }

  const brainyData = new Brainy(browserConfig)
  await brainyData.init()
  
  return brainyData
}

// Re-export types and constants for framework use
export { VerbType, NounType, Brainy }
export type { BrainyConfig }

// Default export for easy importing
export default createBrowserBrainy