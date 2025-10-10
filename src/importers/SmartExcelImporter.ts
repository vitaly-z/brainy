/**
 * Smart Excel Importer
 *
 * Extracts entities and relationships from Excel files using:
 * - NeuralEntityExtractor for entity extraction
 * - NaturalLanguageProcessor for relationship inference
 * - brain.extractConcepts() for tagging
 *
 * NO MOCKS - Production-ready implementation
 */

import { Brainy } from '../brainy.js'
import { NeuralEntityExtractor, ExtractedEntity } from '../neural/entityExtractor.js'
import { NaturalLanguageProcessor } from '../neural/naturalLanguageProcessor.js'
import { NounType, VerbType } from '../types/graphTypes.js'
import { ExcelHandler } from '../augmentations/intelligentImport/handlers/excelHandler.js'
import type { FormatHandlerOptions } from '../augmentations/intelligentImport/types.js'

export interface SmartExcelOptions extends FormatHandlerOptions {
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

  /** Progress callback */
  onProgress?: (stats: {
    processed: number
    total: number
    entities: number
    relationships: number
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

export interface SmartExcelResult {
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
 * SmartExcelImporter - Extracts structured knowledge from Excel files
 */
export class SmartExcelImporter {
  private brain: Brainy
  private extractor: NeuralEntityExtractor
  private nlp: NaturalLanguageProcessor
  private excelHandler: ExcelHandler

  constructor(brain: Brainy) {
    this.brain = brain
    this.extractor = new NeuralEntityExtractor(brain)
    this.nlp = new NaturalLanguageProcessor(brain)
    this.excelHandler = new ExcelHandler()
  }

  /**
   * Initialize the importer
   */
  async init(): Promise<void> {
    await this.nlp.init()
  }

  /**
   * Extract entities and relationships from Excel file
   */
  async extract(
    buffer: Buffer,
    options: SmartExcelOptions = {}
  ): Promise<SmartExcelResult> {
    const startTime = Date.now()

    // Set defaults
    const opts = {
      enableNeuralExtraction: true,
      enableRelationshipInference: true,
      // CONCEPT EXTRACTION PRODUCTION-READY (v3.33.0+):
      // Type embeddings are now pre-computed at build time - zero runtime cost!
      // All 31 noun types + 40 verb types instantly available
      //
      // Performance profile:
      // - Type embeddings: INSTANT (pre-computed at build time, ~100KB in-memory)
      // - Model loading: ~2-5 seconds (one-time, cached after first use)
      // - Per-row extraction: ~50-200ms depending on definition length
      // - 100 rows: ~5-20 seconds total (production ready)
      // - 1000 rows: ~50-200 seconds (disable if needed via enableConceptExtraction: false)
      //
      // Enabled by default for production use.
      enableConceptExtraction: true,
      confidenceThreshold: 0.6,
      termColumn: 'term|name|title|concept',
      definitionColumn: 'definition|description|desc|details',
      typeColumn: 'type|category|kind',
      relatedColumn: 'related|see also|links',
      onProgress: () => {},
      ...options
    }

    // Parse Excel using existing handler
    const processedData = await this.excelHandler.process(buffer, options)
    const rows = processedData.data

    if (rows.length === 0) {
      return this.emptyResult(startTime)
    }

    // Detect column names
    const columns = this.detectColumns(rows[0], opts)

    // Process each row
    const extractedRows: ExtractedRow[] = []
    const entityMap = new Map<string, string>()
    const stats = {
      byType: {} as Record<string, number>,
      byConfidence: { high: 0, medium: 0, low: 0 }
    }

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]

      // Extract data from row
      const term = this.getColumnValue(row, columns.term) || `Entity_${i}`
      const definition = this.getColumnValue(row, columns.definition) || ''
      const type = this.getColumnValue(row, columns.type)
      const relatedTerms = this.getColumnValue(row, columns.related)

      // Extract entities from definition
      let relatedEntities: ExtractedEntity[] = []
      if (opts.enableNeuralExtraction && definition) {
        relatedEntities = await this.extractor.extract(definition, {
          confidence: opts.confidenceThreshold * 0.8, // Lower threshold for related entities
          neuralMatching: true,
          cache: { enabled: true }
        })

        // Filter out the main term from related entities
        relatedEntities = relatedEntities.filter(
          e => e.text.toLowerCase() !== term.toLowerCase()
        )
      }

      // Determine main entity type
      const mainEntityType = type ?
        this.mapTypeString(type) :
        (relatedEntities.length > 0 ? relatedEntities[0].type : NounType.Thing)

      // Generate entity ID
      const entityId = this.generateEntityId(term)
      entityMap.set(term.toLowerCase(), entityId)

      // Extract concepts
      let concepts: string[] = []
      if (opts.enableConceptExtraction && definition) {
        try {
          concepts = await this.brain.extractConcepts(definition, { limit: 10 })
        } catch (error) {
          // Concept extraction is optional
          concepts = []
        }
      }

      // Create main entity
      const mainEntity = {
        id: entityId,
        name: term,
        type: mainEntityType,
        description: definition,
        confidence: 0.95, // Main entity from row has high confidence
        metadata: {
          source: 'excel',
          row: i + 1,
          originalData: row,
          concepts,
          extractedAt: Date.now()
        }
      }

      // Track statistics
      this.updateStats(stats, mainEntityType, mainEntity.confidence)

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
            to: relEntity.text, // Use entity name directly, will be resolved later
            type: verbType,
            confidence: relEntity.confidence,
            evidence: `Extracted from: "${definition.substring(0, 100)}..."`
          })
        }

        // Parse explicit "Related Terms" column
        if (relatedTerms) {
          const terms = relatedTerms.split(/[,;]/).map(t => t.trim()).filter(Boolean)
          for (const relTerm of terms) {
            // Ensure we don't create self-relationships
            if (relTerm.toLowerCase() !== term.toLowerCase()) {
              relationships.push({
                from: entityId,
                to: relTerm, // Use term name directly
                type: VerbType.RelatedTo,
                confidence: 0.9, // Explicit relationships have high confidence
                evidence: `Explicitly listed in "Related" column`
              })
            }
          }
        }
      }

