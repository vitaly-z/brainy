# 🧠 Brainy Memory Requirements

## Executive Summary

Brainy 2.0 includes **built-in AI capabilities** powered by transformer models. While the core database operations are memory-efficient (200-500MB), the AI features require additional memory due to the ONNX runtime.

## Memory Requirements by Use Case

### 1. **Minimal Usage** (No AI Features)
- **Required**: 512MB - 1GB
- **Use Case**: Basic noun/verb storage without semantic search
- **Configuration**: `embeddings: false`

### 2. **Standard Usage** (With AI)
- **Recommended**: 4GB
- **Typical**: 6GB
- **Use Case**: Full semantic search, natural language queries, embeddings
- **Reality**: ONNX runtime allocates 4-8GB for model inference

### 3. **Production Usage** (High Volume)
- **Recommended**: 8GB
- **Optimal**: 16GB
- **Use Case**: Large datasets, concurrent operations, caching

## Why Does Brainy Need This Memory?

### The ONNX Runtime Reality

The transformer model file is only **30MB** on disk, but ONNX runtime allocates significantly more memory:

1. **Model Loading**: ~500MB for model architecture
2. **Inference Tensors**: 2-4GB for computation graphs
3. **Batch Processing**: Additional memory for parallel inference
4. **Memory Fragmentation**: ONNX doesn't release memory efficiently

### What You Get for This Memory

Unlike other databases that require this memory just to run, Brainy's memory usage gives you:

- **Built-in embeddings** - No external API costs ($0 vs $0.10/1M tokens)
- **Natural language search** - Plain English queries
- **Semantic understanding** - Find "similar" not just "exact"
- **Offline AI** - Works without internet connection
- **Zero latency** - Models loaded in-process

## Configuration for Different Memory Constraints

### Low Memory Environment (2GB)
```javascript
const brain = new BrainyData({
  embeddings: false,  // Disable transformer models
  cache: { 
    maxSize: 100      // Smaller cache
  }
})
```

### Standard Environment (4-6GB)
```javascript
const brain = new BrainyData()  // Default configuration
```

### High Performance Environment (8GB+)
```javascript
const brain = new BrainyData({
  cache: { 
    maxSize: 10000    // Large cache
  },
  batchSize: 100,     // Process more in parallel
  efSearch: 100       // More accurate search
})
```

## Running Tests with Adequate Memory

### For Development/Testing
```bash
# Allocate 8GB for Node.js
export NODE_OPTIONS='--max-old-space-size=8192'
npm test
```

### For Production
```bash
# Start with 8GB heap
node --max-old-space-size=8192 server.js
```

### Docker Configuration
```dockerfile
# In your Dockerfile
ENV NODE_OPTIONS="--max-old-space-size=8192"

# Or in docker-compose.yml
environment:
  - NODE_OPTIONS=--max-old-space-size=8192
```

## Memory Optimization Tips

### 1. **Lazy Model Loading**
Models are loaded on first use, not at initialization:
```javascript
const brain = new BrainyData()
// No memory used yet

await brain.search('test')  
// Now model loads (4GB allocated)
```

### 2. **Shared Model Instance**
Multiple BrainyData instances share the same model:
```javascript
const brain1 = new BrainyData()
const brain2 = new BrainyData()
// Only one model in memory
```

### 3. **Clear Unused Data**
```javascript
await brain.clear()  // Free memory from data
// Model stays loaded for next operation
```

## Comparison with Other Databases

| Database | Memory (No AI) | Memory (With AI) | AI Capability |
|----------|---------------|------------------|---------------|
| **Brainy** | 500MB | 4-6GB | Built-in |
| PostgreSQL | 2GB | 2GB + External AI | Via extension |
| MongoDB | 4GB | 4GB + External AI | Via Atlas |
| Elasticsearch | 8GB | 8GB + External AI | Via pipeline |
| Weaviate | 4GB | 8-16GB | Built-in |

**Key Difference**: Brainy's memory usage is for AI features. Others use similar memory just for basic operations, then need MORE for AI.

## Troubleshooting Memory Issues

### Symptoms of Insufficient Memory
- "JavaScript heap out of memory" errors
- Process crashes during search operations
- Slow performance during embedding generation

### Solutions

1. **Increase Node.js heap size**:
   ```bash
   node --max-old-space-size=8192 app.js
   ```

2. **Disable AI features temporarily**:
   ```javascript
   const brain = new BrainyData({ embeddings: false })
   ```

3. **Use quantized models** (future feature):
   ```javascript
   // Coming soon: 4x smaller models
   const brain = new BrainyData({ 
     modelType: 'quantized'  // Uses 1GB instead of 4GB
   })
   ```

## The Bottom Line

**Yes, Brainy needs 4-6GB of memory for AI features.** This is because it includes a complete transformer model for semantic understanding. 

**But consider the alternative:**
- OpenAI API: $0.10 per 1M tokens + latency + internet required
- Running separate embedding service: Another 4GB + complexity
- No semantic search: Missing core functionality

**Brainy gives you local, private, zero-cost AI in exchange for that memory.**

## Future Optimizations

We're working on:
1. **Quantized models** - 75% memory reduction
2. **Model unloading** - Free memory when idle
3. **Streaming inference** - Lower peak memory usage
4. **WebGPU support** - Offload to GPU memory

Until then, **allocate 6-8GB for the best experience** with Brainy's AI features.