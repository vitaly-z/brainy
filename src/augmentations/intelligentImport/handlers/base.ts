/**
 * Base Format Handler
 * Abstract class providing common functionality for all format handlers
 */

import { FormatHandler, FormatHandlerOptions, ProcessedData } from '../types.js'

export abstract class BaseFormatHandler implements FormatHandler {
  abstract readonly format: string

  abstract process(data: Buffer | string, options: FormatHandlerOptions): Promise<ProcessedData>

  abstract canHandle(data: Buffer | string | { filename?: string, ext?: string }): boolean

  /**
   * Detect file extension from various inputs
   */
  protected detectExtension(data: Buffer | string | { filename?: string, ext?: string }): string | null {
    if (typeof data === 'object' && 'filename' in data && data.filename) {
      return this.getExtension(data.filename)
    }
    if (typeof data === 'object' && 'ext' in data && data.ext) {
      return data.ext.toLowerCase().replace(/^\./, '')
    }
    return null
  }

  /**
   * Extract extension from filename
   */
  protected getExtension(filename: string): string {
    const match = filename.match(/\.([^.]+)$/)
    return match ? match[1].toLowerCase() : ''
  }

  /**
   * Infer field types from data
   * Analyzes multiple rows to determine the most appropriate type
   */
  protected inferFieldTypes(data: Array<Record<string, any>>): Record<string, string> {
    if (data.length === 0) return {}

    const types: Record<string, string> = {}
    const firstRow = data[0]
    const sampleSize = Math.min(10, data.length)

    for (const key of Object.keys(firstRow)) {
      // Check first few rows to get more accurate type
      const sampleTypes = new Set<string>()

      for (let i = 0; i < sampleSize; i++) {
        const value = data[i][key]
        const type = this.inferType(value)
        sampleTypes.add(type)
      }

      // If we see both integer and float, use float
      if (sampleTypes.has('float') || (sampleTypes.has('integer') && sampleTypes.has('float'))) {
        types[key] = 'float'
      } else if (sampleTypes.has('integer')) {
        types[key] = 'integer'
      } else if (sampleTypes.has('date')) {
        types[key] = 'date'
      } else if (sampleTypes.has('boolean')) {
        types[key] = 'boolean'
      } else {
        types[key] = 'string'
      }
    }

    return types
  }

  /**
   * Infer type of a single value
   */
  protected inferType(value: any): string {
    if (value === null || value === undefined || value === '') return 'string'

    if (typeof value === 'number') return 'number'
    if (typeof value === 'boolean') return 'boolean'

    if (typeof value === 'string') {
      // Check if it's a number
      if (/^-?\d+$/.test(value)) return 'integer'
      if (/^-?\d+\.\d+$/.test(value)) return 'float'

      // Check if it's a date
      if (this.isDateString(value)) return 'date'

      // Check if it's a boolean
      if (/^(true|false|yes|no|y|n)$/i.test(value)) return 'boolean'
    }

    return 'string'
  }

  /**
   * Check if string looks like a date
   */
  protected isDateString(value: string): boolean {
    // ISO 8601
    if (/^\d{4}-\d{2}-\d{2}/.test(value)) return true

    // Common date formats
    if (/^\d{1,2}\/\d{1,2}\/\d{2,4}$/.test(value)) return true
    if (/^\d{1,2}-\d{1,2}-\d{2,4}$/.test(value)) return true

    return false
  }

  /**
   * Sanitize field names for use as object keys
   */
  protected sanitizeFieldName(name: string): string {
    return name
      .trim()
      .replace(/[^a-zA-Z0-9_\s-]/g, '')
      .replace(/\s+/g, '_')
      .replace(/-+/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '')
      || 'field'
  }

  /**
   * Convert value to appropriate type
   */
  protected convertValue(value: any, type: string): any {
    if (value === null || value === undefined || value === '') return null

    switch (type) {
      case 'integer':
        return parseInt(String(value), 10)

      case 'float':
      case 'number':
        return parseFloat(String(value))

      case 'boolean':
        if (typeof value === 'boolean') return value
        const str = String(value).toLowerCase()
        return ['true', 'yes', 'y', '1'].includes(str)

      case 'date':
        return new Date(value)

      default:
        return value
    }
  }

  /**
   * Create metadata object with common fields
   */
  protected createMetadata(
    rowCount: number,
    fields: string[],
    processingTime: number,
    extra: Record<string, any> = {}
  ): ProcessedData['metadata'] {
    return {
      rowCount,
      fields,
      processingTime,
      ...extra
    }
  }
}
