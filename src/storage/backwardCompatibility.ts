/**
 * Storage backward compatibility layer for legacy data migrations
 */

export class StorageCompatibilityLayer {
  static logMigrationEvent(event: string, details?: any): void {
    // Simplified logging for migration events
    if (process.env.DEBUG_MIGRATION) {
      console.log(`[Migration] ${event}`, details)
    }
  }
  
  static async migrateIfNeeded(storagePath: string): Promise<void> {
    // No-op for now - can be extended later if needed
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

// Helper to get default paths
export function getDefaultStoragePaths(basePath: string): StoragePaths {
  return {
    nouns: `${basePath}/nouns`,
    verbs: `${basePath}/verbs`, 
    metadata: `${basePath}/metadata`,
    index: `${basePath}/index`,
    system: `${basePath}/system`,
    statistics: `${basePath}/statistics.json`
  }
}