/**
 * File System Storage Adapter
 * File system storage adapter for Node.js environments
 */

import { GraphVerb, HNSWNoun, HNSWVerb, StatisticsData } from '../../coreTypes.js'
import {
  BaseStorage,
  NOUNS_DIR,
  VERBS_DIR,
  METADATA_DIR,
  NOUN_METADATA_DIR,
  VERB_METADATA_DIR,
  INDEX_DIR,
  SYSTEM_DIR,
  STATISTICS_KEY
} from '../baseStorage.js'
import { StorageCompatibilityLayer, StoragePaths } from '../backwardCompatibility.js'

// Type aliases for better readability
type HNSWNode = HNSWNoun
type Edge = HNSWVerb

// Node.js modules - dynamically imported to avoid issues in browser environments
let fs: any
let path: any
let moduleLoadingPromise: Promise<void> | null = null

// Try to load Node.js modules
try {
  // Using dynamic imports to avoid issues in browser environments
  const fsPromise = import('node:fs')
  const pathPromise = import('node:path')

  moduleLoadingPromise = Promise.all([fsPromise, pathPromise])
    .then(([fsModule, pathModule]) => {
      fs = fsModule
      path = pathModule.default
    })
    .catch((error) => {
      console.error('Failed to load Node.js modules:', error)
      throw error
    })
} catch (error) {
  console.error(
    'FileSystemStorage: Failed to load Node.js modules. This adapter is not supported in this environment.',
    error
  )
}

/**
 * File system storage adapter for Node.js environments
 * Uses the file system to store data in the specified directory structure
 */
export class FileSystemStorage extends BaseStorage {
  // FileSystem-specific count persistence
  private countsFilePath?: string // Will be set after init

  // Intelligent sharding configuration
  private readonly shardingDepth: number = 2 // 0=flat, 1=ab/, 2=ab/cd/
  private readonly SHARDING_THRESHOLD = 1000 // Enable deep sharding at 1k files
  private cachedShardingDepth?: number // Cache sharding depth for consistency
  private rootDir: string
  private nounsDir!: string
  private verbsDir!: string
  private metadataDir!: string
  private nounMetadataDir!: string
  private verbMetadataDir!: string
  private indexDir!: string  // Legacy - for backward compatibility
  private systemDir!: string  // New location for system data
  private lockDir!: string
  private useDualWrite: boolean = true  // Write to both locations during migration
  private activeLocks: Set<string> = new Set()
  private lockTimers: Map<string, NodeJS.Timeout> = new Map()  // Track timers for cleanup
  private allTimers: Set<NodeJS.Timeout> = new Set()  // Track all timers for cleanup

  /**
   * Initialize the storage adapter
   * @param rootDirectory The root directory for storage
   */
  constructor(rootDirectory: string) {
    super()
    this.rootDir = rootDirectory
    // Defer path operations until init() when path module is guaranteed to be loaded
  }

  /**
   * Initialize the storage adapter
   */
  public async init(): Promise<void> {
    if (this.isInitialized) {
      return
    }

    // Wait for module loading to complete
    if (moduleLoadingPromise) {
      try {
        await moduleLoadingPromise
      } catch (error) {
        throw new Error(
          'FileSystemStorage requires a Node.js environment, but `fs` and `path` modules could not be loaded.'
        )
      }
    }

    // Check if Node.js modules are available
    if (!fs || !path) {
      throw new Error(
        'FileSystemStorage requires a Node.js environment, but `fs` and `path` modules could not be loaded.'
      )
    }

    try {
      // Initialize directory paths now that path module is loaded
      this.nounsDir = path.join(this.rootDir, NOUNS_DIR)
      this.verbsDir = path.join(this.rootDir, VERBS_DIR)
      this.metadataDir = path.join(this.rootDir, METADATA_DIR)
      this.nounMetadataDir = path.join(this.rootDir, NOUN_METADATA_DIR)
      this.verbMetadataDir = path.join(this.rootDir, VERB_METADATA_DIR)
      this.indexDir = path.join(this.rootDir, INDEX_DIR)  // Legacy
      this.systemDir = path.join(this.rootDir, SYSTEM_DIR)  // New
      this.lockDir = path.join(this.rootDir, 'locks')

      // Create the root directory if it doesn't exist
      await this.ensureDirectoryExists(this.rootDir)

      // Create the nouns directory if it doesn't exist
      await this.ensureDirectoryExists(this.nounsDir)

      // Create the verbs directory if it doesn't exist
      await this.ensureDirectoryExists(this.verbsDir)

      // Create the metadata directory if it doesn't exist
      await this.ensureDirectoryExists(this.metadataDir)

      // Create the noun metadata directory if it doesn't exist
      await this.ensureDirectoryExists(this.nounMetadataDir)

      // Create the verb metadata directory if it doesn't exist
      await this.ensureDirectoryExists(this.verbMetadataDir)

      // Create both directories for backward compatibility
      await this.ensureDirectoryExists(this.systemDir)
      // Only create legacy directory if it exists (don't create new legacy dirs)
      if (await this.directoryExists(this.indexDir)) {
        await this.ensureDirectoryExists(this.indexDir)
      }

      // Create the locks directory if it doesn't exist
      await this.ensureDirectoryExists(this.lockDir)

      // Initialize count management
      this.countsFilePath = path.join(this.systemDir, 'counts.json')
      await this.initializeCounts()

      // Cache sharding depth for consistency during this session
      this.cachedShardingDepth = this.getOptimalShardingDepth()
      // Log sharding strategy for transparency
      const strategy = this.cachedShardingDepth === 0 ? 'flat' : this.cachedShardingDepth === 1 ? 'single-level' : 'deep'
      console.log(`📁 Using ${strategy} sharding for optimal performance (${this.totalNounCount} items)`)

      this.isInitialized = true
    } catch (error) {
      console.error('Error initializing FileSystemStorage:', error)
      throw error
    }
  }

  /**
   * Check if a directory exists
   */
  private async directoryExists(dirPath: string): Promise<boolean> {
    try {
      const stats = await fs.promises.stat(dirPath)
      return stats.isDirectory()
    } catch (error) {
      return false
    }
  }

