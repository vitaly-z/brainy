# Brainy 3.0 Cloud Deployment Guide

This guide provides production-ready deployment configurations for Brainy using S3CompatibleStorage (preferred) or FileSystemStorage across major cloud platforms. All examples are verified against the actual Brainy 3.0 codebase.

## Overview

The API Server augmentation provides a universal handler that works with standard Request/Response objects, making Brainy deployable on any JavaScript runtime.

## Storage Adapter

**S3CompatibleStorage** is the preferred storage adapter for cloud deployments. It works with:
- Amazon S3
- Cloudflare R2
- Google Cloud Storage
- Azure Blob Storage
- Any S3-compatible service

## Deployment Examples

### AWS Lambda

```javascript
// handler.js
const { Brainy } = require('@soulcraft/brainy')
const { S3CompatibleStorage } = require('@soulcraft/brainy/storage')

let brain
let handler

exports.handler = async (event) => {
  if (!brain) {
    const storage = new S3CompatibleStorage({
      endpoint: 's3.amazonaws.com',
      region: process.env.AWS_REGION,
      bucket: process.env.BRAINY_BUCKET,
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      prefix: 'brainy-data/'
    })
    
    brain = new Brainy({
      storage,
      augmentations: [{
        name: 'api-server',
        config: {
          enabled: true,
          auth: {
            required: true,
            apiKeys: [process.env.API_KEY]
          }
        }
      }]
    })
    
    await brain.init()
    
    // Get the universal handler from the augmentation
    const apiAugmentation = brain.augmentationRegistry.getAugmentation('api-server')
    handler = apiAugmentation.createUniversalHandler()
  }
  
  // Convert Lambda event to Request
  const url = `https://${event.requestContext.domainName}${event.rawPath}`
  const request = new Request(url, {
    method: event.requestContext.http.method,
    headers: event.headers,
    body: event.body
  })
  
  // Use the universal handler
  const response = await handler(request)
  
  return {
    statusCode: response.status,
    headers: Object.fromEntries(response.headers),
    body: await response.text()
  }
}
```

### Google Cloud Functions

```javascript
// index.js
const { Brainy } = require('@soulcraft/brainy')
const { S3CompatibleStorage } = require('@soulcraft/brainy/storage')

let brain
let handler

exports.brainyAPI = async (req, res) => {
  if (!brain) {
    const storage = new S3CompatibleStorage({
      endpoint: 'storage.googleapis.com',
      bucket: process.env.GCS_BUCKET,
      accessKeyId: process.env.GCS_ACCESS_KEY,
      secretAccessKey: process.env.GCS_SECRET_KEY,
      prefix: 'brainy/',
      forcePathStyle: false,
      region: 'US'
    })
    
    brain = new Brainy({ storage })
    await brain.init()
    
    const apiAugmentation = brain.augmentationRegistry.getAugmentation('api-server')
    handler = apiAugmentation.createUniversalHandler()
  }
  
  // Convert Express req/res to Request/Response
  const request = new Request(`https://${req.hostname}${req.originalUrl}`, {
    method: req.method,
    headers: req.headers,
    body: JSON.stringify(req.body)
  })
  
  const response = await handler(request)
  
  res.status(response.status)
  res.set(Object.fromEntries(response.headers))
  res.send(await response.text())
}
```

### Google Cloud Run with Cloud Storage

Google Cloud Run is ideal for containerized deployments with automatic scaling. This example uses Google Cloud Storage via the S3-compatible API.

```javascript
// server.js
import { Brainy } from '@soulcraft/brainy'
import { S3CompatibleStorage } from '@soulcraft/brainy/storage'
import express from 'express'

const app = express()
app.use(express.json())

const PORT = process.env.PORT || 8080

let brain
let handler

