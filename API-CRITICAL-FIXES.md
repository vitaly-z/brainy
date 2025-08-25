# 🚨 CRITICAL API FIXES NEEDED FOR BRAINY 2.0

## 1. ❌ WRONG: MongoDB Operators (Legal Risk!)
We accidentally introduced MongoDB-style operators which we specifically avoided for legal reasons!

### MUST REPLACE:
```typescript
// ❌ WRONG (MongoDB style)
where: {
  field: {$in: [values]},
  field: {$gt: value},
  field: {$regex: pattern}
}

// ✅ CORRECT (Brainy style)
where: {
  field: {oneOf: [values]},
  field: {greaterThan: value},
  field: {matches: pattern}
}
```

### Complete Operator Mapping:
- `$eq` → `equals` or `is`
- `$ne` → `notEquals`
- `$gt` → `greaterThan`
- `$gte` → `greaterEqual`
- `$lt` → `lessThan`
- `$lte` → `lessEqual`
- `$in` → `oneOf`
- `$nin` → `notOneOf`
- `$regex` → `matches`
- `$contains` → `contains`
- (NEW) → `startsWith`
- (NEW) → `endsWith`
- (NEW) → `between`

## 2. 📊 Missing Neural API Features
The backup shows we had extensive neural capabilities:

```typescript
brain.neural.similar(a, b)         // Semantic similarity
brain.neural.clusters()            // Auto-clustering
brain.neural.hierarchy(id)         // Semantic hierarchy
brain.neural.neighbors(id)         // Neighbor graph
brain.neural.outliers()           // Outlier detection
brain.neural.semanticPath(a, b)   // Path finding
brain.neural.visualize()          // Visualization data
```

## 3. 🔄 Missing Triple Intelligence Features
We need to ensure Triple Intelligence has all its features:
- Query optimization
- Progressive filtering
- Parallel execution
- Query learning/caching
- Explanations

## 4. 🧩 Missing Augmentation Features
- Synapses (Notion, Slack, Salesforce connectors)
- Conduits (Brainy-to-Brainy sync)
- Real-time bidirectional sync

## 5. 📥 Missing Import/Export Features
- Neural import with entity extraction
- CSV import with AI parsing
- JSON flattening and structure detection
- Batch neural processing

## 6. 🎯 API Simplification Issues
While simplifying, we may have lost:
- Verb scoring intelligence
- Clustering management
- Performance monitoring
- Health checks
- Statistics collection

## 7. 🔍 Search Method Confusion
Need to clarify:
- `search(query)` = simple convenience for `find({like: query})`
- `find(query)` = full Triple Intelligence
- Remove duplicate methods like `searchByNounTypes`, etc.

## IMMEDIATE ACTIONS:
1. Replace ALL MongoDB operators with Brainy operators
2. Restore neural API with all methods
3. Ensure Triple Intelligence is complete
4. Verify augmentation system works
5. Test import/export capabilities
6. Document the clean API properly

## BACKUP LOCATIONS:
- `/home/dpsifr/Projects/BACKUP/brainy (Copy)` - Full backup
- `/home/dpsifr/Projects/BACKUP/brainy-clean` - Clean version
- `/home/dpsifr/Projects/brainy (Copy)` - Another backup