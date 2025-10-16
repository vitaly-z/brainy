/**
 * Smart Import Orchestrator
 *
 * Coordinates the entire smart import pipeline:
 * 1. Extract entities/relationships using SmartExcelImporter
 * 2. Create entities and relationships in Brainy
 * 3. Organize into VFS structure using VFSStructureGenerator
 *
 * NO MOCKS - Production-ready implementation
 */

import { Brainy } from '../brainy.js'
import { VirtualFileSystem } from '../vfs/VirtualFileSystem.js'
import { NounType, VerbType } from '../types/graphTypes.js'
import { SmartExcelImporter, SmartExcelOptions, SmartExcelResult } from './SmartExcelImporter.js'
import { SmartPDFImporter, SmartPDFOptions, SmartPDFResult } from './SmartPDFImporter.js'
import { SmartCSVImporter, SmartCSVOptions, SmartCSVResult } from './SmartCSVImporter.js'
import { SmartJSONImporter, SmartJSONOptions, SmartJSONResult } from './SmartJSONImporter.js'
import { SmartMarkdownImporter, SmartMarkdownOptions, SmartMarkdownResult } from './SmartMarkdownImporter.js'
import { VFSStructureGenerator, VFSStructureOptions } from './VFSStructureGenerator.js'

export interface SmartImportOptions extends SmartExcelOptions {
  /** Create VFS structure */
  createVFSStructure?: boolean

  /** VFS root path */
  vfsRootPath?: string

  /** VFS grouping strategy */
  vfsGroupBy?: 'type' | 'sheet' | 'flat' | 'custom'

  /** Create entities in Brainy */
  createEntities?: boolean

  /** Create relationships in Brainy */
  createRelationships?: boolean

  /** Source filename */
  filename?: string
}

export interface SmartImportProgress {
  phase: 'parsing' | 'extracting' | 'creating' | 'relationships' | 'organizing' | 'complete'
  message: string
  processed: number
  total: number
  entities: number
  relationships: number
}

export interface SmartImportResult {
  success: boolean

  /** Extraction results */
  extraction: SmartExcelResult

  /** Created entity IDs */
  entityIds: string[]

  /** Created relationship IDs */
  relationshipIds: string[]

  /** VFS structure created */
  vfsStructure?: {
    rootPath: string
    directories: string[]
    files: number
  }

  /** Overall statistics */
  stats: {
    rowsProcessed: number
    entitiesCreated: number
    relationshipsCreated: number
    filesCreated: number
    totalTime: number
  }

  /** Any errors encountered */
  errors: string[]
}

/**
 * SmartImportOrchestrator - Main entry point for smart imports
 */
export class SmartImportOrchestrator {
  private brain: Brainy
  private excelImporter: SmartExcelImporter
  private pdfImporter: SmartPDFImporter
  private csvImporter: SmartCSVImporter
  private jsonImporter: SmartJSONImporter
  private markdownImporter: SmartMarkdownImporter
  private vfsGenerator: VFSStructureGenerator

  constructor(brain: Brainy) {
    this.brain = brain
    this.excelImporter = new SmartExcelImporter(brain)
    this.pdfImporter = new SmartPDFImporter(brain)
    this.csvImporter = new SmartCSVImporter(brain)
    this.jsonImporter = new SmartJSONImporter(brain)
    this.markdownImporter = new SmartMarkdownImporter(brain)
    this.vfsGenerator = new VFSStructureGenerator(brain)
  }

  /**
   * Initialize the orchestrator
   */
  async init(): Promise<void> {
    await this.excelImporter.init()
    await this.pdfImporter.init()
    await this.csvImporter.init()
    await this.jsonImporter.init()
    await this.markdownImporter.init()
    await this.vfsGenerator.init()
  }

