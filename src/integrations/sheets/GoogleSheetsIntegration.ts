/**
 * Google Sheets Integration
 *
 * Provides REST API endpoints optimized for Google Apps Script to enable
 * two-way sync between Brainy and Google Sheets.
 *
 * Features:
 * - Custom function support (=BRAINY_QUERY(), =BRAINY_ADD())
 * - Real-time updates via SSE subscription
 * - Batch operations for performance
 * - Simple authentication (API key or Bearer token)
 *
 * Zero external dependencies - works in all environments.
 */

import { IntegrationBase, HTTPIntegration } from '../core/IntegrationBase.js'
import { IntegrationConfig } from '../core/types.js'
import { Entity, FindParams } from '../../types/brainy.types.js'
import { NounType, VerbType } from '../../types/graphTypes.js'

/**
 * Google Sheets integration configuration
 */
export interface GoogleSheetsConfig extends IntegrationConfig {
  /** Base path for API routes (default: '/sheets') */
  basePath?: string

  /** Port to listen on (only for standalone) */
  port?: number

  /** Maximum results per query (default: 1000) */
  maxResults?: number

  /** Default query limit (default: 100) */
  defaultLimit?: number

  /** Allow write operations (default: true) */
  allowWrite?: boolean

  /** CORS origins to allow (default: Google Sheets) */
  allowedOrigins?: string[]
}

/**
 * Sheets API request
 */
interface SheetsRequest {
  method: string
  path: string
  query: Record<string, string>
  body?: any
  headers: Record<string, string>
}

/**
 * Sheets API response
 */
interface SheetsResponse {
  status: number
  headers: Record<string, string>
  body: any
}

/**
 * Google Sheets Integration
 *
 * Provides a simple REST API optimized for Google Apps Script custom functions.
 *
 * Endpoints:
 * - GET /sheets/query - Query entities (for =BRAINY_QUERY())
 * - GET /sheets/entity/:id - Get single entity (for =BRAINY_GET())
 * - GET /sheets/similar - Semantic search (for =BRAINY_SIMILAR())
 * - GET /sheets/relations - Get relationships (for =BRAINY_RELATIONS())
 * - POST /sheets/add - Add entity (for sidebar)
 * - POST /sheets/batch - Batch operations (for range sync)
 * - GET /sheets/schema - Get type schema (for sidebar dropdown)
 * - GET /sheets/stream - SSE for real-time updates
 *
 * Response Format (optimized for Sheets):
 * ```json
 * {
 *   "headers": ["Id", "Type", "Name", "Email"],
 *   "rows": [
 *     ["uuid-1", "person", "John Doe", "john@example.com"],
 *     ["uuid-2", "person", "Jane Doe", "jane@example.com"]
 *   ],
 *   "count": 2,
 *   "hasMore": false
 * }
 * ```
 *
 * @example
 * ```typescript
 * const sheets = new GoogleSheetsIntegration({
 *   basePath: '/sheets',
 *   maxResults: 1000
 * })
 * await sheets.initialize()
 * ```
 */
