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
interface VerbScoringConfig {
    enabled?: boolean;
    enableSemanticScoring?: boolean;
    semanticThreshold?: number;
    semanticWeight?: number;
    enableFrequencyAmplification?: boolean;
    frequencyDecay?: number;
    maxFrequencyBoost?: number;
    enableTemporalDecay?: boolean;
    temporalDecayRate?: number;
    temporalWindow?: number;
    enableAdaptiveLearning?: boolean;
    learningRate?: number;
    confidenceThreshold?: number;
    minWeight?: number;
    maxWeight?: number;
    baseWeight?: number;
}
interface RelationshipMetrics {
    count: number;
    totalWeight: number;
    averageWeight: number;
    lastUpdated: number;
    semanticScore: number;
    frequencyScore: number;
    temporalScore: number;
    confidenceScore: number;
}
interface ScoringMetrics {
    relationshipsScored: number;
    averageSemanticScore: number;
    averageFrequencyScore: number;
    averageTemporalScore: number;
    averageConfidenceScore: number;
    adaptiveAdjustments: number;
    computationTimeMs: number;
}
export declare class IntelligentVerbScoringAugmentation extends BaseAugmentation {
    name: string;
    timing: "around";
    readonly metadata: {
        reads: string[];
        writes: string[];
    };
    operations: ("addVerb" | "relate")[];
    priority: number;
    readonly category: "core";
    readonly description = "AI-powered intelligent scoring for relationship strength analysis";
    protected config: Required<VerbScoringConfig>;
    private relationshipStats;
    private metrics;
    private scoringInstance;
    constructor(config?: VerbScoringConfig);
    protected onInitialize(): Promise<void>;
    /**
     * Get this augmentation instance for API compatibility
     * Used by Brainy to access scoring methods
     */
    getScoring(): IntelligentVerbScoringAugmentation;
    shouldExecute(operation: string, params: any): boolean;
    execute<T = any>(operation: string, params: any, next: () => Promise<T>): Promise<T>;
    private calculateIntelligentWeight;
    private calculateSemanticScore;
    /**
     * Detect noun type using neural taxonomy matching
     */
    private detectNounType;
    /**
     * Calculate taxonomy-based similarity boost
     */
    private calculateTaxonomyBoost;
    private calculateCosineSimilarity;
    private calculateFrequencyScore;
    private calculateTemporalScore;
    private calculateContextScore;
    private updateRelationshipLearning;
    private getConfidenceScore;
    private getScoringMethodsUsed;
    private storeDetailedScoring;
    private updateMetrics;
    /**
     * Get intelligent verb scoring statistics
     */
    getStats(): ScoringMetrics & {
        totalRelationships: number;
        averageConfidence: number;
        highConfidenceRelationships: number;
        learningEfficiency: number;
    };
    /**
     * Export relationship statistics for analysis
     */
    exportRelationshipStats(): Array<{
        relationship: string;
        metrics: RelationshipMetrics;
    }>;
    /**
     * Import relationship statistics from previous sessions
     */
    importRelationshipStats(stats: Array<{
        relationship: string;
        metrics: RelationshipMetrics;
    }>): void;
    /**
     * Get learning statistics for monitoring and debugging
     * Required for Brainy.getVerbScoringStats()
     */
    getLearningStats(): {
        totalRelationships: number;
        averageConfidence: number;
        feedbackCount: number;
        topRelationships: Array<{
            relationship: string;
            count: number;
            averageWeight: number;
        }>;
    };
    /**
     * Export learning data for backup or analysis
     * Required for Brainy.exportVerbScoringLearningData()
     */
    exportLearningData(): string;
    /**
     * Import learning data from backup
     * Required for Brainy.importVerbScoringLearningData()
     */
    importLearningData(jsonData: string): void;
    /**
     * Provide feedback on a relationship's weight
     * Required for Brainy.provideVerbScoringFeedback()
     */
    provideFeedback(sourceId: string, targetId: string, relationType: string, feedback: number, feedbackType?: 'correction' | 'validation' | 'enhancement'): Promise<void>;
    /**
     * Compute intelligent scores for a verb relationship
     * Used internally during verb creation
     */
    computeVerbScores(sourceNoun: any, targetNoun: any, relationType: string): Promise<{
        weight: number;
        confidence: number;
        reasoning: string[];
    }>;
    protected onShutdown(): Promise<void>;
}
export {};
