/**
 * Virtual Filesystem Type Definitions
 *
 * REAL types for production VFS implementation
 * No mocks, no stubs, actual working definitions
 */

import { Entity, Relation } from '../types/brainy.types.js'
import { NounType, VerbType } from '../types/graphTypes.js'
import { Vector } from '../coreTypes.js'

// ============= Core VFS Types =============

/**
 * Todo item for task tracking
 */
export interface VFSTodo {
  id: string
  task: string
  priority: 'low' | 'medium' | 'high'
  status: 'pending' | 'in_progress' | 'completed'
  assignee?: string
  due?: string
}

/**
 * VFS-specific metadata that extends entity metadata
 * This is what makes a Brainy entity a "file" or "directory"
 */
export interface VFSMetadata {
  // Filesystem essentials
  path: string                    // Full absolute path
  name: string                    // Filename or directory name
  parent?: string                 // Parent directory entity ID
  vfsType: 'file' | 'directory' | 'symlink'

  // File attributes
  size: number                    // Size in bytes (0 for directories)
  mimeType?: string              // MIME type for files
  extension?: string             // File extension

  // Permissions (POSIX-style)
  permissions: number            // e.g., 0o755
  owner: string                  // Owner ID
  group: string                  // Group ID

  // Timestamps
  accessed: number               // Last access timestamp (ms)
  modified: number               // Last modification timestamp (ms)

  // Content storage strategy
  storage?: {
    type: 'inline' | 'reference' | 'chunked'
    key?: string                 // S3/storage key for reference type
    chunks?: string[]            // Chunk keys for chunked type
    compressed?: boolean         // Whether content is compressed
  }

  // Extended attributes
  attributes?: Record<string, any>  // User-defined attributes
  rawData?: string                  // Base64 encoded raw file content (for small files)

  // Semantic enhancements (optional but powerful)
  tags?: string[]                // User or auto-generated tags
  concepts?: Array<{
    name: string
    confidence: number
  }>
  todos?: VFSTodo[]
  dependencies?: string[]        // For code files - what they import
  exports?: string[]             // For code files - what they export
  language?: string              // Programming language or human language

  // Extended metadata for various file types
  lineCount?: number
  wordCount?: number
  charset?: string
  hash?: string
  symlinkTarget?: string
}

/**
 * Complete VFS Entity - a file or directory in the virtual filesystem
 */
export interface VFSEntity extends Entity<VFSMetadata> {
  // Entity already has: id, vector, type, data, metadata, service, createdAt, updatedAt
  metadata: VFSMetadata          // Override to require VFS metadata

  // For files, data contains the actual content
  // For directories, data is undefined
  data?: Buffer | Uint8Array | string
}

/**
 * File stat information (Node.js fs.Stats compatible)
 */
export interface VFSStats {
  // Core stats
  size: number
  mode: number                   // File mode (permissions)
  uid: number                    // User ID
  gid: number                    // Group ID

  // Timestamps
  atime: Date                    // Access time
  mtime: Date                    // Modification time
  ctime: Date                    // Change time
  birthtime: Date                // Creation time

  // Type checks
  isFile(): boolean
  isDirectory(): boolean
  isSymbolicLink(): boolean

  // Extended VFS stats
  path: string
  entityId: string               // Underlying Brainy entity ID
  vector?: Vector                // Semantic embedding if available
  connections?: number           // Number of relationships
}

/**
 * Directory entry (for readdir)
 */
export interface VFSDirent {
  name: string
  path: string                   // Full path
  type: 'file' | 'directory' | 'symlink'
  entityId: string               // Underlying entity ID
}

/**
 * Error codes matching Node.js fs errors
 */
export enum VFSErrorCode {
  ENOENT = 'ENOENT',            // No such file or directory
  EEXIST = 'EEXIST',            // File exists
  ENOTDIR = 'ENOTDIR',          // Not a directory
  EISDIR = 'EISDIR',            // Is a directory
  ENOTEMPTY = 'ENOTEMPTY',      // Directory not empty
  EACCES = 'EACCES',            // Permission denied
  EINVAL = 'EINVAL',            // Invalid argument
  EMFILE = 'EMFILE',            // Too many open files
  ENOSPC = 'ENOSPC',            // No space left
  EIO = 'EIO',                  // I/O error
  ELOOP = 'ELOOP'               // Too many symbolic links
}

/**
 * VFS-specific error class
 */
export class VFSError extends Error {
  code: VFSErrorCode
  path?: string
  syscall?: string

  constructor(code: VFSErrorCode, message: string, path?: string, syscall?: string) {
    super(message)
    this.name = 'VFSError'
    this.code = code
    this.path = path
    this.syscall = syscall
  }
}

// ============= Operation Options =============

export interface WriteOptions {
  encoding?: BufferEncoding
  mode?: number                  // File permissions
  flag?: string                  // 'w', 'wx', 'w+', etc.

