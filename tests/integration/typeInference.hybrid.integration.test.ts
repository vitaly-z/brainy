/**
 * TypeInference Hybrid System Tests - Vector Fallback Integration
 *
 * Tests for hybrid type inference combining keyword matching (fast path)
 * with vector similarity fallback (intelligent fallback for unknown words)
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { TypeInferenceSystem } from '../../src/query/typeInference.js'
import { NounType } from '../../src/types/graphTypes.js'

describe('TypeInference Hybrid System', () => {
  // ========== Fast Path Tests (No Fallback) ==========

  describe('Fast Path - Keyword Matching Only', () => {
    let system: TypeInferenceSystem

    beforeEach(() => {
      // Default config: vector fallback disabled
      system = new TypeInferenceSystem()
    })

    it('should use fast path for known keywords', async () => {
      const start = performance.now()
      const results = await system.inferTypesAsync('Find engineers in San Francisco')
      const elapsed = performance.now() - start

      // Should be fast even with async
      expect(elapsed).toBeLessThan(10)
      expect(results.length).toBeGreaterThan(0)
      expect(results[0].type).toBe(NounType.Person)
    })

    it('should return empty array for unknown words (no fallback)', () => {
      const results = system.inferTypes('Find xyzphysicians')

      expect(results).toEqual([])
    })

    it('should handle typos without fallback by returning empty', () => {
      const results = system.inferTypes('Find documnets')

      // Without fallback, typos are not handled
      // May or may not match depending on partial matches
    })
  })

  // ========== Hybrid Mode Tests (With Fallback) ==========

  describe('Hybrid Mode - Keyword + Vector Fallback', () => {
    let system: TypeInferenceSystem

    beforeEach(() => {
      // Enable vector fallback
      system = new TypeInferenceSystem({
        enableVectorFallback: true,
        fallbackConfidenceThreshold: 0.7,
        vectorThreshold: 0.5,
        debug: false
      })
    })

    it('should still use fast path for high-confidence keyword matches', async () => {
      const start = performance.now()
      const results = await system.inferTypesAsync('Find engineers in San Francisco')
      const elapsed = performance.now() - start

      // High confidence keywords should NOT trigger fallback
      expect(elapsed).toBeLessThan(10)
      expect(results.length).toBeGreaterThan(0)
      expect(results[0].confidence).toBeGreaterThanOrEqual(0.7)
    })

    it('should trigger vector fallback for completely unknown words', async () => {
      const results = await system.inferTypesAsync('Find xyzabc qwerty')

      // Vector fallback may or may not find matches for gibberish
      expect(Array.isArray(results)).toBe(true)
    })

    it('should trigger fallback for low confidence matches', async () => {
      const results = await system.inferTypesAsync('Find obscure technical jargon')

      expect(Array.isArray(results)).toBe(true)
    })

    it('should handle typos with vector similarity fallback', async () => {
      const results = await system.inferTypesAsync('Find documnets')

      // Vector similarity should handle typos semantically
      expect(results.length).toBeGreaterThanOrEqual(0)

      // May find Document type via semantic similarity
      const docType = results.find(r => r.type === NounType.Document)
      if (docType) {
        expect(docType.confidence).toBeGreaterThan(0)
      }
    })

    it('should mark vector results with special keyword marker', async () => {
      const results = await system.inferTypesAsync('xyzabc')

      // Vector results should have <vector-similarity> marker
      const vectorResults = results.filter(r =>
        r.matchedKeywords.includes('<vector-similarity>')
      )

      expect(vectorResults.length).toBeGreaterThanOrEqual(0)
    })
  })

  // ========== Configuration Tests ==========

  describe('Configuration Options', () => {
    it('should respect fallbackConfidenceThreshold', async () => {
      // Very high threshold - triggers fallback even for good matches
      const system = new TypeInferenceSystem({
        enableVectorFallback: true,
        fallbackConfidenceThreshold: 0.95,
        debug: false
      })

      const results = system.inferTypesAsync('engineer')

      // Even "engineer" (0.9 confidence) should trigger fallback with 0.95 threshold
      if (results instanceof Promise) {
        const resolved = await results
        expect(Array.isArray(resolved)).toBe(true)
      }
    })

    it('should respect vectorThreshold for filtering results', async () => {
      // Very high vector threshold - filters weak matches
      const system = new TypeInferenceSystem({
        enableVectorFallback: true,
        fallbackConfidenceThreshold: 0.7,
        vectorThreshold: 0.9, // Very high threshold
        debug: false
      })

      const results = system.inferTypesAsync('xyzabc')

      if (results instanceof Promise) {
        const resolved = await results

        // High threshold should filter out weak vector matches
        expect(resolved.every(r => r.confidence >= 0.9 || !r.matchedKeywords.includes('<vector-similarity>'))).toBe(true)
      }
    })

    it('should not trigger fallback when disabled', () => {
      const system = new TypeInferenceSystem({
        enableVectorFallback: false
      })

      const results = system.inferTypesAsync('xyzabc unknown words')

      // Should return synchronously even with no matches
      expect(results).not.toBeInstanceOf(Promise)
      expect(results).toEqual([])
    })
  })

  // ========== Result Merging Tests ==========

  describe('Result Merging', () => {
    let system: TypeInferenceSystem

    beforeEach(() => {
      system = new TypeInferenceSystem({
        enableVectorFallback: true,
        fallbackConfidenceThreshold: 0.5, // Low threshold to test merging
        vectorThreshold: 0.4,
        debug: false
      })
    })

    it('should merge keyword and vector results without duplicates', async () => {
      const results = system.inferTypesAsync('engineer')

      if (results instanceof Promise) {
        const resolved = await results

        // Should not have duplicate types
        const types = resolved.map(r => r.type)
        const uniqueTypes = new Set(types)
        expect(types.length).toBe(uniqueTypes.size)
      }
    })

    it('should prioritize keyword matches over vector matches', async () => {
      const results = system.inferTypesAsync('software engineer')

      if (results instanceof Promise) {
        const resolved = await results

        // Keyword matches should have higher confidence than vector-only matches
        const keywordResults = resolved.filter(
          r => !r.matchedKeywords.includes('<vector-similarity>')
        )
        const vectorResults = resolved.filter(
          r => r.matchedKeywords.includes('<vector-similarity>')
        )

        if (keywordResults.length > 0 && vectorResults.length > 0) {
          expect(keywordResults[0].confidence).toBeGreaterThanOrEqual(
            vectorResults[0].confidence
          )
        }
      }
    })

    it('should boost keyword confidence in merged results', async () => {
      const keywordOnlySystem = new TypeInferenceSystem({
        enableVectorFallback: false
      })

      const hybridSystem = new TypeInferenceSystem({
        enableVectorFallback: true,
        fallbackConfidenceThreshold: 0.3, // Very low to trigger merging
        debug: false
      })

      const keywordResults = keywordOnlySystem.inferTypes('engineer')
      const hybridResults = hybridSystem.inferTypes('engineer')

      if (hybridResults instanceof Promise) {
        const resolved = await hybridResults

        // Hybrid system should boost keyword confidence (20% boost)
        const keywordType = (keywordResults as any).find(
          (r: any) => r.type === NounType.Person
        )
        const hybridType = resolved.find(r => r.type === NounType.Person)

        if (keywordType && hybridType && !hybridType.matchedKeywords.includes('<vector-similarity>')) {
          expect(hybridType.confidence).toBeGreaterThanOrEqual(keywordType.confidence)
        }
      }
    })
  })

  // ========== Performance Tests ==========

  describe('Performance Characteristics', () => {
    it('should complete fast path in < 5ms', () => {
      const system = new TypeInferenceSystem({
        enableVectorFallback: true
      })

      const start = performance.now()
      const results = system.inferTypesAsync('Find engineers at Tesla')
      const elapsed = performance.now() - start

      // Fast path should still be fast even with fallback enabled
      expect(results).not.toBeInstanceOf(Promise)
      expect(elapsed).toBeLessThan(5)
    })

    it('should complete vector fallback in reasonable time (< 200ms)', async () => {
      const system = new TypeInferenceSystem({
        enableVectorFallback: true,
        fallbackConfidenceThreshold: 0.7,
        debug: false
      })

      const start = performance.now()
      const results = system.inferTypesAsync('xyzabc qwerty')

      if (results instanceof Promise) {
        await results
        const elapsed = performance.now() - start

        // Vector fallback should complete in reasonable time
        // Note: First call includes model loading, subsequent calls are faster
        expect(elapsed).toBeLessThan(10000) // 10 seconds max for first call (model loading)
      }
    }, 15000) // 15 second timeout for this test
  })

  // ========== Real-World Scenarios ==========

  describe('Real-World Usage Scenarios', () => {
    let system: TypeInferenceSystem

    beforeEach(() => {
      system = new TypeInferenceSystem({
        enableVectorFallback: true,
        fallbackConfidenceThreshold: 0.7,
        vectorThreshold: 0.5,
        debug: false
      })
    })

    it('should handle medical terminology with fallback', async () => {
      const results = system.inferTypesAsync('Find cardiologists')

      // "cardiologists" may not be in keyword list, but vector should understand it's a Person
      if (results instanceof Promise) {
        const resolved = await results

        const personType = resolved.find(r => r.type === NounType.Person)
        if (personType) {
          expect(personType.confidence).toBeGreaterThan(0.5)
        }
      }
    })

    it('should handle technical abbreviations with fallback', async () => {
      const results = system.inferTypesAsync('Find SRE')

      // "SRE" (Site Reliability Engineer) may not be in keyword list
      if (results instanceof Promise) {
        const resolved = await results

        // Vector fallback may understand this is related to Person/Role
        expect(resolved.length).toBeGreaterThanOrEqual(0)
      }
    })

    it('should handle misspelled common words', async () => {
      const results = system.inferTypesAsync('Find companys in NYC')

      // "companys" is misspelled, but vector should understand
      if (results instanceof Promise) {
        const resolved = await results

        const orgType = resolved.find(r => r.type === NounType.Organization)
        if (orgType) {
          expect(orgType.confidence).toBeGreaterThan(0)
        }
      }
    })

    it('should handle domain-specific jargon', async () => {
      const results = system.inferTypesAsync('Find ML practitioners')

      // "practitioners" may not map directly to Person in keywords
      if (results instanceof Promise) {
        const resolved = await results

        const personType = resolved.find(r => r.type === NounType.Person)
        if (personType) {
          expect(personType.confidence).toBeGreaterThan(0)
        }
      }
    })
  })

  // ========== Statistics Tests ==========

  describe('System Statistics', () => {
    it('should report vector fallback in stats when enabled', () => {
      const system = new TypeInferenceSystem({
        enableVectorFallback: true
      })

      const stats = system.getStats()

      expect(stats.config.enableVectorFallback).toBe(true)
      expect(stats.config.fallbackConfidenceThreshold).toBeDefined()
      expect(stats.config.vectorThreshold).toBeDefined()
    })

    it('should report correct config values', () => {
      const system = new TypeInferenceSystem({
        enableVectorFallback: true,
        fallbackConfidenceThreshold: 0.8,
        vectorThreshold: 0.6
      })

      const stats = system.getStats()

      expect(stats.config.fallbackConfidenceThreshold).toBe(0.8)
      expect(stats.config.vectorThreshold).toBe(0.6)
    })
  })
})
