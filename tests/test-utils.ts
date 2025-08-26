/**
 * Shared test utilities for all Brainy tests
 */

import { Vector } from '../src/coreTypes.js'

/**
 * Mock embedding function for tests
 * Returns a deterministic vector based on input string
 */
export function createMockEmbeddingFunction(dimensions: number = 384) {
  return async (input: string | any): Promise<Vector> => {
    // Create a deterministic vector based on input
    const vector = new Array(dimensions).fill(0)
    
    if (typeof input === 'string') {
      // Use string hash to generate deterministic values
      let hash = 0
      for (let i = 0; i < input.length; i++) {
        hash = ((hash << 5) - hash) + input.charCodeAt(i)
        hash = hash & hash // Convert to 32bit integer
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

/**
 * Create a test BrainyData configuration with mocked embedding
 */
export function createTestConfig(additionalConfig: any = {}) {
  return {
    embeddingFunction: createMockEmbeddingFunction(),
    ...additionalConfig
  }
}

/**
 * Wait for async operations to complete
 */
export async function waitForAsync(ms: number = 10): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Mock S3 response body helper
 */
export function createMockS3Body(data: any): any {
  const jsonString = JSON.stringify(data)
  return {
    transformToString: async () => jsonString,
    transformToByteArray: async () => new TextEncoder().encode(jsonString),
    transformToWebStream: () => new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(jsonString))
        controller.close()
      }
    })
  }
}