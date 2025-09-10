/**
 * Storage backward compatibility layer for legacy data migrations
 */
export declare class StorageCompatibilityLayer {
    static logMigrationEvent(event: string, details?: any): void;
    static migrateIfNeeded(storagePath: string): Promise<void>;
}
export interface StoragePaths {
    nouns: string;
    verbs: string;
    metadata: string;
    index: string;
    system: string;
    statistics: string;
}
export declare function getDefaultStoragePaths(basePath: string): StoragePaths;
