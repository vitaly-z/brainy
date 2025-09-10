/**
 * Domain Detector
 * Automatically detects and manages data domains for logical separation
 */
import { DomainMetadata } from '../types/distributedTypes.js';
export interface DomainPattern {
    domain: string;
    patterns: {
        fields?: string[];
        keywords?: string[];
        regex?: RegExp;
    };
    priority?: number;
}
export declare class DomainDetector {
    private domainPatterns;
    private customPatterns;
    private domainStats;
    /**
     * Detect domain from data object
     * @param data - The data object to analyze
     * @returns The detected domain and metadata
     */
    detectDomain(data: any): DomainMetadata;
    /**
     * Score a data object against a domain pattern
     */
    private scorePattern;
    /**
     * Extract domain-specific metadata
     */
    private extractDomainMetadata;
    /**
     * Calculate detection confidence
     */
    private calculateConfidence;
    /**
     * Categorize price ranges
     */
    private getPriceRange;
    /**
     * Categorize customer value
     */
    private getValueCategory;
    /**
     * Categorize amount ranges
     */
    private getAmountRange;
    /**
     * Add custom domain pattern
     * @param pattern - Custom domain pattern to add
     */
    addCustomPattern(pattern: DomainPattern): void;
    /**
     * Remove custom domain pattern
     * @param domain - Domain to remove pattern for
     */
    removeCustomPattern(domain: string): void;
    /**
     * Update domain statistics
     */
    private updateStats;
    /**
     * Get domain statistics
     * @returns Map of domain to count
     */
    getDomainStats(): Map<string, number>;
    /**
     * Clear domain statistics
     */
    clearStats(): void;
    /**
     * Get all configured domains
     * @returns Array of domain names
     */
    getConfiguredDomains(): string[];
}
