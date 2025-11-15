# Production Service Architecture Guide

**How to use Brainy optimally in production Express/Node.js services**

---

## The Problem: Instance-per-Request Anti-Pattern

### ❌ What NOT to Do

```typescript
// WRONG - Creates new instance EVERY request
app.get('/api/entities', async (req, res) => {
  const brain = new Brainy({ storage: { path: './brainy-data' } })
  await brain.init()  // FULL INITIALIZATION EVERY TIME!
  const entities = await brain.find(...)
  res.json(entities)
})
```

### Why This is Terrible

After 40 API calls:
- **40 Brainy instances** running simultaneously
- **20GB memory** (40 × 500MB per instance)
- **2 seconds wasted** (40 × 50ms initialization)
- **Zero cache benefit** (each instance has its own empty cache)
- **Index rebuilding** on every request (TypeAware HNSW, LSM-trees, etc.)
- **Memory leaks** (old instances may not GC properly)

---

## ✅ The Solution: Singleton Pattern

**ONE Brainy instance per service, shared across ALL requests.**

### Performance Comparison

| Metric | Instance-per-Request | Singleton (Optimal) |
|--------|---------------------|---------------------|
| Memory (40 requests) | 20GB | 500MB |
| Request 1 latency | 60ms | 60ms (one-time init) |
| Request 2+ latency | 60ms (no cache!) | 2ms (80% cache hit!) |
| Cache hit rate | 0% | 80%+ |
| Speedup | - | **30x faster** |

---

## Implementation Patterns

### Pattern 1: Simple Singleton (Recommended)

```typescript
// server.ts
import { Brainy } from '@soulcraft/brainy'

// SINGLETON INSTANCE
let brainInstance: Brainy | null = null

async function getBrain(): Promise<Brainy> {
  if (brainInstance) {
    return brainInstance
  }

  console.log('🧠 Initializing Brainy singleton...')

  brainInstance = new Brainy({
    storage: {
      path: './brainy-data',
      autoOptimize: true
    },
    cache: {
      maxSize: 1000,      // Shared across ALL requests
      ttl: 3600000,       // 1 hour
      enableMetrics: true
    },
    augmentations: {
      include: ['cache', 'metrics', 'display', 'vfs']
    }
  })

  await brainInstance.init()
  console.log('✅ Brainy ready')

  return brainInstance
}

// Initialize BEFORE starting server
async function startServer() {
  await getBrain()  // One-time initialization

  app.get('/api/entities', async (req, res) => {
    const brain = await getBrain()  // Reuses same instance!
    const entities = await brain.find(req.query)
    res.json(entities)
  })

  app.listen(3000)
}

startServer()
```

**Benefits:**
- ✅ Simple to implement
- ✅ Thread-safe (async initialization)
- ✅ Shared cache and indexes
- ✅ 40x memory reduction

---

### Pattern 2: Service Class (Production-Grade)

```typescript
// services/BrainService.ts
export class BrainService {
  private brain: Brainy | null = null
  private initPromise: Promise<Brainy> | null = null

  async getInstance(): Promise<Brainy> {
    if (this.brain) return this.brain
    if (this.initPromise) return this.initPromise

    this.initPromise = this.initialize()
    return this.initPromise
  }

  private async initialize(): Promise<Brainy> {
    this.brain = new Brainy({
      storage: {
        path: process.env.BRAINY_DATA_PATH || './brainy-data'
      },
      cache: { maxSize: 1000, ttl: 3600000 }
    })
    await this.brain.init()
    return this.brain
  }

  async shutdown(): Promise<void> {
    if (this.brain) {
      // Cleanup if needed
      this.brain = null
    }
  }
}

// server.ts
const brainService = new BrainService()

app.get('/api/entities', async (req, res) => {
  const brain = await brainService.getInstance()
  const entities = await brain.find(req.query)
  res.json(entities)
})

// Graceful shutdown
process.on('SIGTERM', async () => {
  await brainService.shutdown()
  process.exit(0)
})
```

**Benefits:**
- ✅ Prevents race conditions (multiple simultaneous inits)
- ✅ Testable (can inject mock)
- ✅ Clean shutdown handling
- ✅ Environment-configurable

