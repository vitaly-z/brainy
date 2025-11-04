/**
 * CommitObject: Snapshot metadata for COW (Copy-on-Write)
 *
 * Similar to Git commits, represents a point-in-time snapshot of a Brainy instance.
 * Commits reference tree objects and parent commits, forming a directed acyclic graph (DAG).
 *
 * Structure:
 * - tree: hash of root tree object (contains all data)
 * - parent: hash of parent commit (null for initial commit)
 * - message: human-readable commit message
 * - author: who/what created this commit
 * - timestamp: when this commit was created
 * - metadata: additional commit metadata (tags, etc.)
 *
 * @module storage/cow/CommitObject
 */

import { BlobStorage } from './BlobStorage.js'
import { isNullHash } from './constants.js'

/**
 * Commit object structure
 */
export interface CommitObject {
  tree: string           // Root tree hash
  parent: string | null  // Parent commit hash (null for initial commit)
  message: string        // Commit message
  author: string         // Author (user, system, augmentation)
  timestamp: number      // Unix timestamp (milliseconds)
  metadata?: {
    tags?: string[]           // Tags (e.g., ['v1.0.0', 'production'])
    branch?: string           // Branch name (e.g., 'main', 'experiment')
    operation?: string        // Operation type (e.g., 'add', 'update', 'delete', 'merge')
    entityCount?: number      // Number of entities at this commit
    relationshipCount?: number // Number of relationships at this commit
    [key: string]: any        // Custom metadata
  }
}

/**
 * CommitBuilder: Fluent API for building commit objects
 *
 * Example:
 * ```typescript
 * const commit = await CommitBuilder.create(blobStorage)
 *   .tree(treeHash)
 *   .parent(parentHash)
 *   .message('Add user entities')
 *   .author('system')
 *   .tag('v1.0.0')
 *   .build()
 * ```
 */
export class CommitBuilder {
  private _tree?: string
  private _parent?: string | null
  private _message: string = 'Auto-commit'
  private _author: string = 'system'
  private _timestamp: number = Date.now()
  private _metadata: NonNullable<CommitObject['metadata']> = {}
  private blobStorage: BlobStorage

  constructor(blobStorage: BlobStorage) {
    this.blobStorage = blobStorage
  }

  static create(blobStorage: BlobStorage): CommitBuilder {
    return new CommitBuilder(blobStorage)
  }

  /**
   * Set tree hash
   */
  tree(hash: string): this {
    this._tree = hash
    return this
  }

  /**
   * Set parent commit hash (null for initial commit)
   */
  parent(hash: string | null): this {
    this._parent = hash
    return this
  }

  /**
   * Set commit message
   */
  message(message: string): this {
    this._message = message
    return this
  }

  /**
   * Set commit author
   */
  author(author: string): this {
    this._author = author
    return this
  }

  /**
   * Set commit timestamp (defaults to now)
   */
  timestamp(timestamp: number | Date): this {
    this._timestamp = typeof timestamp === 'number' ? timestamp : timestamp.getTime()
    return this
  }

  /**
   * Add tag to commit
   */
  tag(tag: string): this {
    if (!this._metadata.tags) {
      this._metadata.tags = []
    }
    this._metadata.tags.push(tag)
    return this
  }

  /**
   * Set branch name
   */
  branch(branch: string): this {
    this._metadata.branch = branch
    return this
  }

  /**
   * Set operation type
   */
  operation(operation: string): this {
    this._metadata.operation = operation
    return this
  }

  /**
   * Set entity count
   */
  entityCount(count: number): this {
    this._metadata.entityCount = count
    return this
  }

  /**
   * Set relationship count
   */
  relationshipCount(count: number): this {
    this._metadata.relationshipCount = count
    return this
  }

  /**
   * Set custom metadata
   */
  meta(key: string, value: any): this {
    this._metadata[key] = value
    return this
  }

  /**
   * Build and persist the commit object
   *
   * @returns Commit hash
   */
  async build(): Promise<string> {
    if (!this._tree) {
      throw new Error('CommitBuilder: tree hash is required')
    }

    const commit: CommitObject = {
      tree: this._tree,
      parent: this._parent ?? null,
      message: this._message,
      author: this._author,
      timestamp: this._timestamp,
      metadata: Object.keys(this._metadata).length > 0 ? this._metadata : undefined
    }

    return CommitObject.write(this.blobStorage, commit)
  }
}

/**
 * CommitObject: Represents a point-in-time snapshot in COW storage
 */
export class CommitObject {
  /**
   * Serialize commit object to Buffer
   *
   * Format: JSON (simple, debuggable)
   * Future: Could use protobuf for efficiency
   *
   * @param commit - Commit object
   * @returns Serialized commit
   */
  static serialize(commit: CommitObject): Buffer {
    return Buffer.from(JSON.stringify(commit, null, 0))  // Compact JSON
  }

