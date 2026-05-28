/**
 * @module hnsw/connectionsCodec.test
 * @description Unit tests for `ConnectionsCodec` — the per-node buffer format
 * brainy uses to persist HNSW connection sets as delta-varint-compressed
 * binary blobs (2.4.0 #3).
 *
 * Mocks the `graph:compression` provider so the tests run without cortex
 * installed. The real cross-language byte-format integration is exercised
 * when cortex's `encodeConnections` / `decodeConnections` are wired in.
 *
 * Coverage:
 * 1. Round-trip a Map of `level → Set<UUID>` through encode + decode and
 *    verify the result is equal to the input (level-by-level Set equality).
 * 2. Empty connections encode to a single-byte buffer (`0` = zero levels) and
 *    decode back to an empty Map — no `undefined` reads, no decode errors.
 * 3. Multiple levels round-trip, including a level with a single UUID and a
 *    level with many UUIDs (the typical L0 fan-out).
 * 4. UUIDs whose ints are no longer in the idMapper at decode time are
 *    silently dropped — matches the pre-2.4.0 behaviour of a missing
 *    `getUuid()` lookup in the legacy load path.
 */

import { describe, it, expect } from 'vitest'
import { ConnectionsCodec } from '../../../src/hnsw/connectionsCodec.js'
import { EntityIdMapper } from '../../../src/utils/entityIdMapper.js'
import type { GraphCompressionProvider } from '../../../src/plugin.js'

const stubStorage = {
  getMetadata: async () => undefined,
  saveMetadata: async () => {},
  getNouns: async () => ({ totalCount: 0, items: [] })
} as any

/**
 * Mock provider — encodes ints as a JSON byte array, decodes back. NOT the
 * delta-varint format cortex produces, but format-agnostic round-trip
 * verification is the unit-test concern here.
 */
const mockProvider: GraphCompressionProvider = {
  encode(ids: number[]): Buffer {
    const sorted = [...ids].sort((a, b) => a - b)
    return Buffer.from(JSON.stringify(sorted), 'utf8')
  },
  decode(data: Buffer): number[] {
    if (data.length === 0) return []
    return JSON.parse(data.toString('utf8')) as number[]
  }
}

async function makeIdMapper(): Promise<EntityIdMapper> {
  const mapper = new EntityIdMapper({ storage: stubStorage })
  await mapper.init()
  return mapper
}

function setsEqual<T>(a: Set<T>, b: Set<T>): boolean {
  if (a.size !== b.size) return false
  for (const v of a) if (!b.has(v)) return false
  return true
}

describe('ConnectionsCodec (2.4.0 #3 — wraps graph:compression provider)', () => {
  it('round-trips a single-level Set of UUIDs through encode + decode', async () => {
    const idMapper = await makeIdMapper()
    const codec = new ConnectionsCodec(mockProvider, idMapper)

    const input = new Map<number, Set<string>>([
      [0, new Set(['a', 'b', 'c', 'd'])]
    ])
    const buf = codec.encode(input)
    const out = codec.decode(buf)

    expect(out.size).toBe(1)
    expect(setsEqual(out.get(0)!, input.get(0)!)).toBe(true)
  })

  it('empty connections encode to a one-byte buffer and decode to an empty Map', async () => {
    const idMapper = await makeIdMapper()
    const codec = new ConnectionsCodec(mockProvider, idMapper)

    const buf = codec.encode(new Map())
    expect(buf.length).toBe(1)
    expect(buf.readUInt8(0)).toBe(0)
    expect(codec.decode(buf).size).toBe(0)
  })

  it('round-trips multiple levels with very different fan-outs', async () => {
    const idMapper = await makeIdMapper()
    const codec = new ConnectionsCodec(mockProvider, idMapper)

    const manyUuids = Array.from({ length: 30 }, (_, i) => `u-${i}`)
    const input = new Map<number, Set<string>>([
      [0, new Set(manyUuids)],
      [1, new Set(['high-1', 'high-2'])],
      [2, new Set(['solo'])]
    ])

    const buf = codec.encode(input)
    const out = codec.decode(buf)

    expect(out.size).toBe(3)
    expect(setsEqual(out.get(0)!, input.get(0)!)).toBe(true)
    expect(setsEqual(out.get(1)!, input.get(1)!)).toBe(true)
    expect(setsEqual(out.get(2)!, input.get(2)!)).toBe(true)
  })

  it('drops UUIDs whose ints the idMapper no longer recognises on decode', async () => {
    const encodingMapper = await makeIdMapper()
    const encodeCodec = new ConnectionsCodec(mockProvider, encodingMapper)

    // Encode through one mapper.
    const input = new Map<number, Set<string>>([[0, new Set(['present', 'gone'])]])
    const buf = encodeCodec.encode(input)

    // Decode through a FRESH mapper that only knows about 'present'.
    const decodingMapper = await makeIdMapper()
    decodingMapper.getOrAssign('present')

    // Manually re-map 'present' to the same int it had on encode so the
    // present UUID round-trips; 'gone' simply has no mapping → silent drop.
    // We line up the int spaces by asserting equality below: only 'present'
    // survives, 'gone' is missing — no errors, no `undefined` Set entries.
    const decodeCodec = new ConnectionsCodec(mockProvider, decodingMapper)
    // Inject the same int for 'present' so it round-trips one-for-one. (The
    // encoding mapper assigns ints in insertion order: 'present'=1, 'gone'=2.
    // The decoding mapper's first getOrAssign also returns 1, so 'present'
    // matches; 'gone' (encoded as 2) has no mapping in the decoder.)
    expect(encodingMapper.getInt('present')).toBe(1)
    expect(decodingMapper.getInt('present')).toBe(1)

    const out = decodeCodec.decode(buf)
    const l0 = out.get(0)!
    expect(l0.has('present')).toBe(true)
    expect(l0.has('gone')).toBe(false)
    expect(l0.size).toBe(1)
  })
})
