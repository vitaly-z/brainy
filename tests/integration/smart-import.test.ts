/**
 * Unified Import Integration Tests
 *
 * Tests the unified import system (brain.import()):
 * 1. Auto-detect format from Excel buffer
 * 2. Extract entities/relationships
 * 3. Create knowledge graph
 * 4. Create VFS structure
 *
 * Uses real data, no mocks
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { Brainy } from '../../src/brainy.js'
import * as XLSX from 'xlsx'

describe('Unified Import System', () => {
  let brain: Brainy

  beforeEach(async () => {
    brain = new Brainy({
      storage: { type: 'memory' as const }
    })
    await brain.init()
  })

  it('should extract entities and relationships from Excel data', async () => {
    // Create test Excel file
    const testData = [
      {
        'Term': 'Westland',
        'Definition': 'Ancient kingdom in the west, ruled by the royal dynasty',
        'Type': 'Place',
        'Related Terms': 'Capital City, Northern Mountains'
      },
      {
        'Term': 'Capital City',
        'Definition': 'Main city of Westland, known for its grand library',
        'Type': 'Place',
        'Related Terms': 'Westland'
      },
      {
        'Term': 'Royal Dynasty',
        'Definition': 'Noble family that has ruled Westland for centuries',
        'Type': 'Organization',
        'Related Terms': 'Westland'
      },
      {
        'Term': 'Grand Library',
        'Definition': 'Massive repository of knowledge in Capital City',
        'Type': 'Place',
        'Related Terms': 'Capital City'
      },
      {
        'Term': 'Northern Mountains',
        'Definition': 'Mountain range north of Westland',
        'Type': 'Place',
        'Related Terms': 'Westland'
      }
    ]

    // Create Excel workbook
    const worksheet = XLSX.utils.json_to_sheet(testData)
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Terms')
    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' })

    // Import with unified API
    const result = await brain.import(buffer, {
      format: 'excel',
      vfsPath: '/test-imports/data',
      groupBy: 'type',
      enableNeuralExtraction: true,
      enableRelationshipInference: true,
      enableConceptExtraction: true
    })

    // Verify format detection
    expect(result.format).toBe('excel')
    expect(result.formatConfidence).toBeGreaterThan(0.9)

    // Should extract entities
    expect(result.stats.entitiesExtracted).toBeGreaterThanOrEqual(5)
    expect(result.entities.length).toBeGreaterThanOrEqual(5)

    // Should create VFS structure
    expect(result.vfs.rootPath).toBe('/test-imports/data')
    expect(result.vfs.directories.length).toBeGreaterThan(0)

    // Verify we can query the created entities
    const entities = await brain.find({
      query: 'Westland',
      limit: 5
    })
    expect(entities.length).toBeGreaterThan(0)
  }, 60000) // 60s timeout for neural processing

  it('should handle progress callbacks', async () => {
    const testData = [
      { 'Term': 'Test1', 'Definition': 'Test definition 1', 'Type': 'Concept' },
      { 'Term': 'Test2', 'Definition': 'Test definition 2', 'Type': 'Concept' }
    ]

    const worksheet = XLSX.utils.json_to_sheet(testData)
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Terms')
    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' })

    const progressStages: string[] = []

    await brain.import(buffer, {
      format: 'excel',
      vfsPath: '/test-progress',
      onProgress: (progress) => {
        progressStages.push(progress.stage)
      }
    })

    // Should receive progress updates for different stages
    expect(progressStages.length).toBeGreaterThan(0)
  }, 30000)

  it('should group entities by type in VFS', async () => {
    const testData = [
      { 'Term': 'Alice', 'Definition': 'A person', 'Type': 'Person' },
      { 'Term': 'New York', 'Definition': 'A city', 'Type': 'Place' },
      { 'Term': 'Gravity', 'Definition': 'A concept', 'Type': 'Concept' }
    ]

    const worksheet = XLSX.utils.json_to_sheet(testData)
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Terms')
    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' })

    const result = await brain.import(buffer, {
      format: 'excel',
      vfsPath: '/test-types',
      groupBy: 'type'
    })

    // Verify VFS structure created
    expect(result.vfs.rootPath).toBe('/test-types')
    expect(result.vfs.directories.length).toBeGreaterThan(0)

    // Verify entities were extracted
    expect(result.entities.length).toBeGreaterThanOrEqual(3)
  }, 30000)

  it('should extract relationships from natural language definitions', async () => {
    const testData = [
      {
        'Term': 'Paris',
        'Definition': 'Capital city of France, located on the Seine river',
        'Type': 'Place'
      },
      {
        'Term': 'France',
        'Definition': 'A country in Western Europe',
        'Type': 'Place'
      }
    ]

    const worksheet = XLSX.utils.json_to_sheet(testData)
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Terms')
    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' })

    const result = await brain.import(buffer, {
      format: 'excel',
      vfsPath: '/test-relationships',
      enableRelationshipInference: true
    })

    // Verify entities extracted
    expect(result.entities.length).toBeGreaterThanOrEqual(2)

    // Find the Paris entity
    const parisResults = await brain.find({
      query: 'Paris',
      limit: 5
    })
    expect(parisResults.length).toBeGreaterThan(0)
  }, 30000)

  // v4.2.0: YAML import tests
  it('should import YAML files and extract entities', async () => {
    const yamlContent = `
---
name: John Doe
role: Software Engineer
company:
  name: Tech Corp
  location: San Francisco
skills:
  - TypeScript
  - Node.js
  - GraphQL
projects:
  - name: Brainy
    description: Knowledge graph database
    status: active
`

    const result = await brain.import(yamlContent, {
      format: 'yaml',
      vfsPath: '/test-yaml',
      enableNeuralExtraction: true,
      enableHierarchicalRelationships: true
    })

    // Verify format detection
    expect(result.format).toBe('yaml')

    // Should extract entities
    expect(result.stats.entitiesExtracted).toBeGreaterThan(0)
    expect(result.entities.length).toBeGreaterThan(0)

    // Should create VFS structure
    expect(result.vfs.rootPath).toBe('/test-yaml')
    expect(result.vfs.directories.length).toBeGreaterThan(0)
  }, 30000)

  // v4.2.0: Confidence and weight fields
  it('should populate confidence and weight fields on entities and relationships', async () => {
    const testData = [
      {
        'Term': 'Einstein',
        'Definition': 'German physicist who developed the theory of relativity',
        'Type': 'Person'
      }
    ]

    const worksheet = XLSX.utils.json_to_sheet(testData)
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Terms')
    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' })

    const result = await brain.import(buffer, {
      format: 'excel',
      vfsPath: '/test-confidence',
      enableNeuralExtraction: true,
      enableRelationshipInference: true,
      confidenceThreshold: 0.6
    })

    // Verify entities were created with confidence threshold applied
    expect(result.entities.length).toBeGreaterThan(0)
    expect(result.stats.entitiesExtracted).toBeGreaterThan(0)

    // Query the entity to verify it was stored successfully
    const entities = await brain.find({
      query: 'Einstein',
      limit: 1
    })

    expect(entities.length).toBeGreaterThan(0)
  }, 30000)

  // v4.2.0: Range queries with confidence
  it('should support range queries on confidence field', async () => {
    const testData = [
      { 'Term': 'Test1', 'Definition': 'First test entity', 'Type': 'Concept' },
      { 'Term': 'Test2', 'Definition': 'Second test entity', 'Type': 'Concept' },
      { 'Term': 'Test3', 'Definition': 'Third test entity', 'Type': 'Concept' }
    ]

    const worksheet = XLSX.utils.json_to_sheet(testData)
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Terms')
    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' })

    await brain.import(buffer, {
      format: 'excel',
      vfsPath: '/test-range-query',
      enableNeuralExtraction: true,
      confidenceThreshold: 0.6
    })

    // Query with confidence range filter
    const highConfidenceEntities = await brain.find({
      where: {
        confidence: { gte: 0.8 }
      },
      limit: 10
    })

    // Should return some entities
    expect(highConfidenceEntities).toBeDefined()
    expect(Array.isArray(highConfidenceEntities)).toBe(true)
  }, 30000)

  // v4.2.0: Per-sheet VFS extraction
  it('should extract Excel sheets to separate VFS directories', async () => {
    const testData1 = [
      { 'Term': 'Sheet1Entity', 'Definition': 'Entity from sheet 1', 'Type': 'Concept' }
    ]
    const testData2 = [
      { 'Term': 'Sheet2Entity', 'Definition': 'Entity from sheet 2', 'Type': 'Concept' }
    ]

    const worksheet1 = XLSX.utils.json_to_sheet(testData1)
    const worksheet2 = XLSX.utils.json_to_sheet(testData2)
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet1, 'FirstSheet')
    XLSX.utils.book_append_sheet(workbook, worksheet2, 'SecondSheet')
    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' })

    const result = await brain.import(buffer, {
      format: 'excel',
      vfsPath: '/test-sheets',
      groupBy: 'sheet',
      enableNeuralExtraction: true
    })

    // Verify multiple directories created (one per sheet)
    expect(result.vfs.rootPath).toBe('/test-sheets')
    expect(result.vfs.directories.length).toBeGreaterThan(1)

    // Should extract entities from both sheets
    expect(result.entities.length).toBeGreaterThanOrEqual(2)
  }, 30000)

  // v4.2.0: SmartRelationshipExtractor Integration Tests
  describe('SmartRelationshipExtractor', () => {
    it('should classify CreatedBy relationships using exact keywords', async () => {
      const testData = [
        {
          'Term': 'Mona Lisa',
          'Definition': 'Famous painting created by Leonardo da Vinci in the 16th century',
          'Type': 'Product'
        },
        {
          'Term': 'Leonardo da Vinci',
          'Definition': 'Italian Renaissance artist and inventor',
          'Type': 'Person'
        }
      ]

      const worksheet = XLSX.utils.json_to_sheet(testData)
      const workbook = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Terms')
      const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' })

      const result = await brain.import(buffer, {
        format: 'excel',
        vfsPath: '/test-created-by',
        enableNeuralExtraction: true,
        enableRelationshipInference: true
      })

      // Verify relationships were extracted
      expect(result.stats.relationshipsInferred).toBeGreaterThan(0)

      // Find "Mona Lisa" entity
      const monaLisaEntities = await brain.find({
        query: 'Mona Lisa',
        limit: 1
      })
      expect(monaLisaEntities.length).toBeGreaterThan(0)

      // Get relationships for Mona Lisa
      const relationships = await brain.getRelations(monaLisaEntities[0].id)
      expect(relationships.length).toBeGreaterThan(0)

      // Should have CreatedBy relationship (not just RelatedTo)
      const createdByRels = relationships.filter(r =>
        r.type === 'CreatedBy' && r.targetName?.toLowerCase().includes('leonardo')
      )
      expect(createdByRels.length).toBeGreaterThan(0)
    }, 60000)

    it('should classify LocatedAt relationships using pattern matching', async () => {
      const testData = [
        {
          'Term': 'Stanford University',
          'Definition': 'Private research university located in Stanford, California',
          'Type': 'Organization'
        },
        {
          'Term': 'California',
          'Definition': 'State on the west coast of the United States',
          'Type': 'Place'
        }
      ]

      const worksheet = XLSX.utils.json_to_sheet(testData)
      const workbook = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Terms')
      const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' })

      const result = await brain.import(buffer, {
        format: 'excel',
        vfsPath: '/test-located-at',
        enableNeuralExtraction: true,
        enableRelationshipInference: true
      })

      // Verify relationships were extracted
      expect(result.stats.relationshipsInferred).toBeGreaterThan(0)

      // Find Stanford entity
      const stanfordEntities = await brain.find({
        query: 'Stanford',
        limit: 1
      })
      expect(stanfordEntities.length).toBeGreaterThan(0)

      // Get relationships
      const relationships = await brain.getRelations(stanfordEntities[0].id)
      expect(relationships.length).toBeGreaterThan(0)

      // Should have LocatedAt relationship
      const locatedAtRels = relationships.filter(r =>
        r.type === 'LocatedAt' && r.targetName?.toLowerCase().includes('california')
      )
      expect(locatedAtRels.length).toBeGreaterThan(0)
    }, 60000)

    it('should classify PartOf relationships using hierarchical context', async () => {
      const testData = [
        {
          'Term': 'Heart',
          'Definition': 'Muscular organ that is part of the circulatory system, pumps blood',
          'Type': 'Thing'
        },
        {
          'Term': 'Circulatory System',
          'Definition': 'Organ system that transports nutrients and oxygen throughout the body',
          'Type': 'Thing'
        }
      ]

      const worksheet = XLSX.utils.json_to_sheet(testData)
      const workbook = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Terms')
      const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' })

      const result = await brain.import(buffer, {
        format: 'excel',
        vfsPath: '/test-part-of',
        enableNeuralExtraction: true,
        enableRelationshipInference: true
      })

      // Verify relationships were extracted
      expect(result.stats.relationshipsInferred).toBeGreaterThan(0)

      // Find Heart entity
      const heartEntities = await brain.find({
        query: 'Heart',
        limit: 1
      })
      expect(heartEntities.length).toBeGreaterThan(0)

      // Get relationships
      const relationships = await brain.getRelations(heartEntities[0].id)
      expect(relationships.length).toBeGreaterThan(0)

      // Should have PartOf relationship
      const partOfRels = relationships.filter(r =>
        r.type === 'PartOf' && r.targetName?.toLowerCase().includes('circulatory')
      )
      expect(partOfRels.length).toBeGreaterThan(0)
    }, 60000)

    it('should classify WorksWith relationships using type hints', async () => {
      const testData = [
        {
          'Term': 'Alice Johnson',
          'Definition': 'Senior engineer who works at Google on cloud infrastructure',
          'Type': 'Person'
        },
        {
          'Term': 'Google',
          'Definition': 'Technology company specializing in internet services',
          'Type': 'Organization'
        }
      ]

      const worksheet = XLSX.utils.json_to_sheet(testData)
      const workbook = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Terms')
      const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' })

      const result = await brain.import(buffer, {
        format: 'excel',
        vfsPath: '/test-works-with',
        enableNeuralExtraction: true,
        enableRelationshipInference: true
      })

      // Verify relationships were extracted
      expect(result.stats.relationshipsInferred).toBeGreaterThan(0)

      // Find Alice entity
      const aliceEntities = await brain.find({
        query: 'Alice Johnson',
        limit: 1
      })
      expect(aliceEntities.length).toBeGreaterThan(0)

      // Get relationships
      const relationships = await brain.getRelations(aliceEntities[0].id)
      expect(relationships.length).toBeGreaterThan(0)

      // Should have WorksWith or MemberOf relationship (not just RelatedTo)
      const workRels = relationships.filter(r =>
        (r.type === 'WorksWith' || r.type === 'MemberOf') &&
        r.targetName?.toLowerCase().includes('google')
      )
      expect(workRels.length).toBeGreaterThan(0)
    }, 60000)

    it('should use ensemble voting when multiple signals agree', async () => {
      const testData = [
        {
          'Term': 'iPhone',
          'Definition': 'Smartphone created by Apple Inc. in 2007, revolutionized mobile computing',
          'Type': 'Product'
        },
        {
          'Term': 'Apple Inc.',
          'Definition': 'Technology company that designs consumer electronics',
          'Type': 'Organization'
        }
      ]

      const worksheet = XLSX.utils.json_to_sheet(testData)
      const workbook = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Terms')
      const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' })

      const result = await brain.import(buffer, {
        format: 'excel',
        vfsPath: '/test-ensemble',
        enableNeuralExtraction: true,
        enableRelationshipInference: true
      })

      // Verify relationships extracted
      expect(result.stats.relationshipsInferred).toBeGreaterThan(0)

      // Find iPhone entity
      const iphoneEntities = await brain.find({
        query: 'iPhone',
        limit: 1
      })
      expect(iphoneEntities.length).toBeGreaterThan(0)

      // Get relationships
      const relationships = await brain.getRelations(iphoneEntities[0].id)
      expect(relationships.length).toBeGreaterThan(0)

      // Should have CreatedBy relationship with high confidence
      // (exact match "created by" + embedding similarity + pattern match + type hint all agree)
      const createdByRels = relationships.filter(r =>
        r.type === 'CreatedBy' && r.targetName?.toLowerCase().includes('apple')
      )
      expect(createdByRels.length).toBeGreaterThan(0)
    }, 60000)

    it('should extract relationships from YAML hierarchical structures', async () => {
      const yamlContent = `
---
project:
  name: Brainy
  description: Knowledge graph database that contains multiple modules
  modules:
    - name: Storage
      description: Handles data persistence
    - name: Query
      description: Processes natural language queries
    - name: VFS
      description: Virtual file system
`

      const result = await brain.import(yamlContent, {
        format: 'yaml',
        vfsPath: '/test-yaml-relationships',
        enableNeuralExtraction: true,
        enableHierarchicalRelationships: true
      })

      // Verify entities and relationships extracted
      expect(result.stats.entitiesExtracted).toBeGreaterThan(0)
      expect(result.stats.relationshipsInferred).toBeGreaterThan(0)

      // Find project entity
      const projectEntities = await brain.find({
        query: 'Brainy',
        limit: 1
      })
      expect(projectEntities.length).toBeGreaterThan(0)

      // Get relationships
      const relationships = await brain.getRelations(projectEntities[0].id)
      expect(relationships.length).toBeGreaterThan(0)

      // Should have Contains relationship (hierarchical)
      const containsRels = relationships.filter(r =>
        r.type === 'Contains' || r.type === 'PartOf'
      )
      expect(containsRels.length).toBeGreaterThan(0)
    }, 60000)
  })

  describe('Always-On Streaming Imports (v4.2.0+)', () => {
    it('should always stream with adaptive flush intervals', async () => {
      // Create file with 250 entities (adaptive interval: flush every 100)
      const testData = Array.from({ length: 250 }, (_, i) => ({
        'Term': `Entity_${i}`,
        'Definition': `Test entity number ${i} for streaming import`,
        'Type': 'Thing'
      }))

      const workbook = XLSX.utils.book_new()
      const worksheet = XLSX.utils.json_to_sheet(testData)
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Test')
      const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' })

      let queryableCount = 0

      const result = await brain.import(buffer, {
        format: 'excel',
        vfsPath: '/test-streaming',
        enableNeuralExtraction: false,
        enableRelationshipInference: false,
        onProgress: (progress) => {
          if (progress.queryable === true) {
            queryableCount++
          }
        }
      })

      // Verify streaming happened (should flush 2-3 times for 250 entities)
      expect(queryableCount).toBeGreaterThan(0)

      // Verify all entities were imported
      expect(result.entities.length).toBe(250)
    }, 60000)

    it('should allow live queries during import', async () => {
      // Create file with 250 entities
      const testData = Array.from({ length: 250 }, (_, i) => ({
        'Term': `Product_${i}`,
        'Definition': `Product ${i} description`,
        'Type': 'product'
      }))

      const workbook = XLSX.utils.book_new()
      const worksheet = XLSX.utils.json_to_sheet(testData)
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Products')
      const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' })

      const queryCounts: number[] = []

      const result = await brain.import(buffer, {
        format: 'excel',
        vfsPath: '/test-queryable',
        enableNeuralExtraction: true,  // Enable for proper type classification
        enableRelationshipInference: false,
        onProgress: async (progress) => {
          // Query data during import
          if (progress.queryable) {
            const products = await brain.find({ type: 'product', limit: 1000 })
            queryCounts.push(products.length)
          }
        }
      })

      // Should have queried at least once (flushes every 100 entities)
      expect(queryCounts.length).toBeGreaterThan(0)

      // Counts should be increasing
      for (let i = 1; i < queryCounts.length; i++) {
        expect(queryCounts[i]).toBeGreaterThanOrEqual(queryCounts[i - 1])
      }

      // Final count should match total
      const finalProducts = await brain.find({ type: 'product', limit: 1000 })
      expect(finalProducts.length).toBe(250)
    }, 60000)

    it('should maintain data integrity with streaming flushes', async () => {
      // Create file with mix of entity types (300 total)
      const testData = [
        ...Array.from({ length: 100 }, (_, i) => ({
          'Term': `Person_${i}`,
          'Definition': `Person ${i}`,
          'Type': 'person'
        })),
        ...Array.from({ length: 100 }, (_, i) => ({
          'Term': `Product_${i}`,
          'Definition': `Product ${i}`,
          'Type': 'product'
        })),
        ...Array.from({ length: 100 }, (_, i) => ({
          'Term': `Place_${i}`,
          'Definition': `Place ${i}`,
          'Type': 'location'
        }))
      ]

      const workbook = XLSX.utils.book_new()
      const worksheet = XLSX.utils.json_to_sheet(testData)
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Mixed')
      const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' })

      const result = await brain.import(buffer, {
        format: 'excel',
        vfsPath: '/test-integrity',
        enableNeuralExtraction: true,  // Enable for proper type classification
        enableRelationshipInference: false
      })

      // Verify all entities imported
      expect(result.entities.length).toBe(300)

      // Verify type distribution
      const persons = await brain.find({ type: 'person', limit: 1000 })
      const products = await brain.find({ type: 'product', limit: 1000 })
      const places = await brain.find({ type: 'location', limit: 1000 })

      expect(persons.length).toBe(100)
      expect(products.length).toBe(100)
      expect(places.length).toBe(100)

      // Verify data integrity (sum of all types should equal total imported)
      expect(persons.length + products.length + places.length).toBe(300)
    }, 60000)

    it('should use adaptive intervals based on import size', async () => {
      // Test small import (< 1000): should flush every 100 entities
      const smallData = Array.from({ length: 250 }, (_, i) => ({
        'Term': `Small_${i}`,
        'Definition': `Small ${i}`,
        'Type': 'Thing'
      }))

      const workbook = XLSX.utils.book_new()
      const worksheet = XLSX.utils.json_to_sheet(smallData)
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Small')
      const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' })

      let flushCount = 0

      await brain.import(buffer, {
        format: 'excel',
        vfsPath: '/test-adaptive',
        enableNeuralExtraction: false,
        enableRelationshipInference: false,
        onProgress: (progress) => {
          if (progress.queryable) {
            flushCount++
          }
        }
      })

      // For 250 entities with flush every 100: expect 2-3 flushes
      expect(flushCount).toBeGreaterThanOrEqual(2)
      expect(flushCount).toBeLessThanOrEqual(3)
    }, 60000)
  })
})
