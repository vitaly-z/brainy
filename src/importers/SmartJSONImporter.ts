/**
 * Smart JSON Importer
 *
 * Extracts entities and relationships from JSON files using:
 * - Recursive traversal of nested structures
 * - NeuralEntityExtractor for entity extraction from text values
 * - NaturalLanguageProcessor for relationship inference
 * - Hierarchical relationship creation (parent-child, contains, etc.)
 *
 * NO MOCKS - Production-ready implementation
 */

import { Brainy } from '../brainy.js'
import { NeuralEntityExtractor, ExtractedEntity } from '../neural/entityExtractor.js'
import { NaturalLanguageProcessor } from '../neural/naturalLanguageProcessor.js'
import { SmartRelationshipExtractor } from '../neural/SmartRelationshipExtractor.js'
import { NounType, VerbType } from '../types/graphTypes.js'

export interface SmartJSONOptions {
  /** Enable neural entity extraction from string values */
  enableNeuralExtraction?: boolean

  /** Enable hierarchical relationship creation */
  enableHierarchicalRelationships?: boolean

  /** Enable concept extraction for tagging */
  enableConceptExtraction?: boolean

  /** Confidence threshold for entities (0-1) */
  confidenceThreshold?: number

  /** Maximum depth to traverse */
  maxDepth?: number

  /** Minimum string length to process for entity extraction */
  minStringLength?: number

  /** Keys that indicate entity names */
  nameKeys?: string[]

  /** Keys that indicate entity descriptions */
  descriptionKeys?: string[]

  /** Keys that indicate entity types */
  typeKeys?: string[]

  /** Progress callback */
  onProgress?: (stats: {
    processed: number
    entities: number
    relationships: number
  }) => void
}

export interface ExtractedJSONEntity {
  /** Entity ID */
  id: string

  /** Entity name */
  name: string

  /** Entity type */
  type: NounType

  /** Entity description/value */
  description: string

  /** Confidence score */
  confidence: number

  /** JSON path to this entity */
  path: string

  /** Parent path in JSON hierarchy */
  parentPath: string | null

  /** Metadata */
  metadata: Record<string, any>
}

export interface ExtractedJSONRelationship {
  from: string
  to: string
  type: VerbType
  confidence: number
  evidence: string
}

export interface SmartJSONResult {
  /** Total nodes processed */
  nodesProcessed: number

  /** Entities extracted */
  entitiesExtracted: number

  /** Relationships inferred */
  relationshipsInferred: number

  /** All extracted entities */
  entities: ExtractedJSONEntity[]

  /** All relationships */
  relationships: ExtractedJSONRelationship[]

  /** Entity ID mapping (path -> ID) */
  entityMap: Map<string, string>

  /** Processing time in ms */
  processingTime: number

  /** Extraction statistics */
  stats: {
    byType: Record<string, number>
    byDepth: Record<number, number>
    byConfidence: {
      high: number  // > 0.8
      medium: number  // 0.6-0.8
      low: number  // < 0.6
    }
  }
}

/**
 * SmartJSONImporter - Extracts structured knowledge from JSON files
 */
export class SmartJSONImporter {
  private brain: Brainy
  private extractor: NeuralEntityExtractor
  private nlp: NaturalLanguageProcessor
  private relationshipExtractor: SmartRelationshipExtractor

  constructor(brain: Brainy) {
    this.brain = brain
    this.extractor = new NeuralEntityExtractor(brain)
    this.nlp = new NaturalLanguageProcessor(brain)
    this.relationshipExtractor = new SmartRelationshipExtractor(brain)
  }

  /**
   * Initialize the importer
   */
  async init(): Promise<void> {
    await this.nlp.init()
  }

  /**
   * Extract entities and relationships from JSON data
   */
  async extract(
    data: any,
    options: SmartJSONOptions = {}
  ): Promise<SmartJSONResult> {
    const startTime = Date.now()

    // Set defaults
    const opts: Required<SmartJSONOptions> = {
      enableNeuralExtraction: true,
      enableHierarchicalRelationships: true,
      enableConceptExtraction: true,
      confidenceThreshold: 0.6,
      maxDepth: 10,
      minStringLength: 20,
      nameKeys: ['name', 'title', 'label', 'id', 'key'],
      descriptionKeys: ['description', 'desc', 'details', 'text', 'content', 'summary'],
      typeKeys: ['type', 'kind', 'category', 'class'],
      onProgress: () => {},
      ...options
    }

    // Parse JSON if string
    let jsonData: any
    if (typeof data === 'string') {
      try {
        jsonData = JSON.parse(data)
      } catch (error) {
        throw new Error(`Invalid JSON: ${error instanceof Error ? error.message : String(error)}`)
      }
    } else {
      jsonData = data
    }

    // Traverse and extract
    const entities: ExtractedJSONEntity[] = []
    const relationships: ExtractedJSONRelationship[] = []
    const entityMap = new Map<string, string>()
    const stats = {
      byType: {} as Record<string, number>,
      byDepth: {} as Record<number, number>,
      byConfidence: { high: 0, medium: 0, low: 0 }
    }

    let nodesProcessed = 0

    // Recursive traversal
    await this.traverseJSON(
      jsonData,
      '',
      null,
      0,
      opts,
      entities,
      relationships,
      entityMap,
      stats,
      () => {
        nodesProcessed++
        if (nodesProcessed % 10 === 0) {
          opts.onProgress({
            processed: nodesProcessed,
            entities: entities.length,
            relationships: relationships.length
          })
        }
      }
    )

    return {
      nodesProcessed,
      entitiesExtracted: entities.length,
      relationshipsInferred: relationships.length,
      entities,
      relationships,
      entityMap,
      processingTime: Date.now() - startTime,
      stats
    }
  }

