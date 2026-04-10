/**
 * @module columnStore/ColumnSegmentFormat
 * @description Binary reader/writer for `.cidx` column segment files.
 *
 * Segment layout (little-endian throughout):
 * ```
 * ┌─────────────────────────────────────────────┐
 * │ HEADER  (64 bytes)                          │
 * ├─────────────────────────────────────────────┤
 * │ VALUES  (count × 8 bytes for numeric,       │
 * │          variable for strings)               │
 * ├─────────────────────────────────────────────┤
 * │ ENTITY IDS  (count × 4 bytes, u32 LE)       │
 * ├─────────────────────────────────────────────┤
 * │ TOMBSTONES  (serialized roaring bitmap)      │
 * ├─────────────────────────────────────────────┤
 * │ FOOTER  (16 bytes)                          │
 * └─────────────────────────────────────────────┘
 * ```
 *
 * Both TypeScript and Rust read/write this exact byte layout.
 * Cross-language format tests validate compatibility.
 */

import { createHash } from 'node:crypto'
import {
  CIDX_MAGIC,
  CIDX_VERSION,
  HEADER_SIZE,
  FOOTER_SIZE,
  MAX_FIELD_NAME_LENGTH,
  ValueType,
  type SegmentHeader,
  type SegmentFooter
} from './types.js'
import { RoaringBitmap32 } from '../../utils/roaring/index.js'

// ---------------------------------------------------------------------------
// CRC32 — use a simple table-based implementation (no external dep)
// ---------------------------------------------------------------------------

const CRC32_TABLE = new Uint32Array(256)
for (let i = 0; i < 256; i++) {
  let c = i
  for (let j = 0; j < 8; j++) {
    c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1)
  }
  CRC32_TABLE[i] = c
}

/**
 * Compute CRC32 of a buffer.
 *
 * @param data - Input bytes
 * @returns CRC32 checksum as unsigned 32-bit integer
 */
export function crc32(data: Uint8Array): number {
  let crc = 0xFFFFFFFF
  for (let i = 0; i < data.length; i++) {
    crc = CRC32_TABLE[(crc ^ data[i]) & 0xFF] ^ (crc >>> 8)
  }
  return (crc ^ 0xFFFFFFFF) >>> 0
}

// ---------------------------------------------------------------------------
// Header read / write
// ---------------------------------------------------------------------------

/**
 * Write a 64-byte segment header into a buffer.
 *
 * @param header - Parsed header fields
 * @returns 64-byte Buffer
 */
export function writeHeader(header: SegmentHeader): Buffer {
  const buf = Buffer.alloc(HEADER_SIZE)
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength)

  // [0..4)  magic
  view.setUint32(0, header.magic, true)
  // [4..6)  version
  view.setUint16(4, header.version, true)

  // [6..8)  fieldNameLength
  const nameBytes = Buffer.from(header.fieldName, 'utf-8')
  const nameLen = Math.min(nameBytes.length, MAX_FIELD_NAME_LENGTH)
  view.setUint16(6, nameLen, true)

  // [8..40) fieldName (zero-padded)
  nameBytes.copy(buf, 8, 0, nameLen)

  // [40..41) valueType
  buf[40] = header.valueType
  // [41..42) level
  buf[41] = header.level
  // [42..43) codec
  buf[42] = header.codec
  // [43..44) flags
  buf[43] = header.flags

  // [44..48) reserved
  // [48..56) count as u64
  view.setBigUint64(48, BigInt(header.count), true)
  // [56..64) reserved

  return buf
}

/**
 * Parse a 64-byte segment header from a buffer.
 *
 * @param buf - At least 64 bytes
 * @returns Parsed SegmentHeader
 * @throws If magic or version don't match
 */
export function readHeader(buf: Buffer | Uint8Array): SegmentHeader {
  if (buf.length < HEADER_SIZE) {
    throw new Error(`Buffer too small for header: ${buf.length} < ${HEADER_SIZE}`)
  }

  const view = new DataView(
    buf instanceof Buffer ? buf.buffer : buf.buffer,
    buf instanceof Buffer ? buf.byteOffset : buf.byteOffset,
    HEADER_SIZE
  )

  const magic = view.getUint32(0, true)
  if (magic !== CIDX_MAGIC) {
    throw new Error(`Invalid segment magic: 0x${magic.toString(16)} (expected 0x${CIDX_MAGIC.toString(16)})`)
  }

  const version = view.getUint16(4, true)
  if (version !== CIDX_VERSION) {
    throw new Error(`Unsupported segment version: ${version} (expected ${CIDX_VERSION})`)
  }

  const fieldNameLength = view.getUint16(6, true)
  const fieldName = Buffer.from(buf.slice(8, 8 + fieldNameLength)).toString('utf-8')

  return {
    magic,
    version,
    fieldName,
    fieldNameLength,
    valueType: buf[40] as ValueType,
    level: buf[41],
    codec: buf[42],
    flags: buf[43],
    count: Number(view.getBigUint64(48, true))
  }
}

