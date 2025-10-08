/**
 * Smart Markdown Importer
 *
 * Extracts entities and relationships from Markdown files using:
 * - Heading structure for entity organization
 * - Link relationships
 * - NeuralEntityExtractor for entity extraction from text
 * - Section-based grouping
 *
 * NO MOCKS - Production-ready implementation
 */

import { Brainy } from '../brainy.js'
import { NeuralEntityExtractor, ExtractedEntity } from '../neural/entityExtractor.js'
import { NaturalLanguageProcessor } from '../neural/naturalLanguageProcessor.js'
import { NounType, VerbType } from '../types/graphTypes.js'

export interface SmartMarkdownOptions {
  /** Enable neural entity extraction from text */
  enableNeuralExtraction?: boolean

  /** Enable relationship inference */
  enableRelationshipInference?: boolean

  /** Enable concept extraction for tagging */
  enableConceptExtraction?: boolean

  /** Confidence threshold for entities (0-1) */
  confidenceThreshold?: number

  /** Extract code blocks as entities */
  extractCodeBlocks?: boolean

  /** Minimum section text length to process */
  minSectionLength?: number

  /** Group by heading level */
  groupByHeading?: boolean

  /** Progress callback */
  onProgress?: (stats: {
    processed: number
    total: number
    entities: number
    relationships: number
  }) => void
}

export interface MarkdownSection {
  /** Section ID */
  id: string

  /** Heading text (if this section has a heading) */
  heading: string | null

  /** Heading level (1-6) */
  level: number

  /** Section content */
  content: string

  /** Entities extracted from this section */
  entities: Array<{
    id: string
    name: string
    type: NounType
    description: string
    confidence: number
    metadata: Record<string, any>
  }>

  /** Links found in this section */
  links: Array<{
    text: string
    url: string
    type: 'internal' | 'external'
  }>

  /** Code blocks in this section */
  codeBlocks?: Array<{
    language: string
    code: string
  }>

  /** Relationships */
  relationships: Array<{
    from: string
    to: string
    type: VerbType
    confidence: number
    evidence: string
  }>

  /** Concepts */
  concepts?: string[]
}

export interface SmartMarkdownResult {
  /** Total sections processed */
  sectionsProcessed: number

  /** Entities extracted */
  entitiesExtracted: number

  /** Relationships inferred */
  relationshipsInferred: number

  /** All extracted sections */
  sections: MarkdownSection[]

  /** Entity ID mapping (name -> ID) */
  entityMap: Map<string, string>

  /** Processing time in ms */
  processingTime: number

  /** Extraction statistics */
  stats: {
    byType: Record<string, number>
    byHeadingLevel: Record<number, number>
    byConfidence: {
      high: number  // > 0.8
      medium: number  // 0.6-0.8
      low: number  // < 0.6
    }
    linksFound: number
    codeBlocksFound: number
  }
}

/**
 * SmartMarkdownImporter - Extracts structured knowledge from Markdown files
 */
export class SmartMarkdownImporter {
  private brain: Brainy
  private extractor: NeuralEntityExtractor
  private nlp: NaturalLanguageProcessor

  constructor(brain: Brainy) {
    this.brain = brain
    this.extractor = new NeuralEntityExtractor(brain)
    this.nlp = new NaturalLanguageProcessor(brain)
  }

  /**
   * Initialize the importer
   */
  async init(): Promise<void> {
    await this.nlp.init()
  }

  /**
   * Extract entities and relationships from Markdown content
   */
  async extract(
    markdown: string,
    options: SmartMarkdownOptions = {}
  ): Promise<SmartMarkdownResult> {
    const startTime = Date.now()

    // Set defaults
    const opts: Required<SmartMarkdownOptions> = {
      enableNeuralExtraction: true,
      enableRelationshipInference: true,
      enableConceptExtraction: true,
      confidenceThreshold: 0.6,
      extractCodeBlocks: true,
      minSectionLength: 50,
      groupByHeading: true,
      onProgress: () => {},
      ...options
    }

    // Parse markdown into sections
    const parsedSections = this.parseMarkdown(markdown, opts)

    // Process each section
    const sections: MarkdownSection[] = []
    const entityMap = new Map<string, string>()
    const stats = {
      byType: {} as Record<string, number>,
      byHeadingLevel: {} as Record<number, number>,
      byConfidence: { high: 0, medium: 0, low: 0 },
      linksFound: 0,
      codeBlocksFound: 0
    }

    for (let i = 0; i < parsedSections.length; i++) {
      const parsed = parsedSections[i]

      const section = await this.processSection(parsed, opts, stats, entityMap)
      sections.push(section)

      opts.onProgress({
        processed: i + 1,
        total: parsedSections.length,
        entities: sections.reduce((sum, s) => sum + s.entities.length, 0),
        relationships: sections.reduce((sum, s) => sum + s.relationships.length, 0)
      })
    }

    return {
      sectionsProcessed: sections.length,
      entitiesExtracted: sections.reduce((sum, s) => sum + s.entities.length, 0),
      relationshipsInferred: sections.reduce((sum, s) => sum + s.relationships.length, 0),
      sections,
      entityMap,
      processingTime: Date.now() - startTime,
      stats
    }
  }

