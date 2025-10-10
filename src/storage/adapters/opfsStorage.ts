/**
 * OPFS (Origin Private File System) Storage Adapter
 * Provides persistent storage for the vector database using the Origin Private File System API
 */

import {
  GraphVerb,
  HNSWNoun,
  HNSWVerb,
  StatisticsData
} from '../../coreTypes.js'
import {
  BaseStorage,
  NOUNS_DIR,
  VERBS_DIR,
  METADATA_DIR,
  NOUN_METADATA_DIR,
  VERB_METADATA_DIR,
  INDEX_DIR,
  STATISTICS_KEY
} from '../baseStorage.js'
import { getShardIdFromUuid } from '../sharding.js'
import '../../types/fileSystemTypes.js'

// Type alias for HNSWNode
type HNSWNode = HNSWNoun

/**
 * Type alias for HNSWVerb to make the code more readable
 */
type Edge = HNSWVerb

/**
 * Helper function to safely get a file from a FileSystemHandle
 * This is needed because TypeScript doesn't recognize that a FileSystemHandle
 * can be a FileSystemFileHandle which has the getFile method
 */
async function safeGetFile(handle: FileSystemHandle): Promise<File> {
  // Type cast to any to avoid TypeScript error
  return (handle as any).getFile()
}

// Type aliases for better readability
type HNSWNoun_internal = HNSWNoun
type Verb = GraphVerb

// Root directory name for OPFS storage
const ROOT_DIR = 'opfs-vector-db'

/**
 * OPFS storage adapter for browser environments
 * Uses the Origin Private File System API to store data persistently
 */
export class OPFSStorage extends BaseStorage {
  private rootDir: FileSystemDirectoryHandle | null = null
  private nounsDir: FileSystemDirectoryHandle | null = null
  private verbsDir: FileSystemDirectoryHandle | null = null
  private metadataDir: FileSystemDirectoryHandle | null = null
  private nounMetadataDir: FileSystemDirectoryHandle | null = null
  private verbMetadataDir: FileSystemDirectoryHandle | null = null
  private indexDir: FileSystemDirectoryHandle | null = null
  private isAvailable = false
  private isPersistentRequested = false
  private isPersistentGranted = false
  private statistics: StatisticsData | null = null
  private activeLocks: Set<string> = new Set()
  private lockPrefix = 'opfs-lock-'

  constructor() {
    super()
    // Check if OPFS is available
    this.isAvailable =
      typeof navigator !== 'undefined' &&
      'storage' in navigator &&
      'getDirectory' in navigator.storage
  }

  /**
   * Initialize the storage adapter
   */
  public async init(): Promise<void> {
    if (this.isInitialized) {
      return
    }

    if (!this.isAvailable) {
      throw new Error(
        'Origin Private File System is not available in this environment'
      )
    }

    try {
      // Get the root directory
      const root = await navigator.storage.getDirectory()

      // Create or get our app's root directory
      this.rootDir = await root.getDirectoryHandle(ROOT_DIR, { create: true })

      // Create or get nouns directory
      this.nounsDir = await this.rootDir.getDirectoryHandle(NOUNS_DIR, {
        create: true
      })

      // Create or get verbs directory
      this.verbsDir = await this.rootDir.getDirectoryHandle(VERBS_DIR, {
        create: true
      })

      // Create or get metadata directory
      this.metadataDir = await this.rootDir.getDirectoryHandle(METADATA_DIR, {
        create: true
      })

      // Create or get noun metadata directory
      this.nounMetadataDir = await this.rootDir.getDirectoryHandle(
        NOUN_METADATA_DIR,
        {
          create: true
        }
      )

      // Create or get verb metadata directory
      this.verbMetadataDir = await this.rootDir.getDirectoryHandle(
        VERB_METADATA_DIR,
        {
          create: true
        }
      )

      // Create or get index directory
      this.indexDir = await this.rootDir.getDirectoryHandle(INDEX_DIR, {
        create: true
      })

      // Initialize counts from storage
      await this.initializeCounts()

      this.isInitialized = true
    } catch (error) {
      console.error('Failed to initialize OPFS storage:', error)
      throw new Error(`Failed to initialize OPFS storage: ${error}`)
    }
  }

  /**
   * Check if OPFS is available in the current environment
   */
  public isOPFSAvailable(): boolean {
    return this.isAvailable
  }

  /**
   * Request persistent storage permission from the user
   * @returns Promise that resolves to true if permission was granted, false otherwise
   */
  public async requestPersistentStorage(): Promise<boolean> {
    if (!this.isAvailable) {
      console.warn('Cannot request persistent storage: OPFS is not available')
      return false
    }

    try {
      // Check if persistence is already granted
      this.isPersistentGranted = await navigator.storage.persisted()

      if (!this.isPersistentGranted) {
        // Request permission for persistent storage
        this.isPersistentGranted = await navigator.storage.persist()
      }

      this.isPersistentRequested = true
      return this.isPersistentGranted
    } catch (error) {
      console.warn('Failed to request persistent storage:', error)
      return false
    }
  }

  /**
   * Check if persistent storage is granted
   * @returns Promise that resolves to true if persistent storage is granted, false otherwise
   */
  public async isPersistent(): Promise<boolean> {
    if (!this.isAvailable) {
      return false
    }

    try {
      this.isPersistentGranted = await navigator.storage.persisted()
      return this.isPersistentGranted
    } catch (error) {
      console.warn('Failed to check persistent storage status:', error)
      return false
    }
  }

  /**
   * Save a noun to storage
   */
  protected async saveNoun_internal(noun: HNSWNoun_internal): Promise<void> {
    await this.ensureInitialized()

    try {
      // Convert connections Map to a serializable format
      const serializableNoun = {
        ...noun,
        connections: this.mapToObject(noun.connections, (set) =>
          Array.from(set as Set<string>)
        )
      }

      // Use UUID-based sharding for nouns
      const shardId = getShardIdFromUuid(noun.id)

      // Get or create the shard directory
      const shardDir = await this.nounsDir!.getDirectoryHandle(shardId, {
        create: true
      })

      // Create or get the file in the shard directory
      const fileHandle = await shardDir.getFileHandle(`${noun.id}.json`, {
        create: true
      })

      // Write the noun data to the file
      const writable = await fileHandle.createWritable()
      await writable.write(JSON.stringify(serializableNoun))
      await writable.close()
    } catch (error) {
      console.error(`Failed to save noun ${noun.id}:`, error)
      throw new Error(`Failed to save noun ${noun.id}: ${error}`)
    }
  }

