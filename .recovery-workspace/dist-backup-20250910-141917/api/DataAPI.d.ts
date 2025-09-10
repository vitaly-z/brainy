/**
 * Data Management API for Brainy 3.0
 * Provides backup, restore, import, export, and data management
 */
import { StorageAdapter } from '../coreTypes.js';
import { Entity, Relation } from '../types/brainy.types.js';
import { NounType } from '../types/graphTypes.js';
export interface BackupOptions {
    includeVectors?: boolean;
    compress?: boolean;
    format?: 'json' | 'binary';
}
export interface RestoreOptions {
    merge?: boolean;
    overwrite?: boolean;
    validate?: boolean;
}
export interface ImportOptions {
    format: 'json' | 'csv' | 'parquet';
    mapping?: Record<string, string>;
    batchSize?: number;
    validate?: boolean;
}
export interface ExportOptions {
    format?: 'json' | 'csv' | 'parquet';
    filter?: {
        type?: NounType | NounType[];
        where?: Record<string, any>;
        service?: string;
    };
    includeVectors?: boolean;
}
export interface BackupData {
    version: string;
    timestamp: number;
    entities: Array<{
        id: string;
        vector?: number[];
        type: string;
        metadata: any;
        service?: string;
    }>;
    relations: Array<{
        id: string;
        from: string;
        to: string;
        type: string;
        weight: number;
        metadata?: any;
    }>;
    config?: Record<string, any>;
    stats: {
        entityCount: number;
        relationCount: number;
        vectorDimensions?: number;
    };
}
export interface ImportResult {
    successful: number;
    failed: number;
    errors: Array<{
        item: any;
        error: string;
    }>;
    duration: number;
}
export declare class DataAPI {
    private storage;
    private getEntity;
    private getRelation?;
    private brain;
    constructor(storage: StorageAdapter, getEntity: (id: string) => Promise<Entity | null>, getRelation?: ((id: string) => Promise<Relation | null>) | undefined, brain?: any);
    /**
     * Create a backup of all data
     */
    backup(options?: BackupOptions): Promise<BackupData>;
    /**
     * Restore data from a backup
     */
    restore(params: {
        backup: BackupData;
        merge?: boolean;
        overwrite?: boolean;
        validate?: boolean;
    }): Promise<void>;
    /**
     * Clear data
     */
    clear(params?: {
        entities?: boolean;
        relations?: boolean;
        config?: boolean;
    }): Promise<void>;
    /**
     * Import data from various formats
     */
    import(params: ImportOptions & {
        data: any;
    }): Promise<ImportResult>;
    /**
     * Export data to various formats
     */
    export(params?: ExportOptions): Promise<any>;
    /**
     * Get storage statistics
     */
    getStats(): Promise<{
        entities: number;
        relations: number;
        storageSize?: number;
        vectorDimensions?: number;
    }>;
    private applyMapping;
    private validateImportItem;
    private matchesFilter;
    private convertToCSV;
    private generateId;
}
