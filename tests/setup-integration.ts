/**
 * Integration Test Setup - REAL AI functionality
 * 
 * This setup enables real AI models for integration testing
 * Requires high memory environment (16GB+ RAM)
 */

beforeAll(async () => {
  console.log('🤖 Integration Test Environment: Using REAL AI models')
  console.log('⚠️  Requires 16GB+ RAM - this is normal for AI testing')
  
  // Set up environment for real AI testing
  process.env.BRAINY_INTEGRATION_TEST = 'true'
  process.env.BRAINY_MODELS_PATH = './models'
  process.env.BRAINY_ALLOW_REMOTE_MODELS = 'false'  // Use local models only
  
  // Set memory limits and optimizations
  process.env.ORT_DISABLE_MEMORY_ARENA = '1'
  process.env.ORT_DISABLE_MEMORY_PATTERN = '1'
  process.env.ORT_INTRA_OP_NUM_THREADS = '2'
  process.env.ORT_INTER_OP_NUM_THREADS = '2'
  
  // Mark as integration test environment
  ;(globalThis as any).__BRAINY_INTEGRATION_TEST__ = true
  
  // Check memory availability
  const availableMemoryGB = process.env.NODE_OPTIONS?.includes('max-old-space-size')
    ? parseInt(process.env.NODE_OPTIONS.match(/--max-old-space-size=(\d+)/)?.[1] || '0') / 1024
    : 4
  
  console.log(`📊 Node.js heap limit: ${availableMemoryGB.toFixed(1)}GB`)
  
  if (availableMemoryGB < 8) {
    console.warn('⚠️  WARNING: Less than 8GB allocated for integration tests')
    console.warn('   Recommended: NODE_OPTIONS="--max-old-space-size=16384"')
    console.warn('   Tests may fail due to insufficient memory')
  }
}, 60000) // 1 minute timeout for setup

afterAll(async () => {
  // Clean up
  delete process.env.BRAINY_INTEGRATION_TEST
  delete (globalThis as any).__BRAINY_INTEGRATION_TEST__
  
  // Force garbage collection if available
  if (global.gc) {
    global.gc()
  }
}, 30000) // 30 second timeout for cleanup

// Utility function to skip tests if not enough memory
export function requiresMemory(minGB: number) {
  const availableMemoryGB = process.env.NODE_OPTIONS?.includes('max-old-space-size')
    ? parseInt(process.env.NODE_OPTIONS.match(/--max-old-space-size=(\d+)/)?.[1] || '0') / 1024
    : 4
  
  if (availableMemoryGB < minGB) {
    throw new Error(`Test requires ${minGB}GB memory, only ${availableMemoryGB.toFixed(1)}GB allocated`)
  }
}