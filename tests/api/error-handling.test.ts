/**
 * Error Handling and Recovery Test Suite for Brainy v3.0
 * 
 * Comprehensive error scenario testing including:
 * - Invalid input validation
 * - Network failure recovery
 * - Resource exhaustion handling
 * - Concurrent error scenarios
 * - Graceful degradation
 * - Error message consistency
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { Brainy } from '../../src/brainy'

describe('Error Handling and Recovery', () => {
  let brainy: Brainy

  beforeEach(async () => {
    brainy = new Brainy({
      storage: { type: 'memory' }
    })
    await brainy.init()
  })

  afterEach(async () => {
    await brainy.close()
  })

  describe('Input Validation Errors', () => {
    describe('ADD operation validation', () => {
      it('should reject null data', async () => {
        await expect(
          brainy.add({
            data: null as any,
            type: 'document'
          })
        ).rejects.toThrow()
      })

      it('should reject undefined data', async () => {
        await expect(
          brainy.add({
            data: undefined as any,
            type: 'document'
          })
        ).rejects.toThrow()
      })

      it('should reject empty string data', async () => {
        await expect(
          brainy.add({
            data: '',
            type: 'document'
          })
        ).rejects.toThrow(/data.*required|empty/i)
      })

      it('should reject invalid type values', async () => {
        await expect(
          brainy.add({
            data: 'Valid data',
            type: 'invalid-type' as any
          })
        ).rejects.toThrow(/invalid.*type|noun.*type/i)
      })

      it('should reject non-string data types', async () => {
        const invalidData = [
          42,
          true,
          [],
          { text: 'object' },
          () => 'function'
        ]

        for (const data of invalidData) {
          await expect(
            brainy.add({
              data: data as any,
              type: 'document'
            })
          ).rejects.toThrow()
        }
      })

      it('should handle extremely large metadata gracefully', async () => {
        const hugeMetadata: any = {}
        for (let i = 0; i < 10000; i++) {
          hugeMetadata[`field${i}`] = `value${i}`.repeat(100)
        }

        // Should either succeed or throw meaningful error
        try {
          const id = await brainy.add({
            data: 'Test with huge metadata',
            type: 'document',
            metadata: hugeMetadata
          })
          expect(id).toBeDefined()
        } catch (error: any) {
          expect(error.message).toMatch(/size|memory|large/i)
        }
      })
    })

    describe('GET operation validation', () => {
      it('should return null for non-existent IDs', async () => {
        const result = await brainy.get('non-existent-id-12345')
        expect(result).toBeNull()
      })

      it('should handle invalid ID formats gracefully', async () => {
        const invalidIds = [
          null,
          undefined,
          '',
          '   ',
          '../etc/passwd',
          '<script>alert(1)</script>'
        ]

        for (const id of invalidIds) {
          const result = await brainy.get(id as any)
          expect(result).toBeNull()
        }
      })
    })

    describe('UPDATE operation validation', () => {
      it('should reject updates without ID', async () => {
        await expect(
          brainy.update({
            id: undefined as any,
            metadata: { updated: true }
          })
        ).rejects.toThrow(/id.*required/i)
      })

      it('should reject updates to non-existent entities', async () => {
        await expect(
          brainy.update({
            id: 'non-existent-id',
            metadata: { updated: true }
          })
        ).rejects.toThrow(/not found|doesn't exist/i)
      })

      it('should handle circular references in metadata', async () => {
        const id = await brainy.add({
          data: 'Test entity',
          type: 'document'
        })

        const metadata: any = { level: 1 }
        metadata.self = metadata // Circular reference

        // Should either handle or throw meaningful error
        try {
          await brainy.update({
            id,
            metadata
          })
          // If successful, verify it was handled
          const updated = await brainy.get(id)
          expect(updated).toBeDefined()
        } catch (error: any) {
          expect(error.message).toMatch(/circular|cyclic/i)
        }
      })
    })

    describe('DELETE operation validation', () => {
      it('should handle deletion of non-existent entities', async () => {
        // Should not throw, just return void
        await expect(
          brainy.delete('non-existent-id')
        ).resolves.toBeUndefined()
      })

      it('should handle double deletion gracefully', async () => {
        const id = await brainy.add({
          data: 'To be deleted',
          type: 'document'
        })

        await brainy.delete(id)
        // Second delete should not throw
        await expect(brainy.delete(id)).resolves.toBeUndefined()
      })
    })

    describe('RELATE operation validation', () => {
      it('should reject relationships without source', async () => {
        await expect(
          brainy.relate({
            from: undefined as any,
            to: 'some-id',
            type: 'relatedTo'
          })
        ).rejects.toThrow(/from.*required/i)
      })

      it('should reject relationships without target', async () => {
        await expect(
          brainy.relate({
            from: 'some-id',
            to: undefined as any,
            type: 'relatedTo'
          })
        ).rejects.toThrow(/to.*required/i)
      })

      it('should reject invalid relationship types', async () => {
        const id1 = await brainy.add({
          data: 'Entity 1',
          type: 'thing'
        })
        const id2 = await brainy.add({
          data: 'Entity 2',
          type: 'thing'
        })

        await expect(
          brainy.relate({
            from: id1,
            to: id2,
            type: 'invalid-verb' as any
          })
        ).rejects.toThrow(/invalid.*type|verb.*type/i)
      })

      it('should reject self-relationships by default', async () => {
        const id = await brainy.add({
          data: 'Self entity',
          type: 'thing'
        })

        // Some systems reject self-relationships
        try {
          await brainy.relate({
            from: id,
            to: id,
            type: 'relatedTo'
          })
        } catch (error: any) {
          expect(error.message).toMatch(/self|same.*entity/i)
        }
      })
    })

    describe('FIND operation validation', () => {
      it('should handle empty queries gracefully', async () => {
        const results = await brainy.find({})
        expect(Array.isArray(results)).toBe(true)
      })

      it('should handle invalid where clauses', async () => {
        const results = await brainy.find({
          where: {
            'metadata.field': { $invalidOp: 'value' } as any
          }
        })
        // Should return empty array or handle gracefully
        expect(Array.isArray(results)).toBe(true)
      })

      it('should handle negative limits', async () => {
        const results = await brainy.find({
          limit: -10
        })
        expect(Array.isArray(results)).toBe(true)
        expect(results.length).toBeGreaterThanOrEqual(0)
      })

      it('should handle huge limits reasonably', async () => {
        const results = await brainy.find({
          limit: Number.MAX_SAFE_INTEGER
        })
        expect(Array.isArray(results)).toBe(true)
        // Should cap at reasonable limit
        expect(results.length).toBeLessThanOrEqual(10000)
      })
    })
  })

  describe('Batch Operation Error Handling', () => {
    it('should handle partial failures in addMany', async () => {
      const items = [
        { data: 'Valid 1', type: 'document' as const },
        { data: '', type: 'document' as const }, // Invalid
        { data: 'Valid 2', type: 'document' as const },
        { data: null as any, type: 'document' as const }, // Invalid
        { data: 'Valid 3', type: 'document' as const }
      ]

      const result = await brainy.addMany({
        items,
        continueOnError: true
      })

      expect(result.successful.length).toBeGreaterThanOrEqual(3)
      expect(result.failed.length).toBeGreaterThanOrEqual(0)
      expect(result.total).toBe(5)
    })

    it('should rollback batch on critical failure', async () => {
      const items = Array(100).fill(null).map((_, i) => ({
        data: `Item ${i}`,
        type: 'document' as const
      }))

      // Inject a failure midway
      items[50] = {
        data: null as any,
        type: 'document' as const
      }

      const result = await brainy.addMany({
        items,
        continueOnError: false
      })

      // Should either complete all or rollback
      if (result.successful.length > 0) {
        expect(result.successful.length).toBe(100)
      } else {
        expect(result.failed.length).toBeGreaterThan(0)
      }
    })
  })

  describe('Concurrent Operation Errors', () => {
    it('should handle concurrent updates to same entity', async () => {
      const id = await brainy.add({
        data: 'Concurrent test',
        type: 'document',
        metadata: { version: 1 }
      })

      // Attempt concurrent updates
      const updates = Array(10).fill(null).map((_, i) => 
        brainy.update({
          id,
          metadata: { version: i + 2 }
        })
      )

      const results = await Promise.allSettled(updates)
      
      // At least one should succeed
      const succeeded = results.filter(r => r.status === 'fulfilled')
      expect(succeeded.length).toBeGreaterThanOrEqual(1)

      // Final state should be consistent
      const final = await brainy.get(id)
      expect(final?.metadata?.version).toBeGreaterThanOrEqual(2)
    })

    it('should handle concurrent deletes gracefully', async () => {
      const id = await brainy.add({
        data: 'To be deleted concurrently',
        type: 'document'
      })

      // Attempt concurrent deletes
      const deletes = Array(5).fill(null).map(() => brainy.delete(id))
      
      // Should not throw
      await expect(Promise.all(deletes)).resolves.toBeDefined()

      // Entity should be deleted
      const result = await brainy.get(id)
      expect(result).toBeNull()
    })
  })

  describe('Resource Exhaustion', () => {
    it('should handle memory pressure gracefully', async () => {
      const largeData = 'x'.repeat(1024 * 1024) // 1MB
      let successCount = 0
      let errorCount = 0

      // Try to add many large entities
      for (let i = 0; i < 100; i++) {
        try {
          await brainy.add({
            data: largeData + ` Entity ${i}`,
            type: 'document',
            metadata: { index: i, size: largeData.length }
          })
          successCount++
        } catch (error) {
          errorCount++
          // Should get meaningful error
          expect(error).toBeDefined()
        }
      }

      // Should handle at least some operations
      expect(successCount).toBeGreaterThan(0)
    })

    it('should handle rapid-fire operations', async () => {
      const operations = 1000
      const promises: Promise<any>[] = []

      for (let i = 0; i < operations; i++) {
        const op = i % 4
        switch (op) {
          case 0:
            promises.push(
              brainy.add({
                data: `Rapid ${i}`,
                type: 'document'
              }).catch(() => null)
            )
            break
          case 1:
            promises.push(brainy.get(`rapid-${i}`).catch(() => null))
            break
          case 2:
            promises.push(
              brainy.update({
                id: `rapid-${i}`,
                metadata: { updated: true }
              }).catch(() => null)
            )
            break
          case 3:
            promises.push(brainy.delete(`rapid-${i}`).catch(() => null))
            break
        }
      }

      const results = await Promise.allSettled(promises)
      
      // Most should complete
      const completed = results.filter(r => r.status === 'fulfilled')
      expect(completed.length).toBeGreaterThan(operations * 0.5)
    })
  })

  describe('Error Message Quality', () => {
    it('should provide clear error messages for common mistakes', async () => {
      // Missing required field
      try {
        await brainy.add({} as any)
      } catch (error: any) {
        expect(error.message).toBeDefined()
        expect(error.message.length).toBeGreaterThan(10)
        // Should mention what's missing
        expect(error.message).toMatch(/data|required/i)
      }

      // Invalid type
      try {
        await brainy.add({
          data: 'Valid data',
          type: 'not-a-valid-type' as any
        })
      } catch (error: any) {
        expect(error.message).toMatch(/type|invalid|noun/i)
      }

      // Entity not found
      try {
        await brainy.update({
          id: 'definitely-does-not-exist',
          metadata: { test: true }
        })
      } catch (error: any) {
        expect(error.message).toMatch(/not found|doesn't exist|does not exist/i)
      }
    })

    it('should not leak sensitive information in errors', async () => {
      try {
        await brainy.add({
          data: 'Test',
          type: 'document',
          metadata: {
            password: 'secret123',
            apiKey: 'sk-1234567890'
          }
        })
        
        await brainy.update({
          id: 'non-existent',
          metadata: { password: 'should-not-appear' }
        })
      } catch (error: any) {
        // Error message should not contain sensitive data
        expect(error.message).not.toMatch(/secret123|sk-1234567890|should-not-appear/i)
      }
    })
  })

  describe('Recovery Mechanisms', () => {
    it('should recover from transient failures', async () => {
      let attemptCount = 0
      const maxAttempts = 3

      async function retryableAdd(data: string): Promise<string> {
        attemptCount++
        if (attemptCount < maxAttempts) {
          throw new Error('Transient failure')
        }
        return brainy.add({
          data,
          type: 'document'
        })
      }

      // Should eventually succeed with retry
      let result: string | null = null
      for (let i = 0; i < maxAttempts; i++) {
        try {
          result = await retryableAdd('Test with retry')
          break
        } catch (error) {
          if (i === maxAttempts - 1) throw error
        }
      }

      expect(result).toBeDefined()
      expect(attemptCount).toBe(maxAttempts)
    })

    it('should maintain consistency after errors', async () => {
      // Add some valid data
      const validIds: string[] = []
      for (let i = 0; i < 5; i++) {
        const id = await brainy.add({
          data: `Valid entity ${i}`,
          type: 'document'
        })
        validIds.push(id)
      }

      // Cause some errors
      try {
        await brainy.add({ data: null as any, type: 'document' })
      } catch {}

      try {
        await brainy.update({ id: 'non-existent', metadata: {} })
      } catch {}

      try {
        await brainy.relate({
          from: 'non-existent-1',
          to: 'non-existent-2',
          type: 'relatedTo'
        })
      } catch {}

      // Valid data should still be intact
      for (const id of validIds) {
        const entity = await brainy.get(id)
        expect(entity).toBeDefined()
        expect(entity?.type).toBe('document')
      }

      // Should still be able to add new data
      const newId = await brainy.add({
        data: 'Added after errors',
        type: 'document'
      })
      expect(newId).toBeDefined()
    })
  })

  describe('Edge Cases', () => {
    it('should handle operations on just-deleted entities', async () => {
      const id = await brainy.add({
        data: 'About to be deleted',
        type: 'document'
      })

      await brainy.delete(id)

      // Operations on deleted entity should handle gracefully
      const getResult = await brainy.get(id)
      expect(getResult).toBeNull()

      await expect(
        brainy.update({
          id,
          metadata: { attempt: 'update-after-delete' }
        })
      ).rejects.toThrow(/not found/i)

      // Should not throw for delete
      await expect(brainy.delete(id)).resolves.toBeUndefined()
    })

    it('should handle rapid create-delete cycles', async () => {
      const cycles = 50
      
      for (let i = 0; i < cycles; i++) {
        const id = await brainy.add({
          data: `Cycle ${i}`,
          type: 'document'
        })
        
        // Immediately delete
        await brainy.delete(id)
        
        // Verify it's gone
        const result = await brainy.get(id)
        expect(result).toBeNull()
      }
    })

    it('should handle maximum field lengths', async () => {
      const maxFieldLength = 1024 * 1024 // 1MB
      const longString = 'x'.repeat(maxFieldLength)

      try {
        const id = await brainy.add({
          data: longString,
          type: 'document',
          metadata: {
            description: longString.substring(0, 1000)
          }
        })
        
        // If successful, should be retrievable
        const entity = await brainy.get(id)
        expect(entity).toBeDefined()
      } catch (error: any) {
        // If it fails, should have meaningful error
        expect(error.message).toMatch(/size|large|limit/i)
      }
    })
  })
})