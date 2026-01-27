/**
 * CommitLog: Commit history traversal and querying for COW (Copy-on-Write)
 *
 * Provides efficient commit history operations:
 * - Walk commit graph (DAG traversal)
 * - Find commits by time, author, operation
 * - Time-travel queries (asOf)
 * - Commit statistics and analytics
 *
 * Optimizations:
 * - Commit index for fast timestamp lookups
 * - Parent cache for efficient traversal
 * - Lazy loading (only read commits when needed)
 *
 * @module storage/cow/CommitLog
 */

import { BlobStorage } from './BlobStorage.js'
import { CommitObject } from './CommitObject.js'
import { RefManager } from './RefManager.js'

/**
 * Commit index entry (for fast lookups)
 */
interface CommitIndexEntry {
  hash: string
  timestamp: number
  parentHash: string | null
}

/**
 * Commit log statistics
 */
export interface CommitLogStats {
  totalCommits: number
  oldestCommit: number    // Timestamp
  newestCommit: number    // Timestamp
  authors: Set<string>
  operations: Set<string>
  avgCommitInterval: number  // Average time between commits (ms)
}

/**
 * CommitLog: Efficient commit history traversal and querying
 *
 * Pure implementation - modern, clean, fast
 */
export class CommitLog {
  private blobStorage: BlobStorage
  private refManager: RefManager
  private index: Map<string, CommitIndexEntry>
  private indexValid: boolean

  constructor(blobStorage: BlobStorage, refManager: RefManager) {
    this.blobStorage = blobStorage
    this.refManager = refManager
    this.index = new Map()
    this.indexValid = false
  }

  /**
   * Walk commit history from a starting point
   *
   * Yields commits in reverse chronological order (newest first)
   *
   * @param startRef - Starting ref/commit (e.g., 'main', commit hash)
   * @param options - Walk options
   */
  async *walk(
    startRef: string = 'main',
    options?: {
      maxDepth?: number
      until?: number
      stopAt?: string
      filter?: (commit: CommitObject) => boolean
    }
  ): AsyncIterableIterator<CommitObject> {
    // Resolve ref to commit hash
    let startHash: string

    if (/^[a-f0-9]{64}$/.test(startRef)) {
      // Already a commit hash
      startHash = startRef
    } else {
      // Resolve ref
      const commitHash = await this.refManager.resolveRef(startRef)
      if (!commitHash) {
        throw new Error(`Ref not found: ${startRef}`)
      }
      startHash = commitHash
    }

    // Walk using CommitObject (delegates to it)
    yield* CommitObject.walk(this.blobStorage, startHash, options)
  }

  /**
   * Find commit at or before a specific timestamp
   *
   * Uses index for fast O(log n) lookup
   *
   * @param ref - Starting ref (e.g., 'main')
   * @param timestamp - Target timestamp
   * @returns Commit at or before timestamp, or null
   */
  async findAtTime(ref: string, timestamp: number): Promise<CommitObject | null> {
    // Build index if needed
    await this.buildIndex(ref)

    // Binary search in index
    const entries = Array.from(this.index.values()).sort(
      (a, b) => b.timestamp - a.timestamp  // Newest first
    )

    let left = 0
    let right = entries.length - 1
    let result: CommitIndexEntry | null = null

    while (left <= right) {
      const mid = Math.floor((left + right) / 2)
      const entry = entries[mid]

      if (entry.timestamp <= timestamp) {
        result = entry
        right = mid - 1  // Look for newer commit
      } else {
        left = mid + 1   // Look for older commit
      }
    }

    if (!result) {
      return null
    }

    // Read full commit
    return CommitObject.read(this.blobStorage, result.hash)
  }

  /**
   * Get commit by hash
   *
   * @param hash - Commit hash
   * @returns Commit object
   */
  async getCommit(hash: string): Promise<CommitObject> {
    return CommitObject.read(this.blobStorage, hash)
  }

  /**
   * Get commits in time range
   *
   * @param ref - Starting ref
   * @param startTime - Start of time range
   * @param endTime - End of time range
   * @returns Array of commits in range (newest first)
   */
  async getInTimeRange(
    ref: string,
    startTime: number,
    endTime: number
  ): Promise<CommitObject[]> {
    const commits: CommitObject[] = []

    for await (const commit of this.walk(ref, { until: startTime })) {
      if (commit.timestamp >= startTime && commit.timestamp <= endTime) {
        commits.push(commit)
      }
    }

    return commits
  }

