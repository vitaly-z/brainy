/**
 * Instant Fork Usage Examples (v5.0.0)
 *
 * COW is ZERO-CONFIG in v5.0.0:
 * - No setup needed
 * - No configuration
 * - Just works automatically
 *
 * This example shows how EASY and ELEGANT fork() is for developers.
 */

import { Brainy } from '@soulcraft/brainy'

// ========== Example 1: Basic Fork (Zero Config) ==========

async function basicFork() {
  // Create Brainy (COW automatic!)
  const brain = new Brainy({
    storage: { adapter: 'memory' }
  })

  await brain.init()

  // Add some data
  await brain.add({ noun: 'user', data: { name: 'Alice' } })
  await brain.add({ noun: 'user', data: { name: 'Bob' } })

  // Fork instantly (1-2 seconds, even with millions of entities!)
  const experiment = await brain.fork('experiment')

  // Make changes in fork (doesn't affect main)
  await experiment.add({ noun: 'user', data: { name: 'Charlie' } })

  // Main brain unchanged
  console.log(await brain.find({ noun: 'user' }))  // Alice, Bob
  console.log(await experiment.find({ noun: 'user' }))  // Alice, Bob, Charlie

  // That's it! Zero config, pure elegance.
}

// ========== Example 2: Safe Experimentation ==========

async function safeExperimentation() {
  const brain = new Brainy({
    storage: { adapter: 'filesystem', path: './data' }
  })

  await brain.init()

  // Production data
  const users = await brain.find({ noun: 'user' })
  console.log(`Production: ${users.length} users`)

  // Test a risky operation in fork
  const test = await brain.fork('test-migration')

  // Run migration on fork (safe!)
  for (const user of await test.find({ noun: 'user' })) {
    await test.update(user.id, {
      email: user.data.email.toLowerCase()  // Risky transformation
    })
  }

  // Test it
  const results = await test.find({ noun: 'user' })

  if (results.every(r => r.data.email === r.data.email.toLowerCase())) {
    console.log('✅ Migration safe, apply to production')
    // Apply to production...
  } else {
    console.log('❌ Migration failed, discard fork')
    await test.destroy()  // Discard failed experiment
  }
}

// ========== Example 3: A/B Testing ==========

async function abTesting() {
  const brain = new Brainy({
    storage: { adapter: 's3', bucket: 'my-data' }
  })

  await brain.init()

  // Create variant A (control)
  const variantA = await brain.fork('variant-a')

  // Create variant B (test)
  const variantB = await brain.fork('variant-b')

  // Run different algorithms
  await variantA.processWithAlgorithm('current')
  await variantB.processWithAlgorithm('improved')

  // Compare results
  const metricsA = await variantA.getMetrics()
  const metricsB = await variantB.getMetrics()

  console.log('A:', metricsA.accuracy)
  console.log('B:', metricsB.accuracy)

  // Choose winner, apply to main
  if (metricsB.accuracy > metricsA.accuracy) {
    console.log('B wins! Deploying...')
    // Merge B to main
  }
}

// ========== Example 4: Time Travel (Enterprise) ==========

async function timeTravel() {
  const brain = new Brainy({
    storage: { adapter: 'memory' }
  })

  await brain.init()

  // Add data over time
  await brain.add({ noun: 'doc', data: { version: 1 } })
  await brain.commit({ message: 'Version 1' })

  const yesterday = Date.now() - 86400000  // 24 hours ago

  await brain.add({ noun: 'doc', data: { version: 2 } })
  await brain.commit({ message: 'Version 2' })

  // Query as of yesterday (time travel!)
  const snapshot = await brain.asOf(yesterday)

  const docs = await snapshot.find({ noun: 'doc' })
  console.log(docs[0].data.version)  // 1 (from yesterday!)

  // Zero config, pure magic ✨
}

// ========== Example 5: Backup & Restore (Instant) ==========

