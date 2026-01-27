/**
 * Binary Data Codec: Single Source of Truth for Wrap/Unwrap Operations
 *
 * This module provides the ONLY implementation of binary data encoding/decoding
 * used across all storage adapters and blob storage.
 *
 * Design Principles:
 * - DRY: One implementation, used everywhere
 * - Single Responsibility: Only handles binary ↔ JSON conversion
 * - Type-Safe: Proper TypeScript types
 * - Defensive: Handles all edge cases
 *
 * Used by:
 * - BaseStorage COW adapter (write/read operations)
 * - BlobStorage (defense-in-depth verification)
 * - All storage adapters (via BaseStorage)
 *
 * @module storage/cow/binaryDataCodec
 */

/**
 * Wrapped binary data format
 * Used when storing binary data in JSON-based storage
 */
export interface WrappedBinaryData {
  _binary: true
  data: string  // base64-encoded
}

/**
 * Check if data is wrapped binary format
 */
export function isWrappedBinary(data: any): data is WrappedBinaryData {
  return (
    typeof data === 'object' &&
    data !== null &&
    data._binary === true &&
    typeof data.data === 'string'
  )
}

/**
 * Unwrap binary data from JSON wrapper
 *
 * This is the SINGLE SOURCE OF TRUTH for unwrapping binary data.
 * All storage operations MUST use this function.
 *
 * Handles:
 * - Buffer → Buffer (pass-through)
 * - {_binary: true, data: "base64..."} → Buffer (unwrap)
 * - Plain object → Buffer (JSON stringify)
 * - Other types → Error
 *
 * @param data - Data to unwrap (may be Buffer, wrapped object, or plain object)
 * @returns Unwrapped Buffer
 * @throws Error if data type is invalid
 */
export function unwrapBinaryData(data: any): Buffer {
  // Case 1: Already a Buffer (no unwrapping needed)
  if (Buffer.isBuffer(data)) {
    return data
  }

  // Case 2: Wrapped binary data {_binary: true, data: "base64..."}
  if (isWrappedBinary(data)) {
    return Buffer.from(data.data, 'base64')
  }

  // Case 3: Plain object (shouldn't happen for binary blobs, but handle gracefully)
  if (typeof data === 'object' && data !== null) {
    return Buffer.from(JSON.stringify(data))
  }

  // Case 4: String (convert to Buffer)
  if (typeof data === 'string') {
    return Buffer.from(data)
  }

  // Case 5: Invalid type
  throw new Error(
    `Invalid data type for unwrap: ${typeof data}. ` +
    `Expected Buffer or {_binary: true, data: "base64..."}`
  )
}

/**
 * Wrap binary data for JSON storage
 *
 * ⚠️ WARNING: DO NOT USE THIS ON WRITE PATH!
 * ⚠️ Use key-based dispatch in baseStorage.ts COW adapter instead.
 * ⚠️ This function exists for legacy/compatibility only.
 *
 * DEPRECATED APPROACH: Tries to guess if data is JSON by parsing.
 * This is FRAGILE because compressed binary can accidentally parse as valid JSON,
 * causing blob integrity failures.
 *
 * SOLUTION: baseStorage.ts COW adapter now uses key naming convention:
 * - Keys with '-meta:' or 'ref:' prefix → Always JSON
 * - Keys with 'blob:', 'commit:', 'tree:' prefix → Always binary
 * No guessing needed!
 *
 * @param data - Buffer to wrap
 * @returns Wrapped object or parsed JSON object
 * @deprecated Use key-based dispatch in baseStorage.ts instead
 */
export function wrapBinaryData(data: Buffer): any {
  // Try to parse as JSON first (for metadata, trees, commits)
  // NOTE: This is the OLD approach - fragile because compressed data
  // can accidentally parse as valid JSON!
  try {
    return JSON.parse(data.toString())
  } catch {
    // Not JSON - wrap as binary data
    return {
      _binary: true,
      data: data.toString('base64')
    } as WrappedBinaryData
  }
}

/**
 * Ensure data is a Buffer
 *
 * Convenience function that combines type checking and unwrapping.
 * Use this when you need to ensure you have a Buffer.
 *
 * @param data - Data that should be or can be converted to Buffer
 * @returns Buffer
 */
export function ensureBuffer(data: any): Buffer {
  if (Buffer.isBuffer(data)) {
    return data
  }
  return unwrapBinaryData(data)
}
