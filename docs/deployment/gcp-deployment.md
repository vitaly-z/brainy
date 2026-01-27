# Google Cloud Platform Deployment Guide for Brainy

## Overview
Deploy Brainy on GCP with automatic scaling, global distribution, and zero-config dynamic adaptation. Brainy automatically detects and optimizes for GCP services.

## Quick Start (Zero-Config)

### Option 1: Cloud Run (Serverless Containers)

```bash
# Build and deploy with one command
gcloud run deploy brainy \
 --source . \
 --platform managed \
 --region us-central1 \
 --allow-unauthenticated

# Brainy auto-detects Cloud Run and configures:
# - Memory-optimized caching
# - GCS for storage (if available)
# - Cloud SQL for metadata (if available)
```

### Option 2: Cloud Functions (Serverless)

```javascript
// index.js
const { Brainy } = require('@soulcraft/brainy')

let brain

exports.brainyHandler = async (req, res) => {
 // Zero-config - auto-adapts to Cloud Functions
 if (!brain) {
 brain = new Brainy() // Detects GCP environment automatically
 await brain.init()
 }

 const { method, ...params } = req.body

 try {
 let result
 switch(method) {
 case 'add':
 result = await brain.add(params)
 break
 case 'find':
 result = await brain.find(params)
 break
 case 'relate':
 result = await brain.relate(params)
 break
 default:
 return res.status(400).json({ error: 'Unknown method' })
 }
 res.json({ result })
 } catch (error) {
 res.status(500).json({ error: error.message })
 }
}
```

Deploy:
```bash
gcloud functions deploy brainy \
 --runtime nodejs20 \
 --trigger-http \
 --entry-point brainyHandler \
 --memory 512MB \
 --timeout 60s
```

### Option 3: Google Kubernetes Engine (GKE)

```bash
# Create autopilot cluster (fully managed, zero-config)
gcloud container clusters create-auto brainy-cluster \
 --region us-central1

# Deploy using Cloud Build
gcloud builds submit --tag gcr.io/$PROJECT_ID/brainy

# Apply Kubernetes manifest
kubectl apply -f - <<EOF
apiVersion: apps/v1
kind: Deployment
metadata:
 name: brainy
spec:
 replicas: 3
 selector:
 matchLabels:
 app: brainy
 template:
 metadata:
 labels:
 app: brainy
 spec:
 containers:
 - name: brainy
 image: gcr.io/$PROJECT_ID/brainy
 resources:
 requests:
 memory: "512Mi"
 cpu: "250m"
 env:
 - name: NODE_ENV
 value: production
---
apiVersion: v1
kind: Service
metadata:
 name: brainy-service
spec:
 type: LoadBalancer
 selector:
 app: brainy
 ports:
 - port: 80
 targetPort: 3000
EOF
```

## Zero-Config Storage (Automatic)

Brainy automatically detects and uses the best GCP storage:

```javascript
const brain = new Brainy()
// Auto-detection priority:
// 1. Firestore (if available)
// 2. Cloud Storage (GCS)
// 3. Cloud SQL
// 4. Persistent Disk
// 5. Memory (fallback)
```

### Cloud Storage Configuration (Optional)

```javascript
const brain = new Brainy({
 storage: {
 type: 's3', // GCS is S3-compatible
 options: {
 endpoint: 'https://storage.googleapis.com',
 bucket: process.env.GCS_BUCKET || 'auto', // Auto-creates bucket
 // Uses Application Default Credentials automatically
 }
 }
})
```

### Firestore Integration (Optional)

```javascript
const brain = new Brainy({
 storage: {
 type: 'firestore',
 options: {
 projectId: process.env.GCP_PROJECT || 'auto',
 collection: 'brainy-data'
 }
 }
})
```

## Scaling Strategies

### 1. Cloud Run Auto-scaling

```yaml
# service.yaml
apiVersion: serving.knative.dev/v1
kind: Service
metadata:
 name: brainy
 annotations:
 run.googleapis.com/execution-environment: gen2
spec:
 template:
 metadata:
 annotations:
 autoscaling.knative.dev/minScale: "1"
 autoscaling.knative.dev/maxScale: "1000"
 autoscaling.knative.dev/target: "80"
 spec:
 containerConcurrency: 100
 containers:
 - image: gcr.io/PROJECT_ID/brainy
 resources:
 limits:
 cpu: "2"
 memory: "2Gi"
```

### 2. GKE Horizontal Pod Autoscaling

```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
 name: brainy-hpa
spec:
 scaleTargetRef:
 apiVersion: apps/v1
 kind: Deployment
 name: brainy
 minReplicas: 3
 maxReplicas: 100
 metrics:
 - type: Resource
 resource:
 name: cpu
 target:
 type: Utilization
 averageUtilization: 70
 - type: Resource
 resource:
 name: memory
 target:
 type: Utilization
 averageUtilization: 80
```

