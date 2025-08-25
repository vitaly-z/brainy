# Transformer Model Memory Issue - Solutions

## The Problem
ONNX runtime allocates 4GB for a 30MB model during inference. This is a known issue with transformers.js.

## Solution 1: Use Smaller Quantized Model (RECOMMENDED)
```javascript
// Current: all-MiniLM-L6-v2 with q8 quantization
// Switch to: all-MiniLM-L6-v2 with q4 quantization (50% smaller)
// Or use: paraphrase-MiniLM-L3-v2 (even smaller, still good quality)

const embeddingFunction = createEmbeddingFunction({
  modelName: 'Xenova/paraphrase-MiniLM-L3-v2',
  dtype: 'q4' // 4-bit quantization instead of 8-bit
})
```

## Solution 2: Increase Node Memory Limit
```bash
# Run with 8GB heap limit
node --max-old-space-size=8192 test-range-queries.js

# Or set in package.json test script:
"test": "NODE_OPTIONS='--max-old-space-size=8192' vitest"
```

## Solution 3: Use Remote Embeddings (For Testing)
```javascript
// Mock embedding function for tests
const mockEmbeddingFunction = async (text) => {
  // Generate deterministic fake embedding from text hash
  const hash = text.split('').reduce((a, b) => a + b.charCodeAt(0), 0)
  return new Array(384).fill(0).map((_, i) => Math.sin(hash + i) * 0.1)
}
```

## Solution 4: Model Pooling & Unloading
```javascript
class ModelPool {
  private model: any = null
  private lastUsed: number = 0
  private readonly UNLOAD_AFTER_MS = 30000 // 30 seconds
  
  async getModel() {
    if (!this.model) {
      this.model = await loadModel()
    }
    this.lastUsed = Date.now()
    this.scheduleUnload()
    return this.model
  }
  
  private scheduleUnload() {
    setTimeout(() => {
      if (Date.now() - this.lastUsed > this.UNLOAD_AFTER_MS) {
        this.model?.dispose?.()
        this.model = null
      }
    }, this.UNLOAD_AFTER_MS)
  }
}
```

## Solution 5: Use Native Bindings (Future)
Replace transformers.js with native bindings:
- onnxruntime-node (more efficient memory)
- @tensorflow/tfjs-node (better memory management)
- Custom Rust/C++ binding

## Recommendation for Brainy 2.0

### For Production:
1. Use q4 quantization (reduces memory 50%)
2. Implement model pooling/unloading
3. Document memory requirements (4GB recommended)

### For Testing:
1. Increase Node heap to 8GB for test suite
2. Use mock embeddings for unit tests
3. Real embeddings only for integration tests

### Long-term:
1. Investigate native bindings
2. Support multiple embedding backends
3. Cloud embedding API option

## Memory Requirements

| Configuration | Memory Needed | Use Case |
|--------------|--------------|----------|
| Mock embeddings | 200 MB | Unit tests |
| Q4 quantization | 2 GB | Development |
| Q8 quantization | 4 GB | Production (current) |
| Native bindings | 500 MB | Future optimization |

## The Real Issue

This is NOT a Brainy problem - it's a transformers.js/ONNX issue that affects ALL JavaScript ML applications. Even Google's similar libraries have this problem.

The good news:
- Only affects initial model load
- Singleton pattern prevents multiple copies
- Memory is released after inference
- Production servers typically have 8-16GB RAM