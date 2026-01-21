/**
 * Integration Hub - Event Bus
 *
 * Central event emitter for real-time change propagation.
 * Enables integrations to react to Brainy data changes.
 */

import {
  BrainyEvent,
  EventFilter,
  EventHandler,
  EventSubscription
} from './types.js'
import { Entity, Relation } from '../../types/brainy.types.js'
import { NounType, VerbType } from '../../types/graphTypes.js'

/**
 * Central event bus for real-time Brainy events
 *
 * Features:
 * - Pub/sub pattern for event distribution
 * - Filtering by entity type, operation, noun/verb types
 * - Sequence IDs for ordering and resumption
 * - Optional event buffering for batch processing
 * - Memory-efficient circular buffer for replay
 *
 * @example
 * ```typescript
 * const eventBus = new EventBus()
 *
 * // Subscribe to all noun creates
 * eventBus.subscribe(
 *   { entityTypes: ['noun'], operations: ['create'] },
 *   (event) => console.log('New entity:', event.entityId)
 * )
 *
 * // Emit event
 * eventBus.emit({
 *   entityType: 'noun',
 *   operation: 'create',
 *   entityId: 'entity-123',
 *   nounType: NounType.Person
 * })
 * ```
 */
export class EventBus {
  private subscriptions: Map<
    string,
    { filter: EventFilter; handler: EventHandler }
  > = new Map()
  private sequenceCounter: bigint = 0n
  private eventBuffer: BrainyEvent[] = []
  private bufferSize: number
  private subscriptionIdCounter = 0

  /**
   * Create a new EventBus
   *
   * @param options Configuration options
   * @param options.bufferSize Size of replay buffer (default: 1000)
   */
  constructor(options: { bufferSize?: number } = {}) {
    this.bufferSize = options.bufferSize ?? 1000
  }

  /**
   * Subscribe to events matching a filter
   *
   * @param filter Event filter criteria
   * @param handler Function to call when matching events occur
   * @returns Subscription that can be used to unsubscribe
   */
  subscribe(filter: EventFilter, handler: EventHandler): EventSubscription {
    const id = `sub-${++this.subscriptionIdCounter}`

    this.subscriptions.set(id, { filter, handler })

    // If filter has 'since', replay buffered events
    if (filter.since !== undefined) {
      this.replayEvents(filter, handler)
    }

    return {
      id,
      unsubscribe: () => {
        this.subscriptions.delete(id)
      }
    }
  }

  /**
   * Emit an event to all matching subscribers
   *
   * @param partialEvent Event data (id, timestamp, sequenceId auto-generated)
   */
  emit(
    partialEvent: Omit<BrainyEvent, 'id' | 'timestamp' | 'sequenceId'>
  ): BrainyEvent {
    const event: BrainyEvent = {
      ...partialEvent,
      id: this.generateEventId(),
      timestamp: Date.now(),
      sequenceId: ++this.sequenceCounter
    }

    // Add to buffer
    this.addToBuffer(event)

    // Dispatch to matching subscribers
    this.dispatch(event)

    return event
  }

  /**
   * Emit a noun event
   */
  emitNoun(
    operation: 'create' | 'update' | 'delete',
    entityId: string,
    nounType: NounType,
    options?: { service?: string; data?: Entity }
  ): BrainyEvent {
    return this.emit({
      entityType: 'noun',
      operation,
      entityId,
      nounType,
      service: options?.service,
      data: options?.data
    })
  }

  /**
   * Emit a verb/relation event
   */
  emitVerb(
    operation: 'create' | 'update' | 'delete',
    entityId: string,
    verbType: VerbType,
    options?: { service?: string; data?: Relation }
  ): BrainyEvent {
    return this.emit({
      entityType: 'verb',
      operation,
      entityId,
      verbType,
      service: options?.service,
      data: options?.data
    })
  }

  /**
   * Emit a VFS event
   */
  emitVFS(
    operation: 'create' | 'update' | 'delete',
    entityId: string,
    options?: { service?: string; data?: Entity }
  ): BrainyEvent {
    return this.emit({
      entityType: 'vfs',
      operation,
      entityId,
      service: options?.service,
      data: options?.data
    })
  }

  /**
   * Get current sequence ID for resumption
   */
  getCurrentSequenceId(): bigint {
    return this.sequenceCounter
  }

  /**
   * Get events since a sequence ID (from buffer)
   */
  getEventsSince(sequenceId: bigint): BrainyEvent[] {
    return this.eventBuffer.filter((event) => event.sequenceId > sequenceId)
  }

  /**
   * Get subscription count
   */
  getSubscriptionCount(): number {
    return this.subscriptions.size
  }

  /**
   * Clear all subscriptions
   */
  clear(): void {
    this.subscriptions.clear()
    this.eventBuffer = []
    this.sequenceCounter = 0n
  }

  /**
   * Check if an event matches a filter
   */
  private matchesFilter(event: BrainyEvent, filter: EventFilter): boolean {
    // Check entity types
    if (
      filter.entityTypes &&
      filter.entityTypes.length > 0 &&
      !filter.entityTypes.includes(event.entityType)
    ) {
      return false
    }

    // Check operations
    if (
      filter.operations &&
      filter.operations.length > 0 &&
      !filter.operations.includes(event.operation)
    ) {
      return false
    }

    // Check noun types
    if (
      filter.nounTypes &&
      filter.nounTypes.length > 0 &&
      event.nounType &&
      !filter.nounTypes.includes(event.nounType)
    ) {
      return false
    }

    // Check verb types
    if (
      filter.verbTypes &&
      filter.verbTypes.length > 0 &&
      event.verbType &&
      !filter.verbTypes.includes(event.verbType)
    ) {
      return false
    }

    // Check service
    if (filter.service && event.service !== filter.service) {
      return false
    }

    // Check sequence ID
    if (filter.since !== undefined && event.sequenceId <= filter.since) {
      return false
    }

    return true
  }

  /**
   * Dispatch event to matching subscribers
   */
  private async dispatch(event: BrainyEvent): Promise<void> {
    const promises: Promise<void>[] = []

    for (const [_, subscription] of this.subscriptions) {
      if (this.matchesFilter(event, subscription.filter)) {
        const result = subscription.handler(event)
        if (result instanceof Promise) {
          promises.push(result)
        }
      }
    }

    // Wait for all async handlers (fire and forget for sync handlers)
    if (promises.length > 0) {
      await Promise.allSettled(promises)
    }
  }

  /**
   * Replay buffered events to a new subscriber
   */
  private async replayEvents(
    filter: EventFilter,
    handler: EventHandler
  ): Promise<void> {
    const eventsToReplay = this.eventBuffer.filter((event) =>
      this.matchesFilter(event, filter)
    )

    for (const event of eventsToReplay) {
      const result = handler(event)
      if (result instanceof Promise) {
        await result
      }
    }
  }

  /**
   * Add event to circular buffer
   */
  private addToBuffer(event: BrainyEvent): void {
    this.eventBuffer.push(event)

    // Maintain buffer size
    while (this.eventBuffer.length > this.bufferSize) {
      this.eventBuffer.shift()
    }
  }

  /**
   * Generate unique event ID
   */
  private generateEventId(): string {
    return `evt-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`
  }
}
