#!/usr/bin/env node

/**
 * DIRECT SEARCH TEST
 * 
 * Tests search functionality directly, bypassing Triple Intelligence
 * to identify where the timeout occurs
 */

import { Brainy } from './dist/index.js'

async function testDirectSearch() {
  console.log('🔍 DIRECT SEARCH TEST')
  console.log('====================\n')
  
  try {
    // 1. Initialize
    console.log('1. Initializing Brainy...')
    const brain = new Brainy({
      storage: { forceMemoryStorage: true },
      verbose: false
    })
    
    await brain.init()
    await brain.clearAll({ force: true })
    console.log('✅ Initialized\n')
    
    // 2. Add simple test data
    console.log('2. Adding test data...')
    const id1 = await brain.addNoun('JavaScript programming')
    const id2 = await brain.addNoun('Python programming')
    const id3 = await brain.addNoun('React framework')
    console.log(`✅ Added 3 items\n`)
    
    // 3. Test direct embedding generation
    console.log('3. Testing direct embedding...')
    const startEmbed = Date.now()
    const embedding = await brain.embed('programming language')
    console.log(`✅ Generated ${embedding.length}D embedding in ${Date.now() - startEmbed}ms\n`)
    
    // 4. Get the HNSW index directly
    console.log('4. Accessing HNSW index directly...')
    const index = brain.index // This should be the HNSW index
    console.log(`✅ Index has ${index.getNouns().size} nouns\n`)
    
    // 5. Try legacy search if available
    console.log('5. Testing legacy search (if available)...')
    try {
      // Access the private _legacySearch method
      const legacySearch = brain._legacySearch || brain.legacySearch
      if (legacySearch) {
        const startSearch = Date.now()
        const results = await legacySearch.call(brain, 'programming', 2)
        console.log(`✅ Legacy search returned ${results.length} results in ${Date.now() - startSearch}ms`)
      } else {
        console.log('⚠️ Legacy search not available')
      }
    } catch (error) {
      console.log(`⚠️ Legacy search error: ${error.message}`)
    }
    
    // 6. Test simple search WITHOUT Triple Intelligence
    console.log('\n6. Testing simple HNSW search...')
    try {
      // Generate embedding first
      const queryEmbedding = await brain.embed('programming')
      console.log('✅ Query embedding generated')
      
      // Direct HNSW search using the embedding vector
      const startHNSW = Date.now()
      const hnswResults = index.search(queryEmbedding, 2)
      console.log(`✅ HNSW search completed in ${Date.now() - startHNSW}ms`)
      console.log(`   Found ${hnswResults.length} results`)
      
    } catch (error) {
      console.log(`❌ HNSW search error: ${error.message}`)
    }
    
    // 7. Test the public search() method with timeout
    console.log('\n7. Testing public search() with 10s timeout...')
    const searchPromise = brain.search('programming', 2)
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Search timeout')), 10000)
    })
    
    try {
      const startPublic = Date.now()
      const results = await Promise.race([searchPromise, timeoutPromise])
      console.log(`✅ Public search completed in ${Date.now() - startPublic}ms`)
      console.log(`   Found ${results.length} results`)
    } catch (error) {
      console.log(`❌ Public search error: ${error.message}`)
    }
    
    // 8. Memory check
    const mem = process.memoryUsage()
    console.log(`\n📊 Memory usage: ${Math.round(mem.heapUsed / 1024 / 1024)} MB`)
    
    console.log('\n✨ Test complete!')
    
  } catch (error) {
    console.error('❌ Fatal error:', error.message)
    console.error(error.stack)
  }
  
  process.exit(0)
}

testDirectSearch()