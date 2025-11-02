/**
 * Diagnostic: Check if isVFS flag is actually being stored
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { Brainy } from '../../src/brainy.js'
import { NounType } from '../../src/types/graphTypes.js'
import * as fs from 'fs'
import * as path from 'path'

describe('isVFS Flag Diagnostic', () => {
  const testDir = path.join(process.cwd(), 'test-isvfs-diagnostic')
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

  it('should show what entities are created', async () => {
    // Create VFS file
    const vfs = brain.vfs
    await vfs.init()
    await vfs.writeFile('/test.txt', 'Hello World')

    // Get ALL entities
    console.log('\n📋 All entities in database:')
    const allEntities = await brain.find({ limit: 100, includeVFS: true })
    console.log(`   Total: ${allEntities.length}`)

    for (const entity of allEntities) {
      console.log(`\n   Entity: ${entity.id}`)
      console.log(`      Type: ${entity.type}`)
      console.log(`      Metadata keys: ${Object.keys(entity.metadata || {}).join(', ')}`)
      if (entity.metadata?.path) {
        console.log(`      Path: ${entity.metadata.path}`)
      }
      if (entity.metadata?.vfsType) {
        console.log(`      VfsType: ${entity.metadata.vfsType}`)
      }
      if (entity.metadata?.isVFS !== undefined) {
        console.log(`      isVFS: ${entity.metadata.isVFS}`)
      }
      if (entity.metadata?.name) {
        console.log(`      Name: ${entity.metadata.name}`)
      }
    }

    // Try different queries
    console.log('\n\n📋 Query 1: brain.find({ limit: 100 }) [default, no includeVFS]')
    const query1 = await brain.find({ limit: 100 })
    console.log(`   Results: ${query1.length}`)

    console.log('\n📋 Query 2: brain.find({ limit: 100, includeVFS: true })')
    const query2 = await brain.find({ limit: 100, includeVFS: true })
    console.log(`   Results: ${query2.length}`)

    console.log('\n📋 Query 3: brain.find({ where: { isVFS: true } })')
    const query3 = await brain.find({ where: { isVFS: true }, limit: 100 })
    console.log(`   Results: ${query3.length}`)

    console.log('\n📋 Query 4: brain.find({ where: { path: "/test.txt" } })')
    const query4 = await brain.find({ where: { path: '/test.txt' }, limit: 100 })
    console.log(`   Results: ${query4.length}`)

    console.log('\n📋 Query 5: brain.find({ type: NounType.Document })')
    const query5 = await brain.find({ type: NounType.Document, limit: 100 })
    console.log(`   Results: ${query5.length}`)

    console.log('\n📋 Query 6: brain.find({ type: NounType.Document, includeVFS: true })')
    const query6 = await brain.find({ type: NounType.Document, includeVFS: true, limit: 100 })
    console.log(`   Results: ${query6.length}`)
  })
})
