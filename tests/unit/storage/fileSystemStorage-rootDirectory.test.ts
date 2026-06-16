/**
 * Regression: FileSystemStorage must expose a public `rootDirectory` getter.
 *
 * Native vector plugins (e.g. @soulcraft/cortex's NativeHNSWWrapper) feature-detect
 * `storage.rootDirectory` to enable their memory-mapped vector fast path. Brainy
 * stores the path as the protected `rootDir`; without this public alias the native
 * mmap backend stayed un-wired and the index rebuilt via slow per-entity disk reads
 * on cold start (BRAINY-MMAP-VECTOR-HOOK). The getter is the load-bearing line, so
 * guard it explicitly.
 */
import { describe, it, expect } from 'vitest'
import { mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { FileSystemStorage } from '../../../src/storage/adapters/fileSystemStorage.js'

describe('FileSystemStorage.rootDirectory (native mmap-backend hook)', () => {
  it('exposes the constructor root path via a public rootDirectory getter', () => {
    const dir = mkdtempSync(join(tmpdir(), 'brainy-rootdir-'))
    try {
      const storage = new FileSystemStorage(dir)
      // The exact property a native vector backend reads to engage its mmap path.
      expect((storage as unknown as { rootDirectory: string }).rootDirectory).toBe(dir)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})
