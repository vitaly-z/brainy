/**
 * Smart YAML Importer
 *
 * Extracts entities and relationships from YAML files using:
 * - YAML parsing to JSON-like structure
 * - Recursive traversal of nested structures
 * - NeuralEntityExtractor for entity extraction from text values
 * - NaturalLanguageProcessor for relationship inference
 * - Hierarchical relationship creation (parent-child, contains, etc.)
 *
 * New format handler
 * NO MOCKS - Production-ready implementation
 */

import { Brainy } from '../brainy.js'
import { NeuralEntityExtractor, ExtractedEntity } from '../neural/entityExtractor.js'
import { NaturalLanguageProcessor } from '../neural/naturalLanguageProcessor.js'
import { SmartRelationshipExtractor } from '../neural/SmartRelationshipExtractor.js'
import { NounType, VerbType } from '../types/graphTypes.js'
import * as yaml from 'js-yaml'

export interface SmartYAMLOptions {
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

export interface ExtractedYAMLEntity {
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

  /** Weight/importance score */
  weight?: number

  /** YAML path to this entity */
  path: string

  /** Parent path in YAML hierarchy */
  parentPath: string | null

  /** Metadata */
  metadata: Record<string, any>
}

export interface ExtractedYAMLRelationship {
  from: string
  to: string
  type: VerbType
  confidence: number
  weight?: number
  evidence: string
}

export interface SmartYAMLResult {
  /** Total nodes processed */
  nodesProcessed: number

  /** Entities extracted */
  entitiesExtracted: number

  /** Relationships inferred */
  relationshipsInferred: number

  /** All extracted entities */
  entities: ExtractedYAMLEntity[]

  /** All relationships */
  relationships: ExtractedYAMLRelationship[]

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
 * SmartYAMLImporter - Extracts structured knowledge from YAML files
 */
export class SmartYAMLImporter {
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
   * Extract entities and relationships from YAML string or buffer
   */
  async extract(
    yamlContent: string | Buffer,
    options: SmartYAMLOptions = {}
  ): Promise<SmartYAMLResult> {
    const startTime = Date.now()

    // Report parsing start
    options.onProgress?.({
      processed: 0,
      entities: 0,
      relationships: 0
    })

    // Parse YAML to JavaScript object
    const yamlString = typeof yamlContent === 'string'
      ? yamlContent
      : yamlContent.toString('utf-8')

    let data: any
    try {
      data = yaml.load(yamlString)
    } catch (error: any) {
      throw new Error(`Failed to parse YAML: ${error.message}`)
    }

    // Report parsing complete
    options.onProgress?.({
      processed: 0,
      entities: 0,
      relationships: 0
    })

    // Process as JSON-like structure
    const result = await this.extractFromData(data, options)
    result.processingTime = Date.now() - startTime

    return result
  }

  /**
   * Extract entities and relationships from parsed YAML data
   */
  private async extractFromData(
    data: any,
    options: SmartYAMLOptions
  ): Promise<SmartYAMLResult> {
    const opts = {
      enableNeuralExtraction: options.enableNeuralExtraction !== false,
      enableHierarchicalRelationships: options.enableHierarchicalRelationships !== false,
      enableConceptExtraction: options.enableConceptExtraction !== false,
      confidenceThreshold: options.confidenceThreshold || 0.6,
      maxDepth: options.maxDepth || 10,
      minStringLength: options.minStringLength || 3,
      nameKeys: options.nameKeys || ['name', 'title', 'label', 'id'],
      descriptionKeys: options.descriptionKeys || ['description', 'desc', 'summary', 'value'],
      typeKeys: options.typeKeys || ['type', 'kind', 'category'],
      onProgress: options.onProgress
    }

    const entities: ExtractedYAMLEntity[] = []
    const relationships: ExtractedYAMLRelationship[] = []
    const entityMap = new Map<string, string>()
    let nodesProcessed = 0

    const stats = {
      byType: {} as Record<string, number>,
      byDepth: {} as Record<number, number>,
      byConfidence: { high: 0, medium: 0, low: 0 }
    }

    // Traverse YAML structure recursively
    const traverse = async (
      obj: any,
      path: string = '$',
      depth: number = 0,
      parentPath: string | null = null
    ): Promise<void> => {
      if (depth > opts.maxDepth) return

      nodesProcessed++
      stats.byDepth[depth] = (stats.byDepth[depth] || 0) + 1

      // Report progress
      if (options.onProgress && nodesProcessed % 10 === 0) {
        options.onProgress({
          processed: nodesProcessed,
          entities: entities.length,
          relationships: relationships.length
        })
      }

      // Handle different value types
      if (obj === null || obj === undefined) {
        return
      }

      // Handle arrays
      if (Array.isArray(obj)) {
        for (let i = 0; i < obj.length; i++) {
          await traverse(obj[i], `${path}[${i}]`, depth + 1, path)
        }
        return
      }

      // Handle objects
      if (typeof obj === 'object') {
        // Extract entity from object
        const entity = await this.extractEntityFromObject(
          obj,
          path,
          parentPath,
          depth,
          opts
        )

        if (entity) {
          entities.push(entity)
          entityMap.set(path, entity.id)

          // Update stats
          stats.byType[entity.type] = (stats.byType[entity.type] || 0) + 1
          if (entity.confidence > 0.8) stats.byConfidence.high++
          else if (entity.confidence >= 0.6) stats.byConfidence.medium++
          else stats.byConfidence.low++

          // Create hierarchical relationship
          if (opts.enableHierarchicalRelationships && parentPath) {
            const parentId = entityMap.get(parentPath)
            if (parentId) {
              // Extract parent name from path for better context
              const parentName = parentPath.split('.').pop()?.replace(/\[(\d+)\]/, 'item $1') || 'parent'
              const childName = entity.name

              // Infer relationship type using SmartRelationshipExtractor
              const context = `Hierarchical YAML structure: ${parentName} contains ${childName}. Parent path: ${parentPath}, Child path: ${entity.path}`

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
                confidence: inferredRelationship?.confidence || 0.9,
                weight: inferredRelationship?.weight || 1.0,
                evidence: inferredRelationship?.evidence || 'Hierarchical parent-child relationship in YAML structure'
              })
            }
          }
        }

        // Traverse nested objects
        for (const [key, value] of Object.entries(obj)) {
          await traverse(value, `${path}.${key}`, depth + 1, path)
        }

        return
      }

