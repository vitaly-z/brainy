/**
 * Hybrid Model Manager - BEST OF BOTH WORLDS
 *
 * NOW A WRAPPER AROUND SingletonModelManager
 * Maintained for backward compatibility
 *
 * Previously combined:
 * 1. Multi-source downloading strategy (GitHub → CDN → Hugging Face)
 * 2. Singleton pattern preventing multiple ONNX model loads
 * 3. Environment-specific optimizations
 * 4. Graceful fallbacks and error handling
 *
 * Now delegates all operations to SingletonModelManager for true unification
 */
import { singletonModelManager, getUnifiedEmbeddingFunction } from '../embeddings/SingletonModelManager.js';
/**
 * HybridModelManager - Now a wrapper around SingletonModelManager
 * Maintained for backward compatibility
 */
class HybridModelManager {
    constructor() {
        console.log('🔄 HybridModelManager now delegates to SingletonModelManager');
    }
    static getInstance() {
        if (!HybridModelManager.instance) {
            HybridModelManager.instance = new HybridModelManager();
        }
        return HybridModelManager.instance;
    }
    /**
     * Get the primary embedding model - delegates to SingletonModelManager
     */
    async getPrimaryModel() {
        // Delegate to SingletonModelManager
        return await singletonModelManager.getModel();
    }
    /**
     * Get embedding function - delegates to SingletonModelManager
     */
    async getEmbeddingFunction() {
        return await getUnifiedEmbeddingFunction();
    }
    /**
     * Check if model is ready - delegates to SingletonModelManager
     */
    isModelReady() {
        return singletonModelManager.isInitialized();
    }
    /**
     * Force model reload - not supported with SingletonModelManager
     */
    async reloadModel() {
        console.warn('⚠️ Model reload not supported with SingletonModelManager');
        console.log('ℹ️ Singleton model persists for consistency');
        // Just ensure model is initialized
        await this.getPrimaryModel();
    }
    /**
     * Get model status - delegates to SingletonModelManager
     */
    getModelStatus() {
        const isReady = singletonModelManager.isInitialized();
        return {
            loaded: isReady,
            ready: isReady,
            modelType: 'SingletonModelManager (Unified model instance)'
        };
    }
}
HybridModelManager.instance = null;
// Export singleton instance
export const hybridModelManager = HybridModelManager.getInstance();
/**
 * Get the hybrid singleton embedding function - Now delegates to SingletonModelManager
 * Maintained for backward compatibility
 */
export async function getHybridEmbeddingFunction() {
    return await getUnifiedEmbeddingFunction();
}
/**
 * Hybrid embedding function - Now delegates to SingletonModelManager
 * Maintained for backward compatibility
 */
export const hybridEmbeddingFunction = async (data) => {
    return await singletonModelManager.embed(data);
};
/**
 * Preload model for tests or production - Now delegates to SingletonModelManager
 */
export async function preloadHybridModel() {
    console.log('🚀 Preloading model via SingletonModelManager...');
    await singletonModelManager.getModel();
    console.log('✅ Singleton model preloaded and ready!');
}
//# sourceMappingURL=hybridModelManager.js.map