import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { AggregationIndex } from '../../../src/aggregation/AggregationIndex'
import { MemoryStorage } from '../../../src/storage/storageFactory'
import { NounType } from '../../../src/types/graphTypes'
import type { AggregateDefinition, AggregateGroupState } from '../../../src/types/brainy.types'

describe('AggregationIndex', () => {
  let storage: MemoryStorage
  let index: AggregationIndex

  beforeEach(async () => {
    storage = new MemoryStorage()
    await storage.init()
    index = new AggregationIndex(storage)
    await index.init()
  })

  afterEach(async () => {
    await index.close()
  })

  // ============= Definition Management =============

  describe('defineAggregate', () => {
    it('should register a valid aggregate definition', () => {
      const def: AggregateDefinition = {
        name: 'test_agg',
        source: { type: NounType.Event },
        groupBy: ['category'],
        metrics: { count: { op: 'count' } }
      }

      index.defineAggregate(def)

      expect(index.hasAggregate('test_agg')).toBe(true)
      expect(index.getDefinitions()).toHaveLength(1)
      expect(index.getDefinitions()[0].name).toBe('test_agg')
    })

    it('should reject definition without name', () => {
      expect(() => index.defineAggregate({
        name: '',
        source: { type: NounType.Event },
        groupBy: ['x'],
        metrics: { count: { op: 'count' } }
      })).toThrow('requires a name')
    })

    it('should reject definition without groupBy', () => {
      expect(() => index.defineAggregate({
        name: 'bad',
        source: { type: NounType.Event },
        groupBy: [],
        metrics: { count: { op: 'count' } }
      })).toThrow('at least one groupBy')
    })

    it('should reject definition without metrics', () => {
      expect(() => index.defineAggregate({
        name: 'bad',
        source: { type: NounType.Event },
        groupBy: ['x'],
        metrics: {}
      })).toThrow('at least one metric')
    })

    it('should reject sum metric without field', () => {
      expect(() => index.defineAggregate({
        name: 'bad',
        source: { type: NounType.Event },
        groupBy: ['x'],
        metrics: { total: { op: 'sum' } }
      })).toThrow("requires a 'field'")
    })

    it('should allow count metric without field', () => {
      index.defineAggregate({
        name: 'ok',
        source: { type: NounType.Event },
        groupBy: ['x'],
        metrics: { count: { op: 'count' } }
      })
      expect(index.hasAggregate('ok')).toBe(true)
    })
  })

  describe('removeAggregate', () => {
    it('should remove an existing aggregate', () => {
      index.defineAggregate({
        name: 'temp',
        source: { type: NounType.Event },
        groupBy: ['x'],
        metrics: { count: { op: 'count' } }
      })

      expect(index.hasAggregate('temp')).toBe(true)
      index.removeAggregate('temp')
      expect(index.hasAggregate('temp')).toBe(false)
    })
  })

  // ============= Write-Time Hooks =============

  describe('onEntityAdded', () => {
    const spendingDef: AggregateDefinition = {
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
    }

    beforeEach(() => {
      index.defineAggregate(spendingDef)
    })

    it('should accumulate sum/count/avg/min/max for matching entities', () => {
      index.onEntityAdded('e1', {
        type: NounType.Event,
        metadata: { domain: 'financial', category: 'food', amount: 10 }
      })
      index.onEntityAdded('e2', {
        type: NounType.Event,
        metadata: { domain: 'financial', category: 'food', amount: 20 }
      })
      index.onEntityAdded('e3', {
        type: NounType.Event,
        metadata: { domain: 'financial', category: 'food', amount: 30 }
      })

      const results = index.queryAggregate({ name: 'spending' })
      expect(results).toHaveLength(1)
      expect(results[0].groupKey).toEqual({ category: 'food' })
      expect(results[0].metrics.total).toBe(60)
      expect(results[0].metrics.count).toBe(3)
      expect(results[0].metrics.average).toBe(20)
      expect(results[0].metrics.highest).toBe(30)
      expect(results[0].metrics.lowest).toBe(10)
      expect(results[0].count).toBe(3)
    })

    it('should create separate groups for different keys', () => {
      index.onEntityAdded('e1', {
        type: NounType.Event,
        metadata: { domain: 'financial', category: 'food', amount: 10 }
      })
      index.onEntityAdded('e2', {
        type: NounType.Event,
        metadata: { domain: 'financial', category: 'transport', amount: 50 }
      })

      const results = index.queryAggregate({ name: 'spending' })
      expect(results).toHaveLength(2)

      const food = results.find(r => r.groupKey.category === 'food')!
      const transport = results.find(r => r.groupKey.category === 'transport')!
      expect(food.metrics.total).toBe(10)
      expect(transport.metrics.total).toBe(50)
    })

    it('should skip entities that do not match source filter', () => {
      // Wrong type
      index.onEntityAdded('e1', {
        type: NounType.Person,
        metadata: { domain: 'financial', category: 'food', amount: 100 }
      })

      // Missing domain
      index.onEntityAdded('e2', {
        type: NounType.Event,
        metadata: { category: 'food', amount: 100 }
      })

      const results = index.queryAggregate({ name: 'spending' })
      expect(results).toHaveLength(0)
    })

    it('should skip materialized aggregate entities (infinite loop prevention)', () => {
      index.onEntityAdded('agg1', {
        type: NounType.Measurement,
        service: 'brainy:aggregation',
        metadata: { domain: 'financial', category: 'food', amount: 999 }
      })

      const results = index.queryAggregate({ name: 'spending' })
      expect(results).toHaveLength(0)
    })

    it('should skip entities with __aggregate metadata (infinite loop prevention)', () => {
      index.onEntityAdded('agg2', {
        type: NounType.Event,
        metadata: { __aggregate: 'spending', domain: 'financial', category: 'food', amount: 999 }
      })

      const results = index.queryAggregate({ name: 'spending' })
      expect(results).toHaveLength(0)
    })
  })

  describe('onEntityUpdated', () => {
    beforeEach(() => {
      index.defineAggregate({
        name: 'totals',
        source: { type: NounType.Event },
        groupBy: ['category'],
        metrics: {
          total: { op: 'sum', field: 'amount' },
          count: { op: 'count' }
        }
      })
    })

    it('should reverse old contribution and apply new', () => {
      const oldEntity = { type: NounType.Event, metadata: { category: 'food', amount: 10 } }
      const newEntity = { type: NounType.Event, metadata: { category: 'food', amount: 25 } }

      index.onEntityAdded('e1', oldEntity)
      expect(index.queryAggregate({ name: 'totals' })[0].metrics.total).toBe(10)

      index.onEntityUpdated('e1', newEntity, oldEntity)
      const results = index.queryAggregate({ name: 'totals' })
      expect(results[0].metrics.total).toBe(25)
      expect(results[0].metrics.count).toBe(1)
    })

    it('should handle category change (different group keys)', () => {
      const old = { type: NounType.Event, metadata: { category: 'food', amount: 10 } }
      const updated = { type: NounType.Event, metadata: { category: 'transport', amount: 10 } }

      index.onEntityAdded('e1', old)
      index.onEntityUpdated('e1', updated, old)

      const results = index.queryAggregate({ name: 'totals' })
      // Old group should be removed (empty), new group should exist
      expect(results).toHaveLength(1)
      expect(results[0].groupKey.category).toBe('transport')
      expect(results[0].metrics.total).toBe(10)
    })

    it('should handle entity no longer matching source', () => {
      const old = { type: NounType.Event, metadata: { category: 'food', amount: 10 } }
      const updated = { type: NounType.Person, metadata: { category: 'food', amount: 10 } }

      index.onEntityAdded('e1', old)
      expect(index.queryAggregate({ name: 'totals' })).toHaveLength(1)

      index.onEntityUpdated('e1', updated, old)
      expect(index.queryAggregate({ name: 'totals' })).toHaveLength(0)
    })

    it('should handle entity now matching source', () => {
      const old = { type: NounType.Person, metadata: { category: 'food', amount: 10 } }
      const updated = { type: NounType.Event, metadata: { category: 'food', amount: 10 } }

      index.onEntityAdded('e1', old) // Won't match
      expect(index.queryAggregate({ name: 'totals' })).toHaveLength(0)

      index.onEntityUpdated('e1', updated, old)
      expect(index.queryAggregate({ name: 'totals' })).toHaveLength(1)
      expect(index.queryAggregate({ name: 'totals' })[0].metrics.total).toBe(10)
    })
  })

  describe('onEntityDeleted', () => {
    beforeEach(() => {
      index.defineAggregate({
        name: 'totals',
        source: { type: NounType.Event },
        groupBy: ['category'],
        metrics: {
          total: { op: 'sum', field: 'amount' },
          count: { op: 'count' }
        }
      })
    })

    it('should decrement sum and count', () => {
      const entity = { type: NounType.Event, metadata: { category: 'food', amount: 10 } }
      index.onEntityAdded('e1', entity)
      index.onEntityAdded('e2', { type: NounType.Event, metadata: { category: 'food', amount: 20 } })

      index.onEntityDeleted('e1', entity)

      const results = index.queryAggregate({ name: 'totals' })
      expect(results).toHaveLength(1)
      expect(results[0].metrics.total).toBe(20)
      expect(results[0].metrics.count).toBe(1)
    })

    it('should remove group when last entity is deleted', () => {
      const entity = { type: NounType.Event, metadata: { category: 'food', amount: 10 } }
      index.onEntityAdded('e1', entity)
      index.onEntityDeleted('e1', entity)

      const results = index.queryAggregate({ name: 'totals' })
      expect(results).toHaveLength(0)
    })
  })

  // ============= Time Windows =============

  describe('time-windowed groupBy', () => {
    beforeEach(() => {
      index.defineAggregate({
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
    })

    it('should group by both category and time window', () => {
      const jan = Date.UTC(2024, 0, 15)
      const feb = Date.UTC(2024, 1, 15)

      index.onEntityAdded('e1', {
        type: NounType.Event,
        metadata: { category: 'food', date: jan, amount: 100 }
      })
      index.onEntityAdded('e2', {
        type: NounType.Event,
        metadata: { category: 'food', date: feb, amount: 200 }
      })
      index.onEntityAdded('e3', {
        type: NounType.Event,
        metadata: { category: 'food', date: jan, amount: 50 }
      })

      const results = index.queryAggregate({ name: 'monthly' })
      expect(results).toHaveLength(2)

      const janGroup = results.find(r => r.groupKey.date === '2024-01')!
      const febGroup = results.find(r => r.groupKey.date === '2024-02')!
      expect(janGroup.metrics.total).toBe(150)
      expect(janGroup.metrics.count).toBe(2)
      expect(febGroup.metrics.total).toBe(200)
      expect(febGroup.metrics.count).toBe(1)
    })
  })

  // ============= Query =============

  describe('queryAggregate', () => {
    beforeEach(() => {
      index.defineAggregate({
        name: 'spending',
        source: { type: NounType.Event },
        groupBy: ['category'],
        metrics: {
          total: { op: 'sum', field: 'amount' },
          count: { op: 'count' }
        }
      })

      // Add several categories
      for (let i = 0; i < 5; i++) {
        index.onEntityAdded(`food-${i}`, {
          type: NounType.Event,
          metadata: { category: 'food', amount: 10 * (i + 1) }
        })
      }
      for (let i = 0; i < 3; i++) {
        index.onEntityAdded(`transport-${i}`, {
          type: NounType.Event,
          metadata: { category: 'transport', amount: 20 * (i + 1) }
        })
      }
      index.onEntityAdded('housing-1', {
        type: NounType.Event,
        metadata: { category: 'housing', amount: 1500 }
      })
    })

    it('should throw for unknown aggregate', () => {
      expect(() => index.queryAggregate({ name: 'nonexistent' })).toThrow("not found")
    })

    it('should return all groups by default', () => {
      const results = index.queryAggregate({ name: 'spending' })
      expect(results).toHaveLength(3)
    })

    it('should filter by where clause', () => {
      const results = index.queryAggregate({
        name: 'spending',
        where: { category: 'food' }
      })
      expect(results).toHaveLength(1)
      expect(results[0].groupKey.category).toBe('food')
      expect(results[0].metrics.total).toBe(150) // 10+20+30+40+50
    })

    it('should sort by metric ascending', () => {
      const results = index.queryAggregate({
        name: 'spending',
        orderBy: 'total',
        order: 'asc'
      })
      expect(results[0].metrics.total).toBeLessThanOrEqual(results[1].metrics.total)
    })

    it('should sort by metric descending', () => {
      const results = index.queryAggregate({
        name: 'spending',
        orderBy: 'total',
        order: 'desc'
      })
      expect(results[0].metrics.total).toBe(1500) // housing
    })

    it('should support limit', () => {
      const results = index.queryAggregate({
        name: 'spending',
        orderBy: 'total',
        order: 'desc',
        limit: 2
      })
      expect(results).toHaveLength(2)
    })

    it('should support offset', () => {
      const all = index.queryAggregate({
        name: 'spending',
        orderBy: 'total',
        order: 'desc'
      })
      const page2 = index.queryAggregate({
        name: 'spending',
        orderBy: 'total',
        order: 'desc',
        offset: 1,
        limit: 1
      })
      expect(page2).toHaveLength(1)
      expect(page2[0].groupKey.category).toBe(all[1].groupKey.category)
    })
  })

  // ============= Multiple Overlapping Aggregates =============

  describe('multiple aggregates', () => {
    it('should update multiple aggregates on a single entity add', () => {
      index.defineAggregate({
        name: 'by_category',
        source: { type: NounType.Event },
        groupBy: ['category'],
        metrics: { count: { op: 'count' } }
      })
      index.defineAggregate({
        name: 'by_merchant',
        source: { type: NounType.Event },
        groupBy: ['merchant'],
        metrics: { total: { op: 'sum', field: 'amount' } }
      })

      index.onEntityAdded('e1', {
        type: NounType.Event,
        metadata: { category: 'food', merchant: 'Starbucks', amount: 5 }
      })

      const catResults = index.queryAggregate({ name: 'by_category' })
      const merchResults = index.queryAggregate({ name: 'by_merchant' })

      expect(catResults).toHaveLength(1)
      expect(catResults[0].metrics.count).toBe(1)
      expect(merchResults).toHaveLength(1)
      expect(merchResults[0].metrics.total).toBe(5)
    })
  })

  // ============= Persistence =============

  describe('persistence', () => {
    it('should persist definitions and state across flush/init cycles', async () => {
      index.defineAggregate({
        name: 'persist_test',
        source: { type: NounType.Event },
        groupBy: ['category'],
        metrics: { total: { op: 'sum', field: 'amount' } }
      })

      index.onEntityAdded('e1', {
        type: NounType.Event,
        metadata: { category: 'food', amount: 42 }
      })

      // Flush to persist
      await index.flush()

      // Create new index from same storage
      const index2 = new AggregationIndex(storage)
      await index2.init()

      expect(index2.hasAggregate('persist_test')).toBe(true)
      const results = index2.queryAggregate({ name: 'persist_test' })
      expect(results).toHaveLength(1)
      expect(results[0].metrics.total).toBe(42)

      await index2.close()
    })

    it('should rebuild state when definition hash changes', async () => {
      index.defineAggregate({
        name: 'hash_test',
        source: { type: NounType.Event },
        groupBy: ['category'],
        metrics: { total: { op: 'sum', field: 'amount' } }
      })

      index.onEntityAdded('e1', {
        type: NounType.Event,
        metadata: { category: 'food', amount: 42 }
      })

      await index.flush()

      // Create new index and register a DIFFERENT definition with same name
      const index2 = new AggregationIndex(storage)
      await index2.init()

      // The loaded state should be present (definition unchanged)
      expect(index2.queryAggregate({ name: 'hash_test' })[0].metrics.total).toBe(42)

      // Now define with different metrics — should clear state
      index2.defineAggregate({
        name: 'hash_test',
        source: { type: NounType.Event },
        groupBy: ['category'],
        metrics: { count: { op: 'count' } } // Changed from sum to count
      })

      // State should be fresh (empty — no entities added to the new definition)
      const results = index2.queryAggregate({ name: 'hash_test' })
      expect(results).toHaveLength(0)

      await index2.close()
    })
  })

  // ============= Service Filter =============

  describe('source service filter', () => {
    it('should filter by service', () => {
      index.defineAggregate({
        name: 'svc_test',
        source: { type: NounType.Event, service: 'finance-app' },
        groupBy: ['category'],
        metrics: { count: { op: 'count' } }
      })

      index.onEntityAdded('e1', {
        type: NounType.Event,
        service: 'finance-app',
        metadata: { category: 'food' }
      })
      index.onEntityAdded('e2', {
        type: NounType.Event,
        service: 'other-app',
        metadata: { category: 'food' }
      })

      const results = index.queryAggregate({ name: 'svc_test' })
      expect(results).toHaveLength(1)
      expect(results[0].metrics.count).toBe(1)
    })
  })

  // ============= Scale Test =============

  describe('performance at scale', () => {
    it('should handle 10,000 entities efficiently', () => {
      index.defineAggregate({
        name: 'scale_test',
        source: { type: NounType.Event },
        groupBy: ['category'],
        metrics: {
          total: { op: 'sum', field: 'amount' },
          count: { op: 'count' }
        }
      })

      const categories = ['food', 'transport', 'housing', 'entertainment', 'utilities']
      const start = performance.now()

      for (let i = 0; i < 10_000; i++) {
        index.onEntityAdded(`e${i}`, {
          type: NounType.Event,
          metadata: {
            category: categories[i % categories.length],
            amount: Math.random() * 1000
          }
        })
      }

      const elapsed = performance.now() - start

      // 10K entities should process in under 500ms (O(1) per entity)
      expect(elapsed).toBeLessThan(500)

      const results = index.queryAggregate({ name: 'scale_test' })
      expect(results).toHaveLength(5)

      // Each category should have 2000 entities
      for (const r of results) {
        expect(r.metrics.count).toBe(2000)
      }
    })
  })
})
