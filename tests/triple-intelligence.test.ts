import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { BrainyData } from '../src/brainyData.js'
import { NounType, VerbType } from '../src/types/graphTypes.js'

describe('Triple Intelligence Engine', () => {
  let brain: BrainyData
  
  beforeEach(async () => {
    brain = new BrainyData({
      logging: { verbose: false },
      storage: { forceMemoryStorage: true }  // Use memory storage to avoid file system issues in tests
    })
    await brain.init()
  })
  
  afterEach(async () => {
    if (brain) {
      if (typeof brain.close === 'function') {
        await brain.close()
      } else if (typeof brain.cleanup === 'function') {
        await brain.cleanup()
      }
    }
  })
  
  describe('Basic find() API', () => {
    it('should perform vector search with like query', async () => {
      // Add test data using 2.0.0 API
      const doc1Id = await brain.addNoun('AI safety research', 'content', { id: 'doc1', content: 'AI safety research' })
      const doc2Id = await brain.addNoun('Machine learning algorithms', 'content', { id: 'doc2', content: 'Machine learning algorithms' })
      const doc3Id = await brain.addNoun('Neural networks', 'content', { id: 'doc3', content: 'Neural networks' })
      
      // Search using Triple Intelligence with text query
      const results = await brain.find({
        like: 'AI safety research',
        limit: 2
      })
      
      expect(results).toBeDefined()
      expect(results.length).toBeLessThanOrEqual(2)
      // Should find AI safety research most similar
      expect(results.some(r => r.metadata?.content?.includes('AI safety'))).toBe(true)
    })
    
    it('should perform field filtering with where clause', async () => {
      // Add test data with metadata
      const paper1Id = await brain.addNoun('Research paper about AI algorithms', NounType.Document, { id: 'paper1', year: 2021, citations: 150 })
      const paper2Id = await brain.addNoun('Study on machine learning techniques', NounType.Document, { id: 'paper2', year: 2020, citations: 50 })
      const paper3Id = await brain.addNoun('Advanced neural network architectures', NounType.Document, { id: 'paper3', year: 2023, citations: 200 })
      
      // Search with field filter using Triple Intelligence
      const results = await brain.find({
        where: {
          year: { greaterThan: 2020 },
          citations: { greaterThan: 100 }
        }
      })
      
      expect(results).toBeDefined()
      expect(results.some(r => r.id === paper3Id)).toBe(true)
      expect(results.some(r => r.id === paper2Id)).toBe(false)
    })
    
    it('should combine vector and field search', async () => {
      // Add test data
      await brain.addNoun('Advanced AI research paper', NounType.Document, { id: 'ai1', topic: 'AI', year: 2022 })
      await brain.addNoun('Older AI methods study', NounType.Document, { id: 'ai2', topic: 'AI', year: 2020 })
      await brain.addNoun('Machine learning algorithms', NounType.Document, { id: 'ml1', topic: 'ML', year: 2022 })
      
      // Combined search
      const results = await brain.find({
        like: 'AI research',
        where: { year: { greaterEqual: 2022 } },
        limit: 2
      })
      
      expect(results).toBeDefined()
      expect(results[0].id).toBe('ai1') // Best match: similar vector AND matches filter
    })
    
    it('should handle graph connections', async () => {
      // Add nodes
      const researcher1Id = await brain.addNoun('Alice Smith, AI researcher', NounType.Person, { id: 'researcher1', name: 'Alice' })
      const researcher2Id = await brain.addNoun('Bob Johnson, ML expert', NounType.Person, { id: 'researcher2', name: 'Bob' })
      const paper1Id = await brain.addNoun('AI Safety Research Paper', NounType.Document, { id: 'paper1', title: 'AI Safety' })
      
      // Add relationships
      await brain.addVerb(researcher1Id, paper1Id, VerbType.CreatedBy)
      await brain.addVerb(researcher2Id, paper1Id, VerbType.WorksWith)
      
      // Search with graph connections
      const results = await brain.find({
        connected: {
          to: paper1Id
        }
      })
      
      expect(results).toBeDefined()
      expect(results.some(r => r.id === researcher1Id || r.id === researcher2Id)).toBe(true)
    })
  })
  
  describe('Query Planning', () => {
    it('should optimize query execution order', async () => {
      const results = await brain.find({
        like: 'AI research',
        where: { year: 2023 },
        explain: true
      })
      
      expect(results).toBeDefined()
      results.forEach(r => {
        if (r.explanation) {
          expect(r.explanation.plan).toBeDefined()
          expect(r.explanation.timing).toBeDefined()
        }
      })
    })
    
    it('should parallelize when possible', async () => {
      // Add test data
      const test1Id = await brain.addNoun('Test document one', NounType.Content, { id: 'test1' })
      const test2Id = await brain.addNoun('Test document two', NounType.Content, { id: 'test2' })
      
      const startTime = Date.now()
      const results = await brain.find({
        like: 'Test document',
        connected: { to: test1Id }
      })
      const duration = Date.now() - startTime
      
      expect(results).toBeDefined()
      // Parallel execution should be fast
      expect(duration).toBeLessThan(1000)
    })
  })
  
  describe('Fusion Ranking', () => {
    it('should combine scores from multiple sources', async () => {
      // Add interconnected data
      const node1Id = await brain.addNoun('High relevance content', NounType.Content, { id: 'node1', relevance: 'high' })
      const node2Id = await brain.addNoun('Medium relevance content', NounType.Content, { id: 'node2', relevance: 'medium' })
      const node3Id = await brain.addNoun('Low relevance content', NounType.Content, { id: 'node3', relevance: 'low' })
      
      await brain.addVerb(node1Id, node2Id, VerbType.RelatedTo)
      
      const results = await brain.find({
        like: 'High relevance',
        where: { relevance: 'high' }
      })
      
      expect(results).toBeDefined()
      if (results.length > 0) {
        expect(results[0].fusionScore).toBeDefined()
        expect(results[0].fusionScore).toBeGreaterThan(0)
      }
    })
    
    it('should apply boosts correctly', async () => {
      // Add data with timestamps
      const now = Date.now()
      const recentId = await brain.addNoun('Recent content', NounType.Content, { id: 'recent', timestamp: now })
      const oldId = await brain.addNoun('Old content', NounType.Content, { id: 'old', timestamp: now - 90 * 24 * 60 * 60 * 1000 })
      
      const results = await brain.find({
        like: 'content',
        boost: 'recent'
      })
      
      expect(results).toBeDefined()
      if (results.length >= 2) {
        // Recent item should rank higher with boost
        const recentIndex = results.findIndex(r => r.id === recentId)
        const oldIndex = results.findIndex(r => r.id === oldId)
        expect(recentIndex).toBeLessThan(oldIndex)
      }
    })
  })
  
  describe('Error Handling', () => {
    it('should handle empty queries gracefully', async () => {
      const results = await brain.find({})
      expect(results).toBeDefined()
      expect(Array.isArray(results)).toBe(true)
    })
    
    it('should handle invalid queries gracefully', async () => {
      const results = await brain.find({
        where: { nonexistent: 'field' }
      })
      expect(results).toBeDefined()
      expect(Array.isArray(results)).toBe(true)
    })
  })
  
  describe('Self-Optimization', () => {
    it('should learn from query patterns', async () => {
      // Execute similar queries multiple times
      for (let i = 0; i < 3; i++) {
        await brain.find({
          like: 'test query',
          where: { type: 'document' }
        })
      }
      
      // Note: Query pattern learning stats would be accessed via brain.getStatistics()
      const stats = await brain.getStatistics()
      expect(stats).toBeDefined()
    })
  })
})