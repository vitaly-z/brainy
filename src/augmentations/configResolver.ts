/**
 * Configuration Resolver for Augmentations
 * 
 * Handles loading and resolving configuration from multiple sources:
 * - Environment variables
 * - Configuration files
 * - Runtime updates
 * - Default values from schema
 */

import { existsSync, readFileSync } from 'fs'
import { join } from 'path'
import { homedir } from 'os'
import { JSONSchema } from './manifest.js'

/**
 * Configuration source priority (highest to lowest)
 */
export enum ConfigPriority {
  RUNTIME = 4,      // Runtime updates (highest priority)
  CONSTRUCTOR = 3,  // Constructor parameters
  ENVIRONMENT = 2,  // Environment variables
  FILE = 1,         // Configuration files
  DEFAULT = 0       // Schema defaults (lowest priority)
}

/**
 * Configuration source information
 */
export interface ConfigSource {
  priority: ConfigPriority
  source: string
  config: any
}

/**
 * Configuration resolution options
 */
export interface ConfigResolverOptions {
  augmentationId: string
  schema?: JSONSchema
  defaults?: Record<string, any>
  configPaths?: string[]
  envPrefix?: string
  allowUndefined?: boolean
}

/**
 * Augmentation Configuration Resolver
 */
export class AugmentationConfigResolver {
  private sources: ConfigSource[] = []
  private resolved: any = {}
  
  constructor(private options: ConfigResolverOptions) {
    this.options = {
      configPaths: [
        '.brainyrc',
        '.brainyrc.json',
        'brainy.config.json',
        join(homedir(), '.brainy', 'config.json'),
        join(homedir(), '.brainyrc')
      ],
      envPrefix: `BRAINY_AUG_${options.augmentationId.toUpperCase()}_`,
      allowUndefined: true,
      ...options
    }
  }
  
  /**
   * Resolve configuration from all sources
   * @param constructorConfig Optional constructor configuration
   * @returns Resolved configuration
   */
  resolve(constructorConfig?: any): any {
    this.sources = []
    
    // Load from all sources in priority order
    this.loadDefaults()
    this.loadFromFiles()
    this.loadFromEnvironment()
    
    if (constructorConfig) {
      this.sources.push({
        priority: ConfigPriority.CONSTRUCTOR,
        source: 'constructor',
        config: constructorConfig
      })
    }
    
    // Merge configurations by priority
    this.resolved = this.mergeConfigurations()
    
    // Validate against schema if provided
    if (this.options.schema) {
      this.validateConfiguration(this.resolved)
    }
    
    return this.resolved
  }
  
  /**
   * Load default values from schema and defaults
   */
  private loadDefaults(): void {
    let defaults: any = {}
    
    // Load from provided defaults
    if (this.options.defaults) {
      defaults = { ...defaults, ...this.options.defaults }
    }
    
    // Load from schema defaults
    if (this.options.schema?.properties) {
      for (const [key, prop] of Object.entries(this.options.schema.properties)) {
        if (prop.default !== undefined && defaults[key] === undefined) {
          defaults[key] = prop.default
        }
      }
    }
    
    if (Object.keys(defaults).length > 0) {
      this.sources.push({
        priority: ConfigPriority.DEFAULT,
        source: 'defaults',
        config: defaults
      })
    }
  }
  
  /**
   * Load configuration from files
   */
  private loadFromFiles(): void {
    // Skip in browser environment
    if (typeof process === 'undefined' || typeof window !== 'undefined') {
      return
    }
    
    for (const configPath of this.options.configPaths || []) {
      try {
        if (existsSync(configPath)) {
          const content = readFileSync(configPath, 'utf8')
          const config = this.parseConfigFile(content, configPath)
          
          // Extract augmentation-specific configuration
          const augConfig = this.extractAugmentationConfig(config)
          
          if (augConfig && Object.keys(augConfig).length > 0) {
            this.sources.push({
              priority: ConfigPriority.FILE,
              source: `file:${configPath}`,
              config: augConfig
            })
            break // Use first found config file
          }
        }
      } catch (error) {
        // Silently ignore file errors
        console.debug(`Failed to load config from ${configPath}:`, error)
      }
    }
  }
  
  /**
   * Parse configuration file based on extension
   */
  private parseConfigFile(content: string, filepath: string): any {
    try {
      // Try JSON first
      return JSON.parse(content)
    } catch {
      // Try other formats in the future (YAML, TOML, etc.)
      throw new Error(`Unable to parse config file: ${filepath}`)
    }
  }
  
