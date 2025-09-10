/**
 * Utility to ensure all metadata has the deleted field set properly
 * This is CRITICAL for O(1) soft delete filtering performance
 *
 * Uses _brainy namespace to avoid conflicts with user metadata
 */
const BRAINY_NAMESPACE = '_brainy';
/**
 * Ensure metadata has internal Brainy fields set
 * @param metadata The metadata object (could be null/undefined)
 * @param preserveExisting If true, preserve existing deleted value
 * @returns Metadata with internal fields guaranteed
 */
export function ensureDeletedField(metadata, preserveExisting = true) {
    // Handle null/undefined metadata
    if (!metadata) {
        return {
            [BRAINY_NAMESPACE]: {
                deleted: false,
                version: 1
            }
        };
    }
    // Clone to avoid mutation
    const result = { ...metadata };
    // Ensure _brainy namespace exists
    if (!result[BRAINY_NAMESPACE]) {
        result[BRAINY_NAMESPACE] = {};
    }
    // Set deleted field if not present
    if (!('deleted' in result[BRAINY_NAMESPACE])) {
        result[BRAINY_NAMESPACE].deleted = false;
    }
    else if (!preserveExisting) {
        // Force to false if not preserving
        result[BRAINY_NAMESPACE].deleted = false;
    }
    return result;
}
/**
 * Mark an item as soft deleted
 * @param metadata The metadata object
 * @returns Metadata with _brainy.deleted=true
 */
export function markAsDeleted(metadata) {
    const result = ensureDeletedField(metadata);
    result[BRAINY_NAMESPACE].deleted = true;
    return result;
}
/**
 * Mark an item as restored (not deleted)
 * @param metadata The metadata object
 * @returns Metadata with _brainy.deleted=false
 */
export function markAsRestored(metadata) {
    const result = ensureDeletedField(metadata);
    result[BRAINY_NAMESPACE].deleted = false;
    return result;
}
/**
 * Check if an item is deleted
 * @param metadata The metadata object
 * @returns true if deleted, false otherwise (including if field missing)
 */
export function isDeleted(metadata) {
    return metadata?.[BRAINY_NAMESPACE]?.deleted === true;
}
/**
 * Check if an item is active (not deleted)
 * @param metadata The metadata object
 * @returns true if not deleted (default), false if deleted
 */
export function isActive(metadata) {
    // If no deleted field or deleted=false, item is active
    return !isDeleted(metadata);
}
// Export the namespace constant for use in queries
export const BRAINY_DELETED_FIELD = `${BRAINY_NAMESPACE}.deleted`;
//# sourceMappingURL=ensureDeleted.js.map