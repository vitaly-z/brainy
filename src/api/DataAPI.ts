/**
 * @module DataAPI
 * @description Portable graph backup/restore for Brainy — the `BackupData v1`
 * export/import format plus `clear()`/`getStats()` data-management helpers.
 *
 * Accessed via `brain.data()`. The two headline methods are:
 *
 * - **`export(selector?, options?) → BackupData`** — serialize a graph (an item, a
 *   collection + children, a connected neighbourhood, a VFS subtree, a predicate
 *   match, or the whole brain) into ONE versioned, portable JSON document.
 * - **`import(backup, options?) → ImportResult`** — restore a `BackupData` into the
 *   brain (dedup-by-id merge by default), re-embedding from `data` when vectors are
 *   absent.
 *
 * This is the **portable** round-trip: human-readable, partial-or-whole, and
 * cross-version (a `formatVersion: 1` document written by 7.x imports cleanly into
 * 8.0). It is distinct from `brain.import()` (file ingestion — CSV/PDF/Excel/JSON)
 * and, on 8.0, from `db.persist()`/`Brainy.load()` (the native whole-brain snapshot,
 * which preserves generation history but is neither portable JSON nor cross-version).
 *
 * **Design decision (reserved-field split):** entities carry Brainy's standard fields
 * (`subtype`, `data`, `confidence`, `weight`, `service`, `createdBy`, `createdAt`) at
 * the TOP LEVEL of each `BackupEntity`, and `metadata` holds ONLY custom user fields —
 * mirroring the in-memory `Entity` shape, so `import()` maps each field to its dedicated
 * `add()`/`relate()` parameter rather than dumping everything into the metadata bag.
 */

import { StorageAdapter } from '../coreTypes.js'
import { Entity, Relation } from '../types/brainy.types.js'
import { NounType, VerbType } from '../types/graphTypes.js'
import { getBrainyVersion } from '../utils/version.js'

/** The fixed entity id of the VFS root collection (excluded from exports unless `includeSystem`). */
const VFS_ROOT_ID = '00000000-0000-0000-0000-000000000000'
/** Magic string identifying a Brainy portable backup document. */
const BACKUP_FORMAT = 'brainy-backup'
/** Current portable-format version. Import gates on this for cross-version migration. */
const BACKUP_FORMAT_VERSION = 1
/** Default embedding model label (informational; `dimensions` is the real compat gate). */
const DEFAULT_EMBED_MODEL = 'all-MiniLM-L6-v2'
/** Storage-layer fetch ceiling for enumerations (well above any single-brain entity count). */
const ENUMERATION_LIMIT = 1_000_000
/** Per-node relation fetch ceiling (filtered by source/target, so no unfiltered-scan warning). */
const RELATION_FETCH_LIMIT = 100_000

/**
 * @description Selects WHICH part of the graph to export. Reuses `find()`'s grammar
 * (export "what find would match, minus ranking/limit") plus export-specific selectors.
 * Omit the selector entirely (or pass `{}`) to export the whole brain.
 *
 * Structural selectors (`ids` / `collection` / `connected` / `vfsPath`) and predicate
 * selectors (`type` / `subtype` / `where` / `service` / `visibility`) **compose**: a
 * structural selector picks the node set, and any predicate keys then filter it
 * (e.g. `{ collection: id, where: { status: 'open' } }` = members matching the predicate).
 */
