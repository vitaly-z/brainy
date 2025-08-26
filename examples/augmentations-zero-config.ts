/**
 * Zero-Config Augmentations Example
 * 
 * Brainy's philosophy: Everything just works with zero configuration.
 * Augmentations extend Brainy without any complex setup.
 */

import { BrainyData } from '../src/index.js'
import { WALAugmentation } from '../src/augmentations/walAugmentation.js'
import { EntityRegistryAugmentation } from '../src/augmentations/entityRegistryAugmentation.js'
import { BatchProcessingAugmentation } from '../src/augmentations/batchProcessingAugmentation.js'
import { APIServerAugmentation } from '../src/augmentations/apiServerAugmentation.js'

async function main() {
  // Create Brainy - zero config!
  const brain = new BrainyData()
  
  // Register augmentations - they just work!
  brain.augmentations.register(new WALAugmentation())           // Durability
  brain.augmentations.register(new EntityRegistryAugmentation()) // Deduplication
  brain.augmentations.register(new BatchProcessingAugmentation()) // Performance
  brain.augmentations.register(new APIServerAugmentation())      // API exposure
  
  // Initialize Brainy (augmentations auto-initialize)
  await brain.init()
  
  // Use Brainy normally - augmentations work transparently
  await brain.add("Hello world", { type: "greeting" })
  
  // Batch operations automatically optimized
  await brain.addBatch([
    { content: "Item 1", metadata: { id: 1 } },
    { content: "Item 2", metadata: { id: 2 } },
    { content: "Item 3", metadata: { id: 3 } }
  ])
  
  // Search works with all augmentations active
  const results = await brain.search("hello")
  console.log('Search results:', results)
  
  // API server is running at http://localhost:3000
  console.log('✨ Brainy is running with:')
  console.log('  - Write-ahead logging (durability)')
  console.log('  - Entity deduplication (performance)')
  console.log('  - Batch optimization (speed)')
  console.log('  - REST/WebSocket/MCP APIs (connectivity)')
  console.log('')
  console.log('Zero configuration required!')
}

main().catch(console.error)