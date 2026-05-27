import { describe, it, expect } from 'vitest'
import { compareCodePoints } from '../../../src/utils/collation.js'

/**
 * compareCodePoints must be byte-for-byte identical to Rust `str::cmp`
 * (UTF-8 byte order == Unicode code-point order), so the JS and native
 * (cortex) column store / aggregation sort agree, and persisted ordering
 * is deterministic across environments (unlike localeCompare).
 */
describe('compareCodePoints (UTF-8 byte / code-point order)', () => {
  it('orders mixed-case ASCII by byte value, NOT locale', () => {
    // 'B' = 0x42 (66), 'a' = 0x61 (97) → 'B' sorts before 'a' (localeCompare would not).
    expect(compareCodePoints('B', 'a')).toBeLessThan(0)
    expect(['a', 'B', 'A', 'b'].sort(compareCodePoints)).toEqual(['A', 'B', 'a', 'b'])
  })

  it('orders ASCII below multi-byte UTF-8', () => {
    // 'z' = 0x7A, 'é' = 0xC3 0xA9 → 'z' < 'é'
    expect(compareCodePoints('z', 'é')).toBeLessThan(0)
    expect(compareCodePoints('é', 'z')).toBeGreaterThan(0)
  })

  it('treats a prefix as less than the longer string', () => {
    expect(compareCodePoints('ab', 'abc')).toBeLessThan(0)
    expect(compareCodePoints('abc', 'ab')).toBeGreaterThan(0)
  })

  it('returns 0 for equal strings', () => {
    expect(compareCodePoints('hello', 'hello')).toBe(0)
    expect(compareCodePoints('', '')).toBe(0)
  })

  it('sorts by code point across the BMP boundary (matches Rust byte order)', () => {
    // '€' = U+20AC (0xE2 0x82 0xAC), '😀' = U+1F600 (0xF0 0x9F 0x98 0x80).
    // Code-point / UTF-8 byte order: 'a' < '€' < '😀'. (UTF-16 `<` would mis-order the astral char.)
    expect(['😀', 'a', '€'].sort(compareCodePoints)).toEqual(['a', '€', '😀'])
  })

  it('is a total order consistent with sort (deterministic)', () => {
    const input = ['banana', 'Apple', 'apple', 'Banana', '101', 'Éclair', 'éclair']
    const a = input.slice().sort(compareCodePoints)
    const b = input.slice().reverse().sort(compareCodePoints)
    expect(a).toEqual(b) // order is independent of input order
  })
})
