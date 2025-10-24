/**
 * Manual test to reproduce Workshop team's type filtering issue
 *
 * This test verifies that brain.find({ type: NounType.Person }) actually works
 * as documented in the API.
 */

import { Brainy, NounType } from '../../src/index.js'

async function testTypeFiltering() {
  console.log('\n🔬 Testing Type Filtering Issue from Workshop Team\n')
  console.log('=' .repeat(60))

  // Create in-memory instance for testing
  const brain = new Brainy({
    storage: { type: 'memory' }
  })
  await brain.init()

  console.log('\n1️⃣  Adding test entities with different types...\n')

  // Add 5 person entities
  const people = []
  for (let i = 0; i < 5; i++) {
    const id = await brain.add({
      data: `Person ${i + 1}`,
      type: NounType.Person,
      metadata: { name: `Person ${i + 1}` }
    })
    people.push(id)
  }
  console.log(`✅ Added ${people.length} person entities`)

  // Add 3 location entities
  const locations = []
  for (let i = 0; i < 3; i++) {
    const id = await brain.add({
      data: `Location ${i + 1}`,
      type: NounType.Location,
      metadata: { name: `Location ${i + 1}` }
    })
    locations.push(id)
  }
  console.log(`✅ Added ${locations.length} location entities`)

  // Add 2 concept entities
  const concepts = []
  for (let i = 0; i < 2; i++) {
    const id = await brain.add({
      data: `Concept ${i + 1}`,
      type: NounType.Concept,
      metadata: { name: `Concept ${i + 1}` }
    })
    concepts.push(id)
  }
  console.log(`✅ Added ${concepts.length} concept entities`)

  console.log(`\n📊 Total: ${people.length + locations.length + concepts.length} entities`)

  console.log('\n' + '='.repeat(60))
  console.log('\n2️⃣  Testing find() without type filter...\n')

  const allResults = await brain.find({ limit: 100 })
  console.log(`✅ brain.find({}) returned ${allResults.length} entities`)

  // Check types in results
  const typeCounts = allResults.reduce((acc, r) => {
    acc[r.type || 'unknown'] = (acc[r.type || 'unknown'] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  console.log('\nTypes in results:')
  for (const [type, count] of Object.entries(typeCounts)) {
    console.log(`  - ${type}: ${count}`)
  }

  console.log('\n' + '='.repeat(60))
  console.log('\n3️⃣  Testing find() WITH type filter (using enum)...\n')

  // Test 1: Filter by NounType.Person (enum value)
  console.log('Test 1: brain.find({ type: NounType.Person })')
  const personResults = await brain.find({ type: NounType.Person, limit: 100 })
  console.log(`  Result: ${personResults.length} entities`)
  console.log(`  Expected: ${people.length} entities`)
  if (personResults.length === people.length) {
    console.log('  ✅ PASS')
  } else {
    console.log('  ❌ FAIL - Type filtering not working!')
  }

  // Test 2: Filter by NounType.Location
  console.log('\nTest 2: brain.find({ type: NounType.Location })')
  const locationResults = await brain.find({ type: NounType.Location, limit: 100 })
  console.log(`  Result: ${locationResults.length} entities`)
  console.log(`  Expected: ${locations.length} entities`)
  if (locationResults.length === locations.length) {
    console.log('  ✅ PASS')
  } else {
    console.log('  ❌ FAIL - Type filtering not working!')
  }

  // Test 3: Filter by NounType.Concept
  console.log('\nTest 3: brain.find({ type: NounType.Concept })')
  const conceptResults = await brain.find({ type: NounType.Concept, limit: 100 })
  console.log(`  Result: ${conceptResults.length} entities`)
  console.log(`  Expected: ${concepts.length} entities`)
  if (conceptResults.length === concepts.length) {
    console.log('  ✅ PASS')
  } else {
    console.log('  ❌ FAIL - Type filtering not working!')
  }

  console.log('\n' + '='.repeat(60))
  console.log('\n4️⃣  Testing find() WITH type filter (using string)...\n')

  // Test 4: Filter by string 'person'
  console.log('Test 4: brain.find({ type: "person" })')
  const personResults2 = await brain.find({ type: 'person' as any, limit: 100 })
  console.log(`  Result: ${personResults2.length} entities`)
  console.log(`  Expected: ${people.length} entities`)
  if (personResults2.length === people.length) {
    console.log('  ✅ PASS')
  } else {
    console.log('  ❌ FAIL - String type filtering not working!')
  }

  console.log('\n' + '='.repeat(60))
  console.log('\n5️⃣  Checking entity storage (metadata.noun)...\n')

  // Get a person entity and check its storage
  const personEntity = await brain.get(people[0])
  console.log('Person entity structure:')
  console.log('  - id:', personEntity?.id)
  console.log('  - type:', personEntity?.type)
  console.log('  - metadata.noun:', (personEntity as any)?.metadata?.noun)
  console.log('  - metadata.name:', personEntity?.metadata?.name)

  console.log('\n' + '='.repeat(60))
  console.log('\n📋 Summary\n')

  const tests = [
    { name: 'Filter by NounType.Person', passed: personResults.length === people.length },
    { name: 'Filter by NounType.Location', passed: locationResults.length === locations.length },
    { name: 'Filter by NounType.Concept', passed: conceptResults.length === concepts.length },
    { name: 'Filter by string "person"', passed: personResults2.length === people.length }
  ]

  const passedCount = tests.filter(t => t.passed).length
  const totalCount = tests.length

  console.log(`Tests passed: ${passedCount}/${totalCount}\n`)

  for (const test of tests) {
    console.log(`${test.passed ? '✅' : '❌'} ${test.name}`)
  }

  if (passedCount === totalCount) {
    console.log('\n🎉 All tests passed! Type filtering works correctly.')
    console.log('\n💡 The Workshop team might be experiencing a different issue.')
    console.log('   Check: storage persistence, Brainy instance reuse, or data migration')
  } else {
    console.log('\n❌ Type filtering is BROKEN in Brainy!')
    console.log('\n🐛 This is a bug that needs to be fixed.')
    console.log('   Workshop team was right - it\'s not user error.')
  }

  console.log('\n' + '='.repeat(60) + '\n')
}

// Run the test
testTypeFiltering().catch(console.error)
