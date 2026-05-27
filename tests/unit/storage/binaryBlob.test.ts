/**
 * Binary Blob Primitive — Unit Tests
 *
 * Verifies the raw binary-blob storage primitive
 * (saveBinaryBlob/loadBinaryBlob/deleteBinaryBlob/getBinaryBlobPath) across
 * EVERY storage adapter:
 *   - FileSystemStorage (local, real fs path)
 *   - MemoryStorage (in-memory)
 *   - OPFSStorage (browser, exercised via an in-memory OPFS mock)
 *   - S3CompatibleStorage / R2Storage (AWS SDK, exercised via a fake S3 client)
 *   - GcsStorage (exercised via a fake GCS bucket)
 *   - AzureBlobStorage (exercised via a fake container client)
 *   - HistoricalStorageAdapter (read-only)
 *
 * Each adapter is checked for: save→load round-trip (byte identical), overwrite,
 * delete-then-load→null, load-missing→null, and getBinaryBlobPath behavior (a
 * usable on-disk path for FileSystem, null everywhere else).
 *
 * Cloud adapters are exercised against in-memory fakes that implement only the
 * narrow client surface the blob methods touch. The fakes drive the REAL adapter
 * code (key→object-key mapping, command construction, byte handling), so these
 * are genuine round-trips, not mocked assertions.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import * as os from 'node:os'
import * as fsp from 'node:fs/promises'
import * as nodePath from 'node:path'

import { FileSystemStorage } from '../../../src/storage/adapters/fileSystemStorage.js'
import { MemoryStorage } from '../../../src/storage/adapters/memoryStorage.js'
import { OPFSStorage } from '../../../src/storage/adapters/opfsStorage.js'
import { S3CompatibleStorage } from '../../../src/storage/adapters/s3CompatibleStorage.js'
import { R2Storage } from '../../../src/storage/adapters/r2Storage.js'
import { GcsStorage } from '../../../src/storage/adapters/gcsStorage.js'
import { AzureBlobStorage } from '../../../src/storage/adapters/azureBlobStorage.js'
import { HistoricalStorageAdapter } from '../../../src/storage/adapters/historicalStorageAdapter.js'

// Sample payloads. Include non-UTF8 bytes to prove there is no JSON/text
// round-tripping anywhere in the path.
const PAYLOAD = Buffer.from([0x00, 0x01, 0xff, 0xfe, 0x42, 0x7a, 0x00, 0x80])
const PAYLOAD_2 = Buffer.from([0xde, 0xad, 0xbe, 0xef, 0x00, 0x11])
const KEY = 'graph-lsm/source/sstable-123'
const KEY_FLAT = 'segment-7'

/**
 * Shared behavioral contract every adapter must satisfy. `expectsLocalPath`
 * distinguishes the filesystem adapter (real path) from everyone else (null).
 */
function runBlobContract(
  name: string,
  makeStorage: () => Promise<any>,
  expectsLocalPath: boolean
) {
  describe(`${name} — binary blob contract`, () => {
    let storage: any

    beforeEach(async () => {
      storage = await makeStorage()
    })

    afterEach(async () => {
      try {
        await storage?.clear?.()
      } catch {
        /* best-effort cleanup */
      }
    })

    it('round-trips bytes identically (save → load)', async () => {
      await storage.saveBinaryBlob(KEY, PAYLOAD)
      const loaded = await storage.loadBinaryBlob(KEY)
      expect(loaded).not.toBeNull()
      expect(Buffer.isBuffer(loaded)).toBe(true)
      expect(loaded!.equals(PAYLOAD)).toBe(true)
    })

    it('overwrites an existing blob', async () => {
      await storage.saveBinaryBlob(KEY, PAYLOAD)
      await storage.saveBinaryBlob(KEY, PAYLOAD_2)
      const loaded = await storage.loadBinaryBlob(KEY)
      expect(loaded!.equals(PAYLOAD_2)).toBe(true)
      expect(loaded!.length).toBe(PAYLOAD_2.length)
    })

    it('returns null after delete', async () => {
      await storage.saveBinaryBlob(KEY, PAYLOAD)
      await storage.deleteBinaryBlob(KEY)
      const loaded = await storage.loadBinaryBlob(KEY)
      expect(loaded).toBeNull()
    })

    it('delete is idempotent for a missing blob', async () => {
      // Should not throw even though nothing exists at this key.
      await expect(storage.deleteBinaryBlob('does/not/exist')).resolves.toBeUndefined()
    })

    it('returns null when loading a missing blob', async () => {
      const loaded = await storage.loadBinaryBlob('never/written')
      expect(loaded).toBeNull()
    })

    it('supports flat (non-nested) keys', async () => {
      await storage.saveBinaryBlob(KEY_FLAT, PAYLOAD)
      const loaded = await storage.loadBinaryBlob(KEY_FLAT)
      expect(loaded!.equals(PAYLOAD)).toBe(true)
    })

    it('getBinaryBlobPath honors the backend contract', () => {
      const p = storage.getBinaryBlobPath(KEY)
      if (expectsLocalPath) {
        expect(typeof p).toBe('string')
        expect(p).toContain('_blobs')
        expect(p!.endsWith('.bin')).toBe(true)
      } else {
        expect(p).toBeNull()
      }
    })
  })
}

