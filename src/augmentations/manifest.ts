/**
 * Augmentation Manifest Types
 * 
 * Defines the manifest structure for augmentation discovery and configuration
 * Enables tools like brain-cloud to discover and configure augmentations
 */

/**
 * JSON Schema type for configuration validation
 */
export interface JSONSchema {
  type?: 'object' | 'array' | 'string' | 'number' | 'boolean' | 'null'
  properties?: Record<string, JSONSchema>
  items?: JSONSchema
  required?: string[]
  default?: any
  description?: string
  minimum?: number
  maximum?: number
  minLength?: number
  maxLength?: number
  pattern?: string
  enum?: any[]
  additionalProperties?: boolean | JSONSchema
}

/**
 * Augmentation manifest for discovery and configuration
 */
export interface AugmentationManifest {
  /**
   * Unique identifier for the augmentation (e.g., 'wal', 'cache')
   */
  id: string
  
  /**
   * Display name for the augmentation
   */
  name: string
  
  /**
   * Semantic version (e.g., '2.0.0')
   */
  version: string
  
  /**
   * Author or organization
   */
  author?: string
  
  /**
   * Short description of what the augmentation does
   */
  description: string
  
  /**
   * Detailed description for documentation
   */
  longDescription?: string
  
  /**
   * Augmentation category for organization
   */
  category: 'storage' | 'performance' | 'analytics' | 'integration' | 'internal' | 'core' | 'premium' | 'community' | 'external'
  
  /**
   * JSON Schema for configuration options
   * Used to generate configuration UIs and validate configuration
   */
  configSchema?: JSONSchema
  
  /**
   * Default configuration values
   */
  configDefaults?: Record<string, any>
  
  /**
   * Configuration examples for documentation
   */
  configExamples?: Array<{
    name: string
    description: string
    config: Record<string, any>
  }>
  
  /**
   * Minimum Brainy version required
   */
  minBrainyVersion?: string
  
  /**
   * Maximum Brainy version supported
   */
  maxBrainyVersion?: string
  
  /**
   * Other augmentations this one depends on
   */
  dependencies?: Array<{
    id: string
    version?: string
    optional?: boolean
  }>
  
  /**
   * Keywords for search and discovery
   */
  keywords?: string[]
  
  /**
   * URL to documentation
   */
  documentation?: string
  
  /**
   * URL to source code repository
   */
  repository?: string
  
  /**
   * License identifier (e.g., 'MIT', 'Apache-2.0')
   */
  license?: string
  
  /**
   * UI hints for tools and configuration interfaces
   */
  ui?: {
    /**
     * Icon for the augmentation (emoji or URL)
     */
    icon?: string
    
    /**
     * Color theme for UI
     */
    color?: string
    
    /**
     * Custom React component name for configuration
     */
    configComponent?: string
    
    /**
     * URL to dashboard or control panel
     */
    dashboardUrl?: string
    
    /**
     * Hide from UI listings
     */
    hidden?: boolean
  }
  
  /**
   * Performance characteristics
   */
  performance?: {
    /**
     * Estimated memory usage
     */
    memoryUsage?: 'low' | 'medium' | 'high'
    
    /**
     * CPU intensity
     */
    cpuUsage?: 'low' | 'medium' | 'high'
    
    /**
     * Network usage
     */
    networkUsage?: 'none' | 'low' | 'medium' | 'high'
  }
  
  /**
   * Feature flags this augmentation provides
   */
  features?: string[]
  
  /**
   * Operations this augmentation enhances
   */
  enhancedOperations?: string[]
  
  /**
   * Metrics this augmentation exposes
   */
  metrics?: Array<{
    name: string
    type: 'counter' | 'gauge' | 'histogram'
    description: string
  }>
  
  /**
   * Status of the augmentation
   */
  status?: 'stable' | 'beta' | 'experimental' | 'deprecated'
  
  /**
   * Deprecation notice if applicable
   */
  deprecation?: {
    since: string
    alternative?: string
    removalDate?: string
  }
}