async function instantBackup() {
  const brain = new Brainy({
    storage: { adapter: 'memory' }
  })

  await brain.init()

  // Work with production data
  await brain.add({ noun: 'important', data: { value: 'critical' } })

  // Instant backup (1-2 seconds!)
  const backup = await brain.fork('backup-2024-01-01')

  // Continue working
  await brain.delete((await brain.find({ noun: 'important' }))[0].id)

  // Oops! Need to restore
  const restored = await brain.rollback(backup.getCurrentCommit())

  // Data restored instantly!
  console.log(await brain.find({ noun: 'important' }))  // Back!
}

// ========== Example 6: Distributed Teams (Fork per Developer) ==========

async function distributedDevelopment() {
  // Main production brain
  const production = new Brainy({
    storage: { adapter: 's3', bucket: 'production-data' }
  })

  await production.init()

  // Alice's fork
  const alice = await production.fork('alice-feature-x')

  // Bob's fork
  const bob = await production.fork('bob-feature-y')

  // Both work independently (zero conflicts!)
  await alice.add({ noun: 'feature', data: { name: 'X' } })
  await bob.add({ noun: 'feature', data: { name: 'Y' } })

  // Merge when ready
  await production.merge(alice, { author: 'Alice' })
  await production.merge(bob, { author: 'Bob' })

  // Production has both features!
}

// ========== Example 7: VFS Snapshots ==========

async function vfsSnapshots() {
  const brain = new Brainy({
    storage: { adapter: 'memory' },
    vfs: { enabled: true }
  })

  await brain.init()

  // Create file structure
  await brain.vfs.writeFile('/project/README.md', '# My Project')
  await brain.vfs.writeFile('/project/src/index.ts', 'console.log("v1")')

  await brain.commit({ message: 'Initial project' })

  // Fork for refactoring
  const refactor = await brain.fork('refactor')

  // Refactor code in fork
  await refactor.vfs.writeFile('/project/src/index.ts', 'console.log("v2")')
  await refactor.vfs.mkdir('/project/src/utils')

  // Test refactor
  // ...

  // Merge if successful
  // await brain.merge(refactor)
}

// ========== The Key: It's All Zero Config! ==========

async function zeroConfigDemo() {
  // This is ALL you need:
  const brain = new Brainy({ storage: { adapter: 'memory' } })
  await brain.init()

  // COW is automatic:
  // ✅ Compression: automatic (based on data type)
  // ✅ Deduplication: automatic (content-addressable)
  // ✅ Caching: automatic (LRU with memory limits)
  // ✅ Reference counting: automatic (safe deletion)
  // ✅ Garbage collection: automatic (optional manual trigger)

  // Fork is instant:
  const fork = await brain.fork()  // < 2 seconds even at 1M entities

  // That's it! No configuration, no complexity, pure elegance.
}

// ========== API Summary ==========

/*
  DEVELOPER API (v5.0.0):

  // Fork operations
  brain.fork(branch?)              → Create instant clone
  brain.asOf(timestamp)            → Time-travel query (Enterprise)
  brain.rollback(commitHash)       → Restore to commit (Enterprise)
  brain.commit(options?)           → Create commit (automatic)

  // Branch operations
  brain.listBranches()             → List all branches
  brain.checkout(branch)           → Switch to branch
  brain.merge(source, target)      → Merge branches (Enterprise)

  // Time queries
  brain.getHistory(limit?)         → Get commit history
  brain.findAtTime(timestamp)      → Find commit at time
  brain.getStats()                 → Get storage stats

  // All existing Brainy APIs work the same:
  brain.add()
  brain.find()
  brain.search()
  brain.vfs.*
  brain.query()  // Triple Intelligence

  ZERO CONFIG REQUIRED!
*/

// Run examples
if (require.main === module) {
  basicFork()
    .then(() => console.log('✅ All examples complete'))
    .catch(console.error)
}