export interface ExportSelector {
  /** Exactly these entity ids. */
  ids?: string[]
  /** A collection id → the collection + its transitive `Contains` members. */
  collection?: string
  /** Alias for `collection`. */
  memberOf?: string
  /** An entity + its N-hop neighbourhood (reuses graph traversal). */
  connected?: {
    /** Start entity id. */
    from: string
    /** Hops to traverse (default: 1). */
    depth?: number
    /** Restrict to these verb types (default: all). */
    verbs?: VerbType[]
    /** Edge direction to follow (default: `'out'`). */
    direction?: 'out' | 'in' | 'both'
  }
  /** A VFS path → the directory/file + (for a directory) its `Contains` subtree. */
  vfsPath?: string
  /** For `vfsPath` directories: include the whole subtree (default: true). */
  recursive?: boolean
  /** For `collection`/`vfsPath`: cap traversal depth (default: unbounded). */
  depth?: number
  /** Predicate: entity type(s). */
  type?: NounType | NounType[]
  /** Predicate: entity subtype(s). */
  subtype?: string | string[]
  /** Predicate: exact-match metadata fields. */
  where?: Record<string, any>
  /** Predicate: multi-tenancy service id. */
  service?: string
  /** Predicate: visibility (`'public'` matches entities with no explicit visibility). */
  visibility?: string
}

/**
 * @description Controls HOW the selected graph is serialized.
 */
export interface ExportOptions {
  /** Include embedding vectors verbatim (default: false → `import()` re-embeds from `data`). */
  includeVectors?: boolean
  /** Include VFS file bytes in `blobs` so files round-trip byte-identically (default: false). */
  includeContent?: boolean
  /** Include `visibility:'system'` entities (e.g. the VFS root) (default: false). */
  includeSystem?: boolean
  /**
   * Which edges to include (default: `'induced'`):
   * - `'induced'` — only edges whose BOTH endpoints are in the node set (self-contained subgraph).
   * - `'incident'` — also edges that dangle to outside ids (recorded in `danglingIds`).
   * - `'none'` — nodes only.
   */
  edges?: 'induced' | 'incident' | 'none'
}

/**
 * @description Controls how a `BackupData` is applied to the brain on `import()`.
 */
export interface ImportOptions {
  /**
   * Conflict policy when an entity id already exists (default: `'merge'`):
   * - `'merge'` — update in place (dedup-by-id; the default that lets you assemble many backups).
   * - `'replace'` — delete then re-create.
   * - `'skip'` — leave the existing entity untouched.
   */
  onConflict?: 'merge' | 'replace' | 'skip'
  /**
   * Vector policy (default: `'auto'`):
   * - `'auto'` — use the carried vector when present, otherwise re-embed from `data`.
   * - `'never'` — use the carried vector when present, otherwise record an error (no re-embed).
   */
  reembed?: 'auto' | 'never'
  /** Rewrite every id on the way in (e.g. to clone a template subgraph under fresh ids). */
  remapIds?: (id: string) => string
}

/** One entity in a `BackupData`. Standard fields top-level; `metadata` is custom-only. */
export interface BackupEntity {
  id: string
  /** NounType value. */
  type: string
  /** Per-product sub-classification. */
  subtype?: string
  /** Visibility (omitted ⇒ `'public'`; never `'system'` unless `includeSystem`). */
  visibility?: string
  /** Opaque content payload (the embedding source). */
  data?: any
  /** Type-classification confidence (0–1). */
  confidence?: number
  /** Entity importance/salience (0–1). */
  weight?: number
  /** Multi-tenancy service id. */
  service?: string
  /** Provenance: what created this entity. */
  createdBy?: any
  /** Original creation timestamp (informational; the target brain assigns its own on import). */
  createdAt?: number
  /** Embedding vector — present only when exported with `includeVectors`. */
  vector?: number[]
  /** Custom user fields only (reserved fields live at the top level). */
  metadata?: any
}

/** One relation (edge) in a `BackupData`. */
export interface BackupRelation {
  id: string
  from: string
  to: string
  /** VerbType value. */
  type: string
  /** Per-product edge sub-classification. */
  subtype?: string
  /** Visibility (omitted ⇒ `'public'`). */
  visibility?: string
  /** Connection strength (0–1). */
  weight?: number
  /** Relationship certainty (0–1). */
  confidence?: number
  /** Custom user fields on the edge. */
  metadata?: any
}

/**
 * @description A self-describing, versioned, portable graph document. The same shape
 * is produced/consumed on 7.x and 8.0; `formatVersion` gates cross-version migration.
 */
