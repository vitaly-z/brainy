/**
 * Webhook Integration
 *
 * Delivers Brainy events to external URLs via HTTP POST.
 * Supports HMAC signing, retry policies, and batching.
 *
 * Zero external dependencies - works in all environments.
 */

import { IntegrationBase } from '../core/IntegrationBase.js'
import {
  IntegrationConfig,
  EventFilter,
  WebhookRegistration,
  WebhookDeliveryResult,
  BrainyEvent
} from '../core/types.js'
import { AugmentationManifest } from '../../augmentations/manifest.js'

/**
 * Webhook integration configuration
 */
export interface WebhookConfig extends IntegrationConfig {
  /** Default retry policy */
  defaultRetryPolicy?: {
    maxRetries: number
    backoffMultiplier: number
    initialDelayMs: number
    maxDelayMs: number
  }

  /** Batch delivery settings */
  batch?: {
    enabled: boolean
    maxSize: number
    maxDelayMs: number
  }

  /** Request timeout in ms (default: 30000) */
  timeout?: number

  /** Include full entity data (default: false) */
  includeData?: boolean
}

/**
 * Pending delivery
 */
interface PendingDelivery {
  webhook: WebhookRegistration
  events: BrainyEvent[]
  attempts: number
  nextAttempt: number
}

/**
 * Webhook Integration
 *
 * Enables push notifications to external systems when Brainy data changes.
 * Supports HMAC-SHA256 signing for security, automatic retry with exponential
 * backoff, and optional event batching.
 *
 * Methods:
 * - register(webhook) - Register a new webhook
 * - unregister(id) - Remove a webhook
 * - list() - List all webhooks
 * - getDeliveryHistory(webhookId) - Get delivery history
 *
 * @example
 * ```typescript
 * const webhooks = new WebhookIntegration()
 * brain.augmentations.register(webhooks)
 *
 * // Register a webhook
 * await webhooks.register({
 *   url: 'https://example.com/webhook',
 *   events: { entityTypes: ['noun'], operations: ['create', 'update'] },
 *   secret: 'my-signing-secret'
 * })
 * ```
 */
export class WebhookIntegration extends IntegrationBase {
  readonly name = 'webhooks'

  private webhookConfig: WebhookConfig & {
    enabled: boolean
    defaultRetryPolicy: {
      maxRetries: number
      backoffMultiplier: number
      initialDelayMs: number
      maxDelayMs: number
    }
    batch: {
      enabled: boolean
      maxSize: number
      maxDelayMs: number
    }
    timeout: number
    includeData: boolean
  }
  private webhooks: Map<string, WebhookRegistration> = new Map()
  private pendingDeliveries: PendingDelivery[] = []
  private deliveryHistory: WebhookDeliveryResult[] = []
  private deliveryTimer?: ReturnType<typeof setInterval>
  private batchBuffer: Map<string, BrainyEvent[]> = new Map()
  private batchTimer?: ReturnType<typeof setTimeout>
  private webhookIdCounter = 0

  constructor(config?: WebhookConfig) {
    super(config)

    this.webhookConfig = {
      enabled: config?.enabled ?? true,
      defaultRetryPolicy: config?.defaultRetryPolicy ?? {
        maxRetries: 5,
        backoffMultiplier: 2,
        initialDelayMs: 1000,
        maxDelayMs: 60000
      },
      batch: config?.batch ?? {
        enabled: false,
        maxSize: 100,
        maxDelayMs: 5000
      },
      timeout: config?.timeout ?? 30000,
      includeData: config?.includeData ?? false,
      rateLimit: config?.rateLimit,
      auth: config?.auth,
      cors: config?.cors
    }
  }

  protected async onStart(): Promise<void> {
    // Subscribe to all events
    this.subscribeToChanges({}, (event) => {
      this.handleEvent(event)
    })

    // Start delivery processor
    this.deliveryTimer = setInterval(() => {
      this.processDeliveries()
    }, 1000)

    this.log('Webhook integration started')
  }

  protected async onStop(): Promise<void> {
    if (this.deliveryTimer) {
      clearInterval(this.deliveryTimer)
    }
    if (this.batchTimer) {
      clearTimeout(this.batchTimer)
    }

    // Attempt to deliver remaining events
    await this.flushBatches()
    await this.processDeliveries()

    this.log('Webhook integration stopped')
  }

  /**
   * Register a new webhook
   */
  async register(
    webhook: Omit<WebhookRegistration, 'id' | 'active' | 'createdAt'>
  ): Promise<WebhookRegistration> {
    const id = `wh-${++this.webhookIdCounter}-${Date.now()}`

    const registration: WebhookRegistration = {
      id,
      url: webhook.url,
      events: webhook.events,
      secret: webhook.secret,
      active: true,
      retryPolicy: webhook.retryPolicy ?? this.webhookConfig.defaultRetryPolicy,
      createdAt: Date.now()
    }

    this.webhooks.set(id, registration)
    this.log(`Registered webhook: ${id} -> ${webhook.url}`)

    return registration
  }

