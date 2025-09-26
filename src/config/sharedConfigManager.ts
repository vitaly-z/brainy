/**
 * Shared Configuration Manager
 * Ensures configuration consistency across multiple instances using shared storage
 */

import { ModelPrecision } from './modelAutoConfig.js'
import { StorageType } from './storageAutoConfig.js'
import { getBrainyVersion } from '../utils/version.js'

export interface SharedConfig {
  // Critical parameters that MUST match across instances
  version: string
  precision: ModelPrecision
  dimensions: number
  hnswM: number
  hnswEfConstruction: number
  distanceFunction: string
  createdAt: string
  lastUpdated: string
  
  // Informational (can differ between instances)
  instanceCount?: number
  lastAccessedBy?: string
}

/**
 * Manages configuration consistency for shared storage
 */
export class SharedConfigManager {
  private static CONFIG_FILE = '.brainy/config.json'
  
  /**
   * Load or create shared configuration
   * When connecting to existing data, this OVERRIDES auto-configuration!
   */
  static async loadOrCreateSharedConfig(
    storage: any,
    localConfig: any
  ): Promise<{ config: any; warnings: string[] }> {
    const warnings: string[] = []
    
    try {
      // Check if we're using shared storage
      if (!this.isSharedStorage(localConfig.storageType)) {
        // Local storage - use local config
        return { config: localConfig, warnings: [] }
      }
      
      // Try to load existing configuration from shared storage
      const existingConfig = await this.loadConfigFromStorage(storage)
      
      if (existingConfig) {
        // EXISTING SHARED DATA - Must use its configuration!
        console.log('📁 Found existing shared data configuration')
        
        // Check for critical mismatches
        const mismatches = this.checkCriticalMismatches(localConfig, existingConfig)
        
        if (mismatches.length > 0) {
          console.warn('⚠️  Configuration override required for shared storage:')
          mismatches.forEach(m => {
            console.warn(`   - ${m.param}: ${m.local} → ${m.shared} (using shared)`)
            warnings.push(`${m.param} overridden: ${m.local} → ${m.shared}`)
          })
        }
        
        // Override critical parameters with shared values
        const mergedConfig = this.mergeWithSharedConfig(localConfig, existingConfig)
        
        // Update last accessed
        await this.updateAccessInfo(storage, existingConfig)
        
        return { config: mergedConfig, warnings }
        
      } else {
        // NEW SHARED STORAGE - Save our configuration
        console.log('📝 Initializing new shared storage with configuration')
        
        const sharedConfig = this.createSharedConfig(localConfig)
        await this.saveConfigToStorage(storage, sharedConfig)
        
        return { config: localConfig, warnings: [] }
      }
      
    } catch (error) {
      console.error('Failed to manage shared configuration:', error)
      warnings.push('Could not verify shared configuration - proceeding with caution')
      return { config: localConfig, warnings }
    }
  }
  
  /**
   * Check if storage type is shared (multi-instance)
   */
  private static isSharedStorage(storageType: StorageType): boolean {
    return ['s3', 'gcs', 'r2'].includes(storageType)
  }
  
  /**
   * Load configuration from shared storage
   */
  private static async loadConfigFromStorage(storage: any): Promise<SharedConfig | null> {
    try {
      const configData = await storage.get(this.CONFIG_FILE)
      if (!configData) return null
      
      const config = JSON.parse(configData)
      return config as SharedConfig
    } catch (error) {
      // Config doesn't exist yet
      return null
    }
  }
  
  /**
   * Save configuration to shared storage
   */
  private static async saveConfigToStorage(storage: any, config: SharedConfig): Promise<void> {
    try {
      await storage.set(this.CONFIG_FILE, JSON.stringify(config, null, 2))
    } catch (error) {
      console.error('Failed to save shared configuration:', error)
      throw new Error('Cannot initialize shared storage without saving configuration')
    }
  }
  
