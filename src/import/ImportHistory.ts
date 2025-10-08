/**
 * Import History & Rollback (Phase 4)
 *
 * Tracks all imports with:
 * - Complete metadata and provenance
 * - Entity and relationship tracking
 * - Rollback capability
 * - Import statistics
 *
 * NO MOCKS - Production-ready implementation
 */

import { Brainy } from '../brainy.js'
import type { ImportResult } from './ImportCoordinator.js'

export interface ImportHistoryEntry {
  /** Unique import ID */
  importId: string

  /** Import timestamp */
  timestamp: number

  /** Source information */
  source: {
    type: 'file' | 'buffer' | 'object' | 'string'
    filename?: string
    format: string
  }

  /** Import results */
  result: ImportResult

  /** Entities created in this import */
  entities: string[]

  /** Relationships created in this import */
  relationships: string[]

  /** VFS paths created */
  vfsPaths: string[]

  /** Import status */
  status: 'success' | 'partial' | 'failed'

  /** Error messages (if any) */
  errors?: string[]
}

export interface RollbackResult {
  /** Was rollback successful */
  success: boolean

  /** Entities deleted */
  entitiesDeleted: number

  /** Relationships deleted */
  relationshipsDeleted: number

  /** VFS files deleted */
  vfsFilesDeleted: number

  /** Errors encountered */
  errors: string[]
}

/**
 * ImportHistory - Track and manage import history with rollback
 */
export class ImportHistory {
  private brain: Brainy
  private history: Map<string, ImportHistoryEntry>
  private historyFile: string

  constructor(brain: Brainy, historyFile: string = '/.brainy/import_history.json') {
    this.brain = brain
    this.history = new Map()
    this.historyFile = historyFile
  }

  /**
   * Initialize history (load from VFS if exists)
   */
  async init(): Promise<void> {
    try {
      const vfs = this.brain.vfs()
      await vfs.init()

      // Try to load existing history
      const content = await vfs.readFile(this.historyFile)
      const data = JSON.parse(content.toString('utf-8'))

      this.history = new Map(Object.entries(data))
    } catch (error) {
      // No existing history or VFS not available, start fresh
      this.history = new Map()
    }
  }

  /**
   * Record an import
   */
  async recordImport(
    importId: string,
    source: ImportHistoryEntry['source'],
    result: ImportResult
  ): Promise<void> {
    const entry: ImportHistoryEntry = {
      importId,
      timestamp: Date.now(),
      source,
      result,
      entities: result.entities.map(e => e.id),
      relationships: result.relationships.map(r => r.id),
      vfsPaths: result.vfs.files.map(f => f.path),
      status: result.stats.entitiesExtracted > 0 ? 'success' : 'partial'
    }

    this.history.set(importId, entry)

    // Persist to VFS
    await this.persist()
  }

  /**
   * Get import history
   */
  getHistory(): ImportHistoryEntry[] {
    return Array.from(this.history.values()).sort((a, b) => b.timestamp - a.timestamp)
  }

  /**
   * Get specific import
   */
  getImport(importId: string): ImportHistoryEntry | null {
    return this.history.get(importId) || null
  }

  /**
   * Rollback an import (delete all entities, relationships, VFS files)
   */
  async rollback(importId: string): Promise<RollbackResult> {
    const entry = this.history.get(importId)
    if (!entry) {
      throw new Error(`Import ${importId} not found in history`)
    }

    const result: RollbackResult = {
      success: true,
      entitiesDeleted: 0,
      relationshipsDeleted: 0,
      vfsFilesDeleted: 0,
      errors: []
    }

    // Delete relationships first
    for (const relId of entry.relationships) {
      try {
        await this.brain.unrelate(relId)
        result.relationshipsDeleted++
      } catch (error) {
        result.errors.push(`Failed to delete relationship ${relId}: ${error instanceof Error ? error.message : String(error)}`)
      }
    }

    // Delete entities
    for (const entityId of entry.entities) {
      try {
        await this.brain.delete(entityId)
        result.entitiesDeleted++
      } catch (error) {
        result.errors.push(`Failed to delete entity ${entityId}: ${error instanceof Error ? error.message : String(error)}`)
      }
    }

    // Delete VFS files
    try {
      const vfs = this.brain.vfs()
      await vfs.init()

      for (const vfsPath of entry.vfsPaths) {
        try {
          await vfs.unlink(vfsPath)
          result.vfsFilesDeleted++
        } catch (error) {
          // File might not exist or VFS unavailable
          result.errors.push(`Failed to delete VFS file ${vfsPath}: ${error instanceof Error ? error.message : String(error)}`)
        }
      }

      // Try to delete VFS root directory if empty
      try {
        const rootPath = entry.result.vfs.rootPath
        const contents = await vfs.readdir(rootPath)
        if (contents.length === 0) {
          await vfs.rmdir(rootPath)
        }
      } catch (error) {
        // Ignore errors for directory cleanup
      }
    } catch (error) {
      result.errors.push(`VFS cleanup failed: ${error instanceof Error ? error.message : String(error)}`)
    }

    // Remove from history
    this.history.delete(importId)

    // Persist updated history
    await this.persist()

    result.success = result.errors.length === 0

    return result
  }

  /**
   * Get import statistics
   */
  getStatistics(): {
    totalImports: number
    totalEntities: number
    totalRelationships: number
    byFormat: Record<string, number>
    byStatus: Record<string, number>
  } {
    const history = Array.from(this.history.values())

    return {
      totalImports: history.length,
      totalEntities: history.reduce((sum, h) => sum + h.entities.length, 0),
      totalRelationships: history.reduce((sum, h) => sum + h.relationships.length, 0),
      byFormat: history.reduce((acc, h) => {
        acc[h.source.format] = (acc[h.source.format] || 0) + 1
        return acc
      }, {} as Record<string, number>),
      byStatus: history.reduce((acc, h) => {
        acc[h.status] = (acc[h.status] || 0) + 1
        return acc
      }, {} as Record<string, number>)
    }
  }

  /**
   * Persist history to VFS
   */
  private async persist(): Promise<void> {
    try {
      const vfs = this.brain.vfs()
      await vfs.init()

      // Ensure directory exists
      const dir = this.historyFile.substring(0, this.historyFile.lastIndexOf('/'))
      try {
        await vfs.mkdir(dir, { recursive: true })
      } catch (error) {
        // Directory might exist
      }

      // Convert Map to object for JSON
      const data = Object.fromEntries(this.history)

      await vfs.writeFile(this.historyFile, JSON.stringify(data, null, 2))
    } catch (error) {
      // VFS might not be available, continue without persistence
      console.warn('Failed to persist import history:', error instanceof Error ? error.message : String(error))
    }
  }
}
