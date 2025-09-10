/**
 * 🧠 Pattern Library for Natural Language Processing
 * Manages pre-computed pattern embeddings and smart matching
 *
 * Uses Brainy's own features for self-leveraging intelligence:
 * - Embeddings for semantic similarity
 * - Pattern caching for performance
 * - Progressive learning from usage
 */
import { EMBEDDED_PATTERNS, getPatternEmbeddings, PATTERNS_METADATA } from './embeddedPatterns.js';
export class PatternLibrary {
    constructor(brain) {
        this.brain = brain;
        this.patterns = new Map();
        this.patternEmbeddings = new Map();
        this.embeddingCache = new Map();
        this.successMetrics = new Map();
    }
    /**
     * Initialize pattern library with pre-computed embeddings
     */
    async init() {
        // Try to load pre-computed embeddings first
        const precomputedEmbeddings = getPatternEmbeddings();
        if (precomputedEmbeddings.size > 0) {
            // Use pre-computed embeddings (instant!)
            console.debug(`Loading ${precomputedEmbeddings.size} pre-computed pattern embeddings`);
            for (const pattern of EMBEDDED_PATTERNS) {
                this.patterns.set(pattern.id, pattern);
                this.successMetrics.set(pattern.id, pattern.confidence);
                const embedding = precomputedEmbeddings.get(pattern.id);
                if (embedding) {
                    this.patternEmbeddings.set(pattern.id, Array.from(embedding));
                }
            }
            console.debug(`Pattern library ready: ${PATTERNS_METADATA.totalPatterns} patterns loaded instantly`);
        }
        else {
            // Fall back to runtime computation
            console.debug('No pre-computed embeddings found, computing at runtime...');
            for (const pattern of EMBEDDED_PATTERNS) {
                this.patterns.set(pattern.id, pattern);
                this.successMetrics.set(pattern.id, pattern.confidence);
            }
            // Compute embeddings for all patterns
            await this.precomputeEmbeddings();
        }
    }
    /**
     * Pre-compute embeddings for all patterns for fast matching
     */
    async precomputeEmbeddings() {
        for (const [id, pattern] of this.patterns) {
            // Average embeddings of all examples for robust representation
            const embeddings = [];
            for (const example of pattern.examples) {
                const embedding = await this.getEmbedding(example);
                embeddings.push(embedding);
            }
            // Average the embeddings
            const avgEmbedding = this.averageVectors(embeddings);
            this.patternEmbeddings.set(id, avgEmbedding);
        }
    }
    /**
     * Get embedding with caching
     */
    async getEmbedding(text) {
        if (this.embeddingCache.has(text)) {
            return this.embeddingCache.get(text);
        }
        // Use add/get/delete pattern to get embeddings
        const id = await this.brain.add({
            data: text,
            type: 'document'
        });
        const entity = await this.brain.get(id);
        const embedding = entity?.vector || [];
        // Clean up temporary entity
        await this.brain.delete(id);
        this.embeddingCache.set(text, embedding);
        return embedding;
    }
    /**
     * Find best matching patterns for a query
     */
    async findBestPatterns(queryEmbedding, k = 3) {
        const matches = [];
        // Calculate similarity with all patterns
        for (const [id, patternEmbedding] of this.patternEmbeddings) {
            const similarity = this.cosineSimilarity(queryEmbedding, patternEmbedding);
            const pattern = this.patterns.get(id);
            // Apply success metric boost
            const successBoost = this.successMetrics.get(id) || 0.5;
            const adjustedSimilarity = similarity * (0.7 + 0.3 * successBoost);
            matches.push({
                pattern,
                similarity: adjustedSimilarity
            });
        }
        // Sort by similarity and return top k
        matches.sort((a, b) => b.similarity - a.similarity);
        return matches.slice(0, k);
    }
    /**
     * Extract slots from query based on pattern with enhanced fuzzy matching
     */
    extractSlots(query, pattern) {
        const slots = {};
        const errors = [];
        let confidence = pattern.confidence;
        // If pattern has named slot definitions, use them
        if (pattern.slots && pattern.slots.length > 0) {
            return this.extractNamedSlots(query, pattern);
        }
        // Try regex extraction first
        const regex = new RegExp(pattern.pattern, 'i');
        const match = query.match(regex);
        if (match) {
            // Extract captured groups as slots
            for (let i = 1; i < match.length; i++) {
                slots[`$${i}`] = match[i];
            }
            // High confidence if regex matches
            confidence = Math.min(confidence * 1.2, 1.0);
        }
        else {
            // Enhanced fuzzy matching with Levenshtein distance
            const fuzzyResult = this.fuzzyExtractSlots(query, pattern);
            Object.assign(slots, fuzzyResult.slots);
            confidence = fuzzyResult.confidence;
            if (fuzzyResult.errors) {
                errors.push(...fuzzyResult.errors);
            }
        }
        // Post-process slots
        this.postProcessSlots(slots, pattern);
        return { slots, confidence, errors: errors.length > 0 ? errors : undefined };
    }
    /**
     * Extract named slots with type validation
     */
    extractNamedSlots(query, pattern) {
        const slots = {};
        const errors = [];
        let confidence = pattern.confidence;
        if (!pattern.slots) {
            return { slots, confidence };
        }
        // Create a flexible regex from pattern
        let flexiblePattern = pattern.pattern;
        const slotPositions = new Map();
        // Replace named slots in pattern with capture groups
        pattern.slots.forEach((slot, index) => {
            const slotPattern = slot.pattern || this.getDefaultPatternForType(slot.type);
            flexiblePattern = flexiblePattern.replace(new RegExp(`\\{${slot.name}\\}`, 'g'), `(${slotPattern})`);
            slotPositions.set(index + 1, slot);
        });
        const regex = new RegExp(flexiblePattern, 'i');
        const match = query.match(regex);
        if (match) {
            // Extract and validate each slot
            slotPositions.forEach((slotDef, position) => {
                const value = match[position];
                if (value) {
                    // Apply transformation if defined
                    const transformedValue = slotDef.transform
                        ? slotDef.transform(value)
                        : this.transformByType(value, slotDef.type);
                    // Validate the value
                    if (this.validateSlotValue(transformedValue, slotDef)) {
                        slots[slotDef.name] = transformedValue;
                    }
                    else {
                        errors.push(`Invalid value for slot '${slotDef.name}': expected ${slotDef.type}, got '${value}'`);
                        confidence *= 0.8;
                    }
                }
                else if (slotDef.required) {
                    if (slotDef.default !== undefined) {
                        slots[slotDef.name] = slotDef.default;
                    }
                    else {
                        errors.push(`Required slot '${slotDef.name}' not found`);
                        confidence *= 0.5;
                    }
                }
            });
        }
        else {
            // Try fuzzy matching for named slots
            const fuzzyResult = this.fuzzyExtractNamedSlots(query, pattern);
            Object.assign(slots, fuzzyResult.slots);
            confidence = fuzzyResult.confidence;
            if (fuzzyResult.errors) {
                errors.push(...fuzzyResult.errors);
            }
        }
        return { slots, confidence, errors: errors.length > 0 ? errors : undefined };
    }
    /**
     * Fuzzy extraction using Levenshtein distance
     */
    fuzzyExtractSlots(query, pattern) {
        const slots = {};
        let bestConfidence = 0;
        // Try each example with fuzzy matching
        for (const example of pattern.examples) {
            const distance = this.levenshteinDistance(query.toLowerCase(), example.toLowerCase());
            const similarity = 1 - (distance / Math.max(query.length, example.length));
            if (similarity > 0.6) { // 60% similarity threshold
                // Extract slots using alignment
                const aligned = this.alignStrings(query, example);
                const extractedSlots = this.extractSlotsFromAlignment(aligned, pattern);
                if (Object.keys(extractedSlots).length > 0) {
                    const currentConfidence = pattern.confidence * similarity;
                    if (currentConfidence > bestConfidence) {
                        Object.assign(slots, extractedSlots);
                        bestConfidence = currentConfidence;
                    }
                }
            }
        }
        return {
            slots,
            confidence: bestConfidence,
            errors: bestConfidence < 0.5 ? ['Low confidence fuzzy match'] : undefined
        };
    }
    /**
     * Fuzzy extraction for named slots
     */
    fuzzyExtractNamedSlots(query, pattern) {
        const slots = {};
        const errors = [];
        let confidence = pattern.confidence * 0.7; // Lower confidence for fuzzy
        if (!pattern.slots) {
            return { slots, confidence };
        }
        // Tokenize query for flexible matching
        const tokens = this.tokenize(query);
        pattern.slots.forEach(slotDef => {
            const value = this.findSlotValueInTokens(tokens, slotDef);
            if (value) {
                const transformedValue = slotDef.transform
                    ? slotDef.transform(value)
                    : this.transformByType(value, slotDef.type);
                if (this.validateSlotValue(transformedValue, slotDef)) {
                    slots[slotDef.name] = transformedValue;
                }
                else {
                    errors.push(`Fuzzy match: uncertain value for '${slotDef.name}'`);
                    confidence *= 0.9;
                }
            }
            else if (slotDef.required && slotDef.default !== undefined) {
                slots[slotDef.name] = slotDef.default;
            }
        });
        return { slots, confidence, errors: errors.length > 0 ? errors : undefined };
    }
    /**
     * Find slot value in tokens based on type
     */
    findSlotValueInTokens(tokens, slotDef) {
        const joinedTokens = tokens.join(' ');
        switch (slotDef.type) {
            case 'number':
                const numberMatch = joinedTokens.match(/\d+(\.\d+)?/);
                return numberMatch ? numberMatch[0] : null;
            case 'date':
                const datePatterns = [
                    /\d{4}-\d{2}-\d{2}/,
                    /\d{1,2}\/\d{1,2}\/\d{2,4}/,
                    /(january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{1,2},?\s+\d{4}/i,
                    /(today|tomorrow|yesterday)/i
                ];
                for (const pattern of datePatterns) {
                    const match = joinedTokens.match(pattern);
                    if (match)
                        return match[0];
                }
                return null;
            case 'person':
                // Look for capitalized words (proper nouns)
                const personMatch = joinedTokens.match(/\b[A-Z][a-z]+(\s+[A-Z][a-z]+)*\b/);
                return personMatch ? personMatch[0] : null;
            case 'location':
                // Look for location indicators
                const locationPatterns = [
                    /\b(in|at|from|to)\s+([A-Z][a-z]+(\s+[A-Z][a-z]+)*)\b/,
                    /\b[A-Z][a-z]+,\s+[A-Z]{2}\b/ // City, STATE format
                ];
                for (const pattern of locationPatterns) {
                    const match = joinedTokens.match(pattern);
                    if (match)
                        return match[2] || match[0];
                }
                return null;
            case 'entity':
            case 'text':
            case 'any':
            default:
                // Return first non-common word as potential value
                const commonWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for']);
                const significantToken = tokens.find(t => !commonWords.has(t.toLowerCase()));
                return significantToken || null;
        }
    }
    /**
     * Get default regex pattern for slot type
     */
    getDefaultPatternForType(type) {
        switch (type) {
            case 'number':
                return '\\d+(?:\\.\\d+)?';
            case 'date':
                return '[\\w\\s,/-]+';
            case 'person':
                return '[A-Z][a-z]+(?:\\s+[A-Z][a-z]+)*';
            case 'location':
                return '[A-Z][a-z]+(?:[\\s,]+[A-Z][a-z]+)*';
            case 'entity':
                return '[\\w\\s-]+';
            case 'text':
            case 'any':
            default:
                return '.+';
        }
    }
    /**
     * Transform value based on type
     */
    transformByType(value, type) {
        switch (type) {
            case 'number':
                const num = parseFloat(value);
                return isNaN(num) ? value : num;
            case 'date':
                // Simple date parsing
                if (value.toLowerCase() === 'today') {
                    return new Date().toISOString().split('T')[0];
                }
                else if (value.toLowerCase() === 'tomorrow') {
                    const tomorrow = new Date();
                    tomorrow.setDate(tomorrow.getDate() + 1);
                    return tomorrow.toISOString().split('T')[0];
                }
                else if (value.toLowerCase() === 'yesterday') {
                    const yesterday = new Date();
                    yesterday.setDate(yesterday.getDate() - 1);
                    return yesterday.toISOString().split('T')[0];
                }
                return value;
            case 'person':
            case 'location':
            case 'entity':
                // Capitalize properly
                return value.split(' ')
                    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
                    .join(' ');
            default:
                return value.trim();
        }
    }
    /**
     * Validate slot value against definition
     */
    validateSlotValue(value, slotDef) {
        if (value === null || value === undefined) {
            return !slotDef.required;
        }
        switch (slotDef.type) {
            case 'number':
                return typeof value === 'number' && !isNaN(value);
            case 'date':
                return typeof value === 'string' && value.length > 0;
            case 'text':
            case 'person':
            case 'location':
            case 'entity':
                return typeof value === 'string' && value.length > 0;
            case 'any':
                return true;
            default:
                return true;
        }
    }
    /**
     * Calculate Levenshtein distance between two strings
     */
    levenshteinDistance(s1, s2) {
        const len1 = s1.length;
        const len2 = s2.length;
        const matrix = [];
        for (let i = 0; i <= len1; i++) {
            matrix[i] = [i];
        }
        for (let j = 0; j <= len2; j++) {
            matrix[0][j] = j;
        }
        for (let i = 1; i <= len1; i++) {
            for (let j = 1; j <= len2; j++) {
                const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
                matrix[i][j] = Math.min(matrix[i - 1][j] + 1, // deletion
                matrix[i][j - 1] + 1, // insertion
                matrix[i - 1][j - 1] + cost // substitution
                );
            }
        }
        return matrix[len1][len2];
    }
    /**
     * Align two strings for slot extraction
     */
    alignStrings(query, example) {
        const queryTokens = this.tokenize(query);
        const exampleTokens = this.tokenize(example);
        const aligned = [];
        let i = 0, j = 0;
        while (i < queryTokens.length && j < exampleTokens.length) {
            if (queryTokens[i] === exampleTokens[j]) {
                aligned.push([queryTokens[i], exampleTokens[j]]);
                i++;
                j++;
            }
            else {
                // Try to find best match
                const bestMatch = this.findBestTokenMatch(queryTokens[i], exampleTokens.slice(j, j + 3));
                if (bestMatch.index >= 0) {
                    j += bestMatch.index;
                    aligned.push([queryTokens[i], exampleTokens[j]]);
                }
                else {
                    aligned.push([queryTokens[i], exampleTokens[j]]);
                }
                i++;
                j++;
            }
        }
        return aligned;
    }
    /**
     * Find best token match using fuzzy comparison
     */
    findBestTokenMatch(token, candidates) {
        let bestIndex = -1;
        let bestSimilarity = 0;
        candidates.forEach((candidate, index) => {
            const distance = this.levenshteinDistance(token.toLowerCase(), candidate.toLowerCase());
            const similarity = 1 - (distance / Math.max(token.length, candidate.length));
            if (similarity > bestSimilarity && similarity > 0.6) {
                bestIndex = index;
                bestSimilarity = similarity;
            }
        });
        return { index: bestIndex, similarity: bestSimilarity };
    }
    /**
     * Extract slots from string alignment
     */
    extractSlotsFromAlignment(aligned, _pattern) {
        const slots = {};
        let slotIndex = 1;
        aligned.forEach(([queryToken, exampleToken]) => {
            if (exampleToken.startsWith('$')) {
                slots[`$${slotIndex}`] = queryToken;
                slotIndex++;
            }
        });
        return slots;
    }
    /**
     * Fill template with extracted slots
     */
    fillTemplate(template, slots) {
        const filled = JSON.parse(JSON.stringify(template));
        // Recursively replace slot placeholders
        const replacePlaceholders = (obj) => {
            if (typeof obj === 'string') {
                // Replace ${1}, ${2}, etc. with slot values
                return obj.replace(/\$\{(\d+)\}/g, (_, num) => {
                    return slots[`$${num}`] || '';
                });
            }
            else if (Array.isArray(obj)) {
                return obj.map(item => replacePlaceholders(item));
            }
            else if (typeof obj === 'object' && obj !== null) {
                const result = {};
                for (const [key, value] of Object.entries(obj)) {
                    const newKey = replacePlaceholders(key);
                    result[newKey] = replacePlaceholders(value);
                }
                return result;
            }
            return obj;
        };
        return replacePlaceholders(filled);
    }
    /**
     * Update pattern success metrics based on usage
     */
    updateSuccessMetric(patternId, success) {
        const current = this.successMetrics.get(patternId) || 0.5;
        // Exponential moving average
        const alpha = 0.1;
        const newMetric = success
            ? current + alpha * (1 - current)
            : current - alpha * current;
        this.successMetrics.set(patternId, newMetric);
    }
    /**
     * Learn new pattern from successful query
     */
    async learnPattern(query, result) {
        // Find similar existing patterns
        const queryEmbedding = await this.getEmbedding(query);
        const similar = await this.findBestPatterns(queryEmbedding, 1);
        if (similar[0]?.similarity < 0.7) {
            // This is a new pattern type - add it
            const newPattern = {
                id: `learned_${Date.now()}`,
                category: 'learned',
                examples: [query],
                pattern: this.generateRegexFromQuery(query),
                template: result,
                confidence: 0.6 // Start with moderate confidence
            };
            this.patterns.set(newPattern.id, newPattern);
            this.patternEmbeddings.set(newPattern.id, queryEmbedding);
            this.successMetrics.set(newPattern.id, 0.6);
        }
        else {
            // Similar pattern exists - add as example
            const pattern = similar[0].pattern;
            if (!pattern.examples.includes(query)) {
                pattern.examples.push(query);
                // Update pattern embedding with new example
                const embeddings = await Promise.all(pattern.examples.map(ex => this.getEmbedding(ex)));
                const newEmbedding = this.averageVectors(embeddings);
                this.patternEmbeddings.set(pattern.id, newEmbedding);
            }
        }
    }
    /**
     * Helper: Average multiple vectors
     */
    averageVectors(vectors) {
        if (vectors.length === 0)
            return [];
        const dim = vectors[0].length;
        const avg = new Array(dim).fill(0);
        for (const vec of vectors) {
            for (let i = 0; i < dim; i++) {
                avg[i] += vec[i];
            }
        }
        for (let i = 0; i < dim; i++) {
            avg[i] /= vectors.length;
        }
        return avg;
    }
    /**
     * Helper: Calculate cosine similarity
     */
    cosineSimilarity(a, b) {
        let dotProduct = 0;
        let normA = 0;
        let normB = 0;
        for (let i = 0; i < a.length; i++) {
            dotProduct += a[i] * b[i];
            normA += a[i] * a[i];
            normB += b[i] * b[i];
        }
        normA = Math.sqrt(normA);
        normB = Math.sqrt(normB);
        if (normA === 0 || normB === 0)
            return 0;
        return dotProduct / (normA * normB);
    }
    /**
     * Helper: Simple tokenization
     */
    tokenize(text) {
        return text.toLowerCase().split(/\s+/).filter(t => t.length > 0);
    }
    /**
     * Helper: Post-process extracted slots
     */
    postProcessSlots(slots, _pattern) {
        // Convert string numbers to actual numbers
        for (const [key, value] of Object.entries(slots)) {
            if (typeof value === 'string') {
                // Check if it's a number
                const num = parseFloat(value);
                if (!isNaN(num) && value.match(/^\d+(\.\d+)?$/)) {
                    slots[key] = num;
                }
                // Parse dates
                if (value.match(/\d{4}/) || value.match(/(january|february|march|april|may|june|july|august|september|october|november|december)/i)) {
                    // Simple year extraction
                    const year = value.match(/\d{4}/);
                    if (year) {
                        slots[key] = parseInt(year[0]);
                    }
                }
                // Clean up captured values
                slots[key] = value.trim();
            }
        }
    }
    /**
     * Helper: Generate regex pattern from query
     */
    generateRegexFromQuery(query) {
        // Simple pattern generation - replace variable parts with capture groups
        let pattern = query.toLowerCase();
        // Replace numbers with \d+ capture
        pattern = pattern.replace(/\d+/g, '(\\d+)');
        // Replace quoted strings with .+ capture
        pattern = pattern.replace(/"[^"]+"/g, '(.+)');
        // Replace proper nouns (capitalized words) with capture
        pattern = pattern.replace(/\b[A-Z]\w+\b/g, '([A-Z][\\w]+)');
        return pattern;
    }
    /**
     * Get pattern statistics for monitoring
     */
    getStatistics() {
        const stats = {
            totalPatterns: this.patterns.size,
            categories: {},
            averageConfidence: 0,
            topPatterns: []
        };
        // Count by category
        for (const pattern of this.patterns.values()) {
            stats.categories[pattern.category] = (stats.categories[pattern.category] || 0) + 1;
        }
        // Calculate average confidence
        let totalConfidence = 0;
        for (const confidence of this.successMetrics.values()) {
            totalConfidence += confidence;
        }
        stats.averageConfidence = totalConfidence / this.successMetrics.size;
        // Get top patterns by success
        const sortedPatterns = Array.from(this.successMetrics.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10);
        stats.topPatterns = sortedPatterns.map(([id, success]) => ({ id, success }));
        return stats;
    }
}
//# sourceMappingURL=patternLibrary.js.map