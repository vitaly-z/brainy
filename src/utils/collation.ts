/**
 * @module utils/collation
 * @description Deterministic string ordering for persisted indexes and any comparison
 * that must agree with the native (Rust) column store / aggregation engine.
 *
 * Strings are compared by **UTF-8 byte order**, which equals Unicode code-point order
 * and is byte-for-byte identical to Rust's `str::cmp` (`as_bytes().cmp()`). This is:
 * - **deterministic** across environments (unlike `localeCompare`, whose default-locale
 *   ordering varies by OS / Node / ICU build — unsafe for a persisted sorted index), and
 * - **cross-language consistent** with `@soulcraft/cortex`'s native column store and
 *   aggregation sort, so query results are identical with or without the native plugin.
 *
 * Use this instead of `String.localeCompare` and the `<`/`>` operators (which compare
 * UTF-16 code units and diverge from code-point order for supplementary-plane characters)
 * wherever ordering is persisted or must match the native engine. See cortex `docs/ADR-001`.
 */

const utf8 = new TextEncoder()

/**
 * Compare two strings by UTF-8 byte order (== Unicode code-point order == Rust `str::cmp`).
 *
 * @param a - First string.
 * @param b - Second string.
 * @returns Negative if `a < b`, positive if `a > b`, `0` if equal — by UTF-8 byte order.
 * @example
 * ['b', 'A', 'a'].sort(compareCodePoints) // ['A', 'a', 'b']  (byte order: A=65, a=97, b=98)
 */
export function compareCodePoints(a: string, b: string): number {
  const ea = utf8.encode(a)
  const eb = utf8.encode(b)
  const len = ea.length < eb.length ? ea.length : eb.length
  for (let i = 0; i < len; i++) {
    if (ea[i] !== eb[i]) return ea[i] - eb[i]
  }
  return ea.length - eb.length
}
