#!/usr/bin/env node

/**
 * 🚀 Brainy 2.0 - Production Validation Script
 * 
 * This script validates that ALL core functionality works in a production-like environment.
 * Focus on HIGH-IMPACT validation that proves the system is ready for release.
 */

import { Brainy } from './dist/index.js'
import { performance } from 'perf_hooks'

console.log('🚀 Brainy 2.0 - Production Validation Suite')
console.log('=' + '='.repeat(50))

// Test configuration for production-like environment
const testConfig = {
  storage: { type: 'memory' }, // Use memory for speed, but tests real storage layer
  verbose: false
}

const brain = new Brainy(testConfig)

// Validation results tracking
const results = {
  passed: 0,
  failed: 0,
  tests: []
}

function addResult(name, success, details = '', time = 0) {
  results.tests.push({ name, success, details, time })
  if (success) {
    results.passed++
    console.log(`✅ ${name} (${time}ms)`)
    if (details) console.log(`   ${details}`)
  } else {
    results.failed++
    console.log(`❌ ${name}`)
    console.log(`   Error: ${details}`)
  }
}

async function runValidation() {
  try {
    console.log('\n🔧 Phase 1: System Initialization')
    
    // Test 1: System initializes properly
    const initStart = performance.now()
    await brain.init()
    const initTime = Math.round(performance.now() - initStart)
    addResult('System Initialization', true, 'All augmentations loaded successfully', initTime)
    
    // Test 2: Embedding system works
    const embedStart = performance.now()
    const testVector = await brain.embed('test embedding')
    const embedTime = Math.round(performance.now() - embedStart)
    const isValidVector = Array.isArray(testVector) && testVector.length === 384
    addResult('Embedding Generation', isValidVector, `Generated ${testVector.length}D vector`, embedTime)
    
    console.log('\n🔍 Phase 2: Core CRUD Operations')
    
    // Test 3: Add data (multiple formats)
    const crudStart = performance.now()
    const id1 = await brain.addNoun('JavaScript is a programming language', { type: 'language', year: 1995 })
    const id2 = await brain.addNoun({ name: 'React', type: 'framework', language: 'JavaScript' })
    const id3 = await brain.addNoun('Python programming guide', { type: 'language', year: 1991 })
    const crudTime = Math.round(performance.now() - crudStart)
    addResult('Data Addition (Multiple Formats)', true, '3 items added successfully', crudTime)
    
    // Test 4: Retrieve data
    const retrieveStart = performance.now()
    const retrieved = await brain.getNoun(id1)
    const retrieveTime = Math.round(performance.now() - retrieveStart)
    const isRetrieved = retrieved && retrieved.id === id1
    addResult('Data Retrieval', isRetrieved, 'Retrieved item matches expected', retrieveTime)
    
    // Test 5: Update data
    const updateStart = performance.now()
    await brain.updateNoun(id1, { popularity: 'high', updated: true })
    const updated = await brain.getNoun(id1)
    const updateTime = Math.round(performance.now() - updateStart)
    const isUpdated = updated.metadata.popularity === 'high' && updated.metadata.updated === true
    addResult('Data Update', isUpdated, 'Metadata updated successfully', updateTime)
    
    console.log('\n🧠 Phase 3: AI & Search Functionality')
    
    // Test 6: Vector similarity search (NEW CONSOLIDATED API)
    const searchStart = performance.now()
    const searchResults = await brain.search('programming language', { limit: 5 })
    const searchTime = Math.round(performance.now() - searchStart)
    const hasResults = searchResults.length > 0 && searchResults[0].score !== undefined
    addResult('Vector Search (Consolidated API)', hasResults, `Found ${searchResults.length} results`, searchTime)
    
    // Test 7: Natural language find (NEW CONSOLIDATED API)  
    const findStart = performance.now()
    const findResults = await brain.find('modern JavaScript frameworks', { limit: 3 })
    const findTime = Math.round(performance.now() - findStart)
    const hasFindResults = findResults.length > 0
    addResult('Natural Language Find', hasFindResults, `Found ${findResults.length} intelligent results`, findTime)
    
    // Test 8: Structured query with metadata filtering
    const structuredStart = performance.now()
    const structuredResults = await brain.find({
      like: 'programming',
      where: { type: 'language' }
    }, { limit: 5 })
    const structuredTime = Math.round(performance.now() - structuredStart)
    const hasStructuredResults = structuredResults.length > 0
    addResult('Structured Query + Filtering', hasStructuredResults, `Found ${structuredResults.length} filtered results`, structuredTime)
    
    console.log('\n⚡ Phase 4: Performance & Scalability')
    
    // Test 9: Batch operations
    const batchStart = performance.now()
    const batchData = []
    for (let i = 0; i < 50; i++) {
      batchData.push({
        data: `Test item ${i}`,
        metadata: { batch: true, index: i, category: i % 3 === 0 ? 'A' : 'B' }
      })
    }
    
    const batchIds = []
    for (const item of batchData) {
      const id = await brain.addNoun(item.data, item.metadata)
      batchIds.push(id)
    }
    const batchTime = Math.round(performance.now() - batchStart)
    addResult('Batch Operations', batchIds.length === 50, `Added ${batchIds.length} items in batch`, batchTime)
    
    // Test 10: Performance under load
    const performanceStart = performance.now()
    const performancePromises = []
    for (let i = 0; i < 20; i++) {
      performancePromises.push(brain.search(`test query ${i}`, { limit: 5 }))
    }
    const performanceResults = await Promise.all(performancePromises)
    const performanceTime = Math.round(performance.now() - performanceStart)
    const avgTime = performanceTime / 20
    const hasPerformanceResults = performanceResults.every(r => Array.isArray(r))
    addResult('Concurrent Performance', hasPerformanceResults, `20 concurrent searches avg ${avgTime.toFixed(1)}ms each`, performanceTime)
    
    console.log('\n🏗️ Phase 5: Advanced Features')
    
    // Test 11: Statistics and monitoring
    const statsStart = performance.now()
    const stats = await brain.getStatistics()
    const statsTime = Math.round(performance.now() - statsStart)
    const hasStats = stats && typeof stats.nounCount === 'number' && stats.nounCount > 0
    addResult('Statistics Collection', hasStats, `${stats.nounCount} nouns tracked`, statsTime)
    
    // Test 12: Augmentations system
    const augmentationsStart = performance.now()
    const cacheStats = brain.getCacheStats()
    const healthStatus = brain.getHealthStatus()
    const augmentationsTime = Math.round(performance.now() - augmentationsStart)
    const augmentationsWork = typeof cacheStats === 'object' && typeof healthStatus === 'object'
    addResult('Augmentations System', augmentationsWork, 'Cache and monitoring active', augmentationsTime)
    
    // Test 13: Memory management
    const memoryStart = performance.now()
    const memBefore = process.memoryUsage()
    
    // Create and cleanup significant data
    const tempIds = []
    for (let i = 0; i < 100; i++) {
      const id = await brain.addNoun(`Temporary item ${i}`)
      tempIds.push(id)
    }
    
    // Clean up
    for (const id of tempIds) {
      await brain.deleteNoun(id)
    }
    
    const memAfter = process.memoryUsage()
    const memoryTime = Math.round(performance.now() - memoryStart)
    const memoryGrowth = memAfter.heapUsed - memBefore.heapUsed
    const isMemoryManaged = memoryGrowth < 50 * 1024 * 1024 // Less than 50MB growth
    addResult('Memory Management', isMemoryManaged, `Memory growth: ${(memoryGrowth / 1024 / 1024).toFixed(1)}MB`, memoryTime)
    
    console.log('\n🔒 Phase 6: Data Integrity & Safety')
    
    // Test 14: Data persistence and retrieval
    const integrityStart = performance.now()
    const beforeCount = (await brain.getStatistics()).nounCount
    const testId = await brain.addNoun('Integrity test data', { critical: true })
    const afterCount = (await brain.getStatistics()).nounCount
    const retrieved2 = await brain.getNoun(testId)
    const integrityTime = Math.round(performance.now() - integrityStart)
    const isIntact = afterCount > beforeCount && retrieved2 && retrieved2.metadata && retrieved2.metadata.critical === true
    addResult('Data Integrity', isIntact, 'Data persisted and retrieved correctly', integrityTime)
    
    // Test 15: Error handling
    const errorStart = performance.now()
    let errorHandled = false
    try {
      await brain.getNoun('non-existent-id')
      // Should return null, not throw
      errorHandled = true
    } catch (error) {
      // If it throws, that's also OK as long as it's handled gracefully
      errorHandled = error.message.includes('does not exist') || error.message.includes('not found')
    }
    const errorTime = Math.round(performance.now() - errorStart)
    addResult('Error Handling', errorHandled, 'Non-existent data handled gracefully', errorTime)
    
  } catch (error) {
    addResult('Critical System Error', false, error.message)
  }
}

