/**
 * Worker Manager for Memory-Safe Embeddings
 *
 * Manages worker lifecycle to prevent transformers.js memory leaks
 * Workers are automatically restarted when memory usage grows too high
 */
import { Worker } from 'worker_threads';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
// Get current directory for worker path
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
export class WorkerEmbeddingManager {
    constructor() {
        this.worker = null;
        this.requestId = 0;
        this.pendingRequests = new Map();
        this.isRestarting = false;
        this.totalRequests = 0;
    }
    async getEmbeddingFunction() {
        return async (data) => {
            return this.embed(data);
        };
    }
    async embed(data) {
        await this.ensureWorker();
        const id = ++this.requestId;
        this.totalRequests++;
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                this.pendingRequests.delete(id);
                reject(new Error('Embedding request timed out (120s)'));
            }, 120000);
            this.pendingRequests.set(id, { resolve, reject, timeout });
            this.worker.postMessage({
                id,
                type: 'embed',
                data
            });
        });
    }
    async ensureWorker() {
        if (this.worker && !this.isRestarting) {
            return;
        }
        if (this.isRestarting) {
            // Wait for restart to complete
            return new Promise((resolve) => {
                const checkRestart = () => {
                    if (!this.isRestarting) {
                        resolve();
                    }
                    else {
                        setTimeout(checkRestart, 100);
                    }
                };
                checkRestart();
            });
        }
        await this.createWorker();
    }
    async createWorker() {
        this.isRestarting = true;
        // Kill existing worker if any
        if (this.worker) {
            this.worker.terminate();
            this.worker = null;
        }
        // Clear pending requests
        for (const [id, request] of this.pendingRequests) {
            if (request.timeout) {
                clearTimeout(request.timeout);
            }
            request.reject(new Error('Worker restarted'));
        }
        this.pendingRequests.clear();
        console.log('🔄 Starting embedding worker...');
        // Create new worker
        const workerPath = join(__dirname, 'worker-embedding.js');
        this.worker = new Worker(workerPath);
        // Handle worker messages
        this.worker.on('message', (message) => {
            if (message.type === 'ready') {
                console.log('✅ Embedding worker ready');
                this.isRestarting = false;
                return;
            }
            const { id, success, result, error } = message;
            const request = this.pendingRequests.get(id);
            if (request) {
                if (request.timeout) {
                    clearTimeout(request.timeout);
                }
                this.pendingRequests.delete(id);
                if (success) {
                    request.resolve(result);
                }
                else {
                    request.reject(new Error(error));
                }
            }
        });
        // Handle worker exit
        this.worker.on('exit', (code) => {
            console.log(`🔄 Embedding worker exited with code ${code}`);
            if (code !== 0 && !this.isRestarting) {
                console.log('🔄 Worker crashed, will restart on next request');
            }
            this.worker = null;
        });
        // Wait for worker to be ready
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error('Worker startup timeout'));
            }, 30000);
            const checkReady = () => {
                if (!this.isRestarting) {
                    clearTimeout(timeout);
                    resolve();
                }
                else {
                    setTimeout(checkReady, 100);
                }
            };
            checkReady();
        });
    }
    async dispose() {
        if (this.worker) {
            this.worker.terminate();
            this.worker = null;
        }
        // Clear pending requests
        for (const [id, request] of this.pendingRequests) {
            if (request.timeout) {
                clearTimeout(request.timeout);
            }
            request.reject(new Error('Manager disposed'));
        }
        this.pendingRequests.clear();
    }
    async forceRestart() {
        console.log('🔄 Force restarting embedding worker (memory cleanup)');
        await this.createWorker();
    }
    getStats() {
        return {
            totalRequests: this.totalRequests,
            pendingRequests: this.pendingRequests.size,
            workerActive: this.worker !== null,
            isRestarting: this.isRestarting
        };
    }
}
// Export singleton instance
export const workerEmbeddingManager = new WorkerEmbeddingManager();
// Export convenience function
export async function getWorkerEmbeddingFunction() {
    return workerEmbeddingManager.getEmbeddingFunction();
}
//# sourceMappingURL=worker-manager.js.map