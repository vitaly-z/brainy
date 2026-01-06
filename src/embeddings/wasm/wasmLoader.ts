/**
 * Universal WASM Loader for Candle Embeddings
 *
 * Provides a single async function that loads WASM bytes correctly
 * in ALL JavaScript environments:
 *
 * | Environment    | Method                              |
 * |----------------|-------------------------------------|
 * | Node.js        | fs.readFileSync()                   |
 * | Bun            | Bun.file()                          |
 * | Bun --compile  | Bun.file() with embedded asset      |
 * | Browser        | fetch()                             |
 *
 * For Bun --compile, the WASM file is embedded in the binary using
 * the `import ... with { type: 'file' }` syntax. This is detected
 * by Bun's bundler during compilation.
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
// Bun Asset Embedding
// =============================================================================

// For Bun --compile: This dynamic import with { type: 'file' } tells Bun's
// bundler to embed the WASM file in the compiled binary. The path is static
// so Bun can analyze it at build time.
//
// In non-Bun environments, this import fails (caught and ignored).
// In Bun runtime without compile, this also works (returns filesystem path).

let embeddedWasmPath: string | undefined

if (isBun) {
  try {
    // @ts-expect-error - Bun-specific import attribute not recognized by TypeScript
    const wasmModule = await import('./pkg/candle_embeddings_bg.wasm', { with: { type: 'file' } })
    embeddedWasmPath = wasmModule.default
  } catch {
    // Bun runtime without bundler support - fall through to filesystem
    embeddedWasmPath = undefined
  }
}

// =============================================================================
// Public API
// =============================================================================

/**
 * Load WASM bytes from the appropriate source for the current environment.
 *
 * This function is the ONLY way WASM should be loaded in this codebase.
 * It handles all environment differences internally.
 *
 * @returns ArrayBuffer containing the WASM module bytes
 * @throws Error if WASM cannot be loaded
 */
export async function loadWasmBytes(): Promise<ArrayBuffer> {
  // Bun (runtime or compiled binary)
  if (isBun) {
    const wasmPath = embeddedWasmPath ?? await resolveWasmPath()
    return Bun!.file(wasmPath).arrayBuffer()
  }

  // Node.js
  if (isNode) {
    const wasmPath = await resolveWasmPath()
    const fs = await import('node:fs')

    if (!fs.existsSync(wasmPath)) {
      throw new Error(
        `WASM file not found: ${wasmPath}\n` +
        `Run 'npm run build:candle' to build the WASM module.`
      )
    }

    const buffer = fs.readFileSync(wasmPath)
    // Convert Node.js Buffer to ArrayBuffer
    return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength)
  }

  // Browser
  const wasmUrl = new URL('./pkg/candle_embeddings_bg.wasm', import.meta.url)
  const response = await fetch(wasmUrl)

  if (!response.ok) {
    throw new Error(`Failed to fetch WASM: ${response.status} ${response.statusText}`)
  }

  return response.arrayBuffer()
}

/**
 * Check if running in a Bun compiled binary with embedded WASM.
 * Useful for debugging and verification.
 */
export function isWasmEmbedded(): boolean {
  return embeddedWasmPath !== undefined
}

// =============================================================================
// Internal Helpers
// =============================================================================

/**
 * Resolve the filesystem path to the WASM file.
 * Used by Node.js and Bun runtime (non-compiled).
 */
async function resolveWasmPath(): Promise<string> {
  const nodePath = await import('node:path')
  const { fileURLToPath } = await import('node:url')

  const thisDir = nodePath.dirname(fileURLToPath(import.meta.url))
  return nodePath.join(thisDir, 'pkg', 'candle_embeddings_bg.wasm')
}
