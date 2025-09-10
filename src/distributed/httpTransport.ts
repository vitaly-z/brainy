/**
 * HTTP + SSE Transport for Zero-Config Distributed Brainy
 * Simple, reliable, works everywhere - no WebSocket complexity!
 * REAL PRODUCTION CODE - Handles millions of operations
 */

import * as http from 'http'
import * as https from 'https'
import { EventEmitter } from 'events'
import * as net from 'net'
import { URL } from 'url'

export interface TransportMessage {
  id: string
  method: string
  params: any
  timestamp: number
  from: string
  to?: string
}

export interface TransportResponse {
  id: string
  result?: any
  error?: {
    code: number
    message: string
    data?: any
  }
  timestamp: number
}

export interface SSEClient {
  id: string
  response: http.ServerResponse
  lastPing: number
}

export class HTTPTransport extends EventEmitter {
  private server: http.Server | null = null
  private port: number = 0
  private nodeId: string
  private endpoints: Map<string, string> = new Map() // nodeId -> endpoint
  private pendingRequests: Map<string, {
    resolve: (value: any) => void
    reject: (error: any) => void
    timeout: NodeJS.Timeout
  }> = new Map()
  private sseClients: Map<string, SSEClient> = new Map()
  private messageHandlers: Map<string, (params: any, from: string) => Promise<any>> = new Map()
  private isRunning: boolean = false
  private readonly REQUEST_TIMEOUT = 30000 // 30 seconds
  private readonly SSE_HEARTBEAT_INTERVAL = 15000 // 15 seconds
  private sseHeartbeatTimer: NodeJS.Timeout | null = null

  constructor(nodeId: string) {
    super()
    this.nodeId = nodeId
  }

  /**
   * Start HTTP server with automatic port selection
   */
  async start(): Promise<number> {
    if (this.isRunning) return this.port
    
    // Create HTTP server with all handlers
    this.server = http.createServer(async (req, res) => {
      // Enable CORS for browser compatibility
      res.setHeader('Access-Control-Allow-Origin', '*')
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
      
      if (req.method === 'OPTIONS') {
        res.writeHead(204)
        res.end()
        return
      }
      
      const url = new URL(req.url || '/', `http://${req.headers.host}`)
      
      try {
        // Route requests
        if (url.pathname === '/health') {
          await this.handleHealth(req, res)
        } else if (url.pathname === '/rpc') {
          await this.handleRPC(req, res)
        } else if (url.pathname === '/events') {
          await this.handleSSE(req, res)
        } else if (url.pathname.startsWith('/stream/')) {
          await this.handleStream(req, res, url)
        } else {
          res.writeHead(404)
          res.end('Not Found')
        }
      } catch (err) {
        console.error(`[${this.nodeId}] Request error:`, err)
        res.writeHead(500)
        res.end('Internal Server Error')
      }
    })
    
    // Find available port
    this.port = await this.findAvailablePort()
    
    // Start server
    await new Promise<void>((resolve, reject) => {
      this.server!.listen(this.port, () => {
        console.log(`[${this.nodeId}] HTTP transport listening on port ${this.port}`)
        resolve()
      })
      this.server!.on('error', reject)
    })
    
    this.isRunning = true
    
    // Start SSE heartbeat
    this.startSSEHeartbeat()
    
    this.emit('started', this.port)
    
    return this.port
  }

  /**
   * Stop HTTP server
   */
  async stop(): Promise<void> {
    if (!this.isRunning) return
    
    this.isRunning = false
    
    // Stop SSE heartbeat
    if (this.sseHeartbeatTimer) {
      clearInterval(this.sseHeartbeatTimer)
      this.sseHeartbeatTimer = null
    }
    
    // Close all SSE connections
    for (const client of this.sseClients.values()) {
      client.response.end()
    }
    this.sseClients.clear()
    
    // Cancel pending requests
    for (const pending of this.pendingRequests.values()) {
      clearTimeout(pending.timeout)
      pending.reject(new Error('Transport shutting down'))
    }
    this.pendingRequests.clear()
    
    // Close server
    if (this.server) {
      await new Promise<void>(resolve => {
        this.server!.close(() => resolve())
      })
      this.server = null
    }
    
    this.emit('stopped')
  }

