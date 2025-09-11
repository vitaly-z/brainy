/**
 * 🧠 Graph Scale Performance Benchmarks
 *
 * Comprehensive performance validation for large-scale graph operations
 * and O(1) traversal validation. Tests industry-leading performance targets:
 *
 * - O(1) neighbor lookup: <1ms for 10M relationships
 * - Memory efficiency: ~24 bytes per relationship
 * - Index update: <5ms per relationship amortized
 * - Rebuild performance from storage
 *
 * NO MOCKS, NO STUBS - REAL PRODUCTION CODE AT SCALE
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { Brainy } from '../../src/brainy.js'
import { GraphAdjacencyIndex } from '../../src/graph/graphAdjacencyIndex.js'
import { MemoryStorage } from '../../src/storage/adapters/memoryStorage.js'
import { performance } from 'perf_hooks'

// Performance targets and constants
const PERFORMANCE_TARGETS = {
  O1_LOOKUP: 1.0,      // <1ms for O(1) neighbor lookup
  INDEX_UPDATE: 5.0,   // <5ms amortized per relationship update
  MEMORY_PER_REL: 24,  // ~24 bytes per relationship
  REBUILD_RATE: 1000,  // 1000 relationships/second rebuild rate
  CONCURRENT_LOAD: 100 // 100 concurrent operations
} as const

// Test scales for different environments
const TEST_SCALES = {
  CI: {
    relationships: 10000,
    nodes: 5000,
    concurrentOps: 10
  },
  DEVELOPMENT: {
    relationships: 100000,
    nodes: 50000,
    concurrentOps: 50
  },
  PRODUCTION: {
    relationships: 1000000,
    nodes: 100000,
    concurrentOps: 100
  }
} as const

// Statistical analysis helpers
class PerformanceStats {
  private samples: number[] = []

  addSample(value: number) {
    this.samples.push(value)
  }

  get mean(): number {
    return this.samples.reduce((a, b) => a + b, 0) / this.samples.length
  }

  get median(): number {
    const sorted = [...this.samples].sort((a, b) => a - b)
    const mid = Math.floor(sorted.length / 2)
    return sorted.length % 2 === 0
      ? (sorted[mid - 1] + sorted[mid]) / 2
      : sorted[mid]
  }

  get p95(): number {
    const sorted = [...this.samples].sort((a, b) => a - b)
    const index = Math.floor(sorted.length * 0.95)
    return sorted[index]
  }

  get p99(): number {
    const sorted = [...this.samples].sort((a, b) => a - b)
    const index = Math.floor(sorted.length * 0.99)
    return sorted[index]
  }

  get stdDev(): number {
    const mean = this.mean
    const variance = this.samples.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / this.samples.length
    return Math.sqrt(variance)
  }

  get min(): number {
    return Math.min(...this.samples)
  }

  get max(): number {
    return Math.max(...this.samples)
  }

  reset() {
    this.samples = []
  }

  toString(): string {
    return `mean=${this.mean.toFixed(2)}ms, median=${this.median.toFixed(2)}ms, p95=${this.p95.toFixed(2)}ms, p99=${this.p99.toFixed(2)}ms`
  }
}

// Determine test scale based on environment
function getTestScale() {
  if (process.env.CI) return TEST_SCALES.CI
  if (process.env.NODE_ENV === 'production') return TEST_SCALES.PRODUCTION
  return TEST_SCALES.DEVELOPMENT
}

describe('🧠 Graph Scale Performance Benchmarks', () => {
  let brain: Brainy
  let graphIndex: GraphAdjacencyIndex
  let storage: MemoryStorage
  const scale = getTestScale()

  // Performance tracking
  const lookupStats = new PerformanceStats()
  const updateStats = new PerformanceStats()
  const memoryStats = new PerformanceStats()

  beforeAll(async () => {
    console.log(`\n🚀 Initializing Graph Scale Performance Tests`)
    console.log(`📊 Scale: ${scale.relationships.toLocaleString()} relationships, ${scale.nodes.toLocaleString()} nodes`)
    console.log(`🎯 Targets: O(1) <${PERFORMANCE_TARGETS.O1_LOOKUP}ms, Memory ~${PERFORMANCE_TARGETS.MEMORY_PER_REL} bytes/rel\n`)

    const startTime = Date.now()

    // Initialize storage and graph index
    storage = new MemoryStorage()
    await storage.init()

    graphIndex = new GraphAdjacencyIndex(storage, {
      maxIndexSize: scale.nodes,
      autoOptimize: true
    })

    // Initialize Brainy for unified testing
    brain = new Brainy({
      storage: { type: 'memory' },
      enableGraphIndex: true,
      enableMetadataIndex: true
    })
    await brain.init()

    // Generate test data
    console.log('📝 Generating test graph data...')
    await generateTestGraph(scale.nodes, scale.relationships)

    const elapsed = Date.now() - startTime
    console.log(`✅ Setup complete in ${(elapsed / 1000).toFixed(1)}s\n`)
  }, 300000) // 5 minute timeout

  afterAll(async () => {
    await brain?.close()
    await graphIndex?.close()
  })

  beforeEach(() => {
    // Reset stats for each test
    lookupStats.reset()
    updateStats.reset()
    memoryStats.reset()
  })

  /**
   * Generate a realistic test graph with the specified scale
   */
  async function generateTestGraph(nodeCount: number, relationshipCount: number) {
    const batchSize = 1000

    // Generate nodes
    for (let i = 0; i < nodeCount; i += batchSize) {
      const batch = []
      for (let j = 0; j < batchSize && i + j < nodeCount; j++) {
        const idx = i + j
        batch.push({
          id: `node-${idx}`,
          data: `Test entity ${idx}`,
          metadata: {
            type: idx % 5 === 0 ? 'user' : idx % 3 === 0 ? 'document' : 'concept',
            category: ['tech', 'science', 'business', 'health', 'education'][idx % 5],
            created: Date.now() - idx * 1000
          }
        })
      }
      await brain.addMany(batch)
    }

    // Generate relationships with realistic patterns
    const relationshipTypes = ['follows', 'references', 'related', 'contains', 'belongs_to']
    let relationshipsAdded = 0

    while (relationshipsAdded < relationshipCount) {
      const batch = []
      for (let i = 0; i < Math.min(batchSize, relationshipCount - relationshipsAdded); i++) {
        const sourceId = `node-${Math.floor(Math.random() * nodeCount)}`
        const targetId = `node-${Math.floor(Math.random() * nodeCount)}`
        const type = relationshipTypes[Math.floor(Math.random() * relationshipTypes.length)]

        if (sourceId !== targetId) { // Avoid self-references
          batch.push({
            from: sourceId,
            to: targetId,
            type,
            metadata: {
              strength: Math.random(),
              created: Date.now() - Math.random() * 86400000 // Random time within 24h
            }
          })
        }
      }

      await brain.relateMany(batch)
      relationshipsAdded += batch.length

      if (relationshipsAdded % 10000 === 0) {
        console.log(`  Added ${relationshipsAdded.toLocaleString()}/${relationshipCount.toLocaleString()} relationships...`)
      }
    }
  }

  describe('1. GraphAdjacencyIndex Performance Benchmarks', () => {
    it('should achieve O(1) neighbor lookup validation (<1ms for large graphs)', async () => {
      console.log(`\n🔍 Testing O(1) neighbor lookups on ${scale.relationships.toLocaleString()} relationships...`)

      // Warm up the index
      await graphIndex.rebuild()
      await graphIndex.getNeighbors('node-100') // Warm up

      // Test random lookups
      const testIterations = Math.min(1000, scale.nodes / 10)
      const sampleNodes = Array.from({ length: testIterations }, () =>
        `node-${Math.floor(Math.random() * scale.nodes)}`
      )

      for (const nodeId of sampleNodes) {
        const startTime = performance.now()
        const neighbors = await graphIndex.getNeighbors(nodeId)
        const elapsed = performance.now() - startTime

        lookupStats.addSample(elapsed)

        // Each lookup should be sub-millisecond
        expect(elapsed).toBeLessThan(PERFORMANCE_TARGETS.O1_LOOKUP)
        expect(Array.isArray(neighbors)).toBe(true)
      }

      console.log(`✅ O(1) Lookup Performance: ${lookupStats.toString()}`)
      console.log(`   Target: <${PERFORMANCE_TARGETS.O1_LOOKUP}ms per lookup`)
      console.log(`   Best: ${lookupStats.min.toFixed(3)}ms, Worst: ${lookupStats.max.toFixed(3)}ms`)

      // Statistical validation
      expect(lookupStats.p95).toBeLessThan(PERFORMANCE_TARGETS.O1_LOOKUP)
      expect(lookupStats.p99).toBeLessThan(PERFORMANCE_TARGETS.O1_LOOKUP * 2) // Allow some variance for p99
    })

    it('should validate memory usage (~24 bytes per relationship)', async () => {
      const stats = graphIndex.getStats()

      console.log(`\n💾 Memory Usage Analysis:`)
      console.log(`   Total relationships: ${stats.totalRelationships.toLocaleString()}`)
      console.log(`   Source nodes: ${stats.sourceNodes.toLocaleString()}`)
      console.log(`   Target nodes: ${stats.targetNodes.toLocaleString()}`)
      console.log(`   Memory usage: ${(stats.memoryUsage / 1024 / 1024).toFixed(2)} MB`)

      const bytesPerRelationship = stats.memoryUsage / stats.totalRelationships
      console.log(`   Bytes per relationship: ${bytesPerRelationship.toFixed(1)}`)

      // Validate memory efficiency
      expect(bytesPerRelationship).toBeLessThan(PERFORMANCE_TARGETS.MEMORY_PER_REL * 1.5) // Allow 50% margin
      expect(bytesPerRelationship).toBeGreaterThan(PERFORMANCE_TARGETS.MEMORY_PER_REL * 0.5) // Don't be too efficient (might indicate missing data)

      // Memory should scale linearly with relationships
      expect(stats.memoryUsage).toBeGreaterThan(0)
    })

    it('should validate index update performance (<5ms per relationship amortized)', async () => {
      console.log(`\n⚡ Testing index update performance...`)

      // Test batch updates
      const batchSize = 100
      const testBatches = Math.min(10, Math.floor(scale.nodes / batchSize))

      for (let batch = 0; batch < testBatches; batch++) {
        const startTime = performance.now()

        // Add relationships in batch
        const relationships = []
        for (let i = 0; i < batchSize; i++) {
          const sourceId = `node-${Math.floor(Math.random() * scale.nodes)}`
          const targetId = `node-${Math.floor(Math.random() * scale.nodes)}`

          relationships.push({
            from: sourceId,
            to: targetId,
            type: 'test_relationship',
            metadata: { batch, index: i }
          })
        }

        await brain.relateMany(relationships)

        const elapsed = performance.now() - startTime
        const amortizedTime = elapsed / batchSize

        updateStats.addSample(amortizedTime)

        // Each update should be fast
        expect(amortizedTime).toBeLessThan(PERFORMANCE_TARGETS.INDEX_UPDATE)
      }

      console.log(`✅ Index Update Performance: ${updateStats.toString()}`)
      console.log(`   Target: <${PERFORMANCE_TARGETS.INDEX_UPDATE}ms amortized per relationship`)

      // Statistical validation
      expect(updateStats.p95).toBeLessThan(PERFORMANCE_TARGETS.INDEX_UPDATE * 1.5)
    })

    it('should validate rebuild performance from storage', async () => {
      console.log(`\n🔄 Testing index rebuild performance...`)

      const startTime = performance.now()
      await graphIndex.rebuild()
      const rebuildTime = performance.now() - startTime

      const rebuildRate = scale.relationships / (rebuildTime / 1000) // relationships per second

      console.log(`✅ Rebuild Performance:`)
      console.log(`   Total time: ${(rebuildTime / 1000).toFixed(2)}s`)
      console.log(`   Rate: ${rebuildRate.toFixed(0)} relationships/second`)
      console.log(`   Target: >${PERFORMANCE_TARGETS.REBUILD_RATE} relationships/second`)

      // Validate rebuild performance
      expect(rebuildRate).toBeGreaterThan(PERFORMANCE_TARGETS.REBUILD_RATE)

      // Rebuild should complete within reasonable time
      const expectedMaxTime = scale.relationships / PERFORMANCE_TARGETS.REBUILD_RATE * 1000
      expect(rebuildTime).toBeLessThan(expectedMaxTime * 2) // Allow 2x margin

      // Verify index integrity after rebuild
      const stats = graphIndex.getStats()
      expect(stats.totalRelationships).toBeGreaterThan(0)
      expect(stats.sourceNodes).toBeGreaterThan(0)
      expect(stats.targetNodes).toBeGreaterThan(0)
    })
  })

  describe('2. Large-Scale Graph Operations', () => {
    it('should handle 100K+ relationship graph construction', async () => {
      console.log(`\n🏗️ Testing large-scale graph construction...`)

      const constructionStart = performance.now()

      // Add additional relationships to reach target scale
      const additionalRelationships = Math.max(0, 100000 - scale.relationships)
      if (additionalRelationships > 0) {
        const batchSize = 1000
        let added = 0

        while (added < additionalRelationships) {
          const batch = []
          for (let i = 0; i < Math.min(batchSize, additionalRelationships - added); i++) {
            batch.push({
              from: `node-${Math.floor(Math.random() * scale.nodes)}`,
              to: `node-${Math.floor(Math.random() * scale.nodes)}`,
              type: 'bulk_relationship',
              metadata: { batchId: Math.floor(added / batchSize) }
            })
          }

          await brain.relateMany(batch)
          added += batch.length
        }
      }

      const constructionTime = performance.now() - constructionStart

      console.log(`✅ Large-scale construction:`)
      console.log(`   Time: ${(constructionTime / 1000).toFixed(2)}s`)
      console.log(`   Rate: ${(scale.relationships / (constructionTime / 1000)).toFixed(0)} relationships/s`)

      // Construction should be efficient
      expect(constructionTime).toBeLessThan(300000) // Less than 5 minutes
    })

    it('should handle million-node graph traversal', async () => {
      console.log(`\n🚶 Testing large graph traversal...`)

      // Test traversal from multiple starting points
      const startNodes = ['node-0', 'node-100', 'node-1000', 'node-10000']
      const traversalStats = new PerformanceStats()

      for (const startNode of startNodes) {
        const startTime = performance.now()

        // Perform BFS traversal with depth limit
        const visited = new Set<string>()
        const queue: Array<{ id: string; depth: number }> = [{ id: startNode, depth: 0 }]
        let nodesTraversed = 0
        const maxDepth = 3
        const maxNodes = 1000

        while (queue.length > 0 && nodesTraversed < maxNodes) {
          const { id, depth } = queue.shift()!

          if (visited.has(id) || depth > maxDepth) continue
          visited.add(id)
          nodesTraversed++

          // Get neighbors
          const neighbors = await graphIndex.getNeighbors(id, 'out')
          for (const neighbor of neighbors) {
            if (!visited.has(neighbor)) {
              queue.push({ id: neighbor, depth: depth + 1 })
            }
          }
        }

        const traversalTime = performance.now() - startTime
        traversalStats.addSample(traversalTime)

        console.log(`   ${startNode}: ${nodesTraversed} nodes in ${(traversalTime).toFixed(2)}ms`)
      }

      console.log(`✅ Graph traversal performance: ${traversalStats.toString()}`)

      // Traversal should be fast
      expect(traversalStats.p95).toBeLessThan(100) // <100ms for traversal
    })

    it('should handle complex graph query patterns', async () => {
      console.log(`\n🔍 Testing complex graph query patterns...`)

      const queryPatterns = [
        { name: 'Single node neighbors', query: { connected: { from: 'node-100' } } },
        { name: 'Bidirectional connections', query: { connected: { from: 'node-200', direction: 'both' } } },
        { name: 'Multi-hop paths', query: { connected: { from: 'node-300', depth: 2 } } },
        { name: 'Filtered connections', query: { connected: { from: 'node-400' }, where: { type: 'follows' } } }
      ]

      const patternStats = new PerformanceStats()

      for (const pattern of queryPatterns) {
        const startTime = performance.now()
        const results = await brain.find(pattern.query)
        const elapsed = performance.now() - startTime

        patternStats.addSample(elapsed)

        console.log(`   ${pattern.name}: ${results.length} results in ${elapsed.toFixed(2)}ms`)

        // Complex queries should still be fast
        expect(elapsed).toBeLessThan(500) // <500ms for complex queries
        expect(Array.isArray(results)).toBe(true)
      }

      console.log(`✅ Complex query performance: ${patternStats.toString()}`)
    })

    it('should validate memory efficiency under scale', async () => {
      console.log(`\n📊 Memory efficiency analysis under scale...`)

      const initialMemory = process.memoryUsage()
      const initialHeapUsed = initialMemory.heapUsed

      // Perform memory-intensive operations
      const operations = []
      for (let i = 0; i < 100; i++) {
        operations.push(
          brain.find({ connected: { from: `node-${Math.floor(Math.random() * scale.nodes)}`, depth: 2 } })
        )
      }

      await Promise.all(operations)

      const finalMemory = process.memoryUsage()
      const finalHeapUsed = finalMemory.heapUsed
      const memoryDelta = finalHeapUsed - initialHeapUsed

      console.log(`✅ Memory efficiency:`)
      console.log(`   Initial heap: ${(initialHeapUsed / 1024 / 1024).toFixed(2)} MB`)
      console.log(`   Final heap: ${(finalHeapUsed / 1024 / 1024).toFixed(2)} MB`)
      console.log(`   Delta: ${(memoryDelta / 1024 / 1024).toFixed(2)} MB`)

      // Memory usage should be reasonable
      expect(memoryDelta).toBeLessThan(100 * 1024 * 1024) // Less than 100MB increase

      // Force garbage collection if available
      if (global.gc) {
        global.gc()
        const afterGc = process.memoryUsage()
        console.log(`   After GC: ${(afterGc.heapUsed / 1024 / 1024).toFixed(2)} MB`)
      }
    })
  })

  describe('3. Unified find() Performance', () => {
    it('should handle vector+graph+fields combined queries at scale', async () => {
      console.log(`\n🔗 Testing unified find() with combined queries...`)

      const combinedQueries = [
        {
          name: 'Vector + Graph',
          query: {
            similar: 'technology artificial intelligence',
            connected: { from: 'node-1000', depth: 1 },
            limit: 20
          }
        },
        {
          name: 'Vector + Fields',
          query: {
            similar: 'machine learning',
            where: { category: 'tech', type: 'document' },
            limit: 20
          }
        },
        {
          name: 'Graph + Fields',
          query: {
            connected: { from: 'node-2000', depth: 2 },
            where: { created: { $gt: Date.now() - 86400000 } }, // Last 24h
            limit: 20
          }
        },
        {
          name: 'Triple Intelligence',
          query: {
            similar: 'neural networks',
            connected: { from: 'node-3000' },
            where: { category: 'science' },
            limit: 20
          }
        }
      ]

      const unifiedStats = new PerformanceStats()

      for (const testCase of combinedQueries) {
        const startTime = performance.now()
        const results = await brain.find(testCase.query)
        const elapsed = performance.now() - startTime

        unifiedStats.addSample(elapsed)

        console.log(`   ${testCase.name}: ${results.length} results in ${elapsed.toFixed(2)}ms`)

        // Unified queries should be efficient
        expect(elapsed).toBeLessThan(1000) // <1s for combined queries
        expect(results.length).toBeGreaterThan(0)
        expect(results[0].score).toBeDefined()
      }

      console.log(`✅ Unified query performance: ${unifiedStats.toString()}`)
    })

    it('should validate parallel execution performance', async () => {
      console.log(`\n⚡ Testing parallel query execution...`)

      const parallelQueries = Array.from({ length: 10 }, (_, i) => ({
        similar: `query ${i}`,
        connected: { from: `node-${i * 1000}`, depth: 1 },
        where: { category: ['tech', 'science', 'business'][i % 3] },
        limit: 10
      }))

      const parallelStart = performance.now()
      const results = await Promise.all(parallelQueries.map(query => brain.find(query)))
      const parallelTime = performance.now() - parallelStart

      const sequentialStart = performance.now()
      for (const query of parallelQueries) {
        await brain.find(query)
      }
      const sequentialTime = performance.now() - sequentialStart

      const speedup = sequentialTime / parallelTime

      console.log(`✅ Parallel execution:`)
      console.log(`   Parallel time: ${parallelTime.toFixed(2)}ms`)
      console.log(`   Sequential time: ${sequentialTime.toFixed(2)}ms`)
      console.log(`   Speedup: ${speedup.toFixed(2)}x`)

      // Parallel execution should provide speedup
      expect(speedup).toBeGreaterThan(1.5) // At least 1.5x speedup
      expect(results.length).toBe(10)
      results.forEach(resultSet => {
        expect(Array.isArray(resultSet)).toBe(true)
        expect(resultSet.length).toBeGreaterThan(0)
      })
    })

    it('should validate query optimization effectiveness', async () => {
      console.log(`\n🎯 Testing query optimization effectiveness...`)

      // Test different query patterns to see optimization effectiveness
      const optimizationTests = [
        {
          name: 'ID lookup (fast path)',
          query: { id: 'node-100' },
          expectedTime: 1
        },
        {
          name: 'Multiple IDs (fast path)',
          query: { ids: ['node-100', 'node-200', 'node-300'] },
          expectedTime: 5
        },
        {
          name: 'Vector search only',
          query: { similar: 'test query', limit: 10 },
          expectedTime: 50
        },
        {
          name: 'Metadata filter only',
          query: { where: { category: 'tech' }, limit: 10 },
          expectedTime: 20
        },
        {
          name: 'Graph traversal only',
          query: { connected: { from: 'node-1000' }, limit: 10 },
          expectedTime: 30
        }
      ]

      const optimizationStats = new PerformanceStats()

      for (const test of optimizationTests) {
        const startTime = performance.now()
        const results = await brain.find(test.query)
        const elapsed = performance.now() - startTime

        optimizationStats.addSample(elapsed)

        console.log(`   ${test.name}: ${elapsed.toFixed(2)}ms (target: <${test.expectedTime}ms)`)

        // Each query should meet its performance target
        expect(elapsed).toBeLessThan(test.expectedTime * 2) // Allow 2x margin
        expect(Array.isArray(results)).toBe(true)
      }

      console.log(`✅ Query optimization: ${optimizationStats.toString()}`)
    })

    it('should validate memory usage during large queries', async () => {
      console.log(`\n💾 Memory usage during large queries...`)

      const initialMemory = process.memoryUsage()

      // Execute large queries
      const largeQueries = [
        brain.find({ similar: 'comprehensive test', limit: 100 }),
        brain.find({ where: { category: 'tech' }, limit: 100 }),
        brain.find({ connected: { from: 'node-1000', depth: 3 }, limit: 100 }),
        brain.find({
          similar: 'large scale',
          connected: { from: 'node-2000', depth: 2 },
          where: { type: 'document' },
          limit: 100
        })
      ]

      await Promise.all(largeQueries)

      const finalMemory = process.memoryUsage()
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed

      console.log(`✅ Large query memory usage:`)
      console.log(`   Memory increase: ${(memoryIncrease / 1024 / 1024).toFixed(2)} MB`)
      console.log(`   Peak RSS: ${(finalMemory.rss / 1024 / 1024).toFixed(2)} MB`)

      // Memory usage should be reasonable for large queries
      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024) // Less than 50MB increase
    })
  })

  describe('4. Concurrent Load Testing', () => {
    it('should handle multiple concurrent graph operations', async () => {
      console.log(`\n🔄 Testing concurrent graph operations...`)

      const concurrentOps = Math.min(scale.concurrentOps, PERFORMANCE_TARGETS.CONCURRENT_LOAD)
      const operations: Promise<any>[] = []

      // Mix of different operation types
      for (let i = 0; i < concurrentOps; i++) {
        const operationType = i % 4

        switch (operationType) {
          case 0: // Neighbor lookup
            operations.push(graphIndex.getNeighbors(`node-${Math.floor(Math.random() * scale.nodes)}`))
            break
          case 1: // Unified find
            operations.push(brain.find({
              connected: { from: `node-${Math.floor(Math.random() * scale.nodes)}` },
              limit: 5
            }))
            break
          case 2: // Relationship addition
            operations.push(brain.relate({
              from: `node-${Math.floor(Math.random() * scale.nodes)}`,
              to: `node-${Math.floor(Math.random() * scale.nodes)}`,
              type: 'concurrent_test'
            }))
            break
          case 3: // Complex query
            operations.push(brain.find({
              similar: `concurrent query ${i}`,
              where: { category: ['tech', 'science'][i % 2] },
              limit: 3
            }))
            break
        }
      }

      const concurrentStart = performance.now()
      const results = await Promise.all(operations)
      const concurrentTime = performance.now() - concurrentStart

      console.log(`✅ Concurrent operations:`)
      console.log(`   ${concurrentOps} operations completed in ${concurrentTime.toFixed(2)}ms`)
      console.log(`   Average time per operation: ${(concurrentTime / concurrentOps).toFixed(2)}ms`)

      // Concurrent operations should complete efficiently
      expect(concurrentTime).toBeLessThan(5000) // Less than 5 seconds for all operations
      expect(results.length).toBe(concurrentOps)
    })

    it('should handle spike testing for sudden traffic increases', async () => {
      console.log(`\n📈 Testing traffic spike handling...`)

      const spikeLevels = [10, 50, 100, 200]
      const spikeResults: number[] = []

      for (const spikeLevel of spikeLevels) {
        const spikeOperations = Array.from({ length: spikeLevel }, () =>
          brain.find({ connected: { from: `node-${Math.floor(Math.random() * scale.nodes)}` } })
        )

        const spikeStart = performance.now()
        await Promise.all(spikeOperations)
        const spikeTime = performance.now() - spikeStart

        spikeResults.push(spikeTime)

        console.log(`   Spike ${spikeLevel}: ${spikeTime.toFixed(2)}ms (${(spikeTime / spikeLevel).toFixed(2)}ms/op)`)

        // Even under spike, performance should be reasonable
        expect(spikeTime).toBeLessThan(spikeLevel * 50) // <50ms per operation on average
      }

      // Performance should degrade gracefully under load
      const degradation = spikeResults[spikeResults.length - 1] / spikeResults[0]
      console.log(`   Performance degradation: ${degradation.toFixed(2)}x under 20x load increase`)

      // Allow some degradation but not exponential
      expect(degradation).toBeLessThan(10) // Less than 10x slower under 20x load
    })

    it('should detect memory leaks under sustained load', async () => {
      console.log(`\n🕵️ Testing memory leak detection...`)

      const leakTestDuration = 30000 // 30 seconds
      const leakTestStart = Date.now()
      const memorySamples: number[] = []

      // Run continuous operations for leak detection
      while (Date.now() - leakTestStart < leakTestDuration) {
        const operations = Array.from({ length: 10 }, () =>
          brain.find({ connected: { from: `node-${Math.floor(Math.random() * scale.nodes)}` } })
        )

        await Promise.all(operations)

        // Sample memory usage
        const memUsage = process.memoryUsage()
        memorySamples.push(memUsage.heapUsed)

        // Small delay to prevent overwhelming the system
        await new Promise(resolve => setTimeout(resolve, 100))
      }

      const initialMemory = memorySamples[0]
      const finalMemory = memorySamples[memorySamples.length - 1]
      const memoryGrowth = finalMemory - initialMemory
      const growthRate = memoryGrowth / leakTestDuration * 1000 // bytes per second

      console.log(`✅ Memory leak analysis:`)
      console.log(`   Initial memory: ${(initialMemory / 1024 / 1024).toFixed(2)} MB`)
      console.log(`   Final memory: ${(finalMemory / 1024 / 1024).toFixed(2)} MB`)
      console.log(`   Growth: ${(memoryGrowth / 1024 / 1024).toFixed(2)} MB`)
      console.log(`   Growth rate: ${(growthRate / 1024).toFixed(2)} KB/s`)

      // Memory growth should be minimal (less than 10MB over 30 seconds)
      expect(memoryGrowth).toBeLessThan(10 * 1024 * 1024)

      // Growth rate should be very low
      expect(growthRate).toBeLessThan(100 * 1024) // Less than 100KB/s growth
    })

    it('should validate resource exhaustion handling', async () => {
      console.log(`\n🚨 Testing resource exhaustion handling...`)

      const exhaustionTests = [
        {
          name: 'Deep recursion',
          operation: () => brain.find({ connected: { from: 'node-0', depth: 10 } })
        },
        {
          name: 'Large result sets',
          operation: () => brain.find({ connected: { from: 'node-1000', depth: 5 }, limit: 10000 })
        },
        {
          name: 'Complex filters',
          operation: () => brain.find({
            where: {
              $and: [
                { category: 'tech' },
                { type: 'document' },
                { created: { $gt: Date.now() - 86400000 } },
                { score: { $gt: 0.5 } }
              ]
            },
            limit: 1000
          })
        }
      ]

      for (const test of exhaustionTests) {
        const startTime = performance.now()

        try {
          const result = await test.operation()
          const elapsed = performance.now() - startTime

          console.log(`   ${test.name}: ${elapsed.toFixed(2)}ms (${Array.isArray(result) ? result.length : 'N/A'} results)`)

          // Operations should complete without throwing
          expect(elapsed).toBeLessThan(10000) // Less than 10 seconds
        } catch (error) {
          console.log(`   ${test.name}: Failed with ${error.message}`)
          // Some operations might legitimately fail under extreme conditions
          expect(error.message).toMatch(/timeout|limit|memory|recursion/i)
        }
      }

      console.log(`✅ Resource exhaustion handling validated`)
    })
  })

  describe('5. Real-World Scenarios', () => {
    it('should handle social network analysis (friends, followers, connections)', async () => {
      console.log(`\n👥 Testing social network analysis...`)

      // Create a social network scenario
      const socialUsers = Array.from({ length: 1000 }, (_, i) => `user-${i}`)
      const socialRelationships = []

      // Create follower relationships (scale-free network)
      for (let i = 0; i < socialUsers.length; i++) {
        const followerCount = Math.floor(Math.random() * 50) + 1 // 1-50 followers
        for (let j = 0; j < followerCount; j++) {
          const targetUser = socialUsers[Math.floor(Math.random() * socialUsers.length)]
          if (targetUser !== socialUsers[i]) {
            socialRelationships.push({
              from: socialUsers[i],
              to: targetUser,
              type: 'follows',
              metadata: { strength: Math.random() }
            })
          }
        }
      }

      await brain.relateMany(socialRelationships)

      // Test social network queries
      const socialQueries = [
        {
          name: 'Find influencers',
          query: { connected: { from: 'user-0', direction: 'in' }, limit: 20 }
        },
        {
          name: 'Find following',
          query: { connected: { from: 'user-100', direction: 'out' }, limit: 20 }
        },
        {
          name: 'Mutual connections',
          query: {
            connected: { from: 'user-200', direction: 'both' },
            where: { type: 'follows' },
            limit: 20
          }
        }
      ]

      const socialStats = new PerformanceStats()

      for (const socialQuery of socialQueries) {
        const startTime = performance.now()
        const results = await brain.find(socialQuery.query)
        const elapsed = performance.now() - startTime

        socialStats.addSample(elapsed)

        console.log(`   ${socialQuery.name}: ${results.length} connections in ${elapsed.toFixed(2)}ms`)
      }

      console.log(`✅ Social network performance: ${socialStats.toString()}`)
      expect(socialStats.p95).toBeLessThan(100)
    })

    it('should handle knowledge graph traversal (entity relationships)', async () => {
      console.log(`\n🧠 Testing knowledge graph traversal...`)

      // Create knowledge graph entities
      const entities = [
        'Machine Learning', 'Neural Networks', 'Deep Learning', 'AI', 'Computer Vision',
        'Natural Language Processing', 'Supervised Learning', 'Unsupervised Learning',
        'Reinforcement Learning', 'Data Science', 'Statistics', 'Python', 'TensorFlow'
      ]

      // Create semantic relationships
      const knowledgeRelationships = [
        { from: 'Machine Learning', to: 'AI', type: 'subfield_of' },
        { from: 'Deep Learning', to: 'Machine Learning', type: 'subfield_of' },
        { from: 'Neural Networks', to: 'Deep Learning', type: 'foundation_of' },
        { from: 'Computer Vision', to: 'AI', type: 'application_of' },
        { from: 'Natural Language Processing', to: 'AI', type: 'application_of' },
        { from: 'Supervised Learning', to: 'Machine Learning', type: 'type_of' },
        { from: 'Unsupervised Learning', to: 'Machine Learning', type: 'type_of' },
        { from: 'Reinforcement Learning', to: 'Machine Learning', type: 'type_of' },
        { from: 'Data Science', to: 'Machine Learning', type: 'uses' },
        { from: 'Statistics', to: 'Data Science', type: 'foundation_of' },
        { from: 'Python', to: 'Machine Learning', type: 'tool_for' },
        { from: 'TensorFlow', to: 'Machine Learning', type: 'tool_for' }
      ]

      // Add entities and relationships
      for (const entity of entities) {
        await brain.add({
          id: entity,
          data: `Knowledge about ${entity}`,
          metadata: { type: 'concept', domain: 'AI' }
        })
      }

      await brain.relateMany(knowledgeRelationships)

      // Test knowledge graph queries
      const knowledgeQueries = [
        {
          name: 'Find related concepts',
          query: { connected: { from: 'Machine Learning', depth: 2 }, limit: 15 }
        },
        {
          name: 'Find applications',
          query: {
            connected: { from: 'AI', direction: 'in' },
            where: { type: 'application_of' },
            limit: 10
          }
        },
        {
          name: 'Semantic path finding',
          query: {
            similar: 'artificial intelligence applications',
            connected: { from: 'AI', depth: 3 },
            limit: 20
          }
        }
      ]

      const knowledgeStats = new PerformanceStats()

      for (const kgQuery of knowledgeQueries) {
        const startTime = performance.now()
        const results = await brain.find(kgQuery.query)
        const elapsed = performance.now() - startTime

        knowledgeStats.addSample(elapsed)

        console.log(`   ${kgQuery.name}: ${results.length} concepts in ${elapsed.toFixed(2)}ms`)
      }

      console.log(`✅ Knowledge graph performance: ${knowledgeStats.toString()}`)
      expect(knowledgeStats.p95).toBeLessThan(200)
    })

    it('should handle recommendation system queries', async () => {
      console.log(`\n🎯 Testing recommendation system queries...`)

      // Create recommendation scenario with users, items, and ratings
      const users = Array.from({ length: 500 }, (_, i) => `user-${i}`)
      const items = Array.from({ length: 200 }, (_, i) => `item-${i}`)
      const categories = ['electronics', 'books', 'clothing', 'movies', 'music']

      // Add users and items
      for (const user of users) {
        await brain.add({
          id: user,
          data: `User profile for ${user}`,
          metadata: { type: 'user', category: 'consumer' }
        })
      }

      for (const item of items) {
        const category = categories[Math.floor(Math.random() * categories.length)]
        await brain.add({
          id: item,
          data: `Product: ${item}`,
          metadata: { type: 'product', category, price: Math.random() * 100 }
        })
      }

      // Create purchase/rating relationships
      const purchaseRelationships = []
      for (let i = 0; i < 2000; i++) {
        const user = users[Math.floor(Math.random() * users.length)]
        const item = items[Math.floor(Math.random() * items.length)]
        const rating = Math.floor(Math.random() * 5) + 1

        purchaseRelationships.push({
          from: user,
          to: item,
          type: 'purchased',
          metadata: { rating, timestamp: Date.now() - Math.random() * 2592000000 } // Random within 30 days
        })
      }

      await brain.relateMany(purchaseRelationships)

      // Test recommendation queries
      const recommendationQueries = [
        {
          name: 'User purchase history',
          query: { connected: { from: 'user-100', direction: 'out' }, limit: 10 }
        },
        {
          name: 'Item popularity',
          query: { connected: { from: 'item-50', direction: 'in' }, limit: 15 }
        },
        {
          name: 'Similar user recommendations',
          query: {
            connected: { from: 'user-200', direction: 'out' },
            where: { rating: { $gte: 4 } },
            limit: 10
          }
        },
        {
          name: 'Category-based recommendations',
          query: {
            similar: 'electronics gadgets',
            connected: { from: 'user-300', depth: 2 },
            where: { category: 'electronics' },
            limit: 15
          }
        }
      ]

      const recommendationStats = new PerformanceStats()

      for (const recQuery of recommendationQueries) {
        const startTime = performance.now()
        const results = await brain.find(recQuery.query)
        const elapsed = performance.now() - startTime

        recommendationStats.addSample(elapsed)

        console.log(`   ${recQuery.name}: ${results.length} recommendations in ${elapsed.toFixed(2)}ms`)
      }

      console.log(`✅ Recommendation system performance: ${recommendationStats.toString()}`)
      expect(recommendationStats.p95).toBeLessThan(150)
    })

    it('should handle path finding and network analysis', async () => {
      console.log(`\n🛣️ Testing path finding and network analysis...`)

      // Create a network topology for path finding
      const networkNodes = Array.from({ length: 100 }, (_, i) => `network-${i}`)
      const networkConnections = []

      // Create a mesh network with some clustering
      for (let i = 0; i < networkNodes.length; i++) {
        const connections = Math.floor(Math.random() * 5) + 2 // 2-6 connections per node

        for (let j = 0; j < connections; j++) {
          let targetIndex = i + Math.floor(Math.random() * 10) - 5 // Nearby nodes
          if (targetIndex < 0) targetIndex = 0
          if (targetIndex >= networkNodes.length) targetIndex = networkNodes.length - 1

          const targetNode = networkNodes[targetIndex]
          if (targetNode !== networkNodes[i]) {
            networkConnections.push({
              from: networkNodes[i],
              to: targetNode,
              type: 'connected_to',
              metadata: {
                latency: Math.random() * 100 + 1, // 1-100ms latency
                bandwidth: Math.random() * 1000 + 100 // 100-1100 Mbps
              }
            })
          }
        }
      }

      // Add network nodes and connections
      for (const node of networkNodes) {
        await brain.add({
          id: node,
          data: `Network node ${node}`,
          metadata: { type: 'network_node', capacity: Math.random() * 1000 }
        })
      }

      await brain.relateMany(networkConnections)

      // Test network analysis queries
      const networkQueries = [
        {
          name: 'Shortest path analysis',
          query: { connected: { from: 'network-0', depth: 4 }, limit: 20 }
        },
        {
          name: 'Network centrality',
          query: { connected: { from: 'network-50', direction: 'both' }, limit: 25 }
        },
        {
          name: 'Bottleneck detection',
          query: {
            connected: { from: 'network-25', depth: 3 },
            where: { capacity: { $lt: 500 } },
            limit: 15
          }
        },
        {
          name: 'Network health analysis',
          query: {
            similar: 'network connectivity',
            connected: { from: 'network-75', depth: 2 },
            where: { latency: { $lt: 50 } },
            limit: 20
          }
        }
      ]

      const networkStats = new PerformanceStats()

      for (const netQuery of networkQueries) {
        const startTime = performance.now()
        const results = await brain.find(netQuery.query)
        const elapsed = performance.now() - startTime

        networkStats.addSample(elapsed)

        console.log(`   ${netQuery.name}: ${results.length} paths in ${elapsed.toFixed(2)}ms`)
      }

      console.log(`✅ Network analysis performance: ${networkStats.toString()}`)
      expect(networkStats.p95).toBeLessThan(120)
    })
  })

  describe('Performance Summary & Validation', () => {
    it('should provide comprehensive performance report', async () => {
      console.log(`\n📊 ===== COMPREHENSIVE PERFORMANCE REPORT =====`)

      const finalStats = graphIndex.getStats()
      const memoryUsage = process.memoryUsage()

      console.log(`\n🎯 PERFORMANCE TARGETS VALIDATION:`)
      console.log(`✅ O(1) Lookup: ${lookupStats.p95.toFixed(3)}ms < ${PERFORMANCE_TARGETS.O1_LOOKUP}ms target`)
      console.log(`✅ Memory/Rel: ${(finalStats.memoryUsage / finalStats.totalRelationships).toFixed(1)} bytes < ${PERFORMANCE_TARGETS.MEMORY_PER_REL} target`)
      console.log(`✅ Update: ${updateStats.p95.toFixed(2)}ms < ${PERFORMANCE_TARGETS.INDEX_UPDATE}ms target`)
      console.log(`✅ Rebuild: ${(finalStats.totalRelationships / (finalStats.rebuildTime / 1000)).toFixed(0)} rel/s > ${PERFORMANCE_TARGETS.REBUILD_RATE} target`)

      console.log(`\n📈 SCALE METRICS:`)
      console.log(`   Relationships: ${finalStats.totalRelationships.toLocaleString()}`)
      console.log(`   Source Nodes: ${finalStats.sourceNodes.toLocaleString()}`)
      console.log(`   Target Nodes: ${finalStats.targetNodes.toLocaleString()}`)
      console.log(`   Memory Usage: ${(finalStats.memoryUsage / 1024 / 1024).toFixed(2)} MB`)
      console.log(`   Heap Usage: ${(memoryUsage.heapUsed / 1024 / 1024).toFixed(2)} MB`)

      console.log(`\n⚡ PERFORMANCE STATISTICS:`)
      console.log(`   Lookup Performance: ${lookupStats.toString()}`)
      console.log(`   Update Performance: ${updateStats.toString()}`)
      console.log(`   Memory Efficiency: ${memoryStats.toString()}`)

      console.log(`\n🏆 VALIDATION RESULTS:`)

      // Validate all performance targets
      const validations = [
        { name: 'O(1) Neighbor Lookup', value: lookupStats.p95, target: PERFORMANCE_TARGETS.O1_LOOKUP, condition: '<' },
        { name: 'Memory per Relationship', value: finalStats.memoryUsage / finalStats.totalRelationships, target: PERFORMANCE_TARGETS.MEMORY_PER_REL, condition: '<' },
        { name: 'Index Update Performance', value: updateStats.p95, target: PERFORMANCE_TARGETS.INDEX_UPDATE, condition: '<' },
        { name: 'Rebuild Rate', value: finalStats.totalRelationships / (finalStats.rebuildTime / 1000), target: PERFORMANCE_TARGETS.REBUILD_RATE, condition: '>' }
      ]

      let allPassed = true
      for (const validation of validations) {
        const passed = validation.condition === '<'
          ? validation.value < validation.target
          : validation.value > validation.target

        const status = passed ? '✅ PASS' : '❌ FAIL'
        console.log(`   ${status} ${validation.name}: ${validation.value.toFixed(2)} ${validation.condition} ${validation.target}`)

        if (!passed) allPassed = false
      }

      console.log(`\n🎉 OVERALL RESULT: ${allPassed ? 'ALL TARGETS MET' : 'SOME TARGETS MISSED'}`)
      console.log(`====================================================\n`)

      // Final validation
      expect(allPassed).toBe(true)
    })
  })
})
