/**
 * VFS Root Debugging Script
 *
 * This script debugs why vfs.readdir('/') returns empty despite
 * 608 Contains relationships existing in the database.
 */

import { Brainy } from './dist/brainy.js'
import { VerbType, NounType } from './dist/types/graphTypes.js'

async function debugVFSRoot() {
  console.log('\n🔍 VFS Root Debugging Script\n')
  console.log('=' .repeat(60))

  // Initialize Brainy with FileSystemStorage
  const brain = new Brainy({
    storage: {
      type: 'filesystem',
      config: {
        path: './brainy-data'
      }
    }
  })

  await brain.ready()
  console.log('✅ Brainy initialized\n')

  // Get VFS instance
  const vfs = brain.vfs()
  console.log('✅ VFS instance created\n')

  // Get the root entity ID that VFS is using
  const vfsRootId = (vfs as any).rootEntityId
  console.log(`📍 VFS Root Entity ID: ${vfsRootId}\n`)

  // Try to get the root entity
  const rootEntity = await brain.get(vfsRootId)
  if (rootEntity) {
    console.log('✅ Root entity EXISTS in database:')
    console.log(`   Type: ${rootEntity.type}`)
    console.log(`   Path: ${rootEntity.metadata?.path}`)
    console.log(`   VFS Type: ${rootEntity.metadata?.vfsType}`)
    console.log(`   Created: ${new Date(rootEntity.createdAt || 0).toISOString()}`)
    console.log()
  } else {
    console.log('❌ Root entity DOES NOT EXIST in database!')
    console.log('   This is the bug! VFS is using a root ID that doesn\'t exist.\n')
  }

  // Find ALL collection entities (directories)
  console.log('🔍 Finding ALL collection entities (directories)...')
  const allCollections = await brain.find({
    type: NounType.Collection,
    limit: 100
  })
  console.log(`   Found ${allCollections.length} collection entities:\n`)

  for (const coll of allCollections) {
    const isRoot = coll.metadata?.path === '/' && coll.metadata?.vfsType === 'directory'
    console.log(`   ${isRoot ? '👑' : '  '} ID: ${coll.id}`)
    console.log(`      Path: ${coll.metadata?.path}`)
    console.log(`      VFS Type: ${coll.metadata?.vfsType}`)
    console.log(`      Created: ${new Date(coll.entity?.createdAt || 0).toISOString()}`)

    // Check if this matches VFS root
    if (coll.id === vfsRootId) {
      console.log(`      ✅ THIS IS THE VFS ROOT`)
    }
    console.log()
  }

  // For each potential root, count outgoing Contains relationships
  console.log('🔍 Checking Contains relationships FROM each collection...\n')

  for (const coll of allCollections) {
    const relations = await brain.getRelations({
      from: coll.id,
      type: VerbType.Contains
    })

    console.log(`   Collection ${coll.id}:`)
    console.log(`      Path: ${coll.metadata?.path}`)
    console.log(`      Outgoing Contains: ${relations.length}`)

    if (coll.id === vfsRootId) {
      console.log(`      ✅ THIS IS THE VFS ROOT - should return ${relations.length} items for readdir('/')`)

      if (relations.length === 0) {
        console.log(`      ❌ BUT IT HAS ZERO CHILDREN! This is why readdir() returns empty!`)
      }
    }
    console.log()
  }

  // Count total Contains relationships in database
  console.log('🔍 Counting ALL Contains relationships in database...')
  const allContains = await brain.getRelations({
    type: VerbType.Contains,
    limit: 1000
  })
  console.log(`   Total Contains relationships: ${allContains.length}\n`)

  // Sample some Contains relationships
  console.log('📋 Sample Contains relationships (first 10):')
  for (let i = 0; i < Math.min(10, allContains.length); i++) {
    const rel = allContains[i]
    const fromEntity = await brain.get(rel.from)
    const toEntity = await brain.get(rel.to)

    console.log(`   ${i + 1}. ${rel.from} -> ${rel.to}`)
    console.log(`      From: ${fromEntity?.metadata?.path || 'unknown'} (${fromEntity?.metadata?.vfsType || 'unknown'})`)
    console.log(`      To: ${toEntity?.metadata?.path || 'unknown'} (${toEntity?.metadata?.vfsType || 'unknown'})`)
  }

  console.log('\n' + '='.repeat(60))
  console.log('🏁 Debug Complete\n')

  process.exit(0)
}

debugVFSRoot().catch(err => {
  console.error('❌ Error:', err)
  process.exit(1)
})