  /**
   * Get a noun from storage
   */
  protected async getNoun_internal(
    id: string
  ): Promise<HNSWNoun_internal | null> {
    await this.ensureInitialized()

    try {
      // Use UUID-based sharding for nouns
      const shardId = getShardIdFromUuid(id)

      // Get the shard directory
      const shardDir = await this.nounsDir!.getDirectoryHandle(shardId)

      // Get the file handle from the shard directory
      const fileHandle = await shardDir.getFileHandle(`${id}.json`)

      // Read the noun data from the file
      const file = await fileHandle.getFile()
      const text = await file.text()
      const data = JSON.parse(text)

      // Convert serialized connections back to Map<number, Set<string>>
      const connections = new Map<number, Set<string>>()
      for (const [level, nounIds] of Object.entries(data.connections)) {
        connections.set(Number(level), new Set(nounIds as string[]))
      }

      return {
        id: data.id,
        vector: data.vector,
        connections,
        level: data.level || 0
      }
    } catch (error) {
      // Noun not found or other error
      return null
    }
  }


  /**
   * Get nouns by noun type (internal implementation)
   * @param nounType The noun type to filter by
   * @returns Promise that resolves to an array of nouns of the specified noun type
   */
  protected async getNounsByNounType_internal(
    nounType: string
  ): Promise<HNSWNoun[]> {
    return this.getNodesByNounType(nounType)
  }

  /**
   * Get nodes by noun type
   * @param nounType The noun type to filter by
   * @returns Promise that resolves to an array of nodes of the specified noun type
   */
  protected async getNodesByNounType(nounType: string): Promise<HNSWNode[]> {
    await this.ensureInitialized()

    const nodes: HNSWNode[] = []

    try {
      // Iterate through all shard directories
      for await (const [shardName, shardHandle] of this.nounsDir!.entries()) {
        if (shardHandle.kind === 'directory') {
          const shardDir = shardHandle as FileSystemDirectoryHandle

          // Iterate through all files in this shard
          for await (const [fileName, fileHandle] of shardDir.entries()) {
            if (fileHandle.kind === 'file') {
              try {
                // Read the node data from the file
                const file = await safeGetFile(fileHandle)
                const text = await file.text()
                const data = JSON.parse(text)

                // Get the metadata to check the noun type
                const metadata = await this.getMetadata(data.id)

                // Include the node if its noun type matches the requested type
                if (metadata && metadata.noun === nounType) {
                  // Convert serialized connections back to Map<number, Set<string>>
                  const connections = new Map<number, Set<string>>()
                  for (const [level, nodeIds] of Object.entries(data.connections)) {
                    connections.set(Number(level), new Set(nodeIds as string[]))
                  }

                  nodes.push({
                    id: data.id,
                    vector: data.vector,
                    connections,
                    level: data.level || 0
                  })
                }
              } catch (error) {
                console.error(`Error reading node file ${shardName}/${fileName}:`, error)
              }
            }
          }
        }
      }
    } catch (error) {
      console.error('Error reading nouns directory:', error)
    }

    return nodes
  }

  /**
   * Delete a noun from storage (internal implementation)
   */
  protected async deleteNoun_internal(id: string): Promise<void> {
    return this.deleteNode(id)
  }

  /**
   * Delete a node from storage
   */
  protected async deleteNode(id: string): Promise<void> {
    await this.ensureInitialized()

    try {
      // Use UUID-based sharding for nouns
      const shardId = getShardIdFromUuid(id)

      // Get the shard directory
      const shardDir = await this.nounsDir!.getDirectoryHandle(shardId)

      // Delete the file from the shard directory
      await shardDir.removeEntry(`${id}.json`)
    } catch (error: any) {
      // Ignore NotFoundError, which means the file doesn't exist
      if (error.name !== 'NotFoundError') {
        console.error(`Error deleting node ${id}:`, error)
        throw error
      }
    }
  }

  /**
   * Save a verb to storage (internal implementation)
   */
  protected async saveVerb_internal(verb: HNSWVerb): Promise<void> {
    return this.saveEdge(verb)
  }

  /**
   * Save an edge to storage
   */
  protected async saveEdge(edge: Edge): Promise<void> {
    await this.ensureInitialized()

    try {
      // Convert connections Map to a serializable format
      const serializableEdge = {
        ...edge,
        connections: this.mapToObject(edge.connections, (set) =>
          Array.from(set as Set<string>)
        )
      }

      // Use UUID-based sharding for verbs
      const shardId = getShardIdFromUuid(edge.id)

      // Get or create the shard directory
      const shardDir = await this.verbsDir!.getDirectoryHandle(shardId, {
        create: true
      })

      // Create or get the file in the shard directory
      const fileHandle = await shardDir.getFileHandle(`${edge.id}.json`, {
        create: true
      })

      // Write the verb data to the file
      const writable = await fileHandle.createWritable()
      await writable.write(JSON.stringify(serializableEdge))
      await writable.close()
    } catch (error) {
      console.error(`Failed to save edge ${edge.id}:`, error)
      throw new Error(`Failed to save edge ${edge.id}: ${error}`)
    }
  }

  /**
   * Get a verb from storage (internal implementation)
   */
  protected async getVerb_internal(id: string): Promise<HNSWVerb | null> {
    return this.getEdge(id)
  }

  /**
   * Get an edge from storage
   */
  protected async getEdge(id: string): Promise<Edge | null> {
    await this.ensureInitialized()

    try {
      // Use UUID-based sharding for verbs
      const shardId = getShardIdFromUuid(id)

      // Get the shard directory
      const shardDir = await this.verbsDir!.getDirectoryHandle(shardId)

      // Get the file handle from the shard directory
      const fileHandle = await shardDir.getFileHandle(`${id}.json`)

      // Read the edge data from the file
      const file = await fileHandle.getFile()
      const text = await file.text()
      const data = JSON.parse(text)

      // Convert serialized connections back to Map<number, Set<string>>
      const connections = new Map<number, Set<string>>()
      for (const [level, nodeIds] of Object.entries(data.connections)) {
        connections.set(Number(level), new Set(nodeIds as string[]))
      }

      // Create default timestamp if not present
      const defaultTimestamp = {
        seconds: Math.floor(Date.now() / 1000),
        nanoseconds: (Date.now() % 1000) * 1000000
      }

      // Create default createdBy if not present
      const defaultCreatedBy = {
        augmentation: 'unknown',
        version: '1.0'
      }

      return {
        id: data.id,
        vector: data.vector,
        connections
      }
    } catch (error) {
      // Edge not found or other error
      return null
    }
  }


