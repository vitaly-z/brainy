/**
 * Memory Detection Utilities
 * Detects available system memory across different environments:
 * - Docker/Kubernetes (cgroups v1 and v2)
 * - Bare metal servers
 * - Cloud instances
 * - Development environments
 *
 * Scales from 2GB to 128GB+ with intelligent allocation
 */

import * as os from 'os'
import * as fs from 'fs'
import { prodLog } from './logger.js'

export interface MemoryInfo {
  /** Total memory available to this process (bytes) */
  available: number

  /** Source of memory information */
  source: 'cgroup-v2' | 'cgroup-v1' | 'system' | 'fallback'

  /** Whether running in a container */
  isContainer: boolean

  /** System total memory (may differ from available in containers) */
  systemTotal: number

  /** Currently free memory (best-effort estimate) */
  free: number

  /** Detection warnings (if any) */
  warnings: string[]
}

export interface CacheAllocationStrategy {
  /** Recommended cache size (bytes) */
  cacheSize: number

  /** Allocation ratio used (0-1) */
  ratio: number

  /** Minimum guaranteed size (bytes) */
  minSize: number

  /** Maximum allowed size (bytes) */
  maxSize: number | null

  /** Environment type detected */
  environment: 'production' | 'development' | 'container' | 'unknown'

  /** Model memory reserved (bytes) */
  modelMemory: number

  /** Model precision (q8 or fp32) */
  modelPrecision: 'q8' | 'fp32'

  /** Available memory after model reservation (bytes) */
  availableForCache: number

  /** Reasoning for allocation */
  reasoning: string
}

/**
 * Detect available memory across all environments
 */
export function detectAvailableMemory(): MemoryInfo {
  const warnings: string[] = []

  // Try cgroups v2 first (modern Docker/K8s)
  const cgroupV2 = detectCgroupV2Memory()
  if (cgroupV2 !== null) {
    const systemTotal = os.totalmem()
    const free = os.freemem()

    return {
      available: cgroupV2,
      source: 'cgroup-v2',
      isContainer: true,
      systemTotal,
      free,
      warnings: cgroupV2 < systemTotal
        ? [`Container limited to ${formatBytes(cgroupV2)} (host has ${formatBytes(systemTotal)})`]
        : []
    }
  }

  // Try cgroups v1 (older Docker/K8s)
  const cgroupV1 = detectCgroupV1Memory()
  if (cgroupV1 !== null) {
    const systemTotal = os.totalmem()
    const free = os.freemem()

    return {
      available: cgroupV1,
      source: 'cgroup-v1',
      isContainer: true,
      systemTotal,
      free,
      warnings: cgroupV1 < systemTotal
        ? [`Container limited to ${formatBytes(cgroupV1)} (host has ${formatBytes(systemTotal)})`]
        : []
    }
  }

  // Use system memory (bare metal, VM, or unlimited container)
  const systemTotal = os.totalmem()
  const free = os.freemem()

  // Check if we might be in an unlimited container
  if (process.env.KUBERNETES_SERVICE_HOST || process.env.DOCKER_CONTAINER) {
    warnings.push('Container detected but no memory limit set - using host memory')
  }

  return {
    available: systemTotal,
    source: 'system',
    isContainer: false,
    systemTotal,
    free,
    warnings
  }
}

/**
 * Detect memory limit from cgroups v2 (modern containers)
 * Path: /sys/fs/cgroup/memory.max
 */
function detectCgroupV2Memory(): number | null {
  try {
    const memoryMaxPath = '/sys/fs/cgroup/memory.max'

    if (!fs.existsSync(memoryMaxPath)) {
      return null
    }

    const content = fs.readFileSync(memoryMaxPath, 'utf8').trim()

    // 'max' means unlimited
    if (content === 'max') {
      return null
    }

    const bytes = parseInt(content, 10)

    // Sanity check: Must be reasonable number (between 64MB and 1TB)
    if (bytes < 64 * 1024 * 1024 || bytes > 1024 * 1024 * 1024 * 1024) {
      prodLog.warn(`Suspicious cgroup v2 memory limit: ${formatBytes(bytes)}`)
      return null
    }

    return bytes
  } catch (error) {
    // Not in a cgroup v2 environment
    return null
  }
}

/**
 * Detect memory limit from cgroups v1 (older containers)
 * Path: /sys/fs/cgroup/memory/memory.limit_in_bytes
 */
