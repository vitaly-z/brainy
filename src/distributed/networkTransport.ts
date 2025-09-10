/**
 * Network Transport Layer for Distributed Brainy
 * Uses WebSocket + HTTP for maximum compatibility
 */

import * as http from 'http'
import { EventEmitter } from 'events'
import { WebSocket } from 'ws'

// Use dynamic imports for Node.js specific modules
let WebSocketServer: any

// Default ports
const HTTP_PORT = process.env.BRAINY_HTTP_PORT || 7947
const WS_PORT = process.env.BRAINY_WS_PORT || 7948

export interface NetworkMessage {
  type: string
  from: string
  to?: string
  data: any
  timestamp: number
  id: string
}

export interface NodeEndpoint {
  nodeId: string
  host: string
  httpPort: number
  wsPort: number
  lastSeen: number
}

export interface NetworkConfig {
  nodeId?: string
  host?: string
  httpPort?: number
  wsPort?: number
  seeds?: string[]  // Known node addresses for bootstrap
  discoveryMethod?: 'seeds' | 'dns' | 'kubernetes' | 'auto'
  enableUDP?: boolean  // Optional UDP discovery for LAN
}

/**
 * Production-ready network transport
 */
export class NetworkTransport extends EventEmitter {
  private nodeId: string
  private config: NetworkConfig
  private httpServer?: http.Server
  private wsServer: any
  private peers: Map<string, NodeEndpoint> = new Map()
  private connections: Map<string, WebSocket> = new Map()
  private messageHandlers: Map<string, (msg: NetworkMessage) => Promise<any>> = new Map()
  private responseHandlers: Map<string, (response: any) => void> = new Map()
  private isRunning = false

  constructor(config: NetworkConfig) {
    super()
    this.nodeId = config.nodeId || this.generateNodeId()
    this.config = {
      host: '0.0.0.0',
      httpPort: Number(HTTP_PORT),
      wsPort: Number(WS_PORT),
      discoveryMethod: 'auto',
      enableUDP: false,  // Disabled by default for cloud compatibility
      ...config
    }
  }

  /**
   * Start network transport
   */
  async start(): Promise<void> {
    if (this.isRunning) return
    
    // Dynamic import for Node.js environment
    if (typeof window === 'undefined') {
      const ws = await import('ws')
      WebSocketServer = (ws as any).WebSocketServer || (ws as any).Server || ws.default
    }
    
    await this.startHTTPServer()
    await this.startWebSocketServer()
    await this.discoverPeers()
    
    this.isRunning = true
    this.emit('started', { nodeId: this.nodeId })
    
    // Start heartbeat
    this.startHeartbeat()
  }

  /**
   * Stop network transport
   */
  async stop(): Promise<void> {
    if (!this.isRunning) return
    
    this.isRunning = false
    
    // Close all connections
    for (const ws of this.connections.values()) {
      ws.close()
    }
    this.connections.clear()
    
    // Stop servers
    if (this.httpServer) {
      await new Promise<void>((resolve) => {
        this.httpServer!.close(() => resolve())
      })
    }
    
    if (this.wsServer) {
      await new Promise<void>((resolve) => {
        this.wsServer.close(() => resolve())
      })
    }
    
    this.emit('stopped')
  }

