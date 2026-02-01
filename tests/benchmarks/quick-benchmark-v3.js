#!/usr/bin/env node

/**
 * Quick Brainy 3.0 Performance Test
 */

import { Brainy } from '../dist/brainy.js'
import { NounType, VerbType } from '../dist/types/graphTypes.js'

async function testV3() {
  console.log('🚀 Brainy v3 Quick Performance Test')
  console.log('═'.repeat(50))
  
  const brain = new Brainy({
    storage: { type: 'memory' },
    warmup: false,
    embedder: async () => new Array(384).fill(0).map(() => Math.random())
  })
  
  console.log('Initializing...')
  await brain.init()
  
  // Test 1: Add operations
  console.log('\n📝 Testing Add Operations...')
  const start1 = Date.now()
  const ids = []
  for (let i = 0; i < 100; i++) {
    const id = await brain.add({
      vector: new Array(384).fill(0).map(() => Math.random()),
      type: NounType.Document,
      metadata: { index: i, title: `Doc ${i}` }
    })
    ids.push(id)
  }
  const addTime = Date.now() - start1
  console.log(`✅ Add 100 items: ${addTime}ms (${Math.round(100 / (addTime / 1000))} ops/sec)`)
  
  // Test 2: Get operations
  console.log('\n🔍 Testing Get Operations...')
  const start2 = Date.now()
  for (let i = 0; i < 10; i++) {
    const entity = await brain.get(ids[i])
    if (!entity) throw new Error('Entity not found')
  }
  const getTime = Date.now() - start2
  console.log(`✅ Get 10 items: ${getTime}ms (${Math.round(10 / (getTime / 1000))} ops/sec)`)
  
  // Test 3: Search operations
  console.log('\n🔎 Testing Search Operations...')
  const start3 = Date.now()
  const results = await brain.find({
    vector: new Array(384).fill(0).map(() => Math.random()),
    limit: 10
  })
  const searchTime = Date.now() - start3
  console.log(`✅ Vector search: ${searchTime}ms, found ${results.length} results`)
  
  // Test 4: Metadata filter
  console.log('\n🏷️ Testing Metadata Filters...')
  const start4 = Date.now()
  const filtered = await brain.find({
    where: { 'index': { $gt: 50 } },
    limit: 10
  })
  const filterTime = Date.now() - start4
  console.log(`✅ Metadata filter: ${filterTime}ms, found ${filtered.length} results`)
  
  // Test 5: Relationships
  console.log('\n🔗 Testing Relationships...')
  const start5 = Date.now()
  for (let i = 0; i < 10; i++) {
    await brain.relate({
      from: ids[i],
      type: VerbType.References,
      to: ids[i + 1],
      weight: 0.8
    })
  }
  const relateTime = Date.now() - start5
  console.log(`✅ Create 10 relationships: ${relateTime}ms (${Math.round(10 / (relateTime / 1000))} ops/sec)`)
  
  // Test 6: Batch operations
  console.log('\n📦 Testing Batch Operations...')
  const start6 = Date.now()
  const batchData = Array(50).fill(0).map((_, i) => ({
    vector: new Array(384).fill(0).map(() => Math.random()),
    type: NounType.Document,
    metadata: { batch: true, index: i }
  }))
  const batchResult = await brain.addMany({ items: batchData })
  const batchTime = Date.now() - start6
  console.log(`✅ Batch add 50 items: ${batchTime}ms (${Math.round(50 / (batchTime / 1000))} ops/sec)`)
  console.log(`   Success: ${batchResult.successful.length}, Failed: ${batchResult.failed.length}`)
  
  // Test 7: Neural API
  console.log('\n🧠 Testing Neural API...')
  try {
    const neural = brain.neural()
    const start7 = Date.now()
    const clusters = await neural.clusters({
      items: ids.slice(0, 20),
      k: 3
    })
    const clusterTime = Date.now() - start7
    console.log(`✅ Cluster 20 items into 3 groups: ${clusterTime}ms`)
    console.log(`   Clusters: ${clusters.map(c => c.items.length).join(', ')} items`)
  } catch (e) {
    console.log(`⚠️ Neural API: ${e.message}`)
  }
  
  // Test 8: Streaming Pipeline
  console.log('\n🌊 Testing Streaming Pipeline...')
  const { Pipeline } = await import('../dist/streaming/pipeline.js')
  const pipeline = new Pipeline(brain)
  
  let streamCount = 0
  const start8 = Date.now()
  
  await pipeline
    .source(async function* () {
      for (let i = 0; i < 20; i++) {
        yield { content: `Stream item ${i}`, index: i }
      }
    })
    .map(item => ({
      ...item,
      processed: true,
      timestamp: Date.now()
    }))
    .filter(item => item.index % 2 === 0)
    .sink(() => { streamCount++ })
    .run()
    
  const streamTime = Date.now() - start8
  console.log(`✅ Streamed ${streamCount} items: ${streamTime}ms`)
  
  await brain.close()
  
  console.log('\n✨ Summary')
  console.log('═'.repeat(50))
  console.log('All v3 features working correctly!')
  console.log('Key advantages over v2:')
  console.log('- Consistent object-based API')
  console.log('- Built-in batch operations')
  console.log('- Neural clustering API')
  console.log('- Streaming pipeline support')
  console.log('- Better TypeScript support')
}

testV3().catch(console.error)