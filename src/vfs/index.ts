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

// fs compatibility layer
export { FSCompat, createFS } from './FSCompat.js'

// Directory import
export { DirectoryImporter } from './importers/DirectoryImporter.js'

// Streaming
export { VFSReadStream } from './streams/VFSReadStream.js'
export { VFSWriteStream } from './streams/VFSWriteStream.js'

// Knowledge Layer Components (optional via augmentation)
export { EventRecorder } from './EventRecorder.js'
export { SemanticVersioning } from './SemanticVersioning.js'
export { PersistentEntitySystem } from './PersistentEntitySystem.js'
export { ConceptSystem } from './ConceptSystem.js'
export { GitBridge } from './GitBridge.js'

// Convenience alias
export { VirtualFileSystem as VFS } from './VirtualFileSystem.js'