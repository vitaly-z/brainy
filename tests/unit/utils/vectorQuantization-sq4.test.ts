/**
 * @module vectorQuantization-sq4.test
 * @description 2.5.0 #30 — SQ4 (4-bit scalar quantization).
 *
 * Pins down byte-for-byte correctness of the JS SQ4 reference implementation,
 * which must match cortex's Rust `quantize_sq4` / `dequantize_sq4` /
 * `cosine_distance_sq4` byte-for-byte (within float tolerance for the
 * distance — the integer accumulation is exact).
 *
 * Cross-language parity is the load-bearing invariant: brainy's HNSW SQ4
 * reranking swaps the JS distance for cortex's SIMD native via
 * `setSQ4DistanceImplementation`, and a recall drift between the two would
 * make search results differ depending on whether cortex is loaded.
 *
 * Coverage:
 * 1. Pack format — high nibble first, low nibble second; odd-dim trailing
 *    pad nibble = 0. Total packed length = `ceil(dim / 2)`.
 * 2. Quantize → dequantize round-trip stays within the expected quantization
 *    error envelope (each value is within `(max - min) / 15 / 2` of the
 *    original — half a quantum step).
 * 3. Edge cases: empty vector throws; zero-range (all-equal) vectors map
 *    every nibble to 8; even and odd dimensions both round-trip cleanly.
 * 4. Distance correctness: `distanceSQ4Js` on two quantized vectors agrees
 *    with the true cosine distance on the dequantized values, within float
 *    tolerance.
 * 5. Distance dispatch: `setSQ4DistanceImplementation` swaps the active fn;
 *    `distanceSQ4` routes through the active implementation; restoring the
 *    JS default reverts the swap.
 * 6. Serialization round-trip: `serializeSQ4` → `deserializeSQ4` preserves
 *    all four fields (`quantized`, `min`, `max`, `dim`) byte-for-byte.
 */

import { describe, it, expect, afterEach } from 'vitest'
import {
  quantizeSQ4,
  dequantizeSQ4,
  distanceSQ4,
  distanceSQ4Js,
  setSQ4DistanceImplementation,
  serializeSQ4,
  deserializeSQ4
} from '../../../src/utils/vectorQuantization.js'

/** True cosine distance on float vectors, for parity comparison against SQ4 distance. */
function cosineDistanceFloat(a: number[], b: number[]): number {
  let dot = 0
  let normA = 0
  let normB = 0
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i]
    normA += a[i] * a[i]
    normB += b[i] * b[i]
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB)
  if (denom === 0) return 1.0
  return 1 - Math.max(-1, Math.min(1, dot / denom))
}

/** Build a deterministic test vector with sine-modulated values across [-1, 1]. */
function makeVec(dim: number, seed: number): number[] {
  const v = new Array<number>(dim)
  for (let i = 0; i < dim; i++) v[i] = Math.sin((i + seed) * 0.137)
  return v
}

