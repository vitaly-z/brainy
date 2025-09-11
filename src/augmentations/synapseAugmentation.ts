/**
 * Base Synapse Augmentation
 * 
 * Synapses are special augmentations that provide bidirectional data sync
 * with external platforms (Notion, Salesforce, Slack, etc.)
 * 
 * Like biological synapses that transmit signals between neurons, these
 * connect Brainy to external data sources, enabling seamless information flow.
 * 
 * They are managed through the Brain Cloud augmentation registry alongside
 * other augmentations, enabling unified discovery, installation, and updates.
 * 
 * Example synapses:
 * - NotionSynapse: Sync pages, databases, and blocks
 * - SalesforceSynapse: Sync contacts, leads, opportunities
 * - SlackSynapse: Sync messages, channels, users
 * - GoogleDriveSynapse: Sync documents, sheets, presentations
 */

import { 
  AugmentationResponse 
} from '../types/augmentations.js'
import { BaseAugmentation, BrainyAugmentation, AugmentationContext } from './brainyAugmentation.js'
import { NeuralImportAugmentation } from './neuralImport.js'

/**
 * Base class for all synapse augmentations
 * Provides common functionality for external data synchronization
 */
export abstract class SynapseAugmentation extends BaseAugmentation {
  // BrainyAugmentation properties
  readonly timing = 'after' as const
  readonly operations = ['all'] as ('all')[]
  readonly priority = 10
  readonly metadata = {
    reads: '*' as '*',  // Needs to read for syncing
    writes: ['_synapse', '_syncedAt'] as string[]
  }  // Adds synapse tracking metadata
  
  // Synapse-specific properties
  abstract readonly synapseId: string
  abstract readonly supportedTypes: string[]
  
  // State management
  protected syncInProgress = false
  protected lastSyncId?: string
  protected syncStats = {
    totalSyncs: 0,
    totalItems: 0,
    lastSync: undefined as string | undefined
  }
  
  // Neural Import integration
  protected neuralImport?: NeuralImportAugmentation
  protected useNeuralImport = true // Enable by default
  
  protected async onInit(): Promise<void> {
    
    // Initialize Neural Import if available
    if (this.useNeuralImport && this.context?.brain) {
      try {
        // Check if neural import is already loaded
        const existingNeuralImport = this.context.brain.augmentations?.get('neural-import')
        if (existingNeuralImport) {
          this.neuralImport = existingNeuralImport as NeuralImportAugmentation
        } else {
          // Create a new instance for this synapse
          this.neuralImport = new NeuralImportAugmentation()
          // NeuralImport will be initialized when the synapse is added to Brainy
          // await this.neuralImport.initialize()
        }
      } catch (error) {
        console.warn(`[${this.synapseId}] Neural Import not available, using basic import`)
        this.useNeuralImport = false
      }
    }
    
    await this.onInitialize()
  }
  
  /**
   * Synapse-specific initialization
   * Override this in implementations
   */
  protected abstract onInitialize(): Promise<void>
  
  /**
   * BrainyAugmentation execute method
   * Intercepts operations to sync external data when relevant
   */
  async execute<T = any>(
    operation: string,
    params: any,
    next: () => Promise<T>
  ): Promise<T> {
    // Execute the main operation first
    const result = await next()
    
    // After certain operations, check if we should sync
    if (this.shouldSync(operation, params)) {
      // Start async sync in background
      this.backgroundSync().catch(error => {
        console.error(`[${this.synapseId}] Background sync failed:`, error)
      })
    }
    
    return result
  }
  
  /**
   * Determine if sync should be triggered after an operation
   */
  protected shouldSync(operation: string, params: any): boolean {
    // Override in implementations for specific sync triggers
    return false
  }
  
  /**
   * Background sync process
   */
  protected async backgroundSync(): Promise<void> {
    if (this.syncInProgress) return
    
    this.syncInProgress = true
    try {
      await this.incrementalSync(this.lastSyncId)
    } finally {
      this.syncInProgress = false
    }
  }
  
  protected async onShutdown(): Promise<void> {
    if (this.syncInProgress) {
      await this.stopSync()
    }
    await this.onSynapseShutdown()
  }
  
