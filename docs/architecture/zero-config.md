# Zero Configuration & Auto-Adaptation

> **Current Status**: Basic zero-config is fully functional. Advanced auto-adaptation features are in development.

## Overview

Brainy is designed with **"Zero Config by Default, Infinite Tunability"** philosophy. It automatically detects your environment, adapts to available resources, learns from usage patterns, and optimizes itself for your specific workload—all without any configuration.

## Zero Configuration Magic

### Instant Start

```typescript
import { BrainyData } from 'brainy'

// That's it. No config needed.
const brain = new BrainyData()
await brain.init()

// Brainy automatically:
// ✓ Detects environment (Node.js, Browser, Edge, Deno)
// ✓ Chooses optimal storage (FileSystem, OPFS, Memory)
// ✓ Downloads required models (if needed)
// ✓ Configures vector dimensions (384 optimal)
// ✓ Sets up indexing strategies
// ✓ Enables appropriate augmentations
// ✓ Configures caching layers
// ✓ Optimizes for your hardware
```

### Environment Detection ✅ Available

Brainy automatically detects and adapts to your runtime:

```typescript
// Brainy's environment detection
const environment = {
  // Runtime detection
  isNode: typeof process !== 'undefined',
  isBrowser: typeof window !== 'undefined',
  isDeno: typeof Deno !== 'undefined',
  isEdge: typeof EdgeRuntime !== 'undefined',
  isWebWorker: typeof WorkerGlobalScope !== 'undefined',
  
  // Capability detection
  hasFileSystem: /* auto-detected */,
  hasIndexedDB: /* auto-detected */,
  hasOPFS: /* auto-detected */,
  hasWebGPU: /* auto-detected */,
  hasWASM: /* auto-detected */,
  
  // Resource detection
  cpuCores: /* auto-detected */,
  memory: /* auto-detected */,
  storage: /* auto-detected */
}
```

## Auto-Adaptive Storage ✅ Available

> **Current**: Brainy automatically selects the best storage adapter for your environment.

### Storage Selection Logic

```typescript
// Brainy's intelligent storage selection
async function autoSelectStorage() {
  // Server environments
  if (environment.isNode) {
    if (await hasWritePermission('./data')) {
      return 'filesystem'  // Best for servers
    } else if (process.env.S3_BUCKET) {
      return 's3'  // Cloud deployment
    } else {
      return 'memory'  // Fallback for restricted environments
    }
  }
  
  // Browser environments
  if (environment.isBrowser) {
    if (await navigator.storage.estimate() > 1GB) {
      return 'opfs'  // Best for modern browsers
    } else if (indexedDB) {
      return 'indexeddb'  // Fallback for older browsers
    } else {
      return 'memory'  // In-memory for restricted contexts
    }
  }
  
  // Edge environments
  if (environment.isEdge) {
    return 'kv'  // Use edge KV stores (Cloudflare, Vercel)
  }
}
```

### Storage Migration

Brainy seamlessly migrates between storage types:

```typescript
// Start with memory storage (development)
const brain = new BrainyData()  // Auto-selects memory

// Later, migrate to production storage
await brain.migrate({
  to: 'filesystem',
  path: './production-data'
})
// All data seamlessly transferred
```

## Learning & Optimization 🚧 Coming Soon

> **Note**: These features are planned for Q2 2025. Currently, Brainy uses static optimizations.

### Query Pattern Learning 🚧 Planned

Brainy learns from your query patterns and optimizes accordingly:

```typescript
// Brainy observes query patterns
class QueryPatternLearner {
  analyze(queries: Query[]) {
    return {
      // Frequency analysis
      mostCommonFields: this.getTopFields(queries),
      avgResultSize: this.getAvgSize(queries),
      temporalPatterns: this.getTimePatterns(queries),
      
      // Relationship analysis  
      commonTraversals: this.getGraphPatterns(queries),
      typicalDepth: this.getAvgDepth(queries),
      
      // Performance analysis
      slowQueries: this.getSlowQueries(queries),
      cacheability: this.getCacheability(queries)
    }
  }
}

// Automatic optimizations based on learning:
// - Creates indexes for frequently queried fields
// - Pre-computes common graph traversals
// - Adjusts cache sizes based on working set
// - Optimizes vector search parameters
```