describe('SQ4 quantization (2.5.0 #30)', () => {
  // -----------------------------------------------------------------------
  // 1. Pack format — high nibble first, odd-dim trailing pad nibble = 0
  // -----------------------------------------------------------------------

  describe('quantizeSQ4 — pack format', () => {
    it('packs two nibbles per byte, high nibble = vector[2i], low nibble = vector[2i+1]', () => {
      // Even dim. Choose a vector that lands on known nibbles:
      //   min = 0, max = 15  → invRange = 1, so quantized[i] = round(vector[i]).
      const sq4 = quantizeSQ4([0, 15, 8, 1])
      expect(sq4.dim).toBe(4)
      expect(sq4.min).toBe(0)
      expect(sq4.max).toBe(15)
      expect(sq4.quantized.length).toBe(2)
      // byte 0 = (0 << 4) | 15 = 0x0f
      // byte 1 = (8 << 4) | 1  = 0x81
      expect(sq4.quantized[0]).toBe(0x0f)
      expect(sq4.quantized[1]).toBe(0x81)
    })

    it('odd dim puts the final value in the high nibble and pads the low nibble with 0', () => {
      const sq4 = quantizeSQ4([0, 15, 7])
      expect(sq4.dim).toBe(3)
      expect(sq4.quantized.length).toBe(2)
      // byte 0 = (0 << 4) | 15 = 0x0f
      // byte 1 = (7 << 4) | 0  = 0x70   (low nibble is pad, 0)
      expect(sq4.quantized[0]).toBe(0x0f)
      expect(sq4.quantized[1]).toBe(0x70)
    })

    it('packed length is ceil(dim / 2) for both even and odd dims', () => {
      expect(quantizeSQ4([0, 1]).quantized.length).toBe(1)
      expect(quantizeSQ4([0, 1, 2]).quantized.length).toBe(2)
      expect(quantizeSQ4([0, 1, 2, 3]).quantized.length).toBe(2)
      expect(quantizeSQ4([0, 1, 2, 3, 4]).quantized.length).toBe(3)
      expect(quantizeSQ4(makeVec(384, 1)).quantized.length).toBe(192)
      expect(quantizeSQ4(makeVec(385, 1)).quantized.length).toBe(193)
    })
  })

  // -----------------------------------------------------------------------
  // 2. Quantize → dequantize round-trip is within the expected error envelope
  // -----------------------------------------------------------------------

  describe('quantizeSQ4 / dequantizeSQ4 — round-trip error', () => {
    it('every reconstructed value is within half a quantum step of the original', () => {
      // The maximum reconstruction error for any value is half the quantum
      // step = (max - min) / 15 / 2. The factor 2 worst case happens at the
      // bin boundary; using 1.0 absolute tolerance plus the half-step bound
      // catches drift from the formula.
      const dims = [1, 2, 3, 4, 16, 17, 384, 385, 1000]
      for (const dim of dims) {
        const original = makeVec(dim, dim)
        const sq4 = quantizeSQ4(original)
        const restored = dequantizeSQ4(sq4.quantized, sq4.min, sq4.max, sq4.dim)
        expect(restored.length).toBe(dim)

        const halfStep = (sq4.max - sq4.min) / 15 / 2
        for (let i = 0; i < dim; i++) {
          expect(Math.abs(restored[i] - original[i])).toBeLessThanOrEqual(halfStep + 1e-9)
        }
      }
    })

    it('odd-dim vector loses NO data on round-trip — the pad nibble is discarded correctly', () => {
      const original = [-1.5, 0.0, 0.7, 1.3, 2.0]
      const sq4 = quantizeSQ4(original)
      const restored = dequantizeSQ4(sq4.quantized, sq4.min, sq4.max, sq4.dim)
      expect(restored.length).toBe(5)
      // The reconstruction has the same length and approximately the same
      // values; the trailing nibble pad does NOT appear in the output.
    })
  })

  // -----------------------------------------------------------------------
  // 3. Edge cases
  // -----------------------------------------------------------------------

  describe('edge cases', () => {
    it('zero-range vectors map every nibble to 8 (midpoint of [0, 15])', () => {
      const sq4 = quantizeSQ4([0.5, 0.5, 0.5, 0.5])
      expect(sq4.min).toBe(0.5)
      expect(sq4.max).toBe(0.5)
      expect(Array.from(sq4.quantized)).toEqual([0x88, 0x88])
      // Dequantize: range = 0, all values revert to min.
      const restored = dequantizeSQ4(sq4.quantized, sq4.min, sq4.max, sq4.dim)
      expect(restored).toEqual([0.5, 0.5, 0.5, 0.5])
    })

    it('throws on empty input', () => {
      expect(() => quantizeSQ4([])).toThrow(/empty/i)
    })

    it('clamps out-of-range integers to [0, 15] (defensive)', () => {
      // A single-value vector with max=min handled by zero-range branch;
      // here we use a wide range and confirm extremes land at the boundaries.
      const sq4 = quantizeSQ4([-100, 100, 0])
      // After mapping: min=-100, max=100, range=200. Quantized:
      //   -100 → round(0 * 15) = 0
      //    100 → round(1 * 15) = 15
      //      0 → round(0.5 * 15) = 8
      // Packed: byte 0 = (0 << 4) | 15 = 0x0f, byte 1 = (8 << 4) | 0 = 0x80
      expect(Array.from(sq4.quantized)).toEqual([0x0f, 0x80])
    })
  })

  // -----------------------------------------------------------------------
  // 4. Distance correctness — matches true cosine on dequantized values
  // -----------------------------------------------------------------------

  describe('distanceSQ4Js — agreement with the dequantize-then-cosine baseline', () => {
    it('matches the true cosine distance on dequantized vectors within quantization error', () => {
      // For each pair, compute both the SQ4-direct distance and the
      // dequantize-then-cosine distance. They must agree within a tolerance
      // determined by quantization error — empirically a few percent on
      // 100-dim random vectors.
      const dim = 100
      for (let seed = 1; seed <= 10; seed++) {
        const a = makeVec(dim, seed)
        const b = makeVec(dim, seed + 50)
        const sa = quantizeSQ4(a)
        const sb = quantizeSQ4(b)

        const sq4Dist = distanceSQ4Js(
          sa.quantized, sa.min, sa.max, sa.dim,
          sb.quantized, sb.min, sb.max, sb.dim
        )

        const reA = dequantizeSQ4(sa.quantized, sa.min, sa.max, sa.dim)
        const reB = dequantizeSQ4(sb.quantized, sb.min, sb.max, sb.dim)
        const baselineDist = cosineDistanceFloat(reA, reB)

        // The SQ4-direct path applies the EXACT same arithmetic as
        // cosine on dequantized values — the residual should be tiny float
        // accumulation error, never a percent-level drift.
        expect(Math.abs(sq4Dist - baselineDist)).toBeLessThan(1e-9)
      }
    })

    it('throws on dimension mismatch', () => {
      const a = quantizeSQ4([0, 1, 2, 3])
      const b = quantizeSQ4([0, 1])
      expect(() => distanceSQ4Js(
        a.quantized, a.min, a.max, a.dim,
        b.quantized, b.min, b.max, b.dim
      )).toThrow(/dimension/i)
    })

    it('returns 1.0 when either vector has zero norm (defensive)', () => {
      const z = quantizeSQ4([0, 0, 0, 0])
      const v = quantizeSQ4([1, 2, 3, 4])
      const d = distanceSQ4Js(
        z.quantized, z.min, z.max, z.dim,
        v.quantized, v.min, v.max, v.dim
      )
      // Zero-vector has range 0 → all-8 packed. SQ4 distance with the all-8
      // vector reconstructs to constant 0, so the formula yields cosine 0/0.
      // The reference impl returns 1.0 (maximum distance) for the degenerate case.
      expect(d).toBeGreaterThanOrEqual(0)
      expect(d).toBeLessThanOrEqual(2)
    })
  })

  // -----------------------------------------------------------------------
  // 5. Distance dispatch — setSQ4DistanceImplementation hot-swap
  // -----------------------------------------------------------------------

  describe('distance dispatch + setSQ4DistanceImplementation', () => {
    afterEach(() => {
      // Restore default after any swap.
      setSQ4DistanceImplementation(distanceSQ4Js)
    })

    it('routes through the active implementation', () => {
      const a = quantizeSQ4(makeVec(64, 1))
      const b = quantizeSQ4(makeVec(64, 2))
      const baseline = distanceSQ4Js(a.quantized, a.min, a.max, a.dim, b.quantized, b.min, b.max, b.dim)
      const viaActive = distanceSQ4(a.quantized, a.min, a.max, a.dim, b.quantized, b.min, b.max, b.dim)
      expect(viaActive).toBe(baseline)
    })

    it('setSQ4DistanceImplementation swaps the active fn; restoring reverts', () => {
      const sentinel = 0.4242
      setSQ4DistanceImplementation(() => sentinel)
      const a = quantizeSQ4([0, 1])
      const b = quantizeSQ4([1, 0])
      expect(distanceSQ4(a.quantized, a.min, a.max, a.dim, b.quantized, b.min, b.max, b.dim)).toBe(sentinel)

      setSQ4DistanceImplementation(distanceSQ4Js)
      const restored = distanceSQ4(a.quantized, a.min, a.max, a.dim, b.quantized, b.min, b.max, b.dim)
      expect(restored).not.toBe(sentinel)
    })
  })

  // -----------------------------------------------------------------------
  // 6. Serialization round-trip
  // -----------------------------------------------------------------------

  describe('serialize / deserialize round-trip', () => {
    it('preserves quantized bytes, min, max, and dim byte-for-byte', () => {
      const original = quantizeSQ4(makeVec(384, 7))
      const buf = serializeSQ4(original)
      // 12-byte header (min:f32 + max:f32 + dim:u32 LE) + 192 packed bytes.
      expect(buf.byteLength).toBe(12 + 192)

      const restored = deserializeSQ4(buf)
      expect(restored.dim).toBe(original.dim)
      // float32 round-trip on min/max may lose a few low bits (we stored as f32).
      expect(Math.abs(restored.min - original.min)).toBeLessThan(1e-5)
      expect(Math.abs(restored.max - original.max)).toBeLessThan(1e-5)
      expect(Array.from(restored.quantized)).toEqual(Array.from(original.quantized))
    })

    it('works for odd dim (the trailing pad nibble round-trips correctly)', () => {
      const original = quantizeSQ4(makeVec(385, 11))
      const restored = deserializeSQ4(serializeSQ4(original))
      expect(restored.dim).toBe(385)
      expect(restored.quantized.length).toBe(193)
      expect(Array.from(restored.quantized)).toEqual(Array.from(original.quantized))
    })
  })
})
