/**
 * Model Configuration Auto-Selection
 * Always uses Q8 for optimal size/performance balance (99% accuracy, 75% smaller)
 */

import { isBrowser, isNode } from '../utils/environment.js'

export type ModelPrecision = 'q8'
export type ModelPreset = 'small' | 'auto'

interface ModelConfigResult {
  precision: ModelPrecision
  reason: string
  autoSelected: boolean
}

/**
 * Auto-select model precision - Always returns Q8
 * Q8 provides 99% accuracy with 75% smaller size
 * @param override - For backward compatibility, ignored
 */
export function autoSelectModelPrecision(override?: ModelPrecision | ModelPreset): ModelConfigResult {
  // Always use Q8 regardless of override for simplicity
  // Q8 is optimal: 33MB vs 130MB, 99% accuracy retained
  
  // Log deprecation notice if FP32 was requested
  if (typeof override === 'string' && override.toLowerCase().includes('fp32')) {
    console.log('Note: FP32 precision is deprecated. Using Q8 (99% accuracy, 75% smaller).')
  }
  
  return {
    precision: 'q8',
    reason: 'Q8 precision (99% accuracy, 75% smaller)',
    autoSelected: true
  }
}

/**
 * Automatically detect the best model precision for the environment
 * DEPRECATED: Always returns Q8 now
 */
function autoDetectBestPrecision(): ModelConfigResult {
  // Always return Q8 - deprecated function kept for backward compatibility
  return {
    precision: 'q8',
    reason: 'Q8 precision (99% accuracy, 75% smaller)',
    autoSelected: true
  }
}

/**
 * Check if running in a serverless environment
 */
function isServerlessEnvironment(): boolean {
  if (!isNode()) return false
  
  return !!(
    process.env.AWS_LAMBDA_FUNCTION_NAME ||
    process.env.VERCEL ||
    process.env.NETLIFY ||
    process.env.CLOUDFLARE_WORKERS ||
    process.env.FUNCTIONS_WORKER_RUNTIME ||
    process.env.K_SERVICE // Google Cloud Run
  )
}

/**
 * Get available memory in MB
 */
function getAvailableMemoryMB(): number {
  if (isBrowser()) {
    // @ts-ignore - navigator.deviceMemory is experimental
    if (navigator.deviceMemory) {
      // @ts-ignore
      return navigator.deviceMemory * 1024 // Device memory in GB
    }
    return 256 // Conservative default for browsers
  }
  
  if (isNode()) {
    try {
      // Try to get memory info synchronously for Node.js
      // This will be available in Node.js environments
      if (typeof process !== 'undefined' && process.memoryUsage) {
        // Use RSS (Resident Set Size) as a proxy for available memory
        const rss = process.memoryUsage().rss
        // Assume we can use up to 4GB or 50% more than current usage
        return Math.min(4096, Math.floor(rss / (1024 * 1024) * 1.5))
      }
    } catch {
      // Fall through to default
    }
    return 1024 // Default 1GB for Node.js
  }
  
  return 512 // Conservative default
}

/**
 * Convenience function to check if models need to be downloaded
 * This replaces the need for BRAINY_ALLOW_REMOTE_MODELS
 */
export function shouldAutoDownloadModels(): boolean {
  // Always allow downloads unless explicitly disabled
  // This eliminates the need for BRAINY_ALLOW_REMOTE_MODELS
  const explicitlyDisabled = process.env.BRAINY_ALLOW_REMOTE_MODELS === 'false'
  
  if (explicitlyDisabled) {
    console.warn('Model downloads disabled via BRAINY_ALLOW_REMOTE_MODELS=false')
    return false
  }
  
  // In production, always allow downloads for seamless operation
  if (process.env.NODE_ENV === 'production') {
    return true
  }
  
  // In development, allow downloads with a one-time notice
  if (process.env.NODE_ENV === 'development') {
    return true
  }
  
  // Default: allow downloads
  return true
}

/**
 * Get the model path with intelligent defaults
 * This replaces the need for BRAINY_MODELS_PATH env var
 */
export function getModelPath(): string {
  // Check if user explicitly set a path (keeping this for advanced users)
  if (process.env.BRAINY_MODELS_PATH) {
    return process.env.BRAINY_MODELS_PATH
  }
  
  // Browser - use cache API or IndexedDB (handled by transformers.js)
  if (isBrowser()) {
    return 'browser-cache'
  }
  
  // Serverless - use /tmp for ephemeral storage
  if (isServerlessEnvironment()) {
    return '/tmp/.brainy/models'
  }
  
  // Node.js - use home directory for persistent storage
  if (isNode()) {
    // Use process.env.HOME as a fallback
    const homeDir = process.env.HOME || process.env.USERPROFILE || '~'
    return `${homeDir}/.brainy/models`
  }
  
  // Fallback
  return './.brainy/models'
}

/**
 * Log model configuration decision (only in verbose mode)
 */
export function logModelConfig(config: ModelConfigResult, verbose: boolean = false): void {
  if (!verbose && process.env.NODE_ENV === 'production') {
    return // Silent in production unless verbose
  }
  
  const icon = config.autoSelected ? '🤖' : '👤'
  console.log(`${icon} Model: ${config.precision.toUpperCase()} - ${config.reason}`)
}