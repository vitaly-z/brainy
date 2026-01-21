/**
 * Brainy Integration Hub
 *
 * Connect Brainy to external tools with zero configuration:
 * - Google Sheets (two-way sync)
 * - Excel / Power BI / Tableau (OData 4.0)
 * - Real-time dashboards (SSE streaming)
 * - External webhooks (push notifications)
 *
 * @example Enable integrations (v7.4.0 - recommended)
 * ```typescript
 * import { Brainy } from '@soulcraft/brainy'
 *
 * const brain = new Brainy({ integrations: true })
 * await brain.init()
 *
 * // Access the hub
 * console.log(brain.hub.endpoints)
 * // { odata: '/odata', sheets: '/sheets', sse: '/events', webhooks: '/webhooks' }
 *
 * // Handle requests (Express, Hono, etc.)
 * app.all('/odata/*', async (req, res) => {
 *   const response = await brain.hub.handleRequest(req)
 *   res.status(response.status).json(response.body)
 * })
 * ```
 */

// ============================================================================
// Integration Hub (used internally by brain.hub)
// ============================================================================

export {
  IntegrationHub,
  createIntegrationHub,
  type IntegrationHubConfig,
  type IntegrationRequest,
  type IntegrationResponse
} from './core/IntegrationHub.js'

// ============================================================================
// Core Infrastructure
// ============================================================================

export {
  // Event system for real-time updates
  EventBus,
  // Entity → rows/columns conversion
  TabularExporter,
  // Base class for custom integrations
  IntegrationBase,
  // Lazy-loading manager
  IntegrationLoader,
  createIntegrationLoader,
  // Environment detection
  detectEnvironment,
  // Integration catalog
  INTEGRATION_CATALOG
} from './core/index.js'

// Types
export type {
  HTTPIntegration,
  StreamingIntegration,
  IntegrationType,
  RuntimeEnvironment,
  IntegrationInfo,
  IntegrationLoaderConfig
} from './core/index.js'

export type {
  BrainyEvent,
  EventFilter,
  EventHandler,
  EventSubscription,
  TabularRow,
  RelationTabularRow,
  TabularExporterConfig,
  IntegrationConfig,
  IntegrationHealthStatus,
  ODataQueryOptions,
  WebhookRegistration,
  WebhookDeliveryResult
} from './core/index.js'

// ============================================================================
// Individual Integrations
// ============================================================================

/**
 * OData 4.0 Integration
 *
 * Connect Excel Power Query, Power BI, Tableau, and any OData client.
 */
export { ODataIntegration, type ODataConfig } from './odata/index.js'

/**
 * Google Sheets Integration
 *
 * Two-way sync between Brainy and Google Sheets via Apps Script.
 */
export { GoogleSheetsIntegration, type GoogleSheetsConfig } from './sheets/index.js'

/**
 * SSE Streaming Integration
 *
 * Real-time event streaming via Server-Sent Events.
 */
export { SSEIntegration, type SSEConfig } from './sse/index.js'

/**
 * Webhook Integration
 *
 * Push events to external URLs with retry and signing.
 */
export { WebhookIntegration, type WebhookConfig } from './webhooks/index.js'

// ============================================================================
// OData Utilities (for advanced use)
// ============================================================================

export {
  parseODataQuery,
  parseFilter,
  parseOrderBy,
  parseSelect,
  odataToFindParams,
  applyFilter,
  applySelect,
  applyOrderBy,
  applyPagination
} from './odata/ODataQueryParser.js'

export {
  generateEdmx,
  generateMetadataJson,
  generateServiceDocument
} from './odata/EdmxGenerator.js'
