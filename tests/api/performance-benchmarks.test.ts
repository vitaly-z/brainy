/**
 * Performance Benchmark Test Suite for Brainy
 *
 * Validates latency SLAs, throughput, memory efficiency,
 * concurrent operation handling, and search performance.
 * Scales are kept moderate since each add() involves embedding computation.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { Brainy } from '../../src/brainy'
import { NounType, VerbType } from '../../src/types/graphTypes'
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
      throughput: this.latencies.length > 0 ? (this.latencies.length / totalDuration) * 1000 : 0,
      latencies: {
        p50: sorted[Math.floor(sorted.length * 0.5)] || 0,
        p95: sorted[Math.floor(sorted.length * 0.95)] || 0,
        p99: sorted[Math.floor(sorted.length * 0.99)] || 0,
        min: sorted[0] || 0,
        max: sorted[sorted.length - 1] || 0,
        mean: this.latencies.length > 0 ? totalDuration / this.latencies.length : 0
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

    console.log('\n=== Summary ===')
    console.log(`Total operations: ${results.reduce((sum, r) => sum + r.iterations, 0)}`)
    if (results.length > 0) {
      console.log(`Average throughput: ${(results.reduce((sum, r) => sum + r.throughput, 0) / results.length).toFixed(0)} ops/s`)
    }
    console.log(`Total memory used: ${(results.reduce((sum, r) => sum + r.memory.delta, 0) / 1024 / 1024).toFixed(2)} MB`)
  }
}

describe('Performance Benchmarks - SLA Validation', () => {
  let brainy: Brainy
  const benchmarkResults: PerformanceResult[] = []

  beforeEach(async () => {
    brainy = new Brainy({
      storage: { type: 'memory' }
    })
    await brainy.init()
  })

  afterEach(async () => {
    await brainy.close()
  })

  describe('Single Operation Latency SLAs', () => {
    it('should meet ADD operation latency SLAs', async () => {
      const benchmark = new PerformanceBenchmark('add-single')
      const iterations = 50

      benchmark.start()

      for (let i = 0; i < iterations; i++) {
        const start = performance.now()
        await brainy.add({
          data: `Performance test document ${i} about machine learning`,
          type: NounType.Document,
          metadata: { index: i, timestamp: Date.now() }
        })
        const latency = performance.now() - start
        benchmark.recordOperation(latency)
      }

      const result = benchmark.finish()
      benchmarkResults.push(result)

      // SLA Assertions (each add includes embedding computation)
      expect(result.latencies.p50).toBeLessThan(200)
      expect(result.latencies.p95).toBeLessThan(500)
      expect(result.latencies.p99).toBeLessThan(1000)
      expect(result.throughput).toBeGreaterThan(2)
    }, 120000)

    it('should meet GET operation latency SLAs', async () => {
      // Seed data
      const ids: string[] = []
      for (let i = 0; i < 50; i++) {
        const id = await brainy.add({
          data: `Get benchmark document ${i}`,
          type: NounType.Document
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

      // GET should be fast — no embedding needed
      expect(result.latencies.p50).toBeLessThan(5)
      expect(result.latencies.p95).toBeLessThan(20)
      expect(result.latencies.p99).toBeLessThan(50)
      expect(result.throughput).toBeGreaterThan(100)
    }, 120000)

    it('should meet UPDATE operation latency SLAs', async () => {
      // Seed data
      const ids: string[] = []
      for (let i = 0; i < 30; i++) {
        const id = await brainy.add({
          data: `Update benchmark ${i}`,
          type: NounType.Document,
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

      expect(result.latencies.p50).toBeLessThan(50)
      expect(result.latencies.p95).toBeLessThan(200)
      expect(result.latencies.p99).toBeLessThan(500)
    }, 120000)

    it('should meet DELETE operation latency SLAs', async () => {
      // Seed data
      const ids: string[] = []
      for (let i = 0; i < 30; i++) {
        const id = await brainy.add({
          data: `Delete benchmark ${i}`,
          type: NounType.Document
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

      expect(result.latencies.p50).toBeLessThan(10)
      expect(result.latencies.p95).toBeLessThan(50)
      expect(result.latencies.p99).toBeLessThan(100)
    }, 120000)
  })

  describe('Throughput Testing', () => {
    it('should maintain throughput under sustained load', async () => {
      const durationMs = 5000 // 5 seconds
      const benchmark = new PerformanceBenchmark('sustained-load')

      benchmark.start()
      const startTime = performance.now()
      let operations = 0

      while (performance.now() - startTime < durationMs) {
        const opStart = performance.now()
        await brainy.add({
          data: `Sustained load test ${operations} data processing`,
          type: NounType.Document,
          metadata: { timestamp: Date.now() }
        })
        const latency = performance.now() - opStart
        benchmark.recordOperation(latency)
        operations++
      }

      const result = benchmark.finish()
      benchmarkResults.push(result)

      expect(result.throughput).toBeGreaterThan(2)
      expect(result.latencies.p99).toBeLessThan(1000)
      expect(operations).toBeGreaterThan(10)
    }, 120000)

    it('should handle burst traffic', async () => {
      const benchmark = new PerformanceBenchmark('burst-traffic')
      const burstSize = 30

      benchmark.start()
      const startTime = performance.now()

      const promises = Array.from({ length: burstSize }, (_, i) =>
        brainy.add({
          data: `Burst request ${i} about natural language`,
          type: NounType.Document
        }).then(() => {
          const latency = performance.now() - startTime
          benchmark.recordOperation(latency / burstSize)
        })
      )

      await Promise.all(promises)

      const result = benchmark.finish()
      benchmarkResults.push(result)

      const totalDuration = performance.now() - startTime
      const burstThroughput = (burstSize / totalDuration) * 1000

      expect(burstThroughput).toBeGreaterThan(1)
      expect(totalDuration).toBeLessThan(60000)
    }, 120000)
  })

  describe('Concurrent Operations', () => {
    it('should handle concurrent reads efficiently', async () => {
      // Seed data
      const ids: string[] = []
      for (let i = 0; i < 20; i++) {
        const id = await brainy.add({
          data: `Concurrent read test ${i} information retrieval`,
          type: NounType.Document
        })
        ids.push(id)
      }

      const benchmark = new PerformanceBenchmark('concurrent-reads')
      const concurrency = 10
      const iterations = 5

      benchmark.start()

      for (let iter = 0; iter < iterations; iter++) {
        const startTime = performance.now()

        await Promise.all(
          Array.from({ length: concurrency }, (_, i) =>
            brainy.get(ids[i % ids.length])
          )
        )

        const latency = performance.now() - startTime
        benchmark.recordOperation(latency)
      }

      const result = benchmark.finish()
      benchmarkResults.push(result)

      expect(result.latencies.mean).toBeLessThan(100)
    }, 120000)

    it('should handle mixed concurrent operations', async () => {
      // Seed some entities first so we have valid IDs for get/update/delete
      const seedIds: string[] = []
      for (let i = 0; i < 20; i++) {
        const id = await brainy.add({
          data: `Mixed ops seed ${i}`,
          type: NounType.Document,
          metadata: { v: 1 }
        })
        seedIds.push(id)
      }

      const benchmark = new PerformanceBenchmark('concurrent-mixed')
      const concurrency = 10
      const iterations = 3

      benchmark.start()

      for (let iter = 0; iter < iterations; iter++) {
        const startTime = performance.now()

        const operations = Array.from({ length: concurrency }, (_, i) => {
          const op = i % 3
          switch (op) {
            case 0:
              return brainy.add({
                data: `Concurrent add ${iter}-${i}`,
                type: NounType.Document
              })
            case 1:
              return brainy.get(seedIds[i % seedIds.length])
            case 2:
              return brainy.update({
                id: seedIds[i % seedIds.length],
                metadata: { updated: Date.now() }
              }).catch(() => null)
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

      expect(result.latencies.p95).toBeLessThan(5000)
    }, 120000)
  })

  describe('Memory Efficiency', () => {
    it('should not leak memory during operations', async () => {
      const benchmark = new PerformanceBenchmark('memory-leak-test')
      const iterations = 3
      const opsPerIteration = 20

      benchmark.start()

      for (let iter = 0; iter < iterations; iter++) {
        if (global.gc) global.gc()

        const startMemory = process.memoryUsage().heapUsed
        const startTime = performance.now()

        const ids: string[] = []
        for (let i = 0; i < opsPerIteration; i++) {
          const id = await brainy.add({
            data: `Memory test ${iter}-${i} leak detection`,
            type: NounType.Document
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

        const memoryGrowth = endMemory - startMemory
        expect(memoryGrowth).toBeLessThan(50 * 1024 * 1024)
      }

      const result = benchmark.finish()
      benchmarkResults.push(result)

      expect(result.memory.delta).toBeLessThan(100 * 1024 * 1024)
    }, 120000)

    it('should handle large entities efficiently', async () => {
      const benchmark = new PerformanceBenchmark('large-entities')
      const entitySize = 10 * 1024 // 10KB per entity
      const count = 10

      benchmark.start()

      for (let i = 0; i < count; i++) {
        const largeData = 'x'.repeat(entitySize)
        const start = performance.now()

        await brainy.add({
          data: largeData,
          type: NounType.Document,
          metadata: { size: entitySize, index: i }
        })

        const latency = performance.now() - start
        benchmark.recordOperation(latency)
      }

      const result = benchmark.finish()
      benchmarkResults.push(result)

      expect(result.latencies.p95).toBeLessThan(2000)
      expect(result.memory.delta).toBeLessThan(150 * 1024 * 1024)
    }, 120000)
  })

  describe('Search Performance', () => {
    it('should meet FIND operation latency SLAs', async () => {
      // Seed diverse data
      for (let i = 0; i < 50; i++) {
        await brainy.add({
          data: `Search test document ${i}: artificial intelligence and data science`,
          type: NounType.Document,
          metadata: {
            category: `cat-${i % 5}`,
            score: Math.random() * 100,
            active: i % 2 === 0
          }
        })
      }

      const benchmark = new PerformanceBenchmark('find-operations')

      benchmark.start()

      const queries = [
        'artificial intelligence',
        'data science research',
        'search document',
        'machine learning'
      ]

      for (let i = 0; i < 20; i++) {
        const query = queries[i % queries.length]
        const start = performance.now()
        await brainy.find({ query, limit: 10 })
        const latency = performance.now() - start
        benchmark.recordOperation(latency)
      }

      const result = benchmark.finish()
      benchmarkResults.push(result)

      expect(result.latencies.p50).toBeLessThan(200)
      expect(result.latencies.p95).toBeLessThan(500)
      expect(result.latencies.p99).toBeLessThan(1000)
    }, 120000)

    it('should handle similarity search efficiently', async () => {
      const benchmark = new PerformanceBenchmark('similar-search')

      const ids: string[] = []
      for (let i = 0; i < 50; i++) {
        const id = await brainy.add({
          data: `Similarity search test ${i} about neural networks`,
          type: NounType.Thing,
          metadata: { group: `group-${i % 5}` }
        })
        ids.push(id)
      }

      // Create some relationships
      for (let i = 0; i < ids.length - 1; i += 5) {
        await brainy.relate({
          from: ids[i],
          to: ids[i + 1],
          type: VerbType.RelatedTo
        })
      }

      benchmark.start()

      for (let i = 0; i < 10; i++) {
        const start = performance.now()
        await brainy.similar({
          to: ids[i % ids.length],
          limit: 5
        })
        const latency = performance.now() - start
        benchmark.recordOperation(latency)
      }

      const result = benchmark.finish()
      benchmarkResults.push(result)

      expect(result.latencies.p95).toBeLessThan(500)
    }, 120000)
  })

  describe('Batch Operations Performance', () => {
    it('should meet batch ADD performance targets', async () => {
      const benchmark = new PerformanceBenchmark('batch-add')
      const batchSizes = [5, 10, 20]

      benchmark.start()

      for (const batchSize of batchSizes) {
        const items = Array.from({ length: batchSize }, (_, i) => ({
          data: `Batch item ${i} for performance testing`,
          type: NounType.Document as NounType,
          metadata: { batchSize, index: i }
        }))

        const start = performance.now()
        await brainy.addMany({ items })
        const latency = performance.now() - start
        benchmark.recordOperation(latency / batchSize)
      }

      const result = benchmark.finish()
      benchmarkResults.push(result)

      // Batch amortized cost per item should be reasonable
      expect(result.latencies.mean).toBeLessThan(500)
    }, 120000)
  })

  describe('Performance Report', () => {
    it('should generate comprehensive performance report', () => {
      if (benchmarkResults.length === 0) {
        // No prior benchmarks ran — skip report
        return
      }

      PerformanceBenchmark.generateReport(benchmarkResults)

      const avgThroughput = benchmarkResults.reduce((sum, r) => sum + r.throughput, 0) / benchmarkResults.length
      expect(avgThroughput).toBeGreaterThan(1)

      const totalMemory = benchmarkResults.reduce((sum, r) => sum + r.memory.delta, 0)
      expect(totalMemory).toBeLessThan(500 * 1024 * 1024)
    })
  })
})
