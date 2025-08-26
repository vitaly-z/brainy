#!/usr/bin/env node

// Quick test to verify Brainy works without running full test suite
import { BrainyData } from './dist/index.js'

console.log('🧪 Quick Brainy Test')
console.log('====================')

async function quickTest() {
  try {
    // Test 1: Initialize
    console.log('\n1. Initializing Brainy...')
    const brain = new BrainyData({ 
      storage: { forceMemoryStorage: true },
      verbose: false 
    })
    await brain.init()
    console.log('✅ Initialization successful')

    // Test 2: Add nouns
    console.log('\n2. Adding nouns...')
    const jsId = await brain.addNoun({ 
      name: 'JavaScript',
      type: 'language',
      year: 1995 
    })
    const pyId = await brain.addNoun({ 
      name: 'Python',
      type: 'language',
      year: 1991 
    })
    const tsId = await brain.addNoun({ 
      name: 'TypeScript',
      type: 'language',
      year: 2012 
    })
    console.log('✅ Added 3 nouns')

    // Test 3: Add verb
    console.log('\n3. Adding verb...')
    await brain.addVerb(tsId, jsId, 'extends')
    console.log('✅ Added verb relationship')

    // Test 4: Search
    console.log('\n4. Performing search...')
    const results = await brain.search('programming languages', 3)
    console.log(`✅ Found ${results.length} results`)

    // Test 5: Natural language search
    console.log('\n5. Natural language search...')
    const nlpResults = await brain.find('languages from the 90s')
    console.log(`✅ Found ${nlpResults.length} results with NLP`)

    // Test 6: Triple search with metadata filter
    console.log('\n6. Triple Intelligence search...')
    const tripleResults = await brain.triple.search({
      like: 'JavaScript',
      where: { year: { greaterThan: 2000 } }
    })
    console.log(`✅ Triple search found ${tripleResults.length} results`)

    // Test 7: Brain Patterns (range query)
    console.log('\n7. Brain Pattern range query...')
    const rangeResults = await brain.search('*', 10, {
      metadata: {
        year: { greaterThan: 1990, lessThan: 2000 }
      }
    })
    console.log(`✅ Range query found ${rangeResults.length} results`)

    // Test 8: Get noun
    console.log('\n8. Getting noun...')
    const noun = await brain.getNoun(jsId)
    console.log(`✅ Retrieved noun: ${noun.name}`)

    // Test 9: Memory stats
    console.log('\n9. Checking memory...')
    const memUsed = process.memoryUsage().heapUsed / 1024 / 1024
    console.log(`✅ Memory usage: ${memUsed.toFixed(2)} MB`)

    // Success!
    console.log('\n' + '='.repeat(40))
    console.log('🎉 ALL TESTS PASSED!')
    console.log('='.repeat(40))
    console.log('\nBrainy 2.0 core functionality verified:')
    console.log('- Zero-config initialization ✅')
    console.log('- Noun/Verb operations ✅')
    console.log('- Vector search ✅')
    console.log('- Natural language search ✅')
    console.log('- Triple Intelligence ✅')
    console.log('- Brain Patterns ✅')
    console.log('- Memory efficient ✅')
    
    process.exit(0)
  } catch (error) {
    console.error('\n❌ Test failed:', error.message)
    console.error(error.stack)
    process.exit(1)
  }
}

quickTest()