  /**
   * Ensure a directory exists, creating it if necessary
   */
  private async ensureDirectoryExists(dirPath: string): Promise<void> {
    try {
      await fs.promises.mkdir(dirPath, { recursive: true })
    } catch (error: any) {
      // Ignore EEXIST error, which means the directory already exists
      if (error.code !== 'EEXIST') {
        throw error
      }
    }
  }

  /**
   * Save a node to storage
   */
  protected async saveNode(node: HNSWNode): Promise<void> {
    await this.ensureInitialized()

    // Check if this is a new node to update counts
    const isNew = !(await this.fileExists(this.getNodePath(node.id)))

    // Convert connections Map to a serializable format
    const serializableNode = {
      ...node,
      connections: this.mapToObject(node.connections, (set) =>
        Array.from(set as Set<string>)
      )
    }

    const filePath = this.getNodePath(node.id)
    await this.ensureDirectoryExists(path.dirname(filePath))
    await fs.promises.writeFile(
      filePath,
      JSON.stringify(serializableNode, null, 2)
    )

    // Update counts for new nodes (intelligent type detection)
    if (isNew) {
      const type = node.metadata?.type || node.metadata?.nounType || 'default'
      this.incrementEntityCount(type)

      // Persist counts periodically (every 10 operations for efficiency)
      if (this.totalNounCount % 10 === 0) {
        await this.persistCounts()
      }
    }
  }

  /**
   * Get a node from storage
   */
  protected async getNode(id: string): Promise<HNSWNode | null> {
    await this.ensureInitialized()

    // Clean, predictable path - no backward compatibility needed
    const filePath = this.getNodePath(id)
    try {
      const data = await fs.promises.readFile(filePath, 'utf-8')
      const parsedNode = JSON.parse(data)

      // Convert serialized connections back to Map<number, Set<string>>
      const connections = new Map<number, Set<string>>()
      for (const [level, nodeIds] of Object.entries(parsedNode.connections)) {
        connections.set(Number(level), new Set(nodeIds as string[]))
      }

      return {
        id: parsedNode.id,
        vector: parsedNode.vector,
        connections,
        level: parsedNode.level || 0
      }
    } catch (error: any) {
      if (error.code !== 'ENOENT') {
        console.error(`Error reading node ${id}:`, error)
      }
      return null
    }
  }

  /**
   * Get all nodes from storage
   */
  protected async getAllNodes(): Promise<HNSWNode[]> {
    await this.ensureInitialized()

    const allNodes: HNSWNode[] = []
    try {
      const files = await fs.promises.readdir(this.nounsDir)
      for (const file of files) {
        if (file.endsWith('.json')) {
          const filePath = path.join(this.nounsDir, file)
          const data = await fs.promises.readFile(filePath, 'utf-8')
          const parsedNode = JSON.parse(data)

          // Convert serialized connections back to Map<number, Set<string>>
          const connections = new Map<number, Set<string>>()
          for (const [level, nodeIds] of Object.entries(
            parsedNode.connections
          )) {
            connections.set(Number(level), new Set(nodeIds as string[]))
          }

          allNodes.push({
            id: parsedNode.id,
            vector: parsedNode.vector,
            connections,
            level: parsedNode.level || 0
          })
        }
      }
    } catch (error: any) {
      if (error.code !== 'ENOENT') {
        console.error(`Error reading directory ${this.nounsDir}:`, error)
      }
    }
    return allNodes
  }

  /**
   * Get nodes by noun type
   * @param nounType The noun type to filter by
   * @returns Promise that resolves to an array of nodes of the specified noun type
   */
  protected async getNodesByNounType(nounType: string): Promise<HNSWNode[]> {
    await this.ensureInitialized()

    const nouns: HNSWNode[] = []
    try {
      const files = await fs.promises.readdir(this.nounsDir)
      for (const file of files) {
        if (file.endsWith('.json')) {
          const filePath = path.join(this.nounsDir, file)
          const data = await fs.promises.readFile(filePath, 'utf-8')
          const parsedNode = JSON.parse(data)

          // Filter by noun type using metadata
          const nodeId = parsedNode.id
          const metadata = await this.getMetadata(nodeId)
          if (metadata && metadata.noun === nounType) {
            // Convert serialized connections back to Map<number, Set<string>>
            const connections = new Map<number, Set<string>>()
            for (const [level, nodeIds] of Object.entries(
              parsedNode.connections
            )) {
              connections.set(Number(level), new Set(nodeIds as string[]))
            }

            nouns.push({
              id: parsedNode.id,
              vector: parsedNode.vector,
              connections,
              level: parsedNode.level || 0
            })
          }
        }
      }
    } catch (error: any) {
      if (error.code !== 'ENOENT') {
        console.error(`Error reading directory ${this.nounsDir}:`, error)
      }
    }

    return nouns
  }

  /**
   * Delete a node from storage
   */
  protected async deleteNode(id: string): Promise<void> {
    await this.ensureInitialized()

    const filePath = this.getNodePath(id)

    // Load node to get type for count update
    try {
      const node = await this.getNode(id)
      if (node) {
        const type = node.metadata?.type || node.metadata?.nounType || 'default'
        this.decrementEntityCount(type)
      }
    } catch {
      // Node might not exist, that's ok
    }

    try {
      await fs.promises.unlink(filePath)

      // Persist counts periodically
      if (this.totalNounCount % 10 === 0) {
        await this.persistCounts()
      }
    } catch (error: any) {
      if (error.code !== 'ENOENT') {
        console.error(`Error deleting node file ${filePath}:`, error)
        throw error
      }
    }
  }

  /**
   * Save an edge to storage
   */
  protected async saveEdge(edge: Edge): Promise<void> {
    await this.ensureInitialized()

    // Convert connections Map to a serializable format
    const serializableEdge = {
      ...edge,
      connections: this.mapToObject(edge.connections, (set) =>
        Array.from(set as Set<string>)
      )
    }

    const filePath = this.getVerbPath(edge.id)
    await this.ensureDirectoryExists(path.dirname(filePath))
    await fs.promises.writeFile(
      filePath,
      JSON.stringify(serializableEdge, null, 2)
    )
  }