  /**
   * Get all edges from storage
   */
  protected async getAllEdges(): Promise<Edge[]> {
    await this.ensureInitialized()

    const allEdges: Edge[] = []
    try {
      // Iterate through all shard directories
      for await (const [shardName, shardHandle] of this.verbsDir!.entries()) {
        if (shardHandle.kind === 'directory') {
          const shardDir = shardHandle as FileSystemDirectoryHandle

          // Iterate through all files in this shard
          for await (const [fileName, fileHandle] of shardDir.entries()) {
            if (fileHandle.kind === 'file') {
              try {
                // Read the edge data from the file
                const file = await safeGetFile(fileHandle)
                const text = await file.text()
                const data = JSON.parse(text)

                // Convert serialized connections back to Map<number, Set<string>>
                const connections = new Map<number, Set<string>>()
                for (const [level, nodeIds] of Object.entries(data.connections)) {
                  connections.set(Number(level), new Set(nodeIds as string[]))
                }

                // Create default timestamp if not present
                const defaultTimestamp = {
                  seconds: Math.floor(Date.now() / 1000),
                  nanoseconds: (Date.now() % 1000) * 1000000
                }

                // Create default createdBy if not present
                const defaultCreatedBy = {
                  augmentation: 'unknown',
                  version: '1.0'
                }

                allEdges.push({
                  id: data.id,
                  vector: data.vector,
                  connections
                })
              } catch (error) {
                console.error(`Error reading edge file ${shardName}/${fileName}:`, error)
              }
            }
          }
        }
      }
    } catch (error) {
      console.error('Error reading verbs directory:', error)
    }

    return allEdges
  }

  /**
   * Get verbs by source (internal implementation)
   */
  protected async getVerbsBySource_internal(
    sourceId: string
  ): Promise<GraphVerb[]> {
    // Use the paginated approach to properly handle HNSWVerb to GraphVerb conversion
    const result = await this.getVerbsWithPagination({
      filter: { sourceId: [sourceId] },
      limit: Number.MAX_SAFE_INTEGER // Get all matching results
    })
    return result.items
  }

  /**
   * Get edges by source
   */
  protected async getEdgesBySource(sourceId: string): Promise<GraphVerb[]> {
    // This method is deprecated and would require loading metadata for each edge
    // For now, return empty array since this is not efficiently implementable with new storage pattern
    console.warn(
      'getEdgesBySource is deprecated and not efficiently supported in new storage pattern'
    )
    return []
  }

  /**
   * Get verbs by target (internal implementation)
   */
  protected async getVerbsByTarget_internal(
    targetId: string
  ): Promise<GraphVerb[]> {
    // Use the paginated approach to properly handle HNSWVerb to GraphVerb conversion
    const result = await this.getVerbsWithPagination({
      filter: { targetId: [targetId] },
      limit: Number.MAX_SAFE_INTEGER // Get all matching results
    })
    return result.items
  }

  /**
   * Get edges by target
   */
  protected async getEdgesByTarget(targetId: string): Promise<GraphVerb[]> {
    // This method is deprecated and would require loading metadata for each edge
    // For now, return empty array since this is not efficiently implementable with new storage pattern
    console.warn(
      'getEdgesByTarget is deprecated and not efficiently supported in new storage pattern'
    )
    return []
  }

  /**
   * Get verbs by type (internal implementation)
   */
  protected async getVerbsByType_internal(type: string): Promise<GraphVerb[]> {
    // Use the paginated approach to properly handle HNSWVerb to GraphVerb conversion
    const result = await this.getVerbsWithPagination({
      filter: { verbType: [type] },
      limit: Number.MAX_SAFE_INTEGER // Get all matching results
    })
    return result.items
  }

  /**
   * Get edges by type
   */
  protected async getEdgesByType(type: string): Promise<GraphVerb[]> {
    // This method is deprecated and would require loading metadata for each edge
    // For now, return empty array since this is not efficiently implementable with new storage pattern
    console.warn(
      'getEdgesByType is deprecated and not efficiently supported in new storage pattern'
    )
    return []
  }

  /**
   * Delete a verb from storage (internal implementation)
   */
  protected async deleteVerb_internal(id: string): Promise<void> {
    return this.deleteEdge(id)
  }

  /**
   * Delete an edge from storage
   */
  protected async deleteEdge(id: string): Promise<void> {
    await this.ensureInitialized()

    try {
      // Use UUID-based sharding for verbs
      const shardId = getShardIdFromUuid(id)

      // Get the shard directory
      const shardDir = await this.verbsDir!.getDirectoryHandle(shardId)

      // Delete the file from the shard directory
      await shardDir.removeEntry(`${id}.json`)
    } catch (error: any) {
      // Ignore NotFoundError, which means the file doesn't exist
      if (error.name !== 'NotFoundError') {
        console.error(`Error deleting edge ${id}:`, error)
        throw error
      }
    }
  }

  /**
   * Primitive operation: Write object to path
   * All metadata operations use this internally via base class routing
   */
  protected async writeObjectToPath(path: string, data: any): Promise<void> {
    await this.ensureInitialized()

    try {
      // Parse path to get directory structure and filename
      // Path format: "dir1/dir2/file.json"
      const parts = path.split('/')
      const filename = parts.pop()!

      // Navigate to the correct directory, creating as needed
      let currentDir = this.rootDir!
      for (const dirName of parts) {
        currentDir = await currentDir.getDirectoryHandle(dirName, { create: true })
      }

      // Create or get the file
      const fileHandle = await currentDir.getFileHandle(filename, { create: true })

      // Write the data to the file
      const writable = await fileHandle.createWritable()
      await writable.write(JSON.stringify(data, null, 2))
      await writable.close()
    } catch (error) {
      console.error(`Failed to write object to ${path}:`, error)
      throw new Error(`Failed to write object to ${path}: ${error}`)
    }
  }

  /**
   * Primitive operation: Read object from path
   * All metadata operations use this internally via base class routing
   */
  protected async readObjectFromPath(path: string): Promise<any | null> {
    await this.ensureInitialized()

    try {
      // Parse path to get directory structure and filename
      const parts = path.split('/')
      const filename = parts.pop()!

      // Navigate to the correct directory
      let currentDir = this.rootDir!
      for (const dirName of parts) {
        currentDir = await currentDir.getDirectoryHandle(dirName)
      }

      // Get the file handle
      const fileHandle = await currentDir.getFileHandle(filename)

      // Read the data from the file
      const file = await fileHandle.getFile()
      const text = await file.text()
      return JSON.parse(text)
    } catch (error: any) {
      // NotFoundError means object doesn't exist
      if (error.name === 'NotFoundError') {
        return null
      }
      console.error(`Failed to read object from ${path}:`, error)
      return null
    }
  }

