/**
 * PDF Import Performance Test
 *
 * Tests the v3.39.0 performance improvements:
 * 1. Runtime embedding cache in NeuralEntityExtractor
 * 2. Batch processing in SmartPDFImporter
 * 3. Enhanced progress reporting with throughput and ETA
 *
 * Run with: npx tsx examples/test-pdf-performance.ts
 */

import { Brainy } from '../src/brainy.js'
import { SmartPDFImporter } from '../src/importers/SmartPDFImporter.js'
import { jsPDF } from 'jspdf'

async function generateTestPDF(pages: number): Promise<Buffer> {
  const doc = new jsPDF()

  for (let i = 0; i < pages; i++) {
    if (i > 0) {
      doc.addPage()
    }

    // Add title
    doc.setFontSize(16)
    doc.text(`Page ${i + 1}: Concept ${i}`, 20, 20)

    // Add content paragraphs
    doc.setFontSize(12)
    let y = 40

    const paragraphs = [
      `This is the first paragraph on page ${i + 1}. It describes Concept ${i} in detail, providing context and explaining its significance in our knowledge base.`,
      `The second paragraph continues with more information about Concept ${i}. It explores the relationships between this concept and other related ideas, demonstrating the interconnected nature of knowledge.`,
      `A third paragraph provides additional details about Concept ${i}. This paragraph discusses practical applications and real-world examples that illustrate how this concept is used in various contexts.`,
      `The final paragraph on this page summarizes the key points about Concept ${i}. It reinforces the main ideas and provides a foundation for understanding related concepts on subsequent pages.`
    ]

    for (const paragraph of paragraphs) {
      const lines = doc.splitTextToSize(paragraph, 170)
      doc.text(lines, 20, y)
      y += lines.length * 7 + 10
    }
  }

  return Buffer.from(doc.output('arraybuffer'))
}

async function testImportPerformance() {
  console.log('🧪 Testing PDF Import Performance (v3.39.0)\n')

  // Create test brain
  const brain = new Brainy({
    storage: 'memory',
    augmentations: []
  })

  await brain.init()

  // Create importer
  const importer = new SmartPDFImporter(brain)
  await importer.init()

  // Test with different sizes
  const testSizes = [5, 10, 20]

  for (const size of testSizes) {
    console.log(`\n📊 Testing with ${size} pages:`)
    console.log('─'.repeat(50))

    // Generate test data
    console.log(`  Generating test PDF file with ${size} pages...`)
    const buffer = await generateTestPDF(size)
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
      groupBy: 'page',
      onProgress: (stats) => {
        updates++
        const now = Date.now()
        const timeSinceLastUpdate = now - lastUpdate

        console.log(
          `  Progress: ${stats.processed}/${stats.total} sections ` +
          `(${Math.round((stats.processed / stats.total) * 100)}%) ` +
          `| Entities: ${stats.entities} ` +
          `| Relationships: ${stats.relationships} ` +
          (stats.throughput ? `| ${stats.throughput} sections/sec ` : '') +
          (stats.eta ? `| ETA: ${Math.round(stats.eta / 1000)}s` : '')
        )

        lastUpdate = now
      }
    })

    const totalTime = Date.now() - startTime
    const avgTimePerSection = totalTime / result.sectionsProcessed

    // Get embedding cache stats
    const cacheStats = (importer as any).extractor.getEmbeddingCacheStats()

    console.log('\n  ✅ Results:')
    console.log(`     Total time: ${(totalTime / 1000).toFixed(2)}s`)
    console.log(`     Avg per section: ${avgTimePerSection.toFixed(0)}ms`)
    console.log(
      `     Throughput: ${(result.sectionsProcessed / (totalTime / 1000)).toFixed(1)} sections/sec`
    )
    console.log(`     Progress updates: ${updates}`)
    console.log(`     Pages processed: ${result.pagesProcessed}`)
    console.log(`     Sections processed: ${result.sectionsProcessed}`)
    console.log(`     Entities extracted: ${result.entitiesExtracted}`)
    console.log(`     Relationships: ${result.relationshipsInferred}`)
    console.log(`\n  🚀 Cache Performance:`)
    console.log(`     Embedding cache hits: ${cacheStats.hits}`)
    console.log(`     Embedding cache misses: ${cacheStats.misses}`)
    console.log(`     Cache hit rate: ${(cacheStats.hitRate * 100).toFixed(1)}%`)
    console.log(`     Cache size: ${cacheStats.size} entries`)

    // Calculate expected time for large imports
    const estimatedFor100Pages = (avgTimePerSection * 100 / 1000).toFixed(1)
    console.log(`\n  📈 Extrapolation:`)
    console.log(`     Estimated time for 100 pages: ~${estimatedFor100Pages}s`)
  }

  console.log('\n\n🎉 Performance test complete!')
  console.log('\n💡 Key Improvements in v3.39.0:')
  console.log('   1. Batch processing: 5 sections processed in parallel')
  console.log('   2. Embedding cache: Avoids redundant model calls')
  console.log('   3. Progress reporting: Real-time throughput and ETA')
}

// Run test
testImportPerformance().catch(console.error)
