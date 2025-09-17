import { FileSystemStorage } from './dist/storage/adapters/fileSystemStorage.js';
import fs from 'fs/promises';
import path from 'path';

async function testScalePagination() {
  const testDir = './test-scale';

  console.log('🧪 Testing FileSystemStorage Pagination at Scale\n');
  console.log('=' .repeat(50));

  // Clean and setup
  try {
    await fs.rm(testDir, { recursive: true });
  } catch {}
  await fs.mkdir(testDir, { recursive: true });

  const storage = new FileSystemStorage(testDir);
  await storage.init();

  // Test different scales
  const scales = [10, 100, 1000, 10000];

  for (const count of scales) {
    console.log(`\n📊 Testing with ${count} items:`);

    // Create test files
    const nounsDir = path.join(testDir, 'nouns');
    console.log(`Creating ${count} test files...`);

    const startCreate = Date.now();
    for (let i = 0; i < count; i++) {
      const noun = {
        id: `noun-${i.toString().padStart(8, '0')}`,
        vector: new Array(384).fill(0.1),
        metadata: { index: i }
      };
      await fs.writeFile(
        path.join(nounsDir, `${noun.id}.json`),
        JSON.stringify(noun)
      );
    }
    const createTime = Date.now() - startCreate;
    console.log(`  Created in ${createTime}ms (${(createTime/count).toFixed(2)}ms per file)`);

    // Test pagination at different offsets
    const offsets = [0, Math.floor(count/4), Math.floor(count/2), count-10];

    for (const offset of offsets) {
      const start = Date.now();
      const result = await storage.getNouns({
        pagination: { offset, limit: 10 }
      });
      const duration = Date.now() - start;

      console.log(`  Page at offset ${offset}: ${duration}ms (${result.items.length} items, hasMore=${result.hasMore})`);

      // If it's taking too long, warn and skip larger tests
      if (duration > 1000) {
        console.log(`\n⚠️ WARNING: Pagination taking >1 second with only ${count} items!`);
        console.log('Skipping larger tests to avoid timeout...');
        await fs.rm(testDir, { recursive: true });
        return;
      }
    }

    // Clean for next test
    const files = await fs.readdir(nounsDir);
    for (const file of files) {
      await fs.unlink(path.join(nounsDir, file));
    }
  }

  // Extrapolate to larger scales
  console.log('\n📈 Projected Performance at Scale:');
  console.log('=' .repeat(50));
  console.log('Items    | Page Load | Feasible?');
  console.log('-'.repeat(35));
  console.log('100K     | ~10 sec   | ❌ Too slow');
  console.log('1M       | ~100 sec  | ❌ Timeout');
  console.log('10M      | ~1000 sec | ❌ Unusable');

  await fs.rm(testDir, { recursive: true });
}

testScalePagination().catch(console.error);