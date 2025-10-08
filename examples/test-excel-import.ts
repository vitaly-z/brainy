/**
 * Test unified import with real Excel file
 */

import { Brainy } from '../src/brainy.js'

async function main() {
  console.log('🧠 Testing Excel Import via Unified Import System\n')

  const brain = new Brainy({
    storage: { type: 'memory' as const }
  })

  await brain.init()

  // Use environment variable or default sample file path
  const excelFile = process.env.TEST_EXCEL_FILE || './sample-data.xlsx'

  if (!require('fs').existsSync(excelFile)) {
    console.log('⚠️  No Excel file found for testing')
    console.log('   Set TEST_EXCEL_FILE environment variable or create ./sample-data.xlsx')
    console.log('   Example: TEST_EXCEL_FILE=/path/to/your/file.xlsx npm run example')
    return
  }

  console.log('📥 Importing:', excelFile)
  console.log()

  const result = await brain.import(excelFile, {
    vfsPath: '/imports/excel-data',
    groupBy: 'type',
    onProgress: (progress) => {
      if (progress.stage === 'extracting' && progress.processed && progress.total) {
        if (progress.processed % 10 === 0 || progress.processed === progress.total) {
          console.log(`  [${progress.stage}] ${progress.processed}/${progress.total} rows processed`)
        }
      } else {
        console.log(`  [${progress.stage}] ${progress.message}`)
      }
    }
  })

  console.log()
  console.log('✅ Import Complete!')
  console.log('─'.repeat(60))
  console.log(`Format Detected:       ${result.format} (${result.formatConfidence * 100}% confidence)`)
  console.log(`Entities Extracted:    ${result.stats.entitiesExtracted}`)
  console.log(`Graph Nodes Created:   ${result.stats.graphNodesCreated}`)
  console.log(`Graph Edges Created:   ${result.stats.graphEdgesCreated}`)
  console.log(`VFS Files Created:     ${result.stats.vfsFilesCreated}`)
  console.log(`VFS Directories:       ${result.vfs.directories.length}`)
  console.log(`Processing Time:       ${result.stats.processingTime}ms`)
  console.log('─'.repeat(60))
  console.log()

  console.log('📂 VFS Structure:')
  result.vfs.directories.forEach(dir => {
    console.log(`  ${dir}`)
  })
  console.log()

  console.log('🔍 Sample Entities:')
  result.entities.slice(0, 5).forEach((entity, i) => {
    console.log(`  ${i + 1}. ${entity.name} (${entity.type})`)
    console.log(`     VFS: ${entity.vfsPath}`)
  })
  console.log()

  console.log('🔗 Sample Relationships:')
  result.relationships.slice(0, 5).forEach((rel, i) => {
    const fromEntity = result.entities.find(e => e.id === rel.from)
    const toEntity = result.entities.find(e => e.id === rel.to)
    console.log(`  ${i + 1}. ${fromEntity?.name || rel.from} --[${rel.type}]--> ${toEntity?.name || rel.to}`)
  })
  console.log()

  console.log('✨ Test Complete!')
}

main().catch(err => {
  console.error('❌ Error:', err.message)
  process.exit(1)
})
