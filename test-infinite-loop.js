import { Brainy } from './dist/index.js';
import fs from 'fs/promises';

async function test() {
  // Clean up any existing test data
  const testDir = './.test-brainy';
  try {
    await fs.rm(testDir, { recursive: true });
  } catch (e) {
    // Ignore if doesn't exist
  }

  console.log('Testing Brainy initialization...');

  const brain = new Brainy({
    storage: {
      type: 'filesystem',
      options: {
        path: testDir
      }
    },
    model: {
      type: 'accurate'  // Same as Sage
    },
    cache: true,
    verbose: false,
    silent: true
  });

  console.log('Calling brain.init()...');

  try {
    await brain.init();
    console.log('✅ Initialization completed successfully!');
  } catch (error) {
    console.error('❌ Initialization failed:', error);
  }

  // Clean up
  try {
    await fs.rm(testDir, { recursive: true });
  } catch (e) {
    // Ignore
  }
}

test().catch(console.error);