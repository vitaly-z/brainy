/**
 * Async Queue for serializing operations
 * Prevents race conditions by ensuring operations execute sequentially
 */

export interface QueuedTask<T = any> {
  execute: () => Promise<T>
  resolve: (value: T) => void
  reject: (error: any) => void
}

/**
 * Simple async queue that ensures operations run sequentially
 * Used to prevent race conditions in concurrent write scenarios
 */
export class AsyncQueue {
  private queue: QueuedTask[] = []
  private processing = false
  
  /**
   * Add a task to the queue
   * @param fn Async function to execute
   * @returns Promise that resolves when the task completes
   */
  async add<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.queue.push({
        execute: fn,
        resolve,
        reject
      })
      
      // Start processing if not already running
      if (!this.processing) {
        this.process()
      }
    })
  }
  
  /**
   * Process tasks in the queue sequentially
   */
  private async process(): Promise<void> {
    if (this.processing) return
    
    this.processing = true
    
    while (this.queue.length > 0) {
      const task = this.queue.shift()!
      
      try {
        const result = await task.execute()
        task.resolve(result)
      } catch (error) {
        task.reject(error)
      }
    }
    
    this.processing = false
  }
  
  /**
   * Get the current queue size
   */
  get size(): number {
    return this.queue.length
  }
  
  /**
   * Check if the queue is currently processing
   */
  get isProcessing(): boolean {
    return this.processing
  }
  
  /**
   * Clear all pending tasks
   */
  clear(): void {
    const error = new Error('Queue cleared')
    while (this.queue.length > 0) {
      const task = this.queue.shift()!
      task.reject(error)
    }
  }
}

/**
 * Keyed async queue - separate queues for different keys
 * Allows parallel processing of different keys while serializing same key
 */
export class KeyedAsyncQueue {
  private queues = new Map<string, AsyncQueue>()
  
  /**
   * Add a task for a specific key
   */
  async add<T>(key: string, fn: () => Promise<T>): Promise<T> {
    if (!this.queues.has(key)) {
      this.queues.set(key, new AsyncQueue())
    }
    
    const queue = this.queues.get(key)!
    const result = await queue.add(fn)
    
    // Clean up empty queues
    if (queue.size === 0 && !queue.isProcessing) {
      this.queues.delete(key)
    }
    
    return result
  }
  
  /**
   * Get the number of active queues
   */
  get activeQueues(): number {
    return this.queues.size
  }
  
  /**
   * Clear all queues
   */
  clear(): void {
    for (const queue of this.queues.values()) {
      queue.clear()
    }
    this.queues.clear()
  }
}