  /**
   * Import Excel file with full pipeline
   */
  async importExcel(
    buffer: Buffer,
    options: SmartImportOptions = {},
    onProgress?: (progress: SmartImportProgress) => void
  ): Promise<SmartImportResult> {
    const startTime = Date.now()
    const result: SmartImportResult = {
      success: false,
      extraction: null as any,
      entityIds: [],
      relationshipIds: [],
      stats: {
        rowsProcessed: 0,
        entitiesCreated: 0,
        relationshipsCreated: 0,
        filesCreated: 0,
        totalTime: 0
      },
      errors: []
    }

    try {
      // Phase 1: Extract entities and relationships
      onProgress?.({
        phase: 'extracting',
        message: 'Extracting entities and relationships...',
        processed: 0,
        total: 0,
        entities: 0,
        relationships: 0
      })

      result.extraction = await this.excelImporter.extract(buffer, {
        ...options,
        onProgress: (stats) => {
          onProgress?.({
            phase: 'extracting',
            message: `Processing row ${stats.processed}/${stats.total}...`,
            processed: stats.processed,
            total: stats.total,
            entities: stats.entities,
            relationships: stats.relationships
          })
        }
      })

      result.stats.rowsProcessed = result.extraction.rowsProcessed

      // Phase 2: Create entities in Brainy
      if (options.createEntities !== false) {
        onProgress?.({
          phase: 'creating',
          message: 'Creating entities in knowledge graph...',
          processed: 0,
          total: result.extraction.rows.length,
          entities: 0,
          relationships: 0
        })

        for (let i = 0; i < result.extraction.rows.length; i++) {
          const extracted = result.extraction.rows[i]

          try {
            // Create main entity
            const entityId = await this.brain.add({
              data: extracted.entity.description,
              type: extracted.entity.type,
              metadata: {
                ...extracted.entity.metadata,
                name: extracted.entity.name,
                confidence: extracted.entity.confidence,
                importedFrom: 'smart-import'
              }
            })

            result.entityIds.push(entityId)
            result.stats.entitiesCreated++

            // Update entity ID in extraction result
            extracted.entity.id = entityId

            onProgress?.({
              phase: 'creating',
              message: `Created entity: ${extracted.entity.name}`,
              processed: i + 1,
              total: result.extraction.rows.length,
              entities: result.entityIds.length,
              relationships: result.relationshipIds.length
            })
          } catch (error: any) {
            result.errors.push(`Failed to create entity ${extracted.entity.name}: ${error.message}`)
          }
        }
      }

      // Phase 3: Create relationships
      if (options.createRelationships !== false && options.createEntities !== false) {
        onProgress?.({
          phase: 'creating',
          message: 'Preparing relationships...',
          processed: 0,
          total: result.extraction.rows.length,
          entities: result.entityIds.length,
          relationships: 0
        })

        // Build entity name -> ID map
        const entityMap = new Map<string, string>()
        for (const extracted of result.extraction.rows) {
          entityMap.set(extracted.entity.name.toLowerCase(), extracted.entity.id)
        }

        // Collect all relationship parameters
        const relationshipParams: Array<{from: string; to: string; type: VerbType; metadata?: any}> = []

        for (const extracted of result.extraction.rows) {
          for (const rel of extracted.relationships) {
            try {
              // Find target entity ID
              let toEntityId: string | undefined

              // Try to find by name in our extracted entities
              for (const otherExtracted of result.extraction.rows) {
                if (rel.to.toLowerCase().includes(otherExtracted.entity.name.toLowerCase()) ||
                    otherExtracted.entity.name.toLowerCase().includes(rel.to.toLowerCase())) {
                  toEntityId = otherExtracted.entity.id
                  break
                }
              }

              // If not found, create a placeholder entity
              if (!toEntityId) {
                toEntityId = await this.brain.add({
                  data: rel.to,
                  type: NounType.Thing,
                  metadata: {
                    name: rel.to,
                    placeholder: true,
                    extractedFrom: extracted.entity.name
                  }
                })
                result.entityIds.push(toEntityId)
              }

              // Collect relationship parameter
              relationshipParams.push({
                from: extracted.entity.id,
                to: toEntityId,
                type: rel.type,
                metadata: {
                  confidence: rel.confidence,
                  evidence: rel.evidence
                }
              })
            } catch (error: any) {
              result.errors.push(`Failed to prepare relationship: ${error.message}`)
            }
          }
        }

        // Batch create all relationships with progress
        if (relationshipParams.length > 0) {
          onProgress?.({
            phase: 'relationships',
            message: 'Building relationships...',
            processed: 0,
            total: relationshipParams.length,
            entities: result.entityIds.length,
            relationships: 0
          })

          try {
            const relationshipIds = await this.brain.relateMany({
              items: relationshipParams,
              parallel: true,
              chunkSize: 100,
              continueOnError: true,
              onProgress: (done, total) => {
                onProgress?.({
                  phase: 'relationships',
                  message: `Building relationships: ${done}/${total}`,
                  processed: done,
                  total: total,
                  entities: result.entityIds.length,
                  relationships: done
                })
              }
            })

            result.relationshipIds = relationshipIds
            result.stats.relationshipsCreated = relationshipIds.length
          } catch (error: any) {
            result.errors.push(`Failed to create relationships: ${error.message}`)
          }
        }
      }

      // Phase 4: Create VFS structure
      if (options.createVFSStructure !== false) {
        onProgress?.({
          phase: 'organizing',
          message: 'Organizing into file structure...',
          processed: 0,
          total: result.extraction.rows.length,
          entities: result.entityIds.length,
          relationships: result.relationshipIds.length
        })

        const vfsOptions: VFSStructureOptions = {
          rootPath: options.vfsRootPath || '/imports/' + (options.filename || 'import'),
          groupBy: options.vfsGroupBy || 'type',
          preserveSource: true,
          sourceBuffer: buffer,
          sourceFilename: options.filename || 'import.xlsx',
          createRelationshipFile: true,
          createMetadataFile: true
        }

        const vfsResult = await this.vfsGenerator.generate(result.extraction, vfsOptions)

        result.vfsStructure = {
          rootPath: vfsResult.rootPath,
          directories: vfsResult.directories,
          files: vfsResult.files.length
        }

        result.stats.filesCreated = vfsResult.files.length
      }

      // Complete
      result.success = result.errors.length === 0
      result.stats.totalTime = Date.now() - startTime

      onProgress?.({
        phase: 'complete',
        message: `Import complete: ${result.stats.entitiesCreated} entities, ${result.stats.relationshipsCreated} relationships`,
        processed: result.extraction.rows.length,
        total: result.extraction.rows.length,
        entities: result.stats.entitiesCreated,
        relationships: result.stats.relationshipsCreated
      })

    } catch (error: any) {
      result.errors.push(`Import failed: ${error.message}`)
      result.success = false
    }

    return result
  }