  /**
   * Deserialize commit object from Buffer
   *
   * @param data - Serialized commit
   * @returns Commit object
   */
  static deserialize(data: Buffer): CommitObject {
    const commit = JSON.parse(data.toString())

    // Validate structure
    if (typeof commit.tree !== 'string' || commit.tree.length !== 64) {
      throw new Error('Invalid commit object: tree must be 64-char SHA-256')
    }

    if (commit.parent !== null && (typeof commit.parent !== 'string' || commit.parent.length !== 64)) {
      throw new Error('Invalid commit object: parent must be 64-char SHA-256 or null')
    }

    if (typeof commit.message !== 'string') {
      throw new Error('Invalid commit object: message must be string')
    }

    if (typeof commit.author !== 'string') {
      throw new Error('Invalid commit object: author must be string')
    }

    if (typeof commit.timestamp !== 'number') {
      throw new Error('Invalid commit object: timestamp must be number')
    }

    if (commit.metadata !== undefined && typeof commit.metadata !== 'object') {
      throw new Error('Invalid commit object: metadata must be object')
    }

    return commit
  }

  /**
   * Compute hash of commit object
   *
   * @param commit - Commit object
   * @returns SHA-256 hash
   */
  static hash(commit: CommitObject): string {
    const data = CommitObject.serialize(commit)
    return BlobStorage.hash(data)
  }

  /**
   * Write commit object to blob storage
   *
   * @param blobStorage - Blob storage instance
   * @param commit - Commit object
   * @returns Commit hash
   */
  static async write(blobStorage: BlobStorage, commit: CommitObject): Promise<string> {
    const data = CommitObject.serialize(commit)
    return blobStorage.write(data, { type: 'commit', compression: 'auto' })
  }

  /**
   * Read commit object from blob storage
   *
   * @param blobStorage - Blob storage instance
   * @param hash - Commit hash
   * @returns Commit object
   */
  static async read(blobStorage: BlobStorage, hash: string): Promise<CommitObject> {
    const data = await blobStorage.read(hash)
    return CommitObject.deserialize(data)
  }

  /**
   * Check if commit is initial commit (has no parent)
   *
   * @param commit - Commit object
   * @returns True if initial commit
   */
  static isInitial(commit: CommitObject): boolean {
    return commit.parent === null
  }

  /**
   * Check if commit is merge commit (has multiple parents)
   * (Future enhancement: support merge commits with multiple parents)
   *
   * @param commit - Commit object
   * @returns True if merge commit
   */
  static isMerge(commit: CommitObject): boolean {
    // For now, we only support single-parent commits
    // Future: extend to support multiple parents
    return commit.metadata?.merge !== undefined
  }

  /**
   * Check if commit has a specific tag
   *
   * @param commit - Commit object
   * @param tag - Tag to check
   * @returns True if commit has tag
   */
  static hasTag(commit: CommitObject, tag: string): boolean {
    return commit.metadata?.tags?.includes(tag) ?? false
  }

  /**
   * Get all tags from commit
   *
   * @param commit - Commit object
   * @returns Array of tags
   */
  static getTags(commit: CommitObject): string[] {
    return commit.metadata?.tags ?? []
  }

  /**
   * Walk commit history (traverse DAG)
   *
   * Yields commits in reverse chronological order (newest first)
   *
   * @param blobStorage - Blob storage instance
   * @param startHash - Starting commit hash
   * @param options - Walk options
   */
  static async *walk(
    blobStorage: BlobStorage,
    startHash: string,
    options?: {
      maxDepth?: number       // Maximum depth to walk
      until?: number          // Stop at this timestamp
      stopAt?: string         // Stop at this commit hash
      filter?: (commit: CommitObject) => boolean
    }
  ): AsyncIterableIterator<CommitObject> {
    let currentHash: string | null = startHash
    let depth = 0

    // v5.3.4 fix: Guard against NULL hash (sentinel for "no parent")
    // The initial commit has parent = null or NULL_HASH ('0000...0000')
    // We must stop walking when we reach it, not try to read it
    while (currentHash && !isNullHash(currentHash)) {
      // Check max depth
      if (options?.maxDepth && depth >= options.maxDepth) {
        break
      }

      // Read commit
      const commit = await CommitObject.read(blobStorage, currentHash)

      // Check filter
      if (options?.filter && !options.filter(commit)) {
        currentHash = commit.parent
        depth++
        continue
      }

      // Yield commit
      yield commit

      // Check stop conditions
      if (options?.until && commit.timestamp < options.until) {
        break
      }

      if (options?.stopAt && currentHash === options.stopAt) {
        break
      }

      // Move to parent (can be null or NULL_HASH for initial commit)
      currentHash = commit.parent
      depth++
    }
  }

