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
import { BaseAugmentation } from './brainyAugmentation.js';
import { NeuralImportAugmentation } from './neuralImport.js';
/**
 * Base class for all synapse augmentations
 * Provides common functionality for external data synchronization
 */
export class SynapseAugmentation extends BaseAugmentation {
    constructor() {
        super(...arguments);
        // BrainyAugmentation properties
        this.timing = 'after';
        this.operations = ['all'];
        this.priority = 10;
        this.metadata = {
            reads: '*', // Needs to read for syncing
            writes: ['_synapse', '_syncedAt']
        }; // Adds synapse tracking metadata
        // State management
        this.syncInProgress = false;
        this.syncStats = {
            totalSyncs: 0,
            totalItems: 0,
            lastSync: undefined
        };
        this.useNeuralImport = true; // Enable by default
    }
    async onInit() {
        // Initialize Neural Import if available
        if (this.useNeuralImport && this.context?.brain) {
            try {
                // Check if neural import is already loaded
                const existingNeuralImport = this.context.brain.augmentations?.get('neural-import');
                if (existingNeuralImport) {
                    this.neuralImport = existingNeuralImport;
                }
                else {
                    // Create a new instance for this synapse
                    this.neuralImport = new NeuralImportAugmentation();
                    // NeuralImport will be initialized when the synapse is added to Brainy
                    // await this.neuralImport.initialize()
                }
            }
            catch (error) {
                console.warn(`[${this.synapseId}] Neural Import not available, using basic import`);
                this.useNeuralImport = false;
            }
        }
        await this.onInitialize();
    }
    /**
     * BrainyAugmentation execute method
     * Intercepts operations to sync external data when relevant
     */
    async execute(operation, params, next) {
        // Execute the main operation first
        const result = await next();
        // After certain operations, check if we should sync
        if (this.shouldSync(operation, params)) {
            // Start async sync in background
            this.backgroundSync().catch(error => {
                console.error(`[${this.synapseId}] Background sync failed:`, error);
            });
        }
        return result;
    }
    /**
     * Determine if sync should be triggered after an operation
     */
    shouldSync(operation, params) {
        // Override in implementations for specific sync triggers
        return false;
    }
    /**
     * Background sync process
     */
    async backgroundSync() {
        if (this.syncInProgress)
            return;
        this.syncInProgress = true;
        try {
            await this.incrementalSync(this.lastSyncId);
        }
        finally {
            this.syncInProgress = false;
        }
    }
    async onShutdown() {
        if (this.syncInProgress) {
            await this.stopSync();
        }
        await this.onSynapseShutdown();
    }
    async onSynapseShutdown() {
        // Override in implementations for cleanup
    }
    async stopSync() {
        this.syncInProgress = false;
    }
    async getSynapseStatus() {
        const connectionTest = await this.testConnection();
        return {
            success: true,
            data: {
                status: this.syncInProgress ? 'syncing' :
                    connectionTest.success ? 'connected' : 'disconnected',
                lastSync: this.syncStats.lastSync,
                totalSyncs: this.syncStats.totalSyncs,
                totalItems: this.syncStats.totalItems
            }
        };
    }
    /**
     * Helper method to store synced data in Brainy
     * Optionally uses Neural Import for intelligent processing
     */
    async storeInBrainy(content, metadata, options = {}) {
        if (!this.context?.brain) {
            throw new Error('Brainy context not initialized');
        }
        // Add synapse source metadata
        const enrichedMetadata = {
            ...metadata,
            _synapse: this.synapseId,
            _syncedAt: new Date().toISOString()
        };
        // Use Neural Import for intelligent processing if available
        if (this.neuralImport && (options.useNeuralImport ?? this.useNeuralImport)) {
            try {
                // Process through Neural Import for entity/relationship detection
                const rawData = options.rawData ||
                    (typeof content === 'string' ? content : JSON.stringify(content));
                const neuralResult = await this.neuralImport.processRawData(rawData, options.dataType || 'json', {
                    sourceSystem: this.synapseId,
                    metadata: enrichedMetadata
                });
                if (neuralResult.success && neuralResult.data) {
                    // Store detected nouns (entities)
                    for (const noun of neuralResult.data.nouns) {
                        await this.context.brain.add({
                            text: noun,
                            metadata: {
                                ...enrichedMetadata,
                                _neuralConfidence: neuralResult.data.confidence,
                                _neuralInsights: neuralResult.data.insights
                            }
                        });
                    }
                    // Store detected verbs (relationships)
                    for (const verb of neuralResult.data.verbs) {
                        // Parse verb format: "source->relation->target"
                        const parts = verb.split('->');
                        if (parts.length === 3) {
                            await this.context.brain.relate(parts[0], // source
                            parts[2], // target
                            parts[1], // verb type
                            enrichedMetadata);
                        }
                    }
                    // Store original content with neural metadata
                    if (typeof content === 'string') {
                        await this.context.brain.add({
                            text: content,
                            metadata: {
                                ...enrichedMetadata,
                                category: 'Content',
                                _neuralProcessed: true,
                                _neuralConfidence: neuralResult.data.confidence,
                                _detectedEntities: neuralResult.data.nouns.length,
                                _detectedRelationships: neuralResult.data.verbs.length
                            }
                        });
                    }
                    return; // Successfully processed with Neural Import
                }
            }
            catch (error) {
                console.warn(`[${this.synapseId}] Neural Import processing failed, falling back to basic import:`, error);
            }
        }
        // Fallback to basic storage
        if (typeof content === 'string') {
            await this.context.brain.add({
                text: content,
                metadata: {
                    ...enrichedMetadata,
                    category: 'Content'
                }
            });
        }
        else {
            // For structured data, store as JSON
            await this.context.brain.add({
                text: JSON.stringify(content),
                metadata: {
                    ...enrichedMetadata,
                    category: 'Content'
                }
            });
        }
    }
    /**
     * Helper method to query existing synced data
     */
    async queryBrainy(filter) {
        if (!this.context?.brain) {
            throw new Error('Brainy context not initialized');
        }
        const searchFilter = {
            ...filter,
            _synapse: this.synapseId
        };
        return this.context.brain.find({
            where: searchFilter
        });
    }
}
/**
 * Example implementation for reference
 * Real synapses would be in Brain Cloud registry
 */
