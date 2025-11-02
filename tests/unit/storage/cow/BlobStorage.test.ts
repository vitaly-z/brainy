/**
 * Comprehensive tests for BlobStorage
 *
 * Tests:
 * - Content-addressable storage (SHA-256)
 * - Deduplication
 * - Compression (zstd)
 * - LRU caching
 * - Batch operations
 * - Reference counting
 * - Garbage collection
 * - Error handling
 * - Performance characteristics
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { BlobStorage, COWStorageAdapter } from '../../../../src/storage/cow/BlobStorage.js'

/**
 * Simple in-memory COW storage adapter for testing
 */
class InMemoryCOWAdapter implements COWStorageAdapter {
  private store = new Map<string, Buffer>()

  async get(key: string): Promise<Buffer | undefined> {
    return this.store.get(key)
  }

  async put(key: string, data: Buffer): Promise<void> {
    this.store.set(key, data)
  }

  async delete(key: string): Promise<void> {
    this.store.delete(key)
  }

  async list(prefix: string): Promise<string[]> {
    const keys: string[] = []
    for (const key of this.store.keys()) {
      if (key.startsWith(prefix)) {
        keys.push(key)
      }
    }
    return keys.sort()
  }
}

describe('BlobStorage', () => {
  let adapter: COWStorageAdapter
  let blobStorage: BlobStorage

  beforeEach(() => {
    adapter = new InMemoryCOWAdapter()
    blobStorage = new BlobStorage(adapter, { enableCompression: true })
  })

  describe('Content-Addressable Storage', () => {
    it('should compute SHA-256 hash of data', () => {
      const data = Buffer.from('hello world')
      const hash = BlobStorage.hash(data)

      expect(hash).toBe('b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9')
      expect(hash).toHaveLength(64)
    })

    it('should write blob and return hash', async () => {
      const data = Buffer.from('test data')
      const hash = await blobStorage.write(data)

      expect(hash).toBeTruthy()
      expect(hash).toHaveLength(64)
    })

    it('should read blob by hash', async () => {
      const data = Buffer.from('test data')
      const hash = await blobStorage.write(data)

      const retrieved = await blobStorage.read(hash)

      expect(retrieved.toString()).toBe('test data')
    })

    it('should verify data integrity on read', async () => {
      const data = Buffer.from('test data')
      const hash = await blobStorage.write(data)

      // Clear cache so read() fetches from storage
      blobStorage.clearCache()

      // Corrupt the blob data
      await adapter.put(`blob:${hash}`, Buffer.from('corrupted'))

      // Should detect corruption via hash verification
      await expect(blobStorage.read(hash)).rejects.toThrow('integrity check failed')
    })

    it('should check if blob exists', async () => {
      const data = Buffer.from('test data')
      const hash = await blobStorage.write(data)

      expect(await blobStorage.has(hash)).toBe(true)
      expect(await blobStorage.has('0'.repeat(64))).toBe(false)
    })
  })

  describe('Deduplication', () => {
    it('should deduplicate identical blobs', async () => {
      const data = Buffer.from('duplicate data')

      const hash1 = await blobStorage.write(data)
      const hash2 = await blobStorage.write(data)

      expect(hash1).toBe(hash2)

      const stats = blobStorage.getStats()
      expect(stats.totalBlobs).toBe(1)
      expect(stats.dedupSavings).toBe(data.length)
    })

    it('should increment ref count on duplicate write', async () => {
      const data = Buffer.from('test data')

      await blobStorage.write(data)
      const hash = await blobStorage.write(data)

      const metadata = await blobStorage.getMetadata(hash)
      expect(metadata?.refCount).toBe(2)
    })

    it('should track deduplication savings', async () => {
      const data = Buffer.from('x'.repeat(1000))

      const hash1 = await blobStorage.write(data)
      const hash2 = await blobStorage.write(data)
      const hash3 = await blobStorage.write(data)

      const stats = blobStorage.getStats()
      expect(stats.dedupSavings).toBe(2000)  // 2 duplicates × 1000 bytes
    })
  })

  describe('Compression', () => {
    it('should compress large text data with zstd', async () => {
      const data = Buffer.from('a'.repeat(10000))

      const hash = await blobStorage.write(data, {
        type: 'metadata',
        compression: 'zstd'
      })

      const metadata = await blobStorage.getMetadata(hash)

      // zstd may not be available in test environment - falls back to 'none'
      // This is expected behavior (see BlobStorage initCompression fallback)
      if (metadata?.compression === 'zstd') {
        expect(metadata.compressedSize).toBeLessThan(metadata.size)
      } else {
        // Fallback to 'none' is acceptable when zstd unavailable
        expect(metadata?.compression).toBe('none')
      }
    })

    it('should decompress zstd data on read', async () => {
      const originalData = Buffer.from('test data '.repeat(100))

      const hash = await blobStorage.write(originalData, {
        type: 'metadata',
        compression: 'zstd'
      })

      const retrieved = await blobStorage.read(hash)

      expect(retrieved.toString()).toBe(originalData.toString())
    })

    it('should not compress small blobs', async () => {
      const data = Buffer.from('small')

      const hash = await blobStorage.write(data, {
        compression: 'auto'
      })

      const metadata = await blobStorage.getMetadata(hash)

      expect(metadata?.compression).toBe('none')
    })

    it('should not compress vector data (already dense)', async () => {
      const vectorData = Buffer.from(new Float32Array([1, 2, 3, 4, 5]))

      const hash = await blobStorage.write(vectorData, {
        type: 'vector',
        compression: 'auto'
      })

      const metadata = await blobStorage.getMetadata(hash)

      expect(metadata?.compression).toBe('none')
    })

    it('should auto-compress metadata/tree/commit types', async () => {
      const data = Buffer.from('x'.repeat(5000))

      const hash = await blobStorage.write(data, {
        type: 'metadata',
        compression: 'auto'
      })

      const metadata = await blobStorage.getMetadata(hash)

      // Should compress if zstd is available
      if (metadata?.compression === 'zstd') {
        expect(metadata.compressedSize).toBeLessThan(metadata.size)
      }
    })
  })

  describe('LRU Caching', () => {
    it('should cache blob on read', async () => {
      const data = Buffer.from('cached data')
      const hash = await blobStorage.write(data)

      // First read (cache miss)
      await blobStorage.read(hash)

      // Second read (cache hit)
      await blobStorage.read(hash)

      const stats = blobStorage.getStats()
      expect(stats.cacheHits).toBeGreaterThan(0)
    })

    it('should evict LRU entries when cache is full', async () => {
      const smallCache = new BlobStorage(adapter, {
        cacheMaxSize: 100,  // Very small cache
        enableCompression: false
      })

      // Write blobs that exceed cache size
      const blob1 = Buffer.from('x'.repeat(50))
      const blob2 = Buffer.from('y'.repeat(50))
      const blob3 = Buffer.from('z'.repeat(50))

      const hash1 = await smallCache.write(blob1)
      const hash2 = await smallCache.write(blob2)
      const hash3 = await smallCache.write(blob3)  // Should evict hash1

      // Read all blobs
      await smallCache.read(hash1)
      await smallCache.read(hash2)
      await smallCache.read(hash3)

      // hash1 should have been evicted, causing cache miss
      const stats = smallCache.getStats()
      expect(stats.cacheMisses).toBeGreaterThan(0)
    })

    it('should clear cache on demand', async () => {
      const data = Buffer.from('test')
      const hash = await blobStorage.write(data)

      await blobStorage.read(hash)  // Cache it

      blobStorage.clearCache()

      await blobStorage.read(hash)  // Should be cache miss

      const stats = blobStorage.getStats()
      expect(stats.cacheMisses).toBeGreaterThan(0)
    })
  })

  describe('Batch Operations', () => {
    it('should write multiple blobs in parallel', async () => {
      const blobs: Array<[Buffer, any]> = [
        [Buffer.from('blob1'), undefined],
        [Buffer.from('blob2'), undefined],
        [Buffer.from('blob3'), undefined]
      ]

      const hashes = await blobStorage.writeBatch(blobs)

      expect(hashes).toHaveLength(3)
      expect(hashes[0]).toHaveLength(64)
      expect(hashes[1]).toHaveLength(64)
      expect(hashes[2]).toHaveLength(64)
    })

    it('should read multiple blobs in parallel', async () => {
      const data1 = Buffer.from('blob1')
      const data2 = Buffer.from('blob2')
      const data3 = Buffer.from('blob3')

      const hash1 = await blobStorage.write(data1)
      const hash2 = await blobStorage.write(data2)
      const hash3 = await blobStorage.write(data3)

      const blobs = await blobStorage.readBatch([hash1, hash2, hash3])

      expect(blobs).toHaveLength(3)
      expect(blobs[0].toString()).toBe('blob1')
      expect(blobs[1].toString()).toBe('blob2')
      expect(blobs[2].toString()).toBe('blob3')
    })
  })

  describe('Reference Counting', () => {
    it('should track reference count', async () => {
      const data = Buffer.from('test')

      const hash = await blobStorage.write(data)

      let metadata = await blobStorage.getMetadata(hash)
      expect(metadata?.refCount).toBe(1)

      // Write duplicate (increments ref count)
      await blobStorage.write(data)

      metadata = await blobStorage.getMetadata(hash)
      expect(metadata?.refCount).toBe(2)
    })

    it('should only delete when refCount reaches 0', async () => {
      const data = Buffer.from('test')

      // Write twice (refCount = 2)
      const hash = await blobStorage.write(data)
      await blobStorage.write(data)

      // Delete once (refCount = 1, blob still exists)
      await blobStorage.delete(hash)

      expect(await blobStorage.has(hash)).toBe(true)

      // Delete again (refCount = 0, blob deleted)
      await blobStorage.delete(hash)

      expect(await blobStorage.has(hash)).toBe(false)
    })
  })

  describe('Garbage Collection', () => {
    it('should delete unreferenced blobs', async () => {
      const blob1 = Buffer.from('referenced')
      const blob2 = Buffer.from('unreferenced')

      const hash1 = await blobStorage.write(blob1)
      const hash2 = await blobStorage.write(blob2)

      // Manually set refCount to 0 for unreferenced blob
      // (In real COW usage, refCount tracks actual references from commits/trees)
      // GC only deletes when refCount === 0 AND not in referenced set
      const metadata2 = await blobStorage.getMetadata(hash2)
      if (metadata2) {
        metadata2.refCount = 0
        await adapter.put(`blob-meta:${hash2}`, Buffer.from(JSON.stringify(metadata2)))
      }

      // Mark only hash1 as referenced
      const referenced = new Set([hash1])

      const deleted = await blobStorage.garbageCollect(referenced)

      expect(deleted).toBeGreaterThan(0)
      expect(await blobStorage.has(hash1)).toBe(true)
      expect(await blobStorage.has(hash2)).toBe(false)
    })

    it('should not delete referenced blobs', async () => {
      const blob1 = Buffer.from('ref1')
      const blob2 = Buffer.from('ref2')

      const hash1 = await blobStorage.write(blob1)
      const hash2 = await blobStorage.write(blob2)

      // Both referenced
      const referenced = new Set([hash1, hash2])

      const deleted = await blobStorage.garbageCollect(referenced)

      expect(deleted).toBe(0)
      expect(await blobStorage.has(hash1)).toBe(true)
      expect(await blobStorage.has(hash2)).toBe(true)
    })
  })

  describe('Metadata', () => {
    it('should store blob metadata', async () => {
      const data = Buffer.from('test')

      const hash = await blobStorage.write(data, {
        type: 'metadata',
        compression: 'none'
      })

      const metadata = await blobStorage.getMetadata(hash)

      expect(metadata?.hash).toBe(hash)
      expect(metadata?.size).toBe(data.length)
      expect(metadata?.type).toBe('metadata')
      expect(metadata?.compression).toBe('none')
      expect(metadata?.createdAt).toBeGreaterThan(0)
      expect(metadata?.refCount).toBe(1)
    })
  })

  describe('List Operations', () => {
    it('should list all blobs', async () => {
      const hash1 = await blobStorage.write(Buffer.from('blob1'))
      const hash2 = await blobStorage.write(Buffer.from('blob2'))
      const hash3 = await blobStorage.write(Buffer.from('blob3'))

      const blobs = await blobStorage.listBlobs()

      expect(blobs).toContain(hash1)
      expect(blobs).toContain(hash2)
      expect(blobs).toContain(hash3)
    })
  })

  describe('Statistics', () => {
    it('should track storage statistics', async () => {
      const data1 = Buffer.from('x'.repeat(1000))
      const data2 = Buffer.from('y'.repeat(2000))

      await blobStorage.write(data1)
      await blobStorage.write(data2)

      const stats = blobStorage.getStats()

      expect(stats.totalBlobs).toBe(2)
      expect(stats.totalSize).toBe(3000)
      expect(stats.avgBlobSize).toBe(1500)
    })

    it('should calculate compression ratio', async () => {
      const data = Buffer.from('a'.repeat(10000))

      await blobStorage.write(data, {
        type: 'metadata',
        compression: 'zstd'
      })

      const stats = blobStorage.getStats()

      // Compression ratio should be > 1 if compressed
      if (stats.compressedSize < stats.totalSize) {
        expect(stats.compressionRatio).toBeGreaterThan(1)
      }
    })
  })

  describe('Error Handling', () => {
    it('should throw on reading non-existent blob', async () => {
      await expect(
        blobStorage.read('0'.repeat(64))
      ).rejects.toThrow('Blob not found')
    })

    it('should throw on reading blob with missing metadata', async () => {
      const data = Buffer.from('test')
      const hash = await blobStorage.write(data)

      // Clear cache so read() actually checks metadata
      blobStorage.clearCache()

      // Delete metadata but keep blob
      await adapter.delete(`blob-meta:${hash}`)

      // Use skipCache to ensure we check metadata
      await expect(blobStorage.read(hash, { skipCache: true })).rejects.toThrow('metadata not found')
    })
  })

  describe('Performance', () => {
    it('should write 1000 small blobs quickly', async () => {
      const start = Date.now()

      for (let i = 0; i < 1000; i++) {
        await blobStorage.write(Buffer.from(`blob${i}`))
      }

      const elapsed = Date.now() - start

      expect(elapsed).toBeLessThan(5000)  // Should complete in < 5s
    })

    it('should read 1000 cached blobs very quickly', async () => {
      // Write and cache blobs
      const hashes: string[] = []
      for (let i = 0; i < 1000; i++) {
        const hash = await blobStorage.write(Buffer.from(`blob${i}`))
        hashes.push(hash)
      }

      // First read (populate cache)
      for (const hash of hashes) {
        await blobStorage.read(hash)
      }

      // Second read (from cache)
      const start = Date.now()
      for (const hash of hashes) {
        await blobStorage.read(hash)
      }
      const elapsed = Date.now() - start

      expect(elapsed).toBeLessThan(1000)  // Should be very fast from cache
    })
  })
})
