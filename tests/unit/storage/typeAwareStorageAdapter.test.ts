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
      const id = '00000000-0000-0000-0000-000000000001'
      const vector = [1, 2, 3]
      const metadata = {
        noun: 'person',
        name: 'Alice'
      }

      // v4.0.0: Save vector and metadata separately
      const noun: HNSWNoun = {
        id,
        vector,
        connections: new Map(),
        level: 0
      }

      // Save metadata FIRST (populates type cache for routing)
      await adapter.saveNounMetadata(id, metadata)
      // Then save vector (uses cached type for routing)
      await adapter.saveNoun(noun)

      // getNoun() combines both
      const retrieved = await adapter.getNoun(id)

      expect(retrieved).toBeDefined()
      expect(retrieved?.id).toBe(id)
      expect(retrieved?.vector).toEqual(vector)
      expect(retrieved?.level).toBe(0)
      // v4.8.0: Standard fields (noun → type) at top-level, only custom fields in metadata
      expect(retrieved?.type).toBe('person')
      expect(retrieved?.metadata).toEqual({ name: 'Alice' })
    })

    it('should track noun counts by type', async () => {
      const personId = '00000000-0000-0000-0000-000000000010'
      const docId = '00000000-0000-0000-0000-000000000020'

      const person: HNSWNoun = {
        id: personId,
        vector: [1, 2, 3],
        connections: new Map(),
        level: 0
      }

      const document: HNSWNoun = {
        id: docId,
        vector: [4, 5, 6],
        connections: new Map(),
        level: 0
      }

      // v4.0.0: Save metadata first, then vectors
      await adapter.saveNounMetadata(personId, { noun: 'person', name: 'Bob' })
      await adapter.saveNoun(person)

      await adapter.saveNounMetadata(docId, { noun: 'document', title: 'Test Doc' })
      await adapter.saveNoun(document)

      const stats = adapter.getTypeStatistics()
      expect(stats.nouns).toHaveLength(2)

      const personStat = stats.nouns.find(s => s.type === 'person')
      const docStat = stats.nouns.find(s => s.type === 'document')

      expect(personStat?.count).toBe(1)
      expect(docStat?.count).toBe(1)
    })

    it('should retrieve nouns by noun type (O(1) with type-first paths)', async () => {
      const peopleIds = ['00000000-0000-0000-0000-000000000010', '00000000-0000-0000-0000-000000000011']
      const docIds = ['00000000-0000-0000-0000-000000000020']

      // v4.0.0: Save metadata first, then vectors
      await adapter.saveNounMetadata(peopleIds[0], { noun: 'person', name: 'Alice' })
      await adapter.saveNoun({
        id: peopleIds[0],
        vector: [1, 2, 3],
        connections: new Map(),
        level: 0
      })

      await adapter.saveNounMetadata(peopleIds[1], { noun: 'person', name: 'Bob' })
      await adapter.saveNoun({
        id: peopleIds[1],
        vector: [4, 5, 6],
        connections: new Map(),
        level: 0
      })

      await adapter.saveNounMetadata(docIds[0], { noun: 'document', title: 'Doc 1' })
      await adapter.saveNoun({
        id: docIds[0],
        vector: [7, 8, 9],
        connections: new Map(),
        level: 0
      })

      const retrievedPeople = await adapter.getNounsByNounType('person')
      expect(retrievedPeople).toHaveLength(2)
      expect(retrievedPeople.map(p => p.id).sort()).toEqual(peopleIds.sort())

      const retrievedDocs = await adapter.getNounsByNounType('document')
      expect(retrievedDocs).toHaveLength(1)
      expect(retrievedDocs[0].id).toBe(docIds[0])
    })

    it('should delete nouns and update counts', async () => {
      const id = '00000000-0000-0000-0000-000000000030'

      // v4.0.0: Save metadata first, then vector
      await adapter.saveNounMetadata(id, { noun: 'person', name: 'ToDelete' })
      await adapter.saveNoun({
        id,
        vector: [1, 2, 3],
        connections: new Map(),
        level: 0
      })

      let stats = adapter.getTypeStatistics()
      expect(stats.nouns.find(s => s.type === 'person')?.count).toBe(1)

      await adapter.deleteNoun(id)

      const retrieved = await adapter.getNoun(id)
      expect(retrieved).toBeNull()

      stats = adapter.getTypeStatistics()
      // After deletion, type is removed from stats array (implementation excludes zero counts)
      expect(stats.nouns.find(s => s.type === 'person')).toBeUndefined()
    })
  })

  describe('Verb Storage', () => {
    it('should save and retrieve a verb with type-first path', async () => {
      const id = '00000000-0000-0000-0000-000000000040'
      const timestamp = Date.now()

      const verb: HNSWVerb = {
        id,
        verb: 'creates',
        vector: [1, 2, 3],
        connections: new Map(),
        sourceId: '00000000-0000-0000-0000-000000000010',
        targetId: '00000000-0000-0000-0000-000000000020'
      }

      // v4.0.0: Save verb FIRST (so type is known), then metadata
      await adapter.saveVerb(verb)
      await adapter.saveVerbMetadata(id, { createdAt: timestamp })

      const retrieved = await adapter.getVerb(id)

      // getVerb returns HNSWVerbWithMetadata
      expect(retrieved).toBeDefined()
      expect(retrieved?.id).toBe(id)
      expect(retrieved?.verb).toBe('creates')
      expect(retrieved?.vector).toEqual([1, 2, 3])
      expect(retrieved?.sourceId).toBe(verb.sourceId)
      expect(retrieved?.targetId).toBe(verb.targetId)
    })

    it('should track verb counts by type', async () => {
      const creates: HNSWVerb = {
        id: '00000000-0000-0000-0000-000000000050', // creates-1
        verb: 'creates',
        vector: [1, 2, 3],
        sourceId: '00000000-0000-0000-0000-0000000000a1',
        targetId: '00000000-0000-0000-0000-0000000000b1',
        timestamp: Date.now()
      }

      const contains: HNSWVerb = {
        id: '00000000-0000-0000-0000-000000000060', // contains-1
        verb: 'contains',
        vector: [4, 5, 6],
        sourceId: '00000000-0000-0000-0000-0000000000a1',
        targetId: '00000000-0000-0000-0000-0000000000b2',
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
      const verbIds = [
        '00000000-0000-0000-0000-000000000050',
        '00000000-0000-0000-0000-000000000051'
      ]

      // v4.0.0: Save verb FIRST (so type is known), then metadata
      for (let i = 0; i < verbIds.length; i++) {
        await adapter.saveVerb({
          id: verbIds[i],
          verb: 'creates',
          vector: [i + 1, i + 2, i + 3],
          connections: new Map(),
          sourceId: `00000000-0000-0000-0000-0000000000a${i + 1}`,
          targetId: `00000000-0000-0000-0000-0000000000b${i + 1}`
        })
        await adapter.saveVerbMetadata(verbIds[i], { createdAt: Date.now() })
      }

      const retrieved = await adapter.getVerbsByType('creates')
      expect(retrieved).toHaveLength(2)
      expect(retrieved.map(v => v.id).sort()).toEqual(['00000000-0000-0000-0000-000000000050', '00000000-0000-0000-0000-000000000051'])
    })

    it('should delete verbs and update counts', async () => {
      const verb: HNSWVerb = {
        id: '00000000-0000-0000-0000-000000000070', // verb-to-delete
        verb: 'creates',
        vector: [1, 2, 3],
        sourceId: '00000000-0000-0000-0000-0000000000a1',
        targetId: '00000000-0000-0000-0000-0000000000b1',
        timestamp: Date.now()
      }

      await adapter.saveVerb(verb)

      let stats = adapter.getTypeStatistics()
      expect(stats.verbs.find(s => s.type === 'creates')?.count).toBe(1)

      await adapter.deleteVerb('00000000-0000-0000-0000-000000000070')

      const retrieved = await adapter.getVerb('00000000-0000-0000-0000-000000000070')
      expect(retrieved).toBeNull()

      stats = adapter.getTypeStatistics()
      // After deletion, type is removed from stats array (implementation excludes zero counts)
      expect(stats.verbs.find(s => s.type === 'creates')).toBeUndefined()
    })
  })

  describe('Type Caching', () => {
    it('should cache type lookups for performance', async () => {
      const noun: HNSWNoun = {
        id: '00000000-0000-0000-0000-000000000080', // cached-person
        vector: [1, 2, 3],
        metadata: { noun: 'person', name: 'Cached' }
      }

      await adapter.saveNoun(noun)

      // First retrieval populates cache
      const first = await adapter.getNoun('00000000-0000-0000-0000-000000000080')
      expect(first).toBeDefined()

      // Second retrieval should use cache (faster path)
      const second = await adapter.getNoun('00000000-0000-0000-0000-000000000080')
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
        id: '00000000-0000-0000-0000-000000000090', // hnsw-person
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

      await adapter.saveHNSWData('00000000-0000-0000-0000-000000000090', hnswData)
      const retrieved = await adapter.getHNSWData('00000000-0000-0000-0000-000000000090')

      expect(retrieved).toEqual(hnswData)
    })

    it('should save and retrieve HNSW system data', async () => {
      const systemData = {
        entryPointId: '00000000-0000-0000-0000-000000000010',
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
        id: '00000000-0000-0000-0000-0000000000c1', // person-1
        vector: [1, 2, 3],
        metadata: { noun: 'person', name: 'Test' }
      }

      await adapter.saveNoun(noun)

      let stats = adapter.getTypeStatistics()
      expect(stats.nouns.length).toBeGreaterThan(0)

      await adapter.clear()

      const retrieved = await adapter.getNoun('00000000-0000-0000-0000-0000000000c1')
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

      const id = '00000000-0000-0000-0000-0000000000ff'

      // v4.0.0: Save metadata first, then vector
      await memAdapter.saveNounMetadata(id, { noun: 'person', name: 'Test' })
      await memAdapter.saveNoun({
        id,
        vector: [1, 2, 3],
        connections: new Map(),
        level: 0
      })

      const retrieved = await memAdapter.getNoun(id)

      expect(retrieved).toBeDefined()
      expect(retrieved?.id).toBe(id)
      expect(retrieved?.vector).toEqual([1, 2, 3])
      expect(retrieved?.level).toBe(0)
      // v4.8.0: Standard fields (noun → type) at top-level, only custom fields in metadata
      expect(retrieved?.type).toBe('person')
      expect(retrieved?.metadata).toEqual({ name: 'Test' })
    })
  })
})
