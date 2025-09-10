/**
 * Local Augmentation Discovery
 *
 * Discovers augmentations installed locally in node_modules
 * and built-in augmentations that ship with Brainy
 */
import { AugmentationManifest } from '../manifest.js';
export interface LocalAugmentation {
    id: string;
    name: string;
    source: 'builtin' | 'npm' | 'local';
    path: string;
    manifest?: AugmentationManifest;
    package?: {
        name: string;
        version: string;
        description?: string;
    };
}
/**
 * Discovers augmentations installed locally
 */
export declare class LocalAugmentationDiscovery {
    private options;
    private builtInAugmentations;
    private installedAugmentations;
    constructor(options?: {
        brainyPath?: string;
        projectPath?: string;
        scanNodeModules?: boolean;
    });
    /**
     * Register built-in augmentations that ship with Brainy
     */
    private registerBuiltIn;
    /**
     * Find Brainy installation path
     */
    private findBrainyPath;
    /**
     * Discover all augmentations
     */
    discoverAll(): Promise<LocalAugmentation[]>;
    /**
     * Scan node_modules for installed augmentations
     */
    private scanNodeModules;
    /**
     * Scan local project for augmentations
     */
    private scanLocalProject;
    /**
     * Load augmentation from package
     */
    private loadPackageAugmentation;
    /**
     * Load package.json
     */
    private loadPackageJson;
    /**
     * Convert name to human-readable format
     */
    private humanizeName;
    /**
     * Get built-in augmentations
     */
    getBuiltIn(): LocalAugmentation[];
    /**
     * Get installed augmentations
     */
    getInstalled(): LocalAugmentation[];
    /**
     * Check if augmentation is installed
     */
    isInstalled(id: string): boolean;
    /**
     * Get import path for augmentation
     */
    getImportPath(id: string): string | null;
    /**
     * Load augmentation module dynamically
     */
    loadAugmentation(id: string): Promise<any>;
}
