/**
 * Model Configuration Auto-Selection
 * Intelligently selects model precision based on environment
 * while allowing manual override
 */

import { isBrowser, isNode } from '../utils/environment.js'
import { setModelPrecision } from './modelPrecisionManager.js'

export type ModelPrecision = 'fp32' | 'q8'
export type ModelPreset = 'fast' | 'small' | 'auto'

interface ModelConfigResult {
  precision: ModelPrecision
  reason: string
  autoSelected: boolean
}

/**
 * Auto-select model precision based on environment and resources
 * DEFAULT: Q8 for optimal size/performance balance
 * @param override - Manual override: 'fp32', 'q8', 'fast' (fp32), 'small' (q8), or 'auto'
 */
export function autoSelectModelPrecision(override?: ModelPrecision | ModelPreset): ModelConfigResult {
  // Handle direct precision override
  if (override === 'fp32' || override === 'q8') {
    setModelPrecision(override) // Update central config
    return {
      precision: override,
      reason: `Manually specified: ${override}`,
      autoSelected: false
    }
  }
  
  // Handle preset overrides
  if (override === 'fast') {
    setModelPrecision('fp32') // Update central config
    return {
      precision: 'fp32',
      reason: 'Preset: fast (fp32 for best quality)',
      autoSelected: false
    }
  }
  
  if (override === 'small') {
    setModelPrecision('q8') // Update central config
    return {
      precision: 'q8',
      reason: 'Preset: small (q8 for reduced size)',
      autoSelected: false
    }
  }
  
  // Auto-selection logic
  return autoDetectBestPrecision()
}

/**
 * Automatically detect the best model precision for the environment
 * NEW DEFAULT: Q8 for optimal size/performance (75% smaller, 99% accuracy)
 */
function autoDetectBestPrecision(): ModelConfigResult {
  // Check if user explicitly wants FP32 via environment variable
  if (process.env.BRAINY_FORCE_FP32 === 'true') {
    setModelPrecision('fp32')
    return {
      precision: 'fp32',
      reason: 'FP32 forced via BRAINY_FORCE_FP32 environment variable',
      autoSelected: false
    }
  }
  
  // Browser environment - use Q8 for smaller download/memory
  if (isBrowser()) {
    setModelPrecision('q8')
    return {
      precision: 'q8',
      reason: 'Browser environment - using Q8 (23MB vs 90MB)',
      autoSelected: true
    }
  }
  
  // Serverless environments - use Q8 for faster cold starts
  if (isServerlessEnvironment()) {
    setModelPrecision('q8')
    return {
      precision: 'q8',
      reason: 'Serverless environment - using Q8 for 75% faster cold starts',
      autoSelected: true
    }
  }
  
  // Check available memory
  const memoryMB = getAvailableMemoryMB()
  
  // Only use FP32 if explicitly high memory AND user opts in
  if (memoryMB >= 4096 && process.env.BRAINY_PREFER_QUALITY === 'true') {
    setModelPrecision('fp32')
    return {
      precision: 'fp32',
      reason: `High memory (${memoryMB}MB) + quality preference - using FP32`,
      autoSelected: true
    }
  }
  
  // DEFAULT TO Q8 - Optimal for 99% of use cases
  // Q8 provides 99% accuracy at 25% of the size
  setModelPrecision('q8')
  return {
    precision: 'q8',
    reason: 'Default: Q8 model (23MB, 99% accuracy, 4x faster loads)',
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