/**
 * Central Model Precision Manager
 *
 * Single source of truth for model precision configuration.
 * Ensures consistent usage of Q8 or FP32 models throughout the system.
 */
export class ModelPrecisionManager {
    constructor() {
        this.precision = 'q8'; // DEFAULT TO Q8
        this.isLocked = false;
        // Check environment variable override
        const envPrecision = process.env.BRAINY_MODEL_PRECISION;
        if (envPrecision === 'fp32' || envPrecision === 'q8') {
            this.precision = envPrecision;
            console.log(`Model precision set from environment: ${envPrecision.toUpperCase()}`);
        }
        else {
            console.log('Using default model precision: Q8 (75% smaller, 99% accuracy)');
        }
    }
    static getInstance() {
        if (!ModelPrecisionManager.instance) {
            ModelPrecisionManager.instance = new ModelPrecisionManager();
        }
        return ModelPrecisionManager.instance;
    }
    /**
     * Get the current model precision
     */
    getPrecision() {
        return this.precision;
    }
    /**
     * Set the model precision (can only be done before first model load)
     */
    setPrecision(precision) {
        if (this.isLocked) {
            console.warn(`⚠️ Cannot change precision after model initialization. Current: ${this.precision.toUpperCase()}`);
            return;
        }
        if (precision !== this.precision) {
            console.log(`Model precision changed: ${this.precision.toUpperCase()} → ${precision.toUpperCase()}`);
            this.precision = precision;
        }
    }
    /**
     * Lock the precision (called after first model load)
     */
    lock() {
        if (!this.isLocked) {
            this.isLocked = true;
            console.log(`Model precision locked: ${this.precision.toUpperCase()}`);
        }
    }
    /**
     * Check if precision is locked
     */
    isConfigLocked() {
        return this.isLocked;
    }
    /**
     * Get precision info for logging
     */
    getInfo() {
        const info = this.precision === 'q8'
            ? 'Q8 (quantized, 23MB, 99% accuracy)'
            : 'FP32 (full precision, 90MB, 100% accuracy)';
        return `${info}${this.isLocked ? ' [LOCKED]' : ''}`;
    }
    /**
     * Validate that a given precision matches the configured one
     */
    validatePrecision(precision) {
        if (precision !== this.precision) {
            console.error(`❌ Precision mismatch! Expected: ${this.precision.toUpperCase()}, Got: ${precision.toUpperCase()}`);
            console.error('This will cause incompatible embeddings!');
            return false;
        }
        return true;
    }
}
// Export singleton instance getter
export const getModelPrecision = () => {
    return ModelPrecisionManager.getInstance().getPrecision();
};
// Export setter (for configuration phase)
export const setModelPrecision = (precision) => {
    ModelPrecisionManager.getInstance().setPrecision(precision);
};
// Export lock function (for after model initialization)
export const lockModelPrecision = () => {
    ModelPrecisionManager.getInstance().lock();
};
// Export validation function
export const validateModelPrecision = (precision) => {
    return ModelPrecisionManager.getInstance().validatePrecision(precision);
};
//# sourceMappingURL=modelPrecisionManager.js.map