  /**
   * Get an edge from storage
   */
  protected async getEdge(id: string): Promise<Edge | null> {
    await this.ensureInitialized()

    const filePath = this.getVerbPath(id)
    try {
      const data = await fs.promises.readFile(filePath, 'utf-8')
      const parsedEdge = JSON.parse(data)

      // Convert serialized connections back to Map<number, Set<string>>
      const connections = new Map<number, Set<string>>()
      for (const [level, nodeIds] of Object.entries(parsedEdge.connections)) {
        connections.set(Number(level), new Set(nodeIds as string[]))
      }

      return {
        id: parsedEdge.id,
        vector: parsedEdge.vector,
        connections
      }
    } catch (error: any) {
      if (error.code !== 'ENOENT') {
        console.error(`Error reading edge ${id}:`, error)
      }
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
      const files = await fs.promises.readdir(this.verbsDir)
      for (const file of files) {
        if (file.endsWith('.json')) {
          const filePath = path.join(this.verbsDir, file)
          const data = await fs.promises.readFile(filePath, 'utf-8')
          const parsedEdge = JSON.parse(data)

          // Convert serialized connections back to Map<number, Set<string>>
          const connections = new Map<number, Set<string>>()
          for (const [level, nodeIds] of Object.entries(
            parsedEdge.connections
          )) {
            connections.set(Number(level), new Set(nodeIds as string[]))
          }

          allEdges.push({
            id: parsedEdge.id,
            vector: parsedEdge.vector,
            connections
          })
        }
      }
    } catch (error: any) {
      if (error.code !== 'ENOENT') {
        console.error(`Error reading directory ${this.verbsDir}:`, error)
      }
    }
    return allEdges
  }

  /**
   * Get edges by source
   */
  protected async getEdgesBySource(sourceId: string): Promise<Edge[]> {
    // This method is deprecated and would require loading metadata for each edge
    // For now, return empty array since this is not efficiently implementable with new storage pattern
    console.warn('getEdgesBySource is deprecated and not efficiently supported in new storage pattern')
    return []
  }

  /**
   * Get edges by target
   */
  protected async getEdgesByTarget(targetId: string): Promise<Edge[]> {
    // This method is deprecated and would require loading metadata for each edge
    // For now, return empty array since this is not efficiently implementable with new storage pattern
    console.warn('getEdgesByTarget is deprecated and not efficiently supported in new storage pattern')
    return []
  }

  /**
   * Get edges by type
   */
  protected async getEdgesByType(type: string): Promise<Edge[]> {
    // This method is deprecated and would require loading metadata for each edge
    // For now, return empty array since this is not efficiently implementable with new storage pattern
    console.warn('getEdgesByType is deprecated and not efficiently supported in new storage pattern')
    return []
  }

  /**
   * Delete an edge from storage
   */
  protected async deleteEdge(id: string): Promise<void> {
    await this.ensureInitialized()

    const filePath = path.join(this.verbsDir, `${id}.json`)
    try {
      await fs.promises.unlink(filePath)
    } catch (error: any) {
      if (error.code !== 'ENOENT') {
        console.error(`Error deleting edge file ${filePath}:`, error)
        throw error
      }
    }
  }

  /**
   * Save metadata to storage
   */
  public async saveMetadata(id: string, metadata: any): Promise<void> {
    await this.ensureInitialized()

    const filePath = path.join(this.metadataDir, `${id}.json`)
    await fs.promises.writeFile(filePath, JSON.stringify(metadata, null, 2))
  }

  /**
   * Get metadata from storage
   */
  public async getMetadata(id: string): Promise<any | null> {
    await this.ensureInitialized()

    const filePath = path.join(this.metadataDir, `${id}.json`)
    try {
      const data = await fs.promises.readFile(filePath, 'utf-8')
      return JSON.parse(data)
    } catch (error: any) {
      if (error.code !== 'ENOENT') {
        console.error(`Error reading metadata ${id}:`, error)
      }
      return null
    }
  }

