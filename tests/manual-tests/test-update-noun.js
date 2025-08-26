#!/usr/bin/env node

import { BrainyData } from './dist/index.js'

const brain = new BrainyData({ 
  storage: { type: 'memory' },
  verbose: false 
})

await brain.init()

console.log('Test updateNoun metadata merging:')

// Add with object as data (auto-detects as metadata)
const id = await brain.addNoun({ name: 'TypeScript', version: '4.0' })
console.log('1. Added:', id)

// Get to verify initial state
const initial = await brain.getNoun(id)
console.log('2. Initial metadata:', initial?.metadata)

// Update with new metadata (should merge)
await brain.updateNoun(id, { version: '5.0', popularity: 'high' })

// Get to verify merge
const updated = await brain.getNoun(id)
console.log('3. Updated metadata:', updated?.metadata)
console.log('   - version:', updated?.metadata?.version, '(expected: 5.0)')
console.log('   - popularity:', updated?.metadata?.popularity, '(expected: high)')
console.log('   - name:', updated?.metadata?.name, '(expected: TypeScript)')

process.exit(0)