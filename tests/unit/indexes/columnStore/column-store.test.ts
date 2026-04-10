/**
 * @module column-store.test
 * @description Tests for the ColumnStore coordinator: full lifecycle including
 * add, flush, reload, filter, sort, range query, and removal.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { ColumnStore } from '../../../../src/indexes/columnStore/ColumnStore.js'
import { MemoryStorage } from '../../../../src/storage/adapters/memoryStorage.js'
import { EntityIdMapper } from '../../../../src/utils/entityIdMapper.js'
import { RoaringBitmap32 } from '../../../../src/utils/roaring/index.js'

describe('ColumnStore', () => {
  let storage: MemoryStorage
  let idMapper: EntityIdMapper
  let store: ColumnStore

  beforeEach(async () => {
    storage = new MemoryStorage()
    await storage.init()
    idMapper = new EntityIdMapper({ storage, storageKey: 'test:idMapper' })
    await idMapper.init()

    store = new ColumnStore({ flushThreshold: 10 }) // low threshold for tests
    await store.init(storage, idMapper)
  })

  afterEach(async () => {
    await store.close()
  })

  // -----------------------------------------------------------------------
  // Basic add + sort
  // -----------------------------------------------------------------------

  describe('sortTopK', () => {
    it('returns entities sorted by numeric field ascending', async () => {
      store.addEntity(idMapper.getOrAssign('a'), { createdAt: 300 })
      store.addEntity(idMapper.getOrAssign('b'), { createdAt: 100 })
      store.addEntity(idMapper.getOrAssign('c'), { createdAt: 200 })
      await store.flush()

      const result = await store.sortTopK('createdAt', 'asc', 10)
      const uuids = result.map(id => idMapper.getUuid(id))
      expect(uuids).toEqual(['b', 'c', 'a'])
    })

    it('returns entities sorted by numeric field descending', async () => {
      store.addEntity(idMapper.getOrAssign('a'), { createdAt: 300 })
      store.addEntity(idMapper.getOrAssign('b'), { createdAt: 100 })
      store.addEntity(idMapper.getOrAssign('c'), { createdAt: 200 })
      await store.flush()

      const result = await store.sortTopK('createdAt', 'desc', 10)
      const uuids = result.map(id => idMapper.getUuid(id))
      expect(uuids).toEqual(['a', 'c', 'b'])
    })

    it('respects limit K', async () => {
      for (let i = 0; i < 50; i++) {
        store.addEntity(idMapper.getOrAssign(`e${i}`), { createdAt: i * 1000 })
      }
      await store.flush()

      const result = await store.sortTopK('createdAt', 'desc', 5)
      expect(result).toHaveLength(5)
      // Should be the 5 highest timestamps
      const uuids = result.map(id => idMapper.getUuid(id))
      expect(uuids).toEqual(['e49', 'e48', 'e47', 'e46', 'e45'])
    })

    it('sorts string fields lexicographically', async () => {
      store.addEntity(idMapper.getOrAssign('a'), { status: 'pending' })
      store.addEntity(idMapper.getOrAssign('b'), { status: 'active' })
      store.addEntity(idMapper.getOrAssign('c'), { status: 'inactive' })
      await store.flush()

      const result = await store.sortTopK('status', 'asc', 10)
      const uuids = result.map(id => idMapper.getUuid(id))
      expect(uuids).toEqual(['b', 'c', 'a']) // active, inactive, pending
    })

    it('returns empty for unknown field', async () => {
      const result = await store.sortTopK('nonexistent', 'asc', 10)
      expect(result).toEqual([])
    })
  })

  // -----------------------------------------------------------------------
  // Filtered sort
  // -----------------------------------------------------------------------

  describe('filteredSortTopK', () => {
    it('returns only entities in the filter bitmap, sorted', async () => {
      const idA = idMapper.getOrAssign('a')
      const idB = idMapper.getOrAssign('b')
      const idC = idMapper.getOrAssign('c')
      const idD = idMapper.getOrAssign('d')

      store.addEntity(idA, { createdAt: 400 })
      store.addEntity(idB, { createdAt: 100 })
      store.addEntity(idC, { createdAt: 300 })
      store.addEntity(idD, { createdAt: 200 })
      await store.flush()

      // Filter: only B and C
      const bitmap = new RoaringBitmap32([idB, idC])
      const result = await store.filteredSortTopK(bitmap, 'createdAt', 'desc', 10)
      const uuids = result.map(id => idMapper.getUuid(id))
      expect(uuids).toEqual(['c', 'b']) // 300, 100
    })
  })

  // -----------------------------------------------------------------------
  // Point filter
  // -----------------------------------------------------------------------

  describe('filter', () => {
    it('returns matching entities as roaring bitmap', async () => {
      const idA = idMapper.getOrAssign('a')
      const idB = idMapper.getOrAssign('b')
      const idC = idMapper.getOrAssign('c')

      store.addEntity(idA, { status: 'active' })
      store.addEntity(idB, { status: 'inactive' })
      store.addEntity(idC, { status: 'active' })
      await store.flush()

      const bitmap = await store.filter('status', 'active')
      expect(bitmap.has(idA)).toBe(true)
      expect(bitmap.has(idC)).toBe(true)
      expect(bitmap.has(idB)).toBe(false)
    })

    it('returns empty bitmap for no match', async () => {
      store.addEntity(idMapper.getOrAssign('a'), { status: 'active' })
      await store.flush()

      const bitmap = await store.filter('status', 'deleted')
      expect(bitmap.size).toBe(0)
    })
  })

  // -----------------------------------------------------------------------
  // Range query
  // -----------------------------------------------------------------------

  describe('rangeQuery', () => {
    it('returns entities within numeric range', async () => {
      const ids: number[] = []
      for (let i = 0; i < 10; i++) {
        ids.push(idMapper.getOrAssign(`e${i}`))
        store.addEntity(ids[i], { price: i * 10 })
      }
      await store.flush()

      const bitmap = await store.rangeQuery('price', 30, 70)
      // price 30, 40, 50, 60, 70 → entities e3, e4, e5, e6, e7
      expect(bitmap.size).toBe(5)
      expect(bitmap.has(ids[3])).toBe(true)
      expect(bitmap.has(ids[7])).toBe(true)
      expect(bitmap.has(ids[2])).toBe(false)
      expect(bitmap.has(ids[8])).toBe(false)
    })
  })

  // -----------------------------------------------------------------------
  // Removal
  // -----------------------------------------------------------------------

  describe('removeEntity', () => {
    it('excluded from sort after removal', async () => {
      const idA = idMapper.getOrAssign('a')
      const idB = idMapper.getOrAssign('b')
      const idC = idMapper.getOrAssign('c')

      store.addEntity(idA, { createdAt: 100 })
      store.addEntity(idB, { createdAt: 200 })
      store.addEntity(idC, { createdAt: 300 })
      await store.flush()

      store.removeEntity(idB)
      await store.flush()

      const result = await store.sortTopK('createdAt', 'asc', 10)
      const uuids = result.map(id => idMapper.getUuid(id))
      expect(uuids).toEqual(['a', 'c'])
    })
  })

  // -----------------------------------------------------------------------
  // Multi-segment merge sort
  // -----------------------------------------------------------------------

  describe('multi-segment', () => {
    it('sorts correctly across multiple L0 segments', async () => {
      // Flush threshold is 10, so 25 entities creates 3 segments
      for (let i = 0; i < 25; i++) {
        store.addEntity(idMapper.getOrAssign(`e${i}`), { ts: i })
      }
      await store.flush()

      const result = await store.sortTopK('ts', 'desc', 5)
      const uuids = result.map(id => idMapper.getUuid(id))
      expect(uuids).toEqual(['e24', 'e23', 'e22', 'e21', 'e20'])
    })
  })

  // -----------------------------------------------------------------------
  // Persistence (flush + reload)
  // -----------------------------------------------------------------------

  describe('persistence', () => {
    it('survives close + reload', async () => {
      store.addEntity(idMapper.getOrAssign('a'), { createdAt: 300 })
      store.addEntity(idMapper.getOrAssign('b'), { createdAt: 100 })
      store.addEntity(idMapper.getOrAssign('c'), { createdAt: 200 })
      await store.flush()
      await store.close()

      // Create a new store pointing at the same storage
      const store2 = new ColumnStore({ flushThreshold: 10 })
      await store2.init(storage, idMapper)

      const result = await store2.sortTopK('createdAt', 'desc', 10)
      const uuids = result.map(id => idMapper.getUuid(id))
      expect(uuids).toEqual(['a', 'c', 'b'])

      await store2.close()
    })
  })

  // -----------------------------------------------------------------------
  // Multi-value fields (words)
  // -----------------------------------------------------------------------

  describe('multi-value fields', () => {
    it('indexes multiple values per entity', async () => {
      const idA = idMapper.getOrAssign('docA')
      const idB = idMapper.getOrAssign('docB')

      store.addEntity(idA, { __words__: ['machine', 'learning', 'algorithm'] })
      store.addEntity(idB, { __words__: ['neural', 'network', 'machine'] })
      await store.flush()

      // Point filter: "machine" should match both
      const machineBitmap = await store.filter('__words__', 'machine')
      expect(machineBitmap.has(idA)).toBe(true)
      expect(machineBitmap.has(idB)).toBe(true)

      // "algorithm" should match only docA
      const algoBitmap = await store.filter('__words__', 'algorithm')
      expect(algoBitmap.has(idA)).toBe(true)
      expect(algoBitmap.has(idB)).toBe(false)

      // AND intersection: "machine" AND "neural" → only docB
      const neuralBitmap = await store.filter('__words__', 'neural')
      const intersection = RoaringBitmap32.and(machineBitmap, neuralBitmap)
      expect(intersection.has(idB)).toBe(true)
      expect(intersection.has(idA)).toBe(false)
    })
  })

  // -----------------------------------------------------------------------
  // getFilterValues
  // -----------------------------------------------------------------------

  describe('getFilterValues', () => {
    it('returns distinct values sorted', async () => {
      store.addEntity(idMapper.getOrAssign('a'), { status: 'pending' })
      store.addEntity(idMapper.getOrAssign('b'), { status: 'active' })
      store.addEntity(idMapper.getOrAssign('c'), { status: 'active' })
      store.addEntity(idMapper.getOrAssign('d'), { status: 'inactive' })
      await store.flush()

      const values = await store.getFilterValues('status')
      expect(values).toEqual(['active', 'inactive', 'pending'])
    })
  })

  // -----------------------------------------------------------------------
  // hasField
  // -----------------------------------------------------------------------

  describe('hasField', () => {
    it('returns false for unknown field', () => {
      expect(store.hasField('nonexistent')).toBe(false)
    })

    it('returns true after adding data', async () => {
      store.addEntity(idMapper.getOrAssign('a'), { createdAt: 100 })
      expect(store.hasField('createdAt')).toBe(true)
    })
  })
})
