/**
 * Directory Importer for VFS
 *
 * Efficiently imports real directories into VFS with:
 * - Batch processing for performance
 * - Progress tracking
 * - Error recovery
 * - Parallel processing
 */

import { promises as fs } from 'fs'
import * as path from 'path'
import { VirtualFileSystem } from '../VirtualFileSystem.js'
import { Brainy } from '../../brainy.js'
import { NounType } from '../../types/graphTypes.js'

export interface ImportOptions {
  targetPath?: string       // VFS target path (default: '/')
  recursive?: boolean        // Import subdirectories (default: true)
  skipHidden?: boolean      // Skip hidden files (default: false)
  skipNodeModules?: boolean // Skip node_modules (default: true)
  batchSize?: number        // Files per batch (default: 100)
  generateEmbeddings?: boolean // Generate embeddings (default: true)
  extractMetadata?: boolean // Extract metadata (default: true)
  showProgress?: boolean    // Log progress (default: false)
  filter?: (path: string) => boolean // Custom filter function
}

export interface ImportResult {
  imported: string[]        // Successfully imported paths
  failed: Array<{          // Failed imports
    path: string
    error: Error
  }>
  skipped: string[]        // Skipped paths
  totalSize: number        // Total bytes imported
  duration: number         // Time taken in ms
  filesProcessed: number   // Total files processed
  directoriesCreated: number // Total directories created
}

export interface ImportProgress {
  type: 'progress' | 'complete' | 'error'
  processed: number
  total?: number
  current?: string
  error?: Error
}

export class DirectoryImporter {
  constructor(
    private vfs: VirtualFileSystem,
    private brain: Brainy
  ) {}

  /**
   * Import a directory or file into VFS
   */
  async import(sourcePath: string, options: ImportOptions = {}): Promise<ImportResult> {
    const startTime = Date.now()
    const result: ImportResult = {
      imported: [],
      failed: [],
      skipped: [],
      totalSize: 0,
      duration: 0,
      filesProcessed: 0,
      directoriesCreated: 0
    }

    try {
      const stats = await fs.stat(sourcePath)

      if (stats.isFile()) {
        await this.importFile(sourcePath, options.targetPath || '/', result)
      } else if (stats.isDirectory()) {
        await this.importDirectory(sourcePath, options, result)
      }
    } catch (error) {
      result.failed.push({
        path: sourcePath,
        error: error as Error
      })
    }

    result.duration = Date.now() - startTime
    return result
  }

  /**
   * Import with progress tracking (generator)
   */
  async *importStream(sourcePath: string, options: ImportOptions = {}): AsyncGenerator<ImportProgress> {
    const files = await this.collectFiles(sourcePath, options)
    const total = files.length
    const batchSize = options.batchSize || 100
    let processed = 0

    // Process in batches
    for (let i = 0; i < files.length; i += batchSize) {
      const batch = files.slice(i, i + batchSize)

      try {
        await this.processBatch(batch, options)
        processed += batch.length

        yield {
          type: 'progress',
          processed,
          total,
          current: batch[batch.length - 1]
        }
      } catch (error) {
        yield {
          type: 'error',
          processed,
          total,
          error: error as Error
        }
      }
    }

    yield {
      type: 'complete',
      processed,
      total
    }
  }

  /**
   * Import a directory recursively
   */
  private async importDirectory(
    dirPath: string,
    options: ImportOptions,
    result: ImportResult
  ): Promise<void> {
    const targetPath = options.targetPath || '/'

    // Create VFS directory structure
    await this.createDirectoryStructure(dirPath, targetPath, options, result)

    // Collect all files
    const files = await this.collectFiles(dirPath, options)

    // Process files in batches
    const batchSize = options.batchSize || 100
    for (let i = 0; i < files.length; i += batchSize) {
      const batch = files.slice(i, i + batchSize)
      await this.processBatch(batch, options, result)

      if (options.showProgress && i % (batchSize * 10) === 0) {
        console.log(`Imported ${i} / ${files.length} files...`)
      }
    }
  }

  /**
   * Create directory structure in VFS
   */
  private async createDirectoryStructure(
    sourcePath: string,
    targetPath: string,
    options: ImportOptions,
    result: ImportResult
  ): Promise<void> {
    // Walk directory tree and create all directories first
    const dirsToCreate: string[] = []

    const collectDirs = async (dir: string, vfsPath: string) => {
      dirsToCreate.push(vfsPath)

      const entries = await fs.readdir(dir, { withFileTypes: true })
      for (const entry of entries) {
        if (entry.isDirectory()) {
          if (this.shouldSkip(entry.name, path.join(dir, entry.name), options)) {
            continue
          }

          const childPath = path.join(dir, entry.name)
          const childVfsPath = path.posix.join(vfsPath, entry.name)

          if (options.recursive !== false) {
            await collectDirs(childPath, childVfsPath)
          }
        }
      }
    }

    await collectDirs(sourcePath, targetPath)

    // Create all directories
    for (const dirPath of dirsToCreate) {
      try {
        await this.vfs.mkdir(dirPath, { recursive: true })
        result.directoriesCreated++
      } catch (error: any) {
        if (error.code !== 'EEXIST') {
          result.failed.push({ path: dirPath, error })
        }
      }
    }
  }

