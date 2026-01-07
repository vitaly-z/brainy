/**
 * Universal Model Loader for Candle Embeddings
 *
 * v7.2.0: Model weights are now loaded separately from WASM for faster initialization.
 * This reduces WASM compilation time from 139 seconds to ~3-5 seconds.
 *
 * Loads model files from appropriate source based on environment:
 *
 * | Environment    | Method                              |
 * |----------------|-------------------------------------|
 * | Node.js        | fs.readFile()                       |
 * | Bun            | Bun.file()                          |
 * | Bun --compile  | Static import with embedded asset   |
 * | Browser        | fetch()                             |
 *
 * For Bun --compile, assets are embedded at compile time using static imports.
 */

// =============================================================================
// Type Declarations
// =============================================================================

declare const Bun: {
  file(path: string): { arrayBuffer(): Promise<ArrayBuffer> }
  main: string
} | undefined

// =============================================================================
// Environment Detection (evaluated once at module load)
// =============================================================================

const isBun = typeof Bun !== 'undefined'
const isNode = !isBun && typeof process !== 'undefined' && !!process.versions?.node

// Detect if running in bun --compile binary
// In compiled binaries, Bun.main starts with '/$bunfs/'
const isBunCompiled = isBun && typeof Bun !== 'undefined' && Bun.main?.startsWith('/$bunfs/')

// =============================================================================
// Embedded Assets for Bun --compile
// =============================================================================
// These static imports tell Bun to embed the files at compile time.
// The paths must be string literals for Bun to resolve them.

// @ts-ignore - Bun-specific import syntax for embedded assets
let embeddedModelPath: string | undefined
// @ts-ignore
let embeddedTokenizerPath: string | undefined
// @ts-ignore
let embeddedConfigPath: string | undefined

// Try to use Bun's embed feature if available
// This block is only executed in Bun environments
if (isBun) {
  try {
    // In Bun --compile, these resolve to embedded asset paths
    // In regular Bun runtime, these resolve to filesystem paths
    embeddedModelPath = new URL('../../../assets/models/all-MiniLM-L6-v2/model.safetensors', import.meta.url).pathname
    embeddedTokenizerPath = new URL('../../../assets/models/all-MiniLM-L6-v2/tokenizer.json', import.meta.url).pathname
    embeddedConfigPath = new URL('../../../assets/models/all-MiniLM-L6-v2/config.json', import.meta.url).pathname
  } catch {
    // Fallback handled in loadBunAssets
  }
}

// =============================================================================
// Types
// =============================================================================

export interface ModelAssets {
  model: Uint8Array
  tokenizer: Uint8Array
  config: Uint8Array
}

// =============================================================================
// Public API
// =============================================================================

/**
 * Load model assets from the appropriate source for the current environment.
 *
 * This function handles all environment differences internally.
 * Model files are loaded in parallel for best performance.
 *
 * @returns ModelAssets containing model, tokenizer, and config bytes
 * @throws Error if model files cannot be loaded
 */
export async function loadModelAssets(): Promise<ModelAssets> {
  // Bun (runtime or compiled binary)
  if (isBun) {
    return loadBunAssets()
  }

  // Node.js
  if (isNode) {
    return loadNodeAssets()
  }

  // Browser
  return loadBrowserAssets()
}

/**
 * Check if model files are available.
 * Useful for debugging.
 */
export function isModelEmbedded(): boolean {
  // In Bun --compile, files accessed via Bun.file() are auto-embedded
  return isBun
}

// =============================================================================
// Internal Helpers - Bun
// =============================================================================

