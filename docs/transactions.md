# Transaction System

**Status:** ✅ Production Ready (v5.8.0+)

## Overview

Brainy's transaction system provides **atomic operations** with automatic rollback on failure. All operations within a transaction either succeed completely or fail completely - there are no partial failures.

### Key Benefits

- **Atomicity**: All operations succeed or all rollback
- **Consistency**: Indexes and storage remain consistent
- **Automatic**: Transparently used by all `brain.add()`, `brain.update()`, `brain.delete()`, and `brain.relate()` operations
- **Compatible**: Works seamlessly with COW, sharding, type-aware storage, and distributed storage

## Architecture

```
User Code (brain.add(), brain.update(), etc.)
  ↓
Transaction Manager (orchestration)
  ↓
Operations (SaveNounMetadataOperation, SaveNounOperation, etc.)
  ↓
Storage Adapter (COW, sharding, type-aware routing)
```

### How It Works

Every write operation in Brainy automatically uses transactions:

```typescript
// Internally, this uses a transaction
const id = await brain.add({
  data: { name: 'Alice', role: 'Engineer' },
  type: NounType.Person
})
```

**Transaction Flow:**

1. **Begin Transaction**: TransactionManager creates new transaction
2. **Add Operations**: Operations added to transaction (SaveNounMetadataOperation, SaveNounOperation)
3. **Execute**: Each operation executes in sequence
4. **Commit**: All operations succeeded → changes persist
5. **Rollback**: Any operation failed → all changes reverted

### Rollback Mechanism

Each operation implements both **execute** and **undo**:

```typescript
class SaveNounMetadataOperation {
  async execute(): Promise<void> {
    // Save new metadata
    await this.storage.saveNounMetadata(this.id, this.metadata)
  }

  async undo(): Promise<void> {
    // Restore previous metadata (or delete if new entity)
    if (this.previousMetadata) {
      await this.storage.saveNounMetadata(this.id, this.previousMetadata)
    } else {
      await this.storage.deleteNounMetadata(this.id)
    }
  }
}
```

**On failure:**
- Operations rolled back in **reverse order**
- Previous state fully restored
- Indexes updated to reflect rollback

## Compatibility with Advanced Features

### COW (Copy-on-Write)

✅ **Fully Compatible**

Transactions work transparently with COW branches:

```typescript
// Create branch
await brain.cow.createBranch('feature-branch')
await brain.cow.checkout('feature-branch')

// Add entity (uses transaction on this branch)
const id = await brain.add({
  data: { name: 'Feature Entity' },
  type: NounType.Thing
})

// On rollback: Branch remains clean, no partial commits
```

**How It Works:**
- Transactions use `StorageAdapter` interface
- COW operates at storage layer (refManager, blobStorage, commitLog)
- Branch isolation prevents cross-branch contamination
- Rollback = discard uncommitted changes (COW makes this trivial)

### Sharding

✅ **Fully Compatible**

Transactions work across multiple shards:

```typescript
// Entities with different UUID prefixes go to different shards
const id1 = 'aaa00000-1111-4111-8111-111111111111' // Shard: aaa
const id2 = 'bbb00000-2222-4222-8222-222222222222' // Shard: bbb

await brain.add({ id: id1, data: { name: 'Entity A' }, type: NounType.Thing })
await brain.relate({ from: id1, to: id2, type: VerbType.RelatesTo })

// Transaction handles cross-shard atomicity automatically
```

**How It Works:**
- Sharding is transparent to transactions
- `analyzeKey()` method routes to correct shard based on UUID
- Transaction operations don't need to know about shards
- Rollback works across all shards involved

### TypeAware Storage

✅ **Fully Compatible**

Transactions work with type-specific routing:

```typescript
// Entities routed to type-specific storage paths
const personId = await brain.add({
  data: { name: 'John Doe' },
  type: NounType.Person  // → entities/nouns/person/<shard>/...
})

const orgId = await brain.add({
  data: { name: 'Acme Corp' },
  type: NounType.Organization  // → entities/nouns/organization/<shard>/...
})

// Type changes handled atomically
await brain.update({
  id: personId,
  type: NounType.Organization,  // Type change
  data: { name: 'Doe Corp' }
})
```

