/**
 * Streaming Pipeline Tests
 * Tests for the new streaming data pipeline system
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { Pipeline, createPipeline } from '../src/streaming/pipeline.js'
import { Brainy } from '../src/brainy.js'
import { NounType } from '../src/types/graphTypes.js'

describe('Streaming Pipeline', () => {
  let brain: Brainy
  
  beforeEach(async () => {
    brain = new Brainy({
      storage: { type: 'memory' },
      warmup: false
    })
    await brain.init()
  })
  
  afterEach(async () => {
    await brain.close()
  })
  
  describe('Core Operations', () => {
    it('should process data through pipeline', async () => {
      const results: number[] = []
      
      await new Pipeline()
        .source(async function* () {
          for (let i = 1; i <= 5; i++) {
            yield i
          }
        })
        .map(x => x * 2)
        .filter(x => x > 4)
        .sink(x => { results.push(x) })
        .run()
      
      expect(results).toEqual([6, 8, 10])
    })
    
    it('should handle async transformations', async () => {
      const results: string[] = []
      
      await new Pipeline()
        .source(async function* () {
          yield 'hello'
          yield 'world'
        })
        .map(async (text) => {
          await new Promise(resolve => setTimeout(resolve, 10))
          return text.toUpperCase()
        })
        .sink(x => { results.push(x) })
        .run()
      
      expect(results).toEqual(['HELLO', 'WORLD'])
    })
    
    it('should batch items', async () => {
      const batches: number[][] = []
      
      await new Pipeline()
        .source(async function* () {
          for (let i = 1; i <= 10; i++) {
            yield i
          }
        })
        .batch(3)
        .sink(batch => { batches.push(batch) })
        .run()
      
      expect(batches).toEqual([
        [1, 2, 3],
        [4, 5, 6],
        [7, 8, 9],
        [10]
      ])
    })
    
    it('should collect all results', async () => {
      const pipeline = new Pipeline()
        .source(async function* () {
          for (let i = 1; i <= 5; i++) {
            yield i
          }
        })
        .map(x => x * x)
      
      const results = await pipeline.collect()
      expect(results).toEqual([1, 4, 9, 16, 25])
    })
  })
  
  describe('Window Operations', () => {
    it('should support tumbling windows', async () => {
      const windows: number[][] = []
      
      await new Pipeline()
        .source(async function* () {
          for (let i = 1; i <= 10; i++) {
            yield i
          }
        })
        .window(3, 'tumbling')
        .sink(window => { windows.push(window) })
        .run()
      
      expect(windows).toEqual([
        [1, 2, 3],
        [4, 5, 6],
        [7, 8, 9],
        [10]
      ])
    })
    
    it('should support sliding windows', async () => {
      const windows: number[][] = []
      
      await new Pipeline()
        .source(async function* () {
          for (let i = 1; i <= 5; i++) {
            yield i
          }
        })
        .window(3, 'sliding')
        .sink(window => { windows.push([...window]) })
        .run()
      
      expect(windows).toEqual([
        [1, 2, 3],
        [2, 3, 4],
        [3, 4, 5]
      ])
    })
  })
  
  describe('Reduce Operations', () => {
    it('should reduce values', async () => {
      let result = 0
      
      await new Pipeline()
        .source(async function* () {
          for (let i = 1; i <= 5; i++) {
            yield i
          }
        })
        .reduce((acc, val) => acc + val, 0)
        .sink(sum => { result = sum })
        .run()
      
      expect(result).toBe(15)
    })
    
    it('should work with complex reducers', async () => {
      interface Stats {
        count: number
        sum: number
        max: number
      }
      
      let stats: Stats = { count: 0, sum: 0, max: 0 }
      
      await new Pipeline<number>()
        .source(async function* () {
          for (let i = 1; i <= 10; i++) {
            yield i
          }
        })
        .reduce<Stats>((acc, val) => ({
          count: acc.count + 1,
          sum: acc.sum + val,
          max: Math.max(acc.max, val)
        }), { count: 0, sum: 0, max: 0 })
        .sink(s => { stats = s })
        .run()
      
      expect(stats).toEqual({
        count: 10,
        sum: 55,
        max: 10
      })
    })
  })
  
  describe('Brainy Integration', () => {
    it('should sink data to Brainy', async () => {
      const pipeline = new Pipeline(brain)
        .source(async function* () {
          yield { content: 'Document 1' }
          yield { content: 'Document 2' }
          yield { content: 'Document 3' }
        })
        .toBrainy({
          type: NounType.Document,
          metadata: { source: 'pipeline' },
          batchSize: 2
        })
      
      await pipeline.run()
      
      // Verify data was added
      const results = await brain.find({
        where: { 'metadata.source': 'pipeline' }
      })
      
      expect(results.length).toBe(3)
    })
    
    it('should process and transform before storing', async () => {
      const pipeline = new Pipeline(brain)
        .source(async function* () {
          yield 'hello world'
          yield 'goodbye world'
        })
        .map(text => ({
          content: text,
          processed: text.toUpperCase()
        }))
        .toBrainy({
          type: NounType.Document,
          metadata: { pipeline: true }
        })
      
      await pipeline.run()
      
      const results = await brain.find({
        where: { 'metadata.pipeline': true }
      })
      
      expect(results.length).toBe(2)
    })
  })
  
  describe('Error Handling', () => {
    it('should handle errors with handler', async () => {
      const errors: Error[] = []
      
      await new Pipeline()
        .source(async function* () {
          yield 1
          yield 2
          yield 3
        })
        .map(x => {
          if (x === 2) throw new Error('Test error')
          return x
        })
        .sink(() => {})
        .run({
          errorHandler: (error) => errors.push(error)
        })
      
      expect(errors.length).toBe(1)
      expect(errors[0].message).toBe('Test error')
    })
    
    it('should stop on abort signal', async () => {
      let count = 0
      
      const pipeline = new Pipeline()
        .source(async function* () {
          for (let i = 1; i <= 100; i++) {
            yield i
          }
        })
        .sink(() => { count++ })
      
      // Start pipeline
      const runPromise = pipeline.run()
      
      // Stop after a short delay
      setTimeout(() => pipeline.stop(), 50)
      
      await runPromise
      
      // Should have processed some but not all items
      expect(count).toBeGreaterThan(0)
      expect(count).toBeLessThan(100)
    })
  })
  
  describe('Performance Features', () => {
    it('should throttle sink operations', async () => {
      const times: number[] = []
      const startTime = Date.now()
      
      await new Pipeline()
        .source(async function* () {
          for (let i = 1; i <= 3; i++) {
            yield i
          }
        })
        .throttledSink(
          () => { times.push(Date.now() - startTime) },
          10 // 10 ops/sec max
        )
        .run()
      
      // Check that operations were throttled
      expect(times.length).toBe(3)
      expect(times[2] - times[0]).toBeGreaterThanOrEqual(200) // At least 200ms for 3 items at 10/sec
    })
    
    it('should run monitoring', async () => {
      const logs: string[] = []
      const originalLog = console.log
      console.log = (msg: string) => logs.push(msg)
      
      try {
        await new Pipeline()
          .source(async function* () {
            for (let i = 1; i <= 10; i++) {
              yield i
            }
          })
          .sink(() => {})
          .run({ monitoring: true })
        
        // Should have logged completion metrics
        expect(logs.some(log => log.includes('Pipeline completed'))).toBe(true)
        expect(logs.some(log => log.includes('Throughput'))).toBe(true)
      } finally {
        console.log = originalLog
      }
    })
  })
})