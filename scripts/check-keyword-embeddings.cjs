/**
 * Check if keyword embeddings need to be rebuilt
 * Exits with code 1 if rebuild needed, 0 if up-to-date
 */

const fs = require('fs')
const path = require('path')

const EMBEDDED_FILE = 'src/neural/embeddedKeywordEmbeddings.ts'
const BUILD_SCRIPT = 'scripts/buildKeywordEmbeddings.ts'

const embeddedPath = path.join(process.cwd(), EMBEDDED_FILE)
const buildScriptPath = path.join(process.cwd(), BUILD_SCRIPT)

// Check if embedded file exists
if (!fs.existsSync(embeddedPath)) {
  console.log('⚠️  Keyword embeddings file not found. Build required.')
  process.exit(1)
}

// Check if build script is newer than embedded file
const embeddedStat = fs.statSync(embeddedPath)
const buildScriptStat = fs.statSync(buildScriptPath)

if (buildScriptStat.mtime > embeddedStat.mtime) {
  console.log('⚠️  Build script is newer than keyword embeddings. Rebuild required.')
  process.exit(1)
}

console.log('✅ Embedded keyword embeddings are up-to-date. Skipping rebuild.')
process.exit(0)
