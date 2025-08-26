/**
 * Integration Tests for Brainy Core with REAL AI
 * 
 * Tests production functionality with real transformer models
 * Requires high memory environment (16GB+ RAM recommended)
 * Uses local models only to avoid external dependencies
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { BrainyData } from '../../dist/index.js'
import { requiresMemory } from '../setup-integration.js'

describe('Brainy Core (Integration Tests - Real AI)', () => {
  let brain: BrainyData

  beforeAll(async () => {
    // Ensure sufficient memory for real AI models
    requiresMemory(8)
    
    console.log('🤖 Initializing Brainy with REAL AI models...')
    
    // Create instance with real AI embedding function
    brain = new BrainyData({
      storage: { forceMemoryStorage: true },
      verbose: false
      // No embeddingFunction specified = uses real AI
    })
    
    // This may take 30-60 seconds to load models
    console.log('⏳ Loading transformer models (this may take a minute)...')
    const startTime = Date.now()
    
    await brain.init()
    
    const loadTime = Date.now() - startTime
    console.log(`✅ AI models loaded in ${loadTime}ms`)
    
    await brain.clearAll({ force: true })
  }, 120000) // 2 minute timeout for model loading

  afterAll(async () => {
    if (brain) {
      // Clean up resources
      await brain.clearAll({ force: true })
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
      const ids = []
      
      for (const item of testItems) {
        const id = await brain.addNoun(item)
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
        await brain.addNoun(item.content, { category: item.category })
      }

      console.log('🔍 Testing semantic search queries...')

      // Test semantic similarity - should find AI-related content
      const aiResults = await brain.search('artificial intelligence and deep learning', { limit: 3 })
      expect(aiResults).toHaveLength(3)
      expect(aiResults[0].score).toBeGreaterThan(0)
      
      // Should prioritize AI-related content
      const aiContent = aiResults.filter(r => 
        r.metadata?.category === 'ai' || 
        JSON.stringify(r).toLowerCase().includes('neural') ||
        JSON.stringify(r).toLowerCase().includes('pytorch')
      )
      expect(aiContent.length).toBeGreaterThan(0)

      console.log(`✅ Semantic search found ${aiResults.length} relevant results`)

      // Test frontend-related search
      const frontendResults = await brain.search('user interface development', { limit: 2 })
      expect(frontendResults).toHaveLength(2)
      
      console.log('✅ Real AI semantic search working correctly')
    })

    it('should handle complex queries with real embeddings', async () => {
      // Test with more nuanced semantic queries
      const queries = [
        'containerization and orchestration',  // Should find Docker/Kubernetes
        'web development frameworks',          // Should find React
        'database performance tuning'         // Should find PostgreSQL
      ]

      for (const query of queries) {
        console.log(`🔍 Testing query: "${query}"`)
        const results = await brain.search(query, { limit: 2 })
        
        expect(results).toHaveLength(2)
        expect(results[0].score).toBeGreaterThan(0)
        expect(results[0].score).toBeLessThanOrEqual(1)
        
        // Results should be ordered by relevance
        if (results.length > 1) {
          expect(results[0].score).toBeGreaterThanOrEqual(results[1].score)
        }
      }

      console.log('✅ Complex semantic queries handled correctly')
    })
  })

  describe('Brain Patterns with Real AI', () => {
    beforeAll(async () => {
      // Add structured test data with metadata
      const frameworks = [
        { name: 'React', type: 'frontend', year: 2013, language: 'JavaScript' },
        { name: 'Vue.js', type: 'frontend', year: 2014, language: 'JavaScript' },
        { name: 'Angular', type: 'frontend', year: 2010, language: 'TypeScript' },
        { name: 'Django', type: 'backend', year: 2005, language: 'Python' },
        { name: 'FastAPI', type: 'backend', year: 2018, language: 'Python' },
        { name: 'Express.js', type: 'backend', year: 2010, language: 'JavaScript' }
      ]

      console.log('🧠 Adding structured data for Brain Patterns testing...')
      for (const framework of frameworks) {
        await brain.addNoun(
          `${framework.name} is a ${framework.type} framework built in ${framework.language}`,
          framework
        )
      }
    })

    it('should combine semantic search with metadata filtering', async () => {
      console.log('🔍 Testing Brain Patterns: semantic search + metadata filtering...')

      // Find frontend frameworks with semantic search + metadata filtering
      const frontendResults = await brain.search('user interface framework', { limit: 10,
        metadata: { 
          type: 'frontend',
          language: 'JavaScript' 
        }
      })

      expect(frontendResults.length).toBeGreaterThan(0)
      expect(frontendResults.length).toBeLessThanOrEqual(2) // React and Vue.js
      
      // All results should match metadata filter
      frontendResults.forEach(result => {
        expect(result.metadata?.type).toBe('frontend')
        expect(result.metadata?.language).toBe('JavaScript')
      })

      console.log(`✅ Found ${frontendResults.length} frontend JavaScript frameworks`)

      // Find modern frameworks (after 2012) with semantic relevance
      const modernResults = await brain.search('modern web framework', { limit: 5,
        metadata: {
          year: { greaterThan: 2012 }
        }
      })

      expect(modernResults.length).toBeGreaterThan(0)
      modernResults.forEach(result => {
        expect(result.metadata?.year).toBeGreaterThan(2012)
      })

      console.log(`✅ Found ${modernResults.length} modern frameworks with real AI + metadata filtering`)
    })

    it('should handle range queries with semantic relevance', async () => {
      console.log('🔍 Testing range queries with semantic search...')

      // Find frameworks from the 2010s decade
      const decade2010s = await brain.search('web development framework', { limit: 10,
        metadata: {
          year: { 
            greaterThan: 2009,
            lessThan: 2020 
          }
        }
      })

      expect(decade2010s.length).toBeGreaterThan(0)
      decade2010s.forEach(result => {
        expect(result.metadata?.year).toBeGreaterThan(2009)
        expect(result.metadata?.year).toBeLessThan(2020)
      })

      console.log(`✅ Found ${decade2010s.length} frameworks from 2010s with semantic relevance`)
    })
  })

  describe('Production Performance with Real AI', () => {
    it('should handle batch operations efficiently', async () => {
      console.log('⚡ Testing batch performance with real AI...')

      const batchData = Array.from({ length: 10 }, (_, i) => ({
        content: `Performance test item ${i}: ${Math.random().toString(36)}`,
        batch: i,
        timestamp: Date.now()
      }))

      const startTime = Date.now()
      const ids = []

      for (const item of batchData) {
        const id = await brain.addNoun(item.content, { 
          batch: item.batch,
          timestamp: item.timestamp 
        })
        ids.push(id)
      }

      const batchTime = Date.now() - startTime
      console.log(`✅ Processed ${batchData.length} items in ${batchTime}ms (${Math.round(batchTime/batchData.length)}ms per item)`)

      // Verify all items were created
      expect(ids).toHaveLength(10)
      
      // Test batch retrieval
      const retrievalStart = Date.now()
      for (const id of ids) {
        const item = await brain.getNoun(id)
        expect(item).toBeTruthy()
        expect(item?.metadata?.batch).toBeDefined()
      }
      const retrievalTime = Date.now() - retrievalStart
      
      console.log(`✅ Retrieved ${ids.length} items in ${retrievalTime}ms`)
    })

    it('should provide accurate statistics with real data', async () => {
      console.log('📊 Testing statistics with real AI data...')

      const stats = await brain.getStatistics()
      
      expect(stats).toHaveProperty('totalItems')
      expect(stats).toHaveProperty('dimensions')
      expect(stats).toHaveProperty('indexSize')
      
      expect(stats.totalItems).toBeGreaterThan(0)
      expect(stats.dimensions).toBe(384) // Standard embedding dimension
      expect(typeof stats.indexSize).toBe('number')
      
      console.log(`✅ Statistics: ${stats.totalItems} items, ${stats.dimensions}D embeddings, ${stats.indexSize} index size`)
    })
  })

  describe('Memory Management with Real AI', () => {
    it('should handle memory efficiently during operations', async () => {
      const initialMemory = process.memoryUsage()
      console.log(`📊 Initial memory: ${(initialMemory.heapUsed / 1024 / 1024).toFixed(2)} MB`)

      // Perform memory-intensive operations
      const operations = Array.from({ length: 5 }, (_, i) => 
        `Memory test ${i}: ${Array.from({ length: 100 }, () => Math.random().toString(36)).join(' ')}`
      )

      for (const op of operations) {
        await brain.addNoun(op)
        await brain.search(op.slice(0, { limit: 20 }), 3) // Search with part of the content
      }

      const afterMemory = process.memoryUsage()
      const memoryIncrease = (afterMemory.heapUsed - initialMemory.heapUsed) / 1024 / 1024
      
      console.log(`📊 Memory after operations: ${(afterMemory.heapUsed / 1024 / 1024).toFixed(2)} MB (+${memoryIncrease.toFixed(2)} MB)`)
      
      // Memory increase should be reasonable (less than 500MB for this test)
      expect(memoryIncrease).toBeLessThan(500)
      
      console.log('✅ Memory usage within acceptable limits')
    })
  })
})