  /**
   * Get commits by author
   *
   * @param ref - Starting ref
   * @param author - Author name
   * @param options - Additional options
   * @returns Array of commits by author
   */
  async getByAuthor(
    ref: string,
    author: string,
    options?: { maxCount?: number; since?: number }
  ): Promise<CommitObject[]> {
    const commits: CommitObject[] = []
    let count = 0

    for await (const commit of this.walk(ref, { until: options?.since })) {
      if (commit.author === author) {
        commits.push(commit)
        count++

        if (options?.maxCount && count >= options.maxCount) {
          break
        }
      }
    }

    return commits
  }

  /**
   * Get commits by operation type
   *
   * @param ref - Starting ref
   * @param operation - Operation type (e.g., 'add', 'update', 'delete')
   * @param options - Additional options
   * @returns Array of commits by operation
   */
  async getByOperation(
    ref: string,
    operation: string,
    options?: { maxCount?: number; since?: number }
  ): Promise<CommitObject[]> {
    const commits: CommitObject[] = []
    let count = 0

    for await (const commit of this.walk(ref, { until: options?.since })) {
      if (commit.metadata?.operation === operation) {
        commits.push(commit)
        count++

        if (options?.maxCount && count >= options.maxCount) {
          break
        }
      }
    }

    return commits
  }

  /**
   * Get commit history as array
   *
   * @param ref - Starting ref
   * @param options - Walk options
   * @returns Array of commits (newest first)
   */
  async getHistory(
    ref: string,
    options?: {
      maxCount?: number
      since?: number
      until?: number
    }
  ): Promise<CommitObject[]> {
    const commits: CommitObject[] = []
    let count = 0

    for await (const commit of this.walk(ref, {
      maxDepth: options?.maxCount,
      until: options?.until
    })) {
      if (options?.since && commit.timestamp < options.since) {
        continue
      }

      commits.push(commit)
      count++

      if (options?.maxCount && count >= options.maxCount) {
        break
      }
    }

    return commits
  }

  /**
   * Stream commit history (memory-efficient for large histories)
   *
   * Yields commits one at a time without accumulating in memory.
   * Use this for large commit histories (1000s of commits) where
   * memory efficiency is important.
   *
   * @param ref - Starting ref
   * @param options - Walk options
   * @yields Commits in reverse chronological order (newest first)
   *
   * @example
   * ```typescript
   * // Stream all commits without memory accumulation
   * for await (const commit of commitLog.streamHistory('main', { maxCount: 10000 })) {
   *   console.log(commit.message)
   * }
   * ```
   */
  async *streamHistory(
    ref: string,
    options?: {
      maxCount?: number
      since?: number
      until?: number
    }
  ): AsyncIterableIterator<CommitObject> {
    let count = 0

    for await (const commit of this.walk(ref, {
      maxDepth: options?.maxCount,
      until: options?.until
    })) {
      // Filter by since timestamp if provided
      if (options?.since && commit.timestamp < options.since) {
        continue
      }

      yield commit
      count++

      // Stop after maxCount commits
      if (options?.maxCount && count >= options.maxCount) {
        break
      }
    }
  }

  /**
   * Count commits between two commits
   *
   * @param fromRef - Starting ref/commit
   * @param toRef - Ending ref/commit (optional, defaults to fromRef's parent)
   * @returns Number of commits between
   */
  async countBetween(fromRef: string, toRef?: string): Promise<number> {
    const fromHash = await this.resolveToHash(fromRef)
    const toHash = toRef ? await this.resolveToHash(toRef) : null

    return CommitObject.countBetween(this.blobStorage, fromHash, toHash!)
  }

  /**
   * Find common ancestor of two commits (merge base)
   *
   * @param ref1 - First ref/commit
   * @param ref2 - Second ref/commit
   * @returns Common ancestor commit or null
   */
  async findCommonAncestor(
    ref1: string,
    ref2: string
  ): Promise<CommitObject | null> {
    const hash1 = await this.resolveToHash(ref1)
    const hash2 = await this.resolveToHash(ref2)

    return CommitObject.findCommonAncestor(this.blobStorage, hash1, hash2)
  }

