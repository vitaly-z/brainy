/**
 * PDF Format Handler
 * Handles PDF files with:
 * - Text extraction with layout preservation
 * - Table detection and extraction
 * - Metadata extraction (author, dates, etc.)
 * - Page-by-page processing
 */

import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs'
import { BaseFormatHandler } from './base.js'
import { FormatHandlerOptions, ProcessedData } from '../types.js'

// Use built-in worker for Node.js environments
// In production, this can be customized via options
const initializeWorker = () => {
  if (typeof pdfjsLib.GlobalWorkerOptions.workerSrc === 'undefined' ||
      pdfjsLib.GlobalWorkerOptions.workerSrc === '') {
    // Use a data URL to avoid file system dependencies
    // This tells pdfjs to use the built-in fallback worker
    try {
      pdfjsLib.GlobalWorkerOptions.workerSrc = 'data:,'
    } catch {
      // Ignore if already set or in incompatible environment
    }
  }
}

initializeWorker()

export class PDFHandler extends BaseFormatHandler {
  readonly format = 'pdf'

  canHandle(data: Buffer | string | { filename?: string, ext?: string }): boolean {
    const ext = this.detectExtension(data)
    if (ext === 'pdf') return true

    // Check for PDF magic bytes
    if (Buffer.isBuffer(data)) {
      const header = data.slice(0, 5).toString('ascii')
      return header === '%PDF-'
    }

    return false
  }

  async process(data: Buffer | string, options: FormatHandlerOptions): Promise<ProcessedData> {
    const startTime = Date.now()
    const progressHooks = options.progressHooks

    // Convert to buffer
    const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data, 'binary')
    const totalBytes = buffer.length

    // v4.5.0: Report start
    if (progressHooks?.onBytesProcessed) {
      progressHooks.onBytesProcessed(0)
    }
    if (progressHooks?.onCurrentItem) {
      progressHooks.onCurrentItem('Loading PDF document...')
    }

