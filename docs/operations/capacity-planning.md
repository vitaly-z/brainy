# Capacity Planning & Operations Guide

**Brainy v3.36.0+ Enterprise Operations**

This guide provides production-ready capacity planning formulas, deployment strategies, and operational guidelines for scaling Brainy from development (2GB) to enterprise (128GB+) deployments.

---

## 📊 Quick Reference

### Memory Allocation Formula

```
totalAvailable = systemMemory × utilizationFactor
modelReservation = 150MB (Q8) or 250MB (FP32)
availableForCache = totalAvailable - modelReservation
cacheSize = availableForCache × environmentRatio

Where:
- utilizationFactor = 0.80 (leave 20% for OS and other processes)
- environmentRatio = 0.25 (dev), 0.40 (container), 0.50 (production)
```

### Adaptive Caching Strategy

```
estimatedVectorMemory = entityCount × 1536 bytes  // 384 dims × 4 bytes per float
hnswCacheBudget = cacheSize × 0.80  // 80% threshold for preloading decision

if estimatedVectorMemory < hnswCacheBudget:
    cachingStrategy = 'preloaded'  // All vectors loaded at init
else:
    cachingStrategy = 'on-demand'  // Vectors loaded adaptively via UnifiedCache
```

---

## 🎯 Deployment Scenarios

### Scenario 1: Development (2GB System)

**System Profile:**
- Total RAM: 2GB
- Environment: Local development
- Expected scale: 10K-50K entities

**Memory Breakdown:**
```
System Memory:        2048 MB
OS Reserved (20%):    -410 MB
Available:            1638 MB
Model Memory:         -140 MB
  ├─ WASM + Weights:  90 MB
  └─ Workspace:       50 MB
───────────────────────────
Available for Cache:  1488 MB
Dev Allocation (25%): 372 MB UnifiedCache
  ├─ HNSW (30%):      112 MB
  ├─ Metadata (40%):  149 MB
  ├─ Search (20%):    74 MB
  └─ Shared (10%):    37 MB
```

**Capacity:**
- **Standard Mode**: Up to 70K entities (all vectors in memory)
- **Lazy Mode**: Up to 500K entities (on-demand vector loading)
- **Search Latency**: 5-15ms (standard), 8-20ms (lazy, cold)

**Recommendations:**
- ✅ Use Q8 model for smaller footprint
- ✅ System uses adaptive caching for datasets >70K entities
- ✅ Monitor cache hit rate with `getCacheStats()`
- ⚠️ Expect slower performance vs production systems

**Configuration:**
```typescript
const brain = new Brainy({
  storage: { type: 'filesystem', path: './brainy-data' },
  model: { precision: 'q8' },
  cache: { /* auto-sized to 372MB */ }
})
```

---

### Scenario 2: Small Production (8GB System)

**System Profile:**
- Total RAM: 8GB
- Environment: Single production server
- Expected scale: 100K-500K entities

**Memory Breakdown:**
```
System Memory:        8192 MB
OS Reserved (20%):    -1638 MB
Available:            6554 MB
Model Memory (Q8):    -150 MB
───────────────────────────
Available for Cache:  6404 MB
Prod Allocation (50%): 3202 MB UnifiedCache
  ├─ HNSW (30%):      961 MB
  ├─ Metadata (40%):  1281 MB
  ├─ Search (20%):    640 MB
  └─ Shared (10%):    320 MB
```

**Capacity:**
- **Standard Mode**: Up to 600K entities
- **Lazy Mode**: Up to 5M entities
- **Search Latency**: 3-8ms (standard), 5-12ms (lazy, 80% hit rate)

**Recommendations:**
- ✅ Q8 model balances performance and memory
- ✅ Adaptive on-demand caching activates automatically at ~620K entities
- ✅ Monitor memory pressure warnings
- ✅ Consider horizontal scaling beyond 3M entities

**Configuration:**
```typescript
const brain = new Brainy({
  storage: { type: 'filesystem', path: '/var/lib/brainy' },
  model: { precision: 'q8' },
  // Auto-sized cache: 3202MB
})

// Monitor health
const stats = brain.hnsw.getCacheStats()
console.log(`Cache hit rate: ${stats.unifiedCache.hitRatePercent}%`)
console.log(`Caching strategy: ${stats.cachingStrategy}`)
```

---

### Scenario 3: Medium Production (32GB System)

