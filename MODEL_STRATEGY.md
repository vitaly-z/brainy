# Brainy Model Management Strategy

## Critical Requirement
The Xenova/all-MiniLM-L6-v2 transformer model (87MB) is **essential** for Brainy operations. It must be available and never change to ensure consistent embeddings across all deployments.

## Current Approach: Hybrid Model Management

### 1. **NPM Package** (Default)
- Models are NOT included in the NPM package (keeps it small at 643KB)
- Models download automatically on first use
- Cached locally after first download
- Perfect for: Development, most deployments

### 2. **Docker/CI** (Production)
```dockerfile
# Download models during build when internet is available
RUN npm install @soulcraft/brainy
RUN npm run download-models  # Downloads to ./models/
# Models are now part of the container image
```

### 3. **CDN Fallback** (Future)
- Host models on cdn.soulcraft.com
- Provides reliable fallback if Hugging Face is down
- Ensures we control model availability

## File Structure
```
models/
├── Xenova/
│   └── all-MiniLM-L6-v2/
│       ├── config.json (650 bytes)
│       ├── tokenizer.json (695 KB)
│       ├── tokenizer_config.json (366 bytes)
│       └── onnx/
│           └── model.onnx (87 MB)
└── .brainy-models-bundled (marker file)
```

## Why NOT in Git Repository

1. **Size**: 87MB is too large for comfortable Git operations
2. **Git LFS Complexity**: Requires additional setup, costs money
3. **Flexibility**: Different deployment strategies need different approaches
4. **NPM Package Size**: Would bloat package from 643KB to 88MB+

## Deployment Strategies

### A. Standard Web App
```bash
npm install @soulcraft/brainy
# Models download on first use, cached forever
```

### B. Serverless/Lambda
```javascript
// Pre-download in Lambda layer
const modelLayer = '/opt/models'
process.env.TRANSFORMERS_CACHE = modelLayer
```

### C. Kubernetes
```yaml
# Init container downloads models
initContainers:
- name: download-models
  command: ['npm', 'run', 'download-models']
  volumeMounts:
  - name: models
    mountPath: /app/models
```

### D. Offline Environment
```bash
# Download during build/packaging
npm run download-models
tar -czf models.tar.gz models/
# Deploy tar file with application
```

## Model Integrity

The model MUST remain unchanged. We ensure this by:

1. **Pinned Version**: Always use Xenova/all-MiniLM-L6-v2
2. **Hash Verification**: Check SHA256 of model.onnx
3. **Size Verification**: Ensure model.onnx is exactly 90,555,481 bytes
4. **Local Cache**: Once downloaded, never re-download

## Implementation in Code

```javascript
// src/embeddings/index.ts
import { env } from '@huggingface/transformers'

// Configure model location (in order of preference)
env.localModelPath = [
  './models',           // Local bundled models
  '/opt/models',        // Lambda layer
  process.env.MODELS_PATH,  // Custom path
  env.cacheDir          // Default cache
].find(p => p && fs.existsSync(path.join(p, 'Xenova')))

// Disable remote models in production
if (process.env.NODE_ENV === 'production') {
  env.allowRemoteModels = false
}
```

## Verification Script

Run `npm run verify-models` to check:
- ✅ All required model files exist
- ✅ File sizes match expected
- ✅ SHA256 hashes match (optional)
- ✅ Model can be loaded successfully

## Summary

- **Development**: Models auto-download on first use
- **Production**: Models pre-downloaded during build
- **Distribution**: NPM package stays small (643KB)
- **Reliability**: Models always available, never change
- **Flexibility**: Multiple deployment strategies supported