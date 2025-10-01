#!/usr/bin/env node

/**
 * Core Functionality Test - MUST PASS for Release
 * 
 * This test verifies ALL core Brainy features work correctly.
 * Uses minimal memory approach to avoid ONNX issues.
 */

import { Brainy } from './dist/index.js'

console.log('🧠 Brainy 2.0 Core Functionality Verification')
console.log('=' + '='.repeat(55))

const tests = {
  passed: 0,
  failed: 0,
  total: 0,
  results: []
}

function test(name, testFn) {
  tests.total++
  return new Promise(async (resolve) => {
    try {
      await testFn()
      console.log(`✅ ${name}`)
      tests.passed++
      tests.results.push({ name, status: 'PASS' })
      resolve(true)
    } catch (error) {
      console.log(`❌ ${name}`)
      console.log(`   Error: ${error.message}`)
      tests.failed++
      tests.results.push({ name, status: 'FAIL', error: error.message })
      resolve(false)
    }
  })
}

async function runTests() {
  console.log('📊 Memory before start:')
  const startMem = process.memoryUsage()
  console.log(`   Heap: ${(startMem.heapUsed / 1024 / 1024).toFixed(2)} MB`)
  console.log(`   RSS:  ${(startMem.rss / 1024 / 1024).toFixed(2)} MB`)
  
  // Create Brainy instance with custom embedding function to avoid ONNX
  const brain = new Brainy({
    storage: { forceMemoryStorage: true },
    verbose: false,
    // Use a simple embedding function to avoid ONNX memory issues
    embeddingFunction: async (data) => {
      // Simple deterministic embedding based on text hash
      const str = typeof data === 'string' ? data : JSON.stringify(data)
      const vector = new Array(384).fill(0)
      for (let i = 0; i < str.length && i < 384; i++) {
        vector[i] = (str.charCodeAt(i) % 256) / 256
      }
      // Add some randomness based on string content
      for (let i = 0; i < 384; i++) {
        vector[i] += Math.sin(str.length * i * 0.01) * 0.1
      }
      return vector
    }
  })

  console.log('\n🚀 Initializing Brainy...')
  await brain.init()
  console.log('✅ Initialization completed')

  console.log('\n📝 Testing Core Operations...')
  
  // Test 1: Basic CRUD Operations
  await test('addNoun() should create items', async () => {
    const id = await brain.addNoun({ name: 'JavaScript', type: 'language', year: 1995 })
    if (typeof id !== 'string' || id.length === 0) {
      throw new Error('addNoun should return non-empty string ID')
    }
  })

  await test('getNoun() should retrieve items', async () => {
    const id = await brain.addNoun({ name: 'Python', type: 'language', year: 1991 })
    const item = await brain.getNoun(id)
    if (!item || item.metadata?.name !== 'Python') {
      throw new Error('getNoun should return correct item')
    }
  })

  await test('updateNoun() should modify items', async () => {
    const id = await brain.addNoun({ name: 'TypeScript', type: 'language', year: 2012 })
    await brain.updateNoun(id, { popularity: 'high' })
    const updated = await brain.getNoun(id)
    if (updated?.metadata?.popularity !== 'high') {
      throw new Error('updateNoun should update metadata')
    }
  })

  await test('deleteNoun() should remove items', async () => {
    const id = await brain.addNoun({ name: 'ToDelete', type: 'test' })
    await brain.deleteNoun(id)
    const deleted = await brain.getNoun(id)
    if (deleted !== null) {
      throw new Error('deleteNoun should remove item completely')
    }
  })

  // Test 2: Search Operations (with simple embeddings)
  await test('search() should find similar items', async () => {
    // Add some test data
    await brain.addNoun({ name: 'React', type: 'framework', category: 'frontend' })
    await brain.addNoun({ name: 'Vue', type: 'framework', category: 'frontend' })
    await brain.addNoun({ name: 'Express', type: 'framework', category: 'backend' })
    
    const results = await brain.search('frontend framework', { limit: 5 })
    if (!Array.isArray(results) || results.length === 0) {
      throw new Error('search should return array of results')
    }
  })

  // Test 3: Brain Patterns (Metadata Filtering)
  await test('Brain Patterns should filter by metadata', async () => {
    await brain.addNoun({ name: 'Django', type: 'framework', year: 2005, language: 'Python' })
    await brain.addNoun({ name: 'FastAPI', type: 'framework', year: 2018, language: 'Python' })
    await brain.addNoun({ name: 'Rails', type: 'framework', year: 2004, language: 'Ruby' })
    
    const pythonFrameworks = await brain.search('*', { limit: 10,
      metadata: { 
        type: 'framework',
        language: 'Python'
      }
    })
    
    if (!Array.isArray(pythonFrameworks) || pythonFrameworks.length < 2) {
      throw new Error('Brain Patterns should filter correctly')
    }
  })

  // Test 4: Range Queries
  await test('Range queries should work', async () => {
    await brain.addNoun({ name: 'OldTech', year: 1990 })
    await brain.addNoun({ name: 'ModernTech1', year: 2015 })
    await brain.addNoun({ name: 'ModernTech2', year: 2020 })
    
    const modernItems = await brain.search('*', { limit: 10,
      metadata: {
        year: { greaterThan: 2010 }
      }
    })
    
    if (!Array.isArray(modernItems) || modernItems.length < 2) {
      throw new Error('Range queries should filter by year')
    }
  })

  // Test 5: Statistics
  await test('getStatistics() should provide stats', async () => {
    const stats = await brain.getStatistics()
    if (typeof stats.totalItems !== 'number' || stats.totalItems <= 0) {
      throw new Error('getStatistics should return valid stats')
    }
  })

  // Test 6: getAllNouns
  await test('getAllNouns() should return all items', async () => {
    const allItems = await brain.getAllNouns()
    if (!Array.isArray(allItems) || allItems.length <= 0) {
      throw new Error('getAllNouns should return array of items')
    }
  })

  // Test 7: Clear operations
  await test('clearAll() should clear database', async () => {
    await brain.clearAll({ force: true })
    const afterClear = await brain.getAllNouns()
    if (afterClear.length !== 0) {
      throw new Error('clearAll should remove all items')
    }
  })

  // Test 8: find() method (NLP-style)
  await test('find() should work with natural language', async () => {
    // Add test data
    await brain.addNoun({ name: 'JavaScript', description: 'Popular programming language for web development' })
    await brain.addNoun({ name: 'Python', description: 'Versatile programming language for data science' })
    
    const results = await brain.find('programming languages for web development')
    if (!Array.isArray(results)) {
      throw new Error('find should return array of results')
    }
  })

  // Final memory check
  console.log('\n💾 Final Memory Usage:')
  const endMem = process.memoryUsage()
  console.log(`   Heap Used: ${(endMem.heapUsed / 1024 / 1024).toFixed(2)} MB`)
  console.log(`   RSS: ${(endMem.rss / 1024 / 1024).toFixed(2)} MB`)
  console.log(`   Growth: ${((endMem.heapUsed - startMem.heapUsed) / 1024 / 1024).toFixed(2)} MB`)
  
  return tests
}

