/**
 * Vector Quantization Utilities
 *
 * Standalone SQ8 (Scalar Quantization, 8-bit) functions for HNSW vector compression.
 * Each vector is independently quantized using its own min/max codebook.
 *
 * Storage format per vector:
 *   - quantized: Uint8Array (dimension bytes, 4x smaller than float32)
 *   - min: number (codebook minimum)
 *   - max: number (codebook maximum)
 *
 * Accuracy: SQ8 introduces ~0.4% error per dimension on normalized vectors.
 * Combined with reranking (3x over-retrieval + float32 rerank), recall@100
 * is expected to remain >99% for typical workloads.
 */

import type { Vector } from '../coreTypes.js'

/**
 * Result of SQ8 quantization
 */
export interface SQ8QuantizedVector {
  quantized: Uint8Array
  min: number
  max: number
}

/**
 * Configuration for HNSW quantization
 */
export interface HNSWQuantizationConfig {
  enabled: boolean
  bits: 8 | 4
  rerankMultiplier: number
}

/**
 * Quantize a float32 vector to SQ8 (8-bit unsigned integers).
 *
 * Maps [min, max] of the vector to [0, 255].
 * For zero-range vectors (all values equal), all quantized values are 128.
 *
 * @param vector - Input float32 vector
 * @returns Quantized vector with codebook (min/max)
 */
export function quantizeSQ8(vector: Vector): SQ8QuantizedVector {
  const len = vector.length
  let min = vector[0]
  let max = vector[0]

  for (let i = 1; i < len; i++) {
    const v = vector[i]
    if (v < min) min = v
    if (v > max) max = v
  }

  const range = max - min
  const quantized = new Uint8Array(len)

  if (range === 0) {
    // All values are identical — map to midpoint
    quantized.fill(128)
  } else {
    const scale = 255 / range
    for (let i = 0; i < len; i++) {
      quantized[i] = Math.round((vector[i] - min) * scale)
    }
  }

  return { quantized, min, max }
}

/**
 * Dequantize an SQ8 vector back to float32.
 *
 * @param quantized - Uint8Array of quantized values
 * @param min - Codebook minimum
 * @param max - Codebook maximum
 * @returns Reconstructed float32 vector
 */
export function dequantizeSQ8(quantized: Uint8Array, min: number, max: number): Vector {
  const len = quantized.length
  const result = new Array<number>(len)
  const range = max - min

  if (range === 0) {
    result.fill(min)
  } else {
    const scale = range / 255
    for (let i = 0; i < len; i++) {
      result[i] = min + quantized[i] * scale
    }
  }

  return result
}

/**
 * Reference JS implementation of {@link distanceSQ8}: approximate cosine distance
 * between two SQ8-quantized vectors, operating directly on the uint8 arrays without
 * full dequantization. Cosine distance is `1 - (A·B / (|A| · |B|))`; for quantized
 * values `q_i` with codebook `(min, max)` the actual value is
 * `min + q_i * (max - min) / 255`, and the dot product / norms are computed on the
 * quantized values and rescaled by the codebook parameters.
 *
 * Exported so callers can explicitly restore the default after swapping in a native
 * implementation, and so cross-language parity tests can compare native output
 * against this baseline.
 *
 * @param a - First quantized vector.
 * @param aMin - First vector's codebook minimum.
 * @param aMax - First vector's codebook maximum.
 * @param b - Second quantized vector.
 * @param bMin - Second vector's codebook minimum.
 * @param bMax - Second vector's codebook maximum.
 * @returns Approximate cosine distance in [0, 2].
 */
