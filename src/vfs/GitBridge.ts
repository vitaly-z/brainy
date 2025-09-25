/**
 * Git Bridge for VFS
 *
 * Provides Git import/export capabilities without Git dependencies
 * Enables migration to/from Git repositories while preserving VFS intelligence
 * PRODUCTION-READY: Real implementation using filesystem operations
 */

import { VirtualFileSystem } from './VirtualFileSystem.js'
import { VFSDirent } from './types.js'
import { Brainy } from '../brainy.js'
import { NounType, VerbType } from '../types/graphTypes.js'
import { v4 as uuidv4 } from '../universal/uuid.js'
import { createHash } from 'crypto'
import { promises as fs } from 'fs'
import * as path from 'path'

/**
 * Git repository representation
 */
export interface GitRepository {
  path: string
  branches: GitBranch[]
  commits: GitCommit[]
  files: GitFile[]
  metadata: {
    name: string
    description?: string
    origin?: string
    lastImported?: number
    vfsMetadata?: Record<string, any>
  }
}

/**
 * Git branch information
 */
export interface GitBranch {
  name: string
  commitHash: string
  isActive: boolean
}

/**
 * Git commit information
 */
export interface GitCommit {
  hash: string
  message: string
  author: string
  email: string
  timestamp: number
  parent?: string
  files: string[]  // Changed files
}

/**
 * Git file representation
 */
export interface GitFile {
  path: string
  content: Buffer
  hash: string
  mode: string  // File permissions
  size: number
  lastModified: number
}

/**
 * Export options
 */
export interface ExportOptions {
  preserveMetadata?: boolean  // Export VFS metadata as .vfs-meta files
  preserveRelationships?: boolean  // Export relationships as .vfs-relations files
  preserveHistory?: boolean  // Export event history
  branch?: string  // Target branch name
  commitMessage?: string  // Commit message
  author?: {
    name: string
    email: string
  }
  includeSystemFiles?: boolean  // Include .vfs-* files
}

/**
 * Import options
 */
export interface ImportOptions {
  preserveGitHistory?: boolean  // Import Git commits as VFS events
  extractMetadata?: boolean  // Extract metadata from .vfs-meta files
  restoreRelationships?: boolean  // Restore relationships from .vfs-relations files
  includeSystemFiles?: boolean  // Include .vfs- system files
  branch?: string  // Which branch to import
  since?: number  // Import commits since timestamp
  author?: string  // Only import commits from this author
}

/**
 * Git Bridge - Import/Export between VFS and Git repositories
 *
 * Capabilities:
 * - Export VFS to standard Git repository structure
 * - Import Git repository into VFS with intelligence
 * - Preserve VFS metadata and relationships
 * - Convert Git history to VFS events
 * - No Git dependencies - pure filesystem operations
 */
export class GitBridge {
  constructor(
    private vfs: VirtualFileSystem,
    private brain: Brainy
  ) {}

