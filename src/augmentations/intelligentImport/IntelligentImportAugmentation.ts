/**
 * Intelligent Import Augmentation
 *
 * Automatically detects and processes CSV, Excel, and PDF files with:
 * - Format detection and routing
 * - Lazy-loaded handlers
 * - Intelligent entity and relationship extraction
 * - Integration with NeuralImport augmentation
 */

import { BaseAugmentation, AugmentationContext } from '../brainyAugmentation.js'
import { FormatHandler, IntelligentImportConfig, ProcessedData } from './types.js'
import { CSVHandler } from './handlers/csvHandler.js'
import { ExcelHandler } from './handlers/excelHandler.js'
import { PDFHandler } from './handlers/pdfHandler.js'
import { ImageHandler } from './handlers/imageHandler.js'

export class IntelligentImportAugmentation extends BaseAugmentation {
  readonly name = 'intelligent-import'
  readonly timing = 'before' as const
  readonly metadata = {
    reads: '*' as '*',
    writes: ['_intelligentImport', '_processedFormat', '_extractedData'] as string[]
  }
  readonly operations = ['import', 'importFile', 'importFromFile', 'importFromURL', 'all'] as any[]
  readonly priority = 75 // Before NeuralImport (80), after validation

  protected config: IntelligentImportConfig
  private handlers: Map<string, FormatHandler> = new Map()
  private initialized = false

  constructor(config: Partial<IntelligentImportConfig> = {}) {
    super(config)
    this.config = {
      enableCSV: true,
      enableExcel: true,
      enablePDF: true,
      enableImage: true, // v5.2.0: Image handler enabled by default
      maxFileSize: 100 * 1024 * 1024, // 100MB default
      enableCache: true,
      cacheTTL: 24 * 60 * 60 * 1000, // 24 hours
      ...config
    }
  }

  protected async onInitialize(): Promise<void> {
    // Initialize handlers based on config
    if (this.config.enableCSV) {
      this.handlers.set('csv', new CSVHandler())
    }

    if (this.config.enableExcel) {
      this.handlers.set('excel', new ExcelHandler())
    }

    if (this.config.enablePDF) {
      this.handlers.set('pdf', new PDFHandler())
    }

    if (this.config.enableImage) {
      this.handlers.set('image', new ImageHandler())
    }

    this.initialized = true
    this.log(`Initialized with ${this.handlers.size} format handlers (CSV: ${this.config.enableCSV}, Excel: ${this.config.enableExcel}, PDF: ${this.config.enablePDF}, Image: ${this.config.enableImage})`)
  }

  async execute<T = any>(
    operation: string,
    params: any,
    next: () => Promise<T>
  ): Promise<T> {
    // Only process import operations
    if (!this.shouldProcess(operation, params)) {
      return next()
    }

    try {
      // Extract file data from params
      const fileData = this.extractFileData(params)
      if (!fileData) {
        return next()
      }

      // Check file size limit
      if (this.config.maxFileSize && fileData.data.length > this.config.maxFileSize) {
        this.log(`File too large (${fileData.data.length} bytes), skipping intelligent import`, 'warn')
        return next()
      }

      // Detect format and get appropriate handler
      const handler = this.detectHandler(fileData.data, fileData.filename)
      if (!handler) {
        // Not a supported format, pass through
        return next()
      }

      this.log(`Processing ${fileData.filename || 'file'} with ${handler.format} handler`)

      // Process the file
      const processed = await handler.process(fileData.data, {
        filename: fileData.filename,
        ext: fileData.ext,
        ...this.config.csvDefaults,
        ...this.config.excelDefaults,
        ...this.config.pdfDefaults,
        ...this.config.imageDefaults,
        ...params.options
      })

      // Enrich params with processed data
      params._intelligentImport = true
      params._processedFormat = processed.format
      params._extractedData = processed.data
      params._metadata = {
        ...params._metadata,
        intelligentImport: processed.metadata
      }

      // If this is an import operation, transform params to include the structured data
      if (processed.data.length > 0) {
        // Store processed data for the neural import augmentation to use
        params.data = processed.data
        params.metadata = params._metadata
      }

      this.log(`Extracted ${processed.data.length} items from ${processed.format} file`)

      return next()
    } catch (error) {
      this.log(`Intelligent import processing failed: ${error instanceof Error ? error.message : String(error)}`, 'warn')
      // Fall through to normal import on error
      return next()
    }
  }

  /**
   * Check if we should process this operation
   */
  private shouldProcess(operation: string, params: any): boolean {
    // Only process if we have handlers initialized
    if (!this.initialized || this.handlers.size === 0) {
      return false
    }

    // Check operation type
    const validOps = ['import', 'importFile', 'importFromFile', 'importFromURL']
    if (!validOps.some(op => operation.includes(op))) {
      return false
    }

    // Must have some data
    if (!params || (!params.source && !params.data && !params.filePath && !params.url)) {
      return false
    }

    return true
  }

  /**
   * Extract file data from various param formats
   */
  private extractFileData(params: any): { data: Buffer, filename?: string, ext?: string } | null {
    // From source parameter
    if (params.source) {
      if (Buffer.isBuffer(params.source)) {
        return { data: params.source, filename: params.filename }
      }
      if (typeof params.source === 'string') {
        return { data: Buffer.from(params.source), filename: params.filename }
      }
    }

    // From data parameter
    if (params.data) {
      if (Buffer.isBuffer(params.data)) {
        return { data: params.data, filename: params.filename }
      }
      if (typeof params.data === 'string') {
        return { data: Buffer.from(params.data), filename: params.filename }
      }
    }

    // From file path (would need to read - but that should be handled by UniversalImportAPI)
    if (params.filePath && typeof params.filePath === 'string') {
      const ext = params.filePath.split('.').pop()
      return null // File reading handled elsewhere
    }

    return null
  }

  /**
   * Detect which handler can process this file
   */
  private detectHandler(data: Buffer, filename?: string): FormatHandler | null {
    // Try each handler's canHandle method
    for (const handler of this.handlers.values()) {
      if (handler.canHandle(data) || (filename && handler.canHandle({ filename }))) {
        return handler
      }
    }

    return null
  }

  /**
   * Get handler by format name
   */
  getHandler(format: string): FormatHandler | undefined {
    return this.handlers.get(format.toLowerCase())
  }

  /**
   * Get all registered handlers
   */
  getHandlers(): FormatHandler[] {
    return Array.from(this.handlers.values())
  }

  /**
   * Get supported formats
   */
  getSupportedFormats(): string[] {
    return Array.from(this.handlers.keys())
  }
}
