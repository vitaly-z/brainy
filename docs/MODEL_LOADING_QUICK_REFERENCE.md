# 🤖 Model Loading Quick Reference

## 🚀 Common Scenarios

### ✅ Development (Zero Config)
```typescript
const brain = new BrainyData()
await brain.init() // Downloads automatically (FP32 default)
```

### ⚡ Development (Optimized - v2.8.0+)
```typescript
// 75% smaller models, 99% accuracy
const brain = new BrainyData({
  embeddingOptions: { dtype: 'q8' }
})
await brain.init()
```

### 🐳 Docker Production
```dockerfile
# Both models (recommended)
RUN npm run download-models

# Or FP32 only (compatibility)
RUN npm run download-models:fp32

# Or Q8 only (space-constrained)
RUN npm run download-models:q8

ENV BRAINY_ALLOW_REMOTE_MODELS=false
```

### ☁️ Serverless/Lambda
```bash
# Build step
npm run download-models

# Runtime
export BRAINY_ALLOW_REMOTE_MODELS=false
```

### 🔒 Air-Gapped/Offline
```bash
# Connected machine
npm run download-models
tar -czf brainy-models.tar.gz ./models

# Offline machine  
tar -xzf brainy-models.tar.gz
export BRAINY_ALLOW_REMOTE_MODELS=false
```

### 🌐 Browser/CDN
```html
<!-- Automatic - no setup needed -->
<script type="module">
  import { BrainyData } from 'brainy'
  const brain = new BrainyData()
  await brain.init() // Works in browser
</script>
```

## 🚨 Troubleshooting

| Error | Solution |
|-------|----------|
| "Failed to load embedding model" | `npm run download-models` |
| "ENOENT: no such file" | Check `BRAINY_MODELS_PATH` |
| "Network timeout" | Set `BRAINY_ALLOW_REMOTE_MODELS=false` |
| "Permission denied" | `chmod 755 ./models` |
| "Out of memory" | Increase container memory limit |

## 🎯 Environment Variables

| Variable | Values | Purpose |
|----------|--------|---------|
| `BRAINY_ALLOW_REMOTE_MODELS` | `true`/`false` | Allow/block downloads |
| `BRAINY_MODELS_PATH` | `./models` | Model storage path |
| `BRAINY_Q8_CONFIRMED` | `true`/`false` | Silence Q8 compatibility warnings |
| `NODE_ENV` | `production` | Environment detection |

## 📦 Model Info

### FP32 (Default)
- **Model**: All-MiniLM-L6-v2 
- **Dimensions**: 384 (fixed)
- **Size**: 90MB
- **Accuracy**: 100% (baseline)
- **Location**: `./models/Xenova/all-MiniLM-L6-v2/onnx/model.onnx`

### Q8 (Optional - v2.8.0+)
- **Model**: All-MiniLM-L6-v2 (quantized)
- **Dimensions**: 384 (same)
- **Size**: 23MB (75% smaller!)
- **Accuracy**: ~99% (minimal loss)
- **Location**: `./models/Xenova/all-MiniLM-L6-v2/onnx/model_quantized.onnx`

**⚠️ Important**: FP32 and Q8 create different embeddings and are incompatible!

## ✅ Verification Commands

```bash
# Check FP32 model exists
ls ./models/Xenova/all-MiniLM-L6-v2/onnx/model.onnx

# Check Q8 model exists  
ls ./models/Xenova/all-MiniLM-L6-v2/onnx/model_quantized.onnx

# Test offline mode
BRAINY_ALLOW_REMOTE_MODELS=false npm test

# Download fresh models (both)
rm -rf ./models && npm run download-models

# Download specific model variant
rm -rf ./models && npm run download-models:q8
```