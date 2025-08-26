# 🧠 Brainy Testing Guide

## Memory Requirements

**IMPORTANT**: Brainy requires 8-16GB RAM for full functionality due to the transformer model (ONNX runtime).

This is NOT a bug - it's the cost of running state-of-the-art AI locally.

## Why So Much Memory?

Brainy uses the `all-MiniLM-L6-v2` transformer model for semantic search:
- **Model file**: 90MB compressed
- **Runtime memory**: 4-8GB when loaded
- **Why**: ONNX runtime pre-allocates buffers for matrix operations
- **Benefit**: Enables semantic search (understanding meaning, not just keywords)

## Running Tests

### Full Test Suite (Requires 16GB RAM)
```bash
# Allocate 16GB heap for Node.js
export NODE_OPTIONS='--max-old-space-size=16384'
npm test
```

### Test Without AI Features (Low Memory)
```bash
# Test core database features without embeddings
node test-without-embeddings.js
```

### Test Individual Files
```bash
# Test specific functionality
npm test -- --run tests/core.test.ts
npm test -- --run tests/metadata-filter.test.ts
```

### Sequential Test Runner (Memory-Efficient)
```bash
# Runs tests in batches to prevent memory exhaustion
./run-all-tests.sh
```

## Common Test Issues

### Out of Memory Errors
**Symptom**: `FATAL ERROR: Ineffective mark-compacts near heap limit`

**Solution**: 
1. Increase Node.js heap: `NODE_OPTIONS='--max-old-space-size=16384'`
2. Run tests sequentially instead of in parallel
3. Use a machine with more RAM (16GB+ recommended)

### Tests Hanging on Search
**Symptom**: Tests freeze when calling `brain.search()` or `brain.find()`

**Cause**: ONNX model initialization can take 30-60 seconds first time

**Solution**: Be patient - model loads once then runs fast

### ClearAll Requires Force
**Symptom**: `clearAll requires force: true option for safety`

**Solution**: Always use `brain.clearAll({ force: true })`

## Performance Expectations

With adequate memory (16GB):
- Model initialization: 30-60 seconds (first time)
- Embedding generation: 10-50ms per text
- Vector search: 1-10ms for 10k items
- Metadata filtering: <1ms (indexed)

## Production Deployment

For production with limited memory:

### Option 1: Dedicated AI Server
Run Brainy on a server with 16GB+ RAM and access via API

### Option 2: Cloud Functions
Use services that provide high-memory instances:
- AWS Lambda: Up to 10GB
- Google Cloud Functions: Up to 32GB
- Vercel: Up to 3GB (may struggle)

### Option 3: Pre-computed Embeddings
Generate embeddings offline and ship them with your app

## The Reality

**Brainy includes cutting-edge AI that requires significant memory.**

This is the same technology used by:
- Google Search (semantic understanding)
- GitHub Copilot (code understanding)  
- ChatGPT (text embeddings)

The difference: **Brainy runs it locally with zero configuration.**

If you need a lighter solution without AI:
- Use traditional databases (PostgreSQL, MongoDB)
- Use keyword search instead of semantic search
- Use external embedding APIs (OpenAI, Cohere)

But if you want the power of AI-driven search that understands meaning, not just keywords, then 8-16GB RAM is the price of admission.

## Test Monitoring

To monitor memory during tests:
```bash
# Watch memory usage
watch -n 1 "ps aux | grep node | grep -v grep"

# Check Node.js heap
node -e "console.log(require('v8').getHeapStatistics())"
```

## Optimizations Already Applied

Brainy already includes these memory optimizations:
- ✅ Quantized models (q8 instead of fp32) - 75% reduction
- ✅ ONNX memory arena disabled
- ✅ Limited thread pools
- ✅ Efficient batch processing
- ✅ Smart caching

These optimizations reduce memory from 16GB+ to 4-8GB, which is as low as possible while maintaining quality.