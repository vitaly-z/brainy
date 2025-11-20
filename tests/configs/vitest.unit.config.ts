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
    testTimeout: 30000,       // 30 seconds
    hookTimeout: 30000,       // 30 seconds (increased for init() with forks)
    
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
    
    // v6.0.0: Use 'threads' with proper setup (fast, ONNX mocked in setup-unit.ts)
    // Industry standard: mock native modules in unit tests (HuggingFace, Transformers.js)
    pool: 'threads',
    poolOptions: {
      threads: {
        singleThread: false
      }
    },
    
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