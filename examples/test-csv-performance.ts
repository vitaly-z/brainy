/**
 * CSV Import Performance Test
 *
 * Tests the v3.39.0 performance improvements:
 * 1. Runtime embedding cache in NeuralEntityExtractor
 * 2. Batch processing in SmartCSVImporter
 * 3. Enhanced progress reporting with throughput and ETA
 *
 * Run with: npx tsx examples/test-csv-performance.ts
 */

import { Brainy } from '../src/brainy.js'
import { SmartCSVImporter } from '../src/importers/SmartCSVImporter.js'

async function generateTestCSV(rows: number): Promise<Buffer> {
  const lines = ['Term,Definition,Type,Related']

  for (let i = 0; i < rows; i++) {
    const term = `Concept ${i}`
    const definition = `This is a detailed definition for concept ${i}. It describes the meaning, usage, and context of this particular concept in our knowledge base.`
    const type = i % 3 === 0 ? 'Concept' : i % 3 === 1 ? 'Thing' : 'Topic'
    const related = i > 0 ? `Concept ${i - 1}` : ''

    lines.push(`"${term}","${definition}","${type}","${related}"`)
  }

  return Buffer.from(lines.join('\n'), 'utf-8')
}

async function testImportPerformance() {
  console.log('🧪 Testing CSV Import Performance (v3.39.0)\n')

  // Create test brain
  const brain = new Brainy({
    storage: 'memory',
    augmentations: []
  })

  await brain.init()

  // Create importer
  const importer = new SmartCSVImporter(brain)
  await importer.init()

  // Test with different sizes
  const testSizes = [10, 50, 100]

  for (const size of testSizes) {
    console.log(`\n📊 Testing with ${size} rows:`)
    console.log('─'.repeat(50))

    // Generate test data
    console.log(`  Generating test CSV file with ${size} rows...`)
    const buffer = await generateTestCSV(size)
    console.log(`  Generated ${(buffer.length / 1024).toFixed(1)}KB file\n`)

    // Track progress
    let lastUpdate = Date.now()
    let updates = 0

    const startTime = Date.now()

    // Extract with progress monitoring
    const result = await importer.extract(buffer, {
      enableNeuralExtraction: true,
      enableConceptExtraction: true,
      enableRelationshipInference: true,
      onProgress: (stats) => {
        updates++
        const now = Date.now()
        const timeSinceLastUpdate = now - lastUpdate

        console.log(
          `  Progress: ${stats.processed}/${stats.total} rows ` +
          `(${Math.round((stats.processed / stats.total) * 100)}%) ` +
          `| Entities: ${stats.entities} ` +
          `| Relationships: ${stats.relationships} ` +
          (stats.throughput ? `| ${stats.throughput} rows/sec ` : '') +
          (stats.eta ? `| ETA: ${Math.round(stats.eta / 1000)}s` : '')
        )

        lastUpdate = now
      }
    })

    const totalTime = Date.now() - startTime
    const avgTimePerRow = totalTime / size

    // Get embedding cache stats
    const cacheStats = (importer as any).extractor.getEmbeddingCacheStats()

    console.log('\n  ✅ Results:')
    console.log(`     Total time: ${(totalTime / 1000).toFixed(2)}s`)
    console.log(`     Avg per row: ${avgTimePerRow.toFixed(0)}ms`)
    console.log(`     Throughput: ${(size / (totalTime / 1000)).toFixed(1)} rows/sec`)
    console.log(`     Progress updates: ${updates}`)
    console.log(`     Rows processed: ${result.rowsProcessed}`)
    console.log(`     Entities extracted: ${result.entitiesExtracted}`)
    console.log(`     Relationships: ${result.relationshipsInferred}`)
    console.log(`\n  🚀 Cache Performance:`)
    console.log(`     Embedding cache hits: ${cacheStats.hits}`)
    console.log(`     Embedding cache misses: ${cacheStats.misses}`)
    console.log(`     Cache hit rate: ${(cacheStats.hitRate * 100).toFixed(1)}%`)
    console.log(`     Cache size: ${cacheStats.size} entries`)

    // Calculate expected time for large imports
    const estimatedFor1000 = (avgTimePerRow * 1000 / 1000).toFixed(1)
    console.log(`\n  📈 Extrapolation:`)
    console.log(`     Estimated time for 1000 rows: ~${estimatedFor1000}s`)
  }

  console.log('\n\n🎉 Performance test complete!')
  console.log('\n💡 Key Improvements in v3.39.0:')
  console.log('   1. Batch processing: 10 rows processed in parallel')
  console.log('   2. Embedding cache: Avoids redundant model calls')
  console.log('   3. Progress reporting: Real-time throughput and ETA')
}

// Run test
testImportPerformance().catch(console.error)
