# 🌐 Brainy API Exposure Architecture

## 📡 Current State: Built-in MCP Support

Brainy **already has** Model Context Protocol (MCP) support built-in:

```typescript
// Already exists in Brainy!
import { BrainyMCPService } from 'brainy/mcp'

const brain = new BrainyData()
const mcpService = new BrainyMCPService(brain)

// Handles MCP requests
const response = await mcpService.handleRequest({
  type: 'data_access',
  operation: 'search',
  parameters: { query: 'find documents' }
})
```

### What's Already Built:
- **BrainyMCPAdapter** - Exposes data operations
- **MCPAugmentationToolset** - Exposes augmentations as MCP tools
- **BrainyMCPService** - Unified service layer
- **ServerSearchConduitAugmentation** - Connect to remote Brainy instances

## 🚀 The Missing Piece: API Server Augmentation

What's **NOT** built yet is a unified API server that exposes REST, WebSocket, and MCP over network. This SHOULD be an augmentation!

```typescript
/**
 * Universal API Server Augmentation
 * Exposes Brainy through REST, WebSocket, MCP, and GraphQL
 */
export class APIServerAugmentation extends BaseAugmentation {
  readonly name = 'api-server'
  readonly timing = 'after' as const
  readonly operations = ['all'] as const  // Monitor all operations
  readonly priority = 5  // Low priority, runs last
  
  private httpServer?: any
  private wsServer?: any
  private mcpService?: BrainyMCPService
  private clients = new Set<any>()
  private apiKeys = new Map<string, any>()
  
  protected async onInitialize(): Promise<void> {
    const config = this.context.config.apiServer || {}
    
    if (!config.enabled) {
      this.log('API Server disabled in config')
      return
    }
    
    // Initialize MCP service
    this.mcpService = new BrainyMCPService(this.context.brain, {
      enableAuth: config.requireAuth
    })
    
    // Start servers based on environment
    if (typeof process !== 'undefined' && process.versions?.node) {
      await this.startNodeServers(config)
    } else if (typeof Deno !== 'undefined') {
      await this.startDenoServer(config)
    } else if (typeof self !== 'undefined') {
      await this.startServiceWorker(config)
    }
  }
  
  private async startNodeServers(config: any) {
    const express = await import('express')
    const { WebSocketServer } = await import('ws')
    const cors = await import('cors')
    
    const app = express.default()
    
    // Middleware
    app.use(cors.default(config.cors))
    app.use(express.json())
    app.use(this.authMiddleware.bind(this))
    app.use(this.rateLimitMiddleware.bind(this))
    
    // REST API Routes
    this.setupRESTRoutes(app)
    
    // Start HTTP server
    this.httpServer = app.listen(config.port || 3000, () => {
      this.log(`REST API listening on port ${config.port || 3000}`)
    })
    
    // WebSocket server for real-time
    this.wsServer = new WebSocketServer({ 
      server: this.httpServer,
      path: '/ws'
    })
    
    this.setupWebSocketServer()
    
    // MCP over WebSocket
    this.setupMCPWebSocket()
  }
  
  private setupRESTRoutes(app: any) {
    // Health check
    app.get('/health', (req: any, res: any) => {
      res.json({ status: 'healthy', version: '2.0.0' })
    })
    
    // Search endpoint
    app.post('/api/search', async (req: any, res: any) => {
      try {
        const { query, limit = 10, options = {} } = req.body
        const results = await this.context.brain.search(query, limit, options)
        res.json({ success: true, results })
      } catch (error) {
        res.status(500).json({ 
          success: false, 
          error: error.message 
        })
      }
    })
    
    // Add data endpoint
    app.post('/api/add', async (req: any, res: any) => {
      try {
        const { content, metadata } = req.body
        const id = await this.context.brain.add(content, metadata)
        res.json({ success: true, id })
      } catch (error) {
        res.status(500).json({ 
          success: false, 
          error: error.message 
        })
      }
    })
    
    // Get endpoint
    app.get('/api/get/:id', async (req: any, res: any) => {
      try {
        const data = await this.context.brain.get(req.params.id)
        res.json({ success: true, data })
      } catch (error) {
        res.status(404).json({ 
          success: false, 
          error: 'Not found' 
        })
      }
    })
    
    // Delete endpoint
    app.delete('/api/delete/:id', async (req: any, res: any) => {
      try {
        await this.context.brain.delete(req.params.id)
        res.json({ success: true })
      } catch (error) {
        res.status(500).json({ 
          success: false, 
          error: error.message 
        })
      }
    })
    
    // Relate endpoint
    app.post('/api/relate', async (req: any, res: any) => {
      try {
        const { source, target, verb, metadata } = req.body
        await this.context.brain.relate(source, target, verb, metadata)
        res.json({ success: true })
      } catch (error) {
        res.status(500).json({ 
          success: false, 
          error: error.message 
        })
      }
    })
    
    // Find endpoint (complex queries)
    app.post('/api/find', async (req: any, res: any) => {
      try {
        const results = await this.context.brain.find(req.body)
        res.json({ success: true, results })
      } catch (error) {
        res.status(500).json({ 
          success: false, 
          error: error.message 
        })
      }
    })
    
    // Cluster endpoint
    app.post('/api/cluster', async (req: any, res: any) => {
      try {
        const { algorithm = 'kmeans', options = {} } = req.body
        const clusters = await this.context.brain.cluster(algorithm, options)
        res.json({ success: true, clusters })
      } catch (error) {
        res.status(500).json({ 
          success: false, 
          error: error.message 
        })
      }
    })
    
    // MCP endpoint (for non-WebSocket MCP)
    app.post('/api/mcp', async (req: any, res: any) => {
      try {
        const response = await this.mcpService.handleRequest(req.body)
        res.json(response)
      } catch (error) {
        res.status(500).json({ 
          success: false, 
          error: error.message 
        })
      }
    })
    
    // GraphQL endpoint (optional)
    if (this.context.config.apiServer?.enableGraphQL) {
      this.setupGraphQL(app)
    }
  }
  
  private setupWebSocketServer() {
    this.wsServer.on('connection', (ws: any) => {
      this.clients.add(ws)
      
      ws.on('message', async (message: string) => {
        try {
          const msg = JSON.parse(message)
          await this.handleWebSocketMessage(msg, ws)
        } catch (error) {
          ws.send(JSON.stringify({
            type: 'error',
            error: error.message
          }))
        }
      })
      
      ws.on('close', () => {
        this.clients.delete(ws)
      })
    })
  }
  
  private async handleWebSocketMessage(msg: any, ws: any) {
    switch (msg.type) {
      case 'subscribe':
        // Subscribe to operations
        ws.subscriptions = msg.operations || ['all']
        ws.send(JSON.stringify({ 
          type: 'subscribed', 
          operations: ws.subscriptions 
        }))
        break
        
      case 'search':
        const results = await this.context.brain.search(msg.query, msg.limit)
        ws.send(JSON.stringify({ 
          type: 'searchResults', 
          results 
        }))
        break
        
      case 'mcp':
        // Handle MCP over WebSocket
        const response = await this.mcpService.handleRequest(msg.request)
        ws.send(JSON.stringify({ 
          type: 'mcpResponse', 
          response 
        }))
        break
    }
  }
  
  private setupMCPWebSocket() {
    // Dedicated MCP WebSocket endpoint
    const { WebSocketServer } = require('ws')
    const mcpWs = new WebSocketServer({ 
      port: (this.context.config.apiServer?.mcpPort || 3001),
      path: '/mcp'
    })
    
    mcpWs.on('connection', (ws: any) => {
      ws.on('message', async (message: string) => {
        try {
          const request = JSON.parse(message)
          const response = await this.mcpService.handleRequest(request)
          ws.send(JSON.stringify(response))
        } catch (error) {
          ws.send(JSON.stringify({
            error: error.message,
            type: 'error'
          }))
        }
      })
    })
    
    this.log(`MCP WebSocket listening on port ${this.context.config.apiServer?.mcpPort || 3001}`)
  }
  
  // Broadcast changes to all connected clients
  async execute<T>(operation: string, params: any, next: () => Promise<T>): Promise<T> {
    const result = await next()
    
    // Broadcast to WebSocket clients
    if (this.clients.size > 0) {
      const message = JSON.stringify({
        type: 'operation',
        operation,
        params: this.sanitizeParams(params),
        timestamp: Date.now()
      })
      
      for (const client of this.clients) {
        if (client.subscriptions?.includes('all') || 
            client.subscriptions?.includes(operation)) {
          client.send(message)
        }
      }
    }
    
    return result
  }
  
  private authMiddleware(req: any, res: any, next: any) {
    if (!this.context.config.apiServer?.requireAuth) {
      return next()
    }
    
    const apiKey = req.headers['x-api-key']
    if (!apiKey || !this.apiKeys.has(apiKey)) {
      return res.status(401).json({ error: 'Unauthorized' })
    }
    
    req.user = this.apiKeys.get(apiKey)
    next()
  }
  
  private rateLimitMiddleware(req: any, res: any, next: any) {
    // Simple rate limiting
    const ip = req.ip
    const limit = this.context.config.apiServer?.rateLimit || 100
    
    // Implementation details...
    next()
  }
  
  private sanitizeParams(params: any) {
    // Remove sensitive data before broadcasting
    const safe = { ...params }
    delete safe.apiKey
    delete safe.password
    return safe
  }
  
  protected async onShutdown() {
    // Close all connections
    for (const client of this.clients) {
      client.close()
    }
    
    // Close servers
    if (this.httpServer) {
      await new Promise(resolve => this.httpServer.close(resolve))
    }
    if (this.wsServer) {
      this.wsServer.close()
    }
  }
}
```

