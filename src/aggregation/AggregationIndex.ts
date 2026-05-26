/**
 * AggregationIndex - Incremental Write-Time Aggregation Engine
 *
 * Maintains running totals on every add/update/delete for O(1) reads.
 * Follows the same pattern as MetadataIndexManager and GraphAdjacencyIndex.
 *
 * Key design decisions:
 * - Source matching reuses matchesMetadataFilter() from metadataFilter.ts
 * - Entities with service='brainy:aggregation' or metadata.__aggregate are
 *   skipped to prevent infinite loops (materialized entities feeding back)
 * - MIN/MAX on delete are set to NaN and lazy-recomputed on next query
 * - Persistence uses storage.saveMetadata() / storage.getMetadata()
 * - Delta detection hashes definitions; only changed aggregates rebuild on restart
 */

import type { StorageAdapter, HNSWNounWithMetadata } from '../coreTypes.js'
import { resolveEntityField } from '../coreTypes.js'
import type {
  AggregateDefinition,
  AggregateGroupState,
  AggregateQueryParams,
  AggregateResult,
  AggregationOp,
  AggregationProvider,
  GroupByDimension,
  MetricState
} from '../types/brainy.types.js'
import { matchesMetadataFilter } from '../utils/metadataFilter.js'
import { bucketTimestamp } from './timeWindows.js'
import { NounType } from '../types/graphTypes.js'

/** Persistence key for aggregate definitions */
const DEFINITIONS_KEY = '__aggregation_definitions__'

/** Prefix for per-aggregate state persistence keys */
const STATE_KEY_PREFIX = '__aggregation_state_'

/**
 * Serialize a group key map into a deterministic string for use as a Map key.
 */
function serializeGroupKey(groupKey: Record<string, string | number>): string {
  const sorted = Object.keys(groupKey).sort()
  return sorted.map(k => `${k}=${groupKey[k]}`).join('|')
}

/**
 * Hash an aggregate definition for change detection on restart.
 */
function hashDefinition(def: AggregateDefinition): string {
  // Deterministic JSON: sort keys
  const normalized = JSON.stringify({
    name: def.name,
    source: def.source,
    groupBy: def.groupBy,
    metrics: Object.keys(def.metrics).sort().map(k => [k, def.metrics[k]])
  })
  // Simple FNV-1a 32-bit hash
  let hash = 0x811c9dc5
  for (let i = 0; i < normalized.length; i++) {
    hash ^= normalized.charCodeAt(i)
    hash = (hash * 0x01000193) >>> 0
  }
  return hash.toString(16)
}

/**
 * Create a fresh MetricState with identity values.
 */
function freshMetricState(): MetricState {
  return { sum: 0, count: 0, min: Infinity, max: -Infinity, m2: 0 }
}

/**
 * Check whether an entity matches an aggregate's source filter.
 */
function matchesSource(entity: Record<string, unknown>, source: AggregateDefinition['source']): boolean {
  // Type filter
  if (source.type) {
    const entityType = entity.type ?? entity.noun
    const types = Array.isArray(source.type) ? source.type : [source.type]
    if (!types.includes(entityType as NounType)) return false
  }

  // Service filter
  if (source.service) {
    if (entity.service !== source.service) return false
  }

  // Metadata where filter — match against the entity's metadata sub-object
  if (source.where && Object.keys(source.where).length > 0) {
    const metadata = (entity.metadata ?? entity) as Record<string, unknown>
    if (!matchesMetadataFilter(metadata, source.where)) return false
  }

  return true
}

/**
 * Compute the group key for an entity given groupBy dimensions.
 *
 * Field lookups go through `resolveEntityField` to honor the
 * HNSWNounWithMetadata shape contract (standard fields top-level,
 * custom fields in metadata) in a single source of truth.
 */
/**
 * Compute the group key(s) an entity contributes to.
 *
 * Returns one key normally, but **multiple** when a groupBy dimension is an `unnest` field:
 * the entity contributes once per distinct array element (cartesian product across multiple
 * unnest dimensions). An entity whose unnest field is missing/empty contributes to no group
 * (returns `[]`). This is the fan-out behind tag-frequency style aggregates.
 */
