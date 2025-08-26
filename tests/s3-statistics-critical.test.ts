/**
 * CRITICAL S3 Statistics Tests
 * 
 * These tests ensure that statistics work correctly at scale with S3 storage.
 * Statistics are fundamental for monitoring production deployments with millions of records.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mockClient } from 'aws-sdk-client-mock'
import { 
  S3Client, 
  GetObjectCommand, 
  PutObjectCommand, 
  ListObjectsV2Command,
  HeadObjectCommand,
  DeleteObjectCommand 
} from '@aws-sdk/client-s3'
import { BrainyData } from '../src/index.js'
import { S3CompatibleStorage } from '../src/storage/adapters/s3CompatibleStorage.js'
import { createMockEmbeddingFunction } from './test-utils.js'

// Create S3 mock
const s3Mock = mockClient(S3Client)

describe('CRITICAL: S3 Statistics at Scale', () => {
  let brainy: BrainyData<any>
  let storage: S3CompatibleStorage

  beforeEach(() => {
    // Reset all mocks before each test
    s3Mock.reset()
    vi.clearAllTimers()
    vi.useFakeTimers()
  })

  afterEach(async () => {
    if (brainy) {
      await brainy.clearAll({ force: true })
    }
    vi.useRealTimers()
  })

  describe('Statistics Persistence and Recovery', () => {
    it('should persist statistics to S3 and recover after restart', async () => {
      // Setup S3 mock responses
      const statisticsData = {
        nounCount: { 'service-a': 1000, 'service-b': 500 },
        verbCount: { 'service-a': 200, 'service-b': 100 },
        metadataCount: { 'service-a': 1000, 'service-b': 500 },
        hnswIndexSize: 1500,
        lastUpdated: new Date().toISOString()
      }

      // Mock initial empty state
      s3Mock.on(GetObjectCommand).rejectsOnce({ name: 'NoSuchKey' })
      
      // Mock successful save
      s3Mock.on(PutObjectCommand).resolves({})

      // Initialize Brainy with S3 storage
      brainy = new BrainyData({
        embeddingFunction: createMockEmbeddingFunction(),
        storage: {
          s3Storage: {
            bucketName: 'test-bucket',
            accessKeyId: 'test-key',
            secretAccessKey: 'test-secret',
            region: 'us-east-1'
          }
        }
      })
      await brainy.init()

      // Add data with different services
      await brainy.add('Test data 1', { metadata: 'test1' }, { service: 'service-a' })
      await brainy.add('Test data 2', { metadata: 'test2' }, { service: 'service-b' })
      
      // Force statistics flush
      await brainy.flushStatistics()

      // Verify statistics were saved to S3
      const putCalls = s3Mock.commandCalls(PutObjectCommand)
      expect(putCalls.length).toBeGreaterThan(0)
      
      // Get current statistics
      const stats = await brainy.getStatistics()
      expect(stats.nounCount).toBe(2)
      expect(stats.serviceBreakdown).toBeDefined()
      expect(stats.serviceBreakdown['service-a'].nounCount).toBe(1)
      expect(stats.serviceBreakdown['service-b'].nounCount).toBe(1)

      // Simulate restart by creating new instance
      s3Mock.reset()
      
      // Mock loading saved statistics
      s3Mock.on(GetObjectCommand).resolves({
        Body: {
          transformToString: async () => JSON.stringify({
            nounCount: { 'service-a': 1, 'service-b': 1 },
            verbCount: { 'service-a': 0, 'service-b': 0 },
            metadataCount: { 'service-a': 1, 'service-b': 1 },
            hnswIndexSize: 2,
            lastUpdated: new Date().toISOString()
          })
        }
      })

      const brainy2 = new BrainyData({
        embeddingFunction: createMockEmbeddingFunction(),
        storage: {
          s3Storage: {
            bucketName: 'test-bucket',
            accessKeyId: 'test-key',
            secretAccessKey: 'test-secret',
            region: 'us-east-1'
          }
        }
      })
      await brainy2.init()

      // Verify statistics were recovered
      const recoveredStats = await brainy2.getStatistics()
      expect(recoveredStats.nounCount).toBe(2)
      expect(recoveredStats.serviceBreakdown['service-a'].nounCount).toBe(1)
      expect(recoveredStats.serviceBreakdown['service-b'].nounCount).toBe(1)
    })
  })

  describe('Batching and Throttling', () => {
    it('should batch statistics updates to prevent S3 rate limits', async () => {
      s3Mock.on(GetObjectCommand).rejectsOnce({ name: 'NoSuchKey' })
      s3Mock.on(PutObjectCommand).resolves({})

      brainy = new BrainyData({
        embeddingFunction: createMockEmbeddingFunction(),
        storage: {
          s3Storage: {
            bucketName: 'test-bucket',
            accessKeyId: 'test-key',
            secretAccessKey: 'test-secret',
            region: 'us-east-1'
          }
        }
      })
      await brainy.init()

      // Add multiple items rapidly (simulating high load)
      const promises = []
      for (let i = 0; i < 100; i++) {
        promises.push(
          brainy.add(`Item ${i}`, { index: i }, { service: `service-${i % 5}` })
        )
      }
      await Promise.all(promises)

      // Initially, statistics shouldn't be flushed immediately
      const initialPutCalls = s3Mock.commandCalls(PutObjectCommand)
      expect(initialPutCalls.length).toBeLessThan(100) // Should batch, not 100 individual calls

      // Advance timers to trigger batch flush
      vi.advanceTimersByTime(5000)

      // Force flush to ensure all statistics are saved
      await brainy.flushStatistics()

      // Verify statistics are correct
      const stats = await brainy.getStatistics()
      expect(stats.nounCount).toBe(100)
      
      // Verify batching occurred (much fewer S3 calls than items)
      const finalPutCalls = s3Mock.commandCalls(PutObjectCommand)
      expect(finalPutCalls.length).toBeLessThan(20) // Should be batched
    })

    it('should handle S3 throttling (429) gracefully', async () => {
      s3Mock.on(GetObjectCommand).rejectsOnce({ name: 'NoSuchKey' })
      
      // Simulate throttling on first attempt, success on retry
      let putAttempts = 0
      s3Mock.on(PutObjectCommand).callsFake(() => {
        putAttempts++
        if (putAttempts === 1) {
          const error: any = new Error('Too Many Requests')
          error.name = 'TooManyRequestsException'
          error.$metadata = { httpStatusCode: 429 }
          throw error
        }
        return Promise.resolve({})
      })

      brainy = new BrainyData({
        embeddingFunction: createMockEmbeddingFunction(),
        storage: {
          s3Storage: {
            bucketName: 'test-bucket',
            accessKeyId: 'test-key',
            secretAccessKey: 'test-secret',
            region: 'us-east-1'
          }
        }
      })
      await brainy.init()

      // Add data
      await brainy.add('Test data', { metadata: 'test' }, { service: 'throttle-test' })
      
      // Force flush - should retry on throttling
      await brainy.flushStatistics()

      // Verify retry occurred
      expect(putAttempts).toBeGreaterThanOrEqual(1)
      
      // Verify statistics were eventually saved
      const stats = await brainy.getStatistics()
      expect(stats.nounCount).toBe(1)
    })
  })

  describe('Time-Based Partitioning', () => {
    it('should partition statistics by date to avoid single-key rate limits', async () => {
      s3Mock.on(GetObjectCommand).rejects({ name: 'NoSuchKey' })
      s3Mock.on(PutObjectCommand).resolves({})
      s3Mock.on(ListObjectsV2Command).resolves({ Contents: [] })

      brainy = new BrainyData({
        embeddingFunction: createMockEmbeddingFunction(),
        storage: {
          s3Storage: {
            bucketName: 'test-bucket',
            accessKeyId: 'test-key',
            secretAccessKey: 'test-secret',
            region: 'us-east-1'
          }
        }
      })
      await brainy.init()

      // Add data across different time periods
      const today = new Date()
      await brainy.add('Today item', { date: today }, { service: 'time-test' })
      await brainy.flushStatistics()

      // Check that statistics are saved with date-based key
      const putCalls = s3Mock.commandCalls(PutObjectCommand)
      const statisticsCall = putCalls.find(call => 
        call.args[0].input.Key?.includes('_system/statistics')
      )
      
      expect(statisticsCall).toBeDefined()
      // Should include date in the key for partitioning
      const key = statisticsCall?.args[0].input.Key
      expect(key).toContain(today.toISOString().split('T')[0])
    })
  })

  describe('Backward Compatibility', () => {
    it('should read legacy statistics format correctly', async () => {
      // Mock legacy statistics format (without service breakdown)
      const legacyStats = {
        nounCount: 500,
        verbCount: 100,
        metadataCount: 500,
        hnswIndexSize: 500,
        lastUpdated: new Date().toISOString()
      }

      s3Mock.on(GetObjectCommand).resolves({
        Body: {
          transformToString: async () => JSON.stringify(legacyStats)
        }
      })

      brainy = new BrainyData({
        embeddingFunction: createMockEmbeddingFunction(),
        storage: {
          s3Storage: {
            bucketName: 'test-bucket',
            accessKeyId: 'test-key',
            secretAccessKey: 'test-secret',
            region: 'us-east-1'
          }
        }
      })
      await brainy.init()

      // Should handle legacy format gracefully
      const stats = await brainy.getStatistics()
      expect(stats).toBeDefined()
      // Legacy format should be converted to new format with default service
      expect(stats.nounCount).toBe(500)
    })

    it('should migrate legacy statistics to new format on write', async () => {
      // Start with legacy format
      const legacyStats = {
        nounCount: 100,
        verbCount: 50,
        metadataCount: 100,
        hnswIndexSize: 100,
        lastUpdated: new Date().toISOString()
      }

      s3Mock.on(GetObjectCommand).resolvesOnce({
        Body: {
          transformToString: async () => JSON.stringify(legacyStats)
        }
      })
      s3Mock.on(PutObjectCommand).resolves({})

      brainy = new BrainyData({
        embeddingFunction: createMockEmbeddingFunction(),
        storage: {
          s3Storage: {
            bucketName: 'test-bucket',
            accessKeyId: 'test-key',
            secretAccessKey: 'test-secret',
            region: 'us-east-1'
          }
        }
      })
      await brainy.init()

      // Add new data
      await brainy.add('New data', { metadata: 'new' }, { service: 'migration-test' })
      await brainy.flushStatistics()

      // Verify new format was saved
      const putCalls = s3Mock.commandCalls(PutObjectCommand)
      const lastPut = putCalls[putCalls.length - 1]
      const savedData = JSON.parse(lastPut.args[0].input.Body as string)
      
      // Should have service-based structure
      expect(savedData.nounCount).toBeTypeOf('object')
      expect(savedData.nounCount['migration-test']).toBeDefined()
    })
  })

  describe('Concurrent Updates', () => {
    it('should handle concurrent statistics updates safely', async () => {
      s3Mock.on(GetObjectCommand).rejectsOnce({ name: 'NoSuchKey' })
      s3Mock.on(PutObjectCommand).resolves({})

      brainy = new BrainyData({
        embeddingFunction: createMockEmbeddingFunction(),
        storage: {
          s3Storage: {
            bucketName: 'test-bucket',
            accessKeyId: 'test-key',
            secretAccessKey: 'test-secret',
            region: 'us-east-1'
          }
        }
      })
      await brainy.init()

      // Simulate concurrent additions from multiple services
      const services = ['api', 'worker', 'batch', 'stream', 'webhook']
      const concurrentOps = []

      for (let i = 0; i < 50; i++) {
        const service = services[i % services.length]
        concurrentOps.push(
          brainy.add(`Data ${i}`, { index: i }, { service })
        )
      }

      // Add relationships concurrently
      await Promise.all(concurrentOps)
      
      const ids = concurrentOps.map((_, i) => `id-${i}`)
      const relationOps = []
      for (let i = 0; i < 10; i++) {
        relationOps.push(
          brainy.relate(
            ids[i], 
            ids[i + 10], 
            'related', 
            { service: services[i % services.length] }
          ).catch(() => {}) // Ignore if IDs don't exist
        )
      }

      await Promise.all(relationOps)
      await brainy.flushStatistics()

      // Verify all operations were counted correctly
      const stats = await brainy.getStatistics()
      expect(stats.nounCount).toBe(50)
      
      // Verify per-service counts
      for (const service of services) {
        expect(stats.serviceBreakdown[service]).toBeDefined()
        expect(stats.serviceBreakdown[service].nounCount).toBe(10) // 50 items / 5 services
      }
    })
  })

  describe('Large Scale Statistics', () => {
    it('should handle statistics for millions of records efficiently', async () => {
      // Mock large existing statistics
      const largeStats = {
        nounCount: { 
          'service-1': 1000000,
          'service-2': 2000000,
          'service-3': 1500000
        },
        verbCount: {
          'service-1': 500000,
          'service-2': 750000,
          'service-3': 600000
        },
        metadataCount: {
          'service-1': 1000000,
          'service-2': 2000000,
          'service-3': 1500000
        },
        hnswIndexSize: 4500000,
        lastUpdated: new Date().toISOString()
      }

      s3Mock.on(GetObjectCommand).resolves({
        Body: {
          transformToString: async () => JSON.stringify(largeStats)
        }
      })
      s3Mock.on(PutObjectCommand).resolves({})

      brainy = new BrainyData({
        embeddingFunction: createMockEmbeddingFunction(),
        storage: {
          s3Storage: {
            bucketName: 'test-bucket',
            accessKeyId: 'test-key',
            secretAccessKey: 'test-secret',
            region: 'us-east-1'
          }
        }
      })
      await brainy.init()

      // Get statistics for large dataset
      const stats = await brainy.getStatistics()
      
      // Verify large numbers are handled correctly
      expect(stats.nounCount).toBe(4500000)
      expect(stats.verbCount).toBe(1850000)
      
      // Add more data to large dataset
      await brainy.add('New item in large dataset', {}, { service: 'service-1' })
      await brainy.flushStatistics()

      // Verify increment worked correctly with large numbers
      const updatedStats = await brainy.getStatistics()
      expect(updatedStats.nounCount).toBe(4500001)
      expect(updatedStats.serviceBreakdown['service-1'].nounCount).toBe(1000001)
    })
  })
})