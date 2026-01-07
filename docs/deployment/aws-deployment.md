# AWS Deployment Guide for Brainy

## Overview
Deploy Brainy on AWS with automatic scaling, high availability, and zero-config dynamic adaptation. Brainy automatically adapts to your AWS environment without manual configuration.

## Quick Start (Zero-Config)

### Option 1: AWS Lambda (Serverless)

```bash
# Install Brainy
npm install @soulcraft/brainy

# Create handler.js
cat > handler.js << 'EOF'
const { Brainy } = require('@soulcraft/brainy')

let brain

exports.handler = async (event) => {
  // Brainy auto-detects Lambda environment and configures accordingly
  if (!brain) {
    brain = new Brainy() // Zero config - auto-adapts to Lambda
    await brain.init()
  }
  
  const { method, ...params } = JSON.parse(event.body)
  
  switch(method) {
    case 'add':
      const id = await brain.add(params)
      return { statusCode: 200, body: JSON.stringify({ id }) }
    case 'find':
      const results = await brain.find(params)
      return { statusCode: 200, body: JSON.stringify({ results }) }
    default:
      return { statusCode: 400, body: 'Unknown method' }
  }
}
EOF

# Deploy with AWS SAM
sam init --runtime nodejs20.x --name brainy-app
sam deploy --guided
```

### Option 2: ECS Fargate (Container)

```bash
# Build and push Docker image
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin $ECR_URI
docker build -t brainy .
docker tag brainy:latest $ECR_URI/brainy:latest
docker push $ECR_URI/brainy:latest

# Deploy with minimal ECS task definition
cat > task-definition.json << 'EOF'
{
  "family": "brainy",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "256",
  "memory": "512",
  "containerDefinitions": [{
    "name": "brainy",
    "image": "$ECR_URI/brainy:latest",
    "environment": [
      {"name": "NODE_ENV", "value": "production"}
    ],
    "logConfiguration": {
      "logDriver": "awslogs",
      "options": {
        "awslogs-group": "/ecs/brainy",
        "awslogs-region": "us-east-1",
        "awslogs-stream-prefix": "ecs"
      }
    }
  }]
}
EOF

# Brainy auto-detects ECS environment and uses S3 for storage
aws ecs register-task-definition --cli-input-json file://task-definition.json
aws ecs create-service --cluster default --service-name brainy --task-definition brainy --desired-count 2
```

### Option 3: EC2 Auto-Scaling

```bash
# User data script for EC2 instances
#!/bin/bash
curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash -
sudo yum install -y nodejs git

# Clone and setup (or use your deployment method)
git clone https://github.com/yourorg/brainy-app.git /app
cd /app
npm install --production

# Create systemd service
cat > /etc/systemd/system/brainy.service << 'EOF'
[Unit]
Description=Brainy
After=network.target

[Service]
Type=simple
User=ec2-user
WorkingDirectory=/app
ExecStart=/usr/bin/node index.js
Restart=on-failure
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
EOF

systemctl start brainy
systemctl enable brainy
```

## Zero-Config Storage (Automatic)

Brainy automatically detects and uses the best available storage:

```javascript
// No configuration needed - Brainy auto-detects:
const brain = new Brainy()

// Auto-detection priority:
// 1. S3 (if IAM role has permissions)
// 2. EFS (if mounted at /mnt/efs)
// 3. EBS volume (if available)
// 4. Instance storage (fallback)
```

### Manual S3 Configuration (Optional)

```javascript
const brain = new Brainy({
  storage: {
    type: 's3',
    options: {
      bucket: process.env.S3_BUCKET || 'auto', // 'auto' creates bucket
      region: process.env.AWS_REGION || 'auto', // 'auto' detects region
      // IAM role provides credentials automatically
    }
  }
})
```

## Scaling Strategies

### 1. Horizontal Scaling (Recommended)

