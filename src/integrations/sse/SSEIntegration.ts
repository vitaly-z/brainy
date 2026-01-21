/**
 * SSE (Server-Sent Events) Integration
 *
 * Provides real-time streaming of Brainy events to clients.
 * Universal - works in all environments.
 */

import {
  IntegrationBase,
  HTTPIntegration,
  StreamingIntegration
} from '../core/IntegrationBase.js'
import {
  IntegrationConfig,
  EventFilter,
  BrainyEvent
} from '../core/types.js'
import { AugmentationManifest } from '../../augmentations/manifest.js'

/**
 * SSE integration configuration
 */
export interface SSEConfig extends IntegrationConfig {
  /** Base path for SSE endpoint (default: '/events') */
  basePath?: string

  /** Heartbeat interval in ms (default: 30000) */
  heartbeatInterval?: number

  /** Maximum clients (default: 1000) */
  maxClients?: number

  /** Include full entity data in events (default: false) */
  includeData?: boolean
}

/**
 * SSE client connection
 */
interface SSEClient {
  id: string
  filter: EventFilter
  send: (event: string, data: any, id?: string) => void
  close: () => void
  lastEventId?: string
  connectedAt: number
}

/**
 * SSE Integration
 *
 * Enables real-time streaming of Brainy changes via Server-Sent Events.
 * Clients can subscribe to specific event types and receive updates instantly.
 *
 * Endpoint:
 * - GET /events - SSE stream
 *
 * Query Parameters:
 * - types: Entity types to subscribe to (noun,verb,vfs)
 * - operations: Operations to subscribe to (create,update,delete)
 * - nounTypes: Specific noun types (person,document,...)
 * - since: Resume from sequence ID (Last-Event-ID)
 *
 * @example
 * ```typescript
 * brain.augmentations.register(new SSEIntegration({
 *   basePath: '/events',
 *   heartbeatInterval: 30000
 * }))
 *
 * // Client-side:
 * const source = new EventSource('/events?types=noun&operations=create,update')
 * source.onmessage = (event) => {
 *   const data = JSON.parse(event.data)
 *   console.log('Change:', data)
 * }
 * ```
 */
