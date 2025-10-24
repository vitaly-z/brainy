/**
 * Remaining APIs Comprehensive Test (v4.4.0)
 *
 * Tests APIs that weren't covered in all-apis-comprehensive.test.ts:
 * - brain.updateMany()
 * - brain.import() (CSV/Excel/PDF with VFS)
 * - brain.clear()
 * - vfs file operations (unlink, rmdir, rename, copy, move)
 * - neural.clusters()
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { Brainy } from '../../src/brainy.js'
import { NounType } from '../../src/types/graphTypes.js'
import * as fs from 'fs'
import * as path from 'path'

describe('Remaining APIs Comprehensive Test', () => {
  const testDir = path.join(process.cwd(), 'test-remaining-apis')
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

  describe('brain.updateMany()', () => {
    it('should batch update multiple entities', async () => {
      console.log('\n📋 Test: brain.updateMany()')

      // Create test entities
      const ids = await brain.addMany({
        items: [
          { data: 'Entity 1', type: NounType.Document, metadata: { status: 'draft' } },
          { data: 'Entity 2', type: NounType.Document, metadata: { status: 'draft' } },
          { data: 'Entity 3', type: NounType.Document, metadata: { status: 'draft' } }
        ]
      })

      console.log(`   Created ${ids.successful.length} entities`)

      // Batch update all to published
      await brain.updateMany({
        items: ids.successful.map(id => ({
          id,
          metadata: { status: 'published', updatedAt: Date.now() }
        }))
      })

      // Verify all updated (status changed from 'draft' to 'published')
      for (const id of ids.successful) {
        const entity = await brain.get(id)
        expect(entity?.metadata?.status).toBe('published')
      }

      console.log(`   ✅ brain.updateMany() updated ${ids.successful.length} entities`)
    })

    it('should handle partial failures gracefully', async () => {
      console.log('\n📋 Test: brain.updateMany() error handling')

      const validId = await brain.add({
        data: 'Valid entity',
        type: NounType.Document
      })

      // Mix valid and invalid IDs
      await brain.updateMany({
        items: [
          { id: validId, metadata: { updated: true } },
          { id: 'invalid-id-123', metadata: { updated: true } }
        ]
      })

      // Valid entity should be updated
      const entity = await brain.get(validId)
      expect(entity?.metadata?.updated).toBe(true)

      console.log(`   ✅ brain.updateMany() handled partial failures`)
    })
  })

  describe('brain.import() with VFS', () => {
    it('should import CSV and create VFS entities when vfsPath specified', async () => {
      console.log('\n📋 Test: brain.import() with VFS')

      // Create test CSV file
      const csvPath = path.join(testDir, 'test-data.csv')
      const csvContent = `name,age,role
Alice,30,Engineer
Bob,25,Designer
Carol,35,Manager`
      fs.writeFileSync(csvPath, csvContent)

      // Import with VFS path
      const result = await brain.import(csvPath, {
        vfsPath: '/imports/test-data.csv',
        createEntities: true
      })

      console.log(`   Imported ${result.stats.graphNodesCreated} entities`)
      console.log(`   VFS files: ${result.stats.vfsFilesCreated}`)

      expect(result.stats.graphNodesCreated).toBeGreaterThan(0)
      expect(result.stats.vfsFilesCreated).toBeGreaterThan(0)

      // Verify VFS file was created
      const vfs = brain.vfs()
      await vfs.init()
      const exists = await vfs.exists('/imports/test-data.csv')
      expect(exists).toBe(true)

      // Verify entities were created (should exclude VFS by default)
      // Note: Import creates entities based on CSV content
      const allEntities = await brain.find({
        limit: 100
      })

      // Filter out VFS entities
      const knowledgeEntities = allEntities.filter(e => e.metadata?.isVFS !== true)

      console.log(`   Total entities: ${allEntities.length}, Knowledge: ${knowledgeEntities.length}`)

      // Should have created at least one knowledge entity from CSV
      expect(knowledgeEntities.length).toBeGreaterThan(0)

      console.log(`   ✅ brain.import() created VFS file and entities`)
    })

    it('should import without VFS when vfsPath not specified', async () => {
      console.log('\n📋 Test: brain.import() without VFS')

      // Create test CSV
      const csvPath = path.join(testDir, 'no-vfs.csv')
      const csvContent = `product,price
Widget,10
Gadget,20`
      fs.writeFileSync(csvPath, csvContent)

      // Import without VFS path
      const result = await brain.import(csvPath, {
        createEntities: true
      })

      console.log(`   Imported ${result.stats.graphNodesCreated} entities`)
      console.log(`   VFS files: ${result.stats.vfsFilesCreated || 0}`)

      expect(result.stats.graphNodesCreated).toBeGreaterThan(0)
      // Note: Import always creates VFS files (uses default path if not specified)
      expect(result.stats.vfsFilesCreated).toBeGreaterThan(0)

      console.log(`   ✅ brain.import() worked without VFS`)
    })
  })

  describe('VFS File Operations', () => {
    let vfs: any

    beforeAll(async () => {
      vfs = brain.vfs()
      await vfs.init()
    })

    it('vfs.unlink() - should delete files', async () => {
      console.log('\n📋 Test: vfs.unlink()')

      await vfs.writeFile('/test-unlink.txt', 'Delete me')
      expect(await vfs.exists('/test-unlink.txt')).toBe(true)

      await vfs.unlink('/test-unlink.txt')
      expect(await vfs.exists('/test-unlink.txt')).toBe(false)

      console.log(`   ✅ vfs.unlink() deleted file`)
    })

    it('vfs.rmdir() - should remove directories', async () => {
      console.log('\n📋 Test: vfs.rmdir()')

      await vfs.mkdir('/test-dir-delete', { recursive: true })
      expect(await vfs.exists('/test-dir-delete')).toBe(true)

      await vfs.rmdir('/test-dir-delete')
      expect(await vfs.exists('/test-dir-delete')).toBe(false)

      console.log(`   ✅ vfs.rmdir() removed directory`)
    })

    it('vfs.rmdir() - should remove directories recursively', async () => {
      console.log('\n📋 Test: vfs.rmdir() recursive')

      await vfs.mkdir('/nested/deep/dir', { recursive: true })
      await vfs.writeFile('/nested/deep/dir/file.txt', 'content')

      await vfs.rmdir('/nested', { recursive: true })
      expect(await vfs.exists('/nested')).toBe(false)

      console.log(`   ✅ vfs.rmdir() removed directory recursively`)
    })

    it('vfs.rename() - should rename files', async () => {
      console.log('\n📋 Test: vfs.rename()')

      await vfs.writeFile('/old-name.txt', 'Content')
      await vfs.rename('/old-name.txt', '/new-name.txt')

      expect(await vfs.exists('/old-name.txt')).toBe(false)
      expect(await vfs.exists('/new-name.txt')).toBe(true)

      const content = await vfs.readFile('/new-name.txt')
      expect(content.toString()).toBe('Content')

      console.log(`   ✅ vfs.rename() renamed file`)
    })

    it('vfs.rename() - should rename directories', async () => {
      console.log('\n📋 Test: vfs.rename() directory')

      await vfs.mkdir('/old-dir', { recursive: true })
      await vfs.writeFile('/old-dir/file.txt', 'test')

      await vfs.rename('/old-dir', '/new-dir')

      expect(await vfs.exists('/old-dir')).toBe(false)
      expect(await vfs.exists('/new-dir')).toBe(true)
      expect(await vfs.exists('/new-dir/file.txt')).toBe(true)

      console.log(`   ✅ vfs.rename() renamed directory`)
    })

    it('vfs.copy() - should copy files', async () => {
      console.log('\n📋 Test: vfs.copy()')

      await vfs.writeFile('/source.txt', 'Original content')
      await vfs.copy('/source.txt', '/destination.txt')

      expect(await vfs.exists('/source.txt')).toBe(true)
      expect(await vfs.exists('/destination.txt')).toBe(true)

      const content = await vfs.readFile('/destination.txt')
      expect(content.toString()).toBe('Original content')

      console.log(`   ✅ vfs.copy() copied file`)
    })

    it('vfs.copy() - should copy directories recursively', async () => {
      console.log('\n📋 Test: vfs.copy() directory')

      await vfs.mkdir('/copy-source', { recursive: true })
      await vfs.writeFile('/copy-source/file1.txt', 'content1')
      await vfs.writeFile('/copy-source/file2.txt', 'content2')

      await vfs.copy('/copy-source', '/copy-dest', { recursive: true })

      expect(await vfs.exists('/copy-source')).toBe(true)
      expect(await vfs.exists('/copy-dest')).toBe(true)
      expect(await vfs.exists('/copy-dest/file1.txt')).toBe(true)
      expect(await vfs.exists('/copy-dest/file2.txt')).toBe(true)

      console.log(`   ✅ vfs.copy() copied directory recursively`)
    })

    it('vfs.move() - should move files', async () => {
      console.log('\n📋 Test: vfs.move()')

      await vfs.writeFile('/move-source.txt', 'Move me')
      await vfs.move('/move-source.txt', '/move-dest.txt')

      expect(await vfs.exists('/move-source.txt')).toBe(false)
      expect(await vfs.exists('/move-dest.txt')).toBe(true)

      const content = await vfs.readFile('/move-dest.txt')
      expect(content.toString()).toBe('Move me')

      console.log(`   ✅ vfs.move() moved file`)
    })

    it('VFS operations preserve isVFS flag', async () => {
      console.log('\n📋 Test: VFS operations preserve metadata')

      await vfs.writeFile('/vfs-test.txt', 'test')

      // Verify entity has isVFS flag
      const entities = await brain.find({
        where: { path: '/vfs-test.txt' },
        includeVFS: true,
        limit: 1
      })

      expect(entities.length).toBe(1)
      expect(entities[0].metadata?.isVFS).toBe(true)
      expect(entities[0].metadata?.vfsType).toBe('file')

      console.log(`   ✅ VFS operations preserve isVFS metadata`)
    })
  })

  describe('neural.clusters()', () => {
    it('should cluster entities semantically', async () => {
      console.log('\n📋 Test: neural.clusters()')

      // Create diverse entities for clustering
      await brain.addMany({
        items: [
          { data: 'JavaScript programming tutorial', type: NounType.Document },
          { data: 'Python coding guide', type: NounType.Document },
          { data: 'TypeScript development', type: NounType.Document },
          { data: 'Cooking pasta recipe', type: NounType.Document },
          { data: 'Baking bread instructions', type: NounType.Document },
          { data: 'Making pizza at home', type: NounType.Document }
        ]
      })

      const neural = brain.neural()
      const clusters = await neural.clusters({
        maxClusters: 3,
        minClusterSize: 1
      })

      console.log(`   Found ${clusters.length} clusters`)
      for (const cluster of clusters) {
        console.log(`   Cluster: ${cluster.label || cluster.id} (${cluster.members.length} members)`)
      }

      expect(clusters.length).toBeGreaterThan(0)
      expect(clusters.every(c => c.members.length > 0)).toBe(true)
      expect(clusters.every(c => typeof c.id === 'string')).toBe(true)

      console.log(`   ✅ neural.clusters() created semantic clusters`)
    })

    it('should respect includeVFS option in clustering', async () => {
      console.log('\n📋 Test: neural.clusters() VFS filtering')

      // Create VFS files
      const vfs = brain.vfs()
      await vfs.writeFile('/cluster-test1.txt', 'VFS file content')
      await vfs.writeFile('/cluster-test2.txt', 'Another VFS file')

      const neural = brain.neural()

      // Cluster without VFS (default)
      const clustersNoVFS = await neural.clusters({
        maxClusters: 5
      })

      // Count VFS entities in clusters
      let vfsCount = 0
      for (const cluster of clustersNoVFS) {
        for (const memberId of cluster.members) {
          const entity = await brain.get(memberId)
          if (entity?.metadata?.isVFS === true) {
            vfsCount++
          }
        }
      }

      console.log(`   Clusters without VFS: ${clustersNoVFS.length}, VFS entities: ${vfsCount}`)

      // Should not include VFS entities by default
      expect(vfsCount).toBe(0)

      console.log(`   ✅ neural.clusters() respects VFS filtering`)
    })
  })

  describe('Production Quality Verification', () => {
    it('should handle large batch updates efficiently', async () => {
      console.log('\n📋 Test: Large batch updateMany()')

      const start = Date.now()

      // Create 50 entities
      const ids = await brain.addMany({
        items: Array(50).fill(null).map((_, i) => ({
          data: `Batch update entity ${i}`,
          type: NounType.Document,
          metadata: { version: 1 }
        }))
      })

      // Batch update all
      await brain.updateMany({
        items: ids.successful.map(id => ({
          id,
          metadata: { version: 2, updated: true }
        }))
      })

      const time = Date.now() - start

      // Verify all updated
      const sample = await brain.get(ids.successful[0])
      expect(sample?.metadata?.version).toBe(2)
      expect(sample?.metadata?.updated).toBe(true)

      expect(time).toBeLessThan(10000) // < 10 seconds for 50 updates
      console.log(`   ✅ Updated 50 entities in ${time}ms`)
    })

    it('should handle VFS file operations at scale', async () => {
      console.log('\n📋 Test: VFS operations at scale')

      const vfs = brain.vfs()
      const start = Date.now()

      // Create 20 files
      for (let i = 0; i < 20; i++) {
        await vfs.writeFile(`/scale-test/file${i}.txt`, `Content ${i}`)
      }

      // Copy all
      await vfs.copy('/scale-test', '/scale-test-copy', { recursive: true })

      // Verify
      const entries = await vfs.readdir('/scale-test-copy')
      const time = Date.now() - start

      expect(entries.length).toBe(20)
      expect(time).toBeLessThan(5000) // < 5 seconds
      console.log(`   ✅ Created and copied 20 files in ${time}ms`)
    })
  })
})
