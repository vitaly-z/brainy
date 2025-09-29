#!/usr/bin/env node

/**
 * Brainy CLI Wrapper
 *
 * Imports the compiled TypeScript CLI from dist/cli/index.js
 * This ensures TypeScript features work correctly
 */

import('../dist/cli/index.js').catch((error) => {
  console.error('Failed to load Brainy CLI:', error.message)
  console.error('Make sure you have built the project: npm run build')
  process.exit(1)
})