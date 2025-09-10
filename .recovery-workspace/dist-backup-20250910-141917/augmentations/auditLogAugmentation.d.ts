/**
 * Audit Logging Augmentation
 * Provides comprehensive audit trail for all Brainy operations
 */
import { BaseAugmentation } from './brainyAugmentation.js';
import { AugmentationManifest } from './manifest.js';
export interface AuditLogConfig {
    enabled?: boolean;
    logLevel?: 'minimal' | 'standard' | 'detailed';
    includeData?: boolean;
    includeMetadata?: boolean;
    retention?: number;
    storage?: 'memory' | 'file' | 'database';
    filePath?: string;
    maxMemoryLogs?: number;
}
export interface AuditLogEntry {
    id: string;
    timestamp: number;
    operation: string;
    params: any;
    result?: any;
    error?: any;
    duration: number;
    userId?: string;
    sessionId?: string;
    metadata?: Record<string, any>;
}
/**
 * Audit Log Augmentation
 */
export declare class AuditLogAugmentation extends BaseAugmentation {
    readonly name = "auditLogger";
    readonly timing: "around";
    readonly metadata: "readonly";
    operations: any;
    readonly priority = 90;
    readonly category: "core";
    readonly description = "Comprehensive audit logging for compliance and debugging";
    private logs;
    private sessionId;
    constructor(config?: AuditLogConfig);
    getManifest(): AugmentationManifest;
    protected onInitialize(): Promise<void>;
    protected onShutdown(): Promise<void>;
    /**
     * Execute augmentation - log operations
     */
    execute<T = any>(operation: string, params: any, next: () => Promise<T>): Promise<T>;
    /**
     * Sanitize parameters to remove sensitive data
     */
    private sanitizeParams;
    /**
     * Sanitize result data
     */
    private sanitizeResult;
    /**
     * Sanitize error information
     */
    private sanitizeError;
    /**
     * Write log entry
     */
    private writeLog;
    /**
     * Flush logs to persistent storage
     */
    private flushLogs;
    /**
     * Clean up old logs based on retention
     */
    private cleanupOldLogs;
    /**
     * Generate unique ID
     */
    private generateId;
    /**
     * Query audit logs
     */
    queryLogs(filter?: {
        operation?: string;
        startTime?: number;
        endTime?: number;
        sessionId?: string;
        hasError?: boolean;
    }): AuditLogEntry[];
    /**
     * Get audit statistics
     */
    getStats(): {
        totalLogs: number;
        operations: Record<string, number>;
        averageDuration: number;
        errorRate: number;
    };
    /**
     * Export logs for analysis
     */
    exportLogs(): AuditLogEntry[];
    /**
     * Clear all logs
     */
    clearLogs(): void;
}
/**
 * Create audit log augmentation
 */
export declare function createAuditLogAugmentation(config?: AuditLogConfig): AuditLogAugmentation;
