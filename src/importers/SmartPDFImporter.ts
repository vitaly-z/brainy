/**
 * Smart PDF Importer
 *
 * Extracts entities and relationships from PDF files using:
 * - NeuralEntityExtractor for entity extraction
 * - NaturalLanguageProcessor for relationship inference
 * - brain.extractConcepts() for tagging
 * - Section-based organization (by page or detected structure)
 *
 * NO MOCKS - Production-ready implementation
 */

import { Brainy } from '../brainy.js'
import { NeuralEntityExtractor, ExtractedEntity } from '../neural/entityExtractor.js'
import { NaturalLanguageProcessor } from '../neural/naturalLanguageProcessor.js'
import { SmartRelationshipExtractor } from '../neural/SmartRelationshipExtractor.js'
import { NounType, VerbType } from '../types/graphTypes.js'
import { PDFHandler } from '../augmentations/intelligentImport/handlers/pdfHandler.js'
import type { FormatHandlerOptions } from '../augmentations/intelligentImport/types.js'

export interface SmartPDFOptions extends FormatHandlerOptions {
  /** Enable neural entity extraction */
  enableNeuralExtraction?: boolean

  /** Enable relationship inference from text */
  enableRelationshipInference?: boolean

  /** Enable concept extraction for tagging */
  enableConceptExtraction?: boolean

  /** Confidence threshold for entities (0-1) */
  confidenceThreshold?: number

  /** Minimum paragraph length to process (characters) */
  minParagraphLength?: number

  /** Extract from tables */
  extractFromTables?: boolean

  /** Group by page or full document */
  groupBy?: 'page' | 'document'

  /** Progress callback (v3.39.0: Enhanced with performance metrics) */
  onProgress?: (stats: {
    processed: number
    total: number
    entities: number
    relationships: number
    /** Sections per second (v3.39.0) */
    throughput?: number
    /** Estimated time remaining in ms (v3.39.0) */
    eta?: number
    /** Current phase (v3.39.0) */
    phase?: string
  }) => void
}

export interface ExtractedSection {
  /** Section identifier (page number or section name) */
  sectionId: string

  /** Section type */
  sectionType: 'page' | 'paragraph' | 'table'

  /** Entities extracted from this section */
  entities: Array<{
    id: string
    name: string
    type: NounType
    description: string
    confidence: number
    metadata: Record<string, any>
  }>

  /** Relationships inferred in this section */
  relationships: Array<{
    from: string
    to: string
    type: VerbType
    confidence: number
    evidence: string
  }>

  /** Concepts extracted */
  concepts?: string[]

  /** Original text */
  text: string
}

export interface SmartPDFResult {
  /** Total sections processed */
  sectionsProcessed: number

  /** Total pages processed */
  pagesProcessed: number

  /** Entities extracted */
  entitiesExtracted: number

  /** Relationships inferred */
  relationshipsInferred: number

  /** All extracted sections */
  sections: ExtractedSection[]

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
    bySource: {
      paragraphs: number
      tables: number
    }
  }

  /** PDF metadata */
  pdfMetadata: {
    pageCount: number
    title?: string
    author?: string
    subject?: string
  }
}

/**
 * SmartPDFImporter - Extracts structured knowledge from PDF files
 */
export class SmartPDFImporter {
  private brain: Brainy
  private extractor: NeuralEntityExtractor
  private nlp: NaturalLanguageProcessor
  private relationshipExtractor: SmartRelationshipExtractor
  private pdfHandler: PDFHandler

  constructor(brain: Brainy) {
    this.brain = brain
    this.extractor = new NeuralEntityExtractor(brain)
    this.nlp = new NaturalLanguageProcessor(brain)
    this.relationshipExtractor = new SmartRelationshipExtractor(brain)
    this.pdfHandler = new PDFHandler()
  }

  /**
   * Initialize the importer
   */
  async init(): Promise<void> {
    await this.nlp.init()
  }

