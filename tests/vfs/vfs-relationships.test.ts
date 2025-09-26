/**
 * Test VFS Graph Relationships
 *
 * Verifies that VFS properly uses Brainy's graph relationships
 * instead of metadata-based path queries
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { VirtualFileSystem } from '../../src/vfs/VirtualFileSystem.js'
import { Brainy } from '../../src/brainy.js'
import { VerbType } from '../../src/types/graphTypes.js'

describe('VFS Graph Relationships', () => {
  let vfs: VirtualFileSystem
  let brain: Brainy

  beforeEach(async () => {
    brain = new Brainy()
    await brain.init()
    vfs = new VirtualFileSystem(brain)
    await vfs.init()
  })

  it('should use proper graph relationships for directory structure', async () => {
    // Create a directory structure
    await vfs.mkdir('/projects')
    await vfs.mkdir('/projects/brainy')
    await vfs.writeFile('/projects/brainy/README.md', 'Test content')
    await vfs.writeFile('/projects/brainy/package.json', '{}')

    // Get the entity IDs
    const projectsId = await vfs.resolvePath('/projects')
    const brainyId = await vfs.resolvePath('/projects/brainy')
    const readmeId = await vfs.resolvePath('/projects/brainy/README.md')

    // Verify relationships are created properly
    const projectRelations = await brain.getRelations({
      from: projectsId,
      type: VerbType.Contains
    })

    expect(projectRelations).toHaveLength(1)
    expect(projectRelations[0].to).toBe(brainyId)

    // Verify brainy directory contains its files
    const brainyRelations = await brain.getRelations({
      from: brainyId,
      type: VerbType.Contains
    })

    expect(brainyRelations).toHaveLength(2)
    const childIds = brainyRelations.map(r => r.to)
    expect(childIds).toContain(readmeId)
  })

  it('should traverse directory tree using relationships', async () => {
    // Create nested structure
    await vfs.mkdir('/a')
    await vfs.mkdir('/a/b')
    await vfs.mkdir('/a/b/c')
    await vfs.writeFile('/a/b/c/file.txt', 'deep file')

    // Read directory using relationships
    const contents = await vfs.readdir('/a/b/c')
    expect(contents).toContain('file.txt')

    // Verify path resolution uses graph traversal
    const fileId = await vfs.resolvePath('/a/b/c/file.txt')
    const fileEntity = await brain.get(fileId)
    expect(fileEntity?.metadata?.name).toBe('file.txt')
  })

  it('should properly handle custom relationships between files', async () => {
    // Create two files
    await vfs.writeFile('/doc1.md', 'Document 1')
    await vfs.writeFile('/doc2.md', 'Document 2')

    // Add a custom relationship
    await vfs.addRelationship('/doc1.md', '/doc2.md', VerbType.References)

    // Get relationships using proper graph API
    const relationships = await vfs.getRelationships('/doc1.md')

    // Should find the reference relationship
    const refRelation = relationships.find(r => r.type === VerbType.References)
    expect(refRelation).toBeDefined()

    // Verify it's using actual graph relationships, not metadata
    const doc1Id = await vfs.resolvePath('/doc1.md')
    const doc2Id = await vfs.resolvePath('/doc2.md')

    const directRelations = await brain.getRelations({
      from: doc1Id,
      type: VerbType.References
    })

    expect(directRelations).toHaveLength(1)
    expect(directRelations[0].to).toBe(doc2Id)
  })

  it('should not fall back to metadata path queries', async () => {
    // Create a file
    await vfs.writeFile('/test.txt', 'test')

    // Get the entity
    const entity = await vfs.getEntity('/test.txt')

    // Verify the entity has proper metadata
    expect(entity.metadata.path).toBe('/test.txt')
    expect(entity.metadata.name).toBe('test.txt')

    // But the parent relationship should be through graph, not metadata
    const rootId = await vfs.resolvePath('/')
    const testId = entity.id

    // Check that root contains test.txt via relationships
    const rootRelations = await brain.getRelations({
      from: rootId,
      type: VerbType.Contains
    })

    expect(rootRelations.some(r => r.to === testId)).toBe(true)
  })

  it('should efficiently query children using relationships', async () => {
    // Create many files in a directory
    await vfs.mkdir('/many')
    for (let i = 0; i < 10; i++) {
      await vfs.writeFile(`/many/file${i}.txt`, `content ${i}`)
    }

    // Get directory contents
    const files = await vfs.readdir('/many')
    expect(files).toHaveLength(10)

    // Verify it's using relationships, not metadata queries
    const manyId = await vfs.resolvePath('/many')
    const relations = await brain.getRelations({
      from: manyId,
      type: VerbType.Contains
    })

    expect(relations).toHaveLength(10)
  })

  it('should handle moving files by updating relationships', async () => {
    // Create source structure
    await vfs.mkdir('/source')
    await vfs.writeFile('/source/file.txt', 'content')
    await vfs.mkdir('/dest')

    // Move file
    await vfs.move('/source/file.txt', '/dest/file.txt')

    // Verify relationships are updated
    const sourceId = await vfs.resolvePath('/source')
    const destId = await vfs.resolvePath('/dest')
    const fileId = await vfs.resolvePath('/dest/file.txt')

    // Source should not contain file anymore
    const sourceRelations = await brain.getRelations({
      from: sourceId,
      type: VerbType.Contains
    })
    expect(sourceRelations).toHaveLength(0)

    // Dest should contain file
    const destRelations = await brain.getRelations({
      from: destId,
      type: VerbType.Contains
    })
    expect(destRelations).toHaveLength(1)
    expect(destRelations[0].to).toBe(fileId)
  })

  it('should support complex graph queries', async () => {
    // Create interconnected structure
    await vfs.mkdir('/docs')
    await vfs.writeFile('/docs/main.md', 'Main doc')
    await vfs.writeFile('/docs/related1.md', 'Related 1')
    await vfs.writeFile('/docs/related2.md', 'Related 2')

    // Add cross-references
    await vfs.addRelationship('/docs/main.md', '/docs/related1.md', VerbType.References)
    await vfs.addRelationship('/docs/main.md', '/docs/related2.md', VerbType.References)
    await vfs.addRelationship('/docs/related1.md', '/docs/related2.md', VerbType.References)

    // Get all related documents
    const related = await vfs.getRelated('/docs/main.md')

    // Should find parent (Contains) and references
    const references = related.filter(r => r.direction === 'from')
    expect(references.length).toBeGreaterThanOrEqual(2)
  })

  it('should always create Contains relationship when writing files', async () => {
    // This test verifies the fix for the critical bug where writeFile()
    // was not creating Contains relationships for updated files

    // Test 1: New file should have Contains relationship
    await vfs.writeFile('/test-new.txt', 'Hello World')

    const rootId = await vfs.resolvePath('/')
    const fileEntityId = await vfs.resolvePath('/test-new.txt')

    // Check that Contains relationship exists
    const relations = await brain.getRelations({
      from: rootId,
      to: fileEntityId,
      type: VerbType.Contains
    })

    expect(relations).toHaveLength(1)
    expect(relations[0].type).toBe(VerbType.Contains)

    // Verify readdir returns the file
    const files = await vfs.readdir('/')
    expect(files).toContain('test-new.txt')

    // Test 2: Updated file should maintain Contains relationship
    await vfs.writeFile('/test-new.txt', 'Updated content')

    // Relationship should still exist after update
    const relationsAfterUpdate = await brain.getRelations({
      from: rootId,
      to: fileEntityId,
      type: VerbType.Contains
    })

    expect(relationsAfterUpdate).toHaveLength(1)

    // readdir should still work
    const filesAfterUpdate = await vfs.readdir('/')
    expect(filesAfterUpdate).toContain('test-new.txt')

    // Test 3: Multiple updates should not create duplicate relationships
    await vfs.writeFile('/test-new.txt', 'Another update')
    await vfs.writeFile('/test-new.txt', 'Yet another update')

    const finalRelations = await brain.getRelations({
      from: rootId,
      to: fileEntityId,
      type: VerbType.Contains
    })

    // Should still have exactly one Contains relationship
    expect(finalRelations).toHaveLength(1)
  })

  it('should repair missing Contains relationships on file update', async () => {
    // This test simulates a scenario where a file exists but its Contains
    // relationship is missing (could happen due to corruption or bugs)

    // Create a file normally first
    await vfs.writeFile('/orphan-test.txt', 'Initial content')

    const rootId = await vfs.resolvePath('/')
    const fileEntityId = await vfs.resolvePath('/orphan-test.txt')

    // Manually delete the Contains relationship to simulate the bug
    const initialRelations = await brain.getRelations({
      from: rootId,
      to: fileEntityId,
      type: VerbType.Contains
    })

    // Delete the relationship (simulating the corruption/bug)
    for (const rel of initialRelations) {
      await brain.unrelate(rel.id)
    }

    // Verify the relationship is gone
    const brokenRelations = await brain.getRelations({
      from: rootId,
      to: fileEntityId,
      type: VerbType.Contains
    })
    expect(brokenRelations).toHaveLength(0)

    // readdir should fail to find the file (the bug symptom)
    const brokenList = await vfs.readdir('/')
    expect(brokenList).not.toContain('orphan-test.txt')

    // Now update the file - this should repair the missing relationship
    await vfs.writeFile('/orphan-test.txt', 'Fixed content')

    // Verify the relationship is restored
    const fixedRelations = await brain.getRelations({
      from: rootId,
      to: fileEntityId,
      type: VerbType.Contains
    })

    expect(fixedRelations).toHaveLength(1)
    expect(fixedRelations[0].type).toBe(VerbType.Contains)

    // readdir should now work again
    const fixedList = await vfs.readdir('/')
    expect(fixedList).toContain('orphan-test.txt')
  })

  it('should create Contains relationships for files in nested directories', async () => {
    // Test that the fix works for nested directory structures

    await vfs.mkdir('/level1')
    await vfs.mkdir('/level1/level2')
    await vfs.mkdir('/level1/level2/level3')

    // Write a file deep in the structure
    await vfs.writeFile('/level1/level2/level3/deep.txt', 'Deep content')

    // Get entity IDs
    const level3Id = await vfs.resolvePath('/level1/level2/level3')
    const fileEntityId = await vfs.resolvePath('/level1/level2/level3/deep.txt')

    // Verify Contains relationship exists
    const relations = await brain.getRelations({
      from: level3Id,
      to: fileEntityId,
      type: VerbType.Contains
    })

    expect(relations).toHaveLength(1)

    // Verify readdir works at the deep level
    const files = await vfs.readdir('/level1/level2/level3')
    expect(files).toContain('deep.txt')

    // Update the file and verify relationship persists
    await vfs.writeFile('/level1/level2/level3/deep.txt', 'Updated deep content')

    const relationsAfterUpdate = await brain.getRelations({
      from: level3Id,
      to: fileEntityId,
      type: VerbType.Contains
    })

    expect(relationsAfterUpdate).toHaveLength(1)

    // readdir should still work
    const filesAfterUpdate = await vfs.readdir('/level1/level2/level3')
    expect(filesAfterUpdate).toContain('deep.txt')
  })
})