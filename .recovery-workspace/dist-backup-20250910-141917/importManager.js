/**
 * Import Manager - Comprehensive data import with intelligent type detection
 *
 * Handles multiple data sources:
 * - Direct data (objects, arrays)
 * - Files (JSON, CSV, text)
 * - URLs (fetch and parse)
 * - Streams (for large files)
 *
 * Uses NeuralImportAugmentation for intelligent processing
 */
import { VerbType } from './types/graphTypes.js';
import { NeuralImportAugmentation } from './augmentations/neuralImport.js';
import * as fs from './universal/fs.js';
import * as path from './universal/path.js';
import { prodLog } from './utils/logger.js';
export class ImportManager {
    constructor(brain) {
        this.typeMatcher = null;
        this.brain = brain;
        this.neuralImport = new NeuralImportAugmentation();
    }
    /**
     * Initialize the import manager
     */
    async init() {
        // Initialize neural import with proper context
        const context = {
            brain: this.brain,
            storage: this.brain.storage,
            config: {},
            log: (message, level) => {
                if (level === 'error') {
                    prodLog.error(message);
                }
                else if (level === 'warn') {
                    prodLog.warn(message);
                }
                else {
                    prodLog.info(message);
                }
            }
        };
        await this.neuralImport.initialize(context);
        // Get type matcher
        const { getBrainyTypes } = await import('./augmentations/typeMatching/brainyTypes.js');
        this.typeMatcher = await getBrainyTypes();
    }
    /**
     * Main import method - handles all sources
     */
    async import(source, options = {}) {
        const result = {
            success: false,
            nouns: [],
            verbs: [],
            errors: [],
            stats: {
                total: 0,
                imported: 0,
                failed: 0,
                relationships: 0
            }
        };
        try {
            // Detect source type
            const sourceType = await this.detectSourceType(source, options.source);
            // Get data based on source type
            let data;
            let format = options.format || 'auto';
            switch (sourceType) {
                case 'url':
                    data = await this.fetchFromUrl(source);
                    break;
                case 'file':
                    const filePath = source;
                    data = await this.readFile(filePath);
                    if (format === 'auto') {
                        format = this.detectFormatFromPath(filePath);
                    }
                    break;
                case 'data':
                default:
                    data = source;
                    break;
            }
            // Process data through neural import
            let items;
            let relationships = [];
            if (Buffer.isBuffer(data) || typeof data === 'string') {
                // Use neural import for parsing and analysis
                const analysis = await this.neuralImport.getNeuralAnalysis(data, format);
                // Extract items and relationships
                items = analysis.detectedEntities.map(entity => ({
                    data: entity.originalData,
                    type: entity.nounType,
                    confidence: entity.confidence,
                    id: entity.suggestedId
                }));
                if (options.extractRelationships !== false) {
                    relationships = analysis.detectedRelationships;
                }
                // Log insights
                for (const insight of analysis.insights) {
                    prodLog.info(`🧠 ${insight.description} (confidence: ${insight.confidence})`);
                }
            }
            else if (Array.isArray(data)) {
                items = data;
            }
            else {
                items = [data];
            }
            result.stats.total = items.length;
            // Import items in batches
            const batchSize = options.batchSize || 50;
            for (let i = 0; i < items.length; i += batchSize) {
                const batch = items.slice(i, i + batchSize);
                // Process batch in parallel if enabled
                const promises = batch.map(async (item) => {
                    try {
                        // Detect type if needed
                        let nounType = item.type || options.typeHint;
                        if (!nounType && options.autoDetect !== false && this.typeMatcher) {
                            const match = await this.typeMatcher.matchNounType(item.data || item);
                            nounType = match.type;
                        }
                        // Prepare the data to import
                        const dataToImport = item.data || item;
                        // Create metadata combining original data with import metadata
                        const metadata = {
                            ...(typeof dataToImport === 'object' ? dataToImport : {}),
                            ...(item.data?.metadata || {}),
                            nounType,
                            _importedAt: new Date().toISOString(),
                            _confidence: item.confidence
                        };
                        // Add to brain using proper API signature: addNoun(vectorOrData, nounType, metadata)
                        const id = await this.brain.addNoun(dataToImport, nounType || 'content', metadata);
                        result.nouns.push(id);
                        result.stats.imported++;
                        return id;
                    }
                    catch (error) {
                        result.errors.push(`Failed to import item: ${error.message}`);
                        result.stats.failed++;
                        return null;
                    }
                });
                if (options.parallel !== false) {
                    await Promise.all(promises);
                }
                else {
                    for (const promise of promises) {
                        await promise;
                    }
                }
            }
            // Import relationships
            for (const rel of relationships) {
                try {
                    // Match verb type if needed
                    let verbType = rel.verbType;
                    if (!Object.values(VerbType).includes(verbType) && this.typeMatcher) {
                        const match = await this.typeMatcher.matchVerbType({ id: rel.sourceId }, { id: rel.targetId }, rel.verbType);
                        verbType = match.type;
                    }
                    const verbId = await this.brain.addVerb(rel.sourceId, rel.targetId, verbType, rel.metadata, rel.weight);
                    result.verbs.push(verbId);
                    result.stats.relationships++;
                }
                catch (error) {
                    result.errors.push(`Failed to create relationship: ${error.message}`);
                }
            }
            result.success = result.stats.imported > 0;
            prodLog.info(`✨ Import complete: ${result.stats.imported}/${result.stats.total} items, ${result.stats.relationships} relationships`);
        }
        catch (error) {
            result.errors.push(`Import failed: ${error.message}`);
            prodLog.error('Import failed:', error);
        }
        return result;
    }
    /**
     * Import from file
     */
    async importFile(filePath, options = {}) {
        return this.import(filePath, { ...options, source: 'file' });
    }
    /**
     * Import from URL
     */
    async importUrl(url, options = {}) {
        return this.import(url, { ...options, source: 'url' });
    }
    /**
     * Detect source type
     */
    async detectSourceType(source, hint) {
        if (hint && hint !== 'auto') {
            return hint;
        }
        if (typeof source === 'string') {
            // Check if URL
            if (source.startsWith('http://') || source.startsWith('https://')) {
                return 'url';
            }
            // Check if file path exists
            try {
                if (await fs.exists(source)) {
                    return 'file';
                }
            }
            catch { }
        }
        return 'data';
    }
    /**
     * Detect format from file path
     */
    detectFormatFromPath(filePath) {
        const ext = path.extname(filePath).toLowerCase();
        switch (ext) {
            case '.json': return 'json';
            case '.csv': return 'csv';
            case '.txt': return 'text';
            case '.md': return 'text';
            case '.yaml':
            case '.yml': return 'yaml';
            default: return 'auto';
        }
    }
    /**
     * Read file
     */
    async readFile(filePath) {
        const content = await fs.readFile(filePath, 'utf8');
        return Buffer.from(content, 'utf8');
    }
    /**
     * Fetch from URL
     */
    async fetchFromUrl(url) {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Failed to fetch ${url}: ${response.statusText}`);
        }
        return response.text();
    }
}
/**
 * Create an import manager instance
 */
export function createImportManager(brain) {
    return new ImportManager(brain);
}
//# sourceMappingURL=importManager.js.map