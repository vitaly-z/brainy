# Aggregation Guide

> Real-time analytics on your entity data with incremental running totals

## Overview

Brainy's aggregation engine computes running totals at write time, so reading aggregate results is always O(1) regardless of dataset size. Define an aggregate once, and every `add()`, `update()`, and `delete()` automatically updates the running metrics.

No batch jobs. No scheduled recalculations. Aggregates stay current with every write.

## Quick Start

```typescript
import { Brainy, NounType } from '@soulcraft/brainy'

const brain = new Brainy()
await brain.init()

// 1. Define an aggregate
brain.defineAggregate({
  name: 'sales_by_category',
  source: { type: NounType.Event },
  groupBy: ['category'],
  metrics: {
    revenue: { op: 'sum', field: 'amount' },
    count:   { op: 'count' },
    average: { op: 'avg', field: 'amount' }
  }
})

// 2. Add entities — aggregates update automatically
await brain.add({
  data: 'Coffee purchase',
  type: NounType.Event,
  metadata: { category: 'food', amount: 5.50 }
})

await brain.add({
  data: 'Laptop purchase',
  type: NounType.Event,
  metadata: { category: 'electronics', amount: 1200 }
})

await brain.add({
  data: 'Lunch purchase',
  type: NounType.Event,
  metadata: { category: 'food', amount: 12.00 }
})

// 3. Query results
const results = await brain.find({ aggregate: 'sales_by_category' })

// Results:
// [
//   { groupKey: { category: 'food' }, metrics: { revenue: 17.50, count: 2, average: 8.75 } },
//   { groupKey: { category: 'electronics' }, metrics: { revenue: 1200, count: 1, average: 1200 } }
// ]
```

## Aggregation Operations

Brainy supports 7 aggregation operations:

### `sum` — Running Total

Adds up all values of a numeric field.

```typescript
metrics: {
  total_revenue: { op: 'sum', field: 'amount' }
}
```

### `count` — Entity Count

Counts the number of matching entities. No `field` required.

```typescript
metrics: {
  order_count: { op: 'count' }
}
```

### `avg` — Running Average

Computes `sum / count` incrementally.

```typescript
metrics: {
  average_price: { op: 'avg', field: 'price' }
}
```

### `min` — Minimum Value

Tracks the minimum value across all entities in each group.

```typescript
metrics: {
  lowest_price: { op: 'min', field: 'price' }
}
```

### `max` — Maximum Value

Tracks the maximum value across all entities in each group.

```typescript
metrics: {
  highest_price: { op: 'max', field: 'price' }
}
```

### `stddev` — Sample Standard Deviation

Computes the sample standard deviation using Welford's numerically stable online algorithm. Updates incrementally without storing individual values.

```typescript
metrics: {
  price_spread: { op: 'stddev', field: 'price' }
}
```

### `variance` — Sample Variance

Computes the sample variance (square of standard deviation) using Welford's online algorithm.

```typescript
metrics: {
  price_variance: { op: 'variance', field: 'price' }
}
```

## GROUP BY Dimensions

Every aggregate requires at least one `groupBy` dimension. Results are grouped by the unique combinations of dimension values.

### Plain Fields

Group by a metadata field value:

```typescript
groupBy: ['category']
// Produces groups: { category: 'food' }, { category: 'electronics' }, ...
```

### Multiple Fields

Group by multiple fields for composite keys:

```typescript
groupBy: ['category', 'region']
// Produces groups: { category: 'food', region: 'US' }, { category: 'food', region: 'EU' }, ...
```

### Time Windows

Group by a timestamp field bucketed into time periods:

```typescript
groupBy: [{ field: 'date', window: 'month' }]
// Produces groups: { date: '2024-01' }, { date: '2024-02' }, ...
```

Available time window granularities:

| Window | Format | Example |
|--------|--------|---------|
| `hour` | `YYYY-MM-DDThh` | `2024-01-15T14` |
| `day` | `YYYY-MM-DD` | `2024-01-15` |
| `week` | `YYYY-Wnn` | `2024-W03` |
| `month` | `YYYY-MM` | `2024-01` |
| `quarter` | `YYYY-Qn` | `2024-Q1` |
| `year` | `YYYY` | `2024` |
| `{ seconds: N }` | ISO 8601 | Custom interval |

### Combined Dimensions

Mix plain fields and time windows:

