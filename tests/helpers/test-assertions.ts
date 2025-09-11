/**
 * Test Assertions - Custom assertion helpers for Brainy tests
 * Provides additional assertion utilities beyond what Vitest offers
 */

import { expect } from 'vitest'
import type { Entity, Relation, Result } from '../../src/types/brainy.types'
import type { Vector } from '../../src/coreTypes'

/**
 * Deep equality assertion for entities
 */
export function assertEntitiesEqual(actual: Entity, expected: Entity, message?: string) {
  const prefix = message ? `${message}: ` : ''
  
  expect(actual.id, `${prefix}Entity IDs should match`).toBe(expected.id)
  expect(actual.type, `${prefix}Entity types should match`).toBe(expected.type)
  expect(actual.createdAt, `${prefix}Entity createdAt should match`).toBe(expected.createdAt)
  
  if (expected.metadata) {
    expect(actual.metadata, `${prefix}Entity metadata should match`).toEqual(expected.metadata)
  }
  
  if (expected.vector) {
    assertVectorsEqual(actual.vector, expected.vector, `${prefix}Entity vectors`)
  }
}

/**
 * Deep equality assertion for relations
 */
export function assertRelationsEqual(actual: Relation, expected: Relation, message?: string) {
  const prefix = message ? `${message}: ` : ''
  
  expect(actual.id, `${prefix}Relation IDs should match`).toBe(expected.id)
  expect(actual.from, `${prefix}Relation from should match`).toBe(expected.from)
  expect(actual.to, `${prefix}Relation to should match`).toBe(expected.to)
  expect(actual.type, `${prefix}Relation types should match`).toBe(expected.type)
  
  if (expected.weight !== undefined) {
    expect(actual.weight, `${prefix}Relation weights should match`).toBe(expected.weight)
  }
  
  if (expected.metadata) {
    expect(actual.metadata, `${prefix}Relation metadata should match`).toEqual(expected.metadata)
  }
}

/**
 * Vector equality assertion with tolerance
 */
export function assertVectorsEqual(actual: Vector, expected: Vector, message?: string, tolerance = 1e-6) {
  const prefix = message ? `${message}: ` : ''
  
  expect(actual.length, `${prefix}Vector lengths should match`).toBe(expected.length)
  
  for (let i = 0; i < actual.length; i++) {
    const diff = Math.abs(actual[i] - expected[i])
    if (diff > tolerance) {
      throw new Error(
        `${prefix}Vector values differ at index ${i}: actual=${actual[i]}, expected=${expected[i]}, diff=${diff}`
      )
    }
  }
}

/**
 * Assert that a value is within a range
 */
export function assertInRange(value: number, min: number, max: number, message?: string) {
  const prefix = message ? `${message}: ` : ''
  
  if (value < min || value > max) {
    throw new Error(
      `${prefix}Value ${value} is not in range [${min}, ${max}]`
    )
  }
}

/**
 * Assert that a score is valid (between 0 and 1)
 */
export function assertValidScore(score: number, message?: string) {
  assertInRange(score, 0, 1, message || 'Score should be between 0 and 1')
}

/**
 * Assert that results are sorted by score (descending)
 */
export function assertResultsSortedByScore(results: Result[], message?: string) {
  const prefix = message ? `${message}: ` : ''
  
  for (let i = 1; i < results.length; i++) {
    if (results[i].score > results[i - 1].score) {
      throw new Error(
        `${prefix}Results not sorted by score at index ${i}: ${results[i].score} > ${results[i - 1].score}`
      )
    }
  }
}

/**
 * Assert that an array contains unique items
 */
export function assertUniqueItems<T>(
  items: T[],
  keyFn: (item: T) => string = (item) => JSON.stringify(item),
  message?: string
) {
  const prefix = message ? `${message}: ` : ''
  const seen = new Set<string>()
  
  for (const item of items) {
    const key = keyFn(item)
    if (seen.has(key)) {
      throw new Error(`${prefix}Duplicate item found: ${key}`)
    }
    seen.add(key)
  }
}