  /**
   * Primitive operation: Delete object from path
   * All metadata operations use this internally via base class routing
   */
  protected async deleteObjectFromPath(path: string): Promise<void> {
    await this.ensureInitialized()

    try {
      // Parse path to get directory structure and filename
      const parts = path.split('/')
      const filename = parts.pop()!

      // Navigate to the correct directory
      let currentDir = this.rootDir!
      for (const dirName of parts) {
        currentDir = await currentDir.getDirectoryHandle(dirName)
      }

      // Delete the file
      await currentDir.removeEntry(filename)
    } catch (error: any) {
      // NotFoundError is ok (already deleted)
      if (error.name === 'NotFoundError') {
        return
      }
      console.error(`Failed to delete object from ${path}:`, error)
      throw new Error(`Failed to delete object from ${path}: ${error}`)
    }
  }

  /**
   * Primitive operation: List objects under path prefix
   * All metadata operations use this internally via base class routing
   */
  protected async listObjectsUnderPath(prefix: string): Promise<string[]> {
    await this.ensureInitialized()

    try {
      const paths: string[] = []

      // Parse prefix to get directory structure
      const parts = prefix.split('/')

      // Navigate to the directory
      let currentDir = this.rootDir!
      for (const dirName of parts) {
        if (dirName) {
          currentDir = await currentDir.getDirectoryHandle(dirName)
        }
      }

      // Recursively list all files
      const listFiles = async (dir: FileSystemDirectoryHandle, pathPrefix: string): Promise<void> => {
        for await (const [name, handle] of dir.entries()) {
          const fullPath = pathPrefix ? `${pathPrefix}/${name}` : name

          if (handle.kind === 'file') {
            paths.push(`${prefix}${fullPath}`)
          } else if (handle.kind === 'directory') {
            await listFiles(handle as FileSystemDirectoryHandle, fullPath)
          }
        }
      }

      await listFiles(currentDir, '')

      return paths
    } catch (error: any) {
      // NotFoundError means directory doesn't exist
      if (error.name === 'NotFoundError') {
        return []
      }
      console.error(`Failed to list objects under ${prefix}:`, error)
      throw new Error(`Failed to list objects under ${prefix}: ${error}`)
    }
  }

  /**
   * Get multiple metadata objects in batches (CRITICAL: Prevents socket exhaustion)
   * OPFS implementation uses controlled concurrency for file operations
   */
  public async getMetadataBatch(ids: string[]): Promise<Map<string, any>> {
    await this.ensureInitialized()

    const results = new Map<string, any>()
    const batchSize = 10 // Process 10 files at a time

    // Process in batches to avoid overwhelming OPFS
    for (let i = 0; i < ids.length; i += batchSize) {
      const batch = ids.slice(i, i + batchSize)

      const batchPromises = batch.map(async (id) => {
        try {
          const metadata = await this.getNounMetadata(id)
          return { id, metadata }
        } catch (error) {
          console.debug(`Failed to read metadata for ${id}:`, error)
          return { id, metadata: null }
        }
      })

      const batchResults = await Promise.all(batchPromises)

      for (const { id, metadata } of batchResults) {
        if (metadata !== null) {
          results.set(id, metadata)
        }
      }

      // Small yield between batches
      await new Promise(resolve => setImmediate(resolve))
    }

    return results
  }


  /**
   * Clear all data from storage
   */
  public async clear(): Promise<void> {
    await this.ensureInitialized()

    // Helper function to remove all files in a directory
    const removeDirectoryContents = async (
      dirHandle: FileSystemDirectoryHandle
    ): Promise<void> => {
      try {
        for await (const [name, handle] of dirHandle.entries()) {
          // Use recursive option to handle directories that may contain files
          await dirHandle.removeEntry(name, { recursive: true })
        }
      } catch (error) {
        console.error(`Error removing directory contents:`, error)
        throw error
      }
    }

    try {
      // Remove all files in the nouns directory
      await removeDirectoryContents(this.nounsDir!)

      // Remove all files in the verbs directory
      await removeDirectoryContents(this.verbsDir!)

      // Remove all files in the metadata directory
      await removeDirectoryContents(this.metadataDir!)

      // Remove all files in the noun metadata directory
      await removeDirectoryContents(this.nounMetadataDir!)

      // Remove all files in the verb metadata directory
      await removeDirectoryContents(this.verbMetadataDir!)

      // Remove all files in the index directory
      await removeDirectoryContents(this.indexDir!)

      // Clear the statistics cache
      this.statisticsCache = null
      this.statisticsModified = false
    } catch (error) {
      console.error('Error clearing storage:', error)
      throw error
    }
  }

  /**
   * Get information about storage usage and capacity
   */
  public async getStorageStatus(): Promise<{
    type: string
    used: number
    quota: number | null
    details?: Record<string, any>
  }> {
    await this.ensureInitialized()

    try {
      // Calculate the total size of all files in the storage directories
      let totalSize = 0

      // Helper function to calculate directory size
      const calculateDirSize = async (
        dirHandle: FileSystemDirectoryHandle
      ): Promise<number> => {
        let size = 0
        try {
          for await (const [name, handle] of dirHandle.entries()) {
            if (handle.kind === 'file') {
              const file = await (handle as FileSystemFileHandle).getFile()
              size += file.size
            } else if (handle.kind === 'directory') {
              size += await calculateDirSize(
                handle as FileSystemDirectoryHandle
              )
            }
          }
        } catch (error) {
          console.warn(`Error calculating size for directory:`, error)
        }
        return size
      }

      // Helper function to count files in a directory
      const countFilesInDirectory = async (
        dirHandle: FileSystemDirectoryHandle
      ): Promise<number> => {
        let count = 0
        try {
          for await (const [name, handle] of dirHandle.entries()) {
            if (handle.kind === 'file') {
              count++
            }
          }
        } catch (error) {
          console.warn(`Error counting files in directory:`, error)
        }
        return count
      }

      // Calculate size for each directory
      if (this.nounsDir) {
        totalSize += await calculateDirSize(this.nounsDir)
      }
      if (this.verbsDir) {
        totalSize += await calculateDirSize(this.verbsDir)
      }
      if (this.metadataDir) {
        totalSize += await calculateDirSize(this.metadataDir)
      }
      if (this.indexDir) {
        totalSize += await calculateDirSize(this.indexDir)
      }

      // Get storage quota information using the Storage API
      let quota = null
      let details: Record<string, any> = {
        isPersistent: await this.isPersistent(),
        nounTypes: {}
      }

      try {
        if (navigator.storage && navigator.storage.estimate) {
          const estimate = await navigator.storage.estimate()
          quota = estimate.quota || null
          details = {
            ...details,
            usage: estimate.usage,
            quota: estimate.quota,
            freePercentage: estimate.quota
              ? ((estimate.quota - (estimate.usage || 0)) / estimate.quota) *
                100
              : null
          }
        }
      } catch (error) {
        console.warn('Unable to get storage estimate:', error)
      }

      // Count files in each directory
      if (this.nounsDir) {
        details.nounsCount = await countFilesInDirectory(this.nounsDir)
      }
      if (this.verbsDir) {
        details.verbsCount = await countFilesInDirectory(this.verbsDir)
      }
      if (this.metadataDir) {
        details.metadataCount = await countFilesInDirectory(this.metadataDir)
      }

      // Count nouns by type using metadata
      const nounTypeCounts: Record<string, number> = {}
      if (this.metadataDir) {
        for await (const [name, handle] of this.metadataDir.entries()) {
          if (handle.kind === 'file') {
            try {
              const file = await safeGetFile(handle)
              const text = await file.text()
              const metadata = JSON.parse(text)
              if (metadata.noun) {
                nounTypeCounts[metadata.noun] =
                  (nounTypeCounts[metadata.noun] || 0) + 1
              }
            } catch (error) {
              console.error(`Error reading metadata file ${name}:`, error)
            }
          }
        }
      }
      details.nounTypes = nounTypeCounts

      return {
        type: 'opfs',
        used: totalSize,
        quota,
        details
      }
    } catch (error) {
      console.error('Failed to get storage status:', error)
      return {
        type: 'opfs',
        used: 0,
        quota: null,
        details: { error: String(error) }
      }
    }
  }

