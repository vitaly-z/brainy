/**
 * Entity Confidence & Weight + Result Flattening Tests
 *
 * Tests Phase 2 & 3 of the API Entity Return Audit:
 * - Entity interface exposes confidence and weight
 * - Result interface flattens entity fields for convenience
 * - Backward compatibility preserved
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { Brainy } from '../../src/brainy.js'
import { NounType } from '../../src/types/graphTypes.js'

describe('Entity Confidence & Weight Exposure', () => {
  let brain: Brainy

  beforeEach(async () => {
    brain = new Brainy({ storage: { type: 'memory' } })
    await brain.init()
  })

  describe('Entity interface', () => {
    it('should expose confidence when adding entity with confidence', async () => {
      const id = await brain.add({
        data: 'Machine learning model',
        type: NounType.Concept,
        confidence: 0.92
      })

      const entity = await brain.get(id)
      expect(entity).toBeTruthy()
      expect(entity!.confidence).toBe(0.92)
    })

    it('should expose weight when adding entity with weight', async () => {
      const id = await brain.add({
        data: 'Critical system component',
        type: NounType.Thing,
        weight: 0.85
      })

      const entity = await brain.get(id)
      expect(entity).toBeTruthy()
      expect(entity!.weight).toBe(0.85)
    })

    it('should expose both confidence and weight together', async () => {
      const id = await brain.add({
        data: 'High-priority AI concept',
        type: NounType.Concept,
        confidence: 0.88,
        weight: 0.95
      })

      const entity = await brain.get(id)
      expect(entity).toBeTruthy()
      expect(entity!.confidence).toBe(0.88)
      expect(entity!.weight).toBe(0.95)
    })

    it('should have undefined confidence/weight when not provided', async () => {
      const id = await brain.add({
        data: 'Normal entity',
        type: NounType.Thing
      })

      const entity = await brain.get(id)
      expect(entity).toBeTruthy()
      expect(entity!.confidence).toBeUndefined()
      expect(entity!.weight).toBeUndefined()
    })

    it('should preserve confidence/weight after update', async () => {
      const id = await brain.add({
        data: 'Original data',
        type: NounType.Thing,
        confidence: 0.75,
        weight: 0.65
      })

      await brain.update({
        id,
        data: 'Updated data'
      })

      const entity = await brain.get(id)
      expect(entity).toBeTruthy()
      expect(entity!.confidence).toBe(0.75)
      expect(entity!.weight).toBe(0.65)
    })

    it('should allow updating confidence with other fields', async () => {
      const id = await brain.add({
        data: 'Entity with confidence',
        type: NounType.Concept,
        confidence: 0.70,
        metadata: { status: 'draft' }
      })

      await brain.update({
        id,
        metadata: { status: 'reviewed' },
        confidence: 0.90
      })

      const entity = await brain.get(id)
      expect(entity).toBeTruthy()
      expect(entity!.confidence).toBe(0.90)
      expect(entity!.metadata).toEqual({ status: 'reviewed' })
    })

    it('should allow updating weight with other fields', async () => {
      const id = await brain.add({
        data: 'Entity with weight',
        type: NounType.Thing,
        weight: 0.50,
        metadata: { priority: 'low' }
      })

      await brain.update({
        id,
        metadata: { priority: 'high' },
        weight: 0.80
      })

      const entity = await brain.get(id)
      expect(entity).toBeTruthy()
      expect(entity!.weight).toBe(0.80)
      expect(entity!.metadata).toEqual({ priority: 'high' })
    })
  })

  describe('Result interface - Flattened fields', () => {
    it('should flatten entity fields to Result top level', async () => {
      const id = await brain.add({
        data: 'Test entity',
        type: NounType.Concept,
        metadata: { name: 'Test', category: 'Research' },
        confidence: 0.85,
        weight: 0.75
      })

      const results = await brain.find({ query: 'test' })
      expect(results.length).toBeGreaterThan(0)

      const result = results[0]

      // Check flattened fields at top level
      expect(result.type).toBe(NounType.Concept)
      expect(result.metadata).toEqual({ name: 'Test', category: 'Research' })
      expect(result.data).toBe('Test entity')
      expect(result.confidence).toBe(0.85)
      expect(result.weight).toBe(0.75)
    })

    it('should preserve full entity in Result.entity', async () => {
      const id = await brain.add({
        data: 'Preserved entity',
        type: NounType.Thing,
        metadata: { status: 'active' },
        confidence: 0.92,
        weight: 0.88
      })

      const results = await brain.find({ query: 'preserved' })
      expect(results.length).toBeGreaterThan(0)

      const result = results[0]

      // Check nested entity is preserved
      expect(result.entity).toBeTruthy()
      expect(result.entity.id).toBe(id)
      expect(result.entity.type).toBe(NounType.Thing)
      expect(result.entity.metadata).toEqual({ status: 'active' })
      expect(result.entity.data).toBe('Preserved entity')
      expect(result.entity.confidence).toBe(0.92)
      expect(result.entity.weight).toBe(0.88)
    })

    it('should match flattened fields with entity fields', async () => {
      await brain.add({
        data: 'Consistency check',
        type: NounType.Person,
        metadata: { role: 'Engineer' },
        confidence: 0.80,
        weight: 0.70
      })

      const results = await brain.find({ query: 'consistency' })
      expect(results.length).toBeGreaterThan(0)

      const result = results[0]

      // Flattened fields should match entity fields
      expect(result.type).toBe(result.entity.type)
      expect(result.metadata).toEqual(result.entity.metadata)
      expect(result.data).toBe(result.entity.data)
      expect(result.confidence).toBe(result.entity.confidence)
      expect(result.weight).toBe(result.entity.weight)
    })

    it('should have undefined flattened fields when entity fields are undefined', async () => {
      await brain.add({
        data: 'Minimal entity',
        type: NounType.Thing
      })

      const results = await brain.find({ query: 'minimal' })
      expect(results.length).toBeGreaterThan(0)

      const result = results[0]

      expect(result.confidence).toBeUndefined()
      expect(result.weight).toBeUndefined()
      expect(result.entity.confidence).toBeUndefined()
      expect(result.entity.weight).toBeUndefined()
    })
  })

  describe('Backward compatibility', () => {
    it('should still work with existing code accessing result.entity.metadata', async () => {
      await brain.add({
        data: 'Backward compat test',
        type: NounType.Concept,
        metadata: { version: '1.0' }
      })

      const results = await brain.find({ query: 'backward' })
      expect(results.length).toBeGreaterThan(0)

      // Old code pattern still works
      const oldWay = results[0].entity.metadata
      expect(oldWay).toEqual({ version: '1.0' })

      // New code pattern also works
      const newWay = results[0].metadata
      expect(newWay).toEqual({ version: '1.0' })
    })

    it('should work with metadata-only queries', async () => {
      await brain.add({
        data: 'Metadata query test',
        type: NounType.Document,
        metadata: { format: 'PDF', pages: 42 },
        confidence: 0.95
      })

      const results = await brain.find({
        where: { format: 'PDF' }
      })

      expect(results.length).toBeGreaterThan(0)
      const result = results[0]

      expect(result.metadata).toEqual({ format: 'PDF', pages: 42 })
      expect(result.confidence).toBe(0.95)
    })

    it('should work with empty queries', async () => {
      await brain.add({
        data: 'Empty query test',
        type: NounType.Thing,
        weight: 0.60
      })

      const results = await brain.find({ limit: 10 })

      expect(results.length).toBeGreaterThan(0)
      const result = results[0]

      expect(result.entity).toBeTruthy()
      expect(result.type).toBeDefined()
    })
  })

  describe('similar() method', () => {
    it('should return flattened results from similar()', async () => {
      const id1 = await brain.add({
        data: 'Neural networks',
        type: NounType.Concept,
        confidence: 0.90,
        weight: 0.85
      })

      await brain.add({
        data: 'Deep learning',
        type: NounType.Concept,
        confidence: 0.88,
        weight: 0.82
      })

      const results = await brain.similar({ to: id1, limit: 5 })

      // similar() delegates to find(), so should have flattened fields
      for (const result of results) {
        expect(result.type).toBeDefined()
        expect(result.entity).toBeTruthy()

        if (result.confidence !== undefined) {
          expect(result.confidence).toBe(result.entity.confidence)
        }
        if (result.weight !== undefined) {
          expect(result.weight).toBe(result.entity.weight)
        }
      }
    })
  })

  describe('VFS integration', () => {
    it('should expose confidence/weight for VFS entities', async () => {
      const vfs = brain.vfs
      await vfs.init()

      await vfs.writeFile('/test.txt', 'VFS test content')

      // Get VFS entity through find()
      const results = await brain.find({
        where: { vfsType: 'file' }
      })

      if (results.length > 0) {
        const result = results[0]

        // VFS entities should have flattened fields
        expect(result.type).toBeDefined()
        expect(result.metadata).toBeDefined()
        expect(result.entity).toBeTruthy()

        // Confidence/weight may be undefined for VFS entities,
        // but the fields should exist
        expect('confidence' in result).toBe(true)
        expect('weight' in result).toBe(true)
      }
    })
  })
})
