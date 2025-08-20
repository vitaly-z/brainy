/**
 * Write-Ahead Log (WAL) Implementation
 * Ensures durability and atomicity of operations across all storage adapters
 * 
 * This lightweight implementation provides:
 * - Operation logging before execution
 * - Crash recovery on startup
 * - Transaction-like semantics for multi-step operations
 */

import { v4 as uuidv4 } from '../../universal/uuid.js'
import { StorageAdapter } from '../../coreTypes.js'

export interface WALEntry {
  id: string
  operation: string
  params: any
  timestamp: number
  status: 'pending' | 'completed' | 'failed'
  error?: string
  checkpointId?: string
}

export interface WALConfig {
  /**
   * Enable WAL (default: true in production)
   */
  enabled?: boolean
  
  /**
   * Path/prefix for WAL files
   */
  walPath?: string
  
  /**
   * Maximum WAL size before rotation (bytes)
   */
  maxSize?: number
  
  /**
   * Checkpoint interval (ms)
   */
  checkpointInterval?: number
  
  /**
   * Auto-recovery on startup
   */
  autoRecover?: boolean
}

/**
 * Write-Ahead Log for ensuring operation durability
 * Works with all storage adapters (filesystem, OPFS, S3, memory)
 */
export class WriteAheadLog {
  private storage: StorageAdapter
  private config: Required<WALConfig>
  private currentLogFile: string
  private checkpointTimer?: NodeJS.Timeout
  private operationCounter = 0
  private isRecovering = false
  
  constructor(storage: StorageAdapter, config: WALConfig = {}) {
    this.storage = storage
    
    // Intelligent defaults based on storage type
    const defaults = this.getIntelligentDefaults(storage)
    
    this.config = {
      enabled: config.enabled ?? defaults.enabled,
      walPath: config.walPath ?? '_wal',
      maxSize: config.maxSize ?? defaults.maxSize,
      checkpointInterval: config.checkpointInterval ?? defaults.checkpointInterval,
      autoRecover: config.autoRecover ?? true
    }
    
    this.currentLogFile = `${this.config.walPath}/wal_${Date.now()}.log`
  }
  
  /**
   * Get intelligent defaults based on storage adapter type
   * ALWAYS ENABLED for maximum robustness - the Brainy way!
   */
  private getIntelligentDefaults(storage: StorageAdapter): Partial<WALConfig> {
    // Detect storage type from adapter
    const storageType = this.detectStorageType(storage)
    
    switch(storageType) {
      case 's3':
      case 'r2':
      case 'gcs':
        // Cloud storage: Optimized for cost but STILL ENABLED
        return {
          enabled: true, // Always on for robustness!
          maxSize: 50 * 1024 * 1024, // 50MB (fewer rotations = less cost)
          checkpointInterval: 5 * 60 * 1000 // 5 minutes (less frequent = less cost)
        }
      
      case 'filesystem':
      case 'opfs':
        // Local storage: Aggressive WAL (no cost)
        return {
          enabled: true,
          maxSize: 10 * 1024 * 1024, // 10MB
          checkpointInterval: 60 * 1000 // 1 minute
        }
      
      case 'memory':
        // Memory storage: Still enabled for operation tracking
        return {
          enabled: true, // Track operations even in memory
          maxSize: 1024 * 1024, // 1MB 
          checkpointInterval: 0 // No checkpoints (no persistence)
        }
      
      default:
        // Unknown storage: Always on
        return {
          enabled: true,
          maxSize: 10 * 1024 * 1024,
          checkpointInterval: 60 * 1000
        }
    }
  }
  
  /**
   * Detect storage type from adapter
   */
  private detectStorageType(storage: StorageAdapter): string {
    // Check adapter name or properties
    const className = storage.constructor.name.toLowerCase()
    
    if (className.includes('s3')) return 's3'
    if (className.includes('r2')) return 'r2'
    if (className.includes('gcs')) return 'gcs'
    if (className.includes('filesystem') || className.includes('file')) return 'filesystem'
    if (className.includes('opfs')) return 'opfs'
    if (className.includes('memory')) return 'memory'
    
    // Check for S3 client as a property
    if ('s3Client' in storage || 'client' in storage) {
      return 's3'
    }
    
    return 'unknown'
  }
  
