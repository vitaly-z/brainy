/**
 * Integration Hub - Tabular Exporter
 *
 * Converts Brainy entities to tabular formats (rows/columns) for use in
 * spreadsheets, SQL databases, and BI tools.
 */

import { Entity, Relation } from '../../types/brainy.types.js'
import {
  TabularRow,
  RelationTabularRow,
  TabularExporterConfig
} from './types.js'

/**
 * Converts Brainy entities to tabular formats
 *
 * Used by SQL, OData, Google Sheets, and CSV integrations to maintain
 * consistent entity-to-row mapping across all external tools.
 *
 * @example
 * ```typescript
 * const exporter = new TabularExporter({
 *   flattenMetadata: true,
 *   includeVectors: false
 * })
 *
 * const rows = exporter.entitiesToRows(entities)
 * const csv = exporter.toCSV(entities)
 * const odata = exporter.toOData(entities)
 * ```
 */
export class TabularExporter {
  private config: Required<TabularExporterConfig>

  constructor(config: TabularExporterConfig = {}) {
    this.config = {
      flattenMetadata: config.flattenMetadata ?? true,
      metadataPrefix: config.metadataPrefix ?? 'Metadata_',
      includeVectors: config.includeVectors ?? false,
      dateFormat: config.dateFormat ?? 'ISO8601',
      jsonStringify: config.jsonStringify ?? ['data'],
      maxFlattenDepth: config.maxFlattenDepth ?? 1, // Flatten one level, stringify deeper
      excludeColumns: config.excludeColumns ?? []
    }
  }

  /**
   * Convert entities to tabular rows
   */
  entitiesToRows(entities: Entity[]): TabularRow[] {
    return entities.map((entity) => this.entityToRow(entity))
  }

  /**
   * Convert a single entity to a tabular row
   */
  entityToRow(entity: Entity): TabularRow {
    const row: TabularRow = {
      Id: entity.id,
      Type: entity.type,
      CreatedAt: this.formatDate(entity.createdAt),
      UpdatedAt: entity.updatedAt
        ? this.formatDate(entity.updatedAt)
        : this.formatDate(entity.createdAt),
      Confidence: entity.confidence ?? null,
      Weight: entity.weight ?? null,
      Service: entity.service ?? null,
      Data: this.config.jsonStringify.includes('data')
        ? JSON.stringify(entity.data ?? null)
        : entity.data ?? null
    }

    // Include vector if configured
    if (this.config.includeVectors && entity.vector) {
      row.Vector = JSON.stringify(Array.from(entity.vector))
    }

    // Flatten metadata
    if (this.config.flattenMetadata && entity.metadata) {
      const flatMetadata = this.flattenObject(
        entity.metadata,
        this.config.metadataPrefix,
        this.config.maxFlattenDepth
      )
      Object.assign(row, flatMetadata)
    } else if (entity.metadata) {
      row.Metadata = JSON.stringify(entity.metadata)
    }

    // Remove excluded columns
    for (const col of this.config.excludeColumns) {
      delete row[col]
    }

    return row
  }

  /**
   * Convert relations to tabular rows
   */
  relationsToRows(relations: Relation[]): RelationTabularRow[] {
    return relations.map((rel) => this.relationToRow(rel))
  }

  /**
   * Convert a single relation to a tabular row
   */
  relationToRow(relation: Relation): RelationTabularRow {
    return {
      Id: relation.id,
      FromId: relation.from,
      ToId: relation.to,
      Type: relation.type,
      Weight: relation.weight ?? null,
      Confidence: relation.confidence ?? null,
      CreatedAt: this.formatDate(relation.createdAt),
      UpdatedAt: relation.updatedAt
        ? this.formatDate(relation.updatedAt)
        : this.formatDate(relation.createdAt),
      Service: relation.service ?? null,
      Metadata: relation.metadata ? JSON.stringify(relation.metadata) : null
    }
  }

  /**
   * Convert entities to CSV string
   */
  toCSV(entities: Entity[], options?: { delimiter?: string }): string {
    const delimiter = options?.delimiter ?? ','
    const rows = this.entitiesToRows(entities)

    if (rows.length === 0) {
      return ''
    }

    // Get all columns from all rows
    const columns = this.getAllColumns(rows)

    // Header row
    const header = columns.map((col) => this.escapeCSV(col)).join(delimiter)

    // Data rows
    const dataRows = rows.map((row) =>
      columns
        .map((col) => {
          const value = row[col]
          return this.escapeCSV(
            value === null || value === undefined ? '' : String(value)
          )
        })
        .join(delimiter)
    )

    return [header, ...dataRows].join('\n')
  }

