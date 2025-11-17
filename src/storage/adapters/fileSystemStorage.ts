/**
 * File System Storage Adapter
 * File system storage adapter for Node.js environments
 */

import {
  GraphVerb,
  HNSWNoun,
  HNSWVerb,
  NounMetadata,
  VerbMetadata,
  HNSWNounWithMetadata,
  HNSWVerbWithMetadata,
  StatisticsData,
  NounType
} from '../../coreTypes.js'
import {
  BaseStorage,
  StorageBatchConfig,
  SYSTEM_DIR,
  STATISTICS_KEY
} from '../baseStorage.js'

// Type aliases for better readability
type HNSWNode = HNSWNoun
type Edge = HNSWVerb

// Node.js modules - dynamically imported to avoid issues in browser environments
let fs: any
let path: any
let zlib: any
let moduleLoadingPromise: Promise<void> | null = null

// Try to load Node.js modules
try {
  // Using dynamic imports to avoid issues in browser environments
  const fsPromise = import('node:fs')
  const pathPromise = import('node:path')
  const zlibPromise = import('node:zlib')

  moduleLoadingPromise = Promise.all([fsPromise, pathPromise, zlibPromise])
    .then(([fsModule, pathModule, zlibModule]) => {
      fs = fsModule
      path = pathModule.default
      zlib = zlibModule
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
 *
 * v5.4.0: Type-aware storage now built into BaseStorage
 * - Removed 10 *_internal method overrides (now inherit from BaseStorage's type-first implementation)
 * - Removed 2 pagination method overrides (getNounsWithPagination, getVerbsWithPagination)
 * - Updated HNSW methods to use BaseStorage's getNoun/saveNoun (type-first paths)
 * - All operations now use type-first paths: entities/nouns/{type}/vectors/{shard}/{id}.json
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
  private systemDir!: string
  private lockDir!: string
  private activeLocks: Set<string> = new Set()
  private lockTimers: Map<string, NodeJS.Timeout> = new Map()  // Track timers for cleanup
  private allTimers: Set<NodeJS.Timeout> = new Set()  // Track all timers for cleanup

  // CRITICAL FIX (v4.10.1): Mutex locks for HNSW concurrency control
  // Prevents read-modify-write races during concurrent neighbor updates at scale (1000+ ops)
  // Matches MemoryStorage and OPFSStorage behavior (tested in production)
  private hnswLocks = new Map<string, Promise<void>>()

  // Compression configuration (v4.0.0)
  private compressionEnabled: boolean = true  // Enable gzip compression by default for 60-80% disk savings
  private compressionLevel: number = 6  // zlib compression level (1-9, default: 6 = balanced)

  /**
   * Initialize the storage adapter
   * @param rootDirectory The root directory for storage
   * @param options Optional configuration
   */
  constructor(
    rootDirectory: string,
    options?: {
      compression?: boolean  // Enable gzip compression (default: true)
      compressionLevel?: number  // Compression level 1-9 (default: 6)
    }
  ) {
    super()
    this.rootDir = rootDirectory

    // Configure compression
    if (options?.compression !== undefined) {
      this.compressionEnabled = options.compression
    }
    if (options?.compressionLevel !== undefined) {
      this.compressionLevel = Math.min(9, Math.max(1, options.compressionLevel))
    }

    // Defer path operations until init() when path module is guaranteed to be loaded
  }

  /**
   * Get FileSystem-optimized batch configuration
   *
   * File system storage is I/O bound but not rate limited:
   * - Large batch sizes (500 items)
   * - No delays needed (0ms)
   * - Moderate concurrency (100 operations) - limited by I/O threads
   * - Parallel processing supported
   *
   * @returns FileSystem-optimized batch configuration
   * @since v4.11.0
   */
  public getBatchConfig(): StorageBatchConfig {
    return {
      maxBatchSize: 500,
      batchDelayMs: 0,
      maxConcurrent: 100,
      supportsParallelWrites: true,  // Filesystem handles parallel I/O
      rateLimit: {
        operationsPerSecond: 5000,  // Depends on disk speed
        burstCapacity: 2000
      }
    }
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
      // Clean directory structure (v4.7.2+)
      this.nounsDir = path.join(this.rootDir, 'entities/nouns/hnsw')
      this.verbsDir = path.join(this.rootDir, 'entities/verbs/hnsw')
      this.metadataDir = path.join(this.rootDir, 'entities/nouns/metadata')  // Legacy reference
      this.nounMetadataDir = path.join(this.rootDir, 'entities/nouns/metadata')
      this.verbMetadataDir = path.join(this.rootDir, 'entities/verbs/metadata')
      this.indexDir = path.join(this.rootDir, 'indexes')
      this.systemDir = path.join(this.rootDir, SYSTEM_DIR)
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
   * CRITICAL FIX (v4.10.3): Added atomic write pattern to prevent file corruption during concurrent imports
   */
  protected async saveNode(node: HNSWNode): Promise<void> {
    await this.ensureInitialized()

    // Convert connections Map to a serializable format
    // CRITICAL: Only save lightweight vector data (no metadata)
    // Metadata is saved separately via saveNounMetadata() (2-file system)
    const serializableNode = {
      id: node.id,
      vector: node.vector,
      connections: this.mapToObject(node.connections, (set) =>
        Array.from(set as Set<string>)
      ),
      level: node.level || 0
      // NO metadata field - saved separately for scalability
    }

    const filePath = this.getNodePath(node.id)
    const tempPath = `${filePath}.tmp.${Date.now()}.${Math.random().toString(36).substring(2)}`

    try {
      // ATOMIC WRITE SEQUENCE (v4.10.3):
      // 1. Write to temp file
      await this.ensureDirectoryExists(path.dirname(tempPath))
      await fs.promises.writeFile(tempPath, JSON.stringify(serializableNode, null, 2))

      // 2. Atomic rename temp → final (crash-safe, prevents truncation during concurrent writes)
      await fs.promises.rename(tempPath, filePath)
    } catch (error: any) {
      // Clean up temp file on any error
      try {
        await fs.promises.unlink(tempPath)
      } catch (cleanupError) {
        // Ignore cleanup errors
      }
      throw error
    }

    // Count tracking happens in baseStorage.saveNounMetadata_internal (v4.1.2)
    // This fixes the race condition where metadata didn't exist yet
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

      // CRITICAL: Only return lightweight vector data (no metadata)
      // Metadata is retrieved separately via getNounMetadata() (2-file system)
      return {
        id: parsedNode.id,
        vector: parsedNode.vector,
        connections,
        level: parsedNode.level || 0
        // NO metadata field - retrieved separately for scalability
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
   * CRITICAL FIX (v3.43.2): Now scans sharded subdirectories (depth=1)
   * Previously only scanned flat directory, causing rebuild to find 0 entities
   */
  protected async getAllNodes(): Promise<HNSWNode[]> {
    await this.ensureInitialized()

    const allNodes: HNSWNode[] = []
    try {
      // FIX: Use sharded file discovery instead of flat directory read
      // This scans all 256 shard subdirectories (00-ff) to find actual files
      const files = await this.getAllShardedFiles(this.nounsDir)

      for (const file of files) {
        // Extract ID from filename and use sharded path
        const id = file.replace('.json', '')
        const filePath = this.getNodePath(id)

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
    } catch (error: any) {
      if (error.code !== 'ENOENT') {
        console.error(`Error reading directory ${this.nounsDir}:`, error)
      }
    }
    return allNodes
  }

  /**
   * Get nodes by noun type
   * CRITICAL FIX (v3.43.2): Now scans sharded subdirectories (depth=1)
   * @param nounType The noun type to filter by
   * @returns Promise that resolves to an array of nodes of the specified noun type
   */
  protected async getNodesByNounType(nounType: string): Promise<HNSWNode[]> {
    await this.ensureInitialized()

    const nouns: HNSWNode[] = []
    try {
      // FIX: Use sharded file discovery instead of flat directory read
      const files = await this.getAllShardedFiles(this.nounsDir)

      for (const file of files) {
        // Extract ID from filename and use sharded path
        const nodeId = file.replace('.json', '')
        const filePath = this.getNodePath(nodeId)

        const data = await fs.promises.readFile(filePath, 'utf-8')
        const parsedNode = JSON.parse(data)

        // Filter by noun type using metadata
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

    // Load metadata to get type for count update (v4.0.0: separate storage)
    try {
      const metadata = await this.getNounMetadata(id)
      if (metadata) {
        const type = metadata.noun || 'default'
        this.decrementEntityCount(type)
      }
    } catch {
      // Metadata might not exist, that's ok
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
   * CRITICAL FIX (v4.10.3): Added atomic write pattern to prevent file corruption during concurrent imports
   */
  protected async saveEdge(edge: Edge): Promise<void> {
    await this.ensureInitialized()

    // Convert connections Map to a serializable format
    // ARCHITECTURAL FIX (v3.50.1): Include core relational fields in verb vector file
    // These fields are essential for 90% of operations - no metadata lookup needed
    const serializableEdge = {
      id: edge.id,
      vector: edge.vector,
      connections: this.mapToObject(edge.connections, (set) =>
        Array.from(set as Set<string>)
      ),

      // CORE RELATIONAL DATA (v3.50.1+)
      verb: edge.verb,
      sourceId: edge.sourceId,
      targetId: edge.targetId,

      // User metadata (if any) - saved separately for scalability
      // metadata field is saved separately via saveVerbMetadata()
    }

    const filePath = this.getVerbPath(edge.id)
    const tempPath = `${filePath}.tmp.${Date.now()}.${Math.random().toString(36).substring(2)}`

    try {
      // ATOMIC WRITE SEQUENCE (v4.10.3):
      // 1. Write to temp file
      await this.ensureDirectoryExists(path.dirname(tempPath))
      await fs.promises.writeFile(tempPath, JSON.stringify(serializableEdge, null, 2))

      // 2. Atomic rename temp → final (crash-safe, prevents truncation during concurrent writes)
      await fs.promises.rename(tempPath, filePath)
    } catch (error: any) {
      // Clean up temp file on any error
      try {
        await fs.promises.unlink(tempPath)
      } catch (cleanupError) {
        // Ignore cleanup errors
      }
      throw error
    }

    // Count tracking happens in baseStorage.saveVerbMetadata_internal (v4.1.2)
    // This fixes the race condition where metadata didn't exist yet
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

      // v4.0.0: Return HNSWVerb with core relational fields (NO metadata field)
      return {
        id: parsedEdge.id,
        vector: parsedEdge.vector,
        connections,

        // CORE RELATIONAL DATA (read from vector file)
        verb: parsedEdge.verb,
        sourceId: parsedEdge.sourceId,
        targetId: parsedEdge.targetId

        // ✅ NO metadata field in v4.0.0
        // User metadata retrieved separately via getVerbMetadata()
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
   * CRITICAL FIX (v3.43.2): Now scans sharded subdirectories (depth=1)
   * Previously only scanned flat directory, causing rebuild to find 0 relationships
   */
  protected async getAllEdges(): Promise<Edge[]> {
    await this.ensureInitialized()

    const allEdges: Edge[] = []
    try {
      // FIX: Use sharded file discovery instead of flat directory read
      // This scans all 256 shard subdirectories (00-ff) to find actual files
      const files = await this.getAllShardedFiles(this.verbsDir)

      for (const file of files) {
        // Extract ID from filename and use sharded path
        const id = file.replace('.json', '')
        const filePath = this.getVerbPath(id)

        const data = await fs.promises.readFile(filePath, 'utf-8')
        const parsedEdge = JSON.parse(data)

        // Convert serialized connections back to Map<number, Set<string>>
        const connections = new Map<number, Set<string>>()
        for (const [level, nodeIds] of Object.entries(
          parsedEdge.connections
        )) {
          connections.set(Number(level), new Set(nodeIds as string[]))
        }

        // v4.0.0: Include core relational fields (NO metadata field)
        allEdges.push({
          id: parsedEdge.id,
          vector: parsedEdge.vector,
          connections,

          // CORE RELATIONAL DATA
          verb: parsedEdge.verb,
          sourceId: parsedEdge.sourceId,
          targetId: parsedEdge.targetId

          // ✅ NO metadata field in v4.0.0
          // User metadata retrieved separately via getVerbMetadata()
        })
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

    // Delete the HNSWVerb file using sharded path
    const filePath = this.getVerbPath(id)
    try {
      await fs.promises.unlink(filePath)
    } catch (error: any) {
      if (error.code !== 'ENOENT') {
        console.error(`Error deleting edge file ${filePath}:`, error)
        throw error
      }
    }

    // CRITICAL: Also delete verb metadata - this is what getVerbs() uses to find verbs
    // Without this, getVerbsBySource() will still find "deleted" verbs via their metadata
    try {
      const metadata = await this.getVerbMetadata(id)
      if (metadata) {
        const verbType = (metadata.verb || metadata.type || 'default') as string
        this.decrementVerbCount(verbType)
        await this.deleteVerbMetadata(id)
      }
    } catch (error) {
      // Ignore metadata deletion errors - verb file is already deleted
      console.warn(`Failed to delete verb metadata for ${id}:`, error)
    }
  }

  /**
   * Primitive operation: Write object to path
   * All metadata operations use this internally via base class routing
   * v4.0.0: Supports gzip compression for 60-80% disk savings
   * CRITICAL FIX (v4.10.3): Added atomic write pattern to prevent file corruption during concurrent imports
   */
  protected async writeObjectToPath(pathStr: string, data: any): Promise<void> {
    await this.ensureInitialized()

    const fullPath = path.join(this.rootDir, pathStr)
    await this.ensureDirectoryExists(path.dirname(fullPath))

    if (this.compressionEnabled) {
      // Write compressed data with .gz extension using atomic pattern
      const compressedPath = `${fullPath}.gz`
      const tempPath = `${compressedPath}.tmp.${Date.now()}.${Math.random().toString(36).substring(2)}`

      try {
        // ATOMIC WRITE SEQUENCE (v4.10.3):
        // 1. Compress and write to temp file
        const jsonString = JSON.stringify(data, null, 2)
        const compressed = await new Promise<Buffer>((resolve, reject) => {
          zlib.gzip(Buffer.from(jsonString, 'utf-8'), { level: this.compressionLevel }, (err: any, result: Buffer) => {
            if (err) reject(err)
            else resolve(result)
          })
        })
        await fs.promises.writeFile(tempPath, compressed)

        // 2. Atomic rename temp → final (crash-safe, prevents truncation during concurrent writes)
        await fs.promises.rename(tempPath, compressedPath)
      } catch (error: any) {
        // Clean up temp file on any error
        try {
          await fs.promises.unlink(tempPath)
        } catch (cleanupError) {
          // Ignore cleanup errors
        }
        throw error
      }

      // Clean up uncompressed file if it exists (migration from uncompressed)
      try {
        await fs.promises.unlink(fullPath)
      } catch (error: any) {
        // Ignore if file doesn't exist
        if (error.code !== 'ENOENT') {
          console.warn(`Failed to remove uncompressed file ${fullPath}:`, error)
        }
      }
    } else {
      // Write uncompressed data using atomic pattern
      const tempPath = `${fullPath}.tmp.${Date.now()}.${Math.random().toString(36).substring(2)}`

      try {
        // ATOMIC WRITE SEQUENCE (v4.10.3):
        // 1. Write to temp file
        await fs.promises.writeFile(tempPath, JSON.stringify(data, null, 2))

        // 2. Atomic rename temp → final (crash-safe, prevents truncation during concurrent writes)
        await fs.promises.rename(tempPath, fullPath)
      } catch (error: any) {
        // Clean up temp file on any error
        try {
          await fs.promises.unlink(tempPath)
        } catch (cleanupError) {
          // Ignore cleanup errors
        }
        throw error
      }
    }
  }

  /**
   * Primitive operation: Read object from path
   * All metadata operations use this internally via base class routing
   * Enhanced error handling for corrupted metadata files (Bug #3 mitigation)
   * v4.0.0: Supports reading both compressed (.gz) and uncompressed files for backward compatibility
   */
  protected async readObjectFromPath(pathStr: string): Promise<any | null> {
    await this.ensureInitialized()

    const fullPath = path.join(this.rootDir, pathStr)
    const compressedPath = `${fullPath}.gz`

    // Try reading compressed file first (if compression is enabled or file exists)
    try {
      const compressedData = await fs.promises.readFile(compressedPath)
      const decompressed = await new Promise<Buffer>((resolve, reject) => {
        zlib.gunzip(compressedData, (err: any, result: Buffer) => {
          if (err) reject(err)
          else resolve(result)
        })
      })
      return JSON.parse(decompressed.toString('utf-8'))
    } catch (error: any) {
      // If compressed file doesn't exist, fall back to uncompressed
      if (error.code !== 'ENOENT') {
        console.warn(`Failed to read compressed file ${compressedPath}:`, error)
      }
    }

    // Fall back to reading uncompressed file (for backward compatibility)
    try {
      const data = await fs.promises.readFile(fullPath, 'utf-8')
      return JSON.parse(data)
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        return null
      }

      // Enhanced error handling for corrupted JSON files (race condition from Bug #3)
      if (error instanceof SyntaxError || error.name === 'SyntaxError') {
        console.warn(
          `⚠️  Corrupted metadata file detected: ${pathStr}\n` +
          `   This may be caused by concurrent writes during import.\n` +
          `   Gracefully skipping this entry. File may be repaired on next write.`
        )
        return null
      }

      console.error(`Error reading object from ${pathStr}:`, error)
      return null
    }
  }

  /**
   * Primitive operation: Delete object from path
   * All metadata operations use this internally via base class routing
   * v4.0.0: Deletes both compressed and uncompressed versions (for cleanup)
   */
  protected async deleteObjectFromPath(pathStr: string): Promise<void> {
    await this.ensureInitialized()

    const fullPath = path.join(this.rootDir, pathStr)
    const compressedPath = `${fullPath}.gz`

    // Try deleting both compressed and uncompressed files (for cleanup during migration)
    let deletedCount = 0

    // Delete compressed file
    try {
      await fs.promises.unlink(compressedPath)
      deletedCount++
    } catch (error: any) {
      if (error.code !== 'ENOENT') {
        console.warn(`Error deleting compressed file ${compressedPath}:`, error)
      }
    }

    // Delete uncompressed file
    try {
      await fs.promises.unlink(fullPath)
      deletedCount++
    } catch (error: any) {
      if (error.code !== 'ENOENT') {
        console.error(`Error deleting uncompressed file ${pathStr}:`, error)
        throw error
      }
    }

    // If neither file existed, it's not an error (already deleted)
    if (deletedCount === 0) {
      // File doesn't exist - this is fine
    }
  }

  /**
   * Primitive operation: List objects under path prefix
   * All metadata operations use this internally via base class routing
   * v4.0.0: Handles both .json and .json.gz files, normalizes paths
   */
  protected async listObjectsUnderPath(prefix: string): Promise<string[]> {
    await this.ensureInitialized()

    const fullPath = path.join(this.rootDir, prefix)
    const paths: string[] = []
    const seen = new Set<string>() // Track files to avoid duplicates (both .json and .json.gz)

    try {
      const entries = await fs.promises.readdir(fullPath, { withFileTypes: true })

      for (const entry of entries) {
        if (entry.isFile()) {
          // v5.3.5: Handle multiple compression formats for broad compatibility
          // - .json.gz: Standard entity/metadata files (JSON compressed)
          // - .gz: COW files (refs, blobs, commits - raw compressed)
          // - .json: Uncompressed JSON files
          if (entry.name.endsWith('.json.gz')) {
            // Strip .gz extension and add the .json path
            const normalizedName = entry.name.slice(0, -3) // Remove .gz
            const normalizedPath = path.join(prefix, normalizedName)
            if (!seen.has(normalizedPath)) {
              paths.push(normalizedPath)
              seen.add(normalizedPath)
            }
          } else if (entry.name.endsWith('.gz')) {
            // v5.3.5 fix: COW files stored as .gz (not .json.gz)
            // Strip .gz extension and return path
            const normalizedName = entry.name.slice(0, -3) // Remove .gz
            const normalizedPath = path.join(prefix, normalizedName)
            if (!seen.has(normalizedPath)) {
              paths.push(normalizedPath)
              seen.add(normalizedPath)
            }
          } else if (entry.name.endsWith('.json')) {
            const filePath = path.join(prefix, entry.name)
            if (!seen.has(filePath)) {
              paths.push(filePath)
              seen.add(filePath)
            }
          }
        } else if (entry.isDirectory()) {
          const subpath = path.join(prefix, entry.name)
          const subdirPaths = await this.listObjectsUnderPath(subpath)
          paths.push(...subdirPaths)
        }
      }

      return paths.sort()
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        return []
      }
      throw error
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
          // CRITICAL: Use getNounMetadata() instead of deprecated getMetadata()
          // This ensures we fetch from the correct noun metadata store (2-file system)
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
   * Get nouns with pagination support
   * @param options Pagination options
   */
  // v5.4.0: Removed getNounsWithPagination override - now uses BaseStorage's type-first implementation

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

    // v5.10.4: Clear the entire branches/ directory (branch-based storage)
    // Bug fix: Data is stored in branches/main/entities/, not just entities/
    // The branch-based structure was introduced for COW support
    const branchesDir = path.join(this.rootDir, 'branches')
    if (await this.directoryExists(branchesDir)) {
      await removeDirectoryContents(branchesDir)
    }

    // Remove all files in both system directories
    await removeDirectoryContents(this.systemDir)
    if (await this.directoryExists(this.indexDir)) {
      await removeDirectoryContents(this.indexDir)
    }

    // v5.6.1: Remove COW (copy-on-write) version control data
    // This directory stores all git-like versioning data (commits, trees, blobs, refs)
    // Must be deleted to fully clear all data including version history
    const cowDir = path.join(this.rootDir, '_cow')
    if (await this.directoryExists(cowDir)) {
      // Delete the entire _cow/ directory (not just contents)
      await fs.promises.rm(cowDir, { recursive: true, force: true })

      // CRITICAL: Reset COW state to prevent automatic reinitialization
      // When COW data is cleared, we must also clear the COW managers
      // Otherwise initializeCOW() will auto-recreate initial commit on next operation
      this.refManager = undefined
      this.blobStorage = undefined
      this.commitLog = undefined
      this.cowEnabled = false

      // v5.10.4: Create persistent marker file (CRITICAL FIX)
      // Bug: cowEnabled = false only affects current instance, not future instances
      // Fix: Create marker file that persists across instance restarts
      // When new instance calls initializeCOW(), it checks for this marker
      await this.createClearMarker()
    }

    // Clear the statistics cache
    this.statisticsCache = null
    this.statisticsModified = false

    // v5.6.1: Reset entity counters (inherited from BaseStorageAdapter)
    // These in-memory counters must be reset to 0 after clearing all data
    ;(this as any).totalNounCount = 0
    ;(this as any).totalVerbCount = 0
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
   * Check if COW has been explicitly disabled via clear()
   * v5.10.4: Fixes bug where clear() doesn't persist across instance restarts
   * @returns true if marker file exists, false otherwise
   * @protected
   */
  protected async checkClearMarker(): Promise<boolean> {
    // Check if fs module is available
    if (!fs || !fs.promises) {
      return false
    }

    try {
      const markerPath = path.join(this.systemDir, 'cow-disabled')
      await fs.promises.access(markerPath, fs.constants.F_OK)
      return true // Marker exists
    } catch (error) {
      return false // Marker doesn't exist (ENOENT) or can't be accessed
    }
  }

  /**
   * Create marker indicating COW has been explicitly disabled
   * v5.10.4: Called by clear() to prevent COW reinitialization on new instances
   * @protected
   */
  protected async createClearMarker(): Promise<void> {
    // Check if fs module is available
    if (!fs || !fs.promises) {
      console.warn('FileSystemStorage.createClearMarker: fs module not available, skipping marker creation')
      return
    }

    try {
      const markerPath = path.join(this.systemDir, 'cow-disabled')
      // Create empty marker file
      await fs.promises.writeFile(markerPath, '', 'utf8')
    } catch (error) {
      console.error('FileSystemStorage.createClearMarker: Failed to create marker file', error)
      // Don't throw - marker creation failure shouldn't break clear()
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

      // CRITICAL FIX (v3.43.2): Use persisted counts instead of directory reads
      // This is O(1) instead of O(n), and handles sharded structure correctly
      const nounsCount = this.totalNounCount
      const verbsCount = this.totalVerbCount

      // Count metadata files (these are NOT sharded)
      const metadataCount = (
        await fs.promises.readdir(this.metadataDir)
      ).filter((file: string) => file.endsWith('.json')).length

      // Use persisted entity counts by type (O(1) instead of scanning all files)
      const nounTypeCounts: Record<string, number> = Object.fromEntries(this.entityCounts)

      // Skip the expensive metadata file scan since we have counts
      const metadataFiles: string[] = []  // Empty array to skip the loop below
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

  // v5.4.0: Removed 10 *_internal method overrides - now inherit from BaseStorage's type-first implementation
  // v5.4.0: Removed 2 pagination methods (getNounsWithPagination, getVerbsWithPagination) - use BaseStorage's implementation

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
      const existingStats = await this.getStatisticsData()

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
    try {
      const statsPath = path.join(this.systemDir, `${STATISTICS_KEY}.json`)
      const data = await fs.promises.readFile(statsPath, 'utf-8')
      return JSON.parse(data)
    } catch (error: any) {
      if (error.code !== 'ENOENT') {
        console.error('Error reading statistics:', error)
      }
      return null
    }
  }

  /**
   * Save statistics to storage
   */
  private async saveStatisticsWithBackwardCompat(statistics: StatisticsData): Promise<void> {
    const statsPath = path.join(this.systemDir, `${STATISTICS_KEY}.json`)
    await this.ensureDirectoryExists(this.systemDir)
    await fs.promises.writeFile(statsPath, JSON.stringify(statistics, null, 2))
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
      // v4.0.0: Load metadata separately for type information
      const sampleSize = Math.min(100, validNounFiles.length)
      for (let i = 0; i < sampleSize; i++) {
        try {
          const file = validNounFiles[i]
          const id = file.replace('.json', '')

          // v4.0.0: Load metadata from separate storage for type info
          const metadata = await this.getNounMetadata(id)
          if (metadata) {
            const type = metadata.noun || 'default'
            this.entityCounts.set(type, (this.entityCounts.get(type) || 0) + 1)
          }
        } catch {
          // Skip invalid files or missing metadata
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
    items: HNSWVerbWithMetadata[]
    totalCount?: number
    hasMore: boolean
    nextCursor?: string
  }> {
    const verbs: HNSWVerbWithMetadata[] = []
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

            // v4.8.1: Don't skip verbs without metadata - metadata is optional
            // FIX: This was the root cause of the VFS bug (11 versions)
            // Verbs can exist without metadata files (e.g., from imports/migrations)

            // Convert connections if needed
            let connections = edge.connections
            if (connections && typeof connections === 'object' && !(connections instanceof Map)) {
              const connectionsMap = new Map<number, Set<string>>()
              for (const [level, nodeIds] of Object.entries(connections)) {
                connectionsMap.set(Number(level), new Set(nodeIds as string[]))
              }
              connections = connectionsMap
            }

            // v4.8.0: Extract standard fields from metadata to top-level
            const metadataObj = (metadata || {}) as VerbMetadata
            const { createdAt, updatedAt, confidence, weight, service, data: dataField, createdBy, ...customMetadata } = metadataObj

            const verbWithMetadata: HNSWVerbWithMetadata = {
              id: edge.id,
              vector: edge.vector,
              connections: connections || new Map(),
              verb: edge.verb,
              sourceId: edge.sourceId,
              targetId: edge.targetId,
              createdAt: (createdAt as number) || Date.now(),
              updatedAt: (updatedAt as number) || Date.now(),
              confidence: confidence as number | undefined,
              weight: weight as number | undefined,
              service: service as string | undefined,
              data: dataField as Record<string, any> | undefined,
              createdBy,
              metadata: customMetadata
            }

            // Apply filters
            if (options.filter) {
              const filter = options.filter

              if (filter.verbType) {
                const types = Array.isArray(filter.verbType) ? filter.verbType : [filter.verbType]
                if (!types.includes(verbWithMetadata.verb)) return true // continue
              }

              if (filter.sourceId) {
                const sources = Array.isArray(filter.sourceId) ? filter.sourceId : [filter.sourceId]
                if (!sources.includes(verbWithMetadata.sourceId)) return true // continue
              }

              if (filter.targetId) {
                const targets = Array.isArray(filter.targetId) ? filter.targetId : [filter.targetId]
                if (!targets.includes(verbWithMetadata.targetId)) return true // continue
              }
            }

            verbs.push(verbWithMetadata)
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

  // =============================================
  // HNSW Index Persistence (v3.35.0+)
  // =============================================

  /**
   * Get vector for a noun
   * v5.4.0: Uses BaseStorage's getNoun (type-first paths)
   */
  public async getNounVector(id: string): Promise<number[] | null> {
    const noun = await this.getNoun(id)
    return noun ? noun.vector : null
  }

  /**
   * Save HNSW graph data for a noun
   *
   * v5.4.0: Uses BaseStorage's getNoun/saveNoun (type-first paths)
   * CRITICAL: Preserves mutex locking to prevent read-modify-write races
   */
  public async saveHNSWData(nounId: string, hnswData: {
    level: number
    connections: Record<string, string[]>
  }): Promise<void> {
    const lockKey = `hnsw/${nounId}`

    // CRITICAL FIX (v4.10.1): Mutex lock to prevent read-modify-write races
    // Problem: Without mutex, concurrent operations can:
    //   1. Thread A reads noun (connections: [1,2,3])
    //   2. Thread B reads noun (connections: [1,2,3])
    //   3. Thread A adds connection 4, writes [1,2,3,4]
    //   4. Thread B adds connection 5, writes [1,2,3,5] ← Connection 4 LOST!
    // Solution: Mutex serializes operations per entity (like Memory/OPFS adapters)
    // Production scale: Prevents corruption at 1000+ concurrent operations

    // Wait for any pending operations on this entity
    while (this.hnswLocks.has(lockKey)) {
      await this.hnswLocks.get(lockKey)
    }

    // Acquire lock
    let releaseLock!: () => void
    const lockPromise = new Promise<void>(resolve => { releaseLock = resolve })
    this.hnswLocks.set(lockKey, lockPromise)

    try {
      // v5.4.0: Use BaseStorage's getNoun (type-first paths)
      // Read existing noun data (if exists)
      const existingNoun = await this.getNoun(nounId)

      if (!existingNoun) {
        // Noun doesn't exist - cannot update HNSW data for non-existent noun
        throw new Error(`Cannot save HNSW data: noun ${nounId} not found`)
      }

      // Convert connections from Record to Map format for storage
      const connectionsMap = new Map<number, Set<string>>()
      for (const [level, nodeIds] of Object.entries(hnswData.connections)) {
        connectionsMap.set(Number(level), new Set(nodeIds))
      }

      // Preserve id and vector, update only HNSW graph metadata
      const updatedNoun: HNSWNoun = {
        ...existingNoun,
        level: hnswData.level,
        connections: connectionsMap
      }

      // v5.4.0: Use BaseStorage's saveNoun (type-first paths, atomic write)
      await this.saveNoun(updatedNoun)
    } finally {
      // Release lock (ALWAYS runs, even if error thrown)
      this.hnswLocks.delete(lockKey)
      releaseLock()
    }
  }

  /**
   * Get HNSW graph data for a noun
   * v5.4.0: Uses BaseStorage's getNoun (type-first paths)
   */
  public async getHNSWData(nounId: string): Promise<{
    level: number
    connections: Record<string, string[]>
  } | null> {
    const noun = await this.getNoun(nounId)

    if (!noun) {
      return null
    }

    // Convert connections from Map to Record format
    const connectionsRecord: Record<string, string[]> = {}
    if (noun.connections) {
      for (const [level, nodeIds] of noun.connections.entries()) {
        connectionsRecord[String(level)] = Array.from(nodeIds)
      }
    }

    return {
      level: noun.level || 0,
      connections: connectionsRecord
    }
  }

  /**
   * Save HNSW system data (entry point, max level)
   *
   * CRITICAL FIX (v4.10.1): Mutex lock + atomic write to prevent race conditions
   */
  public async saveHNSWSystem(systemData: {
    entryPointId: string | null
    maxLevel: number
  }): Promise<void> {
    await this.ensureInitialized()

    const lockKey = 'hnsw/system'

    // CRITICAL FIX (v4.10.1): Mutex lock to serialize system updates
    // System data (entry point, max level) updated frequently during HNSW construction
    // Without mutex, concurrent updates can lose data (same as entity-level problem)

    // Wait for any pending system updates
    while (this.hnswLocks.has(lockKey)) {
      await this.hnswLocks.get(lockKey)
    }

    // Acquire lock
    let releaseLock!: () => void
    const lockPromise = new Promise<void>(resolve => { releaseLock = resolve })
    this.hnswLocks.set(lockKey, lockPromise)

    try {
      const filePath = path.join(this.systemDir, 'hnsw-system.json')
      const tempPath = `${filePath}.tmp.${Date.now()}.${Math.random().toString(36).substring(2)}`

      try {
        // Write to temp file
        await this.ensureDirectoryExists(path.dirname(tempPath))
        await fs.promises.writeFile(tempPath, JSON.stringify(systemData, null, 2))

        // Atomic rename temp → final (POSIX atomicity guarantee)
        await fs.promises.rename(tempPath, filePath)
      } catch (error: any) {
        // Clean up temp file on any error
        try {
          await fs.promises.unlink(tempPath)
        } catch (cleanupError) {
          // Ignore cleanup errors
        }
        throw error
      }
    } finally {
      // Release lock
      this.hnswLocks.delete(lockKey)
      releaseLock()
    }
  }

  /**
   * Get HNSW system data
   */
  public async getHNSWSystem(): Promise<{
    entryPointId: string | null
    maxLevel: number
  } | null> {
    await this.ensureInitialized()

    const filePath = path.join(this.systemDir, 'hnsw-system.json')

    try {
      const data = await fs.promises.readFile(filePath, 'utf-8')
      return JSON.parse(data)
    } catch (error: any) {
      if (error.code !== 'ENOENT') {
        console.error('Error reading HNSW system data:', error)
      }
      return null
    }
  }
}
