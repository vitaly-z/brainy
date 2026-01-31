# Cloud Run + Filestore (NFS) Deployment Guide

> Eliminate cloud storage rate limiting by using brainy's FileSystem adapter with a Filestore NFS mount on Cloud Run.

## Why Filestore?

Brainy's metadata index generates 26-40 file writes per `brain.add()` call. On GCS, each write is a cloud API call subject to rate limiting (~1 write/sec per object), causing HTTP 429 errors and 61-second latency for a single add operation.

With Filestore:
- **Local disk speed**: Each write is ~1ms (vs 50-300ms for cloud API)
- **No rate limits**: NFS has no per-object write throttling
- **Zero code changes**: Use brainy's existing `FileSystemStorage` adapter
- **Same Cloud Run deployment**: Just add a volume mount

## Prerequisites

- Google Cloud project with Filestore API enabled
- Cloud Run service (gen2 execution environment required for NFS)
- VPC connector or Direct VPC egress configured

## Step 1: Create a Filestore Instance

```bash
gcloud filestore instances create brainy-store \
  --zone=us-central1-b \
  --tier=BASIC_SSD \
  --file-share=name=brainy_data,capacity=1TB \
  --network=name=default
```

**Tier recommendations:**
- **BASIC_SSD** (~$370/month for 1 TiB): Good balance of performance and cost
- **BASIC_HDD** (~$204/month for 1 TiB): Lower cost, sufficient for moderate workloads
- **ENTERPRISE** or **ZONAL**: Higher IOPS for heavy workloads

Note the IP address from the output — you'll need it for the Cloud Run mount.

## Step 2: Configure Cloud Run NFS Volume Mount

```yaml
# service.yaml
apiVersion: serving.knative.dev/v1
kind: Service
metadata:
  name: my-brainy-service
spec:
  template:
    metadata:
      annotations:
        run.googleapis.com/execution-environment: gen2
        run.googleapis.com/vpc-access-connector: projects/PROJECT/locations/REGION/connectors/CONNECTOR
    spec:
      containers:
        - image: gcr.io/PROJECT/my-brainy-app
          volumeMounts:
            - name: brainy-nfs
              mountPath: /mnt/brainy
      volumes:
        - name: brainy-nfs
          nfs:
            server: FILESTORE_IP  # e.g., 10.0.0.2
            path: /brainy_data
```

Deploy:

```bash
gcloud run services replace service.yaml --region=us-central1
```

## Step 3: Configure Brainy to Use FileSystem Adapter

```typescript
import { Brainy } from '@soulcraft/brainy'
import { FileSystemStorage } from '@soulcraft/brainy/storage'

const storage = new FileSystemStorage({
  basePath: '/mnt/brainy/brain-data'
})

const brain = new Brainy({ storage })
await brain.init()
```

That's it. No GCS adapter, no rate limits, no retry logic needed.

## Caveats

### Single-Writer Recommendation

NFS does not provide strong file locking guarantees on Cloud Run. For best results:

- Use a **single Cloud Run instance** (max-instances=1) for write operations
- Multiple read-only instances can safely read from the same Filestore mount
- For multi-writer scenarios, use the GCS adapter with the write buffer (rate limit protection built in)

### Filestore Permissions

Cloud Run gen2 instances run as a specific service account. Ensure the Filestore instance allows access from your VPC network. No additional IAM permissions are needed — Filestore uses NFS network-level access.

### Cost Comparison

| Solution | Monthly Cost (1 TiB) | Write Latency | Rate Limits |
|----------|---------------------|---------------|-------------|
| GCS Standard | ~$20 storage + API ops | 50-300ms/write | 1 write/sec/object |
| GCS HNS | ~$20 storage + API ops | 50-300ms/write | 8,000 writes/sec |
| Filestore SSD | ~$370 fixed | ~1ms/write | None |
| Filestore HDD | ~$204 fixed | ~5ms/write | None |

Filestore costs more for storage but eliminates all rate limiting issues and provides significantly lower write latency.

### When to Choose Filestore vs GCS

**Choose Filestore when:**
- Write-heavy workloads (frequent `brain.add()`, chat applications)
- Low-latency requirements
- Single-writer architecture is acceptable

**Choose GCS (with write buffer) when:**
- Multi-instance deployments need shared storage
- Cost optimization for large datasets (lifecycle policies, Autoclass)
- Read-heavy workloads with infrequent writes

## Verification

After deploying, verify the mount works:

```bash
# In Cloud Run container
ls -la /mnt/brainy/
# Should show the Filestore share contents

# Test write performance
dd if=/dev/zero of=/mnt/brainy/test bs=1M count=100
# Expected: ~100MB/s+ for SSD tier
```

Then run your brainy application and confirm `brain.add()` completes without rate limit errors.
