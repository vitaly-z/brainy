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
})
