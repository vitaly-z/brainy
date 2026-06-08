/**
 * Zero-Config Parameter Validation
 * 
 * Self-configuring validation that adapts to system capabilities
 * Only enforces universal truths, learns everything else
 */

import { FindParams, AddParams, UpdateParams, RelateParams, UpdateRelationParams } from '../types/brainy.types.js'
import { NounType, VerbType } from '../types/graphTypes.js'
import { prodLog } from './logger.js'
import { findCallerLocation } from './callerLocation.js'

// Dynamic import for Node.js os and fs modules
let os: any = null
let fs: any = null
if (typeof window === 'undefined') {
  try {
    os = await import('node:os')
    fs = await import('node:fs')
  } catch (e) {
    // OS/FS modules not available
  }
}

// Browser-safe memory detection
const getSystemMemory = (): number => {
  if (os) {
    return os.totalmem()
  }
  // Browser fallback: assume 4GB
  return 4 * 1024 * 1024 * 1024
}

const getAvailableMemory = (): number => {
  if (os) {
    return os.freemem()
  }
  // Browser fallback: assume 2GB available
  return 2 * 1024 * 1024 * 1024
}

/**
 * Detect container memory limit (Docker/Kubernetes/Cloud Run)
 *
 * Production-grade detection for containerized environments.
 * Supports:
 * - cgroup v1 (legacy Docker/K8s)
 * - cgroup v2 (modern systems)
 * - Environment variables (Cloud Run, GCP, AWS, Azure)
 *
 * @returns Container memory limit in bytes, or null if not containerized
 */
const getContainerMemoryLimit = (): number | null => {
  // Not in Node.js environment
  if (!fs) {
    return null
  }

  try {
    // 1. Check environment variables first (fastest, most reliable for Cloud Run)
    // Google Cloud Run
    if (process.env.CLOUD_RUN_MEMORY) {
      // Format: "512Mi", "1Gi", "2Gi", "4Gi"
      const match = process.env.CLOUD_RUN_MEMORY.match(/^(\d+)(Mi|Gi)$/)
      if (match) {
        const value = parseInt(match[1])
        const unit = match[2]
        return unit === 'Gi' ? value * 1024 * 1024 * 1024 : value * 1024 * 1024
      }
    }

    // Generic MEMORY_LIMIT env var (bytes)
    if (process.env.MEMORY_LIMIT) {
      const limit = parseInt(process.env.MEMORY_LIMIT)
      if (!isNaN(limit) && limit > 0) {
        return limit
      }
    }

    // 2. Check cgroup v2 (modern Docker/K8s)
    try {
      const cgroupV2Path = '/sys/fs/cgroup/memory.max'
      const cgroupV2Content = fs.readFileSync(cgroupV2Path, 'utf8').trim()

      // "max" means no limit, otherwise it's bytes
      if (cgroupV2Content !== 'max') {
        const limit = parseInt(cgroupV2Content)
        if (!isNaN(limit) && limit > 0) {
          return limit
        }
      }
    } catch (e) {
      // cgroup v2 not available, try v1
    }

    // 3. Check cgroup v1 (legacy Docker/K8s)
    try {
      const cgroupV1Path = '/sys/fs/cgroup/memory/memory.limit_in_bytes'
      const cgroupV1Content = fs.readFileSync(cgroupV1Path, 'utf8').trim()

      const limit = parseInt(cgroupV1Content)

      // Very large values (> 1 PB) indicate no limit
      const ONE_PETABYTE = 1024 * 1024 * 1024 * 1024 * 1024
      if (!isNaN(limit) && limit > 0 && limit < ONE_PETABYTE) {
        return limit
      }
    } catch (e) {
      // cgroup v1 not available
    }

    // Not containerized or no limit set
    return null

  } catch (e) {
    // Error reading cgroup files
    return null
  }
}

