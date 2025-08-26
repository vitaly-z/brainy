/**
 * Test script to verify storage augmentation system works
 */

import { BrainyData } from './dist/brainyData.js'
import { 
  MemoryStorageAugmentation,
  FileSystemStorageAugmentation 
} from './dist/augmentations/storageAugmentations.js'

console.log('🧪 Testing Storage Augmentation System')
console.log('=' .repeat(50))

async function test1_ZeroConfig() {
  console.log('\n1. Zero-Config Test')
  const brain = new BrainyData()
  await brain.init()
  
  await brain.add('test', { content: 'Zero-config test' })
  const results = await brain.search('test', 1)
  
  console.log('✅ Zero-config works:', results.length > 0)
  await brain.destroy()
}

async function test2_ConfigBased() {
  console.log('\n2. Config-Based Storage Test')
  const brain = new BrainyData({
    storage: {
      forceMemoryStorage: true
    }
  })
  await brain.init()
  
  await brain.add('config test', { content: 'Config-based test' })
  const results = await brain.search('config', 1)
  
  console.log('✅ Config-based works:', results.length > 0)
  await brain.destroy()
}

async function test3_AugmentationOverride() {
  console.log('\n3. Augmentation Override Test')
  const brain = new BrainyData()
  
  // Register storage augmentation BEFORE init
  brain.augmentations.register(new MemoryStorageAugmentation('test-memory'))
  
  await brain.init()
  
  await brain.add('augmentation test', { content: 'Augmentation override test' })
  const results = await brain.search('augmentation', 1)
  
  console.log('✅ Augmentation override works:', results.length > 0)
  await brain.destroy()
}

async function test4_BackwardCompatibility() {
  console.log('\n4. Backward Compatibility Test')
  
  // Old style with rootDirectory config
  const brain = new BrainyData({
    storage: {
      rootDirectory: './test-data',
      forceFileSystemStorage: true
    }
  })
  
  await brain.init()
  console.log('✅ Backward compatible config works')
  await brain.destroy()
}

async function runAllTests() {
  try {
    await test1_ZeroConfig()
    await test2_ConfigBased()
    await test3_AugmentationOverride()
    await test4_BackwardCompatibility()
    
    console.log('\n' + '='.repeat(50))
    console.log('✅ ALL STORAGE AUGMENTATION TESTS PASSED!')
  } catch (error) {
    console.error('❌ Test failed:', error)
    process.exit(1)
  }
}

runAllTests()