  /**
   * Convert relations to CSV string
   */
  relationsToCSV(
    relations: Relation[],
    options?: { delimiter?: string }
  ): string {
    const delimiter = options?.delimiter ?? ','
    const rows = this.relationsToRows(relations)

    if (rows.length === 0) {
      return ''
    }

    const columns: (keyof RelationTabularRow)[] = [
      'Id',
      'FromId',
      'ToId',
      'Type',
      'Weight',
      'Confidence',
      'CreatedAt',
      'UpdatedAt',
      'Service',
      'Metadata'
    ]

    const header = columns.join(delimiter)
    const dataRows = rows.map((row) =>
      columns
        .map((col) => {
          const value = row[col]
          return this.escapeCSV(
            value === null || value === undefined ? '' : String(value)
          )
        })
        .join(delimiter)
    )

    return [header, ...dataRows].join('\n')
  }

  /**
   * Convert entities to OData format (JSON with annotations)
   */
  toOData(
    entities: Entity[],
    options?: {
      context?: string
      count?: number
      nextLink?: string
    }
  ): object {
    const rows = this.entitiesToRows(entities)

    const result: any = {
      '@odata.context': options?.context ?? '$metadata#Entities'
    }

    if (options?.count !== undefined) {
      result['@odata.count'] = options.count
    }

    result.value = rows.map((row) => this.rowToODataEntity(row))

    if (options?.nextLink) {
      result['@odata.nextLink'] = options.nextLink
    }

    return result
  }

  /**
   * Convert relations to OData format
   */
  relationsToOData(
    relations: Relation[],
    options?: {
      context?: string
      count?: number
      nextLink?: string
    }
  ): object {
    const rows = this.relationsToRows(relations)

    const result: any = {
      '@odata.context': options?.context ?? '$metadata#Relationships'
    }

    if (options?.count !== undefined) {
      result['@odata.count'] = options.count
    }

    result.value = rows

    if (options?.nextLink) {
      result['@odata.nextLink'] = options.nextLink
    }

    return result
  }

  /**
   * Parse CSV string to entity-like objects
   */
  parseCSV(
    csv: string,
    options?: { delimiter?: string }
  ): Partial<Entity>[] {
    const delimiter = options?.delimiter ?? ','
    const lines = csv.split('\n').filter((line) => line.trim())

    if (lines.length < 2) {
      return []
    }

    const headers = this.parseCSVLine(lines[0], delimiter)
    const entities: Partial<Entity>[] = []

    for (let i = 1; i < lines.length; i++) {
      const values = this.parseCSVLine(lines[i], delimiter)
      const row: Record<string, any> = {}

      for (let j = 0; j < headers.length; j++) {
        row[headers[j]] = values[j] ?? ''
      }

      entities.push(this.rowToEntity(row))
    }

    return entities
  }

  /**
   * Get schema from entities (column names and types)
   */
  getSchema(entities: Entity[]): Array<{
    name: string
    type: 'string' | 'number' | 'boolean' | 'datetime' | 'json'
    nullable: boolean
  }> {
    const rows = this.entitiesToRows(entities.slice(0, 100)) // Sample first 100
    const columns = this.getAllColumns(rows)
    const schema: Array<{
      name: string
      type: 'string' | 'number' | 'boolean' | 'datetime' | 'json'
      nullable: boolean
    }> = []

    for (const col of columns) {
      let type: 'string' | 'number' | 'boolean' | 'datetime' | 'json' = 'string'
      let nullable = false

      for (const row of rows) {
        const value = row[col]

        if (value === null || value === undefined) {
          nullable = true
          continue
        }

        const inferredType = this.inferType(value)
        if (type === 'string') {
          type = inferredType
        } else if (type !== inferredType) {
          // Mixed types, fall back to string
          type = 'string'
          break
        }
      }

      schema.push({ name: col, type, nullable })
    }

    return schema
  }

  // Private helper methods

  private formatDate(timestamp: number): string {
    switch (this.config.dateFormat) {
      case 'unix':
        return Math.floor(timestamp / 1000).toString()
      case 'unix_ms':
        return timestamp.toString()
      case 'ISO8601':
      default:
        return new Date(timestamp).toISOString()
    }
  }

  private flattenObject(
    obj: Record<string, any>,
    prefix: string,
    maxDepth: number,
    currentDepth = 0
  ): Record<string, any> {
    const result: Record<string, any> = {}

    for (const [key, value] of Object.entries(obj)) {
      const newKey = `${prefix}${key}`

      if (value === null || value === undefined) {
        result[newKey] = null
      } else if (Array.isArray(value)) {
        // Arrays are always JSON stringified
        result[newKey] = JSON.stringify(value)
      } else if (typeof value === 'object') {
        // Objects: flatten if under depth limit, otherwise stringify
        if (currentDepth < maxDepth - 1) {
          Object.assign(
            result,
            this.flattenObject(value, `${newKey}_`, maxDepth, currentDepth + 1)
          )
        } else {
          // Max depth reached - stringify the object
          result[newKey] = JSON.stringify(value)
        }
      } else {
        // Primitives: use as-is
        result[newKey] = value
      }
    }

    return result
  }