  /**
   * Unregister a webhook
   */
  async unregister(id: string): Promise<boolean> {
    const existed = this.webhooks.delete(id)
    if (existed) {
      this.log(`Unregistered webhook: ${id}`)
    }
    return existed
  }

  /**
   * List all webhooks
   */
  list(): WebhookRegistration[] {
    return Array.from(this.webhooks.values())
  }

  /**
   * Get a specific webhook
   */
  get(id: string): WebhookRegistration | undefined {
    return this.webhooks.get(id)
  }

  /**
   * Update a webhook
   */
  async update(
    id: string,
    updates: Partial<Omit<WebhookRegistration, 'id' | 'createdAt'>>
  ): Promise<WebhookRegistration | null> {
    const webhook = this.webhooks.get(id)
    if (!webhook) return null

    const updated = { ...webhook, ...updates }
    this.webhooks.set(id, updated)
    return updated
  }

  /**
   * Get delivery history for a webhook
   */
  getDeliveryHistory(
    webhookId?: string,
    limit = 100
  ): WebhookDeliveryResult[] {
    let history = this.deliveryHistory

    if (webhookId) {
      history = history.filter((d) => d.webhookId === webhookId)
    }

    return history.slice(-limit)
  }

  /**
   * Manually trigger a test delivery
   */
  async testDelivery(webhookId: string): Promise<WebhookDeliveryResult> {
    const webhook = this.webhooks.get(webhookId)
    if (!webhook) {
      throw new Error(`Webhook not found: ${webhookId}`)
    }

    const testEvent: BrainyEvent = {
      id: 'test-event',
      entityType: 'noun',
      operation: 'create',
      entityId: 'test-entity',
      timestamp: Date.now(),
      sequenceId: 0n
    }

    return this.deliverEvent(webhook, [testEvent])
  }

  /**
   * Get manifest
   */
  getManifest(): AugmentationManifest {
    return {
      id: 'webhooks',
      name: 'Webhooks',
      version: '1.0.0',
      description: 'Push events to external URLs',
      longDescription:
        'Delivers Brainy events to external webhooks via HTTP POST. Supports HMAC-SHA256 signing, exponential backoff retry, and event batching.',
      category: 'integration',
      status: 'stable',
      configSchema: {
        type: 'object',
        properties: {
          enabled: { type: 'boolean', default: true },
          timeout: { type: 'number', default: 30000 },
          includeData: { type: 'boolean', default: false }
        }
      },
      configDefaults: {
        enabled: true,
        timeout: 30000,
        includeData: false
      },
      features: [
        'HMAC-SHA256 signing',
        'Exponential backoff retry',
        'Event batching',
        'Delivery history tracking'
      ],
      keywords: ['webhooks', 'push', 'notifications', 'events']
    }
  }

  // Private methods

  private handleEvent(event: BrainyEvent): void {
    for (const [_, webhook] of this.webhooks) {
      if (!webhook.active) continue
      if (!this.matchesFilter(event, webhook.events)) continue

      if (this.webhookConfig.batch.enabled) {
        this.addToBatch(webhook.id, event)
      } else {
        this.queueDelivery(webhook, [event])
      }
    }
  }

  private matchesFilter(event: BrainyEvent, filter: EventFilter): boolean {
    if (
      filter.entityTypes?.length &&
      !filter.entityTypes.includes(event.entityType)
    ) {
      return false
    }
    if (
      filter.operations?.length &&
      !filter.operations.includes(event.operation)
    ) {
      return false
    }
    if (
      filter.nounTypes?.length &&
      event.nounType &&
      !filter.nounTypes.includes(event.nounType)
    ) {
      return false
    }
    return true
  }

  private addToBatch(webhookId: string, event: BrainyEvent): void {
    let batch = this.batchBuffer.get(webhookId)
    if (!batch) {
      batch = []
      this.batchBuffer.set(webhookId, batch)
    }

    batch.push(event)

    // Flush if batch is full
    if (batch.length >= this.webhookConfig.batch.maxSize) {
      this.flushBatch(webhookId)
    }

    // Set timer for delayed flush
    if (!this.batchTimer) {
      this.batchTimer = setTimeout(() => {
        this.flushBatches()
        this.batchTimer = undefined
      }, this.webhookConfig.batch.maxDelayMs)
    }
  }

