/**
 * Import Coordinator
 *
 * Unified import orchestrator that:
 * - Auto-detects file formats
 * - Routes to appropriate handlers
 * - Coordinates dual storage (VFS + Graph)
 * - Provides simple, unified API
 *
 * NO MOCKS - Production-ready implementation
 */

import { Brainy } from '../brainy.js'
import { FormatDetector, SupportedFormat } from './FormatDetector.js'
import { EntityDeduplicator } from './EntityDeduplicator.js'
import { ImportHistory } from './ImportHistory.js'
import { SmartExcelImporter } from '../importers/SmartExcelImporter.js'
import { SmartPDFImporter } from '../importers/SmartPDFImporter.js'
import { SmartCSVImporter } from '../importers/SmartCSVImporter.js'
import { SmartJSONImporter } from '../importers/SmartJSONImporter.js'
import { SmartMarkdownImporter } from '../importers/SmartMarkdownImporter.js'
import { SmartYAMLImporter } from '../importers/SmartYAMLImporter.js'
import { SmartDOCXImporter } from '../importers/SmartDOCXImporter.js'
import { VFSStructureGenerator } from '../importers/VFSStructureGenerator.js'
import { NounType, VerbType } from '../types/graphTypes.js'
import { v4 as uuidv4 } from '../universal/uuid.js'
import * as fs from 'fs'
import * as path from 'path'

export interface ImportSource {
  /** Source type */
  type: 'buffer' | 'path' | 'string' | 'object' | 'url'

  /** Source data */
  data: Buffer | string | object

  /** Optional filename hint */
  filename?: string

  /** HTTP headers for URL imports (v4.2.0) */
  headers?: Record<string, string>

  /** Basic authentication for URL imports (v4.2.0) */
  auth?: {
    username: string
    password: string
  }
}

/**
 * Tracking context for import operations
 * Contains metadata that should be attached to all created entities/relationships
 */
export interface TrackingContext {
  /** Unique identifier for this import operation */
  importId: string

  /** Project identifier grouping related imports */
  projectId: string

  /** Timestamp when import started */
  importedAt: number

  /** Format of imported data */
  importFormat: string

  /** Source filename or URL */
  importSource: string

  /** Custom metadata from user */
  customMetadata: Record<string, any>
}

/**
 * Valid import options for v4.x
 */
export interface ValidImportOptions {
  /** Force specific format (skip auto-detection) */
  format?: SupportedFormat

  /** VFS root path for imported files */
  vfsPath?: string

  /** Grouping strategy for VFS */
  groupBy?: 'type' | 'sheet' | 'flat' | 'custom'

  /** Custom grouping function */
  customGrouping?: (entity: any) => string

  /** Create entities in knowledge graph */
  createEntities?: boolean

  /** Create relationships in knowledge graph */
  createRelationships?: boolean

  /** Create provenance relationships (document → entity) [v4.9.0] */
  createProvenanceLinks?: boolean

  /** Preserve source file in VFS */
  preserveSource?: boolean

  /** Enable neural entity extraction */
  enableNeuralExtraction?: boolean

  /** Enable relationship inference */
  enableRelationshipInference?: boolean

  /** Enable concept extraction */
  enableConceptExtraction?: boolean

  /** Confidence threshold for entities */
  confidenceThreshold?: number

  /** Enable entity deduplication across imports */
  enableDeduplication?: boolean

  /** Similarity threshold for deduplication (0-1) */
  deduplicationThreshold?: number

  /** Enable import history tracking */
  enableHistory?: boolean

  /** Chunk size for streaming large imports (0 = no streaming) */
  chunkSize?: number

  /**
   * Unique identifier for this import operation (auto-generated if not provided)
   * Used to track all entities/relationships created in this import
   * Note: Entities can belong to multiple imports (stored as array)
   */
  importId?: string

  /**
   * Project identifier (user-specified or derived from vfsPath)
   * Groups multiple imports under a common project
   * If not specified, defaults to sanitized vfsPath
   */
  projectId?: string

  /**
   * Custom metadata to attach to all created entities
   * Merged with import/project tracking metadata
   */
  customMetadata?: Record<string, any>

  /**
   * Progress callback for tracking import progress (v4.2.0+)
   *
   * **Streaming Architecture** (always enabled):
   * - Indexes are flushed periodically during import (adaptive intervals)
   * - Data is queryable progressively as import proceeds
   * - `progress.queryable` is `true` after each flush
   * - Provides crash resilience and live monitoring
   *
   * **Adaptive Flush Intervals**:
   * - <1K entities: Flush every 100 entities (max 10 flushes)
   * - 1K-10K entities: Flush every 1000 entities (10-100 flushes)
   * - >10K entities: Flush every 5000 entities (low overhead)
   *
   * **Performance**:
   * - Flush overhead: ~5-50ms per flush (~0.3% total time)
   * - No configuration needed - works optimally out of the box
   *
   * @example
   * ```typescript
   * // Monitor import progress with live queries
   * await brain.import(file, {
   *   onProgress: async (progress) => {
   *     console.log(`${progress.processed}/${progress.total}`)
   *
   *     // Query data as it's imported!
   *     if (progress.queryable) {
   *       const count = await brain.count({ type: 'Product' })
   *       console.log(`${count} products imported so far`)
   *     }
   *   }
   * })
   * ```
   */
  onProgress?: (progress: ImportProgress) => void | Promise<void>
}

/**
 * Deprecated import options from v3.x
 * Using these will cause TypeScript compile errors
 *
 * @deprecated These options are no longer supported in v4.x
 * @see {@link https://brainy.dev/docs/guides/migrating-to-v4 Migration Guide}
 */
export interface DeprecatedImportOptions {
  /**
   * @deprecated Use `enableRelationshipInference` instead
   * @see {@link https://brainy.dev/docs/guides/migrating-to-v4 Migration Guide}
   */
  extractRelationships?: never

  /**
   * @deprecated Removed in v4.x - auto-detection is now always enabled
   * @see {@link https://brainy.dev/docs/guides/migrating-to-v4 Migration Guide}
   */
  autoDetect?: never

  /**
   * @deprecated Use `vfsPath` to specify the directory path instead
   * @see {@link https://brainy.dev/docs/guides/migrating-to-v4 Migration Guide}
   */
  createFileStructure?: never

