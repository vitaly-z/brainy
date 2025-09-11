import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { Brainy } from '../src/brainy'

describe('CRITICAL: Performance Benchmarks at Scale', () => {
  let brainy: Brainy

  beforeAll(async () => {
    brainy = new Brainy({
      storage: { type: 'memory' }
    })
    await brainy.init()
  })

  afterAll(async () => {
    await brainy.close()
  })

  describe('Insertion Performance', () => {
    it('should handle 10,000 items efficiently', async () => {
      console.log('\n=== INSERTION BENCHMARK ===')
      
      const batchSizes = [100, 500, 1000, 5000, 10000]
      const results: any[] = []

      for (const size of batchSizes) {
        const items = Array.from({ length: size }, (_, i) => ({
          id: `perf-${size}-${i}`,
          data: {
            title: `Item ${i}`,
            content: `This is test content for item ${i} with some random text to make it realistic`,
            category: `cat-${i % 10}`,
            tags: [`tag-${i % 5}`, `tag-${i % 7}`],
            timestamp: Date.now() + i
          },
          type: 'document' as const
        }))

        const startTime = Date.now()
        
        if (size <= 1000) {
          for (const item of items) {
            await brainy.add(item)
          }
        } else {
          await brainy.addMany({ items })
        }
        
        const elapsed = Date.now() - startTime
        const perItem = elapsed / size
        
        results.push({
          size,
          totalTime: elapsed,
          perItem: perItem.toFixed(2),
          itemsPerSecond: Math.round(1000 / perItem)
        })
        
        console.log(`${size} items: ${elapsed}ms total, ${perItem.toFixed(2)}ms per item, ${Math.round(1000/perItem)} items/sec`)
        
        expect(perItem).toBeLessThan(100)
      }

      console.table(results)
    })
  })

  describe('Search Performance', () => {
    beforeAll(async () => {
      const testData = Array.from({ length: 5000 }, (_, i) => ({
        id: `search-${i}`,
        data: {
          title: `Document ${i}`,
          content: [
            'JavaScript programming',
            'Python data science',
            'Machine learning algorithms',
            'Web development frameworks',
            'Database optimization',
            'Cloud computing architecture',
            'Mobile app development',
            'DevOps practices',
            'Microservices design',
            'API development'
          ][i % 10] + ` variation ${i}`,
          category: `category-${i % 20}`,
          score: Math.random() * 100
        },
        type: 'document' as const
      }))

      await brainy.addMany({ items: testData })
    })

    it('should perform vector searches quickly', async () => {
      console.log('\n=== VECTOR SEARCH BENCHMARK ===')
      
      const queries = [
        'JavaScript programming tutorials',
        'Python machine learning',
        'Cloud architecture best practices',
        'Mobile development frameworks',
        'Database performance tuning'
      ]
      
      const results: any[] = []

      for (const query of queries) {
        const iterations = 100
        const startTime = Date.now()
        
        for (let i = 0; i < iterations; i++) {
          await brainy.find({
            query,
            limit: 10
          })
        }
        
        const elapsed = Date.now() - startTime
        const avgTime = elapsed / iterations
        
        results.push({
          query: query.substring(0, 30),
          iterations,
          totalTime: elapsed,
          avgTime: avgTime.toFixed(2),
          queriesPerSec: Math.round(1000 / avgTime)
        })
        
        console.log(`"${query}": ${avgTime.toFixed(2)}ms avg, ${Math.round(1000/avgTime)} queries/sec`)
        
        expect(avgTime).toBeLessThan(50)
      }

      console.table(results)
    })

    it('should perform metadata filtering efficiently', async () => {
      console.log('\n=== METADATA FILTER BENCHMARK ===')
      
      const filters = [
        { category: 'category-5' },
        { score: { greaterThan: 50 } },
        { score: { lessThan: 25 } },
        { category: 'category-10', score: { greaterThan: 75 } }
      ]
      
      const results: any[] = []

      for (const filter of filters) {
        const iterations = 100
        const startTime = Date.now()
        
        for (let i = 0; i < iterations; i++) {
          await brainy.find({
            where: filter,
            limit: 20
          })
        }
        
        const elapsed = Date.now() - startTime
        const avgTime = elapsed / iterations
        
        results.push({
          filter: JSON.stringify(filter).substring(0, 40),
          iterations,
          avgTime: avgTime.toFixed(2),
          queriesPerSec: Math.round(1000 / avgTime)
        })
        
        console.log(`Filter ${JSON.stringify(filter)}: ${avgTime.toFixed(2)}ms avg`)
        
        expect(avgTime).toBeLessThan(20)
      }

      console.table(results)
    })
  })

  describe('Concurrent Operations', () => {
    it('should handle 1000 concurrent reads efficiently', async () => {
      console.log('\n=== CONCURRENT READ BENCHMARK ===')
      
      const ids = Array.from({ length: 100 }, (_, i) => `concurrent-${i}`)
      
      for (const id of ids) {
        await brainy.add({
          id,
          data: { content: `Concurrent test ${id}` },
          type: 'item'
        })
      }

      const concurrentReads = 1000
      const promises: Promise<any>[] = []
      
      const startTime = Date.now()
      
      for (let i = 0; i < concurrentReads; i++) {
        const randomId = ids[Math.floor(Math.random() * ids.length)]
        promises.push(brainy.get(randomId))
      }
      
      await Promise.all(promises)
      const elapsed = Date.now() - startTime
      
      console.log(`${concurrentReads} concurrent reads: ${elapsed}ms total, ${(elapsed/concurrentReads).toFixed(2)}ms avg`)
      
      expect(elapsed).toBeLessThan(5000)
    })

    it('should handle mixed concurrent operations', async () => {
      console.log('\n=== MIXED OPERATIONS BENCHMARK ===')
      
      const operations = []
      const startTime = Date.now()
      
      for (let i = 0; i < 100; i++) {
        operations.push(
          brainy.add({
            id: `mixed-add-${i}`,
            data: { content: `Mixed operation ${i}` },
            type: 'item'
          })
        )
      }
      
      for (let i = 0; i < 100; i++) {
        operations.push(
          brainy.find({
            query: 'mixed operation',
            limit: 5
          })
        )
      }
      
      for (let i = 0; i < 100; i++) {
        operations.push(brainy.get(`mixed-add-${i % 50}`))
      }
      
      await Promise.all(operations)
      const elapsed = Date.now() - startTime
      
      console.log(`300 mixed operations: ${elapsed}ms total, ${(elapsed/300).toFixed(2)}ms avg`)
      
      expect(elapsed).toBeLessThan(10000)
    })
  })

  describe('Memory Usage', () => {
    it('should maintain reasonable memory usage with large datasets', async () => {
      console.log('\n=== MEMORY USAGE BENCHMARK ===')
      
      const memBefore = process.memoryUsage()
      
      const largeDataset = Array.from({ length: 10000 }, (_, i) => ({
        id: `mem-${i}`,
        data: {
          content: `Memory test content ${i}`.repeat(10),
          metadata: {
            index: i,
            category: i % 100,
            tags: Array.from({ length: 5 }, (_, j) => `tag-${i}-${j}`)
          }
        },
        type: 'document' as const
      }))
      
      await brainy.addMany({ items: largeDataset })
      
      const memAfter = process.memoryUsage()
      const heapUsed = (memAfter.heapUsed - memBefore.heapUsed) / 1024 / 1024
      const externalUsed = (memAfter.external - memBefore.external) / 1024 / 1024
      
      console.log(`Heap increase: ${heapUsed.toFixed(2)} MB`)
      console.log(`External increase: ${externalUsed.toFixed(2)} MB`)
      console.log(`Total increase: ${(heapUsed + externalUsed).toFixed(2)} MB`)
      console.log(`Per item: ${((heapUsed + externalUsed) / 10000 * 1024).toFixed(2)} KB`)
      
      expect(heapUsed).toBeLessThan(500)
    })
  })

  describe('Graph Operations Performance', () => {
    it('should handle relationship operations efficiently', async () => {
      console.log('\n=== GRAPH OPERATIONS BENCHMARK ===')
      
      const nodes = 100
      const relationshipsPerNode = 5
      
      for (let i = 0; i < nodes; i++) {
        await brainy.add({
          id: `node-${i}`,
          data: { name: `Node ${i}` },
          type: 'entity'
        })
      }
      
      const relStart = Date.now()
      
      for (let i = 0; i < nodes; i++) {
        for (let j = 0; j < relationshipsPerNode; j++) {
          const targetId = Math.floor(Math.random() * nodes)
          await brainy.relate({
            from: `node-${i}`,
            to: `node-${targetId}`,
            type: 'relatedTo'
          })
        }
      }
      
      const relElapsed = Date.now() - relStart
      const totalRelationships = nodes * relationshipsPerNode
      
      console.log(`Created ${totalRelationships} relationships in ${relElapsed}ms`)
      console.log(`Average: ${(relElapsed/totalRelationships).toFixed(2)}ms per relationship`)
      
      const queryStart = Date.now()
      const queryPromises = []
      
      for (let i = 0; i < 100; i++) {
        const randomNode = Math.floor(Math.random() * nodes)
        queryPromises.push(brainy.getRelations({ from: `node-${randomNode}` }))
      }
      
      await Promise.all(queryPromises)
      const queryElapsed = Date.now() - queryStart
      
      console.log(`100 relationship queries: ${queryElapsed}ms total, ${(queryElapsed/100).toFixed(2)}ms avg`)
      
      expect(relElapsed/totalRelationships).toBeLessThan(50)
      expect(queryElapsed/100).toBeLessThan(20)
    })
  })

  describe('Scalability Limits', () => {
    it('should identify performance degradation points', async () => {
      console.log('\n=== SCALABILITY TEST ===')
      
      const sizes = [1000, 5000, 10000, 20000, 50000]
      const degradationPoints: any[] = []
      
      for (const size of sizes) {
        const testItems = Array.from({ length: 1000 }, (_, i) => ({
          id: `scale-${size}-${i}`,
          data: {
            content: `Scalability test at ${size} items, instance ${i}`
          },
          type: 'document' as const
        }))
        
        await brainy.addMany({ items: testItems })
        
        const searchStart = Date.now()
        const searchResults = await brainy.find({
          query: 'scalability test',
          limit: 10
        })
        const searchTime = Date.now() - searchStart
        
        const getStart = Date.now()
        await brainy.get(`scale-${size}-500`)
        const getTime = Date.now() - getStart
        
        degradationPoints.push({
          totalItems: size,
          searchTime,
          getTime,
          searchDegradation: size > 1000 ? ((searchTime / degradationPoints[0].searchTime - 1) * 100).toFixed(1) + '%' : 'baseline',
          getDegradation: size > 1000 ? ((getTime / degradationPoints[0].getTime - 1) * 100).toFixed(1) + '%' : 'baseline'
        })
        
        console.log(`At ${size} items: search=${searchTime}ms, get=${getTime}ms`)
      }
      
      console.table(degradationPoints)
      
      const lastPoint = degradationPoints[degradationPoints.length - 1]
      expect(lastPoint.searchTime).toBeLessThan(1000)
      expect(lastPoint.getTime).toBeLessThan(50)
    })
  })
})