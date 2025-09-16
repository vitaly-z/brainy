import { FileSystemStorage } from './dist/storage/adapters/fileSystemStorage.js';
import fs from 'fs/promises';
import path from 'path';

async function testPagination() {
  const testDir = './test-storage-debug';

  // Clean up and create fresh directory
  try {
    await fs.rm(testDir, { recursive: true });
  } catch (e) {}
  await fs.mkdir(testDir, { recursive: true });

  console.log('Creating FileSystemStorage...');

  const storage = new FileSystemStorage(testDir);

  console.log('Initializing storage...');
  await storage.init();

  console.log('\n=== First getNouns call (limit: 1) ===');
  const result1 = await storage.getNouns({
    pagination: { limit: 1 }
  });
  console.log('Result 1:', {
    itemCount: result1.items.length,
    items: result1.items.map(i => i.id),
    hasMore: result1.hasMore,
    totalCount: result1.totalCount
  });

  console.log('\n=== Second getNouns call (offset: 0, limit: 25) ===');
  const result2 = await storage.getNouns({
    pagination: { offset: 0, limit: 25 }
  });
  console.log('Result 2:', {
    itemCount: result2.items.length,
    items: result2.items.map(i => i.id),
    hasMore: result2.hasMore,
    totalCount: result2.totalCount
  });

  console.log('\n=== Third getNouns call (offset: 25, limit: 25) ===');
  const result3 = await storage.getNouns({
    pagination: { offset: 25, limit: 25 }
  });
  console.log('Result 3:', {
    itemCount: result3.items.length,
    items: result3.items.map(i => i.id),
    hasMore: result3.hasMore,
    totalCount: result3.totalCount
  });

  console.log('\n=== Fourth getNouns call (offset: 50, limit: 25) ===');
  const result4 = await storage.getNouns({
    pagination: { offset: 50, limit: 25 }
  });
  console.log('Result 4:', {
    itemCount: result4.items.length,
    items: result4.items.map(i => i.id),
    hasMore: result4.hasMore,
    totalCount: result4.totalCount
  });

  // Check what's actually in the directories
  console.log('\n=== Checking actual files ===');
  const nounsDir = path.join(testDir, 'nouns');
  try {
    const files = await fs.readdir(nounsDir);
    console.log('Files in nouns directory:', files);
  } catch (e) {
    console.log('nouns directory error:', e.message);
  }

  // Clean up
  await fs.rm(testDir, { recursive: true });
}

testPagination().catch(console.error);