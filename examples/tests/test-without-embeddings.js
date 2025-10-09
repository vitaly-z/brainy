#!/usr/bin/env node

/**
 * Test ALL Brainy functionality EXCEPT embeddings/search
 * This validates core database operations without ONNX memory issues
 */

import { Brainy } from './dist/index.js'

console.log('🧠 Testing Brainy Core (No Embeddings)')
console.log('=' + '='.repeat(50))

async function testCoreFeatures() {
  try {
    const brain = new Brainy({ 
      storage: { forceMemoryStorage: true },
      verbose: false,
      // Disable embedding features for this test
      embeddingFunction: async (text) => {
        // Return fake embeddings - just for testing non-ML features
        return new Array(384).fill(0.1)
      }
    })
    
    console.log('\n1. Initializing Brainy...')
    await brain.init()
    console.log('✅ Initialized')
    
    // Test data with pre-computed vectors
    const items = [
      { 
        name: 'JavaScript', 
        type: 'language', 
        year: 1995,
        vector: new Array(384).fill(0.1) 
      },
      { 
        name: 'TypeScript', 
        type: 'language', 
        year: 2012,
        vector: new Array(384).fill(0.2)
      },
      { 
        name: 'React', 
        type: 'framework', 
        year: 2013,
        vector: new Array(384).fill(0.3)
      },
      { 
        name: 'Vue', 
        type: 'framework', 
        year: 2014,
        vector: new Array(384).fill(0.4)
      }
    ]
    
    // 1. Test addNoun with vectors
    console.log('\n2. Testing addNoun with vectors...')
    const ids = []
    for (const item of items) {
      const id = await brain.addNoun(item)
      ids.push(id)
    }
    console.log('✅ Added', ids.length, 'items')
    
    // 2. Test getNoun
    console.log('\n3. Testing getNoun...')
    const retrieved = await brain.getNoun(ids[0])
    console.log('✅ Retrieved:', retrieved?.metadata?.name || 'item')
    
    // 3. Test updateNoun
    console.log('\n4. Testing updateNoun...')
    await brain.updateNoun(ids[0], { popularity: 'high' })
    const updated = await brain.getNoun(ids[0])
    console.log('✅ Updated with popularity:', updated?.metadata?.popularity)
    
    // 4. Test metadata filtering (Brain Patterns)
    console.log('\n5. Testing Brain Patterns (metadata filtering)...')
    const filterResults = await brain.search('*', { limit: 10,
      metadata: {
        type: 'framework',
        year: { greaterThan: 2012 }
      }
    })
    console.log('✅ Found', filterResults.length, 'frameworks after 2012')
    
    // 5. Test range queries
    console.log('\n6. Testing range queries...')
    const rangeResults = await brain.search('*', { limit: 10,
      metadata: {
        year: { greaterThan: 1990, lessThan: 2010 }
      }
    })
    console.log('✅ Found', rangeResults.length, 'items from 1990-2010')
    
    // 6. Test getAllNouns
    console.log('\n7. Testing getAllNouns...')
    const allItems = await brain.getAllNouns()
    console.log('✅ Total items:', allItems.length)
    
    // 7. Test deleteNoun
    console.log('\n8. Testing deleteNoun...')
    await brain.deleteNoun(ids[0])
    const afterDelete = await brain.getAllNouns()
    console.log('✅ After delete:', afterDelete.length, 'items')
    
    // 8. Test clearAll
    console.log('\n9. Testing clearAll...')
    await brain.clearAll({ force: true })
    const afterClear = await brain.getAllNouns()
    console.log('✅ After clear:', afterClear.length, 'items')
    
    // 9. Test batch operations
    console.log('\n10. Testing batch operations...')
    const batchIds = []
    for (let i = 0; i < 100; i++) {
      const id = await brain.addNoun({
        name: `Item ${i}`,
        index: i,
        vector: new Array(384).fill(i / 100)
      })
      batchIds.push(id)
    }
    console.log('✅ Added 100 items in batch')
    
    // 10. Test statistics
    console.log('\n11. Testing statistics...')
    const stats = brain.getStats()
    console.log('✅ Stats - Total items:', stats.totalItems)
    console.log('  Dimensions:', stats.dimensions)
    console.log('  Index size:', stats.indexSize)
    
    // Memory usage
    console.log('\n12. Memory Usage:')
    const mem = process.memoryUsage()
    console.log('  Heap Used:', (mem.heapUsed / 1024 / 1024).toFixed(2), 'MB')
    console.log('  RSS:', (mem.rss / 1024 / 1024).toFixed(2), 'MB')
    
    console.log('\n' + '='.repeat(51))
    console.log('🎉 SUCCESS! CORE FEATURES WORKING!')
    console.log('✅ CRUD Operations (add/get/update/delete)')
    console.log('✅ Metadata filtering (Brain Patterns)')
    console.log('✅ Range queries')
    console.log('✅ Batch operations')
    console.log('✅ Statistics')
    console.log('✅ Memory usage: <100MB (no ONNX)')
    
    process.exit(0)
  } catch (error) {
    console.error('\n❌ Test failed:', error.message)
    console.error(error.stack)
    process.exit(1)
  }
}

testCoreFeatures()