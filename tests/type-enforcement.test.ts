import { describe, it, expect, beforeEach } from 'vitest'
import { BrainyData } from '../src/brainyData.js'
import { NounType, VerbType } from '../src/types/graphTypes.js'
import { validateNounType, validateVerbType } from '../src/utils/typeValidation.js'

describe('Type Enforcement System', () => {
  describe('Type Validation Module', () => {
    it('should validate correct noun types', () => {
      expect(validateNounType(NounType.Person)).toBe('person')
      expect(validateNounType('organization')).toBe('organization')
      expect(validateNounType(NounType.Document)).toBe('document')
    })

    it('should reject invalid noun types with helpful errors', () => {
      expect(() => validateNounType('invalid')).toThrow('Invalid noun type')
      expect(() => validateNounType('')).toThrow('Invalid noun type')
      expect(() => validateNounType(null)).toThrow('Invalid noun type')
      expect(() => validateNounType(undefined)).toThrow('Invalid noun type')
    })

    it('should provide helpful suggestions for typos', () => {
      expect(() => validateNounType('persan')).toThrow(/Did you mean 'person'/)
      expect(() => validateNounType('doc')).toThrow(/Did you mean 'document'/)
      expect(() => validateNounType('org')).toThrow(/Did you mean 'organization'/)
    })

    it('should validate correct verb types', () => {
      expect(validateVerbType(VerbType.RelatedTo)).toBe('relatedTo')
      expect(validateVerbType('contains')).toBe('contains')
      expect(validateVerbType(VerbType.Creates)).toBe('creates')
    })
  })

  describe('addNoun with Type Enforcement', () => {
    let brain: BrainyData

    beforeEach(async () => {
      brain = new BrainyData({ 
        storage: { forceMemoryStorage: true },
        logging: { verbose: false }
      })
      await brain.init()
    })

    it('should require noun type parameter', async () => {
      // TypeScript should prevent this, but test runtime validation
      await expect(
        (brain.addNoun as any)('Test data', { title: 'Test' })
      ).rejects.toThrow()
    })

    it('should accept valid noun type', async () => {
      const id = await brain.addNoun('John Doe', NounType.Person, { age: 30 })
      expect(id).toBeDefined()
      
      const noun = await brain.getNoun(id)
      expect(noun.metadata.noun).toBe('person')
      expect(noun.metadata.age).toBe(30)
    })

    it('should accept noun type as string', async () => {
      const id = await brain.addNoun('Document content', 'document', {
        title: 'Important Doc',
        author: 'Jane'
      })
      expect(id).toBeDefined()
      
      const noun = await brain.getNoun(id)
      expect(noun.metadata.noun).toBe('document')
      expect(noun.metadata.title).toBe('Important Doc')
    })

    it('should validate noun type and reject invalid ones', async () => {
      await expect(
        brain.addNoun('Test', 'invalidType', {})
      ).rejects.toThrow('Invalid noun type')
    })

    it('should provide suggestions for typos', async () => {
      await expect(
        brain.addNoun('Test', 'persan', {})
      ).rejects.toThrow(/Did you mean 'person'/)
    })
  })

  describe('Type Validation Performance', () => {
    it('should validate types quickly (O(1) with Set)', () => {
      const start = performance.now()
      
      // Validate 10000 types
      for (let i = 0; i < 10000; i++) {
        validateNounType(NounType.Person)
        validateVerbType(VerbType.Contains)
      }
      
      const end = performance.now()
      const duration = end - start
      
      // Should complete in less than 50ms (very generous, usually < 5ms)
      expect(duration).toBeLessThan(50)
    })
  })
})