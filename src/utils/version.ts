/**
 * Version utilities for Brainy
 */

import { isNode } from './environment.js'

// Default version - this should be replaced at build time
const DEFAULT_VERSION = '3.14.0'

let cachedVersion: string | null = null
let versionPromise: Promise<string> | null = null

/**
 * Load version from package.json in Node.js environment
 */
async function loadVersionFromPackageJson(): Promise<string> {
  if (!isNode()) {
    return DEFAULT_VERSION
  }

  try {
    // Dynamic imports for Node.js modules - modern approach
    const [{ readFileSync }, { join, dirname }, { fileURLToPath }] = await Promise.all([
      import('node:fs'),
      import('node:path'),
      import('node:url')
    ])

    const __filename = fileURLToPath(import.meta.url)
    const __dirname = dirname(__filename)
    const packageJsonPath = join(__dirname, '../../package.json')

    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'))
    return packageJson.version || DEFAULT_VERSION
  } catch (error) {
    // Silently fall back to default version
    return DEFAULT_VERSION
  }
}

/**
 * Get the current Brainy package version
 * In Node.js, attempts to read from package.json
 * In browser, returns the default version
 * @returns The current version string
 */
export function getBrainyVersion(): string {
  if (cachedVersion) {
    return cachedVersion
  }

  // In browser or if we need immediate response, return default
  if (!isNode()) {
    cachedVersion = DEFAULT_VERSION
    return cachedVersion
  }

  // For Node.js, try to load synchronously first time
  // This is a compromise for backward compatibility
  if (!versionPromise) {
    versionPromise = loadVersionFromPackageJson()
    versionPromise.then(version => {
      cachedVersion = version
    })
  }

  // Return default while loading
  return cachedVersion || DEFAULT_VERSION
}

/**
 * Get the current Brainy package version asynchronously
 * Guaranteed to attempt loading from package.json in Node.js
 * @returns Promise resolving to the current version string
 */
export async function getBrainyVersionAsync(): Promise<string> {
  if (cachedVersion) {
    return cachedVersion
  }

  if (!versionPromise) {
    versionPromise = loadVersionFromPackageJson()
  }

  const version = await versionPromise
  cachedVersion = version
  return version
}

/**
 * Get version information for augmentation metadata
 * @param service The service/augmentation name
 * @returns Version metadata object
 */
export function getAugmentationVersion(service: string): { augmentation: string; version: string } {
  return {
    augmentation: service,
    version: getBrainyVersion()
  }
}