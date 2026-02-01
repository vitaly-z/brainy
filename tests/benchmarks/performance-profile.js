#!/usr/bin/env node

/**
 * Performance Profiling - Measure actual performance of each API method
 * This will help us identify where we lost the claimed 500,000 ops/sec
 */

import { Brainy } from '../../dist/index.js'
import { MemoryStorage } from '../../dist/storage/adapters/memoryStorage.js'

// Performance tracking
class PerformanceProfiler {
  constructor() {
    this.results = {}
  }
  
  async measure(name, fn, iterations = 100) {
    // Warmup
    for (let i = 0; i < 10; i++) {
      await fn()
    }
    
    // Measure
    const start = performance.now()
    for (let i = 0; i < iterations; i++) {
      await fn()
    }
    const end = performance.now()
    
    const totalMs = end - start
    const perOpMs = totalMs / iterations
    const opsPerSec = Math.round(1000 / perOpMs)
    
    this.results[name] = {
      totalMs,
      perOpMs,
      opsPerSec,
      iterations
    }
    
    return { perOpMs, opsPerSec }
  }
  
  report() {
    console.log('\n📊 Performance Profile Results\n')
    console.log('Method                          | ms/op  | ops/sec | Status')
    console.log('--------------------------------|--------|---------|--------')
    
    for (const [name, stats] of Object.entries(this.results)) {
      const status = stats.opsPerSec > 10000 ? '✅' : 
                     stats.opsPerSec > 1000 ? '⚡' : '🐌'
      console.log(
        `${name.padEnd(31)} | ${stats.perOpMs.toFixed(2).padStart(6)} | ${
          stats.opsPerSec.toString().padStart(7)
        } | ${status}`
      )
    }
    
    // Find bottlenecks
    console.log('\n🔍 Bottleneck Analysis\n')
    const sorted = Object.entries(this.results)
      .sort((a, b) => b[1].perOpMs - a[1].perOpMs)
      .slice(0, 5)
    
    console.log('Slowest Operations:')
    for (const [name, stats] of sorted) {
      console.log(`  ${name}: ${stats.perOpMs.toFixed(2)}ms per operation`)
    }
  }
}

