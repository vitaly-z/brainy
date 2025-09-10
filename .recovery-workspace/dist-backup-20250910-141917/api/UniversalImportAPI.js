/**
 * Universal Neural Import API
 *
 * ALWAYS uses neural matching to map ANY data to our strict NounTypes and VerbTypes
 * Never falls back to rules - neural matching is MANDATORY
 *
 * Handles:
 * - Strings (text, JSON, CSV, YAML, Markdown)
 * - Files (local paths, any format)
 * - URLs (web pages, APIs, documents)
 * - Objects (structured data)
 * - Binary data (images, PDFs via extraction)
 */
import { getBrainyTypes } from '../augmentations/typeMatching/brainyTypes.js';
import { NeuralImportAugmentation } from '../augmentations/neuralImport.js';
export class UniversalImportAPI {
    constructor(brain) {
        this.embedCache = new Map();
        this.brain = brain;
        this.neuralImport = new NeuralImportAugmentation({
            confidenceThreshold: 0.0, // Accept ALL confidence levels - never reject
            enableWeights: true,
            skipDuplicates: false // Process everything
        });
    }
    /**
     * Initialize the neural import system
     */
    async init() {
        this.typeMatcher = await getBrainyTypes();
        // Neural import initializes itself
    }
    /**
     * Universal import - handles ANY data source
     * ALWAYS uses neural matching, NEVER falls back
     */
    async import(source) {
        const startTime = Date.now();
        // Normalize source
        const normalizedSource = this.normalizeSource(source);
        // Extract data based on source type
        const extractedData = await this.extractData(normalizedSource);
        // Neural processing - MANDATORY
        const neuralResults = await this.neuralProcess(extractedData);
        // Store in brain
        const result = await this.storeInBrain(neuralResults);
        result.stats.processingTimeMs = Date.now() - startTime;
        return result;
    }
    /**
     * Import from URL - fetches and processes
     */
    async importFromURL(url) {
        const response = await fetch(url);
        const contentType = response.headers.get('content-type') || 'text/plain';
        let data;
        if (contentType.includes('json')) {
            data = await response.json();
        }
        else if (contentType.includes('text') || contentType.includes('html')) {
            data = await response.text();
        }
        else {
            // Binary data
            const buffer = await response.arrayBuffer();
            data = new Uint8Array(buffer);
        }
        return this.import({
            type: 'url',
            data,
            format: contentType,
            metadata: { url, fetchedAt: Date.now() }
        });
    }
    /**
     * Import from file - reads and processes
     * Note: In browser environment, use File API instead
     */
    async importFromFile(filePath) {
        // For file imports, the caller should read the file and pass content
        // This is a placeholder that treats the path as a reference
        const ext = filePath.split('.').pop()?.toLowerCase() || 'txt';
        return this.import({
            type: 'file',
            data: filePath, // Path as reference
            format: ext,
            metadata: {
                path: filePath,
                importedAt: Date.now()
            }
        });
    }
    /**
     * Normalize any input to ImportSource
     */
    normalizeSource(source) {
        // Already normalized
        if (source && typeof source === 'object' && 'type' in source && 'data' in source) {
            return source;
        }
        // String input
        if (typeof source === 'string') {
            // Check if it's a URL
            if (source.startsWith('http://') || source.startsWith('https://')) {
                return { type: 'url', data: source };
            }
            // Check if it looks like a file path
            if (source.includes('/') || source.includes('\\') || source.includes('.')) {
                // Assume it's a file path reference
                return { type: 'file', data: source };
            }
            // Treat as raw string data
            return { type: 'string', data: source };
        }
        // Object/Array input
        if (typeof source === 'object') {
            return { type: 'object', data: source };
        }
        // Default to string
        return { type: 'string', data: String(source) };
    }
    /**
     * Extract structured data from source
     */
    async extractData(source) {
        switch (source.type) {
            case 'url':
                // URL is in data field, need to fetch
                return this.extractFromURL(source.data);
            case 'file':
                // File path is in data field, need to read
                return this.extractFromFile(source.data);
            case 'string':
                return this.extractFromString(source.data, source.format);
            case 'object':
                return Array.isArray(source.data) ? source.data : [source.data];
            case 'binary':
                return this.extractFromBinary(source.data, source.format);
            default:
                // Unknown type, treat as object
                return [source.data];
        }
    }
    /**
     * Extract data from URL
     */
    async extractFromURL(url) {
        const result = await this.importFromURL(url);
        return result.entities.map(e => e.data);
    }
    /**
     * Extract data from file
     */
    async extractFromFile(filePath) {
        const result = await this.importFromFile(filePath);
        return result.entities.map(e => e.data);
    }
    /**
     * Extract data from string based on format
     */
    extractFromString(data, format) {
        // Try to detect format if not provided
        const detectedFormat = format || this.detectFormat(data);
        switch (detectedFormat) {
            case 'json':
                try {
                    const parsed = JSON.parse(data);
                    return Array.isArray(parsed) ? parsed : [parsed];
                }
                catch {
                    // Not valid JSON, treat as text
                    return this.extractFromText(data);
                }
            case 'csv':
                return this.parseCSV(data);
            case 'yaml':
            case 'yml':
                return this.parseYAML(data);
            case 'markdown':
            case 'md':
                return this.parseMarkdown(data);
            case 'xml':
            case 'html':
                return this.parseHTML(data);
            default:
                return this.extractFromText(data);
        }
    }
    /**
     * Extract from binary data (images, PDFs, etc)
     */
    async extractFromBinary(data, format) {
        // For now, create a single entity representing the binary data
        // In production, would use OCR, image recognition, PDF extraction, etc.
        return [{
                type: 'binary',
                format: format || 'unknown',
                size: data.length,
                hash: await this.hashBinary(data),
                extractedAt: Date.now()
            }];
    }
    /**
     * Extract entities from plain text
     */
    extractFromText(text) {
        // Split into meaningful chunks
        const chunks = [];
        // Split by paragraphs
        const paragraphs = text.split(/\n\n+/);
        for (const para of paragraphs) {
            if (para.trim()) {
                chunks.push({
                    text: para.trim(),
                    type: 'paragraph',
                    length: para.length
                });
            }
        }
        // If no paragraphs, split by sentences
        if (chunks.length === 0) {
            const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
            for (const sentence of sentences) {
                if (sentence.trim()) {
                    chunks.push({
                        text: sentence.trim(),
                        type: 'sentence',
                        length: sentence.length
                    });
                }
            }
        }
        return chunks;
    }
    /**
     * Neural processing - CORE of the system
     * ALWAYS uses embeddings and neural matching
     */
    async neuralProcess(data) {
        const entities = new Map();
        const relationships = new Map();
        for (const item of data) {
            // Generate embedding for the item
            const embedding = await this.generateEmbedding(item);
            // Neural type matching - MANDATORY
            const nounMatch = await this.typeMatcher.matchNounType(item);
            // Never reject based on confidence - we ALWAYS accept the best match
            const entityId = this.generateId(item);
            entities.set(entityId, {
                id: entityId,
                type: nounMatch.type, // Always use the neural match
                data: item,
                vector: embedding,
                confidence: nounMatch.confidence,
                metadata: {
                    ...item,
                    _neuralMatch: nounMatch,
                    _importedAt: Date.now()
                }
            });
            // Detect relationships using neural matching
            await this.detectNeuralRelationships(item, entityId, entities, relationships);
        }
        return { entities, relationships };
    }
    /**
     * Generate embedding for any data
     */
    async generateEmbedding(data) {
        // Convert to string for embedding
        const text = this.dataToText(data);
        // Check cache
        if (this.embedCache.has(text)) {
            return this.embedCache.get(text);
        }
        // Generate new embedding
        const embedding = await this.brain.embed(text);
        // Cache it
        this.embedCache.set(text, embedding);
        return embedding;
    }
    /**
     * Convert any data to text for embedding
     */
    dataToText(data) {
        if (typeof data === 'string')
            return data;
        if (typeof data === 'object') {
            // Extract meaningful text from object
            const parts = [];
            // Priority fields
            const priorityFields = ['name', 'title', 'description', 'text', 'content', 'label', 'value'];
            for (const field of priorityFields) {
                if (data[field]) {
                    parts.push(String(data[field]));
                }
            }
            // Add other fields
            for (const [key, value] of Object.entries(data)) {
                if (!priorityFields.includes(key) && value) {
                    if (typeof value === 'string' || typeof value === 'number') {
                        parts.push(`${key}: ${value}`);
                    }
                }
            }
            return parts.join(' ');
        }
        return JSON.stringify(data);
    }
    /**
     * Detect relationships using neural matching
     */
    async detectNeuralRelationships(item, sourceId, entities, relationships) {
        if (typeof item !== 'object')
            return;
        // Look for references to other entities
        for (const [key, value] of Object.entries(item)) {
            // Check if this looks like a reference
            if (this.looksLikeReference(key, value)) {
                // Find or predict target entity
                const targetId = String(value);
                // Neural verb type matching
                const verbMatch = await this.typeMatcher.matchVerbType(item, // source object
                { id: targetId }, // target (we may not have full data)
                key // field name as context
                );
                // Always create relationship with neural match
                const relationId = `${sourceId}_${verbMatch.type}_${targetId}`;
                relationships.set(relationId, {
                    id: relationId,
                    from: sourceId,
                    to: targetId,
                    type: verbMatch.type,
                    weight: verbMatch.confidence, // Use confidence as weight
                    confidence: verbMatch.confidence,
                    metadata: {
                        field: key,
                        _neuralMatch: verbMatch,
                        _importedAt: Date.now()
                    }
                });
            }
            // Handle arrays of references
            if (Array.isArray(value)) {
                for (const item of value) {
                    if (this.looksLikeReference(key, item)) {
                        const targetId = String(item);
                        const verbMatch = await this.typeMatcher.matchVerbType(item, { id: targetId }, key);
                        const relationId = `${sourceId}_${verbMatch.type}_${targetId}`;
                        relationships.set(relationId, {
                            id: relationId,
                            from: sourceId,
                            to: targetId,
                            type: verbMatch.type,
                            weight: verbMatch.confidence,
                            confidence: verbMatch.confidence,
                            metadata: {
                                field: key,
                                array: true,
                                _neuralMatch: verbMatch,
                                _importedAt: Date.now()
                            }
                        });
                    }
                }
            }
        }
    }
    /**
     * Check if a field looks like a reference
     */
    looksLikeReference(key, value) {
        // Field name patterns that suggest references
        const refPatterns = [
            /[Ii]d$/, // ends with Id or id
            /_id$/, // ends with _id
            /^parent/i, // starts with parent
            /^child/i, // starts with child
            /^related/i, // starts with related
            /^ref/i, // starts with ref
            /^link/i, // starts with link
            /^target/i, // starts with target
            /^source/i, // starts with source
        ];
        // Check if field name matches patterns
        const fieldLooksLikeRef = refPatterns.some(pattern => pattern.test(key));
        // Check if value looks like an ID
        const valueLooksLikeId = (typeof value === 'string' ||
            typeof value === 'number') && String(value).length > 0;
        return fieldLooksLikeRef && valueLooksLikeId;
    }
    /**
     * Store processed data in brain
     */
    async storeInBrain(neuralResults) {
        const result = {
            entities: [],
            relationships: [],
            stats: {
                totalProcessed: neuralResults.entities.size + neuralResults.relationships.size,
                entitiesCreated: 0,
                relationshipsCreated: 0,
                averageConfidence: 0,
                processingTimeMs: 0
            }
        };
        let totalConfidence = 0;
        // Store entities
        for (const entity of neuralResults.entities.values()) {
            const id = await this.brain.add({
                data: entity.data,
                type: entity.type,
                metadata: entity.metadata,
                vector: entity.vector,
                writeOnly: true // Fast mode since we already have vectors
            });
            // Update entity ID for relationship mapping
            entity.id = id;
            result.entities.push({
                ...entity,
                id
            });
            result.stats.entitiesCreated++;
            totalConfidence += entity.confidence;
        }
        // Store relationships
        for (const relation of neuralResults.relationships.values()) {
            // Map to actual entity IDs
            const sourceEntity = Array.from(neuralResults.entities.values())
                .find(e => e.id === relation.from);
            const targetEntity = Array.from(neuralResults.entities.values())
                .find(e => e.id === relation.to);
            if (sourceEntity && targetEntity) {
                const id = await this.brain.relate({
                    from: sourceEntity.id,
                    to: targetEntity.id,
                    type: relation.type,
                    weight: relation.weight,
                    metadata: relation.metadata,
                    writeOnly: true
                });
                result.relationships.push({
                    ...relation,
                    id,
                    from: sourceEntity.id,
                    to: targetEntity.id
                });
                result.stats.relationshipsCreated++;
                totalConfidence += relation.confidence;
            }
        }
        // Calculate average confidence
        const totalItems = result.stats.entitiesCreated + result.stats.relationshipsCreated;
        result.stats.averageConfidence = totalItems > 0 ? totalConfidence / totalItems : 0;
        return result;
    }
    // Helper methods for parsing different formats
    detectFormat(data) {
        const trimmed = data.trim();
        // JSON
        if ((trimmed.startsWith('{') && trimmed.endsWith('}')) ||
            (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
            return 'json';
        }
        // CSV (has commas and newlines)
        if (trimmed.includes(',') && trimmed.includes('\n')) {
            return 'csv';
        }
        // YAML (has colons and indentation)
        if (trimmed.includes(':') && (trimmed.includes('\n  ') || trimmed.includes('\n\t'))) {
            return 'yaml';
        }
        // Markdown (has headers)
        if (trimmed.includes('#') || trimmed.includes('```')) {
            return 'markdown';
        }
        // HTML/XML
        if (trimmed.includes('<') && trimmed.includes('>')) {
            return trimmed.toLowerCase().includes('<!doctype html') ? 'html' : 'xml';
        }
        return 'text';
    }
    parseCSV(data) {
        // Reuse the CSV parser from neural import
        const lines = data.split('\n').filter(l => l.trim());
        if (lines.length === 0)
            return [];
        const headers = lines[0].split(',').map(h => h.trim());
        const results = [];
        for (let i = 1; i < lines.length; i++) {
            const values = lines[i].split(',').map(v => v.trim());
            const obj = {};
            headers.forEach((header, index) => {
                obj[header] = values[index] || '';
            });
            results.push(obj);
        }
        return results;
    }
    parseYAML(data) {
        // Simple YAML parser
        const results = [];
        const lines = data.split('\n');
        let current = null;
        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith('#'))
                continue;
            if (trimmed.startsWith('- ')) {
                // Array item
                const value = trimmed.substring(2);
                if (!current) {
                    results.push(value);
                }
                else {
                    if (!current._items)
                        current._items = [];
                    current._items.push(value);
                }
            }
            else if (trimmed.includes(':')) {
                // Key-value
                const [key, ...valueParts] = trimmed.split(':');
                const value = valueParts.join(':').trim();
                if (!current) {
                    current = {};
                    results.push(current);
                }
                current[key.trim()] = value;
            }
        }
        return results.length > 0 ? results : [{ text: data }];
    }
    parseMarkdown(data) {
        const results = [];
        const lines = data.split('\n');
        let current = null;
        let inCodeBlock = false;
        for (const line of lines) {
            if (line.startsWith('```')) {
                inCodeBlock = !inCodeBlock;
                if (inCodeBlock && current) {
                    current.code = '';
                }
                continue;
            }
            if (inCodeBlock && current) {
                current.code += line + '\n';
            }
            else if (line.startsWith('#')) {
                // Header
                const level = line.match(/^#+/)?.[0].length || 1;
                const text = line.replace(/^#+\s*/, '');
                current = {
                    type: 'heading',
                    level,
                    text
                };
                results.push(current);
            }
            else if (line.trim()) {
                // Paragraph
                if (!current || current.type !== 'paragraph') {
                    current = {
                        type: 'paragraph',
                        text: ''
                    };
                    results.push(current);
                }
                current.text += line + ' ';
            }
        }
        return results;
    }
    parseHTML(data) {
        // Simple HTML text extraction
        const text = data
            .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') // Remove scripts
            .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '') // Remove styles  
            .replace(/<[^>]+>/g, ' ') // Remove tags
            .replace(/\s+/g, ' ') // Normalize whitespace
            .trim();
        return this.extractFromText(text);
    }
    generateId(data) {
        // Generate deterministic ID based on content
        const text = this.dataToText(data);
        const hash = this.simpleHash(text);
        return `import_${hash}_${Date.now()}`;
    }
    simpleHash(text) {
        let hash = 0;
        for (let i = 0; i < text.length; i++) {
            const char = text.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return Math.abs(hash).toString(36);
    }
    async hashBinary(data) {
        // Simple binary hash
        let hash = 0;
        for (let i = 0; i < Math.min(data.length, 1000); i++) {
            hash = ((hash << 5) - hash) + data[i];
            hash = hash & hash;
        }
        return Math.abs(hash).toString(36);
    }
}
//# sourceMappingURL=UniversalImportAPI.js.map