  /**
   * Collect all files to be imported
   */
  private async collectFiles(dirPath: string, options: ImportOptions): Promise<string[]> {
    const files: string[] = []

    const walk = async (dir: string) => {
      const entries = await fs.readdir(dir, { withFileTypes: true })

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name)

        if (this.shouldSkip(entry.name, fullPath, options)) {
          continue
        }

        if (entry.isFile()) {
          files.push(fullPath)
        } else if (entry.isDirectory() && options.recursive !== false) {
          await walk(fullPath)
        }
      }
    }

    await walk(dirPath)
    return files
  }

  /**
   * Process a batch of files
   */
  private async processBatch(
    files: string[],
    options: ImportOptions,
    result?: ImportResult
  ): Promise<void> {
    const imports = await Promise.allSettled(
      files.map(filePath => this.importSingleFile(filePath, options))
    )

    if (result) {
      for (let i = 0; i < imports.length; i++) {
        const importResult = imports[i]
        const filePath = files[i]

        if (importResult.status === 'fulfilled') {
          result.imported.push(importResult.value.vfsPath)
          result.totalSize += importResult.value.size
          result.filesProcessed++
        } else {
          result.failed.push({
            path: filePath,
            error: importResult.reason
          })
        }
      }
    }
  }

  /**
   * Import a single file
   */
  private async importSingleFile(
    filePath: string,
    options: ImportOptions
  ): Promise<{ vfsPath: string, size: number }> {
    const stats = await fs.stat(filePath)
    const content = await fs.readFile(filePath)

    // Calculate VFS path
    const relativePath = path.relative(process.cwd(), filePath)
    const vfsPath = path.posix.join(options.targetPath || '/', relativePath)

    // Generate embedding if requested
    let embedding: number[] | undefined
    if (options.generateEmbeddings !== false) {
      try {
        // Use first 10KB for embedding
        const text = content.toString('utf8', 0, Math.min(10240, content.length))
        // Generate embedding using brain's embed method
        const embedResult = await this.brain.embed({ data: text })
        embedding = embedResult
      } catch {
        // Continue without embedding if generation fails
      }
    }

    // Write to VFS
    await this.vfs.writeFile(vfsPath, content, {
      generateEmbedding: options.generateEmbeddings,
      extractMetadata: options.extractMetadata,
      metadata: {
        originalPath: filePath,
        importedAt: Date.now(),
        originalSize: stats.size,
        originalModified: stats.mtime.getTime()
      }
    })

    return { vfsPath, size: stats.size }
  }

  /**
   * Import a single file (for non-directory imports)
   */
  private async importFile(
    filePath: string,
    targetPath: string,
    result: ImportResult
  ): Promise<void> {
    try {
      const imported = await this.importSingleFile(filePath, { targetPath })
      result.imported.push(imported.vfsPath)
      result.totalSize += imported.size
      result.filesProcessed++
    } catch (error) {
      result.failed.push({
        path: filePath,
        error: error as Error
      })
    }
  }

  /**
   * Check if a path should be skipped
   */
  private shouldSkip(name: string, fullPath: string, options: ImportOptions): boolean {
    // Skip hidden files if requested
    if (options.skipHidden && name.startsWith('.')) {
      return true
    }

    // Skip node_modules by default
    if (name === 'node_modules' && options.skipNodeModules !== false) {
      return true
    }

    // Apply custom filter
    if (options.filter && !options.filter(fullPath)) {
      return true
    }

    return false
  }

  /**
   * Detect MIME type from file content and extension
   */
  private detectMimeType(filePath: string, content?: Buffer): string {
    const ext = path.extname(filePath).toLowerCase()

    // Common extensions
    const mimeTypes: Record<string, string> = {
      '.js': 'application/javascript',
      '.ts': 'application/typescript',
      '.jsx': 'application/javascript',
      '.tsx': 'application/typescript',
      '.json': 'application/json',
      '.md': 'text/markdown',
      '.html': 'text/html',
      '.css': 'text/css',
      '.py': 'text/x-python',
      '.go': 'text/x-go',
      '.rs': 'text/x-rust',
      '.java': 'text/x-java',
      '.cpp': 'text/x-c++',
      '.c': 'text/x-c',
      '.h': 'text/x-c',
      '.txt': 'text/plain',
      '.xml': 'application/xml',
      '.yaml': 'text/yaml',
      '.yml': 'text/yaml',
      '.toml': 'text/toml',
      '.sh': 'text/x-shellscript',
      '.pdf': 'application/pdf',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.svg': 'image/svg+xml',
      '.mp3': 'audio/mpeg',
      '.mp4': 'video/mp4',
      '.zip': 'application/zip'
    }

    return mimeTypes[ext] || 'application/octet-stream'
  }
}