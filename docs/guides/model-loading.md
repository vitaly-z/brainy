# 🤖 Model Loading Guide

Brainy uses AI embedding models to understand and process your data. This guide explains how model loading works and how to handle different scenarios.

## 🚀 Zero Configuration (Default)

**For most developers, no configuration is needed:**

```typescript
const brain = new BrainyData()
await brain.init() // Models load automatically
```

**What happens automatically:**
1. Checks for local models in `./models/`
2. Downloads All-MiniLM-L6-v2 if needed (384 dimensions)
3. Configures optimal settings for your environment
4. Ready to use immediately

## 📦 Model Loading Cascade

Brainy tries multiple sources in this order:

```
1. LOCAL CACHE (./models/) 
   ↓ (if not found)
2. CDN DOWNLOAD (fast mirrors)
   ↓ (if fails)  
3. GITHUB RELEASES (github.com/xenova/transformers.js)
   ↓ (if fails)
4. HUGGINGFACE HUB (huggingface.co)
   ↓ (if fails)
5. FALLBACK STRATEGIES (different model variants)
```

## 🌍 Environment-Specific Behavior

### Browser
```typescript
// Automatically configured for browsers
const brain = new BrainyData() // Works in React, Vue, vanilla JS
await brain.init() // Downloads models via CDN
```

### Node.js Development
```typescript
// Zero config - downloads to ./models/
const brain = new BrainyData()
await brain.init() // Downloads once, cached forever
```

### Production Server
```typescript
// Preload models during build/deployment
const brain = new BrainyData()
await brain.init() // Uses cached local models
```

### Docker/Kubernetes
```dockerfile
# Dockerfile - preload models
RUN npm run download-models
ENV BRAINY_ALLOW_REMOTE_MODELS=false
```

## 🛠️ Manual Model Management

### Pre-download Models
```bash
# Download models during build/deployment
npm run download-models

# Custom location
BRAINY_MODELS_PATH=./my-models npm run download-models
```

### Verify Models
```bash
# Check if models exist
ls ./models/Xenova/all-MiniLM-L6-v2/

# Should see:
# - config.json
# - tokenizer.json  
# - onnx/model.onnx
```

### Custom Model Path
```typescript
const brain = new BrainyData({
  embedding: {
    cacheDir: './custom-models'
  }
})
```

## 🔒 Offline & Air-Gapped Environments

### Complete Offline Setup
```bash
# 1. Download models on connected machine
npm run download-models

# 2. Copy models to offline machine
cp -r ./models /path/to/offline/project/

# 3. Force local-only mode
export BRAINY_ALLOW_REMOTE_MODELS=false
```

### Container/Server Deployment
```dockerfile
FROM node:18
WORKDIR /app
COPY package*.json ./
RUN npm ci

# Download models during build
RUN npm run download-models

# Force local-only in production
ENV BRAINY_ALLOW_REMOTE_MODELS=false

COPY . .
EXPOSE 3000
CMD ["npm", "start"]
```

## ⚙️ Environment Variables

### BRAINY_ALLOW_REMOTE_MODELS
Controls whether remote model downloads are allowed:

```bash
# Allow remote downloads (default in most environments)
export BRAINY_ALLOW_REMOTE_MODELS=true

# Force local-only (recommended for production)
export BRAINY_ALLOW_REMOTE_MODELS=false
```

### BRAINY_MODELS_PATH
Custom model storage location:

```bash
# Custom model path
export BRAINY_MODELS_PATH=/opt/brainy/models

# Relative path
export BRAINY_MODELS_PATH=./my-custom-models
```

## 🚨 Troubleshooting

### "Failed to load embedding model" Error

**Cause**: Models not found locally and remote download blocked/failed.

**Solutions**:
```bash
# Option 1: Allow remote downloads
export BRAINY_ALLOW_REMOTE_MODELS=true

# Option 2: Download models manually
npm run download-models

# Option 3: Check internet connectivity
ping huggingface.co

# Option 4: Use custom model path
export BRAINY_MODELS_PATH=/path/to/existing/models
```

### Models Download Very Slowly

**Cause**: Network issues or regional restrictions.

**Solutions**:
```bash
# Pre-download during build/CI
npm run download-models

# Use faster mirrors (automatic in newer versions)
# No action needed - Brainy tries multiple CDNs
```

### Container Out of Memory During Model Load

