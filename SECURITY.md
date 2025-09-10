# Security Best Practices for Brainy

## 🔒 Data Security

### Encryption at Rest
```typescript
const brain = new Brainy({
  storage: {
    type: 's3',
    options: {
      encryption: 'AES256',  // Server-side encryption
      kmsKeyId: process.env.KMS_KEY_ID  // Optional KMS key
    }
  }
})
```

### Encryption in Transit
- Always use HTTPS/TLS for API endpoints
- Enable SSL for database connections
- Use VPN or private networks for internal communication

## 🔑 Authentication & Authorization

### API Key Management
```typescript
// Middleware example
app.use('/api/brainy', (req, res, next) => {
  const apiKey = req.headers['x-api-key']
  
  if (!apiKey || !isValidApiKey(apiKey)) {
    return res.status(401).json({ error: 'Unauthorized' })
  }
  
  // Rate limit by API key
  const limit = getRateLimitForKey(apiKey)
  if (exceedsRateLimit(apiKey, limit)) {
    return res.status(429).json({ error: 'Rate limit exceeded' })
  }
  
  next()
})
```

### JWT Authentication
```typescript
import jwt from 'jsonwebtoken'

// Verify JWT token
app.use('/api/brainy', (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1]
  
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET)
    req.user = decoded
    next()
  } catch (error) {
    return res.status(401).json({ error: 'Invalid token' })
  }
})
```

## 🛡️ Input Validation & Sanitization

### Query Validation
```typescript
import { z } from 'zod'

const SearchSchema = z.object({
  query: z.string().min(1).max(1000),
  limit: z.number().min(1).max(100).default(10),
  metadata: z.record(z.unknown()).optional()
})

app.post('/api/search', async (req, res) => {
  try {
    const params = SearchSchema.parse(req.body)
    const results = await brain.find(params)
    res.json(results)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: error.errors })
    }
    throw error
  }
})
```

### Metadata Sanitization
```typescript
function sanitizeMetadata(metadata: any): any {
  // Remove potential XSS vectors
  const sanitized = {}
  
  for (const [key, value] of Object.entries(metadata)) {
    // Sanitize keys
    const cleanKey = key.replace(/[<>'"]/g, '')
    
    // Sanitize values
    if (typeof value === 'string') {
      sanitized[cleanKey] = value.replace(/[<>'"]/g, '')
    } else if (typeof value === 'object' && value !== null) {
      sanitized[cleanKey] = sanitizeMetadata(value)
    } else {
      sanitized[cleanKey] = value
    }
  }
  
  return sanitized
}

// Use before adding to brain
const sanitizedData = {
  text: sanitizeText(input.text),
  metadata: sanitizeMetadata(input.metadata)
}
await brain.add(sanitizedData)
```

## 🚦 Rate Limiting

### Per-IP Rate Limiting
```typescript
import rateLimit from 'express-rate-limit'

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP'
})

app.use('/api/brainy', limiter)
```

### Per-User Rate Limiting
```typescript
const userLimits = new Map()

function checkUserRateLimit(userId: string, limit = 1000): boolean {
  const now = Date.now()
  const userRequests = userLimits.get(userId) || []
  
  // Remove old requests (older than 1 hour)
  const recentRequests = userRequests.filter((time: number) => 
    now - time < 3600000
  )
  
  if (recentRequests.length >= limit) {
    return false
  }
  
  recentRequests.push(now)
  userLimits.set(userId, recentRequests)
  return true
}
```

## 🔍 Audit Logging

### Comprehensive Audit Trail
```typescript
interface AuditLog {
  timestamp: Date
  userId: string
  action: string
  resource: string
  details: any
  ip: string
  userAgent: string
}

class AuditLogger {
  async log(entry: AuditLog): Promise<void> {
    // Log to secure storage
    await this.storage.append('audit.log', JSON.stringify(entry) + '\n')
    
    // Alert on suspicious activity
    if (this.isSuspicious(entry)) {
      await this.alertSecurityTeam(entry)
    }
  }
  
  private isSuspicious(entry: AuditLog): boolean {
    // Check for patterns like:
    // - Multiple failed auth attempts
    // - Unusual data access patterns
    // - Bulk data exports
    // - Access from new locations
    return false // Implement your logic
  }
}

// Use in your API
app.use(async (req, res, next) => {
  const entry: AuditLog = {
    timestamp: new Date(),
    userId: req.user?.id || 'anonymous',
    action: req.method,
    resource: req.path,
    details: req.body,
    ip: req.ip,
    userAgent: req.headers['user-agent']
  }
  
  await auditLogger.log(entry)
  next()
})
```

