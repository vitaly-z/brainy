/**
 * OData Integration
 *
 * Exposes Brainy data via OData 4.0 REST API for:
 * - Excel Power Query
 * - Power BI
 * - Tableau
 * - Any OData-compatible BI tool
 *
 * Zero external dependencies - works in all environments.
 */

import {
  IntegrationBase,
  HTTPIntegration
} from '../core/IntegrationBase.js'
import { IntegrationConfig, ODataQueryOptions } from '../core/types.js'
import { Entity, Relation, FindParams } from '../../types/brainy.types.js'
import { NounType } from '../../types/graphTypes.js'
import {
  parseODataQuery,
  applyFilter,
  applySelect,
  applyOrderBy,
  applyPagination
} from './ODataQueryParser.js'
import {
  generateEdmx,
  generateMetadataJson,
  generateServiceDocument
} from './EdmxGenerator.js'

/**
 * OData integration configuration
 */
export interface ODataConfig extends IntegrationConfig {
  /** Base path for OData routes (default: '/odata') */
  basePath?: string

  /** Port to listen on (only used when running standalone server) */
  port?: number

  /** Include relationships endpoint (default: true) */
  includeRelationships?: boolean

  /** Maximum page size (default: 1000) */
  maxPageSize?: number

  /** Default page size (default: 100) */
  defaultPageSize?: number

  /** Namespace for metadata (default: 'Brainy') */
  namespace?: string
}

/**
 * OData request context
 */
interface ODataRequest {
  method: string
  path: string
  query: string
  body?: any
  headers: Record<string, string>
}

/**
 * OData response
 */
interface ODataResponse {
  status: number
  headers: Record<string, string>
  body: any
}

/**
 * OData Integration
 *
 * Provides OData 4.0 REST API for Brainy data access from spreadsheets and BI tools.
 *
 * Routes:
 * - GET /odata - Service document
 * - GET /odata/$metadata - EDMX metadata
 * - GET /odata/Entities - List entities with OData queries
 * - GET /odata/Entities('id') - Get single entity
 * - GET /odata/Relationships - List relationships
 * - GET /odata/Relationships('id') - Get single relationship
 * - POST /odata/Entities - Create entity
 * - PATCH /odata/Entities('id') - Update entity
 * - DELETE /odata/Entities('id') - Delete entity
 *
 * Supports: $filter, $select, $orderby, $top, $skip, $count, $search
 *
 * @example
 * ```typescript
 * const odata = new ODataIntegration({
 *   basePath: '/odata',
 *   maxPageSize: 1000
 * })
 * await odata.initialize()
 *
 * // Connect from Excel Power Query:
 * // Data → Get Data → From OData Feed → http://localhost:3000/odata
 * ```
 */
export class ODataIntegration extends IntegrationBase implements HTTPIntegration {
  readonly name = 'odata'

  // HTTPIntegration
  port: number
  basePath: string

  private odataConfig: ODataConfig & {
    enabled: boolean
    basePath: string
    port: number
    includeRelationships: boolean
    maxPageSize: number
    defaultPageSize: number
    namespace: string
  }

  constructor(config?: ODataConfig) {
    super(config)

    this.odataConfig = {
      enabled: config?.enabled ?? true,
      basePath: config?.basePath ?? '/odata',
      port: config?.port ?? 0,
      includeRelationships: config?.includeRelationships ?? true,
      maxPageSize: config?.maxPageSize ?? 1000,
      defaultPageSize: config?.defaultPageSize ?? 100,
      namespace: config?.namespace ?? 'Brainy',
      rateLimit: config?.rateLimit,
      auth: config?.auth,
      cors: config?.cors
    }

    this.port = this.odataConfig.port
    this.basePath = this.odataConfig.basePath
  }

  /**
   * Start the integration (registers routes with API server)
   */
  protected async onStart(): Promise<void> {
    this.log('OData integration started')
  }

  /**
   * Stop the integration
   */
  protected async onStop(): Promise<void> {
    this.log('OData integration stopped')
  }

