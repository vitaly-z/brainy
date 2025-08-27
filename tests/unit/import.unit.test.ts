/**
 * Tests for the Universal Import functionality
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { BrainyData } from '../../src/brainyData.js'
import * as fs from 'fs/promises'

describe('Universal Import', () => {
  let brain: BrainyData
  
  beforeAll(async () => {
    // Use mock embedding for speed and in-memory storage
    brain = new BrainyData({
      embeddingFunction: async () => new Array(384).fill(0.1),
      storage: { forceMemoryStorage: true }
    })
    await brain.init()
  })
  
  afterAll(async () => {
    // Clean up any test files
    await fs.unlink('test-data.csv').catch(() => {})
    await fs.unlink('test-data.yaml').catch(() => {})
  })
  
  describe('Import API', () => {
    it('should have ONE universal import method', () => {
      expect(typeof brain.import).toBe('function')
    })
    
    it('should NOT have separate importFile method', () => {
      expect(brain.importFile).toBeUndefined()
    })
    
    it('should NOT have separate importUrl method', () => {
      expect(brain.importUrl).toBeUndefined()
    })
  })
  
  describe('Data Import', () => {
    it('should import array of objects', async () => {
      const data = [
        { name: 'Alice', type: 'person' },
        { name: 'Bob', type: 'person' }
      ]
      
      const ids = await brain.import(data)
      
      expect(ids).toBeDefined()
      expect(Array.isArray(ids)).toBe(true)
      expect(ids.length).toBe(2)
    })
    
    it('should import single object', async () => {
      const data = { name: 'Test Item', value: 123 }
      
      const ids = await brain.import(data)
      
      expect(ids).toBeDefined()
      expect(Array.isArray(ids)).toBe(true)
      expect(ids.length).toBe(1)
    })
    
    it('should import CSV format', async () => {
      const csv = `name,age,role
John,30,Engineer
Jane,25,Designer`
      
      const ids = await brain.import(csv, { format: 'csv' })
      
      expect(ids).toBeDefined()
      expect(ids.length).toBe(2)
    })
    
    it('should import text format', async () => {
      const text = 'This is a test sentence.'
      
      const ids = await brain.import(text, { format: 'text' })
      
      expect(ids).toBeDefined()
      expect(ids.length).toBeGreaterThan(0)
    })
    
    it('should handle CSV with quoted values', async () => {
      const csv = `name,description
"Smith, John","A person with a comma in name"
"Regular Name","Normal description"`
      
      const ids = await brain.import(csv, { format: 'csv' })
      
      expect(ids).toBeDefined()
      expect(ids.length).toBe(2)
    })
    
    it('should import YAML format', async () => {
      const yaml = `name: TestProject
version: 1.0
active: true`
      
      const ids = await brain.import(yaml, { format: 'yaml' })
      
      expect(ids).toBeDefined()
      expect(ids.length).toBeGreaterThan(0)
    })
  })
  
  describe('File Import', () => {
    it('should import from CSV file', async () => {
      // Create test file
      const csvContent = `product,price
Widget,19.99
Gadget,29.99`
      
      await fs.writeFile('test-data.csv', csvContent)
      
      const ids = await brain.import('test-data.csv')
      
      expect(ids).toBeDefined()
      expect(ids.length).toBe(2)
      
      // Clean up
      await fs.unlink('test-data.csv').catch(() => {})
    })
  })
  
  describe('Import Options', () => {
    it('should respect batch size option', async () => {
      const data = Array(10).fill(null).map((_, i) => ({ id: i, name: `Item ${i}` }))
      
      const ids = await brain.import(data, { batchSize: 5 })
      
      expect(ids).toBeDefined()
      expect(ids.length).toBe(10)
    })
    
    it('should auto-detect format when not specified', async () => {
      const jsonData = [{ test: 'data' }]
      
      const ids = await brain.import(jsonData)
      
      expect(ids).toBeDefined()
      expect(ids.length).toBe(1)
    })
  })
  
  describe('Data Retrieval', () => {
    it('should store imported data with metadata', async () => {
      const data = { name: 'TestItem', category: 'test' }
      
      const [id] = await brain.import(data)
      const noun = await brain.getNoun(id)
      
      expect(noun).toBeDefined()
      expect(noun?.metadata).toBeDefined()
      expect(noun?.metadata?.name).toBe('TestItem')
      expect(noun?.metadata?.category).toBe('test')
    })
  })
})