  /**
   * Get multiple metadata objects in batches (CRITICAL: Prevents socket exhaustion)
   * FileSystem implementation uses controlled concurrency to prevent too many file reads
   */
  public async getMetadataBatch(ids: string[]): Promise<Map<string, any>> {
    await this.ensureInitialized()

    const results = new Map<string, any>()
    const batchSize = 10 // Process 10 files at a time
    
    // Process in batches to avoid overwhelming the filesystem
    for (let i = 0; i < ids.length; i += batchSize) {
      const batch = ids.slice(i, i + batchSize)
      
      const batchPromises = batch.map(async (id) => {
        try {
          const metadata = await this.getMetadata(id)
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
   * Save noun metadata to storage
   */
  protected async saveNounMetadata_internal(id: string, metadata: any): Promise<void> {
    await this.ensureInitialized()

    const filePath = path.join(this.nounMetadataDir, `${id}.json`)
    await fs.promises.writeFile(filePath, JSON.stringify(metadata, null, 2))
  }

  /**
   * Get noun metadata from storage
   */
  public async getNounMetadata(id: string): Promise<any | null> {
    await this.ensureInitialized()

    const filePath = path.join(this.nounMetadataDir, `${id}.json`)
    try {
      const data = await fs.promises.readFile(filePath, 'utf-8')
      return JSON.parse(data)
    } catch (error: any) {
      if (error.code !== 'ENOENT') {
        console.error(`Error reading noun metadata ${id}:`, error)
      }
      return null
    }
  }

  /**
   * Save verb metadata to storage
   */
  protected async saveVerbMetadata_internal(id: string, metadata: any): Promise<void> {
    await this.ensureInitialized()

    const filePath = path.join(this.verbMetadataDir, `${id}.json`)
    await fs.promises.writeFile(filePath, JSON.stringify(metadata, null, 2))
  }

  /**
   * Get verb metadata from storage
   */
  public async getVerbMetadata(id: string): Promise<any | null> {
    await this.ensureInitialized()

    const filePath = path.join(this.verbMetadataDir, `${id}.json`)
    try {
      const data = await fs.promises.readFile(filePath, 'utf-8')
      return JSON.parse(data)
    } catch (error: any) {
      if (error.code !== 'ENOENT') {
        console.error(`Error reading verb metadata ${id}:`, error)
      }
      return null
    }
  }

  /**
   * Get nouns with pagination support
   * @param options Pagination options
   */
  public async getNounsWithPagination(options: {
    limit?: number
    cursor?: string
    filter?: any
  } = {}): Promise<{
    items: HNSWNoun[]
    totalCount: number
    hasMore: boolean
    nextCursor?: string
  }> {
    await this.ensureInitialized()
    
    const limit = options.limit || 100
    const cursor = options.cursor
    
    try {
      // Get all noun files
      const files = await fs.promises.readdir(this.nounsDir)
      const nounFiles = files.filter((f: string) => f.endsWith('.json'))
      
      // Sort for consistent pagination
      nounFiles.sort()
      
      // Find starting position - prioritize offset for O(1) operation
      let startIndex = 0
      const offset = (options as any).offset  // Cast to any since offset might not be in type
      if (offset !== undefined) {
        // Direct offset - O(1) operation
        startIndex = offset
      } else if (cursor) {
        // Cursor-based pagination
        startIndex = nounFiles.findIndex((f: string) => f.replace('.json', '') > cursor)
        if (startIndex === -1) startIndex = nounFiles.length
      }
      
      // Get page of files
      const pageFiles = nounFiles.slice(startIndex, startIndex + limit)

      // Load nouns - count actual successfully loaded items
      const items: HNSWNoun[] = []
      let successfullyLoaded = 0
      let totalValidFiles = 0

      // Use persisted counts - O(1) operation!
      totalValidFiles = this.totalNounCount

      // No need to count files anymore - we maintain accurate counts
      // This eliminates the O(n) operation completely

      // Second pass: load the current page
      for (const file of pageFiles) {
        try {
          const data = await fs.promises.readFile(
            path.join(this.nounsDir, file),
            'utf-8'
          )
          const noun = JSON.parse(data)

          // Apply filter if provided
          if (options.filter) {
            // Simple filter implementation
            let matches = true
            for (const [key, value] of Object.entries(options.filter)) {
              if (noun.metadata && noun.metadata[key] !== value) {
                matches = false
                break
              }
            }
            if (!matches) continue
          }

          items.push(noun)
          successfullyLoaded++
        } catch (error) {
          console.warn(`Failed to read noun file ${file}:`, error)
        }
      }

      // CRITICAL FIX: hasMore should be based on actual valid files, not just file count
      // Also check if we actually loaded any items from this page
      const hasMore = (startIndex + limit < totalValidFiles) && (successfullyLoaded > 0 || startIndex === 0)
      const nextCursor = hasMore && pageFiles.length > 0
        ? pageFiles[pageFiles.length - 1].replace('.json', '')
        : undefined

      return {
        items,
        totalCount: totalValidFiles, // Use actual valid file count, not all files
        hasMore,
        nextCursor
      }
    } catch (error) {
      console.error('Error getting nouns with pagination:', error)
      return {
        items: [],
        totalCount: 0,
        hasMore: false
      }
    }
  }

  /**
   * Clear all data from storage
   */
  public async clear(): Promise<void> {
    await this.ensureInitialized()

    // Check if fs module is available
    if (!fs || !fs.promises) {
      console.warn('FileSystemStorage.clear: fs module not available, skipping clear operation')
      return
    }

    // Helper function to remove all files in a directory
    const removeDirectoryContents = async (dirPath: string): Promise<void> => {
      try {
        const files = await fs.promises.readdir(dirPath)
        for (const file of files) {
          const filePath = path.join(dirPath, file)
          const stats = await fs.promises.stat(filePath)
          if (stats.isDirectory()) {
            await removeDirectoryContents(filePath)
            await fs.promises.rmdir(filePath)
          } else {
            await fs.promises.unlink(filePath)
          }
        }
      } catch (error: any) {
        if (error.code !== 'ENOENT') {
          console.error(`Error removing directory contents ${dirPath}:`, error)
          throw error
        }
      }
    }

    // Remove all files in the nouns directory
    await removeDirectoryContents(this.nounsDir)

    // Remove all files in the verbs directory
    await removeDirectoryContents(this.verbsDir)

    // Remove all files in the metadata directory
    await removeDirectoryContents(this.metadataDir)

    // Remove all files in the noun metadata directory
    await removeDirectoryContents(this.nounMetadataDir)

    // Remove all files in the verb metadata directory
    await removeDirectoryContents(this.verbMetadataDir)

    // Remove all files in both system directories
    await removeDirectoryContents(this.systemDir)
    if (await this.directoryExists(this.indexDir)) {
      await removeDirectoryContents(this.indexDir)
    }
    
    // Clear the statistics cache
    this.statisticsCache = null
    this.statisticsModified = false
  }

  /**
   * Enhanced clear operation with safety mechanisms and performance optimizations
   * Provides progress tracking, backup options, and instance name confirmation
   */
  public async clearEnhanced(options: import('../enhancedClearOperations.js').ClearOptions = {}): Promise<import('../enhancedClearOperations.js').ClearResult> {
    await this.ensureInitialized()

    // Check if fs module is available
    if (!fs || !fs.promises) {
      throw new Error('FileSystemStorage.clearEnhanced: fs module not available')
    }

    const { EnhancedFileSystemClear } = await import('../enhancedClearOperations.js')
    const enhancedClear = new EnhancedFileSystemClear(this.rootDir, fs, path)
    
    const result = await enhancedClear.clear(options)
    
    if (result.success) {
      // Clear the statistics cache
      this.statisticsCache = null
      this.statisticsModified = false
    }
    
    return result
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

    // Check if fs module is available
    if (!fs || !fs.promises) {
      console.warn('FileSystemStorage.getStorageStatus: fs module not available, returning default values')
      return {
        type: 'filesystem',
        used: 0,
        quota: null,
        details: {
          nounsCount: 0,
          verbsCount: 0,
          metadataCount: 0,
          directorySizes: {
            nouns: 0,
            verbs: 0,
            metadata: 0,
            index: 0
          }
        }
      }
    }

    try {
      // Calculate the total size of all files in the storage directories
      let totalSize = 0

      // Helper function to calculate directory size
      const calculateSize = async (dirPath: string): Promise<number> => {
        let size = 0
        try {
          const files = await fs.promises.readdir(dirPath)
          for (const file of files) {
            const filePath = path.join(dirPath, file)
            const stats = await fs.promises.stat(filePath)
            if (stats.isDirectory()) {
              size += await calculateSize(filePath)
            } else {
              size += stats.size
            }
          }
        } catch (error: any) {
          if (error.code !== 'ENOENT') {
            console.error(
              `Error calculating size for directory ${dirPath}:`,
              error
            )
          }
        }
        return size
      }

      // Calculate size for each directory
      const nounsDirSize = await calculateSize(this.nounsDir)
      const verbsDirSize = await calculateSize(this.verbsDir)
      const metadataDirSize = await calculateSize(this.metadataDir)
      const indexDirSize = await calculateSize(this.indexDir)

      totalSize = nounsDirSize + verbsDirSize + metadataDirSize + indexDirSize

      // Count files in each directory
      const nounsCount = (await fs.promises.readdir(this.nounsDir)).filter(
        (file: string) => file.endsWith('.json')
      ).length
      const verbsCount = (await fs.promises.readdir(this.verbsDir)).filter(
        (file: string) => file.endsWith('.json')
      ).length
      const metadataCount = (
        await fs.promises.readdir(this.metadataDir)
      ).filter((file: string) => file.endsWith('.json')).length

      // Count nouns by type using metadata
      const nounTypeCounts: Record<string, number> = {}
      const metadataFiles = await fs.promises.readdir(this.metadataDir)
      for (const file of metadataFiles) {
        if (file.endsWith('.json')) {
          try {
            const filePath = path.join(this.metadataDir, file)
            const data = await fs.promises.readFile(filePath, 'utf-8')
            const metadata = JSON.parse(data)
            if (metadata.noun) {
              nounTypeCounts[metadata.noun] =
                (nounTypeCounts[metadata.noun] || 0) + 1
            }
          } catch (error) {
            console.error(`Error reading metadata file ${file}:`, error)
          }
        }
      }

      return {
        type: 'filesystem',
        used: totalSize,
        quota: null, // File system doesn't provide quota information
        details: {
          rootDirectory: this.rootDir,
          nounsCount,
          verbsCount,
          metadataCount,
          nounsDirSize,
          verbsDirSize,
          metadataDirSize,
          indexDirSize,
          nounTypes: nounTypeCounts
        }
      }
    } catch (error) {
      console.error('Failed to get storage status:', error)
      return {
        type: 'filesystem',
        used: 0,
        quota: null,
        details: { error: String(error) }
      }
    }
  }

  /**
   * Implementation of abstract methods from BaseStorage
   */

  /**
   * Save a noun to storage
   */
  protected async saveNoun_internal(noun: HNSWNoun): Promise<void> {
    return this.saveNode(noun)
  }

  /**
   * Get a noun from storage
   */
  protected async getNoun_internal(id: string): Promise<HNSWNoun | null> {
    return this.getNode(id)
  }


  /**
   * Get nouns by noun type
   */
  protected async getNounsByNounType_internal(
    nounType: string
  ): Promise<HNSWNoun[]> {
    return this.getNodesByNounType(nounType)
  }

  /**
   * Delete a noun from storage
   */
  protected async deleteNoun_internal(id: string): Promise<void> {
    return this.deleteNode(id)
  }

  /**
   * Save a verb to storage
   */
  protected async saveVerb_internal(verb: HNSWVerb): Promise<void> {
    return this.saveEdge(verb)
  }

  /**
   * Get a verb from storage
   */
  protected async getVerb_internal(id: string): Promise<HNSWVerb | null> {
    return this.getEdge(id)
  }


  /**
   * Get verbs by source
   */
  protected async getVerbsBySource_internal(
    sourceId: string
  ): Promise<GraphVerb[]> {
    console.log(`[DEBUG] getVerbsBySource_internal called for sourceId: ${sourceId}`)
    
    // Use the working pagination method with source filter
    const result = await this.getVerbsWithPagination({
      limit: 10000,
      filter: { sourceId: [sourceId] }
    })
    
    console.log(`[DEBUG] Found ${result.items.length} verbs for source ${sourceId}`)
    return result.items
  }

  /**
   * Get verbs by target
   */
  protected async getVerbsByTarget_internal(
    targetId: string
  ): Promise<GraphVerb[]> {
    console.log(`[DEBUG] getVerbsByTarget_internal called for targetId: ${targetId}`)
    
    // Use the working pagination method with target filter
    const result = await this.getVerbsWithPagination({
      limit: 10000,
      filter: { targetId: [targetId] }
    })
    
    console.log(`[DEBUG] Found ${result.items.length} verbs for target ${targetId}`)
    return result.items
  }

  /**
   * Get verbs by type
   */
  protected async getVerbsByType_internal(type: string): Promise<GraphVerb[]> {
    console.log(`[DEBUG] getVerbsByType_internal called for type: ${type}`)
    
    // Use the working pagination method with type filter
    const result = await this.getVerbsWithPagination({
      limit: 10000,
      filter: { verbType: [type] }
    })
    
    console.log(`[DEBUG] Found ${result.items.length} verbs for type ${type}`)
    return result.items
  }

  /**
   * Get verbs with pagination
   * This method reads verb files from the filesystem and returns them with pagination
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
    const startIndex = options.cursor ? parseInt(options.cursor, 10) : 0
    
    try {
      // List all verb files in the verbs directory
      // Note: For very large directories (millions of files), this could be memory-intensive
      // Future optimization: Use fs.opendir() for streaming directory reads
      const files = await fs.promises.readdir(this.verbsDir)
      const verbFiles = files.filter((f: string) => f.endsWith('.json'))
      
      // Sort files for consistent ordering
      verbFiles.sort()
      
      // Calculate pagination
      const totalCount = verbFiles.length
      const endIndex = Math.min(startIndex + limit, totalCount)
      const hasMore = endIndex < totalCount
      
      // Safety check for large datasets
      if (totalCount > 100000) {
        console.warn(`Large verb dataset detected (${totalCount} verbs). Consider using a database for better performance.`)
      }
      
      // Load the requested page of verbs
      const verbs: GraphVerb[] = []
      
      for (let i = startIndex; i < endIndex; i++) {
        const file = verbFiles[i]
        const id = file.replace('.json', '')
        
        try {
          // Read the verb data (HNSWVerb stored as edge)
          const filePath = path.join(this.verbsDir, file)
          const data = await fs.promises.readFile(filePath, 'utf-8')
          const edge = JSON.parse(data)
          
          // Get metadata which contains the actual verb information
          const metadata = await this.getVerbMetadata(id)
          
          // If no metadata exists, try to reconstruct basic metadata from filename
          if (!metadata) {
            console.warn(`Verb ${id} has no metadata, trying to create minimal verb`)
            
            // Create minimal GraphVerb without full metadata
            const minimalVerb: GraphVerb = {
              id: edge.id,
              vector: edge.vector,
              connections: edge.connections || new Map(),
              sourceId: 'unknown',
              targetId: 'unknown', 
              source: 'unknown',
              target: 'unknown',
              type: 'relationship',
              verb: 'relatedTo'
            }
            
            verbs.push(minimalVerb)
            continue
          }
          
          // Convert connections Map to proper format if needed
          let connections = edge.connections
          if (connections && typeof connections === 'object' && !(connections instanceof Map)) {
            const connectionsMap = new Map<number, Set<string>>()
            for (const [level, nodeIds] of Object.entries(connections)) {
              connectionsMap.set(Number(level), new Set(nodeIds as string[]))
            }
            connections = connectionsMap
          }
          
          // Properly reconstruct GraphVerb from HNSWVerb + metadata
          const verb: GraphVerb = {
            id: edge.id,
            vector: edge.vector,  // Include the vector field!
            connections: connections,
            sourceId: metadata.sourceId || metadata.source,
            targetId: metadata.targetId || metadata.target,
            source: metadata.source || metadata.sourceId,
            target: metadata.target || metadata.targetId,
            verb: metadata.verb || metadata.type,
            type: metadata.type || metadata.verb,
            weight: metadata.weight,
            metadata: metadata.metadata || metadata,
            data: metadata.data,
            createdAt: metadata.createdAt,
            updatedAt: metadata.updatedAt,
            createdBy: metadata.createdBy,
            embedding: metadata.embedding || edge.vector
          }
          
          // Apply filters if provided
          if (options.filter) {
            const filter = options.filter
            
            // Check verbType filter
            if (filter.verbType) {
              const types = Array.isArray(filter.verbType) ? filter.verbType : [filter.verbType]
              const verbType = verb.type || verb.verb
              if (verbType && !types.includes(verbType)) continue
            }
            
            // Check sourceId filter
            if (filter.sourceId) {
              const sources = Array.isArray(filter.sourceId) ? filter.sourceId : [filter.sourceId]
              const sourceId = verb.sourceId || verb.source
              if (!sourceId || !sources.includes(sourceId)) continue
            }
            
            // Check targetId filter
            if (filter.targetId) {
              const targets = Array.isArray(filter.targetId) ? filter.targetId : [filter.targetId]
              const targetId = verb.targetId || verb.target
              if (!targetId || !targets.includes(targetId)) continue
            }
            
            // Check service filter
            if (filter.service && metadata?.service) {
              const services = Array.isArray(filter.service) ? filter.service : [filter.service]
              if (!services.includes(metadata.service)) continue
            }
          }
          
          verbs.push(verb)
        } catch (error) {
          console.warn(`Failed to read verb ${id}:`, error)
        }
      }
      
      return {
        items: verbs,
        totalCount,
        hasMore,
        nextCursor: hasMore ? String(endIndex) : undefined
      }
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        // Verbs directory doesn't exist yet
        return {
          items: [],
          totalCount: 0,
          hasMore: false
        }
      }
      throw error
    }
  }

  /**
   * Delete a verb from storage
   */
  protected async deleteVerb_internal(id: string): Promise<void> {
    return this.deleteEdge(id)
  }

  /**
   * Acquire a file-based lock for coordinating operations across multiple processes
   * @param lockKey The key to lock on
   * @param ttl Time to live for the lock in milliseconds (default: 30 seconds)
   * @returns Promise that resolves to true if lock was acquired, false otherwise
   */
  private async acquireLock(
    lockKey: string,
    ttl: number = 30000
  ): Promise<boolean> {
    await this.ensureInitialized()
    
    // Ensure lock directory exists
    await this.ensureDirectoryExists(this.lockDir)

    const lockFile = path.join(this.lockDir, `${lockKey}.lock`)
    const lockValue = `${Date.now()}_${Math.random()}_${process.pid || 'unknown'}`
    const expiresAt = Date.now() + ttl

    try {
      // Check if lock file already exists and is still valid
      try {
        const lockData = await fs.promises.readFile(lockFile, 'utf-8')
        const lockInfo = JSON.parse(lockData)

        if (lockInfo.expiresAt > Date.now()) {
          // Lock exists and is still valid
          return false
        }
      } catch (error: any) {
        // If file doesn't exist or can't be read, we can proceed to create the lock
        if (error.code !== 'ENOENT') {
          console.warn(`Error reading lock file ${lockFile}:`, error)
        }
      }

      // Try to create the lock file
      const lockInfo = {
        lockValue,
        expiresAt,
        pid: process.pid || 'unknown',
        timestamp: Date.now()
      }

      await fs.promises.writeFile(lockFile, JSON.stringify(lockInfo, null, 2))

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
   * Release a file-based lock
   * @param lockKey The key to unlock
   * @param lockValue The value used when acquiring the lock (for verification)
   * @returns Promise that resolves when lock is released
   */
  private async releaseLock(
    lockKey: string,
    lockValue?: string
  ): Promise<void> {
    await this.ensureInitialized()

    const lockFile = path.join(this.lockDir, `${lockKey}.lock`)

    try {
      // If lockValue is provided, verify it matches before releasing
      if (lockValue) {
        try {
          const lockData = await fs.promises.readFile(lockFile, 'utf-8')
          const lockInfo = JSON.parse(lockData)

          if (lockInfo.lockValue !== lockValue) {
            // Lock was acquired by someone else, don't release it
            return
          }
        } catch (error: any) {
          // If lock file doesn't exist, that's fine
          if (error.code === 'ENOENT') {
            return
          }
          throw error
        }
      }

      // Delete the lock file
      await fs.promises.unlink(lockFile)

      // Remove from active locks
      this.activeLocks.delete(lockKey)
    } catch (error: any) {
      if (error.code !== 'ENOENT') {
        console.warn(`Failed to release lock ${lockKey}:`, error)
      }
    }
  }

  /**
   * Clean up expired lock files
   */
  private async cleanupExpiredLocks(): Promise<void> {
    await this.ensureInitialized()

    try {
      const lockFiles = await fs.promises.readdir(this.lockDir)
      const now = Date.now()

      for (const lockFile of lockFiles) {
        if (!lockFile.endsWith('.lock')) continue

        const lockPath = path.join(this.lockDir, lockFile)
        try {
          const lockData = await fs.promises.readFile(lockPath, 'utf-8')
          const lockInfo = JSON.parse(lockData)

          if (lockInfo.expiresAt <= now) {
            await fs.promises.unlink(lockPath)
            const lockKey = lockFile.replace('.lock', '')
            this.activeLocks.delete(lockKey)
          }
        } catch (error) {
          // If we can't read or parse the lock file, remove it
          try {
            await fs.promises.unlink(lockPath)
          } catch (unlinkError) {
            console.warn(
              `Failed to cleanup invalid lock file ${lockPath}:`,
              unlinkError
            )
          }
        }
      }
    } catch (error) {
      console.warn('Failed to cleanup expired locks:', error)
    }
  }

  /**
   * Save statistics data to storage with file-based locking
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
      const existingStats = await this.getStatisticsWithBackwardCompat()

      if (existingStats) {
        // Merge statistics data
        const mergedStats: StatisticsData = {
          totalNodes: Math.max(
            statistics.totalNodes || 0,
            existingStats.totalNodes || 0
          ),
          totalEdges: Math.max(
            statistics.totalEdges || 0,
            existingStats.totalEdges || 0
          ),
          totalMetadata: Math.max(
            statistics.totalMetadata || 0,
            existingStats.totalMetadata || 0
          ),
          // Preserve any additional fields from existing stats
          ...existingStats,
          // Override with new values where provided
          ...statistics,
          // Always update lastUpdated to current time
          lastUpdated: new Date().toISOString()
        }
        await this.saveStatisticsWithBackwardCompat(mergedStats)
      } else {
        // No existing statistics, save new ones
        const newStats: StatisticsData = {
          ...statistics,
          lastUpdated: new Date().toISOString()
        }
        await this.saveStatisticsWithBackwardCompat(newStats)
      }
    } finally {
      if (lockAcquired) {
        await this.releaseLock(lockKey)
      }
    }
  }

  /**
   * Get statistics data from storage
   */
  protected async getStatisticsData(): Promise<StatisticsData | null> {
    return this.getStatisticsWithBackwardCompat()
  }

  /**
   * Save statistics with backward compatibility (dual write)
   */
  private async saveStatisticsWithBackwardCompat(statistics: StatisticsData): Promise<void> {
    // Always write to new location
    const newPath = path.join(this.systemDir, `${STATISTICS_KEY}.json`)
    await this.ensureDirectoryExists(this.systemDir)
    await fs.promises.writeFile(newPath, JSON.stringify(statistics, null, 2))
    
    // During migration period, also write to old location if it exists
    if (this.useDualWrite && await this.directoryExists(this.indexDir)) {
      const oldPath = path.join(this.indexDir, `${STATISTICS_KEY}.json`)
      try {
        await fs.promises.writeFile(oldPath, JSON.stringify(statistics, null, 2))
      } catch (error) {
        // Log but don't fail if old location write fails
        StorageCompatibilityLayer.logMigrationEvent(
          'Failed to write to legacy location',
          { path: oldPath, error }
        )
      }
    }
  }

  /**
   * Get statistics with backward compatibility (dual read)
   */
  private async getStatisticsWithBackwardCompat(): Promise<StatisticsData | null> {
    let newStats: StatisticsData | null = null
    let oldStats: StatisticsData | null = null
    
    // Try to read from new location first
    try {
      const newPath = path.join(this.systemDir, `${STATISTICS_KEY}.json`)
      const data = await fs.promises.readFile(newPath, 'utf-8')
      newStats = JSON.parse(data)
    } catch (error: any) {
      if (error.code !== 'ENOENT') {
        console.error('Error reading statistics from new location:', error)
      }
    }
    
    // Try to read from old location as fallback
    if (!newStats && await this.directoryExists(this.indexDir)) {
      try {
        const oldPath = path.join(this.indexDir, `${STATISTICS_KEY}.json`)
        const data = await fs.promises.readFile(oldPath, 'utf-8')
        oldStats = JSON.parse(data)
        
        // If we found data in old location but not new, migrate it
        if (oldStats && !newStats) {
          StorageCompatibilityLayer.logMigrationEvent(
            'Migrating statistics from legacy location'
          )
          await this.saveStatisticsWithBackwardCompat(oldStats)
        }
      } catch (error: any) {
        if (error.code !== 'ENOENT') {
          console.error('Error reading statistics from old location:', error)
        }
      }
    }
    
    // Merge statistics from both locations
    return this.mergeStatistics(newStats, oldStats)
  }

  /**
   * Merge statistics from multiple sources
   */
  private mergeStatistics(
    storageStats: StatisticsData | null,
    localStats: StatisticsData | null
  ): StatisticsData {
    // Handle null cases
    if (!storageStats && !localStats) {
      return {
        nounCount: {},
        verbCount: {},
        metadataCount: {},
        hnswIndexSize: 0,
        totalNodes: 0,
        totalEdges: 0,
        lastUpdated: new Date().toISOString()
      }
    }
    if (!storageStats) return localStats!
    if (!localStats) return storageStats

    // Merge noun counts by taking the maximum of each type
    const mergedNounCount: Record<string, number> = {
      ...storageStats.nounCount
    }
    for (const [type, count] of Object.entries(localStats.nounCount)) {
      mergedNounCount[type] = Math.max(mergedNounCount[type] || 0, count)
    }

    // Merge verb counts by taking the maximum of each type
    const mergedVerbCount: Record<string, number> = {
      ...storageStats.verbCount
    }
    for (const [type, count] of Object.entries(localStats.verbCount)) {
      mergedVerbCount[type] = Math.max(mergedVerbCount[type] || 0, count)
    }

    // Merge metadata counts by taking the maximum of each type
    const mergedMetadataCount: Record<string, number> = {
      ...storageStats.metadataCount
    }
    for (const [type, count] of Object.entries(localStats.metadataCount)) {
      mergedMetadataCount[type] = Math.max(
        mergedMetadataCount[type] || 0,
        count
      )
    }

    return {
      nounCount: mergedNounCount,
      verbCount: mergedVerbCount,
      metadataCount: mergedMetadataCount,
      hnswIndexSize: Math.max(storageStats.hnswIndexSize || 0, localStats.hnswIndexSize || 0),
      totalNodes: Math.max(storageStats.totalNodes || 0, localStats.totalNodes || 0),
      totalEdges: Math.max(storageStats.totalEdges || 0, localStats.totalEdges || 0),
      totalMetadata: Math.max(storageStats.totalMetadata || 0, localStats.totalMetadata || 0),
      operations: storageStats.operations || localStats.operations,
      lastUpdated: new Date().toISOString()
    }
  }

  // =============================================
  // Count Management for O(1) Scalability
  // =============================================

  /**
   * Initialize counts from filesystem storage
   */
  protected async initializeCounts(): Promise<void> {
    if (!this.countsFilePath) return

    try {
      if (await this.fileExists(this.countsFilePath)) {
        const data = await fs.promises.readFile(this.countsFilePath, 'utf-8')
        const counts = JSON.parse(data)

        // Restore entity counts
        this.entityCounts = new Map(Object.entries(counts.entityCounts || {}))
        this.verbCounts = new Map(Object.entries(counts.verbCounts || {}))
        this.totalNounCount = counts.totalNounCount || 0
        this.totalVerbCount = counts.totalVerbCount || 0

        // Also populate the cache for backward compatibility
        this.countCache.set('nouns_count', {
          count: this.totalNounCount,
          timestamp: Date.now()
        })
        this.countCache.set('verbs_count', {
          count: this.totalVerbCount,
          timestamp: Date.now()
        })
      } else {
        // If no counts file exists, do one initial count
        await this.initializeCountsFromDisk()
      }
    } catch (error) {
      console.warn('Could not load persisted counts, will initialize from disk:', error)
      await this.initializeCountsFromDisk()
    }
  }

  /**
   * Initialize counts by scanning disk (only done once)
   */
  private async initializeCountsFromDisk(): Promise<void> {
    try {
      // Count nouns
      const nounFiles = await fs.promises.readdir(this.nounsDir)
      const validNounFiles = nounFiles.filter((f: string) => f.endsWith('.json'))
      this.totalNounCount = validNounFiles.length

      // Count verbs
      const verbFiles = await fs.promises.readdir(this.verbsDir)
      const validVerbFiles = verbFiles.filter((f: string) => f.endsWith('.json'))
      this.totalVerbCount = validVerbFiles.length

      // Sample some files to get type distribution (don't read all)
      const sampleSize = Math.min(100, validNounFiles.length)
      for (let i = 0; i < sampleSize; i++) {
        try {
          const file = validNounFiles[i]
          const data = await fs.promises.readFile(
            path.join(this.nounsDir, file),
            'utf-8'
          )
          const noun = JSON.parse(data)
          const type = noun.metadata?.type || noun.metadata?.nounType || 'default'
          this.entityCounts.set(type, (this.entityCounts.get(type) || 0) + 1)
        } catch {
          // Skip invalid files
        }
      }

      // Extrapolate counts if we sampled
      if (sampleSize < this.totalNounCount && sampleSize > 0) {
        const multiplier = this.totalNounCount / sampleSize
        for (const [type, count] of this.entityCounts.entries()) {
          this.entityCounts.set(type, Math.round(count * multiplier))
        }
      }

      await this.persistCounts()
    } catch (error) {
      console.error('Error initializing counts from disk:', error)
    }
  }

  /**
   * Persist counts to filesystem storage
   */
  protected async persistCounts(): Promise<void> {
    if (!this.countsFilePath) return

    try {
      const counts = {
        entityCounts: Object.fromEntries(this.entityCounts),
        verbCounts: Object.fromEntries(this.verbCounts),
        totalNounCount: this.totalNounCount,
        totalVerbCount: this.totalVerbCount,
        lastUpdated: new Date().toISOString()
      }

      await fs.promises.writeFile(
        this.countsFilePath,
        JSON.stringify(counts, null, 2)
      )
    } catch (error) {
      console.error('Error persisting counts:', error)
    }
  }



  // =============================================
  // Intelligent Directory Sharding
  // =============================================

  /**
   * Determine optimal sharding depth based on dataset size
   * This is called once during initialization for consistent behavior
   */
  private getOptimalShardingDepth(): number {
    // For new installations, use intelligent defaults
    if (this.totalNounCount === 0 && this.totalVerbCount === 0) {
      return 1 // Default to single-level sharding for new installs
    }

    const maxCount = Math.max(this.totalNounCount, this.totalVerbCount)

    if (maxCount >= this.SHARDING_THRESHOLD) {
      return 2 // Deep sharding for large datasets
    } else if (maxCount >= 100) {
      return 1 // Single-level sharding for medium datasets
    } else {
      return 1 // Always use at least single-level sharding for consistency
    }
  }

  /**
   * Get the path for a node with consistent sharding strategy
   * Clean, predictable path generation
   */
  private getNodePath(id: string): string {
    return this.getShardedPath(this.nounsDir, id)
  }

  /**
   * Get the path for a verb with consistent sharding strategy
   */
  private getVerbPath(id: string): string {
    return this.getShardedPath(this.verbsDir, id)
  }

  /**
   * Universal sharded path generator
   * Consistent across all entity types
   */
  private getShardedPath(baseDir: string, id: string): string {
    const depth = this.cachedShardingDepth ?? this.getOptimalShardingDepth()

    switch (depth) {
      case 0:
        // Flat structure: /nouns/uuid.json
        return path.join(baseDir, `${id}.json`)

      case 1:
        // Single-level sharding: /nouns/ab/uuid.json
        const shard1 = id.substring(0, 2)
        return path.join(baseDir, shard1, `${id}.json`)

      case 2:
      default:
        // Deep sharding: /nouns/ab/cd/uuid.json
        const shard1Deep = id.substring(0, 2)
        const shard2Deep = id.substring(2, 4)
        return path.join(baseDir, shard1Deep, shard2Deep, `${id}.json`)
    }
  }

  /**
   * Check if a file exists (handles both sharded and non-sharded)
   */
  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.promises.access(filePath, fs.constants.F_OK)
      return true
    } catch {
      return false
    }
  }
}
