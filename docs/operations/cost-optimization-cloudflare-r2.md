# Cloudflare R2 Cost Optimization Guide for Brainy v4.0.0

> **Cost Impact**: $0 egress fees + 96% storage savings = Lowest cloud storage costs

## Overview

Cloudflare R2 is an S3-compatible object storage with **zero egress fees**, making it ideal for high-traffic applications. Brainy v4.0.0 fully supports R2 with lifecycle policies and batch operations.

## Cost Breakdown

### R2 Pricing (As of 2025)

```
Storage: $0.015/GB/month
Class A Operations (write): $4.50 per million
Class B Operations (read): $0.36 per million
Egress: $0.00 (FREE!)
```

### Comparison to AWS S3 (500TB Dataset)

**AWS S3 Standard:**
```
Storage: 500TB × $0.023/GB × 12 = $138,000/year
Egress (assume 100TB/month): 1.2PB × $0.09/GB = $108,000/year
Operations: $5,000/year
Total: $251,000/year
```

**Cloudflare R2 Standard:**
```
Storage: 500TB × $0.015/GB × 12 = $90,000/year
Egress: $0 (FREE!)
Operations: $5,000/year
Total: $95,000/year
Savings vs AWS: $156,000/year (62%)
```

**R2's Zero Egress Advantage:**
- **High-traffic apps**: Save $100k-$1M/year in egress fees
- **Video/media delivery**: No CDN egress costs
- **API responses**: Unlimited reads at no extra cost

## R2 Storage Classes (Coming Soon)

**Current State (2025):**
- R2 currently has only **one storage class** (Standard)
- No lifecycle policies or tier transitions yet
- Cloudflare plans to add infrequent access tiers

**When lifecycle features arrive:**
- Brainy v4.0.0 is already prepared with `setLifecyclePolicy()` support
- Will work seamlessly once Cloudflare enables lifecycle management

## Strategy 1: Use R2 Standard (Current Best Practice)

### Setup: S3-Compatible API

```typescript
import { Brainy } from '@soulcraft/brainy'
import { S3CompatibleStorage } from '@soulcraft/brainy/storage'

// R2 uses S3-compatible API
const storage = new S3CompatibleStorage({
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  bucket: 'my-brainy-data',
  region: 'auto',  // R2 uses 'auto' region
  accessKeyId: process.env.R2_ACCESS_KEY_ID,
  secretAccessKey: process.env.R2_SECRET_ACCESS_KEY
})

const brain = new Brainy({ storage })
await brain.init()
```

### Cost Calculation (500TB on R2)

```
Storage: 500TB × $0.015/GB × 12 = $90,000/year
Class A ops (10M writes): $45/year
Class B ops (100M reads): $36/year
Egress: $0

Total: $90,081/year
```

**Compared to AWS S3 (with egress):**
- AWS: $251,000/year
- R2: $90,081/year
- **Savings: $160,919/year (64%)**

## Strategy 2: R2 + Workers (Edge Computing)

### Setup: Compute at the Edge

```typescript
// Cloudflare Worker (runs at edge)
export default {
  async fetch(request, env) {
    // Initialize Brainy with R2
    const storage = new S3CompatibleStorage({
      endpoint: env.R2_ENDPOINT,
      bucket: env.R2_BUCKET,
      accessKeyId: env.R2_ACCESS_KEY,
      secretAccessKey: env.R2_SECRET_KEY,
      region: 'auto'
    })

    const brain = new Brainy({ storage })
    await brain.init()

    // Process at edge (no origin server needed)
    const results = await brain.search(request.query)
    return new Response(JSON.stringify(results))
  }
}
```

### Cost Calculation (Workers + R2)

```
R2 Storage (500TB): $90,000/year
Workers (10M requests/day):
  - First 100k requests/day: FREE
  - Additional 350M requests/month: $1,750/year
  - CPU time (50ms avg): $5,000/year

Total: $96,750/year

vs Traditional Setup (AWS S3 + EC2 + CloudFront):
  - S3: $138,000/year
  - EC2 (t3.xlarge × 4): $24,000/year
  - CloudFront egress: $50,000/year
  - Load balancer: $3,000/year
  Total: $215,000/year

Savings: $118,250/year (55%)
```

## Strategy 3: Hybrid Multi-Cloud (R2 + S3)

### Setup: R2 for Hot Data, S3 for Archives