  private flushBatch(webhookId: string): void {
    const batch = this.batchBuffer.get(webhookId)
    if (!batch || batch.length === 0) return

    const webhook = this.webhooks.get(webhookId)
    if (webhook) {
      this.queueDelivery(webhook, [...batch])
    }

    this.batchBuffer.delete(webhookId)
  }

  private async flushBatches(): Promise<void> {
    for (const webhookId of this.batchBuffer.keys()) {
      this.flushBatch(webhookId)
    }
  }

  private queueDelivery(
    webhook: WebhookRegistration,
    events: BrainyEvent[]
  ): void {
    this.pendingDeliveries.push({
      webhook,
      events,
      attempts: 0,
      nextAttempt: Date.now()
    })
  }

  private async processDeliveries(): Promise<void> {
    const now = Date.now()
    const ready = this.pendingDeliveries.filter((d) => d.nextAttempt <= now)

    for (const delivery of ready) {
      const result = await this.deliverEvent(delivery.webhook, delivery.events)

      // Remove from pending
      const index = this.pendingDeliveries.indexOf(delivery)
      if (index >= 0) {
        this.pendingDeliveries.splice(index, 1)
      }

      // Track history
      this.deliveryHistory.push(result)
      if (this.deliveryHistory.length > 1000) {
        this.deliveryHistory.shift()
      }

      // Retry if failed
      if (!result.success && delivery.attempts < (delivery.webhook.retryPolicy?.maxRetries ?? 5)) {
        const policy = delivery.webhook.retryPolicy ?? this.webhookConfig.defaultRetryPolicy
        const delay = Math.min(
          policy.initialDelayMs * Math.pow(policy.backoffMultiplier, delivery.attempts),
          policy.maxDelayMs
        )

        this.pendingDeliveries.push({
          ...delivery,
          attempts: delivery.attempts + 1,
          nextAttempt: now + delay
        })
      } else if (!result.success) {
        // Max retries reached - update webhook failure count
        const webhook = this.webhooks.get(delivery.webhook.id)
        if (webhook) {
          webhook.failureCount = (webhook.failureCount ?? 0) + 1
        }
      }
    }
  }

  private async deliverEvent(
    webhook: WebhookRegistration,
    events: BrainyEvent[]
  ): Promise<WebhookDeliveryResult> {
    const payload = {
      events: events.map((e) => ({
        id: e.id,
        type: e.entityType,
        operation: e.operation,
        entityId: e.entityId,
        timestamp: e.timestamp,
        nounType: e.nounType,
        verbType: e.verbType,
        service: e.service,
        data: this.webhookConfig.includeData ? e.data : undefined
      })),
      deliveredAt: Date.now()
    }

    const body = JSON.stringify(payload)
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'User-Agent': 'Brainy-Webhook/1.0',
      'X-Brainy-Delivery': events[0]?.id ?? 'batch'
    }

    // Sign if secret is configured
    if (webhook.secret) {
      const signature = await this.sign(body, webhook.secret)
      headers['X-Brainy-Signature'] = `sha256=${signature}`
    }

    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(
        () => controller.abort(),
        this.webhookConfig.timeout
      )

      const response = await fetch(webhook.url, {
        method: 'POST',
        headers,
        body,
        signal: controller.signal
      })

      clearTimeout(timeoutId)

      const success = response.ok

      if (success) {
        // Update last delivery time
        const wh = this.webhooks.get(webhook.id)
        if (wh) {
          wh.lastDeliveryAt = Date.now()
          wh.failureCount = 0
        }
      }

      return {
        webhookId: webhook.id,
        eventId: events[0]?.id ?? 'batch',
        success,
        statusCode: response.status,
        attempts: 1,
        timestamp: Date.now()
      }
    } catch (error: any) {
      return {
        webhookId: webhook.id,
        eventId: events[0]?.id ?? 'batch',
        success: false,
        error: error.message,
        attempts: 1,
        timestamp: Date.now()
      }
    }
  }

  private async sign(payload: string, secret: string): Promise<string> {
    // Use Web Crypto API (works in all environments)
    const encoder = new TextEncoder()
    const keyData = encoder.encode(secret)
    const messageData = encoder.encode(payload)

    const key = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    )

    const signature = await crypto.subtle.sign('HMAC', key, messageData)
    const signatureArray = new Uint8Array(signature)

    return Array.from(signatureArray)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')
  }
}

/**
 * Package export for @soulcraft/brainy-webhooks
 */
export const integration = {
  name: 'webhooks',
  version: '1.0.0',
  description: 'Push events to external URLs via webhooks',
  environments: ['node', 'browser', 'deno', 'cloudflare', 'bun'],
  create: (brain: any, config?: WebhookConfig) =>
    new WebhookIntegration(config),
  defaultConfig: {
    timeout: 30000,
    includeData: false
  }
}
