/**
 * Simple VFS filtering test
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { Brainy } from '../../src/brainy.js'
import { NounType } from '../../src/types/graphTypes.js'
import * as fs from 'fs'
import * as path from 'path'

describe('Simple VFS Filter Test', () => {
  const testDir = path.join(process.cwd(), 'test-simple-vfs-filter')
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

  it('should demonstrate VFS filtering', async () => {
    console.log('\n=== TEST START ===\n')

    // 1. Create knowledge entity
    console.log('1. Creating knowledge entity...')
    const knowledgeId = await brain.add({
      data: 'Knowledge document',
      type: NounType.Document,
      metadata: { title: 'Knowledge' }
    })
    console.log(`   Created: ${knowledgeId}`)

    // 2. Create VFS file
    console.log('\n2. Creating VFS file...')
    const vfs = brain.vfs()
    await vfs.init()
    await vfs.writeFile('/test.txt', 'VFS file')
    console.log('   VFS file created')

    // 3. Query all (should exclude VFS)
    console.log('\n3. Query: brain.find({}) [excludes VFS by default]')
    const all = await brain.find({ limit: 100 })
    console.log(`   Results: ${all.length}`)
    for (const r of all) {
      console.log(`     - ${r.id}, type: ${r.type}, isVFS: ${r.metadata?.isVFS}, title: ${r.metadata?.title}`)
    }

    // 4. Query all with VFS
    console.log('\n4. Query: brain.find({ includeVFS: true })')
    const allWithVFS = await brain.find({ includeVFS: true, limit: 100 })
    console.log(`   Results: ${allWithVFS.length}`)
    for (const r of allWithVFS) {
      console.log(`     - ${r.id}, type: ${r.type}, isVFS: ${r.metadata?.isVFS}, path: ${r.metadata?.path || 'n/a'}`)
    }

    // 5. Query by type (should exclude VFS)
    console.log('\n5. Query: brain.find({ type: NounType.Document }) [excludes VFS]')
    const docs = await brain.find({ type: NounType.Document, limit: 100 })
    console.log(`   Results: ${docs.length}`)
    for (const r of docs) {
      console.log(`     - ${r.id}, type: ${r.type}, isVFS: ${r.metadata?.isVFS}`)
    }

    // 6. Query by type with VFS
    console.log('\n6. Query: brain.find({ type: NounType.Document, includeVFS: true })' )
    const docsWithVFS = await brain.find({ type: NounType.Document, includeVFS: true, limit: 100 })
    console.log(`   Results: ${docsWithVFS.length}`)
    for (const r of docsWithVFS) {
      console.log(`     - ${r.id}, type: ${r.type}, isVFS: ${r.metadata?.isVFS}, path: ${r.metadata?.path || 'n/a'}`)
    }

    console.log('\n=== TEST END ===\n')

    // Assertions
    expect(all.length).toBe(1) // Only knowledge entity
    expect(all.some(r => r.id === knowledgeId)).toBe(true)

    expect(allWithVFS.length).toBeGreaterThanOrEqual(2) // Knowledge + VFS entities

    expect(docs.length).toBe(1) // Only knowledge entity
    expect(docs.some(r => r.id === knowledgeId)).toBe(true)

    expect(docsWithVFS.length).toBeGreaterThanOrEqual(2) // Knowledge + VFS file (both documents)
  })
})