**System Profile:**
- Total RAM: 32GB
- Environment: Production server or container
- Expected scale: 1M-10M entities

**Memory Breakdown:**
```
System Memory:        32768 MB
OS Reserved (20%):    -6554 MB
Available:            26214 MB
Model Memory (Q8):    -150 MB
───────────────────────────
Available for Cache:  26064 MB
Prod Allocation (50%): 13032 MB UnifiedCache
  ├─ HNSW (30%):      3910 MB
  ├─ Metadata (40%):  5213 MB
  ├─ Search (20%):    2606 MB
  └─ Shared (10%):    1303 MB
```

**Capacity:**
- **Standard Mode**: Up to 2.5M entities
- **Lazy Mode**: Up to 20M entities
- **Search Latency**: 2-5ms (standard), 3-8ms (lazy, 85% hit rate)

**Recommendations:**
- ✅ Consider FP32 model if accuracy is critical (adds 100MB)
- ✅ Enable GCS/S3 storage for durability
- ✅ Adaptive on-demand caching handles 10M+ entities efficiently
- ✅ Monitor fairness metrics to prevent HNSW cache hogging

**Configuration:**
```typescript
const brain = new Brainy({
  storage: {
    type: 'gcs-native',
    gcsNativeStorage: { bucketName: 'production-data' }
  },
  model: { precision: 'q8' }  // or 'fp32' for +0.5% accuracy
})

// Verify allocation
const memoryInfo = brain.hnsw.unifiedCache.getMemoryInfo()
console.log(`Cache allocated: ${Math.round(memoryInfo.memoryInfo.available / 1024 / 1024 / 1024)}GB`)
console.log(`Environment: ${memoryInfo.memoryInfo.environment}`)
```

---

### Scenario 4: Large Production (128GB System)

**System Profile:**
- Total RAM: 128GB
- Environment: Dedicated production server
- Expected scale: 10M-100M entities

**Memory Breakdown:**
```
System Memory:         131072 MB
OS Reserved (20%):     -26214 MB
Available:             104858 MB
Model Memory (FP32):   -250 MB
───────────────────────────────
Available for Cache:   104608 MB
Prod Allocation (50%): 52304 MB UnifiedCache (logarithmic scaling applies)
  ├─ HNSW (30%):       15691 MB
  ├─ Metadata (40%):   20922 MB
  ├─ Search (20%):     10461 MB
  └─ Shared (10%):     5230 MB
```

**Logarithmic Scaling Applied:**
For systems >64GB, allocation uses logarithmic scaling to prevent over-allocation:
```
effectiveRatio = baseRatio × (1 + log10(systemGB / 64) × 0.15)
Actual cache size: ~40GB (prevents waste on 128GB systems)
```

**Capacity:**
- **Standard Mode**: Up to 10M entities
- **Lazy Mode**: Up to 100M+ entities
- **Search Latency**: 1-3ms (standard), 2-5ms (lazy, 90%+ hit rate)

