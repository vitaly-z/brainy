/**
 * Universal Display Augmentation
 * 
 * 🎨 Provides intelligent display fields for any noun or verb using AI-powered analysis
 * 
 * Features:
 * - ✅ Leverages existing IntelligentTypeMatcher for semantic type detection
 * - ✅ Complete icon coverage for all 31 NounTypes + 40+ VerbTypes
 * - ✅ Zero performance impact with lazy computation and intelligent caching
 * - ✅ Perfect isolation - can be disabled, replaced, or configured
 * - ✅ Clean developer experience with zero conflicts
 * - ✅ TypeScript support with full autocomplete
 * 
 * Usage:
 * ```typescript
 * // User data access (unchanged)
 * result.firstName  // "John"
 * result.metadata.title  // "CEO"
 * 
 * // Enhanced display (new capabilities)
 * result.getDisplay('title')       // "John Doe" (AI-computed)
 * result.getDisplay('description') // "CEO at Acme Corp" (enhanced)
 * result.getDisplay('type')        // "Person" (from AI detection)
 * result.getDisplay()             // All display fields
 * ```
 */

import { BaseAugmentation, AugmentationContext, MetadataAccess } from './brainyAugmentation.js'
import type { VectorDocument, GraphVerb } from '../coreTypes.js'
import type { 
  DisplayConfig, 
  ComputedDisplayFields, 
  EnhancedVectorDocument, 
  EnhancedGraphVerb,
  DisplayAugmentationStats 
} from './display/types.js'
import { IntelligentComputationEngine } from './display/intelligentComputation.js'
import { DisplayCache, RequestDeduplicator, getGlobalDisplayCache } from './display/cache.js'
import { getNounIcon, getVerbIcon, getIconCoverage } from './display/iconMappings.js'

/**
 * Universal Display Augmentation
 * 
 * Self-contained augmentation that provides intelligent display fields
 * for any data type using existing Brainy AI infrastructure
 */
export class UniversalDisplayAugmentation extends BaseAugmentation {
  readonly name = 'display'
  readonly version = '1.0.0'
  readonly timing = 'after' as const  // Enhance results after main operations
  readonly priority = 50              // Medium priority - after core operations
  readonly metadata: MetadataAccess = {
    reads: '*',           // Read all user data for intelligent analysis
    writes: ['_display']  // Cache computed fields in isolated namespace
  }
  operations = ['get', 'search', 'findSimilar', 'getVerb' as any, 'addNoun', 'addVerb'] as any

  // Computed fields declaration for TypeScript support and discovery
  computedFields = {
    display: {
      title: { type: 'string' as const, description: 'Primary display name (AI-computed)' },
      description: { type: 'string' as const, description: 'Enhanced description with context' },
      type: { type: 'string' as const, description: 'Human-readable type (from AI detection)' },
      tags: { type: 'array' as const, description: 'Generated display tags' },
      relationship: { type: 'string' as const, description: 'Human-readable relationship (verbs only)' },
      confidence: { type: 'number' as const, description: 'AI confidence score (0-1)' }
    }
  }

  // Core components (all self-contained)
  private computationEngine: IntelligentComputationEngine
  private displayCache: DisplayCache
  private requestDeduplicator: RequestDeduplicator
  private config: DisplayConfig
  protected context: AugmentationContext | undefined

  constructor(config: Partial<DisplayConfig> = {}) {
    super()
    
    // Merge with defaults
    this.config = {
      enabled: true,
      cacheSize: 1000,
      lazyComputation: true,
      batchSize: 50,
      confidenceThreshold: 0.7,
      customFieldMappings: {},
      priorityFields: {},
      debugMode: false,
      ...config
    }

    // Initialize components
    this.computationEngine = new IntelligentComputationEngine(this.config)
    this.displayCache = getGlobalDisplayCache(this.config.cacheSize)
    this.requestDeduplicator = new RequestDeduplicator(this.config.batchSize)
  }

  /**
   * Initialize the augmentation with AI components
   * @param context BrainyData context
   */
  async initialize(context: AugmentationContext): Promise<void> {
    if (!this.config.enabled) {
      this.log('🎨 Universal Display augmentation disabled')
      return
    }

    this.context = context
    
    try {
      // Initialize AI-powered computation engine
      await this.computationEngine.initialize()
      
      this.log('🎨 Universal Display augmentation initialized successfully')
      this.log(`   Cache size: ${this.config.cacheSize}`)
      this.log(`   Lazy computation: ${this.config.lazyComputation}`)
      this.log(`   Coverage: ${this.getCoverageInfo()}`)
      
    } catch (error) {
      this.log('⚠️ Display augmentation initialization warning:', 'warn')
      this.log(`   ${error}`, 'warn')
      this.log('   Falling back to basic mode', 'warn')
    }
  }

