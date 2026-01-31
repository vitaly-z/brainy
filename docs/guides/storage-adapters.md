# Storage Adapters Guide

## Overview
Brainy supports 6 storage adapters for different deployment environments. All adapters implement the same StorageAdapter interface and support copy-on-write branching.

## Adapters

### 1. MemoryStorage
- **File**: `src/storage/adapters/memoryStorage.ts`
- **Use case**: Development, testing, prototyping
- **Configuration**: None required
- **Persistence**: None (data lost on restart)
- **Batch config**: 1000 batch size, 0ms delay, 1000 concurrent ops, 100k ops/sec

```typescript
const brain = new Brainy({ storage: { type: 'memory' } })
```

### 2. FileSystemStorage
- **File**: `src/storage/adapters/fileSystemStorage.ts`
- **Use case**: Node.js local persistence, single-server deployments
- **Configuration**: `basePath` (required), `readOnly` (optional)
- **Features**: zlib compression, atomic writes via temp files, UUID-based sharding

```typescript
const brain = new Brainy({
  storage: { type: 'filesystem', path: './brainy-data' }
})
```

### 3. S3CompatibleStorage
- **File**: `src/storage/adapters/s3CompatibleStorage.ts`
- **Use case**: AWS S3, MinIO, DigitalOcean Spaces, any S3-compatible service
- **Configuration**: `bucketName`, `region`, `accessKeyId`, `secretAccessKey`, `endpoint?` (for custom endpoints), `s3ForcePathStyle?`
- **Features**: Write buffering, request coalescing, throttling detection (429/503), progressive initialization
- **Batch config**: 1000 batch size, 150 concurrent ops, 5000 ops/sec burst

```typescript
const brain = new Brainy({
  storage: {
    type: 's3',
    s3Storage: {
      bucketName: 'my-brainy-data',
      region: 'us-east-1',
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
    }
  }
})

// For MinIO or other S3-compatible services:
const brain = new Brainy({
  storage: {
    type: 's3',
    s3Storage: {
      bucketName: 'my-data',
      region: 'us-east-1',
      endpoint: 'http://localhost:9000',
      s3ForcePathStyle: true,
      accessKeyId: 'minio-key',
      secretAccessKey: 'minio-secret'
    }
  }
})
```

### 4. R2Storage (Cloudflare)
- **File**: `src/storage/adapters/r2Storage.ts`
- **Use case**: Zero egress fees, cost-effective cloud storage
- **Configuration**: `bucketName`, `accountId`, `accessKeyId`, `secretAccessKey`, `cacheConfig?`
- **Features**: Zero egress fees, aggressive caching, write buffering, request coalescing
- **Batch config**: 1000 batch size, 150 concurrent ops, 6000 ops/sec

```typescript
const brain = new Brainy({
  storage: {
    type: 'r2',
    r2Storage: {
      accountId: process.env.CF_ACCOUNT_ID,
      bucketName: 'my-brainy-data',
      accessKeyId: process.env.CF_ACCESS_KEY_ID,
      secretAccessKey: process.env.CF_SECRET_ACCESS_KEY
    }
  }
})
```

### 5. GcsStorage (Google Cloud)
- **File**: `src/storage/adapters/gcsStorage.ts`
- **Use case**: Google Cloud ecosystem, Cloud Run deployments
- **Authentication priority**:
  1. Service Account Key File (`keyFilename`)
  2. Credentials Object (`credentials`)
  3. HMAC Keys (backward compat)
  4. Application Default Credentials (automatic in Cloud Run)
- **Features**: Progressive initialization (fast cold starts <200ms), Autoclass lifecycle, bucket validation
- **Batch config**: 1000 batch size, 100 concurrent ops, 1000 ops/sec

```typescript
// With explicit credentials
const brain = new Brainy({
  storage: {
    type: 'gcs',
    gcsStorage: {
      bucketName: 'my-brainy-data',
      keyFilename: './service-account.json'
    }
  }
})

// In Cloud Run (uses Application Default Credentials automatically)
const brain = new Brainy({
  storage: {
    type: 'gcs',
    gcsStorage: {
      bucketName: 'my-brainy-data'
    }
  }
})
```

**Progressive Initialization Modes:**
- `'strict'` (default locally): Full validation during init (100-500ms+)
- `'progressive'` (default in Cloud Run/Lambda): Fast init <200ms, background validation
- `'auto'`: Auto-detects environment

### 6. AzureBlobStorage
- **File**: `src/storage/adapters/azureBlobStorage.ts`
- **Use case**: Azure ecosystem, enterprise deployments
- **Authentication priority**:
  1. DefaultAzureCredential (Managed Identity - automatic in Azure)
  2. Connection String
  3. Account Name + Account Key
  4. SAS Token
- **Features**: Progressive initialization, lifecycle management, container validation
- **Batch config**: 1000 batch size, 100 concurrent ops, 3000 ops/sec

```typescript
// With connection string
const brain = new Brainy({
  storage: {
    type: 'azure',
    azureStorage: {
      connectionString: process.env.AZURE_STORAGE_CONNECTION_STRING,
      containerName: 'brainy-data'
    }
  }
})

// With Managed Identity (automatic in Azure App Service/Functions)
const brain = new Brainy({
  storage: {
    type: 'azure',
    azureStorage: {
      containerName: 'brainy-data'
      // DefaultAzureCredential used automatically
    }
  }
})
```

## Choosing an Adapter

| Scenario | Recommended Adapter |
|----------|-------------------|
| Development/Testing | MemoryStorage |
| Local persistence | FileSystemStorage |
| AWS deployment | S3CompatibleStorage |
| Google Cloud / Cloud Run | GcsStorage |
| Azure deployment | AzureBlobStorage |
| Cost-sensitive (high egress) | R2Storage |
| Self-hosted (MinIO) | S3CompatibleStorage |

## Common Configuration

All cloud adapters support:
- **Progressive initialization** for fast serverless cold starts
- **Read-only mode** (`readOnly: true`)
- **Cache configuration** (`cacheConfig: { hotCacheMaxSize, warmCacheTTL }`)
- **Copy-on-write branching** for git-style data management

## See Also

- [Cloud Deployment Guide](../deployment/CLOUD_DEPLOYMENT_GUIDE.md)
- [Cost Optimization: AWS S3](../operations/cost-optimization-aws-s3.md)
- [Cost Optimization: GCS](../operations/cost-optimization-gcs.md)
- [Cost Optimization: Azure](../operations/cost-optimization-azure.md)
- [Cost Optimization: R2](../operations/cost-optimization-cloudflare-r2.md)
