/**
 * Brainy Virtual Filesystem
 *
 * A simplified fs-compatible filesystem that stores data in Brainy
 * Works across all storage adapters and scales to millions of files
 */

// Core VFS
export { VirtualFileSystem } from './VirtualFileSystem.js'
export { PathResolver } from './PathResolver.js'
export * from './types.js'

// MIME Type Detection
export { MimeTypeDetector, mimeDetector } from './MimeTypeDetector.js'

// fs compatibility layer
export { FSCompat, createFS } from './FSCompat.js'

// Directory import
export { DirectoryImporter } from './importers/DirectoryImporter.js'

// Streaming
export { VFSReadStream } from './streams/VFSReadStream.js'
export { VFSWriteStream } from './streams/VFSWriteStream.js'

// Convenience alias
export { VirtualFileSystem as VFS } from './VirtualFileSystem.js'