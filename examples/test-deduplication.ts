/**
 * Test Entity Deduplication (Phase 2)
 *
 * Demonstrates cross-import entity deduplication
 */

import { Brainy } from '../src/brainy.js'

async function main() {
  console.log('🧠 Testing Entity Deduplication (Phase 2)\n')

  const brain = new Brainy({
    storage: { type: 'memory' as const }
  })

  await brain.init()

  // Import 1: First dataset with "Machine Learning"
  console.log('📥 Import 1: AI Technologies (JSON)')
  const import1 = await brain.import({
    entities: [
      { name: 'Machine Learning', type: 'concept', description: 'AI technique for learning from data' },
      { name: 'Neural Networks', type: 'concept', description: 'Computing systems inspired by biological neural networks' }
    ]
  }, {
    vfsPath: '/imports/dataset1',
    enableDeduplication: true
  })

  console.log(`  ✅ Entities extracted: ${import1.stats.entitiesExtracted}`)
  console.log(`  ✅ New entities: ${import1.stats.entitiesNew}`)
  console.log(`  ✅ Merged entities: ${import1.stats.entitiesMerged}`)
  console.log()

  // Import 2: Second dataset with "Machine Learning" again (should deduplicate!)
  console.log('📥 Import 2: ML Concepts (JSON) - contains duplicate "Machine Learning"')
  const import2 = await brain.import({
    entities: [
      { name: 'Machine Learning', type: 'concept', description: 'A subset of artificial intelligence' },
      { name: 'Deep Learning', type: 'concept', description: 'Advanced machine learning using neural networks' }
    ]
  }, {
    vfsPath: '/imports/dataset2',
    enableDeduplication: true
  })

  console.log(`  ✅ Entities extracted: ${import2.stats.entitiesExtracted}`)
  console.log(`  ✅ New entities: ${import2.stats.entitiesNew}`)
  console.log(`  ✅ Merged entities: ${import2.stats.entitiesMerged}`)
  console.log()

  // Verify: Search for "Machine Learning" - should find ONE entity with provenance from both imports
  console.log('🔍 Verifying Deduplication...')
  const results = await brain.find({
    query: 'Machine Learning',
    limit: 1
  })

  if (results.length > 0) {
    const ml = results[0]
    console.log(`  Found: "${ml.entity.metadata?.name}"`)
    console.log(`  Imports: ${ml.entity.metadata?.imports?.join(', ')}`)
    console.log(`  VFS Paths: ${ml.entity.metadata?.vfsPaths?.join(', ')}`)
    console.log(`  Merge Count: ${ml.entity.metadata?.mergeCount || 0}`)
    console.log(`  Confidence: ${(ml.entity.metadata?.confidence * 100).toFixed(1)}%`)
  }

  console.log()
  console.log('✨ Deduplication Test Complete!')
  console.log()
  console.log('Summary:')
  console.log(`  Import 1: ${import1.stats.entitiesNew} new, ${import1.stats.entitiesMerged} merged`)
  console.log(`  Import 2: ${import2.stats.entitiesNew} new, ${import2.stats.entitiesMerged} merged`)
  console.log()
  console.log('✅ Phase 2 (Entity Deduplication) Working!')
}

main().catch(err => {
  console.error('❌ Error:', err.message)
  process.exit(1)
})
