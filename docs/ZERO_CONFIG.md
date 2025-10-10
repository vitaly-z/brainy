# 🚀 Brainy Zero-Configuration Guide

## Overview

Starting with v2.10, Brainy introduces a **Zero-Configuration System** that automatically configures everything based on your environment. No more environment variables, no more complex configuration objects - just create and use.

## Quick Start

### True Zero Config
```typescript
import { Brainy } from '@soulcraft/brainy'

// That's it! Everything auto-configures
const brain = new Brainy()
await brain.init()
```

### Using Strongly-Typed Presets

```typescript
import { Brainy, PresetName } from '@soulcraft/brainy'

// Type-safe preset selection
const brain = new Brainy(PresetName.PRODUCTION)
await brain.init()
```

### Common Scenarios

#### Development
```typescript
const brain = new Brainy(PresetName.DEVELOPMENT)
// ✅ Filesystem storage for persistence
// ✅ FP32 models for best quality
// ✅ Verbose logging
// ✅ All features enabled
```

#### Production
```typescript
const brain = new Brainy(PresetName.PRODUCTION)
// ✅ Disk storage for persistence
// ✅ Auto-selected model precision
// ✅ Silent logging
// ✅ Optimized features
```

#### Minimal
```typescript
const brain = new Brainy(PresetName.MINIMAL)
// ✅ Filesystem storage
// ✅ Q8 models for small size
// ✅ Core features only
// ✅ Minimal resource usage
```

## Distributed Architecture Presets

Brainy includes specialized presets for distributed and microservice architectures:

### Basic Distributed Roles
```typescript
import { Brainy, PresetName } from '@soulcraft/brainy'

// Write-only instance (data ingestion)
const writer = new Brainy(PresetName.WRITER)
// ✅ Optimized for writes
// ✅ No search index loading
// ✅ Minimal memory usage

// Read-only instance (search API)
const reader = new Brainy(PresetName.READER)
// ✅ Optimized for search
// ✅ Lazy index loading
// ✅ Large cache
```

### Service-Specific Presets
```typescript
// High-throughput data ingestion
const ingestion = new Brainy(PresetName.INGESTION_SERVICE)

// Low-latency search API
const searchApi = new Brainy(PresetName.SEARCH_API)

// Analytics processing
const analytics = new Brainy(PresetName.ANALYTICS_SERVICE)

// Edge location cache
const edge = new Brainy(PresetName.EDGE_CACHE)

// Batch processing
const batch = new Brainy(PresetName.BATCH_PROCESSOR)

// Real-time streaming
const streaming = new Brainy(PresetName.STREAMING_SERVICE)

// ML training
const training = new Brainy(PresetName.ML_TRAINING)

// Lightweight sidecar
const sidecar = new Brainy(PresetName.SIDECAR)
```

## Model Precision Control

You can **explicitly specify** model precision when needed:

```typescript
import { ModelPrecision } from '@soulcraft/brainy'

// Force FP32 (full precision)
const brain = new Brainy({ model: ModelPrecision.FP32 })

// Force Q8 (quantized, smaller)
const brain = new Brainy({ model: ModelPrecision.Q8 })

// Use presets
const brain = new Brainy({ model: ModelPrecision.FAST })  // Maps to fp32
const brain = new Brainy({ model: ModelPrecision.SMALL }) // Maps to q8

// Auto-detection (default)
const brain = new Brainy({ model: ModelPrecision.AUTO })
```

### Auto-Detection Logic

When not specified, Brainy automatically selects the best model:

- **Browser**: Q8 (smaller download)
- **Serverless**: Q8 (faster cold starts)
- **Low Memory (<512MB)**: Q8
- **Development**: FP32 (best quality)
- **Production (>2GB RAM)**: FP32
- **Default**: Q8 (balanced)

## Storage Configuration

### Automatic Storage Detection

Brainy automatically detects the best storage option:

1. **Cloud Storage** (if credentials found)
   - AWS S3 (checks AWS_ACCESS_KEY_ID, AWS_PROFILE)
   - Google Cloud Storage (checks GOOGLE_APPLICATION_CREDENTIALS)
   - Cloudflare R2 (checks R2_ACCESS_KEY_ID)

2. **Browser Storage**
   - OPFS (if supported)
   - Filesystem fallback

3. **Node.js Storage**
   - Filesystem (`./brainy-data` or `~/.brainy/data`)

### Manual Storage Control

```typescript
import { StorageOption } from '@soulcraft/brainy'

// Force specific storage with enum
const brain = new Brainy({ storage: StorageOption.DISK })
const brain = new Brainy({ storage: StorageOption.CLOUD })
const brain = new Brainy({ storage: StorageOption.AUTO })

// Custom storage configuration
const brain = new Brainy({
  storage: {
    s3Storage: {
      bucket: 'my-bucket',
      region: 'us-east-1'
    }
  }
})
```

## Feature Sets

Control which features are enabled:

```typescript
import { FeatureSet } from '@soulcraft/brainy'

// Preset feature sets with enum
const brain = new Brainy({ features: FeatureSet.MINIMAL })  // Core only
const brain = new Brainy({ features: FeatureSet.DEFAULT })  // Balanced
const brain = new Brainy({ features: FeatureSet.FULL })     // Everything

// Custom features
const brain = new Brainy({
  features: ['core', 'search', 'cache', 'triple-intelligence']
})
```

## Simplified Configuration Interface

The new configuration is dramatically simpler:

