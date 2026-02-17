import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { Brainy } from '../../src/brainy'
import { NounType } from '../../src/types/graphTypes'
import type { AggregateDefinition } from '../../src/types/brainy.types'

describe('Aggregation Engine Integration', () => {
  let brain: Brainy<any>

  beforeEach(async () => {
    brain = new Brainy({ storage: { type: 'memory' }, silent: true })
    await brain.init()
  })

  afterEach(async () => {
    await brain.close()
  })

  // ============= Core: Define + Add + Query =============

  describe('define → add → query lifecycle', () => {
    it('should accumulate metrics as entities are added', async () => {
      brain.defineAggregate({
        name: 'spending',
        source: { type: NounType.Event, where: { domain: 'financial' } },
        groupBy: ['category'],
        metrics: {
          total: { op: 'sum', field: 'amount' },
          count: { op: 'count' },
          average: { op: 'avg', field: 'amount' },
          highest: { op: 'max', field: 'amount' },
          lowest: { op: 'min', field: 'amount' }
        }
      })

      // Add transactions
      await brain.add({
        data: 'Coffee',
        type: NounType.Event,
        metadata: { domain: 'financial', category: 'food', amount: 5 }
      })
      await brain.add({
        data: 'Lunch',
        type: NounType.Event,
        metadata: { domain: 'financial', category: 'food', amount: 15 }
      })
      await brain.add({
        data: 'Uber',
        type: NounType.Event,
        metadata: { domain: 'financial', category: 'transport', amount: 25 }
      })

      // Query all groups
      const results = await brain.find({ aggregate: 'spending' })
      expect(results).toHaveLength(2)

      // Check food group
      const food = results.find(r => r.metadata?.category === 'food')!
      expect(food).toBeDefined()
      expect(food.metadata.total).toBe(20)
      expect(food.metadata.count).toBe(2)
      expect(food.metadata.average).toBe(10)
      expect(food.metadata.highest).toBe(15)
      expect(food.metadata.lowest).toBe(5)

      // Check transport group
      const transport = results.find(r => r.metadata?.category === 'transport')!
      expect(transport).toBeDefined()
      expect(transport.metadata.total).toBe(25)
      expect(transport.metadata.count).toBe(1)
    })

    it('should filter aggregate results with where clause', async () => {
      brain.defineAggregate({
        name: 'by_cat',
        source: { type: NounType.Event },
        groupBy: ['category'],
        metrics: { total: { op: 'sum', field: 'amount' } }
      })

      await brain.add({
        data: 'Coffee', type: NounType.Event,
        metadata: { category: 'food', amount: 5 }
      })
      await brain.add({
        data: 'Uber', type: NounType.Event,
        metadata: { category: 'transport', amount: 25 }
      })

      const results = await brain.find({
        aggregate: 'by_cat',
        where: { category: 'food' }
      })
      expect(results).toHaveLength(1)
      expect(results[0].metadata.category).toBe('food')
    })

    it('should support sorting and pagination on aggregates', async () => {
      brain.defineAggregate({
        name: 'by_cat',
        source: { type: NounType.Event },
        groupBy: ['category'],
        metrics: { total: { op: 'sum', field: 'amount' } }
      })

      const categories = ['food', 'transport', 'housing', 'entertainment']
      for (let i = 0; i < categories.length; i++) {
        await brain.add({
          data: `Expense ${i}`, type: NounType.Event,
          metadata: { category: categories[i], amount: (i + 1) * 100 }
        })
      }

      // Sort descending, limit 2
      const results = await brain.find({
        aggregate: { name: 'by_cat', orderBy: 'total', order: 'desc', limit: 2 }
      })
      expect(results).toHaveLength(2)
      expect(results[0].metadata.total).toBe(400)
      expect(results[1].metadata.total).toBe(300)
    })
  })

  // ============= Incremental Updates =============

  describe('incremental updates', () => {
    it('should update aggregates when entities are modified', async () => {
      brain.defineAggregate({
        name: 'totals',
        source: { type: NounType.Event },
        groupBy: ['category'],
        metrics: {
          total: { op: 'sum', field: 'amount' },
          count: { op: 'count' }
        }
      })

      const id = await brain.add({
        data: 'Coffee', type: NounType.Event,
        metadata: { category: 'food', amount: 5 }
      })

      // Verify initial state
      let results = await brain.find({ aggregate: 'totals' })
      expect(results[0].metadata.total).toBe(5)

      // Update amount
      await brain.update({
        id,
        metadata: { category: 'food', amount: 15 }
      })

      results = await brain.find({ aggregate: 'totals' })
      expect(results[0].metadata.total).toBe(15)
      expect(results[0].metadata.count).toBe(1)
    })

    it('should update aggregates when entities are deleted', async () => {
      brain.defineAggregate({
        name: 'totals',
        source: { type: NounType.Event },
        groupBy: ['category'],
        metrics: {
          total: { op: 'sum', field: 'amount' },
          count: { op: 'count' }
        }
      })

      const id1 = await brain.add({
        data: 'Coffee', type: NounType.Event,
        metadata: { category: 'food', amount: 5 }
      })
      await brain.add({
        data: 'Lunch', type: NounType.Event,
        metadata: { category: 'food', amount: 15 }
      })

      await brain.delete(id1)

      const results = await brain.find({ aggregate: 'totals' })
      expect(results).toHaveLength(1)
      expect(results[0].metadata.total).toBe(15)
      expect(results[0].metadata.count).toBe(1)
    })
  })

  // ============= Time Windows =============

  describe('time-windowed aggregates', () => {
    it('should group by month using time window', async () => {
      brain.defineAggregate({
        name: 'monthly',
        source: { type: NounType.Event },
        groupBy: [
          'category',
          { field: 'date', window: 'month' }
        ],
        metrics: {
          total: { op: 'sum', field: 'amount' },
          count: { op: 'count' }
        }
      })

      const jan = Date.UTC(2024, 0, 15)
      const feb = Date.UTC(2024, 1, 15)

      await brain.add({
        data: 'Coffee Jan', type: NounType.Event,
        metadata: { category: 'food', date: jan, amount: 100 }
      })
      await brain.add({
        data: 'Coffee Feb', type: NounType.Event,
        metadata: { category: 'food', date: feb, amount: 200 }
      })
      await brain.add({
        data: 'Lunch Jan', type: NounType.Event,
        metadata: { category: 'food', date: jan, amount: 50 }
      })

      const results = await brain.find({ aggregate: 'monthly' })
      expect(results).toHaveLength(2)

      const janGroup = results.find(r => r.metadata.date === '2024-01')!
      const febGroup = results.find(r => r.metadata.date === '2024-02')!
      expect(janGroup.metadata.total).toBe(150)
      expect(janGroup.metadata.count).toBe(2)
      expect(febGroup.metadata.total).toBe(200)
      expect(febGroup.metadata.count).toBe(1)
    })
  })

  // ============= Non-matching entities =============

  describe('source filtering', () => {
    it('should only aggregate entities matching the source filter', async () => {
      brain.defineAggregate({
        name: 'financial_only',
        source: { type: NounType.Event, where: { domain: 'financial' } },
        groupBy: ['category'],
        metrics: { count: { op: 'count' } }
      })

      // Matching entity
      await brain.add({
        data: 'Purchase', type: NounType.Event,
        metadata: { domain: 'financial', category: 'food' }
      })

      // Non-matching: wrong type
      await brain.add({
        data: 'Person', type: NounType.Person,
        metadata: { domain: 'financial', category: 'food' }
      })

      // Non-matching: wrong domain
      await brain.add({
        data: 'Game event', type: NounType.Event,
        metadata: { domain: 'gaming', category: 'food' }
      })

      const results = await brain.find({ aggregate: 'financial_only' })
      expect(results).toHaveLength(1)
      expect(results[0].metadata.count).toBe(1)
    })
  })

  // ============= Multiple Aggregates =============

  describe('multiple overlapping aggregates', () => {
    it('should maintain independent aggregates on the same entities', async () => {
      brain.defineAggregate({
        name: 'by_category',
        source: { type: NounType.Event },
        groupBy: ['category'],
        metrics: { total: { op: 'sum', field: 'amount' } }
      })

      brain.defineAggregate({
        name: 'by_merchant',
        source: { type: NounType.Event },
        groupBy: ['merchant'],
        metrics: { total: { op: 'sum', field: 'amount' } }
      })

      await brain.add({
        data: 'Coffee', type: NounType.Event,
        metadata: { category: 'food', merchant: 'Starbucks', amount: 5 }
      })
      await brain.add({
        data: 'Tea', type: NounType.Event,
        metadata: { category: 'food', merchant: 'Teavana', amount: 4 }
      })

      const catResults = await brain.find({ aggregate: 'by_category' })
      const merchResults = await brain.find({ aggregate: 'by_merchant' })

      expect(catResults).toHaveLength(1)
      expect(catResults[0].metadata.total).toBe(9)

      expect(merchResults).toHaveLength(2)
      const starbucks = merchResults.find(r => r.metadata.merchant === 'Starbucks')!
      const teavana = merchResults.find(r => r.metadata.merchant === 'Teavana')!
      expect(starbucks.metadata.total).toBe(5)
      expect(teavana.metadata.total).toBe(4)
    })
  })

  // ============= Error Handling =============

  describe('error handling', () => {
    it('should throw when querying an undefined aggregate', async () => {
      await expect(brain.find({ aggregate: 'nonexistent' }))
        .rejects.toThrow()
    })

    it('should throw when defining aggregate without groupBy', () => {
      expect(() => brain.defineAggregate({
        name: 'bad',
        source: { type: NounType.Event },
        groupBy: [],
        metrics: { count: { op: 'count' } }
      })).toThrow()
    })
  })

  // ============= removeAggregate =============

  describe('removeAggregate', () => {
    it('should remove aggregate and reject subsequent queries', async () => {
      brain.defineAggregate({
        name: 'temp',
        source: { type: NounType.Event },
        groupBy: ['category'],
        metrics: { count: { op: 'count' } }
      })

      await brain.add({
        data: 'Test', type: NounType.Event,
        metadata: { category: 'food' }
      })

      // Aggregate exists
      const results = await brain.find({ aggregate: 'temp' })
      expect(results).toHaveLength(1)

      // Remove it
      brain.removeAggregate('temp')

      // Should throw on query
      await expect(brain.find({ aggregate: 'temp' })).rejects.toThrow()
    })
  })

  // ============= Result format =============

  describe('result format', () => {
    it('should return Result<T>[] with Measurement type', async () => {
      brain.defineAggregate({
        name: 'test',
        source: { type: NounType.Event },
        groupBy: ['category'],
        metrics: { count: { op: 'count' } }
      })

      await brain.add({
        data: 'Test', type: NounType.Event,
        metadata: { category: 'food' }
      })

      const results = await brain.find({ aggregate: 'test' })
      expect(results).toHaveLength(1)

      const result = results[0]
      expect(result.id).toBeDefined()
      expect(result.score).toBe(1.0)
      expect(result.type).toBe(NounType.Measurement)
      expect(result.entity).toBeDefined()
      expect(result.entity.type).toBe(NounType.Measurement)
      expect(result.entity.service).toBe('brainy:aggregation')
      expect(result.metadata.__aggregate).toBe('test')
    })
  })

  // ============= Scale test =============

  describe('scale', () => {
    it('should handle 100 entities with 3 aggregates', async () => {
      // Note: Full scale testing (10K+ entities) is in unit tests which skip
      // embedding overhead. This integration test verifies end-to-end wiring
      // with real Brainy operations including embeddings.
      brain.defineAggregate({
        name: 'by_category', source: { type: NounType.Event },
        groupBy: ['category'],
        metrics: { total: { op: 'sum', field: 'amount' }, count: { op: 'count' } }
      })
      brain.defineAggregate({
        name: 'by_merchant', source: { type: NounType.Event },
        groupBy: ['merchant'],
        metrics: { total: { op: 'sum', field: 'amount' } }
      })
      brain.defineAggregate({
        name: 'monthly', source: { type: NounType.Event },
        groupBy: [{ field: 'date', window: 'month' }],
        metrics: { total: { op: 'sum', field: 'amount' }, count: { op: 'count' } }
      })

      const categories = ['food', 'transport', 'housing', 'entertainment', 'utilities']
      const merchants = ['Starbucks', 'Uber', 'Amazon', 'Netflix', 'Con Edison']
      const baseDate = Date.UTC(2024, 0, 1)

      for (let i = 0; i < 100; i++) {
        await brain.add({
          data: `Transaction ${i}`,
          type: NounType.Event,
          metadata: {
            category: categories[i % 5],
            merchant: merchants[i % 5],
            amount: Math.round(Math.random() * 10000) / 100,
            date: baseDate + (i % 90) * 86400_000
          }
        })
      }

      // Verify category aggregate
      const catResults = await brain.find({ aggregate: 'by_category' })
      expect(catResults).toHaveLength(5)
      const totalCount = catResults.reduce((sum, r) => sum + (r.metadata.count as number), 0)
      expect(totalCount).toBe(100)

      // Verify merchant aggregate
      const merchResults = await brain.find({ aggregate: 'by_merchant' })
      expect(merchResults).toHaveLength(5)

      // Verify monthly aggregate
      const monthlyResults = await brain.find({ aggregate: 'monthly' })
      expect(monthlyResults.length).toBeGreaterThan(0)
      const monthlyTotalCount = monthlyResults.reduce(
        (sum, r) => sum + (r.metadata.count as number), 0
      )
      expect(monthlyTotalCount).toBe(100)
    }, 60_000)
  })
})
