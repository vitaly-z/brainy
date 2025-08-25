# 🚨 Troubleshooting Guide

Common issues and solutions for Brainy.

## 🤖 Model Loading Issues

### "Failed to load embedding model"

**Symptoms**: Error during `brain.init()` with model loading failure.

**Causes & Solutions**:

1. **No local models + remote downloads blocked**
   ```bash
   # Solution: Download models manually
   npm run download-models
   ```

2. **Network connectivity issues**
   ```bash
   # Solution: Allow remote models
   export BRAINY_ALLOW_REMOTE_MODELS=true
   
   # Or pre-download in connected environment
   npm run download-models
   ```

3. **Incorrect model path**
   ```bash
   # Check if models exist
   ls ./models/Xenova/all-MiniLM-L6-v2/onnx/model.onnx
   
   # Set correct path
   export BRAINY_MODELS_PATH=/correct/path/to/models
   ```

### Models Download Very Slowly

**Symptoms**: Long wait times during first initialization.

**Solutions**:
```bash
# Pre-download during build/CI
npm run download-models

# For Docker - download during image build
RUN npm run download-models
```

### Container Out of Memory During Model Load

**Symptoms**: OOM errors in Docker/Kubernetes during initialization.

**Solutions**:
```dockerfile
# Increase memory limit
docker run -m 2g my-app

# Pre-download models at build time (recommended)
RUN npm run download-models

# Use quantized models (default, but explicit)
ENV BRAINY_MODEL_DTYPE=q8
```

## 💾 Storage Issues

### Permission Denied Creating Storage Directory

**Symptoms**: EACCES or permission errors when creating storage files.

**Solutions**:
```bash
# Make directory writable
chmod 755 ./brainy-data

# Use custom writable path
const brain = new BrainyData({
  storage: {
    adapter: 'filesystem',
    path: '/tmp/brainy-data'
  }
})

# Or use memory storage
const brain = new BrainyData({
  storage: { forceMemoryStorage: true }
})
```

### "ENOENT: no such file or directory"

**Symptoms**: File not found errors during storage operations.

**Solutions**:
```bash
# Ensure parent directory exists
mkdir -p ./brainy-data

# Check storage configuration
const brain = new BrainyData({
  storage: {
    adapter: 'filesystem',
    path: '/full/path/to/storage' // Use absolute path
  }
})
```

## 🧠 Initialization Issues

### Initialization Hangs or Times Out

**Symptoms**: `brain.init()` never resolves.

**Possible Causes & Solutions**:

1. **Model download timeout**
   ```bash
   # Pre-download models
   npm run download-models
   
   # Or force local-only
   export BRAINY_ALLOW_REMOTE_MODELS=false
   ```

2. **Network issues**
   ```typescript
   // Set initialization timeout
   const brain = new BrainyData()
   
   // Use Promise.race for timeout
   const initPromise = Promise.race([
     brain.init(),
     new Promise((_, reject) => 
       setTimeout(() => reject(new Error('Init timeout')), 30000)
     )
   ])
   ```

3. **Resource constraints**
   ```bash
   # Increase memory for Node.js
   NODE_OPTIONS="--max-old-space-size=4096" npm start
   ```

## 🔍 Search Issues

### No Search Results

**Symptoms**: Empty results from valid queries.

**Debugging Steps**:

1. **Check if data exists**
   ```typescript
   const stats = await brain.getStatistics()
   console.log(`Total items: ${stats.nounCount}`)
   ```

2. **Verify embedding generation**
   ```typescript
   const id = await brain.add("test content")
   const item = await brain.get(id)
   console.log('Item:', item) // Should have metadata and vector
   ```

3. **Test with exact match**
   ```typescript
   const results = await brain.search("test content") // Exact text
   console.log('Exact match results:', results)
   ```

### Poor Search Quality

**Symptoms**: Irrelevant results, low scores.

**Improvements**:

1. **Add more context to queries**
   ```typescript
   // Instead of: "cat"
   const results = await brain.search("domestic cat animal pet")
   ```

2. **Use metadata filtering**
   ```typescript
   const results = await brain.search("animals", {
     where: { category: "pets" },
     limit: 10
   })
   ```

3. **Check data quality**
   ```typescript
   // Ensure consistent, descriptive content
   await brain.add("Domestic cat - small carnivorous mammal", {
     category: "animals",
     subcategory: "pets"
   })
   ```

## ⚡ Performance Issues

### Slow Search Performance

**Symptoms**: High search latency.

