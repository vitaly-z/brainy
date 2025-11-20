/**
 * TestWrappingAdapter: Real COW storage adapter for testing
 *
 * This adapter ACTUALLY wraps binary data in JSON (like production storage)
 * to properly test the unwrap logic in BlobStorage.
 *
 * Unlike InMemoryCOWAdapter which stores Buffers directly,
 * this adapter simulates real storage behavior:
 * 1. Compresses with gzip
 * 2. Wraps binary as {_binary: true, data: "base64..."}
 * 3. Parses JSON on read (returns JS object, not Buffer)
 *
 * This ensures tests exercise the ACTUAL code path that caused v5.10.0 regression.
 */

import { COWStorageAdapter } from '../../src/storage/cow/BlobStorage.js'
import { gzip, gunzip } from 'zlib'
import { promisify } from 'util'

const gzipAsync = promisify(gzip)
const gunzipAsync = promisify(gunzip)

export class TestWrappingAdapter implements COWStorageAdapter {
  private storage = new Map<string, Buffer>()

  async get(key: string): Promise<any | undefined> {
    const compressed = this.storage.get(key)
    if (!compressed) {
      return undefined
    }

    // Decompress (like real storage)
    const decompressed = await gunzipAsync(compressed)

    // Parse JSON (like real storage)
    // This returns a JS object: {_binary: true, data: "base64..."}
    // NOT a Buffer!
    return JSON.parse(decompressed.toString())
  }

  async put(key: string, data: Buffer): Promise<void> {
    // v6.2.0: Use key-based dispatch (matches baseStorage COW adapter)
    // NO GUESSING - key format explicitly declares data type
    const obj = key.includes('-meta:') || key.startsWith('ref:')
      ? JSON.parse(data.toString())  // Metadata/refs: ALWAYS JSON
      : { _binary: true, data: data.toString('base64') }  // Blobs: ALWAYS binary

    // Stringify to JSON
    const jsonStr = JSON.stringify(obj)

    // Compress (like real storage)
    const compressed = await gzipAsync(Buffer.from(jsonStr))

    // Store compressed data
    this.storage.set(key, compressed)
  }

  async delete(key: string): Promise<void> {
    this.storage.delete(key)
  }

  async list(prefix: string): Promise<string[]> {
    const keys: string[] = []
    for (const key of this.storage.keys()) {
      if (key.startsWith(prefix)) {
        keys.push(key)
      }
    }
    return keys
  }

  /**
   * Clear all storage (for test cleanup)
   */
  clear(): void {
    this.storage.clear()
  }

  /**
   * Get storage size (for testing)
   */
  size(): number {
    return this.storage.size
  }
}
