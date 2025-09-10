import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { Brainy } from '../src/brainy'

describe('CRITICAL: Error Handling and Edge Cases', () => {
  let brainy: Brainy

  beforeAll(async () => {
    brainy = new Brainy({
      storage: { type: 'memory' }
    })
    await brainy.init()
  })

  afterAll(async () => {
    await brainy.close()
  })

  describe('Invalid Input Handling', () => {
    it('should handle null and undefined gracefully', async () => {
      await expect(brainy.add({
        data: null as any,
        type: 'document'
      })).rejects.toThrow()

      await expect(brainy.add({
        data: undefined as any,
        type: 'document'
      })).rejects.toThrow()

      const result = await brainy.get(null as any)
      expect(result).toBeNull()
    })

    it('should validate noun types', async () => {
      await expect(brainy.add({
        data: { content: 'test' },
        type: 'invalid-type' as any
      })).rejects.toThrow()
    })

    it('should validate verb types in relationships', async () => {
      await brainy.add({ id: 'node1', data: { name: 'Node 1' }, type: 'entity' })
      await brainy.add({ id: 'node2', data: { name: 'Node 2' }, type: 'entity' })

      await expect(brainy.relate({
        from: 'node1',
        to: 'node2',
        type: 'invalid-verb' as any
      })).rejects.toThrow()
    })

    it('should handle extremely long strings', async () => {
      const longString = 'x'.repeat(1000000)
      
      const id = await brainy.add({
        data: { content: longString },
        type: 'document'
      })

      expect(id).toBeDefined()
      
      const retrieved = await brainy.get(id)
      expect(retrieved).toBeDefined()
    })

    it('should handle circular references in data', async () => {
      const circular: any = { name: 'test' }
      circular.self = circular

      await expect(brainy.add({
        data: circular,
        type: 'entity'
      })).rejects.toThrow()
    })

    it('should handle special characters in IDs', async () => {
      const specialIds = [
        'id with spaces',
        'id/with/slashes',
        'id\\with\\backslashes',
        'id:with:colons',
        'id|with|pipes',
        'id"with"quotes',
        'id<with>brackets'
      ]

      for (const id of specialIds) {
        const result = await brainy.add({
          id,
          data: { content: `Test ${id}` },
          type: 'document'
        })
        
        expect(result).toBe(id)
        
        const retrieved = await brainy.get(id)
        expect(retrieved).toBeDefined()
      }
    })
  })

  describe('Concurrent Operation Safety', () => {
    it('should handle concurrent writes to same ID', async () => {
      const id = 'concurrent-test'
      
      const promises = Array.from({ length: 10 }, (_, i) =>
        brainy.add({
          id,
          data: { content: `Version ${i}` },
          type: 'document'
        })
      )

      await Promise.all(promises)
      
      const final = await brainy.get(id)
      expect(final).toBeDefined()
    })

    it('should handle concurrent updates', async () => {
      const id = await brainy.add({
        data: { counter: 0 },
        type: 'entity'
      })

      const updates = Array.from({ length: 10 }, (_, i) =>
        brainy.update({
          id,
          data: { counter: i }
        })
      )

      await Promise.all(updates)
      
      const final = await brainy.get(id)
      expect(final).toBeDefined()
    })

    it('should handle concurrent deletes', async () => {
      const ids = await Promise.all(
        Array.from({ length: 10 }, (_, i) =>
          brainy.add({
            data: { index: i },
            type: 'entity'
          })
        )
      )

      const deletes = ids.map(id => brainy.delete(id))
      await Promise.all(deletes)

      for (const id of ids) {
        const result = await brainy.get(id)
        expect(result).toBeNull()
      }
    })
  })

  describe('Memory and Resource Management', () => {
    it('should not leak memory on failed operations', async () => {
      const memBefore = process.memoryUsage().heapUsed

      for (let i = 0; i < 1000; i++) {
        try {
          await brainy.add({
            data: null as any,
            type: 'invalid' as any
          })
        } catch {
          // Expected to fail
        }
      }

      global.gc?.()
      const memAfter = process.memoryUsage().heapUsed
      const leak = memAfter - memBefore
      
      expect(leak).toBeLessThan(10 * 1024 * 1024) // Less than 10MB
    })

    it('should handle out of memory scenarios gracefully', async () => {
      const hugeArray = Array.from({ length: 100000 }, (_, i) => ({
        id: `huge-${i}`,
        data: {
          content: 'x'.repeat(10000),
          metadata: Array.from({ length: 100 }, () => Math.random())
        },
        type: 'document' as const
      }))

      try {
        await brainy.addMany({ items: hugeArray })
      } catch (error: any) {
        expect(error).toBeDefined()
      }
    })
  })

  describe('Query Edge Cases', () => {
    it('should handle empty search queries', async () => {
      const results = await brainy.find('')
      expect(Array.isArray(results)).toBe(true)
    })

    it('should handle queries with only special characters', async () => {
      const specialQueries = [
        '!!!',
        '???',
        '...',
        '---',
        '___',
        '@#$%^&*()',
        '{}[]|\\',
        '<>?/~`'
      ]

      for (const query of specialQueries) {
        const results = await brainy.find(query)
        expect(Array.isArray(results)).toBe(true)
      }
    })

    it('should handle metadata filters with undefined values', async () => {
      await brainy.add({
        data: { name: 'Test', value: undefined },
        type: 'entity'
      })

      const results = await brainy.find({
        where: { value: undefined as any }
      })

      expect(Array.isArray(results)).toBe(true)
    })

    it('should handle complex nested metadata queries', async () => {
      await brainy.add({
        data: {
          nested: {
            deep: {
              deeper: {
                value: 42
              }
            }
          }
        },
        type: 'entity'
      })

      const results = await brainy.find({
        where: {
          'nested.deep.deeper.value': 42
        }
      })

      expect(results.length).toBeGreaterThan(0)
    })
  })

  describe('Relationship Error Cases', () => {
    it('should handle relationships to non-existent nodes', async () => {
      await expect(brainy.relate({
        from: 'non-existent-1',
        to: 'non-existent-2',
        type: 'relatedTo'
      })).rejects.toThrow()
    })

    it('should handle self-referential relationships', async () => {
      const id = await brainy.add({
        data: { name: 'Self' },
        type: 'entity'
      })

      const relId = await brainy.relate({
        from: id,
        to: id,
        type: 'relatedTo'
      })

      expect(relId).toBeDefined()
      
      const relations = await brainy.getRelations({ from: id })
      expect(relations.length).toBeGreaterThan(0)
    })

    it('should handle duplicate relationships', async () => {
      const id1 = await brainy.add({ data: { name: 'A' }, type: 'entity' })
      const id2 = await brainy.add({ data: { name: 'B' }, type: 'entity' })

      const rel1 = await brainy.relate({
        from: id1,
        to: id2,
        type: 'relatedTo'
      })

      const rel2 = await brainy.relate({
        from: id1,
        to: id2,
        type: 'relatedTo'
      })

      expect(rel1).not.toBe(rel2)
    })
  })

  describe('Data Validation', () => {
    it('should validate vector dimensions', async () => {
      const wrongDimVector = new Array(100).fill(0)
      
      await brainy.add({
        data: { test: 'first' },
        type: 'entity'
      })

      await expect(brainy.add({
        vector: wrongDimVector,
        type: 'entity'
      })).rejects.toThrow()
    })

    it('should handle NaN and Infinity in vectors', async () => {
      const badVector = [NaN, Infinity, -Infinity, 0.5]
      
      await expect(brainy.add({
        vector: badVector as any,
        type: 'entity'
      })).rejects.toThrow()
    })

    it('should validate metadata field names', async () => {
      const invalidMetadata = {
        '$invalid': 'value',
        'also.invalid': 'value',
        'normal': 'value'
      }

      const id = await brainy.add({
        data: invalidMetadata,
        type: 'entity'
      })

      const retrieved = await brainy.get(id)
      expect(retrieved).toBeDefined()
    })
  })

  describe('Recovery and Cleanup', () => {
    it('should recover from partial batch failures', async () => {
      const items = [
        { id: 'valid1', data: { content: 'Valid 1' }, type: 'document' as const },
        { id: 'invalid', data: null as any, type: 'invalid' as any },
        { id: 'valid2', data: { content: 'Valid 2' }, type: 'document' as const }
      ]

      const result = await brainy.addMany({ items })
      
      expect(result.successful).toBeGreaterThan(0)
      expect(result.failed).toBeGreaterThan(0)
      expect(result.errors.length).toBeGreaterThan(0)
    })

    it('should clean up after failed operations', async () => {
      const memBefore = process.memoryUsage().heapUsed
      
      for (let i = 0; i < 100; i++) {
        try {
          await brainy.add({
            id: `cleanup-${i}`,
            data: { content: 'test' },
            type: 'entity'
          })
          
          await brainy.delete(`cleanup-${i}`)
        } catch {
          // Ignore errors
        }
      }
      
      global.gc?.()
      const memAfter = process.memoryUsage().heapUsed
      const diff = memAfter - memBefore
      
      expect(diff).toBeLessThan(5 * 1024 * 1024) // Less than 5MB growth
    })
  })

  describe('Boundary Conditions', () => {
    it('should handle zero-length arrays and strings', async () => {
      const id = await brainy.add({
        data: {
          emptyString: '',
          emptyArray: [],
          zero: 0,
          false: false,
          null: null
        },
        type: 'entity'
      })

      const retrieved = await brainy.get(id)
      expect(retrieved?.data.emptyString).toBe('')
      expect(retrieved?.data.emptyArray).toEqual([])
    })

    it('should handle maximum safe integers', async () => {
      const id = await brainy.add({
        data: {
          maxSafe: Number.MAX_SAFE_INTEGER,
          minSafe: Number.MIN_SAFE_INTEGER,
          maxValue: Number.MAX_VALUE,
          minValue: Number.MIN_VALUE
        },
        type: 'entity'
      })

      const retrieved = await brainy.get(id)
      expect(retrieved?.data.maxSafe).toBe(Number.MAX_SAFE_INTEGER)
    })

    it('should handle Unicode and emoji correctly', async () => {
      const unicodeData = {
        emoji: '😀🎉🚀❤️',
        chinese: '你好世界',
        arabic: 'مرحبا بالعالم',
        hebrew: 'שלום עולם',
        special: '™®©℠',
        zalgo: 'ẗ̸̢̼͉͈́̏͊̈ë̵̺́͊s̴̱̈́ẗ̸͎̆'
      }

      const id = await brainy.add({
        data: unicodeData,
        type: 'entity'
      })

      const retrieved = await brainy.get(id)
      expect(retrieved?.data.emoji).toBe(unicodeData.emoji)
      expect(retrieved?.data.chinese).toBe(unicodeData.chinese)
    })
  })
})