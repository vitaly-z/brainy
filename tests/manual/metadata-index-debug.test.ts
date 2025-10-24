/**
 * Debug: Check metadata index for isVFS field
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { Brainy } from '../../src/brainy.js'
import { NounType } from '../../src/types/graphTypes.js'
import * as fs from 'fs'
import * as path from 'path'

describe('Metadata Index Debug', () => {
  const testDir = path.join(process.cwd(), 'test-metadata-index-debug')
  let brain: Brainy

  beforeAll(async () => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true })
    }
    fs.mkdirSync(testDir, { recursive: true })

    brain = new Brainy({
      storage: {
        type: 'filesystem',
        options: { path: testDir }
      }
    })
    await brain.init()
  })

  afterAll(() => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true })
    }
  })

  it('should index custom metadata fields', async () => {
    // Add entity with custom metadata field
    const entity1 = await brain.add({
      data: 'Test entity with custom field',
      type: NounType.Document,
      metadata: {
        customFlag: true,
        customString: 'hello',
        customNumber: 42
      }
    })

    console.log('\n📋 Added entity:', entity1.id)
    console.log('   Metadata:', entity1.metadata)

    // Try to find by custom fields
    console.log('\n📋 Query 1: where: { customFlag: true }')
    const result1 = await brain.find({
      where: { customFlag: true },
      limit: 10
    })
    console.log(`   Results: ${result1.length}`)
    if (result1.length > 0) {
      console.log(`   Found: ${result1[0].id}`)
      console.log(`   Metadata.customFlag: ${result1[0].metadata?.customFlag}`)
    }

    console.log('\n📋 Query 2: where: { customString: "hello" }')
    const result2 = await brain.find({
      where: { customString: 'hello' },
      limit: 10
    })
    console.log(`   Results: ${result2.length}`)

    console.log('\n📋 Query 3: where: { customNumber: 42 }')
    const result3 = await brain.find({
      where: { customNumber: 42 },
      limit: 10
    })
    console.log(`   Results: ${result3.length}`)

    // Check what fields are indexed
    console.log('\n📋 Indexed fields:')
    const fields = await brain.getFilterFields()
    console.log(`   ${fields.join(', ')}`)

    expect(result1.length).toBeGreaterThan(0)
    expect(result2.length).toBeGreaterThan(0)
    expect(result3.length).toBeGreaterThan(0)
  })
})
