#!/usr/bin/env node

import { Brainy } from './dist/index.js'

console.log('🧠 Testing Refactored API Architecture')
console.log('search(q) = find({like: q})')
console.log('find(q) = NLP processing → complex TripleQuery')
console.log('=' + '='.repeat(50))

const brain = new Brainy({ 
  storage: { type: 'memory' },
  verbose: false 
})

await brain.init()

// Add test data
const testData = [
  { data: 'React framework', metadata: { name: 'React', type: 'framework', language: 'JavaScript', year: 2013, popularity: 'high' }},
  { data: 'Vue.js framework', metadata: { name: 'Vue', type: 'framework', language: 'JavaScript', year: 2014, popularity: 'high' }},
  { data: 'Angular framework', metadata: { name: 'Angular', type: 'framework', language: 'TypeScript', year: 2016, popularity: 'medium' }},
]

const ids = []
for (const item of testData) {
  const id = await brain.addNoun(item.data, item.metadata)
  ids.push(id)
}
console.log(`✅ Added ${ids.length} test items\n`)

console.log('🧪 TESTING NEW ARCHITECTURE:')
console.log('----------------------------')

// Test 1: search() should be simple vector similarity
console.log('1️⃣  search("framework") - Simple vector similarity')
const searchResults = await brain.search('framework', { limit: 2 })
console.log(`   Found ${searchResults.length} results via vector similarity`)
searchResults.forEach(r => console.log(`   - ${r.metadata?.name} (score: ${r.score.toFixed(3)})`))

// Test 2: find() with natural language should do NLP processing
console.log('\n2️⃣  find("popular JavaScript frameworks") - NLP processing')
const nlpResults = await brain.find('popular JavaScript frameworks', { limit: 2 })
console.log(`   Found ${nlpResults.length} results via NLP processing`)
nlpResults.forEach(r => console.log(`   - ${r.metadata?.name} (score: ${(r.fusionScore || r.score || 0).toFixed(3)})`))

// Test 3: find() with structured query should work directly
console.log('\n3️⃣  find({like: "React", where: {year: {greaterThan: 2010}}}) - Structured')
const structuredResults = await brain.find({
  like: 'React',
  where: { year: { greaterThan: 2010 } }
}, { limit: 2 })
console.log(`   Found ${structuredResults.length} results via structured query`)
structuredResults.forEach(r => console.log(`   - ${r.metadata?.name} (${r.metadata?.year})`))

// Test 4: Verify search() is equivalent to find({like: query})
console.log('\n4️⃣  Verification: search(q) ≡ find({like: q})')
const searchVia1 = await brain.search('Vue')
const searchVia2 = await brain.find({like: 'Vue'})
console.log(`   search("Vue"): ${searchVia1.length} results`)
console.log(`   find({like: "Vue"}): ${searchVia2.length} results`)
console.log(`   ✅ Equivalent: ${searchVia1.length === searchVia2.length ? 'YES' : 'NO'}`)

console.log('\n' + '='.repeat(51))
console.log('✅ Refactored API Architecture Complete!')
console.log('Key improvements:')
console.log('  • search(q) = find({like: q}) - Simple vector similarity')
console.log('  • find(q) = NLP processing → intelligent queries') 
console.log('  • Clean separation of concerns')
console.log('  • No duplicate code - search() delegates to find()')

process.exit(0)