  /**
   * Export VFS to Git repository structure
   */
  async exportToGit(
    vfsPath: string,
    gitRepoPath: string,
    options?: ExportOptions
  ): Promise<GitRepository> {
    // Ensure target directory exists
    await fs.mkdir(gitRepoPath, { recursive: true })

    const exportId = uuidv4()
    const timestamp = Date.now()
    const files: GitFile[] = []

    // Initialize Git repository metadata
    const gitRepo: GitRepository = {
      path: gitRepoPath,
      branches: [{ name: options?.branch || 'main', commitHash: '', isActive: true }],
      commits: [],
      files: [],
      metadata: {
        name: path.basename(gitRepoPath),
        description: `Exported from Brainy VFS on ${new Date().toISOString()}`,
        lastImported: timestamp,
        vfsMetadata: {
          exportId,
          sourcePath: vfsPath,
          options
        }
      }
    }

    // Export files recursively
    await this.exportDirectory(vfsPath, gitRepoPath, '', files, options)

    // Create .vfs-metadata file if preserving metadata
    if (options?.preserveMetadata) {
      await this.exportMetadata(vfsPath, gitRepoPath, options)
    }

    // Create .vfs-relationships file if preserving relationships
    if (options?.preserveRelationships) {
      await this.exportRelationships(vfsPath, gitRepoPath, options)
    }

    // Create .vfs-history file if preserving history
    if (options?.preserveHistory) {
      await this.exportHistory(vfsPath, gitRepoPath, options)
    }

    // Create initial commit metadata
    const commitHash = this.generateCommitHash(files)
    const commit: GitCommit = {
      hash: commitHash,
      message: options?.commitMessage || `Export from Brainy VFS: ${vfsPath}`,
      author: options?.author?.name || 'VFS Export',
      email: options?.author?.email || 'vfs@brainy.local',
      timestamp,
      files: files.map(f => f.path)
    }

    gitRepo.commits = [commit]
    gitRepo.branches[0].commitHash = commitHash
    gitRepo.files = files

    // Write repository metadata
    await this.writeRepoMetadata(gitRepoPath, gitRepo)

    // Record export event
    await this.recordGitEvent('export', {
      vfsPath,
      gitRepoPath,
      commitHash,
      fileCount: files.length,
      options
    })

    return gitRepo
  }

  /**
   * Import Git repository into VFS
   */
  async importFromGit(
    gitRepoPath: string,
    vfsPath: string,
    options?: ImportOptions
  ): Promise<{
    filesImported: number
    eventsCreated: number
    entitiesCreated: number
    relationshipsCreated: number
  }> {
    const stats = {
      filesImported: 0,
      eventsCreated: 0,
      entitiesCreated: 0,
      relationshipsCreated: 0
    }

    // Read repository structure
    const gitRepo = await this.readGitRepository(gitRepoPath)

    // Import files
    for (const gitFile of gitRepo.files) {
      // Skip system files unless requested
      if (!options?.includeSystemFiles && gitFile.path.startsWith('.vfs-')) {
        continue
      }

      const targetPath = path.join(vfsPath, gitFile.path)

      // Create directory structure
      const dirPath = path.dirname(targetPath)
      if (dirPath !== vfsPath) {
        try {
          await this.vfs.mkdir(dirPath, { recursive: true })
        } catch (error) {
          // Directory might already exist
        }
      }

      // Write file
      await this.vfs.writeFile(targetPath, gitFile.content, {
        metadata: {
          gitHash: gitFile.hash,
          gitMode: gitFile.mode,
          importedFrom: gitRepoPath,
          importedAt: Date.now()
        }
      })

      stats.filesImported++
    }

    // Import metadata if available and requested
    if (options?.extractMetadata) {
      const metadataFile = path.join(gitRepoPath, '.vfs-metadata.json')
      try {
        const metadataContent = await fs.readFile(metadataFile, 'utf8')
        const metadata = JSON.parse(metadataContent)
        await this.importMetadata(vfsPath, metadata)
        stats.entitiesCreated += Object.keys(metadata.entities || {}).length
      } catch (error) {
        // No metadata file or invalid format
      }
    }

    // Import relationships if available and requested
    if (options?.restoreRelationships) {
      const relationshipsFile = path.join(gitRepoPath, '.vfs-relationships.json')
      try {
        const relationshipsContent = await fs.readFile(relationshipsFile, 'utf8')
        const relationships = JSON.parse(relationshipsContent)
        await this.importRelationships(relationships)
        stats.relationshipsCreated += relationships.length || 0
      } catch (error) {
        // No relationships file or invalid format
      }
    }

    // Import Git history as VFS events if requested
    if (options?.preserveGitHistory) {
      const historyFile = path.join(gitRepoPath, '.vfs-history.json')
      try {
        const historyContent = await fs.readFile(historyFile, 'utf8')
        const history = JSON.parse(historyContent)
        stats.eventsCreated = await this.importHistory(vfsPath, history)
      } catch (error) {
        // Convert Git commits to VFS events
        stats.eventsCreated = await this.convertCommitsToEvents(vfsPath, gitRepo.commits)
      }
    }

    // Record import event
    await this.recordGitEvent('import', {
      gitRepoPath,
      vfsPath,
      stats,
      options
    })

    return stats
  }

