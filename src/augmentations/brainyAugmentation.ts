/**
 * Single BrainyAugmentation Interface
 * 
 * This replaces the 7 complex interfaces with one elegant, purpose-driven design.
 * Each augmentation knows its place and when to execute automatically.
 * 
 * The Vision: Components that enhance Brainy's capabilities seamlessly
 * - RequestDeduplicator: Prevents duplicate concurrent requests  
 * - ConnectionPool: Optimizes cloud storage throughput
 * - IntelligentVerbScoring: Enhances relationship analysis
 * - StreamingPipeline: Enables unlimited data processing
 */

import { AugmentationManifest } from './manifest.js'
import { AugmentationConfigResolver } from './configResolver.js'

/**
 * Metadata access declaration for augmentations
 */
export interface MetadataAccess {
  reads?: string[] | '*'      // Fields to read, or '*' for all
  writes?: string[] | '*'     // Fields to write, or '*' for all  
  namespace?: string           // Optional: custom namespace like '_myAug'
}

export interface BrainyAugmentation {
  /**
   * Unique identifier for the augmentation
   */
  name: string
  
  /**
   * When this augmentation should execute
   * - 'before': Execute before the main operation
   * - 'after': Execute after the main operation  
   * - 'around': Wrap the main operation (like middleware)
   * - 'replace': Replace the main operation entirely
   */
  timing: 'before' | 'after' | 'around' | 'replace'
  
  /**
   * Metadata access contract - REQUIRED
   * - 'none': No metadata access at all
   * - 'readonly': Can read any metadata but cannot write
   * - MetadataAccess: Specific fields to read/write
   */
  metadata: 'none' | 'readonly' | MetadataAccess
  
  /**
   * Which operations this augmentation applies to
   * Granular operation matching for precise augmentation targeting
   */
   operations: (
    // Data Operations
    | 'add' | 'addNoun' | 'addVerb' 
    | 'saveNoun' | 'saveVerb' | 'updateMetadata'
    | 'update' | 'delete' | 'deleteVerb' | 'clear' | 'get'
    
    // Search Operations
    | 'search' | 'searchText' | 'searchByNounTypes' 
    | 'find' | 'findSimilar' | 'searchWithCursor' | 'similar'
    
    // Relationship Operations
    | 'relate' | 'unrelate' | 'getConnections' | 'getRelations'
    
    // Storage Operations
    | 'storage' | 'backup' | 'restore'
    
    // Meta
    | 'all'
  )[]
  
  /**
   * Priority for execution order (higher numbers execute first)
   * - 100: Critical system operations (ConnectionPool)
   * - 50: Performance optimizations (RequestDeduplicator, Caching)
   * - 10: Enhancement features (IntelligentVerbScoring)
   * - 1: Optional features (Logging, Analytics)
   */
  priority: number
  
  /**
   * Initialize the augmentation
   * Called once during Brainy initialization
   * 
   * @param context - The Brainy instance and storage
   */
  initialize(context: AugmentationContext): Promise<void>
  
  /**
   * Execute the augmentation
   * 
   * @param operation - The operation being performed
   * @param params - Parameters for the operation
   * @param next - Function to call the next augmentation or main operation
   * @returns Result of the operation
   */
  execute<T = any>(
    operation: string,
    params: any,
    next: () => Promise<T>
  ): Promise<T>
  
  /**
   * Optional: Check if this augmentation should run for the given operation
   * Return false to skip execution
   */
  shouldExecute?(operation: string, params: any): boolean
  
  /**
   * Optional: Cleanup when Brainy is destroyed
   */
  shutdown?(): Promise<void>
  
  /**
   * Optional: Computed fields this augmentation provides
   * Used for discovery, TypeScript support, and API documentation
   */
  computedFields?: {
    [namespace: string]: {
      [field: string]: {
        type: 'string' | 'number' | 'boolean' | 'object' | 'array'
        description: string
        confidence?: number
      }
    }
  }
  