```typescript
// Use R2 for frequently accessed data (zero egress)
const hotStorage = new S3CompatibleStorage({
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  bucket: 'brainy-hot',
  region: 'auto',
  accessKeyId: process.env.R2_ACCESS_KEY_ID,
  secretAccessKey: process.env.R2_SECRET_ACCESS_KEY
})

// Use AWS S3 with Intelligent-Tiering for cold data
const coldStorage = new S3CompatibleStorage({
  endpoint: 's3.amazonaws.com',
  bucket: 'brainy-archive',
  region: 'us-east-1',
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
})

// Initialize separate Brainy instances or implement tiering logic
```

### Cost Calculation (300TB R2 + 200TB S3 Archive)

```
R2 Hot Data (300TB):
  Storage: 300TB × $0.015/GB × 12 = $54,000/year
  Egress: $0

S3 Cold Data (200TB with lifecycle → Deep Archive):
  Storage: 200TB × $0.00099/GB × 12 = $2,376/year
  Ops: $1,000/year

Total: $57,376/year

vs All AWS S3:
  - S3 storage + egress: $251,000/year

Savings: $193,624/year (77%)
```

## Batch Operations

### Efficient Bulk Deletions

```typescript
// v4.0.0: R2 supports S3 batch delete API
const idsToDelete = [/* array of entity IDs */]

const paths = idsToDelete.flatMap(id => {
  const shard = id.substring(0, 2)
  return [
    `entities/nouns/vectors/${shard}/${id}.json`,
    `entities/nouns/metadata/${shard}/${id}.json`
  ]
})

// Batch delete (1000 objects per request)
await storage.batchDelete(paths)

// Cost impact:
// - Individual deletes: 1M × $4.50/1M = $4.50
// - Batch deletes: 1k batches × $4.50/1M = $0.0045 (1000x cheaper!)
```

## R2 Advanced Features

### 1. R2 Custom Domains

**Free custom domains for R2 buckets:**

```bash
# Configure custom domain in Cloudflare dashboard
# Then access via your domain
https://storage.yourdomain.com/entities/nouns/vectors/...

# Benefits:
# - No additional cost
# - Automatic SSL/TLS
# - Global CDN included
# - DDoS protection
```

### 2. R2 Event Notifications

**Trigger Workers on object events:**

```typescript
// Worker triggered on R2 object upload
export default {
  async fetch(request, env) {
    // Process new objects automatically
    // E.g., index new entities, generate thumbnails, etc.
  }
}

// Cost: Only pay for Worker execution (no polling needed)
```

### 3. R2 Presigned URLs

```typescript
// Generate presigned URL for direct browser uploads
const url = await storage.getPresignedUrl('upload-path', 3600)  // 1 hour expiry

// Client uploads directly to R2 (no server bandwidth used)
```

## Monitoring and Management

### Get Storage Status

```typescript
const status = await storage.getStorageStatus()
console.log('Storage type:', status.type)  // 's3-compatible'
console.log('Bucket:', status.details.bucket)
console.log('Endpoint:', status.details.endpoint)
```

### Cloudflare Dashboard Monitoring

1. **R2 Dashboard** → View bucket metrics
2. **Analytics** → Track requests, storage, and bandwidth
3. **Workers Analytics** → Monitor edge compute usage
4. **Logs** → Real-time logs with Logpush

### Expected Metrics

```
Storage: Growing with your data
Class A ops: Writes (higher cost)
Class B ops: Reads (minimal cost)
Egress: Always $0 (R2's advantage)
```

## Comparison Table: R2 vs Other Providers

| Feature | R2 | AWS S3 | GCS | Azure |
|---------|-----|--------|-----|-------|
| **Storage** | $0.015/GB | $0.023/GB | $0.020/GB | $0.0184/GB |
| **Egress** | **$0** | $0.09/GB | $0.12/GB | $0.087/GB |
| **Lifecycle Tiers** | Coming soon | 6 tiers | 4 classes | 3 tiers |
| **S3 API Compatible** | ✅ Yes | ✅ Native | ⚠️ Via interop | ⚠️ Via SDK |
| **CDN Included** | ✅ Yes | ❌ Extra cost | ❌ Extra cost | ❌ Extra cost |
| **Edge Compute** | ✅ Workers | ❌ Lambda@Edge | ❌ Cloud Functions | ❌ Functions |

## R2 Free Tier

**Generous free tier:**
```
Storage: 10 GB free per month
Class A ops: 1 million free per month
Class B ops: 10 million free per month
Egress: Unlimited (always free)
```

**Perfect for:**
- Development and testing
- Small applications (<10GB)
- Prototypes

## Best Practices

