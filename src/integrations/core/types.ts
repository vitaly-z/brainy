/**
 * Integration Hub - Shared Types
 *
 * Types for OData, Google Sheets, SSE, and Webhooks integrations.
 * Zero external dependencies.
 */

import { Entity, Relation } from '../../types/brainy.types.js'
import { NounType, VerbType } from '../../types/graphTypes.js'

// ============================================================================
// Events - Real-time change notifications
// ============================================================================

/**
 * Real-time event emitted when Brainy data changes
 */
export interface BrainyEvent {
  /** Unique event identifier */
  id: string

  /** What changed: noun, verb, or VFS */
  entityType: 'noun' | 'verb' | 'vfs'

  /** What happened */
  operation: 'create' | 'update' | 'delete'

  /** The entity ID that was affected */
  entityId: string

  /** Unix timestamp in milliseconds */
  timestamp: number

  /** Monotonically increasing sequence ID for ordering/resumption */
  sequenceId: bigint

  /** NounType if entityType is 'noun' */
  nounType?: NounType

  /** VerbType if entityType is 'verb' */
  verbType?: VerbType

  /** Service (multi-tenancy) */
  service?: string

  /** Full entity data (if includeData is enabled) */
  data?: Entity | Relation
}

/**
 * Filter for subscribing to events
 */
export interface EventFilter {
  /** Filter by entity types */
  entityTypes?: ('noun' | 'verb' | 'vfs')[]

  /** Filter by operations */
  operations?: ('create' | 'update' | 'delete')[]

  /** Filter by noun types */
  nounTypes?: NounType[]

  /** Filter by verb types */
  verbTypes?: VerbType[]

  /** Filter by service */
  service?: string

  /** Resume from this sequence ID */
  since?: bigint
}

/**
 * Event handler function
 */
export type EventHandler = (event: BrainyEvent) => void | Promise<void>

/**
 * Event subscription handle
 */
export interface EventSubscription {
  id: string
  unsubscribe(): void
}

// ============================================================================
// Tabular Export - Entity to rows/columns conversion
// ============================================================================

/**
 * Tabular row representation of an entity
 */
export interface TabularRow {
  Id: string
  Type: string
  CreatedAt: string
  UpdatedAt: string
  Confidence: number | null
  Weight: number | null
  Service: string | null
  Data: string | null
  /** Flattened metadata columns (Metadata_*) */
  [key: string]: any
}

/**
 * Tabular row for relations
 */
export interface RelationTabularRow {
  Id: string
  FromId: string
  ToId: string
  Type: string
  Weight: number | null
  Confidence: number | null
  CreatedAt: string
  UpdatedAt: string
  Service: string | null
  Metadata: string | null
}

/**
 * Configuration for TabularExporter
 */
export interface TabularExporterConfig {
  /** Flatten metadata into separate columns (default: true) */
  flattenMetadata?: boolean

  /** Prefix for metadata columns (default: 'Metadata_') */
  metadataPrefix?: string

  /** Include vector embeddings (default: false) */
  includeVectors?: boolean

  /** Date format (default: 'ISO8601') */
  dateFormat?: 'ISO8601' | 'unix' | 'unix_ms'

  /** Fields to JSON.stringify (default: ['data']) */
  jsonStringify?: string[]

  /** Max depth for flattening nested objects (default: 2) */
  maxFlattenDepth?: number

  /** Columns to exclude */
  excludeColumns?: string[]
}

// ============================================================================
// Integration Configuration
// ============================================================================

/**
 * Base configuration for all integrations
 */
export interface IntegrationConfig {
  /** Enable/disable the integration */
  enabled?: boolean

  /** Rate limiting */
  rateLimit?: {
    max: number
    windowMs: number
  }

  /** Authentication */
  auth?: {
    required: boolean
    apiKeys?: string[]
  }

  /** CORS settings */
  cors?: {
    origin: string | string[]
    methods?: string[]
    credentials?: boolean
  }
}

/**
 * Health status for an integration
 */
export interface IntegrationHealthStatus {
  name: string
  status: 'healthy' | 'degraded' | 'unhealthy' | 'stopped'
  message?: string
  uptimeMs?: number
  requestCount?: number
  errorCount?: number
  lastError?: string
  checkedAt: number
}

// ============================================================================
// OData - Excel Power Query, Power BI, Tableau
// ============================================================================

/**
 * OData query options parsed from URL
 */
export interface ODataQueryOptions {
  /** $filter expression */
  filter?: string

  /** $select columns */
  select?: string[]

  /** $orderby specification */
  orderBy?: Array<{ field: string; direction: 'asc' | 'desc' }>

  /** $top (limit) */
  top?: number

  /** $skip (offset) */
  skip?: number

  /** $expand relations */
  expand?: string[]

  /** $count - include total count */
  count?: boolean

  /** $search - full text search */
  search?: string
}

// ============================================================================
// Webhooks - Push notifications
// ============================================================================

/**
 * Webhook registration
 */
export interface WebhookRegistration {
  id: string
  url: string
  events: EventFilter
  secret?: string
  active: boolean
  retryPolicy?: {
    maxRetries: number
    backoffMultiplier: number
    initialDelayMs: number
    maxDelayMs: number
  }
  createdAt: number
  lastDeliveryAt?: number
  failureCount?: number
}

/**
 * Webhook delivery result
 */
export interface WebhookDeliveryResult {
  webhookId: string
  eventId: string
  success: boolean
  statusCode?: number
  error?: string
  attempts: number
  timestamp: number
}
