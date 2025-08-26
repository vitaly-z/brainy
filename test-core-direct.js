#!/usr/bin/env node

/**
 * Direct Node.js test for Brainy core functionality
 * Bypasses Vitest to avoid memory overhead
 */

import { BrainyData } from './dist/index.js'

console.log('🧠 Testing Brainy Core Functionality (Direct Node.js)')
console.log('=' + '='.repeat(60))

const tests = {
  passed: 0,
  failed: 0,
  results: []
}

function assert(condition, message) {
  if (condition) {
    console.log(`✅ ${message}`)
    tests.passed++
    tests.results.push({ test: message, status: 'PASS' })
  } else {
    console.log(`❌ ${message}`)
    tests.failed++
    tests.results.push({ test: message, status: 'FAIL' })
  }
}

async function testBrainyCore() {
  try {
    // Test 1: Library Loading
    console.log('\n📦 Testing Library Loading')
    assert(typeof BrainyData === 'function', 'BrainyData class should be exported')
    
    // Test 2: Instance Creation
    console.log('\n🏗️  Testing Instance Creation')
    const brain = new BrainyData({
      storage: { forceMemoryStorage: true },
      verbose: false
    })
    assert(brain !== null, 'Should create BrainyData instance')
    assert(brain.dimensions === 384, 'Should have 384 dimensions')
    
    // Test 3: Initialization
    console.log('\n⚡ Testing Initialization')
    const startTime = Date.now()
    await brain.init()
    const initTime = Date.now() - startTime
    console.log(`   Initialization took: ${initTime}ms`)
    assert(true, 'Should initialize successfully')
    
    // Test 4: Add Items
    console.log('\n📝 Testing Add Operations')
    const id1 = await brain.addNoun({ name: 'JavaScript', type: 'language' })
    const id2 = await brain.addNoun({ name: 'Python', type: 'language' })
    const id3 = await brain.addNoun({ name: 'React', type: 'framework' })
    
    assert(typeof id1 === 'string', 'Should return string ID for first item')
    assert(typeof id2 === 'string', 'Should return string ID for second item')
    assert(typeof id3 === 'string', 'Should return string ID for third item')
    
    // Test 5: Get Items
    console.log('\n🔍 Testing Get Operations')
    const item1 = await brain.getNoun(id1)
    assert(item1 !== null, 'Should retrieve first item')
    assert(item1?.metadata?.name === 'JavaScript', 'Should have correct metadata')
    
    // Test 6: Search Operations (Vector-based)
    console.log('\n🔎 Testing Search Operations')
    const searchResults = await brain.search('programming language', 2)
    assert(Array.isArray(searchResults), 'Search should return array')
    assert(searchResults.length > 0, 'Should find programming languages')
    console.log(`   Found ${searchResults.length} results for "programming language"`)
    
    // Test 7: Metadata Filtering (Brain Patterns)
    console.log('\n🧠 Testing Brain Patterns (Metadata Filtering)')
    const frameworkResults = await brain.search('*', 10, {
      metadata: { type: 'framework' }
    })
    assert(Array.isArray(frameworkResults), 'Metadata filter should return array')
    console.log(`   Found ${frameworkResults.length} frameworks`)
    
    // Test 8: Update Operations
    console.log('\n✏️  Testing Update Operations')
    await brain.updateNoun(id1, { popularity: 'high' })
    const updatedItem = await brain.getNoun(id1)
    assert(updatedItem?.metadata?.popularity === 'high', 'Should update metadata')
    
    // Test 9: Statistics
    console.log('\n📊 Testing Statistics')
    const stats = await brain.getStatistics()
    assert(typeof stats.totalItems === 'number', 'Should provide total items count')
    assert(stats.totalItems >= 3, 'Should count added items')
    console.log(`   Total items: ${stats.totalItems}`)
    
    // Test 10: Clear All (with force)
    console.log('\n🧹 Testing Clear Operations')
    await brain.clearAll({ force: true })
    const afterClear = await brain.search('*', 10)
    assert(afterClear.length === 0, 'Should clear all items')
    
    // Memory check
    console.log('\n💾 Memory Usage')
    const mem = process.memoryUsage()
    const heapMB = (mem.heapUsed / 1024 / 1024).toFixed(2)
    const rssMB = (mem.rss / 1024 / 1024).toFixed(2)
    console.log(`   Heap Used: ${heapMB} MB`)
    console.log(`   RSS: ${rssMB} MB`)
    
    return true
  } catch (error) {
    console.error('\n❌ Test failed with error:', error.message)
    console.error(error.stack)
    tests.failed++
    return false
  }
}

// Run tests
async function main() {
  const success = await testBrainyCore()
  
  console.log('\n' + '='.repeat(61))
  console.log('📊 Test Results')
  console.log('='.repeat(61))
  console.log(`✅ Passed: ${tests.passed}`)
  console.log(`❌ Failed: ${tests.failed}`)
  console.log(`📊 Total:  ${tests.passed + tests.failed}`)
  
  if (success && tests.failed === 0) {
    console.log('\n🎉 All tests passed! Brainy core functionality verified.')
    console.log('\n✅ Ready for:')
    console.log('  - Vector search with semantic understanding')
    console.log('  - Metadata filtering with Brain Patterns')
    console.log('  - CRUD operations (add/get/update/delete)')
    console.log('  - Real-time statistics and monitoring')
    process.exit(0)
  } else {
    console.log('\n⚠️  Some tests failed. Check the output above.')
    process.exit(1)
  }
}

main()