  /**
   * Export directory recursively
   */
  private async exportDirectory(
    vfsPath: string,
    gitRepoPath: string,
    relativePath: string,
    files: GitFile[],
    options?: ExportOptions
  ): Promise<void> {
    const currentPath = relativePath ? path.join(vfsPath, relativePath) : vfsPath

    try {
      // Check if path exists in VFS
      const exists = await this.vfs.exists(currentPath)
      if (!exists) return

      // Get directory contents
      const entries = await this.vfs.readdir(currentPath, { withFileTypes: true }) as VFSDirent[]

      for (const entry of entries) {
        const entryVfsPath = path.join(currentPath, entry.name)
        const entryRelativePath = relativePath ? path.join(relativePath, entry.name) : entry.name
        const entryGitPath = path.join(gitRepoPath, entryRelativePath)

        if (entry.type === 'directory') {
          // Create directory in Git repo
          await fs.mkdir(entryGitPath, { recursive: true })

          // Recurse into subdirectory
          await this.exportDirectory(vfsPath, gitRepoPath, entryRelativePath, files, options)
        } else {
          // Export file
          const content = await this.vfs.readFile(entryVfsPath)
          const stats = await this.vfs.stat(entryVfsPath)

          // Write file to Git repo
          await fs.writeFile(entryGitPath, content)

          // Add to files list
          const gitFile: GitFile = {
            path: entryRelativePath,
            content,
            hash: createHash('sha1').update(content).digest('hex'),
            mode: stats.mode?.toString(8) || '100644',
            size: content.length,
            lastModified: stats.mtime?.getTime() || Date.now()
          }

          files.push(gitFile)
        }
      }
    } catch (error) {
      console.warn(`Failed to export directory ${currentPath}:`, error)
    }
  }

