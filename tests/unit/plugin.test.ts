/**
 * Plugin System Integration Tests
 *
 * Tests the PluginRegistry lifecycle, provider resolution in init(),
 * fallback behavior, and error handling.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { PluginRegistry } from '../../src/plugin.js'
import type { BrainyPlugin, BrainyPluginContext } from '../../src/plugin.js'
import { Brainy } from '../../src/brainy.js'
import { NounType } from '../../src/types/graphTypes.js'
import { MetadataIndexManager } from '../../src/utils/metadataIndex.js'
import { setGlobalCache, getGlobalCache, clearGlobalCache, UnifiedCache } from '../../src/utils/unifiedCache.js'

describe('PluginRegistry', () => {
  let registry: PluginRegistry

  beforeEach(() => {
    registry = new PluginRegistry()
  })

  it('should register and retrieve a plugin', () => {
    const plugin: BrainyPlugin = {
      name: 'test-plugin',
      activate: async () => true
    }

    registry.register(plugin)
    expect(registry.getActivePlugins()).toEqual([])
  })

  it('should activate a plugin and expose providers', async () => {
    const plugin: BrainyPlugin = {
      name: 'test-plugin',
      activate: async (ctx) => {
        ctx.registerProvider('distance', () => 0.42)
        return true
      }
    }

    registry.register(plugin)
    const context: BrainyPluginContext = {
      registerProvider: (key, impl) => registry.registerProvider(key, impl),
      version: '7.9.3'
    }

    const activated = await registry.activateAll(context)
    expect(activated).toEqual(['test-plugin'])
    expect(registry.getActivePlugins()).toEqual(['test-plugin'])
    expect(registry.hasProvider('distance')).toBe(true)

    const distFn = registry.getProvider<() => number>('distance')
    expect(distFn!()).toBe(0.42)
  })

  it('should skip plugin that returns false', async () => {
    const plugin: BrainyPlugin = {
      name: 'unavailable-plugin',
      activate: async () => false
    }

    registry.register(plugin)
    const context: BrainyPluginContext = {
      registerProvider: (key, impl) => registry.registerProvider(key, impl),
      version: '7.9.3'
    }

    const activated = await registry.activateAll(context)
    expect(activated).toEqual([])
    expect(registry.getActivePlugins()).toEqual([])
  })

  it('should handle plugin that throws during activate', async () => {
    const plugin: BrainyPlugin = {
      name: 'broken-plugin',
      activate: async () => {
        throw new Error('activation failed')
      }
    }

    registry.register(plugin)
    const context: BrainyPluginContext = {
      registerProvider: (key, impl) => registry.registerProvider(key, impl),
      version: '7.9.3'
    }

    // Should not throw — graceful fallback
    const activated = await registry.activateAll(context)
    expect(activated).toEqual([])
    expect(registry.getActivePlugins()).toEqual([])
  })

  it('should deactivate plugins', async () => {
    const deactivateFn = vi.fn()
    const plugin: BrainyPlugin = {
      name: 'test-plugin',
      activate: async () => true,
      deactivate: deactivateFn
    }

    registry.register(plugin)
    const context: BrainyPluginContext = {
      registerProvider: (key, impl) => registry.registerProvider(key, impl),
      version: '7.9.3'
    }

    await registry.activateAll(context)
    expect(registry.getActivePlugins()).toEqual(['test-plugin'])

    await registry.deactivateAll()
    expect(registry.getActivePlugins()).toEqual([])
    expect(deactivateFn).toHaveBeenCalledOnce()
  })

  it('should not activate same plugin twice', async () => {
    let activateCount = 0
    const plugin: BrainyPlugin = {
      name: 'once-plugin',
      activate: async () => {
        activateCount++
        return true
      }
    }

    registry.register(plugin)
    const context: BrainyPluginContext = {
      registerProvider: (key, impl) => registry.registerProvider(key, impl),
      version: '7.9.3'
    }

    await registry.activateAll(context)
    await registry.activateAll(context)
    expect(activateCount).toBe(1)
  })

  it('should register multiple providers from one plugin', async () => {
    const plugin: BrainyPlugin = {
      name: 'multi-provider',
      activate: async (ctx) => {
        ctx.registerProvider('distance', () => 0.5)
        ctx.registerProvider('msgpack', { encode: () => null, decode: () => null })
        ctx.registerProvider('roaring', class FakeRoaring {})
        return true
      }
    }

    registry.register(plugin)
    const context: BrainyPluginContext = {
      registerProvider: (key, impl) => registry.registerProvider(key, impl),
      version: '7.9.3'
    }

    await registry.activateAll(context)
    expect(registry.hasProvider('distance')).toBe(true)
    expect(registry.hasProvider('msgpack')).toBe(true)
    expect(registry.hasProvider('roaring')).toBe(true)
    expect(registry.hasProvider('hnsw')).toBe(false)
  })

  it('should handle storage adapter factory registration', () => {
    registry.registerProvider('storage:redis', {
      name: 'redis',
      create: () => ({} as any)
    })

    const factory = registry.getStorageFactory('redis')
    expect(factory).toBeDefined()
    expect(factory!.name).toBe('redis')
  })
})

describe('setGlobalCache', () => {
  beforeEach(() => {
    clearGlobalCache()
  })

  it('should replace the global cache singleton', () => {
    // Get default cache
    const defaultCache = getGlobalCache()
    expect(defaultCache).toBeInstanceOf(UnifiedCache)

    // Replace with a new one
    const customCache = new UnifiedCache({ maxSize: 1024 * 1024 })
    setGlobalCache(customCache)

    // Verify replacement
    const retrieved = getGlobalCache()
    expect(retrieved).toBe(customCache)
    expect(retrieved).not.toBe(defaultCache)

    // Clean up
    clearGlobalCache()
  })
})

describe('Brainy plugin integration', () => {
  it('should use distance provider from plugin', async () => {
    const mockPlugin: BrainyPlugin = {
      name: 'test-distance',
      activate: async (ctx) => {
        ctx.registerProvider('distance', (a: number[], b: number[]) => {
          // Simple euclidean for testing
          let sum = 0
          for (let i = 0; i < a.length; i++) {
            sum += (a[i] - b[i]) ** 2
          }
          return Math.sqrt(sum)
        })
        return true
      }
    }

    const brain = new Brainy({
      storage: { type: 'memory' },
      silent: true,
      augmentations: { cache: false, metrics: false, display: false, monitoring: false }
    })
    brain.use(mockPlugin)
    await brain.init()

    expect(brain.getActivePlugins()).toContain('test-distance')
    await brain.close()
  })

  it('should verify metadataIndex factory provider is called', async () => {
    let factoryCalled = false

    const mockPlugin: BrainyPlugin = {
      name: 'test-metadata-check',
      activate: async (ctx) => {
        // Register a factory — we only verify it gets called,
        // not that the mock works as a full MetadataIndexManager replacement.
        // The real NativeMetadataIndex in cortex implements the full interface.
        ctx.registerProvider('metadataIndex', (storage: any) => {
          factoryCalled = true
          // Return a real MetadataIndexManager so init() works end-to-end
          return new MetadataIndexManager(storage)
        })
        return true
      }
    }

    const brain = new Brainy({
      storage: { type: 'memory' },
      silent: true,
      augmentations: { cache: false, metrics: false, display: false, monitoring: false }
    })
    brain.use(mockPlugin)
    await brain.init()

    expect(factoryCalled).toBe(true)
    expect(brain.getActivePlugins()).toContain('test-metadata-check')
    await brain.close()
  })

  it('should fall back to TS implementations when plugin returns false', async () => {
    const mockPlugin: BrainyPlugin = {
      name: 'unavailable-native',
      activate: async () => false
    }

    const brain = new Brainy({
      storage: { type: 'memory' },
      silent: true,
      augmentations: { cache: false, metrics: false, display: false, monitoring: false }
    })
    brain.use(mockPlugin)
    await brain.init()

    // Should initialize normally with TS fallbacks
    expect(brain.getActivePlugins()).toEqual([])

    // Should still work with TS implementations
    const id = await brain.add({
      data: { name: 'test' },
      type: NounType.Concept,
      metadata: { tag: 'unit-test' }
    })
    expect(id).toBeTypeOf('string')

    await brain.close()
  })

  it('should fall back gracefully when plugin throws', async () => {
    const mockPlugin: BrainyPlugin = {
      name: 'crashing-plugin',
      activate: async () => {
        throw new Error('native module not found')
      }
    }

    const brain = new Brainy({
      storage: { type: 'memory' },
      silent: true,
      augmentations: { cache: false, metrics: false, display: false, monitoring: false }
    })
    brain.use(mockPlugin)

    // Should not throw — graceful fallback to TS
    await brain.init()
    expect(brain.getActivePlugins()).toEqual([])

    const id = await brain.add({
      data: { name: 'test' },
      type: NounType.Concept,
      metadata: { tag: 'unit-test' }
    })
    expect(id).toBeTypeOf('string')

    await brain.close()
  })

  it('should use() return this for chaining', () => {
    const plugin: BrainyPlugin = {
      name: 'chain-test',
      activate: async () => true
    }

    const brain = new Brainy({ storage: { type: 'memory' } })
    const result = brain.use(plugin)
    expect(result).toBe(brain)
  })
})
