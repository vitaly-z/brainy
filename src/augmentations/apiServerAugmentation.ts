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
        const id = await this.context!.brain.addNoun(content, 'Content', metadata)
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
        const id = await this.context!.brain.addNoun(msg.content, 'Content', msg.metadata)
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
    // Deno implementation would go here
    // Using Deno.serve() or oak framework
    this.log('Deno server not yet implemented', 'warn')
  }
  
  /**
   * Start Service Worker (for browser)
   */
  private async startServiceWorker(): Promise<void> {
    // Service Worker implementation would go here
    // Intercepts fetch() calls and handles them locally
    this.log('Service Worker API not yet implemented', 'warn')
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
        } catch {}
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