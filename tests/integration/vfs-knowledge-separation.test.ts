/**
 * VFS-Knowledge Separation Test (v4.3.3)
 *
 * Tests Option 3C Architecture:
 * - VFS entities marked with isVFS: true
 * - brain.find() excludes VFS by default
 * - brain.find({ includeVFS: true }) includes VFS
 * - Enables relationships between VFS and knowledge
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { Brainy } from '../../src/brainy.js'
import { NounType } from '../../src/types/graphTypes.js'
import * as fs from 'fs'
import * as path from 'path'

describe('VFS-Knowledge Separation (Option 3C)', () => {
  const testDir = path.join(process.cwd(), 'test-vfs-knowledge-separation')
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

  it('should exclude VFS entities from brain.find() by default', async () => {
    // Create VFS file entity
    const vfs = brain.vfs()
    await vfs.init()
    await vfs.mkdir('/docs', { recursive: true })
    await vfs.writeFile('/docs/readme.md', '# Hello World')

    // Create knowledge entity (no isVFS flag)
    const knowledgeId = await brain.add({
      data: 'This is a knowledge document about AI',
      type: NounType.Document,
      metadata: {
        title: 'AI Research Paper',
        category: 'research'
      }
    })

    // Query for documents WITHOUT includeVFS
    console.log('\n📋 Test 1: brain.find() excludes VFS by default')
    const results = await brain.find({
      type: NounType.Document,
      limit: 100
    })

    console.log(`   Total results: ${results.length}`)
    const vfsResults = results.filter(r => r.metadata?.isVFS === true)
    const knowledgeResults = results.filter(r => r.metadata?.isVFS !== true)

    console.log(`   VFS results: ${vfsResults.length}`)
    console.log(`   Knowledge results: ${knowledgeResults.length}`)

    // Should only return knowledge entities (no VFS)
    expect(vfsResults.length).toBe(0)
    expect(knowledgeResults.length).toBeGreaterThan(0)
    expect(results.some(r => r.id === knowledgeId)).toBe(true)
  })

  it('should include VFS entities when includeVFS: true', async () => {
    console.log('\n📋 Test 2: brain.find({ includeVFS: true }) includes VFS')

    // Query WITH includeVFS: true
    const results = await brain.find({
      type: NounType.Document,
      includeVFS: true,
      limit: 100
    })

    console.log(`   Total results: ${results.length}`)
    const vfsResults = results.filter(r => r.metadata?.isVFS === true)
    const knowledgeResults = results.filter(r => r.metadata?.isVFS !== true)

    console.log(`   VFS results: ${vfsResults.length}`)
    console.log(`   Knowledge results: ${knowledgeResults.length}`)

    // Should return BOTH VFS and knowledge entities
    expect(vfsResults.length).toBeGreaterThan(0)
    expect(knowledgeResults.length).toBeGreaterThan(0)
  })

  it('should allow relationships between VFS files and knowledge entities', async () => {
    console.log('\n📋 Test 3: VFS-Knowledge relationships')

    // Get VFS file entity (need includeVFS: true when querying VFS by path)
    const vfsFile = await brain.find({
      where: {
        path: '/docs/readme.md'
      },
      includeVFS: true,
      limit: 1
    })
    expect(vfsFile.length).toBe(1)

    // Get knowledge entity
    const knowledgeEntity = await brain.find({
      type: NounType.Document,
      where: {
        title: 'AI Research Paper'
      },
      limit: 1
    })
    expect(knowledgeEntity.length).toBe(1)

    // Create relationship: knowledge entity -> references -> VFS file
    const relation = await brain.relate({
      from: knowledgeEntity[0].id,
      to: vfsFile[0].id,
      type: 'references'
    })

    console.log(`   Created relation: ${relation.id}`)
    console.log(`   From: ${knowledgeEntity[0].metadata?.title} (knowledge)`)
    console.log(`   To: ${vfsFile[0].metadata?.path} (VFS file)`)

    // Verify relationship exists
    const relations = await brain.getRelations({
      from: knowledgeEntity[0].id,
      to: vfsFile[0].id
    })

    expect(relations.length).toBe(1)
    expect(relations[0].type).toBe('references')
    console.log(`   ✅ Relationship verified: knowledge can reference VFS files`)
  })

  it('should filter VFS entities using where clause', async () => {
    console.log('\n📋 Test 4: Where clause filtering with isVFS')

    // Query for VFS files explicitly
    const vfsFiles = await brain.find({
      where: {
        isVFS: true,
        vfsType: 'file'
      },
      limit: 100
    })

    console.log(`   VFS files found: ${vfsFiles.length}`)
    expect(vfsFiles.length).toBeGreaterThan(0)
    expect(vfsFiles.every(f => f.metadata?.isVFS === true)).toBe(true)
    expect(vfsFiles.every(f => f.metadata?.vfsType === 'file')).toBe(true)

    // Query for non-VFS entities explicitly
    const nonVFS = await brain.find({
      where: {
        category: 'research'
      },
      limit: 100
    })

    console.log(`   Non-VFS entities found: ${nonVFS.length}`)
    expect(nonVFS.length).toBeGreaterThan(0)
    expect(nonVFS.every(e => e.metadata?.isVFS !== true)).toBe(true)
  })

  it('should handle semantic search with VFS filtering', async () => {
    console.log('\n📋 Test 5: Semantic search excludes VFS by default')

    // Semantic search WITHOUT includeVFS (should exclude VFS files)
    const results = await brain.find({
      query: 'research paper artificial intelligence',
      limit: 10
    })

    console.log(`   Semantic results: ${results.length}`)
    const hasVFS = results.some(r => r.metadata?.isVFS === true)
    console.log(`   Contains VFS entities: ${hasVFS}`)

    // Should NOT include VFS files in semantic search by default
    expect(hasVFS).toBe(false)

    // Semantic search WITH includeVFS: true
    const resultsWithVFS = await brain.find({
      query: 'hello world markdown',
      includeVFS: true,
      limit: 10
    })

    console.log(`   Semantic results (with VFS): ${resultsWithVFS.length}`)
    const hasVFSWithFlag = resultsWithVFS.some(r => r.metadata?.isVFS === true)
    console.log(`   Contains VFS entities: ${hasVFSWithFlag}`)

    // Should include VFS files when explicitly requested
    expect(hasVFSWithFlag).toBe(true)
  })
})