  // VFS-specific options
  generateEmbedding?: boolean    // Auto-generate vector (default: true)
  extractMetadata?: boolean      // Auto-extract metadata (default: true)
  compress?: boolean             // Compress large files (default: auto)
  deduplicate?: boolean          // Check for duplicates (default: false)
  metadata?: Record<string, any> // Additional metadata to attach
}

export interface ReadOptions {
  encoding?: BufferEncoding
  flag?: string                  // 'r', 'r+', etc.

  // VFS-specific options
  cache?: boolean                // Use cache if available (default: true)
  decompress?: boolean           // Auto-decompress (default: true)
}

export interface MkdirOptions {
  recursive?: boolean            // Create parent directories
  mode?: number                  // Directory permissions

  // VFS-specific options
  metadata?: Partial<VFSMetadata>  // Additional metadata
}

export interface ReaddirOptions {
  encoding?: BufferEncoding
  withFileTypes?: boolean        // Return Dirent objects

  // VFS-specific options
  recursive?: boolean            // Include subdirectories
  limit?: number                 // Max results
  offset?: number                // Skip N results
  cursor?: string                // Pagination cursor
  filter?: {
    pattern?: string             // Glob pattern
    type?: 'file' | 'directory'
    minSize?: number
    maxSize?: number
    modifiedAfter?: Date
    modifiedBefore?: Date
  }
  sort?: 'name' | 'size' | 'modified' | 'created'
  order?: 'asc' | 'desc'
}

export interface CopyOptions {
  overwrite?: boolean            // Overwrite existing
  preserveTimestamps?: boolean   // Keep original timestamps

  // VFS-specific options
  preserveVector?: boolean       // Keep original embedding
  preserveRelationships?: boolean // Copy relationships too
  deepCopy?: boolean             // For directories
}

// ============= Search & Semantic Operations =============

export interface SearchOptions {
  // Search scope
  path?: string                  // Search within this path
  recursive?: boolean            // Include subdirectories

  // Search criteria
  type?: 'file' | 'directory' | 'any'
  where?: Record<string, any>   // Metadata filters

  // Result options
  limit?: number
  offset?: number
  includeContent?: boolean      // Include file content in results
  includeVector?: boolean       // Include embeddings
  explain?: boolean             // Include score explanation
}

export interface SimilarOptions {
  limit?: number
  threshold?: number             // Min similarity (0-1)
  type?: 'file' | 'directory' | 'any'
  withinPath?: string           // Restrict to path
}

export interface SearchResult {
  path: string
  entityId: string
  score: number
  type: 'file' | 'directory' | 'symlink'
  size: number
  modified: Date
  explanation?: {
    vectorScore?: number
    metadataScore?: number
    graphScore?: number
  }
}

export interface RelatedOptions {
  depth?: number                 // Traversal depth
  types?: VerbType[]            // Relationship types
  limit?: number
}

// ============= Streaming =============

export interface ReadStreamOptions {
  encoding?: BufferEncoding
  start?: number                 // Start byte
  end?: number                   // End byte
  highWaterMark?: number         // Buffer size
}

export interface WriteStreamOptions {
  encoding?: BufferEncoding
  mode?: number
  autoClose?: boolean
  emitClose?: boolean
}

// ============= Watch =============

export interface WatchOptions {
  persistent?: boolean
  recursive?: boolean
  encoding?: BufferEncoding
}

export type WatchEventType = 'rename' | 'change' | 'error'

export interface WatchListener {
  (eventType: WatchEventType, filename: string | null): void
}

// ============= VFS Configuration =============

export interface VFSConfig {
  // Root configuration
  root?: string                  // Root path (default: '/')
  rootEntityId?: string         // Existing root entity ID

  // Performance options
  cache?: {
    enabled?: boolean
    maxPaths?: number           // Max cached paths
    maxContent?: number         // Max cached file content (bytes)
    ttl?: number                // Cache TTL in ms
  }

  // Storage options
  storage?: {
    inline?: {
      maxSize?: number          // Max size for inline storage (default: 100KB)
    }
    chunking?: {
      enabled?: boolean
      chunkSize?: number        // Chunk size in bytes (default: 5MB)
      parallel?: number         // Parallel chunk operations
    }
    compression?: {
      enabled?: boolean
      minSize?: number          // Min size to compress (default: 10KB)
      algorithm?: 'gzip' | 'brotli' | 'zstd'
    }
  }

  // Intelligence options
  intelligence?: {
    enabled?: boolean           // Enable AI features
    autoEmbed?: boolean         // Auto-generate embeddings
    autoExtract?: boolean       // Auto-extract metadata
    autoTag?: boolean           // Auto-generate tags
    autoConcepts?: boolean      // Auto-detect concepts
  }

