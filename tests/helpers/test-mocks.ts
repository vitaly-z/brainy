/**
 * Test Mocks - Mock implementations and spies for Brainy tests
 * Provides mock objects and spy utilities for testing
 */

import { vi } from 'vitest'
import type { StorageAdapter } from '../../src/coreTypes'
import type { Entity, Relation } from '../../src/types/brainy.types'

/**
 * Create a mock storage adapter
 */
export function createMockStorageAdapter(): StorageAdapter {
  const store = new Map<string, any>()
  const relationStore = new Map<string, any[]>()
  
  return {
    init: vi.fn(async () => {}),
    close: vi.fn(async () => {}),
    
    // Entity operations
    storeVector: vi.fn(async (id: string, vector: number[], metadata?: any) => {
      store.set(id, { id, vector, metadata })
    }),
    
    getVector: vi.fn(async (id: string) => {
      const item = store.get(id)
      return item ? item.vector : null
    }),
    
    getMetadata: vi.fn(async (id: string) => {
      const item = store.get(id)
      return item ? item.metadata : null
    }),
    
    deleteVector: vi.fn(async (id: string) => {
      return store.delete(id)
    }),
    
    updateVector: vi.fn(async (id: string, vector: number[], metadata?: any) => {
      if (!store.has(id)) return false
      store.set(id, { id, vector, metadata })
      return true
    }),
    
    hasVector: vi.fn(async (id: string) => {
      return store.has(id)
    }),
    
    // Relation operations
    storeRelation: vi.fn(async (from: string, to: string, type: string, metadata?: any) => {
      const relation = { from, to, type, metadata }
      const key = `${from}-${to}-${type}`
      
      if (!relationStore.has(from)) {
        relationStore.set(from, [])
      }
      relationStore.get(from)!.push(relation)
      
      return key
    }),
    
    getRelations: vi.fn(async (id: string) => {
      return relationStore.get(id) || []
    }),
    
    deleteRelation: vi.fn(async (from: string, to: string, type: string) => {
      const relations = relationStore.get(from)
      if (!relations) return false
      
      const index = relations.findIndex(
        r => r.to === to && r.type === type
      )
      if (index === -1) return false
      
      relations.splice(index, 1)
      return true
    }),
    
    // Batch operations
    batchStore: vi.fn(async (items: Array<{ id: string; vector: number[]; metadata?: any }>) => {
      const results: boolean[] = []
      for (const item of items) {
        store.set(item.id, item)
        results.push(true)
      }
      return results
    }),
    
    batchGet: vi.fn(async (ids: string[]) => {
      return ids.map(id => {
        const item = store.get(id)
        return item ? item.vector : null
      })
    }),
    
    batchDelete: vi.fn(async (ids: string[]) => {
      return ids.map(id => store.delete(id))
    }),
    
    // Query operations
    getAllIds: vi.fn(async () => {
      return Array.from(store.keys())
    }),
    
    getCount: vi.fn(async () => {
      return store.size
    }),
    
    clear: vi.fn(async () => {
      store.clear()
      relationStore.clear()
    }),
    
    // Utility for tests
    _getStore: () => store,
    _getRelationStore: () => relationStore,
  } as any
}

/**
 * Create a mock embedding function
 */
export function createMockEmbeddingFunction(dimension = 1536) {
  return vi.fn(async (text: string) => {
    // Generate deterministic embedding based on text
    const hash = text.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)
    const vector = new Array(dimension)
    
    for (let i = 0; i < dimension; i++) {
      vector[i] = Math.sin((hash + i) * 0.1) * 0.5
    }
    
    // Normalize
    const magnitude = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0))
    return vector.map(val => val / magnitude)
  })
}

/**
 * Create a mock distance function
 */
export function createMockDistanceFunction() {
  return vi.fn((a: number[], b: number[]) => {
    // Simple cosine distance
    let dotProduct = 0
    let magnitudeA = 0
    let magnitudeB = 0
    
    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i]
      magnitudeA += a[i] * a[i]
      magnitudeB += b[i] * b[i]
    }
    
    const similarity = dotProduct / (Math.sqrt(magnitudeA) * Math.sqrt(magnitudeB))
    return 1 - similarity // Convert similarity to distance
  })
}

/**
 * Create a mock augmentation
 */