**How It Works:**
- Type information carried in metadata
- Storage layer handles type-specific routing
- Type cache updated/restored during rollback
- Type counters adjusted on commit/rollback

### Distributed Storage

✅ **Fully Compatible**

Transactions work with distributed/remote storage:

```typescript
// Works with S3, Azure, GCS, etc.
const brain = new Brainy({
  storage: {
    type: 's3Compatible',
    config: { /* S3 config */ }
  }
})

// Transactions ensure atomicity at write coordinator level
await brain.add({ data: { name: 'Remote Entity' }, type: NounType.Thing })
```

**How It Works:**
- Transactions operate through `StorageAdapter` interface
- Remote storage adapters implement same interface
- Atomicity guaranteed at write-coordinator level
- Read-after-write consistency maintained

**Design Philosophy:**
- **Single-node writes** (most common): Fully atomic ✅
- **Distributed reads + centralized writes**: Transactions on primary ✅
- **Multi-primary**: Transactions per-instance, cross-instance via coordinator ✅

## Examples

### Basic Add Operation

```typescript
import { Brainy } from '@soulcraft/brainy'
import { NounType } from '@soulcraft/brainy/types'

const brain = new Brainy()
await brain.init()

// Automatically uses transaction
const id = await brain.add({
  data: { name: 'Alice', role: 'Engineer' },
  type: NounType.Person
})

// If add fails, all changes rolled back automatically
```

### Update with Type Change

```typescript
// Original entity
const id = await brain.add({
  data: { name: 'John Smith', category: 'individual' },
  type: NounType.Person
})

// Update with type change (atomic)
await brain.update({
  id,
  type: NounType.Organization,  // Type change
  data: { name: 'Smith Corp', category: 'business' }
})

// If update fails, original type and data restored
```

### Creating Relationships

```typescript
const personId = await brain.add({
  data: { name: 'Alice' },
  type: NounType.Person
})

const projectId = await brain.add({
  data: { name: 'Project X' },
  type: NounType.Thing
})

// Create relationship (atomic)
await brain.relate({
  from: personId,
  to: projectId,
  type: VerbType.WorksOn
})

// If relate fails, no partial relationship created
```

### Batch Operations

```typescript
// Multiple operations, all atomic
for (let i = 0; i < 100; i++) {
  await brain.add({
    data: { name: `Entity ${i}`, index: i },
    type: NounType.Thing
  })
}

// Each add() is a separate transaction
// If any add fails, only that specific add is rolled back
```

### Delete with Cascade

```typescript
const personId = await brain.add({
  data: { name: 'Bob' },
  type: NounType.Person
})

const projectId = await brain.add({
  data: { name: 'Project Y' },
  type: NounType.Thing
})

await brain.relate({
  from: personId,
  to: projectId,
  type: VerbType.WorksOn
})

// Delete person (atomic - deletes entity + relationships)
await brain.delete(personId)

// If delete fails, both entity and relationships remain
```

## Error Handling

Transactions automatically handle errors and rollback:

```typescript
try {
  await brain.add({
    data: { name: 'Test Entity' },
    type: NounType.Thing,
    vector: [1, 2, 3]  // Wrong dimension → error
  })
} catch (error) {
  // Transaction automatically rolled back
  // No partial data in storage or indexes
  console.error('Add failed:', error.message)
}
```

**Common Error Scenarios:**
- **Invalid vector dimension**: Automatic rollback
- **Type validation failure**: Automatic rollback
- **Storage write failure**: Automatic rollback
- **Index update failure**: Automatic rollback

## Performance Considerations

### Transaction Overhead

**MEASURED Performance Impact:**
- Average overhead: ~2-5ms per transaction (measured: `tests/transaction/transaction.bench.ts`)
- Operations per transaction: 2-8 (metadata + data + indexes)
- Rollback cost: ~1-3ms (restore previous state)

