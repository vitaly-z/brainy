/**
 * Universal Display Augmentation - Intelligent Computation Engine
 *
 * Leverages existing Brainy AI infrastructure for intelligent field computation:
 * - BrainyTypes for semantic type detection
 * - Neural Import patterns for field analysis
 * - JSON processing utilities for field extraction
 * - Existing NounType/VerbType taxonomy (31+40 types)
 */
import type { ComputedDisplayFields, DisplayConfig } from './types.js';
import type { GraphVerb } from '../../coreTypes.js';
/**
 * Intelligent field computation engine
 * Coordinates AI-powered analysis with fallback heuristics
 */
export declare class IntelligentComputationEngine {
    private typeMatcher;
    protected config: DisplayConfig;
    private initialized;
    constructor(config: DisplayConfig);
    /**
     * Initialize the computation engine with AI components
     */
    initialize(): Promise<void>;
    /**
     * Compute display fields for a noun using AI-first approach
     * @param data The noun data/metadata
     * @param id Optional noun ID
     * @returns Computed display fields
     */
    computeNounDisplay(data: any, id?: string): Promise<ComputedDisplayFields>;
    /**
     * Compute display fields for a verb using AI-first approach
     * @param verb The verb/relationship data
     * @returns Computed display fields
     */
    computeVerbDisplay(verb: GraphVerb): Promise<ComputedDisplayFields>;
    /**
     * AI-powered computation using your existing BrainyTypes
     * @param data Entity data/metadata
     * @param entityType Type of entity (noun/verb)
     * @param options Additional options
     * @returns AI-computed display fields
     */
    private computeWithAI;
    /**
     * AI-powered verb computation using relationship analysis
     * @param verb The verb/relationship
     * @returns AI-computed display fields
     */
    private computeVerbWithAI;
    /**
     * Heuristic computation when AI is unavailable
     * @param data Entity data
     * @param entityType Type of entity
     * @param options Additional options
     * @returns Heuristically computed display fields
     */
    private computeWithHeuristics;
    /**
     * Compute intelligent title using AI insights and your field extraction
     * @param context Computation context with AI results
     * @returns Computed title
     */
    private computeIntelligentTitle;
    /**
     * Compute intelligent description using AI insights and context
     * @param context Computation context
     * @returns Enhanced description
     */
    private computeIntelligentDescription;
    /**
     * Compute intelligent tags using type analysis
     * @param context Computation context
     * @returns Generated tags array
     */
    private computeIntelligentTags;
    /**
     * Compute verb title (relationship summary)
     * @param context Verb computation context
     * @returns Verb title
     */
    private computeVerbTitle;
    /**
     * Create minimal display for error cases
     * @param data Entity data
     * @param entityType Entity type
     * @returns Minimal display fields
     */
    private createMinimalDisplay;
    private computePersonTitle;
    private computeOrganizationTitle;
    private computeProjectTitle;
    private computeDocumentTitle;
    private extractBestTitle;
    private createContextAwareDescription;
    private extractExplicitTags;
    private generateSemanticTags;
    private getReadableVerbPhrase;
    private computeVerbDescription;
    private computeVerbTags;
    private computeHumanReadableRelationship;
    private detectTypeHeuristically;
    private extractFieldWithPatterns;
    /**
     * Shutdown the computation engine
     */
    shutdown(): Promise<void>;
}
