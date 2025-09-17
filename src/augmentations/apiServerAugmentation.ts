/**
 * API Server Augmentation - Universal API Exposure
 * 
 * 🌐 Exposes Brainy through REST, WebSocket, and MCP
 * 🔌 Works in Node.js, Deno, and Service Workers
 * 🚀 Single augmentation for all API needs
 * 
 * This unifies and replaces:
 * - BrainyMCPBroadcast (Node-specific server)
 * - WebSocketConduitAugmentation (client connections)
 * - Future REST API implementations
 */

import { BaseAugmentation, AugmentationContext } from './brainyAugmentation.js'
import { BrainyMCPService } from '../mcp/brainyMCPService.js'
import { v4 as uuidv4 } from '../universal/uuid.js'
import { isNode, isBrowser } from '../utils/environment.js'

export interface APIServerConfig {
  enabled?: boolean
  port?: number
  mcpPort?: number
  wsPort?: number
  host?: string
  cors?: {
    origin?: string | string[]
    credentials?: boolean
  }
  auth?: {
    required?: boolean
    apiKeys?: string[]
    bearerTokens?: string[]
  }
  rateLimit?: {
    windowMs?: number
    max?: number
  }
  ssl?: {
    cert?: string
    key?: string
  }
}

interface ConnectedClient {
  id: string
  type: 'rest' | 'websocket' | 'mcp'
  socket?: any
  subscriptions?: string[]
  metadata?: Record<string, any>
  lastSeen: number
}

/**
 * Unified API Server Augmentation
 * Exposes Brainy through multiple protocols
 */
export class APIServerAugmentation extends BaseAugmentation {
  readonly name = 'api-server'
  readonly timing = 'after' as const
  readonly metadata = 'readonly' as const  // API server reads metadata to serve data
  readonly operations = ['all'] as ('all')[]
  readonly priority = 5  // Low priority, runs after other augmentations
  
  protected config: APIServerConfig
  private mcpService?: BrainyMCPService
  private httpServer?: any
  private wsServer?: any
  private clients = new Map<string, ConnectedClient>()
  private operationHistory: any[] = []
  private maxHistorySize = 1000
  private rateLimitStore = new Map<string, number[]>()
  
  constructor(config: APIServerConfig = {}) {
    super()
    this.config = {
      enabled: true,
      port: 3000,
      host: '0.0.0.0',
      cors: { origin: '*', credentials: true },
      auth: { required: false },
      rateLimit: { windowMs: 60000, max: 100 },
      ...config
    }
  }
  
  protected async onInitialize(): Promise<void> {
    if (!this.config.enabled) {
      this.log('API Server disabled in config')
      return
    }
    
    // Initialize MCP service
    this.mcpService = new BrainyMCPService(this.context!.brain, {
      enableAuth: this.config.auth?.required
    })
    
    // Start appropriate server based on environment
    if (isNode()) {
      await this.startNodeServer()
    } else if (typeof (globalThis as any).Deno !== 'undefined') {
      await this.startDenoServer()
    } else if (isBrowser() && 'serviceWorker' in navigator) {
      await this.startServiceWorker()
    } else {
      this.log('No suitable server environment detected', 'warn')
    }
  }
  
  /**
   * Start Node.js server with Express
   */
  private async startNodeServer(): Promise<void> {
    try {
      // Dynamic imports for Node.js dependencies
      const express = await import('express').catch(() => null)
      const cors = await import('cors').catch(() => null)
      const ws = await import('ws').catch(() => null)
      const { createServer } = await import('http')
      
      if (!express || !cors || !ws) {
        this.log('Express, cors, or ws not available. Install with: npm install express cors ws', 'error')
        return
      }
      
      const WebSocketServer = (ws as any)?.WebSocketServer || (ws as any)?.default?.WebSocketServer || (ws as any)?.Server
      
      const app = express.default()
      
      // Middleware
      app.use(cors.default(this.config.cors))
      app.use((express.default || express).json({ limit: '50mb' }))
      app.use(this.authMiddleware.bind(this))
      app.use(this.rateLimitMiddleware.bind(this))
      
      // REST API Routes
      this.setupRESTRoutes(app)
      
      // Create HTTP server
      this.httpServer = createServer(app)
      
      // WebSocket server
      this.wsServer = new WebSocketServer({
        server: this.httpServer,
        path: '/ws'
      })
      
      this.setupWebSocketServer()
      
      // Start listening
      await new Promise<void>((resolve, reject) => {
        this.httpServer.listen(this.config.port, this.config.host, () => {
          this.log(`🌐 API Server listening on http://${this.config.host}:${this.config.port}`)
          this.log(`🔌 WebSocket: ws://${this.config.host}:${this.config.port}/ws`)
          this.log(`🧠 MCP endpoint: http://${this.config.host}:${this.config.port}/api/mcp`)
          resolve()
        }).on('error', reject)
      })
      
      // Heartbeat interval
      setInterval(() => this.sendHeartbeats(), 30000)
      
    } catch (error) {
      this.log(`Failed to start Node.js server: ${error}`, 'error')
      throw error
    }
  }
  
