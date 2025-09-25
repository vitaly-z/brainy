/**
 * Knowledge Layer for VFS
 *
 * This is the REAL integration that makes VFS intelligent.
 * It wraps VFS operations and adds Knowledge Layer processing.
 */

import { VirtualFileSystem } from './VirtualFileSystem.js'
import { Brainy } from '../brainy.js'
import { EventRecorder } from './EventRecorder.js'
import { SemanticVersioning } from './SemanticVersioning.js'
import { PersistentEntitySystem } from './PersistentEntitySystem.js'
import { ConceptSystem } from './ConceptSystem.js'
import { GitBridge } from './GitBridge.js'

export class KnowledgeLayer {
  private eventRecorder: EventRecorder
  private semanticVersioning: SemanticVersioning
  private entitySystem: PersistentEntitySystem
  private conceptSystem: ConceptSystem
  private gitBridge: GitBridge
  private enabled = false

  constructor(
    private vfs: VirtualFileSystem,
    private brain: Brainy
  ) {
    // Initialize all Knowledge Layer components
    this.eventRecorder = new EventRecorder(brain)
    this.semanticVersioning = new SemanticVersioning(brain)
    this.entitySystem = new PersistentEntitySystem(brain)
    this.conceptSystem = new ConceptSystem(brain)
    this.gitBridge = new GitBridge(vfs, brain)
  }

  /**
   * Enable Knowledge Layer by wrapping VFS methods
   */
  async enable(): Promise<void> {
    if (this.enabled) return
    this.enabled = true

    // Save original methods
    const originalWriteFile = this.vfs.writeFile.bind(this.vfs)
    const originalUnlink = this.vfs.unlink.bind(this.vfs)
    const originalRename = this.vfs.rename.bind(this.vfs)
    const originalMkdir = this.vfs.mkdir.bind(this.vfs)
    const originalRmdir = this.vfs.rmdir.bind(this.vfs)

    // Wrap writeFile to add intelligence
    this.vfs.writeFile = async (path: string, data: Buffer | string, options?: any) => {
      // Call original VFS method first
      const result = await originalWriteFile(path, data, options)

      // Process in background (non-blocking)
      setImmediate(async () => {
        try {
          const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data)

          // 1. Record the event
          await this.eventRecorder.recordEvent({
            type: 'write',
            path,
            content: buffer,
            size: buffer.length,
            author: options?.author || 'system'
          })

          // 2. Check for semantic versioning
          try {
            const existingContent = await this.vfs.readFile(path).catch(() => null)
            if (existingContent) {
              const shouldVersion = await this.semanticVersioning.shouldVersion(existingContent, buffer)
              if (shouldVersion) {
                await this.semanticVersioning.createVersion(path, buffer, {
                  message: options?.message || 'Automatic semantic version'
                })
              }
            }
          } catch (err) {
            console.debug('Versioning check failed:', err)
          }

          // 3. Extract entities
          if (options?.extractEntities !== false) {
            await this.entitySystem.extractEntities(path, buffer)
          }

          // 4. Extract concepts
          if (options?.extractConcepts !== false) {
            await this.conceptSystem.extractAndLinkConcepts(path, buffer)
          }
        } catch (error) {
          console.debug('Knowledge Layer processing error:', error)
        }
      })

      return result
    }

    // Wrap unlink to record deletion
    this.vfs.unlink = async (path: string) => {
      const result = await originalUnlink(path)

      setImmediate(async () => {
        await this.eventRecorder.recordEvent({
          type: 'delete',
          path,
          author: 'system'
        })
      })

      return result
    }

    // Wrap rename to track moves
    this.vfs.rename = async (oldPath: string, newPath: string) => {
      const result = await originalRename(oldPath, newPath)

      setImmediate(async () => {
        await this.eventRecorder.recordEvent({
          type: 'rename',
          path: oldPath,
          metadata: { newPath },
          author: 'system'
        })
      })

      return result
    }

    // Wrap mkdir to track directory creation
    this.vfs.mkdir = async (path: string, options?: any) => {
      const result = await originalMkdir(path, options)

      setImmediate(async () => {
        await this.eventRecorder.recordEvent({
          type: 'mkdir',
          path,
          author: 'system'
        })
      })

      return result
    }

    // Wrap rmdir to track directory deletion
    this.vfs.rmdir = async (path: string, options?: any) => {
      const result = await originalRmdir(path, options)

      setImmediate(async () => {
        await this.eventRecorder.recordEvent({
          type: 'rmdir',
          path,
          author: 'system'
        })
      })

      return result
    }

    // Add Knowledge Layer methods to VFS
    this.addKnowledgeMethods()

