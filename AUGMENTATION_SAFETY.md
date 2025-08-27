# Augmentation Metadata Safety System

## The Problem
Augmentations can accidentally corrupt user metadata by:
- **Overwriting existing fields** without realizing it
- **Colliding with other augmentations** modifying the same field
- **Breaking data types** by changing field formats
- **Modifying internal fields** they shouldn't touch

## The Solution: Metadata Contracts

Each augmentation declares its intentions upfront through a contract:

```typescript
const contract: AugmentationMetadataContract = {
  name: 'categoryEnricher',
  version: '1.0.0',
  
  // What I need to read
  reads: {
    userFields: ['title', 'description']
  },
  
  // What I intend to write
  writes: {
    userFields: [
      {
        field: 'category',
        type: 'create',
        description: 'Auto-detected category',
        example: 'technology'
      }
    ]
  }
}
```

## Safety Levels

### 1. 🟢 Safe Zones (Always Allowed)
- **Own augmentation namespace**: `_augmentations.myAug.*`
- **Declared user fields**: Fields explicitly listed in contract
- **Create operations**: Adding new fields that don't exist

### 2. 🟡 Caution Zones (Allowed with Warnings)
- **Shared fields**: Multiple augmentations modifying same field
- **Update operations**: Modifying existing user fields
- **Merge operations**: Adding to existing objects/arrays

### 3. 🔴 Danger Zones (Blocked by Default)
- **Undeclared fields**: Not in the contract
- **Other augmentation namespaces**: `_augmentations.otherAug.*`
- **Internal fields**: `_brainy.*` without permission

## Conflict Resolution

When multiple augmentations want the same field:

### Strategy 1: Priority-Based
```typescript
translator: {
  conflictResolution: {
    strategy: 'override',
    priority: 10  // Higher wins
  }
}

basicEnricher: {
  conflictResolution: {
    strategy: 'override',
    priority: 5   // Lower priority
  }
}
// Result: translator wins
```

### Strategy 2: Merge
```typescript
augmentation1: { 
  writes: { tags: ['tech', 'web'] }
}

augmentation2: {
  writes: { tags: ['framework'] }
}
// Result: tags = ['tech', 'web', 'framework']
```

### Strategy 3: Error on Conflict
```typescript
conflictResolution: {
  strategy: 'error'  // Fail fast
}
```

## Real-World Examples

### ✅ Good: Category Enricher
```typescript
class CategoryEnricher {
  contract = {
    writes: {
      userFields: [{
        field: 'category',
        type: 'create',
        description: 'Auto-categorization'
      }]
    }
  }
  
  execute(metadata) {
    metadata.category = 'technology'  // ✅ Allowed
    metadata.random = 'value'         // ❌ Throws error
  }
}
```

### ✅ Good: Translation Service
```typescript
class Translator {
  contract = {
    writes: {
      userFields: [{
        field: 'translations',
        type: 'merge'
      }]
    }
  }
  
  execute(metadata) {
    metadata.translations = {         // ✅ Allowed
      es: 'Hola',
      fr: 'Bonjour'
    }
  }
}
```

### ❌ Bad: Accidental Overwrite
```typescript
class BadAugmentation {
  execute(metadata) {
    // No contract!
    metadata.title = 'Modified'  // ❌ Could destroy user data
    metadata.deleted = true      // ❌ Could conflict with internal
  }
}
```

## Audit Trail

Every modification is tracked:

```typescript
metadata._audit = [
  {
    augmentation: 'categoryEnricher',
    field: 'category',
    oldValue: undefined,
    newValue: 'technology',
    timestamp: 1704067200000
  },
  {
    augmentation: 'translator',
    field: 'translations.es',
    oldValue: undefined,
    newValue: 'Tecnología',
    timestamp: 1704067201000
  }
]
```

## Implementation Guide

### Step 1: Define Your Contract
```typescript
export const myContract: AugmentationMetadataContract = {
  name: 'myAugmentation',
  version: '1.0.0',
  reads: {
    userFields: ['title']
  },
  writes: {
    userFields: [{
      field: 'enrichedTitle',
      type: 'create',
      description: 'Enhanced title'
    }]
  }
}
```

### Step 2: Extend SafeAugmentation
```typescript
class MyAugmentation extends SafeAugmentation {
  constructor() {
    super(myContract)
  }
  
  async execute(metadata: any) {
    const safe = this.getSafeMetadata(metadata)
    
    // Read safely
    const title = safe.title
    
    // Write safely (enforced by proxy)
    safe.enrichedTitle = title.toUpperCase()
    
    return safe
  }
}
```

### Step 3: Register with Brainy
```typescript
brain.registerAugmentation(new MyAugmentation())
```

## Benefits

1. **Prevents Accidents**: Can't overwrite fields by mistake
2. **Clear Intentions**: Contract documents what augmentation does
3. **Conflict Detection**: Know when augmentations clash
4. **Audit Trail**: Track all modifications
5. **Type Safety**: Optional type validation
6. **Reversibility**: Can undo changes if needed

## Guidelines for Developers

### DO ✅
- Declare ALL fields you intend to modify
- Use your augmentation namespace for internal data
- Provide examples in your contract
- Handle conflicts gracefully
- Make operations idempotent when possible

### DON'T ❌
- Modify undeclared fields
- Touch other augmentation namespaces
- Change internal `_brainy.*` fields without permission
- Assume exclusive access to fields
- Delete user data without explicit permission

## Permission Levels

### Level 1: User Metadata
- Default access for declared fields
- Must declare intent in contract

### Level 2: Augmentation Namespace
- Full access to own namespace
- No access to other augmentation namespaces

### Level 3: Internal Fields
- Requires explicit permission grant
- Must provide reason in contract
- Only for system augmentations

## Testing Your Augmentation

```typescript
describe('MyAugmentation', () => {
  it('should only modify declared fields', () => {
    const metadata = { title: 'Test' }
    const aug = new MyAugmentation()
    
    const result = aug.execute(metadata)
    
    expect(result.enrichedTitle).toBe('TEST')  // ✅
    expect(result.title).toBe('Test')          // ✅ Original preserved
    expect(() => {
      result.undeclared = 'value'  // ❌ Should throw
    }).toThrow()
  })
})
```

## Migration Path

### Phase 1: Opt-in (Current)
- New augmentations use contracts
- Old augmentations still work

### Phase 2: Warnings
- Uncontracted modifications generate warnings
- Developers encouraged to add contracts

### Phase 3: Enforcement
- Contracts required for all augmentations
- Safety enforcer active by default

## Summary

The contract system makes augmentations:
- **Safer**: Can't accidentally corrupt data
- **Clearer**: Intentions documented
- **Composable**: Multiple augmentations can coexist
- **Debuggable**: Full audit trail
- **Professional**: Enterprise-ready safety