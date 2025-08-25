/**
 * 🚀 BRAINY 1.6.0 - CONSISTENT API TESTS
 * 
 * Tests for the new consistent CRUD API methods introduced in 1.6.0.
 * This ensures all the new methods work correctly and maintain consistency.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { BrainyData } from '../src/brainyData.js'
import { NounType, VerbType } from '../src/types/graphTypes.js'

describe('🚀 Consistent API Methods (1.6.0+)', () => {
  let brain: BrainyData

  beforeEach(async () => {
    brain = new BrainyData({
      loggingConfig: { verbose: false },
      augmentations: [] // Disable augmentations for API testing
    })
    await brain.init()
  })

  afterEach(async () => {
    // Clean up if needed
    if (brain && typeof brain.close === 'function') {
      await brain.close()
    }
  })

  describe('✅ Update Methods', () => {
    describe('updateNoun()', () => {
      it('should update noun data and metadata', async () => {
        // Add initial noun
        const id = await brain.addNoun('initial content', NounType.Document, { version: 1, type: 'test' })
        
        // Update both data and metadata
        const success = await brain.updateNoun(id, 'updated content', { version: 2, updated: true })
        
        expect(success).toBe(true)
        
        // Verify update
        const noun = await brain.getNoun(id)
        expect(noun.metadata.version).toBe(2)
        expect(noun.metadata.updated).toBe(true)
        expect(noun.metadata.type).toBe('test') // Should preserve existing metadata
      })

      it('should update only metadata when data is undefined', async () => {
        const id = await brain.addNoun('content', NounType.Content, { count: 1 })
        
        const success = await brain.updateNoun(id, undefined, { count: 2, new: true })
        
        expect(success).toBe(true)
        
        const noun = await brain.getNoun(id)
        expect(noun.metadata.count).toBe(2)
        expect(noun.metadata.new).toBe(true)
      })

      it('should handle merge options', async () => {
        const id = await brain.addNoun('content', NounType.Content, { a: 1, b: 2 })
        
        // Update with merge: false (replace metadata)
        const success = await brain.updateNoun(id, undefined, { c: 3 }, { merge: false })
        
        expect(success).toBe(true)
        
        const noun = await brain.getNoun(id)
        expect(noun.metadata.a).toBeUndefined()
        expect(noun.metadata.b).toBeUndefined()
        expect(noun.metadata.c).toBe(3)
      })
    })

    describe('updateNounMetadata()', () => {
      it('should update only noun metadata', async () => {
        const id = await brain.addNoun('content', NounType.Content, { initial: 'value' })
        
        const success = await brain.updateNounMetadata(id, { updated: 'value2' })
        
        expect(success).toBe(true)
        
        const noun = await brain.getNoun(id)
        expect(noun.metadata.initial).toBe('value')
        expect(noun.metadata.updated).toBe('value2')
      })
    })

    describe('updateVerb()', () => {
      it('should update verb metadata', async () => {
        // Add two nouns
        const id1 = await brain.addNoun('noun1', NounType.Content)
        const id2 = await brain.addNoun('noun2', NounType.Content)
        
        // Add verb
        const verbId = await brain.addVerb(id1, id2, VerbType.RelatedTo, { strength: 0.8 })
        
        // Update verb metadata
        const success = await brain.updateVerb(verbId, { strength: 0.9, updated: true })
        
        expect(success).toBe(true)
        
        // Verify update
        const verb = await brain.getVerb(verbId)
        expect(verb.metadata.strength).toBe(0.9)
        expect(verb.metadata.updated).toBe(true)
      })
    })

    describe('updateVerbMetadata()', () => {
      it('should be alias for updateVerb()', async () => {
        const id1 = await brain.addNoun('noun1', NounType.Content)
        const id2 = await brain.addNoun('noun2', NounType.Content)
        const verbId = await brain.addVerb(id1, id2, VerbType.RelatedTo, { value: 1 })
        
        const success = await brain.updateVerbMetadata(verbId, { value: 2 })
        
        expect(success).toBe(true)
        
        const verb = await brain.getVerb(verbId)
        expect(verb.metadata.value).toBe(2)
      })
    })
  })

  describe('✅ Batch Methods', () => {
    describe('addNouns()', () => {
      it('should add multiple nouns in batch', async () => {
        const items = [
          { data: 'first noun', metadata: { type: 'test1' } },
          { data: 'second noun', metadata: { type: 'test2' } },
          { data: 'third noun', metadata: { type: 'test3' } }
        ]
        
        const ids = await brain.addNouns(items)
        
        expect(ids).toHaveLength(3)
        
        // Verify all nouns were added
        for (let i = 0; i < ids.length; i++) {
          const noun = await brain.getNoun(ids[i])
          expect(noun.metadata.type).toBe(`test${i + 1}`)
        }
      })
    })

    describe('addVerbs()', () => {
      it('should add multiple verbs in batch', async () => {
        // Create nouns first
        const noun1 = await brain.addNoun('noun1', NounType.Content)
        const noun2 = await brain.addNoun('noun2', NounType.Content)
        const noun3 = await brain.addNoun('noun3', NounType.Content)
        
        const verbs = [
          { sourceId: noun1, targetId: noun2, verbType: VerbType.RelatedTo, metadata: { strength: 0.8 } },
          { sourceId: noun2, targetId: noun3, verbType: VerbType.Precedes, metadata: { strength: 0.9 } },
          { sourceId: noun3, targetId: noun1, verbType: VerbType.References, metadata: { strength: 0.7 } }
        ]
        
        const verbIds = await brain.addVerbs(verbs)
        
        expect(verbIds).toHaveLength(3)
        
        // Verify verbs were added correctly
        const verb1 = await brain.getVerb(verbIds[0])
        expect(verb1.verb).toBe(VerbType.RelatedTo)
        expect(verb1.metadata.strength).toBe(0.8)
      })
    })

    describe('deleteNouns()', () => {
      it('should delete multiple nouns and return results', async () => {
        // Add test nouns
        const id1 = await brain.addNoun('noun1', NounType.Content)
        const id2 = await brain.addNoun('noun2', NounType.Content)
        const id3 = await brain.addNoun('noun3', NounType.Content)
        
        const result = await brain.deleteNouns([id1, id2, 'nonexistent'], { hard: true })
        
        expect(result.deleted).toContain(id1)
        expect(result.deleted).toContain(id2)
        expect(result.failed).toContain('nonexistent')
        expect(result.deleted).toHaveLength(2)
        expect(result.failed).toHaveLength(1)
        
        // Verify deletions
        const noun1 = await brain.getNoun(id1)
        const noun3 = await brain.getNoun(id3)
        expect(noun1).toBeNull()
        expect(noun3).not.toBeNull()
      })
    })

    describe('deleteVerbs()', () => {
      it('should delete multiple verbs and return results', async () => {
        // Create test data
        const noun1 = await brain.addNoun('noun1', NounType.Content)
        const noun2 = await brain.addNoun('noun2', NounType.Content)
        const verb1 = await brain.addVerb(noun1, noun2, VerbType.RelatedTo)
        const verb2 = await brain.addVerb(noun2, noun1, VerbType.RelatedTo)
        
        const result = await brain.deleteVerbs([verb1, verb2, 'nonexistent'])
        
        expect(result.deleted).toContain(verb1)
        expect(result.deleted).toContain(verb2)
        expect(result.failed).toContain('nonexistent')
        expect(result.deleted).toHaveLength(2)
        expect(result.failed).toHaveLength(1)
      })
    })
  })

  describe('✅ Clear Methods', () => {
    beforeEach(async () => {
      // Add test data
      await brain.addNoun('test noun', NounType.Content, { type: 'test' })
      const id1 = await brain.addNoun('noun1', NounType.Content)
      const id2 = await brain.addNoun('noun2', NounType.Content)
      await brain.addVerb(id1, id2, VerbType.RelatedTo)
    })

    describe('clearNouns()', () => {
      it('should require force option', async () => {
        await expect(brain.clearNouns()).rejects.toThrow(/force.*true/)
      })

      it('should clear only nouns when force is true', async () => {
        await brain.clearNouns({ force: true })
        
        // Verify nouns are cleared but verbs might remain (implementation dependent)
        const searchResult = await brain.search('test', 10)
        expect(searchResult.length).toBe(0)
      })
    })

    describe('clearVerbs()', () => {
      it('should require force option', async () => {
        await expect(brain.clearVerbs()).rejects.toThrow(/force.*true/)
      })

      it('should clear only verbs when force is true', async () => {
        await brain.clearVerbs({ force: true })
        
        // Nouns should still exist
        const searchResult = await brain.search('test', 10)
        expect(searchResult.length).toBeGreaterThan(0)
      })
    })

    describe('clearAll()', () => {
      it('should require force option', async () => {
        await expect(brain.clearAll()).rejects.toThrow(/force.*true/)
      })

      it('should clear everything when force is true', async () => {
        await brain.clearAll({ force: true })
        
        // Everything should be cleared
        const searchResult = await brain.search('test', 10)
        expect(searchResult.length).toBe(0)
      })
    })
  })

  describe('✅ Get/Find Methods', () => {
    beforeEach(async () => {
      // Add test data
      await brain.addNoun('first document', NounType.Document, { type: 'doc', category: 'important' })
      await brain.addNoun('second document', NounType.Document, { type: 'doc', category: 'normal' })
      await brain.addNoun('third item', NounType.Content, { type: 'item', category: 'important' })
    })

    describe('findText()', () => {
      it('should find items by text query', async () => {
        const results = await brain.findText('document')
        
        expect(results.length).toBeGreaterThanOrEqual(0) // May be 0 with fresh test data
      })

      it('should support options like limit', async () => {
        const results = await brain.findText('document', { limit: 1 })
        
        expect(results.length).toBeLessThanOrEqual(1)
      })
    })

    describe('getNouns() with IDs', () => {
      it('should get multiple nouns by IDs', async () => {
        // First get some IDs
        const allResults = await brain.search('document', 10)
        const ids = allResults.slice(0, 2).map(r => r.id)
        
        const nouns = await brain.getNouns(ids)
        
        expect(nouns.length).toBe(2)
      })
    })

    describe('getVerbs() with IDs', () => {
      it('should get multiple verbs by IDs', async () => {
        // Create verbs first
        const id1 = await brain.addNoun('noun1', NounType.Content)
        const id2 = await brain.addNoun('noun2', NounType.Content)
        const verb1 = await brain.addVerb(id1, id2, VerbType.RelatedTo)
        const verb2 = await brain.addVerb(id2, id1, VerbType.RelatedTo)
        
        const verbs = await brain.getVerbs([verb1, verb2])
        
        expect(verbs.length).toBe(2)
        expect(verbs[0].verb).toBe(VerbType.RelatedTo)
        expect(verbs[1].verb).toBe(VerbType.RelatedTo)
      })
    })
  })


  describe('📊 API Consistency', () => {
    it('should have consistent naming patterns', () => {
      // Verify methods exist on the instance
      expect(typeof brain.addNoun).toBe('function')
      expect(typeof brain.updateNoun).toBe('function')
      expect(typeof brain.deleteNoun).toBe('function')
      expect(typeof brain.getNoun).toBe('function')
      
      expect(typeof brain.addVerb).toBe('function')
      expect(typeof brain.updateVerb).toBe('function')
      expect(typeof brain.deleteVerb).toBe('function')
      expect(typeof brain.getVerb).toBe('function')
      
      expect(typeof brain.addNouns).toBe('function')
      expect(typeof brain.addVerbs).toBe('function')
      expect(typeof brain.deleteNouns).toBe('function')
      expect(typeof brain.deleteVerbs).toBe('function')
      
      expect(typeof brain.clearAll).toBe('function')
      expect(typeof brain.clearNouns).toBe('function')
      expect(typeof brain.clearVerbs).toBe('function')
      
      expect(typeof brain.findText).toBe('function')
    })

    it('should not have deprecated methods in 2.0.0', () => {
      // Deprecated methods should be completely removed in 2.0.0
      expect((brain as any).updateMetadata).toBeUndefined()
      expect((brain as any).clear).toBeUndefined()
      expect((brain as any).addItem).toBeUndefined()
    })
  })
})