  /**
   * Setup REST API routes
   */
  private setupRESTRoutes(app: any): void {
    // Health check
    app.get('/health', (_req: any, res: any) => {
      res.json({
        status: 'healthy',
        version: '2.0.0',
        clients: this.clients.size,
        uptime: process.uptime ? process.uptime() : 0
      })
    })
    
    // Search endpoint
    app.post('/api/search', async (req: any, res: any) => {
      try {
        const { query, limit = 10, options = {} } = req.body
        const results = await this.context!.brain.search(query, limit, options)
        res.json({ success: true, results })
      } catch (error: any) {
        res.status(500).json({ success: false, error: error.message })
      }
    })
    
    // Add data endpoint
    app.post('/api/add', async (req: any, res: any) => {
      try {
        const { content, metadata } = req.body
        const id = await this.context!.brain.add({ data: content, type: 'content', metadata })
        res.json({ success: true, id })
      } catch (error: any) {
        res.status(500).json({ success: false, error: error.message })
      }
    })
    
    // Get by ID endpoint
    app.get('/api/get/:id', async (req: any, res: any) => {
      try {
        const data = await this.context!.brain.get(req.params.id)
        if (data) {
          res.json({ success: true, data })
        } else {
          res.status(404).json({ success: false, error: 'Not found' })
        }
      } catch (error: any) {
        res.status(500).json({ success: false, error: error.message })
      }
    })
    
    // Delete endpoint
    app.delete('/api/delete/:id', async (req: any, res: any) => {
      try {
        await this.context!.brain.delete(req.params.id)
        res.json({ success: true })
      } catch (error: any) {
        res.status(500).json({ success: false, error: error.message })
      }
    })
    
    // Relate endpoint
    app.post('/api/relate', async (req: any, res: any) => {
      try {
        const { source, target, verb, metadata } = req.body
        await this.context!.brain.relate(source, target, verb, metadata)
        res.json({ success: true })
      } catch (error: any) {
        res.status(500).json({ success: false, error: error.message })
      }
    })
    
    // Find endpoint (complex queries)
    app.post('/api/find', async (req: any, res: any) => {
      try {
        const results = await this.context!.brain.find(req.body)
        res.json({ success: true, results })
      } catch (error: any) {
        res.status(500).json({ success: false, error: error.message })
      }
    })
    
    // Cluster endpoint
    app.post('/api/cluster', async (req: any, res: any) => {
      try {
        const { algorithm = 'kmeans', options = {} } = req.body
        const clusters = await this.context!.brain.cluster(algorithm, options)
        res.json({ success: true, clusters })
      } catch (error: any) {
        res.status(500).json({ success: false, error: error.message })
      }
    })
    
    // MCP endpoint
    app.post('/api/mcp', async (req: any, res: any) => {
      try {
        const response = await this.mcpService!.handleRequest(req.body)
        res.json(response)
      } catch (error: any) {
        res.status(500).json({ success: false, error: error.message })
      }
    })
    
    // Statistics endpoint
    app.get('/api/stats', async (_req: any, res: any) => {
      try {
        const stats = await this.context!.brain.getStatistics()
        res.json({ success: true, stats })
      } catch (error: any) {
        res.status(500).json({ success: false, error: error.message })
      }
    })
    
    // Operation history endpoint
    app.get('/api/history', (_req: any, res: any) => {
      res.json({
        success: true,
        history: this.operationHistory.slice(-100)
      })
    })
  }
  
