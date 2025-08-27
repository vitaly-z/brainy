/**
 * Augmentation Metadata Contract System
 * 
 * Prevents accidental metadata corruption while allowing intentional enrichment
 * Each augmentation declares its metadata intentions upfront
 */

export interface AugmentationMetadataContract {
  // Augmentation identity
  name: string
  version: string
  
  // What fields this augmentation READS
  reads?: {
    userFields?: string[]        // e.g., ['title', 'description']
    internalFields?: string[]    // e.g., ['_brainy.deleted']
    augmentationFields?: string[] // e.g., ['_augmentations.otherAug.score']
  }
  
  // What fields this augmentation WRITES
  writes?: {
    // User metadata it enriches (MUST be declared!)
    userFields?: Array<{
      field: string
      type: 'create' | 'update' | 'merge' | 'delete'
      description: string
      example?: any
    }>
    
    // Its own augmentation namespace
    augmentationFields?: Array<{
      field: string
      description: string
    }>
    
    // Internal fields (requires special permission)
    internalFields?: Array<{
      field: string
      permission: 'granted' | 'requested'
      reason: string
    }>
  }
  
  // Conflict resolution strategy
  conflictResolution?: {
    strategy: 'error' | 'warn' | 'merge' | 'skip' | 'override'
    priority?: number // Higher priority wins in conflicts
  }
  
  // Safety guarantees
  guarantees?: {
    preservesExisting?: boolean   // Won't delete existing fields
    reversible?: boolean          // Can undo changes
    idempotent?: boolean         // Safe to run multiple times
    validatesTypes?: boolean     // Checks field types before modifying
  }
}

/**
 * Runtime metadata safety enforcer
 */
export class MetadataSafetyEnforcer {
  private contracts: Map<string, AugmentationMetadataContract> = new Map()
  private modifications: Map<string, Set<string>> = new Map() // field -> augmentations that modify it
  
  /**
   * Register an augmentation's contract
   */
  registerContract(contract: AugmentationMetadataContract): void {
    this.contracts.set(contract.name, contract)
    
    // Track which augmentations modify which fields
    if (contract.writes?.userFields) {
      for (const fieldDef of contract.writes.userFields) {
        if (!this.modifications.has(fieldDef.field)) {
          this.modifications.set(fieldDef.field, new Set())
        }
        this.modifications.get(fieldDef.field)!.add(contract.name)
      }
    }
  }
  
  /**
   * Check if an augmentation can modify a field
   */
  canModifyField(augName: string, field: string, value: any): {
    allowed: boolean
    reason?: string
    warnings?: string[]
  } {
    const contract = this.contracts.get(augName)
    
    if (!contract) {
      return {
        allowed: false,
        reason: `Augmentation '${augName}' has no registered contract`
      }
    }
    
    // Check if field is in user namespace
    if (!field.startsWith('_brainy.') && !field.startsWith('_augmentations.')) {
      // It's a user field
      const declaredField = contract.writes?.userFields?.find(f => f.field === field)
      
      if (!declaredField) {
        return {
          allowed: false,
          reason: `Augmentation '${augName}' did not declare intent to modify '${field}'`
        }
      }
      
      // Check for conflicts
      const modifiers = this.modifications.get(field)
      if (modifiers && modifiers.size > 1) {
        const others = Array.from(modifiers).filter(a => a !== augName)
        return {
          allowed: true, // Still allowed but with warning
          warnings: [`Field '${field}' is also modified by: ${others.join(', ')}`]
        }
      }
      
      return { allowed: true }
    }
    
    // Check internal fields
    if (field.startsWith('_brainy.')) {
      const internalField = contract.writes?.internalFields?.find(f => 
        field === `_brainy.${f.field}`
      )
      
      if (!internalField) {
        return {
          allowed: false,
          reason: `Augmentation '${augName}' cannot modify internal field '${field}'`
        }
      }
      
      if (internalField.permission !== 'granted') {
        return {
          allowed: false,
          reason: `Permission not granted for internal field '${field}'`
        }
      }
      
      return { allowed: true }
    }
    
    // Check augmentation namespace
    if (field.startsWith('_augmentations.')) {
      const parts = field.split('.')
      const targetAug = parts[1]
      
      // Can only modify own namespace
      if (targetAug !== augName) {
        return {
          allowed: false,
          reason: `Cannot modify another augmentation's namespace: ${targetAug}`
        }
      }
      
      return { allowed: true }
    }
    
    return { allowed: true }
  }
  
  /**
   * Create safe metadata proxy for an augmentation
   */
  createSafeProxy(metadata: any, augName: string): any {
    const self = this
    
    return new Proxy(metadata, {
      set(target, prop, value) {
        const field = String(prop)
        
        // Check permission
        const permission = self.canModifyField(augName, field, value)
        
        if (!permission.allowed) {
          throw new Error(`[${augName}] ${permission.reason}`)
        }
        
        if (permission.warnings) {
          console.warn(`[${augName}] Warning:`, ...permission.warnings)
        }
        
        // Track modification for audit
        if (!target._audit) {
          target._audit = []
        }
        target._audit.push({
          augmentation: augName,
          field,
          oldValue: target[prop],
          newValue: value,
          timestamp: Date.now()
        })
        
        target[prop] = value
        return true
      },
      
      deleteProperty(target, prop) {
        const field = String(prop)
        const permission = self.canModifyField(augName, field, undefined)
        
        if (!permission.allowed) {
          throw new Error(`[${augName}] Cannot delete field: ${permission.reason}`)
        }
        
        delete target[prop]
        return true
      }
    })
  }
}

