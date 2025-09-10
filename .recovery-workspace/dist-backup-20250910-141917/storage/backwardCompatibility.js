/**
 * Storage backward compatibility layer for legacy data migrations
 */
export class StorageCompatibilityLayer {
    static logMigrationEvent(event, details) {
        // Simplified logging for migration events
        if (process.env.DEBUG_MIGRATION) {
            console.log(`[Migration] ${event}`, details);
        }
    }
    static async migrateIfNeeded(storagePath) {
        // No-op for now - can be extended later if needed
    }
}
// Helper to get default paths
export function getDefaultStoragePaths(basePath) {
    return {
        nouns: `${basePath}/nouns`,
        verbs: `${basePath}/verbs`,
        metadata: `${basePath}/metadata`,
        index: `${basePath}/index`,
        system: `${basePath}/system`,
        statistics: `${basePath}/statistics.json`
    };
}
//# sourceMappingURL=backwardCompatibility.js.map