// =============================================================================
// FileSystemStorage
// =============================================================================

describe('FileSystemStorage', () => {
  let rootDir: string

  runBlobContract(
    'FileSystemStorage',
    async () => {
      rootDir = await fsp.mkdtemp(nodePath.join(os.tmpdir(), 'brainy-blob-fs-'))
      const storage = new FileSystemStorage(rootDir)
      await storage.init()
      return storage
    },
    true
  )

  it('getBinaryBlobPath returns the real on-disk path and the file lands there', async () => {
    const dir = await fsp.mkdtemp(nodePath.join(os.tmpdir(), 'brainy-blob-fspath-'))
    const storage = new FileSystemStorage(dir)
    await storage.init()

    const key = 'graph-lsm/source/sstable-9'
    const expectedPath = nodePath.join(dir, '_blobs', 'graph-lsm', 'source', 'sstable-9.bin')

    // Path convention matches cortex byte-for-byte: _blobs/<parts>.bin
    expect(storage.getBinaryBlobPath(key)).toBe(expectedPath)

    await storage.saveBinaryBlob(key, PAYLOAD)

    // The file must physically exist at exactly the advertised path so native
    // code can mmap it directly.
    const onDisk = await fsp.readFile(expectedPath)
    expect(onDisk.equals(PAYLOAD)).toBe(true)

    await fsp.rm(dir, { recursive: true, force: true })
  })

  it('writes atomically (no leftover .tmp file)', async () => {
    const dir = await fsp.mkdtemp(nodePath.join(os.tmpdir(), 'brainy-blob-atomic-'))
    const storage = new FileSystemStorage(dir)
    await storage.init()

    const key = 'atomic/seg'
    await storage.saveBinaryBlob(key, PAYLOAD)

    const blobDir = nodePath.join(dir, '_blobs', 'atomic')
    const entries = await fsp.readdir(blobDir)
    expect(entries).toContain('seg.bin')
    expect(entries.some((e) => e.endsWith('.tmp'))).toBe(false)

    await fsp.rm(dir, { recursive: true, force: true })
  })
})

// =============================================================================
// MemoryStorage
// =============================================================================

describe('MemoryStorage', () => {
  runBlobContract(
    'MemoryStorage',
    async () => {
      const storage = new MemoryStorage()
      await storage.init()
      return storage
    },
    false
  )

  it('stores a defensive copy (mutating the input does not corrupt the blob)', async () => {
    const storage = new MemoryStorage()
    await storage.init()

    const input = Buffer.from([1, 2, 3, 4])
    await storage.saveBinaryBlob('k', input)

    // Mutate the caller's buffer after saving.
    input[0] = 99

    const loaded = await storage.loadBinaryBlob('k')
    expect(loaded!.equals(Buffer.from([1, 2, 3, 4]))).toBe(true)

    // And the returned buffer is also a copy — mutating it must not affect storage.
    loaded![1] = 88
    const reloaded = await storage.loadBinaryBlob('k')
    expect(reloaded!.equals(Buffer.from([1, 2, 3, 4]))).toBe(true)
  })

  it('clear() also drops blobs', async () => {
    const storage = new MemoryStorage()
    await storage.init()
    await storage.saveBinaryBlob('k', PAYLOAD)
    await storage.clear()
    expect(await storage.loadBinaryBlob('k')).toBeNull()
  })
})

// =============================================================================
// OPFSStorage (browser) — exercised via an in-memory OPFS mock
// =============================================================================

/**
 * Minimal in-memory implementation of the FileSystem Access API surface that
 * OPFSStorage uses (getDirectoryHandle / getFileHandle / createWritable /
 * getFile / arrayBuffer / text / removeEntry / entries). Sufficient to drive the
 * adapter's real code paths in Node, where OPFS does not exist.
 */
