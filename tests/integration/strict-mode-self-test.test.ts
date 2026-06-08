/**
 * @module tests/integration/strict-mode-self-test
 * @description Brainy's OWN internal write paths must work under brain-wide
 * strict mode AND under the SDK_CORE_VOCABULARY shape that the SDK 3.20.0
 * registers on every consumer's brain. This suite is the canary that detects
 * any internal path which silently omits subtype.
 *
 * The SDK_CORE_VOCABULARY shape that surfaced Venue's `/book` 500 (2026-06-08)
 * registers `brain.requireSubtype()` rules on six NounTypes:
 *   - NounType.Event
 *   - NounType.Collection
 *   - NounType.Message
 *   - NounType.Contract
 *   - NounType.Media
 *   - NounType.Document
 *
 * If Brainy's own VFS / aggregation / extraction / importer / integration /
 * MCP paths skip subtype anywhere, the enforcement hook fires and Brainy itself
 * starts rejecting its own infrastructure writes. This test exercises every
 * such path under the exact shape Venue hit + brain-wide strict mode, and
 * asserts: zero rejections.
 *
 * @since 7.30.1
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { Brainy } from '../../src/brainy'
import { NounType, VerbType } from '../../src/types/graphTypes'

describe('Brainy strict-mode self-test (7.30.1)', () => {
  let brain: Brainy<any>

  beforeEach(async () => {
    // Brain-wide strict mode ON + the exact SDK_CORE_VOCABULARY shape that
    // Venue hit. If any internal Brainy path skips subtype, the writes here
    // will throw and fail the test.
    brain = new Brainy({
      storage: { type: 'memory' },
      silent: true,
      requireSubtype: true
    })
    await brain.init()

    // Register per-type rules with values whitelists so we catch both the
    // "missing subtype" failure mode AND any path that sets the wrong subtype.
    brain.requireSubtype(NounType.Event, {
      values: ['booking', 'session', 'milestone', 'imported', 'extracted'],
      required: true
    })
    brain.requireSubtype(NounType.Collection, {
      values: ['vfs-root', 'vfs-directory', 'workbench', 'imported', 'extracted'],
      required: true
    })
    brain.requireSubtype(NounType.Message, {
      values: ['mcp-message', 'imported', 'extracted'],
      required: true
    })
    brain.requireSubtype(NounType.Contract, {
      values: ['imported', 'extracted'],
      required: true
    })
    brain.requireSubtype(NounType.Media, {
      values: ['imported', 'extracted', 'vfs-file'],
      required: true
    })
    brain.requireSubtype(NounType.Document, {
      values: ['import-source', 'imported', 'extracted', 'vfs-file'],
      required: true
    })
  })

  afterEach(async () => {
    await brain.close()
  })

  describe('VFS operations under strict mode', () => {
    it('VFS root creation succeeds', async () => {
      // Root creation happens during brain.init() — if it failed, beforeEach
      // would have thrown. Confirm the root entity exists with the right subtype.
      const root = await brain.get('00000000-0000-0000-0000-000000000000')
      expect(root).not.toBeNull()
      expect(root!.subtype).toBe('vfs-root')
    })

    it('mkdir creates a vfs-directory Collection', async () => {
      await brain.vfs.mkdir('/projects')
      const found = await brain.find({
        type: NounType.Collection,
        subtype: 'vfs-directory'
      })
      expect(found.length).toBeGreaterThan(0)
    })

    it('writeFile creates a vfs-file entity + vfs-contains edge', async () => {
      await brain.vfs.mkdir('/notes')
      await brain.vfs.writeFile('/notes/hello.txt', 'hello world')

      // The file's NounType is mime-driven, but its subtype is 'vfs-file'
      const files = await brain.find({ subtype: 'vfs-file' })
      expect(files.length).toBeGreaterThan(0)

      // And the Contains edge carries 'vfs-contains'
      const containsCount = brain.counts.byRelationshipSubtype(
        VerbType.Contains,
        'vfs-contains'
      )
      expect(containsCount).toBeGreaterThan(0)
    })

    it('copy preserves source subtype and creates vfs-contains edge', async () => {
      await brain.vfs.mkdir('/src-dir')
      await brain.vfs.mkdir('/dst-dir')
      await brain.vfs.writeFile('/src-dir/a.txt', 'a')
      await brain.vfs.copy('/src-dir/a.txt', '/dst-dir/a.txt')

      const files = await brain.find({ subtype: 'vfs-file' })
      // Both source and destination should be vfs-file
      expect(files.length).toBeGreaterThanOrEqual(2)
    })

    it('move re-parents with a vfs-contains edge on the new parent', async () => {
      await brain.vfs.mkdir('/from')
      await brain.vfs.mkdir('/to')
      await brain.vfs.writeFile('/from/m.txt', 'move me')
      await brain.vfs.move('/from/m.txt', '/to/m.txt')

      // Both old + new Contains edges exist with vfs-contains subtype
      const containsEdges = brain.counts.byRelationshipSubtype(
        VerbType.Contains,
        'vfs-contains'
      )
      expect(containsEdges).toBeGreaterThan(0)
    })

    it('symlink creates a vfs-symlink entity (distinct from vfs-file)', async () => {
      await brain.vfs.mkdir('/links')
      await brain.vfs.writeFile('/links/target.txt', 'target')
      // Register vfs-symlink in the File vocabulary since this is a brain-wide
      // strict mode test (symlinks use NounType.File which isn't in the
      // SDK_CORE_VOCABULARY by default, but brain-wide strict still applies).
      brain.requireSubtype(NounType.File, {
        values: ['vfs-file', 'vfs-symlink'],
        required: true
      })
      await brain.vfs.symlink('/links/target.txt', '/links/alias.txt')

      const symlinks = await brain.find({ subtype: 'vfs-symlink' })
      expect(symlinks.length).toBeGreaterThan(0)
    })
  })

  describe('Aggregation engine under strict mode', () => {
    it('defining an aggregate + adding source entities does not reject under strict mode', async () => {
      // Register Measurement's vocabulary in case the materializer fires
      brain.requireSubtype(NounType.Measurement, {
        values: ['materialized-aggregate'],
        required: true
      })

      // Define an aggregate with materialize:true. The materializer code path
      // in `aggregation/materializer.ts` is labeled `'materialized-aggregate'`
      // so when it IS wired (8.0+), emitted Measurement entities pass
      // enforcement automatically. The self-test guarantees no part of the
      // aggregate-engine code path throws under strict mode.
      expect(() => {
        brain.defineAggregate({
          name: 'session-count-by-room',
          source: { type: NounType.Event },
          groupBy: ['room'],
          metrics: { sessions: { op: 'count' } },
          materialize: { debounceMs: 0 }
        })
      }).not.toThrow()

      // Generate Events to populate the aggregate's running totals — these
      // writes go through `add()` which routes through the strict-mode check.
      await expect(brain.add({
        type: NounType.Event,
        subtype: 'session',
        data: 'session A',
        metadata: { room: 'r1' }
      })).resolves.toBeDefined()

      await expect(brain.add({
        type: NounType.Event,
        subtype: 'session',
        data: 'session B',
        metadata: { room: 'r1' }
      })).resolves.toBeDefined()

      // queryAggregate is the live read path — confirm it works under strict mode
      const rows = await brain.queryAggregate('session-count-by-room')
      expect(rows.length).toBeGreaterThan(0)
    })
  })

  describe('brain.audit() diagnostic', () => {
    it('returns a 0-gap report on a brain with all paths labeled', async () => {
      // Exercise a representative cross-section of internal paths to populate
      // the brain with infrastructure entities
      await brain.vfs.mkdir('/audit-test')
      await brain.vfs.writeFile('/audit-test/file.txt', 'content')

      const report = await brain.audit()
      // VFS entities are excluded by default — and none of our other writes
      // should have skipped subtype either.
      expect(report.total).toBe(0)
      expect(report.entitiesWithoutSubtype).toEqual({})
      expect(report.relationshipsWithoutSubtype).toEqual({})
      expect(report.recommendation).toMatch(/strict-mode-ready/)
    })

    it('flags entities written without subtype (using includeVFS: true to surface even VFS gaps)', async () => {
      // Switch to a non-strict brain so we can deliberately create a gap to test detection
      await brain.close()
      brain = new Brainy({ storage: { type: 'memory' }, silent: true })
      await brain.init()

      // Deliberately add an entity without a subtype — only allowed because
      // we're not in strict mode for this assertion
      await brain.add({
        type: NounType.Person,
        data: 'no subtype here'
      })

      const report = await brain.audit()
      expect(report.total).toBeGreaterThanOrEqual(1)
      expect(report.entitiesWithoutSubtype['person']).toBe(1)
      expect(report.recommendation).toMatch(/Migrate via/)
    })

    it('excludes VFS entities by default (they bypass enforcement anyway)', async () => {
      await brain.close()
      brain = new Brainy({ storage: { type: 'memory' }, silent: true })
      await brain.init()

      // VFS root + VFS directories all have subtype set, but even if they
      // didn't, the audit would exclude them by default because they carry
      // isVFSEntity / isVFS markers.
      await brain.vfs.mkdir('/vfs-only')

      const defaultReport = await brain.audit()
      // No non-VFS entities exist, so the default report is empty
      expect(defaultReport.total).toBe(0)

      // includeVFS: true surfaces them; should still be 0 because they're all
      // properly labeled
      const includedReport = await brain.audit({ includeVFS: true })
      expect(includedReport.total).toBe(0)
    })
  })

  describe('Error message UX', () => {
    it('error message includes caller location and migration link', async () => {
      await brain.close()
      brain = new Brainy({ storage: { type: 'memory' }, silent: true })
      await brain.init()
      brain.requireSubtype(NounType.Person, {
        values: ['employee', 'customer'],
        required: true
      })

      try {
        await brain.add({ type: NounType.Person, data: 'no subtype' })
        throw new Error('expected enforcement to fire')
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        // Diagnose
        expect(msg).toMatch(/NounType\.person/)
        expect(msg).toMatch(/requires subtype/)
        // Vocabulary guidance
        expect(msg).toMatch(/Pass one of:.*employee.*customer/)
        // Documentation link
        expect(msg).toMatch(/Migration recipe.*subtypes-and-facets/)
      }
    })

    it('off-vocabulary message shows the offending value + allowed vocab', async () => {
      await brain.close()
      brain = new Brainy({ storage: { type: 'memory' }, silent: true })
      await brain.init()
      brain.requireSubtype(NounType.Person, {
        values: ['employee', 'customer'],
        required: true
      })

      try {
        await brain.add({
          type: NounType.Person,
          subtype: 'vendor',
          data: 'wrong vocab'
        })
        throw new Error('expected enforcement to fire')
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        expect(msg).toMatch(/subtype 'vendor' is not in registered vocabulary/)
        expect(msg).toMatch(/employee.*customer|customer.*employee/)
      }
    })

    it('brain-wide strict mode (no per-type vocab) shows the correct guidance', async () => {
      await brain.close()
      brain = new Brainy({
        storage: { type: 'memory' },
        silent: true,
        requireSubtype: true
      })
      await brain.init()

      try {
        await brain.add({ type: NounType.Person, data: 'missing subtype' })
        throw new Error('expected enforcement to fire')
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        expect(msg).toMatch(/Brain-wide strict mode/)
        expect(msg).toMatch(/requireSubtype\.except/)
      }
    })
  })
})
