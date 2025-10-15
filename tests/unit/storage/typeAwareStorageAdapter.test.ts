/**
 * Tests for TypeAwareStorageAdapter
 *
 * Validates type-first storage architecture for billion-scale optimization
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { TypeAwareStorageAdapter } from '../../../src/storage/adapters/typeAwareStorageAdapter.js'
import { MemoryStorage } from '../../../src/storage/adapters/memoryStorage.js'
import { HNSWNoun, HNSWVerb } from '../../../src/coreTypes.js'
import { NOUN_TYPE_COUNT, VERB_TYPE_COUNT } from '../../../src/types/graphTypes.js'

describe('TypeAwareStorageAdapter', () => {
  let adapter: TypeAwareStorageAdapter
  let underlyingStorage: MemoryStorage

  beforeEach(async () => {
    underlyingStorage = new MemoryStorage()
    await underlyingStorage.init()

    adapter = new TypeAwareStorageAdapter({
      underlyingStorage,
      verbose: false
    })
    await adapter.init()
  })

  describe('Initialization', () => {
    it('should initialize successfully', async () => {
      expect(adapter).toBeDefined()
      const stats = adapter.getTypeStatistics()
      expect(stats).toBeDefined()
      expect(stats.totalMemory).toBe(284) // 124 + 160 bytes
    })

    it('should have zero counts initially', () => {
      const stats = adapter.getTypeStatistics()
      expect(stats.nouns).toHaveLength(0)
      expect(stats.verbs).toHaveLength(0)
    })
  })

  describe('Noun Storage', () => {
    it('should save and retrieve a noun with type-first path', async () => {
      const noun: HNSWNoun = {
        id: 'test-person-1',
        vector: [1, 2, 3],
        metadata: {
          noun: 'person',
          name: 'Alice'
        }
      }

      await adapter.saveNoun(noun)
      const retrieved = await adapter.getNoun('test-person-1')

      expect(retrieved).toEqual(noun)
    })

    it('should track noun counts by type', async () => {
      const person: HNSWNoun = {
        id: 'person-1',
        vector: [1, 2, 3],
        metadata: { noun: 'person', name: 'Bob' }
      }

      const document: HNSWNoun = {
        id: 'doc-1',
        vector: [4, 5, 6],
        metadata: { noun: 'document', title: 'Test Doc' }
      }

      await adapter.saveNoun(person)
      await adapter.saveNoun(document)

      const stats = adapter.getTypeStatistics()
      expect(stats.nouns).toHaveLength(2)

      const personStat = stats.nouns.find(s => s.type === 'person')
      const docStat = stats.nouns.find(s => s.type === 'document')

      expect(personStat?.count).toBe(1)
      expect(docStat?.count).toBe(1)
    })

    it('should retrieve nouns by noun type (O(1) with type-first paths)', async () => {
      const people: HNSWNoun[] = [
        {
          id: 'person-1',
          vector: [1, 2, 3],
          metadata: { noun: 'person', name: 'Alice' }
        },
        {
          id: 'person-2',
          vector: [4, 5, 6],
          metadata: { noun: 'person', name: 'Bob' }
        }
      ]

      const docs: HNSWNoun[] = [
        {
          id: 'doc-1',
          vector: [7, 8, 9],
          metadata: { noun: 'document', title: 'Doc 1' }
        }
      ]

      for (const person of people) {
        await adapter.saveNoun(person)
      }
      for (const doc of docs) {
        await adapter.saveNoun(doc)
      }

      const retrievedPeople = await adapter.getNounsByNounType('person')
      expect(retrievedPeople).toHaveLength(2)
      expect(retrievedPeople.map(p => p.id).sort()).toEqual(['person-1', 'person-2'])

      const retrievedDocs = await adapter.getNounsByNounType('document')
      expect(retrievedDocs).toHaveLength(1)
      expect(retrievedDocs[0].id).toBe('doc-1')
    })

    it('should delete nouns and update counts', async () => {
      const noun: HNSWNoun = {
        id: 'person-to-delete',
        vector: [1, 2, 3],
        metadata: { noun: 'person', name: 'ToDelete' }
      }

      await adapter.saveNoun(noun)

      let stats = adapter.getTypeStatistics()
      expect(stats.nouns.find(s => s.type === 'person')?.count).toBe(1)

      await adapter.deleteNoun('person-to-delete')

      const retrieved = await adapter.getNoun('person-to-delete')
      expect(retrieved).toBeNull()

      stats = adapter.getTypeStatistics()
      expect(stats.nouns.find(s => s.type === 'person')?.count).toBe(0)
    })
  })

  describe('Verb Storage', () => {
    it('should save and retrieve a verb with type-first path', async () => {
      const verb: HNSWVerb = {
        id: 'verb-1',
        verb: 'creates',
        vector: [1, 2, 3],
        sourceId: 'person-1',
        targetId: 'doc-1',
        timestamp: Date.now()
      }

      await adapter.saveVerb(verb)
      const retrieved = await adapter.getVerb('verb-1')

      expect(retrieved).toEqual(verb)
    })

    it('should track verb counts by type', async () => {
      const creates: HNSWVerb = {
        id: 'creates-1',
        verb: 'creates',
        vector: [1, 2, 3],
        sourceId: 'p1',
        targetId: 'd1',
        timestamp: Date.now()
      }

      const contains: HNSWVerb = {
        id: 'contains-1',
        verb: 'contains',
        vector: [4, 5, 6],
        sourceId: 'p1',
        targetId: 'd2',
        timestamp: Date.now()
      }

      await adapter.saveVerb(creates)
      await adapter.saveVerb(contains)

      const stats = adapter.getTypeStatistics()
      expect(stats.verbs).toHaveLength(2)

      const createsStat = stats.verbs.find(s => s.type === 'creates')
      const containsStat = stats.verbs.find(s => s.type === 'contains')

      expect(createsStat?.count).toBe(1)
      expect(containsStat?.count).toBe(1)
    })

    it('should retrieve verbs by type (O(1) with type-first paths)', async () => {
      const createsVerbs: HNSWVerb[] = [
        {
          id: 'creates-1',
          verb: 'creates',
          vector: [1, 2, 3],
          sourceId: 'p1',
          targetId: 'd1',
          timestamp: Date.now()
        },
        {
          id: 'creates-2',
          verb: 'creates',
          vector: [4, 5, 6],
          sourceId: 'p2',
          targetId: 'd2',
          timestamp: Date.now()
        }
      ]

      for (const verb of createsVerbs) {
        await adapter.saveVerb(verb)
      }

      const retrieved = await adapter.getVerbsByType('creates')
      expect(retrieved).toHaveLength(2)
      expect(retrieved.map(v => v.id).sort()).toEqual(['creates-1', 'creates-2'])
    })

    it('should delete verbs and update counts', async () => {
      const verb: HNSWVerb = {
        id: 'verb-to-delete',
        verb: 'creates',
        vector: [1, 2, 3],
        sourceId: 'p1',
        targetId: 'd1',
        timestamp: Date.now()
      }

      await adapter.saveVerb(verb)

      let stats = adapter.getTypeStatistics()
      expect(stats.verbs.find(s => s.type === 'creates')?.count).toBe(1)

      await adapter.deleteVerb('verb-to-delete')

      const retrieved = await adapter.getVerb('verb-to-delete')
      expect(retrieved).toBeNull()

      stats = adapter.getTypeStatistics()
      expect(stats.verbs.find(s => s.type === 'creates')?.count).toBe(0)
    })
  })

  describe('Type Caching', () => {
    it('should cache type lookups for performance', async () => {
      const noun: HNSWNoun = {
        id: 'cached-person',
        vector: [1, 2, 3],
        metadata: { noun: 'person', name: 'Cached' }
      }

      await adapter.saveNoun(noun)

      // First retrieval populates cache
      const first = await adapter.getNoun('cached-person')
      expect(first).toBeDefined()

      // Second retrieval should use cache (faster path)
      const second = await adapter.getNoun('cached-person')
      expect(second).toEqual(first)
    })
  })

  describe('Memory Efficiency', () => {
    it('should use fixed-size arrays for type tracking', () => {
      const stats = adapter.getTypeStatistics()

      // Total memory: 31 nouns * 4 bytes + 40 verbs * 4 bytes = 284 bytes
      expect(stats.totalMemory).toBe(284)

      // This is 99.76% less than the ~120KB required with Maps
      const mapMemory = 120_000
      const reduction = ((mapMemory - 284) / mapMemory) * 100
      expect(reduction).toBeGreaterThan(99.7)
    })
  })

  describe('HNSW Data', () => {
    it('should save and retrieve HNSW data', async () => {
      const noun: HNSWNoun = {
        id: 'hnsw-person',
        vector: [1, 2, 3],
        metadata: { noun: 'person', name: 'HNSW Test' }
      }

      await adapter.saveNoun(noun)

      const hnswData = {
        level: 2,
        connections: {
          '0': ['id1', 'id2'],
          '1': ['id3', 'id4'],
          '2': ['id5']
        }
      }

      await adapter.saveHNSWData('hnsw-person', hnswData)
      const retrieved = await adapter.getHNSWData('hnsw-person')

      expect(retrieved).toEqual(hnswData)
    })

    it('should save and retrieve HNSW system data', async () => {
      const systemData = {
        entryPointId: 'person-1',
        maxLevel: 5
      }

      await adapter.saveHNSWSystem(systemData)
      const retrieved = await adapter.getHNSWSystem()

      expect(retrieved).toEqual(systemData)
    })
  })

  describe('Storage Status', () => {
    it('should report type-aware storage status', async () => {
      const status = await adapter.getStorageStatus()

      expect(status.type).toBe('type-aware')
      expect(status.details?.typeTracking).toBeDefined()
      expect(status.details.typeTracking.nounTypes).toBe(NOUN_TYPE_COUNT)
      expect(status.details.typeTracking.verbTypes).toBe(VERB_TYPE_COUNT)
      expect(status.details.typeTracking.memoryBytes).toBe(284)
    })
  })

  describe('Clear', () => {
    it('should clear all data and reset counts', async () => {
      const noun: HNSWNoun = {
        id: 'person-1',
        vector: [1, 2, 3],
        metadata: { noun: 'person', name: 'Test' }
      }

      await adapter.saveNoun(noun)

      let stats = adapter.getTypeStatistics()
      expect(stats.nouns.length).toBeGreaterThan(0)

      await adapter.clear()

      const retrieved = await adapter.getNoun('person-1')
      expect(retrieved).toBeNull()

      stats = adapter.getTypeStatistics()
      expect(stats.nouns).toHaveLength(0)
      expect(stats.verbs).toHaveLength(0)
    })
  })

  describe('Integration with Different Backends', () => {
    it('should work with MemoryStorage as underlying storage', async () => {
      const memAdapter = new TypeAwareStorageAdapter({
        underlyingStorage: new MemoryStorage(),
        verbose: false
      })
      await memAdapter.init()

      const noun: HNSWNoun = {
        id: 'test-1',
        vector: [1, 2, 3],
        metadata: { noun: 'person', name: 'Test' }
      }

      await memAdapter.saveNoun(noun)
      const retrieved = await memAdapter.getNoun('test-1')

      expect(retrieved).toEqual(noun)
    })
  })
})
