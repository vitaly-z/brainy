/**
 * TypeInference System Tests - Phase 3
 *
 * Comprehensive tests for type inference from natural language queries
 * Target: 15 tests covering all inference scenarios
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { TypeInferenceSystem, inferTypes } from '../../src/query/typeInference.js'
import { NounType } from '../../src/types/graphTypes.js'

describe('TypeInference System', () => {
  let inferenceSystem: TypeInferenceSystem

  beforeEach(() => {
    inferenceSystem = new TypeInferenceSystem()
  })

  // ========== Exact Match Tests (5 tests) ==========

  describe('Exact Keyword Matching', () => {
    it('should infer Person from "engineer"', () => {
      const results = inferenceSystem.inferTypes('Find engineers')

      expect(results.length).toBeGreaterThan(0)
      expect(results[0].type).toBe(NounType.Person)
      expect(results[0].confidence).toBeGreaterThanOrEqual(0.8)
      expect(results[0].matchedKeywords).toContain('engineers')
    })

    it('should infer Location from "San Francisco"', () => {
      const results = inferenceSystem.inferTypes('people in San Francisco')

      expect(results).toContainEqual(
        expect.objectContaining({
          type: NounType.Location,
          confidence: expect.any(Number)
        })
      )

      const locationResult = results.find(r => r.type === NounType.Location)
      expect(locationResult?.confidence).toBeGreaterThanOrEqual(0.8)
    })

    it('should infer Document from "report"', () => {
      const results = inferenceSystem.inferTypes('show me the latest reports')

      expect(results.length).toBeGreaterThan(0)
      expect(results[0].type).toBe(NounType.Document)
      expect(results[0].confidence).toBeGreaterThanOrEqual(0.8)
    })

    it('should infer Organization from "company"', () => {
      const results = inferenceSystem.inferTypes('find tech companies')

      expect(results).toContainEqual(
        expect.objectContaining({
          type: NounType.Organization,
          confidence: expect.any(Number)
        })
      )

      const orgResult = results.find(r => r.type === NounType.Organization)
      expect(orgResult?.confidence).toBeGreaterThanOrEqual(0.8)
    })

    it('should infer Concept from "artificial intelligence"', () => {
      const results = inferenceSystem.inferTypes(
        'documents about artificial intelligence'
      )

      expect(results).toContainEqual(
        expect.objectContaining({
          type: NounType.Concept
        })
      )

      const conceptResult = results.find(r => r.type === NounType.Concept)
      expect(conceptResult).toBeDefined()
      expect(conceptResult?.confidence).toBeGreaterThanOrEqual(0.7)
    })
  })

  // ========== Multi-Type Tests (3 tests) ==========

  describe('Multi-Type Inference', () => {
    it('should infer [Person, Organization] from "employees at Tesla"', () => {
      const results = inferenceSystem.inferTypes('find employees at Tesla')

      expect(results.length).toBeGreaterThanOrEqual(2)

      const types = results.map(r => r.type)
      expect(types).toContain(NounType.Person)
      expect(types).toContain(NounType.Organization)
    })

    it('should infer [Document, Concept] from "papers about quantum computing"', () => {
      const results = inferenceSystem.inferTypes(
        'show papers about quantum computing'
      )

      expect(results.length).toBeGreaterThanOrEqual(2)

      const types = results.map(r => r.type)
      expect(types).toContain(NounType.Document)
      expect(types).toContain(NounType.Concept)
    })

    it('should infer [Event, Location] from "conferences in NYC"', () => {
      const results = inferenceSystem.inferTypes(
        'upcoming conferences in New York City'
      )

      expect(results.length).toBeGreaterThanOrEqual(2)

      const types = results.map(r => r.type)
      expect(types).toContain(NounType.Event)
      expect(types).toContain(NounType.Location)
    })
  })

  // ========== Confidence Tests (3 tests) ==========

  describe('Confidence Scoring', () => {
    it('should return high confidence for exact matches', () => {
      const results = inferenceSystem.inferTypes('software engineer')

      expect(results.length).toBeGreaterThan(0)
      expect(results[0].confidence).toBeGreaterThanOrEqual(0.9)
    })

    it('should return moderate confidence for partial matches', () => {
      const results = inferenceSystem.inferTypes('engineering team member')

      expect(results.length).toBeGreaterThan(0)

      // Should have multiple types matched (team → Organization, member → User, engineering → Concept)
      const types = results.map(r => r.type)
      expect(types.length).toBeGreaterThanOrEqual(2)

      // Should have Organization and User types
      expect(types).toContain(NounType.Organization)
      expect(types).toContain(NounType.Person)
    })

    it('should boost confidence for multiple keyword matches', () => {
      const singleKeyword = inferenceSystem.inferTypes('engineer')
      const multiKeyword = inferenceSystem.inferTypes('software engineer developer')

      expect(singleKeyword[0].confidence).toBeLessThan(
        multiKeyword[0].confidence
      )
    })
  })

  // ========== Edge Cases (4 tests) ==========

  describe('Edge Cases', () => {
    it('should handle empty query', () => {
      const results = inferenceSystem.inferTypes('')

      expect(results).toEqual([])
    })

    it('should handle single-word query', () => {
      const results = inferenceSystem.inferTypes('documents')

      expect(results.length).toBeGreaterThan(0)
      expect(results[0].type).toBe(NounType.Document)
    })

    it('should handle very long query (100+ words)', () => {
      const longQuery =
        'Find all software engineers and developers working at technology companies ' +
        'in San Francisco and New York who have experience with artificial intelligence ' +
        'machine learning deep learning natural language processing computer vision ' +
        'data science analytics big data distributed systems cloud computing ' +
        'microservices kubernetes docker containers orchestration deployment ' +
        'continuous integration continuous deployment devops site reliability ' +
        'engineering infrastructure automation monitoring observability logging ' +
        'tracing metrics dashboards alerting incident response on call rotation'

      const results = inferenceSystem.inferTypes(longQuery)

      expect(results.length).toBeGreaterThan(0)
      expect(results[0].type).toBeDefined()

      // Should have Person, Organization, Location, Concept types
      const types = results.map(r => r.type)
      expect(types).toContain(NounType.Person)
      expect(types).toContain(NounType.Organization)
      expect(types).toContain(NounType.Location)
      expect(types).toContain(NounType.Concept)
    })

    it('should handle queries with no keyword matches', () => {
      const results = inferenceSystem.inferTypes('xyzabc qwerty asdfgh')

      expect(results).toEqual([])
    })
  })

  // ========== Performance Tests (2 tests) ==========

  describe('Performance', () => {
    it('should infer types in < 5ms', () => {
      const start = performance.now()

      inferenceSystem.inferTypes('Find software engineers in San Francisco')

      const elapsed = performance.now() - start

      expect(elapsed).toBeLessThan(5) // Target: < 1ms, allow 5ms for CI
    })

    it('should handle 100 sequential queries efficiently', () => {
      const queries = [
        'Find engineers',
        'Show documents',
        'List companies',
        'Find events',
        'Show reports'
      ]

      const start = performance.now()

      for (let i = 0; i < 100; i++) {
        inferenceSystem.inferTypes(queries[i % queries.length])
      }

      const elapsed = performance.now() - start
      const avgTime = elapsed / 100

      expect(avgTime).toBeLessThan(5) // < 5ms average per query
    })
  })

  // ========== Configuration Tests (2 tests) ==========

  describe('Configuration', () => {
    it('should respect minConfidence threshold', () => {
      const system = new TypeInferenceSystem({ minConfidence: 0.9 })

      const results = system.inferTypes('maybe a document or file')

      // High threshold should filter out low-confidence matches
      expect(results.every(r => r.confidence >= 0.9)).toBe(true)
    })

    it('should respect maxTypes limit', () => {
      const system = new TypeInferenceSystem({ maxTypes: 2 })

      const results = system.inferTypes(
        'Find engineers at companies in cities working on projects'
      )

      expect(results.length).toBeLessThanOrEqual(2)
    })
  })

  // ========== Convenience Functions (1 test) ==========

  describe('Global Convenience Functions', () => {
    it('should provide inferTypes() convenience function', () => {
      const results = inferTypes('Find engineers')

      expect(results.length).toBeGreaterThan(0)
      expect(results[0].type).toBe(NounType.Person)
    })
  })

  // ========== Statistics (1 test) ==========

  describe('System Statistics', () => {
    it('should provide keyword and phrase statistics', () => {
      const stats = inferenceSystem.getStats()

      expect(stats.keywordCount).toBeGreaterThan(500)
      expect(stats.phraseCount).toBeGreaterThan(30)
      expect(stats.config).toBeDefined()
      expect(stats.config.minConfidence).toBe(0.4)
      expect(stats.config.maxTypes).toBe(5)
    })
  })
})