export function distanceSQ8Js(
  a: Uint8Array,
  aMin: number,
  aMax: number,
  b: Uint8Array,
  bMin: number,
  bMax: number
): number {
  const len = a.length

  // Compute raw integer sums for efficiency
  // actual_a[i] = aMin + a[i] * aScale, where aScale = (aMax - aMin) / 255
  // actual_b[i] = bMin + b[i] * bScale, where bScale = (bMax - bMin) / 255
  //
  // dot = sum(actual_a[i] * actual_b[i])
  //     = sum((aMin + a[i]*aScale) * (bMin + b[i]*bScale))
  //     = n*aMin*bMin + aMin*bScale*sum(b[i]) + bMin*aScale*sum(a[i]) + aScale*bScale*sum(a[i]*b[i])
  //
  // normA^2 = sum(actual_a[i]^2)
  //         = n*aMin^2 + 2*aMin*aScale*sum(a[i]) + aScale^2*sum(a[i]^2)

  const aScale = (aMax - aMin) / 255
  const bScale = (bMax - bMin) / 255

  let sumA = 0
  let sumB = 0
  let sumAB = 0
  let sumAA = 0
  let sumBB = 0

  for (let i = 0; i < len; i++) {
    const ai = a[i]
    const bi = b[i]
    sumA += ai
    sumB += bi
    sumAB += ai * bi
    sumAA += ai * ai
    sumBB += bi * bi
  }

  const dot =
    len * aMin * bMin +
    aMin * bScale * sumB +
    bMin * aScale * sumA +
    aScale * bScale * sumAB

  const normASq =
    len * aMin * aMin +
    2 * aMin * aScale * sumA +
    aScale * aScale * sumAA

  const normBSq =
    len * bMin * bMin +
    2 * bMin * bScale * sumB +
    bScale * bScale * sumBB

  const normA = Math.sqrt(normASq)
  const normB = Math.sqrt(normBSq)

  if (normA === 0 || normB === 0) {
    return 1.0 // Maximum distance for zero vectors
  }

  const cosine = dot / (normA * normB)
  // Clamp to [-1, 1] to handle floating point imprecision
  return 1 - Math.max(-1, Math.min(1, cosine))
}

/** Signature of the SQ8 approximate-distance function (quantized cosine distance). */
export type SQ8DistanceFn = (
  a: Uint8Array,
  aMin: number,
  aMax: number,
  b: Uint8Array,
  bMin: number,
  bMax: number
) => number

/**
 * Active SQ8 distance implementation. Defaults to the JS `distanceSQ8Js`; swapped to
 * a native SIMD implementation by {@link setSQ8DistanceImplementation} when a cortex
 * `distance:sq8` provider is registered. The native implementation is byte-compatible
 * (same quantized cosine formula), so results match within float tolerance.
 */
let activeSQ8Distance: SQ8DistanceFn = distanceSQ8Js

/**
 * Approximate cosine distance between two SQ8-quantized vectors, dispatched to the
 * active implementation (JS by default, native when a `distance:sq8` provider is
 * registered). Used in the HNSW SQ8 reranking hot path.
 *
 * @param a - First quantized vector.
 * @param aMin - First vector's codebook minimum.
 * @param aMax - First vector's codebook maximum.
 * @param b - Second quantized vector.
 * @param bMin - Second vector's codebook minimum.
 * @param bMax - Second vector's codebook maximum.
 * @returns Approximate cosine distance in [0, 2].
 */
export function distanceSQ8(
  a: Uint8Array,
  aMin: number,
  aMax: number,
  b: Uint8Array,
  bMin: number,
  bMax: number
): number {
  return activeSQ8Distance(a, aMin, aMax, b, bMin, bMax)
}

/**
 * Replace the SQ8 approximate-distance implementation at runtime (e.g. cortex's Rust
 * SIMD `distance:sq8`). Called by `brainy.ts` when the provider is registered. Pass
 * {@link distanceSQ8Js} to restore the JS default.
 *
 * @param fn - Native implementation; must match {@link SQ8DistanceFn} byte-for-byte.
 */
export function setSQ8DistanceImplementation(fn: SQ8DistanceFn): void {
  activeSQ8Distance = fn
}

/**
 * Serialize an SQ8 quantized vector to a compact binary format.
 *
 * Format: [min:float32][max:float32][quantized:uint8[]]
 * Total size: 8 + dimension bytes
 *
 * @param sq8 - Quantized vector
 * @returns ArrayBuffer with serialized data
 */
