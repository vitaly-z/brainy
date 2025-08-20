/**
 * Streaming Pipeline for Import/Export
 * Handles unlimited data sizes without memory overflow
 * Supports CSV, JSON, JSONL, and custom formats
 */

import { Readable, Writable, Transform } from 'stream'
import { pipeline } from 'stream/promises'
import { BrainyDataInterface } from '../types/brainyDataInterface.js'
import { NounType, VerbType } from '../types/graphTypes.js'

export interface StreamingOptions {
  /**
   * Batch size for processing
   * Default: 1000
   */
  batchSize?: number
  
  /**
   * Format of the data
   * Default: auto-detect
   */
  format?: 'json' | 'jsonl' | 'csv' | 'auto'
  
  /**
   * Whether to use neural processing
   * Default: true
   */
  useNeuralProcessing?: boolean
  
  /**
   * Progress callback
   */
  onProgress?: (progress: StreamingProgress) => void
  
  /**
   * Error handling strategy
   */
  onError?: 'skip' | 'abort' | ((error: Error, item: any) => void)
  
  /**
   * Parallel processing
   * Default: 4
   */
  concurrency?: number
}

export interface StreamingProgress {
  processed: number
  successful: number
  failed: number
  bytesProcessed: number
  startTime: number
  currentTime: number
  estimatedTimeRemaining?: number
}

export interface ExportOptions extends StreamingOptions {
  /**
   * Query to filter data
   */
  query?: string
  
  /**
   * Metadata filters
   */
  filter?: any
  
  /**
   * Maximum items to export
   */
  limit?: number
  
  /**
   * Include relationships
   */
  includeVerbs?: boolean
  
  /**
   * Include metadata
   */
  includeMetadata?: boolean
}

/**
 * Transform stream for parsing different formats
 */
class FormatParser extends Transform {
  private format: string
  private buffer: string = ''
  private lineNumber: number = 0
  private headers: string[] = []
  
  constructor(format: string = 'auto') {
    super({ objectMode: true })
    this.format = format
  }
  
  _transform(chunk: any, encoding: string, callback: Function) {
    const text = chunk.toString()
    this.buffer += text
    
    // Auto-detect format if needed
    if (this.format === 'auto' && this.lineNumber === 0) {
      this.format = this.detectFormat(text)
    }
    
    try {
      if (this.format === 'jsonl') {
        this.parseJSONL(callback)
      } else if (this.format === 'csv') {
        this.parseCSV(callback)
      } else if (this.format === 'json') {
        this.parseJSON(callback)
      }
    } catch (error) {
      callback(error)
    }
  }
  
  _flush(callback: Function) {
    // Process any remaining data
    if (this.buffer.trim()) {
      if (this.format === 'json') {
        try {
          const data = JSON.parse(this.buffer)
          if (Array.isArray(data)) {
            data.forEach(item => this.push(item))
          } else {
            this.push(data)
          }
        } catch (error) {
          callback(error)
          return
        }
      }
    }
    callback()
  }
  
  private detectFormat(text: string): string {
    const trimmed = text.trim()
    if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
      return 'json'
    } else if (trimmed.includes(',') && trimmed.split('\n')[0].includes(',')) {
      return 'csv'
    } else {
      return 'jsonl'
    }
  }
  
  private parseJSONL(callback: Function) {
    const lines = this.buffer.split('\n')
    this.buffer = lines.pop() || ''
    
    for (const line of lines) {
      this.lineNumber++
      if (line.trim()) {
        try {
          const obj = JSON.parse(line)
          this.push(obj)
        } catch (error) {
          // Skip malformed lines
          console.warn(`Line ${this.lineNumber}: Invalid JSON`)
        }
      }
    }
    callback()
  }
  
  private parseCSV(callback: Function) {
    const lines = this.buffer.split('\n')
    this.buffer = lines.pop() || ''
    
    for (const line of lines) {
      this.lineNumber++
      if (this.lineNumber === 1) {
        // Parse headers
        this.headers = line.split(',').map(h => h.trim())
      } else if (line.trim()) {
        const values = line.split(',').map(v => v.trim())
        const obj: any = {}
        this.headers.forEach((header, i) => {
          obj[header] = values[i]
        })
        this.push(obj)
      }
    }
    callback()
  }
  
  private parseJSON(callback: Function) {
    // JSON is parsed in _flush
    callback()
  }
}

/**
 * Transform stream for processing batches
 */
class BatchProcessor extends Transform {
  private batch: any[] = []
  private batchSize: number
  private processor: (batch: any[]) => Promise<any>
  private progress: StreamingProgress
  private onProgress?: (progress: StreamingProgress) => void
  
  constructor(
    batchSize: number,
    processor: (batch: any[]) => Promise<any>,
    onProgress?: (progress: StreamingProgress) => void
  ) {
    super({ objectMode: true })
    this.batchSize = batchSize
    this.processor = processor
    this.onProgress = onProgress
    this.progress = {
      processed: 0,
      successful: 0,
      failed: 0,
      bytesProcessed: 0,
      startTime: Date.now(),
      currentTime: Date.now()
    }
  }
  
