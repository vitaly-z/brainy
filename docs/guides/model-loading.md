# Model Loading Guide

Brainy uses AI embedding models to understand and process your data. With the Candle WASM engine, the model is **embedded at compile time** - no downloads, no configuration, no external dependencies.

## Zero Configuration (Default)

**For all developers, no configuration is needed:**

```typescript
const brain = new Brainy()
await brain.init() // Model is already embedded - nothing to download!
```

**What happens automatically:**
1. Candle WASM module loads (~90MB, includes model weights)
2. Model initializes in ~200ms
3. Ready to use immediately

**No downloads. No CDN. No configuration. Just works.**

## How It Works

The all-MiniLM-L6-v2 model is embedded in the WASM binary using Rust's `include_bytes!` macro:

```
candle_embeddings_bg.wasm (~90MB)
├── Candle ML Runtime (~3MB)
├── Model Weights (safetensors format, ~87MB)
└── Tokenizer (HuggingFace tokenizers, ~450KB)
```

This single WASM file contains everything needed for sentence embeddings.

## Environments

### Bun (Recommended)

```typescript
// Works with Bun runtime
bun run server.ts

// Works with bun --compile (single binary deployment!)
bun build --compile --target=bun server.ts
./server  // Self-contained binary with embedded model
```

### Node.js

```typescript
// Standard Node.js
node dist/server.js

// Runs identically to Bun
```

### Browser

```typescript
// Model loads via WASM (single file, no additional assets)
const brain = new Brainy()
await brain.init()
```

### Docker/Kubernetes

```dockerfile
FROM oven/bun:1.1
WORKDIR /app
COPY package*.json ./
RUN bun install
COPY . .
EXPOSE 3000
CMD ["bun", "run", "server.ts"]

# That's it! No model download step needed.
# Model is embedded in the npm package.
```

## Model Information

### all-MiniLM-L6-v2 (Embedded)
- **Dimensions**: 384 (fixed)
- **Format**: Safetensors (FP32)
- **Size**: ~87MB (embedded in WASM)
- **Total WASM Size**: ~90MB
- **Language**: English-optimized, works with all languages
- **Inference**: ~2-10ms per embedding
- **Initialization**: ~200ms

### Memory Usage
- **Loaded WASM**: ~90MB
- **Inference peak**: ~140MB total
- **Steady state**: ~100MB

## Comparing to Previous Architecture

| Feature | Before (ONNX) | Now (Candle WASM) |
|---------|--------------|-------------------|
| Model downloads | Required on first use | None - embedded |
| External dependencies | onnxruntime-web | None |
| Model files | model.onnx, tokenizer.json | Embedded in WASM |
| Offline support | Required setup | Works by default |
| Bun compile | Broken | Works |
| Configuration | Environment variables | None needed |

## Troubleshooting

### "Failed to initialize Candle Embedding Engine"

**Cause**: WASM loading issue.

**Solutions**:
```bash
# Rebuild the WASM
npm run build:candle

# Verify WASM exists
ls dist/embeddings/wasm/pkg/candle_embeddings_bg.wasm
# Should be ~90MB
```

### Out of Memory

**Cause**: Container/environment has less than 256MB RAM.

**Solutions**:
```dockerfile
# Increase memory limit (recommended: 512MB+)
docker run -m 512m my-app
```

### Slow Initialization (>500ms)

**Cause**: Cold start, large WASM parsing.

**Solutions**:
```typescript
// Initialize once at startup, not per-request
await brain.init()  // Do this once

// Then reuse for all requests
app.get('/api', async (req, res) => {
  const results = await brain.find(req.query)
  res.json(results)
})
```

## Migration from Previous Versions

### From v6.x (ONNX)

No changes needed for most users:

```typescript
// Same API - just upgrade
const brain = new Brainy()
await brain.init()
```

**What's removed:**
- `BRAINY_ALLOW_REMOTE_MODELS` - no downloads
- `BRAINY_MODELS_PATH` - no external model files
- `npm run download-models` - no longer needed

**What's new:**
- Faster initialization
- Works with `bun --compile`
- No network requirements

### From Custom Embedding Functions

If you provided a custom embedding function, it still works:

```typescript
const brain = new Brainy({
  embeddingFunction: myCustomEmbedder  // Still supported
})
```

## Advanced: Building Custom WASM

For contributors who want to modify the embedding engine:

```bash
# Navigate to Candle WASM source
cd src/embeddings/candle-wasm

# Build with wasm-pack
wasm-pack build --target web --release

# Copy to pkg folder
cp pkg/* ../wasm/pkg/

# Build TypeScript
npm run build
```

## Best Practices

### Development
```typescript
// Just works - no setup
const brain = new Brainy()
await brain.init()
```

### Production
```typescript
// Initialize once at startup
const brain = new Brainy()
await brain.init()

// Singleton pattern recommended
export { brain }
```

### Deployment
```bash
# Option 1: Bun compile (single binary)
bun build --compile server.ts
./server  # Contains everything

# Option 2: Docker
docker build -t my-app .
docker run -p 3000:3000 my-app
```

---

## Additional Resources

- [Production Service Architecture](../PRODUCTION_SERVICE_ARCHITECTURE.md)
- [Zero Configuration Guide](../architecture/zero-config.md)
- [Troubleshooting Guide](../troubleshooting.md)

**Need help?** [Open an issue](https://github.com/soulcraftlabs/brainy/issues)