export class GoogleSheetsIntegration
  extends IntegrationBase
  implements HTTPIntegration
{
  readonly name = 'sheets'

  port: number
  basePath: string

  private sheetsConfig: GoogleSheetsConfig & {
    enabled: boolean
    basePath: string
    port: number
    maxResults: number
    defaultLimit: number
    allowWrite: boolean
    allowedOrigins: string[]
  }
  private sseClients: Map<string, (event: string, data: any) => void> =
    new Map()

  constructor(config?: GoogleSheetsConfig) {
    super(config)

    this.sheetsConfig = {
      enabled: config?.enabled ?? true,
      basePath: config?.basePath ?? '/sheets',
      port: config?.port ?? 0,
      maxResults: config?.maxResults ?? 1000,
      defaultLimit: config?.defaultLimit ?? 100,
      allowWrite: config?.allowWrite ?? true,
      allowedOrigins: config?.allowedOrigins ?? [
        'https://docs.google.com',
        'https://script.google.com'
      ],
      rateLimit: config?.rateLimit,
      auth: config?.auth,
      cors: config?.cors ?? {
        origin: [
          'https://docs.google.com',
          'https://script.google.com',
          '*'
        ],
        methods: ['GET', 'POST', 'OPTIONS'],
        credentials: true
      }
    }

    this.port = this.sheetsConfig.port
    this.basePath = this.sheetsConfig.basePath
  }

  protected async onStart(): Promise<void> {
    // Subscribe to changes for real-time sync
    this.subscribeToChanges(
      { entityTypes: ['noun', 'verb'] },
      (event) => {
        // Broadcast to all SSE clients
        this.broadcastSSE('change', {
          type: event.entityType,
          operation: event.operation,
          entityId: event.entityId,
          timestamp: event.timestamp
        })
      }
    )

    this.log('Google Sheets integration started')
  }

  protected async onStop(): Promise<void> {
    // Close all SSE connections
    this.sseClients.clear()
    this.log('Google Sheets integration stopped')
  }

  /**
   * Handle a Sheets API request
   */
  async handleRequest(request: SheetsRequest): Promise<SheetsResponse> {
    this.recordRequest()

    try {
      const { method, path } = request
      const relativePath = path.startsWith(this.basePath)
        ? path.slice(this.basePath.length)
        : path

      // CORS preflight
      if (method === 'OPTIONS') {
        return this.corsResponse()
      }

      // Route the request
      if (method === 'GET') {
        if (relativePath === '/query' || relativePath === '') {
          return this.handleQuery(request)
        }
        if (relativePath.startsWith('/entity/')) {
          const id = relativePath.slice('/entity/'.length)
          return this.handleGetEntity(id)
        }
        if (relativePath === '/similar') {
          return this.handleSimilar(request)
        }
        if (relativePath === '/relations') {
          return this.handleRelations(request)
        }
        if (relativePath === '/schema') {
          return this.handleSchema()
        }
        if (relativePath === '/stream') {
          return this.handleStream(request)
        }
        if (relativePath === '/health') {
          return this.handleHealth()
        }
      }

      if (method === 'POST' && this.sheetsConfig.allowWrite) {
        if (relativePath === '/add') {
          return this.handleAdd(request)
        }
        if (relativePath === '/update') {
          return this.handleUpdate(request)
        }
        if (relativePath === '/delete') {
          return this.handleDelete(request)
        }
        if (relativePath === '/batch') {
          return this.handleBatch(request)
        }
        if (relativePath === '/relate') {
          return this.handleRelate(request)
        }
      }

      return this.errorResponse(404, 'Not Found')
    } catch (error: any) {
      this.recordError(error)
      return this.errorResponse(500, error.message)
    }
  }

  /**
   * Get registered routes
   */
  getRoutes(): Array<{ method: string; path: string; description: string }> {
    const routes = [
      { method: 'GET', path: `${this.basePath}/query`, description: 'Query entities' },
      { method: 'GET', path: `${this.basePath}/entity/:id`, description: 'Get entity by ID' },
      { method: 'GET', path: `${this.basePath}/similar`, description: 'Semantic search' },
      { method: 'GET', path: `${this.basePath}/relations`, description: 'Get relationships' },
      { method: 'GET', path: `${this.basePath}/schema`, description: 'Get schema' },
      { method: 'GET', path: `${this.basePath}/stream`, description: 'SSE stream' },
      { method: 'GET', path: `${this.basePath}/health`, description: 'Health check' }
    ]

    if (this.sheetsConfig.allowWrite) {
      routes.push(
        { method: 'POST', path: `${this.basePath}/add`, description: 'Add entity' },
        { method: 'POST', path: `${this.basePath}/update`, description: 'Update entity' },
        { method: 'POST', path: `${this.basePath}/delete`, description: 'Delete entity' },
        { method: 'POST', path: `${this.basePath}/batch`, description: 'Batch operations' },
        { method: 'POST', path: `${this.basePath}/relate`, description: 'Create relationship' }
      )
    }

    return routes
  }

  /**
   * Register an SSE client
   */
  registerSSEClient(
    clientId: string,
    sendFn: (event: string, data: any) => void
  ): () => void {
    this.sseClients.set(clientId, sendFn)
    return () => this.sseClients.delete(clientId)
  }

  /**
   * Get manifest
   */
  getManifest(): Record<string, any> {
    return {
      id: 'sheets',
      name: 'Google Sheets Integration',
      version: '1.0.0',
      description: 'Two-way sync between Brainy and Google Sheets',
      longDescription:
        'Enables real-time bidirectional synchronization with Google Sheets. Use custom functions like =BRAINY_QUERY() directly in cells, or the sidebar for browsing and editing.',
      category: 'integration',
      status: 'stable',
      configSchema: {
        type: 'object',
        properties: {
          enabled: { type: 'boolean', default: true },
          basePath: { type: 'string', default: '/sheets' },
          maxResults: { type: 'number', default: 1000 },
          defaultLimit: { type: 'number', default: 100 },
          allowWrite: { type: 'boolean', default: true }
        }
      },
      configDefaults: {
        enabled: true,
        basePath: '/sheets',
        maxResults: 1000,
        defaultLimit: 100,
        allowWrite: true
      },
      features: [
        'Custom functions (=BRAINY_QUERY)',
        'Real-time sync via SSE',
        'Batch operations',
        'Semantic search support',
        'Type schema discovery'
      ],
      keywords: ['google-sheets', 'spreadsheet', 'sync', 'real-time']
    }
  }

  // Route handlers

  private async handleQuery(request: SheetsRequest): Promise<SheetsResponse> {
    const { query } = request

    // Build find params
    const findParams: FindParams = {
      limit: Math.min(
        parseInt(query.limit) || this.sheetsConfig.defaultLimit,
        this.sheetsConfig.maxResults
      )
    }

    // Query string (semantic search)
    if (query.q) {
      findParams.query = query.q
    }

    // Type filter
    if (query.type) {
      const types = query.type.split(',') as NounType[]
      findParams.type = types.length === 1 ? types[0] : types
    }

    // Offset pagination
    if (query.offset) {
      findParams.offset = parseInt(query.offset)
    }

    // Sort
    if (query.orderBy) {
      findParams.orderBy = query.orderBy
      findParams.order = (query.order as 'asc' | 'desc') || 'desc'
    }

    // Execute query
    const entities = await this.queryEntities(findParams)

    // Convert to sheets format
    return this.entitiesToSheetsResponse(entities)
  }

  private async handleGetEntity(id: string): Promise<SheetsResponse> {
    const entity = await this.getEntity(id)

    if (!entity) {
      return this.errorResponse(404, 'Entity not found')
    }

    return this.entitiesToSheetsResponse([entity])
  }

  private async handleSimilar(request: SheetsRequest): Promise<SheetsResponse> {
    if (!this.context) {
      return this.errorResponse(500, 'Not initialized')
    }

    const { query } = request

    if (!query.q && !query.to) {
      return this.errorResponse(400, 'Missing q or to parameter')
    }

    const limit = Math.min(
      parseInt(query.limit) || 10,
      this.sheetsConfig.maxResults
    )

    // Semantic similarity search
    let results: any[]

    if (query.to) {
      // Similar to entity
      results = await this.context.brain.similar({
        to: query.to,
        limit,
        threshold: query.threshold ? parseFloat(query.threshold) : undefined
      })
    } else {
      // Similar to query text
      results = await this.context.brain.find({
        query: query.q,
        limit
      })
    }

    const entities = results.map((r: any) => r.entity || r)
    return this.entitiesToSheetsResponse(entities)
  }

  private async handleRelations(
    request: SheetsRequest
  ): Promise<SheetsResponse> {
    const { query } = request

    const params: any = {
      limit: Math.min(
        parseInt(query.limit) || 100,
        this.sheetsConfig.maxResults
      )
    }

    if (query.from) params.from = query.from
    if (query.to) params.to = query.to
    if (query.type) params.type = query.type as VerbType

    const relations = await this.queryRelations(params)

    // Convert to sheets format
    const headers = [
      'Id',
      'FromId',
      'ToId',
      'Type',
      'Weight',
      'Confidence',
      'CreatedAt'
    ]
    const rows = relations.map((r) => [
      r.id,
      r.from,
      r.to,
      r.type,
      r.weight ?? 1,
      r.confidence ?? 1,
      new Date(r.createdAt).toISOString()
    ])

    return this.jsonResponse({
      headers,
      rows,
      count: rows.length,
      hasMore: false
    })
  }

  private handleSchema(): SheetsResponse {
    return this.jsonResponse({
      nounTypes: Object.values(NounType),
      verbTypes: Object.values(VerbType),
      entityFields: ['id', 'type', 'data', 'metadata', 'confidence', 'weight', 'service', 'createdAt', 'updatedAt'],
      commonMetadataFields: ['name', 'title', 'description', 'email', 'url', 'tags', 'category', 'status', 'priority']
    })
  }

  private handleStream(_request: SheetsRequest): SheetsResponse {
    // This returns headers for SSE - actual streaming is handled by the HTTP server
    return {
      status: 200,
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
        'Access-Control-Allow-Origin': '*'
      },
      body: 'sse' // Signal to HTTP server to handle as SSE
    }
  }

  private handleHealth(): SheetsResponse {
    return this.jsonResponse({
      status: 'ok',
      integration: 'sheets',
      uptime: this.startedAt ? Date.now() - this.startedAt : 0,
      requests: this.requestCount
    })
  }

  private async handleAdd(request: SheetsRequest): Promise<SheetsResponse> {
    if (!this.context) {
      return this.errorResponse(500, 'Not initialized')
    }

    const { body } = request

    if (!body || !body.type) {
      return this.errorResponse(400, 'Missing required field: type')
    }

    const entity = await this.context.brain.add({
      type: body.type as NounType,
      data: body.data,
      metadata: body.metadata,
      confidence: body.confidence,
      weight: body.weight,
      service: body.service
    })

    return this.entitiesToSheetsResponse([entity])
  }

  private async handleUpdate(request: SheetsRequest): Promise<SheetsResponse> {
    if (!this.context) {
      return this.errorResponse(500, 'Not initialized')
    }

    const { body } = request

    if (!body || !body.id) {
      return this.errorResponse(400, 'Missing required field: id')
    }

    await this.context.brain.update({
      id: body.id,
      data: body.data,
      metadata: body.metadata,
      type: body.type as NounType,
      confidence: body.confidence,
      weight: body.weight,
      merge: body.merge ?? true
    })

    const updated = await this.getEntity(body.id)
    return this.entitiesToSheetsResponse(updated ? [updated] : [])
  }

  private async handleDelete(request: SheetsRequest): Promise<SheetsResponse> {
    if (!this.context) {
      return this.errorResponse(500, 'Not initialized')
    }

    const { body } = request

    if (!body || !body.id) {
      return this.errorResponse(400, 'Missing required field: id')
    }

    await this.context.brain.delete(body.id)

    return this.jsonResponse({ success: true, deleted: body.id })
  }

  private async handleBatch(request: SheetsRequest): Promise<SheetsResponse> {
    if (!this.context) {
      return this.errorResponse(500, 'Not initialized')
    }

    const { body } = request

    if (!body || !Array.isArray(body.operations)) {
      return this.errorResponse(400, 'Missing operations array')
    }

    const results: any[] = []

    for (const op of body.operations) {
      try {
        switch (op.action) {
          case 'add':
            const added = await this.context.brain.add({
              type: op.type as NounType,
              data: op.data,
              metadata: op.metadata
            })
            results.push({ success: true, id: added.id, action: 'add' })
            break

          case 'update':
            await this.context.brain.update({
              id: op.id,
              data: op.data,
              metadata: op.metadata,
              merge: true
            })
            results.push({ success: true, id: op.id, action: 'update' })
            break

          case 'delete':
            await this.context.brain.delete(op.id)
            results.push({ success: true, id: op.id, action: 'delete' })
            break

          default:
            results.push({
              success: false,
              error: `Unknown action: ${op.action}`
            })
        }
      } catch (error: any) {
        results.push({
          success: false,
          id: op.id,
          action: op.action,
          error: error.message
        })
      }
    }

    return this.jsonResponse({
      results,
      total: body.operations.length,
      successful: results.filter((r) => r.success).length,
      failed: results.filter((r) => !r.success).length
    })
  }

  private async handleRelate(request: SheetsRequest): Promise<SheetsResponse> {
    if (!this.context) {
      return this.errorResponse(500, 'Not initialized')
    }

    const { body } = request

    if (!body || !body.from || !body.to || !body.type) {
      return this.errorResponse(400, 'Missing required fields: from, to, type')
    }

    const relation = await this.context.brain.relate({
      from: body.from,
      to: body.to,
      type: body.type as VerbType,
      weight: body.weight,
      metadata: body.metadata
    })

    return this.jsonResponse({
      success: true,
      relation: {
        id: relation.id,
        from: relation.from,
        to: relation.to,
        type: relation.type
      }
    })
  }

  // Helpers

  private entitiesToSheetsResponse(entities: Entity[]): SheetsResponse {
    if (entities.length === 0) {
      return this.jsonResponse({
        headers: ['Id', 'Type', 'CreatedAt'],
        rows: [],
        count: 0,
        hasMore: false
      })
    }

    // Collect all unique metadata keys
    const metadataKeys = new Set<string>()
    for (const entity of entities) {
      if (entity.metadata) {
        for (const key of Object.keys(entity.metadata)) {
          metadataKeys.add(key)
        }
      }
    }

    // Build headers
    const baseHeaders = ['Id', 'Type', 'Confidence', 'Weight', 'CreatedAt']
    const metaHeaders = Array.from(metadataKeys).sort()
    const headers = [...baseHeaders, ...metaHeaders, 'Data']

    // Build rows
    const rows = entities.map((entity) => {
      const baseValues = [
        entity.id,
        entity.type,
        entity.confidence ?? '',
        entity.weight ?? '',
        new Date(entity.createdAt).toISOString()
      ]

      const metaValues = metaHeaders.map((key) => {
        const val = entity.metadata?.[key]
        if (val === undefined || val === null) return ''
        if (typeof val === 'object') return JSON.stringify(val)
        return val
      })

      const dataValue = entity.data ? JSON.stringify(entity.data) : ''

      return [...baseValues, ...metaValues, dataValue]
    })

    return this.jsonResponse({
      headers,
      rows,
      count: rows.length,
      hasMore: false
    })
  }

  private broadcastSSE(event: string, data: any): void {
    for (const [_, sendFn] of this.sseClients) {
      try {
        sendFn(event, data)
      } catch {
        // Client disconnected
      }
    }
  }

  private jsonResponse(data: any): SheetsResponse {
    return {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization'
      },
      body: JSON.stringify(data)
    }
  }

  private errorResponse(status: number, message: string): SheetsResponse {
    return {
      status,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({ error: message })
    }
  }

  private corsResponse(): SheetsResponse {
    return {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Max-Age': '86400'
      },
      body: null
    }
  }
}

/**
 * Package export for @soulcraft/brainy-sheets
 */
export const integration = {
  name: 'sheets',
  version: '1.0.0',
  description: 'Google Sheets two-way sync with real-time updates',
  environments: ['node', 'browser', 'deno', 'cloudflare', 'bun'],
  create: (brain: any, config?: GoogleSheetsConfig) =>
    new GoogleSheetsIntegration(config),
  defaultConfig: {
    basePath: '/sheets',
    maxResults: 1000,
    defaultLimit: 100,
    allowWrite: true
  }
}
