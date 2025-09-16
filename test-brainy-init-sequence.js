import { FileSystemStorage } from './dist/storage/adapters/fileSystemStorage.js';
import { HNSWIndexOptimized } from './dist/hnsw/hnswIndexOptimized.js';
import { MetadataIndexManager } from './dist/utils/metadataIndex.js';
import { GraphAdjacencyIndex } from './dist/graph/graphAdjacencyIndex.js';
import { cosineDistance } from './dist/utils/index.js';
import fs from 'fs/promises';

async function testBrainyInitSequence() {
  const testDir = './test-init-sequence';

  // Clean up
  try {
    await fs.rm(testDir, { recursive: true });
  } catch (e) {}

  console.log('=== Step 1: Create FileSystemStorage ===');
  const storage = new FileSystemStorage(testDir);

  console.log('=== Step 2: Initialize storage ===');
  await storage.init();

  // Check if any files were created
  console.log('\nChecking files after storage.init():');
  try {
    const nounsFiles = await fs.readdir(`${testDir}/nouns`);
    console.log('Nouns files:', nounsFiles);
  } catch (e) {
    console.log('Nouns dir error:', e.message);
  }

  console.log('\n=== Step 3: Create HNSWIndexOptimized ===');
  const index = new HNSWIndexOptimized({
    m: 16,
    efConstruction: 200,
    efSearch: 50,
    distanceFunction: cosineDistance
  }, cosineDistance, storage);

  console.log('\n=== Step 4: Create MetadataIndexManager ===');
  const metadataIndex = new MetadataIndexManager(storage);

  console.log('\n=== Step 5: Create GraphAdjacencyIndex ===');
  const graphIndex = new GraphAdjacencyIndex(storage);

  console.log('\n=== Step 6: Check for existing data (like rebuildIndexesIfNeeded) ===');
  const entities = await storage.getNouns({ pagination: { limit: 1 } });
  console.log('Initial check result:', {
    itemCount: entities.items.length,
    totalCount: entities.totalCount,
    hasMore: entities.hasMore
  });

  if (entities.totalCount === 0 || entities.items.length === 0) {
    console.log('No data found - would skip rebuild');
  } else {
    console.log('Data found - would trigger rebuild!');

    console.log('\n=== Step 7: Rebuild metadata index ===');
    console.log('Starting metadata index rebuild...');

    // This is where the infinite loop happens
    // Let's trace what happens in the rebuild
    let iterations = 0;
    let offset = 0;
    const limit = 25;

    while (iterations < 5) { // Limit iterations for testing
      iterations++;
      console.log(`\nIteration ${iterations}: offset=${offset}, limit=${limit}`);

      const result = await storage.getNouns({
        pagination: { offset, limit }
      });

      console.log(`Result: ${result.items.length} items, hasMore=${result.hasMore}`);

      if (result.items.length === 0 && result.hasMore) {
        console.log('🔴 BUG DETECTED: Empty items but hasMore=true!');
      }

      if (!result.hasMore || result.items.length === 0) {
        console.log('Breaking loop');
        break;
      }

      offset += limit;
    }
  }

  // Clean up
  await fs.rm(testDir, { recursive: true });
}

testBrainyInitSequence().catch(console.error);