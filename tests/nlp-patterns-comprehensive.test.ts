import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { BrainyData } from '../src/index.js'
import { EMBEDDED_PATTERNS } from '../src/neural/embeddedPatterns.js'

describe('🧠 NLP Pattern Matching - 220 Embedded Patterns', () => {
  let db: BrainyData | null = null
  
  // Helper to create test vectors
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
  
  describe('Pattern System Validation', () => {
    it('should have 220 embedded patterns loaded', () => {
      expect(EMBEDDED_PATTERNS).toBeDefined()
      expect(Array.isArray(EMBEDDED_PATTERNS)).toBe(true)
      expect(EMBEDDED_PATTERNS.length).toBe(220)
      
      // Each pattern should have required structure
      EMBEDDED_PATTERNS.forEach(pattern => {
        expect(pattern).toHaveProperty('id')
        expect(pattern).toHaveProperty('category')
        expect(pattern).toHaveProperty('pattern')
        expect(pattern).toHaveProperty('template')
        expect(pattern).toHaveProperty('confidence')
        expect(pattern).toHaveProperty('examples')
        
        expect(pattern.confidence).toBeGreaterThan(0.5)
        expect(Array.isArray(pattern.examples)).toBe(true)
      })
    })
    
    it('should cover major query categories', () => {
      const categories = [...new Set(EMBEDDED_PATTERNS.map(p => p.category))]
      
      // Should have key categories
      expect(categories).toContain('research')
      expect(categories).toContain('academic')
      expect(categories).toContain('people')
      expect(categories).toContain('projects')
      expect(categories).toContain('aggregation')
      expect(categories).toContain('comparison')
      expect(categories).toContain('temporal')
      
      // Should have substantial coverage
      expect(categories.length).toBeGreaterThan(15)
    })
  })
  
  describe('Academic Research Patterns', () => {
    beforeEach(async () => {
      db = new BrainyData()
      await db.init()
      
      // Add academic data
      await db.addNoun(createTestVector(1), {
        id: 'paper1',
        title: 'AI Safety Research',
        type: 'academic',
        category: 'research',
        subject: 'artificial intelligence'
      })
      
      await db.addNoun(createTestVector(2), {
        id: 'paper2', 
        title: 'Climate Change Studies',
        type: 'academic',
        category: 'research',
        subject: 'climate'
      })
      
      await db.addNoun(createTestVector(3), {
        id: 'paper3',
        title: 'COVID-19 Analysis',
        type: 'academic', 
        category: 'research',
        subject: 'medical'
      })
    })
    
    it('should match "research on X" pattern', async () => {
      const results = await db!.find('research on AI safety')
      
      expect(Array.isArray(results)).toBe(true)
      expect(results.length).toBeGreaterThan(0)
      
      // Should find AI safety paper
      const ids = results.map(r => r.id)
      expect(ids).toContain('paper1')
    })
    
    it('should match "papers about X" pattern', async () => {
      const results = await db!.find('papers about climate change')
      
      // Should find climate paper
      const ids = results.map(r => r.id)
      expect(ids).toContain('paper2')
    })
    
    it('should match "studies on X" pattern', async () => {
      const results = await db!.find('studies on COVID')
      
      // Should find COVID paper
      const ids = results.map(r => r.id)
      expect(ids).toContain('paper3')
    })
  })
  
  describe('People and Expertise Patterns', () => {
    beforeEach(async () => {
      db = new BrainyData()
      await db.init()
      
      // Add people data
      await db.addNoun(createTestVector(1), {
        id: 'alice',
        name: 'Alice Johnson',
        type: 'person',
        role: 'researcher',
        expertise: ['machine learning', 'neural networks']
      })
      
      await db.addNoun(createTestVector(2), {
        id: 'bob',
        name: 'Bob Smith', 
        type: 'person',
        role: 'developer',
        expertise: ['javascript', 'react']
      })
      
      await db.addNoun(createTestVector(3), {
        id: 'charlie',
        name: 'Charlie Brown',
        type: 'person',
        role: 'manager',
        team: 'engineering'
      })
    })
    
    it('should match "who is X" pattern', async () => {
      const results = await db!.find('who is Alice')
      
      // Should find Alice
      const ids = results.map(r => r.id)
      expect(ids).toContain('alice')
    })
    
    it('should match "find people who X" pattern', async () => {
      const results = await db!.find('find people who work with machine learning')
      
      // Should find Alice (ML expert)
      const ids = results.map(r => r.id)
      expect(ids).toContain('alice')
    })
    
    it('should match "experts in X" pattern', async () => {
      const results = await db!.find('experts in javascript')
      
      // Should find Bob (JS expert)
      const ids = results.map(r => r.id)
      expect(ids).toContain('bob')
    })
  })
  
  describe('Project and Organization Patterns', () => {
    beforeEach(async () => {
      db = new BrainyData()
      await db.init()
      
      // Add project data
      await db.addNoun(createTestVector(1), {
        id: 'project1',
        name: 'Web Application',
        type: 'project',
        status: 'active',
        tech: ['react', 'nodejs']
      })
      
      await db.addNoun(createTestVector(2), {
        id: 'project2',
        name: 'Mobile App',
        type: 'project', 
        status: 'completed',
        tech: ['react-native', 'typescript']
      })
      
      await db.addNoun(createTestVector(3), {
        id: 'company1',
        name: 'TechCorp',
        type: 'organization',
        industry: 'technology'
      })
    })
    
    it('should match "projects using X" pattern', async () => {
      const results = await db!.find('projects using react')
      
      // Should find projects using React
      const ids = results.map(r => r.id)
      expect(ids).toContain('project1')
    })
    
    it('should match "active projects" pattern', async () => {
      const results = await db!.find('active projects')
      
      // Should find active projects
      const ids = results.map(r => r.id) 
      expect(ids).toContain('project1')
      expect(ids).not.toContain('project2') // Completed
    })
    
    it('should match "companies in X industry" pattern', async () => {
      const results = await db!.find('companies in technology')
      
      // Should find tech company
      const ids = results.map(r => r.id)
      expect(ids).toContain('company1')
    })
  })
  
  describe('Aggregation and Counting Patterns', () => {
    beforeEach(async () => {
      db = new BrainyData()
      await db.init()
      
      // Add countable data
      for (let i = 0; i < 10; i++) {
        await db.addNoun(createTestVector(i), {
          id: `item${i}`,
          type: 'dataset',
          category: i < 5 ? 'ml' : 'web'
        })
      }
    })
    
    it('should match "count X" pattern', async () => {
      const results = await db!.find('count datasets')
      
      // Should find all datasets
      expect(results.length).toBeGreaterThan(0)
    })
    
    it('should match "how many X" pattern', async () => {
      const results = await db!.find('how many ML datasets')
      
      // Should find ML datasets
      expect(results.length).toBeGreaterThan(0)
      
      // Should prioritize ML category
      const hasML = results.some(r => r.metadata?.category === 'ml')
      expect(hasML).toBe(true)
    })
    
    it('should match "number of X" pattern', async () => {
      const results = await db!.find('number of web datasets')
      
      // Should find web datasets
      const webItems = results.filter(r => r.metadata?.category === 'web')
      expect(webItems.length).toBeGreaterThan(0)
    })
  })
  
  describe('Comparison and Ranking Patterns', () => {
    beforeEach(async () => {
      db = new BrainyData()
      await db.init()
      
      // Add comparable data
      await db.addNoun(createTestVector(1), {
        id: 'model1',
        name: 'GPT-4',
        type: 'model',
        performance: 95,
        category: 'large'
      })
      
      await db.addNoun(createTestVector(2), {
        id: 'model2',
        name: 'BERT',
        type: 'model',
        performance: 85,
        category: 'medium'
      })
      
      await db.addNoun(createTestVector(3), {
        id: 'model3',
        name: 'DistilBERT', 
        type: 'model',
        performance: 80,
        category: 'small'
      })
    })
    
    it('should match "best X" pattern', async () => {
      const results = await db!.find('best performing model')
      
      // Should prioritize high performance
      expect(results.length).toBeGreaterThan(0)
      
      // GPT-4 should be highly ranked
      const topResult = results[0]
      expect(topResult.id).toBe('model1')
    })
    
    it('should match "compare X and Y" pattern', async () => {
      const results = await db!.find('compare GPT-4 and BERT')
      
      // Should find both models
      const ids = results.map(r => r.id)
      expect(ids).toContain('model1')
      expect(ids).toContain('model2')
    })
    
    it('should match "largest X" pattern', async () => {
      const results = await db!.find('largest models')
      
      // Should prioritize large category
      const hasLarge = results.some(r => r.metadata?.category === 'large')
      expect(hasLarge).toBe(true)
    })
  })
  
  describe('Temporal and Recent Patterns', () => {
    beforeEach(async () => {
      db = new BrainyData()
      await db.init()
      
      const now = Date.now()
      
      // Add temporal data
      await db.addNoun(createTestVector(1), {
        id: 'recent1',
        title: 'Recent Study',
        type: 'paper',
        publishDate: now - 86400000, // 1 day ago
        status: 'recent'
      })
      
      await db.addNoun(createTestVector(2), {
        id: 'old1',
        title: 'Old Study',
        type: 'paper', 
        publishDate: now - 31536000000, // 1 year ago
        status: 'archive'
      })
    })
    
    it('should match "recent X" pattern', async () => {
      const results = await db!.find('recent studies')
      
      // Should find recent study
      const ids = results.map(r => r.id)
      expect(ids).toContain('recent1')
    })
    
    it('should match "latest X" pattern', async () => {
      const results = await db!.find('latest papers')
      
      // Should prioritize recent papers
      expect(results.length).toBeGreaterThan(0)
      
      // Recent should be ranked higher than old
      if (results.length > 1) {
        const recentIndex = results.findIndex(r => r.id === 'recent1')
        const oldIndex = results.findIndex(r => r.id === 'old1')
        
        if (recentIndex !== -1 && oldIndex !== -1) {
          expect(recentIndex).toBeLessThan(oldIndex)
        }
      }
    })
  })
  
  describe('Complex Pattern Integration', () => {
    beforeEach(async () => {
      db = new BrainyData()
      await db.init()
      
      // Rich integrated dataset
      await db.addNoun(createTestVector(1), {
        id: 'researcher1',
        name: 'Dr. Alice',
        type: 'person',
        role: 'researcher',
        expertise: ['AI', 'machine learning'],
        publications: 25,
        h_index: 15
      })
      
      await db.addNoun(createTestVector(2), {
        id: 'paper1',
        title: 'Advanced AI Safety',
        type: 'paper',
        authors: ['Dr. Alice'],
        citations: 150,
        year: 2023,
        category: 'AI safety'
      })
      
      await db.addNoun(createTestVector(3), {
        id: 'lab1',
        name: 'AI Research Lab',
        type: 'organization',
        focus: ['artificial intelligence', 'safety'],
        members: 20
      })
    })
    
    it('should handle multi-part queries', async () => {
      const results = await db!.find('find AI researchers with high h-index who published recently')
      
      // Should find Dr. Alice (AI researcher, high h-index)
      const ids = results.map(r => r.id)
      expect(ids).toContain('researcher1')
    })
    
    it('should combine semantic similarity with pattern matching', async () => {
      const results = await db!.find('most cited papers about artificial intelligence safety')
      
      // Should find AI safety paper with high citations
      const ids = results.map(r => r.id)
      expect(ids).toContain('paper1')
      
      // Should be ranked highly due to citations
      const paper = results.find(r => r.id === 'paper1')
      expect(paper?.score).toBeGreaterThan(0.5)
    })
    
    it('should handle organizational queries', async () => {
      const results = await db!.find('research labs working on AI safety')
      
      // Should find AI research lab
      const ids = results.map(r => r.id)
      expect(ids).toContain('lab1')
    })
  })
  
  describe('Pattern Performance and Reliability', () => {
    it('should process patterns quickly', async () => {
      db = new BrainyData()
      await db.init()
      
      // Add some data
      for (let i = 0; i < 50; i++) {
        await db.addNoun(createTestVector(i), {
          id: `test${i}`,
          type: 'test',
          value: i
        })
      }
      
      const start = performance.now()
      await db.find('find test data with high values')
      const elapsed = performance.now() - start
      
      // Pattern matching should be fast (< 100ms)
      expect(elapsed).toBeLessThan(100)
    })
    
    it('should handle edge cases gracefully', async () => {
      db = new BrainyData()
      await db.init()
      
      // Empty queries
      const empty = await db.find('')
      expect(Array.isArray(empty)).toBe(true)
      
      // Very long queries
      const longQuery = 'find ' + 'very '.repeat(100) + 'specific data'
      const long = await db.find(longQuery)
      expect(Array.isArray(long)).toBe(true)
      
      // Special characters
      const special = await db.find('find data with @#$%^&*(){}[]')
      expect(Array.isArray(special)).toBe(true)
    })
    
    it('should maintain high pattern matching accuracy', async () => {
      db = new BrainyData()
      await db.init()
      
      // Add targeted data
      await db.addNoun(createTestVector(1), {
        id: 'target',
        name: 'Machine Learning Research',
        type: 'research',
        topic: 'ML'
      })
      
      await db.addNoun(createTestVector(2), {
        id: 'distractor',
        name: 'Cooking Recipe',
        type: 'recipe',
        topic: 'food'
      })
      
      const results = await db.find('research on machine learning')
      
      // Should find target, not distractor
      const ids = results.map(r => r.id)
      expect(ids).toContain('target')
      
      // Target should be top result
      expect(results[0]?.id).toBe('target')
    })
  })
})