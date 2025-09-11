#!/usr/bin/env node

// Minimal test to verify core works without memory issues
import { BrainyData } from './dist/index.js'

console.log('🧪 Minimal Brainy Test')

async function minimalTest() {
  try {
    // Just test initialization and basic add
    const brain = new BrainyData({ 
      storage: { forceMemoryStorage: true },
      verbose: false,
      // Disable features that might use memory
      enableAugmentations: false,
      cache: { enabled: false }
    })
    
    console.log('1. Initializing...')
    await brain.init()
    
    console.log('2. Adding noun...')
    const id = await brain.addNoun({ 
      name: 'Test',
      value: 123
    })
    
    console.log('3. Getting noun...')
    const noun = await brain.getNoun(id)
    
    console.log(`✅ Success! Retrieved: ${noun.name}`)
    console.log(`Memory: ${(process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2)} MB`)
    
    process.exit(0)
  } catch (error) {
    console.error('❌ Failed:', error.message)
    process.exit(1)
  }
}

minimalTest()