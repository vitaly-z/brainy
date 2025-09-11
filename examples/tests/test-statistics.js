#!/usr/bin/env node

import { BrainyData } from './dist/index.js'

const brain = new BrainyData({ 
  storage: { type: 'memory' }, 
  verbose: false 
})

await brain.init()

console.log('Adding 2 nouns...')
const id1 = await brain.addNoun('Test 1', { name: 'Test 1' })
const id2 = await brain.addNoun('Test 2', { name: 'Test 2' })

console.log('Getting statistics...')
const stats = await brain.getStatistics()

console.log('\nStatistics after adding 2 nouns:')
console.log('  nounCount:', stats.nounCount)
console.log('  verbCount:', stats.verbCount)
console.log('  metadataCount:', stats.metadataCount)

// Also check the index directly
console.log('\nDirect index check:')
console.log('  Index size:', brain.index.getNouns().size)
console.log('  Metadata index size:', brain.metadataIndex?.getAllItems?.()?.length || 'N/A')

// Clean up
process.exit(0)