function detectCgroupV1Memory(): number | null {
  try {
    const limitPath = '/sys/fs/cgroup/memory/memory.limit_in_bytes'

    if (!fs.existsSync(limitPath)) {
      return null
    }

    const content = fs.readFileSync(limitPath, 'utf8').trim()
    const bytes = parseInt(content, 10)

    // cgroup v1 uses very large number (2^63-1) to indicate unlimited
    // If limit is > 1TB, consider it unlimited
    if (bytes > 1024 * 1024 * 1024 * 1024) {
      return null
    }

    // Sanity check: Must be reasonable number (between 64MB and 1TB)
    if (bytes < 64 * 1024 * 1024) {
      prodLog.warn(`Suspicious cgroup v1 memory limit: ${formatBytes(bytes)}`)
      return null
    }

    return bytes
  } catch (error) {
    // Not in a cgroup v1 environment
    return null
  }
}

/**
 * Calculate optimal cache size based on available memory
 * Scales intelligently from 2GB to 128GB+
 *
 * Accounts for embedding model memory (150MB Q8, 250MB FP32)
 */
export function calculateOptimalCacheSize(
  memoryInfo: MemoryInfo,
  options: {
    /** Manual override (bytes) - takes precedence */
    manualSize?: number

    /** Minimum cache size (bytes) - default 256MB */
    minSize?: number

    /** Maximum cache size (bytes) - default unlimited */
    maxSize?: number

    /** Force development mode allocation (more conservative) */
    developmentMode?: boolean

    /** Model precision for memory calculation - default 'q8' */
    modelPrecision?: 'q8' | 'fp32'
  } = {}
): CacheAllocationStrategy {
  const minSize = options.minSize || 256 * 1024 * 1024  // 256MB minimum
  const maxSize = options.maxSize || null

  // Detect model memory usage
  const modelInfo = detectModelMemory({ precision: options.modelPrecision || 'q8' })
  const modelMemory = modelInfo.bytes

  // Reserve model memory from available RAM BEFORE calculating cache
  // This ensures we don't over-allocate and cause OOM
  const availableForCache = Math.max(0, memoryInfo.available - modelMemory)

  // Manual override takes precedence
  if (options.manualSize !== undefined) {
    const clamped = Math.max(minSize, options.manualSize)
    return {
      cacheSize: clamped,
      ratio: clamped / availableForCache,
      minSize,
      maxSize,
      environment: 'unknown',
      modelMemory,
      modelPrecision: modelInfo.precision,
      availableForCache,
      reasoning: 'Manual override specified'
    }
  }

  // Determine environment and allocation ratio
  let ratio: number
  let environment: CacheAllocationStrategy['environment']
  let reasoning: string

  if (options.developmentMode || process.env.NODE_ENV === 'development') {
    // Development: More conservative (25%)
    ratio = 0.25
    environment = 'development'
    reasoning = `Development mode - conservative allocation (25% of ${formatBytes(availableForCache)} after ${formatBytes(modelMemory)} model)`
  } else if (memoryInfo.isContainer) {
    // Container: Moderate allocation (40%)
    // Containers often have tight limits, leave room for heap growth
    ratio = 0.40
    environment = 'container'
    reasoning = `Container environment - moderate allocation (40% of ${formatBytes(availableForCache)} after ${formatBytes(modelMemory)} model)`
  } else {
    // Production bare metal/VM: Aggressive allocation (50%)
    // More memory available, can be more aggressive
    ratio = 0.50
    environment = 'production'
    reasoning = `Production environment - aggressive allocation (50% of ${formatBytes(availableForCache)} after ${formatBytes(modelMemory)} model)`
  }

  // Calculate base cache size from AVAILABLE memory (after model reservation)
  let cacheSize = Math.floor(availableForCache * ratio)

  // Apply minimum constraint
  if (cacheSize < minSize) {
    const originalSize = cacheSize
    cacheSize = minSize
    reasoning += ` (increased from ${formatBytes(originalSize)} to meet minimum)`

    // Warn if available memory is very low
    if (availableForCache < minSize * 2) {
      prodLog.warn(
        `⚠️  Low available memory for cache (${formatBytes(availableForCache)} after ${formatBytes(modelMemory)} model). ` +
        `Cache size ${formatBytes(cacheSize)} may cause memory pressure.`
      )
    }
  }

  // Apply maximum constraint
  if (maxSize !== null && cacheSize > maxSize) {
    const originalSize = cacheSize
    cacheSize = maxSize
    reasoning += ` (capped from ${formatBytes(originalSize)} to maximum)`
  }

  // Intelligent scaling for large memory systems
  // For systems with >64GB available for cache, use logarithmic scaling to avoid over-allocation
  if (availableForCache > 64 * 1024 * 1024 * 1024) {
    // Above 64GB, scale more conservatively
    // Formula: base + log2(availableForCache/64GB) * 8GB
    const base = 32 * 1024 * 1024 * 1024  // 32GB base
    const scaleFactor = Math.log2(availableForCache / (64 * 1024 * 1024 * 1024))
    const scaled = base + scaleFactor * 8 * 1024 * 1024 * 1024  // +8GB per doubling

    if (scaled < cacheSize) {
      const originalSize = cacheSize
      cacheSize = Math.floor(scaled)
      reasoning += ` (scaled down from ${formatBytes(originalSize)} for large memory system)`
    }
  }

  return {
    cacheSize,
    ratio,
    minSize,
    maxSize,
    environment,
    modelMemory,
    modelPrecision: modelInfo.precision,
    availableForCache,
    reasoning
  }
}