  /**
   * Optional: Compute fields for a result entity
   * Called when user accesses getDisplay(), getSchema(), etc.
   * 
   * @param result - The result entity (VectorDocument, GraphVerb, etc.)
   * @param namespace - The namespace being requested ('display', 'schema', etc.)
   * @returns Computed fields for the namespace
   */
  computeFields?(result: any, namespace: string): Promise<Record<string, any>> | Record<string, any>
}

/**
 * Context provided to augmentations
 */
export interface AugmentationContext {
  /**
   * The Brainy instance (for accessing methods and config)
   */
  brain: any // Brainy - avoiding circular imports
  
  /**
   * The storage adapter
   */
  storage: any // StorageAdapter
  
  /**
   * Configuration for this augmentation
   */
  config: any
  
  /**
   * Logging function
   */
  log: (message: string, level?: 'info' | 'warn' | 'error') => void
}

/**
 * Base class for augmentations with common functionality
 * 
 * This is the unified base class that combines the features of both
 * BaseAugmentation and ConfigurableAugmentation. All augmentations
 * should extend this class for consistent configuration support.
 */
export abstract class BaseAugmentation implements BrainyAugmentation {
  abstract name: string
  abstract timing: 'before' | 'after' | 'around' | 'replace'
  abstract metadata: 'none' | 'readonly' | MetadataAccess
  abstract operations: (
    // Data Operations
    | 'add' | 'addNoun' | 'addVerb' 
    | 'saveNoun' | 'saveVerb' | 'updateMetadata'
    | 'update' | 'delete' | 'deleteVerb' | 'clear' | 'get'
    
    // Search Operations
    | 'search' | 'searchText' | 'searchByNounTypes' 
    | 'find' | 'findSimilar' | 'searchWithCursor' | 'similar'
    
    // Relationship Operations
    | 'relate' | 'unrelate' | 'getConnections' | 'getRelations'
    
    // Storage Operations
    | 'storage' | 'backup' | 'restore'
    
    // Meta
    | 'all'
  )[]
  abstract priority: number
  
  // Metadata for augmentation listing and management
  category: 'internal' | 'core' | 'premium' | 'community' | 'external' = 'core'
  description: string = ''
  enabled: boolean = true
  
  protected context?: AugmentationContext
  protected isInitialized = false
  protected config: any = {}
  private configResolver?: AugmentationConfigResolver
  
  /**
   * Constructor with optional configuration
   * @param config Optional configuration to override defaults
   */
  constructor(config?: any) {
    // Only resolve configuration if getManifest is implemented
    if (this.getManifest) {
      this.config = this.resolveConfiguration(config)
    } else if (config) {
      // Legacy support: direct config assignment for augmentations without manifests
      this.config = config
    }
  }
  
  /**
   * Get the augmentation manifest for discovery
   * Override this to enable configuration support
   * CRITICAL: This enables tools to discover parameters and configuration
   */
  getManifest?(): AugmentationManifest
  
  /**
   * Get parameter schema for operations
   * Enables tools to know what parameters each operation needs
   */
  getParameterSchema?(operation: string): any
  
  /**
   * Get operation descriptions
   * Enables tools to show what each operation does
   */
  getOperationInfo?(): Record<string, {
    description: string
    parameters?: any
    returns?: any
    examples?: any[]
  }>
  
  /**
   * Get current configuration
   */
  getConfig(): any {
    return { ...this.config }
  }
  
  /**
   * Update configuration at runtime
   * @param partial Partial configuration to merge
   */
  async updateConfig(partial: any): Promise<void> {
    if (!this.configResolver) {
      // For legacy augmentations without manifest, just merge config
      const oldConfig = this.config
      this.config = { ...this.config, ...partial }
      
      if (this.onConfigChange) {
        await this.onConfigChange(this.config, oldConfig)
      }
      return
    }
    
    const oldConfig = this.config
    
    try {
      // Use resolver to update and validate
      this.config = this.configResolver.updateRuntime(partial)
      
      // Call config change handler if implemented
      if (this.onConfigChange) {
        await this.onConfigChange(this.config, oldConfig)
      }
    } catch (error) {
      // Revert on error
      this.config = oldConfig
      throw error
    }
  }
  
  /**
   * Optional: Handle configuration changes
   * Override this to react to runtime configuration updates
   */
  protected onConfigChange?(newConfig: any, oldConfig: any): Promise<void>
  
