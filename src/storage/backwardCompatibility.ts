/**
 * DEPRECATED (v4.7.2): Backward compatibility stubs
 * TODO: Remove in v4.7.3 after migrating s3CompatibleStorage
 */

export class StorageCompatibilityLayer {
  static logMigrationEvent(event: string, details?: any): void {
    // No-op
  }

  static async migrateIfNeeded(storagePath: string): Promise<void> {
    // No-op
  }
}

export interface StoragePaths {
  nouns: string
  verbs: string
  metadata: string
  index: string
  system: string
  statistics: string
}

export function getDefaultStoragePaths(basePath: string): StoragePaths {
  return {
    nouns: `${basePath}/entities/nouns/hnsw`,
    verbs: `${basePath}/entities/verbs/hnsw`,
    metadata: `${basePath}/entities/nouns/metadata`,
    index: `${basePath}/indexes`,
    system: `${basePath}/_system`,
    statistics: `${basePath}/_system/statistics.json`
  }
}
