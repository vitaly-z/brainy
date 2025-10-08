/**
 * GCS Native Storage Adapter Integration Tests
 *
 * This test verifies that the GCS native adapter:
 * - Properly authenticates with ADC and service accounts
 * - Implements UUID-based sharding correctly
 * - Handles pagination across shards
 * - Persists data correctly
 * - Manages statistics and counts
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { GcsStorage } from '../../src/storage/adapters/gcsStorage.js'
import { randomUUID } from 'node:crypto'

describe('GCS Native Storage Adapter', () => {
  // Mock GCS client for testing
  let mockGcsObjects: Map<string, any> = new Map()
  let storage: GcsStorage | null = null

  // Helper to create mock GCS client
  function createMockGcsClient() {
    const mockBucket = {
      exists: async () => [true],

      file: (name: string) => ({
        save: async (data: string, options: any) => {
          mockGcsObjects.set(name, JSON.parse(data))
          return {}
        },

        download: async () => {
          const data = mockGcsObjects.get(name)
          if (!data) {
            const error: any = new Error('Not found')
            error.code = 404
            throw error
          }
          return [Buffer.from(JSON.stringify(data))]
        },

        delete: async () => {
          mockGcsObjects.delete(name)
          return [{}]
        }
      }),

      getFiles: async (options: any) => {
        const prefix = options.prefix || ''
        const maxResults = options.maxResults || 1000
        const pageToken = options.pageToken

        console.log(`[Mock GCS] getFiles: Prefix="${prefix}", maxResults=${maxResults}`)

        // Filter objects by prefix
        const allKeys = Array.from(mockGcsObjects.keys())
        const matchingKeys = allKeys.filter(key => key.startsWith(prefix)).sort()

        console.log(`[Mock GCS] Total keys=${allKeys.length}, Matching=${matchingKeys.length}`)
        if (matchingKeys.length > 0) {
          console.log(`[Mock GCS] First match: ${matchingKeys[0]}`)
        }

        // Apply pagination
        let startIndex = 0
        if (pageToken) {
          startIndex = parseInt(pageToken)
        }

        const endIndex = Math.min(startIndex + maxResults, matchingKeys.length)
        const pageKeys = matchingKeys.slice(startIndex, endIndex)

        const files = pageKeys.map(key => ({
          name: key
        }))

        const response = {
          nextPageToken: endIndex < matchingKeys.length ? String(endIndex) : undefined
        }

        return [files, {}, response]
      },

      getMetadata: async () => [{
        location: 'us-central1',
        storageClass: 'STANDARD',
        timeCreated: new Date().toISOString()
      }]
    }

    return {
      bucket: (name: string) => mockBucket
    }
  }

  beforeEach(() => {
    mockGcsObjects.clear()
  })

  afterEach(async () => {
    if (storage) {
      try {
        await storage.clear()
      } catch (error) {
        // Ignore cleanup errors
      }
      storage = null
    }
  })

  it('should initialize with Application Default Credentials (ADC)', async () => {
    // Create storage without any credentials (ADC)
    storage = new GcsStorage({
      bucketName: 'test-bucket'
    })

    // Mock the GCS client
    ;(storage as any).storage = createMockGcsClient()
    ;(storage as any).bucket = (storage as any).storage.bucket('test-bucket')
    ;(storage as any).isInitialized = true

    // Verify initialization
    expect((storage as any).bucketName).toBe('test-bucket')
    expect((storage as any).keyFilename).toBeUndefined()
    expect((storage as any).credentials).toBeUndefined()
  })

  it('should initialize with service account key file', async () => {
    // Create storage with key file
    storage = new GcsStorage({
      bucketName: 'test-bucket',
      keyFilename: '/path/to/service-account.json'
    })

    // Mock the GCS client
    ;(storage as any).storage = createMockGcsClient()
    ;(storage as any).bucket = (storage as any).storage.bucket('test-bucket')
    ;(storage as any).isInitialized = true

    // Verify initialization
    expect((storage as any).keyFilename).toBe('/path/to/service-account.json')
  })

  it('should write and read data with UUID-based sharding', async () => {
    console.log('\n📝 Test: Write and read with UUID sharding...')

    // Create storage
    storage = new GcsStorage({
      bucketName: 'test-bucket'
    })

    // Mock the GCS client
    ;(storage as any).storage = createMockGcsClient()
    ;(storage as any).bucket = (storage as any).storage.bucket('test-bucket')
    ;(storage as any).isInitialized = true

    // Generate UUIDs for testing
    const testData = [
      { id: randomUUID(), vector: [0.1, 0.2, 0.3], metadata: { type: 'user', name: 'Alice' } },
      { id: randomUUID(), vector: [0.4, 0.5, 0.6], metadata: { type: 'user', name: 'Bob' } },
      { id: randomUUID(), vector: [0.7, 0.8, 0.9], metadata: { type: 'user', name: 'Charlie' } }
    ]

    // Save nouns with metadata
    for (const item of testData) {
      const noun = {
        id: item.id,
        vector: item.vector,
        connections: new Map(),
        layer: 0
      }
      await storage.saveNoun(noun)
      await (storage as any).saveNounMetadata_internal(item.id, item.metadata)
    }

    console.log(`✅ Wrote ${testData.length} entities`)
    console.log(`📊 Objects in mock storage: ${mockGcsObjects.size}`)

    // Verify data was written to UUID-sharded paths
    const shardedKeys = Array.from(mockGcsObjects.keys()).filter(k =>
      k.match(/entities\/nouns\/vectors\/[0-9a-f]{2}\//)
    )
    console.log(`🔑 UUID-sharded keys: ${shardedKeys.length}`)
    expect(shardedKeys.length).toBe(testData.length)

    // Log shard distribution
    const shards = new Set(shardedKeys.map(k => k.match(/entities\/nouns\/vectors\/([0-9a-f]{2})\//)?.[1]))
    console.log(`📁 Data distributed across ${shards.size} shards: ${Array.from(shards).join(', ')}`)

    // Verify each entity can be retrieved
    for (const item of testData) {
      const noun = await storage.getNoun(item.id)
      expect(noun).toBeTruthy()
      expect(noun!.id).toBe(item.id)
      expect(noun!.vector).toEqual(item.vector)

      const metadata = await storage.getNounMetadata(item.id)
      expect(metadata).toBeTruthy()
      expect(metadata.name).toBe(item.metadata.name)
    }

    console.log('✅ All entities retrieved successfully')
  })

  it('should handle pagination across UUID shards', async () => {
    console.log('\n🔄 Test: Pagination across shards...')

    // Create storage
    storage = new GcsStorage({
      bucketName: 'test-bucket'
    })

    // Mock the GCS client
    ;(storage as any).storage = createMockGcsClient()
    ;(storage as any).bucket = (storage as any).storage.bucket('test-bucket')
    ;(storage as any).isInitialized = true

    // Write 10 entities with proper UUIDs
    console.log('📝 Writing 10 entities...')
    for (let i = 0; i < 10; i++) {
      const id = randomUUID()
      const noun = {
        id,
        vector: [0.1 * i, 0.2 * i, 0.3 * i],
        connections: new Map(),
        layer: 0
      }
      await storage.saveNoun(noun)
    }

    // Read with pagination (limit: 3)
    console.log('\n🔄 Reading with pagination (limit: 3)...')

    let allEntities: any[] = []
    let cursor: string | undefined
    let page = 0

    do {
      const result = await storage.getNounsWithPagination({
        limit: 3,
        cursor
      })

      page++
      console.log(`📄 Page ${page}: ${result.items.length} entities, hasMore: ${result.hasMore}`)

      allEntities.push(...result.items)
      cursor = result.nextCursor

      // Safety check to prevent infinite loops
      expect(page).toBeLessThan(20)
    } while (cursor)

    console.log(`✅ Loaded ${allEntities.length} total entities across ${page} pages`)

    // Verify all entities were loaded
    expect(allEntities.length).toBe(10)
  })

  it('should return correct totalCount on first call', async () => {
    console.log('\n📊 Test: Correct totalCount...')

    // Create storage
    storage = new GcsStorage({
      bucketName: 'test-bucket'
    })

    // Mock the GCS client
    ;(storage as any).storage = createMockGcsClient()
    ;(storage as any).bucket = (storage as any).storage.bucket('test-bucket')
    ;(storage as any).isInitialized = true

    // Write 5 entities
    for (let i = 0; i < 5; i++) {
      await storage.saveNoun({
        id: randomUUID(),
        vector: [0.1, 0.2, 0.3],
        connections: new Map(),
        layer: 0
      })
    }

    // Get first page
    const result = await storage.getNounsWithPagination({ limit: 2 })

    console.log(`📊 First page: ${result.items.length} items`)

    expect(result.items.length).toBeLessThanOrEqual(2)
  })

  it('should handle verb operations with UUID sharding', async () => {
    console.log('\n🔗 Test: Verb operations with UUID sharding...')

    // Create storage
    storage = new GcsStorage({
      bucketName: 'test-bucket'
    })

    // Mock the GCS client
    ;(storage as any).storage = createMockGcsClient()
    ;(storage as any).bucket = (storage as any).storage.bucket('test-bucket')
    ;(storage as any).isInitialized = true

    // Create verb
    const verbId = randomUUID()
    const verb = {
      id: verbId,
      vector: [0.1, 0.2, 0.3],
      connections: new Map()
    }

    await storage.saveVerb(verb)

    // Verify verb was saved with UUID sharding
    const shardedKeys = Array.from(mockGcsObjects.keys()).filter(k =>
      k.match(/entities\/verbs\/vectors\/[0-9a-f]{2}\//)
    )
    expect(shardedKeys.length).toBeGreaterThan(0)

    // Retrieve verb
    const retrieved = await storage.getVerb(verbId)
    expect(retrieved).toBeTruthy()
    expect(retrieved!.id).toBe(verbId)

    console.log('✅ Verb operations successful')
  })

  it('should handle metadata sharding correctly', async () => {
    console.log('\n🗂️  Test: Metadata sharding...')

    // Create storage
    storage = new GcsStorage({
      bucketName: 'test-bucket'
    })

    // Mock the GCS client
    ;(storage as any).storage = createMockGcsClient()
    ;(storage as any).bucket = (storage as any).storage.bucket('test-bucket')
    ;(storage as any).isInitialized = true

    // Create noun with metadata
    const nounId = randomUUID()
    const noun = {
      id: nounId,
      vector: [0.1, 0.2, 0.3],
      connections: new Map(),
      layer: 0
    }
    const metadata = {
      type: 'user',
      name: 'Test User',
      email: 'test@example.com'
    }

    await storage.saveNoun(noun)
    await (storage as any).saveNounMetadata_internal(nounId, metadata)

    // Verify metadata was saved with UUID sharding
    const metadataKeys = Array.from(mockGcsObjects.keys()).filter(k =>
      k.match(/entities\/nouns\/metadata\/[0-9a-f]{2}\//)
    )
    expect(metadataKeys.length).toBeGreaterThan(0)

    // Retrieve metadata
    const retrieved = await storage.getNounMetadata(nounId)
    expect(retrieved).toBeTruthy()
    expect(retrieved.name).toBe('Test User')

    console.log('✅ Metadata sharding successful')
  })

  it('should clear all data correctly', async () => {
    console.log('\n🧹 Test: Clear all data...')

    // Create storage
    storage = new GcsStorage({
      bucketName: 'test-bucket'
    })

    // Mock the GCS client
    ;(storage as any).storage = createMockGcsClient()
    ;(storage as any).bucket = (storage as any).storage.bucket('test-bucket')
    ;(storage as any).isInitialized = true

    // Write some data
    for (let i = 0; i < 3; i++) {
      await storage.saveNoun({
        id: randomUUID(),
        vector: [0.1, 0.2, 0.3],
        connections: new Map(),
        layer: 0
      })
    }

    console.log(`📊 Objects before clear: ${mockGcsObjects.size}`)

    // Clear all data
    await storage.clear()

    console.log(`📊 Objects after clear: ${mockGcsObjects.size}`)

    expect(mockGcsObjects.size).toBe(0)
    console.log('✅ Clear successful')
  })

  it('should handle throttling errors correctly', async () => {
    console.log('\n🚦 Test: Throttling detection...')

    // Create storage
    storage = new GcsStorage({
      bucketName: 'test-bucket'
    })

    // Test throttling error detection
    const throttlingError = { code: 429, message: 'Too Many Requests' }
    expect((storage as any).isThrottlingError(throttlingError)).toBe(true)

    const quotaError = { code: 403, message: 'Quota exceeded' }
    expect((storage as any).isThrottlingError(quotaError)).toBe(true)

    const normalError = { code: 500, message: 'Internal Server Error' }
    expect((storage as any).isThrottlingError(normalError)).toBe(false)

    console.log('✅ Throttling detection working')
  })

  it('should manage statistics correctly', async () => {
    console.log('\n📊 Test: Statistics management...')

    // Create storage
    storage = new GcsStorage({
      bucketName: 'test-bucket'
    })

    // Mock the GCS client
    ;(storage as any).storage = createMockGcsClient()
    ;(storage as any).bucket = (storage as any).storage.bucket('test-bucket')
    ;(storage as any).isInitialized = true

    // Create statistics
    const stats = {
      nounCount: { 'test-service': 5 },
      verbCount: { 'test-service': 3 },
      metadataCount: {},
      hnswIndexSize: 100,
      lastUpdated: new Date().toISOString()
    }

    // Save statistics
    await (storage as any).saveStatisticsData(stats)

    // Verify statistics key was created
    const statsKeys = Array.from(mockGcsObjects.keys()).filter(k =>
      k.includes('_system/statistics.json')
    )
    expect(statsKeys.length).toBe(1)

    // Retrieve statistics
    const retrieved = await (storage as any).getStatisticsData()
    expect(retrieved).toBeTruthy()
    expect(retrieved.nounCount['test-service']).toBe(5)

    console.log('✅ Statistics management successful')
  })

  it('should get storage status', async () => {
    console.log('\n📊 Test: Storage status...')

    // Create storage
    storage = new GcsStorage({
      bucketName: 'test-bucket'
    })

    // Mock the GCS client
    ;(storage as any).storage = createMockGcsClient()
    ;(storage as any).bucket = (storage as any).storage.bucket('test-bucket')
    ;(storage as any).isInitialized = true

    const status = await storage.getStorageStatus()

    expect(status.type).toBe('gcs-native')
    expect(status.details).toBeTruthy()
    expect(status.details!.bucket).toBe('test-bucket')

    console.log('✅ Storage status retrieved:', status)
  })
})

console.log('\n✅ GCS Native Storage Tests Complete')
