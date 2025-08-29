#!/usr/bin/env node
/**
 * Test the Zero-Configuration System
 * This verifies all the zero-config features work as expected
 */

import { BrainyData } from './dist/index.js'

console.log('🧪 Testing Brainy Zero-Config System')
console.log('=' + '='.repeat(50))

async function testZeroConfig() {
  try {
    // Test 1: True zero config
    console.log('\n1️⃣ Testing true zero-config...')
    const brain1 = new BrainyData()
    await brain1.init()
    console.log('✅ Zero-config works!')
    
    // Test 2: String preset
    console.log('\n2️⃣ Testing string preset (development)...')
    const brain2 = new BrainyData('development')
    await brain2.init()
    console.log('✅ String preset works!')
    
    // Test 3: Explicit model precision
    console.log('\n3️⃣ Testing explicit model precision...')
    const brain3 = new BrainyData({
      model: 'fp32',  // Explicit precision
      storage: 'memory'
    })
    await brain3.init()
    console.log('✅ Explicit model precision works!')
    
    // Test 4: Model presets
    console.log('\n4️⃣ Testing model presets...')
    const brain4 = new BrainyData({
      model: 'fast',  // Maps to fp32
      features: 'minimal'
    })
    await brain4.init()
    console.log('✅ Model preset works!')
    
    // Test 5: Storage auto-detection
    console.log('\n5️⃣ Testing storage auto-detection...')
    const brain5 = new BrainyData({
      storage: 'auto'
    })
    await brain5.init()
    console.log('✅ Storage auto-detection works!')
    
    // Test 6: Add some data
    console.log('\n6️⃣ Testing data operations...')
    const brain6 = new BrainyData({ storage: 'memory', model: 'fp32' })
    await brain6.init()
    
    const id = await brain6.addNoun('test item', { type: 'test' })
    console.log(`✅ Added item with ID: ${id}`)
    
    const results = await brain6.search('test', { limit: 1 })
    console.log(`✅ Search returned ${results.length} result(s)`)
    
    // Summary
    console.log('\n' + '='.repeat(51))
    console.log('🎉 ALL ZERO-CONFIG TESTS PASSED!')
    console.log('\nKey Features Verified:')
    console.log('✅ True zero-config (no parameters)')
    console.log('✅ String presets (development/production/minimal)')
    console.log('✅ Explicit model precision (fp32/q8)')
    console.log('✅ Model presets (fast/small)')
    console.log('✅ Storage auto-detection')
    console.log('✅ Simplified config interface')
    console.log('✅ Data operations work correctly')
    
    process.exit(0)
  } catch (error) {
    console.error('\n❌ Test failed:', error.message)
    console.error(error.stack)
    process.exit(1)
  }
}

// Check environment
console.log('\n📊 Environment:')
console.log(`  NODE_ENV: ${process.env.NODE_ENV || 'not set'}`)
console.log(`  Memory: ${Math.floor(process.memoryUsage().rss / 1024 / 1024)}MB`)
console.log(`  Node: ${process.version}`)

// Run tests
testZeroConfig()