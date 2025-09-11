# Kubernetes Deployment Guide for Brainy

## Overview
Deploy Brainy on Kubernetes with automatic scaling, high availability, and zero-config dynamic adaptation. Works with any Kubernetes distribution (vanilla, EKS, GKE, AKS, OpenShift, etc.).

## Quick Start (Zero-Config)

### Basic Deployment

```yaml
# brainy-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: brainy
  labels:
    app: brainy
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
        image: soulcraft/brainy:latest
        ports:
        - containerPort: 3000
        env:
        - name: NODE_ENV
          value: production
        # Brainy auto-detects Kubernetes and configures accordingly
        resources:
          requests:
            memory: "256Mi"
            cpu: "100m"
          limits:
            memory: "1Gi"
            cpu: "500m"
---
apiVersion: v1
kind: Service
metadata:
  name: brainy-service
spec:
  selector:
    app: brainy
  ports:
  - protocol: TCP
    port: 80
    targetPort: 3000
  type: LoadBalancer
```

Deploy:
```bash
kubectl apply -f brainy-deployment.yaml
```

## Production-Grade Setup

### 1. StatefulSet with Persistent Storage

```yaml
apiVersion: v1
kind: StorageClass
metadata:
  name: brainy-storage
provisioner: kubernetes.io/aws-ebs  # Or your cloud provider
parameters:
  type: gp3
  iopsPerGB: "10"
---
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: brainy
spec:
  serviceName: brainy-headless
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
        image: soulcraft/brainy:latest
        ports:
        - containerPort: 3000
        env:
        - name: NODE_ENV
          value: production
        - name: BRAINY_STORAGE_TYPE
          value: filesystem
        - name: BRAINY_STORAGE_PATH
          value: /data
        volumeMounts:
        - name: data
          mountPath: /data
        livenessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /ready
            port: 3000
          initialDelaySeconds: 5
          periodSeconds: 5
  volumeClaimTemplates:
  - metadata:
      name: data
    spec:
      accessModes: ["ReadWriteOnce"]
      storageClassName: brainy-storage
      resources:
        requests:
          storage: 10Gi
```

### 2. Horizontal Pod Autoscaler

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
  minReplicas: 2
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
  behavior:
    scaleUp:
      stabilizationWindowSeconds: 60
      policies:
      - type: Percent
        value: 100
        periodSeconds: 60
    scaleDown:
      stabilizationWindowSeconds: 300
      policies:
      - type: Percent
        value: 10
        periodSeconds: 60
```

### 3. Ingress Configuration

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: brainy-ingress
  annotations:
    kubernetes.io/ingress.class: nginx
    cert-manager.io/cluster-issuer: letsencrypt-prod
    nginx.ingress.kubernetes.io/rate-limit: "100"
    nginx.ingress.kubernetes.io/proxy-body-size: "50m"
spec:
  tls:
  - hosts:
    - api.brainy.example.com
    secretName: brainy-tls
  rules:
  - host: api.brainy.example.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: brainy-service
            port:
              number: 80
```

## Zero-Config Storage Options

### Option 1: S3-Compatible Storage (Recommended)

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: brainy-s3-credentials
type: Opaque
data:
  access-key: <base64-encoded-key>
  secret-key: <base64-encoded-secret>
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: brainy
spec:
  template:
    spec:
      containers:
      - name: brainy
        env:
        - name: BRAINY_STORAGE_TYPE
          value: s3
        - name: AWS_ACCESS_KEY_ID
          valueFrom:
            secretKeyRef:
              name: brainy-s3-credentials
              key: access-key
        - name: AWS_SECRET_ACCESS_KEY
          valueFrom:
            secretKeyRef:
              name: brainy-s3-credentials
              key: secret-key
        - name: S3_BUCKET
          value: brainy-data
        - name: AWS_REGION
          value: us-east-1
```

### Option 2: MinIO (Self-Hosted S3)

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: minio
spec:
  replicas: 1
  selector:
    matchLabels:
      app: minio
  template:
    metadata:
      labels:
        app: minio
    spec:
      containers:
      - name: minio
        image: minio/minio:latest
        args:
        - server
        - /data
        env:
        - name: MINIO_ROOT_USER
          value: brainy
        - name: MINIO_ROOT_PASSWORD
          value: brainy123456
        volumeMounts:
        - name: data
          mountPath: /data
      volumes:
      - name: data
        persistentVolumeClaim:
          claimName: minio-pvc
---
apiVersion: v1
kind: Service
metadata:
  name: minio-service
spec:
  selector:
    app: minio
  ports:
  - port: 9000
    targetPort: 9000
```

