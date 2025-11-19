/**
 * Comprehensive Metadata-Only Integration Test (v5.11.1)
 *
 * Verifies metadata-only optimization works across ALL subsystems:
 * - Storage adapters (Memory, FileSystem)
 * - Indexes (Metadata, Graph, HNSW)
 * - APIs (find, update, delete, relationships)
 * - VFS operations
 * - COW and Fork
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { Brainy } from '../../src/brainy.js'
import { VirtualFileSystem } from '../../src/vfs/VirtualFileSystem.js'
import { NounType } from '../../src/types/graphTypes.js'
import { mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'

describe('Metadata-Only Comprehensive Integration (v5.11.1)', () => {
  describe('Storage Adapters', () => {
    it('should work with MemoryStorage', async () => {
      const brain = new Brainy({
        storage: { adapter: 'memory' },
        silent: true
      })

      await brain.init()

      const id = await brain.add({
        data: 'Test data',
        type: NounType.Document,
        metadata: { title: 'Test' }
      })

      // Metadata-only (default)
      const entity = await brain.get(id)
      expect(entity).toBeTruthy()
      expect(entity!.data).toBe('Test data')
      expect(entity!.metadata.title).toBe('Test')
      expect(entity!.vector).toEqual([]) // No vectors loaded

      // Full entity
      const full = await brain.get(id, { includeVectors: true })
      expect(full!.vector.length).toBe(384)

      await brain.close()
    })

    it('should work with FileSystemStorage', async () => {
      const testDir = mkdtempSync(join(tmpdir(), 'brainy-metadata-test-'))

      const brain = new Brainy({
        storage: {
          type: 'filesystem',
          options: { path: testDir }
        },
        silent: true
      })

      await brain.init()

      const id = await brain.add({
        data: 'FS test data',
        type: NounType.File,
        metadata: { filename: 'test.txt' }
      })

      // Metadata-only
      const entity = await brain.get(id)
      expect(entity!.metadata.filename).toBe('test.txt')
      expect(entity!.vector).toEqual([])

      // Full entity
      const full = await brain.get(id, { includeVectors: true })
      expect(full!.vector.length).toBe(384)

      await brain.close()
      rmSync(testDir, { recursive: true, force: true })
    })
  })

  describe('Indexes', () => {
    let brain: Brainy

    beforeEach(async () => {
      brain = new Brainy({
        storage: { adapter: 'memory' },
        silent: true
      })
      await brain.init()
    })

    afterEach(async () => {
      await brain.close()
    })

    it('should work with MetadataIndex (find with where)', async () => {
      await brain.add({
        data: 'Product 1',
        type: NounType.Product,
        metadata: { price: 100, category: 'electronics' }
      })

      await brain.add({
        data: 'Product 2',
        type: NounType.Product,
        metadata: { price: 200, category: 'electronics' }
      })

      const results = await brain.find({
        where: { category: 'electronics', price: 100 }
      })

      expect(results.length).toBe(1)
      expect(results[0].metadata.price).toBe(100)
      // Results from find() should have vectors loaded for similarity
      expect(results[0].vector.length).toBe(384)
    })

    it('should work with GraphAdjacencyIndex (relationships)', async () => {
      const alice = await brain.add({
        data: 'Alice',
        type: NounType.Person
      })

      const bob = await brain.add({
        data: 'Bob',
        type: NounType.Person
      })

      await brain.addRelationship(alice, 'knows', bob)

      // getVerbsBySource uses graph index
      const relationships = await brain.getVerbsBySource(alice)
      expect(relationships.length).toBe(1)
      expect(relationships[0].targetId).toBe(bob)
    })

    it('should work with HNSW (vector similarity)', async () => {
      const id = await brain.add({
        data: 'Machine learning tutorial',
        type: NounType.Document
      })

      // brain.similar uses HNSW index
      const results = await brain.similar({ to: id, limit: 5 })
      expect(results).toBeDefined()
      expect(Array.isArray(results)).toBe(true)
    })
  })

  describe('Core APIs', () => {
    let brain: Brainy
    let entityId: string

    beforeEach(async () => {
      brain = new Brainy({
        storage: { adapter: 'memory' },
        silent: true
      })
      await brain.init()

      entityId = await brain.add({
        data: 'Test entity',
        type: NounType.Thing,
        metadata: { value: 'original' }
      })
    })

    afterEach(async () => {
      await brain.close()
    })

    it('brain.update() should work with metadata-only get', async () => {
      await brain.update({
        id: entityId,
        metadata: { value: 'updated' }
      })

      const entity = await brain.get(entityId)
      expect(entity!.metadata.value).toBe('updated')
      expect(entity!.vector).toEqual([]) // Still metadata-only
    })

    it('brain.delete() should work after metadata-only get', async () => {
      const entity = await brain.get(entityId)
      expect(entity).toBeTruthy()

      await brain.delete(entityId)

      const deleted = await brain.get(entityId)
      expect(deleted).toBeNull()
    })

    it('brain.find() should return full entities with vectors', async () => {
      const results = await brain.find({
        type: NounType.Thing,
        limit: 10
      })

      expect(results.length).toBeGreaterThan(0)
      // find() results should have vectors
      expect(results[0].vector.length).toBe(384)
    })

    it('brain.similar() should work with entity ID', async () => {
      const results = await brain.similar({ to: entityId, limit: 5 })
      expect(results).toBeDefined()
      expect(Array.isArray(results)).toBe(true)
    })

    it('brain.similar() should reject metadata-only entities', async () => {
      const entity = await brain.get(entityId) // metadata-only

      await expect(
        brain.similar({ to: entity!, limit: 5 })
      ).rejects.toThrow('no vector embeddings loaded')
    })

    it('brain.similar() should work with full entities', async () => {
      const entity = await brain.get(entityId, { includeVectors: true })

      const results = await brain.similar({ to: entity!, limit: 5 })
      expect(results).toBeDefined()
      expect(Array.isArray(results)).toBe(true)
    })
  })

  describe('VFS Integration', () => {
    let brain: Brainy
    let vfs: VirtualFileSystem
    let testDir: string

    beforeEach(async () => {
      testDir = mkdtempSync(join(tmpdir(), 'brainy-vfs-metadata-test-'))

      brain = new Brainy({
        storage: {
          type: 'filesystem',
          options: { path: testDir }
        },
        silent: true
      })

      await brain.init()

      vfs = new VirtualFileSystem(brain)
      await vfs.init()
    })

    afterEach(async () => {
      await brain.close()
      rmSync(testDir, { recursive: true, force: true })
    })

    it('VFS should automatically use metadata-only', async () => {
      await vfs.writeFile('/test.txt', Buffer.from('Test content'))

      // VFS readFile internally uses brain.get() - should be metadata-only
      const content = await vfs.readFile('/test.txt')
      expect(content.toString()).toBe('Test content')
    })

    it('VFS stat() should be fast with metadata-only', async () => {
      await vfs.writeFile('/test.txt', Buffer.from('Test content'))

      const start = performance.now()
      const stats = await vfs.stat('/test.txt')
      const time = performance.now() - start

      expect(stats).toBeDefined()
      expect(stats.size).toBeGreaterThan(0)
      // Should be fast (<50ms) with metadata-only
      expect(time).toBeLessThan(50)
    })

    it('VFS readdir() should be fast with metadata-only', async () => {
      // Create 10 files
      for (let i = 0; i < 10; i++) {
        await vfs.writeFile(`/file${i}.txt`, Buffer.from(`Content ${i}`))
      }

      const start = performance.now()
      const files = await vfs.readdir('/')
      const time = performance.now() - start

      expect(files.length).toBe(10)
      // Should be fast (<200ms for 10 files) with metadata-only
      expect(time).toBeLessThan(200)
    })
  })

  describe('COW and Fork', () => {
    it('should work with metadata-only in forks', async () => {
      const brain = new Brainy({
        storage: { adapter: 'memory' },
        silent: true
      })

      await brain.init()

      const id = await brain.add({
        data: 'Original',
        type: NounType.Document,
        metadata: { version: 1 }
      })

      await brain.commit({ message: 'Initial commit' })

      const fork = await brain.fork('test-branch')

      // Metadata-only in fork
      const entity = await fork.get(id)
      expect(entity).toBeTruthy()
      expect(entity!.metadata.version).toBe(1)
      expect(entity!.vector).toEqual([])

      // Full entity in fork
      const full = await fork.get(id, { includeVectors: true })
      expect(full!.vector.length).toBe(384)

      await brain.close()
      await fork.close()
    })
  })

  describe('Performance Verification', () => {
    it('metadata-only should be significantly faster', async () => {
      const brain = new Brainy({
        storage: { adapter: 'memory' },
        silent: true
      })

      await brain.init()

      const id = await brain.add({
        data: 'Performance test',
        type: NounType.Document
      })

      // Warm up
      await brain.get(id)
      await brain.get(id, { includeVectors: true })

      // Measure metadata-only
      const iterations = 50
      const metadataStart = performance.now()
      for (let i = 0; i < iterations; i++) {
        await brain.get(id)
      }
      const metadataTime = (performance.now() - metadataStart) / iterations

      // Measure full entity
      const fullStart = performance.now()
      for (let i = 0; i < iterations; i++) {
        await brain.get(id, { includeVectors: true })
      }
      const fullTime = (performance.now() - fullStart) / iterations

      // Metadata-only should be faster
      expect(metadataTime).toBeLessThan(fullTime)

      const speedup = ((fullTime - metadataTime) / fullTime) * 100
      console.log(`[Performance] Metadata-only: ${metadataTime.toFixed(2)}ms, Full: ${fullTime.toFixed(2)}ms, Speedup: ${speedup.toFixed(1)}%`)

      await brain.close()
    })
  })
})
