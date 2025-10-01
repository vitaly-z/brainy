#!/usr/bin/env node

// Check ONNX memory settings
console.log('ONNX Memory Settings:')
console.log('=====================')
console.log('ORT_DISABLE_MEMORY_ARENA:', process.env.ORT_DISABLE_MEMORY_ARENA)
console.log('ORT_DISABLE_MEMORY_PATTERN:', process.env.ORT_DISABLE_MEMORY_PATTERN)
console.log('ORT_INTRA_OP_NUM_THREADS:', process.env.ORT_INTRA_OP_NUM_THREADS)
console.log('ORT_INTER_OP_NUM_THREADS:', process.env.ORT_INTER_OP_NUM_THREADS)

// Now test with minimal embedding
import { Brainy } from './dist/index.js'

async function testMinimalSearch() {
  try {
    console.log('\nInitializing Brainy...')
    const brain = new Brainy({ 
      storage: { forceMemoryStorage: true },
      verbose: false
    })
    await brain.init()
    
    console.log('Adding one noun...')
    await brain.addNoun({ name: 'Test' })
    
    console.log('Memory before search:', (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2), 'MB')
    
    console.log('Performing minimal search...')
    const results = await brain.search('test', { limit: 1 })
    
    console.log('Memory after search:', (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2), 'MB')
    console.log(`Found ${results.length} results`)
    
    process.exit(0)
  } catch (error) {
    console.error('Failed:', error.message)
    process.exit(1)
  }
}

testMinimalSearch()