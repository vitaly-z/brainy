#!/usr/bin/env node

import { BrainyData } from './dist/index.js'

async function testMemoryUsage() {
  console.log('Testing memory usage...\n')
  
  // Log memory before
  const memBefore = process.memoryUsage()
  console.log('Memory before:', {
    rss: Math.round(memBefore.rss / 1024 / 1024) + ' MB',
    heapUsed: Math.round(memBefore.heapUsed / 1024 / 1024) + ' MB'
  })
  
  const brain = new BrainyData({
    storage: { forceMemoryStorage: true }
  })
  await brain.init()
  console.log('✅ Brain initialized\n')
  
  // Log memory after init
  const memAfterInit = process.memoryUsage()
  console.log('Memory after init:', {
    rss: Math.round(memAfterInit.rss / 1024 / 1024) + ' MB',
    heapUsed: Math.round(memAfterInit.heapUsed / 1024 / 1024) + ' MB',
    delta: Math.round((memAfterInit.heapUsed - memBefore.heapUsed) / 1024 / 1024) + ' MB'
  })
  
  // Add some data WITHOUT using find()
  console.log('\n📝 Adding data...')
  for (let i = 0; i < 5; i++) {
    await brain.addNoun(`Item ${i}`, { metadata: { index: i } })
  }
  console.log('✅ Added 5 items\n')
  
  // Now try search (not find)
  console.log('🔍 Testing search...')
  const results = await brain.search('Item', 3)
  console.log(`Found ${results.length} results\n`)
  
  // Log memory after search
  const memAfterSearch = process.memoryUsage()
  console.log('Memory after search:', {
    rss: Math.round(memAfterSearch.rss / 1024 / 1024) + ' MB',
    heapUsed: Math.round(memAfterSearch.heapUsed / 1024 / 1024) + ' MB',
    delta: Math.round((memAfterSearch.heapUsed - memAfterInit.heapUsed) / 1024 / 1024) + ' MB'
  })
  
  await brain.shutdown()
  console.log('\n✅ Test complete!')
  process.exit(0)
}

testMemoryUsage().catch(err => {
  console.error('❌ Error:', err.message)
  process.exit(1)
})