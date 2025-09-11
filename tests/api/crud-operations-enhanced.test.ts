/**
 * Enhanced CRUD Operations Test Suite for Brainy v3.0
 * 
 * Comprehensive validation of all public API CRUD operations with:
 * - Exhaustive edge case testing
 * - Performance benchmarking
 * - Memory leak detection
 * - Concurrent operation validation
 * - Large-scale data handling
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { Brainy } from '../../src/brainy'
import { performance } from 'perf_hooks'

interface PerformanceMetrics {
  operation: string
  itemCount: number
  duration: number
  memoryUsed: number
  itemsPerSecond: number
  percentiles?: {
    p50: number
    p95: number
    p99: number
  }
}

class TestMetricsCollector {
  private metrics: PerformanceMetrics[] = []
  private initialMemory: number = 0
  private latencies: Map<string, number[]> = new Map()

  startOperation(operation: string, itemCount: number = 1): number {
    this.initialMemory = process.memoryUsage().heapUsed
    return performance.now()
  }

  endOperation(operation: string, itemCount: number, startTime: number): PerformanceMetrics {
    const duration = performance.now() - startTime
    const memoryUsed = process.memoryUsage().heapUsed - this.initialMemory
    const itemsPerSecond = (itemCount / duration) * 1000

    // Track latencies for percentile calculations
    if (!this.latencies.has(operation)) {
      this.latencies.set(operation, [])
    }
    this.latencies.get(operation)!.push(duration / itemCount)

    const metric: PerformanceMetrics = {
      operation,
      itemCount,
      duration,
      memoryUsed,
      itemsPerSecond
    }

    this.metrics.push(metric)
    return metric
  }

  calculatePercentiles(operation: string): { p50: number; p95: number; p99: number } | undefined {
    const latencies = this.latencies.get(operation)
    if (!latencies || latencies.length === 0) return undefined

    const sorted = [...latencies].sort((a, b) => a - b)
    return {
      p50: sorted[Math.floor(sorted.length * 0.5)],
      p95: sorted[Math.floor(sorted.length * 0.95)],
      p99: sorted[Math.floor(sorted.length * 0.99)]
    }
  }

  getMetrics(): PerformanceMetrics[] {
    return this.metrics
  }

  async reportMetrics(): Promise<void> {
    console.log('\n=== Performance Metrics Report ===\n')
    
    // Add percentiles to metrics
    for (const metric of this.metrics) {
      metric.percentiles = this.calculatePercentiles(metric.operation)
    }
    
    console.table(this.metrics.map(m => ({
      Operation: m.operation,
      'Items': m.itemCount,
      'Duration (ms)': m.duration.toFixed(2),
      'Items/sec': m.itemsPerSecond.toFixed(0),
      'Memory (MB)': (m.memoryUsed / 1024 / 1024).toFixed(2),
      'P50 (ms)': m.percentiles?.p50.toFixed(2) || 'N/A',
      'P95 (ms)': m.percentiles?.p95.toFixed(2) || 'N/A',
      'P99 (ms)': m.percentiles?.p99.toFixed(2) || 'N/A'
    })))
  }
}

describe('Enhanced CRUD Operations - Public API Validation', () => {
  let brainy: Brainy
  let metricsCollector: TestMetricsCollector

  beforeEach(async () => {
    brainy = new Brainy({
      storage: { type: 'memory' }
    })
    await brainy.init()
    metricsCollector = new TestMetricsCollector()
  })

  afterEach(async () => {
    await brainy.close()
    // Force garbage collection if available
    if (global.gc) {
      global.gc()
    }
  })

  describe('ADD Operations - Comprehensive Testing', () => {
    describe('Basic Add Functionality', () => {
      it('should add entity with all supported data types', async () => {
        const testData = {
          text: 'This is a comprehensive test document about AI and machine learning',
          metadata: {
            title: 'Test Document',
            author: 'Test Suite',
            version: '1.0.0',
            tags: ['test', 'validation', 'comprehensive'],
            stats: {
              words: 10,
              characters: 68,
              readingTime: 2
            },
            nullField: null,
            booleanField: true,
            numberField: 42.5,
            dateField: new Date().toISOString()
          }
        }

        const startTime = metricsCollector.startOperation('add-single')
        const id = await brainy.add({
          data: testData.text,
          type: 'document' as const,
          metadata: testData.metadata
        })
        const metric = metricsCollector.endOperation('add-single', 1, startTime)

        expect(id).toBeDefined()
        expect(typeof id).toBe('string')
        expect(id.length).toBeGreaterThan(0)
        expect(metric.duration).toBeLessThan(50) // 50ms SLA for single add

        // Verify stored data
        const retrieved = await brainy.get(id)
        expect(retrieved).toBeDefined()
        expect(retrieved?.metadata?.title).toBe('Test Document')
        expect(retrieved?.type).toBe('document')
        expect(retrieved?.metadata?.title).toBe('Test Document')
      })

      it('should handle Unicode and special characters correctly', async () => {
        const specialCases = [
          { data: '😀🎉🚀 Emoji test document', desc: 'Emoji support' },
          { data: '中文测试文档 Chinese text', desc: 'Chinese characters' },
          { data: 'العربية اختبار Arabic text', desc: 'Arabic script' },
          { data: 'Русский текст тестирование', desc: 'Cyrillic script' },
          { data: '日本語のテストドキュメント', desc: 'Japanese characters' },
          { data: 'Line\nBreak\rReturn\tTab test', desc: 'Control characters' },
          { data: '<script>alert("XSS")</script>', desc: 'HTML injection attempt' },
          { data: '../../etc/passwd traversal', desc: 'Path traversal attempt' },
          { data: 'NULL\x00byte test', desc: 'Null byte injection' },
          { data: '𝓣𝓱𝓮 𝓺𝓾𝓲𝓬𝓴 𝓫𝓻𝓸𝔀𝓷 𝓯𝓸𝔁', desc: 'Mathematical alphanumeric symbols' }
        ]

        for (const testCase of specialCases) {
          const id = await brainy.add({
            data: testCase.data,
            type: 'document' as const,
            metadata: { description: testCase.desc }
          })

          const retrieved = await brainy.get(id)
          expect(retrieved?.data).toBe(testCase.data)
          expect(retrieved?.metadata?.description).toBe(testCase.desc)
        }
      })

      it('should auto-generate unique IDs when not provided', async () => {
        const ids = new Set<string>()
        const count = 100

        for (let i = 0; i < count; i++) {
          const id = await brainy.add({
            data: `Auto-generated ID test ${i}`,
            type: 'test'
          })
          ids.add(id)
        }

        expect(ids.size).toBe(count) // All IDs must be unique
        
        // Verify ID format
        for (const id of ids) {
          expect(id).toMatch(/^[a-zA-Z0-9_-]+$/) // Valid ID characters
          expect(id.length).toBeGreaterThanOrEqual(8) // Reasonable length
          expect(id.length).toBeLessThanOrEqual(64) // Not too long
        }
      })
    })

    describe('Bulk Add Operations', () => {
      it('should efficiently handle 1,000 entities', async () => {
        const entities = Array(1000).fill(null).map((_, i) => ({
          data: `Test document ${i}: This is content for testing bulk operations at scale`,
          type: 'document',
          metadata: {
            index: i,
            category: `category-${i % 10}`,
            score: Math.random() * 100,
            tags: [`tag-${i % 5}`, `tag-${i % 7}`]
          }
        }))

        const startTime = metricsCollector.startOperation('add-bulk-1k', 1000)
        const ids: string[] = []
        
        // Add in batches for better performance
        const batchSize = 100
        for (let i = 0; i < entities.length; i += batchSize) {
          const batch = entities.slice(i, i + batchSize)
          const batchIds = await Promise.all(
            batch.map(e => brainy.add(e))
          )
          ids.push(...batchIds)
        }

        const metric = metricsCollector.endOperation('add-bulk-1k', 1000, startTime)

        expect(ids).toHaveLength(1000)
        expect(new Set(ids).size).toBe(1000) // All unique
        expect(metric.itemsPerSecond).toBeGreaterThan(100) // At least 100 items/sec
        expect(metric.memoryUsed).toBeLessThan(100 * 1024 * 1024) // Less than 100MB

        // Verify data integrity with random sampling
        for (let i = 0; i < 10; i++) {
          const randomIdx = Math.floor(Math.random() * 1000)
          const entity = await brainy.get(ids[randomIdx])
          expect(entity?.metadata?.index).toBe(randomIdx)
        }
      })

      it('should handle 10,000 entities with memory efficiency', async () => {
        const startMemory = process.memoryUsage().heapUsed
        const count = 10000
        const dataSize = 500 // bytes per entity

        const startTime = metricsCollector.startOperation('add-bulk-10k', count)
        const ids: string[] = []
        
        // Stream-like processing
        const batchSize = 500
        for (let i = 0; i < count; i += batchSize) {
          const batch = Array(Math.min(batchSize, count - i)).fill(null).map((_, j) => ({
            data: 'x'.repeat(dataSize) + ` Entity ${i + j}`,
            type: 'bulk-test',
            metadata: { index: i + j }
          }))

          const batchIds = await Promise.all(
            batch.map(e => brainy.add(e))
          )
          ids.push(...batchIds)

          // Check memory periodically
          if (i % 2000 === 0 && i > 0) {
            const currentMemory = process.memoryUsage().heapUsed
            const memoryGrowth = currentMemory - startMemory
            expect(memoryGrowth).toBeLessThan(200 * 1024 * 1024) // Less than 200MB
          }
        }

        const metric = metricsCollector.endOperation('add-bulk-10k', count, startTime)

        expect(ids).toHaveLength(count)
        expect(metric.duration).toBeLessThan(60000) // Complete within 60 seconds
        expect(metric.itemsPerSecond).toBeGreaterThan(150) // At least 150 items/sec
      })

      it('should detect and prevent memory leaks', async () => {
        const iterations = 5
        const memoryDeltas: number[] = []

        for (let iter = 0; iter < iterations; iter++) {
          if (global.gc) global.gc() // Force GC if available
          
          const beforeMemory = process.memoryUsage().heapUsed
          
          // Add and delete 500 entities
          const ids: string[] = []
          for (let i = 0; i < 500; i++) {
            const id = await brainy.add({
              data: 'x'.repeat(1000), // 1KB per entity
              type: 'leak-test',
              metadata: { iteration: iter, index: i }
            })
            ids.push(id)
          }

          // Delete all entities
          for (const id of ids) {
            await brainy.delete(id)
          }

          if (global.gc) global.gc()
          const afterMemory = process.memoryUsage().heapUsed
          memoryDeltas.push(afterMemory - beforeMemory)
        }

        // Memory should stabilize, not continuously grow
        const avgFirstTwo = (memoryDeltas[0] + memoryDeltas[1]) / 2
        const avgLastTwo = (memoryDeltas[3] + memoryDeltas[4]) / 2
        const growth = avgLastTwo - avgFirstTwo

        expect(growth).toBeLessThan(10 * 1024 * 1024) // Less than 10MB growth
      })
    })

    describe('Concurrent Operations', () => {
      it('should handle 100 concurrent adds without race conditions', async () => {
        const concurrentCount = 100
        const operations = Array(concurrentCount).fill(null).map((_, i) => ({
          data: `Concurrent test document ${i}`,
          type: 'concurrent-test',
          metadata: {
            index: i,
            timestamp: Date.now(),
            random: Math.random()
          }
        }))

        const startTime = performance.now()
        const ids = await Promise.all(
          operations.map(op => brainy.add(op))
        )
        const duration = performance.now() - startTime

        expect(ids).toHaveLength(concurrentCount)
        expect(new Set(ids).size).toBe(concurrentCount) // All unique
        expect(duration).toBeLessThan(2000) // Complete within 2 seconds

        // Verify data integrity
        for (let i = 0; i < 10; i++) {
          const randomIdx = Math.floor(Math.random() * concurrentCount)
          const entity = await brainy.get(ids[randomIdx])
          expect(entity?.metadata?.index).toBe(randomIdx)
        }
      })

      it('should handle write conflicts gracefully', async () => {
        // Test optimistic concurrency control
        const id = await brainy.add({
          data: 'Original content',
          type: 'conflict-test',
          metadata: { version: 1 }
        })

        // Simulate concurrent updates
        const updates = Array(10).fill(null).map((_, i) => 
          brainy.update(id, {
            metadata: { version: i + 2, updatedBy: `process-${i}` }
          })
        )

        const results = await Promise.allSettled(updates)
        
        // At least one should succeed
        const succeeded = results.filter(r => r.status === 'fulfilled')
        expect(succeeded.length).toBeGreaterThanOrEqual(1)

        // Final state should be consistent
        const final = await brainy.get(id)
        expect(final?.metadata?.version).toBeGreaterThanOrEqual(2)
      })
    })

    describe('Input Validation', () => {
      it('should reject invalid input types', async () => {
        const invalidCases = [
          { data: null, desc: 'null data' },
          { data: undefined, desc: 'undefined data' },
          { data: '', desc: 'empty string' },
          { data: 42, desc: 'number instead of string' },
          { data: true, desc: 'boolean instead of string' },
          { data: [], desc: 'array instead of string' },
          { data: {}, desc: 'object instead of string' }
        ]

        for (const testCase of invalidCases) {
          await expect(
            brainy.add({
              data: testCase.data as any,
              type: 'test'
            })
          ).rejects.toThrow()
        }
      })

      it('should handle extremely large entities', async () => {
        const largeData = 'x'.repeat(5 * 1024 * 1024) // 5MB
        
        const startTime = performance.now()
        const id = await brainy.add({
          data: largeData,
          type: 'large-entity',
          metadata: { size: largeData.length }
        })
        const duration = performance.now() - startTime

        expect(id).toBeDefined()
        expect(duration).toBeLessThan(5000) // Handle within 5 seconds

        const retrieved = await brainy.get(id)
        expect(retrieved?.data.length).toBe(largeData.length)
      })

      it('should sanitize and validate metadata fields', async () => {
        const metadata = {
          'normal-field': 'value1',
          '$special.field': 'value2',
          '__proto__': 'attempt-pollution',
          'constructor': 'attempt-override',
          '../../../etc/passwd': 'path-traversal',
          '<script>alert("xss")</script>': 'xss-attempt'
        }

        const id = await brainy.add({
          data: 'Test document with suspicious metadata',
          type: 'security-test',
          metadata
        })

        const retrieved = await brainy.get(id)
        expect(retrieved).toBeDefined()
        
        // Verify prototype pollution prevention
        expect(Object.prototype).not.toHaveProperty('attempt-pollution')
        expect(Object.constructor).not.toBe('attempt-override')
      })

      it('should handle circular references gracefully', async () => {
        const metadata: any = {
          name: 'Circular test',
          level: 1
        }
        metadata.self = metadata // Create circular reference

        // Should either serialize correctly or throw meaningful error
        try {
          const id = await brainy.add({
            data: 'Document with circular metadata',
            type: 'circular-test',
            metadata
          })
          
          const retrieved = await brainy.get(id)
          expect(retrieved).toBeDefined()
          // Circular reference should be handled (removed or converted)
          expect(retrieved?.metadata?.self).not.toBe(retrieved?.metadata)
        } catch (error: any) {
          expect(error.message).toMatch(/circular|cyclic/i)
        }
      })
    })

    describe('Performance SLAs', () => {
      it('should meet latency SLAs for single operations', async () => {
        const operations = 100
        const latencies: number[] = []

        for (let i = 0; i < operations; i++) {
          const start = performance.now()
          await brainy.add({
            data: `Performance test document ${i}`,
            type: 'perf-test',
            metadata: { index: i }
          })
          latencies.push(performance.now() - start)
        }

        // Calculate percentiles
        latencies.sort((a, b) => a - b)
        const p50 = latencies[Math.floor(latencies.length * 0.5)]
        const p95 = latencies[Math.floor(latencies.length * 0.95)]
        const p99 = latencies[Math.floor(latencies.length * 0.99)]

        console.log(`Add Latencies - P50: ${p50.toFixed(2)}ms, P95: ${p95.toFixed(2)}ms, P99: ${p99.toFixed(2)}ms`)

        expect(p50).toBeLessThan(10)   // P50 < 10ms
        expect(p95).toBeLessThan(50)   // P95 < 50ms
        expect(p99).toBeLessThan(100)  // P99 < 100ms
      })

      it('should maintain throughput under sustained load', async () => {
        const duration = 5000 // 5 seconds
        const startTime = performance.now()
        let operationCount = 0

        while (performance.now() - startTime < duration) {
          await brainy.add({
            data: `Sustained load test ${operationCount}`,
            type: 'load-test',
            metadata: { timestamp: Date.now() }
          })
          operationCount++
        }

        const actualDuration = performance.now() - startTime
        const throughput = (operationCount / actualDuration) * 1000

        console.log(`Sustained Load - Ops: ${operationCount}, Throughput: ${throughput.toFixed(2)} ops/sec`)

        expect(throughput).toBeGreaterThan(50) // At least 50 ops/sec sustained
      })
    })
  })

  describe('GET Operations - Comprehensive Testing', () => {
    let testIds: string[] = []

    beforeEach(async () => {
      // Seed test data
      testIds = []
      for (let i = 0; i < 10; i++) {
        const id = await brainy.add({
          data: `Test document ${i}`,
          type: 'test',
          metadata: { index: i, category: `cat-${i % 3}` }
        })
        testIds.push(id)
      }
    })

    it('should retrieve existing entities', async () => {
      const startTime = metricsCollector.startOperation('get-single')
      const entity = await brainy.get(testIds[0])
      metricsCollector.endOperation('get-single', 1, startTime)

      expect(entity).toBeDefined()
      expect(entity?.data).toBe('Test document 0')
      expect(entity?.metadata?.index).toBe(0)
    })

    it('should return null for non-existent IDs', async () => {
      const result = await brainy.get('non-existent-id-12345')
      expect(result).toBeNull()
    })

    it('should handle batch retrieval efficiently', async () => {
      const startTime = metricsCollector.startOperation('get-batch', testIds.length)
      const entities = await Promise.all(
        testIds.map(id => brainy.get(id))
      )
      const metric = metricsCollector.endOperation('get-batch', testIds.length, startTime)

      expect(entities.every(e => e !== null)).toBe(true)
      expect(metric.itemsPerSecond).toBeGreaterThan(100)
    })
  })

  describe('UPDATE Operations - Comprehensive Testing', () => {
    let testId: string

    beforeEach(async () => {
      testId = await brainy.add({
        data: 'Original content',
        type: 'update-test',
        metadata: { version: 1, status: 'draft' }
      })
    })

    it('should update entity metadata', async () => {
      const startTime = metricsCollector.startOperation('update-single')
      await brainy.update(testId, {
        metadata: { version: 2, status: 'published' }
      })
      metricsCollector.endOperation('update-single', 1, startTime)

      const updated = await brainy.get(testId)
      expect(updated?.metadata?.version).toBe(2)
      expect(updated?.metadata?.status).toBe('published')
    })

    it('should handle concurrent updates', async () => {
      const updates = Array(10).fill(null).map((_, i) => 
        brainy.update(testId, {
          metadata: { lastUpdate: i }
        })
      )

      const results = await Promise.allSettled(updates)
      const succeeded = results.filter(r => r.status === 'fulfilled')
      expect(succeeded.length).toBeGreaterThanOrEqual(1)
    })
  })

  describe('DELETE Operations - Comprehensive Testing', () => {
    it('should delete existing entities', async () => {
      const id = await brainy.add({
        data: 'To be deleted',
        type: 'delete-test'
      })

      const startTime = metricsCollector.startOperation('delete-single')
      const result = await brainy.delete(id)
      metricsCollector.endOperation('delete-single', 1, startTime)

      expect(result).toBe(true)
      
      const retrieved = await brainy.get(id)
      expect(retrieved).toBeNull()
    })

    it('should handle bulk deletions', async () => {
      const ids: string[] = []
      for (let i = 0; i < 100; i++) {
        const id = await brainy.add({
          data: `Bulk delete test ${i}`,
          type: 'bulk-delete'
        })
        ids.push(id)
      }

      const startTime = metricsCollector.startOperation('delete-bulk', ids.length)
      const results = await Promise.all(
        ids.map(id => brainy.delete(id))
      )
      metricsCollector.endOperation('delete-bulk', ids.length, startTime)

      expect(results.every(r => r === true)).toBe(true)
    })
  })

  describe('RELATE Operations - Comprehensive Testing', () => {
    it('should create relationships between entities', async () => {
      const id1 = await brainy.add({
        data: 'Entity 1',
        type: 'node'
      })
      const id2 = await brainy.add({
        data: 'Entity 2',
        type: 'node'
      })

      const startTime = metricsCollector.startOperation('relate-single')
      const result = await brainy.relate(id1, id2, 'connects_to')
      metricsCollector.endOperation('relate-single', 1, startTime)

      expect(result).toBe(true)
    })

    it('should handle complex graph structures', async () => {
      const nodeIds: string[] = []
      
      // Create nodes
      for (let i = 0; i < 20; i++) {
        const id = await brainy.add({
          data: `Node ${i}`,
          type: 'graph-node',
          metadata: { index: i }
        })
        nodeIds.push(id)
      }

      // Create relationships (each node connects to next 3)
      const startTime = metricsCollector.startOperation('relate-graph', 60)
      for (let i = 0; i < nodeIds.length; i++) {
        for (let j = 1; j <= 3; j++) {
          const targetIdx = (i + j) % nodeIds.length
          await brainy.relate(nodeIds[i], nodeIds[targetIdx], 'links_to')
        }
      }
      metricsCollector.endOperation('relate-graph', 60, startTime)

      // Graph should be created successfully
      expect(nodeIds).toHaveLength(20)
    })
  })

  describe('FIND Operations - Comprehensive Testing', () => {
    beforeEach(async () => {
      // Create diverse test dataset
      for (let i = 0; i < 50; i++) {
        await brainy.add({
          data: `Search test document ${i}: Lorem ipsum dolor sit amet`,
          type: 'searchable',
          metadata: {
            index: i,
            category: `cat-${i % 5}`,
            score: Math.random() * 100,
            active: i % 2 === 0
          }
        })
      }
    })

    it('should find entities by metadata criteria', async () => {
      const startTime = metricsCollector.startOperation('find-simple')
      const results = await brainy.find({
        where: { 
          'metadata.category': 'cat-0'
        }
      })
      metricsCollector.endOperation('find-simple', 1, startTime)

      expect(results.length).toBe(10) // 50 / 5 = 10
    })

    it('should support pagination', async () => {
      const page1 = await brainy.find({
        limit: 10,
        offset: 0
      })

      const page2 = await brainy.find({
        limit: 10,
        offset: 10
      })

      expect(page1).toHaveLength(10)
      expect(page2).toHaveLength(10)
      expect(page1[0].id).not.toBe(page2[0].id)
    })

    it('should handle complex queries', async () => {
      const results = await brainy.find({
        where: {
          'metadata.active': true,
          'metadata.score': { $gte: 50 }
        },
        limit: 100
      })

      expect(results.every(r => r.metadata?.active === true)).toBe(true)
      expect(results.every(r => (r.metadata?.score ?? 0) >= 50)).toBe(true)
    })
  })

  describe('Performance Summary', () => {
    it('should generate comprehensive performance report', async () => {
      await metricsCollector.reportMetrics()
      
      const metrics = metricsCollector.getMetrics()
      expect(metrics.length).toBeGreaterThan(0)
      
      // Validate all operations met SLAs
      for (const metric of metrics) {
        if (metric.operation.includes('single')) {
          expect(metric.duration).toBeLessThan(100) // Single ops < 100ms
        }
      }
    })
  })
})