## Global Distribution

### Multi-Region Setup

```javascript
// Brainy automatically handles multi-region with GCS
const brain = new Brainy({
 distributed: {
 enabled: true,
 regions: ['us-central1', 'europe-west1', 'asia-northeast1'],
 replication: 'auto' // Automatic cross-region replication
 }
})
```

### Traffic Director Configuration

```bash
# Global load balancing with Traffic Director
gcloud compute backend-services create brainy-global \
 --global \
 --load-balancing-scheme=INTERNAL_SELF_MANAGED \
 --protocol=HTTP2

gcloud compute backend-services add-backend brainy-global \
 --global \
 --network-endpoint-group=brainy-neg \
 --network-endpoint-group-region=us-central1
```

## Monitoring & Observability

### Cloud Monitoring (Automatic)

Brainy automatically sends metrics to Cloud Monitoring:

```javascript
// No configuration needed - automatic when running on GCP
const brain = new Brainy()

// Automatic metrics:
// - Request latency
// - Error rate
// - Storage operations
// - Cache hit rate
// - Memory usage
```

### Custom Metrics

```javascript
const { Monitoring } = require('@google-cloud/monitoring')
const monitoring = new Monitoring.MetricServiceClient()

const brain = new Brainy({
 onMetric: async (metric) => {
 // Send custom metrics to Cloud Monitoring
 await monitoring.createTimeSeries({
 name: monitoring.projectPath(projectId),
 timeSeries: [{
 metric: {
 type: `custom.googleapis.com/brainy/${metric.name}`,
 labels: metric.labels
 },
 points: [{
 interval: { endTime: { seconds: Date.now() / 1000 } },
 value: { doubleValue: metric.value }
 }]
 }]
 })
 }
})
```

### Cloud Trace Integration

```javascript
const brain = new Brainy({
 tracing: {
 enabled: true,
 sampleRate: 0.1 // Sample 10% of requests
 }
})
```

## Security Best Practices

### 1. Workload Identity (GKE)

```yaml
# Enable Workload Identity
apiVersion: v1
kind: ServiceAccount
metadata:
 name: brainy-sa
 annotations:
 iam.gke.io/gcp-service-account: brainy@PROJECT_ID.iam.gserviceaccount.com
```

### 2. Binary Authorization

```yaml
# Ensure only signed container images
apiVersion: binaryauthorization.grafeas.io/v1beta1
kind: Policy
metadata:
 name: brainy-policy
spec:
 defaultAdmissionRule:
 requireAttestationsBy:
 - projects/PROJECT_ID/attestors/prod-attestor
```

### 3. VPC Service Controls

```bash
# Create VPC Service Perimeter
gcloud access-context-manager perimeters create brainy_perimeter \
 --resources=projects/PROJECT_NUMBER \
 --restricted-services=storage.googleapis.com \
 --title="Brainy Security Perimeter"
```

## Cost Optimization

### 1. Preemptible VMs (80% savings)

```yaml
# GKE node pool with preemptible VMs
apiVersion: container.cnrm.cloud.google.com/v1beta1
kind: ContainerNodePool
metadata:
 name: brainy-preemptible-pool
spec:
 clusterRef:
 name: brainy-cluster
 config:
 preemptible: true
 machineType: n2-standard-2
 autoscaling:
 minNodeCount: 1
 maxNodeCount: 10
```

### 2. Cloud CDN for Static Assets

```bash
# Enable Cloud CDN for frequently accessed data
gcloud compute backend-buckets create brainy-assets \
 --gcs-bucket-name=brainy-static

gcloud compute backend-buckets update brainy-assets \
 --enable-cdn \
 --cache-mode=CACHE_ALL_STATIC
```

### 3. Committed Use Discounts

```bash
# Purchase committed use for predictable workloads
gcloud compute commitments create brainy-commitment \
 --plan=TWELVE_MONTH \
 --resources=vcpu=100,memory=400
```

## Deployment Automation

### Cloud Build CI/CD

```yaml
# cloudbuild.yaml
steps:
 # Build container
 - name: 'gcr.io/cloud-builders/docker'
 args: ['build', '-t', 'gcr.io/$PROJECT_ID/brainy:$SHORT_SHA', '.']

 # Push to registry
 - name: 'gcr.io/cloud-builders/docker'
 args: ['push', 'gcr.io/$PROJECT_ID/brainy:$SHORT_SHA']

 # Deploy to Cloud Run
 - name: 'gcr.io/cloud-builders/gcloud'
 args:
 - 'run'
 - 'deploy'
 - 'brainy'
 - '--image=gcr.io/$PROJECT_ID/brainy:$SHORT_SHA'
 - '--region=us-central1'
 - '--platform=managed'

# Trigger on push to main
trigger:
 branch:
 name: main
```

### Terraform Infrastructure

