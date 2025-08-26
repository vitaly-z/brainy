# 🚀 Brainy Production Deployment Guide

## Memory Requirements (Critical)

**Brainy requires 8-16GB RAM in production** due to ONNX Runtime + transformer models.

This is NOT a bug - it's the cost of running state-of-the-art AI locally:
- Same as any production ML system (TensorFlow, PyTorch)
- Same as ChatGPT embeddings (but yours runs locally!)
- Same as GitHub Copilot inference servers

## 🏗️ Architecture Overview

```
Brainy 2.0 Production Stack
├── Universal Memory Manager ✅
│   ├── Worker-based isolation (Node.js)
│   ├── Aggressive cleanup (Serverless)
│   ├── Browser optimization (Web)
│   └── Automatic restarts (prevents leaks)
├── Triple Backup Model Loading ✅
│   ├── Local cache (fastest)
│   ├── GitHub releases (reliable)
│   ├── Soulcraft CDN (future)
│   └── HuggingFace (fallback)
├── Brain Patterns (Query Engine) ✅
│   ├── O(1) field lookups
│   ├── O(log n) range queries
│   ├── Vector search
│   └── Triple Intelligence
└── 11 Production Augmentations ✅
    ├── WAL (durability)
    ├── Batch processing
    ├── Request deduplication
    ├── Connection pooling
    └── 7 more enterprise features
```

## 🌍 Deployment Options

### Option 1: High-Memory VPS (Recommended)
```yaml
# Deploy on servers with 16GB+ RAM
Providers: DigitalOcean, Linode, AWS EC2
Instance: 16GB RAM minimum
Cost: $50-100/month
Benefits: Full control, all features
```

### Option 2: Cloud Functions (Serverless)
```yaml
AWS Lambda: 10GB max memory
Google Cloud Functions: 32GB max memory
Vercel: 3GB max (may struggle)
Benefits: Auto-scaling, pay-per-use
```

### Option 3: Container Orchestration
```yaml
Docker: --memory=16g
Kubernetes: memory: "16Gi"
Benefits: Easy scaling, restarts
```

### Option 4: Dedicated AI Servers
```yaml
Separate embedding server: 32GB+ RAM
API communication
Benefits: Best performance, cost optimization
```

## 📦 Docker Deployment

### Dockerfile
```dockerfile
FROM node:18

# Set memory limits
ENV NODE_OPTIONS="--max-old-space-size=16384"

WORKDIR /app
COPY . .

# Install dependencies and build
RUN npm ci && npm run build

# Health check for memory management
HEALTHCHECK --interval=30s --timeout=30s --start-period=60s \
  CMD node -e "console.log('Memory:', process.memoryUsage().heapUsed/1024/1024, 'MB')"

EXPOSE 3000
CMD ["node", "dist/server.js"]
```

### Docker Compose
```yaml
version: '3.8'
services:
  brainy-app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_OPTIONS=--max-old-space-size=16384
      - BRAINY_MODELS_PATH=/app/models
    deploy:
      resources:
        limits:
          memory: 16G
        reservations:
          memory: 8G
    volumes:
      - ./models:/app/models
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
```

## ☁️ Kubernetes Deployment

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: brainy-deployment
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
        image: your-registry/brainy:latest
        env:
        - name: NODE_OPTIONS
          value: "--max-old-space-size=16384"
        - name: BRAINY_MODELS_PATH
          value: "/app/models"
        resources:
          requests:
            memory: "8Gi"
            cpu: "2000m"
          limits:
            memory: "16Gi"
            cpu: "4000m"
        ports:
        - containerPort: 3000
        volumeMounts:
        - name: models
          mountPath: /app/models
      volumes:
      - name: models
        persistentVolumeClaim:
          claimName: brainy-models
---
apiVersion: v1
kind: Service
metadata:
  name: brainy-service
spec:
  selector:
    app: brainy
  ports:
  - port: 80
    targetPort: 3000
  type: LoadBalancer
```

## 🔧 Environment Configuration

### Essential Environment Variables
```bash
# Memory Management
NODE_OPTIONS="--max-old-space-size=16384"  # 16GB heap
BRAINY_MODELS_PATH="/app/models"           # Model location
BRAINY_ALLOW_REMOTE_MODELS="false"        # Use local only

# Production Optimization
NODE_ENV="production"
BRAINY_VERBOSE="false"                     # Reduce logging
BRAINY_CACHE_SIZE="10000"                 # Larger cache
```

### Optional Configuration
```bash
# Memory Manager Tuning
BRAINY_MAX_EMBEDDINGS_NODE="100"          # Worker restart threshold
BRAINY_MAX_EMBEDDINGS_SERVERLESS="50"     # Serverless threshold
BRAINY_MAX_EMBEDDINGS_BROWSER="25"        # Browser threshold