export interface BackupData {
  /** Always `'brainy-backup'` — identifies the document type. */
  format: typeof BACKUP_FORMAT
  /** Integer format version (import gates on this). */
  formatVersion: number
  /** The Brainy version that produced the document (informational). */
  brainyVersion: string
  /** ISO-8601 creation time. */
  createdAt: string
  /** Embedding manifest — `import()` verifies dimension compatibility before re-embedding. */
  embedding: { model: string; dimensions: number }
  /** Echo of the selector that produced this document (provenance). */
  selector?: ExportSelector
  /** Exported entities. */
  entities: BackupEntity[]
  /** Exported relations. */
  relations: BackupRelation[]
  /** VFS file bytes keyed by sha256 — present only with `includeContent`. */
  blobs?: Record<string, string>
  /** Endpoints referenced by `edges:'incident'` that fell outside the node set. */
  danglingIds?: string[]
  /** Summary counts. */
  stats: {
    entityCount: number
    relationCount: number
    blobCount: number
    vectorDimensions?: number
  }
}

/** Outcome of an `import()`. */
export interface ImportResult {
  /** New entities created. */
  imported: number
  /** Existing entities merged (dedup-by-id). */
  merged: number
  /** Existing entities left untouched (`onConflict:'skip'`). */
  skipped: number
  /** Entities re-embedded from `data` because no vector was carried. */
  reembedded: number
  /** VFS blob bytes written. */
  blobsWritten: number
  /** Per-record failures (id + message); the import continues past individual errors. */
  errors: Array<{ id: string; error: string }>
}

/**
 * @description Data-management API for a Brainy instance: portable graph
 * `export()`/`import()` plus `clear()`/`getStats()`. Constructed by `brain.data()`.
 */
export class DataAPI {
  /**
   * @param storage - The brain's storage adapter (used for blob bytes + bulk enumeration).
   * @param brain - The owning Brainy instance (drives export/import via its public API).
   */
  constructor(
    private storage: StorageAdapter,
    private brain: any
  ) {}

  // ============================================================================
  // EXPORT
  // ============================================================================

  /**
   * @description Serialize part or all of the graph into a portable `BackupData`.
   * @param selector - WHAT to export (omit for the whole brain). See {@link ExportSelector}.
   * @param options - HOW to export (vectors, file bytes, edge policy). See {@link ExportOptions}.
   * @returns A versioned, portable `BackupData` document.
   * @example
   * // A single workbench's members (exact id set), with vectors:
   * const backup = await brain.data().export({ ids }, { includeVectors: true })
   * @example
   * // A collection and everything under it:
   * const backup = await brain.data().export({ collection: collectionId })
   * @example
   * // A VFS subtree including file bytes:
   * const backup = await brain.data().export({ vfsPath: '/docs' }, { includeContent: true })
   * @example
   * // The whole brain:
   * const backup = await brain.data().export()
   */
  async export(selector: ExportSelector = {}, options: ExportOptions = {}): Promise<BackupData> {
    if (!this.brain) {
      throw new Error('DataAPI.export() requires a Brainy instance (use brain.data().export()).')
    }
    const {
      includeVectors = false,
      includeContent = false,
      includeSystem = false,
      edges = 'induced'
    } = options

    // 1. Resolve the candidate node set (structural selector, or all ids for whole/predicate).
    let candidateIds = await this.resolveCandidates(selector, includeSystem)

    // 2. Read canonical entities (reserved fields top-level, metadata custom-only).
    const entityMap = await this.brain.batchGet(candidateIds, { includeVectors })

    // 3. Apply predicate filtering on the canonical entities (handles predicate-only + compose).
    let idSet: Set<string>
    if (this.hasPredicate(selector)) {
      idSet = new Set<string>()
      for (const id of candidateIds) {
        const e = entityMap.get(id)
        if (e && this.matchesPredicate(e, selector)) idSet.add(id)
      }
    } else {
      idSet = new Set(candidateIds.filter((id: string) => entityMap.has(id)))
    }

    // 4. Build entity records.
    const entities: BackupEntity[] = []
    for (const id of idSet) {
      const e = entityMap.get(id)
      if (e) entities.push(this.toBackupEntity(e, includeVectors))
    }

    // 5. Collect edges per policy.
    const { relations, danglingIds } = await this.collectEdges(idSet, edges)

    // 6. Collect VFS blob bytes (only when requested).
    let blobs: Record<string, string> | undefined
    if (includeContent) {
      blobs = await this.collectBlobs(entities, entityMap)
    }

    // 7. Resolve the embedding dimension (from a carried vector, else the brain's dimension).
    const dimensions =
      entities.find((e) => e.vector && e.vector.length)?.vector?.length ??
      this.detectDimensions() ??
      384

    const blobCount = blobs ? Object.keys(blobs).length : 0

    return {
      format: BACKUP_FORMAT,
      formatVersion: BACKUP_FORMAT_VERSION,
      brainyVersion: getBrainyVersion(),
      createdAt: new Date().toISOString(),
      embedding: { model: this.detectModel(), dimensions },
      selector,
      entities,
      relations,
      ...(blobs && blobCount > 0 ? { blobs } : {}),
      ...(danglingIds && danglingIds.length > 0 ? { danglingIds } : {}),
      stats: {
        entityCount: entities.length,
        relationCount: relations.length,
        blobCount,
        vectorDimensions: dimensions
      }
    }
  }

