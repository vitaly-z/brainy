#!/usr/bin/env node

/**
 * Check if type embeddings need rebuilding
 * Only rebuild if:
 * 1. embeddedTypeEmbeddings.ts doesn't exist
 * 2. Type definitions have changed
 * 3. Build script has changed
 */

const fs = require('fs');
const path = require('path');

const EMBEDDED_FILE = path.join(__dirname, '../src/neural/embeddedTypeEmbeddings.ts');
const BUILD_SCRIPT = path.join(__dirname, 'buildTypeEmbeddings.ts');
const GRAPH_TYPES = path.join(__dirname, '../src/types/graphTypes.ts');

// Check if embedded type embeddings exist
if (!fs.existsSync(EMBEDDED_FILE)) {
  console.log('❌ Embedded type embeddings not found. Building...');
  process.exit(1); // Signal need to rebuild
}

// Check if build script is newer than embedded embeddings
const embeddedStats = fs.statSync(EMBEDDED_FILE);
const buildScriptStats = fs.statSync(BUILD_SCRIPT);

if (buildScriptStats.mtime > embeddedStats.mtime) {
  console.log('🔄 Build script has changed. Rebuilding type embeddings...');
  process.exit(1); // Signal need to rebuild
}

// Check if type definitions are newer than embedded embeddings
if (fs.existsSync(GRAPH_TYPES)) {
  const graphTypesStats = fs.statSync(GRAPH_TYPES);
  if (graphTypesStats.mtime > embeddedStats.mtime) {
    console.log('🔄 Type definitions have changed. Rebuilding type embeddings...');
    process.exit(1); // Signal need to rebuild
  }
}

console.log('✅ Embedded type embeddings are up-to-date. Skipping rebuild.');
process.exit(0); // No rebuild needed