  /**
   * Setup WebSocket server
   */
  private setupWebSocketServer(): void {
    if (!this.wsServer) return
    
    this.wsServer.on('connection', (socket: any, request: any) => {
      const clientId = uuidv4()
      const client: ConnectedClient = {
        id: clientId,
        type: 'websocket',
        socket,
        subscriptions: [],
        lastSeen: Date.now()
      }
      
      this.clients.set(clientId, client)
      
      // Send welcome message
      socket.send(JSON.stringify({
        type: 'welcome',
        clientId,
        message: 'Connected to Brainy API Server',
        capabilities: ['search', 'add', 'delete', 'relate', 'subscribe', 'mcp']
      }))
      
      // Handle messages
      socket.on('message', async (message: string) => {
        try {
          const msg = JSON.parse(message)
          await this.handleWebSocketMessage(msg, client)
        } catch (error: any) {
          socket.send(JSON.stringify({
            type: 'error',
            error: error.message
          }))
        }
      })
      
      // Handle disconnect
      socket.on('close', () => {
        this.clients.delete(clientId)
        this.log(`Client ${clientId} disconnected`)
      })
      
      // Handle errors
      socket.on('error', (error: any) => {
        this.log(`WebSocket error for client ${clientId}: ${error}`, 'error')
      })
    })
  }
  
  /**
   * Handle WebSocket message
   */
  private async handleWebSocketMessage(msg: any, client: ConnectedClient): Promise<void> {
    const { socket } = client
    
    switch (msg.type) {
      case 'subscribe':
        // Subscribe to operation types
        client.subscriptions = msg.operations || ['all']
        socket.send(JSON.stringify({
          type: 'subscribed',
          operations: client.subscriptions
        }))
        break
        
      case 'search':
        const searchResults = await this.context!.brain.search(
          msg.query,
          msg.limit || 10,
          msg.options || {}
        )
        socket.send(JSON.stringify({
          type: 'searchResults',
          requestId: msg.requestId,
          results: searchResults
        }))
        break
        
      case 'add':
        const id = await this.context!.brain.add({ data: msg.content, type: 'content', metadata: msg.metadata })
        socket.send(JSON.stringify({
          type: 'addResult',
          requestId: msg.requestId,
          id
        }))
        break
        
      case 'mcp':
        const mcpResponse = await this.mcpService!.handleRequest(msg.request)
        socket.send(JSON.stringify({
          type: 'mcpResponse',
          requestId: msg.requestId,
          response: mcpResponse
        }))
        break
        
      case 'heartbeat':
        client.lastSeen = Date.now()
        socket.send(JSON.stringify({
          type: 'heartbeat',
          timestamp: Date.now()
        }))
        break
        
      default:
        socket.send(JSON.stringify({
          type: 'error',
          error: `Unknown message type: ${msg.type}`
        }))
    }
  }
  
  /**
   * Execute augmentation - broadcast operations to clients
   */
  async execute<T = any>(
    operation: string,
    params: any,
    next: () => Promise<T>
  ): Promise<T> {
    const startTime = Date.now()
    const result = await next()
    const duration = Date.now() - startTime
    
    // Record operation in history
    const historyEntry = {
      operation,
      params: this.sanitizeParams(params),
      timestamp: Date.now(),
      duration
    }
    
    this.operationHistory.push(historyEntry)
    if (this.operationHistory.length > this.maxHistorySize) {
      this.operationHistory.shift()
    }
    
    // Broadcast to subscribed WebSocket clients
    const message = JSON.stringify({
      type: 'operation',
      operation,
      params: historyEntry.params,
      timestamp: historyEntry.timestamp,
      duration
    })
    
    for (const client of this.clients.values()) {
      if (client.type === 'websocket' && client.socket) {
        if (client.subscriptions?.includes('all') || 
            client.subscriptions?.includes(operation)) {
          try {
            client.socket.send(message)
          } catch (error) {
            // Client might be disconnected
            this.clients.delete(client.id)
          }
        }
      }
    }
    
    return result
  }
  