export function serializeSQ8(sq8: SQ8QuantizedVector): ArrayBuffer {
  const buffer = new ArrayBuffer(8 + sq8.quantized.length)
  const view = new DataView(buffer)
  view.setFloat32(0, sq8.min, true) // little-endian
  view.setFloat32(4, sq8.max, true)
  new Uint8Array(buffer, 8).set(sq8.quantized)
  return buffer
}

/**
 * Deserialize an SQ8 quantized vector from binary format.
 *
 * @param buffer - ArrayBuffer with serialized data
 * @returns Deserialized SQ8 quantized vector
 */
export function deserializeSQ8(buffer: ArrayBuffer): SQ8QuantizedVector {
  const view = new DataView(buffer)
  const min = view.getFloat32(0, true)
  const max = view.getFloat32(4, true)
  const quantized = new Uint8Array(buffer, 8)
  return { quantized, min, max }
}

// ===========================================================================
// SQ4 — 4-bit scalar quantization (2.5.0 #30)
//
// Each dimension is mapped to [0, 15] (16 levels) and packed two-per-byte:
// high nibble = vector[2i], low nibble = vector[2i+1]. Achieves 8× compression
// vs float32 (vs 4× for SQ8) at the cost of higher quantization error.
//
// The format + arithmetic are byte-for-byte identical to cortex's Rust
// `quantize_sq4` / `dequantize_sq4` / `cosine_distance_sq4` (see
// `cortex/native/src/quantization.rs`). When a `distance:sq4` provider is
// registered (cortex's SIMD Rust implementation), `setSQ4DistanceImplementation`
// swaps the JS reference in for the native one; cross-language parity tests
// verify the swap is recall-equivalent within float tolerance.
// ===========================================================================

/**
 * @description 4-bit scalar-quantized vector. The `quantized` buffer is packed
 * two nibbles per byte (high nibble = `vector[2i]`, low nibble = `vector[2i+1]`).
 * Odd dimensions place the final value in the high nibble and leave the low
 * nibble zero. `dim` must be recorded explicitly because packed byte length
 * `ceil(dim/2)` doesn't encode whether the trailing low nibble is data or pad.
 */
export interface SQ4QuantizedVector {
  /** Packed nibbles. Length = `ceil(dim / 2)`. */
  quantized: Uint8Array
  /** Codebook minimum (used to reconstruct the value range on dequantization). */
  min: number
  /** Codebook maximum. */
  max: number
  /** Original vector dimensionality (needed to detect the odd-dim pad nibble). */
  dim: number
}

/**
 * @description Quantize a float vector to SQ4. Each dimension is mapped to
 * `[0, 15]` via `round((v - min) / range * 15)`, clamped, then packed
 * two-per-byte. Zero-range vectors (all values identical) map to the midpoint
 * `8` in every nibble — `0x88` in every byte.
 *
 * Byte-for-byte identical to cortex's `quantize_sq4` (Rust); cross-language
 * parity tests confirm this. Use {@link distanceSQ4} for approximate cosine
 * directly on the packed bytes — there's no need to {@link dequantizeSQ4}
 * before computing distances.
 *
 * @param vector - Input float vector (length must be ≥ 1).
 * @returns Packed SQ4 vector with codebook + original dimension.
 * @throws If `vector` is empty.
 */
export function quantizeSQ4(vector: Vector): SQ4QuantizedVector {
  const dim = vector.length
  if (dim === 0) {
    throw new Error('quantizeSQ4: vector cannot be empty')
  }

  let min = vector[0]
  let max = vector[0]
  for (let i = 1; i < dim; i++) {
    const v = vector[i]
    if (v < min) min = v
    if (v > max) max = v
  }

  const packedLen = (dim + 1) >>> 1
  const quantized = new Uint8Array(packedLen)
  const range = max - min

  if (range === 0) {
    // All values identical — every nibble = 8 (midpoint of [0, 15]).
    quantized.fill(0x88)
    return { quantized, min, max, dim }
  }

  const invRange = 15 / range
  let i = 0
  let byteIdx = 0
  while (i + 1 < dim) {
    const hi = clampNibble(Math.round((vector[i] - min) * invRange))
    const lo = clampNibble(Math.round((vector[i + 1] - min) * invRange))
    quantized[byteIdx++] = (hi << 4) | lo
    i += 2
  }
  if (i < dim) {
    // Odd dimension: final value in the high nibble, low nibble = 0 pad.
    const hi = clampNibble(Math.round((vector[i] - min) * invRange))
    quantized[byteIdx] = hi << 4
  }

  return { quantized, min, max, dim }
}

