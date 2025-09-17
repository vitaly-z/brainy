/**
 * Zero-Config Parameter Validation
 * 
 * Self-configuring validation that adapts to system capabilities
 * Only enforces universal truths, learns everything else
 */

import { FindParams, AddParams, UpdateParams, RelateParams } from '../types/brainy.types.js'
import { NounType, VerbType } from '../types/graphTypes.js'
import * as os from 'node:os'

/**
 * Auto-configured limits based on system resources
 * These adapt to available memory and observed performance
 */
class ValidationConfig {
  private static instance: ValidationConfig
  
  // Dynamic limits based on system
  public maxLimit: number
  public maxQueryLength: number
  public maxVectorDimensions: number
  
  // Performance observations
  private avgQueryTime: number = 0
  private queryCount: number = 0
  
  private constructor() {
    // Auto-configure based on system resources
    const totalMemory = os.totalmem()
    const availableMemory = os.freemem()
    
    // Scale limits based on available memory
    // 1GB = 10K limit, 8GB = 80K limit, etc.
    this.maxLimit = Math.min(
      100000, // Absolute max for safety
      Math.floor(availableMemory / (1024 * 1024 * 100)) * 1000
    )
    
    // Query length scales with memory too
    this.maxQueryLength = Math.min(
      50000,
      Math.floor(availableMemory / (1024 * 1024 * 10)) * 1000
    )
    
    // Vector dimensions (standard for all-MiniLM-L6-v2)
    this.maxVectorDimensions = 384
  }
  
  static getInstance(): ValidationConfig {
    if (!ValidationConfig.instance) {
      ValidationConfig.instance = new ValidationConfig()
    }
    return ValidationConfig.instance
  }
  
  /**
   * Learn from actual usage to adjust limits
   */
  recordQuery(duration: number, resultCount: number) {
    this.queryCount++
    this.avgQueryTime = (this.avgQueryTime * (this.queryCount - 1) + duration) / this.queryCount
    
    // If queries are consistently fast with large results, increase limits
    if (this.avgQueryTime < 100 && resultCount > this.maxLimit * 0.8) {
      this.maxLimit = Math.min(this.maxLimit * 1.5, 100000)
    }
    
    // If queries are slow, reduce limits
    if (this.avgQueryTime > 1000) {
      this.maxLimit = Math.max(this.maxLimit * 0.8, 1000)
    }
  }
}

/**
 * Universal validations - things that are always invalid
 * These are mathematical/logical truths, not configuration
 */
export function validateFindParams(params: FindParams): void {
  const config = ValidationConfig.getInstance()
  
  // Universal truth: negative pagination never makes sense
  if (params.limit !== undefined) {
    if (params.limit < 0) {
      throw new Error('limit must be non-negative')
    }
    if (params.limit > config.maxLimit) {
      throw new Error(`limit exceeds auto-configured maximum of ${config.maxLimit} (based on available memory)`)
    }
  }
  
  if (params.offset !== undefined && params.offset < 0) {
    throw new Error('offset must be non-negative')
  }
  
  // Universal truth: probability/similarity must be 0-1
  if (params.near?.threshold !== undefined) {
    const t = params.near.threshold
    if (t < 0 || t > 1) {
      throw new Error('threshold must be between 0 and 1')
    }
  }
  
  // Universal truth: can't specify both query and vector (they're alternatives)
  if (params.query !== undefined && params.vector !== undefined) {
    throw new Error('cannot specify both query and vector - they are mutually exclusive')
  }
  
  // Universal truth: can't use both cursor and offset pagination
  if (params.cursor !== undefined && params.offset !== undefined) {
    throw new Error('cannot use both cursor and offset pagination simultaneously')
  }
  
  // Auto-limit query length based on memory
  if (params.query && params.query.length > config.maxQueryLength) {
    throw new Error(`query exceeds auto-configured maximum length of ${config.maxQueryLength} characters`)
  }
  
  // Validate vector dimensions if provided
  if (params.vector && params.vector.length !== config.maxVectorDimensions) {
    throw new Error(`vector must have exactly ${config.maxVectorDimensions} dimensions`)
  }
  
  // Validate enum types if specified
  if (params.type) {
    const types = Array.isArray(params.type) ? params.type : [params.type]
    for (const type of types) {
      if (!Object.values(NounType).includes(type)) {
        throw new Error(`invalid NounType: ${type}`)
      }
    }
  }
}

/**
 * Validate add parameters
 */
export function validateAddParams(params: AddParams): void {
  // Universal truth: must have data or vector
  if (!params.data && !params.vector) {
    throw new Error('must provide either data or vector')
  }
  
  // Validate noun type
  if (!Object.values(NounType).includes(params.type)) {
    throw new Error(`invalid NounType: ${params.type}`)
  }
  
  // Validate vector dimensions if provided
  if (params.vector) {
    const config = ValidationConfig.getInstance()
    if (params.vector.length !== config.maxVectorDimensions) {
      throw new Error(`vector must have exactly ${config.maxVectorDimensions} dimensions`)
    }
  }
}

/**
 * Validate update parameters
 */
export function validateUpdateParams(params: UpdateParams): void {
  // Universal truth: must have an ID
  if (!params.id) {
    throw new Error('id is required for update')
  }
  
  // Universal truth: must update something
  if (!params.data && !params.metadata && !params.type && !params.vector) {
    throw new Error('must specify at least one field to update')
  }
  
  // Validate type if changing
  if (params.type && !Object.values(NounType).includes(params.type)) {
    throw new Error(`invalid NounType: ${params.type}`)
  }
  
  // Validate vector dimensions if provided
  if (params.vector) {
    const config = ValidationConfig.getInstance()
    if (params.vector.length !== config.maxVectorDimensions) {
      throw new Error(`vector must have exactly ${config.maxVectorDimensions} dimensions`)
    }
  }
}

/**
 * Validate relate parameters
 */
export function validateRelateParams(params: RelateParams): void {
  // Universal truths
  if (!params.from) {
    throw new Error('from entity ID is required')
  }
  
  if (!params.to) {
    throw new Error('to entity ID is required')
  }
  
  if (params.from === params.to) {
    throw new Error('cannot create self-referential relationship')
  }
  
  // Validate verb type
  if (!Object.values(VerbType).includes(params.type)) {
    throw new Error(`invalid VerbType: ${params.type}`)
  }
  
  // Universal truth: weight must be 0-1
  if (params.weight !== undefined) {
    if (params.weight < 0 || params.weight > 1) {
      throw new Error('weight must be between 0 and 1')
    }
  }
}

/**
 * Get current validation configuration
 * Useful for debugging and monitoring
 */
export function getValidationConfig() {
  const config = ValidationConfig.getInstance()
  return {
    maxLimit: config.maxLimit,
    maxQueryLength: config.maxQueryLength,
    maxVectorDimensions: config.maxVectorDimensions,
    systemMemory: os.totalmem(),
    availableMemory: os.freemem()
  }
}

/**
 * Record query performance for auto-tuning
 */
export function recordQueryPerformance(duration: number, resultCount: number) {
  ValidationConfig.getInstance().recordQuery(duration, resultCount)
}