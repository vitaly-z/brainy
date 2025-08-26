/**
 * Neural Import Comprehensive Tests
 * 
 * Tests the AI-powered data import and understanding features
 * CRITICAL: Uses REAL models - NO MOCKING
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { BrainyData } from '../src/brainyData.js'
import { NeuralImport } from '../src/cortex/neuralImport.js'
import { NeuralImportAugmentation } from '../src/augmentations/neuralImport.js'
import { NounType, VerbType } from '../src/types/graphTypes.js'
import { writeFile, unlink } from 'fs/promises'
import { join } from 'path'

describe('Neural Import - AI-Powered Data Understanding', () => {
  let brain: BrainyData
  let neuralImport: NeuralImport
  let testDataPath: string
  
  beforeEach(async () => {
    // Use memory storage to avoid file system issues
    brain = new BrainyData({
      storage: { forceMemoryStorage: true },
      logging: { verbose: false }
    })
    await brain.init()
    
    neuralImport = new NeuralImport(brain)
    testDataPath = join(process.cwd(), 'test-import-data.csv')
  })
  
  afterEach(async () => {
    // Clean up test files
    try {
      await unlink(testDataPath)
    } catch (e) {
      // Ignore if file doesn't exist
    }
    
    // Clean up brain instance
    if (brain) {
      await brain.cleanup?.()
    }
  })

  describe('File Format Detection', () => {
    it('should detect CSV format and parse correctly', async () => {
      const csvData = `name,type,description
"JavaScript",language,"Dynamic programming language"
"TypeScript",language,"Typed superset of JavaScript"
"React",framework,"UI library for JavaScript"`
      
      await writeFile(testDataPath, csvData)
      
      const result = await neuralImport.neuralImport(testDataPath)
      
      expect(result).toBeDefined()
      expect(result.format).toBe('csv')
      expect(result.entitiesDetected).toBeGreaterThan(0)
      expect(result.relationshipsDetected).toBeGreaterThanOrEqual(0)
    })

    it('should detect JSON format and parse correctly', async () => {
      const jsonPath = join(process.cwd(), 'test-import-data.json')
      const jsonData = JSON.stringify([
        { name: 'Node.js', type: 'runtime', description: 'JavaScript runtime' },
        { name: 'Express', type: 'framework', description: 'Web framework' },
        { name: 'MongoDB', type: 'database', description: 'NoSQL database' }
      ], null, 2)
      
      await writeFile(jsonPath, jsonData)
      
      const result = await neuralImport.neuralImport(jsonPath)
      
      expect(result).toBeDefined()
      expect(result.format).toBe('json')
      expect(result.entitiesDetected).toBe(3)
      
      await unlink(jsonPath)
    })

    it('should handle XML format', async () => {
      const xmlPath = join(process.cwd(), 'test-import-data.xml')
      const xmlData = `<?xml version="1.0"?>
<technologies>
  <tech name="Python" type="language">General-purpose programming</tech>
  <tech name="Django" type="framework">Web framework for Python</tech>
</technologies>`
      
      await writeFile(xmlPath, xmlData)
      
      const result = await neuralImport.neuralImport(xmlPath)
      
      expect(result).toBeDefined()
      expect(result.format).toBe('xml')
      expect(result.entitiesDetected).toBeGreaterThan(0)
      
      await unlink(xmlPath)
    })

    it('should handle plain text with entity extraction', async () => {
      const txtPath = join(process.cwd(), 'test-import-data.txt')
      const textData = `Apple Inc. was founded by Steve Jobs, Steve Wozniak, and Ronald Wayne.
The company is headquartered in Cupertino, California.
Microsoft was founded by Bill Gates and Paul Allen in 1975.`
      
      await writeFile(txtPath, textData)
      
      const result = await neuralImport.neuralImport(txtPath)
      
      expect(result).toBeDefined()
      expect(result.format).toBe('text')
      // Should detect entities like companies and people
      expect(result.entitiesDetected).toBeGreaterThan(0)
      
      await unlink(txtPath)
    })
  })

  describe('Entity Detection with Neural Analysis', () => {
    it('should detect entities from structured data', async () => {
      const data = [
        { name: 'Tesla', type: 'company', industry: 'Automotive' },
        { name: 'SpaceX', type: 'company', industry: 'Aerospace' },
        { name: 'Elon Musk', type: 'person', role: 'CEO' }
      ]
      
      const entities = await neuralImport.detectEntitiesWithNeuralAnalysis(data)
      
      expect(entities).toBeDefined()
      expect(Array.isArray(entities)).toBe(true)
      expect(entities.length).toBeGreaterThan(0)
      
      // Should have detected companies and person
      const companies = entities.filter(e => e.type === NounType.Organization)
      const people = entities.filter(e => e.type === NounType.Person)
      
      expect(companies.length).toBeGreaterThanOrEqual(2)
      expect(people.length).toBeGreaterThanOrEqual(1)
    })

    it('should extract entities from unstructured text', async () => {
      const text = `Amazon Web Services (AWS) provides cloud computing services.
Jeff Bezos founded Amazon in 1994. The company is based in Seattle.
AWS competes with Microsoft Azure and Google Cloud Platform.`
      
      const entities = await neuralImport.detectEntitiesWithNeuralAnalysis(text)
      
      expect(entities).toBeDefined()
      expect(Array.isArray(entities)).toBe(true)
      
      // Should detect companies, products, and people
      const hasCompanies = entities.some(e => 
        e.type === NounType.Organization || 
        e.name?.includes('Amazon') || 
        e.name?.includes('Microsoft') ||
        e.name?.includes('Google')
      )
      expect(hasCompanies).toBe(true)
    })

    it('should handle mixed data types', async () => {
      const mixedData = {
        companies: ['Apple', 'Google', 'Microsoft'],
        people: ['Tim Cook', 'Sundar Pichai', 'Satya Nadella'],
        products: ['iPhone', 'Pixel', 'Surface'],
        metadata: {
          industry: 'Technology',
          market: 'Global'
        }
      }
      
      const entities = await neuralImport.detectEntitiesWithNeuralAnalysis(mixedData)
      
      expect(entities).toBeDefined()
      expect(entities.length).toBeGreaterThan(0)
      
      // Should handle nested structures
      const names = entities.map(e => e.name)
      expect(names.some(n => n?.includes('Apple'))).toBe(true)
    })
  })

  describe('Noun Type Detection', () => {
    it('should correctly identify Person noun type', async () => {
      const personEntity = {
        name: 'Albert Einstein',
        profession: 'Physicist',
        birthYear: 1879
      }
      
      const nounType = await neuralImport.detectNounType(personEntity)
      
      expect(nounType).toBe(NounType.Person)
    })

    it('should correctly identify Organization noun type', async () => {
      const orgEntity = {
        name: 'OpenAI',
        type: 'Research Organization',
        founded: 2015
      }
      
      const nounType = await neuralImport.detectNounType(orgEntity)
      
      expect(nounType).toBe(NounType.Organization)
    })

    it('should correctly identify Location noun type', async () => {
      const locationEntity = {
        name: 'San Francisco',
        type: 'City',
        country: 'United States'
      }
      
      const nounType = await neuralImport.detectNounType(locationEntity)
      
      expect(nounType).toBe(NounType.Location)
    })

    it('should correctly identify Document noun type', async () => {
      const docEntity = {
        title: 'Research Paper on AI',
        type: 'Academic Paper',
        pages: 20
      }
      
      const nounType = await neuralImport.detectNounType(docEntity)
      
      expect(nounType).toBe(NounType.Document)
    })

    it('should handle ambiguous entities', async () => {
      const ambiguousEntity = {
        name: 'Apple',
        // Could be company or fruit
      }
      
      const nounType = await neuralImport.detectNounType(ambiguousEntity)
      
      // Should make a reasonable guess
      expect(nounType).toBeDefined()
      expect(Object.values(NounType)).toContain(nounType)
    })
  })

  describe('Relationship Detection', () => {
    it('should detect relationships between entities', async () => {
      const entities = [
        { id: '1', name: 'Steve Jobs', type: NounType.Person },
        { id: '2', name: 'Apple Inc.', type: NounType.Organization },
        { id: '3', name: 'iPhone', type: NounType.Content },
        { id: '4', name: 'Tim Cook', type: NounType.Person }
      ]
      
      const relationships = await neuralImport.detectRelationships(entities)
      
      expect(relationships).toBeDefined()
      expect(Array.isArray(relationships)).toBe(true)
      
      // Should detect founder relationship, product relationship, etc.
      if (relationships.length > 0) {
        expect(relationships[0]).toHaveProperty('source')
        expect(relationships[0]).toHaveProperty('target')
        expect(relationships[0]).toHaveProperty('type')
      }
    })

    it('should identify employment relationships', async () => {
      const entities = [
        { id: 'p1', name: 'Satya Nadella', type: NounType.Person, role: 'CEO' },
        { id: 'c1', name: 'Microsoft', type: NounType.Organization }
      ]
      
      const relationships = await neuralImport.detectRelationships(entities)
      
      const employmentRel = relationships.find(r => 
        r.type === VerbType.WorksFor || 
        r.type === VerbType.RelatedTo
      )
      
      expect(employmentRel).toBeDefined()
    })

    it('should identify creation relationships', async () => {
      const entities = [
        { id: 'author1', name: 'J.K. Rowling', type: NounType.Person },
        { id: 'book1', name: 'Harry Potter', type: NounType.Document }
      ]
      
      const relationships = await neuralImport.detectRelationships(entities)
      
      const creationRel = relationships.find(r => 
        r.type === VerbType.CreatedBy || 
        r.type === VerbType.AuthoredBy ||
        r.type === VerbType.RelatedTo
      )
      
      expect(creationRel).toBeDefined()
    })
  })

  describe('Insight Generation', () => {
    it('should generate insights from imported data', async () => {
      const data = {
        entities: [
          { name: 'Google', revenue: 282.8, employees: 190000 },
          { name: 'Apple', revenue: 394.3, employees: 164000 },
          { name: 'Microsoft', revenue: 198.3, employees: 221000 }
        ]
      }
      
      const insights = await neuralImport.generateInsights(data)
      
      expect(insights).toBeDefined()
      expect(insights).toHaveProperty('summary')
      expect(insights).toHaveProperty('patterns')
      expect(insights).toHaveProperty('recommendations')
      
      // Should identify patterns like revenue/employee ratios
      expect(insights.patterns.length).toBeGreaterThan(0)
    })

    it('should identify data quality issues', async () => {
      const problematicData = {
        entities: [
          { name: 'Company A', revenue: 100 },
          { name: '', revenue: 200 }, // Missing name
          { name: 'Company C' }, // Missing revenue
          { name: 'Company D', revenue: -50 } // Invalid revenue
        ]
      }
      
      const insights = await neuralImport.generateInsights(problematicData)
      
      expect(insights.dataQuality).toBeDefined()
      expect(insights.dataQuality.issues).toContain('missing_values')
      expect(insights.dataQuality.issues).toContain('invalid_values')
    })

    it('should provide actionable recommendations', async () => {
      const data = {
        entities: [
          { name: 'Product A', sales: 1000, rating: 4.5 },
          { name: 'Product B', sales: 500, rating: 3.2 },
          { name: 'Product C', sales: 2000, rating: 4.8 }
        ]
      }
      
      const insights = await neuralImport.generateInsights(data)
      
      expect(insights.recommendations).toBeDefined()
      expect(Array.isArray(insights.recommendations)).toBe(true)
      expect(insights.recommendations.length).toBeGreaterThan(0)
      
      // Should recommend focusing on high-performing products
      const hasActionableRec = insights.recommendations.some(r => 
        r.includes('focus') || r.includes('improve') || r.includes('consider')
      )
      expect(hasActionableRec).toBe(true)
    })
  })

  describe('Neural Import Augmentation', () => {
    it('should work as an augmentation', async () => {
      const augmentation = new NeuralImportAugmentation({
        autoDetect: true,
        confidenceThreshold: 0.7
      })
      
      const augmentedBrain = new BrainyData({
        storage: { forceMemoryStorage: true },
        augmentations: [augmentation]
      })
      
      await augmentedBrain.init()
      
      // Should have neural import methods available
      expect(typeof augmentedBrain.neuralImport).toBe('function')
      
      await augmentedBrain.cleanup?.()
    })

    it('should respect confidence threshold', async () => {
      const augmentation = new NeuralImportAugmentation({
        confidenceThreshold: 0.9 // Very high threshold
      })
      
      brain = new BrainyData({
        storage: { forceMemoryStorage: true },
        augmentations: [augmentation]
      })
      
      await brain.init()
      
      const lowConfidenceData = {
        vague: 'maybe something',
        unclear: 'possibly related'
      }
      
      const result = await brain.neuralImport(lowConfidenceData)
      
      // Should filter out low confidence entities
      expect(result.entitiesDetected).toBe(0)
      
      await brain.cleanup?.()
    })
  })

  describe('Batch Import Performance', () => {
    it('should handle large datasets efficiently', async () => {
      const largeDataset = Array.from({ length: 100 }, (_, i) => ({
        id: `item-${i}`,
        name: `Item ${i}`,
        category: i % 5 === 0 ? 'A' : i % 3 === 0 ? 'B' : 'C',
        value: Math.random() * 1000
      }))
      
      const startTime = Date.now()
      const result = await neuralImport.detectEntitiesWithNeuralAnalysis(largeDataset)
      const duration = Date.now() - startTime
      
      expect(result).toBeDefined()
      expect(result.length).toBeGreaterThan(0)
      expect(duration).toBeLessThan(10000) // Should complete within 10 seconds
    })

    it('should batch process for memory efficiency', async () => {
      // Create a dataset that would be too large if processed all at once
      const hugeDataset = Array.from({ length: 1000 }, (_, i) => ({
        id: i,
        text: `Document ${i} with substantial content that needs processing`
      }))
      
      // Should process in batches without running out of memory
      const result = await neuralImport.detectEntitiesWithNeuralAnalysis(hugeDataset)
      
      expect(result).toBeDefined()
      expect(Array.isArray(result)).toBe(true)
    })
  })

  describe('Error Handling', () => {
    it('should handle non-existent files gracefully', async () => {
      const result = await neuralImport.neuralImport('/non/existent/file.csv')
      
      expect(result).toBeDefined()
      expect(result.error).toBeDefined()
      expect(result.entitiesDetected).toBe(0)
    })

    it('should handle malformed data gracefully', async () => {
      const malformedData = '{{invalid json}'
      
      const result = await neuralImport.detectEntitiesWithNeuralAnalysis(malformedData)
      
      expect(result).toBeDefined()
      expect(Array.isArray(result)).toBe(true)
      // Should attempt to extract what it can
    })

    it('should handle empty data gracefully', async () => {
      const emptyData = []
      
      const result = await neuralImport.detectEntitiesWithNeuralAnalysis(emptyData)
      
      expect(result).toBeDefined()
      expect(result).toEqual([])
    })

    it('should provide helpful error messages', async () => {
      const invalidPath = join(process.cwd(), 'test.unknown-extension')
      await writeFile(invalidPath, 'test data')
      
      const result = await neuralImport.neuralImport(invalidPath)
      
      expect(result.warning || result.error).toBeDefined()
      
      await unlink(invalidPath)
    })
  })

  describe('Integration with BrainyData', () => {
    it('should import and immediately query data', async () => {
      const csvData = `product,category,price
"Laptop",electronics,999
"Phone",electronics,699
"Desk",furniture,299`
      
      await writeFile(testDataPath, csvData)
      
      const importResult = await neuralImport.neuralImport(testDataPath)
      
      expect(importResult.entitiesDetected).toBeGreaterThan(0)
      
      // Should be able to search imported data
      const searchResults = await brain.search('electronics')
      
      expect(searchResults).toBeDefined()
      expect(searchResults.length).toBeGreaterThan(0)
    })

    it('should maintain relationships after import', async () => {
      const data = [
        { id: 'u1', name: 'User 1', type: 'user' },
        { id: 'p1', name: 'Project 1', type: 'project', owner: 'u1' }
      ]
      
      const entities = await neuralImport.detectEntitiesWithNeuralAnalysis(data)
      const relationships = await neuralImport.detectRelationships(entities)
      
      // Add to brain
      for (const entity of entities) {
        await brain.addNoun(entity.name, entity.type)
      }
      
      for (const rel of relationships) {
        if (rel.source && rel.target) {
          await brain.addVerb(rel.source, rel.target, rel.type)
        }
      }
      
      // Verify relationships exist
      const verbs = await brain.getVerbs()
      expect(verbs.length).toBeGreaterThan(0)
    })
  })
})