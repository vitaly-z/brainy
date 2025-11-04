/**
 * RefManager: Branch and reference management for COW (Copy-on-Write)
 *
 * Similar to Git refs, manages symbolic names (branches, tags) that point to commits.
 *
 * Structure:
 * - refs/heads/main → commit hash (main branch)
 * - refs/heads/experiment → commit hash (experiment branch)
 * - refs/tags/v1.0.0 → commit hash (version tag)
 * - HEAD → ref name (current branch)
 *
 * Features:
 * - Branch management (create, delete, list)
 * - Tag management
 * - HEAD pointer (current branch)
 * - Fast-forward and force updates
 * - Atomic operations
 *
 * @module storage/cow/RefManager
 */

import type { COWStorageAdapter } from './BlobStorage.js'

/**
 * Reference type
 */
export type RefType = 'branch' | 'tag' | 'remote'

/**
 * Reference object
 */
export interface Ref {
  name: string        // Full ref name (e.g., 'refs/heads/main')
  commitHash: string  // Commit hash this ref points to
  type: RefType       // Reference type
  createdAt: number   // When ref was created
  updatedAt: number   // When ref was last updated
  metadata?: {
    description?: string
    author?: string
    [key: string]: any
  }
}

/**
 * Ref update options
 */
export interface RefUpdateOptions {
  force?: boolean          // Force update (allow non-fast-forward)
  createOnly?: boolean     // Only create, fail if exists
  updateOnly?: boolean     // Only update, fail if doesn't exist
  expectedOldValue?: string // CAS: only update if current value matches
}

/**
 * RefManager: Manages branches, tags, and HEAD pointer
 *
 * Pure implementation for v5.0.0 - no backward compatibility
 */
export class RefManager {
  private adapter: COWStorageAdapter
  private cache: Map<string, Ref>
  private cacheValid: boolean

  constructor(adapter: COWStorageAdapter) {
    this.adapter = adapter
    this.cache = new Map()
    this.cacheValid = false
  }

  /**
   * Get reference by name
   *
   * @param name - Reference name (e.g., 'main', 'refs/heads/main')
   * @returns Reference object or undefined
   */
  async getRef(name: string): Promise<Ref | undefined> {
    const fullName = this.normalizeRefName(name)

    // Check cache
    if (this.cacheValid && this.cache.has(fullName)) {
      return this.cache.get(fullName)
    }

    // Read from storage
    const data = await this.adapter.get(`ref:${fullName}`)

    if (!data) {
      return undefined
    }

    const ref = JSON.parse(data.toString()) as Ref

    // Update cache
    this.cache.set(fullName, ref)

    return ref
  }

  /**
   * Set reference to point to commit
   *
   * @param name - Reference name
   * @param commitHash - Commit hash to point to
   * @param options - Update options
   */
  async setRef(
    name: string,
    commitHash: string,
    options: RefUpdateOptions = {}
  ): Promise<void> {
    const fullName = this.normalizeRefName(name)

    // Validate commit hash format
    if (!/^[a-f0-9]{64}$/.test(commitHash)) {
      throw new Error(`Invalid commit hash: ${commitHash}`)
    }

    // Check if ref exists
    const existing = await this.getRef(fullName)


    // Handle createOnly
    if (options.createOnly && existing) {
      throw new Error(`Ref already exists: ${fullName}`)
    }

    // Handle updateOnly
    if (options.updateOnly && !existing) {
      throw new Error(`Ref does not exist: ${fullName}`)
    }

    // Handle CAS (Compare-And-Swap)
    if (options.expectedOldValue !== undefined) {
      if (!existing || existing.commitHash !== options.expectedOldValue) {
        throw new Error(
          `Ref update failed: expected ${options.expectedOldValue}, ` +
          `got ${existing?.commitHash ?? 'none'}`
        )
      }
    }

    // Check for fast-forward (if not force)
    if (!options.force && existing) {
      // TODO: Verify this is a fast-forward update
      // For now, allow all updates
    }

    // Create/update ref
    const ref: Ref = {
      name: fullName,
      commitHash,
      type: this.getRefType(fullName),
      createdAt: existing?.createdAt ?? Date.now(),
      updatedAt: Date.now(),
      metadata: existing?.metadata
    }

    // Write to storage
    await this.adapter.put(`ref:${fullName}`, Buffer.from(JSON.stringify(ref)))

    // Update cache
    this.cache.set(fullName, ref)
    this.cacheValid = false  // Invalidate for listRefs
  }

