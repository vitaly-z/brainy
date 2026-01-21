/**
 * Integration Hub - Zero-Config Integration Manager
 *
 * The simplest way to enable external tool integrations.
 * One line of code, all integrations ready.
 *
 * @example
 * ```typescript
 * // Zero-config: Enable all integrations
 * const hub = await IntegrationHub.create(brain)
 *
 * // Get your endpoints
 * console.log(hub.endpoints)
 * // {
 * //   odata: '/odata',      → Excel, Power BI, Tableau
 * //   sheets: '/sheets',    → Google Sheets
 * //   sse: '/events',       → Real-time streaming
 * //   webhooks: '/webhooks' → Push notifications
 * // }
 * ```
 */

import { IntegrationBase } from './IntegrationBase.js'
import { IntegrationLoader, IntegrationType, INTEGRATION_CATALOG } from './IntegrationLoader.js'
import { IntegrationConfig, IntegrationHealthStatus } from './types.js'
import { ODataIntegration } from '../odata/ODataIntegration.js'
import { GoogleSheetsIntegration } from '../sheets/GoogleSheetsIntegration.js'
import { SSEIntegration } from '../sse/SSEIntegration.js'
import { WebhookIntegration } from '../webhooks/WebhookIntegration.js'

/**
 * Integration Hub configuration
 */
export interface IntegrationHubConfig {
  /** Base path for all endpoints (default: '') */
  basePath?: string

  /** Which integrations to enable (default: all) */
  enable?: IntegrationType[] | 'all'

  /** Per-integration config overrides */
  config?: {
    odata?: IntegrationConfig & { basePath?: string }
    sheets?: IntegrationConfig & { basePath?: string }
    sse?: IntegrationConfig & { basePath?: string }
    webhooks?: IntegrationConfig & { basePath?: string }
  }
}

/**
 * HTTP request for integration routing
 */
export interface IntegrationRequest {
  method: string
  path: string
  query?: Record<string, string>
  headers?: Record<string, string>
  body?: any
}

/**
 * HTTP response from integration
 */
export interface IntegrationResponse {
  status: number
  headers: Record<string, string>
  body: any
  isSSE?: boolean
}

/**
 * Integration Hub - Zero-Configuration Integration Manager
 *
 * Provides instant access to:
 * - OData API (Excel Power Query, Power BI, Tableau)
 * - Google Sheets API (two-way sync)
 * - SSE streaming (real-time dashboards)
 * - Webhooks (push notifications)
 *
 * All integrations work in any environment with zero external dependencies.
 */
export class IntegrationHub {
  private integrations: Map<IntegrationType, IntegrationBase> = new Map()
  private config: Required<IntegrationHubConfig>
  private _endpoints: Record<IntegrationType, string> = {} as any

  /**
   * Create and initialize the Integration Hub
   *
   * @example
   * ```typescript
   * // All integrations, default paths
   * const hub = await IntegrationHub.create(brain)
   *
   * // Custom base path
   * const hub = await IntegrationHub.create(brain, { basePath: '/api/v1' })
   *
   * // Only specific integrations
   * const hub = await IntegrationHub.create(brain, { enable: ['odata', 'sheets'] })
   * ```
   */
  static async create(brain: any, config?: IntegrationHubConfig): Promise<IntegrationHub> {
    const hub = new IntegrationHub(config)
    await hub.initialize(brain)
    return hub
  }

  private constructor(config?: IntegrationHubConfig) {
    this.config = {
      basePath: config?.basePath ?? '',
      enable: config?.enable ?? 'all',
      config: config?.config ?? {}
    }
  }

  private async initialize(brain: any): Promise<void> {
    const toEnable = this.config.enable === 'all'
      ? (['odata', 'sheets', 'sse', 'webhooks'] as IntegrationType[])
      : this.config.enable

    // Create context for integration initialization
    const context = {
      brain,
      storage: brain.getStorage?.() || null,
      config: {},
      log: (message: string, level?: string) => {
        // Silent logging - integrations handle their own logging
      }
    }

    for (const type of toEnable) {
      const integration = await this.createIntegration(type)
      if (integration) {
        // Initialize the integration with context (BaseAugmentation pattern)
        await integration.initialize(context)
        this.integrations.set(type, integration)
        this._endpoints[type] = this.getBasePath(type)
      }
    }
  }

  private async createIntegration(type: IntegrationType): Promise<IntegrationBase | null> {
    const basePath = this.config.basePath
    const cfg = this.config.config?.[type]

    switch (type) {
      case 'odata':
        return new ODataIntegration({
          ...cfg,
          basePath: cfg?.basePath ?? `${basePath}/odata`
        })
      case 'sheets':
        return new GoogleSheetsIntegration({
          ...cfg,
          basePath: cfg?.basePath ?? `${basePath}/sheets`
        })
      case 'sse':
        return new SSEIntegration({
          ...cfg,
          basePath: cfg?.basePath ?? `${basePath}/events`
        })
      case 'webhooks':
        return new WebhookIntegration(cfg)
      default:
        return null
    }
  }