export class SSEIntegration
  extends IntegrationBase
  implements HTTPIntegration, StreamingIntegration
{
  readonly name = 'sse'

  port: number
  basePath: string

  private sseConfig: SSEConfig & {
    enabled: boolean
    basePath: string
    heartbeatInterval: number
    maxClients: number
    includeData: boolean
  }
  private clients: Map<string, SSEClient> = new Map()
  private heartbeatTimer?: ReturnType<typeof setInterval>
  private clientIdCounter = 0

  constructor(config?: SSEConfig) {
    super(config)

    this.sseConfig = {
      enabled: config?.enabled ?? true,
      basePath: config?.basePath ?? '/events',
      heartbeatInterval: config?.heartbeatInterval ?? 30000,
      maxClients: config?.maxClients ?? 1000,
      includeData: config?.includeData ?? false,
      rateLimit: config?.rateLimit,
      auth: config?.auth,
      cors: config?.cors
    }

    this.port = 0
    this.basePath = this.sseConfig.basePath
  }

  protected async onStart(): Promise<void> {
    // Subscribe to all Brainy events
    this.subscribeToChanges({}, (event) => {
      this.broadcastEvent(event)
    })

    // Start heartbeat
    this.heartbeatTimer = setInterval(() => {
      this.sendHeartbeat()
    }, this.sseConfig.heartbeatInterval)

    this.log('SSE integration started')
  }

  protected async onStop(): Promise<void> {
    // Clear heartbeat
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer)
    }

    // Close all clients
    for (const [_, client] of this.clients) {
      client.close()
    }
    this.clients.clear()

    this.log('SSE integration stopped')
  }

  /**
   * Handle incoming HTTP request for SSE
   */
  handleRequest(request: {
    method: string
    path: string
    query: Record<string, string>
    headers: Record<string, string>
  }): {
    status: number
    headers: Record<string, string>
    body: string | null
    isSSE: boolean
  } {
    const { method, path, query, headers } = request

    if (method !== 'GET') {
      return {
        status: 405,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Method not allowed' }),
        isSSE: false
      }
    }

    const relativePath = path.startsWith(this.basePath)
      ? path.slice(this.basePath.length)
      : path

    if (relativePath !== '' && relativePath !== '/') {
      return {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Not found' }),
        isSSE: false
      }
    }

    // Parse filter from query params
    const filter = this.parseFilter(query, headers)

    // Return SSE headers - actual stream handling is done by the server
    return {
      status: 200,
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'X-Accel-Buffering': 'no'
      },
      body: null,
      isSSE: true
    }
  }

  /**
   * Register an SSE client (called by HTTP server)
   */
  registerClient(
    sendFn: (event: string, data: any, id?: string) => void,
    closeFn: () => void,
    query: Record<string, string>,
    headers: Record<string, string>
  ): string {
    if (this.clients.size >= this.sseConfig.maxClients) {
      throw new Error('Maximum clients reached')
    }

    const clientId = `sse-${++this.clientIdCounter}-${Date.now()}`
    const filter = this.parseFilter(query, headers)

    const client: SSEClient = {
      id: clientId,
      filter,
      send: sendFn,
      close: closeFn,
      lastEventId: headers['last-event-id'],
      connectedAt: Date.now()
    }

    this.clients.set(clientId, client)
    this.recordRequest()

    // Send initial connection event
    sendFn('connected', { clientId, filter }, clientId)

    // Replay missed events if resuming
    if (filter.since !== undefined) {
      const missed = this.eventBus.getEventsSince(filter.since)
      for (const event of missed) {
        if (this.matchesFilter(event, filter)) {
          sendFn('change', this.formatEvent(event), String(event.sequenceId))
        }
      }
    }

    this.log(`SSE client connected: ${clientId}`)

    return clientId
  }

  /**
   * Unregister an SSE client
   */
  unregisterClient(clientId: string): void {
    this.clients.delete(clientId)
    this.log(`SSE client disconnected: ${clientId}`)
  }

  /**
   * Get connected client count
   */
  getClientCount(): number {
    return this.clients.size
  }

  /**
   * Stream implementation for StreamingIntegration interface
   */
  stream(
    filter: EventFilter,
    callback: (event: any) => void
  ): { close: () => void } {
    const subscription = this.eventBus.subscribe(filter, (event) => {
      callback(this.formatEvent(event))
    })

    return {
      close: () => subscription.unsubscribe()
    }
  }

  /**
   * Get routes
   */
  getRoutes(): Array<{ method: string; path: string; description: string }> {
    return [
      {
        method: 'GET',
        path: this.basePath,
        description: 'Server-Sent Events stream'
      }
    ]
  }

  /**
   * Get manifest
   */
  getManifest(): AugmentationManifest {
    return {
      id: 'sse',
      name: 'SSE Streaming',
      version: '1.0.0',
      description: 'Real-time event streaming via Server-Sent Events',
      longDescription:
        'Enables real-time streaming of Brainy changes to web clients, Google Sheets, and dashboards via standard Server-Sent Events.',
      category: 'integration',
      status: 'stable',
      configSchema: {
        type: 'object',
        properties: {
          enabled: { type: 'boolean', default: true },
          basePath: { type: 'string', default: '/events' },
          heartbeatInterval: { type: 'number', default: 30000 },
          maxClients: { type: 'number', default: 1000 },
          includeData: { type: 'boolean', default: false }
        }
      },
      configDefaults: {
        enabled: true,
        basePath: '/events',
        heartbeatInterval: 30000,
        maxClients: 1000,
        includeData: false
      },
      features: [
        'Real-time streaming',
        'Event filtering',
        'Automatic reconnection support',
        'Event replay on reconnect',
        'Heartbeat keep-alive'
      ],
      keywords: ['sse', 'streaming', 'real-time', 'events']
    }
  }

  // Private methods

  private parseFilter(
    query: Record<string, string>,
    headers: Record<string, string>
  ): EventFilter {
    const filter: EventFilter = {}

    if (query.types) {
      filter.entityTypes = query.types.split(',') as any[]
    }

    if (query.operations) {
      filter.operations = query.operations.split(',') as any[]
    }

    if (query.nounTypes) {
      filter.nounTypes = query.nounTypes.split(',') as any[]
    }

    if (query.verbTypes) {
      filter.verbTypes = query.verbTypes.split(',') as any[]
    }

    if (query.service) {
      filter.service = query.service
    }

    // Resume from Last-Event-ID header or query param
    const since = headers['last-event-id'] || query.since
    if (since) {
      filter.since = BigInt(since)
    }

    return filter
  }

  private matchesFilter(event: BrainyEvent, filter: EventFilter): boolean {
    if (filter.entityTypes?.length && !filter.entityTypes.includes(event.entityType)) {
      return false
    }
    if (filter.operations?.length && !filter.operations.includes(event.operation)) {
      return false
    }
    if (filter.nounTypes?.length && event.nounType && !filter.nounTypes.includes(event.nounType)) {
      return false
    }
    if (filter.verbTypes?.length && event.verbType && !filter.verbTypes.includes(event.verbType)) {
      return false
    }
    if (filter.service && event.service !== filter.service) {
      return false
    }
    return true
  }

  private formatEvent(event: BrainyEvent): any {
    const formatted: any = {
      id: event.id,
      type: event.entityType,
      operation: event.operation,
      entityId: event.entityId,
      timestamp: event.timestamp
    }

    if (event.nounType) formatted.nounType = event.nounType
    if (event.verbType) formatted.verbType = event.verbType
    if (event.service) formatted.service = event.service

    if (this.sseConfig.includeData && event.data) {
      formatted.data = event.data
    }

    return formatted
  }

  private broadcastEvent(event: BrainyEvent): void {
    const eventId = String(event.sequenceId)

    for (const [_, client] of this.clients) {
      if (this.matchesFilter(event, client.filter)) {
        try {
          client.send('change', this.formatEvent(event), eventId)
        } catch {
          // Client disconnected, will be cleaned up
        }
      }
    }
  }

  private sendHeartbeat(): void {
    const timestamp = Date.now()
    for (const [_, client] of this.clients) {
      try {
        client.send('heartbeat', { timestamp })
      } catch {
        // Client disconnected
      }
    }
  }
}

/**
 * Package export for @soulcraft/brainy-sse
 */
export const integration = {
  name: 'sse',
  version: '1.0.0',
  description: 'Real-time event streaming via Server-Sent Events',
  environments: ['node', 'browser', 'deno', 'cloudflare', 'bun'],
  create: (brain: any, config?: SSEConfig) => new SSEIntegration(config),
  defaultConfig: {
    basePath: '/events',
    heartbeatInterval: 30000,
    maxClients: 1000
  }
}
