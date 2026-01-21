/**
 * Integration Hub - Core Infrastructure
 *
 * Shared foundation for all integrations:
 * - EventBus: Real-time change notifications
 * - TabularExporter: Entity to rows/columns conversion
 * - IntegrationBase: Base class for integrations
 * - IntegrationHub: Zero-config integration manager
 */

// Event system
export { EventBus } from './EventBus.js'

// Tabular export
export { TabularExporter } from './TabularExporter.js'

// Base class
export {
  IntegrationBase,
  type HTTPIntegration,
  type StreamingIntegration
} from './IntegrationBase.js'

// Integration loader
export {
  IntegrationLoader,
  createIntegrationLoader,
  detectEnvironment,
  INTEGRATION_CATALOG,
  type IntegrationType,
  type RuntimeEnvironment,
  type IntegrationInfo,
  type IntegrationLoaderConfig
} from './IntegrationLoader.js'

// Zero-config hub
export {
  IntegrationHub,
  createIntegrationHub,
  type IntegrationHubConfig,
  type IntegrationRequest,
  type IntegrationResponse
} from './IntegrationHub.js'

// Types
export type {
  // Events
  BrainyEvent,
  EventFilter,
  EventHandler,
  EventSubscription,
  // Tabular
  TabularRow,
  RelationTabularRow,
  TabularExporterConfig,
  // Config
  IntegrationConfig,
  IntegrationHealthStatus,
  // OData
  ODataQueryOptions,
  // Webhooks
  WebhookRegistration,
  WebhookDeliveryResult
} from './types.js'
