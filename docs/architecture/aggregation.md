# Aggregation Architecture

> Write-time incremental aggregation with O(1) reads

## Design Principles

1. **Write-time computation** — aggregates update on every `add()`, `update()`, and `delete()`, not as batch jobs
2. **Incremental state** — running totals maintained per group, never rescanning the dataset
3. **Provider interface** — TypeScript engine is the default; plugins can replace it with native implementations
4. **Zero-allocation reads** — query results are computed from pre-aggregated state

## Component Overview

```
┌──────────────────────────────────────────────────────────┐
│                         Brainy                           │
│                                                          │
│  add() / update() / delete()                             │
│          │                                               │
│          ▼                                               │
│  ┌──────────────────────┐    ┌────────────────────────┐  │
│  │  AggregationIndex    │    │  AggregateMaterializer  │  │
│  │                      │───▶│  (debounced writes)     │  │
│  │  ├─ definitions Map  │    └────────────────────────┘  │
│  │  ├─ states Map       │                                │
│  │  └─ staleMinMax Set  │    ┌────────────────────────┐  │
│  │                      │    │  timeWindows.ts         │  │
│  │  Source filter ──────│───▶│  bucketTimestamp()      │  │
│  │  Group key ──────────│───▶│  parseBucketRange()     │  │
│  └──────────┬───────────┘    └────────────────────────┘  │
│             │                                            │
│             │ provider interface                          │
│             ▼                                            │
│  ┌──────────────────────┐                                │
│  │  AggregationProvider │  (optional, registered by      │
│  │  ├─ incrementalUpdate│   plugin like @soulcraft/cortex)│
│  │  ├─ rebuildAggregate │                                │
│  │  ├─ queryAggregate   │                                │
│  │  └─ serialize/restore│                                │
│  └──────────────────────┘                                │
└──────────────────────────────────────────────────────────┘
```

## State Management

### Definitions

Registered via `brain.defineAggregate(def)`. Stored in a `Map<string, AggregateDefinition>` keyed by aggregate name. Persisted to storage under `__aggregation_definitions__` on flush.

### Group State

Each aggregate maintains a `Map<string, AggregateGroupState>` where keys are serialized group key values (e.g., `category=food|date=2024-01`). Each group holds per-metric `MetricState`:

```typescript
interface MetricState {
  sum: number    // Running total
  count: number  // Entity count
  min: number    // Minimum (Infinity if empty)
  max: number    // Maximum (-Infinity if empty)
  m2?: number    // Welford's M2 for stddev/variance
}
```

### Change Detection

On restart, definition hashes (FNV-1a 32-bit) are compared with the persisted hash. If a definition changed (different groupBy, metrics, or source), the aggregate state is reset and must be rebuilt.

## Write-Time Update Flow

When `brain.add(entity)` is called:

```
1. For each registered aggregate:
   ├─ Source filter check (type, service, where)
   │  └─ Skip if entity doesn't match
   ├─ Aggregate entity check
   │  └─ Skip if entity.service === 'brainy:aggregation'
   │     or entity.metadata.__aggregate is set
   ├─ Group key computation
   │  └─ Extract groupBy fields from metadata
   │     Apply time bucketing for windowed dimensions
   └─ Metric update
      └─ For each metric in the definition:
         ├─ count: increment count
         ├─ sum/avg: add value to sum, increment count
         ├─ min/max: compare and update
         └─ stddev/variance: Welford's online update
```

### Update Handling

On `brain.update(entity)`, the engine reverses the old entity's contribution and applies the new entity's contribution. This correctly handles:

- **Value changes**: old amount=10, new amount=20 — sum adjusts by +10
- **Group key changes**: entity moves from category "food" to "drink" — both groups update
- **Source filter changes**: entity type changes from Event to Document — removed from matching aggregates

### Delete Handling

On `brain.delete(id)`, the engine reverses the entity's contribution:

- `count` and `sum` are decremented
- `min`/`max` may become stale (marked in `staleMinMax` for lazy recompute)
- Welford's M2 is updated with the inverse formula
- Empty groups (all metric counts at zero) are removed

## Algorithms

### Welford's Online Algorithm

Standard deviation and variance use Welford's numerically stable online algorithm with M2 tracking. This computes incrementally without storing individual values:

```
On add(x):
  count += 1
  oldMean = (sum - x) / (count - 1)    // mean before this value
  sum += x
  mean = sum / count                     // mean after this value
  M2 += (x - oldMean) * (x - mean)

On remove(x):
  oldMean = sum / count
  sum -= x
  count -= 1
  newMean = sum / count
  M2 = max(0, M2 - (x - oldMean) * (x - newMean))

Sample variance = M2 / (count - 1)
Sample stddev = sqrt(variance)
```

