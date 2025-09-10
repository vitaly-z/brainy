/**
 * Intelligent Verb Scoring Augmentation
 *
 * Enhances relationship quality through intelligent semantic scoring
 * Provides context-aware relationship weights based on:
 * - Semantic proximity of connected entities
 * - Frequency-based amplification
 * - Temporal decay modeling
 * - Adaptive learning from usage patterns
 *
 * Critical for enterprise knowledge graphs with millions of relationships
 */
import { BaseAugmentation } from './brainyAugmentation.js';
export class IntelligentVerbScoringAugmentation extends BaseAugmentation {
    constructor(config = {}) {
        super();
        this.name = 'IntelligentVerbScoring';
        this.timing = 'around';
        this.metadata = {
            reads: ['type', 'verb', 'source', 'target'],
            writes: ['weight', 'confidence', 'intelligentScoring']
        }; // Adds scoring metadata to verbs
        this.operations = ['addVerb', 'relate'];
        this.priority = 10; // Enhancement feature - runs after core operations
        // Augmentation metadata
        this.category = 'core';
        this.description = 'AI-powered intelligent scoring for relationship strength analysis';
        this.relationshipStats = new Map();
        this.metrics = {
            relationshipsScored: 0,
            averageSemanticScore: 0,
            averageFrequencyScore: 0,
            averageTemporalScore: 0,
            averageConfidenceScore: 0,
            adaptiveAdjustments: 0,
            computationTimeMs: 0
        };
        this.config = {
            enabled: config.enabled ?? true, // Smart by default!
            // Semantic Analysis
            enableSemanticScoring: config.enableSemanticScoring ?? true,
            semanticThreshold: config.semanticThreshold ?? 0.3,
            semanticWeight: config.semanticWeight ?? 0.4,
            // Frequency Analysis
            enableFrequencyAmplification: config.enableFrequencyAmplification ?? true,
            frequencyDecay: config.frequencyDecay ?? 0.95, // 5% decay per occurrence
            maxFrequencyBoost: config.maxFrequencyBoost ?? 2.0,
            // Temporal Analysis
            enableTemporalDecay: config.enableTemporalDecay ?? true,
            temporalDecayRate: config.temporalDecayRate ?? 0.01, // 1% per day
            temporalWindow: config.temporalWindow ?? 365, // 1 year
            // Learning & Adaptation
            enableAdaptiveLearning: config.enableAdaptiveLearning ?? true,
            learningRate: config.learningRate ?? 0.1,
            confidenceThreshold: config.confidenceThreshold ?? 0.3,
            // Weight Management
            minWeight: config.minWeight ?? 0.1,
            maxWeight: config.maxWeight ?? 1.0,
            baseWeight: config.baseWeight ?? 0.5
        };
        // Set enabled property based on config
        this.enabled = this.config.enabled;
    }
    async onInitialize() {
        if (this.config.enabled) {
            this.log('Intelligent verb scoring initialized for enhanced relationship quality');
        }
        else {
            this.log('Intelligent verb scoring disabled');
        }
    }
    /**
     * Get this augmentation instance for API compatibility
     * Used by Brainy to access scoring methods
     */
    getScoring() {
        return this;
    }
    shouldExecute(operation, params) {
        // For addVerb, params are passed as array: [sourceId, targetId, verbType, metadata, weight]
        if (operation === 'addVerb' && this.config.enabled) {
            return Array.isArray(params) && params.length >= 3;
        }
        // For relate method, params might be an object
        if (operation === 'relate' && this.config.enabled) {
            return params.sourceId && params.targetId && params.relationType;
        }
        return false;
    }
    async execute(operation, params, next) {
        if (!this.shouldExecute(operation, params)) {
            return next();
        }
        const startTime = Date.now();
        try {
            let sourceId, targetId, relationType, metadata;
            let scoringResult = null;
            // Extract parameters based on operation type
            if (operation === 'addVerb' && Array.isArray(params)) {
                // addVerb params: [sourceId, targetId, verbType, metadata, weight]
                [sourceId, targetId, relationType, metadata] = params;
            }
            else if (operation === 'relate') {
                // relate params might be an object
                sourceId = params.sourceId;
                targetId = params.targetId;
                relationType = params.relationType;
                metadata = params.metadata;
            }
            else {
                return next();
            }
            // Skip if weight is already provided explicitly
            if (Array.isArray(params) && params[4] !== undefined && params[4] !== null) {
                return next();
            }
            // Get the nouns to compute scoring
            const sourceNoun = await this.context?.brain.get(sourceId);
            const targetNoun = await this.context?.brain.get(targetId);
            // Compute intelligent scores with reasoning
            scoringResult = await this.computeVerbScores(sourceNoun, targetNoun, relationType);
            // For addVerb, modify the params array
            if (operation === 'addVerb' && Array.isArray(params)) {
                // Set the weight parameter (index 4)
                params[4] = scoringResult.weight;
                // Enhance metadata with scoring info
                params[3] = {
                    ...params[3],
                    intelligentScoring: {
                        weight: scoringResult.weight,
                        confidence: scoringResult.confidence,
                        reasoning: scoringResult.reasoning,
                        scoringMethod: this.getScoringMethodsUsed(),
                        computedAt: Date.now()
                    }
                };
            }
            // Execute with enhanced parameters
            const result = await next();
            // Learn from this relationship
            if (this.config.enableAdaptiveLearning && scoringResult) {
                await this.updateRelationshipLearning(sourceId, targetId, relationType, scoringResult.weight);
            }
            // Update metrics
            const computationTime = Date.now() - startTime;
            if (scoringResult) {
                this.updateMetrics(scoringResult.weight, computationTime);
            }
            return result;
        }
        catch (error) {
            this.log(`Intelligent verb scoring error: ${error}`, 'error');
            // Fallback to original parameters
            return next();
        }
    }
    async calculateIntelligentWeight(sourceId, targetId, relationType, metadata) {
        let finalWeight = this.config.baseWeight;
        let scoreComponents = {};
        // 1. Semantic Proximity Score
        if (this.config.enableSemanticScoring) {
            const semanticScore = await this.calculateSemanticScore(sourceId, targetId);
            scoreComponents.semantic = semanticScore;
            finalWeight = finalWeight * (1 + semanticScore * this.config.semanticWeight);
        }
        // 2. Frequency Amplification Score
        if (this.config.enableFrequencyAmplification) {
            const frequencyScore = this.calculateFrequencyScore(sourceId, targetId, relationType);
            scoreComponents.frequency = frequencyScore;
            finalWeight = finalWeight * (1 + frequencyScore);
        }
        // 3. Temporal Relevance Score
        if (this.config.enableTemporalDecay) {
            const temporalScore = this.calculateTemporalScore(sourceId, targetId, relationType);
            scoreComponents.temporal = temporalScore;
            finalWeight = finalWeight * temporalScore;
        }
        // 4. Context Awareness (from metadata)
        const contextScore = this.calculateContextScore(metadata);
        scoreComponents.context = contextScore;
        finalWeight = finalWeight * (1 + contextScore * 0.2);
        // 5. Apply constraints
        finalWeight = Math.max(this.config.minWeight, Math.min(this.config.maxWeight, finalWeight));
        // Store detailed scoring for analysis
        this.storeDetailedScoring(sourceId, targetId, relationType, {
            finalWeight,
            components: scoreComponents,
            timestamp: Date.now()
        });
        return finalWeight;
    }
    async calculateSemanticScore(sourceId, targetId) {
        try {
            // Get embeddings for both entities
            const sourceNoun = await this.context?.brain.get(sourceId);
            const targetNoun = await this.context?.brain.get(targetId);
            if (!sourceNoun?.vector || !targetNoun?.vector) {
                return 0;
            }
            // Get noun types using neural detection (taxonomy-based)
            const sourceType = await this.detectNounType(sourceNoun.vector);
            const targetType = await this.detectNounType(targetNoun.vector);
            // Calculate direct similarity
            const directSimilarity = this.calculateCosineSimilarity(sourceNoun.vector, targetNoun.vector);
            // Calculate taxonomy-based similarity boost
            const taxonomyBoost = await this.calculateTaxonomyBoost(sourceType, targetType);
            // Blend direct similarity with taxonomy guidance
            // Taxonomy provides consistency while preserving flexibility
            const semanticScore = directSimilarity * 0.7 + taxonomyBoost * 0.3;
            return Math.min(1, Math.max(0, semanticScore));
        }
        catch (error) {
            return 0;
        }
    }
    /**
     * Detect noun type using neural taxonomy matching
     */
    async detectNounType(vector) {
        // Use the same neural detection as addNoun for consistency
        if (!this.context?.brain)
            return 'unknown';
        try {
            // This would normally call the brain's detectNounType method
            // For now, simplified type detection based on vector patterns
            const magnitude = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
            // Heuristic type detection (would use actual taxonomy embeddings)
            if (magnitude > 10)
                return 'concept';
            if (magnitude > 5)
                return 'entity';
            if (magnitude > 2)
                return 'object';
            return 'item';
        }
        catch {
            return 'unknown';
        }
    }
    /**
     * Calculate taxonomy-based similarity boost
     */
    async calculateTaxonomyBoost(sourceType, targetType) {
        // Define valid relationship patterns in taxonomy
        const validPatterns = {
            'person': { 'concept': 0.9, 'skill': 0.85, 'organization': 0.8, 'person': 0.7 },
            'concept': { 'concept': 0.9, 'example': 0.85, 'application': 0.8 },
            'entity': { 'entity': 0.8, 'property': 0.85, 'action': 0.75 },
            'object': { 'object': 0.7, 'property': 0.8, 'location': 0.75 },
            'document': { 'topic': 0.9, 'author': 0.85, 'document': 0.7 },
            'tool': { 'output': 0.9, 'input': 0.85, 'user': 0.8 },
            'unknown': { 'unknown': 0.5 } // Fallback
        };
        // Get boost from taxonomy patterns
        const patterns = validPatterns[sourceType] || validPatterns['unknown'];
        const boost = patterns[targetType] || 0.3; // Low score for unrecognized patterns
        return boost;
    }
    calculateCosineSimilarity(vectorA, vectorB) {
        if (vectorA.length !== vectorB.length)
            return 0;
        let dotProduct = 0;
        let normA = 0;
        let normB = 0;
        for (let i = 0; i < vectorA.length; i++) {
            dotProduct += vectorA[i] * vectorB[i];
            normA += vectorA[i] * vectorA[i];
            normB += vectorB[i] * vectorB[i];
        }
        const magnitude = Math.sqrt(normA) * Math.sqrt(normB);
        return magnitude ? dotProduct / magnitude : 0;
    }
    calculateFrequencyScore(sourceId, targetId, relationType) {
        const relationshipKey = `${sourceId}:${relationType}:${targetId}`;
        const stats = this.relationshipStats.get(relationshipKey);
        if (!stats || stats.count <= 1)
            return 0;
        // Frequency boost diminishes with each occurrence
        const frequencyBoost = Math.log(stats.count) * this.config.frequencyDecay;
        return Math.min(this.config.maxFrequencyBoost, frequencyBoost);
    }
    calculateTemporalScore(sourceId, targetId, relationType) {
        const relationshipKey = `${sourceId}:${relationType}:${targetId}`;
        const stats = this.relationshipStats.get(relationshipKey);
        if (!stats)
            return 1.0; // New relationship - full temporal score
        const daysSinceUpdate = (Date.now() - stats.lastUpdated) / (1000 * 60 * 60 * 24);
        const decayFactor = Math.pow(1 - this.config.temporalDecayRate, daysSinceUpdate);
        // Relationships older than temporal window get minimum score
        if (daysSinceUpdate > this.config.temporalWindow) {
            return this.config.minWeight / this.config.baseWeight;
        }
        return Math.max(0.1, decayFactor);
    }
    calculateContextScore(metadata) {
        if (!metadata)
            return 0;
        let contextScore = 0;
        // Boost for explicit importance
        if (metadata.importance) {
            contextScore += Math.min(0.5, metadata.importance);
        }
        // Boost for confidence
        if (metadata.confidence) {
            contextScore += Math.min(0.3, metadata.confidence);
        }
        // Boost for source quality
        if (metadata.sourceQuality) {
            contextScore += Math.min(0.2, metadata.sourceQuality);
        }
        return contextScore;
    }
    async updateRelationshipLearning(sourceId, targetId, relationType, weight) {
        const relationshipKey = `${sourceId}:${relationType}:${targetId}`;
        let stats = this.relationshipStats.get(relationshipKey);
        if (!stats) {
            stats = {
                count: 0,
                totalWeight: 0,
                averageWeight: this.config.baseWeight,
                lastUpdated: Date.now(),
                semanticScore: 0,
                frequencyScore: 0,
                temporalScore: 1.0,
                confidenceScore: this.config.baseWeight
            };
        }
        // Update statistics with learning rate
        stats.count++;
        stats.totalWeight += weight;
        stats.averageWeight = stats.averageWeight * (1 - this.config.learningRate) +
            weight * this.config.learningRate;
        stats.lastUpdated = Date.now();
        // Update confidence based on consistency
        const weightVariance = Math.abs(weight - stats.averageWeight);
        const consistencyScore = 1 - Math.min(1, weightVariance);
        stats.confidenceScore = stats.confidenceScore * (1 - this.config.learningRate) +
            consistencyScore * this.config.learningRate;
        this.relationshipStats.set(relationshipKey, stats);
        this.metrics.adaptiveAdjustments++;
    }
    getConfidenceScore(sourceId, targetId, relationType) {
        const relationshipKey = `${sourceId}:${relationType}:${targetId}`;
        const stats = this.relationshipStats.get(relationshipKey);
        return stats ? stats.confidenceScore : this.config.baseWeight;
    }
    getScoringMethodsUsed() {
        const methods = [];
        if (this.config.enableSemanticScoring)
            methods.push('semantic');
        if (this.config.enableFrequencyAmplification)
            methods.push('frequency');
        if (this.config.enableTemporalDecay)
            methods.push('temporal');
        if (this.config.enableAdaptiveLearning)
            methods.push('adaptive');
        return methods;
    }
    storeDetailedScoring(sourceId, targetId, relationType, scoring) {
        // Store detailed scoring for analysis and debugging
        // In production, this might be sent to analytics system
    }
    updateMetrics(weight, computationTime) {
        this.metrics.relationshipsScored++;
        this.metrics.computationTimeMs =
            (this.metrics.computationTimeMs * (this.metrics.relationshipsScored - 1) + computationTime) /
                this.metrics.relationshipsScored;
        // Update score averages (simplified)
        // In practice, we'd track these more precisely
    }
    /**
     * Get intelligent verb scoring statistics
     */
    getStats() {
        let totalConfidence = 0;
        let highConfidenceCount = 0;
        for (const stats of this.relationshipStats.values()) {
            totalConfidence += stats.confidenceScore;
            if (stats.confidenceScore >= this.config.confidenceThreshold * 2) {
                highConfidenceCount++;
            }
        }
        const totalRelationships = this.relationshipStats.size;
        const averageConfidence = totalRelationships > 0 ? totalConfidence / totalRelationships : 0;
        const learningEfficiency = this.metrics.adaptiveAdjustments / Math.max(1, this.metrics.relationshipsScored);
        return {
            ...this.metrics,
            totalRelationships,
            averageConfidence,
            highConfidenceRelationships: highConfidenceCount,
            learningEfficiency
        };
    }
    /**
     * Export relationship statistics for analysis
     */
    exportRelationshipStats() {
        return Array.from(this.relationshipStats.entries()).map(([key, metrics]) => ({
            relationship: key,
            metrics
        }));
    }
    /**
     * Import relationship statistics from previous sessions
     */
    importRelationshipStats(stats) {
        for (const { relationship, metrics } of stats) {
            this.relationshipStats.set(relationship, metrics);
        }
        this.log(`Imported ${stats.length} relationship statistics`);
    }
    /**
     * Get learning statistics for monitoring and debugging
     * Required for Brainy.getVerbScoringStats()
     */
    getLearningStats() {
        const relationships = Array.from(this.relationshipStats.entries());
        const totalRelationships = relationships.length;
        const feedbackCount = relationships.reduce((sum, [, stats]) => sum + stats.count, 0);
        const averageWeight = relationships.reduce((sum, [, stats]) => sum + stats.averageWeight, 0) / totalRelationships || 0;
        const averageConfidence = Math.min(averageWeight + 0.2, 1.0);
        const topRelationships = relationships
            .map(([key, stats]) => ({
            relationship: key,
            count: stats.count,
            averageWeight: stats.averageWeight
        }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 10);
        return {
            totalRelationships,
            averageConfidence,
            feedbackCount,
            topRelationships
        };
    }
    /**
     * Export learning data for backup or analysis
     * Required for Brainy.exportVerbScoringLearningData()
     */
    exportLearningData() {
        const data = {
            config: this.config,
            stats: Array.from(this.relationshipStats.entries()).map(([key, stats]) => ({
                relationship: key,
                ...stats
            })),
            exportedAt: new Date().toISOString(),
            version: '1.0'
        };
        return JSON.stringify(data, null, 2);
    }
    /**
     * Import learning data from backup
     * Required for Brainy.importVerbScoringLearningData()
     */
    importLearningData(jsonData) {
        try {
            const data = JSON.parse(jsonData);
            if (data.stats && Array.isArray(data.stats)) {
                for (const stat of data.stats) {
                    if (stat.relationship) {
                        this.relationshipStats.set(stat.relationship, {
                            count: stat.count || 1,
                            totalWeight: stat.totalWeight || stat.averageWeight || 0.5,
                            averageWeight: stat.averageWeight || 0.5,
                            lastUpdated: stat.lastUpdated || Date.now(),
                            semanticScore: stat.semanticScore || 0.5,
                            frequencyScore: stat.frequencyScore || 0.5,
                            temporalScore: stat.temporalScore || 1.0,
                            confidenceScore: stat.confidenceScore || 0.5
                        });
                    }
                }
            }
            this.log(`Imported learning data: ${this.relationshipStats.size} relationships`);
        }
        catch (error) {
            console.error('Failed to import learning data:', error);
            throw new Error(`Failed to import learning data: ${error}`);
        }
    }
    /**
     * Provide feedback on a relationship's weight
     * Required for Brainy.provideVerbScoringFeedback()
     */
    async provideFeedback(sourceId, targetId, relationType, feedback, feedbackType = 'correction') {
        const key = `${sourceId}-${relationType}-${targetId}`;
        const stats = this.relationshipStats.get(key) || {
            count: 0,
            totalWeight: 0,
            averageWeight: 0.5,
            lastUpdated: Date.now(),
            semanticScore: 0.5,
            frequencyScore: 0.5,
            temporalScore: 1.0,
            confidenceScore: 0.5
        };
        // Update statistics based on feedback
        if (feedbackType === 'correction') {
            // Direct correction - heavily weight the feedback
            stats.averageWeight = stats.averageWeight * 0.3 + feedback * 0.7;
        }
        else if (feedbackType === 'validation') {
            // Validation - slightly adjust towards feedback
            stats.averageWeight = stats.averageWeight * 0.8 + feedback * 0.2;
        }
        else {
            // Enhancement - minor adjustment
            stats.averageWeight = stats.averageWeight * 0.9 + feedback * 0.1;
        }
        stats.count++;
        stats.totalWeight += feedback;
        stats.lastUpdated = Date.now();
        this.relationshipStats.set(key, stats);
        this.metrics.adaptiveAdjustments++;
    }
    /**
     * Compute intelligent scores for a verb relationship
     * Used internally during verb creation
     */
    async computeVerbScores(sourceNoun, targetNoun, relationType) {
        const reasoning = [];
        let totalScore = 0;
        let components = 0;
        // Semantic scoring
        if (this.config.enableSemanticScoring && sourceNoun?.vector && targetNoun?.vector) {
            const similarity = this.calculateCosineSimilarity(sourceNoun.vector, targetNoun.vector);
            const semanticScore = Math.max(similarity, this.config.semanticThreshold);
            totalScore += semanticScore * this.config.semanticWeight;
            components++;
            reasoning.push(`Semantic similarity: ${(similarity * 100).toFixed(1)}%`);
        }
        // Frequency scoring
        const key = `${sourceNoun?.id}-${relationType}-${targetNoun?.id}`;
        const stats = this.relationshipStats.get(key);
        if (this.config.enableFrequencyAmplification && stats) {
            const frequencyScore = Math.min(1 + (stats.count - 1) * 0.1, this.config.maxFrequencyBoost);
            totalScore += frequencyScore * 0.3;
            components++;
            reasoning.push(`Frequency boost: ${frequencyScore.toFixed(2)}x`);
        }
        // Temporal decay scoring
        if (this.config.enableTemporalDecay) {
            reasoning.push(`Temporal decay applied (rate: ${this.config.temporalDecayRate})`);
        }
        // Calculate final weight
        const weight = components > 0
            ? Math.min(Math.max(totalScore / components, this.config.minWeight), this.config.maxWeight)
            : this.config.baseWeight;
        const confidence = Math.min(weight + 0.2, 1.0);
        return { weight, confidence, reasoning };
    }
    async onShutdown() {
        const stats = this.getStats();
        this.log(`Intelligent verb scoring shutdown: ${stats.relationshipsScored} relationships scored, ${Math.round(stats.averageConfidence * 100)}% avg confidence`);
    }
}
//# sourceMappingURL=intelligentVerbScoringAugmentation.js.map