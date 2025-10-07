/**
 * Domain and Time Clustering Tests
 *
 * Tests for clusterByDomain() and clusterByTime() methods
 * that were previously stub implementations.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { Brainy } from '../../../src/brainy'
import { NounType } from '../../../src/types/graphTypes'
import { createAddParams } from '../../helpers/test-factory'

describe('Domain and Time Clustering', () => {
  let brain: Brainy

  beforeEach(async () => {
    brain = new Brainy({ enableCache: false })
    await brain.init()
  })

  describe('clusterByDomain() - Field-based clustering', () => {
    it('should cluster entities by type field', async () => {
      // Add entities of different types
      await brain.add(createAddParams({
        data: 'John Smith is a person',
        type: NounType.Person
      }))
      await brain.add(createAddParams({
        data: 'Jane Doe is also a person',
        type: NounType.Person
      }))
      await brain.add(createAddParams({
        data: 'Technical document about AI',
        type: NounType.Document
      }))
      await brain.add(createAddParams({
        data: 'Research paper on machine learning',
        type: NounType.Document
      }))
      await brain.add(createAddParams({
        data: 'Microsoft Corporation',
        type: NounType.Organization
      }))

      // Cluster by type field
      const clusters = await brain.neural().clusterByDomain('type', {
        minClusterSize: 1,
        maxClusters: 10
      })

      // Should have clusters for each type
      expect(Array.isArray(clusters)).toBe(true)
      expect(clusters.length).toBeGreaterThan(0)

      // Verify domain values exist
      const domains = new Set(clusters.map(c => c.domain))
      expect(domains.has(NounType.Person) || domains.has('person')).toBe(true)
      expect(domains.has(NounType.Document) || domains.has('document')).toBe(true)
    })

    it('should cluster entities by metadata field', async () => {
      // Add entities with category metadata
      await brain.add(createAddParams({
        data: 'JavaScript programming guide',
        type: NounType.Document,
        metadata: { category: 'programming' }
      }))
      await brain.add(createAddParams({
        data: 'Python tutorial',
        type: NounType.Document,
        metadata: { category: 'programming' }
      }))
      await brain.add(createAddParams({
        data: 'Chocolate cake recipe',
        type: NounType.Document,
        metadata: { category: 'cooking' }
      }))
      await brain.add(createAddParams({
        data: 'Pasta preparation',
        type: NounType.Document,
        metadata: { category: 'cooking' }
      }))

      // Cluster by category field
      const clusters = await brain.neural().clusterByDomain('category', {
        minClusterSize: 1,
        maxClusters: 5
      })

      expect(Array.isArray(clusters)).toBe(true)
      expect(clusters.length).toBeGreaterThan(0)

      // Verify categories are in domains
      const domains = new Set(clusters.map(c => c.domain))
      expect(domains.has('programming')).toBe(true)
      expect(domains.has('cooking')).toBe(true)
    })

    it('should handle entities without the specified field', async () => {
      // Add entities with and without category
      await brain.add(createAddParams({
        data: 'Has category',
        metadata: { category: 'tech' }
      }))
      await brain.add(createAddParams({
        data: 'No category'
      }))

      const clusters = await brain.neural().clusterByDomain('category', {
        minClusterSize: 1
      })

      expect(Array.isArray(clusters)).toBe(true)

      // Should have 'tech' and 'unknown' domains
      const domains = new Set(clusters.map(c => c.domain))
      expect(domains.has('tech')).toBe(true)
      expect(domains.has('unknown')).toBe(true)
    })
  })

  describe('clusterByTime() - Temporal clustering', () => {
    it('should cluster entities by time windows', async () => {
      const now = new Date()
      const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000)
      const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
      const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

      // Add entities with different timestamps
      await brain.add(createAddParams({
        data: 'Recent item 1',
        metadata: { publishedAt: now.toISOString() }
      }))
      await brain.add(createAddParams({
        data: 'Recent item 2',
        metadata: { publishedAt: oneDayAgo.toISOString() }
      }))
      await brain.add(createAddParams({
        data: 'Old item 1',
        metadata: { publishedAt: oneWeekAgo.toISOString() }
      }))
      await brain.add(createAddParams({
        data: 'Very old item',
        metadata: { publishedAt: oneMonthAgo.toISOString() }
      }))

      // Define time windows
      const timeWindows = [
        {
          start: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000), // Last 2 days
          end: now,
          label: 'Recent'
        },
        {
          start: new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000), // 2-14 days ago
          end: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000),
          label: 'This Week'
        },
        {
          start: new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000), // 14-60 days ago
          end: new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000),
          label: 'Older'
        }
      ]

      // Cluster by time
      const clusters = await brain.neural().clusterByTime('publishedAt', timeWindows, {
        timeField: 'publishedAt',
        windows: timeWindows
      })

      expect(Array.isArray(clusters)).toBe(true)
      expect(clusters.length).toBeGreaterThan(0)

      // Verify time windows are represented
      const windowLabels = new Set(clusters.map(c => c.timeWindow?.label))
      expect(windowLabels.size).toBeGreaterThan(0)
    })

    it('should cluster entities by createdAt timestamps', async () => {
      // These will use the auto-generated createdAt timestamps
      const id1 = await brain.add(createAddParams({
        data: 'First item'
      }))

      // Wait a bit to ensure different timestamps
      await new Promise(resolve => setTimeout(resolve, 10))

      const id2 = await brain.add(createAddParams({
        data: 'Second item'
      }))

      const now = new Date()
      const timeWindows = [
        {
          start: new Date(now.getTime() - 60 * 60 * 1000), // Last hour
          end: new Date(now.getTime() + 60 * 60 * 1000), // Next hour (to include all)
          label: 'Now'
        }
      ]

      const clusters = await brain.neural().clusterByTime('createdAt', timeWindows, {
        timeField: 'createdAt',
        windows: timeWindows
      })

      expect(Array.isArray(clusters)).toBe(true)

      // Both items should be in the 'Now' time window
      const nowCluster = clusters.find(c => c.timeWindow?.label === 'Now')
      expect(nowCluster).toBeDefined()
      if (nowCluster) {
        expect(nowCluster.members.length).toBeGreaterThanOrEqual(2)
      }
    })

    it('should handle empty time windows gracefully', async () => {
      const futureStart = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000) // 1 year from now
      const futureEnd = new Date(Date.now() + 2 * 365 * 24 * 60 * 60 * 1000) // 2 years from now

      const timeWindows = [
        {
          start: futureStart,
          end: futureEnd,
          label: 'Future'
        }
      ]

      const clusters = await brain.neural().clusterByTime('createdAt', timeWindows, {
        timeField: 'createdAt',
        windows: timeWindows
      })

      // Should return empty array or array with empty clusters
      expect(Array.isArray(clusters)).toBe(true)
    })
  })

  describe('Cross-domain functionality', () => {
    it('should find cross-domain clusters when enabled', async () => {
      // Add entities from different domains with similar content
      await brain.add(createAddParams({
        data: 'Machine learning and artificial intelligence',
        type: NounType.Document,
        metadata: { category: 'tech' }
      }))
      await brain.add(createAddParams({
        data: 'AI and neural networks',
        type: NounType.Concept,
        metadata: { category: 'science' }
      }))

      const clusters = await brain.neural().clusterByDomain('category', {
        minClusterSize: 1,
        preserveDomainBoundaries: false, // Enable cross-domain clustering
        crossDomainThreshold: 0.5
      })

      expect(Array.isArray(clusters)).toBe(true)
      expect(clusters.length).toBeGreaterThan(0)
    })
  })
})