// ---------------------------------------------------------------------------
// Footer read / write
// ---------------------------------------------------------------------------

/**
 * Write a 16-byte footer.
 *
 * @param tombstoneLength - Byte length of the serialized tombstone bitmap
 * @param checksum - CRC32 of header + values + entityIds + tombstones
 * @returns 16-byte Buffer
 */
export function writeFooter(tombstoneLength: number, checksum: number): Buffer {
  const buf = Buffer.alloc(FOOTER_SIZE)
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength)
  view.setBigUint64(0, BigInt(tombstoneLength), true)
  view.setUint32(8, checksum, true)
  // [12..16) pad
  return buf
}

/**
 * Parse a 16-byte footer.
 *
 * @param buf - Exactly 16 bytes
 * @returns Parsed footer
 */
export function readFooter(buf: Buffer | Uint8Array): SegmentFooter {
  if (buf.length < FOOTER_SIZE) {
    throw new Error(`Buffer too small for footer: ${buf.length} < ${FOOTER_SIZE}`)
  }
  const view = new DataView(
    buf instanceof Buffer ? buf.buffer : buf.buffer,
    buf instanceof Buffer ? buf.byteOffset : buf.byteOffset,
    FOOTER_SIZE
  )
  return {
    tombstoneLength: Number(view.getBigUint64(0, true)),
    crc32: view.getUint32(8, true)
  }
}

// ---------------------------------------------------------------------------
// Value column encoding
// ---------------------------------------------------------------------------

/**
 * Encode a sorted array of numeric values into a packed i64 LE buffer.
 *
 * @param values - Sorted numbers (integers or timestamps)
 * @returns Packed buffer (values.length × 8 bytes)
 */
export function encodeNumericValues(values: number[]): Buffer {
  const buf = Buffer.alloc(values.length * 8)
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength)
  for (let i = 0; i < values.length; i++) {
    view.setBigInt64(i * 8, BigInt(Math.round(values[i])), true)
  }
  return buf
}

/**
 * Decode a packed i64 LE buffer into a number array.
 *
 * @param buf - Packed buffer
 * @param count - Number of values
 * @returns Array of numbers
 */
export function decodeNumericValues(buf: Buffer | Uint8Array, count: number): number[] {
  const view = new DataView(
    buf instanceof Buffer ? buf.buffer : buf.buffer,
    buf instanceof Buffer ? buf.byteOffset : buf.byteOffset,
    count * 8
  )
  const result = new Array<number>(count)
  for (let i = 0; i < count; i++) {
    result[i] = Number(view.getBigInt64(i * 8, true))
  }
  return result
}

/**
 * Encode a sorted array of float values into a packed f64 LE buffer.
 *
 * @param values - Sorted floats
 * @returns Packed buffer (values.length × 8 bytes)
 */
export function encodeFloatValues(values: number[]): Buffer {
  const buf = Buffer.alloc(values.length * 8)
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength)
  for (let i = 0; i < values.length; i++) {
    view.setFloat64(i * 8, values[i], true)
  }
  return buf
}

/**
 * Decode a packed f64 LE buffer into a number array.
 *
 * @param buf - Packed buffer
 * @param count - Number of values
 * @returns Array of numbers
 */
export function decodeFloatValues(buf: Buffer | Uint8Array, count: number): number[] {
  const view = new DataView(
    buf instanceof Buffer ? buf.buffer : buf.buffer,
    buf instanceof Buffer ? buf.byteOffset : buf.byteOffset,
    count * 8
  )
  const result = new Array<number>(count)
  for (let i = 0; i < count; i++) {
    result[i] = view.getFloat64(i * 8, true)
  }
  return result
}

/**
 * Encode sorted string values as length-prefixed UTF-8.
 *
 * Format per string: u32 LE length + UTF-8 bytes (no padding, no null terminator).
 *
 * @param values - Sorted strings
 * @returns Packed buffer
 */
