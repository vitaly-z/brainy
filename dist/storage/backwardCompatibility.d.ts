/**
 * Backward Compatibility Layer for Storage Migration
 *
 * Handles the transition from 'index' to '_system' directory
 * Ensures services running different versions can coexist
 */
import { StatisticsData } from '../coreTypes.js';
export interface MigrationMetadata {
    schemaVersion: number;
    migrationStarted?: string;
    migrationCompleted?: string;
    lastUpdatedBy?: string;
}
/**
 * Backward compatibility strategy for directory migration
 */
export declare class StorageCompatibilityLayer {
    private migrationMetadata;
    /**
     * Determines the read strategy based on what's available
     * @returns Priority-ordered list of directories to try
     */
    static getReadPriority(): string[];
    /**
     * Determines write strategy based on migration state
     * @param migrationComplete Whether migration is complete
     * @returns List of directories to write to
     */
    static getWriteTargets(migrationComplete?: boolean): string[];
    /**
     * Check if we should perform migration based on service coordination
     * @param existingStats Statistics from storage
     * @returns Whether to initiate migration
     */
    static shouldMigrate(existingStats: StatisticsData | null): boolean;
    /**
     * Creates migration metadata
     */
    static createMigrationMetadata(): MigrationMetadata;
    /**
     * Merge statistics from multiple locations (deduplication)
     */
    static mergeStatistics(primary: StatisticsData | null, fallback: StatisticsData | null): StatisticsData | null;
    /**
     * Determines if dual-write is needed based on environment
     * @param storageType The type of storage being used
     * @returns Whether to write to both old and new locations
     */
    static needsDualWrite(storageType: string): boolean;
    /**
     * Grace period for migration (30 days default)
     * After this period, services can stop reading from old location
     */
    static getMigrationGracePeriodMs(): number;
    /**
     * Check if migration grace period has expired
     */
    static isGracePeriodExpired(migrationStarted: string): boolean;
    /**
     * Log migration events for monitoring
     */
    static logMigrationEvent(event: string, details?: any): void;
}
/**
 * Storage paths helper for migration
 */
export declare class StoragePaths {
    /**
     * Get the statistics file path for a given directory
     */
    static getStatisticsPath(baseDir: string, filename?: string): string;
    /**
     * Get distributed config path
     */
    static getDistributedConfigPath(baseDir: string): string;
    /**
     * Check if a path is using the old structure
     */
    static isLegacyPath(path: string): boolean;
    /**
     * Convert legacy path to new structure
     */
    static modernizePath(path: string): string;
}