function computeGroupKeys(
  entity: Record<string, unknown>,
  groupBy: GroupByDimension[]
): Record<string, string | number>[] {
  const e = entity as unknown as HNSWNounWithMetadata
  let keys: Record<string, string | number>[] = [{}]

  for (const dim of groupBy) {
    if (typeof dim === 'string') {
      const val = resolveEntityField(e, dim)
      const v = val !== undefined && val !== null ? String(val) : '__null__'
      for (const k of keys) k[dim] = v
    } else if ('unnest' in dim) {
      const val = resolveEntityField(e, dim.field)
      const raw = Array.isArray(val) ? val : val !== undefined && val !== null ? [val] : []
      // Distinct elements: an entity with duplicate tags counts once per distinct tag.
      const elems = Array.from(new Set(raw.map(x => String(x))))
      if (elems.length === 0) return [] // contributes to no group
      const next: Record<string, string | number>[] = []
      for (const k of keys) {
        for (const el of elems) next.push({ ...k, [dim.field]: el })
      }
      keys = next
    } else {
      // Time-windowed field
      const val = resolveEntityField(e, dim.field)
      const v = typeof val === 'number' ? bucketTimestamp(val, dim.window) : '__null__'
      for (const k of keys) k[dim.field] = v
    }
  }

  return keys
}

/**
 * Single representative group key (first of {@link computeGroupKeys}). Retained for the
 * materializer and back-compat; the incremental contribution paths use `computeGroupKeys`
 * so unnest dimensions fan out correctly.
 */
function computeGroupKey(
  entity: Record<string, unknown>,
  groupBy: GroupByDimension[]
): Record<string, string | number> {
  return computeGroupKeys(entity, groupBy)[0] ?? {}
}

/**
 * Get the numeric value of a field from an entity (for metric computation).
 *
 * Routes through `resolveEntityField` so standard top-level numeric fields
 * (weight, confidence, createdAt, updatedAt) and custom user numeric fields
 * in metadata are both handled in one place.
 */
function getNumericField(entity: Record<string, unknown>, field: string): number | undefined {
  const val = resolveEntityField(entity as unknown as HNSWNounWithMetadata, field)
  if (typeof val === 'number' && !isNaN(val)) return val
  if (typeof val === 'string') {
    const num = parseFloat(val)
    if (!isNaN(num)) return num
  }
  return undefined
}

/**
 * Check if an entity is a materialized aggregate entity (to prevent infinite loops).
 */
function isAggregateEntity(entity: Record<string, unknown>): boolean {
  if (entity.service === 'brainy:aggregation') return true
  const metadata = (entity.metadata ?? {}) as Record<string, unknown>
  if (metadata.__aggregate) return true
  return false
}

/**
 * Welford's online algorithm: add a value to running mean/M2.
 */
function updateMetricAdd(state: MetricState, val: number, op: AggregationOp): void {
  state.sum += val
  state.count++
  if (val < state.min) state.min = val
  if (val > state.max) state.max = val

  // Welford's: update M2 for stddev/variance
  if (op === 'stddev' || op === 'variance') {
    const mean = state.sum / state.count
    const oldMean = state.count > 1 ? (state.sum - val) / (state.count - 1) : 0
    state.m2 = (state.m2 ?? 0) + (val - oldMean) * (val - mean)
  }
}

/**
 * Welford's online algorithm: remove a value from running mean/M2.
 * Note: removing from Welford's is the inverse update.
 */
function updateMetricRemove(state: MetricState, val: number, op: AggregationOp): void {
  if (state.count <= 1) {
    state.sum = 0
    state.count = 0
    state.m2 = 0
    return
  }
  const oldMean = state.sum / state.count
  state.sum -= val
  state.count--
  const newMean = state.sum / state.count

  if (op === 'stddev' || op === 'variance') {
    state.m2 = Math.max(0, (state.m2 ?? 0) - (val - oldMean) * (val - newMean))
  }
}

export class AggregationIndex {
  private storage: StorageAdapter
  private nativeProvider?: AggregationProvider

  /** Registered aggregate definitions keyed by name */
  private definitions = new Map<string, AggregateDefinition>()

  /** Hashes of definitions for change detection */
  private definitionHashes = new Map<string, string>()

