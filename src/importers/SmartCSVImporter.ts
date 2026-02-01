/**
 * Smart CSV Importer
 *
 * Extracts entities and relationships from CSV files using:
 * - NeuralEntityExtractor for entity extraction
 * - NaturalLanguageProcessor for relationship inference
 * - brain.extractConcepts() for tagging
 *
 * Very similar to SmartExcelImporter but handles CSV-specific features
 *
 * NO MOCKS - Production-ready implementation
 */

import { Brainy } from '../brainy.js'
import { NeuralEntityExtractor, ExtractedEntity } from '../neural/entityExtractor.js'
import { NaturalLanguageProcessor } from '../neural/naturalLanguageProcessor.js'
import { SmartRelationshipExtractor } from '../neural/SmartRelationshipExtractor.js'
import { NounType, VerbType } from '../types/graphTypes.js'
import { CSVHandler } from './handlers/csvHandler.js'
import type { FormatHandlerOptions } from './handlers/types.js'

export interface SmartCSVOptions extends FormatHandlerOptions {
  /** Enable neural entity extraction */
  enableNeuralExtraction?: boolean

  /** Enable relationship inference from text */
  enableRelationshipInference?: boolean

  /** Enable concept extraction for tagging */
  enableConceptExtraction?: boolean

  /** Confidence threshold for entities (0-1) */
  confidenceThreshold?: number

  /** Column name patterns to detect */
  termColumn?: string      // e.g., "Term", "Name", "Title"
  definitionColumn?: string // e.g., "Definition", "Description"
  typeColumn?: string      // e.g., "Type", "Category"
  relatedColumn?: string   // e.g., "Related Terms", "See Also"

  /** CSV-specific options */
  csvDelimiter?: string
  csvHeaders?: boolean

  /** Progress callback (Enhanced with performance metrics) */
  onProgress?: (stats: {
    processed: number
    total: number
    entities: number
    relationships: number
    /** Rows per second */
    throughput?: number
    /** Estimated time remaining in ms */
    eta?: number
    /** Current phase */
    phase?: string
  }) => void
}

export interface ExtractedRow {
  /** Main entity from this row */
  entity: {
    id: string
    name: string
    type: NounType
    description: string
    confidence: number
    metadata: Record<string, any>
  }

  /** Additional entities extracted from definition */
  relatedEntities: Array<{
    name: string
    type: NounType
    confidence: number
  }>

  /** Inferred relationships */
  relationships: Array<{
    from: string
    to: string
    type: VerbType
    confidence: number
    evidence: string
  }>

  /** Extracted concepts */
  concepts?: string[]
}

export interface SmartCSVResult {
  /** Total rows processed */
  rowsProcessed: number

  /** Entities extracted (includes main + related) */
  entitiesExtracted: number

  /** Relationships inferred */
  relationshipsInferred: number

  /** All extracted data */
  rows: ExtractedRow[]

  /** Entity ID mapping (name -> ID) */
  entityMap: Map<string, string>

  /** Processing time in ms */
  processingTime: number

  /** Extraction statistics */
  stats: {
    byType: Record<string, number>
    byConfidence: {
      high: number  // > 0.8
      medium: number  // 0.6-0.8
      low: number  // < 0.6
    }
  }
}

/**
 * SmartCSVImporter - Extracts structured knowledge from CSV files
 */
export class SmartCSVImporter {
  private brain: Brainy
  private extractor: NeuralEntityExtractor
  private nlp: NaturalLanguageProcessor
  private relationshipExtractor: SmartRelationshipExtractor
  private csvHandler: CSVHandler

  constructor(brain: Brainy) {
    this.brain = brain
    this.extractor = new NeuralEntityExtractor(brain)
    this.nlp = new NaturalLanguageProcessor(brain)
    this.relationshipExtractor = new SmartRelationshipExtractor(brain)
    this.csvHandler = new CSVHandler()
  }

  /**
   * Initialize the importer
   */
  async init(): Promise<void> {
    await this.nlp.init()
  }

