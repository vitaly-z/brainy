/**
 * Enhanced Clear Operations Test Suite
 * Tests safety mechanisms, performance optimizations, and comprehensive deletion
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { BrainyData } from '../src/brainyData.js'
import { NounType, VerbType } from '../src/types/graphTypes.js'
import { ClearOptions, ClearResult } from '../src/storage/enhancedClearOperations.js'
import { tmpdir } from 'os'
import { join } from 'path'
import { mkdtemp, rm } from 'fs/promises'

describe('Enhanced Clear Operations', () => {
  let brainy: BrainyData
  let tempDir: string
  let instanceName: string

  beforeEach(async () => {
    // Create a unique temporary directory for each test
    tempDir = await mkdtemp(join(tmpdir(), 'brainy-clear-test-'))
    instanceName = tempDir.split('/').pop() || 'test-instance'
    
    brainy = new BrainyData({
      storage: {
        type: 'filesystem',
        path: tempDir
      },
      augmentations: [] // Disable augmentations for clear testing
    })
    
    await brainy.init()
  })

  afterEach(async () => {
    try {
      // BrainyData doesn't have a close method, just clean up the temp directory
      await rm(tempDir, { recursive: true, force: true })
    } catch (error) {
      console.warn('Cleanup failed:', error)
    }
  })

  describe('Basic Clear Functionality', () => {
    it('should clear empty database successfully', async () => {
      const result = await brainy.clearEnhanced({ dryRun: true })
      
      expect(result.success).toBe(true)
      expect(result.itemsDeleted.nouns).toBe(0)
      expect(result.itemsDeleted.verbs).toBe(0)
      expect(result.itemsDeleted.metadata).toBe(0)
      expect(result.itemsDeleted.system).toBe(0)
      expect(result.errors).toHaveLength(0)
    })

    it('should perform dry run without actual deletion', async () => {
      // Add some test data
      const nounId = await brainy.addNoun('Test data for dry run', NounType.Content)
      
      // Perform dry run
      const dryResult = await brainy.clearEnhanced({ dryRun: true })
      
      expect(dryResult.success).toBe(true)
      expect(dryResult.itemsDeleted.nouns).toBeGreaterThan(0)
      
      // Verify data still exists
      const searchResults = await brainy.search('Test data')
      expect(searchResults.length).toBeGreaterThan(0)
    })

    it('should actually delete data when not in dry run mode', async () => {
      // Add some test data
      await brainy.addNoun('Test data for actual deletion', NounType.Content)
      
      // Verify data exists
      let searchResults = await brainy.search('Test data')
      expect(searchResults.length).toBeGreaterThan(0)
      
      // Perform actual clear
      const clearResult = await brainy.clearEnhanced()
      
      expect(clearResult.success).toBe(true)
      expect(clearResult.itemsDeleted.nouns).toBeGreaterThan(0)
      
      // Verify data is gone
      searchResults = await brainy.search('Test data')
      expect(searchResults.length).toBe(0)
    })
  })

  describe('Safety Mechanisms', () => {
    it('should reject clear with wrong instance name', async () => {
      const result = await brainy.clearEnhanced({ 
        confirmInstanceName: 'wrong-instance-name' 
      })
      
      expect(result.success).toBe(false)
      expect(result.errors.length).toBeGreaterThan(0)
      expect(result.errors[0].message).toMatch(/Instance name mismatch/)
    })

    it.skip('should accept clear with correct instance name', async () => {
      // TODO: Implement proper instance name feature
      // Add some test data
      await brainy.addNoun('Test data', NounType.Content)
      
      const result = await brainy.clearEnhanced({ 
        confirmInstanceName: instanceName
      })
      
      expect(result.success).toBe(true)
    })

    it('should handle backup creation gracefully', async () => {
      // Add some test data first
      await brainy.addNoun('Test data for backup', NounType.Content)
      
      const result = await brainy.clearEnhanced({ 
        createBackup: true
      })
      
      expect(result.success).toBe(true)
      expect(result.backupLocation).toBeDefined()
      expect(result.backupLocation).toContain('backup')
    })
  })

  describe('Performance and Batching', () => {
    it('should handle custom batch sizes', async () => {
      // Add multiple items
      const promises = []
      for (let i = 0; i < 20; i++) {
        promises.push(brainy.addNoun(`Test item ${i}`, NounType.Content))
      }
      await Promise.all(promises)
      
      // Clear with small batch size
      const result = await brainy.clearEnhanced({ 
        batchSize: 5,
        maxConcurrency: 2
      })
      
      expect(result.success).toBe(true)
      expect(result.itemsDeleted.nouns).toBe(20)
    })

    it('should report progress during operation', async () => {
      // Add multiple items
      const promises = []
      for (let i = 0; i < 10; i++) {
        promises.push(brainy.addNoun(`Progress test item ${i}`, NounType.Content))
      }
      await Promise.all(promises)
      
      const progressUpdates: any[] = []
      
      const result = await brainy.clearEnhanced({
        onProgress: (progress) => {
          progressUpdates.push({ ...progress })
        }
      })
      
      expect(result.success).toBe(true)
      expect(progressUpdates.length).toBeGreaterThan(0)
      
      // Check that we got progress for different stages
      const stages = progressUpdates.map(p => p.stage)
      expect(stages).toContain('nouns')
    })
  })

  describe('Comprehensive Data Deletion', () => {
    it('should delete all types of data', async () => {
      // Add nouns of different types
      const personId = await brainy.addNoun('John Doe', NounType.Person)
      const conceptId = await brainy.addNoun('Artificial Intelligence', NounType.Concept)
      
      // Add a verb relationship
      await brainy.addVerb(personId, conceptId, VerbType.RelatedTo, { expertise: 'high' })
      
      // Verify data exists
      let searchResults = await brainy.search('John')
      expect(searchResults.length).toBeGreaterThan(0)
      
      // Perform comprehensive clear
      const result = await brainy.clearEnhanced()
      
      expect(result.success).toBe(true)
      expect(result.itemsDeleted.nouns).toBeGreaterThanOrEqual(2)
      expect(result.itemsDeleted.verbs).toBeGreaterThanOrEqual(1)
      
      // Verify all data is gone
      searchResults = await brainy.search('John')
      expect(searchResults.length).toBe(0)
      
      searchResults = await brainy.search('Artificial')
      expect(searchResults.length).toBe(0)
    })

    it('should preserve database functionality after clear', async () => {
      // Add and clear data
      await brainy.addNoun('Test before clear', NounType.Content)
      await brainy.clearEnhanced()
      
      // Add new data after clear
      const newId = await brainy.addNoun('Test after clear', NounType.Content)
      expect(newId).toBeDefined()
      
      // Verify new data is searchable
      const searchResults = await brainy.search('Test after clear')
      expect(searchResults.length).toBeGreaterThan(0)
    })
  })

  describe('Error Handling', () => {
    it('should handle missing storage adapter gracefully', async () => {
      // Create brainy with memory storage (doesn't support enhanced clear)
      const memoryBrainy = new BrainyData({
        storage: { type: 'memory' }
      })
      
      await memoryBrainy.init()
      
      await expect(
        memoryBrainy.clearEnhanced()
      ).rejects.toThrow(/Enhanced clear operation not supported/)
    })

    it('should collect and report errors during operation', async () => {
      // This test would need to mock filesystem errors
      // For now, just verify error structure
      const result = await brainy.clearEnhanced({ dryRun: true })
      
      expect(result.errors).toBeDefined()
      expect(Array.isArray(result.errors)).toBe(true)
    })
  })

  describe('Timing and Performance Metrics', () => {
    it.skip('should track operation duration - skipped, clearEnhanced being deprecated', async () => {
      await brainy.addNoun('Timing test', NounType.Content)
      
      const result = await brainy.clearEnhanced()
      
      expect(result.duration).toBeGreaterThan(0)
      expect(typeof result.duration).toBe('number')
    })

    it('should provide detailed deletion counts', async () => {
      // Add various types of data
      await brainy.addNoun('Person', NounType.Person)
      await brainy.addNoun('Organization', NounType.Organization)
      const id1 = await brainy.addNoun('Source', NounType.Content)
      const id2 = await brainy.addNoun('Target', NounType.Content)
      await brainy.addVerb(id1, id2, VerbType.RelatedTo)
      
      const result = await brainy.clearEnhanced()
      
      expect(result.success).toBe(true)
      expect(result.itemsDeleted.nouns).toBeGreaterThanOrEqual(4)
      expect(result.itemsDeleted.verbs).toBeGreaterThanOrEqual(1)
      expect(typeof result.itemsDeleted.metadata).toBe('number')
      expect(typeof result.itemsDeleted.system).toBe('number')
    })
  })
})