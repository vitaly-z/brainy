import { defineConfig } from 'vitest/config'

/**
 * Vitest Configuration - Optimized for Memory-Intensive Tests
 * 
 * Handles ONNX transformer model testing (4-8GB memory requirement)
 * Based on 2024-2025 best practices
 */
export default defineConfig({
  test: {
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    environment: 'node',
    
    // MEMORY OPTIMIZATION: Use forks for better memory isolation
    pool: 'forks',
    poolOptions: {
      forks: {
        maxForks: 1,      // One test file at a time
        minForks: 1,
        singleFork: true, // Sequential execution
        isolate: true     // Isolate test files
      }
    },
    
    // TIMEOUTS: Extended for ONNX model loading
    testTimeout: 120000,  // 2 minutes per test
    hookTimeout: 60000,   // 1 minute for hooks
    teardownTimeout: 10000,
    
    // PARALLELISM: Disabled to prevent memory exhaustion
    maxConcurrency: 1,
    fileParallelism: false,
    
    // INCLUDE/EXCLUDE
    include: ['tests/**/*.{test,spec}.{js,ts}'],
    exclude: [
      'node_modules/**',
      'dist/**',
      'scripts/**',
      '**/*.browser.test.ts'
    ],
    
    // REPORTERS: Dot for CI, verbose for local
    reporters: process.env.CI ? ['dot'] : ['default'],
    
    // RETRY: Once in CI for flaky tests
    retry: process.env.CI ? 1 : 0,
    
    // SHARDING: Support test splitting
    // Use: VITEST_SHARD=1/4 npm test
    shard: process.env.VITEST_SHARD
  }
})