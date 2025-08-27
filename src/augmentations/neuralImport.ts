/**
 * Neural Import Augmentation - AI-Powered Data Understanding
 * 
 * 🧠 Built-in AI augmentation for intelligent data processing
 * ⚛️ Always free, always included, always enabled
 * 
 * Now using the unified BrainyAugmentation interface!
 */

import { BaseAugmentation, AugmentationContext } from './brainyAugmentation.js'
import { NounType, VerbType } from '../types/graphTypes.js'
import * as fs from '../universal/fs.js'
import * as path from '../universal/path.js'
import { IntelligentTypeMatcher, getTypeMatcher } from './typeMatching/intelligentTypeMatcher.js'
import { prodLog } from '../utils/logger.js'

// Neural Import Analysis Types
export interface NeuralAnalysisResult {
  detectedEntities: DetectedEntity[]
  detectedRelationships: DetectedRelationship[]
  confidence: number
  insights: NeuralInsight[]
}

export interface DetectedEntity {
  originalData: any
  nounType: string
  confidence: number
  suggestedId: string
  reasoning: string
  alternativeTypes: Array<{ type: string, confidence: number }>
}

export interface DetectedRelationship {
  sourceId: string
  targetId: string
  verbType: string
  confidence: number
  weight: number
  reasoning: string
  context: string
  metadata?: Record<string, any>
}

export interface NeuralInsight {
  type: 'hierarchy' | 'cluster' | 'pattern' | 'anomaly' | 'opportunity'
  description: string
  confidence: number
  affectedEntities: string[]
  recommendation?: string
}

export interface NeuralImportConfig {
  confidenceThreshold: number
  enableWeights: boolean
  skipDuplicates: boolean
  categoryFilter?: string[]
  dataType?: string
}

/**
 * Neural Import Augmentation - Unified Implementation
 * Processes data with AI before storage operations
 */
export class NeuralImportAugmentation extends BaseAugmentation {
  readonly name = 'neural-import'
  readonly timing = 'before' as const  // Process data before storage
  readonly metadata = {
    reads: '*' as '*',  // Needs to read data for analysis
    writes: ['_neuralProcessed', '_neuralConfidence', '_detectedEntities', '_detectedRelationships', '_neuralInsights', 'nounType', 'verbType'] as string[]
  }  // Enriches metadata with neural analysis
  operations = ['add', 'addNoun', 'addVerb', 'all'] as ('add' | 'addNoun' | 'addVerb' | 'all')[]  // Use 'all' to catch batch operations
  readonly priority = 80  // High priority for data processing
  
  private config: NeuralImportConfig
  private analysisCache = new Map<string, NeuralAnalysisResult>()
  private typeMatcher: IntelligentTypeMatcher | null = null

  constructor(config: Partial<NeuralImportConfig> = {}) {
    super()
    this.config = {
      confidenceThreshold: 0.7,
      enableWeights: true,
      skipDuplicates: true,
      dataType: 'json',
      ...config
    }
  }

  protected async onInitialize(): Promise<void> {
    try {
      this.typeMatcher = await getTypeMatcher()
      this.log('🧠 Neural Import augmentation initialized with intelligent type matching')
    } catch (error) {
      this.log('⚠️ Failed to initialize type matcher, falling back to heuristics', 'warn')
    }
  }

  protected async onShutdown(): Promise<void> {
    this.analysisCache.clear()
    this.log('🧠 Neural Import augmentation shut down')
  }

  /**
   * Execute augmentation - process data with AI before storage
   */
  async execute<T = any>(
    operation: string,
    params: any,
    next: () => Promise<T>
  ): Promise<T> {
    // Only process on add operations
    if (!this.operations.includes(operation as any)) {
      return next()
    }

    try {
      // Extract data from params based on operation
      const rawData = this.extractRawData(operation, params)
      if (!rawData) {
        return next()
      }

      // Perform neural analysis
      const analysis = await this.performNeuralAnalysis(rawData, this.config)
      
      // Enhance params with neural insights
      if (params.metadata) {
        params.metadata._neuralProcessed = true
        params.metadata._neuralConfidence = analysis.confidence
        params.metadata._detectedEntities = analysis.detectedEntities.length
        params.metadata._detectedRelationships = analysis.detectedRelationships.length
        params.metadata._neuralInsights = analysis.insights
      } else if (typeof params === 'object') {
        params.metadata = {
          _neuralProcessed: true,
          _neuralConfidence: analysis.confidence,
          _detectedEntities: analysis.detectedEntities.length,
          _detectedRelationships: analysis.detectedRelationships.length,
          _neuralInsights: analysis.insights
        }
      }

      // Store neural analysis for later retrieval
      await this.storeNeuralAnalysis(analysis)
      
      // If we detected entities/relationships, potentially add them
      if (this.context?.brain && analysis.detectedEntities.length > 0) {
        // This could automatically create entities/relationships
        // But for now, just enhance the metadata
        this.log(`Detected ${analysis.detectedEntities.length} entities and ${analysis.detectedRelationships.length} relationships`)
      }
      
      // Continue with enhanced data
      return next()
    } catch (error) {
      this.log(`Neural analysis failed: ${error}`, 'warn')
      // Continue without neural processing
      return next()
    }
  }