  /**
   * @deprecated Removed in v4.x - all sheets are now processed automatically
   * @see {@link https://brainy.dev/docs/guides/migrating-to-v4 Migration Guide}
   */
  excelSheets?: never

  /**
   * @deprecated Removed in v4.x - table extraction is now automatic for PDF imports
   * @see {@link https://brainy.dev/docs/guides/migrating-to-v4 Migration Guide}
   */
  pdfExtractTables?: never
}

/**
 * Complete import options interface
 * Combines valid v4.x options with deprecated v3.x options (which cause TypeScript errors)
 */
export type ImportOptions = ValidImportOptions & DeprecatedImportOptions

export interface ImportProgress {
  stage: 'detecting' | 'extracting' | 'storing-vfs' | 'storing-graph' | 'relationships' | 'complete'
  /** Phase of import - extraction or relationship building (v3.49.0) */
  phase?: 'extraction' | 'relationships'
  message: string
  processed?: number
  /** Alias for processed, used in relationship phase (v3.49.0) */
  current?: number
  total?: number
  entities?: number
  relationships?: number
  /** Rows per second (v3.38.0) */
  throughput?: number
  /** Estimated time remaining in ms (v3.38.0) */
  eta?: number
  /**
   * Whether data is queryable at this point (v4.2.0+)
   *
   * When true, indexes have been flushed and queries will return up-to-date results.
   * When false, data exists in storage but indexes may not be current (queries may be slower/incomplete).
   *
   * Only present during streaming imports with flushInterval > 0.
   */
  queryable?: boolean
}

export interface ImportResult {
  /** Import ID for history tracking */
  importId: string

  /** Detected format */
  format: SupportedFormat

  /** Format detection confidence */
  formatConfidence: number

  /** VFS paths created */
  vfs: {
    rootPath: string
    directories: string[]
    files: Array<{
      path: string
      entityId?: string
      type: 'entity' | 'metadata' | 'source' | 'relationships'
    }>
  }

  /** Knowledge graph entities created */
  entities: Array<{
    id: string
    name: string
    type: NounType
    vfsPath?: string
  }>

  /** Knowledge graph relationships created */
  relationships: Array<{
    id: string
    from: string
    to: string
    type: VerbType
  }>

  /** Import statistics */
  stats: {
    entitiesExtracted: number
    relationshipsInferred: number
    vfsFilesCreated: number
    graphNodesCreated: number
    graphEdgesCreated: number
    entitiesMerged: number
    entitiesNew: number
    processingTime: number
  }
}

/**
 * ImportCoordinator - Main entry point for all imports
 */
export class ImportCoordinator {
  private brain: Brainy
  private detector: FormatDetector
  private deduplicator: EntityDeduplicator
  private history: ImportHistory
  private excelImporter: SmartExcelImporter
  private pdfImporter: SmartPDFImporter
  private csvImporter: SmartCSVImporter
  private jsonImporter: SmartJSONImporter
  private markdownImporter: SmartMarkdownImporter
  private yamlImporter: SmartYAMLImporter
  private docxImporter: SmartDOCXImporter
  private vfsGenerator: VFSStructureGenerator

  constructor(brain: Brainy) {
    this.brain = brain
    this.detector = new FormatDetector()
    this.deduplicator = new EntityDeduplicator(brain)
    this.history = new ImportHistory(brain)
    this.excelImporter = new SmartExcelImporter(brain)
    this.pdfImporter = new SmartPDFImporter(brain)
    this.csvImporter = new SmartCSVImporter(brain)
    this.jsonImporter = new SmartJSONImporter(brain)
    this.markdownImporter = new SmartMarkdownImporter(brain)
    this.yamlImporter = new SmartYAMLImporter(brain)
    this.docxImporter = new SmartDOCXImporter(brain)
    this.vfsGenerator = new VFSStructureGenerator(brain)
  }

  /**
   * Initialize all importers
   */
  async init(): Promise<void> {
    await this.excelImporter.init()
    await this.pdfImporter.init()
    await this.csvImporter.init()
    await this.jsonImporter.init()
    await this.markdownImporter.init()
    await this.yamlImporter.init()
    await this.docxImporter.init()
    await this.vfsGenerator.init()
    await this.history.init()
  }

  /**
   * Get import history
   */
  getHistory() {
    return this.history
  }

