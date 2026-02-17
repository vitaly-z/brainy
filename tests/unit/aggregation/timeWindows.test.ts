import { describe, it, expect } from 'vitest'
import { bucketTimestamp, parseBucketRange } from '../../../src/aggregation/timeWindows'

describe('timeWindows', () => {
  describe('bucketTimestamp', () => {
    // Use a fixed timestamp: 2024-03-15 14:30:45 UTC
    const ts = Date.UTC(2024, 2, 15, 14, 30, 45)

    it('should bucket by hour', () => {
      expect(bucketTimestamp(ts, 'hour')).toBe('2024-03-15T14')
    })

    it('should bucket by day', () => {
      expect(bucketTimestamp(ts, 'day')).toBe('2024-03-15')
    })

    it('should bucket by week', () => {
      // 2024-03-15 is a Friday in ISO week 11
      expect(bucketTimestamp(ts, 'week')).toBe('2024-W11')
    })

    it('should bucket by month', () => {
      expect(bucketTimestamp(ts, 'month')).toBe('2024-03')
    })

    it('should bucket by quarter', () => {
      expect(bucketTimestamp(ts, 'quarter')).toBe('2024-Q1')
    })

    it('should bucket by year', () => {
      expect(bucketTimestamp(ts, 'year')).toBe('2024')
    })

    it('should bucket by custom interval (300 seconds = 5 min)', () => {
      const result = bucketTimestamp(ts, { seconds: 300 })
      // Should floor to nearest 5-minute boundary
      const parsed = new Date(result).getTime()
      expect(parsed % (300 * 1000)).toBe(0)
      expect(parsed).toBeLessThanOrEqual(ts)
      expect(ts - parsed).toBeLessThan(300 * 1000)
    })

    it('should handle midnight correctly for day', () => {
      const midnight = Date.UTC(2024, 0, 1, 0, 0, 0)
      expect(bucketTimestamp(midnight, 'day')).toBe('2024-01-01')
    })

    it('should handle end of year for month', () => {
      const dec = Date.UTC(2024, 11, 31, 23, 59, 59)
      expect(bucketTimestamp(dec, 'month')).toBe('2024-12')
    })

    it('should handle Q4 correctly', () => {
      const oct = Date.UTC(2024, 9, 1)
      expect(bucketTimestamp(oct, 'quarter')).toBe('2024-Q4')
    })

    it('should handle Q2 correctly', () => {
      const may = Date.UTC(2024, 4, 15)
      expect(bucketTimestamp(may, 'quarter')).toBe('2024-Q2')
    })

    it('should handle week at year boundary', () => {
      // Dec 31, 2024 is in ISO week 1 of 2025
      const yearEnd = Date.UTC(2024, 11, 31)
      const result = bucketTimestamp(yearEnd, 'week')
      // Should be 2025-W01 (ISO standard: week containing the first Thursday)
      expect(result).toBe('2025-W01')
    })

    it('should handle leap year Feb 29', () => {
      const leapDay = Date.UTC(2024, 1, 29, 12, 0, 0)
      expect(bucketTimestamp(leapDay, 'day')).toBe('2024-02-29')
      expect(bucketTimestamp(leapDay, 'month')).toBe('2024-02')
    })
  })

  describe('parseBucketRange', () => {
    it('should parse hour range', () => {
      const range = parseBucketRange('2024-03-15T14', 'hour')
      expect(range.start).toBe(Date.UTC(2024, 2, 15, 14, 0, 0))
      expect(range.end).toBe(Date.UTC(2024, 2, 15, 15, 0, 0))
    })

    it('should parse day range', () => {
      const range = parseBucketRange('2024-03-15', 'day')
      expect(range.start).toBe(Date.UTC(2024, 2, 15, 0, 0, 0))
      expect(range.end).toBe(Date.UTC(2024, 2, 16, 0, 0, 0))
    })

    it('should parse week range', () => {
      const range = parseBucketRange('2024-W11', 'week')
      // ISO week 11 of 2024 starts on Monday March 11
      expect(range.start).toBe(Date.UTC(2024, 2, 11, 0, 0, 0))
      expect(range.end - range.start).toBe(7 * 86400_000) // 7 days
    })

    it('should parse month range', () => {
      const range = parseBucketRange('2024-03', 'month')
      expect(range.start).toBe(Date.UTC(2024, 2, 1, 0, 0, 0))
      expect(range.end).toBe(Date.UTC(2024, 3, 1, 0, 0, 0))
    })

    it('should parse quarter range', () => {
      const range = parseBucketRange('2024-Q1', 'quarter')
      expect(range.start).toBe(Date.UTC(2024, 0, 1, 0, 0, 0))
      expect(range.end).toBe(Date.UTC(2024, 3, 1, 0, 0, 0))
    })

    it('should parse year range', () => {
      const range = parseBucketRange('2024', 'year')
      expect(range.start).toBe(Date.UTC(2024, 0, 1, 0, 0, 0))
      expect(range.end).toBe(Date.UTC(2025, 0, 1, 0, 0, 0))
    })

    it('should parse custom interval range', () => {
      const ts = new Date(Date.UTC(2024, 2, 15, 14, 30, 0)).toISOString()
      const range = parseBucketRange(ts, { seconds: 300 })
      expect(range.end - range.start).toBe(300_000)
    })

    it('should handle Feb range correctly for leap year', () => {
      const range = parseBucketRange('2024-02', 'month')
      expect(range.start).toBe(Date.UTC(2024, 1, 1, 0, 0, 0))
      expect(range.end).toBe(Date.UTC(2024, 2, 1, 0, 0, 0))
      // Feb 2024 has 29 days (leap year)
      expect(range.end - range.start).toBe(29 * 86400_000)
    })

    it('should roundtrip: bucket then parse contains original timestamp', () => {
      const ts = Date.UTC(2024, 2, 15, 14, 30, 45)
      for (const gran of ['hour', 'day', 'month', 'quarter', 'year'] as const) {
        const bucket = bucketTimestamp(ts, gran)
        const range = parseBucketRange(bucket, gran)
        expect(ts).toBeGreaterThanOrEqual(range.start)
        expect(ts).toBeLessThan(range.end)
      }
    })
  })
})
