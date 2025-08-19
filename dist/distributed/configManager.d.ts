/**
 * Distributed Configuration Manager
 * Manages shared configuration in S3 for distributed Brainy instances
 */
import { DistributedConfig, SharedConfig, InstanceInfo, InstanceRole } from '../types/distributedTypes.js';
import { StorageAdapter } from '../coreTypes.js';
export declare class DistributedConfigManager {
    private config;
    private instanceId;
    private role;
    private configPath;
    private heartbeatInterval;
    private configCheckInterval;
    private instanceTimeout;
    private storage;
    private heartbeatTimer?;
    private configWatchTimer?;
    private lastConfigVersion;
    private onConfigUpdate?;
    private hasMigrated;
    constructor(storage: StorageAdapter, distributedConfig?: DistributedConfig, brainyMode?: {
        readOnly?: boolean;
        writeOnly?: boolean;
    });
    /**
     * Initialize the distributed configuration
     */
    initialize(): Promise<SharedConfig>;
    /**
     * Load existing config or create new one
     */
    private loadOrCreateConfig;
    /**
     * Determine role based on configuration
     * IMPORTANT: Role must be explicitly set - no automatic assignment based on order
     */
    private determineRole;
    /**
     * Check if an instance is still alive
     */
    private isInstanceAlive;
    /**
     * Register this instance in the shared config
     */
    private registerInstance;
    /**
     * Migrate config from legacy location to new location
     */
    private migrateConfigFromLegacyLocation;
    /**
     * Migrate config to new location in index folder
     */
    private migrateConfig;
    /**
     * Save configuration with version increment
     */
    private saveConfig;
    /**
     * Start heartbeat to keep instance alive in config
     */
    private startHeartbeat;
    /**
     * Update heartbeat and clean stale instances
     */
    private updateHeartbeat;
    /**
     * Start watching for config changes
     */
    private startConfigWatch;
    /**
     * Check for configuration updates
     */
    private checkForConfigUpdates;
    /**
     * Load configuration from storage
     */
    private loadConfig;
    /**
     * Get current configuration
     */
    getConfig(): SharedConfig | null;
    /**
     * Get instance role
     */
    getRole(): InstanceRole;
    /**
     * Get instance ID
     */
    getInstanceId(): string;
    /**
     * Set config update callback
     */
    setOnConfigUpdate(callback: (config: SharedConfig) => void): void;
    /**
     * Get all active instances of a specific role
     */
    getInstancesByRole(role: InstanceRole): InstanceInfo[];
    /**
     * Update instance metrics
     */
    updateMetrics(metrics: Partial<InstanceInfo['metrics']>): Promise<void>;
    /**
     * Cleanup resources
     */
    cleanup(): Promise<void>;
}