  /** Per-aggregate group states: Map<aggName, Map<serializedGroupKey, AggregateGroupState>> */
  private states = new Map<string, Map<string, AggregateGroupState>>()

  /** Track which aggregates have dirty state needing persistence */
  private dirty = new Set<string>()

  /**
   * Aggregates whose state must be backfilled from entities that already existed
   * when the aggregate was defined (or whose persisted state was missing/stale at
   * init). Write-time hooks only capture entities added *after* a definition, so
   * without backfill an aggregate defined over a populated store stays empty.
   * Drained by the owner (Brainy) which has the entity iterator; see `getPendingBackfills`.
   */
  private needsBackfill = new Set<string>()

  /** Track aggregates with stale MIN/MAX (need lazy recompute) */
  private staleMinMax = new Map<string, Set<string>>()

  constructor(storage: StorageAdapter, nativeProvider?: AggregationProvider) {
    this.storage = storage
    this.nativeProvider = nativeProvider
  }

  // ============= Lifecycle =============

  /**
   * Initialize: load persisted definitions and state, detect changes, rebuild stale.
   */
  async init(): Promise<void> {
    // Load persisted definitions
    const savedDefs = await this.storage.getMetadata(DEFINITIONS_KEY) as any
    if (savedDefs && typeof savedDefs === 'object' && savedDefs.definitions) {
      const defs = savedDefs.definitions as Array<AggregateDefinition & { _hash?: string }>

      for (const def of defs) {
        this.definitions.set(def.name, def)
        const currentHash = hashDefinition(def)
        const savedHash = def._hash || ''

        // Load persisted state
        const stateData = await this.storage.getMetadata(`${STATE_KEY_PREFIX}${def.name}__`) as any
        if (stateData && stateData.groups && savedHash === currentHash) {
          // Definition unchanged — load state
          const groupMap = new Map<string, AggregateGroupState>()
          for (const group of stateData.groups as AggregateGroupState[]) {
            const serialized = serializeGroupKey(group.groupKey)
            groupMap.set(serialized, group)
          }
          this.states.set(def.name, groupMap)
        } else {
          // Definition changed or no saved state — start fresh and backfill from
          // existing entities (the owner drains needsBackfill on first query).
          this.states.set(def.name, new Map())
          this.needsBackfill.add(def.name)
        }

        this.definitionHashes.set(def.name, currentHash)

        // Register definition with native provider
        if (this.nativeProvider?.defineAggregate) {
          this.nativeProvider.defineAggregate(def)
        }
      }
    }

    // Restore native provider state from persistence
    if (this.nativeProvider?.restoreState) {
      const nativeState = await this.storage.getMetadata('__aggregation_native_state__') as any
      if (nativeState && typeof nativeState === 'string') {
        this.nativeProvider.restoreState(nativeState)
      } else if (nativeState && typeof nativeState === 'object' && nativeState.data) {
        this.nativeProvider.restoreState(nativeState.data)
      }
    }
  }

  /**
   * Persist all dirty aggregate state to storage.
   */
  async flush(): Promise<void> {
    // Persist definitions
    const defsToSave = Array.from(this.definitions.values()).map(def => ({
      ...def,
      _hash: this.definitionHashes.get(def.name)
    }))
    await this.storage.saveMetadata(DEFINITIONS_KEY, { definitions: defsToSave } as any)

    // Persist dirty states
    for (const name of this.dirty) {
      const stateMap = this.states.get(name)
      if (stateMap) {
        const groups = Array.from(stateMap.values())
        await this.storage.saveMetadata(
          `${STATE_KEY_PREFIX}${name}__`,
          { groups } as any
        )
      }
    }

    // Persist native provider state
    if (this.nativeProvider?.serializeState) {
      const nativeState = this.nativeProvider.serializeState()
      await this.storage.saveMetadata(
        '__aggregation_native_state__',
        { data: nativeState } as any
      )
    }

    this.dirty.clear()
  }

  /**
   * Flush and release resources.
   */
  async close(): Promise<void> {
    await this.flush()
  }

  // ============= Definition Management =============

