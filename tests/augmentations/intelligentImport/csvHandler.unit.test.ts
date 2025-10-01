/**
 * CSV Handler Tests
 * Comprehensive tests for CSV parsing, encoding detection, and type inference
 */

import { describe, it, expect, beforeAll } from 'vitest'
import { CSVHandler } from '../../../src/augmentations/intelligentImport/handlers/csvHandler.js'
import { promises as fs } from 'fs'
import * as path from 'path'

describe('CSVHandler', () => {
  let handler: CSVHandler
  const fixturesPath = path.join(process.cwd(), 'tests/fixtures/import')

  beforeAll(() => {
    handler = new CSVHandler()
  })

  describe('canHandle', () => {
    it('should handle .csv extension', () => {
      expect(handler.canHandle({ filename: 'data.csv' })).toBe(true)
    })

    it('should handle .tsv extension', () => {
      expect(handler.canHandle({ filename: 'data.tsv' })).toBe(true)
    })

    it('should handle .txt extension', () => {
      expect(handler.canHandle({ filename: 'data.txt' })).toBe(true)
    })

    it('should handle CSV content (comma)', () => {
      const content = 'name,age,email\nJohn,30,john@example.com'
      expect(handler.canHandle(content)).toBe(true)
    })

    it('should handle CSV content (semicolon)', () => {
      const content = 'name;age;email\nJohn;30;john@example.com'
      expect(handler.canHandle(content)).toBe(true)
    })

    it('should not handle non-CSV content', () => {
      const content = 'This is just plain text without any structure'
      expect(handler.canHandle(content)).toBe(false)
    })

    it('should not handle .xlsx extension', () => {
      expect(handler.canHandle({ filename: 'data.xlsx' })).toBe(false)
    })
  })

  describe('process - simple CSV', () => {
    it('should parse simple comma-delimited CSV', async () => {
      const filePath = path.join(fixturesPath, 'simple.csv')
      const buffer = await fs.readFile(filePath)

      const result = await handler.process(buffer, { filename: 'simple.csv' })

      expect(result.format).toBe('csv')
      expect(result.data).toHaveLength(4)
      expect(result.data[0]).toEqual({
        name: 'John Doe',
        age: 30,
        email: 'john@example.com',
        active: true
      })
      expect(result.metadata.rowCount).toBe(4)
      expect(result.metadata.fields).toEqual(['name', 'age', 'email', 'active'])
      expect(result.metadata.delimiter).toBe(',')
      expect(result.metadata.hasHeaders).toBe(true)
    })

    it('should infer correct types', async () => {
      const filePath = path.join(fixturesPath, 'simple.csv')
      const buffer = await fs.readFile(filePath)

      const result = await handler.process(buffer, { filename: 'simple.csv' })

      expect(typeof result.data[0].name).toBe('string')
      expect(typeof result.data[0].age).toBe('number')
      expect(typeof result.data[0].active).toBe('boolean')
    })
  })

  describe('process - delimiter detection', () => {
    it('should detect semicolon delimiter', async () => {
      const filePath = path.join(fixturesPath, 'semicolon.csv')
      const buffer = await fs.readFile(filePath)

      const result = await handler.process(buffer, { filename: 'semicolon.csv' })

      expect(result.metadata.delimiter).toBe(';')
      expect(result.data).toHaveLength(4)
      expect(result.data[0]).toEqual({
        product: 'Laptop',
        price: 999.99,
        quantity: 10,
        inStock: true
      })
    })

    it('should detect tab delimiter', async () => {
      const filePath = path.join(fixturesPath, 'tab-delimited.csv')
      const buffer = await fs.readFile(filePath)

      const result = await handler.process(buffer, { filename: 'tab-delimited.csv' })

      expect(result.metadata.delimiter).toBe('\t')
      expect(result.data).toHaveLength(4)
      expect(result.data[0].city).toBe('Tokyo')
      expect(result.data[0].population).toBe(13960000)
    })

    it('should use specified delimiter when provided', async () => {
      const content = 'name|age|email\nJohn|30|john@example.com'

      const result = await handler.process(content, {
        csvDelimiter: '|',
        filename: 'pipe.csv'
      })

      expect(result.data).toHaveLength(1)
      expect(result.data[0].name).toBe('John')
      expect(result.data[0].age).toBe(30)
    })
  })

  describe('process - type inference', () => {
    it('should infer integer, float, date, and boolean types', async () => {
      const filePath = path.join(fixturesPath, 'types.csv')
      const buffer = await fs.readFile(filePath)

      const result = await handler.process(buffer, { filename: 'types.csv' })

      expect(result.metadata.types).toBeDefined()
      expect(result.metadata.types.id).toBe('integer')
      expect(result.metadata.types.name).toBe('string')
      // Score is 95 (integer), not 95.0, so it's detected as integer
      expect(['integer', 'float']).toContain(result.metadata.types.score)
      expect(result.metadata.types.active).toBe('boolean')

      // Check actual values
      expect(result.data[0].id).toBe(1)
      expect([95, 95.0]).toContain(result.data[0].score) // Can be integer or float
      expect(result.data[0].active).toBe(true)
      expect(result.data[1].score).toBe(87.5) // This one is definitely a float
    })

    it('should handle null values', async () => {
      const content = 'name,age,email\nJohn,30,john@example.com\nJane,,jane@example.com\nBob,45,'

      const result = await handler.process(content, { filename: 'nulls.csv' })

      expect(result.data[1].age).toBeNull()
      expect(result.data[2].email).toBeNull()
    })
  })

  describe('process - encoding detection', () => {
    it('should detect UTF-8 encoding', async () => {
      const content = 'name,description\nProduct 1,Description with émojis 🎉'

      const result = await handler.process(content, { filename: 'utf8.csv' })

      // Encoding can be 'UTF-8', 'utf-8', or 'utf8' depending on detection
      expect(result.metadata.encoding.toLowerCase()).toContain('utf')
      expect(result.data[0].description).toContain('émojis')
      expect(result.data[0].description).toContain('🎉')
    })

    it('should use specified encoding when provided', async () => {
      const content = 'name,age\nJohn,30'

      const result = await handler.process(content, {
        encoding: 'ascii',
        filename: 'ascii.csv'
      })

      expect(result.metadata.encoding).toBe('ascii')
    })
  })

  describe('process - options', () => {
    it('should respect csvHeaders=false option', async () => {
      const content = 'John,30,john@example.com\nJane,25,jane@example.com'

      const result = await handler.process(content, {
        csvHeaders: false,
        filename: 'no-headers.csv'
      })

      expect(result.metadata.hasHeaders).toBe(false)
      // csv-parse will generate column names like '0', '1', '2'
      expect(Object.keys(result.data[0])).toHaveLength(3)
    })

    it('should respect maxRows option', async () => {
      const filePath = path.join(fixturesPath, 'simple.csv')
      const buffer = await fs.readFile(filePath)

      const result = await handler.process(buffer, {
        maxRows: 2,
        filename: 'simple.csv'
      })

      expect(result.data).toHaveLength(2)
      expect(result.metadata.rowCount).toBe(2)
    })
  })

  describe('process - edge cases', () => {
    it('should handle empty CSV', async () => {
      const content = ''

      const result = await handler.process(content, { filename: 'empty.csv' })

      expect(result.data).toHaveLength(0)
      expect(result.metadata.rowCount).toBe(0)
      expect(result.metadata.fields).toEqual([])
    })

    it('should handle CSV with only headers', async () => {
      const content = 'name,age,email'

      const result = await handler.process(content, { filename: 'headers-only.csv' })

      expect(result.data).toHaveLength(0)
      expect(result.metadata.rowCount).toBe(0)
    })

    it('should handle CSV with single row', async () => {
      const content = 'name,age,email\nJohn,30,john@example.com'

      const result = await handler.process(content, { filename: 'single-row.csv' })

      expect(result.data).toHaveLength(1)
      expect(result.data[0].name).toBe('John')
    })

    it('should handle CSV with varying column counts', async () => {
      const content = 'name,age,email\nJohn,30,john@example.com\nJane,25\nBob,45,bob@example.com,extra'

      const result = await handler.process(content, { filename: 'varying.csv' })

      // csv-parse with relax_column_count should handle this
      expect(result.data).toHaveLength(3)
    })

    it('should trim whitespace', async () => {
      const content = 'name, age , email \n John , 30 , john@example.com '

      const result = await handler.process(content, { filename: 'whitespace.csv' })

      expect(result.data[0].name).toBe('John')
      expect(result.data[0].age).toBe(30)
      expect(result.data[0].email).toBe('john@example.com')
    })
  })

  describe('process - performance', () => {
    it('should measure processing time', async () => {
      const filePath = path.join(fixturesPath, 'simple.csv')
      const buffer = await fs.readFile(filePath)

      const result = await handler.process(buffer, { filename: 'simple.csv' })

      expect(result.metadata.processingTime).toBeGreaterThanOrEqual(0)
      expect(typeof result.metadata.processingTime).toBe('number')
    })
  })

  describe('process - error handling', () => {
    it('should throw error for malformed CSV', async () => {
      const content = 'name,age,email\nJohn,30,"unclosed quote'

      await expect(
        handler.process(content, { filename: 'malformed.csv' })
      ).rejects.toThrow('CSV parsing failed')
    })
  })
})