  /**
   * Recursively traverse JSON structure
   */
  private async traverseJSON(
    node: any,
    path: string,
    parentPath: string | null,
    depth: number,
    options: Required<SmartJSONOptions>,
    entities: ExtractedJSONEntity[],
    relationships: ExtractedJSONRelationship[],
    entityMap: Map<string, string>,
    stats: SmartJSONResult['stats'],
    onNode: () => void
  ): Promise<void> {
    // Stop if max depth reached
    if (depth > options.maxDepth) return

    onNode()
    stats.byDepth[depth] = (stats.byDepth[depth] || 0) + 1

    // Handle null/undefined
    if (node === null || node === undefined) return

    // Handle arrays
    if (Array.isArray(node)) {
      for (let i = 0; i < node.length; i++) {
        await this.traverseJSON(
          node[i],
          `${path}[${i}]`,
          path,
          depth + 1,
          options,
          entities,
          relationships,
          entityMap,
          stats,
          onNode
        )
      }
      return
    }

    // Handle objects
    if (typeof node === 'object') {
      // Extract entity from this object
      const entity = await this.extractEntityFromObject(
        node,
        path,
        parentPath,
        depth,
        options,
        stats
      )

      if (entity) {
        entities.push(entity)
        entityMap.set(path, entity.id)

        // Create hierarchical relationship if parent exists
        if (options.enableHierarchicalRelationships && parentPath && entityMap.has(parentPath)) {
          const parentId = entityMap.get(parentPath)!

          // Extract parent and child names from paths
          const parentName = parentPath.split('.').pop()?.replace(/\[(\d+)\]/, 'item $1') || 'parent'
          const childName = entity.name

          // Infer relationship type using SmartRelationshipExtractor
          const context = `Hierarchical JSON structure: ${parentName} contains ${childName}. Parent path: ${parentPath}, Child path: ${path}`

          const inferredRelationship = await this.relationshipExtractor.infer(
            parentName,
            childName,
            context,
            {
              objectType: entity.type  // Pass child entity type as hint
            }
          )

          relationships.push({
            from: parentId,
            to: entity.id,
            type: inferredRelationship?.type || VerbType.Contains,  // Fallback to Contains for hierarchical relationships
            confidence: inferredRelationship?.confidence || 0.95,
            evidence: inferredRelationship?.evidence || `Hierarchical relationship: ${parentPath} contains ${path}`
          })
        }
      }

      // Traverse child properties
      for (const [key, value] of Object.entries(node)) {
        const childPath = path ? `${path}.${key}` : key
        await this.traverseJSON(
          value,
          childPath,
          path,
          depth + 1,
          options,
          entities,
          relationships,
          entityMap,
          stats,
          onNode
        )
      }
      return
    }

    // Handle primitive values (strings)
    if (typeof node === 'string' && node.length >= options.minStringLength) {
      // Extract entities from text
      if (options.enableNeuralExtraction) {
        const extractedEntities = await this.extractor.extract(node, {
          confidence: options.confidenceThreshold,
          neuralMatching: true,
          cache: { enabled: true }
        })

        for (const extracted of extractedEntities) {
          const entity: ExtractedJSONEntity = {
            id: this.generateEntityId(extracted.text, path),
            name: extracted.text,
            type: extracted.type,
            description: node,
            confidence: extracted.confidence,
            path,
            parentPath,
            metadata: {
              source: 'json',
              depth,
              extractedAt: Date.now()
            }
          }

          entities.push(entity)
          this.updateStats(stats, entity.type, entity.confidence, depth)

          // Link to parent if exists
          if (options.enableHierarchicalRelationships && parentPath && entityMap.has(parentPath)) {
            const parentId = entityMap.get(parentPath)!

            // Extract parent name from path
            const parentName = parentPath.split('.').pop()?.replace(/\[(\d+)\]/, 'item $1') || 'parent'
            const childName = entity.name

            // Infer relationship type using SmartRelationshipExtractor
            // Context: entity was extracted from string value within parent container
            const context = `Entity "${childName}" found in text value at path ${path} within parent "${parentName}". Full text: "${node.substring(0, 200)}..."`

            const inferredRelationship = await this.relationshipExtractor.infer(
              parentName,
              childName,
              context,
              {
                objectType: entity.type  // Pass extracted entity type as hint
              }
            )

            relationships.push({
              from: parentId,
              to: entity.id,
              type: inferredRelationship?.type || VerbType.RelatedTo,  // Fallback to RelatedTo for text extraction
              confidence: inferredRelationship?.confidence || (extracted.confidence * 0.9),
              evidence: inferredRelationship?.evidence || `Found in: ${path}`
            })
          }
        }
      }
    }
  }

