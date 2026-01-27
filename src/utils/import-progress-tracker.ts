/**
 * Import Progress Tracker
 *
 * Comprehensive progress tracking for imports with:
 * - Multi-dimensional progress (bytes, entities, stages, timing)
 * - Smart estimation (entity count, time remaining)
 * - Stage-specific metrics (bytes/sec vs entities/sec)
 * - Throttled callbacks (avoid spam)
 * - Weighted overall progress
 *
 */

import {
  ImportProgress,
  ImportStage,
  ImportStatus,
  StageWeights,
  ImportProgressCallback
} from '../types/brainy.types.js'

/**
 * Default stage weights (reflect typical time distribution)
 */
const DEFAULT_STAGE_WEIGHTS: StageWeights = {
  detecting: 0.01,   // 1% - very fast
  reading: 0.05,     // 5% - reading file
  parsing: 0.10,     // 10% - parsing structure
  extracting: 0.60,  // 60% - AI extraction (slowest!)
  indexing: 0.20,    // 20% - creating graph
  completing: 0.04   // 4% - cleanup
}

/**
 * Stage ordering for progress calculation
 */
const STAGE_ORDER: ImportStage[] = [
  'detecting',
  'reading',
  'parsing',
  'extracting',
  'indexing',
  'completing'
]

/**
 * Progress tracker for imports
 */
export class ImportProgressTracker {
  // Configuration
  private readonly stageWeights: StageWeights
  private readonly throttleMs: number
  private readonly callback?: ImportProgressCallback

  // Tracking state
  private startTime: number
  private lastEmitTime: number = 0
  private currentStage: ImportStage = 'detecting'
  private completedStages: Set<ImportStage> = new Set()

  // Metrics
  private totalBytes: number = 0
  private bytesProcessed: number = 0
  private entitiesExtracted: number = 0
  private entitiesIndexed: number = 0
  private parseStartTime?: number
  private extractStartTime?: number
  private indexStartTime?: number

  // Estimation
  private lastBytesCheckpoint: number = 0
  private lastBytesCheckpointTime: number = 0
  private lastEntitiesCheckpoint: number = 0
  private lastEntitiesCheckpointTime: number = 0

  // Context
  private currentItem?: string
  private currentFile?: string
  private fileNumber?: number
  private totalFiles?: number

  // Memory tracking
  private peakMemoryMB: number = 0

  constructor(options: {
    totalBytes?: number
    stageWeights?: Partial<StageWeights>
    throttleMs?: number
    callback?: ImportProgressCallback
  } = {}) {
    this.stageWeights = { ...DEFAULT_STAGE_WEIGHTS, ...options.stageWeights }
    this.throttleMs = options.throttleMs ?? 100  // 100ms default
    this.callback = options.callback
    this.totalBytes = options.totalBytes ?? 0
    this.startTime = Date.now()
    this.lastBytesCheckpointTime = this.startTime
    this.lastEntitiesCheckpointTime = this.startTime
  }

  /**
   * Set total file size (if known later)
   */
  setTotalBytes(bytes: number): void {
    this.totalBytes = bytes
  }

  /**
   * Update current stage
   */
  setStage(stage: ImportStage, message?: string): void {
    // Mark previous stage as complete
    if (this.currentStage !== stage) {
      this.completedStages.add(this.currentStage)
    }

    this.currentStage = stage
    if (message) {
      this.setStageMessage(message)
    }

    // Track stage start times
    const now = Date.now()
    switch (stage) {
      case 'parsing':
        this.parseStartTime = now
        break
      case 'extracting':
        this.extractStartTime = now
        break
      case 'indexing':
        this.indexStartTime = now
        break
    }

    // Force emit on stage change
    this.emit(true)
  }

  /**
   * Update bytes processed
   */
  updateBytes(bytes: number): void {
    this.bytesProcessed = bytes
    this.emit()
  }

  /**
   * Increment bytes processed
   */
  addBytes(bytes: number): void {
    this.bytesProcessed += bytes
    this.emit()
  }

  /**
   * Update entities extracted
   */
  updateEntitiesExtracted(count: number): void {
    this.entitiesExtracted = count
    this.emit()
  }

  /**
   * Increment entities extracted
   */
  addEntitiesExtracted(count: number): void {
    this.entitiesExtracted += count
    this.emit()
  }

  /**
   * Update entities indexed
   */
  updateEntitiesIndexed(count: number): void {
    this.entitiesIndexed = count
    this.emit()
  }

  /**
   * Increment entities indexed
   */
  addEntitiesIndexed(count: number): void {
    this.entitiesIndexed += count
    this.emit()
  }

