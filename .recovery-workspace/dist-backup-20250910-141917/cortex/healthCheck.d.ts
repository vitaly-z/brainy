/**
 * Health Check System - Atomic Age Diagnostic Engine
 *
 * 🧠 Comprehensive health diagnostics for vector + graph operations
 * ⚛️ Auto-repair capabilities with 1950s retro sci-fi aesthetics
 * 🚀 Scalable health monitoring for high-performance databases
 */
import { Brainy } from '../brainy.js';
export interface HealthCheckResult {
    component: string;
    status: 'healthy' | 'warning' | 'critical' | 'offline';
    score: number;
    message: string;
    details?: string[];
    autoFixAvailable?: boolean;
    lastChecked: string;
    responseTime?: number;
}
export interface SystemHealth {
    overall: HealthCheckResult;
    vector: HealthCheckResult;
    graph: HealthCheckResult;
    storage: HealthCheckResult;
    memory: HealthCheckResult;
    network: HealthCheckResult;
    embedding: HealthCheckResult;
    cache: HealthCheckResult;
    timestamp: string;
    recommendations: string[];
}
export interface RepairAction {
    id: string;
    name: string;
    description: string;
    severity: 'low' | 'medium' | 'high';
    automated: boolean;
    estimatedTime: string;
    riskLevel: 'safe' | 'moderate' | 'high';
}
/**
 * Comprehensive Health Check and Auto-Repair System
 */
export declare class HealthCheck {
    private brainy;
    private colors;
    private emojis;
    constructor(brainy: Brainy);
    /**
     * Run comprehensive system health check
     */
    runHealthCheck(): Promise<SystemHealth>;
    /**
     * Display health check results in terminal
     */
    displayHealthReport(health?: SystemHealth): Promise<void>;
    /**
     * Get available repair actions
     */
    getRepairActions(): Promise<RepairAction[]>;
    /**
     * Execute automated repairs
     */
    executeAutoRepairs(): Promise<{
        success: string[];
        failed: string[];
    }>;
    /**
     * Individual health check methods
     */
    private checkVectorOperations;
    private checkGraphOperations;
    private checkStorageHealth;
    private checkMemoryHealth;
    private checkNetworkHealth;
    private checkEmbeddingHealth;
    private checkCacheHealth;
    /**
     * Helper methods
     */
    private getOverallMessage;
    private generateRecommendations;
    private getHealthIcon;
    private getStatusColor;
    private executeRepairAction;
}