/**
 * Get recommended cache configuration for current environment
 */
export function getRecommendedCacheConfig(options: {
  /** Manual cache size override (bytes) */
  manualSize?: number

  /** Minimum cache size (bytes) */
  minSize?: number

  /** Maximum cache size (bytes) */
  maxSize?: number

  /** Force development mode */
  developmentMode?: boolean
} = {}): {
  memoryInfo: MemoryInfo
  allocation: CacheAllocationStrategy
  warnings: string[]
} {
  const memoryInfo = detectAvailableMemory()
  const allocation = calculateOptimalCacheSize(memoryInfo, options)

  const warnings: string[] = [...memoryInfo.warnings]

  // Add allocation warnings
  if (allocation.cacheSize === allocation.minSize) {
    warnings.push(
      `Cache size at minimum (${formatBytes(allocation.minSize)}). ` +
      `Consider increasing available memory for better performance.`
    )
  }

  if (allocation.ratio > 0.6) {
    warnings.push(
      `Cache using ${(allocation.ratio * 100).toFixed(0)}% of available memory. ` +
      `Monitor for memory pressure.`
    )
  }

  return {
    memoryInfo,
    allocation,
    warnings
  }
}

/**
 * Detect embedding model memory usage
 *
 * Returns estimated runtime memory for the Candle WASM embedding engine:
 * - WASM module: ~90MB (includes model weights embedded at compile time)
 * - Session workspace: ~50MB (peak during inference)
 * - Total: ~140MB
 *
 * The model (all-MiniLM-L6-v2) is embedded in the WASM binary,
 * so there's no separate model download or loading.
 */
export function detectModelMemory(options: {
  /** Model precision (default: 'q8') - kept for backward compatibility */
  precision?: 'q8' | 'fp32'
} = {}): {
  bytes: number
  precision: 'q8' | 'fp32'
  breakdown: {
    modelWeights: number
    wasmRuntime: number
    sessionWorkspace: number
  }
} {
  // Candle WASM uses FP32 internally (safetensors format)
  // Model is embedded in WASM binary (~90MB total)
  return {
    bytes: 140 * 1024 * 1024,  // 140MB total runtime
    precision: 'q8',  // Kept for API compatibility
    breakdown: {
      modelWeights: 87 * 1024 * 1024,      // 87MB (safetensors format)
      wasmRuntime: 3 * 1024 * 1024,        // 3MB (Candle runtime code)
      sessionWorkspace: 50 * 1024 * 1024   // 50MB (peak during inference)
    }
  }
}

/**
 * Format bytes to human-readable string
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'

  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))

  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`
}

/**
 * Monitor memory usage and warn if approaching limits
 */
export function checkMemoryPressure(
  cacheSize: number,
  memoryInfo: MemoryInfo
): {
  pressure: 'none' | 'moderate' | 'high' | 'critical'
  warnings: string[]
} {
  const warnings: string[] = []
  const heapUsed = process.memoryUsage().heapUsed
  const totalUsed = heapUsed + cacheSize
  const utilization = totalUsed / memoryInfo.available

  if (utilization > 0.95) {
    warnings.push(
      `🔴 CRITICAL: Memory utilization at ${(utilization * 100).toFixed(1)}%. ` +
      `Reduce cache size or increase available memory.`
    )
    return { pressure: 'critical', warnings }
  }

  if (utilization > 0.85) {
    warnings.push(
      `🟠 HIGH: Memory utilization at ${(utilization * 100).toFixed(1)}%. ` +
      `Consider increasing available memory.`
    )
    return { pressure: 'high', warnings }
  }

  if (utilization > 0.70) {
    warnings.push(
      `🟡 MODERATE: Memory utilization at ${(utilization * 100).toFixed(1)}%. ` +
      `Monitor for memory pressure.`
    )
    return { pressure: 'moderate', warnings }
  }

  return { pressure: 'none', warnings: [] }
}
