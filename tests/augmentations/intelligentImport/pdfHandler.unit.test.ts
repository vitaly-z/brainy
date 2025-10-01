/**
 * PDF Handler Tests
 * Comprehensive tests for PDF text extraction, table detection, and metadata
 */

import { describe, it, expect, beforeAll } from 'vitest'
import { PDFHandler } from '../../../src/augmentations/intelligentImport/handlers/pdfHandler.js'
import { promises as fs } from 'fs'
import * as path from 'path'

describe('PDFHandler', () => {
  let handler: PDFHandler
  const fixturesPath = path.join(process.cwd(), 'tests/fixtures/import')

  beforeAll(() => {
    handler = new PDFHandler()
  })

  describe('canHandle', () => {
    it('should handle .pdf extension', () => {
      expect(handler.canHandle({ filename: 'document.pdf' })).toBe(true)
    })

    it('should handle PDF magic bytes', () => {
      const pdfBuffer = Buffer.from('%PDF-1.4\n')
      expect(handler.canHandle(pdfBuffer)).toBe(true)
    })

    it('should not handle .xlsx extension', () => {
      expect(handler.canHandle({ filename: 'data.xlsx' })).toBe(false)
    })

    it('should not handle .csv extension', () => {
      expect(handler.canHandle({ filename: 'data.csv' })).toBe(false)
    })

    it('should not handle non-PDF buffer', () => {
      const buffer = Buffer.from('This is not a PDF')
      expect(handler.canHandle(buffer)).toBe(false)
    })
  })

  describe('process - simple text PDF', () => {
    it('should extract text from simple PDF', async () => {
      const filePath = path.join(fixturesPath, 'simple.pdf')
      const buffer = await fs.readFile(filePath)

      const result = await handler.process(buffer, { filename: 'simple.pdf' })

      expect(result.format).toBe('pdf')
      expect(result.data.length).toBeGreaterThan(0)

      // Should have extracted paragraphs
      const paragraphs = result.data.filter(item => item._type === 'paragraph')
      expect(paragraphs.length).toBeGreaterThan(0)

      // Check that text was extracted
      const hasText = paragraphs.some(p => p.text && p.text.length > 0)
      expect(hasText).toBe(true)
    })

    it('should include page numbers', async () => {
      const filePath = path.join(fixturesPath, 'simple.pdf')
      const buffer = await fs.readFile(filePath)

      const result = await handler.process(buffer, { filename: 'simple.pdf' })

      // All items should have _page field
      expect(result.data.every(item => typeof item._page === 'number')).toBe(true)
      expect(result.data.every(item => item._page >= 1)).toBe(true)
    })

    it('should count pages correctly', async () => {
      const filePath = path.join(fixturesPath, 'simple.pdf')
      const buffer = await fs.readFile(filePath)

      const result = await handler.process(buffer, { filename: 'simple.pdf' })

      expect(result.metadata.pageCount).toBe(1)
    })
  })

  describe('process - multi-page PDF', () => {
    it('should extract text from all pages', async () => {
      const filePath = path.join(fixturesPath, 'multi-page.pdf')
      const buffer = await fs.readFile(filePath)

      const result = await handler.process(buffer, { filename: 'multi-page.pdf' })

      expect(result.metadata.pageCount).toBe(3)

      // Should have content from multiple pages
      const pages = new Set(result.data.map(item => item._page))
      expect(pages.size).toBeGreaterThan(1)
      expect(pages.has(1)).toBe(true)
      expect(pages.has(2)).toBe(true)
      expect(pages.has(3)).toBe(true)
    })

    it('should preserve page order', async () => {
      const filePath = path.join(fixturesPath, 'multi-page.pdf')
      const buffer = await fs.readFile(filePath)

      const result = await handler.process(buffer, { filename: 'multi-page.pdf' })

      // Page numbers should be in order
      let lastPage = 0
      let pageChanged = false

      for (const item of result.data) {
        if (item._page !== lastPage && lastPage > 0) {
          pageChanged = true
        }
        expect(item._page).toBeGreaterThanOrEqual(lastPage)
        lastPage = item._page
      }

      expect(pageChanged).toBe(true) // Should have moved through pages
    })
  })

  describe('process - table detection', () => {
    it('should detect tables in PDF', async () => {
      const filePath = path.join(fixturesPath, 'table.pdf')
      const buffer = await fs.readFile(filePath)

      const result = await handler.process(buffer, { filename: 'table.pdf' })

      // Should have detected at least one table
      expect(result.metadata.tableCount).toBeGreaterThan(0)
    })

    it('should extract table rows when tables detected', async () => {
      const filePath = path.join(fixturesPath, 'table.pdf')
      const buffer = await fs.readFile(filePath)

      const result = await handler.process(buffer, {
        filename: 'table.pdf',
        pdfExtractTables: true
      })

      // Should have table_row items
      const tableRows = result.data.filter(item => item._type === 'table_row')
      expect(tableRows.length).toBeGreaterThan(0)

      // Table rows should have structured data
      if (tableRows.length > 0) {
        const firstRow = tableRows[0]
        const fields = Object.keys(firstRow).filter(k => !k.startsWith('_'))
        expect(fields.length).toBeGreaterThan(0)
      }
    })

    it('should skip table extraction when disabled', async () => {
      const filePath = path.join(fixturesPath, 'table.pdf')
      const buffer = await fs.readFile(filePath)

      const result = await handler.process(buffer, {
        filename: 'table.pdf',
        pdfExtractTables: false
      })

      // Should not have detected tables
      expect(result.metadata.tableCount).toBe(0)

      // Should not have table_row items
      const tableRows = result.data.filter(item => item._type === 'table_row')
      expect(tableRows.length).toBe(0)
    })
  })

  describe('process - metadata extraction', () => {
    it('should extract PDF metadata', async () => {
      const filePath = path.join(fixturesPath, 'metadata.pdf')
      const buffer = await fs.readFile(filePath)

      const result = await handler.process(buffer, { filename: 'metadata.pdf' })

      expect(result.metadata.pdfMetadata).toBeDefined()
      expect(result.metadata.pdfMetadata.title).toBe('Test Document')
      expect(result.metadata.pdfMetadata.author).toBe('Test Author')
      expect(result.metadata.pdfMetadata.creator).toBe('Brainy Test Suite')
    })

    it('should handle PDFs without metadata gracefully', async () => {
      const filePath = path.join(fixturesPath, 'simple.pdf')
      const buffer = await fs.readFile(filePath)

      const result = await handler.process(buffer, { filename: 'simple.pdf' })

      expect(result.metadata.pdfMetadata).toBeDefined()
      // Some fields may be null
      expect(result.metadata.pdfMetadata).toHaveProperty('title')
      expect(result.metadata.pdfMetadata).toHaveProperty('author')
    })
  })

  describe('process - text statistics', () => {
    it('should track total text length', async () => {
      const filePath = path.join(fixturesPath, 'simple.pdf')
      const buffer = await fs.readFile(filePath)

      const result = await handler.process(buffer, { filename: 'simple.pdf' })

      expect(result.metadata.textLength).toBeGreaterThan(0)
      expect(typeof result.metadata.textLength).toBe('number')
    })

    it('should count extracted items', async () => {
      const filePath = path.join(fixturesPath, 'simple.pdf')
      const buffer = await fs.readFile(filePath)

      const result = await handler.process(buffer, { filename: 'simple.pdf' })

      expect(result.metadata.rowCount).toBe(result.data.length)
      expect(result.metadata.rowCount).toBeGreaterThan(0)
    })
  })

  describe('process - edge cases', () => {
    it('should handle empty PDF', async () => {
      const filePath = path.join(fixturesPath, 'empty.pdf')
      const buffer = await fs.readFile(filePath)

      const result = await handler.process(buffer, { filename: 'empty.pdf' })

      expect(result.format).toBe('pdf')
      expect(result.metadata.pageCount).toBe(1)
      // Empty PDF may have 0 or minimal content
      expect(result.data).toBeDefined()
    })

    it('should measure processing time', async () => {
      const filePath = path.join(fixturesPath, 'simple.pdf')
      const buffer = await fs.readFile(filePath)

      const result = await handler.process(buffer, { filename: 'simple.pdf' })

      expect(result.metadata.processingTime).toBeGreaterThan(0)
      expect(typeof result.metadata.processingTime).toBe('number')
    })
  })

  describe('process - data structure', () => {
    it('should include type indicators', async () => {
      const filePath = path.join(fixturesPath, 'simple.pdf')
      const buffer = await fs.readFile(filePath)

      const result = await handler.process(buffer, { filename: 'simple.pdf' })

      // All items should have _type field
      expect(result.data.every(item => '_type' in item)).toBe(true)

      // Types should be valid
      const validTypes = ['paragraph', 'table_row']
      expect(result.data.every(item => validTypes.includes(item._type))).toBe(true)
    })

    it('should include index for paragraphs', async () => {
      const filePath = path.join(fixturesPath, 'simple.pdf')
      const buffer = await fs.readFile(filePath)

      const result = await handler.process(buffer, { filename: 'simple.pdf' })

      const paragraphs = result.data.filter(item => item._type === 'paragraph')

      // Paragraphs should have _index field
      expect(paragraphs.every(p => typeof p._index === 'number')).toBe(true)
    })
  })

  describe('process - error handling', () => {
    it('should throw error for invalid PDF', async () => {
      const invalidData = Buffer.from('This is not a PDF file')

      await expect(
        handler.process(invalidData, { filename: 'invalid.pdf' })
      ).rejects.toThrow('PDF parsing failed')
    })

    it('should throw error for corrupted PDF', async () => {
      const corruptedPDF = Buffer.concat([
        Buffer.from('%PDF-1.4\n'),
        Buffer.from('corrupted data that is not valid PDF structure')
      ])

      await expect(
        handler.process(corruptedPDF, { filename: 'corrupted.pdf' })
      ).rejects.toThrow('PDF parsing failed')
    })
  })
})
