/**
 * Unit Test Setup - Mock ALL AI functionality
 * 
 * This ensures unit tests are fast, reliable, and memory-safe
 * while still testing all business logic thoroughly
 */

// Mock the embedding function globally for all unit tests
const mockEmbedding = async (data: string | string[]) => {
  // Create deterministic embeddings based on content for consistent testing
  const texts = Array.isArray(data) ? data : [data]
  
  const embeddings = texts.map(text => {
    const str = typeof text === 'string' ? text : JSON.stringify(text)
    const vector = new Array(384).fill(0)
    
    // Create semi-realistic embeddings based on text content
    for (let i = 0; i < Math.min(str.length, 384); i++) {
      vector[i] = (str.charCodeAt(i % str.length) % 256) / 256
    }
    
    // Add position-based variation
    for (let i = 0; i < 384; i++) {
      vector[i] += Math.sin(i * 0.1 + str.length) * 0.1
    }
    
    return vector
  })
  
  // Return single embedding for single input, array for multiple inputs
  return Array.isArray(data) ? embeddings : embeddings[0]
}

// Set up global mocks before any tests run
beforeAll(() => {
  console.log('🧪 Unit Test Environment: Mocking AI functions for fast, reliable tests')
  
  // Mock environment to prevent real model loading
  process.env.BRAINY_UNIT_TEST = 'true'
  process.env.BRAINY_ALLOW_REMOTE_MODELS = 'false'
  
  // Set up global test environment marker
  ;(globalThis as any).__BRAINY_UNIT_TEST__ = true
})

afterAll(() => {
  // Clean up
  delete process.env.BRAINY_UNIT_TEST
  delete (globalThis as any).__BRAINY_UNIT_TEST__
})

export { mockEmbedding }