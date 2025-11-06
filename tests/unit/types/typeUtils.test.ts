import { describe, test, expect } from 'vitest'
import {
  NounType,
  VerbType,
  NounTypeEnum,
  VerbTypeEnum,
  TypeUtils,
  TypeMetadata,
  NOUN_TYPE_COUNT,
  VERB_TYPE_COUNT
} from '../../../src/types/graphTypes.js'

describe('Type System Foundation', () => {
  describe('Type Counts', () => {
    test('should have exactly 42 noun types', () => {
      expect(NOUN_TYPE_COUNT).toBe(42)
      expect(Object.keys(NounTypeEnum).length / 2).toBe(42) // Enums have reverse mapping
    })

    test('should have exactly 127 verb types', () => {
      expect(VERB_TYPE_COUNT).toBe(127)
      expect(Object.keys(VerbTypeEnum).length / 2).toBe(127) // Enums have reverse mapping
    })
  })

  describe('NounTypeEnum', () => {
    test('should map person to index 0', () => {
      expect(NounTypeEnum.person).toBe(0)
    })

    test('should map resource to index 34', () => {
      expect(NounTypeEnum.resource).toBe(34)
    })

    test('should have contiguous indices from 0 to 41', () => {
      const indices = Object.values(NounTypeEnum).filter(v => typeof v === 'number')
      expect(indices).toHaveLength(42)
      expect(Math.min(...indices)).toBe(0)
      expect(Math.max(...indices)).toBe(41)
    })
  })

  describe('VerbTypeEnum', () => {
    test('should map relatedTo to index 3', () => {
      expect(VerbTypeEnum.relatedTo).toBe(3)
    })

    test('should map competes to index 50', () => {
      expect(VerbTypeEnum.competes).toBe(50)
    })

    test('should have contiguous indices from 0 to 126', () => {
      const indices = Object.values(VerbTypeEnum).filter(v => typeof v === 'number')
      expect(indices).toHaveLength(127)
      expect(Math.min(...indices)).toBe(0)
      expect(Math.max(...indices)).toBe(126)
    })
  })

  describe('TypeUtils.getNounIndex', () => {
    test('should return correct index for person', () => {
      expect(TypeUtils.getNounIndex(NounType.Person)).toBe(0)
    })

    test('should return correct index for document', () => {
      expect(TypeUtils.getNounIndex(NounType.Document)).toBe(13)
    })

    test('should return correct index for resource', () => {
      expect(TypeUtils.getNounIndex(NounType.Resource)).toBe(34)
    })

    test('should work for all noun types', () => {
      const allTypes = Object.values(NounType)
      expect(allTypes).toHaveLength(42)

      for (const type of allTypes) {
        const index = TypeUtils.getNounIndex(type)
        expect(index).toBeGreaterThanOrEqual(0)
        expect(index).toBeLessThanOrEqual(41)
      }
    })
  })

  describe('TypeUtils.getVerbIndex', () => {
    test('should return correct index for relatedTo', () => {
      expect(TypeUtils.getVerbIndex(VerbType.RelatedTo)).toBe(3)
    })

    test('should return correct index for creates', () => {
      expect(TypeUtils.getVerbIndex(VerbType.Creates)).toBe(17)
    })

    test('should return correct index for competes', () => {
      expect(TypeUtils.getVerbIndex(VerbType.Competes)).toBe(50)
    })

    test('should work for all verb types', () => {
      const allTypes = Object.values(VerbType)
      expect(allTypes).toHaveLength(127)

      for (const type of allTypes) {
        const index = TypeUtils.getVerbIndex(type)
        expect(index).toBeGreaterThanOrEqual(0)
        expect(index).toBeLessThanOrEqual(126)
      }
    })
  })

  describe('TypeUtils.getNounFromIndex', () => {
    test('should return correct type for index 0', () => {
      expect(TypeUtils.getNounFromIndex(0)).toBe(NounType.Person)
    })

    test('should return correct type for index 6', () => {
      expect(TypeUtils.getNounFromIndex(6)).toBe(NounType.Document)
    })

    test('should return correct type for index 30', () => {
      expect(TypeUtils.getNounFromIndex(30)).toBe(NounType.Resource)
    })

    test('should return default for invalid index', () => {
      expect(TypeUtils.getNounFromIndex(999)).toBe(NounType.Thing)
      expect(TypeUtils.getNounFromIndex(-1)).toBe(NounType.Thing)
    })

    test('should round-trip with getNounIndex', () => {
      for (let i = 0; i < 31; i++) {
        const type = TypeUtils.getNounFromIndex(i)
        const index = TypeUtils.getNounIndex(type)
        expect(index).toBe(i)
      }
    })
  })

  describe('TypeUtils.getVerbFromIndex', () => {
    test('should return correct type for index 0', () => {
      expect(TypeUtils.getVerbFromIndex(0)).toBe(VerbType.RelatedTo)
    })

    test('should return correct type for index 10', () => {
      expect(TypeUtils.getVerbFromIndex(10)).toBe(VerbType.Creates)
    })

    test('should return correct type for index 39', () => {
      expect(TypeUtils.getVerbFromIndex(39)).toBe(VerbType.Competes)
    })

    test('should return default for invalid index', () => {
      expect(TypeUtils.getVerbFromIndex(999)).toBe(VerbType.RelatedTo)
      expect(TypeUtils.getVerbFromIndex(-1)).toBe(VerbType.RelatedTo)
    })

    test('should round-trip with getVerbIndex', () => {
      for (let i = 0; i < 40; i++) {
        const type = TypeUtils.getVerbFromIndex(i)
        const index = TypeUtils.getVerbIndex(type)
        expect(index).toBe(i)
      }
    })
  })

  describe('TypeMetadata', () => {
    test('should have metadata for all 31 noun types', () => {
      const allTypes = Object.values(NounType)
      expect(allTypes).toHaveLength(31)

      for (const type of allTypes) {
        const meta = TypeMetadata[type]
        expect(meta).toBeDefined()
        expect(meta.expectedFields).toBeGreaterThan(0)
        expect(meta.bloomBits).toBeGreaterThan(0)
        expect(meta.avgChunkSize).toBeGreaterThan(0)
      }
    })

    test('should use 256 bits for high-field types', () => {
      expect(TypeMetadata.person.bloomBits).toBe(256)
      expect(TypeMetadata.organization.bloomBits).toBe(256)
      expect(TypeMetadata.document.bloomBits).toBe(256)
    })

    test('should use 128 bits for low-field types', () => {
      expect(TypeMetadata.state.bloomBits).toBe(128)
      expect(TypeMetadata.language.bloomBits).toBe(128)
      expect(TypeMetadata.currency.bloomBits).toBe(128)
    })

    test('should have reasonable field counts', () => {
      // Person has many fields
      expect(TypeMetadata.person.expectedFields).toBeGreaterThanOrEqual(8)

      // State has few fields
      expect(TypeMetadata.state.expectedFields).toBeLessThanOrEqual(5)
    })

    test('should have reasonable chunk sizes', () => {
      for (const type of Object.values(NounType)) {
        const meta = TypeMetadata[type]
        expect(meta.avgChunkSize).toBeGreaterThanOrEqual(30)
        expect(meta.avgChunkSize).toBeLessThanOrEqual(100)
      }
    })
  })

  describe('Fixed-Size Array Optimization', () => {
    test('should enable O(1) type tracking with Uint32Array', () => {
      const entityCountsByType = new Uint32Array(NOUN_TYPE_COUNT)

      // Simulate adding entities
      entityCountsByType[TypeUtils.getNounIndex(NounType.Person)] = 1000
      entityCountsByType[TypeUtils.getNounIndex(NounType.Document)] = 500

      expect(entityCountsByType[0]).toBe(1000) // person
      expect(entityCountsByType[6]).toBe(500) // document
      expect(entityCountsByType.length).toBe(42)
      expect(entityCountsByType.byteLength).toBe(168) // 42 × 4 bytes
    })

    test('should enable O(1) verb tracking with Uint32Array', () => {
      const verbCountsByType = new Uint32Array(VERB_TYPE_COUNT)

      // Simulate adding verbs
      verbCountsByType[TypeUtils.getVerbIndex(VerbType.RelatedTo)] = 5000
      verbCountsByType[TypeUtils.getVerbIndex(VerbType.Creates)] = 2000

      expect(verbCountsByType[0]).toBe(5000) // relatedTo
      expect(verbCountsByType[10]).toBe(2000) // creates
      expect(verbCountsByType.length).toBe(127)
      expect(verbCountsByType.byteLength).toBe(508) // 127 × 4 bytes
    })
  })

  describe('Memory Efficiency', () => {
    test('should use minimal memory for type tracking', () => {
      const entityCounts = new Uint32Array(NOUN_TYPE_COUNT)
      const verbCounts = new Uint32Array(VERB_TYPE_COUNT)

      const totalBytes = entityCounts.byteLength + verbCounts.byteLength
      expect(totalBytes).toBe(676) // 168 + 508 = 676 bytes (vs ~60KB with Maps)
    })
  })
})
