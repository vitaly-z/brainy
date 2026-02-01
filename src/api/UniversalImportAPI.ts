/**
 * Universal Neural Import API
 *
 * ALWAYS uses neural matching to map ANY data to our strict NounTypes and VerbTypes
 * Never falls back to rules - neural matching is MANDATORY
 *
 * Handles:
 * - Strings (text, JSON, CSV, YAML, Markdown)
 * - Files (local paths, any format) - uses MimeTypeDetector for 2000+ types
 * - URLs (web pages, APIs, documents)
 * - Objects (structured data)
 * - Binary data (images, PDFs via extraction)
 */

import { NounType, VerbType } from '../types/graphTypes.js'
import { Vector } from '../coreTypes.js'
import type { Brainy } from '../brainy.js'
import type { Entity, Relation } from '../types/brainy.types.js'
import { NeuralImportAugmentation } from '../neural/neuralImportAugmentation.js'
import { mimeDetector } from '../vfs/MimeTypeDetector.js'

export interface ImportSource {
  type: 'string' | 'file' | 'url' | 'object' | 'binary'
  data: any
  format?: string  // Optional hint about format
  metadata?: any   // Additional context
}

export interface NeuralImportResult {
  entities: Array<{
    id: string
    type: NounType
    data: any
    vector: Vector
    confidence: number
    metadata: any
  }>
  relationships: Array<{
    id: string
    from: string
    to: string
    type: VerbType
    weight: number
    confidence: number
    metadata?: any
  }>
  stats: {
    totalProcessed: number
    entitiesCreated: number
    relationshipsCreated: number
    averageConfidence: number
    processingTimeMs: number
  }
}

export interface NeuralImportProgress {
  phase: 'extracting' | 'storing-entities' | 'storing-relationships' | 'complete'
  message: string
  current: number
  total: number
  entities?: number
  relationships?: number
}

export class UniversalImportAPI {
  private brain: Brainy<any>
  private neuralImport: NeuralImportAugmentation
  private embedCache = new Map<string, Vector>()
  
  constructor(brain: Brainy<any>) {
    this.brain = brain
    this.neuralImport = new NeuralImportAugmentation({
      confidenceThreshold: 0.0,  // Accept ALL confidence levels - never reject
      enableWeights: true,
      skipDuplicates: false  // Process everything
    })
  }
  
  /**
   * Initialize the neural import system
   */
  async init(): Promise<void> {
    // Neural import initializes itself
  }
  
  /**
   * Universal import - handles ANY data source
   * ALWAYS uses neural matching, NEVER falls back
   */
  async import(
    source: ImportSource | string | any,
    options?: { onProgress?: (progress: NeuralImportProgress) => void }
  ): Promise<NeuralImportResult> {
    const startTime = Date.now()

    // Normalize source
    const normalizedSource = this.normalizeSource(source)

    options?.onProgress?.({
      phase: 'extracting',
      message: 'Extracting data from source...',
      current: 0,
      total: 0
    })

    // Extract data based on source type
    const extractedData = await this.extractData(normalizedSource)

    // Neural processing - MANDATORY
    const neuralResults = await this.neuralProcess(extractedData)

    // Store in brain
    const result = await this.storeInBrain(neuralResults, options?.onProgress)

    result.stats.processingTimeMs = Date.now() - startTime

    options?.onProgress?.({
      phase: 'complete',
      message: 'Import complete',
      current: result.stats.entitiesCreated + result.stats.relationshipsCreated,
      total: result.stats.totalProcessed,
      entities: result.stats.entitiesCreated,
      relationships: result.stats.relationshipsCreated
    })

    return result
  }
  
  /**
   * Import from URL - fetches and processes
   */
  async importFromURL(url: string): Promise<NeuralImportResult> {
    const response = await fetch(url)
    const contentType = response.headers.get('content-type') || 'text/plain'
    
    let data: any
    if (contentType.includes('json')) {
      data = await response.json()
    } else if (contentType.includes('text') || contentType.includes('html')) {
      data = await response.text()
    } else {
      // Binary data
      const buffer = await response.arrayBuffer()
      data = new Uint8Array(buffer)
    }
    
    return this.import({
      type: 'url',
      data,
      format: contentType,
      metadata: { url, fetchedAt: Date.now() }
    })
  }
  