  /**
   * Extract augmentation-specific configuration from a config object
   */
  private extractAugmentationConfig(config: any): any {
    const augId = this.options.augmentationId
    
    // Check for augmentations section
    if (config.augmentations && config.augmentations[augId]) {
      return config.augmentations[augId]
    }
    
    // Check for direct augmentation config (prefixed keys)
    const prefix = `${augId}.`
    const augConfig: any = {}
    
    for (const [key, value] of Object.entries(config)) {
      if (key.startsWith(prefix)) {
        const configKey = key.slice(prefix.length)
        augConfig[configKey] = value
      }
    }
    
    return Object.keys(augConfig).length > 0 ? augConfig : null
  }
  
  /**
   * Load configuration from environment variables
   */
  private loadFromEnvironment(): void {
    // Skip in browser environment
    if (typeof process === 'undefined' || !process.env) {
      return
    }
    
    const prefix = this.options.envPrefix!
    const envConfig: any = {}
    
    for (const [key, value] of Object.entries(process.env)) {
      if (key.startsWith(prefix)) {
        const configKey = this.envKeyToConfigKey(key.slice(prefix.length))
        envConfig[configKey] = this.parseEnvValue(value as string)
      }
    }
    
    if (Object.keys(envConfig).length > 0) {
      this.sources.push({
        priority: ConfigPriority.ENVIRONMENT,
        source: 'environment',
        config: envConfig
      })
    }
  }
  
  /**
   * Convert environment variable key to config key
   * ENABLED -> enabled
   * MAX_SIZE -> maxSize
   */
  private envKeyToConfigKey(envKey: string): string {
    return envKey
      .toLowerCase()
      .replace(/_([a-z])/g, (_, letter) => letter.toUpperCase())
  }
  
  /**
   * Parse environment variable value
   */
  private parseEnvValue(value: string): any {
    // Handle empty strings
    if (value === '') return value
    
    // Try to parse as JSON
    try {
      return JSON.parse(value)
    } catch {
      // Check for boolean strings
      if (value.toLowerCase() === 'true') return true
      if (value.toLowerCase() === 'false') return false
      
      // Check for number strings
      const num = Number(value)
      if (!isNaN(num) && value.trim() !== '') return num
      
      // Return as string
      return value
    }
  }
  
  /**
   * Merge configurations by priority
   */
  private mergeConfigurations(): any {
    // Sort by priority (lowest to highest)
    const sorted = [...this.sources].sort((a, b) => a.priority - b.priority)
    
    // Merge configurations
    let merged = {}
    for (const source of sorted) {
      merged = this.deepMerge(merged, source.config)
    }
    
    return merged
  }
  
  /**
   * Deep merge two objects
   */
  private deepMerge(target: any, source: any): any {
    const output = { ...target }
    
    for (const key in source) {
      if (source.hasOwnProperty(key)) {
        if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
          if (target[key] && typeof target[key] === 'object' && !Array.isArray(target[key])) {
            output[key] = this.deepMerge(target[key], source[key])
          } else {
            output[key] = source[key]
          }
        } else {
          output[key] = source[key]
        }
      }
    }
    
