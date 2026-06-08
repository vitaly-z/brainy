/**
 * @module tests/integration/find-limits
 * @description Integration coverage for the 7.30.2 `find({ limit })` cap
 * recalibration + two-tier enforcement (warn-then-throw). See
 * `BR-MAXLIMIT-9000` in PLATFORM-HANDOFF.md for the original incident report
 * and `docs/guides/find-limits.md` for the consumer-facing guide.
 *
 * Coverage:
 *
 * - Below cap: silent pass.
 * - Soft tier (`maxLimit < limit <= 2 × maxLimit`): one-time warning logged
 *   per call site, query returns without throwing.
 * - Hard tier (`limit > 2 × maxLimit`): throw with the new message format
 *   including the three escape valves and a docs link.
 * - Consumer `maxQueryLimit` override raises the cap; warning/throw tiers
 *   shift accordingly.
 * - Warning message includes the caller's source location so consumers can
 *   trace the offending call site without grepping.
 *
 * @since 7.30.2
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { Brainy } from '../../src/brainy'
import { NounType } from '../../src/types/graphTypes'
import {
  ValidationConfig,
  resetLimitWarningCache,
  validateFindParams
} from '../../src/utils/paramValidation'
import * as logger from '../../src/utils/logger'

describe('find({ limit }) two-tier enforcement (7.30.2)', () => {
  let brain: Brainy<any>
  let warnSpy: ReturnType<typeof vi.spyOn>

  beforeEach(async () => {
    // Reset the validation singleton + warning dedup so each test sees a
    // freshly-derived cap rather than one fixed by an earlier test.
    ValidationConfig.reset()
    resetLimitWarningCache()
    // Spy directly on `prodLog.warn` — the call site the limit enforcement
    // actually uses. Spying on `console.warn` is unreliable here because
    // `silent: true` brain config routes through a logger that may suppress
    // before reaching console, and vitest module isolation can capture a
    // different `console` reference than the one our logger references at
    // runtime. The prodLog.warn entry point is what we control, so that's
    // what we observe.
    warnSpy = vi.spyOn(logger.prodLog, 'warn').mockImplementation(() => undefined)
  })

  afterEach(async () => {
    if (brain) await brain.close()
    warnSpy.mockRestore()
  })

  describe('Validator-level behavior (no brain instance needed)', () => {
    it('silent pass below cap', () => {
      const cfg = ValidationConfig.getInstance({ maxQueryLimit: 1000 })
      expect(() => validateFindParams({ limit: cfg.maxLimit })).not.toThrow()
      expect(warnSpy).not.toHaveBeenCalled()
    })

    it('soft tier warns once per call site without throwing', () => {
      ValidationConfig.getInstance({ maxQueryLimit: 1000 })

      // The dedup key is `(caller, limit)`. To exercise the dedup honestly we
      // need both invocations to hit the SAME source line — extracting them
      // into a wrapper that lives at one location is the deterministic way.
      const callFromOneSite = () => validateFindParams({ limit: 1500 })

      expect(() => callFromOneSite()).not.toThrow()
      expect(warnSpy).toHaveBeenCalledTimes(1)

      // Same source line + same limit → dedup, no second warning
      expect(() => callFromOneSite()).not.toThrow()
      expect(warnSpy).toHaveBeenCalledTimes(1)
    })

    it('warning message names the recipe + docs link', () => {
      ValidationConfig.getInstance({ maxQueryLimit: 1000 })

      validateFindParams({ limit: 1500 })

      const message = String(warnSpy.mock.calls[0][0])
      expect(message).toMatch(/find\(\{ limit: 1500 \}\)/)
      expect(message).toMatch(/exceeds the auto-configured query limit of 1000/)
      expect(message).toMatch(/new Brainy\(\{ maxQueryLimit:/)
      expect(message).toMatch(/new Brainy\(\{ reservedQueryMemory:/)
      expect(message).toMatch(/Paginate:/)
      expect(message).toMatch(/Docs: https:\/\/soulcraft\.com\/docs\/guides\/find-limits/)
    })

    it('warning message includes the caller location from the stack', () => {
      ValidationConfig.getInstance({ maxQueryLimit: 1000 })

      validateFindParams({ limit: 1500 })

      const message = String(warnSpy.mock.calls[0][0])
      // The caller is THIS test file; the formatter strips the leading `at `
      // and emits an `  at <location>` line in the rendered message.
      expect(message).toMatch(/at .*find-limits\.test\.ts/)
    })

    it('hard tier throws with the same message format', () => {
      ValidationConfig.getInstance({ maxQueryLimit: 1000 })

      // Above 2× cap = real OOM territory = throw
      expect(() => validateFindParams({ limit: 2001 })).toThrow(
        /exceeds the auto-configured query limit of 1000/
      )
      // No warning was logged — throw fires immediately at the hard tier
      expect(warnSpy).not.toHaveBeenCalled()
    })

    it('hard tier message names all three escape valves', () => {
      ValidationConfig.getInstance({ maxQueryLimit: 1000 })

      try {
        validateFindParams({ limit: 5000 })
        throw new Error('expected throw')
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        expect(message).toMatch(/maxQueryLimit/)
        expect(message).toMatch(/reservedQueryMemory/)
        expect(message).toMatch(/Paginate:/)
        expect(message).toMatch(/Docs: https:\/\/soulcraft\.com\/docs\/guides\/find-limits/)
      }
    })

    it('soft-tier warning dedup is keyed on (caller, limit) — different limits from same site fire separately', () => {
      ValidationConfig.getInstance({ maxQueryLimit: 1000 })

      const call = (limit: number) => validateFindParams({ limit })

      call(1500)
      call(1500)
      expect(warnSpy).toHaveBeenCalledTimes(1)

      // Different limit value → new dedup key → second warning
      call(1800)
      expect(warnSpy).toHaveBeenCalledTimes(2)
    })
  })

  describe('Consumer override via Brainy constructor', () => {
    it('maxQueryLimit raises the cap; warning/throw tiers shift accordingly', async () => {
      brain = new Brainy({
        storage: { type: 'memory' },
        silent: true,
        maxQueryLimit: 50_000
      })
      await brain.init()
      // Brainy's init path emits a one-time `prodLog.warn` for the
      // entityIdMapper system-resource notice on first-mount; clear the spy
      // history so we only observe limit-enforcement warnings below.
      warnSpy.mockClear()

      // The old auto-derived cap would have rejected this; the override accepts it
      expect(() => validateFindParams({ limit: 10_000 })).not.toThrow()
      expect(warnSpy).not.toHaveBeenCalled()

      // 50_000 + 1 = soft tier under the new cap → warn, not throw
      expect(() => validateFindParams({ limit: 60_000 })).not.toThrow()
      expect(warnSpy).toHaveBeenCalled()

      // Above 2× the override (100 001) → throw
      // (Note: maxQueryLimit is hard-clamped at 100k in ValidationConfig, so the
      // effective cap is 50_000; 2× = 100_000; we cross at 100_001.)
      expect(() => validateFindParams({ limit: 100_001 })).toThrow(/exceeds/)
    })

    it('pre-7.30.2 regression scenario: limit: 10_000 passes silently on a memory-derived cap', async () => {
      // Simulate a box where the auto-config picks a cap below 10_000 — the
      // canonical pre-7.30.2 scenario where production booking flows 500'd
      // because `validateFindParams` threw synchronously. With the
      // 25 KB-per-result calibration the cap is ~4× more generous on the
      // same hardware, but more importantly the soft tier no longer throws
      // when consumers exceed the auto-cap.
      ValidationConfig.reconfigure({ maxQueryLimit: 9000 })

      // Pre-7.30.2 this threw. Post-7.30.2 it warns + passes.
      expect(() => validateFindParams({
        type: NounType.Event,
        where: { status: 'open' },
        limit: 10_000
      })).not.toThrow()
      expect(warnSpy).toHaveBeenCalled()
    })
  })
})
