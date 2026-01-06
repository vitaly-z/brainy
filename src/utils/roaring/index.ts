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
  RoaringBitmap32,
  RoaringBitmap32Iterator,
  roaringLibraryInitialize,
  roaringLibraryIsReady,
  SerializationFormat,
  DeserializationFormat
} from 'roaring-wasm/browser/index.mjs'

// Initialize WASM at module load time (top-level await)
// This ensures RoaringBitmap32 is ready to use immediately after import
await roaringLibraryInitialize()

// Re-export all types and values
export {
  RoaringBitmap32,
  RoaringBitmap32Iterator,
  roaringLibraryInitialize,
  roaringLibraryIsReady,
  SerializationFormat,
  DeserializationFormat
}