  /**
   * Resolve configuration from all sources
   * Priority: constructor > env > files > defaults
   */
  private resolveConfiguration(constructorConfig?: any): any {
    const manifest = this.getManifest!()
    
    // Create config resolver
    this.configResolver = new AugmentationConfigResolver({
      augmentationId: manifest.id,
      schema: manifest.configSchema,
      defaults: manifest.configDefaults
    })
    
    // Resolve configuration from all sources
    return this.configResolver.resolve(constructorConfig)
  }
  
  async initialize(context: AugmentationContext): Promise<void> {
    this.context = context
    this.isInitialized = true
    await this.onInitialize()
  }
  
  /**
   * Override this in subclasses for initialization logic
   */
  protected async onInitialize(): Promise<void> {
    // Default: no-op
  }
  
  abstract execute<T = any>(
    operation: string,
    params: any,
    next: () => Promise<T>
  ): Promise<T>
  
  shouldExecute(operation: string, params: any): boolean {
    // Default: execute if operations match exactly or includes 'all'
    return this.operations.includes('all' as any) || 
           this.operations.includes(operation as any) ||
           this.operations.some(op => operation.includes(op))
  }
  
  async shutdown(): Promise<void> {
    await this.onShutdown()
    this.isInitialized = false
  }
  
  /**
   * Override this in subclasses for cleanup logic
   */
  protected async onShutdown(): Promise<void> {
    // Default: no-op
  }
  
  /**
   * Optional computed fields declaration (override in subclasses)
   */
  computedFields?: {
    [namespace: string]: {
      [field: string]: {
        type: 'string' | 'number' | 'boolean' | 'object' | 'array'
        description: string
        confidence?: number
      }
    }
  }
  
  /**
   * Optional computed fields implementation (override in subclasses)
   * @param result The result entity
   * @param namespace The requested namespace
   * @returns Computed fields for the namespace
   */
  computeFields?(result: any, namespace: string): Promise<Record<string, any>> | Record<string, any>
  
  /**
   * Log a message with the augmentation name
   */
  protected log(message: string, level: 'info' | 'warn' | 'error' = 'info'): void {
    if (this.context) {
      this.context.log(`[${this.name}] ${message}`, level)
    }
  }
}

/**
 * Alias for backward compatibility
 * ConfigurableAugmentation is now merged into BaseAugmentation
 * @deprecated Use BaseAugmentation instead
 */
export const ConfigurableAugmentation = BaseAugmentation

/**
 * Registry for managing augmentations
 */
export class AugmentationRegistry {
  private augmentations: BrainyAugmentation[] = []
  private context?: AugmentationContext
  
  /**
   * Register an augmentation
   */
  register(augmentation: BrainyAugmentation): void {
    this.augmentations.push(augmentation)
    // Sort by priority (highest first)
    this.augmentations.sort((a, b) => b.priority - a.priority)
  }
  
  /**
   * Find augmentations by operation (before initialization)
   * Used for two-phase initialization to find storage augmentations
   */
  findByOperation(operation: string): BrainyAugmentation | null {
    return this.augmentations.find(aug => 
      aug.operations.includes(operation as any) ||
      aug.operations.includes('all' as any)
    ) || null
  }
  
  /**
   * Initialize all augmentations
   */
  async initialize(context: AugmentationContext): Promise<void> {
    this.context = context
    for (const augmentation of this.augmentations) {
      await augmentation.initialize(context)
    }
    context.log(`Initialized ${this.augmentations.length} augmentations`)
  }
  
  /**
   * Initialize all augmentations (alias for consistency)
   */
  async initializeAll(context: AugmentationContext): Promise<void> {
    return this.initialize(context)
  }
  
