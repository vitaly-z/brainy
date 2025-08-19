/**
 * Global test setup - runs before all tests
 * Configures mock embeddings to prevent model loading timeouts
 */

import { vi } from 'vitest'

// Mock the embedding module globally
vi.mock('../src/utils/embedding.js', () => {
  // Create a deterministic mock embedding function
  const createMockEmbedding = (dimensions: number = 384) => {
    return async (input: string | any): Promise<number[]> => {
      const vector = new Array(dimensions).fill(0)
      
      if (typeof input === 'string') {
        // Use string hash to generate deterministic values
        let hash = 0
        for (let i = 0; i < input.length; i++) {
          hash = ((hash << 5) - hash) + input.charCodeAt(i)
          hash = hash & hash
        }
        
        // Fill vector with deterministic values
        for (let i = 0; i < dimensions; i++) {
          vector[i] = Math.sin(hash * (i + 1)) * 0.5 + 0.5
        }
      } else if (Array.isArray(input) && input.every(x => typeof x === 'number')) {
        // Already a vector, just return it (padded/truncated to dimensions)
        return input.slice(0, dimensions).concat(new Array(Math.max(0, dimensions - input.length)).fill(0))
      }
      
      return vector
    }
  }

  return {
    defaultEmbeddingFunction: createMockEmbedding(),
    createEmbeddingFunction: () => createMockEmbedding(),
    TransformerEmbedding: class {
      async init() { return this }
      embed = createMockEmbedding()
    },
    UniversalSentenceEncoder: class {
      async init() { return this }
      embed = createMockEmbedding()
    },
    batchEmbed: async (embedFn: any, inputs: string[]) => {
      const mockEmbed = createMockEmbedding()
      return Promise.all(inputs.map(input => mockEmbed(input)))
    },
    embeddingFunctions: new Map()
  }
})

// Set test environment flag
globalThis.__BRAINY_TEST_ENV__ = true

console.log('✅ Test setup complete - using mock embeddings')