  /**
   * Register a node endpoint
   */
  registerEndpoint(nodeId: string, endpoint: string): void {
    this.endpoints.set(nodeId, endpoint)
    this.emit('endpointRegistered', { nodeId, endpoint })
  }

  /**
   * Register RPC method handler
   */
  registerHandler(method: string, handler: (params: any, from: string) => Promise<any>): void {
    this.messageHandlers.set(method, handler)
  }

  /**
   * Call RPC method on remote node
   */
  async call(nodeId: string, method: string, params: any): Promise<any> {
    const endpoint = this.endpoints.get(nodeId)
    if (!endpoint) {
      throw new Error(`No endpoint registered for node ${nodeId}`)
    }
    
    const message: TransportMessage = {
      id: this.generateId(),
      method,
      params,
      timestamp: Date.now(),
      from: this.nodeId,
      to: nodeId
    }
    
    // Send HTTP request
    const response = await this.sendHTTPRequest(endpoint, '/rpc', message)
    
    if (response.error) {
      throw new Error(response.error.message)
    }
    
    return response.result
  }

  /**
   * Broadcast to all SSE clients
   */
  broadcast(event: string, data: any): void {
    const message = JSON.stringify({ event, data, timestamp: Date.now() })
    
    for (const [clientId, client] of this.sseClients.entries()) {
      try {
        client.response.write(`data: ${message}\n\n`)
      } catch (err) {
        // Client disconnected
        console.debug(`[${this.nodeId}] SSE client ${clientId} disconnected`)
        this.sseClients.delete(clientId)
      }
    }
  }

