/**
 * Conduit Augmentations - Data Synchronization Bridges
 * 
 * These augmentations connect and synchronize data between multiple Brainy instances.
 * Now using the unified BrainyAugmentation interface.
 */

import { BaseAugmentation, BrainyAugmentation, AugmentationContext } from './brainyAugmentation.js'
import { v4 as uuidv4 } from '../universal/uuid.js'

export interface WebSocketConnection {
  connectionId: string
  url: string
  readyState: number
  socket?: any
}

/**
 * Base class for conduit augmentations that sync between Brainy instances
 * Converted to use the unified BrainyAugmentation interface
 */
abstract class BaseConduitAugmentation extends BaseAugmentation {
  readonly timing = 'after' as const  // Conduits run after operations to sync
  readonly operations = ['addNoun', 'deleteNoun', 'addVerb'] as ('addNoun' | 'deleteNoun' | 'addVerb')[]
  readonly priority = 20  // Medium-low priority
  
  protected connections = new Map<string, any>()
  
  protected async onShutdown(): Promise<void> {
    // Close all connections
    for (const [connectionId, connection] of this.connections.entries()) {
      try {
        if (connection.close) {
          await connection.close()
        }
      } catch (error) {
        this.log(`Failed to close connection ${connectionId}: ${error}`, 'error')
      }
    }
    this.connections.clear()
  }
  
  abstract establishConnection(
    targetSystemId: string,
    config?: Record<string, unknown>
  ): Promise<WebSocketConnection | null>
}

/**
 * WebSocket Conduit Augmentation
 * Syncs data between Brainy instances using WebSockets
 */
export class WebSocketConduitAugmentation extends BaseConduitAugmentation {
  readonly name = 'websocket-conduit'
  private webSocketConnections = new Map<string, WebSocketConnection>()
  private messageCallbacks = new Map<string, Set<(data: any) => void>>()
  
  async execute<T = any>(
    operation: string,
    params: any,
    next: () => Promise<T>
  ): Promise<T> {
    // Execute the operation first
    const result = await next()
    
    // Then sync to connected instances
    if (this.shouldSync(operation)) {
      await this.syncOperation(operation, params, result)
    }
    
    return result
  }
  
  private shouldSync(operation: string): boolean {
    return ['addNoun', 'deleteNoun', 'addVerb'].includes(operation)
  }
  
  private async syncOperation(operation: string, params: any, result: any): Promise<void> {
    // Broadcast to all connected WebSocket instances
    for (const [id, connection] of this.webSocketConnections) {
      if (connection.socket && connection.readyState === 1) { // OPEN state
        try {
          const message = JSON.stringify({
            type: 'sync',
            operation,
            params,
            timestamp: Date.now()
          })
          
          if (typeof connection.socket.send === 'function') {
            connection.socket.send(message)
          }
        } catch (error) {
          this.log(`Failed to sync to ${id}: ${error}`, 'error')
        }
      }
    }
  }
  
  async establishConnection(
    url: string,
    config?: Record<string, unknown>
  ): Promise<WebSocketConnection | null> {
    try {
      const connectionId = uuidv4()
      const protocols = config?.protocols as string | string[] | undefined
      
      // Create WebSocket based on environment
      let socket: any
      
      if (typeof WebSocket !== 'undefined') {
        // Browser environment
        socket = new WebSocket(url, protocols)
      } else {
        // Node.js environment - dynamic import
        try {
          const ws = await import('ws')
          socket = new ws.WebSocket(url, protocols)
        } catch {
          this.log('WebSocket not available in this environment', 'error')
          return null
        }
      }
      
      // Setup event handlers
      socket.onopen = () => {
        this.log(`Connected to ${url}`)
      }
      
      socket.onmessage = (event: any) => {
        this.handleMessage(connectionId, event.data)
      }
      
      socket.onerror = (error: any) => {
        this.log(`WebSocket error: ${error}`, 'error')
      }
      
      socket.onclose = () => {
        this.log(`Disconnected from ${url}`)
        this.webSocketConnections.delete(connectionId)
      }
      
      // Wait for connection to open
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Connection timeout'))
        }, 5000)
        
        socket.onopen = () => {
          clearTimeout(timeout)
          resolve()
        }
        
        socket.onerror = (error: any) => {
          clearTimeout(timeout)
          reject(error)
        }
      })
      
      const connection: WebSocketConnection = {
        connectionId,
        url,
        readyState: socket.readyState,
        socket
      }
      
      this.webSocketConnections.set(connectionId, connection)
      this.connections.set(connectionId, connection)
      
      return connection
    } catch (error) {
      this.log(`Failed to establish connection to ${url}: ${error}`, 'error')
      return null
    }
  }
  
  private handleMessage(connectionId: string, data: any): void {
    try {
      const message = typeof data === 'string' ? JSON.parse(data) : data
      
      // Handle sync messages from remote instances
      if (message.type === 'sync') {
        // Apply the operation to our local instance
        this.applySyncOperation(message).catch(error => {
          this.log(`Failed to apply sync operation: ${error}`, 'error')
        })
      }
      
      // Notify any registered callbacks
      const callbacks = this.messageCallbacks.get(connectionId)
      if (callbacks) {
        callbacks.forEach(callback => callback(message))
      }
    } catch (error) {
      this.log(`Failed to handle message: ${error}`, 'error')
    }
  }
  
  private async applySyncOperation(message: any): Promise<void> {
    // Apply the synced operation to our local Brainy instance
    const { operation, params } = message
    
    try {
      switch (operation) {
        case 'addNoun':
          await this.context?.brain.addNoun(params.content, params.metadata)
          break
        case 'deleteNoun':
          await this.context?.brain.deleteNoun(params.id)
          break
        case 'addVerb':
          await this.context?.brain.addVerb(
            params.source,
            params.target,
            params.verb,
            params.metadata
          )
          break
      }
    } catch (error) {
      this.log(`Failed to apply ${operation}: ${error}`, 'error')
    }
  }
  
  /**
   * Subscribe to messages from a specific connection
   */
  onMessage(connectionId: string, callback: (data: any) => void): void {
    if (!this.messageCallbacks.has(connectionId)) {
      this.messageCallbacks.set(connectionId, new Set())
    }
    this.messageCallbacks.get(connectionId)!.add(callback)
  }
  
  /**
   * Send a message to a specific connection
   */
  sendMessage(connectionId: string, data: any): boolean {
    const connection = this.webSocketConnections.get(connectionId)
    if (connection?.socket && connection.readyState === 1) {
      try {
        const message = typeof data === 'string' ? data : JSON.stringify(data)
        connection.socket.send(message)
        return true
      } catch (error) {
        this.log(`Failed to send message: ${error}`, 'error')
      }
    }
    return false
  }
}

/**
 * Example usage:
 * 
 * // Server instance
 * const serverBrain = new BrainyData()
 * serverBrain.augmentations.register(new APIServerAugmentation())
 * await serverBrain.init()
 * 
 * // Client instance
 * const clientBrain = new BrainyData()
 * const conduit = new WebSocketConduitAugmentation()
 * clientBrain.augmentations.register(conduit)
 * await clientBrain.init()
 * 
 * // Connect client to server
 * await conduit.establishConnection('ws://localhost:3000/ws')
 * 
 * // Now operations sync automatically!
 * await clientBrain.addNoun('synced data', { source: 'client' })
 * // This will automatically sync to the server
 */