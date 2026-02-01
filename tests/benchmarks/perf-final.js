#!/usr/bin/env node

/**
 * Final Performance Benchmark for Brainy v3
 */

import { Brainy } from '../dist/brainy.js'
import { NounType, VerbType } from '../dist/types/graphTypes.js'

// Mock embedder - no model overhead for pure performance testing
const mockEmbedder = async () => new Array(384).fill(0).map(() => Math.random())

async function runBenchmark() {
  console.log('🧠 Brainy v3 Performance Benchmark')
  console.log('═'.repeat(60))
  
  const brain = new Brainy({
    storage: { type: 'memory' },
    embedder: mockEmbedder,
    warmup: false
  })
  
  console.log('Initializing Brainy v3...')
  await brain.init()
  
  // Pre-generate test data
  const vectors = []
  for (let i = 0; i < 10000; i++) {
    vectors.push(new Array(384).fill(0).map(() => Math.random()))
  }
  
  const results = {}
  const ids = []
  
  // TEST 1: Single Add Operations
  console.log('\n📝 Write Performance Tests')
  console.log('─'.repeat(60))
  
  let start = Date.now()
  for (let i = 0; i < 1000; i++) {
    const id = await brain.add({
      vector: vectors[i],
      type: NounType.Document,
      metadata: { index: i, test: 'performance' }
    })
    ids.push(id)
  }
  let elapsed = Date.now() - start
  results.singleAdd = Math.round(1000 / (elapsed / 1000))
  console.log(`Single Add (1000 items)     : ${results.singleAdd.toLocaleString().padStart(10)} ops/sec`)
  
  // TEST 2: Batch Add Operations
  const batchItems = []
  for (let i = 1000; i < 2000; i++) {
    batchItems.push({
      vector: vectors[i],
      type: NounType.Document,
      metadata: { index: i, batch: true }
    })
  }
  
  start = Date.now()
  const batchResult = await brain.addMany({ items: batchItems, parallel: true })
  elapsed = Date.now() - start
  results.batchAdd = Math.round(1000 / (elapsed / 1000))
  console.log(`Batch Add (1000 items)      : ${results.batchAdd.toLocaleString().padStart(10)} ops/sec`)
  ids.push(...batchResult.successful)
  
  // TEST 3: Get Operations
  console.log('\n🔍 Read Performance Tests')
  console.log('─'.repeat(60))
  
  start = Date.now()
  for (let i = 0; i < 100; i++) {
    await brain.get(ids[i])
  }
  elapsed = Date.now() - start
  results.get = Math.round(100 / (elapsed / 1000))
  console.log(`Get by ID (100 items)       : ${results.get.toLocaleString().padStart(10)} ops/sec`)
  
  // TEST 4: Vector Search
  start = Date.now()
  for (let i = 0; i < 100; i++) {
    await brain.find({
      vector: vectors[3000 + i],
      limit: 10
    })
  }
  elapsed = Date.now() - start
  results.vectorSearch = Math.round(100 / (elapsed / 1000))
  console.log(`Vector Search (100 queries) : ${results.vectorSearch.toLocaleString().padStart(10)} ops/sec`)
  
  // TEST 5: Metadata Filtering
  start = Date.now()
  for (let i = 0; i < 10; i++) {
    await brain.find({
      where: { index: { $gt: i * 100 } },
      limit: 50
    })
  }
  elapsed = Date.now() - start
  results.metadataFilter = Math.round(10 / (elapsed / 1000))
  console.log(`Metadata Filter (10 queries): ${results.metadataFilter.toLocaleString().padStart(10)} ops/sec`)
  
  // TEST 6: Relationships
  console.log('\n🔗 Relationship Performance')
  console.log('─'.repeat(60))
  
  start = Date.now()
  for (let i = 0; i < 100; i++) {
    await brain.relate({
      from: ids[i],
      to: ids[i + 1],
      type: VerbType.References,
      weight: 0.8
    })
  }
  elapsed = Date.now() - start
  results.relate = Math.round(100 / (elapsed / 1000))
  console.log(`Create Relations (100)      : ${results.relate.toLocaleString().padStart(10)} ops/sec`)
  
  // TEST 7: Delete Operations
  start = Date.now()
  for (let i = 0; i < 100; i++) {
    await brain.delete(ids[1900 + i])
  }
  elapsed = Date.now() - start
  results.delete = Math.round(100 / (elapsed / 1000))
  console.log(`Delete (100 items)          : ${results.delete.toLocaleString().padStart(10)} ops/sec`)
  
  // Get insights
  const insights = await brain.insights()
  
  console.log('\n📊 Database Statistics')
  console.log('─'.repeat(60))
  console.log(`Total Entities              : ${insights.entities.toLocaleString().padStart(10)}`)
  console.log(`Total Relationships         : ${insights.relationships.toLocaleString().padStart(10)}`)
  console.log(`Entity Types                : ${Object.keys(insights.types).length}`)
  
  // Memory usage
  const mem = process.memoryUsage()
  console.log('\n💾 Memory Usage')
  console.log('─'.repeat(60))
  console.log(`Heap Used                   : ${Math.round(mem.heapUsed / 1024 / 1024).toLocaleString().padStart(10)} MB`)
  console.log(`Total Memory (RSS)          : ${Math.round(mem.rss / 1024 / 1024).toLocaleString().padStart(10)} MB`)
  console.log(`Per Entity                  : ${Math.round(mem.heapUsed / insights.entities).toLocaleString().padStart(10)} bytes`)
  
  // Comparison with competitors
  console.log('\n🏆 Performance vs Competition')
  console.log('═'.repeat(60))
  console.log('Operation       | Brainy v3  | Industry Best | Status')
  console.log('─'.repeat(60))
  
  const comparisons = [
    ['Write/sec', results.batchAdd, 3000, 'Qdrant'],
    ['Query/sec', results.vectorSearch, 500, 'Qdrant'],
    ['Get/sec', results.get, 10000, 'Redis'],
    ['Filter/sec', results.metadataFilter, 1000, 'MongoDB']
  ]
  
  for (const [op, ourPerf, bestPerf, competitor] of comparisons) {
    const status = ourPerf >= bestPerf ? '✅ BEST' : ourPerf >= bestPerf * 0.8 ? '🟡 GOOD' : '🔴 SLOW'
    const ratio = ((ourPerf / bestPerf) * 100).toFixed(0)
    console.log(
      `${op.padEnd(15)} | ${ourPerf.toLocaleString().padStart(10)} | ${bestPerf.toLocaleString().padStart(10)} | ${status} (${ratio}% of ${competitor})`
    )
  }
  
  // Calculate overall score
  const avgPerformance = (results.batchAdd + results.vectorSearch + results.get) / 3
  
  console.log('\n📈 Overall Assessment')
  console.log('═'.repeat(60))
  
  if (avgPerformance > 5000) {
    console.log('🏆 ELITE PERFORMANCE - Best in class!')
  } else if (avgPerformance > 3000) {
    console.log('✅ EXCELLENT PERFORMANCE - Competitive with industry leaders')
  } else if (avgPerformance > 1000) {
    console.log('🟡 GOOD PERFORMANCE - Suitable for most use cases')
  } else {
    console.log('🔴 NEEDS OPTIMIZATION - Below industry standards')
  }
  
  console.log(`\nAverage ops/sec: ${Math.round(avgPerformance).toLocaleString()}`)
  
  // Specific strengths
  console.log('\n💪 Key Strengths:')
  if (results.get > 10000) console.log('  • Ultra-fast direct access')
  if (results.batchAdd > 5000) console.log('  • Excellent batch processing')
  if (results.vectorSearch > 1000) console.log('  • High-performance vector search')
  if (mem.heapUsed / insights.entities < 1000) console.log('  • Memory efficient storage')
  
  await brain.close()
}

runBenchmark().catch(console.error)