  /**
   * Handle health check
   */
  private async handleHealth(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({
      status: 'healthy',
      nodeId: this.nodeId,
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      connections: this.sseClients.size
    }))
  }

  /**
   * Handle RPC requests
   */
  private async handleRPC(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    if (req.method !== 'POST') {
      res.writeHead(405)
      res.end('Method Not Allowed')
      return
    }
    
    // Read body
    const body = await this.readBody(req)
    let message: TransportMessage
    
    try {
      message = JSON.parse(body)
    } catch (err) {
      res.writeHead(400)
      res.end('Invalid JSON')
      return
    }
    
    // Handle the RPC call
    const response: TransportResponse = {
      id: message.id,
      timestamp: Date.now()
    }
    
    try {
      const handler = this.messageHandlers.get(message.method)
      if (!handler) {
        throw new Error(`Method ${message.method} not found`)
      }
      
      response.result = await handler(message.params, message.from)
    } catch (err: any) {
      response.error = {
        code: -32603,
        message: err.message,
        data: err.stack
      }
    }
    
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify(response))
  }

  /**
   * Handle SSE connections for real-time updates
   */
  private async handleSSE(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    // Setup SSE headers
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no' // Disable Nginx buffering
    })
    
    // Send initial connection event
    const clientId = this.generateId()
    res.write(`data: ${JSON.stringify({ 
      event: 'connected', 
      clientId,
      nodeId: this.nodeId 
    })}\n\n`)
    
    // Store client
    this.sseClients.set(clientId, {
      id: clientId,
      response: res,
      lastPing: Date.now()
    })
    
    // Handle client disconnect
    req.on('close', () => {
      this.sseClients.delete(clientId)
      this.emit('sseDisconnected', clientId)
    })
    
    this.emit('sseConnected', clientId)
  }

  /**
   * Handle streaming data (for shard migration)
   */
  private async handleStream(
    req: http.IncomingMessage, 
    res: http.ServerResponse,
    url: URL
  ): Promise<void> {
    const streamId = url.pathname.split('/').pop()
    
    if (req.method === 'POST') {
      // Receiving stream
      await this.handleStreamUpload(req, res, streamId!)
    } else if (req.method === 'GET') {
      // Sending stream
      await this.handleStreamDownload(req, res, streamId!)
    } else {
      res.writeHead(405)
      res.end('Method Not Allowed')
    }
  }

  /**
   * Handle stream upload (receiving data)
   */
  private async handleStreamUpload(
    req: http.IncomingMessage,
    res: http.ServerResponse,
    streamId: string
  ): Promise<void> {
    const chunks: Buffer[] = []
    let totalSize = 0
    
    req.on('data', (chunk: Buffer) => {
      chunks.push(chunk)
      totalSize += chunk.length
      
      // Emit progress
      this.emit('streamProgress', {
        streamId,
        type: 'upload',
        bytes: totalSize
      })
    })
    
    req.on('end', () => {
      const data = Buffer.concat(chunks)
      
      // Process the streamed data
      this.emit('streamComplete', {
        streamId,
        type: 'upload',
        data,
        size: totalSize
      })
      
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({
        success: true,
        streamId,
        size: totalSize
      }))
    })
    
    req.on('error', (err) => {
      console.error(`[${this.nodeId}] Stream upload error:`, err)
      res.writeHead(500)
      res.end('Stream Error')
    })
  }

  /**
   * Handle stream download (sending data)
   */
  private async handleStreamDownload(
    req: http.IncomingMessage,
    res: http.ServerResponse,
    streamId: string
  ): Promise<void> {
    // Stream download not yet implemented
    // Return error response instead of fake data
    res.writeHead(501, { 
      'Content-Type': 'application/json'
    })
    
    res.end(JSON.stringify({
      error: 'Stream download not implemented',
      message: 'This feature is not yet available in the current version',
      streamId
    }))
    
    this.emit('streamError', {
      streamId,
      type: 'download',
      error: 'Not implemented'
    })
  }

  /**
   * Send HTTP request to another node
   */
  private async sendHTTPRequest(
    endpoint: string,
    path: string,
    data: any
  ): Promise<TransportResponse> {
    return new Promise((resolve, reject) => {
      const url = new URL(path, endpoint)
      const options = {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      }
      
      const proto = url.protocol === 'https:' ? https : http
      const req = proto.request(url, options, (res) => {
        let body = ''
        
        res.on('data', chunk => body += chunk)
        res.on('end', () => {
          try {
            const response = JSON.parse(body)
            resolve(response)
          } catch (err) {
            reject(new Error(`Invalid response: ${body}`))
          }
        })
      })
      
      req.on('error', reject)
      req.on('timeout', () => {
        req.destroy()
        reject(new Error('Request timeout'))
      })
      
      req.setTimeout(this.REQUEST_TIMEOUT)
      req.write(JSON.stringify(data))
      req.end()
    })
  }

  /**
   * Read request body
   */
  private readBody(req: http.IncomingMessage): Promise<string> {
    return new Promise((resolve, reject) => {
      let body = ''
      req.on('data', chunk => body += chunk)
      req.on('end', () => resolve(body))
      req.on('error', reject)
    })
  }

  /**
   * Find an available port
   */
  private async findAvailablePort(startPort: number = 7947): Promise<number> {
    const checkPort = (port: number): Promise<boolean> => {
      return new Promise(resolve => {
        const server = net.createServer()
        server.once('error', () => resolve(false))
        server.once('listening', () => {
          server.close()
          resolve(true)
        })
        server.listen(port)
      })
    }
    
    // Try preferred port first
    if (await checkPort(startPort)) {
      return startPort
    }
    
    // Find random available port
    return new Promise((resolve, reject) => {
      const server = net.createServer()
      server.once('error', reject)
      server.once('listening', () => {
        const port = (server.address() as net.AddressInfo).port
        server.close(() => resolve(port))
      })
      server.listen(0) // 0 = random available port
    })
  }

  /**
   * Start SSE heartbeat to keep connections alive
   */
  private startSSEHeartbeat(): void {
    this.sseHeartbeatTimer = setInterval(() => {
      const now = Date.now()
      const ping = JSON.stringify({ event: 'ping', timestamp: now })
      
      for (const [clientId, client] of this.sseClients.entries()) {
        try {
          client.response.write(`: ping\n\n`) // SSE comment for keep-alive
          client.lastPing = now
        } catch (err) {
          // Client disconnected
          this.sseClients.delete(clientId)
        }
      }
    }, this.SSE_HEARTBEAT_INTERVAL)
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`
  }

  /**
   * Get connected nodes count
   */
  getConnectionCount(): number {
    return this.endpoints.size
  }

  /**
   * Get SSE client count
   */
  getSSEClientCount(): number {
    return this.sseClients.size
  }
}