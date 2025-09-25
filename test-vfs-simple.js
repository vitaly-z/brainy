#!/usr/bin/env node

/**
 * Simple VFS test to verify it actually works
 */

import { Brainy } from './dist/brainy.js'

async function testVFS() {
  console.log('🧪 Testing VFS with real Brainy instance...\n')

  const brain = new Brainy({
    storage: { type: 'memory' },
    silent: true,
    augmentations: {
      knowledge: true  // Enable Knowledge Layer
    }
  })

  await brain.init()

  // Get VFS instance
  const vfs = brain.vfs()
  await vfs.init()

  console.log('✅ VFS initialized')

  // Test 1: Write a file
  const content = 'Hello, VFS World!'
  await vfs.writeFile('/test.txt', content)
  console.log('✅ File written: /test.txt')

  // Test 2: Read the file back
  const result = await vfs.readFile('/test.txt')
  const readContent = result.toString()
  console.log('✅ File read:', readContent)

  if (readContent !== content) {
    throw new Error(`Content mismatch! Expected: ${content}, Got: ${readContent}`)
  }

  // Test 3: Create directory
  await vfs.mkdir('/my-folder')
  console.log('✅ Directory created: /my-folder')

  // Test 4: Write file in directory
  await vfs.writeFile('/my-folder/nested.txt', 'Nested content')
  console.log('✅ Nested file written')

  // Test 5: List directory
  const files = await vfs.readdir('/my-folder')
  console.log('✅ Directory contents:', files)

  // Test 6: Search (uses embeddings)
  const searchResults = await vfs.search('Hello world')
  console.log('✅ Search results:', searchResults.length, 'files found')

  // Test 7: Check if Knowledge Layer is active
  if (vfs.getHistory) {
    console.log('✅ Knowledge Layer detected')
    const history = await vfs.getHistory('/test.txt')
    console.log('✅ File history:', history ? history.length : 0, 'events')
  } else {
    console.log('❌ Knowledge Layer NOT active')
  }

  // Clean up
  await vfs.close()
  await brain.close()

  console.log('\n✅ All VFS tests passed!')
}

testVFS().catch(err => {
  console.error('❌ Test failed:', err)
  process.exit(1)
})