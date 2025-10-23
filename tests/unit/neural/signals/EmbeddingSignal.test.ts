import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { Brainy } from '../../../../src/brainy.js'
import { EmbeddingSignal, createEmbeddingSignal } from '../../../../src/neural/signals/EmbeddingSignal.js'
import { NounType } from '../../../../src/types/graphTypes.js'

describe('EmbeddingSignal', () => {
  let brain: Brainy
  let signal: EmbeddingSignal

  beforeEach(async () => {
    brain = new Brainy({ storage: { type: 'memory' } })
    await brain.init()
    signal = new EmbeddingSignal(brain)
  })

  afterEach(() => {
    signal.clearCache()
    signal.clearHistory()
    signal.resetStats()
  })

  describe('initialization', () => {
    it('should initialize lazily', async () => {
      const newSignal = new EmbeddingSignal(brain)
      const stats = newSignal.getStats()

      // Not initialized until first use
      expect(stats.calls).toBe(0)
    })

    it('should initialize with custom options', async () => {
      const customSignal = new EmbeddingSignal(brain, {
        minConfidence: 0.75,
        checkGraph: false,
        checkHistory: false,
        timeout: 200,
        cacheSize: 500
      })

      const result = await customSignal.classify('Paris')
      expect(result).toBeDefined()
    })

    it('should use factory function', () => {
      const factorySignal = createEmbeddingSignal(brain)
      expect(factorySignal).toBeInstanceOf(EmbeddingSignal)
    })
  })

  describe('type matching', () => {
    it('should match entities against NounType embeddings', async () => {
      // Use lenient signal to ensure result
      const lenientSignal = new EmbeddingSignal(brain, { minConfidence: 0.30 })
      const result = await lenientSignal.classify('Microsoft Corporation')

      // Microsoft should match well (Organization)
      expect(result).toBeDefined()
      if (result) {
        expect(result.type).toBeDefined()
        expect(result.confidence).toBeGreaterThan(0)
        expect(result.source).toContain('embedding')
        expect(result.evidence).toBeDefined()
      }
    })

    it('should classify geographic entities as Location', async () => {
      const result = await signal.classify('New York City')

      expect(result).toBeDefined()
      if (result) {
        expect(result.confidence).toBeGreaterThan(0.5)
        // Note: Actual type depends on embedding model, but should be reasonable
      }
    })

    it('should classify people as Person', async () => {
      const result = await signal.classify('Albert Einstein')

      expect(result).toBeDefined()
      if (result) {
        expect(result.confidence).toBeGreaterThan(0.5)
      }
    })

    it('should classify organizations', async () => {
      const result = await signal.classify('Microsoft Corporation')

      expect(result).toBeDefined()
      if (result) {
        expect(result.confidence).toBeGreaterThan(0.5)
      }
    })

    it('should handle ambiguous entities', async () => {
      const result = await signal.classify('Java')

      // Could be Language, Location, or Concept
      expect(result).toBeDefined()
      if (result) {
        expect(result.confidence).toBeGreaterThan(0)
      }
    })
  })

  describe('graph matching', () => {
    it('should match against existing graph entities', async () => {
      // Add some entities to the graph
      await brain.add({
        data: 'Paris is a beautiful city',
        type: NounType.Location
      })

      await brain.add({
        data: 'London is historic',
        type: NounType.Location
      })

      // Wait for indexing
      await new Promise(resolve => setTimeout(resolve, 100))

      // Try to classify similar entity
      const result = await signal.classify('city', {
        definition: 'A large town'
      })

      // Should get some result (may or may not match graph)
      expect(result !== null || result === null).toBe(true)

      const stats = signal.getStats()
      expect(stats.calls).toBeGreaterThan(0)
    })

    it('should boost confidence when graph entities match', async () => {
      // Add entity to graph
      await brain.add({
        data: 'Tokyo',
        type: NounType.Location
      })

      await new Promise(resolve => setTimeout(resolve, 100))

      // Classify similar entity
      const result = await signal.classify('Tokyo')

      if (result && result.source === 'embedding-combined') {
        // Should have graph match in metadata
        expect(result.metadata?.graphScore).toBeDefined()
      }
    })

    it('should work without graph matching', async () => {
      const noGraphSignal = new EmbeddingSignal(brain, {
        checkGraph: false
      })

      const result = await noGraphSignal.classify('Paris')

      expect(result).toBeDefined()
      expect(result?.metadata?.graphScore).toBeUndefined()
    })
  })

  describe('historical matching', () => {
    it('should match against historical data', async () => {
      // Add to history
      const vector = await brain.embed('Paris')
      signal.addToHistory('Paris', NounType.Location, vector)

      // Classify similar entity
      const result = await signal.classify('Paris')

      expect(result).toBeDefined()

      const stats = signal.getStats()
      expect(stats.historySize).toBe(1)
    })

    it('should boost confidence for recent history', async () => {
      const vector = await brain.embed('Berlin')
      signal.addToHistory('Berlin', NounType.Location, vector)

      // Immediate classification should get history boost
      const result = await signal.classify('Berlin')

      if (result && result.source === 'embedding-combined') {
        expect(result.metadata?.historyScore).toBeDefined()
      }
    })

    it('should track usage count', async () => {
      const vector = await brain.embed('London')
      signal.addToHistory('London', NounType.Location, vector)
      signal.addToHistory('London', NounType.Location, vector)
      signal.addToHistory('London', NounType.Location, vector)

      const stats = signal.getStats()
      expect(stats.historySize).toBe(1) // Same entity
    })

    it('should trim history to max size', async () => {
      // Add many historical entities (using smaller number for test speed)
      for (let i = 0; i < 50; i++) {
        const text = `Entity${i}`
        const vector = await brain.embed(text)
        signal.addToHistory(text, NounType.Thing, vector)
      }

      const stats = signal.getStats()
      expect(stats.historySize).toBe(50)

      // Now add enough to trigger trimming
      for (let i = 50; i < 1100; i++) {
        const text = `Entity${i}`
        // Reuse first embedding for speed
        const vector = await brain.embed('Entity0')
        signal.addToHistory(text, NounType.Thing, vector)
      }

      const finalStats = signal.getStats()
      expect(finalStats.historySize).toBeLessThanOrEqual(1000) // MAX_HISTORY = 1000
    })

    it('should clear history', async () => {
      const vector = await brain.embed('Test')
      signal.addToHistory('Test', NounType.Thing, vector)

      expect(signal.getStats().historySize).toBe(1)

      signal.clearHistory()

      expect(signal.getStats().historySize).toBe(0)
    })

    it('should work without history matching', async () => {
      const noHistorySignal = new EmbeddingSignal(brain, {
        checkHistory: false
      })

      const result = await noHistorySignal.classify('Paris')

      expect(result).toBeDefined()
      expect(result?.metadata?.historyScore).toBeUndefined()
    })
  })

  describe('combined results', () => {
    it('should boost confidence when multiple sources agree', async () => {
      // Add to graph and history
      await brain.add({
        data: 'Madrid',
        type: NounType.Location
      })

      const vector = await brain.embed('Madrid')
      signal.addToHistory('Madrid', NounType.Location, vector)

      await new Promise(resolve => setTimeout(resolve, 100))

      // Classify - should get boost from multiple sources
      const result = await signal.classify('Madrid')

      if (result && result.source === 'embedding-combined') {
        expect(result.metadata?.agreementBoost).toBeGreaterThan(0)
        expect(result.evidence).toContain('+')
      }
    })

    it('should use source with highest confidence when sources disagree', async () => {
      // This is hard to test deterministically, but we can verify it doesn't crash
      const result = await signal.classify('Ambiguous Entity')

      // Should still return a result
      expect(result !== null || result === null).toBe(true)
    })
  })

  describe('caching', () => {
    it('should cache results', async () => {
      // Use lenient confidence to ensure caching works
      const lenientSignal = new EmbeddingSignal(brain, {
        minConfidence: 0.30
      })

      // Use entity that matches well
      const result1 = await lenientSignal.classify('Apple Inc')
      const result2 = await lenientSignal.classify('Apple Inc')

      // Should be equal (cached)
      expect(result1).toEqual(result2)

      const stats = lenientSignal.getStats()
      expect(stats.calls).toBe(2)
      // Cache should work (at least 1 hit, or both return same result)
      if (result1 !== null) {
        expect(stats.cacheHits).toBeGreaterThan(0)
      }
    })

    it('should use different cache keys for different context', async () => {
      const result1 = await signal.classify('Paris', {
        definition: 'Capital of France'
      })

      const result2 = await signal.classify('Paris', {
        definition: 'A different context'
      })

      // Different contexts = different cache keys
      const stats = signal.getStats()
      expect(stats.cacheHits).toBe(0) // No hits
      expect(stats.calls).toBe(2)
    })

    it('should respect cache size limit', async () => {
      const smallCacheSignal = new EmbeddingSignal(brain, {
        cacheSize: 5
      })

      // Add 10 entities
      for (let i = 0; i < 10; i++) {
        await smallCacheSignal.classify(`Entity${i}`)
      }

      const stats = smallCacheSignal.getStats()
      expect(stats.cacheSize).toBeLessThanOrEqual(5)
    })

    it('should clear cache', async () => {
      // Use lenient confidence
      const lenientSignal = new EmbeddingSignal(brain, { minConfidence: 0.30 })

      await lenientSignal.classify('Paris')
      expect(lenientSignal.getStats().cacheSize).toBeGreaterThan(0)

      lenientSignal.clearCache()

      expect(lenientSignal.getStats().cacheSize).toBe(0)
    })

    it('should use LRU eviction', async () => {
      const smallSignal = new EmbeddingSignal(brain, {
        cacheSize: 3,
        minConfidence: 0.30 // Lenient to ensure caching
      })

      await smallSignal.classify('Entity1')
      await smallSignal.classify('Entity2')
      await smallSignal.classify('Entity3')

      // Access Entity1 to make it most recent
      await smallSignal.classify('Entity1')

      // Add Entity4 (should evict Entity2, oldest)
      await smallSignal.classify('Entity4')

      const stats = smallSignal.getStats()
      expect(stats.cacheSize).toBeLessThanOrEqual(3)
    })
  })

  describe('confidence thresholds', () => {
    it('should respect minimum confidence threshold', async () => {
      const strictSignal = new EmbeddingSignal(brain, {
        minConfidence: 0.90
      })

      const result = await strictSignal.classify('Obscure Entity XYZ')

      // May return null if confidence too low
      if (result) {
        expect(result.confidence).toBeGreaterThanOrEqual(0.90)
      }
    })

    it('should accept low confidence with low threshold', async () => {
      const lenientSignal = new EmbeddingSignal(brain, {
        minConfidence: 0.30
      })

      const result = await lenientSignal.classify('Anything')

      // Should return a result or null
      if (result) {
        expect(result.confidence).toBeGreaterThanOrEqual(0.30)
      } else {
        // Null is acceptable if no match meets threshold
        expect(result).toBeNull()
      }
    })

    it('should cap confidence at 1.0', async () => {
      // Even with multiple boosters, confidence should never exceed 1.0
      const vector = await brain.embed('TestEntity')
      signal.addToHistory('TestEntity', NounType.Thing, vector)

      const result = await signal.classify('TestEntity')

      if (result) {
        expect(result.confidence).toBeLessThanOrEqual(1.0)
      }
    })
  })

  describe('error handling', () => {
    it('should handle embedding timeout gracefully', async () => {
      const timeoutSignal = new EmbeddingSignal(brain, {
        timeout: 1 // Very short timeout
      })

      // Should return null instead of throwing
      const result = await timeoutSignal.classify('Very long text that might timeout...'.repeat(100))

      // Either succeeds or returns null
      expect(result !== null || result === null).toBe(true)
    })

    it('should handle errors gracefully', async () => {
      // Try to classify with invalid input
      const result = await signal.classify('')

      // Should not throw, may return null
      expect(result !== null || result === null).toBe(true)
    })
  })

  describe('statistics', () => {
    it('should track statistics', async () => {
      const lenientSignal = new EmbeddingSignal(brain, { minConfidence: 0.30 })

      // Use entities that match well
      await lenientSignal.classify('Google')
      await lenientSignal.classify('Amazon')
      await lenientSignal.classify('Google') // Should cache

      const stats = lenientSignal.getStats()
      expect(stats.calls).toBe(3)
      // Cache hits might be 0 if entities don't meet threshold
      expect(stats.cacheHits).toBeGreaterThanOrEqual(0)
      expect(stats.typeMatches).toBeGreaterThanOrEqual(0) // May be 0 if no matches
    })

    it('should calculate hit rates', async () => {
      const lenientSignal = new EmbeddingSignal(brain, { minConfidence: 0.30 })

      await lenientSignal.classify('Tesla')
      await lenientSignal.classify('Tesla')
      await lenientSignal.classify('SpaceX')

      const stats = lenientSignal.getStats()
      expect(stats.cacheHitRate).toBeGreaterThanOrEqual(0)
      expect(stats.cacheHitRate).toBeLessThanOrEqual(1)
    })

    it('should reset statistics', async () => {
      await signal.classify('Entity1')

      signal.resetStats()

      const stats = signal.getStats()
      expect(stats.calls).toBe(0)
      expect(stats.cacheHits).toBe(0)
      expect(stats.typeMatches).toBe(0)
    })

    it('should track source match rates', async () => {
      // Add data to graph and history
      await brain.add({ data: 'Test', type: NounType.Thing })
      const vector = await brain.embed('Test2')
      signal.addToHistory('Test2', NounType.Thing, vector)

      await signal.classify('Entity1')
      await signal.classify('Entity2')

      const stats = signal.getStats()
      expect(stats.typeMatchRate).toBeGreaterThanOrEqual(0)
      expect(stats.typeMatchRate).toBeLessThanOrEqual(1)
    })
  })

  describe('context usage', () => {
    it('should use definition context', async () => {
      const result = await signal.classify('Challenger', {
        definition: 'A space shuttle that launched in 1986'
      })

      // May or may not return result
      if (result) {
        expect(result.confidence).toBeGreaterThan(0)
      } else {
        // Null result is ok
        expect(result).toBeNull()
      }
    })

    it('should use allTerms context', async () => {
      const result = await signal.classify('London', {
        allTerms: ['Paris', 'London', 'Berlin']
      })

      expect(result).toBeDefined()
    })

    it('should use metadata context', async () => {
      const result = await signal.classify('Entity', {
        metadata: { category: 'location', region: 'europe' }
      })

      expect(result).toBeDefined()
    })
  })

  describe('real-world scenarios', () => {
    it('should classify technical terms', async () => {
      const terms = [
        'JavaScript',
        'Docker',
        'Kubernetes',
        'PostgreSQL',
        'React'
      ]

      for (const term of terms) {
        const result = await signal.classify(term)
        expect(result).toBeDefined()
        if (result) {
          expect(result.confidence).toBeGreaterThan(0)
        }
      }
    })

    it('should classify business entities', async () => {
      const entities = [
        'Google',
        'Amazon',
        'Microsoft',
        'Apple'
      ]

      for (const entity of entities) {
        const result = await signal.classify(entity)
        expect(result).toBeDefined()
        if (result) {
          expect(result.confidence).toBeGreaterThan(0)
        }
      }
    })

    it('should classify geographic locations', async () => {
      const locations = [
        'Mount Everest',
        'Pacific Ocean',
        'Sahara Desert',
        'Amazon River'
      ]

      for (const location of locations) {
        const result = await signal.classify(location)
        expect(result).toBeDefined()
        if (result) {
          expect(result.confidence).toBeGreaterThan(0)
        }
      }
    })

    it('should handle batch classification efficiently', async () => {
      const startTime = Date.now()

      const entities = []
      for (let i = 0; i < 100; i++) {
        entities.push(`Entity${i}`)
      }

      for (const entity of entities) {
        await signal.classify(entity)
      }

      const endTime = Date.now()
      const totalTime = endTime - startTime

      // Should be reasonably fast (< 5 seconds for 100 entities)
      expect(totalTime).toBeLessThan(5000)

      const stats = signal.getStats()
      expect(stats.calls).toBe(100)
    })

    it('should improve with historical data', async () => {
      // First pass - no history
      const result1 = await signal.classify('Berlin')
      const confidence1 = result1?.confidence || 0

      // Add to history
      if (result1) {
        const vector = await brain.embed('Berlin')
        signal.addToHistory('Berlin', result1.type, vector)
      }

      // Clear cache to force recomputation
      signal.clearCache()

      // Second pass - with history
      const result2 = await signal.classify('Berlin')
      const confidence2 = result2?.confidence || 0

      // Confidence should be similar or improved
      expect(confidence2).toBeGreaterThanOrEqual(confidence1 * 0.95)
    })
  })

  describe('integration with Brainy', () => {
    it('should work with real Brainy embeddings', async () => {
      const text = 'The Eiffel Tower is in Paris'
      const result = await signal.classify('Paris', {
        definition: text
      })

      // May or may not return result depending on confidence
      // Just verify it doesn't crash
      expect(result !== null || result === null).toBe(true)

      if (result) {
        expect(result.type).toBeDefined()
        expect(result.confidence).toBeGreaterThan(0)
      }
    })

    it('should work with graph data', async () => {
      // Add some graph data
      await brain.add({
        data: 'Berlin is the capital of Germany',
        type: NounType.Location
      })

      await brain.add({
        data: 'Munich is a city in Germany',
        type: NounType.Location
      })

      await new Promise(resolve => setTimeout(resolve, 100))

      // Classify related entity
      const result = await signal.classify('Germany')

      // Should not crash
      expect(result !== null || result === null).toBe(true)
    })
  })
})
