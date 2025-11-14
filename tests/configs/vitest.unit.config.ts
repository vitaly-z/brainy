import { defineConfig } from 'vitest/config'

/**
 * Unit Test Configuration - NO REAL AI MODELS
 * 
 * Based on industry practices from HuggingFace, sentence-transformers, etc.
 * Unit tests use mocks to avoid memory issues entirely.
 */
export default defineConfig({
  test: {
    globals: true,
    setupFiles: ['./tests/setup-unit.ts'],
    environment: 'node',
    
    // UNIT TESTS: Fast execution, no memory issues
    testTimeout: 30000,       // 30 seconds
    hookTimeout: 10000,       // 10 seconds
    
    // Include only unit tests
    include: [
      'tests/unit/**/*.test.ts',
      'tests/**/*.unit.test.ts'
    ],
    
    // Exclude integration tests
    exclude: [
      'tests/integration/**',
      'tests/**/*.integration.test.ts',
      'tests/**/*.e2e.test.ts',
      'node_modules/**'
    ],
    
    // Parallel execution OK for unit tests (no native deps since v5.8.0)
    pool: 'threads',
    maxConcurrency: 4,
    fileParallelism: true,
    
    reporters: ['verbose'],
    
    // Coverage for unit tests
    coverage: {
      enabled: true,
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/**/*.ts'],
      exclude: [
        'src/**/*.test.ts',
        'src/embeddings/worker-*.ts',  // Skip worker files
        'dist/**'
      ]
    }
  }
})