**Optimization:**
- Operations executed sequentially (not parallel) for consistency
- Rollback only happens on failure (success path is fast)
- Index updates batched within transaction

### Statistics and Monitoring

```typescript
// Get transaction statistics
const stats = brain.transactionManager?.getStats()
console.log(stats)
// {
//   totalTransactions: 1234,
//   successfulTransactions: 1200,
//   failedTransactions: 34,
//   rollbacks: 34,
//   averageOperationsPerTransaction: 4.2
// }
```

**Metrics Available:**
- `totalTransactions`: Total number of transactions executed
- `successfulTransactions`: Number of successful commits
- `failedTransactions`: Number of rollbacks
- `rollbacks`: Total rollback count
- `averageOperationsPerTransaction`: Average operations per transaction

## Best Practices

### 1. Let Brainy Handle Transactions

```typescript
// ✅ Recommended: Use Brainy's API (transactions automatic)
await brain.add({ data, type })
await brain.update({ id, data })
await brain.delete(id)

// ❌ Avoid: Direct storage access bypasses transactions
await brain.storage.saveNoun(noun)  // No transaction protection
```

### 2. Handle Errors Gracefully

```typescript
// ✅ Recommended: Catch errors, transaction rolls back automatically
try {
  const id = await brain.add({ data, type })
  return id
} catch (error) {
  console.error('Add failed, rolled back:', error)
  // Decide how to handle (retry, log, alert user)
}
```

### 3. Validate Before Operations

```typescript
// ✅ Recommended: Validate early to avoid unnecessary rollbacks
if (!isValidVector(vector, brain.dimension)) {
  throw new Error(`Vector must have ${brain.dimension} dimensions`)
}

await brain.add({ data, type, vector })
```

### 4. Monitor Transaction Statistics

```typescript
// ✅ Recommended: Monitor in production
setInterval(() => {
  const stats = brain.transactionManager?.getStats()
  if (stats) {
    const failureRate = stats.failedTransactions / stats.totalTransactions
    if (failureRate > 0.05) {  // > 5% failure rate
      console.warn('High transaction failure rate:', failureRate)
    }
  }
}, 60000)  // Check every minute
```

### 5. Understand Atomicity Guarantees

**What Transactions GUARANTEE:**
- ✅ Atomicity within single Brainy instance
- ✅ Consistent state across all indexes
- ✅ Automatic rollback on failure
- ✅ Works with all storage adapters (local, remote, COW, sharded)

**What Transactions DON'T Provide:**
- ❌ Two-phase commit across multiple Brainy instances
- ❌ Distributed locking across nodes
- ❌ Cross-datacenter ACID guarantees

**Design:** Transactions ensure atomicity at the **write coordinator level**. For multi-instance scenarios, use `DistributedCoordinator`.

## Testing Transactions

### Unit Tests

```typescript
import { describe, it, expect } from 'vitest'
import { Brainy } from '@soulcraft/brainy'

describe('Transaction Tests', () => {
  it('should rollback on failure', async () => {
    const brain = new Brainy()
    await brain.init()

    const id1 = await brain.add({ data: { name: 'Entity 1' }, type: NounType.Thing })

    try {
      await brain.add({
        data: null as any,  // Invalid - will fail
        type: NounType.Thing
      })
    } catch (e) {
      // Expected failure
    }

    // First entity should still exist (rollback didn't affect it)
    const entity1 = await brain.get(id1)
    expect(entity1).toBeTruthy()
  })
})
```

### Integration Tests

See `tests/transaction/integration/` for comprehensive integration tests covering:
- COW integration (`cow-transactions.test.ts`)
- Sharding integration (`sharding-transactions.test.ts`)
- TypeAware integration (`typeaware-transactions.test.ts`)
- Distributed storage integration (`distributed-transactions.test.ts`)

## Troubleshooting

