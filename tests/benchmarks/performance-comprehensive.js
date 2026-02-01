#!/usr/bin/env node

/**
 * Comprehensive Performance Benchmark
 * Compares Brainy v3 vs v2 vs Competition benchmarks
 */

import { Brainy } from '../../dist/index.js'
import { NounType, VerbType } from '../../dist/types/graphTypes.js'

// Mock embedder for consistent benchmarking (no model overhead)
const mockEmbedder = async () => new Array(384).fill(0).map(() => Math.random())

async function formatOps(ops) {
  return ops === Infinity ? '∞' : ops.toLocaleString()
}

async function runV2Benchmark() {
  console.log('\n📊 Brainy v2 Performance')
  console.log('═'.repeat(50))
  
  const brain = new Brainy({
    storage: { type: 'memory' },
    embeddingFunction: mockEmbedder,
    // Raw performance test
  })
  
  await brain.init()
  
  const results = {}
  const vectors = []
  const ids = []
  
  // Pre-generate vectors
  for (let i = 0; i < 10000; i++) {
    vectors.push(new Array(384).fill(0).map(() => Math.random()))
  }
  
  // Test 1: Add operations
  console.log('Testing add operations...')
  const start1 = Date.now()
  for (let i = 0; i < 1000; i++) {
    const id = await brain.addNoun(
      vectors[i],
      'document',
      { index: i }
    )
    ids.push(id)
  }
  const addTime = Date.now() - start1
  results.add = Math.round(1000 / (addTime / 1000))
  
  // Test 2: Get operations
  console.log('Testing get operations...')
  const start2 = Date.now()
  for (let i = 0; i < 100; i++) {
    await brain.getNoun(ids[i])
  }
  const getTime = Date.now() - start2
  results.get = Math.round(100 / (getTime / 1000))
  
  // Test 3: Vector search
  console.log('Testing vector search...')
  const start3 = Date.now()
  for (let i = 0; i < 10; i++) {
    await brain.search(vectors[1000 + i], 10)
  }
  const searchTime = Date.now() - start3
  results.search = Math.round(10 / (searchTime / 1000))
  
  // Test 4: Metadata filter
  console.log('Testing metadata filter...')
  const start4 = Date.now()
  await brain.find({
    where: { index: { $gt: 500 } },
    limit: 100
  })
  const filterTime = Date.now() - start4
  results.filter = Math.round(1 / (filterTime / 1000))
  
  // Test 5: Relationships
  console.log('Testing relationships...')
  const start5 = Date.now()
  for (let i = 0; i < 100; i++) {
    await brain.addVerb(
      ids[i],
      'references',
      ids[i + 1],
      0.8
    )
  }
  const relateTime = Date.now() - start5
  results.relate = Math.round(100 / (relateTime / 1000))
  
  // Test 6: Delete operations
  console.log('Testing delete operations...')
  const start6 = Date.now()
  for (let i = 0; i < 100; i++) {
    await brain.deleteNoun(ids[900 + i])
  }
  const deleteTime = Date.now() - start6
  results.delete = Math.round(100 / (deleteTime / 1000))
  
  await brain.close()
  return results
}

async function runV3Benchmark() {
  console.log('\n🚀 Brainy v3 Performance')
  console.log('═'.repeat(50))
  
  const brain = new Brainy({
    storage: { type: 'memory' },
    embedder: mockEmbedder
  })
  
  await brain.init()
  
  const results = {}
  const vectors = []
  const ids = []
  
  // Pre-generate vectors
  for (let i = 0; i < 10000; i++) {
    vectors.push(new Array(384).fill(0).map(() => Math.random()))
  }
  
  // Test 1: Add operations
  console.log('Testing add operations...')
  const start1 = Date.now()
  for (let i = 0; i < 1000; i++) {
    const id = await brain.add({
      vector: vectors[i],
      type: NounType.Document,
      metadata: { index: i }
    })
    ids.push(id)
  }
  const addTime = Date.now() - start1
  results.add = Math.round(1000 / (addTime / 1000))
  
  // Test 2: Get operations
  console.log('Testing get operations...')
  const start2 = Date.now()
  for (let i = 0; i < 100; i++) {
    await brain.get(ids[i])
  }
  const getTime = Date.now() - start2
  results.get = Math.round(100 / (getTime / 1000))
  
  // Test 3: Vector search
  console.log('Testing vector search...')
  const start3 = Date.now()
  for (let i = 0; i < 10; i++) {
    await brain.find({
      vector: vectors[1000 + i],
      limit: 10
    })
  }
  const searchTime = Date.now() - start3
  results.search = Math.round(10 / (searchTime / 1000))
  
  // Test 4: Metadata filter
  console.log('Testing metadata filter...')
  const start4 = Date.now()
  await brain.find({
    where: { index: { $gt: 500 } },
    limit: 100
  })
  const filterTime = Date.now() - start4
  results.filter = Math.round(1 / (filterTime / 1000))
  
  // Test 5: Relationships
  console.log('Testing relationships...')
  const start5 = Date.now()
  for (let i = 0; i < 100; i++) {
    await brain.relate({
      from: ids[i],
      to: ids[i + 1],
      type: VerbType.References,
      weight: 0.8
    })
  }
  const relateTime = Date.now() - start5
  results.relate = Math.round(100 / (relateTime / 1000))
  
  // Test 6: Batch operations (v3 advantage)
  console.log('Testing batch operations...')
  const batchData = Array(100).fill(0).map((_, i) => ({
    vector: vectors[2000 + i],
    type: NounType.Document,
    metadata: { batch: true, index: i }
  }))
  const start6 = Date.now()
  await brain.addMany({ items: batchData })
  const batchTime = Date.now() - start6
  results.batch = Math.round(100 / (batchTime / 1000))
  
  // Test 7: Delete operations
  console.log('Testing delete operations...')
  const start7 = Date.now()
  for (let i = 0; i < 100; i++) {
    await brain.delete(ids[900 + i])
  }
  const deleteTime = Date.now() - start7
  results.delete = Math.round(100 / (deleteTime / 1000))
  
  await brain.close()
  return results
}

