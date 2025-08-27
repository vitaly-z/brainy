# Brainy 2.2 Implementation Plan: Metadata Architecture & Performance

## Goal
Implement namespaced metadata with O(1) soft delete filtering while maintaining backward compatibility and adding augmentation safety.

## Current Issues to Fix
1. ❌ `deleted: { notEquals: true }` is O(n) - kills performance
2. ❌ Namespace collisions between user and internal metadata
3. ❌ No safety for augmentation metadata modifications
4. ❌ Progressive search bug when field filter returns 0 results
5. ❌ Inconsistent metadata handling across CRUD operations

## Architecture Decisions

### 1. Metadata Structure
```javascript
{
  // User data - untouched
  name: "Django",
  type: "framework",
  
  // Internal namespace - indexed for O(1)
  _brainy: {
    deleted: false,      // ALWAYS set, enables O(1) lookup
    version: 1,          // Schema version
    created: Date.now(), // Creation timestamp
    updated: Date.now(), // Last update
    indexed: true        // Whether in search index
  },
  
  // Augmentation data - isolated
  _augmentations: {
    [augName]: { ... }
  },
  
  // Audit trail - optional
  _audit: []
}
```

### 2. Performance Strategy

#### Soft Delete: O(1) Hash Lookup
```javascript
// Before: O(n) disaster
where: { deleted: { notEquals: true } }  // Scans ALL items!

// After: O(1) perfection
where: { '_brainy.deleted': false }      // Direct hash lookup!
```

#### Index Structure
```
MetadataIndex:
  "_brainy.deleted" -> {
    "false": Set<id1, id2, id3...>,  // O(1) lookup
    "true": Set<id4, id5...>         // Small set
  }
```

## Implementation Steps

### Phase 1: Core Infrastructure (CRITICAL)

#### 1.1 Update Metadata Utilities
```typescript
// src/utils/metadataNamespace.ts
export const BRAINY_NS = '_brainy'
export const AUG_NS = '_augmentations'
export const AUDIT_NS = '_audit'

export interface BrainyMetadata {
  deleted: boolean
  version: number
  created: number
  updated: number
  indexed: boolean
}

export function ensureBrainyMetadata(metadata: any): any {
  if (!metadata) metadata = {}
  
  if (!metadata[BRAINY_NS]) {
    metadata[BRAINY_NS] = {
      deleted: false,    // ALWAYS set
      version: 1,
      created: Date.now(),
      updated: Date.now(),
      indexed: true
    }
  } else {
    // Ensure deleted is always boolean
    if (metadata[BRAINY_NS].deleted === undefined) {
      metadata[BRAINY_NS].deleted = false
    }
  }
  
  return metadata
}
```

#### 1.2 Fix MetadataIndex for Nested Fields
```typescript
// Already supports dot notation!
// Just ensure we index '_brainy.deleted' as a key
```

### Phase 2: CRUD Operations Update

#### 2.1 AddNoun - Set metadata correctly
```typescript
async addNoun(data: any, metadata?: any): Promise<string> {
  // Ensure namespaced metadata
  metadata = ensureBrainyMetadata(metadata)
  
  // ... existing logic ...
  
  // Save with guaranteed structure
  await this.storage.saveMetadata(id, metadata)
  
  // Index the nested field
  await this.metadataIndex.addToIndex(id, metadata)
}
```

#### 2.2 UpdateNoun - Preserve namespaces
```typescript
async updateNoun(id: string, data?: any, metadata?: any): Promise<any> {
  const existing = await this.getNoun(id)
  
  // Merge carefully, preserving namespaces
  const merged = {
    ...existing.metadata,
    ...metadata,
    [BRAINY_NS]: {
      ...existing.metadata?.[BRAINY_NS],
      ...metadata?.[BRAINY_NS],
      updated: Date.now()
    }
  }
  
  // Ensure deleted field exists
  merged[BRAINY_NS].deleted = merged[BRAINY_NS].deleted ?? false
  
  await this.storage.saveMetadata(id, merged)
}
```

