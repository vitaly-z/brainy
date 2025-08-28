/**
 * Single BrainyAugmentation Interface
 * 
 * This replaces the 7 complex interfaces with one elegant, purpose-driven design.
 * Each augmentation knows its place and when to execute automatically.
 * 
 * The Vision: Components that enhance Brainy's capabilities seamlessly
 * - WAL: Adds durability to storage operations
 * - RequestDeduplicator: Prevents duplicate concurrent requests  
 * - ConnectionPool: Optimizes cloud storage throughput
 * - IntelligentVerbScoring: Enhances relationship analysis
 * - StreamingPipeline: Enables unlimited data processing
 */

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
    | 'delete' | 'deleteVerb' | 'clear' | 'get'
    
    // Search Operations
    | 'search' | 'searchText' | 'searchByNounTypes' 
    | 'findSimilar' | 'searchWithCursor'
    
    // Relationship Operations
    | 'relate' | 'getConnections'
    
    // Storage Operations
    | 'storage' | 'backup' | 'restore'
    
    // Meta
    | 'all'
  )[]
  
  /**
   * Priority for execution order (higher numbers execute first)
   * - 100: Critical system operations (WAL, ConnectionPool)
   * - 50: Performance optimizations (RequestDeduplicator, Caching)
   * - 10: Enhancement features (IntelligentVerbScoring)
   * - 1: Optional features (Logging, Analytics)
   */
  priority: number
  
  /**
   * Initialize the augmentation
   * Called once during BrainyData initialization
   * 
   * @param context - The BrainyData instance and storage
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
   * Optional: Cleanup when BrainyData is destroyed
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
   * The BrainyData instance (for accessing methods and config)
   */
  brain: any // BrainyData - avoiding circular imports
  
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
 */
export abstract class BaseAugmentation implements BrainyAugmentation {
  abstract name: string
  abstract timing: 'before' | 'after' | 'around' | 'replace'
  abstract metadata: 'none' | 'readonly' | MetadataAccess
  abstract operations: (
    // Data Operations
    | 'add' | 'addNoun' | 'addVerb' 
    | 'saveNoun' | 'saveVerb' | 'updateMetadata'
    | 'delete' | 'deleteVerb' | 'clear' | 'get'
    
    // Search Operations
    | 'search' | 'searchText' | 'searchByNounTypes' 
    | 'findSimilar' | 'searchWithCursor'
    
    // Relationship Operations
    | 'relate' | 'getConnections'
    
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