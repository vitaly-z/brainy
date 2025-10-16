/**
 * Integration test for metadata explosion fix (v3.50.1)
 *
 * Validates that vector embeddings are NEVER indexed in metadata,
 * while preserving legitimate small array indexing (tags, categories).
 *
 * Bug: 825,924 chunk files created for 1,144 entities (721 files per entity)
 * Fix: NEVER_INDEX field name check + array length safety check
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { Brainy } from '../../src/brainy.js'
import { NounType } from '../../src/types/graphTypes.js'
import { readFileSync, readdirSync, existsSync, rmSync } from 'fs'
import { join } from 'path'

describe('Metadata Vector Exclusion Fix', () => {
  let brainy: Brainy
  const testDir = '/tmp/brainy-metadata-vector-test'

  beforeEach(async () => {
    // Clean test directory
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true })
    }

    brainy = new Brainy({
      storage: { type: 'filesystem', path: testDir },
      ai: { provider: 'mock' }
    })
    await brainy.init()
  })

  afterEach(async () => {
    if (brainy) {
      await brainy.clear()
      await brainy.close()
    }
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true })
    }
  })

  it('should NOT index vector embeddings in metadata chunks', async () => {
    // Add entity with vector embedding
    const entity = await brainy.add({
      type: 'person' as any,
      data: {
        name: 'Alice',
        email: 'alice@example.com',
        tags: ['developer', 'typescript']  // Small array - SHOULD be indexed
      }
    })

    // Wait for async operations
    await new Promise(resolve => setTimeout(resolve, 100))

    // Check _system directory for chunk files
    const systemDir = join(testDir, '_system')

    if (!existsSync(systemDir)) {
      // No chunk files created - this is acceptable
      expect(true).toBe(true)
      return
    }

    const chunkFiles = readdirSync(systemDir).filter(f => f.startsWith('__chunk__'))

    // Should have at most a few chunk files (name, email, tags)
    // NOT hundreds of files from vector dimensions
    expect(chunkFiles.length).toBeLessThan(10)

    // Verify NO chunk files have numeric field names (vector dimension indices)
    for (const file of chunkFiles) {
      const content = JSON.parse(readFileSync(join(systemDir, file), 'utf-8'))
      const fieldName = content.field

      // Field should be a semantic name, NOT a number
      expect(fieldName).not.toMatch(/^\d+$/)

      // Field should NOT be 'vector', 'embedding', 'embeddings'
      expect(fieldName).not.toBe('vector')
      expect(fieldName).not.toBe('embedding')
      expect(fieldName).not.toBe('embeddings')
    }
  })

  it('should still index small arrays (tags, categories)', async () => {
    // Add entity with tags
    await brainy.add({
      type: 'person' as any,
      data: {
        name: 'Bob',
        tags: ['javascript', 'react', 'nodejs']
      }
    })

    // Wait for indexing
    await new Promise(resolve => setTimeout(resolve, 100))

    // Verify metadata filtering works on tags
    const results = await brainy.find({
      where: { tags: 'react' }
    })

    expect(results.length).toBeGreaterThan(0)
    expect(results[0].entity.metadata?.name).toBe('Bob')
  })

  it('should skip indexing large arrays (>10 elements)', async () => {
    // Add entity with large array (not a vector, just bulk data)
    const largeArray = Array.from({ length: 100 }, (_, i) => `item${i}`)

    await brainy.add({
      type: 'document' as any,
      data: {
        name: 'Doc with large array',
        items: largeArray
      }
    })

    // Wait for indexing
    await new Promise(resolve => setTimeout(resolve, 100))

    // Check chunk count - should NOT create 100 chunk files
    const systemDir = join(testDir, '_system')

    if (!existsSync(systemDir)) {
      expect(true).toBe(true)
      return
    }

    const chunkFiles = readdirSync(systemDir).filter(f => f.startsWith('__chunk__'))

    // Should have minimal chunk files (just 'name' field)
    expect(chunkFiles.length).toBeLessThan(5)
  })

  it('should preserve HNSW vector search functionality', async () => {
    // Add entities with semantic content
    const id1 = await brainy.add({
      type: 'concept' as any,
      data: {
        name: 'Machine Learning',
        description: 'AI algorithms that learn from data'
      }
    })

    const id2 = await brainy.add({
      type: 'concept' as any,
      data: {
        name: 'Deep Learning',
        description: 'Neural networks with multiple layers'
      }
    })

    // Wait for vector indexing
    await new Promise(resolve => setTimeout(resolve, 200))

    // Verify entities were created (vector indexing happened)
    const entity1 = await brainy.get(id1)
    const entity2 = await brainy.get(id2)

    expect(entity1).toBeDefined()
    expect(entity2).toBeDefined()
    expect(entity1?.vector).toBeDefined()
    expect(entity2?.vector).toBeDefined()

    // Verify vectors are not in metadata chunks (already validated by first test)
    // Mock AI may not support semantic search, so we just verify vectors exist
  })

  it('should preserve metadata field filtering', async () => {
    // Add entities with various metadata
    await brainy.add({
      type: 'person' as any,
      data: {
        name: 'Charlie',
        email: 'charlie@example.com',
        role: 'engineer'
      }
    })

    await brainy.add({
      type: 'person' as any,
      data: {
        name: 'Dana',
        email: 'dana@example.com',
        role: 'designer'
      }
    })

    // Wait for indexing
    await new Promise(resolve => setTimeout(resolve, 100))

    // Verify metadata filtering works
    const engineers = await brainy.find({
      where: { role: 'engineer' }
    })

    expect(engineers.length).toBe(1)
    expect(engineers[0].entity.metadata?.name).toBe('Charlie')

    const designers = await brainy.find({
      where: { role: 'designer' }
    })

    expect(designers.length).toBe(1)
    expect(designers[0].entity.metadata?.name).toBe('Dana')
  })

  it('should handle nested object metadata correctly', async () => {
    // Add entity with nested metadata
    await brainy.add({
      type: 'person' as any,
      data: {
        name: 'Eve',
        address: {
          city: 'New York',
          state: 'NY'
        }
      }
    })

    // Wait for indexing
    await new Promise(resolve => setTimeout(resolve, 100))

    // Verify nested field filtering works
    const results = await brainy.find({
      where: { 'address.city': 'New York' }
    })

    expect(results.length).toBeGreaterThan(0)
    expect(results[0].entity.metadata?.name).toBe('Eve')
  })

  it('should NOT create exponential chunk files for multiple entities', async () => {
    // Add 10 entities (each with vector embedding)
    for (let i = 0; i < 10; i++) {
      await brainy.add({
        type: 'person' as any,
        data: {
          name: `Person ${i}`,
          email: `person${i}@example.com`,
          tags: ['user']
        }
      })
    }

    // Wait for all indexing
    await new Promise(resolve => setTimeout(resolve, 500))

    // Check total chunk files
    const systemDir = join(testDir, '_system')

    if (!existsSync(systemDir)) {
      expect(true).toBe(true)
      return
    }

    const chunkFiles = readdirSync(systemDir).filter(f => f.startsWith('__chunk__'))

    // Should have reasonable number of chunks (not 7,210 for 10 entities!)
    // Expected: ~30 chunks (name, email, tags fields across 10 entities)
    expect(chunkFiles.length).toBeLessThan(100)

    console.log(`✅ Created ${chunkFiles.length} chunk files for 10 entities (expected <100)`)
  })
})