function createOPFSMock() {
  class MockFile {
    constructor(public bytes: Uint8Array) {}
    async arrayBuffer(): Promise<ArrayBuffer> {
      // Return a standalone ArrayBuffer copy.
      return this.bytes.slice().buffer
    }
    async text(): Promise<string> {
      return Buffer.from(this.bytes).toString('utf-8')
    }
    get size(): number {
      return this.bytes.length
    }
  }

  class MockWritable {
    private chunks: Uint8Array[] = []
    constructor(private fileHandle: MockFileHandle) {}
    async write(data: any): Promise<void> {
      if (typeof data === 'string') {
        this.chunks.push(new Uint8Array(Buffer.from(data, 'utf-8')))
      } else if (data instanceof Uint8Array) {
        this.chunks.push(new Uint8Array(data))
      } else if (data instanceof ArrayBuffer) {
        this.chunks.push(new Uint8Array(data))
      } else if (data && data.buffer) {
        this.chunks.push(new Uint8Array(data.buffer))
      } else {
        this.chunks.push(new Uint8Array(Buffer.from(String(data), 'utf-8')))
      }
    }
    async close(): Promise<void> {
      const total = this.chunks.reduce((n, c) => n + c.length, 0)
      const merged = new Uint8Array(total)
      let off = 0
      for (const c of this.chunks) {
        merged.set(c, off)
        off += c.length
      }
      this.fileHandle.bytes = merged
    }
  }

  class MockFileHandle {
    kind = 'file' as const
    constructor(public name: string, public bytes: Uint8Array = new Uint8Array(0)) {}
    async createWritable(): Promise<MockWritable> {
      return new MockWritable(this)
    }
    async getFile(): Promise<MockFile> {
      return new MockFile(this.bytes)
    }
  }

  class MockDirHandle {
    kind = 'directory' as const
    files = new Map<string, MockFileHandle>()
    dirs = new Map<string, MockDirHandle>()
    constructor(public name: string) {}

    async getDirectoryHandle(name: string, opts?: { create?: boolean }): Promise<MockDirHandle> {
      let d = this.dirs.get(name)
      if (!d) {
        if (!opts?.create) {
          const err: any = new Error(`Directory not found: ${name}`)
          err.name = 'NotFoundError'
          throw err
        }
        d = new MockDirHandle(name)
        this.dirs.set(name, d)
      }
      return d
    }

    async getFileHandle(name: string, opts?: { create?: boolean }): Promise<MockFileHandle> {
      let f = this.files.get(name)
      if (!f) {
        if (!opts?.create) {
          const err: any = new Error(`File not found: ${name}`)
          err.name = 'NotFoundError'
          throw err
        }
        f = new MockFileHandle(name)
        this.files.set(name, f)
      }
      return f
    }

    async removeEntry(name: string, opts?: { recursive?: boolean }): Promise<void> {
      if (this.files.has(name)) {
        this.files.delete(name)
        return
      }
      if (this.dirs.has(name)) {
        this.dirs.delete(name)
        return
      }
      const err: any = new Error(`Entry not found: ${name}`)
      err.name = 'NotFoundError'
      throw err
    }

    async *entries(): AsyncIterableIterator<[string, MockFileHandle | MockDirHandle]> {
      for (const [n, f] of this.files) yield [n, f]
      for (const [n, d] of this.dirs) yield [n, d]
    }
  }

  const root = new MockDirHandle('<root>')
  const navigatorMock = {
    storage: {
      getDirectory: async () => root,
      persisted: async () => true,
      persist: async () => true,
      estimate: async () => ({ usage: 0, quota: 1_000_000 })
    }
  }
  return { navigatorMock }
}

describe('OPFSStorage', () => {
  let hadNavigator = false
  let originalNavigatorDescriptor: PropertyDescriptor | undefined

  const installMock = () => {
    const { navigatorMock } = createOPFSMock()
    // In Node, globalThis.navigator is a read-only getter, so we must redefine
    // it rather than assign. Capture the original descriptor to restore later.
    originalNavigatorDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'navigator')
    hadNavigator = originalNavigatorDescriptor !== undefined
    Object.defineProperty(globalThis, 'navigator', {
      value: navigatorMock,
      configurable: true,
      writable: true
    })
  }

  const restoreMock = () => {
    if (hadNavigator && originalNavigatorDescriptor) {
      Object.defineProperty(globalThis, 'navigator', originalNavigatorDescriptor)
    } else {
      delete (globalThis as any).navigator
    }
  }

  runBlobContract(
    'OPFSStorage',
    async () => {
      installMock()
      const storage = new OPFSStorage()
      await storage.init()
      return storage
    },
    false
  )

  afterEach(() => {
    restoreMock()
  })
})