  /**
   * Get the statistics key for a specific date
   * @param date The date to get the key for
   * @returns The statistics key for the specified date
   */
  private getStatisticsKeyForDate(date: Date): string {
    const year = date.getUTCFullYear()
    const month = String(date.getUTCMonth() + 1).padStart(2, '0')
    const day = String(date.getUTCDate()).padStart(2, '0')
    return `statistics_${year}${month}${day}.json`
  }

  /**
   * Get the current statistics key
   * @returns The current statistics key
   */
  private getCurrentStatisticsKey(): string {
    return this.getStatisticsKeyForDate(new Date())
  }

  /**
   * Get the legacy statistics key (for backward compatibility)
   * @returns The legacy statistics key
   */
  private getLegacyStatisticsKey(): string {
    return 'statistics.json'
  }

  /**
   * Acquire a browser-based lock for coordinating operations across multiple tabs
   * @param lockKey The key to lock on
   * @param ttl Time to live for the lock in milliseconds (default: 30 seconds)
   * @returns Promise that resolves to true if lock was acquired, false otherwise
   */
  private async acquireLock(
    lockKey: string,
    ttl: number = 30000
  ): Promise<boolean> {
    if (typeof localStorage === 'undefined') {
      console.warn('localStorage not available, proceeding without lock')
      return false
    }

    const lockStorageKey = `${this.lockPrefix}${lockKey}`
    const lockValue = `${Date.now()}_${Math.random()}_${window.location.href}`
    const expiresAt = Date.now() + ttl

    try {
      // Check if lock already exists and is still valid
      const existingLock = localStorage.getItem(lockStorageKey)
      if (existingLock) {
        try {
          const lockInfo = JSON.parse(existingLock)
          if (lockInfo.expiresAt > Date.now()) {
            // Lock exists and is still valid
            return false
          }
        } catch (error) {
          // Invalid lock data, we can proceed to create a new lock
          console.warn(`Invalid lock data for ${lockStorageKey}:`, error)
        }
      }

      // Try to create the lock
      const lockInfo = {
        lockValue,
        expiresAt,
        tabId: window.location.href,
        timestamp: Date.now()
      }

      localStorage.setItem(lockStorageKey, JSON.stringify(lockInfo))

      // Add to active locks for cleanup
      this.activeLocks.add(lockKey)

      // Schedule automatic cleanup when lock expires
      setTimeout(() => {
        this.releaseLock(lockKey, lockValue).catch((error) => {
          console.warn(`Failed to auto-release expired lock ${lockKey}:`, error)
        })
      }, ttl)

      return true
    } catch (error) {
      console.warn(`Failed to acquire lock ${lockKey}:`, error)
      return false
    }
  }

  /**
   * Release a browser-based lock
   * @param lockKey The key to unlock
   * @param lockValue The value used when acquiring the lock (for verification)
   * @returns Promise that resolves when lock is released
   */
  private async releaseLock(
    lockKey: string,
    lockValue?: string
  ): Promise<void> {
    if (typeof localStorage === 'undefined') {
      return
    }

    const lockStorageKey = `${this.lockPrefix}${lockKey}`

    try {
      // If lockValue is provided, verify it matches before releasing
      if (lockValue) {
        const existingLock = localStorage.getItem(lockStorageKey)
        if (existingLock) {
          try {
            const lockInfo = JSON.parse(existingLock)
            if (lockInfo.lockValue !== lockValue) {
              // Lock was acquired by someone else, don't release it
              return
            }
          } catch (error) {
            // Invalid lock data, remove it
            localStorage.removeItem(lockStorageKey)
            this.activeLocks.delete(lockKey)
            return
          }
        }
      }

      // Remove the lock
      localStorage.removeItem(lockStorageKey)

      // Remove from active locks
      this.activeLocks.delete(lockKey)
    } catch (error) {
      console.warn(`Failed to release lock ${lockKey}:`, error)
    }
  }