### Auto-Indexing 🚧 Planned

Brainy automatically creates indexes based on usage:

```typescript
// No manual index configuration needed
await brain.find({ where: { category: "tech" } })  // First query
// Brainy notices 'category' field usage

await brain.find({ where: { category: "science" } })  // Second query
// Pattern detected - auto-creates category index

await brain.find({ where: { category: "tech" } })  // Third query
// Now using index - 100x faster!
```

### Adaptive Caching 🚧 Planned

Cache strategies adapt to your access patterns:

```typescript
class AdaptiveCache {
  async adapt(metrics: AccessMetrics) {
    if (metrics.hitRate < 0.3) {
      // Low hit rate - switch strategy
      this.strategy = 'lfu'  // Least Frequently Used
    } else if (metrics.workingSet > this.size) {
      // Working set too large - increase size
      this.size = Math.min(metrics.workingSet * 1.5, maxMemory)
    } else if (metrics.temporalLocality > 0.8) {
      // High temporal locality - use time-based eviction
      this.strategy = 'ttl'
      this.ttl = metrics.avgAccessInterval * 2
    }
  }
}
```

## Performance Auto-Scaling 🚧 Coming Soon

### Dynamic Batch Sizing

Brainy adjusts batch sizes based on system load:

```typescript
class DynamicBatcher {
  calculateOptimalBatch() {
    const cpuUsage = process.cpuUsage()
    const memoryUsage = process.memoryUsage()
    
    if (cpuUsage < 30 && memoryUsage < 50) {
      return 1000  // System idle - large batches
    } else if (cpuUsage < 60 && memoryUsage < 70) {
      return 100   // Moderate load - medium batches
    } else {
      return 10    // High load - small batches
    }
  }
}

// Automatically applied during bulk operations
for (const item of millionItems) {
  await brain.add(item)  // Internally batched optimally
}
```

### Memory Management

Automatic memory pressure handling:

```typescript
class MemoryManager {
  async handlePressure() {
    const usage = process.memoryUsage()
    const available = os.freemem()
    
    if (available < 100 * 1024 * 1024) {  // Less than 100MB free
      // Emergency mode
      await this.flushCaches()
      await this.compactIndexes()
      await this.offloadToDisk()
    } else if (usage.heapUsed / usage.heapTotal > 0.9) {
      // Preventive mode
      await this.reduceCacheSizes()
      await this.pauseBackgroundTasks()
    }
  }
}
```

### Connection Pooling

Automatic connection management for storage backends:

```typescript
class ConnectionPool {
  async getOptimalPoolSize() {
    // Adapts based on workload
    const metrics = await this.getMetrics()
    
    if (metrics.waitTime > 100) {
      // Queries waiting - increase pool
      this.size = Math.min(this.size * 1.5, this.maxSize)
    } else if (metrics.idleConnections > this.size * 0.5) {
      // Too many idle - decrease pool
      this.size = Math.max(this.size * 0.7, this.minSize)
    }
    
    return this.size
  }
}
```

## Model Auto-Selection

### Embedding Model Selection

Brainy chooses the best embedding model for your use case:

```typescript
async function autoSelectModel(data: Sample[]) {
  const analysis = {
    languages: detectLanguages(data),
    domainSpecific: detectDomain(data),
    averageLength: getAvgLength(data),
    requiresMultilingual: languages.length > 1
  }
  
  if (analysis.requiresMultilingual) {
    return 'multilingual-e5-base'  // Handles 100+ languages
  } else if (analysis.domainSpecific === 'code') {
    return 'codebert-base'  // Optimized for code
  } else if (analysis.averageLength > 512) {
    return 'all-mpnet-base-v2'  // Better for long text
  } else {
    return 'all-MiniLM-L6-v2'  // Fast and efficient default
  }
}
```