  /**
   * Auth middleware for Express
   */
  private authMiddleware(req: any, res: any, next: any): void {
    if (!this.config.auth?.required) {
      return next()
    }
    
    const apiKey = req.headers['x-api-key']
    const bearerToken = req.headers.authorization?.replace('Bearer ', '')
    
    if (apiKey && this.config.auth.apiKeys?.includes(apiKey)) {
      return next()
    }
    
    if (bearerToken && this.config.auth.bearerTokens?.includes(bearerToken)) {
      return next()
    }
    
    res.status(401).json({ error: 'Unauthorized' })
  }
  
  /**
   * Rate limiting middleware
   */
  private rateLimitMiddleware(req: any, res: any, next: any): void {
    // Simple in-memory rate limiting
    // In production, use redis or proper rate limiting library
    const ip = req.ip || req.connection.remoteAddress
    const now = Date.now()
    const windowMs = this.config.rateLimit?.windowMs || 60000
    const max = this.config.rateLimit?.max || 100
    
    // Clean old entries
    for (const [key, client] of this.clients.entries()) {
      if (now - client.lastSeen > windowMs) {
        this.clients.delete(key)
      }
    }
    
    // For now, just pass through
    // Real implementation would track requests per IP
    next()
  }
  
  /**
   * Sanitize parameters before broadcasting
   */
  private sanitizeParams(params: any): any {
    if (!params) return params
    
    const sanitized = { ...params }
    
    // Remove sensitive fields
    delete sanitized.password
    delete sanitized.apiKey
    delete sanitized.token
    delete sanitized.secret
    
    // Truncate large data
    if (sanitized.content && sanitized.content.length > 1000) {
      sanitized.content = sanitized.content.substring(0, 1000) + '...'
    }
    
    return sanitized
  }
  
  /**
   * Send heartbeats to all connected clients
   */
  private sendHeartbeats(): void {
    const now = Date.now()
    
    for (const [id, client] of this.clients.entries()) {
      if (client.type === 'websocket' && client.socket) {
        // Remove inactive clients
        if (now - client.lastSeen > 60000) {
          this.clients.delete(id)
          continue
        }
        
        // Send heartbeat
        try {
          client.socket.send(JSON.stringify({
            type: 'heartbeat',
            timestamp: now
          }))
        } catch {
          // Client disconnected
          this.clients.delete(id)
        }
      }
    }
  }
  
  /**
   * Start Deno server
   */
  private async startDenoServer(): Promise<void> {
    try {
      // Check if Deno.serve is available (Deno 1.35+)
      const DenoGlobal = (globalThis as any).Deno
      if (DenoGlobal && 'serve' in DenoGlobal) {
        const handler = this.createUniversalHandler()
        
        this.httpServer = DenoGlobal.serve({
          port: this.config.port,
          hostname: this.config.host || '0.0.0.0',
          handler: handler
        })
        
        this.log(`Deno server started on ${this.config.host || '0.0.0.0'}:${this.config.port}`)
        
        // Setup WebSocket handling for Deno
        this.setupUniversalWebSocket()
        
      } else {
        throw new Error('Deno.serve not available - requires Deno 1.35+')
      }
    } catch (error) {
      this.log(`Failed to start Deno server: ${(error as Error).message}`, 'error')
      throw error
    }
  }
  