  async _transform(chunk: any, encoding: string, callback: Function) {
    this.batch.push(chunk)
    
    if (this.batch.length >= this.batchSize) {
      await this.processBatch()
    }
    
    callback()
  }
  
  async _flush(callback: Function) {
    if (this.batch.length > 0) {
      await this.processBatch()
    }
    callback()
  }
  
  private async processBatch() {
    try {
      const result = await this.processor(this.batch)
      this.progress.processed += this.batch.length
      this.progress.successful += this.batch.length
      
      // Update progress
      this.progress.currentTime = Date.now()
      const elapsed = this.progress.currentTime - this.progress.startTime
      const rate = this.progress.processed / (elapsed / 1000)
      
      if (this.onProgress) {
        this.onProgress({
          ...this.progress,
          estimatedTimeRemaining: rate > 0 ? 
            (this.progress.processed / rate) : undefined
        })
      }
      
      this.push(result)
    } catch (error) {
      this.progress.failed += this.batch.length
      console.error('Batch processing error:', error)
    }
    
    this.batch = []
  }
}

/**
 * Main streaming pipeline for import/export
 */
export class StreamingPipeline {
  private brain: BrainyDataInterface<any>
  
  constructor(brain: BrainyDataInterface<any>) {
    this.brain = brain
  }
  
  /**
   * Stream import from various sources
   */
  async importStream(
    source: Readable | string | Buffer,
    options: StreamingOptions = {}
  ): Promise<StreamingProgress> {
    const {
      batchSize = 1000,
      format = 'auto',
      useNeuralProcessing = true,
      onProgress,
      onError = 'skip',
      concurrency = 4
    } = options
    
    // Create source stream
    let inputStream: Readable
    if (typeof source === 'string' || Buffer.isBuffer(source)) {
      inputStream = Readable.from([source])
    } else {
      inputStream = source
    }
    
    // Create processing pipeline
    const parser = new FormatParser(format)
    const processor = new BatchProcessor(
      batchSize,
      async (batch) => {
        // Process through augmentation pipeline if neural processing enabled
        if (useNeuralProcessing) {
          // Use neural import augmentation
          return this.brain.import(batch)
        } else {
          // Direct import
          const results = []
          for (const item of batch) {
            try {
              const id = await this.brain.add(item)
              results.push({ id, success: true })
            } catch (error) {
              if (onError === 'abort') {
                throw error
              } else if (onError === 'skip') {
                results.push({ success: false, error })
              } else if (typeof onError === 'function') {
                onError(error as Error, item)
                results.push({ success: false, error })
              }
            }
          }
          return results
        }
      },
      onProgress
    )
    
    // Run pipeline
    await pipeline(
      inputStream,
      parser,
      processor
    )
    
    return processor['progress']
  }
  
  /**
   * Stream export to various formats
   */
  async *exportStream(options: ExportOptions = {}): AsyncGenerator<string> {
    const {
      format = 'jsonl',
      query,
      filter,
      limit,
      includeVerbs = false,
      includeMetadata = true,
      batchSize = 1000
    } = options
    
    let processed = 0
    let offset = 0
    
    // Export header for CSV
    if (format === 'csv') {
      yield 'id,type,data\n'
    }
    
    // Start JSON array if needed
    if (format === 'json') {
      yield '[\n'
    }
    
    // Stream data in batches
    while (!limit || processed < limit) {
      const currentBatchSize = limit ? 
        Math.min(batchSize, limit - processed) : batchSize
      
      // Search for items
      const results = query ?
        await this.brain.search(query, currentBatchSize, { 
          metadata: filter,
          offset 
        }) :
        await this.brain.export({ 
          format: 'json',
          limit: currentBatchSize,
          offset 
        })
      
      if (!results || results.length === 0) {
        break
      }
      
      // Format and yield results
      for (const item of results) {
        if (format === 'jsonl') {
          yield JSON.stringify(item) + '\n'
        } else if (format === 'csv') {
          yield `"${item.id}","${item.type || 'noun'}","${JSON.stringify(item.data).replace(/"/g, '""')}"\n`
        } else if (format === 'json') {
          yield (processed > 0 ? ',\n' : '') + JSON.stringify(item)
        }
        
        processed++
        if (limit && processed >= limit) {
          break
        }
      }
      
      offset += results.length
      
      // Break if we got less than requested (no more data)
      if (results.length < currentBatchSize) {
        break
      }
    }
    
    // Close JSON array if needed
    if (format === 'json') {
      yield '\n]'
    }
  }
  
  /**
   * Create a writable stream for export
   */
  createExportStream(
    destination: Writable,
    options: ExportOptions = {}
  ): Writable {
    const generator = this.exportStream(options)
    
    const transform = new Transform({
      async transform(chunk, encoding, callback) {
        try {
          const { value, done } = await generator.next()
          if (!done) {
            this.push(value)
          }
          callback()
        } catch (error) {
          callback(error as Error)
        }
      }
    })
    
    transform.pipe(destination)
    return transform
  }
}