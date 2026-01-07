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
 * | Bun --compile  | Bun.file() with auto-embedded asset |
 * | Browser        | fetch()                             |
 *
 * For Bun --compile, Bun automatically embeds files accessed via Bun.file()
 * when the paths are resolvable at build time.
 */

// =============================================================================
// Type Declarations
// =============================================================================

declare const Bun: {
  file(path: string): { arrayBuffer(): Promise<ArrayBuffer> }
} | undefined

// =============================================================================
// Environment Detection (evaluated once at module load)
// =============================================================================

const isBun = typeof Bun !== 'undefined'
const isNode = !isBun && typeof process !== 'undefined' && !!process.versions?.node

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
  const modelPath = await resolveAssetPath('model.safetensors')
  const tokenizerPath = await resolveAssetPath('tokenizer.json')
  const configPath = await resolveAssetPath('config.json')

  const [model, tokenizer, config] = await Promise.all([
    Bun!.file(modelPath).arrayBuffer(),
    Bun!.file(tokenizerPath).arrayBuffer(),
    Bun!.file(configPath).arrayBuffer(),
  ])

  return {
    model: new Uint8Array(model),
    tokenizer: new Uint8Array(tokenizer),
    config: new Uint8Array(config),
  }
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

// =============================================================================
// Internal Helpers - Path Resolution
// =============================================================================

/**
 * Resolve the filesystem path to a model asset file.
 */
async function resolveAssetPath(filename: string): Promise<string> {
  const nodePath = await import('node:path')
  const { fileURLToPath } = await import('node:url')

  const thisDir = nodePath.dirname(fileURLToPath(import.meta.url))
  return nodePath.join(thisDir, '../../../assets/models/all-MiniLM-L6-v2', filename)
}
