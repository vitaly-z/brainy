/**
 * MODEL GUARDIAN - CRITICAL PATH
 *
 * THIS IS THE MOST CRITICAL COMPONENT OF BRAINY
 * Without the exact model, users CANNOT access their data
 *
 * Requirements:
 * 1. Model MUST be Xenova/all-MiniLM-L6-v2 (never changes)
 * 2. Model MUST be available at runtime
 * 3. Model MUST produce consistent 384-dim embeddings
 * 4. System MUST fail fast if model unavailable in production
 */
export declare class ModelGuardian {
    private static instance;
    private isVerified;
    private modelPath;
    private lastVerification;
    private constructor();
    static getInstance(): ModelGuardian;
    /**
     * CRITICAL: Verify model availability and integrity
     * This MUST be called before any embedding operations
     */
    ensureCriticalModel(): Promise<void>;
    /**
     * Verify the local model files exist and are correct
     */
    private verifyLocalModel;
    /**
     * Compute SHA256 hash of a file
     */
    private computeFileHash;
    /**
     * Download model from a fallback source
     */
    private downloadFromSource;
    /**
     * Configure transformers.js to use verified local model
     */
    private configureTransformers;
    /**
     * Detect where models should be stored
     */
    private detectModelPath;
    /**
     * Get model status for diagnostics
     */
    getStatus(): Promise<{
        verified: boolean;
        path: string;
        lastVerification: Date | null;
        modelName: string;
        dimensions: number;
    }>;
    /**
     * Force re-verification (for testing)
     */
    forceReverify(): Promise<void>;
}
export declare const modelGuardian: ModelGuardian;