  // Knowledge Layer - Optional revolutionary enhancement!
  knowledgeLayer?: {
    enabled?: boolean           // Enable Knowledge Layer features
    eventRecording?: boolean    // Track all file operations
    semanticVersioning?: boolean // Smart versioning based on meaning
    persistentEntities?: boolean // Track evolving entities
    concepts?: boolean          // Universal concept system
    gitBridge?: boolean        // Git import/export support
  }

  // Permissions
  permissions?: {
    defaultFile?: number        // Default file permissions (0o644)
    defaultDirectory?: number   // Default dir permissions (0o755)
    umask?: number             // Permission mask
  }

  // Limits
  limits?: {
    maxFileSize?: number        // Max file size in bytes
    maxPathLength?: number      // Max path length
    maxDirectoryEntries?: number // Max files per directory
  }
}

// ============= Main VFS Interface =============

export interface IVirtualFileSystem {
  // Initialization
  init(config?: VFSConfig): Promise<void>
  close(): Promise<void>

  // File operations
  readFile(path: string, options?: ReadOptions): Promise<Buffer>
  writeFile(path: string, data: Buffer | string, options?: WriteOptions): Promise<void>
  appendFile(path: string, data: Buffer | string, options?: WriteOptions): Promise<void>
  unlink(path: string): Promise<void>

  // Directory operations
  mkdir(path: string, options?: MkdirOptions): Promise<void>
  rmdir(path: string, options?: { recursive?: boolean }): Promise<void>
  readdir(path: string, options?: ReaddirOptions): Promise<string[] | VFSDirent[]>

  // Tree operations (NEW - prevents recursion issues)
  getDirectChildren(path: string): Promise<VFSEntity[]>
  getTreeStructure(path: string, options?: {
    maxDepth?: number
    includeHidden?: boolean
    sort?: 'name' | 'modified' | 'size'
  }): Promise<any>
  getDescendants(path: string, options?: {
    includeAncestor?: boolean
    type?: 'file' | 'directory'
  }): Promise<VFSEntity[]>
  inspect(path: string): Promise<{
    node: VFSEntity
    children: VFSEntity[]
    parent: VFSEntity | null
    stats: VFSStats
  }>

  // Metadata operations
  stat(path: string): Promise<VFSStats>
  lstat(path: string): Promise<VFSStats>
  exists(path: string): Promise<boolean>
  chmod(path: string, mode: number): Promise<void>
  chown(path: string, uid: number, gid: number): Promise<void>
  utimes(path: string, atime: Date, mtime: Date): Promise<void>

  // Path operations
  rename(oldPath: string, newPath: string): Promise<void>
  copy(src: string, dest: string, options?: CopyOptions): Promise<void>
  move(src: string, dest: string): Promise<void>
  symlink(target: string, path: string): Promise<void>
  readlink(path: string): Promise<string>
  realpath(path: string): Promise<string>

  // Extended attributes
  getxattr(path: string, name: string): Promise<any>
  setxattr(path: string, name: string, value: any): Promise<void>
  listxattr(path: string): Promise<string[]>
  removexattr(path: string, name: string): Promise<void>

  // Semantic operations
  search(query: string, options?: SearchOptions): Promise<SearchResult[]>
  findSimilar(path: string, options?: SimilarOptions): Promise<SearchResult[]>
  getRelated(path: string, options?: RelatedOptions): Promise<Array<{
    path: string
    relationship: string
    direction: 'from' | 'to'
  }>>

  // Relationships
  addRelationship(from: string, to: string, type: string): Promise<void>
  removeRelationship(from: string, to: string, type?: string): Promise<void>
  getRelationships(path: string): Promise<Relation[]>

  // Todos and metadata
  getTodos(path: string): Promise<VFSTodo[] | undefined>
  setTodos(path: string, todos: VFSTodo[]): Promise<void>
  addTodo(path: string, todo: VFSTodo): Promise<void>
  getMetadata(path: string): Promise<VFSMetadata | undefined>
  setMetadata(path: string, metadata: Partial<VFSMetadata>): Promise<void>

  // Streaming (returns Node.js compatible streams)
  createReadStream(path: string, options?: ReadStreamOptions): NodeJS.ReadableStream
  createWriteStream(path: string, options?: WriteStreamOptions): NodeJS.WritableStream

  // Watching
  watch(path: string, listener: WatchListener): { close(): void }
  watchFile(path: string, listener: WatchListener): void
  unwatchFile(path: string): void

  // Utility
  getEntity(path: string): Promise<VFSEntity>
  getEntityById(id: string): Promise<VFSEntity>
  resolvePath(path: string, from?: string): Promise<string>
}

// Export utility type guards
export function isFile(stats: VFSStats): boolean {
  return stats.isFile()
}

export function isDirectory(stats: VFSStats): boolean {
  return stats.isDirectory()
}

export function isSymlink(stats: VFSStats): boolean {
  return stats.isSymbolicLink()
}