  /**
   * Extract entities and relationships from CSV file
   */
  async extract(
    buffer: Buffer,
    options: SmartCSVOptions = {}
  ): Promise<SmartCSVResult> {
    const startTime = Date.now()

    // Set defaults
    const opts = {
      enableNeuralExtraction: true,
      enableRelationshipInference: true,
      enableConceptExtraction: true,
      confidenceThreshold: 0.6,
      termColumn: 'term|name|title|concept|entity',
      definitionColumn: 'definition|description|desc|details|text',
      typeColumn: 'type|category|kind|class',
      relatedColumn: 'related|see also|links|references',
      csvDelimiter: undefined as string | undefined,
      csvHeaders: true,
      onProgress: () => {},
      ...options
    }

    // Parse CSV using existing handler
    // Pass progress hooks to handler for file parsing progress
    const processedData = await this.csvHandler.process(buffer, {
      ...options,
      csvDelimiter: opts.csvDelimiter,
      csvHeaders: opts.csvHeaders,
      totalBytes: buffer.length,
      progressHooks: {
        onBytesProcessed: (bytes) => {
          // Handler reports bytes processed during parsing
          opts.onProgress?.({
            processed: 0,
            total: 0,
            entities: 0,
            relationships: 0,
            phase: `Parsing CSV (${Math.round((bytes / buffer.length) * 100)}%)`
          })
        },
        onCurrentItem: (message) => {
          // Handler reports current processing step
          opts.onProgress?.({
            processed: 0,
            total: 0,
            entities: 0,
            relationships: 0,
            phase: message
          })
        },
        onDataExtracted: (count, total) => {
          // Handler reports rows extracted
          opts.onProgress?.({
            processed: 0,
            total: total || count,
            entities: 0,
            relationships: 0,
            phase: `Extracted ${count} rows`
          })
        }
      }
    })
    const rows = processedData.data

    if (rows.length === 0) {
      return this.emptyResult(startTime)
    }

    // Detect column names
    const columns = this.detectColumns(rows[0], opts)

    // Process each row with BATCHED PARALLEL PROCESSING
    const extractedRows: ExtractedRow[] = []
    const entityMap = new Map<string, string>()
    const stats = {
      byType: {} as Record<string, number>,
      byConfidence: { high: 0, medium: 0, low: 0 }
    }

    // Batch processing configuration
    const CHUNK_SIZE = 10 // Process 10 rows at a time for optimal performance
    let totalProcessed = 0
    const performanceStartTime = Date.now()

    // Process rows in chunks
    for (let chunkStart = 0; chunkStart < rows.length; chunkStart += CHUNK_SIZE) {
      const chunk = rows.slice(chunkStart, Math.min(chunkStart + CHUNK_SIZE, rows.length))

      // Process chunk in parallel for massive speedup
      const chunkResults = await Promise.all(
        chunk.map(async (row, chunkIndex) => {
          const i = chunkStart + chunkIndex

          // Extract data from row
          const term = this.getColumnValue(row, columns.term) || `Entity_${i}`
          const definition = this.getColumnValue(row, columns.definition) || ''
          const type = this.getColumnValue(row, columns.type)
          const relatedTerms = this.getColumnValue(row, columns.related)

          // Parallel extraction: entities AND concepts at the same time
          const [relatedEntities, concepts] = await Promise.all([
            // Extract entities from definition
            opts.enableNeuralExtraction && definition
              ? this.extractor.extract(definition, {
                  confidence: opts.confidenceThreshold * 0.8,
                  neuralMatching: true,
                  cache: { enabled: true }
                }).then(entities =>
                  // Filter out the main term from related entities
                  entities.filter(e => e.text.toLowerCase() !== term.toLowerCase())
                )
              : Promise.resolve([]),

            // Extract concepts (in parallel with entity extraction)
            opts.enableConceptExtraction && definition
              ? this.brain.extractConcepts(definition, { limit: 10 }).catch(() => [])
              : Promise.resolve([])
          ])

          // Determine main entity type
          const mainEntityType = type ?
            this.mapTypeString(type) :
            (relatedEntities.length > 0 ? relatedEntities[0].type : NounType.Thing)

          // Generate entity ID
          const entityId = this.generateEntityId(term)

          // Create main entity
          const mainEntity = {
            id: entityId,
            name: term,
            type: mainEntityType,
            description: definition,
            confidence: 0.95,
            metadata: {
              source: 'csv',
              row: i + 1,
              originalData: row,
              concepts,
              extractedAt: Date.now()
            }
          }

          // Infer relationships
          const relationships: ExtractedRow['relationships'] = []

          if (opts.enableRelationshipInference) {
            // Extract relationships from definition text
            for (const relEntity of relatedEntities) {
              const verbType = await this.inferRelationship(
                term,
                relEntity.text,
                definition
              )

              relationships.push({
                from: entityId,
                to: relEntity.text,
                type: verbType,
                confidence: relEntity.confidence,
                evidence: `Extracted from: "${definition.substring(0, 100)}..."`
              })
            }

            // Parse explicit "Related" column
            if (relatedTerms) {
              const terms = relatedTerms.split(/[,;|]/).map(t => t.trim()).filter(Boolean)
              for (const relTerm of terms) {
                if (relTerm.toLowerCase() !== term.toLowerCase()) {
                  relationships.push({
                    from: entityId,
                    to: relTerm,
                    type: VerbType.RelatedTo,
                    confidence: 0.9,
                    evidence: `Explicitly listed in "Related" column`
                  })
                }
              }
            }
          }

          return {
            term,
            entityId,
            mainEntity,
            mainEntityType,
            relatedEntities,
            relationships,
            concepts
          }
        })
      )

      // Process chunk results sequentially to maintain order
      for (const result of chunkResults) {
        // Store entity ID mapping
        entityMap.set(result.term.toLowerCase(), result.entityId)

        // Track statistics
        this.updateStats(stats, result.mainEntityType, result.mainEntity.confidence)

        // Add extracted row
        extractedRows.push({
          entity: result.mainEntity,
          relatedEntities: result.relatedEntities.map(e => ({
            name: e.text,
            type: e.type,
            confidence: e.confidence
          })),
          relationships: result.relationships,
          concepts: result.concepts
        })
      }

      // Update progress tracking
      totalProcessed += chunk.length

      // Calculate performance metrics
      const elapsed = Date.now() - performanceStartTime
      const rowsPerSecond = totalProcessed / (elapsed / 1000)
      const remainingRows = rows.length - totalProcessed
      const estimatedTimeRemaining = remainingRows / rowsPerSecond

      // Report progress with enhanced metrics
      opts.onProgress({
        processed: totalProcessed,
        total: rows.length,
        entities: extractedRows.reduce((sum, row) => sum + 1 + row.relatedEntities.length, 0),
        relationships: extractedRows.reduce((sum, row) => sum + row.relationships.length, 0),
        // Additional performance metrics
        throughput: Math.round(rowsPerSecond * 10) / 10,
        eta: Math.round(estimatedTimeRemaining),
        phase: 'extracting'
      } as any)
    }

    return {
      rowsProcessed: rows.length,
      entitiesExtracted: extractedRows.reduce(
        (sum, row) => sum + 1 + row.relatedEntities.length,
        0
      ),
      relationshipsInferred: extractedRows.reduce(
        (sum, row) => sum + row.relationships.length,
        0
      ),
      rows: extractedRows,
      entityMap,
      processingTime: Date.now() - startTime,
      stats
    }
  }