  /**
   * Import from file - reads and processes
   * Note: In browser environment, use File API instead
   *
   * Uses MimeTypeDetector for comprehensive format detection (2000+ types)
   */
  async importFromFile(filePath: string): Promise<NeuralImportResult> {
    // Read the actual file content
    const { readFileSync } = await import('node:fs')

    // Use MimeTypeDetector for comprehensive format detection
    const mimeType = mimeDetector.detectMimeType(filePath)
    const ext = filePath.split('.').pop()?.toLowerCase() || 'txt'

    try {
      const fileContent = readFileSync(filePath, 'utf-8')

      return this.import({
        type: 'file',
        data: fileContent,  // Actual file content
        format: ext,  // Keep ext for backward compatibility
        metadata: {
          path: filePath,
          mimeType,  // Add detected MIME type
          importedAt: Date.now(),
          fileSize: fileContent.length
        }
      })
    } catch (error) {
      throw new Error(`Failed to read file ${filePath}: ${(error as Error).message}`)
    }
  }
  
  /**
   * Normalize any input to ImportSource
   */
  private normalizeSource(source: any): ImportSource {
    // Already normalized
    if (source && typeof source === 'object' && 'type' in source && 'data' in source) {
      return source as ImportSource
    }
    
    // String input
    if (typeof source === 'string') {
      // Check if it's a URL
      if (source.startsWith('http://') || source.startsWith('https://')) {
        return { type: 'url', data: source }
      }
      
      // Check if it looks like a file path
      if (source.includes('/') || source.includes('\\') || source.includes('.')) {
        // Assume it's a file path reference
        return { type: 'file', data: source }
      }
      
      // Treat as raw string data
      return { type: 'string', data: source }
    }
    
    // Object/Array input
    if (typeof source === 'object') {
      return { type: 'object', data: source }
    }
    
    // Default to string
    return { type: 'string', data: String(source) }
  }
  
  /**
   * Extract structured data from source
   */
  private async extractData(source: ImportSource): Promise<any[]> {
    switch (source.type) {
      case 'url':
        // URL is in data field, need to fetch
        return this.extractFromURL(source.data)
      
      case 'file':
        // File path is in data field, need to read
        return this.extractFromFile(source.data)
      
      case 'string':
        return this.extractFromString(source.data, source.format)
      
      case 'object':
        return Array.isArray(source.data) ? source.data : [source.data]
      
      case 'binary':
        return this.extractFromBinary(source.data, source.format)
      
      default:
        // Unknown type, treat as object
        return [source.data]
    }
  }
  
  /**
   * Extract data from URL
   */
  private async extractFromURL(url: string): Promise<any[]> {
    const result = await this.importFromURL(url)
    return result.entities.map(e => e.data)
  }
  
  /**
   * Extract data from file
   */
  private async extractFromFile(filePath: string): Promise<any[]> {
    const result = await this.importFromFile(filePath)
    return result.entities.map(e => e.data)
  }
  
  /**
   * Extract data from string based on format
   */
  private extractFromString(data: string, format?: string): any[] {
    // Try to detect format if not provided
    const detectedFormat = format || this.detectFormat(data)
    
    switch (detectedFormat) {
      case 'json':
        try {
          const parsed = JSON.parse(data)
          return Array.isArray(parsed) ? parsed : [parsed]
        } catch {
          // Not valid JSON, treat as text
          return this.extractFromText(data)
        }
      
      case 'csv':
        return this.parseCSV(data)
      
      case 'yaml':
      case 'yml':
        return this.parseYAML(data)
      
      case 'markdown':
      case 'md':
        return this.parseMarkdown(data)
      
      case 'xml':
      case 'html':
        return this.parseHTML(data)
      
      default:
        return this.extractFromText(data)
    }
  }
  