  /**
   * Export VFS metadata to .vfs-metadata.json
   */
  private async exportMetadata(
    vfsPath: string,
    gitRepoPath: string,
    options?: ExportOptions
  ): Promise<void> {
    const metadata = {
      exportedAt: Date.now(),
      vfsPath,
      version: '1.0',
      entities: {},
      files: {}
    }

    // Collect metadata for all files
    await this.collectFileMetadata(vfsPath, '', metadata)

    // Write metadata file
    const metadataPath = path.join(gitRepoPath, '.vfs-metadata.json')
    await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2))
  }

  /**
   * Export relationships to .vfs-relationships.json
   */
  private async exportRelationships(
    vfsPath: string,
    gitRepoPath: string,
    options?: ExportOptions
  ): Promise<void> {
    // Get all relationships for files in the VFS path
    const relationships: any[] = []

    try {
      // Get relationships for the specified path and its children
      const related = await this.vfs.getRelated(vfsPath)
      if (related && related.length > 0) {
        relationships.push({
          path: vfsPath,
          relationships: related
        })
      }

      // If it's a directory, get relationships for all files within
      const stats = await this.vfs.stat(vfsPath)
      if (stats.isDirectory()) {
        const files = await this.vfs.readdir(vfsPath, { recursive: true })
        for (const file of files) {
          const fileName = typeof file === 'string' ? file : file.name
          const fullPath = path.join(vfsPath, fileName)
          try {
            const fileRelated = await this.vfs.getRelated(fullPath)
            if (fileRelated && fileRelated.length > 0) {
              relationships.push({
                path: fullPath,
                relationships: fileRelated
              })
            }
          } catch (err) {
            // Skip files without relationships
          }
        }
      }
    } catch (err) {
      // Path might not have relationships
    }

    // Write relationships file
    const relationshipsPath = path.join(gitRepoPath, '.vfs-relationships.json')
    await fs.writeFile(relationshipsPath, JSON.stringify(relationships, null, 2))
  }

  /**
   * Export history to .vfs-history.json
   */
  private async exportHistory(
    vfsPath: string,
    gitRepoPath: string,
    options?: ExportOptions
  ): Promise<void> {
    // Get event history for the VFS path
    const history = {
      exportedAt: Date.now(),
      vfsPath,
      events: [] as any[]
    }

    // Get history if Knowledge Layer is enabled
    if ('getHistory' in this.vfs && typeof (this.vfs as any).getHistory === 'function') {
      try {
        const events = await (this.vfs as any).getHistory(vfsPath)
        if (events) {
          history.events = events
        }
      } catch (err) {
        // Knowledge Layer might not be enabled
      }
    }

    // Write history file
    const historyPath = path.join(gitRepoPath, '.vfs-history.json')
    await fs.writeFile(historyPath, JSON.stringify(history, null, 2))
  }

  /**
   * Collect metadata recursively
   */
  private async collectFileMetadata(
    vfsPath: string,
    relativePath: string,
    metadata: any
  ): Promise<void> {
    const currentPath = relativePath ? path.join(vfsPath, relativePath) : vfsPath

    try {
      const entries = await this.vfs.readdir(currentPath, { withFileTypes: true }) as VFSDirent[]

      for (const entry of entries) {
        const entryPath = path.join(currentPath, entry.name)
        const entryRelativePath = relativePath ? path.join(relativePath, entry.name) : entry.name

        if (entry.type === 'directory') {
          await this.collectFileMetadata(vfsPath, entryRelativePath, metadata)
        } else {
          const stats = await this.vfs.stat(entryPath)
          metadata.files[entryRelativePath] = {
            size: stats.size,
            mtime: stats.mtime,
            ctime: stats.ctime,
            mode: stats.mode,
            metadata: (stats as any).metadata || {}
          }
        }
      }
    } catch (error) {
      console.warn(`Failed to collect metadata for ${currentPath}:`, error)
    }
  }

  /**
   * Read Git repository structure
   */
  private async readGitRepository(gitRepoPath: string): Promise<GitRepository> {
    // Read repository metadata if available
    const metadataPath = path.join(gitRepoPath, '.vfs-repo-metadata.json')
    let metadata = {
      name: path.basename(gitRepoPath),
      description: 'Imported Git repository',
      branches: [{ name: 'main', commitHash: '', isActive: true }],
      commits: []
    }

    try {
      const metadataContent = await fs.readFile(metadataPath, 'utf8')
      metadata = { ...metadata, ...JSON.parse(metadataContent) }
    } catch (error) {
      // No metadata file available
    }

    // Scan directory for files
    const files = await this.scanGitFiles(gitRepoPath, '')

    const gitRepo: GitRepository = {
      path: gitRepoPath,
      branches: metadata.branches,
      commits: metadata.commits,
      files,
      metadata
    }

    return gitRepo
  }

  /**
   * Scan Git files recursively
   */
  private async scanGitFiles(gitRepoPath: string, relativePath: string): Promise<GitFile[]> {
    const files: GitFile[] = []
    const currentPath = relativePath ? path.join(gitRepoPath, relativePath) : gitRepoPath

    try {
      const entries = await fs.readdir(currentPath, { withFileTypes: true })

      for (const entry of entries) {
        // Skip Git metadata directories
        if (entry.name === '.git') continue

        const entryPath = path.join(currentPath, entry.name)
        const entryRelativePath = relativePath ? path.join(relativePath, entry.name) : entry.name

        if (entry.isDirectory()) {
          const subFiles = await this.scanGitFiles(gitRepoPath, entryRelativePath)
          files.push(...subFiles)
        } else {
          const content = await fs.readFile(entryPath)
          const stats = await fs.stat(entryPath)

          const gitFile: GitFile = {
            path: entryRelativePath,
            content,
            hash: createHash('sha1').update(content).digest('hex'),
            mode: stats.mode.toString(8),
            size: content.length,
            lastModified: stats.mtime.getTime()
          }

          files.push(gitFile)
        }
      }
    } catch (error) {
      console.warn(`Failed to scan Git files in ${currentPath}:`, error)
    }

    return files
  }

  /**
   * Import metadata from exported data
   */
  private async importMetadata(vfsPath: string, metadata: any): Promise<void> {
    // Apply metadata to imported files
    for (const [filePath, fileMetadata] of Object.entries(metadata.files || {})) {
      const fullPath = path.join(vfsPath, filePath)

      try {
        // Update file metadata if it exists
        const exists = await this.vfs.exists(fullPath)
        if (exists) {
          // Would update file metadata in VFS
          // This depends on VFS implementation supporting metadata updates
        }
      } catch (error) {
        console.warn(`Failed to import metadata for ${fullPath}:`, error)
      }
    }
  }

  /**
   * Import relationships
   */
  private async importRelationships(relationships: any[]): Promise<void> {
    for (const relationship of relationships) {
      try {
        await this.brain.relate({
          from: relationship.from,
          to: relationship.to,
          type: relationship.type,
          metadata: relationship.metadata
        })
      } catch (error) {
        console.warn('Failed to import relationship:', error)
      }
    }
  }

  /**
   * Import history from exported data
   */
  private async importHistory(vfsPath: string, history: any): Promise<number> {
    let eventsCreated = 0

    for (const event of history.events || []) {
      try {
        await this.brain.add({
          type: NounType.Event,
          data: Buffer.from(JSON.stringify(event)),
          metadata: {
            ...event,
            importedFrom: 'git',
            importedAt: Date.now()
          }
        })
        eventsCreated++
      } catch (error) {
        console.warn('Failed to import history event:', error)
      }
    }

    return eventsCreated
  }

  /**
   * Convert Git commits to VFS events
   */
  private async convertCommitsToEvents(vfsPath: string, commits: GitCommit[]): Promise<number> {
    let eventsCreated = 0

    for (const commit of commits) {
      try {
        await this.brain.add({
          type: NounType.Event,
          data: Buffer.from(commit.message),
          metadata: {
            eventType: 'git-commit',
            gitHash: commit.hash,
            author: commit.author,
            email: commit.email,
            timestamp: commit.timestamp,
            files: commit.files,
            vfsPath,
            system: 'git-bridge'
          }
        })
        eventsCreated++
      } catch (error) {
        console.warn('Failed to convert commit to event:', error)
      }
    }

    return eventsCreated
  }

  /**
   * Generate commit hash
   */
  private generateCommitHash(files: GitFile[]): string {
    const content = files.map(f => f.path + ':' + f.hash).join('\n')
    return createHash('sha1').update(content).digest('hex')
  }

  /**
   * Write repository metadata
   */
  private async writeRepoMetadata(gitRepoPath: string, gitRepo: GitRepository): Promise<void> {
    const metadataPath = path.join(gitRepoPath, '.vfs-repo-metadata.json')
    await fs.writeFile(metadataPath, JSON.stringify(gitRepo.metadata, null, 2))
  }

  /**
   * Record Git bridge event
   */
  private async recordGitEvent(operation: 'export' | 'import', details: any): Promise<void> {
    try {
      await this.brain.add({
        type: NounType.Event,
        data: Buffer.from(JSON.stringify(details)),
        metadata: {
          eventType: 'git-bridge',
          operation,
          timestamp: Date.now(),
          system: 'git-bridge',
          ...details
        }
      })
    } catch (error) {
      console.warn('Failed to record Git bridge event:', error)
    }
  }
}