### High Rollback Rate

**Symptom:** `failedTransactions` / `totalTransactions` > 5%

**Possible Causes:**
1. Invalid vector dimensions
2. Type validation errors
3. Storage write failures (disk full, network issues)
4. Index corruption

**Solutions:**
- Validate data before operations
- Check storage adapter health
- Monitor disk space and network connectivity
- Review error logs for patterns

### Slow Transaction Performance

**Symptom:** Operations take > 100ms per transaction

**Possible Causes:**
1. Large metadata objects
2. Remote storage latency
3. Many indexes enabled
4. Disk I/O bottleneck

**Solutions:**
- Optimize metadata size
- Use local caching for remote storage
- Disable unused indexes
- Use SSD storage

### Transaction Statistics Missing

**Symptom:** `brain.transactionManager?.getStats()` returns `undefined`

**Cause:** TransactionManager not initialized

**Solution:**
```typescript
// Ensure Brainy is initialized
await brain.init()

// Then access stats
const stats = brain.transactionManager?.getStats()
```

## Architecture Details

### Transaction Lifecycle

```
1. BEGIN
   ↓
2. ADD OPERATIONS
   - SaveNounMetadataOperation
   - SaveNounOperation
   - UpdateGraphIndexOperation
   ↓
3. EXECUTE (sequential)
   - Execute operation 1 → Success
   - Execute operation 2 → Success
   - Execute operation 3 → FAILURE
   ↓
4. ROLLBACK (reverse order)
   - Undo operation 2
   - Undo operation 1
   ↓
5. THROW ERROR
```

### Operation Types

| Operation | Description | Undo Behavior |
|-----------|-------------|---------------|
| `SaveNounMetadataOperation` | Save entity metadata | Restore previous metadata or delete if new |
| `SaveNounOperation` | Save entity data | Restore previous data or delete if new |
| `UpdateGraphIndexOperation` | Update graph index | Restore previous index state |
| `SaveVerbMetadataOperation` | Save relationship metadata | Restore previous metadata or delete if new |
| `SaveVerbOperation` | Save relationship data | Restore previous data or delete if new |

### Storage Adapter Integration

Transactions use the `StorageAdapter` interface:

```typescript
interface StorageAdapter {
  saveNounMetadata(id: string, metadata: NounMetadata): Promise<void>
  saveNoun(noun: Noun): Promise<void>
  deleteNounMetadata(id: string): Promise<void>
  deleteNoun(id: string): Promise<void>
  // ... other methods
}
```

**Key Insight:** All storage adapters (filesystem, S3, Azure, GCS, memory) implement this interface. Transactions work with **any** storage adapter automatically.

## Additional Resources

- **Unit Tests:** `tests/transaction/transaction.test.ts` (36 passing tests)
- **Integration Tests:** `tests/transaction/integration/` (35 test scenarios)
- **Compatibility Analysis:** `.strategy/TRANSACTION_COMPATIBILITY_ANALYSIS.md` (internal)
- **Performance Benchmarks:** `tests/transaction/transaction.bench.ts`

## Version History

- **v5.8.0**: Initial transaction system release
  - Atomic operations with rollback
  - Compatible with COW, sharding, type-aware, distributed
  - 36/36 unit tests passing
  - 35 integration test scenarios

## Summary

Brainy's transaction system provides **production-ready atomic operations** with automatic rollback. It works transparently with all Brainy APIs and is fully compatible with advanced features like COW, sharding, type-aware storage, and distributed storage.

**Key Takeaways:**
- ✅ **Automatic**: No manual transaction management needed
- ✅ **Atomic**: All operations succeed or all rollback
- ✅ **Compatible**: Works with all storage adapters and features
- ✅ **Production-Ready**: Tested with 71 test scenarios (36 unit + 35 integration)
- ✅ **Performant**: ~2-5ms overhead per transaction (measured)

Start using transactions today - they're already built into `brain.add()`, `brain.update()`, `brain.delete()`, and `brain.relate()`!