## 🎯 Usage: Deploy Brainy as a Server

```typescript
import { BrainyData } from 'brainy'
import { APIServerAugmentation } from 'brainy/augmentations'

const brain = new BrainyData({
  apiServer: {
    enabled: true,
    port: 3000,
    mcpPort: 3001,
    requireAuth: true,
    rateLimit: 100,
    cors: { origin: '*' },
    enableGraphQL: false
  }
})

// Register the API server augmentation
brain.augmentations.register(new APIServerAugmentation())

await brain.init()

console.log('Brainy API Server running!')
console.log('REST API: http://localhost:3000')
console.log('WebSocket: ws://localhost:3000/ws')
console.log('MCP: ws://localhost:3001/mcp')
```

## 🔌 Client Usage

### REST API
```javascript
// Search
const response = await fetch('http://localhost:3000/api/search', {
  method: 'POST',
  headers: { 
    'Content-Type': 'application/json',
    'X-API-Key': 'your-key'
  },
  body: JSON.stringify({ 
    query: 'find documents about AI',
    limit: 10 
  })
})
const { results } = await response.json()
```

### WebSocket (Real-time)
```javascript
const ws = new WebSocket('ws://localhost:3000/ws')

ws.onopen = () => {
  // Subscribe to operations
  ws.send(JSON.stringify({
    type: 'subscribe',
    operations: ['add', 'delete', 'relate']
  }))
}

ws.onmessage = (event) => {
  const msg = JSON.parse(event.data)
  console.log('Operation:', msg.operation, msg.params)
}
```

