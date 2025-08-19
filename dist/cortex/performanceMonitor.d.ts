/**
 * Performance Monitor - Atomic Age Intelligence Observatory
 *
 * 🧠 Real-time performance tracking for vector + graph operations
 * ⚛️ Monitors query performance, storage usage, and system health
 * 🚀 Scalable performance analytics with atomic age aesthetics
 */
import { BrainyData } from '../brainyData.js';
export interface PerformanceMetrics {
    queryLatency: {
        vector: {
            avg: number;
            p50: number;
            p95: number;
            p99: number;
        };
        graph: {
            avg: number;
            p50: number;
            p95: number;
            p99: number;
        };
        combined: {
            avg: number;
            p50: number;
            p95: number;
            p99: number;
        };
    };
    throughput: {
        vectorOps: number;
        graphOps: number;
        totalOps: number;
    };
    storage: {
        readLatency: number;
        writeLatency: number;
        cacheHitRate: number;
        totalSize: number;
        growthRate: number;
    };
    memory: {
        heapUsed: number;
        heapTotal: number;
        vectorCache: number;
        graphCache: number;
        efficiency: number;
    };
    errors: {
        total: number;
        rate: number;
        types: {
            [key: string]: number;
        };
    };
    health: {
        overall: number;
        vector: number;
        graph: number;
        storage: number;
        network: number;
    };
    timestamp: string;
    uptime: number;
}
export interface AlertRule {
    id: string;
    name: string;
    condition: string;
    threshold: number;
    severity: 'low' | 'medium' | 'high' | 'critical';
    action?: string;
    enabled: boolean;
}
export interface PerformanceAlert {
    id: string;
    rule: AlertRule;
    triggered: string;
    value: number;
    message: string;
    resolved?: string;
}
/**
 * Real-time Performance Monitoring System
 */
export declare class PerformanceMonitor {
    private brainy;
    private metrics;
    private alerts;
    private alertRules;
    private isMonitoring;
    private monitoringInterval?;
    private colors;
    private emojis;
    constructor(brainy: BrainyData);
    /**
     * Start real-time monitoring
     */
    startMonitoring(intervalMs?: number): Promise<void>;
    /**
     * Stop monitoring
     */
    stopMonitoring(): void;
    /**
     * Get current performance metrics
     */
    getCurrentMetrics(): Promise<PerformanceMetrics>;
    /**
     * Get performance dashboard data
     */
    getDashboard(): Promise<{
        current: PerformanceMetrics;
        trends: PerformanceMetrics[];
        alerts: PerformanceAlert[];
        health: string;
    }>;
    /**
     * Display performance dashboard in terminal
     */
    displayDashboard(): Promise<void>;
    /**
     * Collect current performance metrics
     */
    private collectMetrics;
    /**
     * Initialize default alert rules
     */
    private initializeDefaultAlerts;
    /**
     * Check alerts against current metrics
     */
    private checkAlerts;
    /**
     * Evaluate alert condition against metrics
     */
    private evaluateCondition;
    /**
     * Get metric value by dot notation path
     */
    private getMetricValue;
    /**
     * Helper methods
     */
    private getHealthStatus;
    private getHealthIcon;
    private getHealthBar;
    private getSeverityIcon;
    private formatUptime;
    private formatBytes;
}
