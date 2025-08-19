import { ICognitionAugmentation, AugmentationResponse } from '../types/augmentations.js';
/**
 * Configuration options for the Intelligent Verb Scoring augmentation
 */
export interface IVerbScoringConfig {
    /** Enable semantic proximity scoring based on entity embeddings */
    enableSemanticScoring: boolean;
    /** Enable frequency-based weight amplification */
    enableFrequencyAmplification: boolean;
    /** Enable temporal decay for weights */
    enableTemporalDecay: boolean;
    /** Decay rate per day for temporal scoring (0-1) */
    temporalDecayRate: number;
    /** Minimum weight threshold */
    minWeight: number;
    /** Maximum weight threshold */
    maxWeight: number;
    /** Base confidence score for new relationships */
    baseConfidence: number;
    /** Learning rate for adaptive scoring (0-1) */
    learningRate: number;
}
/**
 * Default configuration for the Intelligent Verb Scoring augmentation
 */
export declare const DEFAULT_VERB_SCORING_CONFIG: IVerbScoringConfig;
/**
 * Relationship statistics for learning and adaptation
 */
interface RelationshipStats {
    count: number;
    totalWeight: number;
    averageWeight: number;
    lastSeen: Date;
    firstSeen: Date;
    semanticSimilarity?: number;
}
/**
 * Intelligent Verb Scoring Cognition Augmentation
 *
 * Automatically generates intelligent weight and confidence scores for verb relationships
 * using semantic analysis, frequency patterns, and temporal factors.
 */
export declare class IntelligentVerbScoring implements ICognitionAugmentation {
    readonly name = "intelligent-verb-scoring";
    readonly description = "Automatically generates intelligent weight and confidence scores for verb relationships";
    enabled: boolean;
    private config;
    private relationshipStats;
    private brainyInstance;
    private isInitialized;
    constructor(config?: Partial<IVerbScoringConfig>);
    initialize(): Promise<void>;
    shutDown(): Promise<void>;
    getStatus(): Promise<'active' | 'inactive' | 'error'>;
    /**
     * Set reference to the BrainyData instance for accessing graph data
     */
    setBrainyInstance(instance: any): void;
    /**
     * Main reasoning method for generating intelligent verb scores
     */
    reason(query: string, context?: Record<string, unknown>): AugmentationResponse<{
        inference: string;
        confidence: number;
    }>;
    infer(dataSubset: Record<string, unknown>): AugmentationResponse<Record<string, unknown>>;
    executeLogic(ruleId: string, input: Record<string, unknown>): AugmentationResponse<boolean>;
    /**
     * Generate intelligent weight and confidence scores for a verb relationship
     *
     * @param sourceId - ID of the source entity
     * @param targetId - ID of the target entity
     * @param verbType - Type of the relationship
     * @param existingWeight - Existing weight if any
     * @param metadata - Additional metadata about the relationship
     * @returns Computed weight and confidence scores
     */
    computeVerbScores(sourceId: string, targetId: string, verbType: string, existingWeight?: number, metadata?: any): Promise<{
        weight: number;
        confidence: number;
        reasoning: string[];
    }>;
    /**
     * Calculate semantic similarity between two entities using their embeddings
     */
    private calculateSemanticScore;
    /**
     * Calculate frequency-based boost for repeated relationships
     */
    private calculateFrequencyBoost;
    /**
     * Calculate temporal decay factor based on recency
     */
    private calculateTemporalFactor;
    /**
     * Calculate learning-based adjustment using historical patterns
     */
    private calculateLearningAdjustment;
    /**
     * Update relationship statistics for learning
     */
    private updateRelationshipStats;
    /**
     * Blend two scores using a weighted average
     */
    private blendScores;
    /**
     * Get current configuration
     */
    getConfig(): IVerbScoringConfig;
    /**
     * Update configuration
     */
    updateConfig(newConfig: Partial<IVerbScoringConfig>): void;
    /**
     * Get relationship statistics (for debugging/monitoring)
     */
    getRelationshipStats(): Map<string, RelationshipStats>;
    /**
     * Clear relationship statistics
     */
    clearStats(): void;
    /**
     * Provide feedback to improve future scoring
     * This allows the system to learn from user corrections or validation
     *
     * @param sourceId - Source entity ID
     * @param targetId - Target entity ID
     * @param verbType - Relationship type
     * @param feedbackWeight - The corrected/validated weight (0-1)
     * @param feedbackConfidence - The corrected/validated confidence (0-1)
     * @param feedbackType - Type of feedback ('correction', 'validation', 'enhancement')
     */
    provideFeedback(sourceId: string, targetId: string, verbType: string, feedbackWeight: number, feedbackConfidence?: number, feedbackType?: 'correction' | 'validation' | 'enhancement'): Promise<void>;
    /**
     * Get learning statistics for monitoring and debugging
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
     */
    exportLearningData(): string;
    /**
     * Import learning data from backup
     */
    importLearningData(jsonData: string): void;
}
export {};
