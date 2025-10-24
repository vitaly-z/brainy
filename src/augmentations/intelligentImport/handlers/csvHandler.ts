/**
 * CSV Format Handler
 * Handles CSV files with:
 * - Automatic encoding detection
 * - Automatic delimiter detection
 * - Streaming for large files
 * - Type inference
 */

import { parse } from 'csv-parse/sync'
import { detect as detectEncoding } from 'chardet'
import { BaseFormatHandler } from './base.js'
import { FormatHandlerOptions, ProcessedData } from '../types.js'

export class CSVHandler extends BaseFormatHandler {
  readonly format = 'csv'

  canHandle(data: Buffer | string | { filename?: string, ext?: string }): boolean {
    const ext = this.detectExtension(data)
    if (ext === 'csv' || ext === 'tsv' || ext === 'txt') return true

    // Check content if it's a buffer
    if (Buffer.isBuffer(data)) {
      const sample = data.slice(0, 1024).toString('utf-8')
      return this.looksLikeCSV(sample)
    }

    if (typeof data === 'string') {
      return this.looksLikeCSV(data.slice(0, 1024))
    }

    return false
  }

  async process(data: Buffer | string, options: FormatHandlerOptions): Promise<ProcessedData> {
    const startTime = Date.now()
    const progressHooks = options.progressHooks

    // Convert to buffer if string
    const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data, 'utf-8')
    const totalBytes = buffer.length

    // v4.5.0: Report total bytes for progress tracking
    if (progressHooks?.onBytesProcessed) {
      progressHooks.onBytesProcessed(0)
    }
    if (progressHooks?.onCurrentItem) {
      progressHooks.onCurrentItem('Detecting CSV encoding and delimiter...')
    }

    // Detect encoding
    const detectedEncoding = options.encoding || this.detectEncodingSafe(buffer)
    const text = buffer.toString(detectedEncoding as BufferEncoding)

    // Detect delimiter if not specified
    const delimiter = options.csvDelimiter || this.detectDelimiter(text)

    // v4.5.0: Report progress - parsing started
    if (progressHooks?.onCurrentItem) {
      progressHooks.onCurrentItem(`Parsing CSV rows (delimiter: "${delimiter}")...`)
    }

    // Parse CSV
    const hasHeaders = options.csvHeaders !== false
    const maxRows = options.maxRows