### Option 3: Shared NFS Storage

```yaml
apiVersion: v1
kind: PersistentVolume
metadata:
  name: brainy-nfs-pv
spec:
  capacity:
    storage: 100Gi
  accessModes:
    - ReadWriteMany
  nfs:
    server: nfs-server.example.com
    path: /export/brainy
---
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: brainy-nfs-pvc
spec:
  accessModes:
    - ReadWriteMany
  resources:
    requests:
      storage: 100Gi
```

## High Availability Configuration

### 1. Pod Anti-Affinity

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: brainy
spec:
  template:
    spec:
      affinity:
        podAntiAffinity:
          requiredDuringSchedulingIgnoredDuringExecution:
          - labelSelector:
              matchExpressions:
              - key: app
                operator: In
                values:
                - brainy
            topologyKey: kubernetes.io/hostname
```

### 2. Pod Disruption Budget

```yaml
apiVersion: policy/v1
kind: PodDisruptionBudget
metadata:
  name: brainy-pdb
spec:
  minAvailable: 2
  selector:
    matchLabels:
      app: brainy
```

### 3. Multi-Zone Deployment

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: brainy
spec:
  template:
    spec:
      topologySpreadConstraints:
      - maxSkew: 1
        topologyKey: topology.kubernetes.io/zone
        whenUnsatisfiable: DoNotSchedule
        labelSelector:
          matchLabels:
            app: brainy
```

## Monitoring & Observability

### 1. Prometheus Metrics

```yaml
apiVersion: v1
kind: Service
metadata:
  name: brainy-metrics
  annotations:
    prometheus.io/scrape: "true"
    prometheus.io/port: "9090"
    prometheus.io/path: "/metrics"
spec:
  selector:
    app: brainy
  ports:
  - name: metrics
    port: 9090
    targetPort: 9090
```

### 2. Grafana Dashboard

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: brainy-dashboard
data:
  dashboard.json: |
    {
      "dashboard": {
        "title": "Brainy Metrics",
        "panels": [
          {
            "title": "Request Rate",
            "targets": [
              {
                "expr": "rate(brainy_requests_total[5m])"
              }
            ]
          },
          {
            "title": "Response Time",
            "targets": [
              {
                "expr": "histogram_quantile(0.95, brainy_response_time)"
              }
            ]
          }
        ]
      }
    }
```

### 3. Logging with Fluentd

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: fluentd-config
data:
  fluent.conf: |
    <source>
      @type tail
      path /var/log/containers/brainy*.log
      pos_file /var/log/fluentd-brainy.log.pos
      tag brainy.*
      <parse>
        @type json
      </parse>
    </source>
    
    <match brainy.**>
      @type elasticsearch
      host elasticsearch.logging.svc.cluster.local
      port 9200
      logstash_format true
      logstash_prefix brainy
    </match>
```

## Security Best Practices

### 1. Network Policies

```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: brainy-netpol
spec:
  podSelector:
    matchLabels:
      app: brainy
  policyTypes:
  - Ingress
  - Egress
  ingress:
  - from:
    - namespaceSelector:
        matchLabels:
          name: ingress-nginx
    ports:
    - protocol: TCP
      port: 3000
  egress:
  - to:
    - namespaceSelector: {}
    ports:
    - protocol: TCP
      port: 443  # HTTPS
    - protocol: TCP
      port: 9000 # MinIO/S3
```

### 2. Pod Security Policy

```yaml
apiVersion: policy/v1beta1
kind: PodSecurityPolicy
metadata:
  name: brainy-psp
spec:
  privileged: false
  allowPrivilegeEscalation: false
  requiredDropCapabilities:
    - ALL
  volumes:
    - 'configMap'
    - 'emptyDir'
    - 'projected'
    - 'secret'
    - 'persistentVolumeClaim'
  runAsUser:
    rule: 'MustRunAsNonRoot'
  seLinux:
    rule: 'RunAsAny'
  fsGroup:
    rule: 'RunAsAny'
```

