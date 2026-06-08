/**
 * @module utils/callerLocation
 * @description Stack-frame extraction utility used by error/warning messages
 * across Brainy. The first non-Brainy frame on the stack is the consumer's
 * actual call site — the one that's useful to point at in diagnostics.
 *
 * Used by:
 * - Subtype enforcement errors in `brainy.ts` (7.30.1+) — guides consumers
 *   from `requireSubtype()` rejections back to the offending call site.
 * - Query-limit enforcement in `paramValidation.ts` (7.30.2+) — pairs with
 *   the recalibrated limit cap so consumers see which `find({ limit })`
 *   call triggered the warn-or-throw.
 *
 * No runtime dependencies. Pure stack walking + string matching.
 */

/**
 * Extract the first non-Brainy frame from the current stack so error and
 * warning messages can point at the consumer's call site instead of Brainy
 * internals.
 *
 * The function walks `new Error().stack`, skips any frame inside Brainy's own
 * source or compiled output, and returns the first remaining frame stripped of
 * the leading `at ` token so the caller can compose the rendered line however
 * it likes.
 *
 * @param extraSkipPatterns Optional list of substrings — frames matching ANY
 *   of these are also skipped. Use for in-module helpers that show up between
 *   the public API and the consumer (e.g. the formatter that builds the
 *   error message itself).
 * @returns The caller's location string (e.g. `"OrderService.create (/app/src/orders/service.ts:42:23)"`)
 *   or `null` when the stack isn't available or only contains Brainy frames.
 */
export function findCallerLocation(extraSkipPatterns: string[] = []): string | null {
  const stack = new Error().stack
  if (!stack) return null
  const lines = stack.split('\n').slice(1)  // drop the `Error` line
  for (const raw of lines) {
    const line = raw.trim()
    // Always skip Brainy's own source + compiled output. Consumers need their
    // own call site, not `brainy.ts:XXXX` or `dist/brainy.js:XXXX`.
    if (line.includes('/src/brainy.ts') || line.includes('/dist/brainy.js')) continue
    // Skip the validation + diagnostic helpers regardless of which file they
    // live in — they're plumbing between the public API and the consumer.
    if (line.includes('findCallerLocation')) continue
    if (line.includes('paramValidation') && line.includes('validate')) continue
    if (line.includes('enforceSubtypeOn') || line.includes('formatSubtypeError')) continue
    // Caller-supplied patterns (e.g. specific formatter names)
    if (extraSkipPatterns.some(p => line.includes(p))) continue
    // Strip leading `at ` if present so the caller can format consistently.
    return line.replace(/^at /, '')
  }
  return null
}
