#!/usr/bin/env node

import { Brainy } from './dist/index.js'

const brain = new Brainy({ 
  storage: { type: 'memory' },
  verbose: false 
})

await brain.init()

// Add test data like the unit test
const items = [
  { data: 'Flask framework', metadata: { name: 'Flask', type: 'framework', language: 'Python', year: 2010 }},
  { data: 'Django framework', metadata: { name: 'Django', type: 'framework', language: 'Python', year: 2005 }},
  { data: 'Express framework', metadata: { name: 'Express', type: 'framework', language: 'JavaScript', year: 2010 }},
  { data: 'FastAPI framework', metadata: { name: 'FastAPI', type: 'framework', language: 'Python', year: 2018 }}
]

console.log('Adding 4 items...')
for (const item of items) {
  await brain.addNoun(item.data, item.metadata)
}

console.log('\nTest 1: Search with wildcard, no filter')
const all = await brain.search('*', 10)
console.log(`  Found ${all.length} items`)

console.log('\nTest 2: Search with wildcard + metadata filter')
const pythonFrameworks = await brain.search('*', 10, {
  metadata: { 
    type: 'framework',
    language: 'Python'
  }
})
console.log(`  Found ${pythonFrameworks.length} items (expected 3)`)
pythonFrameworks.forEach(item => {
  console.log(`    - ${item.metadata?.name}: type=${item.metadata?.type}, language=${item.metadata?.language}`)
})

console.log('\nTest 3: Direct metadata index check')
const metadataIndex = brain.metadataIndex
if (metadataIndex) {
  const ids = await metadataIndex.getIdsForFilter({
    type: 'framework',
    language: 'Python'
  })
  console.log(`  MetadataIndex found ${ids.length} matching IDs`)
}

process.exit(0)