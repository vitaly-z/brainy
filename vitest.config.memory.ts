import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./tests/setup.ts'],
    testTimeout: 120000, // 2 minutes per test
    hookTimeout: 60000,  // 1 minute for hooks
    
    // Run tests sequentially to avoid memory exhaustion
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true,  // Use single process
        isolate: false     // Don't isolate tests
      }
    },
    
    // Disable parallel execution
    maxConcurrency: 1,
    minWorkers: 1,
    maxWorkers: 1,
    
    // Memory management
    teardownTimeout: 10000,
    
    // Coverage disabled for memory tests
    coverage: {
      enabled: false
    }
  },
  
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  },
  
  // ESBuild options
  esbuild: {
    target: 'node18'
  }
})