/**
 * Memory budget per query result, in KB. Used by the auto-configured
 * `maxLimit` formula across all three memory-derived priorities (reserved /
 * container / free).
 *
 * Calibration history:
 * - Pre-7.30.2: `100` (assumed 100 KB per result). Way too conservative —
 *   actual entity footprint in Brainy is 7-10 KB (384-dim float32 vector ≈
 *   1.5 KB + standard fields + metadata). On a 900 MB free-memory box this
 *   capped `limit` at 9_000, breaking common safety-cap call patterns like
 *   `find({ type, where, limit: 10_000 })` that typically return 10-500
 *   entities. Surfaced as `BR-MAXLIMIT-9000` in PLATFORM-HANDOFF.md.
 * - 7.30.2+: `25` (assumes 25 KB per result). Generous over typical (7-10 KB),
 *   comfortably under the worst case (~20 KB with large metadata blobs).
 *   Same 900 MB box now gives ~36_000 — typical 10_000 limits pass silently,
 *   the warning tier surfaces around 36-72 K (encouraging pagination), and
 *   the throw tier still fires before OOM territory (72 K+).
 */
const MAX_LIMIT_KB_PER_RESULT = 25

/**
 * One-time-per-call-site warning dedup. Keyed on the caller location returned
 * by `findCallerLocation()` plus the exceeding limit value so the warning fires
 * once per offending source line (not once per query). Survives the lifetime of
 * the process — that's intentional: the warning is a teaching signal, not a
 * recurring nag. Used by the two-tier limit enforcement in `validateFindParams`.
 */
const seenLimitWarnings = new Set<string>()

/**
 * Reset the limit-warning dedup. For tests that need a clean slate; production
 * code should never call this.
 */
export function resetLimitWarningCache(): void {
  seenLimitWarnings.clear()
}

/**
 * Configuration options for ValidationConfig
 */
export interface ValidationConfigOptions {
  /**
   * Explicit maximum query limit override
   * Bypasses all auto-detection
   */
  maxQueryLimit?: number

  /**
   * Memory reserved for query operations (in bytes)
   * Bypasses auto-detection but still applies safety limits
   */
  reservedQueryMemory?: number
}

/**
 * Auto-configured limits based on system resources
 * These adapt to available memory and observed performance
 */
export class ValidationConfig {
  private static instance: ValidationConfig

  // Dynamic limits based on system
  public maxLimit: number
  public maxQueryLength: number
  public maxVectorDimensions: number

  // Tracking for diagnostics
  public limitBasis: 'override' | 'reservedMemory' | 'containerMemory' | 'freeMemory'
  public detectedContainerLimit: number | null

  // Performance observations
  private avgQueryTime: number = 0
  private queryCount: number = 0

  private constructor(options?: ValidationConfigOptions) {
    // Vector dimensions (standard for all-MiniLM-L6-v2)
    this.maxVectorDimensions = 384

    // Detect container memory limit
    this.detectedContainerLimit = getContainerMemoryLimit()

    // Priority 1: Explicit override (highest priority)
    if (options?.maxQueryLimit !== undefined) {
      this.maxLimit = Math.min(options.maxQueryLimit, 100000)  // Still cap at 100k for safety
      this.limitBasis = 'override'

      // Scale query length with limit
      this.maxQueryLength = Math.min(50000, this.maxLimit * 5)
      return
    }

    // Priority 2: Reserved memory specified
    if (options?.reservedQueryMemory !== undefined) {
      this.maxLimit = Math.min(
        100000,
        Math.floor(options.reservedQueryMemory / (1024 * 1024 * MAX_LIMIT_KB_PER_RESULT)) * 1000
      )
      this.limitBasis = 'reservedMemory'

      this.maxQueryLength = Math.min(
        50000,
        Math.floor(options.reservedQueryMemory / (1024 * 1024 * 10)) * 1000
      )
      return
    }

    // Priority 3: Container detected (smart containerized behavior)
    if (this.detectedContainerLimit) {
      // In containers, assume 75% used by graph data (EXPECTED)
      // Reserve 25% for query operations
      const queryMemory = this.detectedContainerLimit * 0.25

      this.maxLimit = Math.min(
        100000,
        Math.floor(queryMemory / (1024 * 1024 * MAX_LIMIT_KB_PER_RESULT)) * 1000
      )
      this.limitBasis = 'containerMemory'

      this.maxQueryLength = Math.min(
        50000,
        Math.floor(queryMemory / (1024 * 1024 * 10)) * 1000
      )
      return
    }

    // Priority 4: Free memory (fallback, current behavior)
    const availableMemory = getAvailableMemory()

    this.maxLimit = Math.min(
      100000,
      Math.floor(availableMemory / (1024 * 1024 * MAX_LIMIT_KB_PER_RESULT)) * 1000
    )
    this.limitBasis = 'freeMemory'

    this.maxQueryLength = Math.min(
      50000,
      Math.floor(availableMemory / (1024 * 1024 * 10)) * 1000
    )
  }

