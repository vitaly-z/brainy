# 🧠 Zero-Config ONNX Memory Optimization Plan

## Philosophy
Brainy should **automatically detect and optimize** memory usage without any user configuration.

## Implementation Strategy

### 1. **Automatic Environment Variable Setting** ✅ DONE
Already implemented in `src/utils/embedding.ts`:
```javascript
// Automatically set on module load - zero config!
if (typeof process !== 'undefined' && process.env) {
  process.env.ORT_DISABLE_MEMORY_ARENA = '1'
  process.env.ORT_DISABLE_MEMORY_PATTERN = '1'
  process.env.ORT_INTRA_OP_NUM_THREADS = '2'
  process.env.ORT_INTER_OP_NUM_THREADS = '2'
}
```

### 2. **Automatic Quantization Selection** ✅ DONE
Changed default from `fp32` to `q8`:
```javascript
dtype: options.dtype || 'q8'  // 75% memory reduction, <1% quality loss
```

### 3. **Dynamic Memory Detection** 🚧 TODO
```javascript
class TransformerEmbedding {
  constructor(options) {
    // Auto-detect available memory
    const availableMemory = this.getAvailableMemory()
    
    // Auto-select best configuration
    if (availableMemory < 2048) {  // Less than 2GB
      this.options.dtype = 'q4'    // Maximum compression
      this.options.batchSize = 5   // Small batches
    } else if (availableMemory < 4096) {  // 2-4GB
      this.options.dtype = 'q8'    // Good balance
      this.options.batchSize = 10
    } else {  // 4GB+
      this.options.dtype = 'fp16'  // Better quality
      this.options.batchSize = 20
    }
  }
  
  private getAvailableMemory(): number {
    if (typeof process !== 'undefined') {
      const os = require('os')
      return os.freemem() / (1024 * 1024)  // MB
    }
    // Browser: estimate from performance.memory
    if (typeof performance !== 'undefined' && performance.memory) {
      return (performance.memory.jsHeapSizeLimit - performance.memory.usedJSHeapSize) / (1024 * 1024)
    }
    return 2048  // Safe default: 2GB
  }
}
```

### 4. **Automatic Model Unloading** 🚧 TODO
```javascript
class TransformerEmbedding {
  private lastUsed = Date.now()
  private unloadTimer?: NodeJS.Timeout
  
  async embed(text: string[]): Promise<Vector[]> {
    this.lastUsed = Date.now()
    
    // Cancel any pending unload
    if (this.unloadTimer) {
      clearTimeout(this.unloadTimer)
    }
    
    // Ensure model is loaded
    if (!this.extractor) {
      await this.loadModel()
    }
    
    const result = await this.doEmbed(text)
    
    // Schedule unload after 5 minutes of inactivity
    this.unloadTimer = setTimeout(() => {
      this.unloadModel()
    }, 5 * 60 * 1000)
    
    return result
  }
  
  private unloadModel() {
    if (this.extractor) {
      this.extractor.dispose()
      this.extractor = null
      console.log('🧹 Model unloaded to free memory')
    }
  }
}
```

### 5. **Automatic Batch Size Adjustment** 🚧 TODO
```javascript
class TransformerEmbedding {
  private optimalBatchSize = 10
  
  async embed(texts: string[]): Promise<Vector[]> {
    const results = []
    
    for (let i = 0; i < texts.length; i += this.optimalBatchSize) {
      const batch = texts.slice(i, i + this.optimalBatchSize)
      
      try {
        const embeddings = await this.embedBatch(batch)
        results.push(...embeddings)
      } catch (error) {
        if (error.message.includes('memory')) {
          // Reduce batch size on memory error
          this.optimalBatchSize = Math.max(1, Math.floor(this.optimalBatchSize / 2))
          console.log(`📉 Reduced batch size to ${this.optimalBatchSize} due to memory pressure`)
          
          // Retry with smaller batch
          i -= this.optimalBatchSize  // Retry this batch
          continue
        }
        throw error
      }
    }
    
    // Gradually increase batch size if successful
    if (this.optimalBatchSize < 20) {
      this.optimalBatchSize++
    }
    
    return results
  }
}
```

### 6. **Pre-computed Common Embeddings** 🚧 TODO
Build into `embeddedPatterns.ts`:
```javascript
// Pre-compute embeddings for common terms
const COMMON_EMBEDDINGS = {
  'javascript': [0.123, 0.456, ...],
  'python': [0.234, 0.567, ...],
  'database': [0.345, 0.678, ...],
  // ... top 1000 common terms
}

async embed(text: string): Promise<Vector> {
  // Check cache first - INSTANT, zero memory!
  const lower = text.toLowerCase()
  if (COMMON_EMBEDDINGS[lower]) {
    return COMMON_EMBEDDINGS[lower]
  }
  
  // Only compute if not cached
  return this.computeEmbedding(text)
}
```

## Testing Plan

### Phase 1: Current Optimizations (TODAY)
- [x] Environment variables auto-set
- [x] Default to q8 quantization
- [x] Session options configured
- [ ] Test with real search

### Phase 2: Dynamic Adaptation (NEXT)
- [ ] Memory detection
- [ ] Auto dtype selection
- [ ] Batch size adjustment
- [ ] Model unloading

### Phase 3: Performance (FUTURE)
- [ ] Pre-computed embeddings
- [ ] Lazy loading
- [ ] WebAssembly fallback

## User Experience

### Before (Manual Configuration)
```javascript
// User had to know about ONNX issues
process.env.ORT_DISABLE_MEMORY_ARENA = '1'
const brain = new BrainyData({
  embeddingOptions: {
    dtype: 'q8',
    batchSize: 10
  }
})
```

### After (Zero Config)
```javascript
// Just works!
const brain = new BrainyData()
await brain.search('anything')  // Automatically optimized
```

## Benefits
1. **Zero Configuration** - Works out of the box
2. **Adaptive** - Adjusts to available resources
3. **Resilient** - Recovers from memory errors
4. **Efficient** - Uses minimum required memory
5. **Smart** - Caches common queries

## Current Status
- ✅ Basic optimizations in place
- 🚧 Need to test if they work
- 📝 Plan documented for full implementation

## Next Steps
1. Test current optimizations with real search
2. Implement memory detection
3. Add batch size adjustment
4. Build pre-computed embeddings