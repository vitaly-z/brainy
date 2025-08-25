# Brain Patterns Optimization Plan

## Brain Pattern Operators (Complete List)
1. **Equality**: `equals`, `is`, `eq`
2. **Comparison**: `greaterThan`/`gt`, `lessThan`/`lt`, `greaterEqual`/`gte`, `lessEqual`/`lte`
3. **Range**: `between` (inclusive range)
4. **Membership**: `oneOf`/`in` (value in list)
5. **Contains**: `contains` (for arrays)
6. **Existence**: `exists` (field exists)
7. **Negation**: `not` (logical NOT)
8. **Logical**: `allOf` (AND), `anyOf` (OR)

## Current Architecture Issues
- MetadataIndex: O(1) hash lookups ONLY
- No sorted indices for ranges
- TripleIntelligence: String-based filtering (">2020") - TERRIBLE
- No numeric type detection

## Optimization Strategy

### Phase 1: Sorted Index Infrastructure ✅ DONE
```typescript
interface SortedFieldIndex {
  values: Array<[value: any, ids: Set<string>]>
  isDirty: boolean
  fieldType: 'number' | 'string' | 'date' | 'mixed'
}
```

### Phase 2: Binary Search Implementation ✅ DONE
- O(log n) range boundary finding
- Support inclusive/exclusive ranges
- Handle all comparison operators

### Phase 3: Automatic Type Detection
- Detect numeric fields on first value
- Maintain appropriate sorting
- Convert strings to numbers when possible

### Phase 4: Query Optimization
- Pre-filter with metadata index BEFORE vector search
- Use sorted indices for ALL range queries
- Cache sorted indices in memory

## Performance Targets
- Exact match: O(1) - hash lookup
- Range query: O(log n + m) - binary search + result size
- Combined filters: O(k * log n) - k conditions
- Memory overhead: ~2x current (hash + sorted)

## Implementation Status
- [x] Add SortedFieldIndex type
- [x] Add binary search methods
- [x] Update getIdsForFilter for all operators
- [ ] Fix TripleIntelligence to use index directly
- [ ] Add index statistics/monitoring
- [ ] Optimize memory usage

## Expected Performance Gains
- Range queries: 100-1000x faster
- Combined vector+metadata: 10-50x faster
- Memory usage: +50% (acceptable tradeoff)