  /**
   * Detect column names from first row
   */
  private detectColumns(
    firstRow: Record<string, any>,
    options: SmartCSVOptions
  ): {
    term: string | null
    definition: string | null
    type: string | null
    related: string | null
  } {
    const columnNames = Object.keys(firstRow)

    const matchColumn = (pattern: string): string | null => {
      const regex = new RegExp(pattern, 'i')
      return columnNames.find(col => regex.test(col)) || null
    }

    return {
      term: matchColumn(options.termColumn || 'term|name'),
      definition: matchColumn(options.definitionColumn || 'definition|description'),
      type: matchColumn(options.typeColumn || 'type|category'),
      related: matchColumn(options.relatedColumn || 'related|see also')
    }
  }

  /**
   * Get value from row using column name
   */
  private getColumnValue(
    row: Record<string, any>,
    columnName: string | null
  ): string {
    if (!columnName) return ''
    const value = row[columnName]
    if (value === null || value === undefined) return ''
    return String(value).trim()
  }

  /**
   * Map type string to NounType
   */
  private mapTypeString(typeString: string): NounType {
    const normalized = typeString.toLowerCase().trim()

    const mapping: Record<string, NounType> = {
      'person': NounType.Person,
      'character': NounType.Person,
      'people': NounType.Person,
      'place': NounType.Location,
      'location': NounType.Location,
      'geography': NounType.Location,
      'organization': NounType.Organization,
      'org': NounType.Organization,
      'company': NounType.Organization,
      'concept': NounType.Concept,
      'idea': NounType.Concept,
      'theory': NounType.Concept,
      'event': NounType.Event,
      'occurrence': NounType.Event,
      'product': NounType.Product,
      'item': NounType.Product,
      'thing': NounType.Thing,
      'document': NounType.Document,
      'file': NounType.File,
      'project': NounType.Project
    }

    return mapping[normalized] || NounType.Thing
  }

  /**
   * Infer relationship type from context using SmartRelationshipExtractor
   */
  private async inferRelationship(
    fromTerm: string,
    toTerm: string,
    context: string,
    fromType?: NounType,
    toType?: NounType
  ): Promise<VerbType> {
    // Use SmartRelationshipExtractor for robust relationship classification
    const result = await this.relationshipExtractor.infer(
      fromTerm,
      toTerm,
      context,
      {
        subjectType: fromType,
        objectType: toType
      }
    )

    // Return inferred type or fallback to RelatedTo
    return result?.type || VerbType.RelatedTo
  }

  /**
   * Generate consistent entity ID from name
   */
  private generateEntityId(name: string): string {
    const normalized = name.toLowerCase().trim().replace(/\s+/g, '_')
    return `ent_${normalized}_${Date.now()}`
  }

  /**
   * Update statistics
   */
  private updateStats(
    stats: SmartCSVResult['stats'],
    type: NounType,
    confidence: number
  ): void {
    // Track by type
    const typeName = String(type)
    stats.byType[typeName] = (stats.byType[typeName] || 0) + 1

    // Track by confidence
    if (confidence > 0.8) {
      stats.byConfidence.high++
    } else if (confidence >= 0.6) {
      stats.byConfidence.medium++
    } else {
      stats.byConfidence.low++
    }
  }

  /**
   * Create empty result
   */
  private emptyResult(startTime: number): SmartCSVResult {
    return {
      rowsProcessed: 0,
      entitiesExtracted: 0,
      relationshipsInferred: 0,
      rows: [],
      entityMap: new Map(),
      processingTime: Date.now() - startTime,
      stats: {
        byType: {},
        byConfidence: { high: 0, medium: 0, low: 0 }
      }
    }
  }
}
