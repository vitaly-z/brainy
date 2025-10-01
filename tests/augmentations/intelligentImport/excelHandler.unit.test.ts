/**
 * Excel Handler Tests
 * Comprehensive tests for Excel parsing, multi-sheet extraction, and type inference
 */

import { describe, it, expect, beforeAll } from 'vitest'
import { ExcelHandler } from '../../../src/augmentations/intelligentImport/handlers/excelHandler.js'
import { promises as fs } from 'fs'
import * as path from 'path'

describe('ExcelHandler', () => {
  let handler: ExcelHandler
  const fixturesPath = path.join(process.cwd(), 'tests/fixtures/import')

  beforeAll(() => {
    handler = new ExcelHandler()
  })

  describe('canHandle', () => {
    it('should handle .xlsx extension', () => {
      expect(handler.canHandle({ filename: 'data.xlsx' })).toBe(true)
    })

    it('should handle .xls extension', () => {
      expect(handler.canHandle({ filename: 'data.xls' })).toBe(true)
    })

    it('should handle .xlsb extension', () => {
      expect(handler.canHandle({ filename: 'data.xlsb' })).toBe(true)
    })

    it('should handle .xlsm extension', () => {
      expect(handler.canHandle({ filename: 'data.xlsm' })).toBe(true)
    })

    it('should not handle .csv extension', () => {
      expect(handler.canHandle({ filename: 'data.csv' })).toBe(false)
    })

    it('should not handle .pdf extension', () => {
      expect(handler.canHandle({ filename: 'data.pdf' })).toBe(false)
    })
  })

  describe('process - simple Excel', () => {
    it('should parse simple single-sheet Excel file', async () => {
      const filePath = path.join(fixturesPath, 'simple.xlsx')
      const buffer = await fs.readFile(filePath)

      const result = await handler.process(buffer, { filename: 'simple.xlsx' })

      expect(result.format).toBe('excel')
      expect(result.data).toHaveLength(4)
      expect(result.data[0]).toMatchObject({
        Name: 'Alice Johnson',
        Age: 28,
        Department: 'Engineering',
        Salary: 95000,
        Active: true
      })
      expect(result.metadata.rowCount).toBe(4)
      expect(result.metadata.sheetCount).toBe(1)
      expect(result.metadata.sheets).toEqual(['Employees'])
    })

    it('should infer correct types from Excel data', async () => {
      const filePath = path.join(fixturesPath, 'simple.xlsx')
      const buffer = await fs.readFile(filePath)

      const result = await handler.process(buffer, { filename: 'simple.xlsx' })

      expect(result.metadata.types).toBeDefined()
      expect(result.metadata.types.Name).toBe('string')
      expect(result.metadata.types.Age).toBe('integer')
      expect(['integer', 'float']).toContain(result.metadata.types.Salary)
      expect(result.metadata.types.Active).toBe('boolean')
    })
  })

  describe('process - multi-sheet Excel', () => {
    it('should extract data from all sheets by default', async () => {
      const filePath = path.join(fixturesPath, 'multi-sheet.xlsx')
      const buffer = await fs.readFile(filePath)

      const result = await handler.process(buffer, { filename: 'multi-sheet.xlsx' })

      expect(result.metadata.sheetCount).toBe(3)
      expect(result.metadata.sheets).toEqual(['Products', 'Orders', 'Customers'])

      // Total rows from all sheets
      const totalRows = 4 + 3 + 3 // Products + Orders + Customers
      expect(result.data).toHaveLength(totalRows)

      // Check _sheet field is added
      expect(result.data[0]._sheet).toBe('Products')
    })

    it('should filter data by sheet name', async () => {
      const filePath = path.join(fixturesPath, 'multi-sheet.xlsx')
      const buffer = await fs.readFile(filePath)

      const result = await handler.process(buffer, {
        filename: 'multi-sheet.xlsx',
        excelSheets: ['Products']
      })

      expect(result.metadata.sheetCount).toBe(1)
      expect(result.metadata.sheets).toEqual(['Products'])
      expect(result.data).toHaveLength(4)
      expect(result.data.every(row => row._sheet === 'Products')).toBe(true)
    })

    it('should extract data from multiple specified sheets', async () => {
      const filePath = path.join(fixturesPath, 'multi-sheet.xlsx')
      const buffer = await fs.readFile(filePath)

      const result = await handler.process(buffer, {
        filename: 'multi-sheet.xlsx',
        excelSheets: ['Products', 'Customers']
      })

      expect(result.metadata.sheetCount).toBe(2)
      expect(result.metadata.sheets).toEqual(['Products', 'Customers'])
      expect(result.data).toHaveLength(7) // 4 + 3

      const sheets = new Set(result.data.map(row => row._sheet))
      expect(sheets.has('Products')).toBe(true)
      expect(sheets.has('Customers')).toBe(true)
      expect(sheets.has('Orders')).toBe(false)
    })

    it('should include sheet metadata for each sheet', async () => {
      const filePath = path.join(fixturesPath, 'multi-sheet.xlsx')
      const buffer = await fs.readFile(filePath)

      const result = await handler.process(buffer, { filename: 'multi-sheet.xlsx' })

      expect(result.metadata.sheetMetadata).toBeDefined()
      expect(result.metadata.sheetMetadata.Products).toMatchObject({
        rowCount: 4,
        columnCount: 5
      })
      expect(result.metadata.sheetMetadata.Products.headers).toEqual([
        'ID', 'Product', 'Price', 'Stock', 'Category'
      ])
    })
  })

  describe('process - type inference', () => {
    it('should infer integer, float, date, and boolean types', async () => {
      const filePath = path.join(fixturesPath, 'types.xlsx')
      const buffer = await fs.readFile(filePath)

      const result = await handler.process(buffer, { filename: 'types.xlsx' })

      expect(result.metadata.types).toBeDefined()
      expect(result.metadata.types.ID).toBe('integer')
      expect(result.metadata.types.Name).toBe('string')
      expect(['integer', 'float']).toContain(result.metadata.types.Score)
      expect(['integer', 'float']).toContain(result.metadata.types.Percentage)
      expect(result.metadata.types.Active).toBe('boolean')

      // Check actual values
      expect(result.data[0].ID).toBe(1)
      expect(result.data[0].Active).toBe(true)
      expect(typeof result.data[0].Score).toBe('number')
    })

    it('should handle null/empty values', async () => {
      const filePath = path.join(fixturesPath, 'empty.xlsx')
      const buffer = await fs.readFile(filePath)

      const result = await handler.process(buffer, { filename: 'empty.xlsx' })

      expect(result.data).toHaveLength(0)
      expect(result.metadata.rowCount).toBe(0)
    })
  })

  describe('process - workbook metadata', () => {
    it('should extract workbook information', async () => {
      const filePath = path.join(fixturesPath, 'multi-sheet.xlsx')
      const buffer = await fs.readFile(filePath)

      const result = await handler.process(buffer, { filename: 'multi-sheet.xlsx' })

      expect(result.metadata.workbookInfo).toBeDefined()
      expect(result.metadata.workbookInfo.sheetNames).toEqual([
        'Products', 'Orders', 'Customers'
      ])
    })
  })

  describe('process - edge cases', () => {
    it('should handle Excel file with only headers', async () => {
      const filePath = path.join(fixturesPath, 'empty.xlsx')
      const buffer = await fs.readFile(filePath)

      const result = await handler.process(buffer, { filename: 'empty.xlsx' })

      expect(result.data).toHaveLength(0)
      expect(result.metadata.sheetCount).toBe(1)
    })

    it('should skip non-existent sheets when filtering', async () => {
      const filePath = path.join(fixturesPath, 'simple.xlsx')
      const buffer = await fs.readFile(filePath)

      const result = await handler.process(buffer, {
        filename: 'simple.xlsx',
        excelSheets: ['Employees', 'NonExistent']
      })

      expect(result.metadata.sheets).toEqual(['Employees'])
      expect(result.data).toHaveLength(4)
    })
  })

  describe('process - performance', () => {
    it('should measure processing time', async () => {
      const filePath = path.join(fixturesPath, 'simple.xlsx')
      const buffer = await fs.readFile(filePath)

      const result = await handler.process(buffer, { filename: 'simple.xlsx' })

      expect(result.metadata.processingTime).toBeGreaterThanOrEqual(0)
      expect(typeof result.metadata.processingTime).toBe('number')
    })
  })

  describe('process - field sanitization', () => {
    it('should sanitize column names', async () => {
      const filePath = path.join(fixturesPath, 'simple.xlsx')
      const buffer = await fs.readFile(filePath)

      const result = await handler.process(buffer, { filename: 'simple.xlsx' })

      // All field names should be valid identifiers
      const fields = Object.keys(result.data[0]).filter(k => k !== '_sheet')
      for (const field of fields) {
        expect(field).toMatch(/^[a-zA-Z_][a-zA-Z0-9_]*$/)
      }
    })
  })

  describe('process - error handling', () => {
    it('should handle corrupted Excel file gracefully', async () => {
      // XLSX library is very forgiving, so we test that it returns empty data
      // rather than crashing
      const invalidData = Buffer.from('This is not an Excel file')

      const result = await handler.process(invalidData, { filename: 'invalid.xlsx' })

      // Should return empty data instead of crashing
      expect(result.data).toHaveLength(0)
      expect(result.metadata.rowCount).toBe(0)
    })

    it('should handle binary garbage', async () => {
      const garbage = Buffer.from(new Uint8Array(256).fill(255))

      const result = await handler.process(garbage, { filename: 'garbage.xlsx' })

      // Should not crash
      expect(result).toBeDefined()
      expect(result.format).toBe('excel')
    })
  })
})
