/**
 * Version utilities for Brainy
 */

import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

// Get package.json path relative to this file
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const packageJsonPath = join(__dirname, '../../package.json')

let cachedVersion: string | null = null

/**
 * Get the current Brainy package version
 * @returns The current version string
 */
export function getBrainyVersion(): string {
  if (!cachedVersion) {
    try {
      const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'))
      cachedVersion = packageJson.version
    } catch {
      // Fallback version if package.json can't be read
      cachedVersion = '2.7.1'
    }
  }
  return cachedVersion!
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