  /**
   * Set context information
   */
  setContext(context: {
    currentItem?: string
    currentFile?: string
    fileNumber?: number
    totalFiles?: number
  }): void {
    if (context.currentItem !== undefined) this.currentItem = context.currentItem
    if (context.currentFile !== undefined) this.currentFile = context.currentFile
    if (context.fileNumber !== undefined) this.fileNumber = context.fileNumber
    if (context.totalFiles !== undefined) this.totalFiles = context.totalFiles
    this.emit()
  }

  /**
   * Set stage message
   */
  private setStageMessage(message: string): void {
    this.currentItem = message
  }

  /**
   * Calculate stage progress (0-100 within current stage)
   */
  private calculateStageProgress(): number {
    switch (this.currentStage) {
      case 'detecting':
      case 'completing':
        // These are quick, assume 100% once started
        return 100

      case 'reading':
      case 'parsing':
        // Use bytes as proxy for progress
        if (this.totalBytes === 0) return 0
        return Math.min(100, (this.bytesProcessed / this.totalBytes) * 100)

      case 'extracting':
        // Extraction progress is hard to estimate (AI is unpredictable)
        // We can't reliably say % complete, so return 0
        return 0

      case 'indexing':
        // If we have estimated total entities, use that
        if (this.entitiesExtracted > 0) {
          return Math.min(100, (this.entitiesIndexed / this.entitiesExtracted) * 100)
        }
        return 0

      default:
        return 0
    }
  }

  /**
   * Calculate overall progress (0-100 weighted across all stages)
   */
  private calculateOverallProgress(): number {
    // Calculate progress of completed stages
    let completedWeight = 0
    for (const stage of this.completedStages) {
      completedWeight += this.stageWeights[stage]
    }

    // Calculate progress of current stage
    const stageProgress = this.calculateStageProgress()
    const currentStageContribution = this.stageWeights[this.currentStage] * (stageProgress / 100)

    // Overall = completed stages + current stage contribution
    const overall = (completedWeight + currentStageContribution) * 100

    return Math.min(100, Math.max(0, overall))
  }

  /**
   * Calculate bytes per second
   */
  private calculateBytesPerSecond(): number | undefined {
    const now = Date.now()
    const elapsed = now - this.lastBytesCheckpointTime

    // Need at least 1 second of data
    if (elapsed < 1000) return undefined

    const bytesDelta = this.bytesProcessed - this.lastBytesCheckpoint
    const bytesPerSec = (bytesDelta / elapsed) * 1000

    // Update checkpoint
    this.lastBytesCheckpoint = this.bytesProcessed
    this.lastBytesCheckpointTime = now

    return bytesPerSec > 0 ? bytesPerSec : undefined
  }

  /**
   * Calculate entities per second
   */
  private calculateEntitiesPerSecond(): number | undefined {
    const now = Date.now()
    const elapsed = now - this.lastEntitiesCheckpointTime

    // Need at least 1 second of data
    if (elapsed < 1000) return undefined

    // Use appropriate counter based on stage
    const currentCount = this.currentStage === 'indexing'
      ? this.entitiesIndexed
      : this.entitiesExtracted

    const entitiesDelta = currentCount - this.lastEntitiesCheckpoint
    const entitiesPerSec = (entitiesDelta / elapsed) * 1000

    // Update checkpoint
    this.lastEntitiesCheckpoint = currentCount
    this.lastEntitiesCheckpointTime = now

    return entitiesPerSec > 0 ? entitiesPerSec : undefined
  }

  /**
   * Estimate total entities
   */
  private estimateTotalEntities(): { count: number, confidence: number } | undefined {
    // Only estimate if we've processed some bytes and extracted some entities
    if (this.bytesProcessed === 0 || this.entitiesExtracted === 0 || this.totalBytes === 0) {
      return undefined
    }

    // Estimate based on entities per byte
    const bytesPercentage = this.bytesProcessed / this.totalBytes
    const estimatedTotal = Math.ceil(this.entitiesExtracted / bytesPercentage)

    // Confidence increases with more data
    const confidence = Math.min(0.95, bytesPercentage)

    return { count: estimatedTotal, confidence }
  }

  /**
   * Estimate remaining time
   */
  private estimateRemainingTime(): number | undefined {
    const now = Date.now()
    const elapsed = now - this.startTime

    // Need at least 5 seconds of data for reasonable estimate
    if (elapsed < 5000) return undefined

    const overallProgress = this.calculateOverallProgress()
    if (overallProgress === 0) return undefined

    // Estimate total time based on current progress
    const estimatedTotalMs = (elapsed / overallProgress) * 100
    const remainingMs = estimatedTotalMs - elapsed

    return remainingMs > 0 ? remainingMs : undefined
  }

  /**
   * Get current memory usage
   */
  private getCurrentMemoryMB(): number | undefined {
    if (typeof process === 'undefined' || !process.memoryUsage) return undefined

    const usage = process.memoryUsage()
    const currentMB = usage.heapUsed / 1024 / 1024

    // Track peak
    this.peakMemoryMB = Math.max(this.peakMemoryMB, currentMB)

    return currentMB
  }