  protected async onSynapseShutdown(): Promise<void> {
    // Override in implementations for cleanup
  }
  
  // getSynapseStatus implemented below with full response
  
  /**
   * ISynapseAugmentation methods
   */
  abstract testConnection(): Promise<AugmentationResponse<boolean>>
  
  abstract startSync(options?: Record<string, unknown>): Promise<AugmentationResponse<{
    synced: number
    failed: number
    skipped: number
    duration: number
    errors?: Array<{ item: string; error: string }>
  }>>
  
  async stopSync(): Promise<void> {
    this.syncInProgress = false
  }
  
  abstract incrementalSync(lastSyncId?: string): Promise<AugmentationResponse<{
    synced: number
    failed: number
    skipped: number
    duration: number
    hasMore: boolean
    nextSyncId?: string
  }>>
  
  abstract previewSync(limit?: number): Promise<AugmentationResponse<{
    items: Array<{
      type: string
      title: string
      preview: string
    }>
    totalCount: number
    estimatedDuration: number
  }>>
  
  async getSynapseStatus(): Promise<AugmentationResponse<{
    status: 'connected' | 'disconnected' | 'syncing' | 'error'
    lastSync?: string
    nextSync?: string
    totalSyncs: number
    totalItems: number
  }>> {
    const connectionTest = await this.testConnection()
    
    return {
      success: true,
      data: {
        status: this.syncInProgress ? 'syncing' : 
                connectionTest.success ? 'connected' : 'disconnected',
        lastSync: this.syncStats.lastSync,
        totalSyncs: this.syncStats.totalSyncs,
        totalItems: this.syncStats.totalItems
      }
    }
  }
  
  /**
   * Helper method to store synced data in Brainy
   * Optionally uses Neural Import for intelligent processing
   */
  protected async storeInBrainy(
    content: string | Record<string, any>,
    metadata: Record<string, any>,
    options: {
      useNeuralImport?: boolean
      dataType?: string
      rawData?: Buffer | string
    } = {}
  ): Promise<void> {
    if (!this.context?.brain) {
      throw new Error('Brainy context not initialized')
    }
    
    // Add synapse source metadata
    const enrichedMetadata = {
      ...metadata,
      _synapse: this.synapseId,
      _syncedAt: new Date().toISOString()
    }
    
    // Use Neural Import for intelligent processing if available
    if (this.neuralImport && (options.useNeuralImport ?? this.useNeuralImport)) {
      try {
        // Process through Neural Import for entity/relationship detection
        const rawData = options.rawData || 
                       (typeof content === 'string' ? content : JSON.stringify(content))
        
        const neuralResult = await this.neuralImport.processRawData(
          rawData,
          options.dataType || 'json',
          {
            sourceSystem: this.synapseId,
            metadata: enrichedMetadata
          }
        )
        
        if (neuralResult.success && neuralResult.data) {
          // Store detected nouns (entities)
          for (const noun of neuralResult.data.nouns) {
            await this.context.brain.add({
              text: noun,
              metadata: {
                ...enrichedMetadata,
                _neuralConfidence: neuralResult.data.confidence,
                _neuralInsights: neuralResult.data.insights
              }
            })
          }
          
          // Store detected verbs (relationships)
          for (const verb of neuralResult.data.verbs) {
            // Parse verb format: "source->relation->target"
            const parts = verb.split('->')
            if (parts.length === 3) {
              await this.context.brain.relate(
                parts[0], // source
                parts[2], // target
                parts[1], // verb type
                enrichedMetadata
              )
            }
          }
          
          // Store original content with neural metadata
          if (typeof content === 'string') {
            await this.context.brain.add({
              text: content,
              metadata: {
                ...enrichedMetadata,
                category: 'Content',
                _neuralProcessed: true,
                _neuralConfidence: neuralResult.data.confidence,
                _detectedEntities: neuralResult.data.nouns.length,
                _detectedRelationships: neuralResult.data.verbs.length
              }
            })
          }
          
          return // Successfully processed with Neural Import
        }
      } catch (error) {
        console.warn(`[${this.synapseId}] Neural Import processing failed, falling back to basic import:`, error)
      }
    }
    
    // Fallback to basic storage
    if (typeof content === 'string') {
      await this.context.brain.add({
        text: content,
        metadata: {
          ...enrichedMetadata,
          category: 'Content'
        }
      })
    } else {
      // For structured data, store as JSON
      await this.context.brain.add({
        text: JSON.stringify(content),
        metadata: {
          ...enrichedMetadata,
          category: 'Content'
        }
      })
    }
  }
  