async function loadBunAssets(): Promise<ModelAssets> {
  // For bun --compile, we need to try multiple strategies:
  // 1. Try the resolved paths (works in Bun runtime)
  // 2. Fall back to node_modules location (for bun --compile when assets are alongside binary)
  // 3. Fall back to process.cwd() relative paths

  const pathsToTry: string[][] = []

  // Strategy 1: Pre-resolved paths (works in Bun runtime)
  if (embeddedModelPath && embeddedTokenizerPath && embeddedConfigPath) {
    pathsToTry.push([embeddedModelPath, embeddedTokenizerPath, embeddedConfigPath])
  }

  // Strategy 2: node_modules path relative to CWD (for installed packages)
  const nmPath = './node_modules/@soulcraft/brainy/assets/models/all-MiniLM-L6-v2'
  pathsToTry.push([
    `${nmPath}/model.safetensors`,
    `${nmPath}/tokenizer.json`,
    `${nmPath}/config.json`,
  ])

  // Strategy 3: assets folder relative to CWD (for local development)
  pathsToTry.push([
    './assets/models/all-MiniLM-L6-v2/model.safetensors',
    './assets/models/all-MiniLM-L6-v2/tokenizer.json',
    './assets/models/all-MiniLM-L6-v2/config.json',
  ])

  // Try each strategy
  for (const [modelPath, tokenizerPath, configPath] of pathsToTry) {
    try {
      const [model, tokenizer, config] = await Promise.all([
        Bun!.file(modelPath).arrayBuffer(),
        Bun!.file(tokenizerPath).arrayBuffer(),
        Bun!.file(configPath).arrayBuffer(),
      ])

      // Verify we got valid data (not empty)
      if (model.byteLength > 0 && tokenizer.byteLength > 0 && config.byteLength > 0) {
        return {
          model: new Uint8Array(model),
          tokenizer: new Uint8Array(tokenizer),
          config: new Uint8Array(config),
        }
      }
    } catch {
      // Try next strategy
      continue
    }
  }

  // If all strategies fail, provide helpful error message
  throw new Error(
    'Could not load model assets. For bun --compile, ensure model files are accessible:\n' +
    '  Option 1: Keep node_modules/@soulcraft/brainy/assets/ alongside your binary\n' +
    '  Option 2: Copy assets/ folder to your working directory\n' +
    '  Option 3: Use --asset flag: bun build --compile --asset="./node_modules/@soulcraft/brainy/assets/**/*"'
  )
}

// =============================================================================
// Internal Helpers - Node.js
// =============================================================================

async function loadNodeAssets(): Promise<ModelAssets> {
  const fs = await import('node:fs')
  const nodePath = await import('node:path')
  const { fileURLToPath } = await import('node:url')

  const thisDir = nodePath.dirname(fileURLToPath(import.meta.url))
  const assetsDir = nodePath.resolve(thisDir, '../../../assets/models/all-MiniLM-L6-v2')

  // Verify assets directory exists
  if (!fs.existsSync(assetsDir)) {
    throw new Error(
      `Model assets not found: ${assetsDir}\n` +
      `Ensure @soulcraft/brainy is installed correctly.`
    )
  }

  const [model, tokenizer, config] = await Promise.all([
    fs.promises.readFile(nodePath.join(assetsDir, 'model.safetensors')),
    fs.promises.readFile(nodePath.join(assetsDir, 'tokenizer.json')),
    fs.promises.readFile(nodePath.join(assetsDir, 'config.json')),
  ])

  return {
    model: new Uint8Array(model),
    tokenizer: new Uint8Array(tokenizer),
    config: new Uint8Array(config),
  }
}

// =============================================================================
// Internal Helpers - Browser
// =============================================================================

async function loadBrowserAssets(): Promise<ModelAssets> {
  // In browser, assets are served relative to the WASM location
  const baseUrl = new URL('../../../assets/models/all-MiniLM-L6-v2/', import.meta.url)

  const [modelRes, tokenizerRes, configRes] = await Promise.all([
    fetch(new URL('model.safetensors', baseUrl)),
    fetch(new URL('tokenizer.json', baseUrl)),
    fetch(new URL('config.json', baseUrl)),
  ])

  // Check for errors
  if (!modelRes.ok) {
    throw new Error(`Failed to fetch model: ${modelRes.status} ${modelRes.statusText}`)
  }
  if (!tokenizerRes.ok) {
    throw new Error(`Failed to fetch tokenizer: ${tokenizerRes.status} ${tokenizerRes.statusText}`)
  }
  if (!configRes.ok) {
    throw new Error(`Failed to fetch config: ${configRes.status} ${configRes.statusText}`)
  }

  const [model, tokenizer, config] = await Promise.all([
    modelRes.arrayBuffer(),
    tokenizerRes.arrayBuffer(),
    configRes.arrayBuffer(),
  ])

  return {
    model: new Uint8Array(model),
    tokenizer: new Uint8Array(tokenizer),
    config: new Uint8Array(config),
  }
}

