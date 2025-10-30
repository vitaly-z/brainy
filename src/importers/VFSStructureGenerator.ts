/**
 * VFS Structure Generator
 *
 * Organizes imported entities into structured VFS directories
 * - Type-based grouping (Place/, Character/, Concept/)
 * - Metadata files (_metadata.json, _relationships.json)
 * - Source file preservation
 *
 * NO MOCKS - Production-ready implementation
 */

import { Brainy } from '../brainy.js'
import { VirtualFileSystem } from '../vfs/VirtualFileSystem.js'
import { NounType, VerbType } from '../types/graphTypes.js'
import type { SmartExcelResult } from './SmartExcelImporter.js'
import type { TrackingContext } from '../import/ImportCoordinator.js'

export interface VFSStructureOptions {
  /** Root path in VFS for import */
  rootPath: string

  /** Grouping strategy */
  groupBy: 'type' | 'sheet' | 'flat' | 'custom'

  /** Custom grouping function */
  customGrouping?: (entity: any) => string

  /** Preserve source file */
  preserveSource?: boolean

  /** Source file buffer (if preserving) */
  sourceBuffer?: Buffer

  /** Source filename */
  sourceFilename?: string

  /** Create relationship file */
  createRelationshipFile?: boolean

  /** Create metadata file */
  createMetadataFile?: boolean

  /** Import tracking context (v4.10.0) */
  trackingContext?: TrackingContext
}

export interface VFSStructureResult {
  /** Root path created */
  rootPath: string

  /** Directories created */
  directories: string[]

  /** Files created */
  files: Array<{
    path: string
    entityId?: string
    type: 'entity' | 'metadata' | 'source' | 'relationships'
  }>

  /** Total operations */
  operations: number

  /** Time taken in ms */
  duration: number
}

/**
 * VFSStructureGenerator - Organizes imported data into VFS
 */
export class VFSStructureGenerator {
  private brain: Brainy
  private vfs!: VirtualFileSystem  // Non-null assertion - will be set in init()

  constructor(brain: Brainy) {
    this.brain = brain
    // CRITICAL FIX: Use brain.vfs() instead of creating separate instance
    // This ensures VFSStructureGenerator and user code share the same VFS instance
    // Before: Created separate instance that wasn't accessible to users
    // After: Uses brain's cached instance, making VFS queryable after import
  }

  /**
   * Initialize the generator
   *
   * CRITICAL: Gets brain's VFS instance and initializes it if needed.
   * This ensures that after import, brain.vfs() returns an initialized instance.
   */
  async init(): Promise<void> {
    // Get brain's cached VFS instance (creates if doesn't exist)
    this.vfs = this.brain.vfs()

    // CRITICAL FIX (v4.10.2): Always call vfs.init() explicitly
    // The previous code tried to check if initialized via stat('/') but this was unreliable
    // vfs.init() is idempotent, so calling it multiple times is safe
    await this.vfs.init()
  }

