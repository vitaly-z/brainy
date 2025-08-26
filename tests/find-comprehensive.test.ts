import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { BrainyData, VerbType } from '../src/index.js'

describe('find() Method - Comprehensive Triple Intelligence Tests', () => {
  let db: BrainyData | null = null
  
  // Helper to create test vectors with semantic meaning
  const createTestVector = (seed: number = 0, category: 'tech' | 'food' | 'travel' | 'person' = 'tech') => {
    const base = new Array(384).fill(0).map((_, i) => Math.sin(i + seed) * 0.5)
    // Add category-specific bias to create semantic clusters
    const categoryBias = {
      tech: 0.2,
      food: -0.2,
      travel: 0.1,
      person: -0.1
    }
    return base.map(v => v + categoryBias[category])
  }
  
  afterEach(async () => {
    if (db) {
      await db.cleanup?.()
      db = null
    }
    
    // Force garbage collection if available
    if (global.gc) {
      global.gc()
    }
  })
  
  describe('Natural Language Queries', () => {
    beforeEach(async () => {
      db = new BrainyData()
      await db.init()
      
      // Add diverse test data
      // Tech entities
      await db.addNoun(createTestVector(1, 'tech'), { 
        id: 'javascript', 
        name: 'JavaScript',
        type: 'language',
        category: 'tech',
        popularity: 95
      })
      await db.addNoun(createTestVector(2, 'tech'), { 
        id: 'python', 
        name: 'Python',
        type: 'language',
        category: 'tech',
        popularity: 90
      })
      await db.addNoun(createTestVector(3, 'tech'), { 
        id: 'react', 
        name: 'React',
        type: 'framework',
        category: 'tech',
        popularity: 85
      })
      
      // People
      await db.addNoun(createTestVector(4, 'person'), { 
        id: 'alice', 
        name: 'Alice',
        type: 'developer',
        category: 'person',
        experience: 5
      })
      await db.addNoun(createTestVector(5, 'person'), { 
        id: 'bob', 
        name: 'Bob',
        type: 'developer',
        category: 'person',
        experience: 3
      })
      
      // Projects
      await db.addNoun(createTestVector(6, 'tech'), { 
        id: 'webapp', 
        name: 'Web Application',
        type: 'project',
        category: 'tech',
        status: 'active'
      })
      
      // Add relationships
      await db.addVerb('alice', 'javascript', VerbType.USES)
      await db.addVerb('alice', 'react', VerbType.USES)
      await db.addVerb('bob', 'python', VerbType.USES)
      await db.addVerb('webapp', 'react', VerbType.USES)
      await db.addVerb('alice', 'webapp', VerbType.WORKS_ON)
    })
    
    it('should understand simple natural language queries', async () => {
      const results = await db!.find('find all developers')
      
      expect(results).toBeDefined()
      expect(Array.isArray(results)).toBe(true)
      
      // Should find Alice and Bob
      const ids = results.map(r => r.id)
      expect(ids).toContain('alice')
      expect(ids).toContain('bob')
    })
    
    it('should handle complex natural language with intent', async () => {
      const results = await db!.find('show me developers who use JavaScript')
      
      // Should find Alice (who uses JavaScript)
      const ids = results.map(r => r.id)
      expect(ids).toContain('alice')
      
      // Should not include Bob (uses Python)
      expect(ids).not.toContain('bob')
    })
    
    it('should understand relationship queries', async () => {
      const results = await db!.find('what projects is Alice working on')
      
      // Should find webapp
      const ids = results.map(r => r.id)
      expect(ids).toContain('webapp')
    })
    
    it('should handle similarity queries', async () => {
      const results = await db!.find('find things similar to React')
      
      // Should find other tech items
      expect(results.length).toBeGreaterThan(0)
      
      // JavaScript should be in results (same category)
      const ids = results.map(r => r.id)
      expect(ids.some(id => ['javascript', 'python', 'webapp'].includes(id))).toBe(true)
    })
  })
  
  describe('Vector Search (like/similar)', () => {
    beforeEach(async () => {
      db = new BrainyData()
      await db.init()
      
      // Add test data with clear semantic clusters
      for (let i = 0; i < 10; i++) {
        await db.addNoun(createTestVector(i, 'tech'), { 
          id: `tech${i}`, 
          category: 'technology',
          relevance: i * 10
        })
      }
      
      for (let i = 0; i < 10; i++) {
        await db.addNoun(createTestVector(i + 100, 'food'), { 
          id: `food${i}`, 
          category: 'cuisine',
          rating: i
        })
      }
    })
    
    it('should find items similar to a vector', async () => {
      const queryVector = createTestVector(5, 'tech')
      
      const results = await db!.find({
        like: queryVector,
        limit: 5
      })
      
      expect(results.length).toBeLessThanOrEqual(5)
      
      // Should find tech items (similar vectors)
      const ids = results.map(r => r.id)
      expect(ids.some(id => id.startsWith('tech'))).toBe(true)
    })
    
    it('should find items similar to text', async () => {
      const results = await db!.find({
        similar: 'technology and programming',
        limit: 3
      })
      
      expect(results.length).toBeGreaterThan(0)
      expect(results.length).toBeLessThanOrEqual(3)
    })
    
    it('should find items similar to an existing ID', async () => {
      const results = await db!.find({
        like: 'tech5',
        limit: 3
      })
      
      // Should find other tech items
      const ids = results.map(r => r.id)
      expect(ids.some(id => id.startsWith('tech') && id !== 'tech5')).toBe(true)
    })
    
    it('should respect similarity threshold', async () => {
      const results = await db!.find({
        similar: createTestVector(5, 'tech'),
        threshold: 0.9, // High similarity required
        limit: 10
      })
      
      // Should only find very similar items
      results.forEach(result => {
        expect(result.score).toBeGreaterThan(0.9)
      })
    })
  })
  
  describe('Graph Search (connected)', () => {
    beforeEach(async () => {
      db = new BrainyData()
      await db.init()
      
      // Create a graph structure
      // Company -> Department -> Team -> Employee
      await db.addNoun(createTestVector(1), { id: 'company', name: 'TechCorp' })
      await db.addNoun(createTestVector(2), { id: 'engineering', name: 'Engineering Dept' })
      await db.addNoun(createTestVector(3), { id: 'frontend', name: 'Frontend Team' })
      await db.addNoun(createTestVector(4), { id: 'backend', name: 'Backend Team' })
      await db.addNoun(createTestVector(5), { id: 'alice', name: 'Alice', role: 'developer' })
      await db.addNoun(createTestVector(6), { id: 'bob', name: 'Bob', role: 'developer' })
      await db.addNoun(createTestVector(7), { id: 'charlie', name: 'Charlie', role: 'manager' })
      
      // Create relationships
      await db.addVerb('company', 'engineering', VerbType.CONTAINS)
      await db.addVerb('engineering', 'frontend', VerbType.CONTAINS)
      await db.addVerb('engineering', 'backend', VerbType.CONTAINS)
      await db.addVerb('frontend', 'alice', VerbType.CONTAINS)
      await db.addVerb('backend', 'bob', VerbType.CONTAINS)
      await db.addVerb('charlie', 'engineering', VerbType.MANAGES)
    })
    
    it('should find directly connected nodes', async () => {
      const results = await db!.find({
        connected: {
          to: 'engineering',
          depth: 1
        }
      })
      
      // Should find company (parent) and frontend/backend (children)
      const ids = results.map(r => r.id)
      expect(ids).toContain('company')
      expect(ids).toContain('frontend')
      expect(ids).toContain('backend')
    })
    
    it('should traverse multiple hops', async () => {
      const results = await db!.find({
        connected: {
          to: 'company',
          depth: 3,
          direction: 'out'
        }
      })
      
      // Should find entire hierarchy
      const ids = results.map(r => r.id)
      expect(ids).toContain('engineering')
      expect(ids).toContain('frontend')
      expect(ids).toContain('backend')
      expect(ids).toContain('alice')
      expect(ids).toContain('bob')
    })
    
    it('should filter by relationship type', async () => {
      const results = await db!.find({
        connected: {
          from: 'charlie',
          type: VerbType.MANAGES
        }
      })
      
      // Should only find engineering (what Charlie manages)
      const ids = results.map(r => r.id)
      expect(ids).toContain('engineering')
      expect(ids.length).toBe(1)
    })
    
    it('should handle bidirectional search', async () => {
      const results = await db!.find({
        connected: {
          to: 'frontend',
          direction: 'both',
          depth: 1
        }
      })
      
      // Should find parent (engineering) and child (alice)
      const ids = results.map(r => r.id)
      expect(ids).toContain('engineering')
      expect(ids).toContain('alice')
    })
    
    it('should find paths between nodes', async () => {
      const results = await db!.find({
        connected: {
          from: 'alice',
          to: 'bob',
          depth: 4
        }
      })
      
      // Should find path through the hierarchy
      expect(results.length).toBeGreaterThan(0)
    })
  })
  
  describe('Field Search (where)', () => {
    beforeEach(async () => {
      db = new BrainyData()
      await db.init()
      
      // Add data with various fields
      await db.addNoun(createTestVector(1), { 
        id: 'product1',
        name: 'Laptop',
        price: 1200,
        category: 'electronics',
        inStock: true,
        tags: ['portable', 'computer']
      })
      
      await db.addNoun(createTestVector(2), { 
        id: 'product2',
        name: 'Phone',
        price: 800,
        category: 'electronics',
        inStock: false,
        tags: ['mobile', 'smart']
      })
      
      await db.addNoun(createTestVector(3), { 
        id: 'product3',
        name: 'Desk',
        price: 400,
        category: 'furniture',
        inStock: true,
        tags: ['office', 'wood']
      })
      
      await db.addNoun(createTestVector(4), { 
        id: 'product4',
        name: 'Chair',
        price: 200,
        category: 'furniture',
        inStock: true,
        tags: ['office', 'ergonomic']
      })
    })
    
    it('should filter by exact field match', async () => {
      const results = await db!.find({
        where: {
          category: 'electronics'
        }
      })
      
      const ids = results.map(r => r.id)
      expect(ids).toContain('product1')
      expect(ids).toContain('product2')
      expect(ids).not.toContain('product3')
      expect(ids).not.toContain('product4')
    })
    
    it('should filter by multiple fields', async () => {
      const results = await db!.find({
        where: {
          category: 'electronics',
          inStock: true
        }
      })
      
      // Only laptop matches both criteria
      const ids = results.map(r => r.id)
      expect(ids).toContain('product1')
      expect(ids).not.toContain('product2') // Not in stock
    })
    
    it('should handle range queries', async () => {
      const results = await db!.find({
        where: {
          price: { $gte: 500, $lte: 1000 }
        }
      })
      
      // Only phone (800) is in this range
      const ids = results.map(r => r.id)
      expect(ids).toContain('product2')
      expect(ids.length).toBe(1)
    })
    
    it('should handle array contains queries', async () => {
      const results = await db!.find({
        where: {
          tags: { $contains: 'office' }
        }
      })
      
      // Desk and Chair have 'office' tag
      const ids = results.map(r => r.id)
      expect(ids).toContain('product3')
      expect(ids).toContain('product4')
    })
    
    it('should handle OR conditions', async () => {
      const results = await db!.find({
        where: {
          $or: [
            { category: 'electronics' },
            { price: { $lt: 300 } }
          ]
        }
      })
      
      // Electronics OR price < 300 (all except desk)
      const ids = results.map(r => r.id)
      expect(ids).toContain('product1') // electronics
      expect(ids).toContain('product2') // electronics  
      expect(ids).toContain('product4') // price 200
    })
  })
  
  describe('Combined Triple Intelligence', () => {
    beforeEach(async () => {
      db = new BrainyData()
      await db.init()
      
      // Create a rich dataset
      // Users
      await db.addNoun(createTestVector(1, 'person'), { 
        id: 'user1',
        name: 'Alice',
        type: 'user',
        skills: ['javascript', 'react'],
        experience: 5
      })
      await db.addNoun(createTestVector(2, 'person'), { 
        id: 'user2',
        name: 'Bob',
        type: 'user',
        skills: ['python', 'django'],
        experience: 3
      })
      await db.addNoun(createTestVector(3, 'person'), { 
        id: 'user3',
        name: 'Charlie',
        type: 'user',
        skills: ['javascript', 'vue'],
        experience: 4
      })
      
      // Projects
      await db.addNoun(createTestVector(4, 'tech'), { 
        id: 'project1',
        name: 'E-commerce Platform',
        type: 'project',
        tech: ['javascript', 'react'],
        status: 'active'
      })
      await db.addNoun(createTestVector(5, 'tech'), { 
        id: 'project2',
        name: 'Data Analysis Tool',
        type: 'project',
        tech: ['python', 'pandas'],
        status: 'completed'
      })
      
      // Relationships
      await db.addVerb('user1', 'project1', VerbType.WORKS_ON)
      await db.addVerb('user2', 'project2', VerbType.WORKS_ON)
      await db.addVerb('user3', 'project1', VerbType.CONTRIBUTES_TO)
      await db.addVerb('project1', 'project2', VerbType.DEPENDS_ON)
    })
    
    it('should combine vector and field search', async () => {
      const results = await db!.find({
        similar: 'JavaScript development',
        where: {
          experience: { $gte: 4 }
        }
      })
      
      // Should find experienced JS developers
      const ids = results.map(r => r.id)
      expect(ids).toContain('user1') // 5 years, JS
      expect(ids).toContain('user3') // 4 years, JS
      expect(ids).not.toContain('user2') // Only 3 years
    })
    
    it('should combine graph and field search', async () => {
      const results = await db!.find({
        connected: {
          to: 'project1',
          type: [VerbType.WORKS_ON, VerbType.CONTRIBUTES_TO]
        },
        where: {
          type: 'user'
        }
      })
      
      // Should find users working on project1
      const ids = results.map(r => r.id)
      expect(ids).toContain('user1')
      expect(ids).toContain('user3')
      expect(ids).not.toContain('user2') // Works on project2
    })
    
    it('should combine all three intelligence types', async () => {
      const results = await db!.find({
        similar: 'web development project',
        connected: {
          depth: 2
        },
        where: {
          status: 'active'
        }
      })
      
      // Should find active projects and related entities
      expect(results.length).toBeGreaterThan(0)
      
      // Project1 should be highly ranked (matches all criteria)
      const topResult = results[0]
      expect(topResult.id).toBe('project1')
    })
    
    it('should handle complex fusion scoring', async () => {
      const results = await db!.find({
        like: 'user1', // Similar to Alice
        connected: {
          to: 'project1' // Connected to project1
        },
        where: {
          skills: { $contains: 'javascript' } // Has JS skills
        }
      })
      
      // User3 (Charlie) should score high:
      // - Similar to user1 (both JS developers)
      // - Connected to project1
      // - Has javascript in skills
      const ids = results.map(r => r.id)
      expect(ids).toContain('user3')
      
      // Results should have fusion scores
      results.forEach(result => {
        expect(result).toHaveProperty('score')
        expect(result.score).toBeGreaterThan(0)
        expect(result.score).toBeLessThanOrEqual(1)
      })
    })
  })
  
  describe('Performance and Edge Cases', () => {
    it('should handle empty database gracefully', async () => {
      db = new BrainyData()
      await db.init()
      
      const results = await db.find('find anything')
      
      expect(Array.isArray(results)).toBe(true)
      expect(results.length).toBe(0)
    })
    
    it('should handle invalid queries gracefully', async () => {
      db = new BrainyData()
      await db.init()
      
      // Add some data
      await db.addNoun(createTestVector(1), { id: 'test1' })
      
      // Invalid query structures
      const results1 = await db.find({
        where: null as any
      })
      expect(Array.isArray(results1)).toBe(true)
      
      const results2 = await db.find({
        connected: {
          to: 'nonexistent'
        }
      })
      expect(Array.isArray(results2)).toBe(true)
    })
    
    it('should handle large result sets with pagination', async () => {
      db = new BrainyData()
      await db.init()
      
      // Add many items
      for (let i = 0; i < 100; i++) {
        await db.addNoun(createTestVector(i), { 
          id: `item${i}`,
          index: i
        })
      }
      
      // Query with limit
      const results = await db.find({
        where: {
          index: { $gte: 0 }
        },
        limit: 10,
        offset: 20
      })
      
      expect(results.length).toBeLessThanOrEqual(10)
    })
    
    it('should be performant for complex queries', async () => {
      db = new BrainyData()
      await db.init()
      
      // Add substantial data
      for (let i = 0; i < 50; i++) {
        await db.addNoun(createTestVector(i), { 
          id: `node${i}`,
          value: i
        })
      }
      
      // Add relationships
      for (let i = 0; i < 49; i++) {
        await db.addVerb(`node${i}`, `node${i+1}`, VerbType.CONNECTED_TO)
      }
      
      const start = performance.now()
      
      const results = await db.find({
        similar: 'node25',
        connected: {
          depth: 3
        },
        where: {
          value: { $gte: 20, $lte: 30 }
        }
      })
      
      const elapsed = performance.now() - start
      
      // Should complete in reasonable time
      expect(elapsed).toBeLessThan(1000) // Under 1 second
      expect(results).toBeDefined()
    })
  })
  
  describe('Result Structure and Scoring', () => {
    beforeEach(async () => {
      db = new BrainyData()
      await db.init()
      
      // Add test data
      await db.addNoun(createTestVector(1), { 
        id: 'result1',
        name: 'Test Result 1'
      })
      await db.addNoun(createTestVector(2), { 
        id: 'result2',
        name: 'Test Result 2'
      })
    })
    
    it('should return properly structured results', async () => {
      const results = await db!.find({
        like: createTestVector(1.5),
        limit: 2
      })
      
      expect(Array.isArray(results)).toBe(true)
      
      results.forEach(result => {
        expect(result).toHaveProperty('id')
        expect(result).toHaveProperty('score')
        expect(result).toHaveProperty('data')
        expect(result).toHaveProperty('metadata')
        expect(result).toHaveProperty('vector')
        
        // Score should be normalized
        expect(result.score).toBeGreaterThan(0)
        expect(result.score).toBeLessThanOrEqual(1)
      })
    })
    
    it('should sort results by fusion score', async () => {
      const results = await db!.find({
        like: createTestVector(1)
      })
      
      // Results should be sorted by score (descending)
      for (let i = 1; i < results.length; i++) {
        expect(results[i-1].score).toBeGreaterThanOrEqual(results[i].score)
      }
    })
    
    it('should include match explanations when requested', async () => {
      const results = await db!.find({
        similar: 'test',
        where: {
          name: { $contains: 'Test' }
        },
        explain: true
      })
      
      results.forEach(result => {
        if (result.explanation) {
          expect(result.explanation).toHaveProperty('vectorMatch')
          expect(result.explanation).toHaveProperty('fieldMatch')
          expect(result.explanation).toHaveProperty('fusionScore')
        }
      })
    })
  })
})