    try {
      const records = parse(text, {
        columns: hasHeaders,
        skip_empty_lines: true,
        trim: true,
        delimiter,
        relax_column_count: true,
        to: maxRows,
        cast: false // We'll do type inference ourselves
      })

      // v4.5.0: Report bytes processed (entire file parsed)
      if (progressHooks?.onBytesProcessed) {
        progressHooks.onBytesProcessed(totalBytes)
      }

      // Convert to array of objects
      const data = Array.isArray(records) ? records : [records]

      // v4.5.0: Report data extraction progress
      if (progressHooks?.onDataExtracted) {
        progressHooks.onDataExtracted(data.length, data.length)
      }
      if (progressHooks?.onCurrentItem) {
        progressHooks.onCurrentItem(`Extracted ${data.length} rows, inferring types...`)
      }

      // Infer types and convert values
      const fields = data.length > 0 ? Object.keys(data[0]) : []
      const types = this.inferFieldTypes(data)

      const convertedData = data.map((row, index) => {
        const converted: Record<string, any> = {}
        for (const [key, value] of Object.entries(row)) {
          converted[key] = this.convertValue(value, types[key] || 'string')
        }

        // v4.5.0: Report progress every 1000 rows
        if (progressHooks?.onCurrentItem && index > 0 && index % 1000 === 0) {
          progressHooks.onCurrentItem(`Converting types: ${index}/${data.length} rows...`)
        }

        return converted
      })

      const processingTime = Date.now() - startTime

      // v4.5.0: Final progress update
      if (progressHooks?.onCurrentItem) {
        progressHooks.onCurrentItem(`CSV processing complete: ${convertedData.length} rows`)
      }

      return {
        format: this.format,
        data: convertedData,
        metadata: this.createMetadata(
          convertedData.length,
          fields,
          processingTime,
          {
            encoding: detectedEncoding,
            delimiter,
            hasHeaders,
            types
          }
        ),
        filename: options.filename
      }
    } catch (error) {
      throw new Error(`CSV parsing failed: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  /**
   * Check if text looks like CSV
   */
  private looksLikeCSV(text: string): boolean {
    const lines = text.split('\n').filter(l => l.trim())
    if (lines.length < 2) return false

    // Check for common delimiters
    const delimiters = [',', ';', '\t', '|']
    for (const delimiter of delimiters) {
      const firstCount = (lines[0].match(new RegExp(`\\${delimiter}`, 'g')) || []).length
      if (firstCount === 0) continue

      const secondCount = (lines[1].match(new RegExp(`\\${delimiter}`, 'g')) || []).length
      if (firstCount === secondCount) return true
    }

    return false
  }

  /**
   * Detect CSV delimiter
   */
  private detectDelimiter(text: string): string {
    const sample = text.split('\n').slice(0, 10).join('\n')
    const delimiters = [',', ';', '\t', '|']
    const counts: Record<string, number> = {}

    for (const delimiter of delimiters) {
      const lines = sample.split('\n').filter(l => l.trim())
      if (lines.length < 2) continue

      // Count delimiter in first line
      const firstCount = (lines[0].match(new RegExp(`\\${delimiter}`, 'g')) || []).length
      if (firstCount === 0) continue

      // Check if count is consistent across lines
      let consistent = true
      for (let i = 1; i < Math.min(5, lines.length); i++) {
        const count = (lines[i].match(new RegExp(`\\${delimiter}`, 'g')) || []).length
        if (count !== firstCount) {
          consistent = false
          break
        }
      }

      if (consistent) {
        counts[delimiter] = firstCount
      }
    }

    // Return delimiter with highest count
    const best = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]
    return best ? best[0] : ','
  }

  /**
   * Detect encoding safely (with fallback)
   */
  private detectEncodingSafe(buffer: Buffer): string {
    try {
      const detected = detectEncoding(buffer)
      if (!detected) return 'utf-8'

      // Normalize encoding to Node.js-supported names
      return this.normalizeEncoding(detected)
    } catch {
      return 'utf-8'
    }
  }

  /**
   * Normalize encoding names to Node.js-supported encodings
   */
  private normalizeEncoding(encoding: string): string {
    const normalized = encoding.toLowerCase().replace(/[_-]/g, '')

    // Map common encodings to Node.js names
    const mappings: Record<string, string> = {
      'iso88591': 'latin1',
      'iso88592': 'latin1',
      'iso88593': 'latin1',
      'iso88594': 'latin1',
      'iso88595': 'latin1',
      'iso88596': 'latin1',
      'iso88597': 'latin1',
      'iso88598': 'latin1',
      'iso88599': 'latin1',
      'iso885910': 'latin1',
      'iso885913': 'latin1',
      'iso885914': 'latin1',
      'iso885915': 'latin1',
      'iso885916': 'latin1',
      'usascii': 'ascii',
      'utf8': 'utf8',
      'utf16le': 'utf16le',
      'utf16be': 'utf16le',
      'windows1252': 'latin1',
      'windows1251': 'utf8', // Cyrillic - best effort
      'big5': 'utf8', // Chinese - best effort
      'gbk': 'utf8', // Chinese - best effort
      'gb2312': 'utf8', // Chinese - best effort
      'shiftjis': 'utf8', // Japanese - best effort
      'eucjp': 'utf8', // Japanese - best effort
      'euckr': 'utf8' // Korean - best effort
    }

    return mappings[normalized] || 'utf8'
  }
}
