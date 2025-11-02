/**
 * VFS Debug Test - Minimal reproduction to find the issue
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { Brainy } from '../../src/brainy.js'
import * as XLSX from 'xlsx'

describe('VFS Debug', () => {
  it('minimal VFS writeFile test', async () => {
    const brain = new Brainy({ storage: { type: 'memory' } })
    await brain.init()

    console.log('✅ Brain initialized')

    // Get VFS and initialize
    const vfs = brain.vfs
    await vfs.init()

    console.log('✅ VFS initialized')

    // Write a single file
    await vfs.writeFile('/test.txt', 'Hello World')

    console.log('✅ File written')

    // Check if entity exists using find()
    const allEntities = await brain.find({ limit: 100 })
    console.log(`📊 Total entities (via find): ${allEntities.length}`)

    console.log('Entities from find() - CHECKING STRUCTURE:')
    allEntities.forEach((e, i) => {
      console.log(`  ${i+1}. Result object keys: ${Object.keys(e).join(', ')}`)
      console.log(`      e.id: ${e.id}`)
      console.log(`      e.score: ${(e as any).score}`)
      console.log(`      e.entity: ${(e as any).entity ? 'EXISTS' : 'MISSING'}`)
      if ((e as any).entity) {
        console.log(`      e.entity.type: ${(e as any).entity.type}`)
        console.log(`      e.entity.metadata: ${JSON.stringify((e as any).entity.metadata)}`)
      }
      console.log(`      e.type (direct): ${e.type}`)
      console.log(`      e.metadata (direct): ${JSON.stringify(e.metadata)}`)
    })

    const vfsEntities = allEntities.filter(e => e.metadata?.vfsType)
    console.log(`📊 VFS entities (via find): ${vfsEntities.length}`)

    // Now try getting entities directly
    console.log('\nChecking entities directly with brain.get():')
    for (const entity of allEntities) {
      const direct = await brain.get(entity.id)
      if (direct) {
        console.log(`  ${direct.id}:`)
        console.log(`    metadata: ${JSON.stringify(direct.metadata)}`)
        if (direct.metadata?.vfsType) {
          console.log(`    ✅ HAS vfsType: ${direct.metadata.vfsType}`)
        }
      }
    }

    // Try reading the file
    const content = await vfs.readFile('/test.txt')
    console.log(`\n📄 File content: "${content.toString()}"`)

    // Try VFS directory listing
    console.log('\n📂 VFS Directory Listing:')
    const rootContents = await vfs.readdir('/')
    console.log(`  Root contents: ${rootContents.join(', ')}`)

    // Try getDirectChildren (Workshop's method)
    const children = await vfs.getDirectChildren('/')
    console.log(`  Direct children: ${children.length}`)
    children.forEach(child => {
      console.log(`    - ${child.metadata.name} (${child.metadata.vfsType})`)
    })

    // THE REAL TEST: Can we query VFS?
    expect(children.length).toBeGreaterThan(0)
    expect(rootContents.length).toBeGreaterThan(0)
  })
})