// =============================================================================
// Cloud adapter fakes
// =============================================================================

/**
 * In-memory fake of the AWS S3 v3 client surface used by the blob methods.
 * Dispatches on the command class name and reads the command's `.input`.
 * Used by both S3CompatibleStorage and R2Storage (both speak the AWS SDK).
 */
function createFakeS3Client() {
  const store = new Map<string, Buffer>()
  return {
    store,
    async send(command: any): Promise<any> {
      const type = command?.constructor?.name
      const input = command?.input ?? {}
      const key = input.Key as string

      if (type === 'PutObjectCommand') {
        store.set(key, Buffer.from(input.Body))
        return {}
      }
      if (type === 'GetObjectCommand') {
        const data = store.get(key)
        if (!data) {
          const err: any = new Error('NoSuchKey')
          err.name = 'NoSuchKey'
          err.$metadata = { httpStatusCode: 404 }
          throw err
        }
        return {
          Body: {
            transformToByteArray: async () => new Uint8Array(data),
            transformToString: async () => data.toString('utf-8')
          }
        }
      }
      if (type === 'DeleteObjectCommand') {
        store.delete(key)
        return {}
      }
      throw new Error(`FakeS3Client: unhandled command ${type}`)
    }
  }
}

/** In-memory fake of the GCS Bucket surface used by the blob methods. */
function createFakeGcsBucket() {
  const store = new Map<string, Buffer>()
  return {
    store,
    file(name: string) {
      return {
        async save(data: Buffer): Promise<void> {
          store.set(name, Buffer.from(data))
        },
        async download(): Promise<[Buffer]> {
          const data = store.get(name)
          if (!data) {
            const err: any = new Error('Not Found')
            err.code = 404
            throw err
          }
          return [Buffer.from(data)]
        },
        async delete(): Promise<void> {
          if (!store.has(name)) {
            const err: any = new Error('Not Found')
            err.code = 404
            throw err
          }
          store.delete(name)
        }
      }
    }
  }
}

/** In-memory fake of the Azure ContainerClient surface used by the blob methods. */
function createFakeAzureContainerClient() {
  const store = new Map<string, Buffer>()
  return {
    store,
    getBlockBlobClient(name: string) {
      return {
        async upload(data: Buffer, _length: number): Promise<void> {
          store.set(name, Buffer.from(data))
        },
        async download(_offset: number): Promise<any> {
          const data = store.get(name)
          if (!data) {
            const err: any = new Error('BlobNotFound')
            err.statusCode = 404
            err.code = 'BlobNotFound'
            throw err
          }
          // Provide a Node Readable stream of the bytes; streamToBuffer consumes it.
          const { Readable } = require('node:stream')
          return { readableStreamBody: Readable.from([data]) }
        },
        async delete(): Promise<void> {
          if (!store.has(name)) {
            const err: any = new Error('BlobNotFound')
            err.statusCode = 404
            err.code = 'BlobNotFound'
            throw err
          }
          store.delete(name)
        }
      }
    }
  }
}

// =============================================================================
// S3CompatibleStorage (fake client)
// =============================================================================

describe('S3CompatibleStorage', () => {
  runBlobContract(
    'S3CompatibleStorage',
    async () => {
      const storage = new S3CompatibleStorage({
        bucketName: 'test-bucket',
        region: 'us-east-1',
        accessKeyId: 'test',
        secretAccessKey: 'test'
      })
      // Bypass real network init; inject in-memory fake client.
      ;(storage as any).isInitialized = true
      ;(storage as any).bucketValidated = true
      ;(storage as any).s3Client = createFakeS3Client()
      return storage
    },
    false
  )

  it('maps the blob key to the _blobs/<key>.bin object key', async () => {
    const storage = new S3CompatibleStorage({
      bucketName: 'test-bucket',
      region: 'us-east-1',
      accessKeyId: 'test',
      secretAccessKey: 'test'
    })
    const fake = createFakeS3Client()
    ;(storage as any).isInitialized = true
    ;(storage as any).bucketValidated = true
    ;(storage as any).s3Client = fake

    await storage.saveBinaryBlob('graph-lsm/source/sstable-1', PAYLOAD)
    expect([...fake.store.keys()]).toEqual(['_blobs/graph-lsm/source/sstable-1.bin'])
  })
})