      // Handle primitive values (strings, numbers, booleans)
      if (typeof obj === 'string' && obj.length >= opts.minStringLength) {
        // Extract entities from string values
        if (opts.enableNeuralExtraction) {
          const extractedEntities = await this.extractor.extract(obj, {
            confidence: opts.confidenceThreshold
          })

          for (const extracted of extractedEntities) {
            const entityId = `${path}:${extracted.text}`
            const entity: ExtractedYAMLEntity = {
              id: entityId,
              name: extracted.text,
              type: extracted.type,
              description: obj,
              confidence: extracted.confidence,
              weight: extracted.weight || 1.0,
              path,
              parentPath,
              metadata: {
                position: extracted.position,
                extractedFrom: 'string-value'
              }
            }

            entities.push(entity)
            entityMap.set(entityId, entityId)

            // Update stats
            stats.byType[entity.type] = (stats.byType[entity.type] || 0) + 1
            if (entity.confidence > 0.8) stats.byConfidence.high++
            else if (entity.confidence >= 0.6) stats.byConfidence.medium++
            else stats.byConfidence.low++
          }
        }
      }
    }

    // Start traversal
    await traverse(data)

    // Final progress report
    if (options.onProgress) {
      options.onProgress({
        processed: nodesProcessed,
        entities: entities.length,
        relationships: relationships.length
      })
    }

    return {
      nodesProcessed,
      entitiesExtracted: entities.length,
      relationshipsInferred: relationships.length,
      entities,
      relationships,
      entityMap,
      processingTime: 0, // Will be set by caller
      stats
    }
  }

  /**
   * Extract an entity from a YAML object node
   */
  private async extractEntityFromObject(
    obj: any,
    path: string,
    parentPath: string | null,
    depth: number,
    opts: {
      enableNeuralExtraction: boolean
      enableHierarchicalRelationships: boolean
      enableConceptExtraction: boolean
      confidenceThreshold: number
      maxDepth: number
      minStringLength: number
      nameKeys: string[]
      descriptionKeys: string[]
      typeKeys: string[]
      onProgress?: (stats: { processed: number; entities: number; relationships: number }) => void
    }
  ): Promise<ExtractedYAMLEntity | null> {
    // Try to find name
    let name: string | null = null
    for (const key of opts.nameKeys) {
      if (obj[key] && typeof obj[key] === 'string') {
        name = obj[key]
        break
      }
    }

    // If no explicit name, use path segment
    if (!name) {
      const segments = path.split('.')
      name = segments[segments.length - 1]
      if (name === '$') name = 'root'
    }

    // Try to find description
    let description = name
    for (const key of opts.descriptionKeys) {
      if (obj[key] && typeof obj[key] === 'string') {
        description = obj[key]
        break
      }
    }

    // Try to find explicit type
    let explicitType: string | null = null
    for (const key of opts.typeKeys) {
      if (obj[key] && typeof obj[key] === 'string') {
        explicitType = obj[key]
        break
      }
    }

    // Classify entity type using SmartExtractor
    const classification = await this.extractor.extract(description, {
      confidence: opts.confidenceThreshold
    })

    const entityType = classification.length > 0
      ? classification[0].type
      : NounType.Thing

    const confidence = classification.length > 0
      ? classification[0].confidence
      : 0.5

    const weight = classification.length > 0
      ? classification[0].weight || 1.0
      : 1.0

    // Create entity
    const entity: ExtractedYAMLEntity = {
      id: path,
      name,
      type: entityType,
      description,
      confidence,
      weight,
      path,
      parentPath,
      metadata: {
        depth,
        explicitType,
        yamlKeys: Object.keys(obj)
      }
    }

    return entity
  }
}