  /**
   * Delete reference
   *
   * @param name - Reference name
   */
  async deleteRef(name: string): Promise<void> {
    const fullName = this.normalizeRefName(name)

    // Don't allow deleting HEAD
    if (fullName === 'HEAD') {
      throw new Error('Cannot delete HEAD')
    }

    // Don't allow deleting main if it's the only branch
    if (fullName === 'refs/heads/main') {
      const branches = await this.listRefs('branch')
      if (branches.length === 1) {
        throw new Error('Cannot delete last branch')
      }
    }

    // Delete from storage
    await this.adapter.delete(`ref:${fullName}`)

    // Update cache
    this.cache.delete(fullName)
    this.cacheValid = false
  }

  /**
   * List all references
   *
   * @param type - Filter by type (optional)
   * @returns Array of references
   */
  async listRefs(type?: RefType): Promise<Ref[]> {
    // Get all ref keys
    const keys = await this.adapter.list('ref:')

    const refs: Ref[] = []

    for (const key of keys) {
      const refName = key.replace(/^ref:/, '')

      // Skip HEAD in listings (it's special)
      if (refName === 'HEAD') {
        continue
      }

      const ref = await this.getRef(refName)

      if (ref) {
        // Filter by type if requested
        if (!type || ref.type === type) {
          refs.push(ref)
        }
      }
    }

    // Mark cache as valid
    this.cacheValid = true

    return refs.sort((a, b) => a.name.localeCompare(b.name))
  }

  /**
   * Copy reference (create branch from existing ref)
   *
   * @param sourceName - Source reference name
   * @param targetName - Target reference name
   * @param options - Update options
   */
  async copyRef(
    sourceName: string,
    targetName: string,
    options: RefUpdateOptions = {}
  ): Promise<void> {
    const sourceRef = await this.getRef(sourceName)

    if (!sourceRef) {
      throw new Error(`Source ref not found: ${sourceName}`)
    }

    // Set target ref to same commit as source
    await this.setRef(targetName, sourceRef.commitHash, options)
  }

  /**
   * Get current HEAD (current branch)
   *
   * @returns HEAD reference or undefined
   */
  async getHead(): Promise<Ref | undefined> {
    const data = await this.adapter.get('ref:HEAD')

    if (!data) {
      return undefined
    }

    const head = JSON.parse(data.toString()) as { ref: string }

    // Resolve symbolic ref
    return this.getRef(head.ref)
  }

  /**
   * Set HEAD to point to branch
   *
   * @param branchName - Branch name (e.g., 'main', 'refs/heads/experiment')
   */
  async setHead(branchName: string): Promise<void> {
    const fullName = this.normalizeRefName(branchName)

    // Verify branch exists
    const branch = await this.getRef(fullName)

    if (!branch) {
      throw new Error(`Branch not found: ${fullName}`)
    }

    if (branch.type !== 'branch') {
      throw new Error(`Cannot set HEAD to non-branch ref: ${fullName}`)
    }

    // Set HEAD (symbolic ref)
    const head = { ref: fullName }
    await this.adapter.put('ref:HEAD', Buffer.from(JSON.stringify(head)))
  }

  /**
   * Get current commit hash (resolves HEAD)
   *
   * @returns Current commit hash or undefined
   */
  async getCurrentCommit(): Promise<string | undefined> {
    const head = await this.getHead()
    return head?.commitHash
  }

  /**
   * Create branch
   *
   * @param name - Branch name (e.g., 'experiment')
   * @param commitHash - Commit hash to point to
   * @param options - Create options
   */
  async createBranch(
    name: string,
    commitHash: string,
    options?: { description?: string; author?: string }
  ): Promise<void> {
    const fullName = this.normalizeRefName(name, 'branch')

    await this.setRef(fullName, commitHash, { createOnly: true })

    // Update metadata if provided
    if (options?.description || options?.author) {
      const ref = await this.getRef(fullName)
      if (ref) {
        ref.metadata = {
          ...ref.metadata,
          description: options.description,
          author: options.author
        }
        await this.adapter.put(`ref:${fullName}`, Buffer.from(JSON.stringify(ref)))
      }
    }
  }

  /**
   * Delete branch
   *
   * @param name - Branch name
   */
  async deleteBranch(name: string): Promise<void> {
    const fullName = this.normalizeRefName(name, 'branch')
    await this.deleteRef(fullName)
  }