```yaml
# Auto-scaling policy
Resources:
  AutoScalingTarget:
    Type: AWS::ApplicationAutoScaling::ScalableTarget
    Properties:
      ServiceNamespace: ecs
      ResourceId: service/default/brainy
      ScalableDimension: ecs:service:DesiredCount
      MinCapacity: 2
      MaxCapacity: 100
      
  AutoScalingPolicy:
    Type: AWS::ApplicationAutoScaling::ScalingPolicy
    Properties:
      PolicyType: TargetTrackingScaling
      TargetTrackingScalingPolicyConfiguration:
        TargetValue: 70.0
        PredefinedMetricSpecification:
          PredefinedMetricType: ECSServiceAverageCPUUtilization
```

### 2. Vertical Scaling

Brainy automatically adapts to available memory:
- **256MB**: Minimal mode, optimized caching
- **512MB**: Standard mode, balanced performance
- **1GB+**: Full mode, maximum performance

## High Availability Setup

### Multi-AZ Deployment

```javascript
// Brainy automatically handles multi-AZ with S3
const brain = new Brainy({
  distributed: {
    enabled: true,  // Auto-enables with S3 storage
    coordinationMethod: 'auto' // Uses S3 for coordination
  }
})
```

### Load Balancing

```bash
# Application Load Balancer with health checks
aws elbv2 create-load-balancer \
  --name brainy-alb \
  --subnets subnet-xxx subnet-yyy \
  --security-groups sg-xxx

aws elbv2 create-target-group \
  --name brainy-targets \
  --protocol HTTP \
  --port 3000 \
  --vpc-id vpc-xxx \
  --health-check-path /health \
  --health-check-interval-seconds 30
```

## Monitoring & Observability

### CloudWatch Integration

Brainy automatically sends metrics when running on AWS:

```javascript
// Automatic CloudWatch metrics (no config needed)
// - Request count
// - Response time
// - Error rate
// - Storage usage
// - Memory usage
```

### Custom Metrics

```javascript
const brain = new Brainy({
  monitoring: {
    enabled: true,
    customMetrics: {
      namespace: 'Brainy/Production',
      dimensions: [
        { Name: 'Environment', Value: 'production' },
        { Name: 'Service', Value: 'api' }
      ]
    }
  }
})
```

## Security Best Practices

### 1. IAM Role (Recommended)

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:GetObject",
        "s3:PutObject",
        "s3:DeleteObject",
        "s3:ListBucket"
      ],
      "Resource": [
        "arn:aws:s3:::brainy-*/*",
        "arn:aws:s3:::brainy-*"
      ]
    }
  ]
}
```

### 2. VPC Configuration

```bash
# Private subnets with NAT Gateway
aws ec2 create-vpc --cidr-block 10.0.0.0/16
aws ec2 create-subnet --vpc-id vpc-xxx --cidr-block 10.0.1.0/24 --availability-zone us-east-1a
aws ec2 create-subnet --vpc-id vpc-xxx --cidr-block 10.0.2.0/24 --availability-zone us-east-1b
```

### 3. Encryption

```javascript
// Automatic encryption with S3
const brain = new Brainy({
  storage: {
    type: 's3',
    options: {
      encryption: 'auto' // Uses S3 SSE-S3 by default
    }
  }
})
```

## Cost Optimization

### 1. Spot Instances (70% savings)

```bash
aws ec2 request-spot-fleet --spot-fleet-request-config '{
  "IamFleetRole": "arn:aws:iam::xxx:role/fleet-role",
  "TargetCapacity": 2,
  "SpotPrice": "0.05",
  "LaunchSpecifications": [{
    "ImageId": "ami-xxx",
    "InstanceType": "t3.medium",
    "UserData": "BASE64_ENCODED_STARTUP_SCRIPT"
  }]
}'
```

### 2. S3 Intelligent-Tiering

```javascript
// Brainy automatically uses S3 Intelligent-Tiering
const brain = new Brainy({
  storage: {
    type: 's3',
    options: {
      storageClass: 'INTELLIGENT_TIERING' // Automatic cost optimization
    }
  }
})
```

### 3. Lambda Reserved Concurrency

```bash
aws lambda put-function-concurrency \
  --function-name brainy-handler \
  --reserved-concurrent-executions 10
