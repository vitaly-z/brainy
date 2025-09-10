/**
 * Brain-Cloud Catalog Discovery
 *
 * Discovers augmentations available in the brain-cloud catalog
 * Handles free, premium, and community augmentations
 */
import { AugmentationManifest } from '../manifest.js';
export interface CatalogAugmentation {
    id: string;
    name: string;
    description: string;
    longDescription?: string;
    category: string;
    status: 'available' | 'coming_soon' | 'deprecated';
    tier: 'free' | 'premium' | 'enterprise';
    price?: {
        monthly?: number;
        yearly?: number;
        oneTime?: number;
    };
    manifest?: AugmentationManifest;
    source: 'catalog';
    cdnUrl?: string;
    npmPackage?: string;
    githubRepo?: string;
    author?: {
        name: string;
        url?: string;
    };
    metrics?: {
        installations: number;
        rating: number;
        reviews: number;
    };
    requirements?: {
        minBrainyVersion?: string;
        maxBrainyVersion?: string;
        dependencies?: string[];
    };
}
export interface CatalogOptions {
    apiUrl?: string;
    apiKey?: string;
    cache?: boolean;
    cacheTimeout?: number;
}
export interface CatalogFilters {
    category?: string;
    tier?: 'free' | 'premium' | 'enterprise';
    status?: 'available' | 'coming_soon' | 'deprecated';
    search?: string;
    installed?: boolean;
    minRating?: number;
}
/**
 * Brain-Cloud Catalog Discovery
 */
export declare class CatalogDiscovery {
    private apiUrl;
    private apiKey?;
    private cache;
    private cacheTimeout;
    constructor(options?: CatalogOptions);
    /**
     * Discover augmentations from catalog
     */
    discover(filters?: CatalogFilters): Promise<CatalogAugmentation[]>;
    /**
     * Get specific augmentation details
     */
    getAugmentation(id: string): Promise<CatalogAugmentation | null>;
    /**
     * Get augmentation manifest
     */
    getManifest(id: string): Promise<AugmentationManifest | null>;
    /**
     * Get CDN URL for dynamic loading
     */
    getCDNUrl(id: string): Promise<string | null>;
    /**
     * Check if user has access to augmentation
     */
    checkAccess(id: string): Promise<{
        hasAccess: boolean;
        requiresPurchase?: boolean;
        requiredTier?: string;
    }>;
    /**
     * Purchase/activate augmentation
     */
    purchase(id: string, licenseKey?: string): Promise<{
        success: boolean;
        cdnUrl?: string;
        npmPackage?: string;
        licenseKey?: string;
    }>;
    /**
     * Get user's purchased augmentations
     */
    getPurchased(): Promise<CatalogAugmentation[]>;
    /**
     * Get categories
     */
    getCategories(): Promise<Array<{
        id: string;
        name: string;
        description: string;
        icon?: string;
    }>>;
    /**
     * Search augmentations
     */
    search(query: string): Promise<CatalogAugmentation[]>;
    /**
     * Get trending augmentations
     */
    getTrending(limit?: number): Promise<CatalogAugmentation[]>;
    /**
     * Get recommended augmentations
     */
    getRecommended(): Promise<CatalogAugmentation[]>;
    /**
     * Transform catalog data
     */
    private transformCatalogData;
    /**
     * Transform single augmentation
     */
    private transformAugmentation;
    /**
     * Get request headers
     */
    private getHeaders;
    /**
     * Clear cache
     */
    clearCache(): void;
    /**
     * Set API key
     */
    setApiKey(apiKey: string): void;
}
