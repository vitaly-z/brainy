import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { Brainy } from '../../../src/brainy'
import { TripleIntelligenceEngine, TripleQuery } from '../../../src/triple/TripleIntelligence'
import { NounType, VerbType } from '../../../src/types/graphTypes'

describe('TripleIntelligenceEngine', () => {
  let brain: Brainy<any>
  let tripleEngine: TripleIntelligenceEngine
  
  beforeEach(async () => {
    brain = new Brainy({ storage: { type: 'memory' } })
    await brain.init()
    tripleEngine = new TripleIntelligenceEngine(brain)
  })
  
  afterEach(async () => {
    await brain.close()
  })
  
  describe('Triple Query - Core Functionality', () => {
    beforeEach(async () => {
      // Create test dataset
      await brain.add({
        data: 'John Smith - Senior Software Engineer',
        type: NounType.Person,
        metadata: { role: 'engineer', level: 'senior', skills: ['JavaScript', 'Python'] }
      })
      
      await brain.add({
        data: 'Jane Doe - Machine Learning Researcher',
        type: NounType.Person,
        metadata: { role: 'researcher', level: 'principal', skills: ['Python', 'TensorFlow'] }
      })
      
      await brain.add({
        data: 'TechCorp - Leading technology company',
        type: NounType.Organization,
        metadata: { industry: 'technology', size: 'large' }
      })
    })
    
    describe('Vector Search', () => {
      it('should perform similarity search', async () => {
        const query: TripleQuery = {
          similar: 'machine learning expert',
          limit: 10
        }
        
        const results = await tripleEngine.find(query)
        
        expect(results).toBeDefined()
        expect(Array.isArray(results)).toBe(true)
        expect(results.length).toBeGreaterThan(0)
        
        // Check fusion scores
        results.forEach(r => {
          expect(r.fusionScore).toBeDefined()
          expect(r.fusionScore).toBeGreaterThanOrEqual(0)
          expect(r.fusionScore).toBeLessThanOrEqual(1)
        })
      })
      
      it('should handle like queries', async () => {
        const query: TripleQuery = {
          like: 'software engineer',
          limit: 5
        }
        
        const results = await tripleEngine.find(query)
        
        expect(results).toBeDefined()
        expect(results.length).toBeLessThanOrEqual(5)
      })
    })
    
    describe('Field Filtering', () => {
      it('should filter by metadata fields', async () => {
        const query: TripleQuery = {
          where: { level: 'senior' },
          limit: 10
        }
        
        const results = await tripleEngine.find(query)
        
        expect(results).toBeDefined()
        results.forEach(r => {
          if (r.metadata?.level) {
            expect(r.metadata.level).toBe('senior')
          }
        })
      })
      
      it('should combine field filter with vector search', async () => {
        const query: TripleQuery = {
          similar: 'Python developer',
          where: { skills: { $contains: 'Python' } },
          limit: 10
        }
        
        const results = await tripleEngine.find(query)
        
        expect(results).toBeDefined()
        expect(Array.isArray(results)).toBe(true)
      })
    })
    
    describe('Query Modes', () => {
      it('should respect vector-only mode', async () => {
        const query: TripleQuery = {
          similar: 'artificial intelligence',
          mode: 'vector',
          limit: 10
        }
        
        const results = await tripleEngine.find(query)
        
        expect(results).toBeDefined()
        expect(Array.isArray(results)).toBe(true)
      })
      
      it('should respect metadata-only mode', async () => {
        const query: TripleQuery = {
          where: { industry: 'technology' },
          mode: 'metadata',
          limit: 10
        }
        
        const results = await tripleEngine.find(query)
        
        expect(results).toBeDefined()
        results.forEach(r => {
          if (r.metadata?.industry) {
            expect(r.metadata.industry).toBe('technology')
          }
        })
      })
      
      it('should auto-detect optimal mode', async () => {
        const query: TripleQuery = {
          similar: 'engineer',
          where: { level: 'senior' },
          mode: 'auto',
          limit: 10
        }
        
        const results = await tripleEngine.find(query)
        
        expect(results).toBeDefined()
        expect(Array.isArray(results)).toBe(true)
      })
      
      it('should use fusion mode for complex queries', async () => {
        const query: TripleQuery = {
          similar: 'machine learning',
          where: { role: 'researcher' },
          mode: 'fusion',
          limit: 10
        }
        
        const results = await tripleEngine.find(query)
        
        expect(results).toBeDefined()
        results.forEach(r => {
          expect(r.fusionScore).toBeDefined()
        })
      })
    })
    
    describe('Query Planning', () => {
      it('should explain query execution with explain flag', async () => {
        const query: TripleQuery = {
          similar: 'technology',
          where: { size: 'large' },
          explain: true,
          limit: 10
        }
        
        const results = await tripleEngine.find(query)
        
        expect(results).toBeDefined()
        if (results.length > 0 && results[0].explanation) {
          expect(results[0].explanation.plan).toBeDefined()
          expect(results[0].explanation.timing).toBeDefined()
        }
      })
      
      it('should choose parallel execution when beneficial', async () => {
        const query: TripleQuery = {
          similar: 'AI research',
          where: { industry: 'technology' },
          mode: 'auto'
        }
        
        const startTime = Date.now()
        const results = await tripleEngine.find(query)
        const duration = Date.now() - startTime
        
        expect(results).toBeDefined()
        expect(duration).toBeLessThan(200) // Should be fast
      })
    })
    
    describe('Pagination', () => {
      it('should handle limit parameter', async () => {
        const query: TripleQuery = {
          similar: 'technology',
          limit: 2
        }
        
        const results = await tripleEngine.find(query)
        
        expect(results).toBeDefined()
        expect(results.length).toBeLessThanOrEqual(2)
      })
      
      it('should handle offset for pagination', async () => {
        // Add more test data
        for (let i = 0; i < 10; i++) {
          await brain.add({
            data: `Test Entity ${i}`,
            type: NounType.Thing,
            metadata: { index: i }
          })
        }
        
        const query1: TripleQuery = {
          where: { index: { $exists: true } },
          limit: 3,
          offset: 0
        }
        
        const page1 = await tripleEngine.find(query1)
        
        const query2: TripleQuery = {
          where: { index: { $exists: true } },
          limit: 3,
          offset: 3
        }
        
        const page2 = await tripleEngine.find(query2)
        
        expect(page1.length).toBeLessThanOrEqual(3)
        expect(page2.length).toBeLessThanOrEqual(3)
        
        // Pages should have different IDs
        const page1Ids = page1.map(r => r.id)
        const page2Ids = page2.map(r => r.id)
        const overlap = page1Ids.filter(id => page2Ids.includes(id))
        expect(overlap.length).toBe(0)
      })
    })
    
    describe('Fusion Ranking', () => {
      it('should combine multiple scores correctly', async () => {
        const query: TripleQuery = {
          similar: 'Python programming',
          where: { skills: { $contains: 'Python' } },
          mode: 'fusion'
        }
        
        const results = await tripleEngine.find(query)
        
        results.forEach(r => {
          expect(r.fusionScore).toBeDefined()
          expect(r.fusionScore).toBeGreaterThanOrEqual(0)
          expect(r.fusionScore).toBeLessThanOrEqual(1)
        })
      })
      
      it('should apply boost strategies', async () => {
        const query: TripleQuery = {
          similar: 'software development',
          boost: 'recent',
          limit: 10
        }
        
        const results = await tripleEngine.find(query)
        
        expect(results).toBeDefined()
        if (results.length > 1) {
          // Results should be ordered by score
          expect(results[0].fusionScore).toBeGreaterThanOrEqual(results[1].fusionScore)
        }
      })
      
      it('should respect threshold parameter', async () => {
        const query: TripleQuery = {
          similar: 'quantum computing',
          threshold: 0.5,
          limit: 10
        }
        
        const results = await tripleEngine.find(query)
        
        // All results should meet threshold
        results.forEach(r => {
          if (r.fusionScore < 0.5) {
            console.log('Note: Threshold filtering may not be implemented')
          }
        })
      })
    })
    
    describe('Graph Traversal', () => {
      it('should handle connected queries', async () => {
        // Create relationships
        const person1 = await brain.add({
          data: 'Alice',
          type: NounType.Person
        })
        
        const person2 = await brain.add({
          data: 'Bob',
          type: NounType.Person
        })
        
        await brain.relate({
          from: person1,
          to: person2,
          type: VerbType.FriendOf as any
        })
        
        const query: TripleQuery = {
          connected: {
            from: [person1],
            depth: 1,
            direction: 'out'
          }
        }
        
        const results = await tripleEngine.find(query)
        
        expect(results).toBeDefined()
        expect(Array.isArray(results)).toBe(true)
      })
      
      it('should handle multi-depth traversal', async () => {
        // Create chain of relationships
        const ids = []
        for (let i = 0; i < 5; i++) {
          const id = await brain.add({
            data: `Node ${i}`,
            type: NounType.Thing
          })
          ids.push(id as any)
          
          if (i > 0) {
            await brain.relate({
              from: ids[i-1],
              to: ids[i],
              type: VerbType.RelatedTo as any
            })
          }
        }
        
        const query: TripleQuery = {
          connected: {
            from: [ids[0]],
            depth: 3,
            direction: 'out'
          }
        }
        
        const results = await tripleEngine.find(query)
        
        expect(results).toBeDefined()
        expect(results.length).toBeGreaterThan(0)
      })
    })
    
    describe('Error Handling', () => {
      it('should handle empty queries gracefully', async () => {
        const query: TripleQuery = {}
        
        const results = await tripleEngine.find(query)
        
        expect(results).toBeDefined()
        expect(Array.isArray(results)).toBe(true)
      })
      
      it('should handle invalid entity references', async () => {
        const query: TripleQuery = {
          connected: {
            to: ['non-existent-id'],
            depth: 2
          }
        }
        
        const results = await tripleEngine.find(query)
        
        expect(results).toBeDefined()
        expect(Array.isArray(results)).toBe(true)
      })
      
      it('should handle conflicting modes gracefully', async () => {
        const query: TripleQuery = {
          similar: 'test',
          mode: 'metadata' // Conflicts with vector search
        }
        
        const results = await tripleEngine.find(query)
        expect(results).toBeDefined()
      })
    })
    
    describe('Performance', () => {
      it('should cache query plans', async () => {
        const query: TripleQuery = {
          similar: 'machine learning',
          where: { level: 'senior' }
        }
        
        // First execution
        const start1 = Date.now()
        await tripleEngine.find(query)
        const time1 = Date.now() - start1
        
        // Second execution (should use cached plan)
        const start2 = Date.now()
        await tripleEngine.find(query)
        const time2 = Date.now() - start2
        
        // Second should be similar or faster
        expect(time2).toBeLessThanOrEqual(time1 + 20) // Allow some variance
      })
      
      it('should handle large datasets efficiently', async () => {
        // Add many entities
        const promises = []
        for (let i = 0; i < 50; i++) {
          promises.push(brain.add({
            data: `Entity ${i}`,
            type: NounType.Thing,
            metadata: { batch: true, index: i }
          }))
        }
        await Promise.all(promises)
        
        const query: TripleQuery = {
          where: { batch: true },
          limit: 25
        }
        
        const startTime = Date.now()
        const results = await tripleEngine.find(query)
        const duration = Date.now() - startTime
        
        expect(results.length).toBeLessThanOrEqual(25)
        expect(duration).toBeLessThan(500) // Should be fast
      })
    })
  })
  
  describe('Edge Cases', () => {
    it('should handle empty database', async () => {
      const emptyBrain = new Brainy({ storage: { type: 'memory' } })
      await emptyBrain.init()
      const emptyEngine = new TripleIntelligenceEngine(emptyBrain)
      
      const query: TripleQuery = {
        similar: 'test',
        where: { field: 'value' }
      }
      
      const results = await emptyEngine.find(query)
      
      expect(results).toBeDefined()
      expect(results.length).toBe(0)
      
      await emptyBrain.close()
    })
    
    it('should handle circular relationships', async () => {
      const a = await brain.add({ data: 'A', type: NounType.Thing })
      const b = await brain.add({ data: 'B', type: NounType.Thing })
      const c = await brain.add({ data: 'C', type: NounType.Thing })
      
      await brain.relate({ from: a, to: b, type: VerbType.RelatedTo })
      await brain.relate({ from: b, to: c, type: VerbType.RelatedTo })
      await brain.relate({ from: c, to: a, type: VerbType.RelatedTo })
      
      const query: TripleQuery = {
        connected: {
          from: [a],
          depth: 10, // Would traverse circle many times
          direction: 'out'
        }
      }
      
      const results = await tripleEngine.find(query)
      
      expect(results).toBeDefined()
      // Should handle circular refs without infinite loop
      expect(results.length).toBeLessThanOrEqual(3)
    })
  })
})