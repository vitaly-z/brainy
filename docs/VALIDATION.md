# Brainy Validation System

## Zero-Config Philosophy

Brainy's validation system automatically adapts to your system resources without any configuration. It enforces universal truths while dynamically adjusting limits based on available memory and observed performance.

## Core Principles

### 1. Universal Truths Only
We only validate things that are mathematically or logically impossible:
- Negative pagination values (there's no page -1)
- Probabilities outside 0-1 range
- Self-referential relationships
- Invalid enum values

### 2. Auto-Configuration
The system automatically configures based on:
- **Available Memory**: More RAM = higher limits
- **System Performance**: Adjusts based on query response times
- **Usage Patterns**: Learns from your actual workload

### 3. Performance Monitoring
Every query is monitored to tune future limits:
```typescript
// Automatic adjustment based on performance
if (avgQueryTime < 100ms && resultCount > 80% of limit) {
  // Increase limits - system can handle more
  maxLimit *= 1.5
} else if (avgQueryTime > 1000ms) {
  // Reduce limits - system is struggling
  maxLimit *= 0.8
}
```

## Validation Rules by Method

### `add(params: AddParams)`

**Required:**
- Either `data` or `vector` must be provided
- `type` must be a valid NounType enum

**Constraints:**
- `vector` must have exactly 384 dimensions (for all-MiniLM-L6-v2)
- Custom `id` must be unique

**Example:**
```typescript
// ✅ Valid
await brain.add({
  data: "Hello world",
  type: NounType.Document
})

// ✅ Valid - pre-computed vector
await brain.add({
  vector: new Array(384).fill(0),
  type: NounType.Document
})

// ❌ Invalid - missing both data and vector
await brain.add({
  type: NounType.Document
})
// Error: "must provide either data or vector"

// ❌ Invalid - wrong vector dimensions
await brain.add({
  vector: new Array(100).fill(0),
  type: NounType.Document
})
// Error: "vector must have exactly 384 dimensions"
```

### `update(params: UpdateParams)`

**Required:**
- `id` must be provided
- At least one field must be updated

**Important Metadata Behavior:**
- `metadata: null` with `merge: false` → **Keeps existing metadata** (does nothing)
- `metadata: {}` with `merge: false` → **Clears metadata** ✅
- `metadata: undefined` → No change to metadata

**Example:**
```typescript
// ✅ Valid - update metadata
await brain.update({
  id: "xyz",
  metadata: { status: "published" }
})

// ✅ Valid - clear metadata properly
await brain.update({
  id: "xyz",
  metadata: {},
  merge: false
})

// ❌ Invalid - null doesn't clear metadata
await brain.update({
  id: "xyz",
  metadata: null,
  merge: false
})
// Error: "must specify at least one field to update"
// (because null metadata doesn't actually update anything)

// ❌ Invalid - no fields to update
await brain.update({
  id: "xyz"
})
// Error: "must specify at least one field to update"
```

### `relate(params: RelateParams)`

**Required:**
- `from` entity ID
- `to` entity ID
- `type` must be valid VerbType enum

**Constraints:**
- `from` and `to` must be different (no self-loops)
- `weight` must be between 0 and 1

**Example:**
```typescript
// ✅ Valid
await brain.relate({
  from: "entity1",
  to: "entity2",
  type: VerbType.RelatedTo
})

// ❌ Invalid - self-referential
await brain.relate({
  from: "entity1",
  to: "entity1",
  type: VerbType.RelatedTo
})
// Error: "cannot create self-referential relationship"

// ❌ Invalid - weight out of range
await brain.relate({
  from: "entity1",
  to: "entity2",
  type: VerbType.RelatedTo,
  weight: 1.5
})
// Error: "weight must be between 0 and 1"
```

### `find(params: FindParams)`

**Constraints:**
- `limit` must be non-negative and below auto-configured maximum
- `offset` must be non-negative
- Cannot specify both `query` and `vector` (mutually exclusive)
- Cannot use both `cursor` and `offset` pagination
- `threshold` must be between 0 and 1

**Auto-Configured Limits:**
```typescript
// Based on available memory
// 1GB RAM → max limit: 10,000
// 8GB RAM → max limit: 80,000
// 16GB RAM → max limit: 100,000 (capped)

// Query length also scales with memory
// 1GB RAM → max query: 5,000 characters
// 8GB RAM → max query: 40,000 characters
```

**Example:**
```typescript
// ✅ Valid
await brain.find({
  query: "machine learning",
  limit: 50
})

// ❌ Invalid - negative limit
await brain.find({
  query: "test",
  limit: -1
})
// Error: "limit must be non-negative"

// ❌ Invalid - both query and vector
await brain.find({
  query: "test",
  vector: new Array(384).fill(0)
})
// Error: "cannot specify both query and vector - they are mutually exclusive"

// ❌ Invalid - exceeds auto-configured limit
await brain.find({
  limit: 1000000
})
// Error: "limit exceeds auto-configured maximum of 80000 (based on available memory)"
```

## Auto-Configuration Details

### Memory-Based Scaling

The validation system checks available memory on initialization:

```typescript
const availableMemory = os.freemem()

// Scale limits based on available memory
maxLimit = Math.min(
  100000, // Absolute maximum for safety
  Math.floor(availableMemory / (1024 * 1024 * 100)) * 1000
)

// Scale query length similarly
maxQueryLength = Math.min(
  50000,
  Math.floor(availableMemory / (1024 * 1024 * 10)) * 1000
)
```

### Performance-Based Tuning

The system continuously monitors and adjusts:

1. **After each query**, performance is recorded
2. **Limits adjust** based on response times
3. **Gradual optimization** towards optimal throughput

### Checking Current Configuration

You can inspect the current validation configuration:

```typescript
import { getValidationConfig } from '@soulcraft/brainy/validation'

const config = getValidationConfig()
console.log(config)
// {
//   maxLimit: 80000,
//   maxQueryLength: 40000,
//   maxVectorDimensions: 384,
//   systemMemory: 17179869184,
//   availableMemory: 8589934592
// }
```

## Best Practices

### 1. Clearing Metadata
```typescript
// ❌ Wrong - doesn't clear
await brain.update({ id, metadata: null, merge: false })

// ✅ Correct - actually clears
await brain.update({ id, metadata: {}, merge: false })
```

### 2. Type Safety
```typescript
// ❌ Wrong - string type
await brain.add({ data: "test", type: "document" })

// ✅ Correct - enum type
import { NounType } from '@soulcraft/brainy'
await brain.add({ data: "test", type: NounType.Document })
```

### 3. Pagination
```typescript
// ✅ Let the system auto-configure limits
const results = await brain.find({ 
  query: "test",
  limit: 100  // Will be capped at system maximum
})

// ✅ For large datasets, use pagination
let offset = 0
const pageSize = 1000
while (true) {
  const results = await brain.find({
    query: "test",
    limit: pageSize,
    offset
  })
  if (results.length === 0) break
  offset += pageSize
}
```

## Error Messages

All validation errors are descriptive and actionable:

| Error | Cause | Solution |
|-------|-------|----------|
| `"must provide either data or vector"` | Missing content in add() | Provide either data to embed or pre-computed vector |
| `"limit must be non-negative"` | Negative pagination | Use positive limit value |
| `"invalid NounType: xyz"` | Invalid enum value | Use valid NounType enum |
| `"cannot create self-referential relationship"` | from === to | Use different entity IDs |
| `"must specify at least one field to update"` | Empty update | Provide at least one field to change |
| `"vector must have exactly 384 dimensions"` | Wrong vector size | Use 384-dimensional vectors |

## Performance Impact

The validation system adds minimal overhead:
- **Validation time**: <1ms per operation
- **Memory usage**: ~1KB for configuration tracking
- **Auto-tuning**: Happens asynchronously, no blocking

## FAQ

**Q: Why can't I set metadata to null?**
A: Setting metadata to `null` with `merge: false` doesn't actually clear it - it falls back to existing metadata. Use `{}` to clear.

**Q: Why are my limits being reduced?**
A: If queries are taking >1 second, the system automatically reduces limits to maintain performance.

**Q: Can I override the auto-configured limits?**
A: No, this is by design. The system knows better than static configuration what your hardware can handle.

**Q: Why exactly 384 dimensions for vectors?**
A: Brainy uses the all-MiniLM-L6-v2 model which produces 384-dimensional embeddings. This ensures consistency.

## Summary

Brainy's validation system:
- ✅ **Zero configuration** - adapts to your system
- ✅ **Universal truths** - only prevents impossible operations
- ✅ **Performance aware** - adjusts based on actual performance
- ✅ **Type safe** - enforces enum types
- ✅ **Minimal overhead** - <1ms validation time
- ✅ **Clear errors** - actionable error messages

The philosophy is simple: prevent impossible operations, adapt to reality, and get out of the way.