  /**
   * Import from any source with auto-detection
   * v4.2.0: Now supports URL imports with authentication
   */
  async import(
    source: Buffer | string | object | ImportSource,
    options: ImportOptions = {}
  ): Promise<ImportResult> {
    const startTime = Date.now()

    // Validate options (v4.0.0+: Reject deprecated v3.x options)
    this.validateOptions(options)

    // Normalize source (v4.2.0: handles URL fetching)
    const normalizedSource = await this.normalizeSource(source, options.format)

    // Report detection stage
    options.onProgress?.({
      stage: 'detecting',
      message: 'Detecting format...'
    })

    // Detect format
    const detection = options.format
      ? { format: options.format, confidence: 1.0, evidence: ['Explicitly specified'] }
      : this.detectFormat(normalizedSource)

    if (!detection) {
      throw new Error('Unable to detect file format. Please specify format explicitly.')
    }

    // Set defaults early (needed for tracking context)
    // CRITICAL FIX (v4.3.2): Spread options FIRST, then apply defaults
    // Previously: ...options at the end overwrote normalized defaults with undefined
    // Now: Defaults properly override undefined values
    // v4.4.0: Enable AI features by default for smarter imports
    const opts = {
      ...options,  // Spread first to get all options
      vfsPath: options.vfsPath || `/imports/${Date.now()}`,
      groupBy: options.groupBy || 'type',
      createEntities: options.createEntities !== false,
      createRelationships: options.createRelationships !== false,
      preserveSource: options.preserveSource !== false,
      enableDeduplication: options.enableDeduplication !== false,
      enableNeuralExtraction: options.enableNeuralExtraction !== false,  // v4.4.0: Default true
      enableRelationshipInference: options.enableRelationshipInference !== false,  // v4.4.0: Default true
      enableConceptExtraction: options.enableConceptExtraction !== false,  // Already defaults to true
      deduplicationThreshold: options.deduplicationThreshold || 0.85
    }

    // Generate tracking context (v4.10.0+: Unified import/project tracking)
    const importId = options.importId || uuidv4()
    const projectId = options.projectId || this.deriveProjectId(opts.vfsPath)
    const trackingContext: TrackingContext = {
      importId,
      projectId,
      importedAt: Date.now(),
      importFormat: detection.format,
      importSource: normalizedSource.filename || 'unknown',
      customMetadata: options.customMetadata || {}
    }

    // Report extraction stage
    options.onProgress?.({
      stage: 'extracting',
      message: `Extracting entities from ${detection.format}...`
    })

    // Extract entities and relationships
    const extractionResult = await this.extract(normalizedSource, detection.format, options)

    // Report VFS storage stage
    options.onProgress?.({
      stage: 'storing-vfs',
      message: 'Creating VFS structure...'
    })

    // Normalize extraction result to unified format
    const normalizedResult = this.normalizeExtractionResult(extractionResult, detection.format)

    // Create VFS structure
    const vfsResult = await this.vfsGenerator.generate(normalizedResult, {
      rootPath: opts.vfsPath,
      groupBy: opts.groupBy,
      customGrouping: opts.customGrouping,
      preserveSource: opts.preserveSource,
      sourceBuffer: normalizedSource.type === 'buffer' ? normalizedSource.data as Buffer : undefined,
      sourceFilename: normalizedSource.filename || `import.${detection.format}`,
      createRelationshipFile: true,
      createMetadataFile: true,
      trackingContext  // v4.10.0: Pass tracking metadata to VFS
    })

    // Report graph storage stage
    options.onProgress?.({
      stage: 'storing-graph',
      message: 'Creating knowledge graph...'
    })

    // Create entities and relationships in graph
    const graphResult = await this.createGraphEntities(
      normalizedResult,
      vfsResult,
      opts,
      {
        sourceFilename: normalizedSource.filename || `import.${detection.format}`,
        format: detection.format
      },
      trackingContext  // v4.10.0: Pass tracking metadata to graph creation
    )

    // Report complete
    options.onProgress?.({
      stage: 'complete',
      message: 'Import complete',
      entities: graphResult.entities.length,
      relationships: graphResult.relationships.length
    })

    const result: ImportResult = {
      importId,
      format: detection.format,
      formatConfidence: detection.confidence,
      vfs: {
        rootPath: vfsResult.rootPath,
        directories: vfsResult.directories,
        files: vfsResult.files
      },
      entities: graphResult.entities,
      relationships: graphResult.relationships,
      stats: {
        entitiesExtracted: extractionResult.entitiesExtracted,
        relationshipsInferred: extractionResult.relationshipsInferred,
        vfsFilesCreated: vfsResult.files.length,
        graphNodesCreated: graphResult.entities.length,
        graphEdgesCreated: graphResult.relationships.length,
        entitiesMerged: graphResult.merged || 0,
        entitiesNew: graphResult.newEntities || 0,
        processingTime: Date.now() - startTime
      }
    }

    // Record in history if enabled
    if (options.enableHistory !== false) {
      await this.history.recordImport(
        importId,
        {
          type: normalizedSource.type === 'path' ? 'file' : normalizedSource.type as any,
          filename: normalizedSource.filename,
          format: detection.format
        },
        result
      )
    }

    // CRITICAL FIX (v3.43.2): Auto-flush all indexes before returning
    // Ensures imported data survives server restarts
    // Bug #5: Import data was only in memory, lost on restart
    options.onProgress?.({
      stage: 'complete',
      message: 'Flushing indexes to disk...'
    })

    await this.brain.flush()

    return result
  }

  /**
   * Normalize source to ImportSource
   * v4.2.0: Now async to support URL fetching
   */
  private async normalizeSource(
    source: Buffer | string | object | ImportSource,
    formatHint?: SupportedFormat
  ): Promise<ImportSource> {
    // If already an ImportSource, handle URL fetching if needed
    if (this.isImportSource(source)) {
      if (source.type === 'url') {
        return await this.fetchUrl(source)
      }
      return source
    }

    // Buffer
    if (Buffer.isBuffer(source)) {
      return {
        type: 'buffer',
        data: source
      }
    }

    // String - could be URL, path, or content
    if (typeof source === 'string') {
      // Check if it's a URL
      if (this.isUrl(source)) {
        return await this.fetchUrl({
          type: 'url',
          data: source
        })
      }

      // Check if it's a file path
      if (this.isFilePath(source)) {
        const buffer = fs.readFileSync(source)
        return {
          type: 'path',
          data: buffer,
          filename: path.basename(source)
        }
      }

      // Otherwise treat as content
      return {
        type: 'string',
        data: source
      }
    }

    // Object
    if (typeof source === 'object' && source !== null) {
      return {
        type: 'object',
        data: source
      }
    }

    throw new Error('Invalid source type. Expected Buffer, string, object, or ImportSource.')
  }

  /**
   * Check if value is an ImportSource object
   */
  private isImportSource(value: any): value is ImportSource {
    return value && typeof value === 'object' && 'type' in value && 'data' in value
  }

  /**
   * Check if string is a URL
   */
  private isUrl(str: string): boolean {
    try {
      const url = new URL(str)
      return url.protocol === 'http:' || url.protocol === 'https:'
    } catch {
      return false
    }
  }

  /**
   * Fetch content from URL
   * v4.2.0: Supports authentication and custom headers
   */
  private async fetchUrl(source: ImportSource): Promise<ImportSource> {
    const url = typeof source.data === 'string' ? source.data : String(source.data)

    // Build headers
    const headers: Record<string, string> = {
      'User-Agent': 'Brainy/4.2.0',
      ...(source.headers || {})
    }

    // Add basic auth if provided
    if (source.auth) {
      const credentials = Buffer.from(`${source.auth.username}:${source.auth.password}`).toString('base64')
      headers['Authorization'] = `Basic ${credentials}`
    }

    try {
      const response = await fetch(url, { headers })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      // Get filename from URL or Content-Disposition header
      const contentDisposition = response.headers.get('content-disposition')
      let filename = source.filename
      if (contentDisposition) {
        const match = contentDisposition.match(/filename=["']?([^"';]+)["']?/)
        if (match) filename = match[1]
      }
      if (!filename) {
        filename = new URL(url).pathname.split('/').pop() || 'download'
      }

      // Get content type for format hint
      const contentType = response.headers.get('content-type')

      // Convert response to buffer
      const arrayBuffer = await response.arrayBuffer()
      const buffer = Buffer.from(arrayBuffer)

      return {
        type: 'buffer',
        data: buffer,
        filename,
        headers: { 'content-type': contentType || 'application/octet-stream' }
      }
    } catch (error: any) {
      throw new Error(`Failed to fetch URL ${url}: ${error.message}`)
    }
  }