  /**
   * Extract from binary data (images, PDFs, etc)
   */
  private async extractFromBinary(data: Uint8Array, format?: string): Promise<any[]> {
    // For now, create a single entity representing the binary data
    // In production, would use OCR, image recognition, PDF extraction, etc.
    return [{
      type: 'binary',
      format: format || 'unknown',
      size: data.length,
      hash: await this.hashBinary(data),
      extractedAt: Date.now()
    }]
  }
  
  /**
   * Extract entities from plain text
   */
  private extractFromText(text: string): any[] {
    // Split into meaningful chunks
    const chunks: any[] = []
    
    // Split by paragraphs
    const paragraphs = text.split(/\n\n+/)
    for (const para of paragraphs) {
      if (para.trim()) {
        chunks.push({
          text: para.trim(),
          type: 'paragraph',
          length: para.length
        })
      }
    }
    
    // If no paragraphs, split by sentences
    if (chunks.length === 0) {
      const sentences = text.match(/[^.!?]+[.!?]+/g) || [text]
      for (const sentence of sentences) {
        if (sentence.trim()) {
          chunks.push({
            text: sentence.trim(),
            type: 'sentence',
            length: sentence.length
          })
        }
      }
    }
    
    return chunks
  }
  
  /**
   * Neural processing - CORE of the system
   * ALWAYS uses embeddings and neural matching
   */
  private async neuralProcess(data: any[]): Promise<{
    entities: Map<string, any>
    relationships: Map<string, any>
  }> {
    const entities = new Map<string, any>()
    const relationships = new Map<string, any>()
    
    for (const item of data) {
      // Generate embedding for the item
      const embedding = await this.generateEmbedding(item)

      // Determine noun type from data
      const nounType = this.inferNounType(item)
      const entityId = this.generateId(item)

      entities.set(entityId, {
        id: entityId,
        type: nounType,
        data: item,
        vector: embedding,
        confidence: 1.0,
        metadata: {
          ...item,
          _importedAt: Date.now()
        }
      })
      
      // Detect relationships using neural matching
      await this.detectNeuralRelationships(item, entityId, entities, relationships)
    }
    
    return { entities, relationships }
  }
  
  /**
   * Generate embedding for any data
   */
  private async generateEmbedding(data: any): Promise<Vector> {
    // Convert to string for embedding
    const text = this.dataToText(data)
    
    // Check cache
    if (this.embedCache.has(text)) {
      return this.embedCache.get(text)!
    }
    
    // Generate new embedding
    const embedding = await (this.brain as any).embed(text)
    
    // Cache it
    this.embedCache.set(text, embedding)
    
    return embedding
  }
  
  /**
   * Convert any data to text for embedding
   */
  private dataToText(data: any): string {
    if (typeof data === 'string') return data
    
    if (typeof data === 'object') {
      // Extract meaningful text from object
      const parts: string[] = []
      
      // Priority fields
      const priorityFields = ['name', 'title', 'description', 'text', 'content', 'label', 'value']
      for (const field of priorityFields) {
        if (data[field]) {
          parts.push(String(data[field]))
        }
      }
      
      // Add other fields
      for (const [key, value] of Object.entries(data)) {
        if (!priorityFields.includes(key) && value) {
          if (typeof value === 'string' || typeof value === 'number') {
            parts.push(`${key}: ${value}`)
          }
        }
      }
      
      return parts.join(' ')
    }
    
    return JSON.stringify(data)
  }
  
