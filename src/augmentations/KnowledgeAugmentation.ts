/**
 * Knowledge Layer Augmentation for VFS
 *
 * Adds intelligent features to VFS without modifying core functionality:
 * - Event recording for all operations
 * - Semantic versioning based on content changes
 * - Entity and concept extraction
 * - Git bridge for import/export
 *
 * This is a TRUE augmentation - VFS works perfectly without it
 */

import { Brainy } from '../brainy.js'
import { BaseAugmentation } from './brainyAugmentation.js'
import { EventRecorder } from '../vfs/EventRecorder.js'
import { SemanticVersioning } from '../vfs/SemanticVersioning.js'
import { PersistentEntitySystem } from '../vfs/PersistentEntitySystem.js'
import { ConceptSystem } from '../vfs/ConceptSystem.js'
import { GitBridge } from '../vfs/GitBridge.js'

export class KnowledgeAugmentation extends BaseAugmentation {
  name = 'knowledge'
  timing: 'after' = 'after'  // Process after VFS operations
  metadata: 'none' = 'none'  // No metadata access needed
  operations = [] as any  // VFS-specific augmentation, no operation interception
  priority = 100  // Run last

  constructor(config: any = {}) {
    super(config)
  }

  async execute<T = any>(operation: string, params: any, next: () => Promise<T>): Promise<T> {
    // Pass through - this augmentation works at VFS level, not operation level
    return await next()
  }

  private eventRecorder?: EventRecorder
  private semanticVersioning?: SemanticVersioning
  private entitySystem?: PersistentEntitySystem
  private conceptSystem?: ConceptSystem
  private gitBridge?: GitBridge
  private originalMethods: Map<string, Function> = new Map()

  async initialize(context: any): Promise<void> {
    await this.augment(context.brain)
  }

  async augment(brain: Brainy): Promise<void> {
    // Only augment if VFS exists
    const vfs = brain.vfs?.()
    if (!vfs) {
      console.warn('KnowledgeAugmentation: VFS not found, skipping')
      return
    }

    // Initialize Knowledge Layer components
    this.eventRecorder = new EventRecorder(brain)
    this.semanticVersioning = new SemanticVersioning(brain)
    this.entitySystem = new PersistentEntitySystem(brain)
    this.conceptSystem = new ConceptSystem(brain)
    this.gitBridge = new GitBridge(vfs, brain)

    // Wrap VFS methods to add intelligence WITHOUT slowing them down
    this.wrapMethod(vfs, 'writeFile', async (original: Function, path: string, data: Buffer, options?: any) => {
      // Call original first (stays fast)
      const result = await original.call(vfs, path, data, options)

      // Knowledge processing in background (non-blocking)
      setImmediate(async () => {
        try {
          // Record event
          if (this.eventRecorder) {
            await this.eventRecorder.recordEvent({
              type: 'write',
              path,
              content: data,
              size: data.length,
              author: options?.author || 'system'
            })
          }

          // Check for semantic versioning
          if (this.semanticVersioning) {
            const existingContent = await vfs.readFile(path).catch(() => null)
            const shouldVersion = existingContent && this.isSemanticChange(existingContent, data)
            if (shouldVersion) {
              await this.semanticVersioning.createVersion(path, data, {
                message: 'Automatic semantic version'
              })
            }
          }

          // Extract concepts
          if (this.conceptSystem && options?.extractConcepts !== false) {
            await this.conceptSystem.extractAndLinkConcepts(path, data)
          }

          // Extract entities
          if (this.entitySystem && options?.extractEntities !== false) {
            await this.entitySystem.extractEntities(data.toString('utf8'), data)
          }
        } catch (error) {
          // Knowledge Layer errors should not affect VFS operations
          console.debug('KnowledgeLayer background processing error:', error)
        }
      })

      return result
    })

    this.wrapMethod(vfs, 'unlink', async (original: Function, path: string) => {
      const result = await original.call(vfs, path)

      // Record deletion event
      setImmediate(async () => {
        if (this.eventRecorder) {
          await this.eventRecorder.recordEvent({
            type: 'delete',
            path,
            author: 'system'
          })
        }
      })

      return result
    })

    this.wrapMethod(vfs, 'rename', async (original: Function, oldPath: string, newPath: string) => {
      const result = await original.call(vfs, oldPath, newPath)

      // Record rename event
      setImmediate(async () => {
        if (this.eventRecorder) {
          await this.eventRecorder.recordEvent({
            type: 'rename',
            path: oldPath,
            metadata: { newPath },
            author: 'system'
          })
        }
      })

      return result
    })

    // Add Knowledge Layer methods to VFS
    this.addKnowledgeMethods(vfs)

    console.log('✨ Knowledge Layer augmentation enabled')
  }

