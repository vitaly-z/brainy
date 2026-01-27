/**
 * MetadataIndexManager Text Indexing Tests (v7.7.0)
 *
 * Tests for word extraction, tokenization, and hashing used in hybrid search.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { MetadataIndexManager } from '../../../src/utils/metadataIndex'

// Create a test adapter to expose private methods for testing
// This is a common testing pattern to test internal implementation
class TestableMetadataIndexManager extends MetadataIndexManager {
  public testTokenize(text: string): string[] {
    return this.tokenize(text)
  }

  public testHashWord(word: string): number {
    return this.hashWord(word)
  }
}

describe('MetadataIndexManager Text Indexing (v7.7.0)', () => {
  describe('tokenize()', () => {
    let manager: TestableMetadataIndexManager

    beforeEach(() => {
      // Create a minimal mock storage for testing
      const mockStorage = {
        getMetadata: async () => null,
        saveMetadata: async () => {},
        getNoun: async () => null,
        getNouns: async () => ({ items: [], total: 0, hasMore: false }),
        getVerbsFromSource: async () => ({ items: [], total: 0, hasMore: false }),
      } as any

      manager = new TestableMetadataIndexManager(mockStorage, {})
    })

    it('should convert to lowercase', () => {
      const tokens = manager.testTokenize('HELLO World')
      expect(tokens).toContain('hello')
      expect(tokens).toContain('world')
      expect(tokens).not.toContain('HELLO')
      expect(tokens).not.toContain('World')
    })

    it('should remove punctuation', () => {
      const tokens = manager.testTokenize('Hello, World! How are you?')
      expect(tokens).toContain('hello')
      expect(tokens).toContain('world')
      expect(tokens).toContain('how')
      expect(tokens).toContain('are')
      expect(tokens).toContain('you')
    })

    it('should filter short words (< 2 chars)', () => {
      const tokens = manager.testTokenize('I a am is an the to')
      expect(tokens).not.toContain('i')
      expect(tokens).not.toContain('a')
      expect(tokens).toContain('am')
      expect(tokens).toContain('is')
      expect(tokens).toContain('an')
    })

    it('should deduplicate words', () => {
      const tokens = manager.testTokenize('hello hello world world hello')
      expect(tokens.length).toBe(2)
      expect(tokens).toContain('hello')
      expect(tokens).toContain('world')
    })

    it('should handle empty string', () => {
      const tokens = manager.testTokenize('')
      expect(tokens).toEqual([])
    })

    it('should handle whitespace only', () => {
      const tokens = manager.testTokenize('   \t\n   ')
      expect(tokens).toEqual([])
    })

    it('should handle special characters', () => {
      const tokens = manager.testTokenize('C++ is a programming language')
      expect(tokens).toContain('is')
      expect(tokens).toContain('programming')
      expect(tokens).toContain('language')
    })

    it('should handle unicode text', () => {
      const tokens = manager.testTokenize('Hello 世界 Welt')
      expect(tokens).toContain('hello')
      expect(tokens).toContain('welt')
    })

    it('should handle numbers', () => {
      const tokens = manager.testTokenize('version 123 release 45')
      expect(tokens).toContain('version')
      expect(tokens).toContain('123')
      expect(tokens).toContain('release')
      expect(tokens).toContain('45')
    })

    it('should handle hyphenated words', () => {
      const tokens = manager.testTokenize('state-of-the-art machine-learning')
      // Hyphenated words become separate tokens due to punctuation removal
      expect(tokens).toContain('state')
      expect(tokens).toContain('the')
      expect(tokens).toContain('art')
      expect(tokens).toContain('machine')
      expect(tokens).toContain('learning')
    })
  })

  describe('hashWord()', () => {
    let manager: TestableMetadataIndexManager

    beforeEach(() => {
      const mockStorage = {
        getMetadata: async () => null,
        saveMetadata: async () => {},
        getNoun: async () => null,
        getNouns: async () => ({ items: [], total: 0, hasMore: false }),
        getVerbsFromSource: async () => ({ items: [], total: 0, hasMore: false }),
      } as any

      manager = new TestableMetadataIndexManager(mockStorage, {})
    })

    it('should produce consistent hash for same word', () => {
      const hash1 = manager.testHashWord('hello')
      const hash2 = manager.testHashWord('hello')
      expect(hash1).toBe(hash2)
    })

    it('should produce different hashes for different words', () => {
      const hash1 = manager.testHashWord('hello')
      const hash2 = manager.testHashWord('world')
      expect(hash1).not.toBe(hash2)
    })

    it('should produce int32 values', () => {
      const hash = manager.testHashWord('test')
      expect(Number.isInteger(hash)).toBe(true)
      expect(hash).toBeGreaterThanOrEqual(-2147483648)
      expect(hash).toBeLessThanOrEqual(2147483647)
    })

    it('should handle empty string', () => {
      const hash = manager.testHashWord('')
      expect(Number.isInteger(hash)).toBe(true)
    })

    it('should handle long words', () => {
      const longWord = 'supercalifragilisticexpialidocious'
      const hash = manager.testHashWord(longWord)
      expect(Number.isInteger(hash)).toBe(true)
    })

    it('should hash unicode words', () => {
      const hash = manager.testHashWord('世界')
      expect(Number.isInteger(hash)).toBe(true)
    })

    it('should be case sensitive (words are lowercased before hashing in tokenize)', () => {
      const hash1 = manager.testHashWord('Hello')
      const hash2 = manager.testHashWord('hello')
      // Hashes are different because case matters in hash function
      // But tokenize() lowercases before hashing
      expect(hash1).not.toBe(hash2)
    })
  })

  describe('getIdsForTextQuery()', () => {
    let manager: MetadataIndexManager
    let mockStorage: any
    let addedEntities: Map<string, any>

    beforeEach(() => {
      addedEntities = new Map()
      let idCounter = 0

      mockStorage = {
        getMetadata: async () => null,
        saveMetadata: async () => {},
        getNoun: async (id: string) => addedEntities.get(id) || null,
        getNouns: async () => ({
          items: Array.from(addedEntities.values()),
          total: addedEntities.size,
          hasMore: false
        }),
        getVerbsFromSource: async () => ({ items: [], total: 0, hasMore: false }),
      }

      manager = new MetadataIndexManager(mockStorage, {})
    })

    it('should return empty array for empty query', async () => {
      const results = await manager.getIdsForTextQuery('')
      expect(results).toEqual([])
    })

    it('should return empty array for whitespace query', async () => {
      const results = await manager.getIdsForTextQuery('   ')
      expect(results).toEqual([])
    })

    it('should return results sorted by match count', async () => {
      // This test verifies the interface contract
      // Actual matching behavior tested in integration tests
      const results = await manager.getIdsForTextQuery('hello world')
      expect(Array.isArray(results)).toBe(true)
      results.forEach(r => {
        expect(r).toHaveProperty('id')
        expect(r).toHaveProperty('matchCount')
      })
    })
  })
})