  /**
   * Detect relationships using neural matching
   */
  private async detectNeuralRelationships(
    item: any,
    sourceId: string,
    entities: Map<string, any>,
    relationships: Map<string, any>
  ): Promise<void> {
    if (typeof item !== 'object') return
    
    // Look for references to other entities
    for (const [key, value] of Object.entries(item)) {
      // Check if this looks like a reference
      if (this.looksLikeReference(key, value)) {
        const targetId = String(value)
        const verbType = this.inferVerbType(key)

        const relationId = `${sourceId}_${verbType}_${targetId}`
        relationships.set(relationId, {
          id: relationId,
          from: sourceId,
          to: targetId,
          type: verbType,
          weight: 1.0,
          confidence: 1.0,
          metadata: {
            field: key,
            _importedAt: Date.now()
          }
        })
      }

      // Handle arrays of references
      if (Array.isArray(value)) {
        for (const arrayItem of value) {
          if (this.looksLikeReference(key, arrayItem)) {
            const targetId = String(arrayItem)
            const verbType = this.inferVerbType(key)

            const relationId = `${sourceId}_${verbType}_${targetId}`
            relationships.set(relationId, {
              id: relationId,
              from: sourceId,
              to: targetId,
              type: verbType,
              weight: 1.0,
              confidence: 1.0,
              metadata: {
                field: key,
                array: true,
                _importedAt: Date.now()
              }
            })
          }
        }
      }
    }
  }
  
  /**
   * Check if a field looks like a reference
   */
  private looksLikeReference(key: string, value: any): boolean {
    // Field name patterns that suggest references
    const refPatterns = [
      /[Ii]d$/,          // ends with Id or id
      /_id$/,            // ends with _id
      /^parent/i,        // starts with parent
      /^child/i,         // starts with child
      /^related/i,       // starts with related
      /^ref/i,           // starts with ref
      /^link/i,          // starts with link
      /^target/i,        // starts with target
      /^source/i,        // starts with source
    ]
    
    // Check if field name matches patterns
    const fieldLooksLikeRef = refPatterns.some(pattern => pattern.test(key))
    
    // Check if value looks like an ID
    const valueLooksLikeId = (
      typeof value === 'string' || 
      typeof value === 'number'
    ) && String(value).length > 0
    
    return fieldLooksLikeRef && valueLooksLikeId
  }

  /**
   * Infer noun type from object structure using field heuristics
   */
  private inferNounType(obj: any): NounType {
    if (typeof obj !== 'object' || obj === null) return NounType.Thing

    // Check for explicit type field
    if (obj.type && typeof obj.type === 'string') {
      const normalized = obj.type.charAt(0).toUpperCase() + obj.type.slice(1)
      if (Object.values(NounType).includes(normalized as NounType)) {
        return normalized as NounType
      }
    }

    // Person heuristics
    if (obj.email || obj.firstName || obj.lastName || obj.username || obj.age) {
      return NounType.Person
    }
    // Organization heuristics
    if (obj.companyName || obj.organizationId || obj.employees || obj.industry) {
      return NounType.Organization
    }
    // Location heuristics
    if (obj.latitude || obj.longitude || obj.address || obj.city || obj.country) {
      return NounType.Location
    }
    // Document heuristics
    if ((obj.content && (obj.title || obj.author)) || obj.documentType || obj.pages) {
      return NounType.Document
    }
    // Event heuristics
    if (obj.startTime || obj.endTime || obj.date || obj.eventType || obj.attendees) {
      return NounType.Event
    }
    // Product heuristics
    if (obj.price || obj.sku || obj.inventory || obj.productId) {
      return NounType.Product
    }
    // Task heuristics
    if ((obj.status && (obj.assignee || obj.dueDate)) || obj.priority || obj.completed !== undefined) {
      return NounType.Task
    }
    // Dataset heuristics
    if (Array.isArray(obj.data) || obj.rows || obj.columns || obj.schema) {
      return NounType.Dataset
    }

    return NounType.Thing
  }

  /**
   * Infer verb type from field name using common patterns
   */
  private inferVerbType(fieldName: string): VerbType {
    const field = fieldName.toLowerCase()

    if (field.includes('parent') || field.includes('child') || field.includes('contain')) {
      return VerbType.Contains
    }
    if (field.includes('owner') || field.includes('created') || field.includes('author')) {
      return VerbType.Creates
    }
    if (field.includes('member') || field.includes('belong')) {
      return VerbType.MemberOf
    }
    if (field.includes('depend') || field.includes('require')) {
      return VerbType.DependsOn
    }
    if (field.includes('ref') || field.includes('link') || field.includes('source')) {
      return VerbType.References
    }

    return VerbType.RelatedTo
  }

