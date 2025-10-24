/**
 * Comprehensive All-APIs Test (v4.4.0)
 *
 * Systematically tests EVERY public API to verify:
 * 1. Code is actually wired up
 * 2. VFS filtering works correctly
 * 3. Production quality (no errors, proper returns)
 *
 * APIs tested:
 * - brain.add(), brain.get(), brain.update(), brain.delete()
 * - brain.find(), brain.similar()
 * - brain.relate(), brain.getRelations(), brain.unrelate()
 * - brain.addMany(), brain.updateMany(), brain.deleteMany(), brain.relateMany()
 * - vfs.* (init, mkdir, writeFile, readdir, readFile, stat, exists)
 * - neural.* (similar, neighbors, outliers)
 * - import.* (would test if CSV/Excel/PDF available)
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { Brainy } from '../../src/brainy.js'
import { NounType } from '../../src/types/graphTypes.js'
import * as fs from 'fs'
import * as path from 'path'

describe('Comprehensive All-APIs Test', () => {
  const testDir = path.join(process.cwd(), 'test-all-apis')
  let brain: Brainy

  beforeAll(async () => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true })
    }
    fs.mkdirSync(testDir, { recursive: true })

    brain = new Brainy({
      storage: {
        type: 'filesystem',
        options: { path: testDir }
      }
    })
    await brain.init()
  })

  afterAll(() => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true })
    }
  })

  describe('Core Entity APIs', () => {
    let entityId: string

    it('brain.add() - should create entity', async () => {
      entityId = await brain.add({
        data: 'Test entity content',
        type: NounType.Document,
        metadata: { title: 'Test Doc', category: 'test' }
      })

      expect(typeof entityId).toBe('string')
      expect(entityId.length).toBeGreaterThan(0)
      console.log(`✅ brain.add() created: ${entityId}`)
    })

    it('brain.get() - should retrieve entity', async () => {
      const entity = await brain.get(entityId)

      expect(entity).not.toBeNull()
      expect(entity?.id).toBe(entityId)
      expect(entity?.type).toBe(NounType.Document)
      expect(entity?.metadata?.title).toBe('Test Doc')
      console.log(`✅ brain.get() retrieved entity`)
    })

    it('brain.update() - should update entity', async () => {
      await brain.update({
        id: entityId,
        metadata: { updated: true }
      })

      const updated = await brain.get(entityId)
      expect(updated?.metadata?.updated).toBe(true)
      console.log(`✅ brain.update() updated metadata`)
    })

    it('brain.find() - should find entities (excludes VFS)', async () => {
      const results = await brain.find({
        where: { category: 'test' },
        limit: 10
      })

      expect(results.length).toBeGreaterThan(0)
      expect(results.some(r => r.id === entityId)).toBe(true)
      expect(results.every(r => r.metadata?.isVFS !== true)).toBe(true) // No VFS
      console.log(`✅ brain.find() found ${results.length} entities (no VFS)`)
    })

    it('brain.similar() - should find similar entities (excludes VFS)', async () => {
      // Create another similar entity
      await brain.add({
        data: 'Another test document',
        type: NounType.Document,
        metadata: { category: 'test' }
      })

      const similar = await brain.similar({
        to: entityId,
        limit: 10
      })

      expect(Array.isArray(similar)).toBe(true)
      expect(similar.every(r => r.metadata?.isVFS !== true)).toBe(true) // No VFS
      console.log(`✅ brain.similar() found ${similar.length} similar entities (no VFS)`)
    })

    it('brain.delete() - should delete entity', async () => {
      await brain.delete(entityId)

      const deleted = await brain.get(entityId)
      expect(deleted).toBeNull()
      console.log(`✅ brain.delete() deleted entity`)
    })
  })

  describe('Relationship APIs', () => {
    let entity1Id: string
    let entity2Id: string
    let relationId: string

    it('brain.relate() - should create relationship', async () => {
      entity1Id = await brain.add({
        data: 'Entity 1',
        type: NounType.Concept
      })

      entity2Id = await brain.add({
        data: 'Entity 2',
        type: NounType.Concept
      })

      relationId = await brain.relate({
        from: entity1Id,
        to: entity2Id,
        type: 'relatedTo'
      })

      expect(typeof relationId).toBe('string')
      console.log(`✅ brain.relate() created relation: ${relationId}`)
    })

    it('brain.getRelations() - should retrieve relationships', async () => {
      const relations = await brain.getRelations({
        from: entity1Id
      })

      expect(relations.length).toBeGreaterThan(0)
      expect(relations.some(r => r.id === relationId)).toBe(true)
      console.log(`✅ brain.getRelations() found ${relations.length} relations`)
    })

    it('brain.unrelate() - should delete relationship', async () => {
      await brain.unrelate(relationId)

      const relations = await brain.getRelations({
        from: entity1Id
      })

      expect(relations.every(r => r.id !== relationId)).toBe(true)
      console.log(`✅ brain.unrelate() deleted relation`)
    })
  })

  describe('Batch APIs', () => {
    it('brain.addMany() - should create multiple entities', async () => {
      const result = await brain.addMany({
        items: [
          { data: 'Batch 1', type: NounType.Document },
          { data: 'Batch 2', type: NounType.Document },
          { data: 'Batch 3', type: NounType.Document }
        ]
      })

      expect(result.successful.length).toBe(3)
      expect(result.failed.length).toBe(0)
      console.log(`✅ brain.addMany() created ${result.successful.length} entities`)
    })

    it('brain.relateMany() - should create multiple relationships', async () => {
      const ids = await brain.addMany({
        items: [
          { data: 'A', type: NounType.Concept },
          { data: 'B', type: NounType.Concept }
        ]
      })

      const relationIds = await brain.relateMany({
        items: [
          { from: ids.successful[0], to: ids.successful[1], type: 'links' }
        ]
      })

      expect(relationIds.length).toBe(1)
      console.log(`✅ brain.relateMany() created ${relationIds.length} relations`)
    })

    it('brain.deleteMany() - should delete multiple entities', async () => {
      const ids = await brain.addMany({
        items: [
          { data: 'Delete 1', type: NounType.Document },
          { data: 'Delete 2', type: NounType.Document }
        ]
      })

      const result = await brain.deleteMany({
        ids: ids.successful
      })

      expect(result.successful.length).toBe(2)
      console.log(`✅ brain.deleteMany() deleted ${result.successful.length} entities`)
    })
  })

  describe('VFS APIs', () => {
    let vfs: any

    it('vfs.init() - should initialize VFS', async () => {
      vfs = brain.vfs()
      await vfs.init()

      expect(vfs).toBeDefined()
      console.log(`✅ vfs.init() initialized`)
    })

    it('vfs.mkdir() - should create directory', async () => {
      await vfs.mkdir('/test-dir', { recursive: true })

      const exists = await vfs.exists('/test-dir')
      expect(exists).toBe(true)
      console.log(`✅ vfs.mkdir() created directory`)
    })

    it('vfs.writeFile() - should create file', async () => {
      await vfs.writeFile('/test-dir/file.txt', 'Hello World')

      const exists = await vfs.exists('/test-dir/file.txt')
      expect(exists).toBe(true)
      console.log(`✅ vfs.writeFile() created file`)
    })

    it('vfs.readFile() - should read file content', async () => {
      const content = await vfs.readFile('/test-dir/file.txt')

      expect(content.toString()).toBe('Hello World')
      console.log(`✅ vfs.readFile() read content`)
    })

    it('vfs.readdir() - should list directory', async () => {
      const entries = await vfs.readdir('/test-dir')

      expect(entries.length).toBeGreaterThan(0)
      expect(entries.some((e: any) => e.name === 'file.txt')).toBe(true)
      console.log(`✅ vfs.readdir() listed ${entries.length} entries`)
    })

    it('vfs.stat() - should get file stats', async () => {
      const stats = await vfs.stat('/test-dir/file.txt')

      expect(stats.size).toBeGreaterThan(0)
      expect(stats.type).toBe('file')
      console.log(`✅ vfs.stat() got stats: ${stats.size} bytes`)
    })

    it('VFS entities have isVFS flag', async () => {
      const vfsEntities = await brain.find({
        where: { path: '/test-dir/file.txt' },
        includeVFS: true,
        limit: 1
      })

      expect(vfsEntities.length).toBe(1)
      expect(vfsEntities[0].metadata?.isVFS).toBe(true)
      expect(vfsEntities[0].metadata?.path).toBe('/test-dir/file.txt')
      console.log(`✅ VFS entities properly flagged with isVFS`)
    })

    it('VFS entities excluded from knowledge graph', async () => {
      const knowledge = await brain.find({
        type: NounType.Document,
        limit: 100
      })

      const vfsCount = knowledge.filter(r => r.metadata?.isVFS === true).length
      expect(vfsCount).toBe(0)
      console.log(`✅ Knowledge graph clean: 0 VFS entities leaked`)
    })
  })

  describe('Neural APIs', () => {
    it('neural.similar() - should calculate similarity', async () => {
      const neural = brain.neural()

      const similarity = await neural.similar('test text 1', 'test text 2')

      expect(typeof similarity).toBe('number')
      expect(similarity).toBeGreaterThan(0)
      expect(similarity).toBeLessThanOrEqual(1)
      console.log(`✅ neural.similar() computed similarity: ${similarity.toFixed(4)}`)
    })

    it('neural.neighbors() - should find neighbors', async () => {
      const neural = brain.neural()

      // Create test entity
      const entityId = await brain.add({
        data: 'Neighbor test',
        type: NounType.Document
      })

      const neighbors = await neural.neighbors(entityId)

      expect(neighbors).toBeDefined()
      expect(Array.isArray(neighbors.neighbors)).toBe(true)
      console.log(`✅ neural.neighbors() found ${neighbors.neighbors.length} neighbors`)
    })

    it('neural.outliers() - should detect outliers', async () => {
      const neural = brain.neural()

      const outliers = await neural.outliers({ limit: 10 })

      expect(Array.isArray(outliers)).toBe(true)
      console.log(`✅ neural.outliers() detected ${outliers.length} outliers`)
    })
  })

  describe('Production Quality Checks', () => {
    it('should handle large batch operations', async () => {
      const start = Date.now()

      const result = await brain.addMany({
        items: Array(100).fill(null).map((_, i) => ({
          data: `Batch entity ${i}`,
          type: NounType.Document
        }))
      })

      const time = Date.now() - start

      expect(result.successful.length).toBe(100)
      expect(result.failed.length).toBe(0)
      expect(time).toBeLessThan(30000) // < 30 seconds for 100 entities
      console.log(`✅ Created 100 entities in ${time}ms`)
    })

    it('should handle metadata queries efficiently', async () => {
      const start = Date.now()

      const results = await brain.find({
        where: { type: NounType.Document },
        limit: 100
      })

      const time = Date.now() - start

      expect(results.length).toBeGreaterThan(0)
      expect(time).toBeLessThan(1000) // < 1 second
      console.log(`✅ Metadata query in ${time}ms`)
    })
  })
})