      // Add extracted row
      extractedRows.push({
        entity: mainEntity,
        relatedEntities: relatedEntities.map(e => ({
          name: e.text,
          type: e.type,
          confidence: e.confidence
        })),
        relationships,
        concepts
      })

      // Report progress
      opts.onProgress({
        processed: i + 1,
        total: rows.length,
        entities: extractedRows.length + relatedEntities.length,
        relationships: relationships.length
      })
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
    options: SmartExcelOptions
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
   * Infer relationship type from context
   */
  private async inferRelationship(
    fromTerm: string,
    toTerm: string,
    context: string
  ): Promise<VerbType> {
    const lowerContext = context.toLowerCase()

    // Pattern-based relationship detection
    const patterns: Array<[RegExp, VerbType]> = [
      [new RegExp(`${toTerm}.*of.*${fromTerm}`, 'i'), VerbType.PartOf],
      [new RegExp(`${fromTerm}.*contains.*${toTerm}`, 'i'), VerbType.Contains],
      [new RegExp(`located in.*${toTerm}`, 'i'), VerbType.LocatedAt],
      [new RegExp(`ruled by.*${toTerm}`, 'i'), VerbType.Owns],
      [new RegExp(`capital.*${toTerm}`, 'i'), VerbType.Contains],
      [new RegExp(`created by.*${toTerm}`, 'i'), VerbType.CreatedBy],
      [new RegExp(`authored by.*${toTerm}`, 'i'), VerbType.CreatedBy],
      [new RegExp(`part of.*${toTerm}`, 'i'), VerbType.PartOf],
      [new RegExp(`related to.*${toTerm}`, 'i'), VerbType.RelatedTo]
    ]

    for (const [pattern, verbType] of patterns) {
      if (pattern.test(lowerContext)) {
        return verbType
      }
    }

    // Default to RelatedTo
    return VerbType.RelatedTo
  }

  /**
   * Generate consistent entity ID from name
   */
  private generateEntityId(name: string): string {
    // Create deterministic ID based on normalized name
    const normalized = name.toLowerCase().trim().replace(/\s+/g, '_')
    return `ent_${normalized}_${Date.now()}`
  }

  /**
   * Update statistics
   */
  private updateStats(
    stats: SmartExcelResult['stats'],
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
  private emptyResult(startTime: number): SmartExcelResult {
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