export class ExampleFileSystemSynapse extends SynapseAugmentation {
    constructor() {
        super(...arguments);
        this.name = 'example-filesystem-synapse';
        this.description = 'Example synapse for local file system with Neural Import intelligence';
        this.synapseId = 'filesystem';
        this.supportedTypes = ['text', 'markdown', 'json', 'csv'];
    }
    async onInitialize() {
        // Initialize file system watcher, etc.
    }
    async testConnection() {
        // Test if we can access the configured directory
        return {
            success: true,
            data: true
        };
    }
    async startSync(options) {
        const startTime = Date.now();
        // Example: Read files from a directory and sync to Brainy
        // This would normally scan a directory, but here's a conceptual example:
        const exampleFiles = [
            {
                path: '/data/notes.md',
                content: '# Project Notes\nDiscuss roadmap with team\nReview Q1 metrics',
                type: 'markdown'
            },
            {
                path: '/data/contacts.json',
                content: { name: 'John Doe', role: 'Developer', team: 'Engineering' },
                type: 'json'
            }
        ];
        let synced = 0;
        const errors = [];
        for (const file of exampleFiles) {
            try {
                // Use Neural Import for intelligent processing
                await this.storeInBrainy(file.content, {
                    path: file.path,
                    fileType: file.type,
                    syncedFrom: 'filesystem'
                }, {
                    useNeuralImport: true, // Enable AI processing
                    dataType: file.type
                });
                synced++;
            }
            catch (error) {
                errors.push({
                    item: file.path,
                    error: error instanceof Error ? error.message : 'Unknown error'
                });
            }
        }
        this.syncStats.totalSyncs++;
        this.syncStats.totalItems += synced;
        this.syncStats.lastSync = new Date().toISOString();
        return {
            success: true,
            data: {
                synced,
                failed: errors.length,
                skipped: 0,
                duration: Date.now() - startTime,
                errors: errors.length > 0 ? errors : undefined
            }
        };
    }
    async incrementalSync(lastSyncId) {
        const startTime = Date.now();
        // Example: Check for modified files since last sync
        return {
            success: true,
            data: {
                synced: 0,
                failed: 0,
                skipped: 0,
                duration: Date.now() - startTime,
                hasMore: false
            }
        };
    }
    async previewSync(limit = 10) {
        // Example: List files that would be synced
        return {
            success: true,
            data: {
                items: [],
                totalCount: 0,
                estimatedDuration: 0
            }
        };
    }
}
//# sourceMappingURL=synapseAugmentation.js.map