  /**
   * Find commit at or before a specific timestamp
   *
   * @param blobStorage - Blob storage instance
   * @param startHash - Starting commit hash (e.g., 'main' ref)
   * @param timestamp - Target timestamp
   * @returns Commit at or before timestamp, or null if not found
   */
  static async findAtTime(
    blobStorage: BlobStorage,
    startHash: string,
    timestamp: number
  ): Promise<CommitObject | null> {
    for await (const commit of CommitObject.walk(blobStorage, startHash)) {
      if (commit.timestamp <= timestamp) {
        return commit
      }
    }

    return null
  }

  /**
   * Get commit history as array (newest first)
   *
   * @param blobStorage - Blob storage instance
   * @param startHash - Starting commit hash
   * @param options - Walk options
   * @returns Array of commits
   */
  static async getHistory(
    blobStorage: BlobStorage,
    startHash: string,
    options?: {
      maxDepth?: number
      until?: number
      stopAt?: string
    }
  ): Promise<CommitObject[]> {
    const commits: CommitObject[] = []

    for await (const commit of CommitObject.walk(blobStorage, startHash, options)) {
      commits.push(commit)
    }

    return commits
  }

  /**
   * Find common ancestor of two commits (merge base)
   *
   * Useful for diff/merge operations
   *
   * @param blobStorage - Blob storage instance
   * @param hash1 - First commit hash
   * @param hash2 - Second commit hash
   * @returns Common ancestor commit, or null if not found
   */
  static async findCommonAncestor(
    blobStorage: BlobStorage,
    hash1: string,
    hash2: string
  ): Promise<CommitObject | null> {
    // Build set of all ancestors of commit1
    const ancestors1 = new Set<string>()

    for await (const commit of CommitObject.walk(blobStorage, hash1)) {
      ancestors1.add(CommitObject.hash(commit))
    }

    // Walk commit2 history, find first commit in ancestors1
    for await (const commit of CommitObject.walk(blobStorage, hash2)) {
      const commitHash = CommitObject.hash(commit)
      if (ancestors1.has(commitHash)) {
        return commit
      }
    }

    return null
  }

  /**
   * Count commits between two commits
   *
   * @param blobStorage - Blob storage instance
   * @param fromHash - Starting commit hash
   * @param toHash - Ending commit hash
   * @returns Number of commits between (inclusive)
   */
  static async countBetween(
    blobStorage: BlobStorage,
    fromHash: string,
    toHash: string
  ): Promise<number> {
    let count = 0

    for await (const commit of CommitObject.walk(blobStorage, fromHash, {
      stopAt: toHash
    })) {
      count++
    }

    return count
  }

  /**
   * Get commits in time range
   *
   * @param blobStorage - Blob storage instance
   * @param startHash - Starting commit hash
   * @param startTime - Start of time range
   * @param endTime - End of time range
   * @returns Array of commits in range
   */
  static async getInTimeRange(
    blobStorage: BlobStorage,
    startHash: string,
    startTime: number,
    endTime: number
  ): Promise<CommitObject[]> {
    const commits: CommitObject[] = []

    for await (const commit of CommitObject.walk(blobStorage, startHash, {
      until: startTime
    })) {
      if (commit.timestamp >= startTime && commit.timestamp <= endTime) {
        commits.push(commit)
      }
    }

    return commits
  }

  /**
   * Get commits by author
   *
   * @param blobStorage - Blob storage instance
   * @param startHash - Starting commit hash
   * @param author - Author name
   * @param options - Walk options
   * @returns Array of commits by author
   */
  static async getByAuthor(
    blobStorage: BlobStorage,
    startHash: string,
    author: string,
    options?: { maxDepth?: number }
  ): Promise<CommitObject[]> {
    const commits: CommitObject[] = []

    for await (const commit of CommitObject.walk(blobStorage, startHash, {
      ...options,
      filter: c => c.author === author
    })) {
      commits.push(commit)
    }

    return commits
  }

  /**
   * Get commits by operation type
   *
   * @param blobStorage - Blob storage instance
   * @param startHash - Starting commit hash
   * @param operation - Operation type (e.g., 'add', 'update', 'delete')
   * @param options - Walk options
   * @returns Array of commits by operation
   */
  static async getByOperation(
    blobStorage: BlobStorage,
    startHash: string,
    operation: string,
    options?: { maxDepth?: number }
  ): Promise<CommitObject[]> {
    const commits: CommitObject[] = []

    for await (const commit of CommitObject.walk(blobStorage, startHash, {
      ...options,
      filter: c => c.metadata?.operation === operation
    })) {
      commits.push(commit)
    }

    return commits
  }
}
