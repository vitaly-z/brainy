#!/usr/bin/env node

import { BrainyData } from './dist/index.js'

async function testRangeQueries() {
  console.log('🧠 Testing Brain Patterns Range Query Support...\n')
  
  let brain
  try {
    // Initialize with memory storage
    brain = new BrainyData({
      storage: { forceMemoryStorage: true },
      dimensions: 384,
      metric: 'cosine'
    })
    await brain.init()
    console.log('✅ Brainy initialized\n')

    // Add test data with numeric fields
    console.log('📝 Adding test data with numeric fields...')
    await brain.addNoun('Product A', { metadata: { price: 50, rating: 4.5, year: 2020 } })
    await brain.addNoun('Product B', { metadata: { price: 150, rating: 3.8, year: 2021 } })
    await brain.addNoun('Product C', { metadata: { price: 250, rating: 4.9, year: 2022 } })
    await brain.addNoun('Product D', { metadata: { price: 350, rating: 4.2, year: 2023 } })
    await brain.addNoun('Product E', { metadata: { price: 450, rating: 3.5, year: 2024 } })
    console.log('✅ Added 5 products with price, rating, and year\n')

    // Test 1: Greater than
    console.log('🔍 Test 1: Find products with price > 200')
    const expensive = await brain.find({
      where: { price: { greaterThan: 200 } },
      limit: 10
    })
    console.log(`Found ${expensive.length} products:`, expensive.map(p => p.metadata?.price))
    console.log(expensive.length === 3 ? '✅ PASS' : '❌ FAIL')
    console.log()

    // Test 2: Less than or equal
    console.log('🔍 Test 2: Find products with rating <= 4.0')
    const lowRated = await brain.find({
      where: { rating: { lessEqual: 4.0 } },
      limit: 10
    })
    console.log(`Found ${lowRated.length} products:`, lowRated.map(p => p.metadata?.rating))
    console.log(lowRated.length === 2 ? '✅ PASS' : '❌ FAIL')
    console.log()

    // Test 3: Between range
    console.log('🔍 Test 3: Find products with price between 100-300')
    const midRange = await brain.find({
      where: { price: { between: [100, 300] } },
      limit: 10
    })
    console.log(`Found ${midRange.length} products:`, midRange.map(p => p.metadata?.price))
    console.log(midRange.length === 2 ? '✅ PASS' : '❌ FAIL')
    console.log()

    // Test 4: Combined filters (AND)
    console.log('🔍 Test 4: Find products with price > 100 AND year >= 2022')
    const combined = await brain.find({
      where: {
        price: { greaterThan: 100 },
        year: { greaterEqual: 2022 }
      },
      limit: 10
    })
    console.log(`Found ${combined.length} products:`, combined.map(p => ({
      price: p.metadata?.price,
      year: p.metadata?.year
    })))
    console.log(combined.length === 3 ? '✅ PASS' : '❌ FAIL')
    console.log()

    // Test 5: Vector + metadata combined
    console.log('🔍 Test 5: Search for "Product" with price < 200')
    const vectorMeta = await brain.find({
      like: 'Product',
      where: { price: { lessThan: 200 } },
      limit: 5
    })
    console.log(`Found ${vectorMeta.length} products:`, vectorMeta.map(p => p.metadata?.price))
    console.log(vectorMeta.length === 2 ? '✅ PASS' : '❌ FAIL')
    console.log()

    // Test 6: Metadata field discovery
    console.log('🔍 Test 6: Discover available filter fields')
    const fields = await brain.getFilterFields()
    console.log('Available fields:', fields)
    console.log(fields.includes('price') && fields.includes('rating') ? '✅ PASS' : '❌ FAIL')
    console.log()

    // Test 7: Get filter values for a field
    console.log('🔍 Test 7: Get unique values for year field')
    const years = await brain.getFilterValues('year')
    console.log('Year values:', years)
    console.log(years.length === 5 ? '✅ PASS' : '❌ FAIL')
    console.log()

    console.log('🎉 Range query tests complete!')
    await brain.shutdown()
    process.exit(0)

  } catch (error) {
    console.error('❌ Test failed:', error.message)
    console.error(error.stack)
    if (brain) {
      try {
        await brain.shutdown()
      } catch (e) {}
    }
    process.exit(1)
  }
}

testRangeQueries()