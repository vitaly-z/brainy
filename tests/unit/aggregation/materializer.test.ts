import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { AggregateMaterializer, MaterializerBrainAccess } from '../../../src/aggregation/materializer'
import { NounType } from '../../../src/types/graphTypes'
import type { AggregateDefinition, AggregateGroupState, MetricState } from '../../../src/types/brainy.types'

/**
 * Creates a mock brain access object for testing materialization
 * without a full Brainy instance.
 */
function createMockBrain(): MaterializerBrainAccess & {
  adds: Array<{ data: string; type: NounType; metadata: Record<string, unknown>; id?: string; service?: string }>
  updates: Array<{ id: string; data?: string; metadata?: Record<string, unknown>; merge?: boolean }>
} {
  const adds: any[] = []
  const updates: any[] = []
  return {
    adds,
    updates,
    async add(params) {
      adds.push(params)
      return `mat-${adds.length}`
    },
    async update(params) {
      updates.push(params)
    }
  }
}

function createGroupState(
  groupKey: Record<string, string | number>,
  metrics: Record<string, MetricState>,
  materializedEntityId?: string
): AggregateGroupState {
  return {
    groupKey,
    metrics,
    materializedEntityId,
    lastUpdated: Date.now()
  }
}

function createMetricState(sum: number, count: number, min: number, max: number): MetricState {
  return { sum, count, min, max }
}

describe('AggregateMaterializer', () => {
  let brain: ReturnType<typeof createMockBrain>
  let materializer: AggregateMaterializer

  const definition: AggregateDefinition = {
    name: 'spending',
    source: { type: NounType.Event },
    groupBy: ['category'],
    metrics: {
      total: { op: 'sum', field: 'amount' },
      count: { op: 'count' },
      average: { op: 'avg', field: 'amount' },
      highest: { op: 'max', field: 'amount' },
      lowest: { op: 'min', field: 'amount' }
    },
    materialize: true
  }

  beforeEach(() => {
    vi.useFakeTimers()
    brain = createMockBrain()
    materializer = new AggregateMaterializer(brain, 100) // 100ms debounce for tests
  })

  afterEach(() => {
    materializer.close()
    vi.useRealTimers()
  })

  it('should create a Measurement entity on first materialization', async () => {
    const groupState = createGroupState(
      { category: 'food' },
      {
        total: createMetricState(150, 3, 10, 80),
        count: createMetricState(3, 3, Infinity, -Infinity),
        average: createMetricState(150, 3, 10, 80),
        highest: createMetricState(150, 3, 10, 80),
        lowest: createMetricState(150, 3, 10, 80)
      }
    )

    materializer.scheduleMaterialize('spending', definition, { category: 'food' }, groupState)

    // Should not have fired yet (debounced)
    expect(brain.adds).toHaveLength(0)

    // Advance timers past debounce
    await vi.advanceTimersByTimeAsync(150)

    expect(brain.adds).toHaveLength(1)
    const added = brain.adds[0]
    expect(added.type).toBe('measurement')
    expect(added.service).toBe('brainy:aggregation')
    expect(added.metadata.__aggregate).toBe('spending')
    expect(added.metadata.category).toBe('food')
    expect(added.metadata.total).toBe(150)
    expect(added.metadata.count).toBe(3)
    expect(added.metadata.average).toBe(50)
    expect(added.metadata.highest).toBe(80)
    expect(added.metadata.lowest).toBe(10)
    expect(added.data).toContain('spending:')
    expect(added.data).toContain('category=food')
  })

  it('should update existing entity when materializedEntityId is set', async () => {
    const groupState = createGroupState(
      { category: 'food' },
      {
        total: createMetricState(200, 4, 10, 100),
        count: createMetricState(4, 4, Infinity, -Infinity)
      },
      'existing-entity-id'
    )

    materializer.scheduleMaterialize('spending', definition, { category: 'food' }, groupState)
    await vi.advanceTimersByTimeAsync(150)

    expect(brain.adds).toHaveLength(0)
    expect(brain.updates).toHaveLength(1)
    expect(brain.updates[0].id).toBe('existing-entity-id')
    expect(brain.updates[0].metadata!.total).toBe(200)
  })

  it('should debounce rapid updates', async () => {
    const groupState1 = createGroupState(
      { category: 'food' },
      { total: createMetricState(100, 1, 100, 100), count: createMetricState(1, 1, Infinity, -Infinity) }
    )
    const groupState2 = createGroupState(
      { category: 'food' },
      { total: createMetricState(200, 2, 50, 150), count: createMetricState(2, 2, Infinity, -Infinity) }
    )

    materializer.scheduleMaterialize('spending', definition, { category: 'food' }, groupState1)
    await vi.advanceTimersByTimeAsync(50)
    materializer.scheduleMaterialize('spending', definition, { category: 'food' }, groupState2)
    await vi.advanceTimersByTimeAsync(150)

    // Only the second (latest) state should be materialized
    expect(brain.adds).toHaveLength(1)
    expect(brain.adds[0].metadata.total).toBe(200)
  })

  it('should not materialize when materialize=false', async () => {
    const defNoMat: AggregateDefinition = {
      ...definition,
      materialize: false
    }
    const groupState = createGroupState(
      { category: 'food' },
      { total: createMetricState(100, 1, 100, 100) }
    )

    materializer.scheduleMaterialize('spending', defNoMat, { category: 'food' }, groupState)
    await vi.advanceTimersByTimeAsync(150)

    expect(brain.adds).toHaveLength(0)
  })

  it('should not materialize when materialize=undefined', async () => {
    const defNoMat: AggregateDefinition = {
      ...definition,
      materialize: undefined
    }
    const groupState = createGroupState(
      { category: 'food' },
      { total: createMetricState(100, 1, 100, 100) }
    )

    materializer.scheduleMaterialize('spending', defNoMat, { category: 'food' }, groupState)
    await vi.advanceTimersByTimeAsync(150)

    expect(brain.adds).toHaveLength(0)
  })

  describe('flush', () => {
    it('should immediately materialize all pending entries', async () => {
      const groupState = createGroupState(
        { category: 'food' },
        { total: createMetricState(100, 1, 100, 100), count: createMetricState(1, 1, Infinity, -Infinity) }
      )

      materializer.scheduleMaterialize('spending', definition, { category: 'food' }, groupState)
      expect(brain.adds).toHaveLength(0)

      await materializer.flush()

      expect(brain.adds).toHaveLength(1)
    })
  })

  describe('close', () => {
    it('should cancel pending timers without materializing', async () => {
      const groupState = createGroupState(
        { category: 'food' },
        { total: createMetricState(100, 1, 100, 100) }
      )

      materializer.scheduleMaterialize('spending', definition, { category: 'food' }, groupState)
      materializer.close()

      await vi.advanceTimersByTimeAsync(200)
      expect(brain.adds).toHaveLength(0)
    })
  })
})
