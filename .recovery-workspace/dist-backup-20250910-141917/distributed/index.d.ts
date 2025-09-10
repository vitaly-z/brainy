/**
 * Distributed module exports
 */
export { DistributedConfigManager } from './configManager.js';
export { HashPartitioner, AffinityPartitioner } from './hashPartitioner.js';
export { BaseOperationalMode, ReaderMode, WriterMode, HybridMode, OperationalModeFactory } from './operationalModes.js';
export { DomainDetector } from './domainDetector.js';
export { HealthMonitor } from './healthMonitor.js';
export { DistributedCoordinator, createCoordinator } from './coordinator.js';
export { ShardManager, createShardManager } from './shardManager.js';
export { CacheSync, createCacheSync } from './cacheSync.js';
export { ReadWriteSeparation, createReadWriteSeparation } from './readWriteSeparation.js';
export type { HealthMetrics, HealthStatus } from './healthMonitor.js';
export type { DomainPattern } from './domainDetector.js';
export type { NodeInfo, CoordinatorConfig, ConsensusState } from './coordinator.js';
export type { ShardConfig, Shard, ShardAssignment } from './shardManager.js';
export type { CacheSyncConfig, CacheEntry, SyncMessage } from './cacheSync.js';
export type { ReplicationConfig, WriteOperation, ReplicationLog } from './readWriteSeparation.js';