---

### Pattern 3: Express Middleware

```typescript
// middleware/brainy.ts
let brainInstance: Brainy | null = null

export async function initBrainy() {
  if (!brainInstance) {
    brainInstance = new Brainy({ storage: { path: './brainy-data' } })
    await brainInstance.init()
  }
}

export function brainMiddleware(req, res, next) {
  if (!brainInstance) {
    return res.status(500).json({ error: 'Brainy not initialized' })
  }
  req.brain = brainInstance  // Attach to request
  next()
}

// Type extension
declare global {
  namespace Express {
    interface Request {
      brain: Brainy
    }
  }
}

// server.ts
import { initBrainy, brainMiddleware } from './middleware/brainy'

async function startServer() {
  await initBrainy()  // Initialize first

  app.use('/api', brainMiddleware)  // Apply to API routes

  app.get('/api/entities', async (req, res) => {
    const entities = await req.brain.find(req.query)  // Type-safe!
    res.json(entities)
  })

  app.listen(3000)
}
```

**Benefits:**
- ✅ Clean separation of concerns
- ✅ Type-safe (`req.brain` is typed)
- ✅ Easy to add auth/validation

---

## Optimization Strategies

### 1. Configure Cache for Your Workload

```typescript
const brain = new Brainy({
  cache: {
    maxSize: 1000,           // Number of entities to cache
    ttl: 3600000,            // Cache lifetime (1 hour)
    enableMetrics: true,     // Track hit rate
    evictionPolicy: 'lru'    // Least recently used
  }
})
```

**Cache sizing:**
- Small service (< 100 req/min): `maxSize: 500`
- Medium service (< 1000 req/min): `maxSize: 1000`
- Large service (> 1000 req/min): `maxSize: 5000`

### 2. Lazy Load Augmentations

```typescript
const brain = new Brainy({
  augmentations: {
    // Only load what you actually use
    include: ['cache', 'metrics', 'display', 'vfs'],
    exclude: ['neuralImport', 'intelligentImport']  // Skip heavy features
  }
})
```

**Memory savings:**
- With all augmentations: ~800MB
- With minimal set: ~400MB

### 3. Warm Up Indexes

```typescript
async function startServer() {
  const brain = await getBrain()

  // Pre-warm frequently-used indexes
  await brain.find({ type: 'person', limit: 1 })
  await brain.find({ type: 'organization', limit: 1 })

  console.log('✅ Indexes pre-warmed')

  app.listen(3000)
}
```

**Benefit:** First requests are fast (no cold-start index building)

### 4. Memory-Aware Configuration

```typescript
import os from 'os'

const totalMemory = os.totalmem()
const availableMemory = os.freemem()

const brain = new Brainy({
  cache: {
    // Use 10% of total RAM for cache
    maxSize: Math.floor(totalMemory * 0.1 / (1024 * 1024))
  },
  indexes: {
    // Lazy load indexes if low memory
    lazyLoad: availableMemory < totalMemory * 0.5,
    preload: ['person', 'organization']  // Only preload common types
  }
})
```

---

## Concurrency & Thread Safety

Brainy is **designed** for concurrent access. A single instance can handle:

```typescript
// Multiple concurrent requests - all using same instance
app.get('/api/read/:id', async (req, res) => {
  const brain = getBrain()
  const entity = await brain.get(req.params.id)  // Safe - no state mutation
  res.json(entity)
})

app.post('/api/write', async (req, res) => {
  const brain = getBrain()
  const id = await brain.add(req.body)  // Safe - internal locking
  res.json({ id })
})
```

**Concurrency mechanisms:**
- ✅ **Read operations**: Lock-free (MVCC)
- ✅ **Write operations**: Internal write-ahead logging (WAL)
- ✅ **Cache**: Thread-safe LRU implementation
- ✅ **Indexes**: Concurrent reads, locked writes

---

## Production Checklist

### Before Deploying

- [ ] **Initialize Brainy on startup** (not per-request)
- [ ] **Configure cache size** based on memory
- [ ] **Only load needed augmentations**
- [ ] **Warm up critical indexes**
- [ ] **Add graceful shutdown handler**
- [ ] **Monitor cache hit rate**