  /**
   * Extract raw data from operation params
   */
  private extractRawData(operation: string, params: any): any {
    switch (operation) {
      case 'add':
        return params.content || params.data || params
      case 'addNoun':
        return params.noun || params.data || params
      case 'addVerb':
        return params.verb || params
      case 'addBatch':
        return params.items || params.batch || params
      default:
        return null
    }
  }

  /**
   * Get the full neural analysis result (for external use)
   */
  async getNeuralAnalysis(rawData: Buffer | string, dataType?: string): Promise<NeuralAnalysisResult> {
    const parsedData = await this.parseRawData(rawData, dataType || this.config.dataType || 'json')
    return await this.performNeuralAnalysis(parsedData, this.config)
  }

  /**
   * Parse raw data based on type
   */
  private async parseRawData(rawData: Buffer | string, dataType: string): Promise<any[]> {
    const content = typeof rawData === 'string' ? rawData : rawData.toString('utf8')

    switch (dataType.toLowerCase()) {
      case 'json':
        try {
          const jsonData = JSON.parse(content)
          return Array.isArray(jsonData) ? jsonData : [jsonData]
        } catch {
          // If JSON parse fails, treat as text
          return [{ text: content }]
        }
      
      case 'csv':
        return this.parseCSV(content)
      
      case 'yaml':
      case 'yml':
        return this.parseYAML(content)
      
      case 'txt':
      case 'text':
        // Split text into sentences/paragraphs for analysis
        return content.split(/\n+/).filter(line => line.trim()).map(line => ({ text: line }))
      
      default:
        // Unknown type, treat as text
        return [{ text: content }]
    }
  }

  /**
   * Parse CSV data - handles quoted values, escaped quotes, and edge cases
   */
  private parseCSV(content: string): any[] {
    const lines = content.split('\n')
    if (lines.length === 0) return []
    
    // Parse a CSV line handling quotes
    const parseLine = (line: string): string[] => {
      const result: string[] = []
      let current = ''
      let inQuotes = false
      let i = 0
      
      while (i < line.length) {
        const char = line[i]
        const nextChar = line[i + 1]
        
        if (char === '"') {
          if (inQuotes && nextChar === '"') {
            // Escaped quote
            current += '"'
            i += 2
          } else {
            // Toggle quote mode
            inQuotes = !inQuotes
            i++
          }
        } else if (char === ',' && !inQuotes) {
          // Field separator
          result.push(current.trim())
          current = ''
          i++
        } else {
          current += char
          i++
        }
      }
      
      // Add last field
      result.push(current.trim())
      return result
    }
    
    // Parse headers
    const headers = parseLine(lines[0])
    const data = []
    
    // Parse data rows
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim()
      if (!line) continue // Skip empty lines
      
      const values = parseLine(line)
      const row: any = {}
      
      headers.forEach((header, index) => {
        const value = values[index] || ''
        // Try to parse numbers
        const num = Number(value)
        row[header] = !isNaN(num) && value !== '' ? num : value
      })
      
      data.push(row)
    }
    