    console.log('✨ Knowledge Layer enabled on VFS')
  }

  /**
   * Add Knowledge Layer query methods to VFS
   */
  private addKnowledgeMethods(): void {
    // Event history
    (this.vfs as any).getHistory = async (path: string, options?: any) => {
      return await this.eventRecorder.getHistory(path, options)
    }

    (this.vfs as any).reconstructAtTime = async (path: string, timestamp: number) => {
      return await this.eventRecorder.reconstructFileAtTime(path, timestamp)
    }

    // Semantic versioning
    (this.vfs as any).getVersions = async (path: string) => {
      return await this.semanticVersioning.getVersions(path)
    }

    (this.vfs as any).getVersion = async (path: string, versionId: string) => {
      return await this.semanticVersioning.getVersion(path, versionId)
    }

    (this.vfs as any).restoreVersion = async (path: string, versionId: string) => {
      const content = await this.semanticVersioning.getVersion(path, versionId)
      if (content) {
        await this.vfs.writeFile(path, content)
      }
    }

    // Entity system
    (this.vfs as any).createEntity = async (config: any) => {
      return await this.entitySystem.createEntity(config)
    }

    (this.vfs as any).findEntity = async (query: any) => {
      return await this.entitySystem.findEntity(query)
    }

    (this.vfs as any).getEntityEvolution = async (entityId: string) => {
      return await this.entitySystem.getEvolution(entityId)
    }

    // Concept system
    (this.vfs as any).createConcept = async (config: any) => {
      return await this.conceptSystem.createConcept(config)
    }

    (this.vfs as any).findConcepts = async (query: any) => {
      return await this.conceptSystem.findConcepts(query)
    }

    (this.vfs as any).getConceptGraph = async (options?: any) => {
      return await this.conceptSystem.getConceptGraph(options)
    }

    // Git bridge
    (this.vfs as any).exportToGit = async (vfsPath: string, gitPath: string) => {
      return await this.gitBridge.exportToGit(vfsPath, gitPath)
    }

    (this.vfs as any).importFromGit = async (gitPath: string, vfsPath: string) => {
      return await this.gitBridge.importFromGit(gitPath, vfsPath)
    }

    // Temporal coupling
    (this.vfs as any).findTemporalCoupling = async (path: string, windowMs?: number) => {
      return await this.eventRecorder.findTemporalCoupling(path, windowMs)
    }

    // Entity convenience methods that wrap Brainy's core API
    (this.vfs as any).linkEntities = async (fromEntity: string | any, toEntity: string | any, relationship: string) => {
      // Handle both entity IDs and entity objects
      const fromId = typeof fromEntity === 'string' ? fromEntity : fromEntity.id
      const toId = typeof toEntity === 'string' ? toEntity : toEntity.id

      // Use brain.relate to create the relationship
      return await this.brain.relate({
        from: fromId,
        to: toId,
        type: relationship as any  // VerbType or string
      })
    }

    // Find where an entity appears across files
    (this.vfs as any).findEntityOccurrences = async (entityId: string) => {
      const occurrences: Array<{ path: string, context?: string }> = []

      // Search for files that contain references to this entity
      // First, get all relationships where this entity is involved
      const relations = await this.brain.getRelations({ from: entityId })
      const toRelations = await this.brain.getRelations({ to: entityId })

      // Find file entities that relate to this entity
      for (const rel of [...relations, ...toRelations]) {
        try {
          // Check if the related entity is a file
          const relatedId = rel.from === entityId ? rel.to : rel.from
          const entity = await this.brain.get(relatedId)

          if (entity?.metadata?.vfsType === 'file' && entity?.metadata?.path) {
            occurrences.push({
              path: entity.metadata.path as string,
              context: entity.data ? entity.data.toString().substring(0, 200) : undefined
            })
          }
        } catch (error) {
          // Entity might not exist, continue
        }
      }

      // Also search for files that mention the entity name in their content
      const entityData = await this.brain.get(entityId)
      if (entityData?.metadata?.name) {
        const searchResults = await this.brain.find({
          query: entityData.metadata.name as string,
          where: { vfsType: 'file' },
          limit: 20
        })

        for (const result of searchResults) {
          if (result.entity?.metadata?.path && !occurrences.some(o => o.path === result.entity.metadata.path)) {
            occurrences.push({
              path: result.entity.metadata.path as string,
              context: result.entity.data ? result.entity.data.toString().substring(0, 200) : undefined
            })
          }
        }
      }

      return occurrences
    }

    // Update an entity (convenience wrapper)
    (this.vfs as any).updateEntity = async (entityId: string, updates: any) => {
      // Get current entity from brain
      const currentEntity = await this.brain.get(entityId)
      if (!currentEntity) {
        throw new Error(`Entity ${entityId} not found`)
      }

      // Merge updates
      const updatedMetadata = {
        ...currentEntity.metadata,
        ...updates,
        lastUpdated: Date.now(),
        version: ((currentEntity.metadata?.version as number) || 0) + 1
      }

      // Update via brain
      await this.brain.update({
        id: entityId,
        data: JSON.stringify(updatedMetadata),
        metadata: updatedMetadata
      })

      return entityId
    }

    // Get entity graph (convenience wrapper)
    (this.vfs as any).getEntityGraph = async (entityId: string, options?: { depth?: number }) => {
      const depth = options?.depth || 2
      const graph = { nodes: new Map(), edges: [] as any[] }
      const visited = new Set<string>()

      const traverse = async (id: string, currentDepth: number) => {
        if (visited.has(id) || currentDepth > depth) return
        visited.add(id)

        // Add node
        const entity = await this.brain.get(id)
        if (entity) {
          graph.nodes.set(id, entity)
        }

        // Get relationships
        const relations = await this.brain.getRelations({ from: id })
        const toRelations = await this.brain.getRelations({ to: id })

        for (const rel of [...relations, ...toRelations]) {
          graph.edges.push(rel)

          // Traverse connected nodes
          if (currentDepth < depth) {
            const nextId = rel.from === id ? rel.to : rel.from
            await traverse(nextId, currentDepth + 1)
          }
        }
      }

      await traverse(entityId, 0)

      return {
        nodes: Array.from(graph.nodes.values()),
        edges: graph.edges
      }
    }

    // List all entities of a specific type
    (this.vfs as any).listEntities = async (query?: { type?: string }) => {
      return await this.entitySystem.findEntity(query || {})
    }
  }

  /**
   * Disable Knowledge Layer
   */
  async disable(): Promise<void> {
    // Would restore original methods here
    this.enabled = false
  }
}

/**
 * Enable Knowledge Layer on a VFS instance
 */
export async function enableKnowledgeLayer(vfs: VirtualFileSystem, brain: Brainy): Promise<KnowledgeLayer> {
  const knowledgeLayer = new KnowledgeLayer(vfs, brain)
  await knowledgeLayer.enable()
  return knowledgeLayer
}