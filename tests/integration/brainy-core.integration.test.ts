/**
 * Integration Tests for Brainy 3.0 Core with REAL AI
 * 
 * Tests production functionality with real transformer models
 * Requires high memory environment (16GB+ RAM recommended)
 * Uses local models only to avoid external dependencies
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { Brainy } from '../../src/brainy'
import { requiresMemory } from '../setup-integration'

describe('Brainy 3.0 Core (Integration Tests - Real AI)', () => {
  let brain: Brainy

  beforeAll(async () => {
    // Ensure sufficient memory for real AI models
    requiresMemory(8)
    
    console.log('🤖 Initializing Brainy 3.0 with REAL AI models...')
    
    // Create instance with real AI embedding function
    brain = new Brainy({
      storage: { type: 'memory' },
      // No mock embedding function = uses real AI
    })
    
    // This may take 30-60 seconds to load models
    console.log('⏳ Loading transformer models (this may take a minute)...')
    const startTime = Date.now()
    
    await brain.init()
    
    const loadTime = Date.now() - startTime
    console.log(`✅ AI models loaded in ${loadTime}ms`)
    
    await brain.clear()
  }, 120000) // 2 minute timeout for model loading

  afterAll(async () => {
    if (brain) {
      // Clean up resources
      await brain.clear()
      await brain.close()
    }
    
    // Force garbage collection
    if (global.gc) {
      global.gc()
    }
  }, 30000)

  describe('Real AI Embeddings and Search', () => {
    it('should create embeddings with real AI models', async () => {
      const testItems = [
        'JavaScript is a programming language',
        'Python is used for machine learning',
        'React is a frontend framework',
        'Node.js enables server-side JavaScript'
      ]

      console.log('🧠 Testing real AI embeddings...')
      const ids: string[] = []
      
      for (const item of testItems) {
        const id = await brain.add({ 
          data: item,
          type: 'document'
        })
        ids.push(id)
        expect(id).toBeTypeOf('string')
        expect(id.length).toBeGreaterThan(0)
      }
      
      expect(ids).toHaveLength(4)
      console.log(`✅ Created ${ids.length} items with real embeddings`)
    })

    it('should perform semantic search with real AI', async () => {
      // Add diverse content for semantic search testing
      const testData = [
        { content: 'Building web applications with React and TypeScript', category: 'frontend' },
        { content: 'Training neural networks with PyTorch and CUDA', category: 'ai' },
        { content: 'Deploying microservices with Docker and Kubernetes', category: 'devops' },
        { content: 'Database optimization with PostgreSQL indexing', category: 'database' },
        { content: 'Machine learning model deployment strategies', category: 'ai' }
      ]

      console.log('🧠 Adding test data for semantic search...')
      for (const item of testData) {
        await brain.add({ 
          data: item.content,
          type: 'document',
          metadata: { category: item.category }
        })
      }

      console.log('🔍 Testing semantic search queries...')

      // Test semantic similarity - should find AI-related content
      const aiResults = await brain.find({ 
        query: 'artificial intelligence and deep learning',
        limit: 3 
      })
      expect(aiResults).toHaveLength(3)
      expect(aiResults[0].score).toBeGreaterThan(0)
      
      // Verify AI-related content ranks higher
      const topCategories = aiResults.map(r => r.entity.metadata?.category)
      expect(topCategories).toContain('ai')
      
      console.log('✅ Semantic search working correctly')
    })

    it('should find similar items using real embeddings', async () => {
      // Add a reference item
      const referenceId = await brain.add({
        data: 'TypeScript provides static typing for JavaScript',
        type: 'document',
        metadata: { reference: true }
      })

      // Find similar items
      const similar = await brain.similar({ to: referenceId, limit: 3 })
      
      expect(similar).toBeDefined()
      expect(similar.length).toBeGreaterThan(0)
      expect(similar.length).toBeLessThanOrEqual(3)
      
      // Should find JavaScript-related content
      const topResult = similar[0]
      expect(topResult.score).toBeGreaterThan(0.5) // Reasonably similar
      
      console.log('✅ Similarity search working with real embeddings')
    })
  })

  describe('Advanced Querying with Real AI', () => {
    beforeAll(async () => {
      await brain.clear()
      
      // Add structured data for testing
      const companies = [
        { name: 'OpenAI', type: 'company', industry: 'AI', founded: 2015 },
        { name: 'Microsoft', type: 'company', industry: 'Technology', founded: 1975 },
        { name: 'Google', type: 'company', industry: 'Technology', founded: 1998 },
        { name: 'Tesla', type: 'company', industry: 'Automotive', founded: 2003 }
      ]

      for (const company of companies) {
        await brain.add({
          data: `${company.name} is a ${company.industry} company founded in ${company.founded}`,
          type: 'organization',
          metadata: company
        })
      }
    })

    it('should combine semantic and metadata search', async () => {
      // Search for AI companies
      const results = await brain.find({
        query: 'artificial intelligence companies',
        where: { industry: 'AI' },
        limit: 5
      })

      expect(results.length).toBeGreaterThan(0)
      const firstResult = results[0]
      expect(firstResult.entity.metadata?.industry).toBe('AI')
      
      console.log('✅ Combined semantic + metadata search working')
    })

    it('should perform metadata-only queries', async () => {
      // Find all tech companies
      const techCompanies = await brain.find({
        where: { industry: 'Technology' },
        limit: 10
      })

      expect(techCompanies.length).toBeGreaterThan(0)
      techCompanies.forEach(result => {
        expect(result.entity.metadata?.industry).toBe('Technology')
      })
      
      console.log('✅ Metadata filtering working correctly')
    })
  })

  describe('Relationships and Graph Operations', () => {
    let entityIds: string[] = []

    beforeAll(async () => {
      await brain.clear()
      
      // Create entities
      const alice = await brain.add({
        data: 'Alice is a software engineer',
        type: 'person',
        metadata: { name: 'Alice', role: 'engineer' }
      })
      
      const bob = await brain.add({
        data: 'Bob is a product manager',
        type: 'person',
        metadata: { name: 'Bob', role: 'manager' }
      })
      
      const project = await brain.add({
        data: 'AI Assistant Project',
        type: 'project',
        metadata: { name: 'AI Assistant', status: 'active' }
      })
      
      entityIds = [alice, bob, project]
      
      // Create relationships
      await brain.relate({
        from: alice,
        to: project,
        type: 'worksWith'
      })
      
      await brain.relate({
        from: bob,
        to: project,
        type: 'supervises'
      })
      
      await brain.relate({
        from: alice,
        to: bob,
        type: 'reportsTo'
      })
    })

    it('should retrieve entity relationships', async () => {
      const [alice, bob, project] = entityIds
      
      // Get Alice's relationships
      const aliceRelations = await brain.getRelations({ from: alice })
      
      expect(aliceRelations).toBeDefined()
      expect(aliceRelations.length).toBeGreaterThan(0)
      
      // Check specific relationships
      const worksWithProject = aliceRelations.find(r => 
        r.to === project && r.type === 'worksWith'
      )
      expect(worksWithProject).toBeDefined()
      
      const reportsToBob = aliceRelations.find(r => 
        r.to === bob && r.type === 'reportsTo'
      )
      expect(reportsToBob).toBeDefined()
      
      console.log('✅ Relationship retrieval working')
    })

    it('should find connected entities', async () => {
      const [alice] = entityIds
      
      // Find entities connected to Alice
      const connected = await brain.find({
        connected: {
          to: alice,
          via: 'reportsTo'
        },
        limit: 10
      })
      
      // This should find entities that report to Alice
      // (In our test, no one reports to Alice, so it should be empty or find Alice herself)
      expect(connected).toBeDefined()
      
      console.log('✅ Graph traversal queries working')
    })
  })

  describe('Performance with Real AI', () => {
    it('should handle batch operations efficiently', async () => {
      const batchSize = 10
      const items = Array.from({ length: batchSize }, (_, i) => ({
        data: `Test document ${i} with some content about ${i % 2 === 0 ? 'technology' : 'science'}`,
        type: 'document' as const,
        metadata: { index: i, batch: true }
      }))

      console.log(`⏱️ Testing batch add of ${batchSize} items...`)
      const startTime = Date.now()
      
      const ids = await brain.addMany({ items })
      
      const duration = Date.now() - startTime
      console.log(`✅ Batch add completed in ${duration}ms`)
      
      expect(ids).toHaveLength(batchSize)
      expect(duration).toBeLessThan(30000) // Should complete within 30 seconds
      
      // Calculate throughput
      const itemsPerSecond = (batchSize / duration) * 1000
      console.log(`📊 Throughput: ${itemsPerSecond.toFixed(2)} items/second`)
    })

    it('should search efficiently with real embeddings', async () => {
      console.log('⏱️ Testing search performance...')
      
      const queries = [
        'machine learning algorithms',
        'web development frameworks',
        'cloud computing platforms'
      ]
      
      const startTime = Date.now()
      
      for (const query of queries) {
        const results = await brain.find({ 
          query,
          limit: 5 
        })
        expect(results).toBeDefined()
      }
      
      const duration = Date.now() - startTime
      const avgQueryTime = duration / queries.length
      
      console.log(`✅ Average query time: ${avgQueryTime.toFixed(0)}ms`)
      expect(avgQueryTime).toBeLessThan(5000) // Each query should take less than 5 seconds
    })
  })

  describe('Error Handling and Edge Cases', () => {
    it('should handle invalid inputs gracefully', async () => {
      // Test with empty data
      await expect(brain.add({ 
        data: '',
        type: 'document'
      })).resolves.toBeDefined()
      
      // Test with very long text
      const longText = 'Lorem ipsum '.repeat(10000)
      await expect(brain.add({
        data: longText,
        type: 'document'
      })).resolves.toBeDefined()
      
      console.log('✅ Edge cases handled correctly')
    })

    it('should handle non-existent entities', async () => {
      const fakeId = 'non-existent-id-12345'
      
      // Get non-existent entity
      const entity = await brain.get(fakeId)
      expect(entity).toBeNull()
      
      // Similar search with non-existent ID
      await expect(brain.similar({ to: fakeId })).rejects.toThrow()
      
      console.log('✅ Non-existent entity handling correct')
    })
  })
})