  /**
   * List all branches
   *
   * @returns Array of branch references
   */
  async listBranches(): Promise<Ref[]> {
    return this.listRefs('branch')
  }

  /**
   * Create tag
   *
   * @param name - Tag name (e.g., 'v1.0.0')
   * @param commitHash - Commit hash to point to
   * @param options - Create options
   */
  async createTag(
    name: string,
    commitHash: string,
    options?: { description?: string; author?: string }
  ): Promise<void> {
    const fullName = this.normalizeRefName(name, 'tag')

    await this.setRef(fullName, commitHash, { createOnly: true })

    // Update metadata if provided
    if (options?.description || options?.author) {
      const ref = await this.getRef(fullName)
      if (ref) {
        ref.metadata = {
          ...ref.metadata,
          description: options.description,
          author: options.author
        }
        await this.adapter.put(`ref:${fullName}`, Buffer.from(JSON.stringify(ref)))
      }
    }
  }

  /**
   * Delete tag
   *
   * @param name - Tag name
   */
  async deleteTag(name: string): Promise<void> {
    const fullName = this.normalizeRefName(name, 'tag')
    await this.deleteRef(fullName)
  }

  /**
   * List all tags
   *
   * @returns Array of tag references
   */
  async listTags(): Promise<Ref[]> {
    return this.listRefs('tag')
  }

  /**
   * Check if reference exists
   *
   * @param name - Reference name
   * @returns True if reference exists
   */
  async hasRef(name: string): Promise<boolean> {
    const ref = await this.getRef(name)
    return ref !== undefined
  }

  /**
   * Update reference to new commit (with validation)
   *
   * @param name - Reference name
   * @param newCommitHash - New commit hash
   * @param oldCommitHash - Expected old commit hash (for safety)
   */
  async updateRef(
    name: string,
    newCommitHash: string,
    oldCommitHash?: string
  ): Promise<void> {
    const options: RefUpdateOptions = {}

    if (oldCommitHash) {
      options.expectedOldValue = oldCommitHash
    }

    await this.setRef(name, newCommitHash, options)
  }

  /**
   * Get commit hash for reference
   *
   * @param name - Reference name
   * @returns Commit hash or undefined
   */
  async resolveRef(name: string): Promise<string | undefined> {
    const ref = await this.getRef(name)
    return ref?.commitHash
  }

  /**
   * Find references pointing to commit
   *
   * @param commitHash - Commit hash
   * @returns Array of references pointing to this commit
   */
  async findRefsPointingTo(commitHash: string): Promise<Ref[]> {
    const allRefs = await this.listRefs()
    return allRefs.filter(ref => ref.commitHash === commitHash)
  }

  /**
   * Clear cache (useful for testing)
   */
  clearCache(): void {
    this.cache.clear()
    this.cacheValid = false
  }

  // ========== PRIVATE METHODS ==========

  /**
   * Normalize reference name to full format
   *
   * Examples:
   * - 'main' → 'refs/heads/main'
   * - 'v1.0.0' (with type='tag') → 'refs/tags/v1.0.0'
   * - 'refs/heads/experiment' → 'refs/heads/experiment'
   *
   * @param name - Reference name
   * @param type - Reference type hint
   * @returns Full reference name
   */
  private normalizeRefName(name: string, type?: RefType): string {
    // Already full format
    if (name.startsWith('refs/')) {
      return name
    }

    // HEAD is special
    if (name === 'HEAD') {
      return 'HEAD'
    }

    // Infer type from name if not provided
    if (!type) {
      // Tags usually start with 'v' or contain dots
      if (name.startsWith('v') && /\d/.test(name)) {
        type = 'tag'
      } else {
        type = 'branch'  // Default to branch
      }
    }

    // Add prefix
    switch (type) {
      case 'branch':
        return `refs/heads/${name}`
      case 'tag':
        return `refs/tags/${name}`
      case 'remote':
        return `refs/remotes/${name}`
      default:
        return name
    }
  }

  /**
   * Get reference type from full name
   *
   * @param fullName - Full reference name
   * @returns Reference type
   */
  private getRefType(fullName: string): RefType {
    if (fullName.startsWith('refs/heads/')) {
      return 'branch'
    } else if (fullName.startsWith('refs/tags/')) {
      return 'tag'
    } else if (fullName.startsWith('refs/remotes/')) {
      return 'remote'
    } else {
      return 'branch'  // Default
    }
  }
}
