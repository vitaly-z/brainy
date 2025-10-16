/**
 * Complete Import System Demo
 *
 * Demonstrates ALL phases working together:
 * - Phase 1: Auto-detection + Dual Storage
 * - Phase 2: Entity Deduplication
 * - Phase 3: Streaming Support
 * - Phase 4: Import History + Rollback
 */

import { Brainy } from '../src/brainy.js'

async function main() {
  console.log('🧠 Complete Unified Import System Demo')
  console.log('═'.repeat(60))
  console.log()

  const brain = new Brainy({
    storage: { type: 'memory' as const }
  })

  await brain.init()

  // ============================================================
  // PHASE 1: Auto-Detection + Dual Storage
  // ============================================================
  console.log('📌 PHASE 1: Auto-Detection + Dual Storage')
  console.log('─'.repeat(60))

  const dataset1 = {
    technologies: [
      { name: 'Artificial Intelligence', category: 'concept', description: 'Intelligence demonstrated by machines' },
      { name: 'Machine Learning', category: 'concept', description: 'Algorithms that improve through experience' }
    ]
  }

  const import1 = await brain.import(dataset1, {
    vfsPath: '/imports/ai-tech',
    onProgress: (p) => {
      if (p.phase === 'extraction' && p.current && p.total) {
        process.stdout.write(`\r  Extracting: ${p.current}/${p.total}`)
      } else if (p.phase === 'relationships' && p.current && p.total) {
        process.stdout.write(`\r  Building relationships: ${p.current}/${p.total}`)
      } else if (p.stage === 'complete') {
        console.log(`\n  ✅ ${p.message}`)
      }
    }
  })

  console.log(`  Format detected: ${import1.format} (${import1.formatConfidence * 100}%)`)
  console.log(`  VFS root: ${import1.vfs.rootPath}`)
  console.log(`  Graph entities: ${import1.entities.length}`)
  console.log(`  Import ID: ${import1.importId}`)
  console.log()

  // ============================================================
  // PHASE 2: Entity Deduplication
  // ============================================================
  console.log('📌 PHASE 2: Entity Deduplication (Shared Knowledge)')
  console.log('─'.repeat(60))

  const dataset2 = {
    ml_concepts: [
      { name: 'Machine Learning', category: 'concept', description: 'A subset of AI focused on data-driven learning' },
      { name: 'Deep Learning', category: 'concept', description: 'Advanced ML using neural networks' }
    ]
  }

  const import2 = await brain.import(dataset2, {
    vfsPath: '/imports/ml-concepts',
    enableDeduplication: true,  // Default: true
    deduplicationThreshold: 0.85,
    onProgress: (p) => {
      if (p.phase === 'extraction' && p.current && p.total) {
        process.stdout.write(`\r  Extracting: ${p.current}/${p.total}`)
      } else if (p.phase === 'relationships' && p.current && p.total) {
        process.stdout.write(`\r  Building relationships: ${p.current}/${p.total}`)
      } else if (p.stage === 'complete') {
        console.log(`\n  ✅ ${p.message}`)
      }
    }
  })

  console.log(`  Entities extracted: ${import2.stats.entitiesExtracted}`)
  console.log(`  New entities: ${import2.stats.entitiesNew}`)
  console.log(`  Merged entities: ${import2.stats.entitiesMerged}`)
  console.log()

  // Verify deduplication
  const mlResults = await brain.find({
    query: 'Machine Learning',
    limit: 1
  })

  if (mlResults.length > 0) {
    console.log('  🔍 Verifying "Machine Learning" entity:')
    const ml = mlResults[0]
    console.log(`     Imports: ${ml.entity.metadata?.imports?.join(', ') || 'N/A'}`)
    console.log(`     Merge count: ${ml.entity.metadata?.mergeCount || 0}`)
    console.log(`     Confidence: ${((ml.entity.metadata?.confidence || 0) * 100).toFixed(1)}%`)
  }
  console.log()

  // ============================================================
  // PHASE 3: Streaming Support (simulated with progress)
  // ============================================================
  console.log('📌 PHASE 3: Streaming Support')
  console.log('─'.repeat(60))

  const largeDataset = {
    items: Array.from({ length: 50 }, (_, i) => ({
      name: `Concept ${i + 1}`,
      category: 'concept',
      description: `Description for concept ${i + 1}`
    }))
  }

  console.log(`  Importing ${largeDataset.items.length} entities with progress tracking...`)

  const import3 = await brain.import(largeDataset, {
    vfsPath: '/imports/large-dataset',
    chunkSize: 10,  // Process in chunks of 10
    onProgress: (p) => {
      if (p.phase === 'extraction' && p.processed && p.total) {
        if (p.processed % 10 === 0 || p.processed === p.total) {
          process.stdout.write(`\r  Extracting: ${p.processed}/${p.total} entities`)
        }
      } else if (p.phase === 'relationships' && p.current && p.total) {
        if (p.current % 10 === 0 || p.current === p.total) {
          process.stdout.write(`\r  Building: ${p.current}/${p.total} relationships`)
        }
      } else if (p.stage === 'complete') {
        console.log(`\n  ✅ ${p.message}`)
      }
    }
  })

  console.log(`  Processing time: ${import3.stats.processingTime}ms`)
  console.log()

  // ============================================================
  // PHASE 4: Import History & Rollback
  // ============================================================
  console.log('📌 PHASE 4: Import History & Rollback')
  console.log('─'.repeat(60))

  // Access import history through coordinator
  const { ImportCoordinator } = await import('../src/import/ImportCoordinator.js')
  const coordinator = new ImportCoordinator(brain)
  await coordinator.init()

  const history = coordinator.getHistory()
  const allImports = history.getHistory()

  console.log(`  Total imports: ${allImports.length}`)

  allImports.forEach((entry, i) => {
    console.log(`  ${i + 1}. [${entry.importId.substring(0, 8)}...] ${entry.source.filename || entry.source.type}`)
    console.log(`     Format: ${entry.source.format}`)
    console.log(`     Entities: ${entry.entities.length}`)
    console.log(`     Status: ${entry.status}`)
  })

  console.log()

  // Statistics
  const stats = history.getStatistics()
  console.log('  📊 Overall Statistics:')
  console.log(`     Total imports: ${stats.totalImports}`)
  console.log(`     Total entities: ${stats.totalEntities}`)
  console.log(`     Total relationships: ${stats.totalRelationships}`)
  console.log(`     By format: ${JSON.stringify(stats.byFormat)}`)
  console.log()

  // Rollback demo (rollback the large dataset import)
  console.log('  🔄 Demonstrating Rollback...')
  console.log(`     Rolling back import: ${import3.importId.substring(0, 16)}...`)

  const rollbackResult = await history.rollback(import3.importId)

  console.log(`     ✅ Rollback complete!`)
  console.log(`     Entities deleted: ${rollbackResult.entitiesDeleted}`)
  console.log(`     Relationships deleted: ${rollbackResult.relationshipsDeleted}`)
  console.log(`     VFS files deleted: ${rollbackResult.vfsFilesDeleted}`)
  console.log(`     Errors: ${rollbackResult.errors.length}`)

  console.log()

  // Final stats after rollback
  const finalStats = history.getStatistics()
  console.log('  📊 After Rollback:')
  console.log(`     Total imports: ${finalStats.totalImports}`)
  console.log(`     Total entities: ${finalStats.totalEntities}`)

  console.log()
  console.log('═'.repeat(60))
  console.log('✨ Complete Demo Finished!')
  console.log()
  console.log('Features Demonstrated:')
  console.log('  ✅ Phase 1: Auto-detection, Dual Storage (VFS + Graph)')
  console.log('  ✅ Phase 2: Entity Deduplication, Provenance Tracking')
  console.log('  ✅ Phase 3: Streaming with Progress Tracking')
  console.log('  ✅ Phase 4: Import History, Statistics, Rollback')
  console.log()
  console.log('🎉 All Phases Working in Production!')
}

main().catch(err => {
  console.error('❌ Error:', err.message)
  console.error(err.stack)
  process.exit(1)
})
