/**
 * Format Detector
 *
 * Unified format detection for all import types using:
 * - Magic byte signatures (PDF, Excel, images)
 * - File extensions
 * - Content analysis (JSON, Markdown, CSV)
 *
 * NO MOCKS - Production-ready implementation
 */

export type SupportedFormat = 'excel' | 'pdf' | 'csv' | 'json' | 'markdown'

export interface DetectionResult {
  format: SupportedFormat
  confidence: number
  evidence: string[]
}

/**
 * FormatDetector - Detect file format from various inputs
 */
export class FormatDetector {
  /**
   * Detect format from buffer
   */
  detectFromBuffer(buffer: Buffer): DetectionResult | null {
    // Check magic bytes first (most reliable)
    const magicResult = this.detectByMagicBytes(buffer)
    if (magicResult) return magicResult

    // Try content analysis
    const contentResult = this.detectByContent(buffer)
    if (contentResult) return contentResult

    return null
  }

  /**
   * Detect format from file path
   */
  detectFromPath(path: string): DetectionResult | null {
    const ext = this.getExtension(path).toLowerCase()

    const extensionMap: Record<string, SupportedFormat> = {
      '.xlsx': 'excel',
      '.xls': 'excel',
      '.pdf': 'pdf',
      '.csv': 'csv',
      '.json': 'json',
      '.md': 'markdown',
      '.markdown': 'markdown'
    }

    const format = extensionMap[ext]
    if (format) {
      return {
        format,
        confidence: 0.9,
        evidence: [`File extension: ${ext}`]
      }
    }

    return null
  }

  /**
   * Detect format from string content
   */
  detectFromString(content: string): DetectionResult | null {
    const trimmed = content.trim()

    // JSON detection
    if (this.looksLikeJSON(trimmed)) {
      return {
        format: 'json',
        confidence: 0.95,
        evidence: ['Content starts with { or [', 'Valid JSON structure']
      }
    }

    // Markdown detection
    if (this.looksLikeMarkdown(trimmed)) {
      return {
        format: 'markdown',
        confidence: 0.85,
        evidence: ['Contains markdown heading markers (#)', 'Text-based content']
      }
    }

    // CSV detection
    if (this.looksLikeCSV(trimmed)) {
      return {
        format: 'csv',
        confidence: 0.8,
        evidence: ['Contains delimiter-separated values', 'Consistent column structure']
      }
    }

    return null
  }

  /**
   * Detect format from object
   */
  detectFromObject(obj: any): DetectionResult | null {
    if (typeof obj === 'object' && obj !== null) {
      return {
        format: 'json',
        confidence: 1.0,
        evidence: ['JavaScript object']
      }
    }
    return null
  }

  /**
   * Detect by magic bytes
   */
  private detectByMagicBytes(buffer: Buffer): DetectionResult | null {
    if (buffer.length < 4) return null

    // PDF: %PDF (25 50 44 46)
    if (buffer[0] === 0x25 && buffer[1] === 0x50 && buffer[2] === 0x44 && buffer[3] === 0x46) {
      return {
        format: 'pdf',
        confidence: 1.0,
        evidence: ['PDF magic bytes: %PDF']
      }
    }

    // Excel (ZIP-based): PK (50 4B)
    if (buffer[0] === 0x50 && buffer[1] === 0x4B) {
      // Check for [Content_Types].xml which is specific to Office Open XML
      const content = buffer.toString('utf8', 0, Math.min(1000, buffer.length))
      if (content.includes('[Content_Types].xml') || content.includes('xl/')) {
        return {
          format: 'excel',
          confidence: 1.0,
          evidence: ['ZIP magic bytes: PK', 'Contains Office Open XML structure']
        }
      }
    }

    return null
  }

  /**
   * Detect by content analysis
   */
  private detectByContent(buffer: Buffer): DetectionResult | null {
    // Try to decode as UTF-8
    let content: string
    try {
      content = buffer.toString('utf8').trim()
    } catch {
      return null
    }

    // Check if it's text-based content
    if (!this.isTextContent(content)) {
      return null
    }

    // JSON detection
    if (this.looksLikeJSON(content)) {
      return {
        format: 'json',
        confidence: 0.95,
        evidence: ['Content starts with { or [', 'Valid JSON structure']
      }
    }

    // Markdown detection
    if (this.looksLikeMarkdown(content)) {
      return {
        format: 'markdown',
        confidence: 0.85,
        evidence: ['Contains markdown heading markers (#)', 'Text-based content']
      }
    }

    // CSV detection
    if (this.looksLikeCSV(content)) {
      return {
        format: 'csv',
        confidence: 0.8,
        evidence: ['Contains delimiter-separated values', 'Consistent column structure']
      }
    }

    return null
  }

  /**
   * Check if content looks like JSON
   */
  private looksLikeJSON(content: string): boolean {
    const trimmed = content.trim()
    if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) {
      return false
    }

    try {
      JSON.parse(trimmed)
      return true
    } catch {
      return false
    }
  }

  /**
   * Check if content looks like Markdown
   */
  private looksLikeMarkdown(content: string): boolean {
    const lines = content.split('\n').slice(0, 50) // Check first 50 lines

    // Count markdown indicators
    let indicators = 0

    for (const line of lines) {
      // Headings
      if (/^#{1,6}\s+.+/.test(line)) indicators += 2

      // Lists
      if (/^[\*\-\+]\s+.+/.test(line)) indicators++
      if (/^\d+\.\s+.+/.test(line)) indicators++

      // Links
      if (/\[.+\]\(.+\)/.test(line)) indicators++

      // Code blocks
      if (/^```/.test(line)) indicators += 2

      // Bold/Italic
      if (/\*\*.+\*\*/.test(line) || /\*.+\*/.test(line)) indicators++
    }

    // If we have at least 3 markdown indicators, it's likely markdown
    return indicators >= 3
  }

  /**
   * Check if content looks like CSV
   */
  private looksLikeCSV(content: string): boolean {
    const lines = content.split('\n').filter(l => l.trim()).slice(0, 20)
    if (lines.length < 2) return false

    // Try common delimiters
    const delimiters = [',', ';', '\t', '|']

    for (const delimiter of delimiters) {
      const columnCounts = lines.map(line => {
        // Simple split (doesn't handle quoted delimiters, but good enough for detection)
        return line.split(delimiter).length
      })

      // Check if all rows have the same number of columns (within 1)
      const firstCount = columnCounts[0]
      const consistent = columnCounts.filter(c => Math.abs(c - firstCount) <= 1).length

      // If >80% of rows have consistent column counts, it's likely CSV
      if (consistent / columnCounts.length > 0.8 && firstCount > 1) {
        return true
      }
    }

    return false
  }

  /**
   * Check if content is text-based (not binary)
   */
  private isTextContent(content: string): boolean {
    // Check for null bytes (common in binary files)
    if (content.includes('\0')) return false

    // Check if mostly printable characters
    const printable = content.split('').filter(c => {
      const code = c.charCodeAt(0)
      return (code >= 32 && code <= 126) || code === 9 || code === 10 || code === 13
    }).length

    const ratio = printable / content.length
    return ratio > 0.9
  }

  /**
   * Get file extension from path
   */
  private getExtension(path: string): string {
    const lastDot = path.lastIndexOf('.')
    const lastSlash = Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\'))

    if (lastDot > lastSlash && lastDot !== -1) {
      return path.substring(lastDot)
    }

    return ''
  }
}
