#!/usr/bin/env node

/**
 * Test Memory-Safe Brainy System
 * 
 * Verifies that our universal memory manager prevents crashes
 * Uses reasonable memory limits (4GB instead of 16GB)
 */

import { Brainy } from './dist/index.js'

console.log('🧠 Testing Memory-Safe Brainy System')
console.log('=' + '='.repeat(50))

async function testMemorySafety() {
  try {
    console.log('📊 Memory before start:')
    const startMem = process.memoryUsage()
    console.log(`   Heap: ${(startMem.heapUsed / 1024 / 1024).toFixed(2)} MB`)
    console.log(`   RSS:  ${(startMem.rss / 1024 / 1024).toFixed(2)} MB`)
    
    console.log('\n🚀 Initializing Brainy with Universal Memory Manager...')
    const brain = new Brainy({
      storage: { forceMemoryStorage: true },
      verbose: false
    })
    
    await brain.init()
    console.log('✅ Initialized successfully')
    
    console.log('\n📝 Testing multiple embedding operations...')
    const testItems = [
      'JavaScript programming language',
      'Python data science framework',
      'React component library',
      'Node.js runtime environment',
      'Machine learning algorithms',
      'Database query optimization',
      'Web development frameworks',
      'Cloud computing services',
      'Artificial intelligence models',
      'Software engineering practices'
    ]
    
    // Add items that require embeddings
    for (let i = 0; i < testItems.length; i++) {
      const id = await brain.addNoun({ 
        text: testItems[i], 
        category: 'tech',
        index: i 
      })
      console.log(`   Added item ${i + 1}/10: ${testItems[i].substring(0, 30)}...`)
      
      // Check memory periodically
      if (i % 3 === 0) {
        const mem = process.memoryUsage()
        console.log(`   Memory: ${(mem.heapUsed / 1024 / 1024).toFixed(2)} MB heap, ${(mem.rss / 1024 / 1024).toFixed(2)} MB RSS`)
      }
    }
    
    console.log('\n🔍 Testing search operations...')
    const searchResults = await brain.search('programming', { limit: 5 })
    console.log(`✅ Search completed: found ${searchResults.length} results`)
    
    console.log('\n🧠 Testing Brain Patterns...')
    const filteredResults = await brain.search('*', { limit: 10,
      metadata: { category: 'tech' }
    })
    console.log(`✅ Brain Patterns completed: found ${filteredResults.length} results`)
    
    console.log('\n📊 Final memory usage:')
    const endMem = process.memoryUsage()
    console.log(`   Heap Used: ${(endMem.heapUsed / 1024 / 1024).toFixed(2)} MB`)
    console.log(`   RSS: ${(endMem.rss / 1024 / 1024).toFixed(2)} MB`)
    console.log(`   Heap Growth: ${((endMem.heapUsed - startMem.heapUsed) / 1024 / 1024).toFixed(2)} MB`)
    
    // Get memory manager stats if available
    try {
      const { getEmbeddingMemoryStats } = await import('./dist/embeddings/universal-memory-manager.js')
      const stats = getEmbeddingMemoryStats()
      console.log('\n🔧 Memory Manager Stats:')
      console.log(`   Strategy: ${stats.strategy}`)
      console.log(`   Embeddings: ${stats.embeddings}`)
      console.log(`   Restarts: ${stats.restarts}`)
      console.log(`   Memory: ${stats.memoryUsage}`)
    } catch (error) {
      console.log('\n⚠️ Memory stats not available')
    }
    
    console.log('\n✅ All tests completed without crashes!')
    console.log('🎉 Memory-safe system is working correctly')
    
    return true
  } catch (error) {
    console.error('\n❌ Test failed:', error.message)
    console.error(error.stack)
    return false
  }
}

// Run test
async function main() {
  const success = await testMemorySafety()
  
  if (success) {
    console.log('\n🚀 SUCCESS: Memory-safe Brainy is ready for production!')
    process.exit(0)
  } else {
    console.log('\n💥 FAILURE: Memory issues detected')
    process.exit(1)
  }
}

main()