  /**
   * Execute augmentations for an operation
   */
  async execute<T = any>(
    operation: string,
    params: any,
    mainOperation: () => Promise<T>
  ): Promise<T> {
    // Filter augmentations that should execute for this operation
    const applicable = this.augmentations.filter(aug => 
      aug.shouldExecute ? aug.shouldExecute(operation, params) : 
      aug.operations.includes('all' as any) || 
      aug.operations.includes(operation as any) ||
      aug.operations.some(op => operation.includes(op))
    )
    
    if (applicable.length === 0) {
      // No augmentations, execute main operation directly
      return mainOperation()
    }
    
    // Create a chain of augmentations
    let index = 0
    const executeNext = async (): Promise<T> => {
      if (index >= applicable.length) {
        // All augmentations processed, execute main operation
        return mainOperation()
      }
      
      const augmentation = applicable[index++]
      return augmentation.execute(operation, params, executeNext)
    }
    
    return executeNext()
  }
  
  /**
   * Get all registered augmentations
   */
  getAll(): BrainyAugmentation[] {
    return [...this.augmentations]
  }
  
  /**
   * Get augmentation info for listing
   */
  getInfo(): Array<{
    name: string
    type: string
    enabled: boolean
    description: string
    category: string
    priority: number
  }> {
    return this.augmentations.map(aug => {
      const baseAug = aug as any
      return {
        name: aug.name,
        type: baseAug.category || 'core',
        enabled: baseAug.enabled !== false,
        description: baseAug.description || `${aug.name} augmentation`,
        category: baseAug.category || 'core',
        priority: aug.priority
      }
    })
  }
  
  /**
   * Get augmentations by name
   */
  get(name: string): BrainyAugmentation | undefined {
    return this.augmentations.find(aug => aug.name === name)
  }
  
  /**
   * Discover augmentation parameters and schemas
   * Critical for tools like brain-cloud to generate UIs
   */
  discover(name?: string): any {
    if (name) {
      const aug = this.get(name)
      if (!aug) return null
      
      const baseAug = aug as BaseAugmentation
      return {
        name: aug.name,
        operations: aug.operations,
        priority: aug.priority,
        timing: aug.timing,
        metadata: aug.metadata,
        manifest: baseAug.getManifest ? baseAug.getManifest() : undefined,
        parameters: baseAug.getParameterSchema ? 
          aug.operations.reduce((acc, op) => {
            acc[op] = baseAug.getParameterSchema!(op as string)
            return acc
          }, {} as any) : undefined,
        operationInfo: baseAug.getOperationInfo ? baseAug.getOperationInfo() : undefined,
        config: baseAug.getConfig ? baseAug.getConfig() : undefined
      }
    }
    
    // Return all augmentations discovery info
    return this.augmentations.map(aug => this.discover(aug.name))
  }
  
  /**
   * Get configuration schema for an augmentation
   * Enables UI generation for configuration
   */
  getConfigSchema(name: string): any {
    const aug = this.get(name) as BaseAugmentation
    if (!aug || !aug.getManifest) return null
    
    const manifest = aug.getManifest()
    return manifest?.configSchema
  }
  
  /**
   * Configure an augmentation at runtime
   */
  async configure(name: string, config: any): Promise<void> {
    const aug = this.get(name) as BaseAugmentation
    if (!aug || !aug.updateConfig) {
      throw new Error(`Augmentation ${name} does not support configuration`)
    }
    
    await aug.updateConfig(config)
  }
  
  /**
   * Get metrics for an augmentation
   */
  metrics(name?: string): any {
    if (name) {
      const aug = this.get(name) as any
      if (!aug || !aug.metrics) return null
      return aug.metrics()
    }
    
    // Return all metrics
    const allMetrics: any = {}
    for (const aug of this.augmentations) {
      const a = aug as any
      if (a.metrics) {
        allMetrics[aug.name] = a.metrics()
      }
    }
    return allMetrics
  }
  
  /**
   * Get health status
   */
  health(): any {
    const health: any = {
      overall: 'healthy',
      augmentations: {}
    }
    
    for (const aug of this.augmentations) {
      const a = aug as any
      health.augmentations[aug.name] = a.health ? a.health() : 'unknown'
    }
    
    return health
  }
  
  /**
   * Shutdown all augmentations
   */
  async shutdown(): Promise<void> {
    for (const augmentation of this.augmentations) {
      if (augmentation.shutdown) {
        await augmentation.shutdown()
      }
    }
    this.augmentations = []
  }
}