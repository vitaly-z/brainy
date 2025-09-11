# Brainy Metadata Architecture & Namespacing

## The Problem 🚨
We're mixing internal Brainy fields with user metadata, causing:
1. **Namespace collisions** - User's `deleted` field conflicts with our soft-delete
2. **API confusion** - Users see internal fields they shouldn't care about
3. **Security issues** - Users could manipulate internal fields
4. **Augmentation conflicts** - 3rd party augmentations might overwrite our fields

## Current Internal Fields Being Added

### Core System Fields
```javascript
metadata = {
  // USER DATA
  name: "Django",
  type: "framework",
  
  // OUR INTERNAL FIELDS - COLLISION RISK!
  deleted: false,          // Soft delete status
  domain: "tech",          // Distributed mode domain
  domainMetadata: {},      // Domain-specific metadata
  partition: 0,            // Partition for sharding
  createdAt: {...},        // GraphNoun timestamp
  updatedAt: {...},        // GraphNoun timestamp
  createdBy: {...},        // Who created this
  noun: "Concept",         // NounType
  verb: "RELATES_TO",     // VerbType (for relationships)
  isPlaceholder: true,     // Write-only mode marker
  autoCreated: true,       // Auto-created noun marker
  writeOnlyMode: true      // High-speed streaming marker
}
```

### Augmentation Fields
```javascript
// Good - neuralImport already uses underscore prefix!
metadata._neuralProcessed = true
metadata._neuralConfidence = 0.95
metadata._detectedEntities = 5
metadata._detectedRelationships = 3
metadata._neuralInsights = [...]

// Bad - direct modification
metadata.importance = 0.8  // IntelligentVerbScoring
```

## Proposed Solution: Three-Tier Metadata

### 1. User Metadata (Public)
```javascript
metadata = {
  // User's fields - completely untouched
  name: "Django",
  type: "framework",
  deleted: "2024-01-01",  // User's own deleted field - no conflict!
  domain: "web",          // User's domain field - no conflict!
}
```

### 2. Internal Metadata (Protected)
```javascript
metadata._brainy = {
  // Core system fields - O(1) indexed
  deleted: false,         // Our soft delete flag
  version: 2,             // Metadata schema version
  
  // Distributed mode
  partition: 0,
  distributedDomain: "tech",
  
  // GraphNoun compliance
  nounType: "Concept",
  verbType: "RELATES_TO",
  createdAt: 1704067200000,
  updatedAt: 1704067200000,
  createdBy: "user:123",
  
  // Performance flags
  indexed: true,
  searchable: true,
  placeholder: false,
  
  // Storage optimization
  compressed: false,
  encrypted: false
}
```

### 3. Augmentation Metadata (Semi-Protected)
```javascript
metadata._augmentations = {
  // Each augmentation gets its own namespace
  neuralImport: {
    processed: true,
    confidence: 0.95,
    entities: 5,
    relationships: 3
  },
  
  verbScoring: {
    contextScore: 0.7,
    importance: 0.8
  },
  
  // 3rd party augmentations
  customAug: {
    // Their fields isolated here
  }
}
```

## Implementation Strategy

### Phase 1: Core Fields ✅
```javascript
// Already done with _brainy.deleted
const BRAINY_NAMESPACE = '_brainy'
const AUGMENTATION_NAMESPACE = '_augmentations'
```

### Phase 2: Migrate All Internal Fields
```javascript
// Before
metadata.domain = "tech"
metadata.partition = 0

// After
metadata._brainy.distributedDomain = "tech"
metadata._brainy.partition = 0
```

### Phase 3: Augmentation API
```javascript
class Augmentation {
  // Read user metadata (read-only)
  getUserMetadata(metadata) {
    const { _brainy, _augmentations, ...userMeta } = metadata
    return userMeta // Clean user data only
  }
  
  // Write augmentation data (isolated)
  setAugmentationData(metadata, augName, data) {
    if (!metadata._augmentations) metadata._augmentations = {}
    metadata._augmentations[augName] = data
  }
  
  // Read internal fields (for special augmentations only)
  getInternalField(metadata, field) {
    return metadata._brainy?.[field]
  }
}
```

## Benefits

1. **No Collisions** - User can have any field names
2. **O(1) Performance** - Internal fields still indexed
3. **Clean API** - Users only see their data
4. **Secure** - Internal fields protected
5. **Extensible** - Augmentations isolated
6. **Backward Compatible** - Migration path available

## Query Impact

### Before (Collision Risk)
```javascript
where: { 
  deleted: false,  // Ambiguous - ours or user's?
  type: "framework"
}
```

### After (Clear Separation)
```javascript
where: {
  '_brainy.deleted': false,  // Our soft delete
  type: "framework"          // User's field
}
```

## Performance Considerations

- **Index on `_brainy.deleted`**: O(1) hash lookup ✅
- **Index on `_brainy.partition`**: O(1) for sharding ✅
- **Nested field access**: Modern DBs handle this efficiently ✅
- **Storage overhead**: ~100 bytes per item (acceptable) ✅

## Migration Path

1. **New items**: Automatically use namespaced fields
2. **Existing items**: Lazy migration on update
3. **Queries**: Support both formats temporarily
4. **Deprecation**: Remove old format in v3.0

## Augmentation Guidelines

### For Core Augmentations
- Use `_brainy.*` for system fields
- Use `_augmentations.{name}.*` for augmentation data
- Never modify user fields directly

### For 3rd Party Augmentations
- Read user metadata via `getUserMetadata()`
- Write only to `_augmentations.{yourName}.*`
- Request permission for internal field access

## Critical Fields to Namespace

| Field | Current Location | New Location | Priority |
|-------|-----------------|--------------|----------|
| deleted | metadata.deleted | metadata._brainy.deleted | HIGH ✅ |
| partition | metadata.partition | metadata._brainy.partition | HIGH |
| domain | metadata.domain | metadata._brainy.distributedDomain | HIGH |
| createdAt | metadata.createdAt | metadata._brainy.createdAt | MEDIUM |
| updatedAt | metadata.updatedAt | metadata._brainy.updatedAt | MEDIUM |
| noun | metadata.noun | metadata._brainy.nounType | MEDIUM |
| verb | metadata.verb | metadata._brainy.verbType | MEDIUM |
| isPlaceholder | metadata.isPlaceholder | metadata._brainy.placeholder | LOW |
| autoCreated | metadata.autoCreated | metadata._brainy.autoCreated | LOW |