  /**
   * Import PDF file with full pipeline
   */
  async importPDF(
    buffer: Buffer,
    options: SmartImportOptions & SmartPDFOptions = {},
    onProgress?: (progress: SmartImportProgress) => void
  ): Promise<SmartImportResult> {
    const startTime = Date.now()
    const result: SmartImportResult = {
      success: false,
      extraction: null as any,
      entityIds: [],
      relationshipIds: [],
      stats: {
        rowsProcessed: 0,
        entitiesCreated: 0,
        relationshipsCreated: 0,
        filesCreated: 0,
        totalTime: 0
      },
      errors: []
    }

    try {
      // Phase 1: Extract from PDF
      onProgress?.({ phase: 'extracting', message: 'Extracting from PDF...', processed: 0, total: 0, entities: 0, relationships: 0 })

      const pdfResult = await this.pdfImporter.extract(buffer, options)

      // Convert PDF result to Excel-like format for processing
      result.extraction = this.convertPDFToExcelFormat(pdfResult) as any
      result.stats.rowsProcessed = pdfResult.sectionsProcessed

      // Phase 2 & 3: Create entities and relationships
      await this.createEntitiesAndRelationships(result, options, onProgress)

      // Phase 4: Create VFS structure
      if (options.createVFSStructure !== false) {
        const vfsOptions: VFSStructureOptions = {
          rootPath: options.vfsRootPath || '/imports/' + (options.filename || 'import'),
          groupBy: options.vfsGroupBy || 'type',
          preserveSource: true,
          sourceBuffer: buffer,
          sourceFilename: options.filename || 'import.pdf',
          createRelationshipFile: true,
          createMetadataFile: true
        }
        const vfsResult = await this.vfsGenerator.generate(result.extraction, vfsOptions)
        result.vfsStructure = { rootPath: vfsResult.rootPath, directories: vfsResult.directories, files: vfsResult.files.length }
        result.stats.filesCreated = vfsResult.files.length
      }

      result.success = result.errors.length === 0
      result.stats.totalTime = Date.now() - startTime
      onProgress?.({ phase: 'complete', message: `Import complete: ${result.stats.entitiesCreated} entities, ${result.stats.relationshipsCreated} relationships`, processed: result.stats.rowsProcessed, total: result.stats.rowsProcessed, entities: result.stats.entitiesCreated, relationships: result.stats.relationshipsCreated })

    } catch (error: any) {
      result.errors.push(`PDF import failed: ${error.message}`)
      result.success = false
    }

    return result
  }

