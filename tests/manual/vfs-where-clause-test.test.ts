/**
 * VFS Where Clause Diagnostic
 *
 * The real issue: brain.find({ where: { 'metadata.path': '/' } }) returns 0 results
 * even though the root entity exists!
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { Brainy } from '../../src/brainy.js'
import * as fs from 'fs'
import * as path from 'path'

describe('VFS Where Clause Diagnostic', () => {
  const testDir = path.join(process.cwd(), 'test-where-clause')
  let brain: Brainy

  beforeAll(async () => {
    // Clean up
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true })
    }
    fs.mkdirSync(testDir, { recursive: true })

    brain = new Brainy({
      storage: {
        type: 'filesystem',
        path: testDir
      }
    })
    await brain.init()
  })

  afterAll(() => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true })
    }
  })

  it('should find root entity using where clause', async () => {
    const vfs = brain.vfs
    await vfs.init()

    // Method 1: Where clause (FIXED in v4.3.3!)
    console.log('\n📋 Method 1: Where clause (CORRECT field names)')
    const whereResult = await brain.find({
      where: {
        path: '/',           // ✅ Fixed: Use flat field name
        vfsType: 'directory' // ✅ Fixed: Use flat field name
      },
      limit: 10
    })
    console.log(`   Found ${whereResult.length} entities`)

    // Method 2: Find all and filter (what actually works)
    console.log('\n📋 Method 2: Find all + filter')
    const allEntities = await brain.find({ limit: 100 })
    console.log(`   Total entities: ${allEntities.length}`)

    const filtered = allEntities.filter(e =>
      e.metadata?.path === '/' &&
      e.metadata?.vfsType === 'directory'
    )
    console.log(`   Filtered to roots: ${filtered.length}`)

    if (filtered.length > 0) {
      console.log(`   Root entity:`)
      console.log(`      ID: ${filtered[0].id}`)
      console.log(`      Type: ${filtered[0].type}`)
      console.log(`      Metadata.path: ${filtered[0].metadata?.path}`)
      console.log(`      Metadata.vfsType: ${filtered[0].metadata?.vfsType}`)
    }

    // Method 3: Type-based search
    console.log('\n📋 Method 3: Type query (collection)')
    const typeResult = await brain.find({
      type: 'collection',
      limit: 10
    })
    console.log(`   Found ${typeResult.length} collection entities`)

    // FIXED (v4.3.3): Where clause now works with correct field names!
    expect(whereResult.length).toBe(1)  // ✅ WHERE CLAUSE WORKS NOW!
    expect(filtered.length).toBe(1)     // ✅ MANUAL FILTER ALSO WORKS
  })

  it('should find regular VFS files using where clause', async () => {
    const vfs = brain.vfs
    await vfs.mkdir('/test', { recursive: true })
    await vfs.writeFile('/test/hello.txt', 'Hello World')

    // Try to find the file using where clause (FIXED field names)
    console.log('\n📋 Finding /test/hello.txt')

    const whereResult = await brain.find({
      where: {
        path: '/test/hello.txt',  // ✅ Fixed: Use flat field name
        vfsType: 'file'           // ✅ Fixed: Use flat field name
      },
      limit: 10
    })
    console.log(`   Where clause: ${whereResult.length} results`)

    const allEntities = await brain.find({ limit: 100 })
    const filtered = allEntities.filter(e =>
      e.metadata?.path === '/test/hello.txt'
    )
    console.log(`   Manual filter: ${filtered.length} results`)

    if (filtered.length > 0) {
      console.log(`   File metadata:`)
      console.log(`      Path: ${filtered[0].metadata?.path}`)
      console.log(`      VfsType: ${filtered[0].metadata?.vfsType}`)
      console.log(`      Name: ${filtered[0].metadata?.name}`)
    }

    // FIXED (v4.3.3): Where clause works with correct field names!
    expect(whereResult.length).toBe(1)  // ✅ FIXED!
    expect(filtered.length).toBe(1)     // ✅ ALSO WORKS
  })

  it('should show metadata index status', async () => {
    console.log('\n📋 Metadata Index Status')

    const allEntities = await brain.find({ limit: 100 })
    console.log(`   Total entities: ${allEntities.length}`)

    const withMetadata = allEntities.filter(e => e.metadata && Object.keys(e.metadata).length > 0)
    console.log(`   With metadata: ${withMetadata.length}`)

    const withPath = allEntities.filter(e => e.metadata?.path)
    console.log(`   With metadata.path: ${withPath.length}`)

    const withVfsType = allEntities.filter(e => e.metadata?.vfsType)
    console.log(`   With metadata.vfsType: ${withVfsType.length}`)

    // Show sample metadata
    if (withPath.length > 0) {
      console.log(`\n   Sample entity with path:`)
      const sample = withPath[0]
      console.log(`      ID: ${sample.id}`)
      console.log(`      Type: ${sample.type}`)
      console.log(`      Metadata keys: ${Object.keys(sample.metadata || {}).join(', ')}`)
    }
  })
})
