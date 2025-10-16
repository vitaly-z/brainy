/**
 * Import with Progress Callbacks Example
 *
 * Demonstrates real-time progress tracking during both:
 * 1. Entity extraction phase
 * 2. Relationship building phase
 *
 * Includes visual progress bars and ETA estimation
 */

import { BrainyData } from '../src/brainy.js'
import * as fs from 'fs'

// Simple progress bar rendering
function renderProgressBar(current: number, total: number, label: string): string {
  const percentage = total > 0 ? (current / total) * 100 : 0
  const barLength = 40
  const filled = Math.floor((percentage / 100) * barLength)
  const empty = barLength - filled
  const bar = '█'.repeat(filled) + '░'.repeat(empty)
  return `${label}: [${bar}] ${current}/${total} (${percentage.toFixed(1)}%)`
}

// Calculate ETA
function formatETA(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`
  if (ms < 60000) return `${Math.round(ms / 1000)}s`
  return `${Math.round(ms / 60000)}m ${Math.round((ms % 60000) / 1000)}s`
}

async function main() {
  console.log('🧠 Brainy Import with Progress Callbacks Example\n')

  // Initialize Brainy
  const brain = new BrainyData({
    storage: { type: 'memory' },
    model: { type: 'fast', precision: 'q8' }
  })

  await brain.init()
  console.log('✓ Brainy initialized\n')

  // Sample CSV data with many relationships
  const csvData = `term,definition,category,related_to
Entity Extraction,The process of identifying and classifying named entities in text,NLP,Relationship Inference
Relationship Inference,Detecting semantic relationships between entities,NLP,Entity Extraction
Knowledge Graph,A structured representation of knowledge as entities and relationships,Data,Entity Extraction
Neural Network,Machine learning model inspired by biological neural networks,AI,Deep Learning
Deep Learning,Subset of machine learning using neural networks with multiple layers,AI,Neural Network
Natural Language,Human language as opposed to computer language,NLP,Entity Extraction
Embedding,Dense vector representation of data,NLP,Neural Network
Vector Database,Database optimized for vector similarity search,Data,Embedding
Semantic Search,Search based on meaning rather than keywords,Search,Embedding
HNSW Index,Hierarchical Navigable Small World graph for fast similarity search,Algorithm,Vector Database`

  // Create temporary CSV file
  const tempFile = '/tmp/brainy-progress-example.csv'
  fs.writeFileSync(tempFile, csvData)

  console.log('📊 Importing CSV file with progress tracking...\n')

  // Track progress phases
  let startTime = Date.now()
  let phaseStartTime = Date.now()
  let lastPhase: string | undefined = undefined

  try {
    const result = await brain.import(tempFile, {
      format: 'csv',
      createEntities: true,
      createRelationships: true,
      enableNeuralExtraction: true,
      enableRelationshipInference: true,
      enableConceptExtraction: true,
      onProgress: (progress) => {
        // Clear previous line
        process.stdout.write('\r\x1b[K')

        // Detect phase changes
        if (lastPhase && progress.phase && lastPhase !== progress.phase) {
          const phaseDuration = Date.now() - phaseStartTime
          console.log(`\n✓ ${lastPhase} phase completed in ${formatETA(phaseDuration)}\n`)
          phaseStartTime = Date.now()
        }
        lastPhase = progress.phase

        // Render appropriate progress bar based on phase
        if (progress.phase === 'extraction') {
          const bar = renderProgressBar(
            progress.current || progress.processed || 0,
            progress.total || 0,
            'Extracting entities'
          )
          process.stdout.write(bar)

          if (progress.eta) {
            process.stdout.write(` | ETA: ${formatETA(progress.eta)}`)
          }
        } else if (progress.phase === 'relationships') {
          const bar = renderProgressBar(
            progress.current || progress.relationships || 0,
            progress.total || 0,
            'Building relationships'
          )
          process.stdout.write(bar)

          if (progress.entities) {
            process.stdout.write(` | ${progress.entities} entities`)
          }
        } else if (progress.stage === 'storing-graph' && !progress.phase) {
          // Generic storing phase
          process.stdout.write(progress.message)
        } else {
          // Other stages
          process.stdout.write(`${progress.stage}: ${progress.message}`)
        }
      }
    })

    // Final summary
    console.log('\n')
    const totalDuration = Date.now() - startTime
    console.log(`✓ Import complete in ${formatETA(totalDuration)}`)
    console.log()
    console.log('📈 Import Results:')
    console.log(`  - Entities created: ${result.entities.length}`)
    console.log(`  - Relationships created: ${result.relationships.length}`)
    console.log(`  - Files created: ${result.vfs.files.length}`)
    console.log(`  - Format detected: ${result.format} (${(result.formatConfidence * 100).toFixed(1)}% confidence)`)
    console.log()

    // Show phase breakdown
    console.log('📊 Performance Breakdown:')
    console.log(`  - Total time: ${formatETA(totalDuration)}`)
    console.log(`  - Average time per entity: ${Math.round(totalDuration / result.entities.length)}ms`)
    if (result.relationships.length > 0) {
      console.log(`  - Average time per relationship: ${Math.round(totalDuration / result.relationships.length)}ms`)
    }
    console.log()

    // Sample some created entities
    console.log('🔍 Sample Entities:')
    for (let i = 0; i < Math.min(3, result.entities.length); i++) {
      const entity = result.entities[i]
      console.log(`  - ${entity.name} (${entity.type})`)
      if (entity.vfsPath) {
        console.log(`    VFS: ${entity.vfsPath}`)
      }
    }
    console.log()

    // Sample some created relationships
    console.log('🔗 Sample Relationships:')
    for (let i = 0; i < Math.min(3, result.relationships.length); i++) {
      const rel = result.relationships[i]
      const fromEntity = result.entities.find(e => e.id === rel.from)
      const toEntity = result.entities.find(e => e.id === rel.to)
      if (fromEntity && toEntity) {
        console.log(`  - ${fromEntity.name} → [${rel.type}] → ${toEntity.name}`)
      }
    }
    console.log()

    console.log('✓ Example completed successfully!')

  } catch (error) {
    console.error('\n❌ Import failed:', error)
    throw error
  } finally {
    // Cleanup
    try {
      fs.unlinkSync(tempFile)
    } catch {}
  }
}

// Run example
main().catch(error => {
  console.error('Fatal error:', error)
  process.exit(1)
})
