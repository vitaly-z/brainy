/**
 * Directory Import with Entity Extraction Caching Example
 *
 * Demonstrates:
 * - Importing directories with progress tracking
 * - Entity extraction caching for performance
 * - Relationship detection with confidence scores
 * - Cache statistics monitoring
 */

import { Brainy, NounType, VerbType } from '../src/brainy.js'
import { DirectoryImporter } from '../src/vfs/importers/DirectoryImporter.js'
import { ProgressTracker, formatProgress } from '../src/types/progress.types.js'
import { detectRelationshipsWithConfidence } from '../src/neural/relationshipConfidence.js'

async function main() {
  console.log('🧠 Brainy 3.21.0 - Directory Import with Caching Example\n')

  // Initialize Brainy
  const brain = new Brainy({ verbose: false })
  await brain.init()

  console.log('✅ Brainy initialized\n')

  // Example 1: Import directory with entity extraction caching
  console.log('📁 Example 1: Import Directory with Caching\n')

  const vfs = brain.vfs
  const importer = new DirectoryImporter(vfs, brain)

  // Progress tracking
  const tracker = ProgressTracker.create(100)
  tracker.start()

  try {
    // Import with progress (using async generator)
    console.log('Importing directory...')

    let filesProcessed = 0
    for await (const progress of importer.importStream('./examples', {
      batchSize: 10,
      recursive: true,
      generateEmbeddings: true,
      extractMetadata: true
    })) {
      if (progress.type === 'progress') {
        filesProcessed = progress.processed
        const trackedProgress = tracker.update(progress.processed, progress.current)
        console.log(`  ${formatProgress(trackedProgress)}`)
      } else if (progress.type === 'complete') {
        console.log(`\n✅ Import complete! Processed ${progress.processed} files\n`)
      } else if (progress.type === 'error') {
        console.error(`❌ Error: ${progress.error?.message}`)
      }
    }

    tracker.complete({ filesProcessed })

  } catch (error) {
    console.error('Import failed:', error)
  }

  // Example 2: Entity extraction with caching
  console.log('\n📝 Example 2: Entity Extraction with Caching\n')

  const sampleText = `
    John Smith created the user authentication system for the application.
    The authentication system uses JWT tokens and bcrypt for password hashing.
    Mary Johnson manages the backend team that maintains the system.
    The system was built using Node.js and PostgreSQL database.
  `

  console.log('First extraction (cache miss):')
  const startTime1 = Date.now()
  const entities1 = await brain.neural.extractor.extract(sampleText, {
    types: [NounType.Person, NounType.Service, NounType.Technology],
    confidence: 0.7,
    cache: {
      enabled: true,
      ttl: 7 * 24 * 60 * 60 * 1000,  // 7 days
      invalidateOn: 'hash'
    }
  })
  const time1 = Date.now() - startTime1
  console.log(`  Extracted ${entities1.length} entities in ${time1}ms`)
  console.log(`  Entities: ${entities1.map(e => e.text).join(', ')}\n`)

  console.log('Second extraction (cache hit):')
  const startTime2 = Date.now()
  const entities2 = await brain.neural.extractor.extract(sampleText, {
    types: [NounType.Person, NounType.Service, NounType.Technology],
    confidence: 0.7,
    cache: {
      enabled: true,
      invalidateOn: 'hash'
    }
  })
  const time2 = Date.now() - startTime2
  console.log(`  Extracted ${entities2.length} entities in ${time2}ms`)
  console.log(`  Speedup: ${Math.round(time1 / time2)}x faster!\n`)

  // Show cache statistics
  const cacheStats = brain.neural.extractor.getCacheStats()
  console.log('📊 Cache Statistics:')
  console.log(`  Hits: ${cacheStats.hits}`)
  console.log(`  Misses: ${cacheStats.misses}`)
  console.log(`  Hit Rate: ${(cacheStats.hitRate * 100).toFixed(1)}%`)
  console.log(`  Total Entries: ${cacheStats.totalEntries}`)
  console.log(`  Avg Entities per Entry: ${cacheStats.averageEntitiesPerEntry}\n`)

  // Example 3: Relationship detection with confidence
  console.log('🔗 Example 3: Relationship Detection with Confidence\n')

  const relationships = detectRelationshipsWithConfidence(
    entities1,
    sampleText,
    {
      minConfidence: 0.6,
      maxDistance: 100,
      useProximityBoost: true,
      usePatternMatching: true,
      useStructuralAnalysis: true
    }
  )

  console.log(`Detected ${relationships.length} relationships:\n`)
  for (const rel of relationships.slice(0, 5)) {  // Show top 5
    console.log(`  ${rel.sourceEntity.text} --[${rel.verbType}]--> ${rel.targetEntity.text}`)
    console.log(`    Confidence: ${(rel.confidence * 100).toFixed(1)}%`)
    console.log(`    Evidence: ${rel.evidence.reasoning}`)
    console.log(`    Method: ${rel.evidence.method}`)
    console.log(`    Source: "${rel.evidence.sourceText?.substring(0, 60)}..."\n`)
  }

  // Example 4: Create relationships in graph with confidence
  console.log('📊 Example 4: Creating Relationships in Graph\n')

  const createdRelations = []
  for (const rel of relationships.slice(0, 3)) {  // Create top 3
    try {
      // Add entities to brain
      const sourceId = await brain.add({
        data: rel.sourceEntity.text,
        type: rel.sourceEntity.type,
        metadata: {
          confidence: rel.sourceEntity.confidence,
          extractedFrom: 'sample text'
        }
      })

      const targetId = await brain.add({
        data: rel.targetEntity.text,
        type: rel.targetEntity.type,
        metadata: {
          confidence: rel.targetEntity.confidence,
          extractedFrom: 'sample text'
        }
      })

      // Create relationship with confidence
      const relationId = await brain.relate({
        from: sourceId,
        to: targetId,
        type: rel.verbType,
        confidence: rel.confidence,
        evidence: rel.evidence,
        metadata: {
          autoDetected: true,
          detectedAt: new Date().toISOString()
        }
      })

      createdRelations.push(relationId)
      console.log(`  ✅ Created: ${rel.sourceEntity.text} → ${rel.targetEntity.text}`)
    } catch (error) {
      console.error(`  ❌ Failed to create relationship:`, error)
    }
  }

  console.log(`\n✅ Created ${createdRelations.length} relationships in knowledge graph`)

  // Example 5: Query relationships by confidence
  console.log('\n🔍 Example 5: Query High-Confidence Relationships\n')

  const allRelations = await brain.getRelations({
    limit: 100
  })

  const highConfidence = allRelations.filter(r => (r.confidence || 0) >= 0.7)
  console.log(`Found ${highConfidence.length} high-confidence relationships (≥70%):\n`)

  for (const rel of highConfidence.slice(0, 5)) {
    console.log(`  ${rel.from} → ${rel.to} (${rel.type})`)
    console.log(`    Confidence: ${((rel.confidence || 0) * 100).toFixed(1)}%`)
    if (rel.evidence) {
      console.log(`    Method: ${rel.evidence.method}`)
      console.log(`    Reasoning: ${rel.evidence.reasoning}\n`)
    }
  }

  // Example 6: Cache management
  console.log('🧹 Example 6: Cache Management\n')

  console.log('Cache operations:')

  // Cleanup expired entries
  const cleaned = brain.neural.extractor.cleanupCache()
  console.log(`  Cleaned ${cleaned} expired entries`)

  // Invalidate specific cache entry
  const invalidated = brain.neural.extractor.invalidateCache('hash:abc123')
  console.log(`  Invalidated entry: ${invalidated}`)

  // Get final stats
  const finalStats = brain.neural.extractor.getCacheStats()
  console.log(`  Final cache size: ${finalStats.totalEntries} entries`)
  console.log(`  Memory used: ~${Math.round(finalStats.cacheSize / 1024)}KB`)

  // Clear all cache (optional)
  // brain.neural.extractor.clearCache()
  // console.log('  Cleared entire cache')

  console.log('\n✨ Example complete!')
  console.log('\n📚 Key Takeaways:')
  console.log('  • Entity extraction caching provides 10-100x speedup on repeated content')
  console.log('  • Progress tracking gives real-time feedback for long operations')
  console.log('  • Relationship confidence helps filter low-quality connections')
  console.log('  • Evidence tracking makes relationships explainable and debuggable')
  console.log('  • All features are opt-in and backward compatible')
}

// Run example
main().catch(console.error)