  /**
   * Check if string is a file path
   */
  private isFilePath(str: string): boolean {
    // Check if file exists
    try {
      return fs.existsSync(str) && fs.statSync(str).isFile()
    } catch {
      return false
    }
  }

  /**
   * Detect format from source
   */
  private detectFormat(source: ImportSource): { format: SupportedFormat; confidence: number; evidence: string[] } | null {
    switch (source.type) {
      case 'buffer':
      case 'path':
        const buffer = source.data as Buffer
        let result = this.detector.detectFromBuffer(buffer)

        // Try filename hint if buffer detection fails
        if (!result && source.filename) {
          result = this.detector.detectFromPath(source.filename)
        }

        return result

      case 'string':
        return this.detector.detectFromString(source.data as string)

      case 'object':
        return this.detector.detectFromObject(source.data)

      case 'url':
        // URL sources are converted to buffers in normalizeSource()
        // This should never be reached, but included for type safety
        return null

      default:
        return null
    }
  }

  /**
   * Extract entities using format-specific importer
   */
  private async extract(
    source: ImportSource,
    format: SupportedFormat,
    options: ImportOptions
  ): Promise<any> {
    const extractOptions = {
      enableNeuralExtraction: options.enableNeuralExtraction !== false,
      enableRelationshipInference: options.enableRelationshipInference !== false,
      enableConceptExtraction: options.enableConceptExtraction !== false,
      confidenceThreshold: options.confidenceThreshold || 0.6,
      onProgress: (stats: any) => {
        // Enhanced progress reporting (v3.38.0) with throughput and ETA
        const message = stats.throughput
          ? `Extracting entities from ${format} (${stats.throughput} rows/sec, ETA: ${Math.round(stats.eta / 1000)}s)...`
          : `Extracting entities from ${format}...`

        options.onProgress?.({
          stage: 'extracting',
          message,
          processed: stats.processed,
          total: stats.total,
          entities: stats.entities,
          relationships: stats.relationships,
          // Pass through enhanced metrics if available
          throughput: stats.throughput,
          eta: stats.eta
        })
      }
    }

    switch (format) {
      case 'excel':
        const buffer = source.type === 'buffer' || source.type === 'path'
          ? source.data as Buffer
          : Buffer.from(JSON.stringify(source.data))
        return await this.excelImporter.extract(buffer, extractOptions)

      case 'pdf':
        const pdfBuffer = source.data as Buffer
        return await this.pdfImporter.extract(pdfBuffer, extractOptions)

      case 'csv':
        const csvBuffer = source.type === 'buffer' || source.type === 'path'
          ? source.data as Buffer
          : Buffer.from(source.data as string)
        return await this.csvImporter.extract(csvBuffer, extractOptions)

      case 'json':
        const jsonData = source.type === 'object'
          ? source.data
          : source.type === 'string'
            ? source.data as string
            : (source.data as Buffer).toString('utf8')
        return await this.jsonImporter.extract(jsonData, extractOptions)

      case 'markdown':
        const mdContent = source.type === 'string'
          ? source.data as string
          : (source.data as Buffer).toString('utf8')
        return await this.markdownImporter.extract(mdContent, extractOptions)

      case 'yaml':
        const yamlContent = source.type === 'string'
          ? source.data as string
          : source.type === 'buffer' || source.type === 'path'
            ? (source.data as Buffer).toString('utf8')
            : JSON.stringify(source.data)
        return await this.yamlImporter.extract(yamlContent, extractOptions)

      case 'docx':
        const docxBuffer = source.type === 'buffer' || source.type === 'path'
          ? source.data as Buffer
          : Buffer.from(JSON.stringify(source.data))
        return await this.docxImporter.extract(docxBuffer, extractOptions)

      default:
        throw new Error(`Unsupported format: ${format}`)
    }
  }

