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
  operations = ['add', 'addNoun', 'addVerb', 'all'] as ('add' | 'addNoun' | 'addVerb' | 'all')[]  // Use 'all' to catch batch operations
  readonly priority = 80  // High priority for data processing
  
  private config: NeuralImportConfig
  private analysisCache = new Map<string, NeuralAnalysisResult>()

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
    this.log('🧠 Neural Import augmentation initialized')
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
        // For now, basic YAML support - in full implementation would use yaml parser
        try {
          return JSON.parse(content) // Placeholder
        } catch {
          return [{ text: content }]
        }
      
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
   * Parse CSV data
   */
  private parseCSV(content: string): any[] {
    const lines = content.split('\n').filter(line => line.trim())
    if (lines.length === 0) return []
    
    const headers = lines[0].split(',').map(h => h.trim())
    const data = []
    
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(v => v.trim())
      const row: any = {}
      headers.forEach((header, index) => {
        row[header] = values[index] || ''
      })
      data.push(row)
    }
    
    return data
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
          nounType: this.inferNounType(item),
          confidence: 0.85,
          suggestedId: String(entityId),
          reasoning: 'Detected from structured data',
          alternativeTypes: []
        })
        
        // Detect relationships from references
        this.detectRelationships(item, entityId, detectedRelationships)
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
   * Infer noun type from object structure
   */
  private inferNounType(obj: any): string {
    // Simple heuristics for type detection
    if (obj.email || obj.username) return 'Person'
    if (obj.title && obj.content) return 'Document'
    if (obj.price || obj.product) return 'Product'
    if (obj.date || obj.timestamp) return 'Event'
    if (obj.url || obj.link) return 'Resource'
    if (obj.lat || obj.longitude) return 'Location'
    
    // Default fallback
    return 'Entity'
  }

  /**
   * Detect relationships from object references
   */
  private detectRelationships(obj: any, sourceId: string, relationships: DetectedRelationship[]): void {
    // Look for reference patterns
    for (const [key, value] of Object.entries(obj)) {
      if (key.endsWith('Id') || key.endsWith('_id') || key === 'parentId' || key === 'userId') {
        relationships.push({
          sourceId,
          targetId: String(value),
          verbType: this.inferVerbType(key),
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
              verbType: this.inferVerbType(key),
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
   * Infer verb type from field name
   */
  private inferVerbType(fieldName: string): string {
    const normalized = fieldName.toLowerCase()
    
    if (normalized.includes('parent')) return 'childOf'
    if (normalized.includes('user')) return 'belongsTo'
    if (normalized.includes('author')) return 'authoredBy'
    if (normalized.includes('owner')) return 'ownedBy'
    if (normalized.includes('creator')) return 'createdBy'
    if (normalized.includes('member')) return 'memberOf'
    if (normalized.includes('tag')) return 'taggedWith'
    if (normalized.includes('category')) return 'categorizedAs'
    
    return 'relatedTo'
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