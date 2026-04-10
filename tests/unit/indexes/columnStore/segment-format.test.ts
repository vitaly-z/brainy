/**
 * @module segment-format.test
 * @description Round-trip tests for the .cidx binary segment format.
 * The format is the shared contract between TypeScript and Rust —
 * every byte must be identical across languages.
 */

import { describe, it, expect } from 'vitest'
import {
  writeSegmentToBuffer,
  readSegmentFromBuffer,
  writeHeader,
  readHeader,
  writeFooter,
  readFooter,
  crc32,
  encodeNumericValues,
  decodeNumericValues,
  encodeFloatValues,
  decodeFloatValues,
  encodeStringValues,
  decodeStringValues,
  encodeEntityIds,
  decodeEntityIds
} from '../../../../src/indexes/columnStore/ColumnSegmentFormat.js'
import {
  CIDX_MAGIC,
  CIDX_VERSION,
  HEADER_SIZE,
  FOOTER_SIZE,
  ValueType,
  FLAG_MULTI_VALUE
} from '../../../../src/indexes/columnStore/types.js'
import { RoaringBitmap32 } from '../../../../src/utils/roaring/index.js'

describe('ColumnSegmentFormat', () => {
  // -----------------------------------------------------------------------
  // CRC32
  // -----------------------------------------------------------------------

  describe('crc32', () => {
    it('produces consistent checksums', () => {
      const data = Buffer.from('hello world')
      const c1 = crc32(data)
      const c2 = crc32(data)
      expect(c1).toBe(c2)
      expect(typeof c1).toBe('number')
      expect(c1).toBeGreaterThan(0)
    })

    it('different data produces different checksums', () => {
      const c1 = crc32(Buffer.from('hello'))
      const c2 = crc32(Buffer.from('world'))
      expect(c1).not.toBe(c2)
    })

    it('handles empty buffer', () => {
      const c = crc32(Buffer.alloc(0))
      expect(typeof c).toBe('number')
    })
  })

  // -----------------------------------------------------------------------
  // Header
  // -----------------------------------------------------------------------

  describe('header', () => {
    it('round-trips all fields', () => {
      const header = {
        magic: CIDX_MAGIC,
        version: CIDX_VERSION,
        fieldName: 'createdAt',
        fieldNameLength: 9,
        valueType: ValueType.Number,
        level: 2,
        codec: 0,
        flags: 0,
        count: 50000
      }
      const buf = writeHeader(header)
      expect(buf.length).toBe(HEADER_SIZE)

      const parsed = readHeader(buf)
      expect(parsed.magic).toBe(CIDX_MAGIC)
      expect(parsed.version).toBe(CIDX_VERSION)
      expect(parsed.fieldName).toBe('createdAt')
      expect(parsed.valueType).toBe(ValueType.Number)
      expect(parsed.level).toBe(2)
      expect(parsed.codec).toBe(0)
      expect(parsed.flags).toBe(0)
      expect(parsed.count).toBe(50000)
    })

    it('truncates field names longer than 32 bytes', () => {
      const longName = 'a'.repeat(50)
      const header = {
        magic: CIDX_MAGIC,
        version: CIDX_VERSION,
        fieldName: longName,
        fieldNameLength: 32,
        valueType: ValueType.String,
        level: 0,
        codec: 0,
        flags: 0,
        count: 1
      }
      const buf = writeHeader(header)
      const parsed = readHeader(buf)
      expect(parsed.fieldName.length).toBe(32)
    })

    it('preserves multi-value flag', () => {
      const header = {
        magic: CIDX_MAGIC,
        version: CIDX_VERSION,
        fieldName: '__words__',
        fieldNameLength: 9,
        valueType: ValueType.String,
        level: 0,
        codec: 0,
        flags: FLAG_MULTI_VALUE,
        count: 10000
      }
      const buf = writeHeader(header)
      const parsed = readHeader(buf)
      expect(parsed.flags & FLAG_MULTI_VALUE).toBe(FLAG_MULTI_VALUE)
    })

    it('rejects invalid magic', () => {
      const buf = Buffer.alloc(HEADER_SIZE)
      buf.writeUInt32LE(0xDEADBEEF, 0)
      expect(() => readHeader(buf)).toThrow(/Invalid segment magic/)
    })

    it('rejects unsupported version', () => {
      const buf = Buffer.alloc(HEADER_SIZE)
      buf.writeUInt32LE(CIDX_MAGIC, 0)
      buf.writeUInt16LE(99, 4) // bad version
      expect(() => readHeader(buf)).toThrow(/Unsupported segment version/)
    })
  })

  // -----------------------------------------------------------------------
  // Value encoding
  // -----------------------------------------------------------------------

  describe('numeric values', () => {
    it('round-trips integers', () => {
      const values = [100, 200, 300, 1700000000000]
      const buf = encodeNumericValues(values)
      expect(buf.length).toBe(values.length * 8)
      const decoded = decodeNumericValues(buf, values.length)
      expect(decoded).toEqual(values)
    })

    it('handles negative values', () => {
      const values = [-1000, -1, 0, 1, 1000]
      const decoded = decodeNumericValues(encodeNumericValues(values), values.length)
      expect(decoded).toEqual(values)
    })

    it('handles empty array', () => {
      const buf = encodeNumericValues([])
      expect(buf.length).toBe(0)
      const decoded = decodeNumericValues(buf, 0)
      expect(decoded).toEqual([])
    })
  })

  describe('float values', () => {
    it('round-trips floats', () => {
      const values = [1.5, 2.7, 3.14159, 99.99]
      const buf = encodeFloatValues(values)
      const decoded = decodeFloatValues(buf, values.length)
      expect(decoded).toEqual(values)
    })

    it('handles special values', () => {
      const values = [-Infinity, -0, 0, Infinity]
      const decoded = decodeFloatValues(encodeFloatValues(values), values.length)
      expect(decoded[0]).toBe(-Infinity)
      expect(decoded[3]).toBe(Infinity)
    })
  })

  describe('string values', () => {
    it('round-trips strings', () => {
      const values = ['active', 'inactive', 'pending']
      const buf = encodeStringValues(values)
      const decoded = decodeStringValues(buf, values.length)
      expect(decoded).toEqual(values)
    })

    it('handles empty strings', () => {
      const values = ['', 'a', '']
      const decoded = decodeStringValues(encodeStringValues(values), values.length)
      expect(decoded).toEqual(values)
    })

    it('handles unicode', () => {
      const values = ['café', 'naïve', '日本語']
      const decoded = decodeStringValues(encodeStringValues(values), values.length)
      expect(decoded).toEqual(values)
    })

    it('handles single string', () => {
      const decoded = decodeStringValues(encodeStringValues(['hello']), 1)
      expect(decoded).toEqual(['hello'])
    })
  })

  describe('entity IDs', () => {
    it('round-trips Uint32Array', () => {
      const ids = new Uint32Array([1, 42, 1000, 4294967295]) // includes max u32
      const buf = encodeEntityIds(ids)
      expect(buf.length).toBe(ids.length * 4)
      const decoded = decodeEntityIds(buf, ids.length)
      expect(Array.from(decoded)).toEqual(Array.from(ids))
    })

    it('round-trips number array', () => {
      const ids = [5, 10, 15]
      const decoded = decodeEntityIds(encodeEntityIds(ids), ids.length)
      expect(Array.from(decoded)).toEqual(ids)
    })
  })

  // -----------------------------------------------------------------------
  // Full segment round-trip
  // -----------------------------------------------------------------------

  describe('full segment', () => {
    it('round-trips a numeric segment', () => {
      const values = [1700000000000, 1700000001000, 1700000002000]
      const entityIds = new Uint32Array([10, 20, 30])

      const buf = writeSegmentToBuffer(
        {
          fieldName: 'createdAt',
          fieldNameLength: 9,
          valueType: ValueType.Number,
          level: 0,
          codec: 0,
          flags: 0,
          count: 3
        },
        values,
        entityIds
      )

      const parsed = readSegmentFromBuffer(buf)
      expect(parsed.header.fieldName).toBe('createdAt')
      expect(parsed.header.valueType).toBe(ValueType.Number)
      expect(parsed.header.count).toBe(3)
      expect(parsed.values).toEqual(values)
      expect(Array.from(parsed.entityIds)).toEqual([10, 20, 30])
      expect(parsed.tombstones.size).toBe(0)
    })

    it('round-trips a string segment', () => {
      const values = ['active', 'inactive', 'pending']
      const entityIds = new Uint32Array([1, 2, 3])

      const buf = writeSegmentToBuffer(
        {
          fieldName: 'status',
          fieldNameLength: 6,
          valueType: ValueType.String,
          level: 0,
          codec: 0,
          flags: 0,
          count: 3
        },
        values,
        entityIds
      )

      const parsed = readSegmentFromBuffer(buf)
      expect(parsed.values).toEqual(values)
      expect(Array.from(parsed.entityIds)).toEqual([1, 2, 3])
    })

    it('round-trips a float segment', () => {
      const values = [9.99, 19.99, 49.99]
      const entityIds = new Uint32Array([100, 200, 300])

      const buf = writeSegmentToBuffer(
        {
          fieldName: 'price',
          fieldNameLength: 5,
          valueType: ValueType.Float,
          level: 1,
          codec: 0,
          flags: 0,
          count: 3
        },
        values,
        entityIds
      )

      const parsed = readSegmentFromBuffer(buf)
      expect(parsed.values).toEqual(values)
      expect(parsed.header.level).toBe(1)
    })

    it('round-trips a boolean segment', () => {
      const values = [0, 0, 1, 1]
      const entityIds = new Uint32Array([1, 2, 3, 4])

      const buf = writeSegmentToBuffer(
        {
          fieldName: 'isActive',
          fieldNameLength: 8,
          valueType: ValueType.Boolean,
          level: 0,
          codec: 0,
          flags: 0,
          count: 4
        },
        values,
        entityIds
      )

      const parsed = readSegmentFromBuffer(buf)
      expect(parsed.values).toEqual(values)
    })

    it('round-trips with tombstones', () => {
      const values = [100, 200, 300, 400, 500]
      const entityIds = new Uint32Array([1, 2, 3, 4, 5])
      const tombstones = new RoaringBitmap32([1, 3]) // positions 1 and 3 are deleted

      const buf = writeSegmentToBuffer(
        {
          fieldName: 'score',
          fieldNameLength: 5,
          valueType: ValueType.Number,
          level: 0,
          codec: 0,
          flags: 0,
          count: 5
        },
        values,
        entityIds,
        tombstones
      )

      const parsed = readSegmentFromBuffer(buf)
      expect(parsed.tombstones.has(1)).toBe(true)
      expect(parsed.tombstones.has(3)).toBe(true)
      expect(parsed.tombstones.has(0)).toBe(false)
      expect(parsed.tombstones.has(2)).toBe(false)
      expect(parsed.tombstones.size).toBe(2)
    })

    it('round-trips an empty segment', () => {
      const buf = writeSegmentToBuffer(
        {
          fieldName: 'empty',
          fieldNameLength: 5,
          valueType: ValueType.Number,
          level: 0,
          codec: 0,
          flags: 0,
          count: 0
        },
        [],
        new Uint32Array(0)
      )

      const parsed = readSegmentFromBuffer(buf)
      expect(parsed.header.count).toBe(0)
      expect(parsed.values).toEqual([])
      expect(parsed.entityIds.length).toBe(0)
    })

    it('round-trips a single-entry segment', () => {
      const buf = writeSegmentToBuffer(
        {
          fieldName: 'x',
          fieldNameLength: 1,
          valueType: ValueType.Number,
          level: 0,
          codec: 0,
          flags: 0,
          count: 1
        },
        [42],
        new Uint32Array([7])
      )

      const parsed = readSegmentFromBuffer(buf)
      expect(parsed.values).toEqual([42])
      expect(Array.from(parsed.entityIds)).toEqual([7])
    })

    it('round-trips a multi-value segment (words)', () => {
      const words = ['algorithm', 'learning', 'machine', 'neural']
      const entityIds = new Uint32Array([5, 5, 5, 10]) // entity 5 has 3 words, entity 10 has 1

      const buf = writeSegmentToBuffer(
        {
          fieldName: '__words__',
          fieldNameLength: 9,
          valueType: ValueType.String,
          level: 0,
          codec: 0,
          flags: FLAG_MULTI_VALUE,
          count: 4
        },
        words,
        entityIds
      )

      const parsed = readSegmentFromBuffer(buf)
      expect(parsed.values).toEqual(words)
      expect(Array.from(parsed.entityIds)).toEqual([5, 5, 5, 10])
      expect(parsed.header.flags & FLAG_MULTI_VALUE).toBe(FLAG_MULTI_VALUE)
    })
  })

  // -----------------------------------------------------------------------
  // CRC validation
  // -----------------------------------------------------------------------

  describe('CRC validation', () => {
    it('detects tampered data', () => {
      const buf = writeSegmentToBuffer(
        {
          fieldName: 'test',
          fieldNameLength: 4,
          valueType: ValueType.Number,
          level: 0,
          codec: 0,
          flags: 0,
          count: 3
        },
        [1, 2, 3],
        new Uint32Array([10, 20, 30])
      )

      // Tamper with a value byte
      const tampered = Buffer.from(buf)
      tampered[HEADER_SIZE + 4] ^= 0xFF

      expect(() => readSegmentFromBuffer(tampered, true)).toThrow(/CRC32 mismatch/)
    })

    it('passes with validateCrc=false on tampered data', () => {
      const buf = writeSegmentToBuffer(
        {
          fieldName: 'test',
          fieldNameLength: 4,
          valueType: ValueType.Number,
          level: 0,
          codec: 0,
          flags: 0,
          count: 3
        },
        [1, 2, 3],
        new Uint32Array([10, 20, 30])
      )

      const tampered = Buffer.from(buf)
      tampered[HEADER_SIZE + 4] ^= 0xFF

      // Should not throw with validation disabled
      const parsed = readSegmentFromBuffer(tampered, false)
      expect(parsed.header.count).toBe(3)
    })
  })

  // -----------------------------------------------------------------------
  // Error handling
  // -----------------------------------------------------------------------

  describe('error handling', () => {
    it('rejects buffer smaller than header + footer', () => {
      const tiny = Buffer.alloc(10)
      expect(() => readSegmentFromBuffer(tiny)).toThrow(/Buffer too small/)
    })

    it('rejects mismatched values and entityIds length', () => {
      expect(() =>
        writeSegmentToBuffer(
          {
            fieldName: 'x',
            fieldNameLength: 1,
            valueType: ValueType.Number,
            level: 0,
            codec: 0,
            flags: 0,
            count: 2
          },
          [1, 2],
          new Uint32Array([10]) // mismatched!
        )
      ).toThrow(/same length/)
    })
  })
})