// =============================================================================
// R2Storage (fake client)
// =============================================================================

describe('R2Storage', () => {
  runBlobContract(
    'R2Storage',
    async () => {
      const storage = new R2Storage({
        bucketName: 'test-bucket',
        accountId: 'acct123',
        accessKeyId: 'test',
        secretAccessKey: 'test'
      })
      ;(storage as any).isInitialized = true
      ;(storage as any).bucketValidated = true
      ;(storage as any).s3Client = createFakeS3Client()
      return storage
    },
    false
  )
})

// =============================================================================
// GcsStorage (fake bucket)
// =============================================================================

describe('GcsStorage', () => {
  runBlobContract(
    'GcsStorage',
    async () => {
      const storage = new GcsStorage({ bucketName: 'test-bucket' })
      ;(storage as any).isInitialized = true
      ;(storage as any).bucketValidated = true
      ;(storage as any).bucket = createFakeGcsBucket()
      return storage
    },
    false
  )
})

// =============================================================================
// AzureBlobStorage (fake container client)
// =============================================================================

describe('AzureBlobStorage', () => {
  runBlobContract(
    'AzureBlobStorage',
    async () => {
      const storage = new AzureBlobStorage({
        containerName: 'test-container',
        connectionString:
          'DefaultEndpointsProtocol=https;AccountName=test;AccountKey=dGVzdA==;EndpointSuffix=core.windows.net'
      })
      ;(storage as any).isInitialized = true
      ;(storage as any).bucketValidated = true
      ;(storage as any).containerClient = createFakeAzureContainerClient()
      return storage
    },
    false
  )
})

// =============================================================================
// HistoricalStorageAdapter (read-only)
// =============================================================================

describe('HistoricalStorageAdapter — binary blob (read-only)', () => {
  /**
   * Build a HistoricalStorageAdapter over a real COW-enabled MemoryStorage, then
   * commit a binary blob into the tree so loadBinaryBlob can resolve it from the
   * historical commit state.
   */
  async function makeHistorical(withBlob: boolean) {
    const underlying = new MemoryStorage()
    await underlying.init()
    await underlying.initializeCOW({ branch: 'main' })

    const blobStorage = underlying.blobStorage!
    const refManager = underlying.refManager!

    const { TreeBuilder } = await import('../../../src/storage/cow/TreeObject.js')
    const { CommitBuilder } = await import('../../../src/storage/cow/CommitObject.js')

    // Build a tree; optionally include a _blobs/<key>.bin entry holding raw bytes.
    const treeBuilder = TreeBuilder.create(blobStorage)
    if (withBlob) {
      const blobHash = await blobStorage.write(PAYLOAD)
      treeBuilder.addBlob('_blobs/graph-lsm/source/sstable-123.bin', blobHash, PAYLOAD.length)
    }
    const treeHash = await treeBuilder.build()

    const commitHash = await CommitBuilder.create(blobStorage)
      .tree(treeHash)
      .parent(null)
      .message('blob commit')
      .author('test')
      .timestamp(Date.now())
      .build()

    await refManager.createBranch('snapshot', commitHash, {
      description: 'snapshot',
      author: 'test'
    })

    const historical = new HistoricalStorageAdapter({
      underlyingStorage: underlying,
      commitId: commitHash,
      branch: 'main'
    })
    await historical.init()
    return historical
  }

  it('loads a blob committed into the historical state (bytes identical)', async () => {
    const historical = await makeHistorical(true)
    const loaded = await historical.loadBinaryBlob('graph-lsm/source/sstable-123')
    expect(loaded).not.toBeNull()
    expect(loaded!.equals(PAYLOAD)).toBe(true)
  })

  it('returns null for a blob absent from the historical state', async () => {
    const historical = await makeHistorical(false)
    const loaded = await historical.loadBinaryBlob('graph-lsm/source/sstable-123')
    expect(loaded).toBeNull()
  })

  it('saveBinaryBlob throws (read-only)', async () => {
    const historical = await makeHistorical(false)
    await expect(historical.saveBinaryBlob('k', PAYLOAD)).rejects.toThrow(/read-only/i)
  })

  it('deleteBinaryBlob throws (read-only)', async () => {
    const historical = await makeHistorical(false)
    await expect(historical.deleteBinaryBlob('k')).rejects.toThrow(/read-only/i)
  })

  it('getBinaryBlobPath returns null', async () => {
    const historical = await makeHistorical(false)
    expect(historical.getBinaryBlobPath('k')).toBeNull()
  })
})