  /**
   * Build complete progress object
   */
  private buildProgress(): ImportProgress {
    const now = Date.now()
    const elapsed = now - this.startTime

    const stageProgress = this.calculateStageProgress()
    const overallProgress = this.calculateOverallProgress()
    const bytesPerSec = this.calculateBytesPerSecond()
    const entitiesPerSec = this.calculateEntitiesPerSecond()
    const entityEstimate = this.estimateTotalEntities()
    const remainingMs = this.estimateRemainingTime()
    const currentMemoryMB = this.getCurrentMemoryMB()

    // Determine overall status
    let overallStatus: ImportStatus
    if (overallProgress === 0) {
      overallStatus = 'starting'
    } else if (overallProgress === 100) {
      overallStatus = 'done'
    } else if (this.currentStage === 'completing') {
      overallStatus = 'completing'
    } else {
      overallStatus = 'processing'
    }

    // Stage message
    let stageMessage: string
    if (this.currentItem) {
      stageMessage = this.currentItem
    } else {
      // Default messages
      switch (this.currentStage) {
        case 'detecting':
          stageMessage = 'Detecting file format...'
          break
        case 'reading':
          stageMessage = 'Reading file...'
          break
        case 'parsing':
          stageMessage = 'Parsing file structure...'
          break
        case 'extracting':
          stageMessage = 'Extracting entities using AI...'
          break
        case 'indexing':
          stageMessage = 'Creating graph nodes...'
          break
        case 'completing':
          stageMessage = 'Finalizing import...'
          break
        default:
          stageMessage = 'Processing...'
      }
    }

    // Calculate bytes percentage
    const bytesPercentage = this.totalBytes > 0
      ? (this.bytesProcessed / this.totalBytes) * 100
      : 0

    // Build metrics object
    const metrics: ImportProgress['metrics'] = {
      parsing_rate_mbps: this.currentStage === 'parsing' && bytesPerSec
        ? bytesPerSec / 1_000_000
        : undefined,
      extraction_rate_entities_per_sec: this.currentStage === 'extracting'
        ? entitiesPerSec
        : undefined,
      indexing_rate_entities_per_sec: this.currentStage === 'indexing'
        ? entitiesPerSec
        : undefined,
      memory_usage_mb: currentMemoryMB,
      peak_memory_mb: this.peakMemoryMB > 0 ? this.peakMemoryMB : undefined
    }

    const progress: ImportProgress = {
      // Overall
      overall_progress: overallProgress,
      overall_status: overallStatus,

      // Stage
      stage: this.currentStage,
      stage_progress: stageProgress,
      stage_message: stageMessage,

      // Bytes
      bytes_processed: this.bytesProcessed,
      total_bytes: this.totalBytes,
      bytes_percentage: bytesPercentage,
      bytes_per_second: bytesPerSec,

      // Entities
      entities_extracted: this.entitiesExtracted,
      entities_indexed: this.entitiesIndexed,
      entities_per_second: entitiesPerSec,
      estimated_total_entities: entityEstimate?.count,
      estimation_confidence: entityEstimate?.confidence,

      // Timing
      elapsed_ms: elapsed,
      estimated_remaining_ms: remainingMs,
      estimated_total_ms: remainingMs ? elapsed + remainingMs : undefined,

      // Context
      current_item: this.currentItem,
      current_file: this.currentFile,
      file_number: this.fileNumber,
      total_files: this.totalFiles,

      // Metrics
      metrics,

      // Backwards compatibility
      current: this.entitiesIndexed,
      total: entityEstimate?.count ?? 0
    }

    return progress
  }

  /**
   * Emit progress (throttled)
   */
  private emit(force: boolean = false): void {
    if (!this.callback) return

    const now = Date.now()
    const timeSinceLastEmit = now - this.lastEmitTime

    // Throttle unless forced
    if (!force && timeSinceLastEmit < this.throttleMs) {
      return
    }

    const progress = this.buildProgress()

    // Handle both callback types (legacy and new)
    if (this.callback.length === 2) {
      // Legacy callback: (current, total) => void
      ;(this.callback as (current: number, total: number) => void)(
        progress.current,
        progress.total
      )
    } else {
      // New callback: (progress: ImportProgress) => void
      ;(this.callback as (progress: ImportProgress) => void)(progress)
    }

    this.lastEmitTime = now
  }

  /**
   * Force emit (for completion or critical updates)
   */
  forceEmit(): void {
    this.emit(true)
  }

  /**
   * Get current progress (without emitting)
   */
  getProgress(): ImportProgress {
    return this.buildProgress()
  }

  /**
   * Mark import as complete
   */
  complete(): ImportProgress {
    this.currentStage = 'completing'
    this.completedStages.add('completing')

    const progress = this.buildProgress()
    this.forceEmit()

    return progress
  }
}
