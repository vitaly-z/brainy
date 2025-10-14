/**
 * Roaring Bitmap Integration Tests
 *
 * Tests the v3.43.0 roaring bitmap integration for metadata indexing:
 * - EntityIdMapper (UUID ↔ integer conversion)
 * - ChunkData with RoaringBitmap32
 * - Multi-field intersection queries
 * - Persistence and serialization
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { EntityIdMapper } from '../../../src/utils/entityIdMapper.js'
import { ChunkManager } from '../../../src/utils/metadataIndexChunking.js'
import { MetadataIndexManager } from '../../../src/utils/metadataIndex.js'
import { MemoryStorage } from '../../../src/storage/adapters/memoryStorage.js'
import { RoaringBitmap32 } from 'roaring-wasm'
import { v4 as uuidv4 } from '../../../src/universal/uuid.js'

describe('EntityIdMapper', () => {
  let storage: MemoryStorage
  let idMapper: EntityIdMapper

  beforeEach(async () => {
    storage = new MemoryStorage()
    await storage.init()
    idMapper = new EntityIdMapper({
      storage,
      storageKey: 'test:entityIdMapper'
    })
    await idMapper.init()
  })

  it('should assign unique integer IDs to UUIDs', () => {
    const uuid1 = uuidv4()
    const uuid2 = uuidv4()

    const int1 = idMapper.getOrAssign(uuid1)
    const int2 = idMapper.getOrAssign(uuid2)

    expect(int1).toBe(1)
    expect(int2).toBe(2)
    expect(int1).not.toBe(int2)
  })

  it('should return same integer for same UUID', () => {
    const uuid = uuidv4()

    const int1 = idMapper.getOrAssign(uuid)
    const int2 = idMapper.getOrAssign(uuid)

    expect(int1).toBe(int2)
  })

  it('should convert integer back to UUID', () => {
    const uuid = uuidv4()
    const intId = idMapper.getOrAssign(uuid)

    const retrievedUuid = idMapper.getUuid(intId)

    expect(retrievedUuid).toBe(uuid)
  })

  it('should convert UUID arrays to integer arrays', () => {
    const uuids = [uuidv4(), uuidv4(), uuidv4()]
    const ints = idMapper.uuidsToInts(uuids)

    expect(ints).toHaveLength(3)
    expect(ints[0]).toBe(1)
    expect(ints[1]).toBe(2)
    expect(ints[2]).toBe(3)
  })

  it('should convert integer arrays to UUID arrays', () => {
    const uuids = [uuidv4(), uuidv4(), uuidv4()]
    const ints = idMapper.uuidsToInts(uuids)
    const retrievedUuids = idMapper.intsToUuids(ints)

    expect(retrievedUuids).toEqual(uuids)
  })

  it('should convert iterable integers to UUIDs (for bitmap iteration)', () => {
    const uuids = [uuidv4(), uuidv4(), uuidv4()]
    const ints = idMapper.uuidsToInts(uuids)

    // Create a roaring bitmap
    const bitmap = new RoaringBitmap32(ints)

    // Convert bitmap to UUIDs
    const retrievedUuids = idMapper.intsIterableToUuids(bitmap)

    expect(retrievedUuids.sort()).toEqual(uuids.sort())
  })

  it('should persist and load mappings', async () => {
    const uuid1 = uuidv4()
    const uuid2 = uuidv4()

    idMapper.getOrAssign(uuid1)
    idMapper.getOrAssign(uuid2)

    await idMapper.flush()

    // Create new mapper and load
    const newIdMapper = new EntityIdMapper({
      storage,
      storageKey: 'test:entityIdMapper'
    })
    await newIdMapper.init()

    expect(newIdMapper.getInt(uuid1)).toBe(1)
    expect(newIdMapper.getInt(uuid2)).toBe(2)
    expect(newIdMapper.size).toBe(2)
  })

  it('should remove UUID mappings', () => {
    const uuid = uuidv4()
    const intId = idMapper.getOrAssign(uuid)

    expect(idMapper.has(uuid)).toBe(true)

    idMapper.remove(uuid)

    expect(idMapper.has(uuid)).toBe(false)
    expect(idMapper.getInt(uuid)).toBeUndefined()
    expect(idMapper.getUuid(intId)).toBeUndefined()
  })

  it('should clear all mappings', async () => {
    idMapper.getOrAssign(uuidv4())
    idMapper.getOrAssign(uuidv4())
    idMapper.getOrAssign(uuidv4())

    expect(idMapper.size).toBe(3)

    await idMapper.clear()

    expect(idMapper.size).toBe(0)
  })

  it('should provide statistics', () => {
    idMapper.getOrAssign(uuidv4())
    idMapper.getOrAssign(uuidv4())

    const stats = idMapper.getStats()

    expect(stats.mappings).toBe(2)
    expect(stats.nextId).toBe(3)
    expect(stats.memoryEstimate).toBeGreaterThan(0)
  })
})

describe('RoaringBitmap32 Integration', () => {
  it('should create and manipulate roaring bitmaps', () => {
    const bitmap = new RoaringBitmap32()

    bitmap.add(1)
    bitmap.add(2)
    bitmap.add(3)

    expect(bitmap.size).toBe(3)
    expect(bitmap.has(1)).toBe(true)
    expect(bitmap.has(4)).toBe(false)
  })

  it('should perform fast intersection (AND operation)', () => {
    const bitmap1 = new RoaringBitmap32([1, 2, 3, 4, 5])
    const bitmap2 = new RoaringBitmap32([3, 4, 5, 6, 7])
    const bitmap3 = new RoaringBitmap32([4, 5, 6, 7, 8])

    const result = RoaringBitmap32.and(bitmap1, bitmap2, bitmap3)

    // Only 4 and 5 appear in all three bitmaps
    const resultArray = [...result].sort()
    expect(result.size).toBeGreaterThanOrEqual(2)
    expect(resultArray).toContain(4)
    expect(resultArray).toContain(5)
  })

  it('should perform union (OR operation)', () => {
    const bitmap1 = new RoaringBitmap32([1, 2, 3])
    const bitmap2 = new RoaringBitmap32([3, 4, 5])

    const result = RoaringBitmap32.or(bitmap1, bitmap2)

    expect(result.size).toBe(5)
    expect([...result].sort()).toEqual([1, 2, 3, 4, 5])
  })

  it('should serialize and deserialize portably', () => {
    const bitmap = new RoaringBitmap32([1, 2, 3, 100, 1000, 10000])

    const serialized = bitmap.serialize('portable')
    const deserialized = new RoaringBitmap32()
    deserialized.deserialize(serialized, 'portable')

    expect(deserialized.size).toBe(bitmap.size)
    expect([...deserialized].sort()).toEqual([...bitmap].sort())
  })

  it('should be memory efficient', () => {
    const bitmap = new RoaringBitmap32()

    // Add 10,000 sequential integers
    for (let i = 0; i < 10000; i++) {
      bitmap.add(i)
    }

    const serializedSize = bitmap.getSerializationSizeInBytes('portable')

    // Roaring bitmaps should be much smaller than storing 10k integers as Set
    // Set would be ~10k * 8 bytes = 80KB
    // Roaring should be a few KB
    expect(serializedSize).toBeLessThan(20000) // Less than 20KB
  })
})

describe('MetadataIndexManager with Roaring Bitmaps', () => {
  let storage: MemoryStorage
  let metadataIndex: MetadataIndexManager

  beforeEach(async () => {
    storage = new MemoryStorage()
    await storage.init()
    metadataIndex = new MetadataIndexManager(storage)
    await metadataIndex.init()
  })

  it('should index entities and query with roaring bitmaps', async () => {
    // Add entities
    const id1 = uuidv4()
    const id2 = uuidv4()
    const id3 = uuidv4()

    await metadataIndex.addToIndex(id1, { status: 'active', role: 'admin' })
    await metadataIndex.addToIndex(id2, { status: 'active', role: 'user' })
    await metadataIndex.addToIndex(id3, { status: 'inactive', role: 'admin' })

    await metadataIndex.flush()

    // Query single field
    const activeIds = await metadataIndex.getIds('status', 'active')
    expect(activeIds.sort()).toEqual([id1, id2].sort())

    // Query another field
    const adminIds = await metadataIndex.getIds('role', 'admin')
    expect(adminIds.sort()).toEqual([id1, id3].sort())
  })

  it('should perform fast multi-field intersection queries', async () => {
    // Add entities
    const id1 = uuidv4()
    const id2 = uuidv4()
    const id3 = uuidv4()
    const id4 = uuidv4()

    await metadataIndex.addToIndex(id1, { status: 'active', role: 'admin' })
    await metadataIndex.addToIndex(id2, { status: 'active', role: 'user' })
    await metadataIndex.addToIndex(id3, { status: 'active', role: 'guest' })
    await metadataIndex.addToIndex(id4, { status: 'inactive', role: 'admin' })

    await metadataIndex.flush()

    // Query using fast roaring bitmap intersection
    const results = await metadataIndex.getIdsForMultipleFields([
      { field: 'status', value: 'active' },
      { field: 'role', value: 'admin' }
    ])

    expect(results).toEqual([id1])
  })

  it('should handle empty intersection results', async () => {
    const id1 = uuidv4()
    const id2 = uuidv4()

    await metadataIndex.addToIndex(id1, { status: 'active', role: 'admin' })
    await metadataIndex.addToIndex(id2, { status: 'inactive', role: 'user' })

    await metadataIndex.flush()

    // Query with no matching results
    const results = await metadataIndex.getIdsForMultipleFields([
      { field: 'status', value: 'active' },
      { field: 'role', value: 'user' }
    ])

    expect(results).toEqual([])
  })

  it('should short-circuit on empty bitmap', async () => {
    const id1 = uuidv4()

    await metadataIndex.addToIndex(id1, { status: 'active' })
    await metadataIndex.flush()

    // Query with non-existent field value (should short-circuit)
    const results = await metadataIndex.getIdsForMultipleFields([
      { field: 'status', value: 'active' },
      { field: 'nonexistent', value: 'value' }
    ])

    expect(results).toEqual([])
  })

  it('should handle single field query efficiently', async () => {
    const id1 = uuidv4()
    const id2 = uuidv4()

    await metadataIndex.addToIndex(id1, { status: 'active' })
    await metadataIndex.addToIndex(id2, { status: 'active' })

    await metadataIndex.flush()

    // Single field query should use fast path
    const results = await metadataIndex.getIdsForMultipleFields([
      { field: 'status', value: 'active' }
    ])

    expect(results.sort()).toEqual([id1, id2].sort())
  })

  it('should persist and load roaring bitmaps correctly', async () => {
    const id1 = uuidv4()
    const id2 = uuidv4()
    const id3 = uuidv4()

    await metadataIndex.addToIndex(id1, { status: 'active', role: 'admin' })
    await metadataIndex.addToIndex(id2, { status: 'active', role: 'user' })
    await metadataIndex.addToIndex(id3, { status: 'inactive', role: 'admin' })

    await metadataIndex.flush()

    // Create new index manager and load
    const newMetadataIndex = new MetadataIndexManager(storage)
    await newMetadataIndex.init()

    // Query should work with loaded data
    const results = await newMetadataIndex.getIdsForMultipleFields([
      { field: 'status', value: 'active' },
      { field: 'role', value: 'admin' }
    ])

    expect(results).toEqual([id1])
  })

  it('should handle complex multi-field queries', async () => {
    // Create a larger dataset with clear test cases
    const targetIds = []
    const otherIds = []

    // Create 10 entities that match all criteria
    for (let i = 0; i < 10; i++) {
      const id = uuidv4()
      targetIds.push(id)
      await metadataIndex.addToIndex(id, { status: 'active', role: 'admin', tier: 'premium' })
    }

    // Create entities that don't match
    for (let i = 0; i < 20; i++) {
      const id = uuidv4()
      otherIds.push(id)
      await metadataIndex.addToIndex(id, {
        status: i % 2 === 0 ? 'active' : 'inactive',
        role: i % 3 === 0 ? 'admin' : 'user',
        tier: i % 5 === 0 ? 'premium' : 'basic'
      })
    }

    await metadataIndex.flush()

    // Query: active + admin + premium (should match all targetIds)
    const results = await metadataIndex.getIdsForMultipleFields([
      { field: 'status', value: 'active' },
      { field: 'role', value: 'admin' },
      { field: 'tier', value: 'premium' }
    ])

    // All target IDs should be in results
    expect(results.length).toBeGreaterThanOrEqual(10)
    for (const targetId of targetIds) {
      expect(results).toContain(targetId)
    }
  })

  it('should remove entities from roaring bitmap index', async () => {
    const id1 = uuidv4()
    const id2 = uuidv4()

    await metadataIndex.addToIndex(id1, { status: 'active' })
    await metadataIndex.addToIndex(id2, { status: 'active' })

    await metadataIndex.flush()

    // Verify both exist
    let results = await metadataIndex.getIds('status', 'active')
    expect(results.sort()).toEqual([id1, id2].sort())

    // Remove one
    await metadataIndex.removeFromIndex(id1, { status: 'active' })
    await metadataIndex.flush()

    // Verify only one remains
    results = await metadataIndex.getIds('status', 'active')
    expect(results).toEqual([id2])
  })
})

describe('Performance Characteristics', () => {
  it('should demonstrate memory efficiency', () => {
    // Create a Set with UUIDs
    const uuidSet = new Set<string>()
    for (let i = 0; i < 1000; i++) {
      uuidSet.add(uuidv4())
    }

    // Estimate memory: 1000 UUIDs * 36 bytes = 36KB
    const setMemory = uuidSet.size * 36

    // Create a RoaringBitmap32 with integers
    const bitmap = new RoaringBitmap32()
    for (let i = 1; i <= 1000; i++) {
      bitmap.add(i)
    }

    const bitmapMemory = bitmap.getSerializationSizeInBytes('portable')

    // Roaring bitmap should be much smaller
    expect(bitmapMemory).toBeLessThan(setMemory * 0.2) // Less than 20% of Set size
  })

  it('should demonstrate intersection speed advantage', () => {
    // Create large bitmaps
    const bitmap1 = new RoaringBitmap32()
    const bitmap2 = new RoaringBitmap32()
    const bitmap3 = new RoaringBitmap32()

    for (let i = 0; i < 10000; i++) {
      if (i % 2 === 0) bitmap1.add(i)
      if (i % 3 === 0) bitmap2.add(i)
      if (i % 5 === 0) bitmap3.add(i)
    }

    // Measure roaring bitmap intersection
    const start = performance.now()
    const result = RoaringBitmap32.and(bitmap1, bitmap2, bitmap3)
    const roaringTime = performance.now() - start

    // Roaring intersection should be fast
    expect(roaringTime).toBeLessThan(10) // Under 10ms

    // Result should contain numbers divisible by 2, 3, and 5 (i.e., divisible by 30)
    // Verify a few samples
    expect(result.has(0)).toBe(true)
    expect(result.has(30)).toBe(true)
    expect(result.has(60)).toBe(true)
    expect(result.size).toBeGreaterThan(0)
  })
})
