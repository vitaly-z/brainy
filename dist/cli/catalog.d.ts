/**
 * Brain Cloud Catalog Integration for CLI
 *
 * Fetches and displays augmentation catalog
 * Falls back to local cache if API is unavailable
 */
interface Augmentation {
    id: string;
    name: string;
    description: string;
    category: string;
    status: 'available' | 'coming_soon' | 'deprecated';
    popular?: boolean;
    eta?: string;
}
interface Category {
    id: string;
    name: string;
    icon: string;
    description: string;
}
interface Catalog {
    version: string;
    categories: Category[];
    augmentations: Augmentation[];
}
/**
 * Fetch catalog from API with caching
 */
export declare function fetchCatalog(): Promise<Catalog | null>;
/**
 * Display catalog in CLI
 */
export declare function showCatalog(options: {
    category?: string;
    search?: string;
    detailed?: boolean;
}): Promise<void>;
/**
 * Show detailed info about an augmentation
 */
export declare function showAugmentationInfo(id: string): Promise<void>;
/**
 * Show user's available augmentations
 */
export declare function showAvailable(licenseKey?: string): Promise<void>;
export {};