**Cause**: Limited container memory during model initialization.

**Solutions**:
```dockerfile
# Increase memory limit
docker run -m 2g my-app

# Use quantized models (default)
ENV BRAINY_MODEL_DTYPE=q8

# Pre-load models at build time (recommended)
RUN npm run download-models
```

### Permission Denied Creating Model Cache

**Cause**: Write permissions for model cache directory.

**Solutions**:
```bash
# Make directory writable
chmod 755 ./models

# Use custom writable path
export BRAINY_MODELS_PATH=/tmp/brainy-models

# Or use memory-only storage
const brain = new BrainyData({
  storage: { forceMemoryStorage: true }
})
```

## 🎯 Best Practices

### Development
```typescript
// ✅ Zero config - just works
const brain = new BrainyData()
await brain.init()
```

### Production
```dockerfile
# ✅ Pre-download models
RUN npm run download-models

# ✅ Force local-only
ENV BRAINY_ALLOW_REMOTE_MODELS=false

# ✅ Verify models exist
RUN test -f ./models/Xenova/all-MiniLM-L6-v2/onnx/model.onnx
```

### CI/CD Pipeline
```yaml
# .github/workflows/build.yml
- name: Download AI Models
  run: npm run download-models
  
- name: Verify Models
  run: |
    test -f ./models/Xenova/all-MiniLM-L6-v2/onnx/model.onnx
    echo "✅ Models verified"

- name: Test Offline Mode
  env:
    BRAINY_ALLOW_REMOTE_MODELS: false
  run: npm test
```

### Lambda/Serverless
```typescript
// ✅ Models in deployment package
const brain = new BrainyData({
  embedding: {
    localFilesOnly: true, // No downloads in lambda
    cacheDir: './models'  // Bundled with deployment
  }
})
```

## 📊 Model Information

### All-MiniLM-L6-v2 (Default)
- **Dimensions**: 384 (fixed)
- **Size**: ~80MB compressed, ~330MB uncompressed
- **Language**: English (optimized)
- **Speed**: Very fast inference
- **Quality**: High quality for most use cases

### Model Files Structure
```
models/
└── Xenova/
    └── all-MiniLM-L6-v2/
        ├── config.json          # Model configuration
        ├── tokenizer.json       # Text tokenizer
        ├── tokenizer_config.json
        └── onnx/
            ├── model.onnx       # Main model file
            └── model_quantized.onnx  # Optimized version
```

## 🔄 Migration from Other Embedding Solutions

### From OpenAI Embeddings
```typescript
// Before: OpenAI API calls
const response = await openai.embeddings.create({
  model: "text-embedding-ada-002",
  input: "Your text"
})

// After: Local Brainy embeddings
const brain = new BrainyData()
await brain.init() // One-time setup
const id = await brain.addNoun("Your text", 'content') // Embedded automatically
```

### From Sentence Transformers
```python
# Before: Python sentence-transformers
from sentence_transformers import SentenceTransformer
model = SentenceTransformer('all-MiniLM-L6-v2')

# After: JavaScript Brainy (same model!)
const brain = new BrainyData() // Uses same all-MiniLM-L6-v2
await brain.init()
```

## 🚀 Advanced Configuration

### Custom Embedding Options
```typescript
const brain = new BrainyData({
  embedding: {
    model: 'Xenova/all-MiniLM-L6-v2', // Default
    dtype: 'q8',                       // Quantized for speed
    device: 'cpu',                     // CPU inference
    localFilesOnly: false,             // Allow downloads
    verbose: true                      // Debug logging
  }
})
```

### Multiple Model Support (Advanced)
```typescript
// Use custom embedding function
import { createEmbeddingFunction } from 'brainy'

const customEmbedder = createEmbeddingFunction({
  model: 'Xenova/all-MiniLM-L12-v2', // Larger model
  dtype: 'fp32' // Higher precision
})

const brain = new BrainyData({
  embeddingFunction: customEmbedder
})
```

---

## 📚 Additional Resources

- [Zero Configuration Guide](./zero-config.md)
- [Enterprise Deployment](./enterprise-deployment.md)
- [Troubleshooting Guide](../troubleshooting.md)
- [API Reference](../api/README.md)

**Need help?** Check our [troubleshooting guide](../troubleshooting.md) or [open an issue](https://github.com/your-repo/brainy/issues).