  /**
   * Create entities and relationships in knowledge graph
   * v4.9.0: Added sourceInfo parameter for document entity creation
   */
  private async createGraphEntities(
    extractionResult: any,
    vfsResult: any,
    options: ImportOptions,
    sourceInfo?: {
      sourceFilename: string
      format: string
    },
    trackingContext?: TrackingContext  // v4.10.0: Import/project tracking
  ): Promise<{
    entities: Array<{ id: string; name: string; type: NounType; vfsPath?: string }>
    relationships: Array<{ id: string; from: string; to: string; type: VerbType }>
    merged: number
    newEntities: number
    documentEntity?: string
    provenanceCount?: number
  }> {
    const entities: Array<{ id: string; name: string; type: NounType; vfsPath?: string }> = []
    const relationships: Array<{ id: string; from: string; to: string; type: VerbType }> = []
    let mergedCount = 0
    let newCount = 0

    // CRITICAL FIX (v4.3.2): Default to true when undefined
    // Previously: if (!options.createEntities) treated undefined as false
    // Now: Only skip when explicitly set to false
    if (options.createEntities === false) {
      return {
        entities,
        relationships,
        merged: 0,
        newEntities: 0,
        documentEntity: undefined,
        provenanceCount: 0
      }
    }

    // Extract rows/sections/entities from result (unified across formats)
    const rows = extractionResult.rows || extractionResult.sections || extractionResult.entities || []

    // Progressive flush interval - adjusts based on current count (v4.2.0+)
    // Starts at 100, increases to 1000 at 1K entities, then 5000 at 10K
    // This works for both known totals (files) and unknown totals (streaming APIs)
    let currentFlushInterval = 100  // Start with frequent updates for better UX
    let entitiesSinceFlush = 0
    let totalFlushes = 0

    console.log(
      `📊 Streaming Import: Progressive flush intervals\n` +
      `   Starting interval: Every ${currentFlushInterval} entities\n` +
      `   Auto-adjusts: 100 → 1000 (at 1K entities) → 5000 (at 10K entities)\n` +
      `   Benefits: Live queries, crash resilience, frequent early updates\n` +
      `   Works with: Known totals (files) and unknown totals (streaming APIs)`
    )

    // Smart deduplication auto-disable for large imports (prevents O(n²) performance)
    const DEDUPLICATION_AUTO_DISABLE_THRESHOLD = 100
    let actuallyEnableDeduplication = options.enableDeduplication

    if (options.enableDeduplication && rows.length > DEDUPLICATION_AUTO_DISABLE_THRESHOLD) {
      actuallyEnableDeduplication = false
      console.log(
        `📊 Smart Import: Auto-disabled deduplication for large import (${rows.length} entities > ${DEDUPLICATION_AUTO_DISABLE_THRESHOLD} threshold)\n` +
        `   Reason: Deduplication performs O(n²) vector searches which is too slow for large datasets\n` +
        `   Tip: For large imports, deduplicate manually after import or use smaller batches\n` +
        `   Override: Set deduplicationThreshold to force enable (not recommended for >500 entities)`
      )
    }

    // ============================================
    // v4.9.0: Create document entity for import source
    // ============================================
    let documentEntityId: string | null = null
    let provenanceCount = 0

    if (sourceInfo && options.createProvenanceLinks !== false) {
      console.log(`📄 Creating document entity for import source: ${sourceInfo.sourceFilename}`)

      documentEntityId = await this.brain.add({
        data: sourceInfo.sourceFilename,
        type: NounType.Document,
        metadata: {
          name: sourceInfo.sourceFilename,
          sourceFile: sourceInfo.sourceFilename,
          format: sourceInfo.format,
          importSource: true,
          vfsPath: vfsResult.rootPath,
          totalRows: rows.length,
          byType: this.countByType(rows),
          // v4.10.0: Import tracking metadata
          ...(trackingContext && {
            importIds: [trackingContext.importId],
            projectId: trackingContext.projectId,
            importedAt: trackingContext.importedAt,
            importFormat: trackingContext.importFormat,
            importSource: trackingContext.importSource,
            ...trackingContext.customMetadata
          })
        }
      })

      console.log(`✅ Document entity created: ${documentEntityId}`)
    }

    // Create entities in graph
    for (const row of rows) {
      const entity = row.entity || row

      // Find corresponding VFS file
      const vfsFile = vfsResult.files.find((f: any) => f.entityId === entity.id)

      // Create or merge entity
      try {
        const importSource = vfsResult.rootPath

        let entityId: string
        let wasMerged = false

        if (actuallyEnableDeduplication) {
          // Use deduplicator to check for existing entities
          const mergeResult = await this.deduplicator.createOrMerge(
            {
              id: entity.id,
              name: entity.name,
              type: entity.type,
              description: entity.description || entity.name,
              confidence: entity.confidence,
              metadata: {
                ...entity.metadata,
                vfsPath: vfsFile?.path,
                importedFrom: 'import-coordinator',
                // v4.10.0: Import tracking metadata
                ...(trackingContext && {
                  importIds: [trackingContext.importId],
                  projectId: trackingContext.projectId,
                  importedAt: trackingContext.importedAt,
                  importFormat: trackingContext.importFormat,
                  importSource: trackingContext.importSource,
                  sourceRow: row.rowNumber,
                  sourceSheet: row.sheet,
                  ...trackingContext.customMetadata
                })
              }
            },
            importSource,
            {
              similarityThreshold: options.deduplicationThreshold || 0.85,
              strictTypeMatching: true,
              enableFuzzyMatching: true
            }
          )

          entityId = mergeResult.mergedEntityId
          wasMerged = mergeResult.wasMerged

          if (wasMerged) {
            mergedCount++
          } else {
            newCount++
          }
        } else {
          // Direct creation without deduplication
          entityId = await this.brain.add({
            data: entity.description || entity.name,
            type: entity.type,
            metadata: {
              ...entity.metadata,
              name: entity.name,
              confidence: entity.confidence,
              vfsPath: vfsFile?.path,
              importedFrom: 'import-coordinator',
              imports: [importSource],
              // v4.10.0: Import tracking metadata
              ...(trackingContext && {
                importIds: [trackingContext.importId],
                projectId: trackingContext.projectId,
                importedAt: trackingContext.importedAt,
                importFormat: trackingContext.importFormat,
                importSource: trackingContext.importSource,
                sourceRow: row.rowNumber,
                sourceSheet: row.sheet,
                ...trackingContext.customMetadata
              })
            }
          })
          newCount++
        }

        // Update entity ID in extraction result
        entity.id = entityId

        entities.push({
          id: entityId,
          name: entity.name,
          type: entity.type,
          vfsPath: vfsFile?.path
        })

        // ============================================
        // v4.9.0: Create provenance relationship (document → entity)
        // ============================================
        if (documentEntityId && options.createProvenanceLinks !== false) {
          await this.brain.relate({
            from: documentEntityId,
            to: entityId,
            type: VerbType.Contains,
            metadata: {
              relationshipType: 'provenance',
              evidence: `Extracted from ${sourceInfo?.sourceFilename}`,
              sheet: row.sheet,
              rowNumber: row.rowNumber,
              extractedAt: Date.now(),
              format: sourceInfo?.format,
              // v4.10.0: Import tracking metadata
              ...(trackingContext && {
                importIds: [trackingContext.importId],
                projectId: trackingContext.projectId,
                createdAt: Date.now(),
                importFormat: trackingContext.importFormat,
                ...trackingContext.customMetadata
              })
            }
          })
          provenanceCount++
        }

        // Collect relationships for batch creation
        if (options.createRelationships && row.relationships) {
          for (const rel of row.relationships) {
            try {
              // CRITICAL FIX (v3.43.2): Prevent infinite placeholder creation loop
              // Find or create target entity using EXACT matching only
              let targetEntityId: string | undefined

              // STEP 1: Check if target already exists in entities list (includes placeholders)
              // This prevents creating duplicate placeholders - the root cause of Bug #1
              const existingTarget = entities.find(e =>
                e.name.toLowerCase() === rel.to.toLowerCase()
              )

              if (existingTarget) {
                targetEntityId = existingTarget.id
              } else {
                // STEP 2: Try to find in extraction results (rows)
                // FIX: Use EXACT matching instead of fuzzy .includes()
                // Fuzzy matching caused false matches (e.g., "Entity_29" matching "Entity_297")
                for (const otherRow of rows) {
                  const otherEntity = otherRow.entity || otherRow
                  if (otherEntity.name.toLowerCase() === rel.to.toLowerCase()) {
                    targetEntityId = otherEntity.id
                    break
                  }
                }

                // STEP 3: If still not found, create placeholder entity ONCE
                // The placeholder is added to entities array, so future searches will find it
                if (!targetEntityId) {
                  targetEntityId = await this.brain.add({
                    data: rel.to,
                    type: NounType.Thing,
                    metadata: {
                      name: rel.to,
                      placeholder: true,
                      inferredFrom: entity.name,
                      // v4.10.0: Import tracking metadata
                      ...(trackingContext && {
                        importIds: [trackingContext.importId],
                        projectId: trackingContext.projectId,
                        importedAt: trackingContext.importedAt,
                        importFormat: trackingContext.importFormat,
                        ...trackingContext.customMetadata
                      })
                    }
                  })

                  // CRITICAL: Add to entities array so future searches find it
                  entities.push({
                    id: targetEntityId,
                    name: rel.to,
                    type: NounType.Thing
                  })
                }
              }

              // Add to relationships array with target ID for batch processing
              relationships.push({
                id: '', // Will be assigned after batch creation
                from: entityId,
                to: targetEntityId,
                type: rel.type,
                confidence: rel.confidence, // v4.2.0: Top-level field
                weight: rel.weight || 1.0,  // v4.2.0: Top-level field
                metadata: {
                  evidence: rel.evidence,
                  // v4.10.0: Import tracking metadata (will be merged in batch creation)
                  ...(trackingContext && {
                    importIds: [trackingContext.importId],
                    projectId: trackingContext.projectId,
                    importedAt: trackingContext.importedAt,
                    importFormat: trackingContext.importFormat,
                    ...trackingContext.customMetadata
                  })
                }
              } as any)
            } catch (error) {
              // Skip relationship collection errors (entity might not exist, etc.)
              continue
            }
          }
        }

        // Streaming import: Progressive flush with dynamic interval adjustment (v4.2.0+)
        entitiesSinceFlush++

        if (entitiesSinceFlush >= currentFlushInterval) {
          const flushStart = Date.now()
          await this.brain.flush()
          const flushDuration = Date.now() - flushStart
          totalFlushes++

          // Reset counter
          entitiesSinceFlush = 0

          // Recalculate flush interval based on current entity count
          const newInterval = this.getProgressiveFlushInterval(entities.length)
          if (newInterval !== currentFlushInterval) {
            console.log(
              `📊 Flush interval adjusted: ${currentFlushInterval} → ${newInterval}\n` +
              `   Reason: Reached ${entities.length} entities (threshold for next tier)\n` +
              `   Impact: ${newInterval > currentFlushInterval ? 'Fewer' : 'More'} flushes = ${newInterval > currentFlushInterval ? 'Better performance' : 'More frequent updates'}`
            )
            currentFlushInterval = newInterval
          }

          // Notify progress callback that data is now queryable
          await options.onProgress?.({
            stage: 'storing-graph',
            message: `Flushed indexes (${entities.length}/${rows.length} entities, ${flushDuration}ms)`,
            processed: entities.length,
            total: rows.length,
            entities: entities.length,
            queryable: true  // ← Indexes are flushed, data is queryable!
          })
        }
      } catch (error) {
        // Skip entity creation errors (might already exist, etc.)
        continue
      }
    }

    // Final flush for any remaining entities
    if (entitiesSinceFlush > 0) {
      const flushStart = Date.now()
      await this.brain.flush()
      const flushDuration = Date.now() - flushStart
      totalFlushes++

      console.log(
        `✅ Import complete: ${entities.length} entities processed\n` +
        `   Total flushes: ${totalFlushes}\n` +
        `   Final flush: ${flushDuration}ms\n` +
        `   Average overhead: ~${((totalFlushes * 50) / (entities.length * 100) * 100).toFixed(2)}%`
      )

      await options.onProgress?.({
        stage: 'storing-graph',
        message: `Final flush complete (${entities.length} entities)`,
        processed: entities.length,
        total: rows.length,
        entities: entities.length,
        queryable: true
      })
    }

    // Batch create all relationships using brain.relateMany() for performance
    // v4.9.0: Enhanced with type-based inference and semantic metadata
    if (options.createRelationships && relationships.length > 0) {
      try {
        const relationshipParams = relationships.map(rel => {
          // Get entity types for inference
          const sourceEntity = entities.find(e => e.id === rel.from)
          const targetEntity = entities.find(e => e.id === rel.to)

          // Infer better relationship type if generic and we have entity types
          let verbType = rel.type
          if (verbType === VerbType.RelatedTo && sourceEntity && targetEntity) {
            verbType = this.inferRelationshipType(
              sourceEntity.type,
              targetEntity.type,
              (rel as any).metadata?.evidence
            )
          }

          return {
            from: rel.from,
            to: rel.to,
            type: verbType,  // Enhanced type
            metadata: {
              ...((rel as any).metadata || {}),
              relationshipType: 'semantic',  // v4.9.0: Distinguish from VFS/provenance
              inferredType: verbType !== rel.type,  // Track if type was enhanced
              originalType: rel.type
            }
          }
        })

        const relationshipIds = await this.brain.relateMany({
          items: relationshipParams,
          parallel: true,
          chunkSize: 100,
          continueOnError: true,
          onProgress: (done, total) => {
            options.onProgress?.({
              stage: 'storing-graph',
              phase: 'relationships',
              message: `Building relationships: ${done}/${total}`,
              current: done,
              processed: done,
              total: total,
              entities: entities.length,
              relationships: done
            })
          }
        })

        // Update relationship IDs
        relationshipIds.forEach((id, index) => {
          if (id && relationships[index]) {
            relationships[index].id = id
          }
        })
      } catch (error) {
        console.warn('Error creating relationships in batch:', error)
        // Continue - relationships are optional
      }
    }

    return {
      entities,
      relationships,
      merged: mergedCount,
      newEntities: newCount,
      documentEntity: documentEntityId || undefined,
      provenanceCount
    }
  }