export function createMockAugmentation(name = 'test-augmentation') {
  return {
    name,
    priority: 100,
    enabled: true,
    
    beforeAdd: vi.fn(async (data: any) => data),
    afterAdd: vi.fn(async (entity: Entity) => entity),
    
    beforeUpdate: vi.fn(async (data: any) => data),
    afterUpdate: vi.fn(async (entity: Entity) => entity),
    
    beforeDelete: vi.fn(async (id: string) => id),
    afterDelete: vi.fn(async (id: string) => id),
    
    beforeRelate: vi.fn(async (relation: any) => relation),
    afterRelate: vi.fn(async (relation: Relation) => relation),
    
    beforeSearch: vi.fn(async (query: any) => query),
    afterSearch: vi.fn(async (results: any[]) => results),
  }
}

/**
 * Create a mock cache
 */
export function createMockCache<T = any>() {
  const cache = new Map<string, T>()
  
  return {
    get: vi.fn((key: string) => cache.get(key)),
    set: vi.fn((key: string, value: T) => {
      cache.set(key, value)
      return true
    }),
    has: vi.fn((key: string) => cache.has(key)),
    delete: vi.fn((key: string) => cache.delete(key)),
    clear: vi.fn(() => cache.clear()),
    size: vi.fn(() => cache.size),
    
    // Utility for tests
    _getCache: () => cache,
  }
}

/**
 * Create a mock event emitter
 */
export function createMockEventEmitter() {
  const listeners = new Map<string, Function[]>()
  
  return {
    on: vi.fn((event: string, handler: Function) => {
      if (!listeners.has(event)) {
        listeners.set(event, [])
      }
      listeners.get(event)!.push(handler)
    }),
    
    off: vi.fn((event: string, handler: Function) => {
      const handlers = listeners.get(event)
      if (handlers) {
        const index = handlers.indexOf(handler)
        if (index > -1) {
          handlers.splice(index, 1)
        }
      }
    }),
    
    emit: vi.fn((event: string, ...args: any[]) => {
      const handlers = listeners.get(event)
      if (handlers) {
        handlers.forEach(handler => handler(...args))
      }
    }),
    
    once: vi.fn((event: string, handler: Function) => {
      const wrappedHandler = (...args: any[]) => {
        handler(...args)
        listeners.get(event)?.splice(listeners.get(event)!.indexOf(wrappedHandler), 1)
      }
      if (!listeners.has(event)) {
        listeners.set(event, [])
      }
      listeners.get(event)!.push(wrappedHandler)
    }),
    
    removeAllListeners: vi.fn((event?: string) => {
      if (event) {
        listeners.delete(event)
      } else {
        listeners.clear()
      }
    }),
    
    // Utility for tests
    _getListeners: () => listeners,
  }
}

/**
 * Create a mock logger
 */
export function createMockLogger() {
  return {
    debug: vi.fn((...args: any[]) => console.debug(...args)),
    info: vi.fn((...args: any[]) => console.info(...args)),
    warn: vi.fn((...args: any[]) => console.warn(...args)),
    error: vi.fn((...args: any[]) => console.error(...args)),
    log: vi.fn((...args: any[]) => console.log(...args)),
  }
}

/**
 * Create a mock timer for controlling time in tests
 */
export function createMockTimer() {
  let currentTime = Date.now()
  
  return {
    now: vi.fn(() => currentTime),
    advance: vi.fn((ms: number) => {
      currentTime += ms
    }),
    reset: vi.fn(() => {
      currentTime = Date.now()
    }),
    setTime: vi.fn((time: number) => {
      currentTime = time
    }),
  }
}

/**
 * Create a mock fetch function
 */
export function createMockFetch() {
  return vi.fn(async (url: string, options?: any) => {
    return {
      ok: true,
      status: 200,
      statusText: 'OK',
      json: async () => ({ success: true, url, options }),
      text: async () => 'Mock response',
      blob: async () => new Blob(['Mock blob']),
      headers: new Headers({
        'content-type': 'application/json',
      }),
    }
  })
}

/**
 * Wait for all pending promises to resolve
 */
export async function flushPromises() {
  await new Promise(resolve => setImmediate(resolve))
}

/**
 * Wait for a condition to be true
 */
export async function waitFor(
  condition: () => boolean | Promise<boolean>,
  timeout = 5000,
  interval = 100
): Promise<void> {
  const start = Date.now()
  
  while (Date.now() - start < timeout) {
    if (await condition()) {
      return
    }
    await new Promise(resolve => setTimeout(resolve, interval))
  }
  
  throw new Error(`Timeout waiting for condition after ${timeout}ms`)
}

// Export as namespace for convenience
export const TestMocks = {
  createMockStorageAdapter,
  createMockEmbeddingFunction,
  createMockDistanceFunction,
  createMockAugmentation,
  createMockCache,
  createMockEventEmitter,
  createMockLogger,
  createMockTimer,
  createMockFetch,
  flushPromises,
  waitFor,
}

export default TestMocks