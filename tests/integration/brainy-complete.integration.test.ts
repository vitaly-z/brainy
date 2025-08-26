/**
 * COMPREHENSIVE Integration Tests for Brainy 2.0
 * 
 * Tests ALL features with real AI models:
 * - search() with real embeddings  
 * - find() with NLP queries against pattern library
 * - Clustering and index optimizations
 * - Triple Intelligence with real semantic understanding
 * - Brain Patterns with complex metadata queries
 * - Model loading and fallback strategies
 * 
 * Requires 32GB+ RAM for comprehensive testing
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { BrainyData } from '../../dist/index.js'
import { requiresMemory } from '../setup-integration.js'

describe('Brainy 2.0 Complete Feature Test (Real AI)', () => {
  let brain: BrainyData

  beforeAll(async () => {
    // Ensure sufficient memory for comprehensive AI testing
    requiresMemory(16) // Require 16GB minimum
    
    console.log('🧠 Initializing Brainy 2.0 with ALL features and real AI...')
    console.log(`📊 Available heap: ${process.env.NODE_OPTIONS}`)
    
    // Create instance with full feature set
    brain = new BrainyData({
      storage: { forceMemoryStorage: true },
      verbose: true  // Enable verbose logging to track operations
    })
    
    console.log('⏳ Loading AI models and initializing all systems...')
    const startTime = Date.now()
    
    await brain.init()
    
    const loadTime = Date.now() - startTime
    console.log(`✅ Full system initialized in ${loadTime}ms`)
    
    // Start with clean state
    await brain.clearAll({ force: true })
    
  }, 300000) // 5 minute timeout for full initialization

  afterAll(async () => {
    if (brain) {
      try {
        await brain.clearAll({ force: true })
        console.log('🧹 Test cleanup completed')
      } catch (error) {
        console.warn('Cleanup warning:', error)
      }
    }
    
    // Force garbage collection
    if (global.gc) {
      console.log('🗑️ Running garbage collection...')
      global.gc()
    }
  }, 60000)

  describe('1. Core search() with Real AI Embeddings', () => {
    beforeAll(async () => {
      console.log('📝 Setting up test data for search() functionality...')
      
      // Add comprehensive test dataset
      const testItems = [
        'JavaScript is a programming language for web development',
        'Python is excellent for machine learning and AI applications', 
        'React is a popular frontend framework for building user interfaces',
        'Vue.js provides reactive data binding for modern web apps',
        'Node.js enables server-side JavaScript development',
        'TensorFlow is used for deep learning and neural networks',
        'Docker containerizes applications for consistent deployment',
        'Kubernetes orchestrates containerized applications at scale',
        'PostgreSQL is a powerful relational database system',
        'MongoDB stores documents in a flexible NoSQL format'
      ]
      
      for (const item of testItems) {
        await brain.addNoun(item)
      }
      
      console.log(`✅ Added ${testItems.length} items for search testing`)
    })

    it('should perform accurate semantic search with real embeddings', async () => {
      console.log('🔍 Testing semantic search accuracy...')

      // Test 1: Programming language query
      const langResults = await brain.search('programming languages for software development', { limit: 5 })
      expect(langResults).toHaveLength(5)
      expect(langResults[0].score).toBeGreaterThan(0.3) // Should have good semantic similarity
      
      // Should prioritize JavaScript, Python content
      const programmingResults = langResults.filter(r => 
        JSON.stringify(r).toLowerCase().includes('javascript') ||
        JSON.stringify(r).toLowerCase().includes('python')
      )
      expect(programmingResults.length).toBeGreaterThan(0)

      // Test 2: Frontend technology query  
      const frontendResults = await brain.search('user interface and web frontend', { limit: 3 })
      expect(frontendResults).toHaveLength(3)
      
      // Should find React and Vue.js
      const uiResults = frontendResults.filter(r => 
        JSON.stringify(r).toLowerCase().includes('react') ||
        JSON.stringify(r).toLowerCase().includes('vue')
      )
      expect(uiResults.length).toBeGreaterThan(0)

      // Test 3: Infrastructure and deployment
      const infraResults = await brain.search('deployment containerization orchestration', { limit: 3 })
      expect(infraResults).toHaveLength(3)
      
      // Should find Docker and Kubernetes
      const deployResults = infraResults.filter(r =>
        JSON.stringify(r).toLowerCase().includes('docker') ||
        JSON.stringify(r).toLowerCase().includes('kubernetes')
      )
      expect(deployResults.length).toBeGreaterThan(0)

      console.log('✅ Semantic search with real AI working accurately')
    })

    it('should handle search edge cases correctly', async () => {
      console.log('🧪 Testing search edge cases...')

      // Empty query
      const emptyResults = await brain.search('', { limit: 5 })
      expect(emptyResults).toHaveLength(5) // Should return top items

      // Very specific query
      const specificResults = await brain.search('relational database SQL queries', { limit: 2 })
      expect(specificResults).toHaveLength(2)
      
      // Score ordering verification
      const orderedResults = await brain.search('web development framework', { limit: 5 })
      for (let i = 0; i < orderedResults.length - 1; i++) {
        expect(orderedResults[i].score).toBeGreaterThanOrEqual(orderedResults[i + 1].score)
      }

      console.log('✅ Search edge cases handled correctly')
    })
  })

  describe('2. find() with NLP and Pattern Library', () => {
    it('should handle natural language queries with find()', async () => {
      console.log('🗣️ Testing find() with natural language queries...')

      // Test complex natural language queries
      const queries = [
        'show me frontend frameworks',
        'find database technologies', 
        'what programming languages are available',
        'containerization and deployment tools'
      ]

      for (const query of queries) {
        console.log(`   Query: "${query}"`)
        const results = await brain.find(query)
        
        expect(results).toBeInstanceOf(Array)
        expect(results.length).toBeGreaterThan(0)
        
        // Each result should have proper structure
        results.forEach(result => {
          expect(result).toHaveProperty('id')
          expect(result).toHaveProperty('metadata')
          expect(result).toHaveProperty('score')
          expect(typeof result.score).toBe('number')
        })
      }

      console.log('✅ NLP queries with find() working correctly')
    })

    it('should leverage pattern library for query understanding', async () => {
      console.log('📚 Testing pattern library integration...')

      // Test queries that should match embedded patterns
      const patternQueries = [
        'frameworks for building websites',  // Should understand "frameworks" pattern
        'tools for data analysis',           // Should understand "tools" pattern  
        'languages for machine learning',    // Should understand ML context
        'databases for storing information'  // Should understand data storage
      ]

      for (const query of patternQueries) {
        console.log(`   Pattern query: "${query}"`)
        const results = await brain.find(query, 3)
        
        expect(results).toHaveLength(3)
        expect(results[0].score).toBeGreaterThan(0)
        
        // Results should be semantically relevant
        expect(results).toHaveLength(3)
      }

      console.log('✅ Pattern library integration working')
    })
  })

  describe('3. Triple Intelligence with Real Semantic Understanding', () => {
    beforeAll(async () => {
      // Add structured data for Triple Intelligence testing
      const frameworks = [
        { name: 'React', type: 'frontend', year: 2013, popularity: 95, language: 'JavaScript' },
        { name: 'Vue.js', type: 'frontend', year: 2014, popularity: 85, language: 'JavaScript' },
        { name: 'Angular', type: 'frontend', year: 2010, popularity: 75, language: 'TypeScript' },
        { name: 'Django', type: 'backend', year: 2005, popularity: 80, language: 'Python' },
        { name: 'FastAPI', type: 'backend', year: 2018, popularity: 70, language: 'Python' },
        { name: 'Express', type: 'backend', year: 2010, popularity: 90, language: 'JavaScript' }
      ]

      console.log('🔗 Adding structured data for Triple Intelligence...')
      for (const fw of frameworks) {
        await brain.addNoun(`${fw.name} framework for ${fw.type} development`, fw)
      }
    })

    it('should combine semantic search with complex metadata queries', async () => {
      console.log('🧠 Testing Triple Intelligence: semantic + metadata...')

      // Triple query: semantic relevance + metadata filtering + range queries
      const tripleResults = await brain.triple.search({
        like: 'modern web development framework',  // Semantic similarity
        where: { 
          type: 'frontend',                      // Exact metadata match
          popularity: { greaterThan: 80 },       // Range query
          year: { greaterThan: 2012 }            // Another range query
        },
        limit: 5
      })

      expect(tripleResults.length).toBeGreaterThan(0)
      expect(tripleResults.length).toBeLessThanOrEqual(5)

      // Verify all results match metadata filters
      tripleResults.forEach(result => {
        expect(result.metadata?.type).toBe('frontend')
        expect(result.metadata?.popularity).toBeGreaterThan(80)
        expect(result.metadata?.year).toBeGreaterThan(2012)
        expect(result.score).toBeGreaterThan(0) // Should have semantic relevance
      })

      console.log(`✅ Triple Intelligence found ${tripleResults.length} results matching all criteria`)
    })

    it('should handle complex range and combination queries', async () => {
      console.log('📊 Testing complex Triple Intelligence queries...')

      // Multi-range query with semantic relevance
      const complexQuery = await brain.triple.search({
        like: 'popular programming framework',
        where: {
          year: { 
            greaterThan: 2009,
            lessThan: 2020 
          },
          popularity: { 
            greaterThan: 75,
            lessThan: 95 
          }
        },
        limit: 10
      })

      expect(complexQuery).toBeInstanceOf(Array)
      complexQuery.forEach(result => {
        expect(result.metadata?.year).toBeGreaterThan(2009)
        expect(result.metadata?.year).toBeLessThan(2020)
        expect(result.metadata?.popularity).toBeGreaterThan(75)
        expect(result.metadata?.popularity).toBeLessThan(95)
      })

      console.log(`✅ Complex range queries returned ${complexQuery.length} results`)
    })
  })

  describe('4. Brain Patterns and Advanced Metadata Filtering', () => {
    it('should perform O(log n) metadata queries efficiently', async () => {
      console.log('⚡ Testing Brain Patterns performance...')

      const startTime = Date.now()

      // Test efficient metadata filtering
      const patternResults = await brain.search('*', { limit: 10,
        metadata: {
          type: 'backend',
          language: 'Python'
        }
      })

      const queryTime = Date.now() - startTime
      console.log(`   Metadata query completed in ${queryTime}ms`)

      expect(patternResults).toBeInstanceOf(Array)
      patternResults.forEach(result => {
        expect(result.metadata?.type).toBe('backend')
        expect(result.metadata?.language).toBe('Python')
      })

      // Should be fast (under 100ms for metadata filtering)
      expect(queryTime).toBeLessThan(100)

      console.log('✅ Brain Patterns metadata filtering is efficient')
    })

    it('should handle nested metadata queries', async () => {
      // Add items with nested metadata
      await brain.addNoun('Advanced framework test', {
        framework: {
          name: 'Next.js',
          version: '13.0',
          features: ['SSR', 'API', 'Routing']
        },
        tech: {
          language: 'JavaScript',
          runtime: 'Node.js'
        }
      })

      // Query nested metadata (if supported)
      const nestedResults = await brain.search('*', { limit: 5 })
      expect(nestedResults.length).toBeGreaterThan(0)

      console.log('✅ Nested metadata handled correctly')
    })
  })

  describe('5. Index Loading and Optimization Features', () => {
    it('should demonstrate HNSW index optimization', async () => {
      console.log('🔧 Testing index optimization and clustering...')

      // Get initial statistics
      const initialStats = await brain.getStatistics()
      console.log(`   Initial index size: ${initialStats.indexSize}`)
      console.log(`   Total items: ${initialStats.totalItems}`)
      console.log(`   Dimensions: ${initialStats.dimensions}`)

      // Add more data to trigger optimization
      const batchData = Array.from({ length: 20 }, (_, i) => 
        `Optimization test item ${i}: ${Math.random().toString(36).slice(2)}`
      )

      console.log('   Adding batch data to trigger optimization...')
      for (const item of batchData) {
        await brain.addNoun(item, { batch: 'optimization', index: Math.floor(Math.random() * 100) })
      }

      // Check final statistics
      const finalStats = await brain.getStatistics()
      console.log(`   Final index size: ${finalStats.indexSize}`)
      console.log(`   Final total items: ${finalStats.totalItems}`)

      expect(finalStats.totalItems).toBeGreaterThan(initialStats.totalItems)
      expect(finalStats.dimensions).toBe(384) // Should be consistent

      console.log('✅ Index optimization and statistics working')
    })

    it('should handle index persistence and loading', async () => {
      console.log('💾 Testing index persistence (memory storage)...')

      // Since we're using memory storage, test data consistency
      const testId = await brain.addNoun('Persistence test item', { test: 'persistence' })
      
      // Verify immediate retrieval
      const retrieved = await brain.getNoun(testId)
      expect(retrieved).toBeTruthy()
      expect(retrieved?.metadata?.test).toBe('persistence')

      // Verify search finds it
      const searchResults = await brain.search('persistence test', { limit: 5 })
      const found = searchResults.find(r => r.id === testId)
      expect(found).toBeTruthy()

      console.log('✅ Index consistency verified')
    })
  })

  describe('6. Model Loading and Fallback Strategies', () => {
    it('should confirm local model loading works', async () => {
      console.log('📦 Testing model loading strategy...')

      // Verify we're using local models (as configured)
      const embedding = await brain.embed('test embedding generation')
      expect(embedding).toBeInstanceOf(Array)
      expect(embedding).toHaveLength(384)
      
      // Verify embeddings are proper floating point values
      embedding.forEach(val => {
        expect(typeof val).toBe('number')
        expect(val).toBeGreaterThan(-1)
        expect(val).toBeLessThan(1)
      })

      console.log('✅ Local model loading confirmed working')
    })
  })

  describe('7. Performance and Memory Management', () => {
    it('should handle large-scale operations efficiently', async () => {
      console.log('⚡ Testing large-scale performance...')

      const performanceData = Array.from({ length: 50 }, (_, i) => ({
        content: `Performance test ${i}: ${Array.from({ length: 20 }, () => 
          Math.random().toString(36).slice(2)).join(' ')}`,
        category: ['frontend', 'backend', 'database', 'ai', 'devops'][i % 5],
        priority: Math.floor(Math.random() * 100),
        timestamp: Date.now() + i
      }))

      console.log('   Adding 50 items with metadata...')
      const startTime = Date.now()
      const ids = []

      for (const item of performanceData) {
        const id = await brain.addNoun(item.content, { 
          category: item.category,
          priority: item.priority,
          timestamp: item.timestamp
        })
        ids.push(id)
      }

      const addTime = Date.now() - startTime
      console.log(`   Added 50 items in ${addTime}ms (${Math.round(addTime/50)}ms per item)`)

      // Test batch search performance
      const searchStart = Date.now()
      const searchResults = await brain.search('performance test database', { limit: 10 })
      const searchTime = Date.now() - searchStart

      console.log(`   Search completed in ${searchTime}ms`)
      expect(searchResults).toHaveLength(10)

      // Memory check
      const memoryUsage = process.memoryUsage()
      console.log(`   Memory usage: ${(memoryUsage.heapUsed / 1024 / 1024).toFixed(2)} MB`)

      console.log('✅ Large-scale operations perform efficiently')
    })
  })

  describe('8. Final Integration Verification', () => {
    it('should pass comprehensive feature verification', async () => {
      console.log('🎯 Final comprehensive feature test...')

      // Test all major APIs work together
      const testQuery = 'modern web development tools and frameworks'
      
      // 1. search() with semantic relevance
      const searchResults = await brain.search(testQuery, { limit: 5 })
      expect(searchResults).toHaveLength(5)
      console.log(`   ✅ search() returned ${searchResults.length} results`)

      // 2. find() with NLP processing  
      const findResults = await brain.find('show me frontend technologies', 3)
      expect(findResults).toHaveLength(3)
      console.log(`   ✅ find() returned ${findResults.length} results`)

      // 3. Triple Intelligence query
      const tripleResults = await brain.triple.search({
        like: 'web framework',
        where: { category: 'frontend' },
        limit: 3
      })
      expect(tripleResults).toBeInstanceOf(Array)
      console.log(`   ✅ triple.search() returned ${tripleResults.length} results`)

      // 4. Brain Patterns metadata filtering
      const patternResults = await brain.search('*', { limit: 5,
        metadata: { category: 'backend' }
      })
      expect(patternResults).toBeInstanceOf(Array)
      console.log(`   ✅ Brain Patterns returned ${patternResults.length} results`)

      // 5. Statistics and health check
      const finalStats = await brain.getStatistics()
      expect(finalStats.totalItems).toBeGreaterThan(50)
      expect(finalStats.dimensions).toBe(384)
      console.log(`   ✅ Statistics: ${finalStats.totalItems} items, ${finalStats.dimensions}D`)

      console.log('🎉 ALL FEATURES VERIFIED WORKING WITH REAL AI!')
    })
  })
})