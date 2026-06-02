/**
 * EntityIdMapper - Bidirectional mapping between UUID strings and integer IDs.
 *
 * Roaring bitmaps require 32-bit unsigned integers, but Brainy uses UUID strings
 * as canonical entity IDs. This class provides efficient O(1) bidirectional
 * mapping with persistence — and, importantly, a stability guarantee that any
 * persisted int-keyed data can rely on.
 *
 * **Stability guarantee (the foundation 2.4.0 vector-mmap, graph-link-compression,
 * and column-store interchange all key off):**
 *
 * - `getOrAssign(uuid)` is **append-only**: once a UUID is assigned an int, the
 *   mapping never changes. Subsequent `getOrAssign` calls for the same UUID
 *   return the same int.
 * - `nextId` is **monotonically increasing**. New UUIDs always get an int greater
 *   than any previously assigned, so a removed-then-re-added UUID is treated as
 *   a fresh entity (and gets a fresh int — there is no automatic "revive").
 * - `remove(uuid)` removes the mapping but does **not** decrement `nextId` or
 *   recycle the int. The removed int becomes a permanent hole in `intToUuid` —
 *   downstream consumers seeing `getUuid(int) === undefined` know the entity
 *   was deleted.
 * - A metadata-index `rebuild()` does **not** clear the mapper (the rebuild path
 *   re-iterates entities via `getOrAssign`, which returns existing ints unchanged).
 *   Only the explicit `clear()` method renumbers — used by `clearAllIndexData()`
 *   as the nuclear recovery path with a documented warning.
 *
 * Features:
 * - O(1) lookup in both directions.
 * - Persistent storage via storage adapter.
 * - Atomic, monotonic, append-only int counter.
 * - Serialization/deserialization support.
 *
 * @module utils/entityIdMapper
 */

import type { StorageAdapter } from '../coreTypes.js'
import type { EntityIdMapperProvider } from '../plugin.js'

/**
 * The largest entity int the JS fallback `EntityIdMapper` will allocate.
 * The metadata index's roaring bitmaps are 32-bit-keyed (`Roaring32`), so
 * allowing the JS counter past this point would silently corrupt every
 * downstream bitmap. The cortex 3.0 binary mapper supports a U64 IdSpace
 * for brains above this ceiling — see the
 * [`EntityIdSpaceExceeded`](#EntityIdSpaceExceeded) message for the
 * migration pointer.
 */
export const U32_ENTITY_ID_MAX = 0xffff_ffff

/**
 * Thrown by the JS fallback `EntityIdMapper` when `nextId` would exceed
 * [`U32_ENTITY_ID_MAX`](#U32_ENTITY_ID_MAX). The JS path is the
 * cortex-free fallback; once a brain has more than ~4.29 B entities,
 * callers MUST install the cortex 3.0 `NativeBinaryEntityIdMapper` with
 * `idSpace: 'u64'` (mmap-backed extendible-hash KV; persists the full
 * u64 range losslessly).
 *
 * Brainy 8.0 surfaces this loudly rather than silently widening past
 * u32::MAX, because the metadata index's roaring bitmaps would silently
 * truncate entity ids and zero-out query results.
 */
export class EntityIdSpaceExceeded extends Error {
  /** The u32 entity-id ceiling. */
  readonly ceiling: number = U32_ENTITY_ID_MAX
  /**
   * The would-be `nextId` value the mapper was about to assign — always
   * `U32_ENTITY_ID_MAX + 1`.
   */
  readonly attempted: number

  constructor(attempted: number) {
    super(
      `EntityIdMapper: nextId ${attempted} would exceed u32::MAX ` +
        `(${U32_ENTITY_ID_MAX}). The JS fallback mapper caps at u32 to ` +
        `match the metadata index's Roaring32 bitmap width. For >4.29 B ` +
        `entities, install @soulcraft/cortex and configure the binary ` +
        `mapper with idSpace: 'u64' (mmap-backed extendible-hash KV).`,
    )
    this.name = 'EntityIdSpaceExceeded'
    this.attempted = attempted
  }
}

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
 * Maps entity UUIDs to integer IDs for use with Roaring Bitmaps.
 *
 * Implements {@link EntityIdMapperProvider}: the surface a registered
 * `'entityIdMapper'` provider (e.g. Cortex's native mapper) must also satisfy.
 */
export class EntityIdMapper implements EntityIdMapperProvider {
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
      // metadata IS the data (no nested 'data' property)
      if (metadata && (metadata as any).nextId !== undefined) {
        const data = metadata as any as EntityIdMapperData
        this.nextId = data.nextId

        // Rebuild maps from serialized data
        this.uuidToInt = new Map(Object.entries(data.uuidToInt).map(([k, v]) => [k, Number(v)]))
        this.intToUuid = new Map(Object.entries(data.intToUuid).map(([k, v]) => [Number(k), v]))
      } else {
        // Guard: mapper file missing but entities may exist on disk.
        // If we start from nextId=1 with existing entities, roaring bitmap
        // queries will use wrong integer IDs → silent data corruption.
        // Probe storage to detect this case and log a warning.
        try {
          const probe = await this.storage.getNouns({ pagination: { limit: 1, offset: 0 } })
          if ((probe.totalCount ?? 0) > 0 || probe.items.length > 0) {
            console.warn(
              `[EntityIdMapper] Mapper file missing but entities exist on disk. ` +
              `IDs will be rebuilt during metadata index reconstruction.`
            )
          }
        } catch {
          // Storage not ready
        }
      }
    } catch (error) {
      // First time initialization - maps are empty, nextId = 1
    }
  }

  /**
   * Get integer ID for UUID, assigning a new ID if not exists.
   *
   * The JS fallback mapper caps at [`U32_ENTITY_ID_MAX`](#U32_ENTITY_ID_MAX)
   * to match the metadata index's Roaring32 bitmap width — once `nextId`
   * would exceed that, throws {@link EntityIdSpaceExceeded} so the caller
   * loudly migrates to cortex's binary mapper with `idSpace: 'u64'`
   * rather than silently truncating entity ids.
   */
  getOrAssign(uuid: string): number {
    const existing = this.uuidToInt.get(uuid)
    if (existing !== undefined) {
      return existing
    }

    // Assign new ID
    if (this.nextId > U32_ENTITY_ID_MAX) {
      throw new EntityIdSpaceExceeded(this.nextId)
    }
    const newId = this.nextId++
    this.uuidToInt.set(uuid, newId)
    this.intToUuid.set(newId, uuid)
    this.dirty = true

    return newId
  }

  /**
   * Get integer ID for UUID with immediate persistence guarantee
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
   * Get all mapped integer IDs without storage reads.
   * Used for bitmap negation operations (ne, exists:false, missing:true)
   * to avoid full-table getAllIds() scans.
   */
  getAllIntIds(): number[] {
    return Array.from(this.intToUuid.keys())
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
    // Add required 'noun' property for NounMetadata
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
