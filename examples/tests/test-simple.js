#!/usr/bin/env node

import { Brainy } from './dist/index.js'

async function testBasicFunctionality() {
  console.log('Testing Brainy 2.0 Core Functionality...\n')
  
  let brain
  try {
    // Test 1: Initialization
    console.log('1. Testing initialization...')
    brain = new Brainy({
      storage: { forceMemoryStorage: true },
      dimensions: 384,
      metric: 'cosine'
    })
    await brain.init()
    console.log('✅ Initialization successful\n')

    // Test 2: Add noun
    console.log('2. Testing addNoun...')
    const id1 = await brain.addNoun('test item 1', { metadata: { type: 'test' } })
    console.log(`✅ Added noun with ID: ${id1}\n`)

    // Test 3: Get noun
    console.log('3. Testing getNoun...')
    const item = await brain.getNoun(id1)
    console.log(`✅ Retrieved noun: ${JSON.stringify(item?.metadata)}\n`)

    // Test 4: Search
    console.log('4. Testing search...')
    const results = await brain.search('test', { limit: 1 })
    console.log(`✅ Search returned ${results.length} result(s)\n`)

    // Test 5: Metadata field discovery
    console.log('5. Testing metadata field discovery...')
    const fields = await brain.getFilterFields()
    console.log(`✅ Available fields: ${JSON.stringify(fields)}\n`)

    // Test 6: Advanced find with metadata
    console.log('6. Testing find() with metadata filter...')
    await brain.addNoun('another test', { metadata: { type: 'demo', score: 95 } })
    await brain.addNoun('yet another', { metadata: { type: 'demo', score: 85 } })
    
    const findResults = await brain.find({
      where: { type: 'demo' },
      limit: 10
    })
    console.log(`✅ Find with metadata returned ${findResults.length} result(s)\n`)

    // Test 7: Combined vector + metadata search
    console.log('7. Testing combined vector + metadata search...')
    const combined = await brain.find({
      like: 'test',
      where: { type: 'test' },
      limit: 5
    })
    console.log(`✅ Combined search returned ${combined.length} result(s)\n`)

    // Test 8: Cleanup
    console.log('8. Testing cleanup...')
    await brain.shutdown()
    console.log('✅ Cleanup successful\n')

    console.log('🎉 ALL TESTS PASSED!')
    process.exit(0)

  } catch (error) {
    console.error('❌ Test failed:', error.message)
    if (brain) {
      try {
        await brain.shutdown()
      } catch (e) {
        // Ignore
      }
    }
    process.exit(1)
  }
}

testBasicFunctionality()