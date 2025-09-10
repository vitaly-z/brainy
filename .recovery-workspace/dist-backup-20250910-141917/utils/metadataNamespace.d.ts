/**
 * Clean Metadata Architecture for Brainy 2.2
 * No backward compatibility - doing it RIGHT from the start!
 */
export declare const BRAINY_NS: "_brainy";
export declare const AUG_NS: "_augmentations";
export declare const AUDIT_NS: "_audit";
export declare const DELETED_FIELD: "_brainy.deleted";
export declare const INDEXED_FIELD: "_brainy.indexed";
export declare const VERSION_FIELD: "_brainy.version";
/**
 * Internal Brainy metadata structure
 * These fields are ALWAYS present and indexed for O(1) access
 */
export interface BrainyInternalMetadata {
    deleted: boolean;
    indexed: boolean;
    version: number;
    created: number;
    updated: number;
    partition?: number;
    domain?: string;
    priority?: number;
    ttl?: number;
}
/**
 * Complete metadata structure with namespaces
 */
export interface NamespacedMetadata<T = any> {
    [key: string]: any;
    [BRAINY_NS]: BrainyInternalMetadata;
    [AUG_NS]?: {
        [augmentationName: string]: any;
    };
    [AUDIT_NS]?: Array<{
        timestamp: number;
        augmentation: string;
        field: string;
        oldValue: any;
        newValue: any;
    }>;
}
/**
 * Create properly namespaced metadata
 * This is called for EVERY noun/verb creation
 */
export declare function createNamespacedMetadata<T = any>(userMetadata?: T): NamespacedMetadata<T>;
/**
 * Update metadata while preserving namespaces
 */
export declare function updateNamespacedMetadata<T = any>(existing: NamespacedMetadata<T>, updates: Partial<T>): NamespacedMetadata<T>;
/**
 * Soft delete a noun (O(1) operation)
 */
export declare function markDeleted<T = any>(metadata: NamespacedMetadata<T>): NamespacedMetadata<T>;
/**
 * Restore a soft-deleted noun (O(1) operation)
 */
export declare function markRestored<T = any>(metadata: NamespacedMetadata<T>): NamespacedMetadata<T>;
/**
 * Check if a noun is deleted (O(1) check)
 */
export declare function isDeleted<T = any>(metadata: NamespacedMetadata<T>): boolean;
/**
 * Get user metadata without internal fields
 * Used by augmentations to get clean user data
 */
export declare function getUserMetadata<T = any>(metadata: NamespacedMetadata<T>): T;
/**
 * Set augmentation data in isolated namespace
 */
export declare function setAugmentationData<T = any>(metadata: NamespacedMetadata<T>, augmentationName: string, data: any): NamespacedMetadata<T>;
/**
 * Add audit entry for tracking
 */
export declare function addAuditEntry<T = any>(metadata: NamespacedMetadata<T>, entry: {
    augmentation: string;
    field: string;
    oldValue: any;
    newValue: any;
}): NamespacedMetadata<T>;
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
export declare const ALWAYS_INDEXED_FIELDS: ("_brainy.deleted" | "_brainy.indexed" | "_brainy.version")[];
/**
 * Fields that should use sorted index for O(log n) range queries
 */
export declare const SORTED_INDEX_FIELDS: string[];
