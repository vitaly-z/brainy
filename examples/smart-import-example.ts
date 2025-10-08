/**
 * Smart Import Example - Using Unified Import API
 *
 * Demonstrates how to use brain.import() to extract entities and
 * relationships from Excel files with auto-detection
 */

import { Brainy } from '../src/brainy.js'

async function main() {
  console.log('📥 Smart Import Example with Unified API\n')

  // Initialize Brainy
  const brain = new Brainy({
    storage: { type: 'memory' as const }
  })
  await brain.init()

  // Use environment variable for Excel file path
  const excelFile = process.env.EXCEL_FILE || './sample-data.xlsx'

  if (!require('fs').existsSync(excelFile)) {
    console.log('⚠️  No Excel file found')
    console.log('   Set EXCEL_FILE environment variable or create ./sample-data.xlsx')
    console.log('   Example: EXCEL_FILE=/path/to/your/file.xlsx npm run example')
    return
  }

  console.log(`📂 Importing: ${excelFile}\n`)

  // Import with unified API - auto-detects format, creates VFS + Graph
  const result = await brain.import(excelFile, {
    vfsPath: '/imports/data',
    groupBy: 'type', // Group by entity type (Places/, Characters/, etc.)
    enableNeuralExtraction: true,
    enableRelationshipInference: true,
    enableConceptExtraction: true,
    onProgress: (progress) => {
      if (progress.stage === 'extracting' && progress.processed && progress.total) {
        if (progress.processed % 10 === 0 || progress.processed === progress.total) {
          console.log(`  [${progress.stage}] ${progress.processed}/${progress.total} rows`)
        }
      } else {
        console.log(`  [${progress.stage}] ${progress.message}`)
      }
    }
  })

  // Display results
  console.log('\n✨ Import Complete!')
  console.log('─'.repeat(60))
  console.log(`Format: ${result.format} (${result.formatConfidence * 100}% confidence)`)
  console.log(`Entities: ${result.stats.entitiesExtracted}`)
  console.log(`Relationships: ${result.stats.graphEdgesCreated}`)
  console.log(`VFS Files: ${result.stats.vfsFilesCreated}`)
  console.log(`Processing Time: ${result.stats.processingTime}ms`)
  console.log('─'.repeat(60))

  // Explore the VFS structure
  console.log('\n📁 VFS Structure:')
  result.vfs.directories.forEach(dir => {
    console.log(`  ${dir}`)
  })

  // Query the knowledge graph
  console.log('\n🔍 Sample Entities:')
  result.entities.slice(0, 5).forEach((entity, i) => {
    console.log(`  ${i + 1}. ${entity.name} (${entity.type})`)
  })

  console.log('\n🔗 Sample Relationships:')
  result.relationships.slice(0, 5).forEach((rel, i) => {
    const from = result.entities.find(e => e.id === rel.from)
    const to = result.entities.find(e => e.id === rel.to)
    console.log(`  ${i + 1}. ${from?.name || rel.from} --[${rel.type}]--> ${to?.name || rel.to}`)
  })

  console.log('\n✅ Example complete!')
}

main().catch(console.error)