  /**
   * Parse markdown into sections
   */
  private parseMarkdown(
    markdown: string,
    options: SmartMarkdownOptions
  ): Array<{
    id: string
    heading: string | null
    level: number
    content: string
  }> {
    const lines = markdown.split('\n')
    const sections: Array<{
      id: string
      heading: string | null
      level: number
      content: string
    }> = []

    let currentSection: {
      heading: string | null
      level: number
      lines: string[]
    } = {
      heading: null,
      level: 0,
      lines: []
    }

    let sectionCounter = 0

    for (const line of lines) {
      // Check for heading
      const headingMatch = line.match(/^(#{1,6})\s+(.+)$/)

      if (headingMatch) {
        // Save current section if it has content
        if (currentSection.lines.length > 0) {
          const content = currentSection.lines.join('\n').trim()
          if (content.length >= (options.minSectionLength || 50)) {
            sections.push({
              id: `section_${sectionCounter++}`,
              heading: currentSection.heading,
              level: currentSection.level,
              content
            })
          }
        }

        // Start new section
        const level = headingMatch[1].length
        const heading = headingMatch[2].trim()
        currentSection = {
          heading,
          level,
          lines: []
        }
      } else {
        currentSection.lines.push(line)
      }
    }

    // Add last section
    if (currentSection.lines.length > 0) {
      const content = currentSection.lines.join('\n').trim()
      if (content.length >= (options.minSectionLength || 50)) {
        sections.push({
          id: `section_${sectionCounter}`,
          heading: currentSection.heading,
          level: currentSection.level,
          content
        })
      }
    }

    return sections
  }

  /**
   * Process a single section
   */
  private async processSection(
    parsed: {
      id: string
      heading: string | null
      level: number
      content: string
    },
    options: SmartMarkdownOptions,
    stats: SmartMarkdownResult['stats'],
    entityMap: Map<string, string>
  ): Promise<MarkdownSection> {
    // Track heading level
    stats.byHeadingLevel[parsed.level] = (stats.byHeadingLevel[parsed.level] || 0) + 1

    // Extract links
    const links = this.extractLinks(parsed.content)
    stats.linksFound += links.length

    // Extract code blocks
    const codeBlocks = options.extractCodeBlocks ? this.extractCodeBlocks(parsed.content) : []
    stats.codeBlocksFound += codeBlocks.length

    // Remove code blocks from content for entity extraction
    const contentWithoutCode = this.removeCodeBlocks(parsed.content)

    // Extract entities
    let extractedEntities: ExtractedEntity[] = []
    if (options.enableNeuralExtraction && contentWithoutCode.length > 0) {
      extractedEntities = await this.extractor.extract(contentWithoutCode, {
        confidence: options.confidenceThreshold || 0.6,
        neuralMatching: true,
        cache: { enabled: true }
      })
    }

    // If section has a heading, treat it as an entity
    if (parsed.heading) {
      const headingEntity: ExtractedEntity = {
        text: parsed.heading,
        type: this.inferTypeFromHeading(parsed.heading, parsed.level),
        confidence: 0.9,
        position: { start: 0, end: parsed.heading.length }
      }
      extractedEntities.unshift(headingEntity)
    }

    // Extract concepts
    let concepts: string[] = []
    if (options.enableConceptExtraction && contentWithoutCode.length > 0) {
      try {
        concepts = await this.brain.extractConcepts(contentWithoutCode, { limit: 10 })
      } catch (error) {
        concepts = []
      }
    }

    // Create entity objects
    const entities = extractedEntities.map(e => {
      const entityId = this.generateEntityId(e.text, parsed.id)
      entityMap.set(e.text.toLowerCase(), entityId)

      // Update statistics
      this.updateStats(stats, e.type, e.confidence)

      return {
        id: entityId,
        name: e.text,
        type: e.type,
        description: contentWithoutCode.substring(0, 200),
        confidence: e.confidence,
        metadata: {
          source: 'markdown',
          section: parsed.id,
          heading: parsed.heading,
          level: parsed.level,
          extractedAt: Date.now()
        }
      }
    })

    // Infer relationships
    const relationships: MarkdownSection['relationships'] = []

    // Link-based relationships
    if (options.enableRelationshipInference) {
      for (const link of links) {
        // Find entity that might be the source
        const sourceEntity = entities.find(e =>
          contentWithoutCode.toLowerCase().includes(e.name.toLowerCase())
        )

        if (sourceEntity) {
          // Create relationship to linked entity
          const targetId = this.generateEntityId(link.text, 'link')
          relationships.push({
            from: sourceEntity.id,
            to: link.text,
            type: VerbType.References,
            confidence: 0.85,
            evidence: `Markdown link: [${link.text}](${link.url})`
          })
        }
      }

      // Entity proximity-based relationships
      for (let i = 0; i < entities.length; i++) {
        for (let j = i + 1; j < entities.length; j++) {
          const entity1 = entities[i]
          const entity2 = entities[j]

          if (this.entitiesAreRelated(contentWithoutCode, entity1.name, entity2.name)) {
            const verbType = await this.inferRelationship(
              entity1.name,
              entity2.name,
              contentWithoutCode
            )

            relationships.push({
              from: entity1.id,
              to: entity2.id,
              type: verbType,
              confidence: Math.min(entity1.confidence, entity2.confidence) * 0.8,
              evidence: `Co-occurrence in section: ${parsed.heading || parsed.id}`
            })
          }
        }
      }
    }

    return {
      id: parsed.id,
      heading: parsed.heading,
      level: parsed.level,
      content: parsed.content,
      entities,
      links,
      codeBlocks,
      relationships,
      concepts
    }
  }

  /**
   * Extract markdown links
   */
  private extractLinks(content: string): Array<{
    text: string
    url: string
    type: 'internal' | 'external'
  }> {
    const links: Array<{ text: string, url: string, type: 'internal' | 'external' }> = []
    const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g

    let match
    while ((match = linkRegex.exec(content)) !== null) {
      const text = match[1]
      const url = match[2]
      const type = url.startsWith('http') ? 'external' : 'internal'
      links.push({ text, url, type })
    }

    return links
  }

  /**
   * Extract code blocks
   */
  private extractCodeBlocks(content: string): Array<{
    language: string
    code: string
  }> {
    const codeBlocks: Array<{ language: string, code: string }> = []
    const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g

    let match
    while ((match = codeBlockRegex.exec(content)) !== null) {
      const language = match[1] || 'text'
      const code = match[2].trim()
      codeBlocks.push({ language, code })
    }

    return codeBlocks
  }

  /**
   * Remove code blocks from content
   */
  private removeCodeBlocks(content: string): string {
    return content.replace(/```[\s\S]*?```/g, '')
  }

  /**
   * Infer type from heading
   */
  private inferTypeFromHeading(heading: string, level: number): NounType {
    const lower = heading.toLowerCase()

    if (lower.includes('person') || lower.includes('people') || lower.includes('author') || lower.includes('user')) {
      return NounType.Person
    }
    if (lower.includes('location') || lower.includes('place')) {
      return NounType.Location
    }
    if (lower.includes('organization') || lower.includes('company')) {
      return NounType.Organization
    }
    if (lower.includes('event')) {
      return NounType.Event
    }
    if (lower.includes('project')) {
      return NounType.Project
    }
    if (lower.includes('document') || lower.includes('file')) {
      return NounType.Document
    }

    // Top-level headings are often concepts/topics
    if (level <= 2) {
      return NounType.Concept
    }

    return NounType.Thing
  }

  /**
   * Check if entities are related by proximity
   */
  private entitiesAreRelated(text: string, entity1: string, entity2: string): boolean {
    const lowerText = text.toLowerCase()
    const index1 = lowerText.indexOf(entity1.toLowerCase())
    const index2 = lowerText.indexOf(entity2.toLowerCase())

    if (index1 === -1 || index2 === -1) return false

    return Math.abs(index1 - index2) < 300
  }

  /**
   * Infer relationship type from context
   */
  private async inferRelationship(
    fromEntity: string,
    toEntity: string,
    context: string
  ): Promise<VerbType> {
    const lowerContext = context.toLowerCase()

    const patterns: Array<[RegExp, VerbType]> = [
      [new RegExp(`${toEntity}.*of.*${fromEntity}`, 'i'), VerbType.PartOf],
      [new RegExp(`${fromEntity}.*contains.*${toEntity}`, 'i'), VerbType.Contains],
      [new RegExp(`${fromEntity}.*in.*${toEntity}`, 'i'), VerbType.LocatedAt],
      [new RegExp(`${fromEntity}.*created.*${toEntity}`, 'i'), VerbType.Creates],
      [new RegExp(`${fromEntity}.*and.*${toEntity}`, 'i'), VerbType.RelatedTo]
    ]

    for (const [pattern, verbType] of patterns) {
      if (pattern.test(lowerContext)) {
        return verbType
      }
    }

    return VerbType.RelatedTo
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
    stats: SmartMarkdownResult['stats'],
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
}
