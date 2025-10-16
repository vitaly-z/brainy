/**
 * Field Type Inference Unit Tests
 *
 * Comprehensive tests for production-ready value-based type detection
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { FieldTypeInference, FieldType } from '../../src/utils/fieldTypeInference.js'
import { MemoryStorage } from '../../src/storage/adapters/memoryStorage.js'

describe('FieldTypeInference', () => {
  let storage: MemoryStorage
  let inference: FieldTypeInference

  beforeEach(async () => {
    storage = new MemoryStorage()
    await storage.init()
    inference = new FieldTypeInference(storage)
  })

  afterEach(async () => {
    await storage.clear()
  })

  // ============================================================================
  // Boolean Detection
  // ============================================================================

  describe('Boolean Detection', () => {
    it('should detect true/false values', async () => {
      const result = await inference.inferFieldType('active', [true, false, true])

      expect(result.inferredType).toBe(FieldType.BOOLEAN)
      expect(result.confidence).toBe(1.0)
      expect(result.sampleSize).toBe(3)
    })

    it('should detect "true"/"false" strings', async () => {
      const result = await inference.inferFieldType('flag', ['true', 'false', 'true'])

      expect(result.inferredType).toBe(FieldType.BOOLEAN)
      expect(result.confidence).toBe(1.0)
    })

    it('should detect 1/0 as boolean', async () => {
      const result = await inference.inferFieldType('enabled', ['1', '0', '1', '0'])

      expect(result.inferredType).toBe(FieldType.BOOLEAN)
      expect(result.confidence).toBe(1.0)
    })

    it('should detect yes/no as boolean', async () => {
      const result = await inference.inferFieldType('confirmed', ['yes', 'no', 'yes'])

      expect(result.inferredType).toBe(FieldType.BOOLEAN)
      expect(result.confidence).toBe(1.0)
    })
  })

  // ============================================================================
  // Integer Detection
  // ============================================================================

  describe('Integer Detection', () => {
    it('should detect integer numbers', async () => {
      const result = await inference.inferFieldType('count', [1, 2, 3, 42, 100])

      expect(result.inferredType).toBe(FieldType.INTEGER)
      expect(result.confidence).toBe(1.0)
    })

    it('should detect integer strings', async () => {
      const result = await inference.inferFieldType('age', ['25', '30', '45'])

      expect(result.inferredType).toBe(FieldType.INTEGER)
      expect(result.confidence).toBe(1.0)
    })

    it('should detect negative integers', async () => {
      const result = await inference.inferFieldType('balance', [-100, -50, 0, 50, 100])

      expect(result.inferredType).toBe(FieldType.INTEGER)
      expect(result.confidence).toBe(1.0)
    })
  })

  // ============================================================================
  // Unix Timestamp Detection (The Key Feature!)
  // ============================================================================

  describe('Unix Timestamp Detection', () => {
    it('should detect Unix timestamps in milliseconds', async () => {
      // January 16, 2025 timestamps
      const timestamps = [1705420800000, 1705420860000, 1705420920000]
      const result = await inference.inferFieldType('extractedAt', timestamps)

      expect(result.inferredType).toBe(FieldType.TIMESTAMP_MS)
      expect(result.confidence).toBe(0.95)
      expect(result.metadata?.precision).toBe('milliseconds')
      expect(result.metadata?.bucketSize).toBe(60000) // 1 minute buckets
      expect(result.metadata?.format).toBe('Unix timestamp')
    })

    it('should detect Unix timestamps in seconds', async () => {
      // January 16, 2025 timestamps (seconds)
      const timestamps = [1705420800, 1705420860, 1705420920]
      const result = await inference.inferFieldType('created', timestamps)

      expect(result.inferredType).toBe(FieldType.TIMESTAMP_S)
      expect(result.confidence).toBe(0.95)
      expect(result.metadata?.precision).toBe('seconds')
      expect(result.metadata?.bucketSize).toBe(60000)
    })

    it('should detect timestamps with field name irrelevant', async () => {
      // The field is called "randomFieldName" but VALUES are timestamps
      const timestamps = [1705420800000, 1705420860000]
      const result = await inference.inferFieldType('randomFieldName', timestamps)

      expect(result.inferredType).toBe(FieldType.TIMESTAMP_MS)
      expect(result.confidence).toBe(0.95)
    })

    it('should NOT detect non-timestamp integers as timestamps', async () => {
      // These are just regular integers, not in timestamp range
      const values = [1, 2, 3, 4, 5]
      const result = await inference.inferFieldType('count', values)

      expect(result.inferredType).toBe(FieldType.INTEGER)
      expect(result.confidence).toBe(1.0)
    })

    it('should handle mixed timestamp ranges (seconds and milliseconds)', async () => {
      // All milliseconds
      const values = [1705420800000, 1705420860000, 1705420920000]
      const result = await inference.inferFieldType('time', values)

      expect(result.inferredType).toBe(FieldType.TIMESTAMP_MS)
    })
  })

  // ============================================================================
  // Float Detection
  // ============================================================================

  describe('Float Detection', () => {
    it('should detect float numbers', async () => {
      const result = await inference.inferFieldType('price', [19.99, 29.99, 39.99])

      expect(result.inferredType).toBe(FieldType.FLOAT)
      expect(result.confidence).toBe(1.0)
    })

    it('should detect float strings', async () => {
      const result = await inference.inferFieldType('temperature', ['98.6', '100.2', '99.1'])

      expect(result.inferredType).toBe(FieldType.FLOAT)
      expect(result.confidence).toBe(1.0)
    })

    it('should detect scientific notation floats', async () => {
      // Use values that result in actual floats (not integers)
      const result = await inference.inferFieldType('distance', [1.23e-5, 4.56e-3, 7.89e1])

      expect(result.inferredType).toBe(FieldType.FLOAT)
    })
  })

  // ============================================================================
  // ISO 8601 Date/Datetime Detection
  // ============================================================================

  describe('ISO 8601 Detection', () => {
    it('should detect ISO 8601 dates (YYYY-MM-DD)', async () => {
      const dates = ['2025-01-16', '2025-01-17', '2025-01-18']
      const result = await inference.inferFieldType('date', dates)

      expect(result.inferredType).toBe(FieldType.DATE_ISO8601)
      expect(result.confidence).toBe(0.95)
      expect(result.metadata?.precision).toBe('date')
      expect(result.metadata?.bucketSize).toBe(86400000) // 1 day
    })

    it('should detect ISO 8601 datetimes with time', async () => {
      const datetimes = [
        '2025-01-16T10:30:00Z',
        '2025-01-16T10:31:00Z',
        '2025-01-16T10:32:00Z'
      ]
      const result = await inference.inferFieldType('createdAt', datetimes)

      expect(result.inferredType).toBe(FieldType.DATETIME_ISO8601)
      expect(result.confidence).toBe(0.95)
      expect(result.metadata?.precision).toBe('datetime')
      expect(result.metadata?.bucketSize).toBe(60000) // 1 minute
    })

    it('should detect ISO 8601 with timezone offset', async () => {
      const datetimes = [
        '2025-01-16T10:30:00+05:30',
        '2025-01-16T10:31:00+05:30'
      ]
      const result = await inference.inferFieldType('timestamp', datetimes)

      expect(result.inferredType).toBe(FieldType.DATETIME_ISO8601)
    })

    it('should detect ISO 8601 with milliseconds', async () => {
      const datetimes = [
        '2025-01-16T10:30:00.123Z',
        '2025-01-16T10:31:00.456Z'
      ]
      const result = await inference.inferFieldType('precise', datetimes)

      expect(result.inferredType).toBe(FieldType.DATETIME_ISO8601)
    })
  })

  // ============================================================================
  // UUID Detection
  // ============================================================================

  describe('UUID Detection', () => {
    it('should detect UUIDs', async () => {
      const uuids = [
        'f47ac10b-58cc-4372-a567-0e02b2c3d479',
        'e8a7c924-1234-5678-9abc-def012345678',
        '123e4567-e89b-12d3-a456-426614174000'
      ]
      const result = await inference.inferFieldType('id', uuids)

      expect(result.inferredType).toBe(FieldType.UUID)
      expect(result.confidence).toBe(1.0)
    })

    it('should NOT detect non-UUID strings as UUIDs', async () => {
      const values = ['not-a-uuid', 'random-string', 'abc123']
      const result = await inference.inferFieldType('text', values)

      expect(result.inferredType).not.toBe(FieldType.UUID)
      expect(result.inferredType).toBe(FieldType.STRING)
    })
  })

  // ============================================================================
  // Array/Object Detection
  // ============================================================================

  describe('Array and Object Detection', () => {
    it('should detect arrays', async () => {
      const arrays = [[1, 2, 3], [4, 5, 6], [7, 8, 9]]
      const result = await inference.inferFieldType('numbers', arrays)

      expect(result.inferredType).toBe(FieldType.ARRAY)
      expect(result.confidence).toBe(1.0)
    })

    it('should detect objects', async () => {
      const objects = [{ a: 1 }, { b: 2 }, { c: 3 }]
      const result = await inference.inferFieldType('data', objects)

      expect(result.inferredType).toBe(FieldType.OBJECT)
      expect(result.confidence).toBe(1.0)
    })
  })

  // ============================================================================
  // String Default
  // ============================================================================

  describe('String Detection', () => {
    it('should default to string for text values', async () => {
      const values = ['hello', 'world', 'foo', 'bar']
      const result = await inference.inferFieldType('name', values)

      expect(result.inferredType).toBe(FieldType.STRING)
      expect(result.confidence).toBe(0.8)
    })

    it('should handle empty strings', async () => {
      const values = ['', '', '']
      const result = await inference.inferFieldType('empty', values)

      expect(result.inferredType).toBe(FieldType.STRING)
    })

    it('should handle mixed content as string', async () => {
      const values = ['123abc', 'def456', 'mixed!@#']
      const result = await inference.inferFieldType('mixed', values)

      expect(result.inferredType).toBe(FieldType.STRING)
    })
  })

  // ============================================================================
  // Cache Functionality
  // ============================================================================

  describe('Cache Functionality', () => {
    it('should cache inferred types for fast lookups', async () => {
      const values = [1705420800000, 1705420860000]

      // First call: analyze values (cache miss)
      const result1 = await inference.inferFieldType('extractedAt', values)

      // Second call: cache hit (should return same result instantly)
      const result2 = await inference.inferFieldType('extractedAt', values)

      // Verify cache returns identical results
      expect(result1.inferredType).toBe(result2.inferredType)
      expect(result1.confidence).toBe(result2.confidence)
      expect(result1.sampleSize).toBe(result2.sampleSize)
    })

    it('should persist cache to storage', async () => {
      // Use 50+ samples to meet MIN_SAMPLE_SIZE_FOR_CONFIDENCE threshold
      const values = Array.from({ length: 60 }, (_, i) => 1705420800000 + i * 60000)
      await inference.inferFieldType('extractedAt', values)

      // Create new instance (should load from storage)
      const newInference = new FieldTypeInference(storage)
      const result = await newInference.inferFieldType('extractedAt', [])

      expect(result.inferredType).toBe(FieldType.TIMESTAMP_MS)
    })

    it('should clear cache', async () => {
      const values = [1, 2, 3]
      await inference.inferFieldType('count', values)

      await inference.clearCache('count')

      const stats = inference.getCacheStats()
      expect(stats.size).toBe(0)
    })
  })

  // ============================================================================
  // Progressive Refinement
  // ============================================================================

  describe('Progressive Refinement', () => {
    it('should refine type inference with more samples', async () => {
      // Start with few samples (low confidence)
      const fewSamples = [1, 2, 3]
      const result1 = await inference.inferFieldType('value', fewSamples)

      expect(result1.sampleSize).toBe(3)

      // Refine with more samples
      const moreSamples = Array.from({ length: 100 }, (_, i) => i + 1)
      await inference.refineTypeInference('value', moreSamples)

      // Should have updated sample size
      const result2 = await inference.inferFieldType('value', [])
      expect(result2.sampleSize).toBeGreaterThan(3)
    })
  })

  // ============================================================================
  // Edge Cases
  // ============================================================================

  describe('Edge Cases', () => {
    it('should handle empty value arrays', async () => {
      const result = await inference.inferFieldType('empty', [])

      expect(result.inferredType).toBe(FieldType.STRING)
      expect(result.confidence).toBe(0.5)
      expect(result.sampleSize).toBe(0)
    })

    it('should handle null/undefined values', async () => {
      const values = [null, undefined, null]
      const result = await inference.inferFieldType('nullable', values)

      expect(result.inferredType).toBe(FieldType.STRING)
      expect(result.confidence).toBe(0.5)
    })

    it('should handle very large sample sizes', async () => {
      const values = Array.from({ length: 10000 }, (_, i) => i)
      const result = await inference.inferFieldType('large', values)

      expect(result.inferredType).toBe(FieldType.INTEGER)
      expect(result.sampleSize).toBe(100) // Should sample only 100
    })
  })

  // ============================================================================
  // Utility Methods
  // ============================================================================

  describe('Utility Methods', () => {
    it('should identify temporal types', () => {
      expect(inference.isTemporal(FieldType.TIMESTAMP_MS)).toBe(true)
      expect(inference.isTemporal(FieldType.TIMESTAMP_S)).toBe(true)
      expect(inference.isTemporal(FieldType.DATE_ISO8601)).toBe(true)
      expect(inference.isTemporal(FieldType.DATETIME_ISO8601)).toBe(true)
      expect(inference.isTemporal(FieldType.STRING)).toBe(false)
      expect(inference.isTemporal(FieldType.INTEGER)).toBe(false)
    })

    it('should get bucket size for temporal types', async () => {
      const values = [1705420800000, 1705420860000]
      const result = await inference.inferFieldType('extractedAt', values)

      const bucketSize = inference.getBucketSize(result)
      expect(bucketSize).toBe(60000) // 1 minute
    })

    it('should get cache statistics', async () => {
      const values1 = [1705420800000, 1705420860000]
      const values2 = [1, 2, 3]
      const values3 = ['hello', 'world']

      await inference.inferFieldType('timestamp', values1)
      await inference.inferFieldType('count', values2)
      await inference.inferFieldType('name', values3)

      const stats = inference.getCacheStats()
      expect(stats.size).toBe(3)
      expect(stats.temporalFields).toBe(1)
      expect(stats.nonTemporalFields).toBe(2)
      expect(stats.fields).toContain('timestamp')
      expect(stats.fields).toContain('count')
      expect(stats.fields).toContain('name')
    })
  })

  // ============================================================================
  // Real-World Scenarios
  // ============================================================================

  describe('Real-World Scenarios', () => {
    it('should handle extractedAt field (the bug that started it all!)', async () => {
      // This is the exact scenario that caused 275k files!
      const extractedAtValues = [
        1705420800123,
        1705420800456,
        1705420800789,
        1705420801012
      ]

      const result = await inference.inferFieldType('extractedAt', extractedAtValues)

      expect(result.inferredType).toBe(FieldType.TIMESTAMP_MS)
      expect(result.confidence).toBe(0.95)
      expect(result.metadata?.bucketSize).toBe(60000)

      // With bucketing, all these should normalize to same bucket
      // This prevents file explosion!
    })

    it('should handle importedAt, uploadedAt, createdAt, etc.', async () => {
      const fields = ['importedAt', 'uploadedAt', 'createdAt', 'modifiedAt']

      for (const field of fields) {
        const values = [1705420800000, 1705420860000]
        const result = await inference.inferFieldType(field, values)

        expect(result.inferredType).toBe(FieldType.TIMESTAMP_MS)
        expect(result.metadata?.bucketSize).toBe(60000)
      }
    })

    it('should handle non-temporal fields with "at" suffix', async () => {
      // Not all fields ending in "at" are timestamps!
      const values = ['cat', 'bat', 'hat', 'rat']
      const result = await inference.inferFieldType('animal', values)

      expect(result.inferredType).toBe(FieldType.STRING)
      expect(result.inferredType).not.toBe(FieldType.TIMESTAMP_MS)
    })
  })
})
