/**
 * Storage Configuration Auto-Detection
 * Intelligently selects storage based on environment and available services
 */

import { isBrowser, isNode } from '../utils/environment.js'

/**
 * Low-level storage implementation types
 */
export enum StorageType {
  MEMORY = 'memory',
  FILESYSTEM = 'filesystem', 
  OPFS = 'opfs',
  S3 = 's3',
  GCS = 'gcs',
  R2 = 'r2'
}

/**
 * High-level storage presets (maps to StorageType)
 */
export enum StoragePreset {
  AUTO = 'auto',
  MEMORY = 'memory', 
  DISK = 'disk',
  CLOUD = 'cloud'
}

// Backward compatibility type aliases
export type StorageTypeString = 'memory' | 'filesystem' | 'opfs' | 's3' | 'gcs' | 'r2'
export type StoragePresetString = 'auto' | 'memory' | 'disk' | 'cloud'

export interface StorageConfigResult {
  type: StorageType | StorageTypeString  // Support both enum and string for compatibility
  config: any
  reason: string
  autoSelected: boolean
}

/**
 * Auto-detect the best storage configuration
 * @param override - Manual override: specific type or preset
 */
export async function autoDetectStorage(
  override?: StorageType | StoragePreset | StorageTypeString | StoragePresetString | any
): Promise<StorageConfigResult> {
  // Handle direct storage config object
  if (override && typeof override === 'object') {
    return {
      type: override.type || 'memory',
      config: override,
      reason: 'Manually configured storage',
      autoSelected: false
    }
  }
  
  // Handle storage type override (enum values or strings)
  if (override && Object.values(StorageType).includes(override as StorageType)) {
    return {
      type: override as StorageType,
      config: override,
      reason: `Manually specified: ${override}`,
      autoSelected: false
    }
  }
  
  // Handle presets (both enum and string values)
  if (override === StoragePreset.MEMORY || override === 'memory') {
    return {
      type: StorageType.MEMORY,
      config: StorageType.MEMORY,
      reason: 'Preset: memory storage',
      autoSelected: false
    }
  }
  
  if (override === StoragePreset.DISK || override === 'disk') {
    const diskType = isBrowser() ? StorageType.OPFS : StorageType.FILESYSTEM
    return {
      type: diskType,
      config: diskType,
      reason: `Preset: disk storage (${diskType})`,
      autoSelected: false
    }
  }
  
  if (override === StoragePreset.CLOUD || override === 'cloud') {
    const cloudStorage = await detectCloudStorage()
    if (cloudStorage) {
      return {
        ...cloudStorage,
        reason: `Preset: cloud storage (${cloudStorage.type})`,
        autoSelected: false
      }
    }
    // Fallback to disk if no cloud storage detected
    const diskType = isBrowser() ? StorageType.OPFS : StorageType.FILESYSTEM
    return {
      type: diskType,
      config: diskType,
      reason: 'Preset: cloud (none detected, using disk)',
      autoSelected: false
    }
  }
  
  // Auto-detection logic
  return await autoDetectBestStorage()
}

/**
 * Automatically detect the best storage option
 */
async function autoDetectBestStorage(): Promise<StorageConfigResult> {
  // Check for cloud storage first (highest priority in production)
  const cloudStorage = await detectCloudStorage()
  if (cloudStorage && process.env.NODE_ENV === 'production') {
    return {
      ...cloudStorage,
      reason: `Auto-detected ${cloudStorage.type} in production`,
      autoSelected: true
    }
  }
  
  // Browser environment
  if (isBrowser()) {
    // Check for OPFS support
    if (await hasOPFSSupport()) {
      return {
        type: StorageType.OPFS,
        config: { requestPersistentStorage: true },
        reason: 'Browser with OPFS support detected',
        autoSelected: true
      }
    }
    // Fallback to memory for browsers without OPFS
    return {
      type: StorageType.MEMORY,
      config: StorageType.MEMORY,
      reason: 'Browser without OPFS - using memory',
      autoSelected: true
    }
  }
  
  // Serverless environment - prefer memory or cloud
  if (isServerlessEnvironment()) {
    if (cloudStorage) {
      return {
        ...cloudStorage,
        reason: `Serverless with ${cloudStorage.type} detected`,
        autoSelected: true
      }
    }
    return {
      type: StorageType.MEMORY,
      config: StorageType.MEMORY,
      reason: 'Serverless environment - using memory',
      autoSelected: true
    }
  }
  
  // Node.js environment - use filesystem
  if (isNode()) {
    const dataPath = await findBestDataPath()
    return {
      type: StorageType.FILESYSTEM,
      config: StorageType.FILESYSTEM,
      reason: `Node.js environment - using filesystem at ${dataPath}`,
      autoSelected: true
    }
  }
  
  // Fallback to memory
  return {
    type: StorageType.MEMORY,
    config: StorageType.MEMORY,
    reason: 'Default fallback - using memory',
    autoSelected: true
  }
}

/**
 * Detect cloud storage from environment variables
 */