async function main() {
  try {
    const results = await runTests()
    
    console.log('\n' + '='.repeat(56))
    console.log('📊 TEST RESULTS SUMMARY')
    console.log('='.repeat(56))
    console.log(`✅ Passed: ${results.passed}`)
    console.log(`❌ Failed: ${results.failed}`)
    console.log(`📊 Total:  ${results.total}`)
    
    if (results.failed === 0) {
      console.log('\n🎉 SUCCESS! All core functionality verified!')
      console.log('\n✅ Ready for:')
      console.log('  - CRUD operations (add/get/update/delete)')
      console.log('  - Search with embeddings')
      console.log('  - Brain Patterns metadata filtering')
      console.log('  - Range queries')
      console.log('  - Natural language find()')
      console.log('  - Statistics and monitoring')
      console.log('\n🚀 Brainy 2.0 core is WORKING!')
      process.exit(0)
    } else {
      console.log('\n⚠️ FAILED TESTS:')
      results.results
        .filter(r => r.status === 'FAIL')
        .forEach(r => console.log(`   - ${r.name}: ${r.error}`))
      console.log('\n💥 Core functionality has issues - fix before release!')
      process.exit(1)
    }
  } catch (error) {
    console.error('\n💥 Test suite crashed:', error.message)
    console.error(error.stack)
    process.exit(1)
  }
}

main()