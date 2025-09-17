#!/usr/bin/env node

/**
 * 🧠 Pre-compute Pattern Embeddings Script
 * 
 * This script pre-computes embeddings for all patterns and saves them to disk.
 * Run this once after adding new patterns to avoid runtime embedding costs.
 * 
 * How it works:
 * 1. Load all patterns from library.json
 * 2. Use Brainy's embedding model to encode each pattern's examples
 * 3. Average the example embeddings to get a robust pattern representation
 * 4. Save embeddings to patterns/embeddings.bin for instant loading
 * 
 * Benefits:
 * - Pattern matching becomes pure math (cosine similarity)
 * - No embedding model calls during query processing
 * - Patterns load instantly with pre-computed vectors
 */

import { Brainy } from '../brainy.js'
import patternData from '../patterns/library.json' assert { type: 'json' }
import * as fs from 'node:fs/promises'
import * as path from 'node:path'

async function precomputeEmbeddings() {
  console.log('🧠 Pre-computing pattern embeddings...')
  
  // Initialize Brainy with minimal config
  const brain = new Brainy({
    storage: 'memory',
    verbose: false
  })
  
  await brain.init()
  console.log('✅ Brainy initialized')
  
  const embeddings: Record<string, {
    patternId: string
    embedding: number[]
    examples: string[]
    averageMethod: string
  }> = {}
  
  let processedCount = 0
  const totalPatterns = patternData.patterns.length
  
  for (const pattern of patternData.patterns) {
    console.log(`\n📝 Processing pattern: ${pattern.id} (${++processedCount}/${totalPatterns})`)
    console.log(`   Category: ${pattern.category}`)
    console.log(`   Examples: ${pattern.examples.length}`)
    
    // Embed all examples
    const exampleEmbeddings: number[][] = []
    
    for (const example of pattern.examples) {
      try {
        const embedding = await brain.embed(example)
        exampleEmbeddings.push(embedding as number[])
        console.log(`   ✓ Embedded: "${example.substring(0, 50)}..."`)
      } catch (error) {
        console.error(`   ✗ Failed to embed: "${example}"`, error)
      }
    }
    
    if (exampleEmbeddings.length === 0) {
      console.warn(`   ⚠️ No embeddings generated for pattern ${pattern.id}`)
      continue
    }
    
    // Average the embeddings for a robust representation
    const avgEmbedding = averageVectors(exampleEmbeddings)
    
    embeddings[pattern.id] = {
      patternId: pattern.id,
      embedding: avgEmbedding,
      examples: pattern.examples,
      averageMethod: 'arithmetic_mean'
    }
    
    console.log(`   ✅ Generated ${avgEmbedding.length}-dimensional embedding`)
  }
  
  // Save embeddings to file
  const outputPath = path.join(process.cwd(), 'src', 'patterns', 'embeddings.json')
  await fs.writeFile(outputPath, JSON.stringify(embeddings, null, 2))
  
  console.log(`\n✅ Saved ${Object.keys(embeddings).length} pattern embeddings to ${outputPath}`)
  
  // Calculate storage size
  const stats = await fs.stat(outputPath)
  console.log(`📊 File size: ${(stats.size / 1024).toFixed(2)} KB`)
  
  // Print statistics
  console.log('\n📈 Embedding Statistics:')
  console.log(`   Total patterns: ${totalPatterns}`)
  console.log(`   Successfully embedded: ${Object.keys(embeddings).length}`)
  console.log(`   Failed: ${totalPatterns - Object.keys(embeddings).length}`)
  console.log(`   Embedding dimensions: ${Object.values(embeddings)[0]?.embedding.length || 0}`)
  
  await brain.close()
  console.log('\n✅ Complete!')
}

function averageVectors(vectors: number[][]): number[] {
  if (vectors.length === 0) return []
  
  const dim = vectors[0].length
  const avg = new Array(dim).fill(0)
  
  // Sum all vectors
  for (const vec of vectors) {
    for (let i = 0; i < dim; i++) {
      avg[i] += vec[i]
    }
  }
  
  // Divide by count to get average
  for (let i = 0; i < dim; i++) {
    avg[i] /= vectors.length
  }
  
  return avg
}

// Run the script
precomputeEmbeddings().catch(console.error)