  /**
   * Generate VFS structure from import result
   */
  async generate(
    importResult: SmartExcelResult,
    options: VFSStructureOptions
  ): Promise<VFSStructureResult> {
    const startTime = Date.now()
    const result: VFSStructureResult = {
      rootPath: options.rootPath,
      directories: [],
      files: [],
      operations: 0,
      duration: 0
    }

    // Ensure VFS is initialized
    await this.init()

    // Extract tracking metadata if provided
    const trackingMetadata = options.trackingContext ? {
      importIds: [options.trackingContext.importId],
      projectId: options.trackingContext.projectId,
      importedAt: options.trackingContext.importedAt,
      importFormat: options.trackingContext.importFormat,
      importSource: options.trackingContext.importSource,
      ...options.trackingContext.customMetadata
    } : {}

    // Create root directory
    try {
      await this.vfs.mkdir(options.rootPath, {
        recursive: true,
        metadata: trackingMetadata  // v4.10.0: Add tracking metadata
      })
      result.directories.push(options.rootPath)
      result.operations++
    } catch (error: any) {
      // Directory might already exist, that's fine
      if (error.code !== 'EEXIST') {
        throw error
      }
      result.directories.push(options.rootPath)
    }

    // Preserve source file if requested
    if (options.preserveSource && options.sourceBuffer && options.sourceFilename) {
      const sourcePath = `${options.rootPath}/_source${this.getExtension(options.sourceFilename)}`
      await this.vfs.writeFile(sourcePath, options.sourceBuffer, {
        metadata: trackingMetadata  // v4.10.0: Add tracking metadata
      })
      result.files.push({
        path: sourcePath,
        type: 'source'
      })
      result.operations++
    }

    // Group entities
    const groups = this.groupEntities(importResult, options)

    // Create directories and files for each group
    for (const [groupName, entities] of groups.entries()) {
      const groupPath = `${options.rootPath}/${groupName}`

      // Create group directory
      try {
        await this.vfs.mkdir(groupPath, {
          recursive: true,
          metadata: trackingMetadata  // v4.10.0: Add tracking metadata
        })
        result.directories.push(groupPath)
        result.operations++
      } catch (error: any) {
        // Directory might already exist
        if (error.code !== 'EEXIST') {
          throw error
        }
        result.directories.push(groupPath)
      }

      // Create entity files
      for (const extracted of entities) {
        const sanitizedName = this.sanitizeFilename(extracted.entity.name)
        const entityPath = `${groupPath}/${sanitizedName}.json`

        // Create entity JSON
        const entityJson = {
          id: extracted.entity.id,
          name: extracted.entity.name,
          type: extracted.entity.type,
          description: extracted.entity.description,
          confidence: extracted.entity.confidence,
          metadata: extracted.entity.metadata,
          concepts: extracted.concepts || [],
          relatedEntities: extracted.relatedEntities,
          relationships: extracted.relationships.map(rel => ({
            from: rel.from,
            to: rel.to,
            type: rel.type,
            confidence: rel.confidence,
            evidence: rel.evidence
          }))
        }

        await this.vfs.writeFile(entityPath, JSON.stringify(entityJson, null, 2), {
          metadata: {
            ...trackingMetadata,  // v4.10.0: Add tracking metadata
            entityId: extracted.entity.id
          }
        })
        result.files.push({
          path: entityPath,
          entityId: extracted.entity.id,
          type: 'entity'
        })
        result.operations++
      }
    }

    // Create relationships file
    if (options.createRelationshipFile !== false) {
      const relationshipsPath = `${options.rootPath}/_relationships.json`
      const allRelationships = importResult.rows.flatMap(row => row.relationships)

      const relationshipsJson = {
        source: options.sourceFilename || 'unknown',
        count: allRelationships.length,
        relationships: allRelationships,
        stats: {
          byType: this.groupByType(allRelationships, 'type'),
          byConfidence: {
            high: allRelationships.filter(r => r.confidence > 0.8).length,
            medium: allRelationships.filter(r => r.confidence >= 0.6 && r.confidence <= 0.8).length,
            low: allRelationships.filter(r => r.confidence < 0.6).length
          }
        }
      }

      await this.vfs.writeFile(relationshipsPath, JSON.stringify(relationshipsJson, null, 2), {
        metadata: trackingMetadata  // v4.10.0: Add tracking metadata
      })
      result.files.push({
        path: relationshipsPath,
        type: 'relationships'
      })
      result.operations++
    }

    // Create metadata file
    if (options.createMetadataFile !== false) {
      const metadataPath = `${options.rootPath}/_metadata.json`
      const metadataJson = {
        import: {
          timestamp: new Date().toISOString(),
          source: {
            filename: options.sourceFilename || 'unknown',
            format: 'excel'
          },
          options: {
            groupBy: options.groupBy,
            preserveSource: options.preserveSource
          },
          stats: {
            rowsProcessed: importResult.rowsProcessed,
            entitiesExtracted: importResult.entitiesExtracted,
            relationshipsInferred: importResult.relationshipsInferred,
            processingTime: importResult.processingTime,
            byType: importResult.stats.byType,
            byConfidence: importResult.stats.byConfidence
          }
        },
        structure: {
          rootPath: options.rootPath,
          groupingStrategy: options.groupBy,
          directories: result.directories,
          fileCount: result.files.length
        }
      }

      await this.vfs.writeFile(metadataPath, JSON.stringify(metadataJson, null, 2), {
        metadata: trackingMetadata  // v4.10.0: Add tracking metadata
      })
      result.files.push({
        path: metadataPath,
        type: 'metadata'
      })
      result.operations++
    }

    result.duration = Date.now() - startTime
    return result
  }

  /**
   * Group entities by strategy
   */
  private groupEntities(
    importResult: SmartExcelResult,
    options: VFSStructureOptions
  ): Map<string, typeof importResult.rows> {
    const groups = new Map<string, typeof importResult.rows>()

    // Handle sheet-based grouping (v4.2.0)
    if (options.groupBy === 'sheet' && importResult.sheets && importResult.sheets.length > 0) {
      for (const sheet of importResult.sheets) {
        groups.set(sheet.name, sheet.rows)
      }
      return groups
    }

    // Handle other grouping strategies
    for (const extracted of importResult.rows) {
      let groupName: string

      switch (options.groupBy) {
        case 'type':
          groupName = this.getTypeGroupName(extracted.entity.type)
          break

        case 'flat':
          groupName = 'entities'
          break

        case 'custom':
          groupName = options.customGrouping ?
            options.customGrouping(extracted.entity) :
            'entities'
          break

        case 'sheet':
          // Fallback if sheets data not available
          groupName = 'entities'
          break

        default:
          groupName = 'entities'
      }

      if (!groups.has(groupName)) {
        groups.set(groupName, [])
      }
      groups.get(groupName)!.push(extracted)
    }

    return groups
  }

  /**
   * Get directory name for entity type
   */
  private getTypeGroupName(type: NounType): string {
    const typeMap: Record<string, string> = {
      [NounType.Person]: 'Characters',
      [NounType.Location]: 'Places',
      [NounType.Organization]: 'Organizations',
      [NounType.Concept]: 'Concepts',
      [NounType.Event]: 'Events',
      [NounType.Product]: 'Items',
      [NounType.Document]: 'Documents',
      [NounType.Project]: 'Projects',
      [NounType.Thing]: 'Other'
    }

    return typeMap[type as string] || 'Other'
  }

  /**
   * Sanitize filename
   */
  private sanitizeFilename(name: string): string {
    return name
      .replace(/[<>:"/\\|?*]/g, '_')  // Replace invalid chars
      .replace(/\s+/g, '_')            // Replace spaces
      .replace(/_{2,}/g, '_')          // Collapse multiple underscores
      .substring(0, 200)               // Limit length
  }

  /**
   * Get file extension
   */
  private getExtension(filename: string): string {
    const lastDot = filename.lastIndexOf('.')
    return lastDot !== -1 ? filename.substring(lastDot) : '.bin'
  }

  /**
   * Group items by property
   */
  private groupByType<T extends Record<string, any>>(
    items: T[],
    property: keyof T
  ): Record<string, number> {
    const groups: Record<string, number> = {}

    for (const item of items) {
      const key = String(item[property])
      groups[key] = (groups[key] || 0) + 1
    }

    return groups
  }
}