  // ============================================================================
  // IMPORT
  // ============================================================================

  /**
   * @description Restore a `BackupData` into the brain. Dedup-by-id merge by default, so
   * assembling many backups that share entity ids merges rather than duplicates. Vectors
   * are re-embedded from `data` when absent (`reembed:'auto'`).
   * @param data - A `BackupData` document (must have `format:'brainy-backup'`).
   * @param options - Conflict/vector/id-remap policy. See {@link ImportOptions}.
   * @returns Counts of imported/merged/skipped/re-embedded entities + any per-record errors.
   * @throws If `data` is not a `BackupData`, or its `formatVersion` is newer than supported.
   * @example
   * const result = await brain.data().import(backup, { onConflict: 'merge' })
   */
  async import(data: BackupData, options: ImportOptions = {}): Promise<ImportResult> {
    if (!this.brain) {
      throw new Error('DataAPI.import() requires a Brainy instance (use brain.data().import()).')
    }
    if (!data || (data as any).format !== BACKUP_FORMAT) {
      throw new Error(
        `DataAPI.import() expects a BackupData document (format:'${BACKUP_FORMAT}'). ` +
          `For file ingestion (CSV/PDF/Excel/JSON), use brain.import() instead.`
      )
    }
    if (typeof data.formatVersion === 'number' && data.formatVersion > BACKUP_FORMAT_VERSION) {
      throw new Error(
        `Backup formatVersion ${data.formatVersion} is newer than this Brainy supports ` +
          `(max ${BACKUP_FORMAT_VERSION}). Upgrade Brainy to import this document.`
      )
    }

    const { onConflict = 'merge', reembed = 'auto', remapIds } = options
    const result: ImportResult = {
      imported: 0,
      merged: 0,
      skipped: 0,
      reembedded: 0,
      blobsWritten: 0,
      errors: []
    }
    const mapId = (id: string) => (remapIds ? remapIds(id) : id)

    // 1. Write blob bytes first so file entities resolve their content.
    if (data.blobs && Object.keys(data.blobs).length > 0) {
      const blobStorage = (this.storage as any).blobStorage
      if (blobStorage?.write) {
        for (const [hash, b64] of Object.entries(data.blobs)) {
          try {
            await blobStorage.write(Buffer.from(b64, 'base64'))
            result.blobsWritten++
          } catch (e) {
            result.errors.push({ id: hash, error: `blob: ${(e as Error).message}` })
          }
        }
      } else {
        for (const hash of Object.keys(data.blobs)) {
          result.errors.push({ id: hash, error: 'blob: storage does not support binary blobs' })
        }
      }
    }

    // 2. Entities (so relation endpoints exist before edges are created).
    for (const be of data.entities || []) {
      const id = mapId(be.id)
      try {
        const exists = await this.entityExists(id)
        if (exists) {
          if (onConflict === 'skip') {
            result.skipped++
            continue
          }
          if (onConflict === 'merge') {
            await this.brain.update({ id, ...this.entityUpdateFields(be), merge: true })
            result.merged++
            continue
          }
          await this.brain.delete(id) // 'replace'
        }

        const useVector = Array.isArray(be.vector) && be.vector.length > 0
        if (!useVector && reembed === 'never') {
          result.errors.push({ id, error: 'no vector carried and reembed:never' })
          continue
        }
        await this.brain.add({
          id,
          ...this.entityAddFields(be),
          ...(useVector ? { vector: be.vector } : {})
        })
        result.imported++
        if (!useVector) result.reembedded++
      } catch (e) {
        result.errors.push({ id, error: (e as Error).message })
      }
    }

    // 3. Relations.
    for (const br of data.relations || []) {
      const from = mapId(br.from)
      const to = mapId(br.to)
      try {
        await this.brain.relate({
          from,
          to,
          type: br.type as VerbType,
          ...(br.subtype !== undefined ? { subtype: br.subtype } : {}),
          ...(br.weight !== undefined ? { weight: br.weight } : {}),
          ...(br.confidence !== undefined ? { confidence: br.confidence } : {}),
          ...(br.metadata !== undefined ? { metadata: br.metadata } : {})
        })
      } catch (e) {
        result.errors.push({ id: br.id, error: `relation: ${(e as Error).message}` })
      }
    }

    return result
  }

