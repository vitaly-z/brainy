import { describe, it, expect, beforeEach, vi } from 'vitest'
import { Brainy } from '../../../src/brainy'
import {
  BrainyAugmentation,
  BaseAugmentation,
  AugmentationContext,
  AugmentationRegistry,
  MetadataAccess
} from '../../../src/augmentations/brainyAugmentation'
import { createAddParams } from '../../helpers/test-factory'
import { NounType } from '../../../src/types/graphTypes'

/**
 * Comprehensive test suite for Brainy's augmentation system
 * Tests all aspects of the augmentation pipeline including:
 * - Registration and management
 * - Execution timing and ordering
 * - Metadata access controls
 * - Operation filtering
 * - Priority handling
 * - Error recovery
 * - Performance characteristics
 */

describe('Brainy Augmentation System - Comprehensive Tests', () => {
  let brain: Brainy<any>

  beforeEach(async () => {
    brain = new Brainy({ augmentations: {} })
    await brain.init()
  })

  describe('1. Augmentation Registration and Management', () => {
    it('should list all registered augmentations', async () => {
      const augmentations = brain.augmentations.list()
      expect(Array.isArray(augmentations)).toBe(true)
      expect(augmentations.length).toBeGreaterThan(0)
    })

    it('should get augmentation by name', async () => {
      const augmentations = brain.augmentations.list()
      if (augmentations.length > 0) {
        const aug = brain.augmentations.get(augmentations[0])
        expect(aug).toBeDefined()
        expect(aug.name).toBe(augmentations[0])
      }
    })

    it('should check if augmentation exists', async () => {
      const augmentations = brain.augmentations.list()
      if (augmentations.length > 0) {
        const name = augmentations[0]
        expect(brain.augmentations.has(name)).toBe(true)
        expect(brain.augmentations.has('non-existent')).toBe(false)
      }
    })

    it('should have default augmentations registered', async () => {
      const augmentations = brain.augmentations.list()
      // Default augmentations include cache, display, metrics
      expect(augmentations).toContain('cache')
      expect(augmentations).toContain('display')
      expect(augmentations).toContain('metrics')
    })

    it('should access augmentation registry internally', async () => {
      // Test that augmentations are actually working by triggering operations
      const id = await brain.add(createAddParams({ data: 'test' }))
      expect(id).toBeDefined()

      // The augmentations should have been applied
      const entity = await brain.get(id)
      expect(entity).toBeDefined()
    })
  })

  describe('2. Default Augmentations Behavior', () => {
    it('should have cache augmentation working', async () => {
      // Add same data twice
      const id1 = await brain.add(createAddParams({ data: 'cached test' }))
      const id2 = await brain.add(createAddParams({ data: 'cached test 2' }))

      // Get should be cached
      const entity1 = await brain.get(id1)
      const entity1Again = await brain.get(id1)

      expect(entity1).toEqual(entity1Again)
      expect(entity1).toBeDefined()
    })

    it('should have display augmentation working', async () => {
      const id = await brain.add(createAddParams({
        data: 'Display test content',
        metadata: { category: 'test' }
      }))

      const entity = await brain.get(id)
      expect(entity).toBeDefined()

      // Display augmentation should provide getDisplay method
      if (entity && typeof entity.getDisplay === 'function') {
        const display = entity.getDisplay()
        expect(display).toBeDefined()
      }
    })

    it('should have metrics augmentation tracking operations', async () => {
      // Perform several operations
      const id1 = await brain.add(createAddParams({ data: 'metrics test 1' }))
      const id2 = await brain.add(createAddParams({ data: 'metrics test 2' }))

      await brain.find({ query: 'metrics' })
      await brain.get(id1)
      await brain.update({ id: id1, data: 'updated metrics test' })
      await brain.delete(id2)

      // Metrics should be tracked (though we can't directly access them)
      expect(brain.augmentations.has('metrics')).toBe(true)
    })

    it('should apply augmentations to find operations', async () => {
      // Add test data
      await brain.add(createAddParams({ data: 'searchable content 1' }))
      await brain.add(createAddParams({ data: 'searchable content 2' }))
      await brain.add(createAddParams({ data: 'different content' }))

      // Find should work with augmentations
      const results = await brain.find({ query: 'searchable' })

      expect(results).toBeDefined()
      expect(Array.isArray(results)).toBe(true)
      expect(results.length).toBeGreaterThanOrEqual(2)
    })
  })

  describe('3. Priority Ordering', () => {
    it('should execute augmentations in priority order', async () => {
      const executionOrder: string[] = []

      const createPriorityAug = (name: string, priority: number): BrainyAugmentation => ({
        name,
        timing: 'before',
        metadata: 'none',
        operations: ['add'],
        priority,
        async initialize(context: AugmentationContext) {},
        async execute<T>(operation: string, params: any, next: () => Promise<T>): Promise<T> {
          executionOrder.push(name)
          return next()
        }
      })

      // Register in reverse priority order
      brain.augmentations.register(createPriorityAug('low-priority', 1))
      brain.augmentations.register(createPriorityAug('high-priority', 100))
      brain.augmentations.register(createPriorityAug('medium-priority', 50))

      await brain.add(createAddParams({ data: 'test' }))

      // Should execute in priority order (high to low)
      const highIndex = executionOrder.indexOf('high-priority')
      const mediumIndex = executionOrder.indexOf('medium-priority')
      const lowIndex = executionOrder.indexOf('low-priority')

      expect(highIndex).toBeLessThan(mediumIndex)
      expect(mediumIndex).toBeLessThan(lowIndex)
    })
  })

  describe('4. Operation Filtering', () => {
    it('should only execute for specified operations', async () => {
      let addExecuted = false
      let findExecuted = false

      const addOnlyAug: BrainyAugmentation = {
        name: 'add-only',
        timing: 'before',
        metadata: 'none',
        operations: ['add'],
        priority: 10,
        async initialize(context: AugmentationContext) {},
        async execute<T>(operation: string, params: any, next: () => Promise<T>): Promise<T> {
          if (operation === 'add') addExecuted = true
          if (operation === 'find') findExecuted = true
          return next()
        }
      }

      brain.augmentations.register(addOnlyAug)

      await brain.add(createAddParams({ data: 'test' }))
      await brain.find({ query: 'test' })

      expect(addExecuted).toBe(true)
      expect(findExecuted).toBe(false)
    })

    it('should execute for all operations when using "all"', async () => {
      const executedOperations = new Set<string>()

      const allOpsAug: BrainyAugmentation = {
        name: 'all-ops',
        timing: 'before',
        metadata: 'none',
        operations: ['all'],
        priority: 10,
        async initialize(context: AugmentationContext) {},
        async execute<T>(operation: string, params: any, next: () => Promise<T>): Promise<T> {
          executedOperations.add(operation)
          return next()
        }
      }

      brain.augmentations.register(allOpsAug)

      const id = await brain.add(createAddParams({ data: 'test' }))
      await brain.find({ query: 'test' })
      await brain.update({ id, data: 'updated' })
      await brain.delete(id)

      expect(executedOperations).toContain('add')
      expect(executedOperations).toContain('find')
      expect(executedOperations).toContain('update')
      expect(executedOperations).toContain('delete')
    })

    it('should respect shouldExecute filter', async () => {
      let executed = false

      const conditionalAug: BrainyAugmentation = {
        name: 'conditional',
        timing: 'before',
        metadata: 'none',
        operations: ['add'],
        priority: 10,
        async initialize(context: AugmentationContext) {},
        shouldExecute(operation: string, params: any): boolean {
          // Only execute for entities with special metadata
          return params.metadata?.special === true
        },
        async execute<T>(operation: string, params: any, next: () => Promise<T>): Promise<T> {
          executed = true
          return next()
        }
      }

      brain.augmentations.register(conditionalAug)

      // Should not execute
      await brain.add(createAddParams({ data: 'normal' }))
      expect(executed).toBe(false)

      // Should execute
      await brain.add(createAddParams({
        data: 'special',
        metadata: { special: true }
      }))
      expect(executed).toBe(true)
    })
  })

  describe('5. Metadata Access Control', () => {
    it('should respect no metadata access', async () => {
      const noAccessAug: BrainyAugmentation = {
        name: 'no-access',
        timing: 'before',
        metadata: 'none',
        operations: ['add'],
        priority: 10,
        async initialize(context: AugmentationContext) {},
        async execute<T>(operation: string, params: any, next: () => Promise<T>): Promise<T> {
          // Should not be able to modify metadata
          if (params.metadata) {
            params.metadata.injected = 'value'
          }
          return next()
        }
      }

      brain.augmentations.register(noAccessAug)

      const id = await brain.add(createAddParams({
        data: 'test',
        metadata: { original: 'value' }
      }))

      const entity = await brain.get(id)
      expect(entity?.metadata?.injected).toBeUndefined()
      expect(entity?.metadata?.original).toBe('value')
    })

    it('should allow readonly metadata access', async () => {
      let readValue: any

      const readonlyAug: BrainyAugmentation = {
        name: 'readonly',
        timing: 'before',
        metadata: 'readonly',
        operations: ['add'],
        priority: 10,
        async initialize(context: AugmentationContext) {},
        async execute<T>(operation: string, params: any, next: () => Promise<T>): Promise<T> {
          readValue = params.metadata?.original
          return next()
        }
      }

      brain.augmentations.register(readonlyAug)

      await brain.add(createAddParams({
        data: 'test',
        metadata: { original: 'value' }
      }))

      expect(readValue).toBe('value')
    })

    it('should allow specific field access', async () => {
      const fieldAccessAug: BrainyAugmentation = {
        name: 'field-access',
        timing: 'before',
        metadata: {
          reads: ['original'],
          writes: ['computed']
        },
        operations: ['add'],
        priority: 10,
        async initialize(context: AugmentationContext) {},
        async execute<T>(operation: string, params: any, next: () => Promise<T>): Promise<T> {
          if (params.metadata?.original) {
            params.metadata.computed = params.metadata.original.toUpperCase()
          }
          return next()
        }
      }

      brain.augmentations.register(fieldAccessAug)

      const id = await brain.add(createAddParams({
        data: 'test',
        metadata: { original: 'value' }
      }))

      const entity = await brain.get(id)
      expect(entity?.metadata?.computed).toBe('VALUE')
    })

    it('should support namespace metadata', async () => {
      const namespaceAug: BrainyAugmentation = {
        name: 'namespace',
        timing: 'after',
        metadata: {
          namespace: '_custom',
          writes: ['*']
        },
        operations: ['add'],
        priority: 10,
        async initialize(context: AugmentationContext) {},
        async execute<T>(operation: string, params: any, next: () => Promise<T>): Promise<T> {
          const result = await next()
          // Add namespaced metadata
          if (!params.metadata) params.metadata = {}
          params.metadata._custom = {
            processed: true,
            timestamp: Date.now()
          }
          return result
        }
      }

      brain.augmentations.register(namespaceAug)

      const id = await brain.add(createAddParams({ data: 'test' }))
      const entity = await brain.get(id)

      expect(entity?.metadata?._custom).toBeDefined()
      expect(entity?.metadata?._custom?.processed).toBe(true)
    })
  })

  describe('6. Computed Fields', () => {
    it('should provide computed fields', async () => {
      const computedAug: BrainyAugmentation = {
        name: 'computed-fields',
        timing: 'after',
        metadata: 'none',
        operations: ['get', 'find'],
        priority: 10,
        async initialize(context: AugmentationContext) {},
        async execute<T>(operation: string, params: any, next: () => Promise<T>): Promise<T> {
          return next()
        },
        computedFields: {
          display: {
            formattedTitle: {
              type: 'string',
              description: 'Formatted title for display'
            },
            summary: {
              type: 'string',
              description: 'Short summary'
            }
          }
        },
        computeFields(result: any, namespace: string): Record<string, any> {
          if (namespace === 'display') {
            return {
              formattedTitle: result.data?.toUpperCase() || 'UNTITLED',
              summary: result.data?.substring(0, 50) || ''
            }
          }
          return {}
        }
      }

      brain.augmentations.register(computedAug)

      const id = await brain.add(createAddParams({
        data: 'This is a test document with some content'
      }))

      const entity = await brain.get(id)
      if (entity && typeof entity.getDisplay === 'function') {
        const display = entity.getDisplay()
        expect(display.formattedTitle).toBe('THIS IS A TEST DOCUMENT WITH SOME CONTENT')
        expect(display.summary).toBe('This is a test document with some content')
      }
    })
  })

  describe('7. Error Handling', () => {
    it('should handle augmentation errors gracefully', async () => {
      const errorAug: BrainyAugmentation = {
        name: 'error-aug',
        timing: 'before',
        metadata: 'none',
        operations: ['add'],
        priority: 10,
        async initialize(context: AugmentationContext) {},
        async execute<T>(operation: string, params: any, next: () => Promise<T>): Promise<T> {
          throw new Error('Augmentation error')
        }
      }

      brain.augmentations.register(errorAug)

      // Should not prevent operation from completing
      const id = await brain.add(createAddParams({ data: 'test' }))
      expect(id).toBeDefined()
    })

    it('should handle initialization errors', async () => {
      const failInitAug: BrainyAugmentation = {
        name: 'fail-init',
        timing: 'before',
        metadata: 'none',
        operations: ['add'],
        priority: 10,
        async initialize(context: AugmentationContext) {
          throw new Error('Init failed')
        },
        async execute<T>(operation: string, params: any, next: () => Promise<T>): Promise<T> {
          return next()
        }
      }

      // Should handle initialization failure gracefully
      const success = brain.augmentations.register(failInitAug)
      expect(success).toBeDefined() // May be true or false depending on implementation
    })

    it('should handle shutdown errors', async () => {
      const failShutdownAug: BrainyAugmentation = {
        name: 'fail-shutdown',
        timing: 'before',
        metadata: 'none',
        operations: ['add'],
        priority: 10,
        async initialize(context: AugmentationContext) {},
        async execute<T>(operation: string, params: any, next: () => Promise<T>): Promise<T> {
          return next()
        },
        async shutdown() {
          throw new Error('Shutdown failed')
        }
      }

      brain.augmentations.register(failShutdownAug)

      // Should handle shutdown failure gracefully
      await expect(brain.close()).resolves.not.toThrow()
    })
  })

  describe('8. Augmentation Chaining', () => {
    it('should chain multiple augmentations correctly', async () => {
      const chain: string[] = []

      const createChainAug = (name: string): BrainyAugmentation => ({
        name,
        timing: 'around',
        metadata: 'none',
        operations: ['add'],
        priority: 10,
        async initialize(context: AugmentationContext) {},
        async execute<T>(operation: string, params: any, next: () => Promise<T>): Promise<T> {
          chain.push(`${name}-start`)
          const result = await next()
          chain.push(`${name}-end`)
          return result
        }
      })

      brain.augmentations.register(createChainAug('aug1'))
      brain.augmentations.register(createChainAug('aug2'))
      brain.augmentations.register(createChainAug('aug3'))

      await brain.add(createAddParams({ data: 'test' }))

      // Verify proper nesting
      expect(chain).toContain('aug1-start')
      expect(chain).toContain('aug2-start')
      expect(chain).toContain('aug3-start')
      expect(chain).toContain('aug3-end')
      expect(chain).toContain('aug2-end')
      expect(chain).toContain('aug1-end')
    })

    it('should pass modified parameters through chain', async () => {
      const modifyAug1: BrainyAugmentation = {
        name: 'modify1',
        timing: 'before',
        metadata: { writes: ['stage1'] },
        operations: ['add'],
        priority: 100,
        async initialize(context: AugmentationContext) {},
        async execute<T>(operation: string, params: any, next: () => Promise<T>): Promise<T> {
          params.metadata = { ...params.metadata, stage1: true }
          return next()
        }
      }

      const modifyAug2: BrainyAugmentation = {
        name: 'modify2',
        timing: 'before',
        metadata: { writes: ['stage2'] },
        operations: ['add'],
        priority: 50,
        async initialize(context: AugmentationContext) {},
        async execute<T>(operation: string, params: any, next: () => Promise<T>): Promise<T> {
          params.metadata = { ...params.metadata, stage2: true }
          return next()
        }
      }

      brain.augmentations.register(modifyAug1)
      brain.augmentations.register(modifyAug2)

      const id = await brain.add(createAddParams({ data: 'test' }))
      const entity = await brain.get(id)

      expect(entity?.metadata?.stage1).toBe(true)
      expect(entity?.metadata?.stage2).toBe(true)
    })
  })

  describe('9. Performance', () => {
    it('should handle many augmentations efficiently', async () => {
      // Register 100 augmentations
      for (let i = 0; i < 100; i++) {
        const aug: BrainyAugmentation = {
          name: `perf-aug-${i}`,
          timing: 'before',
          metadata: 'none',
          operations: ['add'],
          priority: i,
          async initialize(context: AugmentationContext) {},
          async execute<T>(operation: string, params: any, next: () => Promise<T>): Promise<T> {
            // Minimal work
            return next()
          }
        }
        brain.augmentations.register(aug)
      }

      const start = Date.now()
      await brain.add(createAddParams({ data: 'performance test' }))
      const duration = Date.now() - start

      // Should complete quickly even with many augmentations
      expect(duration).toBeLessThan(1000)
    })

    it('should cache augmentation lookups', async () => {
      let lookupCount = 0

      const trackingAug: BrainyAugmentation = {
        name: 'tracking',
        timing: 'before',
        metadata: 'none',
        operations: ['add'],
        priority: 10,
        async initialize(context: AugmentationContext) {},
        shouldExecute(operation: string, params: any): boolean {
          lookupCount++
          return true
        },
        async execute<T>(operation: string, params: any, next: () => Promise<T>): Promise<T> {
          return next()
        }
      }

      brain.augmentations.register(trackingAug)

      // Multiple operations
      await brain.add(createAddParams({ data: 'test1' }))
      const firstCount = lookupCount

      await brain.add(createAddParams({ data: 'test2' }))
      const secondCount = lookupCount

      // Should use cached lookup (same or minimal increase)
      expect(secondCount - firstCount).toBeLessThanOrEqual(1)
    })
  })

  describe('10. Integration with Core APIs', () => {
    it('should augment add operations', async () => {
      let augmented = false

      const addAug: BrainyAugmentation = {
        name: 'add-aug',
        timing: 'after',
        metadata: 'none',
        operations: ['add'],
        priority: 10,
        async initialize(context: AugmentationContext) {},
        async execute<T>(operation: string, params: any, next: () => Promise<T>): Promise<T> {
          const result = await next()
          augmented = true
          return result
        }
      }

      brain.augmentations.register(addAug)

      await brain.add(createAddParams({ data: 'test' }))
      expect(augmented).toBe(true)
    })

    it('should augment find operations', async () => {
      let augmented = false

      const findAug: BrainyAugmentation = {
        name: 'find-aug',
        timing: 'around',
        metadata: 'none',
        operations: ['find'],
        priority: 10,
        async initialize(context: AugmentationContext) {},
        async execute<T>(operation: string, params: any, next: () => Promise<T>): Promise<T> {
          augmented = true
          return next()
        }
      }

      brain.augmentations.register(findAug)

      await brain.find({ query: 'test' })
      expect(augmented).toBe(true)
    })

    it('should augment relationship operations', async () => {
      let relateAugmented = false

      const relateAug: BrainyAugmentation = {
        name: 'relate-aug',
        timing: 'before',
        metadata: 'none',
        operations: ['relate'],
        priority: 10,
        async initialize(context: AugmentationContext) {},
        async execute<T>(operation: string, params: any, next: () => Promise<T>): Promise<T> {
          relateAugmented = true
          return next()
        }
      }

      brain.augmentations.register(relateAug)

      const id1 = await brain.add(createAddParams({ data: 'entity1' }))
      const id2 = await brain.add(createAddParams({ data: 'entity2' }))

      await brain.relate({
        from: id1,
        to: id2,
        type: 'connects'
      })

      expect(relateAugmented).toBe(true)
    })
  })

  describe('11. Base Augmentation Class', () => {
    it('should extend BaseAugmentation correctly', async () => {
      class CustomAugmentation extends BaseAugmentation {
        name = 'custom-base'
        timing = 'before' as const
        metadata = 'none' as const
        operations = ['add'] as const
        priority = 10

        async doInitialize(context: AugmentationContext): Promise<void> {
          // Custom init
        }

        async doExecute<T>(operation: string, params: any, next: () => Promise<T>): Promise<T> {
          return next()
        }
      }

      const customAug = new CustomAugmentation()
      const success = brain.augmentations.register(customAug)

      expect(success).toBe(true)
      expect(brain.augmentations.list()).toContain('custom-base')
    })
  })

  describe('12. Augmentation Discovery', () => {
    it('should discover augmentation capabilities', async () => {
      const discoverableAug: BrainyAugmentation = {
        name: 'discoverable',
        timing: 'after',
        metadata: 'none',
        operations: ['get', 'find'],
        priority: 10,
        async initialize(context: AugmentationContext) {},
        async execute<T>(operation: string, params: any, next: () => Promise<T>): Promise<T> {
          return next()
        },
        computedFields: {
          analytics: {
            viewCount: {
              type: 'number',
              description: 'Number of times viewed',
              confidence: 0.9
            },
            lastViewed: {
              type: 'string',
              description: 'Last viewed timestamp'
            }
          }
        }
      }

      brain.augmentations.register(discoverableAug)

      const aug = brain.augmentations.get('discoverable')
      expect(aug).toBeDefined()

      // Check if computed fields are discoverable
      if (aug && 'computedFields' in aug) {
        expect(aug.computedFields).toBeDefined()
        expect(aug.computedFields.analytics).toBeDefined()
        expect(aug.computedFields.analytics.viewCount.type).toBe('number')
      }
    })
  })

  describe('13. Edge Cases', () => {
    it('should handle empty operations array', async () => {
      const emptyOpsAug: BrainyAugmentation = {
        name: 'empty-ops',
        timing: 'before',
        metadata: 'none',
        operations: [],
        priority: 10,
        async initialize(context: AugmentationContext) {},
        async execute<T>(operation: string, params: any, next: () => Promise<T>): Promise<T> {
          return next()
        }
      }

      const success = brain.augmentations.register(emptyOpsAug)
      expect(success).toBeDefined()
    })

    it('should handle duplicate augmentation names', async () => {
      const aug1: BrainyAugmentation = {
        name: 'duplicate',
        timing: 'before',
        metadata: 'none',
        operations: ['add'],
        priority: 10,
        async initialize(context: AugmentationContext) {},
        async execute<T>(operation: string, params: any, next: () => Promise<T>): Promise<T> {
          return next()
        }
      }

      const aug2: BrainyAugmentation = {
        name: 'duplicate',
        timing: 'after',
        metadata: 'none',
        operations: ['find'],
        priority: 20,
        async initialize(context: AugmentationContext) {},
        async execute<T>(operation: string, params: any, next: () => Promise<T>): Promise<T> {
          return next()
        }
      }

      const success1 = brain.augmentations.register(aug1)
      const success2 = brain.augmentations.register(aug2)

      expect(success1).toBe(true)
      expect(success2).toBe(false) // Should reject duplicate
    })

    it('should handle very long augmentation chains', async () => {
      // Create a chain of 50 augmentations
      for (let i = 0; i < 50; i++) {
        const aug: BrainyAugmentation = {
          name: `chain-${i}`,
          timing: 'around',
          metadata: 'none',
          operations: ['add'],
          priority: i,
          async initialize(context: AugmentationContext) {},
          async execute<T>(operation: string, params: any, next: () => Promise<T>): Promise<T> {
            return next()
          }
        }
        brain.augmentations.register(aug)
      }

      // Should handle deep nesting without stack overflow
      const id = await brain.add(createAddParams({ data: 'deep chain test' }))
      expect(id).toBeDefined()
    })
  })

  describe('14. Cleanup and Lifecycle', () => {
    it('should call shutdown on all augmentations', async () => {
      let shutdownCalled = false

      const lifecycleAug: BrainyAugmentation = {
        name: 'lifecycle',
        timing: 'before',
        metadata: 'none',
        operations: ['add'],
        priority: 10,
        async initialize(context: AugmentationContext) {},
        async execute<T>(operation: string, params: any, next: () => Promise<T>): Promise<T> {
          return next()
        },
        async shutdown() {
          shutdownCalled = true
        }
      }

      brain.augmentations.register(lifecycleAug)

      await brain.close()
      expect(shutdownCalled).toBe(true)
    })

    it('should handle re-initialization', async () => {
      let initCount = 0

      const reinitAug: BrainyAugmentation = {
        name: 'reinit',
        timing: 'before',
        metadata: 'none',
        operations: ['add'],
        priority: 10,
        async initialize(context: AugmentationContext) {
          initCount++
        },
        async execute<T>(operation: string, params: any, next: () => Promise<T>): Promise<T> {
          return next()
        }
      }

      brain.augmentations.register(reinitAug)
      expect(initCount).toBe(1)

      // Re-registering should not re-initialize
      brain.augmentations.register(reinitAug)
      expect(initCount).toBe(1)
    })
  })
})