  /**
   * Get commit log statistics
   *
   * @param ref - Starting ref
   * @param options - Options
   * @returns Commit log statistics
   */
  async getStats(
    ref: string = 'main',
    options?: { maxDepth?: number }
  ): Promise<CommitLogStats> {
    const authors = new Set<string>()
    const operations = new Set<string>()
    const timestamps: number[] = []
    let totalCommits = 0

    for await (const commit of this.walk(ref, options)) {
      totalCommits++
      authors.add(commit.author)
      timestamps.push(commit.timestamp)

      if (commit.metadata?.operation) {
        operations.add(commit.metadata.operation)
      }
    }

    // Calculate average interval
    let avgInterval = 0
    if (timestamps.length > 1) {
      const intervals: number[] = []
      for (let i = 0; i < timestamps.length - 1; i++) {
        intervals.push(timestamps[i] - timestamps[i + 1])
      }
      avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length
    }

    return {
      totalCommits,
      oldestCommit: timestamps[timestamps.length - 1] ?? 0,
      newestCommit: timestamps[0] ?? 0,
      authors,
      operations,
      avgCommitInterval: avgInterval
    }
  }

  /**
   * Check if commit is ancestor of another commit
   *
   * @param ancestorRef - Potential ancestor ref/commit
   * @param descendantRef - Descendant ref/commit
   * @returns True if ancestor is in descendant's history
   */
  async isAncestor(ancestorRef: string, descendantRef: string): Promise<boolean> {
    const ancestorHash = await this.resolveToHash(ancestorRef)
    const descendantHash = await this.resolveToHash(descendantRef)

    // Walk from descendant, check if we encounter ancestor
    for await (const commit of this.walk(descendantHash)) {
      const commitHash = CommitObject.hash(commit)
      if (commitHash === ancestorHash) {
        return true
      }
    }

    return false
  }

  /**
   * Get recent commits (last N)
   *
   * @param ref - Starting ref
   * @param count - Number of commits to retrieve
   * @returns Array of recent commits
   */
  async getRecent(ref: string, count: number = 10): Promise<CommitObject[]> {
    return this.getHistory(ref, { maxCount: count })
  }

  /**
   * Find commits with tag
   *
   * @param ref - Starting ref
   * @param tag - Tag to search for
   * @returns Array of commits with tag
   */
  async findWithTag(ref: string, tag: string): Promise<CommitObject[]> {
    const commits: CommitObject[] = []

    for await (const commit of this.walk(ref)) {
      if (CommitObject.hasTag(commit, tag)) {
        commits.push(commit)
      }
    }

    return commits
  }

  /**
   * Get first (oldest) commit
   *
   * @param ref - Starting ref
   * @returns Oldest commit
   */
  async getFirstCommit(ref: string): Promise<CommitObject | null> {
    let oldest: CommitObject | null = null

    for await (const commit of this.walk(ref)) {
      oldest = commit
    }

    return oldest
  }

  /**
   * Get latest commit
   *
   * @param ref - Starting ref
   * @returns Latest commit
   */
  async getLatestCommit(ref: string): Promise<CommitObject | null> {
    for await (const commit of this.walk(ref, { maxDepth: 1 })) {
      return commit
    }

    return null
  }

  /**
   * Clear index (useful for testing, after new commits)
   */
  clearIndex(): void {
    this.index.clear()
    this.indexValid = false
  }

  // ========== PRIVATE METHODS ==========

  /**
   * Build commit index for fast lookups
   *
   * @param ref - Starting ref
   */
  private async buildIndex(ref: string): Promise<void> {
    if (this.indexValid) {
      return  // Already built
    }

    this.index.clear()

    for await (const commit of this.walk(ref)) {
      const hash = CommitObject.hash(commit)

      this.index.set(hash, {
        hash,
        timestamp: commit.timestamp,
        parentHash: commit.parent
      })
    }

    this.indexValid = true
  }

  /**
   * Resolve ref or hash to commit hash
   *
   * @param refOrHash - Ref name or commit hash
   * @returns Commit hash
   */
  private async resolveToHash(refOrHash: string): Promise<string> {
    if (/^[a-f0-9]{64}$/.test(refOrHash)) {
      return refOrHash  // Already a hash
    }

    const hash = await this.refManager.resolveRef(refOrHash)

    if (!hash) {
      throw new Error(`Ref not found: ${refOrHash}`)
    }

    return hash
  }
}
