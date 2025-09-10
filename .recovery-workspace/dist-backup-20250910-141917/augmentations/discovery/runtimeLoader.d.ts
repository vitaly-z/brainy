/**
 * Runtime Augmentation Loader
 *
 * Dynamically loads and registers augmentations at runtime
 * Supports CDN loading for browser environments and npm imports for Node.js
 */
import { BrainyAugmentation, AugmentationRegistry } from '../brainyAugmentation.js';
import { AugmentationManifest } from '../manifest.js';
export interface LoaderOptions {
    cdnUrl?: string;
    allowUnsafe?: boolean;
    sandbox?: boolean;
    timeout?: number;
    cache?: boolean;
}
export interface LoadedAugmentation {
    id: string;
    instance: BrainyAugmentation;
    manifest: AugmentationManifest;
    source: 'cdn' | 'npm' | 'local';
    loadTime: number;
}
/**
 * Runtime Augmentation Loader
 *
 * Enables dynamic loading of augmentations from various sources
 */
export declare class RuntimeAugmentationLoader {
    private options;
    private loaded;
    private cdnCache;
    private registry?;
    constructor(options?: LoaderOptions);
    /**
     * Set the augmentation registry
     */
    setRegistry(registry: AugmentationRegistry): void;
    /**
     * Load augmentation from CDN (browser)
     */
    loadFromCDN(id: string, version?: string, config?: any): Promise<LoadedAugmentation>;
    /**
     * Load augmentation from NPM (Node.js)
     */
    loadFromNPM(packageName: string, config?: any): Promise<LoadedAugmentation>;
    /**
     * Load augmentation from local file
     */
    loadFromFile(path: string, config?: any): Promise<LoadedAugmentation>;
    /**
     * Load multiple augmentations
     */
    loadBatch(augmentations: Array<{
        source: 'cdn' | 'npm' | 'local';
        id: string;
        version?: string;
        path?: string;
        config?: any;
    }>): Promise<LoadedAugmentation[]>;
    /**
     * Unload augmentation
     */
    unload(id: string): boolean;
    /**
     * Get loaded augmentations
     */
    getLoaded(): LoadedAugmentation[];
    /**
     * Check if augmentation is loaded
     */
    isLoaded(id: string): boolean;
    /**
     * Get loaded augmentation
     */
    getAugmentation(id: string): BrainyAugmentation | null;
    /**
     * Load CDN module (browser-specific)
     */
    private loadCDNModule;
    /**
     * Validate augmentation instance
     */
    private isValidAugmentation;
    /**
     * Clear all caches
     */
    clearCache(): void;
    /**
     * Get load statistics
     */
    getStats(): {
        loaded: number;
        totalLoadTime: number;
        averageLoadTime: number;
        sources: Record<string, number>;
    };
}
