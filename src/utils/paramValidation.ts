/**
 * Zero-Config Parameter Validation
 * 
 * Self-configuring validation that adapts to system capabilities
 * Only enforces universal truths, learns everything else
 */

import { FindParams, AddParams, UpdateParams, RelateParams } from '../types/brainy.types.js'
import { NounType, VerbType } from '../types/graphTypes.js'

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
        Math.floor(options.reservedQueryMemory / (1024 * 1024 * 100)) * 1000
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
        Math.floor(queryMemory / (1024 * 1024 * 100)) * 1000
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
      Math.floor(availableMemory / (1024 * 1024 * 100)) * 1000
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
    if (params.limit > config.maxLimit) {
      throw new Error(`limit exceeds auto-configured maximum of ${config.maxLimit} (based on available memory)`)
    }
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
      `\nExample: await brain.add({ data: 'text', type: NounType.Note })`
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
  if (!params.data && !params.metadata && !params.type && !params.vector) {
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