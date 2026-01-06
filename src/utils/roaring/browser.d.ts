/**
 * Type declarations for roaring-wasm browser bundle
 * Re-exports types from the main roaring-wasm package
 */
declare module 'roaring-wasm/browser/index.mjs' {
  export {
    RoaringBitmap32,
    RoaringBitmap32Iterator,
    roaringLibraryInitialize,
    roaringLibraryIsReady,
    SerializationFormat,
    DeserializationFormat
  } from 'roaring-wasm'
}