M2 is clamped to zero on remove to prevent floating-point drift from producing negative values.

### MIN/MAX Handling

The TypeScript engine uses simple comparison for add operations and marks MIN/MAX as potentially stale on delete (since removing the current min/max value requires a rescan). Stale values are lazily recomputed on the next query.

The Cortex native engine uses a `BTreeMap<OrderedFloat<f64>, u64>` that tracks the exact frequency of every value, providing precise MIN/MAX after any sequence of operations without rescanning.

### Time Window Bucketing

Timestamps (Unix milliseconds) are bucketed using UTC-based formatting:

| Granularity | Bucket Key | Algorithm |
|------------|-----------|-----------|
| `hour` | `2024-01-15T14` | UTC year-month-day-hour |
| `day` | `2024-01-15` | UTC year-month-day |
| `week` | `2024-W03` | ISO 8601 week (Monday start, week 1 contains first Thursday) |
| `month` | `2024-01` | UTC year-month |
| `quarter` | `2024-Q1` | `ceil((month) / 3)` |
| `year` | `2024` | UTC year |
| `{ seconds: N }` | ISO timestamp | `floor(timestamp / interval) * interval` |

Bucket keys can be parsed back into `{ start, end }` timestamp ranges via `parseBucketRange()`.

## Provider Interface

The `AggregationProvider` interface defines the contract between Brainy's `AggregationIndex` and plugin-provided native implementations:

```typescript
interface AggregationProvider {
  defineAggregate?(def: AggregateDefinition): void
  removeAggregate?(name: string): void

  incrementalUpdate(
    name: string,
    def: AggregateDefinition,
    entity: Record<string, unknown>,
    op: 'add' | 'update' | 'delete',
    prev?: Record<string, unknown>
  ): AggregateGroupState[]

  computeGroupKey(
    entity: Record<string, unknown>,
    groupBy: GroupByDimension[]
  ): Record<string, string | number>

  rebuildAggregate(
    def: AggregateDefinition,
    entities: Array<Record<string, unknown>>
  ): Map<string, AggregateGroupState>

  queryAggregate(
    state: Map<string, AggregateGroupState>,
    params: AggregateQueryParams
  ): AggregateResult[]

  restoreState?(data: string): void
  serializeState?(): string
}
```

When a native provider is registered:

1. `AggregationIndex` delegates `incrementalUpdate()` to the provider instead of running TypeScript logic
2. Provider returns updated `AggregateGroupState[]` which are applied back into the state maps
3. Query execution is delegated via `queryAggregate()`
4. State serialization is delegated via `serializeState()`/`restoreState()`

Brainy retains ownership of the state maps and persistence. The provider handles computation.

## Materialization

The `AggregateMaterializer` converts aggregate group states into `NounType.Measurement` entities:

1. When an aggregate group is updated and `materialize` is enabled, `scheduleMaterialize()` is called
2. Materialization is debounced (default: 1000ms) to batch rapid updates during ingestion
3. On trigger, the materializer either creates or updates a `NounType.Measurement` entity
4. Materialized entities include `service: 'brainy:aggregation'` and `metadata.__aggregate` to prevent infinite loops

Materialized entities are automatically visible through:
- OData endpoints
- Google Sheets integration
- Server-Sent Events (SSE)
- Webhook notifications

## Persistence

### Storage Keys

| Key | Content |
|-----|---------|
| `__aggregation_definitions__` | Array of all definitions with FNV-1a hashes |
| `__aggregation_state_{name}__` | Per-aggregate group states (array of `AggregateGroupState`) |
| `__aggregation_native_state__` | Serialized native provider state (JSON string) |

### Lifecycle

1. **`init()`** — Load definitions, compare hashes, load matching state, restore native provider state
2. **Write operations** — Mark modified aggregates as dirty
3. **`flush()`** — Persist all dirty aggregate states and native provider state
4. **`close()`** — Flush and release resources

## Source Files

| File | Purpose |
|------|---------|
| `src/aggregation/AggregationIndex.ts` | Core engine: definitions, state, write hooks, query |
| `src/aggregation/materializer.ts` | Debounced materialization of results as entities |
| `src/aggregation/timeWindows.ts` | Time bucketing and bucket range parsing |
| `src/aggregation/index.ts` | Module exports |
| `src/types/brainy.types.ts` | Type definitions for all aggregation interfaces |