### 3. RBAC Configuration

```yaml
apiVersion: v1
kind: ServiceAccount
metadata:
  name: brainy-sa
---
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: brainy-role
rules:
- apiGroups: [""]
  resources: ["configmaps"]
  verbs: ["get", "list", "watch"]
- apiGroups: [""]
  resources: ["secrets"]
  verbs: ["get"]
---
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: brainy-rolebinding
subjects:
- kind: ServiceAccount
  name: brainy-sa
roleRef:
  kind: Role
  name: brainy-role
  apiGroup: rbac.authorization.k8s.io
```

## GitOps with ArgoCD

```yaml
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: brainy
  namespace: argocd
spec:
  project: default
  source:
    repoURL: https://github.com/yourorg/brainy-k8s
    targetRevision: HEAD
    path: manifests
  destination:
    server: https://kubernetes.default.svc
    namespace: brainy
  syncPolicy:
    automated:
      prune: true
      selfHeal: true
    syncOptions:
    - CreateNamespace=true
```

## Helm Chart Installation

```bash
# Add Brainy Helm repository
helm repo add brainy https://charts.brainy.io
helm repo update

# Install with custom values
cat > values.yaml << EOF
replicaCount: 3
image:
  repository: soulcraft/brainy
  tag: latest
  pullPolicy: IfNotPresent

service:
  type: LoadBalancer
  port: 80

ingress:
  enabled: true
  className: nginx
  hosts:
    - host: api.brainy.example.com
      paths:
        - path: /
          pathType: Prefix

resources:
  limits:
    cpu: 1000m
    memory: 1Gi
  requests:
    cpu: 100m
    memory: 256Mi

autoscaling:
  enabled: true
  minReplicas: 2
  maxReplicas: 100
  targetCPUUtilizationPercentage: 70

storage:
  type: s3
  s3:
    bucket: brainy-data
    region: us-east-1
EOF

helm install brainy brainy/brainy -f values.yaml
```

## Cost Optimization

### 1. Spot/Preemptible Nodes

```yaml
apiVersion: v1
kind: NodePool
metadata:
  name: brainy-spot-pool
spec:
  nodeSelector:
    node.kubernetes.io/lifecycle: spot
  taints:
  - key: spot
    value: "true"
    effect: NoSchedule
  tolerations:
  - key: spot
    operator: Equal
    value: "true"
    effect: NoSchedule
```

### 2. Vertical Pod Autoscaler

```yaml
apiVersion: autoscaling.k8s.io/v1
kind: VerticalPodAutoscaler
metadata:
  name: brainy-vpa
spec:
  targetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: brainy
  updatePolicy:
    updateMode: "Auto"
  resourcePolicy:
    containerPolicies:
    - containerName: brainy
      minAllowed:
        cpu: 100m
        memory: 128Mi
      maxAllowed:
        cpu: 2
        memory: 2Gi
```

## Troubleshooting

### Common Issues

1. **Pod CrashLoopBackOff**
   ```bash
   kubectl logs -f pod/brainy-xxx
   kubectl describe pod brainy-xxx
   ```

2. **Storage Issues**
   ```bash
   kubectl get pv,pvc
   kubectl describe pvc brainy-data
   ```

3. **Network Connectivity**
   ```bash
   kubectl exec -it pod/brainy-xxx -- curl http://brainy-service/health
   kubectl get endpoints brainy-service
   ```

4. **Memory Pressure**
   ```bash
   kubectl top pods -l app=brainy
   kubectl describe node
   ```

## Production Checklist

- [ ] High availability with multiple replicas
- [ ] Pod disruption budgets configured
- [ ] Resource limits and requests set
- [ ] Horizontal and vertical autoscaling enabled
- [ ] Persistent storage configured
- [ ] Network policies in place
- [ ] RBAC properly configured
- [ ] Monitoring and alerting setup
- [ ] Backup and disaster recovery plan
- [ ] Security scanning enabled
- [ ] GitOps deployment pipeline

## Support

- Documentation: https://brainy.soulcraft.ai/docs
- Helm Charts: https://github.com/soulcraft/brainy-charts
- Issues: https://github.com/soulcraft/brainy/issues
- Slack: https://brainy-community.slack.com