  // ============================================================================
  // CLEAR / STATS
  // ============================================================================

  /**
   * @description Delete data from the brain.
   * @param params - Which categories to clear (`entities`/`relations` default true; `config` false).
   */
  async clear(
    params: { entities?: boolean; relations?: boolean; config?: boolean } = {}
  ): Promise<void> {
    const { entities = true, relations = true } = params

    if (entities) {
      const nounsResult = await this.storage.getNouns({ pagination: { limit: ENUMERATION_LIMIT } })
      for (const noun of nounsResult.items) {
        await this.storage.deleteNoun(noun.id)
      }
      if (this.brain?.index?.clear) {
        this.brain.index.clear()
      }
      if (this.brain?.metadataIndex) {
        await this.brain.metadataIndex.rebuild()
      }
    }

    if (relations) {
      const verbsResult = await this.storage.getVerbs({ pagination: { limit: ENUMERATION_LIMIT } })
      for (const verb of verbsResult.items) {
        await this.storage.deleteVerb(verb.id)
      }
    }
  }

  /**
   * @description Summary counts for the brain.
   * @returns Entity/relation totals and the vector dimensionality.
   */
  async getStats(): Promise<{
    entities: number
    relations: number
    storageSize?: number
    vectorDimensions?: number
  }> {
    const nounsResult = await this.storage.getNouns({ pagination: { limit: 1 } })
    const verbsResult = await this.storage.getVerbs({ pagination: { limit: 1 } })
    const firstNoun = nounsResult.items[0] as any

    return {
      entities: nounsResult.totalCount || nounsResult.items.length,
      relations: verbsResult.totalCount || verbsResult.items.length,
      vectorDimensions: firstNoun?.vector?.length
    }
  }

  // ============================================================================
  // SELECTOR RESOLUTION (private)
  // ============================================================================

  /** True if the selector names a structural node set. */
  private hasStructural(s: ExportSelector): boolean {
    return !!(s.ids || s.collection || s.memberOf || s.connected || s.vfsPath)
  }

  /** True if the selector carries predicate (filter) keys. */
  private hasPredicate(s: ExportSelector): boolean {
    return (
      s.type !== undefined ||
      s.subtype !== undefined ||
      s.where !== undefined ||
      s.service !== undefined ||
      s.visibility !== undefined
    )
  }

