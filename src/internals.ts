/**
 * Internal utilities for first-party plugins.
 * NOT part of the public API — may change between minor versions.
 */
export { getGlobalCache, setGlobalCache, clearGlobalCache, UnifiedCache } from './utils/unifiedCache.js'
export type { UnifiedCacheConfig, CacheItem } from './utils/unifiedCache.js'
export { prodLog, createModuleLogger } from './utils/logger.js'
export { FieldTypeInference, FieldType } from './utils/fieldTypeInference.js'
export type { FieldTypeInfo } from './utils/fieldTypeInference.js'
export { EntityIdMapper } from './utils/entityIdMapper.js'
export type { EntityIdMapperOptions, EntityIdMapperData } from './utils/entityIdMapper.js'
export { getRecommendedCacheConfig, formatBytes, checkMemoryPressure } from './utils/memoryDetection.js'
export type { MemoryInfo, CacheAllocationStrategy } from './utils/memoryDetection.js'