  /**
   * Clean up expired locks from localStorage
   */
  private async cleanupExpiredLocks(): Promise<void> {
    if (typeof localStorage === 'undefined') {
      return
    }

    try {
      const now = Date.now()
      const keysToRemove: string[] = []

      // Iterate through localStorage to find expired locks
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (key && key.startsWith(this.lockPrefix)) {
          try {
            const lockData = localStorage.getItem(key)
            if (lockData) {
              const lockInfo = JSON.parse(lockData)
              if (lockInfo.expiresAt <= now) {
                keysToRemove.push(key)
                const lockKey = key.replace(this.lockPrefix, '')
                this.activeLocks.delete(lockKey)
              }
            }
          } catch (error) {
            // Invalid lock data, mark for removal
            keysToRemove.push(key)
          }
        }
      }

      // Remove expired locks
      keysToRemove.forEach((key) => {
        localStorage.removeItem(key)
      })

      if (keysToRemove.length > 0) {
        console.log(`Cleaned up ${keysToRemove.length} expired locks`)
      }
    } catch (error) {
      console.warn('Failed to cleanup expired locks:', error)
    }
  }

  /**
   * Save statistics data to storage with browser-based locking
   * @param statistics The statistics data to save
   */
  protected async saveStatisticsData(
    statistics: StatisticsData
  ): Promise<void> {
    const lockKey = 'statistics'
    const lockAcquired = await this.acquireLock(lockKey, 10000) // 10 second timeout

    if (!lockAcquired) {
      console.warn(
        'Failed to acquire lock for statistics update, proceeding without lock'
      )
    }

    try {
      // Get existing statistics to merge with new data
      const existingStats = await this.getStatisticsData()

      let mergedStats: StatisticsData
      if (existingStats) {
        // Merge statistics data
        mergedStats = {
          nounCount: {
            ...existingStats.nounCount,
            ...statistics.nounCount
          },
          verbCount: {
            ...existingStats.verbCount,
            ...statistics.verbCount
          },
          metadataCount: {
            ...existingStats.metadataCount,
            ...statistics.metadataCount
          },
          hnswIndexSize: Math.max(
            statistics.hnswIndexSize || 0,
            existingStats.hnswIndexSize || 0
          ),
          lastUpdated: new Date().toISOString()
        }
      } else {
        // No existing statistics, use new ones
        mergedStats = {
          ...statistics,
          lastUpdated: new Date().toISOString()
        }
      }

      // Create a deep copy to avoid reference issues
      this.statistics = {
        nounCount: { ...mergedStats.nounCount },
        verbCount: { ...mergedStats.verbCount },
        metadataCount: { ...mergedStats.metadataCount },
        hnswIndexSize: mergedStats.hnswIndexSize,
        lastUpdated: mergedStats.lastUpdated
      }

      // Ensure the root directory is initialized
      await this.ensureInitialized()

      // Get or create the index directory
      if (!this.indexDir) {
        throw new Error('Index directory not initialized')
      }

      // Get the current statistics key
      const currentKey = this.getCurrentStatisticsKey()

      // Create a file for the statistics data
      const fileHandle = await this.indexDir.getFileHandle(currentKey, {
        create: true
      })

      // Create a writable stream
      const writable = await fileHandle.createWritable()

      // Write the statistics data to the file
      await writable.write(JSON.stringify(this.statistics, null, 2))

      // Close the stream
      await writable.close()

      // Also update the legacy key for backward compatibility, but less frequently
      if (Math.random() < 0.1) {
        const legacyKey = this.getLegacyStatisticsKey()
        const legacyFileHandle = await this.indexDir.getFileHandle(legacyKey, {
          create: true
        })
        const legacyWritable = await legacyFileHandle.createWritable()
        await legacyWritable.write(JSON.stringify(this.statistics, null, 2))
        await legacyWritable.close()
      }
    } catch (error) {
      console.error('Failed to save statistics data:', error)
      throw new Error(`Failed to save statistics data: ${error}`)
    } finally {
      if (lockAcquired) {
        await this.releaseLock(lockKey)
      }
    }
  }

  /**
   * Get statistics data from storage
   * @returns Promise that resolves to the statistics data or null if not found
   */
  protected async getStatisticsData(): Promise<StatisticsData | null> {
    // If we have cached statistics, return a deep copy
    if (this.statistics) {
      return {
        nounCount: { ...this.statistics.nounCount },
        verbCount: { ...this.statistics.verbCount },
        metadataCount: { ...this.statistics.metadataCount },
        hnswIndexSize: this.statistics.hnswIndexSize,
        lastUpdated: this.statistics.lastUpdated
      }
    }

    try {
      // Ensure the root directory is initialized
      await this.ensureInitialized()

      if (!this.indexDir) {
        throw new Error('Index directory not initialized')
      }

      // First try to get statistics from today's file
      const currentKey = this.getCurrentStatisticsKey()
      try {
        const fileHandle = await this.indexDir.getFileHandle(currentKey, {
          create: false
        })
        const file = await fileHandle.getFile()
        const text = await file.text()
        this.statistics = JSON.parse(text)

        if (this.statistics) {
          return {
            nounCount: { ...this.statistics.nounCount },
            verbCount: { ...this.statistics.verbCount },
            metadataCount: { ...this.statistics.metadataCount },
            hnswIndexSize: this.statistics.hnswIndexSize,
            lastUpdated: this.statistics.lastUpdated
          }
        }
      } catch (error) {
        // If today's file doesn't exist, try yesterday's file
        const yesterday = new Date()
        yesterday.setDate(yesterday.getDate() - 1)
        const yesterdayKey = this.getStatisticsKeyForDate(yesterday)

        try {
          const fileHandle = await this.indexDir.getFileHandle(yesterdayKey, {
            create: false
          })
          const file = await fileHandle.getFile()
          const text = await file.text()
          this.statistics = JSON.parse(text)

          if (this.statistics) {
            return {
              nounCount: { ...this.statistics.nounCount },
              verbCount: { ...this.statistics.verbCount },
              metadataCount: { ...this.statistics.metadataCount },
              hnswIndexSize: this.statistics.hnswIndexSize,
              lastUpdated: this.statistics.lastUpdated
            }
          }
        } catch (error) {
          // If yesterday's file doesn't exist, try the legacy file
          const legacyKey = this.getLegacyStatisticsKey()

          try {
            const fileHandle = await this.indexDir.getFileHandle(legacyKey, {
              create: false
            })
            const file = await fileHandle.getFile()
            const text = await file.text()
            this.statistics = JSON.parse(text)

            if (this.statistics) {
              return {
                nounCount: { ...this.statistics.nounCount },
                verbCount: { ...this.statistics.verbCount },
                metadataCount: { ...this.statistics.metadataCount },
                hnswIndexSize: this.statistics.hnswIndexSize,
                lastUpdated: this.statistics.lastUpdated
              }
            }
          } catch (error) {
            // If the legacy file doesn't exist either, return null
            return null
          }
        }
      }

      // If we get here and statistics is null, return default statistics
      return this.statistics ? this.statistics : null
    } catch (error) {
      console.error('Failed to get statistics data:', error)
      throw new Error(`Failed to get statistics data: ${error}`)
    }
  }

  /**
   * Get nouns with pagination support
   * @param options Pagination and filter options
   * @returns Promise that resolves to a paginated result of nouns
   */
  public async getNounsWithPagination(options: {
    limit?: number
    cursor?: string
    filter?: {
      nounType?: string | string[]
      service?: string | string[]
      metadata?: Record<string, any>
    }
  } = {}): Promise<{
    items: HNSWNoun[]
    totalCount?: number
    hasMore: boolean
    nextCursor?: string
  }> {
    await this.ensureInitialized()

    const limit = options.limit || 100
    const cursor = options.cursor

    // Get all noun files from all shards
    const nounFiles: string[] = []
    if (this.nounsDir) {
      // Iterate through all shard directories
      for await (const [shardName, shardHandle] of this.nounsDir.entries()) {
        if (shardHandle.kind === 'directory') {
          // Iterate through files in this shard
          const shardDir = shardHandle as FileSystemDirectoryHandle
          for await (const [fileName, fileHandle] of shardDir.entries()) {
            if (fileHandle.kind === 'file' && fileName.endsWith('.json')) {
              nounFiles.push(`${shardName}/${fileName}`)
            }
          }
        }
      }
    }
    
    // Sort files for consistent ordering
    nounFiles.sort()
    
    // Apply cursor-based pagination
    let startIndex = 0
    if (cursor) {
      const cursorIndex = nounFiles.findIndex(file => file > cursor)
      if (cursorIndex >= 0) {
        startIndex = cursorIndex
      }
    }
    
    // Get the subset of files for this page
    const pageFiles = nounFiles.slice(startIndex, startIndex + limit)
    
    // Load nouns from files
    const items: HNSWNoun[] = []
    for (const fileName of pageFiles) {
      // fileName is in format "shard/uuid.json", extract just the UUID
      const id = fileName.split('/')[1].replace('.json', '')
      const noun = await this.getNoun_internal(id)
      if (noun) {
        // Apply filters if provided
        if (options.filter) {
          const metadata = await this.getNounMetadata(id)
          
          // Filter by noun type
          if (options.filter.nounType) {
            const nounTypes = Array.isArray(options.filter.nounType)
              ? options.filter.nounType
              : [options.filter.nounType]
            if (metadata && !nounTypes.includes(metadata.type || metadata.noun)) {
              continue
            }
          }
          
          // Filter by service
          if (options.filter.service) {
            const services = Array.isArray(options.filter.service)
              ? options.filter.service
              : [options.filter.service]
            if (metadata && !services.includes(metadata.createdBy?.augmentation)) {
              continue
            }
          }
          
          // Filter by metadata
          if (options.filter.metadata) {
            if (!metadata) continue
            let matches = true
            for (const [key, value] of Object.entries(options.filter.metadata)) {
              if (metadata[key] !== value) {
                matches = false
                break
              }
            }
            if (!matches) continue
          }
        }
        
        items.push(noun)
      }
    }
    
    // Determine if there are more items
    const hasMore = startIndex + limit < nounFiles.length
    
    // Generate next cursor if there are more items
    const nextCursor = hasMore && pageFiles.length > 0
      ? pageFiles[pageFiles.length - 1]
      : undefined
    
    return {
      items,
      totalCount: nounFiles.length,
      hasMore,
      nextCursor
    }
  }

  /**
   * Get verbs with pagination support
   * @param options Pagination and filter options
   * @returns Promise that resolves to a paginated result of verbs
   */
  public async getVerbsWithPagination(options: {
    limit?: number
    cursor?: string
    filter?: {
      verbType?: string | string[]
      sourceId?: string | string[]
      targetId?: string | string[]
      service?: string | string[]
      metadata?: Record<string, any>
    }
  } = {}): Promise<{
    items: GraphVerb[]
    totalCount?: number
    hasMore: boolean
    nextCursor?: string
  }> {
    await this.ensureInitialized()

    const limit = options.limit || 100
    const cursor = options.cursor

    // Get all verb files from all shards
    const verbFiles: string[] = []
    if (this.verbsDir) {
      // Iterate through all shard directories
      for await (const [shardName, shardHandle] of this.verbsDir.entries()) {
        if (shardHandle.kind === 'directory') {
          // Iterate through files in this shard
          const shardDir = shardHandle as FileSystemDirectoryHandle
          for await (const [fileName, fileHandle] of shardDir.entries()) {
            if (fileHandle.kind === 'file' && fileName.endsWith('.json')) {
              verbFiles.push(`${shardName}/${fileName}`)
            }
          }
        }
      }
    }

    // Sort files for consistent ordering
    verbFiles.sort()

    // Apply cursor-based pagination
    let startIndex = 0
    if (cursor) {
      const cursorIndex = verbFiles.findIndex(file => file > cursor)
      if (cursorIndex >= 0) {
        startIndex = cursorIndex
      }
    }

    // Get the subset of files for this page
    const pageFiles = verbFiles.slice(startIndex, startIndex + limit)

    // Load verbs from files and convert to GraphVerb
    const items: GraphVerb[] = []
    for (const fileName of pageFiles) {
      // fileName is in format "shard/uuid.json", extract just the UUID
      const id = fileName.split('/')[1].replace('.json', '')
      const hnswVerb = await this.getVerb_internal(id)
      if (hnswVerb) {
        // Convert HNSWVerb to GraphVerb
        const graphVerb = await this.convertHNSWVerbToGraphVerb(hnswVerb)
        if (graphVerb) {
          // Apply filters if provided
          if (options.filter) {
            // Filter by verb type
            if (options.filter.verbType) {
              const verbTypes = Array.isArray(options.filter.verbType)
                ? options.filter.verbType
                : [options.filter.verbType]
              if (graphVerb.verb && !verbTypes.includes(graphVerb.verb)) {
                continue
              }
            }
            
            // Filter by source ID
            if (options.filter.sourceId) {
              const sourceIds = Array.isArray(options.filter.sourceId)
                ? options.filter.sourceId
                : [options.filter.sourceId]
              if (graphVerb.source && !sourceIds.includes(graphVerb.source)) {
                continue
              }
            }
            
            // Filter by target ID
            if (options.filter.targetId) {
              const targetIds = Array.isArray(options.filter.targetId)
                ? options.filter.targetId
                : [options.filter.targetId]
              if (graphVerb.target && !targetIds.includes(graphVerb.target)) {
                continue
              }
            }
            
            // Filter by service
            if (options.filter.service) {
              const services = Array.isArray(options.filter.service)
                ? options.filter.service
                : [options.filter.service]
              if (graphVerb.createdBy?.augmentation && !services.includes(graphVerb.createdBy.augmentation)) {
                continue
              }
            }
            
            // Filter by metadata
            if (options.filter.metadata && graphVerb.metadata) {
              let matches = true
              for (const [key, value] of Object.entries(options.filter.metadata)) {
                if (graphVerb.metadata[key] !== value) {
                  matches = false
                  break
                }
              }
              if (!matches) continue
            }
          }
          
          items.push(graphVerb)
        }
      }
    }
    
    // Determine if there are more items
    const hasMore = startIndex + limit < verbFiles.length
    
    // Generate next cursor if there are more items
    const nextCursor = hasMore && pageFiles.length > 0
      ? pageFiles[pageFiles.length - 1]
      : undefined
    
    return {
      items,
      totalCount: verbFiles.length,
      hasMore,
      nextCursor
    }
  }

  /**
   * Initialize counts from OPFS storage
   */
  protected async initializeCounts(): Promise<void> {
    try {
      // Try to load existing counts from counts.json
      const systemDir = await this.rootDir!.getDirectoryHandle('system', { create: true })
      const countsFile = await systemDir.getFileHandle('counts.json')
      const file = await countsFile.getFile()
      const data = await file.text()
      const counts = JSON.parse(data)

      // Restore counts from OPFS
      this.entityCounts = new Map(Object.entries(counts.entityCounts || {}))
      this.verbCounts = new Map(Object.entries(counts.verbCounts || {}))
      this.totalNounCount = counts.totalNounCount || 0
      this.totalVerbCount = counts.totalVerbCount || 0
    } catch (error) {
      // If counts don't exist, initialize by scanning (one-time operation)
      await this.initializeCountsFromScan()
    }
  }

  /**
   * Initialize counts by scanning OPFS (fallback for missing counts file)
   */
  private async initializeCountsFromScan(): Promise<void> {
    try {
      // Count nouns across all shards
      let nounCount = 0
      for await (const [shardName, shardHandle] of this.nounsDir!.entries()) {
        if (shardHandle.kind === 'directory') {
          const shardDir = shardHandle as FileSystemDirectoryHandle
          for await (const [, ] of shardDir.entries()) {
            nounCount++
          }
        }
      }
      this.totalNounCount = nounCount

      // Count verbs across all shards
      let verbCount = 0
      for await (const [shardName, shardHandle] of this.verbsDir!.entries()) {
        if (shardHandle.kind === 'directory') {
          const shardDir = shardHandle as FileSystemDirectoryHandle
          for await (const [, ] of shardDir.entries()) {
            verbCount++
          }
        }
      }
      this.totalVerbCount = verbCount

      // Save initial counts
      await this.persistCounts()
    } catch (error) {
      console.error('Error initializing counts from OPFS scan:', error)
    }
  }

  /**
   * Persist counts to OPFS storage
   */
  protected async persistCounts(): Promise<void> {
    try {
      const systemDir = await this.rootDir!.getDirectoryHandle('system', { create: true })
      const countsFile = await systemDir.getFileHandle('counts.json', { create: true })
      const writable = await countsFile.createWritable()

      const counts = {
        entityCounts: Object.fromEntries(this.entityCounts),
        verbCounts: Object.fromEntries(this.verbCounts),
        totalNounCount: this.totalNounCount,
        totalVerbCount: this.totalVerbCount,
        lastUpdated: new Date().toISOString()
      }

      await writable.write(JSON.stringify(counts))
      await writable.close()
    } catch (error) {
      console.error('Error persisting counts to OPFS:', error)
    }
  }

  // HNSW Index Persistence (v3.35.0+)

  /**
   * Get a noun's vector for HNSW rebuild
   */
  public async getNounVector(id: string): Promise<number[] | null> {
    await this.ensureInitialized()
    const noun = await this.getNoun_internal(id)
    return noun ? noun.vector : null
  }

  /**
   * Save HNSW graph data for a noun
   * Storage path: nouns/hnsw/{shard}/{id}.json
   */
  public async saveHNSWData(nounId: string, hnswData: {
    level: number
    connections: Record<string, string[]>
  }): Promise<void> {
    await this.ensureInitialized()

    try {
      // Get or create the hnsw directory under nouns
      const hnswDir = await this.nounsDir!.getDirectoryHandle('hnsw', { create: true })

      // Use sharded path for HNSW data
      const shard = getShardIdFromUuid(nounId)
      const shardDir = await hnswDir.getDirectoryHandle(shard, { create: true })

      // Create or get the file in the shard directory
      const fileHandle = await shardDir.getFileHandle(`${nounId}.json`, { create: true })

      // Write the HNSW data to the file
      const writable = await fileHandle.createWritable()
      await writable.write(JSON.stringify(hnswData, null, 2))
      await writable.close()
    } catch (error) {
      console.error(`Failed to save HNSW data for ${nounId}:`, error)
      throw new Error(`Failed to save HNSW data for ${nounId}: ${error}`)
    }
  }

  /**
   * Get HNSW graph data for a noun
   * Storage path: nouns/hnsw/{shard}/{id}.json
   */
  public async getHNSWData(nounId: string): Promise<{
    level: number
    connections: Record<string, string[]>
  } | null> {
    await this.ensureInitialized()

    try {
      // Get the hnsw directory under nouns
      const hnswDir = await this.nounsDir!.getDirectoryHandle('hnsw')

      // Use sharded path for HNSW data
      const shard = getShardIdFromUuid(nounId)
      const shardDir = await hnswDir.getDirectoryHandle(shard)

      // Get the file handle from the shard directory
      const fileHandle = await shardDir.getFileHandle(`${nounId}.json`)

      // Read the HNSW data from the file
      const file = await fileHandle.getFile()
      const text = await file.text()
      return JSON.parse(text)
    } catch (error: any) {
      if (error.name === 'NotFoundError') {
        return null
      }

      console.error(`Failed to get HNSW data for ${nounId}:`, error)
      throw new Error(`Failed to get HNSW data for ${nounId}: ${error}`)
    }
  }

  /**
   * Save HNSW system data (entry point, max level)
   * Storage path: index/hnsw-system.json
   */
  public async saveHNSWSystem(systemData: {
    entryPointId: string | null
    maxLevel: number
  }): Promise<void> {
    await this.ensureInitialized()

    try {
      // Create or get the file in the index directory
      const fileHandle = await this.indexDir!.getFileHandle('hnsw-system.json', { create: true })

      // Write the system data to the file
      const writable = await fileHandle.createWritable()
      await writable.write(JSON.stringify(systemData, null, 2))
      await writable.close()
    } catch (error) {
      console.error('Failed to save HNSW system data:', error)
      throw new Error(`Failed to save HNSW system data: ${error}`)
    }
  }

  /**
   * Get HNSW system data (entry point, max level)
   * Storage path: index/hnsw-system.json
   */
  public async getHNSWSystem(): Promise<{
    entryPointId: string | null
    maxLevel: number
  } | null> {
    await this.ensureInitialized()

    try {
      // Get the file handle from the index directory
      const fileHandle = await this.indexDir!.getFileHandle('hnsw-system.json')

      // Read the system data from the file
      const file = await fileHandle.getFile()
      const text = await file.text()
      return JSON.parse(text)
    } catch (error: any) {
      if (error.name === 'NotFoundError') {
        return null
      }

      console.error('Failed to get HNSW system data:', error)
      throw new Error(`Failed to get HNSW system data: ${error}`)
    }
  }
}
