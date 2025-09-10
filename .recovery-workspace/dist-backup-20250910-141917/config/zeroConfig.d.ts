/**
 * Zero-Configuration System for Brainy
 * Provides intelligent defaults while preserving full control
 */
import { ModelPrecision, ModelPreset } from './modelAutoConfig.js';
import { StorageType, StoragePreset } from './storageAutoConfig.js';
/**
 * Simplified configuration interface
 * Everything is optional - zero config by default!
 */
export interface BrainyZeroConfig {
    /**
     * Configuration preset for common scenarios
     * - 'production': Optimized for production (disk storage, auto model, default features)
     * - 'development': Optimized for development (memory storage, fp32, verbose logging)
     * - 'minimal': Minimal footprint (memory storage, q8, minimal features)
     * - 'zero': True zero config (all auto-detected)
     * - 'writer': Write-only instance for distributed setups (no index loading)
     * - 'reader': Read-only instance for distributed setups (no write operations)
     */
    mode?: 'production' | 'development' | 'minimal' | 'zero' | 'writer' | 'reader';
    /**
     * Model precision configuration
     * - 'fp32': Full precision (best quality, larger size)
     * - 'q8': Quantized 8-bit (smaller size, slightly lower quality)
     * - 'fast': Alias for fp32
     * - 'small': Alias for q8
     * - 'auto': Auto-detect based on environment (default)
     */
    model?: ModelPrecision | ModelPreset;
    /**
     * Storage configuration
     * - 'memory': In-memory only (no persistence)
     * - 'disk': Local disk (filesystem or OPFS)
     * - 'cloud': Cloud storage (S3/GCS/R2 if configured)
     * - 'auto': Auto-detect best option (default)
     * - Object: Custom storage configuration
     */
    storage?: StorageType | StoragePreset | any;
    /**
     * Feature set configuration
     * - 'minimal': Core features only (fastest startup)
     * - 'default': Standard features (balanced)
     * - 'full': All features enabled (most capable)
     * - Array: Specific features to enable
     */
    features?: 'minimal' | 'default' | 'full' | string[];
    /**
     * Logging verbosity
     * - true: Show configuration decisions and progress
     * - false: Silent operation (default in production)
     */
    verbose?: boolean;
    /**
     * Advanced configuration (escape hatch for power users)
     * Any additional configuration can be passed here
     */
    advanced?: any;
}
/**
 * Process zero-config input into full configuration
 */
export declare function processZeroConfig(input?: string | BrainyZeroConfig): Promise<any>;
/**
 * Create embedding function with specified precision
 * This ensures the model precision is respected
 */
export declare function createEmbeddingFunctionWithPrecision(precision: ModelPrecision): Promise<any>;
