/**
 * Performance Benchmark Test Suite for Brainy v3.0
 * 
 * Comprehensive performance validation including:
 * - Latency SLA verification (P50, P95, P99)
 * - Throughput testing at scale
 * - Memory usage monitoring
 * - Concurrent operation handling
 * - Resource utilization tracking
 * - Performance regression detection
 */

import { describe, it, expect, beforeEach, afterEach, beforeAll } from 'vitest'
import { Brainy } from '../../src/brainy'
import { performance } from 'perf_hooks'

interface PerformanceResult {
  operation: string
  iterations: number
  duration: number
  throughput: number
  latencies: {
    p50: number
    p95: number
    p99: number
    min: number
    max: number
    mean: number
  }
  memory: {
    initial: number
    peak: number
    final: number
    delta: number
  }
}

class PerformanceBenchmark {
  private results: PerformanceResult[] = []
  private latencies: number[] = []
  private initialMemory: number = 0
  private peakMemory: number = 0

  constructor(private name: string) {}

  start() {
    this.latencies = []
    this.initialMemory = process.memoryUsage().heapUsed
    this.peakMemory = this.initialMemory
  }

  recordOperation(latency: number) {
    this.latencies.push(latency)
    const currentMemory = process.memoryUsage().heapUsed
    if (currentMemory > this.peakMemory) {
      this.peakMemory = currentMemory
    }
  }

  finish(): PerformanceResult {
    const finalMemory = process.memoryUsage().heapUsed
    const sorted = [...this.latencies].sort((a, b) => a - b)
    const totalDuration = this.latencies.reduce((sum, l) => sum + l, 0)
    
    const result: PerformanceResult = {
      operation: this.name,
      iterations: this.latencies.length,
      duration: totalDuration,
      throughput: (this.latencies.length / totalDuration) * 1000,
      latencies: {
        p50: sorted[Math.floor(sorted.length * 0.5)] || 0,
        p95: sorted[Math.floor(sorted.length * 0.95)] || 0,
        p99: sorted[Math.floor(sorted.length * 0.99)] || 0,
        min: sorted[0] || 0,
        max: sorted[sorted.length - 1] || 0,
        mean: totalDuration / this.latencies.length || 0
      },
      memory: {
        initial: this.initialMemory,
        peak: this.peakMemory,
        final: finalMemory,
        delta: finalMemory - this.initialMemory
      }
    }

    this.results.push(result)
    return result
  }

  static generateReport(results: PerformanceResult[]) {
    console.log('\n=== Performance Benchmark Report ===\n')
    
    const table = results.map(r => ({
      Operation: r.operation,
      'Iterations': r.iterations,
      'Throughput (ops/s)': r.throughput.toFixed(0),
      'P50 (ms)': r.latencies.p50.toFixed(2),
      'P95 (ms)': r.latencies.p95.toFixed(2),
      'P99 (ms)': r.latencies.p99.toFixed(2),
      'Memory (MB)': (r.memory.delta / 1024 / 1024).toFixed(2)
    }))
    
    console.table(table)
    
    // Summary statistics
    console.log('\n=== Summary ===')
    console.log(`Total operations: ${results.reduce((sum, r) => sum + r.iterations, 0)}`)
    console.log(`Average throughput: ${(results.reduce((sum, r) => sum + r.throughput, 0) / results.length).toFixed(0)} ops/s`)
    console.log(`Total memory used: ${(results.reduce((sum, r) => sum + r.memory.delta, 0) / 1024 / 1024).toFixed(2)} MB`)
  }
}