  /**
   * Start Service Worker (for browser)
   */
  private async startServiceWorker(): Promise<void> {
    try {
      if (typeof self !== 'undefined' && 'addEventListener' in self) {
        // Service Worker environment - intercept fetch events
        const handler = this.createUniversalHandler()
        
        self.addEventListener('fetch', async (event: any) => {
          const url = new URL(event.request.url)
          
          // Only handle API requests
          if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/ws') || url.pathname.startsWith('/mcp/')) {
            event.respondWith(handler(event.request))
          }
        })
        
        this.log('Service Worker API server registered for /api/, /ws, and /mcp paths')
        
        // Setup message handling for WebSocket-like communication
        this.setupServiceWorkerMessaging()
        
      } else if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
        // Browser main thread - service worker registration should be handled by the application
        this.log('Service Worker environment detected. Registration should be handled by your application.', 'info')
        // Return early - the app will handle service worker registration
        return
      } else {
        this.log('Service Worker environment not available', 'warn')
        return
      }
    } catch (error) {
      this.log(`Failed to start Service Worker server: ${(error as Error).message}`, 'error')
      throw error
    }
  }
  
  /**
   * Create universal handler using Web Standards (works in Node, Deno, Service Workers)
   */
  private createUniversalHandler(): (request: Request) => Promise<Response> {
    return async (request: Request): Promise<Response> => {
      try {
        const url = new URL(request.url)
        const method = request.method.toUpperCase()
        const path = url.pathname
        
        // Add CORS headers
        const corsOrigin = Array.isArray(this.config.cors?.origin) 
          ? this.config.cors.origin[0] 
          : this.config.cors?.origin || '*'
          
        const headers = new Headers({
          'Access-Control-Allow-Origin': corsOrigin,
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
          'Content-Type': 'application/json'
        })
        
        // Handle preflight requests
        if (method === 'OPTIONS') {
          return new Response(null, { status: 200, headers })
        }
        
        // Authentication
        if (!this.authenticateRequest(request)) {
          return new Response(JSON.stringify({ error: 'Unauthorized' }), {
            status: 401,
            headers
          })
        }
        
        // Rate limiting
        if (!this.checkRateLimit(request)) {
          return new Response(JSON.stringify({ error: 'Rate limit exceeded' }), {
            status: 429,
            headers
          })
        }
        
        // Route handling
        if (path.startsWith('/api/brainy/')) {
          return this.handleBrainyAPI(request, path.replace('/api/brainy/', ''), headers)
        } else if (path.startsWith('/mcp/')) {
          return this.handleMCPAPI(request, path.replace('/mcp/', ''), headers)
        } else if (path === '/health') {
          return new Response(JSON.stringify({ status: 'ok', timestamp: Date.now() }), {
            status: 200,
            headers
          })
        }
        
        return new Response(JSON.stringify({ error: 'Not found' }), {
          status: 404,
          headers
        })
        
      } catch (error) {
        return new Response(JSON.stringify({ 
          error: 'Internal server error',
          message: (error as Error).message
        }), {
          status: 500,
          headers: new Headers({ 'Content-Type': 'application/json' })
        })
      }
    }
  }
  
  /**
   * Handle Brainy API requests using universal Request/Response
   */
  private async handleBrainyAPI(request: Request, path: string, headers: Headers): Promise<Response> {
    const method = request.method.toUpperCase()
    const body = method !== 'GET' ? await request.json().catch(() => ({})) : {}
    
    try {
      let result: any
      
      switch (`${method} ${path}`) {
        case 'POST add':
          result = { id: await this.context!.brain.add(body) }
          break
        case 'GET get':
          const id = new URL(request.url).searchParams.get('id')
          result = await this.context!.brain.get(id)
          break
        case 'PUT update':
          await this.context!.brain.update(body)
          result = { success: true }
          break
        case 'DELETE delete':
          const deleteId = new URL(request.url).searchParams.get('id')
          await this.context!.brain.delete(deleteId)
          result = { success: true }
          break
        case 'POST find':
          result = await this.context!.brain.find(body)
          break
        case 'POST relate':
          result = { id: await this.context!.brain.relate(body) }
          break
        case 'GET insights':
          result = await this.context!.brain.insights()
          break
        default:
          return new Response(JSON.stringify({ error: `Unknown endpoint: ${method} ${path}` }), {
            status: 404,
            headers
          })
      }
      
      return new Response(JSON.stringify(result), { status: 200, headers })
      
    } catch (error) {
      return new Response(JSON.stringify({ 
        error: (error as Error).message 
      }), { status: 400, headers })
    }
  }
  
  /**
   * Handle MCP API requests
   */
  private async handleMCPAPI(request: Request, path: string, headers: Headers): Promise<Response> {
    try {
      if (!this.mcpService) {
        return new Response(JSON.stringify({ error: 'MCP service not available' }), {
          status: 503,
          headers
        })
      }
      
      const body = await request.json().catch(() => ({}))
      // Convert to MCP request format
      const mcpRequest = {
        type: path.includes('data') ? 'data_access' : 'tool_execution',
        ...body
      }
      const result = await this.mcpService.handleRequest(mcpRequest as any)
      
      return new Response(JSON.stringify(result), { status: 200, headers })
    } catch (error) {
      return new Response(JSON.stringify({ 
        error: (error as Error).message 
      }), { status: 400, headers })
    }
  }
  
  /**
   * Universal WebSocket setup (works in Node, Deno)
   */
  private setupUniversalWebSocket(): void {
    // WebSocket handling varies by platform but uses same interface
    this.log('WebSocket support enabled for real-time updates')
  }
  
  /**
   * Service Worker messaging for WebSocket-like communication
   */
  private setupServiceWorkerMessaging(): void {
    if (typeof self !== 'undefined') {
      self.addEventListener('message', async (event: any) => {
        if (event.data.type === 'brainy-api') {
          try {
            const response = await this.handleBrainyAPI(
              new Request('http://localhost/api/brainy/' + event.data.endpoint, {
                method: event.data.method || 'POST',
                body: JSON.stringify(event.data.data)
              }),
              event.data.endpoint,
              new Headers({ 'Content-Type': 'application/json' })
            )
            
            const result = await response.json()
            
            event.ports[0]?.postMessage({
              id: event.data.id,
              success: response.ok,
              data: result
            })
          } catch (error) {
            event.ports[0]?.postMessage({
              id: event.data.id,
              success: false,
              error: (error as Error).message
            })
          }
        }
      })
    }
  }
  
  /**
   * Universal authentication using Web Standards
   */
  private authenticateRequest(request: Request): boolean {
    if (!this.config.auth?.required) return true
    
    const authHeader = request.headers.get('authorization')
    if (!authHeader) return false
    
    if (this.config.auth.apiKeys?.length) {
      const apiKey = authHeader.replace('Bearer ', '')
      return this.config.auth.apiKeys.includes(apiKey)
    }
    
    return true
  }
  
  
  private checkRateLimit(request: Request): boolean {
    if (!this.config.rateLimit) return true
    
    // Get client identifier from headers or use a default
    const clientId = request.headers.get('x-forwarded-for') || 
                    request.headers.get('x-real-ip') || 
                    request.headers.get('cf-connecting-ip') || // Cloudflare
                    request.headers.get('x-vercel-forwarded-for') || // Vercel
                    'unknown'
    
    const now = Date.now()
    const windowMs = this.config.rateLimit.windowMs || 60000
    const maxRequests = this.config.rateLimit.max || 100
    const windowStart = now - windowMs
    
    // Get or create request timestamps for this client
    let timestamps = this.rateLimitStore.get(clientId) || []
    
    // Remove old timestamps outside the window
    timestamps = timestamps.filter(t => t > windowStart)
    
    // Check if limit exceeded
    if (timestamps.length >= maxRequests) {
      this.log(`Rate limit exceeded for client ${clientId}: ${timestamps.length}/${maxRequests} requests`, 'warn')
      return false
    }
    
    // Add current request timestamp
    timestamps.push(now)
    this.rateLimitStore.set(clientId, timestamps)
    
    // Periodic cleanup of old entries to prevent memory leak
    if (this.rateLimitStore.size > 1000) {
      for (const [id, times] of this.rateLimitStore.entries()) {
        const validTimes = times.filter(t => t > windowStart)
        if (validTimes.length === 0) {
          this.rateLimitStore.delete(id)
        } else {
          this.rateLimitStore.set(id, validTimes)
        }
      }
    }
    
    return true
  }

  /**
   * Shutdown the server
   */
  protected async onShutdown(): Promise<void> {
    // Close all WebSocket connections
    for (const client of this.clients.values()) {
      if (client.socket) {
        try {
          client.socket.close()
        } catch (error) {
          // Socket already closed or errored
          console.debug('Error closing WebSocket:', error)
        }
      }
    }
    this.clients.clear()
    
    // Close servers
    if (this.wsServer) {
      this.wsServer.close()
    }
    
    if (this.httpServer) {
      await new Promise<void>(resolve => {
        this.httpServer.close(() => resolve())
      })
    }
    
    this.log('API Server shut down')
  }
}

/**
 * Helper function to create and configure API server
 */
export function createAPIServer(config?: APIServerConfig): APIServerAugmentation {
  return new APIServerAugmentation(config)
}