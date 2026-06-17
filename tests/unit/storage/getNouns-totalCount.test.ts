/**
 * @module tests/unit/storage/getNouns-totalCount
 * @description Regression for BRAINY-MMAP-VECTOR-HOOK (Section H). The
 * index-rebuild gate (`rebuildIndexesIfNeeded`) reads
 * `getNouns({ pagination: { limit: 1 } }).totalCount` to decide whether a brain
 * is "small" enough to rebuild inline. The shard-scan pagination
 * (`BaseStorage.getNounsWithPagination`) early-terminates at `offset + limit`
 * for memory efficiency, then returned `collectedNouns.length` as `totalCount` —
 * i.e. the PAGE size, never the dataset total. So every non-empty filesystem
 * brain reported `totalCount: 1` and logged "Small dataset (1 items)" on cold
 * start, regardless of the real corpus size (a consumer saw this for an
 * ~8.8k-entity brain). `totalCount` must be the authoritative O(1) noun counter
 * (maintained on every add/delete, rehydrated from `counts.json` on init).
 */
import { describe, it, expect } from 'vitest'
import { mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { FileSystemStorage } from '../../../src/storage/adapters/fileSystemStorage.js'
import type { NounMetadata } from '../../../src/coreTypes.js'

const DIM = 8

/** A deterministic non-zero vector so the noun record is well-formed. */
function vec(seed: number): number[] {
  return Array.from({ length: DIM }, (_, i) => ((seed + i) % 7) / 7 - 0.5)
}

/** Storage shards by UUID, so ids must be 32 hex chars. */
function uuid(i: number): string {
  return i.toString(16).padStart(32, '0')
}

/**
 * Seed `n` unique nouns. Metadata is saved BEFORE the noun record: it is the
 * recommended order (avoids stat drift) and it is also where the O(1) noun
 * counter is incremented, so this mirrors the real add() path.
 */
async function seed(storage: FileSystemStorage, n: number): Promise<void> {
  for (let i = 0; i < n; i++) {
    const id = uuid(i)
    await storage.saveNounMetadata(id, {
      noun: 'thing',
      createdAt: Date.now(),
      updatedAt: Date.now()
    } as NounMetadata)
    await storage.saveNoun({ id, vector: vec(i), connections: new Map(), level: 0 })
  }
}

describe('FileSystemStorage.getNouns totalCount (rebuild-gate count)', () => {
  it('reports the TRUE total, not the page size, for a 1-item page', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'brainy-totalcount-'))
    try {
      const storage = new FileSystemStorage(dir)
      await storage.init()
      await seed(storage, 25)

      // The exact call the index-rebuild gate makes.
      const onePage = await storage.getNouns({ pagination: { limit: 1 } })
      expect(onePage.items.length).toBe(1)
      // Before the fix this was 1 (collectedNouns.length === limit).
      expect(onePage.totalCount).toBe(25)
      expect(onePage.hasMore).toBe(true)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('still reports the true total after a cold reopen (counts rehydrate)', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'brainy-totalcount-reopen-'))
    try {
      const first = new FileSystemStorage(dir)
      await first.init()
      await seed(first, 25)
      // Flush the count to counts.json so a fresh instance rehydrates it.
      await (first as unknown as { persistCounts(): Promise<void> }).persistCounts()

      // Cold start: a brand-new instance over the same directory.
      const reopened = new FileSystemStorage(dir)
      await reopened.init()
      const page = await reopened.getNouns({ pagination: { limit: 1 } })
      expect(page.totalCount).toBe(25)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})