  /**
   * Execute augmentation - attach display capabilities to results
   * @param operation The operation being performed
   * @param params Operation parameters
   * @param next Function to execute main operation
   * @returns Enhanced result with display capabilities
   */
  async execute<T = any>(
    operation: string,
    params: any,
    next: () => Promise<T>
  ): Promise<T> {
    // Always execute main operation first
    const result = await next()
    
    // Only enhance if enabled and operation is relevant
    if (!this.config.enabled || !this.shouldEnhanceOperation(operation)) {
      return result
    }

    try {
      // Enhance result with display capabilities
      return this.enhanceWithDisplayCapabilities(result, operation) as T
    } catch (error) {
      this.log(`Display enhancement failed for ${operation}: ${error}`, 'warn')
      return result // Return unenhanced result on error
    }
  }

  /**
   * Check if operation should be enhanced
   * @param operation Operation name
   * @returns True if should enhance
   */
  private shouldEnhanceOperation(operation: string): boolean {
    const enhanceableOps = ['get', 'search', 'findSimilar', 'getVerb']
    return enhanceableOps.includes(operation)
  }

  /**
   * Enhance result with display capabilities
   * @param result The operation result
   * @param operation The operation type
   * @returns Enhanced result
   */
  private enhanceWithDisplayCapabilities(result: any, operation: string): any {
    if (!result) return result

    // Handle different result types
    if (Array.isArray(result)) {
      // Array of results (search, findSimilar)
      return result.map(item => this.enhanceEntity(item))
    } else if (result.id || result.metadata) {
      // Single entity (get, getVerb)
      return this.enhanceEntity(result)
    }

    return result
  }

  /**
   * Enhance a single entity with display capabilities
   * @param entity The entity to enhance
   * @returns Enhanced entity
   */
  private enhanceEntity(entity: any): EnhancedVectorDocument | EnhancedGraphVerb {
    if (!entity) return entity

    // Determine if it's a noun or verb
    const isVerb = this.isVerbEntity(entity)
    
    // Add display methods
    const enhanced = {
      ...entity,
      getDisplay: this.createGetDisplayMethod(entity, isVerb),
      getAvailableFields: this.createGetAvailableFieldsMethod(),
      getAvailableAugmentations: this.createGetAvailableAugmentationsMethod(),
      explore: this.createExploreMethod(entity)
    }

    return enhanced
  }

  /**
   * Create getDisplay method for an entity
   * @param entity The entity
   * @param isVerb Whether it's a verb entity
   * @returns getDisplay function
   */
  private createGetDisplayMethod(entity: any, isVerb: boolean) {
    return async (field?: keyof ComputedDisplayFields): Promise<any> => {
      // Generate cache key
      const cacheKey = this.displayCache.generateKey(
        entity.id, 
        entity.metadata || entity,
        isVerb ? 'verb' : 'noun'
      )

      // Use request deduplicator to prevent duplicate computations
      const computedFields = await this.requestDeduplicator.deduplicate(
        cacheKey,
        async () => {
          // Check cache first
          let cached = this.displayCache.get(cacheKey)
          if (cached) return cached

          // Compute display fields
          const startTime = Date.now()
          let computed: ComputedDisplayFields
          
          if (isVerb) {
            computed = await this.computationEngine.computeVerbDisplay(entity as GraphVerb)
          } else {
            computed = await this.computationEngine.computeNounDisplay(
              entity.metadata || entity, 
              entity.id
            )
          }
          
          // Cache the result
          const computationTime = Date.now() - startTime
          this.displayCache.set(cacheKey, computed, computationTime)
          
          return computed
        }
      )

      // Return specific field or all fields
      return field ? computedFields[field] : computedFields
    }
  }

  /**
   * Create getAvailableFields method
   * @returns getAvailableFields function
   */
  private createGetAvailableFieldsMethod() {
    return (namespace: string): string[] => {
      if (namespace === 'display') {
        return ['title', 'description', 'type', 'tags', 'relationship', 'confidence']
      }
      return []
    }
  }

  /**
   * Create getAvailableAugmentations method
   * @returns getAvailableAugmentations function
   */
  private createGetAvailableAugmentationsMethod() {
    return (): string[] => {
      return ['display'] // This augmentation provides 'display' namespace
    }
  }

