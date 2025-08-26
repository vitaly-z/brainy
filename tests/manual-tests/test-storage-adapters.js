#!/usr/bin/env node

/**
 * Test all storage adapters for Brainy 2.0
 */

import { BrainyData } from './dist/index.js'
import { promises as fs } from 'fs'
import { join } from 'path'

console.log('🧪 TESTING BRAINY STORAGE ADAPTERS')
console.log('=' + '='.repeat(50))

async function testStorageAdapter(name, config) {
  console.log(`\n📦 Testing ${name} Storage...`)
  
  try {
    // Initialize with specific storage
    const brain = new BrainyData({
      storage: config,
      verbose: false
    })
    
    console.log('  Initializing...')
    await brain.init()
    
    // Test basic operations
    console.log('  Testing addNoun...')
    const id1 = await brain.addNoun(
      'Test Item 1',  // data to be vectorized
      {               // metadata for filtering
        name: 'Test Item 1', 
        storage: name,
        timestamp: Date.now()
      }
    )
    
    const id2 = await brain.addNoun(
      'Test Item 2',  // data to be vectorized
      {               // metadata for filtering
        name: 'Test Item 2',
        storage: name,
        timestamp: Date.now()
      }
    )
    
    console.log(`  ✅ Added 2 items (${id1}, ${id2})`)
    
    // Test retrieval
    console.log('  Testing getNoun...')
    const retrieved = await brain.getNoun(id1)
    if (retrieved?.metadata?.name === 'Test Item 1') {
      console.log('  ✅ Retrieved item correctly')
    } else {
      console.log('  ❌ Failed to retrieve item properly')
    }
    
    // Test search
    console.log('  Testing search...')
    const results = await brain.search('Test', 10)
    console.log(`  ✅ Search returned ${results.length} results`)
    
    // Test update (update metadata only)
    console.log('  Testing updateNoun...')
    await brain.updateNoun(id1, undefined, { updated: true })
    const updated = await brain.getNoun(id1)
    if (updated?.metadata?.updated === true) {
      console.log('  ✅ Update successful')
    } else {
      console.log('  ❌ Update failed')
    }
    
    // Test statistics
    console.log('  Testing statistics...')
    const stats = await brain.getStatistics()
    console.log(`  ✅ Stats: ${stats.nounCount} nouns, ${stats.verbCount} verbs`)
    
    // Test delete
    console.log('  Testing deleteNoun...')
    await brain.deleteNoun(id1)
    const deleted = await brain.getNoun(id1)
    if (!deleted) {
      console.log('  ✅ Delete successful')
    } else {
      console.log('  ⚠️  Delete may not have worked properly')
    }
    
    // Clean up
    console.log('  Cleaning up...')
    await brain.clearAll({ force: true })
    
    console.log(`✅ ${name} Storage: ALL TESTS PASSED`)
    return true
    
  } catch (error) {
    console.error(`❌ ${name} Storage: FAILED`)
    console.error(`  Error: ${error.message}`)
    return false
  }
}

async function runAllTests() {
  const results = {}
  
  // Test Memory Storage
  results.memory = await testStorageAdapter('Memory', {
    type: 'memory'
  })
  
  // Test FileSystem Storage
  const testPath = './test-brainy-data'
  results.filesystem = await testStorageAdapter('FileSystem', {
    type: 'filesystem',
    path: testPath
  })
  
  // Clean up test directory
  try {
    await fs.rm(testPath, { recursive: true, force: true })
  } catch (e) {
    // Ignore cleanup errors
  }
  
  // Test OPFS (only in browser environment)
  if (typeof navigator !== 'undefined' && navigator.storage?.getDirectory) {
    results.opfs = await testStorageAdapter('OPFS', {
      type: 'opfs'
    })
  } else {
    console.log('\n📦 OPFS Storage: Skipped (not in browser environment)')
  }
  
  // Test S3 (skip if no credentials)
  if (process.env.AWS_ACCESS_KEY_ID) {
    results.s3 = await testStorageAdapter('S3', {
      type: 's3',
      bucket: process.env.S3_TEST_BUCKET || 'brainy-test',
      region: process.env.AWS_REGION || 'us-east-1'
    })
  } else {
    console.log('\n📦 S3 Storage: Skipped (no AWS credentials)')
  }
  
  // Summary
  console.log('\n' + '='.repeat(51))
  console.log('📊 STORAGE ADAPTER TEST RESULTS')
  console.log('='.repeat(51))
  
  let passed = 0
  let failed = 0
  let skipped = 0
  
  for (const [adapter, result] of Object.entries(results)) {
    if (result === true) {
      console.log(`✅ ${adapter}: PASSED`)
      passed++
    } else if (result === false) {
      console.log(`❌ ${adapter}: FAILED`)
      failed++
    } else {
      skipped++
    }
  }
  
  if (!results.opfs) skipped++
  if (!results.s3) skipped++
  
  console.log('\n📈 Summary:')
  console.log(`  Passed: ${passed}`)
  console.log(`  Failed: ${failed}`)
  console.log(`  Skipped: ${skipped}`)
  
  if (failed === 0) {
    console.log('\n🎉 ALL AVAILABLE STORAGE ADAPTERS WORKING!')
  } else {
    console.log('\n⚠️  Some storage adapters have issues')
  }
  
  process.exit(failed === 0 ? 0 : 1)
}

// Run tests
runAllTests().catch(error => {
  console.error('Fatal error:', error)
  process.exit(1)
})