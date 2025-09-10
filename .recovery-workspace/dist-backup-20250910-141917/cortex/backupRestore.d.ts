/**
 * Backup & Restore System - Atomic Age Data Preservation Protocol
 *
 * 🧠 Complete backup/restore with compression and verification
 * ⚛️ 1950s retro sci-fi aesthetic maintained throughout
 */
import { Brainy } from '../brainy.js';
export interface BackupOptions {
    compress?: boolean;
    output?: string;
    includeMetadata?: boolean;
    includeStatistics?: boolean;
    verify?: boolean;
    password?: string;
}
export interface RestoreOptions {
    verify?: boolean;
    overwrite?: boolean;
    password?: string;
    dryRun?: boolean;
}
export interface BackupManifest {
    version: string;
    timestamp: string;
    brainyVersion: string;
    entityCount: number;
    relationshipCount: number;
    storageType: string;
    compressed: boolean;
    encrypted: boolean;
    checksum: string;
    metadata: {
        created: string;
        description?: string;
        tags?: string[];
    };
}
/**
 * Backup & Restore Engine - The Brain's Memory Preservation System
 */
export declare class BackupRestore {
    private brainy;
    private colors;
    private emojis;
    constructor(brainy: Brainy);
    /**
     * Create a complete backup of Brainy data
     */
    createBackup(options?: BackupOptions): Promise<string>;
    /**
     * Restore Brainy data from backup
     */
    restoreBackup(backupPath: string, options?: RestoreOptions): Promise<void>;
    /**
     * List available backups in a directory
     */
    listBackups(directory?: string): Promise<BackupManifest[]>;
    /**
     * Get backup manifest without loading full backup
     */
    private getBackupManifest;
    /**
     * Collect all data for backup
     */
    private collectBackupData;
    /**
     * Create backup manifest
     */
    private createManifest;
    /**
     * Helper methods
     */
    private generateBackupPath;
    private compressData;
    private decompressData;
    private encryptData;
    private decryptData;
    private verifyBackup;
    private verifyRestoreData;
    private executeRestore;
    private collectMetadata;
    private restoreMetadata;
    private calculateChecksum;
    private formatFileSize;
}
