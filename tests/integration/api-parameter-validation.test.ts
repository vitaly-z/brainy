/**
 * Test to verify correct API parameter usage
 * Reproduces Brain Cloud issue where 'filter' was used instead of 'where'
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { Brainy } from '../../src/index.js'
import { NounType } from '../../src/types/graphTypes.js'

describe('API Parameter Validation', () => {
  let brain: Brainy

  beforeAll(async () => {
    brain = new Brainy({
      storage: { type: 'memory' }
    })
    await brain.init()

    // Add test data
    await brain.add({
      data: 'Alice',
      type: NounType.Person,
      metadata: { category: 'test-category', status: 'active' }
    })
    await brain.add({
      data: 'Bob',
      type: NounType.Person,
      metadata: { category: 'other-category', status: 'active' }
    })
    await brain.add({
      data: 'Charlie',
      type: NounType.Person,
      metadata: { category: 'test-category', status: 'inactive' }
    })
  })

  it('should use "where" parameter for metadata filtering', async () => {
    const results = await brain.find({
      where: { category: 'test-category' },
      limit: 10
    })

    expect(results).toHaveLength(2)
    expect(results.map(r => r.entity.data).sort()).toEqual(['Alice', 'Charlie'])
  })

  it('should IGNORE unknown "filter" parameter (reproduces Brain Cloud bug)', async () => {
    // This is what Brain Cloud was doing - using 'filter' instead of 'where'
    const results = await brain.find({
      filter: { category: 'test-category' } as any,  // Wrong parameter!
      limit: 10
    })

    // Should return ALL results because filter is ignored
    expect(results.length).toBeGreaterThanOrEqual(2)
  })

  it('should demonstrate the difference between correct and incorrect API usage', async () => {
    // CORRECT: Using 'where'
    const correctResults = await brain.find({
      where: { category: 'test-category' },
      limit: 10
    })

    // INCORRECT: Using 'filter' (what Brain Cloud did)
    const incorrectResults = await brain.find({
      filter: { category: 'test-category' } as any,
      limit: 10
    })

    // Correct usage filters results
    expect(correctResults).toHaveLength(2)

    // Incorrect usage returns more results (filter ignored)
    expect(incorrectResults.length).toBeGreaterThan(correctResults.length)
  })
})
