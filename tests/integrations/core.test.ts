/**
 * Integration Hub - Core Tests
 *
 * Tests for EventBus, TabularExporter, and core functionality.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { EventBus } from '../../src/integrations/core/EventBus.js'
import { TabularExporter } from '../../src/integrations/core/TabularExporter.js'
import { NounType, VerbType } from '../../src/types/graphTypes.js'
import type { Entity, Relation } from '../../src/types/brainy.types.js'

describe('EventBus', () => {
  let eventBus: EventBus

  beforeEach(() => {
    eventBus = new EventBus()
  })

  describe('subscribe and emit', () => {
    it('should emit events to subscribers', async () => {
      const handler = vi.fn()

      eventBus.subscribe({}, handler)

      eventBus.emit({
        entityType: 'noun',
        operation: 'create',
        entityId: 'test-123'
      })

      expect(handler).toHaveBeenCalledTimes(1)
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          entityType: 'noun',
          operation: 'create',
          entityId: 'test-123'
        })
      )
    })

    it('should filter by entity type', () => {
      const handler = vi.fn()

      eventBus.subscribe({ entityTypes: ['verb'] }, handler)

      eventBus.emit({
        entityType: 'noun',
        operation: 'create',
        entityId: 'test-123'
      })

      expect(handler).not.toHaveBeenCalled()

      eventBus.emit({
        entityType: 'verb',
        operation: 'create',
        entityId: 'test-456'
      })

      expect(handler).toHaveBeenCalledTimes(1)
    })

    it('should filter by operation', () => {
      const handler = vi.fn()

      eventBus.subscribe({ operations: ['update', 'delete'] }, handler)

      eventBus.emit({
        entityType: 'noun',
        operation: 'create',
        entityId: 'test-123'
      })

      expect(handler).not.toHaveBeenCalled()

      eventBus.emit({
        entityType: 'noun',
        operation: 'update',
        entityId: 'test-456'
      })

      expect(handler).toHaveBeenCalledTimes(1)
    })

    it('should filter by noun type', () => {
      const handler = vi.fn()

      eventBus.subscribe({ nounTypes: [NounType.Person] }, handler)

      eventBus.emit({
        entityType: 'noun',
        operation: 'create',
        entityId: 'test-123',
        nounType: NounType.Document
      })

      expect(handler).not.toHaveBeenCalled()

      eventBus.emit({
        entityType: 'noun',
        operation: 'create',
        entityId: 'test-456',
        nounType: NounType.Person
      })

      expect(handler).toHaveBeenCalledTimes(1)
    })
  })

  describe('unsubscribe', () => {
    it('should stop receiving events after unsubscribe', () => {
      const handler = vi.fn()

      const subscription = eventBus.subscribe({}, handler)

      eventBus.emit({
        entityType: 'noun',
        operation: 'create',
        entityId: 'test-123'
      })

      expect(handler).toHaveBeenCalledTimes(1)

      subscription.unsubscribe()

      eventBus.emit({
        entityType: 'noun',
        operation: 'create',
        entityId: 'test-456'
      })

      expect(handler).toHaveBeenCalledTimes(1) // Still 1
    })
  })

  describe('sequence IDs', () => {
    it('should increment sequence IDs', () => {
      const events: any[] = []
      eventBus.subscribe({}, (e) => events.push(e))

      eventBus.emit({ entityType: 'noun', operation: 'create', entityId: '1' })
      eventBus.emit({ entityType: 'noun', operation: 'create', entityId: '2' })
      eventBus.emit({ entityType: 'noun', operation: 'create', entityId: '3' })

      expect(events[0].sequenceId).toBe(1n)
      expect(events[1].sequenceId).toBe(2n)
      expect(events[2].sequenceId).toBe(3n)
    })

    it('should return current sequence ID', () => {
      expect(eventBus.getCurrentSequenceId()).toBe(0n)

      eventBus.emit({ entityType: 'noun', operation: 'create', entityId: '1' })
      expect(eventBus.getCurrentSequenceId()).toBe(1n)

      eventBus.emit({ entityType: 'noun', operation: 'create', entityId: '2' })
      expect(eventBus.getCurrentSequenceId()).toBe(2n)
    })
  })

  describe('event buffer', () => {
    it('should buffer events for replay', () => {
      eventBus.emit({ entityType: 'noun', operation: 'create', entityId: '1' })
      eventBus.emit({ entityType: 'noun', operation: 'create', entityId: '2' })
      eventBus.emit({ entityType: 'noun', operation: 'create', entityId: '3' })

      const events = eventBus.getEventsSince(1n)

      expect(events).toHaveLength(2)
      expect(events[0].entityId).toBe('2')
      expect(events[1].entityId).toBe('3')
    })
  })

  describe('helper methods', () => {
    it('should emit noun events', () => {
      const handler = vi.fn()
      eventBus.subscribe({}, handler)

      eventBus.emitNoun('create', 'entity-1', NounType.Person)

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          entityType: 'noun',
          operation: 'create',
          entityId: 'entity-1',
          nounType: NounType.Person
        })
      )
    })

    it('should emit verb events', () => {
      const handler = vi.fn()
      eventBus.subscribe({}, handler)

      eventBus.emitVerb('create', 'rel-1', VerbType.RelatedTo)

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          entityType: 'verb',
          operation: 'create',
          entityId: 'rel-1',
          verbType: VerbType.RelatedTo
        })
      )
    })

    it('should emit VFS events', () => {
      const handler = vi.fn()
      eventBus.subscribe({}, handler)

      eventBus.emitVFS('create', 'file-1')

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          entityType: 'vfs',
          operation: 'create',
          entityId: 'file-1'
        })
      )
    })
  })
})

describe('TabularExporter', () => {
  let exporter: TabularExporter

  const mockEntity: Entity = {
    id: 'entity-123',
    type: NounType.Person,
    createdAt: 1704067200000, // 2024-01-01
    updatedAt: 1704153600000, // 2024-01-02
    vector: new Float32Array([0.1, 0.2, 0.3]),
    confidence: 0.95,
    weight: 0.8,
    service: 'test-service',
    data: { content: 'Hello world' },
    metadata: {
      name: 'John Doe',
      email: 'john@example.com',
      nested: { key: 'value' }
    }
  }

  const mockRelation: Relation = {
    id: 'rel-123',
    from: 'entity-1',
    to: 'entity-2',
    type: VerbType.RelatedTo,
    weight: 0.9,
    confidence: 0.85,
    createdAt: 1704067200000,
    service: 'test-service',
    metadata: { reason: 'test' }
  }

  beforeEach(() => {
    exporter = new TabularExporter()
  })

  describe('entitiesToRows', () => {
    it('should convert entity to row', () => {
      const rows = exporter.entitiesToRows([mockEntity])

      expect(rows).toHaveLength(1)
      expect(rows[0].Id).toBe('entity-123')
      expect(rows[0].Type).toBe('person')
      expect(rows[0].Confidence).toBe(0.95)
      expect(rows[0].Weight).toBe(0.8)
      expect(rows[0].Service).toBe('test-service')
    })

    it('should flatten metadata by default', () => {
      const rows = exporter.entitiesToRows([mockEntity])

      expect(rows[0].Metadata_name).toBe('John Doe')
      expect(rows[0].Metadata_email).toBe('john@example.com')
    })

    it('should JSON stringify nested metadata', () => {
      const rows = exporter.entitiesToRows([mockEntity])

      expect(rows[0].Metadata_nested).toBe('{"key":"value"}')
    })

    it('should JSON stringify data field', () => {
      const rows = exporter.entitiesToRows([mockEntity])

      expect(rows[0].Data).toBe('{"content":"Hello world"}')
    })

    it('should format dates as ISO 8601', () => {
      const rows = exporter.entitiesToRows([mockEntity])

      expect(rows[0].CreatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/)
    })
  })

  describe('configuration', () => {
    it('should not flatten metadata when disabled', () => {
      exporter = new TabularExporter({ flattenMetadata: false })
      const rows = exporter.entitiesToRows([mockEntity])

      expect(rows[0].Metadata_name).toBeUndefined()
      expect(rows[0].Metadata).toBeDefined()
    })

    it('should include vectors when enabled', () => {
      exporter = new TabularExporter({ includeVectors: true })
      const rows = exporter.entitiesToRows([mockEntity])

      expect(rows[0].Vector).toBeDefined()
    })

    it('should use custom metadata prefix', () => {
      exporter = new TabularExporter({ metadataPrefix: 'M_' })
      const rows = exporter.entitiesToRows([mockEntity])

      expect(rows[0].M_name).toBe('John Doe')
      expect(rows[0].Metadata_name).toBeUndefined()
    })

    it('should format dates as unix timestamps', () => {
      exporter = new TabularExporter({ dateFormat: 'unix' })
      const rows = exporter.entitiesToRows([mockEntity])

      expect(rows[0].CreatedAt).toBe('1704067200')
    })
  })

  describe('relationsToRows', () => {
    it('should convert relation to row', () => {
      const rows = exporter.relationsToRows([mockRelation])

      expect(rows).toHaveLength(1)
      expect(rows[0].Id).toBe('rel-123')
      expect(rows[0].FromId).toBe('entity-1')
      expect(rows[0].ToId).toBe('entity-2')
      expect(rows[0].Type).toBe('relatedTo')
      expect(rows[0].Weight).toBe(0.9)
      expect(rows[0].Confidence).toBe(0.85)
    })
  })

  describe('toCSV', () => {
    it('should generate valid CSV', () => {
      const csv = exporter.toCSV([mockEntity])
      const lines = csv.split('\n')

      expect(lines.length).toBeGreaterThan(1)
      expect(lines[0]).toContain('Id')
      expect(lines[0]).toContain('Type')
      expect(lines[1]).toContain('entity-123')
    })

    it('should escape special characters', () => {
      const entityWithComma: Entity = {
        ...mockEntity,
        metadata: { name: 'Doe, John' }
      }

      const csv = exporter.toCSV([entityWithComma])

      expect(csv).toContain('"Doe, John"')
    })

    it('should escape quotes', () => {
      const entityWithQuotes: Entity = {
        ...mockEntity,
        metadata: { name: 'John "Jack" Doe' }
      }

      const csv = exporter.toCSV([entityWithQuotes])

      expect(csv).toContain('""Jack""')
    })
  })

  describe('parseCSV', () => {
    it('should parse CSV back to entities', () => {
      const csv = exporter.toCSV([mockEntity])
      const entities = exporter.parseCSV(csv)

      expect(entities).toHaveLength(1)
      expect(entities[0].id).toBe('entity-123')
      expect(entities[0].type).toBe('person')
    })
  })

  describe('toOData', () => {
    it('should generate OData response', () => {
      const odata = exporter.toOData([mockEntity])

      expect(odata).toHaveProperty('@odata.context')
      expect(odata).toHaveProperty('value')
      expect((odata as any).value).toHaveLength(1)
    })

    it('should include count when provided', () => {
      const odata = exporter.toOData([mockEntity], { count: 100 })

      expect((odata as any)['@odata.count']).toBe(100)
    })

    it('should include nextLink when provided', () => {
      const odata = exporter.toOData([mockEntity], {
        nextLink: '/odata/Entities?$skip=100'
      })

      expect((odata as any)['@odata.nextLink']).toBe('/odata/Entities?$skip=100')
    })
  })

  describe('getSchema', () => {
    it('should infer schema from entities', () => {
      const schema = exporter.getSchema([mockEntity])

      expect(schema).toContainEqual(
        expect.objectContaining({ name: 'Id', type: 'string' })
      )
      expect(schema).toContainEqual(
        expect.objectContaining({ name: 'Confidence', type: 'number' })
      )
    })
  })
})
