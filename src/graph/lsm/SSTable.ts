/**
 * SSTable - Sorted String Table for LSM-Tree
 *
 * Production-grade sorted file format for storing graph relationships:
 * - Binary format using MessagePack (50-70% smaller than JSON)
 * - Sorted by sourceId for O(log n) binary search
 * - Bloom filter for fast negative lookups (90% disk I/O reduction)
 * - Zone maps (min/max keys) for file skipping
 * - Immutable after creation (LSM-tree property)
 *
 * File Structure:
 * - Header: version, metadata, bloom filter, zone map
 * - Data: sorted array of [sourceId, targetIds[]]
 * - Footer: checksum, stats
 */

import { encode as defaultEncode, decode as defaultDecode } from '@msgpack/msgpack'
import { BloomFilter, SerializedBloomFilter } from './BloomFilter.js'

// Swappable msgpack implementation — defaults to @msgpack/msgpack JS,
// can be replaced with native msgpack (e.g., cortex's Rust-backed encoder)
let _encode: (data: unknown) => Uint8Array = defaultEncode as (data: unknown) => Uint8Array
let _decode: (data: Uint8Array) => unknown = defaultDecode as (data: Uint8Array) => unknown

/**
 * Replace the msgpack encode/decode implementation at runtime.
 * Called by brainy.ts when a cortex 'msgpack' provider is registered.
 */
export function setMsgpackImplementation(impl: { encode: (data: unknown) => Uint8Array, decode: (data: Uint8Array) => unknown }) {
  _encode = impl.encode
  _decode = impl.decode
}

/**
 * Entry in the SSTable
 * Maps a source node to its target nodes
 */
export interface SSTableEntry {
  /**
   * Source node ID
   */
  sourceId: string

  /**
   * Array of target node IDs
   */
  targets: string[]

  /**
   * Number of targets (redundant but useful for stats)
   */
  count: number
}

/**
 * SSTable metadata and statistics
 */
export interface SSTableMetadata {
  /**
   * SSTable format version
   */
  version: number

  /**
   * Unique ID for this SSTable
   */
  id: string

  /**
   * Compaction level (0-6)
   * L0 = fresh from MemTable
   * L1-L6 = progressively merged and larger files
   */
  level: number

  /**
   * Creation timestamp
   */
  createdAt: number

  /**
   * Total number of entries
   */
  entryCount: number

  /**
   * Total number of relationships across all entries
   */
  relationshipCount: number

  /**
   * Minimum sourceId in this SSTable (zone map)
   */
  minSourceId: string

  /**
   * Maximum sourceId in this SSTable (zone map)
   */
  maxSourceId: string

  /**
   * Size in bytes when serialized
   */
  sizeBytes: number

  /**
   * Whether data is compressed
   */
  compressed: boolean
}

/**
 * Serialized SSTable format
 * This is what gets stored via StorageAdapter
 */
export interface SerializedSSTable {
  /**
   * Metadata about the SSTable
   */
  metadata: SSTableMetadata

  /**
   * Sorted entries
   */
  entries: SSTableEntry[]

  /**
   * Serialized bloom filter
   */
  bloomFilter: SerializedBloomFilter

  /**
   * Checksum for data integrity
   */
  checksum: string
}

/**
 * SSTable - Immutable sorted file for LSM-tree
 *
 * Key Properties:
 * - Immutable: Never modified after creation
 * - Sorted: Entries sorted by sourceId for binary search
 * - Filtered: Bloom filter for fast negative lookups
 * - Zoned: Min/max keys for file skipping
 * - Compact: MessagePack binary format
 *
 * Typical Usage:
 * 1. Create from MemTable entries
 * 2. Serialize and store via StorageAdapter
 * 3. Load from storage when needed
 * 4. Query with binary search
 * 5. Eventually merge via compaction
 */
export class SSTable {
  /**
   * Metadata about this SSTable
   */
  readonly metadata: SSTableMetadata

  /**
   * Sorted entries (sourceId → targets)
   */
  private entries: SSTableEntry[]

  /**
   * Bloom filter for membership testing
   */
  private bloomFilter: BloomFilter

  /**
   * Current format version
   */
  private static readonly VERSION = 1