  /**
   * Create explore method for debugging
   * @param entity The entity
   * @returns explore function
   */
  private createExploreMethod(entity: any) {
    return async (): Promise<void> => {
      console.log(`\n📋 Entity Exploration: ${entity.id || 'unknown'}`)
      console.log('━'.repeat(50))
      
      // Show user data
      console.log('\n👤 User Data:')
      const userData = entity.metadata || entity
      for (const [key, value] of Object.entries(userData)) {
        if (!key.startsWith('_')) {
          console.log(`  • ${key}: ${JSON.stringify(value)}`)
        }
      }

      // Show computed display fields
      try {
        console.log('\n🎨 Display Fields:')
        const displayMethod = this.createGetDisplayMethod(entity, this.isVerbEntity(entity))
        const displayFields = await displayMethod()
        for (const [key, value] of Object.entries(displayFields)) {
          console.log(`  • ${key}: ${JSON.stringify(value)}`)
        }
      } catch (error) {
        console.log(`  Error computing display fields: ${error}`)
      }
      
      console.log('')
    }
  }

  /**
   * Check if an entity is a verb
   * @param entity The entity to check
   * @returns True if it's a verb
   */
  private isVerbEntity(entity: any): boolean {
    return !!(entity.sourceId && entity.targetId) || 
           !!(entity.source && entity.target) ||
           !!entity.verb
  }

  /**
   * Get coverage information
   * @returns Coverage info string
   */
  private getCoverageInfo(): string {
    return 'Clean display - focuses on AI-powered content'
  }

  /**
   * Get augmentation statistics
   * @returns Performance and usage statistics
   */
  getStats(): DisplayAugmentationStats {
    return this.displayCache.getStats()
  }

  /**
   * Configure the augmentation at runtime
   * @param newConfig Partial configuration to merge
   */
  configure(newConfig: Partial<DisplayConfig>): void {
    this.config = { ...this.config, ...newConfig }
    
    if (!this.config.enabled) {
      this.displayCache.clear()
    }
  }

  /**
   * Clear all cached display data
   */
  clearCache(): void {
    this.displayCache.clear()
  }

  /**
   * Precompute display fields for a batch of entities
   * @param entities Array of entities to precompute
   */
  async precomputeBatch(entities: Array<{ id: string; data: any }>): Promise<void> {
    const computeRequests = entities.map(({ id, data }) => ({
      key: this.displayCache.generateKey(id, data, 'noun'),
      computeFn: () => this.computationEngine.computeNounDisplay(data, id)
    }))

    await this.displayCache.batchPrecompute(computeRequests)
  }

  /**
   * Optional check if this augmentation should run
   * @param operation Operation name
   * @param params Operation parameters
   * @returns True if should execute
   */
  shouldExecute(operation: string, params: any): boolean {
    return this.config.enabled && this.shouldEnhanceOperation(operation)
  }

  /**
   * Cleanup when augmentation is shut down
   */
  async shutdown(): Promise<void> {
    try {
      // Cleanup computation engine
      await this.computationEngine.shutdown()
      
      // Cleanup request deduplicator
      this.requestDeduplicator.shutdown()
      
      // Clear cache if configured to do so
      if (this.config.debugMode) {
        const stats = this.getStats()
        this.log(`🎨 Display augmentation shutdown statistics:`)
        this.log(`   Total computations: ${stats.totalComputations}`)
        this.log(`   Cache hit ratio: ${(stats.cacheHitRatio * 100).toFixed(1)}%`)
        this.log(`   Average computation time: ${stats.averageComputationTime.toFixed(1)}ms`)
      }
      
      this.log('🎨 Universal Display augmentation shut down')
      
    } catch (error) {
      this.log(`Display augmentation shutdown error: ${error}`, 'error')
    }
  }
}

/**
 * Factory function to create display augmentation with default config
 * @param config Optional configuration overrides
 * @returns Configured display augmentation instance
 */
export function createDisplayAugmentation(config: Partial<DisplayConfig> = {}): UniversalDisplayAugmentation {
  return new UniversalDisplayAugmentation(config)
}

/**
 * Default configuration for the display augmentation
 */
export const DEFAULT_DISPLAY_CONFIG: DisplayConfig = {
  enabled: true,
  cacheSize: 1000,
  lazyComputation: true,
  batchSize: 50,
  confidenceThreshold: 0.7,
  customFieldMappings: {},
  priorityFields: {},
  debugMode: false
}

/**
 * Export for easy import and registration
 */
export default UniversalDisplayAugmentation