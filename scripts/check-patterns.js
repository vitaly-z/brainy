#!/usr/bin/env node

/**
 * Check if neural patterns need rebuilding
 * Only rebuild if:
 * 1. embeddedPatterns.ts doesn't exist
 * 2. Pattern library source has changed
 */

const fs = require('fs');
const path = require('path');

const EMBEDDED_FILE = path.join(__dirname, '../src/neural/embeddedPatterns.ts');
const PATTERN_LIBRARY = path.join(__dirname, '../src/neural/patternLibrary.ts');

// Check if embedded patterns exist
if (!fs.existsSync(EMBEDDED_FILE)) {
  console.log('❌ Embedded patterns not found. Building...');
  process.exit(1); // Signal need to rebuild
}

// Check if pattern library is newer than embedded patterns
const embeddedStats = fs.statSync(EMBEDDED_FILE);
const libraryStats = fs.statSync(PATTERN_LIBRARY);

if (libraryStats.mtime > embeddedStats.mtime) {
  console.log('🔄 Pattern library has changed. Rebuilding...');
  process.exit(1); // Signal need to rebuild
}

console.log('✅ Embedded patterns are up-to-date. Skipping rebuild.');
process.exit(0); // No rebuild needed