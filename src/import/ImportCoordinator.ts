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
import { VFSStructureGenerator } from '../importers/VFSStructureGenerator.js'
import { NounType, VerbType } from '../types/graphTypes.js'
import { v4 as uuidv4 } from '../universal/uuid.js'
import * as fs from 'fs'
import * as path from 'path'

export interface ImportSource {
  /** Source type */
  type: 'buffer' | 'path' | 'string' | 'object'

  /** Source data */
  data: Buffer | string | object

  /** Optional filename hint */
  filename?: string
}

export interface ImportOptions {
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

  /** Progress callback */
  onProgress?: (progress: ImportProgress) => void
}

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
   */
  async import(
    source: Buffer | string | object,
    options: ImportOptions = {}
  ): Promise<ImportResult> {
    const startTime = Date.now()
    const importId = uuidv4()

    // Normalize source
    const normalizedSource = this.normalizeSource(source, options.format)

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

    // Report extraction stage
    options.onProgress?.({
      stage: 'extracting',
      message: `Extracting entities from ${detection.format}...`
    })

    // Extract entities and relationships
    const extractionResult = await this.extract(normalizedSource, detection.format, options)

    // Set defaults
    const opts = {
      vfsPath: options.vfsPath || `/imports/${Date.now()}`,
      groupBy: options.groupBy || 'type',
      createEntities: options.createEntities !== false,
      createRelationships: options.createRelationships !== false,
      preserveSource: options.preserveSource !== false,
      enableDeduplication: options.enableDeduplication !== false,
      deduplicationThreshold: options.deduplicationThreshold || 0.85,
      ...options
    }

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
      createMetadataFile: true
    })

    // Report graph storage stage
    options.onProgress?.({
      stage: 'storing-graph',
      message: 'Creating knowledge graph...'
    })

    // Create entities and relationships in graph
    const graphResult = await this.createGraphEntities(normalizedResult, vfsResult, opts)

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
   */
  private normalizeSource(
    source: Buffer | string | object,
    formatHint?: SupportedFormat
  ): ImportSource {
    // Buffer
    if (Buffer.isBuffer(source)) {
      return {
        type: 'buffer',
        data: source
      }
    }

    // String - could be path or content
    if (typeof source === 'string') {
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

    throw new Error('Invalid source type. Expected Buffer, string, or object.')
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

      default:
        throw new Error(`Unsupported format: ${format}`)
    }
  }

  /**
   * Create entities and relationships in knowledge graph
   */
  private async createGraphEntities(
    extractionResult: any,
    vfsResult: any,
    options: ImportOptions
  ): Promise<{
    entities: Array<{ id: string; name: string; type: NounType; vfsPath?: string }>
    relationships: Array<{ id: string; from: string; to: string; type: VerbType }>
    merged: number
    newEntities: number
  }> {
    const entities: Array<{ id: string; name: string; type: NounType; vfsPath?: string }> = []
    const relationships: Array<{ id: string; from: string; to: string; type: VerbType }> = []
    let mergedCount = 0
    let newCount = 0

    if (!options.createEntities) {
      return { entities, relationships, merged: 0, newEntities: 0 }
    }

    // Extract rows/sections/entities from result (unified across formats)
    const rows = extractionResult.rows || extractionResult.sections || extractionResult.entities || []

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
                importedFrom: 'import-coordinator'
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
              importedAt: Date.now(),
              importedFrom: 'import-coordinator',
              imports: [importSource]
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
                      importedAt: Date.now()
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
                metadata: {
                  confidence: rel.confidence,
                  evidence: rel.evidence,
                  importedAt: Date.now()
                }
              } as any)
            } catch (error) {
              // Skip relationship collection errors (entity might not exist, etc.)
              continue
            }
          }
        }
      } catch (error) {
        // Skip entity creation errors (might already exist, etc.)
        continue
      }
    }

    // Batch create all relationships using brain.relateMany() for performance
    if (options.createRelationships && relationships.length > 0) {
      try {
        const relationshipParams = relationships.map(rel => ({
          from: rel.from,
          to: rel.to,
          type: rel.type,
          metadata: (rel as any).metadata
        }))

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
      newEntities: newCount
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

    // Fallback: return as-is
    return result
  }
}
