/**
 * Neural Import - Atomic Age AI-Powered Data Understanding System
 *
 * 🧠 Leveraging the brain-in-jar to understand and automatically structure data
 * ⚛️ Complete with confidence scoring and relationship weight calculation
 */
import { BrainyData } from '../brainyData.js';
export interface NeuralAnalysisResult {
    detectedEntities: DetectedEntity[];
    detectedRelationships: DetectedRelationship[];
    confidence: number;
    insights: NeuralInsight[];
    preview: ProcessedData[];
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
export interface ProcessedData {
    id: string;
    nounType: string;
    data: any;
    relationships: Array<{
        target: string;
        verbType: string;
        weight: number;
        confidence: number;
    }>;
}
export interface NeuralImportOptions {
    confidenceThreshold: number;
    autoApply: boolean;
    enableWeights: boolean;
    previewOnly: boolean;
    validateOnly: boolean;
    categoryFilter?: string[];
    skipDuplicates: boolean;
}
/**
 * Neural Import Engine - The Brain Behind the Analysis
 */
export declare class NeuralImport {
    private brainy;
    private colors;
    private emojis;
    constructor(brainy: BrainyData);
    /**
     * Main Neural Import Function - The Master Controller
     */
    neuralImport(filePath: string, options?: Partial<NeuralImportOptions>): Promise<NeuralAnalysisResult>;
    /**
     * Parse file based on extension
     */
    private parseFile;
    /**
     * Basic CSV parser
     */
    private parseCSV;
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
     * Display Neural Analysis Results
     */
    private displayNeuralAnalysisResults;
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
    private summarizeEntities;
    private summarizeRelationships;
    private calculateOverallConfidence;
    private generatePreview;
    private confirmNeuralImport;
    private executeNeuralImport;
    private generateRelationshipReasoning;
    private extractRelationshipMetadata;
}
