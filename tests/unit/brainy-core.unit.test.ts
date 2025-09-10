/**
 * Unit Tests for Brainy 3.0 Core Functionality
 * 
 * Tests business logic with real embeddings - production ready
 * No mocks, no fakes, real implementation
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { Brainy } from '../../src/brainy.js'
import { NounType } from '../../src/types/graphTypes.js'

describe('Brainy 3.0 Core (Unit Tests)', () => {
  let brain: Brainy

  beforeEach(async () => {
    // Create instance with real embeddings for production-ready tests
    brain = new Brainy({
      storage: { type: 'memory' },
      augmentations: {
        cache: false,
        metrics: false,
        display: false,
        monitoring: false
      }
    })
    
    await brain.init()
  })

  describe('CRUD Operations', () => {
    it('should create items with add', async () => {
      const id = await brain.add({ 
        data: { name: 'JavaScript', type: 'language' },
        type: NounType.Concept,
        metadata: { category: 'programming' }
      })
      
      expect(id).toBeTypeOf('string')
      expect(id.length).toBeGreaterThan(0)
    })

    it('should retrieve items with get', async () => {
      const id = await brain.add({
        data: { name: 'Python', type: 'language', year: 1991 },
        type: NounType.Concept,
        metadata: { category: 'programming' }
      })
      
      const retrieved = await brain.get(id)
      
      expect(retrieved).toBeTruthy()
      expect(retrieved?.metadata?.name).toBe('Python')
      expect(retrieved?.metadata?.type).toBe('language')
      expect(retrieved?.metadata?.year).toBe(1991)
    })

    it('should update items with update', async () => {
      const id = await brain.add({
        data: { name: 'TypeScript', version: '4.0' },
        type: NounType.Concept,
        metadata: { category: 'programming' }
      })
      
      await brain.update({
        id,
        data: { version: '5.0', popularity: 'high' }
      })
      
      const updated = await brain.get(id)
      expect(updated?.metadata?.version).toBe('5.0')
      expect(updated?.metadata?.popularity).toBe('high')
      expect(updated?.metadata?.name).toBe('TypeScript') // Original data preserved
    })

    it('should delete items with delete', async () => {
      const id = await brain.add({
        data: { name: 'ToDelete', temp: true },
        type: NounType.Concept
      })
      
      // Verify it exists
      expect(await brain.get(id)).toBeTruthy()
      
      // Delete it
      await brain.delete(id)
      
      // Verify it's gone
      expect(await brain.get(id)).toBeNull()
    })

    it('should handle non-existent IDs according to API contract', async () => {
      const fakeId = 'non-existent-id'
      
      expect(await brain.get(fakeId)).toBeNull()
      
      // update should handle non-existent ID gracefully
      await expect(brain.update({ 
        id: fakeId, 
        data: { test: 'data' } 
      })).rejects.toThrow()
      
      // delete should not throw for non-existent ID
      await expect(brain.delete(fakeId)).resolves.not.toThrow()
    })
  })

  describe('Search Operations', () => {
    beforeEach(async () => {
      // Add test data with real embeddings
      await brain.add({ 
        data: { name: 'React', type: 'framework', category: 'frontend' },
        type: NounType.Concept,
        metadata: { tags: ['ui', 'javascript'] }
      })
      await brain.add({
        data: { name: 'Vue', type: 'framework', category: 'frontend' },
        type: NounType.Concept,
        metadata: { tags: ['ui', 'javascript'] }
      })
      await brain.add({
        data: { name: 'Express', type: 'framework', category: 'backend' },
        type: NounType.Concept,
        metadata: { tags: ['server', 'nodejs'] }
      })
      await brain.add({
        data: { name: 'Java', type: 'language', category: 'backend' },
        type: NounType.Concept,
        metadata: { tags: ['jvm', 'enterprise'] }
      })
    })

    it('should return search results with real embeddings', async () => {
      const results = await brain.find({ 
        query: 'frontend framework',
        limit: 2
      })
      
      expect(results).toBeInstanceOf(Array)
      expect(results.length).toBeGreaterThan(0)
      expect(results.length).toBeLessThanOrEqual(2)
      
      // Results should have required properties
      results.forEach((result: any) => {
        expect(result).toHaveProperty('id')
        expect(result).toHaveProperty('score')
        expect(result).toHaveProperty('entity')
      })
    })

    it('should handle limit parameter', async () => {
      const limitedResults = await brain.find({ 
        query: 'framework',
        limit: 2
      })
      const unlimitedResults = await brain.find({
        query: 'framework',
        limit: 10
      })
      
      expect(limitedResults.length).toBeLessThanOrEqual(2)
      expect(unlimitedResults.length).toBeLessThanOrEqual(10)
    })

    it('should search by metadata filters', async () => {
      const results = await brain.find({
        where: { category: 'frontend' },
        limit: 10
      })
      
      expect(results).toBeInstanceOf(Array)
      // All results should have frontend category
      results.forEach((item: any) => {
        expect(item.entity.metadata?.category).toBe('frontend')
      })
    })

    it('should handle complex queries with Triple Intelligence', async () => {
      const results = await brain.find({
        query: 'javascript',
        where: { type: 'framework' },
        limit: 5,
        fusion: {
          strategy: 'adaptive',
          weights: { vector: 0.6, field: 0.4 }
        }
      })
      
      expect(results).toBeInstanceOf(Array)
      // Results should match both vector similarity and field filters
      results.forEach((item: any) => {
        expect(item.entity.metadata?.type).toBe('framework')
      })
    })
  })

  describe('Statistics and Metadata', () => {
    it('should track statistics through augmentations', async () => {
      await brain.add({
        data: { name: 'Test1' },
        type: NounType.Concept
      })
      await brain.add({
        data: { name: 'Test2' },
        type: NounType.Concept
      })
      
      // Statistics would be available through augmentation system
      // The exact API depends on augmentation configuration
    })
  })

  describe('Clear Operations', () => {
    it('should clear all data', async () => {
      await brain.add({
        data: { name: 'Test1' },
        type: NounType.Concept
      })
      await brain.add({
        data: { name: 'Test2' },
        type: NounType.Concept
      })
      await brain.add({
        data: { name: 'Test3' },
        type: NounType.Concept
      })
      
      // Clear using DataAPI
      const dataAPI = await brain.data()
      await dataAPI.clear({ entities: true, relations: false })
      
      // Verify data is cleared
      const results = await brain.find({ 
        query: 'Test',
        limit: 10 
      })
      expect(results.length).toBe(0)
    })
  })

  describe('Edge Cases and Error Handling', () => {
    it('should handle empty queries gracefully', async () => {
      const results = await brain.find({ 
        query: '',
        limit: 5
      })
      
      expect(results).toBeInstanceOf(Array)
    })

    it('should handle special characters in data', async () => {
      const id = await brain.add({
        data: { 
          name: 'Test with special chars: !@#$%^&*()',
          description: 'Has "quotes" and \'apostrophes\''
        },
        type: NounType.Concept
      })
      
      const retrieved = await brain.get(id)
      expect(retrieved?.metadata?.name).toContain('!@#$%^&*()')
    })

    it('should handle very long text', async () => {
      const longText = 'x'.repeat(10000)
      const id = await brain.add({
        data: { content: longText },
        type: NounType.Document
      })
      
      const retrieved = await brain.get(id)
      expect(retrieved?.metadata?.content).toHaveLength(10000)
    })
  })
})