### Model Downloading

Models are automatically downloaded when needed:

```typescript
// First use - model auto-downloads
const brain = new BrainyData()
await brain.init()  // Downloads model if not cached

// Intelligent model caching
const modelCache = {
  location: process.env.MODEL_CACHE || '~/.brainy/models',
  maxSize: 5 * 1024 * 1024 * 1024,  // 5GB max
  strategy: 'lru',  // Least recently used eviction
  
  // CDN selection based on location
  cdn: await selectFastestCDN([
    'https://cdn.brainy.io',
    'https://brainy.b-cdn.net',
    'https://models.huggingface.co'
  ])
}
```

## Workload Detection

### Pattern Recognition

Brainy identifies your workload type and optimizes:

```typescript
enum WorkloadType {
  OLTP = 'oltp',  // Many small transactions
  OLAP = 'olap',  // Analytical queries
  STREAMING = 'streaming',  // Real-time ingestion
  BATCH = 'batch',  // Bulk processing
  HYBRID = 'hybrid'  // Mixed workload
}

class WorkloadDetector {
  detect(metrics: OperationMetrics): WorkloadType {
    if (metrics.writesPerSecond > 1000 && metrics.avgWriteSize < 1024) {
      return WorkloadType.STREAMING
    } else if (metrics.avgQueryComplexity > 0.8 && metrics.avgResultSize > 10000) {
      return WorkloadType.OLAP
    } else if (metrics.batchOperations > metrics.singleOperations) {
      return WorkloadType.BATCH
    } else if (metrics.writeReadRatio > 0.3 && metrics.writeReadRatio < 0.7) {
      return WorkloadType.HYBRID
    } else {
      return WorkloadType.OLTP
    }
  }
}
```

### Optimization Strategies

Different optimizations for different workloads:

```typescript
class WorkloadOptimizer {
  optimize(workload: WorkloadType) {
    switch (workload) {
      case WorkloadType.STREAMING:
        return {
          entityRegistry: true,  // Deduplication
          batchSize: 1000,
          walEnabled: true,
          cacheSize: 'small',
          indexStrategy: 'lazy'
        }
        
      case WorkloadType.OLAP:
        return {
          entityRegistry: false,
          batchSize: 10000,
          walEnabled: false,
          cacheSize: 'large',
          indexStrategy: 'eager',
          parallelQueries: true
        }
        
      case WorkloadType.BATCH:
        return {
          entityRegistry: false,
          batchSize: 50000,
          walEnabled: false,
          cacheSize: 'minimal',
          indexStrategy: 'deferred'
        }
        
      default:
        return this.defaultConfig
    }
  }
}
```

## Hardware Adaptation 🚧 Coming Soon

> **Note**: GPU acceleration and hardware optimization planned for Q3 2025.

### CPU Optimization

Adapts to available CPU resources:

```typescript
class CPUAdapter {
  async optimize() {
    const cores = os.cpus().length
    const type = os.cpus()[0].model
    
    // Parallel processing based on cores
    this.parallelism = Math.max(1, cores - 1)  // Leave one core free
    
    // SIMD detection for vector operations
    if (type.includes('Intel') || type.includes('AMD')) {
      this.enableSIMD = await checkSIMDSupport()
    }
    
    // Thread pool sizing
    this.threadPoolSize = cores * 2  // Optimal for I/O bound
    
    // Vector search optimization
    if (cores >= 8) {
      this.hnswConstruction = 200  // Higher quality index
      this.hnswSearch = 100  // More accurate search
    } else {
      this.hnswConstruction = 100  // Balanced
      this.hnswSearch = 50  // Faster search
    }
  }
}
```

### Memory Adaptation

Intelligent memory allocation:

```typescript
class MemoryAdapter {
  async configure() {
    const totalMemory = os.totalmem()
    const availableMemory = os.freemem()
    
    // Allocate based on available memory
    const allocation = {
      cache: Math.min(availableMemory * 0.25, 2 * GB),
      vectors: Math.min(availableMemory * 0.30, 4 * GB),
      indexes: Math.min(availableMemory * 0.20, 2 * GB),
      working: Math.min(availableMemory * 0.25, 2 * GB)
    }
    
    // Adjust for low memory systems
    if (totalMemory < 4 * GB) {
      allocation.cache *= 0.5
      allocation.vectors *= 0.7
      this.enableSwapping = true
    }
    
    return allocation
  }
}
```

### GPU Acceleration

Automatic GPU detection and utilization:

```typescript
class GPUAdapter {
  async detect() {
    // WebGPU in browsers
    if (navigator?.gpu) {
      const adapter = await navigator.gpu.requestAdapter()
      return {
        available: true,
        type: 'webgpu',
        memory: adapter.limits.maxBufferSize,
        compute: adapter.limits.maxComputeWorkgroupsPerDimension
      }
    }
    
    // CUDA in Node.js
    if (process.platform === 'linux' || process.platform === 'win32') {
      const hasCuda = await checkCudaSupport()
      if (hasCuda) {
        return {
          available: true,
          type: 'cuda',
          memory: await getCudaMemory(),
          compute: await getCudaCores()
        }
      }
    }
    
    return { available: false }
  }
  
  async optimize(gpu: GPUInfo) {
    if (gpu.available) {
      // Offload vector operations to GPU
      this.vectorOps = 'gpu'
      this.embeddingGeneration = 'gpu'
      this.matrixMultiplication = 'gpu'
      
      // Larger batch sizes for GPU
      this.batchSize = gpu.memory > 8 * GB ? 10000 : 1000
    }
  }
}
```

## Network Adaptation

### Bandwidth Detection

Optimizes for available network bandwidth:

```typescript
class NetworkAdapter {
  async measureBandwidth() {
    const testSize = 1 * MB
    const start = Date.now()
    await this.transfer(testSize)
    const duration = Date.now() - start
    
    const bandwidth = (testSize / duration) * 1000  // bytes/sec
    
    if (bandwidth < 1 * MB) {
      // Low bandwidth - optimize
      this.compression = 'aggressive'
      this.batchTransfers = true
      this.cacheRemote = true
    } else if (bandwidth > 100 * MB) {
      // High bandwidth
      this.compression = 'minimal'
      this.parallelTransfers = true
    }
  }
}
```

### Latency Optimization

Adapts to network latency:

```typescript
class LatencyOptimizer {
  async optimize() {
    const latency = await this.measureLatency()
    
    if (latency > 100) {  // High latency
      // Batch operations
      this.minBatchSize = 100
      
      // Aggressive prefetching
      this.prefetchDepth = 3
      
      // Local caching
      this.cacheStrategy = 'aggressive'
      
      // Connection pooling
      this.connectionPool = Math.min(latency / 10, 50)
    }
  }
}
```

## Cloud Provider Detection 🚧 Coming Soon

> **Note**: Cloud provider auto-detection planned for Q3 2025.

### Automatic Cloud Optimization

Detects and optimizes for cloud providers:

```typescript
class CloudDetector {
  async detect() {
    // AWS Detection
    if (process.env.AWS_REGION || await canReachMetadata('169.254.169.254')) {
      return {
        provider: 'aws',
        instance: await getEC2InstanceType(),
        region: process.env.AWS_REGION,
        services: {
          storage: 's3',
          cache: 'elasticache',
          compute: 'lambda'
        }
      }
    }
    
    // Google Cloud Detection
    if (process.env.GOOGLE_CLOUD_PROJECT || await canReachMetadata('metadata.google.internal')) {
      return {
        provider: 'gcp',
        instance: await getGCEInstanceType(),
        region: process.env.GOOGLE_CLOUD_REGION,
        services: {
          storage: 'gcs',
          cache: 'memorystore',
          compute: 'cloud-run'
        }
      }
    }
    
    // Vercel Edge Detection
    if (process.env.VERCEL) {
      return {
        provider: 'vercel',
        region: process.env.VERCEL_REGION,
        services: {
          storage: 'vercel-kv',
          cache: 'edge-config',
          compute: 'edge-runtime'
        }
      }
    }
  }
}
```