1. ✅ **Use R2 for high-egress workloads** - Zero egress fees
2. ✅ **Combine with Workers** - Edge compute included
3. ✅ **Use custom domains** - Free branded URLs
4. ✅ **Batch operations** for deletions - 1000x cheaper
5. ✅ **Use presigned URLs** - Direct client uploads
6. ✅ **Monitor with Analytics** - Built-in dashboarding
7. ✅ **Consider hybrid approach** - R2 hot + S3 archive cold

## Migration from S3 to R2

### Using rclone

```bash
# Install rclone
brew install rclone  # or apt-get install rclone

# Configure S3 source
rclone config create s3-source s3 \
  access_key_id=$AWS_ACCESS_KEY \
  secret_access_key=$AWS_SECRET_KEY \
  region=us-east-1

# Configure R2 destination
rclone config create r2-dest s3 \
  access_key_id=$R2_ACCESS_KEY \
  secret_access_key=$R2_SECRET_KEY \
  endpoint=https://$R2_ACCOUNT_ID.r2.cloudflarestorage.com \
  region=auto

# Copy data
rclone copy s3-source:my-bucket r2-dest:my-bucket --progress

# Verify
rclone check s3-source:my-bucket r2-dest:my-bucket
```

### Cost of Migration

```
Data transfer out from S3: 500TB × $0.09/GB = $45,000
Data transfer into R2: $0 (ingress is free)

One-time migration cost: $45,000

Monthly savings after migration:
S3 storage + egress: $20,833/month
R2 storage: $7,500/month
Savings: $13,333/month

ROI: 3.4 months
```

## Future: R2 Lifecycle Policies (When Available)

### Prepared for Future Features

```typescript
// Brainy v4.0.0 is ready for R2 lifecycle features
await storage.setLifecyclePolicy({
  rules: [{
    id: 'archive-old-data',
    prefix: 'entities/',
    status: 'Enabled',
    transitions: [
      { days: 30, storageClass: 'INFREQUENT_ACCESS' },  // When available
      { days: 90, storageClass: 'ARCHIVE' }
    ]
  }]
})

// Expected cost impact (when lifecycle is available):
// Standard: $0.015/GB
// Infrequent: ~$0.008/GB (estimated)
// Archive: ~$0.002/GB (estimated)
```

## Troubleshooting

### Issue: Connection errors

**Solution:**
```typescript
// Ensure correct endpoint format
const storage = new S3CompatibleStorage({
  endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
  // NOT: `https://r2.cloudflarestorage.com/${accountId}`

  region: 'auto',  // R2 requires 'auto'
  forcePathStyle: false  // R2 uses virtual-hosted-style
})
```

### Issue: High Class A operation costs

**Solution:**
- Use batch operations (writes are most expensive)
- Cache frequently written data
- Consolidate small writes into larger batches
- Consider Workers KV for high-frequency writes

### Issue: Need lifecycle management now

**Solution:**
- Manually move old data to S3 Deep Archive
- Use hybrid approach: R2 for hot, S3 for cold
- Wait for R2 lifecycle features (planned)

## Summary

**R2 Advantages:**
- ✅ **Zero egress fees** - Unlimited reads at no cost
- ✅ **Lower storage costs** - $0.015/GB vs $0.023/GB (AWS)
- ✅ **S3-compatible API** - Drop-in replacement for S3
- ✅ **Global CDN included** - No additional CDN costs
- ✅ **Edge Workers** - Compute at the edge
- ✅ **Free custom domains** - Branded URLs
- ✅ **No minimums** - No minimum storage duration

**R2 Limitations (Current):**
- ⚠️ Single storage class (for now)
- ⚠️ No lifecycle policies yet (coming soon)
- ⚠️ Less mature than S3/GCS/Azure

**Recommended Use Cases:**
- 🎯 High-traffic APIs (zero egress fees!)
- 🎯 Video/media delivery (massive savings)
- 🎯 User-generated content
- 🎯 Web application assets
- 🎯 Hot data storage

**500TB Example (R2 vs AWS S3 with 100TB/month egress):**
- AWS S3: $251,000/year
- Cloudflare R2: $90,000/year
- **Savings: $161,000/year (64%)**

**1PB Example (R2 vs AWS S3 with 200TB/month egress):**
- AWS S3: $686,000/year
- Cloudflare R2: $180,000/year
- **Savings: $506,000/year (74%)**

---

**Version**: v4.0.0
**Last Updated**: 2025-10-17
**Cloud Provider**: Cloudflare R2
**Key Advantage**: **$0 egress fees forever**
