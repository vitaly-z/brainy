/**
 * Metadata Write Buffer — Deduplicates rapid writes to the same cloud storage path.
 *
 * When multiple brain.add() calls happen in rapid succession (e.g., chat: store message
 * + create conversation + auto-title), the SAME sparse index and chunk files get written
 * repeatedly. This buffer deduplicates writes to the same cloud storage path across
 * multiple operations using a time-windowed buffer.
 *
 * Latest data wins — if the same path is written 5 times in 200ms, only the final
 * version is actually sent to cloud storage.
 *
 * NOT used by FileSystem adapter — local writes are already fast (~1ms), and buffering
 * would add unnecessary latency.
 */

import { prodLog } from './logger.js'

export class MetadataWriteBuffer {
  private pendingWrites = new Map<string, any>()
  private flushTimer: ReturnType<typeof setInterval> | null = null
  private isFlushing = false
  private pendingFlushPromise: Promise<void> | null = null
  private writeFunction: (path: string, data: any) => Promise<void>

  private maxBufferSize: number
  private flushIntervalMs: number
  private concurrencyLimit: number

  constructor(
    writeFunction: (path: string, data: any) => Promise<void>,
    options?: {
      maxBufferSize?: number
      flushIntervalMs?: number
      concurrencyLimit?: number
    }
  ) {
    this.writeFunction = writeFunction
    this.maxBufferSize = options?.maxBufferSize ?? 200
    this.flushIntervalMs = options?.flushIntervalMs ?? 200
    this.concurrencyLimit = options?.concurrencyLimit ?? 10
    this.startPeriodicFlush()
  }

  /**
   * Buffer a write to the given path. Latest data wins — if the same path
   * is written multiple times before flush, only the last version is sent.
   */
  async write(path: string, data: any): Promise<void> {
    this.pendingWrites.set(path, data)

    if (this.pendingWrites.size >= this.maxBufferSize) {
      await this.flush()
    }
  }

  /**
   * Flush all pending writes to cloud storage.
   * Respects concurrency limits to avoid overwhelming the cloud API.
   */
  async flush(): Promise<void> {
    if (this.isFlushing) {
      if (this.pendingFlushPromise) await this.pendingFlushPromise
      return
    }
    if (this.pendingWrites.size === 0) return

    this.isFlushing = true
    const writes = new Map(this.pendingWrites)
    this.pendingWrites.clear()

    this.pendingFlushPromise = this.doFlush(writes)
    try {
      await this.pendingFlushPromise
    } finally {
      this.isFlushing = false
      this.pendingFlushPromise = null
    }
  }

  private async doFlush(writes: Map<string, any>): Promise<void> {
    const entries = Array.from(writes.entries())

    for (let i = 0; i < entries.length; i += this.concurrencyLimit) {
      const batch = entries.slice(i, i + this.concurrencyLimit)
      const results = await Promise.allSettled(
        batch.map(([path, data]) => this.writeFunction(path, data))
      )

      // Log failures but don't throw — individual write errors are handled by retry logic
      for (let j = 0; j < results.length; j++) {
        if (results[j].status === 'rejected') {
          const [path] = batch[j]
          prodLog.warn(`MetadataWriteBuffer: failed to write ${path}:`, (results[j] as PromiseRejectedResult).reason)
        }
      }
    }
  }

  private startPeriodicFlush(): void {
    this.flushTimer = setInterval(() => {
      if (this.pendingWrites.size > 0) {
        this.flush().catch((err) => {
          prodLog.warn('MetadataWriteBuffer: periodic flush error:', err)
        })
      }
    }, this.flushIntervalMs)

    // Prevent timer from keeping the process alive
    if (this.flushTimer && typeof this.flushTimer === 'object' && 'unref' in this.flushTimer) {
      this.flushTimer.unref()
    }
  }

  /**
   * Drain all pending writes and stop the periodic flush timer.
   * Must be called during close/destroy to ensure all data is written.
   */
  async destroy(): Promise<void> {
    if (this.flushTimer) {
      clearInterval(this.flushTimer)
      this.flushTimer = null
    }
    await this.flush()
  }

  /**
   * Get the number of pending writes in the buffer.
   */
  get size(): number {
    return this.pendingWrites.size
  }
}
