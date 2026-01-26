/**
 * EntityIdMapper - Bidirectional mapping between UUID strings and integer IDs for roaring bitmaps
 *
 * Roaring bitmaps require 32-bit unsigned integers, but Brainy uses UUID strings as entity IDs.
 * This class provides efficient bidirectional mapping with persistence support.
 *
 * Features:
 * - O(1) lookup in both directions
 * - Persistent storage via storage adapter
 * - Atomic counter for next ID
 * - Serialization/deserialization support
 *
 * @module utils/entityIdMapper
 */

import type { StorageAdapter } from '../coreTypes.js'

export interface EntityIdMapperOptions {
  storage: StorageAdapter
  storageKey?: string
}

export interface EntityIdMapperData {
  nextId: number
  uuidToInt: Record<string, number>
  intToUuid: Record<number, string>
}

/**
 * Maps entity UUIDs to integer IDs for use with Roaring Bitmaps
 */
export class EntityIdMapper {
  private storage: StorageAdapter
  private storageKey: string

  // Bidirectional maps
  private uuidToInt = new Map<string, number>()
  private intToUuid = new Map<number, string>()

  // Atomic counter for next ID
  private nextId = 1

  // Dirty flag for persistence
  private dirty = false

  constructor(options: EntityIdMapperOptions) {
    this.storage = options.storage
    this.storageKey = options.storageKey || 'brainy:entityIdMapper'
  }

  /**
   * Initialize the mapper by loading from storage
   */
  async init(): Promise<void> {
    try {
      const metadata = await this.storage.getMetadata(this.storageKey)
      // v4.8.0: metadata IS the data (no nested 'data' property)
      if (metadata && (metadata as any).nextId !== undefined) {
        const data = metadata as any as EntityIdMapperData
        this.nextId = data.nextId

        // Rebuild maps from serialized data
        this.uuidToInt = new Map(Object.entries(data.uuidToInt).map(([k, v]) => [k, Number(v)]))
        this.intToUuid = new Map(Object.entries(data.intToUuid).map(([k, v]) => [Number(k), v]))
      }
    } catch (error) {
      // First time initialization - maps are empty, nextId = 1
    }
  }

  /**
   * Get integer ID for UUID, assigning a new ID if not exists
   */
  getOrAssign(uuid: string): number {
    const existing = this.uuidToInt.get(uuid)
    if (existing !== undefined) {
      return existing
    }

    // Assign new ID
    const newId = this.nextId++
    this.uuidToInt.set(uuid, newId)
    this.intToUuid.set(newId, uuid)
    this.dirty = true

    return newId
  }

  /**
   * v7.5.0: Get integer ID for UUID with immediate persistence guarantee
   * Unlike getOrAssign(), this method flushes to storage immediately after assigning
   * a new ID. This prevents UUID→int mapping divergence if the process crashes
   * before a normal flush() occurs.
   *
   * Use this for critical operations where data integrity is paramount.
   * Normal operations can use getOrAssign() with batched flushing for better performance.
   */
  async getOrAssignSync(uuid: string): Promise<number> {
    const id = this.getOrAssign(uuid)

    // If a new ID was assigned, immediately persist to storage
    if (this.dirty) {
      await this.flush()
    }

    return id
  }

  /**
   * Get UUID for integer ID
   */
  getUuid(intId: number): string | undefined {
    return this.intToUuid.get(intId)
  }

  /**
   * Get integer ID for UUID (without assigning if not exists)
   */
  getInt(uuid: string): number | undefined {
    return this.uuidToInt.get(uuid)
  }

  /**
   * Check if UUID has been assigned an integer ID
   */
  has(uuid: string): boolean {
    return this.uuidToInt.has(uuid)
  }

  /**
   * Remove mapping for UUID
   */
  remove(uuid: string): boolean {
    const intId = this.uuidToInt.get(uuid)
    if (intId === undefined) {
      return false
    }

    this.uuidToInt.delete(uuid)
    this.intToUuid.delete(intId)
    this.dirty = true

    return true
  }

  /**
   * Get total number of mappings
   */
  get size(): number {
    return this.uuidToInt.size
  }

  /**
   * Convert array of UUIDs to array of integers
   */
  uuidsToInts(uuids: string[]): number[] {
    return uuids.map(uuid => this.getOrAssign(uuid))
  }

  /**
   * Convert array of integers to array of UUIDs
   */
  intsToUuids(ints: number[]): string[] {
    const result: string[] = []
    for (const intId of ints) {
      const uuid = this.intToUuid.get(intId)
      if (uuid) {
        result.push(uuid)
      }
    }
    return result
  }

  /**
   * Convert iterable of integers to array of UUIDs (for roaring bitmap iteration)
   */
  intsIterableToUuids(ints: Iterable<number>): string[] {
    const result: string[] = []
    for (const intId of ints) {
      const uuid = this.intToUuid.get(intId)
      if (uuid) {
        result.push(uuid)
      }
    }
    return result
  }

  /**
   * Flush mappings to storage
   */
  async flush(): Promise<void> {
    if (!this.dirty) {
      return
    }

    // Convert maps to plain objects for serialization
    // v4.0.0: Add required 'noun' property for NounMetadata
    const data = {
      noun: 'EntityIdMapper',
      nextId: this.nextId,
      uuidToInt: Object.fromEntries(this.uuidToInt),
      intToUuid: Object.fromEntries(this.intToUuid)
    }

    await this.storage.saveMetadata(this.storageKey, data as any)
    this.dirty = false
  }

  /**
   * Clear all mappings
   */
  async clear(): Promise<void> {
    this.uuidToInt.clear()
    this.intToUuid.clear()
    this.nextId = 1
    this.dirty = true
    await this.flush()
  }

  /**
   * Get statistics about the mapper
   */
  getStats() {
    return {
      mappings: this.uuidToInt.size,
      nextId: this.nextId,
      dirty: this.dirty,
      memoryEstimate: this.uuidToInt.size * (36 + 8 + 4 + 8) // uuid string + map overhead + int + map overhead
    }
  }
}
