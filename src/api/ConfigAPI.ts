/**
 * Configuration API for Brainy 3.0
 * Provides configuration storage with optional encryption
 */

import { SecurityAPI } from './SecurityAPI.js'
import { StorageAdapter } from '../coreTypes.js'

export interface ConfigOptions {
  encrypt?: boolean
  decrypt?: boolean
}

export interface ConfigEntry {
  key: string
  value: any
  encrypted: boolean
  createdAt: number
  updatedAt: number
}

export class ConfigAPI {
  private security: SecurityAPI
  private configCache: Map<string, ConfigEntry> = new Map()
  private CONFIG_NOUN_PREFIX = '_config_'

  constructor(private storage: StorageAdapter) {
    this.security = new SecurityAPI()
  }

  /**
   * Set a configuration value with optional encryption
   */
  async set(params: {
    key: string
    value: any
    encrypt?: boolean
  }): Promise<void> {
    const { key, value, encrypt = false } = params

    // Serialize and optionally encrypt the value
    let storedValue: any = value
    if (typeof value !== 'string') {
      storedValue = JSON.stringify(value)
    }

    if (encrypt) {
      storedValue = await this.security.encrypt(storedValue)
    }

    // Create config entry
    const entry: ConfigEntry = {
      key,
      value: storedValue,
      encrypted: encrypt,
      createdAt: this.configCache.get(key)?.createdAt || Date.now(),
      updatedAt: Date.now()
    }

    // Store in cache
    this.configCache.set(key, entry)

    // v4.0.0: Persist to storage as NounMetadata
    const configId = this.CONFIG_NOUN_PREFIX + key
    const nounMetadata = {
      noun: 'config' as any,
      ...entry,
      service: 'config',
      createdAt: entry.createdAt,
      updatedAt: entry.updatedAt
    }
    await this.storage.saveNounMetadata(configId, nounMetadata)
  }

  /**
   * Get a configuration value with optional decryption
   */
  async get(params: {
    key: string
    decrypt?: boolean
    defaultValue?: any
  }): Promise<any> {
    const { key, decrypt, defaultValue } = params

    // Check cache first
    let entry = this.configCache.get(key)

    // If not in cache, load from storage
    if (!entry) {
      const configId = this.CONFIG_NOUN_PREFIX + key
      const metadata = await this.storage.getNounMetadata(configId)

      if (!metadata) {
        return defaultValue
      }

      // v4.0.0: Extract ConfigEntry from NounMetadata
      const createdAtVal = typeof metadata.createdAt === 'object' && metadata.createdAt !== null && 'seconds' in metadata.createdAt
        ? metadata.createdAt.seconds * 1000 + Math.floor((metadata.createdAt.nanoseconds || 0) / 1000000)
        : ((metadata.createdAt as unknown as number) || Date.now())

      const updatedAtVal = typeof metadata.updatedAt === 'object' && metadata.updatedAt !== null && 'seconds' in metadata.updatedAt
        ? metadata.updatedAt.seconds * 1000 + Math.floor((metadata.updatedAt.nanoseconds || 0) / 1000000)
        : ((metadata.updatedAt as unknown as number) || createdAtVal)

      entry = {
        key: metadata.key as string,
        value: metadata.value,
        encrypted: metadata.encrypted as boolean,
        createdAt: createdAtVal,
        updatedAt: updatedAtVal
      }
      this.configCache.set(key, entry)
    }

    let value = entry.value

    // Decrypt if needed
    const shouldDecrypt = decrypt !== undefined ? decrypt : entry.encrypted
    if (shouldDecrypt && entry.encrypted && typeof value === 'string') {
      value = await this.security.decrypt(value)
    }

    // Try to parse JSON if it looks like JSON
    if (typeof value === 'string' && (value.startsWith('{') || value.startsWith('['))) {
      try {
        value = JSON.parse(value)
      } catch {
        // Not JSON, return as string
      }
    }

    return value
  }

  /**
   * Delete a configuration value
   */
  async delete(key: string): Promise<void> {
    // Remove from cache
    this.configCache.delete(key)

    // v4.0.0: Remove from storage
    const configId = this.CONFIG_NOUN_PREFIX + key
    await this.storage.deleteNounMetadata(configId)
  }

  /**
   * List all configuration keys
   */
  async list(): Promise<string[]> {
    // v4.0.0: Get all nouns and filter for config entries
    const result = await this.storage.getNouns({ pagination: { limit: 10000 } })

    const configKeys: string[] = []
    for (const noun of result.items) {
      if (noun.id.startsWith(this.CONFIG_NOUN_PREFIX)) {
        configKeys.push(noun.id.substring(this.CONFIG_NOUN_PREFIX.length))
      }
    }

    return configKeys
  }

  /**
   * Check if a configuration key exists
   */
  async has(key: string): Promise<boolean> {
    if (this.configCache.has(key)) {
      return true
    }

    const configId = this.CONFIG_NOUN_PREFIX + key
    const metadata = await this.storage.getNounMetadata(configId)
    return metadata !== null && metadata !== undefined
  }

  /**
   * Clear all configuration
   */
  async clear(): Promise<void> {
    // Clear cache
    this.configCache.clear()

    // Clear from storage
    const keys = await this.list()
    for (const key of keys) {
      await this.delete(key)
    }
  }

  /**
   * Export all configuration
   */
  async export(): Promise<Record<string, ConfigEntry>> {
    const keys = await this.list()
    const config: Record<string, ConfigEntry> = {}

    for (const key of keys) {
      const entry = await this.getEntry(key)
      if (entry) {
        config[key] = entry
      }
    }

    return config
  }

  /**
   * Import configuration
   */
  async import(config: Record<string, ConfigEntry>): Promise<void> {
    for (const [key, entry] of Object.entries(config)) {
      this.configCache.set(key, entry)
      const configId = this.CONFIG_NOUN_PREFIX + key
      // v4.0.0: Convert ConfigEntry to NounMetadata
      const nounMetadata = {
        noun: 'config' as any,
        ...entry,
        service: 'config',
        createdAt: entry.createdAt,
        updatedAt: entry.updatedAt
      }
      await this.storage.saveNounMetadata(configId, nounMetadata)
    }
  }

  /**
   * Get raw config entry (without decryption)
   */
  private async getEntry(key: string): Promise<ConfigEntry | null> {
    if (this.configCache.has(key)) {
      return this.configCache.get(key)!
    }

    const configId = this.CONFIG_NOUN_PREFIX + key
    const metadata = await this.storage.getNounMetadata(configId)

    if (!metadata) {
      return null
    }

    // v4.0.0: Extract ConfigEntry from NounMetadata
    const createdAtVal = typeof metadata.createdAt === 'object' && metadata.createdAt !== null && 'seconds' in metadata.createdAt
      ? metadata.createdAt.seconds * 1000 + Math.floor((metadata.createdAt.nanoseconds || 0) / 1000000)
      : ((metadata.createdAt as unknown as number) || Date.now())

    const updatedAtVal = typeof metadata.updatedAt === 'object' && metadata.updatedAt !== null && 'seconds' in metadata.updatedAt
      ? metadata.updatedAt.seconds * 1000 + Math.floor((metadata.updatedAt.nanoseconds || 0) / 1000000)
      : ((metadata.updatedAt as unknown as number) || createdAtVal)

    const entry: ConfigEntry = {
      key: metadata.key as string,
      value: metadata.value,
      encrypted: metadata.encrypted as boolean,
      createdAt: createdAtVal,
      updatedAt: updatedAtVal
    }
    this.configCache.set(key, entry)
    return entry
  }
}