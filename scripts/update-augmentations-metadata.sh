#!/bin/bash

# Script to update all augmentations with metadata declarations

echo "📝 Updating augmentations with metadata declarations..."

# Category 1: No metadata access ('none')
echo "🚫 Updating 'none' metadata augmentations..."

# RequestDeduplicatorAugmentation
sed -i "/export class RequestDeduplicatorAugmentation extends BaseAugmentation {/a\\
  readonly metadata = 'none' as const  // Doesn't access metadata" \
  src/augmentations/requestDeduplicatorAugmentation.ts

# ConnectionPoolAugmentation  
sed -i "/export class ConnectionPoolAugmentation extends BaseAugmentation {/a\\
  readonly metadata = 'none' as const  // Doesn't access metadata" \
  src/augmentations/connectionPoolAugmentation.ts

# StorageAugmentation (abstract class)
sed -i "/export abstract class StorageAugmentation extends BaseAugmentation/a\\
  readonly metadata = 'none' as const  // Storage doesn't directly access metadata" \
  src/augmentations/storageAugmentation.ts

# Category 2: Read-only access ('readonly')
echo "👁 Updating 'readonly' metadata augmentations..."

# WALAugmentation
sed -i "/export class WALAugmentation extends BaseAugmentation {/a\\
  readonly metadata = 'readonly' as const  // Reads metadata for logging" \
  src/augmentations/walAugmentation.ts

# IndexAugmentation
sed -i "/export class IndexAugmentation extends BaseAugmentation {/a\\
  readonly metadata = 'readonly' as const  // Reads metadata to build indexes" \
  src/augmentations/indexAugmentation.ts

# MonitoringAugmentation
sed -i "/export class MonitoringAugmentation extends BaseAugmentation {/a\\
  readonly metadata = 'readonly' as const  // Reads metadata for monitoring" \
  src/augmentations/monitoringAugmentation.ts

# MetricsAugmentation
sed -i "/export class MetricsAugmentation extends BaseAugmentation {/a\\
  readonly metadata = 'readonly' as const  // Reads metadata for metrics" \
  src/augmentations/metricsAugmentation.ts

# BatchProcessingAugmentation
sed -i "/export class BatchProcessingAugmentation extends BaseAugmentation {/a\\
  readonly metadata = 'readonly' as const  // Reads metadata for batching decisions" \
  src/augmentations/batchProcessingAugmentation.ts

# EntityRegistryAugmentation
sed -i "/export class EntityRegistryAugmentation extends BaseAugmentation {/a\\
  readonly metadata = 'readonly' as const  // Reads metadata to register entities" \
  src/augmentations/entityRegistryAugmentation.ts

# AutoRegisterEntitiesAugmentation
sed -i "/export class AutoRegisterEntitiesAugmentation extends BaseAugmentation {/a\\
  readonly metadata = 'readonly' as const  // Reads metadata for auto-registration" \
  src/augmentations/entityRegistryAugmentation.ts

echo "✅ Done updating augmentations!"