async function initBrainy() {
  // Google Cloud Storage is S3-compatible
  const storage = new S3CompatibleStorage({
    endpoint: 'storage.googleapis.com',
    bucket: process.env.GCS_BUCKET || 'brainy-data',
    accessKeyId: process.env.GCS_ACCESS_KEY,
    secretAccessKey: process.env.GCS_SECRET_KEY,
    prefix: 'brainy/',
    forcePathStyle: false,
    region: process.env.GCS_REGION || 'US'
  })
  
  brain = new Brainy({
    storage,
    augmentations: [{
      name: 'api-server',
      config: {
        enabled: true,
        port: PORT,
        cors: {
          origin: process.env.CORS_ORIGIN || '*'
        },
        auth: {
          required: process.env.AUTH_REQUIRED === 'true',
          apiKeys: process.env.API_KEY ? [process.env.API_KEY] : []
        }
      }
    }]
  })
  
  await brain.init()
  
  const apiAugmentation = brain.augmentationRegistry.getAugmentation('api-server')
  handler = apiAugmentation.createUniversalHandler()
}

// Initialize on startup
await initBrainy()

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', service: 'brainy-api' })
})

// Universal handler for all API routes
app.use('*', async (req, res) => {
  const request = new Request(`https://${req.hostname}${req.originalUrl}`, {
    method: req.method,
    headers: req.headers,
    body: req.method !== 'GET' ? JSON.stringify(req.body) : undefined
  })
  
  const response = await handler(request)
  
  res.status(response.status)
  res.set(Object.fromEntries(response.headers))
  res.send(await response.text())
})

app.listen(PORT, () => {
  console.log(`Brainy API running on port ${PORT}`)
})
```

```dockerfile
# Dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
COPY . .
EXPOSE 8080
CMD ["node", "server.js"]
```

```yaml
# cloudbuild.yaml
steps:
  # Build the container image
  - name: 'gcr.io/cloud-builders/docker'
    args: ['build', '-t', 'gcr.io/$PROJECT_ID/brainy-api:$COMMIT_SHA', '.']
  
  # Push to Container Registry
  - name: 'gcr.io/cloud-builders/docker'
    args: ['push', 'gcr.io/$PROJECT_ID/brainy-api:$COMMIT_SHA']
  
  # Deploy to Cloud Run
  - name: 'gcr.io/google.com/cloudsdktool/cloud-sdk'
    entrypoint: gcloud
    args:
      - 'run'
      - 'deploy'
      - 'brainy-api'
      - '--image'
      - 'gcr.io/$PROJECT_ID/brainy-api:$COMMIT_SHA'
      - '--region'
      - 'us-central1'
      - '--platform'
      - 'managed'
      - '--allow-unauthenticated'
      - '--set-env-vars'
      - 'GCS_BUCKET=brainy-storage,GCS_REGION=US'
      - '--set-secrets'
      - 'GCS_ACCESS_KEY=gcs-access-key:latest,GCS_SECRET_KEY=gcs-secret-key:latest'
      - '--memory'
      - '2Gi'
      - '--cpu'
      - '2'
      - '--max-instances'
      - '100'
      - '--min-instances'
      - '0'

images:
  - 'gcr.io/$PROJECT_ID/brainy-api:$COMMIT_SHA'
```

**Deploy with gcloud CLI:**
```bash
# Build and submit to Cloud Build
gcloud builds submit --config cloudbuild.yaml

# Or deploy directly
gcloud run deploy brainy-api \
  --source . \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars GCS_BUCKET=brainy-storage \
  --set-secrets "GCS_ACCESS_KEY=gcs-access-key:latest,GCS_SECRET_KEY=gcs-secret-key:latest"
```

**Create GCS Bucket with S3-compatible access:**
```bash
# Create bucket
gsutil mb -p PROJECT_ID -c STANDARD -l US gs://brainy-storage/

# Enable interoperability
gsutil iam ch serviceAccount:SERVICE_ACCOUNT@PROJECT_ID.iam.gserviceaccount.com:objectAdmin gs://brainy-storage

# Generate HMAC keys for S3-compatible access
gsutil hmac create SERVICE_ACCOUNT@PROJECT_ID.iam.gserviceaccount.com