  /**
   * Start HTTP server for REST API and health checks
   */
  private async startHTTPServer(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.httpServer = http.createServer(async (req, res) => {
        // Enable CORS
        res.setHeader('Access-Control-Allow-Origin', '*')
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
        
        if (req.method === 'OPTIONS') {
          res.writeHead(200)
          res.end()
          return
        }
        
        if (req.url === '/health') {
          // Health check endpoint
          res.writeHead(200, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({
            status: 'healthy',
            nodeId: this.nodeId,
            peers: Array.from(this.peers.keys()),
            connections: Array.from(this.connections.keys())
          }))
          return
        }
        
        if (req.url === '/peers') {
          // Peer discovery endpoint
          res.writeHead(200, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({
            nodeId: this.nodeId,
            endpoint: {
              host: this.config.host,
              httpPort: this.config.httpPort,
              wsPort: this.config.wsPort
            },
            peers: Array.from(this.peers.values())
          }))
          return
        }
        
        if (req.method === 'POST' && req.url === '/message') {
          // Message handling endpoint
          let body = ''
          
          req.on('data', (chunk) => {
            body += chunk.toString()
          })
          
          req.on('end', async () => {
            try {
              const message: NetworkMessage = JSON.parse(body)
              
              // Handle message
              const handler = this.messageHandlers.get(message.type)
              if (handler) {
                const response = await handler(message)
                res.writeHead(200, { 'Content-Type': 'application/json' })
                res.end(JSON.stringify({ success: true, data: response }))
              } else {
                res.writeHead(404)
                res.end(JSON.stringify({ success: false, error: 'Unknown message type' }))
              }
            } catch (err: any) {
              res.writeHead(500)
              res.end(JSON.stringify({ success: false, error: err.message }))
            }
          })
        } else {
          res.writeHead(404)
          res.end(JSON.stringify({ error: 'Not found' }))
        }
      })
      
      this.httpServer.listen(this.config.httpPort, '0.0.0.0', () => {
        console.log(`[Network] HTTP server listening on :${this.config.httpPort}`)
        resolve()
      })
      
      this.httpServer.on('error', reject)
    })
  }

  /**
   * Start WebSocket server for real-time communication
   */
  private async startWebSocketServer(): Promise<void> {
    if (!WebSocketServer) {
      console.warn('[Network] WebSocket not available in this environment')
      return
    }
    
    this.wsServer = new WebSocketServer({ port: this.config.wsPort })
    
    this.wsServer.on('connection', (ws: WebSocket) => {
      let peerId: string | null = null
      
      ws.on('message', async (data: Buffer | string) => {
        try {
          const message: NetworkMessage = JSON.parse(data.toString())
          
          // Handle handshake
          if (message.type === 'HANDSHAKE') {
            peerId = message.from
            this.connections.set(peerId, ws)
            
            // Add to peers
            const endpoint: NodeEndpoint = {
              nodeId: peerId,
              host: message.data.host || 'unknown',
              httpPort: message.data.httpPort || 0,
              wsPort: message.data.wsPort || 0,
              lastSeen: Date.now()
            }
            this.peers.set(peerId, endpoint)
            
            // Send handshake response
            ws.send(JSON.stringify({
              type: 'HANDSHAKE_ACK',
              from: this.nodeId,
              to: peerId,
              data: {
                nodeId: this.nodeId,
                host: this.config.host,
                httpPort: this.config.httpPort,
                wsPort: this.config.wsPort
              },
              timestamp: Date.now(),
              id: this.generateMessageId()
            }))
            
            this.emit('peerConnected', peerId)
            return
          }
          
          // Handle response messages
          if (message.type.endsWith('_RESPONSE')) {
            const handler = this.responseHandlers.get(message.id)
            if (handler) {
              handler(message.data)
              this.responseHandlers.delete(message.id)
            }
            return
          }
          
          // Handle regular messages
          const handler = this.messageHandlers.get(message.type)
          if (handler) {
            const response = await handler(message)
            if (response !== undefined) {
              ws.send(JSON.stringify({
                type: `${message.type}_RESPONSE`,
                from: this.nodeId,
                to: message.from,
                data: response,
                timestamp: Date.now(),
                id: message.id
              }))
            }
          }
        } catch (err) {
          console.error('[Network] WebSocket message error:', err)
        }
      })
      
      ws.on('close', () => {
        if (peerId) {
          this.connections.delete(peerId)
          this.emit('peerDisconnected', peerId)
        }
      })
      
      ws.on('error', (err: Error) => {
        console.error(`[Network] WebSocket error:`, err.message)
      })
    })
    
    console.log(`[Network] WebSocket server listening on :${this.config.wsPort}`)
  }

  /**
   * Discover peers based on configuration
   */
  private async discoverPeers(): Promise<void> {
    const method = this.config.discoveryMethod
    
    if (method === 'seeds' || (method === 'auto' && this.config.seeds)) {
      // Use seed nodes
      await this.connectToSeeds()
    } else if (method === 'dns' || (method === 'auto' && process.env.BRAINY_DNS)) {
      // Use DNS discovery
      await this.discoverViaDNS()
    } else if (method === 'kubernetes' || (method === 'auto' && process.env.KUBERNETES_SERVICE_HOST)) {
      // Use Kubernetes service discovery
      await this.discoverViaKubernetes()
    }
    
    // Fallback: try localhost for development
    if (this.peers.size === 0 && process.env.NODE_ENV !== 'production') {
      await this.connectToNode('localhost', this.config.httpPort!)
    }
  }

  /**
   * Connect to seed nodes
   */
  private async connectToSeeds(): Promise<void> {
    if (!this.config.seeds) return
    
    for (const seed of this.config.seeds) {
      try {
        // Parse seed address (host:port or just host)
        const [host, port] = seed.split(':')
        await this.connectToNode(host, Number(port) || this.config.httpPort!)
      } catch (err) {
        console.error(`[Network] Failed to connect to seed ${seed}:`, err)
      }
    }
  }

  /**
   * Discover peers via DNS
   */
  private async discoverViaDNS(): Promise<void> {
    const dnsName = process.env.BRAINY_DNS || 'brainy-cluster.local'
    
    try {
      const dns = await import('dns')
      const addresses = await new Promise<string[]>((resolve, reject) => {
        dns.resolve4(dnsName, (err, addresses) => {
          if (err) reject(err)
          else resolve(addresses || [])
        })
      })
      
      for (const address of addresses) {
        await this.connectToNode(address, this.config.httpPort!)
      }
    } catch (err) {
      console.log(`[Network] DNS discovery failed for ${dnsName}:`, err)
    }
  }

  /**
   * Discover peers via Kubernetes
   */
  private async discoverViaKubernetes(): Promise<void> {
    const serviceName = process.env.BRAINY_SERVICE || 'brainy'
    const namespace = process.env.BRAINY_NAMESPACE || 'default'
    const apiServer = 'https://kubernetes.default.svc'
    const token = process.env.KUBERNETES_TOKEN || ''
    
    try {
      // Query Kubernetes API for pod endpoints
      const https = await import('https')
      const response = await new Promise<any>((resolve, reject) => {
        https.get(
          `${apiServer}/api/v1/namespaces/${namespace}/endpoints/${serviceName}`,
          {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          },
          (res) => {
            let data = ''
            res.on('data', (chunk) => data += chunk)
            res.on('end', () => resolve(JSON.parse(data)))
          }
        ).on('error', reject)
      })
      
      // Connect to each pod
      if (response.subsets) {
        for (const subset of response.subsets) {
          for (const address of subset.addresses || []) {
            await this.connectToNode(address.ip, this.config.httpPort!)
          }
        }
      }
    } catch (err) {
      console.log('[Network] Kubernetes discovery failed:', err)
    }
  }

  /**
   * Connect to a specific node
   */
  private async connectToNode(host: string, httpPort: number): Promise<void> {
    try {
      // First, get node info via HTTP
      const nodeInfo = await this.getNodeInfo(host, httpPort)
      
      if (nodeInfo.nodeId === this.nodeId) {
        return // Don't connect to self
      }
      
      // Add to peers
      const endpoint: NodeEndpoint = {
        nodeId: nodeInfo.nodeId,
        host,
        httpPort,
        wsPort: nodeInfo.endpoint.wsPort,
        lastSeen: Date.now()
      }
      this.peers.set(nodeInfo.nodeId, endpoint)
      
      // Connect via WebSocket
      await this.connectWebSocket(endpoint)
      
      // Get their peer list
      for (const peer of nodeInfo.peers || []) {
        if (!this.peers.has(peer.nodeId) && peer.nodeId !== this.nodeId) {
          this.peers.set(peer.nodeId, peer)
          // Optionally connect to them too
          if (this.peers.size < 10) {  // Limit connections
            await this.connectWebSocket(peer)
          }
        }
      }
    } catch (err) {
      // Node might be down or not ready
      console.debug(`[Network] Could not connect to ${host}:${httpPort}`)
    }
  }

  /**
   * Get node information via HTTP
   */
  private async getNodeInfo(host: string, port: number): Promise<any> {
    return new Promise((resolve, reject) => {
      const req = http.get(`http://${host}:${port}/peers`, (res) => {
        let data = ''
        res.on('data', (chunk) => data += chunk)
        res.on('end', () => {
          try {
            resolve(JSON.parse(data))
          } catch (err) {
            reject(err)
          }
        })
      })
      
      req.on('error', reject)
      req.setTimeout(2000, () => {
        req.destroy()
        reject(new Error('Timeout'))
      })
    })
  }

  /**
   * Connect to peer via WebSocket
   */
  private async connectWebSocket(endpoint: NodeEndpoint): Promise<void> {
    if (this.connections.has(endpoint.nodeId)) return
    
    try {
      const ws = new WebSocket(`ws://${endpoint.host}:${endpoint.wsPort}`)
      
      ws.on('open', () => {
        // Send handshake
        ws.send(JSON.stringify({
          type: 'HANDSHAKE',
          from: this.nodeId,
          data: {
            nodeId: this.nodeId,
            host: this.config.host,
            httpPort: this.config.httpPort,
            wsPort: this.config.wsPort
          },
          timestamp: Date.now(),
          id: this.generateMessageId()
        }))
        
        this.connections.set(endpoint.nodeId, ws)
      })
      
      ws.on('message', async (data: Buffer | string) => {
        try {
          const message: NetworkMessage = JSON.parse(data.toString())
          
          // Handle responses
          if (message.type.endsWith('_RESPONSE')) {
            const handler = this.responseHandlers.get(message.id)
            if (handler) {
              handler(message.data)
              this.responseHandlers.delete(message.id)
            }
            return
          }
          
          // Handle messages
          const handler = this.messageHandlers.get(message.type)
          if (handler) {
            await handler(message)
          }
        } catch (err) {
          console.error('[Network] Message handling error:', err)
        }
      })
      
      ws.on('close', () => {
        this.connections.delete(endpoint.nodeId)
      })
      
      ws.on('error', (err: Error) => {
        console.debug(`[Network] WebSocket error with ${endpoint.nodeId}:`, err.message)
      })
    } catch (err) {
      console.debug(`[Network] Failed to connect to ${endpoint.nodeId}`)
    }
  }

  /**
   * Start heartbeat to maintain connections
   */
  private startHeartbeat(): void {
    setInterval(() => {
      if (!this.isRunning) return
      
      // Send heartbeat to all connected peers
      for (const [nodeId, ws] of this.connections.entries()) {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({
            type: 'HEARTBEAT',
            from: this.nodeId,
            to: nodeId,
            timestamp: Date.now(),
            id: this.generateMessageId()
          }))
        } else {
          // Connection lost, remove it
          this.connections.delete(nodeId)
        }
      }
      
      // Clean up stale peers
      const now = Date.now()
      for (const [nodeId, peer] of this.peers.entries()) {
        if (now - peer.lastSeen > 60000) {  // 60 seconds
          this.peers.delete(nodeId)
        }
      }
    }, 10000)  // Every 10 seconds
  }

  /**
   * Send message to specific node
   */
  async sendToNode(nodeId: string, type: string, data: any): Promise<any> {
    const ws = this.connections.get(nodeId)
    
    if (ws && ws.readyState === WebSocket.OPEN) {
      // Use WebSocket
      return new Promise((resolve, reject) => {
        const messageId = this.generateMessageId()
        
        const timeout = setTimeout(() => {
          this.responseHandlers.delete(messageId)
          reject(new Error(`Timeout waiting for response from ${nodeId}`))
        }, 5000)
        
        this.responseHandlers.set(messageId, (response) => {
          clearTimeout(timeout)
          resolve(response)
        })
        
        ws.send(JSON.stringify({
          type,
          from: this.nodeId,
          to: nodeId,
          data,
          timestamp: Date.now(),
          id: messageId
        }))
      })
    } else {
      // Use HTTP fallback
      const endpoint = this.peers.get(nodeId)
      if (!endpoint) {
        throw new Error(`Unknown node: ${nodeId}`)
      }
      
      return this.sendViaHTTP(endpoint, type, data)
    }
  }

  /**
   * Send via HTTP
   */
  private async sendViaHTTP(endpoint: NodeEndpoint, type: string, data: any): Promise<any> {
    return new Promise((resolve, reject) => {
      const message: NetworkMessage = {
        type,
        from: this.nodeId,
        to: endpoint.nodeId,
        data,
        timestamp: Date.now(),
        id: this.generateMessageId()
      }
      
      const postData = JSON.stringify(message)
      
      const req = http.request({
        hostname: endpoint.host,
        port: endpoint.httpPort,
        path: '/message',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData)
        }
      }, (res) => {
        let responseData = ''
        
        res.on('data', (chunk) => {
          responseData += chunk
        })
        
        res.on('end', () => {
          try {
            const response = JSON.parse(responseData)
            if (response.success) {
              resolve(response.data)
            } else {
              reject(new Error(response.error))
            }
          } catch (err) {
            reject(err)
          }
        })
      })
      
      req.on('error', reject)
      req.setTimeout(5000, () => {
        req.destroy()
        reject(new Error('HTTP timeout'))
      })
      
      req.write(postData)
      req.end()
    })
  }

  /**
   * Broadcast to all peers
   */
  async broadcast(type: string, data: any): Promise<void> {
    const promises = []
    
    for (const nodeId of this.peers.keys()) {
      promises.push(
        this.sendToNode(nodeId, type, data).catch(() => {
          // Ignore broadcast failures
        })
      )
    }
    
    await Promise.all(promises)
  }

  /**
   * Register message handler
   */
  onMessage(type: string, handler: (msg: NetworkMessage) => Promise<any>): void {
    this.messageHandlers.set(type, handler)
  }

  /**
   * Get connected peers
   */
  getPeers(): NodeEndpoint[] {
    return Array.from(this.peers.values())
  }

  /**
   * Check if connected
   */
  isConnected(nodeId: string): boolean {
    const ws = this.connections.get(nodeId)
    return ws !== undefined && ws.readyState === WebSocket.OPEN
  }

  /**
   * Generate node ID
   */
  private generateNodeId(): string {
    return `node-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`
  }

  /**
   * Generate message ID
   */
  private generateMessageId(): string {
    return `${this.nodeId}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
  }

  /**
   * Get node ID
   */
  getNodeId(): string {
    return this.nodeId
  }
}

/**
 * Create network transport
 */
export function createNetworkTransport(config: NetworkConfig): NetworkTransport {
  return new NetworkTransport(config)
}