/**
 * END-TO-END TEST: Verify VFS AND Graph Entities Are Created
 *
 * This test MUST PASS to ensure we don't regress on the createEntities bug.
 *
 * User frustration: Asked multiple times to ensure BOTH VFS and graph entities are created.
 * This test is the definitive proof that both are created and searchable.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { Brainy, NounType } from '../../src/index.js'
import * as fs from 'fs'
import * as path from 'path'
import * as XLSX from 'xlsx'

describe('VFS + Graph Entities Integration Test', () => {
  let brain: Brainy
  const testDir = './test-vfs-graph-integration'
  const testExcelPath = path.join(testDir, 'test-characters.xlsx')

  beforeEach(async () => {
    // Clean up
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true })
    }
    fs.mkdirSync(testDir, { recursive: true })

    // Create a REAL Excel file with character data
    const characters = [
      { Name: 'Arrowhead', Type: 'person', Description: 'An elven ranger who lives in Silverwood Forest' },
      { Name: 'Grimjaw', Type: 'person', Description: 'A dwarven warrior from the Iron Mountains' },
      { Name: 'Silverwood Forest', Type: 'location', Description: 'A mystical forest inhabited by elves' },
      { Name: 'Iron Mountains', Type: 'location', Description: 'Mountain range home to dwarven clans' }
    ]

    const ws = XLSX.utils.json_to_sheet(characters)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Characters')
    XLSX.writeFile(wb, testExcelPath)

    // Initialize Brainy
    brain = new Brainy({
      storage: {
        type: 'filesystem',
        path: testDir
      }
    })
    await brain.init()
  })

  afterEach(() => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true })
    }
  })

  it('CRITICAL: Must create BOTH VFS wrappers AND graph entities', async () => {
    console.log('\n' + '='.repeat(80))
    console.log('🔬 CRITICAL TEST: VFS + Graph Entities End-to-End')
    console.log('='.repeat(80))

    // Import WITHOUT specifying createEntities (should default to true after fix)
    console.log('\n📥 Importing Excel file...')
    const result = await brain.import(testExcelPath, {
      vfsPath: '/imports/test-characters',
      groupBy: 'sheet'
      // NOTE: createEntities is NOT specified - MUST default to true!
    })

    console.log('\n📊 Import Result:')
    console.log(`   VFS files created: ${result.stats.vfsFilesCreated}`)
    console.log(`   Graph nodes created: ${result.stats.graphNodesCreated}`)
    console.log(`   Graph edges created: ${result.stats.graphEdgesCreated}`)

    // ASSERTION 1: VFS files were created
    expect(result.stats.vfsFilesCreated).toBeGreaterThan(0)
    console.log('\n✅ ASSERTION 1: VFS files created')

    // ASSERTION 2: Graph entities were created
    expect(result.stats.graphNodesCreated).toBeGreaterThan(0)
    console.log('✅ ASSERTION 2: Graph entities created')

    // ASSERTION 3: Should have created 4 character entities
    expect(result.stats.graphNodesCreated).toBeGreaterThanOrEqual(4)
    console.log('✅ ASSERTION 3: All 4 character entities created')

    console.log('\n' + '='.repeat(80))
    console.log('📂 VFS VERIFICATION')
    console.log('='.repeat(80))

    // Initialize VFS
    const vfs = brain.vfs()
    await vfs.init()

    // ASSERTION 4: VFS directory structure exists
    const rootContents = await vfs.readdir('/imports/test-characters', { withFileTypes: true }) as any[]
    console.log(`\n📁 VFS root contents (${rootContents.length} items):`)
    for (const item of rootContents) {
      console.log(`   - ${item.name} (${item.type})`)
    }
    expect(rootContents.length).toBeGreaterThan(0)
    console.log('✅ ASSERTION 4: VFS directory structure exists')

    // ASSERTION 5: VFS files are readable
    // Find the directory (might be 'Characters' or another name based on grouping)
    const sheetDir = rootContents.find((item: any) => item.type === 'directory')
    console.log(`\n📂 Found directory: ${sheetDir?.name}`)
    expect(sheetDir).toBeDefined()
    expect(sheetDir?.type).toBe('directory')

    const sheetContents = await vfs.readdir(`/imports/test-characters/${sheetDir!.name}`, { withFileTypes: true }) as any[]
    console.log(`📁 Sheet contents: ${sheetContents.length} files`)
    expect(sheetContents.length).toBeGreaterThan(0)
    console.log('✅ ASSERTION 5: VFS files are readable')

    // ASSERTION 6: VFS file content is correct
    const firstFile = sheetContents.find((f: any) => f.type === 'file')
    expect(firstFile).toBeDefined()

    const fileContent = await vfs.readFile(`/imports/test-characters/${sheetDir!.name}/${firstFile!.name}`)
    const fileJson = JSON.parse(fileContent.toString())
    console.log(`📄 First file: ${firstFile!.name}`)
    console.log(`   Content: ${JSON.stringify(fileJson, null, 2).substring(0, 200)}...`)
    expect(fileJson.name).toBeDefined()
    console.log('✅ ASSERTION 6: VFS file content is correct')

    console.log('\n' + '='.repeat(80))
    console.log('🔍 GRAPH ENTITY VERIFICATION')
    console.log('='.repeat(80))

    // ASSERTION 7: All entities are queryable
    const allEntities = await brain.find({ limit: 100 })
    console.log(`\n📊 Total entities in brain: ${allEntities.length}`)

    // Count by type
    const typeCounts: Record<string, number> = {}
    for (const e of allEntities) {
      typeCounts[e.type] = (typeCounts[e.type] || 0) + 1
    }

    console.log('\n📋 Entity type breakdown:')
    for (const [type, count] of Object.entries(typeCounts)) {
      console.log(`   ${type}: ${count}`)
    }

    expect(allEntities.length).toBeGreaterThan(4)
    console.log('✅ ASSERTION 7: All entities queryable')

    // ASSERTION 8: VFS wrapper entities exist
    const vfsWrappers = allEntities.filter(e => e.metadata?.vfsType === 'file')
    console.log(`\n📦 VFS wrapper entities: ${vfsWrappers.length}`)
    expect(vfsWrappers.length).toBeGreaterThan(0)
    console.log('✅ ASSERTION 8: VFS wrapper entities exist')

    // ASSERTION 9: Graph entities exist (NOT VFS wrappers)
    const graphEntities = allEntities.filter(e => !e.metadata?.vfsType || e.metadata.vfsType !== 'file')
    console.log(`📊 Graph entities (non-VFS): ${graphEntities.length}`)
    expect(graphEntities.length).toBeGreaterThanOrEqual(4)
    console.log('✅ ASSERTION 9: Graph entities exist')

    console.log('\n' + '='.repeat(80))
    console.log('🎯 TYPE FILTERING VERIFICATION')
    console.log('='.repeat(80))

    // ASSERTION 10: Type filtering works for graph entities
    const people = await brain.find({ type: NounType.Person, limit: 100 })
    console.log(`\n👥 Person entities: ${people.length}`)
    expect(people.length).toBeGreaterThanOrEqual(2)
    console.log('✅ ASSERTION 10: Person type filtering works')

    // Verify person entities have correct data
    for (const person of people) {
      console.log(`   - ${person.metadata?.name || person.id} (type: ${person.type})`)
      expect(person.type).toBe('person')
    }

    // ASSERTION 11: Location type filtering works
    const locations = await brain.find({ type: NounType.Location, limit: 100 })
    console.log(`\n📍 Location entities: ${locations.length}`)
    expect(locations.length).toBeGreaterThanOrEqual(2)
    console.log('✅ ASSERTION 11: Location type filtering works')

    // Verify location entities
    for (const location of locations) {
      console.log(`   - ${location.metadata?.name || location.id} (type: ${location.type})`)
      expect(location.type).toBe('location')
    }

    // ASSERTION 12: Document type filtering works for VFS wrappers
    const documents = await brain.find({ type: NounType.Document, limit: 100 })
    console.log(`\n📄 Document entities (VFS wrappers): ${documents.length}`)
    expect(documents.length).toBeGreaterThan(0)
    console.log('✅ ASSERTION 12: Document type filtering works')

    console.log('\n' + '='.repeat(80))
    console.log('🔗 ENTITY LINKING VERIFICATION')
    console.log('='.repeat(80))

    // ASSERTION 13: Graph entities have vfsPath metadata
    const personWithVfsPath = people.find(p => p.metadata?.vfsPath)
    console.log(`\n🔗 Graph entity with VFS link:`)
    console.log(`   Name: ${personWithVfsPath?.metadata?.name}`)
    console.log(`   VFS Path: ${personWithVfsPath?.metadata?.vfsPath}`)
    expect(personWithVfsPath).toBeDefined()
    expect(personWithVfsPath?.metadata?.vfsPath).toBeDefined()
    console.log('✅ ASSERTION 13: Graph entities linked to VFS files')

    // ASSERTION 14: VFS wrapper has rawData
    const vfsWrapper = vfsWrappers[0]
    console.log(`\n📦 VFS wrapper entity:`)
    console.log(`   Path: ${vfsWrapper.metadata?.path}`)
    console.log(`   Has rawData: ${!!vfsWrapper.metadata?.rawData}`)
    expect(vfsWrapper.metadata?.rawData).toBeDefined()
    console.log('✅ ASSERTION 14: VFS wrappers have rawData')

    // ASSERTION 15: Can decode VFS rawData to get entity JSON
    const decodedData = Buffer.from(vfsWrapper.metadata?.rawData, 'base64').toString()
    const entityData = JSON.parse(decodedData)
    console.log(`\n🔓 Decoded VFS rawData:`)
    console.log(`   Entity name: ${entityData.name}`)
    console.log(`   Entity type: ${entityData.type}`)
    expect(entityData.name).toBeDefined()
    console.log('✅ ASSERTION 15: VFS rawData decodes correctly')

    console.log('\n' + '='.repeat(80))
    console.log('✅ ALL ASSERTIONS PASSED')
    console.log('='.repeat(80))
    console.log('\n📊 Summary:')
    console.log(`   ✅ VFS files created: ${result.stats.vfsFilesCreated}`)
    console.log(`   ✅ Graph entities created: ${result.stats.graphNodesCreated}`)
    console.log(`   ✅ VFS wrappers searchable: ${vfsWrappers.length}`)
    console.log(`   ✅ Graph entities searchable: ${graphEntities.length}`)
    console.log(`   ✅ Type filtering works: Person (${people.length}), Location (${locations.length})`)
    console.log('\n🎉 BOTH VFS AND GRAPH ENTITIES WORKING CORRECTLY!\n')
  })

  it('REGRESSION: Must fail if createEntities is explicitly false', async () => {
    console.log('\n🔬 Regression Test: createEntities: false should skip graph entities')

    const result = await brain.import(testExcelPath, {
      vfsPath: '/imports/no-graph',
      createEntities: false  // Explicitly disable
    })

    console.log(`   VFS files: ${result.stats.vfsFilesCreated}`)
    console.log(`   Graph entities: ${result.stats.graphNodesCreated}`)

    // Should create VFS but NOT graph entities
    expect(result.stats.vfsFilesCreated).toBeGreaterThan(0)
    expect(result.stats.graphNodesCreated).toBe(0)

    // Type filtering should return 0 for graph entities
    const people = await brain.find({ type: NounType.Person, limit: 100 })
    expect(people.length).toBe(0)

    console.log('   ✅ Correctly skipped graph entities when disabled')
  })

  it('REGRESSION: Must create graph entities when createEntities is explicitly true', async () => {
    console.log('\n🔬 Regression Test: createEntities: true should create graph entities')

    const result = await brain.import(testExcelPath, {
      vfsPath: '/imports/with-graph',
      createEntities: true  // Explicitly enable
    })

    console.log(`   VFS files: ${result.stats.vfsFilesCreated}`)
    console.log(`   Graph entities: ${result.stats.graphNodesCreated}`)

    // Should create BOTH VFS and graph entities
    expect(result.stats.vfsFilesCreated).toBeGreaterThan(0)
    expect(result.stats.graphNodesCreated).toBeGreaterThan(0)

    // Type filtering should work
    const people = await brain.find({ type: NounType.Person, limit: 100 })
    expect(people.length).toBeGreaterThanOrEqual(2)

    console.log('   ✅ Correctly created graph entities when enabled')
  })
})
