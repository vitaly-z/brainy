/**
 * Integration Hub - Integration Loader
 *
 * Lazy-loads integrations with environment detection.
 * Zero external dependencies - works everywhere.
 */

import { IntegrationBase } from './IntegrationBase.js'
import { IntegrationConfig } from './types.js'

/**
 * Supported integration types
 */
export type IntegrationType =
  | 'odata'    // Excel Power Query, Power BI, Tableau
  | 'sheets'   // Google Sheets two-way sync
  | 'sse'      // Server-Sent Events streaming
  | 'webhooks' // Push notifications to external URLs

/**
 * Runtime environment
 */
export type RuntimeEnvironment =
  | 'node'
  | 'browser'
  | 'deno'
  | 'cloudflare'
  | 'bun'

/**
 * Integration metadata
 */
export interface IntegrationInfo {
  id: IntegrationType
  name: string
  description: string
  environments: RuntimeEnvironment[]
  tools: string[] // What tools this works with
}

/**
 * Integration catalog - all built-in, zero dependencies
 */
export const INTEGRATION_CATALOG: Record<IntegrationType, IntegrationInfo> = {
  odata: {
    id: 'odata',
    name: 'OData 4.0 API',
    description: 'REST API for spreadsheets and BI tools',
    environments: ['node', 'browser', 'deno', 'cloudflare', 'bun'],
    tools: ['Excel Power Query', 'Power BI', 'Tableau', 'Qlik', 'SAP']
  },
  sheets: {
    id: 'sheets',
    name: 'Google Sheets',
    description: 'Two-way sync with Google Sheets',
    environments: ['node', 'browser', 'deno', 'cloudflare', 'bun'],
    tools: ['Google Sheets', 'Apps Script']
  },
  sse: {
    id: 'sse',
    name: 'Real-time Streaming',
    description: 'Server-Sent Events for live updates',
    environments: ['node', 'browser', 'deno', 'cloudflare', 'bun'],
    tools: ['Dashboards', 'Live UIs', 'Monitoring']
  },
  webhooks: {
    id: 'webhooks',
    name: 'Webhooks',
    description: 'Push events to external URLs',
    environments: ['node', 'browser', 'deno', 'cloudflare', 'bun'],
    tools: ['Zapier', 'IFTTT', 'n8n', 'Custom APIs']
  }
}

/**
 * Detect current runtime environment
 */
export function detectEnvironment(): RuntimeEnvironment {
  // Deno
  if (typeof (globalThis as any).Deno !== 'undefined') {
    return 'deno'
  }

  // Bun
  if (typeof (globalThis as any).Bun !== 'undefined') {
    return 'bun'
  }

  // Cloudflare Workers
  if (
    typeof (globalThis as any).caches !== 'undefined' &&
    typeof (globalThis as any).HTMLRewriter !== 'undefined'
  ) {
    return 'cloudflare'
  }

  // Node.js
  if (
    typeof process !== 'undefined' &&
    process.versions &&
    process.versions.node
  ) {
    return 'node'
  }

  // Browser
  if (typeof window !== 'undefined') {
    return 'browser'
  }

  return 'node'
}

/**
 * Integration loader configuration
 */
export interface IntegrationLoaderConfig {
  /** Which integrations to load: array of types, 'all', or 'none' */
  integrations?: IntegrationType[] | 'all' | 'none'

  /** Override configs per integration */
  config?: Partial<Record<IntegrationType, IntegrationConfig>>

  /** Custom integrations to add */
  custom?: IntegrationBase[]
}

/**
 * Lazy-loading integration manager
 *
 * @example
 * ```typescript
 * // Load all integrations (recommended)
 * const loader = new IntegrationLoader({ integrations: 'all' })
 * const integrations = await loader.load()
 *
 * // Load specific integrations
 * const loader = new IntegrationLoader({
 *   integrations: ['odata', 'sheets']
 * })
 * ```
 */
export class IntegrationLoader {
  private config: IntegrationLoaderConfig
  private environment: RuntimeEnvironment
  private loaded: Map<IntegrationType, IntegrationBase> = new Map()

  constructor(config: IntegrationLoaderConfig = {}) {
    this.config = {
      integrations: config.integrations ?? 'none',
      config: config.config ?? {},
      custom: config.custom ?? []
    }
    this.environment = detectEnvironment()
  }

  /**
   * Get current runtime environment
   */
  getEnvironment(): RuntimeEnvironment {
    return this.environment
  }

  /**
   * Get all available integrations
   */
  getAvailable(): IntegrationInfo[] {
    return Object.values(INTEGRATION_CATALOG).filter((info) =>
      info.environments.includes(this.environment)
    )
  }

  /**
   * Check if an integration is available
   */
  isAvailable(type: IntegrationType): boolean {
    const info = INTEGRATION_CATALOG[type]
    return info?.environments.includes(this.environment) ?? false
  }

  /**
   * Load and instantiate integrations
   */
  async load(): Promise<IntegrationBase[]> {
    const toLoad = this.resolveIntegrations()
    const results: IntegrationBase[] = []

    // Load integrations in parallel for speed
    const loadPromises = toLoad.map(async (type) => {
      try {
        const integration = await this.loadOne(type)
        if (integration) {
          this.loaded.set(type, integration)
          return integration
        }
      } catch (error: any) {
        console.warn(`[Brainy] Failed to load ${type}: ${error.message}`)
      }
      return null
    })

    const loadedIntegrations = await Promise.all(loadPromises)
    results.push(...loadedIntegrations.filter((i): i is IntegrationBase => i !== null))

    // Add custom integrations
    for (const custom of this.config.custom ?? []) {
      results.push(custom)
    }

    return results
  }

  /**
   * Get a loaded integration by type
   */
  get<T extends IntegrationBase = IntegrationBase>(type: IntegrationType): T | undefined {
    return this.loaded.get(type) as T | undefined
  }

  /**
   * Check if an integration is loaded
   */
  has(type: IntegrationType): boolean {
    return this.loaded.has(type)
  }

  /**
   * Get all loaded integrations
   */
  all(): IntegrationBase[] {
    return Array.from(this.loaded.values())
  }

  private resolveIntegrations(): IntegrationType[] {
    const { integrations } = this.config

    if (integrations === 'none') {
      return []
    }

    if (integrations === 'all') {
      return this.getAvailable().map((info) => info.id)
    }

    return (integrations || []).filter((type) => this.isAvailable(type))
  }

  private async loadOne(type: IntegrationType): Promise<IntegrationBase | null> {
    const cfg = this.config.config?.[type]

    switch (type) {
      case 'odata': {
        const { ODataIntegration } = await import('../odata/ODataIntegration.js')
        return new ODataIntegration(cfg)
      }
      case 'sheets': {
        const { GoogleSheetsIntegration } = await import('../sheets/GoogleSheetsIntegration.js')
        return new GoogleSheetsIntegration(cfg)
      }
      case 'sse': {
        const { SSEIntegration } = await import('../sse/SSEIntegration.js')
        return new SSEIntegration(cfg)
      }
      case 'webhooks': {
        const { WebhookIntegration } = await import('../webhooks/WebhookIntegration.js')
        return new WebhookIntegration(cfg)
      }
      default:
        return null
    }
  }
}

/**
 * Create an integration loader
 */
export function createIntegrationLoader(config?: IntegrationLoaderConfig): IntegrationLoader {
  return new IntegrationLoader(config)
}