  /**
   * Extract entities and relationships from PDF file
   */
  async extract(
    buffer: Buffer,
    options: SmartPDFOptions = {}
  ): Promise<SmartPDFResult> {
    const startTime = Date.now()

    // Set defaults
    const opts = {
      enableNeuralExtraction: true,
      enableRelationshipInference: true,
      enableConceptExtraction: true,
      confidenceThreshold: 0.6,
      minParagraphLength: 50,
      extractFromTables: true,
      groupBy: 'document' as const,
      onProgress: () => {},
      ...options
    }

    // Parse PDF using existing handler
    const processedData = await this.pdfHandler.process(buffer, options)
    const data = processedData.data
    const pdfMetadata = processedData.metadata.additionalInfo?.pdfMetadata || {}

    if (data.length === 0) {
      return this.emptyResult(startTime, pdfMetadata)
    }

    // Group data by page or combine into single document
    const grouped = this.groupData(data, opts)

    // Process each group with BATCHED PARALLEL PROCESSING (v3.39.0)
    const sections: ExtractedSection[] = []
    const entityMap = new Map<string, string>()
    const stats = {
      byType: {} as Record<string, number>,
      byConfidence: { high: 0, medium: 0, low: 0 },
      bySource: { paragraphs: 0, tables: 0 }
    }

    // Batch processing configuration
    const CHUNK_SIZE = 5 // Process 5 sections at a time (smaller than rows due to section size)
    let totalProcessed = 0
    const performanceStartTime = Date.now()
    const totalGroups = grouped.length

    // Process sections in chunks
    for (let chunkStart = 0; chunkStart < grouped.length; chunkStart += CHUNK_SIZE) {
      const chunk = grouped.slice(chunkStart, Math.min(chunkStart + CHUNK_SIZE, grouped.length))

      // Process chunk in parallel for better performance
      const chunkResults = await Promise.all(
        chunk.map(group => this.processSection(group, opts, stats, entityMap))
      )

      // Add results sequentially to maintain order
      sections.push(...chunkResults)

      // Update progress tracking
      totalProcessed += chunk.length

      // Calculate performance metrics
      const elapsed = Date.now() - performanceStartTime
      const sectionsPerSecond = totalProcessed / (elapsed / 1000)
      const remainingSections = grouped.length - totalProcessed
      const estimatedTimeRemaining = remainingSections / sectionsPerSecond

      // Report progress with enhanced metrics
      opts.onProgress({
        processed: totalProcessed,
        total: totalGroups,
        entities: sections.reduce((sum, s) => sum + s.entities.length, 0),
        relationships: sections.reduce((sum, s) => sum + s.relationships.length, 0),
        // Additional performance metrics (v3.39.0)
        throughput: Math.round(sectionsPerSecond * 10) / 10,
        eta: Math.round(estimatedTimeRemaining),
        phase: 'extracting'
      } as any)
    }

    const pagesProcessed = new Set(data.map(d => d._page)).size

    return {
      sectionsProcessed: sections.length,
      pagesProcessed,
      entitiesExtracted: sections.reduce((sum, s) => sum + s.entities.length, 0),
      relationshipsInferred: sections.reduce((sum, s) => sum + s.relationships.length, 0),
      sections,
      entityMap,
      processingTime: Date.now() - startTime,
      stats,
      pdfMetadata: {
        pageCount: pdfMetadata.pageCount || pagesProcessed,
        title: pdfMetadata.title,
        author: pdfMetadata.author,
        subject: pdfMetadata.subject
      }
    }
  }

  /**
   * Group data by strategy
   */
  private groupData(
    data: Array<Record<string, any>>,
    options: SmartPDFOptions
  ): Array<{
    id: string
    type: 'page' | 'paragraph' | 'table'
    items: Array<Record<string, any>>
  }> {
    if (options.groupBy === 'page') {
      // Group by page
      const pageGroups = new Map<number, Array<Record<string, any>>>()
      for (const item of data) {
        const page = item._page || 1
        if (!pageGroups.has(page)) {
          pageGroups.set(page, [])
        }
        pageGroups.get(page)!.push(item)
      }

      return Array.from(pageGroups.entries()).map(([page, items]) => ({
        id: `page_${page}`,
        type: 'page' as const,
        items
      }))
    } else {
      // Single document group
      return [{
        id: 'document',
        type: 'paragraph' as const,
        items: data
      }]
    }
  }

