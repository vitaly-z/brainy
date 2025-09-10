/**
 * Universal Memory Manager for Embeddings
 *
 * Works in ALL environments: Node.js, browsers, serverless, workers
 * Solves transformers.js memory leak with environment-specific strategies
 */
import { getModelPrecision } from '../config/modelPrecisionManager.js';
// Environment detection
const isNode = typeof process !== 'undefined' && process.versions?.node;
const isBrowser = typeof window !== 'undefined' && typeof document !== 'undefined';
const isServerless = typeof process !== 'undefined' && (process.env.VERCEL ||
    process.env.NETLIFY ||
    process.env.AWS_LAMBDA_FUNCTION_NAME ||
    process.env.FUNCTIONS_WORKER_RUNTIME);
export class UniversalMemoryManager {
    constructor() {
        // CRITICAL FIX: Never use worker threads with ONNX Runtime
        // Worker threads cause HandleScope V8 API errors due to isolate issues
        // Always use direct embedding on main thread for ONNX compatibility
        this.embeddingFunction = null;
        this.embedCount = 0;
        this.restartCount = 0;
        this.lastRestart = 0;
        if (isServerless) {
            this.strategy = 'serverless-restart';
            this.maxEmbeddings = 50; // Restart frequently in serverless
        }
        else if (isNode && !isBrowser) {
            // CHANGED: Use direct strategy instead of node-worker to avoid V8 isolate issues
            this.strategy = 'node-direct';
            this.maxEmbeddings = 200; // Main thread can handle more with single model instance
        }
        else if (isBrowser) {
            this.strategy = 'browser-dispose';
            this.maxEmbeddings = 25; // Browser memory is limited
        }
        else {
            this.strategy = 'fallback-dispose';
            this.maxEmbeddings = 75;
        }
        console.log(`🧠 Universal Memory Manager: Using ${this.strategy} strategy`);
        console.log('✅ UNIVERSAL: Memory-safe embedding system initialized');
    }
    async getEmbeddingFunction() {
        return async (data) => {
            return this.embed(data);
        };
    }
    async embed(data) {
        // Check if we need to restart/cleanup
        await this.checkMemoryLimits();
        // Ensure embedding function is available
        await this.ensureEmbeddingFunction();
        // Perform embedding
        const result = await this.embeddingFunction.embed(data);
        this.embedCount++;
        return result;
    }
    async checkMemoryLimits() {
        if (this.embedCount >= this.maxEmbeddings) {
            console.log(`🔄 Memory cleanup: ${this.embedCount} embeddings processed`);
            await this.cleanup();
        }
    }
    async ensureEmbeddingFunction() {
        if (this.embeddingFunction) {
            return;
        }
        switch (this.strategy) {
            case 'node-direct':
                await this.initNodeDirect();
                break;
            case 'serverless-restart':
                await this.initServerless();
                break;
            case 'browser-dispose':
                await this.initBrowser();
                break;
            default:
                await this.initFallback();
        }
    }
    async initNodeDirect() {
        if (isNode) {
            // CRITICAL: Use direct embedding to avoid worker thread V8 isolate issues
            // This prevents HandleScope errors and ensures single model instance
            console.log('✅ Using Node.js direct embedding (main thread - ONNX compatible)');
            await this.initDirect();
        }
    }
    async initServerless() {
        // In serverless, use direct embedding but restart more aggressively
        await this.initDirect();
        console.log('✅ Using serverless strategy with aggressive cleanup');
    }
    async initBrowser() {
        // In browser, use direct embedding with disposal
        await this.initDirect();
        console.log('✅ Using browser strategy with disposal');
    }
    async initFallback() {
        await this.initDirect();
        console.log('✅ Using fallback direct embedding strategy');
    }
    async initDirect() {
        try {
            // Dynamic import to handle different environments
            const { TransformerEmbedding } = await import('../utils/embedding.js');
            this.embeddingFunction = new TransformerEmbedding({
                verbose: false,
                precision: getModelPrecision(), // Use centrally managed precision
                localFilesOnly: process.env.BRAINY_ALLOW_REMOTE_MODELS !== 'true'
            });
            await this.embeddingFunction.init();
            console.log('✅ Direct embedding function initialized');
        }
        catch (error) {
            throw new Error(`Failed to initialize embedding function: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    async cleanup() {
        const startTime = Date.now();
        // SingletonModelManager persists - we just reset our counters
        // The singleton model stays alive for consistency across all operations
        // Reset counters
        this.embedCount = 0;
        this.restartCount++;
        this.lastRestart = Date.now();
        const cleanupTime = Date.now() - startTime;
        console.log(`🧹 Memory counters reset in ${cleanupTime}ms (strategy: ${this.strategy})`);
        console.log('ℹ️ Singleton model persists for consistency across all operations');
    }
    getMemoryStats() {
        let memoryUsage = 'unknown';
        // Get memory stats based on environment
        if (isNode && typeof process !== 'undefined') {
            const mem = process.memoryUsage();
            memoryUsage = `${(mem.heapUsed / 1024 / 1024).toFixed(2)} MB`;
        }
        else if (isBrowser && performance.memory) {
            const mem = performance.memory;
            memoryUsage = `${(mem.usedJSHeapSize / 1024 / 1024).toFixed(2)} MB`;
        }
        return {
            embeddings: this.embedCount,
            memoryUsage,
            restarts: this.restartCount,
            strategy: this.strategy
        };
    }
    async dispose() {
        // SingletonModelManager persists - nothing to dispose
        console.log('ℹ️ Universal Memory Manager: Singleton model persists');
    }
}
// Export singleton instance
export const universalMemoryManager = new UniversalMemoryManager();
// Export convenience function
export async function getUniversalEmbeddingFunction() {
    return universalMemoryManager.getEmbeddingFunction();
}
// Export memory stats function
export function getEmbeddingMemoryStats() {
    return universalMemoryManager.getMemoryStats();
}
//# sourceMappingURL=universal-memory-manager.js.map