# Store the access key and secret in Secret Manager
echo -n "YOUR_ACCESS_KEY" | gcloud secrets create gcs-access-key --data-file=-
echo -n "YOUR_SECRET_KEY" | gcloud secrets create gcs-secret-key --data-file=-
```

### Microsoft Azure Functions

```javascript
// index.js
module.exports = async function (context, req) {
  const { Brainy } = require('@soulcraft/brainy')
  const { S3CompatibleStorage } = require('@soulcraft/brainy/storage')
  
  const storage = new S3CompatibleStorage({
    endpoint: `${process.env.AZURE_STORAGE_ACCOUNT}.blob.core.windows.net`,
    bucket: 'brainy-data',
    accessKeyId: process.env.AZURE_STORAGE_ACCOUNT,
    secretAccessKey: process.env.AZURE_STORAGE_KEY,
    prefix: 'entities/',
    forcePathStyle: false
  })
  
  const brain = new Brainy({ storage })
  await brain.init()
  
  const apiAugmentation = brain.augmentationRegistry.getAugmentation('api-server')
  const handler = apiAugmentation.createUniversalHandler()
  
  const request = new Request(`https://${context.req.headers.host}${context.req.url}`, {
    method: context.req.method,
    headers: context.req.headers,
    body: JSON.stringify(context.req.body)
  })
  
  const response = await handler(request)
  
  context.res = {
    status: response.status,
    headers: Object.fromEntries(response.headers),
    body: await response.text()
  }
}
```

### Cloudflare Workers

```javascript
// worker.js
import { Brainy } from '@soulcraft/brainy'
import { R2Storage } from '@soulcraft/brainy/storage' // Alias for S3CompatibleStorage

let handler

export default {
  async fetch(request, env, ctx) {
    if (!handler) {
      const storage = new R2Storage({
        endpoint: `${env.ACCOUNT_ID}.r2.cloudflarestorage.com`,
        bucket: 'brainy-data',
        accessKeyId: env.R2_ACCESS_KEY_ID,
        secretAccessKey: env.R2_SECRET_ACCESS_KEY,
        region: 'auto',
        forcePathStyle: true
      })
      
      const brain = new Brainy({
        storage,
        augmentations: [{
          name: 'api-server',
          config: {
            enabled: true,
            cors: { origin: '*' }
          }
        }]
      })
      
      await brain.init()
      
      const apiAugmentation = brain.augmentationRegistry.getAugmentation('api-server')
      handler = apiAugmentation.createUniversalHandler()
    }
    
    // The handler works directly with Request/Response!
    return handler(request)
  }
}
```

```toml
# wrangler.toml
name = "brainy-api"
main = "worker.js"
compatibility_date = "2024-01-01"

[[r2_buckets]]
binding = "R2"
bucket_name = "brainy-data"

[vars]
ACCOUNT_ID = "your-account-id"

[env.production.vars]
R2_ACCESS_KEY_ID = "your-access-key"
R2_SECRET_ACCESS_KEY = "your-secret-key"
```

### Vercel Edge Functions

```javascript
// api/brainy.js
import { Brainy } from '@soulcraft/brainy'
import { S3CompatibleStorage } from '@soulcraft/brainy/storage'

let handler

export const config = {
  runtime: 'edge',
}

export default async (request) => {
  if (!handler) {
    const storage = new S3CompatibleStorage({
      endpoint: 's3.amazonaws.com',
      region: 'us-east-1',
      bucket: process.env.S3_BUCKET,
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
    })
    
    const brain = new Brainy({
      storage,
      augmentations: [{
        name: 'api-server',
        config: { enabled: true }
      }]
    })
    
    await brain.init()
    
    const apiAugmentation = brain.augmentationRegistry.getAugmentation('api-server')
    handler = apiAugmentation.createUniversalHandler()
  }
  
  return handler(request)
}
```

```json
// vercel.json
{
  "functions": {
    "api/brainy.js": {
      "maxDuration": 30,
      "memory": 1024
    }
  },
  "rewrites": [
    {
      "source": "/api/:path*",
      "destination": "/api/brainy"
    }
  ]
}
```

### Railway

```javascript
// server.js
import { Brainy } from '@soulcraft/brainy'
import { S3CompatibleStorage } from '@soulcraft/brainy/storage'
import express from 'express'