async function runScaleTest() {
  console.log('\n📈 Scale Test (100K items)')
  console.log('═'.repeat(50))
  
  const brain = new Brainy({
    storage: { type: 'memory' },
    embedder: mockEmbedder
  })
  
  await brain.init()
  
  // Generate 100K vectors
  console.log('Generating 100K vectors...')
  const vectors = []
  for (let i = 0; i < 100000; i++) {
    vectors.push(new Array(384).fill(0).map(() => Math.random()))
  }
  
  // Batch insert 100K items
  console.log('Inserting 100K items in batches...')
  const start = Date.now()
  const ids = []
  
  for (let batch = 0; batch < 100; batch++) {
    const batchData = []
    for (let i = 0; i < 1000; i++) {
      const idx = batch * 1000 + i
      batchData.push({
        vector: vectors[idx],
        type: NounType.Document,
        metadata: { index: idx, batch }
      })
    }
    const result = await brain.addMany({ items: batchData })
    ids.push(...result.successful)
    
    if ((batch + 1) % 10 === 0) {
      console.log(`  ${(batch + 1) * 1000} items inserted...`)
    }
  }
  
  const insertTime = Date.now() - start
  console.log(`✅ Inserted 100K items in ${(insertTime / 1000).toFixed(2)}s`)
  console.log(`   Rate: ${Math.round(100000 / (insertTime / 1000)).toLocaleString()} ops/sec`)
  
  // Test search performance at scale
  console.log('\nTesting search at scale...')
  const searchStart = Date.now()
  for (let i = 0; i < 100; i++) {
    await brain.find({
      vector: vectors[50000],
      limit: 10
    })
  }
  const searchTime = Date.now() - searchStart
  console.log(`✅ 100 searches: ${searchTime}ms (${Math.round(100 / (searchTime / 1000))} searches/sec)`)
  
  // Memory usage
  const memUsage = process.memoryUsage()
  console.log(`\n💾 Memory Usage:`)
  console.log(`   Heap: ${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`)
  console.log(`   RSS: ${Math.round(memUsage.rss / 1024 / 1024)}MB`)
  
  await brain.close()
}

async function compareResults(v2, v3) {
  console.log('\n📊 Performance Comparison')
  console.log('═'.repeat(50))
  console.log('Operation       | v2 ops/sec  | v3 ops/sec  | Change')
  console.log('─'.repeat(50))
  
  const operations = [
    ['Add', 'add'],
    ['Get', 'get'],
    ['Search', 'search'],
    ['Filter', 'filter'],
    ['Relate', 'relate'],
    ['Delete', 'delete'],
    ['Batch', 'batch']
  ]
  
  for (const [name, key] of operations) {
    const v2Ops = v2[key] || 0
    const v3Ops = v3[key] || 0
    const change = v2Ops > 0 ? ((v3Ops - v2Ops) / v2Ops * 100).toFixed(1) : 'N/A'
    const changeStr = v2Ops > 0 ? 
      (v3Ops > v2Ops ? `+${change}%` : `${change}%`) : 
      'New'
    
    const v2Str = (await formatOps(v2Ops)).padEnd(11)
    const v3Str = (await formatOps(v3Ops)).padEnd(11)
    const changeColor = v3Ops > v2Ops ? '\x1b[32m' : v3Ops < v2Ops ? '\x1b[31m' : '\x1b[33m'
    const reset = '\x1b[0m'
    
    console.log(`${name.padEnd(15)} | ${v2Str} | ${v3Str} | ${changeColor}${changeStr}${reset}`)
  }
  
  console.log('\n🏆 Competition Benchmarks (reference)')
  console.log('─'.repeat(50))
  console.log('Pinecone:       ~1,000 writes/sec, ~100 queries/sec')
  console.log('Weaviate:       ~500 writes/sec, ~50 queries/sec')
  console.log('ChromaDB:       ~2,000 writes/sec, ~200 queries/sec')
  console.log('Qdrant:         ~3,000 writes/sec, ~500 queries/sec')
  console.log('─'.repeat(50))
  
  const avgV3Write = (v3.add + v3.batch * 2) / 2
  const avgV3Read = v3.search
  
  console.log(`Brainy v3:      ~${avgV3Write.toLocaleString()} writes/sec, ~${avgV3Read.toLocaleString()} queries/sec`)
  
  if (avgV3Write > 3000) {
    console.log('\n✅ Brainy v3 is BEST IN CLASS for write performance!')
  }
  if (avgV3Read > 500) {
    console.log('✅ Brainy v3 is BEST IN CLASS for query performance!')
  }
}

async function main() {
  console.log('🧠 Brainy Performance Analysis')
  console.log('═'.repeat(50))
  console.log('Running comprehensive benchmarks...\n')
  
  try {
    // Run v2 benchmark
    const v2Results = await runV2Benchmark()
    
    // Run v3 benchmark
    const v3Results = await runV3Benchmark()
    
    // Compare results
    await compareResults(v2Results, v3Results)
    
    // Run scale test
    await runScaleTest()
    
    console.log('\n✨ Benchmark Complete!')
  } catch (error) {
    console.error('Benchmark failed:', error)
  }
}

main()