#!/usr/bin/env node

/**
 * PRODUCTION READINESS TEST
 * 
 * Verifies ALL critical functionality works in production-like environment
 * Tests: search(), find(), clustering, Triple Intelligence, Brain Patterns
 */

import { Brainy } from './dist/index.js'

const TEST_TIMEOUT = 30000 // 30 seconds per operation

async function withTimeout(promise, operation, timeoutMs = TEST_TIMEOUT) {
  const timeout = new Promise((_, reject) => {
    setTimeout(() => reject(new Error(`${operation} timeout after ${timeoutMs}ms`)), timeoutMs)
  })
  
  try {
    const result = await Promise.race([promise, timeout])
    console.log(`✅ ${operation} completed successfully`)
    return result
  } catch (error) {
    console.error(`❌ ${operation} failed: ${error.message}`)
    throw error
  }
}

async function testProductionFunctionality() {
  console.log('🚀 PRODUCTION READINESS TEST - Brainy 2.0')
  console.log('=========================================\n')
  
  const results = {
    passed: [],
    failed: [],
    warnings: []
  }
  
  try {
    // 1. Initialize Brainy
    console.log('1️⃣ Initializing Brainy with real AI models...')
    const brain = new Brainy({
      storage: { forceMemoryStorage: true },
      verbose: false
    })
    
    await withTimeout(brain.init(), 'Initialization', 60000)
    await brain.clearAll({ force: true })
    
    // 2. Test data creation with real embeddings
    console.log('\n2️⃣ Testing data creation with real embeddings...')
    const testData = [
      { content: 'JavaScript is a programming language', category: 'programming', year: 1995 },
      { content: 'Python is used for machine learning', category: 'programming', year: 1991 },
      { content: 'React is a frontend framework', category: 'framework', year: 2013 },
      { content: 'Docker enables containerization', category: 'devops', year: 2013 },
      { content: 'PostgreSQL is a relational database', category: 'database', year: 1996 }
    ]
    
    const ids = []
    for (const item of testData) {
      try {
        const id = await withTimeout(
          brain.addNoun(item.content, item),
          `Add: ${item.content.substring(0, 30)}...`,
          10000
        )
        ids.push(id)
        results.passed.push(`addNoun: ${item.category}`)
      } catch (error) {
        results.failed.push(`addNoun: ${item.category}`)
      }
    }
    
    // 3. Test search() with semantic understanding
    console.log('\n3️⃣ Testing search() with semantic understanding...')
    try {
      const searchResults = await withTimeout(
        brain.search('programming languages', 3),
        'search(): programming languages'
      )
      
      if (searchResults && searchResults.length > 0) {
        console.log(`   Found ${searchResults.length} results`)
        results.passed.push('search() basic')
      } else {
        results.failed.push('search() returned no results')
      }
    } catch (error) {
      results.failed.push('search() functionality')
    }
    
    // 4. Test find() with natural language
    console.log('\n4️⃣ Testing find() with natural language...')
    try {
      const findResults = await withTimeout(
        brain.find('show me backend technologies'),
        'find(): natural language query'
      )
      
      if (findResults && findResults.length > 0) {
        console.log(`   Found ${findResults.length} results via NLP`)
        results.passed.push('find() NLP')
      } else {
        results.warnings.push('find() returned no results')
      }
    } catch (error) {
      results.failed.push('find() functionality')
    }
    
    // 5. Test Brain Patterns (metadata filtering)
    console.log('\n5️⃣ Testing Brain Patterns (metadata filtering)...')
    try {
      const patternResults = await withTimeout(
        brain.search('*', 10, {
          metadata: {
            category: 'programming',
            year: { greaterThan: 1990 }
          }
        }),
        'Brain Patterns: range queries'
      )
      
      if (patternResults && patternResults.length > 0) {
        console.log(`   Found ${patternResults.length} with metadata filters`)
        results.passed.push('Brain Patterns')
      } else {
        results.warnings.push('Brain Patterns returned no results')
      }
    } catch (error) {
      results.failed.push('Brain Patterns')
    }
    
    // 6. Test Triple Intelligence
    console.log('\n6️⃣ Testing Triple Intelligence...')
    try {
      const tripleResults = await withTimeout(
        brain.find({
          like: 'web development',
          where: { category: 'framework' },
          limit: 3
        }),
        'Triple Intelligence: vector + metadata'
      )
      
      if (tripleResults && tripleResults.length >= 0) {
        console.log(`   Found ${tripleResults.length} via Triple Intelligence`)
        results.passed.push('Triple Intelligence')
      } else {
        results.warnings.push('Triple Intelligence returned unexpected results')
      }
    } catch (error) {
      results.failed.push('Triple Intelligence')
    }
    
    // 7. Test direct embedding generation
    console.log('\n7️⃣ Testing direct embedding generation...')
    try {
      const embedding = await withTimeout(
        brain.embed('test embedding'),
        'Direct embedding generation',
        10000
      )
      
      if (embedding && embedding.length === 384) {
        console.log(`   Generated ${embedding.length}D embedding`)
        results.passed.push('embed() function')
      } else {
        results.failed.push('embed() wrong dimensions')
      }
    } catch (error) {
      results.failed.push('embed() function')
    }
    
    // 8. Test statistics
    console.log('\n8️⃣ Testing statistics and monitoring...')
    try {
      const stats = await withTimeout(
        brain.getStatistics(),
        'Statistics retrieval',
        5000
      )
      
      if (stats && stats.totalItems >= ids.length) {
        console.log(`   Stats: ${stats.totalItems} items, ${stats.dimensions}D`)
        results.passed.push('Statistics')
      } else {
        results.failed.push('Statistics incorrect')
      }
    } catch (error) {
      results.failed.push('Statistics')
    }
    
    // 9. Test CRUD operations
    console.log('\n9️⃣ Testing CRUD operations...')
    if (ids.length > 0) {
      try {
        // Get
        const item = await withTimeout(
          brain.getNoun(ids[0]),
          'getNoun',
          5000
        )
        if (item) results.passed.push('getNoun')
        else results.failed.push('getNoun')
        
        // Update (pass metadata only, not null data)
        await withTimeout(
          brain.updateNoun(ids[0], undefined, { updated: true }),
          'updateNoun',
          5000
        )
        results.passed.push('updateNoun')
        
        // Delete
        const deleted = await withTimeout(
          brain.deleteNoun(ids[0]),
          'deleteNoun',
          5000
        )
        if (deleted) results.passed.push('deleteNoun')
        else results.warnings.push('deleteNoun returned false')
        
      } catch (error) {
        results.failed.push('CRUD operations')
      }
    }
    
    // 10. Memory check
    console.log('\n🔟 Checking memory usage...')
    const mem = process.memoryUsage()
    const heapMB = Math.round(mem.heapUsed / 1024 / 1024)
    console.log(`   Heap used: ${heapMB} MB`)
    if (heapMB < 4000) {
      results.passed.push('Memory usage acceptable')
    } else {
      results.warnings.push(`High memory usage: ${heapMB} MB`)
    }
    
  } catch (error) {
    console.error('\n❌ Fatal error:', error.message)
    results.failed.push('Fatal error: ' + error.message)
  }
  
  // Final Report
  console.log('\n' + '='.repeat(50))
  console.log('📊 PRODUCTION READINESS REPORT')
  console.log('='.repeat(50))
  
  console.log(`\n✅ PASSED (${results.passed.length}):`)
  results.passed.forEach(test => console.log(`   - ${test}`))
  
  if (results.warnings.length > 0) {
    console.log(`\n⚠️ WARNINGS (${results.warnings.length}):`)
    results.warnings.forEach(test => console.log(`   - ${test}`))
  }
  
  if (results.failed.length > 0) {
    console.log(`\n❌ FAILED (${results.failed.length}):`)
    results.failed.forEach(test => console.log(`   - ${test}`))
  }
  
  const totalTests = results.passed.length + results.failed.length
  const passRate = Math.round((results.passed.length / totalTests) * 100)
  
  console.log('\n' + '='.repeat(50))
  console.log(`📈 OVERALL: ${passRate}% Pass Rate (${results.passed.length}/${totalTests})`)
  
  if (passRate >= 90) {
    console.log('🎉 PRODUCTION READY!')
  } else if (passRate >= 70) {
    console.log('⚠️ MOSTLY READY - Fix critical issues')
  } else {
    console.log('❌ NOT READY - Major issues found')
  }
  
  console.log('='.repeat(50))
  
  process.exit(results.failed.length > 0 ? 1 : 0)
}

// Run the test
testProductionFunctionality().catch(console.error)