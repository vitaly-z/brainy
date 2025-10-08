/**
 * Unified UUID-based sharding for all storage adapters
 *
 * Uses first 2 hex characters of UUID for consistent, predictable sharding
 * that scales from hundreds to millions of entities without configuration.
 *
 * Sharding characteristics:
 * - 256 buckets (00-ff)
 * - Deterministic (same UUID always maps to same shard)
 * - No configuration required
 * - Works across all storage types (filesystem, S3, GCS, memory)
 * - Efficient for list operations and pagination
 */

/**
 * Extract shard ID from UUID
 *
 * Uses first 2 hex characters of the UUID as the shard ID.
 * This provides 256 evenly-distributed buckets (00-ff).
 *
 * @param uuid - UUID string (with or without hyphens)
 * @returns 2-character hex shard ID (00-ff)
 *
 * @example
 * ```typescript
 * getShardIdFromUuid('ab123456-1234-5678-9abc-def012345678') // returns 'ab'
 * getShardIdFromUuid('cd987654-4321-8765-cba9-fed543210987') // returns 'cd'
 * getShardIdFromUuid('00000000-0000-0000-0000-000000000000') // returns '00'
 * ```
 */
export function getShardIdFromUuid(uuid: string): string {
  if (!uuid) {
    throw new Error('UUID is required for sharding')
  }

  // Remove hyphens and convert to lowercase
  const normalized = uuid.toLowerCase().replace(/-/g, '')

  // Validate UUID format (32 hex characters)
  if (normalized.length !== 32) {
    throw new Error(`Invalid UUID format: ${uuid} (expected 32 hex chars, got ${normalized.length})`)
  }

  // Extract first 2 characters
  const shardId = normalized.substring(0, 2)

  // Validate hex format
  if (!/^[0-9a-f]{2}$/.test(shardId)) {
    throw new Error(`Invalid UUID prefix: ${shardId} (expected 2 hex chars)`)
  }

  return shardId
}

/**
 * Get all possible shard IDs (00-ff)
 *
 * Returns array of 256 shard IDs in ascending order.
 * Useful for iterating through all shards during pagination.
 *
 * @returns Array of 256 shard IDs
 *
 * @example
 * ```typescript
 * const shards = getAllShardIds()
 * // ['00', '01', '02', ..., 'fd', 'fe', 'ff']
 *
 * for (const shardId of shards) {
 *   const prefix = `entities/nouns/vectors/${shardId}/`
 *   // List objects with this prefix
 * }
 * ```
 */
export function getAllShardIds(): string[] {
  const shards: string[] = []
  for (let i = 0; i < 256; i++) {
    shards.push(i.toString(16).padStart(2, '0'))
  }
  return shards
}

/**
 * Get shard ID for a given index (0-255)
 *
 * @param index - Shard index (0-255)
 * @returns 2-character hex shard ID
 *
 * @example
 * ```typescript
 * getShardIdByIndex(0)   // '00'
 * getShardIdByIndex(15)  // '0f'
 * getShardIdByIndex(255) // 'ff'
 * ```
 */
export function getShardIdByIndex(index: number): string {
  if (index < 0 || index > 255) {
    throw new Error(`Shard index out of range: ${index} (expected 0-255)`)
  }
  return index.toString(16).padStart(2, '0')
}

/**
 * Get shard index from shard ID (0-255)
 *
 * @param shardId - 2-character hex shard ID
 * @returns Shard index (0-255)
 *
 * @example
 * ```typescript
 * getShardIndexFromId('00')  // 0
 * getShardIndexFromId('0f')  // 15
 * getShardIndexFromId('ff')  // 255
 * ```
 */
export function getShardIndexFromId(shardId: string): number {
  if (!/^[0-9a-f]{2}$/.test(shardId)) {
    throw new Error(`Invalid shard ID: ${shardId} (expected 2 hex chars)`)
  }
  return parseInt(shardId, 16)
}

/**
 * Total number of shards in the system
 */
export const TOTAL_SHARDS = 256

/**
 * Shard configuration (read-only)
 */
export const SHARD_CONFIG = {
  /**
   * Total number of shards (256)
   */
  count: TOTAL_SHARDS,

  /**
   * Number of hex characters used for sharding (2)
   */
  prefixLength: 2,

  /**
   * Sharding method description
   */
  method: 'uuid-prefix',

  /**
   * Whether sharding is always enabled
   */
  alwaysEnabled: true
} as const
