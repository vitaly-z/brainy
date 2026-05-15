/**
 * Cortex compatibility test (BR-DEFENSIVE-INTERFACE regression).
 *
 * Brainy 7.21.0 added several optional storage-adapter methods
 * (`supportsMultiProcessLocking`, `acquireWriterLock`, etc.). Older plugins
 * (notably `@soulcraft/cortex@2.2.0`) bundle a pre-7.21 `BaseStorage` that
 * doesn't have them. Calling them unconditionally crashed boot.
 *
 * 7.22.0 fix: every call site is gated by `hasStorageMethod(name)` so older
 * adapters degrade with a single warning at init.
 *
 * This test constructs a deliberately-stripped storage adapter (no new
 * methods) and proves Brainy boots, can add/find/close normally, and logs
 * the expected one-line warning.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { Brainy } from '../../src/brainy.js'
import { MemoryStorage } from '../../src/storage/adapters/memoryStorage.js'
import { NounType } from '../../src/types/graphTypes.js'

/**
 * Mock storage adapter modeling pre-7.21 Cortex: extends MemoryStorage
 * (which has full storage semantics) but deletes the new methods so Brainy
 * sees a "method missing" surface. Class name is masked so the warning
 * message names it as `LegacyCortexLikeStorage`.
 */
class LegacyCortexLikeStorage extends MemoryStorage {
  constructor() {
    super()
    // Strip the 7.21+ methods. `delete` on prototype methods is awkward
    // across TS strictness levels; assigning `undefined` produces the same
    // `typeof === 'function'` false that older adapters exhibit.
    ;(this as any).supportsMultiProcessLocking = undefined
    ;(this as any).acquireWriterLock = undefined
    ;(this as any).releaseWriterLock = undefined
    ;(this as any).readWriterLock = undefined
    ;(this as any).startFlushRequestWatcher = undefined
    ;(this as any).stopFlushRequestWatcher = undefined
    ;(this as any).requestFlushOverFilesystem = undefined
  }
}

describe('Cortex compatibility (BR-DEFENSIVE-INTERFACE)', () => {
  let brain: Brainy | null = null
  let warnSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(async () => {
    if (brain) {
      try { await brain.close() } catch { /* may already be closed */ }
      brain = null
    }
    warnSpy.mockRestore()
  })

  it('boots without throwing against an adapter missing the 7.21+ methods', async () => {
    brain = new Brainy({ storage: new LegacyCortexLikeStorage() as any })
    await expect(brain.init()).resolves.toBeUndefined()
  })

  it('logs a one-line warning naming the older adapter', async () => {
    brain = new Brainy({ storage: new LegacyCortexLikeStorage() as any })
    await brain.init()

    const warnMessages = warnSpy.mock.calls
      .map(call => String(call[0] ?? ''))
      .join('\n')
    expect(warnMessages).toMatch(/LegacyCortexLikeStorage|predates the 7\.21/i)
  })

  it('basic CRUD works normally (the missing methods are not on the hot path)', async () => {
    brain = new Brainy({ storage: new LegacyCortexLikeStorage() as any })
    await brain.init()

    const id = await brain.add({ data: 'hello', type: NounType.Concept })
    const fetched = await brain.get(id)
    expect(fetched).toBeTruthy()
    expect(fetched!.id).toBe(id)

    await brain.flush() // No-op for memory-backed, but must not throw.
  })

  it('requestFlush() returns false when storage does not implement the RPC', async () => {
    brain = new Brainy({ storage: new LegacyCortexLikeStorage() as any })
    await brain.init()

    // Same-process call would normally flush directly. Force the
    // cross-process path by temporarily making this brain look read-only.
    ;(brain as any).operationalMode = { canWrite: false, validateOperation: () => {} }
    const ok = await brain.requestFlush({ timeoutMs: 500 })
    expect(ok).toBe(false)
  })

  it('stats() reports no writerLock for older adapters', async () => {
    brain = new Brainy({ storage: new LegacyCortexLikeStorage() as any })
    await brain.init()

    const stats = await brain.stats()
    expect(stats.mode).toBe('writer')
    expect(stats.writerLock).toBeUndefined()
  })
})