  /**
   * Process a single section
   */
  private async processSection(
    group: { id: string, type: string, items: Array<Record<string, any>> },
    options: SmartPDFOptions,
    stats: SmartPDFResult['stats'],
    entityMap: Map<string, string>
  ): Promise<ExtractedSection> {
    // Combine all text from the group
    const texts: string[] = []
    for (const item of group.items) {
      if (item._type === 'paragraph') {
        const text = item.text || ''
        if (text.length >= (options.minParagraphLength || 50)) {
          texts.push(text)
          stats.bySource.paragraphs++
        }
      } else if (item._type === 'table_row' && options.extractFromTables) {
        // For table rows, combine all column values
        const values = Object.entries(item)
          .filter(([key]) => !key.startsWith('_'))
          .map(([_, value]) => String(value))
          .filter(Boolean)
        if (values.length > 0) {
          texts.push(values.join(' '))
          stats.bySource.tables++
        }
      }
    }

    const combinedText = texts.join('\n\n')

    // Parallel extraction: entities AND concepts at the same time (v3.39.0)
    const [extractedEntities, concepts] = await Promise.all([
      // Extract entities if enabled
      options.enableNeuralExtraction && combinedText.length > 0
        ? this.extractor.extract(combinedText, {
            confidence: options.confidenceThreshold || 0.6,
            neuralMatching: true,
            cache: { enabled: true }
          })
        : Promise.resolve([]),

      // Extract concepts (in parallel with entity extraction)
      options.enableConceptExtraction && combinedText.length > 0
        ? this.brain.extractConcepts(combinedText, { limit: 15 }).catch(() => [])
        : Promise.resolve([])
    ])

    // Create entity objects
    const entities = extractedEntities.map(e => {
      const entityId = this.generateEntityId(e.text, group.id)
      entityMap.set(e.text.toLowerCase(), entityId)

      // Update statistics
      this.updateStats(stats, e.type, e.confidence)

      return {
        id: entityId,
        name: e.text,
        type: e.type,
        description: this.extractContextAroundEntity(combinedText, e.text),
        confidence: e.confidence,
        metadata: {
          source: 'pdf',
          section: group.id,
          sectionType: group.type,
          extractedAt: Date.now()
        }
      }
    })

    // Infer relationships if enabled
    const relationships: ExtractedSection['relationships'] = []
    if (options.enableRelationshipInference && entities.length > 1) {
      // Find relationships between entities in this section
      for (let i = 0; i < entities.length; i++) {
        for (let j = i + 1; j < entities.length; j++) {
          const entity1 = entities[i]
          const entity2 = entities[j]

          // Check if entities appear near each other in text
          if (this.entitiesAreRelated(combinedText, entity1.name, entity2.name)) {
            const verbType = await this.inferRelationship(
              entity1.name,
              entity2.name,
              combinedText
            )

            const context = this.extractRelationshipContext(
              combinedText,
              entity1.name,
              entity2.name
            )

            relationships.push({
              from: entity1.id,
              to: entity2.id,
              type: verbType,
              confidence: Math.min(entity1.confidence, entity2.confidence) * 0.9,
              evidence: context
            })
          }
        }
      }
    }

    return {
      sectionId: group.id,
      sectionType: group.type as any,
      entities,
      relationships,
      concepts,
      text: combinedText.substring(0, 1000) // Store first 1000 chars as preview
    }
  }

  /**
   * Extract context around an entity mention
   */
  private extractContextAroundEntity(text: string, entityName: string, contextLength: number = 200): string {
    const index = text.toLowerCase().indexOf(entityName.toLowerCase())
    if (index === -1) return text.substring(0, contextLength)

    const start = Math.max(0, index - contextLength / 2)
    const end = Math.min(text.length, index + entityName.length + contextLength / 2)

    return text.substring(start, end).trim()
  }

  /**
   * Check if two entities are related based on proximity in text
   */
  private entitiesAreRelated(text: string, entity1: string, entity2: string): boolean {
    const lowerText = text.toLowerCase()
    const index1 = lowerText.indexOf(entity1.toLowerCase())
    const index2 = lowerText.indexOf(entity2.toLowerCase())

    if (index1 === -1 || index2 === -1) return false

    // Entities are related if they appear within 500 characters of each other
    return Math.abs(index1 - index2) < 500
  }

  /**
   * Extract context showing relationship between entities
   */
  private extractRelationshipContext(text: string, entity1: string, entity2: string): string {
    const lowerText = text.toLowerCase()
    const index1 = lowerText.indexOf(entity1.toLowerCase())
    const index2 = lowerText.indexOf(entity2.toLowerCase())

    if (index1 === -1 || index2 === -1) return ''

    const start = Math.min(index1, index2)
    const end = Math.max(
      index1 + entity1.length,
      index2 + entity2.length
    )

    return text.substring(start, end + 100).trim()
  }

  /**
   * Infer relationship type from context using SmartRelationshipExtractor
   */
  private async inferRelationship(
    fromEntity: string,
    toEntity: string,
    context: string,
    fromType?: NounType,
    toType?: NounType
  ): Promise<VerbType> {
    // Use SmartRelationshipExtractor for robust relationship classification
    const result = await this.relationshipExtractor.infer(
      fromEntity,
      toEntity,
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
   * Generate consistent entity ID
   */
  private generateEntityId(name: string, section: string): string {
    const normalized = name.toLowerCase().trim().replace(/\s+/g, '_')
    const sectionNorm = section.replace(/\s+/g, '_')
    return `ent_${normalized}_${sectionNorm}_${Date.now()}`
  }

  /**
   * Update statistics
   */
  private updateStats(
    stats: SmartPDFResult['stats'],
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
  private emptyResult(startTime: number, pdfMetadata: any = {}): SmartPDFResult {
    return {
      sectionsProcessed: 0,
      pagesProcessed: 0,
      entitiesExtracted: 0,
      relationshipsInferred: 0,
      sections: [],
      entityMap: new Map(),
      processingTime: Date.now() - startTime,
      stats: {
        byType: {},
        byConfidence: { high: 0, medium: 0, low: 0 },
        bySource: { paragraphs: 0, tables: 0 }
      },
      pdfMetadata: {
        pageCount: pdfMetadata.pageCount || 0,
        title: pdfMetadata.title,
        author: pdfMetadata.author,
        subject: pdfMetadata.subject
      }
    }
  }
}