  /**
   * Create a new SSTable from entries
   * @param entries Unsorted entries (will be sorted)
   * @param level Compaction level
   * @param id Unique ID for this SSTable
   */
  constructor(entries: SSTableEntry[], level: number = 0, id?: string) {
    // Sort entries by sourceId for binary search
    this.entries = entries.sort((a, b) => a.sourceId.localeCompare(b.sourceId))

    // Calculate statistics
    const relationshipCount = entries.reduce(
      (sum, entry) => sum + entry.count,
      0
    )

    // Create bloom filter for all sourceIds
    this.bloomFilter = BloomFilter.createOptimal(
      entries.length,
      0.01 // 1% false positive rate
    )

    for (const entry of entries) {
      this.bloomFilter.add(entry.sourceId)
    }

    // Build metadata
    this.metadata = {
      version: SSTable.VERSION,
      id: id || this.generateId(),
      level,
      createdAt: Date.now(),
      entryCount: entries.length,
      relationshipCount,
      minSourceId: entries.length > 0 ? entries[0].sourceId : '',
      maxSourceId: entries.length > 0 ? entries[entries.length - 1].sourceId : '',
      sizeBytes: 0, // Will be set during serialization
      compressed: false
    }
  }

  /**
   * Generate a unique ID for this SSTable
   */
  private generateId(): string {
    return `sstable-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
  }

  /**
   * Check if a sourceId might be in this SSTable (using bloom filter)
   * @param sourceId The source ID to check
   * @returns true if might be present (with 1% FP rate), false if definitely not present
   */
  mightContain(sourceId: string): boolean {
    // Check bloom filter first (fast, in-memory)
    return this.bloomFilter.contains(sourceId)
  }

  /**
   * Check if a sourceId is in the valid range for this SSTable (zone map)
   * @param sourceId The source ID to check
   * @returns true if in range, false otherwise
   */
  isInRange(sourceId: string): boolean {
    if (this.metadata.entryCount === 0) {
      return false
    }

    return (
      sourceId >= this.metadata.minSourceId &&
      sourceId <= this.metadata.maxSourceId
    )
  }

  /**
   * Get targets for a sourceId using binary search
   * @param sourceId The source ID to query
   * @returns Array of target IDs, or null if not found
   */
  get(sourceId: string): string[] | null {
    // Quick check: Is it in range?
    if (!this.isInRange(sourceId)) {
      return null
    }

    // Quick check: Does bloom filter say it might be here?
    if (!this.mightContain(sourceId)) {
      return null
    }

    // Binary search in sorted entries
    let left = 0
    let right = this.entries.length - 1

    while (left <= right) {
      const mid = Math.floor((left + right) / 2)
      const entry = this.entries[mid]
      const cmp = entry.sourceId.localeCompare(sourceId)

      if (cmp === 0) {
        // Found it!
        return entry.targets
      } else if (cmp < 0) {
        left = mid + 1
      } else {
        right = mid - 1
      }
    }

    // Not found (bloom filter false positive)
    return null
  }

  /**
   * Get all entries in this SSTable
   * Used for compaction and merging
   */
  getEntries(): SSTableEntry[] {
    return this.entries
  }

  /**
   * Get number of entries
   */
  size(): number {
    return this.entries.length
  }

  /**
   * Serialize SSTable to binary format using MessagePack
   * @returns Uint8Array of serialized data
   */
  serialize(): Uint8Array {
    const data: SerializedSSTable = {
      metadata: this.metadata,
      entries: this.entries,
      bloomFilter: this.bloomFilter.serialize(),
      checksum: this.calculateChecksum(this.entries)
    }

    const serialized = _encode(data)

    // Update size in metadata
    this.metadata.sizeBytes = serialized.length

    return serialized as Uint8Array
  }

  /**
   * Calculate checksum for data integrity
   * Simple but effective: hash of all sourceIds concatenated
   */
  private calculateChecksum(entries: SSTableEntry[]): string {
    const crypto = require('crypto')
    const hash = crypto.createHash('sha256')

    for (const entry of entries) {
      hash.update(entry.sourceId)
      for (const target of entry.targets) {
        hash.update(target)
      }
    }

    return hash.digest('hex')
  }

  /**
   * Deserialize SSTable from binary format
   * @param data Serialized SSTable data
   * @returns SSTable instance
   */
  static deserialize(data: Uint8Array): SSTable {
    const decoded = _decode(data) as SerializedSSTable

    // Verify checksum
    const sstable = new SSTable(
      decoded.entries,
      decoded.metadata.level,
      decoded.metadata.id
    )

    const calculatedChecksum = sstable.calculateChecksum(decoded.entries)
    if (calculatedChecksum !== decoded.checksum) {
      throw new Error(
        `SSTable checksum mismatch: expected ${decoded.checksum}, got ${calculatedChecksum}`
      )
    }

    // Restore metadata
    Object.assign(sstable.metadata, decoded.metadata)

    // Restore bloom filter
    sstable.bloomFilter = BloomFilter.deserialize(decoded.bloomFilter)

    return sstable
  }

  /**
   * Merge multiple SSTables into a single sorted SSTable
   * Used during compaction to combine multiple files
   *
   * @param sstables Array of SSTables to merge
   * @param targetLevel Target compaction level
   * @returns New merged SSTable
   */
  static merge(sstables: SSTable[], targetLevel: number): SSTable {
    if (sstables.length === 0) {
      throw new Error('Cannot merge zero SSTables')
    }

    if (sstables.length === 1) {
      // Nothing to merge, just update level
      return new SSTable(sstables[0].getEntries(), targetLevel)
    }

    // Collect all entries from all SSTables
    const allEntries = new Map<string, Set<string>>()

    for (const sstable of sstables) {
      for (const entry of sstable.getEntries()) {
        if (!allEntries.has(entry.sourceId)) {
          allEntries.set(entry.sourceId, new Set())
        }

        const targets = allEntries.get(entry.sourceId)!
        for (const target of entry.targets) {
          targets.add(target)
        }
      }
    }

    // Convert back to SSTableEntry format
    const mergedEntries: SSTableEntry[] = []
    allEntries.forEach((targets, sourceId) => {
      mergedEntries.push({
        sourceId,
        targets: Array.from(targets),
        count: targets.size
      })
    })

    // Create new merged SSTable (will be sorted in constructor)
    return new SSTable(mergedEntries, targetLevel)
  }

  /**
   * Get statistics about this SSTable
   */
  getStats(): {
    id: string
    level: number
    entries: number
    relationships: number
    sizeBytes: number
    minSourceId: string
    maxSourceId: string
    bloomFilterStats: ReturnType<BloomFilter['getStats']>
  } {
    return {
      id: this.metadata.id,
      level: this.metadata.level,
      entries: this.metadata.entryCount,
      relationships: this.metadata.relationshipCount,
      sizeBytes: this.metadata.sizeBytes,
      minSourceId: this.metadata.minSourceId,
      maxSourceId: this.metadata.maxSourceId,
      bloomFilterStats: this.bloomFilter.getStats()
    }
  }

  /**
   * Create an SSTable from a Map of sourceId → targets
   * Convenience method for creating from MemTable
   *
   * @param sourceMap Map of sourceId to Set of targetIds
   * @param level Compaction level
   * @returns New SSTable
   */
  static fromMap(
    sourceMap: Map<string, Set<string>>,
    level: number = 0
  ): SSTable {
    const entries: SSTableEntry[] = []

    sourceMap.forEach((targets, sourceId) => {
      entries.push({
        sourceId,
        targets: Array.from(targets),
        count: targets.size
      })
    })

    return new SSTable(entries, level)
  }

  /**
   * Estimate memory usage of this SSTable when loaded
   * @returns Estimated bytes
   */
  estimateMemoryUsage(): number {
    let bytes = 0

    // Metadata
    bytes += 500 // Rough estimate for metadata object

    // Entries
    for (const entry of this.entries) {
      bytes += entry.sourceId.length * 2 // UTF-16 encoding
      bytes += entry.targets.length * 40 // ~40 bytes per UUID string
      bytes += 50 // Entry object overhead
    }

    // Bloom filter
    bytes += this.bloomFilter.getStats().memoryBytes

    return bytes
  }
}
