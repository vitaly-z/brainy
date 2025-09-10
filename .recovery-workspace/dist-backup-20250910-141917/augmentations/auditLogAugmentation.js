/**
 * Audit Logging Augmentation
 * Provides comprehensive audit trail for all Brainy operations
 */
import { BaseAugmentation } from './brainyAugmentation.js';
import { createHash } from 'crypto';
/**
 * Audit Log Augmentation
 */
export class AuditLogAugmentation extends BaseAugmentation {
    constructor(config = {}) {
        super(config);
        this.name = 'auditLogger';
        this.timing = 'around';
        this.metadata = 'readonly'; // Read metadata for context
        this.operations = ['all']; // Audit all operations
        this.priority = 90; // Low priority, runs last
        // Augmentation metadata
        this.category = 'core';
        this.description = 'Comprehensive audit logging for compliance and debugging';
        this.logs = [];
        // Merge with defaults
        this.config = {
            enabled: config.enabled ?? true,
            logLevel: config.logLevel ?? 'standard',
            includeData: config.includeData ?? false,
            includeMetadata: config.includeMetadata ?? true,
            retention: config.retention ?? 90, // 90 days default
            storage: config.storage ?? 'memory',
            filePath: config.filePath,
            maxMemoryLogs: config.maxMemoryLogs ?? 10000
        };
        // Generate session ID
        this.sessionId = this.generateId();
    }
    getManifest() {
        return {
            id: 'audit-logger',
            name: 'Audit Logger',
            version: '1.0.0',
            description: 'Comprehensive audit trail for all operations',
            longDescription: 'Records detailed audit logs of all Brainy operations for compliance, debugging, and analytics purposes.',
            category: 'analytics',
            configSchema: {
                type: 'object',
                properties: {
                    enabled: {
                        type: 'boolean',
                        default: true,
                        description: 'Enable audit logging'
                    },
                    logLevel: {
                        type: 'string',
                        enum: ['minimal', 'standard', 'detailed'],
                        default: 'standard',
                        description: 'Level of detail to log'
                    },
                    includeData: {
                        type: 'boolean',
                        default: false,
                        description: 'Include actual data in logs (privacy concern)'
                    },
                    includeMetadata: {
                        type: 'boolean',
                        default: true,
                        description: 'Include metadata in logs'
                    },
                    retention: {
                        type: 'number',
                        default: 90,
                        minimum: 1,
                        maximum: 365,
                        description: 'Days to retain logs'
                    },
                    storage: {
                        type: 'string',
                        enum: ['memory', 'file', 'database'],
                        default: 'memory',
                        description: 'Where to store audit logs'
                    },
                    maxMemoryLogs: {
                        type: 'number',
                        default: 10000,
                        description: 'Maximum logs to keep in memory'
                    }
                }
            },
            configDefaults: {
                enabled: true,
                logLevel: 'standard',
                includeData: false,
                includeMetadata: true,
                retention: 90,
                storage: 'memory',
                maxMemoryLogs: 10000
            },
            minBrainyVersion: '3.0.0',
            keywords: ['audit', 'logging', 'compliance', 'analytics'],
            documentation: 'https://docs.brainy.dev/augmentations/audit-log',
            status: 'stable',
            performance: {
                memoryUsage: 'medium',
                cpuUsage: 'low',
                networkUsage: 'none'
            },
            features: ['operation-logging', 'configurable-detail', 'retention-management'],
            enhancedOperations: ['all'],
            metrics: [
                {
                    name: 'audit_logs_created',
                    type: 'counter',
                    description: 'Total audit logs created'
                },
                {
                    name: 'audit_log_size',
                    type: 'gauge',
                    description: 'Current audit log size'
                }
            ]
        };
    }
    async onInitialize() {
        if (!this.config.enabled) {
            this.log('Audit logger disabled by configuration');
            return;
        }
        this.log(`Audit logger initialized (level: ${this.config.logLevel}, storage: ${this.config.storage})`);
        // Start retention cleanup if using memory storage
        if (this.config.storage === 'memory') {
            setInterval(() => {
                this.cleanupOldLogs();
            }, 3600000); // Every hour
        }
    }
    async onShutdown() {
        // Save any pending logs if using file storage
        if (this.config.storage === 'file' && this.logs.length > 0) {
            await this.flushLogs();
        }
        this.log('Audit logger shut down');
    }
    /**
     * Execute augmentation - log operations
     */
    async execute(operation, params, next) {
        // If audit logging is disabled, just pass through
        if (!this.config.enabled) {
            return next();
        }
        const startTime = Date.now();
        const logEntry = {
            id: this.generateId(),
            timestamp: startTime,
            operation,
            sessionId: this.sessionId
        };
        // Add params based on log level
        if (this.config.logLevel !== 'minimal') {
            logEntry.params = this.sanitizeParams(params);
        }
        try {
            const result = await next();
            // Log successful operation
            logEntry.duration = Date.now() - startTime;
            // Add result based on log level and config
            if (this.config.logLevel === 'detailed' && this.config.includeData) {
                logEntry.result = this.sanitizeResult(result);
            }
            await this.writeLog(logEntry);
            return result;
        }
        catch (error) {
            // Log failed operation
            logEntry.duration = Date.now() - startTime;
            logEntry.error = this.sanitizeError(error);
            await this.writeLog(logEntry);
            throw error;
        }
    }
    /**
     * Sanitize parameters to remove sensitive data
     */
    sanitizeParams(params) {
        if (!params)
            return params;
        // Don't include actual data unless configured
        if (!this.config.includeData && params.data) {
            return {
                ...params,
                data: '[REDACTED]'
            };
        }
        // Redact common sensitive fields
        const sanitized = { ...params };
        const sensitiveFields = ['password', 'token', 'apiKey', 'secret'];
        for (const field of sensitiveFields) {
            if (sanitized[field]) {
                sanitized[field] = '[REDACTED]';
            }
        }
        return sanitized;
    }
    /**
     * Sanitize result data
     */
    sanitizeResult(result) {
        if (!result)
            return result;
        // For arrays, just log count
        if (Array.isArray(result)) {
            return { count: result.length, type: 'array' };
        }
        // For objects, remove sensitive fields
        if (typeof result === 'object') {
            const sanitized = {};
            for (const key in result) {
                if (!['password', 'token', 'apiKey', 'secret'].includes(key)) {
                    sanitized[key] = result[key];
                }
            }
            return sanitized;
        }
        return result;
    }
    /**
     * Sanitize error information
     */
    sanitizeError(error) {
        if (!error)
            return error;
        return {
            message: error.message || 'Unknown error',
            code: error.code,
            statusCode: error.statusCode,
            stack: this.config.logLevel === 'detailed' ? error.stack : undefined
        };
    }
    /**
     * Write log entry
     */
    async writeLog(entry) {
        switch (this.config.storage) {
            case 'memory':
                this.logs.push(entry);
                // Enforce max memory logs
                if (this.logs.length > this.config.maxMemoryLogs) {
                    this.logs.shift(); // Remove oldest
                }
                break;
            case 'file':
                // In production, would write to file
                // For now, just add to memory
                this.logs.push(entry);
                break;
            case 'database':
                // In production, would write to database
                // For now, just add to memory
                this.logs.push(entry);
                break;
        }
    }
    /**
     * Flush logs to persistent storage
     */
    async flushLogs() {
        // In production, would write to file/database
        // For now, just clear old logs
        if (this.logs.length > this.config.maxMemoryLogs) {
            this.logs = this.logs.slice(-this.config.maxMemoryLogs);
        }
    }
    /**
     * Clean up old logs based on retention
     */
    cleanupOldLogs() {
        const cutoffTime = Date.now() - (this.config.retention * 24 * 60 * 60 * 1000);
        this.logs = this.logs.filter(log => log.timestamp >= cutoffTime);
    }
    /**
     * Generate unique ID
     */
    generateId() {
        return createHash('sha256')
            .update(`${Date.now()}-${Math.random()}`)
            .digest('hex')
            .substring(0, 16);
    }
    /**
     * Query audit logs
     */
    queryLogs(filter) {
        let results = [...this.logs];
        if (filter) {
            if (filter.operation) {
                results = results.filter(log => log.operation === filter.operation);
            }
            if (filter.startTime) {
                results = results.filter(log => log.timestamp >= filter.startTime);
            }
            if (filter.endTime) {
                results = results.filter(log => log.timestamp <= filter.endTime);
            }
            if (filter.sessionId) {
                results = results.filter(log => log.sessionId === filter.sessionId);
            }
            if (filter.hasError !== undefined) {
                results = results.filter(log => (log.error !== undefined) === filter.hasError);
            }
        }
        return results;
    }
    /**
     * Get audit statistics
     */
    getStats() {
        const stats = {
            totalLogs: this.logs.length,
            operations: {},
            averageDuration: 0,
            errorRate: 0
        };
        let totalDuration = 0;
        let errorCount = 0;
        for (const log of this.logs) {
            // Count by operation
            stats.operations[log.operation] = (stats.operations[log.operation] || 0) + 1;
            // Sum duration
            totalDuration += log.duration;
            // Count errors
            if (log.error)
                errorCount++;
        }
        if (this.logs.length > 0) {
            stats.averageDuration = totalDuration / this.logs.length;
            stats.errorRate = errorCount / this.logs.length;
        }
        return stats;
    }
    /**
     * Export logs for analysis
     */
    exportLogs() {
        return [...this.logs];
    }
    /**
     * Clear all logs
     */
    clearLogs() {
        this.logs = [];
    }
}
/**
 * Create audit log augmentation
 */
export function createAuditLogAugmentation(config) {
    return new AuditLogAugmentation(config);
}
//# sourceMappingURL=auditLogAugmentation.js.map