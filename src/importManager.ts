/**
 * Import Manager - Comprehensive data import with intelligent type detection
 * 
 * Handles multiple data sources:
 * - Direct data (objects, arrays)
 * - Files (JSON, CSV, text)
 * - URLs (fetch and parse)
 * - Streams (for large files)
 * 
 * Uses NeuralImportAugmentation for intelligent processing
 */

import { NounType, VerbType } from './types/graphTypes.js'
import { NeuralImportAugmentation } from './augmentations/neuralImport.js'
import { IntelligentTypeMatcher } from './augmentations/typeMatching/intelligentTypeMatcher.js'
import * as fs from './universal/fs.js'
import * as path from './universal/path.js'
import { prodLog } from './utils/logger.js'

export interface ImportOptions {
  // Source type
  source?: 'data' | 'file' | 'url' | 'auto'
  
  // Data format
  format?: 'json' | 'csv' | 'text' | 'yaml' | 'auto'
  
  // Processing
  batchSize?: number
  autoDetect?: boolean
  typeHint?: NounType
  extractRelationships?: boolean
  
  // CSV specific
  csvDelimiter?: string
  csvHeaders?: boolean
  
  // Performance
  parallel?: boolean
  maxConcurrency?: number
}

export interface ImportResult {
  success: boolean
  nouns: string[]
  verbs: string[]
  errors: string[]
  stats: {
    total: number
    imported: number
    failed: number
    relationships: number
  }
}

export class ImportManager {
  private neuralImport: NeuralImportAugmentation
  private typeMatcher: IntelligentTypeMatcher | null = null
  private brain: any // BrainyData instance
  
  constructor(brain: any) {
    this.brain = brain
    this.neuralImport = new NeuralImportAugmentation()
  }
  
  /**
   * Initialize the import manager
   */
  async init(): Promise<void> {
    // Initialize neural import with proper context
    const context = {
      brain: this.brain,
      storage: this.brain.storage,
      config: {},
      log: (message: string, level?: string) => {
        if (level === 'error') {
          prodLog.error(message)
        } else if (level === 'warn') {
          prodLog.warn(message)
        } else {
          prodLog.info(message)
        }
      }
    }
    await this.neuralImport.initialize(context as any)
    
    // Get type matcher
    const { getTypeMatcher } = await import('./augmentations/typeMatching/intelligentTypeMatcher.js')
    this.typeMatcher = await getTypeMatcher()
  }
  
