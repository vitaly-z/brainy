/**
 * AggregateMaterializer - Writes aggregate results as NounType.Measurement entities
 *
 * Converts aggregate group states into Brainy entities that are automatically
 * visible in OData, Google Sheets, SSE, and webhook integrations.
 *
 * Uses debouncing to avoid excessive writes during high-throughput ingestion.
 */

import type { NounType } from '../types/graphTypes.js'
import type {
  AggregateDefinition,
  AggregateGroupState,
  AggregateMetricDef
} from '../types/brainy.types.js'
import { serializeGroupKey } from './AggregationIndex.js'

/**
 * Callback interface for the materializer to create/update Brainy entities.
 * This avoids a direct dependency on the Brainy class (breaks circular deps).
 */
export interface MaterializerBrainAccess {
  add(params: {
    data: string
    type: NounType
    metadata: Record<string, unknown>
    id?: string
    service?: string
  }): Promise<string>

  update(params: {
    id: string
    data?: string
    metadata?: Record<string, unknown>
    merge?: boolean
  }): Promise<void>
}

interface PendingMaterialization {
  aggName: string
  definition: AggregateDefinition
  groupKey: Record<string, string | number>
  groupState: AggregateGroupState
}

const DEFAULT_DEBOUNCE_MS = 1000

export class AggregateMaterializer {
  private brain: MaterializerBrainAccess
  private pending = new Map<string, PendingMaterialization>()
  private debounceTimers = new Map<string, ReturnType<typeof setTimeout>>()
  private defaultDebounceMs: number
  private flushing = false

  constructor(brain: MaterializerBrainAccess, debounceMs?: number) {
    this.brain = brain
    this.defaultDebounceMs = debounceMs ?? DEFAULT_DEBOUNCE_MS
  }

  /**
   * Schedule a group to be materialized as a Measurement entity.
   * Debounces writes to avoid thrashing during batch ingestion.
   */
  scheduleMaterialize(
    aggName: string,
    definition: AggregateDefinition,
    groupKey: Record<string, string | number>,
    groupState: AggregateGroupState
  ): void {
    const materializeConfig = definition.materialize
    if (materializeConfig === false || materializeConfig === undefined) return

    const debounceMs = typeof materializeConfig === 'object'
      ? (materializeConfig.debounceMs ?? this.defaultDebounceMs)
      : this.defaultDebounceMs

    const key = `${aggName}:${serializeGroupKey(groupKey)}`

    this.pending.set(key, { aggName, definition, groupKey, groupState })

    // Reset debounce timer
    const existing = this.debounceTimers.get(key)
    if (existing) clearTimeout(existing)

    this.debounceTimers.set(key, setTimeout(() => {
      this.materializeOne(key).catch(() => {
        // Non-fatal — materialization is derived data
      })
    }, debounceMs))
  }

  /**
   * Flush all pending materializations immediately.
   */
  async flush(): Promise<void> {
    if (this.flushing) return
    this.flushing = true

    try {
      // Cancel all timers
      for (const timer of this.debounceTimers.values()) {
        clearTimeout(timer)
      }
      this.debounceTimers.clear()

      // Process all pending
      const entries = Array.from(this.pending.entries())
      this.pending.clear()

      await Promise.all(entries.map(([key, entry]) => this.doMaterialize(entry)))
    } finally {
      this.flushing = false
    }
  }

  /**
   * Cancel all pending timers and discard pending materializations.
   */
  close(): void {
    for (const timer of this.debounceTimers.values()) {
      clearTimeout(timer)
    }
    this.debounceTimers.clear()
    this.pending.clear()
  }

  // ============= Internal =============

  private async materializeOne(key: string): Promise<void> {
    const entry = this.pending.get(key)
    if (!entry) return
    this.pending.delete(key)
    this.debounceTimers.delete(key)
    await this.doMaterialize(entry)
  }

  private async doMaterialize(entry: PendingMaterialization): Promise<void> {
    const { aggName, definition, groupKey, groupState } = entry

    // Compute metric values for the materialized entity
    const metricValues: Record<string, number> = {}
    let totalCount = 0

    for (const [metricName, metricDef] of Object.entries(definition.metrics)) {
      const state = groupState.metrics[metricName]
      if (!state) continue

      switch (metricDef.op) {
        case 'count':
          metricValues[metricName] = state.count
          break
        case 'sum':
          metricValues[metricName] = state.sum
          break
        case 'avg':
          metricValues[metricName] = state.count > 0 ? Math.round((state.sum / state.count) * 100) / 100 : 0
          break
        case 'min':
          metricValues[metricName] = state.min === Infinity ? 0 : state.min
          break
        case 'max':
          metricValues[metricName] = state.max === -Infinity ? 0 : state.max
          break
      }

      totalCount = Math.max(totalCount, state.count)
    }

    // Build human-readable data string
    const groupKeyStr = Object.entries(groupKey)
      .map(([k, v]) => `${k}=${v}`)
      .join(', ')
    const metricsStr = Object.entries(metricValues)
      .map(([k, v]) => `${k}=${v}`)
      .join(', ')
    const dataString = `${aggName}: ${groupKeyStr} -- ${metricsStr}`

    // Build metadata
    const metadata: Record<string, unknown> = {
      __aggregate: aggName,
      __aggregateGroup: serializeGroupKey(groupKey),
      ...groupKey,
      ...metricValues,
      lastUpdated: Date.now()
    }

    const existingId = groupState.materializedEntityId

    if (existingId) {
      // Update existing materialized entity
      await this.brain.update({
        id: existingId,
        data: dataString,
        metadata,
        merge: false
      })
    } else {
      // Create new materialized entity
      // NounType.Measurement = 'measurement'
      const id = await this.brain.add({
        data: dataString,
        type: 'measurement' as NounType,
        metadata,
        service: 'brainy:aggregation'
      })
      groupState.materializedEntityId = id
    }
  }
}
