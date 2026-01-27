/**
 * Brainy Setup - Minimal Polyfills
 *
 * ARCHITECTURE:
 * Brainy uses Candle WASM (Rust-based) for embeddings.
 * No transformers.js or ONNX Runtime dependency, no hacks required.
 *
 * This file provides minimal polyfills for cross-environment compatibility:
 * - TextEncoder/TextDecoder for older environments
 *
 * BENEFITS:
 * - Clean codebase with no workarounds
 * - Works everywhere: Node.js, Bun, Bun --compile, browsers, Deno
 * - No platform-specific binaries
 * - Model bundled in package (no runtime downloads)
 */

// ============================================================================
// TextEncoder/TextDecoder Polyfills
// ============================================================================
const globalObj = globalThis ?? global ?? self

if (globalObj) {
  if (!globalObj.TextEncoder) globalObj.TextEncoder = TextEncoder
  if (!globalObj.TextDecoder) globalObj.TextDecoder = TextDecoder
  ;(globalObj as any).__TextEncoder__ = TextEncoder
  ;(globalObj as any).__TextDecoder__ = TextDecoder
}

import { applyTensorFlowPatch } from './utils/textEncoding.js'
applyTensorFlowPatch()
