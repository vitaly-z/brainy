/**
 * Diagnostic script for Workshop type filtering issue
 *
 * This script mimics Workshop's exact import pattern to see what's happening
 */

import { Brainy, NounType } from '../src/index.js'
import * as fs from 'fs'
import * as path from 'path'

async function diagnose() {
  console.log('\n🔬 Workshop Type Filtering Diagnostic\n')
  console.log('='.repeat(70))

  // Use temporary directory
  const testDir = './test-workshop-data'
  if (fs.existsSync(testDir)) {
    fs.rmSync(testDir, { recursive: true })
  }

  const brain = new Brainy({
    storage: {
      type: 'filesystem',
      path: testDir
    }
  })
  await brain.init()

  console.log('\n1️⃣  Testing WITHOUT VFS (control group)...\n')

  // Add entities without VFS
  console.log('Adding 3 person entities directly...')
  await brain.add({ data: 'Person 1', type: NounType.Person, metadata: { name: 'Person 1' } })
  await brain.add({ data: 'Person 2', type: NounType.Person, metadata: { name: 'Person 2' } })
  await brain.add({ data: 'Person 3', type: NounType.Person, metadata: { name: 'Person 3' } })

  console.log('Adding 2 location entities directly...')
  await brain.add({ data: 'Location 1', type: NounType.Location, metadata: { name: 'Location 1' } })
  await brain.add({ data: 'Location 2', type: NounType.Location, metadata: { name: 'Location 2' } })

  console.log('\n📊 Testing type filtering on direct entities...\n')

  const allDirect = await brain.find({ limit: 100 })
  console.log(`  Total entities: ${allDirect.length}`)

  const peopleDirect = await brain.find({ type: NounType.Person, limit: 100 })
  console.log(`  Person filter: ${peopleDirect.length} (expected: 3)`)

  const locationsDirect = await brain.find({ type: NounType.Location, limit: 100 })
  console.log(`  Location filter: ${locationsDirect.length} (expected: 2)`)

  if (peopleDirect.length === 3 && locationsDirect.length === 2) {
    console.log('\n  ✅ Type filtering works on direct entities!')
  } else {
    console.log('\n  ❌ Type filtering BROKEN on direct entities!')
    return
  }

  console.log('\n' + '='.repeat(70))
  console.log('\n2️⃣  Testing WITH VFS (Workshop pattern)...\n')

  // Simulate Workshop's pattern: create VFS file entities
  console.log('Creating VFS file wrappers (like import does)...')

  const vfs = brain.vfs()
  await vfs.init()

  // Create VFS directory
  await vfs.mkdir('/imports/test', { recursive: true })

  // Create VFS files with embedded entity data (mimics import)
  console.log('Creating VFS file for Person entity...')
  const personEntityData = {
    id: 'ent_person_test',
    name: 'John Smith',
    type: 'person',
    metadata: {
      source: 'excel',
      originalData: {
        Name: 'John Smith',
        _sheet: 'Characters'
      }
    }
  }
  await vfs.writeFile(
    '/imports/test/john_smith.json',
    Buffer.from(JSON.stringify(personEntityData, null, 2))
  )

  console.log('Creating VFS file for Location entity...')
  const locationEntityData = {
    id: 'ent_location_test',
    name: 'New York',
    type: 'location',
    metadata: {
      source: 'excel',
      originalData: {
        Name: 'New York',
        _sheet: 'Places'
      }
    }
  }
  await vfs.writeFile(
    '/imports/test/new_york.json',
    Buffer.from(JSON.stringify(locationEntityData, null, 2))
  )

  console.log('\n📊 Checking what entities exist now...\n')

  const allWithVfs = await brain.find({ limit: 100 })
  console.log(`  Total entities: ${allWithVfs.length}`)

  // Analyze entity types
  const typeCounts: Record<string, number> = {}
  for (const result of allWithVfs) {
    const type = result.type || 'unknown'
    typeCounts[type] = (typeCounts[type] || 0) + 1
  }

  console.log('\n  Entity types breakdown:')
  for (const [type, count] of Object.entries(typeCounts)) {
    console.log(`    - ${type}: ${count}`)
  }

  console.log('\n📊 Testing type filtering with VFS entities...\n')

  const peopleWithVfs = await brain.find({ type: NounType.Person, limit: 100 })
  console.log(`  Person filter: ${peopleWithVfs.length} (expected: 3 direct + maybe VFS?)`)

  const locationsWithVfs = await brain.find({ type: NounType.Location, limit: 100 })
  console.log(`  Location filter: ${locationsWithVfs.length} (expected: 2 direct + maybe VFS?)`)

  const documents = await brain.find({ type: NounType.Document, limit: 100 })
  console.log(`  Document filter: ${documents.length} (VFS wrappers?)`)

  console.log('\n' + '='.repeat(70))
  console.log('\n3️⃣  Analyzing VFS wrapper structure...\n')

  // Get a VFS wrapper entity
  const vfsWrapper = allWithVfs.find(e => e.metadata?.vfsType === 'file')
  if (vfsWrapper) {
    console.log('Found VFS wrapper entity:')
    console.log(`  - ID: ${vfsWrapper.id}`)
    console.log(`  - Type: ${vfsWrapper.type}`)
    console.log(`  - VFS Type: ${vfsWrapper.metadata?.vfsType}`)
    console.log(`  - Has rawData: ${!!vfsWrapper.metadata?.rawData}`)
    console.log(`  - Path: ${vfsWrapper.metadata?.path}`)

    if (vfsWrapper.metadata?.rawData) {
      console.log('\n  Decoding rawData...')
      try {
        const decoded = Buffer.from(vfsWrapper.metadata.rawData, 'base64').toString()
        const entity = JSON.parse(decoded)
        console.log(`    - Embedded entity name: ${entity.name}`)
        console.log(`    - Embedded entity type: ${entity.type}`)
        console.log(`    - Wrapper type: ${vfsWrapper.type}`)
        console.log('\n  🔍 KEY INSIGHT:')
        console.log(`     Wrapper has type="${vfsWrapper.type}"`)
        console.log(`     But embedded entity has type="${entity.type}"`)
        console.log('     When you filter by person, you get the WRAPPER type, not embedded type!')
      } catch (err) {
        console.log('    ❌ Failed to decode rawData')
      }
    }
  } else {
    console.log('No VFS wrapper entities found')
  }

  console.log('\n' + '='.repeat(70))
  console.log('\n4️⃣  DIAGNOSIS\n')

  if (documents.length > 0 && peopleWithVfs.length === 3) {
    console.log('❌ FOUND THE BUG!')
    console.log('')
    console.log('VFS creates document wrappers with type="document".')
    console.log('The actual entity data is stored as base64 in metadata.rawData.')
    console.log('When you filter by type="person", you\'re filtering the WRAPPER type.')
    console.log('Since wrappers are type="document", you get 0 results.')
    console.log('')
    console.log('This is a DESIGN ISSUE in how VFS import works!')
  } else if (peopleWithVfs.length > 3) {
    console.log('✅ Type filtering works correctly!')
    console.log('VFS entities are being created with proper types.')
  } else {
    console.log('🤔 Unclear - need more investigation')
  }

  console.log('\n' + '='.repeat(70) + '\n')

  // Cleanup
  fs.rmSync(testDir, { recursive: true })
}

diagnose().catch(console.error)