  /**
   * Normalize extraction result to unified format (Excel-like structure)
   */
  private normalizeExtractionResult(result: any, format: SupportedFormat): any {
    // Excel and CSV already have the right format
    if (format === 'excel' || format === 'csv') {
      return result
    }

    // PDF: sections -> rows
    if (format === 'pdf') {
      const rows = result.sections.flatMap((section: any) =>
        section.entities.map((entity: any) => ({
          entity,
          relatedEntities: [],
          relationships: section.relationships.filter((r: any) => r.from === entity.id),
          concepts: section.concepts || []
        }))
      )

      return {
        rowsProcessed: result.sectionsProcessed,
        entitiesExtracted: result.entitiesExtracted,
        relationshipsInferred: result.relationshipsInferred,
        rows,
        entityMap: result.entityMap,
        processingTime: result.processingTime,
        stats: result.stats
      }
    }

    // JSON: entities -> rows
    if (format === 'json') {
      const rows = result.entities.map((entity: any) => ({
        entity,
        relatedEntities: [],
        relationships: result.relationships.filter((r: any) => r.from === entity.id),
        concepts: entity.metadata?.concepts || []
      }))

      return {
        rowsProcessed: result.nodesProcessed,
        entitiesExtracted: result.entitiesExtracted,
        relationshipsInferred: result.relationshipsInferred,
        rows,
        entityMap: result.entityMap,
        processingTime: result.processingTime,
        stats: result.stats
      }
    }

    // Markdown: sections -> rows
    if (format === 'markdown') {
      const rows = result.sections.flatMap((section: any) =>
        section.entities.map((entity: any) => ({
          entity,
          relatedEntities: [],
          relationships: section.relationships.filter((r: any) => r.from === entity.id),
          concepts: section.concepts || []
        }))
      )

      return {
        rowsProcessed: result.sectionsProcessed,
        entitiesExtracted: result.entitiesExtracted,
        relationshipsInferred: result.relationshipsInferred,
        rows,
        entityMap: result.entityMap,
        processingTime: result.processingTime,
        stats: result.stats
      }
    }

    // YAML: entities -> rows (v4.2.0)
    if (format === 'yaml') {
      const rows = result.entities.map((entity: any) => ({
        entity,
        relatedEntities: [],
        relationships: result.relationships.filter((r: any) => r.from === entity.id),
        concepts: entity.metadata?.concepts || []
      }))

      return {
        rowsProcessed: result.nodesProcessed,
        entitiesExtracted: result.entitiesExtracted,
        relationshipsInferred: result.relationshipsInferred,
        rows,
        entityMap: result.entityMap,
        processingTime: result.processingTime,
        stats: result.stats
      }
    }

    // DOCX: entities -> rows (v4.2.0)
    if (format === 'docx') {
      const rows = result.entities.map((entity: any) => ({
        entity,
        relatedEntities: [],
        relationships: result.relationships.filter((r: any) => r.from === entity.id),
        concepts: entity.metadata?.concepts || []
      }))

      return {
        rowsProcessed: result.paragraphsProcessed,
        entitiesExtracted: result.entitiesExtracted,
        relationshipsInferred: result.relationshipsInferred,
        rows,
        entityMap: result.entityMap,
        processingTime: result.processingTime,
        stats: result.stats
      }
    }

    // Fallback: return as-is
    return result
  }