  /**
   * Resolve the candidate id list: the structural node set when a structural selector is
   * present, otherwise every entity id (for predicate-only and whole-brain exports).
   * Predicate filtering is applied later, on the canonical entities.
   */
  private async resolveCandidates(s: ExportSelector, includeSystem: boolean): Promise<string[]> {
    let idSet: Set<string>

    if (s.ids && s.ids.length) {
      idSet = new Set(s.ids)
    } else if (s.collection ?? s.memberOf) {
      idSet = await this.resolveCollectionSubtree((s.collection ?? s.memberOf)!, s.depth)
    } else if (s.connected) {
      idSet = await this.resolveConnected(s.connected)
    } else if (s.vfsPath) {
      idSet = await this.resolveVfsPath(s.vfsPath, s.recursive ?? true, s.depth)
    } else {
      idSet = await this.allEntityIds()
    }

    if (!includeSystem) idSet.delete(VFS_ROOT_ID)
    return Array.from(idSet)
  }

  /** Every entity id in the brain (storage-layer enumeration; no query-limit enforcement). */
  private async allEntityIds(): Promise<Set<string>> {
    const result = await this.storage.getNouns({ pagination: { limit: ENUMERATION_LIMIT } })
    return new Set(result.items.map((n: any) => n.id))
  }

  /** A collection id + its transitive `Contains` members (BFS, optionally depth-capped). */
  private async resolveCollectionSubtree(rootId: string, depth?: number): Promise<Set<string>> {
    const set = new Set<string>([rootId])
    const maxDepth = depth ?? Infinity
    let frontier = [rootId]
    let d = 0
    while (frontier.length && d < maxDepth) {
      const next: string[] = []
      for (const id of frontier) {
        const rels = await this.brain.getRelations({
          from: id,
          type: VerbType.Contains,
          limit: RELATION_FETCH_LIMIT
        })
        for (const r of rels as Relation[]) {
          if (!set.has(r.to)) {
            set.add(r.to)
            next.push(r.to)
          }
        }
      }
      frontier = next
      d++
    }
    return set
  }

  /** An entity + its N-hop neighbourhood, following `verbs`/`direction`. */
  private async resolveConnected(c: NonNullable<ExportSelector['connected']>): Promise<Set<string>> {
    const { from, depth = 1, verbs, direction = 'out' } = c
    const set = new Set<string>([from])
    let frontier = [from]
    for (let d = 0; d < depth; d++) {
      const next: string[] = []
      for (const id of frontier) {
        const neighbours = await this.neighboursOf(id, direction, verbs)
        for (const n of neighbours) {
          if (!set.has(n)) {
            set.add(n)
            next.push(n)
          }
        }
      }
      frontier = next
      if (!next.length) break
    }
    return set
  }

  /** Neighbour ids of an entity in the requested direction, optionally verb-filtered. */
  private async neighboursOf(
    id: string,
    direction: 'out' | 'in' | 'both',
    verbs?: VerbType[]
  ): Promise<string[]> {
    const out: string[] = []
    if (direction === 'out' || direction === 'both') {
      const rels = (await this.brain.getRelations({ from: id, limit: RELATION_FETCH_LIMIT })) as Relation[]
      for (const r of rels) if (!verbs || verbs.includes(r.type)) out.push(r.to)
    }
    if (direction === 'in' || direction === 'both') {
      const rels = (await this.brain.getRelations({ to: id, limit: RELATION_FETCH_LIMIT })) as Relation[]
      for (const r of rels) if (!verbs || verbs.includes(r.type)) out.push(r.from)
    }
    return out
  }

  /** A VFS path → the resolved entity, plus (for a directory) its subtree. */
  private async resolveVfsPath(path: string, recursive: boolean, depth?: number): Promise<Set<string>> {
    const dirId = await this.resolveVfsPathToId(path)
    if (!dirId) return new Set()
    if (!recursive) {
      const set = new Set<string>([dirId])
      const rels = (await this.brain.getRelations({
        from: dirId,
        type: VerbType.Contains,
        limit: RELATION_FETCH_LIMIT
      })) as Relation[]
      for (const r of rels) set.add(r.to)
      return set
    }
    return this.resolveCollectionSubtree(dirId, depth)
  }