  /**
   * Wrap a VFS method to add Knowledge Layer functionality
   */
  private wrapMethod(vfs: any, methodName: string, wrapper: Function): void {
    const original = vfs[methodName]
    if (!original) return

    // Store original for cleanup
    this.originalMethods.set(methodName, original)

    // Replace with wrapped version
    vfs[methodName] = async (...args: any[]) => {
      return await wrapper(original, ...args)
    }
  }

  /**
   * Add Knowledge Layer methods to VFS
   */
  private addKnowledgeMethods(vfs: any): void {
    // Event history
    (vfs as any).getHistory = async (path: string, options?: any) => {
      if (!this.eventRecorder) throw new Error('Knowledge Layer not initialized')
      return await this.eventRecorder.getHistory(path, options)
    }

    (vfs as any).reconstructAtTime = async (path: string, timestamp: number) => {
      if (!this.eventRecorder) throw new Error('Knowledge Layer not initialized')
      return await this.eventRecorder.reconstructFileAtTime(path, timestamp)
    }

    // Semantic versioning
    (vfs as any).getVersions = async (path: string) => {
      if (!this.semanticVersioning) throw new Error('Knowledge Layer not initialized')
      return await this.semanticVersioning.getVersions(path)
    }

    (vfs as any).restoreVersion = async (path: string, versionId: string) => {
      if (!this.semanticVersioning) throw new Error('Knowledge Layer not initialized')
      const version = await this.semanticVersioning.getVersion(path, versionId)
      if (version) {
        await vfs.writeFile(path, version)
      }
    }

    // Entities
    (vfs as any).findEntity = async (query: any) => {
      if (!this.entitySystem) throw new Error('Knowledge Layer not initialized')
      return await this.entitySystem.findEntity(query)
    }

    (vfs as any).getEntityAppearances = async (entityId: string) => {
      if (!this.entitySystem) throw new Error('Knowledge Layer not initialized')
      return await this.entitySystem.getEvolution(entityId)
    }

    // Concepts
    (vfs as any).getConcepts = async (path: string) => {
      if (!this.conceptSystem) throw new Error('Knowledge Layer not initialized')
      const concepts = await this.conceptSystem.findConcepts({ manifestedIn: path })
      return concepts
    }

    (vfs as any).getConceptGraph = async (options?: any) => {
      if (!this.conceptSystem) throw new Error('Knowledge Layer not initialized')
      return await this.conceptSystem.getConceptGraph(options)
    }

    // Git bridge
    (vfs as any).exportToGit = async (vfsPath: string, gitPath: string) => {
      if (!this.gitBridge) throw new Error('Knowledge Layer not initialized')
      return await this.gitBridge.exportToGit(vfsPath, gitPath)
    }

    (vfs as any).importFromGit = async (gitPath: string, vfsPath: string) => {
      if (!this.gitBridge) throw new Error('Knowledge Layer not initialized')
      return await this.gitBridge.importFromGit(gitPath, vfsPath)
    }

    // Temporal coupling
    (vfs as any).findTemporalCoupling = async (path: string, windowMs?: number) => {
      if (!this.eventRecorder) throw new Error('Knowledge Layer not initialized')
      return await this.eventRecorder.findTemporalCoupling(path, windowMs)
    }
  }

  private isSemanticChange(oldContent: Buffer, newContent: Buffer): boolean {
    // Simple heuristic - significant size change or different content
    const oldStr = oldContent.toString('utf8')
    const newStr = newContent.toString('utf8')

    // Check for significant size change (>10%)
    const sizeDiff = Math.abs(oldStr.length - newStr.length) / oldStr.length
    if (sizeDiff > 0.1) return true

    // Check for structural changes (simplified)
    const oldLines = oldStr.split('\n').filter(l => l.trim())
    const newLines = newStr.split('\n').filter(l => l.trim())

    // Different number of non-empty lines
    return Math.abs(oldLines.length - newLines.length) > 5
  }

  async cleanup(brain: Brainy): Promise<void> {
    const vfs = brain.vfs?.()
    if (!vfs) return

    // Restore original methods
    for (const [methodName, original] of this.originalMethods) {
      (vfs as any)[methodName] = original
    }

    // Remove added methods
    delete (vfs as any).getHistory
    delete (vfs as any).reconstructAtTime
    delete (vfs as any).getVersions
    delete (vfs as any).restoreVersion
    delete (vfs as any).findEntity
    delete (vfs as any).getEntityAppearances
    delete (vfs as any).getConcepts
    delete (vfs as any).getConceptGraph
    delete (vfs as any).exportToGit
    delete (vfs as any).importFromGit
    delete (vfs as any).findTemporalCoupling

    // Clean up components
    this.eventRecorder = undefined
    this.semanticVersioning = undefined
    this.entitySystem = undefined
    this.conceptSystem = undefined
    this.gitBridge = undefined

    console.log('Knowledge Layer augmentation removed')
  }
}