/**
 * Example augmentation contracts
 */
export const EXAMPLE_CONTRACTS: Record<string, AugmentationMetadataContract> = {
  // Enrichment augmentation that adds categories
  categoryEnricher: {
    name: 'categoryEnricher',
    version: '1.0.0',
    reads: {
      userFields: ['title', 'description', 'content']
    },
    writes: {
      userFields: [
        {
          field: 'category',
          type: 'create',
          description: 'Auto-detected category',
          example: 'technology'
        },
        {
          field: 'subcategories',
          type: 'create',
          description: 'List of relevant subcategories',
          example: ['web', 'framework']
        }
      ],
      augmentationFields: [
        {
          field: 'confidence',
          description: 'Confidence score of categorization'
        }
      ]
    },
    guarantees: {
      preservesExisting: true,
      idempotent: true
    }
  },
  
  // Translation augmentation
  translator: {
    name: 'translator',
    version: '1.0.0',
    reads: {
      userFields: ['title', 'description']
    },
    writes: {
      userFields: [
        {
          field: 'translations',
          type: 'merge',
          description: 'Translations in multiple languages',
          example: { es: 'Título', fr: 'Titre' }
        },
        {
          field: 'detectedLanguage',
          type: 'create',
          description: 'Detected source language',
          example: 'en'
        }
      ]
    },
    conflictResolution: {
      strategy: 'merge',
      priority: 10
    }
  },
  
  // Sentiment analyzer
  sentimentAnalyzer: {
    name: 'sentimentAnalyzer',
    version: '1.0.0',
    reads: {
      userFields: ['content', 'description', 'reviews']
    },
    writes: {
      userFields: [
        {
          field: 'sentiment',
          type: 'update',
          description: 'Overall sentiment score',
          example: { score: 0.8, label: 'positive' }
        }
      ],
      augmentationFields: [
        {
          field: 'analysis',
          description: 'Detailed sentiment breakdown'
        }
      ]
    },
    guarantees: {
      reversible: true,
      validatesTypes: true
    }
  },
  
  // System augmentation with internal access
  garbageCollector: {
    name: 'garbageCollector',
    version: '1.0.0',
    reads: {
      internalFields: ['_brainy.createdAt', '_brainy.lastAccessed']
    },
    writes: {
      internalFields: [
        {
          field: 'deleted',
          permission: 'granted',
          reason: 'Soft delete expired items'
        },
        {
          field: 'archived',
          permission: 'granted',
          reason: 'Archive old items'
        }
      ]
    }
  }
}

/**
 * Augmentation base class with safety
 */
export abstract class SafeAugmentation {
  protected enforcer: MetadataSafetyEnforcer
  protected contract: AugmentationMetadataContract
  
  constructor(contract: AugmentationMetadataContract) {
    this.contract = contract
    this.enforcer = new MetadataSafetyEnforcer()
    this.enforcer.registerContract(contract)
  }
  
  /**
   * Get safe metadata proxy
   */
  protected getSafeMetadata(metadata: any): any {
    return this.enforcer.createSafeProxy(metadata, this.contract.name)
  }
  
  /**
   * Abstract method to implement augmentation logic
   */
  abstract execute(metadata: any): Promise<any>
}

/**
 * Example: Category enricher implementation
 */
export class CategoryEnricherAugmentation extends SafeAugmentation {
  constructor() {
    super(EXAMPLE_CONTRACTS.categoryEnricher)
  }
  
  async execute(metadata: any): Promise<any> {
    const safe = this.getSafeMetadata(metadata)
    
    // Read declared fields
    const title = safe.title
    const description = safe.description
    
    // Analyze and categorize
    const category = this.detectCategory(title, description)
    const subcategories = this.detectSubcategories(title, description)
    
    // Write to declared fields (will be checked by proxy)
    safe.category = category // ✅ Allowed - declared in contract
    safe.subcategories = subcategories // ✅ Allowed
    
    // Try to write undeclared field
    // safe.randomField = 'test' // ❌ Would throw error!
    
    // Write to our augmentation namespace
    if (!safe._augmentations) safe._augmentations = {}
    if (!safe._augmentations.categoryEnricher) {
      safe._augmentations.categoryEnricher = {}
    }
    safe._augmentations.categoryEnricher.confidence = 0.95 // ✅ Allowed
    
    return safe
  }
  
  private detectCategory(title: string, description: string): string {
    // Simplified logic
    return 'technology'
  }
  
  private detectSubcategories(title: string, description: string): string[] {
    return ['web', 'framework']
  }
}