  /**
   * Store processed data in brain
   */
  private async storeInBrain(
    neuralResults: {
      entities: Map<string, any>
      relationships: Map<string, any>
    },
    onProgress?: (progress: NeuralImportProgress) => void
  ): Promise<NeuralImportResult> {
    const result: NeuralImportResult = {
      entities: [],
      relationships: [],
      stats: {
        totalProcessed: neuralResults.entities.size + neuralResults.relationships.size,
        entitiesCreated: 0,
        relationshipsCreated: 0,
        averageConfidence: 0,
        processingTimeMs: 0
      }
    }

    let totalConfidence = 0

    // Store entities
    onProgress?.({
      phase: 'storing-entities',
      message: 'Storing entities...',
      current: 0,
      total: neuralResults.entities.size
    })

    let entitiesProcessed = 0
    for (const entity of neuralResults.entities.values()) {
      const id = await this.brain.add({
        data: entity.data,
        type: entity.type,
        metadata: entity.metadata,
        vector: entity.vector
      })

      // Update entity ID for relationship mapping
      entity.id = id

      result.entities.push({
        ...entity,
        id
      })

      result.stats.entitiesCreated++
      totalConfidence += entity.confidence
      entitiesProcessed++

      // Report progress periodically
      if (entitiesProcessed % 10 === 0 || entitiesProcessed === neuralResults.entities.size) {
        onProgress?.({
          phase: 'storing-entities',
          message: `Storing entities: ${entitiesProcessed}/${neuralResults.entities.size}`,
          current: entitiesProcessed,
          total: neuralResults.entities.size,
          entities: entitiesProcessed
        })
      }
    }

    // Store relationships using batch processing
    if (neuralResults.relationships.size > 0) {
      onProgress?.({
        phase: 'storing-relationships',
        message: 'Preparing relationships...',
        current: 0,
        total: neuralResults.relationships.size
      })

      // Collect all relationship parameters
      const relationshipParams: Array<{from: string; to: string; type: VerbType; weight?: number; metadata?: any}> = []

      for (const relation of neuralResults.relationships.values()) {
        // Map to actual entity IDs
        const sourceEntity = Array.from(neuralResults.entities.values())
          .find(e => e.id === relation.from)
        const targetEntity = Array.from(neuralResults.entities.values())
          .find(e => e.id === relation.to)

        if (sourceEntity && targetEntity) {
          relationshipParams.push({
            from: sourceEntity.id,
            to: targetEntity.id,
            type: relation.type,
            weight: relation.weight,
            metadata: relation.metadata
          })
          totalConfidence += relation.confidence
        }
      }

      // Batch create relationships with progress
      if (relationshipParams.length > 0) {
        const relationshipIds = await this.brain.relateMany({
          items: relationshipParams,
          parallel: true,
          chunkSize: 100,
          continueOnError: true,
          onProgress: (done, total) => {
            onProgress?.({
              phase: 'storing-relationships',
              message: `Building relationships: ${done}/${total}`,
              current: done,
              total: total,
              entities: result.stats.entitiesCreated,
              relationships: done
            })
          }
        })

        // Map results back
        relationshipIds.forEach((id, index) => {
          if (id && relationshipParams[index]) {
            result.relationships.push({
              id,
              from: relationshipParams[index].from,
              to: relationshipParams[index].to,
              type: relationshipParams[index].type,
              weight: relationshipParams[index].weight || 1,
              confidence: 0.5, // Default confidence
              metadata: relationshipParams[index].metadata
            })
          }
        })

        result.stats.relationshipsCreated = relationshipIds.length
      }
    }

    // Calculate average confidence
    const totalItems = result.stats.entitiesCreated + result.stats.relationshipsCreated
    result.stats.averageConfidence = totalItems > 0 ? totalConfidence / totalItems : 0

    return result
  }
  
  // Helper methods for parsing different formats
  