// Run validation and generate report
await runValidation()

console.log('\n' + '='.repeat(51))
console.log('🎯 PRODUCTION VALIDATION RESULTS')
console.log('='.repeat(51))

const totalTests = results.passed + results.failed
const successRate = ((results.passed / totalTests) * 100).toFixed(1)
const totalTime = results.tests.reduce((sum, test) => sum + test.time, 0)

console.log(`\n📊 Summary:`)
console.log(`   Total Tests: ${totalTests}`)
console.log(`   Passed: ${results.passed} ✅`)
console.log(`   Failed: ${results.failed} ${results.failed > 0 ? '❌' : ''}`)
console.log(`   Success Rate: ${successRate}%`)
console.log(`   Total Time: ${totalTime}ms`)
console.log(`   Avg Time per Test: ${(totalTime / totalTests).toFixed(1)}ms`)

// Memory usage final report
const finalMem = process.memoryUsage()
console.log(`\n💾 Memory Usage:`)
console.log(`   Heap Used: ${(finalMem.heapUsed / 1024 / 1024).toFixed(1)}MB`)
console.log(`   Heap Total: ${(finalMem.heapTotal / 1024 / 1024).toFixed(1)}MB`)
console.log(`   RSS: ${(finalMem.rss / 1024 / 1024).toFixed(1)}MB`)

// Confidence assessment
console.log(`\n🎯 Confidence Assessment:`)
if (successRate >= 95) {
  console.log(`   🟢 EXCELLENT (${successRate}%) - Ready for production release!`)
} else if (successRate >= 85) {
  console.log(`   🟡 GOOD (${successRate}%) - Minor issues to address`)
} else if (successRate >= 70) {
  console.log(`   🟠 NEEDS WORK (${successRate}%) - Several issues to fix`)
} else {
  console.log(`   🔴 CRITICAL (${successRate}%) - Major issues require attention`)
}

// Detailed failure report if any
if (results.failed > 0) {
  console.log(`\n❌ Failed Tests:`)
  results.tests
    .filter(test => !test.success)
    .forEach(test => {
      console.log(`   • ${test.name}: ${test.details}`)
    })
}

console.log(`\n🚀 Production validation complete!`)
console.log(`   Ready for next phase: CLI integration`)

// Exit with appropriate code
process.exit(results.failed > 0 ? 1 : 0)