/**
 * Utility to ensure all metadata has the deleted field set properly
 * This is CRITICAL for O(1) soft delete filtering performance
 *
 * Uses _brainy namespace to avoid conflicts with user metadata
 */
/**
 * Ensure metadata has internal Brainy fields set
 * @param metadata The metadata object (could be null/undefined)
 * @param preserveExisting If true, preserve existing deleted value
 * @returns Metadata with internal fields guaranteed
 */
export declare function ensureDeletedField(metadata: any, preserveExisting?: boolean): any;
/**
 * Mark an item as soft deleted
 * @param metadata The metadata object
 * @returns Metadata with _brainy.deleted=true
 */
export declare function markAsDeleted(metadata: any): any;
/**
 * Mark an item as restored (not deleted)
 * @param metadata The metadata object
 * @returns Metadata with _brainy.deleted=false
 */
export declare function markAsRestored(metadata: any): any;
/**
 * Check if an item is deleted
 * @param metadata The metadata object
 * @returns true if deleted, false otherwise (including if field missing)
 */
export declare function isDeleted(metadata: any): boolean;
/**
 * Check if an item is active (not deleted)
 * @param metadata The metadata object
 * @returns true if not deleted (default), false if deleted
 */
export declare function isActive(metadata: any): boolean;
export declare const BRAINY_DELETED_FIELD = "_brainy.deleted";