# Storage Configuration
BRAINY_STORAGE_TYPE="filesystem"          # or 's3', 'memory'
BRAINY_STORAGE_PATH="/data"              # Data directory
```

## 🔄 Process Management

### PM2 Configuration (Recommended)
```javascript
// ecosystem.config.js
module.exports = {
  apps: [{
    name: 'brainy-app',
    script: 'dist/server.js',
    instances: 2,
    exec_mode: 'cluster',
    env: {
      NODE_OPTIONS: '--max-old-space-size=16384',
      NODE_ENV: 'production'
    },
    max_memory_restart: '14G',  // Restart at 14GB to prevent OOM
    time: true,
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_file: './logs/combined.log'
  }]
}
```

### Systemd Service
```ini
[Unit]
Description=Brainy AI Service
After=network.target

[Service]
Type=simple
User=brainy
WorkingDirectory=/opt/brainy
Environment=NODE_ENV=production
Environment=NODE_OPTIONS=--max-old-space-size=16384
ExecStart=/usr/bin/node dist/server.js
Restart=on-failure
RestartSec=10
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
```

## 📊 Monitoring & Health Checks

### Memory Monitoring
```javascript
// health-check.js
import { getEmbeddingMemoryStats } from './dist/embeddings/universal-memory-manager.js'

export function healthCheck() {
  const memory = process.memoryUsage()
  const stats = getEmbeddingMemoryStats()
  
  return {
    status: memory.heapUsed < 14 * 1024 * 1024 * 1024 ? 'healthy' : 'warning',
    memory: {
      heapUsed: `${(memory.heapUsed / 1024 / 1024).toFixed(2)} MB`,
      heapTotal: `${(memory.heapTotal / 1024 / 1024).toFixed(2)} MB`,
      rss: `${(memory.rss / 1024 / 1024).toFixed(2)} MB`
    },
    embedding: stats
  }
}
```

### Prometheus Metrics
```javascript
// metrics.js
import prometheus from 'prom-client'

export const memoryUsage = new prometheus.Gauge({
  name: 'brainy_memory_usage_bytes',
  help: 'Memory usage in bytes'
})

export const embeddingCount = new prometheus.Counter({
  name: 'brainy_embeddings_total',
  help: 'Total number of embeddings processed'
})

export const workerRestarts = new prometheus.Counter({
  name: 'brainy_worker_restarts_total',
  help: 'Number of worker restarts for memory management'
})
```

## 🚨 Production Checklist

### Before Deployment
- [ ] Server has 16GB+ RAM
- [ ] Models downloaded (`npm run download-models`)
- [ ] Environment variables configured
- [ ] Health checks implemented
- [ ] Logging configured
- [ ] Monitoring set up

### During Deployment
- [ ] Memory usage stays below 14GB
- [ ] Worker restarts happening automatically
- [ ] Search operations completing successfully
- [ ] No memory leak warnings in logs

### After Deployment
- [ ] Set up alerts for high memory usage
- [ ] Monitor worker restart frequency
- [ ] Track performance metrics
- [ ] Plan for scaling based on usage

## 🔍 Troubleshooting

### Common Issues

**Out of Memory (OOM) Kills**
```bash
# Symptoms: Process suddenly stops
# Solution: Increase memory or reduce load
NODE_OPTIONS="--max-old-space-size=20480"  # 20GB
```

**Slow Search Performance**
```bash
# Symptoms: Timeouts on search operations  
# Solution: Check model loading
curl http://localhost:3000/health | jq '.embedding.strategy'
```

**Worker Restart Loops**
```bash
# Symptoms: Constant worker restarts
# Solution: Increase restart threshold
BRAINY_MAX_EMBEDDINGS_NODE="200"
```

## 🎯 Performance Tuning

### For High-Traffic Applications
- Use multiple instances with load balancing
- Implement request queuing
- Cache common search results
- Consider dedicated embedding servers

### For Memory-Constrained Environments
- Use aggressive cleanup thresholds
- Implement request batching
- Mock embeddings for non-critical features
- Consider external embedding APIs

## 📈 Scaling Strategies

### Horizontal Scaling
```yaml
# Multiple instances behind load balancer
instances: 3-5
memory_per_instance: 16GB
load_balancer: nginx, AWS ALB, GCP LB
```

### Vertical Scaling
```yaml
# Larger single instance
memory: 32-64GB
cpu: 8-16 cores
storage: SSD for model caching
```

### Hybrid Architecture
```yaml
# Separate concerns
api_servers: 4GB RAM (no AI features)
embedding_servers: 32GB RAM (AI only)
communication: REST API or gRPC
```

## 🎉 Success Metrics

A successful Brainy production deployment should show:
- ✅ Memory usage stable under 14GB
- ✅ Search latency < 100ms
- ✅ Worker restarts every 100-1000 operations
- ✅ Zero downtime with proper monitoring
- ✅ Embedding accuracy maintained

Your users get **ChatGPT-quality semantic search** running locally with complete privacy and control!