  /**
   * Validate options and reject deprecated v3.x options (v4.0.0+)
   * Throws clear errors with migration guidance
   */
  private validateOptions(options: any): void {
    const invalidOptions: Array<{ old: string; new: string; message: string }> = []

    // Check for v3.x deprecated options
    if ('extractRelationships' in options) {
      invalidOptions.push({
        old: 'extractRelationships',
        new: 'enableRelationshipInference',
        message: 'Option renamed for clarity in v4.x - explicitly indicates AI-powered relationship inference'
      })
    }

    if ('autoDetect' in options) {
      invalidOptions.push({
        old: 'autoDetect',
        new: '(removed)',
        message: 'Auto-detection is now always enabled - no need to specify this option'
      })
    }

    if ('createFileStructure' in options) {
      invalidOptions.push({
        old: 'createFileStructure',
        new: 'vfsPath',
        message: 'Use vfsPath to explicitly specify the virtual filesystem directory path'
      })
    }

    if ('excelSheets' in options) {
      invalidOptions.push({
        old: 'excelSheets',
        new: '(removed)',
        message: 'All sheets are now processed automatically - no configuration needed'
      })
    }

    if ('pdfExtractTables' in options) {
      invalidOptions.push({
        old: 'pdfExtractTables',
        new: '(removed)',
        message: 'Table extraction is now automatic for PDF imports'
      })
    }

    // If invalid options found, throw error with detailed message
    if (invalidOptions.length > 0) {
      const errorMessage = this.buildValidationErrorMessage(invalidOptions)
      throw new Error(errorMessage)
    }
  }

  /**
   * Build detailed error message for invalid options
   * Respects LOG_LEVEL for verbosity (detailed in dev, concise in prod)
   */
  private buildValidationErrorMessage(
    invalidOptions: Array<{ old: string; new: string; message: string }>
  ): string {
    // Check environment for verbosity level
    const verbose =
      process.env.LOG_LEVEL === 'debug' ||
      process.env.LOG_LEVEL === 'verbose' ||
      process.env.NODE_ENV === 'development' ||
      process.env.NODE_ENV === 'dev'

    if (verbose) {
      // DETAILED mode (development)
      const optionDetails = invalidOptions
        .map(
          (opt) => `
  ❌ ${opt.old}
     → Use: ${opt.new}
     → Why: ${opt.message}`
        )
        .join('\n')

      return `
❌ Invalid import options detected (Brainy v4.x breaking changes)

The following v3.x options are no longer supported:
${optionDetails}

📖 Migration Guide: https://brainy.dev/docs/guides/migrating-to-v4
💡 Quick Fix Examples:

   Before (v3.x):
   await brain.import(file, {
     extractRelationships: true,
     createFileStructure: true
   })

   After (v4.x):
   await brain.import(file, {
     enableRelationshipInference: true,
     vfsPath: '/imports/my-data'
   })

🔗 Full API docs: https://brainy.dev/docs/api/import
      `.trim()
    } else {
      // CONCISE mode (production)
      const optionsList = invalidOptions.map((o) => `'${o.old}'`).join(', ')
      return `Invalid import options: ${optionsList}. See https://brainy.dev/docs/guides/migrating-to-v4`
    }
  }

