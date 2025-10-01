/**
 * Standardized Progress Reporting
 *
 * Provides unified progress tracking across all long-running operations
 * in Brainy (imports, clustering, large searches, etc.)
 *
 * PRODUCTION-READY - NO MOCKS, NO STUBS, REAL IMPLEMENTATION
 */

/**
 * Progress status states
 */
export type ProgressStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'

/**
 * Standardized progress report
 */
export interface BrainyProgress<T = any> {
  // Core status
  status: ProgressStatus

  // Progress percentage (0-100)
  progress: number

  // Human-readable message
  message: string

  // Detailed metadata
  metadata: {
    itemsProcessed: number
    itemsTotal: number
    currentItem?: string
    estimatedTimeRemaining?: number  // milliseconds
    startedAt: number
    completedAt?: number
    throughput?: number  // items per second
  }

  // Result when completed
  result?: T

  // Error when failed
  error?: Error
}

/**
 * Progress tracker with automatic time estimation
 */
export class ProgressTracker<T = any> {
  private status: ProgressStatus = 'pending'
  private processed = 0
  private total: number
  private startedAt?: number
  private completedAt?: number
  private currentItem?: string
  private result?: T
  private error?: Error
  private processingTimes: number[] = []  // Track last N processing times for estimation

  constructor(total: number) {
    if (total < 0) {
      throw new Error('Total must be non-negative')
    }
    this.total = total
  }

  /**
   * Factory method for creating progress trackers
   */
  static create<T>(total: number): ProgressTracker<T> {
    return new ProgressTracker<T>(total)
  }

  /**
   * Start tracking progress
   */
  start(): BrainyProgress<T> {
    this.status = 'running'
    this.startedAt = Date.now()
    return this.current()
  }

  /**
   * Update progress
   */
  update(processed: number, currentItem?: string): BrainyProgress<T> {
    if (processed < 0) {
      throw new Error('Processed count must be non-negative')
    }
    if (processed > this.total) {
      throw new Error(`Processed count (${processed}) exceeds total (${this.total})`)
    }

    const previousProcessed = this.processed
    this.processed = processed
    this.currentItem = currentItem

    // Track processing time for estimation
    if (this.startedAt && previousProcessed < processed) {
      const itemsProcessed = processed - previousProcessed
      const timeTaken = Date.now() - this.startedAt
      const avgTimePerItem = timeTaken / processed
      this.processingTimes.push(avgTimePerItem)

      // Keep only last 100 measurements for rolling average
      if (this.processingTimes.length > 100) {
        this.processingTimes.shift()
      }
    }

    return this.current()
  }

  /**
   * Increment progress by 1
   */
  increment(currentItem?: string): BrainyProgress<T> {
    return this.update(this.processed + 1, currentItem)
  }

  /**
   * Mark as completed
   */
  complete(result: T): BrainyProgress<T> {
    this.status = 'completed'
    this.completedAt = Date.now()
    this.processed = this.total
    this.result = result
    return this.current()
  }

  /**
   * Mark as failed
   */
  fail(error: Error): BrainyProgress<T> {
    this.status = 'failed'
    this.completedAt = Date.now()
    this.error = error
    return this.current()
  }

  /**
   * Mark as cancelled
   */
  cancel(): BrainyProgress<T> {
    this.status = 'cancelled'
    this.completedAt = Date.now()
    return this.current()
  }

  /**
   * Get current progress state
   */
  current(): BrainyProgress<T> {
    const progress = this.total > 0 ? Math.round((this.processed / this.total) * 100) : 0

    // Generate message based on status
    let message: string
    switch (this.status) {
      case 'pending':
        message = `Ready to process ${this.total} items`
        break
      case 'running':
        message = this.currentItem
          ? `Processing: ${this.currentItem} (${this.processed}/${this.total})`
          : `Processing ${this.processed}/${this.total} items`
        break
      case 'completed':
        message = `Completed ${this.total} items`
        break
      case 'failed':
        message = `Failed after ${this.processed} items: ${this.error?.message || 'Unknown error'}`
        break
      case 'cancelled':
        message = `Cancelled after ${this.processed} items`
        break
    }

    return {
      status: this.status,
      progress,
      message,
      metadata: {
        itemsProcessed: this.processed,
        itemsTotal: this.total,
        currentItem: this.currentItem,
        estimatedTimeRemaining: this.estimateTimeRemaining(),
        startedAt: this.startedAt || Date.now(),
        completedAt: this.completedAt,
        throughput: this.calculateThroughput()
      },
      result: this.result,
      error: this.error
    }
  }

  /**
   * Estimate time remaining based on processing history
   */
  private estimateTimeRemaining(): number | undefined {
    if (this.status !== 'running' || !this.startedAt || this.processed === 0) {
      return undefined
    }

    const remaining = this.total - this.processed
    if (remaining === 0) {
      return 0
    }

    // Use rolling average if we have enough samples
    if (this.processingTimes.length > 0) {
      const avgTimePerItem = this.processingTimes.reduce((a, b) => a + b, 0) / this.processingTimes.length
      return Math.round(avgTimePerItem * remaining)
    }

    // Fallback to simple calculation
    const elapsed = Date.now() - this.startedAt
    const avgTimePerItem = elapsed / this.processed
    return Math.round(avgTimePerItem * remaining)
  }

  /**
   * Calculate current throughput (items/second)
   */
  private calculateThroughput(): number | undefined {
    if (!this.startedAt || this.processed === 0) {
      return undefined
    }

    const elapsed = Date.now() - this.startedAt
    const seconds = elapsed / 1000
    return seconds > 0 ? Math.round((this.processed / seconds) * 100) / 100 : undefined
  }

  /**
   * Get progress statistics
   */
  getStats() {
    const elapsed = this.startedAt ? Date.now() - this.startedAt : 0
    return {
      status: this.status,
      processed: this.processed,
      total: this.total,
      remaining: this.total - this.processed,
      progress: this.total > 0 ? this.processed / this.total : 0,
      elapsed,
      estimatedTotal: elapsed > 0 && this.processed > 0
        ? Math.round((elapsed / this.processed) * this.total)
        : undefined,
      throughput: this.calculateThroughput()
    }
  }
}

/**
 * Helper to format time duration
 */
export function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)

  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`
  } else if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`
  } else {
    return `${seconds}s`
  }
}

/**
 * Helper to format progress percentage
 */
export function formatProgress(progress: BrainyProgress): string {
  const { status, progress: pct, metadata } = progress
  const remaining = metadata.estimatedTimeRemaining

  let str = `[${status.toUpperCase()}] ${pct}% (${metadata.itemsProcessed}/${metadata.itemsTotal})`

  if (metadata.throughput) {
    str += ` - ${metadata.throughput} items/s`
  }

  if (remaining && remaining > 0) {
    str += ` - ${formatDuration(remaining)} remaining`
  }

  return str
}
