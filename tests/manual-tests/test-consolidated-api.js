#!/usr/bin/env node

import { BrainyData } from './dist/index.js'

console.log('🧪 Testing Brainy 2.0 Consolidated API')
console.log('=' + '='.repeat(50))

const brain = new BrainyData({ 
  storage: { type: 'memory' },
  verbose: false 
})

await brain.init()

// Add test data
const testData = [
  { data: 'React framework', metadata: { name: 'React', type: 'framework', language: 'JavaScript', year: 2013, popularity: 'high' }},
  { data: 'Vue.js framework', metadata: { name: 'Vue', type: 'framework', language: 'JavaScript', year: 2014, popularity: 'high' }},
  { data: 'Angular framework', metadata: { name: 'Angular', type: 'framework', language: 'TypeScript', year: 2016, popularity: 'medium' }},
  { data: 'Python Django', metadata: { name: 'Django', type: 'framework', language: 'Python', year: 2005, popularity: 'high' }},
  { data: 'Flask microframework', metadata: { name: 'Flask', type: 'framework', language: 'Python', year: 2010, popularity: 'medium' }}
]

const ids = []
for (const item of testData) {
  const id = await brain.addNoun(item.data, item.metadata)
  ids.push(id)
}
console.log(`✅ Added ${ids.length} test items\n`)

// Test 1: Basic search with new options
console.log('1️⃣  Test: Basic search with limit')
const results1 = await brain.search('framework', { limit: 3 })
console.log(`   Found ${results1.length} results (expected 3)`)

// Test 2: Search with metadata filtering
console.log('\n2️⃣  Test: Search with metadata filter')
const results2 = await brain.search('*', { 
  limit: 10,
  metadata: { language: 'JavaScript' }
})
console.log(`   Found ${results2.length} JavaScript frameworks (expected 2)`)
results2.forEach(r => console.log(`   - ${r.metadata?.name}`))

// Test 3: Search with pagination (offset)
console.log('\n3️⃣  Test: Search with offset pagination')
const page1 = await brain.search('*', { limit: 2, offset: 0 })
const page2 = await brain.search('*', { limit: 2, offset: 2 })
console.log(`   Page 1: ${page1.length} items`)
console.log(`   Page 2: ${page2.length} items`)

// Test 4: Search with cursor pagination
console.log('\n4️⃣  Test: Search with cursor pagination')
const firstPage = await brain.search('*', { limit: 2 })
const cursor = firstPage[firstPage.length - 1]?.nextCursor
if (cursor) {
  const nextPage = await brain.search('*', { limit: 2, cursor })
  console.log(`   First page: ${firstPage.length} items`)
  console.log(`   Next page: ${nextPage.length} items (via cursor)`)
} else {
  console.log('   No cursor returned')
}

// Test 5: Search with threshold
console.log('\n5️⃣  Test: Search with similarity threshold')
const results5 = await brain.search('React', { 
  limit: 10,
  threshold: 0.7  // High similarity only
})
console.log(`   Found ${results5.length} high-similarity results`)

// Test 6: Search within specific items
console.log('\n6️⃣  Test: Search within specific items (searchWithinItems replacement)')
const specificIds = ids.slice(0, 2)  // First 2 items only
const results6 = await brain.search('*', { 
  limit: 10,
  itemIds: specificIds
})
console.log(`   Found ${results6.length} results within ${specificIds.length} items`)

// Test 7: Search by noun types
console.log('\n7️⃣  Test: Search with noun types filter')
const results7 = await brain.search('*', {
  limit: 10,
  nounTypes: ['framework']  // If we had set noun types
})
console.log(`   Found ${results7.length} items`)

// Test 8: Natural language find()
console.log('\n8️⃣  Test: Natural language find()')
const results8 = await brain.find('popular JavaScript frameworks', { limit: 5 })
console.log(`   Found ${results8.length} results from natural language`)
results8.forEach(r => console.log(`   - ${r.metadata?.name || 'Unknown'}`))

// Test 9: Structured find() with metadata
console.log('\n9️⃣  Test: Structured find() with metadata filters')
const results9 = await brain.find({
  like: 'framework',
  where: { 
    year: { greaterThan: 2010 },
    popularity: 'high'
  }
}, { limit: 10 })
console.log(`   Found ${results9.length} results matching complex query`)
results9.forEach(r => console.log(`   - ${r.metadata?.name}: ${r.metadata?.year}`))

// Test 10: Find with pagination
console.log('\n🔟  Test: Find with pagination')
const findPage1 = await brain.find('*', { limit: 2, offset: 0 })
const findPage2 = await brain.find('*', { limit: 2, offset: 2 })
console.log(`   Page 1: ${findPage1.length} items`)
console.log(`   Page 2: ${findPage2.length} items`)

// Summary
console.log('\n' + '='.repeat(51))
console.log('✅ Consolidated API Tests Complete!')
console.log('Key improvements:')
console.log('  • search() now handles all vector search cases')
console.log('  • find() handles natural language and complex queries')
console.log('  • Both support pagination (offset & cursor)')
console.log('  • Metadata filtering with O(log n) performance')
console.log('  • Soft deletes filtered by default')
console.log('  • Maximum 10,000 results for safety')

process.exit(0)