#### 2.3 Soft Delete Operations
```typescript
async softDelete(id: string): Promise<boolean> {
  const noun = await this.getNoun(id)
  if (!noun) return false
  
  // Just flip the boolean - O(1) operation!
  noun.metadata[BRAINY_NS].deleted = true
  await this.storage.saveMetadata(id, noun.metadata)
  
  // Update index - also O(1)
  await this.metadataIndex.updateIndex(id, 
    '_brainy.deleted', false, true)
  
  return true
}

async restore(id: string): Promise<boolean> {
  const noun = await this.getNoun(id)
  if (!noun) return false
  
  noun.metadata[BRAINY_NS].deleted = false
  await this.storage.saveMetadata(id, noun.metadata)
  
  await this.metadataIndex.updateIndex(id, 
    '_brainy.deleted', true, false)
  
  return true
}
```

### Phase 3: Search & Query Updates

#### 3.1 Find Method - Use correct field
```typescript
async find(query: TripleQuery, options: FindOptions): Promise<any[]> {
  const { excludeDeleted = true } = options
  
  if (excludeDeleted) {
    if (!query.where) query.where = {}
    // Use indexed nested field for O(1) lookup
    query.where['_brainy.deleted'] = false
  }
  
  return this._tripleEngine.find(query)
}
```

#### 3.2 Progressive Search Fix (Already Done ✅)
```typescript
// Fixed: Don't do fresh search when previous step returns 0
case 'vector':
  if (candidates.length === 0 && plan.steps[0].type !== 'vector') {
    // Keep empty candidates, don't search
    break
  }
```

### Phase 4: Augmentation Safety Integration

#### 4.1 Augmentation Pipeline Update
```typescript
class AugmentationPipeline {
  private enforcer = new MetadataSafetyEnforcer()
  
  async execute(operation: string, params: any, fn: Function) {
    // Get augmentation contract
    const contract = this.getContract(operation)
    
    if (contract && params.metadata) {
      // Wrap metadata in safety proxy
      params.metadata = this.enforcer.createSafeProxy(
        params.metadata, 
        contract.name
      )
    }
    
    const result = await fn()
    
    // Audit trail
    if (params.metadata?._audit) {
      await this.saveAuditLog(params.metadata._audit)
    }
    
    return result
  }
}
```

### Phase 5: Migration & Compatibility

#### 5.1 Lazy Migration
```typescript
async getNoun(id: string): Promise<any> {
  const noun = await this.storage.getNoun(id)
  
  // Migrate on read if needed
  if (noun && !noun.metadata?.[BRAINY_NS]) {
    noun.metadata = ensureBrainyMetadata(noun.metadata)
    await this.storage.saveMetadata(id, noun.metadata)
  }
  
  return noun
}
```

#### 5.2 Batch Migration Utility
```typescript
async migrateToBrainyNamespace(): Promise<void> {
  const batch = 1000
  let offset = 0
  
  while (true) {
    const nouns = await this.storage.getNouns({ 
      limit: batch, 
      offset 
    })
    
    if (nouns.length === 0) break
    
    for (const noun of nouns) {
      if (!noun.metadata?.[BRAINY_NS]) {
        noun.metadata = ensureBrainyMetadata(noun.metadata)
        await this.storage.saveMetadata(noun.id, noun.metadata)
      }
    }
    
    offset += batch
  }
}
```

## Performance Guarantees

| Operation | Before | After | Method |
|-----------|--------|-------|--------|
| Soft delete filter | O(n) ❌ | O(1) ✅ | Hash index on `_brainy.deleted` |
| Metadata exact match | O(1) ✅ | O(1) ✅ | Hash index |
| Range query | O(log n) ✅ | O(log n) ✅ | Sorted index |
| Nested field query | O(1) ✅ | O(1) ✅ | Dot notation indexing |
| Vector search | O(log n) ✅ | O(log n) ✅ | HNSW |

## Testing Strategy

### Unit Tests
- [ ] Namespace preservation in CRUD
- [ ] Soft delete O(1) performance
- [ ] Augmentation safety enforcement
- [ ] Migration utilities

### Integration Tests
- [ ] Combined vector + metadata queries
- [ ] Multiple augmentation conflicts
- [ ] Backward compatibility

### Performance Tests
- [ ] 1M items soft delete filter < 10ms
- [ ] Nested field queries < 5ms
- [ ] No performance regression

## Rollout Plan

1. **v2.2.0-beta**: Core namespace implementation
2. **v2.2.0-rc**: Augmentation safety system
3. **v2.2.0**: Full release with migration tools

## Risk Mitigation

1. **Backward Compatibility**: Support both old and new formats
2. **Data Loss**: Comprehensive testing before release
3. **Performance Regression**: Benchmark every change
4. **Migration Issues**: Provide rollback mechanism