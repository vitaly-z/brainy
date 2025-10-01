#!/usr/bin/env node

/**
 * Brainy 3.0 Performance Benchmark
 * Compare v2 (Brainy) vs v3 (Brainy) performance
 */

import { Brainy } from '../../dist/index.js'
import { NounType, VerbType } from '../../dist/types/graphTypes.js'

const ITERATIONS = 1000
const BATCH_SIZE = 100

async function benchmarkV2() {
  console.log('\n📊 Brainy v2 Performance')
  console.log('═'.repeat(50))
  
  const brain = new Brainy({
    storage: { type: 'memory' },
    augmentations: false,
    embeddingFunction: async () => new Array(384).fill(0).map(() => Math.random())
  })
  await brain.init()
  
  // Test 1: Add operations
  const start1 = performance.now()
  const ids = []
  for (let i = 0; i < ITERATIONS; i++) {
    const id = await brain.addNoun(
      new Array(384).fill(0).map(() => Math.random()),
      'document',
      { index: i, title: `Doc ${i}` }
    )
    ids.push(id)
  }
  const addTime = performance.now() - start1
  console.log(`✅ Add ${ITERATIONS} items: ${addTime.toFixed(2)}ms (${(ITERATIONS / (addTime / 1000)).toFixed(0)} ops/sec)`)
  
  // Test 2: Get operations
  const start2 = performance.now()
  for (let i = 0; i < Math.min(100, ids.length); i++) {
    await brain.getNoun(ids[i])
  }
  const getTime = performance.now() - start2
  console.log(`✅ Get 100 items: ${getTime.toFixed(2)}ms (${(100 / (getTime / 1000)).toFixed(0)} ops/sec)`)
  
  // Test 3: Search operations
  const start3 = performance.now()
  await brain.search({
    query: new Array(384).fill(0).map(() => Math.random()),
    limit: 10
  })
  const searchTime = performance.now() - start3
  console.log(`✅ Vector search: ${searchTime.toFixed(2)}ms`)
  
  // Test 4: Metadata filter
  const start4 = performance.now()
  await brain.find({
    where: { index: { greaterThan: 500 } },
    limit: 10
  })
  const filterTime = performance.now() - start4
  console.log(`✅ Metadata filter: ${filterTime.toFixed(2)}ms`)
  
  // Test 5: Relationship operations
  const start5 = performance.now()
  for (let i = 0; i < 50; i++) {
    await brain.addVerb(
      ids[i],
      'references',
      ids[i + 1],
      0.8
    )
  }
  const relateTime = performance.now() - start5
  console.log(`✅ Create 50 relationships: ${relateTime.toFixed(2)}ms (${(50 / (relateTime / 1000)).toFixed(0)} ops/sec)`)
  
  await brain.close()
  
  return {
    add: addTime,
    get: getTime,
    search: searchTime,
    filter: filterTime,
    relate: relateTime
  }
}