export function encodeStringValues(values: string[]): Buffer {
  // First pass: calculate total size
  const encoded = values.map(v => Buffer.from(v, 'utf-8'))
  const totalSize = encoded.reduce((sum, b) => sum + 4 + b.length, 0)

  const buf = Buffer.alloc(totalSize)
  let offset = 0
  for (const bytes of encoded) {
    buf.writeUInt32LE(bytes.length, offset)
    offset += 4
    bytes.copy(buf, offset)
    offset += bytes.length
  }
  return buf
}

/**
 * Decode length-prefixed UTF-8 strings.
 *
 * @param buf - Packed buffer
 * @param count - Number of strings
 * @returns Array of strings
 */
export function decodeStringValues(buf: Buffer | Uint8Array, count: number): string[] {
  const result = new Array<string>(count)
  let offset = 0
  const b = buf instanceof Buffer ? buf : Buffer.from(buf)
  for (let i = 0; i < count; i++) {
    const len = b.readUInt32LE(offset)
    offset += 4
    result[i] = b.toString('utf-8', offset, offset + len)
    offset += len
  }
  return result
}

/**
 * Encode entity int IDs as packed u32 LE.
 *
 * @param ids - Entity integer IDs (parallel to value column)
 * @returns Packed buffer (ids.length × 4 bytes)
 */
export function encodeEntityIds(ids: Uint32Array | number[]): Buffer {
  const arr = ids instanceof Uint32Array ? ids : new Uint32Array(ids)
  return Buffer.from(arr.buffer, arr.byteOffset, arr.byteLength)
}

/**
 * Decode packed u32 LE entity IDs.
 *
 * @param buf - Packed buffer
 * @param count - Number of IDs
 * @returns Uint32Array
 */
export function decodeEntityIds(buf: Buffer | Uint8Array, count: number): Uint32Array {
  const result = new Uint32Array(count)
  const view = new DataView(
    buf instanceof Buffer ? buf.buffer : buf.buffer,
    buf instanceof Buffer ? buf.byteOffset : buf.byteOffset,
    count * 4
  )
  for (let i = 0; i < count; i++) {
    result[i] = view.getUint32(i * 4, true)
  }
  return result
}

// ---------------------------------------------------------------------------
// Full segment write / read
// ---------------------------------------------------------------------------

/**
 * Encode values based on ValueType.
 *
 * @param values - Sorted values
 * @param valueType - How to encode
 * @returns Packed buffer
 */
export function encodeValues(values: (number | string | boolean)[], valueType: ValueType): Buffer {
  switch (valueType) {
    case ValueType.Number:
    case ValueType.Boolean:
      return encodeNumericValues(values as number[])
    case ValueType.Float:
      return encodeFloatValues(values as number[])
    case ValueType.String:
      return encodeStringValues(values as string[])
    default:
      throw new Error(`Unknown ValueType: ${valueType}`)
  }
}

/**
 * Decode values based on ValueType.
 *
 * @param buf - Packed value buffer
 * @param count - Number of values
 * @param valueType - How to decode
 * @returns Array of values
 */
export function decodeValues(buf: Buffer | Uint8Array, count: number, valueType: ValueType): (number | string)[] {
  switch (valueType) {
    case ValueType.Number:
    case ValueType.Boolean:
      return decodeNumericValues(buf, count)
    case ValueType.Float:
      return decodeFloatValues(buf, count)
    case ValueType.String:
      return decodeStringValues(buf, count)
    default:
      throw new Error(`Unknown ValueType: ${valueType}`)
  }
}

/**
 * Compute the byte size of the values column for a given count and type.
 * For strings this is not knowable without the data, so returns -1.
 *
 * @param count - Number of entries
 * @param valueType - Value encoding type
 * @returns Byte size, or -1 for variable-length (strings)
 */
export function valuesColumnSize(count: number, valueType: ValueType): number {
  switch (valueType) {
    case ValueType.Number:
    case ValueType.Boolean:
    case ValueType.Float:
      return count * 8
    case ValueType.String:
      return -1 // variable length
    default:
      return -1
  }
}

/**
 * Write a complete `.cidx` segment file to a Buffer.
 *
 * @param header - Segment header (magic and version are set automatically)
 * @param values - Sorted value array
 * @param entityIds - Parallel entity int ID array
 * @param tombstones - Optional tombstone bitmap (positions that are logically deleted)
 * @returns Complete segment as a Buffer
 */