  /**
   * Register a new aggregate definition. Persisted on next flush().
   */
  defineAggregate(def: AggregateDefinition): void {
    if (!def.name) throw new Error('Aggregate definition requires a name')
    if (!def.groupBy || def.groupBy.length === 0) throw new Error('Aggregate definition requires at least one groupBy dimension')
    if (!def.metrics || Object.keys(def.metrics).length === 0) throw new Error('Aggregate definition requires at least one metric')

    // Validate metric definitions
    for (const [name, metric] of Object.entries(def.metrics)) {
      if (metric.op !== 'count' && !metric.field) {
        throw new Error(`Metric '${name}' with op '${metric.op}' requires a 'field' property`)
      }
    }

    const newHash = hashDefinition(def)
    const oldHash = this.definitionHashes.get(def.name)

    this.definitions.set(def.name, def)
    this.definitionHashes.set(def.name, newHash)

    // Reset state if definition changed or doesn't exist yet, and flag it for
    // backfill so already-stored entities are counted (write-time hooks only see
    // future writes). The owner drains this on the next query via getPendingBackfills().
    if (!this.states.has(def.name) || (oldHash && oldHash !== newHash)) {
      this.states.set(def.name, new Map())
      this.needsBackfill.add(def.name)
    }

    // Notify native provider of definition (caches compiled form for hot path)
    if (this.nativeProvider?.defineAggregate) {
      this.nativeProvider.defineAggregate(def)
    }

    this.dirty.add(def.name)
  }

  /**
   * Remove an aggregate definition and its state.
   */
  removeAggregate(name: string): void {
    this.definitions.delete(name)
    this.definitionHashes.delete(name)
    this.states.delete(name)
    this.staleMinMax.delete(name)

    // Notify native provider
    if (this.nativeProvider?.removeAggregate) {
      this.nativeProvider.removeAggregate(name)
    }

    this.dirty.add(name) // Will persist the removal
  }

  /**
   * Get all registered aggregate definitions.
   */
  getDefinitions(): AggregateDefinition[] {
    return Array.from(this.definitions.values())
  }

  /**
   * Check if an aggregate exists.
   */
  hasAggregate(name: string): boolean {
    return this.definitions.has(name)
  }

  // ============= Backfill =============
  //
  // Write-time hooks only capture entities added after a definition exists, so an
  // aggregate defined over a populated store would stay empty. The owner (Brainy) has
  // the entity iterator, so backfill is driven from there: it reads the pending set,
  // clears the aggregate, streams every existing entity through `backfillEntity`, then
  // calls `finishBackfill`. Clearing first means a concurrent write that landed via the
  // incremental hook is wiped and re-counted exactly once by the rescan.

  /** Names of aggregates whose state must be (re)built from existing entities. */
  getPendingBackfills(): string[] {
    return Array.from(this.needsBackfill)
  }

  /** Clear an aggregate's state so a full rescan cannot double-count. */
  beginBackfill(name: string): void {
    this.states.set(name, new Map())
    // Reset native provider state for this aggregate too, if present.
    const def = this.definitions.get(name)
    if (def && this.nativeProvider?.removeAggregate && this.nativeProvider?.defineAggregate) {
      this.nativeProvider.removeAggregate(name)
      this.nativeProvider.defineAggregate(def)
    }
  }

  /** Feed one already-stored entity into a single aggregate during backfill. */
  backfillEntity(name: string, entity: Record<string, unknown>): void {
    if (isAggregateEntity(entity)) return
    const def = this.definitions.get(name)
    if (!def || !matchesSource(entity, def.source)) return

    if (this.nativeProvider) {
      this.applyNativeResults(name, this.nativeProvider.incrementalUpdate(name, def, entity, 'add'))
    } else {
      this.addContribution(name, def, entity)
    }
  }

  /** Mark an aggregate's backfill complete; rebuilt state persists on next flush(). */
  finishBackfill(name: string): void {
    this.needsBackfill.delete(name)
    this.dirty.add(name)
  }

  // ============= Write-Time Hooks =============

  /**
   * Called when an entity is added. Updates all matching aggregates.
   */
  onEntityAdded(id: string, entity: Record<string, unknown>): void {
    if (isAggregateEntity(entity)) return

    for (const [name, def] of this.definitions) {
      if (!matchesSource(entity, def.source)) continue

      if (this.nativeProvider) {
        const results = this.nativeProvider.incrementalUpdate(name, def, entity, 'add')
        this.applyNativeResults(name, results)
        continue
      }

      // Shared with onEntityUpdated/backfill; fans out unnest dimensions to N groups.
      this.addContribution(name, def, entity)
    }
  }