/**
 * @description Dequantize an SQ4 packed buffer back to a float vector.
 * Reverses {@link quantizeSQ4}: each nibble is mapped back to
 * `min + nibble * (max - min) / 15`. The trailing pad nibble of an odd-`dim`
 * vector is correctly dropped (the result has length exactly `dim`).
 *
 * @param quantized - Packed SQ4 buffer (length `ceil(dim/2)`).
 * @param min - Codebook minimum from {@link quantizeSQ4}.
 * @param max - Codebook maximum from {@link quantizeSQ4}.
 * @param dim - Original vector dimensionality.
 * @returns Reconstructed float vector of length `dim`.
 */
export function dequantizeSQ4(
  quantized: Uint8Array,
  min: number,
  max: number,
  dim: number
): Vector {
  const result = new Array<number>(dim)
  const range = max - min

  if (range === 0) {
    for (let i = 0; i < dim; i++) result[i] = min
    return result
  }

  const scale = range / 15
  let out = 0
  for (let b = 0; b < quantized.length && out < dim; b++) {
    const byte = quantized[b]
    result[out++] = min + ((byte >>> 4) & 0x0f) * scale
    if (out < dim) {
      result[out++] = min + (byte & 0x0f) * scale
    }
  }

  return result
}

/**
 * @description Reference JS implementation of {@link distanceSQ4}: approximate
 * cosine distance between two SQ4-quantized vectors. Unpacks nibbles inline,
 * then accumulates the same `(sumA, sumB, sumAA, sumBB, sumAB)` integers SQ8
 * uses and applies the SQ8 cosine-from-quantized formula with `15` (not `255`)
 * as the quantization range. Result is byte-equivalent to cortex's
 * `cosine_distance_sq4` (Rust) within float tolerance.
 *
 * Exported so callers can explicitly restore the JS default after a native
 * swap, and so cross-language parity tests compare native output against this
 * baseline.
 */
export function distanceSQ4Js(
  a: Uint8Array,
  aMin: number,
  aMax: number,
  aDim: number,
  b: Uint8Array,
  bMin: number,
  bMax: number,
  bDim: number
): number {
  if (aDim !== bDim) {
    throw new Error(`distanceSQ4Js: dimension mismatch ${aDim} vs ${bDim}`)
  }
  if (aDim === 0) {
    throw new Error('distanceSQ4Js: vectors cannot be empty')
  }

  let sumA = 0
  let sumB = 0
  let sumAB = 0
  let sumAA = 0
  let sumBB = 0

  // Walk both packed buffers nibble-by-nibble, in lock-step.
  let i = 0
  let byteIdx = 0
  while (i + 1 < aDim) {
    const aByte = a[byteIdx]
    const bByte = b[byteIdx]
    const aHi = (aByte >>> 4) & 0x0f
    const aLo = aByte & 0x0f
    const bHi = (bByte >>> 4) & 0x0f
    const bLo = bByte & 0x0f

    sumA += aHi + aLo
    sumB += bHi + bLo
    sumAB += aHi * bHi + aLo * bLo
    sumAA += aHi * aHi + aLo * aLo
    sumBB += bHi * bHi + bLo * bLo

    i += 2
    byteIdx++
  }
  if (i < aDim) {
    // Odd dim: only the high nibble of the final byte is data.
    const aHi = (a[byteIdx] >>> 4) & 0x0f
    const bHi = (b[byteIdx] >>> 4) & 0x0f
    sumA += aHi
    sumB += bHi
    sumAB += aHi * bHi
    sumAA += aHi * aHi
    sumBB += bHi * bHi
  }

  const aScale = (aMax - aMin) / 15
  const bScale = (bMax - bMin) / 15
  const n = aDim

  const dot =
    n * aMin * bMin +
    aMin * bScale * sumB +
    bMin * aScale * sumA +
    aScale * bScale * sumAB

  const normASq =
    n * aMin * aMin +
    2 * aMin * aScale * sumA +
    aScale * aScale * sumAA

  const normBSq =
    n * bMin * bMin +
    2 * bMin * bScale * sumB +
    bScale * bScale * sumBB

  const denom = Math.sqrt(normASq) * Math.sqrt(normBSq)
  if (denom === 0) return 1.0

  const cosine = dot / denom
  return 1 - Math.max(-1, Math.min(1, cosine))
}