  static getInstance(options?: ValidationConfigOptions): ValidationConfig {
    if (!ValidationConfig.instance) {
      ValidationConfig.instance = new ValidationConfig(options)
    }
    return ValidationConfig.instance
  }

  /**
   * Reset singleton (for testing or reconfiguration)
   */
  static reset(): void {
    ValidationConfig.instance = null as any
  }

  /**
   * Reconfigure with new options
   */
  static reconfigure(options: ValidationConfigOptions): ValidationConfig {
    ValidationConfig.instance = new ValidationConfig(options)
    return ValidationConfig.instance
  }

  /**
   * Learn from actual usage to adjust limits
   */
  recordQuery(duration: number, resultCount: number) {
    this.queryCount++
    this.avgQueryTime = (this.avgQueryTime * (this.queryCount - 1) + duration) / this.queryCount

    // Only auto-adjust if not using explicit overrides
    if (this.limitBasis !== 'override') {
      // If queries are consistently fast with large results, increase limits
      if (this.avgQueryTime < 100 && resultCount > this.maxLimit * 0.8) {
        this.maxLimit = Math.min(this.maxLimit * 1.5, 100000)
      }

      // If queries are slow, reduce limits
      if (this.avgQueryTime > 1000) {
        this.maxLimit = Math.max(this.maxLimit * 0.8, 1000)
      }
    }
  }
}

/**
 * Two-tier limit enforcement for `find({ limit })`. Compares the requested
 * limit against the auto-configured (or consumer-overridden) `maxLimit` and
 * picks one of three outcomes:
 *
 * 1. **Pass** — `limit <= maxLimit`. The configured cap was set with this
 *    consumer's use case in mind; no signal, no friction.
 *
 * 2. **Warn** — `maxLimit < limit <= 2 * maxLimit`. The consumer is asking
 *    for more than the cap, but not enough to be in OOM territory. Log a
 *    one-time warning per call site (dedup keyed on stack location + limit
 *    value) explaining the cap, the three escape valves, and the docs link.
 *    The query proceeds. Pre-7.30.2 code that relied on the cap silently
 *    allowing typical safety-cap limits (`10_000`) keeps working; the
 *    warning teaches the migration.
 *
 * 3. **Throw** — `limit > 2 * maxLimit`. Real OOM danger territory. Throw
 *    with the same message format the warning uses so the consumer gets
 *    consistent guidance whether they hit the soft or hard threshold.
 *
 * The 2× soft margin is chosen to absorb existing safety-cap patterns
 * (`limit: 10_000` against a `maxLimit: 9_000` box, common case at 7.30 GA)
 * without disabling OOM protection. Real OOM territory on a JS in-memory
 * brain is hundreds of thousands of results, not 10× the safety cap.
 *
 * Both warning and throw paths use the same formatter so the rendered message
 * is identical — consumers see the same recipe regardless of which threshold
 * they crossed.
 *
 * @param limit - The requested `limit` value (already validated non-negative)
 * @param config - The active ValidationConfig (carries `maxLimit` + basis)
 * @throws When `limit > 2 * config.maxLimit`
 *
 * @since 7.30.2 (replaced the unconditional throw added in 7.30.0)
 */
function enforceLimitCap(limit: number, config: ValidationConfig): void {
  if (limit <= config.maxLimit) return

  const message = formatLimitMessage(limit, config)
  const hardCeiling = config.maxLimit * 2

  if (limit > hardCeiling) {
    // OOM danger zone — throw to prevent runaway memory allocation
    throw new Error(message)
  }

  // Soft margin: warn once per call site + limit value, then let the query proceed.
  // Survives the lifetime of the process; the goal is to teach the migration recipe,
  // not to spam the log every query.
  const caller = findCallerLocation(['validateFindParams', 'enforceLimitCap', 'formatLimitMessage']) ?? '<unknown caller>'
  const dedupKey = `${caller}|${limit}`
  if (!seenLimitWarnings.has(dedupKey)) {
    seenLimitWarnings.add(dedupKey)
    prodLog.warn('[Brainy] ' + message)
  }
}