  /**
   * Handle an OData request
   *
   * This is the main entry point for processing OData requests.
   * Can be called directly or integrated with an HTTP server.
   *
   * @param request OData request
   * @returns OData response
   */
  async handleRequest(request: ODataRequest): Promise<ODataResponse> {
    this.recordRequest()

    try {
      const { method, path } = request
      const relativePath = path.startsWith(this.basePath)
        ? path.slice(this.basePath.length)
        : path

      // Route the request
      if (method === 'GET') {
        if (relativePath === '' || relativePath === '/') {
          return this.getServiceDocument(request)
        }
        if (relativePath === '/$metadata') {
          return this.getMetadata(request)
        }
        if (relativePath.startsWith('/Entities')) {
          return this.handleEntities(request, relativePath)
        }
        if (relativePath.startsWith('/Relationships')) {
          return this.handleRelationships(request, relativePath)
        }
      }

      if (method === 'POST') {
        if (relativePath === '/Entities') {
          return this.createEntity(request)
        }
        if (relativePath === '/Relationships') {
          return this.createRelationship(request)
        }
      }

      if (method === 'PATCH') {
        if (relativePath.startsWith('/Entities(')) {
          return this.updateEntity(request, relativePath)
        }
      }

      if (method === 'DELETE') {
        if (relativePath.startsWith('/Entities(')) {
          return this.deleteEntity(request, relativePath)
        }
        if (relativePath.startsWith('/Relationships(')) {
          return this.deleteRelationship(request, relativePath)
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
      { method: 'GET', path: `${this.basePath}`, description: 'Service document' },
      { method: 'GET', path: `${this.basePath}/$metadata`, description: 'EDMX metadata' },
      { method: 'GET', path: `${this.basePath}/Entities`, description: 'List entities' },
      { method: 'GET', path: `${this.basePath}/Entities('id')`, description: 'Get entity' },
      { method: 'POST', path: `${this.basePath}/Entities`, description: 'Create entity' },
      { method: 'PATCH', path: `${this.basePath}/Entities('id')`, description: 'Update entity' },
      { method: 'DELETE', path: `${this.basePath}/Entities('id')`, description: 'Delete entity' }
    ]

    if (this.odataConfig.includeRelationships) {
      routes.push(
        { method: 'GET', path: `${this.basePath}/Relationships`, description: 'List relationships' },
        { method: 'GET', path: `${this.basePath}/Relationships('id')`, description: 'Get relationship' },
        { method: 'POST', path: `${this.basePath}/Relationships`, description: 'Create relationship' },
        { method: 'DELETE', path: `${this.basePath}/Relationships('id')`, description: 'Delete relationship' }
      )
    }

    return routes
  }

  /**
   * Get augmentation manifest
   */
  getManifest(): Record<string, any> {
    return {
      id: 'odata',
      name: 'OData Integration',
      version: '1.0.0',
      description: 'OData 4.0 API for Excel, Power BI, and BI tools',
      longDescription:
        'Exposes Brainy data via OData 4.0 REST API, enabling direct connections from Excel Power Query, Power BI, Tableau, and any OData-compatible tool. Supports $filter, $select, $orderby, $top, $skip, $count queries.',
      category: 'integration',
      status: 'stable',
      configSchema: {
        type: 'object',
        properties: {
          enabled: { type: 'boolean', default: true },
          basePath: { type: 'string', default: '/odata' },
          maxPageSize: { type: 'number', default: 1000 },
          defaultPageSize: { type: 'number', default: 100 },
          includeRelationships: { type: 'boolean', default: true },
          namespace: { type: 'string', default: 'Brainy' }
        }
      },
      configDefaults: {
        enabled: true,
        basePath: '/odata',
        maxPageSize: 1000,
        defaultPageSize: 100,
        includeRelationships: true,
        namespace: 'Brainy'
      },
      features: [
        'Excel Power Query support',
        'Power BI direct connect',
        'OData $filter queries',
        'OData $select, $orderby',
        'Pagination with $top/$skip',
        '$count support',
        '$search semantic search'
      ],
      keywords: ['odata', 'excel', 'power-bi', 'bi', 'rest', 'api']
    }
  }

  // Route handlers

  private getServiceDocument(_request: ODataRequest): ODataResponse {
    const baseUrl = `${this.basePath}`
    return this.jsonResponse(
      generateServiceDocument(baseUrl, {
        includeRelationships: this.odataConfig.includeRelationships
      })
    )
  }

  private getMetadata(request: ODataRequest): ODataResponse {
    // Check Accept header for JSON vs XML
    const accept = request.headers['accept'] || ''

    if (accept.includes('application/json')) {
      return this.jsonResponse(
        generateMetadataJson({
          namespace: this.odataConfig.namespace,
          includeRelationships: this.odataConfig.includeRelationships
        })
      )
    }

    // Default to XML EDMX
    return {
      status: 200,
      headers: {
        'Content-Type': 'application/xml',
        'OData-Version': '4.0'
      },
      body: generateEdmx({
        namespace: this.odataConfig.namespace,
        includeRelationships: this.odataConfig.includeRelationships
      })
    }
  }

  private async handleEntities(
    request: ODataRequest,
    path: string
  ): Promise<ODataResponse> {
    // Single entity: /Entities('id')
    const idMatch = path.match(/^\/Entities\('([^']+)'\)/)
    if (idMatch) {
      return this.handleGetEntity(idMatch[1])
    }

    // Collection: /Entities?$filter=...
    return this.listEntities(request)
  }

  private async listEntities(request: ODataRequest): Promise<ODataResponse> {
    const options = parseODataQuery(request.query)

    // Apply pagination limits
    const pageSize = Math.min(
      options.top ?? this.odataConfig.defaultPageSize,
      this.odataConfig.maxPageSize
    )
    options.top = pageSize

    // Query from Brainy
    const findParams: FindParams = {
      limit: pageSize + 1, // +1 to detect if there are more
      offset: options.skip
    }

    // Apply orderby
    if (options.orderBy && options.orderBy.length > 0) {
      findParams.orderBy = options.orderBy[0].field
      findParams.order = options.orderBy[0].direction
    }

    // Apply $search as semantic query
    if (options.search) {
      findParams.query = options.search
    }

    // Get entities
    let entities = await this.queryEntities(findParams)

    // Apply $filter (in-memory for complex filters)
    if (options.filter) {
      const rows = this.exporter.entitiesToRows(entities)
      const filteredRows = applyFilter(rows, options.filter)
      // Map back to entities (simple approach)
      const filteredIds = new Set(filteredRows.map((r) => r.Id))
      entities = entities.filter((e) => filteredIds.has(e.id))
    }

    // Check for more results
    const hasMore = entities.length > pageSize
    if (hasMore) {
      entities = entities.slice(0, pageSize)
    }

    // Convert to tabular format
    let rows = this.exporter.entitiesToRows(entities)

    // Apply $select
    if (options.select && options.select.length > 0) {
      rows = applySelect(rows, options.select) as any
    }

    // Apply $orderby (if not handled by storage)
    if (options.orderBy && options.orderBy.length > 0) {
      rows = applyOrderBy(rows, options.orderBy)
    }

    // Build response
    const result: any = {
      '@odata.context': `${this.basePath}/$metadata#Entities`
    }

    // $count
    if (options.count) {
      // For accurate count, we'd need to query without limit
      // For now, use the page count
      result['@odata.count'] = entities.length
    }

    result.value = rows

    // Next link for pagination
    if (hasMore) {
      const nextSkip = (options.skip ?? 0) + pageSize
      result['@odata.nextLink'] = `${this.basePath}/Entities?$top=${pageSize}&$skip=${nextSkip}`
    }

    return this.jsonResponse(result)
  }

  private async handleGetEntity(id: string): Promise<ODataResponse> {
    const entity = await super.getEntity(id)

    if (!entity) {
      return this.errorResponse(404, `Entity '${id}' not found`)
    }

    const row = this.exporter.entityToRow(entity)

    return this.jsonResponse({
      '@odata.context': `${this.basePath}/$metadata#Entities/$entity`,
      ...row
    })
  }

  private async createEntity(request: ODataRequest): Promise<ODataResponse> {
    if (!this.context) {
      return this.errorResponse(500, 'Integration not initialized')
    }

    const body = request.body
    if (!body || !body.Type) {
      return this.errorResponse(400, 'Missing required field: Type')
    }

    const entity = await this.context.brain.add({
      type: body.Type as NounType,
      data: body.Data ? JSON.parse(body.Data) : undefined,
      metadata: this.extractMetadata(body),
      confidence: body.Confidence,
      weight: body.Weight,
      service: body.Service
    })

    const row = this.exporter.entityToRow(entity)

    return {
      status: 201,
      headers: {
        'Content-Type': 'application/json',
        'OData-Version': '4.0',
        'Location': `${this.basePath}/Entities('${entity.id}')`
      },
      body: JSON.stringify({
        '@odata.context': `${this.basePath}/$metadata#Entities/$entity`,
        ...row
      })
    }
  }

  private async updateEntity(
    request: ODataRequest,
    path: string
  ): Promise<ODataResponse> {
    if (!this.context) {
      return this.errorResponse(500, 'Integration not initialized')
    }

    const idMatch = path.match(/^\/Entities\('([^']+)'\)/)
    if (!idMatch) {
      return this.errorResponse(400, 'Invalid entity ID')
    }

    const id = idMatch[1]
    const body = request.body

    const updates: any = { id }

    if (body.Type) updates.type = body.Type as NounType
    if (body.Data) updates.data = JSON.parse(body.Data)
    if (body.Confidence !== undefined) updates.confidence = body.Confidence
    if (body.Weight !== undefined) updates.weight = body.Weight

    const metadata = this.extractMetadata(body)
    if (Object.keys(metadata).length > 0) {
      updates.metadata = metadata
      updates.merge = true
    }

    await this.context.brain.update(updates)

    return {
      status: 204,
      headers: { 'OData-Version': '4.0' },
      body: null
    }
  }

  private async deleteEntity(
    _request: ODataRequest,
    path: string
  ): Promise<ODataResponse> {
    if (!this.context) {
      return this.errorResponse(500, 'Integration not initialized')
    }

    const idMatch = path.match(/^\/Entities\('([^']+)'\)/)
    if (!idMatch) {
      return this.errorResponse(400, 'Invalid entity ID')
    }

    await this.context.brain.delete(idMatch[1])

    return {
      status: 204,
      headers: { 'OData-Version': '4.0' },
      body: null
    }
  }

  private async handleRelationships(
    request: ODataRequest,
    path: string
  ): Promise<ODataResponse> {
    // Single relationship: /Relationships('id')
    const idMatch = path.match(/^\/Relationships\('([^']+)'\)/)
    if (idMatch) {
      return this.getRelationship(idMatch[1])
    }

    // Collection
    return this.listRelationships(request)
  }

  private async listRelationships(
    request: ODataRequest
  ): Promise<ODataResponse> {
    const options = parseODataQuery(request.query)

    const pageSize = Math.min(
      options.top ?? this.odataConfig.defaultPageSize,
      this.odataConfig.maxPageSize
    )

    const relations = await this.queryRelations({
      limit: pageSize,
      offset: options.skip
    })

    let rows = this.exporter.relationsToRows(relations)

    // Apply $filter
    if (options.filter) {
      rows = applyFilter(rows, options.filter) as any
    }

    // Apply $select
    if (options.select && options.select.length > 0) {
      rows = applySelect(rows, options.select) as any
    }

    // Apply $orderby
    if (options.orderBy && options.orderBy.length > 0) {
      rows = applyOrderBy(rows, options.orderBy)
    }

    return this.jsonResponse({
      '@odata.context': `${this.basePath}/$metadata#Relationships`,
      value: rows
    })
  }

  private async getRelationship(id: string): Promise<ODataResponse> {
    const relations = await this.queryRelations({ limit: 1000 })
    const relation = relations.find((r) => r.id === id)

    if (!relation) {
      return this.errorResponse(404, `Relationship '${id}' not found`)
    }

    const row = this.exporter.relationToRow(relation)

    return this.jsonResponse({
      '@odata.context': `${this.basePath}/$metadata#Relationships/$entity`,
      ...row
    })
  }

  private async createRelationship(
    request: ODataRequest
  ): Promise<ODataResponse> {
    if (!this.context) {
      return this.errorResponse(500, 'Integration not initialized')
    }

    const body = request.body
    if (!body || !body.FromId || !body.ToId || !body.Type) {
      return this.errorResponse(
        400,
        'Missing required fields: FromId, ToId, Type'
      )
    }

    const relation = await this.context.brain.relate({
      from: body.FromId,
      to: body.ToId,
      type: body.Type,
      weight: body.Weight,
      confidence: body.Confidence,
      metadata: body.Metadata ? JSON.parse(body.Metadata) : undefined,
      service: body.Service
    })

    const row = this.exporter.relationToRow(relation)

    return {
      status: 201,
      headers: {
        'Content-Type': 'application/json',
        'OData-Version': '4.0',
        'Location': `${this.basePath}/Relationships('${relation.id}')`
      },
      body: JSON.stringify({
        '@odata.context': `${this.basePath}/$metadata#Relationships/$entity`,
        ...row
      })
    }
  }

  private async deleteRelationship(
    _request: ODataRequest,
    path: string
  ): Promise<ODataResponse> {
    if (!this.context) {
      return this.errorResponse(500, 'Integration not initialized')
    }

    const idMatch = path.match(/^\/Relationships\('([^']+)'\)/)
    if (!idMatch) {
      return this.errorResponse(400, 'Invalid relationship ID')
    }

    await this.context.brain.unrelate(idMatch[1])

    return {
      status: 204,
      headers: { 'OData-Version': '4.0' },
      body: null
    }
  }

  // Helpers

  private jsonResponse(data: any): ODataResponse {
    return {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'OData-Version': '4.0'
      },
      body: JSON.stringify(data)
    }
  }

  private errorResponse(status: number, message: string): ODataResponse {
    return {
      status,
      headers: {
        'Content-Type': 'application/json',
        'OData-Version': '4.0'
      },
      body: JSON.stringify({
        error: {
          code: String(status),
          message
        }
      })
    }
  }

  private extractMetadata(body: Record<string, any>): Record<string, any> {
    const metadata: Record<string, any> = {}
    const prefix = 'Metadata_'

    for (const [key, value] of Object.entries(body)) {
      if (key.startsWith(prefix)) {
        const metaKey = key.slice(prefix.length)
        metadata[metaKey] = value
      }
    }

    return metadata
  }
}
