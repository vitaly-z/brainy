/**
 * WASM Embedding Integration Test
 *
 * Tests the Candle WASM embedding engine with real model inference.
 * NO mocks - this loads the real embedded model and generates real embeddings.
 */

import { describe, it, expect, beforeAll } from 'vitest'
import { WASMEmbeddingEngine } from '../../src/embeddings/wasm/WASMEmbeddingEngine.js'
import { embeddingManager } from '../../src/embeddings/EmbeddingManager.js'

// Ensure we're NOT in mock mode for these tests
beforeAll(() => {
  delete process.env.BRAINY_UNIT_TEST
  ;(globalThis as any).__BRAINY_UNIT_TEST__ = false
})

describe('WASM Embedding Engine - Real Embeddings', () => {
  it('should initialize the WASM engine', async () => {
    const engine = WASMEmbeddingEngine.getInstance()
    await engine.initialize()
    expect(engine.isInitialized()).toBe(true)
  })

  it('should generate 384-dimensional embeddings', async () => {
    const engine = WASMEmbeddingEngine.getInstance()
    const embedding = await engine.embed('Hello world')

    expect(embedding).toBeInstanceOf(Array)
    expect(embedding.length).toBe(384)
    expect(typeof embedding[0]).toBe('number')
  })

  it('should produce consistent embeddings for same input', async () => {
    const engine = WASMEmbeddingEngine.getInstance()

    const emb1 = await engine.embed('test consistency')
    const emb2 = await engine.embed('test consistency')

    expect(emb1).toEqual(emb2)
  })

  it('should produce normalized embeddings (unit length)', async () => {
    const engine = WASMEmbeddingEngine.getInstance()
    const embedding = await engine.embed('normalize test')

    // Calculate L2 norm
    const norm = Math.sqrt(embedding.reduce((sum, v) => sum + v * v, 0))

    // Should be approximately 1.0 (normalized)
    expect(norm).toBeCloseTo(1.0, 4)
  })

  it('should produce semantically meaningful embeddings', async () => {
    const engine = WASMEmbeddingEngine.getInstance()

    // Similar sentences
    const catEmb = await engine.embed('The cat sat on the mat')
    const felineEmb = await engine.embed('A feline rests on a rug')

    // Dissimilar sentence
    const stockEmb = await engine.embed('The stock market crashed today')

    // Cosine similarity function
    const cosineSim = (a: number[], b: number[]) => {
      let dot = 0, normA = 0, normB = 0
      for (let i = 0; i < a.length; i++) {
        dot += a[i] * b[i]
        normA += a[i] * a[i]
        normB += b[i] * b[i]
      }
      return dot / (Math.sqrt(normA) * Math.sqrt(normB))
    }

    const similarSim = cosineSim(catEmb, felineEmb)
    const dissimilarSim = cosineSim(catEmb, stockEmb)

    // Similar sentences should have higher similarity than dissimilar
    expect(similarSim).toBeGreaterThan(dissimilarSim)
    expect(similarSim).toBeGreaterThan(0.4) // Reasonably similar
    expect(dissimilarSim).toBeLessThan(0.3) // Not very similar
  })

  it('should handle empty string', async () => {
    const engine = WASMEmbeddingEngine.getInstance()
    const embedding = await engine.embed('')

    expect(embedding.length).toBe(384)
  })

  it('should handle long text', async () => {
    const engine = WASMEmbeddingEngine.getInstance()
    const longText = 'word '.repeat(1000)
    const embedding = await engine.embed(longText)

    expect(embedding.length).toBe(384)
  })

  it('should work through EmbeddingManager', async () => {
    await embeddingManager.init()

    const embedding = await embeddingManager.embed('test via manager')

    expect(embedding.length).toBe(384)
    expect(embeddingManager.isInitialized()).toBe(true)
  })

  it('should report correct stats', async () => {
    const engine = WASMEmbeddingEngine.getInstance()
    const stats = engine.getStats()

    expect(stats.initialized).toBe(true)
    expect(stats.modelName).toBe('all-MiniLM-L6-v2')
    expect(stats.embedCount).toBeGreaterThan(0)
  })
})

describe('WASM Embedding - Batch Operations', () => {
  it('should embed multiple texts', async () => {
    const engine = WASMEmbeddingEngine.getInstance()

    const texts = [
      'First document about cats',
      'Second document about dogs',
      'Third document about birds'
    ]

    const embeddings = await engine.embedBatch(texts)

    expect(embeddings.length).toBe(3)
    expect(embeddings[0].length).toBe(384)
    expect(embeddings[1].length).toBe(384)
    expect(embeddings[2].length).toBe(384)
  })

  it('should handle empty batch', async () => {
    const engine = WASMEmbeddingEngine.getInstance()
    const embeddings = await engine.embedBatch([])

    expect(embeddings).toEqual([])
  })
})
