#!/usr/bin/env tsx

import { HybridModelManager } from './src/utils/hybridModelManager.js'

async function testEnvironmentFlag() {
  console.log('Testing BRAINY_ALLOW_REMOTE_MODELS=false flag...')
  
  // Test with flag set to false
  process.env.BRAINY_ALLOW_REMOTE_MODELS = 'false'
  console.log(`Set BRAINY_ALLOW_REMOTE_MODELS=${process.env.BRAINY_ALLOW_REMOTE_MODELS}`)
  
  try {
    const manager = new HybridModelManager()
    const model = await manager.getPrimaryModel()
    
    console.log('✅ Model options:')
    console.log(`  localFilesOnly: ${model.options?.localFilesOnly}`)
    console.log(`  model: ${model.options?.model}`)
    console.log(`  cacheDir: ${model.options?.cacheDir}`)
    
    if (model.options?.localFilesOnly === true) {
      console.log('✅ SUCCESS: BRAINY_ALLOW_REMOTE_MODELS=false is working correctly!')
    } else {
      console.log('❌ FAILURE: localFilesOnly should be true when BRAINY_ALLOW_REMOTE_MODELS=false')
    }
    
  } catch (error) {
    console.error('❌ Error testing flag:', error.message)
  }
  
  console.log('\n' + '='.repeat(50))
  
  // Test with flag set to true
  process.env.BRAINY_ALLOW_REMOTE_MODELS = 'true'
  console.log(`Set BRAINY_ALLOW_REMOTE_MODELS=${process.env.BRAINY_ALLOW_REMOTE_MODELS}`)
  
  try {
    const manager = new HybridModelManager()
    const model = await manager.getPrimaryModel()
    
    console.log('✅ Model options:')
    console.log(`  localFilesOnly: ${model.options?.localFilesOnly}`)
    
    if (model.options?.localFilesOnly === false) {
      console.log('✅ SUCCESS: BRAINY_ALLOW_REMOTE_MODELS=true is working correctly!')
    } else {
      console.log('❌ FAILURE: localFilesOnly should be false when BRAINY_ALLOW_REMOTE_MODELS=true')
    }
    
  } catch (error) {
    console.error('❌ Error testing flag:', error.message)
  }
}

testEnvironmentFlag().catch(console.error)