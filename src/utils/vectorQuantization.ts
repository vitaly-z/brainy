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