  /** Walk `Contains` from the VFS root, matching each path segment against `metadata.name`. */
  private async resolveVfsPathToId(path: string): Promise<string | null> {
    const segments = path.split('/').filter(Boolean)
    let currentId = VFS_ROOT_ID
    for (const seg of segments) {
      const rels = (await this.brain.getRelations({
        from: currentId,
        type: VerbType.Contains,
        limit: RELATION_FETCH_LIMIT
      })) as Relation[]
      let found: string | null = null
      for (const r of rels) {
        const child = await this.brain.get(r.to)
        if (child?.metadata?.name === seg) {
          found = r.to
          break
        }
      }
      if (!found) return null
      currentId = found
    }
    return currentId
  }

  /** True if an entity satisfies the selector's predicate keys. */
  private matchesPredicate(e: Entity, s: ExportSelector): boolean {
    if (s.type !== undefined) {
      const types = Array.isArray(s.type) ? s.type : [s.type]
      if (!types.includes(e.type)) return false
    }
    if (s.subtype !== undefined) {
      const subs = Array.isArray(s.subtype) ? s.subtype : [s.subtype]
      if (e.subtype === undefined || !subs.includes(e.subtype)) return false
    }
    if (s.service !== undefined && e.service !== s.service) return false
    if (s.visibility !== undefined) {
      const vis = (e as any).visibility ?? 'public'
      if (vis !== s.visibility) return false
    }
    if (s.where && !this.matchesWhere(e.metadata, s.where)) return false
    return true
  }

  /** Exact-match metadata predicate. */
  private matchesWhere(metadata: any, where: Record<string, any>): boolean {
    if (!metadata) return false
    for (const [key, value] of Object.entries(where)) {
      if (metadata[key] !== value) return false
    }
    return true
  }

  // ============================================================================
  // SERIALIZATION HELPERS (private)
  // ============================================================================

  /** Map a canonical `Entity` to a `BackupEntity` (reserved fields top-level). */
  private toBackupEntity(e: Entity, includeVectors: boolean): BackupEntity {
    const be: BackupEntity = { id: e.id, type: e.type as string }
    if (e.subtype !== undefined) be.subtype = e.subtype
    const vis = (e as any).visibility
    if (vis !== undefined && vis !== 'public') be.visibility = vis
    if (e.data !== undefined) be.data = e.data
    if (e.confidence !== undefined) be.confidence = e.confidence
    if (e.weight !== undefined) be.weight = e.weight
    if (e.service !== undefined) be.service = e.service
    if (e.createdBy !== undefined) be.createdBy = e.createdBy
    if (e.createdAt !== undefined) be.createdAt = e.createdAt
    if (includeVectors && e.vector && e.vector.length) be.vector = e.vector
    if (e.metadata && Object.keys(e.metadata).length) be.metadata = e.metadata
    return be
  }

  /** Map a canonical `Relation` to a `BackupRelation`. */
  private toBackupRelation(r: Relation): BackupRelation {
    const br: BackupRelation = { id: r.id, from: r.from, to: r.to, type: r.type as string }
    if (r.subtype !== undefined) br.subtype = r.subtype
    const vis = (r as any).visibility
    if (vis !== undefined && vis !== 'public') br.visibility = vis
    if (r.weight !== undefined) br.weight = r.weight
    if (r.confidence !== undefined) br.confidence = r.confidence
    if (r.metadata && Object.keys(r.metadata).length) br.metadata = r.metadata
    return br
  }