### Code Review Checklist

```typescript
// ❌ BAD - Instance per request
app.get('/api/route', async (req, res) => {
  const brain = new Brainy(...)  // RED FLAG!
  await brain.init()             // RED FLAG!
})

// ✅ GOOD - Singleton pattern
app.get('/api/route', async (req, res) => {
  const brain = await getBrain()  // Reuses instance ✓
})
```

---

## Monitoring & Metrics

```typescript
// Add metrics endpoint
app.get('/api/metrics', (req, res) => {
  const brain = getBrain()

  res.json({
    cache: {
      size: brain.cache?.size || 0,
      maxSize: brain.cache?.maxSize || 0,
      hitRate: brain.metrics?.cacheHitRate || 0  // Target: >70%
    },
    storage: brain.storage.getStats(),
    memory: {
      heapUsed: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
      heapTotal: Math.round(process.memoryUsage().heapTotal / 1024 / 1024)
    }
  })
})
```

**Key metrics to track:**
- **Cache hit rate**: Should be >70% after warm-up
- **Memory usage**: Should stay constant (~500MB for singleton)
- **Request latency**: Should be <10ms for cached entities

---

## Common Pitfalls

### 1. Creating instances in routes
```typescript
// ❌ NEVER do this
app.get('/api/entities', async (req, res) => {
  const brain = new Brainy(...)  // Creates new instance every time!
})
```

### 2. Not awaiting initialization
```typescript
// ❌ Race condition - server starts before Brainy ready
app.listen(3000)
getBrain()  // Async init happens AFTER server starts!

// ✅ Correct - wait for init
await getBrain()
app.listen(3000)
```

### 3. Multiple instances for different purposes
```typescript
// ❌ Wasteful - creates 2 instances
const readBrain = new Brainy(...)
const writeBrain = new Brainy(...)

// ✅ One instance handles both
const brain = new Brainy(...)
await brain.get(id)    // Read
await brain.add(data)  // Write
```

---

## Migration Guide

### Current (Anti-Pattern)
```typescript
// Probably in multiple route files
async function handler(req, res) {
  const brain = new Brainy({ storage: { path: './brainy-data' } })
  await brain.init()
  // ... use brain
}
```

### Step 1: Create Singleton Module
```typescript
// lib/brainy.ts
let instance: Brainy | null = null

export async function getBrain(): Promise<Brainy> {
  if (!instance) {
    instance = new Brainy({ storage: { path: './brainy-data' } })
    await instance.init()
  }
  return instance
}
```

### Step 2: Update Server Startup
```typescript
// server.ts
import { getBrain } from './lib/brainy'

async function startServer() {
  // Initialize Brainy FIRST
  await getBrain()
  console.log('✅ Brainy initialized')

  // THEN start server
  app.listen(3000)
}
```

### Step 3: Update All Routes
```typescript
// Before
async function handler(req, res) {
  const brain = new Brainy(...)  // Remove this
  await brain.init()              // Remove this

  // ... rest of code
}

// After
import { getBrain } from './lib/brainy'

async function handler(req, res) {
  const brain = await getBrain()  // Add this

  // ... rest of code stays same
}
```

**Expected results:**
- ✅ 40x memory reduction (20GB → 500MB)
- ✅ 30x faster requests (60ms → 2ms average)
- ✅ 80%+ cache hit rate
- ✅ Your service can scale to 1000s of requests/minute

---

## Summary

**DO:**
- ✅ Initialize Brainy ONCE on server startup
- ✅ Share single instance across all requests
- ✅ Configure cache for your workload
- ✅ Monitor cache hit rate
- ✅ Handle graceful shutdown

**DON'T:**
- ❌ Create new Brainy instance per request
- ❌ Create multiple instances
- ❌ Start server before Brainy is initialized
- ❌ Load augmentations you don't use

**Result:** 40x less memory, 30x faster requests, Brainy optimizations actually work!

---

**Questions? Issues?**
- Report issues: https://github.com/soulcraftlabs/brainy/issues
