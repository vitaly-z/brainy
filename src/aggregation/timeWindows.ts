/**
 * Time Window Utilities for Aggregation Engine
 *
 * Pure utility functions for bucketing timestamps into time windows.
 * No dependencies on other Brainy modules.
 */

import type { TimeWindowGranularity } from '../types/brainy.types.js'

/**
 * Bucket a timestamp into a time window key string.
 *
 * @param timestamp - Unix timestamp in milliseconds
 * @param granularity - Time window granularity
 * @returns Bucket key string (e.g., '2024-01', '2024-Q1', '2024-W03')
 */
export function bucketTimestamp(timestamp: number, granularity: TimeWindowGranularity): string {
  const date = new Date(timestamp)

  if (typeof granularity === 'object' && 'seconds' in granularity) {
    // Custom interval: floor to nearest interval
    const intervalMs = granularity.seconds * 1000
    const floored = Math.floor(timestamp / intervalMs) * intervalMs
    return new Date(floored).toISOString()
  }

  switch (granularity) {
    case 'hour': {
      const y = date.getUTCFullYear()
      const m = padTwo(date.getUTCMonth() + 1)
      const d = padTwo(date.getUTCDate())
      const h = padTwo(date.getUTCHours())
      return `${y}-${m}-${d}T${h}`
    }
    case 'day': {
      const y = date.getUTCFullYear()
      const m = padTwo(date.getUTCMonth() + 1)
      const d = padTwo(date.getUTCDate())
      return `${y}-${m}-${d}`
    }
    case 'week': {
      const { year, week } = getISOWeek(date)
      return `${year}-W${padTwo(week)}`
    }
    case 'month': {
      const y = date.getUTCFullYear()
      const m = padTwo(date.getUTCMonth() + 1)
      return `${y}-${m}`
    }
    case 'quarter': {
      const y = date.getUTCFullYear()
      const q = Math.ceil((date.getUTCMonth() + 1) / 3)
      return `${y}-Q${q}`
    }
    case 'year': {
      return `${date.getUTCFullYear()}`
    }
    default:
      throw new Error(`Unknown time window granularity: ${granularity}`)
  }
}

/**
 * Parse a bucket key back into a start/end timestamp range.
 *
 * @param bucketKey - Bucket key string from bucketTimestamp()
 * @param granularity - The granularity used to create the bucket
 * @returns Start and end timestamps (ms) for the bucket, end is exclusive
 */
export function parseBucketRange(
  bucketKey: string,
  granularity: TimeWindowGranularity
): { start: number; end: number } {
  if (typeof granularity === 'object' && 'seconds' in granularity) {
    const start = new Date(bucketKey).getTime()
    return { start, end: start + granularity.seconds * 1000 }
  }

  switch (granularity) {
    case 'hour': {
      // Format: 2024-01-15T14
      const start = new Date(`${bucketKey}:00:00Z`).getTime()
      return { start, end: start + 3600_000 }
    }
    case 'day': {
      // Format: 2024-01-15
      const start = new Date(`${bucketKey}T00:00:00Z`).getTime()
      return { start, end: start + 86400_000 }
    }
    case 'week': {
      // Format: 2024-W03
      const match = bucketKey.match(/^(\d{4})-W(\d{2})$/)
      if (!match) throw new Error(`Invalid week bucket key: ${bucketKey}`)
      const year = parseInt(match[1], 10)
      const week = parseInt(match[2], 10)
      const start = isoWeekToDate(year, week).getTime()
      return { start, end: start + 7 * 86400_000 }
    }
    case 'month': {
      // Format: 2024-01
      const start = new Date(`${bucketKey}-01T00:00:00Z`).getTime()
      const d = new Date(start)
      d.setUTCMonth(d.getUTCMonth() + 1)
      return { start, end: d.getTime() }
    }
    case 'quarter': {
      // Format: 2024-Q1
      const match = bucketKey.match(/^(\d{4})-Q([1-4])$/)
      if (!match) throw new Error(`Invalid quarter bucket key: ${bucketKey}`)
      const year = parseInt(match[1], 10)
      const quarter = parseInt(match[2], 10)
      const startMonth = (quarter - 1) * 3
      const start = new Date(Date.UTC(year, startMonth, 1)).getTime()
      const end = new Date(Date.UTC(year, startMonth + 3, 1)).getTime()
      return { start, end }
    }
    case 'year': {
      // Format: 2024
      const year = parseInt(bucketKey, 10)
      const start = new Date(Date.UTC(year, 0, 1)).getTime()
      const end = new Date(Date.UTC(year + 1, 0, 1)).getTime()
      return { start, end }
    }
    default:
      throw new Error(`Unknown time window granularity: ${granularity}`)
  }
}

// ============= Internal Helpers =============

function padTwo(n: number): string {
  return n < 10 ? `0${n}` : `${n}`
}

/**
 * Calculate ISO 8601 week number and year for a UTC date.
 * ISO weeks start on Monday. Week 1 contains the first Thursday of the year.
 */
function getISOWeek(date: Date): { year: number; week: number } {
  // Work in UTC to avoid timezone issues
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))

  // Set to nearest Thursday: current date + 4 - current day number (Mon=1, Sun=7)
  const dayNum = d.getUTCDay() || 7 // Convert Sun=0 to Sun=7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)

  // Year of the Thursday
  const year = d.getUTCFullYear()

  // January 1 of that year
  const jan1 = new Date(Date.UTC(year, 0, 1))

  // Calculate week number
  const week = Math.ceil(((d.getTime() - jan1.getTime()) / 86400_000 + 1) / 7)

  return { year, week }
}

/**
 * Convert ISO year + week number back to the Monday UTC date of that week.
 */
function isoWeekToDate(year: number, week: number): Date {
  // January 4 is always in week 1 of its ISO year
  const jan4 = new Date(Date.UTC(year, 0, 4))
  const dayOfWeek = jan4.getUTCDay() || 7 // Mon=1, Sun=7

  // Monday of ISO week 1
  const week1Monday = new Date(jan4.getTime())
  week1Monday.setUTCDate(jan4.getUTCDate() - dayOfWeek + 1)

  // Add (week - 1) * 7 days
  const target = new Date(week1Monday.getTime())
  target.setUTCDate(target.getUTCDate() + (week - 1) * 7)

  return target
}
