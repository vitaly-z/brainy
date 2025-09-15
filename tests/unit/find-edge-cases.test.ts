/**
 * Comprehensive Edge Case Testing for find() Method and GraphAdjacencyIndex
 *
 * This test suite covers all critical edge cases, error scenarios, and boundary conditions
 * for the Brainy find() method and GraphAdjacencyIndex to ensure bulletproof reliability.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest'
import { Brainy } from '../../src/brainy.js'
import { GraphAdjacencyIndex } from '../../src/graph/graphAdjacencyIndex.js'
import { NounType, VerbType } from '../../src/types/graphTypes.js'
import { MemoryStorage } from '../../src/storage/adapters/memoryStorage.js'
import { GraphVerb } from '../../src/coreTypes.js'

// Mock storage adapter for controlled testing
class MockStorageAdapter extends MemoryStorage {
  private shouldFail = false
  private failOperation: string | null = null

  setFailure(operation: string) {
    this.shouldFail = true
    this.failOperation = operation
  }

  clearFailure() {
    this.shouldFail = false
    this.failOperation = null
  }

  async getVerbs(params?: any) {
    if (this.shouldFail && this.failOperation === 'getVerbs') {
      throw new Error('Storage adapter failure: getVerbs')
    }
    return super.getVerbs(params)
  }

  async saveVerb(verb: GraphVerb) {
    if (this.shouldFail && this.failOperation === 'saveVerb') {
      throw new Error('Storage adapter failure: saveVerb')
    }
    return super.saveVerb(verb)
  }
}

describe('Find() Method and GraphAdjacencyIndex Edge Cases', () => {
  let brain: Brainy
  let graphIndex: GraphAdjacencyIndex
  let mockStorage: MockStorageAdapter

  beforeAll(async () => {
    // Setup Brainy instance
    brain = new Brainy({
      storage: { type: 'memory' }
    })
    await brain.init()

    // Setup GraphAdjacencyIndex with mock storage
    mockStorage = new MockStorageAdapter()
    await mockStorage.init()
    graphIndex = new GraphAdjacencyIndex(mockStorage)
  })

  afterAll(async () => {
    if (graphIndex) {
      await graphIndex.close()
    }
  })

  beforeEach(async () => {
    // Clear mock failures
    mockStorage.clearFailure()

    // Reset graph index
    await graphIndex.rebuild()
  })

  afterEach(() => {
    // Clear all mocks
    vi.clearAllMocks()
  })

  // ============= ERROR HANDLING SCENARIOS =============

  describe('Error Handling Scenarios', () => {
    describe('Invalid Node IDs and Relationship Types', () => {
      it('should handle null node ID in getNeighbors', async () => {
        await expect(graphIndex.getNeighbors(null as any)).rejects.toThrow()
      })

      it('should handle undefined node ID in getNeighbors', async () => {
        await expect(graphIndex.getNeighbors(undefined as any)).rejects.toThrow()
      })

      it('should handle empty string node ID', async () => {
        const result = await graphIndex.getNeighbors('')
        expect(result).toEqual([])
      })

      it('should handle extremely long node IDs', async () => {
        const longId = 'a'.repeat(10000)
        const result = await graphIndex.getNeighbors(longId)
        expect(result).toEqual([])
      })

      it('should handle node IDs with special characters', async () => {
        const specialId = 'node@#$%^&*()_+{}|:<>?[]\\;\'",./'
        const result = await graphIndex.getNeighbors(specialId)
        expect(result).toEqual([])
      })

      it('should handle Unicode node IDs', async () => {
        const unicodeId = '节点🚀测试ñáéíóú'
        const result = await graphIndex.getNeighbors(unicodeId)
        expect(result).toEqual([])
      })

      it('should handle invalid relationship types in addVerb', async () => {
        const invalidVerb: GraphVerb = {
          id: 'test-verb',
          sourceId: 'source',
          targetId: 'target',
          type: 'INVALID_TYPE' as any,
          metadata: {}
        }

        await expect(graphIndex.addVerb(invalidVerb)).rejects.toThrow()
      })
    })

    describe('Null/Undefined Parameters in All Methods', () => {
      it('should handle null parameters in find()', async () => {
        await expect(brain.find(null as any)).rejects.toThrow()
      })

      it('should handle undefined parameters in find()', async () => {
        await expect(brain.find(undefined as any)).rejects.toThrow()
      })

      it('should handle null query object', async () => {
        await expect(brain.find({ query: null } as any)).rejects.toThrow()
      })

      it('should handle undefined vector', async () => {
        await expect(brain.find({ vector: undefined } as any)).rejects.toThrow()
      })

      it('should handle null metadata filters', async () => {
        await expect(brain.find({ where: null } as any)).rejects.toThrow()
      })

      it('should handle null graph constraints', async () => {
        await expect(brain.find({ connected: null } as any)).rejects.toThrow()
      })

      it('should handle null direction in getNeighbors', async () => {
        const result = await graphIndex.getNeighbors('test-node', null as any)
        expect(Array.isArray(result)).toBe(true)
      })
    })

    describe('Storage Adapter Failures and Network Issues', () => {
      it('should handle storage failure during rebuild', async () => {
        mockStorage.setFailure('getVerbs')

        await expect(graphIndex.rebuild()).rejects.toThrow('Storage adapter failure')
        expect(graphIndex.isHealthy()).toBe(false)
      })

      it('should handle storage failure during addVerb', async () => {
        mockStorage.setFailure('saveVerb')

        const verb: GraphVerb = {
          id: 'test-verb',
          sourceId: 'source',
          targetId: 'target',
          type: VerbType.RelatesTo,
          metadata: {}
        }

        await expect(graphIndex.addVerb(verb)).rejects.toThrow('Storage adapter failure')
      })

      it('should handle network timeout during large queries', async () => {
        // Mock a timeout scenario
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Network timeout')), 100)
        })

        vi.spyOn(mockStorage, 'getVerbs').mockImplementation(() => timeoutPromise as any)

        await expect(graphIndex.rebuild()).rejects.toThrow('Network timeout')
      })

      it('should handle connection reset during find()', async () => {
        // Mock connection failure
        const originalGet = brain['get'].bind(brain)
        vi.spyOn(brain as any, 'get').mockRejectedValue(new Error('Connection reset'))

        await expect(brain.find({ id: 'nonexistent' })).rejects.toThrow('Connection reset')

        // Restore original method
        vi.restoreAllMocks()
      })
    })

    describe('Memory Pressure and Out-of-Memory Conditions', () => {
      it('should handle memory pressure during large index rebuild', async () => {
        // Create a large number of verbs to simulate memory pressure
        const verbs: GraphVerb[] = []
        for (let i = 0; i < 10000; i++) {
          verbs.push({
            id: `verb-${i}`,
            sourceId: `source-${i}`,
            targetId: `target-${i}`,
            type: VerbType.RelatesTo,
            metadata: { largeData: 'x'.repeat(1000) }
          })
        }

        // Add verbs one by one to simulate memory pressure
        for (const verb of verbs.slice(0, 100)) {
          await graphIndex.addVerb(verb)
        }

        const stats = graphIndex.getStats()
        expect(stats.totalRelationships).toBeGreaterThan(0)
        expect(stats.memoryUsage).toBeGreaterThan(0)
      })

      it('should handle out-of-memory during concurrent operations', async () => {
        const operations = Array(100).fill(null).map((_, i) =>
          graphIndex.addVerb({
            id: `concurrent-verb-${i}`,
            sourceId: `source-${i % 10}`,
            targetId: `target-${i % 10}`,
            type: VerbType.RelatesTo,
            metadata: {}
          })
        )

        // Should handle concurrent operations without OOM
        await expect(Promise.all(operations)).resolves.not.toThrow()
      })
    })

    describe('Concurrent Modification Conflicts', () => {
      it('should handle concurrent addVerb operations', async () => {
        const concurrentAdds = Array(50).fill(null).map((_, i) =>
          graphIndex.addVerb({
            id: `concurrent-add-${i}`,
            sourceId: `source-${i % 10}`,
            targetId: `target-${i % 10}`,
            type: VerbType.RelatesTo,
            metadata: {}
          })
        )

        await expect(Promise.all(concurrentAdds)).resolves.not.toThrow()

        // Verify all relationships were added
        const neighbors = await graphIndex.getNeighbors('source-0')
        expect(neighbors.length).toBeGreaterThan(0)
      })

      it('should handle concurrent removeVerb operations', async () => {
        // First add some verbs
        const verbs: GraphVerb[] = []
        for (let i = 0; i < 20; i++) {
          const verb = {
            id: `remove-test-${i}`,
            sourceId: 'remove-source',
            targetId: `remove-target-${i}`,
            type: VerbType.RelatesTo,
            metadata: {}
          }
          verbs.push(verb)
          await graphIndex.addVerb(verb)
        }

        // Concurrent removal
        const concurrentRemoves = verbs.map(verb =>
          graphIndex.removeVerb(verb.id)
        )

        await expect(Promise.all(concurrentRemoves)).resolves.not.toThrow()

        // Verify all were removed
        const neighbors = await graphIndex.getNeighbors('remove-source')
        expect(neighbors).toEqual([])
      })

      it('should handle mixed concurrent add/remove operations', async () => {
        const operations: Promise<void>[] = []

        for (let i = 0; i < 30; i++) {
          if (i % 2 === 0) {
            operations.push(graphIndex.addVerb({
              id: `mixed-${i}`,
              sourceId: 'mixed-source',
              targetId: `mixed-target-${i}`,
              type: VerbType.RelatesTo,
              metadata: {}
            }))
          } else {
            operations.push(graphIndex.removeVerb(`mixed-${i - 1}`))
          }
        }

        await expect(Promise.allSettled(operations)).resolves.not.toThrow()
      })
    })
  })

  // ============= BOUNDARY CONDITIONS =============

  describe('Boundary Conditions', () => {
    describe('Empty Graphs and Zero Relationships', () => {
      it('should handle empty graph with no relationships', async () => {
        const result = await graphIndex.getNeighbors('nonexistent')
        expect(result).toEqual([])
      })

      it('should handle find() on empty database', async () => {
        const results = await brain.find({ query: 'anything' })
        expect(results).toEqual([])
      })

      it('should handle zero relationships in graph search', async () => {
        const results = await brain.find({
          connected: { to: 'nonexistent' }
        })
        expect(results).toEqual([])
      })

      it('should handle empty result sets from all search types', async () => {
        const vectorResults = await brain.find({ query: 'nonexistent-query' })
        const metadataResults = await brain.find({ where: { nonexistent: 'field' } })
        const graphResults = await brain.find({ connected: { from: 'nonexistent' } })

        expect(vectorResults).toEqual([])
        expect(metadataResults).toEqual([])
        expect(graphResults).toEqual([])
      })
    })

    describe('Maximum Relationship Limits Per Node', () => {
      it('should handle maximum relationships per node', async () => {
        const maxRelationships = 1000
        const sourceId = 'max-relations-source'

        // Add maximum relationships
        for (let i = 0; i < maxRelationships; i++) {
          await graphIndex.addVerb({
            id: `max-rel-${i}`,
            sourceId,
            targetId: `target-${i}`,
            type: VerbType.RelatesTo,
            metadata: {}
          })
        }

        const neighbors = await graphIndex.getNeighbors(sourceId)
        expect(neighbors).toHaveLength(maxRelationships)
      })

      it('should handle bidirectional maximum relationships', async () => {
        const nodeA = 'bidirectional-a'
        const nodeB = 'bidirectional-b'
        const maxRelationships = 500

        // Create bidirectional relationships
        for (let i = 0; i < maxRelationships; i++) {
          await graphIndex.addVerb({
            id: `bi-rel-a-${i}`,
            sourceId: nodeA,
            targetId: `${nodeB}-${i}`,
            type: VerbType.RelatesTo,
            metadata: {}
          })

          await graphIndex.addVerb({
            id: `bi-rel-b-${i}`,
            sourceId: `${nodeB}-${i}`,
            targetId: nodeA,
            type: VerbType.RelatesTo,
            metadata: {}
          })
        }

        const neighborsA = await graphIndex.getNeighbors(nodeA)
        const neighborsB = await graphIndex.getNeighbors(`${nodeB}-0`)

        expect(neighborsA).toHaveLength(maxRelationships)
        expect(neighborsB).toHaveLength(1) // Only connected back to A
      })
    })

    describe('Extremely Large Node IDs and Relationship Types', () => {
      it('should handle extremely large node IDs', async () => {
        const largeId = 'node-' + 'x'.repeat(10000)

        await graphIndex.addVerb({
          id: 'large-id-verb',
          sourceId: largeId,
          targetId: 'target',
          type: VerbType.RelatesTo,
          metadata: {}
        })

        const neighbors = await graphIndex.getNeighbors(largeId)
        expect(neighbors).toContain('target')
      })

      it('should handle extremely large relationship type names', async () => {
        const largeType = 'RELATIONSHIP_' + 'TYPE_'.repeat(1000)

        await graphIndex.addVerb({
          id: 'large-type-verb',
          sourceId: 'source',
          targetId: 'target',
          type: largeType as VerbType,
          metadata: {}
        })

        const neighbors = await graphIndex.getNeighbors('source')
        expect(neighbors).toContain('target')
      })

      it('should handle maximum length metadata values', async () => {
        const maxMetadata = 'x'.repeat(100000) // 100KB metadata

        await graphIndex.addVerb({
          id: 'max-metadata-verb',
          sourceId: 'source',
          targetId: 'target',
          type: VerbType.RelatesTo,
          metadata: { largeField: maxMetadata }
        })

        const neighbors = await graphIndex.getNeighbors('source')
        expect(neighbors).toContain('target')
      })
    })

    describe('Unicode and Special Character Handling', () => {
      it('should handle Unicode characters in node IDs', async () => {
        const unicodeNodes = [
          '节点1', '🚀', 'ñáéíóú', 'тест', 'مرحبا', 'こんにちは',
          '🌟⭐', 'αβγδε', '中文', 'русский'
        ]

        for (const nodeId of unicodeNodes) {
          await graphIndex.addVerb({
            id: `unicode-${nodeId}`,
            sourceId: nodeId,
            targetId: 'target',
            type: VerbType.RelatesTo,
            metadata: {}
          })
        }

        for (const nodeId of unicodeNodes) {
          const neighbors = await graphIndex.getNeighbors(nodeId)
          expect(neighbors).toContain('target')
        }
      })

      it('should handle special characters in relationship types', async () => {
        const specialTypes = [
          'TYPE@#$%', 'TYPE-with-dashes', 'TYPE.with.dots',
          'TYPE_underscore', 'TYPE spaces', 'TYPE+plus'
        ]

        for (const type of specialTypes) {
          await graphIndex.addVerb({
            id: `special-${type}`,
            sourceId: 'source',
            targetId: `target-${type}`,
            type: type as VerbType,
            metadata: {}
          })
        }

        const neighbors = await graphIndex.getNeighbors('source')
        expect(neighbors).toHaveLength(specialTypes.length)
      })

      it('should handle emoji in metadata', async () => {
        await graphIndex.addVerb({
          id: 'emoji-verb',
          sourceId: 'emoji-source',
          targetId: 'emoji-target',
          type: VerbType.RelatesTo,
          metadata: {
            emoji: '🚀⭐🌟',
            description: 'Test with 🎉 emojis 🎊'
          }
        })

        const neighbors = await graphIndex.getNeighbors('emoji-source')
        expect(neighbors).toContain('emoji-target')
      })
    })

    describe('Very Deep Graph Traversals', () => {
      it('should handle deep graph traversal (100+ levels)', async () => {
        const depth = 150
        let currentNode = 'root'

        // Create a deep chain
        for (let i = 0; i < depth; i++) {
          const nextNode = `node-${i}`
          await graphIndex.addVerb({
            id: `chain-${i}`,
            sourceId: currentNode,
            targetId: nextNode,
            type: VerbType.RelatesTo,
            metadata: {}
          })
          currentNode = nextNode
        }

        // Verify the chain exists
        let node = 'root'
        for (let i = 0; i < Math.min(depth, 10); i++) {
          const neighbors = await graphIndex.getNeighbors(node, 'out')
          expect(neighbors).toHaveLength(1)
          node = neighbors[0]
        }
      })

      it('should handle circular references in deep traversal', async () => {
        // Create a circular graph
        const nodes = ['A', 'B', 'C', 'D', 'E']

        for (let i = 0; i < nodes.length; i++) {
          const current = nodes[i]
          const next = nodes[(i + 1) % nodes.length]

          await graphIndex.addVerb({
            id: `circle-${i}`,
            sourceId: current,
            targetId: next,
            type: VerbType.RelatesTo,
            metadata: {}
          })
        }

        // Each node should have one outgoing neighbor
        for (const node of nodes) {
          const neighbors = await graphIndex.getNeighbors(node, 'out')
          expect(neighbors).toHaveLength(1)
        }
      })
    })
  })

  // ============= COMPLEX QUERY PATTERNS =============

  describe('Complex Query Patterns', () => {
    describe('Circular Relationship Detection', () => {
      it('should detect and handle self-referencing relationships', async () => {
        await graphIndex.addVerb({
          id: 'self-ref',
          sourceId: 'self',
          targetId: 'self',
          type: VerbType.RelatesTo,
          metadata: {}
        })

        const neighbors = await graphIndex.getNeighbors('self')
        expect(neighbors).toContain('self')
      })

      it('should handle multiple self-references', async () => {
        for (let i = 0; i < 5; i++) {
          await graphIndex.addVerb({
            id: `self-ref-${i}`,
            sourceId: 'multi-self',
            targetId: 'multi-self',
            type: VerbType.RelatesTo,
            metadata: { index: i }
          })
        }

        const neighbors = await graphIndex.getNeighbors('multi-self')
        expect(neighbors).toEqual(['multi-self'])
      })

      it('should handle circular relationships between multiple nodes', async () => {
        const nodes = ['X', 'Y', 'Z']

        // Create circular relationships
        await graphIndex.addVerb({ id: 'x-to-y', sourceId: 'X', targetId: 'Y', type: VerbType.RelatesTo, metadata: {} })
        await graphIndex.addVerb({ id: 'y-to-z', sourceId: 'Y', targetId: 'Z', type: VerbType.RelatesTo, metadata: {} })
        await graphIndex.addVerb({ id: 'z-to-x', sourceId: 'Z', targetId: 'X', type: VerbType.RelatesTo, metadata: {} })

        for (const node of nodes) {
          const neighbors = await graphIndex.getNeighbors(node, 'out')
          expect(neighbors).toHaveLength(1)
        }
      })
    })

    describe('Self-Referencing Relationships', () => {
      it('should handle self-referencing with different relationship types', async () => {
        const types = [VerbType.RelatesTo, VerbType.Contains, VerbType.BelongsTo]

        for (const type of types) {
          await graphIndex.addVerb({
            id: `self-${type}`,
            sourceId: 'self-multi-type',
            targetId: 'self-multi-type',
            type,
            metadata: {}
          })
        }

        const neighbors = await graphIndex.getNeighbors('self-multi-type')
        expect(neighbors).toEqual(['self-multi-type'])
      })

      it('should handle self-reference with complex metadata', async () => {
        await graphIndex.addVerb({
          id: 'self-complex',
          sourceId: 'self-complex-node',
          targetId: 'self-complex-node',
          type: VerbType.RelatesTo,
          metadata: {
            nested: { data: { value: 42 } },
            array: [1, 2, 3],
            string: 'complex metadata'
          }
        })

        const neighbors = await graphIndex.getNeighbors('self-complex-node')
        expect(neighbors).toEqual(['self-complex-node'])
      })
    })

    describe('Multiple Relationship Types Between Same Nodes', () => {
      it('should handle multiple relationship types between same nodes', async () => {
        const source = 'multi-type-source'
        const target = 'multi-type-target'
        const types = [VerbType.RelatesTo, VerbType.Contains, VerbType.BelongsTo, VerbType.ConnectsTo]

        for (const type of types) {
          await graphIndex.addVerb({
            id: `multi-${type}`,
            sourceId: source,
            targetId: target,
            type,
            metadata: { relationshipType: type }
          })
        }

        const outgoing = await graphIndex.getNeighbors(source, 'out')
        const incoming = await graphIndex.getNeighbors(target, 'in')

        expect(outgoing).toContain(target)
        expect(incoming).toContain(source)
      })

      it('should handle conflicting metadata in multiple relationships', async () => {
        const source = 'conflict-source'
        const target = 'conflict-target'

        await graphIndex.addVerb({
          id: 'conflict-1',
          sourceId: source,
          targetId: target,
          type: VerbType.RelatesTo,
          metadata: { weight: 1, priority: 'high' }
        })

        await graphIndex.addVerb({
          id: 'conflict-2',
          sourceId: source,
          targetId: target,
          type: VerbType.RelatesTo,
          metadata: { weight: 2, priority: 'low' }
        })

        const neighbors = await graphIndex.getNeighbors(source, 'out')
        expect(neighbors).toContain(target)
      })
    })

    describe('Bidirectional Relationship Conflicts', () => {
      it('should handle bidirectional relationships correctly', async () => {
        const nodeA = 'bidir-a'
        const nodeB = 'bidir-b'

        await graphIndex.addVerb({
          id: 'a-to-b',
          sourceId: nodeA,
          targetId: nodeB,
          type: VerbType.RelatesTo,
          metadata: {}
        })

        await graphIndex.addVerb({
          id: 'b-to-a',
          sourceId: nodeB,
          targetId: nodeA,
          type: VerbType.RelatesTo,
          metadata: {}
        })

        const neighborsA = await graphIndex.getNeighbors(nodeA, 'both')
        const neighborsB = await graphIndex.getNeighbors(nodeB, 'both')

        expect(neighborsA).toContain(nodeB)
        expect(neighborsB).toContain(nodeA)
      })

      it('should handle conflicting bidirectional metadata', async () => {
        const nodeA = 'conflict-bidir-a'
        const nodeB = 'conflict-bidir-b'

        await graphIndex.addVerb({
          id: 'a-to-b-conflict',
          sourceId: nodeA,
          targetId: nodeB,
          type: VerbType.RelatesTo,
          metadata: { direction: 'a-to-b', value: 1 }
        })

        await graphIndex.addVerb({
          id: 'b-to-a-conflict',
          sourceId: nodeB,
          targetId: nodeA,
          type: VerbType.RelatesTo,
          metadata: { direction: 'b-to-a', value: 2 }
        })

        const neighborsABoth = await graphIndex.getNeighbors(nodeA, 'both')
        const neighborsBBoth = await graphIndex.getNeighbors(nodeB, 'both')

        expect(neighborsABoth).toContain(nodeB)
        expect(neighborsBBoth).toContain(nodeA)
      })
    })

    describe('Complex Metadata Filtering with Nested Objects', () => {
      beforeEach(async () => {
        // Add test data with complex metadata
        await brain.add({
          data: 'Complex entity 1',
          metadata: {
            nested: { level1: { level2: 'value1' } },
            array: ['item1', 'item2'],
            number: 42,
            boolean: true
          },
          type: NounType.Document
        })

        await brain.add({
          data: 'Complex entity 2',
          metadata: {
            nested: { level1: { level2: 'value2' } },
            array: ['item2', 'item3'],
            number: 24,
            boolean: false
          },
          type: NounType.Document
        })
      })

      it('should handle nested object filtering', async () => {
        const results = await brain.find({
          where: { 'nested.level1.level2': 'value1' }
        })

        expect(results).toHaveLength(1)
        expect(results[0].entity.metadata?.nested?.level1?.level2).toBe('value1')
      })

      it('should handle array contains filtering', async () => {
        const results = await brain.find({
          where: { array: { $contains: 'item2' } }
        })

        expect(results).toHaveLength(2)
      })

      it('should handle complex nested queries', async () => {
        const results = await brain.find({
          where: {
            'nested.level1.level2': 'value1',
            number: { $gte: 40 },
            boolean: true
          }
        })

        expect(results).toHaveLength(1)
      })

      it('should handle invalid nested paths gracefully', async () => {
        const results = await brain.find({
          where: { 'nonexistent.path': 'value' }
        })

        expect(results).toEqual([])
      })
    })
  })

  // ============= DATA INTEGRITY EDGE CASES =============

  describe('Data Integrity Edge Cases', () => {
    describe('Corrupted Relationship Data', () => {
      it('should handle relationships with missing source nodes', async () => {
        // Add a relationship where source doesn't exist in main storage
        await mockStorage.saveVerb({
          id: 'orphan-verb',
          sourceId: 'nonexistent-source',
          targetId: 'existing-target',
          type: VerbType.RelatesTo,
          metadata: {}
        })

        await graphIndex.rebuild()

        const neighbors = await graphIndex.getNeighbors('nonexistent-source')
        expect(neighbors).toEqual(['existing-target'])
      })

      it('should handle relationships with missing target nodes', async () => {
        await mockStorage.saveVerb({
          id: 'orphan-target-verb',
          sourceId: 'existing-source',
          targetId: 'nonexistent-target',
          type: VerbType.RelatesTo,
          metadata: {}
        })

        await graphIndex.rebuild()

        const neighbors = await graphIndex.getNeighbors('existing-source')
        expect(neighbors).toEqual(['nonexistent-target'])
      })

      it('should handle malformed relationship data', async () => {
        const malformedVerb = {
          id: 'malformed',
          sourceId: null, // Invalid
          targetId: 'target',
          type: VerbType.RelatesTo,
          metadata: {}
        } as any

        await expect(graphIndex.addVerb(malformedVerb)).rejects.toThrow()
      })
    })

    describe('Inconsistent Relationship States', () => {
      it('should handle duplicate relationship IDs', async () => {
        const verb1: GraphVerb = {
          id: 'duplicate-id',
          sourceId: 'source1',
          targetId: 'target1',
          type: VerbType.RelatesTo,
          metadata: { version: 1 }
        }

        const verb2: GraphVerb = {
          id: 'duplicate-id', // Same ID
          sourceId: 'source2',
          targetId: 'target2',
          type: VerbType.RelatesTo,
          metadata: { version: 2 }
        }

        await graphIndex.addVerb(verb1)
        await graphIndex.addVerb(verb2) // Should overwrite

        const neighbors1 = await graphIndex.getNeighbors('source1')
        const neighbors2 = await graphIndex.getNeighbors('source2')

        // Only the second relationship should exist
        expect(neighbors1).toEqual([])
        expect(neighbors2).toEqual(['target2'])
      })

      it('should handle inconsistent bidirectional relationships', async () => {
        // Add A->B but not B->A
        await graphIndex.addVerb({
          id: 'inconsistent-1',
          sourceId: 'inconsistent-a',
          targetId: 'inconsistent-b',
          type: VerbType.RelatesTo,
          metadata: {}
        })

        const neighborsA = await graphIndex.getNeighbors('inconsistent-a', 'out')
        const neighborsB = await graphIndex.getNeighbors('inconsistent-b', 'in')

        expect(neighborsA).toContain('inconsistent-b')
        expect(neighborsB).toEqual([]) // No incoming relationship
      })
    })

    describe('Orphaned Relationships', () => {
      it('should handle relationships where nodes are deleted', async () => {
        // Add relationship
        await graphIndex.addVerb({
          id: 'orphan-test',
          sourceId: 'orphan-source',
          targetId: 'orphan-target',
          type: VerbType.RelatesTo,
          metadata: {}
        })

        // Simulate node deletion by clearing the index
        await graphIndex.rebuild()

        const neighbors = await graphIndex.getNeighbors('orphan-source')
        expect(neighbors).toEqual([])
      })

      it('should handle partial relationship cleanup', async () => {
        await graphIndex.addVerb({
          id: 'partial-1',
          sourceId: 'partial-source',
          targetId: 'partial-target-1',
          type: VerbType.RelatesTo,
          metadata: {}
        })

        await graphIndex.addVerb({
          id: 'partial-2',
          sourceId: 'partial-source',
          targetId: 'partial-target-2',
          type: VerbType.RelatesTo,
          metadata: {}
        })

        // Remove one relationship
        await graphIndex.removeVerb('partial-1')

        const neighbors = await graphIndex.getNeighbors('partial-source')
        expect(neighbors).toEqual(['partial-target-2'])
        expect(neighbors).not.toContain('partial-target-1')
      })
    })

    describe('Duplicate Relationship Handling', () => {
      it('should handle exact duplicate relationships', async () => {
        const verb: GraphVerb = {
          id: 'duplicate-1',
          sourceId: 'dup-source',
          targetId: 'dup-target',
          type: VerbType.RelatesTo,
          metadata: { duplicate: true }
        }

        await graphIndex.addVerb(verb)
        await graphIndex.addVerb({ ...verb, id: 'duplicate-2' }) // Same content, different ID

        const neighbors = await graphIndex.getNeighbors('dup-source')
        expect(neighbors).toEqual(['dup-target'])
      })

      it('should handle duplicate relationships with different metadata', async () => {
        await graphIndex.addVerb({
          id: 'dup-meta-1',
          sourceId: 'dup-meta-source',
          targetId: 'dup-meta-target',
          type: VerbType.RelatesTo,
          metadata: { version: 1 }
        })

        await graphIndex.addVerb({
          id: 'dup-meta-2',
          sourceId: 'dup-meta-source',
          targetId: 'dup-meta-target',
          type: VerbType.RelatesTo,
          metadata: { version: 2 }
        })

        const neighbors = await graphIndex.getNeighbors('dup-meta-source')
        expect(neighbors).toEqual(['dup-meta-target'])
      })
    })

    describe('Relationship Type Conflicts', () => {
      it('should handle conflicting relationship types for same nodes', async () => {
        await graphIndex.addVerb({
          id: 'conflict-type-1',
          sourceId: 'type-conflict-source',
          targetId: 'type-conflict-target',
          type: VerbType.RelatesTo,
          metadata: {}
        })

        await graphIndex.addVerb({
          id: 'conflict-type-2',
          sourceId: 'type-conflict-source',
          targetId: 'type-conflict-target',
          type: VerbType.Contains,
          metadata: {}
        })

        const neighbors = await graphIndex.getNeighbors('type-conflict-source')
        expect(neighbors).toEqual(['type-conflict-target'])
      })

      it('should handle invalid relationship type transitions', async () => {
        // This should work fine - GraphAdjacencyIndex doesn't validate relationship semantics
        await graphIndex.addVerb({
          id: 'type-transition',
          sourceId: 'transition-source',
          targetId: 'transition-target',
          type: 'INVALID_TRANSITION' as VerbType,
          metadata: {}
        })

        const neighbors = await graphIndex.getNeighbors('transition-source')
        expect(neighbors).toEqual(['transition-target'])
      })
    })
  })

  // ============= PERFORMANCE EDGE CASES =============

  describe('Performance Edge Cases', () => {
    describe('Memory Leaks Under Sustained Load', () => {
      it('should not leak memory during sustained add/remove operations', async () => {
        const initialMemory = graphIndex.getStats().memoryUsage
        const operations = 1000

        // Perform many add/remove operations
        for (let i = 0; i < operations; i++) {
          const verb: GraphVerb = {
            id: `leak-test-${i}`,
            sourceId: `leak-source-${i % 10}`,
            targetId: `leak-target-${i % 10}`,
            type: VerbType.RelatesTo,
            metadata: {}
          }

          await graphIndex.addVerb(verb)

          if (i % 100 === 0) {
            await graphIndex.removeVerb(`leak-test-${i - 50}`)
          }
        }

        const finalMemory = graphIndex.getStats().memoryUsage

        // Memory should not grow excessively
        expect(finalMemory).toBeLessThan(initialMemory * 2)
      })

      it('should handle memory pressure during large rebuilds', async () => {
        const largeVerbCount = 5000
        const verbs: GraphVerb[] = []

        // Create many verbs
        for (let i = 0; i < largeVerbCount; i++) {
          verbs.push({
            id: `large-rebuild-${i}`,
            sourceId: `large-source-${i % 100}`,
            targetId: `large-target-${i % 100}`,
            type: VerbType.RelatesTo,
            metadata: { index: i }
          })
        }

        // Add to storage
        for (const verb of verbs) {
          await mockStorage.saveVerb(verb)
        }

        // Measure rebuild time and memory
        const startTime = Date.now()
        const startMemory = graphIndex.getStats().memoryUsage

        await graphIndex.rebuild()

        const endTime = Date.now()
        const endMemory = graphIndex.getStats().memoryUsage

        expect(endTime - startTime).toBeLessThan(10000) // Should complete within 10 seconds
        expect(graphIndex.getStats().totalRelationships).toBe(largeVerbCount)
      })
    })

    describe('CPU Spikes During Complex Traversals', () => {
      it('should handle CPU-intensive traversals without blocking', async () => {
        // Create a dense graph
        const nodeCount = 100
        const verbs: GraphVerb[] = []

        for (let i = 0; i < nodeCount; i++) {
          for (let j = 0; j < 10; j++) {
            verbs.push({
              id: `dense-${i}-${j}`,
              sourceId: `dense-node-${i}`,
              targetId: `dense-node-${(i + j) % nodeCount}`,
              type: VerbType.RelatesTo,
              metadata: {}
            })
          }
        }

        // Add all verbs
        for (const verb of verbs) {
          await graphIndex.addVerb(verb)
        }

        // Perform traversals
        const traversalPromises = Array(10).fill(null).map((_, i) =>
          graphIndex.getNeighbors(`dense-node-${i}`, 'both')
        )

        const startTime = Date.now()
        const results = await Promise.all(traversalPromises)
        const endTime = Date.now()

        expect(endTime - startTime).toBeLessThan(1000) // Should complete within 1 second
        results.forEach(result => expect(result.length).toBeGreaterThan(0))
      })

      it('should handle recursive relationship patterns', async () => {
        // Create a pattern that could cause recursive traversal issues
        const patternSize = 50

        for (let i = 0; i < patternSize; i++) {
          await graphIndex.addVerb({
            id: `recursive-${i}`,
            sourceId: `recursive-${i}`,
            targetId: `recursive-${(i + 1) % patternSize}`,
            type: VerbType.RelatesTo,
            metadata: {}
          })
        }

        // This should not cause infinite loops or excessive CPU usage
        const startTime = Date.now()
        const neighbors = await graphIndex.getNeighbors('recursive-0', 'both')
        const endTime = Date.now()

        expect(endTime - startTime).toBeLessThan(100) // Should be very fast
        expect(neighbors.length).toBeGreaterThan(0)
      })
    })

    describe('Network Timeouts During Large Queries', () => {
      it('should handle timeout during large dataset queries', async () => {
        // Mock a slow storage operation
        const slowGetVerbs = vi.fn().mockImplementation(async () => {
          await new Promise(resolve => setTimeout(resolve, 200)) // 200ms delay
          return { items: [], hasMore: false, nextCursor: null }
        })

        vi.spyOn(mockStorage, 'getVerbs').mockImplementation(slowGetVerbs)

        const startTime = Date.now()
        await expect(graphIndex.rebuild()).rejects.toThrow()
        const endTime = Date.now()

        expect(endTime - startTime).toBeGreaterThan(150) // Should take at least the delay time
      })

      it('should handle partial failures during large operations', async () => {
        let callCount = 0
        const failingGetVerbs = vi.fn().mockImplementation(async () => {
          callCount++
          if (callCount === 3) {
            throw new Error('Simulated network failure')
          }
          return { items: [], hasMore: false, nextCursor: null }
        })

        vi.spyOn(mockStorage, 'getVerbs').mockImplementation(failingGetVerbs)

        await expect(graphIndex.rebuild()).rejects.toThrow('Simulated network failure')
        expect(callCount).toBe(3)
      })
    })

    describe('Database Connection Failures', () => {
      it('should handle connection failures during read operations', async () => {
        mockStorage.setFailure('getVerbs')

        await expect(graphIndex.rebuild()).rejects.toThrow('Storage adapter failure')
        expect(graphIndex.isHealthy()).toBe(false)
      })

      it('should handle connection failures during write operations', async () => {
        mockStorage.setFailure('saveVerb')

        const verb: GraphVerb = {
          id: 'connection-fail-verb',
          sourceId: 'source',
          targetId: 'target',
          type: VerbType.RelatesTo,
          metadata: {}
        }

        await expect(graphIndex.addVerb(verb)).rejects.toThrow('Storage adapter failure')
      })

      it('should recover from temporary connection failures', async () => {
        // First fail
        mockStorage.setFailure('saveVerb')
        const verb: GraphVerb = {
          id: 'recovery-test',
          sourceId: 'recovery-source',
          targetId: 'recovery-target',
          type: VerbType.RelatesTo,
          metadata: {}
        }

        await expect(graphIndex.addVerb(verb)).rejects.toThrow()

        // Then succeed
        mockStorage.clearFailure()
        await expect(graphIndex.addVerb(verb)).resolves.not.toThrow()

        const neighbors = await graphIndex.getNeighbors('recovery-source')
        expect(neighbors).toContain('recovery-target')
      })
    })

    describe('Cache Invalidation Scenarios', () => {
      it('should handle cache invalidation during concurrent operations', async () => {
        // Add some initial data
        await graphIndex.addVerb({
          id: 'cache-test',
          sourceId: 'cache-source',
          targetId: 'cache-target',
          type: VerbType.RelatesTo,
          metadata: {}
        })

        // Simulate cache invalidation by clearing and rebuilding
        await graphIndex.rebuild()

        const neighbors = await graphIndex.getNeighbors('cache-source')
        expect(neighbors).toContain('cache-target')
      })

      it('should handle cache corruption scenarios', async () => {
        // Add data
        await graphIndex.addVerb({
          id: 'corruption-test',
          sourceId: 'corruption-source',
          targetId: 'corruption-target',
          type: VerbType.RelatesTo,
          metadata: {}
        })

        // Simulate cache corruption by manually modifying internal state
        const sourceIndex = (graphIndex as any).sourceIndex
        sourceIndex.set('corruption-source', new Set(['corrupted-neighbor']))

        // Rebuild should fix corruption
        await graphIndex.rebuild()

        const neighbors = await graphIndex.getNeighbors('corruption-source')
        expect(neighbors).toContain('corruption-target')
        expect(neighbors).not.toContain('corrupted-neighbor')
      })
    })
  })

  // ============= INTEGRATION EDGE CASES =============

  describe('Integration Edge Cases', () => {
    describe('Vector Search Failures in Unified Queries', () => {
      it('should handle vector search failures gracefully', async () => {
        // Mock vector search failure
        const originalVectorSearch = (brain as any).vectorSearch
        ;(brain as any).vectorSearch = vi.fn().mockRejectedValue(new Error('Vector search failed'))

        const results = await brain.find({
          query: 'test query',
          mode: 'hybrid'
        })

        // Should still return results from other search types
        expect(Array.isArray(results)).toBe(true)

        // Restore original method
        ;(brain as any).vectorSearch = originalVectorSearch
      })

      it('should fallback when vector search returns empty results', async () => {
        const originalVectorSearch = (brain as any).vectorSearch
        ;(brain as any).vectorSearch = vi.fn().mockResolvedValue([])

        const results = await brain.find({
          query: 'test query',
          mode: 'hybrid'
        })

        expect(Array.isArray(results)).toBe(true)

        ;(brain as any).vectorSearch = originalVectorSearch
      })
    })

    describe('Graph Traversal Failures in Combined Searches', () => {
      it('should handle graph traversal failures in unified queries', async () => {
        // Mock graph search failure
        const originalGraphSearch = (brain as any).graphSearch
        ;(brain as any).graphSearch = vi.fn().mockRejectedValue(new Error('Graph traversal failed'))

        const results = await brain.find({
          connected: { to: 'test-node' },
          mode: 'hybrid'
        })

        expect(Array.isArray(results)).toBe(true)

        ;(brain as any).graphSearch = originalGraphSearch
      })

      it('should continue with other search types when graph search fails', async () => {
        const originalGraphSearch = (brain as any).graphSearch
        ;(brain as any).graphSearch = vi.fn().mockRejectedValue(new Error('Graph traversal failed'))

        // Add some test data for other search types
        await brain.add({
          data: 'Test document for fallback',
          metadata: { category: 'test' },
          type: NounType.Document
        })

        const results = await brain.find({
          connected: { to: 'test-node' },
          where: { category: 'test' },
          mode: 'hybrid'
        })

        expect(results.length).toBeGreaterThan(0)

        ;(brain as any).graphSearch = originalGraphSearch
      })
    })

    describe('Metadata Filtering Failures in Complex Queries', () => {
      it('should handle metadata filtering failures gracefully', async () => {
        const originalMetadataSearch = (brain as any).metadataSearch
        ;(brain as any).metadataSearch = vi.fn().mockRejectedValue(new Error('Metadata search failed'))

        const results = await brain.find({
          where: { category: 'test' },
          mode: 'hybrid'
        })

        expect(Array.isArray(results)).toBe(true)

        ;(brain as any).metadataSearch = originalMetadataSearch
      })

      it('should handle invalid metadata filter syntax', async () => {
        const results = await brain.find({
          where: { $invalid: 'operator' } as any
        })

        expect(Array.isArray(results)).toBe(true)
      })
    })

    describe('Fusion Ranking Edge Cases with Extreme Scores', () => {
      it('should handle extreme similarity scores in fusion', async () => {
        // Mock search results with extreme scores
        const mockResults = [
          [{ id: 'high-score', score: 0.99, entity: { id: 'high-score', vector: [1, 2, 3], metadata: {} } }],
          [{ id: 'low-score', score: 0.01, entity: { id: 'low-score', vector: [4, 5, 6], metadata: {} } }],
          []
        ]

        const originalVectorSearch = (brain as any).vectorSearch
        const originalMetadataSearch = (brain as any).metadataSearch
        const originalGraphSearch = (brain as any).graphSearch

        ;(brain as any).vectorSearch = vi.fn().mockResolvedValue(mockResults[0])
        ;(brain as any).metadataSearch = vi.fn().mockResolvedValue(mockResults[1])
        ;(brain as any).graphSearch = vi.fn().mockResolvedValue(mockResults[2])

        const results = await brain.find({
          query: 'test',
          mode: 'hybrid'
        })

        expect(results.length).toBeGreaterThan(0)
        expect(results[0].score).toBeGreaterThan(0)
        expect(results[0].score).toBeLessThanOrEqual(1)

        // Restore methods
        ;(brain as any).vectorSearch = originalVectorSearch
        ;(brain as any).metadataSearch = originalMetadataSearch
        ;(brain as any).graphSearch = originalGraphSearch
      })

      it('should handle NaN and infinite scores', async () => {
        const mockResults = [
          [{ id: 'nan-score', score: NaN, entity: { id: 'nan-score', vector: [1, 2, 3], metadata: {} } }],
          [{ id: 'inf-score', score: Infinity, entity: { id: 'inf-score', vector: [4, 5, 6], metadata: {} } }],
          []
        ]

        const originalVectorSearch = (brain as any).vectorSearch
        const originalMetadataSearch = (brain as any).metadataSearch
        const originalGraphSearch = (brain as any).graphSearch

        ;(brain as any).vectorSearch = vi.fn().mockResolvedValue(mockResults[0])
        ;(brain as any).metadataSearch = vi.fn().mockResolvedValue(mockResults[1])
        ;(brain as any).graphSearch = vi.fn().mockResolvedValue(mockResults[2])

        const results = await brain.find({
          query: 'test',
          mode: 'hybrid'
        })

        expect(Array.isArray(results)).toBe(true)

        ;(brain as any).vectorSearch = originalVectorSearch
        ;(brain as any).metadataSearch = originalMetadataSearch
        ;(brain as any).graphSearch = originalGraphSearch
      })
    })

    describe('Query Optimization Failures', () => {
      it('should handle query optimization failures', async () => {
        // Mock a failure in the reciprocal rank fusion
        const originalFusion = (brain as any).reciprocalRankFusion
        ;(brain as any).reciprocalRankFusion = vi.fn().mockRejectedValue(new Error('Fusion failed'))

        const results = await brain.find({
          query: 'test query'
        })

        expect(Array.isArray(results)).toBe(true)

        ;(brain as any).reciprocalRankFusion = originalFusion
      })

      it('should handle empty search results from all search types', async () => {
        const originalVectorSearch = (brain as any).vectorSearch
        const originalMetadataSearch = (brain as any).metadataSearch
        const originalGraphSearch = (brain as any).graphSearch

        ;(brain as any).vectorSearch = vi.fn().mockResolvedValue([])
        ;(brain as any).metadataSearch = vi.fn().mockResolvedValue([])
        ;(brain as any).graphSearch = vi.fn().mockResolvedValue([])

        const results = await brain.find({
          query: 'nonexistent',
          where: { nonexistent: 'field' },
          connected: { to: 'nonexistent' }
        })

        expect(results).toEqual([])

        ;(brain as any).vectorSearch = originalVectorSearch
        ;(brain as any).metadataSearch = originalMetadataSearch
        ;(brain as any).graphSearch = originalGraphSearch
      })

      it('should handle malformed query parameters', async () => {
        const malformedQueries = [
          { query: null },
          { vector: 'not-an-array' },
          { limit: 'not-a-number' },
          { offset: -1 },
          { connected: { depth: -5 } }
        ]

        for (const query of malformedQueries) {
          const results = await brain.find(query as any)
          expect(Array.isArray(results)).toBe(true)
        }
      })
    })
  })
})
