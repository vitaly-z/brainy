/**
 * VersionDiff Unit Tests (v5.3.0)
 *
 * Tests deep object comparison:
 * - Added fields
 * - Removed fields
 * - Modified fields
 * - Type changes
 * - Nested object comparison
 * - Array comparison
 */

import { describe, it, expect } from 'vitest'
import { compareEntityVersions } from '../../../src/versioning/VersionDiff.js'
import type { NounMetadata } from '../../../src/coreTypes.js'

describe('VersionDiff', () => {
  describe('compareEntityVersions()', () => {
    it('should detect added fields', () => {
      const from: NounMetadata = {
        id: 'user-1',
        type: 'user',
        name: 'Alice',
        metadata: { email: 'alice@example.com' }
      }

      const to: NounMetadata = {
        id: 'user-1',
        type: 'user',
        name: 'Alice',
        metadata: {
          email: 'alice@example.com',
          city: 'NYC',
          age: 30
        }
      }

      const diff = compareEntityVersions(from, to, {
        entityId: 'user-1',
        fromVersion: 1,
        toVersion: 2
      })

      expect(diff.added.length).toBe(2)
      expect(diff.added.some(c => c.path.includes('city'))).toBe(true)
      expect(diff.added.some(c => c.path.includes('age'))).toBe(true)
      expect(diff.added.find(c => c.path.includes('city'))?.newValue).toBe('NYC')
    })

    it('should detect removed fields', () => {
      const from: NounMetadata = {
        id: 'user-1',
        type: 'user',
        name: 'Alice',
        metadata: {
          email: 'alice@example.com',
          city: 'NYC',
          age: 30
        }
      }

      const to: NounMetadata = {
        id: 'user-1',
        type: 'user',
        name: 'Alice',
        metadata: { email: 'alice@example.com' }
      }

      const diff = compareEntityVersions(from, to, {
        entityId: 'user-1',
        fromVersion: 1,
        toVersion: 2
      })

      expect(diff.removed.length).toBe(2)
      expect(diff.removed.some(c => c.path.includes('city'))).toBe(true)
      expect(diff.removed.some(c => c.path.includes('age'))).toBe(true)
      expect(diff.removed.find(c => c.path.includes('city'))?.oldValue).toBe('NYC')
    })

    it('should detect modified fields', () => {
      const from: NounMetadata = {
        id: 'user-1',
        type: 'user',
        name: 'Alice',
        metadata: {
          email: 'alice@example.com',
          status: 'active'
        }
      }

      const to: NounMetadata = {
        id: 'user-1',
        type: 'user',
        name: 'Alice Smith',
        metadata: {
          email: 'alice.smith@example.com',
          status: 'active'
        }
      }

      const diff = compareEntityVersions(from, to, {
        entityId: 'user-1',
        fromVersion: 1,
        toVersion: 2
      })

      expect(diff.modified.length).toBe(2)

      const nameChange = diff.modified.find(c => c.path.includes('name'))
      expect(nameChange?.oldValue).toBe('Alice')
      expect(nameChange?.newValue).toBe('Alice Smith')

      const emailChange = diff.modified.find(c => c.path.includes('email'))
      expect(emailChange?.oldValue).toBe('alice@example.com')
      expect(emailChange?.newValue).toBe('alice.smith@example.com')
    })

    it('should detect type changes', () => {
      const from: NounMetadata = {
        id: 'config-1',
        type: 'thing',
        name: 'Config',
        metadata: { value: '100' }
      }

      const to: NounMetadata = {
        id: 'config-1',
        type: 'thing',
        name: 'Config',
        metadata: { value: 100 }
      }

      const diff = compareEntityVersions(from, to, {
        entityId: 'config-1',
        fromVersion: 1,
        toVersion: 2
      })

      expect(diff.typeChanged.length).toBe(1)
      const typeChange = diff.typeChanged[0]
      expect(typeChange.path).toContain('value')
      expect(typeChange.oldType).toBe('string')
      expect(typeChange.newType).toBe('number')
      expect(typeChange.oldValue).toBe('100')
      expect(typeChange.newValue).toBe(100)
    })

    it('should detect identical versions', () => {
      const entity: NounMetadata = {
        id: 'doc-1',
        type: 'document',
        name: 'Doc',
        metadata: { content: 'Unchanged' }
      }

      const diff = compareEntityVersions(entity, entity, {
        entityId: 'doc-1',
        fromVersion: 1,
        toVersion: 2
      })

      expect(diff.identical).toBe(true)
      expect(diff.totalChanges).toBe(0)
      expect(diff.added).toHaveLength(0)
      expect(diff.removed).toHaveLength(0)
      expect(diff.modified).toHaveLength(0)
    })

    it('should handle nested object changes', () => {
      const from: NounMetadata = {
        id: 'user-1',
        type: 'user',
        name: 'Alice',
        metadata: {
          address: {
            street: '123 Main St',
            city: 'NYC'
          }
        }
      }

      const to: NounMetadata = {
        id: 'user-1',
        type: 'user',
        name: 'Alice',
        metadata: {
          address: {
            street: '456 Oak Ave',
            city: 'NYC',
            zip: '10001'
          }
        }
      }

      const diff = compareEntityVersions(from, to, {
        entityId: 'user-1',
        fromVersion: 1,
        toVersion: 2
      })

      expect(diff.modified.some(c => c.path.includes('address.street'))).toBe(true)
      expect(diff.added.some(c => c.path.includes('address.zip'))).toBe(true)

      const streetChange = diff.modified.find(c => c.path.includes('address.street'))
      expect(streetChange?.oldValue).toBe('123 Main St')
      expect(streetChange?.newValue).toBe('456 Oak Ave')
    })

    it('should handle array changes', () => {
      const from: NounMetadata = {
        id: 'doc-1',
        type: 'document',
        name: 'Doc',
        metadata: {
          tags: ['a', 'b', 'c']
        }
      }

      const to: NounMetadata = {
        id: 'doc-1',
        type: 'document',
        name: 'Doc',
        metadata: {
          tags: ['a', 'b', 'd']
        }
      }

      const diff = compareEntityVersions(from, to, {
        entityId: 'doc-1',
        fromVersion: 1,
        toVersion: 2
      })

      // Array element change detected as modification
      expect(diff.totalChanges).toBeGreaterThan(0)
    })

    it('should handle null and undefined', () => {
      const from: NounMetadata = {
        id: 'test-1',
        type: 'thing',
        name: 'Test',
        metadata: {
          a: null,
          b: undefined,
          c: 'value'
        }
      }

      const to: NounMetadata = {
        id: 'test-1',
        type: 'thing',
        name: 'Test',
        metadata: {
          a: 'now-value',
          b: null,
          c: 'value'
        }
      }

      const diff = compareEntityVersions(from, to, {
        entityId: 'test-1',
        fromVersion: 1,
        toVersion: 2
      })

      expect(diff.totalChanges).toBeGreaterThan(0)
    })

    it('should ignore specified fields', () => {
      const from: NounMetadata = {
        id: 'user-1',
        type: 'user',
        name: 'Alice',
        metadata: {
          email: 'alice@example.com',
          lastModified: 1000,
          internal: 'ignore-me'
        }
      }

      const to: NounMetadata = {
        id: 'user-1',
        type: 'user',
        name: 'Alice Smith',
        metadata: {
          email: 'alice@example.com',
          lastModified: 2000,
          internal: 'changed'
        }
      }

      const diff = compareEntityVersions(from, to, {
        entityId: 'user-1',
        fromVersion: 1,
        toVersion: 2,
        ignoreFields: ['lastModified', 'internal']
      })

      // Should only detect name change
      expect(diff.totalChanges).toBe(1)
      expect(diff.modified.some(c => c.path.includes('name'))).toBe(true)
      expect(diff.modified.some(c => c.path.includes('lastModified'))).toBe(false)
      expect(diff.modified.some(c => c.path.includes('internal'))).toBe(false)
    })

    it('should respect maxDepth option', () => {
      const from: NounMetadata = {
        id: 'test-1',
        type: 'thing',
        name: 'Test',
        metadata: {
          level1: {
            level2: {
              level3: {
                level4: 'deep-value'
              }
            }
          }
        }
      }

      const to: NounMetadata = {
        id: 'test-1',
        type: 'thing',
        name: 'Test',
        metadata: {
          level1: {
            level2: {
              level3: {
                level4: 'changed-value'
              }
            }
          }
        }
      }

      const diff = compareEntityVersions(from, to, {
        entityId: 'test-1',
        fromVersion: 1,
        toVersion: 2,
        maxDepth: 2  // Stop at level2
      })

      // Should detect change at metadata.level1.level2 level
      expect(diff.totalChanges).toBeGreaterThan(0)
    })

    it('should handle empty objects', () => {
      const from: NounMetadata = {
        id: 'test-1',
        type: 'thing',
        name: 'Test',
        metadata: {}
      }

      const to: NounMetadata = {
        id: 'test-1',
        type: 'thing',
        name: 'Test',
        metadata: { value: 123 }
      }

      const diff = compareEntityVersions(from, to, {
        entityId: 'test-1',
        fromVersion: 1,
        toVersion: 2
      })

      expect(diff.added.length).toBe(1)
      expect(diff.added[0].newValue).toBe(123)
    })

    it('should calculate total changes correctly', () => {
      const from: NounMetadata = {
        id: 'user-1',
        type: 'user',
        name: 'Alice',
        metadata: {
          email: 'alice@example.com',
          status: 'active',
          age: 30
        }
      }

      const to: NounMetadata = {
        id: 'user-1',
        type: 'user',
        name: 'Alice Smith',
        metadata: {
          email: 'alice.smith@example.com',
          city: 'NYC'
        }
      }

      const diff = compareEntityVersions(from, to, {
        entityId: 'user-1',
        fromVersion: 1,
        toVersion: 2
      })

      const expectedTotal =
        diff.added.length +
        diff.removed.length +
        diff.modified.length +
        diff.typeChanged.length

      expect(diff.totalChanges).toBe(expectedTotal)
    })

    it('should handle complex real-world changes', () => {
      const from: NounMetadata = {
        id: 'project-1',
        type: 'thing',
        name: 'My Project',
        metadata: {
          description: 'Old description',
          status: 'draft',
          team: ['alice', 'bob'],
          config: {
            theme: 'light',
            notifications: true
          },
          createdAt: 1000
        }
      }

      const to: NounMetadata = {
        id: 'project-1',
        type: 'thing',
        name: 'My Awesome Project',
        metadata: {
          description: 'New description',
          status: 'active',
          team: ['alice', 'bob', 'charlie'],
          config: {
            theme: 'dark',
            notifications: true,
            language: 'en'
          },
          createdAt: 1000,
          updatedAt: 2000
        }
      }

      const diff = compareEntityVersions(from, to, {
        entityId: 'project-1',
        fromVersion: 1,
        toVersion: 2
      })

      expect(diff.totalChanges).toBeGreaterThan(0)
      expect(diff.modified.length).toBeGreaterThan(0)
      expect(diff.added.length).toBeGreaterThan(0)

      const nameChange = diff.modified.find(c => c.path.includes('name'))
      expect(nameChange?.newValue).toBe('My Awesome Project')
    })

    it('should handle boolean changes', () => {
      const from: NounMetadata = {
        id: 'feature-1',
        type: 'thing',
        name: 'Feature',
        metadata: { enabled: false }
      }

      const to: NounMetadata = {
        id: 'feature-1',
        type: 'thing',
        name: 'Feature',
        metadata: { enabled: true }
      }

      const diff = compareEntityVersions(from, to, {
        entityId: 'feature-1',
        fromVersion: 1,
        toVersion: 2
      })

      expect(diff.modified.length).toBe(1)
      expect(diff.modified[0].oldValue).toBe(false)
      expect(diff.modified[0].newValue).toBe(true)
    })

    it('should handle number changes', () => {
      const from: NounMetadata = {
        id: 'counter-1',
        type: 'thing',
        name: 'Counter',
        metadata: { count: 10 }
      }

      const to: NounMetadata = {
        id: 'counter-1',
        type: 'thing',
        name: 'Counter',
        metadata: { count: 20 }
      }

      const diff = compareEntityVersions(from, to, {
        entityId: 'counter-1',
        fromVersion: 1,
        toVersion: 2
      })

      expect(diff.modified.length).toBe(1)
      expect(diff.modified[0].oldValue).toBe(10)
      expect(diff.modified[0].newValue).toBe(20)
    })

    it('should handle date/timestamp changes', () => {
      const from: NounMetadata = {
        id: 'event-1',
        type: 'thing',
        name: 'Event',
        metadata: { timestamp: 1000 }
      }

      const to: NounMetadata = {
        id: 'event-1',
        type: 'thing',
        name: 'Event',
        metadata: { timestamp: 2000 }
      }

      const diff = compareEntityVersions(from, to, {
        entityId: 'event-1',
        fromVersion: 1,
        toVersion: 2
      })

      expect(diff.modified.length).toBe(1)
      expect(diff.modified[0].path).toContain('timestamp')
    })
  })
})
