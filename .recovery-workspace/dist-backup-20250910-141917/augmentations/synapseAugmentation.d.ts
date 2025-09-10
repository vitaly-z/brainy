/**
 * Base Synapse Augmentation
 *
 * Synapses are special augmentations that provide bidirectional data sync
 * with external platforms (Notion, Salesforce, Slack, etc.)
 *
 * Like biological synapses that transmit signals between neurons, these
 * connect Brainy to external data sources, enabling seamless information flow.
 *
 * They are managed through the Brain Cloud augmentation registry alongside
 * other augmentations, enabling unified discovery, installation, and updates.
 *
 * Example synapses:
 * - NotionSynapse: Sync pages, databases, and blocks
 * - SalesforceSynapse: Sync contacts, leads, opportunities
 * - SlackSynapse: Sync messages, channels, users
 * - GoogleDriveSynapse: Sync documents, sheets, presentations
 */
import { AugmentationResponse } from '../types/augmentations.js';
import { BaseAugmentation } from './brainyAugmentation.js';
import { NeuralImportAugmentation } from './neuralImport.js';
/**
 * Base class for all synapse augmentations
 * Provides common functionality for external data synchronization
 */
export declare abstract class SynapseAugmentation extends BaseAugmentation {
    readonly timing: "after";
    readonly operations: ("all")[];
    readonly priority = 10;
    readonly metadata: {
        reads: "*";
        writes: string[];
    };
    abstract readonly synapseId: string;
    abstract readonly supportedTypes: string[];
    protected syncInProgress: boolean;
    protected lastSyncId?: string;
    protected syncStats: {
        totalSyncs: number;
        totalItems: number;
        lastSync: string | undefined;
    };
    protected neuralImport?: NeuralImportAugmentation;
    protected useNeuralImport: boolean;
    protected onInit(): Promise<void>;
    /**
     * Synapse-specific initialization
     * Override this in implementations
     */
    protected abstract onInitialize(): Promise<void>;
    /**
     * BrainyAugmentation execute method
     * Intercepts operations to sync external data when relevant
     */
    execute<T = any>(operation: string, params: any, next: () => Promise<T>): Promise<T>;
    /**
     * Determine if sync should be triggered after an operation
     */
    protected shouldSync(operation: string, params: any): boolean;
    /**
     * Background sync process
     */
    protected backgroundSync(): Promise<void>;
    protected onShutdown(): Promise<void>;
    protected onSynapseShutdown(): Promise<void>;
    /**
     * ISynapseAugmentation methods
     */
    abstract testConnection(): Promise<AugmentationResponse<boolean>>;
    abstract startSync(options?: Record<string, unknown>): Promise<AugmentationResponse<{
        synced: number;
        failed: number;
        skipped: number;
        duration: number;
        errors?: Array<{
            item: string;
            error: string;
        }>;
    }>>;
    stopSync(): Promise<void>;
    abstract incrementalSync(lastSyncId?: string): Promise<AugmentationResponse<{
        synced: number;
        failed: number;
        skipped: number;
        duration: number;
        hasMore: boolean;
        nextSyncId?: string;
    }>>;
    abstract previewSync(limit?: number): Promise<AugmentationResponse<{
        items: Array<{
            type: string;
            title: string;
            preview: string;
        }>;
        totalCount: number;
        estimatedDuration: number;
    }>>;
    getSynapseStatus(): Promise<AugmentationResponse<{
        status: 'connected' | 'disconnected' | 'syncing' | 'error';
        lastSync?: string;
        nextSync?: string;
        totalSyncs: number;
        totalItems: number;
    }>>;
    /**
     * Helper method to store synced data in Brainy
     * Optionally uses Neural Import for intelligent processing
     */
    protected storeInBrainy(content: string | Record<string, any>, metadata: Record<string, any>, options?: {
        useNeuralImport?: boolean;
        dataType?: string;
        rawData?: Buffer | string;
    }): Promise<void>;
    /**
     * Helper method to query existing synced data
     */
    protected queryBrainy(filter: {
        connector?: string;
        [key: string]: any;
    }): Promise<any[]>;
}
/**
 * Example implementation for reference
 * Real synapses would be in Brain Cloud registry
 */
export declare class ExampleFileSystemSynapse extends SynapseAugmentation {
    readonly name = "example-filesystem-synapse";
    readonly description = "Example synapse for local file system with Neural Import intelligence";
    readonly synapseId = "filesystem";
    readonly supportedTypes: string[];
    protected onInitialize(): Promise<void>;
    testConnection(): Promise<AugmentationResponse<boolean>>;
    startSync(options?: Record<string, unknown>): Promise<AugmentationResponse<{
        synced: number;
        failed: number;
        skipped: number;
        duration: number;
        errors?: Array<{
            item: string;
            error: string;
        }>;
    }>>;
    incrementalSync(lastSyncId?: string): Promise<AugmentationResponse<{
        synced: number;
        failed: number;
        skipped: number;
        duration: number;
        hasMore: boolean;
        nextSyncId?: string;
    }>>;
    previewSync(limit?: number): Promise<AugmentationResponse<{
        items: Array<{
            type: string;
            title: string;
            preview: string;
        }>;
        totalCount: number;
        estimatedDuration: number;
    }>>;
}
