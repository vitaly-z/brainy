/**
 * Default Augmentation Registry
 *
 * 🧠⚛️ Pre-installed augmentations that come with every Brainy installation
 * These are the core "sensory organs" of the atomic age brain-in-jar system
 */
import { BrainyDataInterface } from '../types/brainyDataInterface.js';
/**
 * Default augmentations that ship with Brainy
 * These are automatically registered on startup
 */
export declare class DefaultAugmentationRegistry {
    private brainy;
    constructor(brainy: BrainyDataInterface);
    /**
     * Initialize all default augmentations
     * Called during Brainy startup to register core functionality
     */
    initializeDefaults(): Promise<void>;
    /**
     * Neural Import - Default SENSE Augmentation
     * AI-powered data understanding and entity extraction (always free)
     */
    private registerNeuralImport;
    /**
     * Check if Cortex is available and working
     */
    checkCortexHealth(): Promise<{
        available: boolean;
        status: string;
        version?: string;
    }>;
    /**
     * Reinstall Cortex if it's missing or corrupted
     */
    reinstallCortex(): Promise<void>;
}
/**
 * Helper function to initialize default augmentations for any Brainy instance
 */
export declare function initializeDefaultAugmentations(brainy: BrainyDataInterface): Promise<DefaultAugmentationRegistry>;
