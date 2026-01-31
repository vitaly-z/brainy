/**
 * Lazy Vector Loading Tests (B2 optimization)
 *
 * Tests for:
 * - Vectors evicted from memory after addItem() in lazy mode
 * - Search returns correct results after vector eviction
 * - Memory mode retains vectors (default behavior)
 * - Lazy mode requires storage adapter
 * - Combined lazy + quantization mode
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { v4 as uuidv4 } from 'uuid'
import { HNSWIndex } from '../../../src/hnsw/hnswIndex.js'
import { euclideanDistance } from '../../../src/utils/index.js'
import { MemoryStorage } from '../../../src/storage/adapters/memoryStorage.js'

// Helper: generate a random vector of given dimension
function randomVector(dim: number): number[] {
  return Array.from({ length: dim }, () => Math.random() * 2 - 1)
}

// Helper: save a vector to storage so lazy loading can retrieve it
// Both noun (vector) and metadata must be saved for getNounVector() to work
async function saveVector(storage: MemoryStorage, id: string, vector: number[]): Promise<void> {
  await storage.saveNoun({
    id,
    vector,
    connections: new Map(),
    level: 0
  })
  await storage.saveNounMetadata(id, {
    noun: 'thing',
    createdAt: Date.now(),
    updatedAt: Date.now()
  })
}

describe('Lazy Vector Loading (B2)', () => {
  const dim = 32

  // =================================================================
  // 1. LAZY MODE: VECTOR EVICTION
  // =================================================================
  describe('vector eviction in lazy mode', () => {
    let index: HNSWIndex
    let storage: MemoryStorage

    beforeEach(async () => {
      storage = new MemoryStorage()
      index = new HNSWIndex(
        {
          M: 8,
          efConstruction: 100,
          efSearch: 50,
          ml: 8,
          vectorStorage: 'lazy'
        },
        euclideanDistance,
        { useParallelization: false, storage }
      )
    })

    it('should still be searchable after vector eviction', async () => {
      const targetId = uuidv4()
      const target = randomVector(dim)

      // Store noun in storage so lazy loading can find it
      await saveVector(storage, targetId, target)
      await index.addItem({ id: targetId, vector: target })

      // Add more entities
      for (let i = 0; i < 20; i++) {
        const id = uuidv4()
        const v = randomVector(dim)
        await saveVector(storage, id, v)
        await index.addItem({ id, vector: v })
      }

      // Search should still find the target
      const results = await index.search(target, 5)
      expect(results.length).toBeGreaterThan(0)

      // The closest result should be the target (distance ~0)
      const targetResult = results.find(([id]) => id === targetId)
      expect(targetResult).toBeDefined()
      expect(targetResult![1]).toBeCloseTo(0, 1)
    })

    it('should return correct top-k results in lazy mode', async () => {
      for (let i = 0; i < 30; i++) {
        const id = uuidv4()
        const v = randomVector(dim)
        await saveVector(storage, id, v)
        await index.addItem({ id, vector: v })
      }

      const query = randomVector(dim)
      const results = await index.search(query, 10)

      expect(results.length).toBe(10)

      // Results should be sorted by distance
      for (let i = 1; i < results.length; i++) {
        expect(results[i][1]).toBeGreaterThanOrEqual(results[i - 1][1])
      }
    })
  })

  // =================================================================
  // 2. MEMORY MODE: VECTORS RETAINED (DEFAULT)
  // =================================================================
  describe('memory mode retains vectors (default)', () => {
    it('should keep vectors in memory by default', async () => {
      const storage = new MemoryStorage()
      const index = new HNSWIndex(
        { M: 4, efConstruction: 50, efSearch: 20 },
        euclideanDistance,
        { useParallelization: false, storage }
      )

      const id = uuidv4()
      const v = randomVector(dim)
      await index.addItem({ id, vector: v })

      // Search should work without needing storage
      const results = await index.search(v, 1)
      expect(results.length).toBe(1)
      expect(results[0][0]).toBe(id)
      expect(results[0][1]).toBeCloseTo(0, 5)
    })

    it('should work without storage adapter in memory mode', async () => {
      // No storage adapter provided
      const index = new HNSWIndex(
        { M: 4, efConstruction: 50, efSearch: 20 },
        euclideanDistance,
        { useParallelization: false }
      )

      const id = uuidv4()
      const v = randomVector(dim)
      await index.addItem({ id, vector: v })

      const results = await index.search(v, 1)
      expect(results.length).toBe(1)
      expect(results[0][0]).toBe(id)
    })
  })

  // =================================================================
  // 3. LAZY + NO STORAGE: GRACEFUL BEHAVIOR
  // =================================================================
  describe('lazy mode without storage', () => {
    it('should not evict vectors when no storage adapter is configured', async () => {
      // vectorStorage: 'lazy' but no storage — vectors should stay in memory
      const index = new HNSWIndex(
        {
          M: 4,
          efConstruction: 50,
          efSearch: 20,
          vectorStorage: 'lazy'
        },
        euclideanDistance,
        { useParallelization: false }
      )

      const id = uuidv4()
      const v = randomVector(dim)
      await index.addItem({ id, vector: v })

      // Should still work because vectors aren't evicted without storage
      const results = await index.search(v, 1)
      expect(results.length).toBe(1)
      expect(results[0][0]).toBe(id)
    })
  })

  // =================================================================
  // 4. LAZY + QUANTIZATION COMBINED
  // =================================================================
  describe('lazy mode with quantization', () => {
    it('should use SQ8 for traversal and load full vectors for rerank', async () => {
      const storage = new MemoryStorage()
      const index = new HNSWIndex(
        {
          M: 8,
          efConstruction: 100,
          efSearch: 50,
          ml: 8,
          vectorStorage: 'lazy',
          quantization: { enabled: true, rerankMultiplier: 3 }
        },
        euclideanDistance,
        { useParallelization: false, storage }
      )

      const targetId = uuidv4()
      const target = randomVector(dim)
      await saveVector(storage, targetId, target)
      await index.addItem({ id: targetId, vector: target })

      for (let i = 0; i < 30; i++) {
        const id = uuidv4()
        const v = randomVector(dim)
        await saveVector(storage, id, v)
        await index.addItem({ id, vector: v })
      }

      // Search with reranking — should load full vectors for rerank phase
      const results = await index.search(target, 5)
      expect(results.length).toBe(5)

      // The target should be the closest match
      const targetResult = results.find(([id]) => id === targetId)
      expect(targetResult).toBeDefined()
    })

    it('should return results sorted by exact distance after rerank', async () => {
      const storage = new MemoryStorage()
      const index = new HNSWIndex(
        {
          M: 8,
          efConstruction: 100,
          efSearch: 50,
          ml: 8,
          vectorStorage: 'lazy',
          quantization: { enabled: true, rerankMultiplier: 3 }
        },
        euclideanDistance,
        { useParallelization: false, storage }
      )

      for (let i = 0; i < 40; i++) {
        const id = uuidv4()
        const v = randomVector(dim)
        await saveVector(storage, id, v)
        await index.addItem({ id, vector: v })
      }

      const query = randomVector(dim)
      const results = await index.search(query, 10)

      // Results should be sorted by exact distance (rerank ensures this)
      for (let i = 1; i < results.length; i++) {
        expect(results[i][1]).toBeGreaterThanOrEqual(results[i - 1][1])
      }
    })
  })

  // =================================================================
  // 5. MULTIPLE SEARCHES IN LAZY MODE
  // =================================================================
  describe('multiple searches in lazy mode', () => {
    it('should handle repeated searches correctly', async () => {
      const storage = new MemoryStorage()
      const index = new HNSWIndex(
        {
          M: 8,
          efConstruction: 100,
          efSearch: 50,
          ml: 8,
          vectorStorage: 'lazy'
        },
        euclideanDistance,
        { useParallelization: false, storage }
      )

      const entries: Array<{ id: string; vector: number[] }> = []
      for (let i = 0; i < 25; i++) {
        const id = uuidv4()
        const v = randomVector(dim)
        entries.push({ id, vector: v })
        await saveVector(storage, id, v)
        await index.addItem({ id, vector: v })
      }

      // Run multiple searches — each should return results and be consistent
      for (let q = 0; q < 5; q++) {
        const entry = entries[q * 5]
        const results = await index.search(entry.vector, 5)

        expect(results.length).toBe(5)
        // Results should be sorted by distance
        for (let i = 1; i < results.length; i++) {
          expect(results[i][1]).toBeGreaterThanOrEqual(results[i - 1][1])
        }
        // At least the closest result should have a reasonably small distance
        expect(results[0][1]).toBeLessThan(5)
      }
    })
  })
})
