import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { BrainyData, VerbType } from '../src/index.js'
import { NeuralAPI } from '../src/neural/neuralAPI.js'

describe('🚀 Release Critical - All Core Features', () => {
  let db: BrainyData | null = null
  
  const createTestVector = (seed: number = 0) => {
    return new Array(384).fill(0).map((_, i) => Math.sin(i + seed) * 0.5)
  }
  
  afterEach(async () => {
    if (db) {
      await db.cleanup?.()
      db = null
    }
    
    if (global.gc) {
      global.gc()
    }
  })
  
  describe('🔴 CRITICAL: Core CRUD Must Work', () => {
    beforeEach(async () => {
      db = new BrainyData()
      await db.init()
    })
    
    it('CRITICAL: Zero-config initialization', async () => {
      // Should work with no configuration
      const brain = new BrainyData()
      await brain.init()
      
      // Should be able to add data immediately
      const id = await brain.addNoun(createTestVector(1), { id: 'test', data: 'Zero config test' })
      expect(id).toBeDefined()
      
      // Should be able to retrieve it
      const result = await brain.getNoun(id)
      expect(result?.metadata?.data).toBe('Zero config test')
      
      await brain.cleanup?.()
    })
    
    it('CRITICAL: Add/Get/Search pipeline', async () => {
      // Add test data
      const id1 = await db!.addNoun(createTestVector(1), { id: 'item1', category: 'tech' })
      const id2 = await db!.addNoun(createTestVector(2), { id: 'item2', category: 'food' })
      const id3 = await db!.addNoun(createTestVector(3), { id: 'item3', category: 'tech' })
      
      expect(id1).toBeDefined()
      expect(id2).toBeDefined()
      expect(id3).toBeDefined()
      
      // Get individual items
      const item1 = await db!.get(id1)
      expect(item1?.metadata?.category).toBe('tech')
      
      // Search functionality
      const results = await db!.search(createTestVector(1.1), 2)
      expect(results.length).toBeGreaterThan(0)
      expect(results.length).toBeLessThanOrEqual(2)
    })
    
    it('CRITICAL: 384-dimension vectors enforced', async () => {
      // Should work with 384 dimensions
      const validVector = new Array(384).fill(0.5)
      const id = await db!.add(validVector, { id: 'valid' })
      expect(id).toBeDefined()
      
      // Should reject wrong dimensions
      const invalidVector = new Array(256).fill(0.5)
      await expect(
        db!.add(invalidVector, { id: 'invalid' })
      ).rejects.toThrow()
    })
  })
  
  describe('🔴 CRITICAL: Noun-Verb System Must Work', () => {
    beforeEach(async () => {
      db = new BrainyData()
      await db.init()
    })
    
    it('CRITICAL: addNoun and addVerb functionality', async () => {
      // Add nouns
      await db!.addNoun(createTestVector(1), { id: 'alice', name: 'Alice' })
      await db!.addNoun(createTestVector(2), { id: 'bob', name: 'Bob' })
      await db!.addNoun(createTestVector(3), { id: 'project', name: 'Project X' })
      
      // Add verbs (relationships)
      const verbId1 = await db!.addVerb('alice', 'project', VerbType.WORKS_ON)
      const verbId2 = await db!.addVerb('bob', 'project', VerbType.CONTRIBUTES_TO)
      
      expect(verbId1).toBeDefined()
      expect(verbId2).toBeDefined()
      
      // Verify relationships exist
      const verb1 = await db!.getVerb(verbId1)
      expect(verb1?.sourceId).toBe('alice')
      expect(verb1?.targetId).toBe('project')
      expect(verb1?.type).toBe(VerbType.WORKS_ON)
    })
    
    it('CRITICAL: Intelligent verb scoring working', async () => {
      // Add related entities
      await db!.addNoun(createTestVector(1), { 
        id: 'dev1', 
        type: 'developer',
        skills: ['javascript']
      })
      await db!.addNoun(createTestVector(2), { 
        id: 'proj1', 
        type: 'project',
        tech: ['javascript', 'react']
      })
      
      // Add verb without explicit weight
      const verbId = await db!.addVerb('dev1', 'proj1', VerbType.WORKS_ON)
      const verb = await db!.getVerb(verbId)
      
      // Should have computed weight (not default 0.5)
      expect(verb?.metadata?.weight).toBeDefined()
      expect(verb?.metadata?.weight).not.toBe(0.5)
      
      // Should have intelligent scoring metadata
      expect(verb?.metadata?.intelligentScoring).toBeDefined()
      expect(verb?.metadata?.intelligentScoring?.reasoning).toBeInstanceOf(Array)
    })
  })
  
  describe('🔴 CRITICAL: Find() Triple Intelligence', () => {
    beforeEach(async () => {
      db = new BrainyData()
      await db.init()
      
      // Create test dataset
      await db!.addNoun(createTestVector(1), { 
        id: 'alice', 
        name: 'Alice', 
        role: 'developer',
        skills: ['javascript', 'react']
      })
      await db!.addNoun(createTestVector(2), { 
        id: 'bob', 
        name: 'Bob', 
        role: 'developer',
        skills: ['python']
      })
      await db!.addNoun(createTestVector(3), { 
        id: 'project1', 
        name: 'Web App',
        type: 'project',
        status: 'active'
      })
      
      // Add relationships
      await db!.addVerb('alice', 'project1', VerbType.WORKS_ON)
    })
    
    it('CRITICAL: Natural language queries work', async () => {
      const results = await db!.find('find developers')
      
      expect(Array.isArray(results)).toBe(true)
      expect(results.length).toBeGreaterThan(0)
      
      // Should find Alice and Bob
      const names = results.map(r => r.metadata?.name)
      expect(names.some(name => name === 'Alice' || name === 'Bob')).toBe(true)
    })
    
    it('CRITICAL: Vector similarity search', async () => {
      const results = await db!.find({
        similar: 'software developer',
        limit: 2
      })
      
      expect(results.length).toBeGreaterThan(0)
      expect(results.length).toBeLessThanOrEqual(2)
      
      // Each result should have similarity score
      results.forEach(result => {
        expect(result.score).toBeGreaterThan(0)
        expect(result.score).toBeLessThanOrEqual(1)
      })
    })
    
    it('CRITICAL: Field filtering works', async () => {
      const results = await db!.find({
        where: {
          role: 'developer'
        }
      })
      
      // Should find both developers
      expect(results.length).toBe(2)
      const ids = results.map(r => r.id)
      expect(ids).toContain('alice')
      expect(ids).toContain('bob')
    })
    
    it('CRITICAL: Graph traversal works', async () => {
      const results = await db!.find({
        connected: {
          to: 'project1',
          type: VerbType.WORKS_ON
        }
      })
      
      // Should find Alice (who works on project1)
      expect(results.length).toBe(1)
      expect(results[0].id).toBe('alice')
    })
    
    it('CRITICAL: Combined intelligence works', async () => {
      const results = await db!.find({
        similar: 'web development',
        connected: {
          depth: 2
        },
        where: {
          status: 'active'
        }
      })
      
      // Should find project1 and related entities
      expect(results.length).toBeGreaterThan(0)
      const ids = results.map(r => r.id)
      expect(ids).toContain('project1')
    })
  })
  
  describe('🔴 CRITICAL: Neural APIs for External Libraries', () => {
    let neural: NeuralAPI | null = null
    
    beforeEach(async () => {
      db = new BrainyData()
      await db.init()
      neural = new NeuralAPI(db)
      
      // Add test data for clustering
      for (let i = 0; i < 20; i++) {
        await db.addNoun(createTestVector(i), { 
          id: `item${i}`,
          category: i < 10 ? 'tech' : 'food'
        })
      }
    })
    
    it('CRITICAL: Similarity calculation API', async () => {
      const similarity = await neural!.similarity('item1', 'item2')
      
      expect(typeof similarity).toBe('number')
      expect(similarity).toBeGreaterThanOrEqual(0)
      expect(similarity).toBeLessThanOrEqual(1)
    })
    
    it('CRITICAL: Clustering API for external libs', async () => {
      const clusters = await neural!.clusters()
      
      expect(Array.isArray(clusters)).toBe(true)
      expect(clusters.length).toBeGreaterThan(0)
      
      // Each cluster should have required structure
      clusters.forEach(cluster => {
        expect(cluster).toHaveProperty('id')
        expect(cluster).toHaveProperty('centroid')
        expect(cluster).toHaveProperty('members')
        expect(Array.isArray(cluster.centroid)).toBe(true)
        expect(Array.isArray(cluster.members)).toBe(true)
        expect(cluster.centroid.length).toBe(384)
      })
    })
    
    it('CRITICAL: Visualization data generation', async () => {
      const viz = await neural!.visualize({ maxNodes: 10 })
      
      expect(viz).toHaveProperty('nodes')
      expect(viz).toHaveProperty('edges')
      expect(Array.isArray(viz.nodes)).toBe(true)
      expect(Array.isArray(viz.edges)).toBe(true)
      
      // Nodes should have coordinates
      viz.nodes.forEach(node => {
        expect(node).toHaveProperty('id')
        expect(node).toHaveProperty('x')
        expect(node).toHaveProperty('y')
        expect(typeof node.x).toBe('number')
        expect(typeof node.y).toBe('number')
      })
    })
  })
  
  describe('🔴 CRITICAL: Performance Requirements', () => {
    it('CRITICAL: Fast initialization', async () => {
      const start = performance.now()
      
      const brain = new BrainyData()
      await brain.init()
      
      const elapsed = performance.now() - start
      
      // Should initialize quickly (under 5 seconds)
      expect(elapsed).toBeLessThan(5000)
      
      await brain.cleanup?.()
    })
    
    it('CRITICAL: Reasonable search performance', async () => {
      db = new BrainyData()
      await db.init()
      
      // Add substantial data
      for (let i = 0; i < 100; i++) {
        await db.add(createTestVector(i), { id: `perf${i}` })
      }
      
      // Measure search time
      const start = performance.now()
      const results = await db.search(createTestVector(50), 10)
      const elapsed = performance.now() - start
      
      // Should search quickly (under 100ms for 100 items)
      expect(elapsed).toBeLessThan(100)
      expect(results.length).toBeGreaterThan(0)
    })
    
    it('CRITICAL: Memory efficiency', async () => {
      db = new BrainyData()
      await db.init()
      
      const initialMemory = process.memoryUsage().heapUsed
      
      // Add data and clean up
      for (let i = 0; i < 50; i++) {
        await db.add(createTestVector(i), { id: `mem${i}` })
      }
      
      await db.cleanup?.()
      db = null
      
      // Force GC
      if (global.gc) {
        global.gc()
        await new Promise(resolve => setTimeout(resolve, 100))
      }
      
      const finalMemory = process.memoryUsage().heapUsed
      const memoryIncrease = finalMemory - initialMemory
      
      // Should not leak significant memory (< 50MB increase)
      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024)
    })
  })
  
  describe('🔴 CRITICAL: Error Handling', () => {
    it('CRITICAL: Graceful error handling', async () => {
      db = new BrainyData()
      await db.init()
      
      // Should not crash on invalid inputs
      await expect(db.get('nonexistent')).resolves.toBeNull()
      
      await expect(
        db.add(null as any, {})
      ).rejects.toThrow()
      
      // Should still work after errors
      const id = await db.add(createTestVector(1), { id: 'recovery' })
      expect(id).toBeDefined()
    })
    
    it('CRITICAL: Database remains functional after errors', async () => {
      db = new BrainyData()
      await db.init()
      
      // Add valid data
      await db.add(createTestVector(1), { id: 'valid1' })
      
      // Try invalid operation
      try {
        await db.add(new Array(100).fill(0), { id: 'invalid' })
      } catch (error) {
        // Expected to fail
      }
      
      // Should still work
      await db.add(createTestVector(2), { id: 'valid2' })
      const results = await db.search(createTestVector(1), 5)
      expect(results.length).toBeGreaterThan(0)
    })
  })
})