    return output
  }
  
  /**
   * Validate configuration against schema
   */
  private validateConfiguration(config: any): void {
    if (!this.options.schema) return
    
    const schema = this.options.schema
    const errors: string[] = []
    
    // Check required fields
    if (schema.required) {
      for (const field of schema.required) {
        if (config[field] === undefined) {
          errors.push(`Missing required field: ${field}`)
        }
      }
    }
    
    // Validate properties
    if (schema.properties) {
      for (const [key, propSchema] of Object.entries(schema.properties)) {
        const value = config[key]
        if (value !== undefined) {
          this.validateProperty(key, value, propSchema, errors)
        }
      }
    }
    
    // Check for additional properties
    if (schema.additionalProperties === false) {
      const allowedKeys = Object.keys(schema.properties || {})
      for (const key of Object.keys(config)) {
        if (!allowedKeys.includes(key)) {
          errors.push(`Unknown configuration property: ${key}`)
        }
      }
    }
    
    if (errors.length > 0) {
      throw new Error(`Configuration validation failed for ${this.options.augmentationId}:\n${errors.join('\n')}`)
    }
  }
  
  /**
   * Validate a single property against its schema
   */
  private validateProperty(key: string, value: any, schema: JSONSchema, errors: string[]): void {
    // Type validation
    if (schema.type) {
      const actualType = Array.isArray(value) ? 'array' : typeof value
      if (actualType !== schema.type) {
        errors.push(`${key}: expected ${schema.type}, got ${actualType}`)
        return
      }
    }
    
    // Number validations
    if (schema.type === 'number') {
      if (schema.minimum !== undefined && value < schema.minimum) {
        errors.push(`${key}: value ${value} is less than minimum ${schema.minimum}`)
      }
      if (schema.maximum !== undefined && value > schema.maximum) {
        errors.push(`${key}: value ${value} is greater than maximum ${schema.maximum}`)
      }
    }
    
    // String validations
    if (schema.type === 'string') {
      if (schema.minLength !== undefined && value.length < schema.minLength) {
        errors.push(`${key}: length ${value.length} is less than minimum ${schema.minLength}`)
      }
      if (schema.maxLength !== undefined && value.length > schema.maxLength) {
        errors.push(`${key}: length ${value.length} is greater than maximum ${schema.maxLength}`)
      }
      if (schema.pattern) {
        const regex = new RegExp(schema.pattern)
        if (!regex.test(value)) {
          errors.push(`${key}: value does not match pattern ${schema.pattern}`)
        }
      }
    }
    
    // Enum validation
    if (schema.enum && !schema.enum.includes(value)) {
      errors.push(`${key}: value ${value} is not one of allowed values: ${schema.enum.join(', ')}`)
    }
  }
  
  /**
   * Get configuration sources for debugging
   */
  getSources(): ConfigSource[] {
    return [...this.sources]
  }
  
  /**
   * Get resolved configuration
   */
  getResolved(): any {
    return { ...this.resolved }
  }
  
  /**
   * Update configuration at runtime
   */
  updateRuntime(config: any): any {
    // Add or update runtime source
    const runtimeIndex = this.sources.findIndex(s => s.priority === ConfigPriority.RUNTIME)
    
    if (runtimeIndex >= 0) {
      this.sources[runtimeIndex].config = {
        ...this.sources[runtimeIndex].config,
        ...config
      }
    } else {
      this.sources.push({
        priority: ConfigPriority.RUNTIME,
        source: 'runtime',
        config
      })
    }
    
    // Re-merge configurations
    this.resolved = this.mergeConfigurations()
    
    // Validate
    if (this.options.schema) {
      this.validateConfiguration(this.resolved)
    }
    
    return this.resolved
  }
  
  /**
   * Save configuration to file
   * @param filepath Path to save configuration
   * @param format Format to save as (json, etc.)
   */
  async saveToFile(filepath?: string, format: 'json' = 'json'): Promise<void> {
    // Skip in browser environment
    if (typeof process === 'undefined' || typeof window !== 'undefined') {
      throw new Error('Cannot save configuration files in browser environment')
    }
    
    const fs = await import('fs')
    const path = await import('path')
    
    const configPath = filepath || this.options.configPaths?.[0] || '.brainyrc'
    const augId = this.options.augmentationId
    
    // Load existing config if it exists
    let fullConfig: any = {}
    try {
      if (fs.existsSync(configPath)) {
        const content = fs.readFileSync(configPath, 'utf8')
        fullConfig = JSON.parse(content)
      }
    } catch {
      // Start with empty config
    }
    
    // Ensure augmentations section exists
    if (!fullConfig.augmentations) {
      fullConfig.augmentations = {}
    }
    
    // Update augmentation config
    fullConfig.augmentations[augId] = this.resolved
    
    // Save based on format
    let content: string
    if (format === 'json') {
      content = JSON.stringify(fullConfig, null, 2)
    } else {
      throw new Error(`Unsupported format: ${format}`)
    }
    
    // Ensure directory exists
    const dir = path.dirname(configPath)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }
    
    // Write file
    fs.writeFileSync(configPath, content, 'utf8')
  }
  
  /**
   * Get environment variable names for this augmentation
   */
  getEnvironmentVariables(): Record<string, any> {
    const schema = this.options.schema
    const prefix = this.options.envPrefix!
    const vars: Record<string, any> = {}
    
    if (schema?.properties) {
      for (const [key, prop] of Object.entries(schema.properties)) {
        const envKey = prefix + key.replace(/([A-Z])/g, '_$1').toUpperCase()
        vars[envKey] = {
          description: prop.description,
          type: prop.type,
          default: prop.default,
          currentValue: process.env?.[envKey]
        }
      }
    }
    
    return vars
  }
}