```typescript
interface BrainyZeroConfig {
  // Mode preset - now with distributed options
  mode?: PresetName  // All strongly typed presets
  
  // Model configuration with enum
  model?: ModelPrecision
  
  // Storage configuration with enum
  storage?: StorageOption | StorageConfig
  
  // Feature set with enum
  features?: FeatureSet | string[]
  
  // Logging
  verbose?: boolean
  
  // Escape hatch for advanced users
  advanced?: any
}
```

### Available Enums

```typescript
enum PresetName {
  // Basic
  PRODUCTION = 'production',
  DEVELOPMENT = 'development',
  MINIMAL = 'minimal',
  ZERO = 'zero',
  
  // Distributed
  WRITER = 'writer',
  READER = 'reader',
  
  // Services
  INGESTION_SERVICE = 'ingestion-service',
  SEARCH_API = 'search-api',
  ANALYTICS_SERVICE = 'analytics-service',
  EDGE_CACHE = 'edge-cache',
  BATCH_PROCESSOR = 'batch-processor',
  STREAMING_SERVICE = 'streaming-service',
  ML_TRAINING = 'ml-training',
  SIDECAR = 'sidecar'
}

enum ModelPrecision {
  FP32 = 'fp32',
  Q8 = 'q8',
  AUTO = 'auto',
  FAST = 'fast',  // Maps to fp32
  SMALL = 'small' // Maps to q8
}

enum StorageOption {
  AUTO = 'auto',
  DISK = 'disk',
  CLOUD = 'cloud'
}

enum FeatureSet {
  MINIMAL = 'minimal',
  DEFAULT = 'default',
  FULL = 'full'
}
```

## Multi-Instance with Shared Storage

When multiple Brainy instances connect to the same storage (like S3), you **must ensure they use compatible configurations**:

```typescript
import { ModelPrecision } from '@soulcraft/brainy'

// Container A - Writer
const writer = new Brainy({
  mode: PresetName.WRITER,
  model: ModelPrecision.FP32,  // ⚠️ MUST match across instances!
  storage: { s3Storage: { bucket: 'shared-data' }}
})

// Container B - Reader
const reader = new Brainy({
  mode: PresetName.READER,
  model: ModelPrecision.FP32,  // ✅ Matches Container A
  storage: { s3Storage: { bucket: 'shared-data' }}
})
```

### Distributed Architecture Example

```typescript
// Ingestion Service (Writer)
const ingestion = new Brainy({
  mode: PresetName.INGESTION_SERVICE,
  model: ModelPrecision.Q8,  // All instances must use Q8
  storage: { s3Storage: { bucket: 'production-data' }}
})

// Search API (Reader)
const search = new Brainy({
  mode: PresetName.SEARCH_API,
  model: ModelPrecision.Q8,  // Matches ingestion service
  storage: { s3Storage: { bucket: 'production-data' }}
})

// Analytics (Hybrid)
const analytics = new Brainy({
  mode: PresetName.ANALYTICS_SERVICE,
  model: ModelPrecision.Q8,  // Matches other services
  storage: { s3Storage: { bucket: 'production-data' }}
})
```

## Migration from Old Configuration

### Before (Complex)
```typescript
const brain = new Brainy({
  hnsw: {
    M: 16,
    efConstruction: 200,
    seed: 42
  },
  storage: {
    s3Storage: {
      bucketName: 'my-bucket',
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      region: 'us-east-1'
    },
    cacheConfig: {
      hotCacheMaxSize: 5000,
      hotCacheEvictionThreshold: 0.8,
      warmCacheTTL: 3600000,
      batchSize: 100
    }
  },
  cache: {
    autoTune: true,
    autoTuneInterval: 60000,
    hotCacheMaxSize: 10000
  },
  embeddingFunction: customFunction,
  readOnly: false,
  logging: { verbose: true }
})
```

### After (Simple)
```typescript
const brain = new Brainy('production')
// Everything above is auto-configured!
```

## Environment Variables (No Longer Needed!)

These environment variables are **no longer required**:

- ❌ `BRAINY_ALLOW_REMOTE_MODELS` - Models auto-download when needed
- ❌ `BRAINY_MODELS_PATH` - Path auto-selected based on environment
- ❌ `BRAINY_Q8_CONFIRMED` - Warnings auto-suppressed in production
- ❌ `BRAINY_LOG_LEVEL` - Auto-set based on NODE_ENV
- ❌ AWS credentials - Use AWS SDK credential chain

## Performance Impact

The zero-config system has **zero performance overhead**:

- Configuration happens once during initialization
- Auto-detected values are cached
- Same optimized code paths as manual configuration
- Actually **faster** startup due to reduced parsing

## Troubleshooting

### Models Not Downloading
- Check internet connection
- Ensure firewall allows HTTPS to Hugging Face / CDN
- Run `npm run download-models` to pre-download

### Wrong Model Precision
- Explicitly specify: `{ model: 'fp32' }` or `{ model: 'q8' }`
- Check shared storage compatibility

### Storage Detection Issues
- Check cloud credentials are properly configured
- Verify write permissions for filesystem paths
- Use explicit storage configuration if needed

## Best Practices

1. **Use zero-config for single instances** - Let Brainy handle everything
2. **Specify precision for shared storage** - Ensure compatibility
3. **Use presets for common scenarios** - 'development', 'production', 'minimal'
4. **Override only what you need** - Start simple, add complexity only if required

## Summary

The new zero-config system reduces configuration from **100+ parameters** to **0-3 decisions**:

| Scenario | Old Config Lines | New Config Lines |
|----------|-----------------|------------------|
| Development | 50+ | 1 |
| Production | 100+ | 1 |
| Custom | 200+ | 3-5 |

**Result**: 95% less configuration, 100% of the power! 🚀