  /**
   * Called when an entity is updated. Reverses old contribution and applies new.
   */
  onEntityUpdated(
    id: string,
    newEntity: Record<string, unknown>,
    oldEntity: Record<string, unknown>
  ): void {
    if (isAggregateEntity(newEntity)) return

    for (const [name, def] of this.definitions) {
      const oldMatches = matchesSource(oldEntity, def.source)
      const newMatches = matchesSource(newEntity, def.source)

      if (this.nativeProvider && (oldMatches || newMatches)) {
        const results = this.nativeProvider.incrementalUpdate(name, def, newEntity, 'update', oldEntity)
        this.applyNativeResults(name, results)
        continue
      }

      // If old matched, remove its contribution
      if (oldMatches) {
        this.removeContribution(name, def, oldEntity)
      }

      // If new matches, add its contribution
      if (newMatches) {
        this.addContribution(name, def, newEntity)
      }
    }
  }

  /**
   * Called when an entity is deleted. Reverses its contribution.
   */
  onEntityDeleted(id: string, entity: Record<string, unknown>): void {
    if (isAggregateEntity(entity)) return

    for (const [name, def] of this.definitions) {
      if (!matchesSource(entity, def.source)) continue

      if (this.nativeProvider) {
        const results = this.nativeProvider.incrementalUpdate(name, def, entity, 'delete')
        this.applyNativeResults(name, results)
        continue
      }

      this.removeContribution(name, def, entity)
    }
  }

  // ============= Query =============

  /**
   * Query aggregate results with optional filtering, sorting, and pagination.
   */
  queryAggregate(params: AggregateQueryParams): AggregateResult[] {
    const def = this.definitions.get(params.name)
    if (!def) throw new Error(`Aggregate '${params.name}' not found`)

    const stateMap = this.states.get(params.name)
    if (!stateMap) return []

    if (this.nativeProvider) {
      return this.nativeProvider.queryAggregate(stateMap, params)
    }

    // Collect all groups
    let results: AggregateResult[] = []

    for (const group of stateMap.values()) {
      // Skip empty groups (all metrics at zero count)
      const hasData = Object.values(group.metrics).some(m => m.count > 0)
      if (!hasData) continue

      // Apply where filter on group keys
      if (params.where && Object.keys(params.where).length > 0) {
        if (!matchesMetadataFilter(group.groupKey as any, params.where)) continue
      }

      // Compute result metrics from running state
      const metrics: Record<string, number> = {}
      let totalCount = 0

      for (const [metricName, metricDef] of Object.entries(def.metrics)) {
        const state = group.metrics[metricName]
        if (!state) continue

        switch (metricDef.op) {
          case 'count':
            metrics[metricName] = state.count
            break
          case 'sum':
            metrics[metricName] = state.sum
            break
          case 'avg':
            metrics[metricName] = state.count > 0 ? state.sum / state.count : 0
            break
          case 'min':
            metrics[metricName] = state.min === Infinity ? 0 : state.min
            break
          case 'max':
            metrics[metricName] = state.max === -Infinity ? 0 : state.max
            break
          case 'variance':
            metrics[metricName] = state.count > 1 ? (state.m2 ?? 0) / (state.count - 1) : 0
            break
          case 'stddev':
            metrics[metricName] = state.count > 1 ? Math.sqrt((state.m2 ?? 0) / (state.count - 1)) : 0
            break
        }

        if (metricDef.op === 'count') {
          totalCount = Math.max(totalCount, state.count)
        } else {
          totalCount = Math.max(totalCount, state.count)
        }
      }

      // HAVING: filter groups by computed metric values (post-compute, O(groups), before
      // sort/pagination). Reuses the where-operator engine over metrics + `count`.
      if (params.having && Object.keys(params.having).length > 0) {
        if (!matchesMetadataFilter({ ...metrics, count: totalCount } as any, params.having)) continue
      }

      results.push({
        groupKey: { ...group.groupKey },
        metrics,
        count: totalCount,
        entityId: group.materializedEntityId
      })
    }

    // Sort
    if (params.orderBy) {
      const field = params.orderBy
      const dir = params.order === 'desc' ? -1 : 1
      results.sort((a, b) => {
        // Try metrics first, then groupKey
        const aVal = a.metrics[field] ?? a.groupKey[field] ?? 0
        const bVal = b.metrics[field] ?? b.groupKey[field] ?? 0
        if (typeof aVal === 'number' && typeof bVal === 'number') {
          return (aVal - bVal) * dir
        }
        return String(aVal).localeCompare(String(bVal)) * dir
      })
    }

    // Pagination
    const offset = params.offset || 0
    const limit = params.limit || results.length
    results = results.slice(offset, offset + limit)

    return results
  }

