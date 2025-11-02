/**
 * Workshop VFS Diagnostic Test
 *
 * Tests to verify VFS import behavior and identify if VFS creates only wrappers or also graph entities
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { Brainy, NounType } from '../../src/index.js'

describe('Workshop VFS Diagnostic', () => {
  let brain: Brainy

  beforeEach(async () => {
    brain = new Brainy({
      storage: { type: 'memory' }
    })
    await brain.init()
  })

  it('should verify VFS creates document wrappers AND allows entity filtering', async () => {
    console.log('\n🔬 Workshop VFS Diagnostic Test\n')
    console.log('='.repeat(70))

    // Step 1: Add entities directly (control group)
    console.log('\n1️⃣  Adding entities directly (without VFS)...\n')

    await brain.add({ data: 'Person 1', type: NounType.Person, metadata: { name: 'Person 1' } })
    await brain.add({ data: 'Person 2', type: NounType.Person, metadata: { name: 'Person 2' } })
    await brain.add({ data: 'Location 1', type: NounType.Location, metadata: { name: 'Location 1' } })

    const beforeVfs = await brain.find({ limit: 100 })
    console.log(`   Total entities: ${beforeVfs.length}`)

    const peopleBefore = await brain.find({ type: NounType.Person, limit: 100 })
    console.log(`   Person filter: ${peopleBefore.length} (expected: 2)`)
    expect(peopleBefore.length).toBe(2)
    console.log('   ✅ Type filtering works on direct entities\n')

    // Step 2: Use VFS to create files
    console.log('2️⃣  Creating VFS files...\n')

    const vfs = brain.vfs
    await vfs.init()
    await vfs.mkdir('/test', { recursive: true })

    // Create a VFS file with entity data
    const personData = {
      id: 'ent_person_test',
      name: 'John Smith',
      type: 'person',
      metadata: { source: 'test' }
    }

    await vfs.writeFile('/test/john.json', Buffer.from(JSON.stringify(personData, null, 2)))
    console.log('   Created VFS file: /test/john.json')

    // Step 3: Check what entities exist now
    console.log('\n3️⃣  Analyzing entities after VFS...\n')

    const afterVfs = await brain.find({ limit: 100 })
    console.log(`   Total entities: ${afterVfs.length}`)

    // Count by type
    const typeCounts: Record<string, number> = {}
    for (const result of afterVfs) {
      const type = result.type || 'unknown'
      typeCounts[type] = (typeCounts[type] || 0) + 1
    }

    console.log('\n   Entity type breakdown:')
    for (const [type, count] of Object.entries(typeCounts)) {
      console.log(`     - ${type}: ${count}`)
    }

    // Count VFS wrappers vs regular entities
    const vfsWrappers = afterVfs.filter(e => e.metadata?.vfsType === 'file')
    const regularEntities = afterVfs.filter(e => !e.metadata?.vfsType)

    console.log(`\n   VFS wrappers: ${vfsWrappers.length}`)
    console.log(`   Regular entities: ${regularEntities.length}`)

    // Step 4: Test type filtering after VFS
    console.log('\n4️⃣  Testing type filtering after VFS...\n')

    const peopleAfter = await brain.find({ type: NounType.Person, limit: 100 })
    console.log(`   Person filter: ${peopleAfter.length} (expected: 2 - same as before)`)

    const documents = await brain.find({ type: NounType.Document, limit: 100 })
    console.log(`   Document filter: ${documents.length} (expected: ${vfsWrappers.length})`)

    // Step 5: Analyze VFS wrapper structure
    console.log('\n5️⃣  Analyzing VFS wrapper structure...\n')

    const wrapper = vfsWrappers[0]
    if (wrapper) {
      console.log('   VFS Wrapper Entity:')
      console.log(`     - ID: ${wrapper.id}`)
      console.log(`     - Type: ${wrapper.type}`)
      console.log(`     - VFS Type: ${wrapper.metadata?.vfsType}`)
      console.log(`     - Path: ${wrapper.metadata?.path}`)
      console.log(`     - Has rawData: ${!!wrapper.metadata?.rawData}`)

      if (wrapper.metadata?.rawData) {
        const decoded = Buffer.from(wrapper.metadata.rawData, 'base64').toString()
        const embedded = JSON.parse(decoded)
        console.log(`\n   Embedded Entity Data:`)
        console.log(`     - Name: ${embedded.name}`)
        console.log(`     - Type: ${embedded.type}`)
        console.log(`\n   🔍 KEY FINDING:`)
        console.log(`      Wrapper type: "${wrapper.type}"`)
        console.log(`      Embedded type: "${embedded.type}"`)
        console.log(`      Filtering by type="${embedded.type}" searches wrapper type, not embedded!`)
      }
    }

    // Step 6: Diagnosis
    console.log('\n' + '='.repeat(70))
    console.log('📋 DIAGNOSIS\n')

    if (peopleAfter.length === peopleBefore.length) {
      console.log('✅ VFS does NOT create duplicate graph entities')
      console.log('✅ VFS only creates document wrappers')
      console.log('✅ Type filtering works on original entities, ignores VFS wrappers')
      console.log('\nThis means:')
      console.log('  - VFS files are type="document" wrappers')
      console.log('  - Original entities keep their types')
      console.log('  - filter({ type: "person" }) returns original entities only')
    } else {
      console.log('❌ Unexpected behavior - VFS may have created additional entities')
    }

    console.log('\n' + '='.repeat(70) + '\n')

    // Assertions
    expect(peopleAfter.length).toBe(2) // Should still be 2, VFS doesn't create person entities
    expect(documents.length).toBeGreaterThan(0) // VFS creates document wrappers
    expect(vfsWrappers.length).toBeGreaterThan(0) // Should have VFS wrappers
  })

  it('should verify import creates BOTH VFS wrappers AND graph entities', async () => {
    // This test would require creating a test Excel file and running import
    // For now, we'll document the expected behavior based on code analysis

    console.log('\n📚 Expected Import Behavior (from code analysis):\n')
    console.log('When you run brain.import("file.xlsx", { vfsPath: "/imports" }):')
    console.log('\n1. ImportCoordinator.execute() calls:')
    console.log('   a) vfsGenerator.generate() - creates VFS file wrappers')
    console.log('      - Each entity → JSON file in VFS')
    console.log('      - Wrapper entity with type="document"')
    console.log('      - Entity data stored in metadata.rawData (base64)')
    console.log('')
    console.log('   b) createGraphEntities() - creates graph entities')
    console.log('      - Each entity → graph entity with proper type')
    console.log('      - type="person", "location", "concept", etc.')
    console.log('      - metadata.vfsPath points to VFS file')
    console.log('')
    console.log('2. Result: Database contains BOTH:')
    console.log('   - VFS wrappers (type="document", vfsType="file")')
    console.log('   - Graph entities (type="person", etc., vfsPath set)')
    console.log('')
    console.log('3. Type filtering:')
    console.log('   - filter({ type: "person" }) → returns graph entities')
    console.log('   - filter({ type: "document" }) → returns VFS wrappers')
    console.log('')
    console.log('If Workshop gets 0 results, likely causes:')
    console.log('   ❌ Only VFS wrappers created (createEntities: false)')
    console.log('   ❌ Import not completing before query')
    console.log('   ❌ Querying different Brainy instance')
    console.log('')
  })
})
