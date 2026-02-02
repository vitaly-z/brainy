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
    brain = new Brainy({
      enableCache: false,
      storage: { type: 'memory' } // Use memory storage for tests
    })
    await brain.init()
  })

  describe('clusterByTime() - Temporal clustering', () => {
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
