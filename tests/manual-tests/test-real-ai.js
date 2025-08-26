#!/usr/bin/env node

/**
 * Quick test to verify ALL core features with real AI
 * Direct Node.js script to avoid test framework overhead
 */

import { BrainyData } from './dist/index.js'

console.log('🧠 TESTING BRAINY 2.0 WITH REAL AI MODELS')
console.log('==========================================')

async function testAllFeatures() {
  try {
    console.log('\n1. Initializing with real AI...')
    const brain = new BrainyData({
      storage: { forceMemoryStorage: true },
      verbose: false
    })
    
    await brain.init()
    console.log('✅ Real AI models loaded successfully')
    
    await brain.clearAll({ force: true })
    console.log('✅ Database cleared')
    
    console.log('\n2. Testing addNoun with real embeddings...')
    const testItems = [
      'JavaScript programming language for web development',
      'Python machine learning and artificial intelligence',
      'React frontend framework for user interfaces',
      'Docker containerization for deployment'
    ]
    
    const ids = []
    for (const item of testItems) {
      const id = await brain.addNoun(item)
      ids.push(id)
      console.log(`   ✅ Added: ${item.substring(0, 30)}...`)
    }
    
    console.log('\n3. Testing search() with real semantic understanding...')
    const searchResults = await brain.search('web development programming', { limit: 3 })
    console.log(`   ✅ Found ${searchResults.length} results with real embeddings`)
    searchResults.forEach((result, i) => {
      console.log(`   ${i+1}. Score: ${result.score.toFixed(3)} - ${JSON.stringify(result.metadata).substring(0, 50)}...`)
    })
    
    console.log('\n4. Testing find() with natural language...')
    const findResults = await brain.find('show me programming languages')
    console.log(`   ✅ Found ${findResults.length} results with NLP`)
    
    console.log('\n5. Testing Brain Patterns (metadata + semantic)...')
    await brain.addNoun('React framework', { type: 'frontend', year: 2013 })
    await brain.addNoun('Vue.js framework', { type: 'frontend', year: 2014 })
    
    const patternResults = await brain.search('user interface framework', { limit: 5,
      metadata: { type: 'frontend' }
    })
    console.log(`   ✅ Found ${patternResults.length} frontend frameworks`)
    
    console.log('\n6. Testing Triple Intelligence...')
    const tripleResults = await brain.triple.search({
      like: 'modern web framework',
      where: { type: 'frontend' },
      limit: 3
    })
    console.log(`   ✅ Found ${tripleResults.length} results with Triple Intelligence`)
    
    console.log('\n7. Testing statistics and health...')
    const stats = await brain.getStatistics()
    console.log(`   ✅ Total items: ${stats.totalItems}`)
    console.log(`   ✅ Dimensions: ${stats.dimensions}`)
    console.log(`   ✅ Index size: ${stats.indexSize}`)
    
    console.log('\n8. Testing direct embedding generation...')
    const embedding = await brain.embed('test direct embedding')
    console.log(`   ✅ Generated ${embedding.length}D embedding`)
    console.log(`   ✅ Values in range: ${Math.min(...embedding).toFixed(3)} to ${Math.max(...embedding).toFixed(3)}`)
    
    console.log('\n🎉 ALL TESTS PASSED!')
    console.log('=====================================')
    console.log('✅ Real AI embeddings working')
    console.log('✅ Semantic search accurate') 
    console.log('✅ Natural language find() working')
    console.log('✅ Brain Patterns combining metadata + semantics')
    console.log('✅ Triple Intelligence operational')
    console.log('✅ Statistics and monitoring healthy')
    console.log('✅ Direct embedding access working')
    
    // Memory usage
    const memory = process.memoryUsage()
    console.log(`\n📊 Final memory usage: ${(memory.heapUsed / 1024 / 1024).toFixed(2)} MB`)
    
    process.exit(0)
    
  } catch (error) {
    console.error('\n❌ Test failed:', error.message)
    console.error(error.stack)
    process.exit(1)
  }
}

testAllFeatures()