/**
 * Render the user-facing message used by both the warning tier and the throw
 * tier of `enforceLimitCap`. Same body shape as the 7.30.1 enforcement-error
 * messages: state the problem, name the recipe, point at the call site, link
 * the docs.
 */
function formatLimitMessage(limit: number, config: ValidationConfig): string {
  const cap = config.maxLimit
  const basis = config.limitBasis
  const basisLabel: Record<string, string> = {
    override: 'consumer-supplied `maxQueryLimit`',
    reservedMemory: 'consumer-supplied `reservedQueryMemory`',
    containerMemory: 'detected container memory limit',
    freeMemory: 'available free memory'
  }
  const basisText = basisLabel[basis] ?? 'available memory'
  const caller = findCallerLocation(['enforceLimitCap', 'formatLimitMessage'])

  const lines = [
    `find({ limit: ${limit} }) exceeds the auto-configured query limit of ${cap} (basis: ${basisText}). Choose one:`,
    `  • Increase the cap: new Brainy({ maxQueryLimit: ${Math.min(limit, 100000)} })`,
    `  • Reserve more memory: new Brainy({ reservedQueryMemory: ${limit * MAX_LIMIT_KB_PER_RESULT * 1024} })`,
    '  • Paginate: split the query with { limit, offset } pages'
  ]
  if (caller) {
    lines.push(`  at ${caller}`)
  }
  lines.push('Docs: https://soulcraft.com/docs/guides/find-limits')

  return lines.join('\n')
}

/**
 * Universal validations - things that are always invalid
 * These are mathematical/logical truths, not configuration
 */
export function validateFindParams(params: FindParams): void {
  const config = ValidationConfig.getInstance()
  
  // Universal truth: negative pagination never makes sense
  if (params.limit !== undefined) {
    if (params.limit < 0) {
      throw new Error('limit must be non-negative')
    }
    enforceLimitCap(params.limit, config)
  }
  
  if (params.offset !== undefined && params.offset < 0) {
    throw new Error('offset must be non-negative')
  }
  
  // Universal truth: probability/similarity must be 0-1
  if (params.near?.threshold !== undefined) {
    const t = params.near.threshold
    if (t < 0 || t > 1) {
      throw new Error('threshold must be between 0 and 1')
    }
  }
  
  // Universal truth: can't specify both query and vector (they're alternatives)
  if (params.query !== undefined && params.vector !== undefined) {
    throw new Error('cannot specify both query and vector - they are mutually exclusive')
  }
  
  // Universal truth: can't use both cursor and offset pagination
  if (params.cursor !== undefined && params.offset !== undefined) {
    throw new Error('cannot use both cursor and offset pagination simultaneously')
  }
  
  // Auto-limit query length based on memory
  if (params.query && params.query.length > config.maxQueryLength) {
    throw new Error(`query exceeds auto-configured maximum length of ${config.maxQueryLength} characters`)
  }
  
  // Validate vector dimensions if provided
  if (params.vector && params.vector.length !== config.maxVectorDimensions) {
    throw new Error(`vector must have exactly ${config.maxVectorDimensions} dimensions`)
  }
  
  // Validate enum types if specified
  if (params.type) {
    const types = Array.isArray(params.type) ? params.type : [params.type]
    for (const type of types) {
      if (!Object.values(NounType).includes(type)) {
        throw new Error(`invalid NounType: ${type}`)
      }
    }
  }
}

/**
 * Validate add parameters
 */