  /**
   * Get internal state for a named aggregate (for materialization and testing).
   */
  getState(name: string): Map<string, AggregateGroupState> | undefined {
    return this.states.get(name)
  }

  // ============= Internal Helpers =============

  /**
   * Add an entity's contribution to its matching group in a named aggregate.
   */
  private addContribution(
    aggName: string,
    def: AggregateDefinition,
    entity: Record<string, unknown>
  ): void {
    const stateMap = this.states.get(aggName)!

    // Fan out: an unnest dimension makes one entity contribute to several groups.
    for (const groupKey of computeGroupKeys(entity, def.groupBy)) {
      const serialized = serializeGroupKey(groupKey)
      let group = stateMap.get(serialized)

      if (!group) {
        group = {
          groupKey,
          metrics: {},
          lastUpdated: Date.now()
        }
        for (const metricName of Object.keys(def.metrics)) {
          group.metrics[metricName] = freshMetricState()
        }
        stateMap.set(serialized, group)
      }

      for (const [metricName, metricDef] of Object.entries(def.metrics)) {
        const state = group.metrics[metricName]
        if (metricDef.op === 'count') {
          state.count++
          state.sum++
        } else {
          const val = getNumericField(entity, metricDef.field!)
          if (val !== undefined) {
            updateMetricAdd(state, val, metricDef.op)
          }
        }
      }

      group.lastUpdated = Date.now()
    }

    this.dirty.add(aggName)
  }

  /**
   * Remove an entity's contribution from its matching group.
   * For MIN/MAX, marks as stale since we can't incrementally reverse these.
   */
  private removeContribution(
    aggName: string,
    def: AggregateDefinition,
    entity: Record<string, unknown>
  ): void {
    const stateMap = this.states.get(aggName)!

    // Fan out: reverse the entity's contribution from every group it joined.
    for (const groupKey of computeGroupKeys(entity, def.groupBy)) {
      const serialized = serializeGroupKey(groupKey)
      const group = stateMap.get(serialized)
      if (!group) continue

      for (const [metricName, metricDef] of Object.entries(def.metrics)) {
        const state = group.metrics[metricName]
        if (metricDef.op === 'count') {
          state.count = Math.max(0, state.count - 1)
          state.sum = Math.max(0, state.sum - 1)
        } else {
          const val = getNumericField(entity, metricDef.field!)
          if (val !== undefined) {
            updateMetricRemove(state, val, metricDef.op)

            // MIN/MAX can't be decremented — mark as potentially stale
            if (val <= state.min || val >= state.max) {
              if (!this.staleMinMax.has(aggName)) {
                this.staleMinMax.set(aggName, new Set())
              }
              this.staleMinMax.get(aggName)!.add(`${serialized}:${metricName}`)
            }
          }
        }
      }

      // Remove group if all metrics are empty
      const allEmpty = Object.values(group.metrics).every(m => m.count === 0)
      if (allEmpty) {
        stateMap.delete(serialized)
      } else {
        group.lastUpdated = Date.now()
      }
    }

    this.dirty.add(aggName)
  }

  /**
   * Apply results from native provider back into the state maps.
   */
  private applyNativeResults(aggName: string, results: AggregateGroupState[]): void {
    const stateMap = this.states.get(aggName)!
    for (const group of results) {
      const serialized = serializeGroupKey(group.groupKey)
      stateMap.set(serialized, group)
    }
    this.dirty.add(aggName)
  }
}

// Export helper for use by materializer
export { serializeGroupKey, computeGroupKey, matchesSource, isAggregateEntity }
