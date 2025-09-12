import { describe, it, expect, beforeEach } from 'vitest'
import {
  validateFindParams,
  validateAddParams,
  validateUpdateParams,
  validateRelateParams,
  getValidationConfig,
  recordQueryPerformance
} from '../../../src/utils/paramValidation.js'
import { NounType, VerbType } from '../../../src/types/graphTypes.js'
import { FindParams, AddParams, UpdateParams, RelateParams } from '../../../src/types/brainy.types.js'

describe('Zero-Config Parameter Validation', () => {
  
  describe('validateFindParams', () => {
    
    it('should accept valid parameters', () => {
      expect(() => validateFindParams({
        query: 'test query',
        limit: 10,
        offset: 0
      })).not.toThrow()
      
      expect(() => validateFindParams({
        type: NounType.Document,
        where: { status: 'active' }
      })).not.toThrow()
    })
    
    it('should reject negative limit', () => {
      expect(() => validateFindParams({
        limit: -1
      })).toThrow('limit must be non-negative')
    })
    
    it('should reject negative offset', () => {
      expect(() => validateFindParams({
        offset: -1
      })).toThrow('offset must be non-negative')
    })
    
    it('should reject threshold outside 0-1 range', () => {
      expect(() => validateFindParams({
        near: { id: 'test', threshold: -0.1 }
      })).toThrow('threshold must be between 0 and 1')
      
      expect(() => validateFindParams({
        near: { id: 'test', threshold: 1.1 }
      })).toThrow('threshold must be between 0 and 1')
    })
    
    it('should reject both query and vector', () => {
      expect(() => validateFindParams({
        query: 'test',
        vector: new Array(384).fill(0)
      })).toThrow('cannot specify both query and vector')
    })
    
    it('should reject both cursor and offset', () => {
      expect(() => validateFindParams({
        cursor: 'abc123',
        offset: 10
      })).toThrow('cannot use both cursor and offset pagination')
    })
    
    it('should validate vector dimensions', () => {
      expect(() => validateFindParams({
        vector: new Array(100).fill(0) // Wrong dimensions
      })).toThrow('vector must have exactly 384 dimensions')
      
      expect(() => validateFindParams({
        vector: new Array(384).fill(0) // Correct dimensions
      })).not.toThrow()
    })
    
    it('should validate NounType enum', () => {
      expect(() => validateFindParams({
        type: 'InvalidType' as any
      })).toThrow('invalid NounType: InvalidType')
      
      expect(() => validateFindParams({
        type: NounType.Document
      })).not.toThrow()
    })
    
    it('should validate array of NounTypes', () => {
      expect(() => validateFindParams({
        type: [NounType.Document, NounType.Person]
      })).not.toThrow()
      
      expect(() => validateFindParams({
        type: [NounType.Document, 'InvalidType' as any]
      })).toThrow('invalid NounType: InvalidType')
    })
    
    it('should auto-limit based on system memory', () => {
      const config = getValidationConfig()
      
      // Should reject limits above auto-configured max
      expect(() => validateFindParams({
        limit: config.maxLimit + 1
      })).toThrow(`limit exceeds auto-configured maximum of ${config.maxLimit}`)
      
      // Should accept limits at or below max
      expect(() => validateFindParams({
        limit: config.maxLimit
      })).not.toThrow()
    })
    
    it('should auto-limit query length', () => {
      const config = getValidationConfig()
      const longQuery = 'a'.repeat(config.maxQueryLength + 1)
      
      expect(() => validateFindParams({
        query: longQuery
      })).toThrow(`query exceeds auto-configured maximum length of ${config.maxQueryLength}`)
    })
  })
  
  describe('validateAddParams', () => {
    
    it('should accept valid add parameters', () => {
      expect(() => validateAddParams({
        data: 'test content',
        type: NounType.Document
      })).not.toThrow()
      
      expect(() => validateAddParams({
        vector: new Array(384).fill(0),
        type: NounType.Person
      })).not.toThrow()
    })
    
    it('should require either data or vector', () => {
      expect(() => validateAddParams({
        type: NounType.Document
      } as AddParams)).toThrow('must provide either data or vector')
    })
    
    it('should validate NounType', () => {
      expect(() => validateAddParams({
        data: 'test',
        type: 'InvalidType' as any
      })).toThrow('invalid NounType: InvalidType')
    })
    
    it('should validate vector dimensions', () => {
      expect(() => validateAddParams({
        vector: new Array(100).fill(0),
        type: NounType.Document
      })).toThrow('vector must have exactly 384 dimensions')
    })
  })
  
  describe('validateUpdateParams', () => {
    
    it('should accept valid update parameters', () => {
      expect(() => validateUpdateParams({
        id: 'test-id',
        data: 'new content'
      })).not.toThrow()
      
      expect(() => validateUpdateParams({
        id: 'test-id',
        metadata: { status: 'updated' }
      })).not.toThrow()
    })
    
    it('should require an ID', () => {
      expect(() => validateUpdateParams({
        data: 'new content'
      } as UpdateParams)).toThrow('id is required for update')
    })
    
    it('should require at least one field to update', () => {
      expect(() => validateUpdateParams({
        id: 'test-id'
      })).toThrow('must specify at least one field to update')
    })
    
    it('should validate NounType if changing', () => {
      expect(() => validateUpdateParams({
        id: 'test-id',
        type: 'InvalidType' as any
      })).toThrow('invalid NounType: InvalidType')
      
      expect(() => validateUpdateParams({
        id: 'test-id',
        type: NounType.Event
      })).not.toThrow()
    })
  })
  
  describe('validateRelateParams', () => {
    
    it('should accept valid relate parameters', () => {
      expect(() => validateRelateParams({
        from: 'entity1',
        to: 'entity2',
        type: VerbType.RelatedTo
      })).not.toThrow()
      
      expect(() => validateRelateParams({
        from: 'entity1',
        to: 'entity2',
        type: VerbType.Creates,
        weight: 0.8
      })).not.toThrow()
    })
    
    it('should require from and to', () => {
      expect(() => validateRelateParams({
        to: 'entity2',
        type: VerbType.RelatedTo
      } as RelateParams)).toThrow('from entity ID is required')
      
      expect(() => validateRelateParams({
        from: 'entity1',
        type: VerbType.RelatedTo
      } as RelateParams)).toThrow('to entity ID is required')
    })
    
    it('should reject self-referential relationships', () => {
      expect(() => validateRelateParams({
        from: 'entity1',
        to: 'entity1',
        type: VerbType.RelatedTo
      })).toThrow('cannot create self-referential relationship')
    })
    
    it('should validate VerbType', () => {
      expect(() => validateRelateParams({
        from: 'entity1',
        to: 'entity2',
        type: 'InvalidVerb' as any
      })).toThrow('invalid VerbType: InvalidVerb')
    })
    
    it('should validate weight range', () => {
      expect(() => validateRelateParams({
        from: 'entity1',
        to: 'entity2',
        type: VerbType.RelatedTo,
        weight: -0.1
      })).toThrow('weight must be between 0 and 1')
      
      expect(() => validateRelateParams({
        from: 'entity1',
        to: 'entity2',
        type: VerbType.RelatedTo,
        weight: 1.1
      })).toThrow('weight must be between 0 and 1')
    })
  })
  
  describe('Auto-configuration', () => {
    
    it('should provide configuration based on system resources', () => {
      const config = getValidationConfig()
      
      expect(config.maxLimit).toBeGreaterThan(0)
      expect(config.maxLimit).toBeLessThanOrEqual(100000)
      expect(config.maxQueryLength).toBeGreaterThan(0)
      expect(config.maxVectorDimensions).toBe(384)
      expect(config.systemMemory).toBeGreaterThan(0)
      expect(config.availableMemory).toBeGreaterThan(0)
    })
    
    it('should adapt limits based on query performance', () => {
      const initialConfig = getValidationConfig()
      const initialLimit = initialConfig.maxLimit
      
      // Simulate fast queries with large results
      for (let i = 0; i < 10; i++) {
        recordQueryPerformance(50, initialLimit * 0.9)
      }
      
      const updatedConfig = getValidationConfig()
      // Limit might increase if performance is good
      expect(updatedConfig.maxLimit).toBeGreaterThanOrEqual(initialLimit)
      
      // Simulate slow queries
      for (let i = 0; i < 10; i++) {
        recordQueryPerformance(2000, 100)
      }
      
      const finalConfig = getValidationConfig()
      // Limit should decrease if performance is poor
      expect(finalConfig.maxLimit).toBeLessThanOrEqual(updatedConfig.maxLimit)
    })
  })
})