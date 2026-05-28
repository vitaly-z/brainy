/**
 * @module hnsw/connectionsCodec
 * @description Bridge between brainy's UUID-keyed HNSW connection sets and
 * cortex's int-keyed delta-varint encode/decode (the `graph:compression`
 * provider). Translates UUIDs to stable int slots via the post-2.4.0 #1
 * `EntityIdMapper`, batches all of a node's per-level connection lists into
 * a single compact buffer, and reverses the path on load.
 *
 * Wire format of the per-node buffer the codec produces:
 *
 *     [num_levels: u8]
 *     repeated num_levels times:
 *       [level: u8]
 *       [encoded_len: u32 LE]
 *       [encoded_bytes: <encoded_len> bytes]   <- provider.encode(ints)
 *
 * Why a single buffer per node and not one blob per level:
 * - One `saveBinaryBlob` call per persisted node, regardless of level count.
 *   On hot insert paths an HNSW node may be at levels 0..3; the per-node
 *   blob trades a one-byte count for 3 saved I/O round-trips.
 * - Read path is symmetric: one `loadBinaryBlob` reconstructs the full
 *   connection set, so HNSW rebuild stays linear in the number of nodes.
 *
 * Loose UUIDs (ints assigned to entities that no longer exist) are silently
 * dropped on decode. They can't legitimately participate in graph traversal
 * because the entity is gone; treating them as `undefined` UUIDs matches the
 * pre-2.4.0 behaviour of an `idMapper.getUuid()` miss in the legacy load path.
 */

import type {
  EntityIdMapperProvider,
  GraphCompressionProvider
} from '../plugin.js'

export class ConnectionsCodec {
  constructor(
    private readonly provider: GraphCompressionProvider,
    private readonly idMapper: EntityIdMapperProvider
  ) {}

  /**
   * @description Encode all levels of a node's connections into one compact
   * buffer. Empty input → an empty buffer (zero levels, no body). The
   * idMapper assigns stable ints on demand if a connection UUID has never
   * been seen — append-only, matches the rest of the 2.4.0 contract.
   */
  encode(connectionsByLevel: Map<number, Set<string>>): Buffer {
    if (connectionsByLevel.size === 0) {
      // Single byte: zero levels. Round-trips cleanly through decode.
      return Buffer.from([0])
    }
    if (connectionsByLevel.size > 0xff) {
      throw new Error(
        `ConnectionsCodec.encode: too many HNSW levels (${connectionsByLevel.size}); ` +
          `the per-node header is one byte (max 255 levels).`
      )
    }

    // First pass: encode each level into its own buffer.
    const levelBuffers: Array<{ level: number; buf: Buffer }> = []
    let bodyBytes = 0
    for (const [level, uuids] of connectionsByLevel) {
      if (level > 0xff) {
        throw new Error(
          `ConnectionsCodec.encode: level ${level} exceeds u8 header range (max 255).`
        )
      }
      const ints: number[] = []
      for (const uuid of uuids) {
        ints.push(this.idMapper.getOrAssign(uuid))
      }
      const buf = this.provider.encode(ints)
      levelBuffers.push({ level, buf })
      bodyBytes += 1 + 4 + buf.length // level + len + payload
    }

    // Second pass: concatenate with header.
    const out = Buffer.alloc(1 + bodyBytes)
    out.writeUInt8(levelBuffers.length, 0)
    let offset = 1
    for (const { level, buf } of levelBuffers) {
      out.writeUInt8(level, offset)
      offset += 1
      out.writeUInt32LE(buf.length, offset)
      offset += 4
      buf.copy(out, offset)
      offset += buf.length
    }
    return out
  }

  /**
   * @description Decode a per-node buffer back into a connections Map. Ints
   * for entities the idMapper no longer knows are silently dropped — see the
   * module-level note on why.
   */
  decode(data: Buffer): Map<number, Set<string>> {
    const out = new Map<number, Set<string>>()
    if (data.length === 0) return out

    const count = data.readUInt8(0)
    let offset = 1
    for (let i = 0; i < count; i++) {
      if (offset + 5 > data.length) {
        throw new Error(`ConnectionsCodec.decode: truncated header at level ${i}`)
      }
      const level = data.readUInt8(offset)
      offset += 1
      const len = data.readUInt32LE(offset)
      offset += 4
      if (offset + len > data.length) {
        throw new Error(`ConnectionsCodec.decode: truncated body at level ${level}`)
      }
      const levelBuf = data.slice(offset, offset + len)
      offset += len

      const ints = this.provider.decode(levelBuf)
      const uuids = new Set<string>()
      for (const intId of ints) {
        const uuid = this.idMapper.getUuid(intId)
        if (uuid !== undefined) uuids.add(uuid)
      }
      out.set(level, uuids)
    }
    return out
  }
}

/**
 * @description Build the binary-blob storage key for a node's compressed
 * connections. Suffix-free; the adapter appends its own. Keys live under
 * `_hnsw_conn/` so they don't collide with the existing `_column_index/`
 * blobs and so a cortex-side reader knows exactly where to look.
 */
export function compressedConnectionsKey(nodeId: string): string {
  return `_hnsw_conn/${nodeId}`
}
