/**
 * Clean Metadata Architecture for Brainy 2.2
 * No backward compatibility - doing it RIGHT from the start!
 */

// Namespace constants
export const BRAINY_NS = '_brainy' as const
export const AUG_NS = '_augmentations' as const
export const AUDIT_NS = '_audit' as const

// Field paths for O(1) indexing
export const DELETED_FIELD = `${BRAINY_NS}.deleted` as const
export const INDEXED_FIELD = `${BRAINY_NS}.indexed` as const
export const VERSION_FIELD = `${BRAINY_NS}.version` as const

/**
 * Internal Brainy metadata structure
 * These fields are ALWAYS present and indexed for O(1) access
 */
export interface BrainyInternalMetadata {
  deleted: boolean      // ALWAYS boolean, enables O(1) soft delete
  indexed: boolean      // Whether in search index
  version: number       // Schema version
  created: number       // Unix timestamp
  updated: number       // Unix timestamp
  
  // Optional internal fields
  partition?: number    // For distributed mode
  domain?: string       // Domain classification
  priority?: number     // Query priority hint
  ttl?: number         // Time to live
}

/**
 * Complete metadata structure with namespaces
 */
export interface NamespacedMetadata<T = any> {
  // User metadata - any fields they want
  [key: string]: any
  
  // Internal metadata - our fields
  [BRAINY_NS]: BrainyInternalMetadata
  
  // Augmentation metadata - isolated per augmentation
  [AUG_NS]?: {
    [augmentationName: string]: any
  }
  
  // Audit trail - optional
  [AUDIT_NS]?: Array<{
    timestamp: number
    augmentation: string
    field: string
    oldValue: any
    newValue: any
  }>
}

/**
 * Create properly namespaced metadata
 * This is called for EVERY noun/verb creation
 */
export function createNamespacedMetadata<T = any>(
  userMetadata?: T
): NamespacedMetadata<T> {
  const now = Date.now()
  
  // Start with user metadata or empty object
  const result: any = userMetadata ? { ...userMetadata } : {}
  
  // ALWAYS add internal namespace with required fields
  result[BRAINY_NS] = {
    deleted: false,    // CRITICAL: Always false for new items
    indexed: true,     // New items are indexed
    version: 1,        // Current schema version
    created: now,
    updated: now
  }
  
  return result
}

/**
 * Update metadata while preserving namespaces
 */
export function updateNamespacedMetadata<T = any>(
  existing: NamespacedMetadata<T>,
  updates: Partial<T>
): NamespacedMetadata<T> {
  const now = Date.now()
  
  // Merge user fields
  const result: any = {
    ...existing,
    ...updates
  }
  
  // Preserve internal namespace but update timestamp
  result[BRAINY_NS] = {
    ...existing[BRAINY_NS],
    updated: now
  }
  
  // Preserve augmentation namespace
  if (existing[AUG_NS]) {
    result[AUG_NS] = existing[AUG_NS]
  }
  
  // Preserve audit trail
  if (existing[AUDIT_NS]) {
    result[AUDIT_NS] = existing[AUDIT_NS]
  }
  
  return result
}

/**
 * Soft delete a noun (O(1) operation)
 */
export function markDeleted<T = any>(
  metadata: NamespacedMetadata<T>
): NamespacedMetadata<T> {
  return {
    ...metadata,
    [BRAINY_NS]: {
      ...metadata[BRAINY_NS],
      deleted: true,
      updated: Date.now()
    }
  }
}

/**
 * Restore a soft-deleted noun (O(1) operation)
 */
export function markRestored<T = any>(
  metadata: NamespacedMetadata<T>
): NamespacedMetadata<T> {
  return {
    ...metadata,
    [BRAINY_NS]: {
      ...metadata[BRAINY_NS],
      deleted: false,
      updated: Date.now()
    }
  }
}

/**
 * Check if a noun is deleted (O(1) check)
 */
export function isDeleted<T = any>(
  metadata: NamespacedMetadata<T>
): boolean {
  return metadata[BRAINY_NS]?.deleted === true
}

/**
 * Get user metadata without internal fields
 * Used by augmentations to get clean user data
 */
export function getUserMetadata<T = any>(
  metadata: NamespacedMetadata<T>
): T {
  const { [BRAINY_NS]: _, [AUG_NS]: __, [AUDIT_NS]: ___, ...userMeta } = metadata
  return userMeta as T
}

/**
 * Set augmentation data in isolated namespace
 */
export function setAugmentationData<T = any>(
  metadata: NamespacedMetadata<T>,
  augmentationName: string,
  data: any
): NamespacedMetadata<T> {
  const result = { ...metadata }
  
  if (!result[AUG_NS]) {
    result[AUG_NS] = {}
  }
  
  result[AUG_NS][augmentationName] = data
  
  return result
}

/**
 * Add audit entry for tracking
 */
export function addAuditEntry<T = any>(
  metadata: NamespacedMetadata<T>,
  entry: {
    augmentation: string
    field: string
    oldValue: any
    newValue: any
  }
): NamespacedMetadata<T> {
  const result = { ...metadata }
  
  if (!result[AUDIT_NS]) {
    result[AUDIT_NS] = []
  }
  
  result[AUDIT_NS].push({
    ...entry,
    timestamp: Date.now()
  })
  
  return result
}

/**
 * INDEXING EXPLANATION:
 * 
 * The MetadataIndex flattens nested objects into dot-notation keys:
 * 
 * Input metadata:
 * {
 *   name: "Django",
 *   _brainy: {
 *     deleted: false,
 *     indexed: true
 *   }
 * }
 * 
 * Creates index entries:
 * - "name" -> "django" -> Set([id1, id2...])
 * - "_brainy.deleted" -> "false" -> Set([id1, id2...])  // O(1) lookup!
 * - "_brainy.indexed" -> "true" -> Set([id1, id2...])
 * 
 * Query: { "_brainy.deleted": false }
 * Lookup: index["_brainy.deleted"]["false"] -> Set of IDs in O(1)
 * 
 * This is why namespacing doesn't hurt performance - it's all flattened!
 */

/**
 * Fields that should ALWAYS be indexed for O(1) access
 */
export const ALWAYS_INDEXED_FIELDS = [
  DELETED_FIELD,   // For soft delete filtering
  INDEXED_FIELD,   // For index management
  VERSION_FIELD    // For schema versioning
]

/**
 * Fields that should use sorted index for O(log n) range queries
 */
export const SORTED_INDEX_FIELDS = [
  `${BRAINY_NS}.created`,
  `${BRAINY_NS}.updated`,
  `${BRAINY_NS}.priority`,
  `${BRAINY_NS}.ttl`
]