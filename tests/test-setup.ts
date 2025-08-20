/**
 * Test Setup Configuration
 * Ensures models are available for all tests
 */

import { beforeAll } from 'vitest'
import { existsSync } from 'fs'
import { join } from 'path'

beforeAll(() => {
  // Set model path to local models directory
  const modelsPath = join(process.cwd(), 'models')
  
  // Check if models exist
  if (existsSync(modelsPath)) {
    process.env.BRAINY_MODELS_PATH = modelsPath
    console.log('✅ Using local models for tests:', modelsPath)
  } else {
    console.warn('⚠️ Models directory not found, tests may download models')
  }
  
  // Disable remote model downloads in tests to avoid network dependencies
  process.env.BRAINY_ALLOW_REMOTE_MODELS = 'false'
  
  // Set test environment
  process.env.NODE_ENV = 'test'
  
  // Disable verbose logging in tests
  process.env.BRAINY_LOG_LEVEL = 'error'
})

// Export mock embedding function for tests that need it
export function createMockEmbedding(text: string, dimensions = 384): Float32Array {
  // Create deterministic embeddings based on text hash
  let hash = 0
  for (let i = 0; i < text.length; i++) {
    const char = text.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash // Convert to 32-bit integer
  }
  
  const embedding = new Float32Array(dimensions)
  for (let i = 0; i < dimensions; i++) {
    // Generate values between -1 and 1 based on hash
    embedding[i] = Math.sin(hash + i) * 0.5
  }
  
  return embedding
}