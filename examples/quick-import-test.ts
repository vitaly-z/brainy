/**
 * Quick test of unified import system
 */

import { Brainy } from '../src/brainy.js'

async function main() {
  console.log('Testing unified import system...')

  const brain = new Brainy({
    storage: { type: 'memory' as const }
  })

  await brain.init()

  // Test JSON import
  const result = await brain.import({
    name: 'Test Entity',
    description: 'This is a test'
  }, {
    vfsPath: '/test',
    createEntities: true,
    createRelationships: true
  })

  console.log('✅ Import successful!')
  console.log(`   Format: ${result.format}`)
  console.log(`   Entities: ${result.stats.entitiesExtracted}`)
  console.log(`   VFS files: ${result.stats.vfsFilesCreated}`)
  console.log(`   Processing time: ${result.stats.processingTime}ms`)
}

main().catch(err => {
  console.error('❌ Error:', err.message)
  console.error(err.stack)
  process.exit(1)
})
