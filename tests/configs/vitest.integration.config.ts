import { defineConfig } from 'vitest/config'

/**
 * Integration Test Configuration - REAL AI MODELS
 * 
 * Based on industry practices: fewer tests, real models, high memory
 * Only run critical AI functionality to verify production readiness
 */
export default defineConfig({
  test: {
    globals: true,
    setupFiles: ['./tests/setup-integration.ts'],
    environment: 'node',
    
    // INTEGRATION TESTS: Real AI, need time and memory
    testTimeout: 300000,      // 5 minutes per test
    hookTimeout: 120000,      // 2 minutes for setup
    teardownTimeout: 30000,
    
    // Include only integration tests  
    include: [
      'tests/integration/**/*.test.ts',
      'tests/**/*.integration.test.ts'
    ],
    
    // CRITICAL: Sequential execution to prevent memory exhaustion
    pool: 'forks',
    poolOptions: {
      forks: {
        maxForks: 1,        // One test at a time
        minForks: 1,
        singleFork: true,   // Absolute isolation
        isolate: true
      }
    },
    
    // No parallelism
    maxConcurrency: 1,
    fileParallelism: false,
    
    // Minimal reporting to reduce memory
    reporters: process.env.CI ? ['dot'] : ['basic'],
    
    // No coverage (saves memory)
    coverage: {
      enabled: false
    },
    
    // Test sharding for CI
    shard: process.env.VITEST_SHARD,
    
    // Retry once for flaky AI tests
    retry: 1
  }
})