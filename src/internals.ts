/**
 * Internal utilities for first-party plugins.
 * NOT part of the public API — may change between minor versions.
 */
export { getGlobalCache, setGlobalCache, clearGlobalCache, UnifiedCache } from './utils/unifiedCache.js'
export type { UnifiedCacheConfig, CacheItem } from './utils/unifiedCache.js'
export { prodLog, createModuleLogger } from './utils/logger.js'
export { FieldTypeInference, FieldType } from './utils/fieldTypeInference.js'
export type { FieldTypeInfo } from './utils/fieldTypeInference.js'
export {
  EntityIdMapper,
  EntityIdSpaceExceeded,
  U32_ENTITY_ID_MAX,
} from './utils/entityIdMapper.js'
export type { EntityIdMapperOptions, EntityIdMapperData } from './utils/entityIdMapper.js'
export { getRecommendedCacheConfig, formatBytes, checkMemoryPressure } from './utils/memoryDetection.js'
export type { MemoryInfo, CacheAllocationStrategy } from './utils/memoryDetection.js'
// Entity field resolution — single source of truth for reading fields off
// HNSWNounWithMetadata. First-party plugins (Cortex) use this to stay in
// lockstep with the entity shape contract.
export { resolveEntityField, STANDARD_ENTITY_FIELDS } from './coreTypes.js'
