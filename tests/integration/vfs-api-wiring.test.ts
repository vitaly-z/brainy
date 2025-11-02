/**
 * VFS API Wiring Verification Test (v4.4.0)
 *
 * Verifies ALL VFS-related APIs properly use includeVFS parameter
 * This test catches "created but not wired up" bugs
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { Brainy } from '../../src/brainy.js'
import { NounType } from '../../src/types/graphTypes.js'
import * as fs from 'fs'
import * as path from 'path'

describe('VFS API Wiring Verification', () => {
  const testDir = path.join(process.cwd(), 'test-vfs-api-wiring')
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

  it('should verify brain.similar() properly filters VFS', async () => {
    console.log('\n📋 Test 1: brain.similar() VFS filtering')

    // Create knowledge entity
    const knowledgeId = await brain.add({
      data: 'Knowledge about TypeScript',
      type: NounType.Document,
      metadata: { topic: 'programming' }
    })

    // Create VFS file
    const vfs = brain.vfs
    await vfs.init()
    await vfs.writeFile('/typescript.md', 'TypeScript programming guide')

    // Test 1a: similar() WITHOUT includeVFS (should exclude VFS)
    const similarWithoutVFS = await brain.similar({
      to: knowledgeId,
      limit: 10
    })

    console.log(`   similar() without includeVFS: ${similarWithoutVFS.length} results`)
    const hasVFS1 = similarWithoutVFS.some(r => r.metadata?.isVFS === true)
    console.log(`   Contains VFS: ${hasVFS1}`)

    expect(hasVFS1).toBe(false) // Should NOT include VFS

    // Test 1b: similar() WITH includeVFS: true (should include VFS)
    const similarWithVFS = await brain.similar({
      to: knowledgeId,
      limit: 10,
      includeVFS: true
    })

    console.log(`   similar() with includeVFS: ${similarWithVFS.length} results`)
    const hasVFS2 = similarWithVFS.some(r => r.metadata?.isVFS === true)
    console.log(`   Contains VFS: ${hasVFS2}`)

    expect(hasVFS2).toBe(true) // SHOULD include VFS
    expect(similarWithVFS.length).toBeGreaterThan(similarWithoutVFS.length)
  })

  it('should verify vfs.search() finds VFS files', async () => {
    console.log('\n📋 Test 2: vfs.search() finds VFS files')

    const vfs = brain.vfs
    await vfs.init()  // Required before using VFS operations

    // Create test files
    await vfs.writeFile('/docs/readme.md', 'Project documentation')
    await vfs.writeFile('/docs/api.md', 'API reference guide')

    // Search for files
    const results = await vfs.search('documentation', { limit: 10 })

    console.log(`   VFS search results: ${results.length}`)
    if (results.length > 0) {
      console.log(`   First result structure:`, JSON.stringify(results[0], null, 2))
      // Check for results without path
      const noPaths = results.filter(r => !r.path)
      if (noPaths.length > 0) {
        console.log(`   ⚠️ ${noPaths.length} results without path:`, noPaths.map(r => ({ entityId: r.entityId, path: r.path })))
      }
    }

    expect(results.length).toBeGreaterThan(0) // Should find VFS files
    // Verify all results are valid VFS search results with path property
    expect(results.every(r => typeof r.path === 'string' && r.path.length > 0)).toBe(true)
    expect(results.every(r => typeof r.entityId === 'string')).toBe(true)
    expect(results.some(r => r.path.includes('readme'))).toBe(true)
  })

  it('should verify vfs.findSimilar() finds similar VFS files', async () => {
    console.log('\n📋 Test 3: vfs.findSimilar() finds similar VFS files')

    const vfs = brain.vfs
    await vfs.init()  // Required before using VFS operations

    // Create similar files
    await vfs.writeFile('/code/server.ts', 'Server implementation')
    await vfs.writeFile('/code/client.ts', 'Client implementation')
    await vfs.writeFile('/code/utils.ts', 'Utility functions')

    // Find files similar to server.ts
    const similar = await vfs.findSimilar('/code/server.ts', { limit: 10 })

    console.log(`   Similar files: ${similar.length}`)
    if (similar.length > 0) {
      console.log(`   First result structure:`, JSON.stringify(similar[0], null, 2))
      // Check for results without path
      const noPaths = similar.filter(r => !r.path)
      if (noPaths.length > 0) {
        console.log(`   ⚠️ ${noPaths.length} results without path:`, noPaths.map(r => ({ entityId: r.entityId, path: r.path })))
      }
    }

    expect(similar.length).toBeGreaterThan(0) // Should find similar VFS files
    // Verify all results are valid VFS search results with path property
    expect(similar.every(r => typeof r.path === 'string' && r.path.length > 0)).toBe(true)
    expect(similar.every(r => typeof r.entityId === 'string')).toBe(true)
    // Should find at least one of our created files
    expect(similar.some(r => r.path.includes('/code/'))).toBe(true)
  })

  it('should verify vfs.searchEntities() finds VFS entities', async () => {
    console.log('\n📋 Test 4: vfs.searchEntities() finds VFS entities')

    const vfs = brain.vfs
    await vfs.init()  // Required before using VFS operations

    // Create entity in VFS (if supported)
    await vfs.mkdir('/entities', { recursive: true })

    // Search for entities
    const results = await vfs.searchEntities({
      type: 'entity',
      limit: 10
    })

    console.log(`   VFS entity search results: ${results.length}`)

    // Should work without errors (even if no entities exist yet)
    expect(Array.isArray(results)).toBe(true)
  })

  it('should verify VFS semantic projections work', async () => {
    console.log('\n📋 Test 5: VFS semantic projections')

    const vfs = brain.vfs
    await vfs.init()  // Required before using VFS operations

    // Create files with metadata for projections
    await vfs.writeFile('/project/feature.ts', 'Feature implementation', {
      extractMetadata: false  // Manual metadata
    })

    // Get the file entity and update with tags/owner
    const fileResults = await brain.find({
      where: { path: '/project/feature.ts' },
      includeVFS: true,
      limit: 1
    })

    if (fileResults.length > 0) {
      const fileId = fileResults[0].id

      // Add metadata for semantic projections
      await brain.update({
        id: fileId,
        metadata: {
          ...fileResults[0].metadata,
          tags: ['typescript', 'feature'],
          owner: 'developer1'
        }
      })

      // Test tag-based query
      const tagResults = await brain.find({
        where: {
          vfsType: 'file',
          tags: { contains: 'typescript' }
        },
        includeVFS: true,
        limit: 10
      })

      console.log(`   Tag-based search: ${tagResults.length} results`)
      expect(tagResults.length).toBeGreaterThan(0)

      // Test owner-based query
      const ownerResults = await brain.find({
        where: {
          vfsType: 'file',
          owner: 'developer1'
        },
        includeVFS: true,
        limit: 10
      })

      console.log(`   Owner-based search: ${ownerResults.length} results`)
      expect(ownerResults.length).toBeGreaterThan(0)
    }
  })

  it('should verify knowledge graph stays clean (no VFS by default)', async () => {
    console.log('\n📋 Test 6: Knowledge graph cleanliness')

    // Query knowledge graph (should exclude VFS)
    const knowledge = await brain.find({
      type: [NounType.Document, NounType.File],
      limit: 100
    })

    const vfsCount = knowledge.filter(r => r.metadata?.isVFS === true).length
    const knowledgeCount = knowledge.filter(r => r.metadata?.isVFS !== true).length

    console.log(`   Knowledge entities: ${knowledgeCount}`)
    console.log(`   VFS entities leaked: ${vfsCount}`)

    // Knowledge graph should be clean (no VFS)
    expect(vfsCount).toBe(0)
    expect(knowledgeCount).toBeGreaterThan(0)
  })

  it('should verify VFS-knowledge relationships work', async () => {
    console.log('\n📋 Test 7: VFS-knowledge relationships')

    // Create knowledge entity
    const conceptId = await brain.add({
      data: 'Server architecture concept',
      type: NounType.Concept,
      metadata: { category: 'architecture' }
    })

    // Get VFS file
    const vfsFile = await brain.find({
      where: { path: '/code/server.ts' },
      includeVFS: true,
      limit: 1
    })

    if (vfsFile.length > 0) {
      // Create relationship: concept -> implements -> file
      const relationId = await brain.relate({
        from: conceptId,
        to: vfsFile[0].id,
        type: 'implements'
      })

      console.log(`   Created relation: ${relationId}`)

      // Verify relationship exists
      const relations = await brain.getRelations({
        from: conceptId,
        to: vfsFile[0].id
      })

      expect(relations.length).toBe(1)
      expect(relations[0].type).toBe('implements')
      console.log(`   ✅ VFS-knowledge relationship verified`)
    }
  })

  it('should verify production scale performance', async () => {
    console.log('\n📋 Test 8: Production scale performance')

    const vfs = brain.vfs
    await vfs.init()  // Required before using VFS operations

    // Create batch of files
    const createStart = Date.now()
    for (let i = 0; i < 50; i++) {
      await vfs.writeFile(`/batch/file${i}.txt`, `Content ${i}`)
    }
    const createTime = Date.now() - createStart
    console.log(`   Created 50 files in ${createTime}ms`)

    // Search performance
    const searchStart = Date.now()
    const searchResults = await vfs.search('Content', { limit: 100 })
    const searchTime = Date.now() - searchStart
    console.log(`   Searched in ${searchTime}ms, found ${searchResults.length} results`)

    // Metadata query performance (uses O(log n) index)
    const metaStart = Date.now()
    const metaResults = await brain.find({
      where: { vfsType: 'file' },
      includeVFS: true,
      limit: 100
    })
    const metaTime = Date.now() - metaStart
    console.log(`   Metadata query in ${metaTime}ms, found ${metaResults.length} results`)

    // Performance assertions (should be fast even with many entities)
    expect(searchTime).toBeLessThan(1000) // < 1 second
    expect(metaTime).toBeLessThan(500) // < 500ms (O(log n) index)
    expect(searchResults.length).toBeGreaterThan(0)
    expect(metaResults.length).toBeGreaterThan(50)
  })
})
