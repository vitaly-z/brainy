/**
 * @module hnsw/mmapVectorBackend
 * @description Disk-resident vector cache backing HNSWIndex, wrapping the
 * `vectorStore:mmap` provider (cortex's NativeMmapVectorStore in production).
 *
 * **Why this exists.** Brainy's per-entity vector storage hits two ceilings as
 * datasets grow: (1) every `HNSWIndex.preloadVectors` does a sequential
 * `storage.getNounVector` per id (no batch), and (2) cloud and FS storage both
 * serialize each vector through JSON / msgpack, blocking zero-copy reads. An
 * mmap-backed single-file vector store, addressed by the stable int from
 * `EntityIdMapper`, gives O(1) batch reads + OS-page-cache prefetch and is the
 * foundation 2.4.0 #2 needs.
 *
 * **Lazy migration on miss.** First read of an unmigrated UUID falls back to
 * `storage.getNounVector` and writes the bytes into the mmap slot before
 * returning — idempotent, resumable, and lets an upgraded install converge to
 * the fast path under live traffic without a big-bang migration step. The
 * per-entity store remains the canonical source of truth; nothing in the per-
 * entity layer is rewritten or deleted here.
 *
 * **Local-FS only in 2.4.0.** Activated when the storage adapter exposes a
 * real local path via `getBinaryBlobPath()`. Cloud adapters (S3 / R2 / GCS)
 * return null and the backend is not constructed, so HNSWIndex falls back to
 * the existing per-entity read path. Chunked vector segments for remote
 * storage are the planned 2.4.0 #2 follow-up.
 */

import { mkdir } from 'node:fs/promises'
import { dirname } from 'node:path'
import type { Vector } from '../coreTypes.js'
import type {
  EntityIdMapperProvider,
  VectorStoreMmapInstance,
  VectorStoreMmapProvider
} from '../plugin.js'

/**
 * @description Bridge between brainy's UUID-keyed vector API and cortex's
 * int-slot mmap vector store. Translates UUIDs to stable int slots via the
 * `EntityIdMapper`, grows the file on demand, and handles read misses by
 * surfacing `null` (HNSWIndex's caller does the lazy storage fallback +
 * write-back). The class never touches per-entity storage directly — it owns
 * only the mmap layer.
 */
export class MmapVectorBackend {
  private readonly store: VectorStoreMmapInstance
  private readonly idMapper: EntityIdMapperProvider

  private constructor(store: VectorStoreMmapInstance, idMapper: EntityIdMapperProvider) {
    this.store = store
    this.idMapper = idMapper
  }

  /**
   * @description Open or create the mmap vector file at `path`. If the file
   * does not exist, it is created with the given dim + initial capacity. If
   * the directory containing `path` does not exist, it is created recursively
   * (the cortex provider does not auto-create parent directories).
   * @param provider - The `vectorStore:mmap` provider (cortex
   *   `NativeMmapVectorStore` in production).
   * @param path - Absolute path to the vector file. Derived by the caller
   *   from `storage.getBinaryBlobPath()` on local-FS adapters; cloud adapters
   *   return null and this method is not called.
   * @param dim - Vector dimensionality. Must match the embedding model.
   * @param initialCapacity - Slot capacity to allocate when creating a new
   *   file. The file grows automatically on writes beyond capacity.
   * @param idMapper - Stable UUID↔int mapper (post-2.4.0 #1 semantics — never
   *   renumbers across rebuild). The mmap slots are addressed by these ints,
   *   so id stability is the load-bearing invariant of the layout.
   * @returns A ready-to-use backend.
   */
  static async open(
    provider: VectorStoreMmapProvider,
    path: string,
    dim: number,
    initialCapacity: number,
    idMapper: EntityIdMapperProvider
  ): Promise<MmapVectorBackend> {
    await mkdir(dirname(path), { recursive: true })
    let store: VectorStoreMmapInstance
    try {
      store = provider.open(path)
    } catch {
      store = provider.create(path, dim, Math.max(initialCapacity, 16))
    }
    return new MmapVectorBackend(store, idMapper)
  }

  /** Vector dimensionality of the underlying mmap file. */
  get dim(): number {
    return this.store.dim
  }

  /**
   * @description Read a vector by UUID. Returns `null` for any of:
   * (1) UUID not yet assigned an int (entity never written through this
   * backend or storage), (2) int beyond the highest written slot, or
   * (3) the underlying mmap read throwing (corrupt / out-of-bounds).
   * The null path is the caller's signal to fall back to per-entity storage
   * and trigger a write-back migration.
   */
  readByUuid(uuid: string): Vector | null {
    const intId = this.idMapper.getInt(uuid)
    if (intId === undefined || intId >= this.store.count) return null
    try {
      return this.store.readVector(intId) as unknown as Vector
    } catch {
      return null
    }
  }

  /**
   * @description Batch read vectors by UUID. Returns an array aligned with
   * `uuids` where each entry is the vector or `null` for a miss. Order-
   * preserving. Internally collapses to a single batched mmap read of only the
   * indices that resolve to a written slot, then redistributes the flat output
   * back to the caller's order — so missing slots cost only a couple of map
   * lookups, not a full N-element read.
   */
  readBatchByUuid(uuids: string[]): (Vector | null)[] {
    const indices: number[] = []
    const slotByUuid = new Map<string, number>()
    for (const uuid of uuids) {
      const intId = this.idMapper.getInt(uuid)
      if (intId !== undefined && intId < this.store.count) {
        slotByUuid.set(uuid, indices.length)
        indices.push(intId)
      }
    }
    if (indices.length === 0) return uuids.map(() => null)
    const flat = this.store.readVectorsBatch(indices)
    const dim = this.store.dim
    return uuids.map(uuid => {
      const slot = slotByUuid.get(uuid)
      if (slot === undefined) return null
      return flat.slice(slot * dim, (slot + 1) * dim) as unknown as Vector
    })
  }

  /**
   * @description Write a vector at the slot for `uuid`. Assigns a new int if
   * the UUID is unseen (stable, append-only). Grows the underlying file (slot
   * capacity doubled until the target index fits) before writing past
   * capacity, so the caller need not worry about file sizing.
   */
  writeByUuid(uuid: string, vector: Vector): void {
    const intId = this.idMapper.getOrAssign(uuid)
    if (intId >= this.store.capacity) {
      let newCap = Math.max(this.store.capacity, 16)
      while (intId >= newCap) newCap *= 2
      this.store.resize(newCap)
    }
    this.store.writeVector(intId, Array.from(vector as ArrayLike<number>))
  }

  /**
   * @description madvise(WILLNEED) hint for the slots backing `uuids`. Cheap;
   * silently drops UUIDs not yet in the mmap. Used by HNSW search to overlap
   * disk I/O with graph traversal.
   */
  prefetchByUuid(uuids: string[]): void {
    const indices: number[] = []
    for (const uuid of uuids) {
      const intId = this.idMapper.getInt(uuid)
      if (intId !== undefined && intId < this.store.count) indices.push(intId)
    }
    if (indices.length > 0) this.store.prefetch(indices)
  }

  /** msync — flush dirty pages to disk. */
  flush(): void {
    this.store.flush()
  }
}
