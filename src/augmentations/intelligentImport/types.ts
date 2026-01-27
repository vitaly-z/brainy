/**
 * Types for Intelligent Import Augmentation
 * Handles Excel, PDF, and CSV import with intelligent extraction
 */

import { ImportProgressTracker } from '../../utils/import-progress-tracker.js'

/**
 * Progress hooks for format handlers
 *
 * Handlers call these hooks to report progress during processing.
 * This enables real-time progress tracking for any file format.
 */
export interface FormatHandlerProgressHooks {
  /**
   * Report bytes processed
   * Call this as you read/parse the file
   */
  onBytesProcessed?: (bytes: number) => void

  /**
   * Set current processing context
   * Examples: "Processing page 5", "Reading sheet: Q2 Sales"
   */
  onCurrentItem?: (item: string) => void

  /**
   * Report structured data extraction progress
   * Examples: "Extracted 100 rows", "Parsed 50 paragraphs"
   */
  onDataExtracted?: (count: number, total?: number) => void
}

export interface FormatHandler {
  /**
   * Format name (e.g., 'csv', 'xlsx', 'pdf')
   */
  readonly format: string

  /**
   * Process raw data into structured format
   * @param data Raw file data (Buffer or string)
   * @param options Format-specific options
   * @returns Structured data ready for entity extraction
   */
  process(data: Buffer | string, options: FormatHandlerOptions): Promise<ProcessedData>

  /**
   * Detect if this handler can process the given data
   * @param data Raw data or filename
   * @returns true if handler supports this format
   */
  canHandle(data: Buffer | string | { filename?: string, ext?: string }): boolean
}

export interface FormatHandlerOptions {
  /** Source filename (for extension detection) */
  filename?: string

  /** File extension (if known) */
  ext?: string

  /** Encoding (auto-detected if not specified) */
  encoding?: string

  /** CSV-specific: delimiter character */
  csvDelimiter?: string

  /** CSV-specific: whether first row is headers */
  csvHeaders?: boolean

  /** Excel-specific: sheet names to extract (or 'all') */
  excelSheets?: string[] | 'all'

  /** Excel-specific: whether to evaluate formulas */
  excelEvaluateFormulas?: boolean

  /** PDF-specific: whether to extract tables */
  pdfExtractTables?: boolean

  /** PDF-specific: whether to preserve layout */
  pdfPreserveLayout?: boolean

  /** Maximum rows to process (for large files) */
  maxRows?: number

  /** Whether to stream large files */
  streaming?: boolean

  /**
   * Progress hooks
   * Handlers call these to report progress during processing
   */
  progressHooks?: FormatHandlerProgressHooks

  /**
   * Total file size in bytes
   * Used for progress percentage calculation
   */
  totalBytes?: number
}

export interface ProcessedData {
  /** Format that was processed */
  format: string

  /** Structured data (array of objects) */
  data: Array<Record<string, any>>

  /** Metadata about the processed data */
  metadata: {
    /** Number of rows/entities extracted */
    rowCount: number

    /** Column/field names */
    fields: string[]

    /** Detected encoding (for text formats) */
    encoding?: string

    /** Excel: sheet names */
    sheets?: string[]

    /** PDF: page count */
    pageCount?: number

    /** PDF: extracted text length */
    textLength?: number

    /** PDF: number of tables detected */
    tableCount?: number

    /** Processing time in milliseconds */
    processingTime: number

    /** Any warnings during processing */
    warnings?: string[]

    /** Format-specific metadata */
    [key: string]: any
  }

  /** Original filename (if available) */
  filename?: string
}

export interface HandlerRegistry {
  /** Registered handlers by format extension */
  handlers: Map<string, () => Promise<FormatHandler>>

  /** Loaded handler instances (lazy-loaded) */
  loaded: Map<string, FormatHandler>

  /** Register a new handler */
  register(extensions: string[], loader: () => Promise<FormatHandler>): void

  /** Get handler for a file/format */
  getHandler(filenameOrExt: string): Promise<FormatHandler | null>
}

export interface IntelligentImportConfig {
  /** Enable CSV handler */
  enableCSV: boolean

  /** Enable Excel handler */
  enableExcel: boolean

  /** Enable PDF handler */
  enablePDF: boolean

  /** Enable Image handler */
  enableImage: boolean

  /** Default options for CSV */
  csvDefaults?: Partial<FormatHandlerOptions>

  /** Default options for Excel */
  excelDefaults?: Partial<FormatHandlerOptions>

  /** Default options for PDF */
  pdfDefaults?: Partial<FormatHandlerOptions>

  /** Default options for Image */
  imageDefaults?: Partial<FormatHandlerOptions>

  /** Maximum file size to process (bytes) */
  maxFileSize?: number

  /** Enable caching of processed data */
  enableCache?: boolean

  /** Cache TTL in milliseconds */
  cacheTTL?: number
}