**Recommendations:**
- ✅ Use FP32 model for maximum accuracy
- ✅ Enable distributed storage (S3/GCS)
- ✅ Monitor fairness violations (HNSW shouldn't dominate cache)
- ✅ Consider sharding beyond 50M entities
- ✅ Implement application-level caching for hot queries

**Configuration:**
```typescript
const brain = new Brainy({
  storage: {
    type: 's3',
    s3Storage: {
      bucketName: 'enterprise-data',
      region: 'us-east-1'
    }
  },
  model: { precision: 'fp32' }  // Maximum accuracy
})

// Enterprise monitoring
setInterval(() => {
  const stats = brain.hnsw.getCacheStats()

  if (stats.fairness.fairnessViolation) {
    console.warn('FAIRNESS VIOLATION: HNSW using too much cache')
    console.warn(`HNSW: ${stats.fairness.hnswAccessPercent}% access, ${stats.hnswCache.sizePercent}% size`)
  }

  if (stats.unifiedCache.hitRatePercent < 75) {
    console.warn(`Low cache hit rate: ${stats.unifiedCache.hitRatePercent}%`)
    console.warn('Recommendations:', stats.recommendations)
  }
}, 60000)  // Check every minute
```

---

## 🐳 Container Deployments (Docker/Kubernetes)

### Container Memory Detection

Brainy auto-detects container memory limits via cgroups v1/v2:

```typescript
// Automatic detection
const brain = new Brainy()  // Detects cgroup limits automatically

// Verify detection
const memoryInfo = brain.hnsw.unifiedCache.getMemoryInfo()
console.log(`Container: ${memoryInfo.memoryInfo.isContainer}`)
console.log(`Source: ${memoryInfo.memoryInfo.source}`)  // 'cgroup-v2' or 'cgroup-v1'
console.log(`Limit: ${Math.round(memoryInfo.memoryInfo.available / 1024 / 1024)}MB`)
```

### Docker Resource Limits

**Small Container (2GB)**
```dockerfile
FROM node:22-alpine

WORKDIR /app
COPY package*.json ./
RUN npm ci --production

COPY . .

# Download models at build time
RUN npm run download-models

ENV NODE_OPTIONS="--max-old-space-size=1536"

CMD ["node", "dist/index.js"]
```

```bash
docker run \
  --memory="2g" \
  --memory-reservation="1.5g" \
  --cpus="2" \
  my-brainy-app
```

**Expected allocation:**
```
Container Limit:      2048 MB
Available:            1638 MB (80% usable)
Model Memory:         -150 MB
Available for Cache:  1488 MB
Container Ratio (40%): 595 MB UnifiedCache
```

**Medium Container (8GB)**
```bash
docker run \
  --memory="8g" \
  --memory-reservation="6g" \
  --cpus="4" \
  -e NODE_OPTIONS="--max-old-space-size=6144" \
  my-brainy-app
```

**Expected allocation:**
```
Container Limit:      8192 MB
Available:            6554 MB
Model Memory:         -150 MB
Available for Cache:  6404 MB
Container Ratio (40%): 2562 MB UnifiedCache
```

### Kubernetes Resource Requests/Limits

**Small Pod (2GB)**
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: brainy-api
spec:
  replicas: 3
  template:
    spec:
      containers:
      - name: brainy
        image: my-brainy-app:latest
        resources:
          requests:
            memory: "1.5Gi"
            cpu: "500m"
          limits:
            memory: "2Gi"
            cpu: "1000m"
        env:
        - name: NODE_OPTIONS
          value: "--max-old-space-size=1536"
```

**Medium Pod (8GB)**
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: brainy-api
spec:
  replicas: 2
  template:
    spec:
      containers:
      - name: brainy
        image: my-brainy-app:latest
        resources:
          requests:
            memory: "6Gi"
            cpu: "2000m"
          limits:
            memory: "8Gi"
            cpu: "4000m"
        env:
        - name: NODE_OPTIONS
          value: "--max-old-space-size=6144"
```

**Best Practices:**
- ✅ Set `requests` to 75% of `limits` for better scheduling
- ✅ Download models at Docker build time (not runtime)
- ✅ Use `NODE_OPTIONS` to match container memory limits
- ✅ Monitor actual usage and adjust based on workload

---

## 📈 Scaling Strategies

### Adaptive Caching Behavior

The system automatically chooses the optimal caching strategy:
- ✅ **Preloaded**: Small datasets (<80% of cache) - all vectors loaded at init for zero-latency access
- ✅ **On-demand**: Large datasets (>80% of cache) - vectors loaded adaptively via UnifiedCache
- ✅ No configuration needed - system adapts automatically based on dataset size

**Auto-detection logic:**
```typescript
const vectorMemoryNeeded = entityCount × 1536  // bytes
const hnswCacheAvailable = unifiedCache.maxSize × 0.80

if (vectorMemoryNeeded < hnswCacheAvailable) {
  // Preload strategy: all vectors loaded at init
  console.log('Caching strategy: preloaded (all vectors in memory)')
} else {
  // On-demand strategy: vectors loaded adaptively
  console.log('Caching strategy: on-demand (adaptive loading via UnifiedCache)')
}
```

### When to Add More RAM

Consider increasing RAM when:
- ⚠️ Cache hit rate consistently < 70%
- ⚠️ Memory pressure warnings > 85% utilization
- ⚠️ Search latency > 20ms on hot paths
- ⚠️ On-demand caching active but working set is large

**Decision tree:**
```
If cache hit rate < 70%:
  └─> Is working set < 50% of total entities?
      ├─> YES: Increase cache size (add RAM)
      └─> NO: Working set too large, consider:
          ├─> Application-level caching
          ├─> Query optimization
          └─> Sharding dataset
```

### When to Shard/Distribute

Consider sharding when:
- ⚠️ Entity count > 50M entities on single node
- ⚠️ Write throughput > 10K ops/sec
- ⚠️ Need geographic distribution
- ⚠️ Fault tolerance requirements

**Sharding strategy:**
```typescript
// Example: Geographic sharding
const usEastBrain = new Brainy({
  storage: { type: 's3', s3Storage: { bucket: 'us-east-data' } }
})

const euWestBrain = new Brainy({
  storage: { type: 's3', s3Storage: { bucket: 'eu-west-data' } }
})

// Route queries based on user location
async function search(query, userRegion) {
  const brain = userRegion === 'US' ? usEastBrain : euWestBrain
  return await brain.search(query)
}
```

---

## 🔍 Monitoring & Diagnostics

### Key Metrics to Track

**1. Cache Performance**
```typescript
const stats = brain.hnsw.getCacheStats()

// Cache hit rate (target: >80%)
console.log(`Hit rate: ${stats.unifiedCache.hitRatePercent}%`)

// HNSW cache utilization
console.log(`HNSW memory: ${stats.hnswCache.estimatedMemoryMB}MB`)
console.log(`HNSW hit rate: ${stats.hnswCache.hitRatePercent}%`)
```

**2. Memory Pressure**
```typescript
const memoryInfo = brain.hnsw.unifiedCache.getMemoryInfo()

console.log(`Pressure: ${memoryInfo.currentPressure.pressure}`)
// Values: 'low', 'moderate', 'high', 'critical'

if (memoryInfo.currentPressure.warnings.length > 0) {
  console.warn('Memory warnings:', memoryInfo.currentPressure.warnings)
}
```

**3. Fairness Metrics**
```typescript
const stats = brain.hnsw.getCacheStats()

if (stats.fairness.fairnessViolation) {
  console.warn('Cache fairness violation detected')
  console.warn(`HNSW: ${stats.fairness.hnswAccessPercent}% access`)
  console.warn(`HNSW: ${stats.hnswCache.sizePercent}% of cache`)
}
```

**4. Query Performance**
```typescript
// Track search latency
console.time('search')
const results = await brain.search('query')
console.timeEnd('search')  // Target: <10ms for hot queries
```

### Alerting Thresholds

Set up alerts for:
- ⚠️ Cache hit rate < 70% (sustained for 5+ minutes)
- 🚨 Memory utilization > 90%
- 🚨 Search latency > 50ms (p95)
- ⚠️ Fairness violations detected

**Example monitoring script:**
```typescript
async function monitorHealth() {
  const stats = brain.hnsw.getCacheStats()

  // Alert on low cache hit rate
  if (stats.unifiedCache.hitRatePercent < 70) {
    await sendAlert({
      severity: 'warning',
      message: `Low cache hit rate: ${stats.unifiedCache.hitRatePercent}%`,
      recommendations: stats.recommendations
    })
  }

  // Alert on memory pressure
  const memoryInfo = brain.hnsw.unifiedCache.getMemoryInfo()
  if (memoryInfo.currentPressure.pressure === 'high') {
    await sendAlert({
      severity: 'critical',
      message: 'High memory pressure detected',
      warnings: memoryInfo.currentPressure.warnings
    })
  }
}

// Run every 60 seconds
setInterval(monitorHealth, 60000)
```

---

## 🎯 Real-World Examples

### Example 1: E-Commerce Product Catalog (500K products)

**System:** 16GB production server

**Sizing:**
```
Products:              500,000
Vector memory needed:  500K × 1536 bytes = 768 MB
HNSW cache available:  (16GB × 0.8 - 150MB) × 0.5 × 0.3 = 1,915 MB

Result: Standard mode (all vectors fit in HNSW cache)
```

**Configuration:**
```typescript
const brain = new Brainy({
  storage: { type: 'filesystem', path: '/var/lib/brainy' },
  model: { precision: 'q8' }
})

await brain.init()

// Verify preloaded strategy (all vectors in memory)
const stats = brain.hnsw.getCacheStats()
console.log(`Caching strategy: ${stats.cachingStrategy}`)  // 'preloaded'
console.log(`Search latency: ${stats.performance.avgSearchMs}ms`)  // ~3ms
```

### Example 2: Document Search (5M documents)

**System:** 32GB production server with GCS storage

**Sizing:**
```
Documents:             5,000,000
Vector memory needed:  5M × 1536 bytes = 7,680 MB
HNSW cache available:  (32GB × 0.8 - 150MB) × 0.5 × 0.3 = 3,910 MB

Result: On-demand caching (vectors loaded adaptively)
```

**Configuration:**
```typescript
const brain = new Brainy({
  storage: {
    type: 'gcs-native',
    gcsNativeStorage: { bucketName: 'docs-production' }
  },
  model: { precision: 'q8' }
})

await brain.init()

// Monitor cache performance
const stats = brain.hnsw.getCacheStats()
console.log(`Caching strategy: ${stats.cachingStrategy}`)  // 'on-demand'
console.log(`Cache hit rate: ${stats.unifiedCache.hitRatePercent}%`)  // Target >80%
console.log(`Cold search latency: ${stats.performance.avgSearchMs}ms`)  // ~12ms

// Recommendations
console.log('Recommendations:', stats.recommendations)
// Example: "Cache hit rate healthy at 84.2% - no action needed"
```

### Example 3: Knowledge Graph (20M entities)

**System:** 128GB dedicated server with S3 storage

**Sizing:**
```
Entities:              20,000,000
Vector memory needed:  20M × 1536 bytes = 30,720 MB
HNSW cache available:  ~15,691 MB (after logarithmic scaling)

Result: On-demand caching with high-performance adaptive loading
```

**Configuration:**
```typescript
const brain = new Brainy({
  storage: {
    type: 's3',
    s3Storage: {
      bucketName: 'knowledge-graph-prod',
      region: 'us-east-1'
    }
  },
  model: { precision: 'fp32' }  // Maximum accuracy
})

await brain.init()

// Enterprise monitoring
const stats = brain.hnsw.getCacheStats()
console.log(`Entities: ${stats.autoDetection.entityCount.toLocaleString()}`)
console.log(`Caching strategy: ${stats.cachingStrategy}`)  // 'on-demand'
console.log(`Cache hit rate: ${stats.unifiedCache.hitRatePercent}%`)  // Target >85%
console.log(`HNSW cache: ${stats.hnswCache.estimatedMemoryMB}MB`)

// Fairness check
if (stats.fairness.fairnessViolation) {
  console.warn('HNSW dominating cache - consider tuning eviction policies')
}
```

---

## 🛠️ Troubleshooting

### Issue: Low Cache Hit Rate (<70%)

**Diagnosis:**
```typescript
const stats = brain.hnsw.getCacheStats()
console.log(`Hit rate: ${stats.unifiedCache.hitRatePercent}%`)
console.log(`Working set: ${stats.hnswCache.estimatedMemoryMB}MB`)
```

**Solutions:**
1. **Increase cache size** (add RAM)
2. **Optimize query patterns** (reduce random access)
3. **Implement application-level caching**
4. **Consider sharding if working set > available cache**

### Issue: High Memory Pressure (>85%)

**Diagnosis:**
```typescript
const memoryInfo = brain.hnsw.unifiedCache.getMemoryInfo()
console.log(`Pressure: ${memoryInfo.currentPressure.pressure}`)
console.log(`Warnings:`, memoryInfo.currentPressure.warnings)
```

**Solutions:**
1. **Reduce cache size manually** (override auto-detection)
2. **Reduce entity count** (archive old data - system automatically uses on-demand caching for large datasets)
3. **Increase system RAM**

### Issue: Fairness Violations

**Diagnosis:**
```typescript
const stats = brain.hnsw.getCacheStats()
if (stats.fairness.fairnessViolation) {
  console.log(`HNSW access: ${stats.fairness.hnswAccessPercent}%`)
  console.log(`HNSW cache: ${stats.hnswCache.sizePercent}%`)
}
```

**Solutions:**
1. **Contact support** (fairness policies may need tuning)
2. **Monitor over time** (may self-correct as access patterns stabilize)
3. **File GitHub issue** with diagnostics

---

## 📚 Additional Resources

- **[Migration Guide](../guides/migration-3.36.0.md)** - Upgrading to v3.36.0
- **[Architecture Overview](../architecture/data-storage-architecture.md)** - Deep dive into storage and caching
- **[GitHub Issues](https://github.com/soulcraftlabs/brainy/issues)** - Report problems or ask questions

---

**Production-ready. Enterprise-scale. Zero-config.** 🚀
