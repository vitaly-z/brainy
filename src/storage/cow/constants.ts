/**
 * COW Storage Constants
 *
 * Sentinel values and utilities for Copy-On-Write storage system.
 *
 * @module storage/cow/constants
 */

/**
 * NULL_HASH - Sentinel value for "no parent commit" or "empty tree"
 *
 * In Git-like COW systems, we need a way to represent:
 * - Initial commit (has no parent)
 * - Empty tree (contains no files)
 *
 * We use a 64-character zero hash as a sentinel value.
 * This should NEVER be used as an actual content hash.
 *
 * @constant
 * @example
 * ```typescript
 * const builder = CommitBuilder.create(storage)
 *   .tree(NULL_HASH)  // Empty tree
 *   .parent(null)      // No parent (use null, not NULL_HASH)
 *   .build()
 * ```
 */
export const NULL_HASH = '0000000000000000000000000000000000000000000000000000000000000000'

/**
 * Check if a hash is the NULL sentinel value
 *
 * @param hash - Hash to check (can be string or null)
 * @returns true if hash is null or NULL_HASH
 *
 * @example
 * ```typescript
 * if (isNullHash(commit.parent)) {
 *   console.log('This is the initial commit')
 * }
 * ```
 */
export function isNullHash(hash: string | null | undefined): boolean {
  return hash === null || hash === undefined || hash === NULL_HASH
}

/**
 * Check if a hash is valid (non-null, non-empty, proper format)
 *
 * @param hash - Hash to check
 * @returns true if hash is a valid SHA-256 hash
 */
export function isValidHash(hash: string | null | undefined): boolean {
  if (isNullHash(hash)) {
    return false
  }
  // SHA-256 hash must be exactly 64 hexadecimal characters
  return typeof hash === 'string' && /^[a-f0-9]{64}$/.test(hash)
}
