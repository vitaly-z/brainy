/**
 * Model Configuration
 * Brainy uses Q8 WASM embeddings - no configuration needed (zero-config)
 */

import { isBrowser, isNode } from '../utils/environment.js'

interface ModelConfigResult {
  precision: 'q8'
  reason: string
  autoSelected: boolean
}

/**
 * Get model precision configuration
 * Always returns Q8 - the optimal balance of size and accuracy
 */
export function getModelPrecision(): ModelConfigResult {
  return {
    precision: 'q8',
    reason: 'Q8 WASM (23MB bundled, no downloads)',
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
 * Check if models need to be downloaded
 * With bundled WASM model, this is rarely needed
 */
export function shouldAutoDownloadModels(): boolean {
  // Model is bundled - no downloads needed in normal operation
  // This flag exists for edge cases only
  const explicitlyDisabled = process.env.BRAINY_ALLOW_REMOTE_MODELS === 'false'
  return !explicitlyDisabled
}

/**
 * Get the model path
 * With bundled WASM model, this points to the package assets
 */
export function getModelPath(): string {
  // Check if user explicitly set a path (for advanced users)
  if (process.env.BRAINY_MODELS_PATH) {
    return process.env.BRAINY_MODELS_PATH
  }

  // Browser - use cache API or IndexedDB
  if (isBrowser()) {
    return 'browser-cache'
  }

  // Serverless - use /tmp for ephemeral storage
  if (isServerlessEnvironment()) {
    return '/tmp/.brainy/models'
  }

  // Node.js - use home directory for persistent storage
  if (isNode()) {
    const homeDir = process.env.HOME || process.env.USERPROFILE || '~'
    return `${homeDir}/.brainy/models`
  }

  // Fallback
  return './.brainy/models'
}
