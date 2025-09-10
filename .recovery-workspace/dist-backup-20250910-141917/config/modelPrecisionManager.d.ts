/**
 * Central Model Precision Manager
 *
 * Single source of truth for model precision configuration.
 * Ensures consistent usage of Q8 or FP32 models throughout the system.
 */
import { ModelPrecision } from './modelAutoConfig.js';
export declare class ModelPrecisionManager {
    private static instance;
    private precision;
    private isLocked;
    private constructor();
    static getInstance(): ModelPrecisionManager;
    /**
     * Get the current model precision
     */
    getPrecision(): ModelPrecision;
    /**
     * Set the model precision (can only be done before first model load)
     */
    setPrecision(precision: ModelPrecision): void;
    /**
     * Lock the precision (called after first model load)
     */
    lock(): void;
    /**
     * Check if precision is locked
     */
    isConfigLocked(): boolean;
    /**
     * Get precision info for logging
     */
    getInfo(): string;
    /**
     * Validate that a given precision matches the configured one
     */
    validatePrecision(precision: ModelPrecision): boolean;
}
export declare const getModelPrecision: () => ModelPrecision;
export declare const setModelPrecision: (precision: ModelPrecision) => void;
export declare const lockModelPrecision: () => void;
export declare const validateModelPrecision: (precision: ModelPrecision) => boolean;