export function validateAddParams(params: AddParams): void {
  // Universal truth: must have data or vector
  if (!params.data && !params.vector) {
    throw new Error(
      `Invalid add() parameters: Missing required field 'data'\n` +
      `\nReceived: ${JSON.stringify({
        type: params.type,
        hasMetadata: !!params.metadata,
        hasId: !!params.id
      }, null, 2)}\n` +
      `\nExpected one of:\n` +
      `  { data: 'text to store', type?: 'note', metadata?: {...} }\n` +
      `  { vector: [0.1, 0.2, ...], type?: 'embedding', metadata?: {...} }\n` +
      `\nExamples:\n` +
      `  await brain.add({ data: 'Machine learning is AI', type: 'concept' })\n` +
      `  await brain.add({ data: { title: 'Doc', content: '...' }, type: 'document' })`
    )
  }
  
  // Validate noun type
  if (!Object.values(NounType).includes(params.type)) {
    throw new Error(
      `Invalid NounType: '${params.type}'\n` +
      `\nValid types: ${Object.values(NounType).join(', ')}\n` +
      `\nExample: await brain.add({ data: 'text', type: NounType.Document })`
    )
  }
  
  // Validate vector dimensions if provided
  if (params.vector) {
    const config = ValidationConfig.getInstance()
    if (params.vector.length !== config.maxVectorDimensions) {
      throw new Error(`vector must have exactly ${config.maxVectorDimensions} dimensions`)
    }
  }
}

/**
 * Validate update parameters
 */
export function validateUpdateParams(params: UpdateParams): void {
  // Universal truth: must have an ID
  if (!params.id) {
    throw new Error('id is required for update')
  }
  
  // Universal truth: must update something
  if (
    !params.data &&
    !params.metadata &&
    !params.type &&
    !params.vector &&
    params.subtype === undefined &&
    params.confidence === undefined &&
    params.weight === undefined
  ) {
    throw new Error('must specify at least one field to update')
  }
  
  // Validate type if changing
  if (params.type && !Object.values(NounType).includes(params.type)) {
    throw new Error(`invalid NounType: ${params.type}`)
  }
  
  // Validate vector dimensions if provided
  if (params.vector) {
    const config = ValidationConfig.getInstance()
    if (params.vector.length !== config.maxVectorDimensions) {
      throw new Error(`vector must have exactly ${config.maxVectorDimensions} dimensions`)
    }
  }
}

/**
 * Validate relate parameters
 */
export function validateRelateParams(params: RelateParams): void {
  // Universal truths
  if (!params.from) {
    throw new Error('from entity ID is required')
  }

  if (!params.to) {
    throw new Error('to entity ID is required')
  }

  // Allow self-referential relationships - they're valid in graph systems
  // (e.g., a person can be related to themselves, a file can reference itself, etc.)

  // Validate verb type - default to RelatedTo if not specified
  if (params.type === undefined) {
    params.type = VerbType.RelatedTo
  } else if (!Object.values(VerbType).includes(params.type)) {
    throw new Error(`invalid VerbType: ${params.type}`)
  }

  // Universal truth: weight must be 0-1
  if (params.weight !== undefined) {
    if (params.weight < 0 || params.weight > 1) {
      throw new Error('weight must be between 0 and 1')
    }
  }
}

/**
 * Validate UpdateRelationParams. Mirror of validateUpdateParams for verbs —
 * requires id + at least one field to change; bounds-checks weight/confidence;
 * accepts type/subtype/weight/confidence/data/metadata changes.
 */
export function validateUpdateRelationParams(params: UpdateRelationParams): void {
  if (!params.id) {
    throw new Error('id is required for updateRelation')
  }

  if (
    !params.data &&
    !params.metadata &&
    !params.type &&
    params.subtype === undefined &&
    params.weight === undefined &&
    params.confidence === undefined
  ) {
    throw new Error('updateRelation: must specify at least one field to update')
  }

  if (params.type !== undefined && !Object.values(VerbType).includes(params.type)) {
    throw new Error(`invalid VerbType: ${params.type}`)
  }

  if (params.weight !== undefined && (params.weight < 0 || params.weight > 1)) {
    throw new Error('weight must be between 0 and 1')
  }

  if (params.confidence !== undefined && (params.confidence < 0 || params.confidence > 1)) {
    throw new Error('confidence must be between 0 and 1')
  }
}

/**
 * Get current validation configuration
 * Useful for debugging and monitoring
 */
export function getValidationConfig() {
  const config = ValidationConfig.getInstance()
  return {
    maxLimit: config.maxLimit,
    maxQueryLength: config.maxQueryLength,
    maxVectorDimensions: config.maxVectorDimensions,
    systemMemory: getSystemMemory(),
    availableMemory: getAvailableMemory()
  }
}

/**
 * Record query performance for auto-tuning
 */
export function recordQueryPerformance(duration: number, resultCount: number) {
  ValidationConfig.getInstance().recordQuery(duration, resultCount)
}