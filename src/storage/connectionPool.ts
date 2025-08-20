/**
 * Connection Pool for Cloud Storage Clients
 * Dramatically improves throughput by allowing parallel operations
 */

import { S3Client } from '@aws-sdk/client-s3'

export interface PoolConfig {
  /**
   * Minimum number of connections to maintain
   * Default: 2
   */
  minConnections?: number
  
  /**
   * Maximum number of connections allowed
   * Default: 10
   */
  maxConnections?: number
  
  /**
   * Time to wait for a connection before timing out (ms)
   * Default: 30000 (30 seconds)
   */
  acquireTimeout?: number
  
  /**
   * How often to check connection health (ms)
   * Default: 60000 (1 minute)
   */
  healthCheckInterval?: number
  
  /**
   * Maximum idle time before closing a connection (ms)
   * Default: 300000 (5 minutes)
   */
  idleTimeout?: number
}

export interface PooledConnection<T> {
  client: T
  id: string
  createdAt: number
  lastUsed: number
  inUse: boolean
}

/**
 * Generic connection pool that can work with any client type
 */
export class ConnectionPool<T> {
  protected config: Required<PoolConfig>
  protected connections: Map<string, PooledConnection<T>> = new Map()
  protected available: string[] = []
  protected waiting: Array<{
    resolve: (client: T) => void
    reject: (error: Error) => void
    timeout: NodeJS.Timeout
  }> = []
  protected healthCheckTimer?: NodeJS.Timeout
  protected createConnection: () => T
  
  constructor(
    createConnection: () => T,
    config: PoolConfig = {}
  ) {
    this.createConnection = createConnection
    this.config = {
      minConnections: config.minConnections ?? 2,
      maxConnections: config.maxConnections ?? 10,
      acquireTimeout: config.acquireTimeout ?? 30000,
      healthCheckInterval: config.healthCheckInterval ?? 60000,
      idleTimeout: config.idleTimeout ?? 300000
    }
    
    // Initialize minimum connections
    this.initialize()
  }
  
  /**
   * Initialize the connection pool with minimum connections
   */
  private async initialize(): Promise<void> {
    for (let i = 0; i < this.config.minConnections; i++) {
      this.addConnection()
    }
    
    // Start health check timer
    if (this.config.healthCheckInterval > 0) {
      this.healthCheckTimer = setInterval(
        () => this.performHealthCheck(),
        this.config.healthCheckInterval
      )
    }
  }
  
  /**
   * Create and add a new connection to the pool
   */
  private addConnection(): string {
    const id = `conn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    const client = this.createConnection()
    
    const connection: PooledConnection<T> = {
      client,
      id,
      createdAt: Date.now(),
      lastUsed: Date.now(),
      inUse: false
    }
    
    this.connections.set(id, connection)
    this.available.push(id)
    
    return id
  }
  
  /**
   * Acquire a connection from the pool
   */
  async acquire(): Promise<T> {
    // Try to get an available connection
    if (this.available.length > 0) {
      const id = this.available.shift()!
      const connection = this.connections.get(id)!
      connection.inUse = true
      connection.lastUsed = Date.now()
      return connection.client
    }
    
    // Create new connection if under limit
    if (this.connections.size < this.config.maxConnections) {
      const id = this.addConnection()
      const connection = this.connections.get(id)!
      this.available.shift() // Remove from available since we're using it
      connection.inUse = true
      connection.lastUsed = Date.now()
      return connection.client
    }
    
    // Wait for a connection to become available
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        const index = this.waiting.findIndex(w => w.resolve === resolve)
        if (index !== -1) {
          this.waiting.splice(index, 1)
        }
        reject(new Error('Connection pool acquire timeout'))
      }, this.config.acquireTimeout)
      
      this.waiting.push({ resolve, reject, timeout })
    })
  }
  
  /**
   * Release a connection back to the pool
   */
  release(client: T): void {
    // Find the connection by client
    let connectionId: string | null = null
    for (const [id, conn] of this.connections.entries()) {
      if (conn.client === client) {
        connectionId = id
        break
      }
    }
    
    if (!connectionId) {
      console.warn('Attempted to release unknown connection')
      return
    }
    
    const connection = this.connections.get(connectionId)!
    connection.inUse = false
    connection.lastUsed = Date.now()
    
    // Give to waiting request if any
    if (this.waiting.length > 0) {
      const waiter = this.waiting.shift()!
      clearTimeout(waiter.timeout)
      connection.inUse = true
      connection.lastUsed = Date.now()
      waiter.resolve(connection.client)
    } else {
      // Add back to available pool
      this.available.push(connectionId)
    }
  }
  
  /**
   * Perform health check and cleanup idle connections
   */
  private performHealthCheck(): void {
    const now = Date.now()
    const toRemove: string[] = []
    
    for (const [id, conn] of this.connections.entries()) {
      // Skip connections in use
      if (conn.inUse) continue
      
      // Remove idle connections over the limit
      if (this.connections.size > this.config.minConnections) {
        if (now - conn.lastUsed > this.config.idleTimeout) {
          toRemove.push(id)
        }
      }
    }
    
    // Remove idle connections
    for (const id of toRemove) {
      this.connections.delete(id)
      const index = this.available.indexOf(id)
      if (index !== -1) {
        this.available.splice(index, 1)
      }
    }
    
    // Ensure minimum connections
    while (this.connections.size < this.config.minConnections) {
      this.addConnection()
    }
  }
  
  /**
   * Get pool statistics
   */
  getStats(): {
    total: number
    available: number
    inUse: number
    waiting: number
  } {
    return {
      total: this.connections.size,
      available: this.available.length,
      inUse: this.connections.size - this.available.length,
      waiting: this.waiting.length
    }
  }
  
  /**
   * Shutdown the pool and close all connections
   */
  async shutdown(): Promise<void> {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer)
    }
    
    // Reject all waiting requests
    for (const waiter of this.waiting) {
      clearTimeout(waiter.timeout)
      waiter.reject(new Error('Connection pool shutting down'))
    }
    this.waiting = []
    
    // Clear connections
    this.connections.clear()
    this.available = []
  }
}

/**
 * S3-specific connection pool with optimized settings
 */
export class S3ConnectionPool extends ConnectionPool<S3Client> {
  constructor(
    s3Config: any,
    poolConfig: PoolConfig = {}
  ) {
    // S3-optimized defaults
    const optimizedConfig: PoolConfig = {
      minConnections: 3,      // Keep 3 ready
      maxConnections: 20,     // S3 can handle many parallel
      acquireTimeout: 30000,
      healthCheckInterval: 60000,
      idleTimeout: 300000,
      ...poolConfig
    }
    
    super(
      () => new S3Client(s3Config),
      optimizedConfig
    )
  }
}

/**
 * Helper to use pool with async/await pattern
 */
export class PooledExecutor<T> {
  constructor(private pool: ConnectionPool<T>) {}
  
  /**
   * Execute a function with a pooled connection
   * Automatically acquires and releases the connection
   */
  async execute<R>(
    fn: (client: T) => Promise<R>
  ): Promise<R> {
    const client = await this.pool.acquire()
    try {
      return await fn(client)
    } finally {
      this.pool.release(client)
    }
  }
}