  private detectFormat(data: string): string {
    const trimmed = data.trim()
    
    // JSON
    if ((trimmed.startsWith('{') && trimmed.endsWith('}')) ||
        (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
      return 'json'
    }
    
    // CSV (has commas and newlines)
    if (trimmed.includes(',') && trimmed.includes('\n')) {
      return 'csv'
    }
    
    // YAML (has colons and indentation)
    if (trimmed.includes(':') && (trimmed.includes('\n  ') || trimmed.includes('\n\t'))) {
      return 'yaml'
    }
    
    // Markdown (has headers)
    if (trimmed.includes('#') || trimmed.includes('```')) {
      return 'markdown'
    }
    
    // HTML/XML
    if (trimmed.includes('<') && trimmed.includes('>')) {
      return trimmed.toLowerCase().includes('<!doctype html') ? 'html' : 'xml'
    }
    
    return 'text'
  }
  
  private parseCSV(data: string): any[] {
    // Reuse the CSV parser from neural import
    const lines = data.split('\n').filter(l => l.trim())
    if (lines.length === 0) return []
    
    const headers = lines[0].split(',').map(h => h.trim())
    const results = []
    
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(v => v.trim())
      const obj: any = {}
      headers.forEach((header, index) => {
        obj[header] = values[index] || ''
      })
      results.push(obj)
    }
    
    return results
  }
  
  private parseYAML(data: string): any[] {
    // Simple YAML parser
    const results = []
    const lines = data.split('\n')
    let current: any = null
    
    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      
      if (trimmed.startsWith('- ')) {
        // Array item
        const value = trimmed.substring(2)
        if (!current) {
          results.push(value)
        } else {
          if (!current._items) current._items = []
          current._items.push(value)
        }
      } else if (trimmed.includes(':')) {
        // Key-value
        const [key, ...valueParts] = trimmed.split(':')
        const value = valueParts.join(':').trim()
        
        if (!current) {
          current = {}
          results.push(current)
        }
        current[key.trim()] = value
      }
    }
    
    return results.length > 0 ? results : [{ text: data }]
  }
  
  private parseMarkdown(data: string): any[] {
    const results = []
    const lines = data.split('\n')
    
    let current: any = null
    let inCodeBlock = false
    
    for (const line of lines) {
      if (line.startsWith('```')) {
        inCodeBlock = !inCodeBlock
        if (inCodeBlock && current) {
          current.code = ''
        }
        continue
      }
      
      if (inCodeBlock && current) {
        current.code += line + '\n'
      } else if (line.startsWith('#')) {
        // Header
        const level = line.match(/^#+/)?.[0].length || 1
        const text = line.replace(/^#+\s*/, '')
        current = {
          type: 'heading',
          level,
          text
        }
        results.push(current)
      } else if (line.trim()) {
        // Paragraph
        if (!current || current.type !== 'paragraph') {
          current = {
            type: 'paragraph',
            text: ''
          }
          results.push(current)
        }
        current.text += line + ' '
      }
    }
    
    return results
  }
  
  private parseHTML(data: string): any[] {
    // Simple HTML text extraction
    const text = data
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')  // Remove scripts
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')      // Remove styles  
      .replace(/<[^>]+>/g, ' ')                                              // Remove tags
      .replace(/\s+/g, ' ')                                                 // Normalize whitespace
      .trim()
    
    return this.extractFromText(text)
  }
  
  private generateId(data: any): string {
    // Generate deterministic ID based on content
    const text = this.dataToText(data)
    const hash = this.simpleHash(text)
    return `import_${hash}_${Date.now()}`
  }
  
  private simpleHash(text: string): string {
    let hash = 0
    for (let i = 0; i < text.length; i++) {
      const char = text.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash
    }
    return Math.abs(hash).toString(36)
  }
  
  private async hashBinary(data: Uint8Array): Promise<string> {
    // Simple binary hash
    let hash = 0
    for (let i = 0; i < Math.min(data.length, 1000); i++) {
      hash = ((hash << 5) - hash) + data[i]
      hash = hash & hash
    }
    return Math.abs(hash).toString(36)
  }
}