```

## Deployment Automation

### GitHub Actions CI/CD

```yaml
name: Deploy to AWS
on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      
      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v1
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: us-east-1
      
      - name: Deploy to ECS
        run: |
          docker build -t brainy .
          docker tag brainy:latest $ECR_URI/brainy:latest
          docker push $ECR_URI/brainy:latest
          aws ecs update-service --cluster default --service brainy --force-new-deployment
```

## Troubleshooting

### Common Issues

1. **Storage Auto-Detection Fails**
   ```javascript
   // Explicitly specify storage
   const brain = new Brainy({
     storage: { type: 's3', options: { bucket: 'my-bucket' } }
   })
   ```

2. **Memory Issues**
   ```javascript
   // Optimize for low memory
   const brain = new Brainy({
     cache: { maxSize: 100 }, // Reduce cache size
     index: { M: 8 }          // Reduce HNSW connections
   })
   ```

3. **Cold Starts (Lambda)**

   **v7.3.0+ Progressive Initialization (Zero-Config)**

   Brainy automatically detects Lambda environments (AWS_LAMBDA_FUNCTION_NAME)
   and uses progressive initialization for <200ms cold starts:

   ```javascript
   // Zero-config - Brainy auto-detects Lambda
   const brain = new Brainy({
     storage: {
       type: 's3',
       s3Storage: {
         bucketName: 'my-bucket',
         region: 'us-east-1',
         accessKeyId: process.env.AWS_ACCESS_KEY_ID,
         secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
       }
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
       type: 's3',
       s3Storage: {
         bucketName: 'my-bucket',
         // Force specific mode
         initMode: 'progressive' // 'auto' | 'progressive' | 'strict'
       }
     }
   })
   ```

   | Mode | Cold Start | Best For |
   |------|------------|----------|
   | `auto` (default) | <200ms in Lambda | Zero-config, auto-detects |
   | `progressive` | <200ms always | Force fast init everywhere |
   | `strict` | 100-500ms+ | Local dev, tests, debugging |

   **Warm-up (Alternative)**
   ```javascript
   exports.warmup = async () => {
     if (!brain) {
       brain = new Brainy({ warmup: true })
       await brain.init()
     }
   }
   ```

   **Readiness Detection (v7.3.0+)**

   Use the `brain.ready` Promise to ensure Brainy is initialized before handling requests:

   ```javascript
   let brain

   exports.handler = async (event) => {
     if (!brain) {
       brain = new Brainy({ storage: { type: 's3', ... } })
       brain.init()  // Fire and forget
     }

     // Wait for initialization to complete
     await brain.ready

     // Now safe to use brain methods
     const results = await brain.find({ query: event.queryStringParameters.q })
     return { statusCode: 200, body: JSON.stringify(results) }
   }
   ```

   For health checks, use `isFullyInitialized()` to verify all background tasks are complete:

   ```javascript
   exports.healthCheck = async () => {
     try {
       await brain.ready
       return {
         statusCode: 200,
         body: JSON.stringify({
           status: 'ready',
           fullyInitialized: brain.isFullyInitialized()
         })
       }
     } catch (error) {
       return {
         statusCode: 503,
         body: JSON.stringify({ status: 'initializing' })
       }
     }
   }
   ```

## Production Checklist

- [ ] IAM roles configured with minimal permissions
- [ ] VPC with private subnets
- [ ] Auto-scaling configured
- [ ] CloudWatch alarms set up
- [ ] Backup strategy (S3 versioning enabled)
- [ ] SSL/TLS certificates configured
- [ ] Rate limiting enabled
- [ ] Health checks configured
- [ ] Monitoring dashboard created
- [ ] Cost alerts configured

## Support

- Documentation: https://brainy.soulcraft.ai/docs
- Issues: https://github.com/soulcraft/brainy/issues
- Community: https://discord.gg/brainy