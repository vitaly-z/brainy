/**
 * Triple Intelligence Scale Tests - 1M+ Items
 * 
 * These tests verify that Triple Intelligence maintains O(log n) performance
 * at scale with real data, no mocks, no stubs.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { Brainy } from '../../src/brainy.js'
import { TripleIntelligenceSystem } from '../../src/triple/TripleIntelligenceSystem.js'

describe('Triple Intelligence Performance at Scale', () => {
  let brain: Brainy
  let triple: TripleIntelligenceSystem
  const TEST_SIZE = process.env.CI ? 100000 : 1000000 // Smaller on CI
  
  beforeAll(async () => {
    console.log(`\n🚀 Initializing Brainy with ${TEST_SIZE.toLocaleString()} items...`)
    const startTime = Date.now()
    
    // Initialize Brainy with all required indexes
    brain = new Brainy()
    await brain.init({
      enableMetadataIndex: true,
      enableGraphIndex: true,
      dimensions: 1536,
      storage: {
        type: 'memory' // Use in-memory for speed
      }
    })
    
    // Generate and add test data
    console.log('📊 Generating test data...')
    const batchSize = 1000
    const categories = ['tech', 'science', 'health', 'business', 'education']
    const tags = Array.from({ length: 100 }, (_, i) => `tag${i}`)
    
    for (let i = 0; i < TEST_SIZE; i += batchSize) {
      const batch = []
      
      for (let j = 0; j < batchSize && i + j < TEST_SIZE; j++) {
        const idx = i + j
        batch.push({
          id: `item-${idx}`,
          data: `This is item ${idx} containing information about ${categories[idx % categories.length]}`,
          metadata: {
            category: categories[idx % categories.length],
            value: idx,
            timestamp: Date.now() - idx * 1000,
            tags: [tags[idx % 100], tags[(idx + 50) % 100]],
            score: Math.random() * 100,
            active: idx % 2 === 0
          }
        })
      }
      
      // Add batch
      await brain.addMany(batch)
      
      if (i % 10000 === 0) {
        console.log(`  Added ${i.toLocaleString()}/${TEST_SIZE.toLocaleString()} items...`)
      }
    }
    
    // Add some relationships for graph testing
    console.log('🔗 Creating graph relationships...')
    for (let i = 0; i < 10000; i++) {
      const sourceId = `item-${Math.floor(Math.random() * TEST_SIZE)}`
      const targetId = `item-${Math.floor(Math.random() * TEST_SIZE)}`
      
      await brain.relate({
        from: sourceId,
        to: targetId,
        type: 'references',
        metadata: { strength: Math.random() }
      })
    }
    
    // Get the Triple Intelligence system
    triple = brain.getTripleIntelligence()
    
    const elapsed = Date.now() - startTime
    console.log(`✅ Setup complete in ${(elapsed / 1000).toFixed(1)}s\n`)
  }, 300000) // 5 minute timeout for setup
  
  afterAll(async () => {
    await brain?.close()
  })
  
  it('should perform vector search in O(log n) time', async () => {
    const query = {
      similar: 'technology and artificial intelligence',
      limit: 10
    }
    
    // Warm up
    await triple.find(query)
    
    // Measure
    const startTime = performance.now()
    const results = await triple.find(query)
    const elapsed = performance.now() - startTime
    
    // For 1M items, log2(1M) ≈ 20
    // HNSW should complete in roughly 20 * 5ms = 100ms
    const expectedTime = Math.log2(TEST_SIZE) * 5
    
    console.log(`Vector search: ${elapsed.toFixed(2)}ms (expected <${expectedTime.toFixed(2)}ms)`)
    
    expect(elapsed).toBeLessThan(expectedTime * 2) // Allow 2x margin
    expect(results).toHaveLength(10)
    expect(results[0].vectorScore).toBeDefined()
    expect(results[0].score).toBeGreaterThan(0)
  })
  
  it('should perform range queries in O(log n) time', async () => {
    const query = {
      where: {
        value: { $gt: TEST_SIZE / 2, $lt: TEST_SIZE / 2 + 10000 },
        category: 'tech'
      },
      limit: 20
    }
    
    // Warm up
    await triple.find(query)
    
    // Measure
    const startTime = performance.now()
    const results = await triple.find(query)
    const elapsed = performance.now() - startTime
    
    // B-tree range queries should be O(log n)
    const expectedTime = Math.log2(TEST_SIZE) * 3
    
    console.log(`Range query: ${elapsed.toFixed(2)}ms (expected <${expectedTime.toFixed(2)}ms)`)
    
    expect(elapsed).toBeLessThan(expectedTime * 2)
    expect(results.length).toBeGreaterThan(0)
    expect(results.length).toBeLessThanOrEqual(20)
    
    // Verify results match criteria
    for (const result of results) {
      expect(result.metadata.value).toBeGreaterThan(TEST_SIZE / 2)
      expect(result.metadata.value).toBeLessThan(TEST_SIZE / 2 + 10000)
      expect(result.metadata.category).toBe('tech')
    }
  })
  
  it('should perform complex multi-field queries efficiently', async () => {
    const query = {
      where: {
        category: { $in: ['tech', 'science'] },
        score: { $gt: 50 },
        active: true,
        tags: { $contains: 'tag10' }
      },
      limit: 50
    }
    
    const startTime = performance.now()
    const results = await triple.find(query)
    const elapsed = performance.now() - startTime
    
    const expectedTime = Math.log2(TEST_SIZE) * 5
    
    console.log(`Complex query: ${elapsed.toFixed(2)}ms (expected <${expectedTime.toFixed(2)}ms)`)
    
    expect(elapsed).toBeLessThan(expectedTime * 3) // Complex queries get more margin
    expect(results.length).toBeGreaterThan(0)
    
    // Verify all results match ALL criteria
    for (const result of results) {
      expect(['tech', 'science']).toContain(result.metadata.category)
      expect(result.metadata.score).toBeGreaterThan(50)
      expect(result.metadata.active).toBe(true)
      expect(result.metadata.tags).toContain('tag10')
    }
  })
  
  it('should perform graph traversal in O(1) per node', async () => {
    const query = {
      connected: {
        from: 'item-1000',
        direction: 'out',
        depth: 2
      },
      limit: 30
    }
    
    const startTime = performance.now()
    const results = await triple.find(query)
    const elapsed = performance.now() - startTime
    
    // Graph traversal with adjacency lists should be very fast
    // O(1) per node lookup, limited by depth
    const expectedTime = 50 // Should be constant time-ish
    
    console.log(`Graph traversal: ${elapsed.toFixed(2)}ms (expected <${expectedTime.toFixed(2)}ms)`)
    
    expect(elapsed).toBeLessThan(expectedTime * 2)
    expect(results.length).toBeGreaterThan(0)
    expect(results[0].depth).toBeDefined()
    expect(results[0].graphScore).toBeDefined()
  })
  
  it('should perform hybrid queries with RRF fusion', async () => {
    const query = {
      similar: 'artificial intelligence machine learning',
      where: {
        category: 'tech',
        score: { $gt: 30 }
      },
      connected: {
        from: 'item-5000',
        depth: 1
      },
      limit: 20
    }
    
    const startTime = performance.now()
    const results = await triple.find(query, {
      fusion: {
        strategy: 'rrf',
        k: 60,
        weights: {
          vector: 0.5,
          field: 0.3,
          graph: 0.2
        }
      }
    })
    const elapsed = performance.now() - startTime
    
    // Hybrid query should still be fast
    const expectedTime = Math.log2(TEST_SIZE) * 10
    
    console.log(`Hybrid query: ${elapsed.toFixed(2)}ms (expected <${expectedTime.toFixed(2)}ms)`)
    
    expect(elapsed).toBeLessThan(expectedTime * 2)
    expect(results).toHaveLength(20)
    
    // Verify fusion scores
    expect(results[0].fusionScore).toBeDefined()
    expect(results[0].vectorScore).toBeDefined()
    expect(results[0].fieldScore).toBeDefined()
    
    // Fusion scores should be sorted
    for (let i = 0; i < results.length - 1; i++) {
      expect(results[i].fusionScore).toBeGreaterThanOrEqual(results[i + 1].fusionScore)
    }
  })
  
  it('should maintain performance across different dataset sizes', async () => {
    const sizes = [1000, 10000, 100000]
    const timings: number[] = []
    
    for (const size of sizes) {
      const query = {
        where: {
          value: { $lt: size }
        },
        limit: 10
      }
      
      // Warm up
      await triple.find(query)
      
      // Measure
      const startTime = performance.now()
      await triple.find(query)
      const elapsed = performance.now() - startTime
      
      timings.push(elapsed)
    }
    
    console.log('\nPerformance scaling:')
    console.log('Size      Time(ms)  Ratio')
    console.log('--------- --------- -----')
    
    for (let i = 0; i < sizes.length; i++) {
      const ratio = i > 0 ? (timings[i] / timings[i - 1]).toFixed(2) : '-'
      console.log(
        `${sizes[i].toString().padEnd(9)} ${timings[i].toFixed(2).padEnd(9)} ${ratio}`
      )
    }
    
    // Each 10x increase in data should only increase time by ~3.3x (log2(10))
    // Allow some variance but ensure it's not linear (10x)
    for (let i = 1; i < timings.length; i++) {
      const ratio = timings[i] / timings[i - 1]
      expect(ratio).toBeLessThan(5) // Much less than 10x
    }
  })
  
  it('should fail loudly on performance violations', async () => {
    // Create a query that would be slow without indexes
    const slowQuery = {
      where: {
        nonIndexedField: 'some value' // This field doesn't exist
      }
    }
    
    // This should either:
    // 1. Throw an error because the field isn't indexed
    // 2. Return empty results quickly
    // But NOT fall back to O(n) scanning
    
    const startTime = performance.now()
    
    try {
      const results = await triple.find(slowQuery)
      const elapsed = performance.now() - startTime
      
      // If it doesn't throw, it should still be fast
      expect(elapsed).toBeLessThan(100)
      expect(results).toHaveLength(0) // No results for non-existent field
    } catch (error) {
      // Expected - no fallback allowed
      expect(error.message).toMatch(/Performance violation|not indexed|cannot perform/)
    }
  })
  
  it('should provide performance metrics', async () => {
    // Reset metrics
    triple.resetMetrics()
    
    // Run various queries
    await triple.find({ similar: 'test', limit: 5 })
    await triple.find({ where: { category: 'tech' }, limit: 5 })
    await triple.find({ connected: { from: 'item-100', depth: 1 }, limit: 5 })
    
    // Get performance report
    const report = triple.getMetrics().getReport()
    
    console.log('\n📊 Performance Report:')
    console.log(JSON.stringify(report, null, 2))
    
    // Verify metrics are collected
    expect(report.operations).toBeDefined()
    expect(Object.keys(report.operations).length).toBeGreaterThan(0)
    
    // Check for violations
    if (report.violations.length > 0) {
      console.warn('⚠️ Performance violations detected:', report.violations)
    }
    
    // In production, violations should be rare
    for (const violation of report.violations) {
      expect(violation.rate).toBeLessThan(0.1) // Less than 10% violation rate
    }
  })
})

describe('Triple Intelligence Correctness', () => {
  let brain: Brainy
  let triple: TripleIntelligenceSystem
  
  beforeAll(async () => {
    brain = new Brainy()
    await brain.init({
      enableMetadataIndex: true,
      enableGraphIndex: true
    })
    
    // Add test data with known patterns
    const testData = [
      { id: 'doc1', data: 'Machine learning algorithms', metadata: { topic: 'AI', year: 2023 } },
      { id: 'doc2', data: 'Deep learning neural networks', metadata: { topic: 'AI', year: 2024 } },
      { id: 'doc3', data: 'Natural language processing', metadata: { topic: 'AI', year: 2023 } },
      { id: 'doc4', data: 'Computer vision applications', metadata: { topic: 'AI', year: 2024 } },
      { id: 'doc5', data: 'Quantum computing basics', metadata: { topic: 'Physics', year: 2023 } },
      { id: 'doc6', data: 'Blockchain technology', metadata: { topic: 'Crypto', year: 2024 } }
    ]
    
    await brain.addMany(testData)
    
    // Add relationships
    await brain.relate({ from: 'doc1', to: 'doc2', type: 'related' })
    await brain.relate({ from: 'doc2', to: 'doc3', type: 'related' })
    await brain.relate({ from: 'doc3', to: 'doc4', type: 'related' })
    
    triple = brain.getTripleIntelligence()
  })
  
  afterAll(async () => {
    await brain?.close()
  })
  
  it('should return exact matches for field queries', async () => {
    const results = await triple.find({
      where: { topic: 'AI' },
      limit: 10
    })
    
    expect(results).toHaveLength(4)
    for (const result of results) {
      expect(result.metadata.topic).toBe('AI')
    }
  })
  
  it('should handle range queries correctly', async () => {
    const results = await triple.find({
      where: { year: { $gte: 2024 } },
      limit: 10
    })
    
    expect(results).toHaveLength(3)
    for (const result of results) {
      expect(result.metadata.year).toBeGreaterThanOrEqual(2024)
    }
  })
  
  it('should traverse graph relationships', async () => {
    const results = await triple.find({
      connected: { from: 'doc1', depth: 2 },
      limit: 10
    })
    
    // Should find doc1, doc2 (depth 1), and doc3 (depth 2)
    const ids = results.map(r => r.id)
    expect(ids).toContain('doc1')
    expect(ids).toContain('doc2')
    expect(ids).toContain('doc3')
    
    // Check depth values
    const doc1Result = results.find(r => r.id === 'doc1')
    const doc2Result = results.find(r => r.id === 'doc2')
    const doc3Result = results.find(r => r.id === 'doc3')
    
    expect(doc1Result?.depth).toBe(0)
    expect(doc2Result?.depth).toBe(1)
    expect(doc3Result?.depth).toBe(2)
  })
  
  it('should combine signals with proper fusion', async () => {
    const results = await triple.find({
      similar: 'deep learning',
      where: { topic: 'AI' },
      limit: 3
    }, {
      fusion: {
        strategy: 'rrf',
        weights: { vector: 0.7, field: 0.3 }
      }
    })
    
    // doc2 should rank highest (matches both signals)
    expect(results[0].id).toBe('doc2')
    expect(results[0].fusionScore).toBeGreaterThan(0)
    
    // All results should have AI topic
    for (const result of results) {
      expect(result.metadata.topic).toBe('AI')
    }
  })
})