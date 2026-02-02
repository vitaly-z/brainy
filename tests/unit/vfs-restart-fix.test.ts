/**
 * Regression test: VFS data persists across restart (close + reopen)
 *
 * Verifies the fix for GraphAdjacencyIndex.flush() and LSMTree.get()
 * which previously caused graph relationships to be lost on restart
 * because LSM MemTables were never flushed to SSTables on close.
 */
import { describe, it, expect } from 'vitest'
import { Brainy } from '../../src/brainy.js'
import { VerbType } from '../../src/types/graphTypes.js'
import { mkdirSync, rmSync } from 'fs'

describe('VFS restart persistence', () => {
  it('entities and relationships survive close + reopen', async () => {
    const dir = '/tmp/brainy-restart-fix-' + Date.now()
    mkdirSync(dir, { recursive: true })

    let entityId: string | undefined
    const rootId = '00000000-0000-0000-0000-000000000000'

    try {
      // === SESSION 1: Write data ===
      let brain = new Brainy({
        storage: { type: 'filesystem', rootDirectory: dir },
        disableAutoRebuild: true,
        plugins: [],
        silent: true,
      })
      await brain.init()

      await brain.vfs.writeFile('/chapter-1.txt', 'Once upon a time...')

      entityId = await brain.vfs.resolvePathToId('/chapter-1.txt')
      expect(entityId).toBeTruthy()

      // Verify within same session — entity, readdir, and relations
      const entity1 = await brain.get(entityId!)
      expect(entity1).not.toBeNull()

      const entries1 = await brain.vfs.readdir('/')
      expect(entries1.length).toBeGreaterThan(0)

      // In-session getRelations: root should have Contains relationship to the file
      const relations1 = await brain.getRelations({ from: rootId, type: VerbType.Contains })
      expect(relations1.length).toBeGreaterThan(0)

      await brain.close()

      // === SESSION 2: Read data after restart ===
      brain = new Brainy({
        storage: { type: 'filesystem', rootDirectory: dir },
        disableAutoRebuild: true,
        plugins: [],
        silent: true,
      })
      await brain.init()

      // Entity should be retrievable
      const entity2 = await brain.get(entityId!)
      expect(entity2).not.toBeNull()

      // Root entity should exist
      const rootEntity = await brain.get(rootId)
      expect(rootEntity).not.toBeNull()

      // readdir should return the file
      const entries2 = await brain.vfs.readdir('/')
      expect(entries2.length).toBeGreaterThan(0)
      expect(entries2).toContain('chapter-1.txt')

      // getRelations should find the Contains relationship
      const relations2 = await brain.getRelations({ from: rootId, type: VerbType.Contains })
      expect(relations2.length).toBeGreaterThan(0)

      await brain.close()
    } finally {
      try { rmSync(dir, { recursive: true }) } catch {}
    }
  })

  it('multiple files and subdirectories survive restart', async () => {
    const dir = '/tmp/brainy-restart-multi-' + Date.now()
    mkdirSync(dir, { recursive: true })

    const rootId = '00000000-0000-0000-0000-000000000000'

    try {
      // === SESSION 1: Write multiple files ===
      let brain = new Brainy({
        storage: { type: 'filesystem', rootDirectory: dir },
        disableAutoRebuild: true,
        plugins: [],
        silent: true,
      })
      await brain.init()

      await brain.vfs.writeFile('/readme.txt', 'Project readme')
      await brain.vfs.writeFile('/docs/guide.txt', 'User guide')
      await brain.vfs.writeFile('/docs/api.txt', 'API reference')

      const entries1 = await brain.vfs.readdir('/')
      expect(entries1.length).toBe(2) // readme.txt + docs/

      const docEntries1 = await brain.vfs.readdir('/docs')
      expect(docEntries1.length).toBe(2) // guide.txt + api.txt

      // In-session getRelations: root should have Contains relationships
      const rootRelations1 = await brain.getRelations({ from: rootId, type: VerbType.Contains })
      expect(rootRelations1.length).toBeGreaterThan(0)

      await brain.close()

      // === SESSION 2: Verify all data persisted ===
      brain = new Brainy({
        storage: { type: 'filesystem', rootDirectory: dir },
        disableAutoRebuild: true,
        plugins: [],
        silent: true,
      })
      await brain.init()

      // Root children
      const entries2 = await brain.vfs.readdir('/')
      expect(entries2.length).toBe(2)
      expect(entries2.sort()).toEqual(['docs', 'readme.txt'])

      // Subdirectory children
      const docEntries2 = await brain.vfs.readdir('/docs')
      expect(docEntries2.length).toBe(2)
      expect(docEntries2.sort()).toEqual(['api.txt', 'guide.txt'])

      // Root relations
      const rootRelations = await brain.getRelations({ from: rootId, type: VerbType.Contains })
      expect(rootRelations.length).toBeGreaterThan(0)

      await brain.close()
    } finally {
      try { rmSync(dir, { recursive: true }) } catch {}
    }
  })
})
