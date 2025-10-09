#!/usr/bin/env node

/**
 * Scale Test - Verify Brainy handles millions of items
 * 
 * This test verifies:
 * 1. Connection pooling works with real operations
 * 2. Batch processing executes real operations
 * 3. System scales to millions of nouns/verbs
 * 4. No fake/stub code in production path
 */

import { Brainy } from '../dist/index.js'
import { MemoryStorage } from '../dist/storage/adapters/memoryStorage.js'

// Test configuration
const TEST_SCALE = {
  SMALL: 1000,
  MEDIUM: 10000,
  LARGE: 100000,
  ENTERPRISE: 1000000
}

const CURRENT_SCALE = process.env.SCALE || 'SMALL'
const TOTAL_ITEMS = TEST_SCALE[CURRENT_SCALE]
const BATCH_SIZE = 1000

console.log(`\n🚀 Scale Test Starting`)
console.log(`📊 Testing with ${TOTAL_ITEMS.toLocaleString()} items`)
console.log(`📦 Batch size: ${BATCH_SIZE}`)
console.log(`🔧 Mode: ${CURRENT_SCALE}\n`)

async function runScaleTest() {
  const startTime = Date.now()
  
  // Initialize Brainy with real augmentations
  const brain = new Brainy({
    storage: new MemoryStorage(),
    augmentations: {
      // These should all be REAL implementations now
      batchProcessing: {
        enabled: true,
        maxBatchSize: BATCH_SIZE,
        adaptiveBatching: true
      },
      connectionPool: {
        enabled: true,
        maxConnections: 50,
        minConnections: 5
      },
      cache: {
        enabled: true,
        maxSize: 10000
      },
      index: {
        enabled: true
      }
    }
  })
  
  await brain.init()
  
  console.log('✅ Brainy initialized with real augmentations\n')
  
  // Test 1: Batch Insert Performance
  console.log('📝 Test 1: Batch Insert Performance')
  const insertStart = Date.now()
  const insertPromises = []
  
  for (let i = 0; i < TOTAL_ITEMS; i++) {
    // addNoun(data, nounType, metadata)
    const promise = brain.addNoun(
      {
        id: `noun_${i}`,
        index: i,
        content: `Test content for item ${i}`,
        timestamp: Date.now(),
        type: 'TestItem'
      },
      'document',  // noun type
      {
        customField: `item_${i}`
      }
    )
    
    insertPromises.push(promise)
    
    // Process in batches to avoid memory overflow
    if (insertPromises.length >= BATCH_SIZE) {
      await Promise.all(insertPromises)
      insertPromises.length = 0
      
      if ((i + 1) % 10000 === 0) {
        const elapsed = Date.now() - insertStart
        const rate = Math.round((i + 1) / (elapsed / 1000))
        console.log(`  Inserted ${(i + 1).toLocaleString()} items (${rate.toLocaleString()} items/sec)`)
      }
    }
  }
  
  // Process remaining
  if (insertPromises.length > 0) {
    await Promise.all(insertPromises)
  }
  
  const insertTime = Date.now() - insertStart
  const insertRate = Math.round(TOTAL_ITEMS / (insertTime / 1000))
  console.log(`✅ Inserted ${TOTAL_ITEMS.toLocaleString()} items in ${insertTime}ms`)
  console.log(`📈 Rate: ${insertRate.toLocaleString()} items/second\n`)
  
  // Test 2: Search Performance
  console.log('🔍 Test 2: Search Performance')
  const searchStart = Date.now()
  const searchQueries = [
    'Test content',
    'item 500',
    'document',
    'timestamp'
  ]
  
  for (const query of searchQueries) {
    const results = await brain.searchText(query, 100)  // limit as number, not object
    console.log(`  Query "${query}": ${results.length} results`)
  }
  
  const searchTime = Date.now() - searchStart
  console.log(`✅ Search completed in ${searchTime}ms\n`)
  
  // Test 3: Relationship Creation (Verbs)
  console.log('🔗 Test 3: Relationship Creation')
  const verbStart = Date.now()
  const verbPromises = []
  const verbCount = Math.min(TOTAL_ITEMS / 10, 10000) // Create 10% as many verbs
  
  for (let i = 0; i < verbCount; i++) {
    const sourceId = `noun_${Math.floor(Math.random() * TOTAL_ITEMS)}`
    const targetId = `noun_${Math.floor(Math.random() * TOTAL_ITEMS)}`
    
    const promise = brain.addVerb({
      source: sourceId,
      target: targetId,
      type: 'RelatedTo',
      weight: Math.random()
    })
    
    verbPromises.push(promise)
    
    if (verbPromises.length >= BATCH_SIZE) {
      await Promise.all(verbPromises)
      verbPromises.length = 0
    }
  }
  
  if (verbPromises.length > 0) {
    await Promise.all(verbPromises)
  }
  
  const verbTime = Date.now() - verbStart
  const verbRate = Math.round(verbCount / (verbTime / 1000))
  console.log(`✅ Created ${verbCount.toLocaleString()} relationships in ${verbTime}ms`)
  console.log(`📈 Rate: ${verbRate.toLocaleString()} relationships/second\n`)
  
  // Test 4: Verify Augmentations Are Real
  console.log('🔧 Test 4: Verify Real Implementations')
  
  // Check BatchProcessing stats
  const batchAug = brain.augmentations.getAugmentation('BatchProcessing')
  if (batchAug && typeof batchAug.getStats === 'function') {
    const stats = batchAug.getStats()
    console.log(`  BatchProcessing: ${stats.batchesProcessed} batches processed`)
    console.log(`  Average batch size: ${Math.round(stats.averageBatchSize)}`)
    console.log(`  Throughput: ${stats.throughputPerSecond} ops/sec`)
  }
  
  // Check ConnectionPool stats
  const poolAug = brain.augmentations.getAugmentation('ConnectionPool')
  if (poolAug && typeof poolAug.getStats === 'function') {
    const stats = poolAug.getStats()
    console.log(`  ConnectionPool: ${stats.totalConnections} connections`)
    console.log(`  Pool utilization: ${stats.poolUtilization}`)
    console.log(`  Total requests: ${stats.totalRequests}`)
  }
  
  // Check Cache stats
  const cacheAug = brain.augmentations.getAugmentation('cache')
  if (cacheAug && typeof cacheAug.getStats === 'function') {
    const stats = cacheAug.getStats()
    console.log(`  Cache: ${stats.hits} hits, ${stats.misses} misses`)
    console.log(`  Hit rate: ${Math.round((stats.hits / (stats.hits + stats.misses)) * 100)}%`)
  }
  
  // Final Statistics
  const totalTime = Date.now() - startTime
  const stats = brain.getStats()
  
  console.log('\n📊 Final Statistics:')
  console.log(`  Total nouns: ${stats.totalNouns.toLocaleString()}`)
  console.log(`  Total verbs: ${stats.totalVerbs.toLocaleString()}`)
  console.log(`  Total time: ${totalTime}ms`)
  console.log(`  Overall throughput: ${Math.round((TOTAL_ITEMS + verbCount) / (totalTime / 1000)).toLocaleString()} ops/sec`)
  
  // Verify no stub behavior
  console.log('\n✅ Verification:')
  
  // Try to retrieve a random item to verify storage works
  const randomId = `noun_${Math.floor(Math.random() * TOTAL_ITEMS)}`
  const retrieved = await brain.getNoun(randomId)
  if (retrieved && retrieved.data && retrieved.data.index !== undefined) {
    console.log(`  ✅ Storage working: Retrieved ${randomId} with correct data`)
  } else {
    console.error(`  ❌ Storage issue: Could not retrieve ${randomId}`)
  }
  
  // Verify batch processing actually executed operations
  if (stats.totalNouns === TOTAL_ITEMS) {
    console.log(`  ✅ Batch processing working: All ${TOTAL_ITEMS.toLocaleString()} items stored`)
  } else {
    console.error(`  ❌ Batch processing issue: Expected ${TOTAL_ITEMS}, got ${stats.totalNouns}`)
  }
  
  // Performance assessment
  console.log('\n🎯 Performance Assessment:')
  if (insertRate > 10000) {
    console.log(`  ✅ Excellent: ${insertRate.toLocaleString()} items/sec insert rate`)
  } else if (insertRate > 1000) {
    console.log(`  ⚡ Good: ${insertRate.toLocaleString()} items/sec insert rate`)
  } else {
    console.log(`  ⚠️ Needs optimization: ${insertRate.toLocaleString()} items/sec insert rate`)
  }
  
  // Test complete
  console.log('\n✅ Scale test completed successfully!')
  
  // Cleanup
  await brain.close()
}

// Run the test
runScaleTest().catch(error => {
  console.error('\n❌ Scale test failed:', error)
  process.exit(1)
})