  /**
   * Derive project ID from VFS path
   * Extracts meaningful project name from path, avoiding timestamps
   *
   * Examples:
   * - /imports/myproject → "myproject"
   * - /imports/2024-01-15/myproject → "myproject"
   * - /imports/1234567890 → "import_1234567890"
   * - /my-game/characters → "my-game"
   *
   * @param vfsPath - VFS path to derive project ID from
   * @returns Derived project identifier
   */
  private deriveProjectId(vfsPath: string): string {
    // Extract meaningful project name from vfsPath
    const segments = vfsPath.split('/').filter(s => s.length > 0)

    if (segments.length === 0) {
      return 'default_project'
    }

    // If path starts with /imports/, look for meaningful segment
    if (segments[0] === 'imports') {
      if (segments.length === 1) {
        return 'default_project'
      }

      const lastSegment = segments[segments.length - 1]

      // If last segment looks like a timestamp, use parent
      if (/^\d{4}-\d{2}-\d{2}$/.test(lastSegment) || /^\d{10,}$/.test(lastSegment)) {
        // Use parent segment if available
        if (segments.length >= 3) {
          return segments[segments.length - 2]
        }
        return `import_${lastSegment}`
      }

      return lastSegment
    }

    // For non-/imports/ paths, use first segment as project
    return segments[0]
  }

  /**
   * Get progressive flush interval based on CURRENT entity count (v4.2.0+)
   *
   * Unlike adaptive intervals (which require knowing total count upfront),
   * progressive intervals adjust dynamically as import proceeds.
   *
   * Thresholds:
   * - 0-999 entities:   Flush every 100   (frequent updates for better UX)
   * - 1K-9.9K entities: Flush every 1000  (balanced performance/responsiveness)
   * - 10K+ entities:    Flush every 5000  (performance focused, minimal overhead)
   *
   * Benefits:
   * - Works with known totals (file imports)
   * - Works with unknown totals (streaming APIs, database cursors)
   * - Frequent updates early when user is watching
   * - Efficient processing later when performance matters
   * - Low overhead (~0.3% for large imports)
   * - No configuration required
   *
   * Example:
   * - Import with 50K entities:
   *   - Flushes at: 100, 200, ..., 900 (9 flushes with interval=100)
   *   - Interval increases to 1000 at entity #1000
   *   - Flushes at: 1000, 2000, ..., 9000 (9 more flushes)
   *   - Interval increases to 5000 at entity #10000
   *   - Flushes at: 10000, 15000, ..., 50000 (8 more flushes)
   *   - Total: ~26 flushes = ~1.3s overhead = 0.026% of import time
   *
   * @param currentEntityCount - Current number of entities imported so far
   * @returns Current optimal flush interval
   */
  private getProgressiveFlushInterval(currentEntityCount: number): number {
    if (currentEntityCount < 1000) {
      return 100  // Frequent updates for small imports and early stages
    } else if (currentEntityCount < 10000) {
      return 1000 // Balanced interval for medium-sized imports
    } else {
      return 5000 // Performance-focused interval for large imports
    }
  }

  /**
   * Infer relationship type based on entity types and context
   * v4.9.0: Semantic relationship enhancement
   *
   * @param sourceType - Type of source entity
   * @param targetType - Type of target entity
   * @param context - Optional context string for additional hints
   * @returns Inferred verb type
   */
  private inferRelationshipType(
    sourceType: NounType,
    targetType: NounType,
    context?: string
  ): VerbType {
    // Context-based inference (highest priority)
    if (context) {
      const lowerContext = context.toLowerCase()
      if (lowerContext.includes('live') || lowerContext.includes('reside') || lowerContext.includes('dwell')) {
        return VerbType.LocatedAt
      }
      if (lowerContext.includes('create') || lowerContext.includes('invent') || lowerContext.includes('make')) {
        return VerbType.Creates
      }
      if (lowerContext.includes('own') || lowerContext.includes('possess') || lowerContext.includes('belong')) {
        return VerbType.PartOf
      }
      if (lowerContext.includes('work') || lowerContext.includes('collaborate') || lowerContext.includes('team')) {
        return VerbType.WorksWith
      }
      if (lowerContext.includes('use') || lowerContext.includes('wield') || lowerContext.includes('employ')) {
        return VerbType.Uses
      }
      if (lowerContext.includes('know') || lowerContext.includes('friend') || lowerContext.includes('ally')) {
        return VerbType.FriendOf
      }
    }

    // Type-based inference (fallback)
    // Sort types for consistent lookup
    const sortedTypes = [sourceType, targetType].sort()
    const typeKey = `${sortedTypes[0]}+${sortedTypes[1]}`

    const typeMapping: Record<string, VerbType> = {
      // Person relationships
      [`${NounType.Person}+${NounType.Location}`]: VerbType.LocatedAt,
      [`${NounType.Person}+${NounType.Thing}`]: VerbType.Uses,
      [`${NounType.Person}+${NounType.Person}`]: VerbType.FriendOf,
      [`${NounType.Person}+${NounType.Concept}`]: VerbType.RelatedTo,
      [`${NounType.Person}+${NounType.Event}`]: VerbType.RelatedTo,

      // Location relationships
      [`${NounType.Location}+${NounType.Thing}`]: VerbType.Contains,
      [`${NounType.Location}+${NounType.Concept}`]: VerbType.RelatedTo,
      [`${NounType.Location}+${NounType.Event}`]: VerbType.LocatedAt,

      // Thing relationships
      [`${NounType.Thing}+${NounType.Concept}`]: VerbType.RelatedTo,
      [`${NounType.Thing}+${NounType.Event}`]: VerbType.RelatedTo,

      // Concept relationships
      [`${NounType.Concept}+${NounType.Concept}`]: VerbType.RelatedTo,
      [`${NounType.Concept}+${NounType.Event}`]: VerbType.RelatedTo,

      // Event relationships
      [`${NounType.Event}+${NounType.Event}`]: VerbType.Precedes
    }

    return typeMapping[typeKey] || VerbType.RelatedTo
  }

  /**
   * Count entities by type for document metadata
   * v4.9.0: Used for document entity statistics
   *
   * @param rows - Extracted rows from import
   * @returns Record of entity type counts
   */
  private countByType(rows: any[]): Record<string, number> {
    const counts: Record<string, number> = {}
    for (const row of rows) {
      const entity = row.entity || row
      const type = entity.type || NounType.Thing
      counts[type] = (counts[type] || 0) + 1
    }
    return counts
  }
}