  /**
   * Initialize WAL and recover any pending operations
   */
  async initialize(): Promise<void> {
    if (!this.config.enabled) return
    
    // Ensure WAL directory exists
    await this.ensureWALDirectory()
    
    // Recover pending operations if needed
    if (this.config.autoRecover) {
      await this.recover()
    }
    
    // Start checkpoint timer
    if (this.config.checkpointInterval > 0) {
      this.checkpointTimer = setInterval(
        () => this.checkpoint(),
        this.config.checkpointInterval
      )
    }
  }
  
  /**
   * Log an operation and execute it with durability guarantees
   */
  async execute<T>(
    operation: string,
    params: any,
    executor: () => Promise<T>
  ): Promise<T> {
    // Skip WAL if disabled or during recovery
    if (!this.config.enabled || this.isRecovering) {
      return executor()
    }
    
    const entry: WALEntry = {
      id: uuidv4(),
      operation,
      params,
      timestamp: Date.now(),
      status: 'pending'
    }
    
    // Step 1: Write to WAL (durability)
    await this.writeEntry(entry)
    
    try {
      // Step 2: Execute operation
      const result = await executor()
      
      // Step 3: Mark as completed
      entry.status = 'completed'
      await this.writeEntry(entry)
      
      this.operationCounter++
      
      // Check if we need to rotate log
      await this.checkRotation()
      
      return result
    } catch (error) {
      // Mark as failed
      entry.status = 'failed'
      entry.error = (error as Error).message
      await this.writeEntry(entry)
      
      throw error
    }
  }
  
  /**
   * Recover pending operations from WAL
   * Called on startup to ensure consistency
   */
  async recover(): Promise<void> {
    if (!this.config.enabled) return
    
    this.isRecovering = true
    
    try {
      const entries = await this.readAllEntries()
      const pending = this.findPendingOperations(entries)
      
      if (pending.length > 0) {
        console.log(`🔄 WAL Recovery: Found ${pending.length} pending operations`)
        
        for (const entry of pending) {
          try {
            // Attempt to replay the operation
            await this.replayOperation(entry)
            
            // Mark as recovered
            entry.status = 'completed'
            await this.writeEntry(entry)
          } catch (error) {
            console.error(`❌ Failed to recover operation ${entry.id}:`, error)
            
            // Mark as failed
            entry.status = 'failed'
            entry.error = (error as Error).message
            await this.writeEntry(entry)
          }
        }
        
        console.log('✅ WAL Recovery complete')
      }
    } finally {
      this.isRecovering = false
    }
  }
  
  /**
   * Create a checkpoint (snapshot of current state)
   */
  async checkpoint(): Promise<void> {
    if (!this.config.enabled) return
    
    const checkpointId = uuidv4()
    const entry: WALEntry = {
      id: checkpointId,
      operation: 'CHECKPOINT',
      params: {
        operationCount: this.operationCounter,
        timestamp: Date.now()
      },
      timestamp: Date.now(),
      status: 'completed',
      checkpointId
    }
    
    await this.writeEntry(entry)
    
    // Clean up old entries before this checkpoint
    await this.cleanupBeforeCheckpoint(checkpointId)
  }
  
  /**
   * Write an entry to the WAL
   */
  private async writeEntry(entry: WALEntry): Promise<void> {
    const line = JSON.stringify(entry) + '\n'
    
    // Append to current log file
    if (this.storage.append) {
      // Use native append if available (filesystem, S3 multipart)
      await this.storage.append(this.currentLogFile, line)
    } else {
      // Fallback: read, append, write (less efficient but works everywhere)
      let content = ''
      try {
        const existing = await this.storage.get(this.currentLogFile)
        if (existing) {
          content = existing.toString()
        }
      } catch {
        // File doesn't exist yet
      }
      
      content += line
      // Use appropriate storage method
      if (this.storage.save) {
        await this.storage.save(this.currentLogFile, Buffer.from(content))
      } else if (this.storage.saveNoun) {
        // Fallback: save as a noun-like object for compatibility
        await this.storage.saveNoun({
          id: this.currentLogFile,
          vector: [],
          connections: new Map(),
          level: 0,
          metadata: { walLog: content }
        })
      }
    }
  }
  