    try {
      // Load PDF document
      const loadingTask = pdfjsLib.getDocument({
        data: new Uint8Array(buffer),
        useSystemFonts: true,
        standardFontDataUrl: undefined
      })

      const pdfDoc = await loadingTask.promise

      // Extract metadata
      const metadata = await pdfDoc.getMetadata()
      const numPages = pdfDoc.numPages

      // v4.5.0: Report document loaded
      if (progressHooks?.onCurrentItem) {
        progressHooks.onCurrentItem(`Processing ${numPages} pages...`)
      }

      // Extract text and structure from all pages
      const allData: Array<Record<string, any>> = []
      let totalTextLength = 0
      let detectedTables = 0

      for (let pageNum = 1; pageNum <= numPages; pageNum++) {
        // v4.5.0: Report current page
        if (progressHooks?.onCurrentItem) {
          progressHooks.onCurrentItem(`Processing page ${pageNum} of ${numPages}`)
        }

        const page = await pdfDoc.getPage(pageNum)
        const textContent = await page.getTextContent()

        // Extract text items with positions
        const textItems = textContent.items.map((item: any) => ({
          text: item.str,
          x: item.transform[4],
          y: item.transform[5],
          width: item.width,
          height: item.height
        }))

        // Combine text items into lines (group by similar Y position)
        const lines = this.groupIntoLines(textItems)

        // Detect tables if requested
        if (options.pdfExtractTables !== false) {
          const tables = this.detectTables(lines)
          if (tables.length > 0) {
            detectedTables += tables.length
            for (const table of tables) {
              allData.push(...table.rows)
            }
          }
        }

        // Extract paragraphs from non-table lines
        const paragraphs = this.extractParagraphs(lines)
        for (let i = 0; i < paragraphs.length; i++) {
          const text = paragraphs[i].trim()
          if (text.length > 0) {
            totalTextLength += text.length
            allData.push({
              _page: pageNum,
              _type: 'paragraph',
              _index: i,
              text
            })
          }
        }

        // v4.5.0: Estimate bytes processed (pages are sequential)
        const bytesProcessed = Math.floor((pageNum / numPages) * totalBytes)
        if (progressHooks?.onBytesProcessed) {
          progressHooks.onBytesProcessed(bytesProcessed)
        }

        // v4.5.0: Report extraction progress
        if (progressHooks?.onDataExtracted) {
          progressHooks.onDataExtracted(allData.length, undefined) // Total unknown until complete
        }
      }

      // v4.5.0: Final progress - all bytes processed
      if (progressHooks?.onBytesProcessed) {
        progressHooks.onBytesProcessed(totalBytes)
      }
      if (progressHooks?.onDataExtracted) {
        progressHooks.onDataExtracted(allData.length, allData.length)
      }

      const processingTime = Date.now() - startTime

      // v4.5.0: Report completion
      if (progressHooks?.onCurrentItem) {
        progressHooks.onCurrentItem(
          `PDF complete: ${numPages} pages, ${allData.length} items extracted`
        )
      }

      // Get all unique fields (excluding metadata fields)
      const fields = allData.length > 0
        ? Object.keys(allData[0]).filter(k => !k.startsWith('_'))
        : []

      return {
        format: this.format,
        data: allData,
        metadata: this.createMetadata(
          allData.length,
          fields,
          processingTime,
          {
            pageCount: numPages,
            textLength: totalTextLength,
            tableCount: detectedTables,
            pdfMetadata: {
              title: (metadata.info as any)?.Title || null,
              author: (metadata.info as any)?.Author || null,
              subject: (metadata.info as any)?.Subject || null,
              creator: (metadata.info as any)?.Creator || null,
              producer: (metadata.info as any)?.Producer || null,
              creationDate: (metadata.info as any)?.CreationDate || null,
              modificationDate: (metadata.info as any)?.ModDate || null
            }
          }
        ),
        filename: options.filename
      }
    } catch (error) {
      throw new Error(`PDF parsing failed: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  /**
   * Group text items into lines based on Y position
   */
  private groupIntoLines(items: Array<{ text: string, x: number, y: number, width: number, height: number }>): Array<Array<{ text: string, x: number }>> {
    if (items.length === 0) return []

    // Sort by Y position (descending, since PDF coordinates go bottom-up)
    const sorted = [...items].sort((a, b) => b.y - a.y)

    const lines: Array<Array<{ text: string, x: number }>> = []
    let currentLine: Array<{ text: string, x: number }> = []
    let currentY = sorted[0].y

    for (const item of sorted) {
      // If Y position differs by more than half the height, it's a new line
      if (Math.abs(item.y - currentY) > (item.height / 2)) {
        if (currentLine.length > 0) {
          // Sort line items by X position
          currentLine.sort((a, b) => a.x - b.x)
          lines.push(currentLine)
        }
        currentLine = []
        currentY = item.y
      }

      if (item.text.trim()) {
        currentLine.push({ text: item.text, x: item.x })
      }
    }

    // Add last line
    if (currentLine.length > 0) {
      currentLine.sort((a, b) => a.x - b.x)
      lines.push(currentLine)
    }

    return lines
  }

  /**
   * Detect tables from lines
   * Tables are detected when multiple consecutive lines have similar structure
   */
  private detectTables(lines: Array<Array<{ text: string, x: number }>>): Array<{ rows: Array<Record<string, any>> }> {
    const tables: Array<{ rows: Array<Record<string, any>> }> = []
    let potentialTable: Array<Array<{ text: string, x: number }>> = []

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]

      // A line with multiple items could be part of a table
      if (line.length >= 2) {
        potentialTable.push(line)
      } else {
        // End of potential table
        if (potentialTable.length >= 3) { // Need at least header + 2 rows
          const table = this.parseTable(potentialTable)
          if (table) {
            tables.push(table)
          }
        }
        potentialTable = []
      }
    }

    // Check last potential table
    if (potentialTable.length >= 3) {
      const table = this.parseTable(potentialTable)
      if (table) {
        tables.push(table)
      }
    }

    return tables
  }

  /**
   * Parse a potential table into structured rows
   */
  private parseTable(lines: Array<Array<{ text: string, x: number }>>): { rows: Array<Record<string, any>> } | null {
    if (lines.length < 2) return null

    // First line is headers
    const headerLine = lines[0]
    const headers = headerLine.map(item => this.sanitizeFieldName(item.text))

    // Remaining lines are data
    const rows: Array<Record<string, any>> = []

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i]
      const row: Record<string, any> = { _type: 'table_row' }

      // Match each item to closest header by X position
      for (let j = 0; j < line.length && j < headers.length; j++) {
        const header = headers[j]
        const value = line[j].text.trim()
        row[header] = value || null
      }

      if (Object.keys(row).length > 1) { // More than just _type
        rows.push(row)
      }
    }

    return rows.length > 0 ? { rows } : null
  }

  /**
   * Extract paragraphs from lines
   */
  private extractParagraphs(lines: Array<Array<{ text: string, x: number }>>): string[] {
    const paragraphs: string[] = []
    let currentParagraph: string[] = []

    for (const line of lines) {
      const lineText = line.map(item => item.text).join(' ').trim()

      if (lineText.length === 0) {
        // Empty line - end paragraph
        if (currentParagraph.length > 0) {
          paragraphs.push(currentParagraph.join(' '))
          currentParagraph = []
        }
      } else {
        currentParagraph.push(lineText)
      }
    }

    // Add last paragraph
    if (currentParagraph.length > 0) {
      paragraphs.push(currentParagraph.join(' '))
    }

    return paragraphs
  }
}