async function benchmarkV3() {
  console.log('\n🚀 Brainy v3 Performance')
  console.log('═'.repeat(50))
  
  const brain = new Brainy({
    storage: { type: 'memory' },
    augmentations: {},
    warmup: false,
    embedder: async () => new Array(384).fill(0).map(() => Math.random())
  })
  await brain.init()
  
  // Test 1: Add operations
  const start1 = performance.now()
  const ids = []
  for (let i = 0; i < ITERATIONS; i++) {
    const id = await brain.add({
      vector: new Array(384).fill(0).map(() => Math.random()),
      type: NounType.Document,
      metadata: { index: i, title: `Doc ${i}` }
    })
    ids.push(id)
  }
  const addTime = performance.now() - start1
  console.log(`✅ Add ${ITERATIONS} items: ${addTime.toFixed(2)}ms (${(ITERATIONS / (addTime / 1000)).toFixed(0)} ops/sec)`)
  
  // Test 2: Get operations
  const start2 = performance.now()
  for (let i = 0; i < Math.min(100, ids.length); i++) {
    await brain.get(ids[i])
  }
  const getTime = performance.now() - start2
  console.log(`✅ Get 100 items: ${getTime.toFixed(2)}ms (${(100 / (getTime / 1000)).toFixed(0)} ops/sec)`)
  
  // Test 3: Search operations
  const start3 = performance.now()
  await brain.find({
    vector: new Array(384).fill(0).map(() => Math.random()),
    limit: 10
  })
  const searchTime = performance.now() - start3
  console.log(`✅ Vector search: ${searchTime.toFixed(2)}ms`)
  
  // Test 4: Metadata filter
  const start4 = performance.now()
  await brain.find({
    where: { 'metadata.index': { $gt: 500 } },
    limit: 10
  })
  const filterTime = performance.now() - start4
  console.log(`✅ Metadata filter: ${filterTime.toFixed(2)}ms`)
  
  // Test 5: Relationship operations
  const start5 = performance.now()
  for (let i = 0; i < 50; i++) {
    await brain.relate({
      source: ids[i],
      verb: VerbType.References,
      target: ids[i + 1],
      weight: 0.8
    })
  }
  const relateTime = performance.now() - start5
  console.log(`✅ Create 50 relationships: ${relateTime.toFixed(2)}ms (${(50 / (relateTime / 1000)).toFixed(0)} ops/sec)`)
  
  // Test 6: Batch operations (v3 exclusive)
  const start6 = performance.now()
  const batchData = Array(BATCH_SIZE).fill(0).map((_, i) => ({
    vector: new Array(384).fill(0).map(() => Math.random()),
    type: NounType.Document,
    metadata: { batch: true, index: i }
  }))
  const batchResult = await brain.addMany({ items: batchData })
  const batchTime = performance.now() - start6
  console.log(`✅ Batch add ${BATCH_SIZE} items: ${batchTime.toFixed(2)}ms (${(BATCH_SIZE / (batchTime / 1000)).toFixed(0)} ops/sec)`)
  console.log(`   Success: ${batchResult.successful.length}, Failed: ${batchResult.failed.length}`)
  
  await brain.close()
  
  return {
    add: addTime,
    get: getTime,
    search: searchTime,
    filter: filterTime,
    relate: relateTime,
    batch: batchTime
  }
}

async function compare() {
  console.log('\n🧠 Brainy Performance Comparison')
  console.log('═'.repeat(50))
  console.log(`Test iterations: ${ITERATIONS}`)
  console.log(`Batch size: ${BATCH_SIZE}`)
  
  const v2Times = await benchmarkV2()
  const v3Times = await benchmarkV3()
  
  console.log('\n📈 Performance Comparison')
  console.log('═'.repeat(50))
  
  const operations = ['add', 'get', 'search', 'filter', 'relate']
  for (const op of operations) {
    const v2 = v2Times[op]
    const v3 = v3Times[op]
    const diff = ((v2 - v3) / v2 * 100).toFixed(1)
    const symbol = v3 < v2 ? '🟢' : v3 > v2 * 1.1 ? '🔴' : '🟡'
    console.log(`${symbol} ${op.padEnd(10)}: v2=${v2.toFixed(2)}ms, v3=${v3.toFixed(2)}ms (${diff > 0 ? '+' : ''}${diff}%)`)
  }
  
  if (v3Times.batch) {
    console.log(`🚀 batch     : v3=${v3Times.batch.toFixed(2)}ms (v3 exclusive feature)`)
  }
  
  console.log('\n✨ Summary')
  console.log('═'.repeat(50))
  const totalV2 = Object.values(v2Times).reduce((a, b) => a + b, 0)
  const totalV3 = Object.values(v3Times).reduce((a, b) => a + b, 0) - (v3Times.batch || 0)
  const improvement = ((totalV2 - totalV3) / totalV2 * 100).toFixed(1)
  
  if (totalV3 < totalV2) {
    console.log(`✅ v3 is ${improvement}% faster overall!`)
  } else {
    console.log(`⚠️ v3 is ${Math.abs(improvement)}% slower (needs optimization)`)
  }
  
  console.log('\n💡 Key Insights:')
  console.log('- v3 adds batch operations for better throughput')
  console.log('- v3 has cleaner, more consistent API')
  console.log('- v3 includes streaming pipeline support')
  console.log('- Both versions use mock embeddings for fair comparison')
}

// Run the benchmark
compare().catch(console.error)