## Development vs Production

### Automatic Environment Detection

```typescript
class EnvironmentDetector {
  detect() {
    const indicators = {
      // Development indicators
      isDevelopment: 
        process.env.NODE_ENV === 'development' ||
        process.env.DEBUG ||
        process.argv.includes('--dev') ||
        isLocalhost() ||
        hasDevTools(),
        
      // Test indicators
      isTest:
        process.env.NODE_ENV === 'test' ||
        process.env.CI ||
        isTestRunner(),
        
      // Production indicators
      isProduction:
        process.env.NODE_ENV === 'production' ||
        process.env.VERCEL ||
        process.env.NETLIFY ||
        !isLocalhost()
    }
    
    return indicators
  }
}

// Different defaults for different environments
const config = environment.isProduction ? {
  storage: 'filesystem',
  wal: true,
  monitoring: true,
  compression: true,
  caching: 'aggressive'
} : {
  storage: 'memory',
  wal: false,
  monitoring: false,
  compression: false,
  caching: 'minimal'
}
```

## Error Recovery

### Automatic Fallbacks

Brainy automatically recovers from errors:

```typescript
class AutoRecovery {
  async handleStorageFailure() {
    try {
      await this.primaryStorage.write(data)
    } catch (error) {
      console.warn('Primary storage failed, trying fallback')
      
      // Try secondary storage
      if (this.secondaryStorage) {
        await this.secondaryStorage.write(data)
      } else {
        // Fall back to memory
        await this.memoryStorage.write(data)
        
        // Schedule retry
        this.scheduleRetry(data)
      }
    }
  }
  
  async handleModelFailure() {
    try {
      return await this.primaryModel.embed(text)
    } catch (error) {
      // Fall back to simpler model
      return await this.fallbackModel.embed(text)
    }
  }
}
```

## Configuration Override

While zero-config is default, you can override when needed:

```typescript
// Explicit configuration when needed
const brain = new BrainyData({
  // Override auto-detection
  storage: {
    type: 'filesystem',
    path: '/custom/path'
  },
  
  // Override auto-optimization
  optimization: {
    autoIndex: false,
    autoCache: false,
    autoBatch: false
  },
  
  // Override auto-scaling
  scaling: {
    maxMemory: 2 * GB,
    maxConnections: 100,
    maxBatchSize: 1000
  }
})
```

## Monitoring Auto-Adaptation

Brainy provides visibility into its auto-adaptation:

```typescript
brain.on('adaptation', (event) => {
  console.log(`Brainy adapted: ${event.type}`)
  console.log(`Reason: ${event.reason}`)
  console.log(`Before: ${JSON.stringify(event.before)}`)
  console.log(`After: ${JSON.stringify(event.after)}`)
})

// Example events:
// - Index created for frequently queried field
// - Cache strategy changed due to low hit rate
// - Batch size increased due to high throughput
// - Storage migrated due to space constraints
// - Model switched due to multilingual content
```

## Conclusion

Brainy's zero-configuration and auto-adaptation capabilities mean you can focus on your application logic while Brainy handles:

- Environment detection and optimization
- Storage selection and migration
- Performance tuning and scaling
- Resource management
- Error recovery
- Workload optimization

Just create a Brainy instance and start using it. Brainy will learn, adapt, and optimize itself for your specific use case—no configuration required.

## See Also

- [Architecture Overview](./overview.md)
- [Storage Architecture](./storage.md)
- [Performance Guide](../guides/performance.md)
- [Augmentations System](./augmentations.md)