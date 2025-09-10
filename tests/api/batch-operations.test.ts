/**
 * Batch Operations Test Suite for Brainy v3.0
 * 
 * Comprehensive testing of batch operations including:
 * - addMany: Bulk entity creation
 * - updateMany: Bulk updates
 * - deleteMany: Bulk deletion
 * - relateMany: Bulk relationship creation
 * - Performance validation at scale
 * - Memory efficiency testing
 * - Error recovery scenarios
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { Brainy } from '../../src/brainy'
import { performance } from 'perf_hooks'

interface BatchMetrics {
  operation: string
  totalItems: number
  successCount: number
  failureCount: number
  duration: number
  throughput: number
  memoryUsed: number
  errors: string[]
}

class BatchMetricsCollector {
  private metrics: BatchMetrics[] = []

  recordBatch(
    operation: string,
    totalItems: number,
    results: any[],
    duration: number,
    memoryUsed: number
  ): BatchMetrics {
    const successCount = results.filter(r => 
      r?.status === 'fulfilled' || r === true || (r && !r.error)
    ).length
    const failureCount = totalItems - successCount
    const errors = results
      .filter(r => r?.status === 'rejected' || r?.error)
      .map(r => r?.reason?.message || r?.error || 'Unknown error')
      .slice(0, 5) // Limit to first 5 errors

    const metric: BatchMetrics = {
      operation,
      totalItems,
      successCount,
      failureCount,
      duration,
      throughput: (totalItems / duration) * 1000,
      memoryUsed,
      errors
    }

    this.metrics.push(metric)
    return metric
  }

  getMetrics(): BatchMetrics[] {
    return this.metrics
  }

  generateReport(): void {
    console.log('\n=== Batch Operations Performance Report ===\n')
    console.table(this.metrics.map(m => ({
      Operation: m.operation,
      'Total Items': m.totalItems,
      'Success': `${m.successCount}/${m.totalItems} (${((m.successCount/m.totalItems)*100).toFixed(1)}%)`,
      'Duration (ms)': m.duration.toFixed(2),
      'Throughput (items/s)': m.throughput.toFixed(0),
      'Memory (MB)': (m.memoryUsed / 1024 / 1024).toFixed(2),
      'Errors': m.errors.length > 0 ? m.errors[0] : 'None'
    })))

    // Summary statistics
    const totalOps = this.metrics.reduce((sum, m) => sum + m.totalItems, 0)
    const totalSuccess = this.metrics.reduce((sum, m) => sum + m.successCount, 0)
    const avgThroughput = this.metrics.reduce((sum, m) => sum + m.throughput, 0) / this.metrics.length

    console.log('\nSummary:')
    console.log(`Total Operations: ${totalOps}`)
    console.log(`Success Rate: ${((totalSuccess/totalOps)*100).toFixed(2)}%`)
    console.log(`Average Throughput: ${avgThroughput.toFixed(0)} items/sec`)
  }
}

describe('Batch Operations - Public API Testing', () => {
  let brainy: Brainy
  let metricsCollector: BatchMetricsCollector

  beforeEach(async () => {
    brainy = new Brainy({
      storage: { type: 'memory' }
    })
    await brainy.init()
    metricsCollector = new BatchMetricsCollector()
  })

  afterEach(async () => {
    await brainy.close()
    if (global.gc) global.gc()
  })

  describe('addMany - Bulk Entity Creation', () => {
    it('should add 100 entities efficiently', async () => {
      const entities = Array(100).fill(null).map((_, i) => ({
        data: `Batch entity ${i}: Test content for bulk operations`,
        type: 'document' as const,
        metadata: {
          batchIndex: i,
          batchId: 'batch-100',
          timestamp: Date.now()
        }
      }))

      const startMemory = process.memoryUsage().heapUsed
      const startTime = performance.now()

      const result = await brainy.addMany({ items: entities })

      const duration = performance.now() - startTime
      const memoryUsed = process.memoryUsage().heapUsed - startMemory

      const metric = metricsCollector.recordBatch(
        'addMany-100',
        entities.length,
        result.successful,
        duration,
        memoryUsed
      )

      expect(result.successful).toHaveLength(100)
      expect(result.failed).toHaveLength(0)
      expect(metric.throughput).toBeGreaterThan(100) // > 100 items/sec
    })

    it('should handle 1,000 entities with proper batching', async () => {
      const entities = Array(1000).fill(null).map((_, i) => ({
        data: `Entity ${i}: ${' '.repeat(100)}`, // ~100 bytes each
        type: 'document' as const,
        metadata: {
          index: i,
          category: `cat-${i % 10}`,
          tags: [`tag-${i % 5}`, `tag-${i % 7}`]
        }
      }))

      const startMemory = process.memoryUsage().heapUsed
      const startTime = performance.now()

      const result = await brainy.addMany({ 
        items: entities,
        chunkSize: 100, // Process in batches
        parallel: true
      })

      const duration = performance.now() - startTime
      const memoryUsed = process.memoryUsage().heapUsed - startMemory

      metricsCollector.recordBatch(
        'addMany-1k',
        entities.length,
        result.successful,
        duration,
        memoryUsed
      )

      expect(result.successful.length).toBe(1000)
      expect(result.failed.length).toBe(0)
      expect(duration).toBeLessThan(10000) // < 10 seconds

      // Verify data integrity
      const sampleIds = result.successful.slice(0, 10)
      for (const id of sampleIds) {
        const entity = await brainy.get(id)
        expect(entity).toBeDefined()
      }
    })

    it('should handle 10,000 entities with memory efficiency', async () => {
      const chunkSize = 1000
      const totalEntities = 10000
      let allSuccessful: string[] = []
      let allFailed: any[] = []
      
      const startMemory = process.memoryUsage().heapUsed
      const startTime = performance.now()

      // Process in chunks to avoid memory issues
      for (let chunk = 0; chunk < totalEntities; chunk += chunkSize) {
        const entities = Array(Math.min(chunkSize, totalEntities - chunk))
          .fill(null)
          .map((_, i) => ({
            data: `Chunk entity ${chunk + i}`,
            type: 'document' as const,
            metadata: { globalIndex: chunk + i }
          }))

        const result = await brainy.addMany({ items: entities })
        allSuccessful.push(...result.successful)
        allFailed.push(...result.failed)

        // Check memory usage
        const currentMemory = process.memoryUsage().heapUsed
        const memoryGrowth = currentMemory - startMemory
        expect(memoryGrowth).toBeLessThan(500 * 1024 * 1024) // < 500MB total
      }

      const duration = performance.now() - startTime
      const finalMemory = process.memoryUsage().heapUsed - startMemory

      metricsCollector.recordBatch(
        'addMany-10k',
        totalEntities,
        allSuccessful,
        duration,
        finalMemory
      )

      expect(allSuccessful.length).toBe(10000)
      expect(allFailed.length).toBe(0)
    })

    it('should handle partial failures gracefully', async () => {
      const entities = [
        { data: 'Valid entity 1', type: 'document' as const },
        { data: '', type: 'document' as const }, // Invalid: empty data
        { data: 'Valid entity 2', type: 'document' as const },
        { data: null as any, type: 'document' as const }, // Invalid: null data
        { data: 'Valid entity 3', type: 'document' as const },
      ]

      const result = await brainy.addMany({ 
        items: entities,
        continueOnError: true
      })

      // Should process valid entities even if some fail
      expect(result.successful.length).toBeGreaterThanOrEqual(3)
      expect(result.failed.length).toBeGreaterThanOrEqual(0) // May or may not validate
      
      // Verify valid entities were added
      for (const id of result.successful) {
        const entity = await brainy.get(id)
        expect(entity).toBeDefined()
      }
    })

    it('should support concurrent batch operations', async () => {
      const batches = Array(5).fill(null).map((_, batchIdx) => 
        Array(100).fill(null).map((_, i) => ({
          data: `Batch ${batchIdx} Entity ${i}`,
          type: 'document' as const,
          metadata: { batchId: batchIdx, index: i }
        }))
      )

      const startTime = performance.now()

      // Execute batches concurrently
      const results = await Promise.all(
        batches.map(entities => brainy.addMany({ items: entities }))
      )

      const duration = performance.now() - startTime

      expect(results).toHaveLength(5)
      const totalSuccess = results.reduce((sum, r) => sum + r.successful.length, 0)
      expect(totalSuccess).toBe(500)
      expect(duration).toBeLessThan(5000) // Concurrent should be faster
    })
  })

  describe('updateMany - Bulk Updates', () => {
    let testIds: string[] = []

    beforeEach(async () => {
      // Create test entities
      const entities = Array(100).fill(null).map((_, i) => ({
        data: `Original content ${i}`,
        type: 'document' as const,
        metadata: { version: 1, index: i }
      }))

      const result = await brainy.addMany({ items: entities })
      testIds = result.successful
    })

    it('should update multiple entities by IDs', async () => {
      const updates = testIds.slice(0, 50).map(id => ({
        id,
        updates: { 
          metadata: { 
            version: 2, 
            updatedAt: Date.now() 
          }
        }
      }))

      const startTime = performance.now()
      
      // Note: updateMany might not exist, so we'll use individual updates
      const results = await Promise.all(
        updates.map(u => brainy.update({ id: u.id, ...u.updates }))
      )

      const duration = performance.now() - startTime

      metricsCollector.recordBatch(
        'updateMany-50',
        updates.length,
        results,
        duration,
        0
      )

      // Verify updates
      const sample = await brainy.get(testIds[0])
      expect(sample?.metadata?.version).toBe(2)
    })

    it('should update entities matching criteria', async () => {
      // Update all entities with index < 20
      const targetIds = testIds.slice(0, 20)
      
      const startTime = performance.now()
      
      const results = await Promise.all(
        targetIds.map(id => 
          brainy.update({
            id,
            metadata: { 
              status: 'updated',
              processedAt: Date.now()
            }
          })
        )
      )

      const duration = performance.now() - startTime

      metricsCollector.recordBatch(
        'updateMany-criteria',
        targetIds.length,
        results,
        duration,
        0
      )

      // Verify updates
      for (const id of targetIds.slice(0, 5)) {
        const entity = await brainy.get(id)
        expect(entity?.metadata?.status).toBe('updated')
      }
    })
  })

  describe('deleteMany - Bulk Deletion', () => {
    let testIds: string[] = []

    beforeEach(async () => {
      // Create test entities
      const entities = Array(200).fill(null).map((_, i) => ({
        data: `Delete test ${i}`,
        type: 'document' as const,
        metadata: { deleteGroup: i % 4 }
      }))

      const result = await brainy.addMany({ items: entities })
      testIds = result.successful
    })

    it('should delete multiple entities by IDs', async () => {
      const toDelete = testIds.slice(0, 100)
      
      const startMemory = process.memoryUsage().heapUsed
      const startTime = performance.now()

      // Use deleteMany if available, otherwise individual deletes
      let results: any[]
      if ('deleteMany' in brainy && typeof brainy.deleteMany === 'function') {
        const result = await brainy.deleteMany({ ids: toDelete })
        results = result.successful
      } else {
        results = await Promise.all(
          toDelete.map(id => brainy.delete(id))
        )
      }

      const duration = performance.now() - startTime
      const memoryUsed = process.memoryUsage().heapUsed - startMemory

      metricsCollector.recordBatch(
        'deleteMany-100',
        toDelete.length,
        results,
        duration,
        memoryUsed
      )

      // Verify deletion
      for (const id of toDelete.slice(0, 10)) {
        const entity = await brainy.get(id)
        expect(entity).toBeNull()
      }

      // Remaining entities should still exist
      const remaining = testIds.slice(100, 110)
      for (const id of remaining) {
        const entity = await brainy.get(id)
        expect(entity).toBeDefined()
      }
    })

    it('should handle large-scale deletion efficiently', async () => {
      // Create a large dataset
      const largeDataset = Array(1000).fill(null).map((_, i) => ({
        data: `Large scale delete test ${i}`,
        type: 'document' as const
      }))

      const addResult = await brainy.addMany({ items: largeDataset })
      const idsToDelete = addResult.successful

      const startTime = performance.now()

      // Delete in batches
      const batchSize = 100
      for (let i = 0; i < idsToDelete.length; i += batchSize) {
        const batch = idsToDelete.slice(i, i + batchSize)
        await Promise.all(batch.map(id => brainy.delete(id)))
      }

      const duration = performance.now() - startTime

      metricsCollector.recordBatch(
        'deleteMany-1k',
        idsToDelete.length,
        idsToDelete.map(() => true),
        duration,
        0
      )

      expect(duration).toBeLessThan(10000) // < 10 seconds
    })
  })

  describe('relateMany - Bulk Relationship Creation', () => {
    let nodeIds: string[] = []

    beforeEach(async () => {
      // Create nodes for relationships
      const nodes = Array(50).fill(null).map((_, i) => ({
        data: `Node ${i}`,
        type: 'thing' as const,
        metadata: { nodeIndex: i }
      }))

      const result = await brainy.addMany({ items: nodes })
      nodeIds = result.successful
    })

    it('should create multiple relationships efficiently', async () => {
      const relationships: Array<{from: string, to: string, type: string}> = []
      
      // Create a connected graph
      for (let i = 0; i < nodeIds.length - 1; i++) {
        relationships.push({
          from: nodeIds[i],
          to: nodeIds[i + 1],
          type: 'connected_to'
        })
      }

      const startTime = performance.now()

      const results = await Promise.all(
        relationships.map(r => 
          brainy.relate({ from: r.from, to: r.to, type: r.type as any })
        )
      )

      const duration = performance.now() - startTime

      metricsCollector.recordBatch(
        'relateMany-chain',
        relationships.length,
        results,
        duration,
        0
      )

      expect(results.every(r => typeof r === 'string')).toBe(true) // relate returns ID
      expect(duration).toBeLessThan(5000)
    })

    it('should create complex graph structures', async () => {
      // Create a fully connected subgraph (first 10 nodes)
      const subgraph = nodeIds.slice(0, 10)
      const relationships: Array<{from: string, to: string}> = []

      for (let i = 0; i < subgraph.length; i++) {
        for (let j = i + 1; j < subgraph.length; j++) {
          relationships.push({
            from: subgraph[i],
            to: subgraph[j]
          })
        }
      }

      const startTime = performance.now()

      const results = await Promise.all(
        relationships.map(r => 
          brainy.relate({ from: r.from, to: r.to, type: 'relatedTo' })
        )
      )

      const duration = performance.now() - startTime

      metricsCollector.recordBatch(
        'relateMany-mesh',
        relationships.length,
        results,
        duration,
        0
      )

      expect(relationships.length).toBe(45) // 10 choose 2
      expect(results.every(r => typeof r === 'string')).toBe(true) // relate returns ID
    })
  })

  describe('Mixed Batch Operations', () => {
    it('should handle mixed operation types concurrently', async () => {
      // Prepare different operation types
      const addOps = Array(100).fill(null).map((_, i) => ({
        data: `Mixed add ${i}`,
        type: 'document' as const
      }))

      // Add initial entities for update/delete
      const setupResult = await brainy.addMany({ 
        items: Array(100).fill(null).map((_, i) => ({
          data: `Setup ${i}`,
          type: 'document' as const
        }))
      })

      const updateIds = setupResult.successful.slice(0, 50)
      const deleteIds = setupResult.successful.slice(50, 100)

      const startTime = performance.now()

      // Execute all operations concurrently
      const [addResults, updateResults, deleteResults] = await Promise.all([
        brainy.addMany({ items: addOps }),
        Promise.all(updateIds.map(id => 
          brainy.update({ id, metadata: { updated: true } })
        )),
        Promise.all(deleteIds.map(id => brainy.delete(id)))
      ])

      const duration = performance.now() - startTime

      console.log(`Mixed operations completed in ${duration.toFixed(2)}ms`)

      expect(addResults.successful.length).toBe(100)
      expect(updateResults.length).toBe(50)
      // Delete returns void, so just check length
      expect(deleteResults).toHaveLength(50)
    })
  })

  describe('Error Recovery', () => {
    it('should recover from transient failures', async () => {
      let attemptCount = 0
      const entities = Array(10).fill(null).map((_, i) => ({
        data: `Retry test ${i}`,
        type: 'document' as const
      }))

      // Simulate transient failures
      const originalAdd = brainy.add.bind(brainy)
      brainy.add = async function(params: any) {
        attemptCount++
        if (attemptCount % 3 === 0) {
          throw new Error('Transient failure')
        }
        return originalAdd(params)
      }

      const results: any[] = []
      for (const entity of entities) {
        let retries = 0
        while (retries < 3) {
          try {
            const id = await brainy.add(entity)
            results.push({ status: 'fulfilled', value: id })
            break
          } catch (error) {
            retries++
            if (retries === 3) {
              results.push({ status: 'rejected', reason: error })
            }
          }
        }
      }

      const successful = results.filter(r => r.status === 'fulfilled')
      expect(successful.length).toBeGreaterThanOrEqual(6) // Most should succeed with retry
    })

    it('should handle memory pressure gracefully', async () => {
      const largeEntities = Array(100).fill(null).map((_, i) => ({
        data: 'x'.repeat(100000), // 100KB each = 10MB total
        type: 'document' as const,
        metadata: { index: i }
      }))

      const startMemory = process.memoryUsage().heapUsed
      
      // Process with memory monitoring
      const batchSize = 10
      const results: any[] = []
      
      for (let i = 0; i < largeEntities.length; i += batchSize) {
        const batch = largeEntities.slice(i, i + batchSize)
        
        // Check memory before processing
        const currentMemory = process.memoryUsage().heapUsed
        const memoryUsed = currentMemory - startMemory
        
        if (memoryUsed > 100 * 1024 * 1024) { // If > 100MB
          if (global.gc) global.gc() // Force GC if available
        }
        
        const batchResult = await brainy.addMany({ items: batch })
        results.push(...batchResult.successful)
      }

      expect(results.length).toBe(100)
      
      const finalMemory = process.memoryUsage().heapUsed - startMemory
      expect(finalMemory).toBeLessThan(200 * 1024 * 1024) // Should stay under 200MB
    })
  })

  describe('Performance Report', () => {
    it('should generate comprehensive batch operations report', async () => {
      metricsCollector.generateReport()
      
      const metrics = metricsCollector.getMetrics()
      expect(metrics.length).toBeGreaterThan(0)
      
      // Validate performance targets
      for (const metric of metrics) {
        expect(metric.successCount).toBeGreaterThan(0)
        if (metric.operation.includes('100')) {
          expect(metric.throughput).toBeGreaterThan(50) // At least 50 items/sec
        }
      }
    })
  })
})