  private getBasePath(type: IntegrationType): string {
    const basePath = this.config.basePath
    const cfg = this.config.config?.[type] as any

    switch (type) {
      case 'odata':
        return cfg?.basePath ?? `${basePath}/odata`
      case 'sheets':
        return cfg?.basePath ?? `${basePath}/sheets`
      case 'sse':
        return cfg?.basePath ?? `${basePath}/events`
      case 'webhooks':
        return `${basePath}/webhooks`
      default:
        return ''
    }
  }

  /**
   * Get all endpoint paths
   */
  get endpoints(): Record<IntegrationType, string> {
    return { ...this._endpoints }
  }

  /**
   * Handle an HTTP request and route to the appropriate integration
   *
   * @example
   * ```typescript
   * // Express middleware
   * app.use('/api', async (req, res) => {
   *   const response = await hub.handleRequest({
   *     method: req.method,
   *     path: req.path,
   *     query: req.query,
   *     headers: req.headers,
   *     body: req.body
   *   })
   *
   *   if (response.isSSE) {
   *     // Handle SSE stream
   *   } else {
   *     res.status(response.status).set(response.headers).json(response.body)
   *   }
   * })
   * ```
   */
  async handleRequest(request: IntegrationRequest): Promise<IntegrationResponse> {
    const { path } = request

    // Route to appropriate integration based on path
    for (const [type, basePath] of Object.entries(this._endpoints)) {
      if (path.startsWith(basePath) || path === basePath) {
        const integration = this.integrations.get(type as IntegrationType)
        if (integration && 'handleRequest' in integration) {
          const handler = integration as any
          const relativePath = path.slice(basePath.length) || '/'

          return handler.handleRequest({
            ...request,
            path: relativePath
          })
        }
      }
    }

    return {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
      body: { error: 'Not found', path }
    }
  }

  /**
   * Get a specific integration
   */
  get<T extends IntegrationBase>(type: IntegrationType): T | undefined {
    return this.integrations.get(type) as T | undefined
  }

  /**
   * Get the OData integration
   */
  get odata(): ODataIntegration | undefined {
    return this.integrations.get('odata') as ODataIntegration
  }

  /**
   * Get the Google Sheets integration
   */
  get sheets(): GoogleSheetsIntegration | undefined {
    return this.integrations.get('sheets') as GoogleSheetsIntegration
  }

  /**
   * Get the SSE integration
   */
  get sse(): SSEIntegration | undefined {
    return this.integrations.get('sse') as SSEIntegration
  }

  /**
   * Get the Webhook integration
   */
  get webhooks(): WebhookIntegration | undefined {
    return this.integrations.get('webhooks') as WebhookIntegration
  }

  /**
   * Check if an integration is enabled
   */
  has(type: IntegrationType): boolean {
    return this.integrations.has(type)
  }

  /**
   * Get health status of all integrations
   */
  health(): Record<IntegrationType, IntegrationHealthStatus> {
    const result: Record<string, IntegrationHealthStatus> = {}

    for (const [type, integration] of this.integrations) {
      result[type] = integration.health()
    }

    return result as Record<IntegrationType, IntegrationHealthStatus>
  }

  /**
   * Stop all integrations
   */
  async stop(): Promise<void> {
    for (const integration of this.integrations.values()) {
      await integration.stop()
    }
  }

  /**
   * Get connection instructions for each tool
   */
  getInstructions(): Record<string, string> {
    const base = this.config.basePath || 'http://localhost:3000'

    return {
      excel: `
Excel Power Query:
1. Data → Get Data → From Other Sources → From OData Feed
2. Enter URL: ${base}/odata
3. Click OK, then Load
      `.trim(),

      powerbi: `
Power BI:
1. Get Data → OData Feed
2. Enter URL: ${base}/odata
3. Click OK, then Load
      `.trim(),

      googleSheets: `
Google Sheets:
1. Install the Brainy add-on from Google Workspace Marketplace
2. Open sidebar: Extensions → Brainy → Open
3. Connect to: ${base}/sheets
4. Use custom functions: =BRAINY_QUERY("type:Person", 100)
      `.trim(),

      realtime: `
Real-time Streaming (SSE):
const source = new EventSource('${base}/events')
source.onmessage = (event) => console.log(JSON.parse(event.data))
      `.trim(),

      webhooks: `
Webhooks:
POST ${base}/webhooks/register
{
  "url": "https://your-server.com/webhook",
  "events": { "entityTypes": ["noun"], "operations": ["create", "update"] }
}
      `.trim()
    }
  }
}

/**
 * Create an Integration Hub with zero configuration
 *
 * @example
 * ```typescript
 * const hub = await createIntegrationHub(brain)
 * console.log(hub.endpoints)
 * ```
 */
export async function createIntegrationHub(
  brain: any,
  config?: IntegrationHubConfig
): Promise<IntegrationHub> {
  return IntegrationHub.create(brain, config)
}
