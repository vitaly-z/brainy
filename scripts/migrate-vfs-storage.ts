/**
 * VFS Storage Migration Script: v5.1.x → v5.2.0
 *
 * Converts VFS files from 3-tier storage (inline/reference/chunked)
 * to unified BlobStorage (content-addressable with deduplication)
 *
 * Usage:
 *   import { migrateVFSStorage } from './scripts/migrate-vfs-storage'
 *   await migrateVFSStorage(brain)
 */

import { Brainy } from '../src/brainy.js'
import { VFSMetadata } from '../src/vfs/types.js'

export interface MigrationStats {
  filesProcessed: number
  inlineMigrated: number
  referenceMigrated: number
  chunkedMigrated: number
  alreadyMigrated: number
  errors: number
  deduplicated: number
  totalSizeBefore: number
  totalSizeAfter: number
  durationMs: number
}

export async function migrateVFSStorage(
  brain: Brainy,
  options: {
    dryRun?: boolean
    verbose?: boolean
    batchSize?: number
  } = {}
): Promise<MigrationStats> {
  const { dryRun = false, verbose = false, batchSize = 100 } = options

  const stats: MigrationStats = {
    filesProcessed: 0,
    inlineMigrated: 0,
    referenceMigrated: 0,
    chunkedMigrated: 0,
    alreadyMigrated: 0,
    errors: 0,
    deduplicated: 0,
    totalSizeBefore: 0,
    totalSizeAfter: 0,
    durationMs: 0
  }

  const startTime = Date.now()

  if (verbose) {
    console.log('🔄 Starting VFS storage migration (v5.1.x → v5.2.0)')
    if (dryRun) console.log('   DRY RUN: No changes will be made')
  }

  try {
    // Find all VFS file entities
    const files = await brain.find({
      where: { 'metadata.vfsType': 'file' },
      limit: 100000  // Large limit to get all files
    })

    if (verbose) {
      console.log(`📁 Found ${files.length} VFS files to process`)
    }

    // Process in batches
    for (let i = 0; i < files.length; i += batchSize) {
      const batch = files.slice(i, i + batchSize)

      await Promise.all(batch.map(async (file) => {
        try {
          stats.filesProcessed++

          const metadata = file.metadata as VFSMetadata
          const storage = metadata.storage

          // Already migrated?
          if (storage?.type === 'blob') {
            stats.alreadyMigrated++
            if (verbose && stats.filesProcessed % 100 === 0) {
              console.log(`   ✓ ${metadata.path} (already migrated)`)
            }
            return
          }

          let buffer: Buffer | null = null
          let sizeBefore = 0

          // Migrate based on old storage type
          if (!storage || storage.type === 'inline') {
            // Inline storage: content in metadata.rawData
            if (metadata.rawData) {
              buffer = Buffer.from(metadata.rawData, 'base64')
              sizeBefore = buffer.length
              stats.inlineMigrated++

              if (verbose && stats.filesProcessed % 100 === 0) {
                console.log(`   → ${metadata.path} (inline, ${sizeBefore} bytes)`)
              }
            }
          } else if (storage.type === 'reference') {
            // Reference storage: content stored as separate entity
            if (storage.key) {
              const contentEntity = await brain.get(storage.key)
              if (contentEntity && contentEntity.data) {
                buffer = Buffer.isBuffer(contentEntity.data)
                  ? contentEntity.data
                  : Buffer.from(contentEntity.data as string)
                sizeBefore = buffer.length
                stats.referenceMigrated++

                if (verbose && stats.filesProcessed % 100 === 0) {
                  console.log(`   → ${metadata.path} (reference, ${sizeBefore} bytes)`)
                }

                // Delete old reference entity (unless dry run)
                if (!dryRun) {
                  await brain.delete(storage.key)
                }
              }
            }
          } else if (storage.type === 'chunked') {
            // Chunked storage: content split across multiple entities
            if (storage.chunks && storage.chunks.length > 0) {
              const chunkBuffers = await Promise.all(
                storage.chunks.map(async (chunkId) => {
                  const chunkEntity = await brain.get(chunkId)
                  if (chunkEntity && chunkEntity.data) {
                    return Buffer.isBuffer(chunkEntity.data)
                      ? chunkEntity.data
                      : Buffer.from(chunkEntity.data as string)
                  }
                  return Buffer.alloc(0)
                })
              )

              buffer = Buffer.concat(chunkBuffers)
              sizeBefore = buffer.length
              stats.chunkedMigrated++

              if (verbose && stats.filesProcessed % 100 === 0) {
                console.log(`   → ${metadata.path} (chunked, ${storage.chunks.length} chunks, ${sizeBefore} bytes)`)
              }

              // Delete old chunk entities (unless dry run)
              if (!dryRun) {
                await Promise.all(storage.chunks.map(id => brain.delete(id)))
              }
            }
          }

          // Store in BlobStorage
          if (buffer) {
            stats.totalSizeBefore += sizeBefore

            if (!dryRun) {
              // Write to BlobStorage (content-addressable)
              const blobHash = await brain.vfs['blobStorage'].write(buffer)

              // Check if deduplicated
              const blobMeta = await brain.vfs['blobStorage'].getMetadata(blobHash)
              if (blobMeta && blobMeta.refCount > 1) {
                stats.deduplicated++
              }

              // Update VFS metadata
              await brain.update(file.id, {
                metadata: {
                  ...metadata,
                  storage: {
                    type: 'blob',
                    hash: blobHash,
                    size: buffer.length,
                    compressed: blobMeta?.compressed
                  }
                }
              })

              stats.totalSizeAfter += blobMeta?.compressedSize || buffer.length
            } else {
              // Dry run: just count sizes
              stats.totalSizeAfter += buffer.length
            }
          }
        } catch (error) {
          stats.errors++
          if (verbose) {
            console.error(`   ✗ Error migrating ${file.metadata?.path}: ${error.message}`)
          }
        }
      }))

      if (verbose && i + batchSize < files.length) {
        const progress = Math.round(((i + batchSize) / files.length) * 100)
        console.log(`   Progress: ${progress}% (${i + batchSize}/${files.length})`)
      }
    }

    stats.durationMs = Date.now() - startTime

    if (verbose) {
      console.log('\n✅ Migration complete!\n')
      console.log('📊 Statistics:')
      console.log(`   Files processed:    ${stats.filesProcessed}`)
      console.log(`   Inline migrated:    ${stats.inlineMigrated}`)
      console.log(`   Reference migrated: ${stats.referenceMigrated}`)
      console.log(`   Chunked migrated:   ${stats.chunkedMigrated}`)
      console.log(`   Already migrated:   ${stats.alreadyMigrated}`)
      console.log(`   Deduplicated:       ${stats.deduplicated}`)
      console.log(`   Errors:             ${stats.errors}`)
      console.log(`   Size before:        ${formatBytes(stats.totalSizeBefore)}`)
      console.log(`   Size after:         ${formatBytes(stats.totalSizeAfter)}`)
      console.log(`   Space saved:        ${formatBytes(stats.totalSizeBefore - stats.totalSizeAfter)}`)
      console.log(`   Duration:           ${stats.durationMs}ms`)

      if (dryRun) {
        console.log('\n⚠️  DRY RUN: No changes were made')
      }
    }

    return stats
  } catch (error) {
    if (verbose) {
      console.error('❌ Migration failed:', error)
    }
    throw error
  }
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes'

  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))

  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i]
}

/**
 * Auto-detect and migrate if needed
 * Called automatically on brain.init() if old format detected
 */
export async function autoMigrateIfNeeded(brain: Brainy): Promise<boolean> {
  try {
    // Check for old format files
    const oldFormatFiles = await brain.find({
      where: {
        'metadata.vfsType': 'file',
        'metadata.storage.type': { $in: ['inline', 'reference', 'chunked'] }
      },
      limit: 1
    })

    if (oldFormatFiles.length > 0) {
      console.log('🔄 Detected v5.1.x VFS storage format. Auto-migrating to v5.2.0...')
      await migrateVFSStorage(brain, { verbose: true })
      return true
    }

    return false
  } catch (error) {
    console.error('❌ Auto-migration failed:', error)
    return false
  }
}
