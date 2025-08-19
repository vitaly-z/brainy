/**
 * Neural Import Augmentation - AI-Powered Data Understanding
 *
 * 🧠 Built-in AI augmentation for intelligent data processing
 * ⚛️ Always free, always included, always enabled
 *
 * This is the default AI-powered augmentation that comes with every Brainy installation.
 * It provides intelligent data understanding, entity detection, and relationship analysis.
 */
import { ISenseAugmentation, AugmentationResponse } from '../types/augmentations.js';
import { BrainyData } from '../brainyData.js';
export interface NeuralAnalysisResult {
    detectedEntities: DetectedEntity[];
    detectedRelationships: DetectedRelationship[];
    confidence: number;
    insights: NeuralInsight[];
}
export interface DetectedEntity {
    originalData: any;
    nounType: string;
    confidence: number;
    suggestedId: string;
    reasoning: string;
    alternativeTypes: Array<{
        type: string;
        confidence: number;
    }>;
}
export interface DetectedRelationship {
    sourceId: string;
    targetId: string;
    verbType: string;
    confidence: number;
    weight: number;
    reasoning: string;
    context: string;
    metadata?: Record<string, any>;
}
export interface NeuralInsight {
    type: 'hierarchy' | 'cluster' | 'pattern' | 'anomaly' | 'opportunity';
    description: string;
    confidence: number;
    affectedEntities: string[];
    recommendation?: string;
}
export interface NeuralImportConfig {
    confidenceThreshold: number;
    enableWeights: boolean;
    skipDuplicates: boolean;
    categoryFilter?: string[];
}
/**
 * Neural Import SENSE Augmentation - The Brain's Perceptual System
 */
export declare class NeuralImportAugmentation implements ISenseAugmentation {
    readonly name: string;
    readonly description: string;
    enabled: boolean;
    private brainy;
    private config;
    constructor(brainy: BrainyData, config?: Partial<NeuralImportConfig>);
    initialize(): Promise<void>;
    shutDown(): Promise<void>;
    getStatus(): Promise<'active' | 'inactive' | 'error'>;
    /**
     * Process raw data into structured nouns and verbs using neural analysis
     */
    processRawData(rawData: Buffer | string, dataType: string, options?: Record<string, unknown>): Promise<AugmentationResponse<{
        nouns: string[];
        verbs: string[];
        confidence?: number;
        insights?: Array<{
            type: string;
            description: string;
            confidence: number;
        }>;
        metadata?: Record<string, unknown>;
    }>>;
    /**
     * Listen to real-time data feeds and process them
     */
    listenToFeed(feedUrl: string, callback: (data: {
        nouns: string[];
        verbs: string[];
        confidence?: number;
    }) => void): Promise<void>;
    /**
     * Analyze data structure without processing (preview mode)
     */
    analyzeStructure(rawData: Buffer | string, dataType: string, options?: Record<string, unknown>): Promise<AugmentationResponse<{
        entityTypes: Array<{
            type: string;
            count: number;
            confidence: number;
        }>;
        relationshipTypes: Array<{
            type: string;
            count: number;
            confidence: number;
        }>;
        dataQuality: {
            completeness: number;
            consistency: number;
            accuracy: number;
        };
        recommendations: string[];
    }>>;
    /**
     * Validate data compatibility with current knowledge base
     */
    validateCompatibility(rawData: Buffer | string, dataType: string): Promise<AugmentationResponse<{
        compatible: boolean;
        issues: Array<{
            type: string;
            description: string;
            severity: 'low' | 'medium' | 'high';
        }>;
        suggestions: string[];
    }>>;
    /**
     * Get the full neural analysis result (custom method for Cortex integration)
     */
    getNeuralAnalysis(rawData: Buffer | string, dataType: string): Promise<NeuralAnalysisResult>;
    /**
     * Parse raw data based on type
     */
    private parseRawData;
    /**
     * Basic CSV parser
     */
    private parseCSV;
    /**
     * Perform neural analysis on parsed data
     */
    private performNeuralAnalysis;
    /**
     * Neural Entity Detection - The Core AI Engine
     */
    private detectEntitiesWithNeuralAnalysis;
    /**
     * Calculate entity type confidence using AI
     */
    private calculateEntityTypeConfidence;
    /**
     * Field-based confidence calculation
     */
    private calculateFieldBasedConfidence;
    /**
     * Pattern-based confidence calculation
     */
    private calculatePatternBasedConfidence;
    /**
     * Generate reasoning for entity type selection
     */
    private generateEntityReasoning;
    /**
     * Neural Relationship Detection
     */
    private detectRelationshipsWithNeuralAnalysis;
    /**
     * Calculate relationship confidence
     */
    private calculateRelationshipConfidence;
    /**
     * Calculate relationship weight/strength
     */
    private calculateRelationshipWeight;
    /**
     * Generate Neural Insights - The Intelligence Layer
     */
    private generateNeuralInsights;
    /**
     * Helper methods for the neural system
     */
    private extractMainText;
    private generateSmartId;
    private extractRelationshipContext;
    private calculateTypeCompatibility;
    private getVerbSpecificity;
    private getRelevantFields;
    private getMatchedPatterns;
    private pruneRelationships;
    private detectHierarchies;
    private detectClusters;
    private detectPatterns;
    private calculateOverallConfidence;
    private storeNeuralAnalysis;
    private getDataTypeFromPath;
    private generateRelationshipReasoning;
    private extractRelationshipMetadata;
    /**
     * Assess data quality metrics
     */
    private assessDataQuality;
    /**
     * Generate recommendations based on analysis
     */
    private generateRecommendations;
}