/**
 * Assert that an array has expected length
 */
export function assertArrayLength<T>(array: T[], expectedLength: number, message?: string) {
  const prefix = message ? `${message}: ` : ''
  expect(array.length, `${prefix}Array length mismatch`).toBe(expectedLength)
}

/**
 * Assert that a promise rejects with specific error
 */
export async function assertRejectsWithError(
  promise: Promise<any>,
  errorMessagePattern: string | RegExp,
  message?: string
) {
  const prefix = message ? `${message}: ` : ''
  
  try {
    await promise
    throw new Error(`${prefix}Expected promise to reject but it resolved`)
  } catch (error: any) {
    if (typeof errorMessagePattern === 'string') {
      expect(error.message, `${prefix}Error message mismatch`).toContain(errorMessagePattern)
    } else {
      expect(error.message, `${prefix}Error message doesn't match pattern`).toMatch(errorMessagePattern)
    }
  }
}

/**
 * Assert that an operation completes within a time limit
 */
export async function assertCompletesWithin<T>(
  operation: () => Promise<T>,
  maxMs: number,
  message?: string
): Promise<T> {
  const prefix = message ? `${message}: ` : ''
  const start = performance.now()
  const result = await operation()
  const duration = performance.now() - start
  
  if (duration > maxMs) {
    throw new Error(
      `${prefix}Operation took ${duration.toFixed(2)}ms, exceeding limit of ${maxMs}ms`
    )
  }
  
  return result
}

/**
 * Assert that metadata contains expected fields
 */
export function assertMetadataContains(
  actual: any,
  expected: Record<string, any>,
  message?: string
) {
  const prefix = message ? `${message}: ` : ''
  
  for (const [key, value] of Object.entries(expected)) {
    expect(actual, `${prefix}Metadata should exist`).toBeDefined()
    expect(actual[key], `${prefix}Metadata should contain key '${key}'`).toEqual(value)
  }
}

/**
 * Assert that two dates are close (within tolerance)
 */
export function assertDatesClose(
  actual: Date | number | string,
  expected: Date | number | string,
  toleranceMs = 1000,
  message?: string
) {
  const prefix = message ? `${message}: ` : ''
  const actualMs = new Date(actual).getTime()
  const expectedMs = new Date(expected).getTime()
  const diff = Math.abs(actualMs - expectedMs)
  
  if (diff > toleranceMs) {
    throw new Error(
      `${prefix}Dates differ by ${diff}ms, exceeding tolerance of ${toleranceMs}ms`
    )
  }
}

/**
 * Assert that a value matches one of the expected values
 */
export function assertOneOf<T>(actual: T, expected: T[], message?: string) {
  const prefix = message ? `${message}: ` : ''
  
  if (!expected.includes(actual)) {
    throw new Error(
      `${prefix}Value ${JSON.stringify(actual)} not in expected values: ${JSON.stringify(expected)}`
    )
  }
}

/**
 * Assert performance metrics
 */
export function assertPerformance(
  metrics: {
    operations: number
    duration: number
  },
  minOpsPerSecond: number,
  message?: string
) {
  const prefix = message ? `${message}: ` : ''
  const opsPerSecond = (metrics.operations / metrics.duration) * 1000
  
  if (opsPerSecond < minOpsPerSecond) {
    throw new Error(
      `${prefix}Performance too low: ${opsPerSecond.toFixed(2)} ops/s < ${minOpsPerSecond} ops/s`
    )
  }
}

// Export as namespace for convenience
export const TestAssertions = {
  assertEntitiesEqual,
  assertRelationsEqual,
  assertVectorsEqual,
  assertInRange,
  assertValidScore,
  assertResultsSortedByScore,
  assertUniqueItems,
  assertArrayLength,
  assertRejectsWithError,
  assertCompletesWithin,
  assertMetadataContains,
  assertDatesClose,
  assertOneOf,
  assertPerformance,
}

export default TestAssertions