/**
 * Model Configuration Auto-Selection
 * Intelligently selects model precision based on environment
 * while allowing manual override
 */
export type ModelPrecision = 'fp32' | 'q8';
export type ModelPreset = 'fast' | 'small' | 'auto';
interface ModelConfigResult {
    precision: ModelPrecision;
    reason: string;
    autoSelected: boolean;
}
/**
 * Auto-select model precision based on environment and resources
 * DEFAULT: Q8 for optimal size/performance balance
 * @param override - Manual override: 'fp32', 'q8', 'fast' (fp32), 'small' (q8), or 'auto'
 */
export declare function autoSelectModelPrecision(override?: ModelPrecision | ModelPreset): ModelConfigResult;
/**
 * Convenience function to check if models need to be downloaded
 * This replaces the need for BRAINY_ALLOW_REMOTE_MODELS
 */
export declare function shouldAutoDownloadModels(): boolean;
/**
 * Get the model path with intelligent defaults
 * This replaces the need for BRAINY_MODELS_PATH env var
 */
export declare function getModelPath(): string;
/**
 * Log model configuration decision (only in verbose mode)
 */
export declare function logModelConfig(config: ModelConfigResult, verbose?: boolean): void;
export {};