/** Signature of the SQ4 approximate-distance function (quantized cosine distance). */
export type SQ4DistanceFn = (
  a: Uint8Array,
  aMin: number,
  aMax: number,
  aDim: number,
  b: Uint8Array,
  bMin: number,
  bMax: number,
  bDim: number
) => number

/**
 * Active SQ4 distance implementation. Defaults to the JS {@link distanceSQ4Js};
 * swapped to cortex's SIMD Rust implementation by {@link setSQ4DistanceImplementation}
 * when a `distance:sq4` provider is registered. The native implementation is
 * byte-compatible (same quantized cosine formula with `15` as the quantization
 * range), so results match within float tolerance.
 */
let activeSQ4Distance: SQ4DistanceFn = distanceSQ4Js

/**
 * @description Approximate cosine distance between two SQ4-quantized vectors,
 * dispatched to the active implementation (JS by default, native when
 * `distance:sq4` is registered). Used in the HNSW SQ4 reranking hot path when
 * `config.quantization.bits === 4`.
 */
export function distanceSQ4(
  a: Uint8Array,
  aMin: number,
  aMax: number,
  aDim: number,
  b: Uint8Array,
  bMin: number,
  bMax: number,
  bDim: number
): number {
  return activeSQ4Distance(a, aMin, aMax, aDim, b, bMin, bMax, bDim)
}

/**
 * @description Replace the SQ4 approximate-distance implementation at runtime
 * (cortex's Rust SIMD `distance:sq4`). Called by `brainy.ts` when the provider
 * is registered. Pass {@link distanceSQ4Js} to restore the JS default.
 */
export function setSQ4DistanceImplementation(fn: SQ4DistanceFn): void {
  activeSQ4Distance = fn
}

/**
 * @description Serialize an SQ4 quantized vector to a compact binary format.
 *
 * Layout: `[min: float32][max: float32][dim: uint32 LE][packed: uint8[]]`.
 * Total size: `12 + ceil(dim/2)` bytes.
 *
 * The `dim` field is required (unlike SQ8) because the packed length alone
 * doesn't disambiguate even-vs-odd original dimension. The 4-byte `dim`
 * header keeps total overhead under 1% for typical 384-dim vectors.
 */
export function serializeSQ4(sq4: SQ4QuantizedVector): ArrayBuffer {
  const packedLen = sq4.quantized.length
  const buffer = new ArrayBuffer(12 + packedLen)
  const view = new DataView(buffer)
  view.setFloat32(0, sq4.min, true) // little-endian
  view.setFloat32(4, sq4.max, true)
  view.setUint32(8, sq4.dim, true)
  new Uint8Array(buffer, 12).set(sq4.quantized)
  return buffer
}

/**
 * @description Deserialize an SQ4 quantized vector from the binary format
 * written by {@link serializeSQ4}.
 */
export function deserializeSQ4(buffer: ArrayBuffer): SQ4QuantizedVector {
  const view = new DataView(buffer)
  const min = view.getFloat32(0, true)
  const max = view.getFloat32(4, true)
  const dim = view.getUint32(8, true)
  const quantized = new Uint8Array(buffer, 12)
  return { quantized, min, max, dim }
}

/** Clamp a value to `[0, 15]` and return as an integer in the 4-bit range. */
function clampNibble(n: number): number {
  if (n < 0) return 0
  if (n > 15) return 15
  return n | 0
}
