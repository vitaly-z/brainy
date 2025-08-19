# Brainy Deployment Guide

## Model Management

Brainy uses the Xenova/all-MiniLM-L6-v2 transformer model (87MB) for embeddings. The model is **critical** for operations and intelligently handles availability.

### How It Works

1. **First Use**: Automatically downloads from Hugging Face → GitHub → CDN (fallback chain)
2. **Cached Forever**: Once downloaded, never re-downloads
3. **Multiple Sources**: Falls back to our GitHub/CDN if Hugging Face is unavailable
4. **Smart Detection**: Automatically finds models in cache, bundled, or downloads as needed

### Deployment Scenarios

#### 🚀 Standard Deployment (Recommended)
```bash
npm install @soulcraft/brainy
# Models download automatically on first use
```

#### 🐳 Docker with Restricted Production
```dockerfile
FROM node:24-slim AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install @soulcraft/brainy
# Download models during build (internet available)
RUN npm run download-models
COPY . .

FROM node:24-slim
WORKDIR /app
COPY --from=builder /app .
# Production has models, works offline
CMD ["node", "server.js"]
```

#### ⚡ Serverless (AWS Lambda)
```javascript
// Lambda Layer with pre-downloaded models
process.env.TRANSFORMERS_CACHE = '/opt/models'

// Or include in deployment package
// Run locally: npm run download-models
// Then include ./models/ in your deployment zip
```

#### ☸️ Kubernetes
```yaml
apiVersion: apps/v1
kind: Deployment
spec:
  template:
    spec:
      initContainers:
      - name: model-downloader
        image: node:24-slim
        command: 
        - sh
        - -c
        - |
          npm install @soulcraft/brainy
          npm run download-models
        volumeMounts:
        - name: models
          mountPath: /models
      containers:
      - name: app
        volumeMounts:
        - name: models
          mountPath: /app/models
      volumes:
      - name: models
        emptyDir: {}
```

#### 🔒 Air-Gapped Environment
```bash
# On machine with internet:
npm install @soulcraft/brainy
npm run download-models
tar -czf brainy-models.tar.gz models/

# On air-gapped machine:
tar -xzf brainy-models.tar.gz
# Models now available offline
```

### Model Scripts

```bash
# Intelligent preparation (auto-detects context)
npm run prepare-models

# Force download from all sources
npm run models:download  

# Verify models exist (for CI/CD)
npm run models:verify

# Legacy download script
npm run download-models
```

### Environment Variables

```bash
# Skip automatic model download
BRAINY_SKIP_MODEL_DOWNLOAD=true

# Allow remote model downloads in production
BRAINY_ALLOW_REMOTE_MODELS=true

# Custom model cache directory
TRANSFORMERS_CACHE=/custom/path/to/models

# Force specific model source
BRAINY_MODEL_SOURCE=github  # github | cdn | huggingface
```

### Model Files

The complete model consists of:
- `config.json` (650 bytes)
- `tokenizer.json` (695 KB)  
- `tokenizer_config.json` (366 bytes)
- `onnx/model.onnx` (87 MB)

Total: ~87.7 MB

### Fallback Chain

If Hugging Face is unavailable, Brainy automatically tries:

1. **GitHub Releases**: `github.com/soulcraftlabs/brainy-models`
2. **Soulcraft CDN**: `models.soulcraft.com` (future)
3. **Local Cache**: Previously downloaded models

### Verification

Models are verified by:
- File existence check
- Size verification (model.onnx must be ~87MB)
- SHA256 hash (optional, for high security)
- Load test (can the model actually run?)

### Best Practices

1. **Development**: Let models auto-download on first use
2. **CI/CD**: Pre-download in build stage with `npm run download-models`
3. **Production**: Include models in container/deployment package
4. **High Availability**: Host models on your own CDN as backup

### Troubleshooting

**Models not downloading?**
```bash
# Check network access
curl -I https://huggingface.co

# Force download with verbose output
BRAINY_VERBOSE=true npm run download-models

# Use specific source
BRAINY_MODEL_SOURCE=github npm run download-models
```

**Models too large for deployment?**
- Consider using a shared volume or layer
- Host models on your CDN and download at startup
- Use model quantization (future feature)

**Verification failing?**
```bash
# Check model integrity
npm run models:verify

# Re-download if corrupted
rm -rf models/
npm run download-models
```