## 🗑️ Data Privacy & GDPR Compliance

### Right to Deletion
```typescript
async function deleteUserData(userId: string): Promise<void> {
  // Find all items belonging to user
  const userItems = await brain.find({
    metadata: { userId }
  })
  
  // Delete each item
  for (const item of userItems) {
    await brain.delete(item.id)
  }
  
  // Log the deletion
  await auditLogger.log({
    timestamp: new Date(),
    userId,
    action: 'DELETE_USER_DATA',
    resource: 'user_data',
    details: { itemCount: userItems.length },
    ip: 'system',
    userAgent: 'gdpr-compliance'
  })
}
```

### Data Export
```typescript
async function exportUserData(userId: string): Promise<any> {
  // Get all user data
  const items = await brain.find({
    metadata: { userId }
  })
  
  // Get all relationships
  const relationships = []
  for (const item of items) {
    const relations = await brain.getRelations(item.id)
    relationships.push(...relations)
  }
  
  return {
    exportDate: new Date().toISOString(),
    userId,
    items,
    relationships,
    metadata: {
      itemCount: items.length,
      relationshipCount: relationships.length
    }
  }
}
```

## 🚨 Security Headers

### Express.js Security Headers
```typescript
import helmet from 'helmet'

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
}))
```

## 🔐 Environment Variables

### Secure Configuration
```bash
# .env.production
NODE_ENV=production
JWT_SECRET=<use-strong-random-secret>
DATABASE_URL=<encrypted-connection-string>
AWS_ACCESS_KEY_ID=<use-iam-roles-in-production>
AWS_SECRET_ACCESS_KEY=<use-iam-roles-in-production>
REDIS_PASSWORD=<strong-password>
ENCRYPTION_KEY=<32-byte-random-key>
```

### Runtime Validation
```typescript
import { z } from 'zod'

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']),
  JWT_SECRET: z.string().min(32),
  DATABASE_URL: z.string().url(),
  AWS_REGION: z.string(),
  REDIS_HOST: z.string(),
  REDIS_PORT: z.string().transform(Number),
  ENCRYPTION_KEY: z.string().length(64) // Hex encoded 32 bytes
})

// Validate on startup
try {
  const env = EnvSchema.parse(process.env)
  console.log('✅ Environment configuration valid')
} catch (error) {
  console.error('❌ Invalid environment configuration:', error)
  process.exit(1)
}
```

## 🛠️ Security Checklist

### Development
- [ ] Use `.env` files for secrets (never commit)
- [ ] Enable TypeScript strict mode
- [ ] Run security linting (eslint-plugin-security)
- [ ] Use dependency scanning (npm audit)
- [ ] Implement unit tests for auth logic

### Staging
- [ ] Penetration testing
- [ ] Load testing with security scenarios
- [ ] Review audit logs
- [ ] Test rate limiting
- [ ] Verify encryption working

### Production
- [ ] Enable all security headers
- [ ] Configure WAF (Web Application Firewall)
- [ ] Set up intrusion detection
- [ ] Enable DDoS protection
- [ ] Configure automated backups
- [ ] Set up security alerts
- [ ] Regular security audits
- [ ] Incident response plan

## 📊 Monitoring & Alerts

### Security Metrics
```typescript
// Track and alert on:
const securityMetrics = {
  failedAuthAttempts: 0,
  rateLimitHits: 0,
  suspiciousQueries: 0,
  largeDataExports: 0,
  unusualAccessPatterns: 0
}

// Alert thresholds
const alertThresholds = {
  failedAuthAttempts: 10, // per minute
  rateLimitHits: 100, // per minute
  suspiciousQueries: 5, // per minute
  largeDataExports: 10, // per hour
}
```

## 🚪 Incident Response

### Response Plan
1. **Detect** - Monitoring alerts trigger
2. **Contain** - Isolate affected systems
3. **Investigate** - Review audit logs
4. **Remediate** - Fix vulnerability
5. **Recover** - Restore normal operations
6. **Review** - Post-incident analysis

### Emergency Contacts
- Security Team: security@yourcompany.com
- On-call Engineer: Use PagerDuty
- Legal Team: legal@yourcompany.com
- PR Team: pr@yourcompany.com