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
    // v6.0.0: Increased timeouts for GraphAdjacencyIndex initialization with forks
    // v8.0.4: hookTimeout 30s→60s — beforeEach init() exceeds 30s under parallel load
    testTimeout: 30000,       // 30 seconds
    hookTimeout: 60000,       // 60 seconds (beforeEach with MetadataIndexManager init under load)
    teardownTimeout: 60000,   // 60 seconds (vitest worker RPC under parallel load)
    
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
      'tests/unit/graph/graphIndex-pagination.test.ts', // v6.0.0: TODO fix infinite loop
      'node_modules/**'
    ],
    
    // Use 'forks' for process isolation — 'threads' causes vitest internal
    // "Timeout calling onTaskUpdate" RPC errors under heavy parallel load
    pool: 'forks',
    poolOptions: {
      forks: {
        maxForks: 8,
        minForks: 2,
      }
    },
    
    reporters: ['verbose'],
    
    // Coverage for unit tests — disabled by default to avoid vitest worker
    // RPC timeouts during v8 coverage collection (causes false exit code 1).
    // Run with --coverage flag when needed: npx vitest run --coverage
    coverage: {
      enabled: false,
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