```hcl
# main.tf
resource "google_cloud_run_service" "brainy" {
 name = "brainy"
 location = "us-central1"

 template {
 spec {
 containers {
 image = "gcr.io/${var.project_id}/brainy"

 resources {
 limits = {
 cpu = "2"
 memory = "2Gi"
 }
 }

 env {
 name = "NODE_ENV"
 value = "production"
 }
 }
 }
 }

 traffic {
 percent = 100
 latest_revision = true
 }
}

resource "google_cloud_run_service_iam_member" "public" {
 service = google_cloud_run_service.brainy.name
 location = google_cloud_run_service.brainy.location
 role = "roles/run.invoker"
 member = "allUsers"
}
```

## Performance Optimization

### 1. Memory Store (Redis Compatible)

```javascript
// Brainy can use Memorystore for caching
const brain = new Brainy({
 cache: {
 type: 'redis',
 options: {
 host: process.env.REDIS_HOST || 'auto-detect',
 port: 6379
 }
 }
})
```

### 2. Cloud Spanner for Global Consistency

```javascript
const brain = new Brainy({
 metadata: {
 type: 'spanner',
 options: {
 instance: 'brainy-instance',
 database: 'brainy-db'
 }
 }
})
```

## Troubleshooting

### Common Issues

1. **Quota Exceeded**
 ```bash
 # Check quotas
 gcloud compute project-info describe --project=$PROJECT_ID

 # Request increase
 gcloud compute project-info add-metadata \
 --metadata google-compute-default-region=us-central1
 ```

2. **Cold Starts**

 **Progressive Initialization (Zero-Config)**

 Brainy automatically detects Cloud Run and Cloud Functions environments
 and uses progressive initialization for <200ms cold starts:

 ```javascript
 // Zero-config - Brainy auto-detects Cloud Run (K_SERVICE env var)
 const brain = new Brainy({
 storage: {
 type: 'gcs',
 gcsNativeStorage: { bucketName: 'my-bucket' }
 }
 })
 await brain.init() // Returns in <200ms

 // First write validates bucket (lazy validation)
 await brain.add('noun', { name: 'test' }) // Validates here
 ```

 **Manual Override (if needed)**
 ```javascript
 const brain = new Brainy({
 storage: {
 type: 'gcs',
 gcsNativeStorage: {
 bucketName: 'my-bucket',
 // Force specific mode
 initMode: 'progressive' // 'auto' | 'progressive' | 'strict'
 }
 }
 })
 ```

 | Mode | Cold Start | Best For |
 |------|------------|----------|
 | `auto` (default) | <200ms in cloud | Zero-config, auto-detects |
 | `progressive` | <200ms always | Force fast init everywhere |
 | `strict` | 100-500ms+ | Local dev, tests, debugging |

 **Keep Warm (Alternative)**
 ```javascript
 // Keep minimum instances warm
 const brain = new Brainy({
 warmup: {
 enabled: true,
 interval: 60000 // Ping every minute
 }
 })
 ```

 **Readiness Detection**

 Use the `brain.ready` Promise to ensure Brainy is initialized before handling requests:

 ```javascript
 let brain

 async function handleRequest(req, res) {
 if (!brain) {
 brain = new Brainy({ storage: { type: 'gcs', ... } })
 brain.init() // Fire and forget
 }

 // Wait for initialization to complete
 await brain.ready

 // Now safe to use brain methods
 const results = await brain.find({ query: req.query.q })
 res.json(results)
 }
 ```

 For Cloud Run health checks, use `isFullyInitialized()` to verify all background tasks are complete:

 ```javascript
 // Health check endpoint for Cloud Run
 app.get('/health', async (req, res) => {
 try {
 await brain.ready
 res.json({
 status: 'ready',
 fullyInitialized: brain.isFullyInitialized()
 })
 } catch (error) {
 res.status(503).json({ status: 'initializing' })
 }
 })
 ```

3. **Memory Pressure**
 ```javascript
 // Optimize for GCP memory constraints
 const brain = new Brainy({
 memory: {
 mode: 'aggressive', // Aggressive garbage collection
 maxHeap: 0.8 // Use 80% of available memory
 }
 })
 ```

## Production Checklist

- [ ] Enable Workload Identity for secure access
- [ ] Configure Cloud Armor for DDoS protection
- [ ] Set up Cloud KMS for encryption keys
- [ ] Enable VPC Service Controls
- [ ] Configure Cloud IAP for authentication
- [ ] Set up Cloud Monitoring dashboards
- [ ] Configure Error Reporting
- [ ] Enable Cloud Trace
- [ ] Set up budget alerts
- [ ] Configure backup and disaster recovery

## Support

- Documentation: https://brainy.soulcraft.ai/docs
- Issues: https://github.com/soulcraft/brainy/issues
- GCP Marketplace: https://console.cloud.google.com/marketplace/product/brainy