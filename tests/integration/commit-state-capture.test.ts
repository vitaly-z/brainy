/**
 * Commit State Capture Integration Tests (v5.4.0 Phase 1)
 *
 * Tests the new captureState parameter on commit() that enables
 * historical time-travel by capturing entity snapshots in trees.
 *
 * Tests:
 * 1. Backward compatibility (captureState: false uses NULL_HASH)
 * 2. State capture (captureState: true creates tree)
 * 3. Empty workspace handling
 * 4. Performance benchmarks (100, 1K, 10K entities)
 * 5. BlobStorage deduplication
 * 6. Tree structure validity
 * 7. Storage adapter compatibility
 * 8. VFS entity capture
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { Brainy } from '../../src/brainy.js'
import * as fs from 'fs'
import * as path from 'path'

const TEST_DATA_PATH = './test-commit-state-capture'

describe('Commit State Capture (v5.4.0)', () => {
  let brain: Brainy

  beforeEach(async () => {
    // Clean up test data
    if (fs.existsSync(TEST_DATA_PATH)) {
      fs.rmSync(TEST_DATA_PATH, { recursive: true, force: true })
    }
    fs.mkdirSync(TEST_DATA_PATH, { recursive: true })

    brain = new Brainy({
      storage: {
        adapter: 'filesystem',
        path: TEST_DATA_PATH
      },
      disableAutoRebuild: true,
      silent: true
    })

    await brain.init()
  })

  afterEach(() => {
    if (fs.existsSync(TEST_DATA_PATH)) {
      fs.rmSync(TEST_DATA_PATH, { recursive: true, force: true })
    }
  })

  it('should use NULL_HASH when captureState is false (backward compat)', async () => {
    console.log('\n📋 Test 1: Backward compatibility')

    // Add some entities
    await brain.add({ type: 'concept', data: { title: 'Test' } })

    // Commit WITHOUT captureState (default behavior)
    const commitId = await brain.commit({
      message: 'Test commit',
      captureState: false  // Explicit false
    })

    console.log(`   Commit ID: ${commitId.slice(0, 8)}`)

    // Read commit object
    const blobStorage = (brain.storage as any).blobStorage
    const { CommitObject } = await import('../../src/storage/cow/CommitObject.js')
    const { NULL_HASH } = await import('../../src/storage/cow/constants.js')

    const commit = await CommitObject.read(blobStorage, commitId)

    // Verify tree is NULL_HASH (empty)
    expect(commit.tree).toBe(NULL_HASH)
    console.log(`   ✅ Tree is NULL_HASH (backward compatible)`)
  })

  it('should use NULL_HASH when captureState is omitted (default)', async () => {
    console.log('\n📋 Test 2: Default behavior (captureState omitted)')

    await brain.add({ type: 'concept', data: { title: 'Test' } })

    // Commit WITHOUT captureState parameter (omitted = default)
    const commitId = await brain.commit({
      message: 'Test commit'
      // captureState not specified
    })

    const blobStorage = (brain.storage as any).blobStorage
    const { CommitObject } = await import('../../src/storage/cow/CommitObject.js')
    const { NULL_HASH } = await import('../../src/storage/cow/constants.js')

    const commit = await CommitObject.read(blobStorage, commitId)

    expect(commit.tree).toBe(NULL_HASH)
    console.log(`   ✅ Tree is NULL_HASH (default behavior)`)
  })

  it('should capture entity state when captureState is true', async () => {
    console.log('\n📋 Test 3: State capture enabled')

    // Add entities (add() returns entity ID, not entity object)
    const entity1Id = await brain.add({
      type: 'person',
      data: { name: 'Alice', age: 30 }
    })

    const entity2Id = await brain.add({
      type: 'concept',
      data: { title: 'AI', description: 'Artificial Intelligence' }
    })

    console.log(`   Added 2 entities: ${entity1Id.slice(0, 8)}, ${entity2Id.slice(0, 8)}`)

    // Commit WITH captureState
    const commitId = await brain.commit({
      message: 'Snapshot with entities',
      captureState: true  // CAPTURE STATE!
    })

    console.log(`   Commit ID: ${commitId.slice(0, 8)}`)

    // Read commit object
    const blobStorage = (brain.storage as any).blobStorage
    const { CommitObject } = await import('../../src/storage/cow/CommitObject.js')
    const { NULL_HASH, isNullHash } = await import('../../src/storage/cow/constants.js')

    const commit = await CommitObject.read(blobStorage, commitId)

    // Verify tree is NOT NULL_HASH
    expect(commit.tree).not.toBe(NULL_HASH)
    expect(isNullHash(commit.tree)).toBe(false)
    console.log(`   ✅ Tree is NOT NULL_HASH: ${commit.tree.slice(0, 8)}`)

    // Verify tree exists and can be read
    const { TreeObject } = await import('../../src/storage/cow/TreeObject.js')
    const tree = await TreeObject.read(blobStorage, commit.tree)

    expect(tree).toBeDefined()
    expect(tree.entries.length).toBeGreaterThan(0)
    console.log(`   ✅ Tree has ${tree.entries.length} entries`)

    // Verify entities are in tree
    let foundEntities = 0
    const entityNames: string[] = []
    for (const entry of tree.entries) {
      if (entry.name.startsWith('entities/')) {
        foundEntities++
        entityNames.push(entry.name)
      }
    }

    console.log(`   Found ${foundEntities} entities: ${entityNames.join(', ')}`)
    // At least 2 entities should be captured (the ones we added)
    // There may be system entities (VFS root, metadata, etc.)
    expect(foundEntities).toBeGreaterThanOrEqual(2)
    console.log(`   ✅ Found ${foundEntities} entities in tree (at least 2 as expected)`)
  })

  it('should handle empty workspace correctly', async () => {
    console.log('\n📋 Test 4: Empty workspace (no user entities)')

    // Check how many entities exist before commit
    const entitiesBefore = await brain.find({ excludeVFS: false })
    console.log(`   Entities before commit: ${entitiesBefore.length}`)

    // Commit with NO user-added entities
    const commitId = await brain.commit({
      message: 'Empty snapshot',
      captureState: true
    })

    const blobStorage = (brain.storage as any).blobStorage
    const { CommitObject } = await import('../../src/storage/cow/CommitObject.js')
    const { NULL_HASH, isNullHash } = await import('../../src/storage/cow/constants.js')

    const commit = await CommitObject.read(blobStorage, commitId)

    // If there were NO entities before commit, tree should be NULL_HASH
    // If there WERE entities (system entities), tree should contain them
    if (entitiesBefore.length === 0) {
      expect(commit.tree).toBe(NULL_HASH)
      console.log(`   ✅ No entities: tree is NULL_HASH (correct)`)
    } else {
      expect(isNullHash(commit.tree)).toBe(false)
      console.log(`   ✅ ${entitiesBefore.length} system entities captured in tree`)
    }
  })

  it('should perform well with small workspace (100 entities)', async () => {
    console.log('\n📋 Test 5: Performance - 100 entities')

    // Add 100 entities
    for (let i = 0; i < 100; i++) {
      await brain.add({
        type:'concept',
        data: { id: i, title: `Concept ${i}` }
      })
    }

    console.log(`   Added 100 entities`)

    // Measure commit time
    const start = Date.now()
    const commitId = await brain.commit({
      message: '100 entity snapshot',
      captureState: true
    })
    const duration = Date.now() - start

    console.log(`   Commit completed in ${duration}ms`)
    console.log(`   Commit ID: ${commitId.slice(0, 8)}`)

    // Should complete in < 1s
    expect(duration).toBeLessThan(1000)
    console.log(`   ✅ Performance: ${duration}ms < 1000ms`)
  })

  it('should deduplicate unchanged entities across commits', async () => {
    console.log('\n📋 Test 6: BlobStorage deduplication')

    // Add initial entities (add() returns entity IDs)
    const entity1Id = await brain.add({
      type:'person',
      data: { name: 'Alice', age: 30 }
    })

    const entity2Id = await brain.add({
      type:'person',
      data: { name: 'Bob', age: 25 }
    })

    // First commit with captureState
    const commit1Id = await brain.commit({
      message: 'First snapshot',
      captureState: true
    })

    console.log(`   Commit 1: ${commit1Id.slice(0, 8)}`)

    // Modify ONLY entity2
    await brain.update({
      id: entity2Id,
      data: { name: 'Bob', age: 26 }  // Changed age
    })

    // Second commit with captureState
    const commit2Id = await brain.commit({
      message: 'Second snapshot',
      captureState: true
    })

    console.log(`   Commit 2: ${commit2Id.slice(0, 8)}`)

    // Read both trees
    const blobStorage = (brain.storage as any).blobStorage
    const { CommitObject } = await import('../../src/storage/cow/CommitObject.js')
    const { TreeObject } = await import('../../src/storage/cow/TreeObject.js')

    const commit1 = await CommitObject.read(blobStorage, commit1Id)
    const commit2 = await CommitObject.read(blobStorage, commit2Id)

    const tree1 = await TreeObject.read(blobStorage, commit1.tree)
    const tree2 = await TreeObject.read(blobStorage, commit2.tree)

    // Find entity1 blob hash in both trees
    const entity1Entry1 = tree1.entries.find(e => e.name === `entities/${entity1Id}`)
    const entity1Entry2 = tree2.entries.find(e => e.name === `entities/${entity1Id}`)

    expect(entity1Entry1).toBeDefined()
    expect(entity1Entry2).toBeDefined()

    // entity1 unchanged, so blob hash should be SAME (deduplication!)
    expect(entity1Entry1!.hash).toBe(entity1Entry2!.hash)
    console.log(`   ✅ Unchanged entity1 has same blob hash (deduplicated)`)

    // Find entity2 blob hash in both trees
    const entity2Entry1 = tree1.entries.find(e => e.name === `entities/${entity2Id}`)
    const entity2Entry2 = tree2.entries.find(e => e.name === `entities/${entity2Id}`)

    expect(entity2Entry1).toBeDefined()
    expect(entity2Entry2).toBeDefined()

    // entity2 changed, so blob hash should be DIFFERENT
    expect(entity2Entry1!.hash).not.toBe(entity2Entry2!.hash)
    console.log(`   ✅ Changed entity2 has different blob hash (new version)`)
  })

  it('should create valid tree structure that can be read back', async () => {
    console.log('\n📋 Test 7: Tree structure validity')

    // Add entities (add() returns entity IDs)
    const entity1Id = await brain.add({
      type:'person',
      data: { name: 'Alice' }
    })

    const entity2Id = await brain.add({
      type:'concept',
      data: { title: 'AI' }
    })

    // Commit with captureState
    const commitId = await brain.commit({
      message: 'Test snapshot',
      captureState: true
    })

    // Read tree
    const blobStorage = (brain.storage as any).blobStorage
    const { CommitObject } = await import('../../src/storage/cow/CommitObject.js')
    const { TreeObject } = await import('../../src/storage/cow/TreeObject.js')

    const commit = await CommitObject.read(blobStorage, commitId)
    const tree = await TreeObject.read(blobStorage, commit.tree)

    // Verify tree structure
    expect(tree.entries).toBeDefined()
    expect(Array.isArray(tree.entries)).toBe(true)

    // Walk tree and deserialize entities
    let foundEntities = 0
    for await (const entry of TreeObject.walk(blobStorage, tree)) {
      if (entry.type !== 'blob' || !entry.name.startsWith('entities/')) {
        continue
      }

      // Read blob
      const blob = await blobStorage.read(entry.hash)
      const entity = JSON.parse(blob.toString())

      // Verify entity structure
      expect(entity).toHaveProperty('id')
      expect(entity).toHaveProperty('type')
      expect(entity).toHaveProperty('data')
      expect(entity).toHaveProperty('metadata')

      console.log(`   Found entity: ${entity.id.slice(0, 8)} (${entity.type})`)
      foundEntities++
    }

    // At least 2 entities should be found (the ones we added)
    expect(foundEntities).toBeGreaterThanOrEqual(2)
    console.log(`   ✅ Successfully walked tree and deserialized ${foundEntities} entities`)
  })

  it('should capture VFS entities along with regular entities', async () => {
    console.log('\n📋 Test 8: VFS entity capture')

    // Add regular entity (add() returns entity ID)
    const conceptId = await brain.add({
      type:'concept',
      data: { title: 'Test Concept' }
    })

    // Add VFS file
    await brain.vfs.init()
    await brain.vfs.writeFile('/test.md', 'Test content')

    console.log(`   Added concept: ${conceptId.slice(0, 8)}`)
    console.log(`   Added VFS file: /test.md`)

    // Commit with captureState
    const commitId = await brain.commit({
      message: 'Snapshot with VFS',
      captureState: true
    })

    // Read tree and verify both types of entities are captured
    const blobStorage = (brain.storage as any).blobStorage
    const { CommitObject } = await import('../../src/storage/cow/CommitObject.js')
    const { TreeObject } = await import('../../src/storage/cow/TreeObject.js')

    const commit = await CommitObject.read(blobStorage, commitId)
    const tree = await TreeObject.read(blobStorage, commit.tree)

    let regularEntities = 0
    let vfsEntities = 0

    for await (const entry of TreeObject.walk(blobStorage, tree)) {
      if (entry.type !== 'blob' || !entry.name.startsWith('entities/')) {
        continue
      }

      const blob = await blobStorage.read(entry.hash)
      const entity = JSON.parse(blob.toString())

      if (entity.metadata?.isVFS || entity.metadata?.vfsType) {
        vfsEntities++
        console.log(`   Found VFS entity: ${entity.metadata.path}`)
      } else {
        regularEntities++
        console.log(`   Found regular entity: ${entity.id.slice(0, 8)} (${entity.type})`)
      }
    }

    expect(regularEntities).toBeGreaterThanOrEqual(1)
    expect(vfsEntities).toBeGreaterThanOrEqual(2)  // File + root directory
    console.log(`   ✅ Captured ${regularEntities} regular + ${vfsEntities} VFS entities`)
  })

  it('should work with Memory storage adapter', async () => {
    console.log('\n📋 Test 9: Memory storage adapter')

    const memBrain = new Brainy({
      storage: { adapter: 'memory' },
      silent: true
    })

    await memBrain.init()

    // Add entity
    await memBrain.add({ type:'concept', data: { title: 'Test' } })

    // Commit with captureState
    const commitId = await memBrain.commit({
      message: 'Memory storage test',
      captureState: true
    })

    const blobStorage = (memBrain.storage as any).blobStorage
    const { CommitObject } = await import('../../src/storage/cow/CommitObject.js')
    const { isNullHash } = await import('../../src/storage/cow/constants.js')

    const commit = await CommitObject.read(blobStorage, commitId)

    expect(isNullHash(commit.tree)).toBe(false)
    console.log(`   ✅ Memory storage: tree captured successfully`)
  })

  it('should work with TypeAware storage adapter', async () => {
    console.log('\n📋 Test 10: TypeAware storage adapter')

    const testPath = './test-typeaware-commit-capture'

    if (fs.existsSync(testPath)) {
      fs.rmSync(testPath, { recursive: true, force: true })
    }

    const typeAwareBrain = new Brainy({
      storage: {
        adapter: 'typeaware',
        path: testPath
      },
      silent: true
    })

    await typeAwareBrain.init()

    // Add entity
    await typeAwareBrain.add({ type:'person', data: { name: 'Alice' } })

    // Commit with captureState
    const commitId = await typeAwareBrain.commit({
      message: 'TypeAware storage test',
      captureState: true
    })

    const blobStorage = (typeAwareBrain.storage as any).blobStorage
    const { CommitObject } = await import('../../src/storage/cow/CommitObject.js')
    const { isNullHash } = await import('../../src/storage/cow/constants.js')

    const commit = await CommitObject.read(blobStorage, commitId)

    expect(isNullHash(commit.tree)).toBe(false)
    console.log(`   ✅ TypeAware storage: tree captured successfully`)

    // Cleanup
    if (fs.existsSync(testPath)) {
      fs.rmSync(testPath, { recursive: true, force: true })
    }
  })

  it('should capture relationships along with entities', async () => {
    console.log('\n📋 Test 11: Relationship capture (CRITICAL FIX)')

    // Add entities
    const aliceId = await brain.add({
      type: 'person',
      data: { name: 'Alice', role: 'Developer' }
    })

    const bobId = await brain.add({
      type: 'person',
      data: { name: 'Bob', role: 'Designer' }
    })

    const projectId = await brain.add({
      type: 'concept',
      data: { title: 'Project X', description: 'AI Platform' }
    })

    console.log(`   Added 3 entities: Alice, Bob, Project X`)

    // Create relationships (using valid VerbTypes)
    await brain.relate({
      from: aliceId,
      to: projectId,
      type: 'relatedTo'  // Alice works on Project X
    })

    await brain.relate({
      from: bobId,
      to: projectId,
      type: 'relatedTo'  // Bob works on Project X
    })

    await brain.relate({
      from: aliceId,
      to: bobId,
      type: 'relatedTo'  // Alice collaborates with Bob
    })

    console.log(`   Created 3 relationships`)

    // Commit with captureState
    const commitId = await brain.commit({
      message: 'Snapshot with entities + relationships',
      captureState: true
    })

    console.log(`   Commit ID: ${commitId.slice(0, 8)}`)

    // Read tree and verify relationships are captured
    const blobStorage = (brain.storage as any).blobStorage
    const { CommitObject } = await import('../../src/storage/cow/CommitObject.js')
    const { TreeObject } = await import('../../src/storage/cow/TreeObject.js')

    const commit = await CommitObject.read(blobStorage, commitId)
    const tree = await TreeObject.read(blobStorage, commit.tree)

    // Count entities and relationships in tree
    let entityCount = 0
    let relationCount = 0

    for (const entry of tree.entries) {
      if (entry.name.startsWith('entities/')) {
        entityCount++
      } else if (entry.name.startsWith('relations/')) {
        relationCount++
      }
    }

    console.log(`   Tree contains: ${entityCount} entities, ${relationCount} relationships`)

    // Verify we have at least the entities and relationships we created
    expect(entityCount).toBeGreaterThanOrEqual(3)
    expect(relationCount).toBe(3)
    console.log(`   ✅ Relationships captured in tree!`)

    // Verify we can deserialize relationships from tree
    let deserializedRelations = 0
    for (const entry of tree.entries) {
      if (!entry.name.startsWith('relations/')) continue

      const blob = await blobStorage.read(entry.hash)
      const relation = JSON.parse(blob.toString())

      // Verify relationship structure
      expect(relation).toHaveProperty('sourceId')
      expect(relation).toHaveProperty('targetId')
      expect(relation).toHaveProperty('verb')

      console.log(`   Found relation: ${relation.verb} (${relation.sourceId.slice(0, 8)} → ${relation.targetId.slice(0, 8)})`)
      deserializedRelations++
    }

    expect(deserializedRelations).toBe(3)
    console.log(`   ✅ Successfully deserialized ${deserializedRelations} relationships from tree`)
  })
})
