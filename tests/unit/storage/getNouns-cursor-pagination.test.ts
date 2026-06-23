/**
 * @module tests/unit/storage/getNouns-cursor-pagination
 * @description Regression for the 7.33.0 permanent-CPU-loop (a production
 * deployment pegged 1-2 cores forever after init). Root cause: the shard-scan
 * pagination (`getNounsWithPagination`) is offset-based and IGNORES the cursor,
 * while 7.32.1 (correctly) made `totalCount` the true dataset total — so
 * `hasMore` stays `true` until fully paginated. A caller paginating by CURSOR
 * (`cursor = page.nextCursor`, e.g. aggregate backfill) therefore re-fetched
 * offset 0 every iteration — `hasMore` never went false — an infinite re-scan,
 * each pass a full O(N) shard-tree walk that pegged the JS main thread.
 *
 * The fix makes the `getNouns()` cursor an opaque, advancing offset token, so
 * cursor pagination behaves exactly like offset pagination (advances + ends).
 * The hard iteration guard below makes a regression FAIL fast instead of hang.
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

/** Seed `n` unique nouns through the real metadata+record save path. */
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

describe('FileSystemStorage.getNouns cursor pagination (7.33.0 CPU-loop regression)', () => {
  it('cursor pagination ADVANCES across pages and terminates (no infinite re-scan)', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'brainy-cursor-'))
    try {
      const storage = new FileSystemStorage(dir)
      await storage.init()
      const TOTAL = 120
      const PAGE = 40 // → 3 full pages, so the cursor MUST advance to finish
      await seed(storage, TOTAL)

      // The exact loop shape the aggregate backfill uses: drive purely off the
      // returned cursor. Pre-fix this never terminated; the guard turns a
      // regression into a fast failure instead of a hung suite.
      const seen = new Set<string>()
      let cursor: string | undefined
      let iterations = 0
      for (;;) {
        if (++iterations > 1000) {
          throw new Error(
            'getNouns cursor pagination did not terminate — the 7.33.0 infinite re-scan regressed'
          )
        }
        const page = await storage.getNouns({
          pagination: cursor ? { limit: PAGE, cursor } : { limit: PAGE }
        })
        for (const n of page.items) seen.add(n.id)
        if (!page.hasMore || page.items.length === 0) break
        expect(page.nextCursor).toBeDefined()
        cursor = page.nextCursor
      }

      // Complete (every entity once) AND bounded (≈ TOTAL/PAGE pages, not ∞).
      expect(seen.size).toBe(TOTAL)
      expect(iterations).toBeLessThanOrEqual(Math.ceil(TOTAL / PAGE) + 1)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('the final page reports hasMore=false and no nextCursor', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'brainy-cursor-last-'))
    try {
      const storage = new FileSystemStorage(dir)
      await storage.init()
      await seed(storage, 30)

      // One page that covers the whole (tiny) corpus.
      const page = await storage.getNouns({ pagination: { limit: 100 } })
      expect(page.items.length).toBe(30)
      expect(page.hasMore).toBe(false)
      expect(page.nextCursor).toBeUndefined()
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('a cursor and the equivalent offset return the same page', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'brainy-cursor-eq-'))
    try {
      const storage = new FileSystemStorage(dir)
      await storage.init()
      await seed(storage, 100)

      const first = await storage.getNouns({ pagination: { limit: 40 } })
      const viaCursor = await storage.getNouns({
        pagination: { limit: 40, cursor: first.nextCursor }
      })
      const viaOffset = await storage.getNouns({ pagination: { limit: 40, offset: 40 } })

      expect(viaCursor.items.map((n) => n.id)).toEqual(viaOffset.items.map((n) => n.id))
      // And the cursor page does NOT repeat the first page (the loop's failure mode).
      const firstIds = new Set(first.items.map((n) => n.id))
      expect(viaCursor.items.some((n) => firstIds.has(n.id))).toBe(false)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})