  /** Collect edges among the node set per the edge policy. */
  private async collectEdges(
    idSet: Set<string>,
    edges: 'induced' | 'incident' | 'none'
  ): Promise<{ relations: BackupRelation[]; danglingIds?: string[] }> {
    if (edges === 'none') return { relations: [] }

    const relations: BackupRelation[] = []
    const dangling = new Set<string>()
    const seen = new Set<string>()

    // Outgoing edges from each in-set node (captures every induced edge exactly once).
    for (const id of idSet) {
      const rels = (await this.brain.getRelations({ from: id, limit: RELATION_FETCH_LIMIT })) as Relation[]
      for (const r of rels) {
        if (seen.has(r.id)) continue
        const toIn = idSet.has(r.to)
        if (edges === 'induced' && !toIn) continue
        if (!toIn) dangling.add(r.to)
        seen.add(r.id)
        relations.push(this.toBackupRelation(r))
      }
    }

    // For 'incident', also capture edges arriving from outside the set.
    if (edges === 'incident') {
      for (const id of idSet) {
        const rels = (await this.brain.getRelations({ to: id, limit: RELATION_FETCH_LIMIT })) as Relation[]
        for (const r of rels) {
          if (seen.has(r.id)) continue
          if (!idSet.has(r.from)) {
            dangling.add(r.from)
            seen.add(r.id)
            relations.push(this.toBackupRelation(r))
          }
        }
      }
    }

    return dangling.size > 0 ? { relations, danglingIds: Array.from(dangling) } : { relations }
  }

  /** Read VFS file bytes (base64) for file entities, keyed by content hash. */
  private async collectBlobs(
    entities: BackupEntity[],
    entityMap: Map<string, Entity>
  ): Promise<Record<string, string>> {
    const blobs: Record<string, string> = {}
    const blobStorage = (this.storage as any).blobStorage
    if (!blobStorage?.read) return blobs

    for (const be of entities) {
      const e = entityMap.get(be.id) as any
      const storageMeta = e?.metadata?.storage
      const hash = storageMeta?.hash
      if (storageMeta?.type === 'blob' && hash && !blobs[hash]) {
        try {
          const buf = await blobStorage.read(hash)
          blobs[hash] = Buffer.from(buf).toString('base64')
        } catch {
          // Referenced blob bytes are unreadable (storage drift): skip — the file entity's
          // structure still travels, and stats.blobCount reflects what was actually captured.
        }
      }
    }
    return blobs
  }

  /** Best-effort embedding model label from the brain's configuration. */
  private detectModel(): string {
    return this.brain?.config?.embedding?.model || DEFAULT_EMBED_MODEL
  }

  /** Embedding dimensionality from the brain's configuration, if exposed. */
  private detectDimensions(): number | undefined {
    const dim = this.brain?.config?.dimensions ?? this.brain?.dimensions
    return typeof dim === 'number' ? dim : undefined
  }

  // ============================================================================
  // IMPORT HELPERS (private)
  // ============================================================================

  /** Existence check that never throws on id-format quirks (storage-layer read). */
  private async entityExists(id: string): Promise<boolean> {
    try {
      const meta = await this.storage.getNounMetadata(id)
      return !!meta
    } catch {
      return false
    }
  }

  /** `add()` params from a `BackupEntity` (excludes brain-managed fields like `createdAt`). */
  private entityAddFields(be: BackupEntity): Record<string, any> {
    const fields: Record<string, any> = {
      data: be.data,
      type: be.type as NounType
    }
    if (be.subtype !== undefined) fields.subtype = be.subtype
    if (be.service !== undefined) fields.service = be.service
    if (be.confidence !== undefined) fields.confidence = be.confidence
    if (be.weight !== undefined) fields.weight = be.weight
    if (be.metadata !== undefined) fields.metadata = be.metadata
    return fields
  }

  /** `update()` params from a `BackupEntity` (for `onConflict:'merge'`). */
  private entityUpdateFields(be: BackupEntity): Record<string, any> {
    const fields: Record<string, any> = {}
    if (be.data !== undefined) fields.data = be.data
    if (be.type !== undefined) fields.type = be.type as NounType
    if (be.subtype !== undefined) fields.subtype = be.subtype
    if (be.confidence !== undefined) fields.confidence = be.confidence
    if (be.weight !== undefined) fields.weight = be.weight
    if (be.metadata !== undefined) fields.metadata = be.metadata
    if (Array.isArray(be.vector) && be.vector.length) fields.vector = be.vector
    return fields
  }
}
