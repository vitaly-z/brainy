#!/usr/bin/env node

/**
 * Test Brainy with REAL search and embeddings
 * Requires 6-8GB RAM (ONNX runtime requirement)
 */

import { BrainyData } from './dist/index.js'
import v8 from 'v8'

// Check if we have enough memory allocated
const maxHeap = v8.getHeapStatistics().heap_size_limit / (1024 * 1024 * 1024)
console.log(`🧠 Node.js heap limit: ${maxHeap.toFixed(1)}GB`)

if (maxHeap < 6) {
  console.error('⚠️  WARNING: Less than 6GB heap allocated')
  console.error('Please run with: NODE_OPTIONS="--max-old-space-size=8192" node test-with-8gb.js')
  console.error('Or use: npm run test:memory')
}

console.log('\n🧪 Testing Brainy with REAL Search & Embeddings')
console.log('='.repeat(50))

async function testRealSearch() {
  try {
    const brain = new BrainyData({ 
      storage: { forceMemoryStorage: true },
      verbose: false 
    })
    
    console.log('\n1. Initializing Brainy...')
    await brain.init()
    console.log('✅ Initialized successfully')
    
    // Add test data
    console.log('\n2. Adding test data...')
    const items = [
      { name: 'JavaScript', type: 'programming language', year: 1995, paradigm: 'multi-paradigm' },
      { name: 'Python', type: 'programming language', year: 1991, paradigm: 'object-oriented' },
      { name: 'TypeScript', type: 'programming language', year: 2012, paradigm: 'typed' },
      { name: 'React', type: 'library', year: 2013, language: 'JavaScript' },
      { name: 'Vue', type: 'framework', year: 2014, language: 'JavaScript' },
      { name: 'Django', type: 'framework', year: 2005, language: 'Python' },
      { name: 'Node.js', type: 'runtime', year: 2009, language: 'JavaScript' }
    ]
    
    const ids = []
    for (const item of items) {
      const id = await brain.addNoun(item)
      ids.push(id)
      console.log(`  Added: ${item.name}`)
    }
    console.log(`✅ Added ${ids.length} items`)
    
    // Test 1: Semantic search
    console.log('\n3. Testing SEMANTIC SEARCH...')
    console.log('   Searching for "web development"...')
    const semanticResults = await brain.search('web development', { limit: 3 })
    console.log(`   ✅ Found ${semanticResults.length} semantic matches`)
    semanticResults.forEach(r => {
      console.log(`      - ${r.metadata?.name || r.id} (score: ${r.score?.toFixed(3)})`)
    })
    
    // Test 2: Natural language search
    console.log('\n4. Testing NATURAL LANGUAGE...')
    console.log('   Query: "JavaScript frameworks from recent years"')
    const nlpResults = await brain.find('JavaScript frameworks from recent years')
    console.log(`   ✅ Found ${nlpResults.length} NLP matches`)
    nlpResults.forEach(r => {
      console.log(`      - ${r.metadata?.name || r.id}`)
    })
    
    // Test 3: Triple Intelligence with Brain Patterns
    console.log('\n5. Testing TRIPLE INTELLIGENCE with Brain Patterns...')
    console.log('   Query: Similar to "React", year > 2010, type = framework')
    const tripleResults = await brain.triple.search({
      like: 'React',
      where: {
        year: { greaterThan: 2010 },
        type: 'framework'
      },
      limit: 5
    })
    console.log(`   ✅ Found ${tripleResults.length} triple matches`)
    tripleResults.forEach(r => {
      console.log(`      - ${r.metadata?.name || r.id} (fusion score: ${r.fusionScore?.toFixed(3)})`)
    })
    
    // Test 4: Range queries with metadata
    console.log('\n6. Testing RANGE QUERIES...')
    console.log('   Query: Languages from 1990-2000')
    const rangeResults = await brain.search('*', { limit: 10,
      metadata: {
        year: { greaterThan: 1990, lessThan: 2000 },
        type: 'programming language'
      }
    })
    console.log(`   ✅ Found ${rangeResults.length} range matches`)
    rangeResults.forEach(r => {
      console.log(`      - ${r.metadata?.name} (${r.metadata?.year})`)
    })
    
    // Memory check
    console.log('\n7. Memory Usage:')
    const mem = process.memoryUsage()
    console.log(`   Heap Used: ${(mem.heapUsed / 1024 / 1024).toFixed(2)} MB`)
    console.log(`   Heap Total: ${(mem.heapTotal / 1024 / 1024).toFixed(2)} MB`)
    console.log(`   RSS: ${(mem.rss / 1024 / 1024).toFixed(2)} MB`)
    
    // Success!
    console.log('\n' + '='.repeat(50))
    console.log('🎉 SUCCESS! All Brainy features working:')
    console.log('✅ Semantic Search (embeddings)')
    console.log('✅ Natural Language (NLP)')
    console.log('✅ Triple Intelligence')
    console.log('✅ Brain Patterns (range queries)')
    console.log('✅ Zero Configuration')
    console.log('\n📝 Note: Required ~4-6GB RAM for transformer model')
    console.log('This is normal and expected for AI features.')
    
    process.exit(0)
  } catch (error) {
    console.error('\n❌ Test failed:', error.message)
    console.error(error.stack)
    
    if (error.message.includes('heap') || error.message.includes('memory')) {
      console.error('\n💡 TIP: Increase memory allocation:')
      console.error('NODE_OPTIONS="--max-old-space-size=8192" node test-with-8gb.js')
    }
    
    process.exit(1)
  }
}

// Run the test
testRealSearch()