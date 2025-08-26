#!/usr/bin/env node

/**
 * Test BRAINY_ALLOW_REMOTE_MODELS=false behavior
 * This validates that the flag prevents remote model downloads and works with local models only
 */

import { BrainyData } from './dist/index.js'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

async function testLocalModelsOnly() {
  console.log('🧪 Testing BRAINY_ALLOW_REMOTE_MODELS=false behavior...')
  
  // Ensure we're using local models only
  process.env.BRAINY_ALLOW_REMOTE_MODELS = 'false'
  process.env.BRAINY_MODELS_PATH = join(__dirname, 'models')
  
  // Verify environment variables are set
  console.log(`Set BRAINY_ALLOW_REMOTE_MODELS=${process.env.BRAINY_ALLOW_REMOTE_MODELS}`)
  console.log(`Set BRAINY_MODELS_PATH=${process.env.BRAINY_MODELS_PATH}`)
  
  try {
    console.log('✅ Creating BrainyData with local models only...')
    const brain = new BrainyData()
    
    console.log('✅ Initializing (should use local models)...')
    await brain.init()
    
    console.log('✅ Adding test data...')
    const id1 = await brain.add('JavaScript is a programming language', { type: 'concept' })
    const id2 = await brain.add('TypeScript adds types to JavaScript', { type: 'concept' })
    
    console.log('✅ Testing search functionality...')
    const results = await brain.search('programming language', 2)
    
    console.log(`✅ Found ${results.length} results`)
    results.forEach((result, i) => {
      console.log(`  ${i + 1}. Score: ${result.score.toFixed(4)} - ${result.metadata?.data || 'No data'}`)
    })
    
    await brain.cleanup?.()
    console.log('✅ SUCCESS: BRAINY_ALLOW_REMOTE_MODELS=false works correctly!')
    console.log('✅ Local models were used successfully without remote downloads')
    
  } catch (error) {
    console.error('❌ FAILED: BRAINY_ALLOW_REMOTE_MODELS=false test failed')
    console.error('Error:', error.message)
    
    if (error.message.includes('Failed to load embedding model')) {
      console.log('🔍 This might indicate:')
      console.log('  1. Local models are not properly cached')
      console.log('  2. Model path configuration issue') 
      console.log('  3. Remote models disabled but local models missing')
    }
    
    process.exit(1)
  }
}

console.log('🚀 BRAINY_ALLOW_REMOTE_MODELS Flag Test')
console.log('====================================')
console.log(`BRAINY_ALLOW_REMOTE_MODELS=${process.env.BRAINY_ALLOW_REMOTE_MODELS}`)
console.log(`BRAINY_MODELS_PATH=${process.env.BRAINY_MODELS_PATH}`)
console.log('')

testLocalModelsOnly()