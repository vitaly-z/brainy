/**
 * Bun Compile Test
 *
 * Tests that Brainy works when compiled with `bun build --compile`.
 * This verifies:
 * 1. No native binaries required (pure WASM)
 * 2. Model is properly bundled
 * 3. Embeddings work without network access
 *
 * To test manually:
 *   bun build tests/integration/bun-compile-test.ts --compile --outfile /tmp/brainy-bun-test
 *   /tmp/brainy-bun-test
 */

import { Brainy } from '../../dist/index.js'
import { embeddingManager } from '../../dist/embeddings/EmbeddingManager.js'
import { WASMEmbeddingEngine } from '../../dist/embeddings/wasm/index.js'

async function testBunCompile() {
  const results: { test: string; passed: boolean; error?: string }[] = []

  console.log('🚀 Brainy Bun Compile Test\n')
  console.log('Runtime:', typeof Bun !== 'undefined' ? `Bun ${Bun.version}` : `Node.js ${process.version}`)
  console.log('')

  // Test 1: WASM Engine initialization
  try {
    console.log('1. Testing WASM Engine initialization...')
    const engine = WASMEmbeddingEngine.getInstance()
    await engine.initialize()
    console.log('   ✅ WASM Engine initialized')
    results.push({ test: 'WASM Engine init', passed: true })
  } catch (error) {
    console.log('   ❌ WASM Engine failed:', (error as Error).message)
    results.push({ test: 'WASM Engine init', passed: false, error: (error as Error).message })
  }

  // Test 2: Generate embedding
  try {
    console.log('2. Testing embedding generation...')
    const engine = WASMEmbeddingEngine.getInstance()
    const embedding = await engine.embed('Hello from Bun!')
    if (embedding.length !== 384) {
      throw new Error(`Expected 384 dimensions, got ${embedding.length}`)
    }
    console.log(`   ✅ Generated ${embedding.length}-dim embedding`)
    results.push({ test: 'Embedding generation', passed: true })
  } catch (error) {
    console.log('   ❌ Embedding failed:', (error as Error).message)
    results.push({ test: 'Embedding generation', passed: false, error: (error as Error).message })
  }

  // Test 3: Semantic similarity
  try {
    console.log('3. Testing semantic similarity...')
    const engine = WASMEmbeddingEngine.getInstance()
    const catEmb = await engine.embed('The cat sat on the mat')
    const felineEmb = await engine.embed('A feline rests on a rug')
    const stockEmb = await engine.embed('Stock market crash')

    const cosineSim = (a: number[], b: number[]) => {
      let dot = 0
      for (let i = 0; i < a.length; i++) dot += a[i] * b[i]
      return dot // Already normalized
    }

    const similarSim = cosineSim(catEmb, felineEmb)
    const dissimilarSim = cosineSim(catEmb, stockEmb)

    if (similarSim <= dissimilarSim) {
      throw new Error(`Semantic similarity failed: similar=${similarSim.toFixed(4)}, dissimilar=${dissimilarSim.toFixed(4)}`)
    }
    console.log(`   ✅ Semantic similarity works (similar: ${similarSim.toFixed(4)} > dissimilar: ${dissimilarSim.toFixed(4)})`)
    results.push({ test: 'Semantic similarity', passed: true })
  } catch (error) {
    console.log('   ❌ Semantic similarity failed:', (error as Error).message)
    results.push({ test: 'Semantic similarity', passed: false, error: (error as Error).message })
  }

  // Test 4: EmbeddingManager
  try {
    console.log('4. Testing EmbeddingManager...')
    await embeddingManager.init()
    const emb = await embeddingManager.embed('Test via manager')
    if (emb.length !== 384) {
      throw new Error(`Expected 384 dimensions, got ${emb.length}`)
    }
    console.log('   ✅ EmbeddingManager works')
    results.push({ test: 'EmbeddingManager', passed: true })
  } catch (error) {
    console.log('   ❌ EmbeddingManager failed:', (error as Error).message)
    results.push({ test: 'EmbeddingManager', passed: false, error: (error as Error).message })
  }

  // Test 5: Full Brainy initialization with fresh memory storage
  try {
    console.log('5. Testing Brainy initialization (in-memory)...')
    const brain = new Brainy({
      storage: 'memory',
      storageOptions: { path: ':memory:' }
    })
    await brain.init()
    console.log('   ✅ Brainy initialized')
    results.push({ test: 'Brainy init', passed: true })

    // Test 6: Add document
    console.log('6. Testing document add...')
    const docId = await brain.add({ data: 'Machine learning concepts', type: 'concept' })
    if (!docId || typeof docId !== 'string') {
      throw new Error('Document add returned no ID')
    }
    console.log(`   ✅ Document added: ${docId}`)
    results.push({ test: 'Document add', passed: true })

    // Test 7: Search
    console.log('7. Testing semantic search...')
    const searchResults = await brain.find('AI')
    console.log(`   ✅ Search returned ${searchResults.length} results`)
    results.push({ test: 'Semantic search', passed: true })

    // Test 8: Get document
    console.log('8. Testing document retrieval...')
    const retrieved = await brain.get(docId)
    if (!retrieved) {
      throw new Error('Document not found')
    }
    console.log('   ✅ Document retrieved')
    results.push({ test: 'Document retrieval', passed: true })

    await brain.close()
  } catch (error) {
    console.log('   ❌ Brainy test failed:', (error as Error).message)
    results.push({ test: 'Brainy operations', passed: false, error: (error as Error).message })
  }

  // Summary
  console.log('\n' + '='.repeat(50))
  console.log('SUMMARY')
  console.log('='.repeat(50))

  const passed = results.filter(r => r.passed).length
  const failed = results.filter(r => !r.passed).length

  for (const r of results) {
    console.log(`${r.passed ? '✅' : '❌'} ${r.test}${r.error ? `: ${r.error}` : ''}`)
  }

  console.log('')
  console.log(`Passed: ${passed}/${results.length}`)
  console.log(`Failed: ${failed}/${results.length}`)

  if (failed > 0) {
    console.log('\n❌ Some tests failed!')
    process.exit(1)
  } else {
    console.log('\n✅ All tests passed! Brainy works with Bun compile.')
    process.exit(0)
  }
}

// Run tests
testBunCompile().catch(error => {
  console.error('Fatal error:', error)
  process.exit(1)
})
