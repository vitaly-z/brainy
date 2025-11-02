/**
 * VFS Multiple Init() Diagnostic Test
 *
 * Tests Workshop team's issue: Does calling vfs.init() multiple times
 * create duplicate root entities?
 *
 * Scenario:
 * - Create brain instance
 * - Call vfs.init() multiple times (simulating multiple requests)
 * - Check if multiple root entities are created
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { Brainy } from '../../src/brainy.js'
import * as fs from 'fs'
import * as path from 'path'

describe('VFS Multiple Init Diagnostic', () => {
  const testDir = path.join(process.cwd(), 'test-vfs-multi-init')
  let brain: Brainy

  beforeAll(async () => {
    // Clean up test directory
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true })
    }
    fs.mkdirSync(testDir, { recursive: true })

    // Create brain with filesystem storage
    brain = new Brainy({
      storage: {
        type: 'filesystem',
        path: testDir
      }
    })
    await brain.init()
  })

  afterAll(() => {
    // Clean up
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true })
    }
  })

  it('should not create duplicate roots when calling vfs.init() multiple times on SAME instance', async () => {
    const vfs = brain.vfs

    // Call init multiple times
    await vfs.init()
    await vfs.init()
    await vfs.init()

    // Query for root entities using workaround (where clause is broken)
    const collections = await brain.find({
      type: 'collection',
      limit: 100
    })

    const roots = collections.filter(e =>
      e.metadata?.path === '/' &&
      e.metadata?.vfsType === 'directory'
    )

    console.log(`\n✅ Test 1: Same VFS instance`)
    console.log(`   Total collections: ${collections.length}`)
    console.log(`   Roots found: ${roots.length}`)
    roots.forEach((root, i) => {
      console.log(`   Root ${i + 1}: ${root.id}`)
    })

    expect(roots.length).toBe(1)
  })

  it('should not create duplicate roots when creating MULTIPLE VFS instances (Workshop scenario)', async () => {
    // Simulate Workshop's scenario: Getting VFS on multiple requests
    // brain.vfs returns cached instance, so this should be safe
    const vfs1 = brain.vfs
    const vfs2 = brain.vfs
    const vfs3 = brain.vfs

    await vfs1.init()
    await vfs2.init()
    await vfs3.init()

    // Query for root entities using workaround
    const collections = await brain.find({
      type: 'collection',
      limit: 100
    })

    const roots = collections.filter(e =>
      e.metadata?.path === '/' &&
      e.metadata?.vfsType === 'directory'
    )

    console.log(`\n✅ Test 2: Multiple VFS references (cached)`)
    console.log(`   VFS instances are same? ${vfs1 === vfs2 && vfs2 === vfs3}`)
    console.log(`   Roots found: ${roots.length}`)
    roots.forEach((root, i) => {
      console.log(`   Root ${i + 1}: ${root.id}`)
    })

    expect(vfs1).toBe(vfs2)  // Should be same instance (cached)
    expect(roots.length).toBe(1)  // Should still be 1 root
  })

  it('should handle NEW brain instances gracefully (per-user scenario)', async () => {
    // Simulate creating separate brain instances per user
    // This is closer to Workshop's getUserBrainy() pattern
    const brain2 = new Brainy({
      storage: {
        type: 'filesystem',
        path: testDir  // Same storage!
      }
    })
    await brain2.init()

    const vfs2 = brain2.vfs()
    await vfs2.init()

    // Query for roots using workaround
    const collections = await brain.find({
      type: 'collection',
      limit: 100
    })

    const roots = collections.filter(e =>
      e.metadata?.path === '/' &&
      e.metadata?.vfsType === 'directory'
    )

    console.log(`\n✅ Test 3: New Brainy instance (same storage)`)
    console.log(`   Roots found: ${roots.length}`)
    roots.forEach((root, i) => {
      console.log(`   Root ${i + 1}: ${root.id} (created: ${root.metadata?.createdAt})`)
    })

    // This is the CRITICAL test - should find existing root, not create new one
    expect(roots.length).toBe(1)
  })

  it('should verify readdir works after multiple inits', async () => {
    // Create a test directory
    const vfs = brain.vfs
    await vfs.mkdir('/test-dir', { recursive: true })
    await vfs.writeFile('/test-dir/test.txt', 'Hello')

    // Call init again (simulating new request)
    const brain3 = new Brainy({
      storage: {
        type: 'filesystem',
        path: testDir
      }
    })
    await brain3.init()
    const vfs3 = brain3.vfs()
    await vfs3.init()

    // Try to read root directory
    const entries = await vfs3.readdir('/', { withFileTypes: true })

    console.log(`\n✅ Test 4: readdir after new brain instance`)
    console.log(`   Entries found: ${entries.length}`)
    entries.forEach((entry: any) => {
      console.log(`   - ${entry.name} (${entry.type})`)
    })

    expect(entries.length).toBeGreaterThan(0)
  })

  it('should show if Contains relationships are created', async () => {
    const vfs = brain.vfs

    // Get root entity ID using workaround
    const collections = await brain.find({
      type: 'collection',
      limit: 100
    })

    const roots = collections.filter(e =>
      e.metadata?.path === '/' &&
      e.metadata?.vfsType === 'directory'
    )

    expect(roots.length).toBeGreaterThanOrEqual(1)
    const rootId = roots[0].id

    // Check for Contains relationships FROM root
    const relations = await brain.getRelations({
      from: rootId
    })

    console.log(`\n✅ Test 5: Contains relationships`)
    console.log(`   Root ID: ${rootId}`)
    console.log(`   Relationships from root: ${relations.length}`)
    relations.forEach((rel) => {
      console.log(`   - ${rel.from} -> ${rel.to} (${rel.type})`)
    })

    // Root should have at least one Contains relationship (to /test-dir)
    const containsRels = relations.filter(r => r.type === 'contains')
    console.log(`   Contains relationships: ${containsRels.length}`)

    expect(containsRels.length).toBeGreaterThan(0)
  })
})