  private getAllColumns(rows: TabularRow[]): string[] {
    const columnSet = new Set<string>()

    // Standard columns first
    const standardColumns = [
      'Id',
      'Type',
      'CreatedAt',
      'UpdatedAt',
      'Confidence',
      'Weight',
      'Service',
      'Data'
    ]

    for (const col of standardColumns) {
      columnSet.add(col)
    }

    // Add all other columns from rows
    for (const row of rows) {
      for (const key of Object.keys(row)) {
        columnSet.add(key)
      }
    }

    return Array.from(columnSet)
  }

  private escapeCSV(value: string): string {
    // Escape quotes and wrap in quotes if contains special characters
    if (
      value.includes(',') ||
      value.includes('"') ||
      value.includes('\n') ||
      value.includes('\r')
    ) {
      return `"${value.replace(/"/g, '""')}"`
    }
    return value
  }

  private parseCSVLine(line: string, delimiter: string): string[] {
    const result: string[] = []
    let current = ''
    let inQuotes = false

    for (let i = 0; i < line.length; i++) {
      const char = line[i]

      if (inQuotes) {
        if (char === '"') {
          if (line[i + 1] === '"') {
            current += '"'
            i++
          } else {
            inQuotes = false
          }
        } else {
          current += char
        }
      } else {
        if (char === '"') {
          inQuotes = true
        } else if (char === delimiter) {
          result.push(current)
          current = ''
        } else {
          current += char
        }
      }
    }

    result.push(current)
    return result
  }

  private rowToEntity(row: Record<string, any>): Partial<Entity> {
    const entity: Partial<Entity> = {}

    // Map standard columns
    if (row.Id) entity.id = row.Id
    if (row.Type) entity.type = row.Type as any
    if (row.Service) entity.service = row.Service
    if (row.Confidence) entity.confidence = parseFloat(row.Confidence)
    if (row.Weight) entity.weight = parseFloat(row.Weight)

    // Parse timestamps
    if (row.CreatedAt) {
      entity.createdAt = this.parseDate(row.CreatedAt)
    }
    if (row.UpdatedAt) {
      entity.updatedAt = this.parseDate(row.UpdatedAt)
    }

    // Parse data
    if (row.Data) {
      try {
        entity.data = JSON.parse(row.Data)
      } catch {
        entity.data = row.Data
      }
    }

    // Collect metadata from prefixed columns
    const metadata: Record<string, any> = {}
    for (const [key, value] of Object.entries(row)) {
      if (key.startsWith(this.config.metadataPrefix)) {
        const metaKey = key.slice(this.config.metadataPrefix.length)
        try {
          metadata[metaKey] = JSON.parse(value as string)
        } catch {
          metadata[metaKey] = value
        }
      }
    }
    if (Object.keys(metadata).length > 0) {
      entity.metadata = metadata
    }

    return entity
  }

  private parseDate(value: string): number {
    // Try parsing as number (unix timestamp)
    const num = Number(value)
    if (!isNaN(num)) {
      // If it looks like seconds (< year 3000 in seconds)
      if (num < 32503680000) {
        return num * 1000
      }
      return num
    }

    // Try parsing as ISO date
    const date = new Date(value)
    if (!isNaN(date.getTime())) {
      return date.getTime()
    }

    return Date.now()
  }

  private rowToODataEntity(row: TabularRow): object {
    const result: any = {}

    for (const [key, value] of Object.entries(row)) {
      if (value === null) {
        result[key] = null
      } else if (key === 'CreatedAt' || key === 'UpdatedAt') {
        // OData datetime format
        result[key] = value
      } else {
        result[key] = value
      }
    }

    return result
  }

  private inferType(
    value: any
  ): 'string' | 'number' | 'boolean' | 'datetime' | 'json' {
    if (typeof value === 'number') {
      return 'number'
    }
    if (typeof value === 'boolean') {
      return 'boolean'
    }
    if (typeof value === 'string') {
      // Check if it's a date
      if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(value)) {
        return 'datetime'
      }
      // Check if it's JSON
      if (
        (value.startsWith('{') && value.endsWith('}')) ||
        (value.startsWith('[') && value.endsWith(']'))
      ) {
        try {
          JSON.parse(value)
          return 'json'
        } catch {
          // Not valid JSON
        }
      }
    }
    return 'string'
  }
}
