# Metadata Contract Implementation Plan

## New Required Interface

```typescript
export interface BrainyAugmentation {
  // Identity
  name: string
  timing: 'before' | 'after' | 'around' | 'replace'
  operations: string[]
  priority: number
  
  // REQUIRED metadata contract
  metadata: 'none' | 'readonly' | MetadataAccess
  
  // Methods
  initialize(context: AugmentationContext): Promise<void>
  execute<T = any>(operation: string, params: any, next: () => Promise<T>): Promise<T>
  shouldExecute?(operation: string, params: any): boolean
  shutdown?(): Promise<void>
}

interface MetadataAccess {
  reads?: string[] | '*'      // Fields to read, or '*' for all
  writes?: string[] | '*'     // Fields to write, or '*' for all
  namespace?: string           // Optional: custom namespace like '_myAug'
}
```

## Augmentation Analysis & Classification

### Category 1: No Metadata Access ('none')
These augmentations don't read or write metadata at all:

1. **CacheAugmentation** - Only caches search results
2. **RequestDeduplicatorAugmentation** - Only deduplicates requests
3. **ConnectionPoolAugmentation** - Only manages storage connections
4. **StorageAugmentation** - Base storage layer, metadata handled by brainyData

### Category 2: Read-Only Access ('readonly')
These augmentations read metadata but never modify it:

5. **WALAugmentation** - Reads metadata for logging/recovery
6. **IndexAugmentation** - Reads metadata to build indexes
7. **MonitoringAugmentation** - Reads metadata for monitoring
8. **MetricsAugmentation** - Reads metadata for metrics collection
9. **BatchProcessingAugmentation** - Reads metadata to check for external IDs
10. **EntityRegistryAugmentation** - Reads metadata to register entities
11. **AutoRegisterEntitiesAugmentation** - Reads metadata for auto-registration
12. **ConduitAugmentation** - Reads metadata to pass through operations

### Category 3: Metadata Writers (needs specific access)
These augmentations modify metadata and need specific field declarations:

13. **SynapseAugmentation** - Writes to '_synapse' field
    ```typescript
    metadata: {
      reads: '*',
      writes: ['_synapse', '_synapseTimestamp'],
      namespace: '_synapse'  // Uses its own namespace
    }
    ```

14. **IntelligentVerbScoringAugmentation** - Adds scoring to verbs
    ```typescript
    metadata: {
      reads: ['type', 'verb', 'source', 'target'],
      writes: ['weight', 'confidence', 'intelligentScoring']
    }
    ```

15. **ServerSearchAugmentation** - Might add server metadata
    ```typescript
    metadata: {
      reads: '*',
      writes: ['_server', '_syncedAt']
    }
    ```

16. **NeuralImportAugmentation** - Enriches imported data
    ```typescript
    metadata: {
      reads: '*',
      writes: ['nounType', 'verbType', '_importedAt', '_enriched']
    }
    ```

### Category 4: API/Server (needs analysis)
17. **ApiServerAugmentation** - Likely read-only for serving data
18. **StorageAugmentations** (plural) - Collection of storage implementations
19. **ConduitAugmentations** (plural) - Collection of conduit types

## Implementation Steps

### Phase 1: Update Base Interface
1. Update `BrainyAugmentation` interface to require `metadata` field
2. Update `BaseAugmentation` class to have abstract `metadata` property
3. Add runtime enforcement in augmentation executor

### Phase 2: Update Each Augmentation
For each augmentation, add the appropriate metadata declaration:

#### Example Updates:

**CacheAugmentation:**
```typescript
export class CacheAugmentation extends BaseAugmentation {
  readonly name = 'cache'
  readonly metadata = 'none' as const  // ✅ No metadata access
  // ... rest unchanged
}
```

**WALAugmentation:**
```typescript
export class WALAugmentation extends BaseAugmentation {
  readonly name = 'WAL'
  readonly metadata = 'readonly' as const  // ✅ Only reads for logging
  // ... rest unchanged
}
```

**SynapseAugmentation:**
```typescript
export abstract class SynapseAugmentation extends BaseAugmentation {
  readonly name = 'synapse'
  readonly metadata = {
    reads: '*',
    writes: ['_synapse', '_synapseTimestamp'],
    namespace: '_synapse'
  } as const
  // ... rest unchanged
}
```

### Phase 3: Runtime Enforcement
Add a metadata access enforcer that:
1. Wraps metadata objects based on declared access
2. Throws errors if augmentation violates its contract
3. Logs warnings in development mode

```typescript
class MetadataEnforcer {
  enforce(augmentation: BrainyAugmentation, metadata: any): any {
    if (augmentation.metadata === 'none') {
      return null  // No access at all
    }
    
    if (augmentation.metadata === 'readonly') {
      return Object.freeze(deepClone(metadata))  // Read-only copy
    }
    
    // For specific access, create proxy that validates
    return new Proxy(metadata, {
      set(target, prop, value) {
        const access = augmentation.metadata as MetadataAccess
        if (!access.writes?.includes(String(prop)) && access.writes !== '*') {
          throw new Error(`Augmentation '${augmentation.name}' cannot write to field '${String(prop)}'`)
        }
        target[prop] = value
        return true
      }
    })
  }
}
```

## Benefits
1. **Type Safety** - TypeScript enforces metadata declaration
2. **Runtime Safety** - Violations caught immediately
3. **Documentation** - Contract shows exactly what each augmentation does
4. **Brain-cloud Ready** - Registry can validate augmentations
5. **Developer Friendly** - Most use simple 'none' or 'readonly'

## Migration Checklist
- [ ] Update BrainyAugmentation interface
- [ ] Update BaseAugmentation class
- [ ] Add MetadataEnforcer
- [ ] Update all 19 augmentations with metadata declarations
- [ ] Add tests for metadata enforcement
- [ ] Update documentation