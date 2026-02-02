/**
 * Roaring Bitmap wrapper with embedded WASM
 *
 * Always uses the browser bundle which has WASM embedded as base64.
 * This ensures consistent behavior across all environments:
 * - Browser
 * - Node.js
 * - Bun
 * - Bun --compile (single binary)
 *
 * NO filesystem access, NO runtime loading, NO environment-specific code.
 */

import {
  RoaringBitmap32 as WasmRoaringBitmap32,
  RoaringBitmap32Iterator,
  roaringLibraryInitialize,
  roaringLibraryIsReady,
  SerializationFormat,
  DeserializationFormat
} from 'roaring-wasm/browser/index.mjs'

// Initialize WASM at module load time (top-level await)
// This ensures RoaringBitmap32 is ready to use immediately after import
await roaringLibraryInitialize()

// Swappable implementation — defaults to WASM, can be replaced with native CRoaring
// Uses a wrapper class that delegates to the active implementation so that the exported
// RoaringBitmap32 remains a class (usable as both value and type).
let _impl: typeof WasmRoaringBitmap32 = WasmRoaringBitmap32

/**
 * Replace the RoaringBitmap32 implementation at runtime.
 * Called by brainy.ts when a cortex 'roaring' provider is registered.
 */
export function setRoaringImplementation(impl: typeof WasmRoaringBitmap32) {
  _impl = impl
}

/**
 * Get the current RoaringBitmap32 implementation (WASM or native).
 * Use this instead of direct `new RoaringBitmap32()` when constructing bitmaps
 * in hot paths that should benefit from native replacement.
 */
export function getRoaringBitmap32(): typeof WasmRoaringBitmap32 {
  return _impl
}

// Re-export the original WASM class as RoaringBitmap32 for type compatibility
// Consumers use this as both a type (Map<string, RoaringBitmap32>) and value (new RoaringBitmap32())
// The WASM and native implementations are API-compatible
export { WasmRoaringBitmap32 as RoaringBitmap32 }

// Re-export remaining types and values
export {
  RoaringBitmap32Iterator,
  roaringLibraryInitialize,
  roaringLibraryIsReady,
  SerializationFormat,
  DeserializationFormat
}