export function writeSegmentToBuffer(
  header: Omit<SegmentHeader, 'magic' | 'version'>,
  values: (number | string | boolean)[],
  entityIds: Uint32Array | number[],
  tombstones?: RoaringBitmap32
): Buffer {
  if (values.length !== (entityIds instanceof Uint32Array ? entityIds.length : entityIds.length)) {
    throw new Error(`Values (${values.length}) and entityIds (${entityIds instanceof Uint32Array ? entityIds.length : entityIds.length}) must have the same length`)
  }

  const fullHeader: SegmentHeader = {
    ...header,
    magic: CIDX_MAGIC,
    version: CIDX_VERSION,
    count: values.length
  }

  // Encode sections
  const headerBuf = writeHeader(fullHeader)
  const valuesBuf = encodeValues(values, header.valueType)
  const idsBuf = encodeEntityIds(entityIds)

  // Serialize tombstones
  let tombstoneBuf: Buffer
  if (tombstones && tombstones.size > 0) {
    const serialized = tombstones.serialize(true) // portable serialization
    tombstoneBuf = Buffer.from(serialized)
  } else {
    tombstoneBuf = Buffer.alloc(0)
  }

  // CRC32 covers header + values + entityIds + tombstones
  const crcInput = Buffer.concat([headerBuf, valuesBuf, idsBuf, tombstoneBuf])
  const checksum = crc32(crcInput)

  const footerBuf = writeFooter(tombstoneBuf.length, checksum)

  return Buffer.concat([headerBuf, valuesBuf, idsBuf, tombstoneBuf, footerBuf])
}

/**
 * Parsed segment data from a `.cidx` file.
 */
export interface ParsedSegment {
  header: SegmentHeader
  values: (number | string)[]
  entityIds: Uint32Array
  tombstones: RoaringBitmap32
}

/**
 * Read a complete `.cidx` segment from a Buffer.
 *
 * @param buf - Complete segment buffer
 * @param validateCrc - Whether to validate the CRC32 checksum (default: true)
 * @returns Parsed segment data
 * @throws If magic/version mismatch, buffer too small, or CRC mismatch
 */
export function readSegmentFromBuffer(buf: Buffer | Uint8Array, validateCrc = true): ParsedSegment {
  if (buf.length < HEADER_SIZE + FOOTER_SIZE) {
    throw new Error(`Buffer too small for segment: ${buf.length} < ${HEADER_SIZE + FOOTER_SIZE}`)
  }

  // 1. Parse header
  const header = readHeader(buf)

  // 2. Parse footer (last 16 bytes)
  const footerStart = buf.length - FOOTER_SIZE
  const footer = readFooter(buf.slice(footerStart))

  // 3. Calculate section offsets
  const valuesStart = HEADER_SIZE
  const idsSize = header.count * 4
  const tombstoneSize = footer.tombstoneLength

  // For fixed-size values, we know exact offsets
  const fixedValuesSize = valuesColumnSize(header.count, header.valueType)

  let valuesEnd: number
  if (fixedValuesSize >= 0) {
    valuesEnd = valuesStart + fixedValuesSize
  } else {
    // String values: entityIds start = footerStart - tombstoneSize - idsSize
    valuesEnd = footerStart - tombstoneSize - idsSize
  }

  const idsStart = valuesEnd
  const idsEnd = idsStart + idsSize
  const tombstoneStart = idsEnd
  const tombstoneEnd = tombstoneStart + tombstoneSize

  // 4. Validate CRC
  if (validateCrc) {
    const crcInput = buf.slice(0, tombstoneEnd)
    const computed = crc32(crcInput instanceof Buffer ? crcInput : Buffer.from(crcInput))
    if (computed !== footer.crc32) {
      throw new Error(`CRC32 mismatch: computed 0x${computed.toString(16)} != stored 0x${footer.crc32.toString(16)}`)
    }
  }

  // 5. Decode values
  const valuesBuf = buf.slice(valuesStart, valuesEnd)
  const values = decodeValues(
    valuesBuf instanceof Buffer ? valuesBuf : Buffer.from(valuesBuf),
    header.count,
    header.valueType
  )

  // 6. Decode entity IDs
  const idsBuf = buf.slice(idsStart, idsEnd)
  const entityIds = decodeEntityIds(
    idsBuf instanceof Buffer ? idsBuf : Buffer.from(idsBuf),
    header.count
  )

  // 7. Decode tombstones
  let tombstones: RoaringBitmap32
  if (tombstoneSize > 0) {
    const tombstoneBuf = buf.slice(tombstoneStart, tombstoneEnd)
    tombstones = RoaringBitmap32.deserialize(
      tombstoneBuf instanceof Buffer ? tombstoneBuf : Buffer.from(tombstoneBuf),
      true // portable format
    )
  } else {
    tombstones = new RoaringBitmap32()
  }

  return { header, values, entityIds, tombstones }
}