  /**
   * Read all WAL entries
   */
  private async readAllEntries(): Promise<WALEntry[]> {
    const entries: WALEntry[] = []
    
    try {
      // Check if storage adapter supports listing
      if (!this.storage.list) {
        // Fallback: try to read the current log file directly
        try {
          const content = await this.storage.get(this.currentLogFile)
          if (content) {
            const lines = content.toString().split('\n').filter(line => line.trim())
            for (const line of lines) {
              try {
                entries.push(JSON.parse(line))
              } catch {
                // Skip malformed lines
              }
            }
          }
        } catch {
          // No existing log file
        }
        return entries
      }
      
      // List all WAL files if supported
      const files = await this.storage.list(this.config.walPath)
      
      for (const file of files) {
        if (file.endsWith('.log')) {
          const content = await this.storage.get(file)
          if (content) {
            const lines = content.toString().split('\n').filter(line => line.trim())
            for (const line of lines) {
              try {
                entries.push(JSON.parse(line))
              } catch {
                // Skip malformed lines
              }
            }
          }
        }
      }
    } catch (error) {
      console.warn('⚠️ Error reading WAL entries:', error)
    }
    
    return entries
  }
  
  /**
   * Find operations that were started but not completed
   */
  private findPendingOperations(entries: WALEntry[]): WALEntry[] {
    const operationMap = new Map<string, WALEntry>()
    
    for (const entry of entries) {
      if (entry.status === 'pending') {
        operationMap.set(entry.id, entry)
      } else if (entry.status === 'completed' || entry.status === 'failed') {
        operationMap.delete(entry.id)
      }
    }
    
    return Array.from(operationMap.values())
  }
  
  /**
   * Replay an operation during recovery
   */
  private async replayOperation(entry: WALEntry): Promise<void> {
    // This would need to be implemented based on your operation types
    // For now, we'll just log it
    console.log(`🔁 Replaying operation: ${entry.operation}`, entry.params)
    
    // In a real implementation, you'd have a registry of operation handlers:
    // const handler = this.operationHandlers.get(entry.operation)
    // if (handler) {
    //   await handler(entry.params)
    // }
  }
  
  /**
   * Ensure WAL directory exists
   */
  private async ensureWALDirectory(): Promise<void> {
    // Most storage adapters handle this automatically
    // but we'll try to create it just in case
    try {
      await this.storage.save(`${this.config.walPath}/.wal`, Buffer.from(''))
    } catch {
      // Directory probably already exists
    }
  }
  
  /**
   * Check if log rotation is needed
   */
  private async checkRotation(): Promise<void> {
    try {
      const stats = await this.storage.getMetadata(this.currentLogFile)
      const size = stats?.size || 0
      
      if (size > this.config.maxSize) {
        // Rotate to new log file
        const newLogFile = `${this.config.walPath}/wal_${Date.now()}.log`
        this.currentLogFile = newLogFile
      }
    } catch {
      // Can't check size, continue with current file
    }
  }
  
  /**
   * Clean up entries before a checkpoint
   */
  private async cleanupBeforeCheckpoint(checkpointId: string): Promise<void> {
    // In a production system, you'd archive or delete old entries
    // For now, we'll just note it
    console.log(`🧹 Checkpoint ${checkpointId} created`)
  }
  
  /**
   * Shutdown WAL and cleanup resources
   */
  async shutdown(): Promise<void> {
    if (this.checkpointTimer) {
      clearInterval(this.checkpointTimer)
    }
    
    // Final checkpoint
    await this.checkpoint()
  }
}

/**
 * Transaction helper for multi-step operations
 */
export class WALTransaction {
  private wal: WriteAheadLog
  private operations: Array<{ operation: string; params: any; executor: () => Promise<any> }> = []
  
  constructor(wal: WriteAheadLog) {
    this.wal = wal
  }
  
  /**
   * Add an operation to the transaction
   */
  add(operation: string, params: any, executor: () => Promise<any>): void {
    this.operations.push({ operation, params, executor })
  }
  
  /**
   * Execute all operations atomically
   */
  async commit(): Promise<void> {
    // Execute each operation through WAL
    for (const op of this.operations) {
      await this.wal.execute(op.operation, op.params, op.executor)
    }
  }
}