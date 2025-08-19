/**
 * Write Buffer
 * Accumulates writes and flushes them in bulk to reduce S3 operations
 * Implements intelligent deduplication and compression
 */
import { createModuleLogger } from './logger.js';
import { getGlobalBackpressure } from './adaptiveBackpressure.js';
/**
 * High-performance write buffer for bulk operations
 */
export class WriteBuffer {
    constructor(type, writeFunction, options) {
        this.logger = createModuleLogger('WriteBuffer');
        // Buffer storage
        this.buffer = new Map();
        // Configuration - More aggressive for high volume
        this.maxBufferSize = 2000; // Allow larger buffers
        this.flushInterval = 500; // Flush more frequently (0.5 seconds)
        this.minFlushSize = 50; // Lower minimum to flush sooner
        this.maxRetries = 3; // Maximum retry attempts
        // State
        this.flushTimer = null;
        this.isFlushing = false;
        this.lastFlush = Date.now();
        this.pendingFlush = null;
        // Statistics
        this.totalWrites = 0;
        this.totalFlushes = 0;
        this.failedWrites = 0;
        this.duplicatesRemoved = 0;
        // Backpressure integration
        this.backpressure = getGlobalBackpressure();
        this.type = type;
        this.writeFunction = writeFunction;
        if (options) {
            this.maxBufferSize = options.maxBufferSize || this.maxBufferSize;
            this.flushInterval = options.flushInterval || this.flushInterval;
            this.minFlushSize = options.minFlushSize || this.minFlushSize;
        }
        // Start periodic flush
        this.startPeriodicFlush();
    }
    /**
     * Add item to buffer
     */
    async add(id, data) {
        // Check if we're already at capacity
        if (this.buffer.size >= this.maxBufferSize) {
            // Wait for current flush to complete
            if (this.pendingFlush) {
                await this.pendingFlush;
            }
            // Force flush if still at capacity
            if (this.buffer.size >= this.maxBufferSize) {
                await this.flush('capacity');
            }
        }
        // Check for duplicate and update if newer
        const existing = this.buffer.get(id);
        if (existing) {
            // Update with newer data
            existing.data = data;
            existing.timestamp = Date.now();
            this.duplicatesRemoved++;
        }
        else {
            // Add new item
            this.buffer.set(id, {
                id,
                data,
                timestamp: Date.now(),
                type: this.type,
                retryCount: 0
            });
        }
        this.totalWrites++;
        // Log buffer growth periodically
        if (this.totalWrites % 100 === 0) {
            this.logger.info(`📈 BUFFER GROWTH: ${this.buffer.size} ${this.type} items buffered (${this.totalWrites} total writes, ${this.duplicatesRemoved} deduplicated)`);
        }
        // Check if we should flush
        this.checkFlush();
    }
    /**
     * Check if we should flush
     */
    checkFlush() {
        const bufferSize = this.buffer.size;
        const timeSinceFlush = Date.now() - this.lastFlush;
        // Immediate flush conditions
        if (bufferSize >= this.maxBufferSize) {
            this.flush('size');
            return;
        }
        // Time-based flush with minimum size
        if (timeSinceFlush >= this.flushInterval && bufferSize >= this.minFlushSize) {
            this.flush('time');
            return;
        }
        // Adaptive flush based on system load
        const backpressureStatus = this.backpressure.getStatus();
        if (backpressureStatus.queueLength > 1000 && bufferSize > 10) {
            // System under pressure - flush smaller batches more frequently
            this.flush('pressure');
        }
    }
    /**
     * Flush buffer to storage
     */
    async flush(reason = 'manual') {
        // Prevent concurrent flushes
        if (this.isFlushing) {
            if (this.pendingFlush) {
                return this.pendingFlush;
            }
            return { successful: 0, failed: 0, duration: 0 };
        }
        // Nothing to flush
        if (this.buffer.size === 0) {
            return { successful: 0, failed: 0, duration: 0 };
        }
        this.isFlushing = true;
        const startTime = Date.now();
        // Create flush promise
        this.pendingFlush = this.doFlush(reason, startTime);
        try {
            const result = await this.pendingFlush;
            return result;
        }
        finally {
            this.isFlushing = false;
            this.pendingFlush = null;
        }
    }
    /**
     * Perform the actual flush
     */
    async doFlush(reason, startTime) {
        const itemsToFlush = new Map();
        const flushingItems = new Map();
        // Take items from buffer
        let count = 0;
        for (const [id, item] of this.buffer.entries()) {
            itemsToFlush.set(id, item.data);
            flushingItems.set(id, item);
            count++;
            // Limit batch size for better performance
            if (count >= 500) {
                break;
            }
        }
        // Remove from buffer
        for (const id of itemsToFlush.keys()) {
            this.buffer.delete(id);
        }
        this.logger.warn(`🔄 BUFFERING: Flushing ${itemsToFlush.size} ${this.type} items (buffer had ${this.buffer.size + itemsToFlush.size}) - reason: ${reason}`);
        try {
            // Request permission from backpressure system
            const opId = `flush-${Date.now()}`;
            await this.backpressure.requestPermission(opId, 2); // Higher priority
            try {
                // Perform bulk write
                await this.writeFunction(itemsToFlush);
                // Success
                this.backpressure.releasePermission(opId, true);
                this.totalFlushes++;
                this.lastFlush = Date.now();
                const duration = Date.now() - startTime;
                this.logger.warn(`🚀 BATCH FLUSH: ${itemsToFlush.size} ${this.type} items → 1 bulk S3 operation (${duration}ms, reason: ${reason})`);
                return {
                    successful: itemsToFlush.size,
                    failed: 0,
                    duration
                };
            }
            catch (error) {
                // Release with error
                this.backpressure.releasePermission(opId, false);
                throw error;
            }
        }
        catch (error) {
            this.logger.error(`Flush failed: ${error}`);
            // Put items back with retry count
            for (const [id, item] of flushingItems.entries()) {
                item.retryCount++;
                if (item.retryCount < this.maxRetries) {
                    // Put back for retry
                    this.buffer.set(id, item);
                }
                else {
                    // Max retries exceeded
                    this.failedWrites++;
                    this.logger.error(`Max retries exceeded for ${this.type} ${id}`);
                }
            }
            const duration = Date.now() - startTime;
            return {
                successful: 0,
                failed: itemsToFlush.size,
                duration
            };
        }
    }
    /**
     * Start periodic flush timer
     */
    startPeriodicFlush() {
        if (this.flushTimer) {
            return;
        }
        this.flushTimer = setInterval(() => {
            if (this.buffer.size > 0) {
                const timeSinceFlush = Date.now() - this.lastFlush;
                // Flush if we have items and enough time has passed
                if (timeSinceFlush >= this.flushInterval) {
                    this.flush('periodic').catch(error => {
                        this.logger.error('Periodic flush failed:', error);
                    });
                }
            }
        }, Math.min(100, this.flushInterval / 2));
    }
    /**
     * Stop periodic flush timer
     */
    stop() {
        if (this.flushTimer) {
            clearInterval(this.flushTimer);
            this.flushTimer = null;
        }
    }
    /**
     * Force flush all pending writes
     */
    async forceFlush() {
        // Flush everything regardless of size
        const oldMinSize = this.minFlushSize;
        this.minFlushSize = 0;
        try {
            const result = await this.flush('force');
            // Flush any remaining items
            while (this.buffer.size > 0) {
                const additionalResult = await this.flush('force-remaining');
                result.successful += additionalResult.successful;
                result.failed += additionalResult.failed;
                result.duration += additionalResult.duration;
            }
            return result;
        }
        finally {
            this.minFlushSize = oldMinSize;
        }
    }
    /**
     * Get buffer statistics
     */
    getStats() {
        return {
            bufferSize: this.buffer.size,
            totalWrites: this.totalWrites,
            totalFlushes: this.totalFlushes,
            failedWrites: this.failedWrites,
            duplicatesRemoved: this.duplicatesRemoved,
            avgFlushSize: this.totalFlushes > 0 ? this.totalWrites / this.totalFlushes : 0
        };
    }
    /**
     * Adjust parameters based on load
     */
    adjustForLoad(pendingRequests) {
        if (pendingRequests > 10000) {
            // Extreme load - buffer more aggressively
            this.maxBufferSize = 5000;
            this.flushInterval = 500;
            this.minFlushSize = 500;
        }
        else if (pendingRequests > 1000) {
            // High load
            this.maxBufferSize = 2000;
            this.flushInterval = 1000;
            this.minFlushSize = 200;
        }
        else if (pendingRequests > 100) {
            // Moderate load
            this.maxBufferSize = 1000;
            this.flushInterval = 2000;
            this.minFlushSize = 100;
        }
        else {
            // Low load - optimize for latency
            this.maxBufferSize = 500;
            this.flushInterval = 5000;
            this.minFlushSize = 50;
        }
    }
}
// Global write buffers
const writeBuffers = new Map();
/**
 * Get or create a write buffer
 */
export function getWriteBuffer(id, type, writeFunction) {
    if (!writeBuffers.has(id)) {
        writeBuffers.set(id, new WriteBuffer(type, writeFunction));
    }
    return writeBuffers.get(id);
}
/**
 * Flush all write buffers
 */
export async function flushAllBuffers() {
    const promises = [];
    for (const buffer of writeBuffers.values()) {
        promises.push(buffer.forceFlush());
    }
    await Promise.all(promises);
}
/**
 * Clear all write buffers
 */
export function clearWriteBuffers() {
    for (const buffer of writeBuffers.values()) {
        buffer.stop();
    }
    writeBuffers.clear();
}
//# sourceMappingURL=writeBuffer.js.map