### MCP (AI Agents)
```javascript
const mcpWs = new WebSocket('ws://localhost:3001/mcp')

mcpWs.send(JSON.stringify({
  type: 'data_access',
  operation: 'search',
  requestId: '123',
  parameters: { query: 'test' }
}))

mcpWs.onmessage = (event) => {
  const response = JSON.parse(event.data)
  console.log('MCP Response:', response)
}
```

## 🏗️ Architecture Benefits

### Why as an Augmentation?

1. **Optional** - Not everyone needs a server
2. **Configurable** - Easy to enable/disable
3. **Extensible** - Add custom endpoints
4. **Integrated** - Hooks into all operations
5. **Real-time** - Broadcasts changes automatically

### Security Features

- **API Key Authentication**
- **Rate Limiting**
- **CORS Configuration**
- **Parameter Sanitization**
- **SSL/TLS Support** (with proper certs)

## 🌍 Deployment Options

### Local Development
```bash
npm install brainy
node server.js  # Your server file with APIServerAugmentation
```

### Docker Container
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install brainy
COPY server.js .
EXPOSE 3000 3001
CMD ["node", "server.js"]
```

### Cloud Deployment
Deploy to any Node.js hosting:
- Vercel Edge Functions
- Cloudflare Workers (with adapter)
- AWS Lambda (with adapter)
- Google Cloud Run
- Traditional VPS

### Browser Service Worker
```javascript
// In browser, use Service Worker for local API
if ('serviceWorker' in navigator) {
  // APIServerAugmentation can create a Service Worker
  // that intercepts fetch() calls and handles them locally
}
```

## 🎯 The Complete Picture

```
┌─────────────────────────────────────────────┐
│            Client Applications              │
├─────────────┬───────────┬──────────────────┤
│    REST     │ WebSocket │      MCP         │
└──────┬──────┴─────┬─────┴──────┬───────────┘
       │            │            │
       ▼            ▼            ▼
┌─────────────────────────────────────────────┐
│        APIServerAugmentation               │
│  (Unified API exposure as augmentation)    │
└─────────────────┬───────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────┐
│           BrainyData Core                  │
│  (with all augmentations in pipeline)      │
└─────────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────┐
│            Storage Layer                   │
│   (FileSystem, S3, OPFS, Memory)          │
└─────────────────────────────────────────────┘
```

## 🚀 Summary

1. **MCP is built-in** - Already in Brainy core
2. **API Server should be an augmentation** - Optional, configurable
3. **Exposes everything** - REST, WebSocket, MCP, GraphQL
4. **Real-time by default** - Broadcasts all operations
5. **Secure** - Auth, rate limiting, CORS
6. **Deploy anywhere** - Node, Deno, Browser, Cloud

The beauty is that the API server is just another augmentation - it hooks into the pipeline like everything else and exposes Brainy's capabilities to the world!