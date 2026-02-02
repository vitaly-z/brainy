/**
 * Test for createEntities default value bug fix (v4.3.2)
 *
 * Bug: If createEntities was undefined, it defaulted to false
 * Fix: Now defaults to true when undefined
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { Brainy, NounType } from '../../src/index.js'
import * as fs from 'fs'
import * as path from 'path'

describe('createEntities Default Value (v4.3.2 Bug Fix)', () => {
  let brain: Brainy
  const testDir = './test-create-entities-default'

  beforeEach(async () => {
    // Clean up test directory
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true })
    }

    brain = new Brainy({
      storage: {
        type: 'filesystem',
        path: testDir
      }
    })
    await brain.init()
  })

  afterEach(() => {
    // Clean up test directory
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true })
    }
  })

  it('should create graph entities when createEntities is undefined (default behavior)', async () => {
    // Create a minimal CSV to import
    const csvContent = `Name,Type
Alice,person
Bob,person
New York,location`

    const csvPath = path.join(testDir, 'test.csv')
    fs.mkdirSync(testDir, { recursive: true })
    fs.writeFileSync(csvPath, csvContent)

    // Import WITHOUT specifying createEntities (should default to true)
    const result = await brain.import(csvPath, {
      vfsPath: '/imports/test',
      groupBy: 'flat'
      // NOTE: createEntities is NOT specified - should default to true
    })

    console.log('\n📊 Import Result:')
    console.log(`   Entities created: ${result.stats.graphNodesCreated}`)
    console.log(`   VFS files created: ${result.stats.vfsFilesCreated}`)

    // Verify graph entities were created
    expect(result.stats.graphNodesCreated).toBeGreaterThan(0)

    // Verify we can query by type
    const people = await brain.find({ type: NounType.Person, limit: 10 })
    console.log(`\n🔍 Type Filtering:`)
    console.log(`   Person filter: ${people.length}`)

    expect(people.length).toBeGreaterThan(0)
    expect(people.length).toBeLessThanOrEqual(2)  // Should be 2 or less (Alice, Bob)

    const locations = await brain.find({ type: NounType.Location, limit: 10 })
    console.log(`   Location filter: ${locations.length}`)

    expect(locations.length).toBeGreaterThan(0)
    expect(locations.length).toBeLessThanOrEqual(1)  // Should be 1 or less (New York)

    console.log('\n✅ Graph entities created by default!')
  })

})
