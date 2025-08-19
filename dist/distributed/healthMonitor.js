/**
 * Health Monitor
 * Monitors and reports instance health in distributed deployments
 */
export class HealthMonitor {
    constructor(configManager) {
        this.requestCount = 0;
        this.errorCount = 0;
        this.totalLatency = 0;
        this.cacheHits = 0;
        this.cacheMisses = 0;
        this.vectorCount = 0;
        this.checkInterval = 30000; // 30 seconds
        this.metricsWindow = []; // Sliding window for RPS calculation
        this.latencyWindow = []; // Sliding window for latency
        this.windowSize = 60000; // 1 minute window
        this.configManager = configManager;
        this.startTime = Date.now();
    }
    /**
     * Start health monitoring
     */
    start() {
        // Initial health update
        this.updateHealth();
        // Schedule periodic health checks
        this.healthCheckTimer = setInterval(() => {
            this.updateHealth();
        }, this.checkInterval);
    }
    /**
     * Stop health monitoring
     */
    stop() {
        if (this.healthCheckTimer) {
            clearInterval(this.healthCheckTimer);
            this.healthCheckTimer = undefined;
        }
    }
    /**
     * Update health status and metrics
     */
    async updateHealth() {
        const metrics = this.collectMetrics();
        // Update config with latest metrics
        await this.configManager.updateMetrics({
            vectorCount: metrics.vectorCount,
            cacheHitRate: metrics.cacheHitRate,
            memoryUsage: metrics.memoryUsage,
            cpuUsage: metrics.cpuUsage
        });
        // Clean sliding windows
        this.cleanWindows();
    }
    /**
     * Collect current metrics
     */
    collectMetrics() {
        const memUsage = process.memoryUsage();
        return {
            vectorCount: this.vectorCount,
            cacheHitRate: this.calculateCacheHitRate(),
            memoryUsage: memUsage.heapUsed,
            cpuUsage: this.getCPUUsage(),
            requestsPerSecond: this.calculateRPS(),
            averageLatency: this.calculateAverageLatency(),
            errorRate: this.calculateErrorRate()
        };
    }
    /**
     * Calculate cache hit rate
     */
    calculateCacheHitRate() {
        const total = this.cacheHits + this.cacheMisses;
        if (total === 0)
            return 0;
        return this.cacheHits / total;
    }
    /**
     * Calculate requests per second
     */
    calculateRPS() {
        const now = Date.now();
        const recentRequests = this.metricsWindow.filter(timestamp => now - timestamp < this.windowSize);
        return recentRequests.length / (this.windowSize / 1000);
    }
    /**
     * Calculate average latency
     */
    calculateAverageLatency() {
        if (this.latencyWindow.length === 0)
            return 0;
        const sum = this.latencyWindow.reduce((a, b) => a + b, 0);
        return sum / this.latencyWindow.length;
    }
    /**
     * Calculate error rate
     */
    calculateErrorRate() {
        if (this.requestCount === 0)
            return 0;
        return this.errorCount / this.requestCount;
    }
    /**
     * Get CPU usage (simplified)
     */
    getCPUUsage() {
        // Simplified CPU usage based on process time
        const usage = process.cpuUsage();
        const total = usage.user + usage.system;
        const seconds = (Date.now() - this.startTime) / 1000;
        return Math.min(100, (total / 1000000 / seconds) * 100);
    }
    /**
     * Clean old entries from sliding windows
     */
    cleanWindows() {
        const now = Date.now();
        const cutoff = now - this.windowSize;
        this.metricsWindow = this.metricsWindow.filter(t => t > cutoff);
        // Keep only recent latency measurements
        if (this.latencyWindow.length > 100) {
            this.latencyWindow = this.latencyWindow.slice(-100);
        }
    }
    /**
     * Record a request
     * @param latency - Request latency in milliseconds
     * @param error - Whether the request resulted in an error
     */
    recordRequest(latency, error = false) {
        this.requestCount++;
        this.metricsWindow.push(Date.now());
        this.latencyWindow.push(latency);
        if (error) {
            this.errorCount++;
        }
    }
    /**
     * Record cache access
     * @param hit - Whether it was a cache hit
     */
    recordCacheAccess(hit) {
        if (hit) {
            this.cacheHits++;
        }
        else {
            this.cacheMisses++;
        }
    }
    /**
     * Update vector count
     * @param count - New vector count
     */
    updateVectorCount(count) {
        this.vectorCount = count;
    }
    /**
     * Get current health status
     * @returns Health status object
     */
    getHealthStatus() {
        const metrics = this.collectMetrics();
        const uptime = Date.now() - this.startTime;
        const warnings = [];
        const errors = [];
        // Check for warnings
        if (metrics.memoryUsage > 1024 * 1024 * 1024) { // > 1GB
            warnings.push('High memory usage detected');
        }
        if (metrics.cacheHitRate < 0.5) {
            warnings.push('Low cache hit rate');
        }
        if (metrics.errorRate && metrics.errorRate > 0.05) {
            warnings.push('High error rate detected');
        }
        if (metrics.averageLatency && metrics.averageLatency > 1000) {
            warnings.push('High latency detected');
        }
        // Check for errors
        if (metrics.memoryUsage > 2 * 1024 * 1024 * 1024) { // > 2GB
            errors.push('Critical memory usage');
        }
        if (metrics.errorRate && metrics.errorRate > 0.2) {
            errors.push('Critical error rate');
        }
        // Determine overall status
        let status = 'healthy';
        if (errors.length > 0) {
            status = 'unhealthy';
        }
        else if (warnings.length > 0) {
            status = 'degraded';
        }
        return {
            status,
            instanceId: this.configManager.getInstanceId(),
            role: this.configManager.getRole(),
            uptime,
            lastCheck: new Date().toISOString(),
            metrics,
            warnings: warnings.length > 0 ? warnings : undefined,
            errors: errors.length > 0 ? errors : undefined
        };
    }
    /**
     * Get health check endpoint data
     * @returns JSON-serializable health data
     */
    getHealthEndpointData() {
        const status = this.getHealthStatus();
        return {
            status: status.status,
            instanceId: status.instanceId,
            role: status.role,
            uptime: Math.floor(status.uptime / 1000), // Convert to seconds
            lastCheck: status.lastCheck,
            metrics: {
                vectorCount: status.metrics.vectorCount,
                cacheHitRate: Math.round(status.metrics.cacheHitRate * 100) / 100,
                memoryUsageMB: Math.round(status.metrics.memoryUsage / 1024 / 1024),
                cpuUsagePercent: Math.round(status.metrics.cpuUsage || 0),
                requestsPerSecond: Math.round(status.metrics.requestsPerSecond || 0),
                averageLatencyMs: Math.round(status.metrics.averageLatency || 0),
                errorRate: Math.round((status.metrics.errorRate || 0) * 100) / 100
            },
            warnings: status.warnings,
            errors: status.errors
        };
    }
    /**
     * Reset metrics (useful for testing)
     */
    resetMetrics() {
        this.requestCount = 0;
        this.errorCount = 0;
        this.totalLatency = 0;
        this.cacheHits = 0;
        this.cacheMisses = 0;
        this.metricsWindow = [];
        this.latencyWindow = [];
    }
}
//# sourceMappingURL=healthMonitor.js.map