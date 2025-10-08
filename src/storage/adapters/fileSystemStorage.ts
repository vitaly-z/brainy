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

  // Fixed sharding configuration for optimal balance of simplicity and performance
  // Single-level sharding (depth=1) provides excellent performance for 1-2.5M entities
  // Structure: nouns/ab/uuid.json where 'ab' = first 2 hex chars of UUID
  // - 256 shard directories (00-ff)
  // - Handles 2.5M+ entities with < 10K files per shard
  // - Eliminates dynamic depth changes that cause path mismatch bugs
  private readonly SHARDING_DEPTH = 1 as const
  private readonly MAX_SHARDS = 256 // Hex range: 00-ff
  private cachedShardingDepth: number = this.SHARDING_DEPTH // Always use fixed depth
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

      // Detect existing sharding structure and migrate if needed
      const detectedDepth = await this.detectExistingShardingDepth()

      if (detectedDepth !== null && detectedDepth !== this.SHARDING_DEPTH) {
        // Migration needed: existing structure doesn't match our fixed depth
        console.log(`📦 Brainy Storage Migration`)
        console.log(`   Current structure: depth ${detectedDepth}`)
        console.log(`   Target structure: depth ${this.SHARDING_DEPTH}`)
        console.log(`   Entities to migrate: ${this.totalNounCount}`)

        await this.migrateShardingStructure(detectedDepth, this.SHARDING_DEPTH)

        console.log(`✅ Migration complete - now using depth ${this.SHARDING_DEPTH} sharding`)
      } else if (detectedDepth === null) {
        // New installation
        console.log(`📁 New installation: using depth ${this.SHARDING_DEPTH} sharding (optimal for 1-2.5M entities)`)
      } else {
        // Already using correct depth
        console.log(`📁 Using depth ${this.SHARDING_DEPTH} sharding (${this.totalNounCount} entities)`)
      }

      // Always use fixed depth after migration/detection
      this.cachedShardingDepth = this.SHARDING_DEPTH

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
        level: parsedNode.level || 0,
        metadata: parsedNode.metadata
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

    // Check if this is a new edge to update counts
    const isNew = !(await this.fileExists(this.getVerbPath(edge.id)))

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

    // Update verb count for new edges (production-scale optimizations)
    if (isNew) {
      this.totalVerbCount++

      // Persist counts periodically (every 10 operations for efficiency)
      if (this.totalVerbCount % 10 === 0) {
        this.persistCounts() // Async persist, don't await
      }
    }
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
   * Save noun metadata to storage
   */
  protected async saveNounMetadata_internal(id: string, metadata: any): Promise<void> {
    await this.ensureInitialized()

    // Use UUID-based sharding for metadata (consistent with noun vectors)
    const filePath = this.getShardedPath(this.nounMetadataDir, id)

    // Ensure shard directory exists
    const shardDir = path.dirname(filePath)
    await fs.promises.mkdir(shardDir, { recursive: true })

    await fs.promises.writeFile(filePath, JSON.stringify(metadata, null, 2))
  }

  /**
   * Get noun metadata from storage
   */
  public async getNounMetadata(id: string): Promise<any | null> {
    await this.ensureInitialized()

    // Use UUID-based sharding for metadata (consistent with noun vectors)
    const filePath = this.getShardedPath(this.nounMetadataDir, id)
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

    console.log(`[DEBUG] Saving verb metadata for ${id} to: ${this.verbMetadataDir}`)
    const filePath = path.join(this.verbMetadataDir, `${id}.json`)
    console.log(`[DEBUG] Full file path: ${filePath}`)

    try {
      await this.ensureDirectoryExists(path.dirname(filePath))
      console.log(`[DEBUG] Directory ensured: ${path.dirname(filePath)}`)

      await fs.promises.writeFile(filePath, JSON.stringify(metadata, null, 2))
      console.log(`[DEBUG] File written successfully: ${filePath}`)

      // Verify the file was actually written
      const exists = await fs.promises.access(filePath).then(() => true).catch(() => false)
      console.log(`[DEBUG] File exists after write: ${exists}`)
    } catch (error) {
      console.error(`[DEBUG] Error saving verb metadata:`, error)
      throw error
    }
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
      // Get all noun files (handles sharding properly)
      const nounFiles = await this.getAllShardedFiles(this.nounsDir)
      
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
          const id = file.replace('.json', '')
          const data = await fs.promises.readFile(
            this.getNodePath(id),
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
      // Get actual verb files first (critical for accuracy)
      const verbFiles = await this.getAllShardedFiles(this.verbsDir)
      verbFiles.sort() // Consistent ordering for pagination

      // Use actual file count - don't trust cached totalVerbCount
      // This prevents accessing undefined array elements
      const actualFileCount = verbFiles.length

      // For large datasets, warn about performance
      if (actualFileCount > 1000000) {
        console.warn(`Very large verb dataset detected (${actualFileCount} verbs). Performance may be degraded. Consider database storage for optimal performance.`)
      }

      // For production-scale datasets, use streaming approach
      if (actualFileCount > 50000) {
        return await this.getVerbsWithPaginationStreaming(options, startIndex, limit)
      }

      // Calculate pagination bounds using ACTUAL file count
      const endIndex = Math.min(startIndex + limit, actualFileCount)

      // Load the requested page of verbs
      const verbs: GraphVerb[] = []
      let successfullyLoaded = 0

      for (let i = startIndex; i < endIndex; i++) {
        const file = verbFiles[i]

        // CRITICAL: Null-safety check for undefined array elements
        if (!file) {
          console.warn(`Unexpected undefined file at index ${i}, skipping`)
          continue
        }

        const id = file.replace('.json', '')
        
        try {
          // Read the verb data (HNSWVerb stored as edge) - use sharded path
          const filePath = this.getVerbPath(id)
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
          successfullyLoaded++
        } catch (error) {
          console.warn(`Failed to read verb ${id}:`, error)
        }
      }

      // CRITICAL FIX: hasMore based on actual file count, not cached totalVerbCount
      // Also verify we successfully loaded items (prevents infinite loops on corrupted storage)
      const hasMore = (endIndex < actualFileCount) && (successfullyLoaded > 0 || startIndex === 0)

      return {
        items: verbs,
        totalCount: actualFileCount, // Return actual count, not cached value
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
      // CRITICAL: Detect existing depth before counting
      // Can't use getAllShardedFiles() which assumes depth=1
      const existingDepth = await this.detectExistingShardingDepth()
      const depthToUse = existingDepth !== null ? existingDepth : this.SHARDING_DEPTH

      // Count nouns using detected depth
      const validNounFiles = await this.getAllFilesAtDepth(this.nounsDir, depthToUse)
      this.totalNounCount = validNounFiles.length

      // Count verbs using detected depth
      const validVerbFiles = await this.getAllFilesAtDepth(this.verbsDir, depthToUse)
      this.totalVerbCount = validVerbFiles.length

      // Sample some files to get type distribution (don't read all)
      const sampleSize = Math.min(100, validNounFiles.length)
      for (let i = 0; i < sampleSize; i++) {
        try {
          const file = validNounFiles[i]
          const id = file.replace('.json', '')

          // Construct path using detected depth (not cached depth which may be wrong)
          let filePath: string
          switch (depthToUse) {
            case 0:
              filePath = path.join(this.nounsDir, `${id}.json`)
              break
            case 1:
              filePath = path.join(this.nounsDir, id.substring(0, 2), `${id}.json`)
              break
            case 2:
              filePath = path.join(this.nounsDir, id.substring(0, 2), id.substring(2, 4), `${id}.json`)
              break
            default:
              throw new Error(`Unsupported depth: ${depthToUse}`)
          }

          const data = await fs.promises.readFile(filePath, 'utf-8')
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
   * Migrate files from one sharding depth to another
   * Handles: 0→1 (flat to single-level), 2→1 (deep to single-level)
   * Uses atomic file operations and comprehensive error handling
   *
   * @param fromDepth - Source sharding depth
   * @param toDepth - Target sharding depth (must be 1)
   */
  private async migrateShardingStructure(fromDepth: number, toDepth: number): Promise<void> {
    // Validation
    if (fromDepth === toDepth) {
      throw new Error(`Migration not needed: already at depth ${toDepth}`)
    }

    if (toDepth !== 1) {
      throw new Error(`Migration only supports target depth 1 (got ${toDepth})`)
    }

    if (fromDepth !== 0 && fromDepth !== 2) {
      throw new Error(`Migration only supports source depth 0 or 2 (got ${fromDepth})`)
    }

    // Create migration lock to prevent concurrent migrations
    const lockFile = path.join(this.systemDir, '.migration-lock')
    const lockExists = await this.fileExists(lockFile)

    if (lockExists) {
      // Check if lock is stale (> 1 hour old)
      try {
        const stats = await fs.promises.stat(lockFile)
        const lockAge = Date.now() - stats.mtimeMs
        const ONE_HOUR = 60 * 60 * 1000

        if (lockAge < ONE_HOUR) {
          throw new Error(
            'Migration already in progress. If this is incorrect, delete .migration-lock file.'
          )
        }

        // Lock is stale, remove it
        console.log('⚠️  Removing stale migration lock (> 1 hour old)')
        await fs.promises.unlink(lockFile)
      } catch (error: any) {
        if (error.code !== 'ENOENT') {
          throw error
        }
      }
    }

    try {
      // Create lock file
      await fs.promises.writeFile(lockFile, JSON.stringify({
        startedAt: new Date().toISOString(),
        fromDepth,
        toDepth,
        pid: process.pid
      }))

      // Discover all files to migrate
      console.log('📊 Discovering files to migrate...')
      const filesToMigrate = await this.discoverFilesForMigration(fromDepth)

      if (filesToMigrate.length === 0) {
        console.log('ℹ️  No files to migrate')
        return
      }

      console.log(`📦 Migrating ${filesToMigrate.length} files...`)

      // Create all target shard directories upfront
      await this.createAllShardDirectories(this.nounsDir)
      await this.createAllShardDirectories(this.verbsDir)

      // Migrate files with progress tracking
      let migratedCount = 0
      let skippedCount = 0
      const errors: Array<{ file: string; error: string }> = []

      for (const fileInfo of filesToMigrate) {
        try {
          await this.migrateFile(fileInfo, fromDepth, toDepth)
          migratedCount++

          // Progress update every 1000 files
          if (migratedCount % 1000 === 0) {
            const percent = ((migratedCount / filesToMigrate.length) * 100).toFixed(1)
            console.log(`   📊 Progress: ${migratedCount}/${filesToMigrate.length} (${percent}%)`)
          }

          // Yield to event loop every 100 files to prevent blocking
          if (migratedCount % 100 === 0) {
            await new Promise(resolve => setImmediate(resolve))
          }
        } catch (error: any) {
          skippedCount++
          errors.push({
            file: fileInfo.oldPath,
            error: error.message
          })

          // Log first few errors
          if (errors.length <= 5) {
            console.warn(`⚠️  Skipped ${fileInfo.oldPath}: ${error.message}`)
          }
        }
      }

      // Final summary
      console.log(`\n✅ Migration Results:`)
      console.log(`   Migrated: ${migratedCount} files`)
      console.log(`   Skipped: ${skippedCount} files`)

      if (errors.length > 0) {
        console.warn(`\n⚠️  ${errors.length} files could not be migrated`)
        if (errors.length > 5) {
          console.warn(`   (First 5 errors shown above, ${errors.length - 5} more occurred)`)
        }
      }

      // Cleanup: Remove empty old directories
      if (fromDepth === 0) {
        // No subdirectories to clean for flat structure
      } else if (fromDepth === 2) {
        await this.cleanupEmptyDirectories(this.nounsDir, fromDepth)
        await this.cleanupEmptyDirectories(this.verbsDir, fromDepth)
      }

      // Verification: Count files in new structure
      const verifyCount = await this.countFilesInStructure(toDepth)
      console.log(`\n🔍 Verification: ${verifyCount} files in new structure`)

      if (verifyCount < migratedCount) {
        console.warn(`⚠️  Warning: Verification count (${verifyCount}) < migrated count (${migratedCount})`)
      }
    } finally {
      // Always remove lock file
      try {
        await fs.promises.unlink(lockFile)
      } catch (error) {
        // Ignore error if lock file doesn't exist
      }
    }
  }

  /**
   * Discover all files that need to be migrated
   * Constructs correct oldPath based on source depth
   */
  private async discoverFilesForMigration(fromDepth: number): Promise<Array<{ oldPath: string; id: string; type: 'noun' | 'verb' }>> {
    const files: Array<{ oldPath: string; id: string; type: 'noun' | 'verb' }> = []

    // Discover noun files
    const nounFiles = await this.getAllFilesAtDepth(this.nounsDir, fromDepth)
    for (const filename of nounFiles) {
      const id = filename.replace('.json', '')

      // Construct correct oldPath based on fromDepth
      let oldPath: string
      switch (fromDepth) {
        case 0:
          // Flat: nouns/uuid.json
          oldPath = path.join(this.nounsDir, `${id}.json`)
          break
        case 1:
          // Single-level: nouns/ab/uuid.json
          oldPath = path.join(this.nounsDir, id.substring(0, 2), `${id}.json`)
          break
        case 2:
          // Deep: nouns/ab/cd/uuid.json
          oldPath = path.join(this.nounsDir, id.substring(0, 2), id.substring(2, 4), `${id}.json`)
          break
        default:
          throw new Error(`Unsupported fromDepth: ${fromDepth}`)
      }

      files.push({ oldPath, id, type: 'noun' })
    }

    // Discover verb files
    const verbFiles = await this.getAllFilesAtDepth(this.verbsDir, fromDepth)
    for (const filename of verbFiles) {
      const id = filename.replace('.json', '')

      // Construct correct oldPath based on fromDepth
      let oldPath: string
      switch (fromDepth) {
        case 0:
          // Flat: verbs/uuid.json
          oldPath = path.join(this.verbsDir, `${id}.json`)
          break
        case 1:
          // Single-level: verbs/ab/uuid.json
          oldPath = path.join(this.verbsDir, id.substring(0, 2), `${id}.json`)
          break
        case 2:
          // Deep: verbs/ab/cd/uuid.json
          oldPath = path.join(this.verbsDir, id.substring(0, 2), id.substring(2, 4), `${id}.json`)
          break
        default:
          throw new Error(`Unsupported fromDepth: ${fromDepth}`)
      }

      files.push({ oldPath, id, type: 'verb' })
    }

    return files
  }

  /**
   * Get all files at a specific depth
   */
  private async getAllFilesAtDepth(baseDir: string, depth: number): Promise<string[]> {
    const allFiles: string[] = []

    try {
      const dirExists = await this.directoryExists(baseDir)
      if (!dirExists) {
        return []
      }

      switch (depth) {
        case 0:
          // Flat: files directly in baseDir
          const entries = await fs.promises.readdir(baseDir)
          for (const entry of entries) {
            if (entry.endsWith('.json')) {
              allFiles.push(entry)
            }
          }
          break

        case 1:
          // Single-level: baseDir/ab/uuid.json
          const shardDirs = await fs.promises.readdir(baseDir)
          for (const shard of shardDirs) {
            const shardPath = path.join(baseDir, shard)
            try {
              const stat = await fs.promises.stat(shardPath)
              if (stat.isDirectory()) {
                const shardFiles = await fs.promises.readdir(shardPath)
                for (const file of shardFiles) {
                  if (file.endsWith('.json')) {
                    allFiles.push(file)
                  }
                }
              }
            } catch (error) {
              // Skip inaccessible directories
            }
          }
          break

        case 2:
          // Deep: baseDir/ab/cd/uuid.json
          const level1Dirs = await fs.promises.readdir(baseDir)
          for (const level1 of level1Dirs) {
            const level1Path = path.join(baseDir, level1)
            try {
              const level1Stat = await fs.promises.stat(level1Path)
              if (level1Stat.isDirectory()) {
                const level2Dirs = await fs.promises.readdir(level1Path)
                for (const level2 of level2Dirs) {
                  const level2Path = path.join(level1Path, level2)
                  try {
                    const level2Stat = await fs.promises.stat(level2Path)
                    if (level2Stat.isDirectory()) {
                      const files = await fs.promises.readdir(level2Path)
                      for (const file of files) {
                        if (file.endsWith('.json')) {
                          allFiles.push(file)
                        }
                      }
                    }
                  } catch (error) {
                    // Skip inaccessible directories
                  }
                }
              }
            } catch (error) {
              // Skip inaccessible directories
            }
          }
          break
      }
    } catch (error) {
      // Directory doesn't exist or not accessible
    }

    return allFiles
  }

  /**
   * Create all 256 shard directories (00-ff)
   */
  private async createAllShardDirectories(baseDir: string): Promise<void> {
    for (let i = 0; i < this.MAX_SHARDS; i++) {
      const shard = i.toString(16).padStart(2, '0')
      const shardDir = path.join(baseDir, shard)
      await this.ensureDirectoryExists(shardDir)
    }
  }

  /**
   * Migrate a single file atomically
   */
  private async migrateFile(
    fileInfo: { oldPath: string; id: string; type: 'noun' | 'verb' },
    fromDepth: number,
    toDepth: number
  ): Promise<void> {
    const baseDir = fileInfo.type === 'noun' ? this.nounsDir : this.verbsDir

    // Calculate old path (already known)
    const oldPath = fileInfo.oldPath

    // Calculate new path using target depth
    const shard = fileInfo.id.substring(0, 2).toLowerCase()
    const newPath = path.join(baseDir, shard, `${fileInfo.id}.json`)

    // Check if file already exists at new location
    if (await this.fileExists(newPath)) {
      // File already migrated or duplicate - skip
      return
    }

    // Atomic rename/move
    await fs.promises.rename(oldPath, newPath)
  }

  /**
   * Clean up empty directories after migration
   */
  private async cleanupEmptyDirectories(baseDir: string, depth: number): Promise<void> {
    try {
      if (depth === 2) {
        // Clean up level2 and level1 directories
        const level1Dirs = await fs.promises.readdir(baseDir)
        for (const level1 of level1Dirs) {
          const level1Path = path.join(baseDir, level1)
          try {
            const level1Stat = await fs.promises.stat(level1Path)
            if (level1Stat.isDirectory()) {
              const level2Dirs = await fs.promises.readdir(level1Path)
              for (const level2 of level2Dirs) {
                const level2Path = path.join(level1Path, level2)
                try {
                  // Try to remove level2 directory (will fail if not empty)
                  await fs.promises.rmdir(level2Path)
                } catch (error) {
                  // Directory not empty or other error - ignore
                }
              }

              // Try to remove level1 directory
              await fs.promises.rmdir(level1Path)
            }
          } catch (error) {
            // Directory not empty or other error - ignore
          }
        }
      }
    } catch (error) {
      // Cleanup is best-effort, don't throw
    }
  }

  /**
   * Count files in the current structure
   */
  private async countFilesInStructure(depth: number): Promise<number> {
    let count = 0

    count += (await this.getAllFilesAtDepth(this.nounsDir, depth)).length
    count += (await this.getAllFilesAtDepth(this.verbsDir, depth)).length

    return count
  }

  /**
   * Detect the actual sharding depth used by existing files
   * Examines directory structure to determine current sharding strategy
   * Returns null if no files exist yet (new installation)
   */
  private async detectExistingShardingDepth(): Promise<number | null> {
    try {
      // Check if nouns directory exists and has content
      const dirExists = await this.directoryExists(this.nounsDir)
      if (!dirExists) {
        return null // New installation
      }

      const entries = await fs.promises.readdir(this.nounsDir, { withFileTypes: true })

      // Check if there are any .json files directly in nounsDir (flat structure)
      const hasDirectJsonFiles = entries.some((e: any) => e.isFile() && e.name.endsWith('.json'))
      if (hasDirectJsonFiles) {
        return 0 // Flat structure: nouns/uuid.json
      }

      // Check for subdirectories with hex names (sharding directories)
      const subdirs = entries.filter((e: any) => e.isDirectory() && /^[0-9a-f]{2}$/i.test(e.name))
      if (subdirs.length === 0) {
        return null // No files yet
      }

      // Check first subdir to see if it has files or more subdirs
      const firstSubdir = subdirs[0].name
      const subdirPath = path.join(this.nounsDir, firstSubdir)
      const subdirEntries = await fs.promises.readdir(subdirPath, { withFileTypes: true })

      const hasJsonFiles = subdirEntries.some((e: any) => e.isFile() && e.name.endsWith('.json'))
      if (hasJsonFiles) {
        return 1 // Single-level sharding: nouns/ab/uuid.json
      }

      const hasSubSubdirs = subdirEntries.some((e: any) => e.isDirectory() && /^[0-9a-f]{2}$/i.test(e.name))
      if (hasSubSubdirs) {
        return 2 // Deep sharding: nouns/ab/cd/uuid.json
      }

      return 1 // Default to single-level if structure is unclear
    } catch (error) {
      // If we can't read the directory, assume new installation
      return null
    }
  }

  /**
   * Get sharding depth
   * Always returns 1 (single-level sharding) for optimal balance of
   * simplicity, performance, and reliability across all dataset sizes
   *
   * Single-level sharding (depth=1):
   * - 256 shard directories (00-ff)
   * - Handles 2.5M+ entities with excellent performance
   * - No dynamic depth changes = no path mismatch bugs
   * - Industry standard approach (Git uses similar)
   */
  private getOptimalShardingDepth(): number {
    return this.SHARDING_DEPTH
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
   * Always uses depth=1 (single-level sharding) for consistency
   *
   * Format: baseDir/ab/uuid.json
   * Where 'ab' = first 2 hex characters of UUID (lowercase)
   *
   * Validates UUID format and throws descriptive errors
   */
  private getShardedPath(baseDir: string, id: string): string {
    // Extract first 2 characters for shard directory
    const shard = id.substring(0, 2).toLowerCase()

    // Validate shard is valid hex (00-ff)
    if (!/^[0-9a-f]{2}$/.test(shard)) {
      throw new Error(
        `Invalid entity ID format: ${id}. ` +
        `Expected UUID starting with 2 hex characters, got '${shard}'. ` +
        `IDs must be UUIDs or hex strings.`
      )
    }

    // Single-level sharding: baseDir/ab/uuid.json
    return path.join(baseDir, shard, `${id}.json`)
  }

  /**
   * Get all JSON files from the single-level sharded directory structure
   * Traverses all shard subdirectories (00-ff)
   */
  private async getAllShardedFiles(baseDir: string): Promise<string[]> {
    const allFiles: string[] = []

    try {
      const shardDirs = await fs.promises.readdir(baseDir)

      for (const shardDir of shardDirs) {
        const shardPath = path.join(baseDir, shardDir)

        try {
          const stat = await fs.promises.stat(shardPath)

          if (stat.isDirectory()) {
            const shardFiles = await fs.promises.readdir(shardPath)
            for (const file of shardFiles) {
              if (file.endsWith('.json')) {
                allFiles.push(file)
              }
            }
          }
        } catch (shardError) {
          // Skip inaccessible shard directories
          continue
        }
      }

      // Sort for consistent ordering
      allFiles.sort()
      return allFiles

    } catch (error: any) {
      if (error.code === 'ENOENT') {
        // Directory doesn't exist yet
        return []
      }
      throw error
    }
  }

  /**
   * Production-scale streaming pagination for very large datasets
   * Avoids loading all filenames into memory
   */
  private async getVerbsWithPaginationStreaming(
    options: {
      limit?: number
      cursor?: string
      filter?: {
        verbType?: string | string[]
        sourceId?: string | string[]
        targetId?: string | string[]
        service?: string | string[]
        metadata?: Record<string, any>
      }
    },
    startIndex: number,
    limit: number
  ): Promise<{
    items: GraphVerb[]
    totalCount?: number
    hasMore: boolean
    nextCursor?: string
  }> {
    const verbs: GraphVerb[] = []
    let processedCount = 0
    let skippedCount = 0
    let resultCount = 0

    const depth = this.cachedShardingDepth ?? this.getOptimalShardingDepth()

    try {
      // Stream through sharded directories efficiently
      // hasMore=false means we reached the end of files, hasMore=true means streaming stopped early
      const streamingHasMore = await this.streamShardedFiles(
        this.verbsDir,
        depth,
        async (filename: string, filePath: string) => {
          // Skip files until we reach start index
          if (skippedCount < startIndex) {
            skippedCount++
            return true // continue
          }

          // Stop if we have enough results
          if (resultCount >= limit) {
            return false // stop streaming - more files exist
          }

          try {
            const id = filename.replace('.json', '')

            // Read verb data and metadata
            const data = await fs.promises.readFile(filePath, 'utf-8')
            const edge = JSON.parse(data)
            const metadata = await this.getVerbMetadata(id)

            if (!metadata) {
              processedCount++
              return true // continue, skip this verb
            }

            // Reconstruct GraphVerb
            const verb: GraphVerb = {
              id: edge.id,
              vector: edge.vector,
              connections: edge.connections || new Map(),
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

            // Apply filters
            if (options.filter) {
              const filter = options.filter

              if (filter.verbType) {
                const types = Array.isArray(filter.verbType) ? filter.verbType : [filter.verbType]
                const verbType = verb.type || verb.verb
                if (verbType && !types.includes(verbType)) return true // continue
              }

              if (filter.sourceId) {
                const sources = Array.isArray(filter.sourceId) ? filter.sourceId : [filter.sourceId]
                const sourceId = verb.sourceId || verb.source
                if (!sourceId || !sources.includes(sourceId)) return true // continue
              }

              if (filter.targetId) {
                const targets = Array.isArray(filter.targetId) ? filter.targetId : [filter.targetId]
                const targetId = verb.targetId || verb.target
                if (!targetId || !targets.includes(targetId)) return true // continue
              }
            }

            verbs.push(verb)
            resultCount++
            processedCount++
            return true // continue

          } catch (error) {
            console.warn(`Failed to read verb from ${filePath}:`, error)
            processedCount++
            return true // continue
          }
        }
      )

      // CRITICAL FIX: Use streaming result for hasMore, not cached totalVerbCount
      // streamingHasMore=false means we exhausted all files
      // Also verify we loaded items to prevent infinite loops
      const finalHasMore = streamingHasMore && (resultCount > 0 || startIndex === 0)

      return {
        items: verbs,
        totalCount: this.totalVerbCount || undefined, // Return cached count as hint only
        hasMore: finalHasMore,
        nextCursor: finalHasMore ? String(startIndex + resultCount) : undefined
      }

    } catch (error: any) {
      if (error.code === 'ENOENT') {
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
   * Stream through sharded files without loading all names into memory
   * Production-scale implementation for millions of files
   */
  /**
   * Stream through files in single-level sharded structure
   * Calls processor for each file until processor returns false
   * Returns true if more files exist (processor stopped early), false if all processed
   */
  private async streamShardedFiles(
    baseDir: string,
    depth: number,
    processor: (filename: string, fullPath: string) => Promise<boolean>
  ): Promise<boolean> {
    let hasMore = true

    // Single-level sharding (depth=1): baseDir/ab/uuid.json
    try {
      const shardDirs = await fs.promises.readdir(baseDir)
      const sortedShardDirs = shardDirs.sort()

      for (const shardDir of sortedShardDirs) {
        const shardPath = path.join(baseDir, shardDir)

        try {
          const stat = await fs.promises.stat(shardPath)

          if (stat.isDirectory()) {
            const files = await fs.promises.readdir(shardPath)
            const sortedFiles = files.filter((f: string) => f.endsWith('.json')).sort()

            for (const file of sortedFiles) {
              const shouldContinue = await processor(file, path.join(shardPath, file))

              if (!shouldContinue) {
                hasMore = false
                break
              }
            }

            if (!hasMore) break
          }
        } catch (shardError) {
          // Skip inaccessible shard directories
          continue
        }
      }
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        hasMore = false
      }
    }

    return hasMore
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
