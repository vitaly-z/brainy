/**
 * 🧠 Natural Language Query Processor - STATIC VERSION
 * No runtime initialization, no memory leaks, patterns pre-built at compile time
 *
 * Uses static pattern matching with 220 pre-built patterns
 */
import { patternMatchQuery } from './staticPatternMatcher.js';
export class NaturalLanguageProcessor {
    constructor() {
        this.queryHistory = [];
        // Patterns are static - no initialization needed!
    }
    /**
     * No initialization needed - patterns are pre-built!
     */
    async init() {
        // Nothing to do - patterns are compiled into the code
        return Promise.resolve();
    }
    /**
     * Process natural language query into structured Triple Intelligence query
     * @param naturalQuery The natural language query string
     * @param queryEmbedding Pre-computed embedding from Brainy (passed in to avoid circular dependency)
     */
    async processNaturalQuery(naturalQuery, queryEmbedding) {
        // Use static pattern matcher (no async, no memory allocation!)
        const structuredQuery = patternMatchQuery(naturalQuery, queryEmbedding);
        // Step 3: Enhance with intent analysis if needed
        if (!structuredQuery.where && !structuredQuery.connected) {
            const intent = await this.analyzeIntent(naturalQuery);
            // Add metadata based on intent
            if (intent.type === 'field' && intent.extractedTerms.fields) {
                structuredQuery.where = this.buildFieldConstraints(intent.extractedTerms.fields);
            }
        }
        // Track for learning (but don't create new Brainy!)
        this.queryHistory.push({
            query: naturalQuery,
            result: structuredQuery,
            success: false // Will be updated based on user interaction
        });
        // Keep history limited to prevent memory growth
        if (this.queryHistory.length > 100) {
            this.queryHistory.shift();
        }
        return structuredQuery;
    }
    /**
     * Analyze query intent using keywords
     */
    async analyzeIntent(query) {
        const lowerQuery = query.toLowerCase();
        // Check for field-specific keywords
        const fieldKeywords = ['where', 'filter', 'with', 'has', 'contains', 'equals', 'greater', 'less', 'between'];
        const hasFieldIntent = fieldKeywords.some(kw => lowerQuery.includes(kw));
        // Check for graph keywords
        const graphKeywords = ['related', 'connected', 'linked', 'associated', 'references'];
        const hasGraphIntent = graphKeywords.some(kw => lowerQuery.includes(kw));
        // Determine type
        let type = 'vector';
        if (hasFieldIntent && hasGraphIntent) {
            type = 'combined';
        }
        else if (hasFieldIntent) {
            type = 'field';
        }
        else if (hasGraphIntent) {
            type = 'graph';
        }
        return {
            type,
            confidence: 0.8,
            extractedTerms: {
                fields: hasFieldIntent ? this.extractFieldTerms(query) : undefined,
                relationships: hasGraphIntent ? this.extractRelationshipTerms(query) : undefined
            }
        };
    }
    /**
     * Extract field terms from query
     */
    extractFieldTerms(query) {
        const terms = [];
        // Simple extraction of potential field names
        const words = query.split(/\s+/);
        const fieldIndicators = ['year', 'date', 'author', 'type', 'category', 'status', 'price'];
        for (const word of words) {
            if (fieldIndicators.includes(word.toLowerCase())) {
                terms.push(word.toLowerCase());
            }
        }
        return terms;
    }
    /**
     * Extract relationship terms
     */
    extractRelationshipTerms(query) {
        const terms = [];
        const relationshipWords = ['related', 'connected', 'linked', 'references', 'cites'];
        const words = query.toLowerCase().split(/\s+/);
        for (const word of words) {
            if (relationshipWords.includes(word)) {
                terms.push(word);
            }
        }
        return terms;
    }
    /**
     * Build field constraints from extracted terms
     */
    buildFieldConstraints(fields) {
        const constraints = {};
        // Simple mapping for common fields
        for (const field of fields) {
            // This would be enhanced with actual value extraction
            constraints[field] = { exists: true };
        }
        return constraints;
    }
    /**
     * Find similar queries from history (without using Brainy)
     */
    findSimilarQueries(embedding) {
        // Simple similarity check against recent history
        // This is just a placeholder - real implementation would use cosine similarity
        return [];
    }
    /**
     * Adapt a previous query for new input
     */
    adaptQuery(newQuery, previousResult) {
        return previousResult;
    }
    /**
     * Extract entities from query
     */
    async extractEntities(query) {
        // Could use the Entity Registry here if available
        return [];
    }
    /**
     * Build query from components
     */
    buildQuery(query, intent, entities) {
        return {
            like: query,
            limit: 10
        };
    }
}
//# sourceMappingURL=naturalLanguageProcessorStatic.js.map