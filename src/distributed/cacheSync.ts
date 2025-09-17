/**
 * Distributed Cache Synchronization
 * Provides cache coherence across multiple Brainy instances
 */

import { EventEmitter } from 'node:events'

export interface CacheSyncConfig {
  nodeId: string
  syncInterval?: number
  maxSyncBatchSize?: number
  compressionEnabled?: boolean
}

export interface CacheEntry {
  key: string
  value: any
  version: number
  timestamp: number
  ttl?: number
  nodeId: string
}

export interface SyncMessage {
  type: 'invalidate' | 'update' | 'delete' | 'batch'
  entries: CacheEntry[]
  source: string
  timestamp: number
}

/**
 * Distributed Cache Synchronizer
 */
export class CacheSync extends EventEmitter {
  private nodeId: string
  private localCache: Map<string, CacheEntry> = new Map()
  private versionVector: Map<string, number> = new Map()
  private syncQueue: SyncMessage[] = []
  private syncInterval: number
  private maxSyncBatchSize: number
  private syncTimer?: NodeJS.Timeout
  private isRunning: boolean = false

  constructor(config: CacheSyncConfig) {
    super()
    
    this.nodeId = config.nodeId
    this.syncInterval = config.syncInterval || 1000
    this.maxSyncBatchSize = config.maxSyncBatchSize || 100
  }

  /**
   * Start cache synchronization
   */
  start(): void {
    if (this.isRunning) return
    
    this.isRunning = true
    this.startSyncTimer()
    
    this.emit('started', { nodeId: this.nodeId })
  }

  /**
   * Stop cache synchronization
   */
  stop(): void {
    if (!this.isRunning) return
    
    this.isRunning = false
    
    if (this.syncTimer) {
      clearInterval(this.syncTimer)
      this.syncTimer = undefined
    }
    
    this.emit('stopped', { nodeId: this.nodeId })
  }

  /**
   * Get a value from cache
   */
  get(key: string): any | undefined {
    const entry = this.localCache.get(key)
    
    if (!entry) return undefined
    
    // Check TTL
    if (entry.ttl && Date.now() - entry.timestamp > entry.ttl) {
      this.localCache.delete(key)
      return undefined
    }
    
    return entry.value
  }

  /**
   * Set a value in cache and propagate
   */
  set(key: string, value: any, ttl?: number): void {
    const version = this.incrementVersion(key)
    
    const entry: CacheEntry = {
      key,
      value,
      version,
      timestamp: Date.now(),
      ttl,
      nodeId: this.nodeId
    }
    
    this.localCache.set(key, entry)
    
    // Queue for sync
    this.queueSync('update', [entry])
  }

  /**
   * Delete a value from cache and propagate
   */
  delete(key: string): boolean {
    const existed = this.localCache.has(key)
    
    if (existed) {
      const version = this.incrementVersion(key)
      this.localCache.delete(key)
      
      // Queue deletion for sync
      this.queueSync('delete', [{
        key,
        value: null,
        version,
        timestamp: Date.now(),
        nodeId: this.nodeId
      }])
    }
    
    return existed
  }

  /**
   * Invalidate a cache entry across all nodes
   */
  invalidate(key: string): void {
    const version = this.incrementVersion(key)
    this.localCache.delete(key)
    
    // Queue invalidation
    this.queueSync('invalidate', [{
      key,
      value: null,
      version,
      timestamp: Date.now(),
      nodeId: this.nodeId
    }])
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    const entries: CacheEntry[] = []
    
    for (const key of this.localCache.keys()) {
      const version = this.incrementVersion(key)
      entries.push({
        key,
        value: null,
        version,
        timestamp: Date.now(),
        nodeId: this.nodeId
      })
    }
    
    this.localCache.clear()
    
    if (entries.length > 0) {
      this.queueSync('delete', entries)
    }
  }

  /**
   * Handle incoming sync message from another node
   */
  handleSyncMessage(message: SyncMessage): void {
    if (message.source === this.nodeId) return // Ignore own messages
    
    for (const entry of message.entries) {
      this.handleRemoteEntry(message.type, entry)
    }
    
    this.emit('synced', { 
      type: message.type, 
      entries: message.entries.length,
      source: message.source 
    })
  }

  /**
   * Handle a remote cache entry
   */
  private handleRemoteEntry(type: 'invalidate' | 'update' | 'delete' | 'batch', entry: CacheEntry): void {
    const localEntry = this.localCache.get(entry.key)
    const localVersion = this.versionVector.get(entry.key) || 0
    
    // Version vector check - only accept if remote version is newer
    if (entry.version <= localVersion) {
      return // Our version is newer or same, ignore
    }
    
    // Update version vector
    this.versionVector.set(entry.key, entry.version)
    
    switch (type) {
      case 'update':
      case 'batch':
        // Update local cache with remote value
        this.localCache.set(entry.key, entry)
        break
        
      case 'delete':
      case 'invalidate':
        // Remove from local cache
        this.localCache.delete(entry.key)
        break
    }
  }

  /**
   * Queue a sync message
   */
  private queueSync(type: 'invalidate' | 'update' | 'delete' | 'batch', entries: CacheEntry[]): void {
    const message: SyncMessage = {
      type,
      entries,
      source: this.nodeId,
      timestamp: Date.now()
    }
    
    this.syncQueue.push(message)
    
    // If queue is getting large, sync immediately
    if (this.syncQueue.length >= this.maxSyncBatchSize) {
      this.performSync()
    }
  }

  /**
   * Start sync timer
   */
  private startSyncTimer(): void {
    this.syncTimer = setInterval(() => {
      this.performSync()
    }, this.syncInterval)
  }

  /**
   * Perform sync operation
   */
  private performSync(): void {
    if (this.syncQueue.length === 0) return
    
    // Batch multiple messages if possible
    const messages = this.syncQueue.splice(0, this.maxSyncBatchSize)
    
    if (messages.length === 1) {
      // Single message
      this.emit('sync', messages[0])
    } else {
      // Batch multiple messages
      const batchedEntries: CacheEntry[] = []
      for (const msg of messages) {
        batchedEntries.push(...msg.entries)
      }
      
      const batchMessage: SyncMessage = {
        type: 'batch',
        entries: batchedEntries,
        source: this.nodeId,
        timestamp: Date.now()
      }
      
      this.emit('sync', batchMessage)
    }
  }

  /**
   * Increment version for a key
   */
  private incrementVersion(key: string): number {
    const current = this.versionVector.get(key) || 0
    const next = current + 1
    this.versionVector.set(key, next)
    return next
  }

  /**
   * Get cache statistics
   */
  getStats(): {
    entries: number
    pendingSync: number
    versionedKeys: number
    memoryUsage: number
  } {
    // Estimate memory usage (rough approximation)
    let memoryUsage = 0
    for (const entry of this.localCache.values()) {
      memoryUsage += JSON.stringify(entry).length
    }
    
    return {
      entries: this.localCache.size,
      pendingSync: this.syncQueue.length,
      versionedKeys: this.versionVector.size,
      memoryUsage
    }
  }

  /**
   * Get cache entries for debugging
   */
  getEntries(): CacheEntry[] {
    return Array.from(this.localCache.values())
  }

  /**
   * Merge cache state from another node (for recovery)
   */
  mergeState(entries: CacheEntry[]): void {
    for (const entry of entries) {
      this.handleRemoteEntry('update', entry)
    }
  }
}

/**
 * Create a cache sync instance
 */
export function createCacheSync(config: CacheSyncConfig): CacheSync {
  return new CacheSync(config)
}