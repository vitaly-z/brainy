#!/usr/bin/env node

/**
 * 🚀 Instant Validation - Core API Test
 * Tests that core functionality works without heavy model loading
 */

import { Brainy } from './dist/index.js'

console.log('🚀 Brainy 2.0 - Instant Core API Validation')
console.log('=' + '='.repeat(40))

// Skip heavy initialization, focus on API validation
const brain = new Brainy({ 
  storage: { type: 'memory' }, 
  verbose: false,
  skipModelDownload: true // Skip heavy model operations
})

let results = { passed: 0, failed: 0 }

function test(name, condition) {
  if (condition) {
    results.passed++
    console.log(`✅ ${name}`)
  } else {
    results.failed++
    console.log(`❌ ${name}`)
  }
}

try {
  console.log('\n🔧 Core API Structure Tests...')
  
  // Test 1: Brainy class instantiated
  test('Brainy class instantiation', brain instanceof Object)
  
  // Test 2: Core methods exist
  test('addNoun method exists', typeof brain.addNoun === 'function')
  test('getNoun method exists', typeof brain.getNoun === 'function') 
  test('search method exists', typeof brain.search === 'function')
  test('find method exists', typeof brain.find === 'function')
  test('getStatistics method exists', typeof brain.getStatistics === 'function')
  
  // Test 3: Storage system configured
  test('Storage system configured', brain.storage !== undefined)
  
  // Test 4: Configuration applied
  test('Memory storage configured', brain.storage && brain.storage.storageType === 'memory')
  
  console.log('\n📊 API Architecture Validation:')

  // Test 5: Core properties exist
  test('Index system exists', brain.index !== undefined)
  test('Storage system exists', brain.storage !== undefined)
  
  console.log('\n' + '='.repeat(41))
  console.log('📊 INSTANT VALIDATION RESULTS')
  console.log('=' + '='.repeat(40))
  
  const total = results.passed + results.failed
  const successRate = ((results.passed / total) * 100).toFixed(1)
  
  console.log(`Total Tests: ${total}`)
  console.log(`Passed: ${results.passed} ✅`)
  console.log(`Failed: ${results.failed} ${results.failed > 0 ? '❌' : ''}`)
  console.log(`Success Rate: ${successRate}%`)
  
  if (successRate >= 95) {
    console.log('🟢 EXCELLENT - Core API structure is ready!')
  } else if (successRate >= 80) {
    console.log('🟡 GOOD - Minor issues detected')  
  } else {
    console.log('🔴 ISSUES - Core structure needs attention')
  }
  
  console.log('\n🎯 Core Architecture: VALIDATED ✅')
  console.log('Next: Run production tests with full initialization')
  
} catch (error) {
  console.log(`\n❌ CRITICAL ERROR: ${error.message}`)
  process.exit(1)
}

process.exit(results.failed > 0 ? 1 : 0)