**Optimizations**:

1. **Enable search cache**
   ```typescript
   const brain = new BrainyData({
     cache: {
       search: {
         maxSize: 1000,
         ttl: 300000 // 5 minutes
       }
     }
   })
   ```

2. **Use appropriate limits**
   ```typescript
   // Don't fetch more than needed
   const results = await brain.search("query", { limit: 10 })
   ```

3. **Consider field filtering first**
   ```typescript
   // Filter by metadata first, then semantic search
   const results = await brain.search("query", {
     where: { category: "specific" }, // Reduces search space
     limit: 10
   })
   ```

### High Memory Usage

**Symptoms**: Increasing memory consumption over time.

**Solutions**:

1. **Cleanup when done**
   ```typescript
   await brain.cleanup() // Releases resources
   ```

2. **Use streaming for large datasets**
   ```typescript
   // Process in batches instead of loading all at once
   for (let i = 0; i < data.length; i += 100) {
     const batch = data.slice(i, i + 100)
     await Promise.all(batch.map(item => brain.add(item)))
   }
   ```

3. **Configure memory limits**
   ```bash
   NODE_OPTIONS="--max-old-space-size=2048" npm start
   ```

## 🧪 Testing Issues

### Tests Fail in CI/CD

**Symptoms**: Tests pass locally but fail in automated environments.

**Solutions**:

1. **Pre-download models in CI**
   ```yaml
   # .github/workflows/test.yml
   - name: Download Models
     run: npm run download-models
   
   - name: Test with Local Models
     env:
       BRAINY_ALLOW_REMOTE_MODELS: false
     run: npm test
   ```

2. **Use memory storage in tests**
   ```typescript
   // In test setup
   const brain = new BrainyData({
     storage: { forceMemoryStorage: true }
   })
   ```

3. **Increase timeout for CI**
   ```typescript
   // In test files
   describe('Brainy tests', () => {
     it('should work', async () => {
       // Test code
     }, { timeout: 30000 }) // 30 second timeout
   })
   ```

## 📋 Environment-Specific Issues

### Browser CORS Errors

**Symptoms**: Model loading fails in browser due to CORS.

**Solutions**:
```javascript
// Brainy handles CORS automatically via CDN
// No action needed - models load from CORS-enabled mirrors

// If using custom model URLs, ensure CORS headers:
// Access-Control-Allow-Origin: *
```

### Serverless Cold Start Timeouts

**Symptoms**: Lambda/Vercel functions timeout during initialization.

**Solutions**:
```dockerfile
# Pre-bundle models in deployment
RUN npm run download-models

# Set environment variables
ENV BRAINY_ALLOW_REMOTE_MODELS=false
ENV BRAINY_MODELS_PATH=./models
```

### Node.js Module Resolution Issues

**Symptoms**: "Cannot find module" errors.

**Solutions**:
```json
// package.json
{
  "type": "module",
  "exports": {
    ".": {
      "import": "./dist/index.js",
      "require": "./dist/index.js"
    }
  }
}
```

## 🆘 Getting Help

### Debug Logging

Enable verbose logging to see what's happening:

```typescript
const brain = new BrainyData({
  logging: { verbose: true }
})
```

### Health Check

Verify your Brainy setup:

```typescript
// Basic health check
try {
  const brain = new BrainyData()
  await brain.init()
  
  const id = await brain.add("health check")
  const results = await brain.search("health")
  
  console.log('✅ Brainy is working correctly')
  console.log(`Added item: ${id}`)
  console.log(`Search results: ${results.length}`)
  
} catch (error) {
  console.error('❌ Brainy health check failed:', error)
}
```

### Environment Info

Collect environment information:

```bash
# Node.js version
node --version

# Memory limits
node -e "console.log(process.memoryUsage())"

# Platform info
node -e "console.log(process.platform, process.arch)"

# Brainy models
ls -la ./models/Xenova/all-MiniLM-L6-v2/
```

### Report Issues

When reporting issues, include:

1. **Environment**: Node.js version, OS, memory
2. **Configuration**: Brainy options, environment variables  
3. **Error logs**: Full error messages and stack traces
4. **Reproduction**: Minimal code example that demonstrates the issue

**Where to report**:
- [GitHub Issues](https://github.com/your-repo/brainy/issues)
- Include "troubleshooting" label
- Use the issue template

---

**Still having issues?** Check the [Model Loading Guide](guides/model-loading.md) or [open an issue](https://github.com/your-repo/brainy/issues).