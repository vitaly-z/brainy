# 🤖 Model Loading Quick Reference

## 🚀 Common Scenarios

### ✅ Development (Zero Config)
```typescript
const brain = new BrainyData()
await brain.init() // Downloads automatically
```

### 🐳 Docker Production
```dockerfile
RUN npm run download-models
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
| `NODE_ENV` | `production` | Environment detection |

## 📦 Model Info

- **Model**: All-MiniLM-L6-v2 
- **Dimensions**: 384 (fixed)
- **Size**: ~80MB download, ~330MB uncompressed
- **Location**: `./models/Xenova/all-MiniLM-L6-v2/`

## ✅ Verification Commands

```bash
# Check models exist
ls ./models/Xenova/all-MiniLM-L6-v2/onnx/model.onnx

# Test offline mode
BRAINY_ALLOW_REMOTE_MODELS=false npm test

# Download fresh models
rm -rf ./models && npm run download-models
```