  /**
   * Create shared configuration from local config
   */
  private static createSharedConfig(localConfig: any): SharedConfig {
    return {
      version: getBrainyVersion(), // Brainy version
      precision: localConfig.embeddingOptions?.precision || 'fp32',
      dimensions: 384, // Fixed for all-MiniLM-L6-v2
      hnswM: localConfig.hnsw?.M || 16,
      hnswEfConstruction: localConfig.hnsw?.efConstruction || 200,
      distanceFunction: localConfig.distanceFunction || 'cosine',
      createdAt: new Date().toISOString(),
      lastUpdated: new Date().toISOString(),
      instanceCount: 1,
      lastAccessedBy: this.getInstanceIdentifier()
    }
  }
  
  /**
   * Check for critical configuration mismatches
   */
  private static checkCriticalMismatches(
    localConfig: any,
    sharedConfig: SharedConfig
  ): Array<{ param: string; local: any; shared: any }> {
    const mismatches: Array<{ param: string; local: any; shared: any }> = []
    
    // Model precision - CRITICAL!
    const localPrecision = localConfig.embeddingOptions?.precision || 'fp32'
    if (localPrecision !== sharedConfig.precision) {
      mismatches.push({
        param: 'Model Precision',
        local: localPrecision,
        shared: sharedConfig.precision
      })
    }
    
    // HNSW parameters - Important for index consistency
    const localM = localConfig.hnsw?.M || 16
    if (localM !== sharedConfig.hnswM) {
      mismatches.push({
        param: 'HNSW M',
        local: localM,
        shared: sharedConfig.hnswM
      })
    }
    
    const localEf = localConfig.hnsw?.efConstruction || 200
    if (localEf !== sharedConfig.hnswEfConstruction) {
      mismatches.push({
        param: 'HNSW efConstruction',
        local: localEf,
        shared: sharedConfig.hnswEfConstruction
      })
    }
    
    // Distance function
    const localDistance = localConfig.distanceFunction || 'cosine'
    if (localDistance !== sharedConfig.distanceFunction) {
      mismatches.push({
        param: 'Distance Function',
        local: localDistance,
        shared: sharedConfig.distanceFunction
      })
    }
    
    return mismatches
  }
  
  /**
   * Merge local config with shared config (shared takes precedence for critical params)
   */
  private static mergeWithSharedConfig(localConfig: any, sharedConfig: SharedConfig): any {
    return {
      ...localConfig,
      
      // Override critical parameters with shared values
      embeddingOptions: {
        ...localConfig.embeddingOptions,
        precision: sharedConfig.precision // MUST use shared precision!
      },
      
      hnsw: {
        ...localConfig.hnsw,
        M: sharedConfig.hnswM,
        efConstruction: sharedConfig.hnswEfConstruction
      },
      
      distanceFunction: sharedConfig.distanceFunction,
      
      // Add metadata about shared configuration
      _sharedConfig: {
        loaded: true,
        version: sharedConfig.version,
        createdAt: sharedConfig.createdAt,
        precision: sharedConfig.precision
      }
    }
  }
  
  /**
   * Update access information in shared config
   */
  private static async updateAccessInfo(storage: any, config: SharedConfig): Promise<void> {
    try {
      config.lastUpdated = new Date().toISOString()
      config.instanceCount = (config.instanceCount || 0) + 1
      config.lastAccessedBy = this.getInstanceIdentifier()
      
      await this.saveConfigToStorage(storage, config)
    } catch {
      // Non-critical - don't fail if we can't update access info
    }
  }
  
  /**
   * Get unique identifier for this instance
   */
  private static getInstanceIdentifier(): string {
    if (process.env.HOSTNAME) return process.env.HOSTNAME
    if (process.env.CONTAINER_ID) return process.env.CONTAINER_ID
    if (process.env.K_SERVICE) return process.env.K_SERVICE
    if (process.env.AWS_LAMBDA_FUNCTION_NAME) return process.env.AWS_LAMBDA_FUNCTION_NAME
    
    // Generate a random identifier
    return `instance-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  }
  
  /**
   * Validate that a configuration is compatible with shared data
   */
  static validateCompatibility(config1: SharedConfig, config2: SharedConfig): boolean {
    return (
      config1.precision === config2.precision &&
      config1.dimensions === config2.dimensions &&
      config1.hnswM === config2.hnswM &&
      config1.hnswEfConstruction === config2.hnswEfConstruction &&
      config1.distanceFunction === config2.distanceFunction
    )
  }
}