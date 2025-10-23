/**
 * Unified Import System Example
 *
 * Demonstrates the new brain.import() method that:
 * - Auto-detects file formats
 * - Creates both VFS structure and Knowledge Graph
 * - Links files to entities
 * - Works with all formats (Excel, PDF, CSV, JSON, Markdown)
 */

import { Brainy } from '../src/brainy.js'
import * as fs from 'fs'
import * as path from 'path'

async function main() {
  console.log('🧠 Brainy Unified Import System Demo\n')

  // Initialize Brainy with in-memory storage for demo
  const brain = new Brainy({
    storage: { type: 'memory' as const }
  })

  await brain.init()

  // Example 1: Import JSON object (no file needed!)
  console.log('📥 Example 1: Import JSON object')
  const jsonData = {
    entities: [
      {
        name: 'John Smith',
        type: 'person',
        description: 'Software engineer interested in AI and machine learning'
      },
      {
        name: 'San Francisco',
        type: 'location',
        description: 'City in California known for tech companies'
      }
    ]
  }

  const jsonResult = await brain.import(jsonData, {
    vfsPath: '/imports/demo-json',
    onProgress: (progress) => {
      console.log(`  ${progress.stage}: ${progress.message}`)
    }
  })

  console.log(`✅ Imported ${jsonResult.stats.entitiesExtracted} entities`)
  console.log(`   Created ${jsonResult.stats.graphNodesCreated} graph nodes`)
  console.log(`   Created ${jsonResult.stats.vfsFilesCreated} VFS files`)
  console.log()

  // Example 2: Import Markdown content
  console.log('📥 Example 2: Import Markdown content')
  const markdown = `
# AI Technologies

## Machine Learning
Machine learning is a subset of artificial intelligence that enables systems to learn from data.

## Neural Networks
Neural networks are computational models inspired by the human brain, used in deep learning.

## Natural Language Processing
NLP is a branch of AI that helps computers understand human language.
`

  const mdResult = await brain.import(markdown, {
    format: 'markdown',  // Optional - will auto-detect anyway
    vfsPath: '/imports/demo-markdown',
    onProgress: (progress) => {
      if (progress.stage === 'complete') {
        console.log(`  ✅ ${progress.message}`)
      }
    }
  })

  console.log(`✅ Imported ${mdResult.stats.entitiesExtracted} entities`)
  console.log(`   Format detected: ${mdResult.format} (confidence: ${mdResult.formatConfidence})`)
  console.log()

  // Example 3: Import from file (optional - requires local file)
  // Set TEST_EXCEL_FILE environment variable to test with your own Excel file
  const testFile = process.env.TEST_EXCEL_FILE
  if (testFile && fs.existsSync(testFile)) {
    console.log('📥 Example 3: Import Excel file (auto-detection)')

    const fileResult = await brain.import(testFile, {
      vfsPath: '/imports/excel-data',
      groupBy: 'type',  // Group by entity type (Places/, Characters/, etc.)
      onProgress: (progress) => {
        if (progress.stage === 'extracting' && progress.processed && progress.total) {
          process.stdout.write(`\r  Extracting: ${progress.processed}/${progress.total}`)
        } else if (progress.stage === 'complete') {
          console.log(`\n  ✅ ${progress.message}`)
        }
      }
    })

    console.log(`✅ Format: ${fileResult.format}`)
    console.log(`   Entities: ${fileResult.stats.entitiesExtracted}`)
    console.log(`   Relationships: ${fileResult.stats.graphEdgesCreated}`)
    console.log(`   VFS directories: ${fileResult.vfs.directories.length}`)
    console.log()
  }

  // Example 4: Query the imported data
  console.log('🔍 Querying imported entities...')

  // Find entities in the graph
  const machineEntity = await brain.find({
    query: 'machine learning',
    limit: 1
  })

  if (machineEntity.length > 0) {
    console.log(`   Found: "${machineEntity[0].metadata.name}"`)
    console.log(`   VFS Path: ${machineEntity[0].metadata.vfsPath}`)
    console.log(`   Type: ${machineEntity[0].metadata.type}`)
  }

  console.log()

  // Example 5: Browse VFS structure
  console.log('📂 VFS Structure:')
  try {
    const vfs = brain.vfs()

    // IMPORTANT: Initialize VFS before querying!
    // This is required even after import (idempotent - safe to call multiple times)
    await vfs.init()

    const rootContents = await vfs.readdir('/')
    console.log('   Root directories:', rootContents.filter(f => !f.includes('.')))

    if (rootContents.includes('imports')) {
      const imports = await vfs.readdir('/imports')
      console.log('   Import directories:', imports)
    }
  } catch (error: any) {
    console.log(`   Error: ${error.message}`)
  }

  console.log()
  console.log('✨ Demo complete!')
  console.log()
  console.log('Key features demonstrated:')
  console.log('  ✅ Auto-detection of formats (JSON, Markdown, Excel)')
  console.log('  ✅ Dual storage (VFS + Knowledge Graph)')
  console.log('  ✅ Entity extraction and relationship inference')
  console.log('  ✅ VFS files linked to graph entities')
  console.log('  ✅ Simple unified API: brain.import()')
}

main().catch(console.error)