  /**
   * Import CSV file with full pipeline
   */
  async importCSV(
    buffer: Buffer,
    options: SmartImportOptions & SmartCSVOptions = {},
    onProgress?: (progress: SmartImportProgress) => void
  ): Promise<SmartImportResult> {
    // CSV is very similar to Excel, can reuse importExcel logic
    return this.importExcel(buffer, options, onProgress)
  }

  /**
   * Import JSON data with full pipeline
   */
  async importJSON(
    data: any,
    options: SmartImportOptions & SmartJSONOptions = {},
    onProgress?: (progress: SmartImportProgress) => void
  ): Promise<SmartImportResult> {
    const startTime = Date.now()
    const result: SmartImportResult = {
      success: false,
      extraction: null as any,
      entityIds: [],
      relationshipIds: [],
      stats: {
        rowsProcessed: 0,
        entitiesCreated: 0,
        relationshipsCreated: 0,
        filesCreated: 0,
        totalTime: 0
      },
      errors: []
    }

    try {
      onProgress?.({ phase: 'extracting', message: 'Extracting from JSON...', processed: 0, total: 0, entities: 0, relationships: 0 })

      const jsonResult = await this.jsonImporter.extract(data, options)

      result.extraction = this.convertJSONToExcelFormat(jsonResult) as any
      result.stats.rowsProcessed = jsonResult.nodesProcessed

      await this.createEntitiesAndRelationships(result, options, onProgress)

      if (options.createVFSStructure !== false) {
        const sourceBuffer = Buffer.from(typeof data === 'string' ? data : JSON.stringify(data, null, 2))
        const vfsOptions: VFSStructureOptions = {
          rootPath: options.vfsRootPath || '/imports/' + (options.filename || 'import'),
          groupBy: options.vfsGroupBy || 'type',
          preserveSource: true,
          sourceBuffer,
          sourceFilename: options.filename || 'import.json',
          createRelationshipFile: true,
          createMetadataFile: true
        }
        const vfsResult = await this.vfsGenerator.generate(result.extraction, vfsOptions)
        result.vfsStructure = { rootPath: vfsResult.rootPath, directories: vfsResult.directories, files: vfsResult.files.length }
        result.stats.filesCreated = vfsResult.files.length
      }

      result.success = result.errors.length === 0
      result.stats.totalTime = Date.now() - startTime
      onProgress?.({ phase: 'complete', message: `Import complete: ${result.stats.entitiesCreated} entities, ${result.stats.relationshipsCreated} relationships`, processed: result.stats.rowsProcessed, total: result.stats.rowsProcessed, entities: result.stats.entitiesCreated, relationships: result.stats.relationshipsCreated })

    } catch (error: any) {
      result.errors.push(`JSON import failed: ${error.message}`)
      result.success = false
    }

    return result
  }