    return data
  }
  
  /**
   * Parse YAML data
   */
  private parseYAML(content: string): any[] {
    try {
      // Simple YAML parser for basic structures
      // For full YAML support, we'd use js-yaml library
      const lines = content.split('\n')
      const result: any[] = []
      let currentObject: any = null
      let currentIndent = 0
      
      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed || trimmed.startsWith('#')) continue // Skip empty lines and comments
        
        // Calculate indentation
        const indent = line.length - line.trimStart().length
        
        // Check for array item
        if (trimmed.startsWith('- ')) {
          const value = trimmed.substring(2).trim()
          if (indent === 0) {
            // Top-level array item
            if (value.includes(':')) {
              // Object in array
              currentObject = {}
              result.push(currentObject)
              const [key, val] = value.split(':').map(s => s.trim())
              currentObject[key] = this.parseYAMLValue(val)
            } else {
              result.push(this.parseYAMLValue(value))
            }
          } else if (currentObject) {
            // Nested array
            const lastKey = Object.keys(currentObject).pop()
            if (lastKey) {
              if (!Array.isArray(currentObject[lastKey])) {
                currentObject[lastKey] = []
              }
              currentObject[lastKey].push(this.parseYAMLValue(value))
            }
          }
        } else if (trimmed.includes(':')) {
          // Key-value pair
          const colonIndex = trimmed.indexOf(':')
          const key = trimmed.substring(0, colonIndex).trim()
          const value = trimmed.substring(colonIndex + 1).trim()
          
          if (indent === 0) {
            // Top-level object
            if (!currentObject) {
              currentObject = {}
              result.push(currentObject)
            }
            currentObject[key] = this.parseYAMLValue(value)
            currentIndent = 0
          } else if (currentObject) {
            // Nested object
            if (indent > currentIndent && !value) {
              // Start of nested object
              const lastKey = Object.keys(currentObject).pop()
              if (lastKey) {
                currentObject[lastKey] = { [key]: '' }
              }
            } else {
              currentObject[key] = this.parseYAMLValue(value)
            }
            currentIndent = indent
          }
        }
      }
      
      // If we built a single object and not an array, wrap it
      if (result.length === 0 && currentObject) {
        result.push(currentObject)
      }
      
      return result.length > 0 ? result : [{ text: content }]
    } catch (error) {
      prodLog.warn('YAML parsing failed, treating as text:', error)
      return [{ text: content }]
    }
  }
  
  /**
   * Parse a YAML value (handle strings, numbers, booleans, null)
   */
  private parseYAMLValue(value: string): any {
    if (!value || value === '~' || value === 'null') return null
    if (value === 'true') return true
    if (value === 'false') return false
    
    // Remove quotes if present
    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
      return value.slice(1, -1)
    }
    
    // Try to parse as number
    const num = Number(value)
    if (!isNaN(num) && value !== '') return num
    
    return value
  }

  /**
   * Perform neural analysis on parsed data
   */
  private async performNeuralAnalysis(data: any[], config?: any): Promise<NeuralAnalysisResult> {
    const detectedEntities: DetectedEntity[] = []
    const detectedRelationships: DetectedRelationship[] = []
    const insights: NeuralInsight[] = []
    
    // Simple entity detection (in real implementation, would use ML)
    for (const item of data) {
      if (typeof item === 'object') {
        // Detect entities from object properties
        const entityId = item.id || item.name || item.title || `entity_${Date.now()}_${Math.random()}`
        
        detectedEntities.push({
          originalData: item,
          nounType: await this.inferNounType(item),
          confidence: 0.85,
          suggestedId: String(entityId),
          reasoning: 'Detected from structured data',
          alternativeTypes: []
        })
        
        // Detect relationships from references
        await this.detectRelationships(item, entityId, detectedRelationships)
      }
    }
    
    // Generate insights
    if (detectedEntities.length > 10) {
      insights.push({
        type: 'pattern',
        description: `Large dataset with ${detectedEntities.length} entities detected`,
        confidence: 0.9,
        affectedEntities: detectedEntities.slice(0, 5).map(e => e.suggestedId),
        recommendation: 'Consider batch processing for optimal performance'
      })
    }
    
    // Look for clusters
    const typeGroups = this.groupByType(detectedEntities)
    if (Object.keys(typeGroups).length > 1) {
      insights.push({
        type: 'cluster',
        description: `Multiple entity types detected: ${Object.keys(typeGroups).join(', ')}`,
        confidence: 0.8,
        affectedEntities: [],
        recommendation: 'Data contains diverse entity types suitable for graph analysis'
      })
    }
    
    return {
      detectedEntities,
      detectedRelationships,
      confidence: detectedEntities.length > 0 ? 0.85 : 0.5,
      insights
    }
  }

  /**
   * Infer noun type from object structure using intelligent type matching
   */
  private async inferNounType(obj: any): Promise<string> {
    if (!this.typeMatcher) {
      // Initialize type matcher if not available
      this.typeMatcher = await getTypeMatcher()
    }
    
    const result = await this.typeMatcher.matchNounType(obj)
    
    // Log if confidence is low for debugging
    if (result.confidence < 0.5) {
      this.log(`Low confidence (${result.confidence.toFixed(2)}) for noun type: ${result.type}`, 'warn')
    }
    
    return result.type
  }

  /**
   * Detect relationships from object references
   */
  private async detectRelationships(obj: any, sourceId: string, relationships: DetectedRelationship[]): Promise<void> {
    // Look for reference patterns
    for (const [key, value] of Object.entries(obj)) {
      if (key.endsWith('Id') || key.endsWith('_id') || key === 'parentId' || key === 'userId') {
        relationships.push({
          sourceId,
          targetId: String(value),
          verbType: await this.inferVerbType(key, obj, { id: value }),
          confidence: 0.75,
          weight: 1,
          reasoning: `Reference detected in field: ${key}`,
          context: key
        })
      }
      
      // Array of IDs
      if (Array.isArray(value) && value.length > 0 && typeof value[0] === 'string') {
        if (key.endsWith('Ids') || key.endsWith('_ids')) {
          for (const targetId of value) {
            relationships.push({
              sourceId,
              targetId: String(targetId),
              verbType: await this.inferVerbType(key, obj, { id: targetId }),
              confidence: 0.7,
              weight: 1,
              reasoning: `Array reference in field: ${key}`,
              context: key
            })
          }
        }
      }
    }
  }

  /**
   * Infer verb type from field name using intelligent type matching
   */
  private async inferVerbType(fieldName: string, sourceObj?: any, targetObj?: any): Promise<string> {
    if (!this.typeMatcher) {
      // Initialize type matcher if not available
      this.typeMatcher = await getTypeMatcher()
    }
    
    const result = await this.typeMatcher.matchVerbType(sourceObj, targetObj, fieldName)
    
    // Log if confidence is low for debugging
    if (result.confidence < 0.5) {
      this.log(`Low confidence (${result.confidence.toFixed(2)}) for verb type: ${result.type}`, 'warn')
    }
    
    return result.type
  }

  /**
   * Group entities by type
   */
  private groupByType(entities: DetectedEntity[]): Record<string, DetectedEntity[]> {
    const groups: Record<string, DetectedEntity[]> = {}
    
    for (const entity of entities) {
      if (!groups[entity.nounType]) {
        groups[entity.nounType] = []
      }
      groups[entity.nounType].push(entity)
    }
    
    return groups
  }

  /**
   * Store neural analysis results
   */
  private async storeNeuralAnalysis(analysis: NeuralAnalysisResult): Promise<void> {
    // Cache the analysis for potential later use
    const key = `analysis_${Date.now()}`
    this.analysisCache.set(key, analysis)
    
    // Limit cache size
    if (this.analysisCache.size > 100) {
      const firstKey = this.analysisCache.keys().next().value
      if (firstKey) {
        this.analysisCache.delete(firstKey)
      }
    }
  }

  /**
   * Helper to get data type from file path
   */
  private getDataTypeFromPath(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase()
    switch (ext) {
      case '.json': return 'json'
      case '.csv': return 'csv'
      case '.txt': return 'text'
      case '.yaml':
      case '.yml': return 'yaml'
      default: return 'text'
    }
  }

  /**
   * PUBLIC API: Process raw data (for external use, like Synapses)
   * This maintains compatibility with code that wants to use Neural Import directly
   */
  async processRawData(
    rawData: Buffer | string,
    dataType: string,
    options?: Record<string, unknown>
  ): Promise<{
    success: boolean
    data: {
      nouns: string[]
      verbs: string[]
      confidence?: number
      insights?: Array<{
        type: string
        description: string
        confidence: number
      }>
      metadata?: Record<string, unknown>
    }
    error?: string
  }> {
    try {
      const analysis = await this.getNeuralAnalysis(rawData, dataType)
      
      // Convert to legacy format for compatibility
      const nouns = analysis.detectedEntities.map(e => e.suggestedId)
      const verbs = analysis.detectedRelationships.map(r => 
        `${r.sourceId}->${r.verbType}->${r.targetId}`
      )
      
      return {
        success: true,
        data: {
          nouns,
          verbs,
          confidence: analysis.confidence,
          insights: analysis.insights.map(i => ({
            type: i.type,
            description: i.description,
            confidence: i.confidence
          })),
          metadata: {
            detectedEntities: analysis.detectedEntities.length,
            detectedRelationships: analysis.detectedRelationships.length,
            timestamp: new Date().toISOString()
          }
        }
      }
    } catch (error) {
      return {
        success: false,
        data: { nouns: [], verbs: [] },
        error: error instanceof Error ? error.message : 'Neural analysis failed'
      }
    }
  }
}