  /**
   * Helper method to query existing synced data
   */
  protected async queryBrainy(
    filter: { connector?: string; [key: string]: any }
  ): Promise<any[]> {
    if (!this.context?.brain) {
      throw new Error('Brainy context not initialized')
    }
    
    const searchFilter = {
      ...filter,
      _synapse: this.synapseId
    }
    
    return this.context.brain.find({
      where: searchFilter
    })
  }
}

/**
 * Example implementation for reference
 * Real synapses would be in Brain Cloud registry
 */
export class ExampleFileSystemSynapse extends SynapseAugmentation {
  readonly name = 'example-filesystem-synapse'
  readonly description = 'Example synapse for local file system with Neural Import intelligence'
  readonly synapseId = 'filesystem'
  readonly supportedTypes = ['text', 'markdown', 'json', 'csv']
  
  protected async onInitialize(): Promise<void> {
    // Initialize file system watcher, etc.
  }
  
  async testConnection(): Promise<AugmentationResponse<boolean>> {
    // Test if we can access the configured directory
    return {
      success: true,
      data: true
    }
  }
  
  async startSync(options?: Record<string, unknown>): Promise<AugmentationResponse<{
    synced: number
    failed: number
    skipped: number
    duration: number
    errors?: Array<{ item: string; error: string }>
  }>> {
    const startTime = Date.now()
    
    // Example: Read files from a directory and sync to Brainy
    // This would normally scan a directory, but here's a conceptual example:
    
    const exampleFiles = [
      { 
        path: '/data/notes.md',
        content: '# Project Notes\nDiscuss roadmap with team\nReview Q1 metrics',
        type: 'markdown'
      },
      {
        path: '/data/contacts.json',
        content: { name: 'John Doe', role: 'Developer', team: 'Engineering' },
        type: 'json'
      }
    ]
    
    let synced = 0
    const errors: Array<{ item: string; error: string }> = []
    
    for (const file of exampleFiles) {
      try {
        // Use Neural Import for intelligent processing
        await this.storeInBrainy(
          file.content,
          {
            path: file.path,
            fileType: file.type,
            syncedFrom: 'filesystem'
          },
          {
            useNeuralImport: true,  // Enable AI processing
            dataType: file.type
          }
        )
        synced++
      } catch (error) {
        errors.push({
          item: file.path,
          error: error instanceof Error ? error.message : 'Unknown error'
        })
      }
    }
    
    this.syncStats.totalSyncs++
    this.syncStats.totalItems += synced
    this.syncStats.lastSync = new Date().toISOString()
    
    return {
      success: true,
      data: {
        synced,
        failed: errors.length,
        skipped: 0,
        duration: Date.now() - startTime,
        errors: errors.length > 0 ? errors : undefined
      }
    }
  }
  
  async incrementalSync(lastSyncId?: string): Promise<AugmentationResponse<{
    synced: number
    failed: number
    skipped: number
    duration: number
    hasMore: boolean
    nextSyncId?: string
  }>> {
    const startTime = Date.now()
    
    // Example: Check for modified files since last sync
    
    return {
      success: true,
      data: {
        synced: 0,
        failed: 0,
        skipped: 0,
        duration: Date.now() - startTime,
        hasMore: false
      }
    }
  }
  
  async previewSync(limit: number = 10): Promise<AugmentationResponse<{
    items: Array<{
      type: string
      title: string
      preview: string
    }>
    totalCount: number
    estimatedDuration: number
  }>> {
    // Example: List files that would be synced
    
    return {
      success: true,
      data: {
        items: [],
        totalCount: 0,
        estimatedDuration: 0
      }
    }
  }
}