/**
 * TypeAwareQueryPlanner Tests - Phase 3
 *
 * Comprehensive tests for query planning and routing strategy selection
 * Target: 10 tests covering all planning scenarios
 */

import { describe, it, expect, beforeEach } from 'vitest'
import {
  TypeAwareQueryPlanner,
  planQuery,
  getQueryPlanner
} from '../src/query/typeAwareQueryPlanner.js'
import { TypeInferenceSystem } from '../src/query/typeInference.js'
import { NounType } from '../src/types/graphTypes.js'

describe('TypeAwareQueryPlanner', () => {
  let planner: TypeAwareQueryPlanner

  beforeEach(() => {
    planner = new TypeAwareQueryPlanner()
  })

  // ========== Routing Tests (4 tests) ==========

  describe('Routing Strategy Selection', () => {
    it('should use single-type routing for high confidence queries', () => {
      const plan = planner.planQuery('Find engineers')

      expect(plan.routing).toBe('single-type')
      expect(plan.targetTypes.length).toBe(1)
      expect(plan.targetTypes[0]).toBe(NounType.Person)
      expect(plan.confidence).toBeGreaterThanOrEqual(0.8)
      expect(plan.estimatedSpeedup).toBeGreaterThan(10) // 31/1 types
    })

    it('should use multi-type routing for multiple high-confidence types', () => {
      const plan = planner.planQuery('employees at tech companies')

      expect(plan.routing).toBe('multi-type')
      expect(plan.targetTypes.length).toBeGreaterThanOrEqual(2)
      expect(plan.targetTypes.length).toBeLessThanOrEqual(5)

      expect(plan.targetTypes).toContain(NounType.Person)
      expect(plan.targetTypes).toContain(NounType.Organization)

      expect(plan.estimatedSpeedup).toBeGreaterThan(1)
      expect(plan.estimatedSpeedup).toBeLessThanOrEqual(31)
    })

    it('should use all-types routing for low confidence queries', () => {
      const plan = planner.planQuery('show me stuff')

      expect(plan.routing).toBe('all-types')
      expect(plan.targetTypes.length).toBe(31) // All noun types
      expect(plan.estimatedSpeedup).toBe(1.0) // No speedup
      expect(plan.confidence).toBeLessThan(0.6)
    })

    it('should use all-types routing for empty queries', () => {
      const plan = planner.planQuery('')

      expect(plan.routing).toBe('all-types')
      expect(plan.targetTypes.length).toBe(31)
      expect(plan.estimatedSpeedup).toBe(1.0)
      expect(plan.reasoning).toContain('Empty query')
    })
  })

  // ========== Plan Generation Tests (3 tests) ==========

  describe('Query Plan Generation', () => {
    it('should generate complete query plan with all fields', () => {
      const plan = planner.planQuery('Find software engineers')

      expect(plan).toHaveProperty('originalQuery')
      expect(plan).toHaveProperty('inferredTypes')
      expect(plan).toHaveProperty('routing')
      expect(plan).toHaveProperty('targetTypes')
      expect(plan).toHaveProperty('estimatedSpeedup')
      expect(plan).toHaveProperty('confidence')
      expect(plan).toHaveProperty('reasoning')

      expect(plan.originalQuery).toBe('Find software engineers')
      expect(Array.isArray(plan.inferredTypes)).toBe(true)
      expect(Array.isArray(plan.targetTypes)).toBe(true)
    })

    it('should calculate accurate speedup estimates', () => {
      const singleType = planner.planQuery('Find engineers')
      const multiType = planner.planQuery('engineers at companies')
      const allTypes = planner.planQuery('show everything')

      // Single-type: 31/1 = 31x
      expect(singleType.estimatedSpeedup).toBeCloseTo(31, 0)

      // Multi-type: 31/N where N = 2-5
      expect(multiType.estimatedSpeedup).toBeGreaterThan(1)
      expect(multiType.estimatedSpeedup).toBeLessThan(31)

      // All-types: 31/31 = 1x
      expect(allTypes.estimatedSpeedup).toBe(1.0)
    })

    it('should sort types by confidence in inference results', () => {
      const plan = planner.planQuery('Find engineers and documents')

      expect(plan.inferredTypes.length).toBeGreaterThan(0)

      // Verify sorted by confidence (descending)
      for (let i = 1; i < plan.inferredTypes.length; i++) {
        expect(plan.inferredTypes[i - 1].confidence).toBeGreaterThanOrEqual(
          plan.inferredTypes[i].confidence
        )
      }
    })
  })

  // ========== Performance Tests (1 test) ==========

  describe('Performance', () => {
    it('should plan queries in < 5ms', () => {
      const start = performance.now()

      planner.planQuery('Find software engineers in San Francisco')

      const elapsed = performance.now() - start

      expect(elapsed).toBeLessThan(5) // Target: < 1ms, allow 5ms for CI
    })
  })

  // ========== Statistics Tests (2 tests) ==========

  describe('Query Statistics', () => {
    it('should track query statistics', () => {
      planner.planQuery('Find engineers') // single-type
      planner.planQuery('engineers at companies') // multi-type
      planner.planQuery('show everything') // all-types

      const stats = planner.getStats()

      expect(stats.totalQueries).toBe(3)
      expect(stats.singleTypeQueries).toBeGreaterThan(0)
      expect(stats.multiTypeQueries).toBeGreaterThan(0)
      expect(stats.allTypesQueries).toBeGreaterThan(0)
      expect(stats.avgConfidence).toBeGreaterThan(0)
    })

    it('should generate statistics report', () => {
      planner.planQuery('Find engineers')
      planner.planQuery('Find documents')
      planner.planQuery('Show everything')

      const report = planner.getStatsReport()

      expect(report).toContain('Query Statistics')
      expect(report).toContain('Single-type')
      expect(report).toContain('Multi-type')
      expect(report).toContain('All-types')
      expect(report).toContain('Avg confidence')
      expect(report).toContain('Avg speedup')
    })
  })

  // ========== Batch Analysis Tests (1 test) ==========

  describe('Batch Query Analysis', () => {
    it('should analyze query distribution and provide recommendations', () => {
      const queries = [
        'Find engineers',
        'Find developers',
        'Show documents',
        'List reports',
        'Find companies',
        'engineers at Tesla',
        'documents about AI',
        'show me everything',
        'all the things',
        'stuff'
      ]

      const analysis = planner.analyzeQueries(queries)

      expect(analysis).toHaveProperty('distribution')
      expect(analysis).toHaveProperty('avgSpeedup')
      expect(analysis).toHaveProperty('recommendations')

      expect(analysis.distribution['single-type']).toBeGreaterThanOrEqual(0)
      expect(analysis.distribution['multi-type']).toBeGreaterThanOrEqual(0)
      expect(analysis.distribution['all-types']).toBeGreaterThanOrEqual(0)

      const total =
        analysis.distribution['single-type'] +
        analysis.distribution['multi-type'] +
        analysis.distribution['all-types']
      expect(total).toBe(queries.length)

      expect(analysis.avgSpeedup).toBeGreaterThan(0)
      expect(Array.isArray(analysis.recommendations)).toBe(true)
    })
  })

  // ========== Configuration Tests (2 tests) ==========

  describe('Configuration', () => {
    it('should respect custom confidence thresholds', () => {
      const strictPlanner = new TypeAwareQueryPlanner(undefined, {
        singleTypeThreshold: 0.95,
        multiTypeThreshold: 0.85
      })

      // Query with moderate confidence should fall back to all-types
      const plan = strictPlanner.planQuery('maybe find some engineers')

      // With strict thresholds, this should use all-types or multi-type
      expect(plan.routing).not.toBe('single-type')
    })

    it('should respect maxMultiTypes limit', () => {
      const limitedPlanner = new TypeAwareQueryPlanner(undefined, {
        maxMultiTypes: 2
      })

      const plan = limitedPlanner.planQuery(
        'engineers at companies in cities working on projects with tools'
      )

      if (plan.routing === 'multi-type') {
        expect(plan.targetTypes.length).toBeLessThanOrEqual(2)
      }
    })
  })

  // ========== Convenience Functions (1 test) ==========

  describe('Global Convenience Functions', () => {
    it('should provide planQuery() and getQueryPlanner() functions', () => {
      const plan = planQuery('Find engineers')

      expect(plan).toHaveProperty('routing')
      expect(plan).toHaveProperty('targetTypes')

      const globalPlanner = getQueryPlanner()
      expect(globalPlanner).toBeInstanceOf(TypeAwareQueryPlanner)
    })
  })
})