const app = express()
const PORT = process.env.PORT || 3000

let brain
let handler

async function init() {
  const storage = new S3CompatibleStorage({
    endpoint: process.env.S3_ENDPOINT || 's3.amazonaws.com',
    region: process.env.S3_REGION || 'us-east-1',
    bucket: process.env.S3_BUCKET,
    accessKeyId: process.env.S3_ACCESS_KEY,
    secretAccessKey: process.env.S3_SECRET_KEY,
    prefix: 'brainy/'
  })
  
  brain = new Brainy({
    storage,
    augmentations: [{
      name: 'api-server',
      config: {
        enabled: true,
        port: PORT
      }
    }]
  })
  
  await brain.init()
  
  const apiAugmentation = brain.augmentationRegistry.getAugmentation('api-server')
  handler = apiAugmentation.createUniversalHandler()
}

await init()

// Universal handler for all routes
app.use('*', async (req, res) => {
  const request = new Request(`http://localhost${req.originalUrl}`, {
    method: req.method,
    headers: req.headers,
    body: JSON.stringify(req.body)
  })
  
  const response = await handler(request)
  
  res.status(response.status)
  res.set(Object.fromEntries(response.headers))
  res.send(await response.text())
})

app.listen(PORT, () => {
  console.log(`Brainy API running on port ${PORT}`)
})
```

```toml
# railway.toml
[build]
builder = "nixpacks"
buildCommand = "npm ci"

[deploy]
startCommand = "node server.js"
restartPolicyType = "always"
restartPolicyMaxRetries = 3
```

### Render

```javascript
// server.js (same as Railway example above)
// Use S3CompatibleStorage with your preferred object storage provider
```

```yaml
# render.yaml
services:
  - type: web
    name: brainy-api
    runtime: node
    buildCommand: npm install
    startCommand: node server.js
    envVars:
      - key: S3_BUCKET
        value: brainy-data
      - key: S3_ENDPOINT
        value: s3.amazonaws.com
      - key: S3_REGION
        value: us-east-1
      - key: S3_ACCESS_KEY
        sync: false
      - key: S3_SECRET_KEY
        sync: false
      - key: API_KEY
        generateValue: true
    healthCheckPath: /health
    autoDeploy: true
```

### Deno Deploy

```typescript
// main.ts
import { Brainy } from "npm:@soulcraft/brainy"
import { S3CompatibleStorage } from "npm:@soulcraft/brainy/storage"

const storage = new S3CompatibleStorage({
  endpoint: Deno.env.get("S3_ENDPOINT") || "s3.amazonaws.com",
  bucket: Deno.env.get("S3_BUCKET")!,
  accessKeyId: Deno.env.get("S3_ACCESS_KEY")!,
  secretAccessKey: Deno.env.get("S3_SECRET_KEY")!,
  region: "auto"
})

const brain = new Brainy({
  storage,
  augmentations: [{
    name: 'api-server',
    config: { enabled: true }
  }]
})

await brain.init()

const apiAugmentation = brain.augmentationRegistry.getAugmentation('api-server')
const handler = apiAugmentation.createUniversalHandler()