async function detectCloudStorage(): Promise<{ type: StorageType; config: any } | null> {
  // AWS S3 Detection
  if (hasAWSConfig()) {
    return {
      type: StorageType.S3,
      config: {
        s3Storage: {
          bucketName: process.env.AWS_BUCKET || process.env.S3_BUCKET_NAME || 'brainy-data',
          region: process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || 'us-east-1',
          // Credentials will be picked up by AWS SDK automatically
        }
      }
    }
  }
  
  // Google Cloud Storage Detection
  if (hasGCPConfig()) {
    return {
      type: StorageType.GCS,
      config: {
        gcsStorage: {
          bucketName: process.env.GCS_BUCKET || process.env.GOOGLE_STORAGE_BUCKET || 'brainy-data',
          // Credentials will be picked up by GCP SDK automatically
        }
      }
    }
  }
  
  // Cloudflare R2 Detection
  if (hasR2Config()) {
    return {
      type: StorageType.R2,
      config: {
        r2Storage: {
          bucketName: process.env.R2_BUCKET || 'brainy-data',
          accountId: process.env.CLOUDFLARE_ACCOUNT_ID,
          accessKeyId: process.env.R2_ACCESS_KEY_ID,
          secretAccessKey: process.env.R2_SECRET_ACCESS_KEY
        }
      }
    }
  }
  
  return null
}

/**
 * Check if AWS S3 is configured
 */
function hasAWSConfig(): boolean {
  return !!(
    // Explicit S3 bucket
    process.env.AWS_BUCKET ||
    process.env.S3_BUCKET_NAME ||
    // AWS credentials (SDK will find them)
    process.env.AWS_ACCESS_KEY_ID ||
    process.env.AWS_PROFILE ||
    // AWS environment indicators
    process.env.AWS_EXECUTION_ENV ||
    process.env.AWS_LAMBDA_FUNCTION_NAME ||
    process.env.ECS_CONTAINER_METADATA_URI
  )
}

/**
 * Check if Google Cloud Storage is configured
 */
function hasGCPConfig(): boolean {
  return !!(
    // Explicit GCS bucket
    process.env.GCS_BUCKET ||
    process.env.GOOGLE_STORAGE_BUCKET ||
    // GCP credentials
    process.env.GOOGLE_APPLICATION_CREDENTIALS ||
    // GCP environment indicators
    process.env.GOOGLE_CLOUD_PROJECT ||
    process.env.K_SERVICE ||
    process.env.GAE_SERVICE
  )
}

/**
 * Check if Cloudflare R2 is configured
 */
function hasR2Config(): boolean {
  return !!(
    process.env.R2_BUCKET ||
    (process.env.CLOUDFLARE_ACCOUNT_ID && process.env.R2_ACCESS_KEY_ID)
  )
}

/**
 * Check if running in serverless environment
 */
function isServerlessEnvironment(): boolean {
  if (!isNode()) return false
  
  return !!(
    process.env.AWS_LAMBDA_FUNCTION_NAME ||
    process.env.VERCEL ||
    process.env.NETLIFY ||
    process.env.CLOUDFLARE_WORKERS ||
    process.env.FUNCTIONS_WORKER_RUNTIME ||
    process.env.K_SERVICE ||
    process.env.RAILWAY_ENVIRONMENT ||
    process.env.FLY_APP_NAME
  )
}

/**
 * Check for OPFS support in browser
 */
async function hasOPFSSupport(): Promise<boolean> {
  if (!isBrowser()) return false
  
  try {
    return 'storage' in navigator && 
           'getDirectory' in navigator.storage
  } catch {
    return false
  }
}

/**
 * Find the best path for filesystem storage
 */
async function findBestDataPath(): Promise<string> {
  if (!isNode()) return './brainy-data'
  
  const homeDir = process.env.HOME || process.env.USERPROFILE || '~'
  const tempDir = process.env.TMPDIR || process.env.TEMP || '/tmp'
  
  const candidates = [
    // User-specified path
    process.env.BRAINY_DATA_PATH,
    // Current directory
    './brainy-data',
    // Home directory
    `${homeDir}/.brainy/data`,
    // Temp directory (last resort)
    `${tempDir}/brainy-data`
  ].filter(Boolean) as string[]
  
  // Find first writable directory
  for (const candidate of candidates) {
    if (await isWritable(candidate)) {
      return candidate
    }
  }
  
  // Default fallback
  return candidates[1] // ./brainy-data
}

/**
 * Check if a directory is writable
 */
async function isWritable(dirPath: string): Promise<boolean> {
  if (!isNode()) return false
  
  try {
    // Dynamic import fs for Node.js
    const { promises: fs } = await import('fs')
    const path = await import('path')
    
    // Try to create directory if it doesn't exist
    await fs.mkdir(dirPath, { recursive: true })
    
    // Try to write a test file
    const testFile = path.join(dirPath, '.write-test')
    await fs.writeFile(testFile, 'test')
    await fs.unlink(testFile)
    
    return true
  } catch {
    return false
  }
}

// Legacy getStorageConfig function removed - now using simple string types

/**
 * Log storage configuration decision
 */
export function logStorageConfig(config: StorageConfigResult, verbose: boolean = false): void {
  if (!verbose && process.env.NODE_ENV === 'production') {
    return // Silent in production unless verbose
  }
  
  const icon = config.autoSelected ? '🤖' : '👤'
  console.log(`${icon} Storage: ${config.type.toUpperCase()} - ${config.reason}`)
}