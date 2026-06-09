/**
 * @module tests/integration/savebinaryblob-concurrent-rename
 * @description Regression test for the 7.31.1 fix to `FileSystemStorage.saveBinaryBlob`.
 *
 * Pre-7.31.1, `saveBinaryBlob` used a bare `${filePath}.tmp` suffix for its
 * atomic-write temp file. Two concurrent same-key calls computed the same
 * temp path; whichever rename ran second hit ENOENT because the first call
 * had already consumed the temp.
 *
 * Reproduced in production: column-store compaction running alongside an
 * explicit flush() repeatedly raced on `_column_index/<field>/DELETED.bin`,
 * causing brain.flush() and the downstream GCS backup job to fail
 * continuously.
 *
 * This test asserts:
 *   - 20 concurrent saveBinaryBlob(sameKey, ...) calls all resolve without throwing
 *   - The final file contents are valid (one of the inputs, last-write-wins)
 *   - No orphan `.tmp.*` siblings are left in the blob directory
 *   - The race also holds when interleaved across multiple keys (column-store
 *     compaction shape)
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, readdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { FileSystemStorage } from '../../src/storage/adapters/fileSystemStorage.js'

describe('7.31.1 — saveBinaryBlob concurrent rename safety', () => {
  let dataDir: string
  let storage: FileSystemStorage

  beforeEach(async () => {
    dataDir = mkdtempSync(join(tmpdir(), 'brainy-savebinaryblob-'))
    storage = new FileSystemStorage(dataDir)
    await storage.init()
  })

  afterEach(() => {
    rmSync(dataDir, { recursive: true, force: true })
  })

  it('20 concurrent saveBinaryBlob calls for the same key resolve without ENOENT', async () => {
    const key = '_column_index/owner/DELETED'
    const writers = Array.from({ length: 20 }, (_, i) => {
      // Each writer's payload is unique so we can verify which one wins.
      const payload = Buffer.from(`writer-${i.toString().padStart(2, '0')}-payload`)
      return storage.saveBinaryBlob(key, payload)
    })

    // No call should throw. Pre-7.31.1, ~19 of 20 throw ENOENT under contention.
    await expect(Promise.all(writers)).resolves.not.toThrow()

    // Final file should be readable and equal to one of the payloads.
    const final = await storage.loadBinaryBlob(key)
    expect(final).not.toBeNull()
    expect(final!.toString()).toMatch(/^writer-\d{2}-payload$/)
  })

  it('leaves no orphan .tmp.* siblings after concurrent same-key writes', async () => {
    const key = '_column_index/permissions/DELETED'
    const writers = Array.from({ length: 20 }, (_, i) =>
      storage.saveBinaryBlob(key, Buffer.from(`payload-${i}`))
    )
    await Promise.all(writers)

    // Locate the directory containing the blob and list its children.
    const blobPath = storage.getBinaryBlobPath(key)
    expect(blobPath).not.toBeNull()
    const parentDir = join(blobPath!, '..')
    const siblings = readdirSync(parentDir)
    const tmps = siblings.filter((name) => name.includes('.tmp'))
    expect(tmps).toEqual([])
  })

  it('handles concurrent writes across the full column-index field set (production shape)', async () => {
    // Mirror the per-field DELETED.bin pattern Brainy's column-store compactor
    // emits. In production this is what races between flush() and gcs-backup.
    const fields = [
      'owner',
      'path',
      'permissions',
      'vfsType',
      'modified',
      'createdAt',
      'accessed',
      'updatedAt',
      'mimeType',
      'size'
    ]

    // Two concurrent compactor passes — one acting as the periodic flush, one
    // as the explicit user flush — both touching every field.
    const passA = fields.map((f) =>
      storage.saveBinaryBlob(`_column_index/${f}/DELETED`, Buffer.from(`A-${f}`))
    )
    const passB = fields.map((f) =>
      storage.saveBinaryBlob(`_column_index/${f}/DELETED`, Buffer.from(`B-${f}`))
    )

    await expect(Promise.all([...passA, ...passB])).resolves.not.toThrow()

    // Every field should have a readable final blob.
    for (const f of fields) {
      const final = await storage.loadBinaryBlob(`_column_index/${f}/DELETED`)
      expect(final).not.toBeNull()
      expect(final!.toString()).toMatch(new RegExp(`^[AB]-${f}$`))
    }
  })

  it('the existing single-writer path still produces correct bytes', async () => {
    // Sanity: the patch must not regress the common single-writer case.
    const key = '_blob/single-writer-test'
    const payload = Buffer.from('hello')
    await storage.saveBinaryBlob(key, payload)
    const read = await storage.loadBinaryBlob(key)
    expect(read?.toString()).toBe('hello')
  })
})