async function profilePerformance() {
  console.log('🚀 Starting Performance Profile\n')
  
  const profiler = new PerformanceProfiler()
  
  // Initialize Brainy with different configurations
  console.log('Initializing Brainy configurations...')
  
  // 1. Minimal config
  const minimalBrain = new Brainy({
    storage: new MemoryStorage()
  })
  await minimalBrain.init()

  // 2. Default config
  const defaultBrain = new Brainy({
    storage: new MemoryStorage()
  })
  await defaultBrain.init()

  // 3. Full config
  const fullBrain = new Brainy({
    storage: new MemoryStorage()
  })
  await fullBrain.init()
  
  console.log('✅ All configurations initialized\n')
  
  // Prepare test data
  const testNoun = {
    content: 'Test document with some content for searching',
    title: 'Test Document',
    tags: ['test', 'performance', 'benchmark']
  }
  
  const testMetadata = {
    category: 'benchmark',
    priority: 1
  }
  
  // Store some initial data for search/retrieve tests
  const setupIds = []
  for (let i = 0; i < 100; i++) {
    const id = await defaultBrain.addNoun(
      { ...testNoun, index: i },
      'document',
      { ...testMetadata, index: i }
    )
    setupIds.push(id)
  }
  
  console.log('📝 Testing Core CRUD Operations\n')
  
  // Test 1: addNoun performance
  let nounCounter = 0
  await profiler.measure('addNoun (minimal)', async () => {
    await minimalBrain.addNoun(
      { ...testNoun, id: `perf_min_${nounCounter++}` },
      'document',
      testMetadata
    )
  }, 100)
  
  nounCounter = 0
  await profiler.measure('addNoun (default)', async () => {
    await defaultBrain.addNoun(
      { ...testNoun, id: `perf_def_${nounCounter++}` },
      'document',
      testMetadata
    )
  }, 100)
  
  nounCounter = 0
  await profiler.measure('addNoun (full aug)', async () => {
    await fullBrain.addNoun(
      { ...testNoun, id: `perf_full_${nounCounter++}` },
      'document',
      testMetadata
    )
  }, 100)
  
  // Test 2: getNoun performance
  await profiler.measure('getNoun (default)', async () => {
    await defaultBrain.getNoun(setupIds[Math.floor(Math.random() * setupIds.length)])
  }, 1000)
  
  // Test 3: Search performance
  await profiler.measure('searchText (default)', async () => {
    await defaultBrain.searchText('test document', 10)
  }, 100)
  
  // Test 4: findSimilar performance
  await profiler.measure('findSimilar (default)', async () => {
    await defaultBrain.findSimilar(setupIds[0], 10)
  }, 100)
  
  // Test 5: Verb operations
  let verbCounter = 0
  await profiler.measure('addVerb (default)', async () => {
    const source = setupIds[verbCounter % setupIds.length]
    const target = setupIds[(verbCounter + 1) % setupIds.length]
    await defaultBrain.addVerb({
      source,
      target,
      type: 'RelatedTo',
      weight: Math.random()
    })
    verbCounter++
  }, 100)
  
  console.log('\n🔧 Testing Operation Overhead\n')
  
  // Measure raw storage performance
  const storage = new MemoryStorage()
  await storage.init()
  
  let storageCounter = 0
  await profiler.measure('Raw storage.saveNoun', async () => {
    await storage.saveNoun({
      id: `storage_${storageCounter++}`,
      vector: new Array(384).fill(0),
      connections: new Map(),
      level: 0
    })
  }, 1000)
  
  await profiler.measure('Raw storage.getNoun', async () => {
    await storage.getNoun(`storage_${Math.floor(Math.random() * storageCounter)}`)
  }, 1000)
  
  console.log('\n🧠 Testing Embedding Performance\n')
  
  // Test embedding generation (this is likely the bottleneck)
  const embeddingFunction = defaultBrain.getEmbeddingFunction()
  
  await profiler.measure('Embedding generation', async () => {
    await embeddingFunction('Test text for embedding generation')
  }, 50)  // Only 50 iterations as embeddings are slow
  
  // Test without embeddings (using pre-computed vectors)
  const precomputedVector = new Array(384).fill(0).map(() => Math.random())
  await profiler.measure('addNoun (with vector)', async () => {
    await defaultBrain.addNoun(
      precomputedVector,  // Pass vector directly, skip embedding
      'document',
      { precomputed: true }
    )
  }, 1000)
  
  console.log('\n⚡ Testing Batch Operations\n')
  
  // Test batch performance
  const batchSize = 100
  await profiler.measure(`Batch add (${batchSize} items)`, async () => {
    const promises = []
    for (let i = 0; i < batchSize; i++) {
      promises.push(defaultBrain.addNoun(
        precomputedVector,
        'document',
        { batch: true, index: i }
      ))
    }
    await Promise.all(promises)
  }, 10)  // 10 batches of 100
  
  // Generate report
  profiler.report()
  
  // Analyze where we lost performance
  console.log('\n💡 Performance Loss Analysis\n')
  
  const minimalPerf = profiler.results['addNoun (minimal)']
  const defaultPerf = profiler.results['addNoun (default)']
  const fullPerf = profiler.results['addNoun (full aug)']
  const embedPerf = profiler.results['Embedding generation']
  const vectorPerf = profiler.results['addNoun (with vector)']
  
  console.log('Overhead breakdown:')
  console.log(`  Base operation: ${minimalPerf.perOpMs.toFixed(2)}ms`)
  console.log(`  Default config: +${(defaultPerf.perOpMs - minimalPerf.perOpMs).toFixed(2)}ms`)
  console.log(`  Full config: +${(fullPerf.perOpMs - defaultPerf.perOpMs).toFixed(2)}ms`)
  console.log(`  Embedding generation: ${embedPerf.perOpMs.toFixed(2)}ms`)
  console.log(`  Without embeddings: ${vectorPerf.perOpMs.toFixed(2)}ms`)
  
  const embedOverhead = embedPerf.perOpMs / defaultPerf.perOpMs * 100
  console.log(`\n🎯 Embedding overhead: ${embedOverhead.toFixed(1)}% of total time`)
  
  if (embedOverhead > 80) {
    console.log('❗ Embedding generation is the primary bottleneck')
    console.log('   Solutions:')
    console.log('   1. Use pre-computed embeddings when possible')
    console.log('   2. Batch embedding operations')
    console.log('   3. Use worker threads for parallel processing')
    console.log('   4. Consider lighter embedding models')
  }
  
  // Check if we're achieving claimed performance anywhere
  const maxOpsPerSec = Math.max(...Object.values(profiler.results).map(r => r.opsPerSec))
  console.log(`\n📈 Maximum ops/sec achieved: ${maxOpsPerSec.toLocaleString()}`)
  
  if (maxOpsPerSec < 500000) {
    const gap = ((500000 - maxOpsPerSec) / 500000 * 100).toFixed(1)
    console.log(`📉 Performance gap: ${gap}% below claimed 500,000 ops/sec`)
    console.log('\n🔬 Root Cause:')
    console.log('   The 500,000 ops/sec claim was likely based on:')
    console.log('   1. Fake/stub operations that returned immediately')
    console.log('   2. No actual embedding generation')
    console.log('   3. No real storage operations')
    console.log('   4. Direct operation calls')
    console.log('\n   With real implementations:')
    console.log(`   - Raw storage: ${profiler.results['Raw storage.saveNoun']?.opsPerSec || 'N/A'} ops/sec`)
    console.log(`   - With embeddings: ${defaultPerf.opsPerSec} ops/sec`)
    console.log(`   - Without embeddings: ${vectorPerf.opsPerSec} ops/sec`)
  }
  
  // Cleanup
  await minimalBrain.close()
  await defaultBrain.close()
  await fullBrain.close()
  
  console.log('\n✅ Performance profiling complete!')
}

// Run profiling
profilePerformance().catch(error => {
  console.error('❌ Profiling failed:', error)
  process.exit(1)
})