Deno.serve(handler)
```

## API Endpoints

The API Server augmentation provides these REST endpoints:

- `POST /api/brainy/add` - Add entity
- `GET /api/brainy/get?id=xxx` - Get entity by ID
- `PUT /api/brainy/update` - Update entity
- `DELETE /api/brainy/delete?id=xxx` - Delete entity
- `POST /api/brainy/find` - Search/find entities
- `POST /api/brainy/relate` - Create relationship
- `GET /api/brainy/insights` - Get statistics and insights
- `GET /health` - Health check

## WebSocket Support

The API Server augmentation includes WebSocket support for real-time updates through the `setupUniversalWebSocket()` method.

## MCP Support

Model Context Protocol (MCP) endpoints are available at `/mcp/*` for AI tool integration.

## Environment Variables

```bash
# Storage Configuration (S3Compatible)
S3_ENDPOINT=s3.amazonaws.com
S3_REGION=us-east-1
S3_BUCKET=brainy-data
S3_ACCESS_KEY=xxx
S3_SECRET_KEY=xxx

# API Configuration
API_KEY=your-secret-key
PORT=3000

# CORS
CORS_ORIGIN=*

# Rate Limiting
RATE_LIMIT_WINDOW=60000
RATE_LIMIT_MAX=100
```

## Client Usage

```javascript
// REST API Client
const response = await fetch('https://your-api.com/api/brainy/add', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer YOUR_API_KEY'
  },
  body: JSON.stringify({
    data: 'Your content here',
    metadata: { type: 'document' }
  })
})

const { id } = await response.json()

// Search
const searchResponse = await fetch('https://your-api.com/api/brainy/find', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer YOUR_API_KEY'
  },
  body: JSON.stringify({
    query: 'neural networks'
  })
})

const results = await searchResponse.json()

// WebSocket Client
const ws = new WebSocket('wss://your-api.com/ws')
ws.onopen = () => {
  ws.send(JSON.stringify({
    type: 'subscribe',
    pattern: 'technology'
  }))
}
ws.onmessage = (event) => {
  const update = JSON.parse(event.data)
  console.log('Real-time update:', update)
}
```

## Storage Adapter Configuration

S3CompatibleStorage constructor parameters (verified from source):

```javascript
{
  endpoint: string,         // Required (e.g., 's3.amazonaws.com')
  bucket: string,          // Required
  accessKeyId: string,     // Required
  secretAccessKey: string, // Required
  region?: string,         // Optional (default: 'us-east-1')
  prefix?: string,         // Optional (e.g., 'brainy/')
  forcePathStyle?: boolean, // Optional (needed for some S3-compatible services)
}
```

## Important Notes

1. All examples use the **real** Brainy 3.0 APIs
2. The `createUniversalHandler()` method is provided by the API Server augmentation
3. S3CompatibleStorage works with any S3-compatible service
4. Always call `brain.init()` before using Brainy
5. The handler can be cached across requests for better performance
6. R2Storage is an alias for S3CompatibleStorage (for Cloudflare R2)

## Security Best Practices

1. **Always use environment variables for sensitive data** (API keys, secrets)
2. **Enable authentication** in the API Server augmentation config
3. **Use HTTPS/TLS** for all production deployments
4. **Implement rate limiting** to prevent abuse
5. **Configure CORS** appropriately for your use case

## Performance Tips

1. **Cache the brain instance** - Initialize once and reuse across requests
2. **Use S3CompatibleStorage** for cloud deployments (better scalability)
3. **Enable the cache augmentation** for frequently accessed data
5. **Configure appropriate memory limits** for your runtime

## Troubleshooting

### Common Issues

1. **"Brainy not initialized"** - Make sure to call `await brain.init()` before use
2. **"augmentationRegistry.getAugmentation is not a function"** - The augmentation wasn't loaded properly
3. **S3 Access Denied** - Check your IAM permissions and credentials
4. **CORS errors** - Configure the CORS settings in the API Server augmentation

### Debug Mode

Enable debug logging by setting:
```javascript
const brain = new Brainy({
  storage,
  debug: true,
  augmentations: [{
    name: 'api-server',
    config: {
      enabled: true,
      verbose: true
    }
  }]
})
```

## Support

- Documentation: https://github.com/soulcraft/brainy/docs
- Issues: https://github.com/soulcraft/brainy/issues
- NPM Package: https://www.npmjs.com/package/@soulcraft/brainy

---

This guide contains only verified, working code from the actual Brainy 3.0 codebase. No mock implementations, no stub methods, only production-ready code.