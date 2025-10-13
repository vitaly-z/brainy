/**
 * MetadataIndex Automatic Bucketing Tests (v3.41.0)
 * Verify that temporal fields are automatically bucketed from the start
 * to prevent file pollution while enabling range queries
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { MemoryStorage } from '../../../src/storage/adapters/memoryStorage.js'
import { MetadataIndexManager } from '../../../src/utils/metadataIndex.js'

describe('MetadataIndex Automatic Bucketing (v3.41.0)', () => {
  let storage: MemoryStorage
  let index: MetadataIndexManager
  // Use a fixed base timestamp to avoid test pollution from Date.now() bucketing
  const TEST_BASE_TIME = 1700000000000 // Fixed timestamp (Nov 14, 2023)

  beforeEach(() => {
    storage = new MemoryStorage()
    // No excludeFields config - fully automatic!
    index = new MetadataIndexManager(storage, {})
  })

  afterEach(async () => {
    // MemoryStorage doesn't have a close() method
  })

  it('should automatically bucket timestamps from the first operation', async () => {
    // Add 100 entities with unique timestamps (every millisecond)
    const baseTime = TEST_BASE_TIME
    for (let i = 0; i < 100; i++) {
      await index.addToIndex(`entity${i}`, {
        noun: 'character',
        modified: baseTime + i  // 100 unique timestamps
      })
    }

    await index.flush()

    // Without bucketing: would create 100 metadata index files
    // With bucketing: should create only ~2 files (all fit in one 1-minute bucket)

    // Get available values for 'modified' field
    const modifiedValues = await index.getFilterValues('modified')

    // Should have very few unique values (all bucketed to 1-minute intervals)
    expect(modifiedValues.length).toBeLessThan(5) // Much less than 100!
    expect(modifiedValues.length).toBeGreaterThan(0) // But not zero
  })

  it('should prevent file pollution with high-cardinality timestamps', async () => {
    // Simulate the bug scenario: 575 relationships with unique timestamps
    const baseTime = TEST_BASE_TIME + 10000000 // Offset to avoid bucket collision with other tests
    for (let i = 0; i < 575; i++) {
      await index.addToIndex(`verb${i}`, {
        verb: 'relates_to',
        modified: baseTime + (i * 1000), // Every second
        accessed: baseTime + (i * 500)   // Every half-second
      })
    }

    await index.flush()

    // Without bucketing: 575 unique modified + 1150 unique accessed = 1725 index files
    // With bucketing: ~10 modified buckets + ~20 accessed buckets = ~30 index files

    const modifiedValues = await index.getFilterValues('modified')
    const accessedValues = await index.getFilterValues('accessed')

    // Should have created FAR fewer index entries due to bucketing
    expect(modifiedValues.length).toBeLessThan(100) // Not 575!
    expect(accessedValues.length).toBeLessThan(200) // Not 1150!

    // But should still have indexed them (not excluded)
    expect(modifiedValues.length).toBeGreaterThan(0)
    expect(accessedValues.length).toBeGreaterThan(0)
  })

  it('should enable range queries on bucketed timestamp fields', async () => {
    // Add entities with timestamps at exact bucket boundaries (every minute)
    const bucketStart = Math.floor((TEST_BASE_TIME + 20000000) / 60000) * 60000
    for (let i = 0; i < 100; i++) {
      await index.addToIndex(`entity${i}`, {
        noun: 'character',
        modified: bucketStart + (i * 60000) // Every minute = every bucket
      })
    }

    await index.flush()

    // Query: modified >= (bucketStart + 30 minutes)
    const thirtyMinutesLater = bucketStart + (30 * 60000)
    const results = await index.getIdsForFilter({
      modified: { greaterThanOrEqual: thirtyMinutesLater }
    })

    // Should find entities 30-99 (70 entities)
    // Note: With bucketing, we expect exactly 70 entities (30-99 inclusive)
    expect(results.length).toBe(70)

    // Verify results are correct
    results.forEach(id => {
      const num = parseInt(id.replace('entity', ''))
      expect(num).toBeGreaterThanOrEqual(30) // Should be in range
    })
  })

  it('should work with zero configuration (no excludeFields, no rangeQueryFields)', async () => {
    // Create index with NO config at all
    const autoIndex = new MetadataIndexManager(storage, {})
    const testTime = TEST_BASE_TIME + 30000000 // Offset to avoid bucket collision

    // Add entity with multiple field types
    await autoIndex.addToIndex('test1', {
      id: 'uuid-123',               // Should be excluded (in default excludeFields)
      noun: 'character',             // Should be indexed (low cardinality)
      modified: testTime,            // Should be indexed + bucketed (temporal)
      accessed: testTime,            // Should be indexed + bucketed (temporal)
      content: 'long text content',  // Should be excluded (in default excludeFields)
      customTimestamp: testTime      // Should be indexed + bucketed (has 'time' in name)
    })

    await autoIndex.flush()

    // Verify 'modified' was indexed and bucketed
    const modifiedValues = await autoIndex.getFilterValues('modified')
    expect(modifiedValues.length).toBeGreaterThan(0) // Indexed!

    // Verify 'accessed' was indexed and bucketed
    const accessedValues = await autoIndex.getFilterValues('accessed')
    expect(accessedValues.length).toBeGreaterThan(0) // Indexed!

    // Verify 'customTimestamp' was indexed and bucketed
    const customValues = await autoIndex.getFilterValues('customTimestamp')
    expect(customValues.length).toBeGreaterThan(0) // Indexed!

    // Verify 'id' was excluded
    const idValues = await autoIndex.getFilterValues('id')
    expect(idValues.length).toBe(0) // Excluded!

    // Verify 'content' was excluded
    const contentValues = await autoIndex.getFilterValues('content')
    expect(contentValues.length).toBe(0) // Excluded!
  })

  it('should handle fields with "time" or "date" in their names', async () => {
    // Add entities with various timestamp field names
    const testTime = TEST_BASE_TIME + 40000000 // Offset to avoid bucket collision
    await index.addToIndex('entity1', {
      timestamp: testTime,
      createdAt: testTime,
      updatedAt: testTime,
      birthdate: testTime,
      eventTime: testTime,
      lastSeen: testTime // Doesn't match pattern, won't be bucketed
    })

    await index.flush()

    // Fields with 'time' or 'date' should be bucketed
    const timestampValues = await index.getFilterValues('timestamp')
    const createdAtValues = await index.getFilterValues('createdAt')
    const updatedAtValues = await index.getFilterValues('updatedAt')
    const birthdateValues = await index.getFilterValues('birthdate')
    const eventTimeValues = await index.getFilterValues('eventTime')

    // All should be indexed (not excluded)
    expect(timestampValues.length).toBeGreaterThan(0)
    expect(createdAtValues.length).toBeGreaterThan(0)
    expect(updatedAtValues.length).toBeGreaterThan(0)
    expect(birthdateValues.length).toBeGreaterThan(0)
    expect(eventTimeValues.length).toBeGreaterThan(0)
  })

  it('should bucket timestamps to 1-minute intervals by default', async () => {
    // Use a timestamp at the start of a minute bucket to ensure 30s apart stays in same bucket
    const bucketStart = Math.floor((TEST_BASE_TIME + 50000000) / 60000) * 60000
    await index.addToIndex('entity1', { modified: bucketStart })
    await index.addToIndex('entity2', { modified: bucketStart + 30000 }) // +30 seconds, still in same bucket

    await index.flush()

    // Both should be in the same 1-minute bucket
    const ids1 = await index.getIds('modified', bucketStart)
    const ids2 = await index.getIds('modified', bucketStart + 30000)

    // Both queries should return both entities (same bucket)
    expect(ids1.length).toBe(2)
    expect(ids2.length).toBe(2)
    expect(ids1.sort()).toEqual(ids2.sort())
  })

  it('should create separate buckets for timestamps >1 minute apart', async () => {
    // Use bucket boundaries to ensure entities are in different buckets
    const bucket1Start = Math.floor((TEST_BASE_TIME + 60000000) / 60000) * 60000
    const bucket2Start = bucket1Start + 120000 // +2 minutes (definitely different bucket)
    await index.addToIndex('entity1', { modified: bucket1Start })
    await index.addToIndex('entity2', { modified: bucket2Start })

    await index.flush()

    // Should be in different 1-minute buckets
    const ids1 = await index.getIds('modified', bucket1Start)
    const ids2 = await index.getIds('modified', bucket2Start)

    // Each query should return only its own entity
    expect(ids1).toContain('entity1')
    expect(ids1).not.toContain('entity2')
    expect(ids2).toContain('entity2')
    expect(ids2).not.toContain('entity1')
  })

  it('should handle range queries across bucket boundaries', async () => {
    // Use explicit bucket boundaries for predictable range queries
    const bucket0 = Math.floor((TEST_BASE_TIME + 70000000) / 60000) * 60000
    const bucket1 = bucket0 + 60000  // +1 minute
    const bucket2 = bucket0 + 120000 // +2 minutes
    const bucket3 = bucket0 + 180000 // +3 minutes

    await index.addToIndex('entity0', { modified: bucket0 })
    await index.addToIndex('entity1', { modified: bucket1 })
    await index.addToIndex('entity2', { modified: bucket2 })
    await index.addToIndex('entity3', { modified: bucket3 })

    await index.flush()

    // Query: modified > bucket1 (should get entity2 and entity3, not entity0 or entity1)
    const results = await index.getIdsForFilter({
      modified: { greaterThan: bucket1 }
    })

    // Should include entities after bucket1
    expect(results).toContain('entity2')
    expect(results).toContain('entity3')

    // Should not include entity0 or entity1 (at or before bucket1)
    expect(results).not.toContain('entity0')
    expect(results).not.toContain('entity1')
  })

  it('should not break non-temporal numeric fields', async () => {
    // Add entities with regular numeric fields (not timestamps)
    await index.addToIndex('entity1', {
      noun: 'item',
      price: 19.99,
      quantity: 5,
      rating: 4.5
    })

    await index.addToIndex('entity2', {
      noun: 'item',
      price: 29.99,
      quantity: 3,
      rating: 4.7
    })

    await index.flush()

    // Non-temporal numeric fields should NOT be bucketed
    const priceValues = await index.getFilterValues('price')
    const quantityValues = await index.getFilterValues('quantity')
    const ratingValues = await index.getFilterValues('rating')

    // Each unique value should create its own index entry
    expect(priceValues).toContain('19.99')
    expect(priceValues).toContain('29.99')
    expect(quantityValues).toContain('5')
    expect(quantityValues).toContain('3')
    expect(ratingValues.length).toBeGreaterThan(0)
  })

  it('should maintain backward compatibility with existing code', async () => {
    // Existing code that used excludeFields should still work
    const legacyIndex = new MetadataIndexManager(storage, {
      excludeFields: ['internalField', 'debugData']
    })
    const testTime = TEST_BASE_TIME + 90000000 // Offset to avoid bucket collision

    await legacyIndex.addToIndex('entity1', {
      noun: 'character',
      modified: testTime,           // Should be indexed + bucketed
      internalField: 'secret',      // Should be excluded
      debugData: 'verbose logs'     // Should be excluded
    })

    await legacyIndex.flush()

    // Modified should be indexed
    const modifiedValues = await legacyIndex.getFilterValues('modified')
    expect(modifiedValues.length).toBeGreaterThan(0)

    // Custom excluded fields should be excluded
    const internalValues = await legacyIndex.getFilterValues('internalField')
    const debugValues = await legacyIndex.getFilterValues('debugData')
    expect(internalValues.length).toBe(0)
    expect(debugValues.length).toBe(0)
  })
})