```typescript
brain.defineAggregate({
  name: 'monthly_sales',
  source: { type: NounType.Event },
  groupBy: ['region', { field: 'date', window: 'month' }],
  metrics: {
    revenue: { op: 'sum', field: 'amount' },
    count: { op: 'count' }
  }
})

// Produces groups like:
// { region: 'US', date: '2024-01' }
// { region: 'US', date: '2024-02' }
// { region: 'EU', date: '2024-01' }
```

## Querying Aggregates

Aggregate results are queried through the standard `find()` method.

### Basic Query

```typescript
const results = await brain.find({ aggregate: 'sales_by_category' })
```

### Filter by Group Key

Use `where` to filter on group key values:

```typescript
const foodOnly = await brain.find({
  aggregate: 'sales_by_category',
  where: { category: 'food' }
})
```

### Sort and Paginate

Sort by any metric or group key field:

```typescript
const topCategories = await brain.find({
  aggregate: {
    name: 'sales_by_category',
    orderBy: 'revenue',
    order: 'desc',
    limit: 10
  }
})
```

### Combined Parameters

`where`, `orderBy`, `limit`, and `offset` from the outer `find()` call merge automatically with the aggregate query:

```typescript
const recentTopSpenders = await brain.find({
  aggregate: 'monthly_sales',
  where: { region: 'US' },
  orderBy: 'revenue',
  order: 'desc',
  limit: 12,
  offset: 0
})
```

### Result Format

Each result is returned as a `Result<T>` with `type: NounType.Measurement`:

```typescript
{
  id: string,
  score: 1.0,
  type: NounType.Measurement,
  metadata: {
    __aggregate: 'sales_by_category',
    category: 'food',         // Group key values
    revenue: 17.50,           // Computed metrics
    count: 2,
    average: 8.75
  },
  entity: Entity
}
```

## Source Filtering

Control which entities feed into an aggregate with the `source` property.

### Filter by Entity Type

```typescript
brain.defineAggregate({
  name: 'event_stats',
  source: { type: NounType.Event },
  groupBy: ['category'],
  metrics: { count: { op: 'count' } }
})
```

### Filter by Multiple Types

```typescript
source: { type: [NounType.Event, NounType.Document] }
```

### Filter by Metadata

Use the same `where` syntax as `find()`:

```typescript
source: {
  type: NounType.Event,
  where: { domain: 'financial', subtype: 'transaction' }
}
```

### Filter by Service

For multi-tenant deployments:

```typescript
source: { service: 'tenant-123' }
```

Entities that don't match the source filter are silently skipped during incremental updates.

## Incremental Updates

The aggregation engine hooks into every write operation:

### On `add()`

When a new entity matches an aggregate's source filter:
1. The group key is computed from the entity's metadata
2. Each metric in the matching group is incremented
3. New groups are created automatically

### On `update()`

When an existing entity is updated:
1. The old entity's contribution is reversed from its group
2. The new entity's contribution is applied to its (potentially different) group
3. Handles group key changes — an entity moving from category "food" to "drink" updates both groups

### On `delete()`

When an entity is deleted:
1. The entity's contribution is reversed from its group
2. If a group becomes empty (all metric counts reach zero), it's removed

### Aggregate Entity Exclusion

Materialized `NounType.Measurement` entities are automatically excluded from all source matching, preventing infinite feedback loops. Entities with `service: 'brainy:aggregation'` or `metadata.__aggregate` are always skipped.

## Materialization

Materialization writes aggregate results as `NounType.Measurement` entities, making them automatically available through OData, Google Sheets, SSE, and webhook integrations.

```typescript
brain.defineAggregate({
  name: 'daily_metrics',
  source: { type: NounType.Event },
  groupBy: [{ field: 'date', window: 'day' }],
  metrics: {
    total: { op: 'sum', field: 'amount' },
    count: { op: 'count' }
  },
  materialize: true
})
```

### Debounce Configuration

During high-throughput ingestion, materialization is debounced to avoid excessive writes:

```typescript
materialize: {
  debounceMs: 2000,      // Wait 2 seconds after last update before writing
  trackSources: true     // Track which entities contributed
}
```

The default debounce interval is 1000ms.

## Multiple Aggregates

Define multiple aggregates that process the same entities:

```typescript
// Revenue by category
brain.defineAggregate({
  name: 'category_revenue',
  source: { type: NounType.Event },
  groupBy: ['category'],
  metrics: { total: { op: 'sum', field: 'amount' } }
})

// Monthly trends
brain.defineAggregate({
  name: 'monthly_trends',
  source: { type: NounType.Event },
  groupBy: [{ field: 'date', window: 'month' }],
  metrics: {
    revenue: { op: 'sum', field: 'amount' },
    count: { op: 'count' },
    avg_order: { op: 'avg', field: 'amount' }
  }
})

// Regional breakdown with statistical analysis
brain.defineAggregate({
  name: 'regional_analysis',
  source: { type: NounType.Event },
  groupBy: ['region'],
  metrics: {
    revenue: { op: 'sum', field: 'amount' },
    spread: { op: 'stddev', field: 'amount' },
    variance: { op: 'variance', field: 'amount' }
  }
})
```

Each `add()` call updates all matching aggregates automatically.

## Removing Aggregates

Remove an aggregate and clean up its state:

```typescript
brain.removeAggregate('category_revenue')
```

## Persistence

Aggregate definitions and running state are automatically persisted:

- **On `flush()`/`close()`**: All dirty aggregate state is written to storage
- **On `init()`**: Definitions and state are restored from storage
- **Change detection**: Definition changes are detected via FNV-1a hashing — only changed aggregates reset their state on restart

## Native Acceleration

When [Cortex](https://github.com/soulcraftlabs/cortex) is installed as a plugin, the aggregation engine automatically uses Rust-accelerated computation:

- Incremental updates run in Rust with BTreeMap-backed precise MIN/MAX
- Welford's online stddev/variance computed natively
- Rebuild uses Rayon parallel iterators across CPU cores (above 1,000 entities)
- Time window bucketing uses integer arithmetic without `Date` object allocation

```typescript
const brain = new Brainy({
  plugins: ['@soulcraft/cortex']
})
await brain.init()

// Aggregation automatically uses native engine
brain.defineAggregate({ ... })
```

Verify native acceleration is active:

```typescript
const diag = brain.diagnostics()
console.log(diag.providers.aggregation)
// { source: 'plugin' }
```

## Common Patterns

### Financial Analytics

```typescript
brain.defineAggregate({
  name: 'monthly_spending',
  source: {
    type: NounType.Event,
    where: { domain: 'financial', subtype: 'transaction' }
  },
  groupBy: [
    'category',
    { field: 'date', window: 'month' }
  ],
  metrics: {
    total:   { op: 'sum', field: 'amount' },
    count:   { op: 'count' },
    average: { op: 'avg', field: 'amount' },
    highest: { op: 'max', field: 'amount' },
    lowest:  { op: 'min', field: 'amount' }
  },
  materialize: true
})
```

### Time-Series Monitoring

```typescript
brain.defineAggregate({
  name: 'hourly_metrics',
  source: { type: NounType.Event, where: { domain: 'monitoring' } },
  groupBy: [
    'service',
    { field: 'timestamp', window: 'hour' }
  ],
  metrics: {
    request_count:  { op: 'count' },
    avg_latency:    { op: 'avg', field: 'latency_ms' },
    max_latency:    { op: 'max', field: 'latency_ms' },
    error_count:    { op: 'sum', field: 'is_error' },
    latency_spread: { op: 'stddev', field: 'latency_ms' }
  }
})
```

### Content Analytics

```typescript
brain.defineAggregate({
  name: 'content_stats',
  source: { type: NounType.Document },
  groupBy: ['author', { field: 'publishedAt', window: 'month' }],
  metrics: {
    articles:   { op: 'count' },
    total_words: { op: 'sum', field: 'wordCount' },
    avg_words:   { op: 'avg', field: 'wordCount' }
  }
})
```

## Performance

Aggregation complexity per write is O(A x G x M) where A = matching aggregates, G = groupBy dimensions, M = metrics. For typical configurations (2-5 aggregates, 1-3 dimensions, 3-5 metrics), this is effectively O(1).

With Cortex native acceleration:

| Operation | Throughput | Latency |
|-----------|-----------|---------|
| Incremental update (1K entities) | 809 ops/s | 1.2 ms |
| Rebuild (10K entities) | 475 ops/s | 2.1 ms |
| Rebuild (100K entities, Rayon) | 66 ops/s | 15.2 ms |
| Query (1K groups, sort + paginate) | 986 ops/s | 1.0 ms |
