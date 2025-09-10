/**
 * Model Manager - Ensures transformer models are available at runtime
 *
 * Strategy (in order):
 * 1. Check local cache first (instant)
 * 2. Try Soulcraft CDN (fastest when available)
 * 3. Try GitHub release tar.gz with extraction (reliable backup)
 * 4. Fall back to Hugging Face (always works)
 *
 * NO USER CONFIGURATION REQUIRED - Everything is automatic!
 */
export declare class ModelManager {
    private static instance;
    private modelsPath;
    private isInitialized;
    private constructor();
    static getInstance(): ModelManager;
    private getModelsPath;
    ensureModels(modelName?: string): Promise<boolean>;
    private verifyModelFiles;
    /**
     * Check which model variants are available locally
     */
    getAvailableModels(modelName?: string): {
        fp32: boolean;
        q8: boolean;
    };
    /**
     * Get the best available model variant based on preference and availability
     */
    getBestAvailableModel(preferredType?: 'fp32' | 'q8', modelName?: string): 'fp32' | 'q8' | null;
    private tryModelSource;
    private downloadAndExtractFromGitHub;
    /**
     * Pre-download models for deployment
     * This is what npm run download-models calls
     */
    static predownload(): Promise<void>;
}