describe('Performance Benchmarks - SLA Validation', () => {
  let brainy: Brainy
  let benchmarkResults: PerformanceResult[] = []

  beforeAll(async () => {
    // Warm up the system
    const warmup = new Brainy({ storage: { type: 'memory' } })
    await warmup.init()
    
    // Add some data for warmup
    for (let i = 0; i < 100; i++) {
      await warmup.add({
        data: `Warmup document ${i}`,
        type: 'document'
      })
    }
    
    await warmup.close()
  })

  beforeEach(async () => {
    brainy = new Brainy({
      storage: { type: 'memory' }
    })
    await brainy.init()
  })

  afterEach(async () => {
    await brainy.close()
    if (global.gc) global.gc()
  })

  describe('Single Operation Latency SLAs', () => {
    it('should meet ADD operation latency SLAs', async () => {
      const benchmark = new PerformanceBenchmark('add-single')
      const iterations = 1000
      
      benchmark.start()
      
      for (let i = 0; i < iterations; i++) {
        const start = performance.now()
        await brainy.add({
          data: `Performance test document ${i}`,
          type: 'document',
          metadata: { index: i, timestamp: Date.now() }
        })
        const latency = performance.now() - start
        benchmark.recordOperation(latency)
      }
      
      const result = benchmark.finish()
      benchmarkResults.push(result)
      
      // SLA Assertions
      expect(result.latencies.p50).toBeLessThan(10)   // P50 < 10ms
      expect(result.latencies.p95).toBeLessThan(50)   // P95 < 50ms
      expect(result.latencies.p99).toBeLessThan(100)  // P99 < 100ms
      expect(result.throughput).toBeGreaterThan(100)  // > 100 ops/sec
    })

    it('should meet GET operation latency SLAs', async () => {
      // Seed data
      const ids: string[] = []
      for (let i = 0; i < 1000; i++) {
        const id = await brainy.add({
          data: `Test document ${i}`,
          type: 'document'
        })
        ids.push(id)
      }
      
      const benchmark = new PerformanceBenchmark('get-single')
      benchmark.start()
      
      for (const id of ids) {
        const start = performance.now()
        await brainy.get(id)
        const latency = performance.now() - start
        benchmark.recordOperation(latency)
      }
      
      const result = benchmark.finish()
      benchmarkResults.push(result)
      
      // GET should be faster than ADD
      expect(result.latencies.p50).toBeLessThan(5)    // P50 < 5ms
      expect(result.latencies.p95).toBeLessThan(20)   // P95 < 20ms
      expect(result.latencies.p99).toBeLessThan(50)   // P99 < 50ms
      expect(result.throughput).toBeGreaterThan(200)  // > 200 ops/sec
    })

    it('should meet UPDATE operation latency SLAs', async () => {
      // Seed data
      const ids: string[] = []
      for (let i = 0; i < 500; i++) {
        const id = await brainy.add({
          data: `Update test ${i}`,
          type: 'document',
          metadata: { version: 1 }
        })
        ids.push(id)
      }
      
      const benchmark = new PerformanceBenchmark('update-single')
      benchmark.start()
      
      for (const id of ids) {
        const start = performance.now()
        await brainy.update({
          id,
          metadata: { version: 2, updatedAt: Date.now() }
        })
        const latency = performance.now() - start
        benchmark.recordOperation(latency)
      }
      
      const result = benchmark.finish()
      benchmarkResults.push(result)
      
      expect(result.latencies.p50).toBeLessThan(15)   // P50 < 15ms
      expect(result.latencies.p95).toBeLessThan(60)   // P95 < 60ms
      expect(result.latencies.p99).toBeLessThan(120)  // P99 < 120ms
    })

    it('should meet DELETE operation latency SLAs', async () => {
      // Seed data
      const ids: string[] = []
      for (let i = 0; i < 500; i++) {
        const id = await brainy.add({
          data: `Delete test ${i}`,
          type: 'document'
        })
        ids.push(id)
      }
      
      const benchmark = new PerformanceBenchmark('delete-single')
      benchmark.start()
      
      for (const id of ids) {
        const start = performance.now()
        await brainy.delete(id)
        const latency = performance.now() - start
        benchmark.recordOperation(latency)
      }
      
      const result = benchmark.finish()
      benchmarkResults.push(result)
      
      expect(result.latencies.p50).toBeLessThan(10)   // P50 < 10ms
      expect(result.latencies.p95).toBeLessThan(40)   // P95 < 40ms
      expect(result.latencies.p99).toBeLessThan(80)   // P99 < 80ms
    })
  })

  describe('Throughput Testing', () => {
    it('should maintain throughput under sustained load', async () => {
      const duration = 10000 // 10 seconds
      const benchmark = new PerformanceBenchmark('sustained-load')
      
      benchmark.start()
      const startTime = performance.now()
      let operations = 0
      
      while (performance.now() - startTime < duration) {
        const opStart = performance.now()
        await brainy.add({
          data: `Sustained load test ${operations}`,
          type: 'document',
          metadata: { timestamp: Date.now() }
        })
        const latency = performance.now() - opStart
        benchmark.recordOperation(latency)
        operations++
      }
      
      const result = benchmark.finish()
      benchmarkResults.push(result)
      
      expect(result.throughput).toBeGreaterThan(50)   // At least 50 ops/sec sustained
      expect(result.latencies.p99).toBeLessThan(200)  // P99 stays under 200ms
      expect(operations).toBeGreaterThan(500)         // At least 500 ops in 10 seconds
    })

    it('should handle burst traffic', async () => {
      const benchmark = new PerformanceBenchmark('burst-traffic')
      const burstSize = 1000
      
      benchmark.start()
      const startTime = performance.now()
      
      // Send burst of requests
      const promises = Array(burstSize).fill(null).map((_, i) => 
        brainy.add({
          data: `Burst request ${i}`,
          type: 'document'
        }).then(() => {
          const latency = performance.now() - startTime
          benchmark.recordOperation(latency / burstSize) // Amortized latency
        })
      )
      
      await Promise.all(promises)
      
      const result = benchmark.finish()
      benchmarkResults.push(result)
      
      const totalDuration = performance.now() - startTime
      const burstThroughput = (burstSize / totalDuration) * 1000
      
      expect(burstThroughput).toBeGreaterThan(100)    // Handle > 100 ops/sec in burst
      expect(totalDuration).toBeLessThan(10000)       // Complete 1000 ops in < 10 seconds
    })
  })

  describe('Concurrent Operations', () => {
    it('should handle concurrent reads efficiently', async () => {
      // Seed data
      const ids: string[] = []
      for (let i = 0; i < 100; i++) {
        const id = await brainy.add({
          data: `Concurrent read test ${i}`,
          type: 'document'
        })
        ids.push(id)
      }
      
      const benchmark = new PerformanceBenchmark('concurrent-reads')
      const concurrency = 50
      const iterations = 10
      
      benchmark.start()
      
      for (let iter = 0; iter < iterations; iter++) {
        const startTime = performance.now()
        
        // Concurrent reads
        await Promise.all(
          Array(concurrency).fill(null).map((_, i) => 
            brainy.get(ids[i % ids.length])
          )
        )
        
        const latency = performance.now() - startTime
        benchmark.recordOperation(latency)
      }
      
      const result = benchmark.finish()
      benchmarkResults.push(result)
      
      // Concurrent reads should be efficient
      expect(result.latencies.mean).toBeLessThan(100) // Average < 100ms for 50 concurrent
    })

    it('should handle mixed concurrent operations', async () => {
      const benchmark = new PerformanceBenchmark('concurrent-mixed')
      const concurrency = 20
      const iterations = 5
      
      benchmark.start()
      
      for (let iter = 0; iter < iterations; iter++) {
        const startTime = performance.now()
        
        const operations = Array(concurrency).fill(null).map((_, i) => {
          const op = i % 4
          switch (op) {
            case 0: // ADD
              return brainy.add({
                data: `Concurrent add ${iter}-${i}`,
                type: 'document'
              })
            case 1: // GET
              return brainy.get(`test-${i}`)
            case 2: // UPDATE
              return brainy.update({
                id: `test-${i}`,
                metadata: { updated: Date.now() }
              }).catch(() => null) // Ignore if doesn't exist
            case 3: // DELETE
              return brainy.delete(`test-${i}`).catch(() => null)
            default:
              return Promise.resolve()
          }
        })
        
        await Promise.all(operations)
        
        const latency = performance.now() - startTime
        benchmark.recordOperation(latency)
      }
      
      const result = benchmark.finish()
      benchmarkResults.push(result)
      
      expect(result.latencies.p95).toBeLessThan(200) // P95 < 200ms for mixed ops
    })
  })

  describe('Memory Efficiency', () => {
    it('should not leak memory during operations', async () => {
      const benchmark = new PerformanceBenchmark('memory-leak-test')
      const iterations = 5
      const opsPerIteration = 1000
      
      benchmark.start()
      
      for (let iter = 0; iter < iterations; iter++) {
        if (global.gc) global.gc() // Force GC if available
        
        const startMemory = process.memoryUsage().heapUsed
        const startTime = performance.now()
        
        // Add and delete many entities
        const ids: string[] = []
        for (let i = 0; i < opsPerIteration; i++) {
          const id = await brainy.add({
            data: `Memory test ${iter}-${i}`,
            type: 'document'
          })
          ids.push(id)
        }
        
        for (const id of ids) {
          await brainy.delete(id)
        }
        
        if (global.gc) global.gc()
        const endMemory = process.memoryUsage().heapUsed
        const latency = performance.now() - startTime
        
        benchmark.recordOperation(latency)
        
        // Memory should not grow significantly
        const memoryGrowth = endMemory - startMemory
        expect(memoryGrowth).toBeLessThan(10 * 1024 * 1024) // Less than 10MB growth
      }
      
      const result = benchmark.finish()
      benchmarkResults.push(result)
      
      // Overall memory delta should be minimal
      expect(result.memory.delta).toBeLessThan(20 * 1024 * 1024) // Less than 20MB total
    })

    it('should handle large entities efficiently', async () => {
      const benchmark = new PerformanceBenchmark('large-entities')
      const entitySize = 100 * 1024 // 100KB per entity
      const count = 100
      
      benchmark.start()
      
      for (let i = 0; i < count; i++) {
        const largeData = 'x'.repeat(entitySize)
        const start = performance.now()
        
        await brainy.add({
          data: largeData,
          type: 'document',
          metadata: { size: entitySize, index: i }
        })
        
        const latency = performance.now() - start
        benchmark.recordOperation(latency)
      }
      
      const result = benchmark.finish()
      benchmarkResults.push(result)
      
      // Should handle large entities reasonably
      expect(result.latencies.p95).toBeLessThan(500)  // P95 < 500ms for 100KB entities
      expect(result.memory.delta).toBeLessThan(150 * 1024 * 1024) // Reasonable memory usage
    })
  })

  describe('Search Performance', () => {
    it('should meet FIND operation latency SLAs', async () => {
      // Seed diverse data
      for (let i = 0; i < 1000; i++) {
        await brainy.add({
          data: `Search test document ${i}: Lorem ipsum dolor sit amet`,
          type: 'document',
          metadata: {
            category: `cat-${i % 10}`,
            score: Math.random() * 100,
            active: i % 2 === 0
          }
        })
      }
      
      const benchmark = new PerformanceBenchmark('find-operations')
      
      benchmark.start()
      
      // Test various find operations
      const queries = [
        { where: { 'metadata.category': 'cat-5' } },
        { where: { 'metadata.active': true }, limit: 10 },
        { where: { 'metadata.score': { $gte: 50 } }, limit: 20 },
        { limit: 50 },
        { where: { 'metadata.category': 'cat-0' }, limit: 100 }
      ]
      
      for (let i = 0; i < 100; i++) {
        const query = queries[i % queries.length]
        const start = performance.now()
        await brainy.find(query)
        const latency = performance.now() - start
        benchmark.recordOperation(latency)
      }
      
      const result = benchmark.finish()
      benchmarkResults.push(result)
      
      expect(result.latencies.p50).toBeLessThan(20)   // P50 < 20ms
      expect(result.latencies.p95).toBeLessThan(100)  // P95 < 100ms
      expect(result.latencies.p99).toBeLessThan(200)  // P99 < 200ms
    })

    it('should handle complex queries efficiently', async () => {
      const benchmark = new PerformanceBenchmark('complex-queries')
      
      // Seed data with relationships
      const entities: string[] = []
      for (let i = 0; i < 500; i++) {
        const id = await brainy.add({
          data: `Complex query test ${i}`,
          type: 'thing',
          metadata: {
            level: i % 5,
            group: `group-${i % 10}`,
            tags: [`tag-${i % 3}`, `tag-${i % 7}`]
          }
        })
        entities.push(id)
      }
      
      // Create relationships
      for (let i = 0; i < entities.length - 1; i++) {
        if (i % 10 === 0) {
          await brainy.relate({
            from: entities[i],
            to: entities[i + 1],
            type: 'relatedTo'
          })
        }
      }
      
      benchmark.start()
      
      // Complex queries
      const complexQueries = [
        {
          where: {
            'metadata.level': { $gte: 2 },
            'metadata.group': { $in: ['group-1', 'group-2', 'group-3'] }
          },
          limit: 20
        },
        {
          where: {
            'metadata.tags': { $contains: 'tag-1' }
          },
          limit: 50
        }
      ]
      
      for (let i = 0; i < 50; i++) {
        const query = complexQueries[i % complexQueries.length]
        const start = performance.now()
        await brainy.find(query)
        const latency = performance.now() - start
        benchmark.recordOperation(latency)
      }
      
      const result = benchmark.finish()
      benchmarkResults.push(result)
      
      expect(result.latencies.p95).toBeLessThan(150)  // Complex queries P95 < 150ms
    })
  })

  describe('Batch Operations Performance', () => {
    it('should meet batch ADD performance targets', async () => {
      const benchmark = new PerformanceBenchmark('batch-add')
      const batchSizes = [10, 50, 100, 500]
      
      benchmark.start()
      
      for (const batchSize of batchSizes) {
        const items = Array(batchSize).fill(null).map((_, i) => ({
          data: `Batch item ${i}`,
          type: 'document' as const,
          metadata: { batchSize, index: i }
        }))
        
        const start = performance.now()
        await brainy.addMany({ items })
        const latency = performance.now() - start
        benchmark.recordOperation(latency / batchSize) // Amortized per item
      }
      
      const result = benchmark.finish()
      benchmarkResults.push(result)
      
      // Batch operations should be more efficient than individual
      expect(result.latencies.mean).toBeLessThan(5)   // Average < 5ms per item in batch
    })
  })

  describe('Performance Report', () => {
    it('should generate comprehensive performance report', () => {
      PerformanceBenchmark.generateReport(benchmarkResults)
      
      // Validate overall performance
      const avgThroughput = benchmarkResults.reduce((sum, r) => sum + r.throughput, 0) / benchmarkResults.length
      expect(avgThroughput).toBeGreaterThan(50) // Average > 50 ops/sec across all operations
      
      // Check memory efficiency
      const totalMemory = benchmarkResults.reduce((sum, r) => sum + r.memory.delta, 0)
      expect(totalMemory).toBeLessThan(500 * 1024 * 1024) // Total < 500MB for all tests
      
      // Verify SLA compliance
      const slaViolations = benchmarkResults.filter(r => r.latencies.p99 > 500)
      expect(slaViolations.length).toBeLessThan(2) // Max 1 operation can exceed 500ms P99
    })
  })
})