  /**
   * Import Markdown content with full pipeline
   */
  async importMarkdown(
    markdown: string,
    options: SmartImportOptions & SmartMarkdownOptions = {},
    onProgress?: (progress: SmartImportProgress) => void
  ): Promise<SmartImportResult> {
    const startTime = Date.now()
    const result: SmartImportResult = {
      success: false,
      extraction: null as any,
      entityIds: [],
      relationshipIds: [],
      stats: {
        rowsProcessed: 0,
        entitiesCreated: 0,
        relationshipsCreated: 0,
        filesCreated: 0,
        totalTime: 0
      },
      errors: []
    }

    try {
      onProgress?.({ phase: 'extracting', message: 'Extracting from Markdown...', processed: 0, total: 0, entities: 0, relationships: 0 })

      const mdResult = await this.markdownImporter.extract(markdown, options)

      result.extraction = this.convertMarkdownToExcelFormat(mdResult) as any
      result.stats.rowsProcessed = mdResult.sectionsProcessed

      await this.createEntitiesAndRelationships(result, options, onProgress)

      if (options.createVFSStructure !== false) {
        const sourceBuffer = Buffer.from(markdown, 'utf-8')
        const vfsOptions: VFSStructureOptions = {
          rootPath: options.vfsRootPath || '/imports/' + (options.filename || 'import'),
          groupBy: options.vfsGroupBy || 'type',
          preserveSource: true,
          sourceBuffer,
          sourceFilename: options.filename || 'import.md',
          createRelationshipFile: true,
          createMetadataFile: true
        }
        const vfsResult = await this.vfsGenerator.generate(result.extraction, vfsOptions)
        result.vfsStructure = { rootPath: vfsResult.rootPath, directories: vfsResult.directories, files: vfsResult.files.length }
        result.stats.filesCreated = vfsResult.files.length
      }

      result.success = result.errors.length === 0
      result.stats.totalTime = Date.now() - startTime
      onProgress?.({ phase: 'complete', message: `Import complete: ${result.stats.entitiesCreated} entities, ${result.stats.relationshipsCreated} relationships`, processed: result.stats.rowsProcessed, total: result.stats.rowsProcessed, entities: result.stats.entitiesCreated, relationships: result.stats.relationshipsCreated })

    } catch (error: any) {
      result.errors.push(`Markdown import failed: ${error.message}`)
      result.success = false
    }

    return result
  }

  /**
   * Helper: Create entities and relationships from extraction result
   */
  private async createEntitiesAndRelationships(
    result: SmartImportResult,
    options: SmartImportOptions,
    onProgress?: (progress: SmartImportProgress) => void
  ): Promise<void> {
    if (options.createEntities !== false) {
      onProgress?.({ phase: 'creating', message: 'Creating entities in knowledge graph...', processed: 0, total: result.extraction.rows.length, entities: 0, relationships: 0 })

      for (let i = 0; i < result.extraction.rows.length; i++) {
        const extracted = result.extraction.rows[i]
        try {
          const entityId = await this.brain.add({
            data: extracted.entity.description,
            type: extracted.entity.type,
            metadata: { ...extracted.entity.metadata, name: extracted.entity.name, confidence: extracted.entity.confidence, importedFrom: 'smart-import' }
          })
          result.entityIds.push(entityId)
          result.stats.entitiesCreated++
          extracted.entity.id = entityId
        } catch (error: any) {
          result.errors.push(`Failed to create entity ${extracted.entity.name}: ${error.message}`)
        }
      }
    }

    if (options.createRelationships !== false && options.createEntities !== false) {
      onProgress?.({ phase: 'creating', message: 'Preparing relationships...', processed: 0, total: result.extraction.rows.length, entities: result.entityIds.length, relationships: 0 })

      // Collect all relationship parameters
      const relationshipParams: Array<{from: string; to: string; type: VerbType; metadata?: any}> = []

      for (const extracted of result.extraction.rows) {
        for (const rel of extracted.relationships) {
          try {
            let toEntityId: string | undefined
            for (const otherExtracted of result.extraction.rows) {
              if (rel.to.toLowerCase().includes(otherExtracted.entity.name.toLowerCase()) || otherExtracted.entity.name.toLowerCase().includes(rel.to.toLowerCase())) {
                toEntityId = otherExtracted.entity.id
                break
              }
            }
            if (!toEntityId) {
              toEntityId = await this.brain.add({ data: rel.to, type: NounType.Thing, metadata: { name: rel.to, placeholder: true, extractedFrom: extracted.entity.name } })
              result.entityIds.push(toEntityId)
            }
            relationshipParams.push({ from: extracted.entity.id, to: toEntityId, type: rel.type, metadata: { confidence: rel.confidence, evidence: rel.evidence } })
          } catch (error: any) {
            result.errors.push(`Failed to prepare relationship: ${error.message}`)
          }
        }
      }

      // Batch create all relationships with progress
      if (relationshipParams.length > 0) {
        onProgress?.({ phase: 'relationships', message: 'Building relationships...', processed: 0, total: relationshipParams.length, entities: result.entityIds.length, relationships: 0 })

        try {
          const relationshipIds = await this.brain.relateMany({
            items: relationshipParams,
            parallel: true,
            chunkSize: 100,
            continueOnError: true,
            onProgress: (done, total) => {
              onProgress?.({ phase: 'relationships', message: `Building relationships: ${done}/${total}`, processed: done, total: total, entities: result.entityIds.length, relationships: done })
            }
          })

          result.relationshipIds = relationshipIds
          result.stats.relationshipsCreated = relationshipIds.length
        } catch (error: any) {
          result.errors.push(`Failed to create relationships: ${error.message}`)
        }
      }
    }
  }

