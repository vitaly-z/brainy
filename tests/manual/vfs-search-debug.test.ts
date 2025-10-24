/**
 * Debug VFS search to understand what's being returned
 */

import { describe, it, beforeAll, afterAll } from 'vitest'
import { Brainy } from '../../src/brainy.js'
import * as fs from 'fs'
import * as path from 'path'

describe('VFS Search Debug', () => {
  const testDir = path.join(process.cwd(), 'test-vfs-search-debug')
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

  it('should debug vfs.search() results', async () => {
    const vfs = brain.vfs()
    await vfs.init()
    await vfs.writeFile('/test.txt', 'Hello world test content')

    console.log('\n📋 VFS Search Debug')

    // Search
    const results = await vfs.search('test', { limit: 10 })

    console.log(`Results: ${results.length}`)
    console.log('Result structure:', JSON.stringify(results[0], null, 2))

    // Also check raw brain.find
    const brainResults = await brain.find({
      where: { vfsType: 'file' },
      includeVFS: true,
      limit: 10
    })

    console.log(`\nDirect brain.find results: ${brainResults.length}`)
    if (brainResults.length > 0) {
      console.log('Brain result entity:', JSON.stringify({
        id: brainResults[0].id,
        type: brainResults[0].type,
        metadata: brainResults[0].metadata
      }, null, 2))
    }
  })
})