  /**
   * Extract entity from JSON object
   */
  private async extractEntityFromObject(
    obj: Record<string, any>,
    path: string,
    parentPath: string | null,
    depth: number,
    options: Required<SmartJSONOptions>,
    stats: SmartJSONResult['stats']
  ): Promise<ExtractedJSONEntity | null> {
    // Find name
    const name = this.findValue(obj, options.nameKeys)
    if (!name) return null

    // Find description
    const description = this.findValue(obj, options.descriptionKeys) || name

    // Find type
    const typeString = this.findValue(obj, options.typeKeys)
    const type = typeString ? this.mapTypeString(typeString) : this.inferTypeFromStructure(obj)

    // Extract concepts if enabled
    let concepts: string[] = []
    if (options.enableConceptExtraction && description.length > 0) {
      try {
        concepts = await this.brain.extractConcepts(description, { limit: 10 })
      } catch (error) {
        concepts = []
      }
    }

    const entity: ExtractedJSONEntity = {
      id: this.generateEntityId(name, path),
      name,
      type,
      description,
      confidence: 0.9, // Objects with explicit structure have high confidence
      path,
      parentPath,
      metadata: {
        source: 'json',
        depth,
        originalObject: obj,
        concepts,
        extractedAt: Date.now()
      }
    }

    this.updateStats(stats, entity.type, entity.confidence, depth)

    return entity
  }

  /**
   * Find value in object by key patterns
   */
  private findValue(obj: Record<string, any>, keys: string[]): string | null {
    for (const key of keys) {
      if (obj[key] !== undefined && obj[key] !== null) {
        const value = String(obj[key]).trim()
        if (value.length > 0) {
          return value
        }
      }
    }

    // Try case-insensitive match
    for (const key of keys) {
      const found = Object.keys(obj).find(k => k.toLowerCase() === key.toLowerCase())
      if (found && obj[found] !== undefined && obj[found] !== null) {
        const value = String(obj[found]).trim()
        if (value.length > 0) {
          return value
        }
      }
    }

    return null
  }

  /**
   * Infer type from JSON structure
   */
  private inferTypeFromStructure(obj: Record<string, any>): NounType {
    const keys = Object.keys(obj).map(k => k.toLowerCase())

    // Check for common patterns
    if (keys.some(k => k.includes('person') || k.includes('user') || k.includes('author'))) {
      return NounType.Person
    }
    if (keys.some(k => k.includes('location') || k.includes('place') || k.includes('address'))) {
      return NounType.Location
    }
    if (keys.some(k => k.includes('organization') || k.includes('company') || k.includes('org'))) {
      return NounType.Organization
    }
    if (keys.some(k => k.includes('event') || k.includes('date') || k.includes('time'))) {
      return NounType.Event
    }
    if (keys.some(k => k.includes('project') || k.includes('task'))) {
      return NounType.Project
    }
    if (keys.some(k => k.includes('document') || k.includes('file') || k.includes('url'))) {
      return NounType.Document
    }

    return NounType.Thing
  }

  /**
   * Map type string to NounType
   */
  private mapTypeString(typeString: string): NounType {
    const normalized = typeString.toLowerCase().trim()

    const mapping: Record<string, NounType> = {
      'person': NounType.Person,
      'user': NounType.Person,
      'character': NounType.Person,
      'place': NounType.Location,
      'location': NounType.Location,
      'organization': NounType.Organization,
      'company': NounType.Organization,
      'org': NounType.Organization,
      'concept': NounType.Concept,
      'idea': NounType.Concept,
      'event': NounType.Event,
      'product': NounType.Product,
      'item': NounType.Product,
      'document': NounType.Document,
      'file': NounType.File,
      'project': NounType.Project,
      'thing': NounType.Thing
    }

    return mapping[normalized] || NounType.Thing
  }

  /**
   * Generate consistent entity ID
   */
  private generateEntityId(name: string, path: string): string {
    const normalized = name.toLowerCase().trim().replace(/\s+/g, '_')
    const pathNorm = path.replace(/[^a-zA-Z0-9]/g, '_')
    return `ent_${normalized}_${pathNorm}_${Date.now()}`
  }

  /**
   * Update statistics
   */
  private updateStats(
    stats: SmartJSONResult['stats'],
    type: NounType,
    confidence: number,
    depth: number
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