  /**
   * Helper: Convert PDF result to Excel-like format
   */
  private convertPDFToExcelFormat(pdfResult: SmartPDFResult): Omit<SmartExcelResult, 'rows'> & { rows: any[] } {
    const rows = pdfResult.sections.flatMap(section =>
      section.entities.map(entity => ({
        entity,
        relatedEntities: [],
        relationships: section.relationships.filter(r => r.from === entity.id),
        concepts: section.concepts
      }))
    )

    return {
      rowsProcessed: pdfResult.sectionsProcessed,
      entitiesExtracted: pdfResult.entitiesExtracted,
      relationshipsInferred: pdfResult.relationshipsInferred,
      rows,
      entityMap: pdfResult.entityMap,
      processingTime: pdfResult.processingTime,
      stats: pdfResult.stats as any
    }
  }

  /**
   * Helper: Convert JSON result to Excel-like format
   */
  private convertJSONToExcelFormat(jsonResult: SmartJSONResult): Omit<SmartExcelResult, 'rows'> & { rows: any[] } {
    const rows = jsonResult.entities.map(entity => ({
      entity,
      relatedEntities: [],
      relationships: jsonResult.relationships.filter(r => r.from === entity.id),
      concepts: entity.metadata.concepts || []
    }))

    return {
      rowsProcessed: jsonResult.nodesProcessed,
      entitiesExtracted: jsonResult.entitiesExtracted,
      relationshipsInferred: jsonResult.relationshipsInferred,
      rows,
      entityMap: jsonResult.entityMap,
      processingTime: jsonResult.processingTime,
      stats: jsonResult.stats as any
    }
  }

  /**
   * Helper: Convert Markdown result to Excel-like format
   */
  private convertMarkdownToExcelFormat(mdResult: SmartMarkdownResult): Omit<SmartExcelResult, 'rows'> & { rows: any[] } {
    const rows = mdResult.sections.flatMap(section =>
      section.entities.map(entity => ({
        entity,
        relatedEntities: [],
        relationships: section.relationships.filter(r => r.from === entity.id),
        concepts: section.concepts
      }))
    )

    return {
      rowsProcessed: mdResult.sectionsProcessed,
      entitiesExtracted: mdResult.entitiesExtracted,
      relationshipsInferred: mdResult.relationshipsInferred,
      rows,
      entityMap: mdResult.entityMap,
      processingTime: mdResult.processingTime,
      stats: mdResult.stats as any
    }
  }

  /**
   * Get import statistics
   */
  async getImportStatistics(vfsRootPath: string): Promise<{
    entitiesInGraph: number
    relationshipsInGraph: number
    filesInVFS: number
    lastImport?: Date
  }> {
    // Read metadata file
    const vfs = new VirtualFileSystem(this.brain)
    await vfs.init()

    const metadataPath = `${vfsRootPath}/_metadata.json`

    try {
      const metadataBuffer = await vfs.readFile(metadataPath)
      const metadata = JSON.parse(metadataBuffer.toString('utf-8'))

      return {
        entitiesInGraph: metadata.import.stats.entitiesExtracted,
        relationshipsInGraph: metadata.import.stats.relationshipsInferred,
        filesInVFS: metadata.structure.fileCount,
        lastImport: new Date(metadata.import.timestamp)
      }
    } catch (error) {
      return {
        entitiesInGraph: 0,
        relationshipsInGraph: 0,
        filesInVFS: 0
      }
    }
  }
}
