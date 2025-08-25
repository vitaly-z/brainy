#!/usr/bin/env node

/**
 * Modern TypeScript CLI Runner
 * 
 * This is the entry point after npm install @soulcraft/brainy
 * It runs the compiled TypeScript CLI code
 */

// Use the compiled TypeScript CLI
import('../dist/cli/index.js').catch(err => {
  // Fallback to legacy CLI if new one isn't built yet
  import('./brainy.js').catch(() => {
    console.error('Error: CLI not properly built. Please reinstall the package.')
    console.error(err)
    process.exit(1)
  })
})