  /**
   * Main import method - handles all sources
   */
  async import(
    source: string | Buffer | any[] | any,
    options: ImportOptions = {}
  ): Promise<ImportResult> {
    const result: ImportResult = {
      success: false,
      nouns: [],
      verbs: [],
      errors: [],
      stats: {
        total: 0,
        imported: 0,
        failed: 0,
        relationships: 0
      }
    }
    
    try {
      // Detect source type
      const sourceType = await this.detectSourceType(source, options.source)
      
      // Get data based on source type
      let data: any
      let format = options.format || 'auto'
      
      switch (sourceType) {
        case 'url':
          data = await this.fetchFromUrl(source as string)
          break
          
        case 'file':
          const filePath = source as string
          data = await this.readFile(filePath)
          if (format === 'auto') {
            format = this.detectFormatFromPath(filePath)
          }
          break
          
        case 'data':
        default:
          data = source
          break
      }
      
      // Process data through neural import
      let items: any[]
      let relationships: any[] = []
      
      if (Buffer.isBuffer(data) || typeof data === 'string') {
        // Use neural import for parsing and analysis
        const analysis = await this.neuralImport.getNeuralAnalysis(data, format as string)
        
        // Extract items and relationships
        items = analysis.detectedEntities.map(entity => ({
          data: entity.originalData,
          type: entity.nounType,
          confidence: entity.confidence,
          id: entity.suggestedId
        }))
        
        if (options.extractRelationships !== false) {
          relationships = analysis.detectedRelationships
        }
        
        // Log insights
        for (const insight of analysis.insights) {
          prodLog.info(`🧠 ${insight.description} (confidence: ${insight.confidence})`)
        }
      } else if (Array.isArray(data)) {
        items = data
      } else {
        items = [data]
      }
      
      result.stats.total = items.length
      
      // Import items in batches
      const batchSize = options.batchSize || 50
      for (let i = 0; i < items.length; i += batchSize) {
        const batch = items.slice(i, i + batchSize)
        
        // Process batch in parallel if enabled
        const promises = batch.map(async (item) => {
          try {
            // Detect type if needed
            let nounType = item.type || options.typeHint
            if (!nounType && options.autoDetect !== false && this.typeMatcher) {
              const match = await this.typeMatcher.matchNounType(item.data || item)
              nounType = match.type
            }
            
            // Prepare the data to import
            const dataToImport = item.data || item
            
            // Create metadata combining original data with import metadata
            const metadata: any = {
              ...(typeof dataToImport === 'object' ? dataToImport : {}),
              ...(item.data?.metadata || {}),
              nounType,
              _importedAt: new Date().toISOString(),
              _confidence: item.confidence
            }
            
            // Add to brain - pass object once, it becomes both vector source and metadata
            const id = await this.brain.addNoun(metadata)
            result.nouns.push(id)
            result.stats.imported++
            return id
          } catch (error: any) {
            result.errors.push(`Failed to import item: ${error.message}`)
            result.stats.failed++
            return null
          }
        })
        
        if (options.parallel !== false) {
          await Promise.all(promises)
        } else {
          for (const promise of promises) {
            await promise
          }
        }
      }
      
      // Import relationships
      for (const rel of relationships) {
        try {
          // Match verb type if needed
          let verbType = rel.verbType
          if (!Object.values(VerbType).includes(verbType) && this.typeMatcher) {
            const match = await this.typeMatcher.matchVerbType(
              { id: rel.sourceId },
              { id: rel.targetId },
              rel.verbType
            )
            verbType = match.type
          }
          
          const verbId = await this.brain.addVerb(
            rel.sourceId,
            rel.targetId,
            verbType as VerbType,
            rel.metadata,
            rel.weight
          )
          
          result.verbs.push(verbId)
          result.stats.relationships++
        } catch (error: any) {
          result.errors.push(`Failed to create relationship: ${error.message}`)
        }
      }
      
      result.success = result.stats.imported > 0
      
      prodLog.info(`✨ Import complete: ${result.stats.imported}/${result.stats.total} items, ${result.stats.relationships} relationships`)
      
    } catch (error: any) {
      result.errors.push(`Import failed: ${error.message}`)
      prodLog.error('Import failed:', error)
    }
    
    return result
  }
  
  /**
   * Import from file
   */
  async importFile(filePath: string, options: ImportOptions = {}): Promise<ImportResult> {
    return this.import(filePath, { ...options, source: 'file' })
  }
  
  /**
   * Import from URL
   */
  async importUrl(url: string, options: ImportOptions = {}): Promise<ImportResult> {
    return this.import(url, { ...options, source: 'url' })
  }
  
  /**
   * Detect source type
   */
  private async detectSourceType(source: any, hint?: string): Promise<'url' | 'file' | 'data'> {
    if (hint && hint !== 'auto') {
      return hint as any
    }
    
    if (typeof source === 'string') {
      // Check if URL
      if (source.startsWith('http://') || source.startsWith('https://')) {
        return 'url'
      }
      
      // Check if file path exists
      try {
        if (await fs.exists(source)) {
          return 'file'
        }
      } catch {}
    }
    
    return 'data'
  }
  
  /**
   * Detect format from file path
   */
  private detectFormatFromPath(filePath: string): 'json' | 'csv' | 'text' | 'yaml' | 'auto' {
    const ext = path.extname(filePath).toLowerCase()
    switch (ext) {
      case '.json': return 'json'
      case '.csv': return 'csv'
      case '.txt': return 'text'
      case '.md': return 'text'
      case '.yaml':
      case '.yml': return 'yaml'
      default: return 'auto'
    }
  }
  
  /**
   * Read file
   */
  private async readFile(filePath: string): Promise<Buffer> {
    const content = await fs.readFile(filePath, 'utf8')
    return Buffer.from(content, 'utf8')
  }
  
  /**
   * Fetch from URL
   */
  private async fetchFromUrl(url: string): Promise<string> {
    const response = await fetch(url)
    if (!response.ok) {
      throw new Error(`Failed to fetch ${url}: ${response.statusText}`)
    }
    return response.text()
  }
}

/**
 * Create an import manager instance
 */
export function createImportManager(brain: any): ImportManager {
  return new ImportManager(brain)
}